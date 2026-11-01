import type { Answer } from './types'
import { count } from './format'

const SLUG = 'unix-timestamp-converter'
const MIN = Date.UTC(2001, 0, 1)
const MAX = Date.UTC(2100, 0, 1)

const NOW_WORDS = new Set([
  'now', 'timestamp', 'time stamp', 'epoch', 'epoch time', 'unix', 'unix time', 'unix timestamp', 'unix epoch',
  'posix time', 'current timestamp', 'current unix time', 'current unix timestamp', 'current epoch', 'current epoch time',
  'the unix time', 'the timestamp', 'timestamp now', 'unix time now', 'unix timestamp now', 'epoch now',
])
const STAMP = /^(?:(?:unix|epoch|timestamp|unix timestamp|unix time) )?(\d{9,10}|\d{12,13})(?: (?:to|in) (?:date|utc|iso|local|local time|human date))?$/

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** "2026-10-30 12:00:00" from UTC or local fields. */
function stamp(d: Date, utc: boolean): string {
  const [y, mo, day, h, mi, s, ms] = utc
    ? [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()]
    : [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]
  return `${y}-${pad(mo + 1)}-${pad(day)} ${pad(h)}:${pad(mi)}:${pad(s)}${ms ? '.' + pad(ms, 3) : ''}`
}

function zone(d: Date): string {
  const off = -d.getTimezoneOffset()
  if (!off) return 'UTC'
  const a = Math.abs(off)
  return `UTC${off < 0 ? '-' : '+'}${Math.floor(a / 60)}${a % 60 ? ':' + pad(a % 60) : ''}`
}

/** "in 3 days", "2 hours ago", "now". */
function relative(ms: number): string {
  const a = Math.abs(ms) / 1000
  if (a < 1) return 'now'
  const steps: [number, string][] = [[31556952, 'year'], [86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second']]
  const [size, word] = steps.find(([size]) => a >= size) ?? [1, 'second']
  const text = count(Math.floor(a / size), word)
  return ms > 0 ? `in ${text}` : `${text} ago`
}

/** "1761825600" (seconds), "1761825600000" (milliseconds), "now", "unix timestamp". */
export function timeAnswer(s: string, now: Date): Answer | null {
  if (NOW_WORDS.has(s)) {
    const sec = String(Math.floor(now.getTime() / 1000))
    return {
      kind: 'time',
      value: sec,
      label: 'Unix timestamp now',
      copy: sec,
      slug: SLUG,
      more: [`${stamp(now, true)} UTC`, `Milliseconds ${now.getTime()}`],
    }
  }
  const m = STAMP.exec(s)
  if (!m) return null
  const digits = m[1]
  const ms = digits.length > 10 ? Number(digits) : Number(digits) * 1000
  if (ms < MIN || ms >= MAX) return null
  const d = new Date(ms)
  return {
    kind: 'time',
    value: `${stamp(d, true)} UTC`,
    label: `Unix ${digits.length > 10 ? 'milliseconds' : 'seconds'} ${digits}`,
    copy: d.toISOString(),
    slug: SLUG,
    more: [`${stamp(d, false)} local (${zone(d)})`, relative(ms - now.getTime())],
  }
}
