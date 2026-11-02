// Significant figures and scientific notation, exact decimal strings.
import { countSig, sigArith, roundToSig } from '../../src/components/tools/calc2/sigfig.ts'
import { parseDec, toPlain, toSciParts, toEngParts, roundSig, fromNumber } from '../../src/components/tools/calc2/scinot.ts'

export default (t) => {
  const c = (s) => countSig(s)?.count
  t.eq('"0.00450" has 3', c('0.00450'), 3)
  t.eq('"1200." has 4', c('1200.'), 4)
  t.eq('"100.0" has 4', c('100.0'), 4)
  t.eq('"1.20e3" has 3', c('1.20e3'), 3)
  t.eq('"1200" has 2 (ambiguous)', c('1200'), 2)
  t.ok('"1200" is ambiguous', countSig('1200')?.ambiguous === true)
  t.eq('"10.05" has 4', c('10.05'), 4)
  t.eq('"−0.0503" has 3', c('-0.0503'), 3)
  t.eq('"6.022 × 10^23" has 4', c('6.022 × 10^23'), 4)
  t.eq('"0" has 1', c('0'), 1)

  const r = (s, n) => toPlain(roundToSig(s, n))
  t.eq('0.004567 to 2 → 0.0046', r('0.004567', 2), '0.0046')
  t.eq('1995 to 3 → 2000 (2.00 × 10³)', toSciParts(roundToSig('1995', 3)), { mant: '2.00', exp: 3 })
  t.eq('2.5 to 1 → 3 (half away from zero)', r('2.5', 1), '3')
  t.eq('9.996 to 3 → 10.0', r('9.996', 3), '10.0')
  t.eq('12.3 to 5 → 12.300', r('12.3', 5), '12.300')

  const add = sigArith('12.11', '+', '18.0')
  t.eq('12.11 + 18.0 = 30.1', toPlain(add.rounded), '30.1')
  const sub = sigArith('100.0', '−', '0.123')
  t.eq('100.0 − 0.123 = 99.9', toPlain(sub.rounded), '99.9')
  const mul = sigArith('4.56', '×', '1.4')
  t.eq('4.56 × 1.4 = 6.4', toPlain(mul.rounded), '6.4')
  const div = sigArith('2.00', '÷', '3.0')
  t.eq('2.00 ÷ 3.0 = 0.67', toPlain(div.rounded), '0.67')
  const add2 = sigArith('1200', '+', '34')
  t.eq('1200 + 34 = 1200 (hundreds)', toPlain(add2.rounded), '1200')

  const sci = (s) => toSciParts(parseDec(s).dec)
  t.eq('1200 → 1.2 × 10³', sci('1200'), { mant: '1.2', exp: 3 })
  t.eq('0.00450 → 4.50 × 10⁻³', sci('0.00450'), { mant: '4.50', exp: -3 })
  t.eq('602200000000000000000000 → 6.022 × 10²³', sci('602200000000000000000000'), { mant: '6.022', exp: 23 })
  t.eq('−45.6 → −4.56 × 10¹', sci('-45.6'), { mant: '−4.56', exp: 1 })
  t.eq('4.5e-3 → 0.0045', toPlain(parseDec('4.5e-3').dec), '0.0045')
  t.eq('3.0 × 10⁸ → 300000000', toPlain(parseDec('3.0 × 10⁸').dec), '300000000')
  t.eq('1.2x10^-3 → 0.0012', toPlain(parseDec('1.2x10^-3').dec), '0.0012')
  t.eq('engineering 0.000047 → 47 × 10⁻⁶', toEngParts(parseDec('0.000047').dec), { mant: '47', exp: -6 })
  t.eq('engineering 123456 → 123.456 × 10³', toEngParts(parseDec('123456').dec), { mant: '123.456', exp: 3 })
  for (const s of ['0.000123', '98765.4321', '1.000', '5e10', '7.07e-12', '-3.3']) {
    const d = parseDec(s).dec
    const { mant, exp } = toSciParts(d)
    const back = parseDec(`${mant.replace('−', '-')}e${exp}`).dec
    t.eq(`round trip ${s}`, back, d)
  }
  t.eq('fromNumber(0.1 + 0.2) to 15 digits', toPlain(fromNumber(0.1 + 0.2)), '0.3')
  t.eq('roundSig 0.30000000000000004 to 3', toPlain(roundSig(fromNumber(0.30000000000000004), 3)), '0.300')
}
