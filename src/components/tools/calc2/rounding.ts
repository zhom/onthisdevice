/**
 * Rounding on the decimal digits as typed (BigInt), so 1.005 to two places
 * gives 1.01; binary floating point would give 1.00. Pure; the tests import it.
 */

export type RoundMode = 'half-up' | 'half-even' | 'ceil' | 'floor' | 'trunc'

/** value = n × 10^exp, n a signed whole number. */
export interface Dec {
  n: bigint
  exp: number
}

/** "−1,234.50", "1.5e-3", ".25" -> Dec. Null for anything else. */
export function parseDec(raw: string): Dec | null {
  const s = raw.trim().replace(/[−–]/g, '-').replace(/[,_\s]/g, '')
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s)
  if (!m) return null
  const [, sign, int = '', frac = '', e] = m
  if (!int && !frac) return null
  const digits = (int + frac).replace(/^0+(?=\d)/, '') || '0'
  let n = BigInt(digits)
  if (sign === '-') n = -n
  const exp = (e ? Number(e) : 0) - frac.length
  if (!Number.isFinite(exp) || Math.abs(exp) > 400) return null
  return { n, exp }
}

const pow10 = (k: number): bigint => 10n ** BigInt(k)

function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q
}

/** Value of d as text with exactly `places` decimals (places < 0: tens, hundreds…). */
export function decText(m: bigint, places: number): string {
  const neg = m < 0n
  let a = (neg ? -m : m).toString()
  if (places > 0) {
    a = a.padStart(places + 1, '0')
    a = `${a.slice(0, -places)}.${a.slice(-places)}`
  } else if (places < 0 && m !== 0n) a += '0'.repeat(-places)
  return `${neg ? '-' : ''}${a}`
}

export interface Rounded {
  /** The rounded value as text, with the requested decimals. */
  text: string
  /** The two neighbours at that precision: the value lies between them. */
  lower: string
  upper: string
  /** The rounded value is the upper neighbour. */
  wentUp: boolean
  /** The input was already exact at that precision. */
  exact: boolean
  /** Decimal places used (negative: tens, hundreds…). */
  places: number
}

/** Round to `places` decimals (−1 = nearest 10, −2 = nearest 100…). */
export function roundPlaces(d: Dec, places: number, mode: RoundMode): Rounded {
  if (d.exp >= -places) {
    const m = d.n * pow10(d.exp + places)
    const t = decText(m, places)
    return { text: t, lower: t, upper: t, wentUp: false, exact: true, places }
  }
  const P = pow10(-places - d.exp)
  const q = floorDiv(d.n, P)
  const r = d.n - q * P
  let up: boolean
  switch (mode) {
    case 'floor':
      up = false
      break
    case 'ceil':
      up = r > 0n
      break
    case 'trunc':
      up = d.n < 0n && r > 0n
      break
    case 'half-up':
      up = 2n * r > P || (2n * r === P && d.n >= 0n)
      break
    case 'half-even':
      up = 2n * r > P || (2n * r === P && q % 2n !== 0n)
      break
  }
  const m = up ? q + 1n : q
  return { text: decText(m, places), lower: decText(q, places), upper: decText(q + 1n, places), wentUp: up, exact: r === 0n, places }
}

/** Decimal places that keep `sig` significant figures of d. */
export function placesForSig(d: Dec, sig: number): number {
  if (d.n === 0n) return Math.max(0, sig - 1)
  const len = (d.n < 0n ? -d.n : d.n).toString().length
  const lead = len - 1 + d.exp
  return sig - 1 - lead
}

/** Round to significant figures; a carry (9.99 -> 10.0) drops the extra digit. */
export function roundSig(d: Dec, sig: number, mode: RoundMode): Rounded {
  const places = placesForSig(d, sig)
  const r = roundPlaces(d, places, mode)
  const digits = r.text.replace(/[-.]/g, '').replace(/^0+/, '')
  if (places > 0 && digits.length > sig && r.text.endsWith('0')) {
    return { ...r, text: r.text.slice(0, places === 1 ? -2 : -1), places: places - 1 }
  }
  return r
}
