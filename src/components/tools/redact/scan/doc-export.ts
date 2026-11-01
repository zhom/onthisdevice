/**
 * Export of redacted document pages.
 *
 *   exportDocs({ pages, boxesOf, format, rasterAll, decorate, onProgress })
 *
 * PDF from one PDF file: pages with a box (or every page, with `rasterAll`)
 * are rendered to an image with the boxes burned in; the other pages are
 * copied as they are (vector, selectable text). This is the text tools'
 * burnRedactions. Any other mix of files, or a `decorate` step (watermark),
 * builds the PDF from page images. PNG or JPG: one image per page, a ZIP when
 * there is more than one. Image output is encoded from raw pixels, so no
 * metadata of the original is kept.
 */
import { burnRedactions } from '@/components/tools/redact/docs/pdf-burn'
import { encodeCanvasJpeg, loadPdfLib, readPdfBytes } from '@/components/tools/pdf/pdf-edit-core'
import { encodePhotoCanvasStrict } from '@/components/tools/image-edit/photo-image'
import { nextFrame, stripExtension } from '@/lib/utils'
import { paintBoxes } from '../shared/boxes'
import type { EditorBox } from '../shared/boxes'
import type { RedactLook } from '../shared/paint'
import { dropCanvas, isPdf, renderPage } from './doc-pages'
import type { DocPage } from './doc-pages'

export type ExportFormat = 'pdf' | 'png' | 'jpeg'

export const FILL: RedactLook = { style: 'fill', shape: 'rect', strength: 100 }

/** Image pixels per inch assumed for an image file placed on a PDF page. */
const IMAGE_DPI = 150

export interface ExportJob {
  pages: readonly DocPage[]
  boxesOf: (page: DocPage) => readonly EditorBox[]
  format: ExportFormat
  /** Resolution of rendered PDF pages. */
  dpi: number
  rasterAll: boolean
  /** Draws over each finished page image (a watermark). */
  decorate?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  onProgress?: (done: number, total: number) => void
}

export interface ExportResult {
  blob: Blob
  name: string
  /** Pages that became images. */
  rastered: number
}

function hidden(boxes: readonly EditorBox[]) {
  return boxes.filter((b) => !b.keep)
}

async function finishedPage(job: ExportJob, page: DocPage, maxSide: number): Promise<HTMLCanvasElement> {
  const canvas = await renderPage(page, { dpi: job.dpi, maxSide })
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser blocked canvas access, so the page cannot be drawn.')
  paintBoxes(ctx, hidden(job.boxesOf(page)), FILL, canvas.width, canvas.height)
  job.decorate?.(ctx, canvas.width, canvas.height)
  return canvas
}

/** "letter-redacted.pdf" for one file, "redacted.pdf" for several. */
function outName(pages: readonly DocPage[], ext: string): string {
  const files = new Set(pages.map((p) => p.file))
  return files.size === 1 ? `${stripExtension(pages[0].file.name)}-redacted.${ext}` : `redacted.${ext}`
}

async function burnSinglePdf(job: ExportJob): Promise<ExportResult> {
  const file = job.pages[0].file
  const rects = new Map<number, { x: number; y: number; w: number; h: number }[]>()
  for (const page of job.pages) {
    rects.set(
      page.pageNumber,
      hidden(job.boxesOf(page)).map((b) => ({ x: b.x * page.width, y: b.y * page.height, w: b.w * page.width, h: b.h * page.height })),
    )
  }
  const res = await burnRedactions(await readPdfBytes(file), rects, { dpi: job.dpi, quality: 0.9, rasterAll: job.rasterAll }, (p) => job.onProgress?.(p.done, p.total))
  return {
    blob: new Blob([res.bytes.slice().buffer], { type: 'application/pdf' }),
    name: outName(job.pages, 'pdf'),
    rastered: res.rasterPages.length,
  }
}

async function imagePdf(job: ExportJob): Promise<ExportResult> {
  const { PDFDocument } = await loadPdfLib()
  const out = await PDFDocument.create({ updateMetadata: false })
  for (const [i, page] of job.pages.entries()) {
    const canvas = await finishedPage(job, page, 6000)
    try {
      const image = await out.embedJpg(await encodeCanvasJpeg(canvas, 0.9))
      const [w, h] = page.pageNumber > 0 ? [page.width, page.height] : [(page.width * 72) / IMAGE_DPI, (page.height * 72) / IMAGE_DPI]
      out.addPage([w, h]).drawImage(image, { x: 0, y: 0, width: w, height: h })
    } finally {
      dropCanvas(canvas)
    }
    job.onProgress?.(i + 1, job.pages.length)
    await nextFrame()
  }
  const bytes = await out.save({ useObjectStreams: true })
  return { blob: new Blob([bytes.slice().buffer], { type: 'application/pdf' }), name: outName(job.pages, 'pdf'), rastered: job.pages.length }
}

async function images(job: ExportJob, format: 'png' | 'jpeg'): Promise<ExportResult> {
  const ext = format === 'png' ? 'png' : 'jpg'
  const files: { name: string; blob: Blob }[] = []
  for (const [i, page] of job.pages.entries()) {
    const canvas = await finishedPage(job, page, 12000)
    try {
      const blob = await encodePhotoCanvasStrict(canvas, format, 0.92)
      const stem = stripExtension(page.file.name)
      files.push({ name: page.pageNumber > 0 ? `${stem}-page-${page.pageNumber}-redacted.${ext}` : `${stem}-redacted.${ext}`, blob })
    } finally {
      dropCanvas(canvas)
    }
    job.onProgress?.(i + 1, job.pages.length)
    await nextFrame()
  }
  if (files.length === 1) return { blob: files[0].blob, name: files[0].name, rastered: 1 }
  const { zipSync } = await import('fflate')
  const entries: Record<string, Uint8Array> = {}
  for (const f of files) {
    let name = f.name
    for (let n = 2; entries[name]; n++) name = f.name.replace(/(\.\w+)$/, `-${n}$1`)
    entries[name] = new Uint8Array(await f.blob.arrayBuffer())
  }
  const zip = zipSync(entries, { level: 0 })
  return { blob: new Blob([zip.slice().buffer], { type: 'application/zip' }), name: outName(job.pages, 'zip'), rastered: files.length }
}

export function exportDocs(job: ExportJob): Promise<ExportResult> {
  if (job.format !== 'pdf') return images(job, job.format)
  const files = new Set(job.pages.map((p) => p.file))
  const onePdf = files.size === 1 && isPdf(job.pages[0].file)
  return onePdf && !job.decorate ? burnSinglePdf(job) : imagePdf(job)
}
