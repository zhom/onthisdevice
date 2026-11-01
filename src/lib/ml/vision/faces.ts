/**
 * Finds faces with YuNet in any image size.
 *
 *   findFaces(reader, run, options?, onStep?) -> FaceDetection[] in source pixels
 *
 * One pass per entry of `sizes` (the long side the whole image is scaled to)
 * finds medium and large faces. With `tiles` on, the image is also cut into
 * overlapping tiles near full resolution, so faces of 10 to 20 pixels in a
 * large group photo are found too. Results are merged with NMS.
 * Camera and video use one small pass; photos use the full set.
 */
import { nms, tileGrid } from './geometry'
import type { Box } from './geometry'
import type { PixelReader, Runner } from './runner'
import { decodeYunet, yunetSize, yunetTensor } from './yunet'
import type { FaceDetection } from './yunet'

export type { FaceDetection } from './yunet'

export interface FaceOptions {
  /** Lowest score kept, 0..1. */
  minScore?: number
  /** Long sides of the whole-image passes. */
  sizes?: number[]
  /** Tile pass for small faces. */
  tiles?: boolean
}

/** Settings for photos: three scales and tiles. */
export const PHOTO_FACES: Required<FaceOptions> = { minScore: 0.55, sizes: [320, 640, 1280], tiles: true }
/** Settings for one video or camera frame. */
export const FRAME_FACES: Required<FaceOptions> = { minScore: 0.55, sizes: [640], tiles: false }

const TILE = 960
const TILE_OVERLAP = 256
/** Tiles work on the image scaled to at most this long side. */
const TILE_MAX_SIDE = 4096

interface Pass {
  crop: Box
  /** Model input size. */
  w: number
  h: number
  /** Edges of the crop that are inside the image, where partial faces are dropped. */
  inner: { left: boolean; top: boolean; right: boolean; bottom: boolean }
}

function plan(width: number, height: number, opts: Required<FaceOptions>): Pass[] {
  const long = Math.max(width, height)
  const passes: Pass[] = []
  const whole: Box = { x: 0, y: 0, w: width, h: height }
  const none = { left: false, top: false, right: false, bottom: false }
  const sizes = [...new Set(opts.sizes.map((s) => Math.min(s, Math.max(long, 32))))]
  for (const side of sizes) passes.push({ crop: whole, ...yunetSize(width, height, side / long), inner: none })

  const tileScale = Math.min(1, TILE_MAX_SIDE / long)
  const biggest = Math.max(...sizes)
  if (opts.tiles && long * tileScale > biggest * 1.25) {
    const sw = width * tileScale
    const sh = height * tileScale
    for (const t of tileGrid(sw, sh, TILE, TILE_OVERLAP)) {
      passes.push({
        crop: { x: t.x / tileScale, y: t.y / tileScale, w: t.w / tileScale, h: t.h / tileScale },
        ...yunetSize(t.w, t.h, 1),
        inner: { left: t.x > 0, top: t.y > 0, right: t.x + t.w < sw - 1, bottom: t.y + t.h < sh - 1 },
      })
    }
  }
  return passes
}

/** Number of model runs `findFaces` makes for this size, for progress. */
export function faceSteps(width: number, height: number, options: FaceOptions = {}): number {
  return plan(width, height, { ...PHOTO_FACES, ...options }).length
}

export async function findFaces(
  reader: PixelReader,
  run: Runner,
  options: FaceOptions = {},
  onStep?: (done: number, total: number) => void,
): Promise<FaceDetection[]> {
  const opts = { ...PHOTO_FACES, ...options }
  const passes = plan(reader.width, reader.height, opts)
  const all: FaceDetection[] = []
  let done = 0
  for (const p of passes) {
    const rgba = reader.read(p.crop.x, p.crop.y, p.crop.w, p.crop.h, p.w, p.h)
    const out = await run({ input: { type: 'float32', data: yunetTensor(rgba, p.w, p.h), dims: [1, 3, p.h, p.w] } })
    const sx = p.crop.w / p.w
    const sy = p.crop.h / p.h
    const edge = 3
    for (const d of decodeYunet(out as Parameters<typeof decodeYunet>[0], p.w, p.h, opts.minScore)) {
      if (p.inner.left && d.x < edge) continue
      if (p.inner.top && d.y < edge) continue
      if (p.inner.right && d.x + d.w > p.w - edge) continue
      if (p.inner.bottom && d.y + d.h > p.h - edge) continue
      all.push({
        x: p.crop.x + d.x * sx,
        y: p.crop.y + d.y * sy,
        w: d.w * sx,
        h: d.h * sy,
        score: d.score,
        landmarks: d.landmarks.map((v, i) => (i % 2 === 0 ? p.crop.x + v * sx : p.crop.y + v * sy)),
      })
    }
    onStep?.(++done, passes.length)
  }
  return nms(all, 0.3, 0.6)
}
