/** Roof area and materials from a footprint and a pitch. Pure; the tests import it. */

export type RoofType = 'gable' | 'hip' | 'shed'

export interface RoofIn {
  /** Footprint length and width, in any one length unit. */
  length: number
  width: number
  /** Rise per 12 units of run (6 for a 6/12 pitch). */
  rise: number
  /** Overhang past each wall, same unit as the footprint. */
  overhang: number
  type: RoofType
}

export interface RoofOut {
  /** Footprint with the overhang, long side and short side. */
  long: number
  short: number
  /** Plan (flat) area with the overhang. */
  plan: number
  /** Multiplier from plan area to sloped area: √(1 + (rise/12)²). */
  factor: number
  /** Sloped roof area, in the input unit squared. */
  area: number
  /** Horizontal run of one rafter, and its sloped length. */
  run: number
  rafter: number
  /** Height of the ridge (or high edge) above the eaves. */
  height: number
  /** Ridge length, and the total length of the hips. */
  ridge: number
  hips: number
  /** Pitch angle in degrees. */
  angle: number
}

export const DEG = Math.PI / 180

/** √(1 + (rise/12)²): 1.1180 for a 6/12 pitch. */
export function pitchFactor(rise: number): number {
  return Math.sqrt(1 + (rise / 12) ** 2)
}

export function riseFromDegrees(deg: number): number {
  return 12 * Math.tan(deg * DEG)
}

export function degreesFromRise(rise: number): number {
  return Math.atan(rise / 12) / DEG
}

/**
 * Every plane of a roof with one pitch has the same slope, so the sloped
 * area of a gable, hip or shed roof is the plan area times the pitch factor.
 */
export function roof(i: RoofIn): RoofOut {
  const a = i.length + 2 * i.overhang
  const b = i.width + 2 * i.overhang
  const long = Math.max(a, b)
  const short = Math.min(a, b)
  const plan = long * short
  const factor = pitchFactor(i.rise)
  const run = i.type === 'shed' ? short : short / 2
  const height = (run * i.rise) / 12
  const ridge = i.type === 'gable' ? long : i.type === 'hip' ? long - short : 0
  const hips = i.type === 'hip' ? 4 * Math.sqrt(2 * run * run + height * height) : 0
  return {
    long,
    short,
    plan,
    factor,
    area: plan * factor,
    run,
    rafter: run * factor,
    height,
    ridge,
    hips,
    angle: degreesFromRise(i.rise),
  }
}

export interface RoofMaterials {
  /** Area with the waste allowance, ft². */
  withWaste: number
  /** Roofing squares (100 ft²) with waste. */
  squares: number
  /** Shingle bundles, 3 per square, rounded up. */
  bundles: number
  /** Synthetic underlayment rolls of 10 squares (1,000 ft²), rounded up. */
  underlayment: number
}

/** Materials from the sloped area in ft² and a waste allowance in percent. */
export function roofMaterials(areaFt2: number, wastePct: number): RoofMaterials {
  const withWaste = areaFt2 * (1 + wastePct / 100)
  const squares = withWaste / 100
  return {
    withWaste,
    squares,
    bundles: Math.ceil(squares * 3 - 1e-9),
    underlayment: Math.ceil(withWaste / 1000 - 1e-9),
  }
}
