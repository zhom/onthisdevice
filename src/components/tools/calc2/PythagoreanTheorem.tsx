import { useState } from 'react'
import { CalcLayout, Choice, NumField, Result, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { fitEqual, label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import type { Ink } from './_viz/hooks'
import { phase, useTimeline } from './geo-anim'
import { isTriple, solveRight } from './pythagoras'
import type { RightTriangle, Side } from './pythagoras'

const END = 3.6
type XY = [number, number]

export default function PythagoreanTheorem() {
  const [find, setFind] = useState<Side>('c')
  const f = useFields({ a: '3', b: '4', c: '5' })
  const known = (['a', 'b', 'c'] as const).filter((k) => k !== find)
  const bad = known.find((k) => f.num[k] === null || f.num[k]! <= 0)
  const solved = bad ? null : solveRight(find, { a: f.num.a ?? undefined, b: f.num.b ?? undefined, c: f.num.c ?? undefined })
  const tri: RightTriangle | null = typeof solved === 'object' ? solved : null
  const error = bad ? `Enter a length above zero for side ${bad}.` : typeof solved === 'string' ? solved : null

  const tl = useTimeline((p, ink, t) => tri && paintSquares(p.ctx, p.w, p.h, tri, t, ink), {
    key: `${find}|${known.map((k) => f.raw[k]).join('|')}`,
    still: END,
    end: END,
  })

  const working = tri
    ? [
        ...(find === 'c'
          ? ['c = √(a² + b²)', `  = √(${num(tri.a)}² + ${num(tri.b)}²)`, `  = √(${num(tri.a ** 2)} + ${num(tri.b ** 2)})`, `  = √${num(tri.c ** 2)}`, `  = ${num(tri.c, 12)}`]
          : [
              `${find} = √(c² − ${find === 'a' ? 'b' : 'a'}²)`,
              `  = √(${num(tri.c)}² − ${num(find === 'a' ? tri.b : tri.a)}²)`,
              `  = √(${num(tri.c ** 2)} − ${num((find === 'a' ? tri.b : tri.a) ** 2)})`,
              `  = √${num((find === 'a' ? tri.a : tri.b) ** 2)}`,
              `  = ${num(find === 'a' ? tri.a : tri.b, 12)}`,
            ]),
        '',
        `A = arctan(a ÷ b) = arctan(${num(tri.a)} ÷ ${num(tri.b)}) = ${num(tri.A, 8)}°`,
        `B = 90° − A = ${num(tri.B, 8)}°`,
        `area = a × b ÷ 2 = ${num(tri.a)} × ${num(tri.b)} ÷ 2 = ${num(tri.area)}`,
        `perimeter = a + b + c = ${num(tri.perimeter)}`,
      ]
    : []

  const value = tri ? tri[find] : null
  const triple = tri && isTriple(Math.round(tri.a * 1e9) / 1e9, Math.round(tri.b * 1e9) / 1e9, Math.round(tri.c * 1e9) / 1e9)

  return (
    <CalcLayout
      inputs={
        <>
          <Choice
            label="Solve for"
            value={find}
            onChange={setFind}
            options={[
              { value: 'c', label: 'Hypotenuse c' },
              { value: 'a', label: 'Leg a' },
              { value: 'b', label: 'Leg b' },
            ]}
          />
          {known.map((k) => (
            <NumField key={k} label={k === 'c' ? 'Hypotenuse c' : `Leg ${k}`} {...f.bind(k)} error={bad === k ? 'Enter a length above zero.' : null} />
          ))}
        </>
      }
      result={
        <Result
          label={find === 'c' ? 'Hypotenuse c' : `Leg ${find}`}
          value={value ?? '–'}
          format={(v) => fmt(v, 10)}
          sub={tri ? `${fmt(tri.a ** 2, 8)} + ${fmt(tri.b ** 2, 8)} = ${fmt(tri.c ** 2, 8)}${triple ? `, a Pythagorean triple` : ''}` : undefined}
          error={error}
          copy={tri ? `a = ${fmt(tri.a, 12)}, b = ${fmt(tri.b, 12)}, c = ${fmt(tri.c, 12)}` : undefined}
        >
          {tri ? (
            <>
              <Stat label="Angle A (opposite a)" value={tri.A} format={(v) => dec(v, 3)} unit="°" />
              <Stat label="Angle B (opposite b)" value={tri.B} format={(v) => dec(v, 3)} unit="°" />
              <Stat label="Area" value={tri.area} format={(v) => fmt(v, 8)} />
              <Stat label="Perimeter" value={tri.perimeter} format={(v) => fmt(v, 8)} />
              <Stat label="Height to c" value={tri.h} format={(v) => fmt(v, 8)} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage
          summary={
            tri
              ? `Squares on the three sides. The square on a has area ${fmt(tri.a ** 2, 6)} (grey) and the square on b has area ${fmt(tri.b ** 2, 6)} (hatched). Both pour into the square on the hypotenuse and fill it exactly: ${fmt(tri.c ** 2, 6)}.`
              : 'Enter two sides of a right triangle.'
          }
          bar={<SimBar playing={tl.playing} onPlaying={tl.setPlaying} onReplay={tl.replay} reduced={tl.reduced} />}
        >
          <canvas ref={tl.canvas} className="block aspect-square w-full sm:aspect-[16/12]" role="img" aria-label={tri ? `Right triangle a ${fmt(tri.a, 5)}, b ${fmt(tri.b, 5)}, c ${fmt(tri.c, 5)}` : 'Right triangle'} />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="a and b are the legs, c is the hypotenuse; A is the angle opposite a." /> : null}
    />
  )
}

/** A strip of a square: from its base edge (p to q) out to `depth` along `n`. */
function strip(p: XY, q: XY, n: XY, d0: number, d1: number): XY[] {
  return [
    [p[0] + n[0] * d0, p[1] + n[1] * d0],
    [q[0] + n[0] * d0, q[1] + n[1] * d0],
    [q[0] + n[0] * d1, q[1] + n[1] * d1],
    [p[0] + n[0] * d1, p[1] + n[1] * d1],
  ]
}

function paintSquares(ctx: CanvasRenderingContext2D, w: number, h: number, tri: RightTriangle, t: number, ink: Ink) {
  const { a, b, c } = tri
  const fit = fitEqual(-a, b + a, -b, a + b, w, h, [16, 16, 16, 16])
  const P = ([x, y]: XY) => [fit.x(x), fit.y(y)] as const
  const path = (pts: XY[]) => {
    ctx.beginPath()
    pts.forEach((pt, i) => {
      const [x, y] = P(pt)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.closePath()
  }
  const hatch = (pts: XY[]) => {
    ctx.save()
    path(pts)
    ctx.clip()
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 1.4
    ctx.beginPath()
    for (let x = -h; x < w + h; x += 7) {
      ctx.moveTo(x, h)
      ctx.lineTo(x + h, 0)
    }
    ctx.stroke()
    ctx.restore()
  }
  const solid = (pts: XY[]) => {
    path(pts)
    ctx.fillStyle = ink.grey
    ctx.fill()
  }

  const O: XY = [0, 0]
  const A: XY = [0, a]
  const B: XY = [b, 0]
  // squares: on a (left), on b (below), on c (outward)
  const sqA = { p: O, q: A, n: [-1, 0] as XY, s: a }
  const sqB = { p: O, q: B, n: [0, -1] as XY, s: b }
  const sqC = { p: B, q: A, n: [a / c, b / c] as XY, s: c }

  const draw = phase(t, 0.05, 0.6)
  const pourA = phase(t, 1.0, 1.0, (x) => x)
  const pourB = phase(t, 2.1, 1.0, (x) => x)

  // what is left in the small squares (they drain from the outer edge inward)
  if (draw > 0) {
    solid(strip(sqA.p, sqA.q, sqA.n, 0, sqA.s * (1 - pourA) * draw))
    hatch(strip(sqB.p, sqB.q, sqB.n, 0, sqB.s * (1 - pourB) * draw))
  }
  // what has arrived in the big square: a² first, from the hypotenuse out, then b²
  const dA = (a * a) / c
  const dB = (b * b) / c
  if (pourA > 0) solid(strip(sqC.p, sqC.q, sqC.n, 0, dA * pourA))
  if (pourB > 0) hatch(strip(sqC.p, sqC.q, sqC.n, dA, dA + dB * pourB))

  // outlines
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 1.75
  ctx.lineJoin = 'round'
  for (const s of [sqA, sqB, sqC]) {
    path(strip(s.p, s.q, s.n, 0, s.s * draw))
    ctx.stroke()
  }
  path([O, B, A])
  ctx.fillStyle = ink.paper
  ctx.fill()
  ctx.lineWidth = 2.25
  ctx.stroke()
  // right-angle mark
  const k = Math.min(a, b) * 0.14
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.moveTo(...P([k, 0]))
  ctx.lineTo(...P([k, k]))
  ctx.lineTo(...P([0, k]))
  ctx.stroke()

  const tx = { color: ink.ink, halo: ink.paper, font: ink.font, size: 12.5, weight: 680, align: 'center' as const }
  const centre = (s: typeof sqA) => P([(s.p[0] + s.q[0]) / 2 + (s.n[0] * s.s) / 2, (s.p[1] + s.q[1]) / 2 + (s.n[1] * s.s) / 2])
  if (draw > 0.9) {
    const [ax, ay] = centre(sqA)
    label(ctx, `a² = ${fmt(a * a, 5)}`, ax, ay + 4, tx)
    const [bx, by] = centre(sqB)
    label(ctx, `b² = ${fmt(b * b, 5)}`, bx, by + 4, tx)
    const [cx, cy] = centre(sqC)
    label(ctx, pourB >= 1 ? `c² = ${fmt(c * c, 5)}` : `c² = ${fmt(a * a * pourA + b * b * pourB, 4)}`, cx, cy + 4, tx)
    const [mx, my] = P([b / 2, a / 2])
    label(ctx, `c ${fmt(c, 5)}`, mx + 6, my - 4, { ...tx, size: 11.5, weight: 600, align: 'left' })
    const [lx, ly] = P([0, a / 2])
    label(ctx, 'a', lx + 9, ly + 4, { ...tx, size: 11.5, align: 'left' })
    const [qx, qy] = P([b / 2, 0])
    label(ctx, 'b', qx, qy - 7, { ...tx, size: 11.5 })
  }
}
