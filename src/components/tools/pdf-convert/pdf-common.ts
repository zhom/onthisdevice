/**
 * Constants and tiny helpers that must NOT pull pdf-lib into a bundle.
 *
 * The islands import this eagerly (they render page-size menus before anything
 * heavy happens) and only `await import('./pdf-layout')` — which does depend on
 * pdf-lib — once the user actually presses Convert.
 */

export interface PageSize {
  id: string
  label: string
  /** Width in PDF points (1 pt = 1/72 inch). */
  width: number
  /** Height in PDF points. */
  height: number
}

export const PAGE_SIZES: PageSize[] = [
  { id: 'a4', label: 'A4 (210 × 297 mm)', width: 595.28, height: 841.89 },
  { id: 'letter', label: 'Letter (8.5 × 11 in)', width: 612, height: 792 },
  { id: 'legal', label: 'Legal (8.5 × 14 in)', width: 612, height: 1008 },
  { id: 'a3', label: 'A3 (297 × 420 mm)', width: 841.89, height: 1190.55 },
  { id: 'a5', label: 'A5 (148 × 210 mm)', width: 420.94, height: 595.28 },
  { id: 'tabloid', label: 'Tabloid (11 × 17 in)', width: 792, height: 1224 },
]

export function pageSizeById(id: string): PageSize {
  return PAGE_SIZES.find((size) => size.id === id) ?? PAGE_SIZES[0]!
}

export const MM_PER_PT = 25.4 / 72

export function mmToPt(mm: number): number {
  return mm / MM_PER_PT
}

/** Wrap raw PDF/DOCX bytes in a Blob, copying into a plain ArrayBuffer first. */
export function toBlob(bytes: Uint8Array, type: string): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type })
}

/* ------------------------------------------------------------ text safety */

/**
 * The 14 standard PDF fonts are encoded with WinAnsi (CP-1252). Anything
 * outside it — CJK, Cyrillic, emoji — cannot be drawn and makes pdf-lib throw.
 * We transliterate what we can (accented Latin, typographic punctuation) and
 * substitute the rest, then report how many characters were replaced so the UI
 * can be upfront about it.
 */
const CP1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'

const DIRECT_MAP: Record<string, string> = {
  '\u2007': ' ', // figure space
  '\u202f': ' ', // narrow no-break space
  '\u2028': '\n', // line separator
  '\u2029': '\n', // paragraph separator
  '\u2010': '-',
  '\u2011': '-',
  '\u2012': '-',
  '\u2015': '-',
  '\u2212': '-', // minus sign
  '\u2044': '/', // fraction slash
  '\u00ad': '', // soft hyphen
  '\u200b': '', // zero-width space
  '\u200c': '',
  '\u200d': '',
  '\ufeff': '',
  '\u2190': '<-',
  '\u2192': '->',
  '\u2194': '<->',
  '\u21d2': '=>',
  '\u2264': '<=',
  '\u2265': '>=',
  '\u2260': '!=',
  '\u00d7': 'x',
  '\u25cf': '\u2022',
  '\u25aa': '\u2022',
  '\u25a0': '\u2022',
  '\u2023': '\u2022',
  '\u2043': '-',
  '\u2611': '[x]',
  '\u2610': '[ ]',
  '\u2713': 'v',
  '\u2714': 'v',
}

function encodable(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  if (c >= 0x20 && c <= 0x7e) return true
  if (c >= 0xa0 && c <= 0xff) return true
  return CP1252_EXTRA.includes(ch)
}

export interface SanitizeResult {
  text: string
  /** Number of source characters that had no WinAnsi equivalent. */
  dropped: number
}

export function sanitizeForStandardFont(input: string): SanitizeResult {
  let dropped = 0
  let out = ''
  for (const ch of input.normalize('NFC')) {
    if (ch === '\n') {
      out += '\n'
      continue
    }
    if (ch === '\t') {
      out += '    '
      continue
    }
    if (ch === '\r') continue
    if (encodable(ch)) {
      out += ch
      continue
    }
    const mapped = DIRECT_MAP[ch]
    if (mapped !== undefined) {
      out += mapped
      continue
    }
    // Try to strip diacritics: "ā" -> "a", "ḥ" -> "h".
    const folded = ch.normalize('NFKD').replace(/\p{M}/gu, '')
    if (folded !== '' && [...folded].every(encodable)) {
      out += folded
      continue
    }
    dropped++
    out += '?'
  }
  return { text: out, dropped }
}
