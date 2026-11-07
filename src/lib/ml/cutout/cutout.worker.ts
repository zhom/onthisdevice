/// <reference lib="webworker" />
/**
 * Worker that finds the subject of a photo: a soft mask, 1024 x 1024, 0 for background and
 * 255 for subject. Talk to it through ./client.ts.
 */
import type { Hardware } from '../runtime/backend'
import { floats, pixelsAt, toPlanar } from '../runtime/pixels'
import { serve } from '../runtime/rpc'
import type { Ctx } from '../runtime/rpc'
import { openSession } from '../runtime/runtime'
import type { Ort } from '../runtime/runtime'
import { loadRuntime } from '../runtime/runtime'
import { CUTOUT_MODEL, MASK_SIZE } from './models'

async function session(hw: Hardware, onProgress?: (done: number, total: number) => void) {
  const s = await openSession(CUTOUT_MODEL.path, hw.backend, { onProgress })
  const ort: Ort = await loadRuntime(hw.backend)
  return { s, ort, model: CUTOUT_MODEL }
}

const handlers = {
  async load(args: { hw: Hardware }, ctx: Ctx) {
    await session(args.hw, ctx.progress)
  },

  async mask(args: { hw: Hardware; image: ImageBitmap }, ctx: Ctx) {
    const { s, ort, model } = await session(args.hw)
    ctx.check()
    const size = MASK_SIZE
    const rgba = pixelsAt(args.image, size, size)
    args.image.close()
    const input = toPlanar(rgba, size, size, model.mean, model.std)
    const name = s.inputNames[0]
    const tensor = new ort.Tensor('float32', input, [1, 3, size, size])
    const out = await s.run({ [name]: tensor })
    tensor.dispose()
    const result = out[s.outputNames[0]]
    const values = floats(result.data)
    for (const t of Object.values(out)) t.dispose()
    const mask = new Uint8ClampedArray(size * size)
    // The map is stretched to its own range, as the model was trained.
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < mask.length; i++) {
      if (values[i] < lo) lo = values[i]
      if (values[i] > hi) hi = values[i]
    }
    const k = hi > lo ? 255 / (hi - lo) : 0
    for (let i = 0; i < mask.length; i++) mask[i] = (values[i] - lo) * k
    ctx.transfer.push(mask.buffer)
    return { mask, size }
  },
}

export type CutoutApi = typeof handlers
serve(handlers)
