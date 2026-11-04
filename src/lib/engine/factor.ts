/**
 * Factors numbers of up to MAX_BITS bits. Rho finds small factors. The elliptic curve
 * method finds the rest, and its time depends on the size of the factor, not of the
 * number. Curves are independent, so all cores race, and the first factor ends the race.
 */
import { MAX_BITS } from './kernels'
import { fanOut, run } from './pool'

export { MAX_BITS }

export interface PrimePower {
  p: bigint
  e: number
}

export interface FactorState {
  /** Primes found so far, smallest first, with repeats. */
  primes: bigint[]
  /** A composite part that is still being split, or 1. */
  rest: bigint
  /** The curves in progress find factors of about this many digits. */
  digits: number
}

/** Curves that find most factors of the given size. The last level runs until stopped. */
const LEVELS = [
  { digits: 15, b1: 2_000, curves: 25 },
  { digits: 20, b1: 11_000, curves: 90 },
  { digits: 25, b1: 50_000, curves: 300 },
  { digits: 30, b1: 250_000, curves: 700 },
  { digits: 35, b1: 1_000_000, curves: Infinity },
]

/** Enough to find any factor of 8 or 9 digits in a few milliseconds. */
const RHO_ITERATIONS = 1 << 16

function integerRoot(n: bigint, k: bigint): bigint {
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / Number(k)))
  for (;;) {
    const y = ((k - 1n) * x + n / x ** (k - 1n)) / k
    if (y >= x) return x
    x = y
  }
}

function perfectPower(n: bigint): bigint | null {
  for (const k of [2n, 3n, 5n, 7n]) {
    const r = integerRoot(n, k)
    if (r ** k === n) return r
  }
  return null
}

/** One non-trivial factor of composite c, from a race on all cores. */
async function split(c: bigint, signal: AbortSignal, onLevel: (digits: number) => void): Promise<bigint> {
  const small = await run('smallFactor', { n: c }, { signal })
  if (small > 1) return BigInt(small)
  const root = perfectPower(c)
  if (root) return root
  const rho = await run('rho', { n: c, iterations: RHO_ITERATIONS, seed: 1n }, { signal })
  if (rho) return rho

  const race = new AbortController()
  const stop = () => race.abort(signal.reason)
  signal.addEventListener('abort', stop, { once: true })
  let seed = 0n
  let level = 0
  let tried = 0
  let found: bigint | null = null
  onLevel(LEVELS[0]!.digits)
  try {
    await fanOut(() => {
      if (found !== null || race.signal.aborted) return null
      const current = LEVELS[level]!
      if (++tried > current.curves) {
        level += 1
        tried = 1
        onLevel(LEVELS[level]!.digits)
      }
      return run('ecm', { n: c, b1: LEVELS[level]!.b1, seed: ++seed }, { signal: race.signal }).then(
        (factor) => {
          if (factor === null) return
          found = factor
          race.abort()
        },
        (cause: unknown) => {
          if (found === null) throw cause
        },
      )
    })
  } finally {
    signal.removeEventListener('abort', stop)
  }
  if (found === null) throw signal.reason
  return found
}

function byValue(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Primes of n (n ≥ 2) with repeats, smallest first. `onState` reports partial results. */
export async function factorize(n: bigint, signal: AbortSignal, onState: (state: FactorState) => void): Promise<bigint[]> {
  const primes: bigint[] = []
  const stack = [n]
  const rest = () => stack.reduce((a, b) => a * b, 1n)
  while (stack.length > 0) {
    const c = stack.pop()!
    if (c === 1n) continue
    if (await run('isPrime', { n: c }, { signal })) {
      primes.push(c)
      primes.sort(byValue)
      onState({ primes: [...primes], rest: rest(), digits: 0 })
      continue
    }
    const known = rest()
    const factor = await split(c, signal, (digits) => onState({ primes: [...primes], rest: known * c, digits }))
    stack.push(c / factor, factor)
  }
  return primes
}

/** Prime powers from a sorted list of primes. */
export function powers(primes: bigint[]): PrimePower[] {
  const out: PrimePower[] = []
  for (const p of primes) {
    const last = out[out.length - 1]
    if (last?.p === p) last.e++
    else out.push({ p, e: 1 })
  }
  return out
}

export function fitsEngine(n: bigint): boolean {
  return n.toString(2).length <= MAX_BITS
}
