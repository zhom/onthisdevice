import type { Answer } from './types'
import { count } from './format'

/** A calendar day. Month is 0-based, as in Date. */
interface Ymd {
  y: number
  m: number
  d: number
}
/** Which year to pick when a date has no year: the next one, the last one, or this one. */
type Mode = 'future' | 'past' | 'this'

const DAY = 86400000
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Calendar arithmetic runs on UTC day numbers, so DST never shifts a count.
const dayNum = (t: Ymd) => Math.floor(Date.UTC(t.y, t.m, t.d) / DAY)
function fromNum(n: number): Ymd {
  const d = new Date(n * DAY)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() }
}
const plus = (t: Ymd, days: number) => fromNum(dayNum(t) + days)
const weekday = (t: Ymd) => new Date(dayNum(t) * DAY).getUTCDay()
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
const todayOf = (now: Date): Ymd => ({ y: now.getFullYear(), m: now.getMonth(), d: now.getDate() })

const longDate = (t: Ymd) => `${WEEKDAYS[weekday(t)]}, ${t.d} ${MONTHS[t.m]} ${t.y}`
const shortDate = (t: Ymd) => `${t.d} ${MONTHS[t.m]} ${t.y}`
const iso = (t: Ymd) => `${t.y}-${String(t.m + 1).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`

/** The nth weekday (0 = Sunday) of a month; n = -1 is the last one. */
function nth(y: number, m: number, wd: number, n: number): Ymd {
  if (n < 0) {
    const last = { y, m, d: daysIn(y, m) }
    return plus(last, -((weekday(last) - wd + 7) % 7))
  }
  return { y, m, d: 1 + ((wd - weekday({ y, m, d: 1 }) + 7) % 7) + (n - 1) * 7 }
}

/** Western Easter Sunday (anonymous Gregorian algorithm). */
function easter(y: number): Ymd {
  const a = y % 19
  const b = Math.floor(y / 100)
  const c = y % 100
  const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7
  const k = Math.floor((a + 11 * h + 22 * l) / 451)
  const x = h + l - 7 * k + 114
  return { y, m: Math.floor(x / 31) - 1, d: (x % 31) + 1 }
}

const fixed = (m: number, d: number) => (y: number): Ymd => ({ y, m, d })
const thanksgiving = (y: number) => nth(y, 10, 4, 4)

const HOLIDAYS: [RegExp, string, (y: number) => Ymd][] = [
  [/^(?:christmas|xmas)(?: day)?$/, 'Christmas', fixed(11, 25)],
  [/^(?:christmas|xmas) eve$/, 'Christmas Eve', fixed(11, 24)],
  [/^new years? eve$|^nye$/, "New Year's Eve", fixed(11, 31)],
  [/^new years?(?: day)?$/, "New Year's Day", fixed(0, 1)],
  [/^halloween$/, 'Halloween', fixed(9, 31)],
  [/^valentines?(?: day)?$/, "Valentine's Day", fixed(1, 14)],
  [/^(?:st\.?|saint) (?:patricks|paddys)(?: day)?$/, "St Patrick's Day", fixed(2, 17)],
  [/^independence day$|^(?:4th|fourth) of july$|^july (?:4th|4|fourth)$/, 'Independence Day', fixed(6, 4)],
  [/^juneteenth$/, 'Juneteenth', fixed(5, 19)],
  [/^veterans day$/, 'Veterans Day', fixed(10, 11)],
  [/^boxing day$/, 'Boxing Day', fixed(11, 26)],
  [/^thanksgiving(?: day)?$/, 'Thanksgiving', thanksgiving],
  [/^black friday$/, 'Black Friday', (y) => plus(thanksgiving(y), 1)],
  [/^cyber monday$/, 'Cyber Monday', (y) => plus(thanksgiving(y), 4)],
  [/^mothers? day$/, "Mother's Day", (y) => nth(y, 4, 0, 2)],
  [/^fathers? day$/, "Father's Day", (y) => nth(y, 5, 0, 3)],
  [/^labou?r day$/, 'Labor Day', (y) => nth(y, 8, 1, 1)],
  [/^memorial day$/, 'Memorial Day', (y) => nth(y, 4, 1, -1)],
  [/^(?:mlk|martin luther king)(?: jr)? day$/, 'Martin Luther King Jr. Day', (y) => nth(y, 0, 1, 3)],
  [/^presidents? day$/, "Presidents' Day", (y) => nth(y, 1, 1, 3)],
  [/^easter(?: sunday)?$/, 'Easter', easter],
  [/^good friday$/, 'Good Friday', (y) => plus(easter(y), -2)],
]

function month(word: string): number {
  if (word.length < 3) return -1
  if (word === 'sept') return 8
  return MONTHS.findIndex((m) => m.toLowerCase().startsWith(word))
}

/** Picks the year for a month and day without one. */
function withYear(m: number, d: number, today: Ymd, mode: Mode, rule?: (y: number) => Ymd): Ymd {
  const make = rule ?? ((y: number) => ({ y, m, d }))
  const t = make(today.y)
  if (mode === 'future' && dayNum(t) < dayNum(today)) return make(today.y + 1)
  if (mode === 'past' && dayNum(t) > dayNum(today)) return make(today.y - 1)
  return t
}

interface Target {
  date: Ymd
  /** Holiday name, or null for a typed date. */
  holiday: string | null
}

const ISO = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/
const US = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?$/
const DMY = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
const DAY_MONTH = /^(\d{1,2}) ([a-z]+)(?: (\d{4}))?$/
const MONTH_DAY = /^([a-z]+) (\d{1,2})(?: (\d{4}))?$/

/** "2026-12-25", "12/25/2026", "25 dec 2026", "dec 25", "december 25, 2026", "christmas", "today". */
function parseDate(raw: string, today: Ymd, mode: Mode): Target | null {
  const s = raw.replace(/^the /, '')
  if (s === 'today' || s === 'now') return { date: today, holiday: null }
  if (s === 'tomorrow') return { date: plus(today, 1), holiday: null }
  if (s === 'yesterday') return { date: plus(today, -1), holiday: null }
  const yearMatch = /^(.+) (\d{4})$/.exec(s)
  for (const [re, name, rule] of HOLIDAYS) {
    if (re.test(s)) return { date: withYear(0, 1, today, mode, rule), holiday: name }
    if (yearMatch && re.test(yearMatch[1])) return { date: rule(Number(yearMatch[2])), holiday: name }
  }
  let y = 0
  let m = -1
  let d = 0
  let r: RegExpExecArray | null
  const t = s.replace(/,/g, '').replace(/(\d)(?:st|nd|rd|th)\b/g, '$1').replace(/ of /g, ' ')
  if ((r = ISO.exec(t))) [y, m, d] = [Number(r[1]), Number(r[2]) - 1, Number(r[3])]
  else if ((r = US.exec(t))) [y, m, d] = [r[3] ? Number(r[3]) : 0, Number(r[1]) - 1, Number(r[2])]
  else if ((r = DMY.exec(t))) [y, m, d] = [Number(r[3]), Number(r[2]) - 1, Number(r[1])]
  else if ((r = DAY_MONTH.exec(t))) [y, m, d] = [r[3] ? Number(r[3]) : 0, month(r[2]), Number(r[1])]
  else if ((r = MONTH_DAY.exec(t))) [y, m, d] = [r[3] ? Number(r[3]) : 0, month(r[1]), Number(r[2])]
  else return null
  if (y && y < 100) y += 2000
  if (m < 0 || m > 11 || d < 1 || d > daysIn(y || 2000, m)) return null
  if (y) return d > daysIn(y, m) ? null : { date: { y, m, d }, holiday: null }
  const date = withYear(m, d, today, mode)
  return d > daysIn(date.y, m) ? null : { date, holiday: null }
}

const describe = (t: Target, today: Ymd) =>
  t.holiday === null ? shortDate(t.date) : t.date.y === today.y ? t.holiday : `${t.holiday} ${t.date.y}`

function dayCount(n: number, unit: string): string {
  if (unit.startsWith('week')) {
    const w = Math.floor(n / 7)
    return n % 7 ? `${count(w, 'week')}, ${count(n % 7, 'day')}` : count(w, 'week')
  }
  return count(n, 'day')
}

function addUnits(t: Ymd, n: number, unit: string): Ymd {
  if (unit === 'day') return plus(t, n)
  if (unit === 'week') return plus(t, 7 * n)
  const months = t.m + (unit === 'year' ? 12 * n : n)
  const y = t.y + Math.floor(months / 12)
  const m = ((months % 12) + 12) % 12
  return { y, m, d: Math.min(t.d, daysIn(y, m)) }
}

function isoWeek(t: Ymd): [number, number] {
  const thursday = dayNum(t) - ((weekday(t) + 6) % 7) + 3
  const year = fromNum(thursday).y
  return [year, Math.floor((thursday - dayNum({ y: year, m: 0, d: 1 })) / 7) + 1]
}

const UNTIL = /^(?:how many |number of )?(days?|weeks?|sleeps)(?: are)?(?: left)? (?:until|till|til|untill|to|before) (.+)$/
const HOW_LONG = /^(?:how long|time|countdown) (?:until|till|til|to) (.+)$/
const SINCE = /^(?:how many )?(days?|weeks?)(?: has it been| have passed)? since (.+)$/
const BETWEEN = /^(?:how many )?(days?|weeks?)(?: are)? (?:between|from) (.+?) (?:and|to|until|till) (.+)$/
const WHEN = /^(?:when is|whens|date of|what date is|what day is) (.+)$/
/** "what day of the week was 4 july 1976", "day of week 2026-12-25", "what day was 1 jan 2000" */
const WEEKDAY_OF = [
  /^(?:day of (?:the )?week|weekday) (?:of |for |on )?(.+)$/,
  /^(?:what |which )?(?:day of (?:the )?week|weekday|day)(?: of (?:the )?week)? (?:was|is|will be|for|of|on|falls on) (.+)$/,
]
const N = '(\\d{1,6}|an?|one)'
const UNIT = '(day|week|month|year)s?'
const OFFSET = [
  new RegExp(`^${N} ${UNIT} (from|after|before) (.+)$`),
  new RegExp(`^${N} ${UNIT} (ago)$`),
  new RegExp(`^(in) ${N} ${UNIT}$`),
]
/** Phrases for a day near today, with the shift in days. */
const TODAY = new Map<string, number>([
  ...['today', 'date', 'the date', 'todays date', 'date today', 'the date today', 'current date', 'today date', 'the day today',
    'what day', 'what day is it', 'what day is today', 'what day is it today', 'what date is it', 'what date is it today',
  ].map((p): [string, number] => [p, 0]),
  ['tomorrow', 1], ['tomorrows date', 1], ['yesterday', -1], ['yesterdays date', -1],
])
const WEEK = new Set([
  'week number', 'week no', 'the week number', 'current week', 'current week number', 'week of the year', 'week of year',
  'what week is it', 'which week is it', 'what week number is it', 'week number today', 'todays week number',
  'what week of the year is it', 'calendar week', 'iso week', 'iso week number', 'kw',
])
const WEEK_OF = /^(?:week number|week no|iso week|calendar week|what week is) (?:of |for )?(.+)$/

function untilAnswer(target: Target, today: Ymd, unit: string): Answer {
  const diff = dayNum(target.date) - dayNum(today)
  const days = Math.abs(diff)
  return {
    kind: 'date',
    value: diff === 0 ? 'Today' : diff > 0 ? dayCount(days, unit) : `${dayCount(days, unit)} ago`,
    label: `${unit.startsWith('week') ? 'Weeks' : 'Days'} until ${describe(target, today)}`,
    copy: String(diff),
    slug: target.holiday === null ? 'date-difference-calculator' : 'days-until-christmas',
    more: [longDate(target.date)],
  }
}

function dateValue(t: Ymd, label: string, slug: string, today: Ymd): Answer {
  const [, week] = isoWeek(t)
  const leap = daysIn(t.y, 1) === 29
  return {
    kind: 'date',
    value: longDate(t),
    label,
    copy: iso(t),
    slug,
    more: [iso(t), `Day ${dayNum(t) - dayNum({ y: t.y, m: 0, d: 1 }) + 1} of ${leap ? 366 : 365}, week ${week}`].concat(
      dayNum(t) === dayNum(today) ? [] : [relativeDays(dayNum(t) - dayNum(today))],
    ),
  }
}

const relativeDays = (n: number) => (n > 0 ? `In ${count(n, 'day')}` : `${count(-n, 'day')} ago`)

/** Day counts to and from dates and holidays, date offsets, today's date and the week number. */
export function dateAnswer(input: string, now: Date): Answer | null {
  if (!/[a-z]/.test(input)) return null
  const s = input.replace(/'/g, '')
  const today = todayOf(now)

  const shift = TODAY.get(s)
  if (shift !== undefined) {
    const label = shift === 0 ? 'Today' : shift > 0 ? 'Tomorrow' : 'Yesterday'
    return dateValue(plus(today, shift), label, 'date-calculator', today)
  }

  if (WEEK.has(s) || WEEK_OF.test(s)) {
    const of = WEEK.has(s) ? { date: today, holiday: null } : parseDate(WEEK_OF.exec(s)?.[1] ?? '', today, 'this')
    if (!of) return null
    const [year, week] = isoWeek(of.date)
    const monday = plus(of.date, -((weekday(of.date) + 6) % 7))
    return {
      kind: 'date',
      value: `Week ${week}`,
      label: WEEK.has(s) ? 'ISO week number today' : `ISO week number of ${describe(of, today)}`,
      copy: String(week),
      slug: 'week-number-calculator',
      more: [`${year}-W${String(week).padStart(2, '0')}`, `${shortDate(monday)} to ${shortDate(plus(monday, 6))}`],
    }
  }

  let m = BETWEEN.exec(s)
  if (m) {
    const a = parseDate(m[2], today, 'this')
    const b = parseDate(m[3], today, 'this')
    if (!a || !b) return null
    const diff = Math.abs(dayNum(b.date) - dayNum(a.date))
    return {
      kind: 'date',
      value: dayCount(diff, m[1]),
      label: `Days between ${describe(a, today)} and ${describe(b, today)}`,
      copy: String(diff),
      slug: 'date-difference-calculator',
    }
  }

  if ((m = UNTIL.exec(s) ?? HOW_LONG.exec(s))) {
    const unit = m.length > 2 ? m[1] : 'days'
    const target = parseDate(m[m.length - 1], today, 'future')
    return target ? untilAnswer(target, today, unit) : null
  }

  if ((m = SINCE.exec(s))) {
    const target = parseDate(m[2], today, 'past')
    if (!target) return null
    const diff = dayNum(today) - dayNum(target.date)
    return {
      kind: 'date',
      value: diff < 0 ? `In ${dayCount(-diff, m[1])}` : dayCount(diff, m[1]),
      label: `Days since ${describe(target, today)}`,
      copy: String(diff),
      slug: 'date-difference-calculator',
      more: [longDate(target.date)],
    }
  }

  const asked = WEEKDAY_OF.map((re) => re.exec(s)?.[1]).filter((x): x is string => Boolean(x))
  const target = asked.length ? asked.map((d) => parseDate(d, today, 'this')).find(Boolean) : undefined
  if (asked.length) {
    if (!target) return null
    return {
      kind: 'date',
      value: WEEKDAYS[weekday(target.date)],
      label: describe(target, today),
      copy: WEEKDAYS[weekday(target.date)],
      slug: 'date-calculator',
      more: [longDate(target.date)],
    }
  }

  if ((m = WHEN.exec(s))) {
    const target = parseDate(m[1], today, 'future')
    if (!target) return null
    const label = target.holiday ? `${target.holiday} ${target.date.y}` : shortDate(target.date)
    return dateValue(target.date, label, target.holiday ? 'days-until-christmas' : 'date-calculator', today)
  }

  for (const re of OFFSET) {
    const o = re.exec(s)
    if (!o) continue
    const [num, unit, dir, from] = re === OFFSET[2] ? [o[2], o[3], 'from', 'today'] : [o[1], o[2], o[3], o[4] ?? 'today']
    const n = /^\d/.test(num) ? Number(num) : 1
    const base = parseDate(from, today, 'this')
    if (!base || n > 100000) return null
    const sign = dir === 'before' || dir === 'ago' ? -1 : 1
    return dateValue(addUnits(base.date, sign * n, unit), s[0].toUpperCase() + s.slice(1), 'date-calculator', today)
  }
  return null
}
