/**
 * Sunrise, sunset and the sun's path with the NOAA solar calculator
 * equations (after Meeus, Astronomical Algorithms). Times are UTC instants;
 * the page formats them in a time zone. Pure; the tests import it.
 */

const RAD = Math.PI / 180
const DAY_MS = 86400000

/** Julian day of a UTC instant (ms since 1970). */
export function julianDay(ms: number): number {
  return ms / DAY_MS + 2440587.5
}

export interface SunState {
  /** Declination, degrees. */
  decl: number
  /** Equation of time, minutes. */
  eqTime: number
}

/** Declination and equation of time at a UTC instant. */
export function sunState(ms: number): SunState {
  const T = (julianDay(ms) - 2451545) / 36525
  const L0 = (((280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360) + 360) % 360
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T)
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)
  const C =
    Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * RAD) * 0.000289
  const omega = 125.04 - 1934.136 * T
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD)
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD)
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) / RAD
  const y = Math.tan((eps / 2) * RAD) ** 2
  const eqTime =
    (4 / RAD) *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD))
  return { decl, eqTime }
}

/** Solar elevation in degrees at a UTC instant (no refraction). */
export function elevation(ms: number, lat: number, lon: number): number {
  const { decl, eqTime } = sunState(ms)
  const d = new Date(ms)
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + d.getUTCMilliseconds() / 60000
  const tst = minutes + eqTime + 4 * lon
  const ha = tst / 4 - 180
  const s = Math.sin(lat * RAD) * Math.sin(decl * RAD) + Math.cos(lat * RAD) * Math.cos(decl * RAD) * Math.cos(ha * RAD)
  return Math.asin(Math.max(-1, Math.min(1, s))) / RAD
}

/** The sun's centre is 0.833° below the horizon at sunrise (refraction + radius). */
export const SUNRISE_ZENITH = 90.833

export type Event = { kind: 'time'; ms: number } | { kind: 'up' } | { kind: 'down' }

export interface SunDay {
  noon: number
  sunrise: Event
  sunset: Event
  /** Civil twilight: the sun 6° below the horizon. */
  dawn: Event
  dusk: Event
  /** Minutes of daylight (0 in polar night, 1440 in polar day). */
  dayLength: number
  /** Elevation at solar noon, degrees (no refraction). */
  noonElevation: number
  decl: number
  eqTime: number
}

/**
 * The sun on a local calendar date (y, m 1-12, d) at lat/lon (east
 * positive). `offsetMin` is the place's UTC offset that day, so the events
 * fall on that local date. Each event is refined three times with the sun's
 * position at the event itself, as the NOAA calculator does.
 */
export function sunDay(y: number, m: number, d: number, lat: number, lon: number, offsetMin = Math.round(lon * 4)): SunDay {
  const day0 = Date.UTC(y, m - 1, d)
  const localNoon = day0 + (720 - offsetMin) * 60000
  // Solar noon repeats every day; take the one nearest local clock noon.
  const raw = day0 + (720 - 4 * lon - sunState(localNoon).eqTime) * 60000
  const shift = Math.round((localNoon - raw) / DAY_MS) * DAY_MS
  const noonAt = (t: number) => day0 + shift + (720 - 4 * lon - sunState(t).eqTime) * 60000
  let noon = raw + shift
  for (let i = 0; i < 2; i++) noon = noonAt(noon)

  const event = (zenith: number, rising: boolean): Event => {
    let t = noon
    for (let i = 0; i < 3; i++) {
      const { decl } = sunState(t)
      const c = Math.cos(zenith * RAD) / (Math.cos(lat * RAD) * Math.cos(decl * RAD)) - Math.tan(lat * RAD) * Math.tan(decl * RAD)
      if (c < -1) return { kind: 'up' }
      if (c > 1) return { kind: 'down' }
      const ha = Math.acos(c) / RAD
      t = noonAt(t) + (rising ? -4 : 4) * ha * 60000
    }
    return { kind: 'time', ms: t }
  }
  const sunrise = event(SUNRISE_ZENITH, true)
  const sunset = event(SUNRISE_ZENITH, false)
  const s = sunState(noon)
  const dayLength = sunrise.kind === 'time' && sunset.kind === 'time' ? (sunset.ms - sunrise.ms) / 60000 : sunrise.kind === 'up' ? 1440 : 0
  return { noon, sunrise, sunset, dawn: event(96, true), dusk: event(96, false), dayLength, noonElevation: 90 - Math.abs(lat - s.decl), decl: s.decl, eqTime: s.eqTime }
}

/** UTC offset in minutes of an IANA time zone at an instant (east positive). */
export function zoneOffset(zone: string, ms: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(ms))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000)
}

/** "06:42" in a time zone, rounded to the nearest minute. */
export function clock(ms: number, zone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms + 30000))
}
