#!/usr/bin/env node
/**
 * Tests for the round-3 calculators (src/components/tools/calculators, src/lib/tools/calc-families):
 * every registry entry has a spec and an explainer, every spec runs with its defaults, and
 * known-answer cases for each formula. Runs the TypeScript sources with Node's type stripping.
 *
 *   node scripts/calculators-test.mjs        all cases
 *   node scripts/calculators-test.mjs -v     print every case
 */
import './search-test/loader.mjs'

const verbose = process.argv.includes('-v')
let failed = 0
let passed = 0
const ok = (name, cond, detail = '') => {
  if (cond) {
    passed++
    if (verbose) console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}${detail ? `: ${detail}` : ''}`)
  }
}
/** |actual − expected| within tol (absolute) or rel (relative). */
const near = (name, actual, expected, tol = 0.005, rel = 0) => {
  const good = typeof actual === 'number' && Math.abs(actual - expected) <= Math.max(tol, Math.abs(expected) * rel)
  ok(name, good, `${actual} != ${expected}`)
}

const FAMILIES = ['loans', 'invest', 'tax', 'body', 'clinical', 'stats', 'algebra', 'geometry', 'physics', 'electric']
const { tools, CALCULATOR_PAGES } = await import('../src/lib/tools/calculators.ts')
const { TOOLS } = await import('../src/lib/tools/index.ts')
const lucide = await import('lucide-react')
const all = new Set(TOOLS.map((t) => t.slug))
const SPECS = {}
for (const f of FAMILIES) Object.assign(SPECS, (await import(`../src/components/tools/calculators/${f}/specs.ts`)).specs)

/* ── registry and specs ───────────────────────────────────────── */

const TODAY = new Date(2026, 10, 7)
function inputs(spec, over = {}) {
  const n = {}
  const s = {}
  for (const f of spec.inputs) {
    if (!f.kind || f.kind === 'num') n[f.id] = f.value === '' ? NaN : Number(f.value.replace(/,/g, ''))
    else s[f.id] = f.value
  }
  for (const [k, v] of Object.entries(over)) {
    if (typeof v === 'number') n[k] = v
    else s[k] = v
  }
  return { n, s, today: TODAY }
}
const run = (slug, over) => SPECS[slug].compute(inputs(SPECS[slug], over))
const stat = (out, label) => out.stats?.find((x) => x.label === label)?.value
const throws = (name, fn, re) => {
  try {
    fn()
    ok(name, false, 'no error')
  } catch (e) {
    ok(name, re.test(e.message), e.message)
  }
}

for (const t of tools) {
  const page = CALCULATOR_PAGES.get(t.slug)
  ok(`${t.slug}: spec`, Boolean(SPECS[t.slug]))
  ok(`${t.slug}: explainer`, Boolean(page?.def.explain.formula && page.def.explain.sources.length))
  ok(`${t.slug}: description 110-155`, t.description.length >= 110 && t.description.length <= 155, `${t.description.length}`)
  ok(`${t.slug}: 3-5 faqs`, t.faqs.length >= 3 && t.faqs.length <= 5)
  ok(`${t.slug}: icon`, t.icon in lucide, t.icon)
  ok(`${t.slug}: updated`, t.updated === '2026-11-07')
  for (const r of t.related) ok(`${t.slug}: related ${r}`, all.has(r))
  const e = page?.def.explain
  ok(`${t.slug}: copy`, !/—|!/.test(JSON.stringify([t.description, t.faqs, e?.how, e?.example ?? '', e?.notes ?? ''])), 'em dash or exclamation mark')
  if (SPECS[t.slug]) {
    try {
      const out = run(t.slug, {})
      ok(`${t.slug}: defaults`, !/NaN|Infinity|undefined/.test(JSON.stringify(out)) && out.working.length > 0 && Boolean(out.chart.summary))
      const labels = (out.stats ?? []).map((x) => x.label)
      ok(`${t.slug}: unique stat labels`, new Set(labels).size === labels.length, labels.join(', '))
    } catch (e) {
      ok(`${t.slug}: defaults`, false, e.message)
    }
  }
}
for (const slug of Object.keys(SPECS)) ok(`${slug}: registered`, Boolean(CALCULATOR_PAGES.get(slug)))

/* ── loans ────────────────────────────────────────────────────── */

{
  const L = await import('../src/components/tools/calculators/loans/specs.ts')
  // Standard amortization: $360,000 at 6.5% for 30 years = $2,275.44 (CFPB worked examples use the same formula).
  const p = L.piti(400000, 10, 6.5, 30, 4800, 1800, 0.6, 0)
  near('piti P&I 360k 6.5% 30y', p.pi, 2275.44)
  near('piti PMI 0.6% of 360k', p.pmi, 180)
  near('piti total', p.total, 3005.44)
  near('piti no PMI at 20% down', L.piti(400000, 20, 6.5, 30, 0, 0, 0.6, 0).pmi, 0)
  const b = L.biweekly(300000, 6.5, 30)
  near('biweekly half payment', b.half, 948.1)
  ok('biweekly pays off sooner', b.payments / 26 < 25 && b.payments / 26 > 23, String(b.payments / 26))
  ok('biweekly saves interest', b.biweeklyInterest < b.monthlyInterest)
  const h = L.heloc(50000, 8.25, 10, 20)
  near('heloc interest only', h.io, 343.75)
  near('heloc repayment', h.pay, 426.03)
  const e = L.equity(450000, 260000, 0, 85)
  near('equity', e.eq, 190000)
  near('equity borrowable', e.borrow, 122500)
  near('property tax 1.1%', L.propertyTax(350000, 100, 0, 1.1, false).tax, 3850)
  near('property tax 25 mills on 40% of 200k', L.propertyTax(200000, 40, 0, 25, true).tax, 2000)
  near('interest only 400k 7%', L.interestOnly(400000, 7, 10, 30).io, 2333.33)
  near('balloon payment 250k 7.5%', L.balloon(250000, 7.5, 30, 7).payment, 1748.04)
  near('personal loan payment 15k 11.5% 36m', L.personalLoan(15000, 11.5, 36, 3).s.payment, 494.64)
  ok('personal loan APR above rate with fee', L.personalLoan(15000, 11.5, 36, 3).apr > 13.5)
  near('vehicle financed', L.vehicleLoan(45000, 5000, 0, 6, 600, 8.5, 180).financed, 43300)
  near('vehicle tax after trade-in', L.vehicleLoan(30000, 0, 10000, 5, 0, 6, 60).tax, 1000)
  const pt = L.points(350000, 6.75, 6.25, 2, 30)
  near('points cost', pt.cost, 7000)
  ok('points break-even 61 months', pt.breakeven === 61, String(pt.breakeven))
  near('rent 30% of 72k', L.rentAfford(72000, 350).r30, 1800)
  near('rent 40x rule', L.rentAfford(72000, 350).r40x, 1800)
  throws('balloon after term fails', () => run('balloon-payment-calculator', { b: 30, a: 30 }), /before the end/)
}

/* ── investing ────────────────────────────────────────────────── */

{
  const I = await import('../src/components/tools/calculators/invest/specs.ts')
  // Hull, Options, Futures and Other Derivatives: S=100, K=100, T=1, r=5%, σ=20% → C ≈ 10.4506, P ≈ 5.5735.
  const bs = I.blackScholes(100, 100, 1, 0.05, 0.2)
  near('black-scholes call', bs.call, 10.4506, 0.0001)
  near('black-scholes put', bs.put, 5.5735, 0.0001)
  near('put-call parity', bs.call - bs.put, 100 - 100 * Math.exp(-0.05), 1e-9)
  near('black-scholes delta', bs.deltaCall, 0.6368, 0.0001)
  // A 5% 10-year semiannual bond at a 6% yield is priced at $925.61.
  near('bond price 5%/6% 10y', I.bondPrice(1000, 5, 6, 10, 2), 925.61, 0.005)
  near('bond at par when coupon = yield', I.bondPrice(1000, 5, 5, 10, 2), 1000, 1e-6)
  near('ytm recovers the yield', I.ytm(I.bondPrice(1000, 5, 6, 10, 2), 1000, 5, 10, 2), 6, 1e-6)
  near('macaulay duration zero coupon = maturity', I.macaulay(1000, 0, 5, 7, 1), 7, 1e-9)
  near('real rate 7% / 3%', I.realRate(7, 3), 3.8835, 0.0001)
  near('apy 4.5% daily', I.apyOf(4.5, 365), 4.6025, 0.0001)
  near('apy 4.5% monthly', I.apyOf(4.5, 12), 4.594, 0.0001)
  near('apr from apy round trip', I.aprOfApy(I.apyOf(5, 12), 12), 5, 1e-9)
  near('apy continuous', I.apyOf(5, 0), (Math.exp(0.05) - 1) * 100, 1e-9)
  near('tey 3.5% at 24% and 5%', I.teY(3.5, 24, 5), 4.848, 0.001)
  near('tey federal only', I.teY(3, 25, 0), 4, 1e-9)
  const f = I.fire(48000, 120000, 30000, 5, 4)
  near('fire number 25x', f.target, 1200000)
  ok('fire years', f.years > 18 && f.years < 19.5, String(f.years))
  const w = I.withdrawals(1000000, 4, 0, 0, 25)
  near('4% rule with 0 return lasts 25 years', w.end, 0, 0.01)
  near('4% rule first withdrawal', w.first, 40000)
  near('uniform table age 73', I.uniform(73), 26.5, 0)
  near('uniform table age 120+', I.uniform(125), 2.0, 0)
  ok('rmd start age 1955 = 73, 1960 = 75', I.rmdStartAge(1955) === 73 && I.rmdStartAge(1960) === 75)
  near('rmd 500k at 74', run('rmd-calculator', { b: 1952, bal: 500000 }).main.value, 19607.84)
  near('annuity FV 500/mo 6% 20y', run('annuity-calculator', {}).main.value, 231020.45, 0.02)
  near('annuity payout due', run('annuity-payout-calculator', {}).main.value, 2910.82, 0.01)
  near('sinking fund 12k 3y 4% with 1k', run('sinking-fund-calculator', {}).main.value, 284.76, 0.01)
  near('tvm fv', run('time-value-of-money-calculator', { solve: 'fv' }).main.value, 82704.68, 0.05)
  near('tvm solves rate back', run('time-value-of-money-calculator', { solve: 'r', fv: 82704.68 }).main.value, 6, 1e-4)
  near('tvm solves years back', run('time-value-of-money-calculator', { solve: 'n', fv: 82704.68 }).main.value, 15, 1e-3)
  near('dca average cost = harmonic mean', run('dollar-cost-averaging-calculator', { p: '10 20' }).main.value, 2 / (1 / 10 + 1 / 20), 1e-9)
  near('hsa tax saved', run('hsa-calculator', {}).main.value, 1178.1)
  throws('hsa over limit', () => run('hsa-calculator', { you: 5000 }), /limit/)
  near('emergency goal', run('emergency-fund-calculator', {}).main.value, 19800)
}

/* ── tax ──────────────────────────────────────────────────────── */

{
  const R = await import('../src/components/tools/calculators/tax/rules.ts')
  // 2026 brackets (Rev. Proc. 2025-32), worked by hand.
  near('2026 single tax on 62,900', R.incomeTax(62900, 'single').tax, 8550)
  near('2026 single tax at the 10% edge', R.incomeTax(12400, 'single').tax, 1240)
  near('2026 mfj tax on 100,800', R.incomeTax(100800, 'mfj').tax, 2480 + 9120)
  near('2026 single top bracket', R.incomeTax(1000000, 'single').tax, 1240 + 4560 + 12166 + 23058 + 17424 + 134531.25 + 132978, 0.01)
  ok('marginal 22% at 62,900', R.incomeTax(62900, 'single').marginal === 22)
  near('fica under the wage base', R.fica(65000, 'single').total, 4972.5)
  near('social security capped', R.fica(300000, 'single').ss, 184500 * 0.062)
  near('additional medicare', R.fica(300000, 'single').addl, 900)
  const se = R.seTax(60000, 0, 'single')
  near('se tax 60k', se.total, 8477.73)
  near('se deduction', se.deduction, 4238.87)
  near('se tax under $400 earnings', R.seTax(400, 0, 'single').total, 0)
  const g = R.gainTax(70000, 25000, 'single', true)
  near('ltcg all at 15%', g.tax, 3750)
  const g0 = R.gainTax(30000, 30000, 'single', true)
  near('ltcg split 0/15', g0.at0, 19450)
  near('ltcg split tax', g0.tax, 0.15 * 10550)
  near('stcg as ordinary', R.gainTax(50000, 10000, 'single', false).tax, 400 * 0.12 + 9600 * 0.22)
  near('paycheck take-home', run('paycheck-calculator', {}).main.value, 1866.6)
  near('federal calculator', run('federal-income-tax-calculator', {}).main.value, 8550)
  near('cap rate', run('cap-rate-calculator', {}).main.value, 6.37, 0.001)
  near('dscr', run('dscr-calculator', {}).main.value, 42000 / 36837.48, 1e-9)
  const T = await import('../src/components/tools/calculators/tax/specs.ts')
  near('wacc 60/40', T.wacc(600, 400, 10.25, 6, 21), 8.046, 0.001)
  ok('payback 20k / 5k a year = 4 years', run('payback-period-calculator', { cf: '5000 5000 5000 5000 5000' }).main.value === '4 years')
  near('ebitda', run('ebitda-calculator', {}).main.value, 2330000)
  near('freelance rate', run('freelance-hourly-rate-calculator', {}).main.value, 91.5, 0.01)
  near('utilization', run('credit-utilization-calculator', {}).main.value, 25, 1e-9)
}

/* ── body ─────────────────────────────────────────────────────── */

{
  const B = await import('../src/components/tools/calculators/body/specs.ts')
  const f = B.ffmi(81.65, 177.8, 15)
  near('ffmi', f.ffmi, 21.95, 0.01)
  near('ffmi normalized', f.normalized, 22.08, 0.01)
  near('tanaka max hr at 40', B.MAX_HR.tanaka(40), 180, 1e-9)
  near('gulati at 50', B.MAX_HR.gulati(50), 162, 1e-9)
  // ACSM: walking at 80 m/min on the flat = 0.1 × 80 + 3.5 = 11.5 mL/kg/min; running at 200 m/min on 5% = 40 + 9 + 3.5.
  near('acsm walking', B.acsm(80, 0, false), 11.5, 1e-9)
  near('acsm running grade', B.acsm(200, 0.05, true), 52.5, 1e-9)
  near('kcal from vo2', B.kcalOf(10, 70, 60), 210, 1e-9)
  near('caffeine one half-life', B.remaining(200, 5, 5), 100, 1e-9)
  near('uk units pint 4.5%', B.ukUnits(568, 4.5), 2.556, 0.001)
  near('us standard drink 12 oz beer', B.usDrinks(355, 5), 1.0, 0.002)
  near('dog years medium 6', B.dogYears(6, 'medium'), 44, 1e-9)
  near('dog epigenetic 1 year', B.dogEpigenetic(1), 31, 1e-9)
  near('cat years 8', B.catYears(8), 48, 1e-9)
  near('rer 10 kg', B.rer(10), 393.6, 0.1)
  const g = B.gainRange(22, 13)
  near('iom first trimester high', g.hi, 4.4, 1e-9)
  near('iom capped at total', B.gainRange(22, 40).hi, 35, 1e-9)
  near('steps to miles default', run('steps-to-miles-calculator', {}).main.value, 4.37, 0.01)
  throws('walking too fast', () => run('walking-calorie-calculator', { speed: 6 }), /run/)
}

/* ── clinical ─────────────────────────────────────────────────── */

{
  const C = await import('../src/components/tools/calculators/clinical/specs.ts')
  // CKD-EPI 2021 worked by hand: female 55, Scr 1.0 → 66.5; male 50, Scr 1.2 → 73.67.
  near('egfr female', C.egfr(1.0, 55, true), 66.5, 0.5)
  near('egfr male', C.egfr(1.2, 50, false), 73.67, 0.01)
  ok('ckd stages', C.ckdStage(95) === 'G1' && C.ckdStage(50) === 'G3a' && C.ckdStage(10) === 'G5')
  near('cockcroft-gault', C.cockcroftGault(60, 72, 1.0, false), 80, 1e-9)
  near('cockcroft-gault female', C.cockcroftGault(60, 72, 1.0, true), 68, 1e-9)
  near('ibw devine male 70 in', C.ibwDevine(70, false), 73, 1e-9)
  near('adjusted bw', C.adjustedBw(60, 100), 76, 1e-9)
  near('corrected calcium', C.correctedCa(8.2, 2.8), 9.16, 1e-9)
  const q = C.qtc(400, 60)
  near('qtc at 60 bpm is qt', q.bazett, 400, 1e-9)
  near('qtc bazett 75 bpm', C.qtc(400, 75).bazett, 447.2, 0.1)
  near('eag 7%', C.eag(7), 154.2, 0.01)
  near('friedewald', C.friedewald(200, 50, 150), 120, 1e-9)
  near('sampson', C.sampson(200, 50, 150), 123.4, 0.01)
  near('holliday 25 kg', C.holliday(25).rate, 65, 1e-9)
  near('holliday 8 kg', C.holliday(8).rate, 32, 1e-9)
  near('map', run('mean-arterial-pressure-calculator', {}).main.value, 93.333, 0.001)
  near('anion gap', run('anion-gap-calculator', {}).main.value, 12, 1e-9)
  near('anion gap albumin corrected', run('anion-gap-calculator', { alb: 2 }).main.value, 17, 1e-9)
  near('iv drip', run('iv-drip-rate-calculator', {}).main.value, 42, 0)
  near('dose capped', run('dosage-calculator', { max: 250 }).main.value, 250, 0)
  near('pack-years', run('pack-year-calculator', {}).main.value, 22.5, 1e-9)
  near('blood sugar', run('blood-sugar-converter', {}).main.value, 100 / 18.016, 1e-9)
}

/* ── stats ────────────────────────────────────────────────────── */

{
  const S = await import('../src/components/tools/calculators/stats/specs.ts')
  const E = await import('../src/components/tools/calculators/engine/stats.ts')
  // Reference values from standard tables (NIST e-Handbook, R).
  near('binomial P(X=6) n20 p0.3', S.binomial(20, 0.3, 6).eq, 0.191639, 1e-6)
  near('binomial P(X<=6)', S.binomial(20, 0.3, 6).le, 0.608010, 1e-6)
  near('poisson P(X=6) λ4', S.poisson(4, 6).eq, 0.104196, 1e-6)
  near('poisson P(X<=6) λ4', S.poisson(4, 6).le, 0.889326, 1e-6)
  near('Phi(1.96)', E.Phi(1.96), 0.9750021, 1e-6)
  near('t two-tailed t=2.228 df10', S.twoTail(2.228, 10), 0.05, 2e-4)
  near('chi2 cdf 3.841 df1', E.chi2Cdf(3.841459, 1), 0.95, 1e-6)
  near('chi2 cdf 18.307 df10', E.chi2Cdf(18.307, 10), 0.95, 1e-4)
  near('F cdf 4.10 (2, 10)', E.fCdf(4.102821, 2, 10), 0.95, 1e-5)
  near('t pdf integrates', Array.from({ length: 4001 }, (_, k) => E.tPdf(-20 + k * 0.01, 5) * 0.01).reduce((a, b) => a + b, 0), 1, 1e-3)
  near('chi-square independence 2x2', S.chiIndependence([[30, 20], [15, 35]]).x2, 9.0909, 1e-4)
  near('welch df', S.welch(5.2, 1.1, 30, 4.6, 1.4, 28).df, 51.24, 0.01)
  const r = S.regression([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])
  near('regression slope', r.b, 2, 1e-12)
  near('regression intercept', r.a, 0, 1e-12)
  near('regression r', r.r, 1, 1e-12)
  near('spearman with ties', S.spearman([1, 2, 3, 4], [1, 3, 2, 4]), 0.8, 1e-12)
  const q = S.quartiles([12, 15, 17, 20, 22, 23, 25, 28, 31, 34, 36, 41, 58])
  ok('quartiles 20/25/34 and outlier 58', q.q1 === 20 && q.med === 25 && q.q3 === 34 && q.outliers.join() === '58')
  near('expected value', run('expected-value-calculator', {}).main.value, 14, 1e-12)
  near('weighted average', run('weighted-average-calculator', {}).main.value, 80.1, 1e-9)
  near('normal P(X<120)', run('normal-distribution-calculator', {}).main.value, 0.908789, 1e-6)
  near('normal inverse 97.5%', run('normal-distribution-calculator', { m: 'inv', p: 97.5, mu: 0, sd: 1 }).main.value, 1.959964, 1e-5)
  near('p-value z 2.1', run('p-value-calculator', {}).main.value, 0.035729, 1e-6)
  throws('regression needs pairs', () => run('linear-regression-calculator', { y: '1 2 3' }), /same number/)
}

/* ── algebra ──────────────────────────────────────────────────── */

{
  const A = await import('../src/components/tools/calculators/algebra/specs.ts')
  ok('trailing zeros of 100!', A.trailingZeros(100) === 24)
  ok('F(100)', A.fibonacci(100) === 354224848179261915075n)
  ok('euclidean -7 mod 3 = 2', A.mod(-7n, 3n, 'euclid') === 2n)
  ok('truncated -7 mod 3 = -1', A.mod(-7n, 3n, 'trunc') === -1n)
  ok('floored 7 mod -3 = -2', A.mod(7n, -3n, 'floor') === -2n)
  const roots = A.polyRoots([1, -6, 11, -6]).map((r) => r[0])
  near('cubic roots', Math.max(...roots.map((v, i) => Math.abs(v - (i + 1)))), 0, 1e-9)
  const cr = A.polyRoots([1, 0, 1])
  near('x^2+1 roots ±i', Math.abs(cr[0][1]) + Math.abs(cr[1][1]), 2, 1e-9)
  const m = A.complexOp([3, 4], [1, -2], 'mul', 0)
  ok('complex multiply', m[0] === 11 && m[1] === -2)
  const d = A.complexOp([11, -2], [1, -2], 'div', 0)
  near('complex divide back', Math.abs(d[0] - 3) + Math.abs(d[1] - 4), 0, 1e-12)
  ok('cross product', A.cross([3, 1, 2], [1, 4, -1]).join() === '-9,5,11')
  ok('dot product', A.dot([3, 1, 2], [1, 4, -1]) === 5)
  ok('gcd', A.gcd(48n, 180n) === 12n)
  ok('lcm', A.lcm(36n, 30n) === 180n)
  ok('sin 30 exact', run('trigonometry-calculator', {}).main.value === '0.5')
  ok('tan 90 undefined', run('trigonometry-calculator', { a: 90 }).stats.find((x) => x.label === 'tan').value === 'undefined')
  ok('arcsin 0.5 = 30°', run('inverse-trig-calculator', {}).main.value === '30°')
  near('exponential growth', run('exponential-growth-calculator', {}).main.value, 1000 * 1.05 ** 10, 1e-9)
  ok('golden ratio b', Math.abs(run('golden-ratio-calculator', {}).main.value - 10 / 1.618033988749895) < 1e-9)
}

/* ── geometry ─────────────────────────────────────────────────── */

{
  const G = await import('../src/components/tools/calculators/geometry/specs.ts')
  near('circle area r=2', G.shapeArea('circle', 2, 0, 0).area, 4 * Math.PI, 1e-12)
  near('trapezoid area', G.shapeArea('trap', 8, 5, 4).area, 26, 1e-12)
  near('ellipse perimeter of a circle', G.ellipsePerimeter(3, 3), 6 * Math.PI, 1e-12)
  near('ellipse perimeter 2:1', G.ellipsePerimeter(2, 1), 9.688448, 1e-5)
  const a = G.arc(10, Math.PI / 3)
  near('arc length', a.s, 10.471976, 1e-6)
  near('chord 60°', a.chord, 10, 1e-12)
  near('hexagon area side 1', G.regular(6, 1).area, 2.598076, 1e-6)
  near('square from regular', G.regular(4, 3).area, 9, 1e-12)
  near('shoelace', G.shoelace([[0, 0], [6, 0], [7, 4], [3, 6], [-1, 3]]).area, 34.5, 1e-12)
  near('shoelace unit square centroid', G.shoelace([[0, 0], [1, 0], [1, 1], [0, 1]]).cx, 0.5, 1e-12)
  const p = G.parabola(1, -4, 3)
  ok('parabola vertex and roots', p.h === 2 && p.k === -1 && p.roots.join() === '1,3')
  near('parabola focus', p.focus[1], -0.75, 1e-12)
  const c = G.circleFrom3([0, 0], [4, 0], [0, 6])
  ok('circle through 3 points', Math.abs(c.h - 2) < 1e-12 && Math.abs(c.k - 3) < 1e-12)
}

/* ── physics ──────────────────────────────────────────────────── */

{
  const P = await import('../src/components/tools/calculators/physics/specs.ts')
  ok('si prefix', P.si(5.32e-7, 'm', 3) === '532 nm')
  ok('em band green', P.emBand(5.32e-7) === 'visible light')
  near('photon 532 nm in eV', (P.H * P.C) / 532e-9 / P.EV, 2.3305, 1e-4)
  near('speed of sound 20 °C', P.soundSpeed(20), 343.21, 0.01)
  near('doppler approaching', P.doppler(440, 343, 30, 0), 482.17, 0.01)
  near('thin lens', P.thinLens(10, 25).di, 50 / 3, 1e-12)
  near('lorentz 0.8c', P.gamma(0.8), 5 / 3, 1e-12)
  near('escape velocity earth', Math.sqrt((2 * P.G * P.BODIES.earth.M) / P.BODIES.earth.R), 11186, 2)
  near('ISS period minutes', Number(run('orbital-period-calculator', {}).main.value.split(' ')[0]), 92.41, 0.02)
  ok('force F = ma', run('force-calculator', {}).main.value === '4.5 kN')
  ok('horsepower 300 lb·ft at 5252 rpm = 300 hp', run('horsepower-calculator', { rpm: 5252.113 }).main.value === '300 hp')
  ok('two 70 dB sources = 73 dB', run('decibel-calculator', { l: '70 70' }).main.value === '73.01 dB')
  throws('snell total internal reflection', () => { const o = run('snells-law-calculator', { n1: '1.5', n2: '1.000293', a: 60 }); if (o.main.label === 'Total internal reflection') throw new Error('tir') }, /tir/)
}

/* ── electric ─────────────────────────────────────────────────── */

{
  const E = await import('../src/components/tools/calculators/electric/specs.ts')
  ok('E24 above 148 is 150', E.standardAbove(148) === 150)
  ok('E24 above 150 is 150', E.standardAbove(150) === 150)
  ok('E24 above 4.75k is 5.1k', E.standardAbove(4750) === 5100)
  // NEC Chapter 9 Table 8, uncoated copper at 75 °C: 14 AWG 3.07, 12 AWG 1.93, 10 AWG 1.21 Ω per 1,000 ft.
  near('14 AWG copper', E.ohmPerM('14', false) * 304.8, 3.07, 0.01)
  near('12 AWG copper', E.ohmPerM('12', false) * 304.8, 1.93, 0.01)
  near('10 AWG copper', E.ohmPerM('10', false) * 304.8, 1.21, 0.01)
  near('12 AWG aluminum', E.ohmPerM('12', true) * 304.8, 3.18, 0.02)
  ok('wire for 30 A, 100 ft, 3% is 8 AWG', run('wire-gauge-calculator', {}).main.value === '8 AWG')
  ok('led resistor 150 Ω', run('led-resistor-calculator', {}).main.value === '150 Ω')
  ok('voltage divider', run('voltage-divider-calculator', {}).main.value === '3.83673 V')
  ok('parallel resistors', run('resistors-in-parallel-calculator', { r: '100 100' }).main.value === '50 Ω')
  ok('series capacitors', run('capacitors-in-series-calculator', { c: '10 10' }).main.value === '5 µF')
  near('mAh to Wh', E.whOf(20000, 3.7), 74, 1e-9)
  ok('three-phase real power', run('three-phase-power-calculator', {}).main.value === '35.3338 kW')
  ok('rc time constant', run('rc-time-constant-calculator', {}).main.value === '1 s')
}

console.log(`${failed ? 'FAILED' : 'ok'}: ${passed} passed, ${failed} failed (${tools.length} calculators)`)
process.exit(failed ? 1 : 0)
