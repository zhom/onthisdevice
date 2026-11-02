/** Free fall from rest without air resistance. Pure; the tests import it. */

export interface Fall {
  /** Drop height, m. */
  h: number
  /** Fall time, s. */
  t: number
  /** Speed at impact, m/s. */
  v: number
  /** Average speed, m/s. */
  avg: number
}

/** From a height: t = √(2h/g), v = g t. */
export function fromHeight(h: number, g: number): Fall {
  const t = Math.sqrt((2 * h) / g)
  return { h, t, v: g * t, avg: h / t }
}

/** From a time: h = ½ g t², v = g t. */
export function fromTime(t: number, g: number): Fall {
  const h = 0.5 * g * t * t
  return { h, t, v: g * t, avg: t > 0 ? h / t : 0 }
}

/** From an impact speed: t = v / g, h = v² / 2g. */
export function fromSpeed(v: number, g: number): Fall {
  const t = v / g
  return { h: (v * v) / (2 * g), t, v, avg: v / 2 }
}

/** Distance fallen after time s. */
export function fallen(g: number, s: number): number {
  return 0.5 * g * s * s
}
