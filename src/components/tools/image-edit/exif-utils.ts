/**
 * EXIF / IPTC / XMP reading and presentation helpers, shared by
 * `remove-exif-data` and `image-metadata-viewer`. Parsing is done by `exifr`,
 * entirely in the browser.
 */
import { format as formatDate, isValid as isValidDate } from 'date-fns'

export interface MetaField {
  key: string
  label: string
  value: string
}

export interface MetaGroup {
  id: string
  title: string
  fields: MetaField[]
}

export interface GpsPoint {
  lat: number
  lon: number
  altitude?: number
}

export interface MetaReport {
  raw: Record<string, unknown>
  groups: MetaGroup[]
  /** Number of individual tags found. */
  count: number
  gps: GpsPoint | null
  /** Human summary of which segments carried data. */
  segments: string[]
}

const GROUP_DEFS: { id: string; title: string; keys: string[] }[] = [
  {
    id: 'camera',
    title: 'Camera & lens',
    keys: [
      'Make',
      'Model',
      'LensMake',
      'LensModel',
      'LensInfo',
      'LensSerialNumber',
      'BodySerialNumber',
      'SerialNumber',
      'Software',
      'HostComputer',
      'OwnerName',
      'CameraOwnerName',
    ],
  },
  {
    id: 'exposure',
    title: 'Exposure',
    keys: [
      'ExposureTime',
      'ShutterSpeedValue',
      'FNumber',
      'ApertureValue',
      'MaxApertureValue',
      'ISO',
      'ISOSpeedRatings',
      'PhotographicSensitivity',
      'ExposureProgram',
      'ExposureMode',
      'ExposureBiasValue',
      'MeteringMode',
      'LightSource',
      'Flash',
      'FocalLength',
      'FocalLengthIn35mmFormat',
      'WhiteBalance',
      'DigitalZoomRatio',
      'SceneCaptureType',
      'Contrast',
      'Saturation',
      'Sharpness',
      'SubjectDistance',
      'SubjectDistanceRange',
    ],
  },
  {
    id: 'image',
    title: 'Image',
    keys: [
      'ImageWidth',
      'ImageHeight',
      'ExifImageWidth',
      'ExifImageHeight',
      'Orientation',
      'XResolution',
      'YResolution',
      'ResolutionUnit',
      'ColorSpace',
      'BitsPerSample',
      'BitDepth',
      'ColorType',
      'Compression',
      'PhotometricInterpretation',
      'YCbCrPositioning',
      'ComponentsConfiguration',
      'SceneType',
      'CustomRendered',
      'ExifVersion',
      'FlashpixVersion',
      'Interlace',
      'Filter',
    ],
  },
  {
    id: 'datetime',
    title: 'Date & time',
    keys: [
      'DateTimeOriginal',
      'CreateDate',
      'DateTimeDigitized',
      'ModifyDate',
      'DateTime',
      'OffsetTime',
      'OffsetTimeOriginal',
      'OffsetTimeDigitized',
      'SubSecTimeOriginal',
      'GPSDateStamp',
      'GPSTimeStamp',
    ],
  },
  {
    id: 'gps',
    title: 'Location (GPS)',
    keys: [
      'latitude',
      'longitude',
      'GPSLatitude',
      'GPSLatitudeRef',
      'GPSLongitude',
      'GPSLongitudeRef',
      'GPSAltitude',
      'GPSAltitudeRef',
      'GPSSpeed',
      'GPSSpeedRef',
      'GPSImgDirection',
      'GPSImgDirectionRef',
      'GPSDestBearing',
      'GPSHPositioningError',
      'GPSProcessingMethod',
      'GPSVersionID',
    ],
  },
  {
    id: 'rights',
    title: 'Description & rights',
    keys: [
      'ImageDescription',
      'Artist',
      'Copyright',
      'Creator',
      'CreatorTool',
      'Rights',
      'UsageTerms',
      'Title',
      'Description',
      'Headline',
      'Caption',
      'ObjectName',
      'Byline',
      'BylineTitle',
      'Credit',
      'Source',
      'Keywords',
      'Subject',
      'City',
      'State',
      'Country',
      'CountryCode',
      'Sublocation',
      'UserComment',
      'XPComment',
      'XPTitle',
      'XPAuthor',
      'XPKeywords',
      'XPSubject',
      'Rating',
      'Label',
    ],
  },
]

const LABELS: Record<string, string> = {
  ISO: 'ISO',
  FNumber: 'Aperture',
  ExposureTime: 'Shutter speed',
  FocalLengthIn35mmFormat: 'Focal length (35 mm equivalent)',
  latitude: 'Latitude',
  longitude: 'Longitude',
  Make: 'Camera make',
  Model: 'Camera model',
  DateTimeOriginal: 'Taken',
  CreateDate: 'Created',
  ModifyDate: 'Modified',
  ExifImageWidth: 'Width (EXIF)',
  ExifImageHeight: 'Height (EXIF)',
  GPSHPositioningError: 'GPS accuracy',
}

export function humanLabel(key: string): string {
  if (LABELS[key]) return LABELS[key]
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/^GPS /, 'GPS ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function round(n: number, digits = 4): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

export function formatMetaValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '–'
  if (value instanceof Date) {
    return isValidDate(value) ? formatDate(value, "d MMM yyyy 'at' HH:mm:ss") : String(value)
  }
  if (value instanceof Uint8Array) return `${value.length} bytes of binary data`
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'number' ? String(round(v)) : String(v))).join(', ')
  }
  if (typeof value === 'number') {
    if (key === 'ExposureTime') {
      if (value === 0) return '0 s'
      return value < 1 ? `1/${Math.round(1 / value)} s` : `${round(value, 2)} s`
    }
    if (key === 'FNumber' || key === 'ApertureValue' || key === 'MaxApertureValue') {
      return `f/${round(value, 1)}`
    }
    if (key === 'FocalLength' || key === 'FocalLengthIn35mmFormat') return `${round(value, 1)} mm`
    if (key === 'GPSAltitude') return `${round(value, 1)} m`
    if (key === 'GPSHPositioningError') return `±${round(value, 1)} m`
    if (key === 'GPSSpeed') return `${round(value, 2)}`
    if (key === 'ExposureBiasValue') return `${value > 0 ? '+' : ''}${round(value, 2)} EV`
    if (key === 'latitude' || key === 'longitude') return String(round(value, 6))
    return String(round(value, 4))
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  const s = String(value).trim()
  return s.length > 300 ? `${s.slice(0, 300)}…` : s || '–'
}

/** Decimal degrees → 51°28'40.1" N */
export function toDms(value: number, axis: 'lat' | 'lon'): string {
  const dir = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'
  const abs = Math.abs(value)
  const deg = Math.floor(abs)
  const minFloat = (abs - deg) * 60
  const min = Math.floor(minFloat)
  const sec = (minFloat - min) * 60
  return `${deg}°${String(min).padStart(2, '0')}'${sec.toFixed(1)}" ${dir}`
}

const PARSE_OPTIONS = {
  tiff: true,
  ifd1: true,
  exif: true,
  gps: true,
  interop: true,
  iptc: true,
  xmp: true,
  icc: true,
  jfif: true,
  ihdr: true,
  makerNote: false,
  userComment: true,
  mergeOutput: true,
  sanitize: true,
  translateKeys: true,
  translateValues: true,
  reviveValues: true,
} as const

/** Read every metadata block `exifr` understands and group it for display. */
export async function readMetadata(file: File): Promise<MetaReport> {
  const exifr = (await import('exifr')).default
  let raw: Record<string, unknown> = {}
  try {
    const parsed = (await exifr.parse(file, PARSE_OPTIONS)) as Record<string, unknown> | undefined
    if (parsed) raw = parsed
  } catch {
    raw = {}
  }

  const used = new Set<string>()
  const groups: MetaGroup[] = []

  for (const def of GROUP_DEFS) {
    const fields: MetaField[] = []
    for (const key of def.keys) {
      if (!(key in raw)) continue
      const value = raw[key]
      if (value === undefined || value === null || value === '') continue
      used.add(key)
      fields.push({ key, label: humanLabel(key), value: formatMetaValue(key, value) })
    }
    if (fields.length > 0) groups.push({ id: def.id, title: def.title, fields })
  }

  const otherFields: MetaField[] = []
  for (const key of Object.keys(raw)) {
    if (used.has(key)) continue
    const value = raw[key]
    if (value === undefined || value === null || value === '') continue
    otherFields.push({ key, label: humanLabel(key), value: formatMetaValue(key, value) })
  }
  otherFields.sort((a, b) => a.label.localeCompare(b.label))
  if (otherFields.length > 0) {
    groups.push({ id: 'other', title: 'Other tags', fields: otherFields })
  }

  const lat = typeof raw.latitude === 'number' ? raw.latitude : null
  const lon = typeof raw.longitude === 'number' ? raw.longitude : null
  const altitude = typeof raw.GPSAltitude === 'number' ? raw.GPSAltitude : undefined
  const gps: GpsPoint | null =
    lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)
      ? { lat, lon, ...(altitude !== undefined ? { altitude } : {}) }
      : null

  const segments: string[] = []
  if (groups.some((g) => g.id === 'camera' || g.id === 'exposure')) segments.push('EXIF')
  if (gps) segments.push('GPS')
  if ('Byline' in raw || 'ObjectName' in raw || 'Credit' in raw || 'Headline' in raw) {
    segments.push('IPTC')
  }
  if ('CreatorTool' in raw || 'Rights' in raw || 'Subject' in raw) segments.push('XMP')

  return {
    raw,
    groups,
    count: groups.reduce((sum, g) => sum + g.fields.length, 0),
    gps,
    segments,
  }
}

/** Try to pull the embedded JPEG preview thumbnail out of the file. */
export async function readThumbnailUrl(file: File): Promise<string | null> {
  try {
    const exifr = (await import('exifr')).default
    const url = await exifr.thumbnailUrl(file)
    return url ?? null
  } catch {
    return null
  }
}

/** JSON-safe stringify: Dates, typed arrays and BigInts survive the trip. */
export function metadataToJson(raw: Record<string, unknown>): string {
  return JSON.stringify(
    raw,
    (_key, value: unknown) => {
      if (value instanceof Date) return value.toISOString()
      if (value instanceof Uint8Array) return `<${value.length} bytes>`
      if (typeof value === 'bigint') return value.toString()
      return value
    },
    2,
  )
}
