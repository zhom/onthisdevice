/**
 * Private helpers for the PDF-converter island components.
 * Everything here runs in the browser only.
 */

type PdfjsModule = typeof import('pdfjs-dist')
type PdfDocumentProxy = Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>
export type PdfPageProxy = Awaited<ReturnType<PdfDocumentProxy['getPage']>>

let pdfjsPromise: Promise<PdfjsModule> | null = null

/**
 * Lazily import pdf.js and wire up its worker. Kept out of the initial bundle:
 * the island only pays for it once the user actually picks a file.
 */
export function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ])
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })()
  }
  return pdfjsPromise
}

/** Open a PDF file with pdf.js. Always copies the bytes: the worker detaches them. */
export async function openPdf(file: File | Blob): Promise<PdfDocumentProxy> {
  const pdfjs = await loadPdfjs()
  const data = new Uint8Array(await file.arrayBuffer())
  return pdfjs.getDocument({ data }).promise
}

export type { PdfDocumentProxy }

/** Turn a pdf.js / pdf-lib failure into something a human can act on. */
export function describePdfError(err: unknown, fallback = 'Something went wrong while reading that PDF.'): string {
  const e = err as { name?: string; message?: string } | null
  const name = e?.name ?? ''
  const message = e?.message ?? ''

  if (name === 'PasswordException' || /password/i.test(message)) {
    return 'This PDF is password-protected. Remove the password in your PDF reader, then convert it here.'
  }
  if (name === 'InvalidPDFException' || /invalid pdf|no pdf header|structure/i.test(message)) {
    return 'That file is not a readable PDF. It may be corrupted, truncated, or renamed from another format.'
  }
  if (name === 'MissingPDFException') {
    return 'The PDF data could not be read. Try selecting the file again.'
  }
  if (/encrypt/i.test(message)) {
    return 'This PDF uses an encryption scheme that cannot be opened in the browser. Remove its protection first.'
  }
  if (name === 'RangeError' || /out of memory|allocation failed|array buffer/i.test(message)) {
    return 'The browser ran out of memory on this file. Try a lower DPI, or split the PDF into smaller parts first.'
  }
  if (message) return `${fallback} (${message})`
  return fallback
}

export function describeGenericError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : ''
  return message ? `${fallback} (${message})` : fallback
}

/**
 * Browsers cap canvas surfaces (roughly 16 384 px per side and a total pixel
 * budget). Reduce the requested scale until the page fits, so a 300 DPI render
 * of an A0 poster degrades gracefully instead of producing a blank canvas.
 */
const MAX_CANVAS_SIDE = 12_000
const MAX_CANVAS_PIXELS = 40_000_000

export function safeScale(baseWidth: number, baseHeight: number, wanted: number): number {
  let scale = wanted
  const side = Math.max(baseWidth, baseHeight)
  if (side * scale > MAX_CANVAS_SIDE) scale = MAX_CANVAS_SIDE / side
  const pixels = baseWidth * scale * baseHeight * scale
  if (pixels > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels)
  return Math.max(0.05, scale)
}

export interface RenderedPage {
  blob: Blob
  width: number
  height: number
  /** Small preview data URL for the thumbnail gallery. */
  thumbnail: string
}

export interface RenderOptions {
  /** Target dots per inch. PDF user space is 72 dpi. */
  dpi: number
  mime: 'image/jpeg' | 'image/png'
  /** JPEG quality, 0..1. Ignored for PNG. */
  quality?: number
  /** `null` renders a transparent background (PNG only). */
  background?: string | null
  /** Longest edge of the generated preview, in CSS pixels. */
  thumbnailSize?: number
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(width))
  canvas.height = Math.max(1, Math.floor(height))
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('the browser could not encode the image'))),
      mime,
      quality,
    )
  })
}

/** Render one PDF page to a raster image plus a thumbnail. */
export async function renderPage(page: PdfPageProxy, options: RenderOptions): Promise<RenderedPage> {
  const base = page.getViewport({ scale: 1 })
  const scale = safeScale(base.width, base.height, options.dpi / 72)
  const viewport = page.getViewport({ scale })

  const canvas = makeCanvas(viewport.width, viewport.height)
  const ctx = canvas.getContext('2d', { alpha: options.background === null })
  if (!ctx) throw new Error('this browser refused to create a 2D canvas')

  await page.render({
    canvas,
    viewport,
    background: options.background === null ? 'rgba(0,0,0,0)' : (options.background ?? '#ffffff'),
  }).promise

  const blob = await canvasToBlob(canvas, options.mime, options.mime === 'image/jpeg' ? options.quality : undefined)

  const thumbMax = options.thumbnailSize ?? 240
  const tScale = Math.min(1, thumbMax / Math.max(canvas.width, canvas.height))
  const thumbCanvas = makeCanvas(canvas.width * tScale, canvas.height * tScale)
  const tctx = thumbCanvas.getContext('2d')
  if (tctx) {
    tctx.imageSmoothingQuality = 'high'
    tctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height)
  }
  const thumbnail = thumbCanvas.toDataURL('image/png')

  // Free the big surface eagerly — Safari is slow to reclaim it otherwise.
  canvas.width = 0
  canvas.height = 0

  return { blob, width: viewport.width, height: viewport.height, thumbnail }
}

export interface PageText {
  pageNumber: number
  text: string
  /** Characters found on this page (after trimming). */
  chars: number
}

interface TextItemLike {
  str: string
  transform: number[]
  height: number
  width: number
  hasEOL?: boolean
}

function isTextItem(item: unknown): item is TextItemLike {
  return typeof item === 'object' && item !== null && typeof (item as TextItemLike).str === 'string'
}

/**
 * Extract a page's text layer in reading order.
 *
 * pdf.js hands back positioned glyph runs, not paragraphs. We group runs into
 * lines by their baseline, sort lines top-to-bottom, then re-join lines into
 * paragraphs: a bigger-than-usual vertical gap, or a line that ends in
 * sentence-final punctuation, starts a new paragraph. Hyphenated line breaks
 * are stitched back together.
 */
export async function extractPageText(page: PdfPageProxy): Promise<string> {
  const content = await page.getTextContent()

  interface Line {
    y: number
    x: number
    height: number
    parts: { x: number; width: number; str: string }[]
  }

  const lines: Line[] = []
  for (const raw of content.items) {
    if (!isTextItem(raw)) continue
    if (raw.str === '') continue
    const x = raw.transform[4] ?? 0
    const y = raw.transform[5] ?? 0
    const height = Math.abs(raw.transform[3] || raw.height || 10) || 10
    const width = Number.isFinite(raw.width) ? raw.width : raw.str.length * height * 0.5
    const tolerance = Math.max(2, height * 0.5)
    const line = lines.find((l) => Math.abs(l.y - y) <= tolerance)
    if (line) {
      line.parts.push({ x, width, str: raw.str })
      line.x = Math.min(line.x, x)
      line.height = Math.max(line.height, height)
    } else {
      lines.push({ y, x, height, parts: [{ x, width, str: raw.str }] })
    }
  }

  lines.sort((a, b) => b.y - a.y)

  const rendered = lines.map((line) => {
    line.parts.sort((a, b) => a.x - b.x)
    let out = ''
    let prevEnd: number | null = null
    for (const part of line.parts) {
      // pdf.js reports each run's real device-space width, so the gap between
      // one run's right edge and the next run's left edge tells us whether the
      // PDF meant a space there or simply repositioned the cursor.
      if (prevEnd !== null && part.x - prevEnd > line.height * 0.22 && !/\s$/.test(out) && !/^\s/.test(part.str)) {
        out += ' '
      }
      out += part.str
      prevEnd = part.x + part.width
    }
    return { text: out.replace(/\s+/g, ' ').trim(), y: line.y, x: line.x, height: line.height }
  })

  const meaningful = rendered.filter((l) => l.text !== '')
  if (meaningful.length === 0) return ''

  const gaps: number[] = []
  for (let i = 1; i < meaningful.length; i++) {
    const prev = meaningful[i - 1]!
    const cur = meaningful[i]!
    gaps.push(prev.y - cur.y)
  }
  const sorted = [...gaps].sort((a, b) => a - b)
  const medianGap = sorted.length > 0 ? (sorted[Math.floor(sorted.length / 2)] ?? 0) : 0
  const paragraphGap = medianGap > 0 ? medianGap * 1.6 : Number.POSITIVE_INFINITY
  const leftEdge = Math.min(...meaningful.map((l) => l.x))

  const paragraphs: string[] = []
  let current = ''
  for (let i = 0; i < meaningful.length; i++) {
    const line = meaningful[i]!
    if (current === '') {
      current = line.text
    } else {
      const prev = meaningful[i - 1]!
      const gap = prev.y - line.y
      const indented = line.x - leftEdge > line.height * 1.2
      const startsNew = gap > paragraphGap || indented || /^[•\-–•●\d]+[.)]?\s/.test(line.text)
      if (startsNew) {
        paragraphs.push(current)
        current = line.text
      } else if (/-$/.test(current) && /^[a-z]/.test(line.text)) {
        current = current.slice(0, -1) + line.text
      } else {
        current += ' ' + line.text
      }
    }
  }
  if (current !== '') paragraphs.push(current)

  return paragraphs.join('\n\n')
}

/** Extract text for the whole document, reporting progress 0..1. */
export async function extractDocumentText(
  doc: PdfDocumentProxy,
  onProgress?: (done: number, total: number) => void,
): Promise<PageText[]> {
  const out: PageText[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const text = await extractPageText(page)
    page.cleanup()
    out.push({ pageNumber: i, text, chars: text.trim().length })
    onProgress?.(i, doc.numPages)
  }
  return out
}

/** A PDF with essentially no text layer is a scan — we must say so, not ship an empty file. */
export function looksLikeScan(pages: PageText[]): boolean {
  if (pages.length === 0) return false
  const total = pages.reduce((sum, p) => sum + p.chars, 0)
  return total < Math.max(24, pages.length * 12)
}

export function padPageNumber(n: number, total: number): string {
  return String(n).padStart(String(total).length, '0')
}
