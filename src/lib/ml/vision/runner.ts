/**
 * The two seams that keep the detectors independent of where they run:
 *
 *   PixelReader  reads a rectangle of the source image, resized, as RGBA.
 *                `canvasReader()` builds one from a bitmap, video frame or
 *                canvas with an OffscreenCanvas (worker and main thread).
 *   Runner       runs the model once: named float32/int64 inputs to named
 *                outputs. The worker builds it from an ORT session; tests
 *                build it from onnxruntime-node.
 */

export interface PixelReader {
  width: number
  height: number
  /** RGBA of the source rectangle (sx, sy, sw, sh) drawn at dw x dh. */
  read(sx: number, sy: number, sw: number, sh: number, dw: number, dh: number): Uint8ClampedArray
}

export type Feed =
  | { type: 'float32'; data: Float32Array; dims: number[] }
  | { type: 'int64'; data: BigInt64Array; dims: number[] }

export type Outputs = Record<string, { data: ArrayLike<number> | ArrayLike<bigint>; dims: readonly number[] }>

export type Runner = (feeds: Record<string, Feed>) => Promise<Outputs>

export type DrawableSource = ImageBitmap | VideoFrame | OffscreenCanvas | HTMLCanvasElement | HTMLVideoElement | HTMLImageElement

let scratch: OffscreenCanvas | null = null
let scratchCtx: OffscreenCanvasRenderingContext2D | null = null

/**
 * A reader over any drawable source. It shares one scratch canvas, so use one
 * reader at a time per thread (the detectors are sequential).
 */
export function canvasReader(source: DrawableSource, width: number, height: number): PixelReader {
  return {
    width,
    height,
    read(sx, sy, sw, sh, dw, dh) {
      if (!scratch || !scratchCtx) {
        scratch = new OffscreenCanvas(dw, dh)
        scratchCtx = scratch.getContext('2d', { willReadFrequently: true })
        if (!scratchCtx) throw new Error('This browser blocked canvas access, so the image cannot be read.')
      }
      if (scratch.width !== dw || scratch.height !== dh) {
        scratch.width = dw
        scratch.height = dh
      }
      const ctx = scratchCtx
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = dw < sw * 0.6 ? 'medium' : 'low'
      ctx.clearRect(0, 0, dw, dh)
      ctx.drawImage(source as CanvasImageSource, sx, sy, sw, sh, 0, 0, dw, dh)
      return ctx.getImageData(0, 0, dw, dh).data
    },
  }
}
