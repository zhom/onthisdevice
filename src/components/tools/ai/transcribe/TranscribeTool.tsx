/**
 * Speech to text: Whisper on this device turns a recording (a file or the microphone) into
 * text with times, in the spoken language or in English. Exports TXT, SRT and VTT.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { decodeSound, speechAudio } from '@/components/tools/redact/audio/decode'
import { isAbort } from '@/lib/ml/runtime/rpc'
import { LANGUAGES } from '@/lib/ml/speech/model'
import type { Word } from '@/lib/ml/speech/types'
import { clock, toCues, toSrt, toText, toVtt } from '@/lib/ml/transcribe/captions'
import { transcriber } from '@/lib/ml/transcribe/client'
import { SPEECH_MODELS, SPEED, allFiles, transcribeDownloadBytes } from '@/lib/ml/transcribe/models'
import type { SpeechModel } from '@/lib/ml/transcribe/models'
import { stripExtension } from '@/lib/utils'
import { Choice } from '../common/controls'
import { textBlob } from '../common/files'
import { DownloadNote, DownloadProgress, mb, useCached } from '../common/model'
import type { Download } from '../common/model'
import { startRecording } from '../common/recorder'
import type { Recording } from '../common/recorder'
import { PRESETS } from './presets'
import type { TranscribeSlug } from './presets'

interface Source {
  file: File
  url: string
  duration: number
  video: boolean
  audio: Float32Array
}

type Phase = { kind: 'idle' } | { kind: 'reading' } | { kind: 'download'; d: Download } | { kind: 'run'; done: number; total: number } | { kind: 'done' }

const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' })
const MODEL_OPTIONS = (Object.keys(SPEECH_MODELS) as SpeechModel[]).map((m) => ({ value: m, label: `${SPEECH_MODELS[m].label} (${mb(transcribeDownloadBytes(m))})` }))

export default function TranscribeTool({ slug }: { slug: TranscribeSlug }) {
  const preset = PRESETS[slug]
  const [model, setModel] = useState<SpeechModel>(preset.translate ? 'accurate' : 'fast')
  const files = useMemo(() => allFiles(model), [model])
  const [cached, markCached] = useCached(files)
  const [language, setLanguage] = useState(preset.translate ? 'auto' : 'en')
  const [source, setSource] = useState<Source | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [words, setWords] = useState<Word[]>([])
  const [stamps, setStamps] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recording, setRecording] = useState<Recording | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const mediaRef = useRef<HTMLMediaElement | null>(null)

  useEffect(() => {
    if (!recording) return
    const t = window.setInterval(() => setElapsed((Date.now() - recording.started) / 1000), 250)
    return () => window.clearInterval(t)
  }, [recording])

  useEffect(() => () => (source ? URL.revokeObjectURL(source.url) : undefined), [source])

  async function onFiles(list: File[]) {
    const file = list[0]
    if (!file) return
    abortRef.current?.abort()
    setError(null)
    setWords([])
    setPhase({ kind: 'reading' })
    try {
      const sound = await decodeSound(file)
      const audio = await speechAudio(sound.buffer)
      setSource({ file, url: URL.createObjectURL(file), duration: sound.buffer.duration, video: sound.hasVideo, audio })
      setPhase({ kind: 'idle' })
    } catch (err) {
      setPhase({ kind: 'idle' })
      setError(err instanceof Error ? err.message : 'This file could not be read. Try MP3, WAV, M4A or MP4.')
    }
  }

  async function record() {
    setError(null)
    try {
      setElapsed(0)
      setRecording(await startRecording())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The microphone could not start.')
    }
  }

  async function stopRecording() {
    if (!recording) return
    const file = await recording.stop()
    setRecording(null)
    await onFiles([file])
  }

  async function run() {
    if (!source) return
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort
    setError(null)
    setWords([])
    setHeard(null)
    try {
      setPhase({ kind: 'download', d: { loaded: 0, total: transcribeDownloadBytes(model) } })
      await transcriber.call('load', { model }, { signal: abort.signal, onProgress: (loaded, total) => setPhase({ kind: 'download', d: { loaded, total } }) })
      markCached()
      setPhase({ kind: 'run', done: 0, total: source.duration })
      // The worker takes the samples; keep a copy for another run.
      const audio = source.audio.slice()
      const all = await transcriber.call(
        'transcribe',
        { model, audio, language: language === 'auto' ? '' : language, translate: preset.translate },
        {
          signal: abort.signal,
          transfer: [audio.buffer],
          onEvent: (piece) => {
            setHeard(piece.language)
            setWords((prev) => [...prev, ...piece.words])
            setPhase({ kind: 'run', done: piece.done, total: piece.total })
          },
        },
      )
      setWords(all)
      setPhase({ kind: 'done' })
    } catch (err) {
      if (isAbort(err)) return
      setPhase({ kind: 'idle' })
      setError(err instanceof Error ? err.message : 'The transcription stopped.')
    }
  }

  function stop() {
    abortRef.current?.abort()
    transcriber.terminate()
    setPhase({ kind: words.length ? 'done' : 'idle' })
  }

  function reset() {
    stop()
    setSource(null)
    setWords([])
    setPhase({ kind: 'idle' })
    setError(null)
  }

  const cues = useMemo(() => toCues(words), [words])
  const text = useMemo(() => toText(words, { timestamps: stamps }), [words, stamps])
  const base = source ? stripExtension(source.file.name) : 'transcript'
  const outputs = {
    txt: { blob: textBlob(text), name: `${base}.txt`, label: 'TXT' },
    srt: { blob: textBlob(toSrt(cues), 'application/x-subrip'), name: `${base}.srt`, label: 'SRT' },
    vtt: { blob: textBlob(toVtt(cues), 'text/vtt'), name: `${base}.vtt`, label: 'VTT' },
  }
  const order = preset.output === 'srt' ? (['srt', 'vtt', 'txt'] as const) : (['txt', 'srt', 'vtt'] as const)
  const busy = phase.kind === 'download' || phase.kind === 'run' || phase.kind === 'reading'
  const minutes = source ? Math.max(1, Math.round(source.duration / SPEED[model] / 60)) : 0

  const recorder = (
    <div className="flex flex-col items-start gap-2">
      {recording ? (
        <div className="flex items-center gap-3">
          <Button size="lg" onClick={() => void stopRecording()}>
            <Square aria-hidden="true" /> Stop recording
          </Button>
          <span className="num text-sm" role="status" aria-live="polite">
            Recording {clock(elapsed)}
          </span>
        </div>
      ) : (
        <Button size={preset.record ? 'lg' : 'default'} variant={preset.record ? 'default' : 'secondary'} onClick={() => void record()}>
          <Mic aria-hidden="true" /> Record with the microphone
        </Button>
      )}
    </div>
  )

  if (!source) {
    return (
      <div className="space-y-4">
        {preset.record && recorder}
        <FileDropzone accept={preset.accept} onFiles={(f) => void onFiles(f)} maxSizeMb={2000} title={preset.title} hint={preset.hint} disabled={phase.kind === 'reading' || recording !== null} />
        {!preset.record && recorder}
        {phase.kind === 'reading' && <ProgressPanel label="Reading the sound" />}
        <DownloadNote bytes={transcribeDownloadBytes(model)} cached={cached} what="the speech model" />
        {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ToolPanel title={source.file.name} description={`${clock(source.duration)}${source.video ? ', video' : ''}`}>
        {source.video ? (
          <video ref={(el) => void (mediaRef.current = el)} src={source.url} controls playsInline className="max-h-[45vh] w-full rounded-lg bg-background" aria-label="Your video" />
        ) : (
          <audio ref={(el) => void (mediaRef.current = el)} src={source.url} controls className="w-full" aria-label="Your recording" />
        )}
        {!busy && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${slug}-language`}>Spoken language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id={`${slug}-language`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Detect</SelectItem>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Choice label="Model" value={model} options={MODEL_OPTIONS} onChange={setModel} />
          </div>
        )}
        {!busy && (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => void run()}>
              {preset.translate ? 'Translate to English' : phase.kind === 'done' ? 'Transcribe again' : 'Transcribe'}
            </Button>
            <Button variant="ghost" onClick={reset}>
              <RotateCcw aria-hidden="true" /> Other file
            </Button>
            <span className="text-sm text-muted-foreground">About {minutes} min on a laptop processor.</span>
          </div>
        )}
        {!busy && <DownloadNote bytes={transcribeDownloadBytes(model)} cached={cached} what="the speech model" />}
        {phase.kind === 'download' && <DownloadProgress download={phase.d} what="the speech model" />}
        {phase.kind === 'run' && (
          <ProgressPanel label={`${preset.translate ? 'Translating' : 'Transcribing'}: ${clock(phase.done)} of ${clock(phase.total)}`} value={(phase.done / Math.max(0.001, phase.total)) * 100} />
        )}
        {busy && phase.kind !== 'reading' && (
          <Button variant="secondary" onClick={stop}>
            <Square aria-hidden="true" /> Stop
          </Button>
        )}
      </ToolPanel>

      {(words.length > 0 || phase.kind === 'done') && (
        <ToolPanel
          title={phase.kind === 'done' ? `${words.length ? words.length.toLocaleString() : 'No'} words` : 'Transcript so far'}
          description={
            phase.kind === 'done' && !words.length
              ? 'No speech was found in this file.'
              : `${heard && language === 'auto' ? `Spoken language: ${LANGUAGE_NAMES.of(heard) ?? heard}. ` : ''}Press a time to play from there.`
          }
          footer={
            words.length > 0 && (
              <>
                {order.map((k, i) => (
                  <DownloadButton key={k} blob={outputs[k].blob} filename={outputs[k].name} label={`Download ${outputs[k].label}`} variant={i === 0 ? 'default' : 'secondary'} />
                ))}
                <CopyButton value={text} label="Copy text" />
              </>
            )
          }
        >
          {words.length > 0 && (
            <div className="flex items-center gap-2.5">
              <Checkbox id={`${slug}-stamps`} checked={stamps} onCheckedChange={(v) => setStamps(v === true)} />
              <Label htmlFor={`${slug}-stamps`} className="font-normal">
                Times in the text file
              </Label>
            </div>
          )}
          <ol className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1" aria-label="Transcript">
            {cues.map((c, i) => (
              <li key={`${c.start}-${i}`} className="flex gap-3 text-[0.9375rem] leading-relaxed">
                <button
                  type="button"
                  className="num shrink-0 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  onClick={() => {
                    const m = mediaRef.current
                    if (!m) return
                    m.currentTime = c.start
                    void m.play()
                  }}
                  aria-label={`Play from ${clock(c.start)}`}
                >
                  {clock(c.start)}
                </button>
                <span>{c.text}</span>
              </li>
            ))}
          </ol>
        </ToolPanel>
      )}
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
    </div>
  )
}
