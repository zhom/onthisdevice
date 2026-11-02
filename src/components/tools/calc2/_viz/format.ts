/**
 * Number parsing and display for the calc2 calculators. Pure functions: the
 * test script imports this file directly, so no `@/` imports here.
 */

export const MINUS = '−'

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '-': '⁻', '−': '⁻', '+': '⁺', '.': '·',
}

/** "12" -> "¹²", "-3" -> "⁻³". */
export function sup(s: string | number): string {
  return String(s).replace(/[0-9+\-−.]/g, (c) => SUP[c] ?? c)
}

/** Use the typographic minus sign. */
export function minus(s: string): string {
  return s.replace(/-/g, MINUS)
}

/**
 * Parse what a person types: "1,234.5", " 3 ", "−2", "1e-3", "2.5E6".
 * Returns null for empty or invalid text.
 */
export function parseNum(raw: string): number | null {
  const s = raw.trim().replace(/[−–]/g, '-').replace(/[,_\s]/g, '')
  if (s === '' || s === '-' || s === '.' || s === '+') return null
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** "1.23 × 10⁵" with `sig` significant digits. */
export function sci(n: number, sig = 4): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? `${MINUS}∞` : 'undefined'
  if (n === 0) return '0'
  const [m, e] = n.toExponential(Math.max(0, sig - 1)).split('e')
  const mant = trimZeros(m ?? '0')
  const exp = Number(e)
  return minus(exp === 0 ? mant : `${mant} × 10${sup(exp)}`)
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

/**
 * Up to `sig` significant digits, thousands separators, trailing zeros
 * trimmed, a real minus sign. Very large or small values switch to "× 10ⁿ".
 */
export function fmt(n: number, sig = 6): string {
  if (Number.isNaN(n)) return 'undefined'
  if (!Number.isFinite(n)) return n > 0 ? '∞' : `${MINUS}∞`
  if (n === 0 || Object.is(n, -0)) return '0'
  const a = Math.abs(n)
  if (a >= 1e15 || a < 1e-6) return sci(n, Math.min(sig, 6))
  const r = Number(n.toPrecision(Math.max(1, Math.min(sig, 15))))
  if (r === 0) return '0'
  return minus(r.toLocaleString('en-US', { maximumFractionDigits: 15, useGrouping: true }))
}

/** Exactly `dp` decimals, grouped, real minus sign. */
export function fixed(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return fmt(n)
  const r = Number(n.toFixed(dp))
  return minus(
    (Object.is(r, -0) ? 0 : r).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }),
  )
}

/** At most `dp` decimals, grouped, trailing zeros trimmed. */
export function dec(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return fmt(n)
  const r = Number(n.toFixed(dp))
  return minus((Object.is(r, -0) ? 0 : r).toLocaleString('en-US', { maximumFractionDigits: dp }))
}

/** Plain digits for a formula line: no grouping, ASCII-free minus, `sig` digits. */
export function num(n: number, sig = 6): string {
  if (!Number.isFinite(n)) return fmt(n)
  if (n === 0) return '0'
  const a = Math.abs(n)
  if (a >= 1e12 || a < 1e-6) return sci(n, sig)
  return minus(String(Number(n.toPrecision(sig))))
}

/** A value in brackets when it is negative, for substitution into a formula. */
export function sub(n: number, sig = 6): string {
  const s = num(n, sig)
  return n < 0 ? `(${s})` : s
}

/** Seconds as "1 h 02 min", "3 min 05 s", "4.2 s". */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'undefined'
  if (seconds < 60) return `${dec(seconds, seconds < 10 ? 2 : 1)} s`
  const s = Math.round(seconds)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d} d ${h} h ${String(m).padStart(2, '0')} min`
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  return `${m} min ${String(sec).padStart(2, '0')} s`
}
