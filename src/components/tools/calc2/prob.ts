/** Two independent events. Pure; the tests import it. */

export interface TwoEvents {
  and: number
  or: number
  notA: number
  notB: number
  exactlyOne: number
  neither: number
  aNotB: number
  bNotA: number
}

export function twoEvents(a: number, b: number): TwoEvents {
  return {
    and: a * b,
    or: a + b - a * b,
    notA: 1 - a,
    notB: 1 - b,
    exactlyOne: a + b - 2 * a * b,
    neither: (1 - a) * (1 - b),
    aNotB: a * (1 - b),
    bNotA: b * (1 - a),
  }
}

/** P(A happens at least once in n independent trials) = 1 − (1 − p)ⁿ. */
export function atLeastOnce(p: number, n: number): number {
  return 1 - Math.pow(1 - p, n)
}

/** P(exactly k successes in n trials), binomial. */
export function binomialExactly(p: number, n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let c = 0
  for (let i = 1; i <= k; i++) c += Math.log(n - k + i) - Math.log(i)
  const lp = k === 0 ? 0 : k * Math.log(p)
  const lq = n - k === 0 ? 0 : (n - k) * Math.log(1 - p)
  return Math.exp(c + lp + lq)
}
