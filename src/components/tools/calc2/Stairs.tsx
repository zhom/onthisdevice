import { useEffect, useRef, useState } from 'react'
import { CalcLayout, Choice, NumField, Result, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { dashed, label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { IRC, stairs } from './stairs'
import type { StairOut } from './stairs'

type Units = 'in' | 'cm'
const UNITS = [
  { value: 'in', label: 'Inches' },
  { value: 'cm', label: 'Centimetres' },
] as const

/** 7.714 -> "7 11/16" (nearest sixteenth). */
function sixteenths(x: number): string {
  let whole = Math.floor(x)
  let n = Math.round((x - whole) * 16)
  if (n === 16) {
    whole += 1
    n = 0
  }
  if (n === 0) return `${whole}`
  let d = 16
  while (n % 2 === 0) {
    n /= 2
    d /= 2
  }
  return `${whole} ${n}/${d}`
}

/** 130 -> "10 ft 10 in". */
function feetInches(inches: number): string {
  const ft = Math.floor(inches / 12 + 1e-9)
  const rest = inches - ft * 12
  return ft > 0 ? `${ft} ft ${sixteenths(rest)} in` : `${sixteenths(rest)} in`
}

export default function Stairs() {
  const f = useFields({ rise: '108', maxRiser: '7.75', tread: '10' })
  const [units, setUnits] = useState<Units>('in')

  const switchUnits = (u: Units) => {
    if (u === units) return
    const k = u === 'cm' ? 2.54 : 1 / 2.54
    const conv = (s: string, dp: number) => {
      const n = Number(s)
      return Number.isFinite(n) && s.trim() !== '' ? String(Number((n * k).toFixed(dp))) : s
    }
    f.setMany({ rise: conv(f.raw.rise, 1), maxRiser: conv(f.raw.maxRiser, 2), tread: conv(f.raw.tread, 1) })
    setUnits(u)
  }

  const { rise, maxRiser, tread } = f.num
  const pos = (v: number | null, what: string) => (v === null ? `Enter the ${what}.` : v <= 0 ? `The ${what} must be above zero.` : null)
  const err = { rise: pos(rise, 'total rise'), maxRiser: pos(maxRiser, 'riser height'), tread: pos(tread, 'tread depth') }
  const tooMany = rise !== null && maxRiser !== null && maxRiser > 0 && rise / maxRiser > 60
  const ok = !Object.values(err).some(Boolean) && !tooMany
  const s = ok ? stairs({ rise: rise!, maxRiser: maxRiser!, tread: tread! }) : null
  const toIn = units === 'cm' ? 1 / 2.54 : 1
  const u = units
  const L = (v: number) => (units === 'in' ? `${dec(v, 2)} in` : `${dec(v, 1)} cm`)

  const riserIn = s ? s.riser * toIn : 0
  const treadIn = ok ? tread! * toIn : 0
  const strideIn = s ? s.stride * toIn : 0
  const riserOk = riserIn <= IRC.maxRiser + 1e-9
  const treadOk = treadIn >= IRC.minTread - 1e-9
  const comfort = strideIn < 24 ? 'shallow' : strideIn > 25 ? 'steep' : 'comfortable'

  const working = s
    ? [
        `risers  = ⌈rise ÷ max riser⌉ = ⌈${num(rise!)} ÷ ${num(maxRiser!)}⌉ = ⌈${num(rise! / maxRiser!, 5)}⌉ = ${s.risers}`,
        `riser   = ${num(rise!)} ÷ ${s.risers} = ${num(s.riser, 5)} ${u}${units === 'in' ? ` (${sixteenths(s.riser)} in)` : ''}`,
        `treads  = risers − 1 = ${s.treads}`,
        `run     = ${s.treads} × ${num(tread!)} = ${num(s.run)} ${u}`,
        `stringer = √(rise² + run²) = √(${num(rise!)}² + ${num(s.run)}²) = ${num(s.stringer, 5)} ${u}`,
        `angle   = atan(riser ÷ tread) = atan(${num(s.riser, 5)} ÷ ${num(tread!)}) = ${num(s.angle, 4)}°`,
        `2R + T  = 2 × ${num(s.riser, 5)} + ${num(tread!)} = ${num(s.stride, 5)} ${u}`,
      ]
    : []

  return (
    <CalcLayout
      inputs={
        <>
          <Choice label="Units" value={units} onChange={switchUnits} options={UNITS} />
          <NumField label="Total rise, floor to floor" {...f.bind('rise')} unit={u} error={tooMany ? 'That makes more than 60 steps. Check the units.' : err.rise} hint="From the finished lower floor to the finished upper floor" />
          <NumField label="Largest riser allowed" {...f.bind('maxRiser')} unit={u} error={err.maxRiser} hint={units === 'in' ? 'IRC: 7¾ in' : 'IRC: 19.7 cm'} />
          <NumField label="Tread depth" {...f.bind('tread')} unit={u} error={err.tread} hint={units === 'in' ? 'IRC: at least 10 in' : 'IRC: at least 25.4 cm'} slider={units === 'in' ? { min: 8, max: 14, step: 0.25 } : { min: 20, max: 36, step: 0.5 }} />
        </>
      }
      result={
        <Result
          label="Risers"
          value={s ? s.risers : '–'}
          format={(n) => dec(n, 0)}
          sub={s ? `${s.risers} risers of ${L(s.riser)}${units === 'in' ? ` (${sixteenths(s.riser)} in)` : ''} and ${s.treads} treads of ${L(tread!)}` : undefined}
          copy={s ? `${s.risers} risers of ${L(s.riser)}, ${s.treads} treads of ${L(tread!)}, total run ${L(s.run)}, stringer ${L(s.stringer)}, angle ${dec(s.angle, 1)}°` : undefined}
        >
          {s ? (
            <>
              <Stat label="Riser height" value={s.riser} format={(n) => dec(n, units === 'in' ? 3 : 2)} unit={u} />
              <Stat label="Treads" value={s.treads} format={(n) => dec(n, 0)} />
              <Stat label="Total run" value={units === 'in' ? feetInches(s.run) : L(s.run)} />
              <Stat label="Stringer length" value={units === 'in' ? feetInches(s.stringer) : L(s.stringer)} />
              <Stat label="Angle" value={s.angle} format={(n) => dec(n, 1)} unit="°" />
              <Stat label="2R + T" value={`${L(s.stride)}, ${comfort}`} />
              <Stat label="Riser, IRC 7¾ in max" value={riserOk ? 'Within the limit' : 'Over the limit'} />
              <Stat label="Tread, IRC 10 in min" value={treadOk ? 'Within the limit' : 'Too shallow'} />
            </>
          ) : null}
        </Result>
      }
      visual={
        s ? (
          <StairDrawing s={s} rise={rise!} tread={tread!} units={units} L={L} />
        ) : (
          <Stage summary="Enter the total rise to draw the stair.">
            <div className="aspect-[4/3] w-full" />
          </Stage>
        )
      }
      working={working.length ? <Working lines={working} caption="Comfortable stairs have 2R + T between 24 and 25 in (61 to 64 cm). IRC R311.7: risers at most 7¾ in, treads at least 10 in, headroom at least 6 ft 8 in." /> : null}
    />
  )
}

/* ── side view, built one step at a time ────────────────────────── */

function StairDrawing({ s, rise, tread, units, L }: { s: StairOut; rise: number; tread: number; units: Units; L: (v: number) => string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)
  const per = Math.min(0.22, 3 / s.risers)
  const end = s.risers * per + 0.5

  const paint = (time: number) => {
    const p = prepCanvas(canvas.current)
    if (p) drawStairs(p.ctx, p.w, p.h, ink, s, rise, tread, units, L, time / per)
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      t.current = Math.min(end, t.current + dt)
      paint(t.current)
      if (t.current >= end) setPlaying(false)
    },
    playing,
  )
  useEffect(() => {
    t.current = 0
    setPlaying(true)
  }, [s.risers, s.riser, tread])
  useEffect(() => {
    if (reduced) t.current = end
    paint(t.current)
  })

  const headroom = units === 'in' ? IRC.headroom : IRC.headroom * 2.54
  return (
    <Stage
      summary={`The stair from the side, to scale: ${s.risers} risers of ${L(s.riser)} and ${s.treads} treads of ${L(tread)} climb ${L(rise)} over a run of ${L(s.run)} at ${dec(s.angle, 1)}°. The dashed line above the steps is the ${L(headroom)} headroom the IRC asks for; the grey line is the stringer, ${L(s.stringer)} long.`}
      bar={
        <SimBar
          playing={playing}
          onPlaying={(p) => {
            if (p && t.current >= end) t.current = 0
            setPlaying(p)
          }}
          onReplay={() => {
            t.current = 0
            setPlaying(true)
            paint(0)
          }}
          scale="One step at a time"
          reduced={reduced}
        />
      }
    >
      <canvas ref={canvas} className="block aspect-[4/3] w-full" role="img" aria-label={`Stair of ${s.risers} risers drawn to scale`} />
    </Stage>
  )
}

function drawStairs(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ink: Ink,
  s: StairOut,
  rise: number,
  T: number,
  units: Units,
  L: (v: number) => string,
  shown: number,
) {
  const R = s.riser
  const run = s.run
  const head = units === 'in' ? IRC.headroom : IRC.headroom * 2.54
  const slab = Math.max(R * 1.2, rise * 0.06)
  const landing = Math.max(T * 2.5, run * 0.18)
  const worldW = run + landing
  const worldH = Math.max(rise + slab, R + head)
  const padL = 56
  const padR = 16
  const padT = 18
  const padB = 40
  const k = Math.min((w - padL - padR) / worldW, (h - padT - padB) / worldH)
  const x0 = padL + (w - padL - padR - worldW * k) / 2
  const y0 = h - padB - (h - padT - padB - worldH * k) / 2
  const X = (x: number) => x0 + x * k
  const Y = (y: number) => y0 - y * k
  const font = ink.font

  // floors
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(X(-landing * 0.15), Y(0))
  ctx.lineTo(X(worldW), Y(0))
  ctx.stroke()
  ctx.fillStyle = ink.paper
  ctx.fillRect(X(run), Y(rise), (worldW - run) * k, slab * k)
  ctx.strokeRect(X(run), Y(rise), (worldW - run) * k, slab * k)

  // stringer and headroom guides
  const done = shown >= s.risers
  if (done) {
    ctx.strokeStyle = ink.grey
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(X(0), Y(0))
    ctx.lineTo(X(run), Y(rise))
    ctx.stroke()
    dashed(ctx, X(0), Y(R + head), X(run), Y(rise + head), ink.grey, 1, [5, 4])
  }

  // steps rise into place one by one
  for (let i = 1; i <= s.risers; i++) {
    const a = Math.min(1, Math.max(0, shown - (i - 1)))
    if (a <= 0) continue
    const e = 1 - (1 - a) ** 3
    const lift = (1 - e) * R * k * 1.2
    ctx.globalAlpha = e
    const xs = (i - 1) * T
    if (i < s.risers) {
      ctx.fillStyle = ink.paper
      ctx.fillRect(X(xs), Y(i * R) + lift, T * k, R * k)
      ctx.strokeStyle = ink.ink
      ctx.lineWidth = 1.5
      ctx.strokeRect(X(xs), Y(i * R) + lift, T * k, R * k)
    } else {
      ctx.strokeStyle = ink.ink
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(X(xs), Y((i - 1) * R) + lift)
      ctx.lineTo(X(xs), Y(i * R) + lift)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  if (!done) return
  // dimensions: total rise at the left, total run below
  const dim = (xa: number, ya: number, xb: number, yb: number) => {
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(xa, ya)
    ctx.lineTo(xb, yb)
    const nx = ya === yb ? 0 : 4
    const ny = ya === yb ? 4 : 0
    ctx.moveTo(xa - nx, ya - ny)
    ctx.lineTo(xa + nx, ya + ny)
    ctx.moveTo(xb - nx, yb - ny)
    ctx.lineTo(xb + nx, yb + ny)
    ctx.stroke()
  }
  const lx = X(0) - 22
  dim(lx, Y(0), lx, Y(rise))
  ctx.save()
  ctx.translate(lx - 8, (Y(0) + Y(rise)) / 2)
  ctx.rotate(-Math.PI / 2)
  label(ctx, L(rise), 0, 0, { color: ink.ink, halo: ink.fill, font, size: 12, weight: 650, align: 'center' })
  ctx.restore()
  const by = Y(0) + 18
  dim(X(0), by, X(run), by)
  label(ctx, `run ${L(run)}`, (X(0) + X(run)) / 2, by + 16, { color: ink.ink, halo: ink.fill, font, size: 12, weight: 650, align: 'center' })
  // the first step's riser and tread
  label(ctx, L(R), X(0) + 4, Y(R / 2) + 4, { color: ink.grey, halo: ink.paper, font, size: 11 })
  if (s.risers > 1) label(ctx, L(T), X(T / 2), Y(R) - 6, { color: ink.grey, halo: ink.fill, font, size: 11, align: 'center' })
}
