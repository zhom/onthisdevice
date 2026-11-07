/**
 * Image pair conversion: decode any supported input into pages or animation frames, then
 * encode them to the target format. Runs in a worker (worker.ts) and, as a fallback, on the
 * main thread. SVG input is rasterised on the main thread first and arrives as pixels.
 *
 * Decoders: the browser (JPEG, PNG, WebP, AVIF, GIF, BMP, ICO), the jSquash codecs as a
 * fallback, libheif (HEIC, HEIF; LGPL, loaded as its own file), UTIF (TIFF) and the
 * WebCodecs ImageDecoder for animated GIF and WebP.
 */
import heifUrl from 'libheif-js/libheif-wasm/libheif-bundle.mjs?url'
import { decodeBytes, encodePixels, flattenOnto, hasTransparency, ImageError, sniffBytes } from '@/components/tools/image-convert/_engine'
import type { OutFormat } from '@/lib/convert/image/formats'
import { encodeBmp, encodeIco, encodeTiff, muxAnimatedWebp } from '@/lib/convert/image/codecs'

export interface ImageOptions {
  target: OutFormat
  /** 1 to 100, for JPG, WebP and AVIF. */
  quality: number
  /** Lossless WebP. */
  lossless: boolean
  /** Fill transparent pixels with this colour; null keeps them where the target allows. */
  background: string | null
  /** GIF palette size, 2 to 256. */
  gifColors: number
  /** ICO sizes in pixels. */
  icoSizes: number[]
  /** SVG tracing. */
  traceColors: number
  traceDetail: 'low' | 'medium' | 'high'
  /** Keep GIF and WebP animation when the target can hold it. */
  keepAnimation: boolean
  /** JPEG in, JPG out: copy the bytes and only change the name. */
  passThroughJpeg: boolean
  pdfPage: 'image' | 'a4' | 'letter'
}

export type ImageSource =
  | { kind: 'bytes'; bytes: ArrayBuffer; mime: string }
  | { kind: 'pixels'; data: Uint8ClampedArray; width: number; height: number }

export interface ImageOutput {
  bytes: ArrayBuffer
  mime: string
  ext: string
  width: number
  height: number
  /** "page 2" for multi-page inputs. */
  part?: number
}

export interface ImageResult {
  outputs: ImageOutput[]
  /** Frames in the input, for messages such as "first of 24 frames". */
  frames: number
  animated: boolean
  note?: string
}

interface Frame {
  image: ImageData
  durationMs: number
}

const MIME: Record<OutFormat, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
}

/* ------------------------------------------------------------------ *
 * Decoding
 * ------------------------------------------------------------------ */

interface HeifImage {
  get_width(): number
  get_height(): number
  display(target: { data: Uint8ClampedArray; width: number; height: number }, done: (out: { data: Uint8ClampedArray } | null) => void): void
  free?: () => void
}
interface HeifModule {
  HeifDecoder: new () => { decode(bytes: Uint8Array): HeifImage[] }
}

let heif: Promise<HeifModule> | null = null
function loadHeif(): Promise<HeifModule> {
  heif ??= import(/* @vite-ignore */ heifUrl).then((m: { default: () => HeifModule }) => m.default())
  return heif
}

function newImageData(width: number, height: number, data?: Uint8ClampedArray | Uint8Array): ImageData {
  const out = new ImageData(width, height)
  if (data) out.data.set(data.subarray(0, width * height * 4))
  return out
}

async function decodeHeif(bytes: ArrayBuffer): Promise<Frame[]> {
  const lib = await loadHeif()
  const images = new lib.HeifDecoder().decode(new Uint8Array(bytes))
  if (!images.length) throw new ImageError('That HEIC file has no image the decoder can read. It may be damaged.')
  const frames: Frame[] = []
  for (const img of images) {
    const width = img.get_width()
    const height = img.get_height()
    const target = { data: new Uint8ClampedArray(width * height * 4), width, height }
    const out = await new Promise<{ data: Uint8ClampedArray } | null>((resolve) => img.display(target, resolve))
    img.free?.()
    if (!out) throw new ImageError('The HEIC decoder could not read this image. It may use a variant this decoder does not support.')
    frames.push({ image: newImageData(width, height, out.data), durationMs: 0 })
  }
  return frames
}

async function decodeTiff(bytes: ArrayBuffer): Promise<Frame[]> {
  const UTIF = (await import('utif2')).default
  const ifds = UTIF.decode(bytes)
  const frames: Frame[] = []
  for (const ifd of ifds) {
    if (!ifd['t256'] || !ifd['t257']) continue
    UTIF.decodeImage(bytes, ifd)
    if (!ifd.width || !ifd.height) continue
    const rgba = UTIF.toRGBA8(ifd)
    frames.push({ image: newImageData(ifd.width, ifd.height, rgba), durationMs: 0 })
  }
  if (!frames.length) throw new ImageError('That TIFF has no page this decoder can read. It may use an unusual compression.')
  return frames
}

/** All frames of an animated GIF or WebP, where the browser has ImageDecoder. */
async function decodeAnimation(bytes: ArrayBuffer, mime: string): Promise<Frame[] | null> {
  if (typeof ImageDecoder === 'undefined') return null
  try {
    if (!(await ImageDecoder.isTypeSupported(mime))) return null
    const decoder = new ImageDecoder({ data: bytes, type: mime })
    await decoder.tracks.ready
    const count = Math.min(decoder.tracks.selectedTrack?.frameCount ?? 1, 2000)
    if (count < 2) {
      decoder.close()
      return null
    }
    const frames: Frame[] = []
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i })
      const w = image.displayWidth
      const h = image.displayHeight
      const canvas = new OffscreenCanvas(w, h)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new ImageError('This browser could not create a canvas to read the frames.')
      ctx.drawImage(image, 0, 0)
      frames.push({ image: ctx.getImageData(0, 0, w, h), durationMs: (image.duration ?? 100_000) / 1000 })
      image.close()
    }
    decoder.close()
    return frames
  } catch {
    return null
  }
}

async function decode(source: ImageSource, opts: ImageOptions): Promise<{ frames: Frame[]; animated: boolean; pages: boolean }> {
  if (source.kind === 'pixels') {
    return { frames: [{ image: newImageData(source.width, source.height, source.data), durationMs: 0 }], animated: false, pages: false }
  }
  const sniffed = sniffBytes(source.bytes)
  const head = new Uint8Array(source.bytes, 4, Math.min(4, Math.max(0, source.bytes.byteLength - 4)))
  const isoBox = String.fromCharCode(...head) === 'ftyp'
  if (sniffed === 'heic' || (sniffed === 'unknown' && isoBox)) return { frames: await decodeHeif(source.bytes), animated: false, pages: true }
  if (sniffed === 'tiff') return { frames: await decodeTiff(source.bytes), animated: false, pages: true }
  if ((sniffed === 'gif' || sniffed === 'webp') && opts.keepAnimation && (opts.target === 'gif' || opts.target === 'webp')) {
    const frames = await decodeAnimation(source.bytes, sniffed === 'gif' ? 'image/gif' : 'image/webp')
    if (frames) return { frames, animated: true, pages: false }
  }
  const image = await decodeBytes(source.bytes, source.mime)
  return { frames: [{ image, durationMs: 0 }], animated: false, pages: false }
}

/* ------------------------------------------------------------------ *
 * Encoding
 * ------------------------------------------------------------------ */

function flattened(image: ImageData, colour: string): ImageData {
  const copy = newImageData(image.width, image.height, image.data)
  return flattenOnto(copy, colour)
}

/** For targets without alpha, or when the user asked for a background. */
function prepare(image: ImageData, opts: ImageOptions, alphaTarget: boolean): ImageData {
  if (opts.background) return flattened(image, opts.background)
  if (!alphaTarget && hasTransparency(image)) return flattened(image, '#ffffff')
  return image
}

const toBuffer = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer

async function encodeGif(frames: Frame[], opts: ImageOptions): Promise<Uint8Array> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
  const gif = GIFEncoder()
  const colors = Math.max(2, Math.min(256, Math.round(opts.gifColors)))
  for (const f of frames) {
    const image = opts.background ? flattened(f.image, opts.background) : f.image
    const alpha = hasTransparency(image)
    const format = alpha ? 'rgba4444' : 'rgb565'
    const palette = quantize(image.data, colors, { format, oneBitAlpha: alpha })
    const index = applyPalette(image.data, palette, format)
    const transparentIndex = alpha ? palette.findIndex((c) => c[3] === 0) : -1
    gif.writeFrame(index, image.width, image.height, {
      palette,
      delay: Math.round(f.durationMs || 100),
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
      repeat: 0,
      dispose: frames.length > 1 ? 2 : -1,
    })
  }
  gif.finish()
  return gif.bytes()
}

async function encodeIcoFrom(image: ImageData, sizes: number[]): Promise<Uint8Array> {
  const side = Math.min(image.width, image.height)
  const sx = Math.floor((image.width - side) / 2)
  const sy = Math.floor((image.height - side) / 2)
  const entries: { size: number; png: Uint8Array }[] = []
  for (const size of [...new Set(sizes)].sort((a, b) => a - b)) {
    const bitmap = await createImageBitmap(image, sx, sy, side, side, { resizeWidth: size, resizeHeight: size, resizeQuality: 'high' })
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageError('This browser could not create a canvas for the icon sizes.')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const png = await encodePixels(ctx.getImageData(0, 0, size, size), { format: 'png', quality: 100, lossless: true, speed: 6, background: null })
    entries.push({ size, png: new Uint8Array(png) })
  }
  return encodeIco(entries)
}

const TRACE: Record<ImageOptions['traceDetail'], { ltres: number; qtres: number; pathomit: number; blurradius: number; max: number }> = {
  low: { ltres: 2, qtres: 2, pathomit: 16, blurradius: 2, max: 600 },
  medium: { ltres: 1, qtres: 1, pathomit: 8, blurradius: 0, max: 1000 },
  high: { ltres: 0.5, qtres: 0.5, pathomit: 4, blurradius: 0, max: 1600 },
}

async function traceSvg(image: ImageData, opts: ImageOptions): Promise<string> {
  const { default: ImageTracer } = await import('imagetracerjs')
  const preset = TRACE[opts.traceDetail]
  // Tracing time grows with the pixel count, so large images are traced at a smaller size
  // and scaled back up in the SVG.
  const scale = Math.min(1, preset.max / Math.max(image.width, image.height))
  let input = image
  if (scale < 1) {
    const w = Math.max(1, Math.round(image.width * scale))
    const h = Math.max(1, Math.round(image.height * scale))
    const bitmap = await createImageBitmap(image, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageError('This browser could not create a canvas for tracing.')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    input = ctx.getImageData(0, 0, w, h)
  }
  const svg = ImageTracer.imagedataToSVG(input, {
    numberofcolors: Math.max(2, Math.min(64, Math.round(opts.traceColors))),
    colorsampling: 2,
    colorquantcycles: 3,
    ltres: preset.ltres,
    qtres: preset.qtres,
    pathomit: preset.pathomit,
    blurradius: preset.blurradius,
    strokewidth: 0,
    linefilter: true,
    roundcoords: 1,
    viewbox: true,
    desc: false,
    scale: 1,
  })
  // Size the drawing to the original pixel dimensions; the viewBox keeps the shapes.
  return svg.replace(/<svg ([^>]*?)width="[^"]*" height="[^"]*"/, `<svg $1width="${image.width}" height="${image.height}"`)
}

async function encodePdf(frames: Frame[], opts: ImageOptions): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  for (const f of frames) {
    const alpha = hasTransparency(f.image)
    const bytes = alpha
      ? await encodePixels(f.image, { format: 'png', quality: 100, lossless: true, speed: 6, background: null })
      : await encodePixels(f.image, { format: 'jpeg', quality: opts.quality, lossless: false, speed: 6, background: null })
    const embedded = alpha ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
    // 96 pixels per inch is how screens show images at 100%.
    const iw = (f.image.width * 72) / 96
    const ih = (f.image.height * 72) / 96
    if (opts.pdfPage === 'image') {
      doc.addPage([iw, ih]).drawImage(embedded, { x: 0, y: 0, width: iw, height: ih })
      continue
    }
    const [pw, ph] = opts.pdfPage === 'a4' ? [595.28, 841.89] : [612, 792]
    const landscape = iw > ih
    const W = landscape ? ph : pw
    const H = landscape ? pw : ph
    const margin = 28.35 // 1 cm
    const s = Math.min((W - 2 * margin) / iw, (H - 2 * margin) / ih)
    const w = iw * s
    const h = ih * s
    doc.addPage([W, H]).drawImage(embedded, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h })
  }
  return doc.save()
}

/* ------------------------------------------------------------------ *
 * Job
 * ------------------------------------------------------------------ */

export async function runImageJob(source: ImageSource, opts: ImageOptions): Promise<ImageResult> {
  if (opts.passThroughJpeg && opts.target === 'jpg' && source.kind === 'bytes' && sniffBytes(source.bytes) === 'jpeg') {
    return { outputs: [{ bytes: source.bytes, mime: 'image/jpeg', ext: 'jpg', width: 0, height: 0 }], frames: 1, animated: false, note: 'Renamed without re-encoding.' }
  }

  const { frames, animated, pages } = await decode(source, opts)
  const first = frames[0]
  if (!first) throw new ImageError('That file contains no image.')
  const t = opts.target
  const out = (bytes: Uint8Array | ArrayBuffer, w: number, h: number, part?: number): ImageOutput => ({
    bytes: bytes instanceof Uint8Array ? toBuffer(bytes) : bytes,
    mime: MIME[t],
    ext: t,
    width: w,
    height: h,
    part,
  })

  if (t === 'tiff') {
    const enc = encodeTiff(frames.map((f) => prepare(f.image, opts, true)))
    return { outputs: [out(enc, first.image.width, first.image.height)], frames: frames.length, animated }
  }
  if (t === 'pdf') {
    return { outputs: [out(await encodePdf(frames, opts), first.image.width, first.image.height)], frames: frames.length, animated }
  }
  if (t === 'gif' && animated) {
    return { outputs: [out(await encodeGif(frames, opts), first.image.width, first.image.height)], frames: frames.length, animated }
  }
  if (t === 'webp' && animated) {
    const stills: { webp: Uint8Array; durationMs: number }[] = []
    const alpha = frames.some((f) => hasTransparency(f.image))
    for (const f of frames) {
      const image = prepare(f.image, opts, true)
      const webp = await encodePixels(image, { format: 'webp', quality: opts.quality, lossless: opts.lossless, speed: 6, background: null })
      stills.push({ webp: new Uint8Array(webp), durationMs: f.durationMs || 100 })
    }
    return { outputs: [out(muxAnimatedWebp(stills, first.image.width, first.image.height, alpha && !opts.background), first.image.width, first.image.height)], frames: frames.length, animated }
  }

  // One output per page. Animations not kept: the first frame only.
  const list = pages ? frames : [first]
  const outputs: ImageOutput[] = []
  for (let i = 0; i < list.length; i++) {
    const f = list[i]
    if (!f) continue
    const part = list.length > 1 ? i + 1 : undefined
    const { width, height } = f.image
    switch (t) {
      case 'jpg':
      case 'png':
      case 'webp':
      case 'avif': {
        const format = t === 'jpg' ? 'jpeg' : t
        const image = prepare(f.image, opts, t !== 'jpg')
        const bytes = await encodePixels(image, { format, quality: opts.quality, lossless: t === 'webp' && opts.lossless, speed: 6, background: null })
        outputs.push(out(bytes, width, height, part))
        break
      }
      case 'gif':
        outputs.push(out(await encodeGif([f], opts), width, height, part))
        break
      case 'bmp':
        outputs.push(out(encodeBmp(prepare(f.image, opts, true)), width, height, part))
        break
      case 'ico':
        outputs.push(out(await encodeIcoFrom(prepare(f.image, opts, true), opts.icoSizes.filter((s) => s <= 256)), Math.min(256, Math.max(...opts.icoSizes)), Math.min(256, Math.max(...opts.icoSizes)), part))
        break
      case 'svg': {
        const svg = await traceSvg(prepare(f.image, opts, true), opts)
        outputs.push(out(new TextEncoder().encode(svg), width, height, part))
        break
      }
    }
  }
  const note = !animated && frames.length > 1 && !pages ? `The file has ${frames.length} frames; the first one was converted.` : undefined
  return { outputs, frames: frames.length, animated, note }
}

export function describeImageError(err: unknown): string {
  if (err instanceof ImageError) return err.message
  if (err instanceof RangeError || (err instanceof Error && /allocat|out of memory|memory access/i.test(err.message))) {
    return 'The browser ran out of memory on that image. Try fewer files at once or a smaller image.'
  }
  if (err instanceof Error && err.message) return `Conversion failed: ${err.message}`
  return 'Conversion failed. Reload the page and try one file at a time.'
}
