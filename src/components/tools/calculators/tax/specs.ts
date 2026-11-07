/** Taxes, real estate investing and small-business ratios. */
import { choice, money, num, percent, pos, select } from '../engine/fields'
import { dec, int, pct, usd, usd0 } from '../engine/format'
import { D, amortize, cents, monthlyPayment, pctOf, sum } from '../engine/money'
import { irr, paybackYears } from '@/components/tools/calc/money-math'
import { readList } from '../engine/stats'
import { fail } from '../engine/types'
import type { Spec } from '../engine/types'
import { ADDL_MEDICARE, CG_2026, NIIT, SS_WAGE_BASE_2026, STANDARD_2026, STATUS_NAME, STATUS_OPTIONS, asStatus, fica, gainTax, incomeTax, seTax } from './rules'

const PERIODS = [['52', 'Weekly'], ['26', 'Every two weeks'], ['24', 'Twice a month'], ['12', 'Monthly'], ['1', 'Yearly']] as const
const periodName: Record<string, string> = { '52': 'week', '26': 'two weeks', '24': 'half month', '12': 'month', '1': 'year' }

/* ── paycheck ──────────────────────────────────────────────────── */

export function paycheck(gross: number, per: number, status: ReturnType<typeof asStatus>, pretax: number, statePct: number, localPct: number) {
  const annual = cents(D(gross).times(per))
  const pre = cents(D(pretax).times(per))
  const wages = cents(D(annual).minus(pre))
  const taxable = Math.max(0, cents(D(wages).minus(STANDARD_2026[status])))
  const fed = incomeTax(taxable, status)
  const f = fica(annual, status)
  const state = pctOf(wages, statePct)
  const local = pctOf(wages, localPct)
  const taxes = sum(fed.tax, f.total, state, local)
  const net = cents(D(annual).minus(pre).minus(taxes))
  const p = (v: number) => cents(D(v).div(per))
  return { annual, pre, taxable, fed, f, state, local, net, per: { net: p(net), fed: p(fed.tax), ss: p(f.ss), med: p(f.medicare + f.addl), state: p(state + local), pre: pretax } }
}

const paycheckSpec: Spec = {
  inputs: [
    money('g', 'Gross pay each paycheck', '2500', { above: 0 }),
    select('per', 'Pay frequency', '26', PERIODS, { half: true }),
    select('st', 'Filing status', 'single', STATUS_OPTIONS, { half: true }),
    money('pre', 'Pre-tax deductions each paycheck', '150', { hint: '401(k), health insurance, HSA.' }),
    percent('state', 'State income tax', '4', { half: true, max: 20 }),
    percent('local', 'Local income tax', '0', { half: true, max: 10 }),
  ],
  compute: ({ n, s }) => {
    const per = Number(s.per)
    const st = asStatus(s.st)
    if (n.pre > n.g) fail('Pre-tax deductions cannot be more than the gross pay.')
    const x = paycheck(n.g, per, st, n.pre, n.state, n.local)
    return {
      main: { label: 'Take-home pay', value: x.per.net, format: usd, sub: `each ${periodName[s.per ?? '26']}, ${usd(x.net)} a year` },
      stats: [
        { label: 'Federal income tax', value: x.per.fed, format: usd },
        { label: 'Social Security', value: x.per.ss, format: usd },
        { label: 'Medicare', value: x.per.med, format: usd },
        { label: 'State and local', value: x.per.state, format: usd },
      ],
      working: [
        `yearly gross = ${usd(n.g)} × ${per} = ${usd(x.annual)}; pre-tax deductions ${usd(x.pre)}`,
        `taxable = ${usd(x.annual)} − ${usd(x.pre)} − ${usd0(STANDARD_2026[st])} standard deduction = ${usd(x.taxable)}`,
        `federal tax by the 2026 brackets = ${usd(x.fed.tax)} (top rate ${x.fed.marginal}%)`,
        `Social Security = 6.2% × ${usd(Math.min(x.annual, SS_WAGE_BASE_2026))} = ${usd(x.f.ss)}; Medicare = 1.45% × ${usd(x.annual)}${x.f.addl ? ` + 0.9% over ${usd0(ADDL_MEDICARE[st])}` : ''} = ${usd(x.f.medicare + x.f.addl)}`,
        `state and local = (${n.state}% + ${n.local}%) × ${usd(cents(D(x.annual).minus(x.pre)))} = ${usd(x.state + x.local)}`,
        `take-home = ${usd(x.net)} ÷ ${per} = ${usd(x.per.net)}`,
      ],
      note: 'An estimate from yearly income tax. Real withholding follows your W-4 and IRS Publication 15-T, so it can differ a little. FICA here is on the full gross pay, which is right for 401(k) money; health premiums paid through a cafeteria plan also lower FICA wages.',
      chart: {
        kind: 'donut',
        parts: [
          { label: 'Take-home', value: x.per.net, paint: 'ink' },
          { label: 'Federal income tax', value: x.per.fed, paint: 'hatch' },
          { label: 'Social Security and Medicare', value: x.per.ss + x.per.med, paint: 'grey' },
          { label: 'State and local', value: x.per.state, paint: 'dots' },
          { label: 'Pre-tax deductions', value: x.per.pre, paint: 'paper' },
        ],
        center: pct((x.per.net / n.g) * 100, 0),
        formatValue: usd,
        summary: `Of ${usd(n.g)} gross, you keep ${usd(x.per.net)} (${pct((x.per.net / n.g) * 100, 1)}). Federal income tax takes ${usd(x.per.fed)} and FICA ${usd(cents(x.per.ss + x.per.med))}.`,
        table: true,
      },
    }
  },
}

/* ── federal income tax ────────────────────────────────────────── */

const federalSpec: Spec = {
  inputs: [
    select('st', 'Filing status', 'single', STATUS_OPTIONS),
    money('inc', 'Gross income for 2026', '85000', { above: 0 }),
    money('adj', 'Pre-tax contributions and adjustments', '6000', { hint: '401(k), traditional IRA, HSA, student loan interest.' }),
    choice('ded', 'Deduction', 'std', [['std', 'Standard'], ['item', 'Itemized']]),
    money('item', 'Itemized deductions', '20000', { when: (s) => s.ded === 'item' }),
    money('cred', 'Tax credits', '0', { hint: 'Child tax credit and others.' }),
  ],
  compute: ({ n, s }) => {
    const st = asStatus(s.st)
    const agi = Math.max(0, cents(D(n.inc).minus(n.adj)))
    const ded = s.ded === 'item' ? n.item : STANDARD_2026[st]
    const taxable = Math.max(0, cents(D(agi).minus(ded)))
    const x = incomeTax(taxable, st)
    const tax = Math.max(0, cents(D(x.tax).minus(n.cred)))
    const used = x.parts.filter((p) => p.amount > 0)
    return {
      main: { label: 'Federal income tax', value: tax, format: usd },
      stats: [
        { label: 'Taxable income', value: taxable, format: usd },
        { label: 'Marginal rate', value: x.marginal, format: (v) => `${v}%` },
        { label: 'Effective rate', value: n.inc > 0 ? (tax / n.inc) * 100 : 0, format: (v) => pct(v, 2) },
        { label: 'Monthly', value: cents(D(tax).div(12)), format: usd },
      ],
      working: [
        `AGI = ${usd(n.inc)} − ${usd(n.adj)} = ${usd(agi)}`,
        `taxable = ${usd(agi)} − ${usd(ded)} ${s.ded === 'item' ? 'itemized' : 'standard'} deduction = ${usd(taxable)}`,
        ...used.map((p) => `${p.rate}% × ${usd(p.amount)} = ${usd(p.tax)}`),
        `tax = ${usd(x.tax)}${n.cred ? ` − ${usd(n.cred)} credits = ${usd(tax)}` : ''}`,
      ],
      note: `2026 brackets for ${STATUS_NAME[st]}. Capital gains, self-employment tax, the senior deduction and the alternative minimum tax are not included.`,
      chart: {
        kind: 'bars',
        items: x.parts.map((p) => ({ label: `${p.rate}%`, value: p.tax, note: p.amount ? `on ${usd0(p.amount)}` : undefined, highlight: p.rate === x.marginal })),
        formatValue: usd0,
        summary: `${usd0(taxable)} of taxable income pays ${usd0(x.tax)} before credits. Your top dollar is taxed at ${x.marginal}%, but the average rate on your gross income is ${pct((tax / n.inc) * 100, 1)}.`,
        table: true,
        columns: ['Rate', 'Tax'],
      },
    }
  },
}

/* ── capital gains tax ─────────────────────────────────────────── */

const gainsSpec: Spec = {
  inputs: [
    select('st', 'Filing status', 'single', STATUS_OPTIONS),
    money('buy', 'Purchase price and costs', '20000', { half: true }),
    money('sell', 'Sale price less costs', '45000', { half: true }),
    choice('held', 'Held for', 'long', [['long', 'More than a year'], ['short', 'A year or less']]),
    money('inc', 'Other taxable income', '70000', { hint: 'After deductions, without this gain.' }),
    percent('state', 'State tax on the gain', '5', { max: 20 }),
  ],
  compute: ({ n, s }) => {
    const st = asStatus(s.st)
    const gain = cents(D(n.sell).minus(n.buy))
    if (gain <= 0) fail(`That is a loss of ${usd(-gain)}. Losses offset other gains and up to $3,000 of income a year.`)
    const long = s.held === 'long'
    const g = gainTax(n.inc, gain, st, long)
    const niit = cents(D(Math.max(0, Math.min(gain, n.inc + gain - NIIT[st]))).times(0.038))
    const state = pctOf(gain, n.state)
    const total = sum(g.tax, niit, state)
    const [t0, t15] = CG_2026[st]
    return {
      main: { label: 'Tax on the gain', value: total, format: usd, sub: `${pct((total / gain) * 100, 1)} of a ${usd0(gain)} gain` },
      stats: [
        { label: 'Federal', value: g.tax, format: usd },
        { label: 'Net investment income tax', value: niit, format: usd },
        { label: 'State', value: state, format: usd },
        { label: 'You keep', value: cents(D(n.sell).minus(total)), format: usd },
      ],
      working: long
        ? [
            `gain = ${usd(n.sell)} − ${usd(n.buy)} = ${usd(gain)}`,
            `the gain sits on top of ${usd(n.inc)} of other taxable income`,
            `0% up to ${usd0(t0)}: ${usd(g.at0)}; 15% up to ${usd0(t15)}: ${usd(g.at15)}; 20% above: ${usd(g.at20)}`,
            `federal = 15% × ${usd(g.at15)} + 20% × ${usd(g.at20)} = ${usd(g.tax)}`,
            `NIIT = 3.8% of the gain above ${usd0(NIIT[st])} of income = ${usd(niit)}`,
          ]
        : [
            `gain = ${usd(n.sell)} − ${usd(n.buy)} = ${usd(gain)}`,
            `short term: taxed as ordinary income`,
            `tax(${usd0(n.inc + gain)}) − tax(${usd0(n.inc)}) = ${usd(g.tax)}`,
            `NIIT = 3.8% of the gain above ${usd0(NIIT[st])} of income = ${usd(niit)}`,
          ],
      note: 'Income here is taxable income after deductions. The NIIT test uses it in place of modified AGI, which is close for most people.',
      chart: {
        kind: 'donut',
        parts: [
          { label: 'You keep', value: cents(D(gain).minus(total)), paint: 'ink' },
          { label: 'Federal', value: g.tax, paint: 'hatch' },
          { label: 'NIIT', value: niit, paint: 'grey' },
          { label: 'State', value: state, paint: 'dots' },
        ],
        center: pct((total / gain) * 100, 0),
        formatValue: usd,
        summary: `${long ? 'A long-term' : 'A short-term'} gain of ${usd0(gain)} costs ${usd0(total)} in tax. ${long ? 'Holding over a year gets the 0%, 15% and 20% rates.' : 'Held a year or less, it is taxed like wages.'}`,
        table: true,
      },
    }
  },
}

/* ── self-employment tax ───────────────────────────────────────── */

const seSpec: Spec = {
  inputs: [
    money('p', 'Net self-employment profit', '60000', { above: 0 }),
    money('w', 'W-2 wages this year', '0', { hint: 'They use up the Social Security wage base first.' }),
    select('st', 'Filing status', 'single', STATUS_OPTIONS),
  ],
  compute: ({ n, s }) => {
    const st = asStatus(s.st)
    const x = seTax(n.p, n.w, st)
    return {
      main: { label: 'Self-employment tax', value: x.total, format: usd, sub: x.total ? `${usd(cents(D(x.total).div(4)))} a quarter` : 'under $400 of earnings: none owed' },
      stats: [
        { label: 'Social Security part', value: x.ss, format: usd },
        { label: 'Medicare part', value: sum(x.medicare, x.addl), format: usd },
        { label: 'Deduction for half', value: x.deduction, format: usd },
        { label: 'Rate on profit', value: (x.total / n.p) * 100, format: (v) => pct(v, 2) },
      ],
      working: [
        `earnings = ${usd(n.p)} × 92.35% = ${usd(x.base)}`,
        `Social Security = 12.4% × ${usd(Math.min(x.base, Math.max(0, SS_WAGE_BASE_2026 - n.w)))} (wage base ${usd0(SS_WAGE_BASE_2026)}) = ${usd(x.ss)}`,
        `Medicare = 2.9% × ${usd(x.base)} = ${usd(x.medicare)}${x.addl ? `; additional 0.9% = ${usd(x.addl)}` : ''}`,
        `deduction = (${usd(x.ss)} + ${usd(x.medicare)}) ÷ 2 = ${usd(x.deduction)}`,
      ],
      note: 'This is Schedule SE. Income tax on the profit is separate.',
      chart: {
        kind: 'donut',
        parts: [
          { label: 'Social Security', value: x.ss, paint: 'ink' },
          { label: 'Medicare', value: x.medicare, paint: 'hatch' },
          { label: 'Additional Medicare', value: x.addl, paint: 'grey' },
        ],
        center: usd0(x.total),
        formatValue: usd,
        summary: `On ${usd0(n.p)} of profit, self-employment tax is ${usd0(x.total)}: both the employee and employer shares of Social Security and Medicare.`,
        table: true,
      },
    }
  },
}

/* ── rental property ratios ────────────────────────────────────── */

const capSpec: Spec = {
  inputs: [
    money('v', 'Property value or price', '400000', { above: 0 }),
    money('rent', 'Gross rent a month', '3200', { half: true }),
    percent('vac', 'Vacancy', '5', { half: true }),
    money('exp', 'Operating expenses a year', '11000', { hint: 'Tax, insurance, repairs, management. Not the mortgage.' }),
  ],
  compute: ({ n }) => {
    const gross = cents(D(n.rent).times(12))
    const vacancy = pctOf(gross, n.vac)
    const noi = cents(D(gross).minus(vacancy).minus(n.exp))
    const cap = (noi / n.v) * 100
    return {
      main: { label: 'Cap rate', value: cap, format: (v) => pct(v, 2) },
      stats: [
        { label: 'Net operating income', value: noi, format: usd },
        { label: 'Gross rent a year', value: gross, format: usd },
        { label: 'Vacancy loss', value: vacancy, format: usd },
        { label: 'Gross rent multiplier', value: n.v / gross, format: (v) => dec(v, 2) },
      ],
      working: [
        `gross rent = ${usd(n.rent)} × 12 = ${usd(gross)}`,
        `NOI = ${usd(gross)} − ${usd(vacancy)} vacancy − ${usd(n.exp)} expenses = ${usd(noi)}`,
        `cap rate = NOI ÷ value = ${usd(noi)} ÷ ${usd(n.v)} = ${pct(cap, 3)}`,
      ],
      chart: {
        kind: 'gauge',
        value: Math.max(0, Math.min(14, cap)),
        min: 0,
        max: 14,
        bands: [
          { to: 4, label: 'Low' },
          { to: 7, label: 'Typical' },
          { to: 10, label: 'High' },
          { to: 14, label: 'Very high' },
        ],
        formatValue: (v) => `${v}%`,
        center: pct(cap, 2),
        summary: `A cap rate of ${pct(cap, 2)}: the property earns ${usd0(noi)} a year before financing on ${usd0(n.v)}. Prime areas often trade at 4% to 6%, riskier ones higher.`,
      },
    }
  },
}

function rentalYear1(price: number, downPct: number, closing: number, ratePct: number, years: number, rent: number, vacPct: number, expMonthly: number) {
  const loan = cents(D(price).times(D(100).minus(downPct)).div(100))
  const pay = monthlyPayment(loan, ratePct, years * 12)
  const cash = sum(cents(D(price).minus(loan)), closing)
  const income = cents(D(rent).times(12).times(D(100).minus(vacPct)).div(100))
  const noi = cents(D(income).minus(D(expMonthly).times(12)))
  const debt = cents(D(pay).times(12))
  const flow = cents(D(noi).minus(debt))
  return { loan, pay, cash, income, noi, debt, flow }
}

const cocSpec: Spec = {
  inputs: [
    money('price', 'Purchase price', '300000', { above: 0 }),
    percent('down', 'Down payment', '25', { half: true, max: 100 }),
    money('close', 'Closing and repair costs', '9000', { half: true }),
    percent('r', 'Interest rate', '7', { half: true }),
    select('y', 'Term', '30', [['15', '15 years'], ['20', '20 years'], ['30', '30 years']], { half: true }),
    money('rent', 'Rent a month', '2500', { half: true }),
    percent('vac', 'Vacancy', '5', { half: true }),
    money('exp', 'Expenses a month', '700', { hint: 'Tax, insurance, repairs, management, HOA.' }),
  ],
  compute: ({ n, s }) => {
    const x = rentalYear1(n.price, n.down, n.close, n.r, Number(s.y), n.rent, n.vac, n.exp)
    const coc = (x.flow / x.cash) * 100
    return {
      main: { label: 'Cash-on-cash return', value: coc, format: (v) => pct(v, 2) },
      stats: [
        { label: 'Cash flow a year', value: x.flow, format: usd },
        { label: 'Cash flow a month', value: cents(D(x.flow).div(12)), format: usd },
        { label: 'Cash invested', value: x.cash, format: usd },
        { label: 'Mortgage payment', value: x.pay, format: usd },
      ],
      working: [
        `cash invested = ${usd(cents(D(n.price).minus(x.loan)))} down + ${usd(n.close)} = ${usd(x.cash)}`,
        `rent collected = ${usd(n.rent)} × 12 × (1 − ${n.vac}%) = ${usd(x.income)}`,
        `NOI = ${usd(x.income)} − ${usd(cents(D(n.exp).times(12)))} expenses = ${usd(x.noi)}`,
        `cash flow = ${usd(x.noi)} − ${usd(x.debt)} mortgage = ${usd(x.flow)}`,
        `cash-on-cash = ${usd(x.flow)} ÷ ${usd(x.cash)} = ${pct(coc, 2)}`,
      ],
      chart: {
        kind: 'bars',
        items: [
          { label: 'Rent collected', value: x.income },
          { label: 'Expenses', value: cents(D(n.exp).times(12)) },
          { label: 'Mortgage', value: x.debt },
          { label: 'Cash flow', value: Math.max(0, x.flow), note: x.flow < 0 ? `negative: ${usd0(x.flow)}` : undefined, highlight: true },
        ],
        formatValue: usd0,
        summary: `${usd0(x.cash)} of cash brings in ${usd0(x.flow)} a year after the mortgage: a ${pct(coc, 1)} cash-on-cash return.`,
        table: true,
        columns: ['Item', 'A year'],
      },
    }
  },
}

const rentalSpec: Spec = {
  inputs: [
    money('price', 'Purchase price', '300000', { above: 0 }),
    percent('down', 'Down payment', '25', { half: true, max: 100 }),
    money('close', 'Closing and repair costs', '9000', { half: true }),
    percent('r', 'Interest rate', '7', { half: true }),
    select('y', 'Term', '30', [['15', '15 years'], ['20', '20 years'], ['30', '30 years']], { half: true }),
    money('rent', 'Rent a month', '2500', { half: true }),
    money('exp', 'Expenses a month', '700', { half: true }),
    percent('vac', 'Vacancy', '5', { half: true }),
    percent('grow', 'Rent and cost growth', '3', { half: true }),
    percent('app', 'Value growth a year', '3', { half: true }),
    pos('hold', 'Years you keep it', '10', 'years', { half: true, int: true, max: 40 }),
    percent('sell', 'Selling costs', '6', { hint: 'Agent and closing costs when you sell.' }),
  ],
  compute: ({ n, s }) => {
    const years = Number(s.y)
    const y1 = rentalYear1(n.price, n.down, n.close, n.r, years, n.rent, n.vac, n.exp)
    const sched = amortize({ principal: y1.loan, annualPct: n.r, months: years * 12 })
    const flows: number[] = [-y1.cash]
    const equity: number[] = [cents(D(n.price).minus(y1.loan))]
    const cumFlow: number[] = [0]
    let cum = D(0)
    let lastSale = 0
    for (let t = 1; t <= n.hold; t++) {
      const g = D(1 + n.grow / 100).pow(t - 1)
      const flow = D(n.rent).times(12).times(D(100).minus(n.vac)).div(100).times(g).minus(D(n.exp).times(12).times(g)).minus(t <= years ? y1.debt : 0)
      cum = cum.plus(flow)
      const value = D(n.price).times(D(1 + n.app / 100).pow(t))
      const bal = t * 12 <= sched.rows.length ? (sched.rows[t * 12 - 1]?.balance ?? 0) : 0
      equity.push(cents(value.minus(bal)))
      cumFlow.push(cents(cum))
      lastSale = cents(value.times(1 - n.sell / 100).minus(bal))
      flows.push(cents(flow.plus(t === n.hold ? lastSale : 0)))
    }
    const r = irr(flows)
    const profit = cents(cum.plus(lastSale).minus(y1.cash))
    return {
      main: { label: 'Yearly return (IRR)', value: r === null ? 'Not defined' : pct(r, 2), sub: `over ${n.hold} years, sale included` },
      stats: [
        { label: 'Cash flow a month, year 1', value: cents(D(y1.flow).div(12)), format: usd },
        { label: 'Cap rate', value: (y1.noi / n.price) * 100, format: (v) => pct(v, 2) },
        { label: 'Cash-on-cash, year 1', value: (y1.flow / y1.cash) * 100, format: (v) => pct(v, 2) },
        { label: 'Total profit', value: profit, format: usd },
      ],
      working: [
        `cash in = ${usd(y1.cash)}; loan ${usd(y1.loan)} at ${n.r}%: ${usd(y1.pay)} a month`,
        `year 1 NOI = ${usd(y1.noi)}, cash flow = ${usd(y1.flow)}`,
        `rent and costs grow ${n.grow}% and the value ${n.app}% a year`,
        `sale after ${n.hold} years: value × (1 − ${n.sell}%) − loan balance = ${usd(lastSale)}`,
        `IRR: the rate where −${usd0(y1.cash)} and the yearly cash flows, sale included, are worth zero = ${r === null ? 'none' : pct(r, 2)}`,
      ],
      chart: {
        kind: 'line',
        area: true,
        stacked: true,
        x: equity.map((_, k) => k),
        series: [
          { id: 'e', label: 'Equity', values: equity, paint: 'grey' },
          { id: 'c', label: 'Cash flow so far', values: cumFlow.map((v) => Math.max(0, v)), paint: 'hatch' },
        ],
        xLabel: 'Year',
        formatX: String,
        formatValue: usd0,
        summary: `After ${n.hold} years the property holds ${usd0(equity[n.hold]!)} of equity and has paid ${usd0(cumFlow[n.hold]!)} in cash flow. Sold then, the yearly return is ${r === null ? 'not defined' : pct(r, 1)}.`,
        table: true,
      },
    }
  },
}

const dscrSpec: Spec = {
  inputs: [
    money('noi', 'Net operating income a year', '42000', { above: 0 }),
    money('loan', 'Loan amount', '450000', { above: 0 }),
    percent('r', 'Interest rate', '7.25', { half: true }),
    pos('y', 'Amortization', '30', 'years', { half: true, int: true, max: 40 }),
    num('target', 'Lender’s minimum DSCR', '1.25', undefined, { above: 0, max: 5 }),
  ],
  compute: ({ n }) => {
    const pay = monthlyPayment(n.loan, n.r, n.y * 12)
    const debt = cents(D(pay).times(12))
    const dscr = n.noi / debt
    const maxDebt = n.noi / n.target
    const unit = monthlyPayment(100000, n.r, n.y * 12) * 12
    const maxLoan = cents(D(maxDebt).div(unit).times(100000))
    return {
      main: { label: 'DSCR', value: dscr, format: (v) => dec(v, 2), sub: dscr >= n.target ? `meets the ${n.target} minimum` : `below the ${n.target} minimum` },
      stats: [
        { label: 'Debt service a year', value: debt, format: usd },
        { label: 'Monthly payment', value: pay, format: usd },
        { label: 'Largest loan at the minimum', value: maxLoan, format: usd },
        { label: 'Cash left after debt', value: cents(D(n.noi).minus(debt)), format: usd },
      ],
      working: [
        `debt service = ${usd(pay)} × 12 = ${usd(debt)}`,
        `DSCR = NOI ÷ debt service = ${usd(n.noi)} ÷ ${usd(debt)} = ${dec(dscr, 3)}`,
        `largest debt service at ${n.target} = ${usd(n.noi)} ÷ ${n.target} = ${usd(maxDebt)}, a loan of ${usd(maxLoan)}`,
      ],
      chart: {
        kind: 'gauge',
        value: Math.min(2.5, dscr),
        min: 0,
        max: 2.5,
        bands: [
          { to: 1, label: 'Short' },
          { to: 1.2, label: 'Tight' },
          { to: 1.5, label: 'Meets most' },
          { to: 2.5, label: 'Strong' },
        ],
        formatValue: (v) => dec(v, 1),
        center: dec(dscr, 2),
        summary: `The property earns ${dec(dscr, 2)} times its debt payments. Below 1 the rent does not cover the loan; most lenders want 1.2 to 1.25 or more.`,
      },
    }
  },
}

/* ── business ratios ───────────────────────────────────────────── */

const paybackSpec: Spec = {
  inputs: [
    money('inv', 'Initial investment', '20000', { above: 0 }),
    { id: 'cf', kind: 'text', label: 'Cash flow each year', value: '5000 6000 7000 7000 8000', rows: 2, hint: 'One amount per year, separated by spaces or commas.' },
    percent('r', 'Discount rate', '8', { hint: 'For the discounted payback.' }),
  ],
  compute: ({ n, s }) => {
    const { values, error } = readList(s.cf ?? '', 1)
    if (error) fail(error)
    const flows = [-n.inv, ...values]
    const disc = flows.map((f, t) => f / Math.pow(1 + n.r / 100, t))
    const simple = paybackYears(flows)
    const dp = paybackYears(disc)
    let a = 0
    let b = 0
    const cum = flows.map((f) => (a += f))
    const cumD = disc.map((f) => (b += f))
    return {
      main: { label: 'Payback period', value: simple === null ? 'Not within these years' : `${dec(simple, 2)} years` },
      stats: [
        { label: 'Discounted payback', value: dp === null ? 'Not within these years' : `${dec(dp, 2)} years` },
        { label: 'Total cash back', value: sum(...values), format: usd },
        { label: 'Net present value', value: cents(cumD[cumD.length - 1]!), format: usd },
      ],
      working: [
        `cumulative = ${cum.map((c) => usd0(c)).join(', ')}`,
        simple === null ? 'the cumulative cash flow never turns positive' : `payback = last negative year + remaining ÷ next cash flow = ${dec(simple, 3)} years`,
        `discounted: each cash flow ÷ (1 + ${n.r}%)^t, cumulative = ${cumD.map((c) => usd0(c)).join(', ')}`,
      ],
      chart: {
        kind: 'line',
        x: cum.map((_, k) => k),
        series: [
          { id: 'c', label: 'Cumulative cash', values: cum },
          { id: 'd', label: 'Discounted', values: cumD, stroke: 'dash' },
        ],
        xLabel: 'Year',
        formatX: String,
        formatValue: usd0,
        guides: [{ y: 0, label: 'Paid back' }],
        summary: simple === null ? 'The investment is not paid back within the years entered.' : `The ${usd0(n.inv)} comes back in ${dec(simple, 1)} years, or ${dp === null ? 'not within these years' : `${dec(dp, 1)} years`} once the cash flows are discounted at ${n.r}%.`,
        table: true,
      },
    }
  },
}

export const wacc = (E: number, Dv: number, re: number, rd: number, tax: number) => ((E / (E + Dv)) * re + (Dv / (E + Dv)) * rd * (1 - tax / 100))

const waccSpec: Spec = {
  inputs: [
    money('e', 'Market value of equity', '600000000', { half: true }),
    money('d', 'Market value of debt', '400000000', { half: true }),
    choice('how', 'Cost of equity', 'capm', [['capm', 'From CAPM'], ['given', 'I know it']]),
    percent('re', 'Cost of equity', '10', { when: (s) => s.how === 'given' }),
    percent('rf', 'Risk-free rate', '4.2', { when: (s) => s.how === 'capm', half: true }),
    num('beta', 'Beta', '1.1', undefined, { when: (s) => s.how === 'capm', half: true, min: -5, max: 10 }),
    percent('mrp', 'Equity risk premium', '5.5', { when: (s) => s.how === 'capm', hint: 'Market return minus the risk-free rate.' }),
    percent('rd', 'Cost of debt', '6', { half: true }),
    percent('t', 'Tax rate', '21', { half: true }),
  ],
  compute: ({ n, s }) => {
    if (n.e + n.d <= 0) fail('Enter the value of the equity or the debt.')
    const re = s.how === 'capm' ? n.rf + n.beta * n.mrp : n.re
    const w = wacc(n.e, n.d, re, n.rd, n.t)
    const we = n.e / (n.e + n.d)
    return {
      main: { label: 'WACC', value: w, format: (v) => pct(v, 3) },
      stats: [
        { label: 'Cost of equity', value: re, format: (v) => pct(v, 2) },
        { label: 'After-tax cost of debt', value: n.rd * (1 - n.t / 100), format: (v) => pct(v, 2) },
        { label: 'Equity weight', value: we * 100, format: (v) => pct(v, 1) },
        { label: 'Debt weight', value: (1 - we) * 100, format: (v) => pct(v, 1) },
      ],
      working: [
        ...(s.how === 'capm' ? [`cost of equity = rf + β × ERP = ${n.rf}% + ${n.beta} × ${n.mrp}% = ${pct(re, 3)}`] : []),
        `V = E + D = ${usd0(n.e + n.d)}`,
        `WACC = E/V × Re + D/V × Rd × (1 − T)`,
        `WACC = ${dec(we, 4)} × ${pct(re, 3)} + ${dec(1 - we, 4)} × ${n.rd}% × (1 − ${n.t}%) = ${pct(w, 3)}`,
      ],
      chart: {
        kind: 'donut',
        parts: [
          { label: 'Equity', value: n.e, paint: 'ink' },
          { label: 'Debt', value: n.d, paint: 'hatch' },
        ],
        center: pct(w, 2),
        formatValue: usd0,
        summary: `With ${pct(we * 100, 0)} equity at ${pct(re, 1)} and ${pct((1 - we) * 100, 0)} debt at ${pct(n.rd * (1 - n.t / 100), 1)} after tax, the firm’s capital costs ${pct(w, 2)} a year.`,
        table: true,
      },
    }
  },
}

const ebitdaSpec: Spec = {
  inputs: [
    money('ni', 'Net income', '1200000', { min: -1e12 }),
    money('int', 'Interest expense', '250000', { half: true }),
    money('tax', 'Income taxes', '380000', { half: true, min: -1e12 }),
    money('dep', 'Depreciation', '420000', { half: true }),
    money('am', 'Amortization', '80000', { half: true }),
    money('rev', 'Revenue', '9500000', { optional: true, hint: 'Optional, for the margin.' }),
  ],
  compute: ({ n }) => {
    const ebit = sum(n.ni, n.int, n.tax)
    const ebitda = sum(ebit, n.dep, n.am)
    const hasRev = Number.isFinite(n.rev) && n.rev > 0
    return {
      main: { label: 'EBITDA', value: ebitda, format: usd },
      stats: [
        { label: 'EBIT', value: ebit, format: usd },
        { label: 'EBITDA margin', value: hasRev ? pct((ebitda / n.rev) * 100, 2) : 'Add revenue' },
        { label: 'EBIT margin', value: hasRev ? pct((ebit / n.rev) * 100, 2) : 'Add revenue' },
      ],
      working: [
        `EBIT = net income + interest + taxes = ${usd(n.ni)} + ${usd(n.int)} + ${usd(n.tax)} = ${usd(ebit)}`,
        `EBITDA = EBIT + depreciation + amortization = ${usd(ebit)} + ${usd(n.dep)} + ${usd(n.am)} = ${usd(ebitda)}`,
        ...(hasRev ? [`margin = ${usd(ebitda)} ÷ ${usd(n.rev)} = ${pct((ebitda / n.rev) * 100, 2)}`] : []),
      ],
      chart: {
        kind: 'bars',
        items: [
          { label: 'Net income', value: Math.max(0, n.ni) },
          { label: 'Interest', value: n.int },
          { label: 'Taxes', value: Math.max(0, n.tax) },
          { label: 'Depreciation', value: n.dep },
          { label: 'Amortization', value: n.am },
          { label: 'EBITDA', value: Math.max(0, ebitda), highlight: true },
        ],
        formatValue: usd0,
        summary: `Adding back interest, taxes, depreciation and amortization to ${usd0(n.ni)} of net income gives EBITDA of ${usd0(ebitda)}.`,
        table: true,
        columns: ['Item', 'Amount'],
      },
    }
  },
}

const freelanceSpec: Spec = {
  inputs: [
    money('net', 'Take-home pay you want a year', '70000', { above: 0 }),
    money('exp', 'Business costs a year', '8000', { hint: 'Software, equipment, insurance, health plan.' }),
    percent('tax', 'Tax rate on profit', '28', { max: 90, hint: 'Income tax plus self-employment tax.' }),
    pos('h', 'Billable hours a week', '25', 'hours', { half: true, max: 100 }),
    num('off', 'Weeks off a year', '6', 'weeks', { half: true, min: 0, max: 51 }),
  ],
  compute: ({ n }) => {
    const profit = cents(D(n.net).div(1 - n.tax / 100))
    const revenue = sum(profit, n.exp)
    const hours = n.h * (52 - n.off)
    const rate = cents(D(revenue).div(hours))
    return {
      main: { label: 'Hourly rate', value: rate, format: usd },
      stats: [
        { label: 'Day rate (8 hours)', value: cents(D(rate).times(8)), format: usd },
        { label: 'Revenue needed', value: revenue, format: usd },
        { label: 'Billable hours a year', value: hours, format: int },
        { label: 'Tax', value: cents(D(profit).minus(n.net)), format: usd },
      ],
      working: [
        `profit before tax = ${usd(n.net)} ÷ (1 − ${n.tax}%) = ${usd(profit)}`,
        `revenue = ${usd(profit)} + ${usd(n.exp)} costs = ${usd(revenue)}`,
        `billable hours = ${n.h} × (52 − ${n.off}) = ${int(hours)}`,
        `rate = ${usd(revenue)} ÷ ${int(hours)} = ${usd(rate)}`,
      ],
      chart: {
        kind: 'donut',
        parts: [
          { label: 'Take-home', value: n.net, paint: 'ink' },
          { label: 'Tax', value: cents(D(profit).minus(n.net)), paint: 'hatch' },
          { label: 'Business costs', value: n.exp, paint: 'grey' },
        ],
        center: usd0(rate),
        formatValue: usd0,
        summary: `To take home ${usd0(n.net)}, bill ${usd0(revenue)} a year: ${usd(rate)} an hour over ${int(hours)} billable hours.`,
        table: true,
      },
    }
  },
}

const utilSpec: Spec = {
  inputs: [
    money('b1', 'Card 1 balance', '1200', { half: true }),
    money('l1', 'Card 1 limit', '5000', { half: true }),
    money('b2', 'Card 2 balance', '800', { half: true, optional: true }),
    money('l2', 'Card 2 limit', '3000', { half: true, optional: true }),
    money('b3', 'Card 3 balance', '', { half: true, optional: true }),
    money('l3', 'Card 3 limit', '', { half: true, optional: true }),
    money('b4', 'Card 4 balance', '', { half: true, optional: true }),
    money('l4', 'Card 4 limit', '', { half: true, optional: true }),
  ],
  compute: ({ n }) => {
    const cards = [1, 2, 3, 4]
      .map((k) => ({ k, b: n[`b${k}`]!, l: n[`l${k}`]! }))
      .filter((c) => Number.isFinite(c.l) && c.l > 0)
      .map((c) => ({ ...c, b: Number.isFinite(c.b) ? c.b : 0 }))
    if (!cards.length) fail('Enter the limit of at least one card.')
    const bal = sum(...cards.map((c) => c.b))
    const lim = sum(...cards.map((c) => c.l))
    const u = (bal / lim) * 100
    const to30 = Math.max(0, cents(D(bal).minus(D(lim).times(0.3))))
    const to10 = Math.max(0, cents(D(bal).minus(D(lim).times(0.1))))
    return {
      main: { label: 'Overall utilization', value: u, format: (v) => pct(v, 1) },
      stats: [
        { label: 'Total balance', value: bal, format: usd },
        { label: 'Total limit', value: lim, format: usd },
        { label: 'Pay down to reach 30%', value: to30, format: usd },
        { label: 'Pay down to reach 10%', value: to10, format: usd },
      ],
      working: [
        ...cards.map((c) => `card ${c.k}: ${usd(c.b)} ÷ ${usd(c.l)} = ${pct((c.b / c.l) * 100, 1)}`),
        `overall = ${usd(bal)} ÷ ${usd(lim)} = ${pct(u, 2)}`,
      ],
      chart: {
        kind: 'bars',
        items: [...cards.map((c) => ({ label: `Card ${c.k}`, value: (c.b / c.l) * 100 })), { label: 'Overall', value: u, highlight: true }],
        formatValue: (v) => pct(v, 1),
        max: Math.max(100, ...cards.map((c) => (c.b / c.l) * 100)),
        summary: `You use ${pct(u, 1)} of your credit. Scoring models count lower as better; under 30% is a common goal and under 10% is better.`,
        table: true,
        columns: ['Card', 'Utilization'],
      },
    }
  },
}

export const specs: Record<string, Spec> = {
  'paycheck-calculator': paycheckSpec,
  'federal-income-tax-calculator': federalSpec,
  'capital-gains-tax-calculator': gainsSpec,
  'self-employment-tax-calculator': seSpec,
  'cap-rate-calculator': capSpec,
  'cash-on-cash-return-calculator': cocSpec,
  'rental-property-calculator': rentalSpec,
  'dscr-calculator': dscrSpec,
  'payback-period-calculator': paybackSpec,
  'wacc-calculator': waccSpec,
  'ebitda-calculator': ebitdaSpec,
  'freelance-hourly-rate-calculator': freelanceSpec,
  'credit-utilization-calculator': utilSpec,
}
