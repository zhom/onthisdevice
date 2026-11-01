/**
 * Private helpers shared by the PDF islands. Nothing here touches the network.
 */
export type PdfLib = typeof import('pdf-lib')

/** Lazily load pdf-lib so it is not part of the initial island payload. */
export function loadPdfLib(): Promise<PdfLib> {
  return import('pdf-lib')
}

const byteCache = new WeakMap<File, Promise<Uint8Array>>()

/**
 * Read a File into bytes, once. Tools re-read the same file when options
 * change, and a 100 MB scan should not be decoded from disk every time.
 * Callers must treat the result as read-only — pass `copyBytes()` to anything
 * that takes ownership of the buffer (pdf.js does).
 */
export function readFileBytes(file: File): Promise<Uint8Array> {
  const cached = byteCache.get(file)
  if (cached) return cached
  const pending = file
    .arrayBuffer()
    .then((buffer) => new Uint8Array(buffer))
    .catch((err: unknown) => {
      byteCache.delete(file)
      throw err
    })
  byteCache.set(file, pending)
  return pending
}

/**
 * pdf.js takes ownership of (and detaches) the buffer it is given, so every
 * call gets its own copy.
 */
export function copyBytes(bytes: Uint8Array): Uint8Array {
  return bytes.slice()
}

export function pdfBlob(bytes: Uint8Array): Blob {
  // Copy into a buffer typed as a plain ArrayBuffer so it is a valid BlobPart.
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: 'application/pdf' })
}

/** Turn an unknown thrown value into something a human can act on. */
export function humanPdfError(err: unknown, filename?: string): string {
  const where = filename ? `“${filename}”` : 'This file'
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  const msg = raw.toLowerCase()

  if (msg.includes('encrypt') || msg.includes('password')) {
    return `${where} is password-protected. Open it in a PDF reader, remove the password, then try again.`
  }
  if (msg.includes('invalid pdf') || msg.includes('no pdf header') || msg.includes('formaterror')) {
    return `${where} is not a readable PDF. It may be damaged, or it may be a renamed file of another type.`
  }
  if (msg.includes('cannot encode') || msg.includes('winansi')) {
    return 'Some characters in that text cannot be drawn with the fonts built into PDF, which cover Western European alphabets only. Remove them, or use an image instead.'
  }
  if (msg.includes('out of memory') || msg.includes('allocation')) {
    return 'Your browser ran out of memory for this document. Try a smaller file, fewer files at once, or close other tabs.'
  }
  if (msg.includes('worker')) {
    return 'The PDF renderer could not start. Reload the page and try again. A browser extension that blocks web workers can cause this.'
  }
  return `${where} could not be processed. ${raw}`
}

/**
 * Parse a human page-range string against a document length.
 *
 * Accepts `1-3, 7, 10-`, `-4`, descending ranges like `9-5`, plus the keywords
 * `all`, `odd`, `even` and `last`.
 * Returns 1-based page numbers in the order written, de-duplicated.
 * Throws an `Error` with a human message when the input is unusable.
 */
export function parsePageRanges(spec: string, pageCount: number): number[] {
  const text = spec.trim()
  if (!text) throw new Error('Enter at least one page or range, for example 1-3, 7, 10-.')

  const lower = text.toLowerCase()
  if (lower === 'all' || lower === '*') return allPages(pageCount)
  if (lower === 'odd') return allPages(pageCount).filter((p) => p % 2 === 1)
  if (lower === 'even') return allPages(pageCount).filter((p) => p % 2 === 0)

  const out: number[] = []
  const seen = new Set<number>()
  const add = (p: number) => {
    if (p < 1 || p > pageCount) {
      throw new Error(
        `Page ${p} does not exist. This document has ${pageCount} page${pageCount === 1 ? '' : 's'}.`,
      )
    }
    if (!seen.has(p)) {
      seen.add(p)
      out.push(p)
    }
  }

  for (const partRaw of text.split(/[,;\n]+/)) {
    const part = partRaw.trim().toLowerCase()
    if (!part) continue
    if (part === 'last') {
      add(pageCount)
      continue
    }
    if (part === 'odd' || part === 'even') {
      const want = part === 'odd' ? 1 : 0
      for (const p of allPages(pageCount)) if (p % 2 === want) add(p)
      continue
    }

    const range = /^(\d*)\s*(?:-|–|—|to|\.\.)\s*(\d*)$/.exec(part)
    if (range) {
      const from = range[1] ? Number(range[1]) : 1
      const to = range[2] ? Number(range[2]) : pageCount
      if (!Number.isFinite(from) || !Number.isFinite(to)) {
        throw new Error(`“${partRaw.trim()}” is not a page range. Try something like 4-9.`)
      }
      const step = from <= to ? 1 : -1
      for (let p = from; step > 0 ? p <= to : p >= to; p += step) add(p)
      continue
    }

    const single = /^\d+$/.exec(part)
    if (single) {
      add(Number(part))
      continue
    }

    throw new Error(
      `“${partRaw.trim()}” is not a page or range. Use numbers, ranges like 4-9, or open ranges like 10-.`,
    )
  }

  if (out.length === 0) throw new Error('That selection does not include any pages.')
  return out
}

export function allPages(pageCount: number): number[] {
  return Array.from({ length: pageCount }, (_, i) => i + 1)
}

/** [1,2,3,7,9,10] -> "1-3, 7, 9-10" */
export function pagesToRangeString(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b)
  if (sorted.length === 0) return '–'
  const parts: string[] = []
  let start = sorted[0]
  let prev = start
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]
    if (cur === prev + 1) {
      prev = cur
      continue
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = cur
    prev = cur
  }
  parts.push(start === prev ? `${start}` : `${start}-${prev}`)
  return parts.join(', ')
}

export const PT_PER_INCH = 72
export const MM_PER_INCH = 25.4

export function ptToMm(pt: number): number {
  return (pt / PT_PER_INCH) * MM_PER_INCH
}

export function ptToIn(pt: number): number {
  return pt / PT_PER_INCH
}

interface PaperSize {
  name: string
  w: number
  h: number
}

/** Portrait dimensions in PostScript points. */
const PAPER_SIZES: PaperSize[] = [
  { name: 'A0', w: 2384, h: 3370 },
  { name: 'A1', w: 1684, h: 2384 },
  { name: 'A2', w: 1191, h: 1684 },
  { name: 'A3', w: 842, h: 1191 },
  { name: 'A4', w: 595, h: 842 },
  { name: 'A5', w: 420, h: 595 },
  { name: 'A6', w: 298, h: 420 },
  { name: 'B4', w: 709, h: 1001 },
  { name: 'B5', w: 499, h: 709 },
  { name: 'Letter', w: 612, h: 792 },
  { name: 'Legal', w: 612, h: 1008 },
  { name: 'Tabloid', w: 792, h: 1224 },
  { name: 'Executive', w: 522, h: 756 },
  { name: 'Statement', w: 396, h: 612 },
]

/** Nearest standard paper name, or null when it is a custom size. */
export function matchPaperSize(widthPt: number, heightPt: number, tolerance = 4): string | null {
  const w = Math.min(widthPt, heightPt)
  const h = Math.max(widthPt, heightPt)
  for (const size of PAPER_SIZES) {
    if (Math.abs(size.w - w) <= tolerance && Math.abs(size.h - h) <= tolerance) return size.name
  }
  return null
}

export function orientationOf(widthPt: number, heightPt: number): 'Portrait' | 'Landscape' | 'Square' {
  if (Math.abs(widthPt - heightPt) < 1) return 'Square'
  return widthPt > heightPt ? 'Landscape' : 'Portrait'
}

/** Safe-ish output filename: keeps the stem, swaps in a suffix and extension. */
export function outputName(original: string, suffix: string, ext = 'pdf'): string {
  const stem = original.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'document'
  return `${stem}${suffix}.${ext}`
}

export function normalizeAngle(angle: number): number {
  return ((Math.round(angle) % 360) + 360) % 360
}

/** Size of a page as the reader shows it, given the page's own /Rotate. */
export function displaySize(
  widthPt: number,
  heightPt: number,
  rotation: number,
): { w: number; h: number } {
  return normalizeAngle(rotation) % 180 === 0
    ? { w: widthPt, h: heightPt }
    : { w: heightPt, h: widthPt }
}

/**
 * Convert a point expressed in the *displayed* page space (origin bottom-left
 * of the page as seen on screen) into the PDF's own unrotated user space, so
 * stamps land where the user expects on rotated pages.
 */
export function mapDisplayToPage(
  dx: number,
  dy: number,
  widthPt: number,
  heightPt: number,
  rotation: number,
): { x: number; y: number } {
  switch (normalizeAngle(rotation)) {
    case 90:
      return { x: widthPt - dy, y: dx }
    case 180:
      return { x: widthPt - dx, y: heightPt - dy }
    case 270:
      return { x: dy, y: heightPt - dx }
    default:
      return { x: dx, y: dy }
  }
}

/** "#4f46e5" -> { r: 0.31, g: 0.27, b: 0.9 } in the 0-1 range pdf-lib wants. */
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const clean = hex.trim().replace(/^#/, '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const value = Number.parseInt(full.slice(0, 6).padEnd(6, '0'), 16)
  if (!Number.isFinite(value)) return { r: 0, g: 0, b: 0 }
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  }
}

/** The PDF standard fonts cover WinAnsi only — tell the user before pdf-lib throws. */
export function findUnsupportedCharacter(text: string): string | null {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code === 10 || code === 13 || code === 9) continue
    if (code > 0x2122) return char
  }
  return null
}

/** Percentage saved between two byte sizes, clamped to sane output. */
export function percentSaved(before: number, after: number): number {
  if (before <= 0) return 0
  return ((before - after) / before) * 100
}
