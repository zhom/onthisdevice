import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, CheckCircle2, FlipHorizontal, RefreshCw, Video, VideoOff } from 'lucide-react'

import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/utils'

import { SelectField, SwitchField } from './_shared'
import { Note } from './_gif-audio-core'
import { describeCaptureError, useCaptureSupport, useDeviceList } from './_gif-audio-capture'

interface VideoFacts {
  label: string
  width: number
  height: number
  requestedFps: number | null
  facingMode: string | null
}

interface Snapshot {
  blob: Blob
  url: string
  width: number
  height: number
}

const RESOLUTIONS = [
  { value: 'auto', label: 'Let the browser choose' },
  { value: '3840x2160', label: '4K UHD (3840 × 2160)' },
  { value: '1920x1080', label: 'Full HD (1920 × 1080)' },
  { value: '1280x720', label: 'HD (1280 × 720)' },
  { value: '640x480', label: 'VGA (640 × 480)' },
  { value: '320x240', label: 'QVGA (320 × 240)' },
]

/**
 * Chromium and Safari ship requestVideoFrameCallback, which fires once per
 * decoded frame and is the only way to measure the real delivered frame rate.
 * Firefox does not, so we fall back to requestAnimationFrame there.
 */
interface FrameCallbackApi {
  requestVideoFrameCallback?: (callback: () => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

function frameCallbacks(element: HTMLVideoElement): FrameCallbackApi {
  return element as HTMLVideoElement & FrameCallbackApi
}

export default function GifAudioWebcamTest() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState('default')
  const [resolution, setResolution] = useState('auto')
  const [mirror, setMirror] = useState(true)
  const [facts, setFacts] = useState<VideoFacts | null>(null)
  const [fps, setFps] = useState(0)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)

  const devices = useDeviceList('videoinput')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const snapshotUrlRef = useRef('')

  const supported = useCaptureSupport()

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (snapshotUrlRef.current) URL.revokeObjectURL(snapshotUrlRef.current)
    }
  }, [])

  const start = useCallback(
    async (overrides?: { deviceId?: string; resolution?: string }) => {
      const wantedDevice = overrides?.deviceId ?? deviceId
      const wantedResolution = overrides?.resolution ?? resolution
      setError(null)

      const [w, h] = wantedResolution.split('x').map(Number)
      const video: MediaTrackConstraints = {
        ...(wantedDevice !== 'default' ? { deviceId: { exact: wantedDevice } } : {}),
        // `ideal` rather than `exact`: a camera that cannot do 4K should give
        // its best instead of throwing OverconstrainedError.
        ...(wantedResolution !== 'auto' && w && h
          ? { width: { ideal: w }, height: { ideal: h } }
          : {}),
      }

      try {
        const next = await navigator.mediaDevices.getUserMedia({ video, audio: false })
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = next
        setStream(next)
        void devices.refresh()

        const track = next.getVideoTracks()[0]
        const settings = track?.getSettings() ?? {}
        setFacts({
          label: track?.label || 'Camera',
          width: settings.width ?? 0,
          height: settings.height ?? 0,
          requestedFps: typeof settings.frameRate === 'number' ? settings.frameRate : null,
          facingMode: typeof settings.facingMode === 'string' ? settings.facingMode : null,
        })
      } catch (err) {
        setError(describeCaptureError(err, 'camera'))
        setStream(null)
        setFacts(null)
      }
    },
    [deviceId, devices, resolution],
  )

  const stop = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStream(null)
    setFacts(null)
    setFps(0)
  }

  // Attach the stream and measure the true delivered frame rate.
  useEffect(() => {
    const element = videoRef.current
    if (!element || !stream) return
    element.srcObject = stream
    void element.play().catch(() => {
      /* autoplay of a muted local stream is permitted; ignore races */
    })

    const api = frameCallbacks(element)
    let frames = 0
    let windowStart = performance.now()
    let rafHandle = 0
    let vfcHandle = 0
    let stopped = false

    const tick = () => {
      if (stopped) return
      frames += 1
      const now = performance.now()
      if (now - windowStart >= 1000) {
        setFps(Math.round((frames * 1000) / (now - windowStart)))
        frames = 0
        windowStart = now
      }
      if (typeof api.requestVideoFrameCallback === 'function')
        vfcHandle = api.requestVideoFrameCallback(tick)
      else rafHandle = requestAnimationFrame(tick)
    }

    if (typeof api.requestVideoFrameCallback === 'function')
      vfcHandle = api.requestVideoFrameCallback(tick)
    else rafHandle = requestAnimationFrame(tick)

    return () => {
      stopped = true
      if (rafHandle) cancelAnimationFrame(rafHandle)
      if (vfcHandle && typeof api.cancelVideoFrameCallback === 'function')
        api.cancelVideoFrameCallback(vfcHandle)
      element.srcObject = null
    }
  }, [stream])

  const takeSnapshot = () => {
    const element = videoRef.current
    if (!element || element.videoWidth === 0) return
    const canvas = document.createElement('canvas')
    canvas.width = element.videoWidth
    canvas.height = element.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    if (mirror) {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(element, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return
      if (snapshotUrlRef.current) URL.revokeObjectURL(snapshotUrlRef.current)
      const url = URL.createObjectURL(blob)
      snapshotUrlRef.current = url
      setSnapshot({ blob, url, width: canvas.width, height: canvas.height })
    }, 'image/png')
  }

  const deviceOptions = useMemo(() => {
    const list = devices.devices.map((device, index) => ({
      value: device.deviceId || `device-${index}`,
      label: device.label || `Camera ${index + 1}`,
    }))
    return [{ value: 'default', label: 'System default camera' }, ...list]
  }, [devices.devices])

  if (!supported) {
    return (
      <ErrorNote
        title="Camera testing is not available here"
        message="This browser does not expose getUserMedia, so no web page can open your camera. Use a current Chrome, Edge, Firefox or Safari over HTTPS."
      />
    )
  }

  const megapixels =
    facts && facts.width && facts.height ? (facts.width * facts.height) / 1_000_000 : 0

  return (
    <div className="space-y-4">
      <ToolPanel
        title="Webcam test"
        description="Your browser shows the camera stream below. No recording starts, and the picture stays in this tab."
      >
        {!stream ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-8 text-center">
              <Video className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm text-muted-foreground">
                Your browser will ask for camera permission. The indicator light next to your camera
                turns on while the preview is running and goes out the moment you press stop.
              </p>
              <Button type="button" className="mt-4" onClick={() => void start()}>
                <Camera className="size-4" aria-hidden="true" />
                Test my webcam
              </Button>
            </div>
            {error ? <ErrorNote message={error} onRetry={() => void start()} /> : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg bg-muted">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                aria-label="Live camera preview"
                className="mx-auto block max-h-[480px] w-full bg-muted object-contain"
                style={mirror ? { transform: 'scaleX(-1)' } : undefined}
              />
            </div>

            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 rounded-lg bg-muted p-3"
            >
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">Your camera is working</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {facts?.label ? `${facts.label} is ` : 'The camera is '}
                  delivering {facts?.width ?? 0} × {facts?.height ?? 0}
                  {fps > 0 ? ` at a measured ${fps} fps` : ''}. If a meeting app still shows a black
                  square, that app has the wrong camera selected. The hardware is fine.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ResultStat
                label="Resolution"
                value={facts ? `${facts.width} × ${facts.height}` : '–'}
                hint={megapixels > 0 ? `${megapixels.toFixed(1)} megapixels` : undefined}
                emphasis
              />
              <ResultStat
                label="Measured frame rate"
                value={fps > 0 ? `${fps} fps` : 'measuring…'}
                hint={
                  facts?.requestedFps
                    ? `Camera reports ${Math.round(facts.requestedFps)} fps`
                    : 'Counted frame by frame in this tab'
                }
              />
              <ResultStat
                label="Aspect ratio"
                value={
                  facts && facts.width && facts.height
                    ? `${(facts.width / facts.height).toFixed(2)}:1`
                    : '–'
                }
                hint={
                  facts?.facingMode
                    ? `Facing ${facts.facingMode}`
                    : 'Most webcams are 16:9 (1.78:1)'
                }
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={takeSnapshot}>
                <Camera className="size-4" aria-hidden="true" />
                Take a snapshot
              </Button>
              <Button type="button" variant="outline" onClick={() => setMirror((value) => !value)}>
                <FlipHorizontal className="size-4" aria-hidden="true" />
                {mirror ? 'Show unmirrored' : 'Mirror the preview'}
              </Button>
              <Button type="button" variant="outline" onClick={() => void start()}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Restart
              </Button>
              <Button type="button" variant="ghost" onClick={stop}>
                <VideoOff className="size-4" aria-hidden="true" />
                Stop and release the camera
              </Button>
            </div>

            {error ? <ErrorNote message={error} /> : null}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Which camera"
            value={deviceId}
            onChange={(value) => {
              setDeviceId(value)
              if (streamRef.current) void start({ deviceId: value })
            }}
            options={deviceOptions}
            hint={
              devices.hasLabels
                ? 'Switching restarts the preview on the new device.'
                : 'Camera names appear once you have allowed access one time.'
            }
          />
          <SelectField
            label="Requested resolution"
            value={resolution}
            onChange={(value) => {
              setResolution(value)
              if (streamRef.current) void start({ resolution: value })
            }}
            options={RESOLUTIONS}
            hint="The browser asks for this as a preference. A camera that cannot supply it returns its closest match."
          />
        </div>

        <SwitchField
          label="Mirror the preview"
          checked={mirror}
          onChange={setMirror}
          hint="Video calls usually mirror your own preview. Everyone else sees the unmirrored image. Snapshots follow the setting here."
        />
      </ToolPanel>

      {snapshot ? (
        <ToolPanel title="Snapshot">
          <img
            src={snapshot.url}
            alt="Snapshot captured from your camera"
            className="mx-auto max-h-[420px] w-auto max-w-full rounded-lg border border-border"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultStat
              label="Captured at"
              value={`${snapshot.width} × ${snapshot.height}`}
              hint="Full sensor resolution the browser is delivering"
            />
            <ResultStat label="PNG size" value={formatBytes(snapshot.blob.size)} hint="Lossless" />
          </div>
          <DownloadButton
            blob={snapshot.blob}
            filename="webcam-snapshot.png"
            label="Download the snapshot"
          />
          <p className="text-xs text-muted-foreground">
            The snapshot is drawn onto a canvas in this tab. It is not saved anywhere until you press
            download, and it carries no EXIF, no location and no device identifiers.
          </p>
        </ToolPanel>
      ) : null}

      <Note>
        To check that nothing is sent, open the Network tab in your browser’s developer tools and run
        the test, or turn off Wi-Fi first.
      </Note>
    </div>
  )
}
