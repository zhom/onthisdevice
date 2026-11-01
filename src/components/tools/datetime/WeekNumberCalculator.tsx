import { useMemo, useState } from 'react'
import {
  addDays,
  endOfISOWeek,
  format,
  getDayOfYear,
  getISOWeek,
  getISOWeekYear,
  getISOWeeksInYear,
  getQuarter,
  getWeek,
  setISOWeek,
  startOfISOWeek,
} from 'date-fns'
import { CalendarSearch, Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { MiniStat, useMounted, useTodayInput, useZoneState } from './common'
import { localNoon, parseDateInput, todayInZone } from './tz'

function isoWeekStart(isoYear: number, week: number): Date {
  // 4 January is always in ISO week 1 of its year.
  return startOfISOWeek(setISOWeek(new Date(isoYear, 0, 4, 12), week))
}

export default function WeekNumberCalculator() {
  const mounted = useMounted()
  const [zone] = useZoneState()
  const [dateValue, setDateValue] = useTodayInput(zone)
  const [weekInput, setWeekInput] = useState('1')
  const [yearInput, setYearInput] = useState('')
  const [tableYear, setTableYear] = useState('')

  const today = mounted ? todayInZone(zone) : null
  const todayDate = today ? localNoon(today.year, today.month, today.day) : null

  const parsed = parseDateInput(dateValue)
  const date = parsed ? localNoon(parsed.year, parsed.month, parsed.day) : null

  const info = useMemo(() => {
    if (!date) return null
    const isoWeek = getISOWeek(date)
    const isoYear = getISOWeekYear(date)
    const start = startOfISOWeek(date)
    const end = endOfISOWeek(date)
    return {
      isoWeek,
      isoYear,
      start,
      end,
      usWeek: getWeek(date, { weekStartsOn: 0, firstWeekContainsDate: 1 }),
      dayOfYear: getDayOfYear(date),
      quarter: getQuarter(date),
      weeksInIsoYear: getISOWeeksInYear(new Date(isoYear, 5, 1)),
      differsFromCalendarYear: isoYear !== date.getFullYear(),
    }
  }, [date])

  const lookupYear = Number(yearInput) || (today ? today.year : 2026)
  const lookupWeek = Number(weekInput)
  const weeksInLookupYear = getISOWeeksInYear(new Date(lookupYear, 5, 1))
  const lookupValid =
    Number.isInteger(lookupWeek) && lookupWeek >= 1 && lookupWeek <= weeksInLookupYear && lookupYear >= 1 && lookupYear <= 9999

  const lookup = useMemo(() => {
    if (!lookupValid) return null
    const start = isoWeekStart(lookupYear, lookupWeek)
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
    return { start, end: addDays(start, 6), days }
  }, [lookupValid, lookupYear, lookupWeek])

  const yearForTable = Number(tableYear) || (today ? today.year : 2026)
  const tableValid = yearForTable >= 1 && yearForTable <= 9999
  const weekTable = useMemo(() => {
    if (!tableValid) return []
    const count = getISOWeeksInYear(new Date(yearForTable, 5, 1))
    return Array.from({ length: count }, (_, i) => {
      const start = isoWeekStart(yearForTable, i + 1)
      return { week: i + 1, start, end: addDays(start, 6) }
    })
  }, [tableValid, yearForTable])

  const currentWeek = todayDate ? getISOWeek(todayDate) : null
  const currentIsoYear = todayDate ? getISOWeekYear(todayDate) : null

  const summary =
    info && date
      ? [
        `Date: ${format(date, 'EEEE, d MMMM yyyy')}`,
        `ISO 8601 week: ${info.isoWeek} of ${info.isoYear} (${info.isoYear}-W${String(info.isoWeek).padStart(2, '0')})`,
        `Week runs: ${format(info.start, 'EEE d MMM yyyy')} to ${format(info.end, 'EEE d MMM yyyy')}`,
        `US week number: ${info.usWeek}`,
        `Day of year: ${info.dayOfYear} · Quarter: Q${info.quarter}`,
        ].join('\n')
      : ''

  return (
    <div className="space-y-6">
      {mounted && currentWeek !== null ? (
        <div className="rounded-xl bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">Right now</div>
          <div className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            ISO week {currentWeek} of {currentIsoYear}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {todayDate
              ? `${format(startOfISOWeek(todayDate), 'EEE d MMM')} to ${format(endOfISOWeek(todayDate), 'EEE d MMM yyyy')} · ${zone}`
              : null}
          </p>
        </div>
      ) : null}

      <Tabs defaultValue="date" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="date" className="flex-1">
            Date → week
          </TabsTrigger>
          <TabsTrigger value="week" className="flex-1">
            Week → dates
          </TabsTrigger>
          <TabsTrigger value="year" className="flex-1">
            Whole year
          </TabsTrigger>
        </TabsList>

        <TabsContent value="date" className="mt-4 space-y-6">
          <ToolPanel title="Find the week number" description="ISO 8601 weeks run Monday to Sunday.">
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="wn-date">Date</Label>
              <Input id="wn-date" type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
            </div>
          </ToolPanel>

          {dateValue && !parsed ? <ErrorNote message="That isn’t a real calendar date." /> : null}

          {info && date ? (
            <div className="space-y-4" role="status" aria-live="polite">
              <div className="rounded-xl bg-card p-5 sm:p-6">
                <div className="text-sm font-medium text-muted-foreground">ISO 8601 week</div>
                <div className="mt-1 flex flex-wrap items-baseline gap-3">
                  <span className="text-4xl font-bold tabular-nums text-foreground sm:text-5xl">{info.isoWeek}</span>
                  <span className="text-lg text-muted-foreground">
                    of {info.isoYear} · {info.isoYear}-W{String(info.isoWeek).padStart(2, '0')}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {format(date, 'EEEE, d MMMM yyyy')} falls in the week of{' '}
                  {format(info.start, 'EEE d MMM')} to {format(info.end, 'EEE d MMM yyyy')}.
                </p>
                {info.differsFromCalendarYear ? (
                  <p className="mt-2 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>Note: the ISO week-numbering year ({info.isoYear}) differs from the calendar year (
                    {date.getFullYear()}) because a week belongs to the year that holds its Thursday.</span>
                  </p>
                ) : null}
                <div className="mt-4">
                  <CopyButton value={summary} label="Copy details" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ResultStat label="US week number" value={String(info.usWeek)} hint="Sunday start, week 1 holds 1 Jan" />
                <MiniStat label="Day of year" value={info.dayOfYear} hint={`of ${format(date, 'yyyy')}`} />
                <MiniStat label="Quarter" value={`Q${info.quarter}`} />
                <MiniStat label="Weeks in ISO year" value={info.weeksInIsoYear} hint={`${info.isoYear} has ${info.weeksInIsoYear} ISO weeks`} />
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="week" className="mt-4 space-y-6">
          <ToolPanel title="Look up a week" description="Enter a week number and year to see the exact dates it covers.">
            <div className="grid gap-4 sm:grid-cols-2 sm:max-w-lg">
              <div className="space-y-1.5">
                <Label htmlFor="wn-week">Week number</Label>
                <Input
                  id="wn-week"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={53}
                  value={weekInput}
                  onChange={(e) => setWeekInput(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wn-year">Year</Label>
                <Input
                  id="wn-year"
                  type="number"
                  inputMode="numeric"
                  placeholder={today ? String(today.year) : '2026'}
                  value={yearInput}
                  onChange={(e) => setYearInput(e.target.value)}
                />
              </div>
            </div>
          </ToolPanel>

          {!lookupValid ? (
            <ErrorNote
              message={`Enter a week between 1 and ${weeksInLookupYear} for ${lookupYear}.`}
            />
          ) : lookup ? (
            <div className="space-y-4" role="status" aria-live="polite">
              <div className="rounded-xl bg-card p-5">
                <div className="text-sm font-medium text-muted-foreground">
                  Week {lookupWeek} of {lookupYear}
                </div>
                <div className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
                  {format(lookup.start, 'd MMM')} to {format(lookup.end, 'd MMM yyyy')}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Monday {format(lookup.start, 'd MMMM yyyy')} to Sunday {format(lookup.end, 'd MMMM yyyy')}
                </p>
                <div className="mt-4">
                  <CopyButton
                    value={`${lookupYear}-W${String(lookupWeek).padStart(2, '0')}: ${format(lookup.start, 'EEE d MMM yyyy')} to ${format(lookup.end, 'EEE d MMM yyyy')}`}
                    label="Copy range"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg">
                <table className="w-full min-w-[20rem] text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Day</th>
                      <th scope="col" className="px-3 py-2 font-medium">Date</th>
                      <th scope="col" className="px-3 py-2 font-medium">ISO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lookup.days.map((d) => (
                      <tr key={d.toISOString()}>
                        <td className="px-3 py-2">{format(d, 'EEEE')}</td>
                        <td className="px-3 py-2">{format(d, 'd MMMM yyyy')}</td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{format(d, 'yyyy-MM-dd')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="year" className="mt-4 space-y-6">
          <ToolPanel title="Every week of a year" description="All ISO weeks with their Monday and Sunday dates.">
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="wn-table-year">Year</Label>
              <Input
                id="wn-table-year"
                type="number"
                inputMode="numeric"
                placeholder={today ? String(today.year) : '2026'}
                value={tableYear}
                onChange={(e) => setTableYear(e.target.value)}
              />
            </div>
          </ToolPanel>

          {!tableValid ? (
            <ErrorNote message="Enter a year between 1 and 9999." />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {yearForTable} has {weekTable.length} ISO weeks.
              </p>
              <div className="max-h-[32rem] overflow-auto rounded-lg">
                <table className="w-full min-w-[24rem] text-left text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Week</th>
                      <th scope="col" className="px-3 py-2 font-medium">Monday</th>
                      <th scope="col" className="px-3 py-2 font-medium">Sunday</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {weekTable.map((w) => {
                      const isNow = currentWeek === w.week && currentIsoYear === yearForTable
                      return (
                        <tr key={w.week} className={isNow ? 'bg-muted font-semibold' : undefined}>
                          <td className="px-3 py-1.5 tabular-nums">
                            W{String(w.week).padStart(2, '0')}
                            {isNow ? <span className="ml-2 text-xs">current</span> : null}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums">{format(w.start, 'd MMM yyyy')}</td>
                          <td className="px-3 py-1.5 tabular-nums">{format(w.end, 'd MMM yyyy')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <CopyButton
                value={[
                  `ISO weeks of ${yearForTable}`,
                  ...weekTable.map(
                    (w) => `W${String(w.week).padStart(2, '0')}  ${format(w.start, 'yyyy-MM-dd')} → ${format(w.end, 'yyyy-MM-dd')}`,
                  ),
                ].join('\n')}
                label="Copy the whole year"
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {!mounted ? (
        <div className="rounded-xl bg-muted p-8 text-center">
          <CalendarSearch className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">Loading the current week…</p>
        </div>
      ) : null}
    </div>
  )
}
