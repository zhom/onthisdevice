import { useMemo, useState } from 'react'
import { LineChart, StackedBars, compact } from '@/components/viz'
import { MACRS, depreciation } from './money-math'
import type { DepMethod } from './money-math'
import { Assumptions, CalcGrid, Field, Formula, Headline, ResultPanel, SelectField, Stats, num, toPositive, useCurrency } from './mb-ui'

const METHODS: { value: DepMethod; label: string }[] = [
  { value: 'sl', label: 'Straight line' },
  { value: 'ddb', label: 'Double declining balance' },
  { value: 'db150', label: '150% declining balance' },
  { value: 'syd', label: 'Sum of the years’ digits' },
  { value: 'macrs', label: 'MACRS (US tax, half-year)' },
]
const CLASSES = Object.keys(MACRS).map((k) => ({ value: k, label: `${k}-year property` }))

export default function DepreciationCalculator() {
  const { money, select } = useCurrency()
  const [cost, setCost] = useState('50000')
  const [salvage, setSalvage] = useState('5000')
  const [life, setLife] = useState('5')
  const [method, setMethod] = useState<DepMethod>('ddb')
  const [klass, setKlass] = useState('5')

  const C = toPositive(cost)
  const S = toPositive(salvage)
  const n = Math.max(1, Math.min(50, Math.round(toPositive(life, 5))))
  const macrsLife = Number(klass)
  const all = useMemo(() => {
    const out = {} as Record<DepMethod, ReturnType<typeof depreciation>>
    for (const m of METHODS) out[m.value] = depreciation(C, S, m.value === 'macrs' ? macrsLife : n, m.value)
    return out
  }, [C, S, n, macrsLife])

  const rows = all[method]
  const first = rows[0]?.depreciation ?? 0
  const total = rows.reduce((a, r) => a + r.depreciation, 0)
  const span = Math.max(...METHODS.map((m) => all[m.value].length))
  const years = Array.from({ length: span + 1 }, (_, i) => i)
  const bookAt = (m: DepMethod, y: number) => (y === 0 ? C : all[m][Math.min(all[m].length, y) - 1]?.book ?? 0)
  const label = METHODS.find((m) => m.value === method)?.label ?? ''
  const rate = method === 'ddb' ? 2 / n : method === 'db150' ? 1.5 / n : 0
  const sum = (n * (n + 1)) / 2

  const formula =
    method === 'sl'
      ? { general: 'D = (cost − salvage) ÷ life', steps: [`(${money.exact(C)} − ${money.exact(S)}) ÷ ${n}`] }
      : method === 'syd'
        ? { general: 'D(year t) = (cost − salvage) × (life − t + 1) ÷ (life × (life + 1) ÷ 2)', steps: [`year 1: (${money.exact(C)} − ${money.exact(S)}) × ${n} ÷ ${sum}`] }
        : method === 'macrs'
          ? { general: 'D(year t) = cost × MACRS % for year t (IRS Pub. 946, table A-1)', steps: [`year 1: ${money.exact(C)} × ${num(MACRS[macrsLife]?.[0] ?? 0, 2)}%`] }
          : {
              general: 'D(year t) = book value × rate, rate = factor ÷ life; switch to straight line when that is larger; never below salvage',
              steps: [`rate = ${method === 'ddb' ? 2 : 1.5} ÷ ${n} = ${num(rate * 100, 2)}%`, `year 1: ${money.exact(C)} × ${num(rate * 100, 2)}%`],
            }

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="dep-cost" label="Cost of the asset" value={cost} onChange={setCost} prefix={money.symbol} />
          <SelectField id="dep-method" label="Method" value={method} onChange={(v) => setMethod(v as DepMethod)} options={METHODS} />
          {method === 'macrs' ? (
            <SelectField id="dep-class" label="Property class" value={klass} onChange={setKlass} options={CLASSES} hint="salvage is ignored" />
          ) : (
            <>
              <Field id="dep-salvage" label="Salvage value" value={salvage} onChange={setSalvage} prefix={money.symbol} />
              <Field id="dep-life" label="Useful life" value={life} onChange={setLife} suffix="yrs" slider={{ min: 1, max: 40, step: 1 }} />
            </>
          )}
          {select('dep-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline label="Depreciation in year 1" value={first} format={money.exact} hint={`${label}: ${money.round(total)} over ${rows.length} years.`} />
          <Stats
            items={[
              { label: 'Total depreciation', value: money.round(total) },
              { label: 'Book value at the end', value: money.round(rows[rows.length - 1]?.book ?? C) },
              { label: 'Years', value: num(rows.length, 0) },
            ]}
          />
          <StackedBars
            categories={rows.map((r) => r.year)}
            series={[{ id: 'd', label: 'Depreciation', values: rows.map((r) => r.depreciation), paint: 'ink' }]}
            categoryLabel="Year"
            formatValue={money.exact}
            summary={`${label}: ${money.round(first)} in year 1 and ${money.round(rows[rows.length - 1]?.depreciation ?? 0)} in the last year.`}
            table={{
              columns: ['Year', 'Depreciation', 'Accumulated', 'Book value'],
              rows: rows.map((r) => [r.year, money.exact(r.depreciation), money.exact(r.accumulated), money.exact(r.book)]),
            }}
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <ResultPanel title="Book value by method">
            <LineChart
              x={years}
              series={[
                { id: 'sl', label: 'Straight line', values: years.map((y) => bookAt('sl', y)), stroke: 'grey' },
                { id: 'ddb', label: 'Double declining', values: years.map((y) => bookAt('ddb', y)), stroke: 'solid' },
                { id: 'syd', label: 'Sum of digits', values: years.map((y) => bookAt('syd', y)), stroke: 'dash' },
                { id: 'macrs', label: `MACRS ${macrsLife}-yr`, values: years.map((y) => bookAt('macrs', y)), stroke: 'dot' },
              ]}
              xLabel="Year"
              formatY={(v) => compact(v)}
              formatValue={money.round}
              defaultIndex={1}
              summary={`After year 1 the book value is ${money.round(bookAt('sl', 1))} with straight line, ${money.round(bookAt('ddb', 1))} with double declining balance and ${money.round(bookAt('syd', 1))} with sum of the years' digits. Accelerated methods take more of the cost early.`}
            />
          </ResultPanel>
          <Formula
            items={[
              { label: `${label}, year 1`, ...formula, result: money.exact(first) },
              { label: 'Book value', general: 'book = cost − accumulated depreciation', steps: [`${money.exact(C)} − ${money.exact(total)}`], result: money.exact(C - total) },
            ]}
          />
          <Assumptions
            title="Limits"
            items={[
              'Full years from the date the asset is placed in service, except MACRS, which uses the half-year convention.',
              'MACRS uses the General Depreciation System tables; mid-quarter and mid-month conventions, bonus depreciation and Section 179 are not included.',
              'Amounts are rounded to the cent each year; the last year takes the remainder.',
            ]}
          />
        </div>
      }
    />
  )
}
