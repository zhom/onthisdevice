// Ohm's law and the resistor colour code (IEC 60062).
import { solveOhm } from '../../src/components/tools/calc2/ohm.ts'
import { decode, encode } from '../../src/components/tools/calc2/resistor.ts'

export default (t) => {
  // 12 V across 4 Ω: I = 3 A, P = 36 W.
  const a = solveOhm('V', 12, 'R', 4).values
  t.near('I = V/R', a.I, 3)
  t.near('P = V²/R', a.P, 36)
  // 2 A through 50 Ω: V = 100 V, P = 200 W.
  const b = solveOhm('I', 2, 'R', 50).values
  t.near('V = IR', b.V, 100)
  t.near('P = I²R', b.P, 200)
  // 60 W at 120 V: I = 0.5 A, R = 240 Ω.
  const c = solveOhm('P', 60, 'V', 120).values
  t.near('I = P/V', c.I, 0.5)
  t.near('R = V²/P', c.R, 240)
  // 100 W in 4 Ω: V = 20 V, I = 5 A.
  const d = solveOhm('P', 100, 'R', 4).values
  t.near('V = √(PR)', d.V, 20)
  t.near('I = √(P/R)', d.I, 5)
  const e = solveOhm('I', 0.25, 'P', 5).values
  t.near('R = P/I²', e.R, 80)
  t.ok('same key twice is rejected', solveOhm('V', 1, 'V', 2) === null)

  const r1 = decode(['brown', 'black', 'red', 'gold'])
  t.near('brown black red gold = 1 kΩ', r1.ohms, 1000)
  t.near('brown black red gold ±5 %', r1.tol, 5)
  t.near('yellow violet orange = 47 kΩ', decode(['yellow', 'violet', 'orange', 'gold']).ohms, 47000)
  t.eq('4.7 kΩ -> yellow violet red', encode(4700, 4).bands.slice(0, 3), ['yellow', 'violet', 'red'])
  // 5 band: brown black black brown brown = 100 × 10 = 1 kΩ ±1 %.
  const r5 = decode(['brown', 'black', 'black', 'brown', 'brown'])
  t.near('5-band brown black black brown brown = 1 kΩ', r5.ohms, 1000)
  t.near('5-band tolerance brown = 1 %', r5.tol, 1)
  // 5 band: orange orange black black brown = 330 Ω ±1 %.
  t.near('5-band orange orange black black = 330 Ω', decode(['orange', 'orange', 'black', 'black', 'brown']).ohms, 330)
  t.eq('5-band encode 2.21 kΩ', encode(2210, 5, 'brown').bands, ['red', 'red', 'brown', 'brown', 'brown'])
  const r6 = decode(['red', 'red', 'black', 'brown', 'brown', 'red'])
  t.near('6-band red red black brown brown red = 2.2 kΩ', r6.ohms, 2200)
  t.near('6-band tempco red = 50 ppm/K', r6.ppm, 50)
  t.eq('0.47 Ω -> yellow violet silver', encode(0.47, 4).bands.slice(0, 3), ['yellow', 'violet', 'silver'])
  t.eq('10 Ω -> brown black black', encode(10, 4).bands.slice(0, 3), ['brown', 'black', 'black'])
  t.ok('4.75 kΩ rounds on 4 bands', encode(4750, 4).rounded)
  t.near('gold multiplier 0.1', decode(['brown', 'black', 'gold', 'gold']).ohms, 1)
  t.ok('gold is not a digit', decode(['gold', 'black', 'red', 'gold']) === null)
}
