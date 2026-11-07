/**
 * Builds the output picture from the photo and the subject mask: the cut-out subject on a
 * transparent, coloured, blurred or picture background, framed as the photo, the subject, a
 * square or a circle, with an optional outline (stickers) and shadow (product photos).
 */

export type Background =
  | { kind: 'transparent' }
  | { kind: 'color'; color: string }
  | { kind: 'blur'; strength: number }
  | { kind: 'image'; image: ImageBitmap }

/** original: the photo's own frame. subject: tight around the subject. square, circle: centred on it. */
export type Frame = 'original' | 'subject' | 'square' | 'circle'

export interface Look {
  background: Background
  frame: Frame
  /** Space around the subject for the subject, square and circle frames, as a share of its size. */
  margin: number
  /** Outline width as a share of the subject's longer side; 0 for none. */
  outline: number
  outlineColor: string
  shadow: boolean
  /** Longest side of the output in pixels; 0 keeps the size of the photo. */
  maxSide: number
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Your browser blocked canvas drawing, so the image cannot be made.')
  return ctx
}

/**
 * The model mask (size x size) as an alpha canvas at the photo size. Alpha below 6 % becomes
 * 0 and above 94 % becomes 255, which removes faint haze around the subject.
 */
export function maskToAlpha(mask: Uint8ClampedArray, size: number, w: number, h: number): HTMLCanvasElement {
  const small = canvas(size, size)
  const img = new ImageData(size, size)
  const lo = 0.06 * 255
  const span = 0.88 * 255
  for (let i = 0; i < mask.length; i++) {
    const a = Math.min(255, Math.max(0, ((mask[i] - lo) / span) * 255))
    img.data[i * 4 + 3] = a
  }
  ctx2d(small).putImageData(img, 0, 0)
  const out = canvas(w, h)
  const ctx = ctx2d(out)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, 0, 0, w, h)
  return out
}

/** Bounding box of the subject in photo pixels, or null when the mask is empty. */
export function subjectBox(mask: Uint8ClampedArray, size: number, w: number, h: number): Box | null {
  let x0 = size
  let y0 = size
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[y * size + x] < 128) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (x1 < 0) return null
  const sx = w / size
  const sy = h / size
  return { x: x0 * sx, y: y0 * sy, w: (x1 - x0 + 1) * sx, h: (y1 - y0 + 1) * sy }
}

/** Share of the picture that the subject covers, 0..1. */
export function coverage(mask: Uint8ClampedArray): number {
  let n = 0
  for (let i = 0; i < mask.length; i++) if (mask[i] >= 128) n++
  return n / mask.length
}

/** Three box blur passes on RGBA, separable, in place. */
function boxBlur(img: ImageData, r: number) {
  const { width: w, height: h, data } = img
  const tmp = new Float32Array(data.length)
  const pass = (src: Uint8ClampedArray | Float32Array, dst: Uint8ClampedArray | Float32Array, horizontal: boolean) => {
    const outer = horizontal ? h : w
    const inner = horizontal ? w : h
    const step = horizontal ? 4 : w * 4
    const norm = 1 / (2 * r + 1)
    for (let o = 0; o < outer; o++) {
      const base = horizontal ? o * w * 4 : o * 4
      for (let c = 0; c < 4; c++) {
        let sum = 0
        for (let k = -r; k <= r; k++) sum += src[base + Math.min(inner - 1, Math.max(0, k)) * step + c]
        for (let i = 0; i < inner; i++) {
          dst[base + i * step + c] = sum * norm
          const add = Math.min(inner - 1, i + r + 1)
          const sub = Math.max(0, i - r)
          sum += src[base + add * step + c] - src[base + sub * step + c]
        }
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    pass(data, tmp, true)
    pass(tmp, data, false)
  }
}

/** A soft blur of `src` with a radius in its own pixels; done on a small copy, so it is fast. */
export function softBlur(src: CanvasImageSource & { width: number; height: number }, radius: number): HTMLCanvasElement {
  const w = src.width
  const h = src.height
  const scale = Math.min(1, 6 / Math.max(1, radius))
  const sw = Math.max(1, Math.round(w * scale))
  const sh = Math.max(1, Math.round(h * scale))
  const small = canvas(sw, sh)
  const sctx = ctx2d(small)
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(src, 0, 0, sw, sh)
  const img = sctx.getImageData(0, 0, sw, sh)
  boxBlur(img, Math.max(1, Math.round(radius * scale * 0.6)))
  sctx.putImageData(img, 0, 0)
  const out = canvas(w, h)
  const octx = ctx2d(out)
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(small, 0, 0, w, h)
  return out
}

/** The subject alone on a transparent canvas of the photo size. */
export function cutOut(photo: ImageBitmap, alpha: HTMLCanvasElement): HTMLCanvasElement {
  const out = canvas(photo.width, photo.height)
  const ctx = ctx2d(out)
  ctx.drawImage(photo, 0, 0)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(alpha, 0, 0)
  return out
}

/** A silhouette of the alpha in one colour. */
function silhouette(alpha: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const out = canvas(alpha.width, alpha.height)
  const ctx = ctx2d(out)
  ctx.drawImage(alpha, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, out.width, out.height)
  return out
}

function frameRect(look: Look, box: Box | null, w: number, h: number, pad: number): Box {
  if (look.frame === 'original' || !box) return { x: 0, y: 0, w, h }
  const m = look.margin * Math.max(box.w, box.h) + pad
  if (look.frame === 'subject') return { x: box.x - m, y: box.y - m, w: box.w + 2 * m, h: box.h + 2 * m }
  // A square that stays inside the photo where it can, so the subject is not cut at an edge.
  const side = Math.min(Math.max(box.w, box.h) + 2 * m, Math.max(w, h))
  const fit = (centre: number, length: number) => {
    const start = centre - side / 2
    return side <= length ? Math.min(Math.max(start, 0), length - side) : (length - side) / 2
  }
  return { x: fit(box.x + box.w / 2, w), y: fit(box.y + box.h / 2, h), w: side, h: side }
}

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height)
  const dw = img.width * s
  const dh = img.height * s
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

export function compose(photo: ImageBitmap, alpha: HTMLCanvasElement, box: Box | null, look: Look): HTMLCanvasElement {
  const w = photo.width
  const h = photo.height
  const subjectSide = box ? Math.max(box.w, box.h) : Math.max(w, h)
  const outlinePx = look.outline > 0 ? Math.max(2, look.outline * subjectSide) : 0
  const rect = frameRect(look, box, w, h, outlinePx)
  const scale = look.maxSide > 0 ? Math.min(4, look.maxSide / Math.max(rect.w, rect.h)) : 1
  const out = canvas(rect.w * scale, rect.h * scale)
  const ctx = ctx2d(out)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // Photo coordinates to output coordinates.
  const place = (draw: () => void) => {
    ctx.save()
    ctx.scale(scale, scale)
    ctx.translate(-rect.x, -rect.y)
    draw()
    ctx.restore()
  }

  const bg = look.background
  if (bg.kind === 'color') {
    ctx.fillStyle = bg.color
    ctx.fillRect(0, 0, out.width, out.height)
  } else if (bg.kind === 'image') {
    drawCover(ctx, bg.image, out.width, out.height)
  } else if (bg.kind === 'blur') {
    const blurred = softBlur(photo, bg.strength * Math.max(w, h))
    if (look.frame === 'original') place(() => ctx.drawImage(blurred, 0, 0))
    else drawCover(ctx, blurred, out.width, out.height)
  }

  if (look.shadow && box) {
    // A soft oval under the subject, as on a table.
    place(() => {
      const cx = box.x + box.w / 2
      const cy = box.y + box.h
      const rx = box.w * 0.48
      const ry = Math.max(4, box.h * 0.05)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(1, ry / rx)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
      g.addColorStop(0, 'rgba(0,0,0,0.30)')
      g.addColorStop(0.6, 'rgba(0,0,0,0.12)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, rx, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })
  }

  if (outlinePx > 0) {
    const ring = silhouette(alpha, look.outlineColor)
    place(() => {
      const steps = 32
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2
        ctx.drawImage(ring, Math.cos(a) * outlinePx, Math.sin(a) * outlinePx)
      }
      ctx.drawImage(ring, 0, 0)
    })
  }

  const cut = cutOut(photo, alpha)
  place(() => ctx.drawImage(cut, 0, 0))

  if (look.frame === 'circle') {
    ctx.globalCompositeOperation = 'destination-in'
    ctx.beginPath()
    ctx.arc(out.width / 2, out.height / 2, Math.min(out.width, out.height) / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }
  return out
}
