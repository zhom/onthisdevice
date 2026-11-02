/** Gear trains: ratio, output speed and torque, and meshing phases for drawing. Pure. */

export interface Train {
  /** Driven ÷ driver: above 1 slows down and multiplies torque. */
  ratio: number
  outRpm: number
  outTorque: number
  /** True when the output turns the same way as the input. */
  sameDirection: boolean
}

/**
 * A simple train: driver → (idler) → driven. An idler changes the direction,
 * never the ratio. `efficiency` is 0..1 and only lowers the torque.
 */
export function train(driver: number, driven: number, inRpm: number, inTorque: number, idler: boolean, efficiency = 1): Train {
  const ratio = driven / driver
  return { ratio, outRpm: inRpm / ratio, outTorque: inTorque * ratio * efficiency, sameDirection: idler }
}

/** Gear ratio as "1 : 3" or "3 : 1" with the larger side reduced. */
export function ratioText(driver: number, driven: number): string {
  const g = gcd(Math.round(driver), Math.round(driven))
  if (Number.isInteger(driver) && Number.isInteger(driven) && g > 0) return `${driven / g} : ${driver / g}`
  return `${Number((driven / driver).toPrecision(4))} : 1`
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b]
  return Math.abs(a)
}

/**
 * Angle of gear B (zB teeth) that meshes with gear A (zA teeth, at angle
 * phiA) when B sits to the right of A on the same horizontal line. Tooth k
 * of a gear is centred at angle + k × 2π/z. A tooth of A on the line of
 * centres meets a gap of B, and B turns −zA/zB as fast as A.
 */
export function meshPhase(zA: number, phiA: number, zB: number): number {
  return Math.PI - Math.PI / zB - (zA / zB) * phiA
}
