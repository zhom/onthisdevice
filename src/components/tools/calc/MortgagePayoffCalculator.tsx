import { useMemo, useState } from 'react'
import { LineChart, StackedBars, compact } from '@/components/viz'
import { useToday } from '@/components/tools/finance/hooks'
import { addMonths, formatMonthYear } from '@/components/tools/finance/money'
import { amortize, byYear } from './money-math'
import { CalcGrid, Field, Formula, Headline, ResultPanel, Stats, Assumptions, toPositive, useCurrency, yearsMonths, num } from './mb-ui'

export default function MortgagePayoffCalculator() {
  const { money, select } = useCurrency()
  const today = useToday()
  const [balance, setBalance] = useState('250000')
  const [rate, setRate] = useState('6.5')
  const [years, setYears] = useState('25')
  const [extra, setExtra] = useState('200')
  const [yearly, setYearly] = useState('0')
  const [lump, setLump] = useState('0')
  const [lumpMonth, setLumpMonth] = useState('12')

  const c = useMemo(() => {
    const P = toPositive(balance)
    const r = toPositive(rate)
    const n = Math.max(1, Math.min(480, Math.round(toPositive(years, 25) * 12)))
    const base = amortize({ principal: P, annualPct: r, months: n })
    const fast = amortize({
      principal: P,
      annualPct: r,
      months: n,
      extraMonthly: toPositive(extra),
      extraYearly: toPositive(yearly),
      lumpSum: toPositive(lump),
      lumpMonth: Math.max(1, Math.round(toPositive(lumpMonth, 1))),
    })
    return { P, r, n, base, fast, saved: base.totalInterest - fast.totalInterest, sooner: base.months - fast.months }
  }, [balance, rate, years, extra, yearly, lump, lumpMonth])

  const yearsAxis = Math.ceil(c.base.months / 12)
  const x = Array.from({ length: yearsAxis + 1 }, (_, i) => i)
  const balAt = (rows: { balance: number }[], y: number) => (y === 0 ? c.P : rows[Math.min(rows.length, y * 12) - 1]?.balance ?? 0)
  const baseLine = x.map((y) => (y * 12 > c.base.rows.length ? 0 : balAt(c.base.rows, y)))
  const fastLine = x.map((y) => (y * 12 > c.fast.rows.length ? 0 : balAt(c.fast.rows, y)))
  const fy = byYear(c.fast.rows)
  const payoffDate = addMonths(today, c.fast.months)
  const i = c.r / 1200
  const pay = c.base.payment
  const totalExtra = toPositive(extra)

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="mp-balance" label="Loan balance" value={balance} onChange={setBalance} prefix={money.symbol} />
          <Field id="mp-rate" label="Interest rate" value={rate} onChange={setRate} suffix="%" slider={{ min: 0, max: 12, step: 0.05 }} />
          <Field id="mp-years" label="Years left on the loan" value={years} onChange={setYears} suffix="yrs" slider={{ min: 1, max: 40, step: 1 }} />
          <Field id="mp-extra" label="Extra every month" value={extra} onChange={setExtra} prefix={money.symbol} slider={{ min: 0, max: 2000, step: 25 }} />
          <Field id="mp-yearly" label="Extra once a year" value={yearly} onChange={setYearly} prefix={money.symbol} />
          <div className="grid grid-cols-2 gap-3">
            <Field id="mp-lump" label="One-time payment" value={lump} onChange={setLump} prefix={money.symbol} />
            <Field id="mp-lump-month" label="In month" value={lumpMonth} onChange={setLumpMonth} />
          </div>
          {select('mp-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Interest you save"
            value={c.saved}
            format={money.round}
            hint={
              c.sooner > 0
                ? `The loan ends ${yearsMonths(c.sooner)} sooner, in ${formatMonthYear(payoffDate)}.`
                : 'Add an extra payment to see how much sooner the loan ends.'
            }
          />
          <Stats
            items={[
              { label: 'Monthly payment', value: money.exact(pay) },
              { label: 'Paid off in', value: yearsMonths(c.fast.months), hint: `was ${yearsMonths(c.base.months)}` },
              { label: 'Total interest', value: money.round(c.fast.totalInterest), hint: `was ${money.round(c.base.totalInterest)}` },
            ]}
          />
          <LineChart
            x={x}
            series={[
              { id: 'fast', label: 'With extra', values: fastLine, stroke: 'solid' },
              { id: 'base', label: 'Without', values: baseLine, stroke: 'grey' },
            ]}
            xLabel="Year"
            formatY={(v) => compact(v)}
            formatValue={money.round}
            markers={c.sooner > 0 ? [{ x: c.fast.months / 12, label: `Paid off, year ${num(Math.ceil(c.fast.months / 12))}` }] : []}
            defaultIndex={Math.min(yearsAxis, 5)}
            summary={`Balance at the end of each year. With the extra payments the balance reaches zero after ${yearsMonths(c.fast.months)} instead of ${yearsMonths(c.base.months)}.`}
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <ResultPanel title="Principal and interest each year">
            <StackedBars
              categories={fy.map((r) => r.year)}
              series={[
                { id: 'p', label: 'Principal', values: fy.map((r) => r.principal), paint: 'ink' },
                { id: 'i', label: 'Interest', values: fy.map((r) => r.interest), paint: 'hatch' },
              ]}
              categoryLabel="Year"
              formatValue={money.round}
              showTotal
              summary={`In year 1, ${money.round(fy[0]?.interest ?? 0)} of what you pay is interest. By the last year, almost all of it goes to the principal.`}
              table
            />
          </ResultPanel>
          <Formula
            items={[
              {
                label: 'Monthly payment',
                general: 'M = P × i ÷ (1 − (1 + i)^−n)',
                steps: [`i = ${num(c.r, 3)}% ÷ 12 = ${i.toFixed(6)}, n = ${c.n}`, `M = ${money.exact(c.P)} × ${i.toFixed(6)} ÷ (1 − (1 + ${i.toFixed(6)})^−${c.n})`],
                result: money.exact(pay),
              },
              {
                label: 'Months to pay off with the monthly extra',
                general: 'n = −ln(1 − P × i ÷ (M + E)) ÷ ln(1 + i)',
                steps: [
                  `n = −ln(1 − ${money.exact(c.P)} × ${i.toFixed(6)} ÷ ${money.exact(pay + totalExtra)}) ÷ ln(1 + ${i.toFixed(6)})`,
                  'The schedule below also counts the yearly and one-time payments, month by month.',
                ],
                result: `${c.fast.months} months (${yearsMonths(c.fast.months)})`,
              },
              {
                label: 'Interest saved',
                general: 'Saved = interest without extra − interest with extra',
                steps: [`${money.exact(c.base.totalInterest)} − ${money.exact(c.fast.totalInterest)}`],
                result: money.exact(c.saved),
              },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'A fixed rate for the rest of the loan. Interest is charged monthly and rounded to the cent.',
              'Extra payments go straight to the principal. Ask your lender to confirm that it applies them this way and that there is no prepayment penalty.',
              'Taxes, insurance and escrow are not part of the payment shown.',
            ]}
          />
        </div>
      }
    />
  )
}
