// Sunrise and sunset against the NOAA Global Monitoring Laboratory solar calculator
// (gml.noaa.gov/grad/solcalc, 2026 tables, local time with daylight saving). Within 2 minutes.
import { clock, sunDay, zoneOffset } from '../../src/components/tools/calc2/sun.ts'

const PLACES = {
  london: [51.4769, 0.0005, 'Europe/London'],
  nyc: [40.7128, -74.006, 'America/New_York'],
  sydney: [-33.8688, 151.2093, 'Australia/Sydney'],
  tromso: [69.6492, 18.9553, 'Europe/Oslo'],
  quito: [-0.1807, -78.4678, 'America/Guayaquil'],
}
// [place, date, sunrise, sunset] ('up' = midnight sun, 'down' = polar night)
const CASES = [
  ['london', '2026-06-21', '04:43', '21:21'],
  ['london', '2026-12-21', '08:03', '15:53'],
  ['london', '2026-03-21', '06:01', '18:15'],
  ['nyc', '2026-01-01', '07:20', '16:39'],
  ['nyc', '2026-07-15', '05:38', '20:26'],
  ['nyc', '2026-12-21', '07:17', '16:32'],
  ['sydney', '2026-01-01', '05:47', '20:09'],
  ['sydney', '2026-06-21', '07:00', '16:54'],
  ['tromso', '2026-01-15', '11:29', '12:18'],
  ['tromso', '2026-05-15', '01:43', '23:48'],
  ['tromso', '2026-06-21', 'up', 'up'],
  ['tromso', '2026-12-21', 'down', 'down'],
  ['quito', '2026-02-15', '06:24', '18:32'],
  ['quito', '2026-11-01', '05:54', '18:01'],
]
const mins = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))

export default (t) => {
  for (const [p, date, rise, set] of CASES) {
    const [lat, lon, zone] = PLACES[p]
    const [y, m, d] = date.split('-').map(Number)
    const off = zoneOffset(zone, Date.UTC(y, m - 1, d, 12) - 0)
    const day = sunDay(y, m, d, lat, lon, off)
    for (const [name, ev, want] of [['sunrise', day.sunrise, rise], ['sunset', day.sunset, set]]) {
      if (want === 'up' || want === 'down') t.eq(`${p} ${date} ${name}`, ev.kind, want)
      else if (ev.kind !== 'time') t.ok(`${p} ${date} ${name}`, false, ev.kind)
      else t.near(`${p} ${date} ${name} ${clock(ev.ms, zone)}`, mins(clock(ev.ms, zone)), mins(want), 2)
    }
  }
  t.near('London 2026-06-21 solar noon 13:01:43', (sunDay(2026, 6, 21, 51.4769, 0.0005, 60).noon - Date.UTC(2026, 5, 21, 12, 1, 43)) / 60000, 0, 0.5)
  t.near('London midsummer day length 16 h 38 min', sunDay(2026, 6, 21, 51.4769, 0.0005, 60).dayLength, 16 * 60 + 38, 2)
}
