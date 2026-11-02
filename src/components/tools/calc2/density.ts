/** Density ρ = m / V solved for any one value, and common materials. Pure; the tests import it. */

export function density(m: number, V: number): number {
  return m / V
}

export function massOf(rho: number, V: number): number {
  return rho * V
}

export function volumeOf(m: number, rho: number): number {
  return m / rho
}

/** Fraction of a floating body under the surface: ρ_body ÷ ρ_fluid, capped at 1 (it sinks). */
export function submerged(rho: number, fluid: number): number {
  return Math.min(1, rho / fluid)
}

/** Typical densities in kg/m³ near room temperature. */
export const MATERIALS: { id: string; label: string; rho: number }[] = [
  { id: 'air', label: 'Air (20 °C, sea level)', rho: 1.204 },
  { id: 'cork', label: 'Cork', rho: 240 },
  { id: 'pine', label: 'Pine wood', rho: 500 },
  { id: 'oak', label: 'Oak wood', rho: 750 },
  { id: 'ethanol', label: 'Ethanol', rho: 789 },
  { id: 'olive-oil', label: 'Olive oil', rho: 911 },
  { id: 'ice', label: 'Ice', rho: 917 },
  { id: 'hdpe', label: 'Polyethylene (HDPE)', rho: 955 },
  { id: 'water', label: 'Water (4 °C)', rho: 1000 },
  { id: 'seawater', label: 'Seawater', rho: 1025 },
  { id: 'concrete', label: 'Concrete', rho: 2400 },
  { id: 'glass', label: 'Glass', rho: 2500 },
  { id: 'aluminium', label: 'Aluminium', rho: 2700 },
  { id: 'steel', label: 'Steel', rho: 7850 },
  { id: 'iron', label: 'Iron', rho: 7874 },
  { id: 'copper', label: 'Copper', rho: 8960 },
  { id: 'silver', label: 'Silver', rho: 10490 },
  { id: 'lead', label: 'Lead', rho: 11340 },
  { id: 'mercury', label: 'Mercury', rho: 13534 },
  { id: 'gold', label: 'Gold', rho: 19300 },
]

/** Density units to kg/m³. */
export const DENSITY = {
  'kg/m³': 1,
  'g/cm³': 1000,
  'g/mL': 1000,
  'kg/L': 1000,
  'lb/ft³': 16.01846337396,
  'lb/in³': 27679.9047102,
} as const
export type DensityUnit = keyof typeof DENSITY
