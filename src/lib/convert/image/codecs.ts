/**
 * Small container writers that need no library: BMP, TIFF (Deflate), ICO (PNG entries) and
 * animated WebP (frames from a still WebP encoder wrapped in ANIM/ANMF chunks).
 * Pure functions on byte arrays, so they run in a worker and in Node tests.
 */
import { zlibSync } from 'fflate'

export interface Pixels {
  width: number
  height: number
  /** RGBA, 8 bits per channel, not premultiplied. */
  data: Uint8ClampedArray | Uint8Array
}

export function hasAlpha(p: Pixels): boolean {
  for (let i = 3; i < p.data.length; i += 4) if (p.data[i] !== 255) return true
  return false
}

/* ------------------------------------------------------------------ *
 * BMP
 * ------------------------------------------------------------------ */

/** 24-bit BMP for opaque images, 32-bit BGRA with a BITMAPV4HEADER when there is alpha. */
export function encodeBmp(p: Pixels): Uint8Array {
  const alpha = hasAlpha(p)
  const bpp = alpha ? 4 : 3
  const rowSize = alpha ? p.width * 4 : Math.ceil((p.width * 3) / 4) * 4
  const headerSize = alpha ? 108 : 40
  const offset = 14 + headerSize
  const size = offset + rowSize * p.height
  const out = new Uint8Array(size)
  const v = new DataView(out.buffer)
  out[0] = 0x42
  out[1] = 0x4d
  v.setUint32(2, size, true)
  v.setUint32(10, offset, true)
  v.setUint32(14, headerSize, true)
  v.setInt32(18, p.width, true)
  v.setInt32(22, p.height, true) // bottom-up rows
  v.setUint16(26, 1, true)
  v.setUint16(28, bpp * 8, true)
  v.setUint32(30, alpha ? 3 : 0, true) // BI_BITFIELDS : BI_RGB
  v.setUint32(34, rowSize * p.height, true)
  v.setInt32(38, 2835, true) // 72 dpi
  v.setInt32(42, 2835, true)
  if (alpha) {
    v.setUint32(54, 0x00ff0000, true) // red mask
    v.setUint32(58, 0x0000ff00, true)
    v.setUint32(62, 0x000000ff, true)
    v.setUint32(66, 0xff000000, true)
    v.setUint32(70, 0x73524742, true) // 'sRGB'
  }
  const d = p.data
  for (let y = 0; y < p.height; y++) {
    let o = offset + (p.height - 1 - y) * rowSize
    let i = y * p.width * 4
    for (let x = 0; x < p.width; x++, i += 4) {
      out[o++] = d[i + 2] ?? 0
      out[o++] = d[i + 1] ?? 0
      out[o++] = d[i] ?? 0
      if (alpha) out[o++] = d[i + 3] ?? 255
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * TIFF
 * ------------------------------------------------------------------ */

const TIFF_SHORT = 3
const TIFF_LONG = 4
const TIFF_RATIONAL = 5

/**
 * A little-endian TIFF with one page per image: RGB or RGBA, 8 bits per channel, one strip,
 * Adobe Deflate compression with the horizontal predictor.
 */
export function encodeTiff(pages: Pixels[], level: 1 | 6 | 9 = 6): Uint8Array {
  const chunks: Uint8Array[] = []
  let pos = 8
  const header = new Uint8Array(8)
  const hv = new DataView(header.buffer)
  header[0] = 0x49
  header[1] = 0x49
  hv.setUint16(2, 42, true)
  chunks.push(header)
  const patches: { at: number; value: number }[] = []
  let firstIfdPointerAt = 4
  let prevNextPointerAt = firstIfdPointerAt

  for (const page of pages) {
    const alpha = hasAlpha(page)
    const spp = alpha ? 4 : 3
    // Horizontal differencing (predictor 2) makes photos compress far better.
    const raw = new Uint8Array(page.width * page.height * spp)
    const d = page.data
    for (let y = 0; y < page.height; y++) {
      const rowIn = y * page.width * 4
      const rowOut = y * page.width * spp
      for (let x = 0; x < page.width; x++) {
        for (let c = 0; c < spp; c++) {
          const cur = d[rowIn + x * 4 + c] ?? 0
          const prev = x > 0 ? (d[rowIn + (x - 1) * 4 + c] ?? 0) : 0
          raw[rowOut + x * spp + c] = (cur - prev) & 0xff
        }
      }
    }
    const strip = zlibSync(raw, { level })
    const stripAt = pos
    chunks.push(strip)
    pos += strip.length
    if (pos % 2) {
      chunks.push(new Uint8Array(1))
      pos += 1
    }

    // Extra data: BitsPerSample array, resolutions.
    const bitsAt = pos
    const bits = new Uint8Array(spp * 2)
    const bv = new DataView(bits.buffer)
    for (let c = 0; c < spp; c++) bv.setUint16(c * 2, 8, true)
    chunks.push(bits)
    pos += bits.length
    const resAt = pos
    const res = new Uint8Array(16)
    const rv = new DataView(res.buffer)
    rv.setUint32(0, 72, true)
    rv.setUint32(4, 1, true)
    rv.setUint32(8, 72, true)
    rv.setUint32(12, 1, true)
    chunks.push(res)
    pos += 16

    const entries: [number, number, number, number][] = [
      [256, TIFF_LONG, 1, page.width],
      [257, TIFF_LONG, 1, page.height],
      [258, TIFF_SHORT, spp, bitsAt],
      [259, TIFF_SHORT, 1, 8], // Adobe Deflate
      [262, TIFF_SHORT, 1, 2], // RGB
      [273, TIFF_LONG, 1, stripAt],
      [277, TIFF_SHORT, 1, spp],
      [278, TIFF_LONG, 1, page.height],
      [279, TIFF_LONG, 1, strip.length],
      [282, TIFF_RATIONAL, 1, resAt],
      [283, TIFF_RATIONAL, 1, resAt + 8],
      [284, TIFF_SHORT, 1, 1], // chunky
      [296, TIFF_SHORT, 1, 2], // inch
      [317, TIFF_SHORT, 1, 2], // horizontal predictor
    ]
    if (alpha) entries.push([338, TIFF_SHORT, 1, 2]) // unassociated alpha
    entries.sort((a, b) => a[0] - b[0])

    const ifdAt = pos
    const ifd = new Uint8Array(2 + entries.length * 12 + 4)
    const iv = new DataView(ifd.buffer)
    iv.setUint16(0, entries.length, true)
    entries.forEach(([tag, type, count, value], i) => {
      const o = 2 + i * 12
      iv.setUint16(o, tag, true)
      iv.setUint16(o + 2, type, true)
      iv.setUint32(o + 4, count, true)
      const inline = type === TIFF_SHORT && count === 1
      if (inline) iv.setUint16(o + 8, value, true)
      else iv.setUint32(o + 8, value, true)
    })
    chunks.push(ifd)
    patches.push({ at: prevNextPointerAt, value: ifdAt })
    prevNextPointerAt = ifdAt + 2 + entries.length * 12
    pos += ifd.length
  }

  const out = new Uint8Array(pos)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  const ov = new DataView(out.buffer)
  for (const p of patches) ov.setUint32(p.at, p.value, true)
  return out
}

/* ------------------------------------------------------------------ *
 * ICO
 * ------------------------------------------------------------------ */

/** An ICO file from PNG-encoded square images (one entry per size). */
export function encodeIco(entries: { size: number; png: Uint8Array }[]): Uint8Array {
  const headerSize = 6 + entries.length * 16
  const total = headerSize + entries.reduce((n, e) => n + e.png.length, 0)
  const out = new Uint8Array(total)
  const v = new DataView(out.buffer)
  v.setUint16(2, 1, true)
  v.setUint16(4, entries.length, true)
  let offset = headerSize
  entries.forEach((e, i) => {
    const o = 6 + i * 16
    out[o] = e.size >= 256 ? 0 : e.size
    out[o + 1] = e.size >= 256 ? 0 : e.size
    v.setUint16(o + 4, 1, true)
    v.setUint16(o + 6, 32, true)
    v.setUint32(o + 8, e.png.length, true)
    v.setUint32(o + 12, offset, true)
    out.set(e.png, offset)
    offset += e.png.length
  })
  return out
}

/* ------------------------------------------------------------------ *
 * Animated WebP
 * ------------------------------------------------------------------ */

function fourcc(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at] ?? 0, bytes[at + 1] ?? 0, bytes[at + 2] ?? 0, bytes[at + 3] ?? 0)
}

/** The image chunks (ALPH, VP8, VP8L) of a still WebP file. */
function imageChunks(webp: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = []
  const v = new DataView(webp.buffer, webp.byteOffset, webp.byteLength)
  let at = 12
  while (at + 8 <= webp.length) {
    const id = fourcc(webp, at)
    const size = v.getUint32(at + 4, true)
    const end = at + 8 + size + (size % 2)
    if (id === 'ALPH' || id === 'VP8 ' || id === 'VP8L') out.push(webp.subarray(at, Math.min(end, webp.length)))
    at = end
  }
  return out
}

function chunk(id: string, body: Uint8Array): Uint8Array {
  const pad = body.length % 2
  const out = new Uint8Array(8 + body.length + pad)
  for (let i = 0; i < 4; i++) out[i] = id.charCodeAt(i)
  new DataView(out.buffer).setUint32(4, body.length, true)
  out.set(body, 8)
  return out
}

const u24 = (out: Uint8Array, at: number, value: number) => {
  out[at] = value & 0xff
  out[at + 1] = (value >> 8) & 0xff
  out[at + 2] = (value >> 16) & 0xff
}

/** Wraps still WebP frames (all the same size) into one looping animated WebP. */
export function muxAnimatedWebp(frames: { webp: Uint8Array; durationMs: number }[], width: number, height: number, alpha: boolean): Uint8Array {
  const vp8x = new Uint8Array(10)
  vp8x[0] = 0x02 | (alpha ? 0x10 : 0) // animation, alpha
  u24(vp8x, 4, width - 1)
  u24(vp8x, 7, height - 1)
  const anim = new Uint8Array(6) // background 0, loop forever
  const parts: Uint8Array[] = [chunk('VP8X', vp8x), chunk('ANIM', anim)]
  for (const f of frames) {
    const data = imageChunks(f.webp)
    const head = new Uint8Array(16)
    u24(head, 6, width - 1)
    u24(head, 9, height - 1)
    u24(head, 12, Math.max(0, Math.min(0xffffff, Math.round(f.durationMs))))
    head[15] = 0x02 // no blending, dispose none
    const len = data.reduce((n, c) => n + c.length, 0)
    const body = new Uint8Array(16 + len)
    body.set(head, 0)
    let o = 16
    for (const c of data) {
      body.set(c, o)
      o += c.length
    }
    parts.push(chunk('ANMF', body))
  }
  const size = 4 + parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(8 + size)
  out.set([0x52, 0x49, 0x46, 0x46], 0)
  new DataView(out.buffer).setUint32(4, size, true)
  out.set([0x57, 0x45, 0x42, 0x50], 8)
  let o = 12
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
