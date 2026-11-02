#!/usr/bin/env node
/**
 * Reference tests for the money and body calculators
 * (src/components/tools/calc/money-math.ts and body-math.ts).
 *
 *   node scripts/calc-test-money-body.mjs [--verbose]
 *
 * Reference values come from published worked examples (spreadsheet function
 * documentation, IRS Publication 946, the formula papers) or from an
 * independent computation written here in plain floating point.
 */
import * as M from '../src/components/tools/calc/money-math.ts'
import * as B from '../src/components/tools/calc/body-math.ts'
import * as T from '../src/components/tools/calc/tvm-math.ts'
import { MET_ACTIVITIES } from '../src/components/tools/calc/body-a-data.ts'

const verbose = process.argv.includes('--verbose')
let pass = 0
let fail = 0

function near(name, got, want, tol = 0.005) {
  const ok = Number.isFinite(got) && Math.abs(got - want) <= tol
  if (ok) pass++
  else fail++
  if (!ok || verbose) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${got}, want ${want} (±${tol})`)
}
function truth(name, cond) {
  if (cond) pass++
  else fail++
  if (!cond || verbose) console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`)
}

/* ── independent float helpers ─────────────────────────────────── */
const pmtF = (P, i, n) => (i === 0 ? P / n : (P * i) / (1 - Math.pow(1 + i, -n)))
const pvAnnF = (pmt, i, n) => (pmt * (1 - Math.pow(1 + i, -n))) / i
function newtonRate(pv, pmt, n) {
  let i = 0.005
  for (let k = 0; k < 100; k++) {
    const f = pvAnnF(pmt, i, n) - pv
    const h = 1e-7
    const df = (pvAnnF(pmt, i + h, n) - pvAnnF(pmt, i - h, n)) / (2 * h)
    i -= f / df
  }
  return i
}
function payoffMonths(P, annual, pay, extra) {
  const i = annual / 1200
  let b = P
  let m = 0
  let interest = 0
  while (b > 0.005 && m < 2000) {
    const int = Math.round(b * i * 100) / 100
    interest += int
    b = b + int - pay - extra
    m++
  }
  return { m, interest }
}

/* ── loans ─────────────────────────────────────────────────────── */
near('payment 200k 6% 30y', M.monthlyPayment(200000, 6, 360), 1199.1, 0.001)
near('payment 100k 5% 30y', M.monthlyPayment(100000, 5, 360), 536.82, 0.001)
near('payment 0% 12k 48m', M.monthlyPayment(12000, 0, 48), 250, 0.001)
{
  const a = M.amortize({ principal: 200000, annualPct: 6, months: 360 })
  truth('amortize 200k 6% has 360 rows', a.rows.length === 360)
  near('amortize 200k 6% total interest', a.totalInterest, 1199.1 * 360 - 200000, 5)
  near('amortize ends at 0', a.rows[a.rows.length - 1].balance, 0, 0.001)
  near('month 1 interest = 1000', a.rows[0].interest, 1000, 0.001)
}
{
  const a = M.amortize({ principal: 200000, annualPct: 6, months: 360, extraMonthly: 100 })
  const ref = payoffMonths(200000, 6, 1199.1, 100)
  truth(`extra 100/month payoff months ${a.months} = ${ref.m}`, a.months === ref.m)
  near('extra 100/month interest', a.totalInterest, ref.interest, 1)
}

/* ── time value of money ───────────────────────────────────────── */
near('FV 1000 @5% 10y', M.futureValue(1000, 0.05, 10), 1628.89, 0.005)
near('FV annuity 100/mo 0.5% 120', M.futureValue(0, 0.005, 120, 100), 16387.93, 0.005)
near('FV annuity due', M.futureValue(0, 0.005, 120, 100, true), 16387.93 * 1.005, 0.01)
near('PV 1000 @5% 10y', M.presentValue(1000, 0.05, 10), 613.91, 0.005)
near('PV annuity 1000/yr 8% 10y', M.presentValue(0, 0.08, 10, 1000), 6710.08, 0.005)
near('APY 5% monthly', M.apy(5, 12), 5.116189788, 1e-6)
near('rate per payment equal freq', M.ratePerPayment(6, 12, 12), 0.005, 1e-12)
near('rate per payment quarterly→monthly', M.ratePerPayment(6, 4, 12), Math.pow(1.015, 1 / 3) - 1, 1e-12)

/* NPV: spreadsheet docs, NPV(10%, -10000, 3000, 4200, 6800) = 1188.44 (first flow at t=1). */
near('NPV doc example 1', M.npv(10, [0, -10000, 3000, 4200, 6800]), 1188.44, 0.005)
/* NPV(8%, 8000, 9200, 10000, 12000, 14500) - 40000 = 1922.06 */
near('NPV doc example 2', M.npv(8, [-40000, 8000, 9200, 10000, 12000, 14500]), 1922.06, 0.005)
/* IRR: -70000, 12000, 15000, 18000, 21000, 26000 → 8.66%; first 4 years → -2.12%; first 2 → -44.35% */
near('IRR 5 years', M.irr([-70000, 12000, 15000, 18000, 21000, 26000]), 8.663094803, 1e-6)
near('IRR 4 years', M.irr([-70000, 12000, 15000, 18000, 21000]), -2.124484, 1e-5)
near('IRR 2 years', M.irr([-70000, 12000, 15000]), -44.350694, 1e-5)
truth('IRR none when all positive', M.irr([100, 200]) === null)
truth('IRR multiple roots found', M.irrAll([-100, 230, -132]).length === 2)
near('IRR multiple root 10%', M.irrAll([-100, 230, -132])[0], 10, 1e-6)
near('IRR multiple root 20%', M.irrAll([-100, 230, -132])[1], 20, 1e-6)
/* MIRR: -120000, 39000, 30000, 21000, 37000, 46000 at 10% / 12% → 12.61% */
near('MIRR doc example', M.mirr([-120000, 39000, 30000, 21000, 37000, 46000], 10, 12), 12.6094, 1e-3)
near('payback years', M.paybackYears([-1000, 300, 400, 500]), 2.6, 1e-9)

/* APR with fees: the payment is set on the full amount; APR prices the money received. */
{
  const pay = M.monthlyPayment(200000, 6, 360)
  const apr = M.aprOf(200000 - 4000, pay, 360)
  near('APR 200k 6% 30y 4000 fees', apr, newtonRate(196000, pay, 360) * 1200, 1e-6)
  truth(`APR above note rate (${apr.toFixed(4)}%)`, apr > 6.15 && apr < 6.25)
  near('APR no fees = note rate', M.aprOf(200000, pmtF(200000, 0.005, 360), 360), 6, 1e-6)
}

near('CAGR 10000→19000 in 3y', M.cagr(10000, 19000, 3), (Math.cbrt(1.9) - 1) * 100, 1e-9)
near('CAGR doubling in 10y', M.cagr(100, 200, 10), 7.177346254, 1e-6)
near('years to double at 8%', M.yearsToDouble(8), 9.006468, 1e-5)
near('years to double continuous 8%', M.yearsToDoubleContinuous(8), 8.664340, 1e-5)

/* Lease: cap 25000, residual 15000, MF 0.0025, 36 months. */
{
  const l = M.lease({ msrp: 25000, price: 25000, down: 0, tradeIn: 0, rebates: 0, fees: 0, residualPct: 60, moneyFactor: 0.0025, months: 36, taxPct: 0 })
  near('lease depreciation fee', l.depreciation, 277.78, 0.001)
  near('lease finance fee', l.finance, 100, 0.001)
  near('lease monthly', l.monthly, 377.78, 0.001)
  near('lease APR equivalent', l.aprEquivalent, 6, 1e-9)
  const t = M.lease({ msrp: 32000, price: 30000, down: 2000, tradeIn: 0, rebates: 0, fees: 795, residualPct: 55, moneyFactor: 0.00125, months: 36, taxPct: 7 })
  const cap = 30000 + 795 - 2000
  const res = 32000 * 0.55
  const base = (cap - res) / 36 + (cap + res) * 0.00125
  near('lease with fees, down and tax', t.monthly, Math.round(base * 1.07 * 100) / 100, 0.001)
}

/* Depreciation: cost 10000, salvage 1000, 5 years. */
{
  const dep = (m) => M.depreciation(10000, 1000, 5, m).map((r) => r.depreciation)
  truth('straight line 1800 a year', JSON.stringify(dep('sl')) === JSON.stringify([1800, 1800, 1800, 1800, 1800]))
  truth('double declining 4000 2400 1440 864 296', JSON.stringify(dep('ddb')) === JSON.stringify([4000, 2400, 1440, 864, 296]))
  truth('sum of years digits 3000..600', JSON.stringify(dep('syd')) === JSON.stringify([3000, 2400, 1800, 1200, 600]))
  truth('150% declining with switch', JSON.stringify(dep('db150')) === JSON.stringify([3000, 2100, 1470, 1215, 1215]))
  const macrs = M.depreciation(10000, 0, 5, 'macrs').map((r) => r.depreciation)
  truth('MACRS 5-year (Pub 946 A-1)', JSON.stringify(macrs) === JSON.stringify([2000, 3200, 1920, 1152, 1152, 576]))
  const m7 = M.depreciation(100000, 0, 7, 'macrs')
  near('MACRS 7-year year 1', m7[0].depreciation, 14290, 0.001)
  near('MACRS 7-year fully depreciated', m7[m7.length - 1].book, 0, 0.001)
  for (const [k, t] of Object.entries(M.MACRS)) near(`MACRS ${k}-year table sums to 100`, t.reduce((a, b) => a + b, 0), 100, 0.011)
}

/* Refinance against a float computation. */
{
  const r = M.refinance({ balance: 250000, currentPct: 7, monthsLeft: 300, newPct: 5.5, newMonths: 360, closingCosts: 5000, rollIn: false })
  near('refi current payment', r.currentPayment, Math.round(pmtF(250000, 7 / 1200, 300) * 100) / 100, 0.001)
  near('refi new payment', r.newPayment, Math.round(pmtF(250000, 5.5 / 1200, 360) * 100) / 100, 0.001)
  truth('refi break-even month', r.breakEvenMonth === Math.ceil(5000 / (r.currentPayment - r.newPayment)))
}

/* Pay */
near('tiered commission', M.tieredCommission(120000, [{ upTo: 50000, ratePct: 5 }, { upTo: 100000, ratePct: 7 }, { upTo: Infinity, ratePct: 10 }]).total, 8000, 1e-9)
near('flat commission', M.tieredCommission(45000, [{ upTo: Infinity, ratePct: 6 }]).total, 2700, 1e-9)
near('overtime 20/h 40+10 at 1.5', M.overtimePay(20, 40, 10, 1.5, 0).total, 1100, 1e-9)
near('overtime with double time', M.overtimePay(20, 40, 8, 1.5, 4).total, 800 + 240 + 160, 1e-9)
near('DTI 2000/6000', M.dti(2000, 6000), 33.333333, 1e-5)
truth('months to goal 0% 1000 + 100/mo to 2000', M.monthsToGoal(1000, 100, 0, 2000) === 10)

/* Growth: with 0% the 401(k) is the sum of contributions. */
{
  const k = M.k401({ age: 30, retireAge: 40, balance: 10000, salary: 60000, contribPct: 6, matchPct: 50, matchCapPct: 6, salaryGrowthPct: 0, returnPct: 0, limit: 0 })
  near('401k at 0% return', k[k.length - 1].balance, 10000 + 10 * (3600 + 1800), 1e-6)
  const k2 = M.k401({ age: 30, retireAge: 31, balance: 0, salary: 120000, contribPct: 6, matchPct: 100, matchCapPct: 6, salaryGrowthPct: 0, returnPct: 7, limit: 0 })
  const i = Math.pow(1.07, 1 / 12) - 1
  near('401k one year at 7%', k2[1].balance, (1200 / 1) * ((Math.pow(1 + i, 12) - 1) / i), 0.01)
  const k3 = M.k401({ age: 30, retireAge: 31, balance: 0, salary: 1000000, contribPct: 10, matchPct: 0, matchCapPct: 0, salaryGrowthPct: 0, returnPct: 0, limit: 24500 })
  near('401k contribution limit', k3[1].you, 24500, 1e-9)
}
{
  const r = M.rothVsTaxable(30, 31, 0, 7000, 10, 0)
  near('Roth one year start-of-year', r[1].roth, 7700, 1e-9)
  const t = M.rothVsTaxable(30, 31, 0, 7000, 10, 20)
  near('taxable one year with 20% tax drag', t[1].taxable, 7000 * 1.08, 1e-9)
}
{
  const dv = M.dividends({ initial: 10000, yearlyAdd: 0, yieldPct: 4, dividendGrowthPct: 0, priceGrowthPct: 0, taxPct: 0, reinvest: false, years: 1 })
  near('dividend 4% on 10000', dv[0].income, 400, 1e-9)
  const dr = M.dividends({ initial: 10000, yearlyAdd: 0, yieldPct: 4, dividendGrowthPct: 0, priceGrowthPct: 0, taxPct: 0, reinvest: true, years: 2 })
  near('dividend reinvested year 2', dr[1].income, 416, 1e-9)
}
{
  const rb = M.rentVsBuy({ price: 100000, downPct: 100, ratePct: 0, termYears: 30, closingPct: 0, sellingPct: 0, propertyTaxPct: 0, insurancePerYear: 0, maintenancePct: 0, hoaPerMonth: 0, appreciationPct: 0, rentPerMonth: 0, rentIncreasePct: 0, renterInsurancePerYear: 0, investReturnPct: 0, years: 5 })
  near('rent vs buy neutral case buyer', rb.years[4].buyWealth, 100000, 1e-6)
  near('rent vs buy neutral case renter', rb.years[4].rentWealth, 100000, 1e-6)
  const rb2 = M.rentVsBuy({ price: 100000, downPct: 100, ratePct: 0, termYears: 30, closingPct: 0, sellingPct: 0, propertyTaxPct: 0, insurancePerYear: 0, maintenancePct: 0, hoaPerMonth: 0, appreciationPct: 0, rentPerMonth: 1000, rentIncreasePct: 0, renterInsurancePerYear: 0, investReturnPct: 0, years: 1 })
  near('rent vs buy: owner banks the saved rent', rb2.years[0].buyWealth - rb2.years[0].rentWealth, 12000, 1e-6)
}

/* ── body ──────────────────────────────────────────────────────── */
/* Widmark: 42 g (three 14 g drinks), 80 kg man, 2 h → 0.0772 − 0.030 */
near('Widmark man 80 kg 3 drinks 2 h', B.widmarkBac(42, 80, 'male', 2), 42 / (80000 * 0.68) * 100 - 0.03, 1e-9)
near('Widmark woman 60 kg 3 drinks 1 h', B.widmarkBac(42, 60, 'female', 1), 0.112273, 1e-6)
near('Widmark never below 0', B.widmarkBac(14, 90, 'male', 10), 0, 0)
near('alcohol grams in 355 ml at 5%', B.alcoholGrams(355, 5), 14.00, 0.01)
near('hours to sober', B.hoursToSober(42, 80, 'male'), (42 / (80000 * 0.68) * 100) / 0.015, 1e-9)

near('BSA Mosteller 180 cm 80 kg = 2.0', B.BSA.mosteller(80, 180), 2.0, 1e-12)
near('BSA DuBois 170 cm 70 kg ≈ 1.81', B.BSA.dubois(70, 170), 1.8097, 0.0005)
near('BSA Haycock 170/70', B.BSA.haycock(70, 170), 0.024265 * Math.pow(70, 0.5378) * Math.pow(170, 0.3964), 1e-12)
near('BSA Boyd 170/70 ≈ 1.83', B.BSA.boyd(70, 170), 1.83, 0.01)

near('Riegel 20:00 5K → marathon', B.riegel(1200, 5, 42.195), 1200 * Math.pow(42.195 / 5, 1.06), 1e-6)
truth('Riegel 20:00 5K → about 3:11:50', Math.abs(B.riegel(1200, 5, 42.195) - (3 * 3600 + 11 * 60 + 50)) < 30)
near('Riegel same distance', B.riegel(2400, 10, 10), 2400, 1e-9)

near('Navy man 70 in, neck 15, waist 34', B.navyBodyFatIn('male', 70, 15, 34), 86.01 * Math.log10(19) - 70.041 * Math.log10(70) + 36.76, 1e-9)
near('Navy man ≈ 17.5%', B.navyBodyFatIn('male', 70, 15, 34), 17.5, 0.1)
near('Navy woman 64 in, neck 13, waist 30, hip 38', B.navyBodyFatIn('female', 64, 13, 30, 38), 163.205 * Math.log10(55) - 97.684 * Math.log10(64) - 78.387, 1e-9)
near('Navy cm and inch forms agree (man)', B.navyBodyFatCm('male', 177.8, 38.1, 86.36), B.navyBodyFatIn('male', 70, 15, 34), 0.6)
near('Navy cm and inch forms agree (woman)', B.navyBodyFatCm('female', 162.56, 33.02, 76.2, 96.52), B.navyBodyFatIn('female', 64, 13, 30, 38), 0.8)
near('Army one-site man 180 lb 36 in', B.armyOneSite('male', 180, 36), 23.07, 1e-9)
near('Army one-site woman 140 lb 32 in', B.armyOneSite('female', 140, 32), 29.39, 1e-9)
truth('Army max body fat man 25 = 22%', B.armyMaxBodyFat('male', 25) === 22)
truth('Army max body fat woman 45 = 36%', B.armyMaxBodyFat('female', 45) === 36)

near('Karvonen 40 y, rest 60, 70%', B.karvonen(B.maxHeartRate(40), 60, 0.7), 144, 1e-9)
near('Tanaka max HR 40 y', B.maxHeartRate(40, 'tanaka'), 180, 1e-9)
near('Katch-McArdle LBM 60 kg', B.katchMcArdle(60), 1666, 1e-9)
near('Mifflin man 80/180/30', B.mifflin('male', 80, 180, 30), 1780, 1e-9)
near('Boer man 80/180', B.lbmBoer('male', 80, 180), 61.42, 1e-9)
near('James man 80/180', B.lbmJames('male', 80, 180), 88 - 128 * (80 / 180) ** 2, 1e-9)
near('Hume man 80/180', B.lbmHume('male', 80, 180), 0.3281 * 80 + 0.33929 * 180 - 29.5336, 1e-9)
near('MET 9.8 × 70 kg × 30 min', B.metCalories(9.8, 70, 30), 360.15, 1e-9)
near('Cooper 2400 m', B.vo2Cooper(2400), (2400 - 504.9) / 44.73, 1e-9)
near('Uth 190/60', B.vo2Uth(190, 60), 48.45, 1e-9)
near('Rockport man 30 y 170 lb 15 min 130 bpm', B.vo2Rockport('male', 30, 170, 15, 130), 45.15, 0.01)
near('1.5-mile run in 12 min', B.vo2OneAndHalfMile(12), 43.75, 1e-9)
near('waist to hip 85/100', B.waistToHip(85, 100), 0.85, 1e-12)

{
  const g = B.gestation(new Date(2026, 0, 1), new Date(2026, 2, 12))
  truth(`gestation 70 days = 10w0d (${g.weeks}w${g.rem}d)`, g.days === 70 && g.weeks === 10 && g.rem === 0)
  truth('due date LMP + 280 = 2026-10-08', g.due.getFullYear() === 2026 && g.due.getMonth() === 9 && g.due.getDate() === 8)
  const g2 = B.gestation(new Date(2026, 0, 1), new Date(2026, 2, 12), 30)
  truth('30-day cycle shifts due date 2 days', g2.due.getDate() === 10 && g2.days === 68)
}
{
  const s = B.simulateLoss({ sex: 'male', kg: 90, cm: 180, age: 35, activity: 1.375, goalKg: 80, kgPerWeek: 0.5 })
  truth('weight loss reaches goal', s.reached)
  truth('weight loss is monotonic', s.days.every((w, i) => i === 0 || w <= s.days[i - 1]))
  truth(`weight loss slower than linear (${s.days.length - 1} days > 140)`, s.days.length - 1 > 140)
  near('weight loss intake', s.intake, B.mifflin('male', 90, 180, 35) * 1.375 - 550, 1e-9)
}

/* tvm-math helpers */
truth('cumulative', JSON.stringify(T.cumulative([-1000, 300, 400, 500])) === JSON.stringify([-1000, -700, -300, 200]))
near('profitability index', T.profitabilityIndex(M.discountedFlows(10, [-1000, 500, 500, 500])), (500 / 1.1 + 500 / 1.21 + 500 / 1.331) / 1000, 1e-12)
{
  const p = T.mirrParts([-120000, 39000, 30000, 21000, 37000, 46000], 10, 12)
  near('MIRR from its parts = MIRR', (Math.pow(p.fvIn / p.pvOut, 1 / p.n) - 1) * 100, 12.6094, 1e-3)
}
truth('MET table: 30+ activities, MET 2-15', MET_ACTIVITIES.length >= 30 && MET_ACTIVITIES.every((a) => a.met >= 2 && a.met <= 15))

console.log(`\ncalc money-body: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
