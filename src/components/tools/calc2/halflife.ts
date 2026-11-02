/** Exponential decay N = N₀ (½)^(t / T½), solved for any one value. Pure; the tests import it. */

export function remaining(n0: number, t: number, half: number): number {
  return n0 * Math.pow(0.5, t / half)
}

export function initial(n: number, t: number, half: number): number {
  return n / Math.pow(0.5, t / half)
}

/** t = T½ × log₂(N₀ / N). */
export function elapsed(n0: number, n: number, half: number): number {
  return half * Math.log2(n0 / n)
}

/** T½ = t ÷ log₂(N₀ / N). */
export function halfLife(n0: number, n: number, t: number): number {
  return t / Math.log2(n0 / n)
}

/** Decay constant λ = ln 2 / T½. */
export function lambda(half: number): number {
  return Math.LN2 / half
}

/** Seconds in a Julian year, the unit for half-lives in years. */
export const YEAR = 31557600

export const PRESETS = [
  { id: 'c14', label: 'Carbon-14', half: 5730, unit: 'yr' },
  { id: 'i131', label: 'Iodine-131', half: 8.02, unit: 'd' },
  { id: 'u238', label: 'Uranium-238', half: 4.468e9, unit: 'yr' },
  { id: 'rn222', label: 'Radon-222', half: 3.8235, unit: 'd' },
] as const

/**
 * Decay time of each particle for a simulation: particle i survives while
 * (½)^(t/T½) > u_i, so it decays at t_i = T½ × log₂(1/u_i). Seeded, so the
 * same inputs give the same picture.
 */
export function decayTimes(count: number, half: number, seed = 1): Float64Array {
  const out = new Float64Array(count)
  let s = seed >>> 0 || 1
  for (let i = 0; i < count; i++) {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    const u = (s + 0.5) / 4294967296
    out[i] = half * Math.log2(1 / u)
  }
  return out
}
