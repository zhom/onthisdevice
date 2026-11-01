import { useEffect, useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/components/tools/finance/format'

import { DonutChart } from './charts'
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
import { addMonths, buildAmortization, formatLongDate, formatMonths, toPositive } from './money'
import { AmortizationSection } from './schedule'

function monthValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function CarLoanCalculator() {
  const today = useToday()
  const [currency, setCurrency] = useLocalStorage('otd:finance:currency', 'USD')
  const money = useMoney(currency)

  const [price, setPrice] = useState('32000')
  const [tradeInValue, setTradeInValue] = useState('6000')
  const [tradeInOwed, setTradeInOwed] = useState('0')
  const [downPayment, setDownPayment] = useState('3000')
  const [taxRate, setTaxRate] = useState('6.5')
  const [taxCreditOnTradeIn, setTaxCreditOnTradeIn] = useState(true)
  const [fees, setFees] = useState('750')
  const [rollFees, setRollFees] = useState(true)
  const [rate, setRate] = useState('7.2')
  const [termMonths, setTermMonths] = useState('60')
  const [firstPayment, setFirstPayment] = useState('')

  useEffect(() => {
    setFirstPayment(monthValue(addMonths(today, 1)))
  }, [today])

  const calc = useMemo(() => {
    const priceN = toPositive(price)
    const tradeIn = toPositive(tradeInValue)
    const owed = toPositive(tradeInOwed)
    const down = toPositive(downPayment)
    const taxPct = Math.max(0, toPositive(taxRate))
    const feesN = toPositive(fees)
    const rateN = Math.max(0, toPositive(rate))
    const months = Math.max(1, Math.min(180, Math.round(toPositive(termMonths, 60)) || 60))

    const taxableBase = Math.max(0, taxCreditOnTradeIn ? priceN - tradeIn : priceN)
    const salesTax = (taxableBase * taxPct) / 100
    const netTradeIn = tradeIn - owed
    const outTheDoor = priceN + salesTax + feesN

    const financedBeforeFees = outTheDoor - (rollFees ? 0 : feesN) - down - netTradeIn
    const amountFinanced = Math.max(0, financedBeforeFees)
    const cashAtSigning = down + (rollFees ? 0 : feesN)

    const parts = firstPayment.split('-')
    const y = Number(parts[0])
    const m = Number(parts[1])
    const firstDate =
      Number.isFinite(y) && Number.isFinite(m) && y > 1900 ? new Date(y, m - 1, 1) : addMonths(today, 1)

    const schedule = buildAmortization({
      principal: amountFinanced,
      annualRatePct: rateN,
      months,
      startDate: addMonths(firstDate, -1),
    })

    const totalCostOfBorrowing = schedule.totalInterest
    const totalCashOutlay = cashAtSigning + schedule.totalPaid
    const trueCarCost = totalCashOutlay + tradeIn - owed
    const negativeEquity = netTradeIn < 0

    return {
      priceN,
      tradeIn,
      owed,
      down,
      taxPct,
      feesN,
      rateN,
      months,
      taxableBase,
      salesTax,
      netTradeIn,
      outTheDoor,
      amountFinanced,
      cashAtSigning,
      schedule,
      totalCostOfBorrowing,
      totalCashOutlay,
      trueCarCost,
      negativeEquity,
      i: rateN / 100 / 12,
    }
  }, [
    price,
    tradeInValue,
    tradeInOwed,
    downPayment,
    taxRate,
    taxCreditOnTradeIn,
    fees,
    rollFees,
    rate,
    termMonths,
    firstPayment,
    today,
  ])

  const priceInvalid = calc.priceN <= 0 ? 'Enter a vehicle price greater than zero.' : undefined
  const nothingFinanced =
    calc.priceN > 0 && calc.amountFinanced <= 0
      ? 'Your down payment and trade-in already cover the out-the-door price, so there is nothing to finance.'
      : undefined

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ToolPanel title="The deal" description="Enter the numbers from the dealer’s worksheet.">
            <div className="space-y-5">
              <FieldGroup columns={2}>
                <Field
                  id="car-price"
                  label="Vehicle price"
                  value={price}
                  onChange={setPrice}
                  prefix={money.symbol}
                  hint="negotiated, before tax"
                  invalid={priceInvalid}
                />
                <CurrencySelect value={currency} onChange={setCurrency} id="car-currency" />
                <Field
                  id="car-trade"
                  label="Trade-in value"
                  value={tradeInValue}
                  onChange={setTradeInValue}
                  prefix={money.symbol}
                />
                <Field
                  id="car-owed"
                  label="Still owed on trade-in"
                  value={tradeInOwed}
                  onChange={setTradeInOwed}
                  prefix={money.symbol}
                  hint={calc.negativeEquity ? 'negative equity' : 'loan payoff'}
                />
                <Field
                  id="car-down"
                  label="Cash down payment"
                  value={downPayment}
                  onChange={setDownPayment}
                  prefix={money.symbol}
                />
                <Field
                  id="car-fees"
                  label="Fees (title, registration, doc)"
                  value={fees}
                  onChange={setFees}
                  prefix={money.symbol}
                />
              </FieldGroup>

              <FieldGroup columns={2}>
                <Field
                  id="car-tax"
                  label="Sales tax rate"
                  value={taxRate}
                  onChange={setTaxRate}
                  suffix="%"
                  hint={money.exact(calc.salesTax)}
                  slider={{ min: 0, max: 15, step: 0.1 }}
                />
                <Field
                  id="car-rate"
                  label="APR"
                  value={rate}
                  onChange={setRate}
                  suffix="%"
                  slider={{ min: 0, max: 25, step: 0.05 }}
                />
                <Field
                  id="car-term"
                  label="Loan term"
                  value={termMonths}
                  onChange={setTermMonths}
                  suffix="mo"
                  hint={formatMonths(calc.months)}
                  slider={{ min: 12, max: 96, step: 6 }}
                />
                <div className="space-y-1.5">
                  <Label htmlFor="car-first" className="text-sm">
                    First payment
                  </Label>
                  <Input
                    id="car-first"
                    type="month"
                    value={firstPayment}
                    onChange={(e) => setFirstPayment(e.target.value)}
                    className="tabular-nums"
                  />
                </div>
              </FieldGroup>

              <div className="space-y-3 rounded-lg bg-muted px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <Label htmlFor="car-tax-credit" className="text-sm font-normal leading-snug">
                    Sales tax charged on price minus trade-in
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Most US states give this credit; a few tax the full price.
                    </span>
                  </Label>
                  <Switch
                    id="car-tax-credit"
                    checked={taxCreditOnTradeIn}
                    onCheckedChange={setTaxCreditOnTradeIn}
                  />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <Label htmlFor="car-roll-fees" className="text-sm font-normal leading-snug">
                    Roll fees into the loan
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Turn off to pay title, registration and doc fees in cash at signing.
                    </span>
                  </Label>
                  <Switch id="car-roll-fees" checked={rollFees} onCheckedChange={setRollFees} />
                </div>
              </div>
            </div>
          </ToolPanel>
        </div>

        <div className="space-y-6">
          {priceInvalid ? <ErrorNote message={priceInvalid} /> : null}
          {nothingFinanced ? <ErrorNote message={nothingFinanced} /> : null}
          {calc.negativeEquity ? (
            <ErrorNote
              message={`You owe ${money.exact(
                calc.owed - calc.tradeIn,
              )} more on your trade-in than it is worth. That negative equity is rolled into the new loan, so you start the new car underwater.`}
            />
          ) : null}

          <ToolPanel title="Your payment">
            <div className="space-y-5">
              <ResultStat
                label="Monthly payment"
                value={money.exact(calc.schedule.monthlyPayment)}
                hint={`${calc.months} payments at ${formatNumber(calc.rateN, 2)}% APR`}
                emphasis
              />
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label="Amount financed"
                  value={money.exact(calc.amountFinanced)}
                  hint="what the lender actually lends"
                />
                <MiniStat label="Sales tax" value={money.exact(calc.salesTax)} hint={`${calc.taxPct}% of ${money.round(calc.taxableBase)}`} />
                <MiniStat
                  label="Total cost of borrowing"
                  value={money.exact(calc.totalCostOfBorrowing)}
                  hint="interest only"
                  tone={calc.totalCostOfBorrowing > 0 ? 'negative' : 'default'}
                />
                <MiniStat label="Out-the-door price" value={money.exact(calc.outTheDoor)} hint="price + tax + fees" />
                <MiniStat label="Cash at signing" value={money.exact(calc.cashAtSigning)} />
                <MiniStat
                  label="Loan paid off"
                  value={formatLongDate(calc.schedule.payoffDate)}
                  hint={formatMonths(calc.schedule.monthsToPayoff)}
                />
              </div>
            </div>
          </ToolPanel>

          <ToolPanel title="Where the money goes">
            <div className="space-y-5">
              <DonutChart
                ariaLabel="Composition of the out-the-door price"
                centerLabel="out the door"
                centerValue={money.round(calc.outTheDoor)}
                slices={[
                  { label: 'Vehicle price', value: calc.priceN, token: 'chart-1' },
                  { label: 'Sales tax', value: calc.salesTax, token: 'chart-3' },
                  { label: 'Fees', value: calc.feesN, token: 'chart-4' },
                ]}
              />
              <Breakdown
                currency={currency}
                caption="Total cash you will part with, from signing to the final payment."
                items={[
                  { label: 'Cash at signing', value: calc.cashAtSigning, token: 'chart-2' },
                  { label: 'Principal repaid', value: calc.amountFinanced, token: 'chart-1' },
                  { label: 'Interest', value: calc.schedule.totalInterest, token: 'chart-4' },
                ]}
              />
              <p className="text-sm text-muted-foreground">
                Including the {money.exact(calc.tradeIn)} of value you gave up in the trade-in, this
                car costs you {money.exact(calc.trueCarCost)} in total.
              </p>
            </div>
          </ToolPanel>
        </div>
      </div>

      <Formula
        items={[
          {
            label: 'Sales tax',
            general: taxCreditOnTradeIn
              ? 'Tax = (price − trade-in) × rate'
              : 'Tax = price × rate',
            steps: [
              `Tax = ${formatNumber(calc.taxableBase, 2)} × ${calc.taxPct}%`,
            ],
            result: money.exact(calc.salesTax),
          },
          {
            label: 'Amount financed',
            general: 'Financed = price + tax + fees − down payment − net trade-in',
            steps: [
              `net trade-in = ${formatNumber(calc.tradeIn, 2)} − ${formatNumber(calc.owed, 2)} = ${formatNumber(
                calc.netTradeIn,
                2,
              )}`,
              `Financed = ${formatNumber(calc.priceN, 2)} + ${formatNumber(calc.salesTax, 2)} + ${formatNumber(
                rollFees ? calc.feesN : 0,
                2,
              )} − ${formatNumber(calc.down, 2)} − ${formatNumber(calc.netTradeIn, 2)}`,
            ],
            result: money.exact(calc.amountFinanced),
          },
          {
            label: 'Monthly payment',
            general: 'M = P × i / (1 − (1 + i)^−n)',
            steps: [
              `i = ${calc.rateN}% ÷ 12 = ${calc.i.toFixed(8)}`,
              `n = ${calc.months}`,
              `M = ${formatNumber(calc.amountFinanced, 2)} × ${calc.i.toFixed(8)} ÷ (1 − ${(
                1 + calc.i
              ).toFixed(8)}^−${calc.months})`,
            ],
            result: money.exact(calc.schedule.monthlyPayment),
          },
          {
            label: 'Total cost of borrowing',
            general: 'Interest = (M × n) − Financed',
            steps: [
              `Interest = ${formatNumber(calc.schedule.monthlyPayment, 2)} × ${calc.months} − ${formatNumber(
                calc.amountFinanced,
                2,
              )}`,
            ],
            result: money.exact(calc.schedule.totalInterest),
          },
        ]}
        note="Sales tax rules vary by state and country. The trade-in tax credit switch covers the biggest difference; check your local rate before relying on the tax figure."
      />

      <ToolPanel
        title="Payment schedule"
        description="Interest is front-loaded, which is why a 7-year car loan can leave you underwater for years."
      >
        <AmortizationSection
          result={calc.schedule}
          currency={currency}
          filename="car-loan-schedule.csv"
          showExtra={false}
        />
      </ToolPanel>

      <Assumptions
        items={[
          'A simple-interest car loan at a fixed APR with equal monthly payments. This is the standard structure in the US, Canada, the UK and Australia.',
          'Sales tax is applied once at purchase, not to each payment (which is how some leases work).',
          'Depreciation, insurance, fuel, maintenance and extended warranties are not included in the payment.',
          'Dealer add-ons such as gap insurance or paint protection should be entered in the fees field if they are financed.',
        ]}
      />
    </div>
  )
}
