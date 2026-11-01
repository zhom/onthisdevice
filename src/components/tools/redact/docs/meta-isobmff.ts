/**
 * Metadata removal for ISO base media files (MP4, MOV, HEIC) without moving a
 * byte of media data: metadata boxes become "free" boxes of the same size,
 * and metadata items are overwritten in place, so every offset stays valid.
 */

export interface MediaMeta {
  label: string
  value: string
}

interface Box {
  type: string
  start: number
  /** Start of the payload, after size and type (and a 64-bit size). */
  body: number
  end: number
}

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n))

function boxes(b: Uint8Array, from: number, to: number): Box[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const out: Box[] = []
  let i = from
  while (i + 8 <= to) {
    let size = v.getUint32(i)
    const type = ascii(b, i + 4, 4)
    let body = i + 8
    if (size === 1) {
      size = Number(v.getBigUint64(i + 8))
      body += 8
    } else if (size === 0) size = to - i
    if (size < 8 || i + size > to) break
    out.push({ type, start: i, body, end: i + size })
    i += size
  }
  return out
}

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'edts', 'dinf', 'stbl', 'udta'])

export function isoBrand(b: Uint8Array): string | null {
  if (ascii(b, 4, 4) !== 'ftyp') return null
  return ascii(b, 8, 4)
}

export function isHeif(b: Uint8Array): boolean {
  const brand = isoBrand(b)
  return brand !== null && /^(?:heic|heix|heim|heis|hevc|hevx|mif1|msf1|avif|avis)$/.test(brand)
}

/** Readable text of an iTunes-style or QuickTime text value. */
function textOf(b: Uint8Array, from: number, to: number): string {
  return new TextDecoder().decode(b.subarray(from, to)).replace(/\0+$/, '').trim()
}

const UDTA_NAMES: Record<string, string> = {
  '©xyz': 'Location',
  '©nam': 'Title',
  '©ART': 'Artist',
  '©aut': 'Author',
  '©cmt': 'Comment',
  '©day': 'Date',
  '©mak': 'Make',
  '©mod': 'Model',
  '©swr': 'Software',
  '©too': 'Encoder',
  '©des': 'Description',
  '©cpy': 'Copyright',
  desc: 'Description',
  cprt: 'Copyright',
}

/** Lists the metadata a video file holds: user data, Apple keys, XMP and creation dates. */
export function readVideoMeta(b: Uint8Array): MediaMeta[] {
  const out: MediaMeta[] = []
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const walk = (from: number, to: number, path: string) => {
    for (const box of boxes(b, from, to)) {
      const p = `${path}/${box.type}`
      if (box.type === 'mvhd') {
        const version = b[box.body]
        const secs = version === 1 ? Number(v.getBigUint64(box.body + 4)) : v.getUint32(box.body + 4)
        if (secs > 0) out.push({ label: 'Created', value: new Date((secs - 2082844800) * 1000).toISOString().replace('T', ' ').slice(0, 19) })
      }
      if (box.type === 'uuid' && ascii(b, box.body, 16) === '\xbe\x7a\xcf\xcb\x97\xa9\x42\xe8\x9c\x71\x99\x94\x91\xe3\xaf\xac') {
        out.push({ label: 'XMP', value: `${box.end - box.body - 16} bytes` })
      }
      if (box.type === 'loci') {
        // 3GPP location: version/flags, language, name, role, then 16.16 longitude, latitude, altitude.
        let at = box.body + 6
        while (at < box.end && b[at] !== 0) at++
        at += 2
        if (at + 8 <= box.end) {
          const lon = v.getInt32(at) / 65536
          const lat = v.getInt32(at + 4) / 65536
          out.push({ label: 'Location', value: `${lat.toFixed(4)}, ${lon.toFixed(4)}` })
        } else out.push({ label: 'Location', value: 'present' })
      }
      if (path.endsWith('/udta') && UDTA_NAMES[box.type]) {
        // QuickTime text atom: 2-byte length, 2-byte language, text. iTunes style: 'data' child.
        const len = v.getUint16(box.body)
        const value = len > 0 && box.body + 4 + len <= box.end ? textOf(b, box.body + 4, box.body + 4 + len) : textOf(b, box.body, box.end)
        out.push({ label: UDTA_NAMES[box.type], value })
      }
      if (box.type === 'meta') {
        // QuickTime 'meta' (no version) or ISO 'meta' (4-byte version/flags).
        const iso = ascii(b, box.body + 8, 4) === 'hdlr' ? 4 : 0
        const kids = boxes(b, box.body + iso, box.end)
        const keys = kids.find((k) => k.type === 'keys')
        const ilst = kids.find((k) => k.type === 'ilst')
        const names: string[] = []
        if (keys) {
          const n = v.getUint32(keys.body + 4)
          let at = keys.body + 8
          for (let k = 0; k < n && at + 8 <= keys.end; k++) {
            const size = v.getUint32(at)
            names.push(ascii(b, at + 8, size - 8))
            at += size
          }
        }
        if (ilst) {
          for (const item of boxes(b, ilst.body, ilst.end)) {
            const data = boxes(b, item.body, item.end).find((d) => d.type === 'data')
            if (!data) continue
            const value = textOf(b, data.body + 8, data.end)
            const index = v.getUint32(item.start + 4)
            const label = keys ? (names[index - 1] ?? 'Key').replace(/^com\.apple\.quicktime\./, '') : (UDTA_NAMES[item.type] ?? item.type)
            out.push({ label, value })
          }
        }
      }
      if (CONTAINERS.has(box.type)) walk(box.body, box.end, p)
    }
  }
  walk(0, b.length, '')
  return out
}

/** Frees user data, metadata and XMP boxes, and zeroes creation and change dates. */
export function stripVideo(src: Uint8Array): { bytes: Uint8Array; removed: string[] } {
  const b = src.slice()
  const removed = new Set<string>()
  const free = (box: Box, what: string) => {
    // Same size, type "free", payload zeroed: offsets of the media data do not change.
    b.set([0x66, 0x72, 0x65, 0x65], box.start + 4)
    b.fill(0, box.body, box.end)
    removed.add(what)
  }
  const zeroDates = (box: Box) => {
    const version = b[box.body]
    const n = version === 1 ? 16 : 8
    if (b.subarray(box.body + 4, box.body + 4 + n).some((x) => x !== 0)) removed.add('Creation and change dates')
    b.fill(0, box.body + 4, box.body + 4 + n)
  }
  const walk = (from: number, to: number) => {
    for (const box of boxes(b, from, to)) {
      if (box.type === 'udta') free(box, 'User data (location, title, author, device)')
      else if (box.type === 'meta') free(box, 'Metadata (location, device, keys)')
      else if (box.type === 'uuid' && ascii(b, box.body, 16) === '\xbe\x7a\xcf\xcb\x97\xa9\x42\xe8\x9c\x71\x99\x94\x91\xe3\xaf\xac') free(box, 'XMP')
      else if (box.type === 'mvhd' || box.type === 'tkhd' || box.type === 'mdhd') zeroDates(box)
      else if (CONTAINERS.has(box.type)) walk(box.body, box.end)
    }
  }
  walk(0, b.length)
  return { bytes: b, removed: [...removed] }
}

/* ------------------------------------------------------------------ */
/* HEIC / HEIF / AVIF                                                  */
/* ------------------------------------------------------------------ */

interface Item {
  id: number
  type: string
  contentType: string
}

interface Extent {
  offset: number
  length: number
  /** Offset into the idat box (construction method 1) instead of the file. */
  idat: boolean
}

function readItems(b: Uint8Array, meta: Box): { items: Item[]; locations: Map<number, Extent[]>; idat: Box | null } {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const kids = boxes(b, meta.body + 4, meta.end)
  const items: Item[] = []
  const locations = new Map<number, Extent[]>()
  const iinf = kids.find((k) => k.type === 'iinf')
  if (iinf) {
    const version = b[iinf.body]
    const start = iinf.body + 4 + (version === 0 ? 2 : 4)
    for (const infe of boxes(b, start, iinf.end)) {
      if (infe.type !== 'infe') continue
      const ver = b[infe.body]
      if (ver < 2) continue
      let at = infe.body + 4
      const id = ver === 2 ? v.getUint16(at) : v.getUint32(at)
      at += (ver === 2 ? 2 : 4) + 2
      const type = ascii(b, at, 4)
      at += 4
      const zero = (p: number) => {
        let e = p
        while (e < infe.end && b[e] !== 0) e++
        return e
      }
      const nameEnd = zero(at)
      let contentType = ''
      if (type === 'mime') contentType = ascii(b, nameEnd + 1, zero(nameEnd + 1) - nameEnd - 1)
      items.push({ id, type, contentType })
    }
  }
  const iloc = kids.find((k) => k.type === 'iloc')
  if (iloc) {
    const version = b[iloc.body]
    let at = iloc.body + 4
    const offSize = b[at] >> 4
    const lenSize = b[at] & 15
    const baseSize = b[at + 1] >> 4
    const idxSize = version === 1 || version === 2 ? b[at + 1] & 15 : 0
    at += 2
    const count = version < 2 ? v.getUint16(at) : v.getUint32(at)
    at += version < 2 ? 2 : 4
    const read = (n: number) => {
      let x = 0
      for (let k = 0; k < n; k++) x = x * 256 + b[at + k]
      at += n
      return x
    }
    for (let k = 0; k < count; k++) {
      const id = version < 2 ? read(2) : read(4)
      const method = version === 1 || version === 2 ? read(2) & 15 : 0
      read(2) // data reference index
      const base = read(baseSize)
      const extents = read(2)
      const list: Extent[] = []
      for (let e = 0; e < extents; e++) {
        if (idxSize) read(idxSize)
        const offset = read(offSize)
        const length = read(lenSize)
        list.push({ offset: base + offset, length, idat: method === 1 })
      }
      locations.set(id, list)
    }
  }
  return { items, locations, idat: kids.find((k) => k.type === 'idat') ?? null }
}

/** Overwrites the EXIF and XMP items of a HEIF image in place. */
export function stripHeif(src: Uint8Array): { bytes: Uint8Array; removed: string[] } {
  const b = src.slice()
  const meta = boxes(b, 0, b.length).find((x) => x.type === 'meta')
  if (!meta) return { bytes: b, removed: [] }
  const { items, locations, idat } = readItems(b, meta)
  const removed = new Set<string>()
  for (const item of items) {
    const exif = item.type === 'Exif'
    const xmp = item.type === 'mime' && /rdf\+xml|xmp/i.test(item.contentType)
    if (!exif && !xmp) continue
    for (const ext of locations.get(item.id) ?? []) {
      const at = ext.idat && idat ? idat.body + ext.offset : ext.offset
      if (at < 0 || at + ext.length > b.length) continue
      if (exif && ext.length >= 4 + 26) {
        // An empty EXIF block: offset 0, then a TIFF header with no tags.
        b.fill(0, at, at + ext.length)
        b.set([0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0], at + 4)
      } else b.fill(0x20, at, at + ext.length)
      removed.add(exif ? 'EXIF (camera, date, GPS)' : 'XMP')
    }
  }
  return { bytes: b, removed: [...removed] }
}
