import { useEffect, useRef, useState } from 'react'
import { useTween } from '@/components/viz/tween'
import { CalcLayout, NumField, Result, SelectField, SimBar, Stage, Stat, UnitField, Working, useFields } from './_viz/Calc'
import { dot, label } from './_viz/draw'
import { fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { GAS_VOLUME, PRESSURE, R, fromKelvin, solveGas, toKelvin } from './gas'
import type { Gas, GasKey, GasVolumeUnit, PressureUnit, TempUnit } from './gas'

const P_UNITS = (Object.keys(PRESSURE) as PressureUnit[]).map((u) => ({ value: u, label: u }))
const V_UNITS = (Object.keys(GAS_VOLUME) as GasVolumeUnit[]).map((u) => ({ value: u, label: u }))
const T_UNITS: { value: TempUnit; label: string }[] = [
  { value: 'K', label: 'K' },
  { value: '°C', label: '°C' },
  { value: '°F', label: '°F' },
]
const NAMES: Record<GasKey, string> = { P: 'Pressure', V: 'Volume', n: 'Amount of gas', T: 'Temperature' }
const AVOGADRO = 6.02214076e23
/** Box width fraction for a volume: grows with V, not to scale. */
const VREF = 0.0245

interface Particle {
  u: number
  v: number
  dx: number
  dy: number
  /** Speed factor from a 2D Maxwell (Rayleigh) distribution, rms 1. */
  k: number
}

function rayleigh(): number {
  return Math.sqrt(-Math.log(1 - Math.random()))
}

function makeParticle(): Particle {
  const a = Math.random() * Math.PI * 2
  return { u: Math.random(), v: Math.random(), dx: Math.cos(a), dy: Math.sin(a), k: rayleigh() }
}

export default function IdealGasLaw() {
  const [find, setFind] = useState<GasKey>('V')
  const f = useFields({ P: '1', V: '24.465', n: '1', T: '25' })
  const [pu, setPu] = useState<PressureUnit>('atm')
  const [vu, setVu] = useState<GasVolumeUnit>('L')
  const [tu, setTu] = useState<TempUnit>('°C')

  const errOf = (k: GasKey): string | null => {
    if (k === find) return null
    const n = f.num[k]
    if (n === null) return `Enter the ${NAMES[k].toLowerCase()}.`
    if (k === 'T') return toKelvin(n, tu) <= 0 ? 'The temperature must be above absolute zero.' : null
    return n <= 0 ? `The ${NAMES[k].toLowerCase()} must be above zero.` : null
  }
  const err = { P: errOf('P'), V: errOf('V'), n: errOf('n'), T: errOf('T') }
  const ok = !err.P && !err.V && !err.n && !err.T
  const gas: Gas | null = ok
    ? solveGas(find, {
        P: find === 'P' ? undefined : f.num.P! * PRESSURE[pu],
        V: find === 'V' ? undefined : f.num.V! * GAS_VOLUME[vu],
        n: find === 'n' ? undefined : f.num.n!,
        T: find === 'T' ? undefined : toKelvin(f.num.T!, tu),
      })
    : null
  const valid = gas !== null && Number.isFinite(gas[find]) && gas[find] > 0

  /* simulation */
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const parts = useRef<Particle[]>([])
  const count = valid ? Math.max(8, Math.min(220, Math.round(gas!.n * 60))) : 0
  const speed = valid ? Math.min(420, Math.max(8, 70 * Math.sqrt(gas!.T / 298.15))) : 0
  const frac = useTween(valid ? 0.3 + (0.65 * gas!.V) / (gas!.V + VREF) : 0.6)
  useEffect(() => {
    const a = parts.current
    while (a.length < count) a.push(makeParticle())
    if (a.length > count) a.length = count
  }, [count])

  const paint = () => {
    if (!valid) return
    const p = prepCanvas(canvas.current)
    if (p) drawGas(p.ctx, p.w, p.h, parts.current, frac, gas!, pu, vu, tu, ink)
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      const c = canvas.current
      if (!c) return
      const { bw, bh } = boxSize(c.clientWidth, c.clientHeight, frac)
      for (const q of parts.current) {
        q.u += (q.dx * q.k * speed * dt) / bw
        q.v += (q.dy * q.k * speed * dt) / bh
        if (q.u < 0 || q.u > 1) {
          q.dx = q.u < 0 ? Math.abs(q.dx) : -Math.abs(q.dx)
          q.u = Math.min(1, Math.max(0, q.u < 0 ? -q.u : 2 - q.u))
        }
        if (q.v < 0 || q.v > 1) {
          q.dy = q.v < 0 ? Math.abs(q.dy) : -Math.abs(q.dy)
          q.v = Math.min(1, Math.max(0, q.v < 0 ? -q.v : 2 - q.v))
        }
      }
      paint()
    },
    playing && valid,
  )
  useEffect(() => {
    paint()
  })

  const show = (k: GasKey): string => {
    if (!gas) return '–'
    if (k === 'P') return `${fmt(gas.P / PRESSURE[pu], 5)} ${pu}`
    if (k === 'V') return `${fmt(gas.V / GAS_VOLUME[vu], 5)} ${vu}`
    if (k === 'n') return `${fmt(gas.n, 5)} mol`
    return `${fmt(fromKelvin(gas.T, tu), 5)} ${tu}`
  }

  const working = valid
    ? [
        `SI values: P = ${num(gas!.P)} Pa, V = ${num(gas!.V)} m³, n = ${num(gas!.n)} mol, T = ${num(gas!.T)} K`,
        find === 'P'
          ? `P = nRT ÷ V = ${num(gas!.n)} × ${R} × ${num(gas!.T)} ÷ ${num(gas!.V)} = ${num(gas!.P)} Pa`
          : find === 'V'
            ? `V = nRT ÷ P = ${num(gas!.n)} × ${R} × ${num(gas!.T)} ÷ ${num(gas!.P)} = ${num(gas!.V)} m³`
            : find === 'n'
              ? `n = PV ÷ RT = ${num(gas!.P)} × ${num(gas!.V)} ÷ (${R} × ${num(gas!.T)}) = ${num(gas!.n)} mol`
              : `T = PV ÷ nR = ${num(gas!.P)} × ${num(gas!.V)} ÷ (${num(gas!.n)} × ${R}) = ${num(gas!.T)} K`,
        `${NAMES[find]} = ${show(find)}`,
      ]
    : []

  const summary = valid
    ? `${fmt(gas!.n, 4)} mol of gas at ${show('T')} in ${show('V')} presses on the walls with ${show('P')}. The dots stand for molecules: their number follows the amount of gas, their speed follows the square root of the absolute temperature, and the piston moves out as the volume grows. Speeds and sizes are not to scale.`
    : 'Enter three values to see the gas.'

  return (
    <CalcLayout
      inputs={
        <>
          <SelectField
            label="Find"
            value={find}
            onChange={setFind}
            options={(['P', 'V', 'n', 'T'] as GasKey[]).map((k) => ({ value: k, label: NAMES[k] }))}
          />
          {find !== 'P' ? <UnitField label="Pressure (P)" {...f.bind('P')} unit={pu} units={P_UNITS} onUnit={setPu} error={err.P} /> : null}
          {find !== 'V' ? <UnitField label="Volume (V)" {...f.bind('V')} unit={vu} units={V_UNITS} onUnit={setVu} error={err.V} /> : null}
          {find !== 'n' ? <NumField label="Amount of gas (n)" {...f.bind('n')} unit="mol" error={err.n} /> : null}
          {find !== 'T' ? <UnitField label="Temperature (T)" {...f.bind('T')} unit={tu} units={T_UNITS} onUnit={setTu} error={err.T} /> : null}
          {find === 'P' ? <SelectField label="Show pressure in" value={pu} onChange={setPu} options={P_UNITS} /> : null}
          {find === 'V' ? <SelectField label="Show volume in" value={vu} onChange={setVu} options={V_UNITS} /> : null}
          {find === 'T' ? <SelectField label="Show temperature in" value={tu} onChange={setTu} options={T_UNITS} /> : null}
        </>
      }
      result={
        <Result
          label={NAMES[find]}
          value={valid ? show(find) : '–'}
          error={ok && !valid ? 'These values give no physical result.' : null}
          copy={valid ? `P = ${show('P')}, V = ${show('V')}, n = ${show('n')}, T = ${show('T')}` : undefined}
        >
          {valid ? (
            <>
              {find !== 'P' || pu !== 'kPa' ? <Stat label="Pressure" value={`${fmt(gas!.P / 1000, 5)} kPa`} /> : null}
              {find !== 'V' || vu !== 'L' ? <Stat label="Volume" value={`${fmt(gas!.V * 1000, 5)} L`} /> : null}
              {find !== 'T' || tu !== 'K' ? <Stat label="Temperature" value={`${fmt(gas!.T, 5)} K`} /> : null}
              <Stat label="Molar volume" value={`${fmt((gas!.V * 1000) / gas!.n, 5)} L/mol`} />
              <Stat label="Molecules" value={fmt(gas!.n * AVOGADRO, 4)} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={<SimBar playing={playing} onPlaying={setPlaying} scale="Speeds not to scale" reduced={reduced} />}>
          <canvas ref={canvas} className="block aspect-[4/3] w-full sm:aspect-[16/10]" role="img" aria-label={valid ? `Gas particles in a box with a piston; pressure ${show('P')}` : 'Gas in a box'} />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="PV = nRT with R = 8.314462618 J/(mol·K). Pressure in pascals, volume in cubic metres, temperature in kelvin." /> : null}
    />
  )
}

function boxSize(w: number, h: number, frac: number) {
  const left = 18
  const top = 34
  const bh = h - top - 18
  const maxW = w - left - 40
  return { left, top, bw: Math.max(20, maxW * frac), bh }
}

function drawGas(ctx: CanvasRenderingContext2D, w: number, h: number, parts: Particle[], frac: number, gas: Gas, pu: PressureUnit, vu: GasVolumeUnit, tu: TempUnit, ink: Ink) {
  const { left, top, bw, bh } = boxSize(w, h, frac)
  const lab = { color: ink.ink, halo: ink.fill, font: ink.font, size: 12, weight: 650 }
  label(ctx, `P = ${fmt(gas.P / PRESSURE[pu], 4)} ${pu}`, left, 20, lab)
  label(ctx, `T = ${fmt(fromKelvin(gas.T, tu), 4)} ${tu}`, w - 16, 20, { ...lab, align: 'right', color: ink.grey, weight: 560 })

  // walls
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(w - 16, top)
  ctx.lineTo(left, top)
  ctx.lineTo(left, top + bh)
  ctx.lineTo(w - 16, top + bh)
  ctx.stroke()

  // particles
  for (const q of parts) dot(ctx, left + 4 + q.u * (bw - 8), top + 4 + q.v * (bh - 8), 2.6, ink.ink)

  // piston and rod
  const px = left + bw
  ctx.fillStyle = ink.ink
  ctx.fillRect(px, top + 2, 8, bh - 4)
  ctx.fillStyle = ink.grey
  ctx.fillRect(px + 8, top + bh / 2 - 3, Math.max(0, w - 16 - px - 8), 6)
  label(ctx, `V = ${fmt(gas.V / GAS_VOLUME[vu], 4)} ${vu}`, px - 8, top + bh - 10, { ...lab, align: 'right', color: ink.grey, weight: 560 })
}
