// Lines, triangles, circles, solids and averages: textbook values.
import { slope, distance, midpoint } from '../../src/components/tools/calc2/lines.ts'
import { solveRight, isTriple } from '../../src/components/tools/calc2/pythagoras.ts'
import { circleFrom } from '../../src/components/tools/calc2/circle.ts'
import { volume, surface } from '../../src/components/tools/calc2/solids.ts'
import { central, parseList } from '../../src/components/tools/calc2/central.ts'

export default (t) => {
  const s = slope({ x: 1, y: 2 }, { x: 3, y: 8 })
  t.eq('slope (1,2)-(3,8) = 3', s.m, 3)
  t.eq('intercept −1', s.b, -1)
  t.eq('standard form 3x − y = 1', [s.A, s.B, s.C], [3, -1, 1])
  t.near('angle atan 3', s.angle, 71.565051, 1e-6)
  t.eq('vertical line', slope({ x: 2, y: 1 }, { x: 2, y: 5 }).m, null)
  t.eq('distance (0,0)-(3,4) = 5', distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5)
  t.eq('3D distance (1,2,3)-(4,6,15) = 13', distance({ x: 1, y: 2, z: 3 }, { x: 4, y: 6, z: 15 }), 13)
  t.eq('midpoint', midpoint({ x: -2, y: 4 }, { x: 6, y: 0 }), { x: 2, y: 2 })

  const c = solveRight('c', { a: 5, b: 12 })
  t.eq('5-12-13', c.c, 13)
  t.near('angle opposite 5', c.A, 22.619865, 1e-6)
  t.eq('leg from c', solveRight('a', { b: 4, c: 5 }).a, 3)
  t.ok('c shorter than b is an error', typeof solveRight('a', { b: 5, c: 4 }) === 'string')
  t.ok('8-15-17 is a triple', isTriple(8, 15, 17))

  const k = circleFrom('r', 5)
  t.near('circle r 5 circumference', k.C, 31.4159, 1e-4)
  t.near('circle r 5 area', k.A, 78.5398, 1e-4)
  t.near('circle from area', circleFrom('A', 78.53981633974483).r, 5, 1e-12)
  t.near('circle from circumference', circleFrom('C', 10 * Math.PI).d, 10, 1e-12)

  t.near('sphere r 3 volume', volume('sphere', { r: 3 }), 113.097, 1e-3)
  t.near('sphere r 3 area', surface('sphere', { r: 3 }), 113.097, 1e-3)
  t.near('cone r 3 h 4 volume', volume('cone', { r: 3, h: 4 }), 37.699, 1e-3)
  t.near('cone r 3 h 4 area', surface('cone', { r: 3, h: 4 }), 75.398, 1e-3)
  t.near('cylinder r 3 h 5 volume 45π', volume('cylinder', { r: 3, h: 5 }), 141.372, 1e-3)
  t.near('cylinder r 3 h 5 area 48π', surface('cylinder', { r: 3, h: 5 }), 150.796, 1e-3)
  t.eq('box 5 × 3 × 2 volume', volume('box', { l: 5, w: 3, h: 2 }), 30)
  t.eq('box 5 × 3 × 2 area', surface('box', { l: 5, w: 3, h: 2 }), 62)
  t.eq('pyramid a 6 h 4 volume', volume('pyramid', { a: 6, h: 4 }), 48)
  t.eq('pyramid a 6 h 4 area (slant 5)', surface('pyramid', { a: 6, h: 4 }), 96)
  t.eq('prism 3-4-5 × 10 volume', volume('prism', { a: 3, b: 4, c: 5, len: 10 }), 60)
  t.eq('prism 3-4-5 × 10 area', surface('prism', { a: 3, b: 4, c: 5, len: 10 }), 132)
  t.near('hemisphere r 3 area 27π', surface('hemisphere', { r: 3 }), 84.823, 1e-3)
  t.near('capsule r 2 a 4 volume', volume('capsule', { r: 2, a: 4 }), Math.PI * 4 * (8 / 3 + 4), 1e-9)

  const m = central(parseList('2, 4, 4, 4, 5, 5, 7, 9').values)
  t.eq('mean 5', m.mean, 5)
  t.eq('median 4.5', m.median, 4.5)
  t.eq('mode 4', m.modes, [4])
  t.eq('range 7', m.range, 7)
  const b = central(parseList('1 2 2 3 3 4').values)
  t.eq('two modes', b.modes, [2, 3])
  t.eq('no mode when all differ', central([1, 2, 3]).modes, [])
  t.eq('mean of 0.1, 0.2', central([0.1, 0.2]).mean, 0.15)
  t.eq('bad tokens', parseList('1, x, 3').bad, ['x'])
}
