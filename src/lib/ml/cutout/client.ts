/**
 * Page side of background removal.
 *
 *   const hw = await detectHardware()
 *   await cutout.call('load', { hw }, { onProgress })
 *   const { mask, size } = await cutout.call('mask', { hw, image: bitmap }, { transfer: [bitmap] })
 */
import { workerClient } from '../runtime/rpc'
import type { CutoutApi } from './cutout.worker'

export const cutout = workerClient<CutoutApi>(() => new Worker(new URL('./cutout.worker.ts', import.meta.url), { type: 'module', name: 'cutout' }))
