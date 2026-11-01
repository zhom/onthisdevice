import { useEffect, useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/components/tools/finance/format'

import { LineChart, compactMoney } from './charts'
import {
  Assumptions,
  Breakdown,
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
import { useLocalStorage, useToday } from './hooks'
import { csvMoney, d, formatMonths, toNum, toPositive } from './money'

type PeriodMode = 'duration' | 'dates'

interface ValueRow {
  year: number
  investment: number
  benchmark: number
  difference: number
}

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export default function RoiCalculator() {
  const today = useToday()
  const [currency, setCurrency] = useLocalStorage('otd:finance:currency', 'USD')
  const money = useMoney(currency)

  const [initial, setInitial] = useState('10000')
  const [costs, setCosts] = useState('250')
  const [finalValue, setFinalValue] = useState('16500')
  const [income, setIncome] = useState('900')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('duration')
  const [years, setYears] = useState('4')
  const [months, setMonths] = useState('0')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [benchmark, setBenchmark] = useState('7')

  useEffect(() => {
    const end = today
    const start = new Date(end.getFullYear() - 4, end.getMonth(), end.getDate())
    setStartDate(dateValue(start))
    setEndDate(dateValue(end))
  }, [today])

  const calc = useMemo(() => {
    const invested = toPositive(initial)
    const extraCosts = toPositive(costs)
    const exit = toNum(finalValue)
    const cashIncome = toNum(income)
    const benchPct = toNum(benchmark) / 100

    let holdingYears = 0
    let dateError: string | undefined
    if (periodMode === 'duration') {
      holdingYears = toPositive(years) + toPositive(months) / 12
    } else {
      const s = new Date(startDate)
      const e = new Date(endDate)
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
        dateError = 'Enter a valid start and end date.'
      } else if (e <= s) {
        dateError = 'The end date has to be after the start date.'
      } else {
        holdingYears = (e.getTime() - s.getTime()) / (365.2425 * 24 * 3600 * 1000)
      }
    }

    const totalCost = invested + extraCosts
    const totalReturn = exit + cashIncome
    const netProfit = d(totalReturn).minus(totalCost).toNumber()
    const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0
    const multiple = totalCost > 0 ? totalReturn / totalCost : 0

    // CAGR = (end / start)^(1/years) − 1; a total loss (nothing back) is −100%.
    const annualised =
      totalCost > 0 && holdingYears > 0
        ? (Math.pow(Math.max(0, totalReturn) / totalCost, 1 / holdingYears) - 1) * 100
        : 0

    const benchmarkValue = totalCost * Math.pow(1 + benchPct, holdingYears)
    const vsBenchmark = totalReturn - benchmarkValue

    const wholeYears = Math.max(1, Math.min(60, Math.ceil(holdingYears)))
    const rows: ValueRow[] = []
    for (let y = 1; y <= wholeYears; y++) {
      const t = Math.min(y, holdingYears)
      const inv = totalCost * Math.pow(1 + annualised / 100, t)
      const bench = totalCost * Math.pow(1 + benchPct, t)
      rows.push({ year: y, investment: inv, benchmark: bench, difference: inv - bench })
    }

    const error =
      dateError ??
      (invested <= 0 ? 'Enter the amount you invested.' : undefined) ??
      (holdingYears <= 0 ? 'Enter a holding period longer than zero.' : undefined)

    return {
      invested,
      extraCosts,
      exit,
      cashIncome,
      totalCost,
      totalReturn,
      netProfit,
      roi,
      multiple,
      annualised,
      holdingYears,
      benchPct,
      benchmarkValue,
      vsBenchmark,
      rows,
      error,
    }
  }, [initial, costs, finalValue, income, periodMode, years, months, startDate, endDate, benchmark])

  const columns: Column<ValueRow>[] = [
    { key: 'year', header: 'Year', render: (r) => r.year },
    {
      key: 'investment',
      header: 'Your investment',
      align: 'right',
      render: (r) => money.exact(r.investment),
    },
    { key: 'benchmark', header: 'Benchmark', align: 'right', render: (r) => money.exact(r.benchmark) },
    {
      key: 'difference',
      header: 'Difference',
      align: 'right',
      render: (r) => (
        <span className={r.difference >= 0 ? 'text-success' : 'text-destructive'}>
          {r.difference >= 0 ? '+' : '−'}
          {money.exact(Math.abs(r.difference))}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ToolPanel
          title="The investment"
          description="For shares, property, a marketing campaign or anything else with money in, money out and a holding period."
        >
          <div className="space-y-5">
            <FieldGroup columns={2}>
              <Field
                id="roi-initial"
                label="Amount invested"
                value={initial}
                onChange={setInitial}
                prefix={money.symbol}
              />
              <CurrencySelect value={currency} onChange={setCurrency} id="roi-currency" />
              <Field
                id="roi-costs"
                label="Additional costs"
                value={costs}
                onChange={setCosts}
                prefix={money.symbol}
                hint="fees, commission, repairs"
              />
              <Field
                id="roi-final"
                label="Final value"
                value={finalValue}
                onChange={setFinalValue}
                prefix={money.symbol}
                hint="what it sold for, or is worth"
              />
              <Field
                id="roi-income"
                label="Income received"
                value={income}
                onChange={setIncome}
                prefix={money.symbol}
                hint="dividends, rent, interest"
              />
              <Field
                id="roi-benchmark"
                label="Benchmark return"
                value={benchmark}
                onChange={setBenchmark}
                suffix="% / yr"
                hint="what else you could have done"
                slider={{ min: 0, max: 20, step: 0.25 }}
              />
            </FieldGroup>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Holding period
                </span>
                <Segmented
                  label="Holding period entry mode"
                  value={periodMode}
                  onChange={setPeriodMode}
                  options={[
                    { value: 'duration', label: 'Duration' },
                    { value: 'dates', label: 'Dates' },
                  ]}
                />
              </div>
              {periodMode === 'duration' ? (
                <FieldGroup columns={2}>
                  <Field
                    id="roi-years"
                    label="Years held"
                    value={years}
                    onChange={setYears}
                    suffix="yrs"
                    slider={{ min: 0, max: 40, step: 1 }}
                  />
                  <Field
                    id="roi-months"
                    label="Extra months"
                    value={months}
                    onChange={setMonths}
                    suffix="mo"
                  />
                </FieldGroup>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="roi-start" className="text-sm">
                      Bought on
                    </Label>
                    <Input
                      id="roi-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="roi-end" className="text-sm">
                      Sold on
                    </Label>
                    <Input
                      id="roi-end"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="tabular-nums"
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Held for {formatNumber(calc.holdingYears, 2)} years
                {calc.holdingYears > 0 ? ` · ${formatMonths(calc.holdingYears * 12)}` : ''}.
              </p>
            </div>
          </div>
        </ToolPanel>

        <div className="space-y-6">
          {calc.error ? <ErrorNote message={calc.error} /> : null}

          <ToolPanel title="Return">
            <div className="space-y-5">
              <ResultStat
                label="Return on investment"
                value={`${calc.roi >= 0 ? '' : '−'}${formatNumber(Math.abs(calc.roi), 2)}%`}
                hint={`${calc.netProfit >= 0 ? 'profit' : 'loss'} of ${money.exact(
                  Math.abs(calc.netProfit),
                )} on ${money.exact(calc.totalCost)}`}
                emphasis
              />
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label="Net profit"
                  value={money.exact(calc.netProfit)}
                  tone={calc.netProfit >= 0 ? 'positive' : 'negative'}
                />
                <MiniStat
                  label="Annualised ROI"
                  value={`${formatNumber(calc.annualised, 2)}%`}
                  hint="compound annual growth rate"
                />
                <MiniStat label="Total in" value={money.exact(calc.totalCost)} hint="investment + costs" />
                <MiniStat
                  label="Total out"
                  value={money.exact(calc.totalReturn)}
                  hint={`${formatNumber(calc.multiple, 2)}× your money`}
                />
                <MiniStat
                  label={`Benchmark at ${formatNumber(calc.benchPct * 100, 2)}%`}
                  value={money.exact(calc.benchmarkValue)}
                />
                <MiniStat
                  label="Versus benchmark"
                  value={`${calc.vsBenchmark >= 0 ? '+' : '−'}${money.exact(Math.abs(calc.vsBenchmark))}`}
                  tone={calc.vsBenchmark >= 0 ? 'positive' : 'negative'}
                />
              </div>
              <Breakdown
                currency={currency}
                caption="Everything that went in, and everything that came out."
                items={[
                  { label: 'Amount invested', value: calc.invested, token: 'chart-1' },
                  { label: 'Additional costs', value: calc.extraCosts, token: 'chart-4' },
                  { label: 'Income received', value: Math.max(0, calc.cashIncome), token: 'chart-3' },
                  { label: 'Net profit', value: Math.max(0, calc.netProfit), token: 'chart-5' },
                ]}
              />
            </div>
          </ToolPanel>
        </div>
      </div>

      <ToolPanel
        title="Your return against the benchmark"
        description="Both lines start from the same total outlay and grow at their own compound rate."
      >
        <LineChart
          ariaLabel="Investment value against benchmark over the holding period"
          series={[
            {
              label: 'Your investment',
              token: 'chart-1',
              fill: true,
              points: [{ x: 0, y: calc.totalCost }, ...calc.rows.map((r) => ({ x: r.year, y: r.investment }))],
            },
            {
              label: 'Benchmark',
              token: 'chart-3',
              dashed: true,
              points: [{ x: 0, y: calc.totalCost }, ...calc.rows.map((r) => ({ x: r.year, y: r.benchmark }))],
            },
          ]}
          xLabel={(x) => `${Math.round(x)}y`}
          yFormat={(v) => compactMoney(v, currency)}
          legend={[
            {
              label: `Your investment (${formatNumber(calc.annualised, 2)}% / yr)`,
              token: 'chart-1',
              value: money.round(calc.totalReturn),
            },
            {
              label: `Benchmark (${formatNumber(calc.benchPct * 100, 2)}% / yr)`,
              token: 'chart-3',
              value: money.round(calc.benchmarkValue),
              dashed: true,
            },
          ]}
        />
      </ToolPanel>

      <Formula
        items={[
          {
            label: 'Net profit',
            general: 'Profit = (final value + income) − (invested + costs)',
            steps: [
              `Profit = (${formatNumber(calc.exit, 2)} + ${formatNumber(
                calc.cashIncome,
                2,
              )}) − (${formatNumber(calc.invested, 2)} + ${formatNumber(calc.extraCosts, 2)})`,
            ],
            result: money.exact(calc.netProfit),
          },
          {
            label: 'Return on investment',
            general: 'ROI = profit / total cost × 100',
            steps: [
              `ROI = ${formatNumber(calc.netProfit, 2)} ÷ ${formatNumber(calc.totalCost, 2)} × 100`,
            ],
            result: `${formatNumber(calc.roi, 3)}%`,
          },
          {
            label: 'Annualised ROI (CAGR)',
            general: 'CAGR = (end / start)^(1/t) − 1',
            steps: [
              `CAGR = (${formatNumber(calc.totalReturn, 2)} ÷ ${formatNumber(calc.totalCost, 2)})^(1 ÷ ${formatNumber(
                calc.holdingYears,
                4,
              )}) − 1`,
            ],
            result: `${formatNumber(calc.annualised, 3)}% per year`,
          },
          {
            label: 'Benchmark comparison',
            general: 'Benchmark = total cost × (1 + b)^t',
            steps: [
              `Benchmark = ${formatNumber(calc.totalCost, 2)} × (1 + ${formatNumber(
                calc.benchPct,
                4,
              )})^${formatNumber(calc.holdingYears, 4)}`,
            ],
            result: money.exact(calc.benchmarkValue),
          },
        ]}
        note="Annualised ROI answers a different question from plain ROI: it is the steady yearly rate that would turn the starting amount into the ending amount over the same period, which is what lets you compare a two-year deal with a ten-year one."
      />

      <ToolPanel title="Value year by year">
        <div className="space-y-4">
          <div className="flex justify-end">
            <CsvButton
              filename="roi-comparison.csv"
              headers={['Year', 'Your investment', 'Benchmark', 'Difference']}
              rows={calc.rows.map((r) => [
                r.year,
                csvMoney(r.investment),
                csvMoney(r.benchmark),
                csvMoney(r.difference),
              ])}
            />
          </div>
          <DataTable
            columns={columns}
            rows={calc.rows}
            pageSize={12}
            ariaLabel="Investment value against benchmark by year"
            emptyMessage="Enter an amount and a holding period."
          />
        </div>
      </ToolPanel>

      <Assumptions
        items={[
          'The whole investment is made up front and the whole proceeds are received at the end. Money added or taken out along the way needs an IRR calculation instead.',
          'Income (dividends, rent, interest) is counted at face value in the year it arrives and is not reinvested.',
          'Tax on gains and income is excluded. Apply your own rate to the net profit.',
          'Holding periods entered as dates use a 365.2425-day year, which accounts for leap years.',
        ]}
      />
    </div>
  )
}
