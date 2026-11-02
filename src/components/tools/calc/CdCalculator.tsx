import { useMemo, useState } from 'react'
import { LineChart, Split } from '@/components/viz'
import { apy, futureValue, ratePerPayment } from './money-math'
import { Assumptions, CalcGrid, Field, Formula, Headline, ResultPanel, SelectField, Stats, num, numUpTo, pct, toPositive, useCurrency, yearsMonths } from './mb-ui'

const COMPOUNDING = [
  { value: '365', label: 'Daily' },
  { value: '12', label: 'Monthly' },
  { value: '4', label: 'Quarterly' },
  { value: '1', label: 'Annually' },
]

export default function CdCalculator() {
  const { money, select } = useCurrency()
  const [deposit, setDeposit] = useState('10000')
  const [rate, setRate] = useState('4.5')
  const [freq, setFreq] = useState('365')
  const [term, setTerm] = useState('12')
  const [tax, setTax] = useState('0')

  const c = useMemo(() => {
    const P = toPositive(deposit)
    const r = toPositive(rate)
    const m = Number(freq) || 365
    const n = Math.max(1, Math.min(120, Math.round(toPositive(term, 12))))
    const t = Math.min(100, toPositive(tax))
    const iMonth = ratePerPayment(r, m, 12)
    const path = Array.from({ length: n + 1 }, (_, k) => futureValue(P, iMonth, k))
    const balance = path[n] ?? P
    const interest = balance - P
    return { P, r, m, n, t, path, balance, interest, apy: apy(r, m), afterTax: interest * (1 - t / 100) }
  }, [deposit, rate, freq, term, tax])

  const months = c.path.map((_, k) => k)
  const freqLabel = (COMPOUNDING.find((o) => o.value === freq)?.label ?? 'Daily').toLowerCase()
  const periods = (c.m * c.n) / 12
  const perPeriod = c.r / 100 / c.m

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="cd-deposit" label="Deposit" value={deposit} onChange={setDeposit} prefix={money.symbol} />
          <Field id="cd-rate" label="Interest rate" value={rate} onChange={setRate} suffix="%" slider={{ min: 0, max: 8, step: 0.05 }} />
          <SelectField id="cd-freq" label="Interest compounds" value={freq} onChange={setFreq} options={COMPOUNDING} />
          <Field id="cd-term" label="Term" value={term} onChange={setTerm} suffix="months" slider={{ min: 1, max: 60, step: 1 }} />
          <Field id="cd-tax" label="Tax rate on interest" value={tax} onChange={setTax} suffix="%" hint="0 = no tax" />
          {select('cd-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Balance at maturity"
            value={c.balance}
            format={money.exact}
            hint={`After ${yearsMonths(c.n)}, with interest compounded ${freqLabel}.`}
          />
          <Stats
            items={[
              { label: 'Interest earned', value: money.exact(c.interest) },
              { label: 'APY', value: pct(c.apy, 3), hint: `${pct(c.r, 2)} rate` },
              { label: 'Interest after tax', value: money.exact(c.afterTax), hint: c.t > 0 ? `${pct(c.t, 0)} tax` : 'no tax entered' },
            ]}
          />
          <LineChart
            x={months}
            series={[{ id: 'int', label: 'Interest earned', values: c.path.map((b) => b - c.P), stroke: 'solid' }]}
            xLabel="Month"
            formatY={(v) => money.round(v)}
            formatValue={money.exact}
            summary={`Interest earned so far, month by month: ${money.exact(c.interest)} after ${yearsMonths(c.n)}. Each month the interest also earns interest, so the line bends up a little.`}
            table
          />
          <Split
            parts={[
              { label: 'Deposit', value: c.P, paint: 'grey' },
              { label: 'Interest', value: c.interest, paint: 'ink' },
            ]}
            formatValue={money.exact}
            summary={`At maturity the interest is ${pct(c.P > 0 ? (c.interest / c.P) * 100 : 0, 2)} of the deposit.`}
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula
            items={[
              {
                label: 'Balance at maturity',
                general: 'A = P × (1 + r ÷ m)^(m × t)',
                steps: [
                  `P = ${money.exact(c.P)}, r = ${numUpTo(c.r / 100, 6)}, m = ${c.m}`,
                  `t = ${c.n} months ÷ 12 = ${numUpTo(c.n / 12, 4)} years`,
                  `A = ${money.exact(c.P)} × (1 + ${numUpTo(c.r / 100, 6)} ÷ ${c.m})^(${c.m} × ${numUpTo(c.n / 12, 4)})`,
                  `A = ${money.exact(c.P)} × (1 + ${perPeriod.toFixed(8)})^${numUpTo(periods, 4)}`,
                ],
                result: money.exact(c.balance),
              },
              {
                label: 'Interest',
                general: 'I = A − P',
                steps: [`I = ${money.exact(c.balance)} − ${money.exact(c.P)}`],
                result: money.exact(c.interest),
              },
              {
                label: 'Annual percentage yield',
                general: 'APY = (1 + r ÷ m)^m − 1',
                steps: [`APY = (1 + ${numUpTo(c.r / 100, 6)} ÷ ${c.m})^${c.m} − 1`],
                result: pct(c.apy, 4),
              },
              {
                label: 'Interest after tax',
                general: 'I × (1 − tax rate)',
                steps: [`${money.exact(c.interest)} × (1 − ${num(c.t / 100, 2)})`],
                result: money.exact(c.afterTax),
              },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'The rate is fixed for the whole term and the interest stays in the CD until maturity.',
              'For quarterly or yearly compounding, the balance between two compounding dates is shown at the same yield. The bank credits that interest on the compounding date.',
              'Taking money out before maturity usually costs a penalty, often some months of interest. The penalty is not included.',
              'Banks may count 360 or 365 days a year, so their figure can differ by some cents.',
              'Tax is a flat rate on all the interest. In many countries interest is taxed each year as it is credited, also when it stays in the CD.',
            ]}
          />
        </div>
      }
    />
  )
}
