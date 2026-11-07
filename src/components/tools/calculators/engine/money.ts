/**
 * Money arithmetic in decimal.js for the finance specs. Pure; the Node tests import it.
 * Loan schedules come from the shared money math of the round-2 calculators.
 */
import Decimal from 'decimal.js'

export { amortize, byYear, levelPayment, monthlyPayment, futureValue, presentValue, ratePerPayment, apy } from '@/components/tools/calc/money-math'
export type { AmortRow, YearSum } from '@/components/tools/calc/money-math'

export const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 40 })
export type Dv = Decimal.Value

export const D = (v: Dv): Decimal => new Dec(v)

/** Rounded to cents, as a number. */
export function cents(v: Dv): number {
  return D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
}

/** a + b + … in Decimal, returned to cents. */
export function sum(...xs: Dv[]): number {
  return cents(xs.reduce<Decimal>((a, b) => a.plus(b), D(0)))
}

/** a × b in Decimal, to cents. */
export function mul(a: Dv, b: Dv): number {
  return cents(D(a).times(b))
}

/** a × pct ÷ 100, to cents. */
export function pctOf(a: Dv, pct: Dv): number {
  return cents(D(a).times(pct).div(100))
}

/** a ÷ b in Decimal, unrounded. */
export function div(a: Dv, b: Dv): number {
  return D(a).div(b).toNumber()
}

/**
 * Number of periods to pay off `pv` with payment `pmt` at rate `i` per period:
 * n = −ln(1 − i·PV/PMT) ÷ ln(1 + i). Null when the payment never covers the interest.
 */
export function periodsToPay(pv: number, i: number, pmt: number): number | null {
  if (pmt <= 0) return null
  if (i === 0) return pv / pmt
  const x = 1 - (i * pv) / pmt
  if (x <= 0) return null
  return -Math.log(x) / Math.log(1 + i)
}

/** Payment of an annuity that pays out `pv` over n periods, payments at the end (or start) of each. */
export function annuityPayment(pv: number, i: number, n: number, due = false): number {
  if (n <= 0) return 0
  if (i === 0) return cents(D(pv).div(n))
  const g = D(i).plus(1).pow(n)
  let p = D(pv).times(i).times(g).div(g.minus(1))
  if (due) p = p.div(D(i).plus(1))
  return cents(p)
}

/** Payment into a fund that grows to `fv` over n periods at rate i. */
export function sinkingPayment(fv: number, i: number, n: number, due = false): number {
  if (n <= 0) return 0
  if (i === 0) return cents(D(fv).div(n))
  let p = D(fv).times(i).div(D(i).plus(1).pow(n).minus(1))
  if (due) p = p.div(D(i).plus(1))
  return cents(p)
}

/** Solve f(x) = 0 on [lo, hi] by bisection. f must change sign. */
export function bisect(f: (x: number) => number, lo: number, hi: number, iterations = 200): number | null {
  let a = lo
  let b = hi
  let fa = f(a)
  const fb = f(b)
  if (!Number.isFinite(fa) || !Number.isFinite(fb) || fa * fb > 0) return null
  for (let k = 0; k < iterations; k++) {
    const m = (a + b) / 2
    const fm = f(m)
    if (fm === 0 || b - a < 1e-14) return m
    if (fa * fm < 0) b = m
    else {
      a = m
      fa = fm
    }
  }
  return (a + b) / 2
}

export interface PayRow {
  period: number
  interest: number
  principal: number
  balance: number
}

/**
 * Pays `principal` down with a fixed payment at rate `i` per period, interest rounded to cents
 * each period. The last payment clears the balance. Stops after `max` periods.
 */
export function payDown(principal: number, i: number, payment: number, max = 3000): { rows: PayRow[]; interest: number; paid: number } {
  let bal = D(principal)
  let interest = D(0)
  let paid = D(0)
  const rows: PayRow[] = []
  for (let p = 1; bal.gt(0) && p <= max; p++) {
    const int = bal.times(i).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    let pay = D(payment)
    if (pay.lte(int)) break
    if (pay.gt(bal.plus(int))) pay = bal.plus(int)
    const prin = pay.minus(int)
    bal = bal.minus(prin)
    interest = interest.plus(int)
    paid = paid.plus(pay)
    rows.push({ period: p, interest: int.toNumber(), principal: prin.toNumber(), balance: bal.toNumber() })
  }
  return { rows, interest: interest.toNumber(), paid: paid.toNumber() }
}

/** Balance at the end of each year (12 rows a year), starting with the opening balance at year 0. */
export function yearlyBalances(opening: number, rows: { balance: number }[], perYear = 12): number[] {
  const out = [opening]
  for (let k = perYear - 1; k < rows.length; k += perYear) out.push(rows[k]!.balance)
  if (rows.length % perYear !== 0) out.push(rows[rows.length - 1]!.balance)
  return out
}
