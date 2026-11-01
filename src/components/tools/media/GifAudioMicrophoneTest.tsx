import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, CircleAlert, Mic, MicOff, Play, RefreshCw } from 'lucide-react'

import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

import { SelectField } from './_shared'
import { Note } from './_gif-audio-core'
import {
  AudioVisualiser,
  describeCaptureError,
  extensionForMime,
  pickAudioMimeType,
  useCaptureSupport,
  useClientValue,
  useDeviceList,
} from './_gif-audio-capture'
import type { LevelSample } from './_gif-audio-capture'

type Verdict = 'waiting' | 'silent' | 'quiet' | 'good' | 'loud'

const LOOP_SECONDS = 5

interface TrackFacts {
  label: string
  sampleRate: number | null
  channels: number | null
  echoCancellation: boolean | null
  noiseSuppression: boolean | null
  autoGainControl: boolean | null
}

const VERDICTS: Record<Verdict, { title: string; detail: string; tone: 'ok' | 'warn' | 'bad' }> = {
  waiting: {
    title: 'Listening…',
    detail: 'Say something at your normal speaking volume. The meter should jump as you talk.',
    tone: 'warn',
  },
  silent: {
    title: 'No sound is reaching the browser',
    detail:
      'The microphone is open, but every sample is silent. The cause is almost always a hardware mute, the wrong input device or an operating-system privacy setting.',
    tone: 'bad',
  },
  quiet: {
    title: 'Your microphone works, but it is quiet',
    detail:
      'We can hear you, though the level is low. Move closer, raise the input gain in your system sound settings, or pick a different device below.',
    tone: 'warn',
  },
  good: {
    title: 'Your microphone is working',
    detail:
      'Levels are in a good range. If an app still cannot hear you, check the device selection in that app.',
    tone: 'ok',
  },
  loud: {
    title: 'Your microphone is working, but it is clipping',
    detail:
      'The signal is hitting the ceiling, which distorts speech. Turn the input gain down or move back from the mic.',
    tone: 'warn',
  },
}

export default function GifAudioMicrophoneTest() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState('default')
  const [facts, setFacts] = useState<TrackFacts | null>(null)
  const [peakSeen, setPeakSeen] = useState(0)
  const [sustained, setSustained] = useState(0)
  const [clipped, setClipped] = useState(false)
  const [listeningSince, setListeningSince] = useState(0)
  const [loopState, setLoopState] = useState<'idle' | 'recording' | 'playing'>('idle')
  const [loopCountdown, setLoopCountdown] = useState(LOOP_SECONDS)
  const [playbackUrl, setPlaybackUrl] = useState('')

  const devices = useDeviceList('audioinput')
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const countdownRef = useRef<number | null>(null)
  const urlRef = useRef('')

  const supported = useCaptureSupport()
  const recordMime = useClientValue(pickAudioMimeType, 'audio/webm')

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (countdownRef.current !== null) window.clearInterval(countdownRef.current)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  const startListening = useCallback(async (idOverride?: string) => {
    const wanted = idOverride ?? deviceId
    setError(null)
    setPeakSeen(0)
    setSustained(0)
    setClipped(false)
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(wanted !== 'default' ? { deviceId: { exact: wanted } } : {}),
          // Off by default: a test should show what the microphone actually
          // sends, not what Chrome's noise gate leaves behind.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = next
      setStream(next)
      setListeningSince(performance.now())
      void devices.refresh()

      const track = next.getAudioTracks()[0]
      const settings = track?.getSettings() ?? {}
      setFacts({
        label: track?.label || 'Microphone',
        sampleRate: typeof settings.sampleRate === 'number' ? settings.sampleRate : null,
        channels: typeof settings.channelCount === 'number' ? settings.channelCount : null,
        echoCancellation:
          typeof settings.echoCancellation === 'boolean' ? settings.echoCancellation : null,
        noiseSuppression:
          typeof settings.noiseSuppression === 'boolean' ? settings.noiseSuppression : null,
        autoGainControl:
          typeof settings.autoGainControl === 'boolean' ? settings.autoGainControl : null,
      })
    } catch (err) {
      setError(describeCaptureError(err, 'microphone'))
      setStream(null)
    }
  }, [deviceId, devices])

  const stopListening = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStream(null)
    setFacts(null)
    setLoopState('idle')
  }

  const onLevel = useCallback((sample: LevelSample) => {
    setPeakSeen((current) => (sample.peak > current ? sample.peak : current))
    if (sample.rms > 0.012) setSustained((current) => current + 1)
    if (sample.peak > 0.985) setClipped(true)
  }, [])

  const verdict: Verdict = useMemo(() => {
    if (!stream) return 'waiting'
    const elapsed = (performance.now() - listeningSince) / 1000
    if (clipped) return 'loud'
    if (sustained >= 4 && peakSeen > 0.08) return 'good'
    if (sustained >= 2 || peakSeen > 0.02) return 'quiet'
    if (elapsed > 6) return 'silent'
    return 'waiting'
  }, [clipped, listeningSince, peakSeen, stream, sustained])

  const deviceOptions = useMemo(() => {
    const list = devices.devices.map((device, index) => ({
      value: device.deviceId || `device-${index}`,
      label: device.label || `Microphone ${index + 1}`,
    }))
    return [{ value: 'default', label: 'System default microphone' }, ...list]
  }, [devices.devices])

  const runLoop = () => {
    const active = streamRef.current
    if (!active) return
    const mime = pickAudioMimeType()
    if (!mime) {
      setError('This browser cannot record audio, so the play-back loop is unavailable.')
      return
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = ''
      setPlaybackUrl('')
    }

    const chunks: Blob[] = []
    const recorder = new MediaRecorder(active, { mimeType: mime })
    recorderRef.current = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime })
      const url = URL.createObjectURL(blob)
      urlRef.current = url
      setPlaybackUrl(url)
      setLoopState('playing')
      window.setTimeout(() => {
        void audioRef.current?.play()
      }, 60)
    }

    recorder.start()
    setLoopState('recording')
    setLoopCountdown(LOOP_SECONDS)
    if (countdownRef.current !== null) window.clearInterval(countdownRef.current)
    countdownRef.current = window.setInterval(() => {
      setLoopCountdown((value) => {
        if (value <= 1) {
          if (countdownRef.current !== null) window.clearInterval(countdownRef.current)
          countdownRef.current = null
          if (recorder.state !== 'inactive') recorder.stop()
          return 0
        }
        return value - 1
      })
    }, 1000)
  }

  if (!supported) {
    return (
      <ErrorNote
        title="Microphone testing is not available here"
        message="This browser does not expose getUserMedia, so no page can open your microphone. Use a current Chrome, Edge, Firefox or Safari over HTTPS."
      />
    )
  }

  const current = VERDICTS[verdict]
  const extension = extensionForMime(recordMime)

  return (
    <div className="space-y-4">
      <ToolPanel
        title="Microphone test"
        description="Your browser opens the microphone, and this page analyses the audio. The audio stays in the tab."
      >
        {!stream ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-8 text-center">
              <Mic className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm text-muted-foreground">
                Press the button and allow microphone access. Echo cancellation, noise suppression
                and automatic gain are all switched off so you see the raw signal.
              </p>
              <Button type="button" className="mt-4" onClick={() => void startListening()}>
                <Mic className="size-4" aria-hidden="true" />
                Test my microphone
              </Button>
            </div>
            {error ? <ErrorNote message={error} onRetry={() => void startListening()} /> : null}
          </div>
        ) : (
          <div className="space-y-4">
            <AudioVisualiser stream={stream} onLevel={onLevel} />

            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 rounded-lg bg-muted p-3"
            >
              {current.tone === 'ok' ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
              ) : current.tone === 'bad' ? (
                <MicOff className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
              ) : (
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">{current.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{current.detail}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ResultStat
                label="Loudest peak so far"
                value={`${Math.round(peakSeen * 100)}%`}
                hint={peakSeen > 0.985 ? 'Clipping: turn the gain down' : 'Aim for 40–80% on speech'}
              />
              <ResultStat
                label="Sample rate"
                value={facts?.sampleRate ? `${(facts.sampleRate / 1000).toFixed(1)} kHz` : 'Unknown'}
                hint={facts?.channels ? `${facts.channels === 1 ? 'Mono' : `${facts.channels} channels`}` : undefined}
              />
              <ResultStat
                label="Device"
                value={facts?.label && facts.label.length > 0 ? facts.label : 'Default input'}
                hint="Reported by your operating system"
              />
            </div>

            <div className="space-y-3 rounded-lg bg-muted p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Record {LOOP_SECONDS} seconds and play it back
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This tests the whole chain: capture, encoding and playback through your
                    speakers.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={runLoop}
                  disabled={loopState === 'recording'}
                >
                  <Play className="size-4" aria-hidden="true" />
                  {loopState === 'recording'
                    ? `Recording… ${loopCountdown}s`
                    : loopState === 'playing'
                      ? 'Record again'
                      : 'Start the loop'}
                </Button>
              </div>
              {loopState === 'recording' ? (
                <Progress
                  value={((LOOP_SECONDS - loopCountdown) / LOOP_SECONDS) * 100}
                  className="h-2"
                />
              ) : null}
              {playbackUrl ? (
                <div className="space-y-2">
                  <audio
                    ref={audioRef}
                    src={playbackUrl}
                    controls
                    className="w-full"
                    aria-label="Your five-second test recording"
                  />
                  <p className="text-xs text-muted-foreground">
                    Recorded as {extension.toUpperCase()} in this tab’s memory. Reloading the page
                    deletes it.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void startListening()}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Restart the test
              </Button>
              <Button type="button" variant="ghost" onClick={stopListening}>
                <MicOff className="size-4" aria-hidden="true" />
                Stop and release the microphone
              </Button>
            </div>
          </div>
        )}

        <SelectField
          label="Which microphone"
          value={deviceId}
          onChange={(value) => {
            setDeviceId(value)
            if (streamRef.current) void startListening(value)
          }}
          options={deviceOptions}
          hint={
            devices.hasLabels
              ? 'Switching device restarts the test immediately.'
              : 'Your browser hides device names until microphone access has been allowed once.'
          }
        />
      </ToolPanel>

      <Note>
        The green light next to your webcam stays off during this test, because only the
        microphone is open. When you finish, press “Stop and release the microphone” or close the
        tab. Both release the stream.
      </Note>
    </div>
  )
}
