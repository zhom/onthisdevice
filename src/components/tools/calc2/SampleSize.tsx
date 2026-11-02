import { useState } from 'react'
import { useTweenArray } from '@/components/viz/tween'
import { CalcLayout, NumField, Result, SelectField, Stage, Stat, Working, useFields } from './_viz/Calc'
import { dec, fmt, num } from './_viz/format'
import { marginFor, sampleSize } from './ci'

type Level = '0.8' | '0.85' | '0.9' | '0.95' | '0.98' | '0.99' | '0.999'
const LEVELS: { value: Level; label: string }[] = [
  { value: '0.8', label: '80%' },
  { value: '0.85', label: '85%' },
  { value: '0.9', label: '90%' },
  { value: '0.95', label: '95%' },
  { value: '0.98', label: '98%' },
  { value: '0.99', label: '99%' },
  { value: '0.999', label: '99.9%' },
]
const W = 440
const H = 250
const L = 52
const R = 16
const T = 18
const B = 206
const N = 60

export default function SampleSize() {
  const [levelS, setLevelS] = useState<Level>('0.95')
  const f = useFields({ e: '5', p: '50', pop: '' })
  const level = Number(levelS)
  const { e, p, pop } = f.num
  const popEmpty = f.raw.pop.trim() === ''
  const err = {
    e: e === null ? 'Enter the margin of error.' : e <= 0 || e >= 50 ? 'Use a margin above 0% and below 50%.' : null,
    p: p === null ? 'Enter the expected proportion.' : p <= 0 || p >= 100 ? 'Use a proportion above 0% and below 100%.' : null,
    pop: popEmpty ? null : pop === null || pop < 1 || !Number.isInteger(pop) ? 'Use a whole number, or leave it empty.' : null,
  }
  const ok = !err.e && !err.p && !err.pop
  const N0 = popEmpty ? undefined : (pop ?? undefined)
  const r = ok ? sampleSize(level, e! / 100, p! / 100, N0) : null

  // margin of error against sample size, for the chart
  const nMax = r ? Math.max(40, Math.ceil(r.n * 3)) : 100
  const xs = Array.from({ length: N + 1 }, (_, i) => Math.max(2, Math.round((nMax * (i + 0.5)) / (N + 0.5))))
  const ys = r ? xs.map((n) => marginFor(N0 ? Math.min(n, N0) : n, level, p! / 100, N0) * 100) : xs.map(() => 0)
  const yMax = r ? Math.max(e! * 3, 1) : 15
  const shown = useTweenArray([...ys, r ? r.n : 0, r ? e! : 0])
  const X = (n: number) => L + (n / nMax) * (W - L - R)
  const Y = (m: number) => B - (Math.min(m, yMax) / yMax) * (B - T)
  const path = xs.map((n, i) => `${i ? 'L' : 'M'}${X(n).toFixed(1)},${Y(shown[i] ?? 0).toFixed(1)}`).join('')
  const pn = shown[N + 1] ?? 0
  const pe = shown[N + 2] ?? 0

  const pct = `${dec(level * 100, 1)}%`
  const summary = r
    ? `To be ${pct} confident that the result is within ±${fmt(e!)} points, ask ${r.n.toLocaleString('en-US')} people${N0 ? ` from a population of ${N0.toLocaleString('en-US')}` : ''}. The curve shows how the margin of error falls as the sample grows: it halves only when the sample is four times larger.`
    : 'Enter a margin of error and a proportion to see the sample size.'

  const z = r?.z ?? 0
  const working = r
    ? [
        `z for ${pct} = ${num(z)}`,
        `n₀ = z² × p(1 − p) ÷ E² = ${num(z)}² × ${num(p! / 100)} × ${num(1 - p! / 100)} ÷ ${num(e! / 100)}² = ${num(r.n0)}`,
        ...(N0 ? [`n = n₀ ÷ (1 + (n₀ − 1) ÷ N) = ${num(r.n0)} ÷ (1 + ${num(r.n0 - 1)} ÷ ${N0}) = ${num(r.nAdj)}`] : []),
        `round up: n = ${r.n}`,
      ]
    : []

  return (
    <CalcLayout
      inputs={
        <>
          <SelectField label="Confidence level" value={levelS} onChange={setLevelS} options={LEVELS} />
          <NumField label="Margin of error" {...f.bind('e')} unit="%" error={err.e} slider={{ min: 1, max: 10, step: 0.5 }} />
          <NumField label="Expected proportion" {...f.bind('p')} unit="%" error={err.p} hint="Use 50% when you do not know. It gives the largest sample." />
          <NumField label="Population size" {...f.bind('pop')} inputMode="numeric" placeholder="Large or unknown" error={err.pop} hint="Leave empty for a large population." />
        </>
      }
      result={
        <Result
          label="Sample size"
          value={r ? r.n : '–'}
          format={(n) => Math.round(n).toLocaleString('en-US')}
          unit={r ? 'responses' : undefined}
          sub={r ? `${dec(r.nAdj, 2)} before rounding up` : undefined}
          error={ok ? null : (err.e ?? err.p ?? err.pop)}
          copy={r ? `Sample size ${r.n} (${pct} confidence, ±${fmt(e!)}% margin, p = ${fmt(p!)}%${N0 ? `, population ${N0}` : ''})` : undefined}
        >
          {r ? (
            <>
              <Stat label="z" value={dec(z, 4)} />
              <Stat label="Unlimited population" value={Math.ceil(r.n0 - 1e-9).toLocaleString('en-US')} />
              <Stat label="Margin at this size" value={`±${dec(marginFor(r.n, level, p! / 100, N0) * 100, 3)}%`} />
              <Stat label="For half the margin" value={sampleSize(level, e! / 200, p! / 100, N0).n.toLocaleString('en-US')} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary}>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Margin of error against sample size">
            <line x1={L} x2={W - R} y1={B} y2={B} className="stroke-muted-foreground" />
            <line x1={L} x2={L} y1={T} y2={B} className="stroke-muted-foreground" />
            {[0, 1, 2, 3].map((k) => (
              <text key={k} x={L - 8} y={Y((yMax * k) / 3) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
                {fmt((yMax * k) / 3, 3)}%
              </text>
            ))}
            {[0, 1, 2, 3].map((k) => (
              <text key={k} x={X((nMax * k) / 3)} y={B + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {Math.round((nMax * k) / 3).toLocaleString('en-US')}
              </text>
            ))}
            <text x={W - R} y={B + 36} textAnchor="end" className="fill-muted-foreground text-[11px] font-[560]">
              sample size
            </text>
            <path d={path} className="fill-none stroke-foreground" strokeWidth={2.25} strokeLinejoin="round" />
            {r ? (
              <g>
                <line x1={X(pn)} x2={X(pn)} y1={Y(pe)} y2={B} className="stroke-muted-foreground" strokeDasharray="3 4" />
                <line x1={L} x2={X(pn)} y1={Y(pe)} y2={Y(pe)} className="stroke-muted-foreground" strokeDasharray="3 4" />
                <circle cx={X(pn)} cy={Y(pe)} r={6} className="fill-foreground" />
                <text x={X(pn) + 10} y={Y(pe) - 10} className="fill-foreground text-[13px] font-[650]">
                  n = {r.n.toLocaleString('en-US')}, ±{fmt(e!)}%
                </text>
              </g>
            ) : null}
          </svg>
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="E is the margin of error and p the expected proportion, both as decimals; N is the population." /> : null}
    />
  )
}
