/**
 * ONNX Runtime for the AI tools, on the backend that ./backend.ts picked.
 *
 *   runtimeFiles(backend)                  runtime files on this site, for download sizes
 *   loadRuntime(backend, onProgress?)      the `onnxruntime-web` module, configured once
 *   openSession(path, backend, opts?)      an InferenceSession for a model in manifest.json
 *
 * The WebAssembly backend is the shared runtime of ../ort.ts. The WebGPU backend is the
 * WebGPU build of the same version, whose WebAssembly part (7 MB on the wire) is a second file.
 * Both read their files through ../assets.ts (Cache Storage, progress), so ORT fetches
 * nothing itself. Call these from a Web Worker.
 */
import type * as OrtTypes from 'onnxruntime-web'
import { loadFile, wireBytes } from '../assets'
import type { Progress } from '../assets'
import { ORT_FILES, ORT_VERSION, loadOrt } from '../ort'
import type { Ort } from '../ort'
import type { Backend } from './backend'

export type { Ort }
export type Session = OrtTypes.InferenceSession

const BASE = `/ort/${ORT_VERSION}`
const GPU_GLUE = `${BASE}/ort-wasm-simd-threaded.asyncify.mjs`
const GPU_WASM = `${BASE}/ort-wasm-simd-threaded.asyncify.wasm`

export function runtimeFiles(backend: Backend): string[] {
  return backend === 'webgpu' ? [GPU_GLUE, GPU_WASM] : ORT_FILES
}

/** Splits one progress callback over several files. */
export function progressOver(paths: string[], onProgress?: Progress): (path: string) => Progress {
  const total = wireBytes(paths)
  const seen = new Map<string, number>()
  return (path) => (loaded) => {
    seen.set(path, loaded)
    const sum = [...seen.values()].reduce((a, b) => a + b, 0)
    onProgress?.(Math.min(sum, total), total)
  }
}

const GPU_JS = import.meta.glob('/node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs', { exhaustive: true })
let gpuJob: Promise<Ort> | null = null

/** Limits the runtime may need above the defaults, raised to what the adapter allows. */
const LIMITS = [
  'maxStorageBuffersPerShaderStage',
  'maxStorageBufferBindingSize',
  'maxBufferSize',
  'maxComputeWorkgroupStorageSize',
  'maxComputeInvocationsPerWorkgroup',
  'maxComputeWorkgroupSizeX',
  'maxComputeWorkgroupSizeY',
  'maxComputeWorkgroupSizeZ',
  'maxComputeWorkgroupsPerDimension',
] as const

/**
 * A device with the adapter's own limits. The default device allows 8 to 10 storage buffers per
 * shader, and some layers of the larger models need more.
 */
async function gpuDevice(): Promise<GPUDevice> {
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) throw new Error('WebGPU has no adapter.')
  const requiredLimits: Record<string, number> = {}
  for (const name of LIMITS) requiredLimits[name] = adapter.limits[name]
  const requiredFeatures = (['shader-f16'] as const).filter((f) => adapter.features.has(f))
  return adapter.requestDevice({ requiredLimits, requiredFeatures })
}

async function bootGpu(onProgress?: Progress): Promise<Ort> {
  const importOrt = Object.values(GPU_JS)[0]
  if (!importOrt) throw new Error('The WebGPU runtime is missing from this build.')
  const track = progressOver([GPU_GLUE, GPU_WASM], onProgress)
  const [mod, glue, wasm] = await Promise.all([importOrt(), loadFile(GPU_GLUE, track(GPU_GLUE)), loadFile(GPU_WASM, track(GPU_WASM))])
  const ort = mod as Ort
  ort.env.webgpu.device = await gpuDevice()
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
  ort.env.wasm.wasmBinary = wasm
  ort.env.wasm.wasmPaths = { mjs: URL.createObjectURL(new Blob([glue], { type: 'text/javascript' })) }
  ort.env.logLevel = 'error'
  return ort
}

export function loadRuntime(backend: Backend, onProgress?: Progress): Promise<Ort> {
  if (backend === 'wasm') return loadOrt(onProgress)
  if (!gpuJob) {
    const job = bootGpu(onProgress)
    gpuJob = job
    job.catch(() => {
      if (gpuJob === job) gpuJob = null
    })
  }
  return gpuJob
}

const sessions = new Map<string, Promise<Session>>()

/**
 * One session per model and backend, created once per worker. `onProgress` covers the
 * runtime and the model together.
 */
export function openSession(path: string, backend: Backend, opts: { onProgress?: Progress } = {}): Promise<Session> {
  const key = `${backend}:${path}`
  const existing = sessions.get(key)
  if (existing) return existing
  const files = [...runtimeFiles(backend), path]
  const track = progressOver(files, opts.onProgress)
  const job = (async () => {
    let runtimeLoaded = 0
    const runtimeTotal = wireBytes(runtimeFiles(backend))
    const [ort, bytes] = await Promise.all([
      loadRuntime(backend, (l) => {
        runtimeLoaded = l
        track('runtime')(Math.min(runtimeLoaded, runtimeTotal), runtimeTotal)
      }),
      loadFile(path, track(path)),
    ])
    return ort.InferenceSession.create(new Uint8Array(bytes), {
      executionProviders: backend === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'],
      graphOptimizationLevel: 'all',
      logSeverityLevel: 3,
    })
  })()
  sessions.set(key, job)
  job.catch(() => sessions.delete(key))
  return job
}

/** Bytes a first run downloads for these models on this backend (runtime included). */
export function downloadBytes(models: string[], backend: Backend): number {
  return wireBytes([...runtimeFiles(backend), ...models])
}
