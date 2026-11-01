import Decimal from 'decimal.js'

/* Plenty of headroom for 600-period schedules and compounded growth. */
Decimal.set({ precision: 40, toExpNeg: -30, toExpPos: 40 })

export { Decimal }

/** Shorthand constructor. */
export function d(value: Decimal.Value): Decimal {
  return new Decimal(value)
}

export const ZERO = new Decimal(0)

/* ────────────────────────────── currencies ────────────────────────────── */

export interface CurrencyOption {
  code: string
  name: string
  symbol: string
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', name: 'US dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian dollar', symbol: 'A$' },
  { code: 'INR', name: 'Indian rupee', symbol: '₹' },
  { code: 'JPY', name: 'Japanese yen', symbol: '¥' },
]

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

/** Currencies whose minor unit is not 1/100. */
export function currencyDecimals(code: string): number {
  return code === 'JPY' ? 0 : 2
}

/* ────────────────────────────── parsing ────────────────────────────── */

/**
 * Parse a free-typed numeric field. Tolerates thousands separators, currency
 * symbols, spaces and a trailing decimal point ("1,250." while still typing).
 */
export function toNum(input: string | number, fallback = 0): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : fallback
  const cleaned = input.replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') return fallback
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : fallback
}

/** Same as `toNum` but never negative — most money inputs cannot be. */
export function toPositive(input: string | number, fallback = 0): number {
  return Math.max(0, toNum(input, fallback))
}

/* ────────────────────────────── rates ────────────────────────────── */

export type CompoundFrequency =
  | 'annually'
  | 'semiannually'
  | 'quarterly'
  | 'monthly'
  | 'semimonthly'
  | 'biweekly'
  | 'weekly'
  | 'daily'

export const COMPOUND_FREQUENCIES: { value: CompoundFrequency; label: string; perYear: number }[] = [
  { value: 'annually', label: 'Annually (1×/yr)', perYear: 1 },
  { value: 'semiannually', label: 'Semi-annually (2×/yr)', perYear: 2 },
  { value: 'quarterly', label: 'Quarterly (4×/yr)', perYear: 4 },
  { value: 'monthly', label: 'Monthly (12×/yr)', perYear: 12 },
  { value: 'semimonthly', label: 'Semi-monthly (24×/yr)', perYear: 24 },
  { value: 'biweekly', label: 'Bi-weekly (26×/yr)', perYear: 26 },
  { value: 'weekly', label: 'Weekly (52×/yr)', perYear: 52 },
  { value: 'daily', label: 'Daily (365×/yr)', perYear: 365 },
]

export function periodsPerYear(freq: CompoundFrequency): number {
  return COMPOUND_FREQUENCIES.find((f) => f.value === freq)?.perYear ?? 12
}

/** Annual nominal rate in percent → the periodic rate as a Decimal fraction. */
export function periodicRate(annualPct: number, perYear: number): Decimal {
  return d(annualPct).div(100).div(perYear)
}

/** Effective annual rate for a nominal rate compounded `m` times a year. */
export function effectiveAnnualRate(annualPct: number, perYear: number): Decimal {
  const i = periodicRate(annualPct, perYear)
  return d(1).plus(i).pow(perYear).minus(1)
}

/* ────────────────────────────── dates ────────────────────────────── */

export function addMonths(date: Date, months: number): Date {
  const out = new Date(date.getTime())
  const targetDay = out.getDate()
  out.setDate(1)
  out.setMonth(out.getMonth() + months)
  const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate()
  out.setDate(Math.min(targetDay, lastDay))
  return out
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', day: 'numeric' })
}

/** 41 → "3 yr 5 mo" */
export function formatMonths(totalMonths: number): string {
  if (!Number.isFinite(totalMonths) || totalMonths <= 0) return '0 months'
  const whole = Math.round(totalMonths)
  const years = Math.floor(whole / 12)
  const months = whole % 12
  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`)
  if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`)
  return parts.length ? parts.join(' ') : '0 months'
}

/* ────────────────────────── amortisation engine ────────────────────────── */

export interface ScheduleRow {
  /** 1-based payment number. */
  n: number
  date: Date
  payment: number
  interest: number
  principal: number
  extra: number
  balance: number
  cumInterest: number
  cumPrincipal: number
}

export interface YearRow {
  year: number
  payments: number
  interest: number
  principal: number
  extra: number
  endingBalance: number
}

export interface AmortInput {
  principal: number
  /** Nominal annual rate, in percent. */
  annualRatePct: number
  /** Total scheduled number of monthly payments. */
  months: number
  /** Additional principal paid every month. */
  extraMonthly?: number
  /** One-off extra principal applied with the first payment. */
  extraOneOff?: number
  startDate?: Date
}

export interface AmortResult {
  /** Scheduled principal + interest payment, rounded to the minor unit. */
  monthlyPayment: number
  rows: ScheduleRow[]
  totalInterest: number
  totalPrincipal: number
  totalPaid: number
  monthsToPayoff: number
  payoffDate: Date
  /** True when the payment cannot cover the interest, so the balance never falls. */
  neverAmortises: boolean
}

/**
 * Level monthly payment for an amortising loan.
 *   M = P · i / (1 − (1 + i)^−n)
 * With i = 0 this degenerates to P / n.
 */
export function monthlyPaymentDecimal(principal: number, annualRatePct: number, months: number): Decimal {
  const P = d(principal)
  const n = Math.max(1, Math.round(months))
  if (annualRatePct === 0) return P.div(n)
  const i = d(annualRatePct).div(100).div(12)
  const factor = d(1).minus(d(1).plus(i).pow(-n))
  if (factor.isZero()) return P.div(n)
  return P.times(i).div(factor)
}

/** Build a full month-by-month amortisation schedule. */
export function buildAmortization(input: AmortInput): AmortResult {
  const startDate = input.startDate ?? new Date()
  const months = Math.max(1, Math.min(1200, Math.round(input.months)))
  const principal = Math.max(0, input.principal)
  const extraMonthly = Math.max(0, input.extraMonthly ?? 0)
  const extraOneOff = Math.max(0, input.extraOneOff ?? 0)

  const payment = monthlyPaymentDecimal(principal, input.annualRatePct, months).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  )

  const empty: AmortResult = {
    monthlyPayment: payment.toNumber(),
    rows: [],
    totalInterest: 0,
    totalPrincipal: 0,
    totalPaid: 0,
    monthsToPayoff: 0,
    payoffDate: startDate,
    neverAmortises: false,
  }
  if (principal <= 0) return empty

  const i = d(input.annualRatePct).div(100).div(12)
  const firstInterest = d(principal).times(i)
  if (payment.plus(extraMonthly).lte(firstInterest) && !i.isZero()) {
    return { ...empty, neverAmortises: true }
  }

  const rows: ScheduleRow[] = []
  let balance = d(principal)
  let cumInterest = ZERO
  let cumPrincipal = ZERO
  let n = 0

  while (balance.gt(0) && n < months + 600) {
    n += 1
    const interest = balance.times(i).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    let scheduledPrincipal = payment.minus(interest)
    let extra = d(extraMonthly).plus(n === 1 ? extraOneOff : 0)

    // The level payment is rounded to the cent, which leaves a few dollars
    // outstanding after the final scheduled payment. Lenders absorb that in the
    // last instalment rather than adding a 361st one, so we do the same.
    if (n >= months) {
      scheduledPrincipal = balance
      extra = ZERO
    } else if (scheduledPrincipal.gte(balance)) {
      // Final payment: pay exactly what is left.
      scheduledPrincipal = balance
      extra = ZERO
    } else if (scheduledPrincipal.plus(extra).gte(balance)) {
      extra = balance.minus(scheduledPrincipal)
    }

    const principalPaid = scheduledPrincipal.plus(extra)
    balance = balance.minus(principalPaid)
    if (balance.abs().lt(0.005)) balance = ZERO

    cumInterest = cumInterest.plus(interest)
    cumPrincipal = cumPrincipal.plus(principalPaid)

    rows.push({
      n,
      date: addMonths(startDate, n),
      payment: scheduledPrincipal.plus(interest).plus(extra).toNumber(),
      interest: interest.toNumber(),
      principal: scheduledPrincipal.toNumber(),
      extra: extra.toNumber(),
      balance: balance.toNumber(),
      cumInterest: cumInterest.toNumber(),
      cumPrincipal: cumPrincipal.toNumber(),
    })
  }

  return {
    monthlyPayment: payment.toNumber(),
    rows,
    totalInterest: cumInterest.toNumber(),
    totalPrincipal: cumPrincipal.toNumber(),
    totalPaid: cumInterest.plus(cumPrincipal).toNumber(),
    monthsToPayoff: rows.length,
    payoffDate: rows.length ? rows[rows.length - 1]!.date : startDate,
    neverAmortises: false,
  }
}

/** Collapse a monthly schedule into calendar-year totals. */
export function aggregateByYear(rows: ScheduleRow[]): YearRow[] {
  const map = new Map<number, YearRow>()
  for (const row of rows) {
    const year = row.date.getFullYear()
    const entry = map.get(year) ?? {
      year,
      payments: 0,
      interest: 0,
      principal: 0,
      extra: 0,
      endingBalance: 0,
    }
    entry.payments += 1
    entry.interest += row.interest
    entry.principal += row.principal
    entry.extra += row.extra
    entry.endingBalance = row.balance
    map.set(year, entry)
  }
  return [...map.values()].sort((a, b) => a.year - b.year)
}

/* ────────────────────────────── future value ────────────────────────────── */

export interface GrowthInput {
  principal: number
  /** Deposit added each contribution period. */
  contribution: number
  contributionsPerYear: number
  /** Deposit at the start of each period rather than the end. */
  contributeAtStart?: boolean
  annualRatePct: number
  compoundsPerYear: number
  years: number
}

export interface GrowthYear {
  year: number
  startBalance: number
  contributions: number
  interest: number
  endBalance: number
  cumContributions: number
  cumInterest: number
}

export interface GrowthResult {
  futureValue: number
  totalContributions: number
  totalInterest: number
  totalDeposited: number
  years: GrowthYear[]
}

/**
 * Growth rate applied over one contribution period, derived from a nominal
 * annual rate compounded `m` times a year:
 *
 *   r_step = (1 + rate/100/m)^(m/c) − 1
 *
 * When m is a multiple of c this is exactly the compounded growth between two
 * deposits; otherwise it is the standard fractional-compounding equivalent.
 */
export function ratePerContribution(
  annualRatePct: number,
  compoundsPerYear: number,
  contributionsPerYear: number,
): Decimal {
  const m = Math.max(1, Math.round(compoundsPerYear))
  const c = Math.max(1, Math.round(contributionsPerYear))
  const i = periodicRate(annualRatePct, m)
  if (i.isZero()) return ZERO
  return d(1).plus(i).pow(d(m).div(c)).minus(1)
}

/**
 * Year-by-year growth with periodic compounding and periodic deposits.
 * The timeline advances one contribution period at a time; compounding that
 * happens more often than deposits is folded into the per-period growth rate,
 * which keeps a 100-year daily-compounding projection instant.
 */
export function buildGrowth(input: GrowthInput): GrowthResult {
  const years = Math.max(0, Math.min(120, Math.round(input.years)))
  const m = Math.max(1, Math.round(input.compoundsPerYear))
  const deposit = d(Math.max(0, input.contribution))
  // With no deposits the step grid is irrelevant to the result, so use the
  // cheapest one that still compounds correctly.
  const c = deposit.isZero() ? 1 : Math.max(1, Math.round(input.contributionsPerYear))
  const stepRate = ratePerContribution(input.annualRatePct, m, c)

  let balance = d(Math.max(0, input.principal))
  let cumContrib = ZERO
  let cumInterest = ZERO
  const out: GrowthYear[] = []

  for (let y = 1; y <= years; y++) {
    const startBalance = balance
    let yearContrib = ZERO
    let yearInterest = ZERO

    for (let s = 0; s < c; s++) {
      if (input.contributeAtStart && deposit.gt(0)) {
        balance = balance.plus(deposit)
        yearContrib = yearContrib.plus(deposit)
      }
      const interest = balance.times(stepRate)
      balance = balance.plus(interest)
      yearInterest = yearInterest.plus(interest)
      if (!input.contributeAtStart && deposit.gt(0)) {
        balance = balance.plus(deposit)
        yearContrib = yearContrib.plus(deposit)
      }
    }

    cumContrib = cumContrib.plus(yearContrib)
    cumInterest = cumInterest.plus(yearInterest)
    out.push({
      year: y,
      startBalance: startBalance.toNumber(),
      contributions: yearContrib.toNumber(),
      interest: yearInterest.toNumber(),
      endBalance: balance.toNumber(),
      cumContributions: cumContrib.toNumber(),
      cumInterest: cumInterest.toNumber(),
    })
  }

  return {
    futureValue: balance.toNumber(),
    totalContributions: cumContrib.toNumber(),
    totalInterest: cumInterest.toNumber(),
    totalDeposited: d(Math.max(0, input.principal)).plus(cumContrib).toNumber(),
    years: out,
  }
}

/* ────────────────────────────── CSV ────────────────────────────── */

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) lines.push(row.map(csvCell).join(','))
  return lines.join('\r\n')
}

/** Rounded to the minor unit and plain (no separators) so spreadsheets parse it. */
export function csvMoney(value: number, decimals = 2): string {
  return value.toFixed(decimals)
}
