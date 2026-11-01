/**
 * Finds ink stamps on a page image without a model (no small open model for
 * stamps exists). A stamp is coloured ink (or dark ink in a ring) that forms a
 * frame: a ring, or a rectangle with ink along all four sides. Text lines,
 * tables and paragraphs have no such frame.
 *
 *   findStamps(rgba, width, height) -> Detection[] in pixels of that image
 *
 * Use an image about 1000 px on the long side; the sizes below are shares of
 * the page, so other sizes work too.
 */
import type { Detection } from '../vision/geometry'

/** Coloured ink: clearly saturated and not paper-light. Old paper is beige, so the bar is high. */
function isColour(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max - min > 70 && (max - min) / max > 0.4 && max > 50 && min < 200
}

function isDark(r: number, g: number, b: number): boolean {
  return r + g + b < 3 * 110
}

/** Max filter with a square of side 2r+1, separable. */
function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(mask.length)
  const out = new Uint8Array(mask.length)
  for (let y = 0; y < h; y++) {
    // forward then backward pass: distance to the nearest ink along the row
    let near = -Infinity
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) near = x
      if (x - near <= r) tmp[y * w + x] = 1
    }
    near = Infinity
    for (let x = w - 1; x >= 0; x--) {
      if (mask[y * w + x]) near = x
      if (near - x <= r) tmp[y * w + x] = 1
    }
  }
  for (let x = 0; x < w; x++) {
    let near = -Infinity
    for (let y = 0; y < h; y++) {
      if (tmp[y * w + x]) near = y
      if (y - near <= r) out[y * w + x] = 1
    }
    near = Infinity
    for (let y = h - 1; y >= 0; y--) {
      if (tmp[y * w + x]) near = y
      if (near - y <= r) out[y * w + x] = 1
    }
  }
  return out
}

interface Blob {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Bounding boxes of 4-connected regions. */
function regions(mask: Uint8Array, w: number, h: number): Blob[] {
  const seen = new Uint8Array(mask.length)
  const stack: number[] = []
  const out: Blob[] = []
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue
    const b: Blob = { x0: w, y0: h, x1: 0, y1: 0 }
    stack.push(i)
    seen[i] = 1
    while (stack.length) {
      const p = stack.pop()!
      const x = p % w
      const y = (p - x) / w
      if (x < b.x0) b.x0 = x
      if (x > b.x1) b.x1 = x
      if (y < b.y0) b.y0 = y
      if (y > b.y1) b.y1 = y
      const next = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]
      for (const q of next) {
        if (q >= 0 && mask[q] && !seen[q]) {
          seen[q] = 1
          stack.push(q)
        }
      }
    }
    out.push(b)
  }
  return out
}

/** Share of 48 directions from the centre that meet ink in the outer fifth of the ellipse. */
function ringCover(ink: Uint8Array, w: number, b: Blob): number {
  const cx = (b.x0 + b.x1) / 2
  const cy = (b.y0 + b.y1) / 2
  const rx = (b.x1 - b.x0) / 2
  const ry = (b.y1 - b.y0) / 2
  let hits = 0
  const N = 48
  for (let k = 0; k < N; k++) {
    const a = (2 * Math.PI * k) / N
    let hit = false
    for (let f = 0.78; f <= 1.0 && !hit; f += 0.02) {
      const x = Math.round(cx + Math.cos(a) * rx * f)
      const y = Math.round(cy + Math.sin(a) * ry * f)
      if (ink[y * w + x]) hit = true
    }
    if (hit) hits++
  }
  return hits / N
}

/** Ink along each side of the box: the smallest of the four side covers. */
function frameCover(ink: Uint8Array, w: number, b: Blob): number {
  const bw = b.x1 - b.x0 + 1
  const bh = b.y1 - b.y0 + 1
  const band = (len: number) => Math.max(2, Math.round(len * 0.1))
  const rowsCover = (y0: number, y1: number) => {
    let n = 0
    for (let x = b.x0; x <= b.x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (ink[y * w + x]) {
          n++
          break
        }
      }
    }
    return n / bw
  }
  const colsCover = (x0: number, x1: number) => {
    let n = 0
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (ink[y * w + x]) {
          n++
          break
        }
      }
    }
    return n / bh
  }
  const by = band(bh)
  const bx = band(bw)
  return Math.min(rowsCover(b.y0, b.y0 + by), rowsCover(b.y1 - by, b.y1), colsCover(b.x0, b.x0 + bx), colsCover(b.x1 - bx, b.x1))
}

function inkShare(ink: Uint8Array, w: number, b: Blob): number {
  let n = 0
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) n += ink[y * w + x]
  return n / ((b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1))
}

export function findStamps(rgba: Uint8ClampedArray, width: number, height: number): Detection[] {
  const n = width * height
  const colour = new Uint8Array(n)
  const dark = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4]
    const g = rgba[i * 4 + 1]
    const b = rgba[i * 4 + 2]
    if (isColour(r, g, b)) colour[i] = 1
    else if (isDark(r, g, b)) dark[i] = 1
  }
  const side = Math.min(width, height)
  const minSide = side * 0.05
  const maxSide = side * 0.45
  const out: Detection[] = []
  for (const [ink, isInk] of [
    [colour, true],
    [dark, false],
  ] as const) {
    const joined = dilate(ink, width, height, Math.max(1, Math.round(side * 0.004)))
    for (const b of regions(joined, width, height)) {
      const bw = b.x1 - b.x0 + 1
      const bh = b.y1 - b.y0 + 1
      if (bw < minSide || bh < minSide || bw > maxSide || bh > maxSide) continue
      const aspect = bw / bh
      const fill = inkShare(ink, width, b)
      if (fill < 0.03 || fill > 0.5) continue
      const ring = aspect > 0.6 && aspect < 1.7 ? ringCover(ink, width, b) : 0
      // Dark ink only as a ring: dark rectangles are table cells and form boxes.
      const frame = isInk && aspect > 0.4 && aspect < 5 ? frameCover(ink, width, b) : 0
      const score = Math.max(ring >= 0.8 ? ring : 0, frame >= 0.75 ? frame : 0)
      if (score === 0 || (!isInk && ring < 0.9)) continue
      out.push({ x: b.x0, y: b.y0, w: bw, h: bh, score })
    }
  }
  return out
}
