/** Stair layout from the total rise. Pure; the tests import it. Lengths in inches. */

/** International Residential Code limits for a stair (R311.7). */
export const IRC = { maxRiser: 7.75, minTread: 10, headroom: 80 } as const

export interface StairIn {
  /** Total rise, floor to floor. */
  rise: number
  /** Largest riser height allowed. */
  maxRiser: number
  /** Tread depth (run of one step). */
  tread: number
}

export interface StairOut {
  risers: number
  /** Height of each riser. */
  riser: number
  /** Treads are one fewer than risers: the upper floor is the last step. */
  treads: number
  /** Total horizontal run. */
  run: number
  /** Stringer length along the slope, floor to upper floor: √(rise² + run²). */
  stringer: number
  /** Stair angle in degrees: atan(riser ÷ tread). */
  angle: number
  /** 2 × riser + tread; 24 to 25 in is comfortable. */
  stride: number
}

export function stairs(i: StairIn): StairOut {
  const risers = Math.max(1, Math.ceil(i.rise / i.maxRiser - 1e-9))
  const riser = i.rise / risers
  const treads = risers - 1
  const run = treads * i.tread
  return {
    risers,
    riser,
    treads,
    run,
    stringer: Math.hypot(i.rise, run),
    angle: (Math.atan(riser / i.tread) * 180) / Math.PI,
    stride: 2 * riser + i.tread,
  }
}
