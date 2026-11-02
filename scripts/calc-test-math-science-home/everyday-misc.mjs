// Day of the week, tire sizes, pixel density, download time and unit price.
import { WEEKDAYS, doomsday, isoWeek, weekday } from '../../src/components/tools/calc2/weekday.ts'
import { parseTire, tireSize, trueSpeed } from '../../src/components/tools/calc2/tire.ts'
import { aspect, screen } from '../../src/components/tools/calc2/screen.ts'
import { SIZE, SPEED, transferTime } from '../../src/components/tools/calc2/download.ts'
import { compare, perBase } from '../../src/components/tools/calc2/unitprice.ts'

export default (t) => {
  // Known dates.
  for (const [y, m, d, name] of [
    [1969, 7, 20, 'Sunday'], // Apollo 11 landing
    [2000, 1, 1, 'Saturday'],
    [1776, 7, 4, 'Thursday'],
    [1900, 1, 1, 'Monday'],
    [2024, 2, 29, 'Thursday'],
    [2026, 11, 2, 'Monday'],
    [1600, 3, 1, 'Wednesday'],
    [2100, 12, 31, 'Friday'],
  ]) {
    t.eq(`${y}-${m}-${d} weekday`, WEEKDAYS[weekday(y, m, d)], name)
    t.eq(`${y}-${m}-${d} doomsday rule`, WEEKDAYS[doomsday(y, m, d).day], name)
  }
  t.eq('doomsday of 2026 is Saturday', WEEKDAYS[doomsday(2026, 1, 1).doomsday], 'Saturday')
  t.eq('ISO week of 2026-11-02', isoWeek(2026, 11, 2), 45)
  t.eq('ISO week of 2027-01-01 is 53 of 2026', isoWeek(2027, 1, 1), 53)
  t.eq('ISO week of 2024-12-30 is 1', isoWeek(2024, 12, 30), 1)

  // Tires: overall diameter = rim × 25.4 + 2 × width × aspect / 100.
  const a = tireSize(parseTire('225/45R17'))
  t.near('225/45R17 sidewall 101.25 mm', a.sidewall, 101.25, 1e-9)
  t.near('225/45R17 diameter 634.3 mm', a.diameter, 634.3, 1e-9)
  t.near('225/45R17 diameter 24.97 in', a.diameter / 25.4, 24.97, 0.005)
  t.near('225/45R17 revs per mile 807.6', a.revsPerMile, 807.6, 0.1)
  t.near('205/55R16 diameter 631.9 mm', tireSize(parseTire('205/55 R16')).diameter, 631.9, 1e-9)
  t.near('265/70R17 diameter 31.6 in', tireSize(parseTire('P265/70R17 113T')).diameter / 25.4, 31.61, 0.01)
  t.near('true speed at 60 shown, 634.3 → 658.8 mm', trueSpeed(60, 634.3, 658.8), 62.317, 0.001)
  t.eq('bad tire code', parseTire('hello'), null)

  // Pixel density: √(w² + h²) ÷ diagonal.
  t.near('1920×1080 at 24 in = 91.79 ppi', screen(1920, 1080, 24).ppi, 91.79, 0.01)
  t.near('2560×1440 at 27 in = 108.79 ppi', screen(2560, 1440, 27).ppi, 108.79, 0.01)
  t.near('3840×2160 at 27 in = 163.18 ppi', screen(3840, 2160, 27).ppi, 163.18, 0.01)
  t.near('1170×2532 at 6.1 in = 457 ppi', screen(1170, 2532, 6.1).ppi, 457.2, 0.2)
  t.near('pitch at 91.79 ppi = 0.2767 mm', screen(1920, 1080, 24).pitch, 0.2767, 0.0001)
  t.eq('aspect 1920×1080', aspect(1920, 1080), '16 : 9')

  // Download time: bytes × 8 ÷ bits per second.
  t.near('1 GB at 100 Mbit/s = 80 s', transferTime(SIZE.GB, 100 * SPEED['Mbit/s']), 80, 1e-9)
  t.near('1 GiB at 100 Mbit/s = 85.9 s', transferTime(SIZE.GiB, 100 * SPEED['Mbit/s']), 85.899, 0.001)
  t.near('50 GB at 1 Gbit/s with 10% overhead = 444.4 s', transferTime(50 * SIZE.GB, SPEED['Gbit/s'], 0.1), 444.444, 0.001)
  t.near('700 MB at 5 MB/s = 140 s', transferTime(700 * SIZE.MB, 5 * SPEED['MB/s']), 140, 1e-9)

  // Unit price.
  const items = [
    { price: 3.99, qty: 500, unit: 'g', count: 1 },
    { price: 6.49, qty: 1, unit: 'kg', count: 1 },
    { price: 2.5, qty: 12, unit: 'oz', count: 1 },
  ]
  t.near('$3.99 / 500 g = $7.98 per kg', perBase(items[0]) * 1000, 7.98, 1e-9)
  t.near('$6.49 / 1 kg', perBase(items[1]) * 1000, 6.49, 1e-9)
  t.near('$2.50 / 12 oz = $7.35 per kg', perBase(items[2]) * 1000, 7.349, 0.001)
  const c = compare(items)
  t.eq('cheapest is the 1 kg pack', c.best, 1)
  t.near('500 g pack costs 22.96% more', c.extra[0] * 100, 22.958, 0.001)
}
