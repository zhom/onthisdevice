import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Briefcase, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { downloadBlob } from '@/lib/utils'
import { formatNumber } from '@/components/tools/finance/format'
import { MiniStat, useMounted, usePersistentState, useTodayInput, useZoneState } from './common'
import { localNoon, parseDateInput } from './tz'
import { daysOffForYear } from './holidays'
import type { DaysOffSet } from './holidays'
import {
  DEFAULT_WEEKEND,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  countWorkingDays,
  describeWeekend,
  formatDayNumber,
  toDayNumber,
} from './workdays'
import type { WeekendMask } from './workdays'

interface HolidayEntry {
  date: string // YYYY-MM-DD
  name: string
}

const STORAGE_KEY = 'otd:business-days:holidays'
const WEEKEND_KEY = 'otd:business-days:weekend'

const IMPORT_SETS: { id: DaysOffSet; label: string }[] = [
  { id: 'us', label: 'US federal holidays' },
  { id: 'uk', label: 'UK bank holidays (England and Wales)' },
  { id: 'global', label: 'New Year’s Day and Christmas Day' },
]

function isoOf(date: { year: number; month: number; day: number }): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

export default function BusinessDaysCalculator() {
  const mounted = useMounted()
  const [zone] = useZoneState()
  const [start, setStart] = useTodayInput(zone)
  const [end, setEnd] = useState('')
  const [weekend, setWeekend] = usePersistentState<boolean[]>(WEEKEND_KEY, [...DEFAULT_WEEKEND])
  const [holidays, setHolidays] = usePersistentState<HolidayEntry[]>(STORAGE_KEY, [])
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [importYear, setImportYear] = useState('')

  const weekendMask = useMemo<WeekendMask>(() => {
    const m = [0, 1, 2, 3, 4, 5, 6].map((i) => weekend[i] === true)
    return m as unknown as WeekendMask
  }, [weekend])

  const sortedHolidays = useMemo(
    () => [...holidays].sort((a, b) => a.date.localeCompare(b.date)),
    [holidays],
  )

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays])
  const holidayNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of holidays) map.set(h.date, h.name)
    return map
  }, [holidays])

  const addHoliday = () => {
    const parsed = parseDateInput(newDate)
    if (!parsed) {
      setAddError('Pick a valid date for the holiday.')
      return
    }
    if (holidaySet.has(newDate)) {
      setAddError('That date is already in your holiday list.')
      return
    }
    setAddError(null)
    setHolidays([...holidays, { date: newDate, name: newName.trim() || 'Holiday' }])
    setNewName('')
  }

  const removeHoliday = (date: string) => {
    setHolidays(holidays.filter((h) => h.date !== date))
  }

  const importSet = (set: DaysOffSet) => {
    const year = Number(importYear) || new Date().getFullYear()
    const found = daysOffForYear(year, set)
    const merged = [...holidays]
    const seen = new Set(holidays.map((h) => h.date))
    for (const h of found) {
      const iso = isoOf(h.date)
      if (seen.has(iso)) continue
      seen.add(iso)
      merged.push({ date: iso, name: h.name })
    }
    setHolidays(merged)
    setAddError(null)
  }

  const result = useMemo(() => {
    const a = parseDateInput(start)
    const b = parseDateInput(end)
    if (!a || !b) return null
    const aNum = toDayNumber(a)
    const bNum = toDayNumber(b)
    const from = Math.min(aNum, bNum)
    const to = Math.max(aNum, bNum)
    if (to - from > 200_000) {
      return { error: 'That range is longer than 500 years. Narrow it down a little.' } as const
    }
    const counted = countWorkingDays(from, to, { weekend: weekendMask, holidays: holidaySet })
    const perWeekday = [0, 0, 0, 0, 0, 0, 0]
    for (let d = from; d <= to; d++) {
      const wd = (((d + 4) % 7) + 7) % 7
      if (!weekendMask[wd] && !holidaySet.has(formatDayNumber(d))) perWeekday[wd] = (perWeekday[wd] ?? 0) + 1
    }
    return {
      error: null,
      from,
      to,
      reversed: bNum < aNum,
      ...counted,
      perWeekday,
    } as const
  }, [start, end, weekendMask, holidaySet])

  const summary = useMemo(() => {
    if (!result || result.error) return ''
    return [
      `Business days from ${formatDayNumber(result.from)} to ${formatDayNumber(result.to)} (both inclusive)`,
      `Weekend: ${describeWeekend(weekendMask)}`,
      '',
      `Total calendar days: ${result.totalDays}`,
      `Weekend days:        ${result.weekendDays}`,
      `Holidays excluded:   ${result.holidayDays}`,
      `Working days:        ${result.workingDays}`,
      result.holidaysApplied.length
        ? `\nExcluded holidays:\n${result.holidaysApplied.map((d) => `  ${d}: ${holidayNames.get(d) ?? 'Holiday'}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')
  }, [result, weekendMask, holidayNames])

  const exportCsv = () => {
    const rows = ['date,name', ...sortedHolidays.map((h) => `${h.date},"${h.name.replace(/"/g, '""')}"`)]
    downloadBlob(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }), 'holidays.csv')
  }

  return (
    <div className="space-y-6">
      <ToolPanel title="Date range" description="Both the start and the end date are included when they are working days.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bd-start">Start date</Label>
            <Input id="bd-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd-end">End date</Label>
            <Input id="bd-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-foreground">Non-working days of the week</legend>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {WEEKDAY_SHORT.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <Checkbox
                  id={`bd-wd-${i}`}
                  checked={weekend[i] === true}
                  onCheckedChange={(checked) => {
                    const next = [...weekend]
                    next[i] = checked === true
                    setWeekend(next)
                  }}
                />
                <Label htmlFor={`bd-wd-${i}`} className="cursor-pointer text-sm font-normal">
                  <span className="sm:hidden">{label}</span>
                  <span className="hidden sm:inline">{WEEKDAY_LABELS[i]}</span>
                </Label>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Currently treating {describeWeekend(weekendMask)} as non-working.
          </p>
        </fieldset>
      </ToolPanel>

      <ToolPanel
        title="Your holiday list"
        description="Saved in this browser only. Nothing is uploaded, and it is reused every time you come back."
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,10rem)_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="bd-holiday-date">Date</Label>
            <Input id="bd-holiday-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd-holiday-name">Name</Label>
            <Input
              id="bd-holiday-name"
              value={newName}
              placeholder="Company shutdown"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addHoliday()
                }
              }}
            />
          </div>
          <Button type="button" onClick={addHoliday}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add holiday
          </Button>
        </div>

        {addError ? (
          <div className="mt-3">
            <ErrorNote message={addError} />
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 rounded-lg bg-muted p-3 sm:grid-cols-[minmax(0,8rem)_1fr] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="bd-import-year">Import year</Label>
            <Input
              id="bd-import-year"
              type="number"
              inputMode="numeric"
              placeholder={mounted ? String(new Date().getFullYear()) : '2026'}
              value={importYear}
              onChange={(e) => setImportYear(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {IMPORT_SETS.map((set) => (
              <Button
                key={set.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto min-h-8 max-w-full shrink py-1.5 text-left whitespace-normal"
                onClick={() => importSet(set.id)}
              >
                Add {set.label}
              </Button>
            ))}
          </div>
        </div>

        {sortedHolidays.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No holidays yet. The count removes only weekends until you add some.
          </p>
        ) : (
          <div className="mt-4">
            <div className="max-h-64 overflow-y-auto rounded-lg">
              <ul className="divide-y divide-border">
                {sortedHolidays.map((h) => (
                  <li key={h.date} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium tabular-nums text-foreground">{h.date}</span>
                      <span className="ml-2 text-muted-foreground">{h.name}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${h.name} on ${h.date}`}
                      onClick={() => removeHoliday(h.date)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
                Export list as CSV
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setHolidays([])}>
                Clear all {sortedHolidays.length} holidays
              </Button>
            </div>
          </div>
        )}
      </ToolPanel>

      {result?.error ? <ErrorNote message={result.error} /> : null}

      {!result ? (
        <div className="rounded-xl bg-muted p-8 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            Choose a start and end date to count the working days between them.
          </p>
        </div>
      ) : result.error ? null : (
        <div className="space-y-6" role="status" aria-live="polite">
          <div className="rounded-xl bg-card p-5 sm:p-6">
            <div className="text-sm font-medium text-muted-foreground">Working days</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <span className="text-4xl font-bold tabular-nums text-foreground sm:text-5xl">
                {formatNumber(result.workingDays, 0)}
              </span>
              <span className="text-lg text-muted-foreground">
                {result.workingDays === 1 ? 'day' : 'days'}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {format(localNoon(...dateParts(result.from)), 'EEEE, d MMMM yyyy')} →{' '}
              {format(localNoon(...dateParts(result.to)), 'EEEE, d MMMM yyyy')}, both included
              {result.reversed ? ' (dates were swapped into order)' : ''}.
            </p>
            <div className="mt-4">
              <CopyButton value={summary} label="Copy breakdown" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ResultStat label="Calendar days" value={formatNumber(result.totalDays, 0)} emphasis />
            <ResultStat label="Weekend days" value={formatNumber(result.weekendDays, 0)} hint={describeWeekend(weekendMask)} />
            <ResultStat label="Holidays removed" value={formatNumber(result.holidayDays, 0)} hint="from your saved list" />
            <ResultStat
              label="Working weeks"
              value={formatNumber(result.workingDays / Math.max(1, 7 - weekendMask.filter(Boolean).length), 2)}
              hint="working days ÷ working days per week"
            />
          </div>

          <div className="rounded-xl bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">Working days by weekday</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[22rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    {WEEKDAY_SHORT.map((d) => (
                      <th key={d} scope="col" className="px-2 py-1 font-medium">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {result.perWeekday.map((n, i) => (
                      <td key={i} className="px-2 py-2 tabular-nums text-foreground">
                        {weekendMask[i] ? <span className="text-muted-foreground">–</span> : n}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {result.holidaysApplied.length > 0 ? (
            <div className="rounded-xl bg-muted p-5">
              <h3 className="text-sm font-semibold text-foreground">
                Holidays removed from the count ({result.holidaysApplied.length})
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {result.holidaysApplied.map((d) => (
                  <li key={d}>
                    <span className="tabular-nums text-foreground">{d}</span>: {holidayNames.get(d) ?? 'Holiday'}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Holidays that fall on a non-working weekday are not listed here, because they were already
                excluded by the weekend rule.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function dateParts(dayNumber: number): [number, number, number] {
  const d = new Date(dayNumber * 86_400_000)
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]
}
