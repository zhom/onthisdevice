/**
 * All unit pair pages: the quantities, their units and the pairs, resolved into lookups.
 * Used at build time by the registry and the page component. The island gets only the
 * serialisable `PairProps` built here.
 */
import type { UnitLite } from './engine'
import type { PairTuple, QuantityId, QuantitySpec, UnitSpec } from './types'
import { length } from './quantities/length'
import { mass } from './quantities/mass'
import { volume } from './quantities/volume'
import { area, speed, temperature } from './quantities/area-speed-temp'
import { data, energy } from './quantities/data-energy'
import { power, pressure } from './quantities/power-pressure'
import { angle, time } from './quantities/time-angle'
import { flow, force, frequency, fuel, light, torque } from './quantities/other'

export const QUANTITIES: QuantitySpec[] = [
  length,
  mass,
  volume,
  area,
  speed,
  temperature,
  data,
  energy,
  power,
  pressure,
  time,
  angle,
  fuel,
  force,
  torque,
  flow,
  frequency,
  light,
]

export interface UnitPair {
  slug: string
  quantity: QuantitySpec
  from: UnitSpec
  to: UnitSpec
  keywords: string[]
  title: string
}

/**
 * Pair pages that exist already as files in src/pages, by quantity and unit ids. They are
 * linked as reverse and related pages, and never registered again here.
 */
const EXISTING: [string, QuantityId, string, string][] = [
  ['cm-to-inches', 'length', 'cm', 'in'],
  ['inches-to-cm', 'length', 'in', 'cm'],
  ['mm-to-inches', 'length', 'mm', 'in'],
  ['inches-to-mm', 'length', 'in', 'mm'],
  ['feet-to-meters', 'length', 'ft', 'm'],
  ['meters-to-feet', 'length', 'm', 'ft'],
  ['km-to-miles', 'length', 'km', 'mi'],
  ['miles-to-km', 'length', 'mi', 'km'],
  ['yards-to-meters', 'length', 'yd', 'm'],
  ['kg-to-lbs', 'mass', 'kg', 'lb'],
  ['lbs-to-kg', 'mass', 'lb', 'kg'],
  ['grams-to-ounces', 'mass', 'g', 'oz'],
  ['ounces-to-grams', 'mass', 'oz', 'g'],
  ['kg-to-stone', 'mass', 'kg', 'st'],
  ['stone-to-pounds', 'mass', 'st', 'lb'],
  ['celsius-to-fahrenheit', 'temperature', 'c', 'f'],
  ['fahrenheit-to-celsius', 'temperature', 'f', 'c'],
  ['celsius-to-kelvin', 'temperature', 'c', 'k'],
  ['ml-to-cups', 'volume', 'ml', 'cup'],
  ['oz-to-cups', 'volume', 'floz', 'cup'],
  ['tablespoons-to-cups', 'volume', 'tbsp', 'cup'],
]

function resolve(q: QuantitySpec, [slug, fromId, toId, keywords, title]: PairTuple): UnitPair {
  const from = q.units.find((u) => u.id === fromId)
  const to = q.units.find((u) => u.id === toId)
  if (!from || !to) throw new Error(`[convert] ${slug}: unknown unit ${from ? toId : fromId} in ${q.id}`)
  return { slug, quantity: q, from, to, keywords: keywords ?? [], title: title ?? `${from.label} to ${to.label}` }
}

export const UNIT_PAIRS: UnitPair[] = QUANTITIES.flatMap((q) => q.pairs.map((p) => resolve(q, p)))

export const UNIT_PAIR_BY_SLUG: Map<string, UnitPair> = new Map(UNIT_PAIRS.map((p) => [p.slug, p]))

/** Every pair page, new or existing, as "quantity:from:to" → slug. */
const PAGE_FOR = new Map<string, string>([
  ...EXISTING.map(([slug, q, a, b]) => [`${q}:${a}:${b}`, slug] as [string, string]),
  ...UNIT_PAIRS.map((p) => [`${p.quantity.id}:${p.from.id}:${p.to.id}`, p.slug] as [string, string]),
])

export function pageFor(q: QuantityId, from: string, to: string): string | undefined {
  return PAGE_FOR.get(`${q}:${from}:${to}`)
}

/** The pitfalls that concern this pair: untagged ones and those that name one of its units. */
export function pitfallsFor(pair: UnitPair): string[] {
  return pair.quantity.pitfalls.flatMap((p) => {
    if (typeof p === 'string') return [p]
    return p.units.includes(pair.from.id) || p.units.includes(pair.to.id) ? [p.text] : []
  })
}

/** Reverse page, then pairs that share a unit, then the all-units converter. */
export function relatedSlugs(pair: UnitPair, limit = 6): string[] {
  const out: string[] = []
  const push = (slug: string | undefined) => {
    if (slug && slug !== pair.slug && !out.includes(slug)) out.push(slug)
  }
  const q = pair.quantity.id
  push(pageFor(q, pair.to.id, pair.from.id))
  const all = [...EXISTING.map(([slug, qq, a, b]) => ({ slug, q: qq, a, b })), ...UNIT_PAIRS.map((p) => ({ slug: p.slug, q: p.quantity.id, a: p.from.id, b: p.to.id }))]
  for (const p of all) if (p.q === q && p.a === pair.from.id) push(p.slug)
  for (const p of all) if (p.q === q && p.b === pair.to.id) push(p.slug)
  const result = out.slice(0, limit - (pair.quantity.converter ? 1 : 0))
  if (pair.quantity.converter) result.push(pair.quantity.converter)
  return result
}

/* ------------------------------------------------------------------ *
 * Island props
 * ------------------------------------------------------------------ */

/** A readout that splits the value into whole parts: 5 ft 8 in, 1 h 30 min, 12° 30′. */
export interface MixedSpec {
  label: string
  /** The unit the first part counts in. */
  unit: UnitLite
  steps: number[]
  symbols: string[]
  decimals: number
}

export interface PairProps {
  slug: string
  quantity: QuantityId
  quantityName: string
  from: UnitLite
  to: UnitLite
  also: UnitLite[]
  dflt: string
  table: number[]
  reverse: { slug: string; label: string } | null
  binary: boolean
  mixed: MixedSpec | null
}

export function lite(u: UnitSpec): UnitLite {
  const out: UnitLite = { id: u.id, name: u.name, plural: u.plural, symbol: u.symbol, factor: u.factor }
  if (u.offset) out.offset = u.offset
  if (u.inverse) out.inverse = true
  if (u.binaryFactor) out.binaryFactor = u.binaryFactor
  return out
}

function unit(q: QuantitySpec, id: string): UnitSpec {
  const u = q.units.find((x) => x.id === id)
  if (!u) throw new Error(`[convert] no unit ${id} in ${q.id}`)
  return u
}

function mixedFor(pair: UnitPair): MixedSpec | null {
  const q = pair.quantity
  const ids = [pair.from.id, pair.to.id]
  const has = (...list: string[]) => ids.some((id) => list.includes(id))
  if (q.id === 'length' && has('in', 'ft', 'cm', 'm', 'mm') && !has('mi', 'km', 'nmi', 'um', 'mil')) {
    return { label: 'Feet and inches', unit: lite(unit(q, 'ft')), steps: [12], symbols: ['ft', 'in'], decimals: 2 }
  }
  if (q.id === 'mass' && has('st')) {
    return { label: 'Stone and pounds', unit: lite(unit(q, 'st')), steps: [14], symbols: ['st', 'lb'], decimals: 1 }
  }
  if (q.id === 'mass' && has('lb', 'oz') && !has('ton', 't')) {
    return { label: 'Pounds and ounces', unit: lite(unit(q, 'lb')), steps: [16], symbols: ['lb', 'oz'], decimals: 2 }
  }
  if (q.id === 'time') {
    return {
      label: 'Days, hours, minutes and seconds',
      unit: lite(unit(q, 'd')),
      steps: [24, 60, 60],
      symbols: ['d', 'h', 'min', 's'],
      decimals: 3,
    }
  }
  if (q.id === 'angle' && has('deg')) {
    return { label: 'Degrees, minutes and seconds', unit: lite(unit(q, 'deg')), steps: [60, 60], symbols: ['°', '′', '″'], decimals: 2 }
  }
  return null
}

export function pairProps(pair: UnitPair): PairProps {
  const q = pair.quantity
  const reverseSlug = pageFor(q.id, pair.to.id, pair.from.id)
  const reversePair = reverseSlug ? UNIT_PAIR_BY_SLUG.get(reverseSlug) : undefined
  return {
    slug: pair.slug,
    quantity: q.id,
    quantityName: q.name,
    from: lite(pair.from),
    to: lite(pair.to),
    also: q.also
      .filter((id) => id !== pair.from.id && id !== pair.to.id)
      .slice(0, 4)
      .map((id) => lite(unit(q, id))),
    dflt: pair.from.dflt ?? '1',
    table: pair.from.table ?? q.table,
    reverse: reverseSlug
      ? { slug: reverseSlug, label: reversePair ? reversePair.title : `${pair.to.label} to ${pair.from.label}` }
      : null,
    binary: q.binary === true && Boolean(pair.from.binaryFactor || pair.to.binaryFactor),
    mixed: mixedFor(pair),
  }
}
