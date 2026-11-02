// Projectile motion: textbook cases (no air resistance).
import { flight } from '../../src/components/tools/calc2/projectile.ts'

export default (t) => {
  // 20 m/s at 45° from the ground, g = 9.81: R = v² sin 2θ / g = 40.775 m, T = 2.883 s, H = 10.194 m.
  const a = flight({ v0: 20, angle: 45, h0: 0, g: 9.81 })
  t.near('range 20 m/s 45°', a.range, 40.775, 0.001)
  t.near('time 20 m/s 45°', a.time, 2.8832, 0.0001)
  t.near('peak 20 m/s 45°', a.peak, 10.194, 0.001)
  t.near('impact speed equals launch speed on level ground', a.impactSpeed, 20, 1e-9)
  // 10 m/s at 30°, g = 9.8: R = 100 sin 60° / 9.8 = 8.837 m.
  t.near('range 10 m/s 30°', flight({ v0: 10, angle: 30, h0: 0, g: 9.8 }).range, 8.8370, 0.0001)
  // Horizontal throw at 15 m/s from a 20 m cliff, g = 9.8: t = √(2h/g) = 2.0203 s, x = 30.305 m.
  const c = flight({ v0: 15, angle: 0, h0: 20, g: 9.8 })
  t.near('cliff time', c.time, 2.0203, 0.0001)
  t.near('cliff range', c.range, 30.305, 0.001)
  t.near('cliff impact speed √(15² + 19.8²)', c.impactSpeed, 24.840, 0.001)
}
