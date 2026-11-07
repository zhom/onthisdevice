/** Sentences about a conversion, shared by the registry entries and the explainers. */
import { D, convert, formatValue, formulaFor, formulaSymbol, isShortExact, parseNumber, withUnit, type UnitLite } from './engine'

export function article(word: string): string {
  return /^(?:[aeio]|u[^nsr]|hour|honest)/i.test(word) && !/^(?:one|eu|uni|us )/i.test(word) ? 'an' : 'a'
}

/** "0.1", "2.54", "0.3937007874" */
export function ratioText(from: UnitLite, to: UnitLite, binary = false): string {
  return formatValue(convert(new D(1), from, to, binary), 'auto', 10)
}

/** True when 1 `from` is a short exact number of `to`. */
export function ratioIsExact(from: UnitLite, to: UnitLite): boolean {
  return isShortExact(convert(new D(1), from, to))
}

/** "cm = mm ÷ 10", "°F = K × 1.8 − 459.67", "L/100 km = 235.2145833 ÷ mpg" */
export function formulaLine(from: UnitLite, to: UnitLite, binary = false): string {
  const f = formulaFor(from, to, binary)
  const a = formulaSymbol(from)
  const b = formulaSymbol(to)
  switch (f.kind) {
    case 'multiply':
      return `${b} = ${a} × ${formatValue(f.k, 'auto', 12)}`
    case 'divide':
      return `${b} = ${a} ÷ ${formatValue(f.k, 'auto', 12)}`
    case 'reciprocal':
      return `${b} = ${formatValue(f.k, 'auto', 10)} ÷ ${a}`
    case 'affine': {
      const sign = f.b.isNegative() ? '−' : '+'
      const mul = f.a.equals(1) ? a : `${a} × ${formatValue(f.a, 'auto', 10)}`
      return f.b.isZero() ? `${b} = ${mul}` : `${b} = ${mul} ${sign} ${formatValue(f.b.abs(), 'auto', 10)}`
    }
  }
}

/** A worked example in words: "25 mm ÷ 10 = 2.5 cm". */
export function workedExample(from: UnitLite, to: UnitLite, input: string): string {
  const v = parseNumber(input) ?? new D(1)
  const out = convert(v, from, to)
  const f = formulaFor(from, to)
  const vin = formatValue(v)
  const res = withUnit(formatValue(out), to)
  switch (f.kind) {
    case 'multiply':
      return `${withUnit(vin, from)} × ${formatValue(f.k, 'auto', 12)} = ${res}`
    case 'divide':
      return `${withUnit(vin, from)} ÷ ${formatValue(f.k, 'auto', 12)} = ${res}`
    case 'reciprocal':
      return `${formatValue(f.k, 'auto', 10)} ÷ ${vin} = ${res}`
    case 'affine': {
      const sign = f.b.isNegative() ? '−' : '+'
      const mul = f.a.equals(1) ? `${vin}` : `${vin} × ${formatValue(f.a, 'auto', 10)}`
      return f.b.isZero() ? `${mul} = ${res}` : `${mul} ${sign} ${formatValue(f.b.abs(), 'auto', 10)} = ${res}`
    }
  }
}

/**
 * A rule of thumb for mental arithmetic, or null when the exact factor is already easy
 * (×10, ÷1000, ×12).
 */
export function estimateRule(from: UnitLite, to: UnitLite): string | null {
  const f = formulaFor(from, to)
  if (f.kind === 'affine') return null
  if (f.kind === 'reciprocal') return `Divide ${formatValue(f.k.toSignificantDigits(3))} by the ${from.symbol} figure.`
  const k = f.k
  const digits = k.toFixed().replace(/[.-]/g, '').replace(/^0+/, '').replace(/0+$/, '')
  if (digits.length <= 2) return null
  let rough = k.toSignificantDigits(2)
  if (rough.div(k).minus(1).abs().gt('0.01')) rough = k.toSignificantDigits(3)
  const verb = f.kind === 'multiply' ? 'Multiply' : 'Divide'
  const error = rough.div(k).minus(1).abs().times(100)
  return `${verb} by about ${formatValue(rough)} for a quick estimate. That is within ${formatValue(error.toSignificantDigits(1))}% of the exact result.`
}

/** The definitions of both units in terms of their common base, for the explainer. */
export function exactNote(from: UnitLite, to: UnitLite): string {
  const one = new D(1)
  const there = convert(one, from, to)
  const back = convert(one, to, from)
  return `${withUnit('1', from)} = ${withUnit(formatValue(there, 'auto', 12), to)}, and ${withUnit('1', to)} = ${withUnit(formatValue(back, 'auto', 12), from)}.`
}
