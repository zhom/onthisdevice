/**
 * Page side of depth estimation.
 *
 *   await depthModel.call('load', {}, { onProgress })
 *   const { depth, width, height } = await depthModel.call('depth', { image, base: 518 }, { transfer: [image] })
 */
import { workerClient } from '../runtime/rpc'
import type { DepthApi } from './depth.worker'

export const depthModel = workerClient<DepthApi>(() => new Worker(new URL('./depth.worker.ts', import.meta.url), { type: 'module', name: 'depth' }))
