import { useEffect, useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/components/tools/finance/format'

import { DonutChart, LineChart, compactMoney } from './charts'
import type { LineSeries } from './charts'
import {
  Assumptions,
  Breakdown,
  CurrencySelect,
  Field,
  FieldGroup,
  Formula,
  MiniStat,
  Segmented,
  useMoney,
} from './common'
import { useLocalStorage, useToday } from './hooks'
import {
  addMonths,
  buildAmortization,
  formatLongDate,
  formatMonths,
  monthlyPaymentDecimal,
  toPositive,
} from './money'
import { AmortizationSection } from './schedule'

type Mode = 'amount' | 'percent'

function monthValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function MortgageCalculator() {
  const today = useToday()
  const [currency, setCurrency] = useLocalStorage('otd:finance:currency', 'USD')
  const money = useMoney(currency)

  const [price, setPrice] = useState('450000')
  const [downMode, setDownMode] = useState<Mode>('percent')
  const [downAmount, setDownAmount] = useState('90000')
  const [downPercent, setDownPercent] = useState('20')
  const [rate, setRate] = useState('6.5')
  const [termYears, setTermYears] = useState('30')
  const [firstPayment, setFirstPayment] = useState('')

  const [taxMode, setTaxMode] = useState<Mode>('percent')
  const [taxAnnual, setTaxAnnual] = useState('5400')
  const [taxPercent, setTaxPercent] = useState('1.1')
  const [insuranceAnnual, setInsuranceAnnual] = useState('1800')
  const [hoaMonthly, setHoaMonthly] = useState('0')
  const [pmiPercent, setPmiPercent] = useState('0.5')
  const [extraMonthly, setExtraMonthly] = useState('0')

  useEffect(() => {
    setFirstPayment(monthValue(addMonths(today, 1)))
  }, [today])

  const calc = useMemo(() => {
    const priceN = toPositive(price)
    const rateN = Math.max(0, toPositive(rate))
    const years = Math.max(1, Math.min(50, Math.round(toPositive(termYears, 30)) || 30))
    const months = years * 12

    const down =
      downMode === 'percent'
        ? (priceN * Math.min(100, toPositive(downPercent))) / 100
        : Math.min(priceN, toPositive(downAmount))
    const loan = Math.max(0, priceN - down)
    const ltv = priceN > 0 ? loan / priceN : 0

    const parts = firstPayment.split('-')
    const fpYear = Number(parts[0])
    const fpMonth = Number(parts[1])
    const firstPaymentDate =
      Number.isFinite(fpYear) && Number.isFinite(fpMonth) && fpYear > 1900
        ? new Date(fpYear, fpMonth - 1, 1)
        : addMonths(today, 1)
    const origination = addMonths(firstPaymentDate, -1)

    const extra = toPositive(extraMonthly)
    const base = buildAmortization({
      principal: loan,
      annualRatePct: rateN,
      months,
      startDate: origination,
    })
    const active =
      extra > 0
        ? buildAmortization({
            principal: loan,
            annualRatePct: rateN,
            months,
            extraMonthly: extra,
            startDate: origination,
          })
        : base

    const annualTax =
      taxMode === 'percent' ? (priceN * toPositive(taxPercent)) / 100 : toPositive(taxAnnual)
    const annualInsurance = toPositive(insuranceAnnual)
    const hoa = toPositive(hoaMonthly)
    const pmiPct = toPositive(pmiPercent)
    const pmiMonthly = ltv > 0.8 ? (loan * pmiPct) / 100 / 12 : 0

    let pmiMonths = 0
    if (pmiMonthly > 0 && priceN > 0) {
      for (const row of active.rows) {
        const openingBalance = row.balance + row.principal + row.extra
        if (openingBalance / priceN > 0.8) pmiMonths += 1
        else break
      }
    }

    const monthlyTax = annualTax / 12
    const monthlyInsurance = annualInsurance / 12
    const escrow = monthlyTax + monthlyInsurance + hoa
    const monthlyTotal = base.monthlyPayment + escrow + pmiMonthly
    const monthlyAfterPmi = base.monthlyPayment + escrow

    const payoffMonths = active.monthsToPayoff
    const yearsHeld = payoffMonths / 12
    const totalTax = monthlyTax * payoffMonths
    const totalInsurance = monthlyInsurance * payoffMonths
    const totalHoa = hoa * payoffMonths
    const totalPmi = pmiMonthly * pmiMonths
    const totalCost = active.totalPaid + totalTax + totalInsurance + totalHoa + totalPmi

    const interestSaved = base.totalInterest - active.totalInterest
    const monthsSaved = base.monthsToPayoff - active.monthsToPayoff

    const i = rateN / 100 / 12

    return {
      priceN,
      down,
      loan,
      ltv,
      rateN,
      years,
      months,
      i,
      base,
      active,
      extra,
      annualTax,
      annualInsurance,
      hoa,
      pmiPct,
      pmiMonthly,
      pmiMonths,
      monthlyTax,
      monthlyInsurance,
      escrow,
      monthlyTotal,
      monthlyAfterPmi,
      payoffMonths,
      yearsHeld,
      totalTax,
      totalInsurance,
      totalHoa,
      totalPmi,
      totalCost,
      interestSaved,
      monthsSaved,
      origination,
    }
  }, [
    price,
    downMode,
    downAmount,
    downPercent,
    rate,
    termYears,
    firstPayment,
    taxMode,
    taxAnnual,
    taxPercent,
    insuranceAnnual,
    hoaMonthly,
    pmiPercent,
    extraMonthly,
    today,
  ])

  const priceInvalid = toPositive(price) <= 0 ? 'Enter a home price greater than zero.' : undefined
  const downInvalid =
    calc.priceN > 0 && calc.down >= calc.priceN
      ? 'The down payment covers the whole price, so there is no loan to amortise.'
      : undefined

  const balanceSeries = useMemo(() => {
    const toPoints = (rows: { n: number; balance: number }[]) => [
      { x: 0, y: calc.loan },
      ...rows.map((r) => ({ x: r.n, y: r.balance })),
    ]
    const series: LineSeries[] = [
      {
        label: 'Balance',
        token: 'chart-1',
        points: toPoints(calc.base.rows),
        fill: true,
      },
    ]
    if (calc.extra > 0) {
      series.push({
        label: 'With extra payments',
        token: 'chart-3',
        points: toPoints(calc.active.rows),
        fill: false,
        dashed: true,
      })
    }
    return series
  }, [calc])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ToolPanel
            title="Home and loan"
            description="Every figure updates as you type. Nothing is sent anywhere."
          >
            <div className="space-y-5">
              <FieldGroup columns={2}>
                <Field
                  id="mtg-price"
                  label="Home price"
                  value={price}
                  onChange={setPrice}
                  prefix={money.symbol}
                  invalid={priceInvalid}
                />
                <CurrencySelect value={currency} onChange={setCurrency} id="mtg-currency" />
              </FieldGroup>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Down payment
                  </span>
                  <Segmented
                    label="Down payment entry mode"
                    value={downMode}
                    onChange={setDownMode}
                    options={[
                      { value: 'percent', label: '%' },
                      { value: 'amount', label: money.symbol },
                    ]}
                  />
                </div>
                {downMode === 'percent' ? (
                  <Field
                    id="mtg-down-pct"
                    label="Down payment"
                    value={downPercent}
                    onChange={setDownPercent}
                    suffix="%"
                    hint={money.exact(calc.down)}
                    slider={{ min: 0, max: 50, step: 0.5 }}
                    invalid={downInvalid}
                  />
                ) : (
                  <Field
                    id="mtg-down-amt"
                    label="Down payment"
                    value={downAmount}
                    onChange={setDownAmount}
                    prefix={money.symbol}
                    hint={
                      calc.priceN > 0 ? `${((calc.down / calc.priceN) * 100).toFixed(1)}% of price` : undefined
                    }
                    invalid={downInvalid}
                  />
                )}
              </div>

              <FieldGroup columns={2}>
                <Field
                  id="mtg-rate"
                  label="Interest rate"
                  value={rate}
                  onChange={setRate}
                  suffix="%"
                  hint="APR, annual"
                  slider={{ min: 0, max: 15, step: 0.05 }}
                />
                <Field
                  id="mtg-term"
                  label="Loan term"
                  value={termYears}
                  onChange={setTermYears}
                  suffix="yrs"
                  slider={{ min: 5, max: 40, step: 1 }}
                />
              </FieldGroup>

              <div className="space-y-1.5">
                <Label htmlFor="mtg-first" className="text-sm">
                  First payment
                </Label>
                <Input
                  id="mtg-first"
                  type="month"
                  value={firstPayment}
                  onChange={(e) => setFirstPayment(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>
          </ToolPanel>

          <ToolPanel
            title="Taxes, insurance and fees"
            description="Escrow items are not part of the loan, but they are part of the cheque you write."
          >
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Property tax
                  </span>
                  <Segmented
                    label="Property tax entry mode"
                    value={taxMode}
                    onChange={setTaxMode}
                    options={[
                      { value: 'percent', label: '% / yr' },
                      { value: 'amount', label: `${money.symbol} / yr` },
                    ]}
                  />
                </div>
                {taxMode === 'percent' ? (
                  <Field
                    id="mtg-tax-pct"
                    label="Annual property tax rate"
                    value={taxPercent}
                    onChange={setTaxPercent}
                    suffix="%"
                    hint={`${money.exact(calc.annualTax)} / yr`}
                    slider={{ min: 0, max: 4, step: 0.05 }}
                  />
                ) : (
                  <Field
                    id="mtg-tax-amt"
                    label="Annual property tax"
                    value={taxAnnual}
                    onChange={setTaxAnnual}
                    prefix={money.symbol}
                    hint={`${money.exact(calc.monthlyTax)} / mo`}
                  />
                )}
              </div>

              <FieldGroup columns={2}>
                <Field
                  id="mtg-ins"
                  label="Home insurance"
                  value={insuranceAnnual}
                  onChange={setInsuranceAnnual}
                  prefix={money.symbol}
                  hint="per year"
                />
                <Field
                  id="mtg-hoa"
                  label="HOA / condo fees"
                  value={hoaMonthly}
                  onChange={setHoaMonthly}
                  prefix={money.symbol}
                  hint="per month"
                />
                <Field
                  id="mtg-pmi"
                  label="PMI rate"
                  value={pmiPercent}
                  onChange={setPmiPercent}
                  suffix="%"
                  hint={calc.ltv > 0.8 ? 'charged until 80% LTV' : 'not required under 80% LTV'}
                />
                <Field
                  id="mtg-extra"
                  label="Extra monthly principal"
                  value={extraMonthly}
                  onChange={setExtraMonthly}
                  prefix={money.symbol}
                  hint="optional"
                />
              </FieldGroup>
            </div>
          </ToolPanel>
        </div>

        <div className="space-y-6">
          {priceInvalid || downInvalid ? (
            <ErrorNote message={priceInvalid ?? downInvalid ?? ''} />
          ) : null}

          <ToolPanel title="Your monthly payment">
            <div className="space-y-5">
              <ResultStat
                label="Total monthly payment"
                value={money.exact(calc.monthlyTotal)}
                hint={
                  calc.pmiMonthly > 0
                    ? `drops to ${money.exact(calc.monthlyAfterPmi)} once PMI ends`
                    : 'principal, interest, tax, insurance and fees'
                }
                emphasis
              />

              <DonutChart
                ariaLabel="Composition of the monthly mortgage payment"
                centerLabel="per month"
                centerValue={money.round(calc.monthlyTotal)}
                slices={[
                  { label: 'Principal & interest', value: calc.base.monthlyPayment, token: 'chart-1' },
                  { label: 'Property tax', value: calc.monthlyTax, token: 'chart-2' },
                  { label: 'Home insurance', value: calc.monthlyInsurance, token: 'chart-3' },
                  { label: 'HOA / condo fees', value: calc.hoa, token: 'chart-4' },
                  { label: 'PMI', value: calc.pmiMonthly, token: 'chart-5' },
                ]}
              />

              <Breakdown
                currency={currency}
                caption="Shares of the payment you make each month."
                items={[
                  {
                    label: 'Principal & interest',
                    value: calc.base.monthlyPayment,
                    token: 'chart-1',
                  },
                  { label: 'Property tax', value: calc.monthlyTax, token: 'chart-2' },
                  { label: 'Home insurance', value: calc.monthlyInsurance, token: 'chart-3' },
                  { label: 'HOA / condo fees', value: calc.hoa, token: 'chart-4' },
                  {
                    label: 'PMI',
                    value: calc.pmiMonthly,
                    token: 'chart-5',
                    hint: calc.pmiMonths > 0 ? `${formatMonths(calc.pmiMonths)}` : undefined,
                  },
                ]}
              />
            </div>
          </ToolPanel>

          <ToolPanel title="Over the life of the loan">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Loan amount" value={money.exact(calc.loan)} hint={`${(calc.ltv * 100).toFixed(1)}% LTV`} />
              <MiniStat label="Down payment" value={money.exact(calc.down)} />
              <MiniStat label="Total interest" value={money.exact(calc.active.totalInterest)} />
              <MiniStat
                label="Total of payments"
                value={money.exact(calc.active.totalPaid)}
                hint="principal + interest"
              />
              <MiniStat
                label="Payoff date"
                value={formatLongDate(calc.active.payoffDate)}
                hint={formatMonths(calc.payoffMonths)}
              />
              <MiniStat
                label="True cost of ownership"
                value={money.exact(calc.totalCost)}
                hint="incl. tax, insurance, HOA, PMI"
              />
            </div>

            {calc.extra > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat
                  label="Interest saved"
                  value={money.exact(calc.interestSaved)}
                  hint={`by paying ${money.exact(calc.extra)} extra each month`}
                  tone="positive"
                />
                <MiniStat
                  label="Time saved"
                  value={formatMonths(calc.monthsSaved)}
                  hint={`paid off ${formatLongDate(calc.active.payoffDate)}`}
                  tone="positive"
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Add an extra monthly principal payment above to see how much interest it saves and how
                many months it removes from the term.
              </p>
            )}
          </ToolPanel>
        </div>
      </div>

      <ToolPanel
        title="Balance over time"
        description="How fast the loan balance falls. Early payments are almost all interest."
      >
        <LineChart
          ariaLabel="Remaining mortgage balance by payment number"
          series={balanceSeries}
          xLabel={(x) => `${Math.round(x / 12)}y`}
          yFormat={(v) => compactMoney(v, currency)}
          legend={[
            { label: 'Scheduled balance', token: 'chart-1', value: money.round(calc.loan) },
            ...(calc.extra > 0
              ? [
                  {
                    label: 'With extra payments',
                    token: 'chart-3',
                    dashed: true,
                    value: `−${formatMonths(calc.monthsSaved)}`,
                  },
                ]
              : []),
          ]}
          caption={`Crossover point: principal first exceeds interest in payment ${
            calc.base.rows.findIndex((r) => r.principal > r.interest) + 1 || 1
          } of ${calc.base.rows.length || 0}.`}
        />
      </ToolPanel>

      <Formula
        items={[
          {
            label: 'Loan amount',
            general: 'L = price − down payment',
            steps: [`L = ${money.exact(calc.priceN)} − ${money.exact(calc.down)}`],
            result: money.exact(calc.loan),
          },
          {
            label: 'Monthly principal & interest',
            general: 'M = L × i / (1 − (1 + i)^−n)',
            steps: [
              `i = ${calc.rateN}% ÷ 12 = ${calc.i.toFixed(8)}`,
              `n = ${calc.years} × 12 = ${calc.months}`,
              `M = ${formatNumber(calc.loan, 2)} × ${calc.i.toFixed(8)} ÷ (1 − ${(1 + calc.i).toFixed(
                8,
              )}^−${calc.months})`,
            ],
            result: money.exact(
              monthlyPaymentDecimal(calc.loan, calc.rateN, calc.months).toNumber(),
            ),
          },
          {
            label: 'Monthly escrow and fees',
            general: 'E = tax ÷ 12 + insurance ÷ 12 + HOA + PMI',
            steps: [
              `E = ${formatNumber(calc.annualTax, 2)} ÷ 12 + ${formatNumber(
                calc.annualInsurance,
                2,
              )} ÷ 12 + ${formatNumber(calc.hoa, 2)} + ${formatNumber(calc.pmiMonthly, 2)}`,
            ],
            result: money.exact(calc.escrow + calc.pmiMonthly),
          },
          {
            label: 'Total monthly payment',
            general: 'Payment = M + E',
            steps: [
              `Payment = ${formatNumber(calc.base.monthlyPayment, 2)} + ${formatNumber(
                calc.escrow + calc.pmiMonthly,
                2,
              )}`,
            ],
            result: money.exact(calc.monthlyTotal),
          },
          {
            label: 'Total interest paid',
            general: 'Interest = Σ (balance × i) over every payment',
            steps: [
              `${calc.active.monthsToPayoff} payments of ${money.exact(
                calc.base.monthlyPayment,
              )}${calc.extra > 0 ? ` + ${money.exact(calc.extra)} extra` : ''}`,
              `total paid ${money.exact(calc.active.totalPaid)} − principal ${money.exact(calc.loan)}`,
            ],
            result: money.exact(calc.active.totalInterest),
          },
        ]}
        note="PMI is estimated as a fixed annual percentage of the original loan amount and is dropped once the balance falls below 80% of the purchase price."
      />

      <ToolPanel
        title="Amortisation schedule"
        description="Every payment, split into interest and principal, with the remaining balance."
      >
        <AmortizationSection
          result={calc.active}
          currency={currency}
          filename="mortgage-amortization-schedule.csv"
          showExtra={calc.extra > 0}
        />
      </ToolPanel>

      <Assumptions
        items={[
          'A fixed interest rate for the whole term, compounded monthly, with payments made on the same day each month.',
          'Property tax, insurance and HOA are held flat in today’s money; in reality they usually rise each year.',
          'PMI is dropped at 80% loan-to-value based on the purchase price, the point at which you can ask a conventional US lender to cancel it; it ends automatically at 78%. Lenders may use an appraised value instead.',
          'Closing costs, points, prepayment penalties and mortgage interest tax relief are not included.',
          'Extra payments are applied to principal immediately, in the same month they are made.',
        ]}
      />
    </div>
  )
}
