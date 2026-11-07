/** Plane geometry: areas, arcs, polygons, parabolas and circles, each with a scale drawing. */
import { choice, num, pos, select } from '../engine/fields'
import { dec, fmt, int } from '../engine/format'
import { fmtTick } from '../engine/plots'
import { readRows } from '../engine/stats'
import { fail } from '../engine/types'
import type { ShapeLabel, ShapePath, Spec } from '../engine/types'

const UNITS = [['cm', 'cm'], ['m', 'm'], ['mm', 'mm'], ['in', 'in'], ['ft', 'ft'], ['yd', 'yd'], ['', 'no unit']] as const
const unitField = select('u', 'Unit', 'cm', UNITS, { half: true })
const sq = (u: string | undefined) => (u ? ` ${u}²` : '')
const ln = (u: string | undefined) => (u ? ` ${u}` : '')
const arcPts = (cx: number, cy: number, r: number, a0: number, a1: number, n = 48): [number, number][] =>
  Array.from({ length: n + 1 }, (_, k) => [cx + r * Math.cos(a0 + ((a1 - a0) * k) / n), cy + r * Math.sin(a0 + ((a1 - a0) * k) / n)])

/* ── area of shapes ────────────────────────────────────────────── */

const SHAPES = [
  ['rect', 'Rectangle'],
  ['square', 'Square'],
  ['tri', 'Triangle'],
  ['circle', 'Circle'],
  ['ellipse', 'Ellipse'],
  ['trap', 'Trapezoid'],
  ['para', 'Parallelogram'],
  ['sector', 'Circle sector'],
  ['rhombus', 'Rhombus'],
] as const
const XL: Record<string, string> = { rect: 'Length', square: 'Side', tri: 'Base', circle: 'Radius', ellipse: 'Semi-major axis a', trap: 'Base a', para: 'Base', sector: 'Radius', rhombus: 'Diagonal 1' }
const YL: Record<string, string> = { rect: 'Width', tri: 'Height', ellipse: 'Semi-minor axis b', trap: 'Base b', para: 'Height', sector: 'Angle (degrees)', rhombus: 'Diagonal 2' }

/** Ramanujan’s second approximation of an ellipse perimeter. */
export function ellipsePerimeter(a: number, b: number) {
  const h = ((a - b) / (a + b)) ** 2
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
}

export function shapeArea(shape: string, x: number, y: number, z: number): { area: number; perimeter: number | null; formula: string } {
  switch (shape) {
    case 'rect':
      return { area: x * y, perimeter: 2 * (x + y), formula: 'A = l × w, P = 2(l + w)' }
    case 'square':
      return { area: x * x, perimeter: 4 * x, formula: 'A = s², P = 4s' }
    case 'tri':
      return { area: (x * y) / 2, perimeter: null, formula: 'A = ½ × b × h' }
    case 'circle':
      return { area: Math.PI * x * x, perimeter: 2 * Math.PI * x, formula: 'A = πr², C = 2πr' }
    case 'ellipse':
      return { area: Math.PI * x * y, perimeter: ellipsePerimeter(x, y), formula: 'A = πab, P ≈ π(a + b)(1 + 3h ÷ (10 + √(4 − 3h))), h = ((a − b) ÷ (a + b))²' }
    case 'trap':
      return { area: ((x + y) / 2) * z, perimeter: null, formula: 'A = (a + b) ÷ 2 × h' }
    case 'para':
      return { area: x * y, perimeter: null, formula: 'A = b × h' }
    case 'sector':
      return { area: (Math.PI * x * x * y) / 360, perimeter: 2 * x + (Math.PI * x * y) / 180, formula: 'A = πr² × θ ÷ 360°, P = 2r + πrθ ÷ 180°' }
    default:
      return { area: (x * y) / 2, perimeter: 2 * Math.hypot(x, y), formula: 'A = d1 × d2 ÷ 2, P = 2√(d1² + d2²)' }
  }
}

function shapeDrawing(shape: string, x: number, y: number, z: number): { paths: ShapePath[]; labels: ShapeLabel[] } {
  const fill = { closed: true, fill: 'hatch' as const, line: 'solid' as const, width: 2 }
  switch (shape) {
    case 'rect':
    case 'square': {
      const w = shape === 'square' ? x : y
      return { paths: [{ pts: [[0, 0], [x, 0], [x, w], [0, w]], ...fill }], labels: [{ at: [x / 2, 0], text: fmtTick(x), dy: 14 }, { at: [x, w / 2], text: fmtTick(w), dx: 8, anchor: 'start' }] }
    }
    case 'tri':
      return { paths: [{ pts: [[0, 0], [x, 0], [x * 0.35, y]], ...fill }, { pts: [[x * 0.35, 0], [x * 0.35, y]], line: 'dash', width: 1 }], labels: [{ at: [x / 2, 0], text: `b ${fmtTick(x)}`, dy: 14 }, { at: [x * 0.35, y / 2], text: `h ${fmtTick(y)}`, dx: 6, anchor: 'start' }] }
    case 'circle':
      return { paths: [{ pts: arcPts(0, 0, x, 0, 2 * Math.PI, 72), ...fill }, { pts: [[0, 0], [x, 0]], line: 'solid', width: 2 }], labels: [{ at: [x / 2, 0], text: `r ${fmtTick(x)}`, dy: -12, strong: true }] }
    case 'ellipse':
      return { paths: [{ pts: Array.from({ length: 73 }, (_, k) => [x * Math.cos((k / 72) * 2 * Math.PI), y * Math.sin((k / 72) * 2 * Math.PI)] as [number, number]), ...fill }, { pts: [[0, 0], [x, 0]], line: 'solid' }, { pts: [[0, 0], [0, y]], line: 'dash' }], labels: [{ at: [x / 2, 0], text: `a ${fmtTick(x)}`, dy: 14 }, { at: [0, y / 2], text: `b ${fmtTick(y)}`, dx: 6, anchor: 'start' }] }
    case 'trap': {
      const off = (x - y) / 2
      return { paths: [{ pts: [[0, 0], [x, 0], [off + y, z], [off, z]], ...fill }], labels: [{ at: [x / 2, 0], text: `a ${fmtTick(x)}`, dy: 14 }, { at: [off + y / 2, z], text: `b ${fmtTick(y)}`, dy: -12 }, { at: [x, z / 2], text: `h ${fmtTick(z)}`, dx: 8, anchor: 'start' }] }
    }
    case 'para': {
      const sh = y * 0.5
      return { paths: [{ pts: [[0, 0], [x, 0], [x + sh, y], [sh, y]], ...fill }, { pts: [[sh, 0], [sh, y]], line: 'dash', width: 1 }], labels: [{ at: [x / 2, 0], text: `b ${fmtTick(x)}`, dy: 14 }, { at: [sh, y / 2], text: `h ${fmtTick(y)}`, dx: 6, anchor: 'start' }] }
    }
    case 'sector': {
      const t = (Math.min(360, y) * Math.PI) / 180
      return { paths: [{ pts: [[0, 0], ...arcPts(0, 0, x, 0, t)], ...fill }], labels: [{ at: [x / 2, 0], text: `r ${fmtTick(x)}`, dy: 14 }, { at: [0, 0], text: `${fmtTick(y)}°`, dx: -8, anchor: 'end' }] }
    }
    default:
      return { paths: [{ pts: [[-x / 2, 0], [0, y / 2], [x / 2, 0], [0, -y / 2]], ...fill }, { pts: [[-x / 2, 0], [x / 2, 0]], line: 'dash', width: 1 }, { pts: [[0, -y / 2], [0, y / 2]], line: 'dash', width: 1 }], labels: [{ at: [0, 0], text: `d1 ${fmtTick(x)}`, dy: 12 }, { at: [0, y / 2], text: `d2 ${fmtTick(y)}`, dy: -12 }] }
  }
}

const areaSpec: Spec = {
  inputs: [
    select('shape', 'Shape', 'rect', SHAPES, { half: true }),
    unitField,
    pos('x', (s) => XL[s.shape ?? 'rect'] ?? 'Length', '8'),
    pos('y', (s) => YL[s.shape ?? 'rect'] ?? 'Width', '5', undefined, { when: (s) => s.shape !== 'square' && s.shape !== 'circle', max: 1e12 }),
    pos('z', 'Height', '4', undefined, { when: (s) => s.shape === 'trap' }),
  ],
  compute: ({ n, s }) => {
    const shape = s.shape ?? 'rect'
    if (shape === 'sector' && n.y > 360) fail('The angle must be 360° or less.')
    if (shape === 'ellipse' && n.y > n.x) fail('The semi-minor axis cannot be longer than the semi-major axis.')
    const r = shapeArea(shape, n.x, n.y, n.z)
    const d = shapeDrawing(shape, n.x, n.y, n.z)
    const name = SHAPES.find((x) => x[0] === shape)?.[1].toLowerCase() ?? 'shape'
    return {
      main: { label: `Area of the ${name}`, value: r.area, format: (v) => fmt(v, 8), unit: s.u ? `${s.u}²` : undefined },
      stats: [{ label: shape === 'circle' ? 'Circumference' : 'Perimeter', value: r.perimeter === null ? 'Needs the side lengths' : `${fmt(r.perimeter, 8)}${ln(s.u)}` }],
      working: [r.formula, `A = ${fmt(r.area, 10)}${sq(s.u)}`, ...(r.perimeter !== null ? [`${shape === 'circle' ? 'C' : 'P'} = ${fmt(r.perimeter, 10)}${ln(s.u)}`] : [])],
      chart: { kind: 'shape', ...d, summary: `A ${name} with an area of ${fmt(r.area, 6)}${sq(s.u)}, drawn to scale.`, height: 240 },
    }
  },
}

/* ── arc length ────────────────────────────────────────────────── */

export function arc(r: number, rad: number) {
  return { s: r * rad, chord: 2 * r * Math.sin(rad / 2), sector: (r * r * rad) / 2, segment: ((r * r) / 2) * (rad - Math.sin(rad)) }
}

const arcSpec: Spec = {
  inputs: [unitField, pos('r', 'Radius', '10', undefined, { half: true }), choice('au', 'Angle in', 'deg', [['deg', 'Degrees'], ['rad', 'Radians']]), pos('t', 'Central angle', '60', undefined, { unit: (s) => (s.au === 'rad' ? 'rad' : '°') })],
  compute: ({ n, s }) => {
    const rad = s.au === 'rad' ? n.t : (n.t * Math.PI) / 180
    if (rad > 2 * Math.PI + 1e-12) fail('The angle must be a full turn or less.')
    const x = arc(n.r, rad)
    return {
      main: { label: 'Arc length', value: x.s, format: (v) => fmt(v, 8), unit: s.u || undefined },
      stats: [
        { label: 'Chord', value: `${fmt(x.chord, 8)}${ln(s.u)}` },
        { label: 'Sector area', value: `${fmt(x.sector, 8)}${sq(s.u)}` },
        { label: 'Segment area', value: `${fmt(x.segment, 8)}${sq(s.u)}` },
        { label: 'Angle', value: s.au === 'rad' ? `${fmt((rad * 180) / Math.PI, 8)}°` : `${fmt(rad, 8)} rad` },
      ],
      working: [`θ = ${s.au === 'rad' ? `${n.t} rad` : `${n.t}° × π ÷ 180 = ${fmt(rad, 8)} rad`}`, `s = rθ = ${n.r} × ${fmt(rad, 8)} = ${fmt(x.s, 8)}`, `chord = 2r sin(θ/2) = ${fmt(x.chord, 8)}`, `sector = r²θ ÷ 2 = ${fmt(x.sector, 8)}; segment = r²(θ − sin θ) ÷ 2 = ${fmt(x.segment, 8)}`],
      chart: {
        kind: 'shape',
        paths: [
          { pts: arcPts(0, 0, n.r, 0, 2 * Math.PI, 72), closed: true, line: 'grey', width: 1 },
          { pts: [[0, 0], ...arcPts(0, 0, n.r, 0, rad)], closed: true, fill: 'hatch', line: 'none' },
          { pts: arcPts(0, 0, n.r, 0, rad), line: 'solid', width: 4 },
          { pts: [[n.r, 0], [n.r * Math.cos(rad), n.r * Math.sin(rad)]], line: 'dash', width: 1 },
          { pts: [[0, 0], [n.r, 0]], line: 'solid', width: 1 },
        ],
        labels: [{ at: [n.r * Math.cos(rad / 2) * 1.12, n.r * Math.sin(rad / 2) * 1.12], text: `s ${fmtTick(x.s)}`, strong: true }, { at: [n.r / 2, 0], text: `r ${fmtTick(n.r)}`, dy: 12 }],
        summary: `An angle of ${dec((rad * 180) / Math.PI, 3)}° on a circle of radius ${n.r} cuts an arc ${fmt(x.s, 5)} long, ${dec((rad / (2 * Math.PI)) * 100, 2)}% of the circumference.`,
        height: 240,
      },
    }
  },
}

/* ── regular polygon ───────────────────────────────────────────── */

export function regular(nSides: number, side: number) {
  const t = Math.PI / nSides
  return { area: (nSides * side * side) / (4 * Math.tan(t)), perimeter: nSides * side, apothem: side / (2 * Math.tan(t)), circumradius: side / (2 * Math.sin(t)), interior: ((nSides - 2) * 180) / nSides }
}
const NAMES: Record<number, string> = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 12: 'dodecagon' }

const polygonSpec: Spec = {
  inputs: [num('n', 'Number of sides', '6', undefined, { int: true, min: 3, max: 1000, half: true }), unitField, pos('s', 'Side length', '5')],
  compute: ({ n, s }) => {
    const x = regular(n.n, n.s)
    const name = NAMES[n.n] ?? `${n.n}-gon`
    const R = x.circumradius
    const pts = Array.from({ length: n.n }, (_, k) => [R * Math.cos(Math.PI / 2 + (2 * Math.PI * k) / n.n), R * Math.sin(Math.PI / 2 + (2 * Math.PI * k) / n.n)] as [number, number])
    const mid: [number, number] = [(pts[0]![0] + pts[1]![0]) / 2, (pts[0]![1] + pts[1]![1]) / 2]
    return {
      main: { label: `Area of the regular ${name}`, value: x.area, format: (v) => fmt(v, 8), unit: s.u ? `${s.u}²` : undefined },
      stats: [
        { label: 'Perimeter', value: `${fmt(x.perimeter, 8)}${ln(s.u)}` },
        { label: 'Apothem', value: `${fmt(x.apothem, 8)}${ln(s.u)}` },
        { label: 'Circumradius', value: `${fmt(x.circumradius, 8)}${ln(s.u)}` },
        { label: 'Interior angle', value: `${fmt(x.interior, 8)}°` },
        { label: 'Exterior angle', value: `${fmt(360 / n.n, 8)}°` },
        { label: 'Diagonals', value: (n.n * (n.n - 3)) / 2, format: int },
      ],
      working: [`A = n s² ÷ (4 tan(π/n)) = ${n.n} × ${n.s}² ÷ (4 tan(π/${n.n})) = ${fmt(x.area, 8)}`, `apothem = s ÷ (2 tan(π/n)) = ${fmt(x.apothem, 8)}`, `circumradius = s ÷ (2 sin(π/n)) = ${fmt(x.circumradius, 8)}`, `interior angle = (n − 2) × 180° ÷ n = ${fmt(x.interior, 8)}°`],
      chart: {
        kind: 'shape',
        paths: [{ pts: pts.length > 360 ? pts.filter((_, k) => k % Math.ceil(pts.length / 360) === 0) : pts, closed: true, fill: 'hatch', line: 'solid', width: 2 }, { pts: [[0, 0], mid], line: 'dash', width: 2 }, { pts: [[0, 0], pts[0]!], line: 'grey', width: 1 }],
        labels: [{ at: [mid[0] / 2, mid[1] / 2], text: `a ${fmtTick(x.apothem)}`, dx: 8, anchor: 'start', strong: true }, { at: pts[0]!, text: `R ${fmtTick(R)}`, dy: -12 }],
        summary: `A regular ${name} with sides of ${n.s} has an area of ${fmt(x.area, 6)}. The dashed line is the apothem.`,
        height: 240,
      },
    }
  },
}

/* ── polygon area from coordinates ─────────────────────────────── */

export function shoelace(pts: number[][]) {
  let a = 0
  let cx = 0
  let cy = 0
  let per = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i] as [number, number]
    const [x1, y1] = pts[(i + 1) % pts.length] as [number, number]
    const c = x0 * y1 - x1 * y0
    a += c
    cx += (x0 + x1) * c
    cy += (y0 + y1) * c
    per += Math.hypot(x1 - x0, y1 - y0)
  }
  a /= 2
  return { signed: a, area: Math.abs(a), perimeter: per, cx: a ? cx / (6 * a) : NaN, cy: a ? cy / (6 * a) : NaN }
}

const shoelaceSpec: Spec = {
  inputs: [unitField, { id: 'p', kind: 'text', label: 'Corners in order, x and y on each line', value: '0 0\n6 0\n7 4\n3 6\n-1 3', rows: 6, hint: 'Go around the shape in one direction.' }],
  compute: ({ s }) => {
    const { rows, error } = readRows(s.p ?? '', 2)
    if (error) fail(error)
    if (rows.length < 3) fail('A polygon needs at least 3 corners.')
    const x = shoelace(rows)
    if (x.area === 0) fail('The corners are on one line, so the area is zero.')
    return {
      main: { label: 'Area', value: x.area, format: (v) => fmt(v, 8), unit: s.u ? `${s.u}²` : undefined },
      stats: [
        { label: 'Perimeter', value: `${fmt(x.perimeter, 8)}${ln(s.u)}` },
        { label: 'Centroid', value: `(${fmt(x.cx, 6)}, ${fmt(x.cy, 6)})` },
        { label: 'Corners', value: rows.length, format: int },
        { label: 'Order', value: x.signed > 0 ? 'Counterclockwise' : 'Clockwise' },
      ],
      working: [`A = ½ |Σ (xᵢ yᵢ₊₁ − xᵢ₊₁ yᵢ)|`, `Σ = ${rows.map((p, i) => { const q = rows[(i + 1) % rows.length]!; return `(${fmt(p[0]!, 4)}·${fmt(q[1]!, 4)} − ${fmt(q[0]!, 4)}·${fmt(p[1]!, 4)})` }).slice(0, 6).join(' + ')}${rows.length > 6 ? ' + …' : ''} = ${fmt(x.signed * 2, 8)}`, `A = ${fmt(x.area, 8)}`],
      note: 'The shoelace formula needs a simple polygon: its sides must not cross.',
      chart: {
        kind: 'shape',
        paths: [{ pts: rows.map((r) => [r[0]!, r[1]!] as [number, number]), closed: true, fill: 'hatch', line: 'solid', width: 2 }],
        dots: [[x.cx, x.cy]],
        labels: rows.slice(0, 30).map((r, i) => ({ at: [r[0]!, r[1]!] as [number, number], text: `${i + 1}`, dy: -12, strong: true })),
        summary: `The polygon with ${rows.length} corners has an area of ${fmt(x.area, 6)}. The dot is its centroid.`,
        height: 260,
      },
    }
  },
}

/* ── parabola ──────────────────────────────────────────────────── */

export function parabola(a: number, b: number, c: number) {
  const h = -b / (2 * a)
  const k = c - (b * b) / (4 * a)
  const p = 1 / (4 * a)
  const disc = b * b - 4 * a * c
  const roots = disc < 0 ? [] : disc === 0 ? [h] : [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)].sort((x, y) => x - y)
  return { h, k, focus: [h, k + p] as [number, number], directrix: k - p, disc, roots }
}

const parabolaSpec: Spec = {
  inputs: [num('a', 'a', '1', undefined, { half: true }), num('b', 'b', '-4', undefined, { half: true }), num('c', 'c', '3', undefined, { half: true })],
  compute: ({ n }) => {
    if (n.a === 0) fail('a cannot be zero: that is a straight line.')
    const x = parabola(n.a, n.b, n.c)
    const span = Math.max(3, ...x.roots.map((r) => Math.abs(r - x.h) * 1.5))
    const xs = Array.from({ length: 61 }, (_, k) => Number((x.h - span + (2 * span * k) / 60).toPrecision(8)))
    return {
      main: { label: 'Vertex', value: `(${fmt(x.h, 7)}, ${fmt(x.k, 7)})`, sub: n.a > 0 ? 'opens upward: the vertex is a minimum' : 'opens downward: the vertex is a maximum' },
      stats: [
        { label: 'Focus', value: `(${fmt(x.focus[0], 7)}, ${fmt(x.focus[1], 7)})` },
        { label: 'Directrix', value: `y = ${fmt(x.directrix, 7)}` },
        { label: 'Axis of symmetry', value: `x = ${fmt(x.h, 7)}` },
        { label: 'x-intercepts', value: x.roots.length ? x.roots.map((r) => fmt(r, 7)).join(', ') : 'None (no real roots)' },
        { label: 'y-intercept', value: fmt(n.c, 7) },
        { label: 'Discriminant', value: x.disc, format: (v) => fmt(v, 7) },
      ],
      working: [`y = ${n.a}x² + ${n.b}x + ${n.c}`, `h = −b ÷ 2a = ${fmt(x.h, 7)}, k = c − b² ÷ 4a = ${fmt(x.k, 7)}`, `vertex form: y = ${n.a}(x − ${fmt(x.h, 6)})² + ${fmt(x.k, 6)}`, `focal length p = 1 ÷ 4a = ${fmt(1 / (4 * n.a), 7)}: focus (h, k + p), directrix y = k − p`, `roots = (−b ± √(b² − 4ac)) ÷ 2a`],
      chart: {
        kind: 'line',
        x: xs,
        series: [{ id: 'y', label: 'y', values: xs.map((v) => n.a * v * v + n.b * v + n.c) }],
        xLabel: 'x',
        formatX: (v) => fmtTick(v),
        formatValue: (v) => fmt(v, 6),
        guides: [{ y: 0, label: 'y = 0' }, { y: x.directrix, label: 'directrix' }],
        markers: [{ x: Number(x.h.toPrecision(8)), label: 'vertex' }, ...x.roots.map((r) => ({ x: Number(r.toPrecision(8)), label: fmtTick(r) }))],
        zero: false,
        summary: `The parabola has its vertex at (${fmt(x.h, 4)}, ${fmt(x.k, 4)}) and ${x.roots.length ? `crosses the x-axis at ${x.roots.map((r) => fmt(r, 4)).join(' and ')}` : 'does not cross the x-axis'}.`,
        table: true,
      },
    }
  },
}

/* ── circle equation ───────────────────────────────────────────── */

export function circleFrom3(p: [number, number], q: [number, number], r: [number, number]) {
  const d = 2 * (p[0] * (q[1] - r[1]) + q[0] * (r[1] - p[1]) + r[0] * (p[1] - q[1]))
  if (Math.abs(d) < 1e-12) return null
  const s1 = p[0] ** 2 + p[1] ** 2
  const s2 = q[0] ** 2 + q[1] ** 2
  const s3 = r[0] ** 2 + r[1] ** 2
  const h = (s1 * (q[1] - r[1]) + s2 * (r[1] - p[1]) + s3 * (p[1] - q[1])) / d
  const k = (s1 * (r[0] - q[0]) + s2 * (p[0] - r[0]) + s3 * (q[0] - p[0])) / d
  return { h, k, r: Math.hypot(p[0] - h, p[1] - k) }
}

const circleSpec: Spec = {
  inputs: [
    select('m', 'You know', 'cr', [['cr', 'Center and radius'], ['3p', 'Three points on the circle'], ['gen', 'General form x² + y² + Dx + Ey + F = 0']]),
    num('h', 'Center x (h)', '2', undefined, { half: true, when: (s) => s.m === 'cr' }),
    num('k', 'Center y (k)', '-1', undefined, { half: true, when: (s) => s.m === 'cr' }),
    pos('r', 'Radius', '3', undefined, { when: (s) => s.m === 'cr' }),
    { id: 'p', kind: 'text', label: 'Three points, x and y on each line', value: '0 0\n4 0\n0 6', rows: 3, when: (s) => s.m === '3p' },
    num('D', 'D', '-4', undefined, { half: true, when: (s) => s.m === 'gen' }),
    num('E', 'E', '2', undefined, { half: true, when: (s) => s.m === 'gen' }),
    num('F', 'F', '-4', undefined, { half: true, when: (s) => s.m === 'gen' }),
  ],
  compute: ({ n, s }) => {
    let h = n.h
    let k = n.k
    let r = n.r
    let pts: [number, number][] = []
    if (s.m === '3p') {
      const { rows, error } = readRows(s.p ?? '', 2)
      if (error) fail(error)
      if (rows.length !== 3) fail('Enter exactly three points.')
      pts = rows.map((q) => [q[0]!, q[1]!] as [number, number])
      const c = circleFrom3(pts[0]!, pts[1]!, pts[2]!)
      if (!c) fail('The three points are on one line, so no circle passes through them.')
      ;({ h, k, r } = c)
    } else if (s.m === 'gen') {
      h = -n.D / 2
      k = -n.E / 2
      const r2 = h * h + k * k - n.F
      if (r2 <= 0) fail('These coefficients do not describe a real circle (r² ≤ 0).')
      r = Math.sqrt(r2)
    }
    const tidy = (v: number) => (Math.abs(v) < 1e-9 * Math.max(1, r * r) ? 0 : v)
    h = tidy(h)
    k = tidy(k)
    const D = tidy(-2 * h)
    const E = tidy(-2 * k)
    const F = tidy(h * h + k * k - r * r)
    const sgn = (v: number) => (v < 0 ? `+ ${fmt(-v, 7)}` : `− ${fmt(v, 7)}`)
    const term = (v: number, t: string) => (v === 0 ? '' : ` ${v < 0 ? '−' : '+'} ${fmt(Math.abs(v), 7)}${t}`)
    return {
      main: { label: 'Standard form', value: `(x ${sgn(h)})² + (y ${sgn(k)})² = ${fmt(r * r, 7)}` },
      stats: [
        { label: 'Center', value: `(${fmt(h, 7)}, ${fmt(k, 7)})` },
        { label: 'Radius', value: r, format: (v) => fmt(v, 8) },
        { label: 'General form', value: `x² + y²${term(D, 'x')}${term(E, 'y')}${term(F, '')} = 0` },
        { label: 'Area', value: Math.PI * r * r, format: (v) => fmt(v, 8) },
        { label: 'Circumference', value: 2 * Math.PI * r, format: (v) => fmt(v, 8) },
      ],
      working:
        s.m === '3p'
          ? ['the center is equally far from all three points: solve the two perpendicular bisector equations', `center (${fmt(h, 7)}, ${fmt(k, 7)}), r = distance to any point = ${fmt(r, 8)}`]
          : s.m === 'gen'
            ? [`complete the square: h = −D/2 = ${fmt(h, 7)}, k = −E/2 = ${fmt(k, 7)}`, `r² = h² + k² − F = ${fmt(r * r, 8)}, r = ${fmt(r, 8)}`]
            : [`(x − h)² + (y − k)² = r²`, `expand: x² + y² − 2hx − 2ky + (h² + k² − r²) = 0`],
      chart: {
        kind: 'shape',
        paths: [{ pts: arcPts(h, k, r, 0, 2 * Math.PI, 72), closed: true, fill: 'hatch', line: 'solid', width: 2 }, { pts: [[h, k], [h + r, k]], line: 'dash', width: 1 }],
        dots: [[h, k], ...pts],
        labels: [{ at: [h, k], text: `(${fmtTick(h)}, ${fmtTick(k)})`, dy: -12, strong: true }, { at: [h + r / 2, k], text: `r ${fmtTick(r)}`, dy: 12 }],
        summary: `A circle centered at (${fmt(h, 4)}, ${fmt(k, 4)}) with radius ${fmt(r, 4)}.`,
        height: 260,
      },
    }
  },
}

export const specs: Record<string, Spec> = {
  'area-calculator': areaSpec,
  'arc-length-calculator': arcSpec,
  'regular-polygon-calculator': polygonSpec,
  'polygon-area-calculator': shoelaceSpec,
  'parabola-calculator': parabolaSpec,
  'circle-equation-calculator': circleSpec,
}
