/**
 * Holiday dates computed from scratch — no lookup table, no expiry date.
 * Every rule below is the actual definition of the holiday, so the list keeps
 * working for any year you ask for.
 */

import { utcMs } from './tz'

export interface CalendarDate {
  year: number
  month: number // 1-12
  day: number // 1-31
}

export type HolidayRegion = 'global' | 'us' | 'uk' | 'christian'

export interface Holiday {
  id: string
  name: string
  region: HolidayRegion
  /** How the date is derived — shown in the reference table. */
  rule: string
  date: CalendarDate
}

/** Weekday of a calendar date, 0 = Sunday. */
function weekdayOf(year: number, month: number, day: number): number {
  return new Date(utcMs(year, month - 1, day)).getUTCDay()
}

/** The nth (1-based) `weekday` of a month; nth = -1 means the last one. */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  nth: number,
): CalendarDate {
  if (nth > 0) {
    const first = weekdayOf(year, month, 1)
    const day = 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7
    return { year, month, day }
  }
  const lastDay = new Date(utcMs(year, month, 0)).getUTCDate()
  const last = weekdayOf(year, month, lastDay)
  const day = lastDay - ((last - weekday + 7) % 7)
  return { year, month, day }
}

/** Add whole days to a calendar date. */
export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const d = new Date(utcMs(date.year, date.month - 1, date.day + days))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/**
 * Easter Sunday in the Gregorian calendar — the anonymous Gregorian computus
 * (Meeus/Jones/Butcher algorithm). Valid for all Gregorian years.
 */
export function easterSunday(year: number): CalendarDate {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { year, month, day }
}

/** Every holiday this page tracks, for a single year. */
export function holidaysForYear(year: number): Holiday[] {
  const easter = easterSunday(year)
  const thanksgiving = nthWeekdayOfMonth(year, 11, 4, 4) // 4th Thursday of November
  const list: Holiday[] = [
    {
      id: 'new-years-day',
      name: "New Year's Day",
      region: 'global',
      rule: '1 January',
      date: { year, month: 1, day: 1 },
    },
    {
      id: 'mlk-day',
      name: 'Martin Luther King Jr. Day',
      region: 'us',
      rule: '3rd Monday of January',
      date: nthWeekdayOfMonth(year, 1, 1, 3),
    },
    {
      id: 'valentines-day',
      name: "Valentine's Day",
      region: 'global',
      rule: '14 February',
      date: { year, month: 2, day: 14 },
    },
    {
      id: 'presidents-day',
      name: "Presidents' Day",
      region: 'us',
      rule: '3rd Monday of February',
      date: nthWeekdayOfMonth(year, 2, 1, 3),
    },
    {
      id: 'st-patricks-day',
      name: "St Patrick's Day",
      region: 'global',
      rule: '17 March',
      date: { year, month: 3, day: 17 },
    },
    {
      id: 'good-friday',
      name: 'Good Friday',
      region: 'christian',
      rule: 'Two days before Easter Sunday',
      date: addCalendarDays(easter, -2),
    },
    {
      id: 'easter-sunday',
      name: 'Easter Sunday',
      region: 'christian',
      rule: 'First Sunday after the first ecclesiastical full moon on or after 21 March',
      date: easter,
    },
    {
      id: 'mothers-day-us',
      name: "Mother's Day (US)",
      region: 'us',
      rule: '2nd Sunday of May',
      date: nthWeekdayOfMonth(year, 5, 0, 2),
    },
    {
      id: 'memorial-day',
      name: 'Memorial Day',
      region: 'us',
      rule: 'Last Monday of May',
      date: nthWeekdayOfMonth(year, 5, 1, -1),
    },
    {
      id: 'fathers-day-us',
      name: "Father's Day (US)",
      region: 'us',
      rule: '3rd Sunday of June',
      date: nthWeekdayOfMonth(year, 6, 0, 3),
    },
    {
      id: 'juneteenth',
      name: 'Juneteenth',
      region: 'us',
      rule: '19 June',
      date: { year, month: 6, day: 19 },
    },
    {
      id: 'independence-day',
      name: 'Independence Day (4th of July)',
      region: 'us',
      rule: '4 July',
      date: { year, month: 7, day: 4 },
    },
    {
      id: 'labor-day',
      name: 'Labor Day (US)',
      region: 'us',
      rule: '1st Monday of September',
      date: nthWeekdayOfMonth(year, 9, 1, 1),
    },
    {
      id: 'halloween',
      name: 'Halloween',
      region: 'global',
      rule: '31 October',
      date: { year, month: 10, day: 31 },
    },
    {
      id: 'veterans-day',
      name: 'Veterans Day',
      region: 'us',
      rule: '11 November',
      date: { year, month: 11, day: 11 },
    },
    {
      id: 'thanksgiving-us',
      name: 'Thanksgiving (US)',
      region: 'us',
      rule: '4th Thursday of November',
      date: thanksgiving,
    },
    {
      id: 'black-friday',
      name: 'Black Friday',
      region: 'us',
      rule: 'The day after US Thanksgiving',
      date: addCalendarDays(thanksgiving, 1),
    },
    {
      id: 'cyber-monday',
      name: 'Cyber Monday',
      region: 'us',
      rule: 'The Monday after US Thanksgiving',
      date: addCalendarDays(thanksgiving, 4),
    },
    {
      id: 'christmas-eve',
      name: 'Christmas Eve',
      region: 'global',
      rule: '24 December',
      date: { year, month: 12, day: 24 },
    },
    {
      id: 'christmas',
      name: 'Christmas Day',
      region: 'global',
      rule: '25 December',
      date: { year, month: 12, day: 25 },
    },
    {
      id: 'boxing-day',
      name: 'Boxing Day',
      region: 'uk',
      rule: '26 December',
      date: { year, month: 12, day: 26 },
    },
    {
      id: 'new-years-eve',
      name: "New Year's Eve",
      region: 'global',
      rule: '31 December',
      date: { year, month: 12, day: 31 },
    },
  ]
  return list.sort(
    (a, b) =>
      utcMs(a.date.year, a.date.month - 1, a.date.day) -
      utcMs(b.date.year, b.date.month - 1, b.date.day),
  )
}

export interface UpcomingHoliday extends Holiday {
  /** Whole days from `today` to the holiday, in the reference timezone. */
  daysAway: number
  /** Weekday name of the holiday, e.g. `Friday`. */
  weekday: string
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

/**
 * The next occurrence of every tracked holiday, sorted by how soon it is.
 * Holidays that already passed this year roll over to next year.
 */
export function upcomingHolidays(today: CalendarDate, count = 24): UpcomingHoliday[] {
  const todayNum = Math.floor(utcMs(today.year, today.month - 1, today.day) / 86_400_000)
  const pool = [
    ...holidaysForYear(today.year),
    ...holidaysForYear(today.year + 1),
    ...holidaysForYear(today.year + 2),
  ]
  const seen = new Set<string>()
  const out: UpcomingHoliday[] = []
  for (const h of pool) {
    if (seen.has(h.id)) continue
    const num = Math.floor(utcMs(h.date.year, h.date.month - 1, h.date.day) / 86_400_000)
    const daysAway = num - todayNum
    if (daysAway < 0) continue
    seen.add(h.id)
    out.push({
      ...h,
      daysAway,
      weekday: WEEKDAY_NAMES[weekdayOf(h.date.year, h.date.month, h.date.day)] ?? '',
    })
  }
  return out.sort((a, b) => a.daysAway - b.daysAway).slice(0, count)
}

export const REGION_LABELS: Record<HolidayRegion, string> = {
  global: 'Widely observed',
  us: 'United States',
  uk: 'UK & Commonwealth',
  christian: 'Christian calendar',
}

/* ── days off for business-day counts ─────────────────────────────────── */

export type DaysOffSet = 'us' | 'uk' | 'global'

export interface DayOff {
  date: CalendarDate
  name: string
}

/** Weekend holiday moved to the weekday on which it is observed. */
function observedUs(date: CalendarDate): CalendarDate {
  const wd = weekdayOf(date.year, date.month, date.day)
  return wd === 6 ? addCalendarDays(date, -1) : wd === 0 ? addCalendarDays(date, 1) : date
}

function nextWeekday(date: CalendarDate): CalendarDate {
  let d = date
  while ([0, 6].includes(weekdayOf(d.year, d.month, d.day))) d = addCalendarDays(d, 1)
  return d
}

/**
 * Days off in `year`, on the dates they are observed.
 * - `us`: the 11 US federal holidays (5 U.S.C. 6103). A Saturday holiday is
 *   observed on the Friday before, a Sunday one on the Monday after.
 * - `uk`: the 8 bank holidays of England and Wales, with substitute days.
 * - `global`: New Year's Day and Christmas Day, on their calendar dates.
 */
export function daysOffForYear(year: number, set: DaysOffSet): DayOff[] {
  if (set === 'global') {
    return [
      { date: { year, month: 1, day: 1 }, name: "New Year's Day" },
      { date: { year, month: 12, day: 25 }, name: 'Christmas Day' },
    ]
  }
  if (set === 'us') {
    const fixed = (y: number, month: number, day: number, name: string): DayOff => ({
      date: observedUs({ year: y, month, day }),
      name: name,
    })
    const list: DayOff[] = [
      fixed(year, 1, 1, "New Year's Day"),
      { date: nthWeekdayOfMonth(year, 1, 1, 3), name: 'Martin Luther King Jr. Day' },
      { date: nthWeekdayOfMonth(year, 2, 1, 3), name: "Washington's Birthday" },
      { date: nthWeekdayOfMonth(year, 5, 1, -1), name: 'Memorial Day' },
      fixed(year, 6, 19, 'Juneteenth'),
      fixed(year, 7, 4, 'Independence Day'),
      { date: nthWeekdayOfMonth(year, 9, 1, 1), name: 'Labor Day' },
      { date: nthWeekdayOfMonth(year, 10, 1, 2), name: 'Columbus Day' },
      fixed(year, 11, 11, 'Veterans Day'),
      { date: nthWeekdayOfMonth(year, 11, 4, 4), name: 'Thanksgiving Day' },
      fixed(year, 12, 25, 'Christmas Day'),
      // 1 January on a Saturday is observed on 31 December of the year before.
      fixed(year + 1, 1, 1, "New Year's Day (observed)"),
    ]
    return list.filter((h) => h.date.year === year)
  }
  const easter = easterSunday(year)
  const christmas = { year, month: 12, day: 25 }
  const christmasWd = weekdayOf(year, 12, 25)
  // Christmas on Saturday: both move to Mon 27 and Tue 28. On Sunday: Boxing
  // Day stays Mon 26 and Christmas moves to Tue 27. Boxing Day on Saturday: Mon 28.
  const christmasObserved =
    christmasWd === 6 ? addCalendarDays(christmas, 2) : christmasWd === 0 ? addCalendarDays(christmas, 2) : christmas
  const boxingObserved =
    christmasWd === 6 ? addCalendarDays(christmas, 3) : christmasWd === 5 ? addCalendarDays(christmas, 3) : addCalendarDays(christmas, 1)
  return [
    { date: nextWeekday({ year, month: 1, day: 1 }), name: "New Year's Day" },
    { date: addCalendarDays(easter, -2), name: 'Good Friday' },
    { date: addCalendarDays(easter, 1), name: 'Easter Monday' },
    { date: nthWeekdayOfMonth(year, 5, 1, 1), name: 'Early May bank holiday' },
    { date: nthWeekdayOfMonth(year, 5, 1, -1), name: 'Spring bank holiday' },
    { date: nthWeekdayOfMonth(year, 8, 1, -1), name: 'Summer bank holiday' },
    { date: christmasObserved, name: 'Christmas Day' },
    { date: boxingObserved, name: 'Boxing Day' },
  ]
}
