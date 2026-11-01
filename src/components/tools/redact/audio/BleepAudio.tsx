/**
 * Audio bleeper: transcribe a recording with word times on this device, mark
 * names, numbers and places with the text rules and the language model, let
 * the user switch any word, then export WAV, MP3, or the video with its new
 * sound.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Film, RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatTimecode } from '@/components/tools/media/_ffmpeg'
import { FFMPEG_CORE_BYTES } from '@/lib/ffmpeg-core'
import { downloadBlob, formatBytes, stripExtension } from '@/lib/utils'
import { wireBytes } from '@/lib/ml/assets'
import { ORT_FILES } from '@/lib/ml/ort'
import { speechClient } from '@/lib/ml/speech/client'
import { LANGUAGES, speechDownloadBytes, speechIsCached } from '@/lib/ml/speech/model'
import type { Word } from '@/lib/ml/speech/types'
import { nerClient, nerDownloadBytes, nerIsCached } from '@/lib/ml/text/ner-client'
import type { Span } from '@/lib/ml/text/types'
import { Segmented } from '../shared/LookControls'
import { cutSeconds, cutsFor } from './bleep'
import type { BleepKind, BleepSound } from './bleep'
import { decodeSound, speechAudio } from './decode'
import type { Sound } from './decode'
import { bleepedMp3, bleepedVideo, bleepedWav } from './export'
import { CATEGORIES, findMarks, listTerms, transcriptOf } from './marks'
import type { Category } from './marks'
import { BleepPreview } from './preview'
import { Transcript } from './Transcript'

const ACCEPT = '.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.webm,.mp4,.m4v,.mov,.mkv,audio/*,video/*'
const LEVEL = 0.3
const SOUNDS: { value: BleepKind; label: string }[] = [
  { value: 'tone', label: 'Tone' },
  { value: 'silence', label: 'Silence' },
  { value: 'noise', label: 'Noise' },
]
const REASON: Record<Category, string> = {
  names: 'name',
  numbers: 'number',
  places: 'place or address',
  contact: 'email or link',
  dates: 'date',
  orgs: 'organization',
  list: 'on your list',
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'download'; what: string; loaded: number; total: number }
  | { kind: 'transcribe'; done: number; total: number }
  | { kind: 'finding'; done: number; total: number }
  | { kind: 'done' }

interface Job {
  label: string
  value?: number
}

function mb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1e6))} MB`
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/** All model bytes of a first run: speech, name finder and the shared runtime once. */
function firstRunBytes(): number {
  return speechDownloadBytes() + nerDownloadBytes() - wireBytes(ORT_FILES)
}

export default function BleepAudio() {
  const [file, setFile] = useState<File | null>(null)
  const [sound, setSound] = useState<Sound | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [language, setLanguage] = useState('en')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [words, setWords] = useState<Word[]>([])
  const [modelSpans, setModelSpans] = useState<Span[]>([])
  const [overrides, setOverrides] = useState<Map<number, boolean>>(new Map())
  const [categories, setCategories] = useState<Set<Category>>(() => new Set(CATEGORIES.filter((c) => c.defaultOn).map((c) => c.id)))
  const [listText, setListText] = useState('')
  const [kind, setKind] = useState<BleepKind>('tone')
  const [padMs, setPadMs] = useState(150)
  const [job, setJob] = useState<Job | null>(null)
  const [cached, setCached] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [playing, setPlaying] = useState(-1)

  const mediaRef = useRef<HTMLMediaElement | null>(null)
  const previewRef = useRef<BleepPreview | null>(null)
  const runRef = useRef(0)

  useEffect(() => {
    void Promise.all([speechIsCached(), nerIsCached()]).then(([a, b]) => setCached(a && b))
  }, [])

  useEffect(
    () => () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    },
    [mediaUrl],
  )

  /* Marks: rules + model spans + numbers + the user's list, then the user's switches on top. */
  const list = useMemo(() => listTerms(listText), [listText])
  const found = useMemo(() => findMarks(words, modelSpans, list), [words, modelSpans, list])
  const marked = useMemo(() => {
    const out = new Set<number>()
    for (let i = 0; i < words.length; i++) {
      const cat = found.get(i)
      const auto = cat !== undefined && (cat === 'list' || categories.has(cat))
      if (overrides.get(i) ?? auto) out.add(i)
    }
    return out
  }, [words, found, categories, overrides])
  const reasons = useMemo(() => {
    const out = new Map<number, string>()
    for (const [i, cat] of found) out.set(i, REASON[cat])
    return out
  }, [found])

  const bleep: BleepSound = useMemo(() => ({ kind, level: LEVEL }), [kind])
  const cuts = useMemo(() => cutsFor(words, marked, padMs / 1000, sound?.buffer.duration), [words, marked, padMs, sound])

  /* Live preview follows the cuts. */
  const latest = useRef({ cuts, bleep })
  latest.current = { cuts, bleep }
  const attachMedia = useCallback((el: HTMLMediaElement | null) => {
    previewRef.current?.dispose()
    previewRef.current = null
    mediaRef.current = el
    if (!el) return
    previewRef.current = new BleepPreview(el)
    previewRef.current.set(latest.current.cuts, latest.current.bleep)
  }, [])
  useEffect(() => {
    previewRef.current?.set(cuts, bleep)
  }, [cuts, bleep])
  useEffect(() => {
    const el = mediaRef.current
    if (!el) return
    const onTime = () => {
      const t = el.currentTime
      setPlaying(words.findIndex((w) => t >= w.start && t < w.end))
    }
    el.addEventListener('timeupdate', onTime)
    return () => el.removeEventListener('timeupdate', onTime)
  }, [words, mediaUrl])

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0]
    if (!f) return
    const run = ++runRef.current
    speechClient().cancel()
    setError(null)
    setStatus('')
    setWords([])
    setModelSpans([])
    setOverrides(new Map())
    setSound(null)
    setFile(f)
    setMediaUrl(URL.createObjectURL(f))
    setPhase({ kind: 'reading' })
    try {
      const decoded = await decodeSound(f)
      if (run !== runRef.current) return
      setSound(decoded)
      setPhase({ kind: 'idle' })
    } catch (err) {
      if (run !== runRef.current) return
      setPhase({ kind: 'idle' })
      setFile(null)
      setMediaUrl(null)
      setError(errorText(err, 'This file could not be read. Try MP3, WAV, M4A or MP4.'))
    }
  }, [])

  async function transcribe() {
    if (!sound) return
    const run = ++runRef.current
    setError(null)
    setStatus('')
    setWords([])
    setModelSpans([])
    setOverrides(new Map())
    const speech = speechClient()
    const ner = nerClient()
    try {
      setPhase({ kind: 'download', what: 'the speech model', loaded: 0, total: speechDownloadBytes() })
      await speech.load((loaded, total) => run === runRef.current && setPhase({ kind: 'download', what: 'the speech model', loaded, total }))
      setPhase({ kind: 'download', what: 'the name finder', loaded: 0, total: nerDownloadBytes() })
      await ner.load((loaded, total) => run === runRef.current && setPhase({ kind: 'download', what: 'the name finder', loaded, total }))
      setCached(true)
      const audio = await speechAudio(sound.buffer)
      const total = audio.length / 16000
      setPhase({ kind: 'transcribe', done: 0, total })
      const all = await speech.transcribe(audio, language, (chunk, done) => {
        if (run !== runRef.current) return
        setWords((prev) => [...prev, ...chunk])
        setPhase({ kind: 'transcribe', done, total })
      })
      if (run !== runRef.current) return
      setWords(all)
      if (all.length === 0) {
        setPhase({ kind: 'done' })
        setStatus('No speech was found in this file.')
        return
      }
      setPhase({ kind: 'finding', done: 0, total: 1 })
      const spans = await ner.run(transcriptOf(all).text, (done, t) => run === runRef.current && setPhase({ kind: 'finding', done, total: t }))
      if (run !== runRef.current) return
      setModelSpans(spans)
      setPhase({ kind: 'done' })
    } catch (err) {
      if (run !== runRef.current || isAbort(err)) return
      setPhase({ kind: 'idle' })
      setError(errorText(err, 'The transcription stopped. Try again.'))
    }
  }

  function stop() {
    runRef.current++
    speechClient().cancel()
    setWords([])
    setPhase({ kind: 'idle' })
  }

  function reset() {
    stop()
    attachMedia(null)
    setFile(null)
    setSound(null)
    setMediaUrl(null)
    setError(null)
    setStatus('')
  }

  function toggle(i: number) {
    setOverrides((prev) => {
      const next = new Map(prev)
      next.set(i, !marked.has(i))
      return next
    })
  }

  function toggleCategory(id: Category, on: boolean) {
    setCategories((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
    // A category switch applies to its words again, also those switched by hand.
    setOverrides((prev) => new Map([...prev].filter(([i]) => found.get(i) !== id)))
  }

  const base = file ? stripExtension(file.name) : 'audio'

  async function saveWav() {
    if (!sound) return
    setJob({ label: 'Writing the WAV file' })
    setError(null)
    try {
      const blob = bleepedWav(sound.buffer, cuts, bleep)
      downloadBlob(blob, `${base}-bleeped.wav`)
      setStatus(`Saved ${base}-bleeped.wav (${formatBytes(blob.size)}).`)
    } catch (err) {
      setError(errorText(err, 'The WAV file could not be written.'))
    } finally {
      setJob(null)
    }
  }

  async function saveMp3() {
    if (!sound) return
    setError(null)
    setJob({ label: 'Encoding MP3', value: 0 })
    try {
      const wav = bleepedWav(sound.buffer, cuts, bleep)
      const blob = await bleepedMp3(wav, sound.buffer.duration, (pct) => setJob({ label: 'Encoding MP3', value: pct }))
      downloadBlob(blob, `${base}-bleeped.mp3`)
      setStatus(`Saved ${base}-bleeped.mp3 (${formatBytes(blob.size)}).`)
    } catch (err) {
      setError(errorText(err, 'The MP3 file could not be written.'))
    } finally {
      setJob(null)
    }
  }

  async function saveVideo() {
    if (!file) return
    setError(null)
    setJob({ label: 'Writing the video', value: 0 })
    try {
      const out = await bleepedVideo(file, cuts, bleep, (f) => setJob({ label: 'Writing the video', value: f * 100 }))
      const name = `${base}-bleeped.${out.extension}`
      downloadBlob(out.blob, name)
      setStatus(`Saved ${name} (${formatBytes(out.blob.size)}). The picture is copied as it was.`)
    } catch (err) {
      setError(errorText(err, 'The video could not be written. Download the WAV instead.'))
    } finally {
      setJob(null)
    }
  }

  const busy = phase.kind === 'download' || phase.kind === 'transcribe' || phase.kind === 'finding' || phase.kind === 'reading'
  const bleepedWords = marked.size
  const bleepedSeconds = cutSeconds(cuts)

  return (
    <div className="space-y-6">
      {!file && (
        <div className="space-y-3">
          <FileDropzone
            accept={ACCEPT}
            onFiles={(f) => void onFiles(f)}
            maxSizeMb={1000}
            title="Drop an audio or video file"
            hint="MP3, WAV, M4A, OGG, FLAC, MP4, MOV or WebM. It stays on your device."
          />
          {!cached && (
            <p className="text-sm text-muted-foreground">
              The first run downloads the speech model and the name finder ({mb(firstRunBytes())}) once. After that they work offline.
            </p>
          )}
        </div>
      )}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {file && (
        <ToolPanel
          title={file.name}
          description={
            sound
              ? `${formatTimecode(sound.buffer.duration)}, ${sound.buffer.numberOfChannels === 1 ? 'mono' : `${sound.buffer.numberOfChannels} channels`}, ${Math.round(sound.buffer.sampleRate / 100) / 10} kHz${sound.hasVideo ? ', with video' : ''}`
              : 'Reading the file'
          }
        >
          {mediaUrl && sound?.hasVideo && (
            <video ref={attachMedia} src={mediaUrl} controls playsInline className="max-h-[50vh] w-full rounded-lg bg-background" aria-label="Preview with bleeps" />
          )}
          {mediaUrl && sound && !sound.hasVideo && (
            <audio ref={attachMedia} src={mediaUrl} controls className="w-full" aria-label="Preview with bleeps" />
          )}

          {sound && phase.kind === 'idle' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2 sm:w-56">
                <Label htmlFor="bleep-language">Spoken language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="bleep-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="lg" onClick={() => void transcribe()}>
                Transcribe
              </Button>
              <Button variant="ghost" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Other file
              </Button>
            </div>
          )}
          {sound && phase.kind === 'idle' && !cached && (
            <p className="text-sm text-muted-foreground">Downloads {mb(firstRunBytes())} once. After that it works offline.</p>
          )}

          {phase.kind === 'reading' && <ProgressPanel label="Reading the sound" />}
          {phase.kind === 'download' && (
            <ProgressPanel
              label={`Downloading ${phase.what} (once): ${mb(phase.loaded)} of ${mb(phase.total)}`}
              value={phase.total > 0 ? (phase.loaded / phase.total) * 100 : undefined}
            />
          )}
          {phase.kind === 'transcribe' && (
            <ProgressPanel
              label={`Transcribing: ${formatTimecode(phase.done, 0)} of ${formatTimecode(phase.total, 0)}`}
              value={(phase.done / Math.max(0.001, phase.total)) * 100}
            />
          )}
          {phase.kind === 'finding' && (
            <ProgressPanel label="Finding names and places" value={(phase.done / Math.max(1, phase.total)) * 100} />
          )}
          {(phase.kind === 'download' || phase.kind === 'transcribe') && (
            <Button variant="secondary" onClick={stop}>
              <Square aria-hidden="true" /> Stop
            </Button>
          )}
        </ToolPanel>
      )}

      {words.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ToolPanel
            title={`${bleepedWords} ${bleepedWords === 1 ? 'word' : 'words'} bleeped, ${bleepedSeconds.toFixed(1)} s`}
            description="Press a word to bleep it or keep it. Play the file above to hear the result."
          >
            <Transcript words={words} marked={marked} reasons={reasons} playing={playing} onToggle={toggle} />
          </ToolPanel>

          <ToolPanel
            title="Options"
            footer={
              <div className="flex w-full flex-col gap-2">
                {sound?.hasVideo && (
                  <Button size="lg" className="w-full" onClick={() => void saveVideo()} disabled={busy || job !== null}>
                    <Film aria-hidden="true" /> Download video
                  </Button>
                )}
                <Button size="lg" variant={sound?.hasVideo ? 'secondary' : 'default'} className="w-full" onClick={() => void saveWav()} disabled={busy || job !== null}>
                  <Download aria-hidden="true" /> Download WAV
                </Button>
                <Button size="lg" variant="secondary" className="w-full" onClick={() => void saveMp3()} disabled={busy || job !== null}>
                  <Download aria-hidden="true" /> Download MP3
                </Button>
                <p className="text-[0.8125rem] text-muted-foreground">MP3 uses the audio engine ({mb(FFMPEG_CORE_BYTES)} once).</p>
              </div>
            }
          >
            <fieldset className="space-y-2.5">
              <legend className="mb-2 text-sm font-[600]">Bleep</legend>
              {CATEGORIES.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5">
                  <Checkbox id={`bleep-cat-${c.id}`} checked={categories.has(c.id)} onCheckedChange={(v) => toggleCategory(c.id, v === true)} />
                  <Label htmlFor={`bleep-cat-${c.id}`} className="font-normal">
                    {c.name}
                  </Label>
                </div>
              ))}
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="bleep-list">Always bleep</Label>
              <Input id="bleep-list" value={listText} onChange={(e) => setListText(e.target.value)} placeholder="Words, separated by commas" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label id="bleep-sound">Sound</Label>
              <Segmented labelId="bleep-sound" value={kind} options={SOUNDS} onChange={setKind} />
            </div>
            <div className="space-y-2">
              <Label id="bleep-pad">Extra time around each word: {padMs} ms</Label>
              <Slider aria-labelledby="bleep-pad" min={0} max={400} step={10} value={[padMs]} onValueChange={(v) => setPadMs(v[0] ?? padMs)} />
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw aria-hidden="true" /> Start over
            </Button>
          </ToolPanel>
        </div>
      )}

      {job && <ProgressPanel label={job.label} value={job.value} />}

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>
    </div>
  )
}
