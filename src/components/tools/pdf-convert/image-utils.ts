/**
 * Decoding and page-placement helpers for the "images → PDF" converters.
 *
 * pdf-lib can only embed JPEG and PNG, so anything else (WebP, AVIF, GIF, BMP)
 * is decoded with `createImageBitmap` and re-encoded to PNG first. JPEGs that
 * carry a non-default EXIF orientation are baked upright, because pdf-lib
 * ignores EXIF and would otherwise place a sideways photo.
 */
import { fileExtension } from '@/lib/utils'
import type { PDFDocument, PDFImage } from 'pdf-lib'

export type EmbedKind = 'jpg' | 'png'

export interface PreparedImage {
  id: string
  name: string
  /** Original file size in bytes. */
  size: number
  width: number
  height: number
  kind: EmbedKind
  bytes: Uint8Array
  previewUrl: string
}

/* --------------------------------------------------------------- EXIF */

/**
 * Read just the EXIF `Orientation` tag out of a JPEG. Returns 1 when absent.
 * Small and dependency-free: we only need to know whether a re-encode is due.
 */
export function readJpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return 1

  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset, false)
    if ((marker & 0xff00) !== 0xff00) return 1
    const length = view.getUint16(offset + 2, false)
    if (marker === 0xffe1) {
      const exifStart = offset + 4
      if (exifStart + 6 > view.byteLength) return 1
      // "Exif\0\0"
      if (view.getUint32(exifStart, false) !== 0x45786966) return 1
      const tiff = exifStart + 6
      if (tiff + 8 > view.byteLength) return 1
      const little = view.getUint16(tiff, false) === 0x4949
      const ifdOffset = view.getUint32(tiff + 4, little)
      const dir = tiff + ifdOffset
      if (dir + 2 > view.byteLength) return 1
      const entries = view.getUint16(dir, little)
      for (let i = 0; i < entries; i++) {
        const entry = dir + 2 + i * 12
        if (entry + 12 > view.byteLength) break
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little)
          return value >= 1 && value <= 8 ? value : 1
        }
      }
      return 1
    }
    if (length < 2) return 1
    offset += 2 + length
  }
  return 1
}

/* ------------------------------------------------------------ decoding */

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('the browser could not re-encode this image'))),
      mime,
      quality,
    )
  })
}

async function bitmapFrom(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Older Safari lacks the options bag.
    return createImageBitmap(file)
  }
}

async function bitmapToBytes(
  bitmap: ImageBitmap,
  mime: 'image/png' | 'image/jpeg',
  quality?: number,
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('this browser refused to create a 2D canvas')
  ctx.drawImage(bitmap, 0, 0)
  const blob = await canvasToBlob(canvas, mime, quality)
  canvas.width = 0
  canvas.height = 0
  return new Uint8Array(await blob.arrayBuffer())
}

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `img-${idCounter}-${Date.now().toString(36)}`
}

export const IMAGE_MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
}

/** Decode one file into something pdf-lib can embed, plus a preview URL. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const ext = fileExtension(file.name)
  const mime = file.type || IMAGE_MIME_BY_EXT[ext] || ''
  const isJpeg = mime === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg' || ext === 'jpe' || ext === 'jfif'
  const isPng = mime === 'image/png' || ext === 'png'

  let bitmap: ImageBitmap
  try {
    bitmap = await bitmapFrom(file)
  } catch {
    throw new Error(
      `"${file.name}" could not be decoded. It may be corrupted, or in a format this browser cannot read.`,
    )
  }

  let kind: EmbedKind
  let bytes: Uint8Array

  if (isJpeg) {
    const original = new Uint8Array(await file.arrayBuffer())
    if (readJpegOrientation(original) === 1) {
      kind = 'jpg'
      bytes = original
    } else {
      // Bake the rotation in — pdf-lib does not read EXIF.
      kind = 'jpg'
      bytes = await bitmapToBytes(bitmap, 'image/jpeg', 0.94)
    }
  } else if (isPng) {
    kind = 'png'
    bytes = new Uint8Array(await file.arrayBuffer())
  } else {
    kind = 'png'
    bytes = await bitmapToBytes(bitmap, 'image/png')
  }

  const width = bitmap.width
  const height = bitmap.height
  bitmap.close()

  return {
    id: nextId(),
    name: file.name,
    size: file.size,
    width,
    height,
    kind,
    bytes,
    // Preview straight from the original file: no second copy of the pixels in
    // memory, and the browser applies EXIF orientation exactly as we baked it.
    previewUrl: URL.createObjectURL(file),
  }
}

export async function embedPrepared(doc: PDFDocument, image: PreparedImage): Promise<PDFImage> {
  return image.kind === 'jpg' ? doc.embedJpg(image.bytes) : doc.embedPng(image.bytes)
}

/* ------------------------------------------------------------ placement */

export type FitMode = 'contain' | 'cover' | 'stretch'
export type OrientationMode = 'auto' | 'portrait' | 'landscape'

export interface Placement {
  pageWidth: number
  pageHeight: number
  x: number
  y: number
  width: number
  height: number
}

/** PDF's hard limit on a page dimension is 14 400 pt (200 inches). */
const MAX_PAGE_PT = 14_400

export interface PlacementInput {
  imageWidth: number
  imageHeight: number
  /** `null` means "page matches the image" (auto). */
  page: { width: number; height: number } | null
  orientation: OrientationMode
  /** Uniform margin in points. */
  margin: number
  fit: FitMode
}

export function placeImage(input: PlacementInput): Placement {
  const { imageWidth, imageHeight, orientation, margin, fit } = input

  if (!input.page) {
    // Auto: the page is the image, plus the margin, clamped to the PDF maximum.
    let w = imageWidth
    let h = imageHeight
    const longest = Math.max(w, h) + margin * 2
    if (longest > MAX_PAGE_PT) {
      const k = (MAX_PAGE_PT - margin * 2) / Math.max(w, h)
      w *= k
      h *= k
    }
    return {
      pageWidth: w + margin * 2,
      pageHeight: h + margin * 2,
      x: margin,
      y: margin,
      width: w,
      height: h,
    }
  }

  let pageWidth = input.page.width
  let pageHeight = input.page.height
  const wantLandscape =
    orientation === 'landscape' || (orientation === 'auto' && imageWidth > imageHeight)
  if (wantLandscape !== pageWidth > pageHeight) {
    const t = pageWidth
    pageWidth = pageHeight
    pageHeight = t
  }

  const availableWidth = Math.max(1, pageWidth - margin * 2)
  const availableHeight = Math.max(1, pageHeight - margin * 2)

  if (fit === 'stretch') {
    return {
      pageWidth,
      pageHeight,
      x: margin,
      y: margin,
      width: availableWidth,
      height: availableHeight,
    }
  }

  const scaleContain = Math.min(availableWidth / imageWidth, availableHeight / imageHeight)
  const scaleCover = Math.max(pageWidth / imageWidth, pageHeight / imageHeight)
  const scale = fit === 'cover' ? scaleCover : scaleContain

  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    pageWidth,
    pageHeight,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  }
}

export { MM_PER_PT, mmToPt } from './pdf-common'
