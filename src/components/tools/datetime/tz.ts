/**
 * Timezone helpers for the Date & Time tools.
 *
 * Everything here is built on the browser's own `Intl` timezone database, so
 * conversions are DST-aware for every IANA zone the device knows about. No
 * network calls, no bundled tz data.
 */

/** Used only when `Intl.supportedValuesOf` is unavailable (older Safari/Firefox). */
const FALLBACK_ZONES: string[] = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Chicago',
  'America/Denver',
  'America/Halifax',
  'America/Lima',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Bangkok',
  'Asia/Dhaka',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Jerusalem',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Kuala_Lumpur',
  'Asia/Manila',
  'Asia/Riyadh',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Atlantic/Reykjavik',
  'Australia/Adelaide',
  'Australia/Brisbane',
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Brussels',
  'Europe/Bucharest',
  'Europe/Copenhagen',
  'Europe/Dublin',
  'Europe/Helsinki',
  'Europe/Istanbul',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Moscow',
  'Europe/Oslo',
  'Europe/Paris',
  'Europe/Prague',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Zurich',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Honolulu',
]

let zoneCache: string[] | null = null

/** Every IANA zone the browser knows, sorted; falls back to a curated list. */
export function listTimeZones(): string[] {
  if (zoneCache) return zoneCache
  let zones: string[] = FALLBACK_ZONES
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      const supported = Intl.supportedValuesOf('timeZone')
      if (supported.length > 0) zones = supported.includes('UTC') ? supported : ['UTC', ...supported]
    }
  } catch {
    zones = FALLBACK_ZONES
  }
  const local = localTimeZone()
  if (!zones.includes(local)) zones = [local, ...zones]
  zoneCache = [...zones].sort((a, b) => a.localeCompare(b))
  return zoneCache
}

/** The device's own timezone, e.g. `Europe/Madrid`. */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** `America/New_York` → `New York` (region stripped, underscores removed). */
export function zoneLabel(zone: string): string {
  const tail = zone.split('/').slice(1).join(' / ')
  return (tail || zone).replace(/_/g, ' ')
}

/** `America/New_York` → `America`. */
export function zoneRegion(zone: string): string {
  const head = zone.split('/')[0]
  return head ?? zone
}

const partsCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let fmt = partsCache.get(zone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsCache.set(zone, fmt)
  }
  return fmt
}

export interface ZonedParts {
  year: number
  month: number // 1-12
  day: number // 1-31
  hour: number // 0-23
  minute: number
  second: number
}

/** Wall-clock calendar fields for an instant, as seen in `zone`. */
export function getZonedParts(instant: Date, zone: string): ZonedParts {
  const parts = partsFormatter(zone).formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type)
    return found ? Number(found.value) : 0
  }
  const hour = read('hour')
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    // Some engines still emit 24 for midnight under h23 edge cases.
    hour: hour === 24 ? 0 : hour,
    minute: read('minute'),
    second: read('second'),
  }
}

/**
 * `Date.UTC` that also works for years 0–99 (`Date.UTC` reads those as
 * 1900–1999). Out-of-range fields roll over the same way.
 */
export function utcMs(year: number, monthIndex: number, day: number, hour = 0, minute = 0, second = 0): number {
  const d = new Date(0)
  d.setUTCFullYear(year, monthIndex, day)
  d.setUTCHours(hour, minute, second, 0)
  return d.getTime()
}

/** Offset of `zone` from UTC at `instant`, in milliseconds (east positive). */
export function zoneOffsetMs(instant: Date, zone: string): number {
  const p = getZonedParts(instant, zone)
  const asUtc = utcMs(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  // Drop sub-second precision from the instant so the difference is exact.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** Offset formatted as `UTC+05:30`. */
export function formatOffset(instant: Date, zone: string): string {
  const ms = zoneOffsetMs(instant, zone)
  const sign = ms < 0 ? '-' : '+'
  const total = Math.abs(Math.round(ms / 60000))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `UTC${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Short zone name, e.g. `EDT`, `GMT+2`, `IST`. */
export function zoneAbbreviation(instant: Date, zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'short',
    }).formatToParts(instant)
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? formatOffset(instant, zone)
  } catch {
    return formatOffset(instant, zone)
  }
}

/**
 * Turn a wall-clock reading in `zone` into the real UTC instant.
 * Tries the offsets in force a day before and a day after. A time that
 * occurs twice (clocks go back) gives the first one; a time that is skipped
 * (clocks go forward) moves forward by the gap, as the clocks do.
 */
export function zonedPartsToInstant(parts: ZonedParts, zone: string): Date {
  const naive = utcMs(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  const before = naive - zoneOffsetMs(new Date(naive - 86_400_000), zone)
  const after = naive - zoneOffsetMs(new Date(naive + 86_400_000), zone)
  if (before === after) return new Date(before)
  const shows = (ts: number) => {
    const p = getZonedParts(new Date(ts), zone)
    return p.year === parts.year && p.month === parts.month && p.day === parts.day && p.hour === parts.hour && p.minute === parts.minute
  }
  const valid = [before, after].filter(shows)
  return new Date(valid.length ? Math.min(...valid) : before)
}

/** True when the zone's offset differs from its January/July baseline. */
export function isDstActive(instant: Date, zone: string): boolean {
  const year = getZonedParts(instant, zone).year
  const jan = zoneOffsetMs(new Date(utcMs(year, 0, 1, 12)), zone)
  const jul = zoneOffsetMs(new Date(utcMs(year, 6, 1, 12)), zone)
  if (jan === jul) return false
  return zoneOffsetMs(instant, zone) === Math.max(jan, jul)
}

/** `2026-08-16` for the given instant, in the given zone. */
export function zonedDateInput(instant: Date, zone: string): string {
  const p = getZonedParts(instant, zone)
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** `14:05` for the given instant, in the given zone. */
export function zonedTimeInput(instant: Date, zone: string): string {
  const p = getZonedParts(instant, zone)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/** Parse `2026-08-16` (an `<input type="date">` value) into calendar fields. */
export function parseDateInput(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Reject impossible calendar dates such as 2026-02-30.
  const probe = new Date(utcMs(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null
  }
  return { year, month, day }
}

/** Parse `14:05` or `14:05:30` into hour/minute/second. */
export function parseTimeInput(value: string): { hour: number; minute: number; second: number } | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim())
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  const second = m[3] ? Number(m[3]) : 0
  if (hour > 23 || minute > 59 || second > 59) return null
  return { hour, minute, second }
}

/**
 * Combine `<input type="date">` + `<input type="time">` values read in `zone`
 * into a real instant. Returns null when either field is malformed.
 */
export function inputsToInstant(dateValue: string, timeValue: string, zone: string): Date | null {
  const d = parseDateInput(dateValue)
  if (!d) return null
  const t = parseTimeInput(timeValue || '00:00') ?? { hour: 0, minute: 0, second: 0 }
  return zonedPartsToInstant({ ...d, ...t }, zone)
}

const displayCache = new Map<string, Intl.DateTimeFormat>()

/** Format an instant in a zone with cached `Intl.DateTimeFormat` instances. */
export function formatInZone(
  instant: Date,
  zone: string,
  options: Intl.DateTimeFormatOptions,
  locale?: string,
): string {
  const key = `${locale ?? 'default'}|${zone}|${JSON.stringify(options)}`
  let fmt = displayCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { ...options, timeZone: zone })
    displayCache.set(key, fmt)
  }
  return fmt.format(instant)
}

/** `Sunday, 16 August 2026 at 14:05` style long form. */
export function formatFullInZone(instant: Date, zone: string): string {
  return formatInZone(instant, zone, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
}

/** Days from the epoch for a calendar date — safe for pure day arithmetic. */
export function calendarDayNumber(year: number, month: number, day: number): number {
  return Math.floor(utcMs(year, month - 1, day) / 86_400_000)
}

/**
 * Whole years, months and days from `from` to `to` (`to` on or after `from`).
 * Months count from the start date; when the target month is short the
 * anniversary clamps to its last day (31 Jan + 1 month = 28 Feb, and a
 * 29 February birthday falls on 28 February), then the rest are days.
 */
export function calendarSpan(
  from: { year: number; month: number; day: number },
  to: { year: number; month: number; day: number },
): { years: number; months: number; days: number } {
  const anchor = (months: number) => {
    const index = from.month - 1 + months
    const year = from.year + Math.floor(index / 12)
    const month = (((index % 12) + 12) % 12) + 1
    const last = new Date(utcMs(year, month, 0)).getUTCDate()
    return calendarDayNumber(year, month, Math.min(from.day, last))
  }
  const end = calendarDayNumber(to.year, to.month, to.day)
  let total = (to.year - from.year) * 12 + (to.month - from.month)
  while (total > 0 && anchor(total) > end) total -= 1
  return { years: Math.floor(total / 12), months: total % 12, days: end - anchor(total) }
}

/** Weekday index (0 = Sunday) for a calendar date. */
export function calendarWeekday(year: number, month: number, day: number): number {
  return new Date(utcMs(year, month - 1, day)).getUTCDay()
}

/**
 * A `Date` whose *local* fields equal the given calendar date at noon.
 * Noon avoids every DST edge case for date-only math with date-fns.
 */
export function localNoon(year: number, month: number, day: number): Date {
  const d = new Date(2000, 0, 1, 12, 0, 0, 0)
  d.setFullYear(year, month - 1, day) // setFullYear keeps years 0–99 as written
  return d
}

/** Today's calendar date as seen in `zone`. */
export function todayInZone(zone: string): { year: number; month: number; day: number } {
  const p = getZonedParts(new Date(), zone)
  return { year: p.year, month: p.month, day: p.day }
}

/** `2026-08-16` for today in `zone` — ready for an `<input type="date">`. */
export function todayInputValue(zone: string): string {
  return zonedDateInput(new Date(), zone)
}

const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'year', ms: 365.2425 * 86_400_000 },
  { unit: 'month', ms: 30.436875 * 86_400_000 },
  { unit: 'week', ms: 7 * 86_400_000 },
  { unit: 'day', ms: 86_400_000 },
  { unit: 'hour', ms: 3_600_000 },
  { unit: 'minute', ms: 60_000 },
  { unit: 'second', ms: 1000 },
]

/** "in 3 days" / "4 hours ago", using the browser's own locale rules. */
export function relativeTime(target: Date, from: Date = new Date()): string {
  const diff = target.getTime() - from.getTime()
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit)
  }
  return rtf.format(0, 'second')
}

/** `Sat, 16 Aug 2026 14:05:07 GMT` — RFC 2822 / HTTP-date form, always UTC. */
export function toRfc2822(instant: Date): string {
  return instant.toUTCString()
}

/** Break a millisecond span into d/h/m/s/ms components. */
export function breakdownMs(totalMs: number): {
  days: number
  hours: number
  minutes: number
  seconds: number
  ms: number
} {
  let rest = Math.max(0, Math.floor(totalMs))
  const days = Math.floor(rest / 86_400_000)
  rest -= days * 86_400_000
  const hours = Math.floor(rest / 3_600_000)
  rest -= hours * 3_600_000
  const minutes = Math.floor(rest / 60_000)
  rest -= minutes * 60_000
  const seconds = Math.floor(rest / 1000)
  rest -= seconds * 1000
  return { days, hours, minutes, seconds, ms: rest }
}

export function pad2(n: number): string {
  return String(Math.abs(Math.trunc(n))).padStart(2, '0')
}
