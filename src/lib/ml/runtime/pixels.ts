/**
 * Pixels to tensors and back, for image models in a worker (OffscreenCanvas).
 */

export function canvas2d(w: number, h: number): OffscreenCanvasRenderingContext2D {
  const ctx = new OffscreenCanvas(Math.max(1, w), Math.max(1, h)).getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('This browser cannot draw images in a worker.')
  return ctx
}

/** RGBA of `source` drawn at w x h (stretched, smoothed). */
export function pixelsAt(source: CanvasImageSource, w: number, h: number): Uint8ClampedArray {
  const ctx = canvas2d(w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h).data
}

/** RGBA to planar RGB floats: (v * scale - mean) / std. */
export function toPlanar(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  mean: readonly number[] = [0, 0, 0],
  std: readonly number[] = [1, 1, 1],
  scale = 1 / 255,
): Float32Array {
  const n = w * h
  const out = new Float32Array(3 * n)
  for (let c = 0; c < 3; c++) {
    const m = mean[c]
    const s = 1 / std[c]
    const plane = c * n
    for (let i = 0; i < n; i++) out[plane + i] = (rgba[i * 4 + c] * scale - m) * s
  }
  return out
}

const f32 = new Float32Array(1)
const u32 = new Uint32Array(f32.buffer)

/** IEEE half precision bits of a float (round to nearest). */
export function toHalf(v: number): number {
  f32[0] = v
  const x = u32[0]
  const sign = (x >>> 16) & 0x8000
  const exp = ((x >>> 23) & 0xff) - 127 + 15
  const mant = x & 0x7fffff
  if (exp <= 0) {
    if (exp < -10) return sign
    const m = (mant | 0x800000) >> (1 - exp)
    return sign | ((m + 0x1000) >> 13)
  }
  if (exp >= 31) return sign | 0x7c00
  return (sign | (exp << 10) | (mant >> 13)) + ((mant >> 12) & 1)
}

export function fromHalf(h: number): number {
  const sign = h & 0x8000 ? -1 : 1
  const exp = (h >> 10) & 0x1f
  const mant = h & 0x3ff
  if (exp === 0) return sign * 2 ** -14 * (mant / 1024)
  if (exp === 31) return mant ? NaN : sign * Infinity
  return sign * 2 ** (exp - 15) * (1 + mant / 1024)
}

/** Float32 copy of tensor data that may be float16 bits, float16 values or float32. */
export function floats(data: unknown): Float32Array {
  if (data instanceof Float32Array) return data
  if (data instanceof Uint16Array) return Float32Array.from(data, fromHalf)
  if (ArrayBuffer.isView(data)) return Float32Array.from(data as unknown as ArrayLike<number>)
  throw new Error('The model gave an output of an unexpected type.')
}
