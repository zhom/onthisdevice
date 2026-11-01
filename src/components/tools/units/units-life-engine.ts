/**
 * units-life batch — conversion engine.
 *
 * Exact-ratio unit conversion built on decimal.js so nothing depends on binary
 * floating point. Every factor below is the *defining* international value
 * (the inch has been exactly 25.4 mm since the 1959 international yard and
 * pound agreement), so results are exact to the requested precision rather
 * than "close enough".
 *
 * Owned by the `units-life` round-2 batch. Do not import round-1 helpers here;
 * this file is deliberately self-contained.
 */

import Decimal from 'decimal.js'

/** A local constructor so we never mutate the global decimal.js configuration. */
export const D = Decimal.clone({ precision: 40, toExpNeg: -30, toExpPos: 30 })
export type Dec = InstanceType<typeof D>

export type Quantity = 'length' | 'mass' | 'temperature'

export type UnitId =
  | 'mm'
  | 'cm'
  | 'm'
  | 'km'
  | 'in'
  | 'ft'
  | 'yd'
  | 'mi'
  | 'g'
  | 'kg'
  | 'oz'
  | 'lb'
  | 'st'
  | 'c'
  | 'f'
  | 'k'

export interface UnitDef {
  id: UnitId
  /** Singular noun, lower case: "centimetre". */
  name: string
  /** Plural noun: "centimetres". */
  plural: string
  /** Short symbol used in results: "cm". */
  symbol: string
  quantity: Quantity
  /** Exact factor to the quantity's base unit (metre / kilogram). */
  factor?: string
}

export const UNITS: Record<UnitId, UnitDef> = {
  mm: { id: 'mm', name: 'millimetre', plural: 'millimetres', symbol: 'mm', quantity: 'length', factor: '0.001' },
  cm: { id: 'cm', name: 'centimetre', plural: 'centimetres', symbol: 'cm', quantity: 'length', factor: '0.01' },
  m: { id: 'm', name: 'metre', plural: 'metres', symbol: 'm', quantity: 'length', factor: '1' },
  km: { id: 'km', name: 'kilometre', plural: 'kilometres', symbol: 'km', quantity: 'length', factor: '1000' },
  in: { id: 'in', name: 'inch', plural: 'inches', symbol: 'in', quantity: 'length', factor: '0.0254' },
  ft: { id: 'ft', name: 'foot', plural: 'feet', symbol: 'ft', quantity: 'length', factor: '0.3048' },
  yd: { id: 'yd', name: 'yard', plural: 'yards', symbol: 'yd', quantity: 'length', factor: '0.9144' },
  mi: { id: 'mi', name: 'mile', plural: 'miles', symbol: 'mi', quantity: 'length', factor: '1609.344' },
  g: { id: 'g', name: 'gram', plural: 'grams', symbol: 'g', quantity: 'mass', factor: '0.001' },
  kg: { id: 'kg', name: 'kilogram', plural: 'kilograms', symbol: 'kg', quantity: 'mass', factor: '1' },
  oz: { id: 'oz', name: 'ounce', plural: 'ounces', symbol: 'oz', quantity: 'mass', factor: '0.028349523125' },
  lb: { id: 'lb', name: 'pound', plural: 'pounds', symbol: 'lb', quantity: 'mass', factor: '0.45359237' },
  st: { id: 'st', name: 'stone', plural: 'stone', symbol: 'st', quantity: 'mass', factor: '6.35029318' },
  c: { id: 'c', name: 'degree Celsius', plural: 'degrees Celsius', symbol: '°C', quantity: 'temperature' },
  f: { id: 'f', name: 'degree Fahrenheit', plural: 'degrees Fahrenheit', symbol: '°F', quantity: 'temperature' },
  k: { id: 'k', name: 'kelvin', plural: 'kelvin', symbol: 'K', quantity: 'temperature' },
}

/* ------------------------------------------------------------------ *
 * Conversion
 * ------------------------------------------------------------------ */

function toKelvin(value: Dec, from: UnitId): Dec {
  switch (from) {
    case 'c':
      return value.plus('273.15')
    case 'f':
      return value.plus('459.67').times(5).div(9)
    default:
      return value
  }
}

function fromKelvin(kelvin: Dec, to: UnitId): Dec {
  switch (to) {
    case 'c':
      return kelvin.minus('273.15')
    case 'f':
      return kelvin.times(9).div(5).minus('459.67')
    default:
      return kelvin
  }
}

/** Convert a Decimal between two units of the same quantity. */
export function convert(value: Dec, from: UnitId, to: UnitId): Dec {
  const a = UNITS[from]
  const b = UNITS[to]
  if (a.quantity !== b.quantity) {
    throw new Error(`Cannot convert ${a.symbol} to ${b.symbol}: different quantities.`)
  }
  if (a.quantity === 'temperature') return fromKelvin(toKelvin(value, from), to)
  return value.times(a.factor as string).div(b.factor as string)
}

/** The exact ratio one `from` unit is worth in `to` units (linear units only). */
export function ratio(from: UnitId, to: UnitId): Dec {
  return new D(UNITS[from].factor as string).div(UNITS[to].factor as string)
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export type Precision = number | 'auto'

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Split a fixed-point string into a grouped integer part and a fraction part. */
function prettyFixed(fixed: string): string {
  const negative = fixed.startsWith('-')
  const bare = negative ? fixed.slice(1) : fixed
  const [intPart, fracPart] = bare.split('.')
  const out = fracPart ? `${groupThousands(intPart)}.${fracPart}` : groupThousands(intPart)
  return negative ? `−${out}` : out
}

/**
 * Format a value for display.
 *
 * `auto` keeps up to 8 significant digits, drops trailing zeros, and never
 * shows exponent notation for anything a human would type into a converter.
 */
export function formatValue(value: Dec, precision: Precision): string {
  if (!value.isFinite()) return '–'
  if (precision === 'auto') {
    const abs = value.abs()
    let rounded: Dec
    if (abs.gte(1000)) rounded = value.toDecimalPlaces(2)
    else if (abs.gte(1)) rounded = value.toDecimalPlaces(6)
    else if (abs.isZero()) rounded = value
    else rounded = new D(value.toSignificantDigits(6))
    // toFixed(): decimal.js never uses exponent notation here.
    let s = rounded.toFixed()
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
    return prettyFixed(s)
  }
  return prettyFixed(value.toFixed(precision))
}

/** Format with a unit symbol appended. */
export function formatWithUnit(value: Dec, unit: UnitId, precision: Precision): string {
  return `${formatValue(value, precision)} ${UNITS[unit].symbol}`
}

/* ---- fractional inches ---- */

export interface FractionParts {
  negative: boolean
  whole: number
  numerator: number
  denominator: number
  /** True when the snapped fraction is not exactly the input value. */
  approximate: boolean
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

/** Snap a decimal value to the nearest 1/denominator and reduce the fraction. */
export function toFractionParts(value: Dec, denominator: number): FractionParts {
  const negative = value.isNegative()
  const abs = value.abs()
  const totalSixteenths = abs.times(denominator).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
  const exact = totalSixteenths.div(denominator).equals(abs)
  const total = totalSixteenths.toNumber()
  const whole = Math.floor(total / denominator)
  let numerator = total - whole * denominator
  let den = denominator
  if (numerator > 0) {
    const g = gcd(numerator, den)
    numerator /= g
    den /= g
  }
  return { negative, whole, numerator, denominator: den, approximate: !exact }
}

/** "5 3/8" — the way a tape measure reads. */
export function formatFraction(value: Dec, denominator: number): string {
  const p = toFractionParts(value, denominator)
  const sign = p.negative ? '−' : ''
  if (p.numerator === 0) return `${sign}${groupThousands(String(p.whole))}`
  if (p.whole === 0) return `${sign}${p.numerator}/${p.denominator}`
  return `${sign}${groupThousands(String(p.whole))} ${p.numerator}/${p.denominator}`
}

/* ---- composite (mixed-unit) output ---- */

export interface CompositeParts {
  negative: boolean
  major: number
  minor: string
}

/**
 * Split a decimal quantity of `major` units into whole majors plus a remainder
 * expressed in `minor` units — 5.74 ft becomes 5 ft 8.9 in.
 */
export function toComposite(
  value: Dec,
  major: UnitId,
  minor: UnitId,
  minorDecimals: number,
): CompositeParts {
  const negative = value.isNegative()
  const abs = value.abs()
  const perMajor = ratio(major, minor) // minors in one major
  let whole = abs.floor()
  let rest = convert(abs.minus(whole), major, minor).toDecimalPlaces(minorDecimals)
  // Rounding the remainder up to a full major unit must roll over, or we print
  // things like "5 ft 12.0 in".
  if (rest.gte(perMajor)) {
    whole = whole.plus(1)
    rest = new D(0)
  }
  return { negative, major: whole.toNumber(), minor: rest.toFixed(minorDecimals) }
}

export function formatComposite(
  value: Dec,
  major: UnitId,
  minor: UnitId,
  minorDecimals: number,
): string {
  const p = toComposite(value, major, minor, minorDecimals)
  const sign = p.negative ? '−' : ''
  return `${sign}${groupThousands(String(p.major))} ${UNITS[major].symbol} ${p.minor} ${UNITS[minor].symbol}`
}

/* ------------------------------------------------------------------ *
 * Parsing
 * ------------------------------------------------------------------ */

const VULGAR: Record<string, string> = {
  '½': ' 1/2',
  '⅓': ' 1/3',
  '⅔': ' 2/3',
  '¼': ' 1/4',
  '¾': ' 3/4',
  '⅕': ' 1/5',
  '⅖': ' 2/5',
  '⅗': ' 3/5',
  '⅘': ' 4/5',
  '⅙': ' 1/6',
  '⅚': ' 5/6',
  '⅛': ' 1/8',
  '⅜': ' 3/8',
  '⅝': ' 5/8',
  '⅞': ' 7/8',
}

/** Normalise typographic input into something the parsers can read. */
export function normaliseInput(raw: string): string {
  let s = raw.trim().toLowerCase()
  s = s.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (ch) => VULGAR[ch] ?? ch)
  s = s.replace(/[′’]/g, "'").replace(/[″”]/g, '"')
  s = s.replace(/[−–—]/g, '-')
  s = s.replace(/\d[\d.,]*/g, readSeparators)
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/**
 * Thousands separators versus a decimal comma: "1,234" and "1,234.5" are
 * thousands, "1,5" and "0,125" use a decimal comma, "1.234,5" is European.
 */
function readSeparators(num: string): string {
  const comma = num.lastIndexOf(',')
  if (comma < 0) return num
  const dot = num.lastIndexOf('.')
  if (dot >= 0) {
    return comma > dot ? num.replace(/\./g, '').replace(/,(?=[^,]*$)/, '.').replace(/,/g, '') : num.replace(/,/g, '')
  }
  if (/^[1-9]\d{0,2}(,\d{3})+$/.test(num)) return num.replace(/,/g, '')
  const parts = num.split(',')
  if (parts.length === 2) return parts[1] ? `${parts[0]}.${parts[1]}` : (parts[0] ?? '')
  return num.replace(/,/g, '')
}

function parseSimple(token: string): Dec | null {
  const t = token.trim()
  if (!t) return null
  const mixed = /^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(t)
  if (mixed) {
    const den = Number(mixed[3])
    if (den === 0) return null
    const whole = new D(mixed[1])
    const frac = new D(mixed[2]).div(den)
    return whole.isNegative() ? whole.minus(frac) : whole.plus(frac)
  }
  const frac = /^(-?\d+)\s*\/\s*(\d+)$/.exec(t)
  if (frac) {
    const den = Number(frac[2])
    if (den === 0) return null
    return new D(frac[1]).div(den)
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null
  try {
    const d = new D(t)
    return d.isFinite() ? d : null
  } catch {
    return null
  }
}

const FEET_INCHES =
  /^(-?\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?(?:\s+\d+\s*\/\s*\d+)?|\d+\s*\/\s*\d+)\s*(?:"|in|ins|inch|inches)?)?$/

const STONE_POUNDS =
  /^(-?\d+(?:\.\d+)?)\s*(?:st|stone|stones)\s*(?:(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound|pounds)?)?$/

export interface ParseResult {
  value: Dec
  /** Set when the user typed a mixed form such as 5'6" or 11 st 4 lb. */
  interpretedAs?: string
}

/**
 * Parse a human-typed quantity into the given unit.
 *
 * Accepts plain decimals, mixed numbers ("5 1/2"), vulgar fractions ("5½"),
 * feet-and-inches ("5'6\"", "5 ft 6 in") for length units and
 * stone-and-pounds ("11 st 4 lb") for mass units.
 */
export function parseQuantity(raw: string, unit: UnitId): ParseResult | null {
  const s = normaliseInput(raw)
  if (!s) return null
  const def = UNITS[unit]

  if (def.quantity === 'length') {
    const fi = FEET_INCHES.exec(s)
    if (fi) {
      const feet = parseSimple(fi[1])
      const inches = fi[2] ? parseSimple(fi[2]) : new D(0)
      if (feet && inches) {
        const totalInches = feet.times(12).plus(feet.isNegative() ? inches.negated() : inches)
        return {
          value: convert(totalInches, 'in', unit),
          interpretedAs: `${fi[1]} ft ${inches.toFixed()} in`,
        }
      }
    }
  }

  if (def.quantity === 'mass') {
    const sp = STONE_POUNDS.exec(s)
    if (sp) {
      const stone = parseSimple(sp[1])
      const pounds = sp[2] ? parseSimple(sp[2]) : new D(0)
      if (stone && pounds) {
        const totalPounds = stone.times(14).plus(stone.isNegative() ? pounds.negated() : pounds)
        return {
          value: convert(totalPounds, 'lb', unit),
          interpretedAs: `${sp[1]} st ${pounds.toFixed()} lb`,
        }
      }
    }
  }

  // A trailing unit word ("12 cm", "5 kg"): read the number in that unit.
  const tail =
    /^(.*?)\s*(mm|millimet(?:er|re)s?|cm|centimet(?:er|re)s?|met(?:er|re)s?|m|kilomet(?:er|re)s?|km|in|ins|inch(?:es)?|"|ft|feet|foot|'|yd|yards?|mi|miles?|g|grams?|kg|kilos?|kilograms?|oz|ounces?|lb|lbs|pounds?|st|stone|deg|degrees?|°?[cfk])$/.exec(
      s,
    )
  if (tail) {
    const num = parseSimple(tail[1] ?? '')
    if (!num) return null
    const typed = unitFromWord(tail[2] ?? '')
    if (!typed || typed === unit) return { value: num }
    if (UNITS[typed].quantity !== def.quantity) return null
    if (def.quantity === 'temperature' && belowAbsoluteZero(num, typed)) return null
    return { value: convert(num, typed, unit), interpretedAs: `${num.toFixed()} ${UNITS[typed].symbol}` }
  }
  const simple = parseSimple(s)
  if (simple) return { value: simple }
  return null
}

const UNIT_WORDS: [RegExp, UnitId][] = [
  [/^(mm|millimet(er|re)s?)$/, 'mm'],
  [/^(cm|centimet(er|re)s?)$/, 'cm'],
  [/^(m|met(er|re)s?)$/, 'm'],
  [/^(km|kilomet(er|re)s?)$/, 'km'],
  [/^(in|ins|inch(es)?|")$/, 'in'],
  [/^(ft|feet|foot|')$/, 'ft'],
  [/^(yd|yards?)$/, 'yd'],
  [/^(mi|miles?)$/, 'mi'],
  [/^(g|grams?)$/, 'g'],
  [/^(kg|kilos?|kilograms?)$/, 'kg'],
  [/^(oz|ounces?)$/, 'oz'],
  [/^(lb|lbs|pounds?)$/, 'lb'],
  [/^(st|stone)$/, 'st'],
  [/^°?c$/, 'c'],
  [/^°?f$/, 'f'],
  [/^°?k$/, 'k'],
]

/** The unit a typed word names, or null for words like "degrees" that name none. */
function unitFromWord(word: string): UnitId | null {
  return UNIT_WORDS.find(([re]) => re.test(word))?.[1] ?? null
}

/** True when a temperature is below absolute zero (0 K). */
export function belowAbsoluteZero(value: Dec, unit: UnitId): boolean {
  if (UNITS[unit].quantity !== 'temperature') return false
  return toKelvin(value, unit).lt(0)
}

/** A short, human explanation of why an input was rejected. */
export function parseError(raw: string, unit: UnitId): string {
  const def = UNITS[unit]
  if (def.quantity === 'length') {
    return `“${raw.trim()}” isn’t a number we can read. Try 12, 12.5, 12 1/2 or 5'6".`
  }
  if (def.quantity === 'mass') {
    return `“${raw.trim()}” isn’t a number we can read. Try 70, 70.5 or 11 st 4 lb.`
  }
  return `“${raw.trim()}” isn’t a number we can read. Try 37, 37.5 or -40.`
}

/* ------------------------------------------------------------------ *
 * Batch mode
 * ------------------------------------------------------------------ */

export interface BatchRow {
  input: string
  output: string | null
  error?: string
}

/**
 * Convert a pasted column of values. Blank lines are preserved so a pasted
 * spreadsheet column lines up with the original when pasted back.
 */
export function convertBatch(
  text: string,
  from: UnitId,
  to: UnitId,
  precision: Precision,
  limit = 5000,
): { rows: BatchRow[]; truncated: boolean } {
  const lines = text.split(/\r?\n/)
  const truncated = lines.length > limit
  const rows: BatchRow[] = []
  for (const line of lines.slice(0, limit)) {
    if (!line.trim()) {
      rows.push({ input: line, output: '' })
      continue
    }
    const parsed = parseQuantity(line, from)
    if (!parsed) {
      rows.push({ input: line, output: null, error: 'not a number' })
      continue
    }
    if (belowAbsoluteZero(parsed.value, from)) {
      rows.push({ input: line, output: null, error: 'below absolute zero' })
      continue
    }
    rows.push({ input: line, output: formatValue(convert(parsed.value, from, to), precision) })
  }
  return { rows, truncated }
}
