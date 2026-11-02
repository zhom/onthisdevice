/**
 * Chemical formula parser and molar mass. Handles brackets ( ) [ ] { },
 * counts, leading coefficients and hydrates joined with · * or . (CuSO4·5H2O).
 * Pure; the tests import it.
 */
import { BY_SYMBOL } from './elements'

export interface Part {
  symbol: string
  name: string
  count: number
  weight: number
  /** count × weight, g/mol */
  mass: number
  /** share of the molar mass, % */
  percent: number
  isotope: boolean
}

export type Parsed =
  | { ok: true; parts: Part[]; total: number; atoms: number }
  | { ok: false; error: string; pos: number }

const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉'
const OPEN: Record<string, string> = { '(': ')', '[': ']', '{': '}' }

class ParseError extends Error {
  readonly pos: number
  constructor(message: string, pos: number) {
    super(message)
    this.pos = pos
  }
}

function normalise(raw: string): string {
  let out = ''
  for (const ch of raw) {
    const i = SUBSCRIPT.indexOf(ch)
    if (i >= 0) out += String(i)
    else if (ch === '•' || ch === '⋅' || ch === '*' || ch === '.' || ch === '·') out += '·'
    else if (ch !== ' ' && ch !== '\t') out += ch
  }
  return out
}

type Counts = Map<string, number>

function add(into: Counts, from: Counts, times: number): void {
  for (const [k, v] of from) into.set(k, (into.get(k) ?? 0) + v * times)
}

export function parseFormula(raw: string): Parsed {
  const s = normalise(raw)
  if (!s) return { ok: false, error: 'Enter a formula, for example H2O or CuSO4·5H2O.', pos: 0 }
  let i = 0

  const readInt = (): number | null => {
    const start = i
    while (i < s.length && s[i]! >= '0' && s[i]! <= '9') i++
    if (i === start) return null
    const n = Number(s.slice(start, i))
    if (n === 0) throw new ParseError('A count of 0 is not allowed.', start)
    return n
  }

  const seq = (close: string | null): Counts => {
    const counts: Counts = new Map()
    let empty = true
    while (i < s.length) {
      const ch = s[i]!
      if (close !== null && ch === close) break
      if (ch === '·') {
        if (close !== null) throw new ParseError(`Close the bracket before "·".`, i)
        break
      }
      if (OPEN[ch]) {
        const at = i
        i++
        const inner = seq(OPEN[ch]!)
        if (s[i] !== OPEN[ch]) throw new ParseError(`Missing "${OPEN[ch]}" for the bracket at position ${at + 1}.`, at)
        i++
        add(counts, inner, readInt() ?? 1)
        empty = false
      } else if (ch >= 'A' && ch <= 'Z') {
        const at = i
        let sym = ch
        i++
        if (i < s.length && s[i]! >= 'a' && s[i]! <= 'z') {
          sym += s[i]
          i++
        }
        if (!BY_SYMBOL.has(sym)) {
          if (sym.length === 2 && BY_SYMBOL.has(sym[0]!)) throw new ParseError(`There is no element "${sym}". For ${sym[0]} and ${sym[1]!.toUpperCase()}, write ${sym[0]}${sym[1]!.toUpperCase()}.`, at)
          throw new ParseError(`There is no element "${sym}".`, at)
        }
        const n = readInt() ?? 1
        counts.set(sym, (counts.get(sym) ?? 0) + n)
        empty = false
      } else if (ch >= 'a' && ch <= 'z') {
        throw new ParseError(`Element symbols start with a capital letter: "${ch.toUpperCase()}" not "${ch}".`, i)
      } else if (ch >= '0' && ch <= '9') {
        throw new ParseError('A number must follow an element or a closing bracket.', i)
      } else if (ch === ')' || ch === ']' || ch === '}') {
        throw new ParseError(`"${ch}" has no opening bracket.`, i)
      } else {
        throw new ParseError(`"${ch}" is not part of a formula.`, i)
      }
    }
    if (empty) throw new ParseError('Empty brackets or an empty part.', i)
    return counts
  }

  try {
    const total: Counts = new Map()
    while (i < s.length) {
      const coef = readInt() ?? 1
      add(total, seq(null), coef)
      if (s[i] === '·') {
        i++
        if (i >= s.length) throw new ParseError('Nothing follows "·".', i)
      }
    }
    let mass = 0
    let atoms = 0
    const parts: Part[] = []
    for (const [symbol, count] of total) {
      const e = BY_SYMBOL.get(symbol)!
      mass += count * e.weight
      atoms += count
      parts.push({ symbol, name: e.name, count, weight: e.weight, mass: count * e.weight, percent: 0, isotope: e.isotope })
    }
    for (const p of parts) p.percent = (p.mass / mass) * 100
    return { ok: true, parts, total: mass, atoms }
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message, pos: e.pos }
    throw e
  }
}

/** Molar mass in g/mol, or null when the formula does not parse. */
export function molarMass(formula: string): number | null {
  const p = parseFormula(formula)
  return p.ok ? p.total : null
}
