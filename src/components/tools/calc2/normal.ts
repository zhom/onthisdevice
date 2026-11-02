/**
 * Normal and Student t distributions. Accurate to about 1e-14 for the normal
 * CDF and 1e-10 for t quantiles. Pure; the tests import it.
 */

const SQRT2PI = Math.sqrt(2 * Math.PI)

/** Standard normal density. */
export function phi(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT2PI
}

/** Upper tail Q(x) = 1 − Φ(x) for x ≥ 0, without cancellation. */
function upper(x: number): number {
  if (x < 3) {
    // Taylor series: Φ(x) = ½ + φ(x)(x + x³/3 + x⁵/15 + …)
    let term = x
    let s = x
    for (let k = 1; k < 200; k++) {
      term *= (x * x) / (2 * k + 1)
      s += term
      if (term < 1e-17 * s) break
    }
    return 0.5 - phi(x) * s
  }
  // Continued fraction for the Mills ratio, evaluated backwards.
  let f = x
  for (let k = 120; k >= 1; k--) f = x + k / f
  return phi(x) / f
}

/** Standard normal CDF Φ(x). */
export function Phi(x: number): number {
  if (Number.isNaN(x)) return NaN
  if (x === Infinity) return 1
  if (x === -Infinity) return 0
  return x >= 0 ? 1 - upper(x) : upper(-x)
}

/** Inverse of Φ (the z for a left-tail probability p). */
export function invPhi(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  // Acklam's rational approximation, then two Halley steps.
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const lo = 0.02425
  let x: number
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p))
    x = (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  } else if (p <= 1 - lo) {
    const q = p - 0.5
    const r = q * q
    x = ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    x = -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  }
  for (let i = 0; i < 2; i++) {
    const e = Phi(x) - p
    const u = e * SQRT2PI * Math.exp(0.5 * x * x)
    x = x - u / (1 + (x * u) / 2)
  }
  return x
}

/** ln Γ(x) for x > 0 (Lanczos, g = 7). */
export function lgamma(x: number): number {
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x)
  x -= 1
  let a = c[0]!
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i]! / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

/** Continued fraction for the incomplete beta (modified Lentz). */
function betacf(a: number, b: number, x: number): number {
  const TINY = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < TINY) d = TINY
  d = 1 / d
  let h = d
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < TINY) d = TINY
    c = 1 + aa / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < TINY) d = TINY
    c = 1 + aa / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-15) break
  }
  return h
}

/** Regularized incomplete beta I_x(a, b). */
export function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a
  return 1 - (bt * betacf(b, a, 1 - x)) / b
}

/** Student t CDF with `df` degrees of freedom. */
export function tCdf(t: number, df: number): number {
  const x = df / (df + t * t)
  const tail = 0.5 * betaInc(x, df / 2, 0.5)
  return t >= 0 ? 1 - tail : tail
}

/** Student t quantile: the t with P(T ≤ t) = p. */
export function tInv(p: number, df: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  if (p === 0.5) return 0
  if (p < 0.5) return -tInv(1 - p, df)
  let lo = 0
  let hi = 1
  while (tCdf(hi, df) < p && hi < 1e8) hi *= 2
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (tCdf(mid, df) < p) lo = mid
    else hi = mid
    if (hi - lo < 1e-13 * Math.max(1, hi)) break
  }
  return (lo + hi) / 2
}
