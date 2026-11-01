import { useMemo, useState } from 'react'

import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber } from '@/components/tools/finance/format'

import { Decimal, csvMoney, d, toPositive } from './calc-money-core'
import {
  CmAssumptions,
  CmCurrencySelect,
  CmDataTable,
  CmExportBar,
  CmField,
  CmFieldGrid,
  CmSelectField,
  CmStat,
  CmWorking,
  useMoney,
} from './calc-money-ui'
import type { CmColumn } from './calc-money-ui'

type Basis = 'hourly' | 'daily' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'annual'

const BASIS_LABEL: Record<Basis, string> = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  semimonthly: 'Twice a month',
  monthly: 'Monthly',
  annual: 'Annual',
}

const ORDER: Basis[] = ['hourly', 'daily', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'annual']

export default function CalcMoneyHourlySalary() {
  const [currency, setCurrency] = useState('USD')
  const money = useMoney(currency)

  const [basis, setBasis] = useState<Basis>('hourly')
  const [entry, setEntry] = useState('28')
  const [hoursPerWeek, setHoursPerWeek] = useState('40')
  const [daysPerWeek, setDaysPerWeek] = useState('5')
  const [weeksPerYear, setWeeksPerYear] = useState('52')
  const [unpaidPtoDays, setUnpaidPtoDays] = useState('0')
  const [otHours, setOtHours] = useState('0')
  const [otMultiplier, setOtMultiplier] = useState('1.5')

  const calc = useMemo(() => {
    const hpw = Math.max(0.01, toPositive(hoursPerWeek, 40) || 40)
    const dpw = Math.max(0.5, Math.min(7, toPositive(daysPerWeek, 5) || 5))
    const wpy = Math.max(1, Math.min(53, toPositive(weeksPerYear, 52) || 52))
    const unpaidDays = Math.max(0, toPositive(unpaidPtoDays))
    const hoursPerDay = hpw / dpw
    const unpaidHours = unpaidDays * hoursPerDay

    /* Paid base hours in a year, after unpaid time off. */
    const baseHours = Math.max(0.01, hpw * wpy - unpaidHours)

    const otPerWeek = Math.max(0, toPositive(otHours))
    const otMult = Math.max(1, toPositive(otMultiplier, 1.5) || 1.5)
    const otHoursYear = otPerWeek * wpy
    /* Overtime hours paid at a multiple, expressed as equivalent base hours. */
    const otEquivalentHours = otHoursYear * otMult

    const value = toPositive(entry)

    /* Everything is derived from one anchor: the base hourly rate. */
    let hourly: Decimal
    switch (basis) {
      case 'hourly':
        hourly = d(value)
        break
      case 'daily':
        hourly = d(value).div(hoursPerDay || 1)
        break
      case 'weekly':
        /* A weekly figure includes that week's overtime, like the longer periods. */
        hourly = d(value).div(hpw + otPerWeek * otMult)
        break
      case 'biweekly':
        hourly = d(value).times(26).div(baseHours + otEquivalentHours)
        break
      case 'semimonthly':
        hourly = d(value).times(24).div(baseHours + otEquivalentHours)
        break
      case 'monthly':
        hourly = d(value).times(12).div(baseHours + otEquivalentHours)
        break
      default:
        hourly = d(value).div(baseHours + otEquivalentHours)
    }
    if (!hourly.isFinite()) hourly = d(0)

    const annual = hourly.times(baseHours + otEquivalentHours)
    const otPayYear = hourly.times(otEquivalentHours)
    const basePayYear = hourly.times(baseHours)

    const amounts: Record<Basis, number> = {
      hourly: hourly.toNumber(),
      daily: hourly.times(hoursPerDay).toNumber(),
      weekly: hourly.times(hpw + otPerWeek * otMult).toNumber(),
      biweekly: annual.div(26).toNumber(),
      semimonthly: annual.div(24).toNumber(),
      monthly: annual.div(12).toNumber(),
      annual: annual.toNumber(),
    }

    return {
      hpw,
      dpw,
      wpy,
      hoursPerDay,
      unpaidDays,
      unpaidHours,
      baseHours,
      otPerWeek,
      otMult,
      otHoursYear,
      otEquivalentHours,
      hourly: hourly.toNumber(),
      annual: annual.toNumber(),
      basePayYear: basePayYear.toNumber(),
      otPayYear: otPayYear.toNumber(),
      amounts,
      totalPaidHours: baseHours + otHoursYear,
    }
  }, [basis, entry, hoursPerWeek, daysPerWeek, weeksPerYear, unpaidPtoDays, otHours, otMultiplier])

  interface RefRow {
    hourly: number
    weekly: number
    monthly: number
    annual: number
  }
  const reference: RefRow[] = useMemo(() => {
    const rates = [10, 12, 15, 17.5, 20, 22, 25, 28, 30, 35, 40, 45, 50, 60, 75, 100]
    return rates.map((r) => ({
      hourly: r,
      weekly: r * calc.hpw,
      monthly: (r * calc.baseHours) / 12,
      annual: r * calc.baseHours,
    }))
  }, [calc.hpw, calc.baseHours])

  const refColumns: CmColumn<RefRow>[] = [
    { key: 'hourly', header: 'Per hour', render: (r) => money.exact(r.hourly) },
    { key: 'weekly', header: 'Per week', align: 'right', render: (r) => money.round(r.weekly) },
    { key: 'monthly', header: 'Per month', align: 'right', render: (r) => money.round(r.monthly) },
    { key: 'annual', header: 'Per year', align: 'right', render: (r) => money.round(r.annual) },
  ]

  interface PayRow {
    basis: Basis
    amount: number
  }
  const payRows: PayRow[] = ORDER.map((b) => ({ basis: b, amount: calc.amounts[b] }))

  const payColumns: CmColumn<PayRow>[] = [
    { key: 'basis', header: 'Paid', render: (r) => BASIS_LABEL[r.basis] },
    { key: 'amount', header: 'Gross amount', align: 'right', render: (r) => money.exact(r.amount) },
    {
      key: 'periods',
      header: 'Periods a year',
      align: 'right',
      hideOnMobile: true,
      render: (r) =>
        r.basis === 'hourly'
          ? formatNumber(calc.totalPaidHours, 0)
          : r.basis === 'daily'
            ? formatNumber(calc.dpw * calc.wpy, 0)
            : r.basis === 'weekly'
              ? formatNumber(calc.wpy, 0)
              : r.basis === 'biweekly'
                ? '26'
                : r.basis === 'semimonthly'
                  ? '24'
                  : r.basis === 'monthly'
                    ? '12'
                    : '1',
    },
  ]

  const exportSpec = useMemo(
    () => ({
      filename: 'hourly-to-salary',
      title: 'Hourly to salary conversion',
      subtitle: `${money.exact(calc.hourly)} an hour · ${calc.hpw} h/week · ${calc.wpy} weeks a year`,
      tables: [
        {
          name: 'Your pay',
          headers: ['Paid', 'Gross amount'],
          aligns: ['left', 'right'] as ('left' | 'right')[],
          rows: payRows.map((r) => [BASIS_LABEL[r.basis], csvMoney(r.amount)]),
        },
        {
          name: 'Reference table',
          headers: ['Per hour', 'Per week', 'Per month', 'Per year'],
          aligns: ['right', 'right', 'right', 'right'] as ('left' | 'right')[],
          rows: reference.map((r) => [
            csvMoney(r.hourly),
            csvMoney(r.weekly),
            csvMoney(r.monthly),
            csvMoney(r.annual),
          ]),
        },
      ],
      notes: [
        `Base paid hours a year: ${formatNumber(calc.baseHours, 1)} (${calc.hpw} h/week × ${calc.wpy} weeks − ${formatNumber(calc.unpaidHours, 1)} unpaid).`,
        calc.otPerWeek > 0
          ? `Overtime: ${calc.otPerWeek} h/week at ${calc.otMult}× = ${formatNumber(calc.otHoursYear, 0)} hours a year.`
          : 'No overtime included.',
        'All figures are gross, before income tax, national insurance, payroll tax or pension contributions.',
      ],
    }),
    [calc, money, payRows, reference],
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ToolPanel
            title="Your pay"
            description="Enter the figure you know. The tool calculates the others from it."
          >
            <CmFieldGrid columns={2}>
              <CmSelectField
                id="hs-basis"
                label="I am paid"
                value={basis}
                onChange={(v) => setBasis(v as Basis)}
                options={ORDER.map((b) => ({ value: b, label: BASIS_LABEL[b] }))}
              />
              <CmField
                id="hs-entry"
                label={`${BASIS_LABEL[basis]} amount`}
                value={entry}
                onChange={setEntry}
                prefix={money.symbol}
                hint="gross, before tax"
              />
              <CmCurrencySelect value={currency} onChange={setCurrency} id="hs-currency" />
              <CmField
                id="hs-hpw"
                label="Hours per week"
                value={hoursPerWeek}
                onChange={setHoursPerWeek}
                suffix="h"
                slider={{ min: 1, max: 80, step: 0.5 }}
              />
              <CmField
                id="hs-dpw"
                label="Days per week"
                value={daysPerWeek}
                onChange={setDaysPerWeek}
                hint={`${formatNumber(calc.hoursPerDay, 2)} h a day`}
                slider={{ min: 1, max: 7, step: 0.5 }}
              />
              <CmField
                id="hs-wpy"
                label="Weeks worked per year"
                value={weeksPerYear}
                onChange={setWeeksPerYear}
                hint="52 if your holiday is paid"
                slider={{ min: 1, max: 53, step: 1 }}
              />
            </CmFieldGrid>
          </ToolPanel>

          <ToolPanel
            title="Time off and overtime"
            description="Unpaid days reduce the year; overtime hours are paid on top at a multiple."
          >
            <CmFieldGrid columns={3}>
              <CmField
                id="hs-pto"
                label="Unpaid days off"
                value={unpaidPtoDays}
                onChange={setUnpaidPtoDays}
                hint={`${formatNumber(calc.unpaidHours, 1)} h`}
              />
              <CmField
                id="hs-ot"
                label="Overtime hours / week"
                value={otHours}
                onChange={setOtHours}
                suffix="h"
              />
              <CmField
                id="hs-otm"
                label="Overtime multiplier"
                value={otMultiplier}
                onChange={setOtMultiplier}
                suffix="×"
                hint="1.5 = time and a half"
              />
            </CmFieldGrid>
          </ToolPanel>
        </div>

        <div className="space-y-6">
          <ToolPanel title="Every way of expressing the same pay">
            <ResultStat
              label="Annual gross salary"
              value={money.exact(calc.annual)}
              hint={`${money.exact(calc.hourly)} an hour × ${formatNumber(
                calc.baseHours + calc.otEquivalentHours,
                0,
              )} paid hours`}
              emphasis
            />
            <div className="grid grid-cols-2 gap-3">
              <CmStat label="Per hour" value={money.exact(calc.amounts.hourly)} />
              <CmStat
                label="Per day"
                value={money.exact(calc.amounts.daily)}
                hint={`${formatNumber(calc.hoursPerDay, 2)} h`}
              />
              <CmStat
                label="Per week"
                value={money.exact(calc.amounts.weekly)}
                hint={
                  calc.otPerWeek > 0 ? `incl. ${calc.otPerWeek} h overtime` : `${calc.hpw} h`
                }
              />
              <CmStat label="Every two weeks" value={money.exact(calc.amounts.biweekly)} />
              <CmStat label="Twice a month" value={money.exact(calc.amounts.semimonthly)} />
              <CmStat label="Per month" value={money.exact(calc.amounts.monthly)} />
            </div>
            {calc.otPerWeek > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <CmStat
                  label="Base pay a year"
                  value={money.round(calc.basePayYear)}
                  hint={`${formatNumber(calc.baseHours, 0)} hours`}
                />
                <CmStat
                  label="Overtime pay a year"
                  value={money.round(calc.otPayYear)}
                  tone="positive"
                  hint={`${formatNumber(calc.otHoursYear, 0)} hours at ${calc.otMult}×`}
                />
              </div>
            ) : null}
          </ToolPanel>

          <ToolPanel
            title="Your pay, every way round"
            footer={<CmExportBar spec={exportSpec} />}
          >
            <CmDataTable
              ariaLabel="The same pay expressed on every pay frequency"
              columns={payColumns}
              rows={payRows}
              pageSize={10}
              minWidth={420}
            />
          </ToolPanel>
        </div>
      </div>

      <CmWorking
        items={[
          {
            label: 'Paid hours in a year',
            general: 'hours = hours per week × weeks per year − unpaid hours',
            steps: [
              `= ${calc.hpw} × ${calc.wpy} − ${formatNumber(calc.unpaidHours, 1)}`,
              calc.otPerWeek > 0
                ? `overtime adds ${calc.otPerWeek} × ${calc.wpy} = ${formatNumber(calc.otHoursYear, 0)} hours at ${calc.otMult}×`
                : 'no overtime hours',
            ],
            result: `${formatNumber(calc.baseHours, 1)} base + ${formatNumber(calc.otHoursYear, 1)} overtime hours`,
          },
          {
            label: 'Hourly rate',
            general: 'hourly = annual ÷ (base hours + overtime hours × multiplier)',
            steps: [
              `= ${formatNumber(calc.annual, 2)} ÷ (${formatNumber(calc.baseHours, 1)} + ${formatNumber(
                calc.otHoursYear,
                1,
              )} × ${calc.otMult})`,
            ],
            result: money.exact(calc.hourly),
          },
          {
            label: 'Annual salary',
            general: 'annual = hourly × paid hours (overtime counted at its multiple)',
            steps: [
              `= ${formatNumber(calc.hourly, 4)} × ${formatNumber(
                calc.baseHours + calc.otEquivalentHours,
                1,
              )}`,
            ],
            result: money.exact(calc.annual),
          },
          {
            label: 'Monthly and fortnightly',
            general: 'monthly = annual ÷ 12 · fortnightly = annual ÷ 26',
            steps: [
              `monthly = ${formatNumber(calc.annual, 2)} ÷ 12 = ${money.exact(calc.amounts.monthly)}`,
              `fortnightly = ${formatNumber(calc.annual, 2)} ÷ 26 = ${money.exact(calc.amounts.biweekly)}`,
            ],
            result: `${money.exact(calc.amounts.monthly)} / ${money.exact(calc.amounts.biweekly)}`,
          },
        ]}
        note="A monthly figure is the annual salary divided by twelve. An average month has 4.33 weeks, so “weekly × 4” always gives too little."
      />

      <ToolPanel
        title="Hourly rate to annual salary"
        description={`At ${calc.hpw} hours a week and ${calc.wpy} paid weeks a year.`}
      >
        <CmDataTable
          ariaLabel="Reference table converting common hourly rates to weekly, monthly and annual pay"
          columns={refColumns}
          rows={reference}
          pageSize={16}
          minWidth={460}
        />
      </ToolPanel>

      <CmAssumptions
        items={[
          'Every figure is gross: before income tax, payroll tax, national insurance, pension or health deductions. Take-home pay depends on where you live and is not modelled here.',
          'Paid holiday is included by leaving weeks per year at 52: a salaried employee is paid for all 52 weeks whether or not they work them. Set a lower number only for genuinely unpaid weeks.',
          'The daily rate is the hourly rate times the hours in a working day, derived from hours per week ÷ days per week.',
          'Semi-monthly (24 pay packets) and bi-weekly (26 pay packets) are different schedules, and the amounts differ by about 8%. Both divide the same annual salary.',
          'Overtime is treated as extra hours paid at a multiple of the base rate on top of the normal week. Rules such as the US FLSA over-40 requirement or salaried-exempt status are not applied automatically.',
        ]}
      />
    </div>
  )
}
