/** nth roots, simplified radicals and Newton's method. Pure; the tests import it. */
import { factorize } from './primes'

/** The real nth root, or NaN when there is none (even root of a negative). */
export function nthRoot(x: number, n: number): number {
  if (x < 0) {
    if (n % 2 === 1) return -nthRoot(-x, n)
    return Number.NaN
  }
  if (x === 0) return 0
  let r = Math.pow(x, 1 / n)
  // One Newton step fixes the last bits, so 27 gives 3, not 3.0000000000000004.
  r = r - (Math.pow(r, n) - x) / (n * Math.pow(r, n - 1))
  const near = Math.round(r)
  if (Math.abs(near - r) < 1e-9 * Math.max(1, Math.abs(r)) && Math.pow(near, n) === x) return near
  return r
}

export interface Radical {
  /** Sign of the result: -1 for an odd root of a negative number. */
  sign: 1 | -1
  /** The factor taken out of the root. */
  outside: number
  /** What stays under the root (1 when the root is exact). */
  inside: number
}

/**
 * Simplified radical form of ⁿ√x for a whole number x (|x| ≤ 10¹⁵):
 * √72 = 6√2. Null when x is not a whole number or the root is not real.
 */
export function simplifyRadical(x: number, n: number): Radical | null {
  if (!Number.isInteger(x) || !Number.isInteger(n) || n < 2 || Math.abs(x) > 1e15) return null
  if (x < 0 && n % 2 === 0) return null
  const sign: 1 | -1 = x < 0 ? -1 : 1
  const a = Math.abs(x)
  if (a === 0) return { sign: 1, outside: 0, inside: 1 }
  if (a === 1) return { sign, outside: 1, inside: 1 }
  let outside = 1
  let inside = 1
  for (const { p, e } of factorize(BigInt(a))) {
    const pn = Number(p)
    outside *= pn ** Math.floor(e / n)
    inside *= pn ** (e % n)
  }
  return { sign, outside, inside }
}

const INDEX = ['', '', '', '∛', '∜']
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/** The root sign for index n: √, ∛, ∜, ⁵√ … */
export function rootSign(n: number): string {
  if (n === 2) return '√'
  return INDEX[n] ?? `${String(n).replace(/\d/g, (c) => SUP[Number(c)] ?? c)}√`
}

/** "6√2", "3", "−2∛3", "√2" */
export function radicalText(r: Radical, n: number): string {
  const s = r.sign < 0 ? '−' : ''
  if (r.inside === 1) return `${s}${r.outside}`
  return `${s}${r.outside === 1 ? '' : r.outside}${rootSign(n)}${r.inside}`
}

/** Newton's method for y = ⁿ√x (x > 0): y ← ((n − 1)y + x ÷ yⁿ⁻¹) ÷ n. */
export function newton(x: number, n: number, maxSteps = 40): number[] {
  const a = Math.abs(x)
  if (a === 0) return [0]
  let y = Math.max(1, a)
  const out = [y]
  for (let i = 0; i < maxSteps; i++) {
    const next = ((n - 1) * y + a / Math.pow(y, n - 1)) / n
    out.push(next)
    if (Math.abs(next - y) <= 1e-12 * Math.max(1, next)) break
    y = next
  }
  return x < 0 ? out.map((v) => -v) : out
}
