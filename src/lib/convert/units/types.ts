import type { UnitLite } from './engine'

/** A unit with the prose its pages are built from. */
export interface UnitSpec extends UnitLite {
  /** Short label for titles: "MM", "Inches", "Kg". */
  label: string
  /** Exact definition in one or two sentences. */
  def: string
  /** Where the unit is used. */
  uses: string
  /** Typical values in this unit: [value, what]. */
  examples: [string, string][]
  /** Values for the reference table when this unit is the source. */
  table?: number[]
  /** Starting input when this unit is the source. */
  dflt?: string
}

export type QuantityId =
  | 'length'
  | 'mass'
  | 'volume'
  | 'area'
  | 'speed'
  | 'temperature'
  | 'data'
  | 'energy'
  | 'power'
  | 'pressure'
  | 'time'
  | 'angle'
  | 'fuel'
  | 'force'
  | 'torque'
  | 'flow'
  | 'frequency'
  | 'light'

/** [slug, from unit id, to unit id, extra search keywords, title when the unit labels are ambiguous] */
export type PairTuple = [string, string, string, string[]?, string?]

export type Pitfall = string | { text: string; units: string[] }

export interface QuantitySpec {
  id: QuantityId
  /** Lower case, for sentences: "length". */
  name: string
  /** lucide-react icon. */
  icon: string
  /** Slug of the existing all-units converter for this quantity, if any. */
  converter?: string
  /** One paragraph on how this quantity is measured. */
  intro: string
  /** Mistakes people make with these units. A pitfall with `units` shows only on pairs that use one of them. */
  pitfalls: Pitfall[]
  /** Fallback reference-table values. */
  table: number[]
  /** Units other than the pair shown under "Also equals". */
  also: string[]
  units: UnitSpec[]
  pairs: PairTuple[]
  /** The pages have a decimal/binary switch (data sizes). */
  binary?: boolean
}
