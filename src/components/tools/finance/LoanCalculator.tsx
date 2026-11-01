import { useEffect, useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/components/tools/finance/format'

import { LineChart, compactMoney } from './charts'
import type { LineSeries } from './charts'
import {
  Assumptions,
  Breakdown,
  CurrencySelect,
  Field,
  FieldGroup,
  Formula,
  MiniStat,
  useMoney,
} from './common'
import { useLocalStorage, useToday } from './hooks'
import {
  addMonths,
  buildAmortization,
  effectiveAnnualRate,
  formatLongDate,
  formatMonths,
  toPositive,
} from './money'
import { AmortizationSection } from './schedule'

function monthValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function LoanCalculator() {
  const today = useToday()
  const [currency, setCurrency] = useLocalStorage('otd:finance:currency', 'USD')
  const money = useMoney(currency)

  const [amount, setAmount] = useState('25000')
  const [rate, setRate] = useState('9.5')
  const [years, setYears] = useState('5')
  const [extraMonths, setExtraMonths] = useState('0')
  const [fees, setFees] = useState('0')
  const [extraMonthly, setExtraMonthly] = useState('0')
  const [firstPayment, setFirstPayment] = useState('')

  useEffect(() => {
    setFirstPayment(monthValue(addMonths(today, 1)))
  }, [today])

  const calc = useMemo(() => {
    const principal = toPositive(amount)
    const rateN = Math.max(0, toPositive(rate))
    const termMonths = Math.max(
      1,
      Math.min(600, Math.round(toPositive(years) * 12 + toPositive(extraMonths))),
    )
    const feeN = toPositive(fees)
    const extra = toPositive(extraMonthly)

    const parts = firstPayment.split('-')
    const y = Number(parts[0])
    const m = Number(parts[1])
    const firstDate =
      Number.isFinite(y) && Number.isFinite(m) && y > 1900 ? new Date(y, m - 1, 1) : addMonths(today, 1)
    const origination = addMonths(firstDate, -1)

    const base = buildAmortization({
      principal,
      annualRatePct: rateN,
      months: termMonths,
      startDate: origination,
    })
    const active =
      extra > 0
        ? buildAmortization({
            principal,
            annualRatePct: rateN,
            months: termMonths,
            extraMonthly: extra,
            startDate: origination,
          })
        : base

    const totalCostOfBorrowing = active.totalInterest + feeN
    const interestRatio = principal > 0 ? (active.totalInterest / principal) * 100 : 0
    const ear = effectiveAnnualRate(rateN, 12).times(100).toNumber()

    return {
      principal,
      rateN,
      termMonths,
      feeN,
      extra,
      base,
      active,
      totalCostOfBorrowing,
      interestRatio,
      ear,
      i: rateN / 100 / 12,
      interestSaved: base.totalInterest - active.totalInterest,
      monthsSaved: base.monthsToPayoff - active.monthsToPayoff,
    }
  }, [amount, rate, years, extraMonths, fees, extraMonthly, firstPayment, today])

  const amountInvalid = calc.principal <= 0 ? 'Enter a loan amount greater than zero.' : undefined

  const series = useMemo(() => {
    const points = [
      { x: 0, y: calc.principal },
      ...calc.base.rows.map((r) => ({ x: r.n, y: r.balance })),
    ]
    const out: LineSeries[] = [{ label: 'Balance', token: 'chart-1', points, fill: true }]
    if (calc.extra > 0) {
      out.push({
        label: 'With extra payments',
        token: 'chart-3',
        dashed: true,
        points: [{ x: 0, y: calc.principal }, ...calc.active.rows.map((r) => ({ x: r.n, y: r.balance }))],
        fill: false,
      })
    }
    return out
  }, [calc])

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ToolPanel
          title="Loan details"
          description="For personal, student and business loans, and any loan repaid in equal monthly instalments."
        >
          <div className="space-y-5">
            <FieldGroup columns={2}>
              <Field
                id="loan-amount"
                label="Loan amount"
                value={amount}
                onChange={setAmount}
                prefix={money.symbol}
                invalid={amountInvalid}
              />
              <CurrencySelect value={currency} onChange={setCurrency} id="loan-currency" />
              <Field
                id="loan-rate"
                label="Annual interest rate"
                value={rate}
                onChange={setRate}
                suffix="%"
                slider={{ min: 0, max: 30, step: 0.05 }}
              />
              <Field
                id="loan-years"
                label="Term (years)"
                value={years}
                onChange={setYears}
                suffix="yrs"
                slider={{ min: 0, max: 30, step: 1 }}
              />
              <Field
                id="loan-months"
                label="Extra months"
                value={extraMonths}
                onChange={setExtraMonths}
                suffix="mo"
                hint={`total ${calc.termMonths} payments`}
              />
              <Field
                id="loan-fees"
                label="Origination / arrangement fee"
                value={fees}
                onChange={setFees}
                prefix={money.symbol}
                hint="paid up front"
              />
              <Field
                id="loan-extra"
                label="Extra monthly principal"
                value={extraMonthly}
                onChange={setExtraMonthly}
                prefix={money.symbol}
                hint="optional"
              />
              <div className="space-y-1.5">
                <Label htmlFor="loan-first" className="text-sm">
                  First payment
                </Label>
                <Input
                  id="loan-first"
                  type="month"
                  value={firstPayment}
                  onChange={(e) => setFirstPayment(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </FieldGroup>
          </div>
        </ToolPanel>

        <div className="space-y-6">
          {amountInvalid ? <ErrorNote message={amountInvalid} /> : null}

          <ToolPanel title="Repayment">
            <div className="space-y-5">
              <ResultStat
                label="Monthly payment"
                value={money.exact(calc.base.monthlyPayment)}
                hint={`${calc.termMonths} payments · ${formatMonths(calc.termMonths)}`}
                emphasis
              />
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Total interest" value={money.exact(calc.active.totalInterest)} />
                <MiniStat
                  label="Total repaid"
                  value={money.exact(calc.active.totalPaid)}
                  hint="principal + interest"
                />
                <MiniStat
                  label="Cost of borrowing"
                  value={money.exact(calc.totalCostOfBorrowing)}
                  hint="interest + fees"
                />
                <MiniStat
                  label="Interest as % of loan"
                  value={`${formatNumber(calc.interestRatio, 1)}%`}
                  hint={`effective annual rate ${formatNumber(calc.ear, 2)}%`}
                />
                <MiniStat
                  label="Final payment"
                  value={formatLongDate(calc.active.payoffDate)}
                  hint={formatMonths(calc.active.monthsToPayoff)}
                />
                <MiniStat
                  label="First payment interest"
                  value={money.exact(calc.active.rows[0]?.interest ?? 0)}
                  hint={`of a ${money.exact(calc.base.monthlyPayment)} payment`}
                />
              </div>

              {calc.extra > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat
                    label="Interest saved"
                    value={money.exact(calc.interestSaved)}
                    tone="positive"
                  />
                  <MiniStat label="Time saved" value={formatMonths(calc.monthsSaved)} tone="positive" />
                </div>
              ) : null}

              <Breakdown
                currency={currency}
                caption="What you hand over in total, split between the money you borrowed and the price of borrowing it."
                items={[
                  { label: 'Principal', value: calc.principal, token: 'chart-1' },
                  { label: 'Interest', value: calc.active.totalInterest, token: 'chart-4' },
                  { label: 'Fees', value: calc.feeN, token: 'chart-3' },
                ]}
              />
            </div>
          </ToolPanel>
        </div>
      </div>

      <ToolPanel title="Balance over the term">
        <LineChart
          ariaLabel="Remaining loan balance by payment number"
          series={series}
          xLabel={(x) => `${Math.round(x)}`}
          yFormat={(v) => compactMoney(v, currency)}
          legend={[
            { label: 'Scheduled balance', token: 'chart-1' },
            ...(calc.extra > 0 ? [{ label: 'With extra payments', token: 'chart-3', dashed: true }] : []),
          ]}
          caption="Horizontal axis is the payment number."
        />
      </ToolPanel>

      <Formula
        items={[
          {
            label: 'Monthly payment',
            general: 'M = P × i / (1 − (1 + i)^−n)',
            steps: [
              `i = ${calc.rateN}% ÷ 12 = ${calc.i.toFixed(8)}`,
              `n = ${calc.termMonths}`,
              `M = ${formatNumber(calc.principal, 2)} × ${calc.i.toFixed(8)} ÷ (1 − ${(
                1 + calc.i
              ).toFixed(8)}^−${calc.termMonths})`,
            ],
            result: money.exact(calc.base.monthlyPayment),
          },
          {
            label: 'Total repaid',
            general: 'Total = M × n (adjusted for the rounded final payment)',
            steps: [
              `Total = ${formatNumber(calc.base.monthlyPayment, 2)} × ${calc.active.monthsToPayoff}`,
            ],
            result: money.exact(calc.active.totalPaid),
          },
          {
            label: 'Total interest',
            general: 'Interest = Total − P',
            steps: [
              `Interest = ${formatNumber(calc.active.totalPaid, 2)} − ${formatNumber(calc.principal, 2)}`,
            ],
            result: money.exact(calc.active.totalInterest),
          },
          {
            label: 'Effective annual rate',
            general: 'EAR = (1 + i)^12 − 1',
            steps: [`EAR = (1 + ${calc.i.toFixed(8)})^12 − 1`],
            result: `${formatNumber(calc.ear, 3)}%`,
          },
        ]}
        note="Each month, interest is charged on the outstanding balance only; the rest of the payment reduces the principal, which is why the interest share falls over time."
      />

      <ToolPanel
        title="Amortisation schedule"
        description="Download the full schedule as CSV to drop straight into a spreadsheet."
      >
        <AmortizationSection
          result={calc.active}
          currency={currency}
          filename="loan-amortization-schedule.csv"
          showExtra={calc.extra > 0}
        />
      </ToolPanel>

      <Assumptions
        items={[
          'A fixed rate for the whole term with interest compounded monthly and equal monthly payments.',
          'Interest accrues on the outstanding balance at the start of each month; the payment is applied at the end of it.',
          'Fees are treated as paid up front rather than added to the balance, so they do not accrue interest.',
          'Late fees, payment holidays, insurance products and variable-rate resets are not modelled.',
        ]}
      />
    </div>
  )
}
