import { useMemo, useState } from 'react'
import { CircleCheck } from 'lucide-react'

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
  Segmented,
  useMoney,
} from './common'
import type { Column } from './common'
import { useLocalStorage } from './hooks'
import {
  COMPOUND_FREQUENCIES,
  buildGrowth,
  csvMoney,
  d,
  formatMonths,
  periodsPerYear,
  toPositive,
} from './money'
import type { CompoundFrequency, GrowthYear } from './money'

type Mode = 'deposit' | 'time'

const DEPOSIT_FREQUENCIES: CompoundFrequency[] = ['monthly', 'semimonthly', 'biweekly', 'weekly', 'quarterly', 'annually']

export default function SavingsGoalCalculator() {
  const [currency, setCurrency] = useLocalStorage('otd:finance:currency', 'USD')
  const money = useMoney(currency)

  const [mode, setMode] = useState<Mode>('deposit')
  const [goal, setGoal] = useState('50000')
  const [current, setCurrent] = useState('5000')
  const [rate, setRate] = useState('4')
  const [years, setYears] = useState('5')
  const [deposit, setDeposit] = useState('600')
  const [freq, setFreq] = useState<CompoundFrequency>('monthly')

  const calc = useMemo(() => {
    const FV = toPositive(goal)
    const P = toPositive(current)
    const ratePct = toPositive(rate)
    const perYear = periodsPerYear(freq)
    const i = d(ratePct).div(100).div(perYear)
    const alreadyThere = P >= FV && FV > 0

    let requiredDeposit = toPositive(deposit)
    let periods = Math.max(0, Math.round(toPositive(years) * perYear))
    let error: string | undefined
    let unreachable = false

    if (mode === 'deposit') {
      if (FV <= 0) {
        error = 'Enter a savings goal greater than zero.'
      } else if (periods <= 0) {
        error = 'Enter a target of at least one period.'
      } else if (alreadyThere) {
        requiredDeposit = 0
      } else if (i.isZero()) {
        requiredDeposit = d(FV).minus(P).div(periods).toNumber()
      } else {
        const growth = d(1).plus(i).pow(periods)
        const numerator = d(FV).minus(d(P).times(growth)).times(i)
        const denominator = growth.minus(1)
        const value = numerator.div(denominator).toNumber()
        requiredDeposit = Math.max(0, value)
      }
    } else {
      if (FV <= 0) {
        error = 'Enter a savings goal greater than zero.'
      } else if (alreadyThere) {
        periods = 0
      } else if (i.isZero()) {
        if (requiredDeposit <= 0) {
          unreachable = true
          periods = 0
        } else {
          periods = Math.ceil(d(FV).minus(P).div(requiredDeposit).toNumber())
        }
      } else {
        const top = d(FV).times(i).plus(requiredDeposit)
        const bottom = d(P).times(i).plus(requiredDeposit)
        if (top.lte(0) || bottom.lte(0)) {
          unreachable = true
          periods = 0
        } else {
          const n = Math.log(top.toNumber() / bottom.toNumber()) / Math.log(1 + i.toNumber())
          if (!Number.isFinite(n) || n > perYear * 100) {
            unreachable = true
            periods = 0
          } else {
            periods = Math.max(1, Math.ceil(n))
          }
        }
      }
    }

    const solvedYears = Math.max(0, Math.ceil(periods / perYear))
    const growth = buildGrowth({
      principal: P,
      contribution: requiredDeposit,
      contributionsPerYear: perYear,
      annualRatePct: ratePct,
      compoundsPerYear: perYear,
      years: solvedYears,
    })

    const totalDeposited = P + requiredDeposit * periods
    const interestEarned = Math.max(0, FV - totalDeposited)

    return {
      FV,
      P,
      ratePct,
      perYear,
      i: i.toNumber(),
      requiredDeposit,
      periods,
      solvedYears,
      growth,
      totalDeposited,
      interestEarned,
      error,
      unreachable,
      alreadyThere,
      monthlyEquivalent: (requiredDeposit * perYear) / 12,
    }
  }, [mode, goal, current, rate, years, deposit, freq])

  const columns: Column<GrowthYear>[] = [
    { key: 'year', header: 'Year', render: (r) => r.year },
    { key: 'start', header: 'Start balance', align: 'right', render: (r) => money.exact(r.startBalance) },
    { key: 'deposits', header: 'Deposits', align: 'right', render: (r) => money.exact(r.contributions) },
    { key: 'interest', header: 'Interest', align: 'right', render: (r) => money.exact(r.interest) },
    { key: 'end', header: 'End balance', align: 'right', render: (r) => money.exact(r.endBalance) },
    {
      key: 'progress',
      header: 'Progress',
      align: 'right',
      hideOnMobile: true,
      render: (r) => (calc.FV > 0 ? `${Math.min(100, (r.endBalance / calc.FV) * 100).toFixed(0)}%` : '–'),
    },
  ]

  const freqLabel =
    COMPOUND_FREQUENCIES.find((f) => f.value === freq)?.label.split(' ')[0]?.toLowerCase() ?? 'monthly'

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ToolPanel
          title="Your goal"
          description="Work out either the deposit you need, or how long the deposit you can afford will take."
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Solve for
              </span>
              <Segmented
                label="Solve for"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'deposit', label: 'Deposit needed' },
                  { value: 'time', label: 'Time needed' },
                ]}
              />
            </div>

            <FieldGroup columns={2}>
              <Field
                id="sg-goal"
                label="Savings goal"
                value={goal}
                onChange={setGoal}
                prefix={money.symbol}
              />
              <CurrencySelect value={currency} onChange={setCurrency} id="sg-currency" />
              <Field
                id="sg-current"
                label="Already saved"
                value={current}
                onChange={setCurrent}
                prefix={money.symbol}
              />
              <Field
                id="sg-rate"
                label="Annual return"
                value={rate}
                onChange={setRate}
                suffix="%"
                hint="0% for a jar under the bed"
                slider={{ min: 0, max: 15, step: 0.1 }}
              />
              <SelectField
                id="sg-freq"
                label="Deposit frequency"
                value={freq}
                onChange={(v) => setFreq(v as CompoundFrequency)}
                options={COMPOUND_FREQUENCIES.filter((f) => DEPOSIT_FREQUENCIES.includes(f.value)).map(
                  (f) => ({ value: f.value, label: f.label }),
                )}
              />
              {mode === 'deposit' ? (
                <Field
                  id="sg-years"
                  label="Reach it in"
                  value={years}
                  onChange={setYears}
                  suffix="yrs"
                  slider={{ min: 1, max: 40, step: 1 }}
                />
              ) : (
                <Field
                  id="sg-deposit"
                  label="Deposit each period"
                  value={deposit}
                  onChange={setDeposit}
                  prefix={money.symbol}
                  hint={`${freqLabel} · ${money.round(calc.monthlyEquivalent)} / month`}
                />
              )}
            </FieldGroup>
          </div>
        </ToolPanel>

        <div className="space-y-6">
          {calc.error ? <ErrorNote message={calc.error} /> : null}
          {calc.unreachable ? (
            <ErrorNote message="With that deposit and return you never reach the goal, or it takes more than a hundred years. Increase the deposit or the expected return." />
          ) : null}
          {calc.alreadyThere && !calc.error ? (
            <p
              role="status"
              aria-live="polite"
              className="flex items-start gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-foreground"
            >
              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                You have already saved more than the goal, so no more deposits are needed. Raise the
                goal to plan the next one.
              </span>
            </p>
          ) : null}

          <ToolPanel title={mode === 'deposit' ? 'What you need to save' : 'How long it takes'}>
            <div className="space-y-5">
              {mode === 'deposit' ? (
                <ResultStat
                  label={`Deposit needed, ${freqLabel}`}
                  value={money.exact(calc.requiredDeposit)}
                  hint={`about ${money.exact(calc.monthlyEquivalent)} a month for ${formatMonths(
                    Math.round((calc.periods / calc.perYear) * 12),
                  )}`}
                  emphasis
                />
              ) : (
                <ResultStat
                  label="Time to reach the goal"
                  value={formatMonths(Math.round((calc.periods / calc.perYear) * 12))}
                  hint={`${calc.periods} deposits of ${money.exact(calc.requiredDeposit)}`}
                  emphasis
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Goal" value={money.exact(calc.FV)} />
                <MiniStat label="Already saved" value={money.exact(calc.P)} />
                <MiniStat
                  label="Total you deposit"
                  value={money.exact(calc.totalDeposited)}
                  hint="including what you have now"
                />
                <MiniStat
                  label="Interest does the rest"
                  value={money.exact(calc.interestEarned)}
                  tone="positive"
                />
              </div>

              <Breakdown
                currency={currency}
                caption="How the goal gets funded."
                items={[
                  { label: 'Already saved', value: calc.P, token: 'chart-3' },
                  {
                    label: 'Future deposits',
                    value: Math.max(0, calc.totalDeposited - calc.P),
                    token: 'chart-1',
                  },
                  { label: 'Interest', value: calc.interestEarned, token: 'chart-5' },
                ]}
              />
            </div>
          </ToolPanel>
        </div>
      </div>

      <ToolPanel title="Progress towards the goal">
        <LineChart
          ariaLabel="Savings balance rising towards the goal"
          series={[
            {
              label: 'Balance',
              token: 'chart-1',
              fill: true,
              points: [
                { x: 0, y: calc.P },
                ...calc.growth.years.map((y) => ({ x: y.year, y: y.endBalance })),
              ],
            },
            {
              label: 'Goal',
              token: 'chart-3',
              dashed: true,
              points: [
                { x: 0, y: calc.FV },
                { x: Math.max(1, calc.solvedYears), y: calc.FV },
              ],
            },
          ]}
          xLabel={(x) => `${Math.round(x)}y`}
          yFormat={(v) => compactMoney(v, currency)}
          legend={[
            { label: 'Projected balance', token: 'chart-1' },
            { label: 'Goal', token: 'chart-3', value: money.round(calc.FV), dashed: true },
          ]}
          caption="The balance line is plotted at each year end, so it crosses the goal part-way through the final year."
        />
      </ToolPanel>

      <Formula
        items={
          mode === 'deposit'
            ? [
                {
                  label: 'Deposit needed each period',
                  general:
                    calc.i === 0
                      ? 'PMT = (FV − P) / n'
                      : 'PMT = (FV − P(1 + i)ⁿ) × i / ((1 + i)ⁿ − 1)',
                  steps:
                    calc.i === 0
                      ? [
                          `n = ${calc.periods} deposits`,
                          `PMT = (${formatNumber(calc.FV, 2)} − ${formatNumber(calc.P, 2)}) ÷ ${
                            calc.periods
                          }`,
                        ]
                      : [
                          `i = ${formatNumber(calc.ratePct, 4)}% ÷ ${calc.perYear} = ${calc.i.toFixed(8)}`,
                          `n = ${calc.periods} deposits`,
                          `PMT = (${formatNumber(calc.FV, 2)} − ${formatNumber(calc.P, 2)} × ${(
                            1 + calc.i
                          ).toFixed(8)}^${calc.periods}) × ${calc.i.toFixed(8)} ÷ ((1 + ${calc.i.toFixed(
                            8,
                          )})^${calc.periods} − 1)`,
                        ],
                  result: money.exact(calc.requiredDeposit),
                },
                {
                  label: 'Growth of what you already have',
                  general: 'FV₀ = P × (1 + i)ⁿ',
                  steps: [
                    `FV₀ = ${formatNumber(calc.P, 2)} × (1 + ${calc.i.toFixed(8)})^${calc.periods}`,
                  ],
                  result: money.exact(calc.P * Math.pow(1 + calc.i, calc.periods)),
                },
              ]
            : [
                {
                  label: 'Periods needed',
                  general:
                    calc.i === 0
                      ? 'n = (FV − P) / PMT'
                      : 'n = ln((FV·i + PMT) / (P·i + PMT)) / ln(1 + i)',
                  steps:
                    calc.i === 0
                      ? [
                          `n = (${formatNumber(calc.FV, 2)} − ${formatNumber(
                            calc.P,
                            2,
                          )}) ÷ ${formatNumber(calc.requiredDeposit, 2)}`,
                        ]
                      : [
                          `i = ${formatNumber(calc.ratePct, 4)}% ÷ ${calc.perYear} = ${calc.i.toFixed(8)}`,
                          `n = ln((${formatNumber(calc.FV, 2)} × ${calc.i.toFixed(8)} + ${formatNumber(
                            calc.requiredDeposit,
                            2,
                          )}) ÷ (${formatNumber(calc.P, 2)} × ${calc.i.toFixed(8)} + ${formatNumber(
                            calc.requiredDeposit,
                            2,
                          )})) ÷ ln(1 + ${calc.i.toFixed(8)})`,
                        ],
                  result: `${calc.periods} periods · ${formatMonths(
                    Math.round((calc.periods / calc.perYear) * 12),
                  )}`,
                },
                {
                  label: 'Total deposited by then',
                  general: 'Total = P + PMT × n',
                  steps: [
                    `Total = ${formatNumber(calc.P, 2)} + ${formatNumber(
                      calc.requiredDeposit,
                      2,
                    )} × ${calc.periods}`,
                  ],
                  result: money.exact(calc.totalDeposited),
                },
              ]
        }
        note="Deposits are treated as arriving at the end of each period (an ordinary annuity) and interest is compounded at the same frequency."
      />

      <ToolPanel title="Year-by-year plan">
        <div className="space-y-4">
          <div className="flex justify-end">
            <CsvButton
              filename="savings-goal-plan.csv"
              headers={['Year', 'Start balance', 'Deposits', 'Interest', 'End balance']}
              rows={calc.growth.years.map((y) => [
                y.year,
                csvMoney(y.startBalance),
                csvMoney(y.contributions),
                csvMoney(y.interest),
                csvMoney(y.endBalance),
              ])}
            />
          </div>
          <DataTable
            columns={columns}
            rows={calc.growth.years}
            pageSize={12}
            ariaLabel="Year by year savings plan"
            emptyMessage="Enter a goal and a timeframe to build the plan."
          />
        </div>
      </ToolPanel>

      <Assumptions
        items={[
          'Deposits are made at the end of every period and never missed.',
          'The return is constant and compounded at the deposit frequency. A real savings account rate changes; an investment return varies far more.',
          'Tax on interest, account fees and inflation are ignored. A goal five years out will buy less than the same amount today.',
          'The final year is rounded up to a whole year in the table, so the last row usually overshoots the goal slightly.',
        ]}
      />
    </div>
  )
}
