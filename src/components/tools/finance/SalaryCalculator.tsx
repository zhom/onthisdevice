import { useMemo, useState } from 'react'

import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/components/tools/finance/format'

import {
  Assumptions,
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
import { csvMoney, d, toNum, toPositive } from './money'

type Period = 'hour' | 'day' | 'week' | 'biweek' | 'semimonth' | 'month' | 'quarter' | 'year'
type RaiseMode = 'percent' | 'amount'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'hour', label: 'per hour' },
  { value: 'day', label: 'per day' },
  { value: 'week', label: 'per week' },
  { value: 'biweek', label: 'every two weeks' },
  { value: 'semimonth', label: 'twice a month' },
  { value: 'month', label: 'per month' },
  { value: 'quarter', label: 'per quarter' },
  { value: 'year', label: 'per year' },
]

/** Periods whose annual total scales with the number of weeks worked. */
const WEEK_BASED: Period[] = ['hour', 'day', 'week']

interface PayRow {
  label: string
  unadjusted: number
  adjusted: number
}

interface RaiseRow {
  label: string
  now: number
  after: number
  increase: number
}

export default function SalaryCalculator() {
  const [currency, setCurrency] = useLocalStorage('otd:finance:currency', 'USD')
  const money = useMoney(currency)

  const [amount, setAmount] = useState('32')
  const [period, setPeriod] = useState<Period>('hour')
  const [hoursPerWeek, setHoursPerWeek] = useState('40')
  const [daysPerWeek, setDaysPerWeek] = useState('5')
  const [weeksPerYear, setWeeksPerYear] = useState('52')
  const [holidays, setHolidays] = useState('10')
  const [vacationDays, setVacationDays] = useState('15')

  const [raiseMode, setRaiseMode] = useState<RaiseMode>('percent')
  const [raisePercent, setRaisePercent] = useState('4')
  const [raiseAmount, setRaiseAmount] = useState('3000')

  const calc = useMemo(() => {
    const amt = toPositive(amount)
    const hpw = toPositive(hoursPerWeek, 40)
    const dpw = Math.max(0.5, Math.min(7, toPositive(daysPerWeek, 5)))
    const wpy = Math.max(1, Math.min(53, toPositive(weeksPerYear, 52)))
    const offDays = toPositive(holidays) + toPositive(vacationDays)
    const adjustedWeeks = Math.max(0.1, wpy - offDays / dpw)
    const hoursPerDay = hpw / dpw

    const error =
      hpw <= 0
        ? 'Enter the number of hours you work each week.'
        : amt <= 0
          ? 'Enter a pay amount greater than zero.'
          : undefined

    const annualFrom = (weeks: number): number => {
      switch (period) {
        case 'hour':
          return d(amt).times(hpw).times(weeks).toNumber()
        case 'day':
          return d(amt).times(dpw).times(weeks).toNumber()
        case 'week':
          return d(amt).times(weeks).toNumber()
        case 'biweek':
          return d(amt).times(26).toNumber()
        case 'semimonth':
          return d(amt).times(24).toNumber()
        case 'month':
          return d(amt).times(12).toNumber()
        case 'quarter':
          return d(amt).times(4).toNumber()
        default:
          return amt
      }
    }

    const annualUnadjusted = annualFrom(wpy)
    // Unpaid days cut a salary in proportion to the weeks actually worked.
    const annualAdjusted = WEEK_BASED.includes(period)
      ? annualFrom(adjustedWeeks)
      : (annualUnadjusted * adjustedWeeks) / wpy

    const derive = (annual: number, weeks: number) => {
      const hours = hpw * weeks
      const hourly = hours > 0 ? annual / hours : 0
      return {
        hour: hourly,
        day: hourly * hoursPerDay,
        week: weeks > 0 ? annual / weeks : 0,
        biweek: annual / 26,
        semimonth: annual / 24,
        month: annual / 12,
        quarter: annual / 4,
        year: annual,
        hours,
      }
    }

    const unadj = derive(annualUnadjusted, wpy)
    const adj = derive(annualAdjusted, adjustedWeeks)

    const rows: PayRow[] = [
      { label: 'Hourly', unadjusted: unadj.hour, adjusted: adj.hour },
      { label: 'Daily', unadjusted: unadj.day, adjusted: adj.day },
      { label: 'Weekly', unadjusted: unadj.week, adjusted: adj.week },
      { label: 'Bi-weekly (26 / yr)', unadjusted: unadj.biweek, adjusted: adj.biweek },
      { label: 'Semi-monthly (24 / yr)', unadjusted: unadj.semimonth, adjusted: adj.semimonth },
      { label: 'Monthly', unadjusted: unadj.month, adjusted: adj.month },
      { label: 'Quarterly', unadjusted: unadj.quarter, adjusted: adj.quarter },
      { label: 'Annual', unadjusted: unadj.year, adjusted: adj.year },
    ]

    const raisePct =
      raiseMode === 'percent'
        ? toNum(raisePercent) / 100
        : annualUnadjusted > 0
          ? toNum(raiseAmount) / annualUnadjusted
          : 0
    const newAnnual = annualUnadjusted * (1 + raisePct)
    const newUnadj = derive(newAnnual, wpy)

    const raiseRows: RaiseRow[] = [
      { label: 'Hourly', now: unadj.hour, after: newUnadj.hour, increase: newUnadj.hour - unadj.hour },
      { label: 'Weekly', now: unadj.week, after: newUnadj.week, increase: newUnadj.week - unadj.week },
      {
        label: 'Bi-weekly',
        now: unadj.biweek,
        after: newUnadj.biweek,
        increase: newUnadj.biweek - unadj.biweek,
      },
      {
        label: 'Monthly',
        now: unadj.month,
        after: newUnadj.month,
        increase: newUnadj.month - unadj.month,
      },
      { label: 'Annual', now: unadj.year, after: newUnadj.year, increase: newUnadj.year - unadj.year },
    ]

    return {
      amt,
      hpw,
      dpw,
      wpy,
      offDays,
      adjustedWeeks,
      hoursPerDay,
      annualUnadjusted,
      annualAdjusted,
      unadj,
      adj,
      rows,
      raisePct,
      newAnnual,
      raiseRows,
      error,
    }
  }, [
    amount,
    period,
    hoursPerWeek,
    daysPerWeek,
    weeksPerYear,
    holidays,
    vacationDays,
    raiseMode,
    raisePercent,
    raiseAmount,
  ])

  const payColumns: Column<PayRow>[] = [
    { key: 'label', header: 'Period', render: (r) => r.label },
    {
      key: 'unadjusted',
      header: 'Unadjusted',
      align: 'right',
      render: (r) => money.exact(r.unadjusted),
    },
    {
      key: 'adjusted',
      header: 'Holidays & leave unpaid',
      align: 'right',
      render: (r) => money.exact(r.adjusted),
    },
  ]

  const raiseColumns: Column<RaiseRow>[] = [
    { key: 'label', header: 'Period', render: (r) => r.label },
    { key: 'now', header: 'Now', align: 'right', render: (r) => money.exact(r.now) },
    { key: 'after', header: 'After the raise', align: 'right', render: (r) => money.exact(r.after) },
    {
      key: 'increase',
      header: 'Increase',
      align: 'right',
      render: (r) => (
        <span className={r.increase >= 0 ? 'text-success' : 'text-destructive'}>
          {r.increase >= 0 ? '+' : '−'}
          {money.exact(Math.abs(r.increase))}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ToolPanel
          title="Your pay"
          description="Enter what you know. The other figures update as you type."
        >
          <div className="space-y-5">
            <FieldGroup columns={2}>
              <Field
                id="sal-amount"
                label="Pay amount"
                value={amount}
                onChange={setAmount}
                prefix={money.symbol}
              />
              <SelectField
                id="sal-period"
                label="Paid"
                value={period}
                onChange={(v) => setPeriod(v as Period)}
                options={PERIOD_OPTIONS}
              />
              <Field
                id="sal-hours"
                label="Hours per week"
                value={hoursPerWeek}
                onChange={setHoursPerWeek}
                suffix="hrs"
                slider={{ min: 1, max: 80, step: 0.5 }}
              />
              <Field
                id="sal-days"
                label="Days per week"
                value={daysPerWeek}
                onChange={setDaysPerWeek}
                suffix="days"
                hint={`${formatNumber(calc.hoursPerDay, 2)} hrs/day`}
                slider={{ min: 1, max: 7, step: 0.5 }}
              />
              <Field
                id="sal-weeks"
                label="Weeks per year"
                value={weeksPerYear}
                onChange={setWeeksPerYear}
                suffix="wks"
                slider={{ min: 1, max: 52, step: 1 }}
              />
              <CurrencySelect value={currency} onChange={setCurrency} id="sal-currency" />
              <Field
                id="sal-holidays"
                label="Public holidays"
                value={holidays}
                onChange={setHolidays}
                suffix="days"
              />
              <Field
                id="sal-vacation"
                label="Vacation / leave"
                value={vacationDays}
                onChange={setVacationDays}
                suffix="days"
              />
            </FieldGroup>
            <p className="text-xs text-muted-foreground">
              {calc.offDays} days off works out at {formatNumber(calc.adjustedWeeks, 2)} paid weeks a
              year instead of {formatNumber(calc.wpy, 0)}.
            </p>
          </div>
        </ToolPanel>

        <div className="space-y-6">
          {calc.error ? <ErrorNote message={calc.error} /> : null}

          <ToolPanel title="Equivalent pay">
            <div className="space-y-5">
              <ResultStat
                label="Annual salary"
                value={money.exact(calc.annualUnadjusted)}
                hint={`${money.exact(calc.unadj.hour)} per hour · ${money.exact(
                  calc.unadj.month,
                )} per month`}
                emphasis
              />
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Hourly" value={money.exact(calc.unadj.hour)} />
                <MiniStat label="Daily" value={money.exact(calc.unadj.day)} />
                <MiniStat label="Weekly" value={money.exact(calc.unadj.week)} />
                <MiniStat label="Bi-weekly" value={money.exact(calc.unadj.biweek)} />
                <MiniStat label="Semi-monthly" value={money.exact(calc.unadj.semimonth)} />
                <MiniStat label="Monthly" value={money.exact(calc.unadj.month)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label="Hours worked per year"
                  value={`${formatNumber(calc.unadj.hours, 0)} hrs`}
                />
                <MiniStat
                  label="With unpaid leave"
                  value={money.exact(calc.annualAdjusted)}
                  hint={`${formatNumber(calc.adj.hours, 0)} paid hours`}
                />
              </div>
            </div>
          </ToolPanel>
        </div>
      </div>

      <ToolPanel
        title="Every pay period, side by side"
        description="The right column assumes public holidays and leave are unpaid, which is the reality for most hourly and contract work."
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <CsvButton
              filename="salary-conversion.csv"
              headers={['Period', 'Unadjusted', 'Holidays and leave unpaid']}
              rows={calc.rows.map((r) => [r.label, csvMoney(r.unadjusted), csvMoney(r.adjusted)])}
            />
          </div>
          <DataTable
            columns={payColumns}
            rows={calc.rows}
            pageSize={0}
            ariaLabel="Pay converted to every period"
          />
        </div>
      </ToolPanel>

      <ToolPanel
        title="Raise mode"
        description="See what a percentage raise, or a flat increase, is actually worth in each pay packet."
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-4">
            <Segmented
              label="Raise entry mode"
              value={raiseMode}
              onChange={setRaiseMode}
              options={[
                { value: 'percent', label: 'Percentage' },
                { value: 'amount', label: 'Flat amount' },
              ]}
            />
            <div className="min-w-[12rem] flex-1">
              {raiseMode === 'percent' ? (
                <Field
                  id="sal-raise-pct"
                  label="Raise"
                  value={raisePercent}
                  onChange={setRaisePercent}
                  suffix="%"
                  hint={`${money.exact(calc.newAnnual - calc.annualUnadjusted)} / yr`}
                  slider={{ min: 0, max: 30, step: 0.5 }}
                />
              ) : (
                <Field
                  id="sal-raise-amt"
                  label="Annual increase"
                  value={raiseAmount}
                  onChange={setRaiseAmount}
                  prefix={money.symbol}
                  hint={`${formatNumber(calc.raisePct * 100, 2)}%`}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MiniStat label="New annual salary" value={money.exact(calc.newAnnual)} tone="positive" />
            <MiniStat
              label="Extra per month"
              value={money.exact((calc.newAnnual - calc.annualUnadjusted) / 12)}
            />
            <MiniStat
              label="Extra per hour"
              value={money.exact(
                calc.unadj.hours > 0 ? (calc.newAnnual - calc.annualUnadjusted) / calc.unadj.hours : 0,
              )}
            />
          </div>

          <div className="flex justify-end">
            <CsvButton
              filename="salary-raise.csv"
              headers={['Period', 'Now', 'After the raise', 'Increase']}
              rows={calc.raiseRows.map((r) => [
                r.label,
                csvMoney(r.now),
                csvMoney(r.after),
                csvMoney(r.increase),
              ])}
            />
          </div>
          <DataTable
            columns={raiseColumns}
            rows={calc.raiseRows}
            pageSize={0}
            ariaLabel="Pay before and after the raise"
          />
        </div>
      </ToolPanel>

      <Formula
        items={[
          {
            label: 'Annual salary from your input',
            general:
              period === 'hour'
                ? 'Annual = hourly × hours per week × weeks per year'
                : period === 'day'
                  ? 'Annual = daily × days per week × weeks per year'
                  : period === 'week'
                    ? 'Annual = weekly × weeks per year'
                    : `Annual = ${
                        period === 'biweek'
                          ? 'bi-weekly × 26'
                          : period === 'semimonth'
                            ? 'semi-monthly × 24'
                            : period === 'month'
                              ? 'monthly × 12'
                              : period === 'quarter'
                                ? 'quarterly × 4'
                                : 'the amount entered'
                      }`,
            steps: [
              period === 'hour'
                ? `Annual = ${formatNumber(calc.amt, 2)} × ${formatNumber(
                    calc.hpw,
                    2,
                  )} × ${formatNumber(calc.wpy, 0)}`
                : period === 'day'
                  ? `Annual = ${formatNumber(calc.amt, 2)} × ${formatNumber(
                      calc.dpw,
                      2,
                    )} × ${formatNumber(calc.wpy, 0)}`
                  : period === 'week'
                    ? `Annual = ${formatNumber(calc.amt, 2)} × ${formatNumber(calc.wpy, 0)}`
                    : `Annual = ${formatNumber(calc.amt, 2)} × ${
                        period === 'biweek'
                          ? 26
                          : period === 'semimonth'
                            ? 24
                            : period === 'month'
                              ? 12
                              : period === 'quarter'
                                ? 4
                                : 1
                      }`,
            ],
            result: money.exact(calc.annualUnadjusted),
          },
          {
            label: 'Hourly rate',
            general: 'Hourly = annual / (hours per week × weeks per year)',
            steps: [
              `Hourly = ${formatNumber(calc.annualUnadjusted, 2)} ÷ (${formatNumber(
                calc.hpw,
                2,
              )} × ${formatNumber(calc.wpy, 0)}) = ${formatNumber(calc.annualUnadjusted, 2)} ÷ ${formatNumber(
                calc.unadj.hours,
                0,
              )} hours`,
            ],
            result: money.exact(calc.unadj.hour),
          },
          {
            label: 'Paid weeks after holidays and leave',
            general: 'Weeks = weeks per year − days off / days per week',
            steps: [
              `Weeks = ${formatNumber(calc.wpy, 0)} − ${formatNumber(calc.offDays, 0)} ÷ ${formatNumber(
                calc.dpw,
                1,
              )}`,
            ],
            result: `${formatNumber(calc.adjustedWeeks, 2)} weeks`,
          },
          {
            label: 'After the raise',
            general: 'New annual = annual × (1 + raise)',
            steps: [
              `New annual = ${formatNumber(calc.annualUnadjusted, 2)} × (1 + ${formatNumber(
                calc.raisePct,
                4,
              )})`,
            ],
            result: money.exact(calc.newAnnual),
          },
        ]}
        note="Bi-weekly pay assumes 26 pay periods a year and semi-monthly assumes 24. These are counts of pay dates, so the two figures differ."
      />

      <Assumptions
        items={[
          'These are gross figures. Income tax, national insurance, social security, pension contributions and health premiums all come out afterwards.',
          'Overtime, bonuses, commission, shift premiums and employer pension contributions are not included.',
          'The unadjusted column treats every week of the year as paid; the adjusted column treats public holidays and leave as unpaid days.',
          'Bi-weekly pay lands 26 times in most years and 27 times occasionally, which is why an annual figure divided by 26 can differ slightly from your payslip.',
        ]}
      />
    </div>
  )
}
