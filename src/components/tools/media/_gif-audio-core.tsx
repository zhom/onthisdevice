/**
 * Shared plumbing for the round-2 `gif-audio` batch (GIF tools, audio
 * converters, joiner, recorder, device tests).
 *
 * Everything here is private to this batch. It sits on top of the site-wide
 * FFmpeg engine in `./_ffmpeg` — that module is the ONLY place allowed to call
 * `ffmpeg.load()`, because the core has to be pulled same-origin from
 * `public/ffmpeg/`. Never construct a second `FFmpeg`.
 *
 * Why this file exists at all: `_shared.tsx`'s `useMediaJob` runs exactly one
 * declarative spec (write inputs → run argv → read one output). Half of this
 * batch cannot be expressed that way — compressing a GIF to a byte target is a
 * search loop, exploding a GIF writes N output files, and the batch audio
 * converter runs one job per queued file. So this adds a small imperative task
 * runner over the same engine.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { CheckCircle2, Cpu, HardDriveDownload, TriangleAlert, X } from 'lucide-react'

import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { Button } from '@/components/ui/button'
import { clamp, cn, formatBytes } from '@/lib/utils'

import {
  ENGINE_TOTAL_BYTES,
  FFMPEG_FIRST_RUN_NOTICE,
  getEngine,
  getEngineState,
  isCorePrefetched,
  isEngineReady,
  onEngineLog,
  subscribeEngine,
  terminateEngine,
} from './_ffmpeg'
import type { EngineState } from './_ffmpeg'

export { FFMPEG_FIRST_RUN_NOTICE }

/* ------------------------------------------------------------------ *
 * Engine state
 * ------------------------------------------------------------------ */

export function useEngineState(): EngineState {
  const [state, setState] = useState<EngineState>(() => getEngineState())
  useEffect(() => subscribeEngine(setState), [])
  return state
}

/** Plain-language explanation of the one-time WebAssembly download. */
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
    ? 'FFmpeg is running in this browser tab. It decodes and encodes your file on this device.'
    : cached
      ? 'The FFmpeg engine is already cached in this browser, so it starts quickly and works offline.'
      : `${FFMPEG_FIRST_RUN_NOTICE} The engine is WebAssembly from onthisdevice.com (no third-party CDN). Your file is processed on your device.`

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
 * Task runner
 * ------------------------------------------------------------------ */

/** Thrown internally when the user cancels; never surfaced as an error. */
export class TaskCancelled extends Error {
  constructor() {
    super('Cancelled')
    this.name = 'TaskCancelled'
  }
}

export type TaskPhase = 'idle' | 'engine' | 'working' | 'done' | 'error'

export interface TaskCtx {
  /** Throws `TaskCancelled` if the user pressed Cancel since the task began. */
  throwIfCancelled: () => void
  setPercent: (percent: number) => void
  setStatus: (status: string) => void
}

export interface Task<T> {
  phase: TaskPhase
  percent: number
  /** Indeterminate when true — the bar hides its number. */
  indeterminate: boolean
  status: string
  error: string | null
  result: T | null
  busy: boolean
  engine: EngineState
  elapsedMs: number
  run: (fn: (ctx: TaskCtx) => Promise<T>, options?: { needsEngine?: boolean }) => Promise<void>
  cancel: () => void
  reset: () => void
  fail: (message: string) => void
  setResult: (value: T | null) => void
}

const GENERIC_FAILURE =
  'Something went wrong while processing this file. Try again, or try a different file.'

export function useTask<T>(): Task<T> {
  const engine = useEngineState()
  const [phase, setPhase] = useState<TaskPhase>('idle')
  const [percent, setPercentState] = useState(0)
  const [indeterminate, setIndeterminate] = useState(true)
  const [status, setStatusState] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<T | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)

  const token = useRef(0)
  const startedAt = useRef(0)
  const timer = useRef<number | null>(null)

  const stopTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  useEffect(() => stopTimer, [stopTimer])

  const reset = useCallback(() => {
    token.current += 1
    stopTimer()
    setPhase('idle')
    setPercentState(0)
    setIndeterminate(true)
    setStatusState('')
    setError(null)
    setResult(null)
    setElapsedMs(0)
  }, [stopTimer])

  const fail = useCallback(
    (message: string) => {
      token.current += 1
      stopTimer()
      setError(message)
      setPhase('error')
    },
    [stopTimer],
  )

  const run = useCallback(
    async (fn: (ctx: TaskCtx) => Promise<T>, options?: { needsEngine?: boolean }) => {
      const id = ++token.current
      const needsEngine = options?.needsEngine !== false

      setError(null)
      setResult(null)
      setPercentState(0)
      setIndeterminate(true)
      setStatusState('')
      setElapsedMs(0)
      startedAt.current = performance.now()
      stopTimer()
      timer.current = window.setInterval(() => {
        setElapsedMs(performance.now() - startedAt.current)
      }, 100)
      setPhase(!needsEngine || isEngineReady() ? 'working' : 'engine')

      const ctx: TaskCtx = {
        throwIfCancelled: () => {
          if (token.current !== id) throw new TaskCancelled()
        },
        setPercent: (value) => {
          if (token.current !== id) return
          setIndeterminate(false)
          setPercentState(clamp(value, 0, 100))
        },
        setStatus: (value) => {
          if (token.current === id) setStatusState(value)
        },
      }

      try {
        if (needsEngine) {
          await getEngine()
          ctx.throwIfCancelled()
          setPhase('working')
        }
        const value = await fn(ctx)
        ctx.throwIfCancelled()
        setResult(value)
        setPercentState(100)
        setPhase('done')
      } catch (err) {
        if (token.current !== id || err instanceof TaskCancelled) return
        setError(err instanceof Error && err.message ? err.message : GENERIC_FAILURE)
        setPhase('error')
      } finally {
        if (token.current === id) stopTimer()
      }
    },
    [stopTimer],
  )

  const cancel = useCallback(() => {
    token.current += 1
    stopTimer()
    // The FFmpeg worker has no abort signal; tearing it down is the only way to
    // stop a running encode. The core reloads instantly from Cache Storage.
    if (isEngineReady()) terminateEngine()
    setPhase('idle')
    setPercentState(0)
    setStatusState('')
  }, [stopTimer])

  return {
    phase,
    percent,
    indeterminate,
    status,
    error,
    result,
    busy: phase === 'engine' || phase === 'working',
    engine,
    elapsedMs,
    run,
    cancel,
    reset,
    fail,
    setResult,
  }
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 100) / 10)
  if (total < 60) return `${total.toFixed(1)}s`
  const mins = Math.floor(total / 60)
  const secs = Math.round(total % 60)
  return `${mins}m ${String(secs).padStart(2, '0')}s`
}

/** Progress bar + elapsed time + cancel, aware of the engine download phase. */
export function TaskStatus<T>({
  task,
  label,
  cancellable = true,
}: {
  task: Task<T>
  label: string
  cancellable?: boolean
}) {
  if (!task.busy) return null

  const downloading = task.phase === 'engine' && task.engine.stage === 'downloading'
  const starting = task.phase === 'engine' && task.engine.stage !== 'downloading'

  const barLabel = downloading
    ? `Downloading the FFmpeg engine: ${formatBytes(task.engine.received)} of ${formatBytes(
        ENGINE_TOTAL_BYTES,
      )}`
    : starting
      ? 'Starting FFmpeg…'
      : task.status || label

  return (
    <div className="space-y-3">
      {starting || (!downloading && task.indeterminate) ? (
        <ProgressPanel label={barLabel} />
      ) : (
        <ProgressPanel label={barLabel} value={downloading ? task.engine.percent : task.percent} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-mono">Elapsed {formatElapsed(task.elapsedMs)}</span>
        {cancellable ? (
          <Button type="button" variant="ghost" size="sm" onClick={task.cancel}>
            <X className="size-4" aria-hidden="true" />
            Cancel
          </Button>
        ) : null}
      </div>
      {downloading && !task.engine.fromCache ? (
        <p className="text-xs text-muted-foreground">{FFMPEG_FIRST_RUN_NOTICE}</p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Low-level FFmpeg execution
 * ------------------------------------------------------------------ */

const FRAME_RE = /frame=\s*(\d+)/
const TIME_RE = /time=\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/

function humanizeFfmpeg(lines: string[], exitCode: number | null): string {
  const text = lines.join('\n')

  if (/Invalid data found when processing input/i.test(text))
    return 'FFmpeg could not read that file. It may be corrupt, truncated, or a container this build does not support.'
  if (/Unknown encoder|Encoder .* not found|Unrecognized option|Unknown decoder/i.test(text))
    return 'That format or codec is not available in this FFmpeg build. Try a different output format.'
  if (/matches no streams|does not contain any stream/i.test(text))
    return 'This file has no audio track that FFmpeg could find, so there is nothing to convert.'
  if (/No such file or directory/i.test(text))
    return 'FFmpeg lost track of the input file. Reload the page and pick the file again.'
  if (/memory access out of bounds|Cannot enlarge memory|out of memory|OOM/i.test(text))
    return 'This file is too large for the browser sandbox, which is capped at roughly 2 GB of working memory. Try a shorter clip, a smaller size, or a desktop browser.'

  const last = [...lines].reverse().find((line) => line.trim().length > 0)
  return last
    ? `FFmpeg stopped with an error: ${last.slice(0, 220)}`
    : `FFmpeg stopped with exit code ${exitCode ?? 'unknown'}.`
}

export interface ExecOptions {
  /** Expected output frame count — drives determinate progress from `frame=`. */
  totalFrames?: number
  /** Expected output duration in seconds — drives progress from `time=`. */
  totalSeconds?: number
  /** Called with 0..1 as the command advances. */
  onProgress?: (fraction: number) => void
  onLine?: (line: string) => void
}

/**
 * Run one FFmpeg command and throw a human-readable error if it fails.
 * The caller is responsible for writing inputs and reading/deleting outputs.
 */
export async function execFFmpeg(
  ffmpeg: FFmpeg,
  args: string[],
  options: ExecOptions = {},
): Promise<void> {
  const recent: string[] = []
  let last = 0

  const off = onEngineLog((line) => {
    recent.push(line)
    if (recent.length > 60) recent.shift()
    options.onLine?.(line)
    if (!options.onProgress) return

    if (options.totalFrames && options.totalFrames > 0) {
      const match = FRAME_RE.exec(line)
      if (match) {
        const fraction = Math.min(1, Number(match[1]) / options.totalFrames)
        if (fraction > last) {
          last = fraction
          options.onProgress(fraction)
        }
        return
      }
    }
    if (options.totalSeconds && options.totalSeconds > 0) {
      const match = TIME_RE.exec(line)
      if (match) {
        const at = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
        const fraction = Math.min(1, at / options.totalSeconds)
        if (fraction > last) {
          last = fraction
          options.onProgress(fraction)
        }
      }
    }
  })

  try {
    let code: number
    try {
      code = await ffmpeg.exec(args)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/terminate/i.test(message)) throw new TaskCancelled()
      terminateEngine()
      throw new Error(humanizeFfmpeg([...recent, message], null))
    }
    if (code !== 0) throw new Error(humanizeFfmpeg(recent, code))
  } finally {
    off()
  }
}

/** Delete virtual-FS entries, ignoring the ones that never existed. */
export async function cleanupFs(ffmpeg: FFmpeg, names: string[]): Promise<void> {
  for (const name of names) {
    try {
      await ffmpeg.deleteFile(name)
    } catch {
      /* never created */
    }
  }
}

/** Read a file back out of the virtual FS as a Blob. */
export async function readOutput(ffmpeg: FFmpeg, name: string, mime: string): Promise<Blob> {
  const data = await ffmpeg.readFile(name)
  if (typeof data === 'string' || data.byteLength === 0)
    throw new Error(
      'FFmpeg produced an empty file. The input may not contain the track or frames this tool needs.',
    )
  const view = new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength)
  return new Blob([view], { type: mime })
}

/** A safe virtual-FS name that preserves the extension FFmpeg sniffs on. */
export function fsName(file: File, prefix: string): string {
  const dot = file.name.lastIndexOf('.')
  const ext =
    dot > 0
      ? file.name
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : ''
  return ext ? `${prefix}.${ext}` : `${prefix}.bin`
}

export async function fileBytes(source: Blob): Promise<Uint8Array> {
  return new Uint8Array(await source.arrayBuffer())
}

/* ------------------------------------------------------------------ *
 * GIF container parsing
 *
 * Reading the GIF header directly is exact and instant: it gives the real
 * frame count and the per-frame delays that FFmpeg's log only approximates,
 * and it means the tools can show a summary before the engine loads.
 * ------------------------------------------------------------------ */

export interface GifMeta {
  width: number
  height: number
  frameCount: number
  /** Per-frame delay in milliseconds, in file order. */
  delaysMs: number[]
  /** Total animation length in seconds. */
  durationSec: number
  /** Average frames per second across the animation. */
  fps: number
  /** 0 = loop forever, -1 = unknown/absent, n = play n extra times. */
  loopCount: number
  animated: boolean
}

/**
 * Browsers render the delay of a 0 cs or 1 cs frame as 100 ms, so a GIF authored
 * at "0 delay" plays at 10 fps everywhere. Mirror that so our fps readout
 * matches what the user actually sees.
 */
function normaliseDelay(centiseconds: number): number {
  return centiseconds <= 1 ? 100 : centiseconds * 10
}

export function parseGifMeta(bytes: Uint8Array): GifMeta | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const signature = String.fromCharCode(...bytes.subarray(0, 3))
  if (signature !== 'GIF' || bytes.length < 13) return null

  const width = view.getUint16(6, true)
  const height = view.getUint16(8, true)
  const packed = bytes[10] ?? 0
  let offset = 13

  if ((packed & 0x80) !== 0) offset += 3 * 2 ** ((packed & 0x07) + 1)

  const delaysMs: number[] = []
  let loopCount = -1
  let pendingDelay: number | null = null

  const skipSubBlocks = () => {
    while (offset < bytes.length) {
      const size = bytes[offset] ?? 0
      offset += 1
      if (size === 0) return
      offset += size
    }
  }

  while (offset < bytes.length) {
    const marker = bytes[offset]
    offset += 1

    if (marker === 0x3b) break // trailer

    if (marker === 0x21) {
      const label = bytes[offset]
      offset += 1
      if (label === 0xf9) {
        const size = bytes[offset] ?? 0
        // Graphic Control Extension: [size=4][packed][delay lo][delay hi][transparent][0]
        if (size >= 4 && offset + 4 < bytes.length)
          pendingDelay = normaliseDelay(view.getUint16(offset + 2, true))
        offset += 1 + size
        // block terminator
        if (bytes[offset] === 0) offset += 1
        else skipSubBlocks()
      } else if (label === 0xff) {
        const size = bytes[offset] ?? 0
        const nameBytes = bytes.subarray(offset + 1, offset + 1 + size)
        const name = String.fromCharCode(...nameBytes)
        offset += 1 + size
        if (name.startsWith('NETSCAPE')) {
          // sub-block: [size=3][1][loop lo][loop hi]
          const subSize = bytes[offset] ?? 0
          if (subSize >= 3 && offset + 3 < bytes.length)
            loopCount = view.getUint16(offset + 2, true)
        }
        skipSubBlocks()
      } else {
        skipSubBlocks()
      }
      continue
    }

    if (marker === 0x2c) {
      // Image Descriptor: left, top, w, h (8 bytes) + packed
      if (offset + 9 > bytes.length) break
      const imagePacked = bytes[offset + 8] ?? 0
      offset += 9
      if ((imagePacked & 0x80) !== 0) offset += 3 * 2 ** ((imagePacked & 0x07) + 1)
      offset += 1 // LZW minimum code size
      skipSubBlocks()
      delaysMs.push(pendingDelay ?? 100)
      pendingDelay = null
      continue
    }

    // Unexpected byte — the file is malformed or padded; stop cleanly.
    break
  }

  const frameCount = delaysMs.length
  if (frameCount === 0) return null
  const totalMs = delaysMs.reduce((sum, ms) => sum + ms, 0)
  const durationSec = totalMs / 1000

  return {
    width,
    height,
    frameCount,
    delaysMs,
    durationSec,
    fps: durationSec > 0 ? frameCount / durationSec : 0,
    loopCount,
    animated: frameCount > 1,
  }
}

/* ------------------------------------------------------------------ *
 * Small shared UI + helpers
 * ------------------------------------------------------------------ */

export function useObjectUrl(source: Blob | File | null): string {
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

/** An even integer ≥ 2 — H.264 and several filters reject odd dimensions. */
export function evenAtLeast2(value: number): number {
  const n = Math.max(2, Math.round(value))
  return n % 2 === 0 ? n : n - 1
}

/** Bundle blobs into a ZIP with real progress. */
export async function zipBlobs(
  entries: { name: string; blob: Blob }[],
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const entry of entries) zip.file(entry.name, entry.blob)
  return zip.generateAsync({ type: 'blob', compression: 'STORE' }, (meta) => {
    onProgress?.(meta.percent)
  })
}

/** A short, callout-styled note used across this batch's panels. */
export function Note({
  children,
  tone = 'muted',
  icon,
}: {
  children: ReactNode
  tone?: 'muted' | 'warning'
  icon?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg bg-muted p-3 text-sm',
        tone === 'warning' ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {icon ? (
        <span className="mt-0.5 shrink-0">{icon}</span>
      ) : tone === 'warning' ? (
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : null}
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

/** Decode an image File into a bitmap, with a `<img>` fallback for Safari. */
export async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      /* fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () =>
        reject(new Error(`“${file.name}” is not an image this browser can decode.`))
      img.src = url
    })
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}

export function imageSize(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if (source instanceof HTMLImageElement)
    return { width: source.naturalWidth, height: source.naturalHeight }
  return { width: source.width, height: source.height }
}

/** Canvas → PNG bytes. Used to normalise mixed image inputs before FFmpeg. */
export async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('This browser refused to encode a frame to PNG.')
  return new Uint8Array(await blob.arrayBuffer())
}
