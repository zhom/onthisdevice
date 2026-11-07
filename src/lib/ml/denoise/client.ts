/**
 * Page side of speech noise removal.
 *
 *   await denoiser.call('load', {}, { onProgress })
 *   const cleaned = await denoiser.call('clean', { audio16k }, { onProgress })   // late by DELAY samples
 */
import { workerClient } from '../runtime/rpc'
import type { DenoiseApi } from './denoise.worker'

export const denoiser = workerClient<DenoiseApi>(() => new Worker(new URL('./denoise.worker.ts', import.meta.url), { type: 'module', name: 'denoise' }))
