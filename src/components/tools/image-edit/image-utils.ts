/**
 * Private helpers shared by the Image Editing islands.
 * Everything here runs in the browser — no network, no uploads.
 */
import { fileExtension, stripExtension } from '@/lib/utils'

export type OutputFormat = 'png' | 'jpeg' | 'webp'

export const MIME: Record<OutputFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export const EXT: Record<OutputFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
}

/** Formats we can hand to `<input accept>` — broad, because decoding is browser native. */
export const IMAGE_ACCEPT = 'image/*,.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp,.svg'

/** Lossy formats accept a quality parameter; PNG does not. */
export function isLossy(format: OutputFormat): boolean {
  return format === 'jpeg' || format === 'webp'
}

/** The format we will re-encode to when the user asks to "keep the original". */
export function formatFromFile(file: File): OutputFormat {
  const ext = fileExtension(file.name)
  const type = file.type.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg' || type === 'image/jpeg') return 'jpeg'
  if (ext === 'webp' || type === 'image/webp') return 'webp'
  return 'png'
}

/** True when "keep original" cannot be honoured and we silently fall back to PNG. */
export function fallsBackToPng(file: File): boolean {
  const ext = fileExtension(file.name)
  return ext === 'avif' || ext === 'gif' || ext === 'bmp' || ext === 'svg' || ext === 'heic' || ext === 'heif'
}

export function outputName(file: File, suffix: string, format: OutputFormat): string {
  return `${stripExtension(file.name)}${suffix}.${EXT[format]}`
}

/* ────────────────────────────── decoding ────────────────────────────── */

export interface DecodedImage {
  bitmap: ImageBitmap
  width: number
  height: number
}

async function decodeViaWasm(file: File): Promise<ImageBitmap | null> {
  const ext = fileExtension(file.name)
  const type = file.type.toLowerCase()
  try {
    let data: ImageData | null = null
    if (ext === 'jpg' || ext === 'jpeg' || type === 'image/jpeg') {
      const { decode } = await import('@jsquash/jpeg')
      data = await decode(await file.arrayBuffer())
    } else if (ext === 'png' || type === 'image/png') {
      const { decode } = await import('@jsquash/png')
      data = await decode(await file.arrayBuffer())
    } else if (ext === 'webp' || type === 'image/webp') {
      const { decode } = await import('@jsquash/webp')
      data = await decode(await file.arrayBuffer())
    } else if (ext === 'avif' || type === 'image/avif') {
      const { decode } = await import('@jsquash/avif')
      data = await decode(await file.arrayBuffer())
    }
    if (!data) return null
    return await createImageBitmap(data)
  } catch {
    return null
  }
}

async function decodeViaElement(file: File): Promise<ImageBitmap | null> {
  const url = URL.createObjectURL(file)
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
 * Decode any image the browser (or our wasm codecs) can read.
 * Order: native `createImageBitmap` → wasm codec by extension → `<img>` element.
 */
export async function decodeImage(file: File): Promise<DecodedImage> {
  let bitmap: ImageBitmap | null = null

  if (typeof createImageBitmap === 'function') {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      bitmap = null
    }
  }
  if (!bitmap) bitmap = await decodeViaWasm(file)
  if (!bitmap) bitmap = await decodeViaElement(file)

  if (!bitmap || bitmap.width === 0 || bitmap.height === 0) {
    const ext = fileExtension(file.name).toUpperCase() || 'that'
    throw new Error(
      `Could not read “${file.name}”. Your browser cannot decode ${ext} images` +
        (ext === 'HEIC' || ext === 'HEIF'
          ? '. Convert it to JPG on an Apple device first, then try again.'
          : ', or the file is damaged.'),
    )
  }
  return { bitmap, width: bitmap.width, height: bitmap.height }
}

/* ────────────────────────────── canvas ────────────────────────────── */

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

export function get2d(
  canvas: HTMLCanvasElement,
  options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', options)
  if (!ctx) throw new Error('Your browser blocked 2D canvas access, so images cannot be processed.')
  return ctx
}

/** Encode an ImageData with the wasm codecs (used as a fallback and for exact control). */
export async function encodeImageData(
  data: ImageData,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  const q = Math.round(Math.min(100, Math.max(1, quality * 100)))
  if (format === 'jpeg') {
    const { encode } = await import('@jsquash/jpeg')
    return new Blob([await encode(data, { quality: q })], { type: MIME.jpeg })
  }
  if (format === 'webp') {
    const { encode } = await import('@jsquash/webp')
    return new Blob([await encode(data, { quality: q })], { type: MIME.webp })
  }
  const { encode } = await import('@jsquash/png')
  return new Blob([await encode(data)], { type: MIME.png })
}

/**
 * Encode a canvas. Uses the browser encoder (fast, no wasm download) and falls
 * back to the wasm codec when the browser refuses the requested MIME type.
 */
export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality = 0.9,
): Promise<Blob> {
  const mime = MIME[format]
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, quality)
  })
  if (blob && blob.type === mime && blob.size > 0) return blob

  const ctx = get2d(canvas, { willReadFrequently: true })
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return encodeImageData(data, format, quality)
}

/* ────────────────────────── high-quality resize ────────────────────────── */

/**
 * Resize an ImageData with the Squoosh lanczos3 wasm resizer, falling back to a
 * stepped canvas downscale if the wasm module is unavailable.
 */
export async function resizeImageData(
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
    return canvasResize(source, w, h)
  }
}

/** Stepped bilinear downscale — decent quality without wasm. */
function canvasResize(source: ImageData, width: number, height: number): ImageData {
  let current = createCanvas(source.width, source.height)
  get2d(current).putImageData(source, 0, 0)

  let cw = source.width
  let ch = source.height
  while (cw > width * 2 || ch > height * 2) {
    cw = Math.max(width, Math.floor(cw / 2))
    ch = Math.max(height, Math.floor(ch / 2))
    const next = createCanvas(cw, ch)
    const nctx = get2d(next)
    nctx.imageSmoothingEnabled = true
    nctx.imageSmoothingQuality = 'high'
    nctx.drawImage(current, 0, 0, cw, ch)
    current = next
  }

  const out = createCanvas(width, height)
  const octx = get2d(out, { willReadFrequently: true })
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(current, 0, 0, width, height)
  return octx.getImageData(0, 0, width, height)
}

/** Resize a canvas to exact pixels using lanczos3. */
export async function resizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  if (w === canvas.width && h === canvas.height) return canvas
  const src = get2d(canvas, { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height)
  const out = await resizeImageData(src, w, h)
  const target = createCanvas(out.width, out.height)
  get2d(target).putImageData(out, 0, 0)
  return target
}

/* ────────────────────────── colour adjustments ────────────────────────── */

export interface Adjustments {
  /** 0–100 % of full grayscale */
  grayscale: number
  /** 0–100 % of full sepia */
  sepia: number
  /** 0–100 % inverted */
  invert: number
  /** 100 = unchanged */
  brightness: number
  /** 100 = unchanged */
  contrast: number
  /** 100 = unchanged, 0 = fully desaturated */
  saturate: number
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  grayscale: 0,
  sepia: 0,
  invert: 0,
  brightness: 100,
  contrast: 100,
  saturate: 100,
}

export function isNeutral(a: Adjustments): boolean {
  return (
    a.grayscale === 0 &&
    a.sepia === 0 &&
    a.invert === 0 &&
    a.brightness === 100 &&
    a.contrast === 100 &&
    a.saturate === 100
  )
}

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v)

/**
 * Apply the adjustments in place, in the same order the equivalent CSS filter
 * chain would: brightness → contrast → saturate → grayscale → sepia → invert.
 */
export function applyAdjustments(image: ImageData, a: Adjustments): void {
  const d = image.data
  const bright = a.brightness / 100
  const contrast = a.contrast / 100
  const sat = a.saturate / 100
  const gray = a.grayscale / 100
  const sep = a.sepia / 100
  const inv = a.invert / 100

  // Precompute the brightness+contrast curve into a 256-entry lookup table.
  const lut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) {
    lut[i] = clamp255((i * bright - 127.5) * contrast + 127.5)
  }

  for (let i = 0; i < d.length; i += 4) {
    let r = lut[d[i]] as number
    let g = lut[d[i + 1]] as number
    let b = lut[d[i + 2]] as number

    if (sat !== 1) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      r = lum + (r - lum) * sat
      g = lum + (g - lum) * sat
      b = lum + (b - lum) * sat
    }
    if (gray > 0) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      r += (lum - r) * gray
      g += (lum - g) * gray
      b += (lum - b) * gray
    }
    if (sep > 0) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * b
      const sg = 0.349 * r + 0.686 * g + 0.168 * b
      const sb = 0.272 * r + 0.534 * g + 0.131 * b
      r += (sr - r) * sep
      g += (sg - g) * sep
      b += (sb - b) * sep
    }
    if (inv > 0) {
      r += (255 - r - r) * inv
      g += (255 - g - g) * inv
      b += (255 - b - b) * inv
    }

    d[i] = clamp255(r)
    d[i + 1] = clamp255(g)
    d[i + 2] = clamp255(b)
  }
}

/* ────────────────────────────── output ────────────────────────────── */

export interface ProcessedItem {
  id: string
  name: string
  blob: Blob
  url: string
  width: number
  height: number
  originalSize: number
}

let idCounter = 0
export function nextId(): string {
  idCounter += 1
  return `img-${idCounter}`
}

export function revokeAll(items: ProcessedItem[]): void {
  for (const item of items) URL.revokeObjectURL(item.url)
}

/** Bundle results into a ZIP with de-duplicated entry names. */
export async function zipItems(items: ProcessedItem[]): Promise<Blob> {
  const { zip } = await import('fflate')
  const entries: Record<string, Uint8Array> = {}
  const used = new Set<string>()
  for (const item of items) {
    let name = item.name
    let n = 2
    while (used.has(name)) {
      const dot = item.name.lastIndexOf('.')
      name =
        dot > 0 ? `${item.name.slice(0, dot)}-${n}${item.name.slice(dot)}` : `${item.name}-${n}`
      n += 1
    }
    used.add(name)
    entries[name] = new Uint8Array(await item.blob.arrayBuffer())
  }
  const data = await new Promise<Uint8Array>((resolve, reject) => {
    // level 0: images are already compressed, so store them.
    zip(entries, { level: 0 }, (err, out) => (err ? reject(err) : resolve(out)))
  })
  return new Blob([new Uint8Array(data)], { type: 'application/zip' })
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return fallback
}

/** "1.2 MB → 340 KB (−72%)" style savings. */
export function savingsPercent(before: number, after: number): number {
  if (before <= 0) return 0
  return Math.round(((before - after) / before) * 100)
}
