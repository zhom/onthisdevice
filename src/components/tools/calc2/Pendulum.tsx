import { useEffect, useMemo, useRef, useState } from 'react'
import { CalcLayout, Choice, NumField, Result, SelectField, SimBar, Stage, Stat, UnitField, Working, useFields } from './_viz/Calc'
import { arrow, dashed, dot, label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { timeScale } from './_viz/sim'
import { LENGTH, unitOptions } from './_viz/units'
import { WORLDS, gravityOf } from './gravity'
import type { World } from './gravity'
import { RAD, ampFactor, ampSeries, lengthFor, maxSpeed, period0, swingStep } from './pendulum'

type Mode = 'period' | 'length'
type LenU = 'm' | 'cm' | 'ft' | 'in'
const LENGTHS = unitOptions(LENGTH, ['m', 'cm', 'ft', 'in'])

export default function Pendulum() {
  const [mode, setMode] = useState<Mode>('period')
  const f = useFields({ L: '1', T: '2', amp: '10' })
  const [lu, setLu] = useState<LenU>('m')
  const [world, setWorld] = useState<World>('earth')
  const g = gravityOf(world)

  const { L: Lin, T: Tin, amp } = f.num
  const err = {
    L: Lin === null ? 'Enter a length.' : Lin <= 0 ? 'The length must be above zero.' : null,
    T: Tin === null ? 'Enter a period.' : Tin <= 0 ? 'The period must be above zero.' : null,
    amp: amp === null ? 'Enter an angle.' : amp <= 0 || amp >= 180 ? 'Use an angle above 0° and below 180°.' : null,
  }
  const ok = !err.amp && (mode === 'period' ? !err.L : !err.T)
  const theta0 = amp ?? 10
  const L = ok ? (mode === 'period' ? Lin! * LENGTH[lu] : lengthFor(Tin!, g, theta0)) : null
  const factor = ampFactor(theta0)
  const T0 = L !== null ? period0(L, g) : null
  const T = T0 !== null ? T0 * factor : null
  const scale = timeScale(T ?? 1, 0.5, 6)

  /* simulation */
  const canvas = useRef<HTMLCanvasElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const st = useRef({ th: theta0 * RAD, w: 0, t: 0 })

  const reset = () => {
    st.current = { th: theta0 * RAD, w: 0, t: 0 }
  }
  const key = useMemo(() => `${L}-${theta0}-${g}`, [L, theta0, g])
  useEffect(reset, [key])

  const paint = () => {
    if (L === null || T === null) return
    const p = prepCanvas(canvas.current)
    if (p) drawPendulum(p.ctx, p.w, p.h, st.current.th, st.current.w, theta0 * RAD, L, g, ink, lu)
    if (clock.current) clock.current.textContent = `t = ${dec(st.current.t, 1)} s · ${swings(Math.floor(st.current.t / T + 1e-9))}`
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      if (L === null || T === null) return
      const simDt = dt * scale.factor
      const n = Math.max(1, Math.ceil(simDt / (T / 600)))
      const h = simDt / n
      let { th, w } = st.current
      for (let i = 0; i < n; i++) [th, w] = swingStep(th, w, g / L, h)
      st.current = { th, w, t: st.current.t + simDt }
      paint()
    },
    playing && L !== null,
  )
  useEffect(() => {
    if (reduced) reset()
    paint()
  })

  const Lshow = L !== null ? L / LENGTH[lu] : 0
  const vmax = L !== null ? maxSpeed(L, g, theta0) : 0
  const summary =
    L !== null && T !== null
      ? `A ${fmt(Lshow, 4)} ${lu} pendulum released at ${fmt(theta0, 3)}° swings with a period of ${dec(T, 3)} s (${dec(1 / T, 3)} swings per second) and passes the bottom at ${dec(vmax, 2)} m/s. It moves at the computed rate: the swing is integrated step by step, so a wide release angle visibly slows it. The ink arrow is the velocity.`
      : 'Enter the values to see the pendulum swing.'

  const working =
    L !== null && T !== null && T0 !== null
      ? [
          ...(mode === 'length'
            ? [`L = g × (T ÷ (2π × f))² = ${num(g)} × (${num(Tin!)} ÷ (2π × ${num(factor)}))² = ${num(L)} m`]
            : lu !== 'm'
              ? [`L = ${num(Lin!)} ${lu} = ${num(L)} m`]
              : []),
          `T₀ = 2π √(L ÷ g) = 2π × √(${num(L)} ÷ ${num(g)}) = ${num(T0)} s`,
          `f(θ₀) = 1 ÷ AGM(1, cos(θ₀ ÷ 2)) = 1 ÷ AGM(1, cos ${num(theta0 / 2)}°) = ${num(factor)}`,
          `       ≈ 1 + θ₀²/16 + 11θ₀⁴/3072 + … = ${num(ampSeries(theta0))}`,
          `T = T₀ × f(θ₀) = ${num(T0)} × ${num(factor)} = ${num(T)} s`,
          `frequency = 1 ÷ T = ${num(1 / T)} Hz`,
          `vmax = √(2gL(1 − cos θ₀)) = ${num(vmax)} m/s`,
        ]
      : []

  return (
    <CalcLayout
      inputs={
        <>
          <Choice
            label="Find"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'period', label: 'Period from length' },
              { value: 'length', label: 'Length for a period' },
            ]}
          />
          {mode === 'period' ? (
            <UnitField label="Length" {...f.bind('L')} unit={lu} units={LENGTHS} onUnit={setLu} error={err.L} hint="From the pivot to the centre of the bob." />
          ) : (
            <NumField label="Period" {...f.bind('T')} unit="s" error={err.T} hint="One full swing, there and back." />
          )}
          <NumField label="Release angle" {...f.bind('amp')} unit="°" slider={{ min: 1, max: 170, step: 1 }} error={err.amp} />
          <SelectField label="Gravity" value={world} onChange={setWorld} options={WORLDS} />
        </>
      }
      result={
        <Result
          label={mode === 'period' ? 'Period' : 'Length'}
          value={mode === 'period' ? (T ?? '–') : L !== null ? Lshow : '–'}
          format={(n) => dec(n, 4)}
          unit={mode === 'period' ? 's' : lu}
          sub={T !== null ? (mode === 'period' ? `One full swing. ${dec(T / 2, 3)} s each way.` : `For a period of ${fmt(T, 4)} s`) : undefined}
          copy={T !== null && L !== null ? `Period ${dec(T, 4)} s, length ${dec(Lshow, 4)} ${lu}, frequency ${dec(1 / T, 4)} Hz` : undefined}
        >
          {T !== null && T0 !== null ? (
            <>
              <Stat label="Frequency" value={1 / T} format={(n) => dec(n, 4)} unit="Hz" />
              <Stat label="Small-angle period" value={T0} format={(n) => dec(n, 4)} unit="s" />
              <Stat label="Wide-swing correction" value={(factor - 1) * 100} format={(n) => `+${dec(n, 2)}`} unit="%" />
              <Stat label="Speed at the bottom" value={vmax} format={(n) => dec(n, 3)} unit="m/s" />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={<SimBar playing={playing} onPlaying={setPlaying} onReplay={() => { reset(); paint() }} scale={scale.label} reduced={reduced} clock={clock} />}>
          <canvas ref={canvas} className="block aspect-[4/3] w-full sm:aspect-[16/11]" role="img" aria-label={T !== null ? `Pendulum swinging with a ${dec(T, 3)} s period` : 'Pendulum'} />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="θ₀ is the release angle, g the gravity. AGM is the arithmetic-geometric mean, which gives the exact period for any angle." /> : null}
    />
  )
}

function swings(n: number): string {
  return `${n} swing${n === 1 ? '' : 's'}`
}

function drawPendulum(ctx: CanvasRenderingContext2D, w: number, h: number, th: number, om: number, th0: number, L: number, g: number, ink: Ink, lu: LenU) {
  const top = 26
  const up = Math.max(0, -Math.cos(th0))
  const side = th0 >= Math.PI / 2 ? 1 : Math.sin(th0)
  const Lpx = Math.max(20, Math.min((h - top - 30) / (1 + up), (w / 2 - 28) / Math.max(side, 0.25)))
  const px = w / 2
  const py = top + Lpx * up

  // support and rest line
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(px - 26, py)
  ctx.lineTo(px + 26, py)
  ctx.stroke()
  dashed(ctx, px, py, px, py + Lpx + 14, ink.grey, 1, [3, 5])

  // amplitude arc
  ctx.save()
  ctx.setLineDash([2, 5])
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.arc(px, py, Lpx, Math.PI / 2 - th0, Math.PI / 2 + th0)
  ctx.stroke()
  ctx.restore()
  const lab = { color: ink.grey, halo: ink.fill, font: ink.font, size: 12 }
  label(ctx, `${fmt(th0 / RAD, 3)}°`, px + 8, py + 30, lab)

  // rod and bob
  const bx = px + Lpx * Math.sin(th)
  const by = py + Lpx * Math.cos(th)
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(bx, by)
  ctx.stroke()
  dot(ctx, px, py, 3.5, ink.ink)
  const vmax = Math.sqrt(2 * g * L * (1 - Math.cos(th0))) || 1
  const v = om * L
  const k = 56 / vmax
  dot(ctx, bx, by, 11, ink.ink)
  arrow(ctx, bx, by, bx + Math.cos(th) * v * k, by - Math.sin(th) * v * k, ink.ink, 2, 7)
  label(ctx, `L = ${fmt(L / LENGTH[lu], 4)} ${lu}`, px - 34, py + 4, { ...lab, align: 'right' })
}
