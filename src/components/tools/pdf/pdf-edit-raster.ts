/**
 * Round-2 batch `pdf-edit` — the rasterise / transform / rebuild pipeline.
 *
 * Shared by Redact PDF, Convert PDF to Grayscale and Invert PDF Colors. Every
 * page is rendered to a canvas, the pixels are altered locally, and a brand new
 * PDF is assembled from the resulting images.
 *
 * The rebuild is deliberately destructive: the output has no text layer, no
 * annotations, no form fields, no bookmarks, no attachments and no metadata,
 * because for redaction that is the entire point. The calling tools say so on
 * screen before anyone presses the button.
 */
import { nextFrame } from '@/lib/utils'
import {
  copyBytes,
  encodeCanvasJpeg,
  encodeCanvasPng,
  get2dContext,
  loadPdfJs,
  loadPdfLib,
} from './pdf-edit-core'

/** A rectangle in displayed page points, origin at the page's top-left. */
export interface DisplayBox {
  x: number
  y: number
  w: number
  h: number
}

export type PixelTransform = (data: Uint8ClampedArray, width: number, height: number) => void

export interface RasterOptions {
  /** Render resolution. 150 is fine for reading, 200–300 for print. */
  dpi: number
  /** JPEG quality, 0–1. Ignored for PNG output. */
  quality: number
  format: 'jpeg' | 'png'
  /** Applied to the raw RGBA buffer of each rendered page. */
  transform?: PixelTransform
  /** Solid black boxes burned in before encoding, keyed by 1-based page number. */
  boxes?: Map<number, DisplayBox[]>
  /** Optional title written to the rebuilt document. */
  title?: string
}

export interface RasterProgress {
  page: number
  total: number
  label: string
}

export interface Cancellation {
  cancelled: boolean
}

export interface RasterResult {
  bytes: Uint8Array
  pageCount: number
  /** Longest edge, in pixels, of the largest page rendered — for the honesty note. */
  maxPixels: number
}

/** Hard ceiling so a poster-sized page at 300 DPI cannot wedge the tab. */
const MAX_CANVAS_EDGE = 6000

export async function rasterisePdf(
  source: Uint8Array,
  options: RasterOptions,
  onProgress?: (p: RasterProgress) => void,
  cancel?: Cancellation,
): Promise<RasterResult> {
  const pdfjs = await loadPdfJs()
  const { PDFDocument } = await loadPdfLib()

  const doc = await pdfjs.getDocument({ data: copyBytes(source) }).promise
  const total = doc.numPages
  const out = await PDFDocument.create()
  out.setProducer('onthisdevice.com')
  out.setCreator('onthisdevice.com')
  if (options.title) out.setTitle(options.title)

  const canvas = document.createElement('canvas')
  const ctx = get2dContext(canvas)
  let maxPixels = 0

  try {
    for (let pageNo = 1; pageNo <= total; pageNo++) {
      if (cancel?.cancelled) throw new DOMException('Cancelled', 'AbortError')
      onProgress?.({ page: pageNo, total, label: `Rendering page ${pageNo} of ${total}` })

      const page = await doc.getPage(pageNo)
      const base = page.getViewport({ scale: 1 })
      const wanted = options.dpi / 72
      const scale = Math.min(wanted, MAX_CANVAS_EDGE / Math.max(base.width, base.height))
      const viewport = page.getViewport({ scale })

      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      maxPixels = Math.max(maxPixels, canvas.width, canvas.height)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, viewport }).promise
      page.cleanup()

      if (options.transform) {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        options.transform(image.data, canvas.width, canvas.height)
        ctx.putImageData(image, 0, 0)
      }

      // Boxes go on *after* the pixel transform so a redaction stays pure black
      // even in inverted or thresholded output.
      const boxes = options.boxes?.get(pageNo)
      if (boxes && boxes.length > 0) {
        ctx.fillStyle = '#000000'
        for (const box of boxes) {
          ctx.fillRect(
            Math.floor(box.x * scale),
            Math.floor(box.y * scale),
            Math.ceil(box.w * scale),
            Math.ceil(box.h * scale),
          )
        }
      }

      onProgress?.({ page: pageNo, total, label: `Encoding page ${pageNo} of ${total}` })
      const imageBytes =
        options.format === 'png'
          ? await encodeCanvasPng(canvas)
          : await encodeCanvasJpeg(canvas, options.quality)

      const embedded =
        options.format === 'png' ? await out.embedPng(imageBytes) : await out.embedJpg(imageBytes)

      const newPage = out.addPage([base.width, base.height])
      newPage.drawImage(embedded, { x: 0, y: 0, width: base.width, height: base.height })

      await nextFrame()
    }
  } finally {
    void doc.loadingTask.destroy()
    canvas.width = 0
    canvas.height = 0
  }

  onProgress?.({ page: total, total, label: 'Writing the new PDF' })
  const bytes = await out.save({ useObjectStreams: true })
  return { bytes, pageCount: total, maxPixels }
}

/* ------------------------------------------------------------------ */
/* Pixel transforms                                                    */
/* ------------------------------------------------------------------ */

/** Rec. 709 luma — the weighting that matches how the eye reads brightness. */
export function grayscaleLuma(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const v = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
  }
}

/** Flat average of the three channels — what most "desaturate" buttons do. */
export function grayscaleAverage(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const v = (data[i] + data[i + 1] + data[i + 2]) / 3
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
  }
}

/** Pure black and white at a fixed cut-off. */
export function threshold(cut: number) {
  return (data: Uint8ClampedArray): void => {
    for (let i = 0; i < data.length; i += 4) {
      const v = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      const out = v >= cut ? 255 : 0
      data[i] = out
      data[i + 1] = out
      data[i + 2] = out
    }
  }
}

/** Floyd–Steinberg error diffusion: keeps photographs readable in 1-bit. */
export function dither(cut: number) {
  return (data: Uint8ClampedArray, width: number, height: number): void => {
    const gray = new Float32Array(width * height)
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x
        const old = gray[p]
        const out = old >= cut ? 255 : 0
        gray[p] = out
        const err = old - out
        if (x + 1 < width) gray[p + 1] += (err * 7) / 16
        if (y + 1 < height) {
          if (x > 0) gray[p + width - 1] += (err * 3) / 16
          gray[p + width] += (err * 5) / 16
          if (x + 1 < width) gray[p + width + 1] += err / 16
        }
      }
    }
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const v = gray[p]
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
    }
  }
}

/** Photographic negative. */
export function invertColors(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]
    data[i + 1] = 255 - data[i + 1]
    data[i + 2] = 255 - data[i + 2]
  }
}

/**
 * Dark mode: flip lightness but keep hue, so white paper turns black while a
 * red stamp stays red instead of becoming cyan.
 *
 * For a channel c with page max/min, `255 − max − min + c` maps the lightest
 * channel to `255 − min` and the darkest to `255 − max`. The gap between them
 * — the saturation — is untouched, and the ordering of the channels, which is
 * what carries the hue, is preserved.
 */
export function invertLightness(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const shift = 255 - Math.max(r, g, b) - Math.min(r, g, b)
    data[i] = shift + r
    data[i + 1] = shift + g
    data[i + 2] = shift + b
  }
}
