/**
 * Pages of the documents a user drops (PDF pages and image files), rendered
 * on demand. Used by the signature, scanned-document and ID tools.
 *
 *   openFiles(files) -> DocPage[]
 *   renderPage(page, { dpi, maxSide }) -> canvas with the page on white
 *   closeFiles(pages)                    frees the pdf.js documents
 *
 * Only one page image is in memory at a time: a 100-page PDF at 150 dpi would
 * need more than 800 MB as bitmaps.
 */
import { copyBytes, loadPdfJs, readPdfBytes } from '@/components/tools/pdf/pdf-edit-core'
import { decodePhoto } from '@/components/tools/image-edit/photo-image'

type PdfJs = Awaited<ReturnType<typeof loadPdfJs>>
type PdfDoc = Awaited<ReturnType<PdfJs['getDocument']>['promise']>

export interface DocPage {
  id: string
  file: File
  /** 1-based page of a PDF; 0 for an image file. */
  pageNumber: number
  /** "contract.pdf, page 2" or the image name. */
  label: string
  /** PDF points (after the page's rotation) or image pixels. */
  width: number
  height: number
}

export const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

const docs = new WeakMap<File, Promise<PdfDoc>>()
let counter = 0

function pdfOf(file: File): Promise<PdfDoc> {
  let job = docs.get(file)
  if (!job) {
    job = (async () => {
      const pdfjs = await loadPdfJs()
      return pdfjs.getDocument({ data: copyBytes(await readPdfBytes(file)) }).promise
    })()
    docs.set(file, job)
    job.catch(() => docs.delete(file))
  }
  return job
}

export async function openFiles(files: File[]): Promise<DocPage[]> {
  const pages: DocPage[] = []
  for (const file of files) {
    if (isPdf(file)) {
      const doc = await pdfOf(file)
      for (let n = 1; n <= doc.numPages; n++) {
        const vp = (await doc.getPage(n)).getViewport({ scale: 1 })
        pages.push({ id: `page-${++counter}`, file, pageNumber: n, label: `${file.name}, page ${n}`, width: vp.width, height: vp.height })
      }
    } else {
      const { bitmap, width, height } = await decodePhoto(file)
      bitmap.close()
      pages.push({ id: `page-${++counter}`, file, pageNumber: 0, label: file.name, width, height })
    }
  }
  return pages
}

/** The last decoded image file, so moving between steps does not decode it again. */
let lastImage: { file: File; bitmap: ImageBitmap } | null = null

async function imageOf(file: File): Promise<ImageBitmap> {
  if (lastImage?.file === file) return lastImage.bitmap
  lastImage?.bitmap.close()
  lastImage = null
  const { bitmap } = await decodePhoto(file)
  lastImage = { file, bitmap }
  return bitmap
}

export interface RenderOptions {
  /** Resolution of a PDF page. Images keep their pixels. */
  dpi: number
  /** Longest side of the result, in pixels. */
  maxSide: number
}

export async function renderPage(page: DocPage, { dpi, maxSide }: RenderOptions): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('This browser blocked canvas access, so the page cannot be drawn.')
  if (page.pageNumber > 0) {
    const doc = await pdfOf(page.file)
    const p = await doc.getPage(page.pageNumber)
    const scale = Math.min(dpi / 72, maxSide / Math.max(page.width, page.height))
    const viewport = p.getViewport({ scale })
    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await p.render({ canvas, viewport }).promise
    p.cleanup()
    return canvas
  }
  const bitmap = await imageOf(page.file)
  const k = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  canvas.width = Math.max(1, Math.round(bitmap.width * k))
  canvas.height = Math.max(1, Math.round(bitmap.height * k))
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function closeFiles(pages: readonly DocPage[]) {
  lastImage?.bitmap.close()
  lastImage = null
  for (const file of new Set(pages.map((p) => p.file))) {
    const job = docs.get(file)
    docs.delete(file)
    if (job) void job.then((d) => d.loadingTask.destroy()).catch(() => {})
  }
}

/** Frees a canvas's pixel memory now instead of at garbage collection. */
export function dropCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}
