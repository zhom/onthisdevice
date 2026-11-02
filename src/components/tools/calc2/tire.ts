/** Tire sizes in the metric (P-metric / ISO) code, such as 225/45R17. Pure; the tests import it. */

export interface Tire {
  /** Section width, mm. */
  width: number
  /** Aspect ratio: sidewall height as a percentage of the width. */
  aspect: number
  /** Rim diameter, inches. */
  rim: number
}

export interface TireSize {
  sidewall: number
  /** Overall diameter, mm. */
  diameter: number
  circumference: number
  /** Wheel turns per mile and per km. */
  revsPerMile: number
  revsPerKm: number
}

/** "225/45R17", "225/45 ZR17", "P225/45R17 91W", "225 45 17". */
export function parseTire(raw: string): Tire | null {
  const m = raw.trim().toUpperCase().match(/^[A-Z]{0,2}\s*(\d{3})\s*[/ ]\s*(\d{2,3})\s*[A-Z]{0,3}\s*[- ]?\s*(\d{2}(?:\.\d)?)\b/)
  if (!m) return null
  const t = { width: Number(m[1]), aspect: Number(m[2]), rim: Number(m[3]) }
  return t.width >= 100 && t.width <= 400 && t.aspect >= 20 && t.aspect <= 100 && t.rim >= 10 && t.rim <= 30 ? t : null
}

export function tireSize(t: Tire): TireSize {
  const sidewall = (t.width * t.aspect) / 100
  const diameter = t.rim * 25.4 + 2 * sidewall
  const circumference = Math.PI * diameter
  return { sidewall, diameter, circumference, revsPerMile: 1609344 / circumference, revsPerKm: 1e6 / circumference }
}

/**
 * Speedometer reading with the new tire: the speedometer counts wheel turns
 * calibrated for the old tire, so the true speed is shown × new ÷ old.
 */
export function trueSpeed(shown: number, oldDiameter: number, newDiameter: number): number {
  return (shown * newDiameter) / oldDiameter
}
