/** The work a worker can do. The pool names these, so one table gives both sides their types. */
import type { HashName, Kernels, RetirePlan } from './kernels'

type Progress = (done: number) => void

/** Keeps memory flat and progress smooth on a file of any size. */
const READ_CHUNK = 4 * 1024 * 1024

/** The nearest prime above (step 2) or below (step -2) odd n, within `reach`. */
function neighbour(k: Kernels, n: bigint, step: bigint, reach: bigint): bigint | null {
  const first = n + (n % 2n === 0n ? step / 2n : step)
  for (let c = first; c >= 3n && (c > n ? c - n : n - c) <= reach; c += step) {
    // A short trial division drops most candidates for far less than one Miller-Rabin round.
    if (k.smallFactor(c, 1024) === 0 && k.isPrime(c)) return c
  }
  return step < 0n && n > 2n && n - 2n <= reach ? 2n : null
}

export const tasks = {
  isPrime: (k: Kernels, a: { n: bigint }) => k.isPrime(a.n),
  smallFactor: (k: Kernels, a: { n: bigint }) => k.smallFactor(a.n),
  rho: (k: Kernels, a: { n: bigint; iterations: number; seed: bigint }) => k.rho(a.n, a.iterations, a.seed),
  ecm: (k: Kernels, a: { n: bigint; b1: number; seed: bigint }) => k.ecm(a.n, a.b1, a.seed),
  neighbours: (k: Kernels, a: { n: bigint; reach: bigint }) => ({
    prev: neighbour(k, a.n, -2n, a.reach),
    next: neighbour(k, a.n, 2n, a.reach),
  }),
  sieve: (k: Kernels, a: { lo: number; hi: number; cap: number }) => k.sieve(a.lo, a.hi, a.cap),
  hash: async (k: Kernels, a: { file: Blob; algorithm: HashName }, progress: Progress) => {
    const state = k.hashStart(a.algorithm)
    for (let at = 0; at < a.file.size; at += READ_CHUNK) {
      k.hashUpdate(state, new Uint8Array(await a.file.slice(at, at + READ_CHUNK).arrayBuffer()))
      progress(Math.min(a.file.size, at + READ_CHUNK))
    }
    return k.hashFinish(state)
  },
  firstDifference: async (_: Kernels, a: { a: Blob; b: Blob }, progress: Progress) => {
    const shared = Math.min(a.a.size, a.b.size)
    for (let at = 0; at < shared; at += READ_CHUNK) {
      const [x, y] = await Promise.all([a.a, a.b].map(async (f) => new Uint8Array(await f.slice(at, at + READ_CHUNK).arrayBuffer())))
      const i = x!.findIndex((byte, j) => byte !== y![j])
      if (i >= 0) return at + i
      progress(Math.min(shared, at + READ_CHUNK))
    }
    return null
  },
  retireBinFloors: (k: Kernels) => k.retireBinFloors(),
  retire: (k: Kernels, a: { returns: Float64Array; plan: RetirePlan; paths: number; seed: bigint }) => k.retire(a.returns, a.plan, a.paths, a.seed),
  retireSurvivors: (k: Kernels, a: { returns: Float64Array; plan: RetirePlan; paths: number; seed: bigint }) =>
    k.retireSurvivors(a.returns, a.plan, a.paths, a.seed),
}

export type Tasks = typeof tasks
export type TaskName = keyof Tasks
export type TaskArgs<N extends TaskName> = Parameters<Tasks[N]>[1]
export type TaskResult<N extends TaskName> = Awaited<ReturnType<Tasks[N]>>
