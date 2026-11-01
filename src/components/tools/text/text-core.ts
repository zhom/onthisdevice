/**
 * Shared, dependency-free text primitives for the Text Tools category.
 *
 * Everything here is pure and synchronous unless it takes a `ChunkCtx`, in
 * which case it yields to the browser between chunks so multi-megabyte inputs
 * never lock the tab.
 */

import { nextFrame } from '@/lib/utils'

/* ────────────────────────────── cancellation ───────────────────────────── */

/** Thrown by chunked helpers when the caller signals that work is stale. */
export class Cancelled extends Error {
  constructor() {
    super('cancelled')
    this.name = 'Cancelled'
  }
}

export interface ChunkCtx {
  /** Report 0-100 completion. */
  progress?: (pct: number) => void
  /** Return true to abandon the run (throws `Cancelled`). */
  cancelled?: () => boolean
  /** Lines (or items) processed between paints. */
  chunkSize?: number
}

/* ─────────────────────────────── line utils ────────────────────────────── */

/** Splits on CRLF, CR or LF. `"a\n"` yields `["a", ""]`. */
export function splitLines(text: string): string[] {
  if (text === '') return ['']
  return text.split(/\r\n|\r|\n/)
}

export function countLines(text: string): number {
  if (text === '') return 0
  let n = 1
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 10) n++
    else if (c === 13) {
      if (text.charCodeAt(i + 1) === 10) i++
      n++
    }
  }
  return n
}

/**
 * Walks the lines of `text` in chunks, awaiting a frame between them.
 * Returns the number of lines visited.
 */
export async function forEachLineChunked(
  text: string,
  onLine: (line: string, index: number) => void,
  ctx: ChunkCtx = {},
): Promise<number> {
  const chunkSize = ctx.chunkSize ?? 4000
  const total = text.length || 1
  let start = 0
  let index = 0
  let sinceYield = 0

  for (;;) {
    if (ctx.cancelled?.()) throw new Cancelled()
    let end = text.indexOf('\n', start)
    let next: number
    if (end === -1) {
      end = text.length
      next = text.length + 1
    } else {
      next = end + 1
      if (end > start && text.charCodeAt(end - 1) === 13) end -= 1
    }

    onLine(text.slice(start, end), index)
    index++
    sinceYield++

    if (next > text.length) break
    start = next

    if (sinceYield >= chunkSize) {
      sinceYield = 0
      ctx.progress?.(Math.min(99, (start / total) * 100))
      await nextFrame()
    }
  }

  ctx.progress?.(100)
  return index
}

/** Maps every line of `text` through `fn`, chunked. */
export async function mapLinesChunked(
  text: string,
  fn: (line: string, index: number) => string | null,
  ctx: ChunkCtx = {},
): Promise<string[]> {
  const out: string[] = []
  await forEachLineChunked(
    text,
    (line, i) => {
      const mapped = fn(line, i)
      if (mapped !== null) out.push(mapped)
    },
    ctx,
  )
  return out
}

/** Runs `fn` over an array in chunks, yielding to the browser between them. */
export async function forEachChunked<T>(
  items: readonly T[],
  fn: (item: T, index: number) => void,
  ctx: ChunkCtx = {},
): Promise<void> {
  const chunkSize = ctx.chunkSize ?? 4000
  for (let i = 0; i < items.length; i++) {
    fn(items[i], i)
    if ((i + 1) % chunkSize === 0) {
      if (ctx.cancelled?.()) throw new Cancelled()
      ctx.progress?.((i / items.length) * 100)
      await nextFrame()
    }
  }
  if (ctx.cancelled?.()) throw new Cancelled()
  ctx.progress?.(100)
}

/* ──────────────────────────── word primitives ──────────────────────────── */

const WORD_CHAR = /[\p{L}\p{N}]/u
const EDGE_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu

export function hasWordChar(s: string): boolean {
  return WORD_CHAR.test(s)
}

/** `"(Hello,"` → `"hello"`. Keeps internal apostrophes and hyphens. */
export function normalizeWord(token: string): string {
  return token.toLowerCase().replace(EDGE_PUNCT, '').replace(/[’']/g, "'")
}

/** Whitespace-delimited tokens that contain at least one letter or digit. */
export function words(text: string): string[] {
  const out: string[] = []
  for (const token of text.split(/\s+/)) {
    if (token && hasWordChar(token)) out.push(token)
  }
  return out
}

export function countWords(text: string): number {
  let n = 0
  let inToken = false
  let tokenHasWordChar = false
  for (let i = 0; i <= text.length; i++) {
    const ch = i < text.length ? text[i] : ' '
    const isSpace = i === text.length || /\s/.test(ch)
    if (isSpace) {
      if (inToken && tokenHasWordChar) n++
      inToken = false
      tokenHasWordChar = false
    } else {
      inToken = true
      if (!tokenHasWordChar && WORD_CHAR.test(ch)) tokenHasWordChar = true
    }
  }
  return n
}

/** UTF-8 length in bytes, without allocating an encoder per call. */
let sharedEncoder: TextEncoder | null = null
export function utf8Bytes(text: string): number {
  if (typeof TextEncoder === 'undefined') {
    // Manual fallback (never hit in a real browser).
    return unescape(encodeURIComponent(text)).length
  }
  sharedEncoder ??= new TextEncoder()
  return sharedEncoder.encode(text).length
}

/** English stop words, used for keyword density and slug cleanup. */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
  "aren't", 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both',
  'but', 'by', "can't", 'cannot', 'could', "couldn't", 'did', "didn't", 'do', 'does', "doesn't",
  'doing', "don't", 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', "hadn't",
  'has', "hasn't", 'have', "haven't", 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', "isn't", 'it', 'its', 'itself', 'just',
  'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only',
  'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan',
  'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', "wasn't", 'we', 'were', "weren't", 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', "won't", 'would', 'you',
  'your', 'yours', 'yourself', 'yourselves',
])

/** Abbreviations whose full stop should not end a sentence. */
const ABBREVIATIONS: ReadonlySet<string> = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'vs', 'etc', 'e.g', 'i.e', 'inc',
  'ltd', 'co', 'corp', 'dept', 'est', 'fig', 'no', 'vol', 'approx', 'appt', 'apt', 'ave', 'blvd',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
])

/** Rough English syllable estimate — good enough for readability indices. */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  if (w.length <= 3) return 1
  const trimmed = w
    .replace(/(?:[^laeiouy]es|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
  const groups = trimmed.match(/[aeiouy]{1,2}/g)
  const n = groups ? groups.length : 1
  return Math.max(1, n)
}

/* ─────────────────────────── sentence splitting ────────────────────────── */

const TERMINATORS = '.!?…。！？'

/**
 * Streaming sentence splitter. Feed it line by line; a sentence ends at
 * terminating punctuation followed by whitespace/end, or at a blank line.
 */
export class SentenceStream {
  private buffer = ''
  constructor(private readonly emit: (sentence: string) => void) {}

  feedLine(line: string): void {
    if (line.trim() === '') {
      this.flush()
      return
    }
    let start = 0
    for (let i = 0; i < line.length; i++) {
      if (!TERMINATORS.includes(line[i])) continue
      let j = i
      while (j + 1 < line.length && TERMINATORS.includes(line[j + 1])) j++
      const after = line[j + 1]
      const endsHere = after === undefined || /[\s"'”’)\]]/.test(after)
      if (endsHere && !this.isAbbreviation(line, i)) {
        this.push(line.slice(start, j + 1))
        this.flush()
        start = j + 1
      }
      i = j
    }
    const tail = line.slice(start)
    if (tail) this.push(tail)
    this.push(' ')
  }

  private isAbbreviation(line: string, dotIndex: number): boolean {
    if (line[dotIndex] !== '.') return false
    let k = dotIndex - 1
    while (k >= 0 && /[A-Za-z.]/.test(line[k])) k--
    const token = line.slice(k + 1, dotIndex).toLowerCase()
    if (token.length === 1) return true // initials: "J. R. R. Tolkien"
    return ABBREVIATIONS.has(token)
  }

  private push(part: string): void {
    this.buffer += part
  }

  flush(): void {
    const s = this.buffer.trim()
    this.buffer = ''
    if (s && hasWordChar(s)) this.emit(s)
  }
}

/** Convenience wrapper for small inputs. */
export function splitSentences(text: string): string[] {
  const out: string[] = []
  const stream = new SentenceStream((s) => out.push(s))
  for (const line of splitLines(text)) stream.feedLine(line)
  stream.flush()
  return out
}

/* ─────────────────────────────── analysis ──────────────────────────────── */

export interface KeywordEntry {
  term: string
  count: number
  /** Share of all counted terms, 0-100. */
  density: number
}

export interface TextStats {
  characters: number
  charactersNoSpaces: number
  charactersNoWhitespace: number
  words: number
  uniqueWords: number
  sentences: number
  paragraphs: number
  lines: number
  nonEmptyLines: number
  bytes: number
  longestWord: string
  averageWordLength: number
  averageSentenceWords: number
  longestSentenceWords: number
  averageParagraphSentences: number
  syllables: number
  /** Flesch Reading Ease, 0-100 (higher = easier). NaN when there is no prose. */
  readingEase: number
  /** Flesch-Kincaid US grade level. NaN when there is no prose. */
  gradeLevel: number
  readingSeconds: number
  speakingSeconds: number
  keywords: KeywordEntry[]
  /** Total terms considered for density (after stop-word filtering). */
  keywordTotal: number
}

export interface AnalyzeOptions {
  /** 1 = single words, 2 = two-word phrases, 3 = three-word phrases. */
  phraseLength?: 1 | 2 | 3
  excludeStopWords?: boolean
  readingWpm?: number
  speakingWpm?: number
  topKeywords?: number
}

export const EMPTY_STATS: TextStats = {
  characters: 0,
  charactersNoSpaces: 0,
  charactersNoWhitespace: 0,
  words: 0,
  uniqueWords: 0,
  sentences: 0,
  paragraphs: 0,
  lines: 0,
  nonEmptyLines: 0,
  bytes: 0,
  longestWord: '',
  averageWordLength: 0,
  averageSentenceWords: 0,
  longestSentenceWords: 0,
  averageParagraphSentences: 0,
  syllables: 0,
  readingEase: Number.NaN,
  gradeLevel: Number.NaN,
  readingSeconds: 0,
  speakingSeconds: 0,
  keywords: [],
  keywordTotal: 0,
}

export async function analyzeText(
  text: string,
  options: AnalyzeOptions = {},
  ctx: ChunkCtx = {},
): Promise<TextStats> {
  const phraseLength = options.phraseLength ?? 1
  const excludeStopWords = options.excludeStopWords ?? false
  const readingWpm = options.readingWpm ?? 238
  const speakingWpm = options.speakingWpm ?? 140
  const topKeywords = options.topKeywords ?? 20

  if (text === '') return { ...EMPTY_STATS }

  let characters = text.length
  let spaces = 0
  let whitespace = 0
  let wordCount = 0
  let letterCount = 0
  let syllables = 0
  let longestWord = ''
  let nonEmptyLines = 0
  let sentenceCount = 0
  let sentenceWordTotal = 0
  let longestSentenceWords = 0
  let paragraphCount = 0
  let inParagraph = false

  const freq = new Map<string, number>()
  const unique = new Set<string>()
  let keywordTotal = 0
  let phraseWindow: string[] = []

  const addTerm = (term: string) => {
    freq.set(term, (freq.get(term) ?? 0) + 1)
    keywordTotal++
  }

  const stream = new SentenceStream((sentence) => {
    sentenceCount++
    const n = countWords(sentence)
    sentenceWordTotal += n
    if (n > longestSentenceWords) longestSentenceWords = n
  })

  const lineCount = await forEachLineChunked(
    text,
    (line) => {
      const trimmed = line.trim()
      if (trimmed === '') {
        inParagraph = false
        phraseWindow = []
      } else {
        nonEmptyLines++
        if (!inParagraph) {
          inParagraph = true
          paragraphCount++
        }
      }

      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === ' ' || ch === '\t') {
          spaces++
          whitespace++
        }
      }

      stream.feedLine(line)

      for (const token of line.split(/\s+/)) {
        if (!token || !hasWordChar(token)) continue
        wordCount++
        const normalized = normalizeWord(token)
        if (normalized) {
          letterCount += normalized.length
          syllables += countSyllables(normalized)
          if (normalized.length > longestWord.length) longestWord = normalized
          unique.add(normalized)

          if (phraseLength === 1) {
            if (!excludeStopWords || !STOP_WORDS.has(normalized)) addTerm(normalized)
          } else {
            phraseWindow.push(normalized)
            if (phraseWindow.length > phraseLength) phraseWindow.shift()
            if (phraseWindow.length === phraseLength) {
              const skip =
                excludeStopWords && phraseWindow.every((w) => STOP_WORDS.has(w))
              if (!skip) addTerm(phraseWindow.join(' '))
            }
          }
        }
      }
    },
    ctx,
  )

  stream.flush()

  // Newlines are whitespace too, but not "spaces" for the classic
  // "characters without spaces" figure.
  whitespace += Math.max(0, lineCount - 1)

  const keywords: KeywordEntry[] = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topKeywords)
    .map(([term, count]) => ({
      term,
      count,
      density: keywordTotal > 0 ? (count / keywordTotal) * 100 : 0,
    }))

  const averageSentenceWords = sentenceCount > 0 ? wordCount / sentenceCount : 0
  const wordsPerSentence = averageSentenceWords
  const syllablesPerWord = wordCount > 0 ? syllables / wordCount : 0
  const hasProse = wordCount >= 10 && sentenceCount > 0

  return {
    characters,
    charactersNoSpaces: characters - spaces,
    charactersNoWhitespace: characters - whitespace,
    words: wordCount,
    uniqueWords: unique.size,
    sentences: sentenceCount,
    paragraphs: paragraphCount,
    lines: lineCount,
    nonEmptyLines,
    bytes: utf8Bytes(text),
    longestWord,
    averageWordLength: wordCount > 0 ? letterCount / wordCount : 0,
    averageSentenceWords,
    longestSentenceWords,
    averageParagraphSentences: paragraphCount > 0 ? sentenceCount / paragraphCount : 0,
    syllables,
    readingEase: hasProse
      ? 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord
      : Number.NaN,
    gradeLevel: hasProse
      ? 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59
      : Number.NaN,
    readingSeconds: (wordCount / readingWpm) * 60,
    speakingSeconds: (wordCount / speakingWpm) * 60,
    keywords,
    keywordTotal,
  }
}

/** "2 min 5 sec", "48 sec", "1 hr 4 min". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  if (s < 60) return `${s} sec`
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  if (hours > 0) return `${hours} hr ${minutes} min`
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} sec`
}

/* ───────────────────────────── SMS segments ────────────────────────────── */

const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM7_EXTENDED = '^{}\\[~]|€'

export interface SmsInfo {
  /** 'GSM-7' when every character fits the basic alphabet, else 'UCS-2'. */
  encoding: 'GSM-7' | 'UCS-2'
  /** Billable character units (extended GSM characters count twice). */
  units: number
  /** Characters allowed per segment at the current count. */
  perSegment: number
  segments: number
  /** Units left before the next segment starts. */
  remaining: number
}

export function smsInfo(text: string): SmsInfo {
  let units = 0
  let gsm = true
  for (const ch of text) {
    if (GSM7_BASIC.includes(ch)) units += 1
    else if (GSM7_EXTENDED.includes(ch)) units += 2
    else {
      gsm = false
      break
    }
  }
  if (!gsm) {
    // UCS-2 counts UTF-16 code units.
    units = text.length
    const single = 70
    const multi = 67
    const segments = units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / multi)
    const perSegment = segments > 1 ? multi : single
    return {
      encoding: 'UCS-2',
      units,
      perSegment,
      segments,
      remaining: Math.max(0, perSegment * Math.max(1, segments) - units),
    }
  }
  const single = 160
  const multi = 153
  const segments = units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / multi)
  const perSegment = segments > 1 ? multi : single
  return {
    encoding: 'GSM-7',
    units,
    perSegment,
    segments,
    remaining: Math.max(0, perSegment * Math.max(1, segments) - units),
  }
}

/* ──────────────────────────── case conversion ──────────────────────────── */

/**
 * Splits any identifier or sentence into lowercase word parts:
 * `"getHTTPResponse-code 2"` → `["get", "http", "response", "code", "2"]`
 */
export function splitWords(input: string): string[] {
  const spaced = input
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
    .replace(/([\p{L}])(\p{N})/gu, '$1 $2')
    .replace(/(\p{N})([\p{L}])/gu, '$1 $2')
  return spaced
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
}

/** Words that stay lowercase inside a title, unless first or last. */
export const TITLE_SMALL_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'en', 'for', 'if', 'in', 'nor', 'of', 'on', 'or',
  'per', 'so', 'the', 'to', 'v', 'v.', 'via', 'vs', 'vs.', 'from', 'into', 'onto', 'over',
  'with', 'yet',
])

function capitalizeToken(token: string): string {
  // Keep intentional ALL-CAPS acronyms (NASA, API) intact.
  if (token.length > 1 && token === token.toUpperCase() && /\p{L}/u.test(token)) return token
  return token.replace(/\p{L}/u, (c) => c.toUpperCase())
}

/**
 * AP-style title case: capitalise everything except short conjunctions,
 * articles and prepositions, but always capitalise the first and last word
 * of each sentence-like segment, and anything after a colon or dash.
 */
export function toTitleCase(input: string): string {
  return input.replace(/[^\n]+/g, (line) => {
    const parts = line.split(/(\s+)/)
    const wordIndexes: number[] = []
    parts.forEach((p, i) => {
      if (p.trim() !== '') wordIndexes.push(i)
    })
    if (wordIndexes.length === 0) return line

    let forceNext = true
    for (let k = 0; k < wordIndexes.length; k++) {
      const i = wordIndexes[k]
      const token = parts[i]
      const bare = token.replace(EDGE_PUNCT, '').toLowerCase()
      const isFirst = k === 0
      const isLast = k === wordIndexes.length - 1
      const small = TITLE_SMALL_WORDS.has(bare)
      const lower = token.toLowerCase()
      if (forceNext || isFirst || isLast || !small) {
        parts[i] = capitalizeToken(
          token === token.toUpperCase() && token.length > 1 ? token : lower,
        )
        // Hyphenated compounds: capitalise each part.
        parts[i] = parts[i].replace(/([-/])(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase())
      } else {
        parts[i] = lower
      }
      forceNext = /[:.—–?!]$/.test(token)
    }
    return parts.join('')
  })
}

/** Capitalises the first letter of every sentence and lowercases the rest. */
export function toSentenceCase(input: string): string {
  const lowered = input.toLowerCase()
  let out = ''
  let capitalizeNext = true
  for (let i = 0; i < lowered.length; i++) {
    const ch = lowered[i]
    if (capitalizeNext && /\p{L}/u.test(ch)) {
      out += ch.toUpperCase()
      capitalizeNext = false
      continue
    }
    out += ch
    if (TERMINATORS.includes(ch) || ch === '\n') capitalizeNext = true
  }
  // Standalone "i" is always capitalised in English.
  return out.replace(/\bi\b/g, 'I').replace(/\bi'(m|ve|ll|d)\b/g, "I'$1")
}

export function toCamelCase(input: string): string {
  const parts = splitWords(input)
  if (parts.length === 0) return ''
  return parts
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('')
}

export function toPascalCase(input: string): string {
  return splitWords(input)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
}

export function toSnakeCase(input: string): string {
  return splitWords(input).join('_')
}

export function toKebabCase(input: string): string {
  return splitWords(input).join('-')
}

export function toConstantCase(input: string): string {
  return splitWords(input).join('_').toUpperCase()
}

export function toDotCase(input: string): string {
  return splitWords(input).join('.')
}

export function toAlternatingCase(input: string, startUpper = false): string {
  let upper = startUpper
  let out = ''
  for (const ch of input) {
    if (/\p{L}/u.test(ch)) {
      out += upper ? ch.toUpperCase() : ch.toLowerCase()
      upper = !upper
    } else {
      out += ch
    }
  }
  return out
}

export function toInverseCase(input: string): string {
  let out = ''
  for (const ch of input) {
    const lower = ch.toLowerCase()
    out += ch === lower ? ch.toUpperCase() : lower
  }
  return out
}

/* ───────────────────────────── transliteration ─────────────────────────── */

const TRANSLITERATION: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue',
  ß: 'ss', æ: 'ae', Æ: 'Ae', œ: 'oe', Œ: 'Oe', ø: 'o', Ø: 'O',
  å: 'a', Å: 'A', đ: 'd', Đ: 'D', ð: 'd', Ð: 'D', þ: 'th', Þ: 'Th',
  ł: 'l', Ł: 'L', ı: 'i', İ: 'I', ŋ: 'ng', Ŋ: 'Ng',
  '€': 'euro', '£': 'pound', $: 'dollar', '¥': 'yen', '©': 'c', '®': 'r', '&': 'and',
  '№': 'no', '×': 'x', '÷': 'div', '°': 'deg', µ: 'u', '·': '-',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
  α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k',
  λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't',
  υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
}

/**
 * Replaces accented and non-Latin characters with ASCII equivalents.
 * Multi-character rules (ß → ss, ж → zh) run first, then NFKD strips the
 * remaining combining marks (é → e).
 */
function applyTransliterationMap(input: string): string {
  let out = ''
  for (const ch of input) {
    const mapped = TRANSLITERATION[ch]
    if (mapped !== undefined) {
      out += mapped
      continue
    }
    const lower = ch.toLowerCase()
    const lowerMapped = TRANSLITERATION[lower]
    if (lowerMapped !== undefined && ch !== lower) {
      out += lowerMapped.charAt(0).toUpperCase() + lowerMapped.slice(1)
      continue
    }
    out += ch
  }
  return out
}

export function transliterate(input: string): string {
  // Pass 1 handles precomposed characters with multi-letter equivalents
  // (ä → ae, ß → ss, ж → zh) before NFKD would take them apart.
  const mapped = applyTransliterationMap(input)
  // NFKD then strips the remaining combining marks (é → e).
  const stripped = mapped.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  // Pass 2 catches base letters that only became mappable after stripping
  // (έ decomposes to ε, which romanises to e).
  return applyTransliterationMap(stripped)
}

/* ─────────────────────────────── slugging ──────────────────────────────── */

export interface SlugOptions {
  separator: string
  lowercase: boolean
  transliterate: boolean
  removeStopWords: boolean
  /** 0 = no limit. Truncates on a word boundary. */
  maxLength: number
  /** Keep digits that lead the slug (off = strip a leading "2024-"). */
  stripLeadingNumbers?: boolean
  /** Additional words to drop, lowercase. */
  customStopWords?: ReadonlySet<string>
}

export const DEFAULT_SLUG_OPTIONS: SlugOptions = {
  separator: '-',
  lowercase: true,
  transliterate: true,
  removeStopWords: false,
  maxLength: 0,
  stripLeadingNumbers: false,
}

export function makeSlug(input: string, options: SlugOptions): string {
  let text = input.trim()
  if (options.transliterate) text = transliterate(text)
  if (options.lowercase) text = text.toLowerCase()

  let tokens = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean)

  if (options.removeStopWords) {
    const extra = options.customStopWords
    const filtered = tokens.filter((t) => {
      const low = t.toLowerCase()
      if (STOP_WORDS.has(low)) return false
      if (extra?.has(low)) return false
      return true
    })
    if (filtered.length > 0) tokens = filtered
  }

  if (options.stripLeadingNumbers) {
    while (tokens.length > 1 && /^\d+$/.test(tokens[0])) tokens.shift()
  }

  const sep = options.separator
  let slug = tokens.join(sep)

  if (options.maxLength > 0 && slug.length > options.maxLength) {
    slug = slug.slice(0, options.maxLength)
    const cut = sep ? slug.lastIndexOf(sep) : -1
    if (cut > 0) slug = slug.slice(0, cut)
  }

  if (sep) {
    const escaped = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    slug = slug.replace(new RegExp(`^${escaped}+|${escaped}+$`, 'g'), '')
  }
  return slug
}

/* ─────────────────────────────── sorting ───────────────────────────────── */

const naturalCollatorSensitive = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'variant',
})
const naturalCollatorInsensitive = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

const plainCollatorSensitive = new Intl.Collator(undefined, { sensitivity: 'variant' })
const plainCollatorInsensitive = new Intl.Collator(undefined, { sensitivity: 'base' })

/** Locale-aware natural compare: "item2" before "item10". */
export function naturalCompare(a: string, b: string, caseSensitive: boolean): number {
  const collator = caseSensitive ? naturalCollatorSensitive : naturalCollatorInsensitive
  return collator.compare(a, b)
}

export function alphabeticalCompare(a: string, b: string, caseSensitive: boolean): number {
  if (caseSensitive) {
    // A pure code-point comparison keeps uppercase before lowercase, which is
    // what people expect from a "case sensitive" A→Z sort.
    return a < b ? -1 : a > b ? 1 : 0
  }
  return plainCollatorInsensitive.compare(a, b)
}

export function localeCompare(a: string, b: string, caseSensitive: boolean): number {
  return (caseSensitive ? plainCollatorSensitive : plainCollatorInsensitive).compare(a, b)
}

/** First numeric value found in a line, or NaN. */
export function leadingNumber(line: string): number {
  const m = line.match(/-?\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?/)
  if (!m) return Number.NaN
  return Number.parseFloat(m[0].replace(',', '.'))
}

/** Deterministic shuffle so "randomise" can be re-run reproducibly. */
export function shuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice()
  let state = seed >>> 0 || 1
  const rand = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0xffffffff
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/* ───────────────────────────── regex helpers ───────────────────────────── */

export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Interprets `\n`, `\t`, `\r`, `\\`, `\uXXXX` and `\xXX` in a plain-text
 * pattern or replacement so people can match a tab without a regex.
 */
export function unescapeLiteral(input: string): string {
  return input.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[nrtvf0\\])/g, (_m, code: string) => {
    switch (code) {
      case 'n':
        return '\n'
      case 'r':
        return '\r'
      case 't':
        return '\t'
      case 'v':
        return '\v'
      case 'f':
        return '\f'
      case '0':
        return '\0'
      case '\\':
        return '\\'
      default:
        return String.fromCharCode(Number.parseInt(code.slice(1), 16))
    }
  })
}
