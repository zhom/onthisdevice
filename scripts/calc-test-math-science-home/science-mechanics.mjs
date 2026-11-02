// Pendulum, free fall and kinetic energy.
import { ampFactor, ampSeries, lengthFor, period0, swingStep } from '../../src/components/tools/calc2/pendulum.ts'
import { fromHeight, fromTime } from '../../src/components/tools/calc2/freefall.ts'
import { energy, massFor, speedFor } from '../../src/components/tools/calc2/kinetic.ts'

export default (t) => {
  t.near('T(L = 1 m, g = 9.80665) = 2π/√g = 2.00641 s', period0(1, 9.80665), 2.00641, 0.00001)
  t.near('30° amplitude factor 1.01741', ampFactor(30), 1.01741, 0.00001)
  t.near('90° amplitude factor 1.18034', ampFactor(90), 1.18034, 0.00001)
  t.near('series matches at 10°', ampSeries(10), ampFactor(10), 1e-7)
  t.near('L for a 2 s period (seconds pendulum) = g/π² = 0.99362 m', lengthFor(2, 9.80665, 0), 0.99362, 0.00001)
  // Integrate a 60° swing for one exact period: θ returns to 60°.
  const L = 1
  const g = 9.80665
  const T = period0(L, g) * ampFactor(60)
  let th = (60 * Math.PI) / 180
  let w = 0
  const n = 20000
  for (let i = 0; i < n; i++) [th, w] = swingStep(th, w, g / L, T / n)
  t.near('RK4 swing returns after one large-angle period', (th * 180) / Math.PI, 60, 0.001)

  const f = fromHeight(100, 9.80665)
  t.near('100 m fall time 4.5160 s', f.t, 4.5160, 0.0001)
  t.near('100 m impact speed 44.287 m/s', f.v, 44.287, 0.001)
  const f2 = fromTime(3, 9.81)
  t.near('3 s fall 44.145 m', f2.h, 44.145, 0.001)
  t.near('3 s speed 29.43 m/s', f2.v, 29.43, 1e-9)

  t.near('KE 1000 kg at 20 m/s = 200 kJ', energy(1000, 20), 200000)
  t.near('mass from KE', massFor(200000, 20), 1000)
  t.near('speed from KE', speedFor(200000, 1000), 20)
  t.near('KE 0.145 kg ball at 40 m/s = 116 J', energy(0.145, 40), 116)
}
