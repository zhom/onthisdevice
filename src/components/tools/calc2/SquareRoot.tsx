import { useMemo } from 'react'
import { CalcLayout, NumField, Result, Row, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { dashed, dot, fitEqual, label } from './_viz/draw'
import { fmt, num } from './_viz/format'
import type { Ink } from './_viz/hooks'
import { lerp, phase, useTimeline } from './geo-anim'
import { factorize, powerForm } from './primes'
import { newton, nthRoot, radicalText, rootSign, simplifyRadical } from './roots'

const SHAPE_END = 1.7
const HOP = 0.5

export default function SquareRoot() {
  const f = useFields({ x: '72', n: '2' })
  const { x, n } = f.num
  const errN = n === null ? 'Enter the root index.' : !Number.isInteger(n) || n < 2 || n > 100 ? 'Use a whole number from 2 to 100.' : null
  const errX =
    x === null ? 'Enter a number.' : Math.abs(x) > 1e300 ? 'Use a number below 10³⁰⁰.' : x < 0 && n !== null && n % 2 === 0 ? 'An even root of a negative number is not a real number.' : null

  const data = useMemo(() => {
    if (errN || errX || x === null || n === null) return null
    const root = nthRoot(x, n)
    const rad = simplifyRadical(x, n)
    const steps = newton(x, n)
    return { x, n, root, rad, steps }
  }, [x, n, errN, errX])

  const sign = n !== null && !errN ? rootSign(n) : '√'
  const end = data ? SHAPE_END + data.steps.length * HOP + 0.4 : 1
  const tl = useTimeline((p, ink, t) => data && paintRoot(p.ctx, p.w, p.h, data, t, ink), { key: `${f.raw.x}|${f.raw.n}`, still: end, end })

  let sub: string | undefined
  if (data) {
    const r = data.rad
    const head = `${sign}${fmt(data.x, 12)}`
    if (r && r.inside === 1) sub = `${head} = ${radicalText(r, data.n)} exactly`
    else if (r && r.outside !== 1) sub = `${head} = ${radicalText(r, data.n)} in simplest radical form`
    else if (r) sub = `${head} is already in simplest radical form`
  }

  const working: string[] = []
  if (data) {
    const r = data.rad
    if (r && Math.abs(data.x) >= 2) {
      const fac = factorize(BigInt(Math.abs(data.x)))
      working.push(`${Math.abs(data.x)} = ${powerForm(fac)}`)
      if (r.outside !== 1)
        working.push(`${sign}${Math.abs(data.x)} = ${sign}(${r.outside}${data.n === 2 ? '²' : data.n === 3 ? '³' : `^${data.n}`} × ${r.inside}) = ${radicalText({ ...r, sign: 1 }, data.n)}`)
      working.push('')
    }
    const k = data.n
    working.push(`Newton: y ← ((n − 1) y + x ÷ y^(n − 1)) ÷ n,  n = ${k},  x = ${num(Math.abs(data.x), 12)}`)
    data.steps.slice(0, 12).forEach((y, i) => working.push(`y${String(i).replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[Number(c)] ?? c)} = ${num(Math.abs(y), 15)}`))
    if (data.steps.length > 12) working.push(`… ${data.steps.length - 12} more steps`)
    if (data.x < 0) working.push(`odd root of a negative number: ${sign}${num(data.x, 12)} = −${sign}${num(-data.x, 12)} = ${num(data.root, 15)}`)
    working.push(`check: (${num(data.root, 12)})${k === 2 ? '²' : k === 3 ? '³' : `^${k}`} = ${num(Math.pow(data.root, k), 12)}`)
  }

  return (
    <CalcLayout
      inputs={
        <Row>
          <NumField label="Number x" {...f.bind('x')} error={errX} />
          <NumField label="Root index n" {...f.bind('n')} inputMode="numeric" error={errN} hint="2 square, 3 cube" />
        </Row>
      }
      result={
        <Result
          label={`${sign}${data ? fmt(data.x, 12) : 'x'}`}
          value={data ? data.root : '–'}
          format={(v) => fmt(v, 12)}
          sub={sub}
          error={errX ?? errN}
          copy={data ? `${sign}${data.x} = ${fmt(data.root, 15)}` : undefined}
        >
          {data ? (
            <>
              <Stat label="As a power" value={`${fmt(data.x, 8)}^(1/${data.n})`} />
              <Stat label="Newton steps" value={String(data.steps.length - 1)} />
              {data.rad ? <Stat label="Simplest radical form" value={radicalText(data.rad, data.n)} /> : null}
              <Stat label="Perfect power?" value={data.rad?.inside === 1 ? 'Yes' : 'No'} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage
          summary={
            data
              ? `${data.n === 2 ? `A square with an area of ${fmt(Math.abs(data.x), 8)} has sides of ${fmt(Math.abs(data.root), 8)}. ` : data.n === 3 ? `A cube with a volume of ${fmt(Math.abs(data.x), 8)} has edges of ${fmt(Math.abs(data.root), 8)}. ` : ''}Below, Newton’s method starts at ${fmt(Math.abs(data.steps[0] ?? 0), 6)} and reaches ${fmt(Math.abs(data.root), 10)} in ${data.steps.length - 1} steps; the scale is logarithmic.`
              : 'Enter a number and a root index.'
          }
          bar={<SimBar playing={tl.playing} onPlaying={tl.setPlaying} onReplay={tl.replay} reduced={tl.reduced} />}
        >
          <canvas ref={tl.canvas} className="block aspect-[4/3] w-full sm:aspect-[16/10]" role="img" aria-label={data ? `${sign}${data.x} = ${fmt(data.root, 8)}` : 'Root diagram'} />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="Pull out every group of n equal primes, then refine the decimal with Newton’s method." /> : null}
    />
  )
}

interface RootData {
  x: number
  n: number
  root: number
  steps: number[]
}

function paintRoot(ctx: CanvasRenderingContext2D, w: number, h: number, d: RootData, t: number, ink: Ink) {
  const shapeH = d.n <= 3 ? h * 0.62 : 0
  const ax = Math.abs(d.x)
  const s = Math.abs(d.root)
  const txt = { color: ink.ink, halo: ink.fill, font: ink.font }

  if (d.n === 2 && s > 0) {
    const grow = phase(t, 0.1, 0.9)
    const fit = fitEqual(0, s, 0, s, w, shapeH, [18, 18, 34, 18])
    const side = s * grow
    // unit grid when it is readable
    ctx.fillStyle = ink.paper
    ctx.fillRect(fit.x(0), fit.y(side), side * fit.k, side * fit.k)
    if (s <= 24 && fit.k >= 6) {
      ctx.strokeStyle = ink.hairline
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 1; i < side; i++) {
        ctx.moveTo(fit.x(i), fit.y(0))
        ctx.lineTo(fit.x(i), fit.y(side))
        ctx.moveTo(fit.x(0), fit.y(i))
        ctx.lineTo(fit.x(side), fit.y(i))
      }
      ctx.stroke()
    }
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 2
    ctx.strokeRect(fit.x(0), fit.y(side), side * fit.k, side * fit.k)
    if (grow > 0.6) label(ctx, `area ${fmt(ax, 6)}`, fit.x(side / 2), fit.y(side / 2) + 4, { ...txt, halo: ink.paper, size: 13, weight: 650, align: 'center' })
    const m = phase(t, 1.0, 0.6)
    if (m > 0) {
      const y = fit.y(0) + 14
      ctx.strokeStyle = ink.ink
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(fit.x(0), y)
      ctx.lineTo(fit.x(s * m), y)
      ctx.stroke()
      label(ctx, `side ${fmt(s, 6)}`, fit.x(s / 2), y + 15, { ...txt, size: 12, align: 'center' })
    }
  } else if (d.n === 3 && s > 0) {
    // an oblique cube: front face plus a receding top and side
    const grow = phase(t, 0.1, 0.9)
    const k = 0.45
    const fit = fitEqual(0, s * (1 + k * 0.8), 0, s * (1 + k * 0.6), w, shapeH, [18, 18, 34, 18])
    const e = s * grow
    const ox = e * k * 0.8
    const oy = e * k * 0.6
    const P = (x: number, y: number) => [fit.x(x), fit.y(y)] as const
    const poly = (pts: (readonly [number, number])[], fill: string) => {
      ctx.beginPath()
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
      ctx.closePath()
      ctx.fillStyle = fill
      ctx.fill()
      ctx.strokeStyle = ink.ink
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
    poly([P(0, e), P(ox, e + oy), P(e + ox, e + oy), P(e, e)], ink.paper)
    poly([P(e, 0), P(e + ox, oy), P(e + ox, e + oy), P(e, e)], ink.hairline)
    poly([P(0, 0), P(e, 0), P(e, e), P(0, e)], ink.paper)
    if (grow > 0.6) label(ctx, `volume ${fmt(ax, 6)}`, fit.x(e / 2), fit.y(e / 2) + 4, { ...txt, halo: ink.paper, size: 13, weight: 650, align: 'center' })
    const m = phase(t, 1.0, 0.6)
    if (m > 0) {
      const y = fit.y(0) + 14
      ctx.strokeStyle = ink.ink
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(fit.x(0), y)
      ctx.lineTo(fit.x(s * m), y)
      ctx.stroke()
      label(ctx, `edge ${fmt(s, 6)}`, fit.x(s / 2), y + 15, { ...txt, size: 12, align: 'center' })
    }
  }

  // Newton's method on a log scale
  const ys = d.steps.map(Math.abs).filter((v) => v > 0)
  if (!ys.length) return
  const lo = Math.log10(Math.min(...ys))
  const hi = Math.log10(Math.max(...ys))
  const span = Math.max(hi - lo, 0.05)
  const L = 24
  const R = w - 24
  const X = (v: number) => L + ((Math.log10(v) - (lo - span * 0.06)) / (span * 1.12)) * (R - L)
  const lineY = shapeH + (h - shapeH) * 0.55
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(L, lineY)
  ctx.lineTo(R, lineY)
  ctx.stroke()
  label(ctx, 'Newton’s method', L, shapeH + 16, { color: ink.grey, halo: ink.fill, font: ink.font, size: 12 })
  dashed(ctx, X(s), lineY - 18, X(s), lineY + 18, ink.ink, 1, [3, 3])
  label(ctx, fmt(s, 8), X(s), lineY + 32, { ...txt, size: 12, weight: 650, align: X(s) > w - 60 ? 'right' : X(s) < 60 ? 'left' : 'center' })

  const start = d.n <= 3 ? SHAPE_END : 0.2
  const k = Math.max(0, Math.min(ys.length - 1, Math.floor((t - start) / HOP)))
  if (t < start) return
  for (let i = 0; i <= k; i++) dot(ctx, X(ys[i]!), lineY, 3, ink.grey)
  const within = Math.min(1, (t - start - k * HOP) / (HOP * 0.7))
  const a = ys[k]!
  const b = ys[Math.min(k + 1, ys.length - 1)]!
  const cur = k + 1 < ys.length ? Math.pow(10, lerp(Math.log10(a), Math.log10(b), phase(within, 0, 1))) : a
  dot(ctx, X(cur), lineY, 6, ink.ink)
  const sub = (i: number) => String(i).replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[Number(c)] ?? c)
  const idx = k + 1 < ys.length && within > 0.5 ? k + 1 : k
  const lx = X(cur)
  label(ctx, `y${sub(idx)} = ${fmt(cur, 7)}`, lx, lineY - 14, { ...txt, size: 12, weight: 650, align: lx > w - 70 ? 'right' : lx < 70 ? 'left' : 'center' })
}
