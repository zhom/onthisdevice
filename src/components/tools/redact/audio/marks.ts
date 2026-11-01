/**
 * Which transcript words to bleep. The text tools' pattern rules and language
 * model run on the transcript; their spans are mapped back to words. Spoken
 * numbers get their own rule, because a speech transcript rarely has the
 * separators that the written-number rules look for.
 */
import { findListed, mergeSpans } from '@/lib/ml/text/merge'
import { findPii } from '@/lib/ml/text/pii-rules'
import type { EntityType, Span } from '@/lib/ml/text/types'
import type { Word } from '@/lib/ml/speech/types'

export type Category = 'names' | 'places' | 'numbers' | 'contact' | 'dates' | 'orgs' | 'list'

export const CATEGORIES: readonly { id: Exclude<Category, 'list'>; name: string; defaultOn: boolean }[] = [
  { id: 'names', name: 'Names', defaultOn: true },
  { id: 'numbers', name: 'Numbers', defaultOn: true },
  { id: 'places', name: 'Places and addresses', defaultOn: true },
  { id: 'contact', name: 'Emails and links', defaultOn: true },
  { id: 'dates', name: 'Dates', defaultOn: false },
  { id: 'orgs', name: 'Organizations', defaultOn: false },
]

const CATEGORY_OF: Partial<Record<EntityType, Category>> = {
  PERSON: 'names',
  LOCATION: 'places',
  ADDRESS: 'places',
  POSTCODE: 'places',
  PHONE: 'numbers',
  CARD: 'numbers',
  IBAN: 'numbers',
  ID: 'numbers',
  SECRET: 'numbers',
  EMAIL: 'contact',
  URL: 'contact',
  USERNAME: 'contact',
  IP: 'contact',
  MAC: 'contact',
  DOB: 'dates',
  DATE: 'dates',
  ORG: 'orgs',
}

export interface Transcript {
  text: string
  /** [start, end) of each word in `text`, without its leading space. */
  ranges: [number, number][]
}

export function transcriptOf(words: readonly Word[]): Transcript {
  let text = ''
  const ranges: [number, number][] = []
  for (const w of words) {
    const lead = w.text.length - w.text.trimStart().length
    const at = text.length
    text += w.text
    ranges.push([at + lead, at + w.text.trimEnd().length])
  }
  return { text, ranges }
}

/** Word indexes touched by each span, with the span's category. */
export function wordsOfSpans(t: Transcript, spans: readonly Span[]): Map<number, Category> {
  const out = new Map<number, Category>()
  for (const s of spans) {
    const cat = s.source === 'list' ? 'list' : CATEGORY_OF[s.type]
    if (!cat) continue
    for (let i = 0; i < t.ranges.length; i++) {
      const [a, b] = t.ranges[i]
      if (a < s.end && b > s.start && !out.has(i)) out.set(i, cat)
    }
  }
  return out
}

const SPELLED = new Set(['zero', 'oh', 'o', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'double', 'triple'])

/** Digits a word stands for: "4917" -> 4, "four" -> 1, "double" -> 1, other words -> 0. */
function digitCount(raw: string): number {
  const w = raw.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  if (!w) return 0
  if (/^\d+$/.test(w)) return w.length
  if (/^\d+(st|nd|rd|th)$/.test(w)) return 0
  return SPELLED.has(w) ? 1 : 0
}

/**
 * Runs of number words with at least `min` digits in all: "07700 900461",
 * "four nine one seven". A lone year (1900-2099) is left to the date rules.
 */
export function numberWords(words: readonly Word[], min = 3): Set<number> {
  const out = new Set<number>()
  let run: number[] = []
  let digits = 0
  const flush = () => {
    const lone = run.length === 1 ? words[run[0]].text.replace(/[^\d]/g, '') : ''
    const year = /^(19|20)\d\d$/.test(lone)
    if (digits >= min && !year) for (const i of run) out.add(i)
    run = []
    digits = 0
  }
  for (let i = 0; i < words.length; i++) {
    const n = digitCount(words[i].text)
    if (n > 0) {
      run.push(i)
      digits += n
      // A full stop ends the number.
      if (/[.!?]\s*$/.test(words[i].text)) flush()
    } else flush()
  }
  flush()
  return out
}

const TLD = /^\.?(com|org|net|io|co|uk|us|de|fr|es|it|nl|eu|edu|gov|info|biz|me|app|dev|ai)\.?[,;:!?]*$/i
const bare = (w: Word | undefined) => (w?.text ?? '').trim().toLowerCase().replace(/[,;:!?]+$/, '')

/**
 * Emails and web addresses read aloud: "priya dot raman at example dot com",
 * which the model may also write as "Priyaraman .example .com".
 */
export function spokenAddressWords(words: readonly Word[]): Set<number> {
  const out = new Set<number>()
  const joiner = (w: Word | undefined) => ['dot', 'at', '@'].includes(bare(w).replace(/\.$/, ''))
  const dotted = (w: Word | undefined) => /^[.@]/.test((w?.text ?? '').trim())
  for (let i = 1; i < words.length; i++) {
    if (!TLD.test(bare(words[i])) || !(dotted(words[i]) || bare(words[i - 1]) === 'dot')) continue
    let j = i
    for (let steps = 0; j > 0 && steps < 10; steps++) {
      if (joiner(words[j - 1]) || joiner(words[j]) || dotted(words[j]) || dotted(words[j - 1])) j--
      else break
    }
    for (let k = j; k <= i; k++) out.add(k)
  }
  return out
}

/** Pattern rules, the user's list and (optional) language model spans, as words by category. */
export function findMarks(words: readonly Word[], modelSpans: readonly Span[], list: readonly string[]): Map<number, Category> {
  const t = transcriptOf(words)
  const spans = mergeSpans(t.text, [...findPii(t.text), ...modelSpans, ...findListed(t.text, [...list])])
  const marks = wordsOfSpans(t, spans)
  // Spoken numbers and addresses win over the categories that are off by default.
  const weak = (i: number) => !marks.has(i) || marks.get(i) === 'dates' || marks.get(i) === 'orgs'
  for (const i of numberWords(words)) if (weak(i)) marks.set(i, 'numbers')
  for (const i of spokenAddressWords(words)) if (weak(i) || marks.get(i) === 'names') marks.set(i, 'contact')
  return marks
}

/** Words that match the always-bleep list, compared without case and punctuation. */
export function listTerms(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
}
