/** A coordinate grid on a canvas, drawn to one scale on both axes. */
import { niceDomain } from '@/components/viz/scale'
import { fitEqual, label } from './_viz/draw'
import type { Fit } from './_viz/draw'
import { fmt } from './_viz/format'
import type { Ink } from './_viz/hooks'

export interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
}

/** A box around the points with a margin; takes in the origin when it is near. */
export function boxAround(pts: { x: number; y: number }[], margin = 0.18): Box {
  let x0 = Math.min(...pts.map((p) => p.x))
  let x1 = Math.max(...pts.map((p) => p.x))
  let y0 = Math.min(...pts.map((p) => p.y))
  let y1 = Math.max(...pts.map((p) => p.y))
  const span = Math.max(x1 - x0, y1 - y0, 1e-9)
  if (Math.abs(x0) < span * 2 || Math.abs(x1) < span * 2) {
    x0 = Math.min(x0, 0)
    x1 = Math.max(x1, 0)
  }
  if (Math.abs(y0) < span * 2 || Math.abs(y1) < span * 2) {
    y0 = Math.min(y0, 0)
    y1 = Math.max(y1, 0)
  }
  const s = Math.max(x1 - x0, y1 - y0, 1e-9)
  const m = s * margin
  return { x0: x0 - m, x1: x1 + m, y0: y0 - m, y1: y1 + m }
}

/** Paint grid lines, axes and tick labels; returns the world-to-canvas map. */
export function paintGrid(ctx: CanvasRenderingContext2D, w: number, h: number, b: Box, ink: Ink): Fit {
  const fit = fitEqual(b.x0, b.x1, b.y0, b.y1, w, h, [14, 14, 14, 14])
  // the visible world box after fitting (one scale fills one axis only)
  const vx0 = b.x0 - (fit.x(b.x0) - 0) / fit.k
  const vx1 = b.x1 + (w - fit.x(b.x1)) / fit.k
  const vy0 = b.y0 - (h - fit.y(b.y0)) / fit.k
  const vy1 = b.y1 + fit.y(b.y1) / fit.k
  const step = niceDomain(0, Math.max(vx1 - vx0, vy1 - vy0), 8).ticks
  const d = (step[1] ?? 1) - (step[0] ?? 0) || 1
  ctx.strokeStyle = ink.paper
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let v = Math.ceil(vx0 / d) * d; v <= vx1; v += d) {
    ctx.moveTo(Math.round(fit.x(v)) + 0.5, 0)
    ctx.lineTo(Math.round(fit.x(v)) + 0.5, h)
  }
  for (let v = Math.ceil(vy0 / d) * d; v <= vy1; v += d) {
    ctx.moveTo(0, Math.round(fit.y(v)) + 0.5)
    ctx.lineTo(w, Math.round(fit.y(v)) + 0.5)
  }
  ctx.stroke()
  // axes
  ctx.strokeStyle = ink.grey
  ctx.beginPath()
  if (vy0 <= 0 && vy1 >= 0) {
    ctx.moveTo(0, fit.y(0))
    ctx.lineTo(w, fit.y(0))
  }
  if (vx0 <= 0 && vx1 >= 0) {
    ctx.moveTo(fit.x(0), 0)
    ctx.lineTo(fit.x(0), h)
  }
  ctx.stroke()
  const tx = { color: ink.grey, halo: ink.fill, font: ink.font, size: 10.5, weight: 520 }
  const ay = vy0 <= 0 && vy1 >= 0 ? fit.y(0) : h - 4
  const ax = vx0 <= 0 && vx1 >= 0 ? fit.x(0) : 4
  const every = fit.k * d < 28 ? 2 : 1
  let i = 0
  for (let v = Math.ceil(vx0 / d) * d; v <= vx1; v += d, i++) {
    if (Math.abs(v) < d / 2 || i % every) continue
    const x = fit.x(v)
    if (x < 12 || x > w - 12) continue
    label(ctx, fmt(v, 6), x, Math.min(h - 4, ay + 13), { ...tx, align: 'center' })
  }
  i = 0
  for (let v = Math.ceil(vy0 / d) * d; v <= vy1; v += d, i++) {
    if (Math.abs(v) < d / 2 || i % every) continue
    const y = fit.y(v)
    if (y < 10 || y > h - 10) continue
    label(ctx, fmt(v, 6), ax + 5, y + 4, { ...tx, align: 'left' })
  }
  return fit
}

/** Oblique (cabinet) view of math axes: x to the right, y into the page, z up. */
export function oblique(x: number, y: number, z: number): { x: number; y: number } {
  return { x: x + 0.45 * y, y: z + 0.32 * y }
}
