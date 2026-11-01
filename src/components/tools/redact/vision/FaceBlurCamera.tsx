/**
 * face-blur-camera: the camera picture with every face redacted live. The
 * detector runs in the shared vision worker as often as the device allows;
 * drawing follows the camera frame rate. The output canvas can be recorded
 * (MediaRecorder), shown picture-in-picture or in its own window to share
 * in a call.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppWindow, Circle, Camera, CameraOff, PictureInPicture2, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes } from '@/lib/utils'
import { modelDownloadBytes, modelIsCached, visionClient } from '@/lib/ml/vision/client'
import { FRAME_FACES } from '@/lib/ml/vision/faces'
import { Tracker } from '@/lib/ml/vision/tracker'
import type { Box } from '@/lib/ml/vision/geometry'
import { LookControls } from '../shared/LookControls'
import { padded } from '../shared/pad'
import { paintRedactions } from '../shared/paint'
import type { RedactLook } from '../shared/paint'

/** Long side of the frame the detector sees. */
const DETECT_SIDE = 640
/** A face missed for this long stops being redacted. */
const HOLD = 0.5

const RECORD_TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

function cameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError') return 'Camera access was blocked. Allow the camera for this site in the browser settings, then try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found. Connect a camera and try again.'
  if (name === 'NotReadableError') return 'The camera is in use by another app. Close that app and try again.'
  return err instanceof Error && err.message ? err.message : 'The camera could not be started.'
}

export default function FaceBlurCamera() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [look, setLook] = useState<RedactLook>({ style: 'blur', shape: 'oval', strength: 70 })
  const [keepLargest, setKeepLargest] = useState(false)
  const [rate, setRate] = useState(0)
  const [faces, setFaces] = useState(0)
  const [cached, setCached] = useState(true)
  const [download, setDownload] = useState<{ loaded: number; total: number } | null>(null)
  const [recording, setRecording] = useState<{ started: number } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [recordSound, setRecordSound] = useState(false)
  const [clip, setClip] = useState<{ blob: Blob; name: string; url: string } | null>(null)
  const [popped, setPopped] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pipRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const outStreamRef = useRef<MediaStream | null>(null)
  const runRef = useRef(0)
  const boxesRef = useRef<Box[]>([])
  const lookRef = useRef(look)
  lookRef.current = look
  const keepRef = useRef(keepLargest)
  keepRef.current = keepLargest
  const recorderRef = useRef<MediaRecorder | null>(null)
  const micRef = useRef<MediaStream | null>(null)
  const popupRef = useRef<Window | null>(null)

  useEffect(() => {
    void modelIsCached('face').then(setCached)
  }, [])

  const listDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const all = await navigator.mediaDevices.enumerateDevices()
    setDevices(all.filter((d) => d.kind === 'videoinput'))
  }, [])

  /** The output stream: the redacted canvas, created once per run. */
  const outputStream = useCallback((): MediaStream | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    outStreamRef.current ??= canvas.captureStream(30)
    return outStreamRef.current
  }, [])

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  const stop = useCallback(() => {
    runRef.current++
    stopRecording()
    for (const t of streamRef.current?.getTracks() ?? []) t.stop()
    streamRef.current = null
    for (const t of outStreamRef.current?.getTracks() ?? []) t.stop()
    outStreamRef.current = null
    if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => {})
    popupRef.current?.close()
    popupRef.current = null
    setPopped(false)
    const video = videoRef.current
    if (video) video.srcObject = null
    boxesRef.current = []
    setRunning(false)
    setRate(0)
    setFaces(0)
  }, [stopRecording])

  useEffect(() => stop, [stop])

  async function start(id = deviceId) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot use a camera in a web page, or the page is not on a secure connection.')
      return
    }
    stop()
    setError(null)
    setStarting(true)
    const run = runRef.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: id ? { exact: id } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      if (run !== runRef.current) {
        for (const t of stream.getTracks()) t.stop()
        return
      }
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      const active = stream.getVideoTracks()[0]?.getSettings().deviceId
      if (active) setDeviceId(active)
      void listDevices()

      const vision = visionClient()
      if (!(await modelIsCached('face'))) setDownload({ loaded: 0, total: modelDownloadBytes('face') })
      await vision.load('face', (loaded, total) => setDownload({ loaded, total }))
      setDownload(null)
      setCached(true)
      if (run !== runRef.current) return
      setRunning(true)
      drawLoop(run)
      void detectLoop(run)
    } catch (err) {
      setDownload(null)
      stop()
      setError(cameraError(err))
    } finally {
      setStarting(false)
    }
  }

  async function detectLoop(run: number) {
    const video = videoRef.current
    if (!video) return
    const vision = visionClient()
    const tracker = new Tracker({ maxGap: HOLD, keepEnded: false })
    let count = 0
    let windowStart = performance.now()
    while (run === runRef.current) {
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (vw === 0 || vh === 0) {
        await new Promise((r) => setTimeout(r, 50))
        continue
      }
      const k = Math.min(1, DETECT_SIDE / Math.max(vw, vh))
      const dw = Math.round(vw * k)
      const dh = Math.round(vh * k)
      try {
        const bitmap = await createImageBitmap(video, { resizeWidth: dw, resizeHeight: dh, resizeQuality: 'low' })
        const dets = await vision.detect(bitmap, { model: 'face', options: FRAME_FACES, scale: 1 / k })
        if (run !== runRef.current) return
        const now = performance.now() / 1000
        tracker.update(now, dets)
        boxesRef.current = tracker.current.map((tr) => tr.keys[tr.keys.length - 1]!)
      } catch (err) {
        if (run !== runRef.current) return
        setError(err instanceof Error ? err.message : 'Face detection stopped.')
        stop()
        return
      }
      count++
      const t = performance.now()
      if (t - windowStart >= 1000) {
        setRate(Math.round((count * 1000) / (t - windowStart)))
        setFaces(boxesRef.current.length)
        count = 0
        windowStart = t
      }
    }
  }

  function drawLoop(run: number) {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const hasVfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
    const draw = () => {
      if (run !== runRef.current) return
      const w = video.videoWidth
      const h = video.videoHeight
      if (w > 0 && h > 0) {
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }
        ctx.drawImage(video, 0, 0, w, h)
        let boxes = boxesRef.current
        if (keepRef.current && boxes.length > 0) {
          const largest = boxes.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a))
          boxes = boxes.filter((b) => b !== largest)
        }
        if (boxes.length > 0) paintRedactions(ctx, boxes.map((b) => padded(b, 'face', { width: w, height: h })), lookRef.current)
      }
      if (hasVfc) video.requestVideoFrameCallback(draw)
      else requestAnimationFrame(draw)
    }
    draw()
  }

  async function startRecording() {
    const out = outputStream()
    if (!out || typeof MediaRecorder === 'undefined') {
      setError('This browser cannot record in a web page.')
      return
    }
    const type = RECORD_TYPES.find((t) => MediaRecorder.isTypeSupported(t))
    const tracks: MediaStreamTrack[] = [...out.getVideoTracks()]
    if (recordSound) {
      try {
        micRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
        tracks.push(...micRef.current.getAudioTracks())
      } catch (err) {
        setError(cameraError(err).replace('Camera', 'Microphone').replace('camera', 'microphone'))
        return
      }
    }
    const rec = new MediaRecorder(new MediaStream(tracks), type ? { mimeType: type, videoBitsPerSecond: 6_000_000 } : undefined)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    rec.onstop = () => {
      for (const t of micRef.current?.getTracks() ?? []) t.stop()
      micRef.current = null
      const mime = rec.mimeType || type || 'video/webm'
      const blob = new Blob(chunks, { type: mime })
      const ext = mime.includes('mp4') ? 'mp4' : 'webm'
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
      setClip((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return { blob, name: `face-blur-${stamp}.${ext}`, url: URL.createObjectURL(blob) }
      })
      setRecording(null)
      recorderRef.current = null
    }
    rec.start(1000)
    recorderRef.current = rec
    setRecording({ started: performance.now() })
  }

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setElapsed(Math.floor((performance.now() - recording.started) / 1000)), 500)
    return () => window.clearInterval(timer)
  }, [recording])

  useEffect(() => () => {
    if (clip) URL.revokeObjectURL(clip.url)
  }, [clip])

  async function pictureInPicture() {
    const pip = pipRef.current
    const out = outputStream()
    if (!pip || !out) return
    try {
      if (pip.srcObject !== out) pip.srcObject = out
      await pip.play()
      await pip.requestPictureInPicture()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Picture-in-picture is not available.')
    }
  }

  function popOut() {
    const out = outputStream()
    if (!out) return
    const win = window.open('', 'face-blur-output', 'popup,width=960,height=540')
    if (!win) {
      setError('The browser blocked the new window. Allow pop-ups for this site and try again.')
      return
    }
    popupRef.current = win
    const doc = win.document
    doc.title = 'Face Blur Camera'
    doc.body.replaceChildren()
    Object.assign(doc.body.style, { margin: '0', background: '#000', height: '100vh', overflow: 'hidden' })
    const video = doc.createElement('video')
    Object.assign(video.style, { width: '100%', height: '100%', objectFit: 'contain' })
    video.muted = true
    video.autoplay = true
    video.playsInline = true
    video.srcObject = out
    doc.body.append(video)
    void video.play().catch(() => {})
    setPopped(true)
    win.addEventListener('pagehide', () => setPopped(false))
  }

  const pipSupported = typeof document !== 'undefined' && document.pictureInPictureEnabled

  return (
    <div className="space-y-6">
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
      {download && (
        <ProgressPanel
          label={`Downloading the face model (once): ${Math.round(download.loaded / 1e6)} of ${Math.round(download.total / 1e6)} MB`}
          value={(download.loaded / Math.max(1, download.total)) * 100}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ToolPanel
          title={running ? (faces === 1 ? '1 face in view' : `${faces} faces in view`) : 'Camera'}
          description={running ? `Checking for faces ${rate} times per second.` : 'The picture stays in this page. Nothing is sent anywhere.'}
        >
          <video ref={videoRef} muted playsInline className="sr-only" aria-hidden="true" />
          <video ref={pipRef} muted playsInline className="sr-only" aria-hidden="true" />
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={running ? `Camera picture with ${faces} faces blurred` : 'Camera is off'}
              className={running ? 'block h-full w-full object-contain' : 'hidden'}
            />
            {!running && (
              <Button size="lg" onClick={() => void start()} disabled={starting}>
                <Camera aria-hidden="true" /> {starting ? 'Starting the camera' : 'Turn on camera'}
              </Button>
            )}
          </div>
          {!running && !cached && (
            <p className="text-sm text-muted-foreground">
              The first start downloads the face detection model ({Math.round(modelDownloadBytes('face') / 1e6)} MB) once.
            </p>
          )}
          {running && (
            <div className="flex flex-wrap gap-2">
              {!recording ? (
                <Button onClick={() => void startRecording()}>
                  <Circle aria-hidden="true" /> Record
                </Button>
              ) : (
                <Button onClick={stopRecording}>
                  <Square aria-hidden="true" /> Stop recording ({Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')})
                </Button>
              )}
              {pipSupported && (
                <Button variant="secondary" onClick={() => void pictureInPicture()}>
                  <PictureInPicture2 aria-hidden="true" /> Picture in picture
                </Button>
              )}
              <Button variant="secondary" onClick={popOut} disabled={popped}>
                <AppWindow aria-hidden="true" /> Open in a window
              </Button>
              <Button variant="ghost" onClick={stop}>
                <CameraOff aria-hidden="true" /> Turn off camera
              </Button>
            </div>
          )}
        </ToolPanel>

        <ToolPanel title="Options">
          {devices.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="cam-device">Camera</Label>
              <Select
                value={deviceId}
                onValueChange={(v) => {
                  setDeviceId(v)
                  if (running) void start(v)
                }}
              >
                <SelectTrigger id="cam-device">
                  <SelectValue placeholder="Choose a camera" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((d, i) => (
                    <SelectItem key={d.deviceId || i} value={d.deviceId || `camera-${i}`}>
                      {d.label || `Camera ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="cam-keep">Keep the largest face</Label>
              <p className="text-xs text-muted-foreground">The face nearest the camera stays sharp.</p>
            </div>
            <Switch id="cam-keep" checked={keepLargest} onCheckedChange={setKeepLargest} />
          </div>
          <LookControls look={look} onChange={setLook} idPrefix="cam" />
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="cam-sound">Record sound</Label>
            <Switch id="cam-sound" checked={recordSound} onCheckedChange={setRecordSound} disabled={recording !== null} />
          </div>
        </ToolPanel>
      </div>

      {clip && (
        <ToolPanel title="Recorded clip" description={`${clip.name.endsWith('mp4') ? 'MP4' : 'WebM'}, ${formatBytes(clip.blob.size)}.`}>
          <video src={clip.url} controls playsInline className="block h-auto w-full rounded-lg bg-muted" />
          <DownloadButton blob={clip.blob} filename={clip.name} label="Download clip" />
        </ToolPanel>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {running ? 'Camera on. Faces are blurred.' : ''}
        {recording ? ' Recording.' : ''}
      </p>
    </div>
  )
}
