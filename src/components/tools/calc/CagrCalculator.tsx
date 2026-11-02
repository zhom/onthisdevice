import { useMemo, useState } from 'react'
import { LineChart, compact } from '@/components/viz'
import { cagr, futureValue } from './money-math'
import { Assumptions, CalcGrid, Choice, Field, Formula, Headline, ResultPanel, Stats, num, numUpTo, pct, toNum, toPositive, useCurrency } from './mb-ui'
import type { FormulaItem } from './mb-ui'

type Mode = 'rate' | 'end'

export default function CagrCalculator() {
  const { money, select } = useCurrency()
  const [mode, setMode] = useState<Mode>('rate')
  const [start, setStart] = useState('10000')
  const [end, setEnd] = useState('19000')
  const [rateIn, setRateIn] = useState('8')
  const [years, setYears] = useState('3')

  const c = useMemo(() => {
    const S = toPositive(start)
    const Y = Math.min(200, toPositive(years))
    const g = mode === 'rate' ? cagr(S, toPositive(end), Y) : Math.max(-99.99, toNum(rateIn))
    const E = mode === 'rate' ? toPositive(end) : g !== null && Y > 0 ? futureValue(S, g / 100, Y) : S
    const ok = g !== null && S > 0 && Y > 0
    const step = Y <= 10 ? 0.25 : Y <= 40 ? 1 : Math.ceil(Y / 40)
    const x: number[] = []
    for (let t = 0; t < Y - 1e-9; t += step) x.push(t)
    x.push(Y)
    const rate = (g ?? 0) / 100
    const path = x.map((t) => S * Math.pow(1 + rate, t))
    const line = x.map((t) => (Y > 0 ? S + ((E - S) * t) / Y : S))
    const multiple = S > 0 ? E / S : Number.NaN
    return { S, Y, g, E, ok, x, path, line, multiple, growth: (multiple - 1) * 100 }
  }, [mode, start, end, rateIn, years])

  const switchMode = (next: Mode) => {
    if (next === mode) return
    if (next === 'end' && c.ok && c.g !== null) setRateIn(String(Math.round(c.g * 100) / 100))
    if (next === 'rate' && c.ok) setEnd(String(Math.round(c.E * 100) / 100))
    setMode(next)
  }

  const Y = numUpTo(c.Y, 2)
  const gTxt = c.g === null ? '–' : pct(c.g, 2)
  const shape =
    !c.ok || c.g === null || Math.abs(c.g) < 1e-9
      ? ''
      : c.g > 0
        ? ' The compounding path rises slower than the straight line at first and faster at the end, because each year’s growth is on a larger amount.'
        : ' The compounding path falls faster than the straight line at first and slower at the end, because each year’s loss is on a smaller amount.'

  const formula: FormulaItem[] =
    mode === 'rate'
      ? [
          {
            label: 'Compound annual growth rate',
            general: 'CAGR = (End ÷ Start)^(1 ÷ years) − 1',
            steps: [`CAGR = (${money.exact(c.E)} ÷ ${money.exact(c.S)})^(1 ÷ ${Y}) − 1`, `CAGR = ${num(c.multiple, 6)}^${numUpTo(c.Y > 0 ? 1 / c.Y : 0, 6)} − 1`],
            result: c.g === null ? '–' : `${numUpTo(c.g, 4)}%`,
          },
        ]
      : [
          {
            label: 'End value',
            general: 'End = Start × (1 + CAGR)^years',
            steps: [`End = ${money.exact(c.S)} × (1 + ${numUpTo((c.g ?? 0) / 100, 6)})^${Y}`],
            result: money.exact(c.E),
          },
        ]
  formula.push(
    {
      label: 'Total growth',
      general: 'Total growth = End ÷ Start − 1',
      steps: [`${money.exact(c.E)} ÷ ${money.exact(c.S)} − 1`],
      result: pct(c.growth, 2),
    },
    {
      label: 'Simple average, for comparison',
      general: 'Total growth ÷ years (no compounding)',
      steps: [`${pct(c.growth, 2)} ÷ ${Y}`],
      result: c.Y > 0 ? pct(c.growth / c.Y, 2) : '–',
    },
  )

  return (
    <CalcGrid
      inputs={
        <>
          <Choice
            label="Find"
            value={mode}
            onChange={switchMode}
            options={[
              { value: 'rate', label: 'Growth rate' },
              { value: 'end', label: 'End value' },
            ]}
          />
          <Field id="cagr-start" label="Start value" value={start} onChange={setStart} prefix={money.symbol} />
          {mode === 'rate' ? (
            <Field id="cagr-end" label="End value" value={end} onChange={setEnd} prefix={money.symbol} />
          ) : (
            <Field id="cagr-rate" label="Growth rate per year (CAGR)" value={rateIn} onChange={setRateIn} suffix="%" slider={{ min: -20, max: 40, step: 0.25 }} />
          )}
          <Field id="cagr-years" label="Years" value={years} onChange={setYears} suffix="yrs" hint="decimals allowed" slider={{ min: 1, max: 50, step: 1 }} />
          {select('cagr-currency')}
        </>
      }
      results={
        <ResultPanel>
          {mode === 'rate' ? (
            <Headline
              label="Compound annual growth rate (CAGR)"
              value={c.ok && c.g !== null ? c.g : Number.NaN}
              format={(v) => pct(v, 2)}
              hint={c.ok ? `${money.exact(c.S)} grows to ${money.exact(c.E)} in ${Y} years: ${gTxt} a year, compounded.` : 'Enter a start value, an end value and years above 0.'}
            />
          ) : (
            <Headline
              label="End value"
              value={c.ok ? c.E : Number.NaN}
              format={money.exact}
              hint={c.ok ? `${money.exact(c.S)} growing ${gTxt} a year for ${Y} years.` : 'Enter a start value and years above 0.'}
            />
          )}
          <Stats
            items={[
              { label: 'Total growth', value: c.ok ? pct(c.growth, 2) : '–' },
              { label: 'Multiple', value: c.ok ? `${num(c.multiple, 3)}×` : '–', hint: 'end ÷ start' },
              mode === 'rate'
                ? { label: 'Simple average', value: c.ok ? pct(c.growth / c.Y, 2) : '–', hint: 'total growth ÷ years' }
                : { label: 'Gain', value: c.ok ? money.exact(c.E - c.S) : '–' },
            ]}
          />
          <LineChart
            x={c.x}
            series={[
              { id: 'cagr', label: 'Compounding', values: c.path, stroke: 'solid' },
              { id: 'line', label: 'Straight line', values: c.line, stroke: 'dash' },
            ]}
            xLabel="Year"
            formatX={(t) => numUpTo(t, 2)}
            formatY={(v) => compact(v)}
            formatValue={money.round}
            summary={
              c.ok
                ? `At ${gTxt} a year, ${money.round(c.S)} becomes ${money.round(c.E)} after ${Y} years. The straight line joins the same two values.${shape}`
                : 'Enter values above 0 to see the path.'
            }
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula items={formula} />
          <Assumptions
            title="Limits"
            items={[
              'CAGR is one smooth yearly rate. The real value can go up and down between the start and the end.',
              'Money added or taken out in between is not counted. For that, use the IRR calculator.',
              'Years can be decimals: 18 months is 1.5 years.',
            ]}
          />
        </div>
      }
    />
  )
}
