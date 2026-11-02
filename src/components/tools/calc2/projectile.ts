/** Projectile motion without air resistance. Pure; the tests import it. */

export interface Launch {
  /** Launch speed, m/s. */
  v0: number
  /** Launch angle above the horizontal, degrees (-90..90). */
  angle: number
  /** Launch height above the landing ground, m (>= 0). */
  h0: number
  /** Gravitational acceleration, m/s² (> 0). */
  g: number
}

export interface Flight {
  vx: number
  vy: number
  /** Time to land, s. */
  time: number
  /** Horizontal distance at landing, m. */
  range: number
  /** Highest point above the ground, m. */
  peak: number
  /** Time of the highest point, s (0 when launched downward). */
  tPeak: number
  /** Speed at landing, m/s. */
  impactSpeed: number
  /** Angle below the horizontal at landing, degrees. */
  impactAngle: number
}

export const RAD = Math.PI / 180

export function flight({ v0, angle, h0, g }: Launch): Flight {
  const vx = v0 * Math.cos(angle * RAD)
  const vy = v0 * Math.sin(angle * RAD)
  const time = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g
  const range = vx * time
  const tPeak = vy > 0 ? vy / g : 0
  const peak = h0 + (vy > 0 ? (vy * vy) / (2 * g) : 0)
  const vyEnd = vy - g * time
  return {
    vx,
    vy,
    time,
    range,
    peak,
    tPeak,
    impactSpeed: Math.hypot(vx, vyEnd),
    impactAngle: Math.atan2(-vyEnd, vx) / RAD,
  }
}

/** Position (m) and velocity (m/s) at time t. */
export function stateAt(l: Launch, f: Flight, t: number): { x: number; y: number; vx: number; vy: number } {
  return { x: f.vx * t, y: l.h0 + f.vy * t - 0.5 * l.g * t * t, vx: f.vx, vy: f.vy - l.g * t }
}
