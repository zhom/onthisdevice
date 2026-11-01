/** What metadata a file holds, as short labelled fields, for the before and after lists. */
import { readOfficeMeta, readPdfMeta, stripOffice, stripPdf } from './meta-docs'
import type { Field } from './meta-docs'
import { stripJpeg, stripPng, stripWebp, webpBlocks } from './meta-image'
import type { StripOptions } from './meta-image'
import { isHeif, isoBrand, readVideoMeta, stripHeif, stripVideo } from './meta-isobmff'

export type { Field } from './meta-docs'

export type MetaKind = 'jpeg' | 'png' | 'webp' | 'heif' | 'video' | 'pdf' | 'office'

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n))

export function sniff(b: Uint8Array, name: string): MetaKind | null {
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg'
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'png'
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp'
  if (ascii(b, 0, 5) === '%PDF-') return 'pdf'
  if (b[0] === 0x50 && b[1] === 0x4b && /\.(?:docx|xlsx|pptx|docm|xlsm|pptm)$/i.test(name)) return 'office'
  if (isoBrand(b)) return isHeif(b) ? 'heif' : 'video'
  return null
}

const IMAGE_LABELS: Record<string, string> = {
  Orientation: 'Rotation',
  Make: 'Camera make',
  Model: 'Camera model',
  LensModel: 'Lens',
  SerialNumber: 'Serial number',
  BodySerialNumber: 'Serial number',
  LensSerialNumber: 'Lens serial number',
  DateTimeOriginal: 'Taken',
  CreateDate: 'Created',
  ModifyDate: 'Modified',
  Artist: 'Artist',
  Copyright: 'Copyright',
  XPAuthor: 'Author',
  OwnerName: 'Owner',
  CameraOwnerName: 'Owner',
  Software: 'Software',
  ImageDescription: 'Description',
  UserComment: 'Comment',
  XPComment: 'Comment',
  HostComputer: 'Computer',
  Byline: 'By-line',
  Credit: 'Credit',
  City: 'City',
  Country: 'Country',
  Author: 'Author',
  Comment: 'Comment',
  Description: 'Description',
  Title: 'Title',
}

function show(v: unknown): string {
  if (v instanceof Date) return v.toISOString().replace('T', ' ').slice(0, 19)
  if (Array.isArray(v)) return v.map(show).join(', ')
  if (v instanceof Uint8Array) return `${v.byteLength} bytes`
  if (typeof v === 'object' && v !== null) return Object.values(v).map(show).join(', ')
  return String(v).trim()
}

async function readImageMeta(b: Uint8Array, kind: MetaKind): Promise<Field[]> {
  const exifr = (await import('exifr')).default
  let input: Uint8Array = b
  let xmpText: string | null = null
  if (kind === 'webp') {
    const blocks = webpBlocks(b)
    xmpText = blocks.xmp
    if (!blocks.tiff) input = new Uint8Array(0)
    else input = blocks.tiff
  }
  const out: Field[] = []
  let total = 0
  if (input.byteLength > 0) {
    const data = (await exifr
      .parse(input, { tiff: true, ifd1: true, exif: true, gps: true, xmp: true, iptc: true, icc: true, ihdr: true, jfif: false, mergeOutput: false, makerNote: false })
      .catch(() => null)) as Record<string, Record<string, unknown>> | null
    if (data) {
      const gps = data.gps
      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
        out.push({ label: 'GPS location', value: `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` })
      }
      if (data.ifd1 && Object.keys(data.ifd1).length) out.push({ label: 'Embedded thumbnail', value: 'present' })
      const icc = data.icc
      if (icc) out.push({ label: 'Color profile', value: show(icc.ProfileDescription ?? icc.description ?? 'present') })
      for (const [segment, fields] of Object.entries(data)) {
        if (!fields || typeof fields !== 'object' || segment === 'icc' || segment === 'ihdr') continue
        for (const [k, v] of Object.entries(fields)) {
          if (segment === 'gps' || segment === 'ifd1') {
            total++
            continue
          }
          total++
          const label = IMAGE_LABELS[k]
          const value = show(v)
          if (label && value && !out.some((f) => f.label === label && f.value === value)) out.push({ label, value })
          if (segment === 'dc' && k === 'creator') out.push({ label: 'XMP creator', value })
        }
      }
      // PNG text chunks arrive in ihdr.
      for (const [k, v] of Object.entries(data.ihdr ?? {})) {
        if (!['ImageWidth', 'ImageHeight', 'BitDepth', 'ColorType', 'Compression', 'Filter', 'Interlace'].includes(k)) {
          total++
          out.push({ label: IMAGE_LABELS[k] ?? k, value: show(v) })
        }
      }
    }
  }
  if (xmpText) {
    const creator = /<dc:creator>[\s\S]*?<rdf:li[^>]*>([^<]*)</.exec(xmpText)?.[1]
    out.push({ label: 'XMP', value: creator ? `creator ${creator}` : `${xmpText.length} bytes` })
  }
  const listed = out.length
  if (total > listed) out.push({ label: 'Other fields', value: String(total - listed) })
  return out
}

export async function readMeta(b: Uint8Array, kind: MetaKind): Promise<Field[]> {
  switch (kind) {
    case 'pdf':
      return readPdfMeta(b)
    case 'office':
      return readOfficeMeta(b)
    case 'video':
      return readVideoMeta(b)
    default:
      return readImageMeta(b, kind)
  }
}

export async function stripMeta(b: Uint8Array, kind: MetaKind, opts: StripOptions): Promise<Uint8Array> {
  switch (kind) {
    case 'jpeg':
      return stripJpeg(b, opts).bytes
    case 'png':
      return stripPng(b, opts).bytes
    case 'webp':
      return stripWebp(b, opts).bytes
    case 'heif':
      return stripHeif(b).bytes
    case 'video':
      return stripVideo(b).bytes
    case 'pdf':
      return stripPdf(b)
    case 'office':
      return stripOffice(b)
  }
}
