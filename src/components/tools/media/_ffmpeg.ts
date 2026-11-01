/**
 * Shared FFmpeg (WebAssembly) engine for the Video & Audio tools.
 *
 * This is the ONLY place in the codebase that may call `ffmpeg.load()`. Every
 * video and audio island goes through `getEngine()` / `runFFmpeg()` below.
 *
 * Design notes:
 * - `@ffmpeg/ffmpeg` and `@ffmpeg/util` are imported dynamically, so none of it
 *   lands in the initial page bundle. The first tool that needs it pulls it in.
 * - The core is loaded **same-origin** from `public/ffmpeg/` via the constants in
 *   `@/lib/ffmpeg-core`, converted to blob URLs with `toBlobURL`. Calling
 *   `ffmpeg.load()` without an explicit `coreURL` makes `@ffmpeg/ffmpeg` fetch
 *   ~31 MB from unpkg, which breaks the no-network product promise and is
 *   blocked outright by our CSP (`connect-src 'self' blob: data:`) — so it works
 *   in `astro dev` and dies on the live site. Never do it.
 * - We load the SINGLE-THREADED ESM core (`@ffmpeg/core`, not `core-mt`), so the
 *   page does not need SharedArrayBuffer, COOP or COEP headers.
 * - The ~32 MB core is stored in the Cache Storage API the first time it is
 *   downloaded, so every later run — including offline ones — starts instantly.
 * - One FFmpeg instance is shared by every tool on the site and every job on the
 *   page; jobs are serialised through a small promise queue.
 * - Every await that could hang (download stall, worker that never boots) is
 *   bounded by a watchdog that turns into a readable error instead of a
 *   spinner that never stops.
 */
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import {
  FFMPEG_CORE_BYTES,
  FFMPEG_CORE_JS_BYTES,
  FFMPEG_CORE_MIME,
  FFMPEG_CORE_URL,
  FFMPEG_CORE_VERSION,
  FFMPEG_CORE_WASM_BYTES,
  FFMPEG_FIRST_RUN_NOTICE,
  FFMPEG_WASM_MIME,
  FFMPEG_WASM_URL,
  FFMPEG_WASM_GZ_BYTES,
  fetchCoreWasm,
} from '@/lib/ffmpeg-core'

export const CORE_VERSION = FFMPEG_CORE_VERSION

/** Re-exported so the UI can explain the one-time download in one voice. */
export { FFMPEG_FIRST_RUN_NOTICE }

/** The two same-origin core assets, with byte sizes for a determinate bar. */
const CORE_ASSETS = [
  {
    url: FFMPEG_CORE_URL,
    mime: FFMPEG_CORE_MIME,
    bytes: FFMPEG_CORE_JS_BYTES,
    kind: 'js' as const,
  },
  {
    // Served gzip-compressed (the host caps single files at 25 MiB) and
    // inflated in the page by fetchCoreWasm(); `url` is the cache key.
    url: FFMPEG_WASM_URL,
    mime: FFMPEG_WASM_MIME,
    bytes: FFMPEG_CORE_WASM_BYTES,
    download: FFMPEG_WASM_GZ_BYTES,
    kind: 'wasm' as const,
  },
]

export const ENGINE_TOTAL_BYTES = FFMPEG_CORE_BYTES

const CACHE_NAME = `onthisdevice-ffmpeg-core-${CORE_VERSION}`

/** No progress for this long during the download ⇒ treat it as dead. */
const DOWNLOAD_STALL_MS = 45_000
/** Compiling the wasm and booting the worker should never take this long. */
const ENGINE_START_MS = 120_000

/* ------------------------------------------------------------------ *
 * Engine state (observable so several islands can share one download)
 * ------------------------------------------------------------------ */

export type EngineStage = 'idle' | 'downloading' | 'starting' | 'ready' | 'error'

export interface EngineState {
  stage: EngineStage
  /** Bytes of the core downloaded (or read back from cache) so far. */
  received: number
  total: number
  /** 0-100. */
  percent: number
  /** True when the core came straight out of Cache Storage. */
  fromCache: boolean
  error: string | null
}

let engineState: EngineState = {
  stage: 'idle',
  received: 0,
  total: ENGINE_TOTAL_BYTES,
  percent: 0,
  fromCache: false,
  error: null,
}

type EngineListener = (state: EngineState) => void
const engineListeners = new Set<EngineListener>()

function setEngineState(patch: Partial<EngineState>): void {
  engineState = { ...engineState, ...patch }
  for (const listener of engineListeners) listener(engineState)
}

export function getEngineState(): EngineState {
  return engineState
}

/** Subscribe to engine load progress. Fires immediately with current state. */
export function subscribeEngine(listener: EngineListener): () => void {
  engineListeners.add(listener)
  listener(engineState)
  return () => {
    engineListeners.delete(listener)
  }
}

/* ------------------------------------------------------------------ *
 * Log / progress fan-out
 * ------------------------------------------------------------------ */

type LogListener = (line: string) => void
type FfProgressListener = (progress: number, timeSeconds: number) => void

const logListeners = new Set<LogListener>()
const ffProgressListeners = new Set<FfProgressListener>()

/** Subscribe to raw FFmpeg log lines (stdout + stderr). */
export function onEngineLog(listener: LogListener): () => void {
  logListeners.add(listener)
  return () => {
    logListeners.delete(listener)
  }
}

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

let ffmpegInstance: FFmpeg | null = null
let ffmpegPromise: Promise<FFmpeg> | null = null

export function isEngineReady(): boolean {
  return ffmpegInstance !== null
}

/** True when the WebAssembly core is already sitting in Cache Storage. */
export async function isCorePrefetched(): Promise<boolean> {
  if (ffmpegInstance) return true
  const cache = await openCoreCache()
  if (!cache) return false
  const hits = await Promise.all(CORE_ASSETS.map((asset) => cache.match(asset.url)))
  return hits.every((hit) => hit !== undefined)
}

async function openCoreCache(): Promise<Cache | null> {
  try {
    if (typeof caches === 'undefined') return null
    return await caches.open(CACHE_NAME)
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ *
 * Watchdogs — every await below is bounded, so a dead network or a
 * worker that never boots surfaces as a sentence, not as a spinner.
 * ------------------------------------------------------------------ */

interface Watchdog {
  /** Rejects with `message` once nothing has pinged it for `ms`. */
  readonly expiry: Promise<never>
  ping: () => void
  dispose: () => void
}

function watchdog(ms: number, message: string): Watchdog {
  let timer: ReturnType<typeof setTimeout> | null = null
  let fire: (error: Error) => void = () => {}
  let done = false

  const expiry = new Promise<never>((_resolve, reject) => {
    fire = reject
  })

  const ping = () => {
    if (done) return
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => fire(new Error(message)), ms)
  }

  const dispose = () => {
    done = true
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  ping()
  // Nothing else may observe this promise before `race` does; swallow the
  // rejection so a disposed watchdog cannot log an unhandled rejection.
  expiry.catch(() => {})

  return { expiry, ping, dispose }
}

const TIMEOUT_MESSAGE =
  'Loading the FFmpeg engine timed out. Reload the page and try again. The 10 MB engine is served by this site, ' +
  'so a slow or interrupted connection is the usual cause.'

const MISSING_MESSAGE =
  'The FFmpeg engine files are missing or incomplete on this site, so video and audio tools cannot start. ' +
  'This is a problem with the site itself, not with your file or your browser.'

const START_MESSAGE =
  'The FFmpeg engine downloaded but would not start in this browser. Reload the page; if it keeps happening, ' +
  'try a current version of Chrome, Edge, Firefox or Safari.'

const DOWNLOAD_FAILED_MESSAGE =
  'The FFmpeg engine (10 MB, served by this site) could not be downloaded. Check your connection, or any ' +
  'content blocker or offline mode, and try again. After it is cached, it does not download again.'

/** Messages that are already written for a human and must pass through as-is. */
const KNOWN_MESSAGES = new Set([TIMEOUT_MESSAGE, MISSING_MESSAGE, START_MESSAGE])

/**
 * Guard against a 404 / HTML error page / truncated deploy being handed to the
 * worker, which would otherwise fail deep inside emscripten with no useful text.
 */
async function assertCoreAsset(blob: Blob, asset: (typeof CORE_ASSETS)[number]): Promise<void> {
  if (blob.size < asset.bytes * 0.9) throw new Error(MISSING_MESSAGE)
  if (asset.kind === 'wasm') {
    const magic = new Uint8Array(await blob.slice(0, 4).arrayBuffer())
    // "\0asm"
    if (magic[0] !== 0x00 || magic[1] !== 0x61 || magic[2] !== 0x73 || magic[3] !== 0x6d)
      throw new Error(MISSING_MESSAGE)
  }
}

/**
 * Turn one same-origin core asset into a blob URL, preferring Cache Storage so
 * repeat visits (and offline ones) never touch the network at all.
 */
async function coreAssetUrl(
  asset: (typeof CORE_ASSETS)[number],
  toBlobURL: typeof import('@ffmpeg/util').toBlobURL,
  onDelta: (bytes: number) => void,
): Promise<{ objectUrl: string; fromCache: boolean }> {
  const cache = await openCoreCache()

  if (cache) {
    try {
      const hit = await cache.match(asset.url)
      if (hit) {
        const blob = await hit.blob()
        if (blob.size > 0) {
          await assertCoreAsset(blob, asset)
          onDelta(('download' in asset ? asset.download : undefined) ?? blob.size)
          return { objectUrl: URL.createObjectURL(blob), fromCache: true }
        }
      }
    } catch {
      /* a bad cache entry is not fatal — fall through to the network */
    }
  }

  const guard = watchdog(DOWNLOAD_STALL_MS, TIMEOUT_MESSAGE)
  let objectUrl: string
  try {
    objectUrl = await Promise.race([
      asset.kind === 'wasm'
        ? fetchCoreWasm((delta) => {
            guard.ping()
            if (delta > 0) onDelta(delta)
          }).then((blob) => URL.createObjectURL(blob))
        : // `toBlobURL` is the documented @ffmpeg/util helper: it fetches the
          // file and hands back a blob: URL, which is what
          // `worker-src 'self' blob:` expects. The `true` enables progress.
          toBlobURL(asset.url, asset.mime, true, ({ delta }) => {
            guard.ping()
            if (delta > 0) onDelta(delta)
          }),
      guard.expiry,
    ])
  } catch (error) {
    // A truncated response leaves @ffmpeg/util throwing about a consumed body
    // stream; never show the user that.
    if (error instanceof Error && KNOWN_MESSAGES.has(error.message)) throw error
    throw new Error(DOWNLOAD_FAILED_MESSAGE)
  } finally {
    guard.dispose()
  }

  // Re-read our own blob (no network) to validate it and to seed Cache Storage.
  const blob = await (await fetch(objectUrl)).blob()
  try {
    await assertCoreAsset(blob, asset)
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }

  if (cache) {
    try {
      await cache.put(asset.url, new Response(blob, { headers: { 'content-type': asset.mime } }))
    } catch {
      /* Cache Storage can be unavailable (private mode, quota) — not fatal. */
    }
  }

  return { objectUrl, fromCache: false }
}

async function loadEngine(): Promise<FFmpeg> {
  setEngineState({ stage: 'downloading', received: 0, percent: 0, error: null, fromCache: false })

  let FFmpegClass: typeof FFmpeg
  let toBlobURL: typeof import('@ffmpeg/util').toBlobURL
  try {
    const [ffmpegModule, utilModule] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/util'),
    ])
    FFmpegClass = ffmpegModule.FFmpeg
    toBlobURL = utilModule.toBlobURL
  } catch {
    const message =
      'The FFmpeg module failed to load in this browser. Reload the page; if it keeps happening, try a current version of Chrome, Edge, Firefox or Safari.'
    setEngineState({ stage: 'error', error: message })
    throw new Error(message)
  }

  const objectUrls: string[] = []
  try {
    let received = 0
    let allCached = true

    for (const asset of CORE_ASSETS) {
      const { objectUrl, fromCache } = await coreAssetUrl(asset, toBlobURL, (delta) => {
        received += delta
        setEngineState({
          stage: 'downloading',
          received,
          percent: Math.min(99, (received / ENGINE_TOTAL_BYTES) * 100),
        })
      })
      if (!fromCache) allCached = false
      objectUrls.push(objectUrl)
    }

    setEngineState({
      stage: 'starting',
      percent: 100,
      received: ENGINE_TOTAL_BYTES,
      fromCache: allCached,
    })

    const ffmpeg = new FFmpegClass()
    ffmpeg.on('log', ({ message }) => {
      for (const listener of logListeners) listener(message)
    })
    ffmpeg.on('progress', ({ progress, time }) => {
      for (const listener of ffProgressListeners) listener(progress, time / 1_000_000)
    })

    // coreURL/wasmURL are MANDATORY. `@ffmpeg/ffmpeg`'s worker falls back to a
    // hardcoded unpkg URL the instant either one is missing, which breaks the
    // no-network promise and is blocked by our CSP. Assert rather than trust:
    // this is the only ffmpeg.load() in the repo and it must stay airtight.
    const [coreURL, wasmURL] = objectUrls
    if (!coreURL?.startsWith('blob:') || !wasmURL?.startsWith('blob:'))
      throw new Error(MISSING_MESSAGE)

    const boot = watchdog(ENGINE_START_MS, START_MESSAGE)
    try {
      await Promise.race([ffmpeg.load({ coreURL, wasmURL }), boot.expiry])
    } catch (error) {
      // The worker may still be spinning on a half-instantiated core.
      try {
        ffmpeg.terminate()
      } catch {
        /* nothing to tear down */
      }
      throw error
    } finally {
      boot.dispose()
    }

    ffmpegInstance = ffmpeg
    setEngineState({ stage: 'ready', percent: 100, error: null })
    return ffmpeg
  } catch (error) {
    const message =
      error instanceof Error && error.message ? error.message : `${START_MESSAGE} (unknown error)`
    setEngineState({ stage: 'error', error: message })
    throw error instanceof Error ? error : new Error(message)
  } finally {
    // Safe once load() has settled: the core module and the wasm binary have
    // both been read by then, and on failure they are not needed at all.
    for (const url of objectUrls) URL.revokeObjectURL(url)
  }
}

/** Get the shared FFmpeg instance, downloading and starting the core if needed. */
export async function getEngine(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  if (!ffmpegPromise) {
    ffmpegPromise = loadEngine().catch((error: unknown) => {
      ffmpegPromise = null
      throw error
    })
  }
  return ffmpegPromise
}

/** Kill the worker (used to cancel a running job). The core reloads from cache. */
export function terminateEngine(): void {
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate()
    } catch {
      /* already gone */
    }
  }
  ffmpegInstance = null
  ffmpegPromise = null
  setEngineState({ stage: 'idle', received: 0, percent: 0, error: null })
}

/* ------------------------------------------------------------------ *
 * Time helpers
 * ------------------------------------------------------------------ */

/** 75.25 -> "1:15.2" ; 3675 -> "1:01:15.0" */
export function formatTimecode(seconds: number, decimals = 1): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const s = secs.toFixed(decimals).padStart(decimals > 0 ? 3 + decimals : 2, '0')
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${s}`
  return `${mins}:${s}`
}

/** 75.25 -> "00:01:15.250" (the form FFmpeg's -ss / -to want). */
export function toFFmpegTime(seconds: number): string {
  const safe = Math.max(0, seconds)
  const hrs = Math.floor(safe / 3600)
  const mins = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${secs
    .toFixed(3)
    .padStart(6, '0')}`
}

/** "1:15.25" | "01:01:15" | "75.25" -> seconds, or null when unparseable. */
export function parseTimecode(input: string): number | null {
  const text = input.trim()
  if (!text) return null
  const parts = text.split(':')
  if (parts.length > 3) return null
  let seconds = 0
  for (const part of parts) {
    if (!/^\d*\.?\d*$/.test(part) || part === '' || part === '.') return null
    seconds = seconds * 60 + Number(part)
  }
  return Number.isFinite(seconds) ? seconds : null
}

const LOG_TIME_RE = /time=\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/
const LOG_DURATION_RE = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/

function readLogTime(line: string, re: RegExp): number | null {
  const match = re.exec(line)
  if (!match) return null
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

/* ------------------------------------------------------------------ *
 * Media probing (browser first, FFmpeg as a fallback)
 * ------------------------------------------------------------------ */

export interface MediaInfo {
  /** Seconds, or 0 when the browser could not decode the container. */
  duration: number
  width: number
  height: number
  /** The browser can play this file in a <video>/<audio> element. */
  playable: boolean
}

/** Read duration/dimensions with a hidden media element — free and instant. */
export function probeMedia(file: File, kind: 'video' | 'audio' = 'video'): Promise<MediaInfo> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement(kind === 'video' ? 'video' : 'audio')
    let settled = false

    const finish = (info: MediaInfo) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      el.removeAttribute('src')
      el.load()
      URL.revokeObjectURL(url)
      resolve(info)
    }

    const timer = setTimeout(
      () => finish({ duration: 0, width: 0, height: 0, playable: false }),
      8000,
    )

    el.preload = 'metadata'
    el.muted = true
    el.onloadedmetadata = () => {
      const video = el instanceof HTMLVideoElement ? el : null
      const duration = Number.isFinite(el.duration) ? el.duration : 0
      finish({
        duration,
        width: video?.videoWidth ?? 0,
        height: video?.videoHeight ?? 0,
        playable: duration > 0,
      })
    }
    el.onerror = () => finish({ duration: 0, width: 0, height: 0, playable: false })
    el.src = url
  })
}

export interface EngineProbe {
  duration: number
  videoCodec: string | null
  audioCodec: string | null
  audioSampleRate: number | null
  audioChannels: string | null
  width: number
  height: number
}

const AUDIO_STREAM_RE = /Audio:\s*([a-z0-9_]+)/i
const VIDEO_STREAM_RE = /Video:\s*([a-z0-9_]+)/i
const SIZE_RE = /,\s*(\d{2,5})x(\d{2,5})/
const SAMPLE_RATE_RE = /(\d{4,6})\s*Hz/
const CHANNELS_RE = /Hz,\s*(mono|stereo|[0-9.]+\(?[a-z]*\)?)/i

/**
 * Ask FFmpeg itself about a file (duration, codecs, size). Used when the browser
 * cannot decode the container (MKV, AVI, some MOV files) and by the
 * stream-copy tools that need to know the source codec. Reads the header only.
 */
export function probeWithEngine(file: File): Promise<EngineProbe> {
  return enqueue(async () => {
    const ffmpeg = await getEngine()
    const name = inputName(file, 'probe')
    const result: EngineProbe = {
      duration: 0,
      videoCodec: null,
      audioCodec: null,
      audioSampleRate: null,
      audioChannels: null,
      width: 0,
      height: 0,
    }

    const off = onEngineLog((line) => {
      const duration = readLogTime(line, LOG_DURATION_RE)
      if (duration !== null && duration > result.duration) result.duration = duration

      if (/Stream #\d+:\d+.*Audio:/i.test(line)) {
        result.audioCodec ??= AUDIO_STREAM_RE.exec(line)?.[1]?.toLowerCase() ?? null
        const rate = SAMPLE_RATE_RE.exec(line)?.[1]
        if (rate && result.audioSampleRate === null) result.audioSampleRate = Number(rate)
        const channels = CHANNELS_RE.exec(line)?.[1]
        if (channels && result.audioChannels === null) result.audioChannels = channels
      }

      if (/Stream #\d+:\d+.*Video:/i.test(line)) {
        result.videoCodec ??= VIDEO_STREAM_RE.exec(line)?.[1]?.toLowerCase() ?? null
        const size = SIZE_RE.exec(line)
        if (size && result.width === 0) {
          result.width = Number(size[1])
          result.height = Number(size[2])
        }
      }
    })

    try {
      await ffmpeg.writeFile(name, new Uint8Array(await file.arrayBuffer()))
      try {
        // ffprobe prints the same header block and exits cleanly.
        await ffmpeg.ffprobe(['-hide_banner', name])
      } catch {
        /* some cores ship without ffprobe — fall through */
      }
      if (result.duration === 0 && !result.audioCodec && !result.videoCodec) {
        // `ffmpeg -i file` with no output exits non-zero but prints the header info.
        await ffmpeg.exec(['-hide_banner', '-i', name])
      }
    } catch {
      /* the non-zero exit is expected */
    } finally {
      off()
      try {
        await ffmpeg.deleteFile(name)
      } catch {
        /* nothing to clean up */
      }
    }

    return result
  })
}

/** Duration in seconds, read with FFmpeg. 0 when it could not be determined. */
export async function probeDurationWithEngine(file: File): Promise<number> {
  return (await probeWithEngine(file)).duration
}

/* ------------------------------------------------------------------ *
 * Job runner
 * ------------------------------------------------------------------ */

export interface JobInput {
  /** Filename inside the virtual FS, e.g. "input.mp4". */
  name: string
  data: File | Blob | Uint8Array
}

export interface RunOptions {
  inputs: JobInput[]
  /** One or more argv arrays, run in order (two-pass encodes need two). */
  commands: string[][]
  /** File the result is read back from. */
  output: string
  /** MIME type for the returned Blob. */
  mime: string
  /** Expected duration of the OUTPUT in seconds — drives determinate progress. */
  durationSec?: number
  /** Extra virtual-FS files to delete afterwards (e.g. a GIF palette). */
  temps?: string[]
  onProgress?: (percent: number) => void
  onLog?: (line: string) => void
}

export interface JobOutcome {
  blob: Blob
  /** Duration FFmpeg reported for the input, when it printed one. */
  sourceDuration: number
}

/** Thrown when the user cancels a running job (the worker is torn down). */
export class JobCancelledError extends Error {
  constructor() {
    super('Job cancelled')
    this.name = 'JobCancelledError'
  }
}

let queue: Promise<unknown> = Promise.resolve()

/** Serialise jobs — there is a single FFmpeg worker behind all of this. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/** A safe virtual-FS filename that keeps the original extension. */
export function inputName(file: File, prefix = 'input'): string {
  const dot = file.name.lastIndexOf('.')
  const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  return ext ? `${prefix}.${ext}` : `${prefix}.bin`
}

function humanizeFfmpegError(lines: string[], exitCode: number | null): string {
  const text = lines.join('\n')

  if (/Invalid data found when processing input/i.test(text))
    return 'FFmpeg could not read that file. It may be corrupt, incomplete, or a container this build does not support. Try a different source file.'
  if (/moov atom not found/i.test(text))
    return 'This MP4 is missing its index (the "moov atom"), which usually means the recording or download was cut short. FFmpeg cannot read it.'
  if (/Unknown encoder|Encoder .* not found|Unrecognized option/i.test(text))
    return 'That combination of format and codec is not available in this FFmpeg build. Try another output format.'
  if (/matches no streams/i.test(text))
    return 'This file does not contain the track you asked for. Most likely it is a video with no audio.'
  if (/does not contain any stream|Output file (is|does not contain any) /i.test(text))
    return 'The result came out empty. The input may not contain the track you asked for (for example, a video with no audio).'
  if (/No such file or directory/i.test(text))
    return 'FFmpeg could not find the input file. Reload the page and pick the file again.'
  // A wasm trap is an engine crash, not proof that the file is big.
  if (/memory access out of bounds|unreachable|RuntimeError/i.test(text))
    return 'The FFmpeg engine crashed on this file. Try again, pick another output format, or use a shorter clip.'
  if (/Cannot enlarge memory|out of memory|OOM|Failed to allocate|Cannot allocate memory/i.test(text))
    return 'The browser ran out of memory for this job (WebAssembly is capped at 2 GB). Try a shorter clip or a smaller resolution.'
  if (/Conversion failed/i.test(text)) {
    const detail = lines.filter((l) => l.trim()).slice(-3, -1).join(' ').slice(0, 220)
    return `FFmpeg could not finish the conversion.${detail ? ` It reported: ${detail}` : ''}`
  }

  const last = [...lines].reverse().find((l) => l.trim().length > 0)
  return last
    ? `FFmpeg stopped with an error: ${last.slice(0, 220)}`
    : `FFmpeg stopped with exit code ${exitCode ?? 'unknown'}.`
}

/** Write inputs, run the commands, read the output back as a Blob. */
export function runFFmpeg(options: RunOptions): Promise<JobOutcome> {
  return enqueue(async () => {
    const ffmpeg = await getEngine()
    const recent: string[] = []
    let sourceDuration = 0
    let lastPercent = 0
    let commandIndex = 0
    const commandCount = Math.max(1, options.commands.length)

    const report = (fraction: number) => {
      const overall = ((commandIndex + Math.min(1, Math.max(0, fraction))) / commandCount) * 100
      if (overall > lastPercent) {
        lastPercent = overall
        options.onProgress?.(Math.min(99.5, overall))
      }
    }

    const offLog = onEngineLog((line) => {
      recent.push(line)
      if (recent.length > 60) recent.shift()
      options.onLog?.(line)

      const dur = readLogTime(line, LOG_DURATION_RE)
      if (dur !== null && dur > sourceDuration) sourceDuration = dur

      const at = readLogTime(line, LOG_TIME_RE)
      const total = options.durationSec && options.durationSec > 0 ? options.durationSec : 0
      if (at !== null && total > 0) report(at / total)
    })

    const onFfProgress: FfProgressListener = (progress) => {
      if (!options.durationSec && progress > 0 && progress <= 1) report(progress)
    }
    ffProgressListeners.add(onFfProgress)

    const cleanup = async () => {
      for (const name of [
        ...options.inputs.map((i) => i.name),
        options.output,
        ...(options.temps ?? []),
      ]) {
        try {
          await ffmpeg.deleteFile(name)
        } catch {
          /* file may never have been created */
        }
      }
    }

    try {
      for (const input of options.inputs) {
        const data =
          input.data instanceof Uint8Array
            ? input.data
            : new Uint8Array(await input.data.arrayBuffer())
        await ffmpeg.writeFile(input.name, data)
      }

      for (let i = 0; i < options.commands.length; i += 1) {
        commandIndex = i
        const args = options.commands[i] ?? []
        let code: number
        try {
          code = await ffmpeg.exec(args)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (/terminate/i.test(message)) throw new JobCancelledError()
          // The worker died (usually memory). Force a fresh core next time.
          terminateEngine()
          throw new Error(humanizeFfmpegError([...recent, message], null))
        }
        if (code !== 0) {
          // After an abort or a failed allocation the heap is not trustworthy.
          if (recent.some((line) => /Aborted\(|Out of memory|Failed to allocate/i.test(line)))
            terminateEngine()
          throw new Error(humanizeFfmpegError(recent, code))
        }
      }

      const data = await ffmpeg.readFile(options.output)
      if (typeof data === 'string' || data.byteLength === 0)
        throw new Error(humanizeFfmpegError(recent, 0))

      // `readFile` already hands back a standalone copy, so a view over the same
      // bytes goes straight into the Blob — no second allocation for what may be
      // hundreds of megabytes.
      const view = new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength)
      options.onProgress?.(100)
      return { blob: new Blob([view], { type: options.mime }), sourceDuration }
    } finally {
      offLog()
      ffProgressListeners.delete(onFfProgress)
      if (isEngineReady()) await cleanup()
    }
  })
}

/* ------------------------------------------------------------------ *
 * Small shared bits of ffmpeg-argument building
 * ------------------------------------------------------------------ */

/** Even dimensions — H.264 and VP9 both reject odd width/height. */
export function evenNumber(value: number): number {
  const n = Math.round(value)
  return n % 2 === 0 ? n : n - 1
}

/** Rough size estimate in bytes for a given bitrate and duration. */
export function estimateSize(totalKbps: number, durationSec: number): number {
  return (totalKbps * 1000 * durationSec) / 8
}

export const X264_PRESETS = [
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
] as const

export type X264Preset = (typeof X264_PRESETS)[number]
