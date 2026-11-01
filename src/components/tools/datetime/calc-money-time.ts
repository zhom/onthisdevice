/**
 * Round-2 batch `calc-money` — time-of-day parsing and formatting helpers.
 *
 * Shared by the time card, hours, decimal-hours and military-time pages. Kept
 * inside the batch (prefixed filename) so it cannot collide with the round-1
 * date/time helpers owned by another agent.
 */

/** Minutes since midnight, or null when the text is not a time. */
export function parseTimeOfDay(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\./g, '')
  if (!text) return null

  const meridiem = /([ap])m?$/.exec(text)
  const suffix = meridiem ? meridiem[1] : null
  /* Internal spaces are dropped so "9 30" and "9 : 30" both parse. */
  const body = (meridiem ? text.slice(0, meridiem.index) : text).replace(/\s+/g, '')

  let hours: number
  let minutes = 0

  const colon = /^(\d{1,2})[:h]\s*(\d{1,2})$/.exec(body)
  const compact = /^(\d{3,4})$/.exec(body)
  const bare = /^(\d{1,2})$/.exec(body)

  if (colon) {
    hours = Number(colon[1])
    minutes = Number(colon[2])
  } else if (compact) {
    const digits = compact[1]!
    hours = Number(digits.slice(0, digits.length - 2))
    minutes = Number(digits.slice(-2))
  } else if (bare) {
    hours = Number(bare[1])
  } else {
    return null
  }

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (minutes > 59) return null

  if (suffix === 'p' && hours < 12) hours += 12
  if (suffix === 'a' && hours === 12) hours = 0
  if (hours === 24 && minutes === 0) return 24 * 60
  if (hours > 23) return null

  return hours * 60 + minutes
}

/** 545 → "09:05" (24h) or "9:05 AM" (12h). */
export function formatTimeOfDay(totalMinutes: number, hour12: boolean): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  if (!hour12) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const suffix = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** 8.75 → "8:45" */
export function hoursToHm(hours: number): string {
  if (!Number.isFinite(hours)) return '0:00'
  const sign = hours < 0 ? '-' : ''
  const total = Math.round(Math.abs(hours) * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${sign}${h}:${String(m).padStart(2, '0')}`
}

/** "8:45" or "8h45" or "8.75" → 8.75 decimal hours, or null. */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase()
  if (!text) return null
  const colon = /^(-?)(\d+)\s*[:h]\s*(\d{1,2})m?$/.exec(text)
  if (colon) {
    const minutes = Number(colon[3])
    if (minutes > 59) return null
    const value = Number(colon[2]) + minutes / 60
    return colon[1] === '-' ? -value : value
  }
  const decimal = /^-?\d*\.?\d+$/.exec(text)
  if (decimal) return Number(text)
  return null
}

/** Round decimal hours to a payroll increment: 0 = none, 0.25 = quarter hour. */
export function roundHours(hours: number, increment: number): number {
  if (increment <= 0) return hours
  return Math.round(hours / increment) * increment
}

export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const
