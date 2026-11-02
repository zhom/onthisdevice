import { useMemo, useState } from 'react'
import { BarList, LineChart } from '@/components/viz'
import { yearsToDouble, yearsToDoubleContinuous } from './money-math'
import { Assumptions, CalcGrid, Field, Formula, Headline, ResultPanel, Stats, num, numUpTo, pct, toPositive } from './mb-ui'

const STEPS = 60

export default function RuleOf72Calculator() {
  const [rate, setRate] = useState('8')

  const c = useMemo(() => {
    const r = Math.min(1000, toPositive(rate))
    const ok = r > 0
    const exact = yearsToDouble(r) ?? Number.NaN
    const rule72 = ok ? 72 / r : Number.NaN
    const rule70 = ok ? 70 / r : Number.NaN
    const cont = yearsToDoubleContinuous(r) ?? Number.NaN
    const err = rule72 - exact
    const T = ok ? 3 * exact : 1
    const x = Array.from({ length: STEPS + 1 }, (_, k) => (T * k) / STEPS)
    const growth = x.map((t) => Math.pow(1 + r / 100, t))
    return { r, ok, exact, rule72, rule70, cont, err, rel: (err / exact) * 100, T, x, growth }
  }, [rate])

  const rTxt = pct(c.r, numUpTo(c.r, 2).includes('.') ? 2 : 0)
  const yrs = (v: number) => `${num(v, 2)} years`
  const errTxt = `${c.err < 0 ? '−' : '+'}${num(Math.abs(c.err), 2)} years`

  return (
    <CalcGrid
      inputs={
        <Field id="r72-rate" label="Annual rate of return" value={rate} onChange={setRate} suffix="%" slider={{ min: 1, max: 30, step: 0.5 }} hint="compounded once a year" />
      }
      results={
        <ResultPanel>
          <Headline
            label="Years to double by the rule of 72"
            value={c.rule72}
            format={yrs}
            hint={c.ok ? `72 ÷ ${numUpTo(c.r, 2)} = ${num(c.rule72, 2)}. The exact time at ${rTxt} a year is ${yrs(c.exact)}.` : 'Enter a rate above 0.'}
          />
          <Stats
            cols={2}
            items={[
              { label: 'Exact years', value: c.ok ? num(c.exact, 3) : '–', hint: 'ln 2 ÷ ln(1 + r)' },
              { label: 'Error of the rule of 72', value: c.ok ? errTxt : '–', hint: c.ok ? `${pct(Math.abs(c.rel), 2)} ${c.err < 0 ? 'too short' : 'too long'}` : undefined },
              { label: 'Rule of 70', value: c.ok ? num(c.rule70, 2) : '–', hint: `70 ÷ ${numUpTo(c.r, 2)}` },
              { label: 'Rule of 69.3', value: c.ok ? num(c.cont, 2) : '–', hint: 'continuous compounding' },
            ]}
          />
          <LineChart
            x={c.x}
            series={[{ id: 'g', label: 'Value of 1', values: c.growth, stroke: 'solid' }]}
            xLabel="Year"
            formatX={(t) => numUpTo(t, 1)}
            formatY={(v) => `${numUpTo(v, 1)}×`}
            formatValue={(v) => `${num(v, 2)}×`}
            markers={c.ok ? [1, 2, 3].map((k) => ({ x: k * c.exact, label: `×${2 ** k}` })) : []}
            summary={
              c.ok
                ? `One unit growing at ${rTxt} a year doubles after ${num(c.exact, 2)} years, is 4 times larger after ${num(2 * c.exact, 2)} years and 8 times larger after ${num(3 * c.exact, 2)} years. Each doubling takes the same time.`
                : 'Enter a rate above 0.'
            }
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <ResultPanel title="The rules compared">
            <BarList
              items={[
                { label: 'Rule of 72', note: `72 ÷ ${numUpTo(c.r, 2)}`, value: c.rule72 },
                { label: 'Rule of 70', note: `70 ÷ ${numUpTo(c.r, 2)}`, value: c.rule70 },
                { label: 'Rule of 69.3', note: 'continuous', value: c.cont },
                { label: 'Exact', note: 'compounded yearly', value: c.exact, highlight: true },
              ]}
              formatValue={(v) => (Number.isFinite(v) ? `${num(v, 2)} yrs` : '–')}
              columns={['Rule', 'Years to double']}
              summary={
                c.ok
                  ? `At ${rTxt}, the rule of 72 is off by ${num(Math.abs(c.err), 2)} years. Of the three rules, the rule of 70 is closest from about 1% to 5% and the rule of 72 above 5%. Above 7.85%, all three give fewer years than the exact answer.`
                  : 'Enter a rate above 0.'
              }
              table
            />
          </ResultPanel>
          <Formula
            items={[
              {
                label: 'Rule of 72',
                general: 't ≈ 72 ÷ r',
                steps: [`t ≈ 72 ÷ ${numUpTo(c.r, 2)}`],
                result: c.ok ? `${num(c.rule72, 4)} years` : '–',
              },
              {
                label: 'Exact, compounded once a year',
                general: 't = ln 2 ÷ ln(1 + r)',
                steps: [`t = ${num(Math.LN2, 6)} ÷ ln(1 + ${numUpTo(c.r / 100, 6)})`, `t = ${num(Math.LN2, 6)} ÷ ${num(Math.log(1 + c.r / 100), 6)}`],
                result: c.ok ? `${num(c.exact, 4)} years` : '–',
              },
              {
                label: 'Rule of 70 and rule of 69.3',
                general: 't ≈ 70 ÷ r;  continuous: t = 100 × ln 2 ÷ r = 69.31 ÷ r',
                steps: [`70 ÷ ${numUpTo(c.r, 2)} = ${num(c.rule70, 4)}`, `69.31 ÷ ${numUpTo(c.r, 2)} = ${num(c.cont, 4)}`],
                result: c.ok ? `${num(c.rule70, 2)} and ${num(c.cont, 2)} years` : '–',
              },
              {
                label: 'Error of the rule of 72',
                general: 'error = 72 ÷ r − exact',
                steps: [`${num(c.rule72, 4)} − ${num(c.exact, 4)}`],
                result: c.ok ? `${c.err < 0 ? '−' : ''}${num(Math.abs(c.err), 4)} years (${pct(c.rel, 2)})` : '–',
              },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'The rate is the same every year and the growth stays invested.',
              'Tax, fees and new deposits are not included.',
              'The same rules work for anything that grows by a fixed share each year, such as prices under steady inflation.',
            ]}
          />
        </div>
      }
    />
  )
}
