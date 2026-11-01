/**
 * Round-2 batch `pdf-edit` — the overlay editor's document model and exporter.
 *
 * Objects are stored in *displayed page points*: origin at the top-left of the
 * page as the reader sees it, y increasing downwards, one unit = 1/72 inch.
 * That is the same space the DOM overlay uses, so what is on screen is exactly
 * what gets composited into the file — including on pages with a /Rotate entry.
 */
import type { PDFFont, PDFImage, PDFPage } from 'pdf-lib'
import { nextFrame } from '@/lib/utils'
import {
  displayToUser,
  drawAngleFor,
  findUnsupportedCharacter,
  geometryFromPdfLib,
  hexToRgb01,
  loadPdfLib,
} from './pdf-edit-core'

export type FontKey =
  | 'helvetica'
  | 'helvetica-bold'
  | 'helvetica-oblique'
  | 'times'
  | 'times-bold'
  | 'times-italic'
  | 'courier'
  | 'courier-bold'

export interface FontChoice {
  key: FontKey
  label: string
  /** Name of the matching built-in PDF font. */
  standard:
    | 'Helvetica'
    | 'Helvetica-Bold'
    | 'Helvetica-Oblique'
    | 'Times-Roman'
    | 'Times-Bold'
    | 'Times-Italic'
    | 'Courier'
    | 'Courier-Bold'
  /** CSS stack used for the on-screen preview. */
  css: string
}

export const FONT_CHOICES: FontChoice[] = [
  {
    key: 'helvetica',
    label: 'Helvetica',
    standard: 'Helvetica',
    css: 'Helvetica, Arial, "Liberation Sans", sans-serif',
  },
  {
    key: 'helvetica-bold',
    label: 'Helvetica Bold',
    standard: 'Helvetica-Bold',
    css: 'Helvetica, Arial, "Liberation Sans", sans-serif',
  },
  {
    key: 'helvetica-oblique',
    label: 'Helvetica Italic',
    standard: 'Helvetica-Oblique',
    css: 'Helvetica, Arial, "Liberation Sans", sans-serif',
  },
  {
    key: 'times',
    label: 'Times Roman',
    standard: 'Times-Roman',
    css: '"Times New Roman", Times, "Liberation Serif", serif',
  },
  {
    key: 'times-bold',
    label: 'Times Bold',
    standard: 'Times-Bold',
    css: '"Times New Roman", Times, "Liberation Serif", serif',
  },
  {
    key: 'times-italic',
    label: 'Times Italic',
    standard: 'Times-Italic',
    css: '"Times New Roman", Times, "Liberation Serif", serif',
  },
  {
    key: 'courier',
    label: 'Courier',
    standard: 'Courier',
    css: '"Courier New", Courier, monospace',
  },
  {
    key: 'courier-bold',
    label: 'Courier Bold',
    standard: 'Courier-Bold',
    css: '"Courier New", Courier, monospace',
  },
]

export const FONT_BY_KEY: Record<FontKey, FontChoice> = Object.fromEntries(
  FONT_CHOICES.map((f) => [f.key, f]),
) as Record<FontKey, FontChoice>

export function cssWeight(key: FontKey): number {
  return key.includes('bold') ? 700 : 400
}

export function cssStyle(key: FontKey): 'normal' | 'italic' {
  return key.includes('italic') || key.includes('oblique') ? 'italic' : 'normal'
}

/* ------------------------------------------------------------------ */
/* Objects                                                             */
/* ------------------------------------------------------------------ */

export type ObjKind = 'text' | 'image' | 'rect' | 'highlight' | 'whiteout' | 'ink' | 'line'

interface ObjBase {
  id: string
  /** 1-based page number. */
  page: number
}

export interface TextObj extends ObjBase {
  kind: 'text'
  x: number
  y: number
  text: string
  size: number
  color: string
  font: FontKey
}

export interface ImageObj extends ObjBase {
  kind: 'image'
  x: number
  y: number
  w: number
  h: number
  assetId: string
  opacity: number
}

export interface BoxObj extends ObjBase {
  kind: 'rect' | 'highlight' | 'whiteout'
  x: number
  y: number
  w: number
  h: number
  color: string
  filled: boolean
  strokeWidth: number
  opacity: number
}

export interface Point {
  x: number
  y: number
}

export interface InkObj extends ObjBase {
  kind: 'ink'
  points: Point[]
  color: string
  width: number
}

export interface LineObj extends ObjBase {
  kind: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  width: number
}

export type EditorObject = TextObj | ImageObj | BoxObj | InkObj | LineObj

export interface ImageAsset {
  id: string
  bytes: Uint8Array
  type: 'png' | 'jpg'
  width: number
  height: number
  url: string
  label: string
}

let counter = 0
export function newId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 7)}`
}

/** Axis-aligned bounds of any object, in displayed page points. */
export function boundsOf(obj: EditorObject): { x: number; y: number; w: number; h: number } {
  switch (obj.kind) {
    case 'text': {
      const lines = obj.text.split('\n')
      const longest = lines.reduce((m, l) => Math.max(m, l.length), 1)
      // Helvetica averages ~0.5 em per character; only used for the focus ring.
      return {
        x: obj.x,
        y: obj.y,
        w: Math.max(8, longest * obj.size * 0.5),
        h: Math.max(obj.size, lines.length * obj.size * 1.15),
      }
    }
    case 'image':
    case 'rect':
    case 'highlight':
    case 'whiteout':
      return { x: obj.x, y: obj.y, w: obj.w, h: obj.h }
    case 'line':
      return {
        x: Math.min(obj.x1, obj.x2),
        y: Math.min(obj.y1, obj.y2),
        w: Math.abs(obj.x2 - obj.x1),
        h: Math.abs(obj.y2 - obj.y1),
      }
    case 'ink': {
      // A loop rather than Math.min(...points): a long stroke can hold
      // thousands of samples before it is simplified on pointer-up.
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of obj.points) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
      if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    }
  }
}

export function moveObject(obj: EditorObject, dx: number, dy: number): EditorObject {
  switch (obj.kind) {
    case 'ink':
      return { ...obj, points: obj.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
    case 'line':
      return { ...obj, x1: obj.x1 + dx, y1: obj.y1 + dy, x2: obj.x2 + dx, y2: obj.y2 + dy }
    default:
      return { ...obj, x: obj.x + dx, y: obj.y + dy }
  }
}

export function describeObject(obj: EditorObject): string {
  switch (obj.kind) {
    case 'text':
      return `Text “${obj.text.split('\n')[0].slice(0, 40) || 'empty'}”`
    case 'image':
      return 'Placed image'
    case 'rect':
      return 'Rectangle'
    case 'highlight':
      return 'Highlight'
    case 'whiteout':
      return 'White-out box'
    case 'ink':
      return 'Freehand drawing'
    case 'line':
      return 'Line'
  }
}

/** Drop points that are closer together than `min` points — signatures get chatty. */
export function simplifyStroke(points: Point[], min = 0.8): Point[] {
  if (points.length < 3) return points
  const out: Point[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1]
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= min) out.push(points[i])
  }
  out.push(points[points.length - 1])
  return out
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export interface ExportProgress {
  done: number
  total: number
  label: string
}

/**
 * Composite every object into the original file with pdf-lib.
 *
 * The original page content is left untouched — text stays selectable and
 * vectors stay sharp — because each object is appended to the page's own
 * content stream rather than the page being re-rendered.
 */
export async function exportEditedPdf(
  source: Uint8Array,
  objects: EditorObject[],
  assets: Map<string, ImageAsset>,
  onProgress?: (p: ExportProgress) => void,
): Promise<Uint8Array> {
  const lib = await loadPdfLib()
  const { PDFDocument, rgb, degrees, BlendMode } = lib

  const doc = await PDFDocument.load(source, {
    ignoreEncryption: true,
    updateMetadata: false,
  })
  const pages = doc.getPages()
  const geos = geometryFromPdfLib(pages)

  const fonts = new Map<FontKey, PDFFont>()
  const getFont = async (key: FontKey): Promise<PDFFont> => {
    const cached = fonts.get(key)
    if (cached) return cached
    // The value is one of the 14 built-in font names, which pdf-lib matches by
    // string — nothing is embedded, so the file stays small and portable.
    const font = await doc.embedFont(FONT_BY_KEY[key].standard)
    fonts.set(key, font)
    return font
  }

  const images = new Map<string, PDFImage>()
  const getImage = async (assetId: string): Promise<PDFImage | null> => {
    const cached = images.get(assetId)
    if (cached) return cached
    const asset = assets.get(assetId)
    if (!asset) return null
    const embedded =
      asset.type === 'png' ? await doc.embedPng(asset.bytes) : await doc.embedJpg(asset.bytes)
    images.set(assetId, embedded)
    return embedded
  }

  // Validate text up front so the user gets one clear message instead of a
  // pdf-lib exception halfway through the write.
  for (const obj of objects) {
    if (obj.kind !== 'text') continue
    const bad = findUnsupportedCharacter(obj.text)
    if (bad) {
      throw new Error(
        `The character “${bad}” cannot be drawn with the fonts built into every PDF reader (they cover Western European alphabets only). Remove it, or place that text as an image.`,
      )
    }
  }

  const byPage = new Map<number, EditorObject[]>()
  for (const obj of objects) {
    const list = byPage.get(obj.page)
    if (list) list.push(obj)
    else byPage.set(obj.page, [obj])
  }

  const pageNumbers = [...byPage.keys()].sort((a, b) => a - b)
  let done = 0

  for (const pageNo of pageNumbers) {
    const page: PDFPage | undefined = pages[pageNo - 1]
    const geo = geos[pageNo - 1]
    if (!page || !geo) continue
    const angle = drawAngleFor(geo.rotation)
    onProgress?.({
      done,
      total: pageNumbers.length,
      label: `Compositing page ${pageNo}`,
    })

    for (const obj of byPage.get(pageNo) ?? []) {
      switch (obj.kind) {
        case 'text': {
          if (!obj.text.trim()) break
          const font = await getFont(obj.font)
          const { r, g, b } = hexToRgb01(obj.color)
          const lines = obj.text.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (!lines[i]) continue
            const baselineFromTop = obj.y + obj.size * 0.8 + i * obj.size * 1.15
            const p = displayToUser(geo, obj.x, geo.displayH - baselineFromTop)
            page.drawText(lines[i], {
              x: p.x,
              y: p.y,
              size: obj.size,
              font,
              color: rgb(r, g, b),
              rotate: degrees(angle),
            })
          }
          break
        }
        case 'image': {
          const image = await getImage(obj.assetId)
          if (!image) break
          const p = displayToUser(geo, obj.x, geo.displayH - (obj.y + obj.h))
          page.drawImage(image, {
            x: p.x,
            y: p.y,
            width: obj.w,
            height: obj.h,
            rotate: degrees(angle),
            opacity: obj.opacity,
          })
          break
        }
        case 'rect':
        case 'highlight':
        case 'whiteout': {
          const p = displayToUser(geo, obj.x, geo.displayH - (obj.y + obj.h))
          // White-out boxes default to white but stay recolourable, because
          // scanned paper is cream or grey and a pure-white patch shows.
          const { r, g, b } = hexToRgb01(obj.color)
          const filled = obj.kind === 'rect' ? obj.filled : true
          page.drawRectangle({
            x: p.x,
            y: p.y,
            width: obj.w,
            height: obj.h,
            rotate: degrees(angle),
            color: filled ? rgb(r, g, b) : undefined,
            borderColor: obj.kind === 'rect' && obj.strokeWidth > 0 ? rgb(r, g, b) : undefined,
            borderWidth: obj.kind === 'rect' ? obj.strokeWidth : 0,
            opacity: obj.kind === 'whiteout' ? 1 : obj.opacity,
            borderOpacity: obj.opacity,
            // Multiply keeps the text underneath a highlight readable, exactly
            // as a real highlighter pen behaves.
            blendMode: obj.kind === 'highlight' ? BlendMode.Multiply : undefined,
          })
          break
        }
        case 'line': {
          const { r, g, b } = hexToRgb01(obj.color)
          const a = displayToUser(geo, obj.x1, geo.displayH - obj.y1)
          const z = displayToUser(geo, obj.x2, geo.displayH - obj.y2)
          page.drawLine({
            start: { x: a.x, y: a.y },
            end: { x: z.x, y: z.y },
            thickness: obj.width,
            color: rgb(r, g, b),
          })
          break
        }
        case 'ink': {
          const { r, g, b } = hexToRgb01(obj.color)
          const pts = obj.points
          if (pts.length === 1) {
            const p = displayToUser(geo, pts[0].x, geo.displayH - pts[0].y)
            page.drawCircle({
              x: p.x,
              y: p.y,
              size: obj.width / 2,
              color: rgb(r, g, b),
            })
            break
          }
          for (let i = 1; i < pts.length; i++) {
            const a = displayToUser(geo, pts[i - 1].x, geo.displayH - pts[i - 1].y)
            const z = displayToUser(geo, pts[i].x, geo.displayH - pts[i].y)
            page.drawLine({
              start: { x: a.x, y: a.y },
              end: { x: z.x, y: z.y },
              thickness: obj.width,
              color: rgb(r, g, b),
              lineCap: lib.LineCapStyle.Round,
            })
          }
          break
        }
      }
    }

    done += 1
    await nextFrame()
  }

  onProgress?.({ done, total: pageNumbers.length, label: 'Writing the PDF' })
  return doc.save({ useObjectStreams: false })
}
