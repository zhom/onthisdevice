/**
 * Screen recording redactor: read the recording where the screen changes
 * (OCR, rules, language model) and follow faces, list what was found with
 * its times, add boxes by hand for a time span, preview, export MP4.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Plus, RotateCcw, ScanText, Square, Trash2, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { downloadBlob, formatBytes, stripExtension } from '@/lib/utils'
import { wireBytes } from '@/lib/ml/assets'
import { loadOcr, ocrDownloadBytes, ocrIsCached } from '@/lib/ml/ocr/ocr'
import { ORT_FILES } from '@/lib/ml/ort'
import { nerClient, nerDownloadBytes, nerIsCached } from '@/lib/ml/text/ner-client'
import { defaultTypes } from '@/lib/ml/text/types'
import type { EntityType } from '@/lib/ml/text/types'
import { modelDownloadBytes, modelIsCached, visionClient } from '@/lib/ml/vision/client'
import { probeVideo, renderVideo, webCodecsGap } from '@/lib/ml/video/pipeline'
import type { VideoInfo } from '@/lib/ml/video/pipeline'
import { HideList, TypePicker, hideTerms } from '../text/Options'
import { LookControls } from '../shared/LookControls'
import { RedactionEditor } from '../shared/RedactionEditor'
import type { EditorBox } from '../shared/boxes'
import { paintRedactions } from '../shared/paint'
import type { RedactLook } from '../shared/paint'
import { boxesAt, scanScreencast, textTracks } from './scan'
import type { Scan, ScanProgress, TimedBox } from './scan'

const ACCEPT = '.mp4,.mov,.m4v,.webm,.mkv,video/*'
/** A drawn box covers this long from the frame it was drawn on. */
const MANUAL_SPAN = 5

interface ManualBox extends TimedBox {
  id: string
}

function clock(s: number): string {
  const m = Math.floor(s / 60)
  const r = s - m * 60
  return `${m}:${r.toFixed(1).padStart(4, '0')}`
}

function mb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1e6))} MB`
}

function downloadBytes(): number {
  return ocrDownloadBytes() + nerDownloadBytes() + modelDownloadBytes('face') - wireBytes(ORT_FILES)
}

export default function ScreencastRedactor() {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [info, setInfo] = useState<VideoInfo | null>(null)
  const [scan, setScan] = useState<Scan | null>(null)
  const [download, setDownload] = useState<{ loaded: number; total: number } | null>(null)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [rendering, setRendering] = useState<{ fraction: number; secondsLeft: number | null } | null>(null)
  const [cached, setCached] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [types, setTypes] = useState<Set<EntityType>>(defaultTypes)
  const [listText, setListText] = useState('')
  const [faces, setFaces] = useState(true)
  const [kept, setKept] = useState<Set<string>>(new Set())
  const [manual, setManual] = useState<ManualBox[]>([])
  const [look, setLook] = useState<RedactLook>({ style: 'fill', shape: 'rect', strength: 70 })
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [drawing, setDrawing] = useState<{ t: number; image: HTMLCanvasElement } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    void Promise.all([ocrIsCached(), nerIsCached(), modelIsCached('face')]).then((all) => setCached(all.every(Boolean)))
  }, [])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  const list = useMemo(() => hideTerms(listText), [listText])
  const allTracks = useMemo(() => (scan ? textTracks(scan, list) : []), [scan, list])
  const tracks = useMemo(() => allTracks.filter((t) => t.listed || !t.type || types.has(t.type)), [allTracks, types])
  /** One row per value: scrolling text is found in several places over time. */
  const groups = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string; value: string; start: number; end: number; tracks: typeof tracks }>()
    for (const tr of tracks) {
      const key = `${tr.label}|${tr.value}`
      const g = byKey.get(key)
      if (g) {
        g.tracks.push(tr)
        g.start = Math.min(g.start, tr.start)
        g.end = Math.max(g.end, tr.end)
      } else byKey.set(key, { key, label: tr.label, value: tr.value, start: tr.start, end: tr.end, tracks: [tr] })
    }
    return [...byKey.values()].sort((a, b) => a.start - b.start)
  }, [tracks])
  const counts = useMemo(() => {
    const c = new Map<EntityType, number>()
    for (const t of allTracks) if (t.type) c.set(t.type, (c.get(t.type) ?? 0) + 1)
    return c
  }, [allTracks])

  const boxesNow = useCallback(
    (t: number) => (scan ? boxesAt(scan, tracks, kept, faces, manual, t) : manual.filter((m) => t >= m.start && t <= m.end)),
    [scan, tracks, kept, faces, manual],
  )

  /* Preview: the frame with the redactions, drawn whenever the video shows a new frame. */
  const draw = useCallback(() => {
    const v = videoRef.current
    const c = canvasRef.current
    if (!v || !c || !v.videoWidth) return
    if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
      c.width = v.videoWidth
      c.height = v.videoHeight
    }
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0, c.width, c.height)
    const boxes = boxesNow(v.currentTime).map((b) => ({ x: b.x * c.width, y: b.y * c.height, w: b.w * c.width, h: b.h * c.height }))
    paintRedactions(ctx, boxes, look)
  }, [boxesNow, look])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    let handle = 0
    let alive = true
    const loop = () => {
      if (!alive) return
      draw()
      setTime(v.currentTime)
      handle = 'requestVideoFrameCallback' in v ? v.requestVideoFrameCallback(loop) : requestAnimationFrame(loop)
    }
    const once = () => {
      draw()
      setTime(v.currentTime)
    }
    v.addEventListener('seeked', once)
    v.addEventListener('loadeddata', once)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    loop()
    once()
    return () => {
      alive = false
      if ('cancelVideoFrameCallback' in v) v.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
      v.removeEventListener('seeked', once)
      v.removeEventListener('loadeddata', once)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [draw, url])

  async function onFiles(files: File[]) {
    const f = files[0]
    if (!f) return
    const gap = webCodecsGap()
    if (gap) return setError(gap)
    setError(null)
    setStatus('')
    setScan(null)
    setKept(new Set())
    setManual([])
    try {
      const probed = await probeVideo(f)
      setFile(f)
      setInfo(probed)
      setUrl(URL.createObjectURL(f))
    } catch {
      setError('This video could not be read. Try an MP4, MOV or WebM file.')
    }
  }

  async function startScan() {
    if (!file) return
    setError(null)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      if (!(await Promise.all([ocrIsCached(), nerIsCached(), modelIsCached('face')])).every(Boolean)) {
        const parts = [ocrDownloadBytes(), nerDownloadBytes(), modelDownloadBytes('face')]
        const total = parts.reduce((a, b) => a + b, 0)
        const done = [0, 0, 0]
        const step = (i: number) => (l: number, t: number) => {
          done[i] = t > 0 ? (parts[i] * l) / t : 0
          setDownload({ loaded: done.reduce((a, b) => a + b, 0), total })
        }
        setDownload({ loaded: 0, total })
        await loadOcr(step(0))
        await nerClient().load(step(1))
        await visionClient().load('face', step(2))
      } else {
        await Promise.all([loadOcr(), nerClient().load(), visionClient().load('face')])
      }
      setDownload(null)
      setCached(true)
      setProgress({ index: 0, total: 1, readings: 0 })
      const result = await scanScreencast(file, { onProgress: setProgress, signal: ctrl.signal })
      setScan(result)
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setError(err instanceof Error ? err.message : 'The recording could not be read.')
    } finally {
      setDownload(null)
      setProgress(null)
      abortRef.current = null
    }
  }

  async function exportVideo() {
    if (!file) return
    setError(null)
    setStatus('')
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setRendering({ fraction: 0, secondsLeft: null })
    try {
      const res = await renderVideo(file, {
        signal: ctrl.signal,
        onProgress: (p) => setRendering({ fraction: p.fraction, secondsLeft: p.secondsLeft }),
        paint: (ctx, t, w, h) => paintRedactions(ctx, boxesNow(t).map((b) => ({ x: b.x * w, y: b.y * h, w: b.w * w, h: b.h * h })), look),
      })
      const name = `${stripExtension(file.name)}-redacted.${res.extension}`
      downloadBlob(res.blob, name)
      setStatus(`Saved ${name} (${formatBytes(res.blob.size)}).${res.audio === 'dropped' ? ' This browser could not encode the sound, so the video has none.' : ''}`)
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setError(err instanceof Error ? err.message : 'The video could not be written.')
    } finally {
      setRendering(null)
      abortRef.current = null
    }
  }

  function startDrawing() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    v.pause()
    const image = document.createElement('canvas')
    image.width = v.videoWidth
    image.height = v.videoHeight
    image.getContext('2d')?.drawImage(v, 0, 0)
    setDrawing({ t: v.currentTime, image })
  }

  function editManual(next: EditorBox[]) {
    if (!drawing) return
    const t = drawing.t
    const end = Math.min(info?.duration ?? t + MANUAL_SPAN, t + MANUAL_SPAN)
    setManual((prev) => {
      const visible = new Set(prev.filter((m) => t >= m.start && t <= m.end).map((m) => m.id))
      const byId = new Map(next.map((b) => [b.id, b]))
      const kept = prev.filter((m) => !visible.has(m.id) || byId.has(m.id)).map((m) => {
        const b = byId.get(m.id)
        return b ? { ...m, x: b.x, y: b.y, w: b.w, h: b.h } : m
      })
      const added = next.filter((b) => !prev.some((m) => m.id === b.id)).map((b) => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, start: t, end }))
      return [...kept, ...added]
    })
  }

  function reset() {
    abortRef.current?.abort()
    setFile(null)
    setUrl(null)
    setInfo(null)
    setScan(null)
    setKept(new Set())
    setManual([])
    setDrawing(null)
    setStatus('')
    setError(null)
  }

  const toggleAll = (ids: string[], hide: boolean) =>
    setKept((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (hide) next.delete(id)
        else next.add(id)
      }
      return next
    })
  const toggle = (id: string, hide: boolean) => toggleAll([id], hide)

  const seek = (t: number) => {
    const v = videoRef.current
    if (v) v.currentTime = t
  }

  const duration = info?.duration ?? 0
  const busy = progress !== null || download !== null || rendering !== null

  return (
    <div className="space-y-6">
      {!file && (
        <div className="space-y-3">
          <FileDropzone accept={ACCEPT} onFiles={(f) => void onFiles(f)} maxSizeMb={2000} title="Drop a screen recording" hint="MP4, MOV or WebM. It stays on your device." />
          {!cached && <p className="text-sm text-muted-foreground">The first scan downloads the OCR engine and two small models ({mb(downloadBytes())}) once.</p>}
        </div>
      )}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
      {download && <ProgressPanel label={`Downloading (once): ${mb(download.loaded)} of ${mb(download.total)}`} value={(download.loaded / Math.max(1, download.total)) * 100} />}
      {progress && !download && (
        <ProgressPanel
          label={`Reading the recording: frame ${progress.index} of ${progress.total}`}
          sublabel={`The screen changed ${progress.readings} ${progress.readings === 1 ? 'time' : 'times'} so far; each change is read with OCR.`}
          value={(progress.index / Math.max(1, progress.total)) * 100}
        />
      )}
      {rendering && (
        <ProgressPanel
          label="Writing the video"
          sublabel={rendering.secondsLeft === null ? undefined : `About ${Math.max(1, Math.round(rendering.secondsLeft))} s left`}
          value={rendering.fraction * 100}
        />
      )}
      {busy && (
        <Button variant="secondary" onClick={() => abortRef.current?.abort()}>
          <Square aria-hidden="true" /> Stop
        </Button>
      )}

      {file && url && info && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ToolPanel title={file.name} description={`${clock(info.duration)}, ${info.width} x ${info.height}${scan ? '' : '. Press Read the recording to find what to hide.'}`}>
            <video ref={videoRef} src={url} playsInline preload="auto" className="hidden" />
            {drawing ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Drag on the frame to add a box. It covers {MANUAL_SPAN} s from {clock(drawing.t)}; change the times in the list.</p>
                <RedactionEditor
                  image={drawing.image}
                  boxes={manual.filter((m) => drawing.t >= m.start && drawing.t <= m.end).map((m) => ({ id: m.id, x: m.x, y: m.y, w: m.w, h: m.h, kind: 'manual', keep: false }))}
                  onChange={editManual}
                  look={look}
                />
                <Button onClick={() => setDrawing(null)}>Done</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <canvas ref={canvasRef} role="img" aria-label="Preview with the redactions" className="block h-auto w-full rounded-lg bg-background" />
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label={playing ? 'Pause' : 'Play'}
                    onClick={() => {
                      const v = videoRef.current
                      if (!v) return
                      if (v.paused) void v.play()
                      else v.pause()
                    }}
                  >
                    {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                  </Button>
                  <Slider aria-label="Time" min={0} max={Math.max(0.1, duration)} step={0.05} value={[time]} onValueChange={(v) => seek(v[0] ?? 0)} className="flex-1" />
                  <span className="num w-24 text-right text-sm text-muted-foreground">
                    {clock(time)} / {clock(duration)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!scan && (
                    <Button onClick={() => void startScan()} disabled={busy}>
                      <ScanText aria-hidden="true" /> Read the recording
                    </Button>
                  )}
                  <Button variant="secondary" onClick={startDrawing} disabled={busy}>
                    <Plus aria-hidden="true" /> Add a box at {clock(time)}
                  </Button>
                </div>
              </div>
            )}

            {(scan || manual.length > 0) && (
              <div className="space-y-2">
                <h3 className="text-sm font-[600]">Found and drawn</h3>
                <ul className="space-y-1.5" aria-label="Areas">
                  {groups.map((g) => {
                    const hidden = g.tracks.some((tr) => !kept.has(tr.id))
                    return (
                      <li key={g.key} className="flex items-center gap-3 rounded-lg bg-background px-3 py-2">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => seek(g.start + 0.01)}>
                          <span className="block truncate text-sm font-[600]">
                            {g.label}: {g.value}
                          </span>
                          <span className="num text-[0.8125rem] text-muted-foreground">
                            {clock(g.start)} to {clock(g.end)}
                            {g.tracks.length > 1 ? `, ${g.tracks.length} places` : ''}
                          </span>
                        </button>
                        <Switch checked={hidden} onCheckedChange={(v) => toggleAll(g.tracks.map((tr) => tr.id), v)} aria-label={`Hide ${g.label} ${g.value}`} />
                      </li>
                    )
                  })}
                  {faces &&
                    scan?.faces.map((f) => (
                      <li key={`face-${f.id}`} className="flex items-center gap-3 rounded-lg bg-background px-3 py-2">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => seek(f.keys[0].t + 0.01)}>
                          <span className="block text-sm font-[600]">Face {f.id}</span>
                          <span className="num text-[0.8125rem] text-muted-foreground">
                            {clock(f.keys[0].t)} to {clock(f.keys[f.keys.length - 1].t)}
                          </span>
                        </button>
                        <Switch checked={!kept.has(`face-${f.id}`)} onCheckedChange={(v) => toggle(`face-${f.id}`, v)} aria-label={`Hide face ${f.id}`} />
                      </li>
                    ))}
                  {manual.map((m, i) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-background px-3 py-2">
                      <span className="text-sm font-[600]">Box {i + 1}</span>
                      <Label htmlFor={`${m.id}-from`} className="text-[0.8125rem] font-normal text-muted-foreground">
                        From
                      </Label>
                      <Input
                        id={`${m.id}-from`}
                        type="number"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={m.start.toFixed(1)}
                        onChange={(e) => setManual((prev) => prev.map((x) => (x.id === m.id ? { ...x, start: Math.max(0, Number(e.target.value) || 0) } : x)))}
                        className="num h-8 w-20"
                      />
                      <Label htmlFor={`${m.id}-to`} className="text-[0.8125rem] font-normal text-muted-foreground">
                        to
                      </Label>
                      <Input
                        id={`${m.id}-to`}
                        type="number"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={m.end.toFixed(1)}
                        onChange={(e) => setManual((prev) => prev.map((x) => (x.id === m.id ? { ...x, end: Math.min(duration, Number(e.target.value) || 0) } : x)))}
                        className="num h-8 w-20"
                      />
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove box ${i + 1}`} onClick={() => setManual((prev) => prev.filter((x) => x.id !== m.id))} className="ml-auto">
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
                {scan && groups.length === 0 && (!faces || scan.faces.length === 0) && <p className="text-sm text-muted-foreground">Nothing of the chosen types was found. Add boxes by hand where needed.</p>}
              </div>
            )}
          </ToolPanel>

          <ToolPanel
            title="Options"
            footer={
              <Button size="lg" className="w-full" onClick={() => void exportVideo()} disabled={busy || drawing !== null}>
                <Video aria-hidden="true" /> Download video
              </Button>
            }
          >
            <TypePicker types={types} onChange={setTypes} counts={counts} />
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="sc-faces">Hide faces</Label>
              <Switch id="sc-faces" checked={faces} onCheckedChange={setFaces} />
            </div>
            <HideList value={listText} onChange={setListText} />
            <LookControls look={look} onChange={setLook} idPrefix="screencast" />
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <RotateCcw aria-hidden="true" /> Start over
            </Button>
          </ToolPanel>
        </div>
      )}

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>
    </div>
  )
}

