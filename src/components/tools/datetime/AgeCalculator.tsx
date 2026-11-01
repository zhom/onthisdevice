import { useMemo, useState } from 'react'
import { Cake, CalendarHeart } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { formatNumber } from '@/components/tools/finance/format'
import {
  MiniStat,
  ZoneNote,
  ZonePicker,
  useMounted,
  useNow,
  useTodayInput,
  useZoneState,
} from './common'
import {
  calendarDayNumber,
  calendarSpan,
  formatInZone,
  getZonedParts,
  parseDateInput,
  parseTimeInput,
  utcMs,
  zonedPartsToInstant,
} from './tz'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const ZODIAC: { name: string; from: [number, number] }[] = [
  { name: 'Capricorn', from: [12, 22] },
  { name: 'Sagittarius', from: [11, 22] },
  { name: 'Scorpio', from: [10, 23] },
  { name: 'Libra', from: [9, 23] },
  { name: 'Virgo', from: [8, 23] },
  { name: 'Leo', from: [7, 23] },
  { name: 'Cancer', from: [6, 21] },
  { name: 'Gemini', from: [5, 21] },
  { name: 'Taurus', from: [4, 20] },
  { name: 'Aries', from: [3, 21] },
  { name: 'Pisces', from: [2, 19] },
  { name: 'Aquarius', from: [1, 20] },
  { name: 'Capricorn', from: [1, 1] },
]

function zodiacFor(month: number, day: number): string {
  for (const sign of ZODIAC) {
    const [m, d] = sign.from
    if (month > m || (month === m && day >= d)) return sign.name
  }
  return 'Capricorn'
}

function daysInMonth(year: number, month: number): number {
  return new Date(utcMs(year, month, 0)).getUTCDate()
}

/** Whole years, then whole months, then leftover days — the legal convention. */
const calendarAge = calendarSpan

export default function AgeCalculator() {
  const mounted = useMounted()
  const [zone, setZone] = useZoneState()
  const [dob, setDob] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [useBirthTime, setUseBirthTime] = useState(false)
  const [asOf, setAsOf] = useTodayInput(zone)
  const now = useNow(1000)

  const result = useMemo(() => {
    const birth = parseDateInput(dob)
    const ref = parseDateInput(asOf)
    if (!birth || !ref) return null

    const birthClock = (useBirthTime ? parseTimeInput(birthTime) : null) ?? {
      hour: 0,
      minute: 0,
      second: 0,
    }
    const nowParts = getZonedParts(now.getTime() === 0 ? new Date() : now, zone)
    const refClock = { hour: nowParts.hour, minute: nowParts.minute, second: nowParts.second }

    const birthInstant = zonedPartsToInstant({ ...birth, ...birthClock }, zone)
    const refInstant = zonedPartsToInstant({ ...ref, ...refClock }, zone)
    const elapsedMs = refInstant.getTime() - birthInstant.getTime()

    const birthDayNum = calendarDayNumber(birth.year, birth.month, birth.day)
    const refDayNum = calendarDayNumber(ref.year, ref.month, ref.day)
    if (refDayNum < birthDayNum) {
      return { error: 'The “age at” date is before the date of birth. Swap the two dates.' } as const
    }

    // Time of birth refines the breakdown: the final day is only complete once
    // the clock passes the birth time.
    let effectiveRef = ref
    if (useBirthTime) {
      const birthSec = birthClock.hour * 3600 + birthClock.minute * 60 + birthClock.second
      const refSec = refClock.hour * 3600 + refClock.minute * 60 + refClock.second
      if (refSec < birthSec && refDayNum > birthDayNum) {
        const back = new Date(utcMs(ref.year, ref.month - 1, ref.day - 1))
        effectiveRef = {
          year: back.getUTCFullYear(),
          month: back.getUTCMonth() + 1,
          day: back.getUTCDate(),
        }
      }
    }

    const age = calendarAge(birth, effectiveRef)
    const totalDays = refDayNum - birthDayNum
    const totalMonths = age.years * 12 + age.months
    const totalHours = Math.floor(elapsedMs / 3_600_000)
    const totalMinutes = Math.floor(elapsedMs / 60_000)
    const totalSeconds = Math.floor(elapsedMs / 1000)

    // Next birthday, honouring 29 February in common years.
    const leapBorn = birth.month === 2 && birth.day === 29
    const birthdayIn = (year: number) => {
      const day = leapBorn && daysInMonth(year, 2) === 28 ? 28 : birth.day
      return { year, month: birth.month, day }
    }
    // A birthday that falls on the reference date counts as today (0 days away).
    let next = birthdayIn(ref.year)
    if (calendarDayNumber(next.year, next.month, next.day) < refDayNum || next.year === birth.year) {
      next = birthdayIn(ref.year + 1)
    }
    const nextInstant = zonedPartsToInstant({ ...next, hour: 0, minute: 0, second: 0 }, zone)
    const daysToBirthday = calendarDayNumber(next.year, next.month, next.day) - refDayNum
    const turning = next.year - birth.year

    let last = birthdayIn(ref.year)
    if (calendarDayNumber(last.year, last.month, last.day) > refDayNum) {
      last = birthdayIn(ref.year - 1)
    }
    const daysSinceBirthday = Math.max(
      0,
      refDayNum - calendarDayNumber(last.year, last.month, last.day),
    )

    const bornWeekday = WEEKDAYS[new Date(utcMs(birth.year, birth.month - 1, birth.day)).getUTCDay()] ?? ''
    const nextWeekday = WEEKDAYS[new Date(utcMs(next.year, next.month - 1, next.day)).getUTCDay()] ?? ''

    return {
      error: null,
      birth,
      ref,
      age,
      totalDays,
      totalMonths,
      totalWeeks: Math.floor(totalDays / 7),
      weekRemainderDays: totalDays % 7,
      totalHours,
      totalMinutes,
      totalSeconds,
      next,
      nextInstant,
      daysToBirthday,
      daysSinceBirthday,
      turning,
      bornWeekday,
      nextWeekday,
      zodiac: zodiacFor(birth.month, birth.day),
      leapBorn,
      birthInstant,
    } as const
  }, [dob, asOf, birthTime, useBirthTime, zone, now])

  const summary = useMemo(() => {
    if (!result || result.error) return ''
    return [
      `Date of birth: ${formatInZone(result.birthInstant, zone, { dateStyle: 'full' })}`,
      `Age on ${formatInZone(zonedPartsToInstant({ ...result.ref, hour: 12, minute: 0, second: 0 }, zone), zone, { dateStyle: 'full' })}:`,
      `  ${result.age.years} years, ${result.age.months} months, ${result.age.days} days`,
      `  ${formatNumber(result.totalMonths, 0)} months · ${formatNumber(result.totalWeeks, 0)} weeks · ${formatNumber(result.totalDays, 0)} days`,
      `  ${formatNumber(result.totalHours, 0)} hours · ${formatNumber(result.totalMinutes, 0)} minutes`,
      `Born on a ${result.bornWeekday}`,
      `Next birthday: ${formatInZone(result.nextInstant, zone, { dateStyle: 'full' })} (${result.daysToBirthday} days, turning ${result.turning})`,
      `Timezone: ${zone}`,
    ].join('\n')
  }, [result, zone])

  return (
    <div className="space-y-6">
      <ToolPanel
        title="Your details"
        description="The date of birth stays in this browser tab."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="age-dob">Date of birth</Label>
            <Input
              id="age-dob"
              type="date"
              value={dob}
              max="9999-12-31"
              onChange={(e) => setDob(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="age-asof">Age at date</Label>
            <Input
              id="age-asof"
              type="date"
              value={asOf}
              max="9999-12-31"
              onChange={(e) => setAsOf(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Defaults to today. Past or future both work.</p>
          </div>
        </div>

        <div className="mt-4 space-y-4 rounded-lg bg-muted p-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="age-usetime" className="cursor-pointer text-sm font-normal">
              I know my time of birth
            </Label>
            <Switch id="age-usetime" checked={useBirthTime} onCheckedChange={setUseBirthTime} />
          </div>
          {useBirthTime ? (
            <div className="space-y-1.5">
              <Label htmlFor="age-birthtime">Time of birth</Label>
              <Input
                id="age-birthtime"
                type="time"
                step={60}
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
              />
            </div>
          ) : null}
          <ZonePicker
            value={zone}
            onChange={setZone}
            label="Reference timezone"
            hint="Sets what counts as “today” and how the hours lived are measured."
          />
        </div>
      </ToolPanel>

      {result?.error ? <ErrorNote message={result.error} /> : null}

      {!dob ? (
        <div className="rounded-xl bg-muted p-8 text-center">
          <Cake className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            Enter a date of birth to see the exact age, every total, and the next birthday countdown.
          </p>
        </div>
      ) : null}

      {result && !result.error ? (
        <div className="space-y-6">
          {/* Only the headline announces; the totals tick every second and would
              otherwise flood a screen reader. */}
          <div className="rounded-xl bg-card p-5 sm:p-6" role="status" aria-live="polite">
            <div className="text-sm font-medium text-muted-foreground">Exact age</div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl font-bold tabular-nums text-foreground sm:text-5xl">
                {result.age.years}
              </span>
              <span className="text-lg text-muted-foreground">years</span>
              <span className="text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
                {result.age.months}
              </span>
              <span className="text-lg text-muted-foreground">months</span>
              <span className="text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
                {result.age.days}
              </span>
              <span className="text-lg text-muted-foreground">days</span>
            </div>
            <div className="mt-3">
              <ZoneNote zone={zone} prefix="Measured in" />
            </div>
            <div className="mt-4">
              <CopyButton value={summary} label="Copy full breakdown" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ResultStat
              label="Total days lived"
              value={formatNumber(result.totalDays, 0)}
              hint="whole calendar days since birth"
              emphasis
            />
            <ResultStat
              label="Total weeks"
              value={`${formatNumber(result.totalWeeks, 0)} weeks`}
              hint={`plus ${result.weekRemainderDays} day${result.weekRemainderDays === 1 ? '' : 's'}`}
            />
            <ResultStat
              label="Total months"
              value={formatNumber(result.totalMonths, 0)}
              hint={`plus ${result.age.days} day${result.age.days === 1 ? '' : 's'}`}
            />
            <ResultStat label="Total hours" value={formatNumber(result.totalHours, 0)} />
            <ResultStat label="Total minutes" value={formatNumber(result.totalMinutes, 0)} />
            <ResultStat
              label="Total seconds"
              value={mounted ? formatNumber(result.totalSeconds, 0) : '–'}
              hint="ticking live"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Born on a" value={result.bornWeekday} />
            <MiniStat label="Star sign" value={result.zodiac} />
            <MiniStat
              label="Birth date"
              value={formatInZone(result.birthInstant, zone, { dateStyle: 'long' })}
            />
            <MiniStat
              label="Days since last birthday"
              value={formatNumber(result.daysSinceBirthday, 0)}
              hint="how far into this year of life you are"
            />
          </div>

          <div className="rounded-xl bg-card p-5">
            <div className="flex items-start gap-3">
              <CalendarHeart className="mt-0.5 h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">Next birthday</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.daysToBirthday === 0 ? (
                    <>Today is your birthday. You turn {result.turning}.</>
                  ) : (
                    <>
                      <span className="font-semibold text-foreground">
                        {formatNumber(result.daysToBirthday, 0)} day
                        {result.daysToBirthday === 1 ? '' : 's'}
                      </span>{' '}
                      until {formatInZone(result.nextInstant, zone, { dateStyle: 'full' })}, a{' '}
                      {result.nextWeekday}, when you turn {result.turning}.
                    </>
                  )}
                </p>
                {result.leapBorn ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Born on 29 February: in common years the birthday is shown on 28 February.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-muted p-5">
            <h3 className="text-sm font-semibold text-foreground">How this was worked out</h3>
            <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>
                1. Whole years from {result.birth.day}/{result.birth.month}/{result.birth.year} to{' '}
                {result.ref.day}/{result.ref.month}/{result.ref.year} → {result.age.years} years.
              </li>
              <li>
                2. Whole months from that anniversary → {result.age.months} month
                {result.age.months === 1 ? '' : 's'}.
              </li>
              <li>3. Remaining days → {result.age.days}.</li>
              <li>
                4. Totals are elapsed time, so they include every leap day
                {useBirthTime ? ' and your exact time of birth' : ''}.
              </li>
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  )
}
