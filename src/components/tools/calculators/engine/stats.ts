/** Distribution functions for the stats and finance specs. Pure; the Node tests import it. */
import { Phi, betaInc, invPhi, lgamma, phi, tCdf, tInv } from '@/components/tools/calc2/normal'
import { parseList } from '@/components/tools/calc2/central'

export { Phi, betaInc, invPhi, lgamma, phi, tCdf, tInv, parseList }

/** Regularized lower incomplete gamma P(a, x). */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0
  if (x < a + 1) {
    let sum = 1 / a
    let term = sum
    for (let n = 1; n < 1000; n++) {
      term *= x / (a + n)
      sum += term
      if (Math.abs(term) < Math.abs(sum) * 1e-16) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a))
  }
  // continued fraction for Q
  let b = x + 1 - a
  let c = 1e300
  let d = 1 / b
  let h = d
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c
    if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-16) break
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h
}

/** Chi-square CDF with k degrees of freedom. */
export function chi2Cdf(x: number, k: number): number {
  return gammaP(k / 2, x / 2)
}

/** F distribution CDF. */
export function fCdf(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0
  return betaInc((d1 * x) / (d1 * x + d2), d1 / 2, d2 / 2)
}

/** ln(n!) */
export function lnFact(n: number): number {
  return lgamma(n + 1)
}

/** C(n, k) as a float. */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  return Math.round(Math.exp(lnFact(n) - lnFact(k) - lnFact(n - k)))
}

export function binomPmf(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0
  if (p === 0) return k === 0 ? 1 : 0
  if (p === 1) return k === n ? 1 : 0
  return Math.exp(lnFact(n) - lnFact(k) - lnFact(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p))
}

export function poissonPmf(k: number, lambda: number): number {
  if (k < 0) return 0
  if (lambda === 0) return k === 0 ? 1 : 0
  return Math.exp(k * Math.log(lambda) - lambda - lnFact(k))
}

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** Sample (n − 1) or population variance. */
export function variance(xs: number[], sample = true): number {
  const m = mean(xs)
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - (sample ? 1 : 0))
}

/** Percentile by linear interpolation between closest ranks (the R-7 and spreadsheet PERCENTILE.INC method). */
export function quantile(sorted: number[], p: number): number {
  const h = (sorted.length - 1) * p
  const lo = Math.floor(h)
  const hi = Math.ceil(h)
  return sorted[lo]! + (h - lo) * (sorted[hi]! - sorted[lo]!)
}

/** Numbers from a text field, or a CalcError-ready message. */
export function readList(raw: string, min = 1): { values: number[]; error: string | null } {
  const { values, bad } = parseList(raw)
  if (bad.length) return { values, error: `“${bad[0]}” is not a number.` }
  if (values.length < min) return { values, error: `Enter at least ${min} number${min === 1 ? '' : 's'}.` }
  return { values, error: null }
}

export function tPdf(t: number, df: number): number {
  return Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI) - ((df + 1) / 2) * Math.log(1 + (t * t) / df))
}

export function chi2Pdf(x: number, k: number): number {
  if (x <= 0) return k === 2 ? 0.5 : 0
  return Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.LN2 - lgamma(k / 2))
}

export function fPdf(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0
  const lb = lgamma(d1 / 2) + lgamma(d2 / 2) - lgamma((d1 + d2) / 2)
  return Math.exp(0.5 * (d1 * Math.log(d1 * x) + d2 * Math.log(d2) - (d1 + d2) * Math.log(d1 * x + d2)) - Math.log(x) - lb)
}

/** Rows of numbers from a text field: one row per line. */
export function readRows(raw: string, cols: number): { rows: number[][]; error: string | null } {
  const rows: number[][] = []
  for (const line of raw.split(/\n/)) {
    if (!line.trim()) continue
    const { values, bad } = parseList(line)
    if (bad.length) return { rows, error: `“${bad[0]}” is not a number.` }
    if (values.length !== cols) return { rows, error: `Each line needs ${cols} numbers: “${line.trim()}” has ${values.length}.` }
    rows.push(values)
  }
  if (!rows.length) return { rows, error: 'Enter at least one line.' }
  return { rows, error: null }
}
