/** Investing, saving and retirement income. Money in decimal.js, rates as floats. */
import { choice, money, num, percent, pos, select } from '../engine/fields'
import { dec, fmt, pct, usd, usd0, yearsMonths } from '../engine/format'
import { D, annuityPayment, bisect, cents, futureValue, sinkingPayment, sum } from '../engine/money'
import { Phi, phi, readList } from '../engine/stats'
import { fail } from '../engine/types'
import type { Spec } from '../engine/types'

const FREQ = [['12', 'Monthly'], ['4', 'Quarterly'], ['1', 'Yearly']] as const
const TIMING = [['end', 'End of period'], ['start', 'Start of period']] as const

/** Balance and money put in at the end of each year, deposits every period. */
export function growth(start: number, pmt: number, annualPct: number, years: number, perYear = 12, due = false) {
  const i = D(annualPct).div(100).div(perYear)
  let bal = D(start)
  let put = D(start)
  const balance = [cents(bal)]
  const contributed = [cents(put)]
  for (let y = 1; y <= Math.ceil(years); y++) {
    const periods = Math.min(perYear, Math.round((years - (y - 1)) * perYear))
    for (let p = 0; p < periods; p++) {
      if (due) bal = bal.plus(pmt)
      bal = bal.times(i.plus(1))
      if (!due) bal = bal.plus(pmt)
      put = put.plus(pmt)
    }
    balance.push(cents(bal))
    contributed.push(cents(put))
  }
  return { balance, contributed, end: cents(bal), put: cents(put) }
}

const growthChart = (g: { balance: number[]; contributed: number[] }, summary: string) => ({
  kind: 'line' as const,
  area: true,
  stacked: true,
  x: g.balance.map((_, k) => k),
  series: [
    { id: 'c', label: 'Money put in', values: g.contributed, paint: 'grey' as const },
    { id: 'g', label: 'Growth', values: g.balance.map((b, k) => Math.max(0, cents(D(b).minus(g.contributed[k]!)))), paint: 'hatch' as const },
  ],
  xLabel: 'Year',
  formatX: String,
  formatValue: usd0,
  summary,
  table: true,
})

/* ── annuity (future value) ────────────────────────────────────── */

const annuitySpec: Spec = {
  inputs: [
    money('pmt', 'Payment each period', '500'),
    select('f', 'Payments', '12', FREQ, { half: true }),
    choice('t', 'Paid at', 'end', TIMING),
    percent('r', 'Annual return', '6', { half: true }),
    pos('y', 'Years', '20', 'years', { half: true, max: 100 }),
    money('pv', 'Starting balance', '0'),
  ],
  compute: ({ n, s }) => {
    const f = Number(s.f)
    const due = s.t === 'start'
    const periods = Math.round(n.y * f)
    const fv = cents(futureValue(n.pv, n.r / 100 / f, periods, n.pmt, due))
    const g = growth(n.pv, n.pmt, n.r, n.y, f, due)
    const put = sum(n.pv, D(n.pmt).times(periods).toNumber())
    return {
      main: { label: 'Future value', value: fv, format: usd },
      stats: [
        { label: 'Money put in', value: put, format: usd },
        { label: 'Growth', value: cents(D(fv).minus(put)), format: usd },
        { label: 'Payments', value: periods, format: (v) => dec(v, 0) },
      ],
      working: [
        `i = ${n.r}% ÷ ${f} = ${fmt(n.r / f, 6)}% a period, n = ${n.y} × ${f} = ${periods}`,
        `FV = PV(1 + i)^n + PMT × ((1 + i)^n − 1) ÷ i${due ? ' × (1 + i)' : ''}`,
        `FV = ${usd(n.pv)}(1 + i)^${periods} + ${usd(n.pmt)} × ((1 + i)^${periods} − 1) ÷ i${due ? ' × (1 + i)' : ''} = ${usd(fv)}`,
      ],
      note: due ? 'Payments at the start of each period (annuity due) earn one more period of interest.' : 'Payments at the end of each period (ordinary annuity).',
      chart: growthChart(g, `${periods} payments of ${usd(n.pmt)} grow to ${usd0(fv)} at ${n.r}% a year. ${usd0(put)} is money put in and ${usd0(fv - put)} is growth.`),
    }
  },
}

/* ── annuity payout ────────────────────────────────────────────── */

const payoutSpec: Spec = {
  inputs: [
    money('pv', 'Starting balance', '500000', { above: 0 }),
    percent('r', 'Annual return', '5', { half: true }),
    pos('y', 'Years of payments', '25', 'years', { half: true, max: 100 }),
    select('f', 'Payments', '12', FREQ, { half: true }),
    choice('t', 'Paid at', 'start', TIMING),
  ],
  compute: ({ n, s }) => {
    const f = Number(s.f)
    const due = s.t === 'start'
    const periods = Math.round(n.y * f)
    const i = n.r / 100 / f
    const pay = annuityPayment(n.pv, i, periods, due)
    const total = cents(D(pay).times(periods))
    const bal: number[] = [n.pv]
    let b = D(n.pv)
    for (let p = 1; p <= periods; p++) {
      if (due) b = b.minus(pay)
      b = b.times(1 + i)
      if (!due) b = b.minus(pay)
      if (p % f === 0 || p === periods) bal.push(Math.max(0, cents(b)))
    }
    return {
      main: { label: `${f === 12 ? 'Monthly' : f === 4 ? 'Quarterly' : 'Yearly'} payout`, value: pay, format: usd },
      stats: [
        { label: 'Total paid out', value: total, format: usd },
        { label: 'Interest earned', value: cents(D(total).minus(n.pv)), format: usd },
        { label: 'Payments', value: periods, format: (v) => dec(v, 0) },
      ],
      working: [
        `i = ${n.r}% ÷ ${f}, n = ${periods}`,
        `PMT = PV × i ÷ (1 − (1 + i)^−n)${due ? ' ÷ (1 + i)' : ''}`,
        `PMT = ${usd(n.pv)} × i ÷ (1 − (1 + i)^−${periods})${due ? ' ÷ (1 + i)' : ''} = ${usd(pay)}`,
      ],
      note: 'The balance keeps earning the return while it pays out, and reaches zero with the last payment.',
      chart: {
        kind: 'line',
        x: bal.map((_, k) => k),
        series: [{ id: 'b', label: 'Balance', values: bal }],
        xLabel: 'Year',
        formatX: String,
        formatValue: usd0,
        summary: `${usd0(n.pv)} earning ${n.r}% pays ${usd(pay)} ${f === 12 ? 'a month' : f === 4 ? 'a quarter' : 'a year'} for ${n.y} years, ${usd0(total)} in all.`,
        table: true,
      },
    }
  },
}

/* ── bonds ─────────────────────────────────────────────────────── */

/** Price of a bond per 100 or per face: coupon annuity plus discounted face. */
export function bondPrice(face: number, couponPct: number, ytmPct: number, years: number, f: number): number {
  const n = Math.round(years * f)
  const c = (face * couponPct) / 100 / f
  const y = ytmPct / 100 / f
  if (y === 0) return c * n + face
  return (c * (1 - Math.pow(1 + y, -n))) / y + face * Math.pow(1 + y, -n)
}

/** Macaulay duration in years. */
export function macaulay(face: number, couponPct: number, ytmPct: number, years: number, f: number): number {
  const n = Math.round(years * f)
  const c = (face * couponPct) / 100 / f
  const y = ytmPct / 100 / f
  let w = 0
  for (let t = 1; t <= n; t++) w += (t * (c + (t === n ? face : 0))) / Math.pow(1 + y, t)
  return w / bondPrice(face, couponPct, ytmPct, years, f) / f
}

export function ytm(price: number, face: number, couponPct: number, years: number, f: number): number | null {
  const y = bisect((r) => bondPrice(face, couponPct, r, years, f) - price, -50 * f + 0.01, 100 * f)
  return y
}

const priceYield = (face: number, c: number, years: number, f: number, at: number) => {
  const lo = Math.max(0, Math.floor(at - 4))
  const xs = Array.from({ length: 33 }, (_, k) => Number((lo + k * 0.25).toFixed(2)))
  return { xs, prices: xs.map((y) => cents(bondPrice(face, c, y, years, f))) }
}

const BOND_FREQ = [['2', 'Twice a year'], ['1', 'Once a year'], ['4', 'Quarterly']] as const

const bondSpec: Spec = {
  inputs: [
    money('face', 'Face value', '1000', { above: 0 }),
    percent('c', 'Coupon rate', '5', { half: true }),
    percent('y', 'Yield to maturity', '6', { half: true }),
    pos('t', 'Years to maturity', '10', 'years', { half: true, max: 100 }),
    select('f', 'Coupons', '2', BOND_FREQ, { half: true }),
  ],
  compute: ({ n, s }) => {
    const f = Number(s.f)
    const price = cents(bondPrice(n.face, n.c, n.y, n.t, f))
    const mac = macaulay(n.face, n.c, n.y, n.t, f)
    const mod = mac / (1 + n.y / 100 / f)
    const coupon = (n.face * n.c) / 100
    const py = priceYield(n.face, n.c, n.t, f, n.y)
    const kind = price > n.face ? 'premium' : price < n.face ? 'discount' : 'par'
    return {
      main: { label: 'Bond price', value: price, format: usd, sub: kind === 'par' ? 'at par' : `at a ${kind} of ${usd(Math.abs(price - n.face))}` },
      stats: [
        { label: 'Price per 100', value: (price / n.face) * 100, format: (v) => dec(v, 3) },
        { label: 'Current yield', value: (coupon / price) * 100, format: (v) => pct(v, 3) },
        { label: 'Macaulay duration', value: mac, format: (v) => `${dec(v, 2)} yrs` },
        { label: 'Modified duration', value: mod, format: (v) => dec(v, 2) },
      ],
      working: [
        `coupon C = ${usd(n.face)} × ${n.c}% ÷ ${f} = ${usd(coupon / f)}; y = ${n.y}% ÷ ${f}; n = ${Math.round(n.t * f)}`,
        `P = C × (1 − (1 + y)^−n) ÷ y + F × (1 + y)^−n = ${usd(price)}`,
        `current yield = ${usd(coupon)} ÷ ${usd(price)} = ${pct((coupon / price) * 100, 3)}`,
        `modified duration = ${dec(mac, 3)} ÷ (1 + y) = ${dec(mod, 3)}: a 1% rise in yield cuts the price by about ${dec(mod, 2)}%`,
      ],
      note: 'F is the face value. The price is the clean price on a coupon date, with no accrued interest.',
      chart: {
        kind: 'line',
        x: py.xs,
        series: [{ id: 'p', label: 'Price', values: py.prices }],
        xLabel: 'Yield',
        formatX: (v) => `${v}%`,
        formatValue: usd,
        zero: false,
        markers: [{ x: n.y, label: `${n.y}%` }],
        guides: [{ y: n.face, label: 'Par' }],
        summary: `At a ${n.y}% yield the bond is worth ${usd(price)}. The curve shows the price falling as yields rise, and bending: the convexity.`,
        table: true,
      },
    }
  },
}

const ytmSpec: Spec = {
  inputs: [
    money('p', 'Price', '950', { above: 0 }),
    money('face', 'Face value', '1000', { above: 0 }),
    percent('c', 'Coupon rate', '5', { half: true }),
    pos('t', 'Years to maturity', '8', 'years', { half: true, max: 100 }),
    select('f', 'Coupons', '2', BOND_FREQ),
  ],
  compute: ({ n, s }) => {
    const f = Number(s.f)
    const y = ytm(n.p, n.face, n.c, n.t, f)
    if (y === null) fail('No yield gives that price. Check the price and the coupon.')
    const coupon = (n.face * n.c) / 100
    const approx = ((coupon + (n.face - n.p) / n.t) / ((n.face + n.p) / 2)) * 100
    const py = priceYield(n.face, n.c, n.t, f, y)
    return {
      main: { label: 'Yield to maturity', value: y, format: (v) => pct(v, 3), sub: f === 2 ? 'bond-equivalent yield, compounded twice a year' : undefined },
      stats: [
        { label: 'Current yield', value: (coupon / n.p) * 100, format: (v) => pct(v, 3) },
        { label: 'Approximate YTM', value: approx, format: (v) => pct(v, 3) },
        { label: 'Effective annual yield', value: (Math.pow(1 + y / 100 / f, f) - 1) * 100, format: (v) => pct(v, 3) },
        { label: 'Income to maturity', value: sum(D(coupon).times(n.t).toNumber(), n.face - n.p), format: usd },
      ],
      working: [
        `solve ${usd(n.p)} = C × (1 − (1 + y)^−n) ÷ y + F × (1 + y)^−n for y`,
        `C = ${usd(coupon / f)}, F = ${usd(n.face)}, n = ${Math.round(n.t * f)} → y = ${dec(y / f, 5)}% a period`,
        `YTM = ${dec(y / f, 5)}% × ${f} = ${pct(y, 3)}`,
        `approximation: (C + (F − P) ÷ years) ÷ ((F + P) ÷ 2) = ${pct(approx, 3)}`,
      ],
      chart: {
        kind: 'line',
        x: py.xs,
        series: [{ id: 'p', label: 'Price', values: py.prices }],
        xLabel: 'Yield',
        formatX: (v) => `${v}%`,
        formatValue: usd,
        zero: false,
        markers: [{ x: Number(y.toFixed(2)), label: pct(y, 2) }],
        guides: [{ y: n.p, label: 'Your price' }],
        summary: `A price of ${usd(n.p)} matches a yield of ${pct(y, 3)}, where the price curve crosses your price.`,
        table: true,
      },
    }
  },
}

/* ── Black-Scholes ─────────────────────────────────────────────── */

export function blackScholes(S: number, K: number, T: number, r: number, sigma: number, q = 0) {
  const sq = sigma * Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r - q + (sigma * sigma) / 2) * T) / sq
  const d2 = d1 - sq
  const dq = Math.exp(-q * T)
  const dr = Math.exp(-r * T)
  const call = S * dq * Phi(d1) - K * dr * Phi(d2)
  const put = K * dr * Phi(-d2) - S * dq * Phi(-d1)
  return {
    d1,
    d2,
    call,
    put,
    deltaCall: dq * Phi(d1),
    deltaPut: -dq * Phi(-d1),
    gamma: (dq * phi(d1)) / (S * sq),
    vega: (S * dq * phi(d1) * Math.sqrt(T)) / 100,
    thetaCall: (-(S * dq * phi(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * dr * Phi(d2) + q * S * dq * Phi(d1)) / 365,
    thetaPut: (-(S * dq * phi(d1) * sigma) / (2 * Math.sqrt(T)) + r * K * dr * Phi(-d2) - q * S * dq * Phi(-d1)) / 365,
    rhoCall: (K * T * dr * Phi(d2)) / 100,
    rhoPut: (-K * T * dr * Phi(-d2)) / 100,
  }
}

const bsSpec: Spec = {
  inputs: [
    choice('o', 'Option', 'call', [['call', 'Call'], ['put', 'Put']]),
    pos('S', 'Stock price', '100', '$', { half: true }),
    pos('K', 'Strike price', '100', '$', { half: true }),
    pos('d', 'Days to expiry', '365', 'days', { half: true }),
    percent('v', 'Volatility', '20', { half: true, above: 0, max: 500 }),
    percent('r', 'Risk-free rate', '5', { half: true, min: -5 }),
    percent('q', 'Dividend yield', '0', { half: true }),
  ],
  compute: ({ n, s }) => {
    const T = n.d / 365
    const x = blackScholes(n.S, n.K, T, n.r / 100, n.v / 100, n.q / 100)
    const call = s.o === 'call'
    const val = call ? x.call : x.put
    const xs = Array.from({ length: 41 }, (_, k) => Number((n.S * (0.5 + k * 0.025)).toFixed(4)))
    const now = xs.map((S) => { const b = blackScholes(S, n.K, T, n.r / 100, n.v / 100, n.q / 100); return call ? b.call : b.put })
    const payoff = xs.map((S) => Math.max(0, call ? S - n.K : n.K - S))
    const money2 = (v: number) => usd(v, 2)
    return {
      main: { label: call ? 'Call price' : 'Put price', value: val, format: (v) => usd(v, 4) },
      stats: [
        { label: call ? 'Put price' : 'Call price', value: call ? x.put : x.call, format: (v) => usd(v, 4) },
        { label: 'Delta', value: call ? x.deltaCall : x.deltaPut, format: (v) => dec(v, 4) },
        { label: 'Gamma', value: x.gamma, format: (v) => dec(v, 5) },
        { label: 'Theta a day', value: call ? x.thetaCall : x.thetaPut, format: (v) => dec(v, 4) },
        { label: 'Vega per 1%', value: x.vega, format: (v) => dec(v, 4) },
        { label: 'Rho per 1%', value: call ? x.rhoCall : x.rhoPut, format: (v) => dec(v, 4) },
      ],
      working: [
        `T = ${n.d} ÷ 365 = ${dec(T, 4)} years`,
        `d1 = (ln(S/K) + (r − q + σ²/2)T) ÷ (σ√T) = ${dec(x.d1, 5)}`,
        `d2 = d1 − σ√T = ${dec(x.d2, 5)}`,
        `N(d1) = ${dec(Phi(x.d1), 5)}, N(d2) = ${dec(Phi(x.d2), 5)}`,
        `call = S·e^(−qT)·N(d1) − K·e^(−rT)·N(d2) = ${usd(x.call, 4)}`,
        `put = K·e^(−rT)·N(−d2) − S·e^(−qT)·N(−d1) = ${usd(x.put, 4)}`,
      ],
      note: 'N is the standard normal cumulative distribution, σ the volatility, r the risk-free rate and q the dividend yield, all yearly.',
      chart: {
        kind: 'line',
        x: xs,
        series: [
          { id: 'v', label: 'Value today', values: now },
          { id: 'p', label: 'Value at expiry', values: payoff, stroke: 'dash' },
        ],
        xLabel: 'Stock price',
        formatX: (v) => `$${dec(v, 0)}`,
        readoutX: money2,
        formatValue: money2,
        markers: [{ x: xs[20]!, label: 'Now' }],
        defaultIndex: 20,
        summary: `With the stock at ${usd(n.S)} the ${call ? 'call' : 'put'} is worth ${usd(val, 2)}. The gap between the two lines is the time value, which shrinks to zero at expiry.`,
        table: true,
      },
    }
  },
}

/* ── dollar-cost averaging ─────────────────────────────────────── */

const dcaSpec: Spec = {
  inputs: [
    money('a', 'Amount each period', '200', { above: 0 }),
    { id: 'p', kind: 'text', label: 'Share price each period', value: '50 45 40 42 38 44 48 52 55 53 58 60', rows: 3, hint: 'Separate the prices with spaces, commas or new lines.' },
  ],
  compute: ({ n, s }) => {
    const { values: prices, error } = readList(s.p ?? '', 2)
    if (error) fail(error)
    if (prices.some((p) => p <= 0)) fail('Every price must be above zero.')
    let shares = 0
    const avg: number[] = []
    prices.forEach((p, k) => {
      shares += n.a / p
      avg.push(D(n.a).times(k + 1).div(shares).toNumber())
    })
    const invested = cents(D(n.a).times(prices.length))
    const last = prices[prices.length - 1]!
    const value = cents(D(shares).times(last))
    const avgCost = invested / shares
    const avgPrice = prices.reduce((x, y) => x + y, 0) / prices.length
    return {
      main: { label: 'Average cost per share', value: avgCost, format: (v) => usd(v, 2) },
      stats: [
        { label: 'Average price', value: avgPrice, format: (v) => usd(v, 2) },
        { label: 'Shares bought', value: shares, format: (v) => dec(v, 4) },
        { label: 'Invested', value: invested, format: usd },
        { label: 'Value now', value: value, format: usd },
        { label: 'Gain', value: cents(D(value).minus(invested)), format: usd },
        { label: 'Return', value: ((value - invested) / invested) * 100, format: (v) => pct(v, 2) },
      ],
      working: [
        `shares each period = ${usd(n.a)} ÷ price`,
        `total shares = ${prices.map((p) => `${usd(n.a, 0)}/${dec(p, 2)}`).slice(0, 4).join(' + ')}${prices.length > 4 ? ' + …' : ''} = ${dec(shares, 4)}`,
        `average cost = ${usd(invested)} ÷ ${dec(shares, 4)} = ${usd(avgCost, 4)}`,
        `average price = sum of prices ÷ ${prices.length} = ${usd(avgPrice, 4)}`,
        `value = ${dec(shares, 4)} × ${usd(last)} = ${usd(value)}`,
      ],
      note: 'The average cost is the harmonic mean of the prices, which is never above their plain average.',
      chart: {
        kind: 'line',
        x: prices.map((_, k) => k + 1),
        series: [
          { id: 'p', label: 'Price', values: prices },
          { id: 'a', label: 'Your average cost', values: avg, stroke: 'dash' },
        ],
        xLabel: 'Period',
        formatX: String,
        formatValue: (v) => usd(v, 2),
        zero: false,
        summary: `Buying ${usd(n.a)} each period gave an average cost of ${usd(avgCost, 2)} a share, against an average price of ${usd(avgPrice, 2)}.`,
        table: true,
      },
    }
  },
}

/* ── FIRE and withdrawals ──────────────────────────────────────── */

export function fire(spend: number, have: number, save: number, ratePct: number, wrPct: number) {
  const target = cents(D(spend).div(wrPct).times(100))
  const bal = [have]
  let b = D(have)
  let years: number | null = have >= target ? 0 : null
  for (let y = 1; y <= 80 && years === null; y++) {
    const before = b
    b = b.times(1 + ratePct / 100).plus(save)
    bal.push(cents(b))
    if (b.gte(target)) years = y - 1 + D(target).minus(before).div(b.minus(before)).toNumber()
  }
  return { target, bal, years }
}

const fireSpec: Spec = {
  inputs: [
    money('spend', 'Yearly spending in retirement', '48000', { above: 0 }),
    money('have', 'Invested now', '120000', { half: true }),
    money('save', 'Saved a year', '30000', { half: true }),
    percent('r', 'Return after inflation', '5', { half: true, min: -10 }),
    percent('wr', 'Withdrawal rate', '4', { half: true, above: 0 }),
    pos('age', 'Your age', '32', 'years', { max: 100 }),
  ],
  compute: ({ n }) => {
    const x = fire(n.spend, n.have, n.save, n.r, n.wr)
    if (x.years === null) fail('At this rate the savings never reach the target. Save more or spend less.')
    const yrs = x.years
    return {
      main: { label: 'Financial independence in', value: `${dec(yrs, 1)} years`, sub: `at age ${dec(n.age + yrs, 0)}` },
      stats: [
        { label: 'FIRE number', value: x.target, format: usd },
        { label: 'Still to save', value: Math.max(0, cents(D(x.target).minus(n.have))), format: usd },
        { label: 'Years of spending saved', value: n.have / n.spend, format: (v) => dec(v, 1) },
        { label: 'Safe yearly income', value: n.spend, format: usd0 },
      ],
      working: [
        `FIRE number = spending ÷ withdrawal rate = ${usd(n.spend)} ÷ ${n.wr}% = ${usd(x.target)}`,
        `each year: balance × (1 + ${n.r}%) + ${usd(n.save)}`,
        `the balance passes ${usd0(x.target)} after ${dec(yrs, 2)} years`,
      ],
      note: 'Returns are after inflation, so every amount is in today’s dollars.',
      chart: {
        kind: 'line',
        x: x.bal.map((_, k) => k),
        series: [{ id: 'b', label: 'Portfolio', values: x.bal }],
        xLabel: 'Year',
        formatX: String,
        readoutX: (v) => `${v}, age ${n.age + v}`,
        formatValue: usd0,
        guides: [{ y: x.target, label: 'FIRE number' }],
        summary: `Saving ${usd0(n.save)} a year at ${n.r}% real return, the portfolio reaches ${usd0(x.target)} in ${dec(yrs, 1)} years, at age ${dec(n.age + yrs, 0)}.`,
        table: true,
      },
    }
  },
}

export function withdrawals(portfolio: number, wrPct: number, returnPct: number, inflPct: number, years: number) {
  let b = D(portfolio)
  let w = D(portfolio).times(wrPct).div(100)
  const first = cents(w)
  const bal = [portfolio]
  const draws: number[] = []
  let total = D(0)
  let lasted: number | null = null
  for (let y = 1; y <= years; y++) {
    const take = w.gt(b) ? b : w
    b = b.minus(take).times(1 + returnPct / 100)
    total = total.plus(take)
    draws.push(cents(take))
    bal.push(cents(b))
    if (b.lte(0) && lasted === null) lasted = y
    w = w.times(1 + inflPct / 100)
  }
  return { first, bal, draws, total: cents(total), end: cents(b), lasted }
}

const fourSpec: Spec = {
  inputs: [
    money('p', 'Portfolio at retirement', '1000000', { above: 0 }),
    percent('wr', 'First-year withdrawal rate', '4', { half: true, above: 0 }),
    pos('y', 'Years of retirement', '30', 'years', { half: true, int: true, max: 70 }),
    percent('r', 'Yearly return', '6', { half: true, min: -20 }),
    percent('i', 'Inflation', '3', { half: true, min: -5 }),
  ],
  compute: ({ n }) => {
    const x = withdrawals(n.p, n.wr, n.r, n.i, n.y)
    return {
      main: { label: 'First-year withdrawal', value: x.first, format: usd, sub: `${usd(cents(D(x.first).div(12)))} a month, raised each year with inflation` },
      stats: [
        { label: `Balance after ${n.y} years`, value: x.end, format: usd },
        { label: 'Total withdrawn', value: x.total, format: usd },
        { label: 'Money lasts', value: x.lasted ? `${x.lasted} years` : `${n.y}+ years` },
        { label: `Withdrawal in year ${n.y}`, value: x.draws[x.draws.length - 1] ?? 0, format: usd },
      ],
      working: [
        `year 1 withdrawal = ${usd(n.p)} × ${n.wr}% = ${usd(x.first)}`,
        `each later withdrawal = last withdrawal × (1 + ${n.i}%)`,
        `each year: balance = (balance − withdrawal) × (1 + ${n.r}%)`,
        x.lasted ? `the money runs out in year ${x.lasted}` : `after ${n.y} years ${usd(x.end)} is left`,
      ],
      note: 'A fixed return hides the risk of a bad first decade. The 4% rule came from studies of historical US returns over 30 years.',
      chart: {
        kind: 'line',
        x: x.bal.map((_, k) => k),
        series: [{ id: 'b', label: 'Balance', values: x.bal }],
        xLabel: 'Year',
        formatX: String,
        formatValue: usd0,
        guides: [{ y: n.p, label: 'Start' }],
        summary: x.lasted
          ? `Withdrawing ${usd0(x.first)} in the first year and more with inflation, the money runs out in year ${x.lasted}.`
          : `Withdrawing ${usd0(x.first)} in the first year and more with inflation, ${usd0(x.end)} is left after ${n.y} years.`,
        table: true,
      },
    }
  },
}

/* ── emergency fund ────────────────────────────────────────────── */

const emergencySpec: Spec = {
  inputs: [
    money('home', 'Rent or mortgage', '1600', { half: true }),
    money('food', 'Food', '600', { half: true }),
    money('util', 'Utilities and phone', '300', { half: true }),
    money('car', 'Transport', '350', { half: true }),
    money('ins', 'Insurance and health', '250', { half: true }),
    money('debt', 'Minimum debt payments', '200', { half: true }),
    select('m', 'Months to cover', '6', [['3', '3 months'], ['6', '6 months'], ['9', '9 months'], ['12', '12 months']]),
    money('have', 'Saved now', '4000', { half: true }),
    money('save', 'Saved each month', '500', { half: true }),
  ],
  compute: ({ n, s }) => {
    const monthly = sum(n.home, n.food, n.util, n.car, n.ins, n.debt)
    if (monthly <= 0) fail('Enter at least one monthly expense.')
    const months = Number(s.m)
    const target = cents(D(monthly).times(months))
    const gap = Math.max(0, cents(D(target).minus(n.have)))
    const cover = n.have / monthly
    const toGo = gap === 0 ? 0 : n.save > 0 ? Math.ceil(gap / n.save) : null
    return {
      main: { label: 'Emergency fund goal', value: target, format: usd },
      stats: [
        { label: 'Monthly essentials', value: monthly, format: usd },
        { label: 'Still to save', value: gap, format: usd },
        { label: 'Covered now', value: `${dec(cover, 1)} months` },
        { label: 'Time to goal', value: toGo === null ? 'Add a monthly saving' : toGo === 0 ? 'Reached' : yearsMonths(toGo) },
      ],
      working: [
        `essentials = ${[n.home, n.food, n.util, n.car, n.ins, n.debt].map((v) => usd0(v)).join(' + ')} = ${usd(monthly)}`,
        `goal = ${usd(monthly)} × ${months} = ${usd(target)}`,
        `gap = ${usd(target)} − ${usd(n.have)} = ${usd(gap)}`,
        toGo ? `months to goal = ${usd(gap)} ÷ ${usd(n.save)} = ${toGo}` : 'no gap left',
      ],
      chart: {
        kind: 'gauge',
        variant: 'bar',
        value: Math.min(cover, 12),
        min: 0,
        max: 12,
        bands: [
          { to: 1, label: 'Under 1 month' },
          { to: 3, label: 'Starter' },
          { to: 6, label: 'Standard' },
          { to: 12, label: 'Strong' },
        ],
        formatValue: (v) => `${v} mo`,
        center: `${dec(cover, 1)} months covered`,
        summary: `${usd0(n.have)} covers ${dec(cover, 1)} months of essentials. The goal of ${months} months is ${usd0(target)}.`,
      },
    }
  },
}

/* ── real rate of return ───────────────────────────────────────── */

export const realRate = (nominalPct: number, inflPct: number) => ((1 + nominalPct / 100) / (1 + inflPct / 100) - 1) * 100

const realSpec: Spec = {
  inputs: [
    percent('n', 'Nominal return', '7', { half: true, min: -100 }),
    percent('i', 'Inflation', '3', { half: true, min: -50 }),
    money('a', 'Amount invested', '10000', { half: true }),
    pos('y', 'Years', '20', 'years', { half: true, int: true, max: 100 }),
  ],
  compute: ({ n }) => {
    const real = realRate(n.n, n.i)
    const xs = Array.from({ length: n.y + 1 }, (_, k) => k)
    const nom = xs.map((k) => cents(D(n.a).times(D(1 + n.n / 100).pow(k))))
    const rl = xs.map((k) => cents(D(n.a).times(D(1 + real / 100).pow(k))))
    return {
      main: { label: 'Real rate of return', value: real, format: (v) => pct(v, 3) },
      stats: [
        { label: 'Simple estimate', value: n.n - n.i, format: (v) => pct(v, 2) },
        { label: `Value in ${n.y} years`, value: nom[n.y]!, format: usd },
        { label: 'In today’s dollars', value: rl[n.y]!, format: usd },
        { label: 'Lost to inflation', value: cents(D(nom[n.y]!).minus(rl[n.y]!)), format: usd },
      ],
      working: [
        `real = (1 + nominal) ÷ (1 + inflation) − 1`,
        `real = (1 + ${n.n}%) ÷ (1 + ${n.i}%) − 1 = ${pct(real, 4)}`,
        `estimate: ${n.n}% − ${n.i}% = ${pct(n.n - n.i, 2)}`,
        `${usd(n.a)} × (1 + ${pct(real, 4)})^${n.y} = ${usd(rl[n.y]!)} in today’s dollars`,
      ],
      chart: {
        kind: 'line',
        x: xs,
        series: [
          { id: 'n', label: 'Nominal', values: nom },
          { id: 'r', label: 'In today’s dollars', values: rl, stroke: 'dash' },
        ],
        xLabel: 'Year',
        formatX: String,
        formatValue: usd0,
        summary: `${usd0(n.a)} at ${n.n}% becomes ${usd0(nom[n.y]!)} in ${n.y} years, but with ${n.i}% inflation that buys what ${usd0(rl[n.y]!)} buys today.`,
        table: true,
      },
    }
  },
}

/* ── time value of money ───────────────────────────────────────── */

export function tvmFv(pv: number, pmt: number, i: number, n: number, due: boolean) {
  const g = Math.pow(1 + i, n)
  const a = i === 0 ? n : ((g - 1) / i) * (due ? 1 + i : 1)
  return pv * g + pmt * a
}

const tvmSpec: Spec = {
  inputs: [
    select('solve', 'Solve for', 'fv', [['fv', 'Future value'], ['pv', 'Present value'], ['pmt', 'Payment'], ['n', 'Number of years'], ['r', 'Interest rate']]),
    money('pv', 'Present value', '10000', { when: (s) => s.solve !== 'pv' }),
    money('pmt', 'Payment each period', '200', { when: (s) => s.solve !== 'pmt' }),
    money('fv', 'Future value', '100000', { when: (s) => s.solve !== 'fv' }),
    percent('r', 'Annual interest rate', '6', { when: (s) => s.solve !== 'r', half: true }),
    pos('n', 'Years', '15', 'years', { when: (s) => s.solve !== 'n', half: true, max: 200 }),
    select('f', 'Periods a year', '12', FREQ, { half: true }),
    choice('t', 'Payments at', 'end', TIMING),
  ],
  compute: ({ n, s }) => {
    const f = Number(s.f)
    const due = s.t === 'start'
    let { pv, pmt, fv, r, n: yrs } = n
    const fvOf = (p: number, m: number, rate: number, y: number) => tvmFv(p, m, rate / 100 / f, Math.round(y * f * 1e6) / 1e6, due)
    if (s.solve === 'fv') fv = fvOf(pv, pmt, r, yrs)
    else if (s.solve === 'pv') {
      const g = Math.pow(1 + r / 100 / f, yrs * f)
      pv = (fv - fvOf(0, pmt, r, yrs)) / g
      if (pv < 0) fail('The payments alone grow past the future value, so no starting amount is needed.')
    } else if (s.solve === 'pmt') {
      const unit = fvOf(0, 1, r, yrs)
      pmt = (fv - fvOf(pv, 0, r, yrs)) / unit
      if (pmt < 0) fail('The present value alone grows past the future value, so no payment is needed.')
    } else if (s.solve === 'n') {
      const y = bisect((t) => fvOf(pv, pmt, r, t) - fv, 0, 500)
      if (y === null) fail('The future value is never reached at this rate.')
      yrs = y
    } else {
      const rate = bisect((x) => fvOf(pv, pmt, x, yrs) - fv, -99, 1000)
      if (rate === null) fail('No rate gives that future value.')
      r = rate
    }
    const periods = yrs * f
    const g = growth(pv, pmt, r, yrs, f, due)
    const labels: Record<string, [string, number, (v: number) => string]> = {
      fv: ['Future value', fv, usd],
      pv: ['Present value', pv, usd],
      pmt: ['Payment each period', pmt, usd],
      n: ['Years', yrs, (v) => `${dec(v, 2)} years`],
      r: ['Annual interest rate', r, (v) => pct(v, 4)],
    }
    const [label, value, format] = labels[s.solve ?? 'fv']!
    return {
      main: { label, value, format },
      stats: [
        { label: 'Periods', value: periods, format: (v) => dec(v, 2) },
        { label: 'Money put in', value: sum(pv, D(pmt).times(periods).toNumber()), format: usd },
        { label: 'Interest earned', value: cents(D(fv).minus(pv).minus(D(pmt).times(periods))), format: usd },
      ],
      working: [
        `FV = PV(1 + i)^n + PMT × ((1 + i)^n − 1) ÷ i${due ? ' × (1 + i)' : ''}`,
        `i = ${dec(r, 4)}% ÷ ${f}, n = ${dec(yrs, 4)} × ${f} = ${dec(periods, 2)}`,
        `${usd(fv)} = ${usd(pv)}(1 + i)^n + ${usd(pmt)} × ((1 + i)^n − 1) ÷ i${due ? ' × (1 + i)' : ''}`,
        s.solve === 'n' || s.solve === 'r' ? `solved by bisection to 12 significant digits` : `solved for ${label.toLowerCase()} directly`,
      ],
      note: 'Every amount here is money you put in and its growth. For a loan, use the loan calculator.',
      chart: growthChart(g, `Starting with ${usd0(pv)} and adding ${usd(pmt)} ${f === 12 ? 'a month' : f === 4 ? 'a quarter' : 'a year'} at ${pct(r, 2)}, the balance reaches ${usd0(fv)} in ${dec(yrs, 1)} years.`),
    }
  },
}

/* ── sinking fund ──────────────────────────────────────────────── */

const sinkingSpec: Spec = {
  inputs: [
    money('goal', 'Amount needed', '12000', { above: 0 }),
    pos('y', 'Years until needed', '3', 'years', { half: true, max: 100 }),
    percent('r', 'Interest rate', '4', { half: true }),
    money('have', 'Saved already', '1000', { half: true }),
    select('f', 'Deposits', '12', FREQ, { half: true }),
  ],
  compute: ({ n, s }) => {
    const f = Number(s.f)
    const periods = Math.round(n.y * f)
    const i = n.r / 100 / f
    const grown = cents(D(n.have).times(D(1 + i).pow(periods)))
    const need = cents(D(n.goal).minus(grown))
    if (need <= 0) fail(`What you have already grows to ${usd(grown)}, enough for the goal.`)
    const pay = sinkingPayment(need, i, periods)
    const g = growth(n.have, pay, n.r, n.y, f)
    return {
      main: { label: `Deposit ${f === 12 ? 'each month' : f === 4 ? 'each quarter' : 'each year'}`, value: pay, format: usd },
      stats: [
        { label: 'Deposits', value: periods, format: (v) => dec(v, 0) },
        { label: 'Total deposited', value: cents(D(pay).times(periods)), format: usd },
        { label: 'Interest earned', value: cents(D(n.goal).minus(n.have).minus(D(pay).times(periods))), format: usd },
        { label: 'Savings grow to', value: grown, format: usd },
      ],
      working: [
        `savings now grow to ${usd(n.have)} × (1 + i)^${periods} = ${usd(grown)}`,
        `still needed = ${usd(n.goal)} − ${usd(grown)} = ${usd(need)}`,
        `deposit = FV × i ÷ ((1 + i)^n − 1) = ${usd(need)} × i ÷ ((1 + i)^${periods} − 1) = ${usd(pay)}`,
      ],
      note: `i = ${n.r}% ÷ ${f} per period and n = ${periods} deposits.`,
      chart: growthChart(g, `Depositing ${usd(pay)} ${f === 12 ? 'a month' : f === 4 ? 'a quarter' : 'a year'} at ${n.r}% builds ${usd0(n.goal)} in ${n.y} years.`),
    }
  },
}

/* ── 529 plan ──────────────────────────────────────────────────── */

export function college(age: number, startAge: number, have: number, monthly: number, ratePct: number, cost: number, inflPct: number, yearsIn: number) {
  const until = startAge - age
  let total = D(0)
  for (let k = 0; k < yearsIn; k++) total = total.plus(D(cost).times(D(1 + inflPct / 100).pow(until + k)))
  const g = growth(have, monthly, ratePct, until, 12)
  const projected = g.end
  const gap = Math.max(0, cents(total.minus(projected)))
  const grownHave = D(have).times(D(1 + ratePct / 1200).pow(until * 12))
  const needMonthly = sinkingPayment(Math.max(0, total.minus(grownHave).toNumber()), ratePct / 1200, until * 12)
  return { until, total: cents(total), projected, gap, needMonthly, g }
}

const collegeSpec: Spec = {
  inputs: [
    num('age', 'Child’s age', '4', 'years', { min: 0, max: 17, int: true, half: true }),
    num('start', 'College starts at', '18', 'years', { min: 1, max: 30, int: true, half: true }),
    money('have', 'In the plan now', '8000', { half: true }),
    money('m', 'Added each month', '250', { half: true }),
    percent('r', 'Yearly return', '6', { half: true }),
    money('cost', 'Yearly cost today', '28000', { half: true, hint: 'Tuition, fees, room and board.' }),
    percent('ci', 'College cost inflation', '4', { half: true }),
    num('yrs', 'Years of college', '4', 'years', { min: 1, max: 8, int: true, half: true }),
  ],
  compute: ({ n }) => {
    if (n.start <= n.age) fail('College must start after the child’s current age.')
    const x = college(n.age, n.start, n.have, n.m, n.r, n.cost, n.ci, n.yrs)
    const share = Math.min(100, (x.projected / x.total) * 100)
    return {
      main: { label: 'Projected savings', value: x.projected, format: usd, sub: `${pct(share, 0)} of the projected cost` },
      stats: [
        { label: 'Projected cost', value: x.total, format: usd },
        { label: 'Shortfall', value: x.gap, format: usd },
        { label: 'Monthly saving to cover it all', value: x.needMonthly, format: usd },
        { label: 'Years to save', value: x.until, format: (v) => dec(v, 0) },
      ],
      working: [
        `cost of year k = ${usd(n.cost)} × (1 + ${n.ci}%)^(${x.until} + k), k = 0…${n.yrs - 1}`,
        `total cost = ${usd(x.total)}`,
        `savings = ${usd(n.have)}(1 + i)^${x.until * 12} + ${usd(n.m)} × ((1 + i)^${x.until * 12} − 1) ÷ i = ${usd(x.projected)}, i = ${n.r}% ÷ 12`,
        `monthly to cover all = (cost − grown savings) × i ÷ ((1 + i)^n − 1) = ${usd(x.needMonthly)}`,
      ],
      note: 'Money still in the plan keeps growing during college. The calculator leaves that out, so it is on the safe side.',
      chart: {
        kind: 'line',
        area: true,
        stacked: true,
        x: x.g.balance.map((_, k) => k),
        series: [
          { id: 'c', label: 'Money put in', values: x.g.contributed, paint: 'grey' },
          { id: 'g', label: 'Growth', values: x.g.balance.map((b, k) => Math.max(0, cents(D(b).minus(x.g.contributed[k]!)))), paint: 'hatch' },
        ],
        xLabel: 'Year',
        formatX: String,
        readoutX: (v) => `${v}, age ${n.age + v}`,
        formatValue: usd0,
        guides: [{ y: x.total, label: 'College cost' }],
        summary: `The plan grows to about ${usd0(x.projected)} by age ${n.start}. ${n.yrs} years of college are projected to cost ${usd0(x.total)}${x.gap ? `, a shortfall of ${usd0(x.gap)}` : ''}.`,
        table: true,
      },
    }
  },
}

/* ── HSA ───────────────────────────────────────────────────────── */

export const HSA_2026 = { self: 4400, family: 8750, catchUp: 1000 }

const hsaSpec: Spec = {
  inputs: [
    choice('cov', 'Coverage', 'self', [['self', 'Self-only'], ['family', 'Family']]),
    choice('old', 'Age 55 or older', 'no', [['no', 'No'], ['yes', 'Yes']]),
    money('you', 'You put in a year', '3400', { half: true }),
    money('emp', 'Employer puts in', '1000', { half: true }),
    select('fed', 'Federal tax bracket', '22', [['10', '10%'], ['12', '12%'], ['22', '22%'], ['24', '24%'], ['32', '32%'], ['35', '35%'], ['37', '37%']], { half: true }),
    percent('st', 'State income tax', '5', { half: true }),
    choice('pay', 'Through payroll', 'yes', [['yes', 'Yes'], ['no', 'No']]),
    percent('r', 'Yearly return', '6', { half: true }),
    pos('y', 'Years', '20', 'years', { half: true, int: true, max: 60 }),
  ],
  compute: ({ n, s }) => {
    const limit = (s.cov === 'family' ? HSA_2026.family : HSA_2026.self) + (s.old === 'yes' ? HSA_2026.catchUp : 0)
    const total = sum(n.you, n.emp)
    if (total > limit) fail(`Together that is ${usd0(total)}, above the 2026 limit of ${usd0(limit)}.`)
    const fica = s.pay === 'yes' ? 7.65 : 0
    const rate = Number(s.fed) + n.st + fica
    const save = pctOf2(n.you, rate)
    const g = growth(0, total, n.r, n.y, 1)
    return {
      main: { label: 'Tax saved this year', value: save, format: usd },
      stats: [
        { label: '2026 limit', value: limit, format: usd0 },
        { label: 'Room left', value: cents(D(limit).minus(total)), format: usd },
        { label: `Balance in ${n.y} years`, value: g.end, format: usd },
        { label: 'Growth, tax free', value: cents(D(g.end).minus(g.put)), format: usd },
      ],
      working: [
        `limit = ${usd0(s.cov === 'family' ? HSA_2026.family : HSA_2026.self)}${s.old === 'yes' ? ` + ${usd0(HSA_2026.catchUp)} catch-up` : ''} = ${usd0(limit)}`,
        `tax rate saved = ${s.fed}% federal + ${n.st}% state${fica ? ' + 7.65% FICA' : ''} = ${dec(rate, 2)}%`,
        `saving = ${usd(n.you)} × ${dec(rate, 2)}% = ${usd(save)}`,
        `balance = ${usd(total)} a year at ${n.r}% for ${n.y} years = ${usd(g.end)}`,
      ],
      note: 'Employer money is already untaxed, so it is not counted in the saving. A few states, such as California and New Jersey, tax HSA contributions.',
      chart: growthChart(g, `${usd0(total)} a year at ${n.r}% grows to ${usd0(g.end)} in ${n.y} years, tax free when spent on qualified medical costs.`),
    }
  },
}
const pctOf2 = (a: number, p: number) => cents(D(a).times(p).div(100))

/* ── RMD ───────────────────────────────────────────────────────── */

/** IRS Uniform Lifetime Table (Publication 590-B, Appendix B, Table III), ages 72 to 120. */
export const UNIFORM: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8,
  85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8,
  98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5,
  111: 3.4, 112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
}
export const rmdStartAge = (birthYear: number) => (birthYear >= 1960 ? 75 : birthYear >= 1951 ? 73 : 72)
export const uniform = (age: number) => UNIFORM[Math.min(120, age)] ?? 2.0

const TAX_YEAR = 2026

const rmdSpec: Spec = {
  inputs: [
    num('b', 'Year of birth', '1952', undefined, { int: true, min: 1900, max: 2010 }),
    money('bal', 'Balance on Dec 31, 2025', '500000', { above: 0 }),
    percent('r', 'Yearly return', '5', { min: -50 }),
  ],
  compute: ({ n }) => {
    const age = TAX_YEAR - n.b
    const start = rmdStartAge(n.b)
    const first = Math.max(age, start)
    let b = D(n.bal).times(D(1 + n.r / 100).pow(first - age))
    const ages: number[] = []
    const amounts: number[] = []
    for (let a = first; a < first + 20 && a <= 120; a++) {
      const r = cents(b.div(uniform(a)))
      ages.push(a)
      amounts.push(r)
      b = b.minus(r).times(1 + n.r / 100)
    }
    const now = age >= start
    const firstAmt = amounts[0] ?? 0
    return {
      main: now
        ? { label: `RMD for ${TAX_YEAR}`, value: firstAmt, format: usd, sub: `age ${age}, factor ${uniform(age).toFixed(1)}` }
        : { label: `First RMD at age ${start}`, value: firstAmt, format: usd, sub: `for ${TAX_YEAR + start - age}, estimated` },
      stats: [
        { label: 'Distribution period', value: uniform(first).toFixed(1) },
        { label: 'Share of balance', value: (1 / uniform(first)) * 100, format: (v) => pct(v, 2) },
        { label: 'RMD start age', value: start, format: String },
        { label: 'Deadline', value: age > start ? `Dec 31, ${TAX_YEAR}` : `April 1, ${n.b + start + 1}` },
      ],
      working: [
        `born ${n.b}: RMDs start at age ${start}`,
        now ? `age at the end of ${TAX_YEAR} = ${age}` : `the balance grows ${first - age} years at ${n.r}% first`,
        `RMD = balance ÷ distribution period = ${usd(cents(D(firstAmt).times(uniform(first))))} ÷ ${uniform(first).toFixed(1)} = ${usd(firstAmt)}`,
        `later years: (balance − RMD) × (1 + ${n.r}%) ÷ next factor`,
      ],
      note: 'If your spouse is the sole beneficiary and more than 10 years younger, the IRS Joint Life table gives a smaller RMD.',
      chart: {
        kind: 'stacked',
        categories: ages,
        series: [{ id: 'r', label: 'RMD', values: amounts }],
        categoryLabel: 'Age',
        formatValue: usd0,
        summary: `At age ${first} the RMD is ${usd0(firstAmt)}. The factor shrinks each year, so the share you must take grows from ${pct((1 / uniform(first)) * 100, 1)} to ${pct((1 / uniform(ages[ages.length - 1]!)) * 100, 1)}.`,
        table: true,
      },
    }
  },
}

/* ── pension ───────────────────────────────────────────────────── */

const pensionSpec: Spec = {
  inputs: [
    money('sal', 'Final average salary', '85000', { above: 0 }),
    pos('yrs', 'Years of service', '25', 'years', { half: true, max: 60 }),
    percent('mult', 'Benefit multiplier', '2', { half: true, above: 0, max: 5 }),
    num('age', 'Age when it starts', '62', 'years', { half: true, min: 40, max: 80 }),
    num('life', 'Plan to age', '90', 'years', { half: true, min: 41, max: 120 }),
    percent('cola', 'Yearly cost-of-living raise', '2', { half: true }),
    percent('d', 'Discount rate', '5', { half: true, hint: 'To value it as a lump sum.' }),
  ],
  compute: ({ n }) => {
    if (n.life <= n.age) fail('The plan-to age must be after the start age.')
    const yearly = cents(D(n.sal).times(n.yrs).times(n.mult).div(100))
    const years = Math.round(n.life - n.age)
    let pv = D(0)
    let cum = D(0)
    const cumulative: number[] = [0]
    for (let t = 0; t < years; t++) {
      const pay = D(yearly).times(D(1 + n.cola / 100).pow(t))
      pv = pv.plus(pay.div(D(1 + n.d / 100).pow(t)))
      cum = cum.plus(pay)
      cumulative.push(cents(cum))
    }
    const lump = cents(pv)
    const ages = cumulative.map((_, k) => n.age + k)
    const be = cumulative.findIndex((c) => c >= lump)
    return {
      main: { label: 'Yearly pension', value: yearly, format: usd, sub: `${usd(cents(D(yearly).div(12)))} a month` },
      stats: [
        { label: 'Replaces', value: (yearly / n.sal) * 100, format: (v) => `${dec(v, 1)}% of salary` },
        { label: 'Lump-sum value', value: lump, format: usd },
        { label: `Total to age ${n.life}`, value: cents(cum), format: usd },
        { label: 'Payments pass lump sum', value: be > 0 ? `age ${n.age + be}` : 'never' },
      ],
      working: [
        `pension = salary × years × multiplier = ${usd(n.sal)} × ${n.yrs} × ${n.mult}% = ${usd(yearly)}`,
        `payment in year t = ${usd(yearly)} × (1 + ${n.cola}%)^t`,
        `lump-sum value = Σ payment ÷ (1 + ${n.d}%)^t over ${years} years = ${usd(lump)}`,
      ],
      chart: {
        kind: 'line',
        x: ages,
        series: [{ id: 'c', label: 'Pension received', values: cumulative }],
        xLabel: 'Age',
        formatX: String,
        formatValue: usd0,
        guides: [{ y: lump, label: 'Lump-sum value' }],
        summary: `A pension of ${usd0(yearly)} a year from age ${n.age} pays ${usd0(cents(cum))} by age ${n.life}. Discounted at ${n.d}%, it is worth ${usd0(lump)} today.`,
        table: true,
      },
    }
  },
}

/* ── APY ───────────────────────────────────────────────────────── */

const COMPOUND = [['365', 'Daily'], ['12', 'Monthly'], ['4', 'Quarterly'], ['2', 'Twice a year'], ['1', 'Yearly'], ['0', 'Continuous']] as const
export const apyOf = (aprPct: number, m: number) => (m === 0 ? Math.expm1(aprPct / 100) : Math.pow(1 + aprPct / 100 / m, m) - 1) * 100
export const aprOfApy = (apyPct: number, m: number) => (m === 0 ? Math.log1p(apyPct / 100) : m * (Math.pow(1 + apyPct / 100, 1 / m) - 1)) * 100

const apySpec: Spec = {
  inputs: [
    choice('dir', 'Convert', 'apr', [['apr', 'APR to APY'], ['apy', 'APY to APR']]),
    percent('r', (s) => (s.dir === 'apy' ? 'APY' : 'APR (nominal rate)'), '4.5', { min: 0, max: 1000 }),
    select('m', 'Compounding', '365', COMPOUND),
    money('dep', 'Balance', '10000'),
  ],
  compute: ({ n, s }) => {
    const m = Number(s.m)
    const apr = s.dir === 'apy' ? aprOfApy(n.r, m) : n.r
    const apy = s.dir === 'apy' ? n.r : apyOf(n.r, m)
    const earned = cents(D(n.dep).times(apy).div(100))
    const mName = COMPOUND.find((c) => c[0] === s.m)?.[1].toLowerCase()
    return {
      main: s.dir === 'apy' ? { label: 'APR', value: apr, format: (v) => pct(v, 4) } : { label: 'APY', value: apy, format: (v) => pct(v, 4) },
      stats: [
        { label: 'Interest in a year', value: earned, format: usd },
        { label: 'Balance after a year', value: sum(n.dep, earned), format: usd },
        { label: 'Difference', value: apy - apr, format: (v) => `${dec(v, 4)} pts` },
      ],
      working:
        m === 0
          ? [`APY = e^APR − 1 = e^${dec(apr / 100, 6)} − 1 = ${pct(apy, 4)}`, `APR = ln(1 + APY) = ${pct(apr, 4)}`, `interest = ${usd(n.dep)} × ${pct(apy, 4)} = ${usd(earned)}`]
          : [`APY = (1 + APR ÷ m)^m − 1, m = ${m}`, `APY = (1 + ${dec(apr, 6)}% ÷ ${m})^${m} − 1 = ${pct(apy, 4)}`, `APR = m × ((1 + APY)^(1/m) − 1) = ${pct(apr, 4)}`, `interest = ${usd(n.dep)} × ${pct(apy, 4)} = ${usd(earned)}`],
      chart: {
        kind: 'bars',
        items: COMPOUND.map(([v, l]) => ({ label: l, value: apyOf(apr, Number(v)), highlight: v === s.m })),
        formatValue: (v) => pct(v, 4),
        summary: `An APR of ${pct(apr, 3)} compounded ${mName} is an APY of ${pct(apy, 3)}. More frequent compounding raises the APY a little, up to the continuous limit.`,
        table: true,
        columns: ['Compounding', 'APY'],
      },
    }
  },
}

/* ── tax-equivalent yield ──────────────────────────────────────── */

export const teY = (yieldPct: number, fedPct: number, statePct: number) => yieldPct / ((1 - fedPct / 100) * (1 - statePct / 100))

const BRACKETS = [10, 12, 22, 24, 32, 35, 37]
const teySpec: Spec = {
  inputs: [
    percent('y', 'Tax-free yield', '3.5', { above: 0 }),
    select('fed', 'Federal tax bracket', '24', BRACKETS.map((b) => [String(b), `${b}%`] as const), { half: true }),
    percent('st', 'State income tax', '5', { half: true }),
    choice('ex', 'Bond is also free of state tax', 'yes', [['yes', 'Yes'], ['no', 'No']]),
  ],
  compute: ({ n, s }) => {
    const st = s.ex === 'yes' ? n.st : 0
    const fed = Number(s.fed)
    const tey = teY(n.y, fed, st)
    const combined = (1 - (1 - fed / 100) * (1 - st / 100)) * 100
    return {
      main: { label: 'Tax-equivalent yield', value: tey, format: (v) => pct(v, 3) },
      stats: [
        { label: 'Combined tax rate', value: combined, format: (v) => pct(v, 2) },
        { label: 'Taxable yield to beat', value: tey, format: (v) => pct(v, 2) },
      ],
      working: [
        `combined rate = 1 − (1 − ${fed}%) × (1 − ${st}%) = ${pct(combined, 3)}`,
        `TEY = tax-free yield ÷ (1 − combined rate) = ${n.y}% ÷ ${dec(1 - combined / 100, 5)} = ${pct(tey, 3)}`,
      ],
      note: s.ex === 'yes' ? 'Bonds of your own state are usually free of state tax too.' : 'Only federal tax is saved, so the state rate is left out.',
      chart: {
        kind: 'bars',
        items: BRACKETS.map((b) => ({ label: `${b}% bracket`, value: teY(n.y, b, st), highlight: b === fed })),
        formatValue: (v) => pct(v, 2),
        summary: `In the ${fed}% bracket, a ${n.y}% tax-free yield matches a taxable yield of ${pct(tey, 2)}. The higher the bracket, the more the tax exemption is worth.`,
        table: true,
        columns: ['Federal bracket', 'Tax-equivalent yield'],
      },
    }
  },
}

export const specs: Record<string, Spec> = {
  'annuity-calculator': annuitySpec,
  'annuity-payout-calculator': payoutSpec,
  'bond-price-calculator': bondSpec,
  'yield-to-maturity-calculator': ytmSpec,
  'black-scholes-calculator': bsSpec,
  'dollar-cost-averaging-calculator': dcaSpec,
  'fire-calculator': fireSpec,
  '4-percent-rule-calculator': fourSpec,
  'emergency-fund-calculator': emergencySpec,
  'real-rate-of-return-calculator': realSpec,
  'time-value-of-money-calculator': tvmSpec,
  'sinking-fund-calculator': sinkingSpec,
  '529-plan-calculator': collegeSpec,
  'hsa-calculator': hsaSpec,
  'rmd-calculator': rmdSpec,
  'pension-calculator': pensionSpec,
  'apy-calculator': apySpec,
  'tax-equivalent-yield-calculator': teySpec,
}
