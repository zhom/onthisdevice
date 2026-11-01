/**
 * Uniform randomness from the browser's CSPRNG.
 *
 * Every function here draws from `crypto.getRandomValues`. The integer helpers
 * use rejection sampling, so no value is more likely than any other — the
 * `Math.floor(Math.random() * n)` shortcut most tools use is measurably biased
 * once `n` does not divide the generator's range evenly.
 */

const pool = new Uint32Array(1)

export function randomUint32(): number {
  crypto.getRandomValues(pool)
  return pool[0]
}

/** A uniform integer in [0, bound). `bound` must be a positive integer. */
export function randomBelow(bound: number): number {
  if (!Number.isInteger(bound) || bound <= 0) {
    throw new Error('The random range must be a positive whole number.')
  }
  if (bound === 1) return 0
  if (bound <= 0x1_0000_0000) {
    // Discard the tail that would wrap unevenly.
    const limit = Math.floor(0x1_0000_0000 / bound) * bound
    let value = randomUint32()
    while (value >= limit) value = randomUint32()
    return value % bound
  }
  // Ranges wider than 2^32 need 53 bits of entropy.
  let value = Math.floor(randomFloat() * bound)
  while (value >= bound) value = Math.floor(randomFloat() * bound)
  return value
}

/** A uniform float in [0, 1) with the full 53 bits of double precision. */
export function randomFloat(): number {
  const words = new Uint32Array(2)
  crypto.getRandomValues(words)
  // 26 high bits + 27 low bits = 53, exactly the mantissa of a double.
  return ((words[0] >>> 6) * 2 ** 27 + (words[1] >>> 5)) / 2 ** 53
}

/** A uniform integer in [min, max], both inclusive. */
export function randomInt(min: number, max: number): number {
  const lo = Math.ceil(min)
  const hi = Math.floor(max)
  if (hi < lo) throw new Error('The maximum must not be smaller than the minimum.')
  return lo + randomBelow(hi - lo + 1)
}

/** A uniform float in [min, max). */
export function randomRange(min: number, max: number): number {
  return min + randomFloat() * (max - min)
}

/** Fisher–Yates, using unbiased indices. Returns a new array. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1)
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/**
 * `count` distinct integers from [min, max]. Uses a partial Fisher–Yates over
 * the whole range when the request is dense, and rejection sampling when it is
 * sparse — the second strategy would take unbounded time near saturation, and
 * the first would allocate gigabytes over a huge range.
 */
export function uniqueInts(min: number, max: number, count: number): number[] {
  const lo = Math.ceil(min)
  const hi = Math.floor(max)
  const span = hi - lo + 1
  if (count > span) {
    throw new Error(
      `You asked for ${count} different numbers but ${lo} to ${hi} only contains ${span}.`,
    )
  }

  if (span <= 5_000_000 && count > span / 8) {
    const pooled = new Int32Array(span)
    for (let i = 0; i < span; i++) pooled[i] = lo + i
    for (let i = 0; i < count; i++) {
      const j = i + randomBelow(span - i)
      const tmp = pooled[i]
      pooled[i] = pooled[j]
      pooled[j] = tmp
    }
    return Array.from(pooled.subarray(0, count))
  }

  const seen = new Set<number>()
  const out: number[] = []
  while (out.length < count) {
    const value = randomInt(lo, hi)
    if (seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}
