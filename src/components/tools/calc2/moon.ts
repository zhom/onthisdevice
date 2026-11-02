/**
 * Moon phases: the times of new moon, first quarter, full moon and last
 * quarter (Meeus, Astronomical Algorithms, chapter 49, accurate to about a
 * minute) and the lit fraction at any instant (chapter 48, low precision).
 * Pure; the tests import it.
 */

const RAD = Math.PI / 180
const DAY_MS = 86400000
export const SYNODIC = 29.530588861

const sin = (deg: number) => Math.sin(deg * RAD)
const cos = (deg: number) => Math.cos(deg * RAD)

/** ΔT = TT − UT in seconds (polynomials by Espenak and Meeus). */
export function deltaT(year: number): number {
  const t = year - 2000
  if (year >= 2005 && year < 2050) return 62.92 + 0.32217 * t + 0.005589 * t * t
  if (year >= 1986 && year < 2005) return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5
  if (year >= 1961 && year < 1986) {
    const u = year - 1975
    return 45.45 + 1.067 * u - u * u / 260 - u ** 3 / 718
  }
  if (year >= 2050 && year < 2150) return -20 + 32 * ((year - 1820) / 100) ** 2 - 0.5628 * (2150 - year)
  const u = (year - 1820) / 100
  return -20 + 32 * u * u
}

export type Phase = 0 | 1 | 2 | 3
export const PHASE_NAMES = ['New moon', 'First quarter', 'Full moon', 'Last quarter'] as const

/** JDE (TT) of the phase with lunation number k (integer + phase/4; k = 0 is the new moon of 2000-01-06). */
export function phaseJDE(k: number): number {
  const T = k / 1236.85
  const jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4
  const E = 1 - 0.002516 * T - 0.0000074 * T * T
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4
  const O = 124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3
  const frac = ((k % 1) + 1) % 1
  let c: number
  if (frac < 0.01 || frac > 0.99 || Math.abs(frac - 0.5) < 0.01) {
    const full = Math.abs(frac - 0.5) < 0.01
    c =
      (full ? -0.40614 : -0.4072) * sin(Mp) +
      (full ? 0.17302 : 0.17241) * E * sin(M) +
      (full ? 0.01614 : 0.01608) * sin(2 * Mp) +
      (full ? 0.01043 : 0.01039) * sin(2 * F) +
      (full ? 0.00734 : 0.00739) * E * sin(Mp - M) -
      (full ? 0.00515 : 0.00514) * E * sin(Mp + M) +
      (full ? 0.00209 : 0.00208) * E * E * sin(2 * M) -
      0.00111 * sin(Mp - 2 * F) -
      0.00057 * sin(Mp + 2 * F) +
      0.00056 * E * sin(2 * Mp + M) -
      0.00042 * sin(3 * Mp) +
      0.00042 * E * sin(M + 2 * F) +
      0.00038 * E * sin(M - 2 * F) -
      0.00024 * E * sin(2 * Mp - M) -
      0.00017 * sin(O) -
      0.00007 * sin(Mp + 2 * M) +
      0.00004 * sin(2 * Mp - 2 * F) +
      0.00004 * sin(3 * M) +
      0.00003 * sin(Mp + M - 2 * F) +
      0.00003 * sin(2 * Mp + 2 * F) -
      0.00003 * sin(Mp + M + 2 * F) +
      0.00003 * sin(Mp - M + 2 * F) -
      0.00002 * sin(Mp - M - 2 * F) -
      0.00002 * sin(3 * Mp + M) +
      0.00002 * sin(4 * Mp)
  } else {
    c =
      -0.62801 * sin(Mp) +
      0.17172 * E * sin(M) -
      0.01183 * E * sin(Mp + M) +
      0.00862 * sin(2 * Mp) +
      0.00804 * sin(2 * F) +
      0.00454 * E * sin(Mp - M) +
      0.00204 * E * E * sin(2 * M) -
      0.0018 * sin(Mp - 2 * F) -
      0.0007 * sin(Mp + 2 * F) -
      0.0004 * sin(3 * Mp) -
      0.00034 * E * sin(2 * Mp - M) +
      0.00032 * E * sin(M + 2 * F) +
      0.00032 * E * sin(M - 2 * F) -
      0.00028 * E * E * sin(Mp + 2 * M) +
      0.00027 * E * sin(2 * Mp + M) -
      0.00017 * sin(O) -
      0.00005 * sin(Mp - M - 2 * F) +
      0.00004 * sin(2 * Mp + 2 * F) -
      0.00004 * sin(Mp + M + 2 * F) +
      0.00004 * sin(Mp - 2 * M) +
      0.00003 * sin(Mp + M - 2 * F) +
      0.00003 * sin(3 * M) +
      0.00002 * sin(2 * Mp - 2 * F) +
      0.00002 * sin(Mp - M + 2 * F) -
      0.00002 * sin(3 * Mp + M)
    const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F)
    c += frac < 0.5 ? W : -W
  }
  const A = [
    [299.77 + 0.107408 * k - 0.009173 * T * T, 0.000325],
    [251.88 + 0.016321 * k, 0.000165],
    [251.83 + 26.651886 * k, 0.000164],
    [349.42 + 36.412478 * k, 0.000126],
    [84.66 + 18.206239 * k, 0.00011],
    [141.74 + 53.303771 * k, 0.000062],
    [207.14 + 2.453732 * k, 0.00006],
    [154.84 + 7.30686 * k, 0.000056],
    [34.52 + 27.261239 * k, 0.000047],
    [207.19 + 0.121824 * k, 0.000042],
    [291.34 + 1.844379 * k, 0.00004],
    [161.72 + 24.198154 * k, 0.000037],
    [239.56 + 25.513099 * k, 0.000035],
    [331.55 + 3.592518 * k, 0.000023],
  ] as const
  for (const [a, w] of A) c += w * sin(a)
  return jde + c
}

/** UTC instant (ms) of a JDE. */
export function jdeToMs(jde: number): number {
  const approx = (jde - 2440587.5) * DAY_MS
  const year = new Date(approx).getUTCFullYear()
  return approx - deltaT(year) * 1000
}

/** The phase with lunation k as a UTC instant. */
export function phaseTime(k: number): number {
  return jdeToMs(phaseJDE(k))
}

/** Lunation number (k for a new moon) of the new moon at or before an instant. */
export function lunationBefore(ms: number): number {
  const jd = ms / DAY_MS + 2440587.5
  let k = Math.floor((jd - 2451550.09766) / SYNODIC)
  while (phaseTime(k + 1) <= ms) k++
  while (phaseTime(k) > ms) k--
  return k
}

export interface MoonNow {
  /** Lit fraction of the disc, 0..1. */
  lit: number
  /** Days since the last new moon. */
  age: number
  waxing: boolean
  /** Name of the phase on this date. */
  name: string
  /** Next new moon, first quarter, full moon and last quarter (UTC ms), in time order. */
  next: { phase: Phase; ms: number }[]
  lastNew: number
}

/** Lit fraction from the phase angle (Meeus 48.4 with the main periodic terms). */
export function litFraction(ms: number): number {
  const jde = ms / DAY_MS + 2440587.5 + deltaT(new Date(ms).getUTCFullYear()) / 86400
  const T = (jde - 2451545) / 36525
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T ** 3 / 545868 - T ** 4 / 113065000
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T ** 3 / 24490000
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T ** 3 / 69699 - T ** 4 / 14712000
  const i = 180 - D - 6.289 * sin(Mp) + 2.1 * sin(M) - 1.274 * sin(2 * D - Mp) - 0.658 * sin(2 * D) - 0.214 * sin(2 * Mp) - 0.11 * sin(D)
  return (1 + cos(i)) / 2
}

export function moonAt(ms: number): MoonNow {
  const k = lunationBefore(ms)
  const lastNew = phaseTime(k)
  const age = (ms - lastNew) / DAY_MS
  const fullMs = phaseTime(k + 0.5)
  const waxing = ms < fullMs
  const lit = litFraction(ms)
  const next: MoonNow['next'] = []
  for (let q = 1; q <= 4; q++) {
    const kk = k + q / 4
    const t = phaseTime(kk)
    const at = t <= ms ? phaseTime(kk + 1) : t
    next.push({ phase: (q % 4) as Phase, ms: at })
  }
  next.sort((a, b) => a.ms - b.ms)
  // Named phases cover the day around the exact moment; the rest are crescents and gibbous moons.
  const near = [0, 0.25, 0.5, 0.75, 1].map((q) => ({ q, d: Math.abs(ms - phaseTime(k + q)) / DAY_MS }))
  const hit = near.find((x) => x.d < 0.5)
  const name = hit
    ? PHASE_NAMES[Math.round(hit.q * 4) % 4]!
    : lit < 0.5
      ? waxing
        ? 'Waxing crescent'
        : 'Waning crescent'
      : waxing
        ? 'Waxing gibbous'
        : 'Waning gibbous'
  return { lit, age, waxing, name, next, lastNew }
}
