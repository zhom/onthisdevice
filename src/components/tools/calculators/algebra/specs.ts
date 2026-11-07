/** Number theory, algebra, complex numbers, vectors and trigonometry. */
import { factorial as bigFactorial, groupBig, bigSci } from '@/components/tools/calc2/combinatorics'
import { factorize, powerForm } from '@/components/tools/calc2/primes'
import { choice, num, pos, select } from '../engine/fields'
import { dec, fmt, int, pct } from '../engine/format'
import { fmtTick } from '../engine/plots'
import { lgamma, readList } from '../engine/stats'
import { fail } from '../engine/types'
import type { ShapeLabel, ShapePath, Spec } from '../engine/types'

const big = (v: bigint) => {
  const s = v.toString()
  if (s.length <= 24) return groupBig(v)
  const { mant, exp } = bigSci(v, 6)
  return `${mant} × 10^${exp}`
}
const circlePts = (cx: number, cy: number, r: number, n = 72, a0 = 0, a1 = 2 * Math.PI): [number, number][] =>
  Array.from({ length: n + 1 }, (_, k) => [cx + r * Math.cos(a0 + ((a1 - a0) * k) / n), cy + r * Math.sin(a0 + ((a1 - a0) * k) / n)])
const arrow = (x0: number, y0: number, x1: number, y1: number, head = 0.25): [number, number][] => {
  const a = Math.atan2(y1 - y0, x1 - x0)
  const len = Math.hypot(x1 - x0, y1 - y0)
  const h = Math.min(head, len / 3)
  return [[x0, y0], [x1, y1], [x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4)], [x1, y1], [x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4)]]
}

/* ── factorial and Fibonacci ───────────────────────────────────── */

export const trailingZeros = (n: number) => {
  let z = 0
  for (let p = 5; p <= n; p *= 5) z += Math.floor(n / p)
  return z
}

const factorialSpec: Spec = {
  inputs: [num('n', 'n', '20', undefined, { int: true, min: 0, max: 100000 })],
  compute: ({ n }) => {
    const exact = n.n <= 3000 ? bigFactorial(n.n) : null
    const log10 = lgamma(n.n + 1) / Math.LN10
    const digits = exact ? exact.toString().length : Math.floor(log10) + 1
    const stirling = Math.sqrt(2 * Math.PI * n.n) * Math.pow(n.n / Math.E, n.n)
    const xs = Array.from({ length: 21 }, (_, k) => Math.round((n.n * k) / 20)).filter((v, i, a) => a.indexOf(v) === i)
    const main = exact ? big(exact) : `${dec(10 ** (log10 - Math.floor(log10)), 6)} × 10^${Math.floor(log10)}`
    return {
      main: { label: `${n.n}!`, value: main },
      stats: [
        { label: 'Digits', value: digits, format: int },
        { label: 'Trailing zeros', value: trailingZeros(n.n), format: int },
        { label: 'Stirling estimate', value: n.n > 0 && n.n <= 170 ? `${dec(stirling / Number(exact ?? 1n), 6)} of the exact value` : 'Use log form' },
      ],
      working: [
        n.n <= 12 ? `${n.n}! = ${Array.from({ length: n.n }, (_, k) => n.n - k).join(' × ') || '1'} = ${exact}` : `${n.n}! = ${n.n} × ${n.n - 1} × … × 2 × 1`,
        `log₁₀(${n.n}!) = ${dec(log10, 6)}, so ${digits} digits`,
        `trailing zeros = ⌊n/5⌋ + ⌊n/25⌋ + ⌊n/125⌋ + … = ${trailingZeros(n.n)}`,
        ...(exact && exact.toString().length > 24 ? [`exact value: copy it below`] : []),
      ],
      note: exact ? `The exact value has ${digits} digits. 0! = 1 by definition.` : 'Above 3,000! only the logarithm and the leading digits are shown.',
      chart: {
        kind: 'line',
        x: xs,
        series: [{ id: 'd', label: 'Digits of k!', values: xs.map((k) => Math.floor(lgamma(k + 1) / Math.LN10) + 1) }],
        xLabel: 'k',
        formatX: String,
        formatValue: (v) => `${int(v)} digits`,
        summary: `${n.n}! has ${int(digits)} digits. Factorials grow faster than any power: the digit count itself grows faster than k.`,
        table: true,
      },
      csv: exact && exact.toString().length > 24 ? { filename: `factorial-${n.n}.csv`, columns: ['n', 'n!'], rows: [[n.n, exact.toString()]] } : undefined,
    }
  },
}

export function fibonacci(n: number): bigint {
  let a = 0n
  let b = 1n
  for (let i = 0; i < n; i++) [a, b] = [b, a + b]
  return a
}

const PHI = (1 + Math.sqrt(5)) / 2

const fibSpec: Spec = {
  inputs: [num('n', 'Term n', '30', undefined, { int: true, min: 0, max: 20000 })],
  compute: ({ n }) => {
    const f = fibonacci(n.n)
    const terms = Array.from({ length: Math.min(n.n + 1, 15) }, (_, k) => fibonacci(k).toString())
    const ks = Array.from({ length: Math.min(Math.max(n.n, 2), 20) - 1 }, (_, k) => k + 2)
    const ratio = (k: number) => Number(fibonacci(k)) / Number(fibonacci(k - 1))
    return {
      main: { label: `F(${n.n})`, value: big(f) },
      stats: [
        { label: 'Digits', value: f.toString().length, format: int },
        { label: 'F(n) ÷ F(n − 1)', value: n.n >= 2 ? (n.n < 1400 ? ratio(n.n) : PHI) : NaN, format: (v) => (Number.isFinite(v) ? dec(v, 10) : '–') },
        { label: 'Is even', value: f % 2n === 0n ? 'Yes' : 'No' },
      ],
      working: [`F(0) = 0, F(1) = 1, F(n) = F(n − 1) + F(n − 2)`, `first terms: ${terms.join(', ')}${n.n >= 15 ? ', …' : ''}`, `Binet: F(n) = (φⁿ − (−φ)⁻ⁿ) ÷ √5, φ = ${dec(PHI, 10)}`],
      note: 'The ratio of neighbouring terms approaches the golden ratio φ.',
      chart: {
        kind: 'line',
        x: ks,
        series: [{ id: 'r', label: 'F(k) ÷ F(k − 1)', values: ks.map(ratio) }],
        xLabel: 'k',
        formatX: String,
        formatValue: (v) => dec(v, 6),
        zero: false,
        guides: [{ y: PHI, label: 'φ' }],
        summary: `F(${n.n}) has ${f.toString().length} digits. The ratio of neighbours swings above and below φ = 1.618… and settles on it.`,
        table: true,
      },
    }
  },
}

/* ── modulo ────────────────────────────────────────────────────── */

export function mod(a: bigint, b: bigint, kind: string): bigint {
  const t = a % b
  if (kind === 'trunc') return t
  if (kind === 'floor') return t !== 0n && (t < 0n) !== (b < 0n) ? t + b : t
  return t < 0n ? t + (b < 0n ? -b : b) : t
}

const modSpec: Spec = {
  inputs: [
    { id: 'a', kind: 'text', label: 'Dividend a', value: '100', rows: 1 },
    { id: 'b', kind: 'text', label: 'Divisor n', value: '7', rows: 1 },
    select('k', 'Sign convention', 'euclid', [['euclid', 'Euclidean: result 0 or more'], ['floor', 'Floored: sign of the divisor'], ['trunc', 'Truncated: sign of the dividend']]),
  ],
  compute: ({ s }) => {
    const parse = (v: string | undefined, name: string) => {
      const t = (v ?? '').trim().replace(/[,_\s]/g, '').replace(/[−–]/g, '-')
      if (!/^-?\d+$/.test(t)) fail(`${name} must be a whole number.`)
      return BigInt(t)
    }
    const a = parse(s.a, 'The dividend')
    const b = parse(s.b, 'The divisor')
    if (b === 0n) fail('The divisor cannot be zero.')
    const r = mod(a, b, s.k ?? 'euclid')
    const q = (a - r) / b
    const nb = Number(b < 0n ? -b : b)
    const ticks = Math.min(nb, 60)
    const rr = Number(r < 0n ? r + (b < 0n ? -b : b) : r) % nb
    const ang = (i: number) => Math.PI / 2 - (2 * Math.PI * i) / Math.max(1, nb)
    const paths: ShapePath[] = [{ pts: circlePts(0, 0, 3), closed: true, line: 'grey', width: 1 }]
    for (let i = 0; i < ticks; i++) {
      const t = ang((i * nb) / ticks)
      paths.push({ pts: [[2.8 * Math.cos(t), 2.8 * Math.sin(t)], [3.2 * Math.cos(t), 3.2 * Math.sin(t)]], line: 'grey', width: 1 })
    }
    paths.push({ pts: arrow(0, 0, 2.6 * Math.cos(ang(rr)), 2.6 * Math.sin(ang(rr)), 0.35), line: 'solid', width: 3 })
    const labels: ShapeLabel[] = [{ at: [0, 3.2], text: '0', dy: -10 }, { at: [3.6 * Math.cos(ang(rr)), 3.6 * Math.sin(ang(rr))], text: r.toString(), strong: true }]
    return {
      main: { label: `${a} mod ${b}`, value: r.toString() },
      stats: [
        { label: 'Quotient', value: q.toString() },
        { label: 'Check', value: `${b} × ${q} + ${r} = ${a}` },
        { label: 'Divides evenly', value: r === 0n ? 'Yes' : 'No' },
      ],
      working: [`a = n × q + r`, `${a} = ${b} × ${q} + ${r}`, s.k === 'trunc' ? 'truncated: q rounds toward zero' : s.k === 'floor' ? 'floored: q rounds down' : 'Euclidean: 0 ≤ r < |n|'],
      note: 'For positive numbers the three conventions agree. With negatives, programming languages differ: % in JavaScript, C and Java truncates; Python’s % floors.',
      chart: { kind: 'shape', paths, labels, summary: `On a clock with ${b < 0n ? -b : b} positions, ${a} lands on ${rr}.`, height: 240 },
    }
  },
}

/* ── polynomial roots ──────────────────────────────────────────── */

export type C = [number, number]
const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]
const cdiv = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1]
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]
}

/** Durand-Kerner roots of a polynomial, coefficients from the highest degree. */
export function polyRoots(coef: number[]): C[] {
  const a = coef.map((c) => c / coef[0]!)
  const n = a.length - 1
  let z: C[] = Array.from({ length: n }, (_, k) => {
    const r = 0.4 + 0.9 * k
    return [r * Math.cos(0.4 + (2 * Math.PI * k) / n), r * Math.sin(0.4 + (2 * Math.PI * k) / n)]
  })
  const f = (x: C): C => a.reduce<C>((acc, c) => [cmul(acc, x)[0] + c, cmul(acc, x)[1]], [0, 0])
  for (let it = 0; it < 2000; it++) {
    let moved = 0
    z = z.map((zi, i) => {
      let den: C = [1, 0]
      z.forEach((zj, j) => {
        if (i !== j) den = cmul(den, [zi[0] - zj[0], zi[1] - zj[1]])
      })
      const step = cdiv(f(zi), den)
      moved = Math.max(moved, Math.hypot(step[0], step[1]))
      return [zi[0] - step[0], zi[1] - step[1]]
    })
    if (moved < 1e-15) break
  }
  return z.map(([re, im]) => [Math.abs(re) < 1e-12 ? 0 : re, Math.abs(im) < 1e-9 * Math.max(1, Math.abs(re)) ? 0 : im] as C).sort((p, q) => p[0] - q[0] || p[1] - q[1])
}
const cText = ([re, im]: C) => (im === 0 ? fmt(re, 8) : `${re === 0 ? '' : fmt(re, 7)}${im < 0 ? ' − ' : re === 0 ? '' : ' + '}${fmt(Math.abs(im), 7)}i`.replace(/^ \+ /, '').replace(/^ − /, '−'))

const polySpec: Spec = {
  inputs: [{ id: 'c', kind: 'text', label: 'Coefficients, highest power first', value: '1 -6 11 -6', rows: 2, hint: 'x³ − 6x² + 11x − 6 is 1 −6 11 −6. Up to degree 10.' }],
  compute: ({ s }) => {
    const { values, error } = readList(s.c ?? '', 2)
    if (error) fail(error)
    const coef = [...values]
    while (coef.length > 1 && coef[0] === 0) coef.shift()
    if (coef.length < 2) fail('Enter a polynomial of degree 1 or more.')
    if (coef.length > 11) fail('Degree 10 is the most this calculator solves.')
    const roots = polyRoots(coef)
    const real = roots.filter((r) => r[1] === 0).map((r) => r[0])
    const f = (x: number) => coef.reduce((acc, c) => acc * x + c, 0)
    const span = real.length ? Math.max(...real) - Math.min(...real) : 2
    const lo = (real.length ? Math.min(...real) : -2) - Math.max(1, span * 0.3)
    const hi = (real.length ? Math.max(...real) : 2) + Math.max(1, span * 0.3)
    const xs = Array.from({ length: 81 }, (_, k) => Number((lo + ((hi - lo) * k) / 80).toPrecision(6)))
    const deg = coef.length - 1
    const terms = coef.map((c, i) => ({ c, p: deg - i })).filter((t) => t.c !== 0).map((t, i) => `${t.c < 0 ? (i ? ' − ' : '−') : i ? ' + ' : ''}${Math.abs(t.c) === 1 && t.p ? '' : fmt(Math.abs(t.c), 6)}${t.p ? `x${t.p > 1 ? `^${t.p}` : ''}` : ''}`).join('')
    return {
      main: { label: `Roots of degree ${deg}`, value: roots.map(cText).join(',  ') },
      stats: [
        { label: 'Real roots', value: real.length, format: int },
        { label: 'Complex roots', value: roots.length - real.length, format: int },
        { label: 'Largest residual |p(root)|', value: Math.max(...roots.map((r) => { let acc: C = [0, 0]; for (const c of coef) acc = [cmul(acc, r)[0] + c, cmul(acc, r)[1]]; return Math.hypot(acc[0], acc[1]) })), format: (v) => (v === 0 ? '0' : v.toExponential(1).replace('-', '−')) },
      ],
      working: [`p(x) = ${terms}`, 'Durand–Kerner: zᵢ ← zᵢ − p(zᵢ) ÷ Π(zᵢ − zⱼ), repeated until no root moves more than 10⁻¹⁵', ...roots.map((r, i) => `x${i + 1} = ${cText(r)}`)],
      note: 'Repeated roots converge more slowly and may show tiny imaginary parts.',
      chart: {
        kind: 'line',
        x: xs,
        series: [{ id: 'p', label: 'p(x)', values: xs.map(f) }],
        xLabel: 'x',
        formatX: (v) => fmtTick(v),
        formatValue: (v) => fmt(v, 5),
        guides: [{ y: 0, label: 'y = 0' }],
        markers: real.slice(0, 6).map((r) => ({ x: Number(r.toPrecision(6)), label: fmt(r, 4) })),
        summary: `p(x) = ${terms} has ${real.length} real root${real.length === 1 ? '' : 's'}, where the curve crosses zero${roots.length > real.length ? `, and ${roots.length - real.length} complex roots` : ''}.`,
        table: true,
      },
    }
  },
}

/* ── complex numbers ───────────────────────────────────────────── */

export function complexOp(z1: C, z2: C, op: string, n: number): C {
  switch (op) {
    case 'add':
      return [z1[0] + z2[0], z1[1] + z2[1]]
    case 'sub':
      return [z1[0] - z2[0], z1[1] - z2[1]]
    case 'mul':
      return cmul(z1, z2)
    case 'div':
      return cdiv(z1, z2)
    case 'pow': {
      const r = Math.pow(Math.hypot(z1[0], z1[1]), n)
      const t = Math.atan2(z1[1], z1[0]) * n
      return [r * Math.cos(t), r * Math.sin(t)]
    }
    case 'sqrt': {
      const r = Math.sqrt(Math.hypot(z1[0], z1[1]))
      const t = Math.atan2(z1[1], z1[0]) / 2
      return [r * Math.cos(t), r * Math.sin(t)]
    }
    default:
      return [z1[0], -z1[1]]
  }
}

const complexSpec: Spec = {
  inputs: [
    select('op', 'Operation', 'mul', [['add', 'z1 + z2'], ['sub', 'z1 − z2'], ['mul', 'z1 × z2'], ['div', 'z1 ÷ z2'], ['pow', 'z1 to a power'], ['sqrt', 'Square root of z1'], ['conj', 'Conjugate of z1']]),
    num('a', 'z1 real part', '3', undefined, { half: true }),
    num('b', 'z1 imaginary part', '4', undefined, { half: true }),
    num('c', 'z2 real part', '1', undefined, { half: true, when: (s) => ['add', 'sub', 'mul', 'div'].includes(s.op ?? '') }),
    num('d', 'z2 imaginary part', '-2', undefined, { half: true, when: (s) => ['add', 'sub', 'mul', 'div'].includes(s.op ?? '') }),
    num('n', 'Power', '3', undefined, { when: (s) => s.op === 'pow', min: -100, max: 100 }),
  ],
  compute: ({ n, s }) => {
    const z1: C = [n.a, n.b]
    const two = ['add', 'sub', 'mul', 'div'].includes(s.op ?? '')
    const z2: C = two ? [n.c, n.d] : [0, 0]
    if (s.op === 'div' && n.c === 0 && n.d === 0) fail('Cannot divide by zero.')
    const r = complexOp(z1, z2, s.op ?? 'mul', n.n)
    const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v)
    const res: C = [clean(r[0]), clean(r[1])]
    const mod = Math.hypot(res[0], res[1])
    const arg = (Math.atan2(res[1], res[0]) * 180) / Math.PI
    const pts = [z1, ...(two ? [z2] : []), res]
    const m = Math.max(1, ...pts.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1])))) * 1.15
    const sc = 4 / m
    const P = (p: C): [number, number] => [p[0] * sc, p[1] * sc]
    const opSym: Record<string, string> = { add: '+', sub: '−', mul: '×', div: '÷' }
    const opText = two ? `(${cText(z1)}) ${opSym[s.op ?? 'mul']} (${cText(z2)})` : s.op === 'pow' ? `(${cText(z1)})^${n.n}` : s.op === 'sqrt' ? `√(${cText(z1)})` : `conj(${cText(z1)})`
    return {
      main: { label: opText, value: cText(res) },
      stats: [
        { label: 'Modulus |z|', value: mod, format: (v) => fmt(v, 8) },
        { label: 'Argument', value: arg, format: (v) => `${dec(v, 4)}°` },
        { label: 'Polar form', value: `${fmt(mod, 6)} ∠ ${dec(arg, 3)}°` },
        { label: 'Exponential form', value: `${fmt(mod, 6)} e^(${dec((arg * Math.PI) / 180, 5)}i)` },
      ],
      working:
        s.op === 'mul'
          ? [`(a + bi)(c + di) = (ac − bd) + (ad + bc)i`, `= (${n.a}·${n.c} − ${n.b}·${n.d}) + (${n.a}·${n.d} + ${n.b}·${n.c})i = ${cText(res)}`]
          : s.op === 'div'
            ? [`(a + bi) ÷ (c + di) = ((ac + bd) + (bc − ad)i) ÷ (c² + d²)`, `= ${cText(res)}`]
            : s.op === 'pow' || s.op === 'sqrt'
              ? [`De Moivre: (r∠θ)^n = rⁿ∠(nθ)`, `|z1| = ${fmt(Math.hypot(n.a, n.b), 6)}, θ = ${dec((Math.atan2(n.b, n.a) * 180) / Math.PI, 4)}°`, `result = ${cText(res)}`]
              : [`${opText} = ${cText(res)}`],
      chart: {
        kind: 'shape',
        paths: [
          { pts: [[-4.4, 0], [4.4, 0]], line: 'grey', width: 1 },
          { pts: [[0, -4.4], [0, 4.4]], line: 'grey', width: 1 },
          { pts: arrow(0, 0, ...P(z1)), line: 'grey', width: 2 },
          ...(two ? [{ pts: arrow(0, 0, ...P(z2)), line: 'dash' as const, width: 2 }] : []),
          { pts: arrow(0, 0, ...P(res)), line: 'solid', width: 3 },
        ],
        labels: [
          { at: P(z1), text: 'z1', dy: -12 },
          ...(two ? [{ at: P(z2), text: 'z2', dy: -12 }] : []),
          { at: P(res), text: cText(res), dy: -14, strong: true },
          { at: [4.4, 0], text: 'Re', dy: 14, anchor: 'end' },
          { at: [0, 4.4], text: 'Im', dx: 10, anchor: 'start' },
        ],
        summary: `On the complex plane the result ${cText(res)} lies at distance ${fmt(mod, 4)} from 0, at ${dec(arg, 1)}°.`,
        height: 260,
      },
    }
  },
}

/* ── vectors ───────────────────────────────────────────────────── */

type V3 = [number, number, number]
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V3) => Math.hypot(...a)
const vText = (v: V3, three: boolean) => `(${v.slice(0, three ? 3 : 2).map((x) => fmt(x, 6)).join(', ')})`

const vectorSpec: Spec = {
  inputs: [
    choice('d', 'Dimensions', '3', [['2', '2D'], ['3', '3D']]),
    num('ax', 'a x', '3', undefined, { half: true }),
    num('ay', 'a y', '1', undefined, { half: true }),
    num('az', 'a z', '2', undefined, { half: true, when: (s) => s.d === '3' }),
    num('bx', 'b x', '1', undefined, { half: true }),
    num('by', 'b y', '4', undefined, { half: true }),
    num('bz', 'b z', '-1', undefined, { half: true, when: (s) => s.d === '3' }),
  ],
  compute: ({ n, s }) => {
    const three = s.d === '3'
    const a: V3 = [n.ax, n.ay, three ? n.az : 0]
    const b: V3 = [n.bx, n.by, three ? n.bz : 0]
    const d = dot(a, b)
    const c = cross(a, b)
    const na = norm(a)
    const nb = norm(b)
    if (na === 0 || nb === 0) fail('Neither vector can be zero.')
    const ang = (Math.acos(Math.max(-1, Math.min(1, d / (na * nb)))) * 180) / Math.PI
    const proj = (d / (nb * nb))
    const iso = (v: V3): [number, number] => (three ? [v[0] - v[1] * 0.5, v[2] + v[1] * 0.5] : [v[0], v[1]])
    const sum: V3 = [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
    return {
      main: { label: 'Angle between a and b', value: ang, format: (v) => `${dec(v, 4)}°` },
      stats: [
        { label: 'Dot product a · b', value: d, format: (v) => fmt(v, 8) },
        { label: three ? 'Cross product a × b' : 'Cross product (z)', value: three ? vText(c, true) : fmt(c[2], 8) },
        { label: '|a|', value: na, format: (v) => fmt(v, 7) },
        { label: '|b|', value: nb, format: (v) => fmt(v, 7) },
        { label: 'a + b', value: vText(sum, three) },
        { label: 'Projection of a on b', value: vText([b[0] * proj, b[1] * proj, b[2] * proj], three) },
      ],
      working: [
        `a · b = ${a.slice(0, three ? 3 : 2).map((x, i) => `${fmt(x, 5)}×${fmt(b[i]!, 5)}`).join(' + ')} = ${fmt(d, 8)}`,
        `|a| = ${fmt(na, 7)}, |b| = ${fmt(nb, 7)}`,
        `cos θ = a · b ÷ (|a||b|) = ${dec(d / (na * nb), 6)}, θ = ${dec(ang, 4)}°`,
        three ? `a × b = (ay·bz − az·by, az·bx − ax·bz, ax·by − ay·bx) = ${vText(c, true)}` : `a × b (z) = ax·by − ay·bx = ${fmt(c[2], 8)}`,
        `area of the parallelogram = |a × b| = ${fmt(norm(c), 7)}`,
      ],
      chart: {
        kind: 'shape',
        paths: [
          { pts: [[0, 0], iso([Math.max(...[a[0], b[0], sum[0], 1].map(Math.abs)) * 1.1, 0, 0])], line: 'grey', width: 1 },
          { pts: [[0, 0], iso([0, three ? 0 : Math.max(...[a[1], b[1], sum[1], 1].map(Math.abs)) * 1.1, three ? Math.max(...[a[2], b[2], sum[2], 1].map(Math.abs)) * 1.1 : 0])], line: 'grey', width: 1 },
          ...(three ? [{ pts: [[0, 0], iso([0, Math.max(...[a[1], b[1], sum[1], 1].map(Math.abs)) * 1.1, 0])] as [number, number][], line: 'grey' as const, width: 1 }] : []),
          { pts: [[0, 0], iso(a), iso(sum), iso(b)], closed: true, fill: 'hatch', line: 'none' },
          { pts: arrow(0, 0, ...iso(a), 0.3), line: 'solid', width: 3 },
          { pts: arrow(0, 0, ...iso(b), 0.3), line: 'dash', width: 3 },
        ],
        labels: [
          { at: iso([Math.max(...[a[0], b[0], sum[0], 1].map(Math.abs)) * 1.1, 0, 0]), text: 'x', dx: 8, anchor: 'start' },
          { at: three ? iso([0, 0, Math.max(...[a[2], b[2], sum[2], 1].map(Math.abs)) * 1.1]) : iso([0, Math.max(...[a[1], b[1], sum[1], 1].map(Math.abs)) * 1.1, 0]), text: three ? 'z' : 'y', dy: -10 },
          ...(three ? [{ at: iso([0, Math.max(...[a[1], b[1], sum[1], 1].map(Math.abs)) * 1.1, 0]), text: 'y', dx: -8, anchor: 'end' as const }] : []),
          { at: iso(a), text: 'a', dy: -12, strong: true },
          { at: iso(b), text: 'b', dy: -12, strong: true },
        ],
        summary: `a and b are ${dec(ang, 1)}° apart. The hatched parallelogram has area |a × b| = ${fmt(norm(c), 4)}.${three ? ' The drawing is an oblique projection of 3D.' : ''}`,
        height: 260,
      },
    }
  },
}

/* ── LCM and GCF ───────────────────────────────────────────────── */

export const gcd = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y) [x, y] = [y, x % y]
  return x
}
export const lcm = (a: bigint, b: bigint): bigint => (a === 0n || b === 0n ? 0n : ((a < 0n ? -a : a) / gcd(a, b)) * (b < 0n ? -b : b))

function readWholes(raw: string | undefined): bigint[] {
  const toks = (raw ?? '').split(/[\s,;]+/).filter(Boolean)
  if (toks.length < 2) fail('Enter at least 2 whole numbers.')
  return toks.map((t) => {
    if (!/^\d+$/.test(t)) fail(`“${t}” is not a positive whole number.`)
    const v = BigInt(t)
    if (v === 0n) fail('Use numbers above zero.')
    if (v > 10n ** 18n) fail('Use numbers up to 10¹⁸.')
    return v
  })
}

const lcmSpec: Spec = {
  inputs: [{ id: 'x', kind: 'text', label: 'Numbers', value: '12 18 30', rows: 2, hint: 'Two or more whole numbers.' }],
  compute: ({ s }) => {
    const xs = readWholes(s.x)
    const l = xs.reduce(lcm)
    const steps: string[] = []
    xs.reduce((acc, v) => {
      const r = lcm(acc, v)
      steps.push(`lcm(${acc}, ${v}) = ${acc} × ${v} ÷ gcd(${acc}, ${v}) = ${acc * v} ÷ ${gcd(acc, v)} = ${r}`)
      return r
    })
    const small = xs.every((v) => v < 10n ** 12n)
    return {
      main: { label: 'Least common multiple', value: groupBig(l) },
      stats: [
        { label: 'Prime factors of the LCM', value: l > 1n && l < 10n ** 18n ? powerForm(factorize(l)) : l.toString() },
        ...(small ? [...new Set(xs)].slice(0, 4).map((v) => ({ label: `Factors of ${v}`, value: v > 1n ? powerForm(factorize(v)) : '1' })) : []),
      ],
      working: [...steps, 'the LCM takes each prime at its highest power in any of the numbers'],
      chart: {
        kind: 'bars',
        items: xs.slice(0, 20).map((v) => ({ label: `${v}`, value: Number(l / v), note: `× ${l / v} = ${l}` })),
        formatValue: (v) => `× ${int(v)}`,
        summary: `${groupBig(l)} is the smallest number that ${xs.length === 2 ? 'both numbers divide' : `all ${xs.length} numbers divide`}. Each bar shows the multiple that reaches it.`,
        table: true,
        columns: ['Number', 'Multiplier to reach the LCM'],
      },
    }
  },
}

const gcfSpec: Spec = {
  inputs: [{ id: 'x', kind: 'text', label: 'Numbers', value: '48 180 132', rows: 2, hint: 'Two or more whole numbers.' }],
  compute: ({ s }) => {
    const xs = readWholes(s.x)
    const g = xs.reduce(gcd)
    const steps: string[] = []
    let x = xs[0]!
    let y = xs[1]!
    while (y) {
      steps.push(`${x} = ${y} × ${x / y} + ${x % y}`)
      ;[x, y] = [y, x % y]
    }
    const small = xs.every((v) => v < 10n ** 12n)
    return {
      main: { label: 'Greatest common factor', value: groupBig(g) },
      stats: [
        { label: 'Prime factors of the GCF', value: g > 1n ? powerForm(factorize(g)) : '1 (coprime)' },
        ...(small ? [...new Set(xs)].slice(0, 4).map((v) => ({ label: `Factors of ${v}`, value: v > 1n ? powerForm(factorize(v)) : '1' })) : []),
      ],
      working: [`Euclid on ${xs[0]} and ${xs[1]}:`, ...steps.slice(0, 12), `gcd(${xs[0]}, ${xs[1]}) = ${gcd(xs[0]!, xs[1]!)}`, ...(xs.length > 2 ? [`then gcd with each further number: ${groupBig(g)}`] : [])],
      chart: {
        kind: 'bars',
        items: xs.slice(0, 20).map((v) => ({ label: `${v}`, value: Number(v / g), note: `= ${g} × ${v / g}` })),
        formatValue: (v) => `${int(v)} × GCF`,
        summary: `${groupBig(g)} is the largest number that divides ${xs.length === 2 ? 'both' : `all ${xs.length}`} numbers. Each bar is a number divided by it.`,
        table: true,
        columns: ['Number', 'Number ÷ GCF'],
      },
    }
  },
}

/* ── golden ratio ──────────────────────────────────────────────── */

const goldenSpec: Spec = {
  inputs: [select('k', 'You know', 'a', [['a', 'The longer part a'], ['b', 'The shorter part b'], ['t', 'The total a + b']]), pos('v', 'Value', '10')],
  compute: ({ n, s }) => {
    const a = s.k === 'a' ? n.v : s.k === 'b' ? n.v * PHI : n.v / PHI
    const b = a / PHI
    const total = a + b
    // golden rectangle a × b with the square and a quarter-circle spiral
    const W = 10
    const k = W / a
    const paths: ShapePath[] = [{ pts: [[0, 0], [a * k, 0], [a * k, b * k], [0, b * k]], closed: true, line: 'solid', width: 2 }]
    let x = 0
    let y = 0
    let w = a * k
    let h = b * k
    const spiral: [number, number][] = []
    for (let i = 0; i < 7; i++) {
      const d = i % 4
      if (d === 0) {
        const sq = h
        spiral.push(...circlePts(x + sq, y, sq, 16, Math.PI, Math.PI / 2))
        paths.push({ pts: [[x + sq, y], [x + sq, y + h]], line: 'grey', width: 1 })
        x += sq
        w -= sq
      } else if (d === 1) {
        const sq = w
        spiral.push(...circlePts(x, y + h - sq, sq, 16, Math.PI / 2, 0).slice(1))
        paths.push({ pts: [[x, y + h - sq], [x + w, y + h - sq]], line: 'grey', width: 1 })
        h -= sq
      } else if (d === 2) {
        const sq = h
        spiral.push(...circlePts(x + w - sq, y + h, sq, 16, 0, -Math.PI / 2).slice(1))
        paths.push({ pts: [[x + w - sq, y], [x + w - sq, y + h]], line: 'grey', width: 1 })
        w -= sq
      } else {
        const sq = w
        spiral.push(...circlePts(x + w, y + sq, sq, 16, -Math.PI / 2, -Math.PI).slice(1))
        paths.push({ pts: [[x, y + sq], [x + w, y + sq]], line: 'grey', width: 1 })
        y += sq
        h -= sq
      }
    }
    paths.push({ pts: spiral, line: 'solid', width: 2 })
    return {
      main: { label: s.k === 'a' ? 'Shorter part b' : s.k === 'b' ? 'Longer part a' : 'Longer part a', value: s.k === 'a' ? b : a, format: (v) => fmt(v, 8) },
      stats: [
        { label: 'Longer part a', value: a, format: (v) => fmt(v, 8) },
        { label: 'Shorter part b', value: b, format: (v) => fmt(v, 8) },
        { label: 'Total a + b', value: total, format: (v) => fmt(v, 8) },
        { label: 'φ', value: PHI, format: (v) => dec(v, 12) },
      ],
      working: [`φ = (1 + √5) ÷ 2 = ${dec(PHI, 12)}`, `a ÷ b = (a + b) ÷ a = φ`, s.k === 'a' ? `b = a ÷ φ = ${fmt(n.v, 8)} ÷ φ = ${fmt(b, 8)}` : s.k === 'b' ? `a = b × φ = ${fmt(n.v, 8)} × φ = ${fmt(a, 8)}` : `a = total ÷ φ = ${fmt(a, 8)}, b = total ÷ φ² = ${fmt(b, 8)}`],
      chart: { kind: 'shape', paths, labels: [{ at: [(a * k) / 2, 0], text: `a = ${fmt(a, 5)}`, dy: 14 }, { at: [a * k, (b * k) / 2], text: `b = ${fmt(b, 5)}`, dx: 8, anchor: 'start' }], summary: `A golden rectangle ${fmt(a, 5)} by ${fmt(b, 5)}. Cutting off a square leaves another golden rectangle, and the quarter circles trace the golden spiral.`, height: 240 },
    }
  },
}

/* ── trigonometry ──────────────────────────────────────────────── */

function unitCircle(theta: number, summary: string, extra: ShapeLabel[] = []) {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  const paths: ShapePath[] = [
    { pts: [[-1.25, 0], [1.25, 0]], line: 'grey', width: 1 },
    { pts: [[0, -1.25], [0, 1.25]], line: 'grey', width: 1 },
    { pts: circlePts(0, 0, 1), closed: true, line: 'grey', width: 1 },
    { pts: [[0, 0], ...circlePts(0, 0, 0.25, 24, 0, ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)), [0, 0]], closed: true, fill: 'hatch', line: 'none' },
    { pts: [[0, 0], [c, s]], line: 'solid', width: 3 },
    { pts: [[c, 0], [c, s]], line: 'dash', width: 2 },
    { pts: [[0, 0], [c, 0]], line: 'solid', width: 2 },
  ]
  return {
    kind: 'shape' as const,
    paths,
    dots: [[c, s]] as [number, number][],
    labels: [{ at: [c, s] as [number, number], text: `(${dec(c, 3)}, ${dec(s, 3)})`, dy: s >= 0 ? -14 : 14, strong: true }, { at: [c / 2, 0] as [number, number], text: 'cos', dy: c >= 0 ? 12 : 12 }, { at: [c, s / 2] as [number, number], text: 'sin', dx: c >= 0 ? 8 : -8, anchor: (c >= 0 ? 'start' : 'end') as 'start' | 'end' }, ...extra],
    summary,
    height: 260,
  }
}

const show = (v: number) => (Math.abs(v) > 1e12 ? 'undefined' : fmt(Math.abs(v) < 1e-14 ? 0 : v, 10))

const trigSpec: Spec = {
  inputs: [choice('u', 'Angle unit', 'deg', [['deg', 'Degrees'], ['rad', 'Radians']]), num('a', 'Angle', '30', undefined, { unit: (s) => (s.u === 'rad' ? 'rad' : '°') })],
  compute: ({ n, s }) => {
    const rad = s.u === 'rad' ? n.a : (n.a * Math.PI) / 180
    const deg = (rad * 180) / Math.PI
    const exactDeg = s.u === 'deg' ? n.a : deg
    const snap = (v: number) => (Math.abs(v) < 1e-15 ? 0 : v)
    const sn = s.u === 'deg' && Number.isInteger(n.a / 90) ? [0, 1, 0, -1][(((n.a / 90) % 4) + 4) % 4]! : snap(Math.sin(rad))
    const cs = s.u === 'deg' && Number.isInteger(n.a / 90) ? [1, 0, -1, 0][(((n.a / 90) % 4) + 4) % 4]! : snap(Math.cos(rad))
    const tn = cs === 0 ? Infinity : sn / cs
    return {
      main: { label: `sin ${s.u === 'rad' ? `${n.a} rad` : `${n.a}°`}`, value: show(sn) },
      stats: [
        { label: 'cos', value: show(cs) },
        { label: 'tan', value: cs === 0 ? 'undefined' : show(tn) },
        { label: 'csc', value: sn === 0 ? 'undefined' : show(1 / sn) },
        { label: 'sec', value: cs === 0 ? 'undefined' : show(1 / cs) },
        { label: 'cot', value: sn === 0 ? 'undefined' : show(cs / sn) },
        { label: s.u === 'rad' ? 'In degrees' : 'In radians', value: s.u === 'rad' ? `${fmt(exactDeg, 10)}°` : `${fmt(rad, 10)} rad` },
      ],
      working: [`θ = ${s.u === 'rad' ? `${n.a} rad = ${fmt(deg, 10)}°` : `${n.a}° = ${n.a} × π ÷ 180 = ${fmt(rad, 10)} rad`}`, `on the unit circle the point is (cos θ, sin θ) = (${show(cs)}, ${show(sn)})`, `tan θ = sin θ ÷ cos θ; csc = 1/sin, sec = 1/cos, cot = 1/tan`],
      chart: unitCircle(rad, `At ${dec(deg, 4)}° the point on the unit circle is (${dec(cs, 4)}, ${dec(sn, 4)}): cos is its x and sin its y.`),
    }
  },
}

const inverseSpec: Spec = {
  inputs: [select('f', 'Function', 'asin', [['asin', 'arcsin'], ['acos', 'arccos'], ['atan', 'arctan'], ['acsc', 'arccsc'], ['asec', 'arcsec'], ['acot', 'arccot']]), num('v', 'Value', '0.5')],
  compute: ({ n, s }) => {
    const f = s.f ?? 'asin'
    const v = n.v
    if ((f === 'asin' || f === 'acos') && Math.abs(v) > 1) fail('arcsin and arccos take values from −1 to 1.')
    if ((f === 'acsc' || f === 'asec') && Math.abs(v) < 1) fail('arccsc and arcsec take values of 1 or more in size.')
    const rad = f === 'asin' ? Math.asin(v) : f === 'acos' ? Math.acos(v) : f === 'atan' ? Math.atan(v) : f === 'acsc' ? Math.asin(1 / v) : f === 'asec' ? Math.acos(1 / v) : v === 0 ? Math.PI / 2 : Math.atan(1 / v) + (v < 0 ? Math.PI : 0)
    const deg = (rad * 180) / Math.PI
    const norm360 = (d: number) => ((d % 360) + 360) % 360
    const other = f === 'asin' || f === 'acsc' ? norm360(180 - deg) : f === 'acos' || f === 'asec' ? norm360(360 - deg) : norm360(deg + 180)
    const both = [...new Set([norm360(deg), other].map((d) => Number(d.toFixed(10))))].sort((a, b) => a - b)
    const range = f === 'asin' || f === 'acsc' ? '−90° to 90°' : f === 'acos' || f === 'asec' || f === 'acot' ? '0° to 180°' : '−90° to 90°'
    return {
      main: { label: `${f.replace('a', 'arc')}(${v})`, value: `${fmt(deg, 10)}°` },
      stats: [
        { label: 'Radians', value: rad, format: (x) => fmt(x, 10) },
        { label: 'In units of π', value: `${fmt(rad / Math.PI, 8)}π` },
        { label: 'All angles 0° to 360°', value: both.map((d) => `${fmt(d, 8)}°`).join(', ') },
      ],
      working: [`principal value range: ${range}`, `θ = ${f.replace('a', 'arc')}(${v}) = ${fmt(rad, 10)} rad = ${fmt(deg, 10)}°`, `general solutions add multiples of 360° to each angle in the list`],
      chart: unitCircle(rad, `${f.replace('a', 'arc')}(${v}) is ${dec(deg, 3)}°, the angle on the unit circle shown in black.`),
    }
  },
}

/* ── exponential growth ────────────────────────────────────────── */

const expSpec: Spec = {
  inputs: [
    num('p0', 'Starting amount', '1000', undefined, { above: 0 }),
    percent2('r', 'Rate per period', '5'),
    choice('dir', 'Direction', 'grow', [['grow', 'Growth'], ['decay', 'Decay']]),
    choice('c', 'Compounding', 'discrete', [['discrete', 'Once a period'], ['cont', 'Continuous']]),
    pos('t', 'Periods', '10', undefined, { max: 10000 }),
  ],
  compute: ({ n, s }) => {
    const r = (s.dir === 'decay' ? -1 : 1) * (n.r / 100)
    if (s.c !== 'cont' && r <= -1) fail('A decay of 100% or more leaves nothing.')
    const at = (t: number) => (s.c === 'cont' ? n.p0 * Math.exp(r * t) : n.p0 * Math.pow(1 + r, t))
    const end = at(n.t)
    const dbl = s.c === 'cont' ? Math.log(2) / Math.abs(r) : Math.log(2) / Math.abs(Math.log(1 + r))
    const xs = Array.from({ length: 41 }, (_, k) => Number(((n.t * k) / 40).toPrecision(6)))
    return {
      main: { label: `Amount after ${n.t} periods`, value: end, format: (v) => fmt(v, 8) },
      stats: [
        { label: 'Change', value: end - n.p0, format: (v) => fmt(v, 7) },
        { label: 'Change in percent', value: (end / n.p0 - 1) * 100, format: (v) => pct(v, 3) },
        { label: s.dir === 'decay' ? 'Half-life' : 'Doubling time', value: dbl, format: (v) => `${fmt(v, 6)} periods` },
      ],
      working: s.c === 'cont' ? [`P(t) = P₀ × e^(rt)`, `P(${n.t}) = ${n.p0} × e^(${dec(r, 6)} × ${n.t}) = ${fmt(end, 8)}`, `${s.dir === 'decay' ? 'half-life' : 'doubling time'} = ln 2 ÷ |r| = ${fmt(dbl, 6)}`] : [`P(t) = P₀ × (1 + r)^t`, `P(${n.t}) = ${n.p0} × ${dec(1 + r, 6)}^${n.t} = ${fmt(end, 8)}`, `${s.dir === 'decay' ? 'half-life' : 'doubling time'} = ln 2 ÷ |ln(1 + r)| = ${fmt(dbl, 6)}`],
      chart: { kind: 'line', x: xs, series: [{ id: 'p', label: 'Amount', values: xs.map(at) }], xLabel: 'Period', formatX: (v) => fmtTick(v), formatValue: (v) => fmt(v, 6), guides: [{ y: n.p0, label: 'Start' }], summary: `${n.p0} ${s.dir === 'decay' ? 'shrinks' : 'grows'} to ${fmt(end, 6)} in ${n.t} periods, ${s.dir === 'decay' ? 'halving' : 'doubling'} every ${fmt(dbl, 4)} periods.`, table: true },
    }
  },
}
function percent2(id: string, label: string, value: string) {
  return { id, label, value, unit: '%', min: 0, max: 1000 }
}

export const specs: Record<string, Spec> = {
  'factorial-calculator': factorialSpec,
  'fibonacci-calculator': fibSpec,
  'modulo-calculator': modSpec,
  'polynomial-root-calculator': polySpec,
  'complex-number-calculator': complexSpec,
  'vector-calculator': vectorSpec,
  'lcm-calculator': lcmSpec,
  'gcf-calculator': gcfSpec,
  'golden-ratio-calculator': goldenSpec,
  'trigonometry-calculator': trigSpec,
  'inverse-trig-calculator': inverseSpec,
  'exponential-growth-calculator': expSpec,
}
