import { useEffect, useMemo, useRef, useState } from 'react'
import { niceDomain, niceStep } from '@/components/viz/scale'
import { CalcLayout, NumField, Result, SelectField, SimBar, Stage, Stat, UnitField, Working, useFields } from './_viz/Calc'
import { dashed, dot, label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { TIME } from './_viz/units'
import { PRESETS, decayTimes, elapsed, halfLife, initial, lambda, remaining } from './halflife'

type Mode = 'N' | 'N0' | 't' | 'T'
type TimeU = keyof typeof TIME
const TIME_UNITS: { value: TimeU; label: string }[] = [
  { value: 's', label: 's' },
  { value: 'min', label: 'min' },
  { value: 'h', label: 'h' },
  { value: 'd', label: 'days' },
  { value: 'yr', label: 'years' },
]
const UNIT_NAME: Record<TimeU, [string, string]> = { s: ['second', 'seconds'], min: ['minute', 'minutes'], h: ['hour', 'hours'], d: ['day', 'days'], yr: ['year', 'years'] }
const COUNT = 400
const HOLD = 1.6
type Preset = (typeof PRESETS)[number]['id'] | 'custom'

/** Animation speed for a decay of `D` seconds: real time when it fits, else a round "1 s shows" factor. */
function decayScale(D: number, unit: TimeU): { factor: number; label: string } {
  if (D >= 1 && D <= 8) return { factor: 1, label: 'Real time' }
  const perSec = D / 6 / TIME[unit]
  const nice = niceStep(perSec, 1)
  const name = UNIT_NAME[unit][nice === 1 ? 0 : 1]
  return { factor: nice * TIME[unit], label: D < 1 ? `Slowed: 1 s shows ${fmt(nice, 3)} ${name}` : `1 s shows ${fmt(nice, 6)} ${name}` }
}

export default function HalfLife() {
  const [mode, setMode] = useState<Mode>('N')
  const [preset, setPreset] = useState<Preset>('c14')
  const f = useFields({ T: '5730', t: '11460', N0: '100', N: '25' })
  const [Tu, setTu] = useState<TimeU>('yr')
  const [tu, setTu2] = useState<TimeU>('yr')

  const pickPreset = (p: Preset) => {
    setPreset(p)
    const found = PRESETS.find((x) => x.id === p)
    if (found) {
      f.set('T', String(found.half))
      setTu(found.unit)
      setTu2(found.unit)
      f.set('t', String(found.half * 2))
    }
  }

  const need = (k: 'T' | 't' | 'N0' | 'N', what: string, zeroOk = false) => {
    const n = f.num[k]
    if (n === null) return `Enter the ${what}.`
    if (zeroOk ? n < 0 : n <= 0) return `The ${what} must be above zero.`
    return null
  }
  const err = {
    T: mode === 'T' ? null : need('T', 'half-life'),
    t: mode === 't' ? null : need('t', 'time', true),
    N0: mode === 'N0' ? null : need('N0', 'starting amount'),
    N: mode === 'N' ? null : need('N', 'amount left'),
  }
  let order: string | null = null
  if ((mode === 't' || mode === 'T') && !err.N && !err.N0 && f.num.N! >= f.num.N0!) order = 'The amount left must be below the starting amount.'
  if (mode === 'T' && !err.t && f.num.t === 0) order = 'The time must be above zero.'
  const bad = err.T || err.t || err.N0 || err.N || order

  const sol = useMemo(() => {
    if (bad) return null
    let T = mode === 'T' ? 0 : f.num.T! * TIME[Tu]
    let t = mode === 't' ? 0 : f.num.t! * TIME[tu]
    let N0 = f.num.N0 ?? 0
    let N = f.num.N ?? 0
    if (mode === 'N') N = remaining(N0, t, T)
    else if (mode === 'N0') N0 = initial(N, t, T)
    else if (mode === 't') t = elapsed(N0, N, T)
    else T = halfLife(N0, N, t)
    return { T, t, N0, N }
  }, [bad, mode, f.num.T, f.num.t, f.num.N0, f.num.N, Tu, tu])

  const D = sol ? (sol.t > 0 ? sol.t : sol.T) : 1
  const scale = decayScale(D, tu)

  /* simulation */
  const canvas = useRef<HTMLCanvasElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const s = useRef(0)
  const hold = useRef(0)
  const times = useMemo(() => (sol ? decayTimes(COUNT, sol.T, 7) : new Float64Array(0)), [sol?.T])
  useEffect(() => {
    s.current = 0
    hold.current = 0
  }, [sol])

  const paint = () => {
    if (!sol) return
    const p = prepCanvas(canvas.current)
    if (!p) return
    const left = drawDecay(p.ctx, p.w, p.h, sol, D, s.current, scale.factor, times, ink, tu)
    if (clock.current) clock.current.textContent = `t = ${fmt(s.current / TIME[tu], 4)} ${UNIT_NAME[tu][1]} · ${left} of ${COUNT} left`
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      if (!sol) return
      if (s.current >= D) {
        hold.current += dt
        if (hold.current > HOLD) {
          s.current = 0
          hold.current = 0
        }
      } else s.current = Math.min(D, s.current + dt * scale.factor)
      paint()
    },
    playing && sol !== null,
  )
  useEffect(() => {
    if (reduced) s.current = D
    paint()
  })

  const T = sol?.T ?? 0
  const halves = sol ? sol.t / sol.T : 0
  const frac = sol ? sol.N / sol.N0 : 0
  const show = (sec: number, u: TimeU) => `${fmt(sec / TIME[u], 6)} ${UNIT_NAME[u][1]}`

  const main =
    mode === 'N'
      ? { label: 'Amount left', value: sol ? fmt(sol.N, 6) : '–' }
      : mode === 'N0'
        ? { label: 'Starting amount', value: sol ? fmt(sol.N0, 6) : '–' }
        : mode === 't'
          ? { label: 'Time', value: sol ? show(sol.t, tu) : '–' }
          : { label: 'Half-life', value: sol ? show(sol.T, Tu) : '–' }

  const working = sol
    ? [
        `N = N₀ × (½)^(t ÷ T½)`,
        mode === 'N'
          ? `N = ${num(sol.N0)} × 0.5^(${num(sol.t / TIME[tu])} ÷ ${num(sol.T / TIME[tu])}) = ${num(sol.N0)} × 0.5^${num(halves)} = ${num(sol.N)}`
          : mode === 'N0'
            ? `N₀ = N ÷ 0.5^(t ÷ T½) = ${num(sol.N)} ÷ 0.5^${num(halves)} = ${num(sol.N0)}`
            : mode === 't'
              ? `t = T½ × log₂(N₀ ÷ N) = ${num(sol.T / TIME[tu])} × log₂(${num(sol.N0)} ÷ ${num(sol.N)}) = ${num(sol.t / TIME[tu])} ${UNIT_NAME[tu][1]}`
              : `T½ = t ÷ log₂(N₀ ÷ N) = ${num(sol.t / TIME[Tu])} ÷ log₂(${num(sol.N0)} ÷ ${num(sol.N)}) = ${num(sol.T / TIME[Tu])} ${UNIT_NAME[Tu][1]}`,
        `half-lives passed = t ÷ T½ = ${num(halves)}`,
        `λ = ln 2 ÷ T½ = ${num(lambda(sol.T / TIME[Tu]))} per ${UNIT_NAME[Tu][0]}`,
      ]
    : []

  const summary = sol
    ? `After ${show(sol.t, tu)}, which is ${dec(halves, 3)} half-lives, ${dec(frac * 100, 3)}% of the starting amount is left. Each square is one of ${COUNT} atoms; each decays at a random moment with the chance the half-life gives, so the count follows the curve on average. The curve is N₀ × (½)^(t ÷ T½).`
    : 'Enter the values to see the decay.'

  return (
    <CalcLayout
      inputs={
        <>
          <SelectField
            label="Find"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'N', label: 'Amount left' },
              { value: 'N0', label: 'Starting amount' },
              { value: 't', label: 'Time' },
              { value: 'T', label: 'Half-life' },
            ]}
          />
          {mode !== 'T' ? (
            <>
              <SelectField
                label="Isotope"
                value={preset}
                onChange={pickPreset}
                options={[...PRESETS.map((p) => ({ value: p.id as Preset, label: `${p.label}, ${fmt(p.half, 4)} ${p.unit === 'yr' ? 'years' : 'days'}` })), { value: 'custom' as Preset, label: 'Other' }]}
              />
              <UnitField label="Half-life" {...f.bind('T')} onChange={(v) => {
                  f.set('T', v)
                  setPreset('custom')
                }} unit={Tu} units={TIME_UNITS} onUnit={(u) => {
                  setTu(u)
                  setPreset('custom')
                }} error={err.T} />
            </>
          ) : null}
          {mode !== 't' ? <UnitField label="Time passed" {...f.bind('t')} unit={tu} units={TIME_UNITS} onUnit={setTu2} error={err.t} /> : null}
          {mode !== 'N0' ? <NumField label="Starting amount" {...f.bind('N0')} error={err.N0} hint="Any unit: grams, atoms, becquerels or 100 for per cent." /> : null}
          {mode !== 'N' ? <NumField label="Amount left" {...f.bind('N')} error={err.N} /> : null}
        </>
      }
      result={
        <Result label={main.label} value={main.value} error={order} copy={sol ? `${main.label}: ${main.value}` : undefined}>
          {sol ? (
            <>
              <Stat label="Left" value={frac * 100} format={(n) => dec(n, 3)} unit="%" />
              <Stat label="Half-lives passed" value={halves} format={(n) => dec(n, 3)} />
              <Stat label="Decay constant λ" value={`${fmt(lambda(T / TIME[Tu]), 4)} per ${UNIT_NAME[Tu][0]}`} />
              <Stat label="Mean life" value={show(T / Math.LN2, Tu)} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={<SimBar playing={playing} onPlaying={setPlaying} onReplay={() => { s.current = 0; hold.current = 0; paint() }} scale={scale.label} reduced={reduced} clock={clock} />}>
          <canvas ref={canvas} className="block aspect-[4/5] w-full sm:aspect-[16/10]" role="img" aria-label={sol ? `${COUNT} atoms decaying; ${dec(frac * 100, 2)}% left after ${dec(halves, 2)} half-lives` : 'Decay'} />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="N₀ is the starting amount, N the amount left, t the time passed and T½ the half-life." /> : null}
    />
  )
}

function drawDecay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sol: { T: number; t: number; N0: number; N: number },
  D: number,
  s: number,
  factor: number,
  times: Float64Array,
  ink: Ink,
  tu: TimeU,
): number {
  const wide = w >= 480
  const side = 20
  const gridSize = wide ? Math.min(h - 32, w * 0.42) : Math.min(w - 32, h * 0.48)
  const gx = wide ? 16 : (w - gridSize) / 2
  const gy = 16
  const cell = gridSize / side
  let left = 0
  for (let i = 0; i < times.length; i++) {
    const cx = gx + (i % side) * cell + cell / 2
    const cy = gy + Math.floor(i / side) * cell + cell / 2
    const ti = times[i]!
    if (ti > s) {
      left++
      ctx.fillStyle = ink.ink
      const q = cell * 0.66
      ctx.fillRect(cx - q / 2, cy - q / 2, q, q)
    } else {
      dot(ctx, cx, cy, cell * 0.12, ink.grey)
      const age = (s - ti) / factor
      if (age < 0.35) {
        const k = age / 0.35
        ctx.globalAlpha = 1 - k
        ctx.strokeStyle = ink.ink
        ctx.lineWidth = 1.25
        ctx.beginPath()
        ctx.arc(cx, cy, cell * (0.35 + k * 0.6), 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
  }

  // decay curve
  const cl = wide ? gx + gridSize + 44 : 44
  const cr = w - 14
  const ct = wide ? 22 : gy + gridSize + 26
  const cb = h - 26
  const X = (t: number) => cl + (t / D) * (cr - cl)
  const Y = (frac: number) => cb - frac * (cb - ct)
  const lab = { color: ink.grey, halo: ink.fill, font: ink.font, size: 11 }
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cl, ct)
  ctx.lineTo(cl, cb)
  ctx.lineTo(cr, cb)
  ctx.stroke()
  for (const p of [1, 0.5, 0.25]) label(ctx, `${p * 100}%`, cl - 6, Y(p) + 4, { ...lab, align: 'right' })
  const tick = niceDomain(0, D / TIME[tu], 3).ticks
  for (const v of tick) {
    const xx = X(v * TIME[tu])
    if (xx > cr + 1) continue
    label(ctx, fmt(v, 4), xx, cb + 15, { ...lab, align: xx > cr - 20 ? 'right' : 'center' })
  }
  for (let k = 1; k * sol.T <= D * 1.0001 && k <= 6; k++) {
    dashed(ctx, X(k * sol.T), cb, X(k * sol.T), Y(Math.pow(0.5, k)), ink.grey, 1, [2, 4])
    const kx = X(k * sol.T)
    if (k <= 3) label(ctx, k === 1 ? 'T½' : `${k}T½`, kx > cr - 28 ? kx - 4 : kx + 3, Y(Math.pow(0.5, k)) - 6, { ...lab, align: kx > cr - 28 ? 'right' : 'left' })
  }
  // full curve faint, flown part in ink
  ctx.save()
  ctx.setLineDash([3, 5])
  ctx.strokeStyle = ink.grey
  ctx.beginPath()
  for (let i = 0; i <= 80; i++) {
    const t = (D * i) / 80
    const y = Y(Math.pow(0.5, t / sol.T))
    if (i === 0) ctx.moveTo(X(t), y)
    else ctx.lineTo(X(t), y)
  }
  ctx.stroke()
  ctx.restore()
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 2.25
  ctx.beginPath()
  const M = Math.max(2, Math.round((80 * s) / D))
  for (let i = 0; i <= M; i++) {
    const t = (s * i) / M
    const y = Y(Math.pow(0.5, t / sol.T))
    if (i === 0) ctx.moveTo(X(t), y)
    else ctx.lineTo(X(t), y)
  }
  ctx.stroke()
  dot(ctx, X(s), Y(Math.pow(0.5, s / sol.T)), 5, ink.ink)
  // the simulated count, for comparison with the curve
  dot(ctx, X(s), Y(left / times.length), 3, ink.grey)
  return left
}
