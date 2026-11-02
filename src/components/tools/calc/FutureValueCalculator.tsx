import { useMemo, useState } from 'react'
import { AreaChart, compact } from '@/components/viz'
import { COMPOUND_FREQUENCIES, periodsPerYear } from '@/components/tools/finance/money'
import type { CompoundFrequency } from '@/components/tools/finance/money'
import { apy, futureValue, growthPath, ratePerPayment } from './money-math'
import { Assumptions, CalcGrid, Choice, Field, Formula, Headline, ResultPanel, SelectField, Stats, num, numUpTo, pct, toPositive, useCurrency } from './mb-ui'

type Timing = 'end' | 'start'

const FREQ_OPTIONS = COMPOUND_FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))

export default function FutureValueCalculator() {
  const { money, select } = useCurrency()
  const [pv, setPv] = useState('10000')
  const [pmt, setPmt] = useState('200')
  const [payFreq, setPayFreq] = useState<CompoundFrequency>('monthly')
  const [rate, setRate] = useState('6')
  const [years, setYears] = useState('15')
  const [compound, setCompound] = useState<CompoundFrequency>('monthly')
  const [timing, setTiming] = useState<Timing>('end')

  const c = useMemo(() => {
    const S = toPositive(pv)
    const P = toPositive(pmt)
    const r = Math.min(100, toPositive(rate))
    const m = periodsPerYear(compound)
    const per = periodsPerYear(payFreq)
    const n = Math.max(1, Math.min(per * 100, Math.round(toPositive(years, 15) * per)))
    const due = timing === 'start'
    const i = ratePerPayment(r, m, per)
    const lumpFv = futureValue(S, i, n)
    const payFv = futureValue(0, i, n, P, due)
    const total = lumpFv + payFv
    const paid = S + P * n
    const path = growthPath(S, P, i, n, due)
    const Y = Math.max(1, Math.ceil(n / per - 1e-9))
    const x = Array.from({ length: Y + 1 }, (_, y) => y)
    const rows = x.map((y) => path[Math.min(n, y * per)]!)
    if (n / per < Y) x[Y] = n / per
    return { S, P, r, m, per, n, due, i, lumpFv, payFv, total, paid, interest: total - paid, x, rows, ear: apy(r, m) }
  }, [pv, pmt, payFreq, rate, years, compound, timing])

  const T = numUpTo(c.n / c.per, 2)
  const iTxt = numUpTo(c.i, 8)
  const share = c.total > 0 ? (c.interest / c.total) * 100 : 0
  const crossIdx = c.P > 0 ? c.rows.findIndex((row) => row.gain > row.invested - c.S && row.gain > 0) : -1
  const freqWord = COMPOUND_FREQUENCIES.find((f) => f.value === payFreq)?.label.split(' ')[0]?.toLowerCase() ?? ''

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="fv-pv" label="Starting amount (present value)" value={pv} onChange={setPv} prefix={money.symbol} />
          <Field id="fv-pmt" label="Payment each period" value={pmt} onChange={setPmt} prefix={money.symbol} slider={{ min: 0, max: 2000, step: 25 }} />
          <SelectField id="fv-pay-freq" label="Payment frequency" value={payFreq} onChange={(v) => setPayFreq(v as CompoundFrequency)} options={FREQ_OPTIONS} />
          <Field id="fv-rate" label="Annual interest rate" value={rate} onChange={setRate} suffix="%" slider={{ min: 0, max: 20, step: 0.1 }} />
          <Field id="fv-years" label="Years" value={years} onChange={setYears} suffix="yrs" slider={{ min: 1, max: 50, step: 1 }} />
          <SelectField id="fv-compound" label="Compounding" value={compound} onChange={(v) => setCompound(v as CompoundFrequency)} options={FREQ_OPTIONS} />
          <Choice
            label="Payments at"
            value={timing}
            onChange={setTiming}
            options={[
              { value: 'end', label: 'End of period' },
              { value: 'start', label: 'Start of period' },
            ]}
          />
          {select('fv-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label="Future value"
            value={c.total}
            format={money.exact}
            hint={`${money.exact(c.S)} today${c.P > 0 ? ` and ${money.exact(c.P)} ${freqWord}` : ''} for ${T} years at ${numUpTo(c.r, 3)}% a year.`}
          />
          <Stats
            items={[
              { label: 'Total paid in', value: money.exact(c.paid) },
              { label: 'Interest', value: money.exact(c.interest), hint: `${pct(share, 1)} of the future value` },
              { label: 'Effective annual rate', value: pct(c.ear, 3) },
            ]}
          />
          <AreaChart
            x={c.x}
            series={[
              { id: 'start', label: 'Starting amount', values: c.rows.map(() => c.S), paint: 'grey' },
              { id: 'pay', label: 'Payments', values: c.rows.map((row) => row.invested - c.S), paint: 'ink' },
              { id: 'int', label: 'Interest', values: c.rows.map((row) => row.gain), paint: 'hatch' },
            ]}
            xLabel="Year"
            formatX={(t) => numUpTo(t, 2)}
            formatY={(v) => compact(v)}
            formatValue={money.round}
            summary={
              `Balance at the end of each year. After ${T} years it is ${money.round(c.total)}: ${money.round(c.S)} starting amount, ${money.round(c.paid - c.S)} in payments and ${money.round(c.interest)} interest.` +
              (crossIdx > 0 ? ` From year ${num(c.x[crossIdx]!, 0)}, the interest earned so far is more than the payments made so far.` : '')
            }
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <Formula
            items={[
              {
                label: 'Rate per payment period',
                general: c.m === c.per ? 'i = r ÷ m' : 'i = (1 + r ÷ m)^(m ÷ p) − 1',
                steps: [
                  c.m === c.per
                    ? `i = ${numUpTo(c.r, 4)}% ÷ ${c.m}`
                    : `i = (1 + ${numUpTo(c.r, 4)}% ÷ ${c.m})^(${c.m} ÷ ${c.per}) − 1`,
                  `n = ${T} years × ${c.per} = ${c.n} periods`,
                ],
                result: iTxt,
              },
              {
                label: 'Growth of the starting amount',
                general: 'PV × (1 + i)^n',
                steps: [`${money.exact(c.S)} × (1 + ${iTxt})^${c.n}`],
                result: money.exact(c.lumpFv),
              },
              {
                label: 'Growth of the payments',
                general: c.due ? 'PMT × ((1 + i)^n − 1) ÷ i × (1 + i)' : 'PMT × ((1 + i)^n − 1) ÷ i',
                steps: [`${money.exact(c.P)} × ((1 + ${iTxt})^${c.n} − 1) ÷ ${iTxt}${c.due ? ` × (1 + ${iTxt})` : ''}`],
                result: money.exact(c.payFv),
              },
              {
                label: 'Future value and interest',
                general: 'FV = growth of the starting amount + growth of the payments',
                steps: [
                  `FV = ${money.exact(c.lumpFv)} + ${money.exact(c.payFv)} = ${money.exact(c.total)}`,
                  `Interest = FV − paid in = ${money.exact(c.total)} − ${money.exact(c.paid)}`,
                ],
                result: money.exact(c.interest),
              },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'The rate is the same for the whole time.',
              'Payments are the same size every period. Years are rounded to whole payment periods.',
              'Tax, fees and inflation are not included.',
            ]}
          />
        </div>
      }
    />
  )
}
