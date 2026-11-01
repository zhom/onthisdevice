/**
 * Shared React building blocks for the Video & Audio tools.
 * Everything here is private to `src/components/tools/media/`.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Cpu,
  HardDriveDownload,
  RotateCcw,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { cn, formatBytes } from '@/lib/utils'

import {
  ENGINE_TOTAL_BYTES,
  FFMPEG_FIRST_RUN_NOTICE,
  JobCancelledError,
  formatTimecode,
  getEngine,
  getEngineState,
  isCorePrefetched,
  isEngineReady,
  parseTimecode,
  probeDurationWithEngine,
  probeMedia,
  runFFmpeg,
  subscribeEngine,
  terminateEngine,
} from './_ffmpeg'
import type { EngineState, JobInput, MediaInfo } from './_ffmpeg'

/* ------------------------------------------------------------------ *
 * Engine state
 * ------------------------------------------------------------------ */

export function useEngineState(): EngineState {
  const [state, setState] = useState<EngineState>(() => getEngineState())
  useEffect(() => subscribeEngine(setState), [])
  return state
}

/** Explains the one-time engine download in plain language. */
export function EngineNotice({ className }: { className?: string }) {
  const engine = useEngineState()
  const [cached, setCached] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    void isCorePrefetched().then((value) => {
      if (alive) setCached(value)
    })
    return () => {
      alive = false
    }
  }, [engine.stage])

  const ready = engine.stage === 'ready'
  const Icon = ready ? CheckCircle2 : cached ? Cpu : HardDriveDownload

  const message = ready
    ? 'FFmpeg runs in this tab. Your file is decoded and encoded on this device and is not uploaded.'
    : cached
      ? 'The FFmpeg engine is cached in this browser, so it starts without a download and works offline.'
      : `${FFMPEG_FIRST_RUN_NOTICE} It is WebAssembly from onthisdevice.com (no third-party CDN). Your file is processed on your device.`

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground',
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="leading-relaxed">{message}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Job hook
 * ------------------------------------------------------------------ */

export type JobPhase = 'idle' | 'engine' | 'working' | 'done' | 'error'

export interface JobSpec {
  inputs: JobInput[]
  commands: string[][]
  output: string
  mime: string
  /** Download filename shown to the user. */
  filename: string
  durationSec?: number
  temps?: string[]
  inputBytes: number
}

export interface MediaJobResult {
  blob: Blob
  filename: string
  elapsedMs: number
  inputBytes: number
}

export interface MediaJob {
  phase: JobPhase
  percent: number
  elapsedMs: number
  logLine: string
  error: string | null
  result: MediaJobResult | null
  engine: EngineState
  busy: boolean
  /** Pass a spec, or a factory that may probe the file once the engine is up. */
  run: (spec: JobSpec | (() => JobSpec | Promise<JobSpec>)) => Promise<void>
  cancel: () => void
  reset: () => void
  fail: (message: string) => void
}

export function useMediaJob(): MediaJob {
  const engine = useEngineState()
  const [phase, setPhase] = useState<JobPhase>('idle')
  const [percent, setPercent] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [logLine, setLogLine] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MediaJobResult | null>(null)

  const startedAt = useRef(0)
  const timer = useRef<number | null>(null)
  const cancelled = useRef(false)

  const stopTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  useEffect(() => stopTimer, [stopTimer])

  const reset = useCallback(() => {
    stopTimer()
    cancelled.current = false
    setPhase('idle')
    setPercent(0)
    setElapsedMs(0)
    setLogLine('')
    setError(null)
    setResult(null)
  }, [stopTimer])

  const fail = useCallback(
    (message: string) => {
      stopTimer()
      setError(message)
      setPhase('error')
    },
    [stopTimer],
  )

  const run = useCallback(
    async (specOrFactory: JobSpec | (() => JobSpec | Promise<JobSpec>)) => {
      cancelled.current = false
      setError(null)
      setResult(null)
      setPercent(0)
      setLogLine('')
      setElapsedMs(0)
      startedAt.current = performance.now()
      stopTimer()
      timer.current = window.setInterval(() => {
        setElapsedMs(performance.now() - startedAt.current)
      }, 100)
      setPhase(isEngineReady() ? 'working' : 'engine')

      try {
        await getEngine()
        if (cancelled.current) return
        setPhase('working')
        const spec = typeof specOrFactory === 'function' ? await specOrFactory() : specOrFactory
        if (cancelled.current) return
        const { blob } = await runFFmpeg({
          inputs: spec.inputs,
          commands: spec.commands,
          output: spec.output,
          mime: spec.mime,
          durationSec: spec.durationSec,
          temps: spec.temps,
          onProgress: setPercent,
          onLog: (line) => {
            const trimmed = line.trim()
            if (trimmed) setLogLine(trimmed.slice(0, 160))
          },
        })
        if (cancelled.current) return
        setResult({
          blob,
          filename: spec.filename,
          elapsedMs: performance.now() - startedAt.current,
          inputBytes: spec.inputBytes,
        })
        setPercent(100)
        setPhase('done')
      } catch (err) {
        if (cancelled.current || err instanceof JobCancelledError) {
          setPhase('idle')
          return
        }
        setError(
          err instanceof Error
            ? err.message
            : 'Something went wrong while processing this file. Try again, or try a different file.',
        )
        setPhase('error')
      } finally {
        stopTimer()
      }
    },
    [stopTimer],
  )

  const cancel = useCallback(() => {
    cancelled.current = true
    terminateEngine()
    stopTimer()
    setPhase('idle')
    setPercent(0)
    setLogLine('')
  }, [stopTimer])

  return {
    phase,
    percent,
    elapsedMs,
    logLine,
    error,
    result,
    engine,
    busy: phase === 'engine' || phase === 'working',
    run,
    cancel,
    reset,
    fail,
  }
}

/* ------------------------------------------------------------------ *
 * Progress / status
 * ------------------------------------------------------------------ */

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 100) / 10)
  if (total < 60) return `${total.toFixed(1)}s`
  const mins = Math.floor(total / 60)
  const secs = Math.round(total % 60)
  return `${mins}m ${String(secs).padStart(2, '0')}s`
}

/** Progress bar + elapsed time + current FFmpeg line + cancel. */
export function JobStatus({ job, label }: { job: MediaJob; label: string }) {
  if (!job.busy) return null

  const downloading = job.phase === 'engine' && job.engine.stage === 'downloading'
  const starting = job.phase === 'engine' && job.engine.stage !== 'downloading'

  const barLabel = downloading
    ? `Downloading the FFmpeg engine: ${formatBytes(job.engine.received)} of ${formatBytes(
        ENGINE_TOTAL_BYTES,
      )}`
    : starting
      ? 'Starting FFmpeg…'
      : `${label}: ${Math.min(99, Math.round(job.percent))}%`

  return (
    <div className="space-y-3">
      {starting ? (
        <ProgressPanel label={barLabel} />
      ) : (
        <ProgressPanel label={barLabel} value={downloading ? job.engine.percent : job.percent} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-mono">Elapsed {formatElapsed(job.elapsedMs)}</span>
        <Button type="button" variant="ghost" size="sm" onClick={job.cancel}>
          <X className="size-4" aria-hidden="true" />
          Cancel
        </Button>
      </div>
      {downloading && !job.engine.fromCache ? (
        <p className="text-xs text-muted-foreground">{FFMPEG_FIRST_RUN_NOTICE}</p>
      ) : null}
      {job.logLine ? (
        <p className="truncate rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          {job.logLine}
        </p>
      ) : null}
    </div>
  )
}

export function JobError({ job, onRetry }: { job: MediaJob; onRetry?: () => void }) {
  if (job.phase !== 'error' || !job.error) return null
  return <ErrorNote message={job.error} onRetry={onRetry} />
}

/* ------------------------------------------------------------------ *
 * Previews
 * ------------------------------------------------------------------ */

export type PreviewKind = 'video' | 'audio' | 'image'

function useObjectUrl(source: Blob | File | null): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!source) {
      setUrl('')
      return
    }
    const next = URL.createObjectURL(source)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [source])
  return url
}

/** Preview for a Blob/File with a graceful fallback for exotic containers. */
export function MediaPreview({
  source,
  kind,
  mediaRef,
  className,
  onLoadedMetadata,
}: {
  source: Blob | File | null
  kind: PreviewKind
  mediaRef?: RefObject<HTMLVideoElement | null> | RefObject<HTMLAudioElement | null>
  className?: string
  onLoadedMetadata?: () => void
}) {
  const url = useObjectUrl(source)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (!url) return null

  if (failed) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          Your browser has no built-in player for this format, so it cannot be previewed here. The
          file itself is fine. Download it and open it in VLC, QuickTime or another player.
        </p>
      </div>
    )
  }

  if (kind === 'image') {
    return (
      <img
        src={url}
        alt="Result preview"
        className={cn('mx-auto max-h-[420px] w-auto max-w-full rounded-lg border border-border', className)}
        onError={() => setFailed(true)}
      />
    )
  }

  if (kind === 'audio') {
    return (
      <audio
        ref={mediaRef as RefObject<HTMLAudioElement | null> | undefined}
        src={url}
        controls
        preload="metadata"
        className={cn('w-full', className)}
        onError={() => setFailed(true)}
        onLoadedMetadata={onLoadedMetadata}
      />
    )
  }

  return (
    <video
      ref={mediaRef as RefObject<HTMLVideoElement | null> | undefined}
      src={url}
      controls
      playsInline
      preload="metadata"
      className={cn(
        'max-h-[420px] w-full rounded-lg bg-muted',
        className,
      )}
      onError={() => setFailed(true)}
      onLoadedMetadata={onLoadedMetadata}
    />
  )
}

/* ------------------------------------------------------------------ *
 * Result
 * ------------------------------------------------------------------ */

export function ResultPanel({
  result,
  kind,
  onReset,
  resetLabel = 'Convert another file',
  downloadLabel = 'Download result',
  stats,
  note,
}: {
  result: MediaJobResult
  kind: PreviewKind
  onReset: () => void
  resetLabel?: string
  downloadLabel?: string
  stats?: ReactNode
  note?: ReactNode
}) {
  const delta =
    result.inputBytes > 0
      ? ((result.blob.size - result.inputBytes) / result.inputBytes) * 100
      : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
        Done: {result.filename}
      </div>

      <MediaPreview source={result.blob} kind={kind} />

      <div className="grid gap-3 sm:grid-cols-3">
        <ResultStat label="Output size" value={formatBytes(result.blob.size)} emphasis />
        <ResultStat
          label="Input size"
          value={formatBytes(result.inputBytes)}
          hint={
            result.inputBytes > 0
              ? `${delta <= 0 ? '' : '+'}${delta.toFixed(0)}% change`
              : undefined
          }
        />
        <ResultStat label="Processing time" value={formatElapsed(result.elapsedMs)} />
      </div>

      {stats}
      {note}

      <div className="flex flex-wrap gap-2">
        <DownloadButton blob={result.blob} filename={result.filename} label={downloadLabel} />
        <Button type="button" variant="outline" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden="true" />
          {resetLabel}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Form helpers
 * ------------------------------------------------------------------ */

export interface SelectOption {
  value: string
  label: string
}

/** Native disclosure so advanced settings stay out of the way but keyboard-reachable. */
export function AdvancedOptions({
  children,
  label = 'Advanced options',
}: {
  children: ReactNode
  label?: string
}) {
  return (
    <details className="group rounded-lg bg-muted">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {label}
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-4 border-t border-border p-3">{children}</div>
    </details>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  hint?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
  disabled,
  suffix,
}: {
  label: string
  value: number | ''
  onChange: (value: number | '') => void
  min?: number
  max?: number
  step?: number
  hint?: string
  disabled?: boolean
  suffix?: string
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => {
            const raw = event.target.value
            onChange(raw === '' ? '' : Number(raw))
          }}
        />
        {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function SwitchField({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Dual-handle range slider (start / end)
 * ------------------------------------------------------------------ */

const THUMB_CLASSES =
  'pointer-events-none absolute inset-x-0 top-0 h-10 w-full cursor-pointer appearance-none bg-transparent ' +
  'focus:outline-none ' +
  '[&::-webkit-slider-runnable-track]:h-10 [&::-webkit-slider-runnable-track]:bg-transparent ' +
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none ' +
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background ' +
  '[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md ' +
  '[&::-moz-range-track]:h-10 [&::-moz-range-track]:bg-transparent ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:appearance-none ' +
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background ' +
  '[&::-moz-range-thumb]:bg-primary ' +
  'focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-ring ' +
  'focus-visible:[&::-moz-range-thumb]:ring-2 focus-visible:[&::-moz-range-thumb]:ring-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

export function DualRangeSlider({
  min,
  max,
  step,
  start,
  end,
  onChange,
  disabled,
  startLabel = 'Start time',
  endLabel = 'End time',
  format = (value: number) => formatTimecode(value),
}: {
  min: number
  max: number
  step: number
  start: number
  end: number
  onChange: (start: number, end: number) => void
  disabled?: boolean
  startLabel?: string
  endLabel?: string
  format?: (value: number) => string
}) {
  const span = Math.max(max - min, 0.0001)
  const startPct = ((start - min) / span) * 100
  const endPct = ((end - min) / span) * 100

  return (
    <div className="space-y-2">
      <div className="relative h-10 select-none">
        <div className="pointer-events-none absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
        />
        <input
          type="range"
          className={THUMB_CLASSES}
          min={min}
          max={max}
          step={step}
          value={start}
          disabled={disabled}
          aria-label={startLabel}
          aria-valuetext={format(start)}
          onChange={(event) => {
            const next = Math.min(Number(event.target.value), end - step)
            onChange(Math.max(min, next), end)
          }}
        />
        <input
          type="range"
          className={THUMB_CLASSES}
          min={min}
          max={max}
          step={step}
          value={end}
          disabled={disabled}
          aria-label={endLabel}
          aria-valuetext={format(end)}
          onChange={(event) => {
            const next = Math.max(Number(event.target.value), start + step)
            onChange(start, Math.min(max, next))
          }}
        />
      </div>
      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Trim controls: slider + exact time fields + "use playhead"
 * ------------------------------------------------------------------ */

function TimeField({
  label,
  seconds,
  max,
  onCommit,
  onUsePlayhead,
  disabled,
}: {
  label: string
  seconds: number
  max: number
  onCommit: (value: number) => void
  onUsePlayhead?: () => void
  disabled?: boolean
}) {
  const id = useId()
  const [text, setText] = useState(() => formatTimecode(seconds, 2))
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    setText(formatTimecode(seconds, 2))
    setInvalid(false)
  }, [seconds])

  const commit = () => {
    const parsed = parseTimecode(text)
    if (parsed === null || parsed < 0 || parsed > max + 0.001) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onCommit(parsed)
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={text}
          inputMode="decimal"
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className="font-mono"
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
          }}
        />
        {onUsePlayhead ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onUsePlayhead}
            className="shrink-0"
          >
            Set here
          </Button>
        ) : null}
      </div>
      {invalid ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          Use m:ss.ss or h:mm:ss.ss, within the clip length.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Format m:ss.ss, or press “Set here”.</p>
      )}
    </div>
  )
}

export function TrimControls({
  duration,
  start,
  end,
  onChange,
  mediaRef,
  disabled,
}: {
  duration: number
  start: number
  end: number
  onChange: (start: number, end: number) => void
  mediaRef?: RefObject<HTMLVideoElement | null> | RefObject<HTMLAudioElement | null>
  disabled?: boolean
}) {
  const playhead = () => {
    const el = mediaRef?.current
    return el && Number.isFinite(el.currentTime) ? el.currentTime : null
  }

  const step = duration > 600 ? 0.1 : 0.01

  return (
    <div className="space-y-4">
      <DualRangeSlider
        min={0}
        max={duration}
        step={step}
        start={start}
        end={end}
        disabled={disabled}
        onChange={(nextStart, nextEnd) =>
          onChange(Number(nextStart.toFixed(2)), Number(nextEnd.toFixed(2)))
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TimeField
          label="Start"
          seconds={start}
          max={duration}
          disabled={disabled}
          onCommit={(value) => onChange(Math.min(value, end - step), end)}
          onUsePlayhead={
            mediaRef
              ? () => {
                  const at = playhead()
                  if (at !== null) onChange(Math.min(at, end - step), end)
                }
              : undefined
          }
        />
        <TimeField
          label="End"
          seconds={end}
          max={duration}
          disabled={disabled}
          onCommit={(value) => onChange(start, Math.max(value, start + step))}
          onUsePlayhead={
            mediaRef
              ? () => {
                  const at = playhead()
                  if (at !== null) onChange(start, Math.max(at, start + step))
                }
              : undefined
          }
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Selected: <span className="font-mono text-foreground">{formatTimecode(start, 2)}</span> →{' '}
        <span className="font-mono text-foreground">{formatTimecode(end, 2)}</span> · length{' '}
        <span className="font-mono text-foreground">{formatTimecode(Math.max(0, end - start), 2)}</span>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Source file selection
 * ------------------------------------------------------------------ */

export interface SourceFileState {
  file: File | null
  info: MediaInfo | null
  probing: boolean
  select: (files: File[]) => void
  clear: () => void
  setDuration: (seconds: number) => void
}

/** Picks the first dropped file and reads its metadata with a media element. */
export function useSourceFile(kind: 'video' | 'audio' = 'video'): SourceFileState {
  const [file, setFile] = useState<File | null>(null)
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [probing, setProbing] = useState(false)
  const token = useRef(0)

  const select = useCallback(
    (files: File[]) => {
      const next = files[0]
      if (!next) return
      const id = ++token.current
      setFile(next)
      setInfo(null)
      setProbing(true)
      void probeMedia(next, kind).then((result) => {
        if (token.current !== id) return
        setInfo(result)
        setProbing(false)
      })
    },
    [kind],
  )

  const clear = useCallback(() => {
    token.current += 1
    setFile(null)
    setInfo(null)
    setProbing(false)
  }, [])

  const setDuration = useCallback((seconds: number) => {
    setInfo((current) => ({
      duration: seconds,
      width: current?.width ?? 0,
      height: current?.height ?? 0,
      playable: current?.playable ?? false,
    }))
  }, [])

  return { file, info, probing, select, clear, setDuration }
}

/**
 * Fallback for containers the browser cannot decode (MKV, AVI, some MOV):
 * asks FFmpeg for the duration so the trim slider can be used.
 */
export function DetectDurationPanel({
  file,
  onDuration,
}: {
  file: File
  onDuration: (seconds: number) => void
}) {
  const engine = useEngineState()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detect = async () => {
    setBusy(true)
    setError(null)
    try {
      const seconds = await probeDurationWithEngine(file)
      if (seconds > 0) onDuration(seconds)
      else setError('FFmpeg could not read a duration from this file. You can still type times by hand.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reading the file failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg bg-muted p-3">
      <p className="text-sm text-muted-foreground">
        Your browser cannot decode this container, so it cannot show a preview or report the clip
        length. FFmpeg can read it, and the trim controls unlock when it has.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={detect} disabled={busy}>
        {busy ? 'Reading the file…' : 'Read length with FFmpeg'}
      </Button>
      {busy && engine.stage === 'downloading' ? (
        <ProgressPanel
          label={`Downloading the FFmpeg engine: ${formatBytes(engine.received)} of ${formatBytes(
            ENGINE_TOTAL_BYTES,
          )}`}
          value={engine.percent}
        />
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Source file summary
 * ------------------------------------------------------------------ */

export function SourceSummary({
  file,
  duration,
  width,
  height,
  onClear,
  extra,
}: {
  file: File
  duration?: number
  width?: number
  height?: number
  onClear: () => void
  extra?: string
}) {
  const bits: string[] = [formatBytes(file.size)]
  if (duration && duration > 0) bits.push(formatTimecode(duration))
  if (width && height) bits.push(`${width}×${height}`)
  if (extra) bits.push(extra)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
        <p className="text-xs text-muted-foreground">{bits.join(' · ')}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        Choose a different file
      </Button>
    </div>
  )
}

export { formatElapsed }
