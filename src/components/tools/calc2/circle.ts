/** Circle from any one measure. Pure; the tests import it. */

export type CircleKnown = 'r' | 'd' | 'C' | 'A'

export interface Circle {
  r: number
  d: number
  C: number
  A: number
}

export function circleFrom(known: CircleKnown, v: number): Circle {
  const r = known === 'r' ? v : known === 'd' ? v / 2 : known === 'C' ? v / (2 * Math.PI) : Math.sqrt(v / Math.PI)
  return { r, d: 2 * r, C: 2 * Math.PI * r, A: Math.PI * r * r }
}

/** Arc length and sector area for a central angle in degrees. */
export function sector(r: number, deg: number): { arc: number; area: number; chord: number } {
  const t = (deg * Math.PI) / 180
  return { arc: r * t, area: 0.5 * r * r * t, chord: 2 * r * Math.sin(t / 2) }
}
