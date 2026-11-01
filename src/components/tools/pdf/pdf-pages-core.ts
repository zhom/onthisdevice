/**
 * Private helpers for the round-2 `pdf-pages` batch: crop, resize, split-in-half,
 * N-up, interleave, Bates numbering, image extraction, metadata and word count.
 *
 * Deliberately self-contained — this batch shares the `tools/pdf` directory with
 * other agents, so every file it owns carries the `pdf-pages-` prefix and nothing
 * here imports another batch's module. Nothing here touches the network.
 */
import type { PDFEmbeddedPage, PDFPage } from 'pdf-lib'
import type { PDFPageProxy } from 'pdfjs-dist'

export type PdfLib = typeof import('pdf-lib')

/** Lazily load pdf-lib so it stays out of the initial island payload. */
export function loadPdfLib(): Promise<PdfLib> {
  return import('pdf-lib')
}

/** Lazily load the pdf.js renderer with its worker already configured. */
export async function loadPdfjs() {
  const mod = await import('./pdf-pages-pdfjs')
  return mod.pdfjs
}

const byteCache = new WeakMap<File, Promise<Uint8Array>>()

/**
 * Read a File into bytes, once. Options change constantly in these tools and a
 * 200 MB scan should not be re-read from disk on every keystroke. Treat the
 * result as read-only; hand `copyBytes()` to anything that takes ownership.
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

/** pdf.js detaches the buffer it is given, so every call needs its own copy. */
export function copyBytes(bytes: Uint8Array): Uint8Array {
  return bytes.slice()
}

/** Wrap bytes in a Blob through a plain ArrayBuffer, which is a valid BlobPart. */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type })
}

export function pdfBlob(bytes: Uint8Array): Blob {
  return bytesToBlob(bytes, 'application/pdf')
}

/** Turn an unknown thrown value into something a human can act on. */
export function humanPdfError(err: unknown, filename?: string): string {
  const where = filename ? `“${filename}”` : 'This file'
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  const msg = raw.toLowerCase()

  if (msg.includes('password') || msg.includes('encrypt')) {
    return `${where} is password-protected, so its pages cannot be read. Remove the password first, then try again.`
  }
  if (msg.includes('invalid pdf') || msg.includes('no pdf header') || msg.includes('formaterror')) {
    return `${where} is not a readable PDF. It may be damaged, or it may be a renamed file of another type.`
  }
  if (msg.includes('out of memory') || msg.includes('allocation') || msg.includes('array buffer')) {
    return 'Your browser ran out of memory for this document. Close other tabs, try fewer pages at a time, or use a desktop browser.'
  }
  if (msg.includes('worker')) {
    return 'The PDF renderer could not start. Reload the page. An extension that blocks web workers is the usual cause.'
  }
  if (msg.includes('missing page contents')) {
    return `${where} contains a page with no content stream, which cannot be re-laid-out. Try re-saving it from a PDF reader first.`
  }
  return `${where} could not be processed. ${raw}`
}

/* ------------------------------------------------------------------ *
 * Page selection
 * ------------------------------------------------------------------ */

export type PageScope = 'all' | 'odd' | 'even' | 'custom'

export function allPages(pageCount: number): number[] {
  return Array.from({ length: pageCount }, (_, i) => i + 1)
}

/**
 * Parse a human page-range string (`1-3, 7, 10-`) into 1-based page numbers.
 * Throws an Error carrying a human-readable message when the input is unusable.
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
    const range = /^(\d*)\s*(?:-|–|—|to|\.\.)\s*(\d*)$/.exec(part)
    if (range) {
      const from = range[1] ? Number(range[1]) : 1
      const to = range[2] ? Number(range[2]) : pageCount
      const step = from <= to ? 1 : -1
      for (let p = from; step > 0 ? p <= to : p >= to; p += step) add(p)
      continue
    }
    if (/^\d+$/.test(part)) {
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

/** Resolve a scope + custom range into a Set of 1-based page numbers. */
export function resolveScope(scope: PageScope, custom: string, pageCount: number): Set<number> {
  if (scope === 'all') return new Set(allPages(pageCount))
  if (scope === 'odd') return new Set(allPages(pageCount).filter((p) => p % 2 === 1))
  if (scope === 'even') return new Set(allPages(pageCount).filter((p) => p % 2 === 0))
  return new Set(parsePageRanges(custom, pageCount))
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

/* ------------------------------------------------------------------ *
 * Units and paper
 * ------------------------------------------------------------------ */

export const PT_PER_INCH = 72
export const MM_PER_INCH = 25.4

export const mmToPt = (mm: number): number => (mm / MM_PER_INCH) * PT_PER_INCH
export const ptToMm = (pt: number): number => (pt / PT_PER_INCH) * MM_PER_INCH
export const inToPt = (inch: number): number => inch * PT_PER_INCH
export const ptToIn = (pt: number): number => pt / PT_PER_INCH

export interface PaperSize {
  id: string
  name: string
  /** Portrait dimensions in PostScript points. */
  w: number
  h: number
}

export const PAPER_SIZES: PaperSize[] = [
  { id: 'a3', name: 'A3 (297 × 420 mm)', w: 841.89, h: 1190.55 },
  { id: 'a4', name: 'A4 (210 × 297 mm)', w: 595.28, h: 841.89 },
  { id: 'a5', name: 'A5 (148 × 210 mm)', w: 419.53, h: 595.28 },
  { id: 'a6', name: 'A6 (105 × 148 mm)', w: 297.64, h: 419.53 },
  { id: 'b5', name: 'B5 (176 × 250 mm)', w: 498.9, h: 708.66 },
  { id: 'letter', name: 'US Letter (8.5 × 11 in)', w: 612, h: 792 },
  { id: 'legal', name: 'US Legal (8.5 × 14 in)', w: 612, h: 1008 },
  { id: 'tabloid', name: 'Tabloid (11 × 17 in)', w: 792, h: 1224 },
  { id: 'executive', name: 'Executive (7.25 × 10.5 in)', w: 522, h: 756 },
]

export function paperById(id: string): PaperSize {
  return PAPER_SIZES.find((p) => p.id === id) ?? PAPER_SIZES[1]
}

/** Nearest standard paper name for a page, or null when it is a custom size. */
export function matchPaperName(widthPt: number, heightPt: number, tolerance = 4): string | null {
  const w = Math.min(widthPt, heightPt)
  const h = Math.max(widthPt, heightPt)
  for (const size of PAPER_SIZES) {
    if (Math.abs(size.w - w) <= tolerance && Math.abs(size.h - h) <= tolerance) {
      return size.name.replace(/\s*\(.*\)$/, '')
    }
  }
  return null
}

export function describePageSize(widthPt: number, heightPt: number): string {
  const named = matchPaperName(widthPt, heightPt)
  const mm = `${ptToMm(widthPt).toFixed(0)} × ${ptToMm(heightPt).toFixed(0)} mm`
  return named ? `${named} · ${mm}` : mm
}

/* ------------------------------------------------------------------ *
 * Geometry: display space <-> PDF user space
 * ------------------------------------------------------------------ */

export function normalizeAngle(angle: number): number {
  return ((Math.round(angle / 90) * 90) % 360 + 360) % 360
}

export interface PageGeom {
  /** Box origin and size in PDF points (usually the CropBox). */
  x: number
  y: number
  w: number
  h: number
  /** The page's own /Rotate, normalised to 0/90/180/270. */
  rotation: number
}

/** Size of the page as a reader shows it, with /Rotate applied. */
export function displaySize(g: PageGeom): { w: number; h: number } {
  return g.rotation % 180 === 0 ? { w: g.w, h: g.h } : { w: g.h, h: g.w }
}

/**
 * Map a point in *displayed* page space (origin top-left, as seen on screen)
 * into the page's own unrotated top-left coordinates.
 */
function displayPointToPage(g: PageGeom, dx: number, dy: number): { px: number; py: number } {
  switch (g.rotation) {
    case 90:
      return { px: dy, py: g.h - dx }
    case 180:
      return { px: g.w - dx, py: g.h - dy }
    case 270:
      return { px: g.w - dy, py: dx }
    default:
      return { px: dx, py: dy }
  }
}

export interface PageBox {
  left: number
  bottom: number
  right: number
  top: number
}

/**
 * Convert a point on the *rendered* page (origin top-left, PDF points) into a
 * point in the page's own user space — the coordinate pdf-lib draws at.
 */
export function displayPointToPdf(
  g: PageGeom,
  dx: number,
  dyFromTop: number,
): { x: number; y: number } {
  const { px, py } = displayPointToPage(g, dx, dyFromTop)
  return { x: g.x + px, y: g.y + (g.h - py) }
}

/**
 * Convert an axis-aligned rectangle drawn on the *rendered* page (top-left
 * origin, PDF points) into a box in the page's own user space. Because /Rotate
 * is always a multiple of 90°, the result stays axis-aligned.
 */
export function displayRectToPageBox(
  g: PageGeom,
  dx0: number,
  dy0: number,
  dx1: number,
  dy1: number,
): PageBox {
  const corners = [
    [dx0, dy0],
    [dx1, dy0],
    [dx1, dy1],
    [dx0, dy1],
  ].map(([dx, dy]) => displayPointToPage(g, dx, dy))

  const xs = corners.map((p) => g.x + p.px)
  const ys = corners.map((p) => g.y + (g.h - p.py))

  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    bottom: Math.min(...ys),
    top: Math.max(...ys),
  }
}

/** Displayed size of an embedded page once the source /Rotate is honoured. */
export function embeddedDisplaySize(
  emb: PDFEmbeddedPage,
  rotation: number,
): { w: number; h: number } {
  return normalizeAngle(rotation) % 180 === 0
    ? { w: emb.width, h: emb.height }
    : { w: emb.height, h: emb.width }
}

/**
 * Draw an embedded page so that its *visual* bottom-left lands at (x, y) and
 * it occupies `scale × displayed size`, honouring the source page's /Rotate.
 *
 * pdf-lib composes the CTM as translate · rotate · scale, so the scaled box is
 * rotated about the origin first and then shifted back into place.
 */
export function drawEmbeddedRotated(
  lib: PdfLib,
  target: PDFPage,
  emb: PDFEmbeddedPage,
  rotation: number,
  x: number,
  y: number,
  scale: number,
): void {
  const { degrees } = lib
  const w = emb.width * scale
  const h = emb.height * scale

  switch (normalizeAngle(rotation)) {
    case 90:
      target.drawPage(emb, { x, y: y + w, width: w, height: h, rotate: degrees(-90) })
      break
    case 180:
      target.drawPage(emb, { x: x + w, y: y + h, width: w, height: h, rotate: degrees(180) })
      break
    case 270:
      target.drawPage(emb, { x: x + h, y, width: w, height: h, rotate: degrees(90) })
      break
    default:
      target.drawPage(emb, { x, y, width: w, height: h })
  }
}

/** The page geometry a reader actually uses: CropBox where present. */
export function geomOf(page: PDFPage): PageGeom {
  const crop = page.getCropBox()
  const media = page.getMediaBox()
  const box = crop.width > 0 && crop.height > 0 ? crop : media
  return {
    x: box.x,
    y: box.y,
    w: box.width,
    h: box.height,
    rotation: normalizeAngle(page.getRotation().angle),
  }
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

export interface RenderedPage {
  canvas: HTMLCanvasElement
  /** Displayed page size in PDF points (with /Rotate applied). */
  widthPt: number
  heightPt: number
}

type RenderablePage = Pick<PDFPageProxy, 'getViewport' | 'render' | 'cleanup'>

/** Render one pdf.js page onto a fresh canvas at a target CSS width. */
export async function renderPageToCanvas(
  page: RenderablePage,
  targetWidth: number,
  maxScale = 4,
): Promise<RenderedPage> {
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(targetWidth / base.width, maxScale)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('This browser would not give us a 2D canvas to draw on.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, viewport }).promise
  page.cleanup()
  return { canvas, widthPt: base.width, heightPt: base.height }
}

/** Bounding box of non-white pixels, expressed as fractions 0..1 of the canvas. */
export function inkBounds(
  canvas: HTMLCanvasElement,
  threshold = 245,
): { left: number; top: number; right: number; bottom: number } | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const { width, height } = canvas
  if (width < 2 || height < 2) return null
  const { data } = ctx.getImageData(0, 0, width, height)

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    const row = y * width * 4
    for (let x = 0; x < width; x++) {
      const i = row + x * 4
      const alpha = data[i + 3]
      if (alpha < 16) continue
      const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
      if (luma >= threshold) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0 || maxY < 0) return null
  return {
    left: minX / width,
    top: minY / height,
    right: (maxX + 1) / width,
    bottom: (maxY + 1) / height,
  }
}

/**
 * Column-by-column ink density of a rendered page, used to find the gutter
 * between two scanned book pages. Returns one value per canvas column.
 */
export function columnInkProfile(canvas: HTMLCanvasElement, threshold = 200): number[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  const { width, height } = canvas
  const { data } = ctx.getImageData(0, 0, width, height)
  const profile = new Array<number>(width).fill(0)
  for (let y = 0; y < height; y++) {
    const row = y * width * 4
    for (let x = 0; x < width; x++) {
      const i = row + x * 4
      const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
      if (luma < threshold) profile[x] += 1
    }
  }
  return profile
}

/**
 * Find the emptiest column inside the middle `window` fraction of a profile —
 * the spine of a scanned two-page spread. Returns a fraction 0..1, or null when
 * the page has no clear gutter.
 */
export function findGutter(profile: number[], windowFraction = 0.34): number | null {
  const n = profile.length
  if (n < 16) return null
  const half = Math.floor((n * windowFraction) / 2)
  const centre = Math.floor(n / 2)
  const from = Math.max(1, centre - half)
  const to = Math.min(n - 2, centre + half)

  let bestX = centre
  let bestScore = Number.POSITIVE_INFINITY
  for (let x = from; x <= to; x++) {
    // Average over a small band so a single stray pixel column cannot win.
    const score = (profile[x - 1] + profile[x] + profile[x + 1]) / 3
    if (score < bestScore) {
      bestScore = score
      bestX = x
    }
  }

  const overall = profile.reduce((a, b) => a + b, 0) / n
  // A real gutter is much emptier than the page average; otherwise fall back.
  if (overall > 0 && bestScore > overall * 0.6) return null
  return bestX / n
}

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

/** Safe output filename: keeps the stem, swaps in a suffix and extension. */
export function outputName(original: string, suffix: string, ext = 'pdf'): string {
  const stem =
    original
      .replace(/\.[^.]+$/, '')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .trim() || 'document'
  return `${stem}${suffix}.${ext}`
}

/** Turn a matrix of cells into a CSV Blob (RFC 4180 quoting). */
export function csvBlob(rows: (string | number)[][]): Blob {
  const escape = (cell: string | number): string => {
    const s = String(cell)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const text = rows.map((row) => row.map(escape).join(',')).join('\r\n')
  // Lead with a UTF-8 BOM so Excel opens accented characters correctly.
  return new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' })
}

/** "#4f46e5" -> { r, g, b } in the 0-1 range pdf-lib wants. */
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

/** The PDF standard fonts cover WinAnsi only — warn before pdf-lib throws. */
export function findUnsupportedCharacter(text: string): string | null {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code === 10 || code === 13 || code === 9) continue
    if (code > 0x2122) return char
  }
  return null
}

/** Zero-pad an integer to a fixed number of digits. */
export function padNumber(value: number, digits: number): string {
  const s = Math.max(0, Math.trunc(value)).toString()
  return s.length >= digits ? s : '0'.repeat(digits - s.length) + s
}
