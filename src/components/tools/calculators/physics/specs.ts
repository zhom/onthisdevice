/** Mechanics, waves, optics, gravity and relativity. SI units inside; CODATA 2018 constants. */
import { choice, num, pos, select } from '../engine/fields'
import { dec, fmt, pct } from '../engine/format'
import { fmtTick } from '../engine/plots'
import { fail } from '../engine/types'
import type { Chart, ShapeLabel, ShapePath, Spec } from '../engine/types'

export const C = 299792458
export const H = 6.62607015e-34
export const EV = 1.602176634e-19
export const G = 6.6743e-11
export const G0 = 9.80665

/** "532 nm", "2.4 GHz": a value in an SI unit with a prefix. */
export function si(v: number, unit: string, sig = 5): string {
  if (!Number.isFinite(v)) return '–'
  if (v === 0) return `0 ${unit}`
  const P: [number, string][] = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']]
  const a = Math.abs(v)
  const p = P.find(([f]) => a >= f) ?? P[P.length - 1]!
  if (a >= 1e15 || a < 1e-15) return `${fmt(v, sig)} ${unit}`
  return `${fmt(v / p[0], sig)} ${p[1]}${unit}`
}

/** A line of y against x around the current point, with the point marked. */
function curve(x0: number, x1: number, f: (x: number) => number, at: number, o: { xLabel: string; yFmt: (v: number) => string; xFmt?: (v: number) => string; label: string; summary: string; zero?: boolean; mark?: string }): Chart {
  const xs = Array.from({ length: 41 }, (_, k) => Number((x0 + ((x1 - x0) * k) / 40).toPrecision(8)))
  const idx = xs.reduce((best, x, i) => (Math.abs(x - at) < Math.abs(xs[best]! - at) ? i : best), 0)
  return {
    kind: 'line',
    x: xs,
    series: [{ id: 'y', label: o.label, values: xs.map(f) }],
    xLabel: o.xLabel,
    formatX: o.xFmt ?? ((v) => fmtTick(v)),
    formatValue: o.yFmt,
    markers: [{ x: xs[idx]!, label: o.mark ?? 'You' }],
    defaultIndex: idx,
    zero: o.zero ?? true,
    summary: o.summary,
    table: true,
  }
}

const solveField = (opts: readonly (readonly [string, string])[], value: string) => choice('solve', 'Solve for', value, opts)

/* ── waves ─────────────────────────────────────────────────────── */

const MEDIA = [['light', 'Light in a vacuum, 299,792,458 m/s'], ['air', 'Sound in air at 20 °C, 343 m/s'], ['water', 'Sound in water, 1,481 m/s'], ['custom', 'Enter the speed']] as const
const SPEED: Record<string, number> = { light: C, air: 343, water: 1481 }
const FREQ_U = [['1', 'Hz'], ['1000', 'kHz'], ['1000000', 'MHz'], ['1000000000', 'GHz'], ['1000000000000', 'THz']] as const
const LEN_U = [['1', 'm'], ['0.01', 'cm'], ['0.001', 'mm'], ['0.000001', 'µm'], ['0.000000001', 'nm']] as const

export function emBand(lambda: number): string {
  if (lambda < 1e-11) return 'gamma rays'
  if (lambda < 1e-8) return 'X-rays'
  if (lambda < 3.8e-7) return 'ultraviolet'
  if (lambda < 7.5e-7) return 'visible light'
  if (lambda < 1e-3) return 'infrared'
  if (lambda < 1) return 'microwaves'
  return 'radio waves'
}

function waveShape(lambda: number, text: string, summary: string): Chart {
  const pts: [number, number][] = Array.from({ length: 161 }, (_, k) => {
    const x = (k / 160) * 10
    return [x, Math.sin((x / 4) * 2 * Math.PI)]
  })
  return {
    kind: 'shape',
    paths: [
      { pts: [[0, 0], [10, 0]], line: 'grey', width: 1 },
      { pts, line: 'solid', width: 2.5 },
      { pts: [[1, 1.35], [5, 1.35]], line: 'solid', width: 1.5 },
      { pts: [[1, 1.15], [1, 1.55]], line: 'grey', width: 1 },
      { pts: [[5, 1.15], [5, 1.55]], line: 'grey', width: 1 },
    ],
    labels: [{ at: [3, 1.35], text: `λ = ${text}`, dy: -12, strong: true }],
    summary: lambda > 0 ? summary : summary,
    height: 200,
  }
}

const wavelengthSpec: Spec = {
  inputs: [
    select('m', 'Wave', 'light', MEDIA),
    pos('v', 'Wave speed', '343', 'm/s', { when: (s) => s.m === 'custom' }),
    solveField([['lambda', 'Wavelength'], ['f', 'Frequency']], 'lambda'),
    pos('f', 'Frequency', '540', undefined, { when: (s) => s.solve !== 'f', half: true }),
    select('fu', 'Frequency unit', '1000000000000', FREQ_U, { when: (s) => s.solve !== 'f', half: true }),
    pos('l', 'Wavelength', '500', undefined, { when: (s) => s.solve === 'f', half: true }),
    select('lu', 'Length unit', '0.000000001', LEN_U, { when: (s) => s.solve === 'f', half: true }),
  ],
  compute: ({ n, s }) => {
    const v = s.m === 'custom' ? n.v : SPEED[s.m ?? 'light']!
    const f = s.solve === 'f' ? v / (n.l * Number(s.lu)) : n.f * Number(s.fu)
    const lambda = v / f
    const light = s.m === 'light'
    return {
      main: s.solve === 'f' ? { label: 'Frequency', value: si(f, 'Hz', 6) } : { label: 'Wavelength', value: si(lambda, 'm', 6) },
      stats: [
        { label: 'Period', value: si(1 / f, 's') },
        { label: 'Wave number', value: `${fmt(1 / lambda, 6)} per m` },
        ...(light ? [{ label: 'Band', value: emBand(lambda) }, { label: 'Photon energy', value: `${fmt((H * f) / EV, 6)} eV` }] : []),
      ],
      working: s.solve === 'f' ? [`f = v ÷ λ = ${fmt(v, 9)} m/s ÷ ${fmt(n.l * Number(s.lu), 6)} m = ${si(f, 'Hz', 7)}`] : [`λ = v ÷ f = ${fmt(v, 9)} m/s ÷ ${fmt(f, 6)} Hz = ${si(lambda, 'm', 7)}`, `period T = 1 ÷ f = ${si(1 / f, 's')}`],
      chart: waveShape(lambda, si(lambda, 'm', 4), `One wavelength of ${si(lambda, 'm', 4)} at ${si(f, 'Hz', 4)}${light ? `: ${emBand(lambda)}` : ''}.`),
    }
  },
}

const photonSpec: Spec = {
  inputs: [
    choice('k', 'You know', 'l', [['l', 'Wavelength'], ['f', 'Frequency'], ['e', 'Energy']]),
    pos('l', 'Wavelength', '532', 'nm', { when: (s) => s.k === 'l' }),
    pos('f', 'Frequency', '563.5', 'THz', { when: (s) => s.k === 'f' }),
    pos('e', 'Energy', '2.33', 'eV', { when: (s) => s.k === 'e' }),
  ],
  compute: ({ n, s }) => {
    const E = s.k === 'e' ? n.e * EV : s.k === 'f' ? H * n.f * 1e12 : (H * C) / (n.l * 1e-9)
    const f = E / H
    const lambda = C / f
    const lg = Math.log10(lambda * 1e9)
    return {
      main: { label: 'Photon energy', value: `${fmt(E / EV, 6)} eV` },
      stats: [
        { label: 'In joules', value: `${fmt(E, 6)} J` },
        { label: 'Wavelength', value: si(lambda, 'm', 6) },
        { label: 'Frequency', value: si(f, 'Hz', 6) },
        { label: 'Band', value: emBand(lambda) },
        { label: 'Per mole of photons', value: `${fmt((E * 6.02214076e23) / 1000, 6)} kJ/mol` },
      ],
      working: [`E = hf = hc ÷ λ`, `h = 6.62607015 × 10⁻³⁴ J·s, c = 299,792,458 m/s`, `E = ${fmt(E, 7)} J = ${fmt(E, 7)} ÷ 1.602176634 × 10⁻¹⁹ = ${fmt(E / EV, 7)} eV`, `shortcut: E (eV) ≈ 1239.84 ÷ λ (nm) = ${fmt(1239.84198 / (lambda * 1e9), 7)}`],
      chart: {
        kind: 'gauge',
        variant: 'bar',
        value: Math.max(-3, Math.min(12, lg)),
        min: -3,
        max: 12,
        bands: [{ to: -2, label: 'Gamma' }, { to: 1, label: 'X-ray' }, { to: Math.log10(380), label: 'UV' }, { to: Math.log10(750), label: 'Visible' }, { to: 6, label: 'Infrared' }, { to: 9, label: 'Microwave' }, { to: 12, label: 'Radio' }],
        center: `${si(lambda, 'm', 4)} · ${emBand(lambda)}`,
        formatValue: (v) => `10^${dec(v, 0)} nm`,
        summary: `A photon of ${si(lambda, 'm', 4)} carries ${fmt(E / EV, 4)} eV: ${emBand(lambda)}. The scale is logarithmic in wavelength.`,
      },
    }
  },
}

/* ── circular motion and mechanics ─────────────────────────────── */

const centripetalSpec: Spec = {
  inputs: [pos('m', 'Mass', '1200', 'kg', { half: true }), pos('v', 'Speed', '20', 'm/s', { half: true }), pos('r', 'Radius', '50', 'm')],
  compute: ({ n }) => {
    const a = (n.v * n.v) / n.r
    const F = n.m * a
    const ang = Math.PI / 4
    const P: [number, number] = [3 * Math.cos(ang), 3 * Math.sin(ang)]
    const paths: ShapePath[] = [
      { pts: Array.from({ length: 73 }, (_, k) => [3 * Math.cos((k / 72) * 2 * Math.PI), 3 * Math.sin((k / 72) * 2 * Math.PI)] as [number, number]), line: 'grey', width: 1 },
      { pts: [[0, 0], P], line: 'dash', width: 1 },
      { pts: arrowTo(P, [P[0] - 1.6 * Math.sin(ang), P[1] + 1.6 * Math.cos(ang)]), line: 'solid', width: 2.5 },
      { pts: arrowTo(P, [P[0] * 0.45, P[1] * 0.45]), line: 'solid', width: 3.5 },
    ]
    const labels: ShapeLabel[] = [{ at: [P[0] - 1.6 * Math.sin(ang), P[1] + 1.6 * Math.cos(ang)], text: `v ${fmtTick(n.v)} m/s`, dy: -12 }, { at: [P[0] * 0.45, P[1] * 0.45], text: `F ${si(F, 'N', 3)}`, dy: 14, strong: true }, { at: [1.5 * Math.cos(ang) + 0.3, 1.5 * Math.sin(ang) - 0.3], text: `r ${fmtTick(n.r)} m`, anchor: 'start' }]
    return {
      main: { label: 'Centripetal force', value: si(F, 'N', 6) },
      stats: [
        { label: 'Centripetal acceleration', value: `${fmt(a, 6)} m/s²` },
        { label: 'In g', value: `${fmt(a / G0, 4)} g` },
        { label: 'Angular speed', value: `${fmt(n.v / n.r, 6)} rad/s` },
        { label: 'Time for one lap', value: si((2 * Math.PI * n.r) / n.v, 's', 5) },
      ],
      working: [`a = v² ÷ r = ${n.v}² ÷ ${n.r} = ${fmt(a, 6)} m/s²`, `F = m × a = ${n.m} × ${fmt(a, 6)} = ${fmt(F, 7)} N`, `ω = v ÷ r = ${fmt(n.v / n.r, 6)} rad/s`],
      chart: { kind: 'shape', paths, dots: [P], labels, summary: `Keeping ${n.m} kg on a ${n.r} m circle at ${n.v} m/s takes ${si(F, 'N', 4)} toward the center, ${fmt(a / G0, 3)} g.`, height: 240 },
    }
  },
}
function arrowTo(a: [number, number], b: [number, number]): [number, number][] {
  const t = Math.atan2(b[1] - a[1], b[0] - a[0])
  const h = 0.3
  return [a, b, [b[0] - h * Math.cos(t - 0.45), b[1] - h * Math.sin(t - 0.45)], b, [b[0] - h * Math.cos(t + 0.45), b[1] - h * Math.sin(t + 0.45)]]
}

const momentumSpec: Spec = {
  inputs: [solveField([['p', 'Momentum'], ['m', 'Mass'], ['v', 'Velocity']], 'p'), pos('m', 'Mass', '0.145', 'kg', { when: (s) => s.solve !== 'm', half: true }), num('v', 'Velocity', '40', 'm/s', { when: (s) => s.solve !== 'v', half: true }), num('p', 'Momentum', '5.8', 'kg·m/s', { when: (s) => s.solve !== 'p' })],
  compute: ({ n, s }) => {
    if (s.solve === 'v' && n.m === 0) fail('Mass must not be zero.')
    if (s.solve === 'm' && n.v === 0) fail('Velocity must not be zero to find the mass.')
    const m = s.solve === 'm' ? n.p / n.v : n.m
    const v = s.solve === 'v' ? n.p / n.m : n.v
    const p = m * v
    if (m <= 0) fail('The mass comes out negative: check the signs of momentum and velocity.')
    return {
      main: s.solve === 'm' ? { label: 'Mass', value: `${fmt(m, 7)} kg` } : s.solve === 'v' ? { label: 'Velocity', value: `${fmt(v, 7)} m/s` } : { label: 'Momentum', value: `${fmt(p, 7)} kg·m/s` },
      stats: [
        { label: 'Kinetic energy', value: si(0.5 * m * v * v, 'J', 6) },
        { label: 'Speed in km/h', value: `${fmt(Math.abs(v) * 3.6, 6)} km/h` },
        { label: 'Impulse to stop it', value: `${fmt(Math.abs(p), 6)} N·s` },
      ],
      working: [`p = m × v`, s.solve === 'm' ? `m = p ÷ v = ${n.p} ÷ ${n.v} = ${fmt(m, 7)} kg` : s.solve === 'v' ? `v = p ÷ m = ${n.p} ÷ ${n.m} = ${fmt(v, 7)} m/s` : `p = ${n.m} × ${n.v} = ${fmt(p, 7)} kg·m/s`, `KE = ½mv² = p² ÷ 2m = ${fmt(0.5 * m * v * v, 7)} J`],
      chart: curve(0, Math.max(1, Math.abs(v) * 2), (x) => m * x, Math.abs(v), { xLabel: 'Speed (m/s)', label: 'Momentum', yFmt: (y) => `${fmt(y, 5)} kg·m/s`, summary: `A ${fmt(m, 4)} kg mass at ${fmt(v, 4)} m/s has a momentum of ${fmt(p, 5)} kg·m/s. Momentum grows in step with speed; kinetic energy with its square.` }),
    }
  },
}

const workSpec: Spec = {
  inputs: [num('F', 'Force', '50', 'N', { half: true }), num('d', 'Distance moved', '10', 'm', { half: true }), num('a', 'Angle between force and motion', '30', '°', { min: 0, max: 180 }), num('t', 'Time taken', '', 's', { optional: true, above: 0 })],
  compute: ({ n }) => {
    const W = n.F * n.d * Math.cos((n.a * Math.PI) / 180)
    const clean = Math.abs(W) < 1e-12 * Math.abs(n.F * n.d) ? 0 : W
    return {
      main: { label: 'Work done', value: si(clean, 'J', 6) },
      stats: [
        { label: 'Force along the motion', value: `${fmt(n.F * Math.cos((n.a * Math.PI) / 180), 6)} N` },
        { label: 'Power', value: Number.isFinite(n.t) ? si(clean / n.t, 'W', 6) : 'Add the time' },
        { label: 'In kWh', value: `${fmt(clean / 3.6e6, 6)} kWh` },
      ],
      working: [`W = F × d × cos θ = ${n.F} × ${n.d} × cos ${n.a}° = ${fmt(clean, 7)} J`, ...(Number.isFinite(n.t) ? [`P = W ÷ t = ${fmt(clean / n.t, 6)} W`] : [])],
      note: 'Work is positive when the force has a part along the motion, zero at 90° and negative when it opposes the motion.',
      chart: curve(0, 180, (x) => n.F * n.d * Math.cos((x * Math.PI) / 180), n.a, { xLabel: 'Angle (°)', label: 'Work', yFmt: (y) => `${fmt(y, 5)} J`, summary: `Pulling with ${n.F} N at ${n.a}° over ${n.d} m does ${fmt(clean, 5)} J of work. At 90° the force does no work at all.` }),
    }
  },
}

const forceSpec: Spec = {
  inputs: [solveField([['F', 'Force'], ['m', 'Mass'], ['a', 'Acceleration']], 'F'), pos('m', 'Mass', '1500', 'kg', { when: (s) => s.solve !== 'm', half: true }), num('a', 'Acceleration', '3', 'm/s²', { when: (s) => s.solve !== 'a', half: true }), num('F', 'Force', '4500', 'N', { when: (s) => s.solve !== 'F' })],
  compute: ({ n, s }) => {
    if (s.solve === 'm' && n.a === 0) fail('Acceleration must not be zero to find the mass.')
    const m = s.solve === 'm' ? n.F / n.a : n.m
    const a = s.solve === 'a' ? n.F / n.m : n.a
    const F = m * a
    if (m <= 0) fail('The mass comes out negative: check the signs.')
    return {
      main: s.solve === 'm' ? { label: 'Mass', value: `${fmt(m, 7)} kg` } : s.solve === 'a' ? { label: 'Acceleration', value: `${fmt(a, 7)} m/s²` } : { label: 'Force', value: si(F, 'N', 7) },
      stats: [
        { label: 'Acceleration in g', value: `${fmt(a / G0, 5)} g` },
        { label: 'Weight on Earth', value: si(m * G0, 'N', 6) },
        { label: 'Force in pound-force', value: `${fmt(F / 4.4482216152605, 6)} lbf` },
      ],
      working: [`F = m × a (Newton’s second law)`, s.solve === 'm' ? `m = F ÷ a = ${n.F} ÷ ${n.a} = ${fmt(m, 7)} kg` : s.solve === 'a' ? `a = F ÷ m = ${n.F} ÷ ${n.m} = ${fmt(a, 7)} m/s²` : `F = ${n.m} × ${n.a} = ${fmt(F, 7)} N`],
      chart: curve(0, Math.max(1, Math.abs(a) * 2), (x) => m * x, Math.abs(a), { xLabel: 'Acceleration (m/s²)', label: 'Force', yFmt: (y) => si(y, 'N', 4), summary: `${fmt(m, 5)} kg needs ${si(Math.abs(F), 'N', 4)} to accelerate at ${fmt(Math.abs(a), 4)} m/s². Twice the force gives twice the acceleration.` }),
    }
  },
}

/* ── gravity and orbits ────────────────────────────────────────── */

export const BODIES: Record<string, { name: string; M: number; R: number }> = {
  earth: { name: 'Earth', M: 5.9722e24, R: 6.371e6 },
  moon: { name: 'Moon', M: 7.342e22, R: 1.7374e6 },
  mars: { name: 'Mars', M: 6.4171e23, R: 3.3895e6 },
  venus: { name: 'Venus', M: 4.8675e24, R: 6.0518e6 },
  jupiter: { name: 'Jupiter', M: 1.89813e27, R: 6.9911e7 },
  sun: { name: 'Sun', M: 1.98847e30, R: 6.957e8 },
}
const BODY_OPTS = [...Object.entries(BODIES).map(([k, b]) => [k, b.name] as const), ['custom', 'Enter mass and radius'] as const]

const gravSpec: Spec = {
  inputs: [pos('m1', 'Mass 1', '5.9722e24', 'kg', { half: true }), pos('m2', 'Mass 2', '7.342e22', 'kg', { half: true }), pos('r', 'Distance between centers', '384400000', 'm')],
  compute: ({ n }) => {
    const F = (G * n.m1 * n.m2) / (n.r * n.r)
    return {
      main: { label: 'Gravitational force', value: si(F, 'N', 6) },
      stats: [
        { label: 'Acceleration of mass 1', value: `${fmt(F / n.m1, 6)} m/s²` },
        { label: 'Acceleration of mass 2', value: `${fmt(F / n.m2, 6)} m/s²` },
        { label: 'At twice the distance', value: si(F / 4, 'N', 5) },
      ],
      working: [`F = G m1 m2 ÷ r², G = 6.6743 × 10⁻¹¹ N·m²/kg²`, `F = 6.6743 × 10⁻¹¹ × ${fmt(n.m1, 6)} × ${fmt(n.m2, 6)} ÷ ${fmt(n.r, 6)}² = ${fmt(F, 6)} N`],
      note: 'The default values are the Earth and the Moon at their mean distance.',
      chart: curve(n.r * 0.5, n.r * 3, (x) => (G * n.m1 * n.m2) / (x * x), n.r, { xLabel: 'Distance (m)', label: 'Force', yFmt: (y) => si(y, 'N', 4), summary: `The pull is ${si(F, 'N', 4)}. It falls with the square of the distance: twice as far, a quarter of the force.` }),
    }
  },
}

const escapeSpec: Spec = {
  inputs: [select('b', 'Body', 'earth', BODY_OPTS), pos('M', 'Mass', '5.9722e24', 'kg', { when: (s) => s.b === 'custom', half: true }), pos('R', 'Radius', '6371000', 'm', { when: (s) => s.b === 'custom', half: true }), num('alt', 'Height above the surface', '0', 'km', { min: 0 })],
  compute: ({ n, s }) => {
    const body = s.b === 'custom' ? { name: 'the body', M: n.M, R: n.R } : BODIES[s.b ?? 'earth']!
    const r = body.R + n.alt * 1000
    const ve = Math.sqrt((2 * G * body.M) / r)
    const vo = Math.sqrt((G * body.M) / r)
    return {
      main: { label: 'Escape velocity', value: `${fmt(ve / 1000, 6)} km/s` },
      stats: [
        { label: 'In m/s', value: `${fmt(ve, 7)} m/s` },
        { label: 'In mph', value: `${fmt(ve * 2.2369362921, 6)} mph` },
        { label: 'Circular orbit speed', value: `${fmt(vo / 1000, 6)} km/s` },
        { label: 'Surface gravity', value: `${fmt((G * body.M) / (r * r), 5)} m/s²` },
      ],
      working: [`v = √(2GM ÷ r)`, `r = ${fmt(body.R, 7)} m + ${n.alt} km = ${fmt(r, 7)} m`, `v = √(2 × 6.6743 × 10⁻¹¹ × ${fmt(body.M, 6)} ÷ ${fmt(r, 7)}) = ${fmt(ve, 7)} m/s`, `orbit speed = v ÷ √2 = ${fmt(vo, 7)} m/s`],
      chart: { kind: 'bars', items: Object.entries(BODIES).map(([k, b]) => ({ label: b.name, value: Math.sqrt((2 * G * b.M) / b.R) / 1000, highlight: k === s.b })), formatValue: (v) => `${fmt(v, 4)} km/s`, summary: `From ${body.name}${n.alt ? ` at ${n.alt} km up` : ''}, an object needs ${fmt(ve / 1000, 4)} km/s to escape without further thrust.`, table: true, columns: ['Body', 'Escape velocity at the surface'] },
    }
  },
}

const orbitSpec: Spec = {
  inputs: [select('b', 'Orbiting', 'earth', BODY_OPTS), pos('M', 'Central mass', '5.9722e24', 'kg', { when: (s) => s.b === 'custom', half: true }), pos('R', 'Radius', '6371000', 'm', { when: (s) => s.b === 'custom', half: true }), choice('k', 'Distance given as', 'alt', [['alt', 'Height above surface'], ['a', 'Semi-major axis']]), pos('d', (s) => (s.k === 'a' ? 'Semi-major axis' : 'Height'), '400', 'km')],
  compute: ({ n, s }) => {
    const body = s.b === 'custom' ? { name: 'the body', M: n.M, R: n.R } : BODIES[s.b ?? 'earth']!
    const a = s.k === 'a' ? n.d * 1000 : body.R + n.d * 1000
    if (a <= body.R) fail('That orbit is inside the body.')
    const T = 2 * Math.PI * Math.sqrt((a * a * a) / (G * body.M))
    const fmtT = (t: number) => (t < 7200 ? `${fmt(t / 60, 5)} min` : t < 172800 ? `${fmt(t / 3600, 5)} h` : t < 2 * 31557600 ? `${fmt(t / 86400, 5)} days` : `${fmt(t / 31557600, 5)} years`)
    const alt0 = s.k === 'a' ? body.R : body.R
    return {
      main: { label: 'Orbital period', value: fmtT(T) },
      stats: [
        { label: 'In seconds', value: `${fmt(T, 7)} s` },
        { label: 'Orbit speed', value: `${fmt(Math.sqrt((G * body.M) / a) / 1000, 6)} km/s` },
        { label: 'Orbits a day', value: fmt(86400 / T, 5) },
        { label: 'Semi-major axis', value: si(a, 'm', 6) },
      ],
      working: [`T = 2π √(a³ ÷ GM) (Kepler’s third law)`, `a = ${fmt(a, 7)} m, M = ${fmt(body.M, 6)} kg`, `T = 2π √(${fmt(a, 6)}³ ÷ (6.6743 × 10⁻¹¹ × ${fmt(body.M, 6)})) = ${fmt(T, 7)} s`],
      chart: curve(alt0 * 1.01, Math.max(a * 2, alt0 * 1.5), (x) => (2 * Math.PI * Math.sqrt((x * x * x) / (G * body.M))) / 3600, a, { xLabel: 'Orbit radius (m)', label: 'Period (h)', yFmt: (y) => `${fmt(y, 5)} h`, summary: `An orbit with a semi-major axis of ${si(a, 'm', 4)} around ${body.name} takes ${fmtT(T)}. The period grows with the radius to the power 1.5.` }),
    }
  },
}

/* ── sound ─────────────────────────────────────────────────────── */

export const soundSpeed = (tempC: number) => 331.3 * Math.sqrt(1 + tempC / 273.15)

const soundSpec: Spec = {
  inputs: [choice('u', 'Temperature in', 'c', [['c', '°C'], ['f', '°F']]), num('t', 'Air temperature', '20', undefined, { unit: (s) => (s.u === 'f' ? '°F' : '°C'), min: -273.15 }), num('v', 'Speed to compare (optional)', '', 'm/s', { optional: true, min: 0 })],
  compute: ({ n, s }) => {
    const tc = s.u === 'f' ? ((n.t - 32) * 5) / 9 : n.t
    if (tc <= -273.15) fail('That is at or below absolute zero.')
    const c = soundSpeed(tc)
    return {
      main: { label: 'Speed of sound in air', value: `${fmt(c, 6)} m/s` },
      stats: [
        { label: 'In km/h', value: `${fmt(c * 3.6, 6)} km/h` },
        { label: 'In mph', value: `${fmt(c * 2.2369362921, 6)} mph` },
        { label: 'In ft/s', value: `${fmt(c / 0.3048, 6)} ft/s` },
        { label: 'Mach number', value: Number.isFinite(n.v) ? fmt(n.v / c, 4) : 'Add a speed' },
        { label: 'Thunder: seconds per km', value: fmt(1000 / c, 4) },
      ],
      working: [`c = 331.3 × √(1 + T ÷ 273.15) for dry air`, `c = 331.3 × √(1 + ${fmt(tc, 6)} ÷ 273.15) = ${fmt(c, 7)} m/s`, ...(Number.isFinite(n.v) ? [`Mach = ${n.v} ÷ ${fmt(c, 6)} = ${fmt(n.v / c, 5)}`] : [])],
      note: 'Humidity raises the speed a little, by up to about 0.5%. Pressure on its own has almost no effect.',
      chart: curve(-40, 50, (x) => soundSpeed(x), tc, { xLabel: 'Temperature (°C)', label: 'Speed of sound', yFmt: (y) => `${fmt(y, 5)} m/s`, zero: false, summary: `At ${fmt(tc, 4)} °C sound travels at ${fmt(c, 5)} m/s, about 0.6 m/s faster for each degree warmer.` }),
    }
  },
}

const decibelSpec: Spec = {
  inputs: [
    select('m', 'Calculate', 'sum', [['sum', 'Total of several sound levels'], ['ratio', 'Decibels from a ratio'], ['db', 'Ratio from decibels'], ['dist', 'Level at another distance']]),
    { id: 'l', kind: 'text', label: 'Sound levels in dB', value: '70 70 65', rows: 2, when: (s) => s.m === 'sum' },
    choice('q', 'Quantity', 'power', [['power', 'Power or intensity'], ['field', 'Voltage, pressure or amplitude']], { when: (s) => s.m === 'ratio' || s.m === 'db' }),
    pos('r', 'Ratio', '2', undefined, { when: (s) => s.m === 'ratio' }),
    num('d', 'Decibels', '3', 'dB', { when: (s) => s.m === 'db' }),
    num('l1', 'Level at the first distance', '90', 'dB', { when: (s) => s.m === 'dist', half: true }),
    pos('r1', 'First distance', '1', 'm', { when: (s) => s.m === 'dist', half: true }),
    pos('r2', 'Second distance', '10', 'm', { when: (s) => s.m === 'dist' }),
  ],
  compute: ({ n, s }) => {
    if (s.m === 'sum') {
      const levels = (s.l ?? '').split(/[\s,;]+/).filter(Boolean).map(Number)
      if (!levels.length || levels.some((v) => !Number.isFinite(v))) fail('Enter the levels as numbers separated by spaces.')
      const total = 10 * Math.log10(levels.reduce((a, L) => a + Math.pow(10, L / 10), 0))
      return {
        main: { label: 'Combined level', value: `${fmt(total, 5)} dB` },
        stats: [{ label: 'Loudest single source', value: `${fmt(Math.max(...levels), 5)} dB` }, { label: 'Added by the others', value: `${fmt(total - Math.max(...levels), 4)} dB` }],
        working: [`L = 10 log₁₀(Σ 10^(Lᵢ ÷ 10))`, `= 10 log₁₀(${levels.map((L) => `10^${fmt(L / 10, 4)}`).join(' + ')}) = ${fmt(total, 6)} dB`],
        note: 'Two equal sources add 3 dB, not double the decibels.',
        chart: { kind: 'bars', items: [...levels.map((L, i) => ({ label: `Source ${i + 1}`, value: L })), { label: 'Total', value: total, highlight: true }], formatValue: (v) => `${fmt(v, 4)} dB`, summary: `Together the sources make ${fmt(total, 4)} dB.`, table: true, columns: ['Source', 'Level'] },
      }
    }
    if (s.m === 'dist') {
      const L2 = n.l1 - 20 * Math.log10(n.r2 / n.r1)
      return {
        main: { label: `Level at ${n.r2} m`, value: `${fmt(L2, 5)} dB` },
        stats: [{ label: 'Change', value: `${fmt(L2 - n.l1, 4)} dB` }, { label: 'Per doubling of distance', value: '−6.02 dB' }],
        working: [`L2 = L1 − 20 log₁₀(r2 ÷ r1) = ${n.l1} − 20 log₁₀(${n.r2} ÷ ${n.r1}) = ${fmt(L2, 6)} dB`],
        note: 'This is the inverse square law for a point source in open air, without reflections or absorption.',
        chart: curve(n.r1, Math.max(n.r2, n.r1) * 1.5, (x) => n.l1 - 20 * Math.log10(x / n.r1), n.r2, { xLabel: 'Distance (m)', label: 'Level', yFmt: (y) => `${fmt(y, 4)} dB`, zero: false, summary: `${n.l1} dB at ${n.r1} m falls to ${fmt(L2, 4)} dB at ${n.r2} m.` }),
      }
    }
    const k = s.q === 'field' ? 20 : 10
    if (s.m === 'db') {
      const r = Math.pow(10, n.d / k)
      return {
        main: { label: `${s.q === 'field' ? 'Amplitude' : 'Power'} ratio`, value: fmt(r, 7) },
        stats: [{ label: s.q === 'field' ? 'Power ratio' : 'Amplitude ratio', value: fmt(s.q === 'field' ? r * r : Math.sqrt(r), 7) }],
        working: [`ratio = 10^(dB ÷ ${k}) = 10^(${n.d} ÷ ${k}) = ${fmt(r, 7)}`],
        chart: curve(Math.min(-20, n.d - 10), Math.max(20, n.d + 10), (x) => Math.pow(10, x / k), n.d, { xLabel: 'Decibels', label: 'Ratio', yFmt: (y) => fmt(y, 4), summary: `${n.d} dB is a ${s.q === 'field' ? 'amplitude' : 'power'} ratio of ${fmt(r, 5)}.` }),
      }
    }
    const db = k * Math.log10(n.r)
    return {
      main: { label: 'Decibels', value: `${fmt(db, 6)} dB` },
      stats: [{ label: 'As the other kind of ratio', value: `${fmt((s.q === 'field' ? 10 : 20) * Math.log10(n.r), 6)} dB` }],
      working: [`dB = ${k} log₁₀(ratio) = ${k} log₁₀(${n.r}) = ${fmt(db, 7)} dB`],
      note: 'Power ratios use 10 log₁₀; field quantities such as voltage and sound pressure use 20 log₁₀, because power goes with their square.',
      chart: curve(Math.max(0.01, n.r / 10), n.r * 10, (x) => k * Math.log10(x), n.r, { xLabel: 'Ratio', label: 'Decibels', yFmt: (y) => `${fmt(y, 4)} dB`, zero: false, summary: `A ${s.q === 'field' ? 'field' : 'power'} ratio of ${n.r} is ${fmt(db, 4)} dB.` }),
    }
  },
}

export function doppler(f: number, c: number, vs: number, vo: number) {
  return (f * (c + vo)) / (c - vs)
}

const dopplerSpec: Spec = {
  inputs: [pos('f', 'Source frequency', '440', 'Hz', { half: true }), pos('c', 'Speed of sound', '343', 'm/s', { half: true }), num('vs', 'Source speed toward the listener', '30', 'm/s', { half: true, hint: 'Negative if moving away.' }), num('vo', 'Listener speed toward the source', '0', 'm/s', { half: true, hint: 'Negative if moving away.' })],
  compute: ({ n }) => {
    if (n.vs >= n.c) fail('The source moves at or above the speed of sound: a shock wave forms instead.')
    const f2 = doppler(n.f, n.c, n.vs, n.vo)
    const away = doppler(n.f, n.c, -n.vs, -n.vo)
    const lim = Math.min(n.c * 0.6, Math.max(40, Math.abs(n.vs) * 2))
    return {
      main: { label: 'Frequency heard', value: `${fmt(f2, 6)} Hz` },
      stats: [
        { label: 'Shift', value: `${fmt(f2 - n.f, 5)} Hz` },
        { label: 'As it passes and moves away', value: `${fmt(away, 6)} Hz` },
        { label: 'Musical interval', value: `${fmt(12 * Math.log2(f2 / n.f), 3)} semitones` },
      ],
      working: [`f′ = f × (c + v_listener) ÷ (c − v_source)`, `f′ = ${n.f} × (${n.c} + ${n.vo}) ÷ (${n.c} − ${n.vs}) = ${fmt(f2, 7)} Hz`],
      chart: curve(-lim, lim, (x) => doppler(n.f, n.c, x, n.vo), n.vs, { xLabel: 'Source speed toward you (m/s)', label: 'Heard frequency', yFmt: (y) => `${fmt(y, 5)} Hz`, zero: false, summary: `A ${n.f} Hz source approaching at ${n.vs} m/s sounds like ${fmt(f2, 5)} Hz, and ${fmt(away, 5)} Hz once it moves away.` }),
    }
  },
}

/* ── optics ────────────────────────────────────────────────────── */

export function thinLens(f: number, dObj: number) {
  const di = 1 / (1 / f - 1 / dObj)
  return { di, m: -di / dObj }
}

const lensSpec: Spec = {
  inputs: [num('f', 'Focal length', '10', 'cm', { hint: 'Positive for a converging lens, negative for diverging.' }), pos('o', 'Object distance', '25', 'cm', { half: true }), pos('h', 'Object height', '2', 'cm', { half: true })],
  compute: ({ n }) => {
    if (n.f === 0) fail('The focal length cannot be zero.')
    if (Math.abs(n.o - n.f) < 1e-12) fail('An object at the focal point makes parallel rays: the image is at infinity.')
    const x = thinLens(n.f, n.o)
    const hi = x.m * n.h
    const real = x.di > 0
    const span = Math.min(Math.max(n.o, Math.abs(x.di), Math.abs(n.f)) * 1.2, n.o * 6)
    const di = Math.max(-span, Math.min(span, x.di))
    const H = Math.max(n.h, Math.abs(hi)) * 1.4
    // Heights are drawn taller than lengths so the rays stay readable.
    const ky = (span + n.o * 1.15) / 3.2 / H
    const Y = (y: number) => y * ky
    const paths0: ShapePath[] = [
      { pts: [[-n.o * 1.15, 0], [span, 0]], line: 'grey', width: 1 },
      { pts: [[0, -H], [0, H]], line: 'solid', width: 2 },
      { pts: [[-n.o, 0], [-n.o, n.h]], line: 'solid', width: 3 },
      { pts: [[-n.o, n.h], [0, n.h], [span, n.h - (n.h / n.f) * span]], line: 'solid', width: 1 },
      { pts: [[-n.o, n.h], [span, n.h - (n.h / n.o) * (span + n.o)]], line: 'solid', width: 1 },
      { pts: [[di, 0], [di, hi]], line: real ? 'solid' : 'dash', width: 3 },
    ]
    if (!real) paths0.push({ pts: [[0, n.h], [di, hi]], line: 'dash', width: 1 }, { pts: [[-n.o, n.h], [di, hi]], line: 'dash', width: 1 })
    const paths = paths0.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [x, Y(y)] as [number, number]) }))
    return {
      main: { label: 'Image distance', value: `${fmt(x.di, 6)} cm`, sub: `${real ? 'real' : 'virtual'}, ${x.m < 0 ? 'inverted' : 'upright'}, ${Math.abs(x.m) > 1 ? 'enlarged' : Math.abs(x.m) < 1 ? 'reduced' : 'same size'}` },
      stats: [
        { label: 'Magnification', value: `${fmt(x.m, 5)}×` },
        { label: 'Image height', value: `${fmt(hi, 5)} cm` },
        { label: 'Lens power', value: `${fmt(100 / n.f, 5)} diopters` },
      ],
      working: [`1/f = 1/dₒ + 1/dᵢ`, `dᵢ = 1 ÷ (1/${n.f} − 1/${n.o}) = ${fmt(x.di, 7)} cm`, `m = −dᵢ ÷ dₒ = ${fmt(x.m, 6)}`, `image height = m × ${n.h} = ${fmt(hi, 6)} cm`],
      note: 'Distances follow the real-is-positive rule: a negative image distance is a virtual image on the object’s side.',
      chart: {
        kind: 'shape',
        paths,
        dots: [[n.f, 0], [-n.f, 0]],
        labels: [{ at: [-n.o, Y(n.h)], text: 'object', dy: -12 }, { at: [di, Y(hi)], text: 'image', dy: hi >= 0 ? -12 : 14, strong: true }, { at: [n.f, 0], text: 'F', dy: 14 }],
        summary: `An object ${n.o} cm from a ${n.f} cm lens forms a ${real ? 'real' : 'virtual'} image ${fmt(Math.abs(x.di), 4)} cm ${real ? 'behind' : 'in front of'} the lens, ${fmt(Math.abs(x.m), 3)} times the size.`,
        height: 240,
      },
    }
  },
}

const INDEX = [['1.000293', 'Air (1.000293)'], ['1.333', 'Water (1.333)'], ['1.36', 'Ethanol (1.36)'], ['1.47', 'Olive oil (1.47)'], ['1.5', 'Window glass (1.5)'], ['1.49', 'Acrylic (1.49)'], ['1.77', 'Sapphire (1.77)'], ['2.417', 'Diamond (2.417)']] as const

const snellSpec: Spec = {
  inputs: [select('n1', 'First medium', '1.000293', INDEX, { half: true }), select('n2', 'Second medium', '1.5', INDEX, { half: true }), num('a', 'Angle of incidence', '35', '°', { min: 0, max: 89.999 })],
  compute: ({ n, s }) => {
    const n1 = Number(s.n1)
    const n2 = Number(s.n2)
    const t1 = (n.a * Math.PI) / 180
    const sin2 = (n1 / n2) * Math.sin(t1)
    const tir = sin2 > 1
    const t2 = tir ? NaN : Math.asin(sin2)
    const crit = n1 > n2 ? (Math.asin(n2 / n1) * 180) / Math.PI : null
    const L = 3
    const inc: [number, number] = [-L * Math.sin(t1), L * Math.cos(t1)]
    const out: [number, number] = tir ? [L * Math.sin(t1), L * Math.cos(t1)] : [L * Math.sin(t2), -L * Math.cos(t2)]
    const r1 = ((n1 - n2) / (n1 + n2)) ** 2
    return {
      main: tir ? { label: 'Total internal reflection', value: 'No refracted ray', sub: `the angle is above the critical angle of ${fmt(crit ?? 0, 5)}°` } : { label: 'Angle of refraction', value: `${fmt((t2 * 180) / Math.PI, 6)}°` },
      stats: [
        { label: 'Critical angle', value: crit === null ? 'None (light enters a denser medium)' : `${fmt(crit, 6)}°` },
        { label: 'Speed in medium 2', value: `${fmt(C / n2 / 1000, 6)} km/s` },
        { label: 'Reflected at normal incidence', value: pct(r1 * 100, 2) },
      ],
      working: [`n1 sin θ1 = n2 sin θ2`, `sin θ2 = ${n1} × sin ${n.a}° ÷ ${n2} = ${fmt(sin2, 6)}`, tir ? 'sin θ2 > 1, so all the light reflects' : `θ2 = arcsin(${fmt(sin2, 6)}) = ${fmt((t2 * 180) / Math.PI, 6)}°`, ...(crit !== null ? [`critical angle = arcsin(n2 ÷ n1) = ${fmt(crit, 6)}°`] : [])],
      chart: {
        kind: 'shape',
        paths: [
          { pts: [[-3.5, -3.2], [3.5, -3.2], [3.5, 0], [-3.5, 0]], closed: true, fill: 'hatch', line: 'none' },
          { pts: [[-3.5, 0], [3.5, 0]], line: 'solid', width: 2 },
          { pts: [[0, -3.2], [0, 3.2]], line: 'dash', width: 1 },
          { pts: arrowTo(inc, [0, 0]), line: 'solid', width: 3 },
          { pts: arrowTo([0, 0], out), line: tir ? 'dash' : 'solid', width: 3 },
        ],
        labels: [{ at: [-3.4, 0.4], text: `n1 = ${n1}`, anchor: 'start' }, { at: [-3.4, -0.4], text: `n2 = ${n2}`, anchor: 'start' }, { at: inc, text: `${n.a}°`, dy: -12 }, { at: out, text: tir ? 'reflected' : `${fmt((t2 * 180) / Math.PI, 4)}°`, dy: tir ? -12 : 14, strong: true }],
        summary: tir ? `At ${n.a}° the light cannot leave the denser medium and reflects back.` : `Light at ${n.a}° bends to ${fmt((t2 * 180) / Math.PI, 4)}° ${n2 > n1 ? 'toward' : 'away from'} the normal.`,
        height: 240,
      },
    }
  },
}

/* ── relativity ────────────────────────────────────────────────── */

export const gamma = (beta: number) => 1 / Math.sqrt(1 - beta * beta)

const dilationSpec: Spec = {
  inputs: [choice('u', 'Speed as', 'frac', [['frac', 'Fraction of c'], ['kms', 'km/s']]), pos('v', 'Speed', '0.8', undefined, { unit: (s) => (s.u === 'kms' ? 'km/s' : 'c') }), pos('t', 'Time on the moving clock', '1', 'years')],
  compute: ({ n, s }) => {
    const beta = s.u === 'kms' ? (n.v * 1000) / C : n.v
    if (beta >= 1) fail('Nothing with mass reaches the speed of light.')
    const g = gamma(beta)
    return {
      main: { label: 'Time for the stationary observer', value: `${fmt(n.t * g, 7)} years` },
      stats: [
        { label: 'Lorentz factor γ', value: fmt(g, 8) },
        { label: 'Length contraction', value: `${fmt(1 / g, 7)} of rest length` },
        { label: 'Speed', value: `${fmt(beta, 6)} c` },
      ],
      working: [`γ = 1 ÷ √(1 − v²/c²) = 1 ÷ √(1 − ${fmt(beta, 6)}²) = ${fmt(g, 8)}`, `Δt = γ × Δt₀ = ${fmt(g, 8)} × ${n.t} = ${fmt(n.t * g, 8)} years`],
      note: 'Special relativity only; gravity adds its own time dilation, as GPS satellites must correct for.',
      chart: curve(0, 0.99, (x) => gamma(x), Math.min(0.99, beta), { xLabel: 'Speed (fraction of c)', label: 'γ', yFmt: (y) => fmt(y, 5), summary: `At ${fmt(beta, 4)}c a clock runs ${fmt(g, 4)} times slow. γ stays near 1 until about half the speed of light, then climbs steeply.` }),
    }
  },
}

const REFS: [string, number][] = [
  ['1 ton of TNT', 4.184e9],
  ['A year of a US home’s electricity', 10500 * 3.6e6],
  ['Hiroshima bomb, about 15 kt', 15 * 4.184e12],
  ['World electricity in a year, about 30,000 TWh', 30000e12 * 3600],
]

const massEnergySpec: Spec = {
  inputs: [pos('m', 'Mass', '1', undefined, { unit: (s) => s.u ?? 'g', half: true }), select('u', 'Unit', 'g', [['kg', 'kg'], ['g', 'g'], ['mg', 'mg'], ['u', 'atomic mass units']], { half: true })],
  compute: ({ n, s }) => {
    const kg = n.m * ({ kg: 1, g: 1e-3, mg: 1e-6, u: 1.66053906660e-27 }[s.u ?? 'g'] ?? 1e-3)
    const E = kg * C * C
    return {
      main: { label: 'Energy', value: si(E, 'J', 6) },
      stats: [
        { label: 'In kWh', value: `${fmt(E / 3.6e6, 6)} kWh` },
        { label: 'In tons of TNT', value: `${fmt(E / 4.184e9, 6)} t` },
        { label: 'In MeV', value: `${fmt(E / EV / 1e6, 7)} MeV` },
      ],
      working: [`E = mc²`, `E = ${fmt(kg, 7)} kg × (299,792,458 m/s)² = ${fmt(E, 7)} J`],
      note: 'This is the energy if all the mass were converted, as in matter-antimatter annihilation. Fission releases about 0.1% of the mass.',
      chart: { kind: 'bars', items: [...REFS.map(([l, e]) => ({ label: l, value: Math.log10(e) })), { label: 'Your mass', value: Math.log10(E), highlight: true }].sort((a, b) => a.value - b.value), formatValue: (v) => `10^${dec(v, 1)} J`, max: Math.max(Math.log10(E), 21) * 1.02, summary: `${fmt(n.m, 4)} ${s.u} of mass holds ${si(E, 'J', 3)}. Bars are on a logarithmic scale.`, table: true, columns: ['Energy', 'log₁₀ joules'] },
    }
  },
}

/* ── kinematics ────────────────────────────────────────────────── */

const accelSpec: Spec = {
  inputs: [num('v0', 'Starting speed', '0', 'm/s', { half: true }), num('v', 'Final speed', '27.8', 'm/s', { half: true }), pos('t', 'Time', '8', 's')],
  compute: ({ n }) => {
    const a = (n.v - n.v0) / n.t
    const d = ((n.v0 + n.v) / 2) * n.t
    const xs = Array.from({ length: 21 }, (_, k) => Number(((n.t * k) / 20).toPrecision(8)))
    return {
      main: { label: 'Acceleration', value: `${fmt(a, 6)} m/s²` },
      stats: [
        { label: 'In g', value: `${fmt(a / G0, 4)} g` },
        { label: 'Distance covered', value: `${fmt(d, 6)} m` },
        { label: 'Speed change', value: `${fmt((n.v - n.v0) * 3.6, 5)} km/h` },
      ],
      working: [`a = (v − v₀) ÷ t = (${n.v} − ${n.v0}) ÷ ${n.t} = ${fmt(a, 7)} m/s²`, `distance = (v₀ + v) ÷ 2 × t = ${fmt(d, 7)} m`],
      chart: { kind: 'line', x: xs, series: [{ id: 'v', label: 'Speed', values: xs.map((t) => n.v0 + a * t) }], xLabel: 'Time (s)', formatX: (v) => fmtTick(v), formatValue: (v) => `${fmt(v, 5)} m/s`, summary: `Going from ${n.v0} to ${n.v} m/s in ${n.t} s is an acceleration of ${fmt(a, 4)} m/s², ${fmt(a / G0, 3)} g.`, table: true },
    }
  },
}

const D_U: Record<string, number> = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048 }
const T_U: Record<string, number> = { s: 1, min: 60, h: 3600 }

const sdtSpec: Spec = {
  inputs: [
    solveField([['s', 'Speed'], ['d', 'Distance'], ['t', 'Time']], 's'),
    pos('d', 'Distance', '120', undefined, { when: (s) => s.solve !== 'd', half: true, unit: (s) => s.du ?? 'km' }),
    select('du', 'Distance unit', 'km', [['km', 'km'], ['mi', 'mi'], ['m', 'm'], ['ft', 'ft']], { half: true }),
    pos('t', 'Time', '1.5', undefined, { when: (s) => s.solve !== 't', half: true, unit: (s) => s.tu ?? 'h' }),
    select('tu', 'Time unit', 'h', [['h', 'hours'], ['min', 'minutes'], ['s', 'seconds']], { half: true }),
    pos('v', 'Speed', '80', undefined, { when: (s) => s.solve !== 's', unit: (s) => `${s.du ?? 'km'}/${s.tu ?? 'h'}` }),
  ],
  compute: ({ n, s }) => {
    const du = s.du ?? 'km'
    const tu = s.tu ?? 'h'
    const d = s.solve === 'd' ? n.v * n.t : n.d
    const t = s.solve === 't' ? n.d / n.v : n.t
    const v = s.solve === 's' ? n.d / n.t : n.v
    const mps = (v * D_U[du]!) / T_U[tu]!
    const xs = Array.from({ length: 21 }, (_, k) => Number(((t * k) / 20).toPrecision(8)))
    const hms = (sec: number) => `${Math.floor(sec / 3600)} h ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')} min ${String(Math.round(sec % 60)).padStart(2, '0')} s`
    return {
      main: s.solve === 'd' ? { label: 'Distance', value: `${fmt(d, 7)} ${du}` } : s.solve === 't' ? { label: 'Time', value: `${fmt(t, 7)} ${tu}`, sub: hms(t * T_U[tu]!) } : { label: 'Speed', value: `${fmt(v, 7)} ${du}/${tu}` },
      stats: [
        { label: 'In km/h', value: `${fmt(mps * 3.6, 6)} km/h` },
        { label: 'In mph', value: `${fmt(mps * 2.2369362921, 6)} mph` },
        { label: 'In m/s', value: `${fmt(mps, 6)} m/s` },
        { label: 'Pace per km', value: mps > 0 ? `${fmt(1000 / mps / 60, 4)} min` : '–' },
      ],
      working: [`speed = distance ÷ time`, s.solve === 'd' ? `d = ${n.v} × ${n.t} = ${fmt(d, 7)} ${du}` : s.solve === 't' ? `t = ${n.d} ÷ ${n.v} = ${fmt(t, 7)} ${tu}` : `v = ${n.d} ÷ ${n.t} = ${fmt(v, 7)} ${du}/${tu}`],
      chart: { kind: 'line', x: xs, series: [{ id: 'd', label: 'Distance', values: xs.map((x) => v * x) }], xLabel: `Time (${tu})`, formatX: (x) => fmtTick(x), formatValue: (y) => `${fmt(y, 5)} ${du}`, summary: `At ${fmt(v, 4)} ${du}/${tu}, ${fmt(d, 4)} ${du} takes ${fmt(t, 4)} ${tu}.`, table: true },
    }
  },
}

const GRAV = [['9.80665', 'Earth, 9.81 m/s²'], ['1.625', 'Moon, 1.62 m/s²'], ['3.721', 'Mars, 3.72 m/s²'], ['24.79', 'Jupiter, 24.8 m/s²']] as const

const peSpec: Spec = {
  inputs: [pos('m', 'Mass', '10', 'kg', { half: true }), num('h', 'Height', '5', 'm', { half: true }), select('g', 'Gravity', '9.80665', GRAV)],
  compute: ({ n, s }) => {
    const g = Number(s.g)
    const U = n.m * g * n.h
    return {
      main: { label: 'Potential energy', value: si(U, 'J', 6) },
      stats: [
        { label: 'Speed if dropped (no air)', value: n.h > 0 ? `${fmt(Math.sqrt(2 * g * n.h), 6)} m/s` : '–' },
        { label: 'Fall time', value: n.h > 0 ? `${fmt(Math.sqrt((2 * n.h) / g), 5)} s` : '–' },
        { label: 'In kWh', value: `${fmt(U / 3.6e6, 6)} kWh` },
        { label: 'In kcal', value: `${fmt(U / 4184, 6)} kcal` },
      ],
      working: [`U = m × g × h = ${n.m} × ${g} × ${n.h} = ${fmt(U, 7)} J`, `dropped: v = √(2gh) = ${fmt(Math.sqrt(2 * g * Math.max(0, n.h)), 6)} m/s`],
      chart: curve(0, Math.max(1, Math.abs(n.h) * 2), (x) => n.m * g * x, Math.abs(n.h), { xLabel: 'Height (m)', label: 'Potential energy', yFmt: (y) => si(y, 'J', 4), summary: `Lifting ${n.m} kg by ${n.h} m stores ${si(U, 'J', 4)}. Released, it becomes kinetic energy.` }),
    }
  },
}

const hookeSpec: Spec = {
  inputs: [solveField([['F', 'Force'], ['k', 'Spring constant'], ['x', 'Stretch']], 'F'), pos('k', 'Spring constant', '200', 'N/m', { when: (s) => s.solve !== 'k', half: true }), num('x', 'Stretch or compression', '0.15', 'm', { when: (s) => s.solve !== 'x', half: true }), num('F', 'Force', '30', 'N', { when: (s) => s.solve !== 'F' })],
  compute: ({ n, s }) => {
    if (s.solve === 'k' && n.x === 0) fail('The stretch must not be zero to find k.')
    const k = s.solve === 'k' ? n.F / n.x : n.k
    const x = s.solve === 'x' ? n.F / n.k : n.x
    const F = k * x
    if (k <= 0) fail('The spring constant comes out negative: check the signs.')
    return {
      main: s.solve === 'k' ? { label: 'Spring constant', value: `${fmt(k, 7)} N/m` } : s.solve === 'x' ? { label: 'Stretch', value: `${fmt(x, 7)} m` } : { label: 'Spring force', value: `${fmt(F, 7)} N` },
      stats: [
        { label: 'Energy stored', value: si(0.5 * k * x * x, 'J', 6) },
        { label: 'Mass it holds up on Earth', value: `${fmt(Math.abs(F) / G0, 6)} kg` },
        { label: 'Bounce period with that mass', value: `${fmt(2 * Math.PI * Math.sqrt(Math.abs(F) / G0 / k), 5)} s` },
      ],
      working: [`F = k × x`, s.solve === 'k' ? `k = F ÷ x = ${n.F} ÷ ${n.x} = ${fmt(k, 7)} N/m` : s.solve === 'x' ? `x = F ÷ k = ${n.F} ÷ ${n.k} = ${fmt(x, 7)} m` : `F = ${n.k} × ${n.x} = ${fmt(F, 7)} N`, `energy = ½kx² = ${fmt(0.5 * k * x * x, 7)} J`],
      note: 'Hooke’s law holds only within the spring’s elastic limit.',
      chart: curve(0, Math.max(0.01, Math.abs(x) * 2), (v) => k * v, Math.abs(x), { xLabel: 'Stretch (m)', label: 'Force', yFmt: (y) => `${fmt(y, 5)} N`, summary: `With k = ${fmt(k, 4)} N/m, a stretch of ${fmt(x, 4)} m takes ${fmt(F, 4)} N. Force rises in a straight line with stretch.` }),
    }
  },
}

const hpSpec: Spec = {
  inputs: [solveField([['hp', 'Horsepower'], ['tq', 'Torque']], 'hp'), choice('tu', 'Torque unit', 'lbft', [['lbft', 'lb·ft'], ['nm', 'N·m']]), num('tq', 'Torque', '300', undefined, { when: (s) => s.solve !== 'tq', unit: (s) => (s.tu === 'nm' ? 'N·m' : 'lb·ft'), half: true }), pos('hp', 'Horsepower', '350', 'hp', { when: (s) => s.solve === 'tq', half: true }), pos('rpm', 'Engine speed', '5500', 'rpm', { half: true })],
  compute: ({ n, s }) => {
    const lbft = s.solve === 'tq' ? (n.hp * 5252.113) / n.rpm : s.tu === 'nm' ? n.tq / 1.3558179483 : n.tq
    const hp = (lbft * n.rpm) / 5252.113
    const kw = hp * 0.745699872
    const nm = lbft * 1.3558179483
    return {
      main: s.solve === 'tq' ? { label: 'Torque', value: s.tu === 'nm' ? `${fmt(nm, 6)} N·m` : `${fmt(lbft, 6)} lb·ft` } : { label: 'Horsepower', value: `${fmt(hp, 6)} hp` },
      stats: [
        { label: 'Power in kW', value: `${fmt(kw, 6)} kW` },
        { label: 'Metric horsepower (PS)', value: `${fmt(kw / 0.73549875, 6)} PS` },
        { label: s.tu === 'nm' ? 'Torque in lb·ft' : 'Torque in N·m', value: s.tu === 'nm' ? `${fmt(lbft, 6)} lb·ft` : `${fmt(nm, 6)} N·m` },
      ],
      working: [`hp = torque (lb·ft) × rpm ÷ 5252`, s.solve === 'tq' ? `torque = ${n.hp} × 5252 ÷ ${n.rpm} = ${fmt(lbft, 7)} lb·ft` : `hp = ${fmt(lbft, 6)} × ${n.rpm} ÷ 5252 = ${fmt(hp, 7)}`, `kW = hp × 0.7457 = ${fmt(kw, 6)}`],
      note: '5252 is 33,000 ÷ 2π: one horsepower is 33,000 ft·lb per minute.',
      chart: curve(1000, Math.max(8000, n.rpm * 1.2), (r) => (lbft * r) / 5252.113, n.rpm, { xLabel: 'rpm', label: 'Horsepower at this torque', yFmt: (y) => `${fmt(y, 4)} hp`, summary: `${fmt(lbft, 4)} lb·ft at ${n.rpm} rpm is ${fmt(hp, 4)} hp. At the same torque, power rises with engine speed.` }),
    }
  },
}

export const specs: Record<string, Spec> = {
  'wavelength-calculator': wavelengthSpec,
  'photon-energy-calculator': photonSpec,
  'centripetal-force-calculator': centripetalSpec,
  'momentum-calculator': momentumSpec,
  'work-calculator': workSpec,
  'force-calculator': forceSpec,
  'gravitational-force-calculator': gravSpec,
  'escape-velocity-calculator': escapeSpec,
  'orbital-period-calculator': orbitSpec,
  'speed-of-sound-calculator': soundSpec,
  'decibel-calculator': decibelSpec,
  'thin-lens-calculator': lensSpec,
  'snells-law-calculator': snellSpec,
  'doppler-effect-calculator': dopplerSpec,
  'time-dilation-calculator': dilationSpec,
  'mass-energy-equivalence-calculator': massEnergySpec,
  'acceleration-calculator': accelSpec,
  'speed-distance-time-calculator': sdtSpec,
  'potential-energy-calculator': peSpec,
  'hookes-law-calculator': hookeSpec,
  'horsepower-calculator': hpSpec,
}
