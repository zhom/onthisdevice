import { useMemo, useState } from 'react'

import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/components/tools/finance/format'

import {
  Decimal,
  ZERO,
  addMonths,
  csvMoney,
  d,
  formatLongDate,
  formatMonths,
  formatMonthYear,
  isoDate,
  toPositive,
} from './calc-money-core'
import {
  CmAssumptions,
  CmBreakdown,
  CmCurrencySelect,
  CmDataTable,
  CmExportBar,
  CmField,
  CmFieldGrid,
  CmLineChart,
  CmSegmented,
  CmStat,
  CmWorking,
  useCmToday,
  useMoney,
} from './calc-money-ui'
import type { CmColumn, CmSeries } from './calc-money-ui'

interface CardRow {
  n: number
  date: Date
  payment: number
  interest: number
  principal: number
  balance: number
  cumInterest: number
}

interface CardRun {
  rows: CardRow[]
  months: number
  totalInterest: number
  totalPaid: number
  neverClears: boolean
  payoffDate: Date
}

const MAX_MONTHS = 720

interface RunInput {
  balance: number
  aprPct: number
  start: Date
  /** Fixed payment each month. */
  fixed?: number
  /** Percentage-of-balance minimum, e.g. 2 for 2%. */
  minPct?: number
  /** Floor under the percentage minimum. */
  minFloor?: number
}

/**
 * Month-by-month card simulation. Interest is the monthly periodic rate applied
 * to the balance carried into the month, which is how a card that is never paid
 * in full is billed.
 */
function runCard(input: RunInput): CardRun {
  const rate = d(input.aprPct).div(100).div(12)
  let balance = d(Math.max(0, input.balance))
  let cumInterest = ZERO
  const rows: CardRow[] = []

  if (balance.lte(0)) {
    return { rows, months: 0, totalInterest: 0, totalPaid: 0, neverClears: false, payoffDate: input.start }
  }

  for (let n = 1; n <= MAX_MONTHS && balance.gt(0); n++) {
    const interest = balance.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    let payment =
      input.fixed !== undefined
        ? d(input.fixed)
        : Decimal.max(
            balance.times(d(input.minPct ?? 2).div(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
            d(input.minFloor ?? 25),
          )

    if (n === 1 && payment.lte(interest)) {
      return {
        rows: [],
        months: 0,
        totalInterest: 0,
        totalPaid: 0,
        neverClears: true,
        payoffDate: input.start,
      }
    }

    const due = balance.plus(interest)
    if (payment.gte(due)) payment = due

    const principal = payment.minus(interest)
    balance = balance.minus(principal)
    if (balance.abs().lt(0.005)) balance = ZERO
    cumInterest = cumInterest.plus(interest)

    rows.push({
      n,
      date: addMonths(input.start, n - 1),
      payment: payment.toNumber(),
      interest: interest.toNumber(),
      principal: principal.toNumber(),
      balance: balance.toNumber(),
      cumInterest: cumInterest.toNumber(),
    })
  }

  const last = rows[rows.length - 1]
  return {
    rows,
    months: rows.length,
    totalInterest: cumInterest.toNumber(),
    totalPaid: cumInterest.plus(Math.max(0, input.balance)).toNumber(),
    neverClears: balance.gt(0),
    payoffDate: last ? last.date : input.start,
  }
}

/** Smallest whole-cent payment that clears the balance within `target` months. */
function paymentForMonths(balance: number, aprPct: number, target: number, start: Date): number {
  if (balance <= 0 || target <= 0) return 0
  const rate = d(aprPct).div(100).div(12)
  if (rate.isZero()) return d(balance).div(target).toDecimalPlaces(2, Decimal.ROUND_UP).toNumber()

  // Closed form, then nudge up until the simulation really lands in time
  // (cent rounding in the monthly interest can cost one extra month).
  const factor = d(1).minus(d(1).plus(rate).pow(-target))
  let guess = d(balance).times(rate).div(factor).toDecimalPlaces(2, Decimal.ROUND_UP)
  for (let k = 0; k < 12; k++) {
    const run = runCard({ balance, aprPct, start, fixed: guess.toNumber() })
    if (!run.neverClears && run.months <= target) break
    guess = guess.plus(0.01)
  }
  return guess.toNumber()
}

type Mode = 'payment' | 'months'

export default function CalcMoneyCreditCardPayoff() {
  const today = useCmToday()
  const [currency, setCurrency] = useState('USD')
  const money = useMoney(currency)

  const [mode, setMode] = useState<Mode>('payment')
  const [balance, setBalance] = useState('6400')
  const [apr, setApr] = useState('22.9')
  const [payment, setPayment] = useState('250')
  const [targetMonths, setTargetMonths] = useState('24')
  const [minPct, setMinPct] = useState('2')
  const [minFloor, setMinFloor] = useState('25')

  const calc = useMemo(() => {
    const bal = toPositive(balance)
    const aprPct = Math.max(0, toPositive(apr))
    const start = addMonths(today, 1)
    const target = Math.max(1, Math.min(600, Math.round(toPositive(targetMonths, 24) || 24)))

    const requiredPayment = mode === 'months' ? paymentForMonths(bal, aprPct, target, start) : 0
    const effectivePayment = mode === 'payment' ? toPositive(payment) : requiredPayment

    const plan = runCard({ balance: bal, aprPct, start, fixed: effectivePayment })
    const minimum = runCard({
      balance: bal,
      aprPct,
      start,
      minPct: Math.max(0.5, toPositive(minPct, 2) || 2),
      minFloor: Math.max(0, toPositive(minFloor, 25)),
    })

    const firstInterest = d(bal).times(d(aprPct).div(100).div(12)).toDecimalPlaces(2)

    return {
      bal,
      aprPct,
      start,
      target,
      requiredPayment,
      effectivePayment,
      plan,
      minimum,
      firstInterest: firstInterest.toNumber(),
      monthlyRate: aprPct / 100 / 12,
      interestSaved: minimum.neverClears
        ? Number.POSITIVE_INFINITY
        : minimum.totalInterest - plan.totalInterest,
      monthsSaved: minimum.neverClears ? Number.POSITIVE_INFINITY : minimum.months - plan.months,
      firstMinimum: minimum.rows[0]?.payment ?? 0,
    }
  }, [balance, apr, payment, targetMonths, mode, minPct, minFloor, today])

  const balanceError = calc.bal <= 0 ? 'Enter the balance you are carrying on the card.' : undefined
  const paymentError =
    mode === 'payment' && calc.bal > 0 && calc.plan.neverClears
      ? `A payment of ${money.exact(calc.effectivePayment)} is less than the ${money.exact(
          calc.firstInterest,
        )} of interest charged in the first month, so the balance would grow forever. Pay more than ${money.exact(
          calc.firstInterest,
        )} a month.`
      : undefined

  const columns: CmColumn<CardRow>[] = [
    { key: 'n', header: '#', render: (r) => r.n },
    { key: 'date', header: 'Month', render: (r) => formatMonthYear(r.date) },
    { key: 'payment', header: 'Payment', align: 'right', render: (r) => money.exact(r.payment) },
    { key: 'interest', header: 'Interest', align: 'right', render: (r) => money.exact(r.interest) },
    { key: 'principal', header: 'To balance', align: 'right', render: (r) => money.exact(r.principal) },
    {
      key: 'cum',
      header: 'Interest to date',
      align: 'right',
      hideOnMobile: true,
      render: (r) => money.exact(r.cumInterest),
    },
    { key: 'balance', header: 'Balance', align: 'right', render: (r) => money.exact(r.balance) },
  ]

  const exportSpec = useMemo(
    () => ({
      filename: 'credit-card-payoff-plan',
      title: 'Credit card payoff plan',
      subtitle: `${money.exact(calc.bal)} at ${calc.aprPct}% APR, paying ${money.exact(
        calc.effectivePayment,
      )} a month`,
      tables: [
        {
          name: 'Payoff schedule',
          headers: ['#', 'Month', 'Payment', 'Interest', 'To balance', 'Interest to date', 'Balance'],
          aligns: ['left', 'left', 'right', 'right', 'right', 'right', 'right'] as (
            | 'left'
            | 'right'
          )[],
          rows: calc.plan.rows.map((r) => [
            r.n,
            isoDate(r.date),
            csvMoney(r.payment),
            csvMoney(r.interest),
            csvMoney(r.principal),
            csvMoney(r.cumInterest),
            csvMoney(r.balance),
          ]),
        },
        {
          name: 'Minimum payment only',
          headers: ['#', 'Month', 'Payment', 'Interest', 'To balance', 'Balance'],
          aligns: ['left', 'left', 'right', 'right', 'right', 'right'] as ('left' | 'right')[],
          rows: calc.minimum.rows
            .slice(0, 360)
            .map((r) => [
              r.n,
              isoDate(r.date),
              csvMoney(r.payment),
              csvMoney(r.interest),
              csvMoney(r.principal),
              csvMoney(r.balance),
            ]),
        },
      ],
      notes: [
        `APR ${calc.aprPct}% converted to a monthly periodic rate of ${(calc.monthlyRate * 100).toFixed(4)}%.`,
        'No further spending on the card is assumed, and the rate is held constant for the whole plan.',
        'The minimum-payment comparison uses a percentage of the balance with a fixed floor, recalculated every month.',
      ],
    }),
    [calc, money],
  )

  const chart = useMemo(() => {
    const toPoints = (rows: CardRow[]) => [
      { x: 0, y: calc.bal },
      ...rows.map((r) => ({ x: r.n, y: r.balance })),
    ]
    const series: CmSeries[] = [
      { label: 'Your plan', token: 'chart-1', points: toPoints(calc.plan.rows), fill: true },
    ]
    if (calc.minimum.rows.length > 1) {
      series.push({
        label: 'Minimum payment only',
        token: 'chart-3',
        dashed: true,
        points: toPoints(calc.minimum.rows.slice(0, 360)),
        fill: false,
      })
    }
    return series
  }, [calc])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ToolPanel
            title="Your card"
            description="Your balance and rate stay in this tab."
          >
            <CmFieldGrid columns={2}>
              <CmField
                id="cc-balance"
                label="Current balance"
                value={balance}
                onChange={setBalance}
                prefix={money.symbol}
                invalid={balanceError}
              />
              <CmCurrencySelect value={currency} onChange={setCurrency} id="cc-currency" />
              <CmField
                id="cc-apr"
                label="Purchase APR"
                value={apr}
                onChange={setApr}
                suffix="%"
                hint="annual, as printed on the statement"
                slider={{ min: 0, max: 40, step: 0.1 }}
                className="sm:col-span-2"
              />
            </CmFieldGrid>

            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Solve for
                </span>
                <CmSegmented
                  label="What to solve for"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'payment', label: 'Time from a payment' },
                    { value: 'months', label: 'Payment from a deadline' },
                  ]}
                />
              </div>
              {mode === 'payment' ? (
                <CmField
                  id="cc-payment"
                  label="Monthly payment"
                  value={payment}
                  onChange={setPayment}
                  prefix={money.symbol}
                  hint={`interest alone is ${money.exact(calc.firstInterest)} this month`}
                  invalid={paymentError}
                />
              ) : (
                <CmField
                  id="cc-target"
                  label="Clear the balance in"
                  value={targetMonths}
                  onChange={setTargetMonths}
                  suffix="mo"
                  hint={formatMonths(calc.target)}
                  slider={{ min: 3, max: 120, step: 1 }}
                />
              )}
            </div>
          </ToolPanel>

          <ToolPanel
            title="Minimum payment rule"
            description="Issuers usually bill a percentage of the balance with a small fixed floor. Check your statement and match it here."
          >
            <CmFieldGrid columns={2}>
              <CmField
                id="cc-minpct"
                label="Percentage of balance"
                value={minPct}
                onChange={setMinPct}
                suffix="%"
                slider={{ min: 1, max: 5, step: 0.25 }}
              />
              <CmField
                id="cc-minfloor"
                label="Minimum floor"
                value={minFloor}
                onChange={setMinFloor}
                prefix={money.symbol}
              />
            </CmFieldGrid>
          </ToolPanel>
        </div>

        <div className="space-y-6">
          {balanceError || paymentError ? (
            <ErrorNote
              title={paymentError ? 'That payment never clears the card' : 'Something is missing'}
              message={paymentError ?? balanceError ?? ''}
            />
          ) : null}

          <ToolPanel title={mode === 'payment' ? 'How long it takes' : 'What you need to pay'}>
            {mode === 'payment' ? (
              <ResultStat
                label="Debt-free in"
                value={calc.plan.neverClears ? 'Never' : formatMonths(calc.plan.months)}
                hint={
                  calc.plan.neverClears
                    ? 'the payment does not cover the interest'
                    : `last payment ${formatLongDate(calc.plan.payoffDate)}`
                }
                emphasis
              />
            ) : (
              <ResultStat
                label="Monthly payment needed"
                value={money.exact(calc.requiredPayment)}
                hint={`to clear ${money.exact(calc.bal)} in ${formatMonths(calc.target)}`}
                emphasis
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <CmStat
                label="Total interest"
                value={calc.plan.neverClears ? '–' : money.exact(calc.plan.totalInterest)}
                hint={
                  calc.bal > 0 && !calc.plan.neverClears
                    ? `${((calc.plan.totalInterest / calc.bal) * 100).toFixed(1)}% of the balance`
                    : undefined
                }
              />
              <CmStat
                label="Total paid"
                value={calc.plan.neverClears ? '–' : money.exact(calc.plan.totalPaid)}
                hint="balance + interest"
              />
              <CmStat
                label="First month's interest"
                value={money.exact(calc.firstInterest)}
                hint={`${(calc.monthlyRate * 100).toFixed(3)}% of the balance`}
              />
              <CmStat
                label="Payments"
                value={calc.plan.neverClears ? '–' : `${calc.plan.months}`}
                hint={
                  mode === 'payment'
                    ? `of ${money.exact(calc.effectivePayment)}`
                    : `of ${money.exact(calc.requiredPayment)}`
                }
              />
            </div>

            <CmBreakdown
              format={money.exact}
              items={[
                { label: 'Balance repaid', value: calc.bal, token: 'chart-1' },
                { label: 'Interest', value: calc.plan.totalInterest, token: 'chart-4' },
              ]}
              caption="Everything you will hand the issuer before the card is clear."
            />
          </ToolPanel>

          <ToolPanel
            title="The minimum-payment trap"
            description="Paying the minimum recalculates it downwards every month, which is exactly why it takes so long."
          >
            <div className="grid grid-cols-2 gap-3">
              <CmStat
                label="Minimum-only payoff"
                value={
                  calc.minimum.neverClears
                    ? calc.minimum.rows.length === 0
                      ? 'Never'
                      : 'Over 60 years'
                    : formatMonths(calc.minimum.months)
                }
                tone="negative"
                hint={`starting at ${money.exact(calc.firstMinimum)} a month`}
              />
              <CmStat
                label="Minimum-only interest"
                value={
                  calc.minimum.neverClears
                    ? calc.minimum.rows.length === 0
                      ? '–'
                      : 'Over ' + money.round(calc.minimum.totalInterest)
                    : money.exact(calc.minimum.totalInterest)
                }
                tone="negative"
              />
              <CmStat
                label="Interest you avoid"
                value={
                  Number.isFinite(calc.interestSaved) && !calc.plan.neverClears
                    ? money.exact(Math.max(0, calc.interestSaved))
                    : '–'
                }
                tone="positive"
                hint="versus paying the minimum"
              />
              <CmStat
                label="Time you avoid"
                value={
                  Number.isFinite(calc.monthsSaved) && !calc.plan.neverClears
                    ? formatMonths(Math.max(0, calc.monthsSaved))
                    : '–'
                }
                tone="positive"
              />
            </div>
          </ToolPanel>
        </div>
      </div>

      <ToolPanel
        title="Balance curve"
        description="A card balance falls slowly at first because the interest charge is proportional to what is still owed."
      >
        <CmLineChart
          ariaLabel="Credit card balance by month under each payment plan"
          series={chart}
          xFormat={(x) => `${Math.round(x)}mo`}
          yFormat={(v) => money.compact(v)}
          caption={
            calc.plan.rows.length > 0
              ? `Halfway point: the balance drops below ${money.round(calc.bal / 2)} at payment ${
                  (calc.plan.rows.findIndex((r) => r.balance <= calc.bal / 2) + 1) || calc.plan.months
                }.`
              : undefined
          }
        />
      </ToolPanel>

      <CmWorking
        items={[
          {
            label: 'Monthly periodic rate',
            general: 'i = APR ÷ 12',
            steps: [`i = ${calc.aprPct}% ÷ 12 = ${(calc.monthlyRate * 100).toFixed(4)}% per month`],
            result: calc.monthlyRate.toFixed(6),
          },
          {
            label: 'This month’s interest',
            general: 'Interest = balance × i',
            steps: [`= ${formatNumber(calc.bal, 2)} × ${calc.monthlyRate.toFixed(6)}`],
            result: money.exact(calc.firstInterest),
          },
          mode === 'months'
            ? {
                label: 'Payment needed for a deadline',
                general: 'A = B × i / (1 − (1 + i)^−n)',
                steps: [
                  `= ${formatNumber(calc.bal, 2)} × ${calc.monthlyRate.toFixed(6)} ÷ (1 − ${(
                    1 + calc.monthlyRate
                  ).toFixed(6)}^−${calc.target})`,
                ],
                result: money.exact(calc.requiredPayment),
              }
            : {
                label: 'Months to clear a fixed payment',
                general: 'n = −ln(1 − B·i / A) / ln(1 + i)',
                steps: [
                  `= −ln(1 − ${formatNumber(calc.bal, 2)} × ${calc.monthlyRate.toFixed(
                    6,
                  )} ÷ ${formatNumber(calc.effectivePayment, 2)}) ÷ ln(${(1 + calc.monthlyRate).toFixed(6)})`,
                  'the schedule above uses the month-by-month simulation, which rounds interest to the cent each month',
                ],
                result: calc.plan.neverClears ? 'never' : `${calc.plan.months} payments`,
              },
          {
            label: 'Total interest',
            general: 'Interest = Σ (balance × i) over every month',
            steps: [
              `total paid ${money.exact(calc.plan.totalPaid)} − balance ${money.exact(calc.bal)}`,
            ],
            result: calc.plan.neverClears ? '–' : money.exact(calc.plan.totalInterest),
          },
        ]}
        note="Card interest is billed monthly on the carried balance. If you clear the statement in full every month, a purchase APR never applies, because the grace period covers each purchase."
      />

      <ToolPanel
        title="Month-by-month plan"
        description="Print it, stick it on the fridge, tick off the rows."
        footer={<CmExportBar spec={exportSpec} />}
      >
        <CmDataTable
          ariaLabel="Credit card payoff schedule"
          columns={columns}
          rows={calc.plan.rows}
          pageSize={12}
          minWidth={600}
          emptyMessage="Enter a balance and a payment that covers at least the monthly interest."
        />
      </ToolPanel>

      <CmAssumptions
        items={[
          'The APR is converted to a monthly periodic rate by dividing by twelve, which is how US and UK issuers bill a revolving balance. Some issuers use a daily periodic rate on the average daily balance, which produces a slightly higher charge.',
          'No new spending is added to the card and the rate never changes. A promotional 0% period ending mid-plan will make the real number worse than this.',
          'Cash advances, balance-transfer fees, annual fees and late fees are not modelled.',
          'The minimum-payment comparison recalculates the minimum from the falling balance every month with a fixed floor, which is standard practice; some issuers instead use interest + 1% of the balance.',
          'Payments are assumed to arrive on the statement date with no partial-month interest.',
        ]}
      />
    </div>
  )
}
