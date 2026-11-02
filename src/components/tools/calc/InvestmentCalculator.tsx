import { useMemo, useState } from 'react'
import { AreaChart, compact } from '@/components/viz'
import { growthPath } from './money-math'
import { Assumptions, CalcGrid, Choice, Field, Formula, Headline, ResultPanel, Stats, numUpTo, pct, toPositive, useCurrency } from './mb-ui'

type Timing = 'start' | 'end'

export default function InvestmentCalculator() {
  const { money, select } = useCurrency()
  const [start, setStart] = useState('10000')
  const [deposit, setDeposit] = useState('500')
  const [rate, setRate] = useState('7')
  const [years, setYears] = useState('20')
  const [timing, setTiming] = useState<Timing>('end')
  const [inflation, setInflation] = useState('2.5')

  const c = useMemo(() => {
    const P = toPositive(start)
    const PMT = toPositive(deposit)
    const r = toPositive(rate)
    const y = Math.max(1, Math.min(60, Math.round(toPositive(years, 20))))
    const inf = toPositive(inflation)
    const i = r / 1200
    const n = y * 12
    const path = growthPath(P, PMT, i, n, timing === 'start')
    const yearly = Array.from({ length: y + 1 }, (_, k) => path[k * 12]!)
    const end = path[n]!
    const deflator = Math.pow(1 + inf / 100, y)
    return { P, PMT, r, y, inf, i, n, yearly, end, deflator, real: end.balance / deflator }
  }, [start, deposit, rate, years, timing, inflation])

  const { end } = c
  const due = timing === 'start'
  const g = (1 + c.i).toFixed(8)
  const growthShare = end.balance > 0 ? (end.gain / end.balance) * 100 : 0

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="iv-start" label="Starting amount" value={start} onChange={setStart} prefix={money.symbol} />
          <Field id="iv-deposit" label="Monthly deposit" value={deposit} onChange={setDeposit} prefix={money.symbol} slider={{ min: 0, max: 3000, step: 50 }} />
          <Field id="iv-rate" label="Annual return" value={rate} onChange={setRate} suffix="%" hint="compounded monthly" slider={{ min: 0, max: 12, step: 0.25 }} />
          <Field id="iv-years" label="Years" value={years} onChange={setYears} suffix="yrs" slider={{ min: 1, max: 50, step: 1 }} />
          <Choice
            id="iv-timing"
            label="Deposits at the"
            value={timing}
            onChange={setTiming}
            options={[
              { value: 'start', label: 'Start of month' },
              { value: 'end', label: 'End of month' },
            ]}
          />
          <Field id="iv-inflation" label="Inflation" value={inflation} onChange={setInflation} suffix="%" hint="for today's money" />
          {select('iv-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label={`Balance after ${c.y} ${c.y === 1 ? 'year' : 'years'}`}
            value={end.balance}
            format={money.round}
            hint={`Growth is ${pct(growthShare, 0)} of the balance.`}
          />
          <Stats
            items={[
              { label: 'Total invested', value: money.round(end.invested), hint: `${money.round(c.P)} + ${c.n} deposits` },
              { label: 'Growth', value: money.round(end.gain) },
              { label: "In today's money", value: money.round(c.real), hint: `at ${pct(c.inf, 1)} inflation` },
            ]}
          />
          <AreaChart
            x={c.yearly.map((p) => p.t / 12)}
            series={[
              { id: 'inv', label: 'Invested', values: c.yearly.map((p) => p.invested), paint: 'grey' },
              { id: 'gain', label: 'Growth', values: c.yearly.map((p) => p.gain), paint: 'hatch' },
            ]}
            xLabel="Year"
            formatY={(v) => compact(v)}
            formatValue={money.round}
            summary={`Balance at the end of each year. You put in ${money.round(end.invested)} and the return adds ${money.round(end.gain)}, so the balance is ${money.round(end.balance)} after ${c.y} years.`}
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula
            items={[
              {
                label: 'Monthly rate and number of months',
                general: 'i = annual rate ÷ 12, n = years × 12',
                steps: [`i = ${numUpTo(c.r, 4)}% ÷ 12 = ${c.i.toFixed(8)}`, `n = ${c.y} × 12`],
                result: `i = ${c.i.toFixed(8)}, n = ${c.n}`,
              },
              {
                label: due ? 'Future value, deposits at the start of each month' : 'Future value, deposits at the end of each month',
                general: due ? 'FV = P × (1 + i)^n + PMT × ((1 + i)^n − 1) ÷ i × (1 + i)' : 'FV = P × (1 + i)^n + PMT × ((1 + i)^n − 1) ÷ i',
                steps:
                  c.i === 0
                    ? [`FV = ${money.exact(c.P)} + ${money.exact(c.PMT)} × ${c.n} (no return)`]
                    : [`FV = ${money.exact(c.P)} × ${g}^${c.n} + ${money.exact(c.PMT)} × (${g}^${c.n} − 1) ÷ ${c.i.toFixed(8)}${due ? ` × ${g}` : ''}`],
                result: money.exact(end.balance),
              },
              {
                label: 'Growth',
                general: 'FV − (P + PMT × n)',
                steps: [`${money.exact(end.balance)} − (${money.exact(c.P)} + ${money.exact(c.PMT)} × ${c.n})`],
                result: money.exact(end.gain),
              },
              {
                label: "In today's money",
                general: 'FV ÷ (1 + inflation)^years',
                steps: [`${money.exact(end.balance)} ÷ ${numUpTo(1 + c.inf / 100, 6)}^${c.y} = ${money.exact(end.balance)} ÷ ${c.deflator.toFixed(6)}`],
                result: money.exact(c.real),
              },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'The return is the same every month. Real markets go up and down, and the order of good and bad years changes the result.',
              'Fees and taxes are not included. Enter a return after fees to allow for them.',
              'The deposit stays the same every month. Inflation is used only to show the final balance in today\'s money.',
            ]}
          />
        </div>
      }
    />
  )
}
