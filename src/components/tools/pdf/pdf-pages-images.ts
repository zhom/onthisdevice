/**
 * Embedded-image extraction for the round-2 `pdf-pages` batch.
 *
 * This walks the PDF object graph with pdf-lib rather than rendering pages, so
 * a photo that was placed into the document at 4000 × 3000 comes back out at
 * 4000 × 3000 — and when it was stored as JPEG, the bytes written to disk are
 * the *original* bytes, not a re-encode. Everything happens in this tab.
 */
import type { PDFDict, PDFDocument, PDFRawStream, PDFRef } from 'pdf-lib'
import type { PdfLib } from './pdf-pages-core'
import { bytesToBlob } from './pdf-pages-core'

export interface ExtractedImage {
  key: string
  index: number
  pages: number[]
  width: number
  height: number
  ext: string
  blob: Blob
  /** True when the bytes are the untouched originals from inside the PDF. */
  original: boolean
  note: string
  filename: string
}

export interface SkippedImage {
  key: string
  pages: number[]
  width: number
  height: number
  reason: string
}

export interface ExtractResult {
  images: ExtractedImage[]
  skipped: SkippedImage[]
}

interface FoundStream {
  key: string
  stream: PDFRawStream
  pages: Set<number>
}

/* ------------------------------------------------------------------ *
 * Object-graph helpers
 * ------------------------------------------------------------------ */

function nameOf(lib: PdfLib, value: unknown): string | null {
  return value instanceof lib.PDFName ? value.asString().replace(/^\//, '') : null
}

function numberOf(lib: PdfLib, dict: PDFDict, key: string): number | null {
  const value = dict.lookup(lib.PDFName.of(key))
  return value instanceof lib.PDFNumber ? value.asNumber() : null
}

function filterList(lib: PdfLib, dict: PDFDict): string[] {
  const value = dict.lookup(lib.PDFName.of('Filter'))
  const single = nameOf(lib, value)
  if (single) return [single]
  if (value instanceof lib.PDFArray) {
    const out: string[] = []
    for (let i = 0; i < value.size(); i++) {
      const n = nameOf(lib, value.lookup(i))
      if (n) out.push(n)
    }
    return out
  }
  return []
}

/** The DecodeParms dictionary that belongs to the final filter, if any. */
function lastDecodeParms(lib: PdfLib, dict: PDFDict, filterCount: number): PDFDict | null {
  const value = dict.lookup(lib.PDFName.of('DecodeParms')) ?? dict.lookup(lib.PDFName.of('DP'))
  if (value instanceof lib.PDFDict) return value
  if (value instanceof lib.PDFArray && filterCount > 0) {
    const entry = value.lookup(Math.min(filterCount - 1, value.size() - 1))
    if (entry instanceof lib.PDFDict) return entry
  }
  return null
}

/** Every image XObject in the document, deduplicated, with the pages using it. */
export function collectImageStreams(lib: PdfLib, doc: PDFDocument): FoundStream[] {
  const { PDFDict, PDFName, PDFRawStream, PDFRef } = lib
  const found = new Map<string, FoundStream>()
  let anonymous = 0

  const walk = (resources: PDFDict | undefined, pageNo: number, depth: number): void => {
    if (!resources || depth > 4) return
    const xobjects = resources.lookupMaybe(PDFName.of('XObject'), PDFDict)
    if (!xobjects) return

    for (const [, raw] of xobjects.entries()) {
      const ref: PDFRef | null = raw instanceof PDFRef ? raw : null
      const obj = ref ? doc.context.lookup(ref) : raw
      if (!(obj instanceof PDFRawStream)) continue

      const subtype = nameOf(lib, obj.dict.lookup(PDFName.of('Subtype')))
      if (subtype === 'Image') {
        const key = ref ? ref.toString() : `inline-${++anonymous}`
        const existing = found.get(key)
        if (existing) existing.pages.add(pageNo)
        else found.set(key, { key, stream: obj, pages: new Set([pageNo]) })
      } else if (subtype === 'Form') {
        walk(obj.dict.lookupMaybe(PDFName.of('Resources'), PDFDict), pageNo, depth + 1)
      }
    }
  }

  doc.getPages().forEach((page, i) => walk(page.node.Resources(), i + 1, 0))
  return [...found.values()]
}

/* ------------------------------------------------------------------ *
 * Predictors
 * ------------------------------------------------------------------ */

/** Undo a PNG (predictor ≥ 10) or TIFF (predictor 2) prediction pass. */
export function unpredict(
  data: Uint8Array,
  predictor: number,
  colors: number,
  bpc: number,
  columns: number,
): Uint8Array {
  if (predictor < 2) return data
  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8))
  const rowLen = Math.ceil((colors * bpc * columns) / 8)

  if (predictor === 2) {
    if (bpc !== 8) return data
    const out = data.slice()
    const rows = Math.floor(out.length / rowLen)
    for (let r = 0; r < rows; r++) {
      const off = r * rowLen
      for (let i = bpp; i < rowLen; i++) out[off + i] = (out[off + i] + out[off + i - bpp]) & 0xff
    }
    return out
  }

  // PNG predictors: each row is prefixed with a filter-type byte.
  const stride = rowLen + 1
  const rows = Math.floor(data.length / stride)
  const out = new Uint8Array(rows * rowLen)
  let prev = new Uint8Array(rowLen)

  for (let r = 0; r < rows; r++) {
    const type = data[r * stride]
    const src = data.subarray(r * stride + 1, r * stride + 1 + rowLen)
    const cur = out.subarray(r * rowLen, (r + 1) * rowLen)
    cur.set(src)

    for (let i = 0; i < rowLen; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      switch (type) {
        case 1:
          cur[i] = (cur[i] + a) & 0xff
          break
        case 2:
          cur[i] = (cur[i] + b) & 0xff
          break
        case 3:
          cur[i] = (cur[i] + ((a + b) >> 1)) & 0xff
          break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          cur[i] = (cur[i] + pred) & 0xff
          break
        }
        default:
          break
      }
    }
    prev = cur
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Colour spaces
 * ------------------------------------------------------------------ */

type SpaceKind = 'gray' | 'rgb' | 'cmyk' | 'indexed'

interface SpaceInfo {
  kind: SpaceKind
  components: number
  /** RGB triplets for indexed spaces. */
  palette: Uint8Array | null
}

function componentsForName(name: string): number | null {
  switch (name) {
    case 'DeviceGray':
    case 'CalGray':
    case 'G':
      return 1
    case 'DeviceRGB':
    case 'CalRGB':
    case 'Lab':
    case 'RGB':
      return 3
    case 'DeviceCMYK':
    case 'CMYK':
      return 4
    default:
      return null
  }
}

function kindForComponents(n: number): SpaceKind {
  if (n === 1) return 'gray'
  if (n === 4) return 'cmyk'
  return 'rgb'
}

function readStreamBytes(lib: PdfLib, stream: PDFRawStream): Uint8Array {
  return lib.decodePDFRawStream(stream).decode()
}

function resolveColorSpace(lib: PdfLib, doc: PDFDocument, value: unknown): SpaceInfo | null {
  const { PDFArray, PDFName, PDFNumber, PDFRawStream, PDFString, PDFHexString } = lib

  const simple = nameOf(lib, value)
  if (simple) {
    const n = componentsForName(simple)
    if (n === null) return null
    return { kind: kindForComponents(n), components: n, palette: null }
  }

  if (!(value instanceof PDFArray) || value.size() === 0) return null
  const family = nameOf(lib, value.lookup(0))

  if (family === 'ICCBased') {
    const stream = value.lookup(1)
    const n = stream instanceof PDFRawStream ? (numberOf(lib, stream.dict, 'N') ?? 3) : 3
    return { kind: kindForComponents(n), components: n, palette: null }
  }

  if (family === 'CalRGB' || family === 'Lab') {
    return { kind: 'rgb', components: 3, palette: null }
  }
  if (family === 'CalGray') {
    return { kind: 'gray', components: 1, palette: null }
  }
  if (family === 'Separation' || family === 'DeviceN') {
    const names = value.lookup(1)
    const count =
      family === 'Separation' ? 1 : names instanceof PDFArray ? names.size() : 1
    return { kind: count === 1 ? 'gray' : 'rgb', components: count, palette: null }
  }

  if (family === 'Indexed' || family === 'I') {
    const base = resolveColorSpace(lib, doc, value.lookup(1))
    if (!base || base.kind === 'indexed') return null
    const hival = value.lookup(2)
    const size = hival instanceof PDFNumber ? Math.max(0, Math.round(hival.asNumber())) + 1 : 256

    const lookup = value.lookup(3)
    let raw: Uint8Array | null = null
    if (lookup instanceof PDFRawStream) {
      raw = readStreamBytes(lib, lookup)
    } else if (lookup instanceof PDFString || lookup instanceof PDFHexString) {
      raw = lookup.asBytes()
    }
    if (!raw) return null

    const palette = new Uint8Array(size * 3)
    for (let i = 0; i < size; i++) {
      const off = i * base.components
      if (base.kind === 'gray') {
        const g = raw[off] ?? 0
        palette[i * 3] = g
        palette[i * 3 + 1] = g
        palette[i * 3 + 2] = g
      } else if (base.kind === 'cmyk') {
        const c = (raw[off] ?? 0) / 255
        const m = (raw[off + 1] ?? 0) / 255
        const y = (raw[off + 2] ?? 0) / 255
        const k = (raw[off + 3] ?? 0) / 255
        palette[i * 3] = Math.round(255 * (1 - Math.min(1, c + k)))
        palette[i * 3 + 1] = Math.round(255 * (1 - Math.min(1, m + k)))
        palette[i * 3 + 2] = Math.round(255 * (1 - Math.min(1, y + k)))
      } else {
        palette[i * 3] = raw[off] ?? 0
        palette[i * 3 + 1] = raw[off + 1] ?? 0
        palette[i * 3 + 2] = raw[off + 2] ?? 0
      }
    }
    return { kind: 'indexed', components: 1, palette }
  }

  return null
}

/* ------------------------------------------------------------------ *
 * Raster decoding
 * ------------------------------------------------------------------ */

export interface Raster {
  width: number
  height: number
  rgba: Uint8ClampedArray
}

/** Read the `i`-th sample of a row packed at `bpc` bits per sample. */
function sampleAt(data: Uint8Array, rowStart: number, index: number, bpc: number): number {
  if (bpc === 8) return data[rowStart + index] ?? 0
  if (bpc === 16) return data[rowStart + index * 2] ?? 0
  const bitPos = index * bpc
  const byte = data[rowStart + (bitPos >> 3)] ?? 0
  const shift = 8 - bpc - (bitPos & 7)
  return (byte >> shift) & ((1 << bpc) - 1)
}

async function decodeThroughBrowser(bytes: Uint8Array, mime: string): Promise<Raster | null> {
  if (typeof createImageBitmap !== 'function') return null
  try {
    const bitmap = await createImageBitmap(bytesToBlob(bytes, mime))
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return { width: canvas.width, height: canvas.height, rgba: data.data }
  } catch {
    return null
  }
}

/** Decode one image XObject to RGBA pixels, or return null when unsupported. */
export async function decodeRaster(
  lib: PdfLib,
  doc: PDFDocument,
  stream: PDFRawStream,
): Promise<Raster | null> {
  const { PDFArray, PDFBool, PDFName, PDFNumber } = lib
  const dict = stream.dict

  const width = numberOf(lib, dict, 'Width') ?? numberOf(lib, dict, 'W') ?? 0
  const height = numberOf(lib, dict, 'Height') ?? numberOf(lib, dict, 'H') ?? 0
  if (width < 1 || height < 1) return null

  const filters = filterList(lib, dict)
  const last = filters[filters.length - 1] ?? ''

  if (last === 'DCTDecode' && filters.length === 1) {
    return decodeThroughBrowser(stream.getContents(), 'image/jpeg')
  }
  if (last === 'JPXDecode' && filters.length === 1) {
    return decodeThroughBrowser(stream.getContents(), 'image/jp2')
  }
  if (last === 'JBIG2Decode' || last === 'CCITTFaxDecode') return null

  let data: Uint8Array
  try {
    data = readStreamBytes(lib, stream)
  } catch {
    return null
  }

  const maskFlag = dict.lookup(PDFName.of('ImageMask')) ?? dict.lookup(PDFName.of('IM'))
  const isMask = maskFlag instanceof PDFBool ? maskFlag.asBoolean() : false
  const bpc = isMask ? 1 : (numberOf(lib, dict, 'BitsPerComponent') ?? numberOf(lib, dict, 'BPC') ?? 8)

  const space: SpaceInfo = isMask
    ? { kind: 'gray', components: 1, palette: null }
    : (resolveColorSpace(
        lib,
        doc,
        dict.lookup(PDFName.of('ColorSpace')) ?? dict.lookup(PDFName.of('CS')),
      ) ?? { kind: 'gray', components: 1, palette: null })

  const parms = lastDecodeParms(lib, dict, filters.length)
  if (parms) {
    const predictor = numberOf(lib, parms, 'Predictor') ?? 1
    if (predictor > 1) {
      data = unpredict(
        data,
        predictor,
        numberOf(lib, parms, 'Colors') ?? space.components,
        numberOf(lib, parms, 'BitsPerComponent') ?? bpc,
        numberOf(lib, parms, 'Columns') ?? width,
      )
    }
  }

  const decodeArr = dict.lookup(PDFName.of('Decode')) ?? dict.lookup(PDFName.of('D'))
  let inverted = false
  if (decodeArr instanceof PDFArray && decodeArr.size() >= 2) {
    const first = decodeArr.lookup(0)
    if (first instanceof PDFNumber && first.asNumber() === 1) inverted = true
  }

  const maxValue = (1 << Math.min(bpc, 8)) - 1
  const rowBytes = Math.ceil((width * space.components * bpc) / 8)
  const needed = rowBytes * height
  if (data.length < needed) {
    const padded = new Uint8Array(needed)
    padded.set(data.subarray(0, Math.min(data.length, needed)))
    data = padded
  }

  const rgba = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      if (space.kind === 'indexed' && space.palette) {
        let idx = sampleAt(data, rowStart, x, bpc)
        if (inverted) idx = maxValue - idx
        const p = Math.min(idx, space.palette.length / 3 - 1) * 3
        rgba[o] = space.palette[p]
        rgba[o + 1] = space.palette[p + 1]
        rgba[o + 2] = space.palette[p + 2]
        rgba[o + 3] = 255
      } else if (space.kind === 'gray') {
        let v = sampleAt(data, rowStart, x, bpc)
        if (inverted) v = maxValue - v
        const g = bpc === 16 ? v : Math.round((v / maxValue) * 255)
        if (isMask) {
          // A stencil mask paints where the sample is 0.
          rgba[o] = 0
          rgba[o + 1] = 0
          rgba[o + 2] = 0
          rgba[o + 3] = g === 0 ? 255 : 0
        } else {
          rgba[o] = g
          rgba[o + 1] = g
          rgba[o + 2] = g
          rgba[o + 3] = 255
        }
      } else if (space.kind === 'cmyk') {
        const base = x * 4
        const c = sampleAt(data, rowStart, base, bpc) / maxValue
        const m = sampleAt(data, rowStart, base + 1, bpc) / maxValue
        const yy = sampleAt(data, rowStart, base + 2, bpc) / maxValue
        const k = sampleAt(data, rowStart, base + 3, bpc) / maxValue
        rgba[o] = Math.round(255 * (1 - Math.min(1, c + k)))
        rgba[o + 1] = Math.round(255 * (1 - Math.min(1, m + k)))
        rgba[o + 2] = Math.round(255 * (1 - Math.min(1, yy + k)))
        rgba[o + 3] = 255
      } else {
        const base = x * space.components
        const scale = 255 / maxValue
        rgba[o] = Math.round(sampleAt(data, rowStart, base, bpc) * scale)
        rgba[o + 1] = Math.round(sampleAt(data, rowStart, base + 1, bpc) * scale)
        rgba[o + 2] = Math.round(sampleAt(data, rowStart, base + 2, bpc) * scale)
        rgba[o + 3] = 255
      }
    }
  }

  // Soft mask (alpha channel stored as a separate grayscale image).
  const smask = dict.lookup(PDFName.of('SMask'))
  if (smask instanceof lib.PDFRawStream) {
    const alpha = await decodeRaster(lib, doc, smask)
    if (alpha) {
      for (let y = 0; y < height; y++) {
        const ay = Math.min(alpha.height - 1, Math.floor((y * alpha.height) / height))
        for (let x = 0; x < width; x++) {
          const ax = Math.min(alpha.width - 1, Math.floor((x * alpha.width) / width))
          rgba[(y * width + x) * 4 + 3] = alpha.rgba[(ay * alpha.width + ax) * 4]
        }
      }
    }
  }

  return { width, height, rgba }
}

function rasterToPngBlob(raster: Raster): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = raster.width
  canvas.height = raster.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  // Copy into a freshly allocated buffer so the type is a plain ArrayBuffer.
  const pixels = new Uint8ClampedArray(raster.rgba)
  ctx.putImageData(new ImageData(pixels, raster.width, raster.height), 0, 0)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

export interface ExtractOptions {
  /** Skip anything narrower or shorter than this, in pixels. */
  minSide: number
  onProgress?: (done: number, total: number) => void
  shouldYield?: () => Promise<void>
}

export async function extractImages(
  lib: PdfLib,
  doc: PDFDocument,
  options: ExtractOptions,
): Promise<ExtractResult> {
  const streams = collectImageStreams(lib, doc)
  const images: ExtractedImage[] = []
  const skipped: SkippedImage[] = []

  for (let i = 0; i < streams.length; i++) {
    const { key, stream, pages } = streams[i]
    const pageList = [...pages].sort((a, b) => a - b)
    const dict = stream.dict
    const width = numberOf(lib, dict, 'Width') ?? numberOf(lib, dict, 'W') ?? 0
    const height = numberOf(lib, dict, 'Height') ?? numberOf(lib, dict, 'H') ?? 0

    const finish = () => {
      options.onProgress?.(i + 1, streams.length)
    }

    if (width < options.minSide || height < options.minSide) {
      skipped.push({
        key,
        pages: pageList,
        width,
        height,
        reason: `smaller than the ${options.minSide} px filter (usually a spacer or a rule)`,
      })
      finish()
      continue
    }

    const filters = filterList(lib, dict)
    const last = filters[filters.length - 1] ?? ''
    const index = images.length + 1
    const pageLabel = pageList.length === 1 ? `p${pageList[0]}` : `p${pageList[0]}+`

    try {
      if (last === 'DCTDecode' && filters.length === 1) {
        const raw = stream.getContents()
        images.push({
          key,
          index,
          pages: pageList,
          width,
          height,
          ext: 'jpg',
          blob: bytesToBlob(raw, 'image/jpeg'),
          original: true,
          note: 'Original JPEG, byte-for-byte',
          filename: `image-${String(index).padStart(3, '0')}-${pageLabel}-${width}x${height}.jpg`,
        })
      } else if (last === 'JPXDecode' && filters.length === 1) {
        const raw = stream.getContents()
        images.push({
          key,
          index,
          pages: pageList,
          width,
          height,
          ext: 'jp2',
          blob: bytesToBlob(raw, 'image/jp2'),
          original: true,
          note: 'Original JPEG 2000. Some viewers cannot open .jp2',
          filename: `image-${String(index).padStart(3, '0')}-${pageLabel}-${width}x${height}.jp2`,
        })
      } else if (last === 'JBIG2Decode' || last === 'CCITTFaxDecode') {
        skipped.push({
          key,
          pages: pageList,
          width,
          height,
          reason: `stored with ${last}, a fax/scanner codec no browser can decode`,
        })
      } else {
        const raster = await decodeRaster(lib, doc, stream)
        if (!raster) {
          skipped.push({
            key,
            pages: pageList,
            width,
            height,
            reason: filters.length > 1 ? `filter chain ${filters.join(' + ')} is not supported` : 'the pixel data could not be decoded',
          })
        } else {
          const blob = await rasterToPngBlob(raster)
          if (!blob) {
            skipped.push({
              key,
              pages: pageList,
              width,
              height,
              reason: 'the browser refused to encode a PNG this large',
            })
          } else {
            images.push({
              key,
              index,
              pages: pageList,
              width,
              height,
              ext: 'png',
              blob,
              original: false,
              note: `Rebuilt losslessly as PNG from ${last || 'raw'} data`,
              filename: `image-${String(index).padStart(3, '0')}-${pageLabel}-${width}x${height}.png`,
            })
          }
        }
      }
    } catch (err) {
      skipped.push({
        key,
        pages: pageList,
        width,
        height,
        reason: err instanceof Error ? err.message : 'unreadable',
      })
    }

    finish()
    if (options.shouldYield) await options.shouldYield()
  }

  return { images, skipped }
}
