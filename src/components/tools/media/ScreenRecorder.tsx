import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleDot, Film, Mic, Pause, Play, Square, TriangleAlert } from 'lucide-react'

import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { Button } from '@/components/ui/button'
import { cn, formatBytes } from '@/lib/utils'

import { formatTimecode } from './_ffmpeg'
import { EngineNotice, JobError, JobStatus, ResultPanel, SelectField, SwitchField, useMediaJob } from './_shared'

type Phase = 'idle' | 'starting' | 'recording' | 'paused' | 'stopped'

const QUALITY_OPTIONS = [
  { value: 'high', label: 'High: 8 Mbps, for text-heavy screens' },
  { value: 'balanced', label: 'Balanced: 4 Mbps (recommended)' },
  { value: 'small', label: 'Small: 1.5 Mbps, for long recordings' },
]

const BITRATES: Record<string, number> = { high: 8_000_000, balanced: 4_000_000, small: 1_500_000 }

const MP4_TYPES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4']
const WEBM_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm',
]

function pickMimeType(preferMp4: boolean): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const order = preferMp4 ? [...MP4_TYPES, ...WEBM_TYPES] : [...WEBM_TYPES, ...MP4_TYPES]
  return order.find((type) => MediaRecorder.isTypeSupported(type)) ?? null
}

function humanizeCaptureError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError')
    return 'Screen capture was cancelled or blocked. Press “Start recording” again and choose a screen, window or tab in the picker your browser shows.'
  if (name === 'NotFoundError')
    return 'No screen, window or tab was available to capture. If you are inside a virtual machine or a locked-down profile, screen capture may be disabled by policy.'
  if (name === 'NotReadableError')
    return 'Your operating system refused to hand over the screen. On macOS, allow your browser under System Settings → Privacy & Security → Screen Recording, then restart the browser.'
  if (name === 'AbortError') return 'The capture was interrupted before it started. Try again.'
  return error instanceof Error && error.message
    ? `Screen capture failed: ${error.message}`
    : 'Screen capture failed for an unknown reason. Try again, or try another browser.'
}

export default function ScreenRecorder() {
  const job = useMediaJob()

  const [phase, setPhase] = useState<Phase>('idle')
  const [supported, setSupported] = useState(true)
  const [withMic, setWithMic] = useState(false)
  const [withSystemAudio, setWithSystemAudio] = useState(true)
  const [preferMp4, setPreferMp4] = useState(false)
  const [quality, setQuality] = useState('balanced')
  const [seconds, setSeconds] = useState(0)
  const [bytes, setBytes] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [recording, setRecording] = useState<{ blob: Blob; type: string; seconds: number } | null>(null)

  const liveRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamsRef = useRef<MediaStream[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<number | null>(null)
  const secondsRef = useRef(0)
  const mp4Supported = useRef(false)
  const [playbackUrl, setPlaybackUrl] = useState('')

  useEffect(() => {
    if (!recording) {
      setPlaybackUrl('')
      return
    }
    const url = URL.createObjectURL(recording.blob)
    setPlaybackUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [recording])

  const tick = useCallback(() => {
    secondsRef.current += 1
    setSeconds(secondsRef.current)
  }, [])

  useEffect(() => {
    setSupported(
      typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
        typeof MediaRecorder !== 'undefined',
    )
    mp4Supported.current =
      typeof MediaRecorder !== 'undefined' && MP4_TYPES.some((t) => MediaRecorder.isTypeSupported(t))
  }, [])

  const teardown = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    for (const stream of streamsRef.current) for (const track of stream.getTracks()) track.stop()
    streamsRef.current = []
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined)
      audioContextRef.current = null
    }
    if (liveRef.current) liveRef.current.srcObject = null
  }, [])

  useEffect(() => teardown, [teardown])

  const start = async () => {
    setError(null)
    setNotice(null)
    setRecording(null)
    job.reset()
    setBytes(0)
    setSeconds(0)
    secondsRef.current = 0
    setPhase('starting')

    let display: MediaStream
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: withSystemAudio,
      })
    } catch (captureError) {
      setError(humanizeCaptureError(captureError))
      setPhase('idle')
      return
    }
    streamsRef.current.push(display)

    let mic: MediaStream | null = null
    if (withMic) {
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        })
        streamsRef.current.push(mic)
      } catch {
        setNotice(
          'The microphone could not be opened, so the recording will have no commentary track. Check the site’s microphone permission in the address bar.',
        )
      }
    }

    const systemTracks = display.getAudioTracks()
    if (withSystemAudio && systemTracks.length === 0)
      setNotice(
        'Your browser did not include system audio. Chrome and Edge offer a “Share tab audio” checkbox when you pick a tab, and “Share system audio” for a whole screen on Windows; Firefox and Safari do not offer it at all.',
      )

    // Mix whatever audio we ended up with into one track.
    const tracks: MediaStreamTrack[] = [...display.getVideoTracks()]
    const audioSources = [...(systemTracks.length ? [display] : []), ...(mic ? [mic] : [])]
    if (audioSources.length === 1) {
      tracks.push(...audioSources[0].getAudioTracks())
    } else if (audioSources.length > 1) {
      const context = new AudioContext()
      audioContextRef.current = context
      const destination = context.createMediaStreamDestination()
      for (const stream of audioSources) context.createMediaStreamSource(stream).connect(destination)
      tracks.push(...destination.stream.getAudioTracks())
    }

    const combined = new MediaStream(tracks)
    const mimeType = pickMimeType(preferMp4)
    if (!mimeType) {
      setError('This browser cannot record video with MediaRecorder. Try current Chrome, Edge or Firefox.')
      teardown()
      setPhase('idle')
      return
    }

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: BITRATES[quality] ?? BITRATES.balanced,
      })
    } catch {
      setError('This browser refused the chosen recording settings. Try the balanced quality preset.')
      teardown()
      setPhase('idle')
      return
    }

    chunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return
      chunksRef.current.push(event.data)
      setBytes((current) => current + event.data.size)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      chunksRef.current = []
      setRecording({ blob, type: mimeType, seconds: secondsRef.current })
      setPhase('stopped')
      teardown()
    }
    recorder.onerror = () => {
      setError('The recorder stopped unexpectedly. Whatever was captured up to that point is kept.')
    }

    // The browser's own "Stop sharing" bar must end the recording too.
    for (const track of display.getVideoTracks())
      track.addEventListener('ended', () => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive')
          recorderRef.current.stop()
      })

    recorderRef.current = recorder
    recorder.start(1000)
    setPhase('recording')

    timerRef.current = window.setInterval(tick, 1000)

    if (liveRef.current) {
      liveRef.current.srcObject = new MediaStream(display.getVideoTracks())
      void liveRef.current.play().catch(() => undefined)
    }
  }

  const pause = () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    recorder.pause()
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setPhase('paused')
  }

  const resume = () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'paused') return
    recorder.resume()
    timerRef.current = window.setInterval(tick, 1000)
    setPhase('recording')
  }

  const stop = () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else {
      teardown()
      setPhase('idle')
    }
  }

  const isMp4 = recording?.type.includes('mp4') ?? false
  const extension = isMp4 ? 'mp4' : 'webm'
  const filename = `screen-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${extension}`

  const convert = () => {
    if (!recording) return
    void job.run(() => ({
      inputs: [{ name: `recording.${extension}`, data: recording.blob }],
      commands: [
        [
          '-i',
          `recording.${extension}`,
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '23',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '160k',
          '-movflags',
          '+faststart',
          'output.mp4',
        ],
      ],
      output: 'output.mp4',
      mime: 'video/mp4',
      filename: filename.replace(/\.webm$/, '.mp4'),
      durationSec: recording.seconds,
      inputBytes: recording.blob.size,
    }))
  }

  if (!supported) {
    return (
      <div className="space-y-4">
        <ErrorNote
          title="Screen recording is not available in this browser"
          message={
            <>
              This tool needs the <span className="font-mono">getDisplayMedia</span> API. Desktop
              Chrome, Edge, Firefox, Opera and Safari 13+ have it, but mobile browsers do not. On iOS
              and Android, use the screen recorder built into the operating system, then bring the
              file back here to crop, trim or convert it.
            </>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {phase === 'idle' || phase === 'starting' ? (
        <ToolPanel
          title="Recording setup"
          description="Choose what to capture, then pick the screen, window or tab in the picker your browser shows. The frames go into memory in this tab and are not streamed anywhere."
          footer={
            <Button type="button" onClick={() => void start()} disabled={phase === 'starting'}>
              <CircleDot className="size-4" aria-hidden="true" />
              {phase === 'starting' ? 'Waiting for the picker…' : 'Start recording'}
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SwitchField
              label="Record my microphone"
              checked={withMic}
              onChange={setWithMic}
              hint="Adds a commentary track. Your browser will ask for microphone permission."
            />
            <SwitchField
              label="Record system / tab audio"
              checked={withSystemAudio}
              onChange={setWithSystemAudio}
              hint="Chrome and Edge show a “share audio” checkbox in the picker. Firefox and Safari cannot capture it."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Video quality"
              value={quality}
              onChange={setQuality}
              options={QUALITY_OPTIONS}
              hint={`About ${((BITRATES[quality] ?? 4_000_000) / 8 / 1024 / 1024 * 60).toFixed(0)} MB per minute.`}
            />
            <SwitchField
              label="Record straight to MP4 when possible"
              checked={preferMp4}
              onChange={setPreferMp4}
              hint={
                mp4Supported.current
                  ? 'Supported here. Skips the conversion step afterwards.'
                  : 'Not supported by this browser. It records WebM, which you can convert afterwards.'
              }
            />
          </div>
          <p className="text-sm text-muted-foreground">
            There is no time limit. The recording is held in memory until you save it, so for very
            long sessions watch the size counter and save in parts.
          </p>
        </ToolPanel>
      ) : null}

      {phase === 'recording' || phase === 'paused' ? (
        <ToolPanel
          title={
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-block size-2.5 rounded-full',
                  phase === 'recording' ? 'animate-pulse bg-destructive' : 'bg-muted-foreground',
                )}
                aria-hidden="true"
              />
              {phase === 'recording' ? 'Recording' : 'Paused'}
            </span>
          }
          description="Switch to the window you are recording. This tab keeps capturing in the background."
          footer={
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button type="button" variant="destructive" onClick={stop}>
                <Square className="size-4" aria-hidden="true" />
                Stop and save
              </Button>
              {phase === 'recording' ? (
                <Button type="button" variant="outline" onClick={pause}>
                  <Pause className="size-4" aria-hidden="true" />
                  Pause
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={resume}>
                  <Play className="size-4" aria-hidden="true" />
                  Resume
                </Button>
              )}
            </div>
          }
        >
          <div role="status" aria-live="polite" className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Length" value={formatTimecode(seconds, 0)} emphasis />
            <ResultStat label="Captured so far" value={formatBytes(bytes)} />
            <ResultStat
              label="Audio"
              value={withMic || withSystemAudio ? 'On' : 'Silent'}
              hint={[withMic ? 'microphone' : null, withSystemAudio ? 'system' : null]
                .filter(Boolean)
                .join(' + ')}
            />
          </div>
          <video
            ref={liveRef}
            muted
            playsInline
            className="max-h-[360px] w-full rounded-lg bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            The preview is muted on purpose. Playing your own system audio back would cause a
            feedback loop.
          </p>
        </ToolPanel>
      ) : null}

      {notice ? (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {notice}
          </span>
        </p>
      ) : null}

      {error ? <ErrorNote message={error} onRetry={() => void start()} /> : null}

      {phase === 'stopped' && recording ? (
        <ToolPanel
          title="Recording finished"
          description={`${extension.toUpperCase()} · ${formatBytes(recording.blob.size)} · ${formatTimecode(
            recording.seconds,
            0,
          )}`}
          footer={
            <div className="flex w-full flex-wrap items-center gap-2">
              <DownloadButton
                blob={recording.blob}
                filename={filename}
                label={`Download ${extension.toUpperCase()}`}
              />
              {!isMp4 ? (
                <Button type="button" variant="outline" onClick={convert} disabled={job.busy}>
                  <Film className="size-4" aria-hidden="true" />
                  {job.busy ? 'Converting…' : 'Convert to MP4'}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRecording(null)
                  job.reset()
                  setPhase('idle')
                }}
                disabled={job.busy}
              >
                Record again
              </Button>
            </div>
          }
        >
          <video
            src={playbackUrl}
            controls
            playsInline
            className="max-h-[420px] w-full rounded-lg bg-muted"
          />
          {!isMp4 ? (
            <p className="text-sm text-muted-foreground">
              The recording is WebM, which is what browsers produce natively. It plays in every
              browser and in VLC, but some editors and iPhones need MP4. Converting re-encodes it
              to H.264 with FFmpeg in this tab, and also rewrites the duration header that
              MediaRecorder leaves empty (the reason a raw WebM recording often will not seek).
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              This browser recorded H.264 in an MP4 container directly, so the file is ready for
              any editor or phone without conversion.
            </p>
          )}
          {withMic ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Mic className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Your microphone track is mixed into this file.
            </p>
          ) : null}
        </ToolPanel>
      ) : null}

      {recording && !isMp4 ? <EngineNotice /> : null}

      <JobStatus job={job} label="Converting to MP4" />
      <JobError job={job} onRetry={convert} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="video"
          onReset={() => {
            job.reset()
            setRecording(null)
            setPhase('idle')
          }}
          downloadLabel="Download MP4"
          resetLabel="Record again"
        />
      ) : null}
    </div>
  )
}
