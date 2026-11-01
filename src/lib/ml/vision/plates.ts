/**
 * Finds licence plates with a DEIMv2 nano detector.
 *
 *   findPlates(reader, run, options?, onStep?) -> Detection[] in source pixels
 *
 * Model: /models/plate/deimv2-nano-plate.onnx (MIT, 16 MB), one class.
 * Inputs  "images" float32 [N, 3, 640, 640] RGB 0..1 (the crop is stretched),
 *         "orig_target_sizes" int64 [N, 2] = crop width, height.
 * Outputs "labels" [N, 300], "boxes" [N, 300, 4] x0 y0 x1 y1 in crop pixels,
 *         "scores" [N, 300].
 * The whole image is one pass. Large photos also get overlapping tiles, since
 * a plate is often under 1% of the frame.
 */
import { nms, tileGrid } from './geometry'
import type { Box, Detection } from './geometry'
import type { PixelReader, Runner } from './runner'

export const PLATE_SIZE = 640

export interface PlateOptions {
  minScore?: number
  tiles?: boolean
}

export const PHOTO_PLATES: Required<PlateOptions> = { minScore: 0.35, tiles: true }

const TILE = 1280
const TILE_OVERLAP = 320
const TILE_MAX_SIDE = 3840

/**
 * Drops shapes no plate has: twice as tall as wide (a plate seen at an angle
 * can be taller than wide), longer than 8:1, or a large part of the frame
 * with a low score (signs and shop fronts).
 */
function plausible(d: Detection, width: number, height: number): boolean {
  const ratio = d.w / d.h
  if (ratio < 0.5 || ratio > 8) return false
  return d.score >= 0.6 || d.w * d.h <= 0.06 * width * height
}

export function plateTensor(rgba: Uint8ClampedArray | Uint8Array): Float32Array {
  const plane = PLATE_SIZE * PLATE_SIZE
  const out = new Float32Array(plane * 3)
  for (let i = 0, p = 0; p < plane; p++, i += 4) {
    out[p] = rgba[i]! / 255
    out[plane + p] = rgba[i + 1]! / 255
    out[2 * plane + p] = rgba[i + 2]! / 255
  }
  return out
}

function plan(width: number, height: number, tiles: boolean): Box[] {
  const crops: Box[] = [{ x: 0, y: 0, w: width, h: height }]
  const long = Math.max(width, height)
  if (!tiles || long <= TILE * 1.15) return crops
  const scale = Math.min(1, TILE_MAX_SIDE / long)
  for (const t of tileGrid(width * scale, height * scale, TILE, TILE_OVERLAP)) {
    crops.push({ x: t.x / scale, y: t.y / scale, w: t.w / scale, h: t.h / scale })
  }
  return crops
}

export function plateSteps(width: number, height: number, options: PlateOptions = {}): number {
  return plan(width, height, options.tiles ?? PHOTO_PLATES.tiles).length
}

export async function findPlates(
  reader: PixelReader,
  run: Runner,
  options: PlateOptions = {},
  onStep?: (done: number, total: number) => void,
): Promise<Detection[]> {
  const opts = { ...PHOTO_PLATES, ...options }
  const crops = plan(reader.width, reader.height, opts.tiles)
  const all: Detection[] = []
  let done = 0
  for (const c of crops) {
    const rgba = reader.read(c.x, c.y, c.w, c.h, PLATE_SIZE, PLATE_SIZE)
    const out = await run({
      images: { type: 'float32', data: plateTensor(rgba), dims: [1, 3, PLATE_SIZE, PLATE_SIZE] },
      orig_target_sizes: { type: 'int64', data: BigInt64Array.from([BigInt(Math.round(c.w)), BigInt(Math.round(c.h))]), dims: [1, 2] },
    })
    const boxes = out.boxes?.data as ArrayLike<number> | undefined
    const scores = out.scores?.data as ArrayLike<number> | undefined
    if (!boxes || !scores) throw new Error('Plate model output is missing.')
    const sx = c.w / Math.round(c.w)
    const sy = c.h / Math.round(c.h)
    for (let i = 0; i < scores.length; i++) {
      const score = scores[i]!
      if (score < opts.minScore) continue
      const x0 = Math.max(0, boxes[i * 4]!) * sx
      const y0 = Math.max(0, boxes[i * 4 + 1]!) * sy
      const x1 = Math.min(c.w, boxes[i * 4 + 2]! * sx)
      const y1 = Math.min(c.h, boxes[i * 4 + 3]! * sy)
      if (x1 - x0 < 2 || y1 - y0 < 2) continue
      all.push({ x: c.x + x0, y: c.y + y0, w: x1 - x0, h: y1 - y0, score })
    }
    onStep?.(++done, crops.length)
  }
  return nms(all, 0.3, 0.6).filter((d) => plausible(d, reader.width, reader.height))
}
