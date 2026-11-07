/// <reference lib="webworker" />
/**
 * Worker that enlarges an image 4 times with Real-ESRGAN, tile by tile, and returns RGBA
 * pixels at 4x, 2x or 1x (the smaller sizes average the 4x result). Talk to it through
 * ./client.ts.
 */
import type { Hardware } from '../runtime/backend'
import { canvas2d, pixelsAt } from '../runtime/pixels'
import { serve } from '../runtime/rpc'
import type { Ctx } from '../runtime/rpc'
import { loadRuntime, openSession } from '../runtime/runtime'
import { NATIVE_SCALE, PAD, UPSCALE_MODELS, tileSize } from './models'
import type { UpscaleModel } from './models'
import { halve, placeTile, tileInput, tilesFor } from './tiles'

const handlers = {
  async load(args: { hw: Hardware; model: UpscaleModel }, ctx: Ctx) {
    await openSession(UPSCALE_MODELS[args.model].path, args.hw.backend, { onProgress: ctx.progress })
  },

  async upscale(args: { hw: Hardware; model: UpscaleModel; image: ImageBitmap; scale: 1 | 2 | 4 }, ctx: Ctx) {
    const { hw, image } = args
    const session = await openSession(UPSCALE_MODELS[args.model].path, hw.backend)
    const ort = await loadRuntime(hw.backend)
    const w = image.width
    const h = image.height
    const rgba = pixelsAt(image, w, h)
    const s = NATIVE_SCALE
    let out: Uint8ClampedArray = new Uint8ClampedArray(w * s * h * s * 4)
    const tiles = tilesFor(w, h, tileSize(hw), PAD)
    ctx.progress(0, tiles.length)
    for (const [i, t] of tiles.entries()) {
      ctx.check()
      const input = new ort.Tensor('float32', tileInput(rgba, w, t), [1, 3, t.ph, t.pw])
      const res = await session.run({ [session.inputNames[0]]: input })
      input.dispose()
      const tensor = res[session.outputNames[0]]
      placeTile(out, w * s, tensor.data as Float32Array, t, s)
      tensor.dispose()
      ctx.progress(i + 1, tiles.length)
    }

    // Transparency is not part of the model: scale the alpha of the input smoothly.
    let opaque = true
    for (let i = 3; i < rgba.length; i += 4) {
      if (rgba[i] < 255) {
        opaque = false
        break
      }
    }
    if (!opaque) {
      const ctx2 = canvas2d(w * s, h * s)
      ctx2.imageSmoothingQuality = 'high'
      ctx2.drawImage(image, 0, 0, w * s, h * s)
      const alpha = ctx2.getImageData(0, 0, w * s, h * s).data
      for (let i = 3; i < out.length; i += 4) out[i] = alpha[i]
    }
    image.close()

    let ow = w * s
    let oh = h * s
    for (let f = s; f > args.scale; f /= 2) {
      out = halve(out, ow, oh)
      ow >>= 1
      oh >>= 1
    }
    ctx.transfer.push(out.buffer)
    return { pixels: out, width: ow, height: oh }
  },
}

export type UpscaleApi = typeof handlers
serve(handlers)
