import { useEffect, useRef, useState } from 'react'
import { niceDomain } from '@/components/viz/scale'
import { useTween } from '@/components/viz/tween'
import { CalcLayout, Choice, Result, SimBar, Stage, Stat, UnitField, Working, useFields } from './_viz/Calc'
import { arrow, dashed, dot, label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { G0 } from './_viz/sim'
import { ENERGY, MASS, SPEED, unitOptions } from './_viz/units'
import { energy, massFor, momentum, speedFor } from './kinetic'

type Mode = 'energy' | 'mass' | 'speed'
type MassU = 'kg' | 'g' | 't' | 'lb'
type SpeedU = 'm/s' | 'km/h' | 'mph'
type EnergyU = 'J' | 'kJ' | 'kcal' | 'kWh'
const MASSES = unitOptions(MASS, ['kg', 'g', 't', 'lb'])
const SPEEDS = unitOptions(SPEED, ['m/s', 'km/h', 'mph'])
const ENERGIES = unitOptions(ENERGY, ['J', 'kJ', 'kcal', 'kWh'])
/** Screen speed of the moving block: px per second for each m/s. */
const PX_PER_MS = 6

/** Joules with a fitting prefix. */
function joules(j: number): string {
  const a = Math.abs(j)
  if (a >= 1e9) return `${fmt(j / 1e9, 4)} GJ`
  if (a >= 1e6) return `${fmt(j / 1e6, 4)} MJ`
  if (a >= 1e4) return `${fmt(j / 1e3, 4)} kJ`
  return `${fmt(j, 4)} J`
}

export default function KineticEnergy() {
  const [mode, setMode] = useState<Mode>('energy')
  const f = useFields({ m: '1000', v: '20', e: '200' })
  const [mu, setMu] = useState<MassU>('kg')
  const [vu, setVu] = useState<SpeedU>('m/s')
  const [eu, setEu] = useState<EnergyU>('kJ')

  const pos = (k: 'm' | 'v' | 'e', what: string) => (f.num[k] === null ? `Enter the ${what}.` : f.num[k]! <= 0 ? `The ${what} must be above zero.` : null)
  const err = { m: pos('m', 'mass'), v: pos('v', 'speed'), e: pos('e', 'energy') }
  let m: number | null = null
  let v: number | null = null
  let ke: number | null = null
  if (mode === 'energy' && !err.m && !err.v) {
    m = f.num.m! * MASS[mu]
    v = f.num.v! * SPEED[vu]
    ke = energy(m, v)
  } else if (mode === 'mass' && !err.e && !err.v) {
    ke = f.num.e! * ENERGY[eu]
    v = f.num.v! * SPEED[vu]
    m = massFor(ke, v)
  } else if (mode === 'speed' && !err.e && !err.m) {
    ke = f.num.e! * ENERGY[eu]
    m = f.num.m! * MASS[mu]
    v = speedFor(ke, m)
  }
  const ok = m !== null && v !== null && ke !== null

  /* visual */
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const x = useRef(0)
  const vShown = useTween(v ?? 0)
  const vMax = niceDomain(0, (v ?? 1) * 2.1, 4).max
  const vMaxShown = useTween(vMax)

  const paint = () => {
    if (!ok) return
    const p = prepCanvas(canvas.current)
    if (p) drawKE(p.ctx, p.w, p.h, m!, vShown, vMaxShown, x.current, ink, vu)
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      x.current += Math.min(900, v! * PX_PER_MS) * dt
      paint()
    },
    playing && ok,
  )
  useEffect(() => {
    if (reduced) x.current = 0
    paint()
  })

  const showV = (ms: number) => ms / SPEED[vu]
  const summary = ok
    ? `${fmt(m! / MASS[mu], 4)} ${mu} moving at ${fmt(showV(v!), 4)} ${vu} carries ${joules(ke!)}. On the curve, energy grows with the square of the speed: at twice the speed the energy is four times as large, ${joules(4 * ke!)}. The block moves across the top at a speed in proportion to the real one, scaled down.`
    : 'Enter two values to see the energy.'

  const working = ok
    ? [
        ...(mu !== 'kg' && mode !== 'mass' ? [`m = ${num(f.num.m!)} ${mu} = ${num(m!)} kg`] : []),
        ...(vu !== 'm/s' && mode !== 'speed' ? [`v = ${num(f.num.v!)} ${vu} = ${num(v!)} m/s`] : []),
        ...(eu !== 'J' && mode !== 'energy' ? [`KE = ${num(f.num.e!)} ${eu} = ${num(ke!)} J`] : []),
        mode === 'energy'
          ? `KE = ½ m v² = 0.5 × ${num(m!)} × ${num(v!)}² = ${num(ke!)} J`
          : mode === 'mass'
            ? `m = 2 KE ÷ v² = 2 × ${num(ke!)} ÷ ${num(v!)}² = ${num(m!)} kg`
            : `v = √(2 KE ÷ m) = √(2 × ${num(ke!)} ÷ ${num(m!)}) = ${num(v!)} m/s`,
        `p = m v = ${num(m!)} × ${num(v!)} = ${num(momentum(m!, v!))} kg·m/s`,
        `same energy as a drop from h = v² ÷ 2g = ${num((v! * v!) / (2 * G0))} m`,
      ]
    : []

  const result =
    mode === 'energy'
      ? { label: 'Kinetic energy', value: ok ? joules(ke!) : '–' }
      : mode === 'mass'
        ? { label: 'Mass', value: ok ? `${fmt(m! / MASS[mu], 5)} ${mu}` : '–' }
        : { label: 'Speed', value: ok ? `${fmt(showV(v!), 5)} ${vu}` : '–' }

  return (
    <CalcLayout
      inputs={
        <>
          <Choice
            label="Find"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'energy', label: 'Energy' },
              { value: 'mass', label: 'Mass' },
              { value: 'speed', label: 'Speed' },
            ]}
          />
          {mode !== 'mass' ? <UnitField label="Mass" {...f.bind('m')} unit={mu} units={MASSES} onUnit={setMu} error={err.m} /> : null}
          {mode !== 'speed' ? <UnitField label="Speed" {...f.bind('v')} unit={vu} units={SPEEDS} onUnit={setVu} error={err.v} /> : null}
          {mode !== 'energy' ? <UnitField label="Kinetic energy" {...f.bind('e')} unit={eu} units={ENERGIES} onUnit={setEu} error={err.e} /> : null}
        </>
      }
      result={
        <Result label={result.label} value={result.value} copy={ok ? `KE ${joules(ke!)}, mass ${fmt(m!, 6)} kg, speed ${fmt(v!, 6)} m/s` : undefined}>
          {ok ? (
            <>
              {mode !== 'energy' ? <Stat label="Kinetic energy" value={joules(ke!)} /> : null}
              <Stat label="In kilowatt-hours" value={ke! / 3.6e6} format={(n) => fmt(n, 4)} unit="kWh" />
              <Stat label="In food calories" value={ke! / 4184} format={(n) => fmt(n, 4)} unit="kcal" />
              <Stat label="Momentum" value={momentum(m!, v!)} format={(n) => fmt(n, 4)} unit="kg·m/s" />
              <Stat label="Same as a drop from" value={(v! * v!) / (2 * G0)} format={(n) => fmt(n, 4)} unit="m" />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={<SimBar playing={playing} onPlaying={setPlaying} scale="Speed scaled down" reduced={reduced} />}>
          <canvas ref={canvas} className="block aspect-[4/3] w-full sm:aspect-[16/11]" role="img" aria-label={ok ? `Kinetic energy curve with the point at ${fmt(showV(v!), 4)} ${vu} and ${joules(ke!)}` : 'Kinetic energy curve'} />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="SI units: kilograms, metres per second and joules. g = 9.80665 m/s²." /> : null}
    />
  )
}

function drawKE(ctx: CanvasRenderingContext2D, w: number, h: number, m: number, v: number, vMax: number, x: number, ink: Ink, vu: SpeedU) {
  const lab = { color: ink.grey, halo: ink.fill, font: ink.font, size: 11 }
  // lane with the moving block
  const laneY = Math.round(h * 0.2)
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(16, laneY + 14)
  ctx.lineTo(w - 16, laneY + 14)
  ctx.stroke()
  const span = w - 32 + 48
  const bx = 16 - 48 + (((x % span) + span) % span)
  ctx.fillStyle = ink.ink
  ctx.fillRect(bx, laneY - 14, 44, 26)
  arrow(ctx, bx + 50, laneY - 1, bx + 50 + 22, laneY - 1, ink.ink, 2, 6)

  // energy curve
  const left = 48
  const right = w - 18
  const top = h * 0.38
  const bottom = h - 28
  const sv = SPEED[vu]
  const keMax = 0.5 * m * vMax * vMax
  const X = (s: number) => left + (s / vMax) * (right - left)
  const Y = (e: number) => bottom - (e / keMax) * (bottom - top)
  ctx.strokeStyle = ink.grey
  ctx.beginPath()
  ctx.moveTo(left, top - 6)
  ctx.lineTo(left, bottom)
  ctx.lineTo(right, bottom)
  ctx.stroke()
  const ticks = niceDomain(0, vMax / sv, 4).ticks
  for (const t of ticks) {
    const xx = X(t * sv)
    if (xx > right + 1) continue
    label(ctx, fmt(t, 4), xx, bottom + 15, { ...lab, align: 'center' })
  }
  label(ctx, vu, right, bottom - 6, { ...lab, align: 'right' })
  label(ctx, 'energy', left + 6, top - 4, lab)

  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 2.25
  ctx.beginPath()
  for (let i = 0; i <= 80; i++) {
    const s = (vMax * i) / 80
    const px = X(s)
    const py = Y(0.5 * m * s * s)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()

  // the point and the doubled speed
  const e = 0.5 * m * v * v
  dashed(ctx, X(v), bottom, X(v), Y(e), ink.grey)
  dashed(ctx, left, Y(e), X(v), Y(e), ink.grey)
  if (2 * v <= vMax * 1.001) {
    dashed(ctx, X(2 * v), bottom, X(2 * v), Y(4 * e), ink.grey, 1, [2, 4])
    dashed(ctx, left, Y(4 * e), X(2 * v), Y(4 * e), ink.grey, 1, [2, 4])
    dot(ctx, X(2 * v), Y(4 * e), 4, ink.grey)
    label(ctx, '2× speed, 4× energy', X(2 * v) - 8, Y(4 * e) - 8, { ...lab, align: 'right' })
  }
  dot(ctx, X(v), Y(e), 6, ink.ink)
  label(ctx, 'KE', X(v) + 10, Y(e) + 4, { ...lab, color: ink.ink, size: 12, weight: 650 })
}
