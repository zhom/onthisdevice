import { useMemo, useState } from 'react'

import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatNumber } from '@/components/tools/finance/format'

import {
  addMonths,
  aggregateByYear,
  buildSchedule,
  csvMoney,
  formatLongDate,
  formatMonths,
  formatMonthYear,
  isoDate,
  levelPayment,
  toPositive,
} from './calc-money-core'
import type { CmScheduleRow, CmYearRow } from './calc-money-core'
import {
  CmAssumptions,
  CmBreakdown,
  CmCurrencySelect,
  CmDataTable,
  CmExportBar,
  CmField,
  CmFieldGrid,
  CmLineChart,
  CmStat,
  CmWorking,
  useCmToday,
  useMoney,
} from './calc-money-ui'
import type { CmColumn, CmSeries } from './calc-money-ui'

function monthInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function CalcMoneyAmortization() {
  const today = useCmToday()
  const [currency, setCurrency] = useState('USD')
  const money = useMoney(currency)

  const [amount, setAmount] = useState('320000')
  const [rate, setRate] = useState('6.25')
  const [years, setYears] = useState('30')
  const [startMonth, setStartMonth] = useState('')

  const [extraMonthly, setExtraMonthly] = useState('0')
  const [extraYearly, setExtraYearly] = useState('0')
  const [lumpAmount, setLumpAmount] = useState('0')
  const [lumpMonth, setLumpMonth] = useState('12')

  const calc = useMemo(() => {
    const principal = toPositive(amount)
    const ratePct = Math.max(0, toPositive(rate))
    const termYears = Math.max(0.5, Math.min(50, toPositive(years, 30) || 30))
    const months = Math.max(1, Math.round(termYears * 12))

    const [y, m] = startMonth.split('-')
    const parsedYear = Number(y)
    const parsedMonth = Number(m)
    const firstPaymentDate =
      Number.isFinite(parsedYear) && Number.isFinite(parsedMonth) && parsedYear > 1900
        ? new Date(parsedYear, parsedMonth - 1, 1)
        : addMonths(today, 1)

    const base = buildSchedule({ principal, annualRatePct: ratePct, months, firstPaymentDate })
    const extraM = toPositive(extraMonthly)
    const extraY = toPositive(extraYearly)
    const lumpAmt = toPositive(lumpAmount)
    const lumpN = Math.max(1, Math.round(toPositive(lumpMonth, 1) || 1))
    const hasExtra = extraM > 0 || extraY > 0 || lumpAmt > 0

    const active = hasExtra
      ? buildSchedule({
          principal,
          annualRatePct: ratePct,
          months,
          firstPaymentDate,
          extraMonthly: extraM,
          extraYearly: extraY,
          lumpSums: lumpAmt > 0 ? [{ month: lumpN, amount: lumpAmt }] : [],
        })
      : base

    return {
      principal,
      ratePct,
      termYears,
      months,
      firstPaymentDate,
      base,
      active,
      hasExtra,
      extraM,
      extraY,
      lumpAmt,
      lumpN,
      i: ratePct / 100 / 12,
      interestSaved: base.totalInterest - active.totalInterest,
      monthsSaved: base.monthsToPayoff - active.monthsToPayoff,
    }
  }, [amount, rate, years, startMonth, extraMonthly, extraYearly, lumpAmount, lumpMonth, today])

  const yearRows = useMemo(() => aggregateByYear(calc.active.rows), [calc.active.rows])

  const amountError =
    calc.principal <= 0 ? 'Enter a loan amount greater than zero to build a schedule.' : undefined
  const neverError = calc.active.neverAmortises
    ? 'At this rate the payment does not cover the monthly interest, so the balance never falls. Increase the term or lower the rate.'
    : undefined

  const monthlyColumns: CmColumn<CmScheduleRow>[] = [
    { key: 'n', header: '#', render: (r) => r.n },
    { key: 'date', header: 'Date', render: (r) => formatMonthYear(r.date) },
    { key: 'payment', header: 'Payment', align: 'right', render: (r) => money.exact(r.payment) },
    { key: 'principal', header: 'Principal', align: 'right', render: (r) => money.exact(r.principal) },
    { key: 'interest', header: 'Interest', align: 'right', render: (r) => money.exact(r.interest) },
    ...(calc.hasExtra
      ? [
          {
            key: 'extra',
            header: 'Extra',
            align: 'right' as const,
            render: (r: CmScheduleRow) => (r.extra > 0 ? money.exact(r.extra) : '–'),
          },
        ]
      : []),
    {
      key: 'cum',
      header: 'Interest to date',
      align: 'right',
      hideOnMobile: true,
      render: (r) => money.exact(r.cumInterest),
    },
    { key: 'balance', header: 'Balance', align: 'right', render: (r) => money.exact(r.balance) },
  ]

  const yearColumns: CmColumn<CmYearRow>[] = [
    { key: 'year', header: 'Year', render: (r) => r.year },
    { key: 'payments', header: 'Payments', align: 'right', hideOnMobile: true, render: (r) => r.payments },
    { key: 'principal', header: 'Principal', align: 'right', render: (r) => money.exact(r.principal) },
    { key: 'interest', header: 'Interest', align: 'right', render: (r) => money.exact(r.interest) },
    ...(calc.hasExtra
      ? [
          {
            key: 'extra',
            header: 'Extra',
            align: 'right' as const,
            render: (r: CmYearRow) => (r.extra > 0 ? money.exact(r.extra) : '–'),
          },
        ]
      : []),
    { key: 'end', header: 'Ending balance', align: 'right', render: (r) => money.exact(r.endingBalance) },
  ]

  const exportSpec = useMemo(() => {
    const monthHeaders = [
      '#',
      'Date',
      'Payment',
      'Principal',
      'Interest',
      'Extra',
      'Interest to date',
      'Balance',
    ]
    return {
      filename: 'amortization-schedule',
      title: 'Amortization schedule',
      subtitle: `${money.exact(calc.principal)} at ${calc.ratePct}% over ${formatMonths(
        calc.months,
      )} · first payment ${formatLongDate(calc.firstPaymentDate)}`,
      tables: [
        {
          name: 'Monthly schedule',
          headers: monthHeaders,
          aligns: ['left', 'left', 'right', 'right', 'right', 'right', 'right', 'right'] as (
            | 'left'
            | 'right'
          )[],
          rows: calc.active.rows.map((r) => [
            r.n,
            isoDate(r.date),
            csvMoney(r.payment),
            csvMoney(r.principal),
            csvMoney(r.interest),
            csvMoney(r.extra),
            csvMoney(r.cumInterest),
            csvMoney(r.balance),
          ]),
        },
        {
          name: 'Yearly totals',
          headers: ['Year', 'Payments', 'Principal', 'Interest', 'Extra', 'Ending balance'],
          aligns: ['left', 'right', 'right', 'right', 'right', 'right'] as ('left' | 'right')[],
          rows: yearRows.map((r) => [
            r.year,
            r.payments,
            csvMoney(r.principal),
            csvMoney(r.interest),
            csvMoney(r.extra),
            csvMoney(r.endingBalance),
          ]),
        },
      ],
      notes: [
        `Loan ${csvMoney(calc.principal)} ${currency}, nominal annual rate ${calc.ratePct}% compounded monthly, ${calc.months} scheduled payments.`,
        'Interest is charged on the opening balance each month and rounded to the minor unit; the final instalment absorbs the rounding difference.',
        calc.hasExtra
          ? `Overpayments included: ${csvMoney(calc.extraM)} monthly, ${csvMoney(
              calc.extraY,
            )} every twelfth payment, ${csvMoney(calc.lumpAmt)} once at payment ${calc.lumpN}.`
          : 'No overpayments were included in this schedule.',
        'Fees, insurance, escrow and taxes are not part of an amortization schedule and are excluded.',
      ],
    }
  }, [calc, currency, money, yearRows])

  const chartSeries = useMemo(() => {
    const toPoints = (rows: CmScheduleRow[]) => [
      { x: 0, y: calc.principal },
      ...rows.map((r) => ({ x: r.n, y: r.balance })),
    ]
    const series: CmSeries[] = [
      { label: 'Scheduled balance', token: 'chart-1', points: toPoints(calc.base.rows), fill: true },
    ]
    if (calc.hasExtra) {
      series.push({
        label: 'With overpayments',
        token: 'chart-3',
        dashed: true,
        points: toPoints(calc.active.rows),
        fill: false,
      })
    }
    return series
  }, [calc])

  const crossover = calc.base.rows.findIndex((r) => r.principal > r.interest) + 1

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ToolPanel
            title="Loan"
            description="Everything recalculates as you type. Nothing is sent anywhere."
          >
            <CmFieldGrid columns={2}>
              <CmField
                id="am-amount"
                label="Loan amount"
                value={amount}
                onChange={setAmount}
                prefix={money.symbol}
                invalid={amountError}
              />
              <CmCurrencySelect value={currency} onChange={setCurrency} id="am-currency" />
              <CmField
                id="am-rate"
                label="Interest rate"
                value={rate}
                onChange={setRate}
                suffix="%"
                hint="nominal, per year"
                slider={{ min: 0, max: 20, step: 0.05 }}
              />
              <CmField
                id="am-years"
                label="Term"
                value={years}
                onChange={setYears}
                suffix="yrs"
                hint={`${calc.months} payments`}
                slider={{ min: 1, max: 40, step: 1 }}
              />
              <CmField
                id="am-start"
                label="First payment"
                type="month"
                value={startMonth || monthInputValue(addMonths(today, 1))}
                onChange={setStartMonth}
                className="sm:col-span-2"
              />
            </CmFieldGrid>
          </ToolPanel>

          <ToolPanel
            title="Overpayments"
            description="Optional. Every extra unit of principal cancels all the future interest it would have carried."
          >
            <CmFieldGrid columns={2}>
              <CmField
                id="am-extra-m"
                label="Extra every month"
                value={extraMonthly}
                onChange={setExtraMonthly}
                prefix={money.symbol}
              />
              <CmField
                id="am-extra-y"
                label="Extra every year"
                value={extraYearly}
                onChange={setExtraYearly}
                prefix={money.symbol}
                hint="applied on payment 12, 24, …"
              />
              <CmField
                id="am-lump"
                label="One-off lump sum"
                value={lumpAmount}
                onChange={setLumpAmount}
                prefix={money.symbol}
              />
              <CmField
                id="am-lump-n"
                label="Lump sum at payment #"
                value={lumpMonth}
                onChange={setLumpMonth}
                hint={`of ${calc.months}`}
              />
            </CmFieldGrid>
          </ToolPanel>
        </div>

        <div className="space-y-6">
          {amountError || neverError ? <ErrorNote message={neverError ?? amountError ?? ''} /> : null}

          <ToolPanel title="Result">
            <ResultStat
              label="Monthly payment"
              value={money.exact(calc.base.monthlyPayment)}
              hint="principal and interest only"
              emphasis
            />
            <div className="grid grid-cols-2 gap-3">
              <CmStat label="Total interest" value={money.exact(calc.active.totalInterest)} />
              <CmStat
                label="Total repaid"
                value={money.exact(calc.active.totalPaid)}
                hint="principal + interest"
              />
              <CmStat
                label="Payoff date"
                value={
                  calc.active.rows.length > 0 ? formatLongDate(calc.active.payoffDate) : '–'
                }
                hint={formatMonths(calc.active.monthsToPayoff)}
              />
              <CmStat
                label="Interest as % of loan"
                value={
                  calc.principal > 0
                    ? `${((calc.active.totalInterest / calc.principal) * 100).toFixed(1)}%`
                    : '–'
                }
                hint="of the amount borrowed"
              />
            </div>

            {calc.hasExtra ? (
              <div className="grid grid-cols-2 gap-3">
                <CmStat
                  label="Interest saved"
                  value={money.exact(calc.interestSaved)}
                  tone="positive"
                  hint="versus the scheduled plan"
                />
                <CmStat
                  label="Time saved"
                  value={formatMonths(calc.monthsSaved)}
                  tone="positive"
                  hint={`${calc.active.monthsToPayoff} payments instead of ${calc.base.monthsToPayoff}`}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add an overpayment on the left to see how much interest disappears and how many
                payments come off the end of the loan.
              </p>
            )}

            <CmBreakdown
              format={money.exact}
              items={[
                { label: 'Principal', value: calc.principal, token: 'chart-1' },
                { label: 'Interest', value: calc.active.totalInterest, token: 'chart-4' },
              ]}
              caption="Split of everything you will hand over across the whole loan."
            />
          </ToolPanel>
        </div>
      </div>

      <ToolPanel
        title="Balance over time"
        description="Early payments are almost all interest. This curve shows it."
      >
        <CmLineChart
          ariaLabel="Remaining loan balance by payment number"
          series={chartSeries}
          xFormat={(x) => `${Math.round(x / 12)}y`}
          yFormat={(v) => money.compact(v)}
          caption={
            crossover > 0
              ? `Crossover: principal first exceeds interest at payment ${crossover} of ${calc.base.rows.length}.`
              : undefined
          }
        />
      </ToolPanel>

      <CmWorking
        items={[
          {
            label: 'Monthly payment',
            general: 'M = P × i / (1 − (1 + i)^−n)',
            steps: [
              `i = ${calc.ratePct}% ÷ 12 = ${calc.i.toFixed(8)}`,
              `n = ${calc.termYears} × 12 = ${calc.months}`,
              `M = ${formatNumber(calc.principal, 2)} × ${calc.i.toFixed(8)} ÷ (1 − ${(
                1 + calc.i
              ).toFixed(8)}^−${calc.months})`,
            ],
            result: money.exact(
              levelPayment(calc.principal, calc.ratePct, calc.months).toNumber(),
            ),
          },
          {
            label: 'First payment split',
            general: 'Interest₁ = balance × i, Principal₁ = M − Interest₁',
            steps: [
              `Interest₁ = ${formatNumber(calc.principal, 2)} × ${calc.i.toFixed(8)} = ${money.exact(
                calc.base.rows[0]?.interest ?? 0,
              )}`,
              `Principal₁ = ${money.exact(calc.base.monthlyPayment)} − ${money.exact(
                calc.base.rows[0]?.interest ?? 0,
              )}`,
            ],
            result: money.exact(calc.base.rows[0]?.principal ?? 0),
          },
          {
            label: 'Total interest',
            general: 'Interest = Σ (opening balance × i) over every payment',
            steps: [
              `total repaid ${money.exact(calc.active.totalPaid)} − principal ${money.exact(
                calc.principal,
              )}`,
            ],
            result: money.exact(calc.active.totalInterest),
          },
        ]}
        note="Every figure on this page is computed with 40-digit decimal arithmetic and rounded once, at the end, the way a loan servicer rounds."
      />

      <ToolPanel
        title="Full schedule"
        description="Every payment split into interest and principal, with the running balance."
        footer={<CmExportBar spec={exportSpec} />}
      >
        <Tabs defaultValue="monthly">
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>
          <TabsContent value="monthly" className="mt-4">
            <CmDataTable
              ariaLabel="Monthly amortization schedule"
              columns={monthlyColumns}
              rows={calc.active.rows}
              pageSize={12}
              minWidth={620}
            />
          </TabsContent>
          <TabsContent value="yearly" className="mt-4">
            <CmDataTable
              ariaLabel="Amortization totals by calendar year"
              columns={yearColumns}
              rows={yearRows}
              pageSize={15}
              minWidth={520}
            />
          </TabsContent>
        </Tabs>
      </ToolPanel>

      <CmAssumptions
        items={[
          'A fixed nominal rate compounded monthly, with equal payments made on the same day each month.',
          'Interest accrues on the opening balance rather than daily, which is how most fixed-rate mortgages and instalment loans are serviced. Loans that accrue daily will differ by a few units of currency over the term.',
          'Overpayments are applied to principal in the month they are made, with no prepayment penalty. Check your loan agreement: some lenders hold extra money as a prepaid instalment instead.',
          'Property tax, insurance, PMI and arrangement fees are outside the amortization and are not included in the totals.',
          'The last instalment is adjusted so the balance lands exactly on zero, matching normal servicer practice.',
        ]}
      />
    </div>
  )
}
