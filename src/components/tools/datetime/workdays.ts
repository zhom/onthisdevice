/**
 * Working-day arithmetic on epoch day numbers.
 *
 * A "day number" is `Date.UTC(y, m - 1, d) / 86_400_000` — an integer index of
 * calendar days. Using integers keeps weekend and holiday logic completely free
 * of timezone and DST effects.
 */

import type { CalendarDate } from './holidays'
import { utcMs } from './tz'

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Index 0 = Sunday … 6 = Saturday. `true` means the day is a weekend/non-working day. */
export type WeekendMask = readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean]

export const DEFAULT_WEEKEND: WeekendMask = [true, false, false, false, false, false, true]

export function toDayNumber(date: CalendarDate): number {
  return Math.floor(utcMs(date.year, date.month - 1, date.day) / 86_400_000)
}

export function fromDayNumber(dayNumber: number): CalendarDate {
  const d = new Date(dayNumber * 86_400_000)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** 0 = Sunday. The epoch (day 0) was a Thursday. */
export function weekdayOfDayNumber(dayNumber: number): number {
  return ((((dayNumber + 4) % 7) + 7) % 7)
}

export function formatDayNumber(dayNumber: number): string {
  const { year, month, day } = fromDayNumber(dayNumber)
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export interface WorkdayRules {
  weekend: WeekendMask
  /** ISO `YYYY-MM-DD` strings of non-working holidays. */
  holidays: ReadonlySet<string>
}

export function isWorkingDay(dayNumber: number, rules: WorkdayRules): boolean {
  if (rules.weekend[weekdayOfDayNumber(dayNumber)]) return false
  return !rules.holidays.has(formatDayNumber(dayNumber))
}

export interface WorkdayCount {
  totalDays: number
  workingDays: number
  weekendDays: number
  holidayDays: number
  /** Holidays that actually removed a working day, as ISO date strings. */
  holidaysApplied: string[]
}

/** Count working days in the inclusive range [from, to]. */
export function countWorkingDays(from: number, to: number, rules: WorkdayRules): WorkdayCount {
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  const totalDays = end - start + 1
  // Whole weeks contain every weekday once; only the leftover days need a look.
  const fullWeeks = Math.floor(totalDays / 7)
  const offPerWeek = rules.weekend.filter(Boolean).length
  let weekendDays = fullWeeks * offPerWeek
  const firstWeekday = weekdayOfDayNumber(start)
  for (let i = 0; i < totalDays % 7; i++) {
    if (rules.weekend[(firstWeekday + i) % 7]) weekendDays++
  }
  const holidaysApplied: string[] = []
  for (const iso of rules.holidays) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
    if (!m) continue
    const n = toDayNumber({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) })
    if (n < start || n > end || rules.weekend[weekdayOfDayNumber(n)]) continue
    holidaysApplied.push(iso)
  }
  holidaysApplied.sort()
  return {
    totalDays,
    workingDays: totalDays - weekendDays - holidaysApplied.length,
    weekendDays,
    holidayDays: holidaysApplied.length,
    holidaysApplied,
  }
}

/**
 * Move `count` working days from `start`. The start day itself is never
 * counted; the result is always a working day. `count` may be negative.
 */
export function addWorkingDays(start: number, count: number, rules: WorkdayRules): number {
  if (count === 0) {
    let d = start
    let guard = 0
    while (!isWorkingDay(d, rules) && guard++ < 4000) d += 1
    return d
  }
  const step = count > 0 ? 1 : -1
  let remaining = Math.abs(count)
  let day = start
  let guard = 0
  while (remaining > 0 && guard++ < 400_000) {
    day += step
    if (isWorkingDay(day, rules)) remaining--
  }
  return day
}

/** All weekday indices flagged as weekend, as a readable list. */
export function describeWeekend(weekend: WeekendMask): string {
  const names = WEEKDAY_LABELS.filter((_, i) => weekend[i])
  if (names.length === 0) return 'no weekend (all seven days count)'
  if (names.length === 1) return `${names[0]} only`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
