/**
 * Self-hosted FFmpeg WebAssembly core.
 *
 * `@ffmpeg/ffmpeg` defaults to fetching its core from a public CDN (unpkg) at
 * first use. That would break two of our guarantees at once:
 *
 *   1. The product promise — "nothing leaves your device" is false if the page
 *      calls out to a third-party CDN the moment you open a video tool.
 *   2. Our own Content-Security-Policy — `connect-src 'self' blob: data:` has no
 *      third-party origin in it, so the CDN fetch is blocked and every media
 *      tool fails in production while working fine in `astro dev`.
 *
 * So the core is vendored into `public/ffmpeg/` and loaded same-origin. Always
 * pass these URLs to `ffmpeg.load()`:
 *
 * ```ts
 * import { FFmpeg } from '@ffmpeg/ffmpeg'
 * import { toBlobURL } from '@ffmpeg/util'
 * import { FFMPEG_CORE_URL, FFMPEG_WASM_URL } from '@/lib/ffmpeg-core'
 *
 * const ffmpeg = new FFmpeg()
 * await ffmpeg.load({
 *   coreURL: await toBlobURL(FFMPEG_CORE_URL, 'text/javascript'),
 *   wasmURL: await toBlobURL(FFMPEG_WASM_URL, 'application/wasm'),
 * })
 * ```
 *
 * In practice nothing should call `ffmpeg.load()` directly: use the single
 * shared engine in `src/components/tools/media/_ffmpeg.ts`, which implements
 * exactly the above plus caching, progress and error handling. Leaving
 * `coreURL` off — anywhere, ever — silently reintroduces the unpkg fetch.
 *
 * `toBlobURL` is required because the core instantiates itself inside a worker,
 * and a blob: worker is what our `worker-src 'self' blob:` policy expects.
 *
 * WHICH BUILD IS VENDORED — this matters and is easy to get wrong.
 * `@ffmpeg/core` ships a `umd/` and an `esm/` build, and `public/ffmpeg/` holds
 * the **esm** one. `FFmpeg.load()` always constructs its worker with
 * `{ type: 'module' }`; `importScripts()` is not available in a module worker,
 * so the worker's first branch throws and it falls back to
 * `(await import(coreURL)).default`. The UMD build has no default export, so
 * vendoring it fails at load with a bare `ERROR_IMPORT_FAILURE`. The ESM build
 * works under both worker types. The two builds ship a byte-identical
 * `ffmpeg-core.wasm`; only the `.js` differs.
 *
 * This is the single-threaded core: no SharedArrayBuffer, so the site does not
 * need COOP/COEP cross-origin isolation. See public/_headers.
 *
 * SIZE LIMIT. The host serves no single static file over 25 MiB, and the
 * wasm binary is ~32 MB, so it ships gzip-compressed as
 * `/ffmpeg/<version>/ffmpeg-core.wasm.gz` (~10 MB) and `fetchCoreWasm()` below inflates
 * it in the page with the browser's own DecompressionStream before ffmpeg is
 * given a blob: URL. Nothing leaves this origin. `FFMPEG_WASM_URL` stays the
 * logical name (the Cache Storage key for the inflated binary); it is never
 * requested from the server.
 *
 * To re-vendor after a dependency bump:
 *   node scripts/vendor-ffmpeg.mjs
 * then update FFMPEG_CORE_VERSION and the byte counts below.
 */

/** Version of `@ffmpeg/core` vendored into `public/ffmpeg/<version>/`. */
export const FFMPEG_CORE_VERSION = '0.12.10'

export const FFMPEG_CORE_URL = `/ffmpeg/${FFMPEG_CORE_VERSION}/ffmpeg-core.js`
export const FFMPEG_WASM_URL = `/ffmpeg/${FFMPEG_CORE_VERSION}/ffmpeg-core.wasm`
/** What is actually served: the same binary, gzip-compressed. */
export const FFMPEG_WASM_GZ_URL = `/ffmpeg/${FFMPEG_CORE_VERSION}/ffmpeg-core.wasm.gz`

/** MIME types the blob URLs must carry for the worker to accept them. */
export const FFMPEG_CORE_MIME = 'text/javascript'
export const FFMPEG_WASM_MIME = 'application/wasm'


/** Exact byte sizes of the vendored files, for a determinate progress bar. */
export const FFMPEG_CORE_JS_BYTES = 111_804
export const FFMPEG_CORE_WASM_BYTES = 32_232_419
/** Bytes on the wire for the compressed wasm. */
export const FFMPEG_WASM_GZ_BYTES = 10_257_774

/** Download size of the core, for honest first-run messaging and progress. */
export const FFMPEG_CORE_BYTES = FFMPEG_CORE_JS_BYTES + FFMPEG_WASM_GZ_BYTES

/**
 * Fetch the compressed core from this origin, report compressed bytes as they
 * arrive, and inflate it in the page. Also accepts an uncompressed response
 * (a host that decodes `.gz` itself), detected by the wasm magic number.
 */
export async function fetchCoreWasm(onDelta: (bytes: number) => void, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(FFMPEG_WASM_GZ_URL, { signal, cache: 'force-cache' })
  if (!res.ok || !res.body) throw new Error(`core download failed (HTTP ${res.status})`)
  const reader = res.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value as Uint8Array<ArrayBuffer>)
      onDelta(value.byteLength)
    }
  }
  const packed = new Blob(chunks)
  const head = new Uint8Array(await packed.slice(0, 4).arrayBuffer())
  if (head[0] === 0x00 && head[1] === 0x61 && head[2] === 0x73 && head[3] === 0x6d) {
    return new Blob([packed], { type: FFMPEG_WASM_MIME })
  }
  if (head[0] !== 0x1f || head[1] !== 0x8b) throw new Error('core download is not a gzip stream')
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot unpack the video engine (no DecompressionStream). Update the browser and try again.')
  }
  const inflated = await new Response(packed.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
  return new Blob([inflated], { type: FFMPEG_WASM_MIME })
}

/**
 * Copy for the first-run notice. After this download the core is in the HTTP
 * cache (immutable, 1 year — see public/_headers) and every later run is
 * instant and fully offline.
 */
export const FFMPEG_FIRST_RUN_NOTICE =
  'First use downloads the 10 MB video engine from this site. After that it is cached and works offline.'
