import { useMemo, useState } from 'react'

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
  useMoney,
} from './common'
import type { Column } from './common'
import { useLocalStorage } from './hooks'
import { csvMoney, d, toPositive } from './money'

interface RetireYear {
  age: number
  yearIndex: number
  startBalance: number
  contributions: number
  growth: number
  endBalance: number
  realEndBalance: number
}

export default function RetirementCalculator() {
  const [currency, setCurrency] = useLocalStorage('otd:finance:currency', 'USD')
  const money = useMoney(currency)

  const [currentAge, setCurrentAge] = useState('35')
  const [retireAge, setRetireAge] = useState('65')
  const [currentSavings, setCurrentSavings] = useState('75000')
  const [monthly, setMonthly] = useState('800')
  const [increase, setIncrease] = useState('2')
  const [returnPct, setReturnPct] = useState('7')
  const [inflationPct, setInflationPct] = useState('2.5')
  const [withdrawalPct, setWithdrawalPct] = useState('4')

  const calc = useMemo(() => {
    const age0 = Math.max(0, Math.min(100, Math.round(toPositive(currentAge, 35))))
    const age1 = Math.max(0, Math.min(110, Math.round(toPositive(retireAge, 65))))
    const yearsToRetire = age1 - age0
    const P = toPositive(currentSavings)
    const pmt0 = toPositive(monthly)
    const step = toPositive(increase) / 100
    const r = toPositive(returnPct) / 100
    const inf = toPositive(inflationPct) / 100
    const wr = toPositive(withdrawalPct) / 100

    const error =
      yearsToRetire <= 0
        ? 'Your retirement age needs to be later than your current age.'
        : yearsToRetire > 80
          ? 'That is more than 80 years away. Narrow the age range for a useful projection.'
          : undefined

    const years = Math.max(0, Math.min(80, yearsToRetire))
    const i = d(r).div(12)

    let balance = d(P)
    let totalContrib = d(0)
    let totalGrowth = d(0)
    const rows: RetireYear[] = []

    for (let y = 1; y <= years; y++) {
      const start = balance
      const monthlyThisYear = d(pmt0).times(d(1).plus(step).pow(y - 1))
      let yearContrib = d(0)
      let yearGrowth = d(0)
      for (let m = 0; m < 12; m++) {
        const growth = balance.times(i)
        balance = balance.plus(growth).plus(monthlyThisYear)
        yearGrowth = yearGrowth.plus(growth)
        yearContrib = yearContrib.plus(monthlyThisYear)
      }
      totalContrib = totalContrib.plus(yearContrib)
      totalGrowth = totalGrowth.plus(yearGrowth)
      const deflator = d(1).plus(inf).pow(y)
      rows.push({
        age: age0 + y,
        yearIndex: y,
        startBalance: start.toNumber(),
        contributions: yearContrib.toNumber(),
        growth: yearGrowth.toNumber(),
        endBalance: balance.toNumber(),
        realEndBalance: balance.div(deflator).toNumber(),
      })
    }

    const nominal = balance.toNumber()
    const deflator = d(1).plus(inf).pow(years)
    const real = balance.div(deflator).toNumber()
    const realReturn = inf !== -1 ? (1 + r) / (1 + inf) - 1 : r

    const annualWithdrawal = nominal * wr
    const monthlyWithdrawal = annualWithdrawal / 12
    const realAnnualWithdrawal = real * wr
    const realMonthlyWithdrawal = realAnnualWithdrawal / 12

    return {
      age0,
      age1,
      years,
      P,
      pmt0,
      step,
      r,
      inf,
      wr,
      i: i.toNumber(),
      rows,
      nominal,
      real,
      realReturn,
      totalContrib: totalContrib.toNumber(),
      totalGrowth: totalGrowth.toNumber(),
      annualWithdrawal,
      monthlyWithdrawal,
      realAnnualWithdrawal,
      realMonthlyWithdrawal,
      error,
      deflator: deflator.toNumber(),
    }
  }, [currentAge, retireAge, currentSavings, monthly, increase, returnPct, inflationPct, withdrawalPct])

  const columns: Column<RetireYear>[] = [
    { key: 'age', header: 'Age', render: (r) => r.age },
    { key: 'start', header: 'Start balance', align: 'right', hideOnMobile: true, render: (r) => money.exact(r.startBalance) },
    { key: 'contrib', header: 'Contributions', align: 'right', render: (r) => money.exact(r.contributions) },
    { key: 'growth', header: 'Investment growth', align: 'right', render: (r) => money.exact(r.growth) },
    { key: 'end', header: 'Balance', align: 'right', render: (r) => money.exact(r.endBalance) },
    {
      key: 'real',
      header: 'In today’s money',
      align: 'right',
      render: (r) => money.exact(r.realEndBalance),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ToolPanel
          title="Where you are now"
          description="Two numbers matter more than the rest: how long you have, and how much goes in each month."
        >
          <div className="space-y-5">
            <FieldGroup columns={2}>
              <Field
                id="ret-age"
                label="Current age"
                value={currentAge}
                onChange={setCurrentAge}
                suffix="yrs"
                slider={{ min: 16, max: 80, step: 1 }}
              />
              <Field
                id="ret-retire-age"
                label="Retirement age"
                value={retireAge}
                onChange={setRetireAge}
                suffix="yrs"
                slider={{ min: 40, max: 85, step: 1 }}
              />
              <Field
                id="ret-savings"
                label="Current retirement savings"
                value={currentSavings}
                onChange={setCurrentSavings}
                prefix={money.symbol}
              />
              <CurrencySelect value={currency} onChange={setCurrency} id="ret-currency" />
              <Field
                id="ret-monthly"
                label="Monthly contribution"
                value={monthly}
                onChange={setMonthly}
                prefix={money.symbol}
                hint={`${money.round(calc.pmt0 * 12)} / year`}
              />
              <Field
                id="ret-increase"
                label="Yearly contribution increase"
                value={increase}
                onChange={setIncrease}
                suffix="%"
                hint="pay rises"
                slider={{ min: 0, max: 10, step: 0.5 }}
              />
              <Field
                id="ret-return"
                label="Expected annual return"
                value={returnPct}
                onChange={setReturnPct}
                suffix="%"
                slider={{ min: 0, max: 15, step: 0.1 }}
              />
              <Field
                id="ret-inflation"
                label="Expected inflation"
                value={inflationPct}
                onChange={setInflationPct}
                suffix="%"
                slider={{ min: 0, max: 10, step: 0.1 }}
              />
              <Field
                id="ret-withdrawal"
                label="Withdrawal rate"
                value={withdrawalPct}
                onChange={setWithdrawalPct}
                suffix="%"
                hint="the 4% rule"
                slider={{ min: 2, max: 8, step: 0.1 }}
              />
            </FieldGroup>
          </div>
        </ToolPanel>

        <div className="space-y-6">
          {calc.error ? <ErrorNote message={calc.error} /> : null}

          <ToolPanel title={`Your nest egg at ${calc.age1}`}>
            <div className="space-y-5">
              <ResultStat
                label={`Projected balance at age ${calc.age1}`}
                value={money.exact(calc.nominal)}
                hint={`${money.exact(calc.real)} in today’s money after ${formatNumber(
                  calc.inf * 100,
                  1,
                )}% inflation`}
                emphasis
              />
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="You contribute" value={money.exact(calc.totalContrib)} hint={`over ${calc.years} years`} />
                <MiniStat label="Investment growth" value={money.exact(calc.totalGrowth)} tone="positive" />
                <MiniStat
                  label="Real annual return"
                  value={`${formatNumber(calc.realReturn * 100, 2)}%`}
                  hint="return above inflation"
                />
                <MiniStat
                  label="Inflation drag"
                  value={money.exact(calc.nominal - calc.real)}
                  hint={`prices ×${formatNumber(calc.deflator, 2)}`}
                  tone="negative"
                />
              </div>
              <Breakdown
                currency={currency}
                caption="Where the nest egg comes from."
                items={[
                  { label: 'Savings you already have', value: calc.P, token: 'chart-3' },
                  { label: 'Future contributions', value: calc.totalContrib, token: 'chart-1' },
                  { label: 'Investment growth', value: calc.totalGrowth, token: 'chart-5' },
                ]}
              />
            </div>
          </ToolPanel>

          <ToolPanel
            title={`Sustainable income at ${formatNumber(calc.wr * 100, 1)}%`}
            description="The classic rule of thumb: withdraw 4% of the balance in year one, then adjust that amount for inflation each year."
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Annual withdrawal" value={money.exact(calc.annualWithdrawal)} />
              <MiniStat label="Monthly withdrawal" value={money.exact(calc.monthlyWithdrawal)} />
              <MiniStat
                label="Annual, in today’s money"
                value={money.exact(calc.realAnnualWithdrawal)}
                hint="what it would buy now"
              />
              <MiniStat
                label="Monthly, in today’s money"
                value={money.exact(calc.realMonthlyWithdrawal)}
              />
            </div>
          </ToolPanel>
        </div>
      </div>

      <ToolPanel
        title="Projection by age"
        description="The solid line is the balance you would see on a statement; the dashed line is what it would actually buy in today’s money."
      >
        <LineChart
          ariaLabel="Projected retirement balance in nominal and real terms by age"
          series={[
            {
              label: 'Nominal',
              token: 'chart-1',
              fill: true,
              points: [{ x: calc.age0, y: calc.P }, ...calc.rows.map((r) => ({ x: r.age, y: r.endBalance }))],
            },
            {
              label: 'Real',
              token: 'chart-3',
              dashed: true,
              points: [
                { x: calc.age0, y: calc.P },
                ...calc.rows.map((r) => ({ x: r.age, y: r.realEndBalance })),
              ],
            },
          ]}
          xLabel={(x) => `${Math.round(x)}`}
          yFormat={(v) => compactMoney(v, currency)}
          legend={[
            { label: 'Balance (nominal)', token: 'chart-1', value: money.round(calc.nominal) },
            { label: 'Balance (today’s money)', token: 'chart-3', value: money.round(calc.real), dashed: true },
          ]}
          caption="Horizontal axis is your age."
        />
      </ToolPanel>

      <Formula
        items={[
          {
            label: 'Growth of what you already have',
            general: 'FV₀ = P × (1 + r/12)^(12·t)',
            steps: [
              `FV₀ = ${formatNumber(calc.P, 2)} × (1 + ${calc.i.toFixed(8)})^${calc.years * 12}`,
            ],
            result: money.exact(calc.P * Math.pow(1 + calc.i, calc.years * 12)),
          },
          {
            label: 'Growth of your contributions',
            general:
              calc.step > 0
                ? 'Each year’s contribution rises by the increase rate, then compounds monthly to retirement'
                : 'FVₚ = PMT × [((1 + r/12)^(12·t) − 1) / (r/12)]',
            steps: [
              `PMT = ${formatNumber(calc.pmt0, 2)} / month${
                calc.step > 0 ? `, rising ${formatNumber(calc.step * 100, 2)}% a year` : ''
              }`,
              `${calc.years * 12} monthly contributions at ${calc.i.toFixed(8)} per month`,
              `contributions ${money.exact(calc.totalContrib)} + growth on them ${money.exact(
                calc.totalGrowth - (calc.P * Math.pow(1 + calc.i, calc.years * 12) - calc.P),
              )}`,
            ],
            result: money.exact(calc.nominal - calc.P * Math.pow(1 + calc.i, calc.years * 12)),
          },
          {
            label: 'Nest egg in today’s money',
            general: 'Real = Nominal / (1 + inflation)^t',
            steps: [
              `Real = ${formatNumber(calc.nominal, 2)} ÷ (1 + ${formatNumber(calc.inf, 4)})^${calc.years}`,
            ],
            result: money.exact(calc.real),
          },
          {
            label: 'Sustainable withdrawal',
            general: 'Income = Nest egg × withdrawal rate',
            steps: [
              `Income = ${formatNumber(calc.nominal, 2)} × ${formatNumber(calc.wr * 100, 2)}%`,
            ],
            result: `${money.exact(calc.annualWithdrawal)} / year`,
          },
        ]}
        note="Contributions are made monthly at the end of each month and the return is applied monthly at one twelfth of the annual rate."
      />

      <ToolPanel title="Year-by-year projection">
        <div className="space-y-4">
          <div className="flex justify-end">
            <CsvButton
              filename="retirement-projection.csv"
              headers={[
                'Age',
                'Year',
                'Start balance',
                'Contributions',
                'Investment growth',
                'End balance',
                'End balance (today’s money)',
              ]}
              rows={calc.rows.map((r) => [
                r.age,
                r.yearIndex,
                csvMoney(r.startBalance),
                csvMoney(r.contributions),
                csvMoney(r.growth),
                csvMoney(r.endBalance),
                csvMoney(r.realEndBalance),
              ])}
            />
          </div>
          <DataTable
            columns={columns}
            rows={calc.rows}
            pageSize={12}
            ariaLabel="Retirement projection by age"
            emptyMessage="Set a retirement age later than your current age to build the projection."
          />
        </div>
      </ToolPanel>

      <Assumptions
        items={[
          'A constant average annual return, applied monthly. Real markets deliver that average through large up and down years, and the order those years arrive in matters a great deal near retirement.',
          'Contributions continue uninterrupted until the retirement age you set, rising by the increase rate every year.',
          'Employer matching, tax relief, contribution caps and investment fees are not modelled. To approximate fees, subtract your fund fees from the expected return.',
          'The withdrawal rate is a planning rule of thumb from studies of historical US portfolios, not a guarantee. It says nothing about your specific portfolio or lifespan.',
          'State or workplace pensions, social security and other income are excluded.',
        ]}
      />
    </div>
  )
}
