// Math stats group: parser, matrices, systems, counting, probability, normal and t, intervals,
// sample size, percentages. Reference values from textbooks and standard tables.
import { compile, tryCompile, roots } from '../../src/components/tools/calc2/graph-parser.ts'
import { det, inverse, multiply, rref, transpose } from '../../src/components/tools/calc2/matrix.ts'
import { solveSystem } from '../../src/components/tools/calc2/linsys.ts'
import { nCr, nPr, count, bigSci, arrangements } from '../../src/components/tools/calc2/combinatorics.ts'
import { twoEvents, atLeastOnce, binomialExactly } from '../../src/components/tools/calc2/prob.ts'
import { Phi, invPhi, tInv } from '../../src/components/tools/calc2/normal.ts'
import { meanInterval, sampleSize, waldInterval, wilsonInterval } from '../../src/components/tools/calc2/ci.ts'
import { percentChange, percentDifference, percentError } from '../../src/components/tools/calc2/percent.ts'

export default (t) => {
  /* parser */
  const at = (s, x) => compile(s)(x)
  t.near('-2^2 = -4', at('-2^2', 0), -4)
  t.near('2^3^2 = 512 (right associative)', at('2^3^2', 0), 512)
  t.near('2x at 3', at('2x', 3), 6)
  t.near('2(x+1) at 3', at('2(x+1)', 3), 8)
  t.near('x sin x at 2', at('x sin x', 2), 2 * Math.sin(2))
  t.near('sin 2x at 1', at('sin 2x', 1), Math.sin(2))
  t.near('sin(x)^2 at 1', at('sin(x)^2', 1), Math.sin(1) ** 2)
  t.near('3 + 4 × 2 ÷ (1 − 5)^2', at('3 + 4 × 2 ÷ (1 − 5)^2', 0), 3.5)
  t.near('|x − 5| at 2', at('|x-5|', 2), 3)
  t.near('ln(e^2)', at('ln(e^2)', 0), 2)
  t.near('log(1000)', at('log(1000)', 0), 3)
  t.near('2pi', at('2pi', 0), 2 * Math.PI)
  t.near('y = x² + 1 at 3', at('y = x² + 1', 3), 10)
  t.near('max(x, 2) at 1', at('max(x, 2)', 1), 2)
  t.near('2^-1', at('2^-1', 0), 0.5)
  const bad = tryCompile('(x + 1')
  t.ok('missing bracket is an error', !bad.ok && /closing bracket/.test(bad.error))
  const unk = tryCompile('2y + 1')
  t.ok('unknown name points at y', !unk.ok && unk.pos === 1)
  t.ok('empty is an error', !tryCompile('  ').ok)
  t.eq('roots of x² − 2', roots(compile('x^2 - 2'), -5, 5).map((r) => +r.toFixed(9)), [-1.414213562, 1.414213562])
  t.eq('tan x has roots, not asymptotes', roots(compile('tan x'), -4, 4).map((r) => +r.toFixed(6)), [-3.141593, 0, 3.141593])

  /* matrices */
  t.near('det 2×2 [[4,7],[2,6]] = 10', det([[4, 7], [2, 6]]), 10)
  t.near('det 3×3 [[6,1,1],[4,−2,5],[2,8,7]] = −306', det([[6, 1, 1], [4, -2, 5], [2, 8, 7]]), -306)
  t.near('det 4×4', det([[1, 0, 2, -1], [3, 0, 0, 5], [2, 1, 4, -3], [1, 0, 5, 0]]), 30)
  t.eq('inverse [[4,7],[2,6]]', inverse([[4, 7], [2, 6]]).inv, [[0.6, -0.7], [-0.2, 0.4]])
  const inv3 = inverse([[2, -1, 0], [-1, 2, -1], [0, -1, 2]]).inv
  t.eq('inverse 3×3 × 4', inv3.map((r) => r.map((v) => +(v * 4).toFixed(9))), [[3, 2, 1], [2, 4, 2], [1, 2, 3]])
  t.eq('singular has no inverse', inverse([[1, 2, 3], [2, 4, 6], [1, 0, 1]]).inv, null)
  t.eq('product', multiply([[1, 2], [3, 4]], [[5, 6], [7, 8]]), [[19, 22], [43, 50]])
  t.eq('product 2×3 × 3×2', multiply([[1, 2, 3], [4, 5, 6]], [[7, 8], [9, 10], [11, 12]]), [[58, 64], [139, 154]])
  t.eq('transpose', transpose([[1, 2, 3], [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]])
  t.eq('rank of a rank-2 3×3', rref([[1, 2, 3], [2, 4, 6], [1, 0, 1]]).rank, 2)

  /* systems */
  const s3 = solveSystem([[2, 1, -1, 8], [-3, -1, 2, -11], [-2, 1, 2, -3]])
  t.eq('3×3 system x = 2, y = 3, z = −1', s3.x?.map((v) => +v.toFixed(9)), [2, 3, -1])
  t.eq('2×2 system', solveSystem([[2, 3, 8], [1, -1, -1]]).x?.map((v) => +v.toFixed(9)), [1, 2])
  t.eq('parallel lines: no solution', solveSystem([[1, 1, 2], [2, 2, 5]]).kind, 'none')
  t.eq('same line: infinite', solveSystem([[1, 1, 2], [2, 2, 4]]).kind, 'infinite')

  /* counting */
  t.eq('10C3 = 120', nCr(10, 3).toString(), '120')
  t.eq('10P3 = 720', nPr(10, 3).toString(), '720')
  t.eq('52C5 = 2598960', nCr(52, 5).toString(), '2598960')
  t.eq('C(n+r−1, r): 5 kinds choose 3 with repetition = 35', count('repComb', 5, 3).toString(), '35')
  t.eq('10³ ordered with repetition', count('repPerm', 10, 3).toString(), '1000')
  t.eq('100C50 exact', nCr(100, 50).toString(), '100891344545564193334812497256')
  t.eq('52! in scientific form', bigSci(nPr(52, 52)), { mant: '8.066', exp: 67 })
  t.eq('arrangements 3P2 count', arrangements('nPr', 3, 2).length, 6)
  t.eq('arrangements 4C2 count', arrangements('nCr', 4, 2).length, 6)
  t.eq('arrangements 3 multichoose 2 count', arrangements('repComb', 3, 2).length, 6)

  /* probability */
  const e = twoEvents(0.5, 0.4)
  t.near('P(A and B) = 0.2', e.and, 0.2)
  t.near('P(A or B) = 0.7', e.or, 0.7)
  t.near('P(exactly one) = 0.5', e.exactlyOne, 0.5)
  t.near('P(neither) = 0.3', e.neither, 0.3)
  t.near('at least one six in 4 rolls = 0.5177', atLeastOnce(1 / 6, 4), 0.517747, 1e-6)
  t.near('exactly 3 heads in 5 flips = 0.3125', binomialExactly(0.5, 5, 3), 0.3125, 1e-12)

  /* normal and t */
  t.near('Φ(1.96) = 0.9750021', Phi(1.96), 0.9750021048517795, 1e-10)
  t.near('Φ(1) = 0.8413447', Phi(1), 0.8413447460685429, 1e-10)
  t.near('Φ(−1.645) = 0.0499849', Phi(-1.645), 0.0499849055391214, 1e-10)
  t.near('Φ(−5) = 2.8665e−7', Phi(-5), 2.866515718791939e-7, 1e-6, true)
  t.near('Φ⁻¹(0.975) = 1.959964', invPhi(0.975), 1.959963984540054, 1e-9)
  t.near('t(0.975, 9) = 2.262157', tInv(0.975, 9), 2.262157, 1e-6)
  t.near('t(0.975, 29) = 2.045230', tInv(0.975, 29), 2.04523, 1e-6)
  t.near('t(0.995, 4) = 4.604095', tInv(0.995, 4), 4.604095, 1e-6)

  /* intervals and sample size */
  const z = meanInterval(100, 15, 25, 0.95, true)
  t.near('z interval 100 ± 5.880', z.margin, 5.879892, 1e-5)
  const ti = meanInterval(50, 10, 10, 0.95, false)
  t.near('t interval margin 7.1536', ti.margin, 7.153569, 1e-5)
  t.near('Wald 40/100 margin 0.0960', waldInterval(40, 100, 0.95).margin, 0.096018, 1e-5)
  const w = wilsonInterval(40, 100, 0.95)
  t.near('Wilson 40/100 low 0.3094', w.lo, 0.309401, 1e-5)
  t.near('Wilson 40/100 high 0.4980', w.hi, 0.497997, 1e-5)
  t.eq('sample size 95% ±5% p 0.5 = 385', sampleSize(0.95, 0.05, 0.5).n, 385)
  t.eq('sample size with N = 1000 = 278', sampleSize(0.95, 0.05, 0.5, 1000).n, 278)
  t.eq('sample size 99% ±3% = 1844', sampleSize(0.99, 0.03, 0.5).n, 1844)

  /* percentages */
  t.near('percent error 9.8 vs 9.81', percentError(9.7, 9.81).abs, 1.121305, 1e-6)
  t.near('percent change 50 → 75 = 50%', percentChange(50, 75), 50)
  t.near('percent change 80 → 60 = −25%', percentChange(80, 60), -25)
  t.near('percent difference 10 and 15 = 40%', percentDifference(10, 15), 40)
}
