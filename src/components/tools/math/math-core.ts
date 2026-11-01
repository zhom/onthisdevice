/**
 * Private numeric helpers shared by the Math & Statistics islands.
 * Pure functions only — no DOM, no React, safe to unit-reason about.
 */

/* ────────────────────────────── formatting ────────────────────────────── */

/** Compact, human-readable number: trims trailing zeros, keeps it honest. */
export function fmtNum(n: number, dp = 6): string {
  if (Number.isNaN(n)) return 'undefined'
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '−∞'
  if (n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e15 || abs < 1e-9) return n.toExponential(Math.min(dp, 12))
  const rounded = Number(n.toFixed(dp))
  if (Object.is(rounded, -0)) return '0'
  return String(rounded)
}

/** Same as fmtNum but with locale thousands separators — for headline stats. */
export function fmtGrouped(n: number, dp = 6): string {
  if (!Number.isFinite(n)) return fmtNum(n, dp)
  const abs = Math.abs(n)
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return fmtNum(n, dp)
  return Number(n.toFixed(dp)).toLocaleString('en-US', { maximumFractionDigits: dp })
}

/** Signed number with a real minus sign, used inside worked steps. */
export function fmtSigned(n: number, dp = 6): string {
  const s = fmtNum(n, dp)
  return n >= 0 ? `+${s}` : s.replace(/^-/, '−')
}

/** Turns "-3" into "−3" for display without breaking copy/paste too badly. */
export function minus(s: string): string {
  return s.replace(/-/g, '−')
}

/* ─────────────────────────────── parsing ──────────────────────────────── */

export interface ParsedList {
  values: number[]
  invalid: string[]
}

/**
 * Split a blob of pasted text on commas, whitespace, semicolons, tabs and
 * newlines and parse every token as a number. Ignores thousands separators
 * written as spaces, keeps track of tokens it could not read.
 */
export function parseNumberList(text: string): ParsedList {
  const values: number[] = []
  const invalid: string[] = []
  const tokens = text
    .replace(/[−–—]/g, '-')
    .split(/[\s,;|]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  for (const token of tokens) {
    const cleaned = token.replace(/[_'`]/g, '')
    const n = Number(cleaned)
    if (cleaned !== '' && Number.isFinite(n)) values.push(n)
    else invalid.push(token)
  }
  return { values, invalid }
}

/** Parse a single numeric field, allowing a leading unicode minus. */
export function parseNum(raw: string): number | null {
  const cleaned = raw.replace(/[−–—]/g, '-').replace(/[,\s_]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/* ──────────────────────────── integer theory ──────────────────────────── */

export function gcdNum(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a))
  let y = Math.abs(Math.trunc(b))
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

export function gcdBig(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

export function lcmBig(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n
  const g = gcdBig(a, b)
  const r = (a / g) * b
  return r < 0n ? -r : r
}

/** Deterministic Miller–Rabin, exact for every value below 3.3 × 10^24. */
export function isPrimeBig(n: bigint): boolean {
  if (n < 2n) return false
  const smallPrimes = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]
  for (const p of smallPrimes) {
    if (n === p) return true
    if (n % p === 0n) return false
  }
  let d = n - 1n
  let r = 0n
  while (d % 2n === 0n) {
    d /= 2n
    r += 1n
  }
  const modPow = (base: bigint, exp: bigint, mod: bigint): bigint => {
    let result = 1n
    let b = base % mod
    let e = exp
    while (e > 0n) {
      if (e & 1n) result = (result * b) % mod
      b = (b * b) % mod
      e >>= 1n
    }
    return result
  }
  witness: for (const a of smallPrimes) {
    let x = modPow(a, d, n)
    if (x === 1n || x === n - 1n) continue
    for (let i = 1n; i < r; i++) {
      x = (x * x) % n
      if (x === n - 1n) continue witness
    }
    return false
  }
  return true
}

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n)) return false
  return isPrimeBig(BigInt(n))
}

export interface PrimePower {
  p: number
  e: number
}

/**
 * Trial-division factorisation with a 6k±1 wheel. Fast enough for anything a
 * person types by hand; callers should cap input around 10^15.
 */
export function primeFactorize(input: number): PrimePower[] {
  let n = Math.abs(Math.trunc(input))
  const out: PrimePower[] = []
  if (n < 2) return out
  const push = (p: number) => {
    let e = 0
    while (n % p === 0) {
      n /= p
      e++
    }
    if (e) out.push({ p, e })
  }
  push(2)
  push(3)
  for (let i = 5; i * i <= n; i += 6) {
    push(i)
    push(i + 2)
  }
  if (n > 1) out.push({ p: n, e: 1 })
  return out
}

export function factorizationString(f: PrimePower[]): string {
  if (!f.length) return '–'
  return f.map((x) => (x.e === 1 ? String(x.p) : `${x.p}^${x.e}`)).join(' × ')
}

/* ───────────────────────────── fractions ──────────────────────────────── */

export interface Frac {
  n: bigint
  d: bigint
}

/** Build a normalised fraction: denominator positive, terms fully reduced. */
export function frac(n: bigint, d: bigint): Frac {
  if (d === 0n) throw new Error('Denominator cannot be zero.')
  let num = n
  let den = d
  if (den < 0n) {
    num = -num
    den = -den
  }
  const g = gcdBig(num, den) || 1n
  return { n: num / g, d: den / g }
}

export const fAdd = (a: Frac, b: Frac): Frac => frac(a.n * b.d + b.n * a.d, a.d * b.d)
export const fSub = (a: Frac, b: Frac): Frac => frac(a.n * b.d - b.n * a.d, a.d * b.d)
export const fMul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d)
export const fDiv = (a: Frac, b: Frac): Frac => {
  if (b.n === 0n) throw new Error('Cannot divide by a fraction equal to zero.')
  return frac(a.n * b.d, a.d * b.n)
}

export function fToNumber(f: Frac): number {
  const direct = Number(f.n) / Number(f.d)
  if (Number.isFinite(direct)) return direct
  // Fall back to scaled bigint division for enormous terms.
  const scale = 10n ** 15n
  return Number((f.n * scale) / f.d) / 1e15
}

export function fToString(f: Frac): string {
  return f.d === 1n ? String(f.n) : `${f.n}/${f.d}`
}

export interface Mixed {
  negative: boolean
  whole: bigint
  n: bigint
  d: bigint
}

export function toMixed(f: Frac): Mixed {
  const negative = f.n < 0n
  const abs = negative ? -f.n : f.n
  return { negative, whole: abs / f.d, n: abs % f.d, d: f.d }
}

export function mixedToString(f: Frac): string {
  const m = toMixed(f)
  const sign = m.negative ? '−' : ''
  if (m.n === 0n) return `${sign}${m.whole}`
  if (m.whole === 0n) return `${sign}${m.n}/${m.d}`
  return `${sign}${m.whole} ${m.n}/${m.d}`
}

/**
 * Parse "3", "-7/8", "2 3/4", "1.25" or "-2 1/2" into an exact fraction.
 * Returns null on empty input, throws with a human message on bad syntax.
 */
export function parseFraction(raw: string): Frac | null {
  const text = raw.replace(/[−–—]/g, '-').replace(/⁄/g, '/').trim()
  if (!text) return null

  const mixed = /^([+-]?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(text)
  if (mixed) {
    const [, sign, whole, n, d] = mixed
    if (BigInt(d) === 0n) throw new Error('A fraction cannot have 0 as its denominator.')
    const value = BigInt(whole) * BigInt(d) + BigInt(n)
    return frac(sign === '-' ? -value : value, BigInt(d))
  }

  const simple = /^([+-]?\d+)\s*\/\s*([+-]?\d+)$/.exec(text)
  if (simple) {
    if (BigInt(simple[2]) === 0n) throw new Error('A fraction cannot have 0 as its denominator.')
    return frac(BigInt(simple[1]), BigInt(simple[2]))
  }

  const decimal = /^([+-]?)(\d*)(?:\.(\d+))?$/.exec(text)
  if (decimal && (decimal[2] || decimal[3])) {
    const sign = decimal[1] === '-' ? -1n : 1n
    const intPart = decimal[2] || '0'
    const fracPart = decimal[3] || ''
    const den = 10n ** BigInt(fracPart.length)
    const num = BigInt(intPart) * den + BigInt(fracPart || '0')
    return frac(sign * num, den)
  }

  throw new Error(`"${raw.trim()}" isn't a number I can read. Try 3, 7/8, 2 3/4 or 1.25.`)
}

/* ──────────────────────── decimal ⇄ fraction ──────────────────────────── */

export interface RepeatingDecimal {
  sign: -1 | 1
  intDigits: string
  fixedDigits: string
  repeatDigits: string
}

/**
 * Accepts 0.75, 0.(3), 0.1(6), 0.3̅ (combining overline) and 1.23... forms and
 * returns the structured pieces, or throws a human-readable error.
 */
export function parseDecimalInput(raw: string): RepeatingDecimal {
  let text = raw
    .replace(/[−–—]/g, '-')
    .replace(/[\s,_]/g, '')
    .replace(/…/g, '...')
    .trim()
  if (!text) throw new Error('Enter a decimal number first.')

  let sign: -1 | 1 = 1
  if (text.startsWith('-')) {
    sign = -1
    text = text.slice(1)
  } else if (text.startsWith('+')) {
    text = text.slice(1)
  }

  // Combining overline (U+0305) marks the repeating block: 0.1̅6̅
  if (text.includes('̅')) {
    const chars = [...text]
    let rebuilt = ''
    let repeat = ''
    for (let i = 0; i < chars.length; i++) {
      if (chars[i + 1] === '̅') {
        repeat += chars[i]
        i++
      } else if (chars[i] !== '̅') {
        rebuilt += chars[i]
      }
    }
    text = repeat ? `${rebuilt}(${repeat})` : rebuilt
  }

  // Trailing ellipsis: treat the final digit run as repeating only if bracketed
  // is absent; "0.333..." → repeating 3.
  const ellipsis = /^(\d*)\.(\d*?)(\d+?)\3*\.\.\.$/.exec(text)
  if (ellipsis && !text.includes('(')) {
    return { sign, intDigits: ellipsis[1] || '0', fixedDigits: ellipsis[2], repeatDigits: ellipsis[3] }
  }
  text = text.replace(/\.\.\.$/, '')

  const bracket = /^(\d*)(?:\.(\d*)(?:\(([0-9]+)\))?)?$/.exec(text)
  if (!bracket) {
    throw new Error(`"${raw.trim()}" isn't a decimal I can read. Try 0.75, 0.(3) or 1.8(3).`)
  }
  const intDigits = bracket[1] || '0'
  const fixedDigits = bracket[2] ?? ''
  const repeatDigits = bracket[3] ?? ''
  if (!intDigits && !fixedDigits && !repeatDigits) {
    throw new Error('Enter a decimal number first.')
  }
  if (repeatDigits && /^0+$/.test(repeatDigits) === false && repeatDigits.length > 30) {
    throw new Error('That repeating block is too long. Keep it under 30 digits.')
  }
  return { sign, intDigits, fixedDigits, repeatDigits }
}

/** Exact fraction for a (possibly repeating) decimal. */
export function decimalToFraction(d: RepeatingDecimal): Frac {
  const { intDigits, fixedDigits, repeatDigits } = d
  const nonRepeat = `${intDigits}${fixedDigits}`
  if (!repeatDigits) {
    const den = 10n ** BigInt(fixedDigits.length)
    return frac(BigInt(d.sign) * BigInt(nonRepeat || '0'), den)
  }
  const all = BigInt(`${nonRepeat}${repeatDigits}` || '0')
  const head = BigInt(nonRepeat || '0')
  const den = (10n ** BigInt(repeatDigits.length) - 1n) * 10n ** BigInt(fixedDigits.length)
  return frac(BigInt(d.sign) * (all - head), den)
}

export interface LongDivision {
  intPart: string
  fixed: string
  repeat: string
}

/** Decimal expansion of a fraction, detecting the repeating cycle exactly. */
export function fractionToDecimal(f: Frac, maxDigits = 400): LongDivision {
  const neg = f.n < 0n
  const num = neg ? -f.n : f.n
  const intPart = (neg ? '-' : '') + String(num / f.d)
  let rem = num % f.d
  const seen = new Map<string, number>()
  const digits: string[] = []
  while (rem !== 0n && digits.length < maxDigits) {
    const key = rem.toString()
    const at = seen.get(key)
    if (at !== undefined) {
      return { intPart, fixed: digits.slice(0, at).join(''), repeat: digits.slice(at).join('') }
    }
    seen.set(key, digits.length)
    rem *= 10n
    digits.push(String(rem / f.d))
    rem %= f.d
  }
  return { intPart, fixed: digits.join(''), repeat: '' }
}

export function longDivisionString(d: LongDivision): string {
  const head = d.fixed || d.repeat ? `${d.intPart}.${d.fixed}` : d.intPart
  return d.repeat ? `${head}(${d.repeat})` : head
}

/* ───────────────────────────── statistics ─────────────────────────────── */

export interface Stats {
  count: number
  sum: number
  mean: number
  median: number
  modes: number[]
  min: number
  max: number
  range: number
  q1: number
  q3: number
  iqr: number
  sorted: number[]
  geometricMean: number | null
  harmonicMean: number | null
}

function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN
  const pos = (sorted.length - 1) * p
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export function describe(values: number[]): Stats | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const count = values.length
  const sum = values.reduce((a, b) => a + b, 0)
  const mean = sum / count
  const median = quantile(sorted, 0.5)

  const freq = new Map<number, number>()
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1)
  let maxFreq = 0
  for (const c of freq.values()) if (c > maxFreq) maxFreq = c
  const modes = maxFreq > 1 ? [...freq.entries()].filter(([, c]) => c === maxFreq).map(([v]) => v).sort((a, b) => a - b) : []

  const allPositive = values.every((v) => v > 0)
  const geometricMean = allPositive ? Math.exp(values.reduce((a, b) => a + Math.log(b), 0) / count) : null
  const harmonicMean = values.every((v) => v !== 0)
    ? count / values.reduce((a, b) => a + 1 / b, 0)
    : null

  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)

  return {
    count,
    sum,
    mean,
    median,
    modes,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    range: sorted[sorted.length - 1] - sorted[0],
    q1,
    q3,
    iqr: q3 - q1,
    sorted,
    geometricMean,
    harmonicMean,
  }
}

export interface Dispersion {
  mean: number
  sumSquares: number
  sampleVariance: number
  populationVariance: number
  sampleSd: number
  populationSd: number
}

export function dispersion(values: number[]): Dispersion | null {
  const n = values.length
  if (!n) return null
  const mean = values.reduce((a, b) => a + b, 0) / n
  const sumSquares = values.reduce((a, b) => a + (b - mean) ** 2, 0)
  const populationVariance = sumSquares / n
  const sampleVariance = n > 1 ? sumSquares / (n - 1) : NaN
  return {
    mean,
    sumSquares,
    sampleVariance,
    populationVariance,
    sampleSd: Math.sqrt(sampleVariance),
    populationSd: Math.sqrt(populationVariance),
  }
}

/* ─────────────────────────────── misc ─────────────────────────────────── */

/** Round-trip safe rounding used everywhere results are compared to 0. */
export function nearlyZero(n: number, eps = 1e-12): boolean {
  return Math.abs(n) < eps
}

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

export function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI
}

/** Superscript rendering for exponents in plain text, e.g. 10^3 → 10³. */
const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '-': '⁻', '+': '⁺', '.': '·',
}

export function superscript(text: string): string {
  return [...text].map((c) => SUPERSCRIPTS[c] ?? c).join('')
}
