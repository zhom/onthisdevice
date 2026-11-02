import { useMemo } from 'react'
import { CalcLayout, NumField, Result, Row, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { arrow, dot, label } from './_viz/draw'
import { dec, fmt, num, sub } from './_viz/format'
import type { Ink } from './_viz/hooks'
import { boxAround, paintGrid } from './geo-grid'
import { phase, useTimeline } from './geo-anim'
import { fraction, slope } from './lines'
import type { Pt, Slope } from './lines'

const END = 2.9

/** "3", "3/2", "−1/4" or the decimal. */
function slopeText(s: Slope): string {
  if (s.m === null) return 'undefined'
  const fr = fraction(s.dy, s.dx)
  if (fr && fr.d !== 1 && fr.d <= 1000) return `${fr.n < 0 ? '−' : ''}${Math.abs(fr.n)}/${fr.d}`
  return fmt(s.m, 10)
}

/** "y = 3x − 1" */
function interceptForm(s: Slope): string {
  if (s.m === null) return ''
  const mx = s.m === 0 ? '' : s.m === 1 ? 'x' : s.m === -1 ? '−x' : `${slopeText(s)}x`
  const b = s.b ?? 0
  if (!mx) return `y = ${fmt(b, 10)}`
  if (b === 0) return `y = ${mx}`
  return `y = ${mx} ${b < 0 ? '−' : '+'} ${fmt(Math.abs(b), 10)}`
}

function standardForm(s: Slope): string {
  const t = (c: number, v: string, first: boolean) => {
    if (c === 0) return ''
    const mag = Math.abs(c) === 1 ? v : `${fmt(Math.abs(c), 10)}${v}`
    return first ? `${c < 0 ? '−' : ''}${mag}` : ` ${c < 0 ? '−' : '+'} ${mag}`
  }
  const left = `${t(s.A, 'x', true)}${t(s.B, 'y', s.A === 0)}`
  return `${left} = ${fmt(s.C, 10)}`
}

export default function SlopeCalculator() {
  const f = useFields({ x1: '1', y1: '2', x2: '3', y2: '8' })
  const { x1, y1, x2, y2 } = f.num
  const missing = [x1, y1, x2, y2].some((v) => v === null)
  const same = !missing && x1 === x2 && y1 === y2
  const error = missing ? 'Enter both coordinates of both points.' : same ? 'The two points are the same, so they do not define a line.' : null
  const p1: Pt | null = !error ? { x: x1!, y: y1! } : null
  const p2: Pt | null = !error ? { x: x2!, y: y2! } : null
  const s = useMemo(() => (p1 && p2 ? slope(p1, p2) : null), [p1?.x, p1?.y, p2?.x, p2?.y])

  const tl = useTimeline((p, ink, t) => s && p1 && p2 && paintSlope(p.ctx, p.w, p.h, p1, p2, s, t, ink), {
    key: Object.values(f.raw).join('|'),
    still: END,
    end: END,
  })

  const working =
    s && p1 && p2
      ? [
          'm = (y₂ − y₁) ÷ (x₂ − x₁)',
          `  = (${num(p2.y)} − ${sub(p1.y)}) ÷ (${num(p2.x)} − ${sub(p1.x)})`,
          `  = ${num(s.dy)} ÷ ${num(s.dx)}${s.m === null ? '  (division by zero: vertical line)' : ` = ${slopeText(s)}${slopeText(s).includes('/') ? ` = ${num(s.m)}` : ''}`}`,
          ...(s.m !== null
            ? [
                'b = y₁ − m x₁',
                `  = ${num(p1.y)} − ${sub(s.m)} × ${sub(p1.x)} = ${num(s.b!)}`,
                `slope-intercept: ${interceptForm(s)}`,
                `point-slope:     y − ${sub(p1.y)} = ${slopeText(s)}(x − ${sub(p1.x)})`,
                `standard:        ${standardForm(s)}`,
                `angle = arctan(${num(s.m)}) = ${num(s.angle, 6)}°`,
              ]
            : [`vertical line: x = ${num(p1.x)}`, 'angle = 90°']),
        ]
      : []

  return (
    <CalcLayout
      inputs={
        <>
          <Row>
            <NumField label="x₁" {...f.bind('x1')} />
            <NumField label="y₁" {...f.bind('y1')} />
          </Row>
          <Row>
            <NumField label="x₂" {...f.bind('x2')} />
            <NumField label="y₂" {...f.bind('y2')} />
          </Row>
        </>
      }
      result={
        <Result
          label="Slope m"
          value={s ? slopeText(s) : '–'}
          sub={s ? (s.m === null ? `Vertical line: x = ${fmt(p1!.x, 10)}` : interceptForm(s)) : undefined}
          error={error}
          copy={s ? `m = ${slopeText(s)}${s.m !== null ? `, ${interceptForm(s)}` : ''}` : undefined}
        >
          {s ? (
            <>
              <Stat label="Rise Δy" value={s.dy} format={(v) => fmt(v, 10)} />
              <Stat label="Run Δx" value={s.dx} format={(v) => fmt(v, 10)} />
              <Stat label="Angle" value={s.angle} format={(v) => dec(v, 3)} unit="°" />
              <Stat label="Grade" value={s.m === null ? 'undefined' : `${dec(s.m * 100, 2)}%`} />
              <Stat label="y-intercept" value={s.b === null ? 'none' : fmt(s.b, 10)} />
              <Stat label="Standard form" value={standardForm(s)} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage
          summary={
            s && p1 && p2
              ? s.m === null
                ? `The points (${fmt(p1.x)}, ${fmt(p1.y)}) and (${fmt(p2.x)}, ${fmt(p2.y)}) lie on the vertical line x = ${fmt(p1.x)}; the run is zero, so the slope is undefined.`
                : `The line through (${fmt(p1.x)}, ${fmt(p1.y)}) and (${fmt(p2.x)}, ${fmt(p2.y)}). From the first point, it runs ${fmt(s.dx)} across and rises ${fmt(s.dy)}, so the slope is ${slopeText(s)} and the line makes ${dec(s.angle, 2)}° with the x axis.`
              : 'Enter two points to draw the line.'
          }
          bar={<SimBar playing={tl.playing} onPlaying={tl.setPlaying} onReplay={tl.replay} reduced={tl.reduced} />}
        >
          <canvas ref={tl.canvas} className="block aspect-square w-full sm:aspect-[16/11]" role="img" aria-label={s ? `Line with slope ${slopeText(s)}` : 'Line graph'} />
        </Stage>
      }
      working={working.length ? <Working lines={working} /> : null}
    />
  )
}

function paintSlope(ctx: CanvasRenderingContext2D, w: number, h: number, p1: Pt, p2: Pt, s: Slope, t: number, ink: Ink) {
  const fit = paintGrid(ctx, w, h, boxAround([p1, p2]), ink)
  const txt = { color: ink.ink, halo: ink.fill, font: ink.font, size: 12, weight: 650 }
  const P = (p: Pt) => ({ x: fit.x(p.x), y: fit.y(p.y) })
  const a = P(p1)
  const b = P(p2)
  // the line, growing out from the first point in both directions
  const grow = phase(t, 0.05, 0.7)
  const ux = b.x - a.x
  const uy = b.y - a.y
  const len = Math.hypot(ux, uy)
  const far = (Math.hypot(w, h) / len) * grow
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(a.x - ux * far, a.y - uy * far)
  ctx.lineTo(a.x + ux * far, a.y + uy * far)
  ctx.stroke()

  // run, then rise
  const c = { x: b.x, y: a.y }
  const run = phase(t, 0.8, 0.55)
  const rise = phase(t, 1.4, 0.55)
  if (s.dx !== 0 && run > 0) {
    arrow(ctx, a.x, a.y, a.x + (c.x - a.x) * run, c.y, ink.grey, 2, 7)
    if (run > 0.9) label(ctx, `run ${fmt(s.dx, 6)}`, (a.x + c.x) / 2, c.y + (s.dy >= 0 ? 17 : -9), { ...txt, color: ink.grey, align: 'center' })
  }
  if (s.dx !== 0 && rise > 0 && Math.abs(s.dy) > 0) {
    arrow(ctx, c.x, c.y, c.x, c.y + (b.y - c.y) * rise, ink.grey, 2, 7)
    if (rise > 0.9) label(ctx, `rise ${fmt(s.dy, 6)}`, c.x + (s.dx >= 0 ? 8 : -8), (c.y + b.y) / 2 + 4, { ...txt, color: ink.grey, align: s.dx >= 0 ? 'left' : 'right' })
  }
  // angle arc at the first point
  const ang = phase(t, 2.0, 0.5)
  if (ang > 0 && s.m !== null && s.dy !== 0) {
    const r = Math.min(34, Math.abs(c.x - a.x) * 0.6)
    const dir = s.dx >= 0 ? 0 : Math.PI
    const to = Math.atan2(b.y - a.y, b.x - a.x)
    let sweep = to - dir
    if (sweep > Math.PI) sweep -= 2 * Math.PI
    if (sweep < -Math.PI) sweep += 2 * Math.PI
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(a.x, a.y, r, dir, dir + sweep * ang, sweep < 0)
    ctx.stroke()
  }
  // intercept and points
  if (s.b !== null && phase(t, 2.3, 0.3) > 0) {
    const yi = fit.y(s.b)
    if (yi > 0 && yi < h) dot(ctx, fit.x(0), yi, 4, ink.grey)
  }
  const pop = phase(t, 0.1, 0.3)
  dot(ctx, a.x, a.y, 5.5 * pop, ink.ink)
  dot(ctx, b.x, b.y, 5.5 * pop, ink.ink)
  if (pop > 0.9) {
    const side = (q: { x: number; y: number }, o: { x: number }) => (q.x >= o.x ? 'left' : 'right') as CanvasTextAlign
    label(ctx, `(${fmt(p1.x, 6)}, ${fmt(p1.y, 6)})`, a.x + (a.x >= b.x ? 9 : -9), a.y - 9, { ...txt, align: side(a, b) })
    label(ctx, `(${fmt(p2.x, 6)}, ${fmt(p2.y, 6)})`, b.x + (b.x >= a.x ? 9 : -9), b.y - 9, { ...txt, align: side(b, a) })
  }
  if (phase(t, 2.4, 0.4) > 0.5 && s.m !== null) {
    label(ctx, `m = ${slopeText(s)}`, 14, 22, { ...txt, size: 14, weight: 700 })
  }
}
