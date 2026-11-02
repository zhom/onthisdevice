/**
 * Long division of whole numbers, written out digit by digit, and the exact
 * decimal with its repeating part. Pure; the tests import it.
 */

export interface DivStep {
  /** Index of the dividend digit brought down (0 = first digit). */
  col: number
  /** The partial dividend: the remainder so far with the digit brought down. */
  partial: bigint
  /** Quotient digit for this column. */
  q: number
  /** q × divisor, subtracted from the partial dividend. */
  product: bigint
  /** What is left. */
  rem: bigint
}

export interface LongDivision {
  dividend: bigint
  divisor: bigint
  quotient: bigint
  remainder: bigint
  /** One step per dividend digit, from the first column where the divisor fits. */
  steps: DivStep[]
  /** Digits after the decimal point that do not repeat. */
  fixedDigits: string
  /** The repeating block, empty when the decimal ends. */
  repeat: string
  /** True when the digits were cut at the limit before the pattern closed. */
  cut: boolean
}

/**
 * `decimalSteps` adds written steps past the decimal point (bringing down
 * zeros) until the remainder is 0 or that many decimal digits are written.
 */
export function longDivide(dividend: bigint, divisor: bigint, decimalSteps = 0, maxDecimals = 120): LongDivision {
  const digits = dividend.toString()
  const steps: DivStep[] = []
  let rem = 0n
  let started = false
  for (let i = 0; i < digits.length; i++) {
    const partial = rem * 10n + BigInt(digits.charCodeAt(i) - 48)
    const q = partial / divisor
    const product = q * divisor
    rem = partial - product
    if (q > 0n || started || i === digits.length - 1) {
      started = true
      steps.push({ col: i, partial, q: Number(q), product, rem })
    }
  }
  for (let j = 0; j < decimalSteps && rem !== 0n; j++) {
    const partial = rem * 10n
    const q = partial / divisor
    const product = q * divisor
    rem = partial - product
    steps.push({ col: digits.length + j, partial, q: Number(q), product, rem })
  }
  const quotient = dividend / divisor
  const remainder = dividend % divisor
  // Decimal digits: remember where each remainder first appeared.
  const seen = new Map<bigint, number>()
  let r = remainder
  let out = ''
  let repeatAt = -1
  while (r !== 0n && out.length < maxDecimals) {
    const at = seen.get(r)
    if (at !== undefined) {
      repeatAt = at
      break
    }
    seen.set(r, out.length)
    r *= 10n
    out += (r / divisor).toString()
    r %= divisor
  }
  const cut = r !== 0n && repeatAt < 0
  return {
    dividend,
    divisor,
    quotient,
    remainder,
    steps,
    fixedDigits: repeatAt < 0 ? out : out.slice(0, repeatAt),
    repeat: repeatAt < 0 ? '' : out.slice(repeatAt),
    cut,
  }
}

/** "0.(142857)" style text: the repeating block in brackets. */
export function decimalText(d: LongDivision): string {
  const whole = d.quotient.toString()
  if (!d.fixedDigits && !d.repeat) return whole
  return `${whole}.${d.fixedDigits}${d.repeat ? `(${d.repeat})` : ''}${d.cut ? '…' : ''}`
}
