/** Probability distributions, tests and descriptive statistics. */
import { choice, num, pos, select } from '../engine/fields'
import { dec, fmt, int, pct } from '../engine/format'
import { boxShape, densityShape, fmtTick, scatterShape } from '../engine/plots'
import { Phi, binomPmf, chi2Cdf, chi2Pdf, fCdf, fPdf, invPhi, mean, phi, poissonPmf, quantile, readList, readRows, tCdf, tInv, tPdf, variance } from '../engine/stats'
import { fail } from '../engine/types'
import type { Chart, Spec } from '../engine/types'

const p4 = (v: number) => (v < 0.0001 && v > 0 ? v.toExponential(3).replace('-', '−') : dec(v, 6))
const LIST_HINT = 'Separate the numbers with spaces, commas or new lines.'
const listField = (id: string, label: string, value: string) => ({ id, kind: 'text' as const, label, value, rows: 3, hint: LIST_HINT })

/* ── discrete distributions ────────────────────────────────────── */

const CMP = [['eq', 'P(X = k)'], ['le', 'P(X ≤ k)'], ['ge', 'P(X ≥ k)']] as const
const inSet = (x: number, k: number, c: string | undefined) => (c === 'le' ? x <= k : c === 'ge' ? x >= k : x === k)

function pmfChart(pmf: (x: number) => number, lo: number, hi: number, k: number, c: string | undefined, summary: string): Chart {
  const xs = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  return {
    kind: 'stacked',
    categories: xs,
    series: [
      { id: 'in', label: 'In your event', values: xs.map((x) => (inSet(x, k, c) ? pmf(x) : 0)), paint: 'ink' },
      { id: 'out', label: 'Other values', values: xs.map((x) => (inSet(x, k, c) ? 0 : pmf(x))), paint: 'grey' },
    ],
    categoryLabel: 'x =',
    formatY: (v) => dec(v, 3),
    formatValue: (v) => dec(v, 5),
    showTotal: false,
    defaultIndex: Math.max(0, Math.min(xs.length - 1, k - lo)),
    summary,
    table: true,
  }
}

const window = (center: number, sd: number, min: number, max: number) => {
  const lo = Math.max(min, Math.floor(center - 4.5 * sd))
  const hi = Math.min(max, Math.ceil(center + 4.5 * sd))
  return hi - lo > 60 ? [Math.max(min, Math.round(center - 30)), Math.min(max, Math.round(center + 30))] : [lo, hi]
}

export function binomial(n: number, p: number, k: number) {
  let le = 0
  for (let x = 0; x <= k; x++) le += binomPmf(x, n, p)
  const eq = binomPmf(k, n, p)
  return { eq, le: Math.min(1, le), ge: Math.min(1, 1 - le + eq), mean: n * p, sd: Math.sqrt(n * p * (1 - p)) }
}

const binomSpec: Spec = {
  inputs: [
    pos('n', 'Trials (n)', '20', undefined, { int: true, max: 100000, half: true }),
    num('p', 'Probability of success (p)', '0.3', undefined, { min: 0, max: 1, half: true }),
    num('k', 'Successes (k)', '6', undefined, { int: true, min: 0, half: true }),
    { ...select('c', 'Find', 'eq', CMP), half: true },
  ],
  compute: ({ n, s }) => {
    if (n.k > n.n) fail('Successes cannot be more than trials.')
    const x = binomial(n.n, n.p, n.k)
    const val = s.c === 'le' ? x.le : s.c === 'ge' ? x.ge : x.eq
    const [lo, hi] = window(x.mean, Math.max(x.sd, 1), 0, n.n)
    return {
      main: { label: CMP.find((c) => c[0] === s.c)?.[1].replace('k', String(n.k)) ?? 'P', value: val, format: p4 },
      stats: [
        { label: `P(X = ${n.k})`, value: x.eq, format: p4 },
        { label: `P(X ≤ ${n.k})`, value: x.le, format: p4 },
        { label: `P(X ≥ ${n.k})`, value: x.ge, format: p4 },
        { label: 'Mean np', value: x.mean, format: (v) => dec(v, 4) },
        { label: 'Standard deviation', value: x.sd, format: (v) => dec(v, 4) },
      ],
      working: [
        `P(X = k) = C(n, k) × p^k × (1 − p)^(n − k)`,
        `P(X = ${n.k}) = C(${n.n}, ${n.k}) × ${n.p}^${n.k} × ${dec(1 - n.p, 6)}^${n.n - n.k} = ${p4(x.eq)}`,
        `P(X ≤ ${n.k}) = Σ P(X = x) for x = 0 … ${n.k} = ${p4(x.le)}`,
        `mean = np = ${dec(x.mean, 4)}, sd = √(np(1 − p)) = ${dec(x.sd, 4)}`,
      ],
      chart: pmfChart((v) => binomPmf(v, n.n, n.p), lo, hi, n.k, s.c, `In ${n.n} trials with p = ${n.p}, the chance of ${s.c === 'le' ? `at most ${n.k}` : s.c === 'ge' ? `at least ${n.k}` : `exactly ${n.k}`} successes is ${p4(val)}.`),
    }
  },
}

export function poisson(lambda: number, k: number) {
  let le = 0
  for (let x = 0; x <= k; x++) le += poissonPmf(x, lambda)
  const eq = poissonPmf(k, lambda)
  return { eq, le: Math.min(1, le), ge: Math.min(1, 1 - le + eq) }
}

const poissonSpec: Spec = {
  inputs: [
    pos('l', 'Average rate (λ)', '4', undefined, { max: 100000, half: true }),
    num('k', 'Events (k)', '6', undefined, { int: true, min: 0, half: true }),
    select('c', 'Find', 'eq', CMP),
  ],
  compute: ({ n, s }) => {
    const x = poisson(n.l, n.k)
    const val = s.c === 'le' ? x.le : s.c === 'ge' ? x.ge : x.eq
    const [lo, hi] = window(n.l, Math.sqrt(n.l), 0, Math.max(n.k + 5, Math.ceil(n.l + 6 * Math.sqrt(n.l))))
    return {
      main: { label: CMP.find((c) => c[0] === s.c)?.[1].replace('k', String(n.k)) ?? 'P', value: val, format: p4 },
      stats: [
        { label: `P(X = ${n.k})`, value: x.eq, format: p4 },
        { label: `P(X ≤ ${n.k})`, value: x.le, format: p4 },
        { label: `P(X ≥ ${n.k})`, value: x.ge, format: p4 },
        { label: 'Mean and variance', value: n.l, format: (v) => dec(v, 4) },
      ],
      working: [`P(X = k) = λ^k × e^−λ ÷ k!`, `P(X = ${n.k}) = ${n.l}^${n.k} × e^−${n.l} ÷ ${n.k}! = ${p4(x.eq)}`, `P(X ≤ ${n.k}) = Σ P(X = x) for x = 0 … ${n.k} = ${p4(x.le)}`],
      chart: pmfChart((v) => poissonPmf(v, n.l), Math.min(lo, n.k), Math.max(hi, n.k), n.k, s.c, `With ${n.l} events on average, the chance of ${s.c === 'le' ? `at most ${n.k}` : s.c === 'ge' ? `at least ${n.k}` : `exactly ${n.k}`} is ${p4(val)}.`),
    }
  },
}

/* ── normal distribution ───────────────────────────────────────── */

const normalSpec: Spec = {
  inputs: [
    num('mu', 'Mean (μ)', '100', undefined, { half: true }),
    pos('sd', 'Standard deviation (σ)', '15', undefined, { half: true }),
    select('m', 'Find', 'below', [['below', 'P(X < x)'], ['above', 'P(X > x)'], ['between', 'P(a < X < b)'], ['outside', 'P(X < a or X > b)'], ['inv', 'x for a percentile']]),
    num('x', 'x', '120', undefined, { when: (s) => s.m === 'below' || s.m === 'above' }),
    num('a', 'a', '85', undefined, { when: (s) => s.m === 'between' || s.m === 'outside', half: true }),
    num('b', 'b', '115', undefined, { when: (s) => s.m === 'between' || s.m === 'outside', half: true }),
    num('p', 'Percentile', '95', '%', { when: (s) => s.m === 'inv', above: 0, max: 99.9999 }),
  ],
  compute: ({ n, s }) => {
    const z = (v: number) => (v - n.mu) / n.sd
    const pdf = (v: number) => phi(z(v))
    const lo = n.mu - 4 * n.sd
    const hi = n.mu + 4 * n.sd
    if ((s.m === 'between' || s.m === 'outside') && n.a >= n.b) fail('a must be below b.')
    let p: number
    let shade: [number, number][]
    let ticks: { x: number; text: string }[]
    let lines: string[]
    let label: string
    if (s.m === 'inv') {
      const x = n.mu + n.sd * invPhi(n.p / 100)
      const zz = invPhi(n.p / 100)
      shade = [[lo, x]]
      ticks = [{ x, text: fmtTick(x) }]
      lines = [`z = Φ⁻¹(${n.p}%) = ${dec(zz, 5)}`, `x = μ + zσ = ${n.mu} + ${dec(zz, 5)} × ${n.sd} = ${fmt(x, 8)}`]
      return {
        main: { label: `x at the ${n.p}th percentile`, value: x, format: (v) => fmt(v, 7) },
        stats: [{ label: 'z-score', value: zz, format: (v) => dec(v, 4) }],
        working: lines,
        chart: { kind: 'shape', ...densityShape(pdf, lo, hi, shade, ticks, `${n.p}% of values fall below ${fmt(x, 6)}.`) },
      }
    }
    if (s.m === 'below' || s.m === 'above') {
      const below = Phi(z(n.x))
      p = s.m === 'below' ? below : 1 - below
      shade = s.m === 'below' ? [[lo, n.x]] : [[n.x, hi]]
      ticks = [{ x: n.x, text: fmtTick(n.x) }]
      label = s.m === 'below' ? `P(X < ${n.x})` : `P(X > ${n.x})`
      lines = [`z = (x − μ) ÷ σ = (${n.x} − ${n.mu}) ÷ ${n.sd} = ${dec(z(n.x), 5)}`, `${label} = ${s.m === 'below' ? 'Φ(z)' : '1 − Φ(z)'} = ${p4(p)}`]
    } else {
      const inside = Phi(z(n.b)) - Phi(z(n.a))
      p = s.m === 'between' ? inside : 1 - inside
      shade = s.m === 'between' ? [[n.a, n.b]] : [[lo, n.a], [n.b, hi]]
      ticks = [{ x: n.a, text: fmtTick(n.a) }, { x: n.b, text: fmtTick(n.b) }]
      label = s.m === 'between' ? `P(${n.a} < X < ${n.b})` : `P(X < ${n.a} or X > ${n.b})`
      lines = [`z(a) = ${dec(z(n.a), 5)}, z(b) = ${dec(z(n.b), 5)}`, `Φ(z(b)) − Φ(z(a)) = ${p4(inside)}`, ...(s.m === 'outside' ? [`outside = 1 − ${p4(inside)} = ${p4(p)}`] : [])]
    }
    return {
      main: { label, value: p, format: p4, sub: pct(p * 100, 3) },
      stats: [
        { label: 'As a percent', value: p * 100, format: (v) => pct(v, 4) },
        { label: 'One in', value: p > 0 ? 1 / p : Infinity, format: (v) => fmt(v, 4) },
      ],
      working: lines,
      note: 'Φ is the standard normal cumulative distribution.',
      chart: { kind: 'shape', ...densityShape(pdf, lo, hi, shade, ticks, `The shaded area is ${pct(p * 100, 2)} of a normal distribution with mean ${n.mu} and standard deviation ${n.sd}.`) },
    }
  },
}

/* ── t-test ────────────────────────────────────────────────────── */

export function welch(m1: number, s1: number, n1: number, m2: number, s2: number, n2: number) {
  const v1 = (s1 * s1) / n1
  const v2 = (s2 * s2) / n2
  const se = Math.sqrt(v1 + v2)
  const t = (m1 - m2) / se
  const df = ((v1 + v2) ** 2) / (v1 * v1 / (n1 - 1) + v2 * v2 / (n2 - 1))
  return { t, df, se }
}
export function pooled(m1: number, s1: number, n1: number, m2: number, s2: number, n2: number) {
  const df = n1 + n2 - 2
  const sp = Math.sqrt(((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / df)
  const se = sp * Math.sqrt(1 / n1 + 1 / n2)
  return { t: (m1 - m2) / se, df, se }
}
export const twoTail = (t: number, df: number) => 2 * (1 - tCdf(Math.abs(t), df))

const tSpec: Spec = {
  inputs: [
    select('m', 'Test', 'welch', [['one', 'One sample'], ['welch', 'Two samples, unequal variances (Welch)'], ['pooled', 'Two samples, equal variances'], ['paired', 'Paired differences']]),
    num('m1', (s) => (s.m === 'paired' ? 'Mean of the differences' : s.m === 'one' ? 'Sample mean' : 'Mean 1'), '5.2', undefined, { half: true }),
    pos('s1', (s) => (s.m === 'paired' ? 'SD of the differences' : s.m === 'one' ? 'Sample SD' : 'SD 1'), '1.1', undefined, { half: true }),
    pos('n1', (s) => (s.m === 'one' || s.m === 'paired' ? 'Sample size' : 'n 1'), '30', undefined, { int: true, min: 2, half: true }),
    num('mu', 'Mean under the null', '0', undefined, { when: (s) => s.m === 'one' || s.m === 'paired', half: true }),
    num('m2', 'Mean 2', '4.6', undefined, { when: (s) => s.m === 'welch' || s.m === 'pooled', half: true }),
    pos('s2', 'SD 2', '1.4', undefined, { when: (s) => s.m === 'welch' || s.m === 'pooled', half: true }),
    pos('n2', 'n 2', '28', undefined, { when: (s) => s.m === 'welch' || s.m === 'pooled', int: true, min: 2, half: true }),
    num('alpha', 'Significance level', '0.05', undefined, { above: 0, max: 0.5, half: true }),
  ],
  compute: ({ n, s }) => {
    const one = s.m === 'one' || s.m === 'paired'
    const r = one ? { t: (n.m1 - n.mu) / (n.s1 / Math.sqrt(n.n1)), df: n.n1 - 1, se: n.s1 / Math.sqrt(n.n1) } : s.m === 'pooled' ? pooled(n.m1, n.s1, n.n1, n.m2, n.s2, n.n2) : welch(n.m1, n.s1, n.n1, n.m2, n.s2, n.n2)
    const p = twoTail(r.t, r.df)
    const crit = tInv(1 - n.alpha / 2, r.df)
    const diff = one ? n.m1 - n.mu : n.m1 - n.m2
    const lim = Math.max(4, Math.abs(r.t) + 1)
    return {
      main: { label: 'p-value, two-tailed', value: p, format: p4, sub: p < n.alpha ? `significant at α = ${n.alpha}` : `not significant at α = ${n.alpha}` },
      stats: [
        { label: 't statistic', value: r.t, format: (v) => dec(v, 4) },
        { label: 'Degrees of freedom', value: r.df, format: (v) => dec(v, 2) },
        { label: 'One-tailed p', value: p / 2, format: p4 },
        { label: `${dec((1 - n.alpha) * 100, 2)}% CI of the difference`, value: `${fmt(diff - crit * r.se, 5)} to ${fmt(diff + crit * r.se, 5)}` },
      ],
      working: [
        one ? `SE = s ÷ √n = ${n.s1} ÷ √${n.n1} = ${dec(r.se, 5)}` : s.m === 'pooled' ? `SE = sp × √(1/n1 + 1/n2) = ${dec(r.se, 5)}` : `SE = √(s1²/n1 + s2²/n2) = ${dec(r.se, 5)}`,
        `t = ${one ? `(x̄ − μ0)` : '(x̄1 − x̄2)'} ÷ SE = ${dec(diff, 5)} ÷ ${dec(r.se, 5)} = ${dec(r.t, 5)}`,
        s.m === 'welch' ? `df (Welch–Satterthwaite) = ${dec(r.df, 3)}` : `df = ${r.df}`,
        `p = 2 × (1 − T(|t|, df)) = ${p4(p)}; critical t = ${dec(crit, 4)}`,
      ],
      chart: { kind: 'shape', ...densityShape((x) => tPdf(x, r.df), -lim, lim, [[-lim, -Math.abs(r.t)], [Math.abs(r.t), lim]], [{ x: -Math.abs(r.t), text: dec(-Math.abs(r.t), 2) }, { x: Math.abs(r.t), text: dec(Math.abs(r.t), 2) }], `t = ${dec(r.t, 3)} with ${dec(r.df, 1)} degrees of freedom. The shaded tails, the p-value, cover ${pct(p * 100, 2)} of the t distribution.`) },
    }
  },
}

/* ── chi-square ────────────────────────────────────────────────── */

export function chiGof(obs: number[], exp: number[]) {
  const parts = obs.map((o, i) => ((o - exp[i]!) ** 2) / exp[i]!)
  const x2 = parts.reduce((a, b) => a + b, 0)
  return { x2, parts, df: obs.length - 1, p: 1 - chi2Cdf(x2, obs.length - 1) }
}
export function chiIndependence(table: number[][]) {
  const rows = table.map((r) => r.reduce((a, b) => a + b, 0))
  const cols = table[0]!.map((_, j) => table.reduce((a, r) => a + r[j]!, 0))
  const total = rows.reduce((a, b) => a + b, 0)
  let x2 = 0
  const parts: number[] = []
  table.forEach((r, i) => r.forEach((o, j) => {
    const e = (rows[i]! * cols[j]!) / total
    const c = ((o - e) ** 2) / e
    parts.push(c)
    x2 += c
  }))
  const df = (table.length - 1) * (cols.length - 1)
  return { x2, parts, df, p: 1 - chi2Cdf(x2, df) }
}

const chiSpec: Spec = {
  inputs: [
    choice('m', 'Test', 'ind', [['ind', 'Independence (table)'], ['gof', 'Goodness of fit']]),
    { id: 't', kind: 'text', label: 'Observed counts, one row per line', value: '30 20\n15 35', rows: 4, when: (s) => s.m === 'ind', hint: 'Columns separated by spaces or commas.' },
    { ...listField('o', 'Observed counts', '18 22 25 35'), when: (s) => s.m === 'gof' },
    { ...listField('e', 'Expected counts or proportions', '25 25 25 25'), when: (s) => s.m === 'gof' },
  ],
  compute: ({ s }) => {
    let r: { x2: number; parts: number[]; df: number; p: number }
    let labels: string[]
    if (s.m === 'gof') {
      const o = readList(s.o ?? '', 2)
      if (o.error) fail(o.error)
      const e = readList(s.e ?? '', 2)
      if (e.error) fail(e.error)
      if (o.values.length !== e.values.length) fail('Enter as many expected values as observed counts.')
      if (e.values.some((v) => v <= 0)) fail('Every expected value must be above zero.')
      const totalO = o.values.reduce((a, b) => a + b, 0)
      const totalE = e.values.reduce((a, b) => a + b, 0)
      const exp = e.values.map((v) => (v / totalE) * totalO)
      r = chiGof(o.values, exp)
      labels = o.values.map((_, i) => `Category ${i + 1}`)
    } else {
      const lines = (s.t ?? '').split('\n').filter((l) => l.trim())
      const cols = lines[0]?.trim().split(/[\s,;]+/).length ?? 0
      const t = readRows(s.t ?? '', cols)
      if (t.error) fail(t.error)
      if (t.rows.length < 2 || cols < 2) fail('The table needs at least 2 rows and 2 columns.')
      if (t.rows.some((row) => row.some((v) => v < 0))) fail('Counts cannot be negative.')
      r = chiIndependence(t.rows)
      labels = t.rows.flatMap((row, i) => row.map((_, j) => `Row ${i + 1}, column ${j + 1}`))
    }
    return {
      main: { label: 'p-value', value: r.p, format: p4, sub: r.p < 0.05 ? 'significant at 0.05' : 'not significant at 0.05' },
      stats: [
        { label: 'χ² statistic', value: r.x2, format: (v) => dec(v, 4) },
        { label: 'Degrees of freedom', value: r.df, format: int },
      ],
      working: [`χ² = Σ (O − E)² ÷ E = ${dec(r.x2, 5)}`, s.m === 'gof' ? `df = categories − 1 = ${r.df}` : `df = (rows − 1) × (columns − 1) = ${r.df}`, `p = P(χ²(${r.df}) > ${dec(r.x2, 4)}) = ${p4(r.p)}`],
      note: s.m === 'gof' ? 'Expected values are scaled to the observed total, so proportions work too.' : 'Each expected count is row total × column total ÷ grand total. Each should be at least 5 for the test to hold.',
      chart: { kind: 'bars', items: labels.map((l, i) => ({ label: l, value: r.parts[i]!, highlight: r.parts[i] === Math.max(...r.parts) })), formatValue: (v) => dec(v, 3), summary: `χ² = ${dec(r.x2, 3)} with ${r.df} degrees of freedom gives p = ${p4(r.p)}. The bars show how much each cell adds to χ².`, table: true, columns: ['Cell', '(O − E)² ÷ E'] },
    }
  },
}

/* ── correlation and regression ────────────────────────────────── */

export function regression(x: number[], y: number[]) {
  const n = x.length
  const mx = mean(x)
  const my = mean(y)
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    sxx += (x[i]! - mx) ** 2
    syy += (y[i]! - my) ** 2
    sxy += (x[i]! - mx) * (y[i]! - my)
  }
  const b = sxy / sxx
  const a = my - b * mx
  const r = sxy / Math.sqrt(sxx * syy)
  const sse = y.reduce((acc, v, i) => acc + (v - (a + b * x[i]!)) ** 2, 0)
  const se = Math.sqrt(sse / (n - 2))
  return { a, b, r, r2: r * r, se, seB: se / Math.sqrt(sxx), mx, my }
}
const ranks = (v: number[]) => {
  const idx = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0])
  const out = Array<number>(v.length)
  for (let i = 0; i < idx.length; ) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++
    for (let k = i; k <= j; k++) out[idx[k]![1]] = (i + j) / 2 + 1
    i = j + 1
  }
  return out
}
export const spearman = (x: number[], y: number[]) => regression(ranks(x), ranks(y)).r

function pairs(s: Record<string, string>) {
  const x = readList(s.x ?? '', 3)
  if (x.error) fail(x.error)
  const y = readList(s.y ?? '', 3)
  if (y.error) fail(y.error)
  if (x.values.length !== y.values.length) fail(`There are ${x.values.length} x values and ${y.values.length} y values. Enter the same number of each.`)
  if (new Set(x.values).size < 2) fail('The x values must not all be the same.')
  return { x: x.values, y: y.values }
}

const corrSpec: Spec = {
  inputs: [listField('x', 'x values', '1 2 3 4 5 6 7 8'), listField('y', 'y values', '2.1 3.9 6.2 7.8 10.1 12.2 13.8 16.1')],
  compute: ({ s }) => {
    const { x, y } = pairs(s)
    if (new Set(y).size < 2) fail('The y values must not all be the same.')
    const g = regression(x, y)
    const n = x.length
    const t = (g.r * Math.sqrt(n - 2)) / Math.sqrt(Math.max(1e-300, 1 - g.r2))
    const p = twoTail(t, n - 2)
    const strength = Math.abs(g.r) >= 0.7 ? 'strong' : Math.abs(g.r) >= 0.4 ? 'moderate' : Math.abs(g.r) >= 0.1 ? 'weak' : 'no'
    return {
      main: { label: 'Pearson correlation r', value: g.r, format: (v) => dec(v, 4), sub: `${strength} ${g.r >= 0 ? 'positive' : 'negative'} linear relationship` },
      stats: [
        { label: 'r²', value: g.r2, format: (v) => dec(v, 4) },
        { label: 'Spearman rank ρ', value: spearman(x, y), format: (v) => dec(v, 4) },
        { label: 'p-value', value: p, format: p4 },
        { label: 'Pairs', value: n, format: int },
      ],
      working: [`r = Σ(x − x̄)(y − ȳ) ÷ √(Σ(x − x̄)² × Σ(y − ȳ)²) = ${dec(g.r, 6)}`, `t = r√(n − 2) ÷ √(1 − r²) = ${dec(t, 4)}, df = ${n - 2}`, `p = ${p4(p)}`],
      note: 'Correlation measures a straight-line relationship. It does not show cause, and one outlier can change it a lot.',
      chart: { kind: 'shape', ...scatterShape(x, y, { a: g.a, b: g.b }, `${n} points with r = ${dec(g.r, 3)}. The dashed line is the least-squares fit.`) },
    }
  },
}

const regSpec: Spec = {
  inputs: [listField('x', 'x values', '1 2 3 4 5 6 7 8'), listField('y', 'y values', '2.1 3.9 6.2 7.8 10.1 12.2 13.8 16.1'), num('x0', 'Predict y at x', '10', undefined, { optional: true })],
  compute: ({ n, s }) => {
    const { x, y } = pairs(s)
    const g = regression(x, y)
    const has = Number.isFinite(n.x0)
    const yhat = has ? g.a + g.b * n.x0 : NaN
    return {
      main: { label: 'Regression line', value: `y = ${fmt(g.a, 5)} ${g.b < 0 ? '−' : '+'} ${fmt(Math.abs(g.b), 5)}x` },
      stats: [
        { label: 'Slope', value: g.b, format: (v) => fmt(v, 6) },
        { label: 'Intercept', value: g.a, format: (v) => fmt(v, 6) },
        { label: 'r²', value: g.r2, format: (v) => dec(v, 4) },
        { label: 'Standard error', value: g.se, format: (v) => fmt(v, 5) },
        { label: has ? `y at x = ${n.x0}` : 'Prediction', value: has ? fmt(yhat, 6) : 'Enter an x' },
      ],
      working: [`x̄ = ${fmt(g.mx, 6)}, ȳ = ${fmt(g.my, 6)}`, `slope b = Σ(x − x̄)(y − ȳ) ÷ Σ(x − x̄)² = ${fmt(g.b, 6)}`, `intercept a = ȳ − b·x̄ = ${fmt(g.a, 6)}`, `r² = ${dec(g.r2, 5)}; SE of the slope = ${fmt(g.seB, 5)}`, ...(has ? [`ŷ = ${fmt(g.a, 6)} + ${fmt(g.b, 6)} × ${n.x0} = ${fmt(yhat, 6)}`] : [])],
      chart: { kind: 'shape', ...scatterShape(x, y, { a: g.a, b: g.b }, `The least-squares line y = ${fmt(g.a, 4)} + ${fmt(g.b, 4)}x explains ${pct(g.r2 * 100, 1)} of the variation in y.`, has ? [n.x0, yhat] : undefined) },
      csv: { filename: 'regression-residuals.csv', columns: ['x', 'y', 'predicted', 'residual'], rows: x.map((v, i) => [v, y[i]!, Number((g.a + g.b * v).toPrecision(10)), Number((y[i]! - g.a - g.b * v).toPrecision(10))]) },
    }
  },
}

/* ── descriptive statistics ────────────────────────────────────── */

const DATA = '12 15 17 20 22 23 25 28 31 34 36 41 58'

const sortedBars = (sorted: number[], cut: (v: number, i: number) => boolean, summary: string): Chart => ({
  kind: 'stacked',
  categories: sorted.map((_, i) => i + 1),
  series: [
    { id: 'a', label: 'At or below', values: sorted.map((v, i) => (cut(v, i) ? v : 0)), paint: 'ink' },
    { id: 'b', label: 'Above', values: sorted.map((v, i) => (cut(v, i) ? 0 : v)), paint: 'grey' },
  ],
  categoryLabel: 'Rank',
  formatValue: (v) => fmt(v, 6),
  summary,
  table: true,
})

const percentileSpec: Spec = {
  inputs: [listField('d', 'Data', DATA), num('p', 'Percentile', '75', '%', { min: 0, max: 100, half: true }), num('x', 'Percentile rank of', '30', undefined, { optional: true, half: true })],
  compute: ({ n, s }) => {
    const { values, error } = readList(s.d ?? '', 2)
    if (error) fail(error)
    const sorted = [...values].sort((a, b) => a - b)
    const v = quantile(sorted, n.p / 100)
    const below = Number.isFinite(n.x) ? sorted.filter((d) => d < n.x).length : NaN
    const eq = Number.isFinite(n.x) ? sorted.filter((d) => d === n.x).length : NaN
    const rank = ((below + 0.5 * eq) / sorted.length) * 100
    const h = (sorted.length - 1) * (n.p / 100)
    return {
      main: { label: `${n.p}th percentile`, value: v, format: (x) => fmt(x, 7) },
      stats: [
        { label: Number.isFinite(n.x) ? `Percentile rank of ${n.x}` : 'Percentile rank', value: Number.isFinite(n.x) ? pct(rank, 1) : 'Enter a value' },
        { label: 'Values', value: sorted.length, format: int },
        { label: 'Median', value: quantile(sorted, 0.5), format: (x) => fmt(x, 6) },
      ],
      working: [`sorted: ${sorted.map((x) => fmt(x, 6)).join(', ')}`, `position h = (n − 1) × p = ${sorted.length - 1} × ${n.p / 100} = ${dec(h, 4)}`, `value = x[${Math.floor(h) + 1}] + ${dec(h - Math.floor(h), 4)} × (x[${Math.ceil(h) + 1}] − x[${Math.floor(h) + 1}]) = ${fmt(v, 7)}`, ...(Number.isFinite(n.x) ? [`rank of ${n.x} = (below + ½ × equal) ÷ n = (${below} + ½ × ${eq}) ÷ ${sorted.length} = ${pct(rank, 2)}`] : [])],
      note: 'Linear interpolation between closest ranks, the method of spreadsheet PERCENTILE.INC. Other methods give slightly different values on small data sets.',
      chart: sortedBars(sorted, (x) => x <= v, `${pct(n.p, 0)} of the ${sorted.length} values are at or below ${fmt(v, 5)}.`),
    }
  },
}

export function quartiles(sorted: number[]) {
  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  const lf = q1 - 1.5 * iqr
  const uf = q3 + 1.5 * iqr
  const inside = sorted.filter((v) => v >= lf && v <= uf)
  return { q1, med: quantile(sorted, 0.5), q3, iqr, lf, uf, outliers: sorted.filter((v) => v < lf || v > uf), lo: inside[0]!, hi: inside[inside.length - 1]! }
}

const iqrSpec: Spec = {
  inputs: [listField('d', 'Data', DATA)],
  compute: ({ s }) => {
    const { values, error } = readList(s.d ?? '', 4)
    if (error) fail(error)
    const sorted = [...values].sort((a, b) => a - b)
    const q = quartiles(sorted)
    return {
      main: { label: 'Interquartile range', value: q.iqr, format: (v) => fmt(v, 7) },
      stats: [
        { label: 'Q1', value: q.q1, format: (v) => fmt(v, 6) },
        { label: 'Median', value: q.med, format: (v) => fmt(v, 6) },
        { label: 'Q3', value: q.q3, format: (v) => fmt(v, 6) },
        { label: 'Outliers', value: q.outliers.length ? q.outliers.map((v) => fmt(v, 6)).join(', ') : 'None' },
        { label: 'Lower fence', value: q.lf, format: (v) => fmt(v, 6) },
        { label: 'Upper fence', value: q.uf, format: (v) => fmt(v, 6) },
      ],
      working: [`Q1 = 25th percentile = ${fmt(q.q1, 7)}, Q3 = 75th percentile = ${fmt(q.q3, 7)}`, `IQR = Q3 − Q1 = ${fmt(q.iqr, 7)}`, `fences = Q1 − 1.5 × IQR = ${fmt(q.lf, 6)} and Q3 + 1.5 × IQR = ${fmt(q.uf, 6)}`, `outliers: values outside the fences`],
      note: 'Quartiles by linear interpolation (PERCENTILE.INC). Textbooks that split the data into halves can give slightly different quartiles.',
      chart: { kind: 'shape', ...boxShape(q.lo, q.q1, q.med, q.q3, q.hi, q.outliers, sorted[0]!, sorted[sorted.length - 1]!, `The middle half of the data spans ${fmt(q.q1, 5)} to ${fmt(q.q3, 5)}. ${q.outliers.length ? `${q.outliers.length} outlier${q.outliers.length > 1 ? 's' : ''} beyond the fences.` : 'No outliers.'}`) },
    }
  },
}

const evSpec: Spec = {
  inputs: [{ id: 'r', kind: 'text', label: 'Outcome and probability, one pair per line', value: '100 0.1\n20 0.3\n0 0.4\n-10 0.2', rows: 5, hint: 'Value, then its probability. The probabilities must add up to 1.' }],
  compute: ({ s }) => {
    const { rows, error } = readRows(s.r ?? '', 2)
    if (error) fail(error)
    if (rows.some(([, p]) => p! < 0)) fail('Probabilities cannot be negative.')
    const total = rows.reduce((a, [, p]) => a + p!, 0)
    if (Math.abs(total - 1) > 1e-6) fail(`The probabilities add up to ${fmt(total, 6)}, not 1.`)
    const ev = rows.reduce((a, [x, p]) => a + x! * p!, 0)
    const v = rows.reduce((a, [x, p]) => a + p! * (x! - ev) ** 2, 0)
    return {
      main: { label: 'Expected value', value: ev, format: (x) => fmt(x, 7) },
      stats: [
        { label: 'Variance', value: v, format: (x) => fmt(x, 6) },
        { label: 'Standard deviation', value: Math.sqrt(v), format: (x) => fmt(x, 6) },
        { label: 'Outcomes', value: rows.length, format: int },
      ],
      working: [`E[X] = Σ x·p = ${rows.map(([x, p]) => `${fmt(x!, 5)} × ${fmt(p!, 5)}`).join(' + ')} = ${fmt(ev, 7)}`, `Var = Σ p(x − E[X])² = ${fmt(v, 6)}`],
      chart: { kind: 'bars', items: rows.map(([x, p]) => ({ label: `x = ${fmt(x!, 6)}`, value: p!, note: `adds ${fmt(x! * p!, 5)}` })), formatValue: (p) => dec(p, 4), max: 1, summary: `The long-run average outcome is ${fmt(ev, 5)} per trial.`, table: true, columns: ['Outcome', 'Probability'] },
    }
  },
}

/* ── p-value ───────────────────────────────────────────────────── */

const pSpec: Spec = {
  inputs: [
    select('d', 'Test statistic', 'z', [['z', 'z (normal)'], ['t', 't'], ['chi', 'Chi-square'], ['f', 'F']]),
    num('x', 'Statistic', '2.1', undefined, {}),
    pos('df', 'Degrees of freedom', '15', undefined, { when: (s) => s.d === 't' || s.d === 'chi', half: true }),
    pos('d1', 'df numerator', '3', undefined, { when: (s) => s.d === 'f', half: true }),
    pos('d2', 'df denominator', '20', undefined, { when: (s) => s.d === 'f', half: true }),
    select('tail', 'Tail', 'two', [['two', 'Two-tailed'], ['right', 'Right-tailed'], ['left', 'Left-tailed']], { when: (s) => s.d === 'z' || s.d === 't' }),
  ],
  compute: ({ n, s }) => {
    let cdf: (x: number) => number
    let pdf: (x: number) => number
    let lo: number
    let hi: number
    if (s.d === 'z' || s.d === 't') {
      cdf = s.d === 'z' ? Phi : (x) => tCdf(x, n.df)
      pdf = s.d === 'z' ? phi : (x) => tPdf(x, n.df)
      hi = Math.max(4, Math.abs(n.x) + 1)
      lo = -hi
    } else {
      if (n.x < 0) fail('A chi-square or F statistic cannot be negative.')
      cdf = s.d === 'chi' ? (x) => chi2Cdf(x, n.df) : (x) => fCdf(x, n.d1, n.d2)
      pdf = s.d === 'chi' ? (x) => chi2Pdf(x, n.df) : (x) => fPdf(x, n.d1, n.d2)
      lo = 0
      hi = Math.max(n.x * 1.4, s.d === 'chi' ? n.df + 4 * Math.sqrt(2 * n.df) : 5)
    }
    const sym = s.d === 'z' || s.d === 't'
    const tail = sym ? (s.tail ?? 'two') : 'right'
    const right = 1 - cdf(n.x)
    const left = cdf(n.x)
    const p = tail === 'two' ? 2 * Math.min(left, right) : tail === 'right' ? right : left
    const a = Math.abs(n.x)
    const shade: [number, number][] = tail === 'two' ? [[lo, -a], [a, hi]] : tail === 'right' ? [[n.x, hi]] : [[lo, n.x]]
    const name = s.d === 'z' ? 'z' : s.d === 't' ? `t(${n.df})` : s.d === 'chi' ? `χ²(${n.df})` : `F(${n.d1}, ${n.d2})`
    return {
      main: { label: 'p-value', value: p, format: p4, sub: p < 0.05 ? 'below 0.05' : 'not below 0.05' },
      stats: [
        { label: 'Left tail', value: left, format: p4 },
        { label: 'Right tail', value: right, format: p4 },
        { label: 'Significant at 0.01', value: p < 0.01 ? 'Yes' : 'No' },
      ],
      working: [`distribution: ${name}`, tail === 'two' ? `p = 2 × min(P(X ≤ ${n.x}), P(X ≥ ${n.x})) = ${p4(p)}` : tail === 'right' ? `p = P(X ≥ ${n.x}) = 1 − CDF(${n.x}) = ${p4(p)}` : `p = P(X ≤ ${n.x}) = CDF(${n.x}) = ${p4(p)}`],
      note: 'The CDFs use the regularized incomplete beta and gamma functions, accurate to about 12 digits.',
      chart: { kind: 'shape', ...densityShape(pdf, lo, hi, shade, tail === 'two' ? [{ x: -a, text: fmtTick(-a) }, { x: a, text: fmtTick(a) }] : [{ x: n.x, text: fmtTick(n.x) }], `For ${name} = ${n.x}, the shaded ${tail === 'two' ? 'tails cover' : 'tail covers'} ${pct(p * 100, 3)} of the distribution.`) },
    }
  },
}

/* ── spread ────────────────────────────────────────────────────── */

const seSpec: Spec = {
  inputs: [
    choice('m', 'Standard error of', 'mean', [['mean', 'A mean'], ['prop', 'A proportion']]),
    pos('sd', 'Standard deviation', '12', undefined, { when: (s) => s.m !== 'prop', half: true }),
    num('p', 'Proportion', '0.42', undefined, { when: (s) => s.m === 'prop', min: 0, max: 1, half: true }),
    pos('n', 'Sample size', '50', undefined, { int: true, min: 2, half: true }),
  ],
  compute: ({ n, s }) => {
    const prop = s.m === 'prop'
    const f = (k: number) => (prop ? Math.sqrt((n.p * (1 - n.p)) / k) : n.sd / Math.sqrt(k))
    const se = f(n.n)
    const crit = prop ? 1.959964 : tInv(0.975, n.n - 1)
    const xs = Array.from({ length: 40 }, (_, k) => Math.max(2, Math.round(((k + 1) * n.n * 4) / 40)))
    return {
      main: { label: 'Standard error', value: se, format: (v) => fmt(v, 6) },
      stats: [
        { label: '95% margin of error', value: crit * se, format: (v) => fmt(v, 5) },
        { label: prop ? 'z used' : `t used (df ${n.n - 1})`, value: crit, format: (v) => dec(v, 4) },
        { label: 'Sample size to halve it', value: n.n * 4, format: int },
      ],
      working: prop ? [`SE = √(p(1 − p) ÷ n) = √(${n.p} × ${dec(1 - n.p, 6)} ÷ ${n.n}) = ${fmt(se, 6)}`, `margin = 1.96 × SE = ${fmt(crit * se, 5)}`] : [`SE = s ÷ √n = ${n.sd} ÷ √${n.n} = ${fmt(se, 6)}`, `margin = t(0.975, ${n.n - 1}) × SE = ${dec(crit, 4)} × ${fmt(se, 6)} = ${fmt(crit * se, 5)}`],
      chart: { kind: 'line', x: [...new Set(xs)], series: [{ id: 'se', label: 'Standard error', values: [...new Set(xs)].map(f) }], xLabel: 'n', formatX: String, formatValue: (v) => fmt(v, 4), markers: [{ x: n.n, label: 'Your n' }], summary: `The standard error falls with the square root of the sample size: 4 times the data halves it.`, table: true },
    }
  },
}

const cvSpec: Spec = {
  inputs: [listField('d', 'Data', '48 52 50 47 55 49 51 53'), choice('k', 'Data is a', 'sample', [['sample', 'Sample'], ['pop', 'Population']])],
  compute: ({ s }) => {
    const { values, error } = readList(s.d ?? '', 2)
    if (error) fail(error)
    const m = mean(values)
    if (m === 0) fail('The mean is zero, so the coefficient of variation is not defined.')
    const sd = Math.sqrt(variance(values, s.k !== 'pop'))
    const cv = (sd / Math.abs(m)) * 100
    return {
      main: { label: 'Coefficient of variation', value: cv, format: (v) => pct(v, 3) },
      stats: [
        { label: 'Mean', value: m, format: (v) => fmt(v, 7) },
        { label: s.k === 'pop' ? 'Population SD' : 'Sample SD', value: sd, format: (v) => fmt(v, 6) },
        { label: 'Values', value: values.length, format: int },
      ],
      working: [`mean = ${fmt(m, 7)}`, `SD = √(Σ(x − mean)² ÷ ${s.k === 'pop' ? 'n' : '(n − 1)'}) = ${fmt(sd, 6)}`, `CV = SD ÷ |mean| = ${fmt(sd, 6)} ÷ ${fmt(Math.abs(m), 6)} = ${pct(cv, 4)}`],
      note: 'CV compares spread between data sets with different units or means. It only makes sense for data on a ratio scale, with a true zero.',
      chart: { kind: 'gauge', variant: 'bar', value: Math.min(60, cv), min: 0, max: 60, bands: [{ to: 10, label: 'Low' }, { to: 20, label: 'Moderate' }, { to: 30, label: 'High' }, { to: 60, label: 'Very high' }], center: pct(cv, 2), formatValue: (v) => `${v}%`, summary: `The standard deviation is ${pct(cv, 1)} of the mean.` },
    }
  },
}

const waSpec: Spec = {
  inputs: [{ id: 'r', kind: 'text', label: 'Value and weight, one pair per line', value: '90 0.2\n82 0.3\n75 0.5', rows: 5, hint: 'For grades: score, then the weight or credits.' }],
  compute: ({ s }) => {
    const { rows, error } = readRows(s.r ?? '', 2)
    if (error) fail(error)
    const w = rows.reduce((a, [, x]) => a + x!, 0)
    if (w === 0) fail('The weights add up to zero.')
    const wm = rows.reduce((a, [v, x]) => a + v! * x!, 0) / w
    const plain = mean(rows.map(([v]) => v!))
    return {
      main: { label: 'Weighted average', value: wm, format: (v) => fmt(v, 7) },
      stats: [
        { label: 'Sum of weights', value: w, format: (v) => fmt(v, 6) },
        { label: 'Plain average', value: plain, format: (v) => fmt(v, 7) },
        { label: 'Difference', value: wm - plain, format: (v) => fmt(v, 5) },
      ],
      working: [`Σ value × weight = ${rows.map(([v, x]) => `${fmt(v!, 5)} × ${fmt(x!, 5)}`).join(' + ')} = ${fmt(wm * w, 7)}`, `weighted average = ${fmt(wm * w, 7)} ÷ ${fmt(w, 6)} = ${fmt(wm, 7)}`],
      chart: { kind: 'bars', items: rows.map(([v, x]) => ({ label: `${fmt(v!, 6)} × ${fmt(x!, 4)}`, value: (v! * x!) / w })), formatValue: (v) => fmt(v, 5), summary: `The weighted average is ${fmt(wm, 5)}. Each bar is one value’s share of it.`, table: true, columns: ['Value × weight', 'Share of the average'] },
    }
  },
}

const madSpec: Spec = {
  inputs: [listField('d', 'Data', '4 7 8 10 12 15 22')],
  compute: ({ s }) => {
    const { values, error } = readList(s.d ?? '', 2)
    if (error) fail(error)
    const m = mean(values)
    const dev = values.map((v) => Math.abs(v - m))
    const mad = mean(dev)
    const sorted = [...values].sort((a, b) => a - b)
    const med = quantile(sorted, 0.5)
    const medAd = quantile(values.map((v) => Math.abs(v - med)).sort((a, b) => a - b), 0.5)
    return {
      main: { label: 'Mean absolute deviation', value: mad, format: (v) => fmt(v, 7) },
      stats: [
        { label: 'Mean', value: m, format: (v) => fmt(v, 7) },
        { label: 'Median absolute deviation', value: medAd, format: (v) => fmt(v, 6) },
        { label: 'Standard deviation', value: Math.sqrt(variance(values, false)), format: (v) => fmt(v, 6) },
      ],
      working: [`mean = ${fmt(m, 7)}`, `|x − mean| = ${dev.map((d) => fmt(d, 5)).join(', ')}`, `MAD = Σ|x − mean| ÷ n = ${fmt(dev.reduce((a, b) => a + b, 0), 7)} ÷ ${values.length} = ${fmt(mad, 7)}`],
      chart: { kind: 'bars', items: values.slice(0, 40).map((v, i) => ({ label: `${fmt(v, 6)}`, value: dev[i]!, highlight: dev[i] === Math.max(...dev) })), formatValue: (v) => fmt(v, 5), summary: `On average a value is ${fmt(mad, 4)} away from the mean of ${fmt(m, 5)}.`, table: true, columns: ['Value', 'Distance from the mean'] },
    }
  },
}

export const specs: Record<string, Spec> = {
  'binomial-distribution-calculator': binomSpec,
  'poisson-distribution-calculator': poissonSpec,
  'normal-distribution-calculator': normalSpec,
  't-test-calculator': tSpec,
  'chi-square-calculator': chiSpec,
  'correlation-coefficient-calculator': corrSpec,
  'linear-regression-calculator': regSpec,
  'percentile-calculator': percentileSpec,
  'iqr-calculator': iqrSpec,
  'expected-value-calculator': evSpec,
  'p-value-calculator': pSpec,
  'standard-error-calculator': seSpec,
  'coefficient-of-variation-calculator': cvSpec,
  'weighted-average-calculator': waSpec,
  'mean-absolute-deviation-calculator': madSpec,
}
