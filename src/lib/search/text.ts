/** Text helpers shared by the index builder and the engine. */

const MARKS = /[̀-ͯ]/g

/** Lowercase, strip accents, unify the characters people type in place of "to" or spaces. */
export function normalize(input: string): string {
  return input
    .normalize('NFKD')
    .replace(MARKS, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\s*(?:->|=>|→|⇒)\s*/g, ' to ')
    .replace(/&/g, ' and ')
    .replace(/(\d)\s+(kb|mb|gb|k|m)\b/g, '$1$2')
}

/** Words of a normalized string: runs of letters and digits. */
export function words(text: string): string[] {
  return text.match(/[a-z0-9]+/g) ?? []
}

/** Words with their character offsets, for highlighting. */
export function wordSpans(text: string): { word: string; start: number; end: number }[] {
  const out: { word: string; start: number; end: number }[] = []
  const re = /[\p{L}\p{N}]+/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const word = m[0].normalize('NFKD').replace(MARKS, '').toLowerCase()
    out.push({ word, start: m.index, end: m.index + m[0].length })
  }
  return out
}

/** Words that carry no meaning in a tool search. */
export const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'in', 'into', 'of', 'for', 'my', 'on', 'online', 'free', 'with', 'and',
  'from', 'how', 'can', 'do', 'i', 'what', 'is', 'me', 'your', 'by', 'as', 'at', 'or', 'vs', 'it',
  'this', 'that', 'best', 'tool', 'tools', 'app', 'website', 'site', 'without', 'no', 'upload',
  'please', 'some', 'want', 'need', 'using', 'via', 'way', 'easy', 'quick', 'quickly', 'instantly',
  'browser', 'private', 'secure',
  // Articles and prepositions of other languages, for queries like "calculadora de hipoteca".
  'de', 'la', 'le', 'les', 'une', 'el', 'los', 'las', 'des', 'du', 'und', 'der', 'das', 'il', 'per',
  'para', 'pour', 'mit', 'con', 'avec', 'zu', 'mon', 'mi', 'mein', 'ma', 'em', 'um', 'uma', 'een', 'het',
])

/**
 * A light suffix stripper. It only has to be consistent: the index and the query go through
 * the same function, so "merging", "merged" and "merge" meet at "merg".
 */
export function stem(word: string): string {
  if (word.length <= 3 || /\d/.test(word)) return word
  let w = word
  if (w.endsWith('ies') && w.length > 4) w = `${w.slice(0, -3)}y`
  else if (w.endsWith('sses')) w = w.slice(0, -2)
  else if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1)
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith('ion')) w = w.slice(0, -3)
  else if (w.length > 4 && (w.endsWith('ed') || w.endsWith('er'))) w = w.slice(0, -2)
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1)
  return w
}

const ROW_A = new Int32Array(64)
const ROW_B = new Int32Array(64)
const ROW_C = new Int32Array(64)

/**
 * Edit distance with adjacent transpositions (optimal string alignment), or `max + 1` as soon
 * as the distance must exceed `max`. Compares `a` with the first `bLen` characters of `b`.
 */
export function editDistance(a: string, b: string, max: number, bLen = b.length): number {
  const la = a.length
  const lb = bLen
  if (Math.abs(la - lb) > max) return max + 1
  if (la >= 63 || lb >= 63) return max + 1
  let prev2 = ROW_A
  let prev = ROW_B
  let cur = ROW_C
  for (let j = 0; j <= lb; j++) prev[j] = j
  for (let i = 1; i <= la; i++) {
    cur[0] = i
    let rowMin = i
    const ca = a.charCodeAt(i - 1)
    for (let j = 1; j <= lb; j++) {
      const cb = b.charCodeAt(j - 1)
      let v = prev[j - 1] + (ca === cb ? 0 : 1)
      if (prev[j] + 1 < v) v = prev[j] + 1
      if (cur[j - 1] + 1 < v) v = cur[j - 1] + 1
      if (i > 1 && j > 1 && ca === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === cb && prev2[j - 2] + 1 < v) {
        v = prev2[j - 2] + 1
      }
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    const t = prev2
    prev2 = prev
    prev = cur
    cur = t
  }
  return prev[lb]
}
