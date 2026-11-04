/** Prime ranges and neighbours on all cores. */
import { fanOut, run } from './pool'
import type { SieveStats } from './kernels'

/** Numbers per task: short enough for smooth progress, long enough to outweigh the messaging. */
const SLICE = 2 ** 27

export interface PrimeRange {
  count: number
  twins: number
  maxGap: number
  maxGapAt: number
  /** The first `listCap` primes. */
  primes: number[]
}

/** Totals of adjacent slices, counting what straddles the seam. */
function join(a: SieveStats, b: SieveStats): SieveStats {
  if (a.count === 0) return b
  if (b.count === 0) return a
  const seam = b.first - a.last
  const [maxGap, maxGapAt] = [
    [a.maxGap, a.maxGapAt],
    [seam, a.last],
    [b.maxGap, b.maxGapAt],
  ].reduce((best, gap) => (gap[0]! > best[0]! ? gap : best)) as [number, number]
  return { count: a.count + b.count, twins: a.twins + b.twins + (seam === 2 ? 1 : 0), maxGap, maxGapAt, first: a.first, last: b.last }
}

export async function primesInRange(
  lo: number,
  hi: number,
  listCap: number,
  options: { signal?: AbortSignal; onProgress?: (fraction: number) => void } = {},
): Promise<PrimeRange> {
  const total = hi - lo + 1
  const slices = Math.ceil(total / SLICE)
  const stats: SieveStats[] = []
  let primes: number[] = []
  let started = 0
  let finished = 0

  await fanOut(() => {
    if (started === slices) return null
    const i = started++
    const from = lo + i * SLICE
    // Any full slice holds more primes than the list, so only the first one lists.
    return run('sieve', { lo: from, hi: Math.min(hi, from + SLICE - 1), cap: i === 0 ? listCap : 0 }, options).then((result) => {
      stats[i] = result.stats
      if (i === 0) primes = result.primes
      options.onProgress?.(++finished / slices)
    })
  })

  const totals = stats.reduce(join)
  return { count: totals.count, twins: totals.twins, maxGap: totals.maxGap, maxGapAt: totals.maxGapAt, primes }
}

/** Primality of a big number, and the primes either side of it within `reach`. */
export async function primeFacts(n: bigint, reach: bigint, signal?: AbortSignal) {
  const [prime, near] = await Promise.all([run('isPrime', { n }, { signal }), run('neighbours', { n, reach }, { signal })])
  return { prime, ...near }
}
