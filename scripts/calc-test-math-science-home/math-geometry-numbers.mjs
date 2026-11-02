// Primes, roots, long division and rounding: textbook values.
import { factorize, powerForm, divisorCount, divisors } from '../../src/components/tools/calc2/primes.ts'
import { nthRoot, simplifyRadical, radicalText, newton } from '../../src/components/tools/calc2/roots.ts'
import { longDivide, decimalText } from '../../src/components/tools/calc2/longdiv.ts'
import { parseDec, roundPlaces, roundSig } from '../../src/components/tools/calc2/rounding.ts'

export default (t) => {
  const f = (n) => powerForm(factorize(BigInt(n)))
  t.eq('360 = 2³ × 3² × 5', f(360), '2³ × 3² × 5')
  t.eq('1001 = 7 × 11 × 13', f(1001), '7 × 11 × 13')
  t.eq('600851475143', f('600851475143'), '71 × 839 × 1471 × 6857')
  t.eq('semiprime 1000000007 × 999999937', f('999999943999999559'), '999999937 × 1000000007')
  t.eq('prime 10^18 − 11', f('999999999999999989'), '999999999999999989')
  t.eq('2^60', f(String(2n ** 60n)), '2⁶⁰')
  t.eq('divisors of 360', Number(divisorCount(factorize(360n))), 24)
  t.eq('divisors of 12', divisors(factorize(12n)).map(String), ['1', '2', '3', '4', '6', '12'])

  t.eq('√72 = 6√2', radicalText(simplifyRadical(72, 2), 2), '6√2')
  t.eq('∛54 = 3∛2', radicalText(simplifyRadical(54, 3), 3), '3∛2')
  t.eq('√49 = 7', radicalText(simplifyRadical(49, 2), 2), '7')
  t.eq('∛−27 = −3', radicalText(simplifyRadical(-27, 3), 3), '−3')
  t.eq('∛27 = 3 exactly', nthRoot(27, 3), 3)
  t.eq('⁵√32 = 2 exactly', nthRoot(32, 5), 2)
  t.near('√2', nthRoot(2, 2), Math.SQRT2, 1e-15)
  t.ok('√−4 is not real', Number.isNaN(nthRoot(-4, 2)))
  const it = newton(72, 2)
  t.near('Newton converges to √72', it[it.length - 1], Math.sqrt(72), 1e-12)

  const d = longDivide(1234n, 7n)
  t.eq('1234 ÷ 7 = 176 r 2', [String(d.quotient), String(d.remainder)], ['176', '2'])
  t.eq('1234 ÷ 7 steps', d.steps.map((s) => [String(s.partial), s.q, String(s.rem)]), [['12', 1, '5'], ['53', 7, '4'], ['44', 6, '2']])
  t.eq('1 ÷ 7 = 0.(142857)', decimalText(longDivide(1n, 7n)), '0.(142857)')
  t.eq('1 ÷ 6 = 0.1(6)', decimalText(longDivide(1n, 6n)), '0.1(6)')
  t.eq('3 ÷ 8 = 0.375', decimalText(longDivide(3n, 8n)), '0.375')

  const r = (x, k, m) => roundPlaces(parseDec(x), k, m).text
  t.eq('2.5 half to even', r('2.5', 0, 'half-even'), '2')
  t.eq('3.5 half to even', r('3.5', 0, 'half-even'), '4')
  t.eq('1.005 to 2 dp', r('1.005', 2, 'half-up'), '1.01')
  t.eq('0.125 half up', r('0.125', 2, 'half-up'), '0.13')
  t.eq('0.125 half to even', r('0.125', 2, 'half-even'), '0.12')
  t.eq('−2.5 half up rounds away from zero', r('-2.5', 0, 'half-up'), '-3')
  t.eq('−2.1 floor', r('-2.1', 0, 'floor'), '-3')
  t.eq('−2.9 truncate', r('-2.9', 0, 'trunc'), '-2')
  t.eq('2.01 ceiling', r('2.01', 0, 'ceil'), '3')
  t.eq('1234 to nearest 100', r('1234', -2, 'half-up'), '1200')
  t.eq('1250 to nearest 100 half up', r('1250', -2, 'half-up'), '1300')
  t.eq('3.14159 to 3 sf', roundSig(parseDec('3.14159'), 3, 'half-up').text, '3.14')
  t.eq('0.0012345 to 2 sf', roundSig(parseDec('0.0012345'), 2, 'half-up').text, '0.0012')
  t.eq('2.5 to 2 sf keeps the zero', roundSig(parseDec('2.5'), 3, 'half-up').text, '2.50')
  t.eq('9.99 to 2 sf', roundSig(parseDec('9.99'), 2, 'half-up').text, '10')
  t.eq('123456 to 2 sf', roundSig(parseDec('123456'), 2, 'half-up').text, '120000')
}
