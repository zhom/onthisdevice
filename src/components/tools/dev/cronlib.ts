/** Cron expression parsing, description and next-run calculation. */

export interface CronField {
  /** Every value this field permits. */
  values: number[]
  /** False when the field was `*` or `?` — needed for the day-of-month / day-of-week rule. */
  restricted: boolean
  raw: string
}

export interface ParsedCron {
  hasSeconds: boolean
  second: CronField
  minute: CronField
  hour: CronField
  dayOfMonth: CronField
  month: CronField
  dayOfWeek: CronField
}

export class CronError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'CronError'
  }
}

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
export const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const SHORTCUTS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

interface FieldSpec {
  key: keyof Omit<ParsedCron, 'hasSeconds'>
  label: string
  min: number
  max: number
  names?: string[]
}

const SPECS: Record<string, FieldSpec> = {
  second: { key: 'second', label: 'Second', min: 0, max: 59 },
  minute: { key: 'minute', label: 'Minute', min: 0, max: 59 },
  hour: { key: 'hour', label: 'Hour', min: 0, max: 23 },
  dayOfMonth: { key: 'dayOfMonth', label: 'Day of month', min: 1, max: 31 },
  month: { key: 'month', label: 'Month', min: 1, max: 12, names: MONTH_NAMES },
  dayOfWeek: { key: 'dayOfWeek', label: 'Day of week', min: 0, max: 7, names: DAY_NAMES },
}

function parseValue(token: string, spec: FieldSpec): number {
  const lower = token.toLowerCase()
  if (spec.names) {
    const index = spec.names.indexOf(lower.slice(0, 3))
    if (index >= 0) return spec.key === 'month' ? index + 1 : index
  }
  if (!/^\d+$/.test(token)) {
    throw new CronError(
      `${spec.label}: “${token}” is not a number${spec.names ? ' or a recognised three-letter name' : ''}.`,
      spec.label,
    )
  }
  const n = Number(token)
  if (n < spec.min || n > spec.max) {
    throw new CronError(
      `${spec.label}: ${n} is outside the allowed range ${spec.min}-${spec.max}.`,
      spec.label,
    )
  }
  return n
}

function parseField(raw: string, spec: FieldSpec): CronField {
  const trimmed = raw.trim()
  if (!trimmed) throw new CronError(`${spec.label}: the field is empty.`, spec.label)

  if (/[LW#]/i.test(trimmed)) {
    throw new CronError(
      `${spec.label}: the Quartz extensions L, W and # are not supported here. Use explicit values, ranges or steps instead.`,
      spec.label,
    )
  }

  const all = trimmed === '*' || trimmed === '?'
  const values = new Set<number>()

  for (const part of trimmed.split(',')) {
    if (!part) throw new CronError(`${spec.label}: an empty item in the list “${trimmed}”.`, spec.label)

    const [rangePart, stepPart] = part.split('/')
    let step = 1
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || Number(stepPart) === 0) {
        throw new CronError(
          `${spec.label}: “/${stepPart}” is not a valid step. It must be a whole number of 1 or more.`,
          spec.label,
        )
      }
      step = Number(stepPart)
    }

    let start: number
    let end: number
    if (rangePart === '*' || rangePart === '?' || rangePart === '') {
      start = spec.min
      end = spec.max
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-')
      start = parseValue(a, spec)
      end = parseValue(b, spec)
      if (start > end) {
        throw new CronError(
          `${spec.label}: the range ${rangePart} runs backwards. The first value must not be larger than the second.`,
          spec.label,
        )
      }
    } else {
      start = parseValue(rangePart, spec)
      end = stepPart !== undefined ? spec.max : start
    }

    for (let v = start; v <= end; v += step) values.add(v)
  }

  // Cron allows 7 as Sunday.
  if (spec.key === 'dayOfWeek' && values.has(7)) {
    values.delete(7)
    values.add(0)
  }

  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) {
    throw new CronError(`${spec.label}: no values matched “${trimmed}”.`, spec.label)
  }
  return { values: sorted, restricted: !all, raw: trimmed }
}

export function parseCron(expression: string): ParsedCron {
  const trimmed = expression.trim().toLowerCase()
  if (!trimmed) throw new CronError('Enter a cron expression.')

  const expanded = SHORTCUTS[trimmed] ?? expression.trim()
  const parts = expanded.split(/\s+/)

  if (parts.length !== 5 && parts.length !== 6) {
    throw new CronError(
      `A cron expression needs 5 fields (minute hour day month weekday) or 6 with a leading seconds field. This has ${parts.length}.`,
    )
  }

  const hasSeconds = parts.length === 6
  const offset = hasSeconds ? 1 : 0

  return {
    hasSeconds,
    second: hasSeconds
      ? parseField(parts[0], SPECS.second)
      : { values: [0], restricted: true, raw: '0' },
    minute: parseField(parts[offset], SPECS.minute),
    hour: parseField(parts[offset + 1], SPECS.hour),
    dayOfMonth: parseField(parts[offset + 2], SPECS.dayOfMonth),
    month: parseField(parts[offset + 3], SPECS.month),
    dayOfWeek: parseField(parts[offset + 4], SPECS.dayOfWeek),
  }
}

/* ------------------------------------------------------------------ */
/* Next run times                                                      */
/* ------------------------------------------------------------------ */

function dayMatches(cron: ParsedCron, date: Date): boolean {
  const domOk = cron.dayOfMonth.values.includes(date.getDate())
  const dowOk = cron.dayOfWeek.values.includes(date.getDay())
  if (cron.dayOfMonth.restricted && cron.dayOfWeek.restricted) return domOk || dowOk
  if (cron.dayOfMonth.restricted) return domOk
  if (cron.dayOfWeek.restricted) return dowOk
  return true
}

/**
 * Walk forward from `from`, skipping whole months, days and hours whenever the
 * current one cannot match, so even a "29 February" schedule resolves quickly.
 */
export function nextRuns(cron: ParsedCron, from: Date, count: number): Date[] {
  const out: Date[] = []
  const cursor = new Date(from.getTime())
  cursor.setMilliseconds(0)
  cursor.setSeconds(cursor.getSeconds() + 1)

  const limit = new Date(from.getTime())
  limit.setFullYear(limit.getFullYear() + 8)

  let guard = 0
  while (out.length < count && cursor <= limit && guard < 500_000) {
    guard += 1

    if (!cron.month.values.includes(cursor.getMonth() + 1)) {
      cursor.setMonth(cursor.getMonth() + 1, 1)
      cursor.setHours(0, 0, 0, 0)
      continue
    }
    if (!dayMatches(cron, cursor)) {
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(0, 0, 0, 0)
      continue
    }
    if (!cron.hour.values.includes(cursor.getHours())) {
      cursor.setHours(cursor.getHours() + 1, 0, 0, 0)
      continue
    }
    if (!cron.minute.values.includes(cursor.getMinutes())) {
      cursor.setMinutes(cursor.getMinutes() + 1, 0, 0)
      continue
    }
    if (!cron.second.values.includes(cursor.getSeconds())) {
      cursor.setSeconds(cursor.getSeconds() + 1, 0)
      continue
    }

    out.push(new Date(cursor.getTime()))
    cursor.setSeconds(cursor.getSeconds() + 1)
  }

  return out
}

/* ------------------------------------------------------------------ */
/* Plain-English description                                           */
/* ------------------------------------------------------------------ */

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

function joinWords(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Detect a plain star-slash-n style step so we can say "every n minutes". */
function stepOf(field: CronField, min: number, max: number): number | null {
  const match = /^\*\/(\d+)$/.exec(field.raw)
  if (!match) return null
  const step = Number(match[1])
  const expected = Math.floor((max - min) / step) + 1
  return field.values.length === expected ? step : null
}

const pad = (n: number) => String(n).padStart(2, '0')

export function describeCron(cron: ParsedCron): string {
  const { second, minute, hour, dayOfMonth, month, dayOfWeek, hasSeconds } = cron

  /* --- when in the day --- */
  let time: string
  const minuteStep = stepOf(minute, 0, 59)
  const hourStep = stepOf(hour, 0, 23)
  const secondStep = stepOf(second, 0, 59)

  const everyMinute = !minute.restricted
  const everyHour = !hour.restricted
  const everySecond = hasSeconds && !second.restricted

  if (hasSeconds && everySecond && everyMinute && everyHour) {
    time = 'Every second'
  } else if (hasSeconds && secondStep && everyMinute && everyHour) {
    time = `Every ${secondStep} seconds`
  } else if (everyMinute && everyHour) {
    time = 'Every minute'
  } else if (minuteStep && everyHour) {
    time = `Every ${minuteStep} minutes`
  } else if (everyMinute && !everyHour) {
    time = `Every minute during ${joinWords(hour.values.map((h) => `${pad(h)}:00–${pad(h)}:59`))}`
  } else if (hourStep && !everyMinute && minute.values.length === 1) {
    time = `Every ${hourStep} hours, at ${minute.values[0]} minutes past the hour`
  } else if (everyHour) {
    time = `At ${joinWords(minute.values.map((m) => `${m} minutes past`))} every hour`
  } else if (minute.values.length * hour.values.length <= 12) {
    const times: string[] = []
    for (const h of hour.values) for (const m of minute.values) times.push(`${pad(h)}:${pad(m)}`)
    times.sort()
    time = `At ${joinWords(times)}`
  } else {
    time = `At ${joinWords(minute.values.map(String))} minutes past ${joinWords(hour.values.map((h) => `${pad(h)}:00`))}`
  }

  if (hasSeconds && second.restricted && second.values.length === 1 && second.values[0] !== 0) {
    time += `, ${second.values[0]} seconds in`
  }

  /* --- which days --- */
  const dayParts: string[] = []
  if (dayOfMonth.restricted) {
    const step = /^\*\/(\d+)$/.exec(dayOfMonth.raw)
    dayParts.push(
      step
        ? `every ${ordinal(Number(step[1]))} day of the month`
        : `on the ${joinWords(dayOfMonth.values.map(ordinal))}`,
    )
  }
  if (dayOfWeek.restricted) {
    dayParts.push(`on ${joinWords(dayOfWeek.values.map((d) => DAY_LABELS[d] ?? String(d)))}`)
  }

  let days: string
  if (dayParts.length === 0) {
    days = 'every day'
  } else if (dayParts.length === 2) {
    days = `${dayParts[0]} or ${dayParts[1]} (classic cron treats a restricted day-of-month and day-of-week as OR, so it runs on either)`
  } else {
    days = dayParts[0]
  }

  /* --- which months --- */
  const months = month.restricted
    ? ` in ${joinWords(month.values.map((m) => MONTH_LABELS[m - 1] ?? String(m)))}`
    : ''

  return `${time}, ${days}${months}.`
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export const PRESETS: { label: string; expression: string }[] = [
  { label: 'Every minute', expression: '* * * * *' },
  { label: 'Every 5 minutes', expression: '*/5 * * * *' },
  { label: 'Every 15 minutes', expression: '*/15 * * * *' },
  { label: 'Every 30 minutes', expression: '*/30 * * * *' },
  { label: 'Every hour, on the hour', expression: '0 * * * *' },
  { label: 'Every 6 hours', expression: '0 */6 * * *' },
  { label: 'Every day at midnight', expression: '0 0 * * *' },
  { label: 'Every day at 09:00', expression: '0 9 * * *' },
  { label: 'Twice a day (00:00 and 12:00)', expression: '0 0,12 * * *' },
  { label: 'Weekdays at 09:00', expression: '0 9 * * 1-5' },
  { label: 'Every Sunday at midnight', expression: '0 0 * * 0' },
  { label: 'First day of the month', expression: '0 0 1 * *' },
  { label: 'Last-ish: 28th of every month', expression: '0 0 28 * *' },
  { label: 'Quarterly (Jan, Apr, Jul, Oct)', expression: '0 0 1 1,4,7,10 *' },
  { label: 'Once a year on 1 January', expression: '0 0 1 1 *' },
  { label: 'Every 30 seconds (6-field)', expression: '*/30 * * * * *' },
]

export const FIELD_HELP: { label: string; range: string; note: string }[] = [
  { label: 'Second', range: '0-59', note: 'Only in 6-field expressions (Quartz, Spring, node-cron)' },
  { label: 'Minute', range: '0-59', note: '' },
  { label: 'Hour', range: '0-23', note: '24-hour clock, 0 is midnight' },
  { label: 'Day of month', range: '1-31', note: '? behaves like *' },
  { label: 'Month', range: '1-12', note: 'JAN-DEC also accepted' },
  { label: 'Day of week', range: '0-7', note: '0 and 7 are both Sunday; SUN-SAT also accepted' },
]
