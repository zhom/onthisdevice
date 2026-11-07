/** Text measurements: word and letter frequency, sentences, paragraphs, readability indices, palindromes. */
import { STOP_WORDS, countSyllables, normalizeWord, splitSentences, words } from '@/components/tools/text/text-core'

export interface Count {
  term: string
  count: number
  share: number
}

function ranked(counts: Map<string, number>, total: number): Count[] {
  return [...counts]
    .map(([term, count]) => ({ term, count, share: total ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
}

export function wordFrequency(text: string, o: { phrase: number; stopWords: boolean; minLength: number; caseSensitive: boolean }): { items: Count[]; total: number } {
  const tokens = words(text)
    .map((t) => (o.caseSensitive ? t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') : normalizeWord(t)))
    .filter(Boolean)
  const keep = (w: string) => w.length >= o.minLength && (o.stopWords || !STOP_WORDS.has(w.toLowerCase()))
  const counts = new Map<string, number>()
  let total = 0
  const n = Math.max(1, Math.min(3, Math.round(o.phrase)))
  for (let i = 0; i + n <= tokens.length; i++) {
    const gram = tokens.slice(i, i + n)
    // A phrase is kept when its first and last words are kept, so "state of the art" style phrases survive.
    if (!keep(gram[0]) || !keep(gram[n - 1])) continue
    const term = gram.join(' ')
    counts.set(term, (counts.get(term) ?? 0) + 1)
    total++
  }
  return { items: ranked(counts, total), total }
}

export function letterFrequency(text: string, o: { lettersOnly: boolean; caseSensitive: boolean; spaces: boolean }): { items: Count[]; total: number } {
  const counts = new Map<string, number>()
  let total = 0
  for (const raw of text) {
    if (/\s/.test(raw) && !(o.spaces && raw === ' ')) continue
    if (o.lettersOnly && !/\p{L}/u.test(raw)) continue
    const c = o.caseSensitive ? raw : raw.toLowerCase()
    counts.set(c, (counts.get(c) ?? 0) + 1)
    total++
  }
  return { items: ranked(counts, total), total }
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export interface Readability {
  words: number
  sentences: number
  syllables: number
  letters: number
  complex: number
  readingEase: number
  fkGrade: number
  fog: number
  smog: number
  colemanLiau: number
  ari: number
  longest: { sentence: string; words: number }[]
}

export function readability(text: string): Readability {
  const sentences = splitSentences(text)
  const ws = words(text).map((w) => w.replace(/[^\p{L}\p{N}'’-]/gu, '')).filter(Boolean)
  const nW = ws.length
  const nS = Math.max(1, sentences.length)
  let syllables = 0
  let complex = 0
  let letters = 0
  for (const w of ws) {
    const s = countSyllables(w)
    syllables += s
    if (s >= 3) complex++
    letters += (w.match(/[\p{L}\p{N}]/gu) ?? []).length
  }
  const wps = nW / nS
  const spw = nW ? syllables / nW : 0
  const longest = sentences
    .map((s) => ({ sentence: s, words: words(s).length }))
    .sort((a, b) => b.words - a.words)
    .slice(0, 5)
  return {
    words: nW,
    sentences: sentences.length,
    syllables,
    letters,
    complex,
    readingEase: 206.835 - 1.015 * wps - 84.6 * spw,
    fkGrade: 0.39 * wps + 11.8 * spw - 15.59,
    fog: 0.4 * (wps + (nW ? (100 * complex) / nW : 0)),
    smog: 1.043 * Math.sqrt(complex * (30 / nS)) + 3.1291,
    colemanLiau: nW ? 0.0588 * ((letters / nW) * 100) - 0.296 * ((sentences.length / nW) * 100) - 15.8 : 0,
    ari: nW ? 4.71 * (letters / nW) + 0.5 * wps - 21.43 : 0,
    longest,
  }
}

/** Flesch Reading Ease bands (Flesch, 1948). */
export function easeBand(score: number): string {
  if (score >= 90) return 'Very easy (age 11)'
  if (score >= 80) return 'Easy'
  if (score >= 70) return 'Fairly easy'
  if (score >= 60) return 'Plain English (age 13 to 15)'
  if (score >= 50) return 'Fairly difficult'
  if (score >= 30) return 'Difficult (college)'
  return 'Very difficult (graduate)'
}

/** Letters and digits only, lowercased, accents removed: the form a palindrome is judged in. */
export function palindromeKey(text: string, strict: boolean): string {
  if (strict) return text
  return text
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

export function isPalindrome(text: string, strict: boolean): boolean {
  const k = [...palindromeKey(text, strict)]
  if (k.length === 0) return false
  for (let i = 0, j = k.length - 1; i < j; i++, j--) if (k[i] !== k[j]) return false
  return true
}

/** Longest palindromic run of letters and digits (expand around centers), as it appears in the key. */
export function longestPalindrome(text: string): string {
  const s = [...palindromeKey(text, false)]
  let best = [0, 0]
  for (let c = 0; c < s.length; c++) {
    for (const [l0, r0] of [
      [c, c],
      [c, c + 1],
    ]) {
      let l = l0
      let r = r0
      while (l >= 0 && r < s.length && s[l] === s[r]) {
        l--
        r++
      }
      if (r - l - 1 > best[1] - best[0]) best = [l + 1, r]
    }
  }
  return s.slice(best[0], best[1]).join('')
}
