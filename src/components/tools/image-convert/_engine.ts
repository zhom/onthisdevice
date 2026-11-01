/**
 * Isomorphic image-conversion engine for the Image Converters category.
 *
 * Runs unchanged on the main thread and inside a dedicated worker:
 *  - decode any raster input (native `createImageBitmap` first, WebAssembly
 *    codec fallback when the browser cannot read the format itself),
 *  - optionally flatten transparency onto a solid colour,
 *  - encode to JPEG / PNG / WebP / AVIF with the @jsquash (Squoosh) codecs.
 *
 * Nothing here touches the network. Every codec is bundled and lazily
 * `await import()`ed so the wasm only downloads for the format actually used.
 */

export type RasterFormat = 'jpeg' | 'png' | 'webp' | 'avif'

export interface FormatMeta {
  /** Human label used in copy and buttons. */
  label: string
  mime: string
  /** Output file extension, without the dot. */
  ext: string
  /** True when the encoder throws away detail to save bytes. */
  lossy: boolean
  /** True when the container can store per-pixel transparency. */
  alpha: boolean
}

export const FORMATS: Record<RasterFormat, FormatMeta> = {
  jpeg: { label: 'JPG', mime: 'image/jpeg', ext: 'jpg', lossy: true, alpha: false },
  png: { label: 'PNG', mime: 'image/png', ext: 'png', lossy: false, alpha: true },
  webp: { label: 'WebP', mime: 'image/webp', ext: 'webp', lossy: true, alpha: true },
  avif: { label: 'AVIF', mime: 'image/avif', ext: 'avif', lossy: true, alpha: true },
}

export const ALL_TARGETS: RasterFormat[] = ['jpeg', 'png', 'webp', 'avif']

/** What the caller asks the engine to produce. */
export interface EncodeSettings {
  format: RasterFormat
  /** 1-100. Ignored for PNG and when `lossless` is set. */
  quality: number
  /** WebP/AVIF only — mathematically perfect but much larger. */
  lossless: boolean
  /** AVIF encoder speed, 0 (slowest, smallest) … 10 (fastest). */
  speed: number
  /** `null` keeps transparency; a `#rrggbb` string flattens onto that colour. */
  background: string | null
}

export type JobSource =
  | { kind: 'bytes'; bytes: ArrayBuffer; mime: string }
  | { kind: 'pixels'; data: Uint8ClampedArray; width: number; height: number }

export interface JobOutput {
  bytes: ArrayBuffer
  mime: string
  width: number
  height: number
}

export interface WorkerRequest {
  id: number
  source: JobSource
  settings: EncodeSettings
}

export type WorkerResponse =
  | { id: number; ok: true; bytes: ArrayBuffer; mime: string; width: number; height: number }
  | { id: number; ok: false; error: string }

/** An error whose message is safe (and useful) to show a human. */
export class ImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageError'
  }
}

/* ────────────────────────────── format sniffing ───────────────────────────── */

export type SniffedFormat = RasterFormat | 'gif' | 'bmp' | 'svg' | 'ico' | 'tiff' | 'heic' | 'unknown'

const ASCII = (bytes: Uint8Array, start: number, length: number): string => {
  let out = ''
  for (let i = start; i < start + length && i < bytes.length; i++) out += String.fromCharCode(bytes[i])
  return out
}

/** Identify an image by its magic bytes — never trust the file extension. */
export function sniffBytes(buffer: ArrayBuffer): SniffedFormat {
  const b = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 512))
  if (b.length < 4) return 'unknown'

  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (ASCII(b, 0, 4) === 'RIFF' && ASCII(b, 8, 4) === 'WEBP') return 'webp'
  if (ASCII(b, 0, 3) === 'GIF') return 'gif'
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp'
  if (b[0] === 0x00 && b[1] === 0x00 && (b[2] === 0x01 || b[2] === 0x02) && b[3] === 0x00) return 'ico'
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00)) {
    return 'tiff'
  }

  if (ASCII(b, 4, 4) === 'ftyp') {
    const brand = ASCII(b, 8, 4)
    if (brand === 'avif' || brand === 'avis') return 'avif'
    if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'heim' || brand === 'mif1') {
      // `mif1` is shared by AVIF and HEIC; look for an av01 compatible brand.
      const header = ASCII(b, 8, 40)
      return header.includes('avif') || header.includes('av01') ? 'avif' : 'heic'
    }
  }

  // Text-based: an SVG may open with a BOM, an XML prolog, a DOCTYPE or a comment.
  const head = ASCII(b, 0, b.length)
    .replace(/^(﻿|ï»¿)/, '')
    .trimStart()
    .toLowerCase()
  if (head.startsWith('<') && head.includes('<svg')) return 'svg'

  return 'unknown'
}

const SNIFF_MIME: Record<SniffedFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  tiff: 'image/tiff',
  heic: 'image/heic',
  unknown: 'application/octet-stream',
}

/** Friendly name for an input format, used in error messages. */
export function sniffLabel(format: SniffedFormat): string {
  switch (format) {
    case 'jpeg':
      return 'JPEG'
    case 'png':
      return 'PNG'
    case 'webp':
      return 'WebP'
    case 'avif':
      return 'AVIF'
    case 'gif':
      return 'GIF'
    case 'bmp':
      return 'BMP'
    case 'svg':
      return 'SVG'
    case 'ico':
      return 'ICO'
    case 'tiff':
      return 'TIFF'
    case 'heic':
      return 'HEIC'
    default:
      return 'unrecognised'
  }
}

/* ─────────────────────────────── canvas plumbing ──────────────────────────── */

/**
 * A 2D context backed by an OffscreenCanvas in workers and a DOM canvas on the
 * main thread. The two context interfaces are structurally identical for
 * everything used here, so the DOM type is used for both.
 */
export function get2dContext(width: number, height: number): CanvasRenderingContext2D {
  if (width < 1 || height < 1) {
    throw new ImageError('That image reports a size of zero pixels, so there is nothing to convert.')
  }
  if (width * height > 268_435_456) {
    throw new ImageError(
      'That image is larger than 268 megapixels, which is more than a browser canvas can hold. Resize it first.',
    )
  }

  let ctx: CanvasRenderingContext2D | null = null
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    }) as unknown as CanvasRenderingContext2D | null
  } else if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d', { willReadFrequently: true })
  }

  if (!ctx) {
    throw new ImageError('This browser refused to create a drawing canvas, so images cannot be decoded here.')
  }
  return ctx
}

function bitmapToImageData(bitmap: ImageBitmap): ImageData {
  const ctx = get2dContext(bitmap.width, bitmap.height)
  ctx.drawImage(bitmap, 0, 0)
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
}

/* ───────────────────────────────── decoding ───────────────────────────────── */

async function decodeWithCodec(format: SniffedFormat, bytes: ArrayBuffer): Promise<ImageData | null> {
  switch (format) {
    case 'jpeg': {
      const { default: decode } = await import('@jsquash/jpeg/decode')
      return decode(bytes)
    }
    case 'png': {
      const { default: decode } = await import('@jsquash/png/decode')
      return decode(bytes)
    }
    case 'webp': {
      const { default: decode } = await import('@jsquash/webp/decode')
      return decode(bytes)
    }
    case 'avif': {
      const { default: decode } = await import('@jsquash/avif/decode')
      return decode(bytes)
    }
    default:
      return null
  }
}

/**
 * Decode any supported raster image to raw RGBA pixels.
 *
 * The browser's own decoder is tried first — it is fast, already loaded and
 * applies the EXIF orientation. When it cannot read the format (older Safari
 * and AVIF, for example) the matching WebAssembly codec takes over.
 */
export async function decodeBytes(bytes: ArrayBuffer, mimeHint = ''): Promise<ImageData> {
  const sniffed = sniffBytes(bytes)

  if (sniffed === 'svg') {
    throw new ImageError(
      'That file is an SVG. Vector files have to be rasterised at a chosen size. Use the SVG to PNG tool.',
    )
  }
  if (sniffed === 'heic') {
    throw new ImageError(
      'That file is an HEIC photo from an Apple device. Export it as JPEG or PNG first. HEIC is patent-encumbered and has no open browser decoder.',
    )
  }

  const type = sniffed === 'unknown' ? mimeHint || 'application/octet-stream' : SNIFF_MIME[sniffed]

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(new Blob([bytes], { type }), {
        imageOrientation: 'from-image',
      })
      try {
        return bitmapToImageData(bitmap)
      } finally {
        bitmap.close()
      }
    } catch (err) {
      if (err instanceof ImageError) throw err
      // Fall through to the WebAssembly codecs.
    }
  }

  const decoded = await decodeWithCodec(sniffed, bytes).catch(() => null)
  if (decoded) return decoded

  if (sniffed === 'unknown') {
    throw new ImageError('That file does not look like an image. Its contents match no known image format.')
  }
  throw new ImageError(
    `This browser could not decode that ${sniffLabel(sniffed)} file. It may be truncated, corrupt or use an unusual sub-format.`,
  )
}

/* ─────────────────────────────── colour + alpha ───────────────────────────── */

/** Parse `#rgb`, `#rrggbb` or `#rrggbbaa` into 0-255 channels. */
export function parseHexColor(input: string): [number, number, number] {
  const hex = input.trim().replace(/^#/, '')
  const expand = hex.length === 3 || hex.length === 4 ? hex.slice(0, 3).split('').map((c) => c + c).join('') : hex.slice(0, 6)
  if (!/^[0-9a-f]{6}$/i.test(expand)) return [255, 255, 255]
  return [
    parseInt(expand.slice(0, 2), 16),
    parseInt(expand.slice(2, 4), 16),
    parseInt(expand.slice(4, 6), 16),
  ]
}

/** True when at least one pixel is not fully opaque. */
export function hasTransparency(image: ImageData): boolean {
  const d = image.data
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] !== 255) return true
  }
  return false
}

/** Composite the image over a solid colour, in place. Returns the same buffer. */
export function flattenOnto(image: ImageData, color: string): ImageData {
  const [br, bg, bb] = parseHexColor(color)
  const d = image.data
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]
    if (a === 255) continue
    if (a === 0) {
      d[i] = br
      d[i + 1] = bg
      d[i + 2] = bb
      d[i + 3] = 255
      continue
    }
    const f = a / 255
    d[i] = Math.round(d[i] * f + br * (1 - f))
    d[i + 1] = Math.round(d[i + 1] * f + bg * (1 - f))
    d[i + 2] = Math.round(d[i + 2] * f + bb * (1 - f))
    d[i + 3] = 255
  }
  return image
}

/* ───────────────────────────────── encoding ───────────────────────────────── */

export async function encodePixels(image: ImageData, settings: EncodeSettings): Promise<ArrayBuffer> {
  const quality = Math.round(Math.min(100, Math.max(1, settings.quality)))

  switch (settings.format) {
    case 'jpeg': {
      const { default: encode } = await import('@jsquash/jpeg/encode')
      return encode(image, { quality, progressive: true, optimize_coding: true })
    }
    case 'png': {
      const { default: encode } = await import('@jsquash/png/encode')
      return encode(image)
    }
    case 'webp': {
      const { default: encode } = await import('@jsquash/webp/encode')
      return settings.lossless
        ? encode(image, { lossless: 1, quality: 100, exact: 1, method: 4 })
        : encode(image, { quality, method: 4 })
    }
    case 'avif': {
      const { default: encode } = await import('@jsquash/avif/encode')
      const speed = Math.round(Math.min(10, Math.max(0, settings.speed)))
      return settings.lossless
        ? encode(image, { lossless: true, quality: 100, qualityAlpha: 100, speed })
        : encode(image, { quality, speed })
    }
  }
}

/* ─────────────────────────────────── job ──────────────────────────────────── */

/**
 * The whole pipeline for one image: decode → flatten (if needed) → encode.
 * Called directly on the main thread, or through the worker.
 */
export async function runJob(source: JobSource, settings: EncodeSettings): Promise<JobOutput> {
  let image: ImageData
  if (source.kind === 'pixels') {
    // Rebuilt rather than wrapped: after a structured clone the array's backing
    // buffer is not guaranteed to be the plain ArrayBuffer ImageData demands.
    image = new ImageData(source.width, source.height)
    image.data.set(source.data)
  } else {
    image = await decodeBytes(source.bytes, source.mime)
  }

  const targetKeepsAlpha = FORMATS[settings.format].alpha
  if (settings.background !== null) {
    flattenOnto(image, settings.background)
  } else if (!targetKeepsAlpha && hasTransparency(image)) {
    // JPEG has no alpha channel: white is the least surprising default.
    flattenOnto(image, '#ffffff')
  }

  const bytes = await encodePixels(image, settings)
  if (!bytes || bytes.byteLength === 0) {
    throw new ImageError(`The ${FORMATS[settings.format].label} encoder returned an empty file. Try a different quality setting.`)
  }

  return { bytes, mime: FORMATS[settings.format].mime, width: image.width, height: image.height }
}

/** Turn anything thrown by the pipeline into a sentence a person can act on. */
export function describeError(err: unknown): string {
  if (err instanceof ImageError) return err.message
  if (err instanceof RangeError || (err instanceof Error && /allocat|out of memory|maximum call/i.test(err.message))) {
    return 'Your browser ran out of memory on that image. Try converting fewer files at once, or a smaller image.'
  }
  if (err instanceof Error && err.message) {
    return `Conversion failed: ${err.message}`
  }
  return 'Conversion failed for an unknown reason. Try reloading the page and converting one file at a time.'
}
