// Moon phases: Meeus, Astronomical Algorithms, example 49.a, and published UTC times of new and
// full moons (several are eclipses, whose times are well recorded). Within 2 minutes.
import { SYNODIC, litFraction, moonAt, phaseJDE, phaseTime } from '../../src/components/tools/calc2/moon.ts'

const at = (s) => Date.parse(`${s}:00Z`)
// k: lunations since the new moon of 2000-01-06; .5 is a full moon.
const near = (t, k, iso) => {
  t.eq(`k for ${iso}`, Math.round(((at(iso) - phaseTime(0)) / 86400000 / SYNODIC) * 2) / 2, k)
  t.near(`phase k=${k} at ${iso}`, (phaseTime(k) - at(iso)) / 60000, 0, 2)
}

export default (t) => {
  t.near('Meeus 49.a new moon 1977 Feb, JDE', phaseJDE(-283), 2443192.65118, 0.00001)
  near(t, 0, '2000-01-06T18:14')
  near(t, 300, '2024-04-08T18:21') // total solar eclipse
  near(t, 306, '2024-10-02T18:49') // annular eclipse
  near(t, 323, '2026-02-17T12:01') // annular eclipse
  near(t, 329, '2026-08-12T17:37') // total solar eclipse
  near(t, 305.5, '2024-09-18T02:34') // partial lunar eclipse
  near(t, 311.5, '2025-03-14T06:55') // total lunar eclipse
  near(t, 323.5, '2026-03-03T11:38') // total lunar eclipse
  t.near('lit fraction at a new moon ≈ 0', litFraction(at('2024-04-08T18:21')), 0, 0.002)
  t.near('lit fraction at a full moon ≈ 1', litFraction(at('2025-03-14T06:55')), 1, 0.002)
  t.near('Meeus 48.a: 1992-04-12 0h TD lit 0.6786', litFraction(Date.parse('1992-04-12T00:00:00Z') - 58e3), 0.6786, 0.01)
  const m = moonAt(at('2026-11-02T12:00'))
  t.ok('2026-11-02 moon has a name', typeof m.name === 'string' && m.name.length > 3, m.name)
  t.ok('next phases in order', m.next.every((x, i) => i === 0 || x.ms > m.next[i - 1].ms))
  t.eq('2024-04-08 is a new moon', moonAt(at('2024-04-08T12:00')).name, 'New moon')
  t.eq('2025-03-14 is a full moon', moonAt(at('2025-03-14T12:00')).name, 'Full moon')
}
