/** Unicode code point helpers (pure, unit-tested in scripts/data/test.mjs). */

/** [first, last, label, general category] from UnicodeData.txt "<..., First>/<..., Last>" pairs. */
export type UcdRange = [number, number, string, string]
/** [first, last, block name] */
export type UcdBlock = [number, number, string]

export const hex = (cp: number) => cp.toString(16).toUpperCase().padStart(4, '0')
export const uPlus = (cp: number) => `U+${hex(cp)}`

/** Code points of a text (surrogate pairs joined). */
export function codePoints(text: string): number[] {
  const out: number[] = []
  for (const ch of text) out.push(ch.codePointAt(0) as number)
  return out
}

/**
 * Reads code point notation: U+1F600, u+e9, 0x41, &#233;, &#xE9;, é, \u{1F600}. Several can be
 * separated by spaces or commas. Returns null when the input is not notation (then it is plain text).
 */
export function parseNotation(text: string): number[] | null {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean)
  if (!parts.length) return null
  const out: number[] = []
  for (const p of parts) {
    const m =
      /^(?:U\+|0x|\\u\{?|&#x)([0-9a-f]{1,6})\}?;?$/i.exec(p) ??
      /^&#(\d{1,7});$/.exec(p)?.map((v, i) => (i === 1 ? Number(v).toString(16) : v))
    if (!m) return null
    const cp = parseInt(m[1], 16)
    if (!(cp >= 0 && cp <= 0x10ffff)) return null
    out.push(cp)
  }
  return out
}

export function utf8Bytes(cp: number): number[] {
  if (cp < 0x80) return [cp]
  if (cp < 0x800) return [0xc0 | (cp >> 6), 0x80 | (cp & 63)]
  if (cp < 0x10000) return [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)]
  return [0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)]
}

export function utf16Units(cp: number): number[] {
  if (cp < 0x10000) return [cp]
  const v = cp - 0x10000
  return [0xd800 | (v >> 10), 0xdc00 | (v & 0x3ff)]
}

const L = 'G GG N D DD R M B BB S SS  J JJ C K T P H'.split(' ')
const V = 'A AE YA YAE EO E YEO YE O WA WAE OE YO U WEO WE WI YU EU YI I'.split(' ')
const T = ' G GG GS N NJ NH D L LG LM LB LS LT LP LH M B BS S SS NG J C K T P H'.split(' ')

/** Name of a precomposed Hangul syllable (Unicode chapter 3.12). */
export function hangulName(cp: number): string {
  const s = cp - 0xac00
  const l = Math.floor(s / 588)
  const v = Math.floor((s % 588) / 28)
  const t = s % 28
  return `HANGUL SYLLABLE ${L[l]}${V[v]}${T[t]}`
}

/** Name from the ranges that UnicodeData.txt lists without one name per character. */
export function rangeName(cp: number, ranges: UcdRange[]): { name: string; gc: string } | null {
  const r = ranges.find(([a, b]) => cp >= a && cp <= b)
  if (!r) return null
  const label = r[2]
  if (label.startsWith('Hangul Syllable')) return { name: hangulName(cp), gc: r[3] }
  if (label.startsWith('CJK Ideograph')) return { name: `CJK UNIFIED IDEOGRAPH-${hex(cp)}`, gc: r[3] }
  if (label.startsWith('Tangut Ideograph')) return { name: `TANGUT IDEOGRAPH-${hex(cp)}`, gc: r[3] }
  if (/surrogate/i.test(label)) return { name: `<${label.toLowerCase()}-${hex(cp)}>`, gc: r[3] }
  if (/private use/i.test(label)) return { name: `<private-use-${hex(cp)}>`, gc: r[3] }
  return { name: `${label.toUpperCase()}-${hex(cp)}`, gc: r[3] }
}

export function blockOf(cp: number, blocks: UcdBlock[]): string {
  let lo = 0
  let hi = blocks.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (cp < blocks[mid][0]) hi = mid - 1
    else if (cp > blocks[mid][1]) lo = mid + 1
    else return blocks[mid][2]
  }
  return 'No block'
}

export const CATEGORY: Record<string, string> = {
  Lu: 'Uppercase letter',
  Ll: 'Lowercase letter',
  Lt: 'Titlecase letter',
  Lm: 'Modifier letter',
  Lo: 'Other letter',
  Mn: 'Nonspacing mark',
  Mc: 'Spacing mark',
  Me: 'Enclosing mark',
  Nd: 'Decimal digit',
  Nl: 'Letter number',
  No: 'Other number',
  Pc: 'Connector punctuation',
  Pd: 'Dash punctuation',
  Ps: 'Open punctuation',
  Pe: 'Close punctuation',
  Pi: 'Initial quote',
  Pf: 'Final quote',
  Po: 'Other punctuation',
  Sm: 'Math symbol',
  Sc: 'Currency symbol',
  Sk: 'Modifier symbol',
  So: 'Other symbol',
  Zs: 'Space separator',
  Zl: 'Line separator',
  Zp: 'Paragraph separator',
  Cc: 'Control',
  Cf: 'Format (invisible)',
  Cs: 'Surrogate',
  Co: 'Private use',
  Cn: 'Unassigned',
}

/** Characters that do not show on their own: controls, formats, separators, combining marks. */
export const invisible = (gc: string) => /^(C[cfsno]|Z[slp]|M[ne])$/.test(gc)

/** Emoji search: name match first, then words that start with the query, then keywords. */
export type EmojiRow = [string, string, string, string, string, string]

export function searchEmoji(rows: EmojiRow[], query: string): EmojiRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  const words = q.split(/\s+/)
  const scored: [number, number, EmojiRow][] = []
  rows.forEach((r, i) => {
    const name = r[1].toLowerCase()
    const keys = r[4].toLowerCase().split('|')
    let s = -1
    if (name === q) s = 0
    else if (name.startsWith(q)) s = 1
    else if (words.every((w) => name.split(/[\s:-]+/).some((n) => n.startsWith(w)))) s = 2
    else if (words.every((w) => keys.some((k) => k.startsWith(w)) || name.includes(w))) s = 3
    if (s >= 0) scored.push([s, i, r])
  })
  return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2])
}
