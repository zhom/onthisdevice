/** Word data from /data/words (see scripts/data/hf-words.mjs) and the searches over it. Files load once per page. */
import manifest from '@/data/words.json'
import { loadJson, loadText } from '@/components/tools/reference/data'

const base = manifest.files

let wordsP: Promise<string[]> | null = null
export function words(): Promise<string[]> {
  wordsP ??= loadText(`${base}/words.txt`).then((t) => t.split('\n').filter(Boolean))
  return wordsP
}

/** Frequency rank (0 = most common). */
let rankP: Promise<Map<string, number>> | null = null
export function ranks(): Promise<Map<string, number>> {
  rankP ??= words().then((w) => new Map(w.map((x, i) => [x, i])))
  return rankP
}

let cmuP: Promise<Map<string, string[]>> | null = null
/** word -> pronunciations, each a space-separated ARPAbet string with stress digits. */
export function cmu(): Promise<Map<string, string[]>> {
  cmuP ??= loadText(`${base}/cmudict.txt`).then((t) => {
    const m = new Map<string, string[]>()
    for (const line of t.split('\n')) {
      const i = line.indexOf(' ')
      if (i < 0) continue
      const w = line.slice(0, i)
      m.set(w, [...(m.get(w) ?? []), line.slice(i + 1)])
    }
    return m
  })
  return cmuP
}

export type Sense = [pos: string, definition: string, examples: string[], synonyms: string[]]
export interface Entry {
  s: Sense[]
  a?: string[]
}

const shard = (key: string) => (/^[a-z]/.test(key) ? key[0] : '0')
export const loadShard = (key: string) => loadJson<Record<string, Entry>>(`${base}/wordnet/${shard(key)}.json`)

/** Base forms to try for an inflected word: dogs, running, happier, children. */
export function baseForms(word: string): string[] {
  const w = word.toLowerCase()
  const out = [w]
  const rules: [RegExp, string][] = [
    [/ies$/, 'y'], [/ves$/, 'f'], [/ves$/, 'fe'], [/es$/, ''], [/s$/, ''], [/men$/, 'man'], [/ren$/, ''],
    [/ied$/, 'y'], [/ed$/, ''], [/ed$/, 'e'], [/([^aeiou])\1ed$/, '$1'],
    [/ying$/, 'ie'], [/ing$/, ''], [/ing$/, 'e'], [/([^aeiou])\1ing$/, '$1'],
    [/ier$/, 'y'], [/er$/, ''], [/er$/, 'e'], [/([^aeiou])\1er$/, '$1'], [/iest$/, 'y'], [/est$/, ''], [/est$/, 'e'], [/([^aeiou])\1est$/, '$1'],
  ]
  for (const [re, rep] of rules) if (re.test(w)) out.push(w.replace(re, rep))
  return [...new Set(out)].filter((x) => x.length > 1)
}

export async function lookup(word: string): Promise<{ lemma: string; entry: Entry } | null> {
  for (const form of baseForms(word.trim())) {
    const e = (await loadShard(form))[form]
    if (e) return { lemma: form, entry: e }
  }
  return null
}

/* ── pronunciation ── */

const VOWEL = /\d$/

export const syllablesOf = (phones: string) => phones.split(' ').filter((p) => VOWEL.test(p)).length

/** The rhyming part: from the last stressed vowel (primary, else secondary, else last vowel) to the end. */
export function rhymePart(phones: string): string {
  const p = phones.split(' ')
  let i = p.findLastIndex((x) => x.endsWith('1'))
  if (i < 0) i = p.findLastIndex((x) => x.endsWith('2'))
  if (i < 0) i = p.findLastIndex((x) => VOWEL.test(x))
  return p.slice(Math.max(0, i)).join(' ').replace(/\d/g, '')
}

/** Syllables of any word: the dictionary when it has the word, else a vowel-group estimate. */
export function estimateSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  if (w.length <= 3) return 1
  const groups = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g)
  return Math.max(1, groups?.length ?? 1)
}

/* ── letter searches ── */

export function letterCounts(s: string): Int8Array {
  const c = new Int8Array(26)
  for (const ch of s) {
    const i = ch.charCodeAt(0) - 97
    if (i >= 0 && i < 26) c[i]++
  }
  return c
}

/** Whether `word` can be made from the letters, using blanks for missing letters. */
export function fits(word: string, have: Int8Array, blanks: number): boolean {
  const need = letterCounts(word)
  let short = 0
  for (let i = 0; i < 26; i++) if (need[i] > have[i]) short += need[i] - have[i]
  return short <= blanks
}

export const SCRABBLE: Record<string, number> = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3, n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10,
}

/** Tile score; letters covered by blanks score 0, and the blanks go on the cheapest letters. */
export function scrabbleScore(word: string, have: Int8Array): number {
  const need = letterCounts(word)
  let score = 0
  for (let i = 0; i < 26; i++) score += Math.min(need[i], have[i]) * SCRABBLE[String.fromCharCode(97 + i)]
  return score
}

/** Crossword pattern: letters, and ? . _ or * for one unknown letter. */
export function patternRegex(pattern: string): RegExp {
  const p = pattern.toLowerCase().replace(/\s+/g, '')
  if (!/^[a-z?._*]+$/.test(p)) throw new Error('Use letters for known squares and ? for unknown ones, such as c?o?s?o?d.')
  return new RegExp(`^${p.replace(/[?._*]/g, '[a-z]')}$`)
}

export interface WordleClues {
  greens: (string | null)[]
  /** Letters in the word but not at these positions. */
  yellows: { letter: string; not: number[] }[]
  grays: Set<string>
}

/** "a1 e" style: a letter with optional 1-based positions where it is yellow. */
export function parseYellows(text: string): WordleClues['yellows'] {
  return (text.toLowerCase().match(/[a-z]\d*/g) ?? []).map((t) => ({ letter: t[0], not: [...t.slice(1)].map((d) => Number(d) - 1).filter((i) => i >= 0 && i < 5) }))
}

export function wordleMatch(word: string, c: WordleClues): boolean {
  if (word.length !== 5) return false
  for (let i = 0; i < 5; i++) {
    const g = c.greens[i]
    if (g && word[i] !== g) return false
  }
  for (const y of c.yellows) {
    if (!word.includes(y.letter)) return false
    if (y.not.some((i) => word[i] === y.letter)) return false
  }
  const required = new Set([...c.greens.filter((x): x is string => !!x), ...c.yellows.map((y) => y.letter)])
  for (let i = 0; i < 5; i++) {
    const ch = word[i]
    // A gray letter can still appear where it is green or yellow elsewhere (repeated letters).
    if (c.grays.has(ch) && !required.has(ch)) return false
  }
  return true
}

/* ── quotes ── */

export type Quote = [text: string, author: string, tags: string[]]

let quotesP: Promise<Quote[]> | null = null
export function quotes(): Promise<Quote[]> {
  quotesP ??= loadJson<Quote[]>(`${base}/quotes.json`)
  return quotesP
}
