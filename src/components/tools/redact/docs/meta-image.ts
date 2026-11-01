/**
 * Lossless metadata removal for JPEG, PNG and WebP: the container is rewritten
 * without its metadata blocks and the image data is copied byte for byte.
 */

export interface StripOptions {
  /** Keep the color profile, so colors look the same. */
  keepIcc: boolean
  /** Keep the rotation flag in a minimal EXIF block, so the photo stays upright. */
  keepOrientation: boolean
}

export interface StripResult {
  bytes: Uint8Array
  /** Names of the blocks that were removed. */
  removed: string[]
}

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n))

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** Orientation (1..8) from a TIFF block, or 1. */
export function tiffOrientation(t: Uint8Array): number {
  if (t.length < 8) return 1
  const le = t[0] === 0x49
  const v = new DataView(t.buffer, t.byteOffset, t.byteLength)
  const u16 = (o: number) => v.getUint16(o, le)
  const u32 = (o: number) => v.getUint32(o, le)
  const ifd = u32(4)
  if (ifd + 2 > t.length) return 1
  const n = u16(ifd)
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12
    if (e + 12 > t.length) break
    if (u16(e) === 0x0112) {
      const o = u16(e + 8)
      return o >= 1 && o <= 8 ? o : 1
    }
  }
  return 1
}

/** A TIFF block with one tag: Orientation. */
export function minimalTiff(orientation: number): Uint8Array {
  // MM, 42, IFD at 8; one entry 0x0112 SHORT 1 value; next IFD 0.
  return new Uint8Array([0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0])
}

const EXIF_HEADER = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0]) // "Exif\0\0"

/* ------------------------------------------------------------------ */
/* JPEG                                                                */
/* ------------------------------------------------------------------ */

export function stripJpeg(b: Uint8Array, opts: StripOptions): StripResult {
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error('This is not a JPEG file.')
  const keep: Uint8Array[] = [b.subarray(0, 2)]
  const removed = new Set<string>()
  let orientation = 1
  let i = 2
  let inserted = false
  const insertOrientation = () => {
    if (inserted || !opts.keepOrientation || orientation === 1) return
    const payload = concat([EXIF_HEADER, minimalTiff(orientation)])
    const seg = new Uint8Array(4 + payload.length)
    seg.set([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff])
    seg.set(payload, 4)
    keep.push(seg)
    inserted = true
  }
  while (i < b.length) {
    if (b[i] !== 0xff) throw new Error('This JPEG file is damaged.')
    while (b[i + 1] === 0xff) i++ // fill bytes
    const marker = b[i + 1]
    if (marker === 0xd9) {
      keep.push(b.subarray(i, i + 2))
      break
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      keep.push(b.subarray(i, i + 2))
      i += 2
      continue
    }
    const len = (b[i + 2] << 8) | b[i + 3]
    const seg = b.subarray(i, i + 2 + len)
    const body = b.subarray(i + 4, i + 2 + len)
    if (marker === 0xda) {
      insertOrientation()
      // Scan data runs to the end of the image; anything after it (extra images, trailers) goes.
      let end = b.length
      for (let k = i + 2 + len; k < b.length - 1; k++) {
        if (b[k] === 0xff && b[k + 1] === 0xd9) {
          end = k + 2
          break
        }
      }
      keep.push(b.subarray(i, end))
      if (end < b.length - 2) removed.add('Data after the image (extra images or a maker trailer)')
      break
    }
    let drop: string | null = null
    if (marker === 0xe1) {
      if (ascii(body, 0, 6) === 'Exif\0\0') {
        orientation = tiffOrientation(body.subarray(6))
        drop = 'EXIF (camera, date, GPS, thumbnail)'
      } else if (ascii(body, 0, 28) === 'http://ns.adobe.com/xap/1.0/' || ascii(body, 0, 34) === 'http://ns.adobe.com/xmp/extension/') {
        drop = 'XMP'
      } else drop = 'APP1 block'
    } else if (marker === 0xe2) {
      if (ascii(body, 0, 12) === 'ICC_PROFILE\0') drop = opts.keepIcc ? null : 'Color profile (ICC)'
      else if (ascii(body, 0, 4) === 'MPF\0') drop = 'Multi-picture index'
      else drop = 'APP2 block'
    } else if (marker === 0xed) drop = 'IPTC and Photoshop data'
    else if (marker === 0xe0) drop = ascii(body, 0, 5) === 'JFIF\0' ? null : 'Embedded thumbnail (JFXX)'
    else if (marker === 0xee) drop = null // Adobe color transform, needed to decode
    else if (marker >= 0xe3 && marker <= 0xef) drop = `APP${marker - 0xe0} block`
    else if (marker === 0xfe) drop = 'Comment'
    if (drop) removed.add(drop)
    else {
      // The minimal EXIF goes after JFIF/Adobe blocks and before the first table.
      if (marker !== 0xe0 && marker !== 0xee && marker !== 0xe2) insertOrientation()
      keep.push(seg)
    }
    i += 2 + len
  }
  if (opts.keepOrientation && orientation !== 1) removed.add('(rotation kept)')
  return { bytes: concat(keep), removed: [...removed] }
}

/* ------------------------------------------------------------------ */
/* PNG                                                                 */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(parts: Uint8Array[]): number {
  let c = 0xffffffff
  for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC_TABLE[(c ^ p[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const v = new DataView(out.buffer)
  v.setUint32(0, data.length)
  const t = new Uint8Array([...type].map((c) => c.charCodeAt(0)))
  out.set(t, 4)
  out.set(data, 8)
  v.setUint32(8 + data.length, crc32([t, data]))
  return out
}

/** Chunks that hold no personal data and change how the image looks or animates. */
const PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'sBIT', 'bKGD', 'pHYs', 'acTL', 'fcTL', 'fdAT', 'cICP', 'mDCV', 'cLLI', 'mDCv', 'cLLi'])
const PNG_NAMES: Record<string, string> = {
  tEXt: 'Text fields',
  zTXt: 'Text fields',
  iTXt: 'Text fields or XMP',
  eXIf: 'EXIF',
  tIME: 'Last modified time',
  iCCP: 'Color profile (ICC)',
}

export function stripPng(b: Uint8Array, opts: StripOptions): StripResult {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (!sig.every((x, i) => b[i] === x)) throw new Error('This is not a PNG file.')
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const keep: Uint8Array[] = [b.subarray(0, 8)]
  const removed = new Set<string>()
  let i = 8
  let orientation = 1
  const kept: Uint8Array[] = []
  while (i + 8 <= b.length) {
    const len = v.getUint32(i)
    const type = ascii(b, i + 4, 4)
    const chunk = b.subarray(i, i + 12 + len)
    if (type === 'eXIf') orientation = tiffOrientation(b.subarray(i + 8, i + 8 + len))
    if (PNG_KEEP.has(type) || (type === 'iCCP' && opts.keepIcc)) kept.push(chunk)
    else removed.add(PNG_NAMES[type] ?? `${type} block`)
    i += 12 + len
    if (type === 'IEND') break
  }
  // The minimal eXIf goes before the first IDAT.
  for (const c of kept) {
    if (ascii(c, 4, 4) === 'IDAT' && opts.keepOrientation && orientation !== 1) {
      keep.push(pngChunk('eXIf', minimalTiff(orientation)))
      removed.add('(rotation kept)')
      orientation = 1
    }
    keep.push(c)
  }
  return { bytes: concat(keep), removed: [...removed] }
}

/* ------------------------------------------------------------------ */
/* WebP                                                                */
/* ------------------------------------------------------------------ */

function riffChunk(type: string, data: Uint8Array): Uint8Array {
  const pad = data.length & 1
  const out = new Uint8Array(8 + data.length + pad)
  out.set([...type].map((c) => c.charCodeAt(0)), 0)
  new DataView(out.buffer).setUint32(4, data.length, true)
  out.set(data, 8)
  return out
}

export function stripWebp(b: Uint8Array, opts: StripOptions): StripResult {
  if (ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') throw new Error('This is not a WebP file.')
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const chunks: { type: string; data: Uint8Array }[] = []
  const removed = new Set<string>()
  let orientation = 1
  let i = 12
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4)
    const len = v.getUint32(i + 4, true)
    const data = b.subarray(i + 8, i + 8 + len)
    if (type === 'EXIF') {
      const tiff = ascii(data, 0, 6) === 'Exif\0\0' ? data.subarray(6) : data
      orientation = tiffOrientation(tiff)
      removed.add('EXIF (camera, date, GPS)')
    } else if (type === 'XMP ') removed.add('XMP')
    else if (type === 'ICCP' && !opts.keepIcc) removed.add('Color profile (ICC)')
    else chunks.push({ type, data })
    i += 8 + len + (len & 1)
  }
  const exif = opts.keepOrientation && orientation !== 1 ? minimalTiff(orientation) : null
  if (exif) removed.add('(rotation kept)')
  const vp8x = chunks.find((c) => c.type === 'VP8X')
  if (vp8x) {
    const d = vp8x.data.slice()
    const hasIcc = chunks.some((c) => c.type === 'ICCP')
    d[0] = (d[0] & ~(0x20 | 0x08 | 0x04)) | (hasIcc ? 0x20 : 0) | (exif ? 0x08 : 0)
    vp8x.data = d
  }
  const body = chunks.map((c) => riffChunk(c.type, c.data))
  // EXIF is only valid with a VP8X header; without one the rotation cannot be kept.
  if (exif && vp8x) body.push(riffChunk('EXIF', exif))
  const payload = concat([new Uint8Array([0x57, 0x45, 0x42, 0x50]), ...body])
  const head = new Uint8Array(8)
  head.set([0x52, 0x49, 0x46, 0x46])
  new DataView(head.buffer).setUint32(4, payload.length, true)
  return { bytes: concat([head, payload]), removed: [...removed] }
}

/** EXIF and XMP of a WebP file, for reading what is there. */
export function webpBlocks(b: Uint8Array): { tiff: Uint8Array | null; xmp: string | null } {
  if (ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return { tiff: null, xmp: null }
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let tiff: Uint8Array | null = null
  let xmp: string | null = null
  for (let i = 12; i + 8 <= b.length; ) {
    const type = ascii(b, i, 4)
    const len = v.getUint32(i + 4, true)
    const data = b.subarray(i + 8, i + 8 + len)
    if (type === 'EXIF') tiff = ascii(data, 0, 6) === 'Exif\0\0' ? data.subarray(6) : data
    if (type === 'XMP ') xmp = new TextDecoder().decode(data)
    i += 8 + len + (len & 1)
  }
  return { tiff, xmp }
}
