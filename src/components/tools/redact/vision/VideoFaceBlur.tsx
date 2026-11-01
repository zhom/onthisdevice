/**
 * blur-faces-in-video: scan for faces (detector + tracker in a worker),
 * choose which people stay visible, preview, then export MP4 or WebM.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Pause, Play, RotateCcw, ScanFace, Square, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn, formatBytes, stripExtension } from '@/lib/utils'
import { modelDownloadBytes, modelIsCached } from '@/lib/ml/vision/models'
import { boxesAt } from '@/lib/ml/vision/tracker'
import type { Track } from '@/lib/ml/vision/tracker'
import type { RenderResult, VideoInfo } from '@/lib/ml/video/pipeline'
import { LookControls } from '../shared/LookControls'
import { padded } from '../shared/pad'
import { paintRedactions } from '../shared/paint'
import type { RedactLook } from '../shared/paint'
import type { FaceVideoRequest, FaceVideoResponse, ScanDetail } from './face-video.worker'

const SCAN_FPS = 8
/** Boxes stay this long before the first and after the last scan of a face. */
const HOLD = 1.5 / SCAN_FPS
const PREVIEW_SIDE = 1280

type Phase = 'empty' | 'ready' | 'scanning' | 'review' | 'rendering' | 'done'

function clock(s: number): string {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

function left(s: number | null): string {
  if (s === null) return 'estimating time left'
  if (s < 60) return `about ${Math.max(1, Math.round(s))} s left`
  return `about ${Math.floor(s / 60)} min ${Math.round(s % 60)} s left`
}

export default function VideoFaceBlur() {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [info, setInfo] = useState<VideoInfo | null>(null)
  const [phase, setPhase] = useState<Phase>('empty')
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(true)
  const [download, setDownload] = useState<{ loaded: number; total: number } | null>(null)
  const [scanProgress, setScanProgress] = useState<{ index: number; total: number; secondsLeft: number | null } | null>(null)
  const [renderProgress, setRenderProgress] = useState<{ frame: number; frames: number; fraction: number; secondsLeft: number | null } | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [thumbs, setThumbs] = useState<Map<number, ImageBitmap>>(new Map())
  const [kept, setKept] = useState<Set<number>>(new Set())
  const [detail, setDetail] = useState<ScanDetail>('normal')
  const [look, setLook] = useState<RedactLook>({ style: 'blur', shape: 'oval', strength: 60 })
  const [result, setResult] = useState<{ out: RenderResult; url: string; name: string } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)

  const workerRef = useRef<Worker | null>(null)
  const fileRef = useRef<File | null>(null)
  fileRef.current = file
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef<() => void>(() => {})

  useEffect(() => {
    void modelIsCached('face').then(setCached)
    return () => workerRef.current?.terminate()
  }, [])

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url)
  }, [result])
  useEffect(() => () => {
    for (const b of thumbs.values()) b.close()
  }, [thumbs])

  const onMessage = useCallback((event: MessageEvent<FaceVideoResponse>) => {
    const msg = event.data
    switch (msg.type) {
      case 'download':
        setDownload({ loaded: msg.loaded, total: msg.total })
        break
      case 'scan-progress':
        setDownload(null)
        setScanProgress({ index: msg.index, total: msg.total, secondsLeft: msg.secondsLeft })
        break
      case 'scanned':
        setDownload(null)
        setCached(true)
        setScanProgress(null)
        setInfo(msg.info)
        setTracks(msg.tracks)
        setThumbs(new Map(msg.thumbs.map((t) => [t.id, t.bitmap])))
        setKept(new Set())
        setPhase('review')
        break
      case 'render-progress':
        setRenderProgress(msg.progress)
        break
      case 'rendered':
        setRenderProgress(null)
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.url)
          return {
            out: msg.result,
            url: URL.createObjectURL(msg.result.blob),
            name: `${stripExtension(fileRef.current?.name ?? 'video') || 'video'}-blurred.${msg.result.extension}`,
          }
        })
        setPhase('done')
        break
      case 'error':
        setDownload(null)
        setScanProgress(null)
        setRenderProgress(null)
        setPhase((p) => (p === 'scanning' ? 'ready' : p === 'rendering' ? 'review' : p))
        if (!msg.canceled) setError(msg.message)
        break
    }
  }, [])

  const send = (req: FaceVideoRequest) => {
    if (!workerRef.current) {
      const w = new Worker(new URL('./face-video.worker.ts', import.meta.url), { type: 'module', name: 'face-video' })
      w.onmessage = onMessage
      w.onerror = (e) => {
        e.preventDefault()
        setError('The video worker stopped. Reload the page and try again.')
        setPhase((p) => (p === 'scanning' ? 'ready' : p === 'rendering' ? 'review' : p))
        workerRef.current?.terminate()
        workerRef.current = null
      }
      workerRef.current = w
    }
    workerRef.current.postMessage(req)
  }

  async function onFiles(files: File[]) {
    const next = files[0]
    if (!next) return
    setError(null)
    const { probeVideo, webCodecsGap } = await import('@/lib/ml/video/pipeline')
    const gap = webCodecsGap()
    if (gap) {
      setError(gap)
      return
    }
    try {
      const probed = await probeVideo(next)
      setFile(next)
      setInfo(probed)
      setUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(next)
      })
      setTracks([])
      setThumbs(new Map())
      setKept(new Set())
      setResult(null)
      setPhase('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This video could not be opened.')
    }
  }

  function startScan() {
    if (!file) return
    setError(null)
    setPhase('scanning')
    setScanProgress({ index: 0, total: Math.max(1, Math.ceil((info?.duration ?? 1) * SCAN_FPS)), secondsLeft: null })
    send({ type: 'scan', file, fps: SCAN_FPS, detail })
  }

  function startRender() {
    if (!file) return
    setError(null)
    setPhase('rendering')
    setRenderProgress({ frame: 0, frames: info?.frames ?? 1, fraction: 0, secondsLeft: null })
    send({ type: 'render', file, tracks: tracks.filter((t) => !kept.has(t.id)), look, hold: HOLD })
  }

  /* The encoder can stall on some systems; stop after 30 s without a frame. */
  const lastFrame = renderProgress?.frame ?? -1
  useEffect(() => {
    if (phase !== 'rendering') return
    const timer = window.setTimeout(() => {
      cancel()
      setError('The video encoder stopped responding. Try the export again, or close other tabs that play video.')
    }, 30_000)
    return () => window.clearTimeout(timer)
  }, [phase, lastFrame])

  function cancel() {
    workerRef.current?.postMessage({ type: 'cancel' } satisfies FaceVideoRequest)
  }

  function reset() {
    cancel()
    setFile(null)
    setInfo(null)
    setUrl(null)
    setTracks([])
    setThumbs(new Map())
    setKept(new Set())
    setResult(null)
    setPhase('empty')
    setError(null)
  }

  function toggle(id: number) {
    setKept((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /* Preview: the current frame with every hidden track painted over it. */
  drawRef.current = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return
    const k = Math.min(1, PREVIEW_SIDE / Math.max(video.videoWidth, video.videoHeight))
    const w = Math.max(2, Math.round(video.videoWidth * k))
    const h = Math.max(2, Math.round(video.videoHeight * k))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)
    const boxes = boxesAt(
      tracks.filter((t) => !kept.has(t.id)),
      video.currentTime,
      HOLD,
    ).map((b) => padded({ x: b.x * w, y: b.y * h, w: b.w * w, h: b.h * h }, 'face', { width: w, height: h }))
    if (boxes.length > 0) paintRedactions(ctx, boxes, look)
    setTime(video.currentTime)
  }

  useEffect(() => {
    drawRef.current()
  }, [tracks, kept, look, phase])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !url) return
    let handle = 0
    let stop = false
    const hasVfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
    const loop = () => {
      if (stop) return
      drawRef.current()
      if (hasVfc) handle = video.requestVideoFrameCallback(loop)
      else handle = requestAnimationFrame(loop)
    }
    const redraw = () => drawRef.current()
    video.addEventListener('loadeddata', redraw)
    video.addEventListener('seeked', redraw)
    loop()
    return () => {
      stop = true
      if (hasVfc) video.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
      video.removeEventListener('loadeddata', redraw)
      video.removeEventListener('seeked', redraw)
    }
  }, [url])

  function onPreviewClick(e: ReactPointerEvent<HTMLCanvasElement>) {
    const video = videoRef.current
    if (!video || phase !== 'review') return
    const r = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    const fy = (e.clientY - r.top) / r.height
    const hit = boxesAt(tracks, video.currentTime, HOLD).find((b) => fx >= b.x && fx <= b.x + b.w && fy >= b.y - b.h * 0.3 && fy <= b.y + b.h * 1.2)
    if (hit) toggle(hit.id)
  }

  function playPause() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  const busy = phase === 'scanning' || phase === 'rendering'
  const hiddenCount = tracks.filter((t) => !kept.has(t.id)).length

  return (
    <div className="space-y-6">
      {phase === 'empty' && (
        <div className="space-y-3">
          <FileDropzone
            accept="video/*,.mp4,.mov,.webm,.mkv,.m4v"
            onFiles={onFiles}
            maxSizeMb={4000}
            title="Drop a video with faces"
            hint="MP4, MOV, WebM or MKV. It stays on your device."
          />
          {!cached && (
            <p className="text-sm text-muted-foreground">
              The first scan downloads the face detection model ({Math.round(modelDownloadBytes('face') / 1e6)} MB) once.
            </p>
          )}
        </div>
      )}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {url && phase !== 'empty' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ToolPanel
            title={phase === 'review' || phase === 'rendering' || phase === 'done' ? `${tracks.length} ${tracks.length === 1 ? 'person' : 'people'} found` : 'Preview'}
            description={
              info
                ? `${info.width} x ${info.height}, ${clock(info.duration)}, about ${Math.round(info.fps)} frames per second${info.hasAudio ? ', with sound' : ', no sound'}.`
                : undefined
            }
          >
            <video ref={videoRef} src={url} playsInline preload="auto" className="sr-only" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={phase === 'review' ? `Preview with ${hiddenCount} of ${tracks.length} people blurred` : 'Video preview'}
              onPointerUp={onPreviewClick}
              className={cn('block h-auto w-full rounded-lg bg-muted', phase === 'review' && 'cursor-pointer')}
            />
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" size="icon" aria-label={playing ? 'Pause' : 'Play'} onClick={playPause}>
                {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              </Button>
              <Slider
                aria-label="Position"
                className="flex-1"
                min={0}
                max={Math.max(0.1, info?.duration ?? 0.1)}
                step={0.04}
                value={[time]}
                onValueChange={(v) => {
                  const video = videoRef.current
                  if (video && v[0] !== undefined) video.currentTime = v[0]
                }}
              />
              <span className="num text-sm text-muted-foreground">
                {clock(time)} / {clock(info?.duration ?? 0)}
              </span>
            </div>

            {tracks.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Click a person to keep their face visible. Click again to blur it.</p>
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="People">
                  {tracks.map((t, i) => {
                    const keep = kept.has(t.id)
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          aria-pressed={!keep}
                          aria-label={`Person ${i + 1}, from ${clock(t.keys[0]!.t)}: ${keep ? 'visible' : 'blurred'}`}
                          onClick={() => toggle(t.id)}
                          disabled={busy}
                          className="group flex w-full flex-col items-center gap-1 rounded-lg bg-background p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Thumb bitmap={thumbs.get(t.id)} />
                          <span className="text-xs font-[600]">Person {i + 1}</span>
                          <span className="text-xs text-muted-foreground">{keep ? 'Visible' : 'Blurred'}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {phase === 'review' && tracks.length === 0 && <p className="text-sm text-muted-foreground">No faces were found. Try a clip where faces are larger or better lit.</p>}
          </ToolPanel>

          <ToolPanel title="Options">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="video-detail">Find small faces</Label>
                <p className="text-xs text-muted-foreground">Faces far from the camera. The scan takes about 3 times longer.</p>
              </div>
              <Switch id="video-detail" checked={detail === 'high'} onCheckedChange={(v) => setDetail(v ? 'high' : 'normal')} disabled={busy} />
            </div>
            <LookControls look={look} onChange={setLook} idPrefix="video" />
            <div className="flex flex-col gap-2">
              {(phase === 'ready' || phase === 'scanning') && (
                <Button size="lg" className="w-full" onClick={startScan} disabled={busy}>
                  <ScanFace aria-hidden="true" /> Find faces
                </Button>
              )}
              {(phase === 'review' || phase === 'rendering' || phase === 'done') && (
                <>
                  <Button size="lg" className="w-full" onClick={startRender} disabled={busy}>
                    <Video aria-hidden="true" /> {phase === 'done' ? 'Export again' : 'Export video'}
                  </Button>
                  <Button variant="secondary" className="w-full" onClick={startScan} disabled={busy}>
                    <ScanFace aria-hidden="true" /> Scan again
                  </Button>
                </>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Choose another video
              </Button>
            </div>
            {info && info.duration > 600 && (
              <p className="text-xs text-muted-foreground">Long videos need a lot of memory. If the export fails, cut the video into shorter parts.</p>
            )}
            {download && (
              <ProgressPanel
                className="bg-background"
                label={`Downloading the face model (once): ${Math.round(download.loaded / 1e6)} of ${Math.round(download.total / 1e6)} MB`}
                value={(download.loaded / Math.max(1, download.total)) * 100}
              />
            )}
            {phase === 'scanning' && scanProgress && !download && (
              <ProgressPanel
                className="bg-background"
                label={`Scanning frame ${scanProgress.index} of ${scanProgress.total}`}
                value={(scanProgress.index / Math.max(1, scanProgress.total)) * 100}
                sublabel={left(scanProgress.secondsLeft)}
              />
            )}
            {phase === 'rendering' && renderProgress && (
              <ProgressPanel
                className="bg-background"
                label={`Encoding frame ${renderProgress.frame} of ${renderProgress.frames}`}
                value={renderProgress.fraction * 100}
                sublabel={left(renderProgress.secondsLeft)}
              />
            )}
            {busy && (
              <Button type="button" variant="secondary" onClick={cancel}>
                <Square aria-hidden="true" /> Cancel
              </Button>
            )}
          </ToolPanel>
        </div>
      )}

      {result && phase === 'done' && (
        <ToolPanel title="Blurred video" description={`${result.out.width} x ${result.out.height} ${result.out.extension.toUpperCase()}, ${formatBytes(result.out.blob.size)}. ${result.out.audio === 'kept' ? 'Sound kept.' : result.out.audio === 'dropped' ? 'This browser cannot encode the sound, so the video has no sound.' : 'The video had no sound.'}`}>
          <video src={result.url} controls playsInline className="block h-auto w-full rounded-lg bg-muted" />
          <DownloadButton blob={result.out.blob} filename={result.name} label={`Download ${result.out.extension.toUpperCase()}`} />
        </ToolPanel>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {phase === 'review' ? `${tracks.length} people found.` : phase === 'done' ? 'The video is ready to download.' : ''}
      </p>
    </div>
  )
}

function Thumb({ bitmap }: { bitmap: ImageBitmap | undefined }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !bitmap) return
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    ctx.drawImage(bitmap, 0, 0)
  }, [bitmap])
  return <canvas ref={ref} aria-hidden="true" className="aspect-square w-full max-w-24 rounded-md bg-muted" />
}

