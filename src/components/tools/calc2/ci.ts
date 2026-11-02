/** Confidence intervals and sample sizes. Pure; the tests import it. */
import { invPhi, tInv } from './normal'

/** Two-sided critical z for a confidence level such as 0.95. */
export function zCrit(level: number): number {
  return invPhi(1 - (1 - level) / 2)
}

export function tCrit(level: number, df: number): number {
  return tInv(1 - (1 - level) / 2, df)
}

export interface Interval {
  lo: number
  hi: number
  margin: number
  crit: number
  se: number
}

/** Mean with known σ (z) or sample s (t with n − 1 degrees of freedom). */
export function meanInterval(mean: number, sd: number, n: number, level: number, known: boolean): Interval {
  const crit = known ? zCrit(level) : tCrit(level, n - 1)
  const se = sd / Math.sqrt(n)
  const margin = crit * se
  return { lo: mean - margin, hi: mean + margin, margin, crit, se }
}

/** Proportion, Wald interval: p̂ ± z √(p̂(1 − p̂) ÷ n). */
export function waldInterval(x: number, n: number, level: number): Interval {
  const p = x / n
  const crit = zCrit(level)
  const se = Math.sqrt((p * (1 - p)) / n)
  const margin = crit * se
  return { lo: p - margin, hi: p + margin, margin, crit, se }
}

/** Proportion, Wilson score interval. */
export function wilsonInterval(x: number, n: number, level: number): Interval {
  const p = x / n
  const z = zCrit(level)
  const z2 = z * z
  const denom = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denom
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
  return { lo: centre - margin, hi: centre + margin, margin, crit: z, se: Math.sqrt((p * (1 - p)) / n) }
}

export interface SampleSize {
  /** Before rounding, infinite population. */
  n0: number
  /** After the finite population correction, before rounding. */
  nAdj: number
  /** Rounded up. */
  n: number
  z: number
}

/** n₀ = z² p (1 − p) ÷ E²; with a population N, n = n₀ ÷ (1 + (n₀ − 1) ÷ N). */
export function sampleSize(level: number, margin: number, p = 0.5, population?: number): SampleSize {
  const z = zCrit(level)
  const n0 = (z * z * p * (1 - p)) / (margin * margin)
  const nAdj = population && population > 0 ? n0 / (1 + (n0 - 1) / population) : n0
  return { n0, nAdj, n: Math.ceil(nAdj - 1e-9), z }
}

/** Margin of error for a sample of n: z √(p (1 − p) ÷ n), with the finite population correction. */
export function marginFor(n: number, level: number, p = 0.5, population?: number): number {
  const z = zCrit(level)
  const fpc = population && population > 1 ? Math.sqrt((population - n) / (population - 1)) : 1
  return z * Math.sqrt((p * (1 - p)) / n) * fpc
}
