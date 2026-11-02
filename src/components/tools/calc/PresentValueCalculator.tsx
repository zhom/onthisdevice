import { useMemo, useState } from 'react'
import { LineChart, Split, compact } from '@/components/viz'
import { COMPOUND_FREQUENCIES, periodsPerYear } from '@/components/tools/finance/money'
import type { CompoundFrequency } from '@/components/tools/finance/money'
import { presentValue, ratePerPayment } from './money-math'
import { Assumptions, CalcGrid, Choice, Field, FieldGroup, Formula, Headline, ResultPanel, SelectField, Stats, num, numUpTo, toPositive, useCurrency } from './mb-ui'

type Timing = 'end' | 'start'

const FREQ_OPTIONS = COMPOUND_FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))

export default function PresentValueCalculator() {
  const { money, select } = useCurrency()
  const [fv, setFv] = useState('10000')
  const [rate, setRate] = useState('5')
  const [years, setYears] = useState('10')
  const [compound, setCompound] = useState<CompoundFrequency>('annually')
  const [pmt, setPmt] = useState('0')
  const [payFreq, setPayFreq] = useState<CompoundFrequency>('annually')
  const [timing, setTiming] = useState<Timing>('end')

  const c = useMemo(() => {
    const F = toPositive(fv)
    const r = Math.min(100, toPositive(rate))
    const m = periodsPerYear(compound)
    const per = periodsPerYear(payFreq)
    const n = Math.max(1, Math.min(per * 100, Math.round(toPositive(years, 10) * per)))
    const P = toPositive(pmt)
    const due = timing === 'start'
    const i = ratePerPayment(r, m, per)
    const factor = presentValue(1, i, n)
    const lumpPv = presentValue(F, i, n)
    const total = presentValue(F, i, n, P, due)
    const payPv = total - lumpPv
    const received = F + P * n
    const T = n / per
    const yearly = ratePerPayment(r, m, 1)
    const Y = Math.max(1, Math.ceil(T - 1e-9))
    const x = Array.from({ length: Y + 1 }, (_, t) => t)
    if (T < Y) x[Y] = T
    const curve = x.map((t) => presentValue(F, yearly, t))
    return { F, r, m, per, n, P, due, i, factor, lumpPv, total, payPv, received, discount: received - total, T, yearly, x, curve }
  }, [fv, rate, years, compound, pmt, payFreq, timing])

  const tYears = numUpTo(c.T, 2)
  const iTxt = numUpTo(c.i, 8)
  const growth = `(1 + ${iTxt})^${c.n}`

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="pv-fv" label="Future amount" value={fv} onChange={setFv} prefix={money.symbol} />
          <Field id="pv-rate" label="Annual interest rate" value={rate} onChange={setRate} suffix="%" slider={{ min: 0, max: 20, step: 0.1 }} />
          <Field id="pv-years" label="Years until you receive it" value={years} onChange={setYears} suffix="yrs" slider={{ min: 1, max: 50, step: 1 }} />
          <SelectField id="pv-compound" label="Compounding" value={compound} onChange={(v) => setCompound(v as CompoundFrequency)} options={FREQ_OPTIONS} />
          <FieldGroup title="Level payments (optional)" columns={1}>
            <Field id="pv-pmt" label="Payment" value={pmt} onChange={setPmt} prefix={money.symbol} />
            <SelectField id="pv-pay-freq" label="Payment frequency" value={payFreq} onChange={(v) => setPayFreq(v as CompoundFrequency)} options={FREQ_OPTIONS} />
            <Choice
              label="Payments at"
              value={timing}
              onChange={setTiming}
              options={[
                { value: 'end', label: 'End of period' },
                { value: 'start', label: 'Start of period' },
              ]}
            />
          </FieldGroup>
          {select('pv-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Present value"
            value={c.total}
            format={money.exact}
            hint={
              c.P > 0
                ? `${money.exact(c.F)} in ${tYears} years plus ${c.n} payments of ${money.exact(c.P)} is worth ${money.exact(c.total)} today at ${numUpTo(c.r, 3)}% a year.`
                : `${money.exact(c.F)} in ${tYears} years is worth ${money.exact(c.total)} today at ${numUpTo(c.r, 3)}% a year.`
            }
          />
          <Stats
            items={[
              { label: 'Discount', value: money.exact(c.discount), hint: c.P > 0 ? `of ${money.round(c.received)} received` : 'future amount − present value' },
              { label: 'Discount factor', value: num(c.factor, 6), hint: `${c.n} periods at ${numUpTo(c.i * 100, 4)}%` },
              ...(c.P > 0 ? [{ label: 'Value of the payments', value: money.exact(c.payPv) }] : []),
            ]}
          />
          <Split
            parts={[
              { label: 'Present value', value: c.total, paint: 'ink' },
              { label: 'Discount', value: c.discount, paint: 'hatch' },
            ]}
            formatValue={money.round}
            summary={`Of the ${money.round(c.received)} you receive, ${money.round(c.total)} is its value today and ${money.round(c.discount)} is the discount for waiting.`}
          />
          <LineChart
            x={c.x}
            series={[{ id: 'pv', label: 'Worth today', values: c.curve, stroke: 'solid' }]}
            xLabel="Arrives in year"
            formatX={(t) => numUpTo(t, 2)}
            formatY={(v) => compact(v)}
            formatValue={money.round}
            markers={[{ x: c.T, label: `Year ${tYears}: ${money.round(c.lumpPv)}` }]}
            summary={`What ${money.round(c.F)} is worth today if it arrives in year t. Each year of waiting multiplies the value today by ${num(1 / (1 + c.yearly), 4)}, so in year ${tYears} it is worth ${money.round(c.lumpPv)}.`}
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula
            items={[
              {
                label: 'Rate per period',
                general: c.m === c.per ? 'i = r ÷ m' : 'i = (1 + r ÷ m)^(m ÷ p) − 1',
                steps: [
                  c.m === c.per
                    ? `i = ${numUpTo(c.r, 4)}% ÷ ${c.m}`
                    : `i = (1 + ${numUpTo(c.r, 4)}% ÷ ${c.m})^(${c.m} ÷ ${c.per}) − 1`,
                  `n = ${numUpTo(c.n / c.per, 4)} years × ${c.per} = ${c.n} periods`,
                ],
                result: iTxt,
              },
              {
                label: 'Present value of the future amount',
                general: 'PV = FV ÷ (1 + i)^n',
                steps: [`PV = ${money.exact(c.F)} ÷ ${growth}`, `PV = ${money.exact(c.F)} × ${num(c.factor, 6)}`],
                result: money.exact(c.lumpPv),
              },
              ...(c.P > 0
                ? [
                    {
                      label: 'Present value of the payments',
                      general: c.due ? 'PV = PMT × (1 − (1 + i)^−n) ÷ i × (1 + i)' : 'PV = PMT × (1 − (1 + i)^−n) ÷ i',
                      steps: [
                        `PV = ${money.exact(c.P)} × (1 − (1 + ${iTxt})^−${c.n}) ÷ ${iTxt}${c.due ? ` × (1 + ${iTxt})` : ''}`,
                      ],
                      result: money.exact(c.payPv),
                    },
                  ]
                : []),
              {
                label: 'Discount',
                general: 'Discount = amount received − PV',
                steps: [`${money.exact(c.received)} − ${money.exact(c.total)}`],
                result: money.exact(c.discount),
              },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'The rate is the same in every period.',
              'Years are rounded to whole payment periods.',
              'Tax, fees and inflation are not included. To see the value in today’s prices, enter a rate after inflation.',
            ]}
          />
        </div>
      }
    />
  )
}
