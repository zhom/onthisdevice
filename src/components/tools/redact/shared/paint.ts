/**
 * Paints redactions into a 2D canvas: blur, pixelate or solid fill, as an
 * oval or a rectangle. Used by the photo editor, the video export and the
 * live camera, on the main thread and in workers.
 *
 *   paintRedactions(ctx, boxes, look)
 *     ctx    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D that
 *            already holds the image; the boxes are painted over it in place.
 *     boxes  { x, y, w, h } in pixels of that canvas
 *     look   { style: 'blur' | 'pixelate' | 'fill', shape: 'oval' | 'rect',
 *              strength: 0..100, fill?: CSS colour (default black) }
 *
 * Strength is relative to each box (a share of its short side), so a small
 * box gets the same visual effect as a large one and a preview at a lower
 * resolution matches the full-size export. The covered pixels are replaced,
 * and the result inside each box is opaque, also at the image edge.
 */

export type RedactStyle = 'blur' | 'pixelate' | 'fill'
export type RedactShape = 'oval' | 'rect'

export interface RedactLook {
  style: RedactStyle
  shape: RedactShape
  /** 0..100, ignored for fill. */
  strength: number
  /** Fill colour, default black. */
  fill?: string
}

export interface PaintBox {
  x: number
  y: number
  w: number
  h: number
}

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas

export const DEFAULT_LOOK: RedactLook = { style: 'blur', shape: 'oval', strength: 60 }

function scratchCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function ctxOf(c: AnyCanvas): Ctx2D {
  const ctx = c.getContext('2d') as Ctx2D | null
  if (!ctx) throw new Error('This browser blocked canvas access.')
  return ctx
}

/** Two reusable scratch canvases per thread. */
const pool: { a: AnyCanvas | null; b: AnyCanvas | null } = { a: null, b: null }
function scratch(key: 'a' | 'b', w: number, h: number): { c: AnyCanvas; ctx: Ctx2D } {
  let c = pool[key]
  if (!c) {
    c = scratchCanvas(w, h)
    pool[key] = c
  }
  if (c.width < w || c.height < h) {
    c.width = Math.max(c.width, w)
    c.height = Math.max(c.height, h)
  }
  const ctx = ctxOf(c)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.filter = 'none'
  return { c, ctx }
}

let filterSupport: boolean | null = null
/** Canvas `filter` is missing in some browsers; they get a scaled blur instead. */
function canFilter(): boolean {
  if (filterSupport === null) {
    const ctx = ctxOf(scratchCanvas(1, 1))
    filterSupport = typeof (ctx as { filter?: unknown }).filter === 'string'
  }
  return filterSupport
}

function clipPath(ctx: Ctx2D, b: PaintBox, shape: RedactShape) {
  ctx.beginPath()
  if (shape === 'oval') ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, Math.max(1, b.w / 2), Math.max(1, b.h / 2), 0, 0, Math.PI * 2)
  else ctx.rect(b.x, b.y, b.w, b.h)
}

/**
 * Copies the area around a box into scratch "a" with `margin` extra pixels on
 * each side. Where the margin falls outside the canvas, the stretched image
 * fills it, so a blur at the edge has no transparent pixels to pull in.
 */
function lift(ctx: Ctx2D, b: PaintBox, margin: number) {
  const src = ctx.canvas
  const x0 = Math.floor(b.x - margin)
  const y0 = Math.floor(b.y - margin)
  const w = Math.ceil(b.w + 2 * margin)
  const h = Math.ceil(b.h + 2 * margin)
  const cx0 = Math.max(0, x0)
  const cy0 = Math.max(0, y0)
  const cx1 = Math.min(src.width, x0 + w)
  const cy1 = Math.min(src.height, y0 + h)
  const s = scratch('a', w, h)
  if (cx1 <= cx0 || cy1 <= cy0) return { ...s, x0, y0, w, h }
  if (cx0 > x0 || cy0 > y0 || cx1 < x0 + w || cy1 < y0 + h) {
    s.ctx.drawImage(src, cx0, cy0, cx1 - cx0, cy1 - cy0, 0, 0, w, h)
  }
  s.ctx.drawImage(src, cx0, cy0, cx1 - cx0, cy1 - cy0, cx0 - x0, cy0 - y0, cx1 - cx0, cy1 - cy0)
  return { ...s, x0, y0, w, h }
}

function paintBlur(ctx: Ctx2D, b: PaintBox, strength: number, shape: RedactShape) {
  // CSS blur radius is the standard deviation; 3 of them reach the whole kernel.
  const radius = Math.max(2, (strength / 100) * 0.25 * Math.min(b.w, b.h))
  const src = lift(ctx, b, Math.ceil(radius * 3))
  // Blur at a reduced scale: the same look at a fixed cost. Without canvas
  // filters, the down and up scale alone gives a softer, coarser blur.
  const filter = canFilter()
  const k = filter ? Math.max(1, radius / 8) : Math.max(2, radius / 1.5)
  const sw = Math.max(1, Math.ceil(src.w / k))
  const sh = Math.max(1, Math.ceil(src.h / k))
  const out = scratch('b', sw, sh)
  out.ctx.clearRect(0, 0, sw, sh)
  out.ctx.imageSmoothingEnabled = true
  out.ctx.imageSmoothingQuality = 'high'
  if (filter) out.ctx.filter = `blur(${(radius / k).toFixed(2)}px)`
  out.ctx.drawImage(src.c, 0, 0, src.w, src.h, 0, 0, sw, sh)
  out.ctx.filter = 'none'
  ctx.save()
  clipPath(ctx, b, shape)
  ctx.clip()
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(out.c, 0, 0, sw, sh, src.x0, src.y0, src.w, src.h)
  ctx.restore()
}

function paintPixelate(ctx: Ctx2D, b: PaintBox, strength: number, shape: RedactShape) {
  const block = Math.max(2, (strength / 100) * 0.3 * Math.min(b.w, b.h))
  const src = lift(ctx, b, 0)
  const cols = Math.max(1, Math.round(src.w / block))
  const rows = Math.max(1, Math.round(src.h / block))
  const out = scratch('b', cols, rows)
  out.ctx.imageSmoothingEnabled = true
  out.ctx.imageSmoothingQuality = 'high'
  out.ctx.drawImage(src.c, 0, 0, src.w, src.h, 0, 0, cols, rows)
  ctx.save()
  clipPath(ctx, b, shape)
  ctx.clip()
  const smoothing = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(out.c, 0, 0, cols, rows, src.x0, src.y0, src.w, src.h)
  ctx.imageSmoothingEnabled = smoothing
  ctx.restore()
}

export function paintRedactions(ctx: Ctx2D, boxes: readonly PaintBox[], look: RedactLook) {
  for (const raw of boxes) {
    const b = { x: raw.x, y: raw.y, w: Math.max(1, raw.w), h: Math.max(1, raw.h) }
    if (look.style === 'fill') {
      ctx.save()
      ctx.fillStyle = look.fill ?? '#000'
      clipPath(ctx, b, look.shape)
      ctx.fill()
      ctx.restore()
    } else if (look.style === 'pixelate') {
      paintPixelate(ctx, b, look.strength, look.shape)
    } else {
      paintBlur(ctx, b, look.strength, look.shape)
    }
  }
}
