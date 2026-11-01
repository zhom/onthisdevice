/**
 * Combines spans from the rules, the language model, chat sender detection
 * and the user's always-hide list into one list without overlaps.
 */
import { findPii } from './pii-rules'
import { findSecrets } from './secret-rules'
import type { EntityType, Span } from './types'

/** Higher wins an overlap. */
function priority(s: Span): number {
  switch (s.source) {
    case 'list':
      return 100
    case 'chat':
      return 95
    case 'model':
      return 30 + s.score * 10
  }
  if (s.type === 'SECRET') return s.rule === 'high-entropy' ? 62 : 90
  if (s.score >= 1) return 85 // checksum-backed
  switch (s.type) {
    case 'EMAIL':
    case 'URL':
    case 'CARD':
    case 'IBAN':
    case 'IP':
    case 'MAC':
      return 80
    case 'PHONE':
      return 74
    case 'ID':
      return s.score >= 0.9 ? 82 : 70
    case 'DOB':
    case 'DATE':
      return 66
    case 'USERNAME':
      return 64
    default:
      return 50 + s.score * 10
  }
}

const EDGE = /[\s.,;:!?'"()[\]{}<>«»“”‘’]/

/** Shrinks a span so it does not start or end on space or punctuation. */
export function trimSpan(text: string, s: Span): Span | null {
  let { start, end } = s
  while (start < end && EDGE.test(text[start])) {
    // Keep an opening bracket that is closed inside the span: "(415) 555-0134".
    if (text[start] === '(' && text.slice(start, end).includes(')')) break
    start++
  }
  while (end > start && EDGE.test(text[end - 1])) {
    // Keep a closing bracket that has its opening one inside the span.
    const c = text[end - 1]
    if (c === ')' && text.slice(start, end).includes('(')) break
    if (c === '.' && /^(?:[A-Z]|Jr|Sr|Inc|Ltd|Co|St|Dr|Ave|Rd|[a-z])$/.test(text.slice(start, end - 1).split(/\s+/).pop() ?? '')) break
    end--
  }
  if (end <= start) return null
  return start === s.start && end === s.end ? s : { ...s, start, end }
}

/**
 * Picks the best non-overlapping spans. A model address or an always-hide
 * match that partly overlaps a chosen span keeps its uncovered parts when they
 * still hold a word.
 */
export function mergeSpans(text: string, spans: Span[]): Span[] {
  const ranked = spans
    .map((s) => trimSpan(text, s))
    .filter((s): s is Span => s !== null)
    .sort((a, b) => priority(b) - priority(a) || b.end - b.start - (a.end - a.start) || a.start - b.start)
  // Chosen spans never overlap, so sorted by start they are also sorted by end.
  const chosen: Span[] = []
  const firstEndingAfter = (a: number) => {
    let lo = 0
    let hi = chosen.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (chosen[mid].end <= a) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  const overlaps = (a: number, b: number) => {
    const out: Span[] = []
    for (let i = firstEndingAfter(a); i < chosen.length && chosen[i].start < b; i++) out.push(chosen[i])
    return out
  }
  const insert = (s: Span) => chosen.splice(firstEndingAfter(s.start), 0, s)
  for (const s of ranked) {
    const hits = overlaps(s.start, s.end)
    if (hits.length === 0) {
      insert(s)
      continue
    }
    // An address from the model often runs past the street a rule found ("…, London");
    // keep the uncovered pieces. Other overlapping model spans are dropped: "Thanks Marco"
    // after a rule or a chat sender took "Marco" must not leave "Thanks".
    if (!(s.source === 'model' && s.type === 'ADDRESS') && s.source !== 'list') continue
    let at = s.start
    const pieces: Span[] = []
    for (const h of hits) {
      if (h.start > at) pieces.push({ ...s, start: at, end: h.start })
      at = Math.max(at, h.end)
    }
    if (at < s.end) pieces.push({ ...s, start: at, end: s.end })
    for (const p of pieces) {
      const t = trimSpan(text, p)
      if (t && /[\p{L}\p{N}]{2,}/u.test(text.slice(t.start, t.end)) && overlaps(t.start, t.end).length === 0) insert(t)
    }
  }
  return chosen
}

/** Every match of each always-hide term, case-insensitive, on word edges where the term has them. */
export function findListed(text: string, terms: string[]): Span[] {
  const out: Span[] = []
  for (const raw of terms) {
    const term = raw.trim()
    if (term.length < 2) continue
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    const lead = /^[\p{L}\p{N}_]/u.test(term) ? '(?<![\\p{L}\\p{N}_])' : ''
    const tail = /[\p{L}\p{N}_]$/u.test(term) ? '(?![\\p{L}\\p{N}_])' : ''
    const re = new RegExp(`${lead}${escaped}${tail}`, 'giu')
    for (const m of text.matchAll(re)) {
      out.push({ start: m.index, end: m.index + m[0].length, type: 'PERSON', source: 'list', score: 1, rule: 'always-hide', label: term })
    }
  }
  return out
}

export interface RuleOptions {
  pii?: boolean
  secrets?: boolean
  /** Flag long random strings by entropy (default on). */
  entropy?: boolean
  /** Flag internal host names such as db.corp or *.svc.cluster.local. */
  hosts?: boolean
}

/** Runs the pattern rules. The result is merged and sorted. */
export function detectRules(text: string, options: RuleOptions = {}): Span[] {
  const spans: Span[] = []
  if (options.pii !== false) spans.push(...findPii(text))
  if (options.secrets !== false) spans.push(...findSecrets(text, { entropy: options.entropy, hosts: options.hosts }))
  return mergeSpans(text, spans)
}

/** Keeps spans of the chosen types. List and chat spans always stay. */
export function filterTypes(spans: Span[], types: ReadonlySet<EntityType>): Span[] {
  return spans.filter((s) => s.source === 'list' || s.source === 'chat' || types.has(s.type))
}
