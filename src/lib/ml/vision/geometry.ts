/**
 * Boxes, overlap and non-maximum suppression shared by the detectors and the
 * tracker. Pure functions: they run in a worker, on the main thread and in
 * Node tests.
 *
 *   Box          { x, y, w, h } in pixels of the image it was found in
 *   Detection    Box + score (0..1)
 *   iou(a, b)    intersection over union
 *   overlapSmall(a, b)  intersection over the smaller area (catches nested boxes)
 *   nms(dets, iou)      keeps the best box of each overlapping group
 *   padBox(box, padX, padY, shiftY, bounds)  grows a box by fractions of its size
 */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface Detection extends Box {
  score: number
}

export function area(b: Box): number {
  return Math.max(0, b.w) * Math.max(0, b.h)
}

export function intersection(a: Box, b: Box): number {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w)
  const y1 = Math.min(a.y + a.h, b.y + b.h)
  return Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
}

export function iou(a: Box, b: Box): number {
  const i = intersection(a, b)
  const u = area(a) + area(b) - i
  return u > 0 ? i / u : 0
}

export function overlapSmall(a: Box, b: Box): number {
  const i = intersection(a, b)
  const s = Math.min(area(a), area(b))
  return s > 0 ? i / s : 0
}

/**
 * Greedy NMS. A box is dropped when it overlaps a better box by more than
 * `iouLimit` (IoU) or when most of it (`nestLimit` of its area) lies inside a
 * better box, which removes partial faces found at tile edges.
 */
export function nms<T extends Detection>(dets: T[], iouLimit = 0.3, nestLimit = 0.7): T[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score)
  const kept: T[] = []
  for (const d of sorted) {
    if (kept.every((k) => iou(k, d) <= iouLimit && overlapSmall(k, d) <= nestLimit)) kept.push(d)
  }
  return kept
}

/** Grows a box by fractions of its own size and clamps it to `bounds`. */
export function padBox(b: Box, padX: number, padY: number, shiftY: number, bounds: { width: number; height: number }): Box {
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2 + shiftY * b.h
  const w = b.w * (1 + 2 * padX)
  const h = b.h * (1 + 2 * padY)
  const x0 = Math.max(0, cx - w / 2)
  const y0 = Math.max(0, cy - h / 2)
  const x1 = Math.min(bounds.width, cx + w / 2)
  const y1 = Math.min(bounds.height, cy + h / 2)
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

/** Tiles of `size` with at least `overlap` pixels shared between neighbours. */
export function tileGrid(width: number, height: number, size: number, overlap: number): Box[] {
  const axis = (len: number): number[] => {
    if (len <= size) return [0]
    const n = Math.ceil((len - overlap) / (size - overlap))
    const step = (len - size) / (n - 1)
    return Array.from({ length: n }, (_, i) => Math.round(i * step))
  }
  const tiles: Box[] = []
  for (const y of axis(height)) {
    for (const x of axis(width)) tiles.push({ x, y, w: Math.min(size, width), h: Math.min(size, height) })
  }
  return tiles
}
