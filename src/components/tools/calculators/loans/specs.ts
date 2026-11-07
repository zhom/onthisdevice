/** Loans and mortgages. Money in decimal.js (engine/money), rounded to cents where a lender rounds. */
import { choice, money, num, percent, pos, select } from '../engine/fields'
import { dec, pct, usd, usd0, yearsMonths } from '../engine/format'
import { D, amortize, byYear, cents, monthlyPayment, payDown, pctOf, sum, yearlyBalances } from '../engine/money'
import { aprOf } from '@/components/tools/calc/money-math'
import { fail } from '../engine/types'
import type { Ctx, Out, Spec } from '../engine/types'

const scheduleCsv = (filename: string, rows: { interest: number; principal: number; balance: number }[], label = 'Month') => ({
  filename,
  columns: [label, 'Interest', 'Principal', 'Balance'],
  rows: rows.map((r, k) => [k + 1, r.interest.toFixed(2), r.principal.toFixed(2), r.balance.toFixed(2)]),
})

/* ── biweekly mortgage ─────────────────────────────────────────── */

export function biweekly(principal: number, ratePct: number, years: number) {
  const monthly = monthlyPayment(principal, ratePct, years * 12)
  const m = amortize({ principal, annualPct: ratePct, months: years * 12 })
  const half = cents(D(monthly).div(2))
  const b = payDown(principal, ratePct / 100 / 26, half)
  return { monthly, half, monthlyInterest: m.totalInterest, biweeklyInterest: b.interest, biweeklyRows: b.rows, monthlyRows: m.rows, payments: b.rows.length }
}

const biweeklySpec: Spec = {
  inputs: [money('p', 'Loan amount', '300000', { above: 0 }), percent('r', 'Interest rate', '6.5', { half: true }), select('y', 'Term', '30', [['15', '15 years'], ['20', '20 years'], ['30', '30 years']], { half: true })],
  compute: ({ n, s }) => {
    const years = Number(s.y)
    const x = biweekly(n.p, n.r, years)
    const bYears = x.payments / 26
    const saved = cents(D(x.monthlyInterest).minus(x.biweeklyInterest))
    const mBal = yearlyBalances(n.p, x.monthlyRows)
    const bBal = yearlyBalances(n.p, x.biweeklyRows, 26)
    const len = Math.max(mBal.length, bBal.length)
    const pad = (a: number[]) => [...a, ...Array<number>(len - a.length).fill(0)]
    return {
      main: { label: 'Every two weeks', value: x.half, format: usd },
      stats: [
        { label: 'Monthly payment', value: x.monthly, format: usd },
        { label: 'Interest saved', value: saved, format: usd },
        { label: 'Paid off in', value: `${dec(bYears, 1)} years` },
        { label: 'Time saved', value: `${dec(years - bYears, 1)} years` },
      ],
      working: [
        `monthly payment = P × i(1 + i)^n ÷ ((1 + i)^n − 1), i = ${n.r}% ÷ 12, n = ${years * 12} → ${usd(x.monthly)}`,
        `biweekly payment = ${usd(x.monthly)} ÷ 2 = ${usd(x.half)}, 26 times a year = ${usd(cents(D(x.half).times(26)))}`,
        `that is 13 monthly payments a year instead of 12`,
        `interest each period = balance × ${n.r}% ÷ 26`,
        `total interest: monthly ${usd(x.monthlyInterest)}, biweekly ${usd(x.biweeklyInterest)}, saved ${usd(saved)}`,
      ],
      note: 'P is the loan amount, i the monthly rate and n the number of monthly payments.',
      chart: {
        kind: 'line',
        x: Array.from({ length: len }, (_, k) => k),
        series: [
          { id: 'm', label: 'Monthly', values: pad(mBal) },
          { id: 'b', label: 'Every two weeks', values: pad(bBal) },
        ],
        xLabel: 'Year',
        formatX: String,
        formatValue: usd0,
        summary: `Paying ${usd(x.half)} every two weeks clears the loan in ${dec(bYears, 1)} years instead of ${years}, and saves ${usd0(saved)} of interest.`,
        table: true,
      },
      csv: scheduleCsv('biweekly-mortgage-schedule.csv', x.biweeklyRows, 'Payment'),
    }
  },
}

/* ── HELOC ─────────────────────────────────────────────────────── */

export function heloc(balance: number, ratePct: number, drawYears: number, repayYears: number) {
  const io = pctOf(balance, D(ratePct).div(12))
  const pay = monthlyPayment(balance, ratePct, repayYears * 12)
  const rep = amortize({ principal: balance, annualPct: ratePct, months: repayYears * 12 })
  const drawInterest = cents(D(io).times(drawYears * 12))
  return { io, pay, rep, drawInterest, total: cents(D(drawInterest).plus(rep.totalInterest)) }
}

const helocSpec: Spec = {
  inputs: [
    money('b', 'Amount drawn', '50000', { above: 0 }),
    percent('r', 'Interest rate', '8.25'),
    pos('d', 'Draw period', '10', 'years', { half: true, int: true, max: 30 }),
    pos('t', 'Repayment period', '20', 'years', { half: true, int: true, max: 30 }),
  ],
  compute: ({ n }) => {
    const x = heloc(n.b, n.r, n.d, n.t)
    const years = n.d + n.t
    const rep = byYear(x.rep.rows)
    const cats = Array.from({ length: years }, (_, k) => k + 1)
    const ioYear = cents(D(x.io).times(12))
    return {
      main: { label: 'Interest-only payment', value: x.io, format: usd, sub: `for the ${n.d}-year draw period` },
      stats: [
        { label: 'Repayment payment', value: x.pay, format: usd },
        { label: 'Payment rise', value: cents(D(x.pay).minus(x.io)), format: usd },
        { label: 'Interest in draw period', value: x.drawInterest, format: usd },
        { label: 'Total interest', value: x.total, format: usd },
      ],
      working: [
        `draw period: ${usd(n.b)} × ${n.r}% ÷ 12 = ${usd(x.io)} a month, interest only`,
        `repayment: ${usd(n.b)} over ${n.t * 12} months at ${n.r}% → ${usd(x.pay)} a month`,
        `interest = ${usd(x.drawInterest)} + ${usd(x.rep.totalInterest)} = ${usd(x.total)}`,
      ],
      note: 'The rate of most lines of credit is variable. The calculator holds it fixed.',
      chart: {
        kind: 'stacked',
        categories: cats,
        series: [
          { id: 'i', label: 'Interest', values: cats.map((y) => (y <= n.d ? ioYear : (rep[y - n.d - 1]?.interest ?? 0))) },
          { id: 'p', label: 'Principal', values: cats.map((y) => (y <= n.d ? 0 : (rep[y - n.d - 1]?.principal ?? 0))) },
        ],
        categoryLabel: 'Year',
        formatValue: usd0,
        showTotal: true,
        summary: `The payment is ${usd(x.io)} for ${n.d} years, then ${usd(x.pay)} for ${n.t} years. The line costs ${usd0(x.total)} in interest over ${years} years.`,
        table: true,
      },
      csv: scheduleCsv('heloc-repayment-schedule.csv', x.rep.rows),
    }
  },
}

/* ── home equity ───────────────────────────────────────────────── */

export function equity(value: number, mortgage: number, other: number, cltvPct: number) {
  const owed = sum(mortgage, other)
  const eq = cents(D(value).minus(owed))
  const cltv = value > 0 ? (owed / value) * 100 : 0
  const borrow = Math.max(0, cents(D(value).times(cltvPct).div(100).minus(owed)))
  return { owed, eq, cltv, ltv: (mortgage / value) * 100, borrow, eqPct: (eq / value) * 100 }
}

const equitySpec: Spec = {
  inputs: [
    money('v', 'Home value', '450000', { above: 0 }),
    money('m', 'Mortgage balance', '260000', { half: true }),
    money('o', 'Other loans on the home', '0', { half: true }),
    percent('c', 'Lender’s maximum CLTV', '85', { hint: 'Most lenders allow 80% to 90%.' }),
  ],
  compute: ({ n }) => {
    const x = equity(n.v, n.m, n.o, n.c)
    if (x.eq < 0) fail(`You owe ${usd(x.owed)}, more than the home is worth.`)
    return {
      main: { label: 'Home equity', value: x.eq, format: usd, sub: `${pct(x.eqPct, 1)} of the home value` },
      stats: [
        { label: 'You can borrow', value: x.borrow, format: usd },
        { label: 'Loan-to-value', value: x.ltv, format: (v) => pct(v, 1) },
        { label: 'Combined LTV', value: x.cltv, format: (v) => pct(v, 1) },
        { label: 'Total owed', value: x.owed, format: usd },
      ],
      working: [
        `equity = value − owed = ${usd(n.v)} − ${usd(x.owed)} = ${usd(x.eq)}`,
        `CLTV = owed ÷ value = ${usd(x.owed)} ÷ ${usd(n.v)} = ${pct(x.cltv, 2)}`,
        `borrowing limit = value × ${n.c}% − owed = ${usd(cents(D(n.v).times(n.c).div(100)))} − ${usd(x.owed)} = ${usd(x.borrow)}`,
      ],
      chart: {
        kind: 'donut',
        parts: [
          { label: 'Mortgage', value: n.m, paint: 'ink' },
          { label: 'Other loans', value: n.o, paint: 'grey' },
          { label: 'Equity you can borrow', value: x.borrow, paint: 'hatch' },
          { label: 'Equity the lender keeps', value: Math.max(0, x.eq - x.borrow), paint: 'dots' },
        ],
        center: pct(x.eqPct, 0),
        formatValue: usd0,
        summary: `Of a ${usd0(n.v)} home, you own ${usd0(x.eq)}. At a ${n.c}% CLTV limit, ${usd0(x.borrow)} of it can be borrowed.`,
        table: true,
      },
    }
  },
}

/* ── PITI ──────────────────────────────────────────────────────── */

export function piti(price: number, downPct: number, ratePct: number, years: number, taxYear: number, insYear: number, pmiPct: number, hoa: number) {
  const loan = cents(D(price).times(D(100).minus(downPct)).div(100))
  const pi = monthlyPayment(loan, ratePct, years * 12)
  const tax = cents(D(taxYear).div(12))
  const ins = cents(D(insYear).div(12))
  const pmi = downPct < 20 ? cents(D(loan).times(pmiPct).div(1200)) : 0
  return { loan, pi, tax, ins, pmi, hoa, total: sum(pi, tax, ins, pmi, hoa) }
}

const pitiSpec: Spec = {
  inputs: [
    money('price', 'Home price', '400000', { above: 0 }),
    percent('down', 'Down payment', '10', { half: true, max: 99 }),
    percent('r', 'Interest rate', '6.5', { half: true }),
    select('y', 'Term', '30', [['15', '15 years'], ['20', '20 years'], ['30', '30 years']]),
    money('tax', 'Property tax a year', '4800', { half: true }),
    money('ins', 'Home insurance a year', '1800', { half: true }),
    percent('pmi', 'PMI rate a year', '0.6', { half: true, hint: 'Charged when the down payment is under 20%.' }),
    money('hoa', 'HOA dues a month', '0', { half: true }),
  ],
  compute: ({ n, s }) => {
    const x = piti(n.price, n.down, n.r, Number(s.y), n.tax, n.ins, n.pmi, n.hoa)
    return {
      main: { label: 'Monthly payment (PITI)', value: x.total, format: usd },
      stats: [
        { label: 'Principal and interest', value: x.pi, format: usd },
        { label: 'Property tax', value: x.tax, format: usd },
        { label: 'Insurance', value: x.ins, format: usd },
        { label: 'PMI', value: x.pmi, format: usd },
      ],
      working: [
        `loan = ${usd(n.price)} × (100% − ${n.down}%) = ${usd(x.loan)}`,
        `P&I = loan × i(1 + i)^n ÷ ((1 + i)^n − 1), i = ${n.r}% ÷ 12, n = ${Number(s.y) * 12} → ${usd(x.pi)}`,
        `taxes = ${usd(n.tax)} ÷ 12 = ${usd(x.tax)}; insurance = ${usd(n.ins)} ÷ 12 = ${usd(x.ins)}`,
        n.down < 20 ? `PMI = ${usd(x.loan)} × ${n.pmi}% ÷ 12 = ${usd(x.pmi)}` : 'PMI = $0 (down payment of 20% or more)',
        `PITI = ${usd(x.pi)} + ${usd(x.tax)} + ${usd(x.ins)} + ${usd(x.pmi)}${x.hoa ? ` + ${usd(x.hoa)} HOA` : ''} = ${usd(x.total)}`,
      ],
      chart: {
        kind: 'donut',
        parts: [
          { label: 'Principal and interest', value: x.pi },
          { label: 'Property tax', value: x.tax },
          { label: 'Insurance', value: x.ins },
          { label: 'PMI', value: x.pmi },
          ...(x.hoa ? [{ label: 'HOA', value: x.hoa, paint: 'paper' as const }] : []),
        ],
        center: usd0(x.total),
        formatValue: usd,
        summary: `Of the ${usd(x.total)} monthly payment, ${usd(x.pi)} is principal and interest and ${usd(cents(D(x.total).minus(x.pi)))} is taxes, insurance${x.pmi ? ', PMI' : ''}${x.hoa ? ' and HOA dues' : ''}.`,
        table: true,
      },
    }
  },
}

/* ── closing costs ─────────────────────────────────────────────── */

export function closing(price: number, downPct: number, o: { orig: number; points: number; fixed: number; title: number; transfer: number; prepaid: number }) {
  const loan = cents(D(price).times(D(100).minus(downPct)).div(100))
  const items = [
    { label: 'Origination fee', value: pctOf(loan, o.orig) },
    { label: 'Discount points', value: pctOf(loan, o.points) },
    { label: 'Appraisal, inspection, credit', value: o.fixed },
    { label: 'Title and settlement', value: pctOf(price, o.title) },
    { label: 'Transfer and recording taxes', value: pctOf(price, o.transfer) },
    { label: 'Prepaid items and escrow', value: o.prepaid },
  ]
  const total = sum(...items.map((i) => i.value))
  const down = cents(D(price).minus(loan))
  return { loan, items, total, down, cash: sum(total, down) }
}

const closingSpec: Spec = {
  inputs: [
    money('price', 'Home price', '400000', { above: 0 }),
    percent('down', 'Down payment', '20', { max: 100 }),
    percent('orig', 'Origination fee', '1', { half: true, hint: '% of the loan' }),
    num('points', 'Discount points', '0', 'pts', { half: true, min: 0, max: 10, hint: '1 point = 1% of the loan' }),
    money('fixed', 'Appraisal, inspection, credit report', '1200'),
    percent('title', 'Title and settlement', '0.5', { half: true, hint: '% of the price' }),
    percent('transfer', 'Transfer taxes', '0.3', { half: true, hint: '% of the price' }),
    money('prepaid', 'Prepaid tax, insurance and interest', '3500'),
  ],
  compute: ({ n }) => {
    const x = closing(n.price, n.down, { orig: n.orig, points: n.points, fixed: n.fixed, title: n.title, transfer: n.transfer, prepaid: n.prepaid })
    const share = (x.total / n.price) * 100
    return {
      main: { label: 'Closing costs', value: x.total, format: usd, sub: `${pct(share, 2)} of the price` },
      stats: [
        { label: 'Cash to close', value: x.cash, format: usd },
        { label: 'Down payment', value: x.down, format: usd },
        { label: 'Loan amount', value: x.loan, format: usd },
      ],
      working: [
        `loan = ${usd(n.price)} − ${usd(x.down)} = ${usd(x.loan)}`,
        ...x.items.map((i) => `${i.label.toLowerCase()} = ${usd(i.value)}`),
        `closing costs = ${usd(x.total)}; cash to close = ${usd(x.total)} + ${usd(x.down)} = ${usd(x.cash)}`,
      ],
      note: 'Your Loan Estimate lists the real fees within three business days of applying.',
      chart: {
        kind: 'bars',
        items: x.items.map((i) => ({ ...i, highlight: i.value === Math.max(...x.items.map((j) => j.value)) })),
        formatValue: usd,
        summary: `Closing costs come to ${usd0(x.total)}, ${pct(share, 1)} of the price. With the down payment you need ${usd0(x.cash)} at closing.`,
        table: true,
        columns: ['Item', 'Cost'],
      },
    }
  },
}

/* ── property tax ──────────────────────────────────────────────── */

export function propertyTax(value: number, assessPct: number, exemption: number, rate: number, mills: boolean) {
  const assessed = cents(D(value).times(assessPct).div(100))
  const taxable = Math.max(0, cents(D(assessed).minus(exemption)))
  const tax = cents(mills ? D(taxable).times(rate).div(1000) : D(taxable).times(rate).div(100))
  return { assessed, taxable, tax, monthly: cents(D(tax).div(12)), effective: (tax / value) * 100 }
}

const propertyTaxSpec: Spec = {
  inputs: [
    money('v', 'Market value', '350000', { above: 0 }),
    percent('a', 'Assessment ratio', '100', { hint: 'Share of the value that is taxed. Many places use 100%.' }),
    money('e', 'Exemptions', '0', { hint: 'For example a homestead exemption.' }),
    choice('kind', 'Rate given as', 'pct', [['pct', 'Percent'], ['mills', 'Mills']]),
    num('rate', (s) => (s.kind === 'mills' ? 'Mill rate' : 'Tax rate'), '1.1', undefined, { min: 0, unit: (s) => (s.kind === 'mills' ? 'mills' : '%') }),
  ],
  compute: ({ n, s }) => {
    const mills = s.kind === 'mills'
    const x = propertyTax(n.v, n.a, n.e, n.rate, mills)
    return {
      main: { label: 'Property tax a year', value: x.tax, format: usd },
      stats: [
        { label: 'A month', value: x.monthly, format: usd },
        { label: 'Effective rate', value: x.effective, format: (v) => pct(v, 3) },
        { label: 'Assessed value', value: x.assessed, format: usd },
        { label: 'Taxable value', value: x.taxable, format: usd },
      ],
      working: [
        `assessed = ${usd(n.v)} × ${n.a}% = ${usd(x.assessed)}`,
        `taxable = ${usd(x.assessed)} − ${usd(n.e)} = ${usd(x.taxable)}`,
        mills ? `tax = ${usd(x.taxable)} × ${n.rate} ÷ 1,000 = ${usd(x.tax)}` : `tax = ${usd(x.taxable)} × ${n.rate}% = ${usd(x.tax)}`,
        `effective rate = ${usd(x.tax)} ÷ ${usd(n.v)} = ${pct(x.effective, 3)}`,
      ],
      note: 'One mill is $1 of tax for each $1,000 of taxable value.',
      chart: {
        kind: 'gauge',
        value: x.effective,
        min: 0,
        max: 3,
        bands: [
          { to: 0.5, label: 'Low' },
          { to: 1, label: 'Below average' },
          { to: 1.5, label: 'Above average' },
          { to: 3, label: 'High' },
        ],
        formatValue: (v) => `${dec(v, 1)}%`,
        center: `${pct(x.effective, 2)}`,
        summary: `An effective rate of ${pct(x.effective, 2)} of the market value. US state averages run from about 0.3% to about 2.3%.`,
      },
    }
  },
}

/* ── interest-only loan ────────────────────────────────────────── */

export function interestOnly(principal: number, ratePct: number, ioYears: number, years: number) {
  const io = pctOf(principal, D(ratePct).div(12))
  const rest = (years - ioYears) * 12
  const after = monthlyPayment(principal, ratePct, rest)
  const rep = amortize({ principal, annualPct: ratePct, months: rest })
  const full = amortize({ principal, annualPct: ratePct, months: years * 12 })
  const total = cents(D(io).times(ioYears * 12).plus(rep.totalInterest))
  return { io, after, rep, full, total, extra: cents(D(total).minus(full.totalInterest)) }
}

const interestOnlySpec: Spec = {
  inputs: [
    money('p', 'Loan amount', '400000', { above: 0 }),
    percent('r', 'Interest rate', '7'),
    pos('io', 'Interest-only period', '10', 'years', { half: true, int: true }),
    pos('y', 'Total term', '30', 'years', { half: true, int: true, max: 50 }),
  ],
  compute: ({ n }) => {
    if (n.io >= n.y) fail('The interest-only period must be shorter than the term.')
    const x = interestOnly(n.p, n.r, n.io, n.y)
    const yearsList = Array.from({ length: n.y }, (_, k) => k + 1)
    const repYears = byYear(x.rep.rows)
    const interest = yearsList.map((y) => (y <= n.io ? cents(D(x.io).times(12)) : (repYears[y - n.io - 1]?.interest ?? 0)))
    const principal = yearsList.map((y) => (y <= n.io ? 0 : (repYears[y - n.io - 1]?.principal ?? 0)))
    return {
      main: { label: 'Interest-only payment', value: x.io, format: usd, sub: `for the first ${n.io} years` },
      stats: [
        { label: 'Payment after', value: x.after, format: usd },
        { label: 'Fully amortizing payment', value: x.full.payment, format: usd },
        { label: 'Total interest', value: x.total, format: usd },
        { label: 'Extra interest', value: x.extra, format: usd },
      ],
      working: [
        `interest-only payment = ${usd(n.p)} × ${n.r}% ÷ 12 = ${usd(x.io)}`,
        `after ${n.io} years the full ${usd(n.p)} is repaid over ${(n.y - n.io) * 12} months → ${usd(x.after)}`,
        `total interest = ${usd(x.io)} × ${n.io * 12} + ${usd(x.rep.totalInterest)} = ${usd(x.total)}`,
        `a ${n.y}-year amortizing loan pays ${usd(x.full.totalInterest)}, so interest-only costs ${usd(x.extra)} more`,
      ],
      chart: {
        kind: 'stacked',
        categories: yearsList,
        series: [
          { id: 'i', label: 'Interest', values: interest },
          { id: 'p', label: 'Principal', values: principal },
        ],
        categoryLabel: 'Year',
        formatValue: usd0,
        showTotal: true,
        summary: `For ${n.io} years each payment is all interest. Then the payment rises from ${usd(x.io)} to ${usd(x.after)} to repay the loan in ${n.y - n.io} years.`,
        table: true,
      },
      csv: scheduleCsv('interest-only-repayment.csv', x.rep.rows),
    }
  },
}

/* ── balloon loan ──────────────────────────────────────────────── */

export function balloon(principal: number, ratePct: number, amortYears: number, balloonYears: number) {
  const s = amortize({ principal, annualPct: ratePct, months: amortYears * 12 })
  const k = balloonYears * 12
  const due = s.rows[k - 1]?.balance ?? 0
  const rows = s.rows.slice(0, k)
  const interest = sum(...rows.map((r) => r.interest))
  return { payment: s.payment, due, interest, rows, paid: cents(D(s.payment).times(k)) }
}

const balloonSpec: Spec = {
  inputs: [
    money('p', 'Loan amount', '250000', { above: 0 }),
    percent('r', 'Interest rate', '7.5'),
    pos('a', 'Amortization period', '30', 'years', { half: true, int: true, max: 50 }),
    pos('b', 'Balloon due after', '7', 'years', { half: true, int: true }),
  ],
  compute: ({ n }) => {
    if (n.b >= n.a) fail('The balloon must fall due before the end of the amortization period.')
    const x = balloon(n.p, n.r, n.a, n.b)
    const bal = yearlyBalances(n.p, x.rows)
    return {
      main: { label: 'Balloon payment', value: x.due, format: usd, sub: `due after ${n.b * 12} payments` },
      stats: [
        { label: 'Monthly payment', value: x.payment, format: usd },
        { label: 'Interest paid', value: x.interest, format: usd },
        { label: 'Principal repaid', value: cents(D(n.p).minus(x.due)), format: usd },
        { label: 'Total paid', value: sum(x.paid, x.due), format: usd },
      ],
      working: [
        `payment = P × i(1 + i)^n ÷ ((1 + i)^n − 1), i = ${n.r}% ÷ 12, n = ${n.a * 12} → ${usd(x.payment)}`,
        `balance after ${n.b * 12} payments = P(1 + i)^k − PMT((1 + i)^k − 1) ÷ i = ${usd(x.due)}`,
        `total = ${usd(x.payment)} × ${n.b * 12} + ${usd(x.due)} = ${usd(sum(x.paid, x.due))}`,
      ],
      note: 'k is the number of payments made before the balloon is due.',
      chart: {
        kind: 'line',
        x: bal.map((_, k) => k),
        series: [{ id: 'b', label: 'Balance', values: bal }],
        xLabel: 'Year',
        formatX: String,
        formatValue: usd0,
        markers: [{ x: n.b, label: 'Balloon' }],
        summary: `Payments of ${usd(x.payment)} cut the balance from ${usd0(n.p)} to ${usd0(x.due)} in ${n.b} years. That balance is due in one payment.`,
        table: true,
      },
      csv: scheduleCsv('balloon-loan-schedule.csv', x.rows),
    }
  },
}

/* ── personal loan ─────────────────────────────────────────────── */

export function personalLoan(amount: number, ratePct: number, months: number, feePct: number) {
  const s = amortize({ principal: amount, annualPct: ratePct, months })
  const fee = pctOf(amount, feePct)
  const net = cents(D(amount).minus(fee))
  const apr = aprOf(net, s.payment, months) ?? ratePct
  return { s, fee, net, apr, cost: sum(s.totalInterest, fee) }
}

const personalSpec: Spec = {
  inputs: [
    money('a', 'Loan amount', '15000', { above: 0 }),
    percent('r', 'Interest rate', '11.5'),
    select('m', 'Term', '36', [['12', '12 months'], ['24', '24 months'], ['36', '36 months'], ['48', '48 months'], ['60', '60 months'], ['72', '72 months'], ['84', '84 months']], { half: true }),
    percent('f', 'Origination fee', '3', { half: true, max: 15 }),
  ],
  compute: ({ n, s }) => {
    const months = Number(s.m)
    const x = personalLoan(n.a, n.r, months, n.f)
    const years = byYear(x.s.rows)
    return {
      main: { label: 'Monthly payment', value: x.s.payment, format: usd },
      stats: [
        { label: 'APR with the fee', value: x.apr, format: (v) => pct(v, 2) },
        { label: 'You receive', value: x.net, format: usd },
        { label: 'Total interest', value: x.s.totalInterest, format: usd },
        { label: 'Interest and fee', value: x.cost, format: usd },
      ],
      working: [
        `payment = ${usd(n.a)} × i(1 + i)^${months} ÷ ((1 + i)^${months} − 1), i = ${n.r}% ÷ 12 = ${usd(x.s.payment)}`,
        `fee = ${usd(n.a)} × ${n.f}% = ${usd(x.fee)}, so you receive ${usd(x.net)}`,
        `APR: the rate at which ${months} payments of ${usd(x.s.payment)} are worth ${usd(x.net)} today = ${pct(x.apr, 2)}`,
      ],
      chart: {
        kind: 'stacked',
        categories: years.map((y) => y.year),
        series: [
          { id: 'p', label: 'Principal', values: years.map((y) => y.principal) },
          { id: 'i', label: 'Interest', values: years.map((y) => y.interest) },
        ],
        categoryLabel: 'Year',
        formatValue: usd0,
        showTotal: true,
        summary: `${months} payments of ${usd(x.s.payment)} repay ${usd0(n.a)} with ${usd0(x.s.totalInterest)} of interest. With the fee, the APR is ${pct(x.apr, 2)}.`,
        table: true,
      },
      csv: scheduleCsv('personal-loan-schedule.csv', x.s.rows),
    }
  },
}

/* ── boat, RV and motorcycle loans ─────────────────────────────── */

export function vehicleLoan(price: number, down: number, trade: number, taxPct: number, fees: number, ratePct: number, months: number) {
  const tax = pctOf(D(price).minus(trade).toNumber() > 0 ? cents(D(price).minus(trade)) : 0, taxPct)
  const financed = Math.max(0, cents(D(price).plus(tax).plus(fees).minus(down).minus(trade)))
  const s = amortize({ principal: financed, annualPct: ratePct, months })
  return { tax, financed, s, total: sum(down, trade, s.totalPaid) }
}

function vehicleSpec(kind: string, price: string, down: string, rate: string, terms: number[], term: number, fees: string): Spec {
  return {
    inputs: [
      money('price', `${kind} price`, price, { above: 0 }),
      money('down', 'Down payment', down, { half: true }),
      money('trade', 'Trade-in value', '0', { half: true }),
      percent('tax', 'Sales tax', '6', { half: true, max: 30 }),
      money('fees', 'Fees', fees, { half: true, hint: 'Title, registration, dealer fees.' }),
      percent('r', 'Interest rate', rate, { half: true }),
      select('m', 'Term', String(term), terms.map((t) => [String(t), t % 12 === 0 ? `${t / 12} years` : `${t} months`] as const), { half: true }),
    ],
    compute: ({ n, s }: Ctx): Out => {
      const months = Number(s.m)
      const x = vehicleLoan(n.price, n.down, n.trade, n.tax, n.fees, n.r, months)
      if (x.financed <= 0) fail('The down payment and trade-in cover the whole price. There is nothing to finance.')
      return {
        main: { label: 'Monthly payment', value: x.s.payment, format: usd, sub: `for ${yearsMonths(months)}` },
        stats: [
          { label: 'Amount financed', value: x.financed, format: usd },
          { label: 'Sales tax', value: x.tax, format: usd },
          { label: 'Total interest', value: x.s.totalInterest, format: usd },
          { label: 'Total cost', value: x.total, format: usd },
        ],
        working: [
          `tax = (${usd(n.price)} − ${usd(n.trade)} trade-in) × ${n.tax}% = ${usd(x.tax)}`,
          `financed = ${usd(n.price)} + ${usd(x.tax)} + ${usd(n.fees)} − ${usd(n.down)} − ${usd(n.trade)} = ${usd(x.financed)}`,
          `payment = ${usd(x.financed)} × i(1 + i)^${months} ÷ ((1 + i)^${months} − 1), i = ${n.r}% ÷ 12 = ${usd(x.s.payment)}`,
          `total cost = down + trade-in + payments = ${usd(x.total)}`,
        ],
        note: 'Most states tax the price less the trade-in. A few tax the full price.',
        chart: {
          kind: 'donut',
          parts: [
            { label: 'Price', value: n.price, paint: 'ink' },
            { label: 'Interest', value: x.s.totalInterest, paint: 'hatch' },
            { label: 'Tax and fees', value: sum(x.tax, n.fees), paint: 'grey' },
          ],
          center: usd0(x.total),
          formatValue: usd0,
          summary: `The ${kind.toLowerCase()} costs ${usd0(x.total)} in all: ${usd0(n.price)} of price, ${usd0(x.s.totalInterest)} of interest and ${usd0(sum(x.tax, n.fees))} of tax and fees.`,
          table: true,
        },
        csv: scheduleCsv(`${kind.toLowerCase()}-loan-schedule.csv`, x.s.rows),
      }
    },
  }
}

/* ── loan comparison ───────────────────────────────────────────── */

const comparisonSpec: Spec = {
  inputs: [
    money('p', 'Loan amount', '25000', { above: 0 }),
    percent('ra', 'Loan A rate', '7.9', { half: true }),
    percent('rb', 'Loan B rate', '6.4', { half: true }),
    pos('ta', 'Loan A term', '60', 'months', { half: true, int: true, max: 480 }),
    pos('tb', 'Loan B term', '48', 'months', { half: true, int: true, max: 480 }),
    money('fa', 'Loan A fees', '0', { half: true }),
    money('fb', 'Loan B fees', '450', { half: true }),
  ],
  compute: ({ n }) => {
    const a = amortize({ principal: n.p, annualPct: n.ra, months: n.ta })
    const b = amortize({ principal: n.p, annualPct: n.rb, months: n.tb })
    const ca = sum(a.totalInterest, n.fa)
    const cb = sum(b.totalInterest, n.fb)
    const ba = yearlyBalances(n.p, a.rows)
    const bb = yearlyBalances(n.p, b.rows)
    const len = Math.max(ba.length, bb.length)
    const pad = (x: number[]) => [...x, ...Array<number>(len - x.length).fill(0)]
    const cheaper = ca <= cb ? 'A' : 'B'
    return {
      main: { label: `Loan ${cheaper} costs less by`, value: Math.abs(cents(D(ca).minus(cb))), format: usd },
      stats: [
        { label: 'Loan A payment', value: a.payment, format: usd },
        { label: 'Loan B payment', value: b.payment, format: usd },
        { label: 'Loan A interest and fees', value: ca, format: usd },
        { label: 'Loan B interest and fees', value: cb, format: usd },
      ],
      working: [
        `payment = P × i(1 + i)^n ÷ ((1 + i)^n − 1), i = rate ÷ 12`,
        `A: ${n.ta} × ${usd(a.payment)}, interest ${usd(a.totalInterest)} + fees ${usd(n.fa)} = ${usd(ca)}`,
        `B: ${n.tb} × ${usd(b.payment)}, interest ${usd(b.totalInterest)} + fees ${usd(n.fb)} = ${usd(cb)}`,
        `difference = ${usd(Math.abs(cents(D(ca).minus(cb))))}`,
      ],
      chart: {
        kind: 'line',
        x: Array.from({ length: len }, (_, k) => k),
        series: [
          { id: 'a', label: 'Loan A balance', values: pad(ba) },
          { id: 'b', label: 'Loan B balance', values: pad(bb) },
        ],
        xLabel: 'Year',
        formatX: String,
        formatValue: usd0,
        summary: `Loan A costs ${usd0(ca)} and loan B ${usd0(cb)} in interest and fees. Loan ${cheaper} is cheaper; loan ${a.payment <= b.payment ? 'A' : 'B'} has the lower payment.`,
        table: true,
      },
    }
  },
}

/* ── mortgage points ───────────────────────────────────────────── */

export function points(loan: number, rate0: number, rate1: number, pts: number, years: number) {
  const cost = pctOf(loan, pts)
  const p0 = monthlyPayment(loan, rate0, years * 12)
  const p1 = monthlyPayment(loan, rate1, years * 12)
  const save = cents(D(p0).minus(p1))
  const breakeven = save > 0 ? Math.ceil(cost / save) : null
  return { cost, p0, p1, save, breakeven }
}

const pointsSpec: Spec = {
  inputs: [
    money('p', 'Loan amount', '350000', { above: 0 }),
    select('y', 'Term', '30', [['15', '15 years'], ['20', '20 years'], ['30', '30 years']]),
    percent('r0', 'Rate without points', '6.75', { half: true }),
    percent('r1', 'Rate with points', '6.25', { half: true }),
    num('pts', 'Points bought', '2', 'pts', { min: 0, max: 10, half: true }),
    pos('keep', 'Years you keep the loan', '10', 'years', { half: true, max: 40 }),
  ],
  compute: ({ n, s }) => {
    const years = Number(s.y)
    const x = points(n.p, n.r0, n.r1, n.pts, years)
    if (x.save <= 0) fail('The rate with points must be lower than the rate without points.')
    const keepM = Math.min(Math.round(n.keep * 12), years * 12)
    const step = years * 12 > 240 ? 12 : 6
    const xs = Array.from({ length: Math.floor((years * 12) / step) + 1 }, (_, k) => k * step)
    const net = xs.map((m) => cents(D(x.save).times(m).minus(x.cost)))
    const atKeep = cents(D(x.save).times(keepM).minus(x.cost))
    return {
      main: { label: 'Break-even', value: x.breakeven ? yearsMonths(x.breakeven) : 'Never' },
      stats: [
        { label: 'Cost of points', value: x.cost, format: usd },
        { label: 'Monthly saving', value: x.save, format: usd },
        { label: `Net after ${dec(n.keep, 1)} years`, value: atKeep, format: usd },
        { label: 'Payment with points', value: x.p1, format: usd },
      ],
      working: [
        `cost = ${usd(n.p)} × ${n.pts}% = ${usd(x.cost)}`,
        `payment at ${n.r0}% = ${usd(x.p0)}; at ${n.r1}% = ${usd(x.p1)}; saving ${usd(x.save)} a month`,
        `break-even = ${usd(x.cost)} ÷ ${usd(x.save)} = ${x.breakeven} months`,
        `after ${keepM} months: ${usd(x.save)} × ${keepM} − ${usd(x.cost)} = ${usd(atKeep)}`,
      ],
      chart: {
        kind: 'line',
        x: xs,
        series: [{ id: 'n', label: 'Net saving', values: net }],
        xLabel: 'Month',
        formatX: (m) => `${m / 12}y`,
        readoutX: String,
        formatValue: usd0,
        zero: true,
        markers: x.breakeven ? [{ x: x.breakeven, label: 'Break-even' }] : [],
        guides: [{ y: 0, label: 'Points repaid' }],
        summary: `The points cost ${usd0(x.cost)} and save ${usd(x.save)} a month, so they pay for themselves after ${x.breakeven} months. Sell or refinance earlier and they lose money.`,
        table: true,
      },
    }
  },
}

/* ── rent affordability ────────────────────────────────────────── */

export function rentAfford(income: number, debts: number) {
  const monthly = D(income).div(12)
  const r30 = cents(monthly.times(0.3))
  const r40x = cents(D(income).div(40))
  const dti = Math.max(0, cents(monthly.times(0.36).minus(debts)))
  const r5030 = cents(monthly.times(0.5).times(0.75))
  return { monthly: cents(monthly), r30, r40x, dti, r5030, pick: Math.min(r30, r40x, dti) }
}

const rentSpec: Spec = {
  inputs: [
    money('inc', 'Gross income a year', '72000', { above: 0 }),
    money('debt', 'Monthly debt payments', '350', { hint: 'Car, student loan and card minimums.' }),
  ],
  compute: ({ n }) => {
    const x = rentAfford(n.inc, n.debt)
    const items = [
      { label: '30% of gross income', value: x.r30 },
      { label: 'Income 40 times the rent', value: x.r40x },
      { label: '36% debt-to-income', value: x.dti },
      { label: 'Needs share of 50/30/20', value: x.r5030 },
    ]
    return {
      main: { label: 'Rent you can afford', value: x.pick, format: usd, sub: 'a month, the lowest of the first three rules' },
      stats: items.slice(0, 3).map((i) => ({ label: i.label, value: i.value, format: usd })),
      working: [
        `monthly income = ${usd(n.inc)} ÷ 12 = ${usd(x.monthly)}`,
        `30% rule: ${usd(x.monthly)} × 0.30 = ${usd(x.r30)}`,
        `40× rule: ${usd(n.inc)} ÷ 40 = ${usd(x.r40x)}`,
        `36% DTI: ${usd(x.monthly)} × 0.36 − ${usd(n.debt)} = ${usd(x.dti)}`,
        `50/30/20: needs are 50% of income; rent at most three quarters of that = ${usd(x.r5030)}`,
      ],
      chart: {
        kind: 'bars',
        items: items.map((i) => ({ ...i, highlight: i.value === x.pick })),
        formatValue: usd0,
        summary: `On ${usd0(n.inc)} a year with ${usd0(n.debt)} of monthly debts, keep the rent at or below ${usd0(x.pick)} a month.`,
        table: true,
        columns: ['Rule', 'Rent a month'],
      },
    }
  },
}

export const specs: Record<string, Spec> = {
  'biweekly-mortgage-calculator': biweeklySpec,
  'heloc-calculator': helocSpec,
  'home-equity-calculator': equitySpec,
  'piti-calculator': pitiSpec,
  'closing-cost-calculator': closingSpec,
  'property-tax-calculator': propertyTaxSpec,
  'interest-only-loan-calculator': interestOnlySpec,
  'balloon-payment-calculator': balloonSpec,
  'personal-loan-calculator': personalSpec,
  'boat-loan-calculator': vehicleSpec('Boat', '45000', '5000', '8.5', [60, 120, 180, 240], 180, '600'),
  'rv-loan-calculator': vehicleSpec('RV', '90000', '10000', '8.25', [60, 120, 180, 240], 180, '900'),
  'motorcycle-loan-calculator': vehicleSpec('Motorcycle', '15000', '1500', '9.5', [24, 36, 48, 60, 72], 60, '400'),
  'loan-comparison-calculator': comparisonSpec,
  'mortgage-points-calculator': pointsSpec,
  'rent-affordability-calculator': rentSpec,
}

