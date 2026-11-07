/**
 * Exact unit arithmetic for the unit pair pages.
 *
 * A unit is a factor to its quantity's base unit, written as a small expression of exact
 * decimals ("0.0254", "5/18", "pi/180", "4.4482216152605/0.00064516"). Three kinds exist:
 *   linear   base = value × factor
 *   affine   base = (value + offset) × factor          (temperature scales)
 *   inverse  base = factor ÷ value                      (litres per 100 km)
 * Everything runs on decimal.js at 40 significant digits, so no binary rounding shows up.
 */
import Decimal from 'decimal.js'

export const D = Decimal.clone({ precision: 40, toExpNeg: -40, toExpPos: 40, rounding: Decimal.ROUND_HALF_EVEN })
export type Dec = InstanceType<typeof D>

/** The part of a unit the browser needs. Pages pass it to the island as a prop. */
export interface UnitLite {
  id: string
  name: string
  plural: string
  symbol: string
  factor: string
  offset?: string
  inverse?: boolean
  /** Factor in the binary (1024) convention, for KB, MB, GB and TB. */
  binaryFactor?: string
}

const PI = D.acos(-1)

/** Evaluates a factor expression: decimals and `pi` joined by `*` and `/`, left to right. */
export function evalFactor(expr: string): Dec {
  const tokens = expr.replace(/\s+/g, '').split(/([*/])/)
  let acc: Dec | null = null
  let op = '*'
  for (const token of tokens) {
    if (token === '*' || token === '/') {
      op = token
      continue
    }
    const value = token === 'pi' ? PI : new D(token)
    if (!value.isFinite()) throw new Error(`Bad factor "${expr}"`)
    acc = acc === null ? value : op === '*' ? acc.times(value) : acc.div(value)
  }
  if (acc === null) throw new Error(`Empty factor "${expr}"`)
  return acc
}

const cache = new Map<string, Dec>()
function factorOf(unit: UnitLite, binary: boolean): Dec {
  const expr = binary && unit.binaryFactor ? unit.binaryFactor : unit.factor
  let value = cache.get(expr)
  if (!value) {
    value = evalFactor(expr)
    cache.set(expr, value)
  }
  return value
}

export function toBase(value: Dec, unit: UnitLite, binary = false): Dec {
  const f = factorOf(unit, binary)
  if (unit.inverse) return f.div(value)
  if (unit.offset) return value.plus(unit.offset).times(f)
  return value.times(f)
}

export function fromBase(base: Dec, unit: UnitLite, binary = false): Dec {
  const f = factorOf(unit, binary)
  if (unit.inverse) return f.div(base)
  if (unit.offset) return base.div(f).minus(unit.offset)
  return base.div(f)
}

export function convert(value: Dec, from: UnitLite, to: UnitLite, binary = false): Dec {
  return fromBase(toBase(value, from, binary), to, binary)
}

/** A conversion is undefined at zero for an inverse unit (0 L/100 km is infinite mpg). */
export function isDefinedAt(value: Dec, from: UnitLite, to: UnitLite): boolean {
  if (value.isZero() && (from.inverse || to.inverse) && !(from.inverse && to.inverse)) return false
  return true
}

/* ------------------------------------------------------------------ *
 * Formula
 * ------------------------------------------------------------------ */

/**
 * How `to` follows from `from`:
 *   multiply   to = from × k
 *   divide     to = from ÷ k       (chosen when k is short and exact and 1/k is not)
 *   affine     to = from × a + b
 *   reciprocal to = k ÷ from
 */
export type Formula =
  | { kind: 'multiply'; k: Dec }
  | { kind: 'divide'; k: Dec }
  | { kind: 'affine'; a: Dec; b: Dec }
  | { kind: 'reciprocal'; k: Dec }

/** True when a decimal has a short exact expansion (no recurring digits at 40 digits). */
export function isShortExact(value: Dec): boolean {
  const s = value.toSignificantDigits(40).toFixed()
  const digits = s.replace(/^-?0*\.?0*/, '').replace('.', '').replace(/0+$/, '')
  return digits.length <= 14
}

export function formulaFor(from: UnitLite, to: UnitLite, binary = false): Formula {
  const one = new D(1)
  if (from.inverse !== to.inverse) {
    // base = f_from ÷ v or v × f_from; either way to = k ÷ v.
    const k = from.inverse ? factorOf(from, binary).div(factorOf(to, binary)) : factorOf(to, binary).div(factorOf(from, binary))
    return { kind: 'reciprocal', k }
  }
  if (from.offset || to.offset) {
    const a = convert(one, from, to, binary).minus(convert(new D(0), from, to, binary)).toSignificantDigits(30)
    const b = convert(new D(0), from, to, binary)
    return { kind: 'affine', a, b }
  }
  const k = from.inverse ? factorOf(to, binary).div(factorOf(from, binary)) : factorOf(from, binary).div(factorOf(to, binary))
  const inv = from.inverse ? factorOf(from, binary).div(factorOf(to, binary)) : factorOf(to, binary).div(factorOf(from, binary))
  if (!isShortExact(k) && isShortExact(inv)) return { kind: 'divide', k: inv }
  if (k.lt(1) && isShortExact(inv) && inv.toFixed().length < k.toFixed().length) return { kind: 'divide', k: inv }
  return { kind: 'multiply', k }
}

/* ------------------------------------------------------------------ *
 * Formatting and parsing
 * ------------------------------------------------------------------ */

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}

function group(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function pretty(fixed: string): string {
  const negative = fixed.startsWith('-')
  const bare = negative ? fixed.slice(1) : fixed
  const [i, f] = bare.split('.')
  const out = f ? `${group(i ?? '0')}.${f}` : group(i ?? '0')
  return negative ? `−${out}` : out
}

/** `auto` or a fixed number of decimals. */
export type Precision = 'auto' | number

/**
 * Display text. `auto` keeps 10 significant digits and drops trailing zeros; values below
 * 0.000001 or from 10^15 up use scientific notation.
 */
export function formatValue(value: Dec, precision: Precision = 'auto', sig = 10): string {
  if (!value.isFinite()) return '–'
  if (value.isZero()) return '0'
  const abs = value.abs()
  if (abs.lt('0.000001') || abs.gte('1e15')) {
    const [mant, exp] = value.toExponential(Math.max(0, (precision === 'auto' ? sig : Math.max(precision, 2)) - 1)).split('e')
    const m = (mant ?? '').includes('.') ? (mant ?? '').replace(/0+$/, '').replace(/\.$/, '') : (mant ?? '')
    const e = String(Number(exp))
    return `${m.replace('-', '−')} × 10${[...e].map((c) => SUPERSCRIPT[c] ?? c).join('')}`
  }
  if (precision === 'auto') {
    const rounded = value.toSignificantDigits(sig)
    let s = rounded.toFixed()
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
    return pretty(s)
  }
  return pretty(value.toFixed(precision))
}

/** Plain text a person can paste into a spreadsheet: no grouping, ASCII minus. */
export function plainValue(value: Dec, sig = 12): string {
  if (!value.isFinite()) return ''
  const s = value.toSignificantDigits(sig).toFixed()
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

const VULGAR: Record<string, string> = {
  '½': ' 1/2',
  '⅓': ' 1/3',
  '⅔': ' 2/3',
  '¼': ' 1/4',
  '¾': ' 3/4',
  '⅛': ' 1/8',
  '⅜': ' 3/8',
  '⅝': ' 5/8',
  '⅞': ' 7/8',
}

/** "1,234.5", "1.234,5", "0,5", "1 1/2", "½", "2.5e3" and "−4" all parse. */
export function parseNumber(raw: string): Dec | null {
  let s = raw.trim().toLowerCase()
  if (!s) return null
  s = s.replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, (c) => VULGAR[c] ?? c)
  s = s.replace(/[−–—]/g, '-').replace(/[×x]\s*10\^?/g, 'e').replace(/\s+/g, ' ').trim()
  s = s.replace(/^\+/, '')
  // Thousands separators and decimal commas.
  if (/^-?[\d.,]+(e-?\d+)?$/.test(s) && s.includes(',')) {
    const comma = s.lastIndexOf(',')
    const dot = s.lastIndexOf('.')
    if (dot >= 0) s = comma > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
    else if (/^-?[1-9]\d{0,2}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '')
    else if (s.split(',').length === 2) s = s.replace(',', '.')
    else return null
  }
  s = s.replace(/(\d) (?=\d{3}\b)/g, '$1')
  const mixed = /^(-?\d+) (\d+)\/(\d+)$/.exec(s)
  if (mixed) {
    if (Number(mixed[3]) === 0) return null
    const whole = new D(mixed[1] ?? '0')
    const frac = new D(mixed[2] ?? '0').div(mixed[3] ?? '1')
    return whole.isNegative() ? whole.minus(frac) : whole.plus(frac)
  }
  const frac = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(s)
  if (frac) {
    if (Number(frac[2]) === 0) return null
    return new D(frac[1] ?? '0').div(frac[2] ?? '1')
  }
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/.test(s)) return null
  try {
    const d = new D(s)
    return d.isFinite() ? d : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ *
 * Mixed readouts: 5 ft 8 in, 3 lb 4 oz, 1 h 30 min, 12° 30′ 15″
 * ------------------------------------------------------------------ */

/** Degree, minute and second marks sit on the number; other symbols take a space. */
const gap = (symbol = ''): string => (/^[°′″]/.test(symbol) ? '' : ' ')

/**
 * Splits `value` (in the unit of `symbols[0]`) into whole parts. `steps[i]` is how many of
 * part i+1 make one part i. The smallest part is rounded first, so 5.9999 ft gives 6 ft and
 * never 5 ft 12 in.
 */
export function splitParts(value: Dec, steps: number[], symbols: string[], lastDecimals = 1): string {
  const n = symbols.length
  const sizes: Dec[] = Array.from({ length: n }, () => new D(1))
  for (let i = n - 2; i >= 0; i--) sizes[i] = (sizes[i + 1] ?? new D(1)).times(steps[i] ?? 1)
  let rest = value.abs().times(sizes[0] ?? 1).toDecimalPlaces(lastDecimals)
  const parts: { zero: boolean; text: string }[] = []
  for (let i = 0; i < n; i++) {
    const size = sizes[i] ?? new D(1)
    const whole = i === n - 1 ? rest : rest.div(size).floor()
    const text = i === n - 1 ? formatValue(whole, 'auto', 8) : group(whole.toFixed(0))
    if (!whole.isZero() || parts.length > 0) parts.push({ zero: whole.isZero(), text: `${text}${gap(symbols[i])}${symbols[i]}` })
    if (i < n - 1) rest = rest.minus(whole.times(size))
  }
  while (parts.length > 1 && parts[parts.length - 1]?.zero) parts.pop()
  if (parts.length === 0) parts.push({ zero: true, text: `0${gap(symbols[n - 1])}${symbols[n - 1] ?? ''}` })
  return (value.isNegative() ? '−' : '') + parts.map((p) => p.text).join(' ')
}

/** "5 cm", "45°", "20 °C": the degree sign of an angle sits on the number. */
export function withUnit(text: string, unit: UnitLite): string {
  return unit.symbol === '°' ? `${text}°` : `${text} ${unit.symbol}`
}

/** The symbol in a formula line, where a bare ° would be unreadable. */
export function formulaSymbol(unit: UnitLite): string {
  return unit.symbol === '°' ? 'deg' : unit.symbol
}

/** True when the unit pair needs more than a single factor. */
export function isSpecial(from: UnitLite, to: UnitLite): boolean {
  return Boolean(from.offset || to.offset || from.inverse || to.inverse)
}
