#!/usr/bin/env node
/**
 * Calculator arithmetic checks. Opens calculator pages on a running dev
 * server, fills inputs by label, and compares the shown results with values
 * computed here from the standard formulas (each one cited next to its check).
 *
 *   npx astro dev --port 46230 --ignore-lock &
 *   node scripts/smoke/calc.mjs [--base URL] [--only slug,slug] [--sweep] [--edge] [--checks]
 *
 * --checks (default when no mode is given): the known-value checks.
 * --sweep: loads every calculator page with a shifted clock, time zone and
 *          locale, and fails on console errors, page errors, hydration errors
 *          and NaN / Infinity / undefined on screen.
 * --edge:  types empty, zero, negative and huge values into every text input
 *          of every calculator page and fails on the same problems.
 *
 * Exit code 1 when anything fails.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const BASE = flag('base', 'http://127.0.0.1:46230')
const ONLY = flag('only', '').split(',').map((s) => s.trim()).filter(Boolean)
const MODES = ['checks', 'sweep', 'edge'].filter((m) => args.includes(`--${m}`))
if (MODES.length === 0) MODES.push('checks')
const CONCURRENCY = Number(flag('concurrency', 4))

const TOOL_DIRS = ['finance', 'health', 'math', 'units', 'datetime', 'everyday']

/** Every page whose island lives in one of the six calculator folders. */
function calculatorPages() {
  const dir = path.join(ROOT, 'src/pages')
  const re = new RegExp(`components/tools/(${TOOL_DIRS.join('|')})/`)
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.astro'))
    .filter((f) => re.test(fs.readFileSync(path.join(dir, f), 'utf8')))
    .map((f) => f.replace(/\.astro$/, ''))
    .sort()
}

/* ── numbers ──────────────────────────────────────────────────────────── */

const round = (x, dp = 2) => Math.round((x + Number.EPSILON * Math.sign(x)) * 10 ** dp) / 10 ** dp
/** en-US grouping with fixed decimals: 1798.6516 -> "1,798.65". */
const fx = (x, dp = 2) =>
  round(x, dp).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
/** "$1,798.65" */
const usd = (x, dp = 2) => (x < 0 ? '-$' : '$') + fx(Math.abs(x), dp)
/** First number in a string: "$1,798.65 / mo" -> 1798.65, "−4.2" -> -4.2. */
function num(s) {
  if (s == null) return NaN
  const m = String(s).replace(/−/g, '-').replace(/,/g, '').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i)
  return m ? Number(m[0]) : NaN
}
/** Level payment of an amortising loan: M = P·r / (1 − (1 + r)^−n). */
/**
 * Total interest actually paid on a cent-rounded schedule: the payment is
 * rounded to the cent, each month's interest is rounded to the cent, and the
 * last payment clears what is left. This is what a lender's schedule sums to.
 */
const scheduleInterest = (P, annualPct, n) => {
  const r = annualPct / 100 / 12
  const M = Math.round(payment(P, annualPct, n) * 100)
  let bal = Math.round(P * 100)
  let total = 0
  for (let k = 0; k < n && bal > 0; k++) {
    const i = Math.round(bal * r)
    total += i
    bal -= Math.min(M - i, bal)
  }
  return total / 100
}
const payment = (P, annualPct, n) => {
  const r = annualPct / 100 / 12
  return r === 0 ? P / n : (P * r) / (1 - (1 + r) ** -n)
}
/** Serial day number of a civil date (proleptic Gregorian), for date arithmetic. */
const dayNo = (y, m, d) => Date.UTC(y, m - 1, d) / 86_400_000
const isoDay = (n) => new Date(n * 86_400_000).toISOString().slice(0, 10)

/* ── page helpers ─────────────────────────────────────────────────────── */

const ISLAND = '#tool astro-island, astro-island[component-url*="/components/tools/"]'
const BAD_TEXT = /\bNaN\b|\bInfinity\b|(?<!is |be |are )\bundefined\b|\[object Object\]/

function watch(page) {
  const problems = []
  page.on('console', (msg) => {
    const t = msg.text()
    if (msg.type() === 'error') problems.push(`console: ${t.slice(0, 240)}`)
    else if (msg.type() === 'warning' && /hydrat|did not match|server rendered/i.test(t)) problems.push(`warning: ${t.slice(0, 240)}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${String(e.message || e).slice(0, 240)}`))
  return problems
}

async function open(context, slug, query = '') {
  const page = await context.newPage()
  const problems = watch(page)
  await page.goto(`${BASE}/${slug}${query}`, { waitUntil: 'load', timeout: 90_000 })
  await page
    .waitForFunction(() => document.querySelectorAll('astro-island[ssr]').length === 0, null, { timeout: 45_000 })
    .catch(() => problems.push('island did not hydrate'))
  await page.waitForTimeout(250)
  return { page, problems }
}

/** Tool helpers bound to one page. */
function helpers(page) {
  const island = page.locator(ISLAND).first()
  const settle = () => page.waitForTimeout(120)
  const h = {
    page,
    island,
    async set(label, value, { nth = 0 } = {}) {
      const el = island.getByLabel(label, { exact: true }).nth(nth)
      await el.fill(String(value))
      await settle()
    },
    async setDate(label, value) {
      await island.getByLabel(label, { exact: true }).first().fill(value)
      await settle()
    },
    async press(name, { exact = true, role } = {}) {
      const roles = role ? [role] : ['tab', 'radio', 'button', 'checkbox', 'switch']
      for (const r of roles) {
        const el = island.getByRole(r, { name, exact })
        if ((await el.count()) > 0) {
          await el.first().click()
          await settle()
          return
        }
      }
      throw new Error(`no control named "${name}"`)
    },
    /** Radix select: open the combobox, click the option. */
    async choose(label, option, { exact = false } = {}) {
      await island.getByRole('combobox', { name: label, exact: true }).first().click()
      await page.getByRole('option', { name: option, exact }).first().click()
      await settle()
    },
    /** Native <select>. */
    async select(label, value) {
      await island.getByLabel(label, { exact: true }).first().selectOption(value)
      await settle()
    },
    async toggle(label, on) {
      const el = island.getByRole('switch', { name: label }).first()
      const state = await el.getAttribute('aria-checked')
      if ((state === 'true') !== on) {
        await el.click()
        await settle()
      }
    },
    async value(label) {
      return island.getByLabel(label, { exact: true }).first().inputValue()
    },
    async text() {
      return (await island.innerText()).replace(/−/g, '-')
    },
    /**
     * Value shown next to a label: finds an element whose own text equals
     * `label` (case-insensitive) and returns the text of the next sibling.
     */
    async stat(label, nth = 0) {
      return island.evaluate(
        (root, [want, nth]) => {
          const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase()
          const target = norm(want)
          const hits = []
          for (const el of root.querySelectorAll('*')) {
            const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')
            const txt = el.children.length === 0 ? el.textContent : own
            if (norm(txt || '') === target) hits.push(el)
          }
          const el = hits[nth]
          if (!el) return null
          let sib = el.nextElementSibling
          if (!sib && el.parentElement) sib = el.parentElement.nextElementSibling
          return sib ? sib.textContent.replace(/−/g, '-').trim() : null
        },
        [label, nth],
      )
    },
  }
  return h
}

/* ── checks ───────────────────────────────────────────────────────────── */

const checks = []
/** Register a check group on one page: fn(h, t) where t records expectations. */
const check = (slug, name, fn, query = '') => checks.push({ slug, name, fn, query })

/* ════════════════════════════ FINANCE ════════════════════════════ */

check('mortgage-calculator', '300k at 6% for 30 years', async (h, t) => {
  // M = P·r/(1−(1+r)^−n), r = 0.06/12, n = 360 -> 1,798.65. Total interest = n·M − P.
  await h.set('Home price', 375000)
  await h.set('Down payment', 20)
  await h.set('Interest rate', 6)
  await h.set('Loan term', 30)
  await h.set('Annual property tax rate', 0)
  await h.set('Home insurance', 0)
  await h.set('PMI rate', 0)
  const M = payment(300000, 6, 360)
  t.contains('monthly P&I', await h.text(), usd(M))
  t.contains('total interest', await h.text(), usd(scheduleInterest(300000, 6, 360)))
})

check('loan-calculator', '25k at 9.5% for 5 years', async (h, t) => {
  // M = P·r/(1−(1+r)^−n): 25,000, r = 0.095/12, n = 60 -> 525.05.
  await h.set('Loan amount', 25000)
  await h.set('Annual interest rate', 9.5)
  await h.set('Term (years)', 5)
  await h.set('Extra months', 0)
  await h.set('Origination / arrangement fee', 0)
  const M = payment(25000, 9.5, 60)
  t.contains('payment', await h.text(), usd(M))
  t.contains('total interest', await h.text(), usd(scheduleInterest(25000, 9.5, 60)))
})

check('loan-calculator', 'zero rate', async (h, t) => {
  // r = 0: M = P / n = 12,000 / 24 = 500.
  await h.set('Loan amount', 12000)
  await h.set('Annual interest rate', 0)
  await h.set('Term (years)', 2)
  t.contains('payment', await h.text(), usd(500))
})

check('car-loan-calculator', 'price, trade-in, tax and fees', async (h, t) => {
  // Amount financed = price − trade-in − down + tax·(price − trade-in) + fees
  // = 32,000 − 6,000 − 3,000 + 0.065·26,000 + 750 = 25,440. M over 60 months at 7.2%.
  await h.set('Vehicle price', 32000)
  await h.set('Trade-in value', 6000)
  await h.set('Still owed on trade-in', 0)
  await h.set('Cash down payment', 3000)
  await h.set('Fees (title, registration, doc)', 750)
  await h.set('Sales tax rate', 6.5)
  await h.set('APR', 7.2)
  await h.set('Loan term', 60)
  const P = 32000 - 6000 - 3000 + 0.065 * 26000 + 750
  t.contains('amount financed', await h.text(), usd(P))
  t.contains('payment', await h.text(), usd(payment(P, 7.2, 60)))
})

check('compound-interest-calculator', '10k at 5% monthly for 10 years', async (h, t) => {
  // A = P(1 + r/n)^(nt) = 10,000 · (1 + 0.05/12)^120 = 16,470.09.
  await h.set('Starting balance', 10000)
  await h.set('Regular deposit', 0)
  await h.set('Annual interest rate', 5)
  await h.set('Years to grow', 10)
  t.contains('balance', await h.text(), usd(10000 * (1 + 0.05 / 12) ** 120))
  // Effective annual rate = (1 + r/n)^n − 1 = 5.116%.
  t.contains('effective rate', await h.text(), `${((1 + 0.05 / 12) ** 12 - 1) * 100 > 0 ? fx(((1 + 0.05 / 12) ** 12 - 1) * 100, 3) : ''}%`)
})

check('compound-interest-calculator', 'with monthly deposits, end and start of period', async (h, t) => {
  // FV = P(1+i)^N + D·((1+i)^N − 1)/i, i = 0.07/12, N = 300 -> 462,290.03.
  // Annuity due multiplies the deposit part by (1 + i).
  await h.set('Starting balance', 10000)
  await h.set('Regular deposit', 500)
  await h.set('Annual interest rate', 7)
  await h.set('Years to grow', 25)
  const i = 0.07 / 12
  const g = (1 + i) ** 300
  t.contains('end of period', await h.text(), usd(10000 * g + (500 * (g - 1)) / i))
  await h.toggle('Deposit at the start of each period', true)
  t.contains('start of period', await h.text(), usd(10000 * g + ((500 * (g - 1)) / i) * (1 + i)))
})

check('compound-interest-calculator', 'annual compounding, monthly deposits', async (h, t) => {
  // Deposits more often than compounding: each deposit earns simple interest
  // within the year is one convention; the other converts to an equivalent
  // periodic rate. The site states its convention; check the equivalent-rate one:
  // i = (1.06)^(1/12) − 1, FV = D·((1+i)^N − 1)/i with N = 120, D = 100.
  await h.set('Starting balance', 0)
  await h.set('Regular deposit', 100)
  await h.set('Annual interest rate', 6)
  await h.choose('Compounding frequency', 'Annually')
  await h.set('Years to grow', 10)
  const i = 1.06 ** (1 / 12) - 1
  const eq = (100 * ((1 + i) ** 120 - 1)) / i
  // Simple-interest-within-year convention: 12 deposits of 100 at month ends grow to
  // 1200 + 100·0.06·(11+10+…+0)/12 = 1,233 per year, then compound yearly.
  const simpleYear = 1200 + (100 * 0.06 * 66) / 12
  const simple = (simpleYear * (1.06 ** 10 - 1)) / 0.06
  const shown = await h.text()
  t.ok('annual compounding (either convention)', shown.includes(usd(eq)) || shown.includes(usd(simple)), `want ${usd(eq)} or ${usd(simple)}`)
})

check('simple-interest-calculator', '10k at 5% for 3 years and 18 months', async (h, t) => {
  // I = P·r·t = 10,000 · 0.05 · 3 = 1,500; A = 11,500. 18 months -> t = 1.5 -> 750.
  await h.set('Principal', 10000)
  await h.set('Annual interest rate', 5)
  await h.set('Time', 3)
  t.contains('interest', await h.text(), usd(1500))
  t.contains('total', await h.text(), usd(11500))
  await h.choose('Time unit', 'Months')
  await h.set('Time', 18)
  t.contains('18 months', await h.text(), usd(750))
})

check('savings-goal-calculator', 'deposit needed', async (h, t) => {
  // D = (FV − PV(1+i)^N) · i / ((1+i)^N − 1), monthly, 5 years.
  // Nominal convention i = 0.04/12; effective convention i = 1.04^(1/12) − 1.
  await h.set('Savings goal', 50000)
  await h.set('Already saved', 5000)
  await h.set('Annual return', 4)
  await h.set('Reach it in', 5)
  const dep = (i) => ((50000 - 5000 * (1 + i) ** 60) * i) / ((1 + i) ** 60 - 1)
  const a = dep(0.04 / 12)
  const b = dep(1.04 ** (1 / 12) - 1)
  const shown = await h.text()
  t.ok('monthly deposit', shown.includes(usd(a)) || shown.includes(usd(b)), `want ${usd(a)} (nominal) or ${usd(b)} (effective)`)
})

check('retirement-calculator', 'balance at retirement, no raises', async (h, t) => {
  // FV of 75,000 plus 800/month for 30 years at 7%/yr, contributions flat.
  await h.set('Current age', 35)
  await h.set('Retirement age', 65)
  await h.set('Current retirement savings', 75000)
  await h.set('Monthly contribution', 800)
  await h.set('Yearly contribution increase', 0)
  await h.set('Expected annual return', 7)
  const nominal = (i) => 75000 * (1 + i) ** 360 + (800 * ((1 + i) ** 360 - 1)) / i
  const a = nominal(0.07 / 12)
  const b = nominal(1.07 ** (1 / 12) - 1)
  const shown = await h.text()
  t.ok('balance at 65', shown.includes(usd(a, 0)) || shown.includes(usd(b, 0)) || shown.includes(usd(a)) || shown.includes(usd(b)), `want ~${usd(a, 0)} or ~${usd(b, 0)}`)
})

check('roi-calculator', 'ROI and annualised ROI', async (h, t) => {
  // ROI = (final + income − cost) / cost; cost = 10,000 + 250 = 10,250, gain = 16,500 + 900 − 10,250 = 7,150
  // -> 69.76%. Annualised = (1 + ROI)^(1/4) − 1 = 14.29%.
  await h.set('Amount invested', 10000)
  await h.set('Additional costs', 250)
  await h.set('Final value', 16500)
  await h.set('Income received', 900)
  await h.set('Years held', 4)
  await h.set('Extra months', 0)
  const roi = (16500 + 900 - 10250) / 10250
  const shown = await h.text()
  t.contains('ROI', shown, `${fx(roi * 100, 2)}%`)
  t.contains('annualised', shown, `${fx(((1 + roi) ** 0.25 - 1) * 100, 2)}%`)
})

check('inflation-calculator', 'custom rate', async (h, t) => {
  // FV = PV · (1 + i)^years = 1,000 · 1.03^10 = 1,343.92.
  await h.press('Custom rate')
  await h.set('Amount', 1000)
  const labels = await h.island.getByLabel(/rate/i).count()
  if (labels) await h.island.getByLabel(/rate/i).first().fill('3')
  await h.page.waitForTimeout(150)
  const yearsField = h.island.getByLabel(/years/i)
  if (await yearsField.count()) await yearsField.first().fill('10')
  await h.page.waitForTimeout(150)
  t.contains('1000 at 3% for 10 years', await h.text(), usd(1000 * 1.03 ** 10))
})

check('salary-calculator', 'hourly to yearly', async (h, t) => {
  // 32 / h × 40 h × 52 weeks = 66,560 / year; 5,546.67 / month.
  await h.set('Pay amount', 32)
  await h.set('Hours per week', 40)
  await h.set('Weeks per year', 52)
  const shown = await h.text()
  t.contains('yearly', shown, usd(66560))
  t.contains('monthly', shown, usd(66560 / 12))
})

check('break-even-calculator', 'units and revenue', async (h, t) => {
  // Units = fixed / (price − variable) = 40,000 / 18 = 2,222.2 -> 2,223 units; revenue = units × price.
  // With target profit: (40,000 + 20,000) / 18 = 3,333.3 -> 3,334.
  await h.set('Fixed costs', 40000)
  await h.set('Variable cost per unit', 12)
  await h.set('Selling price per unit', 30)
  await h.set('Target profit', 20000)
  const shown = await h.text()
  t.contains('break-even units', shown, '2,223')
  t.contains('target units', shown, '3,334')
})

check('amortization-schedule-calculator', '320k at 6.25% for 30 years', async (h, t) => {
  await h.set('Loan amount', 320000)
  await h.set('Interest rate', 6.25)
  await h.set('Term', 30)
  await h.set('Extra every month', 0)
  await h.set('Extra every year', 0)
  await h.set('One-off lump sum', 0)
  t.contains('payment', await h.text(), usd(payment(320000, 6.25, 360)))
})

check('house-affordability-calculator', '28/36 rule', async (h, t) => {
  // Max housing = min(28% × gross/12, 36% × gross/12 − debts) = min(2,240, 2,880 − 550) = 2,240.
  await h.set('Gross annual income', 96000)
  await h.set('Co-borrower income', 0)
  await h.set('Other monthly debts', 550)
  await h.set('Front-end DTI', 28)
  await h.set('Back-end DTI', 36)
  t.contains('housing budget', await h.text(), usd(2240))
})

check('credit-card-payoff-calculator', 'months to pay off', async (h, t) => {
  // Months N = −ln(1 − B·i/M) / ln(1 + i), B = 6,400, i = 0.229/12, M = 250 -> 35.5 -> 36 months.
  await h.set('Current balance', 6400)
  await h.set('Purchase APR', 22.9)
  await h.press('Time from a payment')
  await h.set('Monthly payment', 250)
  const i = 0.229 / 12
  const N = -Math.log(1 - (6400 * i) / 250) / Math.log(1 + i)
  const shown = await h.text()
  const months = Math.ceil(N)
  const yrs = Math.floor(months / 12)
  const mo = months % 12
  const re = new RegExp(`\\b${months} months\\b|${yrs} years?${mo ? `,? ${mo} months?` : ''}|${yrs} yr${mo ? ` ${mo} mo` : ''}`, 'i')
  t.ok(`${months} months`, re.test(shown), `want ${months} months`)
})

check('hourly-to-salary-calculator', '28/h, 40 h, 52 weeks', async (h, t) => {
  // 28 × 40 × 52 = 58,240 / year.
  await h.set('Hourly amount', 28)
  await h.set('Hours per week', 40)
  await h.set('Weeks worked per year', 52)
  await h.set('Unpaid days off', 0)
  await h.set('Overtime hours / week', 0)
  t.contains('yearly', await h.text(), usd(58240))
})

check('hourly-to-salary-calculator', 'overtime', async (h, t) => {
  // 28 × (40 + 5 × 1.5) × 52 = 69,160 / year.
  await h.set('Hourly amount', 28)
  await h.set('Hours per week', 40)
  await h.set('Weeks worked per year', 52)
  await h.set('Unpaid days off', 0)
  await h.set('Overtime hours / week', 5)
  await h.set('Overtime multiplier', 1.5)
  t.contains('yearly with overtime', await h.text(), usd(69160))
})

check('margin-and-markup-calculator', 'cost 40, price 100', async (h, t) => {
  // Margin = (P − C)/P = 60%; markup = (P − C)/C = 150%.
  await h.set('Cost per unit', 40)
  await h.set('Selling price', 100)
  const shown = await h.text()
  t.contains('margin', shown, '60%')
  t.contains('markup', shown, '150%')
})

check('profit-margin-calculator', 'cost 40, margin 25%', async (h, t) => {
  // Price = C / (1 − m) = 40 / 0.75 = 53.33.
  await h.set('Cost per unit', 40)
  await h.set('Target margin', 25)
  t.contains('price', await h.text(), '53.33')
})

check('markup-calculator', 'cost 40, markup 25%', async (h, t) => {
  // Price = C · (1 + k) = 50; margin = 10/50 = 20%.
  await h.set('Cost per unit', 40)
  await h.set('Markup on cost', 25)
  const shown = await h.text()
  t.contains('price', shown, '50.00')
  t.contains('margin', shown, '20%')
})

check('vat-calculator', 'add and remove 20% VAT', async (h, t) => {
  // Add: 1,000 × 1.2 = 1,200 (VAT 200). Remove from 1,200: net = 1,200 / 1.2 = 1,000, VAT = 1,200·0.2/1.2 = 200.
  await h.press('Add VAT')
  await h.set('Amount excluding tax', 1000)
  await h.set('VAT rate', 20)
  let shown = await h.text()
  t.contains('gross', shown, '1,200.00')
  await h.press('Remove VAT')
  const field = h.island.getByLabel(/Amount including/i).first()
  await field.fill('99.99')
  await h.page.waitForTimeout(150)
  shown = await h.text()
  // 99.99 / 1.2 = 83.325 -> 83.33 net (half-up), VAT 16.66 so that net + VAT = 99.99.
  t.contains('net from gross', shown, '83.33')
  t.contains('VAT from gross', shown, '16.66')
})

check('gst-calculator', 'add 10% GST', async (h, t) => {
  // 1,000 × 1.1 = 1,100; GST 100. Remove from 1,100: GST = 1,100/11 = 100.
  await h.press('Add GST')
  await h.set('Amount excluding tax', 1000)
  await h.set('GST rate', 10)
  t.contains('gross', await h.text(), '1,100.00')
})

/* ── runner ───────────────────────────────────────────────────────────── */

function recorder() {
  const results = []
  const t = {
    results,
    ok(name, cond, detail = '') {
      results.push({ name, pass: !!cond, detail: cond ? '' : detail })
    },
    near(name, actual, expected, tol = 0.005) {
      const a = typeof actual === 'number' ? actual : num(actual)
      const pass = Number.isFinite(a) && Math.abs(a - expected) <= tol
      results.push({ name, pass, detail: pass ? '' : `got ${actual}, want ${expected} ±${tol}` })
    },
    contains(name, haystack, needle) {
      const pass = String(haystack).includes(needle)
      results.push({ name, pass, detail: pass ? '' : `"${needle}" not on screen` })
    },
    lacks(name, haystack, re) {
      const m = String(haystack).match(re)
      results.push({ name, pass: !m, detail: m ? `found "${m[0]}"` : '' })
    },
  }
  return t
}

async function runChecks(context) {
  let list = checks
  if (ONLY.length) list = list.filter((c) => ONLY.includes(c.slug))
  let pass = 0
  let fail = 0
  let next = 0
  const lines = []
  async function worker() {
    while (next < list.length) {
      const c = list[next++]
      const t = recorder()
      let problems = []
      let page
      try {
        const o = await open(context, c.slug, c.query)
        page = o.page
        problems = o.problems
        await c.fn(helpers(page), t)
        t.lacks('no NaN/Infinity on screen', await helpers(page).text(), BAD_TEXT)
      } catch (e) {
        t.ok('ran without error', false, String(e.message || e).split('\n')[0].slice(0, 200))
      }
      for (const p of problems) t.ok('no console/page errors', false, p)
      if (page) await page.close()
      const failed = t.results.filter((r) => !r.pass)
      pass += t.results.length - failed.length
      fail += failed.length
      const head = `${failed.length ? 'FAIL' : 'ok  '} ${c.slug} — ${c.name} (${t.results.length - failed.length}/${t.results.length})`
      lines.push(head)
      console.log(head)
      for (const f of failed) console.log(`       ✗ ${f.name}: ${f.detail}`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return { pass, fail }
}

async function runSweep(browser) {
  // A clock, zone and locale far from the server's, so any value computed from
  // "now" or the visitor's locale during the first render shows up as a mismatch.
  const context = await browser.newContext({ locale: 'de-DE', timezoneId: 'Pacific/Kiritimati' })
  await context.clock.install({ time: new Date('2027-02-28T10:30:00Z') })
  let pages = calculatorPages()
  if (ONLY.length) pages = pages.filter((p) => ONLY.includes(p))
  let pass = 0
  let fail = 0
  let next = 0
  async function worker() {
    while (next < pages.length) {
      const slug = pages[next++]
      const issues = []
      try {
        const { page, problems } = await open(context, slug)
        await page.waitForTimeout(400)
        const txt = await helpers(page).text()
        const m = txt.match(BAD_TEXT)
        if (m) issues.push(`text: ${m[0]}`)
        issues.push(...problems)
        await page.close()
      } catch (e) {
        issues.push(String(e.message || e).slice(0, 200))
      }
      if (issues.length) {
        fail++
        console.log(`FAIL sweep ${slug}: ${issues.join(' | ')}`)
      } else pass++
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  await context.close()
  console.log(`sweep: ${pass} pages clean, ${fail} with problems`)
  return { pass, fail }
}

const EDGE_VALUES = ['', '0', '-5', '1e308', '99999999999999']

async function runEdge(context) {
  let pages = calculatorPages()
  if (ONLY.length) pages = pages.filter((p) => ONLY.includes(p))
  let pass = 0
  let fail = 0
  let next = 0
  async function worker() {
    while (next < pages.length) {
      const slug = pages[next++]
      const issues = new Set()
      try {
        const { page, problems } = await open(context, slug)
        const h = helpers(page)
        const inputs = h.island.locator('input[type=text], input[type=number], input:not([type])')
        const count = await inputs.count()
        for (let i = 0; i < count; i++) {
          const el = inputs.nth(i)
          if (!(await el.isVisible()) || !(await el.isEditable())) continue
          const original = await el.inputValue()
          for (const v of EDGE_VALUES) {
            await el.fill(v).catch(() => {})
            await page.waitForTimeout(60)
            const txt = await h.text()
            const m = txt.match(BAD_TEXT)
            if (m) {
              const id = (await el.getAttribute('id')) || `#${i}`
              const lab = await page.evaluate((id) => document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() || id, id)
              issues.add(`"${lab}"=${v || '(empty)'} -> ${m[0]}`)
            }
          }
          await el.fill(original).catch(() => {})
        }
        for (const p of problems) issues.add(p)
        await page.close()
      } catch (e) {
        issues.add(String(e.message || e).slice(0, 200))
      }
      if (issues.size) {
        fail++
        console.log(`FAIL edge ${slug}: ${[...issues].slice(0, 6).join(' | ')}`)
      } else pass++
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`edge: ${pass} pages clean, ${fail} with problems`)
  return { pass, fail }
}

const browser = await chromium.launch()
let failed = 0
if (MODES.includes('checks')) {
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC' })
  const { pass, fail } = await runChecks(context)
  console.log(`checks: ${pass} passed, ${fail} failed`)
  failed += fail
  await context.close()
}
if (MODES.includes('sweep')) failed += (await runSweep(browser)).fail
if (MODES.includes('edge')) {
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC' })
  failed += (await runEdge(context)).fail
  await context.close()
}
await browser.close()
process.exit(failed ? 1 : 0)
