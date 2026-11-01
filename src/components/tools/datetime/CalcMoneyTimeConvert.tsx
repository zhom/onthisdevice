import { useMemo, useState } from 'react'
import { CircleX } from 'lucide-react'

import { CopyButton } from '@/components/shared/CopyButton'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatNumber } from '@/components/tools/finance/format'

import {
  CmAssumptions,
  CmDataTable,
  CmExportBar,
  CmField,
  CmFieldGrid,
  CmSegmented,
  CmStat,
  CmWorking,
} from '../finance/calc-money-ui'
import type { CmColumn } from '../finance/calc-money-ui'
import { formatTimeOfDay, hoursToHm, parseDuration, parseTimeOfDay, roundHours } from './calc-money-time'

export type TimeConvertVariant = 'decimal' | 'military'

const ROUNDING = [
  { value: '0', label: 'Exact' },
  { value: '0.25', label: '¼ h' },
  { value: '0.1', label: '0.1 h' },
  { value: '0.5', label: '½ h' },
]

interface BulkRow {
  input: string
  output: string
  extra: string
  ok: boolean
}

export default function CalcMoneyTimeConvert({
  variant = 'decimal',
}: {
  variant?: TimeConvertVariant
}) {
  const isDecimal = variant === 'decimal'

  /* ── decimal-hours state ── */
  const [hm, setHm] = useState('7:45')
  const [dec, setDec] = useState('7.75')
  const [lastEdited, setLastEdited] = useState<'hm' | 'dec'>('hm')
  const [rounding, setRounding] = useState('0')

  /* ── military-time state ── */
  const [t24, setT24] = useState('14:30')
  const [t12, setT12] = useState('2:30 PM')
  const [lastClock, setLastClock] = useState<'t24' | 't12'>('t24')

  const [bulk, setBulk] = useState('')

  const increment = Number(rounding) || 0

  const duration = useMemo(() => {
    const source = lastEdited === 'hm' ? parseDuration(hm) : parseDuration(dec)
    const value = source ?? 0
    const rounded = roundHours(value, increment)
    const totalMinutes = Math.round(value * 60)
    return {
      valid: source !== null,
      value,
      rounded,
      hours: Math.floor(Math.abs(value)),
      minutes: Math.round((Math.abs(value) - Math.floor(Math.abs(value))) * 60),
      totalMinutes,
      totalSeconds: totalMinutes * 60,
    }
  }, [hm, dec, lastEdited, increment])

  const clock = useMemo(() => {
    const source = lastClock === 't24' ? parseTimeOfDay(t24) : parseTimeOfDay(t12)
    const minutes = source ?? 0
    return {
      valid: source !== null,
      minutes,
      display24: formatTimeOfDay(minutes, false),
      display12: formatTimeOfDay(minutes, true),
      spoken: `${formatTimeOfDay(minutes, false).replace(':', ' ')} hours`,
      minutesSinceMidnight: minutes % 1440,
    }
  }, [t24, t12, lastClock])

  const setFromHm = (value: string) => {
    setHm(value)
    setLastEdited('hm')
    const parsed = parseDuration(value)
    if (parsed !== null) setDec(parsed.toFixed(4).replace(/\.?0+$/, ''))
  }
  const setFromDec = (value: string) => {
    setDec(value)
    setLastEdited('dec')
    const parsed = parseDuration(value)
    if (parsed !== null) setHm(hoursToHm(parsed))
  }
  const setFrom24 = (value: string) => {
    setT24(value)
    setLastClock('t24')
    const parsed = parseTimeOfDay(value)
    if (parsed !== null) setT12(formatTimeOfDay(parsed, true))
  }
  const setFrom12 = (value: string) => {
    setT12(value)
    setLastClock('t12')
    const parsed = parseTimeOfDay(value)
    if (parsed !== null) setT24(formatTimeOfDay(parsed, false))
  }

  const bulkRows: BulkRow[] = useMemo(() => {
    return bulk
      .split(/\r?\n/)
      .map((raw) => raw.trim())
      .filter((line) => line.length > 0)
      .slice(0, 1000)
      .map((line) => {
        if (isDecimal) {
          const parsed = parseDuration(line)
          if (parsed === null) return { input: line, output: '–', extra: 'not a duration', ok: false }
          const rounded = roundHours(parsed, increment)
          return {
            input: line,
            output: /[:h]/i.test(line) ? rounded.toFixed(2) : hoursToHm(rounded),
            extra: `${Math.round(parsed * 60)} min`,
            ok: true,
          }
        }
        const parsed = parseTimeOfDay(line)
        if (parsed === null) return { input: line, output: '–', extra: 'not a time', ok: false }
        const looks24 = /^\d{1,2}:?\d{2}$/.test(line.replace(/\s/g, '')) && !/[ap]/i.test(line)
        return {
          input: line,
          output: looks24 ? formatTimeOfDay(parsed, true) : formatTimeOfDay(parsed, false),
          extra: `${parsed % 1440} min after midnight`,
          ok: true,
        }
      })
  }, [bulk, isDecimal, increment])

  const bulkColumns: CmColumn<BulkRow>[] = [
    { key: 'in', header: 'Input', render: (r) => r.input },
    {
      key: 'out',
      header: 'Converted',
      align: 'right',
      render: (r) => (
        r.ok ? (
          <span className="font-medium">{r.output}</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <CircleX className="size-3.5 shrink-0" aria-hidden="true" />
            Not understood
          </span>
        )
      ),
    },
    { key: 'extra', header: 'Also', align: 'right', hideOnMobile: true, render: (r) => r.extra },
  ]

  interface MinRow {
    minutes: number
    decimal: number
    quarter: string
  }
  const minuteTable: MinRow[] = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const minutes = i * 5
        return {
          minutes,
          decimal: minutes / 60,
          quarter: (Math.round(minutes / 15) * 15 / 60).toFixed(2),
        }
      }),
    [],
  )

  const minuteColumns: CmColumn<MinRow>[] = [
    { key: 'm', header: 'Minutes', render: (r) => `:${String(r.minutes).padStart(2, '0')}` },
    { key: 'd', header: 'Decimal hours', align: 'right', render: (r) => r.decimal.toFixed(4) },
    { key: 'r', header: 'Rounded (2dp)', align: 'right', render: (r) => r.decimal.toFixed(2) },
    {
      key: 'q',
      header: 'Nearest quarter',
      align: 'right',
      hideOnMobile: true,
      render: (r) => r.quarter,
    },
  ]

  interface ClockRow {
    minutes: number
  }
  const clockTable: ClockRow[] = useMemo(
    () => Array.from({ length: 24 }, (_, h) => ({ minutes: h * 60 })),
    [],
  )

  const clockColumns: CmColumn<ClockRow>[] = [
    { key: 'm', header: '24-hour', render: (r) => formatTimeOfDay(r.minutes, false) },
    { key: 'c', header: '12-hour', align: 'right', render: (r) => formatTimeOfDay(r.minutes, true) },
    {
      key: 's',
      header: 'Spoken',
      align: 'right',
      hideOnMobile: true,
      render: (r) => {
        const h = Math.floor(r.minutes / 60)
        return `${String(h).padStart(2, '0')} hundred`
      },
    },
  ]

  const exportSpec = useMemo(
    () =>
      isDecimal
        ? {
            filename: 'decimal-hours',
            title: 'Decimal hours conversion',
            subtitle: `${hm} = ${duration.value.toFixed(4)} decimal hours`,
            tables: [
              ...(bulkRows.length > 0
                ? [
                    {
                      name: 'Converted list',
                      headers: ['Input', 'Converted', 'Minutes'],
                      aligns: ['left', 'right', 'right'] as ('left' | 'right')[],
                      rows: bulkRows.map((r) => [r.input, r.output, r.extra]),
                    },
                  ]
                : []),
              {
                name: 'Minutes to decimal',
                headers: ['Minutes', 'Decimal hours', 'Rounded', 'Nearest quarter'],
                aligns: ['left', 'right', 'right', 'right'] as ('left' | 'right')[],
                rows: minuteTable.map((r) => [
                  `:${String(r.minutes).padStart(2, '0')}`,
                  r.decimal.toFixed(4),
                  r.decimal.toFixed(2),
                  r.quarter,
                ]),
              },
            ],
            notes: [
              'Decimal hours = hours + minutes / 60. Payroll systems bill in decimal hours; clocks show hours and minutes.',
              increment > 0
                ? `Rounding to the nearest ${increment} of an hour is applied to the converted values.`
                : 'No rounding is applied.',
            ],
          }
        : {
            filename: 'military-time',
            title: 'Military time conversion',
            subtitle: `${clock.display24} = ${clock.display12}`,
            tables: [
              ...(bulkRows.length > 0
                ? [
                    {
                      name: 'Converted list',
                      headers: ['Input', 'Converted', 'Minutes after midnight'],
                      aligns: ['left', 'right', 'right'] as ('left' | 'right')[],
                      rows: bulkRows.map((r) => [r.input, r.output, r.extra]),
                    },
                  ]
                : []),
              {
                name: '24-hour clock',
                headers: ['24-hour', '12-hour', 'Spoken'],
                aligns: ['left', 'right', 'right'] as ('left' | 'right')[],
                rows: clockTable.map((r) => [
                  formatTimeOfDay(r.minutes, false),
                  formatTimeOfDay(r.minutes, true),
                  `${String(Math.floor(r.minutes / 60)).padStart(2, '0')} hundred`,
                ]),
              },
            ],
            notes: [
              'Military and 24-hour civilian time share the same numbers; the military convention writes them without a colon and reads "hundred" for a whole hour.',
              'Midnight is 0000 at the start of a day and 2400 at the end of one. Noon is 1200.',
            ],
          },
    [bulkRows, clock, clockTable, duration, hm, increment, isDecimal, minuteTable],
  )

  return (
    <div className="space-y-6">
      {isDecimal ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ToolPanel
              title="Convert in either direction"
              description="Type into either box. The other one follows immediately."
            >
              <CmFieldGrid columns={2}>
                <CmField
                  id="dh-hm"
                  label="Hours and minutes"
                  value={hm}
                  onChange={setFromHm}
                  placeholder="7:45"
                  hint="h:mm"
                  invalid={
                    parseDuration(hm) === null && hm.trim() !== ''
                      ? 'Use a duration like 7:45, 7h45 or 7.75.'
                      : undefined
                  }
                />
                <CmField
                  id="dh-dec"
                  label="Decimal hours"
                  value={dec}
                  onChange={setFromDec}
                  placeholder="7.75"
                  hint="what payroll wants"
                  invalid={
                    parseDuration(dec) === null && dec.trim() !== ''
                      ? 'Enter a number such as 7.75.'
                      : undefined
                  }
                />
              </CmFieldGrid>
              <div className="space-y-1.5">
                <span className="block text-sm font-medium">Payroll rounding</span>
                <CmSegmented
                  label="Rounding increment"
                  value={rounding}
                  onChange={setRounding}
                  options={ROUNDING.map((r) => ({ value: r.value, label: r.label }))}
                />
              </div>
            </ToolPanel>

            <ToolPanel title="Result">
              <ResultStat
                label="Decimal hours"
                value={duration.rounded.toFixed(increment === 0 ? 4 : 2)}
                hint={`${hoursToHm(duration.value)} in hours and minutes`}
                emphasis
              />
              <div className="grid grid-cols-2 gap-3">
                <CmStat label="Hours and minutes" value={hoursToHm(duration.value)} />
                <CmStat
                  label="Total minutes"
                  value={formatNumber(duration.totalMinutes, 0)}
                  hint="useful for invoicing"
                />
                <CmStat label="Total seconds" value={formatNumber(duration.totalSeconds, 0)} />
                <CmStat
                  label="As a share of a day"
                  value={`${((duration.value / 24) * 100).toFixed(2)}%`}
                  hint="of a 24-hour day"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={duration.rounded.toFixed(2)} label="Copy decimal" />
                <CopyButton value={hoursToHm(duration.value)} label="Copy h:mm" />
              </div>
            </ToolPanel>
          </div>

          <CmWorking
            items={[
              {
                label: 'Hours and minutes to decimal',
                general: 'decimal = hours + minutes ÷ 60',
                steps: [`= ${duration.hours} + ${duration.minutes} ÷ 60`],
                result: duration.value.toFixed(4),
              },
              {
                label: 'Decimal back to minutes',
                general: 'minutes = (decimal − whole hours) × 60',
                steps: [
                  `= (${duration.value.toFixed(4)} − ${duration.hours}) × 60 = ${duration.minutes} minutes`,
                ],
                result: hoursToHm(duration.value),
              },
              {
                label: 'Payroll rounding',
                general: 'rounded = round(decimal ÷ increment) × increment',
                steps: [
                  increment === 0
                    ? 'no rounding applied'
                    : `= round(${duration.value.toFixed(4)} ÷ ${increment}) × ${increment}`,
                ],
                result: duration.rounded.toFixed(2),
              },
            ]}
            note="One minute is 0.01666… hours, so a decimal figure with two places is accurate to about 36 seconds. Timesheets that must reconcile to the minute should use four places."
          />

          <ToolPanel
            title="Convert a whole column"
            description="Paste a column of times from a spreadsheet. h:mm values become decimals, and decimals become h:mm."
            footer={
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => setBulk('')}>
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBulk('7:45\n8:10\n6:30\n0:45\n9:05')}
                >
                  Paste an example
                </Button>
                <CopyButton
                  value={bulkRows.map((r) => r.output).join('\n')}
                  label="Copy results"
                />
              </>
            }
          >
            <div className="space-y-2">
              <Label htmlFor="dh-bulk">Times to convert, one per line</Label>
              <Textarea
                id="dh-bulk"
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                rows={6}
                spellCheck={false}
                placeholder={'7:45\n8:10\n6.5'}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
                {bulkRows.length > 0
                  ? `${bulkRows.filter((r) => r.ok).length} of ${bulkRows.length} lines converted.`
                  : 'Nothing pasted yet.'}
              </p>
            </div>
            {bulkRows.length > 0 ? (
              <CmDataTable
                ariaLabel="Bulk time conversion results"
                columns={bulkColumns}
                rows={bulkRows}
                pageSize={15}
                minWidth={380}
              />
            ) : null}
          </ToolPanel>

          <ToolPanel
            title="Minutes to decimal hours"
            description="The table worth printing and taping to the monitor."
            footer={<CmExportBar spec={exportSpec} />}
          >
            <CmDataTable
              ariaLabel="Minutes converted to decimal hours"
              columns={minuteColumns}
              rows={minuteTable}
              pageSize={12}
              minWidth={420}
            />
          </ToolPanel>

          <CmAssumptions
            items={[
              'Decimal hours are hours plus minutes divided by sixty. They are not the same as hours and minutes: 7.45 is seven hours and twenty-seven minutes, not seven hours forty-five.',
              'Payroll rounding is applied symmetrically: always to the nearest increment. Systems that always round down are unlawful in several jurisdictions, including under the US FLSA.',
              'Bulk mode reads each line independently and reverses the direction per line: anything containing a colon is treated as h:mm, anything else as a decimal.',
              'Negative durations are supported for corrections; write them with a leading minus, e.g. -0:15.',
            ]}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ToolPanel
              title="Convert in either direction"
              description="Type into either box. 1430, 14:30, 2:30 pm and 2.30pm all work."
              footer={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date()
                    setFrom24(
                      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
                    )
                  }}
                >
                  Use the time now
                </Button>
              }
            >
              <CmFieldGrid columns={2}>
                <CmField
                  id="mt-24"
                  label="24-hour (military)"
                  value={t24}
                  onChange={setFrom24}
                  placeholder="14:30"
                  hint="0000 to 2359"
                  invalid={
                    parseTimeOfDay(t24) === null && t24.trim() !== ''
                      ? 'Use a 24-hour time such as 1430 or 14:30.'
                      : undefined
                  }
                />
                <CmField
                  id="mt-12"
                  label="12-hour"
                  value={t12}
                  onChange={setFrom12}
                  placeholder="2:30 PM"
                  hint="with AM or PM"
                  invalid={
                    parseTimeOfDay(t12) === null && t12.trim() !== ''
                      ? 'Use a 12-hour time such as 2:30 PM.'
                      : undefined
                  }
                />
              </CmFieldGrid>
            </ToolPanel>

            <ToolPanel title="Result">
              <ResultStat
                label="24-hour clock"
                value={clock.display24.replace(':', '')}
                hint={`written ${clock.display24} · spoken “${clock.spoken}”`}
                emphasis
              />
              <div className="grid grid-cols-2 gap-3">
                <CmStat label="12-hour clock" value={clock.display12} />
                <CmStat label="With a colon" value={clock.display24} />
                <CmStat
                  label="Minutes after midnight"
                  value={formatNumber(clock.minutesSinceMidnight, 0)}
                />
                <CmStat
                  label="Through the day"
                  value={`${((clock.minutesSinceMidnight / 1440) * 100).toFixed(1)}%`}
                  hint="of a 24-hour day"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={clock.display24} label="Copy 24-hour" />
                <CopyButton value={clock.display12} label="Copy 12-hour" />
              </div>
            </ToolPanel>
          </div>

          <CmWorking
            items={[
              {
                label: 'Afternoon and evening (PM)',
                general: '24-hour = 12-hour + 12, for 1 PM to 11 PM',
                steps: [
                  clock.minutes >= 780 && clock.minutes < 1440
                    ? `${clock.display12} → ${Math.floor(clock.minutes / 60) - 12} + 12 = ${Math.floor(
                        clock.minutes / 60,
                      )}`
                    : 'this time is not in the 1 PM–11 PM range',
                ],
                result: clock.display24,
              },
              {
                label: 'Morning (AM)',
                general: '24-hour = 12-hour, with a leading zero; 12 AM becomes 00',
                steps: [
                  clock.minutes < 720
                    ? `${clock.display12} → ${clock.display24}`
                    : 'this time is not in the morning',
                ],
                result: clock.display24,
              },
              {
                label: 'Minutes after midnight',
                general: 'minutes = hours × 60 + minutes',
                steps: [
                  `= ${Math.floor(clock.minutesSinceMidnight / 60)} × 60 + ${
                    clock.minutesSinceMidnight % 60
                  }`,
                ],
                result: String(clock.minutesSinceMidnight),
              },
            ]}
            note="The only two times people get wrong are 12 AM (0000, midnight) and 12 PM (1200, noon). Everything between 1 PM and 11 PM is simply plus twelve."
          />

          <ToolPanel
            title="Convert a whole list"
            description="Paste a column of times. 24-hour entries come back as 12-hour, and 12-hour entries as 24-hour."
            footer={
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => setBulk('')}>
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBulk('0600\n09:15\n12:00\n1345\n18:30\n23:59')}
                >
                  Paste an example
                </Button>
                <CopyButton value={bulkRows.map((r) => r.output).join('\n')} label="Copy results" />
              </>
            }
          >
            <div className="space-y-2">
              <Label htmlFor="mt-bulk">Times to convert, one per line</Label>
              <Textarea
                id="mt-bulk"
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                rows={6}
                spellCheck={false}
                placeholder={'0600\n13:45\n9:15 pm'}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
                {bulkRows.length > 0
                  ? `${bulkRows.filter((r) => r.ok).length} of ${bulkRows.length} lines converted.`
                  : 'Nothing pasted yet.'}
              </p>
            </div>
            {bulkRows.length > 0 ? (
              <CmDataTable
                ariaLabel="Bulk military time conversion results"
                columns={bulkColumns}
                rows={bulkRows}
                pageSize={15}
                minWidth={380}
              />
            ) : null}
          </ToolPanel>

          <ToolPanel
            title="The full 24-hour clock"
            description="Every hour, written and spoken."
            footer={<CmExportBar spec={exportSpec} />}
          >
            <CmDataTable
              ariaLabel="Twenty-four hour clock reference table"
              columns={clockColumns}
              rows={clockTable}
              pageSize={24}
              minWidth={380}
            />
          </ToolPanel>

          <CmAssumptions
            items={[
              'Military time and the 24-hour clock use identical numbers. The military convention drops the colon (1430) and reads whole hours as "hundred"; NATO usage often appends a time-zone letter such as Z for UTC.',
              'Midnight is 0000 at the start of a day. Some organisations write 2400 for midnight at the end of a day; both refer to the same instant.',
              'Noon is 1200. There is no 1200 AM or 1200 PM in 24-hour notation, which is precisely why it is used for anything safety-critical.',
              'Times are parsed leniently: 930, 9:30, 09:30, 9.30am and 9 30 all resolve to the same time.',
              'This page converts notation only. It does not convert between time zones.',
            ]}
          />
        </>
      )}
    </div>
  )
}
