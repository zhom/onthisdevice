/** Room air conditioner sizing (ENERGY STAR table) and a heating estimate. Pure; the tests import it. */

/** [largest area in ft² for the row, BTU/h]. Rows run from 100 ft² up. */
export const ENERGY_STAR: readonly (readonly [number, number])[] = [
  [150, 5000],
  [250, 6000],
  [300, 7000],
  [350, 8000],
  [400, 9000],
  [450, 10000],
  [550, 12000],
  [700, 14000],
  [1000, 18000],
  [1200, 21000],
  [1400, 23000],
  [1500, 24000],
  [2000, 30000],
  [2500, 34000],
]

/** Base capacity for a floor area. Null above 2,500 ft², where the table ends. */
export function baseBtu(areaFt2: number): number | null {
  for (const [max, btu] of ENERGY_STAR) if (areaFt2 <= max) return btu
  return null
}

export type Sun = 'shaded' | 'normal' | 'sunny'

export interface CoolingIn {
  areaFt2: number
  sun: Sun
  people: number
  kitchen: boolean
}

export interface CoolingOut {
  base: number
  /** Shade −10 %, sun +10 %, applied to the base. */
  sunAdj: number
  /** +600 BTU/h for each regular occupant over two. */
  peopleAdj: number
  /** +4,000 BTU/h when the room is a kitchen. */
  kitchenAdj: number
  total: number
}

export function cooling(i: CoolingIn): CoolingOut | null {
  const base = baseBtu(i.areaFt2)
  if (base === null) return null
  const sunAdj = i.sun === 'shaded' ? -0.1 * base : i.sun === 'sunny' ? 0.1 * base : 0
  const peopleAdj = Math.max(0, Math.round(i.people) - 2) * 600
  const kitchenAdj = i.kitchen ? 4000 : 0
  return { base, sunAdj, peopleAdj, kitchenAdj, total: base + sunAdj + peopleAdj + kitchenAdj }
}

export type Insulation = 'good' | 'average' | 'poor'

/** BTU/h per ft³ per °F of temperature rise: common rules of thumb, not a load calculation. */
export const INSULATION: Record<Insulation, number> = { good: 0.133, average: 0.2, poor: 0.25 }

/** Heating BTU/h ≈ room volume (ft³) × temperature rise (°F) × insulation factor. */
export function heating(volumeFt3: number, riseF: number, insulation: Insulation): number {
  return volumeFt3 * riseF * INSULATION[insulation]
}

/** 1 W = 3.412142 BTU/h. */
export const BTU_PER_W = 3.412141633
