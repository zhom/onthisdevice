/**
 * Which hardware runs the models of the AI tools: the graphics card through WebGPU when the
 * browser offers a real (not software) adapter, the processor through WebAssembly otherwise.
 * Works in the page and in a worker; the page asks first, so it can name the download size,
 * and passes the answer to the worker.
 */

export type Backend = 'webgpu' | 'wasm'

export interface Hardware {
  backend: Backend
  /** The adapter runs 16-bit float shaders, so fp16 models work. */
  f16: boolean
}

const CPU: Hardware = { backend: 'wasm', f16: false }
let probe: Promise<Hardware> | null = null

export function detectHardware(): Promise<Hardware> {
  probe ??= (async () => {
    const gpu = (globalThis.navigator as Partial<Navigator> | undefined)?.gpu
    if (!gpu) return CPU
    try {
      const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' })
      // A software adapter is slower than the WebAssembly backend.
      if (!adapter || (adapter.info as { isFallbackAdapter?: boolean } | undefined)?.isFallbackAdapter) return CPU
      return { backend: 'webgpu', f16: adapter.features.has('shader-f16') }
    } catch {
      return CPU
    }
  })()
  return probe
}
