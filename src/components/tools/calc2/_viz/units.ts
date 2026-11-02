/**
 * Unit factors to SI for the calc2 calculators (exact where defined).
 * Pure; the tests import it. Use `toSI(value, table[unit])`.
 */

export const LENGTH = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
} as const
export type LengthUnit = keyof typeof LENGTH

export const AREA = {
  'mm²': 1e-6,
  'cm²': 1e-4,
  'm²': 1,
  'in²': 0.00064516,
  'ft²': 0.09290304,
  'yd²': 0.83612736,
} as const
export type AreaUnit = keyof typeof AREA

export const VOLUME = {
  'cm³': 1e-6,
  mL: 1e-6,
  L: 0.001,
  'm³': 1,
  'in³': 0.000016387064,
  'ft³': 0.028316846592,
  'yd³': 0.764554857984,
  'US gal': 0.003785411784,
  'UK gal': 0.00454609,
} as const
export type VolumeUnit = keyof typeof VOLUME

export const MASS = {
  mg: 1e-6,
  g: 0.001,
  kg: 1,
  t: 1000,
  oz: 0.028349523125,
  lb: 0.45359237,
} as const
export type MassUnit = keyof typeof MASS

export const SPEED = {
  'm/s': 1,
  'km/h': 1 / 3.6,
  mph: 0.44704,
  'ft/s': 0.3048,
  kn: 1852 / 3600,
} as const
export type SpeedUnit = keyof typeof SPEED

export const TIME = {
  s: 1,
  min: 60,
  h: 3600,
  d: 86400,
  yr: 31557600,
} as const
export type TimeUnit = keyof typeof TIME

export const ENERGY = {
  J: 1,
  kJ: 1000,
  cal: 4.184,
  kcal: 4184,
  Wh: 3600,
  kWh: 3.6e6,
  BTU: 1055.05585262,
} as const
export type EnergyUnit = keyof typeof ENERGY

export function toSI(v: number, factor: number): number {
  return v * factor
}

export function fromSI(v: number, factor: number): number {
  return v / factor
}

/** Options for a <UnitField>: the listed units of a factor table. */
export function unitOptions<T extends Record<string, number>, K extends keyof T & string>(_table: T, only: readonly K[]): { value: K; label: string }[] {
  return only.map((k) => ({ value: k, label: k }))
}
