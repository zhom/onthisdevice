/// <reference lib="webworker" />
/**
 * Worker that fills painted areas of a photo with MI-GAN (MIT). The model file contains its own
 * pre- and post-processing: it takes the photo and the mask at any size, works on the area
 * around the mask at 512 x 512, and blends the fill back. Talk to it through ./client.ts.
 */
import { pixelsAt } from '../runtime/pixels'
import { serve } from '../runtime/rpc'
import type { Ctx } from '../runtime/rpc'
import { loadRuntime, openSession } from '../runtime/runtime'
import { INPAINT_MODEL } from './model'

const handlers = {
  async load(_args: Record<string, never>, ctx: Ctx) {
    await openSession(INPAINT_MODEL, 'wasm', { onProgress: ctx.progress })
  },

  /** `mask` has one byte per pixel: 255 where the photo is to be filled. */
  async fill(args: { image: ImageBitmap; mask: Uint8Array }, ctx: Ctx) {
    const session = await openSession(INPAINT_MODEL, 'wasm')
    const ort = await loadRuntime('wasm')
    const w = args.image.width
    const h = args.image.height
    const rgba = pixelsAt(args.image, w, h)
    args.image.close()
    const n = w * h
    const planar = new Uint8Array(3 * n)
    for (let i = 0; i < n; i++) {
      planar[i] = rgba[i * 4]
      planar[n + i] = rgba[i * 4 + 1]
      planar[2 * n + i] = rgba[i * 4 + 2]
    }
    // The model keeps pixels where its mask is 255 and fills where it is 0.
    const keep = new Uint8Array(n)
    for (let i = 0; i < n; i++) keep[i] = args.mask[i] >= 128 ? 0 : 255
    const image = new ort.Tensor('uint8', planar, [1, 3, h, w])
    const mask = new ort.Tensor('uint8', keep, [1, 1, h, w])
    ctx.check()
    const out = await session.run({ image, mask })
    image.dispose()
    mask.dispose()
    const result = out[session.outputNames[0]]
    const data = result.data as Uint8Array
    for (let i = 0; i < n; i++) {
      rgba[i * 4] = data[i]
      rgba[i * 4 + 1] = data[n + i]
      rgba[i * 4 + 2] = data[2 * n + i]
    }
    result.dispose()
    ctx.transfer.push(rgba.buffer)
    return { pixels: rgba, width: w, height: h }
  },
}

export type InpaintApi = typeof handlers
serve(handlers)
