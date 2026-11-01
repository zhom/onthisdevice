/**
 * Burns redactions into a PDF. Pages with a box are rendered to an image with
 * the boxes painted in and replace the original page, so nothing under a box
 * survives. Pages without a box are copied as they are (vector, selectable
 * text) minus their annotations. The new file has no document properties,
 * XMP, bookmarks, attachments, scripts or form data.
 */
import { copyBytes, encodeCanvasJpeg, encodeCanvasPng, get2dContext, loadPdfJs, loadPdfLib } from '@/components/tools/pdf/pdf-edit-core'
import { nextFrame } from '@/lib/utils'
import type { Rect } from './pdf-text'

export interface BurnOptions {
  dpi: number
  /** JPEG quality 0..1; 1 writes PNG (lossless, larger). */
  quality: number
  /** Render every page, not only the ones with boxes. */
  rasterAll: boolean
}

export interface BurnProgress {
  done: number
  total: number
  label: string
}

export interface BurnResult {
  bytes: Uint8Array
  /** 1-based numbers of the pages that became images. */
  rasterPages: number[]
}

const MAX_EDGE = 6000
/** Page keys that can hold copies of content or data: annotations, metadata, scripts. */
const PAGE_KEYS_TO_DROP = ['Annots', 'Metadata', 'PieceInfo', 'AA', 'Thumb', 'B', 'StructParents', 'Tabs']

export async function burnRedactions(
  source: Uint8Array,
  boxes: Map<number, Rect[]>,
  options: BurnOptions,
  onProgress?: (p: BurnProgress) => void,
  cancel?: { cancelled: boolean },
): Promise<BurnResult> {
  const pdfjs = await loadPdfJs()
  const { PDFDocument, PDFName } = await loadPdfLib()
  const src = await PDFDocument.load(source, { ignoreEncryption: true, updateMetadata: false })
  // Encrypted content cannot be copied page by page; every page is rendered instead.
  const rasterAll = options.rasterAll || src.isEncrypted
  const doc = await pdfjs.getDocument({ data: copyBytes(source) }).promise
  const total = doc.numPages
  const out = await PDFDocument.create({ updateMetadata: false })
  const raster = (n: number) => rasterAll || (boxes.get(n)?.length ?? 0) > 0
  const vectorIdx = Array.from({ length: total }, (_, i) => i).filter((i) => !raster(i + 1))
  const copied = vectorIdx.length ? await out.copyPages(src, vectorIdx) : []
  const copiedByIndex = new Map(vectorIdx.map((i, k) => [i, copied[k]]))
  const canvas = document.createElement('canvas')
  const ctx = get2dContext(canvas)
  const rasterPages: number[] = []
  try {
    for (let n = 1; n <= total; n++) {
      if (cancel?.cancelled) throw new DOMException('Cancelled', 'AbortError')
      const vector = copiedByIndex.get(n - 1)
      if (vector) {
        for (const key of PAGE_KEYS_TO_DROP) vector.node.delete(PDFName.of(key))
        out.addPage(vector)
        onProgress?.({ done: n, total, label: `Copying page ${n} of ${total}` })
        continue
      }
      onProgress?.({ done: n - 1, total, label: `Rendering page ${n} of ${total}` })
      const page = await doc.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(options.dpi / 72, MAX_EDGE / Math.max(base.width, base.height))
      const viewport = page.getViewport({ scale })
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, viewport }).promise
      page.cleanup()
      // Redaction ink is black by definition. Boxes snap outward to whole pixels.
      ctx.fillStyle = '#000000'
      for (const b of boxes.get(n) ?? []) {
        const x0 = Math.floor(b.x * scale)
        const y0 = Math.floor(b.y * scale)
        ctx.fillRect(x0, y0, Math.ceil((b.x + b.w) * scale) - x0, Math.ceil((b.y + b.h) * scale) - y0)
      }
      const png = options.quality >= 1
      const bytes = png ? await encodeCanvasPng(canvas) : await encodeCanvasJpeg(canvas, options.quality)
      const image = png ? await out.embedPng(bytes) : await out.embedJpg(bytes)
      const newPage = out.addPage([base.width, base.height])
      newPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height })
      rasterPages.push(n)
      onProgress?.({ done: n, total, label: `Rendering page ${n} of ${total}` })
      await nextFrame()
    }
  } finally {
    void doc.loadingTask.destroy()
    canvas.width = 0
    canvas.height = 0
  }
  onProgress?.({ done: total, total, label: 'Writing the new PDF' })
  const bytes = await out.save({ useObjectStreams: true })
  return { bytes, rasterPages }
}
