/** Simple pendulum: small-angle period, exact large-angle period, and the swing itself. Pure. */

export const RAD = Math.PI / 180

/** Arithmetic-geometric mean. */
export function agm(a: number, b: number): number {
  for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15 * a; i++) {
    const m = (a + b) / 2
    b = Math.sqrt(a * b)
    a = m
  }
  return (a + b) / 2
}

/** Small-angle period T₀ = 2π√(L/g), s. */
export function period0(L: number, g: number): number {
  return 2 * Math.PI * Math.sqrt(L / g)
}

/** Exact factor T / T₀ for an amplitude in degrees: 1 / AGM(1, cos(θ₀/2)). */
export function ampFactor(deg: number): number {
  return 1 / agm(1, Math.cos((deg * RAD) / 2))
}

/** First terms of the series 1 + θ²/16 + 11θ⁴/3072 + 173θ⁶/737280, for the working. */
export function ampSeries(deg: number): number {
  const t = deg * RAD
  return 1 + (t * t) / 16 + (11 * t ** 4) / 3072 + (173 * t ** 6) / 737280
}

/** Length for a wanted period at an amplitude: L = g (T / 2π f)². */
export function lengthFor(T: number, g: number, deg: number): number {
  return g * (T / (2 * Math.PI * ampFactor(deg))) ** 2
}

/** Speed at the bottom of the swing, √(2gL(1 − cos θ₀)). */
export function maxSpeed(L: number, g: number, deg: number): number {
  return Math.sqrt(2 * g * L * (1 - Math.cos(deg * RAD)))
}

/**
 * One RK4 step of θ'' = −(g/L) sin θ. State is [θ, ω] in radians.
 */
export function swingStep(theta: number, omega: number, k: number, dt: number): [number, number] {
  const f = (th: number) => -k * Math.sin(th)
  const k1t = omega
  const k1w = f(theta)
  const k2t = omega + (dt / 2) * k1w
  const k2w = f(theta + (dt / 2) * k1t)
  const k3t = omega + (dt / 2) * k2w
  const k3w = f(theta + (dt / 2) * k2t)
  const k4t = omega + dt * k3w
  const k4w = f(theta + dt * k3t)
  return [theta + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t), omega + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w)]
}
