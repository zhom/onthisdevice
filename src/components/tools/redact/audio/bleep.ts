/**
 * Where to bleep and how it sounds. Pure functions, used by the WAV export,
 * the video export (per decoded chunk) and the tests.
 *
 *   cutsFor(words, marked, pad)      time ranges to cover, padded and merged
 *   applyCuts(samples, rate, t0, cuts, sound)
 *                                    replaces the sound inside each cut in place;
 *                                    `t0` is the time of samples[0], so the result
 *                                    is the same whether a file is processed whole
 *                                    or in chunks (the tone keeps its phase)
 */
import type { Word } from '@/lib/ml/speech/types'

export interface Cut {
  start: number
  end: number
}

export type BleepKind = 'tone' | 'silence' | 'noise'

export interface BleepSound {
  kind: BleepKind
  /** Peak level of the tone or noise, 0..1. */
  level: number
}

export const TONE_HZ = 1000
/** Fade at each edge of a cut, inside the padding, so it does not click. */
export const FADE_S = 0.008
/** Cuts closer than this are joined into one. */
const JOIN_S = 0.15

/** Padded, sorted, merged ranges of the marked words. */
export function cutsFor(words: readonly Word[], marked: ReadonlySet<number>, pad: number, duration = Infinity): Cut[] {
  const raw = [...marked]
    .filter((i) => words[i])
    .map((i) => ({ start: Math.max(0, words[i].start - pad), end: Math.min(duration, words[i].end + pad) }))
    .sort((a, b) => a.start - b.start)
  const out: Cut[] = []
  for (const c of raw) {
    const last = out[out.length - 1]
    if (last && c.start - last.end < JOIN_S) last.end = Math.max(last.end, c.end)
    else out.push({ ...c })
  }
  return out
}

/** 0 outside the cut, 1 inside, with a raised-cosine fade at both edges. */
function gainAt(t: number, c: Cut): number {
  if (t < c.start || t >= c.end) return 0
  const fade = Math.min(FADE_S, (c.end - c.start) / 2)
  const into = t - c.start
  const left = c.end - t
  const edge = Math.min(into, left)
  return edge >= fade ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * edge) / fade)
}

export function applyCuts(samples: Float32Array, rate: number, t0: number, cuts: readonly Cut[], sound: BleepSound): void {
  const t1 = t0 + samples.length / rate
  const w = 2 * Math.PI * TONE_HZ
  for (const c of cuts) {
    if (c.end <= t0 || c.start >= t1) continue
    const a = Math.max(0, Math.floor((c.start - t0) * rate))
    const b = Math.min(samples.length, Math.ceil((c.end - t0) * rate))
    for (let i = a; i < b; i++) {
      const t = t0 + i / rate
      const g = gainAt(t, c)
      if (g === 0) continue
      const fx = sound.kind === 'tone' ? sound.level * Math.sin(w * t) : sound.kind === 'noise' ? sound.level * (Math.random() * 2 - 1) : 0
      samples[i] = samples[i] * (1 - g) + fx * g
    }
  }
}

/** Total seconds covered by the cuts. */
export function cutSeconds(cuts: readonly Cut[]): number {
  return cuts.reduce((s, c) => s + (c.end - c.start), 0)
}
