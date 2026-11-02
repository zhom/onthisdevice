/** Ideal gas law PV = nRT in SI units, solved for any one value. Pure; the tests import it. */

/** Molar gas constant, J/(mol·K) (exact since the 2019 SI). */
export const R = 8.314462618

export type GasKey = 'P' | 'V' | 'n' | 'T'

export interface Gas {
  /** Pa */
  P: number
  /** m³ */
  V: number
  /** mol */
  n: number
  /** K */
  T: number
}

/** Fill in the missing value from the other three. */
export function solveGas(key: GasKey, k: Partial<Gas>): Gas {
  const { P = 0, V = 0, n = 0, T = 0 } = k
  switch (key) {
    case 'P':
      return { P: (n * R * T) / V, V, n, T }
    case 'V':
      return { P, V: (n * R * T) / P, n, T }
    case 'n':
      return { P, V, n: (P * V) / (R * T), T }
    case 'T':
      return { P, V, n, T: (P * V) / (n * R) }
  }
}

export const PRESSURE = {
  Pa: 1,
  kPa: 1000,
  atm: 101325,
  bar: 100000,
  mmHg: 133.322387415,
  psi: 6894.757293168,
} as const
export type PressureUnit = keyof typeof PRESSURE

export const GAS_VOLUME = {
  mL: 1e-6,
  L: 0.001,
  'm³': 1,
  'ft³': 0.028316846592,
} as const
export type GasVolumeUnit = keyof typeof GAS_VOLUME

export type TempUnit = 'K' | '°C' | '°F'

export function toKelvin(v: number, u: TempUnit): number {
  return u === 'K' ? v : u === '°C' ? v + 273.15 : ((v - 32) * 5) / 9 + 273.15
}

export function fromKelvin(k: number, u: TempUnit): number {
  return u === 'K' ? k : u === '°C' ? k - 273.15 : ((k - 273.15) * 9) / 5 + 32
}
