import { useMemo, useState } from 'react'
import { addDays, addMonths, addWeeks, addYears, format, getDayOfYear, getISOWeek } from 'date-fns'
import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { formatNumber } from '@/components/tools/finance/format'
import { MiniStat, useTodayInput, useZoneState } from './common'
import { localNoon, parseDateInput } from './tz'
import {
  DEFAULT_WEEKEND,
  WEEKDAY_LABELS,
  addWorkingDays,
  countWorkingDays,
  fromDayNumber,
  toDayNumber,
  weekdayOfDayNumber,
} from './workdays'

const NO_HOLIDAYS = new Set<string>()
const RULES = { weekend: DEFAULT_WEEKEND, holidays: NO_HOLIDAYS }

type Direction = 'add' | 'subtract'

const PRESETS: { label: string; days?: number; weeks?: number; months?: number; years?: number }[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '6 months', months: 6 },
  { label: '1 year', years: 1 },
]

/** Larger offsets are refused (about 380 years of working days). */
const MAX_BUSINESS_DAYS = 100_000

/** True when the offset would land outside the years 1 to 9999. */
function outOfRange(start: string, sign: number, y: number, mo: number, w: number, d: number): boolean {
  const parsed = parseDateInput(start)
  if (!parsed) return false
  const landing = parsed.year + (sign * (y * 365.2425 + mo * 30.436875 + w * 7 + d)) / 365.2425
  return !(landing >= 1 && landing <= 9999)
}

function toInt(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

export default function DateCalculator() {
  const [zone] = useZoneState()
  const [startDate, setStartDate] = useTodayInput(zone)
  const [direction, setDirection] = useState<Direction>('add')
  const [years, setYears] = useState('0')
  const [months, setMonths] = useState('0')
  const [weeks, setWeeks] = useState('0')
  const [days, setDays] = useState('30')
  const [businessMode, setBusinessMode] = useState(false)
  const [businessDays, setBusinessDays] = useState('10')

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setBusinessMode(false)
    setYears(String(p.years ?? 0))
    setMonths(String(p.months ?? 0))
    setWeeks(String(p.weeks ?? 0))
    setDays(String(p.days ?? 0))
  }

  const result = useMemo(() => {
    const parsed = parseDateInput(startDate)
    if (!parsed) return null
    const sign = direction === 'add' ? 1 : -1
    const startNum = toDayNumber(parsed)
    const start = localNoon(parsed.year, parsed.month, parsed.day)

    if (businessMode) {
      const n = toInt(businessDays)
      if (Math.abs(n) > MAX_BUSINESS_DAYS) return null
      const endNum = addWorkingDays(startNum, sign * n, RULES)
      const end = fromDayNumber(endNum)
      const endDate = localNoon(end.year, end.month, end.day)
      const span = countWorkingDays(Math.min(startNum, endNum), Math.max(startNum, endNum), RULES)
      return {
        kind: 'business' as const,
        start,
        endDate,
        calendarDays: endNum - startNum,
        steps: [
          `Start: ${format(start, 'EEEE, d MMMM yyyy')}`,
          `${direction === 'add' ? 'Skip forward' : 'Skip back'} ${Math.abs(n)} working day${Math.abs(n) === 1 ? '' : 's'}, ignoring Saturdays and Sundays`,
          `Result: ${format(endDate, 'EEEE, d MMMM yyyy')} (${Math.abs(endNum - startNum)} calendar day${Math.abs(endNum - startNum) === 1 ? '' : 's'} away)`,
        ],
        weekendsSkipped: span.weekendDays,
        startNum,
        endNum,
      }
    }

    const y = toInt(years)
    const mo = toInt(months)
    const w = toInt(weeks)
    const d = toInt(days)
    if (outOfRange(startDate, sign, y, mo, w, d)) return null

    const steps: string[] = [`Start: ${format(start, 'EEEE, d MMMM yyyy')}`]
    let cursor = start
    if (y !== 0) {
      cursor = addYears(cursor, sign * y)
      steps.push(`${sign * y >= 0 ? '+' : '−'}${Math.abs(y)} year${Math.abs(y) === 1 ? '' : 's'} → ${format(cursor, 'd MMM yyyy')}`)
    }
    if (mo !== 0) {
      cursor = addMonths(cursor, sign * mo)
      steps.push(`${sign * mo >= 0 ? '+' : '−'}${Math.abs(mo)} month${Math.abs(mo) === 1 ? '' : 's'} → ${format(cursor, 'd MMM yyyy')}`)
    }
    if (w !== 0) {
      cursor = addWeeks(cursor, sign * w)
      steps.push(`${sign * w >= 0 ? '+' : '−'}${Math.abs(w)} week${Math.abs(w) === 1 ? '' : 's'} → ${format(cursor, 'd MMM yyyy')}`)
    }
    if (d !== 0) {
      cursor = addDays(cursor, sign * d)
      steps.push(`${sign * d >= 0 ? '+' : '−'}${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} → ${format(cursor, 'd MMM yyyy')}`)
    }

    const endNum = toDayNumber({
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      day: cursor.getDate(),
    })
    const span = countWorkingDays(Math.min(startNum, endNum), Math.max(startNum, endNum), RULES)

    return {
      kind: 'calendar' as const,
      start,
      endDate: cursor,
      calendarDays: endNum - startNum,
      steps,
      workingDays: span.workingDays,
      startNum,
      endNum,
    }
  }, [startDate, direction, years, months, weeks, days, businessMode, businessDays])

  const summary = useMemo(() => {
    if (!result) return ''
    return [
      ...result.steps,
      '',
      `Result: ${format(result.endDate, 'EEEE, d MMMM yyyy')}`,
      `ISO date: ${format(result.endDate, 'yyyy-MM-dd')}`,
      `${Math.abs(result.calendarDays)} calendar days from the start date`,
    ].join('\n')
  }, [result])

  const invalid = !parseDateInput(startDate) && startDate.length > 0
  const sign = direction === 'add' ? 1 : -1
  const rangeError = businessMode
    ? Math.abs(toInt(businessDays)) > MAX_BUSINESS_DAYS
      ? `Count up to ${formatNumber(MAX_BUSINESS_DAYS, 0)} business days at a time.`
      : null
    : outOfRange(startDate, sign, toInt(years), toInt(months), toInt(weeks), toInt(days))
      ? 'The result has to fall between the years 1 and 9999. Use a smaller offset.'
      : null

  return (
    <div className="space-y-6">
      <ToolPanel title="Start date and offset" description="Add or subtract any mix of years, months, weeks and days.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dc-start">Start date</Label>
            <Input id="dc-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium leading-none">Direction</span>
            <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
              <TabsList className="w-full">
                <TabsTrigger value="add" className="flex-1">
                  Add to date
                </TabsTrigger>
                <TabsTrigger value="subtract" className="flex-1">
                  Subtract from date
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
          <Label htmlFor="dc-business" className="cursor-pointer text-sm font-normal">
            Business days mode: count only Monday to Friday
          </Label>
          <Switch id="dc-business" checked={businessMode} onCheckedChange={setBusinessMode} />
        </div>

        {businessMode ? (
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="dc-bdays">Business days</Label>
            <Input
              id="dc-bdays"
              type="number"
              inputMode="numeric"
              min={0}
              value={businessDays}
              onChange={(e) => setBusinessDays(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Weekends are skipped. Need public holidays too? Use the business days calculator.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="dc-years">Years</Label>
                <Input id="dc-years" type="number" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dc-months">Months</Label>
                <Input id="dc-months" type="number" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dc-weeks">Weeks</Label>
                <Input id="dc-weeks" type="number" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dc-days">Days</Label>
                <Input id="dc-days" type="number" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button key={p.label} type="button" variant="outline" size="sm" onClick={() => applyPreset(p)}>
                  {direction === 'add' ? '+' : '−'} {p.label}
                </Button>
              ))}
            </div>
          </>
        )}
      </ToolPanel>

      {invalid ? <ErrorNote message="That start date isn’t a real calendar date. Check the day and month." /> : null}
      {rangeError ? <ErrorNote message={rangeError} /> : null}

      {!result ? (
        <div className="rounded-xl bg-muted p-8 text-center">
          <CalendarPlus className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">Pick a start date to see the resulting date.</p>
        </div>
      ) : (
        <div className="space-y-6" role="status" aria-live="polite">
          <div className="rounded-xl bg-card p-5 sm:p-6">
            <div className="text-sm font-medium text-muted-foreground">Resulting date</div>
            <div className="mt-1 text-3xl font-bold text-foreground sm:text-4xl">
              {format(result.endDate, 'EEEE, d MMMM yyyy')}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {format(result.endDate, 'yyyy-MM-dd')} ·{' '}
              {Math.abs(result.calendarDays) === 0
                ? 'the same day'
                : `${formatNumber(Math.abs(result.calendarDays), 0)} calendar day${Math.abs(result.calendarDays) === 1 ? '' : 's'} ${result.calendarDays >= 0 ? 'later' : 'earlier'}`}
            </p>
            <div className="mt-4">
              <CopyButton value={summary} label="Copy result" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ResultStat label="Day of week" value={WEEKDAY_LABELS[weekdayOfDayNumber(result.endNum)] ?? ''} emphasis />
            <MiniStat label="ISO 8601" value={format(result.endDate, 'yyyy-MM-dd')} />
            <MiniStat label="US format" value={format(result.endDate, 'MM/dd/yyyy')} />
            <MiniStat
              label="Day of year"
              value={getDayOfYear(result.endDate)}
              hint={`ISO week ${getISOWeek(result.endDate)}`}
            />
          </div>

          <div className="rounded-xl bg-muted p-5">
            <h3 className="text-sm font-semibold text-foreground">Step by step</h3>
            <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
              {result.steps.map((s, i) => (
                <li key={i} className="tabular-nums">
                  {i + 1}. {s}
                </li>
              ))}
              {result.kind === 'calendar' ? (
                <li className="tabular-nums">
                  {result.steps.length + 1}. That span contains {formatNumber(result.workingDays, 0)}{' '}
                  Monday-to-Friday days.
                </li>
              ) : (
                <li className="tabular-nums">
                  {result.steps.length + 1}. {formatNumber(result.weekendsSkipped, 0)} weekend day
                  {result.weekendsSkipped === 1 ? '' : 's'} were skipped along the way.
                </li>
              )}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Month arithmetic clamps to the end of the month: 31 January + 1 month = 28 or 29 February.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
