/**
 * Page side of object removal.
 *
 *   await inpainter.call('load', {}, { onProgress })
 *   const { pixels, width, height } = await inpainter.call('fill', { image, mask }, { transfer: [image, mask.buffer] })
 */
import { workerClient } from '../runtime/rpc'
import type { InpaintApi } from './inpaint.worker'

export const inpainter = workerClient<InpaintApi>(() => new Worker(new URL('./inpaint.worker.ts', import.meta.url), { type: 'module', name: 'inpaint' }))
