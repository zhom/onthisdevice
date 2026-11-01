/**
 * Follows detections over time and gives each object a stable id.
 *
 *   const tracker = new Tracker()
 *   tracker.update(t, detections)        // once per scanned frame, t in seconds, in order
 *   const tracks = tracker.finish()      // smoothed tracks, short noise dropped
 *   boxesAt(tracks, t, hold)             // interpolated boxes for any frame time
 *   tracker.current                      // open tracks, for a live view (keepEnded: false)
 *
 * Matching is greedy on IoU, with a centre-distance fallback for small,
 * fast objects whose boxes no longer overlap between scans. A track ends
 * when it has not been seen for `maxGap` seconds. `finish()` smooths each
 * track with a zero-lag [1 2 1] filter, so the boxes do not jitter and do
 * not trail behind a moving face.
 */
import { iou } from './geometry'
import type { Box, Detection } from './geometry'

export interface TrackKey extends Box {
  t: number
  score: number
}

export interface Track {
  id: number
  keys: TrackKey[]
  /** The key with the best score, for a thumbnail. */
  best: TrackKey
}

export interface TrackerOptions {
  /** Lowest IoU that counts as the same object. */
  minIou?: number
  /** Seconds a track survives without a detection. */
  maxGap?: number
  /** Tracks with fewer detections are dropped unless one score reaches `keepScore`. */
  minHits?: number
  keepScore?: number
  /** Keep ended tracks for finish(). Off for a live view, which only reads `current`. */
  keepEnded?: boolean
}

const DEFAULTS: Required<TrackerOptions> = { minIou: 0.2, maxGap: 0.8, minHits: 2, keepScore: 0.8, keepEnded: true }

export class Tracker {
  private readonly opts: Required<TrackerOptions>
  private active: Track[] = []
  private ended: Track[] = []
  private nextId = 1

  constructor(options: TrackerOptions = {}) {
    this.opts = { ...DEFAULTS, ...options }
  }

  /** Tracks open now, for a live view (camera). */
  get current(): readonly Track[] {
    return this.active
  }

  update(t: number, dets: Detection[]): Track[] {
    const { minIou, maxGap } = this.opts
    const still: Track[] = []
    for (const tr of this.active) {
      if (t - tr.keys[tr.keys.length - 1]!.t <= maxGap) still.push(tr)
      else if (this.opts.keepEnded) this.ended.push(tr)
    }
    this.active = still

    type Pair = { tr: Track; d: Detection; cost: number }
    const pairs: Pair[] = []
    for (const tr of this.active) {
      const last = predict(tr, t)
      for (const d of dets) {
        const overlap = iou(last, d)
        const dist = Math.hypot(last.x + last.w / 2 - (d.x + d.w / 2), last.y + last.h / 2 - (d.y + d.h / 2))
        const reach = 0.6 * Math.max(last.w, last.h, d.w, d.h)
        const sizeRatio = Math.max(d.w * d.h, 1) / Math.max(last.w * last.h, 1)
        if (overlap >= minIou) pairs.push({ tr, d, cost: 1 - overlap })
        else if (dist < reach && sizeRatio > 0.4 && sizeRatio < 2.5) pairs.push({ tr, d, cost: 1 + dist / reach })
      }
    }
    pairs.sort((a, b) => a.cost - b.cost)
    const usedT = new Set<Track>()
    const usedD = new Set<Detection>()
    for (const p of pairs) {
      if (usedT.has(p.tr) || usedD.has(p.d)) continue
      usedT.add(p.tr)
      usedD.add(p.d)
      const key = { x: p.d.x, y: p.d.y, w: p.d.w, h: p.d.h, t, score: p.d.score }
      p.tr.keys.push(key)
      if (!this.opts.keepEnded && p.tr.keys.length > 8) p.tr.keys.shift()
      if (key.score > p.tr.best.score) p.tr.best = key
    }
    for (const d of dets) {
      if (usedD.has(d)) continue
      const key = { x: d.x, y: d.y, w: d.w, h: d.h, t, score: d.score }
      this.active.push({ id: this.nextId++, keys: [key], best: key })
    }
    return this.active
  }

  finish(): Track[] {
    const { minHits, keepScore } = this.opts
    const all = [...this.ended, ...this.active]
    this.ended = []
    this.active = []
    return all
      .filter((tr) => tr.keys.length >= minHits || tr.best.score >= keepScore)
      .map((tr) => ({ ...tr, keys: smooth(tr.keys) }))
      .sort((a, b) => a.keys[0]!.t - b.keys[0]!.t)
  }
}

/** Constant-velocity guess of where a track is at time t. */
function predict(tr: Track, t: number): Box {
  const n = tr.keys.length
  const a = tr.keys[n - 1]!
  if (n < 2) return a
  const b = tr.keys[n - 2]!
  const dt = a.t - b.t
  if (dt <= 0) return a
  const k = Math.min(1, (t - a.t) / dt)
  return { x: a.x + (a.x - b.x) * k, y: a.y + (a.y - b.y) * k, w: a.w, h: a.h }
}

function smooth(keys: TrackKey[]): TrackKey[] {
  if (keys.length < 3) return keys
  return keys.map((k, i) => {
    const a = keys[Math.max(0, i - 1)]!
    const c = keys[Math.min(keys.length - 1, i + 1)]!
    const mix = (f: (b: TrackKey) => number) => (f(a) + 2 * f(k) + f(c)) / 4
    return { ...k, x: mix((b) => b.x), y: mix((b) => b.y), w: mix((b) => b.w), h: mix((b) => b.h) }
  })
}

export interface TimedBox extends Box {
  id: number
}

/**
 * Boxes of all tracks at time t: linear between keys, held for `hold`
 * seconds before the first and after the last key so a face is covered on
 * the frames between two scans.
 */
export function boxesAt(tracks: readonly Track[], t: number, hold = 0.2): TimedBox[] {
  const out: TimedBox[] = []
  for (const tr of tracks) {
    const keys = tr.keys
    const first = keys[0]!
    const last = keys[keys.length - 1]!
    if (t < first.t - hold || t > last.t + hold) continue
    if (t <= first.t) {
      out.push({ id: tr.id, x: first.x, y: first.y, w: first.w, h: first.h })
      continue
    }
    if (t >= last.t) {
      out.push({ id: tr.id, x: last.x, y: last.y, w: last.w, h: last.h })
      continue
    }
    let lo = 0
    let hi = keys.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (keys[mid]!.t <= t) lo = mid
      else hi = mid
    }
    const a = keys[lo]!
    const b = keys[hi]!
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0
    const lerp = (p: number, q: number) => p + (q - p) * f
    out.push({ id: tr.id, x: lerp(a.x, b.x), y: lerp(a.y, b.y), w: lerp(a.w, b.w), h: lerp(a.h, b.h) })
  }
  return out
}
