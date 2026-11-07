/**
 * Transcript formats: subtitle cues from timed words, SRT, WebVTT and plain text.
 */
import type { Word } from '../speech/types'

export interface Cue {
  start: number
  end: number
  text: string
}

export interface CueRules {
  /** Longest cue text in characters. */
  maxChars: number
  /** Longest cue in seconds. */
  maxSeconds: number
  /** A pause this long (seconds) starts a new cue. */
  gap: number
}

export const DEFAULT_RULES: CueRules = { maxChars: 42, maxSeconds: 6, gap: 0.8 }

const SENTENCE_END = /[.!?…。！？]["')\]]?$/

/** Groups words into cues: a new cue at a pause, after a sentence, or when one would be too long. */
export function toCues(words: readonly Word[], rules: CueRules = DEFAULT_RULES): Cue[] {
  const cues: Cue[] = []
  let cur: Cue | null = null
  for (const w of words) {
    const text = w.text.trim()
    if (!text) continue
    if (cur) {
      const joined = `${cur.text} ${text}`
      const prevEnds = SENTENCE_END.test(cur.text) && cur.text.length >= rules.maxChars / 3
      if (w.start - cur.end >= rules.gap || joined.length > rules.maxChars || w.end - cur.start > rules.maxSeconds || prevEnds) {
        cues.push(cur)
        cur = null
      } else {
        cur.text = joined
        cur.end = w.end
        continue
      }
    }
    cur = { start: w.start, end: w.end, text }
  }
  if (cur) cues.push(cur)
  // Cues never overlap and each lasts at least 0.5 s where there is room.
  for (let i = 0; i < cues.length; i++) {
    const next = cues[i + 1]
    const want = Math.max(cues[i].end, cues[i].start + 0.5)
    cues[i].end = next ? Math.min(want, next.start) : want
  }
  return cues
}

function stamp(t: number, sep: ',' | '.'): string {
  const ms = Math.max(0, Math.round(t * 1000))
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const pad = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`
}

export function toSrt(cues: readonly Cue[]): string {
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n')
}

export function toVtt(cues: readonly Cue[]): string {
  return `WEBVTT\n\n${cues.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n')}`
}

/** "1:05" or "1:02:05". */
export function clock(t: number): string {
  const s = Math.max(0, Math.floor(t))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** Paragraphs split at pauses of `gap` seconds or more, optionally each with its start time. */
export function toText(words: readonly Word[], opts: { timestamps?: boolean; gap?: number } = {}): string {
  const gap = opts.gap ?? 1.5
  const paras: { start: number; text: string }[] = []
  let prevEnd = -Infinity
  for (const w of words) {
    const text = w.text.trim()
    if (!text) continue
    const last = paras[paras.length - 1]
    if (!last || w.start - prevEnd >= gap) paras.push({ start: w.start, text })
    else last.text += ` ${text}`
    prevEnd = w.end
  }
  return paras.map((p) => (opts.timestamps ? `[${clock(p.start)}] ${p.text}` : p.text)).join('\n\n')
}
