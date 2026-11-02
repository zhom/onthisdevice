import { useMemo, useState } from 'react'
import { Gauge, Split } from '@/components/viz'
import { dti } from './money-math'
import { Assumptions, CalcGrid, Choice, Field, Formula, Headline, ResultPanel, Stats, num, toPositive, useCurrency } from './mb-ui'

const BANDS = [
  { to: 36, label: 'Good' },
  { to: 43, label: 'Manageable' },
  { to: 50, label: 'High' },
  { to: 70, label: 'Too high' },
]

export default function DebtToIncomeRatioCalculator() {
  const { money, select } = useCurrency()
  const [period, setPeriod] = useState<'month' | 'year'>('month')
  const [income, setIncome] = useState('6500')
  const [housing, setHousing] = useState('1800')
  const [car, setCar] = useState('450')
  const [student, setStudent] = useState('300')
  const [cards, setCards] = useState('120')
  const [other, setOther] = useState('0')

  const c = useMemo(() => {
    const monthlyIncome = period === 'month' ? toPositive(income) : toPositive(income) / 12
    const h = toPositive(housing)
    const debts = h + toPositive(car) + toPositive(student) + toPositive(cards) + toPositive(other)
    const back = dti(debts, monthlyIncome)
    const front = dti(h, monthlyIncome)
    return { monthlyIncome, h, debts, back, front }
  }, [period, income, housing, car, student, cards, other])

  const back = c.back ?? NaN
  const band = BANDS.find((b) => back < b.to) ?? BANDS[BANDS.length - 1]!
  const room = (limit: number) => Math.max(0, (c.monthlyIncome * limit) / 100 - c.debts)

  return (
    <CalcGrid
      inputs={
        <>
          <Choice
            label="Income is entered"
            value={period}
            onChange={(v) => {
              setIncome(String(Math.round(v === 'year' ? toPositive(income) * 12 : toPositive(income) / 12)))
              setPeriod(v)
            }}
            options={[
              { value: 'month', label: 'Monthly' },
              { value: 'year', label: 'Yearly' },
            ]}
          />
          <Field id="dti-income" label={`Gross income, ${period === 'month' ? 'monthly' : 'yearly'}`} value={income} onChange={setIncome} prefix={money.symbol} hint="before tax" />
          <Field id="dti-housing" label="Rent or mortgage payment" value={housing} onChange={setHousing} prefix={money.symbol} hint="with tax, insurance, HOA" />
          <Field id="dti-car" label="Car loans" value={car} onChange={setCar} prefix={money.symbol} />
          <Field id="dti-student" label="Student loans" value={student} onChange={setStudent} prefix={money.symbol} />
          <Field id="dti-cards" label="Credit card minimums" value={cards} onChange={setCards} prefix={money.symbol} />
          <Field id="dti-other" label="Other debt payments" value={other} onChange={setOther} prefix={money.symbol} hint="personal loans, support" />
          {select('dti-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Debt-to-income ratio"
            value={back}
            format={(v) => `${num(v, 1)}%`}
            hint={c.back === null ? 'Enter your income to see the ratio.' : `${band.label}. ${money.round(c.debts)} of debt payments on ${money.round(c.monthlyIncome)} a month.`}
          />
          <Stats
            items={[
              { label: 'Housing ratio', value: c.front === null ? '–' : `${num(c.front, 1)}%`, hint: 'front-end' },
              { label: 'Room to 36%', value: money.round(room(36)), hint: 'more payments a month' },
              { label: 'Room to 43%', value: money.round(room(43)), hint: 'more payments a month' },
            ]}
          />
          <Gauge
            value={Number.isFinite(back) ? back : 0}
            min={0}
            max={70}
            bands={BANDS}
            formatValue={(v) => `${num(v, 0)}%`}
            center={
              <>
                <span className="text-xl font-[720]">{num(back, 1)}%</span>
                <span className="block text-xs text-muted-foreground">{band.label}</span>
              </>
            }
            summary={`Your ratio is ${num(back, 1)}%. Many lenders want 36% or less; 43% is a common limit for a qualified US mortgage, and some government-backed loans allow up to about 50%.`}
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <ResultPanel title="Your monthly income">
            <Split
              parts={[
                { label: 'Housing', value: c.h, paint: 'ink' },
                { label: 'Other debts', value: c.debts - c.h, paint: 'hatch' },
                { label: 'Left for everything else', value: Math.max(0, c.monthlyIncome - c.debts), paint: 'grey' },
              ]}
              formatValue={money.round}
              summary={`Before tax, ${money.round(Math.max(0, c.monthlyIncome - c.debts))} of your monthly income is left after debt payments.`}
            />
          </ResultPanel>
          <Formula
            items={[
              {
                label: 'Debt-to-income ratio (back-end)',
                general: 'DTI = monthly debt payments ÷ gross monthly income × 100',
                steps: [`(${[housing, car, student, cards, other].map((v) => money.exact(toPositive(v))).join(' + ')}) ÷ ${money.exact(c.monthlyIncome)} × 100`],
                result: `${num(back, 2)}%`,
              },
              {
                label: 'Housing ratio (front-end)',
                general: 'housing payment ÷ gross monthly income × 100',
                steps: [`${money.exact(c.h)} ÷ ${money.exact(c.monthlyIncome)} × 100`],
                result: c.front === null ? '–' : `${num(c.front, 2)}%`,
              },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'Count only required monthly payments. Utilities, phone, food and insurance that is not part of the mortgage do not count.',
              'Lenders set their own limits and also look at credit score, savings and the down payment.',
              'Use gross (before tax) income. A self-employed borrower usually uses the income on the tax return.',
            ]}
          />
        </div>
      }
    />
  )
}
