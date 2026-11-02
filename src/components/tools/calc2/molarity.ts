/** Molarity M = n / V = m / (Mw V) and dilution M₁V₁ = M₂V₂. Pure; the tests import it. Volumes in L. */

export function molarity(massG: number, molarMass: number, litres: number): number {
  return massG / molarMass / litres
}

export function massNeeded(molar: number, molarMass: number, litres: number): number {
  return molar * litres * molarMass
}

export function volumeFor(massG: number, molarMass: number, molar: number): number {
  return massG / molarMass / molar
}

export type DilutionKey = 'M1' | 'V1' | 'M2' | 'V2'

export interface Dilution {
  M1: number
  V1: number
  M2: number
  V2: number
}

/** Solve M₁V₁ = M₂V₂ for one value. */
export function dilute(key: DilutionKey, d: Dilution): Dilution {
  switch (key) {
    case 'M1':
      return { ...d, M1: (d.M2 * d.V2) / d.V1 }
    case 'V1':
      return { ...d, V1: (d.M2 * d.V2) / d.M1 }
    case 'M2':
      return { ...d, M2: (d.M1 * d.V1) / d.V2 }
    case 'V2':
      return { ...d, V2: (d.M1 * d.V1) / d.M2 }
  }
}

export const LIQUID = {
  mL: 0.001,
  L: 1,
} as const
export type LiquidUnit = keyof typeof LIQUID
