import { useMemo, useState } from 'react'
import { LineChart, compact } from '@/components/viz'
import { futureValue, rothVsTaxable } from './money-math'
import { Assumptions, CalcGrid, Field, Formula, Headline, Note, ResultPanel, Stats, numUpTo, pct, toPositive, useCurrency } from './mb-ui'

export default function RothIraCalculator() {
  const { money, select } = useCurrency()
  const [age, setAge] = useState('30')
  const [retire, setRetire] = useState('65')
  const [balance, setBalance] = useState('0')
  const [yearly, setYearly] = useState('7500')
  const [ret, setRet] = useState('6')
  const [tax, setTax] = useState('20')

  const c = useMemo(() => {
    const a = Math.max(14, Math.min(90, Math.round(toPositive(age, 30))))
    const ra = Math.max(a + 1, Math.min(100, Math.round(toPositive(retire, 65))))
    const B = toPositive(balance)
    const C = toPositive(yearly)
    const r = toPositive(ret)
    const t = Math.min(100, toPositive(tax))
    const rows = rothVsTaxable(a, ra, B, C, r, t)
    const last = rows[rows.length - 1]!
    const rt = (r * (1 - t / 100)) / 100
    return { a, ra, B, C, r, t, rt, rows, last, n: ra - a, check: futureValue(B, r / 100, ra - a, C, true) }
  }, [age, retire, balance, yearly, ret, tax])

  const { last } = c
  const growth = last.roth - last.contributed
  const ahead = last.roth - last.taxable
  const fvStep = (r: number) => {
    if (r === 0) return `FV = ${money.exact(c.B)} + ${money.exact(c.C)} × ${c.n} (no return)`
    const g = numUpTo(1 + r, 6)
    return `FV = ${money.exact(c.B)} × ${g}^${c.n} + ${money.exact(c.C)} × (${g}^${c.n} − 1) ÷ ${numUpTo(r, 6)} × ${g}`
  }

  return (
    <CalcGrid
      inputs={
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field id="ri-age" label="Your age" value={age} onChange={setAge} />
            <Field id="ri-retire" label="Retirement age" value={retire} onChange={setRetire} />
          </div>
          <Field id="ri-balance" label="Current Roth IRA balance" value={balance} onChange={setBalance} prefix={money.symbol} />
          <Field id="ri-yearly" label="Yearly contribution" value={yearly} onChange={setYearly} prefix={money.symbol} slider={{ min: 0, max: 8600, step: 100 }} />
          <Note>The 2026 limit is 7,500, or 8,600 at age 50 or older. Income limits apply.</Note>
          <Field id="ri-return" label="Annual return" value={ret} onChange={setRet} suffix="%" slider={{ min: 0, max: 12, step: 0.25 }} />
          <Field id="ri-tax" label="Tax on the taxable account's return" value={tax} onChange={setTax} suffix="%" hint="each year" />
          {select('ri-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Roth IRA balance at retirement"
            value={last.roth}
            format={money.round}
            hint={`At age ${c.ra}, after ${c.n} yearly ${c.n === 1 ? 'contribution' : 'contributions'}. Qualified withdrawals are tax-free.`}
          />
          <Stats
            items={[
              { label: 'Your contributions', value: money.round(last.contributed) },
              { label: 'Tax-free growth', value: money.round(growth) },
              { label: 'More than a taxed account', value: money.round(ahead), hint: `taxed account: ${money.round(last.taxable)}` },
            ]}
          />
          <LineChart
            x={c.rows.map((r) => r.age)}
            series={[
              { id: 'roth', label: 'Roth IRA', values: c.rows.map((r) => r.roth), stroke: 'solid' },
              { id: 'tax', label: 'Taxed account', values: c.rows.map((r) => r.taxable), stroke: 'dash' },
              { id: 'in', label: 'Contributions', values: c.rows.map((r) => r.contributed), stroke: 'grey' },
            ]}
            xLabel="Age"
            formatY={(v) => compact(v)}
            formatValue={money.round}
            summary={`The same contributions grow to ${money.round(last.roth)} in the Roth IRA and to ${money.round(last.taxable)} in an account that pays ${pct(c.t, 0)} tax on its return each year. The gap at age ${c.ra} is ${money.round(ahead)}.`}
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula
            items={[
              {
                label: 'Roth IRA, contributions at the start of each year',
                general: 'FV = B × (1 + r)^n + C × ((1 + r)^n − 1) ÷ r × (1 + r)',
                steps: [
                  `B = ${money.exact(c.B)}, C = ${money.exact(c.C)}, r = ${numUpTo(c.r / 100, 6)}, n = ${c.n}`,
                  fvStep(c.r / 100),
                ],
                result: money.exact(c.check),
              },
              {
                label: 'Return of the taxed account after tax',
                general: 'r(after tax) = r × (1 − tax)',
                steps: [`${numUpTo(c.r, 2)}% × (1 − ${numUpTo(c.t / 100, 4)})`],
                result: pct(c.rt * 100, 3),
              },
              {
                label: 'Taxed account',
                general: 'Same formula with r(after tax)',
                steps: [fvStep(c.rt)],
                result: money.exact(last.taxable),
              },
              {
                label: 'Difference',
                general: 'Roth IRA − taxed account',
                steps: [`${money.exact(last.roth)} − ${money.exact(last.taxable)}`],
                result: money.exact(ahead),
              },
            ]}
            note="Both accounts get the same money after income tax. Only the tax on the return is different."
          />
          <Assumptions
            title="Limits"
            items={[
              'Tax rules are simplified. Roth IRA withdrawals of earnings are tax-free after age 59½ when the account is at least 5 years old. The taxed account pays the tax rate on all of its return every year; real tax depends on dividends, capital gains and when you sell.',
              'If you take out earnings early, you can pay income tax and a 10% penalty. You can take out your own contributions at any time.',
              'Above an income limit (modified AGI), the amount you can contribute goes down to zero. You cannot contribute more than you earn in the year. Check the IRS figures for your year.',
              'Contributions go in at the start of each year and the return is the same every year. Fees and inflation are not included.',
            ]}
          />
        </div>
      }
    />
  )
}
