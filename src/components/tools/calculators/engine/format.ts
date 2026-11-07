/**
 * Display helpers for the calculator specs. Pure, so the Node tests import them.
 * The locale is fixed to en-US, so server HTML and the first client render match.
 */
import { dec, fixed, fmt, num, sci, sub } from '@/components/tools/calc2/_viz/format'

export { dec, fixed, fmt, num, sci, sub }

const MINUS = '−'

/** "$1,234.56", "−$12.00". */
export function usd(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return '–'
  const r = Number(n.toFixed(dp))
  const s = Math.abs(r).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
  return r < 0 ? `${MINUS}$${s}` : `$${s}`
}

/** Whole dollars: "$1,235". */
export const usd0 = (n: number): string => usd(n, 0)

/** "12.5%" with at most `dp` decimals. */
export function pct(n: number, dp = 2): string {
  return `${dec(n, dp)}%`
}

/** Plural helper: "1 year", "3 years". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${dec(n, 2)} ${Math.abs(n) === 1 ? one : many}`
}

/** Months as "4 years 3 months". */
export function yearsMonths(months: number): string {
  const m = Math.round(months)
  const y = Math.floor(m / 12)
  const r = m % 12
  const parts: string[] = []
  if (y) parts.push(`${y} ${y === 1 ? 'year' : 'years'}`)
  if (r || !y) parts.push(`${r} ${r === 1 ? 'month' : 'months'}`)
  return parts.join(' ')
}

/** "Mon, Jan 5, 2026" in UTC-free local calendar terms. */
export function longDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

/** "Jan 5, 2026". */
export function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Grouped integer: "1,234,567". */
export function int(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '–'
}
