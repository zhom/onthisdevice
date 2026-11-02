import { useMemo, useState } from 'react'
import { CalcLayout, Choice, NumField, Result, Row, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { dashed, dot, fitEqual, label } from './_viz/draw'
import { fmt, num, sub } from './_viz/format'
import type { Ink } from './_viz/hooks'
import { boxAround, oblique, paintGrid } from './geo-grid'
import { lerp, phase, useTimeline } from './geo-anim'
import { distance, midpoint } from './lines'
import type { Pt } from './lines'

type Dim = '2d' | '3d'
const END = 3.2

export default function DistanceMidpoint() {
  const [dim, setDim] = useState<Dim>('2d')
  const f = useFields({ x1: '1', y1: '2', z1: '3', x2: '7', y2: '10', z2: '15' })
  const keys = dim === '2d' ? (['x1', 'y1', 'x2', 'y2'] as const) : (['x1', 'y1', 'z1', 'x2', 'y2', 'z2'] as const)
  const error = keys.some((k) => f.num[k] === null) ? 'Enter every coordinate of both points.' : null
  const p1: Pt | null = error ? null : { x: f.num.x1!, y: f.num.y1!, ...(dim === '3d' ? { z: f.num.z1! } : {}) }
  const p2: Pt | null = error ? null : { x: f.num.x2!, y: f.num.y2!, ...(dim === '3d' ? { z: f.num.z2! } : {}) }
  const res = useMemo(() => (p1 && p2 ? { d: distance(p1, p2), m: midpoint(p1, p2) } : null), [p1?.x, p1?.y, p1?.z, p2?.x, p2?.y, p2?.z])

  const tl = useTimeline((p, ink, t) => res && p1 && p2 && (dim === '2d' ? paint2d(p.ctx, p.w, p.h, p1, p2, res.m, res.d, t, ink) : paint3d(p.ctx, p.w, p.h, p1, p2, res.m, res.d, t, ink)), {
    key: `${dim}|${Object.values(f.raw).join('|')}`,
    still: END,
    end: END,
  })

  const pt = (p: Pt) => `(${[p.x, p.y, ...(p.z !== undefined ? [p.z] : [])].map((v) => fmt(v, 10)).join(', ')})`
  const dx = p1 && p2 ? p2.x - p1.x : 0
  const dy = p1 && p2 ? p2.y - p1.y : 0
  const dz = p1 && p2 ? (p2.z ?? 0) - (p1.z ?? 0) : 0
  const sq = dx * dx + dy * dy + dz * dz
  const exactRoot = Number.isInteger(sq) && Number.isInteger(Math.sqrt(sq))

  const working =
    res && p1 && p2
      ? [
          dim === '2d' ? 'd = √((x₂ − x₁)² + (y₂ − y₁)²)' : 'd = √((x₂ − x₁)² + (y₂ − y₁)² + (z₂ − z₁)²)',
          `  = √((${num(p2.x)} − ${sub(p1.x)})² + (${num(p2.y)} − ${sub(p1.y)})²${dim === '3d' ? ` + (${num(p2.z!)} − ${sub(p1.z!)})²` : ''})`,
          `  = √(${sub(dx)}² + ${sub(dy)}²${dim === '3d' ? ` + ${sub(dz)}²` : ''})`,
          `  = √(${num(dx * dx)} + ${num(dy * dy)}${dim === '3d' ? ` + ${num(dz * dz)}` : ''}) = √${num(sq)}`,
          `  = ${num(res.d, 12)}`,
          '',
          dim === '2d' ? 'M = ((x₁ + x₂) ÷ 2, (y₁ + y₂) ÷ 2)' : 'M = ((x₁ + x₂) ÷ 2, (y₁ + y₂) ÷ 2, (z₁ + z₂) ÷ 2)',
          `  = ((${num(p1.x)} + ${sub(p2.x)}) ÷ 2, (${num(p1.y)} + ${sub(p2.y)}) ÷ 2${dim === '3d' ? `, (${num(p1.z!)} + ${sub(p2.z!)}) ÷ 2` : ''})`,
          `  = ${pt(res.m)}`,
        ]
      : []

  const field = (k: 'x1' | 'y1' | 'z1' | 'x2' | 'y2' | 'z2', l: string) => <NumField key={k} label={l} {...f.bind(k)} />

  return (
    <CalcLayout
      inputs={
        <>
          <Choice label="Space" value={dim} onChange={setDim} options={[{ value: '2d', label: '2D (x, y)' }, { value: '3d', label: '3D (x, y, z)' }]} />
          <Row cols={dim === '3d' ? 3 : 2}>
            {field('x1', 'x₁')}
            {field('y1', 'y₁')}
            {dim === '3d' ? field('z1', 'z₁') : null}
          </Row>
          <Row cols={dim === '3d' ? 3 : 2}>
            {field('x2', 'x₂')}
            {field('y2', 'y₂')}
            {dim === '3d' ? field('z2', 'z₂') : null}
          </Row>
        </>
      }
      result={
        <Result
          label="Distance"
          value={res ? res.d : '–'}
          format={(v) => fmt(v, 10)}
          sub={res ? `${exactRoot ? '' : `√${fmt(sq, 12)} ≈ `}${fmt(res.d, 10)}` : undefined}
          error={error}
          copy={res ? `distance ${fmt(res.d, 12)}, midpoint ${pt(res.m)}` : undefined}
        >
          {res ? (
            <>
              <Stat label="Midpoint" value={pt(res.m)} />
              <Stat label="Distance squared" value={sq} format={(v) => fmt(v, 12)} />
              <Stat label="Δx" value={dx} format={(v) => fmt(v, 10)} />
              <Stat label="Δy" value={dy} format={(v) => fmt(v, 10)} />
              {dim === '3d' ? <Stat label="Δz" value={dz} format={(v) => fmt(v, 10)} /> : null}
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage
          summary={
            res && p1 && p2
              ? `From ${pt(p1)} to ${pt(p2)} the steps are Δx = ${fmt(dx)}, Δy = ${fmt(dy)}${dim === '3d' ? ` and Δz = ${fmt(dz)}` : ''}. ${dim === '2d' ? 'They are the legs of a right triangle whose hypotenuse' : 'Together they make a box whose diagonal'} is the distance, ${fmt(res.d, 8)}. The midpoint ${pt(res.m)} sits halfway along it.`
              : 'Enter two points.'
          }
          bar={<SimBar playing={tl.playing} onPlaying={tl.setPlaying} onReplay={tl.replay} reduced={tl.reduced} />}
        >
          <canvas ref={tl.canvas} className="block aspect-square w-full sm:aspect-[16/11]" role="img" aria-label={res ? `Distance ${fmt(res.d, 6)}, midpoint ${pt(res.m)}` : 'Distance diagram'} />
        </Stage>
      }
      working={working.length ? <Working lines={working} /> : null}
    />
  )
}

type XY = { x: number; y: number }

function seg(ctx: CanvasRenderingContext2D, a: XY, b: XY, p: number, color: string, width: number) {
  if (p <= 0) return
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(lerp(a.x, b.x, p), lerp(a.y, b.y, p))
  ctx.stroke()
}

function ends(ctx: CanvasRenderingContext2D, a: XY, b: XY, m: XY, t: number, d: number, mLabel: string, ink: Ink) {
  const txt = { color: ink.ink, halo: ink.fill, font: ink.font, size: 12, weight: 650 }
  // the distance, then the midpoint sliding from the first point to the centre
  const hyp = phase(t, 1.5, 0.6)
  seg(ctx, a, b, hyp, ink.ink, 2.5)
  if (hyp > 0.95) {
    const nx = -(b.y - a.y)
    const ny = b.x - a.x
    const l = Math.hypot(nx, ny) || 1
    const off = ny / l > 0 ? -1 : 1
    label(ctx, `d = ${fmt(d, 6)}`, (a.x * 0.3 + b.x * 0.7) + (nx / l) * 14 * off, (a.y * 0.3 + b.y * 0.7) + (ny / l) * 14 * off + 4, { ...txt, align: 'center' })
  }
  const slide = phase(t, 2.2, 0.8)
  if (slide > 0) {
    const x = lerp(a.x, m.x, slide)
    const y = lerp(a.y, m.y, slide)
    ctx.fillStyle = ink.paper
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 2
    ctx.stroke()
    if (slide > 0.95) label(ctx, `M ${mLabel}`, x + 10, y + 18, { ...txt, align: 'left' })
  }
  const pop = phase(t, 0.05, 0.3)
  dot(ctx, a.x, a.y, 5.5 * pop, ink.ink)
  dot(ctx, b.x, b.y, 5.5 * pop, ink.ink)
}

function paint2d(ctx: CanvasRenderingContext2D, w: number, h: number, p1: Pt, p2: Pt, m: Pt, d: number, t: number, ink: Ink) {
  const fit = paintGrid(ctx, w, h, boxAround([p1, p2]), ink)
  const a = { x: fit.x(p1.x), y: fit.y(p1.y) }
  const b = { x: fit.x(p2.x), y: fit.y(p2.y) }
  const c = { x: b.x, y: a.y }
  const txt = { color: ink.grey, halo: ink.fill, font: ink.font, size: 12, weight: 600 }
  const legX = phase(t, 0.35, 0.5)
  const legY = phase(t, 0.85, 0.5)
  seg(ctx, a, c, legX, ink.grey, 2)
  seg(ctx, c, b, legY, ink.grey, 2)
  if (legX > 0.9 && p2.x !== p1.x) label(ctx, `Δx = ${fmt(p2.x - p1.x, 6)}`, (a.x + c.x) / 2, c.y + (b.y < a.y ? 17 : -9), { ...txt, align: 'center' })
  if (legY > 0.9 && p2.y !== p1.y) label(ctx, `Δy = ${fmt(p2.y - p1.y, 6)}`, c.x + (b.x >= a.x ? 8 : -8), (c.y + b.y) / 2 + 4, { ...txt, align: b.x >= a.x ? 'left' : 'right' })
  ends(ctx, a, b, { x: fit.x(m.x), y: fit.y(m.y) }, t, d, `(${fmt(m.x, 6)}, ${fmt(m.y, 6)})`, ink)
}

function paint3d(ctx: CanvasRenderingContext2D, w: number, h: number, p1: Pt, p2: Pt, m: Pt, d: number, t: number, ink: Ink) {
  const z1 = p1.z ?? 0
  const z2 = p2.z ?? 0
  const corners: [number, number, number][] = []
  for (const x of [p1.x, p2.x]) for (const y of [p1.y, p2.y]) for (const z of [z1, z2]) corners.push([x, y, z])
  const pr = corners.map(([x, y, z]) => oblique(x, y, z))
  const fit = fitEqual(Math.min(...pr.map((p) => p.x)), Math.max(...pr.map((p) => p.x)), Math.min(...pr.map((p) => p.y)), Math.max(...pr.map((p) => p.y)), w, h, [34, 40, 34, 40])
  const P = (x: number, y: number, z: number) => {
    const q = oblique(x, y, z)
    return { x: fit.x(q.x), y: fit.y(q.y) }
  }
  // the box between the points, faint
  const edges: [number, number][] = [
    [0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7],
  ]
  for (const [i, j] of edges) {
    const [ax, ay, az] = corners[i]!
    const [bx, by, bz] = corners[j]!
    const A = P(ax, ay, az)
    const B = P(bx, by, bz)
    dashed(ctx, A.x, A.y, B.x, B.y, ink.hairline, 1, [3, 4])
  }
  const a = P(p1.x, p1.y, z1)
  const c1 = P(p2.x, p1.y, z1)
  const c2 = P(p2.x, p2.y, z1)
  const b = P(p2.x, p2.y, z2)
  const txt = { color: ink.grey, halo: ink.fill, font: ink.font, size: 12, weight: 600 }
  const l1 = phase(t, 0.3, 0.4)
  const l2 = phase(t, 0.7, 0.4)
  const l3 = phase(t, 1.1, 0.4)
  seg(ctx, a, c1, l1, ink.grey, 2)
  seg(ctx, c1, c2, l2, ink.grey, 2)
  seg(ctx, c2, b, l3, ink.grey, 2)
  if (l1 > 0.9) label(ctx, `Δx ${fmt(p2.x - p1.x, 5)}`, (a.x + c1.x) / 2, (a.y + c1.y) / 2 + 17, { ...txt, align: 'center' })
  if (l2 > 0.9) label(ctx, `Δy ${fmt(p2.y - p1.y, 5)}`, (c1.x + c2.x) / 2 + 8, (c1.y + c2.y) / 2 + 12, { ...txt, align: 'left' })
  if (l3 > 0.9) label(ctx, `Δz ${fmt(z2 - z1, 5)}`, c2.x + 8, (c2.y + b.y) / 2, { ...txt, align: 'left' })
  ends(ctx, a, b, P(m.x, m.y, m.z ?? 0), t, d, `(${fmt(m.x, 5)}, ${fmt(m.y, 5)}, ${fmt(m.z ?? 0, 5)})`, ink)
  // axis key
  const o = { x: 26, y: h - 22 }
  const k = 16
  const ax = oblique(1, 0, 0)
  const ay = oblique(0, 1, 0)
  const az = oblique(0, 0, 1)
  const key = [
    ['x', ax],
    ['y', ay],
    ['z', az],
  ] as const
  for (const [n, v] of key) {
    seg(ctx, o, { x: o.x + v.x * k, y: o.y - v.y * k }, 1, ink.grey, 1.25)
    label(ctx, n, o.x + v.x * (k + 7), o.y - v.y * (k + 7) + 4, { ...txt, size: 10.5, align: 'center' })
  }
}
