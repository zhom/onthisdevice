/**
 * US federal tax rules for tax year 2026: IRS Revenue Procedure 2025-32 (brackets, standard
 * deduction, capital gains thresholds) and the SSA 2026 wage base. Pure; the tests import it.
 */
import { D, cents } from '../engine/money'

export type Status = 'single' | 'mfj' | 'hoh' | 'mfs'

export const STATUS_OPTIONS = [
  ['single', 'Single'],
  ['mfj', 'Married filing jointly'],
  ['hoh', 'Head of household'],
  ['mfs', 'Married filing separately'],
] as const

const RATES = [10, 12, 22, 24, 32, 35, 37]

/** Upper edge of each bracket below the top one. */
export const BRACKETS_2026: Record<Status, number[]> = {
  single: [12400, 50400, 105700, 201775, 256225, 640600],
  mfj: [24800, 100800, 211400, 403550, 512450, 768700],
  hoh: [17700, 67450, 105700, 201750, 256200, 640600],
  mfs: [12400, 50400, 105700, 201775, 256225, 384350],
}

export const STANDARD_2026: Record<Status, number> = { single: 16100, mfj: 32200, hoh: 24150, mfs: 16100 }

/** Taxable income where the 0% and 15% long-term capital gains rates end. */
export const CG_2026: Record<Status, [number, number]> = {
  single: [49450, 545500],
  mfj: [98900, 613700],
  hoh: [66200, 579600],
  mfs: [49450, 306850],
}

export const SS_WAGE_BASE_2026 = 184500
export const SS_RATE = 6.2
export const MEDICARE_RATE = 1.45
/** Additional Medicare tax and net investment income tax thresholds (not indexed). */
export const ADDL_MEDICARE: Record<Status, number> = { single: 200000, mfj: 250000, hoh: 200000, mfs: 125000 }
export const NIIT: Record<Status, number> = { single: 200000, mfj: 250000, hoh: 200000, mfs: 125000 }

export interface BracketPart {
  rate: number
  from: number
  to: number
  amount: number
  tax: number
}

/** Tax on taxable income by the 2026 brackets, with the amount taxed at each rate. */
export function incomeTax(taxable: number, status: Status): { tax: number; parts: BracketPart[]; marginal: number } {
  const edges = BRACKETS_2026[status]
  const parts: BracketPart[] = []
  let total = D(0)
  let marginal = RATES[0]!
  let from = 0
  for (let k = 0; k < RATES.length; k++) {
    const to = edges[k] ?? Infinity
    const amount = Math.max(0, Math.min(taxable, to) - from)
    const t = D(amount).times(RATES[k]!).div(100)
    parts.push({ rate: RATES[k]!, from, to, amount, tax: cents(t) })
    total = total.plus(t)
    if (taxable > from) marginal = RATES[k]!
    from = to
  }
  return { tax: cents(total), parts, marginal }
}

/** Employee Social Security and Medicare on wages, with the additional 0.9% Medicare. */
export function fica(wages: number, status: Status) {
  const ss = cents(D(Math.min(wages, SS_WAGE_BASE_2026)).times(SS_RATE).div(100))
  const medicare = cents(D(wages).times(MEDICARE_RATE).div(100))
  const addl = cents(D(Math.max(0, wages - ADDL_MEDICARE[status])).times(0.9).div(100))
  return { ss, medicare, addl, total: cents(D(ss).plus(medicare).plus(addl)) }
}

/** Self-employment tax on net profit (Schedule SE). */
export function seTax(profit: number, wages: number, status: Status) {
  const base = cents(D(profit).times(0.9235))
  if (base < 400) return { base, ss: 0, medicare: 0, addl: 0, total: 0, deduction: 0 }
  const room = Math.max(0, SS_WAGE_BASE_2026 - wages)
  const ss = cents(D(Math.min(base, room)).times(12.4).div(100))
  const medicare = cents(D(base).times(2.9).div(100))
  const addl = cents(D(Math.max(0, base - Math.max(0, ADDL_MEDICARE[status] - wages))).times(0.9).div(100))
  const deduction = cents(D(ss).plus(medicare).div(2))
  return { base, ss, medicare, addl, total: cents(D(ss).plus(medicare).plus(addl)), deduction }
}

/** Federal tax on a gain stacked on top of other taxable income. */
export function gainTax(ordinary: number, gain: number, status: Status, longTerm: boolean) {
  if (!longTerm) {
    const tax = cents(D(incomeTax(ordinary + gain, status).tax).minus(incomeTax(ordinary, status).tax))
    return { tax, at0: 0, at15: 0, at20: 0, ordinaryPart: gain }
  }
  const [t0, t15] = CG_2026[status]
  const top = ordinary + gain
  const at0 = Math.max(0, Math.min(top, t0) - ordinary)
  const at15 = Math.max(0, Math.min(top, t15) - Math.max(ordinary, t0))
  const at20 = Math.max(0, gain - at0 - at15)
  const tax = cents(D(at15).times(0.15).plus(D(at20).times(0.2)))
  return { tax, at0, at15, at20, ordinaryPart: 0 }
}

export const STATUS_NAME: Record<Status, string> = { single: 'single', mfj: 'married filing jointly', hoh: 'head of household', mfs: 'married filing separately' }

export const asStatus = (v: string | undefined): Status => (v === 'mfj' || v === 'hoh' || v === 'mfs' ? v : 'single')
