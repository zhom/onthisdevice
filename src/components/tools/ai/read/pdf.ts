/**
 * OCR of PDF files: each page without a text layer is drawn at 200 dpi and read with
 * Tesseract. The text comes back as plain text, and for "searchable" also as an invisible
 * text layer over the original pages (text rendering mode 3), so the PDF can be searched,
 * selected and copied while it looks the same.
 */
import { openPdf, safeScale } from '@/components/tools/pdf-convert/pdf-utils'
import type { PdfPageProxy } from '@/components/tools/pdf-convert/pdf-utils'
import { readText } from '@/lib/ml/read/read'
import type { ReadWord } from '@/lib/ml/read/read'

const DPI = 200
/** A page with this many characters of its own text already has a text layer. */
const HAS_TEXT = 40

export interface PdfProgress {
  page: number
  pages: number
  /** 0..1 within the page. */
  part: number
}

export interface PdfResult {
  text: string
  pages: number
  /** Pages that had their own text and were not read again. */
  kept: number
  searchable: Blob | null
}

interface PageWords {
  index: number
  words: ReadWord[]
  /** Canvas pixels to PDF points. */
  toPdf: (x: number, y: number) => [number, number]
}

async function ownText(page: PdfPageProxy): Promise<string> {
  const content = await page.getTextContent()
  return content.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim()
}

export async function ocrPdf(file: File, langs: string[], searchable: boolean, onProgress: (p: PdfProgress) => void, signal?: AbortSignal): Promise<PdfResult> {
  const doc = await openPdf(file)
  const pages = doc.numPages
  const texts: string[] = []
  const layers: PageWords[] = []
  let kept = 0
  try {
    for (let i = 1; i <= pages; i++) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      onProgress({ page: i, pages, part: 0 })
      const page = await doc.getPage(i)
      const own = await ownText(page)
      if (own.length >= HAS_TEXT) {
        kept++
        texts.push(own)
        continue
      }
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: safeScale(base.width, base.height, DPI / 72) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      await page.render({ canvas, viewport, background: '#ffffff' }).promise
      const read = await readText(canvas, langs, (stage, done) => stage === 'read' && onProgress({ page: i, pages, part: done }))
      texts.push(read.text)
      layers.push({ index: i - 1, words: read.words, toPdf: (x, y) => viewport.convertToPdfPoint(x, y) as [number, number] })
      canvas.width = canvas.height = 0
    }
  } finally {
    void doc.cleanup()
  }
  const text = texts.map((t, i) => (pages > 1 ? `Page ${i + 1}\n\n${t}` : t)).join('\n\n\n')
  return { text, pages, kept, searchable: searchable ? await addTextLayer(file, layers) : null }
}

/** Writes each word invisibly over its place on the page, squeezed to the width of its box. */
async function addTextLayer(file: File, layers: PageWords[]): Promise<Blob> {
  const { PDFDocument, StandardFonts, TextRenderingMode, beginText, endText, setFontAndSize, setTextRenderingMode, setCharacterSqueeze, setTextMatrix, showText } = await import('pdf-lib')
  const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const encodable = (s: string) => {
    try {
      font.encodeText(s)
      return s
    } catch {
      return s.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?')
    }
  }
  for (const layer of layers) {
    const page = pdf.getPage(layer.index)
    const key = page.node.newFontDictionary(font.name, font.ref)
    const ops = []
    for (const w of layer.words) {
      const text = encodable(w.text.trim())
      if (!text) continue
      const [x0, y0] = layer.toPdf(w.x, w.y + w.h)
      const [x1, y1] = layer.toPdf(w.x + w.w, w.y)
      const height = Math.abs(y1 - y0)
      const width = Math.abs(x1 - x0)
      if (height < 1 || width < 1) continue
      const size = height
      const natural = font.widthOfTextAtSize(text, size)
      ops.push(
        beginText(),
        setFontAndSize(key, size),
        setTextRenderingMode(TextRenderingMode.Invisible),
        setCharacterSqueeze(natural > 0 ? (width / natural) * 100 : 100),
        setTextMatrix(1, 0, 0, 1, Math.min(x0, x1), Math.min(y0, y1) + height * 0.2),
        showText(font.encodeText(text)),
        endText(),
      )
    }
    page.pushOperators(...ops)
  }
  const bytes = await pdf.save()
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
}
