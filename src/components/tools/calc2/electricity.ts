/** Electricity cost of appliances, and the meter disc speed for a load. Pure; the tests import it. */

export interface Appliance {
  watts: number
  /** Hours of use per day. */
  hours: number
  quantity: number
}

export interface ApplianceCost {
  kwhDay: number
  kwhPeriod: number
  costDay: number
  costPeriod: number
  costYear: number
}

/** kWh = W × h × quantity ÷ 1000; cost = kWh × price. `days` is the billing period. */
export function applianceCost(a: Appliance, days: number, price: number): ApplianceCost {
  const kwhDay = (a.watts * a.hours * a.quantity) / 1000
  return {
    kwhDay,
    kwhPeriod: kwhDay * days,
    costDay: kwhDay * price,
    costPeriod: kwhDay * days * price,
    costYear: kwhDay * 365 * price,
  }
}

export function totalCost(list: Appliance[], days: number, price: number): ApplianceCost {
  const sum: ApplianceCost = { kwhDay: 0, kwhPeriod: 0, costDay: 0, costPeriod: 0, costYear: 0 }
  for (const a of list) {
    const c = applianceCost(a, days, price)
    sum.kwhDay += c.kwhDay
    sum.kwhPeriod += c.kwhPeriod
    sum.costDay += c.costDay
    sum.costPeriod += c.costPeriod
    sum.costYear += c.costYear
  }
  return sum
}

/** Watt-hours per disc revolution of a common US single-phase meter (Kh). */
export const KH = 7.2

/** Disc revolutions per second for a load in watts: W ÷ (Kh × 3600). */
export function discRevPerSecond(watts: number, kh = KH): number {
  return watts / (kh * 3600)
}
