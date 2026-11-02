/** LMS growth reference maths (CDC 2000 growth charts; pure, unit-tested). */

/** [age in months, L, M, S] */
export type LmsRow = [number, number, number, number]

/** L, M and S at an age, linear between the table rows; null outside the table. */
export function lmsAt(rows: LmsRow[], age: number): [number, number, number] | null {
  if (!rows.length || age < rows[0][0] || age > rows[rows.length - 1][0]) return null
  let i = 0
  while (i < rows.length - 1 && rows[i + 1][0] < age) i++
  const a = rows[i]
  const b = rows[Math.min(rows.length - 1, i + 1)]
  if (b[0] === a[0]) return [a[1], a[2], a[3]]
  const t = (age - a[0]) / (b[0] - a[0])
  return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]
}

/** z-score of a measurement: ((x / M)^L - 1) / (L × S), or ln(x / M) / S when L = 0. */
export function zScore(x: number, L: number, M: number, S: number): number {
  return Math.abs(L) < 1e-9 ? Math.log(x / M) / S : ((x / M) ** L - 1) / (L * S)
}

/** Measurement at a z-score: M × (1 + L × S × z)^(1 / L), or M × e^(S × z) when L = 0. */
export function valueAtZ(z: number, L: number, M: number, S: number): number {
  return Math.abs(L) < 1e-9 ? M * Math.exp(S * z) : M * (1 + L * S * z) ** (1 / L)
}

/** Standard normal cumulative distribution (Hart 1968 as given by West 2005; double precision). */
export function normalCdf(z: number): number {
  const x = Math.abs(z)
  let c = 0
  if (x <= 37) {
    const e = Math.exp((-x * x) / 2)
    if (x < 7.07106781186547) {
      let n = 3.52624965998911e-2 * x + 0.700383064443688
      n = n * x + 6.37396220353165
      n = n * x + 33.912866078383
      n = n * x + 112.079291497871
      n = n * x + 221.213596169931
      n = n * x + 220.206867912376
      let d = 8.83883476483184e-2 * x + 1.75566716318264
      d = d * x + 16.064177579207
      d = d * x + 86.7807322029461
      d = d * x + 296.564248779674
      d = d * x + 637.333633378831
      d = d * x + 793.826512519948
      d = d * x + 440.413735824752
      c = (e * n) / d
    } else {
      let b = x + 0.65
      b = x + 4 / b
      b = x + 3 / b
      b = x + 2 / b
      b = x + 1 / b
      c = e / b / 2.506628274631
    }
  }
  return z > 0 ? 1 - c : c
}

/** z-scores of the usual chart percentiles. */
export const PERCENTILE_Z: [number, number][] = [
  [3, -1.880794],
  [10, -1.281552],
  [25, -0.67449],
  [50, 0],
  [75, 0.67449],
  [90, 1.281552],
  [97, 1.880794],
]

/** Percentile (0..100) of a measurement at an age, with the z-score. */
export function percentileOf(rows: LmsRow[], age: number, x: number): { z: number; percentile: number } | null {
  const lms = lmsAt(rows, age)
  if (!lms || !(x > 0)) return null
  const z = zScore(x, ...lms)
  return { z, percentile: normalCdf(z) * 100 }
}

/** "97th", "3rd", "50th"; below 0.1 or above 99.9 as "<0.1st" / ">99.9th". */
export function ordinal(p: number): string {
  if (p < 0.1) return 'below the 0.1st'
  if (p > 99.9) return 'above the 99.9th'
  const n = p < 1 || p > 99 ? Number(p.toFixed(1)) : Math.round(p)
  const int = Math.floor(n)
  const suffix = n !== int ? 'th' : int % 100 >= 11 && int % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][int % 10] ?? 'th'
  return `${n}${suffix}`
}
