/** Volume and surface area of common solids. Pure; the tests import it. */
import { num } from './_viz/format'

export type Shape = 'cube' | 'box' | 'cylinder' | 'cone' | 'sphere' | 'hemisphere' | 'pyramid' | 'prism' | 'capsule'
export type Param = 'a' | 'l' | 'w' | 'h' | 'r' | 'b' | 'c' | 'len'

export interface ShapeSpec {
  label: string
  params: { key: Param; label: string; def: string }[]
}

export const SHAPES: Record<Shape, ShapeSpec> = {
  cube: { label: 'Cube', params: [{ key: 'a', label: 'Side a', def: '4' }] },
  box: {
    label: 'Box (cuboid)',
    params: [
      { key: 'l', label: 'Length l', def: '5' },
      { key: 'w', label: 'Width w', def: '3' },
      { key: 'h', label: 'Height h', def: '2' },
    ],
  },
  cylinder: {
    label: 'Cylinder',
    params: [
      { key: 'r', label: 'Radius r', def: '3' },
      { key: 'h', label: 'Height h', def: '5' },
    ],
  },
  cone: {
    label: 'Cone',
    params: [
      { key: 'r', label: 'Radius r', def: '3' },
      { key: 'h', label: 'Height h', def: '4' },
    ],
  },
  sphere: { label: 'Sphere', params: [{ key: 'r', label: 'Radius r', def: '3' }] },
  hemisphere: { label: 'Hemisphere', params: [{ key: 'r', label: 'Radius r', def: '3' }] },
  pyramid: {
    label: 'Square pyramid',
    params: [
      { key: 'a', label: 'Base side a', def: '4' },
      { key: 'h', label: 'Height h', def: '3' },
    ],
  },
  prism: {
    label: 'Triangular prism',
    params: [
      { key: 'a', label: 'Triangle side a', def: '3' },
      { key: 'b', label: 'Triangle side b', def: '4' },
      { key: 'c', label: 'Triangle side c', def: '5' },
      { key: 'len', label: 'Length', def: '6' },
    ],
  },
  capsule: {
    label: 'Capsule',
    params: [
      { key: 'r', label: 'Radius r', def: '2' },
      { key: 'a', label: 'Straight length a', def: '4' },
    ],
  },
}

export type Dims = Partial<Record<Param, number>>

const PI = Math.PI
const v = (d: Dims, k: Param) => d[k] ?? 0

/** Heron's formula; NaN when the sides do not make a triangle. */
export function heron(a: number, b: number, c: number): number {
  const s = (a + b + c) / 2
  const q = s * (s - a) * (s - b) * (s - c)
  return q > 0 ? Math.sqrt(q) : Number.NaN
}

/** A message when the dimensions cannot make the shape, else null. */
export function checkDims(shape: Shape, d: Dims): string | null {
  for (const p of SHAPES[shape].params) {
    const x = d[p.key]
    if (x === undefined || !Number.isFinite(x)) return `Enter ${p.label.toLowerCase()}.`
    if (shape === 'capsule' && p.key === 'a' ? x < 0 : x <= 0) return `${p.label} must be above zero.`
  }
  if (shape === 'prism' && Number.isNaN(heron(v(d, 'a'), v(d, 'b'), v(d, 'c'))))
    return 'These three sides do not make a triangle: each side must be shorter than the other two together.'
  return null
}

export function volume(shape: Shape, d: Dims): number {
  const r = v(d, 'r')
  const h = v(d, 'h')
  const a = v(d, 'a')
  switch (shape) {
    case 'cube':
      return a ** 3
    case 'box':
      return v(d, 'l') * v(d, 'w') * h
    case 'cylinder':
      return PI * r * r * h
    case 'cone':
      return (PI * r * r * h) / 3
    case 'sphere':
      return (4 / 3) * PI * r ** 3
    case 'hemisphere':
      return (2 / 3) * PI * r ** 3
    case 'pyramid':
      return (a * a * h) / 3
    case 'prism':
      return heron(a, v(d, 'b'), v(d, 'c')) * v(d, 'len')
    case 'capsule':
      return PI * r * r * ((4 / 3) * r + a)
  }
}

/** Slant height of a cone or a square pyramid (apex to the middle of a base edge). */
export function slant(shape: 'cone' | 'pyramid', d: Dims): number {
  return shape === 'cone' ? Math.hypot(v(d, 'r'), v(d, 'h')) : Math.hypot(v(d, 'a') / 2, v(d, 'h'))
}

export interface Part {
  name: string
  area: number
}

/** Surface area split into its parts (faces, curved surface, bases). */
export function surfaceParts(shape: Shape, d: Dims): Part[] {
  const r = v(d, 'r')
  const h = v(d, 'h')
  const a = v(d, 'a')
  switch (shape) {
    case 'cube':
      return [{ name: '6 faces', area: 6 * a * a }]
    case 'box': {
      const l = v(d, 'l')
      const w = v(d, 'w')
      return [
        { name: 'Top and bottom', area: 2 * l * w },
        { name: 'Front and back', area: 2 * l * h },
        { name: 'Two ends', area: 2 * w * h },
      ]
    }
    case 'cylinder':
      return [
        { name: 'Two circular ends', area: 2 * PI * r * r },
        { name: 'Curved side', area: 2 * PI * r * h },
      ]
    case 'cone':
      return [
        { name: 'Base', area: PI * r * r },
        { name: 'Curved side', area: PI * r * slant('cone', d) },
      ]
    case 'sphere':
      return [{ name: 'Surface', area: 4 * PI * r * r }]
    case 'hemisphere':
      return [
        { name: 'Curved surface', area: 2 * PI * r * r },
        { name: 'Flat base', area: PI * r * r },
      ]
    case 'pyramid':
      return [
        { name: 'Base', area: a * a },
        { name: 'Four triangles', area: 2 * a * slant('pyramid', d) },
      ]
    case 'prism': {
      const b = v(d, 'b')
      const c = v(d, 'c')
      const len = v(d, 'len')
      return [
        { name: 'Two triangles', area: 2 * heron(a, b, c) },
        { name: 'Three rectangles', area: (a + b + c) * len },
      ]
    }
    case 'capsule':
      return [
        { name: 'Two half spheres', area: 4 * PI * r * r },
        { name: 'Curved side', area: 2 * PI * r * a },
      ]
  }
}

export function surface(shape: Shape, d: Dims): number {
  return surfaceParts(shape, d).reduce((s, p) => s + p.area, 0)
}

/** The volume formula with the numbers in, one step per line. */
export function volumeWork(shape: Shape, d: Dims): string[] {
  const r = num(v(d, 'r'))
  const h = num(v(d, 'h'))
  const a = num(v(d, 'a'))
  const V = num(volume(shape, d))
  switch (shape) {
    case 'cube':
      return ['V = a³', `  = ${a}³`, `  = ${V}`]
    case 'box':
      return ['V = l × w × h', `  = ${num(v(d, 'l'))} × ${num(v(d, 'w'))} × ${h}`, `  = ${V}`]
    case 'cylinder':
      return ['V = π r² h', `  = π × ${r}² × ${h}`, `  = ${V}`]
    case 'cone':
      return ['V = ⅓ π r² h', `  = π × ${r}² × ${h} ÷ 3`, `  = ${V}`]
    case 'sphere':
      return ['V = 4⁄3 π r³', `  = 4 × π × ${r}³ ÷ 3`, `  = ${V}`]
    case 'hemisphere':
      return ['V = 2⁄3 π r³', `  = 2 × π × ${r}³ ÷ 3`, `  = ${V}`]
    case 'pyramid':
      return ['V = ⅓ a² h', `  = ${a}² × ${h} ÷ 3`, `  = ${V}`]
    case 'prism': {
      const b = v(d, 'b')
      const c = v(d, 'c')
      const s = (v(d, 'a') + b + c) / 2
      return [
        's = (a + b + c) ÷ 2',
        `  = (${a} + ${num(b)} + ${num(c)}) ÷ 2 = ${num(s)}`,
        'triangle = √(s(s − a)(s − b)(s − c))   (Heron)',
        `         = √(${num(s)} × ${num(s - v(d, 'a'))} × ${num(s - b)} × ${num(s - c)}) = ${num(heron(v(d, 'a'), b, c))}`,
        'V = triangle × length',
        `  = ${num(heron(v(d, 'a'), b, c))} × ${num(v(d, 'len'))} = ${V}`,
      ]
    }
    case 'capsule':
      return ['V = π r² (4⁄3 r + a)', `  = π × ${r}² × (4 × ${r} ÷ 3 + ${a})`, `  = ${V}`]
  }
}

/** The surface area formula with the numbers in. */
export function surfaceWork(shape: Shape, d: Dims): string[] {
  const r = num(v(d, 'r'))
  const h = num(v(d, 'h'))
  const a = num(v(d, 'a'))
  const A = num(surface(shape, d))
  switch (shape) {
    case 'cube':
      return ['A = 6a²', `  = 6 × ${a}²`, `  = ${A}`]
    case 'box': {
      const l = num(v(d, 'l'))
      const w = num(v(d, 'w'))
      return ['A = 2(lw + lh + wh)', `  = 2 × (${l} × ${w} + ${l} × ${h} + ${w} × ${h})`, `  = ${A}`]
    }
    case 'cylinder':
      return ['A = 2πr² + 2πrh', `  = 2 × π × ${r}² + 2 × π × ${r} × ${h}`, `  = ${A}`]
    case 'cone': {
      const s = num(slant('cone', d))
      return ['s = √(r² + h²)', `  = √(${r}² + ${h}²) = ${s}`, 'A = πr² + πrs', `  = π × ${r}² + π × ${r} × ${s}`, `  = ${A}`]
    }
    case 'sphere':
      return ['A = 4πr²', `  = 4 × π × ${r}²`, `  = ${A}`]
    case 'hemisphere':
      return ['A = 2πr² + πr² = 3πr²', `  = 3 × π × ${r}²`, `  = ${A}`]
    case 'pyramid': {
      const s = num(slant('pyramid', d))
      return ['s = √((a ÷ 2)² + h²)', `  = √((${a} ÷ 2)² + ${h}²) = ${s}`, 'A = a² + 2as', `  = ${a}² + 2 × ${a} × ${s}`, `  = ${A}`]
    }
    case 'prism': {
      const b = num(v(d, 'b'))
      const c = num(v(d, 'c'))
      const T = num(heron(v(d, 'a'), v(d, 'b'), v(d, 'c')))
      return [
        'triangle T = √(s(s − a)(s − b)(s − c)), s = (a + b + c) ÷ 2',
        `  T = ${T}`,
        'A = 2T + (a + b + c) × length',
        `  = 2 × ${T} + (${a} + ${b} + ${c}) × ${num(v(d, 'len'))}`,
        `  = ${A}`,
      ]
    }
    case 'capsule':
      return ['A = 4πr² + 2πra', `  = 4 × π × ${r}² + 2 × π × ${r} × ${a}`, `  = ${A}`]
  }
}
