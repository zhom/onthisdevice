/** Kinetic energy KE = ½ m v², solved for any one value. Pure; the tests import it. */

export function energy(m: number, v: number): number {
  return 0.5 * m * v * v
}

export function massFor(ke: number, v: number): number {
  return (2 * ke) / (v * v)
}

export function speedFor(ke: number, m: number): number {
  return Math.sqrt((2 * ke) / m)
}

/** Momentum p = m v, for comparison. */
export function momentum(m: number, v: number): number {
  return m * v
}
