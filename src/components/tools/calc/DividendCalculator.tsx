import { useMemo, useState } from 'react'
import { LineChart, StackedBars, compact } from '@/components/viz'
import { dividends } from './money-math'
import { Assumptions, CalcGrid, Choice, Field, Formula, Headline, ResultPanel, Stats, numUpTo, pct, toPositive, useCurrency } from './mb-ui'

type YesNo = 'yes' | 'no'

export default function DividendCalculator() {
  const { money, select } = useCurrency()
  const [initial, setInitial] = useState('10000')
  const [add, setAdd] = useState('1200')
  const [yieldPct, setYieldPct] = useState('4')
  const [divGrowth, setDivGrowth] = useState('5')
  const [priceGrowth, setPriceGrowth] = useState('4')
  const [tax, setTax] = useState('15')
  const [reinvest, setReinvest] = useState<YesNo>('yes')
  const [years, setYears] = useState('20')

  const c = useMemo(() => {
    const x = {
      initial: toPositive(initial),
      yearlyAdd: toPositive(add),
      yieldPct: toPositive(yieldPct),
      dividendGrowthPct: toPositive(divGrowth),
      priceGrowthPct: toPositive(priceGrowth),
      taxPct: Math.min(100, toPositive(tax)),
      reinvest: reinvest === 'yes',
      years: Math.max(1, Math.min(60, Math.round(toPositive(years, 20)))),
    }
    const rows = dividends(x)
    const last = rows[rows.length - 1]!
    const keep = 1 - x.taxPct / 100
    const dpsLast = (x.yieldPct / 100) * Math.pow(1 + x.dividendGrowthPct / 100, x.years - 1)
    const priceLast = Math.pow(1 + x.priceGrowthPct / 100, x.years - 1)
    const sharesLast = dpsLast * keep > 0 ? last.income / (dpsLast * keep) : 0
    return { x, rows, last, keep, dpsLast, priceLast, sharesLast, first: rows[0]! }
  }, [initial, add, yieldPct, divGrowth, priceGrowth, tax, reinvest, years])

  const { x, rows, last, first } = c
  const yieldOnCost = last.invested > 0 ? (last.income / last.invested) * 100 : 0

  return (
    <CalcGrid
      inputs={
        <>
          <Field id="dv-initial" label="Initial investment" value={initial} onChange={setInitial} prefix={money.symbol} />
          <Field id="dv-add" label="Added each year" value={add} onChange={setAdd} prefix={money.symbol} />
          <Field id="dv-yield" label="Dividend yield" value={yieldPct} onChange={setYieldPct} suffix="%" slider={{ min: 0, max: 10, step: 0.1 }} />
          <div className="grid grid-cols-2 gap-3">
            <Field id="dv-div-growth" label="Dividend growth" value={divGrowth} onChange={setDivGrowth} suffix="%" />
            <Field id="dv-price-growth" label="Price growth" value={priceGrowth} onChange={setPriceGrowth} suffix="%" />
          </div>
          <Field id="dv-tax" label="Tax on dividends" value={tax} onChange={setTax} suffix="%" />
          <Choice
            id="dv-reinvest"
            label="Reinvest dividends"
            value={reinvest}
            onChange={setReinvest}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No, take the cash' },
            ]}
          />
          <Field id="dv-years" label="Years" value={years} onChange={setYears} suffix="yrs" slider={{ min: 1, max: 50, step: 1 }} />
          {select('dv-currency')}
        </>
      }
      results={
        <ResultPanel>
          <Headline
            label={`Dividend income in year ${x.years}, after tax`}
            value={last.income}
            format={money.exact}
            hint={`That is ${pct(yieldOnCost, 1)} of the ${money.round(last.invested)} you put in.`}
          />
          <Stats
            items={[
              { label: 'Per month', value: money.exact(last.income / 12) },
              { label: 'Total dividends received', value: money.round(last.totalIncome), hint: x.reinvest ? 'all reinvested' : 'paid out as cash' },
              { label: 'Value of the holding', value: money.round(last.value), hint: `after ${x.years} years` },
            ]}
          />
          <StackedBars
            categories={rows.map((r) => r.year)}
            series={[{ id: 'inc', label: 'Dividends after tax', values: rows.map((r) => r.income), paint: 'ink' }]}
            categoryLabel="Year"
            formatValue={money.exact}
            defaultIndex={rows.length - 1}
            summary={`Dividends after tax each year, from ${money.exact(first.income)} in year 1 to ${money.exact(last.income)} in year ${x.years}.${x.reinvest ? ' Reinvested dividends buy more shares, and those shares pay dividends too.' : ''}`}
            table
          />
        </ResultPanel>
      }
      below={
        <div className="space-y-6">
          <ResultPanel title="Value of the holding">
            <LineChart
              x={rows.map((r) => r.year)}
              series={[
                { id: 'val', label: 'Value', values: rows.map((r) => r.value), stroke: 'solid' },
                { id: 'inv', label: 'Money put in', values: rows.map((r) => r.invested), stroke: 'grey' },
              ]}
              xLabel="Year"
              formatY={(v) => compact(v)}
              formatValue={money.round}
              summary={`After ${x.years} years the holding is worth ${money.round(last.value)}, against ${money.round(last.invested)} put in.${x.reinvest ? '' : ` The ${money.round(last.totalIncome)} of dividends paid out as cash is not in this value.`}`}
              table
            />
          </ResultPanel>
          <Formula
            items={[
              {
                label: 'Dividend income in year 1',
                general: 'D(1) = (P + A) × y × (1 − tax)',
                steps: [`D(1) = (${money.exact(x.initial)} + ${money.exact(x.yearlyAdd)}) × ${numUpTo(x.yieldPct, 2)}% × (1 − ${numUpTo(x.taxPct / 100, 4)})`],
                result: money.exact(first.income),
              },
              {
                label: `Dividend per share in year ${x.years} (the share price starts at 1)`,
                general: 'd(n) = y × (1 + g)^(n − 1)',
                steps: [`d(${x.years}) = ${numUpTo(x.yieldPct / 100, 6)} × ${numUpTo(1 + x.dividendGrowthPct / 100, 6)}^${x.years - 1}`],
                result: c.dpsLast.toFixed(6),
              },
              {
                label: `Dividend income in year ${x.years}`,
                general: 'D(n) = shares × d(n) × (1 − tax)',
                steps: [
                  `price(${x.years}) = (1 + p)^(n − 1) = ${numUpTo(1 + x.priceGrowthPct / 100, 6)}^${x.years - 1} = ${c.priceLast.toFixed(4)}`,
                  `D(${x.years}) = ${numUpTo(c.sharesLast, 2)} shares × ${c.dpsLast.toFixed(6)} × ${numUpTo(c.keep, 4)}`,
                ],
                result: money.exact(last.income),
              },
              {
                label: 'Per month',
                general: 'D(n) ÷ 12',
                steps: [`${money.exact(last.income)} ÷ 12`],
                result: money.exact(last.income / 12),
              },
            ]}
            note={`Each addition buys shares at the price of its year.${x.reinvest ? ' Each dividend after tax buys shares at the price at the end of its year.' : ''} The share count is the sum of these purchases.`}
          />
          <Assumptions
            title="Limits"
            items={[
              'The yield, the dividend growth and the price growth stay the same every year. Companies can cut dividends and prices can fall.',
              'Additions go in at the start of each year and dividends are paid once, at the end of the year. Most stocks and funds pay quarterly, which gives a slightly higher result when you reinvest.',
              'Tax is a flat rate on each dividend. Tax on selling, fees and inflation are not included.',
            ]}
          />
        </div>
      }
    />
  )
}
