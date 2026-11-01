/**
 * Model and engine files for the on-device detectors.
 *
 * They are static files on this site under /models/ (and /ort/, /ocr/), never
 * fetched from another host: the CSP allows connect-src 'self' only. The host
 * serves no single file over 25 MiB, so `scripts/vendor-models.mjs` writes a
 * larger file either gzip-compressed (`<path>.gz`) or as numbered parts
 * (`<path>.part0`, `<path>.part1`, ...) and records that in manifest.json.
 * This module joins or inflates them in the page.
 *
 * Every loaded file is kept in Cache Storage under its logical path, so it
 * downloads once and the tools keep working offline.
 */
import manifest from './manifest.json'

export interface StoredFile {
  /** Bytes of the logical (joined, inflated) file. */
  bytes: number
  /** Bytes on the wire: the sum of the parts or the size of the .gz. */
  wire: number
  /** Number of `.partN` files; absent for a single file. */
  parts?: number
  /** Served as `<path>.gz` and inflated in the page. */
  gzip?: boolean
}

/** Keyed by logical path, for example "/models/yunet/face_detection_yunet.onnx". */
const FILES = manifest as Record<string, StoredFile>

const CACHE = 'otd-models-v1'

export type Progress = (loaded: number, total: number) => void

export function fileInfo(path: string): StoredFile | undefined {
  return FILES[path]
}

/** Bytes that `paths` will download, for "Downloads 12 MB once" notes. */
export function wireBytes(paths: string[]): number {
  return paths.reduce((sum, p) => sum + (FILES[p]?.wire ?? 0), 0)
}

async function readAll(res: Response, onChunk: (n: number) => void): Promise<Uint8Array> {
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer())
    onChunk(buf.byteLength)
    return buf
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.byteLength
    onChunk(value.byteLength)
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.byteLength
  }
  return out
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status}). Check your connection and try again.`)
  return res
}

async function download(path: string, info: StoredFile | undefined, onChunk: (n: number) => void): Promise<Uint8Array> {
  if (info?.gzip) {
    const res = await get(`${path}.gz`)
    const counted = res.body!.pipeThrough(
      new TransformStream<Uint8Array<ArrayBuffer>, BufferSource>({
        transform(chunk, ctl) {
          onChunk(chunk.byteLength)
          ctl.enqueue(chunk)
        },
      }),
    )
    // A server that sends the .gz with Content-Encoding: gzip (the dev server) has inflated it already.
    if (/gzip/i.test(res.headers.get('Content-Encoding') ?? '')) return new Uint8Array(await new Response(counted).arrayBuffer())
    const inflated = new Response(counted.pipeThrough(new DecompressionStream('gzip')))
    return new Uint8Array(await inflated.arrayBuffer())
  }
  if (info?.parts) {
    const pieces: Uint8Array[] = []
    for (let i = 0; i < info.parts; i++) pieces.push(await readAll(await get(`${path}.part${i}`), onChunk))
    const out = new Uint8Array(info.bytes)
    let at = 0
    for (const p of pieces) {
      out.set(p, at)
      at += p.byteLength
    }
    return out
  }
  return readAll(await get(path), onChunk)
}

const inflight = new Map<string, Promise<ArrayBuffer>>()

/**
 * Returns the bytes of one logical file, from Cache Storage when present.
 * Concurrent calls for the same path share one download.
 */
export function loadFile(path: string, onProgress?: Progress): Promise<ArrayBuffer> {
  const running = inflight.get(path)
  if (running) return running
  const job = (async () => {
    const info = FILES[path]
    const cache = 'caches' in globalThis ? await caches.open(CACHE).catch(() => null) : null
    const hit = await cache?.match(path)
    if (hit) {
      const buf = await hit.arrayBuffer()
      onProgress?.(info?.wire ?? buf.byteLength, info?.wire ?? buf.byteLength)
      return buf
    }
    const total = info?.wire ?? 0
    let loaded = 0
    const bytes = await download(path, info, (n) => {
      loaded += n
      onProgress?.(loaded, Math.max(total, loaded))
    })
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    await cache?.put(path, new Response(buf.slice(0), { headers: { 'Content-Length': String(buf.byteLength) } })).catch(() => {})
    return buf
  })()
  inflight.set(path, job)
  job.finally(() => inflight.delete(path))
  return job
}

/** Loads several files with one combined progress callback. */
export async function loadFiles(paths: string[], onProgress?: Progress): Promise<ArrayBuffer[]> {
  const total = wireBytes(paths)
  const done = new Map<string, number>()
  const report = () => {
    const loaded = [...done.values()].reduce((a, b) => a + b, 0)
    onProgress?.(loaded, Math.max(total, loaded))
  }
  return Promise.all(
    paths.map((p) =>
      loadFile(p, (n) => {
        done.set(p, n)
        report()
      }),
    ),
  )
}

/** True when every path is already in Cache Storage (no download needed). */
export async function isCached(paths: string[]): Promise<boolean> {
  if (!('caches' in globalThis)) return false
  const cache = await caches.open(CACHE)
  const hits = await Promise.all(paths.map((p) => cache.match(p)))
  return hits.every(Boolean)
}

/**
 * Cache adapter for libraries that fetch files by URL (transformers.js
 * `env.customCache`): answers from Cache Storage, and joins or inflates split
 * files that a plain fetch of the logical path would miss.
 */
export const modelCache = {
  async match(request: string | Request): Promise<Response | undefined> {
    const url = new URL(typeof request === 'string' ? request : request.url, location.origin)
    if (url.origin !== location.origin) return undefined
    const info = FILES[url.pathname]
    if (info?.gzip || info?.parts) return new Response(await loadFile(url.pathname))
    const cache = await caches.open(CACHE)
    return (await cache.match(url.pathname)) ?? undefined
  },
  async put(request: string | Request, response: Response): Promise<void> {
    const url = new URL(typeof request === 'string' ? request : request.url, location.origin)
    if (url.origin !== location.origin) return
    const cache = await caches.open(CACHE)
    await cache.put(url.pathname, response)
  },
}
