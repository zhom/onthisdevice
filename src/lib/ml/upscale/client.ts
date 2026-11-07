/**
 * Page side of super resolution.
 *
 *   await upscaler.call('load', { hw, model }, { onProgress })
 *   const { pixels, width, height } = await upscaler.call('upscale', { hw, model, image, scale }, { transfer: [image], onProgress })
 */
import { workerClient } from '../runtime/rpc'
import type { UpscaleApi } from './upscale.worker'

export const upscaler = workerClient<UpscaleApi>(() => new Worker(new URL('./upscale.worker.ts', import.meta.url), { type: 'module', name: 'upscale' }))
