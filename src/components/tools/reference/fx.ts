/** Exchange-rate helpers (pure, unit-tested in scripts/data/test.mjs). */

const DAY = 86_400_000

/** Publication days from the gap string: one base-36 character per day, gap from the previous day. */
export function decodeDates(start: string, gaps: string): number[] {
  const out: number[] = new Array(gaps.length)
  let day = Math.round(Date.parse(`${start}T00:00:00Z`) / DAY) - 1
  for (let i = 0; i < gaps.length; i++) {
    day += parseInt(gaps[i], 36)
    out[i] = day
  }
  return out
}

/** Units of `to` per one unit of `from`, from rates quoted per EUR (EUR itself is 1). */
export function crossRate(perEur: Record<string, number>, from: string, to: string): number {
  const a = from === 'EUR' ? 1 : perEur[from]
  const b = to === 'EUR' ? 1 : perEur[to]
  if (!a || !b) return Number.NaN
  return b / a
}

/** Daily pair series (to per from) from two per-EUR series; null where either is missing. */
export function pairSeries(from: ArrayLike<number | null> | null, to: ArrayLike<number | null> | null, length: number): (number | null)[] {
  const out: (number | null)[] = new Array(length)
  for (let i = 0; i < length; i++) {
    const a = from ? from[i] : 1
    const b = to ? to[i] : 1
    out[i] = a && b ? b / a : null
  }
  return out
}

/** Rate rounded for display: 6 significant digits, at least 2 decimals. */
export function formatRate(v: number): string {
  if (!Number.isFinite(v)) return '–'
  const digits = Math.max(2, Math.min(8, 5 - Math.floor(Math.log10(Math.abs(v)))))
  return v.toLocaleString('en-US', { minimumFractionDigits: Math.min(2, digits), maximumFractionDigits: digits })
}

/** Parses a typed amount ("1,234.5", "1 234,5" is read as 1234.5 only when unambiguous). */
export function parseAmount(text: string): number {
  const t = text.trim().replace(/[\s_]/g, '')
  if (!t) return Number.NaN
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ''))
  if (/^-?\d+,\d{1,2}$/.test(t)) return Number(t.replace(',', '.'))
  const n = Number(t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : Number.NaN
}
