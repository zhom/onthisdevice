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
  SelectField,
  useMoney,
} from './common'
import type { Column } from './common'
import { useLocalStorage } from './hooks'
import { csvMoney, d, toPositive } from './money'

type SolveFor = 'interest' | 'principal' | 'rate' | 'time'
type TimeUnit = 'years' | 'months' | 'days'

const UNIT_YEARS: Record<TimeUnit, number> = { years: 1, months: 1 / 12, days: 1 / 365 }

interface Accrual {
  period: number
  label: string
  interest: number
  cumInterest: number
  balance: number
  compoundBalance: number
}

export default function SimpleInterestCalculator() {
  const [currency, setCurrency] = useLocalStorage('otd:finance:currency', 'USD')
  const money = useMoney(currency)

  const [solveFor, setSolveFor] = useState<SolveFor>('interest')
  const [principal, setPrincipal] = useState('10000')
  const [rate, setRate] = useState('5')
  const [time, setTime] = useState('3')
  const [unit, setUnit] = useState<TimeUnit>('years')
  const [interestInput, setInterestInput] = useState('1500')

  const calc = useMemo(() => {
    const P = toPositive(principal)
    const r = toPositive(rate) / 100
    const tYears = toPositive(time) * UNIT_YEARS[unit]
    const targetInterest = toPositive(interestInput)

    let solvedPrincipal = P
    let solvedRate = r
    let solvedYears = tYears
    let interest = 0
    let error: string | undefined

    if (solveFor === 'interest') {
      interest = d(P).times(r).times(tYears).toNumber()
    } else if (solveFor === 'principal') {
      if (r * tYears === 0) error = 'Enter a rate and a time period above zero to solve for principal.'
      else solvedPrincipal = d(targetInterest).div(d(r).times(tYears)).toNumber()
      interest = targetInterest
    } else if (solveFor === 'rate') {
      if (P * tYears === 0) error = 'Enter a principal and a time period above zero to solve for the rate.'
      else solvedRate = d(targetInterest).div(d(P).times(tYears)).toNumber()
      interest = targetInterest
    } else {
      if (P * r === 0) error = 'Enter a principal and a rate above zero to solve for time.'
      else solvedYears = d(targetInterest).div(d(P).times(r)).toNumber()
      interest = targetInterest
    }

    const total = d(solvedPrincipal).plus(interest).toNumber()
    const compoundTotal =
      solvedPrincipal > 0 && solvedYears > 0
        ? d(solvedPrincipal).times(d(1).plus(solvedRate).pow(solvedYears)).toNumber()
        : solvedPrincipal
    const compoundExtra = compoundTotal - total

    const wholeYears = Math.max(1, Math.min(80, Math.ceil(solvedYears)))
    const rows: Accrual[] = []
    let cum = 0
    for (let y = 1; y <= wholeYears; y++) {
      const span = Math.min(1, solvedYears - (y - 1))
      if (span <= 0) break
      const yearInterest = d(solvedPrincipal).times(solvedRate).times(span).toNumber()
      cum += yearInterest
      rows.push({
        period: y,
        label: `Year ${y}`,
        interest: yearInterest,
        cumInterest: cum,
        balance: solvedPrincipal + cum,
        compoundBalance: d(solvedPrincipal)
          .times(d(1).plus(solvedRate).pow(Math.min(y, solvedYears)))
          .toNumber(),
      })
    }

    return {
      P,
      solvedPrincipal,
      solvedRate,
      solvedYears,
      interest,
      total,
      compoundTotal,
      compoundExtra,
      rows,
      error,
      displayTime: solvedYears / UNIT_YEARS[unit],
    }
  }, [solveFor, principal, rate, time, unit, interestInput])

  const columns: Column<Accrual>[] = [
    { key: 'label', header: 'Period', render: (r) => r.label },
    { key: 'interest', header: 'Interest', align: 'right', render: (r) => money.exact(r.interest) },
    {
      key: 'cum',
      header: 'Interest to date',
      align: 'right',
      render: (r) => money.exact(r.cumInterest),
    },
    { key: 'balance', header: 'Balance (simple)', align: 'right', render: (r) => money.exact(r.balance) },
    {
      key: 'compound',
      header: 'Balance (compound)',
      align: 'right',
      hideOnMobile: true,
      render: (r) => money.exact(r.compoundBalance),
    },
  ]

  const heroLabel: Record<SolveFor, string> = {
    interest: 'Interest earned',
    principal: 'Principal required',
    rate: 'Rate required',
    time: 'Time required',
  }
  const heroValue: Record<SolveFor, string> = {
    interest: money.exact(calc.interest),
    principal: money.exact(calc.solvedPrincipal),
    rate: `${formatNumber(calc.solvedRate * 100, 3)}%`,
    time: `${formatNumber(calc.displayTime, 2)} ${unit}`,
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ToolPanel
          title="Inputs"
          description="Simple interest is charged on the original principal only. It never compounds."
        >
          <div className="space-y-5">
            <FieldGroup columns={2}>
              <SelectField
                id="si-solve"
                label="Solve for"
                value={solveFor}
                onChange={(v) => setSolveFor(v as SolveFor)}
                options={[
                  { value: 'interest', label: 'Interest amount' },
                  { value: 'principal', label: 'Principal' },
                  { value: 'rate', label: 'Interest rate' },
                  { value: 'time', label: 'Time' },
                ]}
              />
              <CurrencySelect value={currency} onChange={setCurrency} id="si-currency" />

              {solveFor !== 'principal' ? (
                <Field
                  id="si-principal"
                  label="Principal"
                  value={principal}
                  onChange={setPrincipal}
                  prefix={money.symbol}
                />
              ) : null}

              {solveFor !== 'rate' ? (
                <Field
                  id="si-rate"
                  label="Annual interest rate"
                  value={rate}
                  onChange={setRate}
                  suffix="%"
                  slider={{ min: 0, max: 25, step: 0.1 }}
                />
              ) : null}

              {solveFor !== 'time' ? (
                <Field
                  id="si-time"
                  label="Time"
                  value={time}
                  onChange={setTime}
                  suffix={unit === 'years' ? 'yrs' : unit === 'months' ? 'mo' : 'days'}
                />
              ) : null}

              <SelectField
                id="si-unit"
                label="Time unit"
                value={unit}
                onChange={(v) => setUnit(v as TimeUnit)}
                options={[
                  { value: 'years', label: 'Years' },
                  { value: 'months', label: 'Months' },
                  { value: 'days', label: 'Days (365-day year)' },
                ]}
              />

              {solveFor !== 'interest' ? (
                <Field
                  id="si-interest"
                  label="Interest amount"
                  value={interestInput}
                  onChange={setInterestInput}
                  prefix={money.symbol}
                  hint="the target"
                />
              ) : null}
            </FieldGroup>
          </div>
        </ToolPanel>

        <div className="space-y-6">
          {calc.error ? <ErrorNote message={calc.error} /> : null}

          <ToolPanel title="Result">
            <div className="space-y-5">
              <ResultStat
                label={heroLabel[solveFor]}
                value={heroValue[solveFor]}
                hint={`${money.exact(calc.solvedPrincipal)} at ${formatNumber(
                  calc.solvedRate * 100,
                  3,
                )}% for ${formatNumber(calc.solvedYears, 2)} years`}
                emphasis
              />
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Principal" value={money.exact(calc.solvedPrincipal)} />
                <MiniStat label="Interest" value={money.exact(calc.interest)} tone="positive" />
                <MiniStat label="Final balance" value={money.exact(calc.total)} hint="principal + interest" />
                <MiniStat
                  label="If it compounded annually"
                  value={money.exact(calc.compoundTotal)}
                  hint={`${money.exact(calc.compoundExtra)} more`}
                />
              </div>
              <Breakdown
                currency={currency}
                caption="Simple interest keeps the two parts strictly separate."
                items={[
                  { label: 'Principal', value: calc.solvedPrincipal, token: 'chart-1' },
                  { label: 'Interest', value: calc.interest, token: 'chart-5' },
                ]}
              />
            </div>
          </ToolPanel>
        </div>
      </div>

      <ToolPanel
        title="Simple vs compound"
        description="Simple interest grows in a straight line; compound interest curves away from it. The gap is what compounding is worth."
      >
        <LineChart
          ariaLabel="Simple interest balance compared with annually compounded balance"
          series={[
            {
              label: 'Simple',
              token: 'chart-1',
              points: [
                { x: 0, y: calc.solvedPrincipal },
                ...calc.rows.map((r) => ({ x: r.period, y: r.balance })),
              ],
              fill: true,
            },
            {
              label: 'Compound',
              token: 'chart-3',
              dashed: true,
              points: [
                { x: 0, y: calc.solvedPrincipal },
                ...calc.rows.map((r) => ({ x: r.period, y: r.compoundBalance })),
              ],
            },
          ]}
          xLabel={(x) => `${Math.round(x)}y`}
          yFormat={(v) => compactMoney(v, currency)}
          legend={[
            { label: 'Simple interest', token: 'chart-1', value: money.round(calc.total) },
            { label: 'Compounded annually', token: 'chart-3', value: money.round(calc.compoundTotal), dashed: true },
          ]}
        />
      </ToolPanel>

      <Formula
        items={[
          {
            label: 'Simple interest',
            general: 'I = P × r × t',
            steps: [
              `I = ${formatNumber(calc.solvedPrincipal, 2)} × ${formatNumber(
                calc.solvedRate * 100,
                4,
              )}% × ${formatNumber(calc.solvedYears, 4)} years`,
            ],
            result: money.exact(calc.interest),
          },
          {
            label: 'Final balance',
            general: 'A = P × (1 + r × t)',
            steps: [
              `A = ${formatNumber(calc.solvedPrincipal, 2)} × (1 + ${formatNumber(
                calc.solvedRate,
                6,
              )} × ${formatNumber(calc.solvedYears, 4)})`,
            ],
            result: money.exact(calc.total),
          },
          {
            label:
              solveFor === 'principal'
                ? 'Rearranged for principal'
                : solveFor === 'rate'
                  ? 'Rearranged for rate'
                  : solveFor === 'time'
                    ? 'Rearranged for time'
                    : 'Same figure, compounded annually',
            general:
              solveFor === 'principal'
                ? 'P = I / (r × t)'
                : solveFor === 'rate'
                  ? 'r = I / (P × t)'
                  : solveFor === 'time'
                    ? 't = I / (P × r)'
                    : 'A = P × (1 + r)^t',
            steps: [
              solveFor === 'principal'
                ? `P = ${formatNumber(calc.interest, 2)} ÷ (${formatNumber(
                    calc.solvedRate,
                    6,
                  )} × ${formatNumber(calc.solvedYears, 4)})`
                : solveFor === 'rate'
                  ? `r = ${formatNumber(calc.interest, 2)} ÷ (${formatNumber(
                      calc.solvedPrincipal,
                      2,
                    )} × ${formatNumber(calc.solvedYears, 4)})`
                  : solveFor === 'time'
                    ? `t = ${formatNumber(calc.interest, 2)} ÷ (${formatNumber(
                        calc.solvedPrincipal,
                        2,
                      )} × ${formatNumber(calc.solvedRate, 6)})`
                    : `A = ${formatNumber(calc.solvedPrincipal, 2)} × (1 + ${formatNumber(
                        calc.solvedRate,
                        6,
                      )})^${formatNumber(calc.solvedYears, 4)}`,
            ],
            result:
              solveFor === 'principal'
                ? money.exact(calc.solvedPrincipal)
                : solveFor === 'rate'
                  ? `${formatNumber(calc.solvedRate * 100, 4)}%`
                  : solveFor === 'time'
                    ? `${formatNumber(calc.solvedYears, 4)} years`
                    : money.exact(calc.compoundTotal),
          },
        ]}
        note="Rates are converted to a decimal (5% → 0.05) and time is converted to years before substitution, using a 365-day year for day counts."
      />

      <ToolPanel title="Year-by-year accrual">
        <div className="space-y-4">
          <div className="flex justify-end">
            <CsvButton
              filename="simple-interest-schedule.csv"
              headers={['Year', 'Interest', 'Interest to date', 'Balance (simple)', 'Balance (compound)']}
              rows={calc.rows.map((r) => [
                r.period,
                csvMoney(r.interest),
                csvMoney(r.cumInterest),
                csvMoney(r.balance),
                csvMoney(r.compoundBalance),
              ])}
            />
          </div>
          <DataTable
            columns={columns}
            rows={calc.rows}
            pageSize={12}
            ariaLabel="Simple interest accrual by year"
            emptyMessage="Enter a principal, rate and time period to build the table."
          />
        </div>
      </ToolPanel>

      <Assumptions
        items={[
          'Interest is calculated on the original principal for the whole period and is never added to the balance.',
          'A year is 365 days when you enter a term in days, and exactly 1/12 of a year per month when you enter months.',
          'Partial final years are pro-rated in the table, so a 3.5-year term shows a half-size fourth row.',
          'Most savings accounts, credit cards and mortgages use compound interest. Simple interest is typical of short-term notes, some car loans and many private loans.',
        ]}
      />
    </div>
  )
}
