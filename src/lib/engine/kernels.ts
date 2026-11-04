/**
 * Typed calls into engine.wasm (source: rust/). One instance per worker. Every call is
 * short on purpose: V8 cannot swap optimized code into a running wasm call, so one long
 * call stays in baseline code, which is 3 to 8 times slower. Callers slice the work.
 */

interface Exports {
  memory: WebAssembly.Memory
  mem_alloc(len: number): number
  small_factor(n: number, limbs: number, limit: number): number
  is_prime(n: number, limbs: number): number
  rho(n: number, limbs: number, iterations: number, seed: bigint, out: number): number
  ecm(n: number, limbs: number, b1: number, curves: number, seed: bigint, out: number): number
  sieve(lo: bigint, hi: bigint, list: number, cap: number, stats: number): void
  hash_new(id: number): number
  hash_update(state: number, data: number, len: number): void
  hash_finish(state: number, out: number): number
  retire_bins(): number
  retire_bin_floor(i: number): number
  retire(returns: number, months: number, plan: number, paths: number, seed: bigint, hist: number, ruined: number): void
  retire_survivors(returns: number, months: number, plan: number, paths: number, seed: bigint): number
}

/** The largest number the big-number kernels take. */
export const MAX_BITS = 1024
const LIMBS = MAX_BITS / 32
const STATS_WORDS = 6
const SCRATCH = 4 * 1024 * 1024

export const HASHES = { MD5: 0, 'SHA-1': 1, 'SHA-256': 2, 'SHA-512': 3, CRC32: 4, 'SHA-384': 5 } as const
export type HashName = keyof typeof HASHES

export interface SieveStats {
  count: number
  twins: number
  maxGap: number
  maxGapAt: number
  first: number
  last: number
}

export interface RetirePlan {
  /** Savings today. */
  start: number
  /** Added each month until retirement. */
  saving: number
  /** Taken each month in retirement. */
  spending: number
  /** Share of the portfolio in stocks, 0 to 1. */
  stocks: number
  /** Monthly real return on the rest. */
  other: number
  yearsSaving: number
  yearsRetired: number
  blockYears: number
}

export class Kernels {
  private readonly e: Exports
  private readonly num: number
  private readonly out: number
  private readonly bytes: number
  private readonly planAt: number
  private readonly list = { at: 0, bytes: 0 }
  private readonly returns = { at: 0, bytes: 0 }
  private readonly hist = { at: 0, bytes: 0 }
  private readonly ruined = { at: 0, bytes: 0 }

  constructor(instance: WebAssembly.Instance) {
    this.e = instance.exports as unknown as Exports
    this.num = this.e.mem_alloc(LIMBS * 4)
    this.out = this.e.mem_alloc(LIMBS * 4)
    this.bytes = this.e.mem_alloc(SCRATCH)
    this.planAt = this.e.mem_alloc(64)
  }

  /** Grows a reusable buffer. The old block is left behind: sizes settle after one run. */
  private fit(slot: { at: number; bytes: number }, bytes: number): number {
    if (slot.bytes < bytes) {
      slot.at = this.e.mem_alloc(bytes)
      slot.bytes = bytes
    }
    return slot.at
  }

  /** Writes n to the input slot and returns its length in limbs. */
  private put(n: bigint): number {
    const view = new Uint32Array(this.e.memory.buffer, this.num, LIMBS).fill(0)
    let limbs = 0
    for (let v = n; v > 0n; v >>= 32n) view[limbs++] = Number(v & 0xffffffffn)
    return limbs
  }

  private factorOut(): bigint {
    const view = new Uint32Array(this.e.memory.buffer, this.out, LIMBS)
    let v = 0n
    for (let i = LIMBS - 1; i >= 0; i--) v = (v << 32n) | BigInt(view[i]!)
    return v
  }

  /** The smallest prime factor below `limit` (at most 2^16), or 0. */
  smallFactor(n: bigint, limit = 1 << 16): number {
    return this.e.small_factor(this.num, this.put(n), limit)
  }

  isPrime(n: bigint): boolean {
    return this.e.is_prime(this.num, this.put(n)) !== 0
  }

  /** A factor of odd composite n by Pollard rho, or null. */
  rho(n: bigint, iterations: number, seed: bigint): bigint | null {
    return this.e.rho(this.num, this.put(n), iterations, seed, this.out) ? this.factorOut() : null
  }

  /** A factor of odd composite n from one elliptic curve, or null. */
  ecm(n: bigint, b1: number, seed: bigint): bigint | null {
    return this.e.ecm(this.num, this.put(n), b1, 1, seed, this.out) ? this.factorOut() : null
  }

  /** Primes in lo..=hi: the first `cap` of them and the totals. */
  sieve(lo: number, hi: number, cap: number): { stats: SieveStats; primes: number[] } {
    const listAt = this.fit(this.list, (cap + STATS_WORDS) * 8)
    const statsAt = listAt + cap * 8
    this.e.sieve(BigInt(lo), BigInt(hi), listAt, cap, statsAt)
    const s = new BigUint64Array(this.e.memory.buffer, statsAt, STATS_WORDS)
    const stats = {
      count: Number(s[0]),
      twins: Number(s[1]),
      maxGap: Number(s[2]),
      maxGapAt: Number(s[3]),
      first: Number(s[4]),
      last: Number(s[5]),
    }
    const shown = Math.min(cap, stats.count)
    return { stats, primes: Array.from(new BigUint64Array(this.e.memory.buffer, listAt, shown), Number) }
  }

  hashStart(name: HashName): number {
    return this.e.hash_new(HASHES[name])
  }

  hashUpdate(state: number, bytes: Uint8Array): void {
    for (let at = 0; at < bytes.length; at += SCRATCH) {
      const part = bytes.subarray(at, at + SCRATCH)
      new Uint8Array(this.e.memory.buffer, this.bytes, SCRATCH).set(part)
      this.e.hash_update(state, this.bytes, part.length)
    }
  }

  hashFinish(state: number): string {
    const len = this.e.hash_finish(state, this.bytes)
    const digest = new Uint8Array(this.e.memory.buffer, this.bytes, len)
    return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
  }

  private planArgs(returns: Float64Array, plan: RetirePlan): void {
    new Float64Array(this.e.memory.buffer, this.fit(this.returns, returns.length * 8), returns.length).set(returns)
    const v = new DataView(this.e.memory.buffer, this.planAt, 64)
    ;[plan.start, plan.saving, plan.spending, plan.stocks, plan.other].forEach((x, i) => v.setFloat64(i * 8, x, true))
    ;[plan.yearsSaving, plan.yearsRetired, plan.blockYears].forEach((x, i) => v.setUint32(40 + i * 4, x, true))
  }

  retireBinFloors(): Float64Array {
    const bins = this.e.retire_bins()
    return Float64Array.from({ length: bins + 1 }, (_, i) => this.e.retire_bin_floor(i))
  }

  /** `paths` paths: balances by year (years x bins) and ruined paths by year. */
  retire(returns: Float64Array, plan: RetirePlan, paths: number, seed: bigint): { hist: Uint32Array; ruined: Uint32Array } {
    const years = plan.yearsSaving + plan.yearsRetired
    const cells = years * this.e.retire_bins()
    this.planArgs(returns, plan)
    const histAt = this.fit(this.hist, cells * 4)
    const ruinedAt = this.fit(this.ruined, years * 4)
    new Uint8Array(this.e.memory.buffer, histAt, cells * 4).fill(0)
    new Uint8Array(this.e.memory.buffer, ruinedAt, years * 4).fill(0)
    this.e.retire(this.returns.at, returns.length, this.planAt, paths, seed, histAt, ruinedAt)
    return {
      hist: new Uint32Array(this.e.memory.buffer, histAt, cells).slice(),
      ruined: new Uint32Array(this.e.memory.buffer, ruinedAt, years).slice(),
    }
  }

  /** How many of `paths` paths never run out. */
  retireSurvivors(returns: Float64Array, plan: RetirePlan, paths: number, seed: bigint): number {
    this.planArgs(returns, plan)
    return this.e.retire_survivors(this.returns.at, returns.length, this.planAt, paths, seed)
  }
}
