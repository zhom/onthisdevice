/**
 * Number formatting for the calculators. The locale is fixed, so the static
 * HTML and the first client render give the same text in every browser
 * (a visitor's own locale would cause a hydration mismatch).
 */
export const LOCALE = 'en-US'

/** Format a number with grouping separators, capped decimals. */
export function formatNumber(n: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(n)) return '–'
  return n.toLocaleString(LOCALE, { maximumFractionDigits })
}

/** Format as currency; falls back gracefully for unknown codes. */
export function formatCurrency(n: number, currency = 'USD', maximumFractionDigits = 2): string {
  if (!Number.isFinite(n)) return '–'
  try {
    return n.toLocaleString(LOCALE, { style: 'currency', currency, maximumFractionDigits })
  } catch {
    return `${currency} ${formatNumber(n, maximumFractionDigits)}`
  }
}
