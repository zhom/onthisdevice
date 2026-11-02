import { useMemo, useState } from 'react'
import { StackedBars } from '@/components/viz'
import { amortize, byYear } from './money-math'
import { Assumptions, CalcGrid, Field, Formula, Headline, Note, ResultPanel, Stats, num, toPositive, useCurrency, yearsMonths } from './mb-ui'

export default function StudentLoanCalculator() {
  const { money, select } = useCurrency()
  const [balance, setBalance] = useState('35000')
  const [rate, setRate] = useState('6.5')
  const [years, setYears] = useState('10')
  const [extra, setExtra] = useState('0')
  const [income, setIncome] = useState('55000')

  const c = useMemo(() => {
    const P = toPositive(balance)
    const r = toPositive(rate)
    const n = Math.max(1, Math.min(360, Math.round(toPositive(years, 10) * 12)))
    const base = amortize({ principal: P, annualPct: r, months: n })
    const fast = amortize({ principal: P, annualPct: r, months: n, extraMonthly: toPositive(extra) })
    return { P, r, n, base, fast, years: byYear(fast.rows) }
  }, [balance, rate, years, extra])

  const pay = c.base.payment
  const inc = toPositive(income)
  const share = inc > 0 ? ((pay + toPositive(extra)) / (inc / 12)) * 100 : NaN
  const hasExtra = toPositive(extra) > 0
  const i = c.r / 1200

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="sl-balance" label="Loan balance" value={balance} onChange={setBalance} prefix={money.symbol} />
          <Field id="sl-rate" label="Interest rate" value={rate} onChange={setRate} suffix="%" slider={{ min: 0, max: 15, step: 0.05 }} />
          <Field id="sl-years" label="Repayment term" value={years} onChange={setYears} suffix="yrs" slider={{ min: 1, max: 30, step: 1 }} />
          <Field id="sl-extra" label="Extra each month" value={extra} onChange={setExtra} prefix={money.symbol} slider={{ min: 0, max: 1000, step: 10 }} />
          <Field id="sl-income" label="Yearly income before tax" value={income} onChange={setIncome} prefix={money.symbol} hint="optional" />
          {select('sl-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Monthly payment"
            value={pay}
            format={money.exact}
            hint={hasExtra ? `Plus ${money.exact(toPositive(extra))} extra: paid off in ${yearsMonths(c.fast.months)}, ${money.round(c.base.totalInterest - c.fast.totalInterest)} less interest.` : `For ${yearsMonths(c.n)}. Add an extra payment to see the interest you save.`}
          />
          <Stats
            items={[
              { label: 'Total interest', value: money.round(c.fast.totalInterest) },
              { label: 'Total repaid', value: money.round(c.fast.totalPaid) },
              { label: 'Share of income', value: Number.isFinite(share) ? `${num(share, 1)}%` : '–', hint: 'of gross monthly pay' },
            ]}
          />
          {Number.isFinite(share) && share > 10 ? <Note>The payment is more than 10% of your gross income. Federal loans in the US have income-driven plans that can lower it; check your servicer.</Note> : null}
          <StackedBars
            categories={c.years.map((y) => y.year)}
            series={[
              { id: 'p', label: 'Principal', values: c.years.map((y) => y.principal), paint: 'ink' },
              { id: 'i', label: 'Interest', values: c.years.map((y) => y.interest), paint: 'hatch' },
            ]}
            categoryLabel="Year"
            formatValue={money.round}
            showTotal
            summary={`In year 1 you pay ${money.round(c.years[0]?.interest ?? 0)} of interest and ${money.round(c.years[0]?.principal ?? 0)} of principal. The interest part falls each year as the balance falls.`}
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula
            items={[
              {
                label: 'Monthly payment',
                general: 'M = P × i ÷ (1 − (1 + i)^−n)',
                steps: [`i = ${num(c.r, 3)}% ÷ 12 = ${i.toFixed(6)}, n = ${c.n}`, `M = ${money.exact(c.P)} × ${i.toFixed(6)} ÷ (1 − (1 + ${i.toFixed(6)})^−${c.n})`],
                result: money.exact(pay),
              },
              {
                label: 'Total interest',
                general: 'I = sum of each month’s balance × i',
                steps: [hasExtra ? `with ${money.exact(toPositive(extra))} extra each month, ${c.fast.months} payments` : `${c.n} payments of ${money.exact(pay)} − ${money.exact(c.P)} (last payment adjusted for rounding)`],
                result: money.exact(c.fast.totalInterest),
              },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'A fixed rate and a standard level-payment plan. Income-driven, graduated and extended plans change the payment.',
              'Interest that built up during school or a grace period is not added; enter the balance after it is added.',
              'Forgiveness programs and tax deductions for student loan interest are not part of the result.',
            ]}
          />
        </div>
      }
    />
  )
}
