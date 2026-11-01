/**
 * Generic unit-conversion engine.
 *
 * Every unit is described by its relationship to the dimension's base unit:
 *
 *   linear      base = value × factor + offset          (offset defaults to 0)
 *   reciprocal  base = factor ÷ value                   (fuel economy)
 *
 * A `mode` lets one dimension carry several factor tables — the 1000 vs 1024
 * question for digital storage, and the ingredient density for cooking, where
 * a gram is a different number of millilitres for flour than it is for honey.
 *
 * All factors below are exact by definition unless the unit itself is a
 * measured quantity (mach, ingredient densities), which is flagged in `note`.
 */

export type DimensionId =
  | 'length'
  | 'weight'
  | 'temperature'
  | 'volume'
  | 'area'
  | 'speed'
  | 'time'
  | 'data'
  | 'pressure'
  | 'energy'
  | 'power'
  | 'cooking'
  | 'fuel'
  | 'angle'

export interface UnitDef {
  /** Stable id used in URLs — keep it short and human-typeable. */
  id: string
  /** Full name, e.g. "Centimetre". */
  name: string
  /** Display symbol, e.g. "cm". */
  symbol: string
  /** Grouping label used to order the picker, e.g. "Metric". */
  group: string
  /** base = value × factor + offset, or base = factor ÷ value when reciprocal. */
  factor: number
  offset?: number
  reciprocal?: boolean
  /** Per-mode override of `factor`. */
  factorByMode?: Record<string, number>
  /** Small print shown in the reference table. */
  note?: string
  noteByMode?: Record<string, string>
}

export interface ModeOption {
  id: string
  label: string
  note: string
}

export interface DimensionModes {
  /** Label for the whole control, e.g. "Ingredient". */
  label: string
  help: string
  options: ModeOption[]
}

export interface CommonPair {
  from: string
  to: string
}

export interface Dimension {
  id: DimensionId
  /** "Length", "Digital storage" … */
  name: string
  /** id of the base unit every factor is relative to. */
  base: string
  units: UnitDef[]
  common: CommonPair[]
  modes?: DimensionModes
  /** Physical floor expressed in base units (absolute zero, non-negative sizes). */
  minBase?: number
  minBaseMessage?: string
  /** Row values used by the printable conversion chart. */
  chartValues?: number[]
}

/* ─────────────────────────── lookups ─────────────────────────── */

export function unitFactor(u: UnitDef, mode?: string): number {
  if (mode && u.factorByMode) {
    const f = u.factorByMode[mode]
    if (typeof f === 'number') return f
  }
  return u.factor
}

export function unitNote(u: UnitDef, mode?: string): string | undefined {
  if (mode && u.noteByMode) {
    const n = u.noteByMode[mode]
    if (typeof n === 'string') return n
  }
  return u.note
}

export function findUnit(dim: Dimension, id: string | null | undefined): UnitDef | undefined {
  if (!id) return undefined
  const wanted = id.toLowerCase()
  return dim.units.find((u) => u.id.toLowerCase() === wanted)
}

export function baseUnit(dim: Dimension): UnitDef {
  const u = findUnit(dim, dim.base)
  if (!u) throw new Error(`[units] dimension "${dim.id}" has no base unit "${dim.base}"`)
  return u
}

/** Units in picker order: grouped, groups in first-seen order. */
export function groupedUnits(dim: Dimension): { group: string; units: UnitDef[] }[] {
  const out: { group: string; units: UnitDef[] }[] = []
  for (const u of dim.units) {
    let bucket = out.find((g) => g.group === u.group)
    if (!bucket) {
      bucket = { group: u.group, units: [] }
      out.push(bucket)
    }
    bucket.units.push(u)
  }
  return out
}

/* ─────────────────────────── conversion ─────────────────────────── */

export type ConvertResult = { ok: true; value: number } | { ok: false; error: string }

export function toBase(value: number, u: UnitDef, mode?: string): number {
  const f = unitFactor(u, mode)
  if (u.reciprocal) return f / value
  return value * f + (u.offset ?? 0)
}

export function fromBase(base: number, u: UnitDef, mode?: string): number {
  const f = unitFactor(u, mode)
  if (u.reciprocal) return f / base
  return (base - (u.offset ?? 0)) / f
}

export function convert(
  value: number,
  from: UnitDef,
  to: UnitDef,
  dim: Dimension,
  mode?: string,
): ConvertResult {
  if (!Number.isFinite(value)) return { ok: false, error: 'Enter a number to convert.' }
  if (from.reciprocal && value === 0) {
    return {
      ok: false,
      error: `0 ${from.symbol} means the vehicle covers no distance at all, so there is no equivalent value.`,
    }
  }
  const base = toBase(value, from, mode)
  if (!Number.isFinite(base)) {
    return { ok: false, error: 'That value is too large or too small to convert.' }
  }
  if (typeof dim.minBase === 'number' && base < dim.minBase - 1e-12) {
    return {
      ok: false,
      error:
        dim.minBaseMessage ??
        `Values below ${dim.minBase} ${baseUnit(dim).symbol} are not physically possible.`,
    }
  }
  if (to.reciprocal && base === 0) {
    return {
      ok: false,
      error: `A value of 0 cannot be expressed in ${to.symbol}: the result would be infinite.`,
    }
  }
  let out = fromBase(base, to, mode)
  // Offset scales cancel in floating point: −459.67 °F is exactly 0 K, not 2.8e-14.
  if ((from.offset || to.offset) && Math.abs(out) < 1e-9) out = 0
  if (!Number.isFinite(out)) {
    return { ok: false, error: 'That value is too large or too small to convert.' }
  }
  return { ok: true, value: out }
}

/* ─────────────────────────── input parsing ─────────────────────────── */

const VULGAR: Record<string, number> = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
}

/**
 * Parse what people actually type: "1,234.56", "1 234,5", "3/4", "1 1/2",
 * "2½", "6.02e23", "−40" (unicode minus).
 * Returns null when the text isn't a number at all.
 */
export function parseNumber(raw: string): number | null {
  let s = raw
    .trim()
    .replace(/[\u2212\u2012\u2013\u2014]/g, '-')
    .replace(/[\u00a0\u202f\u2007\u2009]/g, ' ')
    .replace(/[\u2019']/g, '')
  if (!s) return null

  // Vulgar fractions: "2½" → "2 1/2"
  for (const [glyph, val] of Object.entries(VULGAR)) {
    if (s.includes(glyph)) {
      const parts = s.split(glyph)
      const whole = parseNumber(parts[0] ?? '') ?? 0
      const sign = /^\s*-/.test(parts[0] ?? '') || whole < 0 ? -1 : 1
      const rest = (parts[1] ?? '').trim()
      if (rest) return null
      return sign * (Math.abs(whole) + val)
    }
  }

  // Mixed number "1 1/2" or plain fraction "3/4"
  // The whole part needs a space after it, so "15/16" is not read as 1 5/16.
  const frac = s.match(/^(?:(-?\d+(?:[.,]\d+)?)\s+)?(-?\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/)
  if (frac) {
    const whole = frac[1] ? Number(frac[1].replace(',', '.')) : 0
    const num = Number((frac[2] ?? '').replace(',', '.'))
    const den = Number((frac[3] ?? '').replace(',', '.'))
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null
    const sign = whole < 0 || /^-/.test(s) ? -1 : 1
    return sign * (Math.abs(whole) + Math.abs(num) / den)
  }

  // Thousands separators vs decimal comma.
  const dots = (s.match(/\./g) ?? []).length
  const commas = (s.match(/,/g) ?? []).length
  if (commas && dots) {
    // Whichever appears last is the decimal separator.
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (commas === 1 && (!/,\d{3}(\D|$)/.test(s) || /^[-+]?0,/.test(s))) {
    s = s.replace(',', '.')
  } else if (commas) {
    s = s.replace(/,/g, '')
  }
  s = s.replace(/\s+/g, '')
  s = s.replace(/[×x]10\^?/i, 'e')

  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * True while the text could still grow into a valid number ("-", "1.", "1e-"),
 * so the UI doesn't shout at someone mid-keystroke.
 */
export function isPartialNumber(raw: string): boolean {
  const t = raw.trim()
  if (t === '') return true
  if (/^[-+]?[\d,\s]*[.,]?\d*(?:[eE][-+]?\d*)?$/.test(t)) return true
  if (/\/\s*$/.test(t)) return true
  return false
}

/* ─────────────────────────── formatting ─────────────────────────── */

export type Notation = 'auto' | 'decimal' | 'scientific'
export type Precision = 'auto' | number

const SUPERSCRIPT: Record<string, string> = {
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
  '-': '⁻',
  '+': '',
}

/** Insert thousands separators without depending on the visitor's locale. */
export function groupDigits(s: string): string {
  const [int = '', frac] = s.split('.')
  const neg = int.startsWith('-')
  const digits = neg ? int.slice(1) : int
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${neg ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

/** Plain decimal string with up to 12 significant digits, no exponent. */
function plainDecimal(v: number, precision: Precision): string {
  if (v === 0) return precision === 'auto' ? '0' : (0).toFixed(precision)
  if (Math.abs(v) >= 1e21) return expandExponential(v.toExponential(precision === 'auto' ? 12 : precision))
  if (precision !== 'auto') return v.toFixed(Math.min(precision, 20))
  const sig = v.toPrecision(12)
  if (!/e/i.test(sig)) return trimZeros(sig)
  // toPrecision fell back to exponential — expand it before trimming zeros,
  // or the zeros of the exponent itself would go.
  return trimZeros(expandExponential(sig))
}

function expandExponential(s: string): string {
  const m = s.match(/^(-?)(\d)(?:\.(\d+))?e([-+]?\d+)$/i)
  if (!m) return s
  const sign = m[1] ?? ''
  const lead = m[2] ?? '0'
  const rest = m[3] ?? ''
  const exp = Number(m[4] ?? '0')
  const digits = lead + rest
  if (exp >= 0) {
    if (exp >= rest.length) return sign + digits + '0'.repeat(exp - rest.length)
    return `${sign}${digits.slice(0, exp + 1)}.${digits.slice(exp + 1)}`
  }
  return `${sign}0.${'0'.repeat(-exp - 1)}${digits}`
}

function scientific(v: number, precision: Precision): string {
  const digits = precision === 'auto' ? 6 : Math.min(precision, 17)
  const s = v.toExponential(digits)
  const [mantissa = '0', exp = '0'] = s.split('e')
  const m = precision === 'auto' ? trimZeros(mantissa) : mantissa
  return `${m}e${exp.startsWith('-') ? exp : `+${exp.replace('+', '')}`}`
}

function useScientific(v: number, notation: Notation): boolean {
  if (v === 0) return false
  if (notation === 'scientific') return true
  if (notation === 'decimal') return false
  const a = Math.abs(v)
  return a >= 1e18 || a < 1e-9
}

/** Machine-parseable string for the input field. */
export function formatValue(v: number, precision: Precision, notation: Notation): string {
  if (!Number.isFinite(v)) return ''
  if (useScientific(v, notation)) return scientific(v, precision)
  return plainDecimal(v, precision)
}

/** Human-facing string: grouped digits, or a typeset ×10ⁿ form. */
export function displayValue(v: number, precision: Precision, notation: Notation): string {
  if (!Number.isFinite(v)) return '–'
  if (useScientific(v, notation)) return prettyExponential(scientific(v, precision))
  return groupDigits(plainDecimal(v, precision))
}

export function prettyExponential(s: string): string {
  const [mantissa = '', exp = ''] = s.split('e')
  if (!exp) return s
  const sup = exp
    .split('')
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join('')
  return `${mantissa} × 10${sup}`
}

/** How many significant digits a constant needs — used to pick the tidier formula. */
function significantDigits(v: number): number {
  if (!Number.isFinite(v) || v === 0) return 1
  const s = trimZeros(Math.abs(Number(v.toPrecision(10))).toString())
  const digits = s.replace('.', '').replace(/^0+/, '')
  return Math.max(1, digits.length)
}

/** "0.5555555555555556" → "5/9". Only for exact small-denominator fractions. */
function simpleFraction(v: number): string | null {
  const a = Math.abs(v)
  if (!Number.isFinite(a) || a === 0 || a > 1000) return null
  for (let q = 2; q <= 64; q++) {
    const p = Math.round(v * q)
    if (p === 0) continue
    if (Math.abs(v - p / q) <= 1e-12 * a) {
      const g = gcd(Math.abs(p), q)
      if (q / g === 1) return null
      return `${p / g}/${q / g}`
    }
  }
  return null
}

function gcd(x: number, y: number): number {
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

/** Compact, ungrouped number used inside formulas. */
export function constantString(v: number): string {
  if (!Number.isFinite(v)) return '–'
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e15 || a < 1e-6) return prettyExponential(scientific(v, 'auto'))
  if (significantDigits(v) > 6) {
    const frac = simpleFraction(v)
    if (frac) return frac
  }
  const intDigits = Math.max(0, Math.floor(Math.log10(a)) + 1)
  return groupDigits(trimZeros(Number(v.toPrecision(12)).toFixed(Math.max(0, 12 - intDigits))))
}

/* ─────────────────────────── formulas ─────────────────────────── */

export interface Formula {
  /** e.g. "in = cm ÷ 2.54" */
  text: string
  /** Optional second, equivalent way of writing it. */
  alt?: string
}

const MINUS = '−'

function signed(v: number): string {
  return v < 0 ? `${MINUS} ${constantString(Math.abs(v))}` : `+ ${constantString(v)}`
}

/**
 * Symbolic formula for from → to, simplified as far as the unit pair allows.
 */
export function describeFormula(from: UnitDef, to: UnitDef, mode?: string): Formula {
  const a = unitFactor(from, mode)
  const b = from.offset ?? 0
  const c = unitFactor(to, mode)
  const d = to.offset ?? 0
  const F = from.symbol
  const T = to.symbol

  /** Attach the alternative wording only when its constant is genuinely tidy. */
  const withAlt = (text: string, altText: string, altConst: number): Formula =>
    significantDigits(altConst) <= 6 ? { text, alt: altText } : { text }

  if (from.reciprocal !== to.reciprocal) {
    if (from.reciprocal) {
      // base = a ÷ v ; to = (base − d) ÷ c
      if (d === 0) return { text: `${T} = ${constantString(a / c)} ÷ ${F}` }
      return { text: `${T} = (${constantString(a)} ÷ ${F} ${signed(-d)}) ÷ ${constantString(c)}` }
    }
    // base = a·v + b ; to = c ÷ base
    if (b === 0) return { text: `${T} = ${constantString(c / a)} ÷ ${F}` }
    return { text: `${T} = ${constantString(c)} ÷ (${F} × ${constantString(a)} ${signed(b)})` }
  }

  // Both plain or both reciprocal — either way the result is linear in `from`.
  const k = from.reciprocal ? c / a : a / c
  const off = from.reciprocal ? 0 : (b - d) / c

  if (off === 0) {
    if (k === 1) return { text: `${T} = ${F}` }
    if (k > 1) return withAlt(`${T} = ${F} × ${constantString(k)}`, `${T} = ${F} ÷ ${constantString(1 / k)}`, 1 / k)
    return withAlt(`${T} = ${F} ÷ ${constantString(1 / k)}`, `${T} = ${F} × ${constantString(k)}`, k)
  }

  if (k === 1) {
    return { text: `${T} = ${F} ${signed(off)}` }
  }

  // Two equivalent shapes: v·k + off, or (v + off/k)·k. Lead with the tidier one.
  const inner = off / k
  const addForm = `${T} = ${F} × ${constantString(k)} ${signed(off)}`
  const factForm = `${T} = (${F} ${signed(inner)}) × ${constantString(k)}`
  return significantDigits(inner) < significantDigits(off)
    ? withAlt(factForm, addForm, off)
    : withAlt(addForm, factForm, inner)
}
