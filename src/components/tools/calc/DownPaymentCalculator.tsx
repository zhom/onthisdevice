import { useMemo, useState } from 'react'
import { LineChart, Split, compact } from '@/components/viz'
import { useToday } from '@/components/tools/finance/hooks'
import { addMonths, formatMonthYear } from '@/components/tools/finance/money'
import { growthPath, monthsToGoal, monthlyFromAnnualEffective } from './money-math'
import { Assumptions, CalcGrid, Field, Formula, Headline, Note, ResultPanel, Stats, num, toPositive, useCurrency, yearsMonths } from './mb-ui'

export default function DownPaymentCalculator() {
  const { money, select } = useCurrency()
  const today = useToday()
  const [price, setPrice] = useState('400000')
  const [downPct, setDownPct] = useState('20')
  const [closingPct, setClosingPct] = useState('3')
  const [saved, setSaved] = useState('30000')
  const [monthly, setMonthly] = useState('1500')
  const [ret, setRet] = useState('4')

  const c = useMemo(() => {
    const P = toPositive(price)
    const dp = Math.min(100, toPositive(downPct))
    const down = (P * dp) / 100
    const closing = (P * toPositive(closingPct)) / 100
    const need = down + closing
    const i = monthlyFromAnnualEffective(toPositive(ret))
    const months = monthsToGoal(toPositive(saved), toPositive(monthly), i, need)
    const span = Math.max(12, Math.min(600, (months ?? 120) + 6))
    const path = growthPath(toPositive(saved), toPositive(monthly), i, span)
    return { P, dp, down, closing, need, i, months, path, loan: Math.max(0, P - down) }
  }, [price, downPct, closingPct, saved, monthly, ret])

  const x = c.path.map((p) => p.t / 12)
  const reached = c.months !== null
  const date = reached ? addMonths(today, c.months ?? 0) : null

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="dp-price" label="Home price" value={price} onChange={setPrice} prefix={money.symbol} />
          <Field id="dp-pct" label="Down payment" value={downPct} onChange={setDownPct} suffix="%" slider={{ min: 3, max: 50, step: 0.5 }} hint={money.round(c.down)} />
          <Field id="dp-closing" label="Closing costs" value={closingPct} onChange={setClosingPct} suffix="%" hint={money.round(c.closing)} />
          <Field id="dp-saved" label="Saved so far" value={saved} onChange={setSaved} prefix={money.symbol} />
          <Field id="dp-monthly" label="You save each month" value={monthly} onChange={setMonthly} prefix={money.symbol} slider={{ min: 0, max: 6000, step: 50 }} />
          <Field id="dp-ret" label="Interest on savings" value={ret} onChange={setRet} suffix="% a year" />
          {select('dp-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Down payment"
            value={c.down}
            format={money.round}
            hint={
              c.months === 0
                ? `You already have the ${money.round(c.need)} you need with closing costs.`
                : reached && date
                  ? `With closing costs you need ${money.round(c.need)}. At this pace you have it in ${yearsMonths(c.months ?? 0)}, about ${formatMonthYear(date)}.`
                  : `With closing costs you need ${money.round(c.need)}. Save more each month to get there.`
            }
          />
          <Stats
            items={[
              { label: 'Loan amount', value: money.round(c.loan) },
              { label: 'Cash needed', value: money.round(c.need), hint: 'down + closing' },
              { label: 'Still to save', value: money.round(Math.max(0, c.need - toPositive(saved))) },
            ]}
          />
          {c.dp < 20 ? <Note>With less than 20% down, most conventional US loans add private mortgage insurance (PMI) to the payment until the balance falls to 80% of the price.</Note> : null}
          <LineChart
            x={x}
            series={[{ id: 'sav', label: 'Savings', values: c.path.map((p) => p.balance), stroke: 'solid' }]}
            guides={[{ y: c.need, label: `Need ${compact(c.need)}`, align: 'left' }]}
            markers={reached && (c.months ?? 0) > 0 ? [{ x: (c.months ?? 0) / 12, label: `Month ${c.months}` }] : []}
            xLabel="Year"
            formatX={(v) => num(v, Number.isInteger(v) ? 0 : 1)}
            readoutX={(v) => `${num(Math.floor(v + 1e-9), 0)}, month ${num(Math.round(v * 12), 0)}`}
            formatValue={money.round}
            defaultIndex={reached ? c.months ?? 0 : undefined}
            summary={reached ? `Savings grow from ${money.round(toPositive(saved))} and pass the ${money.round(c.need)} you need in month ${c.months}.` : `Savings grow from ${money.round(toPositive(saved))} but do not reach ${money.round(c.need)} within 50 years.`}
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <ResultPanel title="How the price is paid">
            <Split
              parts={[
                { label: 'Down payment', value: c.down, paint: 'ink' },
                { label: 'Loan', value: c.loan, paint: 'hatch' },
              ]}
              formatValue={money.round}
              summary={`You pay ${num(c.dp, 1)}% of the price up front and borrow ${money.round(c.loan)}.`}
            />
          </ResultPanel>
          <Formula
            items={[
              { label: 'Down payment', general: 'D = price × down %', steps: [`${money.exact(c.P)} × ${num(c.dp, 2)}%`], result: money.exact(c.down) },
              { label: 'Cash needed', general: 'C = D + price × closing %', steps: [`${money.exact(c.down)} + ${money.exact(c.P)} × ${num(toPositive(closingPct), 2)}%`], result: money.exact(c.need) },
              {
                label: 'Months to save',
                general: 'smallest n with S × (1 + i)^n + m × ((1 + i)^n − 1) ÷ i ≥ C',
                steps: [`S = ${money.exact(toPositive(saved))}, m = ${money.exact(toPositive(monthly))}, i = (1 + ${num(toPositive(ret), 2)}%)^(1/12) − 1 = ${c.i.toFixed(6)}`],
                result: c.months === null ? 'not within 50 years' : `${c.months} months`,
              },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'The home price stays the same while you save. Prices that rise make the target move.',
              'Savings earn a fixed rate, before tax, with deposits at the end of each month.',
              'Closing costs vary by place and lender; 2% to 5% of the price is a common range.',
            ]}
          />
        </div>
      }
    />
  )
}
