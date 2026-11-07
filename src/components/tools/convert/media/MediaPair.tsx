/**
 * Island for every audio and video pair page (wav-to-flac, mkv-to-webm, mov-to-gif …).
 * MP4, MOV, MKV and WebM output first try the browser's own media engine (fast, often
 * hardware accelerated); everything else, and anything that path cannot finish, runs on
 * the site's FFmpeg engine with streams copied where the target can hold them.
 */
import { useRef, useState } from 'react'
import { AudioLines, Clapperboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, stripExtension } from '@/lib/utils'
import { inputName, probeWithEngine } from '@/components/tools/media/_ffmpeg'
import {
  AdvancedOptions,
  EngineNotice,
  JobError,
  JobStatus,
  MediaPreview,
  NumberField,
  ResultPanel,
  SelectField,
  SourceSummary,
  SwitchField,
  useMediaJob,
  useSourceFile,
  type MediaJobResult,
} from '@/components/tools/media/_shared'
import type { MediaFmt } from '@/lib/convert/media/formats'
import { OUT_MIME, isAudioTarget, outputExt, planFfmpeg, type MediaSettings, type Quality } from '@/lib/convert/media/plan'
import { WEBCODECS_TARGETS, convertWithWebCodecs } from './webcodecs'

export interface MediaPairProps {
  from: MediaFmt
  to: MediaFmt
  fromLabel: string
  toLabel: string
  accept: string
  fromKind: 'audio' | 'video'
}

/** Containers the browser's media engine can read; others go straight to FFmpeg. */
const FAST_SOURCES = new Set<MediaFmt>(['mp4', 'mov', 'm4v', 'mkv', 'webm', '3gp', 'mts', 'm2ts', 'ts'])

const BITRATE_DEFAULT: Partial<Record<MediaFmt, number>> = { mp3: 192, ogg: 160, opus: 128, m4a: 192, aac: 192, wma: 192 }
const LOSSY = new Set<MediaFmt>(['mp3', 'ogg', 'opus', 'm4a', 'aac', 'wma'])

const BITRATES = [320, 256, 192, 160, 128, 96, 64, 32].map((v) => ({ value: String(v), label: `${v} kbps${v === 192 ? ' (music)' : v === 64 ? ' (speech)' : ''}` }))
const RATES = [
  { value: '0', label: 'Keep the source rate' },
  { value: '48000', label: '48,000 Hz' },
  { value: '44100', label: '44,100 Hz (CD)' },
  { value: '22050', label: '22,050 Hz' },
  { value: '16000', label: '16,000 Hz (speech)' },
]
const CHANNELS = [
  { value: '0', label: 'Keep the source channels' },
  { value: '2', label: 'Stereo' },
  { value: '1', label: 'Mono' },
]
const QUALITIES = [
  { value: 'high', label: 'High (larger file)' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'small', label: 'Small file' },
]
const HEIGHTS = [
  { value: '0', label: 'Keep the size' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
  { value: '360', label: '360p' },
]

export default function MediaPair({ from, to, fromLabel, toLabel, accept, fromKind }: MediaPairProps) {
  const source = useSourceFile(fromKind)
  const job = useMediaJob()
  const audioOut = isAudioTarget(to)
  const gif = to === 'gif'
  const [s, setS] = useState<MediaSettings>({
    bitrate: from === 'flac' && to === 'm4a' ? 256 : (BITRATE_DEFAULT[to] ?? 192),
    bitDepth: 16,
    flacLevel: 5,
    sampleRate: 0,
    channels: 0,
    quality: 'balanced',
    maxHeight: 0,
    forceEncode: false,
    gifFps: 12,
    gifWidth: 480,
    start: 0,
    length: gif ? 6 : 0,
  })
  const set = <K extends keyof MediaSettings>(k: K, v: MediaSettings[K]) => setS((o) => ({ ...o, [k]: v }))
  const [fast, setFast] = useState<{ percent: number } | null>(null)
  const [fastResult, setFastResult] = useState<{ result: MediaJobResult; summary: string } | null>(null)
  const [summary, setSummary] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const file = source.file
  const duration = source.info?.duration ?? 0
  const ext = outputExt(to)
  const filename = file ? `${stripExtension(file.name)}.${ext}` : `converted.${ext}`
  const busy = job.busy || fast !== null

  const runFfmpeg = (f: File) => {
    const input = inputName(f)
    void job.run(async () => {
      const probe = await probeWithEngine(f)
      const plan = planFfmpeg(to, input, s, probe)
      setSummary(plan.summary)
      const total = probe.duration || duration
      const outDuration = s.length > 0 ? Math.min(s.length, Math.max(0, total - s.start)) : Math.max(0, total - s.start)
      return { inputs: [{ name: input, data: f }], commands: [plan.args], output: plan.output, mime: plan.mime, filename, durationSec: outDuration || undefined, inputBytes: f.size }
    })
  }

  const start = async () => {
    if (!file || busy) return
    setFastResult(null)
    job.reset()
    if (WEBCODECS_TARGETS.has(to) && FAST_SOURCES.has(from)) {
      const controller = new AbortController()
      abortRef.current = controller
      setFast({ percent: 0 })
      const t0 = performance.now()
      try {
        const out = await convertWithWebCodecs(file, to, s, (p) => setFast({ percent: Math.round(p * 100) }), controller.signal)
        setFast(null)
        if (out) {
          setFastResult({ result: { blob: out.blob, filename, elapsedMs: performance.now() - t0, inputBytes: file.size }, summary: out.summary })
          return
        }
      } catch {
        setFast(null)
        if (controller.signal.aborted) return
      }
    }
    runFfmpeg(file)
  }

  const reset = () => {
    abortRef.current?.abort()
    setFast(null)
    setFastResult(null)
    job.reset()
    source.clear()
  }

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept={accept}
          onFiles={(files) => {
            setFastResult(null)
            job.reset()
            source.select(files)
          }}
          maxSizeMb={2048}
          title={`Drop your ${fromLabel} file`}
          hint={`or click to browse. It becomes ${toLabel} on this device.`}
        />
        <EngineNotice />
      </div>
    )
  }

  const result = fastResult?.result ?? job.result
  const kind = audioOut ? 'audio' : gif ? 'image' : 'video'

  return (
    <div className="space-y-4">
      <SourceSummary file={file} duration={source.info?.duration} width={source.info?.width} height={source.info?.height} onClear={reset} />
      {source.info?.playable ? <MediaPreview source={file} kind={fromKind} /> : null}

      <ToolPanel
        title="Settings"
        footer={
          <Button type="button" onClick={() => void start()} disabled={busy} className="w-full sm:w-auto">
            {audioOut ? <AudioLines className="size-4" aria-hidden="true" /> : <Clapperboard className="size-4" aria-hidden="true" />}
            {busy ? 'Converting…' : `Convert to ${toLabel}`}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {audioOut && LOSSY.has(to) ? <SelectField label="Bitrate" value={String(s.bitrate)} onChange={(v) => set('bitrate', Number(v))} options={BITRATES} /> : null}
          {to === 'wav' || to === 'aiff' ? (
            <SelectField
              label="Bit depth"
              value={String(s.bitDepth)}
              onChange={(v) => set('bitDepth', v === '24' ? 24 : 16)}
              options={[
                { value: '16', label: '16-bit (CD)' },
                { value: '24', label: '24-bit (studio)' },
              ]}
            />
          ) : null}
          {to === 'flac' ? (
            <SelectField
              label="Compression level"
              value={String(s.flacLevel)}
              onChange={(v) => set('flacLevel', Number(v))}
              options={[
                { value: '0', label: '0 (fastest)' },
                { value: '5', label: '5 (default)' },
                { value: '8', label: '8 (smallest)' },
              ]}
              hint="Every level is lossless."
            />
          ) : null}
          {!audioOut && !gif ? (
            <>
              <SelectField label="Quality" value={s.quality} onChange={(v) => set('quality', v as Quality)} options={QUALITIES} />
              <SelectField label="Size" value={String(s.maxHeight)} onChange={(v) => set('maxHeight', Number(v))} options={HEIGHTS} hint="Smaller sizes convert faster." />
            </>
          ) : null}
          {gif ? (
            <>
              <SelectField
                label="Frames per second"
                value={String(s.gifFps)}
                onChange={(v) => set('gifFps', Number(v))}
                options={[8, 10, 12, 15, 20, 24].map((v) => ({ value: String(v), label: `${v} fps` }))}
              />
              <SelectField
                label="Width"
                value={String(s.gifWidth)}
                onChange={(v) => set('gifWidth', Number(v))}
                options={[240, 320, 480, 640, 800].map((v) => ({ value: String(v), label: `${v} px` })).concat([{ value: '0', label: 'Source width' }])}
              />
              <NumberField label="Start (seconds)" value={s.start} min={0} step={0.5} onChange={(v) => set('start', v === '' ? 0 : v)} />
              <NumberField label="Length (seconds)" value={s.length} min={0} step={0.5} onChange={(v) => set('length', v === '' ? 0 : v)} hint="0 converts to the end. Long GIFs get very large." />
            </>
          ) : null}
        </div>
        {!gif ? (
          <AdvancedOptions>
            {audioOut ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Sample rate" value={String(s.sampleRate)} onChange={(v) => set('sampleRate', Number(v))} options={RATES} />
                <SelectField label="Channels" value={String(s.channels)} onChange={(v) => set('channels', Number(v))} options={CHANNELS} />
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Start (seconds)" value={s.start} min={0} step={1} onChange={(v) => set('start', v === '' ? 0 : v)} />
              <NumberField label="Length (seconds)" value={s.length} min={0} step={1} onChange={(v) => set('length', v === '' ? 0 : v)} hint="0 keeps everything to the end." />
            </div>
            <SwitchField
              label="Always re-encode"
              checked={s.forceEncode}
              onChange={(v) => set('forceEncode', v)}
              hint="By default, streams that the new format can hold are copied as they are, which is fast and lossless."
            />
          </AdvancedOptions>
        ) : null}
      </ToolPanel>

      {fast ? (
        <div role="status" aria-live="polite" className="space-y-2">
          <ProgressPanel label="Converting with the browser's media engine" value={fast.percent} />
          <Button type="button" variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
            Cancel
          </Button>
        </div>
      ) : null}
      <JobStatus job={job} label={`Converting to ${toLabel}`} />
      <JobError job={job} onRetry={() => void start()} />

      {result ? (
        <ResultPanel
          result={result}
          kind={kind}
          downloadLabel={`Download ${toLabel}`}
          resetLabel="Convert another file"
          onReset={reset}
          stats={
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat label="Format" value={`${toLabel} (.${ext})`} hint={OUT_MIME[ext]} />
              <ResultStat label="How" value={fastResult ? 'Browser media engine' : 'FFmpeg'} hint={fastResult?.summary ?? summary} />
            </div>
          }
          note={result.blob.size > 0 && file.size > 0 ? <p className="text-sm text-muted-foreground">{formatBytes(file.size)} in, {formatBytes(result.blob.size)} out.</p> : null}
        />
      ) : null}

      {!result ? <EngineNotice /> : null}
    </div>
  )
}
