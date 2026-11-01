import { useMemo, useState } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { ArrowLeftRight, CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { formatNumber } from '@/components/tools/finance/format'
import { MiniStat, useTodayInput, useZoneState } from './common'
import { calendarSpan, localNoon, parseDateInput, parseTimeInput } from './tz'
import {
  DEFAULT_WEEKEND,
  WEEKDAY_LABELS,
  countWorkingDays,
  toDayNumber,
  weekdayOfDayNumber,
} from './workdays'

const NO_HOLIDAYS = new Set<string>()

const ymdBetween = calendarSpan

export default function DateDifferenceCalculator() {
  const [zone] = useZoneState()
  const [start, setStart] = useTodayInput(zone)
  const [end, setEnd] = useState('')
  const [withTime, setWithTime] = useState(false)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [includeEnd, setIncludeEnd] = useState(false)
  const [businessOnly, setBusinessOnly] = useState(false)

  const swap = () => {
    setStart(end)
    setEnd(start)
    if (withTime) {
      setStartTime(endTime)
      setEndTime(startTime)
    }
  }

  const result = useMemo(() => {
    const a = parseDateInput(start)
    const b = parseDateInput(end)
    if (!a || !b) return null

    const aNum = toDayNumber(a)
    const bNum = toDayNumber(b)
    const reversed = bNum < aNum
    const from = reversed ? b : a
    const to = reversed ? a : b
    const fromNum = Math.min(aNum, bNum)
    const toNum = Math.max(aNum, bNum)

    const exclusiveDays = toNum - fromNum
    const inclusiveDays = exclusiveDays + 1
    const counted = includeEnd ? inclusiveDays : exclusiveDays

    const ymd = ymdBetween(from, to)
    const weeks = Math.floor(counted / 7)
    const weekRemainder = counted % 7

    const rules = { weekend: DEFAULT_WEEKEND, holidays: NO_HOLIDAYS }
    // Business days always count both endpoints of the working range, so the
    // "exclude end date" variant drops the final day if it is a working day.
    const businessInclusive = countWorkingDays(fromNum, toNum, rules)
    const endIsWorking = !DEFAULT_WEEKEND[weekdayOfDayNumber(toNum)]
    const businessDays = includeEnd
      ? businessInclusive.workingDays
      : Math.max(0, businessInclusive.workingDays - (endIsWorking ? 1 : 0))

    let hours: number | null = null
    let minutes: number | null = null
    let seconds: number | null = null
    let timeError: string | null = null
    if (withTime) {
      const ta = parseTimeInput(startTime)
      const tb = parseTimeInput(endTime)
      if (!ta || !tb) {
        timeError = 'Enter both times as HH:MM.'
      } else {
        const aMs = new Date(a.year, a.month - 1, a.day, ta.hour, ta.minute, ta.second).getTime()
        const bMs = new Date(b.year, b.month - 1, b.day, tb.hour, tb.minute, tb.second).getTime()
        const diff = Math.abs(bMs - aMs)
        hours = Math.floor(diff / 3_600_000)
        minutes = Math.floor(diff / 60_000)
        seconds = Math.floor(diff / 1000)
      }
    }

    const fromDate = localNoon(from.year, from.month, from.day)
    const toDate = localNoon(to.year, to.month, to.day)

    return {
      reversed,
      counted,
      exclusiveDays,
      inclusiveDays,
      ymd,
      weeks,
      weekRemainder,
      businessDays,
      weekendDays: businessInclusive.weekendDays,
      hours,
      minutes,
      seconds,
      timeError,
      fromLabel: format(fromDate, 'EEEE, d MMMM yyyy'),
      toLabel: format(toDate, 'EEEE, d MMMM yyyy'),
      fromWeekday: WEEKDAY_LABELS[weekdayOfDayNumber(fromNum)] ?? '',
      toWeekday: WEEKDAY_LABELS[weekdayOfDayNumber(toNum)] ?? '',
      calendarDaysCheck: differenceInCalendarDays(toDate, fromDate),
      approxMonths: counted / 30.436875,
      approxYears: counted / 365.2425,
    }
  }, [start, end, includeEnd, withTime, startTime, endTime])

  const headline = result ? (businessOnly ? result.businessDays : result.counted) : 0

  const summary = useMemo(() => {
    if (!result) return ''
    return [
      `From ${result.fromLabel}`,
      `To   ${result.toLabel}`,
      `${includeEnd ? 'Including' : 'Excluding'} the end date${businessOnly ? ', business days only' : ''}`,
      '',
      `${formatNumber(headline, 0)} days`,
      `${result.ymd.years} years, ${result.ymd.months} months, ${result.ymd.days} days`,
      `${formatNumber(result.weeks, 0)} weeks and ${result.weekRemainder} days`,
      `Business days (Mon–Fri): ${formatNumber(result.businessDays, 0)}`,
      result.hours !== null ? `Elapsed: ${formatNumber(result.hours, 0)} hours` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }, [result, headline, includeEnd, businessOnly])

  return (
    <div className="space-y-6">
      <ToolPanel title="Two dates" description="Pick a start and an end date. The result updates as you type.">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="dd-start">Start date</Label>
            <Input id="dd-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            {withTime ? (
              <>
                <Label htmlFor="dd-start-time" className="sr-only">
                  Start time
                </Label>
                <Input
                  id="dd-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Swap start and end dates"
            onClick={swap}
            className="hidden sm:inline-flex"
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor="dd-end">End date</Label>
            <Input id="dd-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            {withTime ? (
              <>
                <Label htmlFor="dd-end-time" className="sr-only">
                  End time
                </Label>
                <Input
                  id="dd-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </>
            ) : null}
          </div>
        </div>

        <Button type="button" variant="outline" onClick={swap} className="mt-3 w-full sm:hidden">
          <ArrowLeftRight className="mr-2 h-4 w-4" aria-hidden="true" />
          Swap dates
        </Button>

        <div className="mt-4 grid gap-3 rounded-lg bg-muted p-3 sm:grid-cols-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="dd-include" className="cursor-pointer text-sm font-normal">
              Include end date
            </Label>
            <Switch id="dd-include" checked={includeEnd} onCheckedChange={setIncludeEnd} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="dd-business" className="cursor-pointer text-sm font-normal">
              Business days only
            </Label>
            <Switch id="dd-business" checked={businessOnly} onCheckedChange={setBusinessOnly} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="dd-time" className="cursor-pointer text-sm font-normal">
              Include time of day
            </Label>
            <Switch id="dd-time" checked={withTime} onCheckedChange={setWithTime} />
          </div>
        </div>
      </ToolPanel>

      {result?.timeError ? <ErrorNote message={result.timeError} /> : null}

      {!result ? (
        <div className="rounded-xl bg-muted p-8 text-center">
          <CalendarRange className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            Choose both dates to see days, weeks, months and business days between them.
          </p>
        </div>
      ) : (
        <div className="space-y-6" role="status" aria-live="polite">
          <div className="rounded-xl bg-card p-5 sm:p-6">
            <div className="text-sm font-medium text-muted-foreground">
              {businessOnly ? 'Business days between' : 'Days between'}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <span className="text-4xl font-bold tabular-nums text-foreground sm:text-5xl">
                {formatNumber(headline, 0)}
              </span>
              <span className="text-lg text-muted-foreground">
                {headline === 1 ? 'day' : 'days'}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {result.fromLabel} → {result.toLabel}
              {result.reversed ? ' (dates were in reverse order, so they were swapped)' : ''}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {includeEnd
                ? 'Both the start and the end date are counted.'
                : 'The end date is not counted. This is elapsed time.'}
            </p>
            <div className="mt-4">
              <CopyButton value={summary} label="Copy result" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ResultStat
              label="Years, months, days"
              value={`${result.ymd.years}y ${result.ymd.months}m ${result.ymd.days}d`}
              hint="whole calendar units"
              emphasis
            />
            <ResultStat
              label="Weeks"
              value={`${formatNumber(result.weeks, 0)} weeks`}
              hint={`plus ${result.weekRemainder} day${result.weekRemainder === 1 ? '' : 's'}`}
            />
            <ResultStat
              label="Business days"
              value={formatNumber(result.businessDays, 0)}
              hint="Monday to Friday only"
            />
            <ResultStat
              label="Excluding end date"
              value={`${formatNumber(result.exclusiveDays, 0)} days`}
            />
            <ResultStat
              label="Including end date"
              value={`${formatNumber(result.inclusiveDays, 0)} days`}
            />
            <ResultStat
              label="Weekend days in range"
              value={formatNumber(result.weekendDays, 0)}
              hint="Saturdays and Sundays"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Start falls on" value={result.fromWeekday} />
            <MiniStat label="End falls on" value={result.toWeekday} />
            <MiniStat
              label="Average months"
              value={formatNumber(result.approxMonths, 2)}
              hint="days ÷ 30.4369"
            />
            <MiniStat
              label="Average years"
              value={formatNumber(result.approxYears, 3)}
              hint="days ÷ 365.2425"
            />
          </div>

          {withTime && result.hours !== null && result.minutes !== null && result.seconds !== null ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <ResultStat label="Total hours" value={formatNumber(result.hours, 0)} />
              <ResultStat label="Total minutes" value={formatNumber(result.minutes, 0)} />
              <ResultStat label="Total seconds" value={formatNumber(result.seconds, 0)} />
            </div>
          ) : null}

          <div className="rounded-xl bg-muted p-5">
            <h3 className="text-sm font-semibold text-foreground">The working</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>
                Calendar days between the two dates: {formatNumber(result.calendarDaysCheck, 0)}.
              </li>
              <li>
                Add 1 when both endpoints are counted → {formatNumber(result.inclusiveDays, 0)} days.
              </li>
              <li>
                Weekends removed: {formatNumber(result.weekendDays, 0)} →{' '}
                {formatNumber(result.businessDays, 0)} business days.
              </li>
              <li>
                Years/months/days is a calendar walk from {result.fromLabel}, not a division, so it
                respects month lengths and leap years.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
