/**
 * The box model of the redaction editor, and the full-size export.
 *
 *   EditorBox        a box in fractions (0..1) of the image, so the preview and
 *                    the full-size export agree; `keep` leaves the area visible
 *   boxesFromDetections(dets, width, height, kind)  detector pixels -> EditorBox[],
 *                    padded per kind (a face box grows to cover hair and chin)
 *   paintBoxes(ctx, boxes, look, width, height)     paints every box that is not kept
 *   renderRedacted(source, width, height, boxes, look) -> canvas at that size
 *   encodeRedacted(canvas, format, quality) -> Blob (re-encoded from raw pixels,
 *                    so EXIF, GPS and the embedded thumbnail are gone)
 */
import type { Detection } from '@/lib/ml/vision/geometry'
import { encodePhotoCanvasStrict } from '@/components/tools/image-edit/photo-image'
import type { PhotoFormat } from '@/components/tools/image-edit/photo-image'
import { padded } from './pad'
import type { BoxKind } from './pad'
import { paintRedactions } from './paint'
import type { Ctx2D, RedactLook } from './paint'

export type { BoxKind } from './pad'

export interface EditorBox {
  id: string
  x: number
  y: number
  w: number
  h: number
  kind: BoxKind
  /** Leave this area visible. */
  keep: boolean
  /** Detector score, 0..1; absent for drawn boxes. */
  score?: number
  /** What the box hides ("Email", "Document number"); the list and aria labels show it. */
  label?: string
}

let counter = 0
export function boxId(): string {
  counter += 1
  return `box-${counter}`
}

export function boxesFromDetections(dets: readonly Detection[], width: number, height: number, kind: BoxKind): EditorBox[] {
  return dets.map((d) => {
    const b = padded(d, kind, { width, height })
    return { id: boxId(), x: b.x / width, y: b.y / height, w: b.w / width, h: b.h / height, kind, keep: false, score: d.score }
  })
}

export function paintBoxes(ctx: Ctx2D, boxes: readonly EditorBox[], look: RedactLook, width: number, height: number) {
  paintRedactions(
    ctx,
    boxes.filter((b) => !b.keep).map((b) => ({ x: b.x * width, y: b.y * height, w: b.w * width, h: b.h * height })),
    look,
  )
}

export function renderRedacted(
  source: CanvasImageSource,
  width: number,
  height: number,
  boxes: readonly EditorBox[],
  look: RedactLook,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser blocked canvas access, so the image cannot be processed.')
  ctx.drawImage(source, 0, 0, width, height)
  paintBoxes(ctx, boxes, look, width, height)
  return canvas
}

export function encodeRedacted(canvas: HTMLCanvasElement, format: PhotoFormat, quality: number): Promise<Blob> {
  return encodePhotoCanvasStrict(canvas, format, quality)
}

/** A whole-image box, for "apply to the whole image". */
export const WHOLE_IMAGE: EditorBox = { id: 'whole', x: 0, y: 0, w: 1, h: 1, kind: 'manual', keep: false }
