/**
 * transformers.js on the runtime of ./runtime.ts, for the AI tools that use its pipelines
 * (speech, translation). The build on this site takes the runtime from
 * globalThis[Symbol.for('onthisdevice.ort')] (see scripts/vendor-models.mjs); every model
 * file comes from /models/ through ../assets.ts (Cache Storage). Call from a Web Worker.
 */
import type * as Transformers from '@huggingface/transformers'
import { loadFile, loadFiles, modelCache, wireBytes } from '../assets'
import type { Progress } from '../assets'
import { TRANSFORMERS_FILE } from '../speech/model'
import type { Backend } from './backend'
import { loadRuntime, runtimeFiles } from './runtime'

export type TransformersModule = typeof Transformers
export { TRANSFORMERS_FILE }

const MODEL_ROOT = '/models/'
let job: Promise<TransformersModule> | null = null

/**
 * Loads the runtime, transformers.js and `files` (model files that the pipeline asks for
 * next, so they share one progress bar), and returns the configured module.
 */
export async function loadTransformers(backend: Backend, files: string[], onProgress?: Progress): Promise<TransformersModule> {
  const all = [...(job ? [] : [...runtimeFiles(backend), TRANSFORMERS_FILE]), ...files]
  const total = wireBytes(all)
  let runtimeDone = 0
  let filesDone = 0
  const report = () => onProgress?.(Math.min(total, runtimeDone + filesDone), total)
  const preload = loadFiles(job ? files : [TRANSFORMERS_FILE, ...files], (l) => {
    filesDone = l
    report()
  })
  if (!job) {
    const run = (async () => {
      const [ort, source] = await Promise.all([
        loadRuntime(backend, (l) => {
          runtimeDone = l
          report()
        }),
        loadFile(TRANSFORMERS_FILE),
      ])
      ;(globalThis as unknown as Record<symbol, unknown>)[Symbol.for('onthisdevice.ort')] = ort
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
      let T: TransformersModule
      try {
        T = (await import(/* @vite-ignore */ url)) as TransformersModule
      } finally {
        URL.revokeObjectURL(url)
      }
      T.env.allowRemoteModels = false
      T.env.allowLocalModels = true
      T.env.localModelPath = MODEL_ROOT
      T.env.useBrowserCache = false
      T.env.useCustomCache = true
      T.env.customCache = modelCache
      return T
    })()
    job = run
    run.catch(() => {
      if (job === run) job = null
    })
  }
  const [T] = await Promise.all([job, preload])
  return T
}
