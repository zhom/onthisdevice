import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatNumber } from '@/components/tools/finance/format'

import { Decimal, csvMoney, d, toPositive } from '../finance/calc-money-core'
import {
  CmAssumptions,
  CmCurrencySelect,
  CmDataTable,
  CmExportBar,
  CmField,
  CmFieldGrid,
  CmSaveControl,
  CmSegmented,
  CmStat,
  CmWorking,
  useCmStorage,
  useMoney,
} from '../finance/calc-money-ui'
import type { CmColumn } from '../finance/calc-money-ui'
import { DAY_NAMES, formatTimeOfDay, hoursToHm, parseTimeOfDay, roundHours } from './calc-money-time'

export type TimeCardVariant = 'week' | 'hours'

interface Entry {
  id: string
  label: string
  start: string
  end: string
  breakMinutes: string
}

interface EntryResult extends Entry {
  startMin: number | null
  endMin: number | null
  worked: number
  regular: number
  overtime: number
  overnight: boolean
  error?: string
}

const WEEK_ENTRIES: Entry[] = DAY_NAMES.map((name, i) => ({
  id: `day-${i}`,
  label: name,
  start: i < 5 ? '9:00' : '',
  end: i < 5 ? '17:30' : '',
  breakMinutes: i < 5 ? '30' : '0',
}))

const FREE_ENTRIES: Entry[] = [
  { id: 'e1', label: 'Morning session', start: '8:30', end: '12:00', breakMinutes: '0' },
  { id: 'e2', label: 'Afternoon session', start: '13:00', end: '17:15', breakMinutes: '0' },
]

const ROUNDING = [
  { value: '0', label: 'Exact minutes' },
  { value: '0.25', label: 'Nearest quarter hour' },
  { value: '0.1', label: 'Nearest tenth of an hour' },
  { value: '0.5', label: 'Nearest half hour' },
]

export default function CalcMoneyTimeCard({ variant = 'week' }: { variant?: TimeCardVariant }) {
  const isWeek = variant === 'week'
  const [currency, setCurrency] = useState('USD')
  const money = useMoney(currency)

  const [hour12, setHour12] = useState(true)
  const [dailyOt, setDailyOt] = useState(isWeek)
  const [dailyThreshold, setDailyThreshold] = useState('8')
  const [weeklyOt, setWeeklyOt] = useState(isWeek)
  const [weeklyThreshold, setWeeklyThreshold] = useState('40')
  const [otMultiplier, setOtMultiplier] = useState('1.5')
  const [payRate, setPayRate] = useState(isWeek ? '22' : '0')
  const [rounding, setRounding] = useState('0')

  const [saveOn, setSaveOn] = useState(false)
  const [entries, setEntries, clearStored] = useCmStorage<Entry[]>(
    isWeek ? 'otd:calc-money:timecard' : 'otd:calc-money:hours',
    isWeek ? WEEK_ENTRIES : FREE_ENTRIES,
    saveOn,
  )

  const increment = Number(rounding) || 0

  const rows: EntryResult[] = useMemo(() => {
    const dailyLimit = dailyOt ? Math.max(0, toPositive(dailyThreshold, 8)) : Number.POSITIVE_INFINITY
    return entries.map((entry) => {
      const startMin = parseTimeOfDay(entry.start)
      const endMin = parseTimeOfDay(entry.end)
      const breakMin = Math.max(0, toPositive(entry.breakMinutes))

      if (entry.start.trim() === '' && entry.end.trim() === '') {
        return {
          ...entry,
          startMin: null,
          endMin: null,
          worked: 0,
          regular: 0,
          overtime: 0,
          overnight: false,
        }
      }
      if (startMin === null || endMin === null) {
        return {
          ...entry,
          startMin,
          endMin,
          worked: 0,
          regular: 0,
          overtime: 0,
          overnight: false,
          error: 'Use a time like 9:00, 9am, 0900 or 17:30.',
        }
      }

      const overnight = endMin <= startMin
      const span = overnight ? endMin + 1440 - startMin : endMin - startMin
      const net = Math.max(0, span - breakMin)
      const worked = roundHours(net / 60, increment)

      if (breakMin > span) {
        return {
          ...entry,
          startMin,
          endMin,
          worked: 0,
          regular: 0,
          overtime: 0,
          overnight,
          error: 'The unpaid break is longer than the shift.',
        }
      }

      const regular = Math.min(worked, dailyLimit)
      return {
        ...entry,
        startMin,
        endMin,
        worked,
        regular,
        overtime: worked - regular,
        overnight,
      }
    })
  }, [entries, dailyOt, dailyThreshold, increment])

  const totals = useMemo(() => {
    const worked = rows.reduce((sum, r) => sum + r.worked, 0)
    const dailyOvertime = rows.reduce((sum, r) => sum + r.overtime, 0)
    const regularBeforeWeekly = rows.reduce((sum, r) => sum + r.regular, 0)
    const weeklyLimit = weeklyOt ? Math.max(0, toPositive(weeklyThreshold, 40)) : Number.POSITIVE_INFINITY
    const weeklyOvertime = Math.max(0, regularBeforeWeekly - weeklyLimit)
    const regular = regularBeforeWeekly - weeklyOvertime
    const overtime = dailyOvertime + weeklyOvertime

    const rate = d(toPositive(payRate))
    const mult = Math.max(1, toPositive(otMultiplier, 1.5) || 1.5)
    const regularPay = rate.times(regular)
    const overtimePay = rate.times(mult).times(overtime)
    const round2 = (x: Decimal) => x.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()

    return {
      worked,
      regular,
      overtime,
      dailyOvertime,
      weeklyOvertime,
      weeklyLimit,
      mult,
      regularPay: round2(regularPay),
      overtimePay: round2(overtimePay),
      grossPay: round2(regularPay.plus(overtimePay)),
      daysWorked: rows.filter((r) => r.worked > 0).length,
      averageDay: rows.filter((r) => r.worked > 0).length
        ? worked / rows.filter((r) => r.worked > 0).length
        : 0,
    }
  }, [rows, weeklyOt, weeklyThreshold, payRate, otMultiplier])

  const update = (id: string, patch: Partial<Entry>) =>
    setEntries((list) => list.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  const columns: CmColumn<EntryResult>[] = [
    { key: 'label', header: isWeek ? 'Day' : 'Entry', render: (r) => r.label || '–' },
    {
      key: 'in',
      header: 'In',
      render: (r) => (r.startMin === null ? '–' : formatTimeOfDay(r.startMin, hour12)),
    },
    {
      key: 'out',
      header: 'Out',
      render: (r) =>
        r.endMin === null
          ? '–'
          : `${formatTimeOfDay(r.endMin, hour12)}${r.overnight && r.worked > 0 ? ' +1d' : ''}`,
    },
    {
      key: 'break',
      header: 'Break',
      align: 'right',
      hideOnMobile: true,
      render: (r) => `${formatNumber(toPositive(r.breakMinutes), 0)} min`,
    },
    { key: 'hm', header: 'Hours', align: 'right', render: (r) => hoursToHm(r.worked) },
    { key: 'dec', header: 'Decimal', align: 'right', render: (r) => r.worked.toFixed(2) },
    ...(dailyOt
      ? [
          {
            key: 'ot',
            header: 'Daily OT',
            align: 'right' as const,
            render: (r: EntryResult) => (r.overtime > 0 ? r.overtime.toFixed(2) : '–'),
          },
        ]
      : []),
  ]

  const exportSpec = useMemo(
    () => ({
      filename: isWeek ? 'time-card' : 'hours-worked',
      title: isWeek ? 'Weekly time card' : 'Hours worked',
      subtitle: `${hoursToHm(totals.worked)} (${totals.worked.toFixed(2)} decimal hours) across ${
        totals.daysWorked
      } ${isWeek ? 'days' : 'entries'}`,
      tables: [
        {
          name: isWeek ? 'Time card' : 'Entries',
          headers: [isWeek ? 'Day' : 'Entry', 'In', 'Out', 'Break (min)', 'Hours', 'Decimal', 'Daily OT'],
          aligns: ['left', 'left', 'left', 'right', 'right', 'right', 'right'] as (
            | 'left'
            | 'right'
          )[],
          rows: rows.map((r) => [
            r.label,
            r.startMin === null ? '' : formatTimeOfDay(r.startMin, hour12),
            r.endMin === null ? '' : formatTimeOfDay(r.endMin, hour12),
            formatNumber(toPositive(r.breakMinutes), 0),
            hoursToHm(r.worked),
            r.worked.toFixed(2),
            r.overtime > 0 ? r.overtime.toFixed(2) : '',
          ]),
        },
        {
          name: 'Totals',
          headers: ['Field', 'Value'],
          aligns: ['left', 'right'] as ('left' | 'right')[],
          rows: [
            ['Total hours', hoursToHm(totals.worked)],
            ['Total decimal hours', totals.worked.toFixed(2)],
            ['Regular hours', totals.regular.toFixed(2)],
            ['Overtime hours', totals.overtime.toFixed(2)],
            ['Pay rate', csvMoney(toPositive(payRate))],
            ['Overtime multiplier', totals.mult],
            ['Regular pay', csvMoney(totals.regularPay)],
            ['Overtime pay', csvMoney(totals.overtimePay)],
            ['Gross pay', csvMoney(totals.grossPay)],
          ] as (string | number)[][],
        },
      ],
      notes: [
        increment > 0
          ? `Each entry is rounded to the nearest ${increment} of an hour before totalling.`
          : 'Hours are totalled to the exact minute with no rounding.',
        dailyOt
          ? `Daily overtime above ${toPositive(dailyThreshold, 8)} hours, paid at ${totals.mult}x.`
          : 'Daily overtime is switched off.',
        weeklyOt
          ? `Weekly overtime above ${toPositive(weeklyThreshold, 40)} hours, counted once. Hours already paid as daily overtime are not counted twice.`
          : 'Weekly overtime is switched off.',
        'Gross pay only. Tax, national insurance and other deductions are not applied.',
      ],
    }),
    [
      dailyOt,
      dailyThreshold,
      hour12,
      increment,
      isWeek,
      payRate,
      rows,
      totals,
      weeklyOt,
      weeklyThreshold,
    ],
  )

  return (
    <div className="space-y-6">
      <ToolPanel
        title={isWeek ? 'Your week' : 'Your time entries'}
        description={
          isWeek
            ? 'Type times in any common form: 9, 9:00, 0900, 9am and 09:00 all work. An out time earlier than the in time is treated as an overnight shift.'
            : 'Add as many start and end pairs as you need. Times accept 9, 9:30, 0930, 9am or 17:45.'
        }
        footer={
          <>
            {!isWeek ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setEntries((list) => [
                    ...list,
                    {
                      id: `entry-${Date.now()}`,
                      label: `Entry ${list.length + 1}`,
                      start: '',
                      end: '',
                      breakMinutes: '0',
                    },
                  ])
                }
              >
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                Add an entry
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setEntries(
                  (isWeek ? WEEK_ENTRIES : FREE_ENTRIES).map((row) => ({ ...row })),
                )
              }
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setEntries((list) =>
                  list.map((row) => ({ ...row, start: '', end: '', breakMinutes: '0' })),
                )
              }
            >
              Clear all times
            </Button>
            <div className="flex items-center gap-2">
              <Switch id="tc-12h" checked={hour12} onCheckedChange={setHour12} />
              <Label htmlFor="tc-12h" className="text-sm font-normal">
                12-hour display
              </Label>
            </div>
          </>
        }
      >
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 sm:grid-cols-10"
            >
              {isWeek ? (
                <div className="col-span-2 flex items-end sm:col-span-2">
                  <span className="text-sm font-medium">{row.label}</span>
                </div>
              ) : (
                <div className="col-span-2 space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`${row.id}-label`} className="text-sm">
                    Label
                  </Label>
                  <Input
                    id={`${row.id}-label`}
                    value={row.label}
                    autoComplete="off"
                    onChange={(e) => update(row.id, { label: e.target.value })}
                  />
                </div>
              )}
              <CmField
                id={`${row.id}-start`}
                label="Start"
                value={row.start}
                onChange={(v) => update(row.id, { start: v })}
                placeholder="9:00"
                className="sm:col-span-2"
              />
              <CmField
                id={`${row.id}-end`}
                label="End"
                value={row.end}
                onChange={(v) => update(row.id, { end: v })}
                placeholder="17:30"
                className="sm:col-span-2"
              />
              <CmField
                id={`${row.id}-break`}
                label="Break"
                value={row.breakMinutes}
                onChange={(v) => update(row.id, { breakMinutes: v })}
                suffix="min"
                className="sm:col-span-2"
              />
              <div className="col-span-2 flex items-end justify-between gap-2 sm:col-span-2">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-base font-semibold tabular-nums">
                    {row.error ? '–' : hoursToHm(row.worked)}
                  </p>
                  {row.error ? (
                    <p className="text-xs text-destructive">{row.error}</p>
                  ) : row.overnight && row.worked > 0 ? (
                    <p className="text-xs text-muted-foreground">crosses midnight</p>
                  ) : null}
                </div>
                {!isWeek ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.label || `entry ${index + 1}`}`}
                    disabled={entries.length <= 1}
                    onClick={() => setEntries((list) => list.filter((r) => r.id !== row.id))}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <CmSaveControl
          id="tc-save"
          what={isWeek ? 'this week' : 'these entries'}
          enabled={saveOn}
          onToggle={setSaveOn}
          onClear={() => {
            clearStored()
            setEntries((isWeek ? WEEK_ENTRIES : FREE_ENTRIES).map((row) => ({ ...row })))
          }}
        />
      </ToolPanel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ToolPanel title="Totals">
          <ResultStat
            label="Total time"
            value={hoursToHm(totals.worked)}
            hint={`${totals.worked.toFixed(2)} decimal hours across ${totals.daysWorked} ${
              isWeek ? 'days' : 'entries'
            }`}
            emphasis
          />
          <div className="grid grid-cols-2 gap-3">
            <CmStat
              label="Regular hours"
              value={totals.regular.toFixed(2)}
              hint={hoursToHm(totals.regular)}
            />
            <CmStat
              label="Overtime hours"
              value={totals.overtime.toFixed(2)}
              hint={
                totals.overtime > 0
                  ? `${totals.dailyOvertime.toFixed(2)} daily + ${totals.weeklyOvertime.toFixed(2)} weekly`
                  : 'none this period'
              }
              tone={totals.overtime > 0 ? 'warning' : 'default'}
            />
            <CmStat
              label={isWeek ? 'Average day' : 'Average entry'}
              value={hoursToHm(totals.averageDay)}
              hint={`${totals.averageDay.toFixed(2)} hours`}
            />
            <CmStat
              label="Minutes total"
              value={formatNumber(Math.round(totals.worked * 60), 0)}
              hint="useful for invoicing by the minute"
            />
          </div>
        </ToolPanel>

        <ToolPanel
          title="Pay and rules"
          description="Set your local overtime rules: daily, weekly, or neither."
        >
          <CmFieldGrid columns={2}>
            <CmField
              id="tc-rate"
              label="Pay rate"
              value={payRate}
              onChange={setPayRate}
              prefix={money.symbol}
              hint="per hour, before tax"
            />
            <CmCurrencySelect value={currency} onChange={setCurrency} id="tc-currency" />
          </CmFieldGrid>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <Switch id="tc-daily" checked={dailyOt} onCheckedChange={setDailyOt} />
                <Label htmlFor="tc-daily" className="text-sm font-normal">
                  Daily overtime
                </Label>
              </div>
              <div className="w-28">
                <CmField
                  id="tc-daily-h"
                  label="Above"
                  value={dailyThreshold}
                  onChange={setDailyThreshold}
                  suffix="h"
                  disabled={!dailyOt}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <Switch id="tc-weekly" checked={weeklyOt} onCheckedChange={setWeeklyOt} />
                <Label htmlFor="tc-weekly" className="text-sm font-normal">
                  Weekly overtime
                </Label>
              </div>
              <div className="w-28">
                <CmField
                  id="tc-weekly-h"
                  label="Above"
                  value={weeklyThreshold}
                  onChange={setWeeklyThreshold}
                  suffix="h"
                  disabled={!weeklyOt}
                />
              </div>
            </div>
          </div>

          <CmFieldGrid columns={2}>
            <CmField
              id="tc-mult"
              label="Overtime multiplier"
              value={otMultiplier}
              onChange={setOtMultiplier}
              suffix="×"
              hint="1.5 = time and a half"
            />
            <div className="space-y-1.5">
              <span className="block text-sm font-medium">Rounding</span>
              <CmSegmented
                label="Payroll rounding increment"
                value={rounding}
                onChange={setRounding}
                options={ROUNDING.map((r) => ({
                  value: r.value,
                  label: r.value === '0' ? 'Exact' : `${r.value}h`,
                }))}
              />
            </div>
          </CmFieldGrid>

          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-3">
            <CmStat label="Regular pay" value={money.exact(totals.regularPay)} />
            <CmStat label="Overtime pay" value={money.exact(totals.overtimePay)} />
            <CmStat label="Gross pay" value={money.exact(totals.grossPay)} tone="positive" />
          </div>
        </ToolPanel>
      </div>

      <ToolPanel
        title={isWeek ? 'Time card' : 'Entry summary'}
        description="Print this straight from the browser, or export it for payroll."
        footer={<CmExportBar spec={exportSpec} />}
      >
        <CmDataTable
          ariaLabel={isWeek ? 'Weekly time card' : 'Time entries'}
          columns={columns}
          rows={rows}
          pageSize={31}
          minWidth={600}
        />
      </ToolPanel>

      <CmWorking
        items={[
          {
            label: 'One shift',
            general: 'hours = (out − in) − unpaid break',
            steps: rows
              .filter((r) => r.worked > 0)
              .slice(0, 3)
              .map(
                (r) =>
                  `${r.label}: ${formatTimeOfDay(r.endMin ?? 0, hour12)} − ${formatTimeOfDay(
                    r.startMin ?? 0,
                    hour12,
                  )}${r.overnight ? ' (+1 day)' : ''} − ${toPositive(r.breakMinutes)} min = ${hoursToHm(
                    r.worked,
                  )}`,
              ),
            result: `${hoursToHm(totals.worked)} in total`,
          },
          {
            label: 'Decimal hours',
            general: 'decimal = hours + minutes ÷ 60',
            steps: [
              `${hoursToHm(totals.worked)} → ${Math.floor(totals.worked)} + ${Math.round(
                (totals.worked - Math.floor(totals.worked)) * 60,
              )} ÷ 60`,
            ],
            result: totals.worked.toFixed(2),
          },
          {
            label: 'Overtime split',
            general: 'overtime = daily hours above the daily limit + weekly hours above the weekly limit',
            steps: [
              dailyOt
                ? `daily: hours above ${toPositive(dailyThreshold, 8)} h = ${totals.dailyOvertime.toFixed(2)}`
                : 'daily overtime off',
              weeklyOt
                ? `weekly: ${(totals.regular + totals.weeklyOvertime).toFixed(2)} regular hours − ${
                    toPositive(weeklyThreshold, 40)
                  } h = ${totals.weeklyOvertime.toFixed(2)}`
                : 'weekly overtime off',
            ],
            result: `${totals.regular.toFixed(2)} regular + ${totals.overtime.toFixed(2)} overtime`,
          },
          {
            label: 'Gross pay',
            general: 'pay = regular × rate + overtime × rate × multiplier',
            steps: [
              `= ${totals.regular.toFixed(2)} × ${formatNumber(toPositive(payRate), 2)} + ${totals.overtime.toFixed(
                2,
              )} × ${formatNumber(toPositive(payRate), 2)} × ${totals.mult}`,
              `= ${money.exact(totals.regularPay)} + ${money.exact(totals.overtimePay)}`,
            ],
            result: money.exact(totals.grossPay),
          },
        ]}
        note="Hours already counted as daily overtime are excluded before the weekly threshold is applied, so no hour is ever paid at the overtime rate twice."
      />

      <CmAssumptions
        items={[
          'Break minutes are treated as unpaid and deducted from the shift. Paid breaks should be left at zero.',
          'An end time at or before the start time is read as an overnight shift and 24 hours are added. A 22:00 to 06:00 shift totals eight hours.',
          'Daily overtime is applied per entry; weekly overtime is applied to what is left after that, so no hour is counted twice. US federal law (FLSA) requires only the weekly rule; California adds a daily one; most of Europe uses contractual rules instead.',
          'Payroll rounding, where enabled, is applied to each entry before totalling, which is how time-clock systems behave. Rounding must be neutral to be lawful in the US: always to the nearest increment, never always down.',
          'Pay is gross. Income tax, national insurance, pension and other deductions are not applied.',
          'Nothing you enter is uploaded. Saving is off by default and writes only to this browser.',
        ]}
      />
    </div>
  )
}
