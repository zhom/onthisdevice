/** Small canvas drawing helpers shared by the calc2 simulations. */

/** A line with a filled arrowhead at (x2, y2). Skips arrows shorter than 1 px. */
export function arrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 2,
  head = 7,
): void {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 1) return
  const ux = dx / len
  const uy = dy / len
  const h = Math.min(head, len * 0.6)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2 - ux * h * 0.8, y2 - uy * h * 0.8)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - ux * h - uy * h * 0.55, y2 - uy * h + ux * h * 0.55)
  ctx.lineTo(x2 - ux * h + uy * h * 0.55, y2 - uy * h - ux * h * 0.55)
  ctx.closePath()
  ctx.fill()
}

/** Text with a paper-coloured halo so it stays readable over lines. */
export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { color: string; halo: string; font: string; size?: number; weight?: number; align?: CanvasTextAlign; base?: CanvasTextBaseline },
): void {
  const { color, halo, font, size = 12, weight = 560, align = 'left', base = 'alphabetic' } = opts
  ctx.font = `${weight} ${size}px ${font}`
  ctx.textAlign = align
  ctx.textBaseline = base
  ctx.lineJoin = 'round'
  ctx.lineWidth = 4
  ctx.strokeStyle = halo
  ctx.strokeText(text, x, y)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}

/** A dashed straight line. */
export function dashed(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
  dash: number[] = [4, 4],
): void {
  ctx.save()
  ctx.setLineDash(dash)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}

/** A filled circle. */
export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

export interface Fit {
  /** World x to canvas x. */
  x: (v: number) => number
  /** World y (up) to canvas y (down). */
  y: (v: number) => number
  /** Pixels per world unit, the same on both axes. */
  k: number
}

/**
 * Fit a world box into a canvas with one scale for both axes, so shapes and
 * paths are drawn to scale. `pad` is [top, right, bottom, left] in px.
 */
export function fitEqual(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  w: number,
  h: number,
  pad: [number, number, number, number] = [16, 16, 16, 16],
): Fit {
  const [pt, pr, pb, pl] = pad
  const iw = Math.max(1, w - pl - pr)
  const ih = Math.max(1, h - pt - pb)
  const dx = Math.max(1e-9, x1 - x0)
  const dy = Math.max(1e-9, y1 - y0)
  const k = Math.min(iw / dx, ih / dy)
  const ox = pl + (iw - dx * k) / 2
  const oy = pt + ih - (ih - dy * k) / 2
  return { x: (v) => ox + (v - x0) * k, y: (v) => oy - (v - y0) * k, k }
}
