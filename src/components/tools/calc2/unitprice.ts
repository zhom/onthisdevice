/** Unit price: price per gram, millilitre or item, to compare packs. Pure; the tests import it. */

/** Each unit in its base: grams, millilitres or items. */
export const UNITS = {
  g: { base: 'g', k: 1 },
  kg: { base: 'g', k: 1000 },
  oz: { base: 'g', k: 28.349523125 },
  lb: { base: 'g', k: 453.59237 },
  mL: { base: 'mL', k: 1 },
  L: { base: 'mL', k: 1000 },
  'fl oz': { base: 'mL', k: 29.5735295625 },
  gal: { base: 'mL', k: 3785.411784 },
  item: { base: 'item', k: 1 },
} as const
export type Unit = keyof typeof UNITS
export type Base = (typeof UNITS)[Unit]['base']

export interface Item {
  price: number
  qty: number
  unit: Unit
  /** Number of packs, each of qty. */
  count: number
}

/** Price per one base unit (per gram, per mL or per item). */
export function perBase(i: Item): number {
  return i.price / (i.qty * i.count * UNITS[i.unit].k)
}

/** Index of the cheapest item per unit, and each item's extra cost against it (0..). */
export function compare(items: Item[]): { best: number; extra: number[] } {
  const p = items.map(perBase)
  let best = 0
  p.forEach((v, i) => {
    if (v < p[best]!) best = i
  })
  return { best, extra: p.map((v) => v / p[best]! - 1) }
}
