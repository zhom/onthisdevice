/// <reference lib="webworker" />
/**
 * Worker that removes noise from 16 kHz speech with DTLN, block by block (see ./dtln.ts).
 * Talk to it through ./client.ts.
 */
import { serve } from '../runtime/rpc'
import type { Ctx } from '../runtime/rpc'
import { loadRuntime, openSession } from '../runtime/runtime'
import { BLOCK, SHIFT } from './dtln'
import { DTLN_MODELS } from './models'
import { Fft } from './fft'

const handlers = {
  async load(_args: Record<string, never>, ctx: Ctx) {
    // The first includes the runtime, nearly all of the download.
    await openSession(DTLN_MODELS[0], 'wasm', { onProgress: ctx.progress })
    await openSession(DTLN_MODELS[1], 'wasm')
  },

  async clean(args: { audio: Float32Array }, ctx: Ctx) {
    const [m1, m2, ort] = await Promise.all([openSession(DTLN_MODELS[0], 'wasm'), openSession(DTLN_MODELS[1], 'wasm'), loadRuntime('wasm')])
    const input = args.audio
    const blocks = Math.ceil((input.length + BLOCK) / SHIFT)
    const out = new Float32Array(blocks * SHIFT)
    const inBuf = new Float32Array(BLOCK)
    const outBuf = new Float32Array(BLOCK)
    const fft = new Fft(BLOCK)
    const re = new Float32Array(BLOCK)
    const im = new Float32Array(BLOCK)
    const bins = BLOCK / 2 + 1
    const mag = new Float32Array(bins)
    let s1 = new ort.Tensor('float32', new Float32Array(2 * 128 * 2), [1, 2, 128, 2])
    let s2 = new ort.Tensor('float32', new Float32Array(2 * 128 * 2), [1, 2, 128, 2])
    for (let b = 0; b < blocks; b++) {
      if (b % 200 === 0) {
        ctx.check()
        ctx.progress(b, blocks)
      }
      inBuf.copyWithin(0, SHIFT)
      for (let i = 0; i < SHIFT; i++) inBuf[BLOCK - SHIFT + i] = input[b * SHIFT + i] ?? 0
      re.set(inBuf)
      im.fill(0)
      fft.transform(re, im)
      for (let k = 0; k < bins; k++) mag[k] = Math.hypot(re[k], im[k])
      const r1 = await m1.run({ input_2: new ort.Tensor('float32', mag.slice(), [1, 1, bins]), input_3: s1 })
      const mask = r1[m1.outputNames[0]].data as Float32Array
      s1 = r1[m1.outputNames[1]] as typeof s1
      // Masked spectrum with the original phase, mirrored for a real inverse transform.
      for (let k = 0; k < bins; k++) {
        re[k] *= mask[k]
        im[k] *= mask[k]
      }
      for (let k = 1; k < BLOCK / 2; k++) {
        re[BLOCK - k] = re[k]
        im[BLOCK - k] = -im[k]
      }
      fft.transform(re, im, true)
      const r2 = await m2.run({ input_4: new ort.Tensor('float32', re.slice(), [1, 1, BLOCK]), input_5: s2 })
      const frame = r2[m2.outputNames[0]].data as Float32Array
      s2 = r2[m2.outputNames[1]] as typeof s2
      outBuf.copyWithin(0, SHIFT)
      outBuf.fill(0, BLOCK - SHIFT)
      for (let i = 0; i < BLOCK; i++) outBuf[i] += frame[i]
      out.set(outBuf.subarray(0, SHIFT), b * SHIFT)
    }
    ctx.transfer.push(out.buffer)
    return out
  },
}

export type DenoiseApi = typeof handlers
serve(handlers)
