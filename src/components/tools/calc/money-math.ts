/**
 * Money math for the finance calculators in this folder. Pure functions, no
 * imports but decimal.js, so scripts/calc-test-money-body.mjs runs them in Node.
 * Money is computed in Decimal and returned as numbers rounded to cents where
 * a bank would round (payments, monthly interest).
 */
import Decimal from 'decimal.js'

const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 40 })
type Dv = Decimal.Value
const d = (v: Dv) => new Dec(v)
const cents = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

/** Finite number or the fallback. */
export function fin(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback
}

/* ── loans ──────────────────────────────────────────────────────── */

/** Level payment per period for a loan: P·i / (1 − (1 + i)^−n). */
export function levelPayment(principal: number, ratePerPeriod: number, periods: number): number {
  if (!(principal > 0) || !(periods > 0)) return 0
  const P = d(principal)
  const i = d(ratePerPeriod)
  if (i.isZero()) return cents(P.div(periods)).toNumber()
  const f = i.plus(1).pow(periods)
  return cents(P.times(i).times(f).div(f.minus(1))).toNumber()
}

/** Monthly payment for an annual percentage rate and a term in months. */
export function monthlyPayment(principal: number, annualPct: number, months: number): number {
  return levelPayment(principal, annualPct / 1200, Math.round(months))
}

export interface AmortRow {
  month: number
  payment: number
  interest: number
  principal: number
  extra: number
  balance: number
}

export interface AmortInput {
  principal: number
  annualPct: number
  months: number
  /** Scheduled payment; default the level payment for the term. */
  payment?: number
  extraMonthly?: number
  /** Added every 12th month. */
  extraYearly?: number
  lumpSum?: number
  /** Month number (1-based) of the lump sum. */
  lumpMonth?: number
}

export interface AmortResult {
  rows: AmortRow[]
  payment: number
  months: number
  totalInterest: number
  totalPaid: number
}

/** Month-by-month schedule. Interest is rounded to cents each month; the last payment clears the balance. */
export function amortize(input: AmortInput): AmortResult {
  const months = Math.max(0, Math.round(input.months))
  const pay = d(input.payment ?? monthlyPayment(input.principal, input.annualPct, months))
  const i = d(input.annualPct).div(1200)
  let bal = d(Math.max(0, input.principal))
  const rows: AmortRow[] = []
  let totalInterest = d(0)
  let totalPaid = d(0)
  const cap = Math.max(months, 1) * 4 + 1200
  for (let m = 1; bal.gt(0) && m <= cap; m++) {
    const interest = cents(bal.times(i))
    let scheduled = pay
    if (scheduled.lte(interest) && m > months) break
    let extra = d(input.extraMonthly ?? 0)
    if (input.extraYearly && m % 12 === 0) extra = extra.plus(input.extraYearly)
    if (input.lumpSum && (input.lumpMonth ?? 1) === m) extra = extra.plus(input.lumpSum)
    const owed = bal.plus(interest)
    // The last scheduled payment absorbs the rounding of the level payment.
    if (input.payment === undefined && m === months) scheduled = owed
    if (scheduled.gte(owed)) {
      scheduled = owed
      extra = d(0)
    } else if (scheduled.plus(extra).gt(owed)) {
      extra = owed.minus(scheduled)
    }
    const principalPart = scheduled.minus(interest)
    bal = bal.minus(principalPart).minus(extra)
    if (bal.lt(0.005)) bal = d(0)
    totalInterest = totalInterest.plus(interest)
    totalPaid = totalPaid.plus(scheduled).plus(extra)
    rows.push({
      month: m,
      payment: scheduled.toNumber(),
      interest: interest.toNumber(),
      principal: principalPart.toNumber(),
      extra: extra.toNumber(),
      balance: bal.toNumber(),
    })
  }
  return { rows, payment: pay.toNumber(), months: rows.length, totalInterest: totalInterest.toNumber(), totalPaid: totalPaid.toNumber() }
}

export interface YearSum {
  year: number
  interest: number
  principal: number
  balance: number
}

/** Sum a monthly schedule by year (principal includes extra payments). */
export function byYear(rows: AmortRow[]): YearSum[] {
  const out: YearSum[] = []
  for (const r of rows) {
    const y = Math.ceil(r.month / 12)
    let cur = out[out.length - 1]
    if (!cur || cur.year !== y) {
      cur = { year: y, interest: 0, principal: 0, balance: 0 }
      out.push(cur)
    }
    cur.interest = d(cur.interest).plus(r.interest).toNumber()
    cur.principal = d(cur.principal).plus(r.principal).plus(r.extra).toNumber()
    cur.balance = r.balance
  }
  return out
}

/** Balance left after `paid` level payments. */
export function balanceAfter(principal: number, annualPct: number, months: number, paid: number): number {
  const rows = amortize({ principal, annualPct, months }).rows
  if (paid <= 0) return principal
  return rows[Math.min(rows.length, paid) - 1]?.balance ?? 0
}

/* ── time value of money ───────────────────────────────────────── */

/** (1 + i)^n with Decimal. */
function growth(i: Dv, n: number): Decimal {
  return d(i).plus(1).pow(n)
}

/** Future value of a lump sum and level payments. `due` = payments at period start. */
export function futureValue(pv: number, ratePerPeriod: number, periods: number, pmt = 0, due = false): number {
  const i = d(ratePerPeriod)
  const g = growth(i, periods)
  const lump = d(pv).times(g)
  let ann: Decimal
  if (i.isZero()) ann = d(pmt).times(periods)
  else ann = d(pmt).times(g.minus(1).div(i))
  if (due) ann = ann.times(i.plus(1))
  return lump.plus(ann).toNumber()
}

/** Present value of a future sum and level payments. */
export function presentValue(fv: number, ratePerPeriod: number, periods: number, pmt = 0, due = false): number {
  const i = d(ratePerPeriod)
  const g = growth(i, periods)
  const lump = d(fv).div(g)
  let ann: Decimal
  if (i.isZero()) ann = d(pmt).times(periods)
  else ann = d(pmt).times(d(1).minus(d(1).div(g)).div(i))
  if (due) ann = ann.times(i.plus(1))
  return lump.plus(ann).toNumber()
}

/** Rate per period from a nominal annual rate compounded m times, for c payments a year. */
export function ratePerPayment(annualPct: number, compoundsPerYear: number, paymentsPerYear: number): number {
  const r = d(annualPct).div(100)
  if (compoundsPerYear === paymentsPerYear) return r.div(compoundsPerYear).toNumber()
  return r.div(compoundsPerYear).plus(1).pow(d(compoundsPerYear).div(paymentsPerYear)).minus(1).toNumber()
}

/** Annual percentage yield from a nominal rate compounded m times a year. */
export function apy(annualPct: number, compoundsPerYear: number): number {
  return d(annualPct).div(100).div(compoundsPerYear).plus(1).pow(compoundsPerYear).minus(1).times(100).toNumber()
}

/** Net present value. flows[0] is at time 0 (usually the negative investment). */
export function npv(ratePct: number, flows: number[]): number {
  const r = d(ratePct).div(100).plus(1)
  let sum = d(0)
  flows.forEach((cf, t) => {
    sum = sum.plus(d(cf).div(r.pow(t)))
  })
  return sum.toNumber()
}

/** Present value of each flow. */
export function discountedFlows(ratePct: number, flows: number[]): number[] {
  const r = d(ratePct).div(100).plus(1)
  return flows.map((cf, t) => d(cf).div(r.pow(t)).toNumber())
}

function npvFloat(rate: number, flows: number[]): number {
  let s = 0
  for (let t = 0; t < flows.length; t++) s += flows[t]! / Math.pow(1 + rate, t)
  return s
}

/**
 * Internal rates of return (as %): every rate between -99% and 1000% where
 * NPV crosses zero, found by a scan and bisection to 1e-12.
 */
export function irrAll(flows: number[]): number[] {
  if (!flows.some((f) => f > 0) || !flows.some((f) => f < 0)) return []
  const roots: number[] = []
  const grid: number[] = []
  for (let r = -0.99; r < 0.5; r += 0.0025) grid.push(r)
  for (let r = 0.5; r <= 10; r += 0.01) grid.push(r)
  let a = grid[0]!
  let fa = npvFloat(a, flows)
  for (let k = 1; k < grid.length; k++) {
    const b = grid[k]!
    const fb = npvFloat(b, flows)
    if (fa === 0) roots.push(a)
    else if (Number.isFinite(fa) && Number.isFinite(fb) && fa * fb < 0) {
      let lo = a
      let hi = b
      let flo = fa
      for (let it = 0; it < 200 && hi - lo > 1e-14; it++) {
        const mid = (lo + hi) / 2
        const fm = npvFloat(mid, flows)
        if (fm === 0) { lo = hi = mid; break }
        if (flo * fm < 0) hi = mid
        else { lo = mid; flo = fm }
      }
      roots.push((lo + hi) / 2)
    }
    a = b
    fa = fb
  }
  return roots.map((r) => r * 100)
}

/** The IRR nearest 10%, or null when NPV never crosses zero. */
export function irr(flows: number[]): number | null {
  const all = irrAll(flows)
  if (all.length === 0) return null
  return all.reduce((best, r) => (Math.abs(r - 10) < Math.abs(best - 10) ? r : best))
}

/** Modified IRR (as %), with a finance rate for negative flows and a reinvestment rate for positive ones. */
export function mirr(flows: number[], financePct: number, reinvestPct: number): number | null {
  const n = flows.length - 1
  if (n < 1) return null
  const fr = d(financePct).div(100).plus(1)
  const rr = d(reinvestPct).div(100).plus(1)
  let pvNeg = d(0)
  let fvPos = d(0)
  flows.forEach((cf, t) => {
    if (cf < 0) pvNeg = pvNeg.plus(d(cf).div(fr.pow(t)))
    else fvPos = fvPos.plus(d(cf).times(rr.pow(n - t)))
  })
  if (pvNeg.isZero() || fvPos.isZero()) return null
  return fvPos.div(pvNeg.neg()).pow(d(1).div(n)).minus(1).times(100).toNumber()
}

/** Years until the running total of flows turns non-negative, interpolated within the year. */
export function paybackYears(flows: number[]): number | null {
  let cum = flows[0] ?? 0
  if (cum >= 0) return 0
  for (let t = 1; t < flows.length; t++) {
    const prev = cum
    cum += flows[t]!
    if (cum >= 0) return t - 1 + -prev / (flows[t]! || 1)
  }
  return null
}

/** APR (%) of a loan: the rate at which the payments are worth the money you actually get. */
export function aprOf(netReceived: number, payment: number, months: number): number | null {
  if (!(netReceived > 0) || !(payment > 0) || !(months > 0)) return null
  if (payment * months < netReceived) return null
  const pvAt = (i: number) => (i === 0 ? payment * months : (payment * (1 - Math.pow(1 + i, -months))) / i)
  let lo = 0
  let hi = 1
  if (pvAt(lo) < netReceived) return 0
  for (let it = 0; it < 200; it++) {
    const mid = (lo + hi) / 2
    if (pvAt(mid) > netReceived) lo = mid
    else hi = mid
  }
  return ((lo + hi) / 2) * 1200
}

/** Compound annual growth rate (%). */
export function cagr(begin: number, end: number, years: number): number | null {
  if (!(begin > 0) || !(end > 0) || !(years > 0)) return null
  return d(end).div(begin).pow(d(1).div(years)).minus(1).times(100).toNumber()
}

/** Exact years to double at an annual rate compounded once a year. */
export function yearsToDouble(ratePct: number): number | null {
  if (!(ratePct > 0)) return null
  return Math.log(2) / Math.log(1 + ratePct / 100)
}

/** Years to double with continuous compounding. */
export function yearsToDoubleContinuous(ratePct: number): number | null {
  if (!(ratePct > 0)) return null
  return (100 * Math.log(2)) / ratePct
}

/* ── savings and investment growth ─────────────────────────────── */

export interface GrowthPoint {
  /** Period index at the end of which this row is taken (0 = start). */
  t: number
  balance: number
  /** Running total of money put in, start balance included. */
  invested: number
  /** Running growth (balance − invested). */
  gain: number
}

/**
 * Balance path with level deposits each period. `rate` is per period.
 * Returns one row per period plus the start row.
 */
export function growthPath(start: number, deposit: number, rate: number, periods: number, due = false): GrowthPoint[] {
  const i = d(rate)
  let bal = d(start)
  let inv = d(start)
  const rows: GrowthPoint[] = [{ t: 0, balance: bal.toNumber(), invested: inv.toNumber(), gain: 0 }]
  for (let t = 1; t <= periods; t++) {
    if (due) { bal = bal.plus(deposit); inv = inv.plus(deposit) }
    bal = bal.plus(bal.times(i))
    if (!due) { bal = bal.plus(deposit); inv = inv.plus(deposit) }
    rows.push({ t, balance: bal.toNumber(), invested: inv.toNumber(), gain: bal.minus(inv).toNumber() })
  }
  return rows
}

/** Monthly rate equivalent to an effective annual rate. */
export function monthlyFromAnnualEffective(annualPct: number): number {
  return d(annualPct).div(100).plus(1).pow(d(1).div(12)).minus(1).toNumber()
}

/* ── refinance ─────────────────────────────────────────────────── */

export interface RefiInput {
  balance: number
  currentPct: number
  monthsLeft: number
  newPct: number
  newMonths: number
  closingCosts: number
  /** Add the closing costs to the new loan instead of paying them in cash. */
  rollIn: boolean
}

export interface RefiResult {
  currentPayment: number
  newPayment: number
  newPrincipal: number
  monthlySaving: number
  breakEvenMonth: number | null
  currentInterest: number
  newInterest: number
  /** Remaining cost of the current loan minus the new loan's cost (closing costs included). */
  lifetimeSaving: number
  /** Cumulative cash out, month by month, for both paths. */
  cumCurrent: number[]
  cumNew: number[]
}

export function refinance(x: RefiInput): RefiResult {
  const cur = amortize({ principal: x.balance, annualPct: x.currentPct, months: x.monthsLeft })
  const newPrincipal = x.balance + (x.rollIn ? x.closingCosts : 0)
  const nxt = amortize({ principal: newPrincipal, annualPct: x.newPct, months: x.newMonths })
  const upfront = x.rollIn ? 0 : x.closingCosts
  const horizon = Math.max(cur.rows.length, nxt.rows.length)
  const cumCurrent: number[] = [0]
  const cumNew: number[] = [upfront]
  let a = d(0)
  let b = d(upfront)
  let breakEven: number | null = null
  for (let m = 1; m <= horizon; m++) {
    a = a.plus(cur.rows[m - 1]?.payment ?? 0)
    b = b.plus(nxt.rows[m - 1]?.payment ?? 0)
    cumCurrent.push(a.toNumber())
    cumNew.push(b.toNumber())
  }
  // Break-even: first month from which the new path has cost no more, counting the
  // closing costs, while comparing like with like (same months paid).
  const saving = d(cur.payment).minus(nxt.payment)
  if (saving.gt(0)) {
    if (x.rollIn) {
      breakEven = 0
    } else {
      breakEven = Math.ceil(d(x.closingCosts).div(saving).toNumber())
    }
  }
  return {
    currentPayment: cur.payment,
    newPayment: nxt.payment,
    newPrincipal,
    monthlySaving: saving.toNumber(),
    breakEvenMonth: breakEven,
    currentInterest: cur.totalInterest,
    newInterest: nxt.totalInterest,
    lifetimeSaving: d(cur.totalPaid).minus(nxt.totalPaid).minus(upfront).toNumber(),
    cumCurrent,
    cumNew,
  }
}

/* ── auto lease ────────────────────────────────────────────────── */

export interface LeaseInput {
  msrp: number
  price: number
  down: number
  tradeIn: number
  rebates: number
  /** Fees added to the capitalized cost (acquisition fee, etc.). */
  fees: number
  residualPct: number
  moneyFactor: number
  months: number
  taxPct: number
}

export interface LeaseResult {
  capCost: number
  residual: number
  depreciation: number
  finance: number
  base: number
  tax: number
  monthly: number
  totalPayments: number
  /** Down + trade-in + rebates + all monthly payments. */
  totalCost: number
  aprEquivalent: number
}

export function lease(x: LeaseInput): LeaseResult {
  const n = Math.max(1, Math.round(x.months))
  const cap = d(x.price).plus(x.fees).minus(x.down).minus(x.tradeIn).minus(x.rebates)
  const residual = d(x.msrp).times(x.residualPct).div(100)
  const dep = cap.minus(residual).div(n)
  const fin = cap.plus(residual).times(x.moneyFactor)
  const base = dep.plus(fin)
  const tax = base.times(x.taxPct).div(100)
  const monthly = cents(base.plus(tax))
  const total = monthly.times(n)
  return {
    capCost: cap.toNumber(),
    residual: residual.toNumber(),
    depreciation: cents(dep).toNumber(),
    finance: cents(fin).toNumber(),
    base: cents(base).toNumber(),
    tax: cents(tax).toNumber(),
    monthly: monthly.toNumber(),
    totalPayments: total.toNumber(),
    totalCost: total.plus(x.down).plus(x.tradeIn).toNumber(),
    aprEquivalent: d(x.moneyFactor).times(2400).toNumber(),
  }
}

/* ── depreciation ──────────────────────────────────────────────── */

export type DepMethod = 'sl' | 'ddb' | 'db150' | 'syd' | 'macrs'

export interface DepRow {
  year: number
  depreciation: number
  accumulated: number
  book: number
}

/** IRS Publication 946, Table A-1: GDS, half-year convention, percent per year. */
export const MACRS: Record<number, number[]> = {
  3: [33.33, 44.45, 14.81, 7.41],
  5: [20.0, 32.0, 19.2, 11.52, 11.52, 5.76],
  7: [14.29, 24.49, 17.49, 12.49, 8.93, 8.92, 8.93, 4.46],
  10: [10.0, 18.0, 14.4, 11.52, 9.22, 7.37, 6.55, 6.55, 6.56, 6.55, 3.28],
  15: [5.0, 9.5, 8.55, 7.7, 6.93, 6.23, 5.9, 5.9, 5.91, 5.9, 5.91, 5.9, 5.91, 5.9, 5.91, 2.95],
  20: [3.75, 7.219, 6.677, 6.177, 5.713, 5.285, 4.888, 4.522, 4.462, 4.461, 4.462, 4.461, 4.462, 4.461, 4.462, 4.461, 4.462, 4.461, 4.462, 4.461, 2.231],
}

/**
 * Depreciation schedule. Declining balance switches to straight line when that
 * gives more, and never goes below salvage. MACRS ignores salvage and uses the
 * class life (3, 5, 7, 10, 15 or 20 years).
 */
export function depreciation(cost: number, salvage: number, life: number, method: DepMethod): DepRow[] {
  const rows: DepRow[] = []
  const C = d(Math.max(0, cost))
  const S = method === 'macrs' ? d(0) : d(Math.min(Math.max(0, salvage), Math.max(0, cost)))
  const n = Math.max(1, Math.round(life))
  let book = C
  let acc = d(0)
  const push = (year: number, dep: Decimal) => {
    const dd = cents(dep)
    acc = acc.plus(dd)
    book = book.minus(dd)
    rows.push({ year, depreciation: dd.toNumber(), accumulated: acc.toNumber(), book: book.toNumber() })
  }
  if (method === 'macrs') {
    const table = MACRS[n] ?? MACRS[5]!
    table.forEach((pct, k) => {
      const dep = k === table.length - 1 ? book : C.times(pct).div(100)
      push(k + 1, Decimal.min(dep, book))
    })
    return rows
  }
  if (method === 'sl') {
    for (let y = 1; y <= n; y++) push(y, y === n ? book.minus(S) : C.minus(S).div(n))
    return rows
  }
  if (method === 'syd') {
    const sum = (n * (n + 1)) / 2
    for (let y = 1; y <= n; y++) push(y, y === n ? book.minus(S) : C.minus(S).times(n - y + 1).div(sum))
    return rows
  }
  const factor = method === 'ddb' ? 2 : 1.5
  const rate = d(factor).div(n)
  for (let y = 1; y <= n; y++) {
    const left = n - y + 1
    const db = book.times(rate)
    const sl = book.minus(S).div(left)
    let dep = Decimal.max(db, sl)
    if (y === n) dep = book.minus(S)
    if (book.minus(dep).lt(S)) dep = book.minus(S)
    push(y, Decimal.max(dep, 0))
  }
  return rows
}

/* ── rent vs buy ───────────────────────────────────────────────── */

export interface RentBuyInput {
  price: number
  downPct: number
  ratePct: number
  termYears: number
  closingPct: number
  sellingPct: number
  propertyTaxPct: number
  insurancePerYear: number
  maintenancePct: number
  hoaPerMonth: number
  appreciationPct: number
  rentPerMonth: number
  rentIncreasePct: number
  renterInsurancePerYear: number
  investReturnPct: number
  years: number
}

export interface RentBuyYear {
  year: number
  /** What the buyer would walk away with: home equity after selling costs plus side investments. */
  buyWealth: number
  rentWealth: number
  homeValue: number
  loanBalance: number
  buyCostYear: number
  rentCostYear: number
}

export interface RentBuyResult {
  years: RentBuyYear[]
  payment: number
  upfront: number
  /** First year in which buying ends ahead, or null. */
  breakEvenYear: number | null
}

/**
 * Both households start with the same cash (down payment + closing costs).
 * The renter invests it; each month whoever pays less invests the difference
 * at the same return. Wealth is compared at the end of each year, with the
 * home sold (selling costs paid, loan cleared).
 */
export function rentVsBuy(x: RentBuyInput): RentBuyResult {
  const months = Math.max(1, Math.round(x.years * 12))
  const down = d(x.price).times(x.downPct).div(100)
  const closing = d(x.price).times(x.closingPct).div(100)
  const loan = d(x.price).minus(down)
  const termM = Math.round(x.termYears * 12)
  const sched = amortize({ principal: loan.toNumber(), annualPct: x.ratePct, months: termM })
  const iInv = d(monthlyFromAnnualEffective(x.investReturnPct))
  const gHome = d(monthlyFromAnnualEffective(x.appreciationPct))
  let homeValue = d(x.price)
  let rent = d(x.rentPerMonth)
  let renterPot = down.plus(closing)
  let buyerPot = d(0)
  const out: RentBuyYear[] = []
  let buyYear = d(0)
  let rentYear = d(0)
  let breakEven: number | null = null
  for (let m = 1; m <= months; m++) {
    const row = sched.rows[m - 1]
    const mortgage = d(row?.payment ?? 0)
    const ownerCost = mortgage
      .plus(homeValue.times(x.propertyTaxPct).div(1200))
      .plus(d(x.insurancePerYear).div(12))
      .plus(homeValue.times(x.maintenancePct).div(1200))
      .plus(x.hoaPerMonth)
    const renterCost = rent.plus(d(x.renterInsurancePerYear).div(12))
    renterPot = renterPot.times(iInv.plus(1))
    buyerPot = buyerPot.times(iInv.plus(1))
    if (ownerCost.gt(renterCost)) renterPot = renterPot.plus(ownerCost.minus(renterCost))
    else buyerPot = buyerPot.plus(renterCost.minus(ownerCost))
    homeValue = homeValue.times(gHome.plus(1))
    buyYear = buyYear.plus(ownerCost)
    rentYear = rentYear.plus(renterCost)
    if (m % 12 === 0) rent = rent.times(d(x.rentIncreasePct).div(100).plus(1))
    if (m % 12 === 0 || m === months) {
      const bal = d(row?.balance ?? 0)
      const equity = homeValue.times(d(1).minus(d(x.sellingPct).div(100))).minus(bal)
      const buyWealth = equity.plus(buyerPot)
      const y = Math.ceil(m / 12)
      out.push({
        year: y,
        buyWealth: buyWealth.toNumber(),
        rentWealth: renterPot.toNumber(),
        homeValue: homeValue.toNumber(),
        loanBalance: bal.toNumber(),
        buyCostYear: buyYear.toNumber(),
        rentCostYear: rentYear.toNumber(),
      })
      if (breakEven === null && buyWealth.gte(renterPot)) breakEven = y
      buyYear = d(0)
      rentYear = d(0)
    }
  }
  return { years: out, payment: sched.payment, upfront: down.plus(closing).toNumber(), breakEvenYear: breakEven }
}

/* ── retirement accounts ───────────────────────────────────────── */

export interface K401Input {
  age: number
  retireAge: number
  balance: number
  salary: number
  contribPct: number
  /** Employer matches this share of your contribution… */
  matchPct: number
  /** …up to this share of salary. */
  matchCapPct: number
  salaryGrowthPct: number
  returnPct: number
  /** Yearly cap on your own contributions; 0 = no cap. */
  limit: number
}

export interface K401Year {
  age: number
  balance: number
  you: number
  employer: number
  growth: number
}

/** Monthly contributions and monthly growth at the effective annual return. Rows are at each birthday. */
export function k401(x: K401Input): K401Year[] {
  const years = Math.max(0, Math.round(x.retireAge - x.age))
  const i = d(monthlyFromAnnualEffective(x.returnPct))
  let bal = d(x.balance)
  let you = d(0)
  let emp = d(0)
  let salary = d(x.salary)
  const rows: K401Year[] = [{ age: x.age, balance: bal.toNumber(), you: 0, employer: 0, growth: 0 }]
  for (let y = 1; y <= years; y++) {
    let yourYear = salary.times(x.contribPct).div(100)
    if (x.limit > 0) yourYear = Decimal.min(yourYear, x.limit)
    const matchedPct = Math.min(x.contribPct, x.matchCapPct)
    const empYear = salary.times(matchedPct).div(100).times(x.matchPct).div(100)
    const youM = yourYear.div(12)
    const empM = empYear.div(12)
    for (let m = 0; m < 12; m++) {
      bal = bal.times(i.plus(1)).plus(youM).plus(empM)
    }
    you = you.plus(yourYear)
    emp = emp.plus(empYear)
    salary = salary.times(d(x.salaryGrowthPct).div(100).plus(1))
    rows.push({
      age: x.age + y,
      balance: bal.toNumber(),
      you: you.toNumber(),
      employer: emp.toNumber(),
      growth: bal.minus(x.balance).minus(you).minus(emp).toNumber(),
    })
  }
  return rows
}

export interface RothYear {
  age: number
  roth: number
  taxable: number
  contributed: number
}

/**
 * Annual contributions at the start of each year. The Roth grows tax-free; the
 * comparison account pays tax on its return each year (returnPct × (1 − tax)).
 */
export function rothVsTaxable(age: number, retireAge: number, balance: number, yearly: number, returnPct: number, taxPct: number): RothYear[] {
  const years = Math.max(0, Math.round(retireAge - age))
  const r = d(returnPct).div(100)
  const rt = r.times(d(1).minus(d(taxPct).div(100)))
  let roth = d(balance)
  let tax = d(balance)
  let c = d(balance)
  const rows: RothYear[] = [{ age, roth: roth.toNumber(), taxable: tax.toNumber(), contributed: c.toNumber() }]
  for (let y = 1; y <= years; y++) {
    roth = roth.plus(yearly).times(r.plus(1))
    tax = tax.plus(yearly).times(rt.plus(1))
    c = c.plus(yearly)
    rows.push({ age: age + y, roth: roth.toNumber(), taxable: tax.toNumber(), contributed: c.toNumber() })
  }
  return rows
}

/* ── dividends ─────────────────────────────────────────────────── */

export interface DividendInput {
  initial: number
  yearlyAdd: number
  yieldPct: number
  dividendGrowthPct: number
  priceGrowthPct: number
  taxPct: number
  reinvest: boolean
  years: number
}

export interface DividendYear {
  year: number
  /** Dividends paid in the year, after tax. */
  income: number
  /** Value of the holding at year end. */
  value: number
  /** Running total of dividends received after tax. */
  totalIncome: number
  invested: number
}

/**
 * Yearly model with a share price of 1 at the start: contributions buy shares
 * at the start of each year, dividends are paid at year end, then price and
 * dividend per share grow.
 */
export function dividends(x: DividendInput): DividendYear[] {
  let price = d(1)
  let dps = d(x.yieldPct).div(100)
  let shares = d(x.initial)
  let invested = d(x.initial)
  let total = d(0)
  const rows: DividendYear[] = []
  const keep = d(1).minus(d(x.taxPct).div(100))
  for (let y = 1; y <= Math.max(0, Math.round(x.years)); y++) {
    shares = shares.plus(d(x.yearlyAdd).div(price))
    invested = invested.plus(x.yearlyAdd)
    const income = shares.times(dps).times(keep)
    price = price.times(d(x.priceGrowthPct).div(100).plus(1))
    if (x.reinvest) shares = shares.plus(income.div(price))
    total = total.plus(income)
    rows.push({ year: y, income: income.toNumber(), value: shares.times(price).toNumber(), totalIncome: total.toNumber(), invested: invested.toNumber() })
    dps = dps.times(d(x.dividendGrowthPct).div(100).plus(1))
  }
  return rows
}

/* ── pay ───────────────────────────────────────────────────────── */

export interface Tier {
  /** Upper edge of the tier; Infinity for the last. */
  upTo: number
  ratePct: number
}

/** Commission on a sales amount with marginal tiers. Returns the total and the part from each tier. */
export function tieredCommission(sales: number, tiers: Tier[]): { total: number; parts: { from: number; to: number; amount: number; commission: number }[] } {
  let prev = 0
  let total = d(0)
  const parts: { from: number; to: number; amount: number; commission: number }[] = []
  for (const t of tiers) {
    const top = Math.min(sales, t.upTo)
    const amt = Math.max(0, top - prev)
    const c = d(amt).times(t.ratePct).div(100)
    parts.push({ from: prev, to: t.upTo, amount: amt, commission: c.toNumber() })
    total = total.plus(c)
    prev = t.upTo
    if (sales <= t.upTo) break
  }
  return { total: total.toNumber(), parts }
}

/** Overtime pay. Hours over the threshold are paid at the multiplier; double-time hours at 2×. */
export function overtimePay(rate: number, regularHours: number, otHours: number, otMultiplier: number, dtHours: number) {
  const r = d(rate)
  const regular = r.times(regularHours)
  const ot = r.times(otMultiplier).times(otHours)
  const dt = r.times(2).times(dtHours)
  const total = regular.plus(ot).plus(dt)
  const hours = regularHours + otHours + dtHours
  return {
    regular: cents(regular).toNumber(),
    overtime: cents(ot).toNumber(),
    doubleTime: cents(dt).toNumber(),
    total: cents(total).toNumber(),
    hours,
    effectiveRate: hours > 0 ? total.div(hours).toNumber() : 0,
  }
}

/** Debt-to-income ratio (%). */
export function dti(monthlyDebts: number, monthlyGrossIncome: number): number | null {
  if (!(monthlyGrossIncome > 0)) return null
  return d(monthlyDebts).div(monthlyGrossIncome).times(100).toNumber()
}

/** Months to reach a goal with a start balance, a monthly deposit and a monthly rate; null if never (within 100 years). */
export function monthsToGoal(start: number, monthly: number, ratePerMonth: number, goal: number): number | null {
  if (start >= goal) return 0
  let bal = d(start)
  const i = d(ratePerMonth)
  for (let m = 1; m <= 1200; m++) {
    bal = bal.times(i.plus(1)).plus(monthly)
    if (bal.gte(goal)) return m
  }
  return null
}
