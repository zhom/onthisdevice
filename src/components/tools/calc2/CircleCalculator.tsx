import { useState } from 'react'
import { CalcLayout, Choice, NumField, Result, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { dot, fitEqual, label } from './_viz/draw'
import { fmt, num } from './_viz/format'
import type { Ink } from './_viz/hooks'
import { easeInOut, phase, useTimeline } from './geo-anim'
import { circleFrom } from './circle'
import type { Circle, CircleKnown } from './circle'

const SWEEP = 1.3
const ROLL = 2.6
const LOOP = 0.3 + SWEEP + 0.3 + ROLL + 1.8

const NAMES: Record<CircleKnown, string> = { r: 'Radius', d: 'Diameter', C: 'Circumference', A: 'Area' }

export default function CircleCalculator() {
  const [known, setKnown] = useState<CircleKnown>('r')
  const f = useFields({ v: '5', unit: 'cm' })
  const v = f.num.v
  const unit = f.raw.unit.trim()
  const u = unit ? ` ${unit}` : ''
  const u2 = unit ? ` ${unit}²` : ''
  const error = v === null ? 'Enter a value.' : v <= 0 ? 'The value must be above zero.' : null
  const c: Circle | null = error ? null : circleFrom(known, v!)

  const tl = useTimeline((p, ink, t) => c && paintCircle(p.ctx, p.w, p.h, c, t, ink, unit), { key: `${known}|${f.raw.v}`, still: LOOP - 1, loop: LOOP })

  const first =
    !c || !v
      ? []
      : known === 'r'
        ? [`r = ${num(v)}`]
        : known === 'd'
          ? ['r = d ÷ 2', `  = ${num(v)} ÷ 2 = ${num(c.r, 10)}`]
          : known === 'C'
            ? ['r = C ÷ 2π', `  = ${num(v)} ÷ (2 × π) = ${num(c.r, 10)}`]
            : ['r = √(A ÷ π)', `  = √(${num(v)} ÷ π) = ${num(c.r, 10)}`]
  const working = c
    ? [
        ...first,
        ...(known !== 'd' ? [`d = 2r = 2 × ${num(c.r, 10)} = ${num(c.d, 10)}`] : []),
        ...(known !== 'C' ? [`C = 2πr = 2 × π × ${num(c.r, 10)} = ${num(c.C, 10)}`] : []),
        ...(known !== 'A' ? [`A = πr² = π × ${num(c.r, 10)}² = ${num(c.A, 10)}`] : []),
      ]
    : []

  const outs = (['r', 'd', 'C', 'A'] as const).filter((k) => k !== known)
  const main = outs.includes('A') ? 'A' : 'r'

  return (
    <CalcLayout
      inputs={
        <>
          <Choice
            label="I know the"
            value={known}
            onChange={setKnown}
            options={[
              { value: 'r', label: 'Radius' },
              { value: 'd', label: 'Diameter' },
              { value: 'C', label: 'Circumference' },
              { value: 'A', label: 'Area' },
            ]}
          />
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
            <NumField label={NAMES[known]} {...f.bind('v')} unit={known === 'A' ? (unit ? `${unit}²` : undefined) : unit || undefined} error={error} />
            <NumField label="Unit" {...f.bind('unit')} inputMode="text" hint="Optional" />
          </div>
        </>
      }
      result={
        <Result
          label={NAMES[main]}
          value={c ? c[main] : '–'}
          format={(n) => fmt(n, 10)}
          unit={c ? (main === 'A' ? u2.trim() : u.trim()) || undefined : undefined}
          error={error}
          copy={c ? `r = ${fmt(c.r, 12)}${u}, d = ${fmt(c.d, 12)}${u}, C = ${fmt(c.C, 12)}${u}, A = ${fmt(c.A, 12)}${u2}` : undefined}
        >
          {c
            ? outs
                .filter((k) => k !== main)
                .map((k) => <Stat key={k} label={NAMES[k]} value={c[k]} format={(n) => fmt(n, 10)} unit={(k === 'A' ? u2 : u).trim() || undefined} />)
            : null}
        </Result>
      }
      visual={
        <Stage
          summary={
            c
              ? `A circle of radius ${fmt(c.r, 6)}${u}. The radius sweeps once around to trace the circumference, then the circle rolls one turn along the line: the track it leaves is the circumference, π × ${fmt(c.d, 6)} = ${fmt(c.C, 6)}${u}, a little over three diameters.`
              : 'Enter a radius, diameter, circumference or area.'
          }
          bar={<SimBar playing={tl.playing} onPlaying={tl.setPlaying} onReplay={tl.replay} reduced={tl.reduced} />}
        >
          <canvas ref={tl.canvas} className="block aspect-[16/10] w-full" role="img" aria-label={c ? `Circle: radius ${fmt(c.r, 6)}, circumference ${fmt(c.C, 6)}` : 'Circle'} />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="π = 3.141592653589793" /> : null}
    />
  )
}

function paintCircle(ctx: CanvasRenderingContext2D, w: number, h: number, c: Circle, t: number, ink: Ink, unit: string) {
  // world: the circle starts at x = r and rolls to x = r + C; ground at y = 0
  const r = c.r
  const fit = fitEqual(0, 2 * r + c.C, -0.75 * r, 2 * r, w, h, [16, 18, 16, 18])
  const k = fit.k
  const gy = fit.y(0)
  const u = unit ? ` ${unit}` : ''
  const txt = { color: ink.ink, halo: ink.fill, font: ink.font, size: 12, weight: 650 }

  const t1 = 0.3
  const sweep = phase(t, t1, SWEEP, easeInOut)
  const roll = phase(t, t1 + SWEEP + 0.3, ROLL, easeInOut)
  const dist = roll * c.C
  const cx = fit.x(r + dist)
  const cy = fit.y(r)
  const turn = dist / r
  // the contact point starts at the bottom; rolling right turns the circle clockwise
  const startAng = Math.PI / 2

  // ground
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(fit.x(0), gy)
  ctx.lineTo(fit.x(2 * r + c.C), gy)
  ctx.stroke()
  // unrolled part of the circumference, on the ground
  if (dist > 0) {
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(fit.x(r), gy)
    ctx.lineTo(fit.x(r + dist), gy)
    ctx.stroke()
  }
  // circle: faint full outline, the swept or still-wrapped arc in ink
  ctx.strokeStyle = ink.hairline
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, r * k, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 3
  ctx.beginPath()
  if (roll <= 0) {
    if (sweep > 0) ctx.arc(cx, cy, r * k, startAng, startAng + sweep * Math.PI * 2)
  } else {
    // what is still wrapped: from the contact point around, minus the unrolled length
    const a0 = startAng + turn
    ctx.arc(cx, cy, r * k, a0, startAng + Math.PI * 2)
  }
  ctx.stroke()
  // the radius arm
  const arm = roll > 0 ? startAng + turn : startAng + sweep * Math.PI * 2
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 1.75
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(arm) * r * k, cy + Math.sin(arm) * r * k)
  ctx.stroke()
  dot(ctx, cx, cy, 3.5, ink.ink)
  dot(ctx, cx + Math.cos(arm) * r * k, cy + Math.sin(arm) * r * k, 4, ink.ink)
  if (roll === 0) label(ctx, `r = ${fmt(r, 5)}${u}`, cx, cy - 10, { ...txt, align: 'center' })

  // diameter ticks along the ground, then the length
  if (roll > 0) {
    ctx.fillStyle = ink.grey
    for (let i = 1; i <= 3; i++) {
      const x = fit.x(r + i * c.d)
      if (i * c.d <= dist) ctx.fillRect(x - 0.75, gy + 3, 1.5, 7)
    }
    if (roll >= 1) {
      label(ctx, `C = π × d = ${fmt(c.C, 6)}${u}`, fit.x(r + c.C / 2), gy + 26, { ...txt, align: 'center' })
      label(ctx, '1d', fit.x(r + c.d / 2), gy + 14, { ...txt, color: ink.grey, size: 10.5, weight: 560, align: 'center' })
    }
  }
}
