/** Slope, line equations, distance and midpoint. Pure; the tests import it. */

export interface Pt {
  x: number
  y: number
  z?: number
}

function gcdInt(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}

/** Decimal places of a number as typed (up to 9), so 0.25 -> 2. */
function places(v: number): number {
  if (Number.isInteger(v)) return 0
  for (let k = 1; k <= 9; k++) if (Math.abs(Math.round(v * 10 ** k) - v * 10 ** k) < 1e-6) return k
  return -1
}

/**
 * Scale numbers with few decimals to whole numbers with no common factor.
 * Null when one of them has more than 9 decimals.
 */
export function wholeRatio(...vs: number[]): number[] | null {
  let k = 0
  for (const v of vs) {
    const p = places(v)
    if (p < 0) return null
    k = Math.max(k, p)
  }
  const ints = vs.map((v) => Math.round(v * 10 ** k))
  if (ints.some((i) => !Number.isSafeInteger(i))) return null
  const g = ints.reduce((acc, i) => gcdInt(acc, i), 0) || 1
  return ints.map((i) => i / g)
}

/** dy/dx as a reduced fraction "3/2", or null when it is not a simple ratio. */
export function fraction(dy: number, dx: number): { n: number; d: number } | null {
  if (dx === 0) return null
  const r = wholeRatio(dy, dx)
  if (!r) return null
  let [n, d] = r as [number, number]
  if (d < 0) {
    n = -n
    d = -d
  }
  return { n, d }
}

export interface Slope {
  dx: number
  dy: number
  /** Null for a vertical line. */
  m: number | null
  /** y-intercept, null for a vertical line. */
  b: number | null
  /** Angle from the positive x axis, degrees in (−90, 90]. */
  angle: number
  /** Standard form Ax + By = C with whole numbers when possible. */
  A: number
  B: number
  C: number
  distance: number
}

export function slope(p1: Pt, p2: Pt): Slope {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const m = dx === 0 ? null : dy / dx
  const b = m === null ? null : p1.y - m * p1.x
  const angle = dx === 0 ? 90 : (Math.atan(dy / dx) * 180) / Math.PI
  let A = dy
  let B = -dx
  let C = dy * p1.x - dx * p1.y
  const r = wholeRatio(A, B, C)
  if (r) [A, B, C] = r as [number, number, number]
  if (A < 0 || (A === 0 && B < 0)) {
    A = -A
    B = -B
    C = -C
  }
  return { dx, dy, m, b, angle, A: A + 0, B: B + 0, C: C + 0, distance: Math.hypot(dx, dy) }
}

export function distance(p1: Pt, p2: Pt): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y, (p2.z ?? 0) - (p1.z ?? 0))
}

export function midpoint(p1: Pt, p2: Pt): Pt {
  const m: Pt = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  if (p1.z !== undefined || p2.z !== undefined) m.z = ((p1.z ?? 0) + (p2.z ?? 0)) / 2
  return m
}
