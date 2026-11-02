import { useState } from 'react'
import { useTween } from '@/components/viz/tween'
import { CalcLayout, Choice, NumField, Result, Stage, Stat, Working, useFields } from './_viz/Calc'
import { dec, fmt, num, sub } from './_viz/format'
import { Phi, phi } from './normal'

type Tail = 'left' | 'right' | 'two'
const TAILS: { value: Tail; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'two', label: 'Two tails' },
]

const W = 440
const BASE = 196
const TOP = 34
const sx = (z: number) => 20 + ((z + 4) / 8) * (W - 40)
const sy = (d: number) => BASE - (d / phi(0)) * (BASE - TOP)

function areaPath(a: number, b: number): string {
  if (b <= a) return ''
  const n = Math.max(2, Math.ceil((b - a) * 24))
  let d = `M${sx(a).toFixed(1)},${BASE}`
  for (let i = 0; i <= n; i++) {
    const z = a + ((b - a) * i) / n
    d += `L${sx(z).toFixed(1)},${sy(phi(z)).toFixed(1)}`
  }
  return `${d}L${sx(b).toFixed(1)},${BASE}Z`
}

const CURVE = Array.from({ length: 193 }, (_, i) => {
  const z = -4 + i / 24
  return `${i ? 'L' : 'M'}${sx(z).toFixed(1)},${sy(phi(z)).toFixed(1)}`
}).join('')

export default function ZScore() {
  const f = useFields({ x: '85', mean: '70', sd: '10' })
  const [tail, setTail] = useState<Tail>('left')
  const { x, mean, sd } = f.num
  const err = {
    x: x === null ? 'Enter a value.' : null,
    mean: mean === null ? 'Enter the mean.' : null,
    sd: sd === null ? 'Enter the standard deviation.' : sd <= 0 ? 'The standard deviation must be above zero.' : null,
  }
  const ok = !err.x && !err.mean && !err.sd
  const z = ok ? (x! - mean!) / sd! : 0
  const left = Phi(z)
  const right = 1 - left
  const two = 2 * Phi(-Math.abs(z))
  const shown = tail === 'left' ? left : tail === 'right' ? right : two
  const P = (p: number) => (p < 1e-4 ? fmt(p, 4) : dec(p, 5))

  const zc = Math.max(-4, Math.min(4, z))
  const zt = useTween(ok ? zc : 0, { from: -4 })
  const za = Math.abs(zt)
  const shade =
    tail === 'left' ? areaPath(-4, zt) : tail === 'right' ? areaPath(zt, 4) : `${areaPath(-4, -za)}${areaPath(za, 4)}`

  const tailText = tail === 'left' ? `below z = ${dec(z, 3)}` : tail === 'right' ? `above z = ${dec(z, 3)}` : `beyond ±${dec(Math.abs(z), 3)}`
  const summary = ok
    ? `A value of ${fmt(x!)} is ${dec(Math.abs(z), 3)} standard deviations ${z >= 0 ? 'above' : 'below'} the mean of ${fmt(mean!)}. The shaded area, ${P(shown)} of the curve, is the part ${tailText}. ${dec(left * 100, 2)}% of a normal population is below this value.`
    : 'Enter a value, the mean and the standard deviation to see the curve.'

  const working = ok
    ? [
        `z = (x − μ) ÷ σ = (${num(x!)} − ${sub(mean!)}) ÷ ${num(sd!)} = ${num(z)}`,
        `P(Z < z) = Φ(${num(z, 4)}) = ${num(left, 7)}`,
        `P(Z > z) = 1 − Φ(${num(z, 4)}) = ${num(right, 7)}`,
        `two-tailed p = 2 × Φ(−|z|) = 2 × ${num(Phi(-Math.abs(z)), 7)} = ${num(two, 7)}`,
        `percentile = Φ(z) × 100 = ${num(left * 100, 6)}`,
      ]
    : []

  return (
    <CalcLayout
      inputs={
        <>
          <NumField label="Value (x)" {...f.bind('x')} error={err.x} />
          <NumField label="Mean (μ)" {...f.bind('mean')} error={err.mean} />
          <NumField label="Standard deviation (σ)" {...f.bind('sd')} error={err.sd} />
          <Choice label="Shade the area" value={tail} onChange={setTail} options={TAILS} />
        </>
      }
      result={
        <Result
          label="Z-score"
          value={ok ? z : '–'}
          format={(n) => dec(n, 4)}
          sub={ok ? `Percentile ${dec(left * 100, 2)}` : undefined}
          error={ok ? null : (err.sd ?? err.x ?? err.mean)}
          copy={ok ? `z = ${dec(z, 4)}, P(Z < z) = ${P(left)}, P(Z > z) = ${P(right)}, two-tailed p = ${P(two)}` : undefined}
        >
          <Stat label="P(Z < z), left" value={P(left)} />
          <Stat label="P(Z > z), right" value={P(right)} />
          <Stat label="Two-tailed p" value={P(two)} />
          <Stat label="Between −|z| and |z|" value={P(1 - two)} />
        </Result>
      }
      visual={
        <Stage summary={summary}>
          <svg viewBox={`0 0 ${W} 240`} className="block h-auto w-full" role="img" aria-label={`Normal curve with the area ${tailText} shaded`}>
            <path d={shade} className="fill-muted-foreground" />
            <path d={CURVE} className="fill-none stroke-foreground" strokeWidth={2.25} />
            <line x1={14} x2={W - 14} y1={BASE} y2={BASE} className="stroke-muted-foreground" strokeWidth={1} />
            {[-3, -2, -1, 0, 1, 2, 3].map((k) => (
              <g key={k}>
                <line x1={sx(k)} x2={sx(k)} y1={BASE} y2={BASE + 5} className="stroke-muted-foreground" />
                <text x={sx(k)} y={BASE + 19} textAnchor="middle" className="fill-muted-foreground text-[12px] font-[560]">
                  {k === 0 ? '0' : `${k < 0 ? '−' : ''}${Math.abs(k)}σ`}
                </text>
                {ok ? (
                  <text x={sx(k)} y={BASE + 35} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                    {fmt(mean! + k * sd!, 4)}
                  </text>
                ) : null}
              </g>
            ))}
            <line x1={sx(zt)} x2={sx(zt)} y1={BASE} y2={sy(phi(zt)) - 10} className="stroke-foreground" strokeWidth={2} />
            <text x={Math.min(W - 40, Math.max(40, sx(zt)))} y={Math.min(sy(phi(zt)) - 16, BASE - 30)} textAnchor="middle" className="fill-foreground text-[13px] font-[650]">
              z = {dec(z, 2)}
            </text>
          </svg>
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="Φ is the standard normal cumulative distribution function." /> : null}
    />
  )
}
