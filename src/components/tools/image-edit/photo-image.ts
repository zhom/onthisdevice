/**
 * Round-2 `photo` batch — private image helpers.
 *
 * Deliberately self-contained: this batch shares the `image-edit` directory
 * with round-1 islands but must not import their internals. Everything here
 * runs in the browser; no network, no uploads.
 */
import type { CSSProperties } from 'react'
import { fileExtension, stripExtension } from '@/lib/utils'

export type PhotoFormat = 'jpeg' | 'png' | 'webp'

export const PHOTO_MIME: Record<PhotoFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export const PHOTO_EXT: Record<PhotoFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
}

/** Broad accept string — decoding is native first, wasm second. */
export const PHOTO_ACCEPT = 'image/*,.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp'

/** A transparent-checkerboard backdrop that reads correctly in both themes. */
export const PHOTO_CHECKER: CSSProperties = {
  backgroundImage:
    'repeating-conic-gradient(color-mix(in oklch, var(--foreground) 9%, transparent) 0% 25%, transparent 0% 50%)',
  backgroundSize: '16px 16px',
}

export function photoFormatOf(file: File): PhotoFormat {
  const ext = fileExtension(file.name)
  const type = file.type.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg' || type === 'image/jpeg') return 'jpeg'
  if (ext === 'webp' || type === 'image/webp') return 'webp'
  return 'png'
}

export function photoOutputName(name: string, suffix: string, format: PhotoFormat): string {
  return `${stripExtension(name) || 'image'}${suffix}.${PHOTO_EXT[format]}`
}

/* ───────────────────────────── canvas ───────────────────────────── */

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

export function ctx2d(
  canvas: HTMLCanvasElement,
  options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', options)
  if (!ctx) {
    throw new Error('Your browser blocked 2D canvas access, so images cannot be processed here.')
  }
  return ctx
}

export function bitmapToCanvas(bitmap: ImageBitmap): HTMLCanvasElement {
  const canvas = makeCanvas(bitmap.width, bitmap.height)
  ctx2d(canvas).drawImage(bitmap, 0, 0)
  return canvas
}

export function canvasData(canvas: HTMLCanvasElement): ImageData {
  return ctx2d(canvas, { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height)
}

/** Proportionally shrink a source so neither side exceeds `maxSide`. */
export function fitScale(width: number, height: number, maxSide: number): number {
  return Math.min(maxSide / width, maxSide / height, 1)
}

/* ───────────────────────────── decoding ───────────────────────────── */

export interface DecodedPhoto {
  bitmap: ImageBitmap
  width: number
  height: number
}

async function decodeWithWasm(buffer: ArrayBuffer, hint: string): Promise<ImageData | null> {
  try {
    if (hint === 'jpeg') {
      const { decode } = await import('@jsquash/jpeg')
      return await decode(buffer)
    }
    if (hint === 'png') {
      const { decode } = await import('@jsquash/png')
      return await decode(buffer)
    }
    if (hint === 'webp') {
      const { decode } = await import('@jsquash/webp')
      return await decode(buffer)
    }
    if (hint === 'avif') {
      const { decode } = await import('@jsquash/avif')
      return await decode(buffer)
    }
  } catch {
    return null
  }
  return null
}

function hintFor(name: string, type: string): string {
  const ext = fileExtension(name)
  const t = type.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg' || t === 'image/jpeg') return 'jpeg'
  if (ext === 'png' || t === 'image/png') return 'png'
  if (ext === 'webp' || t === 'image/webp') return 'webp'
  if (ext === 'avif' || t === 'image/avif') return 'avif'
  return ''
}

async function decodeWithElement(blob: Blob): Promise<ImageBitmap | null> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return await createImageBitmap(img)
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Decode anything the browser or our wasm codecs can read.
 * Order: native `createImageBitmap` → wasm codec by type → `<img>` element.
 */
export async function decodePhoto(source: File | Blob, fallbackName = 'image'): Promise<DecodedPhoto> {
  const name = source instanceof File ? source.name : fallbackName
  let bitmap: ImageBitmap | null = null

  if (typeof createImageBitmap === 'function') {
    try {
      bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' })
    } catch {
      bitmap = null
    }
  }

  if (!bitmap) {
    const hint = hintFor(name, source.type)
    if (hint) {
      const data = await decodeWithWasm(await source.arrayBuffer(), hint)
      if (data) bitmap = await createImageBitmap(data)
    }
  }

  if (!bitmap) bitmap = await decodeWithElement(source)

  if (!bitmap || bitmap.width === 0 || bitmap.height === 0) {
    const ext = fileExtension(name).toUpperCase()
    const isHeic = ext === 'HEIC' || ext === 'HEIF'
    throw new Error(
      isHeic
        ? `“${name}” is a HEIC photo. Only Safari can decode HEIC. On iPhone, set Camera → Formats → Most Compatible, or export a JPG first.`
        : `Could not read “${name}”. Your browser cannot decode ${ext || 'this'} images, or the file is damaged.`,
    )
  }

  return { bitmap, width: bitmap.width, height: bitmap.height }
}

/* ───────────────────────────── encoding ───────────────────────────── */

/** Encode ImageData with the wasm codecs — exact, deterministic quality control. */
export async function encodePhotoData(
  data: ImageData,
  format: PhotoFormat,
  quality: number,
): Promise<Blob> {
  const q = Math.round(Math.min(100, Math.max(1, quality * 100)))
  if (format === 'jpeg') {
    const { encode } = await import('@jsquash/jpeg')
    return new Blob([await encode(data, { quality: q })], { type: PHOTO_MIME.jpeg })
  }
  if (format === 'webp') {
    const { encode } = await import('@jsquash/webp')
    return new Blob([await encode(data, { quality: q })], { type: PHOTO_MIME.webp })
  }
  const { encode } = await import('@jsquash/png')
  return new Blob([await encode(data)], { type: PHOTO_MIME.png })
}

/** Encode a canvas with the browser encoder, falling back to the wasm codec. */
export async function encodePhotoCanvas(
  canvas: HTMLCanvasElement,
  format: PhotoFormat,
  quality = 0.92,
): Promise<Blob> {
  const mime = PHOTO_MIME[format]
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, quality)
  })
  if (blob && blob.type === mime && blob.size > 0) return blob
  return encodePhotoData(canvasData(canvas), format, quality)
}

/**
 * Encode a canvas through the wasm codecs only.
 *
 * Used where the *bytes* matter: the target-size search needs a monotonic
 * quality→size curve, and re-encoding through MozJPEG guarantees no EXIF,
 * GPS or camera metadata survives into the output.
 */
export async function encodePhotoCanvasStrict(
  canvas: HTMLCanvasElement,
  format: PhotoFormat,
  quality: number,
): Promise<Blob> {
  try {
    return await encodePhotoData(canvasData(canvas), format, quality)
  } catch {
    return encodePhotoCanvas(canvas, format, quality)
  }
}

/* ───────────────────────────── resizing ───────────────────────────── */

/** Lanczos3 resample via wasm, with a stepped-canvas fallback. */
export async function resizePhotoData(
  source: ImageData,
  width: number,
  height: number,
): Promise<ImageData> {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  if (w === source.width && h === source.height) return source
  try {
    const { default: resize } = await import('@jsquash/resize')
    return await resize(source, {
      width: w,
      height: h,
      method: 'lanczos3',
      fitMethod: 'stretch',
      premultiply: true,
      linearRGB: true,
    })
  } catch {
    return steppedResize(source, w, h)
  }
}

function steppedResize(source: ImageData, width: number, height: number): ImageData {
  let current = makeCanvas(source.width, source.height)
  ctx2d(current).putImageData(source, 0, 0)
  let cw = source.width
  let ch = source.height
  while (cw > width * 2 || ch > height * 2) {
    cw = Math.max(width, Math.floor(cw / 2))
    ch = Math.max(height, Math.floor(ch / 2))
    const next = makeCanvas(cw, ch)
    const nctx = ctx2d(next)
    nctx.imageSmoothingEnabled = true
    nctx.imageSmoothingQuality = 'high'
    nctx.drawImage(current, 0, 0, cw, ch)
    current = next
  }
  const out = makeCanvas(width, height)
  const octx = ctx2d(out, { willReadFrequently: true })
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(current, 0, 0, width, height)
  return octx.getImageData(0, 0, width, height)
}

export async function resizePhotoCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  if (w === canvas.width && h === canvas.height) return canvas
  const out = await resizePhotoData(canvasData(canvas), w, h)
  const target = makeCanvas(out.width, out.height)
  ctx2d(target).putImageData(out, 0, 0)
  return target
}

/* ───────────────────────────── misc ───────────────────────────── */

export function photoError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return fallback
}

let idCounter = 0
export function nextPhotoId(): string {
  idCounter += 1
  return `photo-${idCounter}`
}

/** Clamp helper that also copes with NaN from empty number inputs. */
export function safeNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace(/^#/, '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  const d = max - min
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
    else if (max === gn) h = ((bn - rn) / d + 2) * 60
    else h = ((rn - gn) / d + 4) * 60
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}
