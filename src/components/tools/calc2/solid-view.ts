/**
 * 3D views of the solids in solids.ts, drawn on a canvas with an orthographic
 * camera that turns around the vertical axis: a wireframe that fills with
 * liquid (volume) and a net that folds out of the solid (surface area).
 */
import { fitEqual, label } from './_viz/draw'
import type { Fit } from './_viz/draw'
import { fmt } from './_viz/format'
import type { Ink } from './_viz/hooks'
import { clamp01, easeInOut, lerp } from './geo-anim'
import { heron } from './solids'
import type { Dims, Shape } from './solids'

export type V3 = [number, number, number]
type V2 = [number, number]

export interface View {
  /** Turn around the vertical axis, radians. */
  phi: number
  /** Camera height: tilt down, radians. */
  tau: number
}

export function project(p: V3, v: View): { x: number; y: number; depth: number } {
  const c = Math.cos(v.phi)
  const s = Math.sin(v.phi)
  const xr = p[0] * c + p[2] * s
  const zr = -p[0] * s + p[2] * c
  return { x: xr, y: p[1] * Math.cos(v.tau) - zr * Math.sin(v.tau), depth: zr * Math.cos(v.tau) + p[1] * Math.sin(v.tau) }
}

/** > 0 when a surface with normal n faces the camera. */
function facing(n: V3, v: View): number {
  const zr = -n[0] * Math.sin(v.phi) + n[2] * Math.cos(v.phi)
  return zr * Math.cos(v.tau) + n[1] * Math.sin(v.tau)
}

const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/* ── the model: cross-sections, edges ───────────────────────────── */

interface Edge {
  pts: V3[]
  /** Normals of the surfaces that meet along each point. */
  nrm: V3[][]
}

interface Model {
  height: number
  /** The horizontal cross-section at height y, as a closed polygon. */
  section: (y: number) => V3[]
  edges: Edge[]
  /** Heights where the outline has a corner, sampled densely for the hull. */
  levels: number[]
}

const N = 40

function ring(rho: number, y: number, n = N): V3[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [rho * Math.cos(a), y, rho * Math.sin(a)] as V3
  })
}

/** The triangle of a prism in the xz plane, centred. */
export function prismTriangle(d: Dims): { pts: V2[]; apex: V2 } {
  const a = d.a ?? 1
  const b = d.b ?? 1
  const c = d.c ?? 1
  const px = (a * a + c * c - b * b) / (2 * a)
  const py = Math.sqrt(Math.max(0, c * c - px * px))
  const cx = (a + px) / 3
  const cy = py / 3
  return {
    pts: [
      [-cx, -cy],
      [a - cx, -cy],
      [px - cx, py - cy],
    ],
    apex: [px, py],
  }
}

function polyhedron(verts: V3[], faces: number[][]): Edge[] {
  const centre: V3 = verts.reduce<V3>((acc, p) => [acc[0] + p[0] / verts.length, acc[1] + p[1] / verts.length, acc[2] + p[2] / verts.length], [0, 0, 0])
  const normals = faces.map((f) => {
    let n = norm(cross(sub3(verts[f[1]!]!, verts[f[0]!]!), sub3(verts[f[2]!]!, verts[f[0]!]!)))
    if (dot3(n, sub3(verts[f[0]!]!, centre)) < 0) n = [-n[0], -n[1], -n[2]]
    return n
  })
  const map = new Map<string, { i: number; j: number; n: V3[] }>()
  faces.forEach((f, fi) => {
    for (let k = 0; k < f.length; k++) {
      const i = f[k]!
      const j = f[(k + 1) % f.length]!
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      const e = map.get(key) ?? { i, j, n: [] }
      e.n.push(normals[fi]!)
      map.set(key, e)
    }
  })
  return [...map.values()].map(({ i, j, n }) => ({ pts: [verts[i]!, verts[j]!], nrm: [n, n] }))
}

/** A solid of revolution from its radius profile rho(y), y in [0, H]. */
function revolution(H: number, rho: (y: number) => number, rims: { y: number; extra: V3 | null }[]): Model {
  const dr = (y: number) => (rho(Math.min(H, y + H * 1e-4)) - rho(Math.max(0, y - H * 1e-4))) / (Math.min(H, y + H * 1e-4) - Math.max(0, y - H * 1e-4))
  const normalAt = (y: number, th: number): V3 => norm([Math.cos(th), -dr(y), Math.sin(th)])
  const edges: Edge[] = []
  for (const { y, extra } of rims) {
    const r = rho(y)
    if (r <= 0) continue
    const pts = ring(r, y, 64)
    pts.push(pts[0]!)
    edges.push({ pts, nrm: pts.map((_, i) => [normalAt(Math.min(H * 0.999, Math.max(H * 0.001, y)), (i / 64) * Math.PI * 2), ...(extra ? [extra] : [])]) })
  }
  for (let k = 0; k < 6; k++) {
    const th = (k / 6) * Math.PI * 2
    const M = 36
    const pts: V3[] = []
    const nrm: V3[][] = []
    for (let i = 0; i <= M; i++) {
      const y = (i / M) * H
      const r = rho(y)
      pts.push([r * Math.cos(th), y, r * Math.sin(th)])
      nrm.push([normalAt(Math.min(H * 0.999, Math.max(H * 0.001, y)), th)])
    }
    edges.push({ pts, nrm })
  }
  return { height: H, section: (y) => ring(Math.max(0, rho(Math.min(H, Math.max(0, y)))), y), edges, levels: Array.from({ length: 25 }, (_, i) => (i / 24) * H) }
}

export function model(shape: Shape, d: Dims): Model {
  const r = d.r ?? 1
  const h = d.h ?? 1
  const a = d.a ?? 1
  const DOWN: V3 = [0, -1, 0]
  const UP: V3 = [0, 1, 0]
  switch (shape) {
    case 'cube':
    case 'box': {
      const l = shape === 'cube' ? a : (d.l ?? 1)
      const w = shape === 'cube' ? a : (d.w ?? 1)
      const H = shape === 'cube' ? a : h
      const v: V3[] = [
        [-l / 2, 0, -w / 2], [l / 2, 0, -w / 2], [l / 2, 0, w / 2], [-l / 2, 0, w / 2],
        [-l / 2, H, -w / 2], [l / 2, H, -w / 2], [l / 2, H, w / 2], [-l / 2, H, w / 2],
      ]
      const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
      return {
        height: H,
        section: (y) => [[-l / 2, y, -w / 2], [l / 2, y, -w / 2], [l / 2, y, w / 2], [-l / 2, y, w / 2]],
        edges: polyhedron(v, faces),
        levels: [0, H],
      }
    }
    case 'pyramid': {
      const v: V3[] = [[-a / 2, 0, -a / 2], [a / 2, 0, -a / 2], [a / 2, 0, a / 2], [-a / 2, 0, a / 2], [0, h, 0]]
      const faces = [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]
      return {
        height: h,
        section: (y) => {
          const s = (a / 2) * (1 - Math.min(1, Math.max(0, y / h)))
          return [[-s, y, -s], [s, y, -s], [s, y, s], [-s, y, s]]
        },
        edges: polyhedron(v, faces),
        levels: [0, h],
      }
    }
    case 'prism': {
      const L = d.len ?? 1
      const { pts } = prismTriangle(d)
      const v: V3[] = [...pts.map(([x, z]) => [x, 0, z] as V3), ...pts.map(([x, z]) => [x, L, z] as V3)]
      const faces = [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]]
      return { height: L, section: (y) => pts.map(([x, z]) => [x, y, z] as V3), edges: polyhedron(v, faces), levels: [0, L] }
    }
    case 'cylinder':
      return revolution(h, () => r, [
        { y: 0, extra: DOWN },
        { y: h, extra: UP },
      ])
    case 'cone':
      return revolution(h, (y) => r * (1 - y / h), [{ y: 0, extra: DOWN }])
    case 'sphere':
      return revolution(2 * r, (y) => Math.sqrt(Math.max(0, r * r - (y - r) ** 2)), [{ y: r, extra: null }])
    case 'hemisphere':
      return revolution(r, (y) => Math.sqrt(Math.max(0, r * r - y * y)), [{ y: 0, extra: DOWN }])
    case 'capsule': {
      const len = d.a ?? 0
      return revolution(
        2 * r + len,
        (y) => (y < r ? Math.sqrt(Math.max(0, r * r - (r - y) ** 2)) : y > r + len ? Math.sqrt(Math.max(0, r * r - (y - r - len) ** 2)) : r),
        [
          { y: r, extra: null },
          { y: r + len, extra: null },
        ],
      )
    }
  }
}

/* ── geometry helpers ───────────────────────────────────────────── */

function hull(points: V2[]): V2[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const crossZ = (o: V2, a: V2, b: V2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: V2[] = []
  for (const q of p) {
    while (lower.length >= 2 && crossZ(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: V2[] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!
    while (upper.length >= 2 && crossZ(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop()
    upper.push(q)
  }
  upper.pop()
  lower.pop()
  return lower.concat(upper)
}

function areaXZ(poly: V3[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    s += a[0] * b[2] - b[0] * a[2]
  }
  return Math.abs(s) / 2
}

/** Height of liquid that fills a fraction f of the volume (steady pouring). */
export function levelFor(m: Model, f: number): number {
  const K = 96
  const cum = [0]
  let prev = areaXZ(m.section(0))
  for (let j = 1; j <= K; j++) {
    const y = (j / K) * m.height
    const ar = areaXZ(m.section(y))
    cum.push(cum[j - 1]! + ((prev + ar) / 2) * (m.height / K))
    prev = ar
  }
  const total = cum[K]!
  const target = clamp01(f) * total
  for (let j = 1; j <= K; j++) {
    if (cum[j]! >= target) {
      const span = cum[j]! - cum[j - 1]! || 1
      return ((j - 1 + (target - cum[j - 1]!) / span) / K) * m.height
    }
  }
  return m.height
}

/* ── volume: a turning wireframe that fills ─────────────────────── */

function sceneFit(m: Model, w: number, h: number, tau: number, pad: [number, number, number, number]): Fit {
  let R = 0
  for (const y of m.levels.length > 2 ? m.levels : [0, m.height * 0.5, m.height]) for (const p of m.section(y)) R = Math.max(R, Math.hypot(p[0], p[2]))
  const top = m.height * Math.cos(tau) + R * Math.sin(tau)
  const bottom = -R * Math.sin(tau)
  return fitEqual(-R, R, bottom, top, w, h, pad)
}

export function paintFill(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  m: Model,
  view: View,
  fill: number,
  ink: Ink,
): void {
  const fit = sceneFit(m, w, h, view.tau, [30, 18, 18, 18])
  const S = (p: V3) => {
    const q = project(p, view)
    return [fit.x(q.x), fit.y(q.y)] as V2
  }
  const poly = (pts: V2[]) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
  }
  const levels = m.levels.length > 2 ? m.levels : [0, m.height]
  // liquid
  if (fill > 0) {
    const top = levelFor(m, fill)
    const ys = [...levels.filter((y) => y < top), top]
    poly(hull(ys.flatMap((y) => m.section(y).map(S))))
    ctx.fillStyle = ink.grey
    ctx.fill()
    poly(m.section(top).map(S))
    ctx.fillStyle = ink.hairline
    ctx.fill()
  }
  // hidden edges dashed, then the outline, then visible edges
  const vis = (n: V3[]) => n.some((x) => facing(x, view) > 1e-6)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const pass of [false, true]) {
    ctx.save()
    if (!pass) ctx.setLineDash([3, 4])
    ctx.strokeStyle = pass ? ink.ink : ink.grey
    ctx.lineWidth = pass ? 1.5 : 1
    ctx.beginPath()
    for (const e of m.edges) {
      for (let i = 0; i < e.pts.length - 1; i++) {
        const show = vis(e.nrm[i]!) || vis(e.nrm[i + 1]!)
        if (show !== pass) continue
        const [x1, y1] = S(e.pts[i]!)
        const [x2, y2] = S(e.pts[i + 1]!)
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
      }
    }
    ctx.stroke()
    ctx.restore()
  }
  poly(hull(levels.flatMap((y) => m.section(y).map(S))))
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 2
  ctx.stroke()
}

/* ── surface area: faces that fold out into a net ───────────────── */

export interface Face {
  /** 3D loop. */
  p3: V3[]
  /** The same loop laid flat, in the plane of the net. */
  p2: V2[]
  area: number
  /** Paper-filled face; circles that stand for the curved area of a sphere are outlines. */
  solid: boolean
}

function rect3(a: V3, b: V3, c: V3, d: V3): V3[] {
  return [a, b, c, d]
}

export function net(shape: Shape, d: Dims): Face[] {
  const PI = Math.PI
  const r = d.r ?? 1
  const h = d.h ?? 1
  const a = d.a ?? 1
  const disk = (cx: number, cy: number, rr: number, at: (psi: number) => V3, area: number, solid = true): Face => {
    const M = 48
    const p2: V2[] = []
    const p3: V3[] = []
    for (let i = 0; i < M; i++) {
      const psi = (i / M) * 2 * PI
      p2.push([cx + rr * Math.cos(psi), cy + rr * Math.sin(psi)])
      p3.push(at(psi))
    }
    return { p2, p3, area, solid }
  }
  const band = (x0: number, y0: number, rr: number, len: number, yb: number): Face => {
    const M = 48
    const p2: V2[] = []
    const p3: V3[] = []
    const circ = 2 * PI * rr
    for (let i = 0; i <= M; i++) {
      const x = (i / M) * circ
      const th = -PI / 2 - x / rr
      p2.push([x0 + x, y0])
      p3.push([rr * Math.cos(th), yb, rr * Math.sin(th)])
    }
    for (let i = M; i >= 0; i--) {
      const x = (i / M) * circ
      const th = -PI / 2 - x / rr
      p2.push([x0 + x, y0 + len])
      p3.push([rr * Math.cos(th), yb + len, rr * Math.sin(th)])
    }
    return { p2, p3, area: circ * len, solid: true }
  }
  switch (shape) {
    case 'cube':
    case 'box': {
      const l = shape === 'cube' ? a : (d.l ?? 1)
      const w = shape === 'cube' ? a : (d.w ?? 1)
      const H = shape === 'cube' ? a : h
      const X = l / 2
      const Z = w / 2
      return [
        { p2: [[0, 0], [l, 0], [l, w], [0, w]], p3: rect3([-X, 0, Z], [X, 0, Z], [X, 0, -Z], [-X, 0, -Z]), area: l * w, solid: true },
        { p2: [[0, 0], [l, 0], [l, -H], [0, -H]], p3: rect3([-X, 0, Z], [X, 0, Z], [X, H, Z], [-X, H, Z]), area: l * H, solid: true },
        { p2: [[0, w], [l, w], [l, w + H], [0, w + H]], p3: rect3([-X, 0, -Z], [X, 0, -Z], [X, H, -Z], [-X, H, -Z]), area: l * H, solid: true },
        { p2: [[0, w + H], [l, w + H], [l, 2 * w + H], [0, 2 * w + H]], p3: rect3([-X, H, -Z], [X, H, -Z], [X, H, Z], [-X, H, Z]), area: l * w, solid: true },
        { p2: [[0, 0], [0, w], [-H, w], [-H, 0]], p3: rect3([-X, 0, Z], [-X, 0, -Z], [-X, H, -Z], [-X, H, Z]), area: w * H, solid: true },
        { p2: [[l, 0], [l, w], [l + H, w], [l + H, 0]], p3: rect3([X, 0, Z], [X, 0, -Z], [X, H, -Z], [X, H, Z]), area: w * H, solid: true },
      ]
    }
    case 'pyramid': {
      const s = Math.hypot(a / 2, h)
      const X = a / 2
      const top: V3 = [0, h, 0]
      const tri = (a * s) / 2
      return [
        { p2: [[0, 0], [a, 0], [a, a], [0, a]], p3: rect3([-X, 0, X], [X, 0, X], [X, 0, -X], [-X, 0, -X]), area: a * a, solid: true },
        { p2: [[0, 0], [a, 0], [a / 2, -s]], p3: [[-X, 0, X], [X, 0, X], top], area: tri, solid: true },
        { p2: [[0, a], [a, a], [a / 2, a + s]], p3: [[-X, 0, -X], [X, 0, -X], top], area: tri, solid: true },
        { p2: [[0, 0], [0, a], [-s, a / 2]], p3: [[-X, 0, X], [-X, 0, -X], top], area: tri, solid: true },
        { p2: [[a, 0], [a, a], [a + s, a / 2]], p3: [[X, 0, X], [X, 0, -X], top], area: tri, solid: true },
      ]
    }
    case 'prism': {
      const L = d.len ?? 1
      const b = d.b ?? 1
      const c = d.c ?? 1
      const { pts, apex } = prismTriangle(d)
      const P = (i: number, y: number): V3 => [pts[i]![0], y, pts[i]![1]]
      const T = heron(a, b, c)
      return [
        { p2: [[0, 0], [a, 0], [a, L], [0, L]], p3: [P(0, 0), P(1, 0), P(1, L), P(0, L)], area: a * L, solid: true },
        { p2: [[a, 0], [a + b, 0], [a + b, L], [a, L]], p3: [P(1, 0), P(2, 0), P(2, L), P(1, L)], area: b * L, solid: true },
        { p2: [[a + b, 0], [a + b + c, 0], [a + b + c, L], [a + b, L]], p3: [P(2, 0), P(0, 0), P(0, L), P(2, L)], area: c * L, solid: true },
        { p2: [[0, 0], [a, 0], [apex[0], -apex[1]]], p3: [P(0, 0), P(1, 0), P(2, 0)], area: T, solid: true },
        { p2: [[0, L], [a, L], [apex[0], L + apex[1]]], p3: [P(0, L), P(1, L), P(2, L)], area: T, solid: true },
      ]
    }
    case 'cylinder':
      return [
        disk(PI * r, -r, r, (psi) => [r * Math.cos(-psi), 0, r * Math.sin(-psi)], PI * r * r),
        band(0, 0, r, h, 0),
        disk(PI * r, h + r, r, (psi) => [r * Math.cos(psi), h, r * Math.sin(psi)], PI * r * r),
      ]
    case 'cone': {
      const s = Math.hypot(r, h)
      const theta = (2 * PI * r) / s
      const M = 48
      const p2: V2[] = [[0, 0]]
      const p3: V3[] = [[0, h, 0]]
      for (let i = 0; i <= M; i++) {
        const u = i / M - 0.5
        const ang = -PI / 2 + u * theta
        p2.push([s * Math.cos(ang), s * Math.sin(ang)])
        const th = PI / 2 - u * 2 * PI
        p3.push([r * Math.cos(th), 0, r * Math.sin(th)])
      }
      return [disk(0, -s - r, r, (psi) => [r * Math.cos(-psi), 0, r * Math.sin(-psi)], PI * r * r), { p2, p3, area: PI * r * s, solid: true }]
    }
    case 'sphere': {
      const g = 1.12 * r
      const circle = (alpha: number) => (psi: number): V3 => [r * Math.cos(psi) * Math.cos(alpha), r + r * Math.sin(psi), r * Math.cos(psi) * Math.sin(alpha)]
      return [
        disk(-g, g, r, circle(0), PI * r * r, false),
        disk(g, g, r, circle(PI / 4), PI * r * r, false),
        disk(-g, -g, r, circle(PI / 2), PI * r * r, false),
        disk(g, -g, r, circle((3 * PI) / 4), PI * r * r, false),
      ]
    }
    case 'hemisphere': {
      const half = (alpha: number) => (psi: number): V3 =>
        psi <= PI ? [r * Math.cos(psi) * Math.cos(alpha), r * Math.sin(psi), r * Math.cos(psi) * Math.sin(alpha)] : [r * Math.cos(psi) * Math.cos(alpha), 0, r * Math.cos(psi) * Math.sin(alpha)]
      const g = 2.24 * r
      return [
        disk(-g, 0, r, half(0), PI * r * r, false),
        disk(0, 0, r, (psi) => [r * Math.cos(psi), 0, r * Math.sin(psi)], PI * r * r, true),
        disk(g, 0, r, half(PI / 2), PI * r * r, false),
      ]
    }
    case 'capsule': {
      const len = d.a ?? 0
      const top = (alpha: number) => (psi: number): V3 =>
        psi <= PI ? [r * Math.cos(psi) * Math.cos(alpha), r + len + r * Math.sin(psi), r * Math.cos(psi) * Math.sin(alpha)] : [r * Math.cos(psi) * Math.cos(alpha), r + len, r * Math.cos(psi) * Math.sin(alpha)]
      const bottom = (alpha: number) => (psi: number): V3 =>
        psi >= PI ? [r * Math.cos(psi) * Math.cos(alpha), r + r * Math.sin(psi), r * Math.cos(psi) * Math.sin(alpha)] : [r * Math.cos(psi) * Math.cos(alpha), r, r * Math.cos(psi) * Math.sin(alpha)]
      const C = PI * r
      const faces: Face[] = [
        disk(C - 1.1 * r, len + r * 1.1, r, top(0), PI * r * r, false),
        disk(C + 1.1 * r, len + r * 1.1, r, top(PI / 2), PI * r * r, false),
        disk(C - 1.1 * r, -r * 1.1, r, bottom(0), PI * r * r, false),
        disk(C + 1.1 * r, -r * 1.1, r, bottom(PI / 2), PI * r * r, false),
      ]
      if (len > 0) faces.splice(2, 0, band(0, 0, r, len, r))
      return faces
    }
  }
}

/**
 * Draw the faces at unfold progress u (0 solid, 1 flat net). Faces unfold one
 * after another. Labels with each face's area appear on the flat net.
 */
export function paintNet(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  faces: Face[],
  height: number,
  view: View,
  u: number,
  ink: Ink,
  areaText: (a: number) => string,
): void {
  // fit for the solid
  let R = 0
  for (const f of faces) for (const p of f.p3) R = Math.max(R, Math.hypot(p[0], p[2]))
  const fit3 = fitEqual(-R, R, -R * Math.sin(view.tau), height * Math.cos(view.tau) + R * Math.sin(view.tau), w, h, [24, 24, 24, 24])
  // fit for the net
  const xs = faces.flatMap((f) => f.p2.map((p) => p[0]))
  const ys = faces.flatMap((f) => f.p2.map((p) => p[1]))
  const fit2 = fitEqual(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), w, h, [16, 16, 16, 16])

  const n = faces.length
  const order = faces
    .map((f, i) => ({ f, i, depth: f.p3.reduce((s, p) => s + project(p, view).depth, 0) / f.p3.length }))
    .sort((p, q) => p.depth - q.depth)
  ctx.lineJoin = 'round'
  for (const { f, i } of order) {
    // stagger: each face starts a little after the one before
    const span = 0.55
    const start = n > 1 ? (i / (n - 1)) * (1 - span) : 0
    const e = easeInOut(clamp01((u - start) / span))
    ctx.beginPath()
    f.p3.forEach((p, k) => {
      const q = project(p, view)
      const x = lerp(fit3.x(q.x), fit2.x(f.p2[k]![0]), e)
      const y = lerp(fit3.y(q.y), fit2.y(f.p2[k]![1]), e)
      if (k) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.closePath()
    if (f.solid) {
      ctx.fillStyle = ink.paper
      ctx.fill()
    }
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 1.75
    ctx.stroke()
  }
  if (u >= 1) {
    for (const f of faces) {
      const cx = f.p2.reduce((s, p) => s + p[0], 0) / f.p2.length
      const cy = f.p2.reduce((s, p) => s + p[1], 0) / f.p2.length
      const wpx = (Math.max(...f.p2.map((p) => p[0])) - Math.min(...f.p2.map((p) => p[0]))) * fit2.k
      const hpx = (Math.max(...f.p2.map((p) => p[1])) - Math.min(...f.p2.map((p) => p[1]))) * fit2.k
      if (Math.min(wpx, hpx) < 22) continue
      const t = areaText(f.area)
      ctx.font = `620 11.5px ${ink.font}`
      if (ctx.measureText(t).width > wpx - 6) continue
      label(ctx, t, fit2.x(cx), fit2.y(cy) + 4, { color: ink.ink, halo: f.solid ? ink.paper : ink.fill, font: ink.font, size: 11.5, weight: 620, align: 'center' })
    }
  }
}

export { fmt as fmtArea }
