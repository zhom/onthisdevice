import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Mic, Pause, Play, RotateCcw, Square } from 'lucide-react'

import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/utils'

import { getEngine } from './_ffmpeg'
import { AdvancedOptions, MediaPreview, SelectField, SwitchField } from './_shared'
import {
  EngineNotice,
  Note,
  TaskStatus,
  cleanupFs,
  execFFmpeg,
  fileBytes,
  readOutput,
  useTask,
} from './_gif-audio-core'
import {
  AudioVisualiser,
  clock,
  describeCaptureError,
  extensionForMime,
  pickAudioMimeType,
  useCaptureSupport,
  useClientValue,
  useDeviceList,
} from './_gif-audio-capture'

type Phase = 'idle' | 'ready' | 'recording' | 'paused' | 'stopped'

interface Recording {
  blob: Blob
  mime: string
}

const EXPORTS = [
  { value: 'original', label: 'Original recording: no re-encoding, no wait' },
  { value: 'mp3', label: 'MP3 192 kbps: plays on almost every device' },
  { value: 'wav', label: 'WAV 16-bit: for editing in a DAW' },
]

export default function GifAudioVoiceRecorder() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [deviceId, setDeviceId] = useState('default')
  const [seconds, setSeconds] = useState(0)
  const [bytes, setBytes] = useState(0)
  const [recording, setRecording] = useState<Recording | null>(null)
  const [exportAs, setExportAs] = useState('original')
  const [echoCancellation, setEchoCancellation] = useState(true)
  const [noiseSuppression, setNoiseSuppression] = useState(true)
  const [autoGain, setAutoGain] = useState(true)

  const devices = useDeviceList('audioinput')
  const task = useTask<{ blob: Blob; filename: string }>()

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)

  const canCapture = useCaptureSupport()
  const hasRecorder = useClientValue(() => typeof MediaRecorder !== 'undefined', true)
  const supported = canCapture && hasRecorder

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const closeStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStream(null)
  }, [])

  useEffect(() => {
    return () => {
      stopTimer()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [stopTimer])

  const openMicrophone = useCallback(async (): Promise<MediaStream | null> => {
    setError(null)
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          ...(deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation,
          noiseSuppression,
          autoGainControl: autoGain,
        },
      }
      const next = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = next
      setStream(next)
      void devices.refresh()
      setPhase('ready')
      return next
    } catch (err) {
      setError(describeCaptureError(err, 'microphone'))
      setPhase('idle')
      return null
    }
  }, [autoGain, deviceId, devices, echoCancellation, noiseSuppression])

  const start = useCallback(async () => {
    const active = streamRef.current ?? (await openMicrophone())
    if (!active) return

    const mime = pickAudioMimeType()
    if (!mime) {
      setError(
        'This browser’s MediaRecorder cannot record audio in any format we can save. Try Chrome, Edge or Firefox.',
      )
      return
    }

    chunksRef.current = []
    setBytes(0)
    setSeconds(0)
    setRecording(null)
    task.reset()

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(active, { mimeType: mime })
    } catch {
      recorder = new MediaRecorder(active)
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return
      chunksRef.current.push(event.data)
      setBytes((current) => current + event.data.size)
    }
    recorder.onstop = () => {
      const type = recorder.mimeType || mime
      const blob = new Blob(chunksRef.current, { type })
      chunksRef.current = []
      setRecording({ blob, mime: type })
      setPhase('stopped')
      // Let the microphone go the moment the take is finished, so the browser's
      // recording indicator goes out instead of staying lit while you listen back.
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setStream(null)
    }
    recorder.onerror = () => {
      setError('The recorder stopped unexpectedly. Anything captured before the error is still below.')
    }

    recorderRef.current = recorder
    // A one-second timeslice keeps the running size honest and means a crash
    // never loses more than a second of audio.
    recorder.start(1000)
    setPhase('recording')
    stopTimer()
    timerRef.current = window.setInterval(() => {
      setSeconds((value) => value + 0.25)
    }, 250)
  }, [openMicrophone, stopTimer, task])

  const pause = () => {
    recorderRef.current?.pause()
    stopTimer()
    setPhase('paused')
  }

  const resume = () => {
    recorderRef.current?.resume()
    setPhase('recording')
    stopTimer()
    timerRef.current = window.setInterval(() => {
      setSeconds((value) => value + 0.25)
    }, 250)
  }

  const stop = () => {
    stopTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    recorderRef.current = null
  }

  const discard = () => {
    setRecording(null)
    setSeconds(0)
    setBytes(0)
    task.reset()
    setPhase(streamRef.current ? 'ready' : 'idle')
  }

  const deviceOptions = useMemo(() => {
    const list = devices.devices.map((device, index) => ({
      value: device.deviceId || `device-${index}`,
      label: device.label || `Microphone ${index + 1}`,
    }))
    return [{ value: 'default', label: 'System default microphone' }, ...list]
  }, [devices.devices])

  const convert = () => {
    if (!recording) return
    const target = exportAs
    if (target === 'original') return

    void task.run(async (ctx) => {
      const ffmpeg = await getEngine()
      const inputName = `recording.${extensionForMime(recording.mime)}`
      const output = `voice.${target}`
      try {
        ctx.setStatus(`Encoding ${target.toUpperCase()}…`)
        await ffmpeg.writeFile(inputName, await fileBytes(recording.blob))
        const args = ['-i', inputName, '-vn']
        if (target === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', '192k')
        else args.push('-c:a', 'pcm_s16le')
        args.push('-y', output)
        await execFFmpeg(ffmpeg, args, {
          totalSeconds: seconds,
          onProgress: (fraction) => ctx.setPercent(fraction * 100),
        })
        const blob = await readOutput(
          ffmpeg,
          output,
          target === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        )
        return { blob, filename: `voice-recording.${target}` }
      } finally {
        await cleanupFs(ffmpeg, [inputName, output])
      }
    })
  }

  if (!supported) {
    return (
      <ErrorNote
        title="Recording is not available in this browser"
        message="This tool needs getUserMedia and MediaRecorder, which this browser does not provide. A current version of Chrome, Edge, Firefox or Safari will work."
      />
    )
  }

  const originalExtension = recording ? extensionForMime(recording.mime) : 'webm'

  return (
    <div className="space-y-4">
      <ToolPanel
        title="Recorder"
        description="Your browser records the audio and keeps it in this tab’s memory. It is not sent anywhere. Closing the tab deletes it."
      >
        {phase === 'idle' ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-8 text-center">
              <Mic className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm text-muted-foreground">
                Your browser will ask for microphone permission. Nothing is captured until you press
                record, and the permission applies to this site only.
              </p>
              <Button type="button" className="mt-4" onClick={() => void start()}>
                <Circle className="size-4 fill-current" aria-hidden="true" />
                Start recording
              </Button>
            </div>
            {error ? <ErrorNote message={error} onRetry={() => void start()} /> : null}
          </div>
        ) : null}

        {phase !== 'idle' ? (
          <div className="space-y-4">
            <AudioVisualiser stream={stream} paused={phase === 'paused'} />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card p-3">
              <div className="flex items-center gap-3">
                <span
                  className={
                    phase === 'recording'
                      ? 'inline-flex size-3 animate-pulse rounded-full bg-destructive'
                      : 'inline-flex size-3 rounded-full bg-muted-foreground'
                  }
                  aria-hidden="true"
                />
                <span className="font-mono text-2xl tabular-nums text-foreground">
                  {clock(seconds)}
                </span>
                <span
                  className="text-sm text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  {phase === 'recording'
                    ? 'Recording'
                    : phase === 'paused'
                      ? 'Paused'
                      : phase === 'stopped'
                        ? 'Stopped'
                        : 'Ready'}
                </span>
              </div>
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatBytes(bytes)} captured
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {phase === 'ready' || phase === 'stopped' ? (
                <Button type="button" onClick={() => void start()}>
                  <Circle className="size-4 fill-current" aria-hidden="true" />
                  {phase === 'stopped' ? 'Record again' : 'Start recording'}
                </Button>
              ) : null}
              {phase === 'recording' ? (
                <>
                  <Button type="button" variant="outline" onClick={pause}>
                    <Pause className="size-4" aria-hidden="true" />
                    Pause
                  </Button>
                  <Button type="button" variant="destructive" onClick={stop}>
                    <Square className="size-4" aria-hidden="true" />
                    Stop
                  </Button>
                </>
              ) : null}
              {phase === 'paused' ? (
                <>
                  <Button type="button" onClick={resume}>
                    <Play className="size-4" aria-hidden="true" />
                    Resume
                  </Button>
                  <Button type="button" variant="destructive" onClick={stop}>
                    <Square className="size-4" aria-hidden="true" />
                    Stop
                  </Button>
                </>
              ) : null}
              {recording ? (
                <Button type="button" variant="ghost" onClick={discard}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Discard
                </Button>
              ) : null}
            </div>

            {error ? <ErrorNote message={error} /> : null}
          </div>
        ) : null}

        <AdvancedOptions label="Microphone settings">
          <SelectField
            label="Input device"
            value={deviceId}
            onChange={(value) => {
              setDeviceId(value)
              if (streamRef.current) {
                closeStream()
                setPhase('idle')
              }
            }}
            options={deviceOptions}
            hint={
              devices.hasLabels
                ? 'Changing the device closes the current stream. Press record to open it again.'
                : 'Device names appear after you allow microphone access once.'
            }
            disabled={phase === 'recording' || phase === 'paused'}
          />
          <SwitchField
            label="Echo cancellation"
            checked={echoCancellation}
            onChange={setEchoCancellation}
            hint="Removes sound coming back in from your speakers. Turn it off when recording music or an instrument."
            disabled={phase === 'recording' || phase === 'paused'}
          />
          <SwitchField
            label="Noise suppression"
            checked={noiseSuppression}
            onChange={setNoiseSuppression}
            hint="Cuts steady background noise like fans and air conditioning. It can dull quiet speech and thin out singing."
            disabled={phase === 'recording' || phase === 'paused'}
          />
          <SwitchField
            label="Automatic gain control"
            checked={autoGain}
            onChange={setAutoGain}
            hint="Keeps the volume level as you move nearer to and further from the mic. Off gives a more accurate, less processed recording."
            disabled={phase === 'recording' || phase === 'paused'}
          />
        </AdvancedOptions>
      </ToolPanel>

      {recording ? (
        <ToolPanel title="Your recording">
          <MediaPreview source={recording.blob} kind="audio" />
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Length" value={clock(seconds)} emphasis />
            <ResultStat
              label="Size"
              value={formatBytes(recording.blob.size)}
              hint={`${originalExtension.toUpperCase()} container`}
            />
            <ResultStat
              label="Rough bitrate"
              value={
                seconds > 0
                  ? `${Math.round((recording.blob.size * 8) / seconds / 1000)} kbps`
                  : '–'
              }
              hint="Chosen by your browser’s encoder"
            />
          </div>

          <SelectField
            label="Save as"
            value={exportAs}
            onChange={setExportAs}
            options={EXPORTS}
            hint="The original is already a finished file. MP3 and WAV run one extra local FFmpeg pass."
          />

          <div className="flex flex-wrap gap-2">
            {exportAs === 'original' ? (
              <DownloadButton
                blob={recording.blob}
                filename={`voice-recording.${originalExtension}`}
                label={`Download ${originalExtension.toUpperCase()}`}
              />
            ) : task.result ? (
              <DownloadButton
                blob={task.result.blob}
                filename={task.result.filename}
                label={`Download ${exportAs.toUpperCase()}`}
              />
            ) : (
              <Button type="button" onClick={convert} disabled={task.busy}>
                {task.busy ? 'Converting…' : `Convert to ${exportAs.toUpperCase()}`}
              </Button>
            )}
          </div>

          <TaskStatus task={task} label="Converting your recording" />
          {task.phase === 'error' && task.error ? (
            <ErrorNote message={task.error} onRetry={convert} />
          ) : null}

          {exportAs !== 'original' ? <EngineNotice /> : null}
        </ToolPanel>
      ) : null}

      <Note>
        There is no time limit. The limit is your device’s memory: about an hour of Opus audio
        uses 30 MB. For very long sessions, stop and start a new take from time to time.
      </Note>
    </div>
  )
}
