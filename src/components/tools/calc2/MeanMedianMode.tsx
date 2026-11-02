import { useState } from 'react'
import { niceDomain } from '@/components/viz/scale'
import { useTween } from '@/components/viz/tween'
import { CalcLayout, NumField, Result, Stage, Stat, Working } from './_viz/Calc'
import { fmt, num } from './_viz/format'
import { central, parseList } from './central'
import type { Central } from './central'

const W = 440
const H = 250
const AXIS = 188

export default function MeanMedianMode() {
  const [raw, setRaw] = useState('4, 8, 15, 16, 23, 42, 8, 15, 8')
  const { values, bad } = parseList(raw)
  const c = values.length ? central(values) : null
  const error = bad.length ? `Not a number: ${bad.slice(0, 3).join(', ')}` : !c ? 'Enter at least one number.' : null
  const modes = c ? (c.modes.length ? c.modes.map((m) => fmt(m)).join(', ') : 'none') : '–'

  const summary = c
    ? `${c.count} values from ${fmt(c.min)} to ${fmt(c.max)}. The mean, ${fmt(c.mean, 6)}, is the balance point under the dots; the median, ${fmt(c.median)}, has as many values below it as above; ${c.modes.length ? `the mode${c.modes.length > 1 ? 's are' : ' is'} ${modes}, the tallest stack (${c.modeCount} times)` : 'there is no mode: every value occurs once'}.`
    : 'Enter numbers to see them on a dot plot.'

  const working = c
    ? [
        `sorted: ${c.sorted.map((v) => num(v)).join(', ')}`,
        `mean   = sum ÷ count = ${num(c.sum, 10)} ÷ ${c.count} = ${num(c.mean, 10)}`,
        c.count % 2
          ? `median = middle value (number ${(c.count + 1) / 2} of ${c.count}) = ${num(c.median)}`
          : `median = mean of values ${c.count / 2} and ${c.count / 2 + 1} = (${num(c.sorted[c.count / 2 - 1]!)} + ${num(c.sorted[c.count / 2]!)}) ÷ 2 = ${num(c.median)}`,
        `mode   = ${c.modes.length ? `${modes} (${c.modeCount} times each)` : 'none, no value repeats'}`,
        `range  = max − min = ${num(c.max)} − ${num(c.min)} = ${num(c.range)}`,
      ]
    : []

  return (
    <CalcLayout
      inputs={
        <NumField
          label="Numbers"
          value={raw}
          onChange={setRaw}
          inputMode="text"
          error={bad.length ? error : null}
          hint="Separate them with commas, spaces or new lines."
        />
      }
      result={
        <Result
          label="Mean (average)"
          value={c && !bad.length ? c.mean : '–'}
          format={(n) => fmt(n, 8)}
          error={error}
          copy={c ? `Mean ${fmt(c.mean, 10)}, median ${fmt(c.median)}, mode ${modes}, range ${fmt(c.range)}` : undefined}
        >
          {c ? (
            <>
              <Stat label="Median" value={fmt(c.median, 8)} />
              <Stat label={c.modes.length > 1 ? 'Modes' : 'Mode'} value={modes} />
              <Stat label="Range" value={fmt(c.range, 8)} />
              <Stat label="Count" value={String(c.count)} />
              <Stat label="Sum" value={fmt(c.sum, 10)} />
              <Stat label="Minimum, maximum" value={`${fmt(c.min)}, ${fmt(c.max)}`} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary}>{c && !bad.length ? <DotPlot key={c.values.join(',')} c={c} /> : <div className="aspect-[440/250]" />}</Stage>
      }
      working={working.length && !bad.length ? <Working lines={working} /> : null}
    />
  )
}

/** Dots drop in one by one onto their values; the balance point slides to the mean. */
function DotPlot({ c }: { c: Central }) {
  const n = c.values.length
  const p = useTween(1, { from: 0, duration: Math.min(2400, 500 + n * 110) })
  const dom = niceDomain(c.min, c.max === c.min ? c.min + 1 : c.max, 5)
  const X = (v: number) => 28 + ((v - dom.min) / (dom.max - dom.min || 1)) * (W - 56)
  // Dots stack in bins one dot wide, so close values do not overlap.
  const BIN = 15
  const binOf = (v: number) => Math.round((X(v) - 28) / BIN)
  const counts = new Map<number, number>()
  let tall = 1
  for (const v of c.values) {
    const k = (counts.get(binOf(v)) ?? 0) + 1
    counts.set(binOf(v), k)
    tall = Math.max(tall, k)
  }
  const r = Math.max(2.5, Math.min(7, (AXIS - 40) / (tall * 2.2)))
  const level = new Map<number, number>()
  const mean = dom.min + (c.mean - dom.min) * Math.min(1, p * 1.2)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Dot plot with the mean, median and mode marked">
      <line x1={16} x2={W - 16} y1={AXIS} y2={AXIS} className="stroke-muted-foreground" />
      {dom.ticks.map((t) => (
        <text key={t} x={X(t)} y={AXIS + 34} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          {fmt(t, 4)}
        </text>
      ))}
      {c.values.map((v, i) => {
        const bin = binOf(v)
        const k = (level.get(bin) ?? 0) + 1
        level.set(bin, k)
        const e = Math.min(1, Math.max(0, p * (n + 3) - i) / 3)
        const y = AXIS - r - (k - 1) * r * 2.1
        const drop = (1 - e * e * (3 - 2 * e)) * (y + r)
        return <circle key={i} cx={28 + bin * BIN} cy={y - drop} r={r * 0.92} className="fill-foreground" opacity={e > 0 ? 1 : 0} />
      })}
      <line x1={X(c.median)} x2={X(c.median)} y1={24} y2={AXIS} className="stroke-muted-foreground" strokeDasharray="3 4" strokeWidth={1.5} />
      <text x={Math.min(W - 30, Math.max(30, X(c.median)))} y={16} textAnchor="middle" className="fill-muted-foreground text-[12px] font-[600]">
        median {fmt(c.median, 4)}
      </text>
      <polygon points={`${X(mean)},${AXIS + 2} ${X(mean) - 9},${AXIS + 16} ${X(mean) + 9},${AXIS + 16}`} className="fill-foreground" />
      <text x={Math.min(W - 30, Math.max(30, X(mean)))} y={H - 4} textAnchor="middle" className="fill-foreground text-[12px] font-[650]">
        mean {fmt(c.mean, 4)}
      </text>
    </svg>
  )
}
