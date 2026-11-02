/**
 * Exact decimal strings for scientific notation and significant figures:
 * value = (−1)^neg × digits × 10^exp, with `digits` an integer string. No
 * floating point between what is typed and what is shown. Pure; tests import it.
 */

export interface Dec {
  neg: boolean
  /** Integer digit string without leading zeros ("0" for zero). Trailing zeros are significant. */
  digits: string
  exp: number
}

export interface Parsed {
  dec: Dec
  /** The mantissa as typed, without sign: "0.00450", "1200.", "1.20". */
  mantissa: string
  /** The power of ten typed after it (0 when none). */
  power: number
  hasPoint: boolean
}

const SUPER: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' }

/** Accepts 1200, -0.00450, 1.20e3, 6.022E23, 1.2 × 10^5, 1.2x10^-3, 3.0 × 10⁸. */
export function parseDec(raw: string): Parsed | null {
  let s = raw.trim().replace(/[\s,_]/g, '').replace(/[−–]/g, '-')
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/g, (c) => SUPER[c] ?? c)
  s = s.replace(/(?:[×x*·⋅])10\^?(?=[+-]?\d)/i, 'e')
  const m = s.match(/^([+-]?)(\d*\.?\d*)(?:e([+-]?\d+))?$/i)
  if (!m) return null
  const sign = m[1] ?? ''
  const mantissa = m[2] ?? ''
  if (!/\d/.test(mantissa)) return null
  const power = m[3] ? Number(m[3]) : 0
  if (!Number.isFinite(power) || Math.abs(power) > 100000) return null
  const hasPoint = mantissa.includes('.')
  const [intPart = '', frac = ''] = mantissa.split('.')
  let digits = (intPart + frac).replace(/^0+/, '')
  let exp = power - frac.length
  if (digits === '') return { dec: { neg: false, digits: '0', exp: 0 }, mantissa, power, hasPoint }
  // Trailing zeros of a whole number with no decimal point carry no precision.
  if (!hasPoint) {
    const t = digits.match(/0+$/)?.[0].length ?? 0
    if (t > 0 && t < digits.length) {
      digits = digits.slice(0, -t)
      exp += t
    }
  }
  return { dec: { neg: sign === '-', digits, exp }, mantissa, power, hasPoint }
}

/** Exponent of the leading digit: 1234 → 3, 0.0045 → −3. */
export function magnitude(d: Dec): number {
  return d.digits === '0' ? 0 : d.exp + d.digits.length - 1
}

/** Plain decimal text: 0.00450, 1200, 1200.5. */
export function toPlain(d: Dec, group = false): string {
  const sign = d.neg ? '−' : ''
  if (d.digits === '0') return '0'
  let s: string
  if (d.exp >= 0) s = d.digits + '0'.repeat(d.exp)
  else {
    const k = -d.exp
    const padded = d.digits.padStart(k + 1, '0')
    s = `${padded.slice(0, padded.length - k)}.${padded.slice(padded.length - k)}`
  }
  if (group) {
    const [i = '', f] = s.split('.')
    s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f !== undefined ? `.${f}` : '')
  }
  return sign + s
}

/** Mantissa and exponent with one digit before the point. */
export function toSciParts(d: Dec): { mant: string; exp: number } {
  if (d.digits === '0') return { mant: '0', exp: 0 }
  const mant = `${d.neg ? '−' : ''}${d.digits[0]}${d.digits.length > 1 ? `.${d.digits.slice(1)}` : ''}`
  return { mant, exp: magnitude(d) }
}

/** Mantissa from 1 to 999 and an exponent that is a multiple of 3. */
export function toEngParts(d: Dec): { mant: string; exp: number } {
  if (d.digits === '0') return { mant: '0', exp: 0 }
  const mag = magnitude(d)
  const exp = Math.floor(mag / 3) * 3
  const shifted: Dec = { neg: d.neg, digits: d.digits, exp: d.exp - exp }
  return { mant: toPlain(shifted), exp }
}

/** Round to n significant digits, half away from zero; pads with zeros to show n digits. */
export function roundSig(d: Dec, n: number): Dec {
  if (d.digits === '0') return d
  if (d.digits.length <= n) return { ...d, digits: d.digits + '0'.repeat(n - d.digits.length), exp: d.exp - (n - d.digits.length) }
  return roundKeep(d, n)
}

/** Round so the last kept digit is in the 10^place position (pads with zeros when finer). */
export function roundPlace(d: Dec, place: number): Dec {
  if (d.digits === '0') return { neg: false, digits: '0', exp: 0 }
  if (d.exp >= place) return { ...d, digits: d.digits + '0'.repeat(d.exp - place), exp: place }
  const keep = d.digits.length - (place - d.exp)
  if (keep < 0) return { neg: false, digits: '0', exp: 0 }
  if (keep === 0) {
    // Only the rounding digit is left: 0.004 to the tenths is 0.0, 0.06 is 0.1.
    return Number(d.digits[0]) >= 5 ? { neg: d.neg, digits: '1', exp: place } : { neg: false, digits: '0', exp: 0 }
  }
  return roundKeep(d, keep)
}

function roundKeep(d: Dec, keep: number): Dec {
  const cut = d.digits.length - keep
  let head = d.digits.slice(0, keep)
  const next = Number(d.digits[keep])
  let exp = d.exp + cut
  if (next >= 5) {
    const inc = (BigInt(head) + 1n).toString()
    if (inc.length > head.length) {
      head = inc.slice(0, -1)
      exp += 1
    } else head = inc.padStart(head.length, '0')
  }
  return { neg: d.neg, digits: head, exp }
}

/** A JS number as a Dec with up to 15 significant digits (trailing zeros dropped). */
export function fromNumber(n: number): Dec {
  if (n === 0 || !Number.isFinite(n)) return { neg: false, digits: '0', exp: 0 }
  const [m = '0', e = '0'] = Math.abs(n).toPrecision(15).split('e')
  const [i = '', f = ''] = m.split('.')
  let digits = (i + f).replace(/^0+/, '')
  let exp = Number(e) - f.length
  const t = digits.match(/0+$/)?.[0].length ?? 0
  if (t && t < digits.length) {
    digits = digits.slice(0, -t)
    exp += t
  }
  return { neg: n < 0, digits: digits || '0', exp }
}

export function toNumber(d: Dec): number {
  return Number(`${d.neg ? '-' : ''}${d.digits}e${d.exp}`)
}
