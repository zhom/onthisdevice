/**
 * Shape drawings for the stats specs: density curves with shaded areas, scatter plots and box
 * plots. Each returns ShapeProps in a box about 10 wide, so equal axes look right. Point counts
 * are fixed per drawing, so a change of inputs tweens smoothly.
 */
import type { ShapeLabel, ShapePath, ShapeProps } from './types'

const W = 10
const H = 4.2
const N = 121
const M = 49

/** A density from lo to hi with the ranges in `shade` filled. */
export function densityShape(pdf: (x: number) => number, lo: number, hi: number, shade: [number, number][], ticks: { x: number; text: string }[], summary: string): ShapeProps {
  const xs = Array.from({ length: N }, (_, k) => lo + ((hi - lo) * k) / (N - 1))
  const ys = xs.map((x) => (Number.isFinite(pdf(x)) ? pdf(x) : 0))
  const top = Math.max(...ys, 1e-12)
  const X = (x: number) => ((x - lo) / (hi - lo)) * W
  const Y = (y: number) => (Math.min(y, top) / top) * H
  const paths: ShapePath[] = shade.map(([a0, b0]) => {
    const a = Math.max(lo, Math.min(hi, a0))
    const b = Math.max(lo, Math.min(hi, b0))
    const pts: [number, number][] = Array.from({ length: M }, (_, k) => {
      const x = a + ((b - a) * k) / (M - 1)
      return [X(x), Y(pdf(x))]
    })
    return { pts: [[X(a), 0], ...pts, [X(b), 0]], closed: true, fill: 'hatch', line: 'none' }
  })
  paths.push({ pts: xs.map((x, k) => [X(x), Y(ys[k]!)]), line: 'solid', width: 2 })
  paths.push({ pts: [[0, 0], [W, 0]], line: 'grey', width: 1 })
  const labels: ShapeLabel[] = ticks.map((t) => ({ at: [X(Math.max(lo, Math.min(hi, t.x))), 0], text: t.text, dy: 14 }))
  for (const t of ticks) paths.push({ pts: [[X(Math.max(lo, Math.min(hi, t.x))), 0], [X(Math.max(lo, Math.min(hi, t.x))), Y(pdf(t.x))]], line: 'dash', width: 1 })
  return { paths, labels, summary, height: 220 }
}

/** Scatter of points with an optional fitted line y = a + b·x and a highlighted point. */
export function scatterShape(x: number[], y: number[], fit: { a: number; b: number } | null, summary: string, mark?: [number, number]): ShapeProps {
  const allX = mark ? [...x, mark[0]] : x
  const allY = mark ? [...y, mark[1]] : y
  const x0 = Math.min(...allX)
  const x1 = Math.max(...allX)
  const y0 = Math.min(...allY, fit ? fit.a + fit.b * x0 : Infinity, fit ? fit.a + fit.b * x1 : Infinity)
  const y1 = Math.max(...allY, fit ? fit.a + fit.b * x0 : -Infinity, fit ? fit.a + fit.b * x1 : -Infinity)
  const sx = (v: number) => (x1 === x0 ? W / 2 : ((v - x0) / (x1 - x0)) * W)
  const sy = (v: number) => (y1 === y0 ? 3 : ((v - y0) / (y1 - y0)) * 6)
  const paths: ShapePath[] = [
    { pts: [[0, 0], [W, 0]], line: 'grey', width: 1 },
    { pts: [[0, 0], [0, 6]], line: 'grey', width: 1 },
  ]
  if (fit) paths.push({ pts: [[0, sy(fit.a + fit.b * x0)], [W, sy(fit.a + fit.b * x1)]], line: 'dash', width: 2 })
  const dots = x.map((v, k) => [sx(v), sy(y[k]!)] as [number, number])
  const labels: ShapeLabel[] = [
    { at: [0, 0], text: fmtTick(x0), dy: 14, anchor: 'start' },
    { at: [W, 0], text: fmtTick(x1), dy: 14, anchor: 'end' },
    { at: [0, 0], text: fmtTick(y0), dx: -6, anchor: 'end' },
    { at: [0, 6], text: fmtTick(y1), dx: -6, anchor: 'end' },
  ]
  if (mark) {
    paths.push({ pts: ring(sx(mark[0]), sy(mark[1]), 0.22), closed: true, line: 'solid', width: 2 })
    labels.push({ at: [sx(mark[0]), sy(mark[1])], text: `(${fmtTick(mark[0])}, ${fmtTick(mark[1])})`, dy: -16, strong: true })
  }
  return { paths, dots, labels, summary, height: 260 }
}

/** Horizontal box plot of five numbers, outliers as dots. */
export function boxShape(min: number, q1: number, med: number, q3: number, max: number, outliers: number[], lo: number, hi: number, summary: string): ShapeProps {
  const sx = (v: number) => (hi === lo ? W / 2 : ((v - lo) / (hi - lo)) * W)
  const paths: ShapePath[] = [
    { pts: [[sx(q1), 1], [sx(q3), 1], [sx(q3), 3], [sx(q1), 3]], closed: true, fill: 'hatch', line: 'solid' },
    { pts: [[sx(med), 0.8], [sx(med), 3.2]], line: 'solid', width: 3 },
    { pts: [[sx(min), 2], [sx(q1), 2]], line: 'solid' },
    { pts: [[sx(q3), 2], [sx(max), 2]], line: 'solid' },
    { pts: [[sx(min), 1.5], [sx(min), 2.5]], line: 'solid' },
    { pts: [[sx(max), 1.5], [sx(max), 2.5]], line: 'solid' },
    { pts: [[0, 0], [W, 0]], line: 'grey', width: 1 },
  ]
  const labels: ShapeLabel[] = [
    { at: [sx(q1), 3], text: `Q1 ${fmtTick(q1)}`, dy: -12 },
    { at: [sx(q3), 3], text: `Q3 ${fmtTick(q3)}`, dy: -12 },
    { at: [sx(med), 0.8], text: `median ${fmtTick(med)}`, dy: 14, strong: true },
    { at: [sx(min), 0], text: fmtTick(min), dy: 14 },
    { at: [sx(max), 0], text: fmtTick(max), dy: 14 },
  ]
  return { paths, labels, dots: outliers.map((o) => [sx(o), 2] as [number, number]), summary, height: 180 }
}

function ring(cx: number, cy: number, r: number): [number, number][] {
  return Array.from({ length: 24 }, (_, k) => [cx + r * Math.cos((k / 24) * 2 * Math.PI), cy + r * Math.sin((k / 24) * 2 * Math.PI)])
}

export function fmtTick(v: number): string {
  if (!Number.isFinite(v)) return '–'
  const a = Math.abs(v)
  const s = a >= 1e5 || (a > 0 && a < 1e-3) ? v.toExponential(2) : String(Number(v.toPrecision(4)))
  return s.replace('-', '−')
}
