/**
 * Finds handwritten signatures on a page image with the YOLOS-tiny detector.
 *
 *   findSignatures(reader, run, { onStep }) -> Detection[] in pixels of the reader
 *
 * The model sees a 640 x 640 square, so a small signature on a whole page is
 * only a few pixels tall. The page is read whole and again in overlapping
 * squares 0.6 of the page width wide; a box from a square needs a higher
 * score, and boxes cut by a square's edge are dropped (a neighbour sees them
 * whole). Overlapping boxes are joined. Thin tall strips (paper folds) and
 * boxes on the page edge (punch holes) are dropped.
 * Squares with almost no ink are skipped.
 * Measured on 8 made pages (9 signatures) and 10 real typed letters: every
 * made signature found; on the letters it also marks handwritten notes and a
 * letterhead seal.
 */
import { overlapSmall, iou } from '../vision/geometry'
import type { Box, Detection } from '../vision/geometry'
import type { PixelReader, Runner } from '../vision/runner'

/** Model input side. The model was trained at 640; 512 finds the same signatures in about half the time. */
const SIZE = 512
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

export interface SignatureOptions {
  /** Minimum score for a box from the whole page. */
  minScore?: number
  /** Minimum score for a box found only in a square. */
  tileScore?: number
  /** Square side as a share of the page width; 0 reads the whole page only. */
  tile?: number
  onStep?: (done: number, total: number) => void
}

/** The whole page, then squares that overlap by a quarter. */
export function readPlan(width: number, height: number, tile: number): Box[] {
  const out: Box[] = [{ x: 0, y: 0, w: width, h: height }]
  if (!tile) return out
  const side = Math.round(Math.min(width, height) * tile)
  const steps = (len: number) => Math.max(1, Math.ceil((len - side) / (side * 0.75)) + 1)
  const cols = steps(width)
  const rows = steps(height)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = cols === 1 ? 0 : Math.round(((width - side) * c) / (cols - 1))
      const y = rows === 1 ? 0 : Math.round(((height - side) * r) / (rows - 1))
      out.push({ x, y, w: Math.min(side, width), h: Math.min(side, height) })
    }
  }
  return out
}

function toInput(rgba: Uint8ClampedArray): Float32Array {
  const n = SIZE * SIZE
  const out = new Float32Array(3 * n)
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) out[c * n + i] = (rgba[i * 4 + c] / 255 - MEAN[c]) / STD[c]
  }
  return out
}

/** Softmax score of class 0 (signature) and the box of each detection token. */
function decode(logits: ArrayLike<number>, boxes: ArrayLike<number>, tokens: number, classes: number, region: Box, minScore: number): Detection[] {
  const out: Detection[] = []
  for (let i = 0; i < tokens; i++) {
    let max = -Infinity
    for (let k = 0; k < classes; k++) max = Math.max(max, logits[i * classes + k])
    let sum = 0
    for (let k = 0; k < classes; k++) sum += Math.exp(logits[i * classes + k] - max)
    const score = Math.exp(logits[i * classes] - max) / sum
    if (score < minScore) continue
    const cx = boxes[i * 4]
    const cy = boxes[i * 4 + 1]
    const bw = boxes[i * 4 + 2]
    const bh = boxes[i * 4 + 3]
    out.push({ score, x: region.x + (cx - bw / 2) * region.w, y: region.y + (cy - bh / 2) * region.h, w: bw * region.w, h: bh * region.h })
  }
  return out
}

/** Joins boxes that overlap or nest into one box with the best score. */
export function joinBoxes(dets: Detection[]): Detection[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score)
  const kept: Detection[] = []
  for (const d of sorted) {
    const k = kept.find((o) => iou(o, d) > 0.2 || overlapSmall(o, d) > 0.7)
    if (!k) {
      kept.push({ ...d })
      continue
    }
    const x1 = Math.max(k.x + k.w, d.x + d.w)
    const y1 = Math.max(k.y + k.h, d.y + d.h)
    k.x = Math.min(k.x, d.x)
    k.y = Math.min(k.y, d.y)
    k.w = x1 - k.x
    k.h = y1 - k.y
  }
  return kept
}

/** Share of dark pixels in each square, from a small grey copy of the page. */
function inkShares(reader: PixelReader, plan: Box[]): number[] {
  const W = reader.width
  const H = reader.height
  const k = Math.min(1, 300 / Math.max(W, H))
  const w = Math.max(1, Math.round(W * k))
  const h = Math.max(1, Math.round(H * k))
  const rgba = reader.read(0, 0, W, H, w, h)
  const lum = new Uint8Array(w * h)
  const hist = new Uint32Array(256)
  for (let i = 0; i < w * h; i++) {
    lum[i] = (rgba[i * 4] * 77 + rgba[i * 4 + 1] * 150 + rgba[i * 4 + 2] * 29) >> 8
    hist[lum[i]]++
  }
  // Paper is the median level; ink is clearly darker than paper.
  let median = 0
  for (let acc = 0; median < 255 && acc + hist[median] < (w * h) / 2; median++) acc += hist[median]
  const dark = Math.max(30, median - 70)
  return plan.map((r) => {
    let n = 0
    let all = 0
    for (let y = Math.floor(r.y * k); y < Math.min(h, Math.ceil((r.y + r.h) * k)); y++) {
      for (let x = Math.floor(r.x * k); x < Math.min(w, Math.ceil((r.x + r.w) * k)); x++) {
        all++
        if (lum[y * w + x] < dark) n++
      }
    }
    return all ? n / all : 0
  })
}

export async function findSignatures(reader: PixelReader, run: Runner, options: SignatureOptions = {}): Promise<Detection[]> {
  const { minScore = 0.5, tileScore = 0.8, tile = 0.6, onStep } = options
  const W = reader.width
  const H = reader.height
  const full = readPlan(W, H, tile)
  const shares = inkShares(reader, full)
  const plan = full.filter((_, i) => i === 0 || shares[i] > 0.002)
  const found: Detection[] = []
  for (const [i, r] of plan.entries()) {
    const whole = r.w === W && r.h === H
    const pixels = reader.read(r.x, r.y, r.w, r.h, SIZE, SIZE)
    const out = await run({ pixel_values: { type: 'float32', data: toInput(pixels), dims: [1, 3, SIZE, SIZE] } })
    const logits = out.logits
    const dets = decode(logits.data as ArrayLike<number>, out.pred_boxes.data as ArrayLike<number>, logits.dims[1], logits.dims[2], r, whole ? minScore : tileScore)
    for (const d of dets) {
      const m = 4 * (r.w / SIZE)
      const cut = !whole && ((d.x - r.x < m && r.x > 0) || (d.y - r.y < m && r.y > 0) || (r.x + r.w - (d.x + d.w) < m && r.x + r.w < W) || (r.y + r.h - (d.y + d.h) < m && r.y + r.h < H))
      if (!cut) found.push(d)
    }
    onStep?.(i + 1, plan.length)
  }
  return joinBoxes(found).filter((d) => d.w / d.h >= 0.6 && d.x > W * 0.01 && d.x + d.w < W * 0.99)
}
