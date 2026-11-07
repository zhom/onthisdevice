/// <reference lib="webworker" />
/**
 * Worker that estimates relative depth with Depth Anything V2: one byte per model pixel,
 * 255 for the nearest point and 0 for the farthest. Talk to it through ./client.ts.
 */
import { pixelsAt, toPlanar } from '../runtime/pixels'
import { serve } from '../runtime/rpc'
import type { Ctx } from '../runtime/rpc'
import { loadRuntime, openSession } from '../runtime/runtime'
import { DEPTH_MODEL } from './model'
import { DEPTH_MEAN, DEPTH_STD, inputSize } from './size'

const handlers = {
  async load(_args: Record<string, never>, ctx: Ctx) {
    await openSession(DEPTH_MODEL, 'wasm', { onProgress: ctx.progress })
  },

  async depth(args: { image: ImageBitmap; base: number }, ctx: Ctx) {
    const session = await openSession(DEPTH_MODEL, 'wasm')
    const ort = await loadRuntime('wasm')
    const { w, h } = inputSize(args.image.width, args.image.height, args.base)
    const rgba = pixelsAt(args.image, w, h)
    args.image.close()
    const input = new ort.Tensor('float32', toPlanar(rgba, w, h, DEPTH_MEAN, DEPTH_STD), [1, 3, h, w])
    ctx.check()
    const out = await session.run({ [session.inputNames[0]]: input })
    input.dispose()
    const t = out[session.outputNames[0]]
    const values = t.data as Float32Array
    const [oh, ow] = [t.dims[1], t.dims[2]]
    let lo = Infinity
    let hi = -Infinity
    for (const v of values) {
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    const k = hi > lo ? 255 / (hi - lo) : 0
    const depth = new Uint8ClampedArray(values.length)
    for (let i = 0; i < values.length; i++) depth[i] = (values[i] - lo) * k
    t.dispose()
    ctx.transfer.push(depth.buffer)
    return { depth, width: ow, height: oh }
  },
}

export type DepthApi = typeof handlers
serve(handlers)
