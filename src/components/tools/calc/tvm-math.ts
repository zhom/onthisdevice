/**
 * Small time-value helpers for the NPV, IRR and rule-of-72 calculators.
 * Pure functions, no imports but decimal.js (the main formulas are in money-math.ts).
 */
import Decimal from 'decimal.js'

const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 40 })
const d = (v: Decimal.Value) => new Dec(v)

/** Running totals. */
export function cumulative(values: number[]): number[] {
  let sum = d(0)
  return values.map((v) => {
    sum = sum.plus(v)
    return sum.toNumber()
  })
}

/**
 * Profitability index from the present value of each flow: the present value
 * of years 1..n divided by the year-0 investment. Null when year 0 is not an outflow.
 */
export function profitabilityIndex(presentValues: number[]): number | null {
  const first = presentValues[0] ?? 0
  if (!(first < 0)) return null
  const later = presentValues.slice(1).reduce((s, v) => s.plus(v), d(0))
  return later.div(-first).toNumber()
}

export interface MirrParts {
  /** Present value of the negative flows at the finance rate (a positive number). */
  pvOut: number
  /** Value of the positive flows at the end, compounded at the reinvestment rate. */
  fvIn: number
  /** Number of years. */
  n: number
}

/** The two sums inside MIRR = (fvIn ÷ pvOut)^(1/n) − 1. */
export function mirrParts(flows: number[], financePct: number, reinvestPct: number): MirrParts {
  const n = flows.length - 1
  const fr = d(financePct).div(100).plus(1)
  const rr = d(reinvestPct).div(100).plus(1)
  let pvOut = d(0)
  let fvIn = d(0)
  flows.forEach((cf, t) => {
    if (cf < 0) pvOut = pvOut.minus(d(cf).div(fr.pow(t)))
    else fvIn = fvIn.plus(d(cf).times(rr.pow(n - t)))
  })
  return { pvOut: pvOut.toNumber(), fvIn: fvIn.toNumber(), n }
}

