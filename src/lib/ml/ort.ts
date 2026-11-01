/**
 * Shared ONNX Runtime for the on-device models (CPU, WebAssembly).
 *
 *   ORT_FILES                        runtime files on this site (/ort/<version>/...)
 *   loadOrt(onProgress?)             the `onnxruntime-web` module, configured once
 *   createSession(model, opts?)      an InferenceSession from a model path in
 *                                    manifest.json; the runtime and the model come
 *                                    through assets.ts (Cache Storage, progress)
 *   sessionRunner(ort, session)      adapts a session to the `Runner` that the
 *                                    detectors in ./vision take
 *   modelWire(models)                bytes the first run downloads, for "Downloads N MB once"
 *
 * Call these from a Web Worker; a session run blocks the thread it runs on.
 * The runtime uses one thread: the site sends no COOP/COEP headers, so there
 * is no SharedArrayBuffer. The JS glue and the wasm are read from Cache Storage
 * and handed to ORT as a blob URL and bytes, so ORT never fetches them itself
 * and the tools work offline after the first run.
 *
 * ORT is imported from its "extern wasm" build by file path (a glob, which
 * gives it a type): the default package entry embeds a
 * `new URL('*.wasm', import.meta.url)` that makes the bundler copy a second
 * 13 MB wasm into /_astro/.
 */
import type * as OrtTypes from 'onnxruntime-web'
import { loadFile, wireBytes } from './assets'
import type { Progress } from './assets'
import type { Outputs, Runner } from './vision/runner'

export type Ort = typeof OrtTypes
export type InferenceSession = OrtTypes.InferenceSession

export const ORT_VERSION = '1.31.1'
const BASE = `/ort/${ORT_VERSION}`
const GLUE = `${BASE}/ort-wasm-simd-threaded.mjs`
const WASM = `${BASE}/ort-wasm-simd-threaded.wasm`
export const ORT_FILES = [GLUE, WASM]

/** Bytes the first run downloads for these models plus the runtime. */
export function modelWire(models: string[]): number {
  return wireBytes([...ORT_FILES, ...models])
}

let ortJob: Promise<Ort> | null = null

/** Combines progress of several downloads into one callback. */
function progressSplitter(paths: string[], onProgress?: Progress) {
  const total = wireBytes(paths)
  const seen = new Map<string, number>()
  return (path: string): Progress =>
    (loaded) => {
      seen.set(path, loaded)
      const sum = [...seen.values()].reduce((a, b) => a + b, 0)
      onProgress?.(Math.min(sum, total), total)
    }
}

const ORT_JS = import.meta.glob('/node_modules/onnxruntime-web/dist/ort.wasm.min.mjs', { exhaustive: true })

async function bootOrt(track: (path: string) => Progress): Promise<Ort> {
  const importOrt = Object.values(ORT_JS)[0]
  if (!importOrt) throw new Error('The ONNX runtime is missing from this build.')
  const [mod, glue, wasm] = await Promise.all([
    importOrt(),
    loadFile(GLUE, track(GLUE)),
    loadFile(WASM, track(WASM)),
  ])
  const ort = mod as Ort
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
  ort.env.wasm.wasmBinary = wasm
  ort.env.wasm.wasmPaths = { mjs: URL.createObjectURL(new Blob([glue], { type: 'text/javascript' })) }
  ort.env.logLevel = 'error'
  return ort
}

function startOrt(track: (path: string) => Progress): Promise<Ort> {
  if (!ortJob) {
    const job = bootOrt(track)
    ortJob = job
    job.catch(() => {
      if (ortJob === job) ortJob = null
    })
  }
  return ortJob
}

/** The runtime module. The first call downloads about 14 MB once. */
export function loadOrt(onProgress?: Progress): Promise<Ort> {
  return startOrt(progressSplitter(ORT_FILES, onProgress))
}

const sessions = new Map<string, Promise<InferenceSession>>()

/**
 * One session per model path, created once per thread. `onProgress` covers
 * the runtime (when not loaded yet) and the model together.
 */
export function createSession(model: string, opts: { onProgress?: Progress } = {}): Promise<InferenceSession> {
  const existing = sessions.get(model)
  if (existing) return existing
  const track = progressSplitter(ortJob ? [model] : [...ORT_FILES, model], opts.onProgress)
  const job = (async () => {
    const [ort, bytes] = await Promise.all([startOrt(track), loadFile(model, track(model))])
    return ort.InferenceSession.create(new Uint8Array(bytes), {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    })
  })()
  sessions.set(model, job)
  job.catch(() => sessions.delete(model))
  return job
}

/** Wraps a session as a detector `Runner`. */
export function sessionRunner(ort: Ort, session: InferenceSession): Runner {
  return async (feeds) => {
    const input: Record<string, OrtTypes.Tensor> = {}
    for (const [name, f] of Object.entries(feeds)) input[name] = new ort.Tensor(f.type, f.data, f.dims)
    const out = await session.run(input)
    const result: Outputs = {}
    for (const [name, t] of Object.entries(out)) {
      result[name] = { data: t.data as Outputs[string]['data'], dims: t.dims }
    }
    for (const t of Object.values(input)) t.dispose()
    return result
  }
}
