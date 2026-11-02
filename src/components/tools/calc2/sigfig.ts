/** Significant figures: counting, rounding and the arithmetic rules. Pure; tests import it. */
import { fromNumber, magnitude, parseDec, roundPlace, roundSig, toPlain } from './scinot'
import type { Dec } from './scinot'

export type DigitKind = 'sig' | 'lead' | 'trail' | 'point' | 'sign' | 'exp'

export interface SigCount {
  count: number
  /** Each typed character of the mantissa with its role, for the scan. */
  chars: { ch: string; kind: DigitKind; why: string }[]
  /** Trailing zeros of a whole number without a point: they may or may not be significant. */
  ambiguous: boolean
  dec: Dec
  /** Power of ten of the last significant digit. */
  lastPlace: number
}

export function countSig(raw: string): SigCount | null {
  const p = parseDec(raw)
  if (!p) return null
  const m = p.mantissa
  const digitIdx = [...m].map((c, i) => (c >= '0' && c <= '9' ? i : -1)).filter((i) => i >= 0)
  const first = digitIdx.find((i) => m[i] !== '0')
  const chars: SigCount['chars'] = []
  if (raw.trim().startsWith('-') || raw.trim().startsWith('−')) chars.push({ ch: '−', kind: 'sign', why: 'The sign is not a digit.' })
  let count = 0
  let ambiguous = false
  if (first === undefined) {
    // Zero: count one figure, the last zero.
    const lastZero = digitIdx[digitIdx.length - 1]
    for (let i = 0; i < m.length; i++) {
      const c = m[i]!
      if (c === '.') chars.push({ ch: c, kind: 'point', why: 'The decimal point.' })
      else chars.push(i === lastZero ? { ch: c, kind: 'sig', why: 'A zero value has one significant figure.' } : { ch: c, kind: 'lead', why: 'Leading zero: only places the point.' })
    }
    count = 1
  } else {
    let last = first
    for (const i of digitIdx) if (m[i] !== '0') last = i
    for (let i = 0; i < m.length; i++) {
      const c = m[i]!
      if (c === '.') {
        chars.push({ ch: c, kind: 'point', why: 'The decimal point.' })
        continue
      }
      if (i < first) chars.push({ ch: c, kind: 'lead', why: 'Leading zero: only places the point.' })
      else if (i <= last) {
        count++
        chars.push({ ch: c, kind: 'sig', why: c === '0' ? 'Zero between non-zero digits.' : 'Non-zero digit.' })
      } else if (p.hasPoint) {
        count++
        chars.push({ ch: c, kind: 'sig', why: 'Trailing zero with a decimal point.' })
      } else {
        ambiguous = true
        chars.push({ ch: c, kind: 'trail', why: 'Trailing zero with no decimal point: not counted.' })
      }
    }
  }
  if (p.power !== 0) chars.push({ ch: `×10^${p.power}`, kind: 'exp', why: 'The power of ten does not change the count.' })
  return { count, chars, ambiguous, dec: p.dec, lastPlace: p.dec.exp }
}

export type SigOp = '+' | '−' | '×' | '÷'

export interface SigArith {
  raw: number
  rounded: Dec
  rule: string
}

/** Combine two measurements and round by the rule for the operation. */
export function sigArith(a: string, op: SigOp, b: string): SigArith | null {
  const A = countSig(a)
  const B = countSig(b)
  if (!A || !B) return null
  const x = Number(toPlain(A.dec).replace('−', '-'))
  const y = Number(toPlain(B.dec).replace('−', '-'))
  const raw = op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : y === 0 ? NaN : x / y
  if (!Number.isFinite(raw)) return null
  if (op === '+' || op === '−') {
    const place = Math.max(A.lastPlace, B.lastPlace)
    return { raw, rounded: roundPlace(fromNumber(raw), place), rule: `Add or subtract: keep the coarsest last decimal place, 10^${place}.` }
  }
  const n = Math.min(A.count, B.count)
  return { raw, rounded: roundSig(fromNumber(raw), n), rule: `Multiply or divide: keep the fewest significant figures, ${n}.` }
}

/** Round typed text to n significant figures; returns the Dec. */
export function roundToSig(raw: string, n: number): Dec | null {
  const p = parseDec(raw)
  if (!p) return null
  return roundSig(p.dec, n)
}

export { magnitude }
