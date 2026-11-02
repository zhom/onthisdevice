/**
 * Prime factorization with BigInt: trial division by small primes, a
 * Miller-Rabin test that is exact below 3.3 × 10²⁴, and Pollard's rho
 * (Brent's variant) for large factors. Pure; the tests import it.
 */

export interface PrimePower {
  p: bigint
  e: number
}

const SMALL: number[] = (() => {
  const max = 1000
  const sieve = new Uint8Array(max + 1)
  const out: number[] = []
  for (let i = 2; i <= max; i++) {
    if (sieve[i]) continue
    out.push(i)
    for (let j = i * i; j <= max; j += i) sieve[j] = 1
  }
  return out
})()

function modPow(b: bigint, e: bigint, m: bigint): bigint {
  let r = 1n
  b %= m
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m
    b = (b * b) % m
    e >>= 1n
  }
  return r
}

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b]
  return a < 0n ? -a : a
}

const MR_BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n]

/** Deterministic for n < 3.3 × 10²⁴. */
export function isPrime(n: bigint): boolean {
  if (n < 2n) return false
  for (const p of SMALL) {
    const b = BigInt(p)
    if (n === b) return true
    if (n % b === 0n) return false
  }
  let d = n - 1n
  let s = 0
  while ((d & 1n) === 0n) {
    d >>= 1n
    s++
  }
  outer: for (const a of MR_BASES) {
    let x = modPow(a, d, n)
    if (x === 1n || x === n - 1n) continue
    for (let i = 1; i < s; i++) {
      x = (x * x) % n
      if (x === n - 1n) continue outer
    }
    return false
  }
  return true
}

/** A non-trivial factor of a composite odd n (Brent). */
function rho(n: bigint): bigint {
  for (let c = 1n; ; c++) {
    const f = (v: bigint) => (v * v + c) % n
    let y = 2n
    let r = 1
    let q = 1n
    let g = 1n
    let x = 0n
    let ys = 0n
    const m = 64
    while (g === 1n) {
      x = y
      for (let i = 0; i < r; i++) y = f(y)
      let k = 0
      while (k < r && g === 1n) {
        ys = y
        const lim = Math.min(m, r - k)
        for (let i = 0; i < lim; i++) {
          y = f(y)
          q = (q * (x > y ? x - y : y - x)) % n
        }
        g = gcd(q, n)
        k += m
      }
      r *= 2
    }
    if (g === n) {
      do {
        ys = f(ys)
        g = gcd(x > ys ? x - ys : ys - x, n)
      } while (g === 1n)
    }
    if (g !== n) return g
  }
}

function collect(n: bigint, out: bigint[]): void {
  if (n === 1n) return
  if (isPrime(n)) {
    out.push(n)
    return
  }
  const d = rho(n)
  collect(d, out)
  collect(n / d, out)
}

/** Prime powers of n (n ≥ 2), smallest prime first. */
export function factorize(n: bigint): PrimePower[] {
  const primes: bigint[] = []
  let m = n
  for (const p of SMALL) {
    const b = BigInt(p)
    if (b * b > m) break
    while (m % b === 0n) {
      primes.push(b)
      m /= b
    }
  }
  if (m > 1n) collect(m, primes)
  primes.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const out: PrimePower[] = []
  for (const p of primes) {
    const last = out[out.length - 1]
    if (last && last.p === p) last.e++
    else out.push({ p, e: 1 })
  }
  return out
}

/** Every prime factor with repeats, smallest first: 360 -> 2 2 2 3 3 5. */
export function flatFactors(f: PrimePower[]): bigint[] {
  return f.flatMap(({ p, e }) => Array.from({ length: e }, () => p))
}

/** Number of divisors: the product of (exponent + 1). */
export function divisorCount(f: PrimePower[]): bigint {
  return f.reduce((acc, { e }) => acc * BigInt(e + 1), 1n)
}

/** All divisors in order, when there are at most `max` of them. */
export function divisors(f: PrimePower[], max = 200): bigint[] | null {
  if (divisorCount(f) > BigInt(max)) return null
  let out: bigint[] = [1n]
  for (const { p, e } of f) {
    const next: bigint[] = []
    for (const d of out) {
      let pk = 1n
      for (let k = 0; k <= e; k++) {
        next.push(d * pk)
        pk *= p
      }
    }
    out = next
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/** "2³ × 3² × 5" */
export function powerForm(f: PrimePower[]): string {
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
  return f.map(({ p, e }) => (e === 1 ? `${p}` : `${p}${String(e).replace(/\d/g, (c) => SUP[Number(c)] ?? c)}`)).join(' × ')
}

/** Parse a whole number 2 … 10¹⁸ from text. Spaces and commas are ignored. */
export function parseWhole(raw: string): bigint | null {
  const s = raw.trim().replace(/[,_\s]/g, '')
  if (!/^\d+$/.test(s)) return null
  return BigInt(s)
}

export const MAX_FACTOR = 10n ** 18n
