/**
 * Day of the week for any date in the proleptic Gregorian calendar, by the
 * doomsday rule (with the working) and by a day count. Pure; tests import it.
 */

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

export function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function daysIn(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!
}

const mod = (a: number, n: number) => ((a % n) + n) % n

/** 0 = Sunday. Days since 1970-01-01 (a Thursday), so it works for any year. */
export function weekday(y: number, m: number, d: number): number {
  const t = new Date(0)
  t.setUTCFullYear(y, m - 1, d)
  return mod(Math.floor(t.getTime() / 86400000) + 4, 7)
}

/** A date in each month that always falls on the year's doomsday. */
export function doomsdayDate(y: number, m: number): number {
  return [isLeap(y) ? 4 : 3, isLeap(y) ? 29 : 28, 14, 4, 9, 6, 11, 8, 5, 10, 7, 12][m - 1]!
}

export interface Doomsday {
  /** Anchor day of the century (0 = Sunday). */
  anchor: number
  /** y = last two digits; a = ⌊y/12⌋, b = y mod 12, c = ⌊b/4⌋. */
  yy: number
  a: number
  b: number
  c: number
  /** The year's doomsday (0 = Sunday). */
  doomsday: number
  /** The doomsday date in the month, and how far the date is from it. */
  ref: number
  offset: number
  day: number
}

/** The doomsday rule, step by step. */
export function doomsday(y: number, m: number, d: number): Doomsday {
  const century = Math.floor(y / 100)
  const anchor = mod(5 * mod(century, 4) + 2, 7)
  const yy = mod(y, 100)
  const a = Math.floor(yy / 12)
  const b = yy % 12
  const c = Math.floor(b / 4)
  const dd = mod(anchor + a + b + c, 7)
  const ref = doomsdayDate(y, m)
  const offset = d - ref
  return { anchor, yy, a, b, c, doomsday: dd, ref, offset, day: mod(dd + offset, 7) }
}

/** Day of the year, 1 to 366, and the ISO week number. */
export function dayOfYear(y: number, m: number, d: number): number {
  let n = d
  for (let i = 1; i < m; i++) n += daysIn(y, i)
  return n
}

export function isoWeek(y: number, m: number, d: number): number {
  const wd = mod(weekday(y, m, d) - 1, 7) // Monday 0
  const thursday = dayOfYear(y, m, d) - wd + 3
  if (thursday < 1) return isoWeek(y - 1, 12, 31)
  const len = isLeap(y) ? 366 : 365
  if (thursday > len) return 1
  return Math.floor((thursday - 1) / 7) + 1
}
