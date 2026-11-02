/** Gravel and mulch volumes for a bed of a given area and depth. Pure; the tests import it. */

export type BedShape = 'rect' | 'circle'

export const FT3_M3 = 0.028316846592
export const YD3_M3 = 0.764554857984
export const SHORT_TON_KG = 907.18474

/** Plan area of a bed: length × width, or π r² from a diameter. Same unit squared. */
export function bedArea(shape: BedShape, a: number, b: number): number {
  return shape === 'circle' ? Math.PI * (a / 2) ** 2 : a * b
}

export interface BedVolume {
  m3: number
  ft3: number
  yd3: number
}

/** Volume from a plan area in m² and a depth in m. */
export function bedVolume(areaM2: number, depthM: number): BedVolume {
  const m3 = areaM2 * depthM
  return { m3, ft3: m3 / FT3_M3, yd3: m3 / YD3_M3 }
}

export interface Material {
  value: string
  label: string
  /** Loose, dry bulk density in kg/m³ (typical; suppliers vary). */
  density: number
}

export const AGGREGATES: Material[] = [
  { value: 'gravel', label: 'Gravel, pea or crushed', density: 1680 },
  { value: 'river', label: 'River rock', density: 1600 },
  { value: 'base', label: 'Road base, compacted', density: 2080 },
  { value: 'sand', label: 'Sand, dry', density: 1600 },
  { value: 'topsoil', label: 'Topsoil', density: 1280 },
]

export interface Weight {
  kg: number
  /** US short tons (2,000 lb). */
  tons: number
  /** Metric tonnes. */
  tonnes: number
}

export function weightOf(m3: number, density: number): Weight {
  const kg = m3 * density
  return { kg, tons: kg / SHORT_TON_KG, tonnes: kg / 1000 }
}

export interface Bag {
  value: string
  label: string
  /** Bag volume in m³. */
  m3: number
}

export const MULCH_BAGS: Bag[] = [
  { value: '2ft', label: '2 ft³ bag', m3: 2 * FT3_M3 },
  { value: '3ft', label: '3 ft³ bag', m3: 3 * FT3_M3 },
  { value: '40l', label: '40 L bag', m3: 0.04 },
  { value: '50l', label: '50 L bag', m3: 0.05 },
]

/** Whole bags to cover a volume. A tiny tolerance keeps 12.0000001 at 12. */
export function bagsFor(volumeM3: number, bagM3: number): number {
  return Math.ceil(volumeM3 / bagM3 - 1e-9)
}
