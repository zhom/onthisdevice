import { useMemo, useState } from 'react'

import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/components/tools/finance/format'

import { LineChart, compactMoney } from './charts'
import {
  Assumptions,
  CsvButton,
  CurrencySelect,
  DataTable,
  Field,
  FieldGroup,
  Formula,
  MiniStat,
  Segmented,
  useMoney,
} from './common'
import type { Column } from './common'
import { useLocalStorage } from './hooks'
import { csvMoney, d, toNum, toPositive } from './money'
import { CPI_MAX_YEAR, CPI_MIN_YEAR, CPI_PROVISIONAL_FROM, CPI_U, cpiYoY } from './cpi'

type Mode = 'cpi' | 'rate'

interface CpiRow {
  year: number
  cpi: number
  yoy: number | undefined
  value: number
}

interface RateRow {
  /** Years from now. */
  year: number
  index: number
  cost: number
  power: number
}

export default function InflationCalculator() {
  const [currency, setCurrency] = useLocalStorage('otd:finance:currency', 'USD')
  const money = useMoney(currency)

  const [mode, setMode] = useState<Mode>('cpi')
  const [amount, setAmount] = useState('1000')
  const [fromYear, setFromYear] = useState('1990')
  const [toYear, setToYear] = useState(String(CPI_MAX_YEAR))
  const [customRate, setCustomRate] = useState('3')
  const [customYears, setCustomYears] = useState('20')

  const calc = useMemo(() => {
    const amt = toNum(amount)
    const from = Math.round(toPositive(fromYear, 1990))
    const to = Math.round(toPositive(toYear, CPI_MAX_YEAR))
    const cpiFrom = CPI_U[from]
    const cpiTo = CPI_U[to]

    const outOfRange =
      cpiFrom === undefined || cpiTo === undefined
        ? `The CPI-U series runs from ${CPI_MIN_YEAR} to ${CPI_MAX_YEAR}. Pick two years inside that range, or switch to custom rate mode.`
        : undefined

    const ratio = cpiFrom && cpiTo ? d(cpiTo).div(cpiFrom) : d(1)
    const equivalent = d(amt).times(ratio).toNumber()
    const cumulative = ratio.minus(1).times(100).toNumber()
    const span = to - from
    const annualised =
      span !== 0 && cpiFrom && cpiTo
        ? (Math.pow(cpiTo / cpiFrom, 1 / Math.abs(span)) - 1) * 100 * (span > 0 ? 1 : -1)
        : 0
    const purchasingPower = ratio.isZero() ? 0 : d(amt).div(ratio).toNumber()

    const lo = Math.min(from, to)
    const hi = Math.max(from, to)
    const rows: CpiRow[] = []
    if (!outOfRange) {
      for (let y = lo; y <= hi; y++) {
        const cpi = CPI_U[y]
        if (cpi === undefined) continue
        rows.push({
          year: y,
          cpi,
          yoy: cpiYoY(y),
          value: d(amt).times(cpi).div(cpiFrom ?? 1).toNumber(),
        })
      }
    }

    // Custom-rate mode
    const rate = toNum(customRate) / 100
    const nYears = Math.max(0, Math.min(150, Math.round(toPositive(customYears, 20))))
    const futureCost = d(amt).times(d(1).plus(rate).pow(nYears)).toNumber()
    const futurePower = d(1).plus(rate).pow(nYears).isZero()
      ? 0
      : d(amt).div(d(1).plus(rate).pow(nYears)).toNumber()
    const customRows: RateRow[] = []
    for (let y = 0; y <= nYears; y++) {
      const factor = d(1).plus(rate).pow(y)
      customRows.push({
        year: y,
        index: factor.times(100).toNumber(),
        cost: d(amt).times(factor).toNumber(),
        power: factor.isZero() ? 0 : d(amt).div(factor).toNumber(),
      })
    }

    return {
      amt,
      from,
      to,
      cpiFrom,
      cpiTo,
      outOfRange,
      equivalent,
      cumulative,
      annualised,
      purchasingPower,
      span,
      rows,
      rate,
      nYears,
      futureCost,
      futurePower,
      customRows,
      provisional: Math.max(from, to) >= CPI_PROVISIONAL_FROM,
    }
  }, [amount, fromYear, toYear, customRate, customYears])

  const cpiColumns: Column<CpiRow>[] = [
    { key: 'year', header: 'Year', render: (r) => r.year },
    { key: 'cpi', header: 'CPI-U', align: 'right', render: (r) => formatNumber(r.cpi, 3) },
    {
      key: 'yoy',
      header: 'Inflation',
      align: 'right',
      render: (r) =>
        r.yoy === undefined ? (
          '–'
        ) : (
          <span className={r.yoy >= 0 ? undefined : 'text-success'}>
            {r.yoy >= 0 ? '+' : '−'}
            {formatNumber(Math.abs(r.yoy), 2)}%
          </span>
        ),
    },
    {
      key: 'value',
      header: `Value of ${money.round(calc.amt)}`,
      align: 'right',
      render: (r) => money.exact(r.value),
    },
  ]

  const rateColumns: Column<RateRow>[] = [
    { key: 'year', header: 'Year', render: (r) => (r.year === 0 ? 'Today' : `+${r.year}`) },
    { key: 'index', header: 'Price index', align: 'right', render: (r) => formatNumber(r.index, 2) },
    { key: 'cost', header: 'Same basket costs', align: 'right', render: (r) => money.exact(r.cost) },
    {
      key: 'power',
      header: `Buying power of ${money.round(calc.amt)}`,
      align: 'right',
      hideOnMobile: true,
      render: (r) => money.exact(r.power),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ToolPanel
          title="Compare purchasing power"
          description="Uses the official CPI-U annual averages published by the US Bureau of Labor Statistics. The data is in the page, so nothing is fetched."
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Method
              </span>
              <Segmented
                label="Calculation method"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'cpi', label: 'US CPI data' },
                  { value: 'rate', label: 'Custom rate' },
                ]}
              />
            </div>

            <FieldGroup columns={2}>
              <Field
                id="inf-amount"
                label="Amount"
                value={amount}
                onChange={setAmount}
                prefix={money.symbol}
              />
              <CurrencySelect value={currency} onChange={setCurrency} id="inf-currency" />
            </FieldGroup>

            {mode === 'cpi' ? (
              <FieldGroup columns={2}>
                <Field
                  id="inf-from"
                  label="In the year"
                  value={fromYear}
                  onChange={setFromYear}
                  hint={calc.cpiFrom !== undefined ? `CPI ${formatNumber(calc.cpiFrom, 3)}` : 'out of range'}
                  slider={{ min: CPI_MIN_YEAR, max: CPI_MAX_YEAR, step: 1 }}
                />
                <Field
                  id="inf-to"
                  label="Is worth, in"
                  value={toYear}
                  onChange={setToYear}
                  hint={calc.cpiTo !== undefined ? `CPI ${formatNumber(calc.cpiTo, 3)}` : 'out of range'}
                  slider={{ min: CPI_MIN_YEAR, max: CPI_MAX_YEAR, step: 1 }}
                />
              </FieldGroup>
            ) : (
              <FieldGroup columns={2}>
                <Field
                  id="inf-rate"
                  label="Annual inflation rate"
                  value={customRate}
                  onChange={setCustomRate}
                  suffix="%"
                  slider={{ min: -5, max: 20, step: 0.1 }}
                />
                <Field
                  id="inf-years"
                  label="Number of years"
                  value={customYears}
                  onChange={setCustomYears}
                  suffix="yrs"
                  slider={{ min: 1, max: 60, step: 1 }}
                />
              </FieldGroup>
            )}
          </div>
        </ToolPanel>

        <div className="space-y-6">
          {mode === 'cpi' && calc.outOfRange ? <ErrorNote message={calc.outOfRange} /> : null}

          {mode === 'cpi' ? (
            <ToolPanel title="Result">
              <div className="space-y-5">
                <ResultStat
                  label={`${money.exact(calc.amt)} in ${calc.from} is worth`}
                  value={money.exact(calc.equivalent)}
                  hint={`in ${calc.to}, for the same basket of goods`}
                  emphasis
                />
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat
                    label="Cumulative inflation"
                    value={`${calc.cumulative >= 0 ? '+' : '−'}${formatNumber(
                      Math.abs(calc.cumulative),
                      2,
                    )}%`}
                    hint={`over ${Math.abs(calc.span)} years`}
                  />
                  <MiniStat
                    label="Average per year"
                    value={`${formatNumber(calc.annualised, 2)}%`}
                    hint="compound annual rate"
                  />
                  <MiniStat
                    label={`Buying power in ${calc.from}`}
                    value={money.exact(calc.purchasingPower)}
                    hint={`of ${money.exact(calc.amt)} in ${calc.to}`}
                  />
                  <MiniStat
                    label="Prices multiplied by"
                    value={`${formatNumber(
                      calc.cpiFrom && calc.cpiTo ? calc.cpiTo / calc.cpiFrom : 1,
                      3,
                    )}×`}
                  />
                </div>
                {calc.provisional ? (
                  <p className="text-xs text-muted-foreground">
                    The {CPI_PROVISIONAL_FROM} annual average is provisional and may be revised by the BLS.
                  </p>
                ) : null}
              </div>
            </ToolPanel>
          ) : (
            <ToolPanel title="Result">
              <div className="space-y-5">
                <ResultStat
                  label={`What ${money.exact(calc.amt)} of goods will cost in ${calc.nYears} years`}
                  value={money.exact(calc.futureCost)}
                  hint={`at ${formatNumber(calc.rate * 100, 2)}% inflation a year`}
                  emphasis
                />
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat
                    label={`Buying power of ${money.round(calc.amt)}`}
                    value={money.exact(calc.futurePower)}
                    hint={`in ${calc.nYears} years, in today’s money`}
                  />
                  <MiniStat
                    label="Cumulative inflation"
                    value={`${formatNumber((Math.pow(1 + calc.rate, calc.nYears) - 1) * 100, 2)}%`}
                  />
                  <MiniStat
                    label="Value lost"
                    value={money.exact(calc.amt - calc.futurePower)}
                    tone="negative"
                  />
                  <MiniStat
                    label="Prices multiplied by"
                    value={`${formatNumber(Math.pow(1 + calc.rate, calc.nYears), 3)}×`}
                  />
                </div>
              </div>
            </ToolPanel>
          )}
        </div>
      </div>

      <ToolPanel
        title={mode === 'cpi' ? 'The amount, tracked year by year' : 'Prices at your chosen rate'}
      >
        <LineChart
          ariaLabel="Equivalent value of the amount over time"
          series={[
            {
              label: 'Equivalent value',
              token: 'chart-1',
              fill: true,
              points:
                mode === 'cpi'
                  ? calc.rows.map((r) => ({ x: r.year, y: r.value }))
                  : calc.customRows.map((r) => ({ x: r.year, y: r.cost })),
            },
          ]}
          xLabel={(x) => (mode === 'cpi' ? String(Math.round(x)) : `+${Math.round(x)}y`)}
          yFormat={(v) => compactMoney(v, currency)}
          legend={[
            {
              label: mode === 'cpi' ? `Value of ${money.round(calc.amt)} from ${calc.from}` : 'Cost of the same basket',
              token: 'chart-1',
              value: money.round(mode === 'cpi' ? calc.equivalent : calc.futureCost),
            },
          ]}
          caption={
            mode === 'cpi'
              ? 'Each point is the CPI-U annual average for that year, rebased to your starting year.'
              : 'A constant rate compounds, so the curve steepens even though the rate never changes.'
          }
        />
      </ToolPanel>

      <Formula
        items={
          mode === 'cpi'
            ? [
                {
                  label: 'Equivalent value',
                  general: 'Value = amount × CPI(to) / CPI(from)',
                  steps: [
                    `Value = ${formatNumber(calc.amt, 2)} × ${formatNumber(
                      calc.cpiTo ?? 0,
                      3,
                    )} ÷ ${formatNumber(calc.cpiFrom ?? 0, 3)}`,
                  ],
                  result: money.exact(calc.equivalent),
                },
                {
                  label: 'Cumulative inflation',
                  general: 'Inflation = (CPI(to) / CPI(from) − 1) × 100',
                  steps: [
                    `Inflation = (${formatNumber(calc.cpiTo ?? 0, 3)} ÷ ${formatNumber(
                      calc.cpiFrom ?? 0,
                      3,
                    )} − 1) × 100`,
                  ],
                  result: `${formatNumber(calc.cumulative, 3)}%`,
                },
                {
                  label: 'Average annual inflation',
                  general: 'Rate = (CPI(to) / CPI(from))^(1/years) − 1',
                  steps: [
                    `Rate = (${formatNumber(calc.cpiTo ?? 0, 3)} ÷ ${formatNumber(
                      calc.cpiFrom ?? 0,
                      3,
                    )})^(1 ÷ ${Math.abs(calc.span)}) − 1`,
                  ],
                  result: `${formatNumber(calc.annualised, 3)}% per year`,
                },
              ]
            : [
                {
                  label: 'Future cost of the same goods',
                  general: 'Cost = amount × (1 + rate)^years',
                  steps: [
                    `Cost = ${formatNumber(calc.amt, 2)} × (1 + ${formatNumber(calc.rate, 4)})^${
                      calc.nYears
                    }`,
                  ],
                  result: money.exact(calc.futureCost),
                },
                {
                  label: 'Future buying power of the amount',
                  general: 'Power = amount / (1 + rate)^years',
                  steps: [
                    `Power = ${formatNumber(calc.amt, 2)} ÷ (1 + ${formatNumber(calc.rate, 4)})^${
                      calc.nYears
                    }`,
                  ],
                  result: money.exact(calc.futurePower),
                },
              ]
        }
        note="CPI-U is the Consumer Price Index for All Urban Consumers, US city average, all items, index base 1982-84 = 100. Annual figures are the average of the twelve monthly index values."
      />

      <ToolPanel title={mode === 'cpi' ? 'CPI-U year by year' : 'Year by year at your rate'}>
        {mode === 'cpi' ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <CsvButton
                filename={`cpi-${calc.from}-${calc.to}.csv`}
                headers={['Year', 'CPI-U', 'Inflation %', 'Equivalent value']}
                rows={calc.rows.map((r) => [
                  r.year,
                  r.cpi.toFixed(3),
                  r.yoy === undefined ? '' : r.yoy.toFixed(3),
                  csvMoney(r.value),
                ])}
              />
            </div>
            <DataTable
              columns={cpiColumns}
              rows={calc.rows}
              pageSize={12}
              ariaLabel="CPI-U by year"
              emptyMessage="Choose two years inside the CPI range."
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <CsvButton
                filename="inflation-projection.csv"
                headers={['Years from now', 'Price index', 'Cost of the same basket', 'Buying power']}
                rows={calc.customRows.map((r) => [
                  r.year,
                  r.index.toFixed(2),
                  csvMoney(r.cost),
                  csvMoney(r.power),
                ])}
              />
            </div>
            <DataTable
              columns={rateColumns}
              rows={calc.customRows}
              pageSize={12}
              ariaLabel="Projected prices by year"
              emptyMessage="Enter a rate and a number of years."
            />
          </div>
        )}
      </ToolPanel>

      <Assumptions
        items={[
          'CPI-U measures a fixed basket of goods and services bought by urban US consumers. Your own inflation rate depends on what you buy. Housing, tuition and healthcare have risen much faster than the average.',
          'Annual averages are used, so a comparison between two years is really a comparison between two twelve-month averages, not two specific dates.',
          'The index is not adjusted for changes in quality or substitution between goods beyond the BLS methodology already applied.',
          'Figures for other countries will differ. Use custom rate mode with your own national inflation figure outside the US.',
          'Source: U.S. Bureau of Labor Statistics, CPI-U, US city average, all items, 1982-84 = 100.',
        ]}
      />
    </div>
  )
}
