/**
 * Reads a screen recording: frames are sampled a few times a second; a frame
 * is read with OCR (and the language model) only when the screen changed
 * since the last reading. Faces are looked for in every sampled frame and
 * followed with the tracker.
 *
 *   scanScreencast(file, { onProgress, signal }) -> Scan
 *   textTracks(scan, list) -> TextTrack[]   every type; pure, so the list can change without a new scan
 *   boxesAt(scan, tracks, kept, manual, t) -> boxes in fractions of the frame
 *
 * A box found in a reading starts one sample before it (the change happened
 * after that sample) and lasts until a reading no longer finds it, so the
 * moment the screen changes is covered by the old and the new boxes.
 */
import { visionClient } from '@/lib/ml/vision/client'
import { Tracker, boxesAt as trackBoxesAt } from '@/lib/ml/vision/tracker'
import type { Track } from '@/lib/ml/vision/tracker'
import { scanVideo } from '@/lib/ml/video/pipeline'
import type { VideoInfo } from '@/lib/ml/video/pipeline'
import { TYPE_INFO } from '@/lib/ml/text/types'
import type { EntityType, Span } from '@/lib/ml/text/types'
import { findTextItems, modelSpans, readScreen } from '../text/screen-detect'
import type { ScreenText } from '../text/screen-detect'

export const SCAN_FPS = 3
/** Faces on a screen are small (avatars, a webcam corner): look at the full frame size. */
const SCREEN_FACES = { minScore: 0.55, sizes: [1280], tiles: false }
const SCAN_SIDE = 1600
/** Size of the copy used to see whether the screen changed. */
const SIG_W = 128
const SIG_H = 72
/** Share of the copy's pixels that must change before the frame is read again. */
const CHANGED = 0.003

export interface Reading {
  /** Time of the frame that was read. */
  t: number
  /** Small grey copy of the frame, to see whether the area under a box changed. */
  sig: Uint8Array
  /** Time of the sample before it: boxes from this reading start there. */
  from: number
  st: ScreenText
  model: Span[]
}

export interface Scan {
  info: VideoInfo
  /** Size the frames were read at. */
  width: number
  height: number
  readings: Reading[]
  faces: Track[]
}

export interface ScanProgress {
  index: number
  total: number
  readings: number
}

function signature(canvas: OffscreenCanvas | HTMLCanvasElement): Uint8Array {
  const c = new OffscreenCanvas(SIG_W, SIG_H)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('This browser blocked canvas access, so the video cannot be read.')
  ctx.drawImage(canvas, 0, 0, SIG_W, SIG_H)
  const d = ctx.getImageData(0, 0, SIG_W, SIG_H).data
  const out = new Uint8Array(SIG_W * SIG_H)
  for (let i = 0; i < out.length; i++) out[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8
  return out
}

/** Share of pixels that differ, outside the given boxes (faces move all the time). */
function changed(a: Uint8Array, b: Uint8Array, ignore: { x: number; y: number; w: number; h: number }[]): number {
  let n = 0
  let all = 0
  for (let y = 0; y < SIG_H; y++) {
    for (let x = 0; x < SIG_W; x++) {
      const fx = x / SIG_W
      const fy = y / SIG_H
      if (ignore.some((r) => fx >= r.x && fx <= r.x + r.w && fy >= r.y && fy <= r.y + r.h)) continue
      all++
      if (Math.abs(a[y * SIG_W + x] - b[y * SIG_W + x]) > 24) n++
    }
  }
  return all ? n / all : 0
}

export async function scanScreencast(file: File, opts: { onProgress: (p: ScanProgress) => void; signal?: AbortSignal }): Promise<Scan> {
  const readings: Reading[] = []
  const tracker = new Tracker({ maxGap: 1.2 / SCAN_FPS + 0.5 })
  const vision = visionClient()
  let last: Uint8Array | null = null
  let prevT = 0
  let width = 0
  let height = 0
  let faceBoxes: { x: number; y: number; w: number; h: number }[] = []
  const info = await scanVideo(file, {
    fps: SCAN_FPS,
    maxSide: SCAN_SIDE,
    signal: opts.signal,
    onFrame: async (canvas, t, index, total) => {
      width = canvas.width
      height = canvas.height
      const faces = await vision.detect(await createImageBitmap(canvas), { model: 'face', options: SCREEN_FACES })
      tracker.update(t, faces)
      // Faces are left out of the change test: a webcam bubble changes in every frame.
      faceBoxes = faces.map((f) => ({ x: f.x / width - 0.02, y: f.y / height - 0.02, w: f.w / width + 0.04, h: f.h / height + 0.04 }))
      const sig = signature(canvas)
      if (!last || changed(sig, last, faceBoxes) > CHANGED) {
        last = sig
        const bitmap = await createImageBitmap(canvas)
        try {
          const st = await readScreen(bitmap)
          readings.push({ t, sig, from: readings.length ? prevT : 0, st, model: await modelSpans(st) })
        } finally {
          bitmap.close()
        }
      }
      prevT = t
      opts.onProgress({ index: index + 1, total, readings: readings.length })
    },
  })
  return { info, width, height, readings, faces: tracker.finish() }
}

type Frac = { x: number; y: number; w: number; h: number }

export interface TextTrack {
  id: string
  /** From the always-hide list: shown whatever types are chosen. */
  listed: boolean
  label: string
  type: EntityType | undefined
  value: string
  start: number
  end: number
  /** Where the item was, per reading, in fractions of the frame; boxes between two keys move between them. */
  keys: { t: number; rects: Frac[] }[]
}

const ALL_TYPES: ReadonlySet<EntityType> = new Set(TYPE_INFO.map((t) => t.type))
/** Largest move between two readings that counts as scrolling, as a share of the frame. */
const MAX_MOVE = 0.15

/** Share of pixels under `r` that differ between two readings. */
function regionChanged(a: Uint8Array, b: Uint8Array, r: Frac): number {
  const x0 = Math.max(0, Math.floor(r.x * SIG_W))
  const y0 = Math.max(0, Math.floor(r.y * SIG_H))
  const x1 = Math.min(SIG_W, Math.ceil((r.x + r.w) * SIG_W))
  const y1 = Math.min(SIG_H, Math.ceil((r.y + r.h) * SIG_H))
  let n = 0
  let all = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      all++
      if (Math.abs(a[y * SIG_W + x] - b[y * SIG_W + x]) > 24) n++
    }
  }
  return all ? n / all : 0
}

const centre = (r: Frac) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

/** True when the area holds something drawn (text, icons), not a flat background. */
function inked(sig: Uint8Array, r: Frac): boolean {
  const x0 = Math.max(0, Math.floor(r.x * SIG_W))
  const y0 = Math.max(0, Math.floor(r.y * SIG_H))
  const x1 = Math.min(SIG_W, Math.ceil((r.x + r.w) * SIG_W))
  const y1 = Math.min(SIG_H, Math.ceil((r.y + r.h) * SIG_H))
  let n = 0
  let sum = 0
  let sq = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const v = sig[y * SIG_W + x]
      n++
      sum += v
      sq += v * v
    }
  }
  return n > 0 && Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2)) > 12
}

const shift = (rects: Frac[], dx: number, dy: number): Frac[] => rects.map((r) => ({ ...r, x: r.x + dx, y: r.y + dy }))

function median(v: number[]): number {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/**
 * Text tracks of every type. An item found again within a short distance is
 * the same track (it scrolled), and its boxes move between the readings. The
 * scroll of the whole screen (the median move of the items found twice) is
 * used for items that enter or leave between two readings. An item a reading
 * did not find stays while the screen under it is unchanged, and for two
 * more readings while there is still text under it (OCR does not read the
 * same text the same way every time, and sometimes misses a line).
 */
export function textTracks(scan: Scan, list: string[]): TextTrack[] {
  const done: TextTrack[] = []
  let open: { track: TextTrack; seen: number; misses: number }[] = []
  const { width: W, height: H } = scan
  scan.readings.forEach((r, ri) => {
    const items = findTextItems(r.st, { types: ALL_TYPES, hide: list, model: r.model, chat: false, height: H })
    const next: typeof open = []
    const fresh: TextTrack[] = []
    const moves: { dx: number; dy: number }[] = []
    for (const it of items) {
      const rects = it.rects.map((b) => ({ x: b.x / W, y: b.y / H, w: b.w / W, h: b.h / H }))
      const c = centre(rects[0])
      let best: (typeof open)[number] | null = null
      let bestD = MAX_MOVE
      for (const o of open) {
        if (o.track.value !== it.value) continue
        const last = o.track.keys[o.track.keys.length - 1].rects[0]
        const d = Math.hypot(centre(last).x - c.x, centre(last).y - c.y)
        if (d < bestD) {
          bestD = d
          best = o
        }
      }
      if (best) {
        open = open.filter((o) => o !== best)
        const last = best.track.keys[best.track.keys.length - 1].rects[0]
        if (best.seen === ri - 1) moves.push({ dx: rects[0].x - last.x, dy: rects[0].y - last.y })
        best.track.keys.push({ t: r.t, rects })
        next.push({ track: best.track, seen: ri, misses: 0 })
      } else {
        const track: TextTrack = {
          id: `${ri}:${it.id}`,
          listed: it.label === 'Always hide',
          label: it.label,
          type: it.type,
          value: it.value ?? '',
          start: r.from,
          end: scan.info.duration,
          keys: [{ t: r.t, rects }],
        }
        fresh.push(track)
        next.push({ track, seen: ri, misses: 0 })
      }
    }
    const moving = moves.filter((m) => Math.abs(m.dx) + Math.abs(m.dy) > 0.002)
    const dx = moving.length >= 2 ? median(moving.map((m) => m.dx)) : 0
    const dy = moving.length >= 2 ? median(moving.map((m) => m.dy)) : 0
    // A new item was somewhere else a moment ago when the screen scrolls: start it where it came from.
    for (const t of fresh) t.keys.unshift({ t: r.from, rects: shift(t.keys[0].rects, -dx, -dy) })
    const words = r.st.words.map((w) => ({ x: w.x / W, y: w.y / H, w: w.w / W, h: w.h / H }))
    for (const o of open) {
      const last = o.track.keys[o.track.keys.length - 1]
      const still = last.rects.every((b) => regionChanged(scan.readings[o.seen].sig, r.sig, b) < 0.05)
      const textThere = last.rects.some((b) => inked(r.sig, b) || words.some((w) => w.x < b.x + b.w && w.x + w.w > b.x && w.y < b.y + b.h && w.y + w.h > b.y))
      if (still) next.push(o)
      else if (textThere && o.misses < 2 && dx === 0 && dy === 0) next.push({ ...o, misses: o.misses + 1 })
      else {
        // It moved out of view or changed: follow the scroll until this reading.
        if (dx || dy) o.track.keys.push({ t: r.t, rects: shift(last.rects, dx, dy) })
        done.push({ ...o.track, end: r.t })
      }
    }
    open = next
  })
  return [...done, ...open.map((o) => o.track)].sort((a, b) => a.start - b.start)
}

/** Boxes of a track at time t: between two keys they move, grown by part of the move. */
function trackRects(tr: TextTrack, t: number): Frac[] {
  const keys = tr.keys
  let i = 0
  while (i + 1 < keys.length && keys[i + 1].t <= t) i++
  const a = keys[i]
  const b = keys[i + 1]
  if (!b || b.t <= a.t || t <= a.t) return a.rects
  const k = (t - a.t) / (b.t - a.t)
  return a.rects.map((ra, n) => {
    const rb = b.rects[n] ?? ra
    const dx = rb.x - ra.x
    const dy = rb.y - ra.y
    const grow = 0.25
    return {
      x: ra.x + dx * k - Math.abs(dx) * grow,
      y: ra.y + dy * k - Math.abs(dy) * grow,
      w: ra.w + (rb.w - ra.w) * k + Math.abs(dx) * grow * 2,
      h: ra.h + (rb.h - ra.h) * k + Math.abs(dy) * grow * 2,
    }
  })
}

export interface TimedBox {
  start: number
  end: number
  x: number
  y: number
  w: number
  h: number
}

/** Every box to paint at time t, in fractions of the frame. */
export function boxesAt(
  scan: Scan,
  tracks: readonly TextTrack[],
  kept: ReadonlySet<string>,
  faces: boolean,
  manual: readonly TimedBox[],
  t: number,
): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = []
  for (const tr of tracks) if (!kept.has(tr.id) && t >= tr.start && t <= tr.end) out.push(...trackRects(tr, t))
  if (faces) {
    for (const f of trackBoxesAt(scan.faces, t, 1.5 / SCAN_FPS)) {
      if (kept.has(`face-${f.id}`)) continue
      const px = f.w * 0.2
      const py = f.h * 0.25
      out.push({ x: (f.x - px) / scan.width, y: (f.y - py) / scan.height, w: (f.w + 2 * px) / scan.width, h: (f.h + 2 * py) / scan.height })
    }
  }
  for (const m of manual) if (t >= m.start && t <= m.end) out.push(m)
  return out
}
