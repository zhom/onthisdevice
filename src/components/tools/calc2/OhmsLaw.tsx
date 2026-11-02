import { useEffect, useRef, useState } from 'react'
import { CalcLayout, Result, SelectField, SimBar, Stage, Stat, UnitField, Working, useFields } from './_viz/Calc'
import { dot, label } from './_viz/draw'
import { fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { siPrefix, solveOhm } from './ohm'
import type { OhmKey, OhmValues } from './ohm'

const UNITS = {
  V: { mV: 1e-3, V: 1, kV: 1e3 },
  I: { µA: 1e-6, mA: 1e-3, A: 1 },
  R: { Ω: 1, kΩ: 1e3, MΩ: 1e6 },
  P: { mW: 1e-3, W: 1, kW: 1e3 },
} as const
type UnitOf<K extends OhmKey> = keyof (typeof UNITS)[K] & string
const BASE: Record<OhmKey, string> = { V: 'V', I: 'A', R: 'Ω', P: 'W' }
const NAME: Record<OhmKey, string> = { V: 'Voltage', I: 'Current', R: 'Resistance', P: 'Power' }

type Pair = 'VR' | 'VI' | 'IR' | 'PV' | 'PI' | 'PR'
const PAIRS: { value: Pair; label: string }[] = [
  { value: 'VR', label: 'Voltage and resistance' },
  { value: 'VI', label: 'Voltage and current' },
  { value: 'IR', label: 'Current and resistance' },
  { value: 'PV', label: 'Power and voltage' },
  { value: 'PI', label: 'Power and current' },
  { value: 'PR', label: 'Power and resistance' },
]

/** 0.0545 A -> "54.5 mA". */
function withPrefix(n: number, unit: string): string {
  const { value, prefix } = siPrefix(n)
  return `${fmt(value, 4)} ${prefix}${unit}`
}

export default function OhmsLaw() {
  const [pair, setPair] = useState<Pair>('VR')
  const f = useFields({ V: '12', I: '2', R: '6', P: '24' })
  const [u, setU] = useState<{ V: UnitOf<'V'>; I: UnitOf<'I'>; R: UnitOf<'R'>; P: UnitOf<'P'> }>({ V: 'V', I: 'A', R: 'Ω', P: 'W' })
  const known = pair.split('') as [OhmKey, OhmKey]
  const unknown = (['I', 'V', 'R', 'P'] as OhmKey[]).filter((k) => !known.includes(k))

  const si = (k: OhmKey): number | null => {
    const n = f.num[k]
    const table = UNITS[k] as Record<string, number>
    return n === null ? null : n * (table[u[k]] ?? 1)
  }
  const err = (k: OhmKey) => {
    const n = f.num[k]
    return n === null ? `Enter the ${NAME[k].toLowerCase()}.` : n <= 0 ? `The ${NAME[k].toLowerCase()} must be above zero.` : null
  }
  const [a, b] = known
  const av = si(a)
  const bv = si(b)
  const sol = av !== null && bv !== null && !err(a) && !err(b) ? solveOhm(a, av, b, bv) : null
  const v = sol?.values ?? null

  /* simulation: charges move around the loop */
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const offset = useRef(0)
  const speed = v ? chargeSpeed(v.I) : 0

  const paint = () => {
    if (!v) return
    const p = prepCanvas(canvas.current)
    if (p) drawCircuit(p.ctx, p.w, p.h, v, offset.current, ink)
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      offset.current += speed * dt
      paint()
    },
    playing && v !== null,
  )
  useEffect(() => {
    paint()
  })

  const field = (k: OhmKey) => (
    <UnitField
      key={k}
      label={`${NAME[k]} (${k})`}
      {...f.bind(k)}
      unit={u[k]}
      units={Object.keys(UNITS[k]).map((x) => ({ value: x, label: x }))}
      onUnit={(x) => setU((o) => ({ ...o, [k]: x }))}
      error={err(k)}
    />
  )

  const main = unknown[0]!
  const working =
    sol && v
      ? [
          `Known: ${known.map((k) => `${k} = ${num(v[k])} ${BASE[k]}`).join(', ')}`,
          ...unknown.map((k) => {
            const rule = sol.rules[k]!
            const [lhs, rhs] = rule.split(' = ')
            const subbed = rhs!.replace(/[VIRP]/g, (s) => num(v[s as OhmKey]))
            return `${lhs} = ${rhs} = ${subbed} = ${num(v[k])} ${BASE[k]}`
          }),
        ]
      : []

  const summary = v
    ? `A ${withPrefix(v.V, 'V')} source drives ${withPrefix(v.I, 'A')} through ${withPrefix(v.R, 'Ω')}, and the resistor turns ${withPrefix(v.P, 'W')} into heat. The dots are charges moving in the direction of conventional current, from + through the resistor to −; they move faster as the current grows, but their speed is not to scale.`
    : 'Enter two values to see the circuit.'

  return (
    <CalcLayout
      inputs={
        <>
          <SelectField label="I know" value={pair} onChange={setPair} options={PAIRS} />
          {known.map(field)}
        </>
      }
      result={
        <Result
          label={NAME[main]}
          value={v ? withPrefix(v[main], BASE[main]) : '–'}
          copy={v ? `V = ${withPrefix(v.V, 'V')}, I = ${withPrefix(v.I, 'A')}, R = ${withPrefix(v.R, 'Ω')}, P = ${withPrefix(v.P, 'W')}` : undefined}
        >
          {v ? (['V', 'I', 'R', 'P'] as OhmKey[]).filter((k) => k !== main).map((k) => <Stat key={k} label={`${NAME[k]} (${k})`} value={withPrefix(v[k], BASE[k])} />) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={<SimBar playing={playing} onPlaying={setPlaying} scale="Charge speed not to scale" reduced={reduced} />}>
          <canvas ref={canvas} className="block aspect-[4/3] w-full sm:aspect-[16/10]" role="img" aria-label={v ? `Circuit: ${withPrefix(v.V, 'V')} source, ${withPrefix(v.R, 'Ω')} resistor, ${withPrefix(v.I, 'A')} current` : 'Circuit'} />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="Ohm's law V = I × R and power P = V × I, in volts, amperes, ohms and watts." /> : null}
    />
  )
}

/** Dot speed in px/s: grows with the current on a log scale, not to scale. */
function chargeSpeed(I: number): number {
  const t = Math.min(1.4, Math.max(0, (Math.log10(I) + 4) / 5))
  return 14 + 70 * t
}

function drawCircuit(ctx: CanvasRenderingContext2D, w: number, h: number, v: OhmValues, offset: number, ink: Ink) {
  const pad = Math.max(28, w * 0.1)
  const x0 = pad
  const x1 = w - pad
  const y0 = h * 0.2
  const y1 = h * 0.82
  const W = x1 - x0
  const H = y1 - y0
  const per = 2 * (W + H)
  const midY = (y0 + y1) / 2
  const batt = 16 // half gap of the battery on the left wire
  const res = Math.min(H * 0.32, 60) // half length of the resistor on the right wire

  // wires
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x0, midY - batt)
  ctx.lineTo(x0, y0)
  ctx.lineTo(x1, y0)
  ctx.lineTo(x1, midY - res)
  ctx.moveTo(x1, midY + res)
  ctx.lineTo(x1, y1)
  ctx.lineTo(x0, y1)
  ctx.lineTo(x0, midY + batt)
  ctx.stroke()

  // battery: long plate (+) on top, short plate (−) below
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x0 - 18, midY - batt)
  ctx.lineTo(x0 + 18, midY - batt)
  ctx.stroke()
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(x0 - 9, midY + batt)
  ctx.lineTo(x0 + 9, midY + batt)
  ctx.stroke()
  const lab = { color: ink.ink, halo: ink.fill, font: ink.font, size: 12 }
  label(ctx, '+', x0 + 24, midY - batt + 4, { ...lab, size: 14 })
  label(ctx, '−', x0 + 16, midY + batt + 5, { ...lab, size: 14 })
  label(ctx, withPrefix(v.V, 'V'), x0 + 30, midY + 4, { ...lab, weight: 650 })

  // resistor zigzag
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x1, midY - res)
  const zig = 8
  for (let i = 1; i < zig; i++) ctx.lineTo(x1 + (i % 2 ? 10 : -10), midY - res + (2 * res * i) / zig)
  ctx.lineTo(x1, midY + res)
  ctx.stroke()
  label(ctx, withPrefix(v.R, 'Ω'), x1 - 20, midY - 4, { ...lab, align: 'right', weight: 650 })
  label(ctx, `${withPrefix(v.P, 'W')} heat`, x1 - 20, midY + 14, { ...lab, color: ink.grey, align: 'right' })
  label(ctx, `I = ${withPrefix(v.I, 'A')}`, (x0 + x1) / 2, y0 - 10, { ...lab, align: 'center', weight: 650 })

  // charges: clockwise from the + terminal
  const at = (s: number): [number, number] => {
    let d = ((s % per) + per) % per
    // start at the battery, going up the left wire
    const startUp = midY - y0
    const seg: [number, number, number, number][] = [
      [x0, midY, x0, y0],
      [x0, y0, x1, y0],
      [x1, y0, x1, y1],
      [x1, y1, x0, y1],
      [x0, y1, x0, midY],
    ]
    const lens = [startUp, W, H, W, y1 - midY]
    for (let i = 0; i < seg.length; i++) {
      const L = lens[i]!
      if (d <= L) {
        const [ax, ay, bx, by] = seg[i]!
        const t = L === 0 ? 0 : d / L
        return [ax + (bx - ax) * t, ay + (by - ay) * t]
      }
      d -= L
    }
    return [x0, midY]
  }
  const gap = 26
  const n = Math.floor(per / gap)
  for (let i = 0; i < n; i++) {
    const [x, y] = at(offset + (i * per) / n)
    if (x === x0 && Math.abs(y - midY) < batt + 4) continue
    dot(ctx, x, y, 3.2, ink.ink)
  }
}
