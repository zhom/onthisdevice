#!/usr/bin/env node
/**
 * Tests the built src/lib/engine/engine.wasm through its TypeScript bindings, against
 * independent answers: Node's crypto, brute force, the BigInt factorizer and published values.
 * The kernels have their own unit tests in rust/.
 */
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(specifier, context, next) {
    if (/^\.\.?\//.test(specifier) && !/\.\w+$/.test(specifier)) {
      const url = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(fileURLToPath(url))) return next(url.href, context)
    }
    return next(specifier, context)
  },
})

const { Kernels, MAX_BITS } = await import('../src/lib/engine/kernels.ts')
const { tasks } = await import('../src/lib/engine/tasks.ts')
const { summarize, BLOCK_YEARS, PERCENTILES } = await import('../src/lib/engine/retire.ts')
const { factorize: slowFactorize, flatFactors } = await import('../src/components/tools/calc2/primes.ts')

const wasm = readFileSync(new URL('../src/lib/engine/engine.wasm', import.meta.url))
const { instance, module } = await WebAssembly.instantiate(wasm)
assert.equal(WebAssembly.Module.imports(module).length, 0, 'the engine must have no imports')
const k = new Kernels(instance)

let passed = 0
const test = async (name, run) => {
  await run()
  passed++
  console.log(`  ok  ${name}`)
}

/** Factors with the kernels only, the way factor.ts does, on one thread. */
function factorAll(n) {
  if (n === 1n) return []
  if (k.isPrime(n)) return [n]
  const small = k.smallFactor(n)
  let f = small ? BigInt(small) : k.rho(n, 1 << 20, 1n)
  for (let seed = 1n; f === null; seed++) f = k.ecm(n, 11_000, seed)
  return [...factorAll(f), ...factorAll(n / f)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

await test('agrees with the BigInt factorizer on random numbers up to 10^18', () => {
  let x = 0x1234567n
  for (let i = 0; i < 300; i++) {
    x = (x * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n
    const n = (x % 10n ** 18n) + 2n
    assert.deepEqual(factorAll(n), flatFactors(slowFactorize(n)), String(n))
  }
})

await test('primality matches published primes and pseudoprimes', () => {
  for (const p of [2n, 3n, 2n ** 61n - 1n, 2n ** 127n - 1n, 2n ** 521n - 1n, 2n ** 607n - 1n]) assert.equal(k.isPrime(p), true, String(p))
  assert.equal(k.isPrime(2n ** 1021n - 1n), false)
  assert.equal(k.isPrime(3317044064679887385961981n), false)
  assert.equal(k.isPrime(2n ** 523n - 1n), false)
})

await test('splits a 39-digit semiprime and a 77-digit number', () => {
  assert.deepEqual(factorAll(18446744073709551533n * 18446744073709551557n), [18446744073709551533n, 18446744073709551557n])
  const n = 2n ** 256n - 1n // F0 F1 F2 F3 F4 F5 F6 F7 = 2^256 - 1
  assert.deepEqual(factorAll(n), [3n, 5n, 17n, 257n, 641n, 65537n, 274177n, 6700417n, 67280421310721n, 59649589127497217n, 5704689200685129054721n])
})

await test('reads the largest number the kernels take', () => {
  assert.equal(k.isPrime(2n ** BigInt(MAX_BITS) - 1n), false)
  assert.equal(k.smallFactor(2n ** BigInt(MAX_BITS) - 1n), 3)
})

await test('finds prime neighbours', () => {
  assert.deepEqual(tasks.neighbours(k, { n: 100n, reach: 1000n }), { prev: 97n, next: 101n })
  assert.deepEqual(tasks.neighbours(k, { n: 3n, reach: 1000n }), { prev: 2n, next: 5n })
  assert.deepEqual(tasks.neighbours(k, { n: 2n, reach: 1000n }), { prev: null, next: 3n })
  const big = 10n ** 300n
  const { prev, next } = tasks.neighbours(k, { n: big, reach: 100_000n })
  assert.ok(prev < big && next > big && k.isPrime(prev) && k.isPrime(next))
  assert.deepEqual(tasks.neighbours(k, { n: 1000n, reach: 2n }), { prev: null, next: null })
})

await test('the sieve matches published counts and joins by hand', () => {
  assert.equal(k.sieve(0, 10_000_000, 0).stats.count, 664_579)
  const { stats, primes } = k.sieve(2, 100, 1000)
  assert.deepEqual(primes.slice(0, 5), [2, 3, 5, 7, 11])
  assert.equal(stats.count, 25)
  assert.equal(stats.twins, 8)
  assert.equal(stats.maxGap, 8)
  assert.equal(stats.maxGapAt, 89)
})

await test('the sieve is exact above 2^33, where wasm usize would truncate', () => {
  for (const lo of [2 ** 33 + 1, 10_000_000_000, 2 ** 40, 10 ** 15, Number.MAX_SAFE_INTEGER - 20_000]) {
    const hi = lo + 20_000
    let expected = 0
    for (let n = BigInt(lo); n <= BigInt(hi); n++) if (k.smallFactor(n, 1024) === 0 && k.isPrime(n)) expected++
    assert.equal(k.sieve(lo, hi, 0).stats.count, expected, String(lo))
  }
})

await test('sieve slices add up to the published pi(10^10)', () => {
  const top = 10_000_000_000
  let count = 0
  for (let lo = 0; lo <= top; lo += 2 ** 27) count += k.sieve(lo, Math.min(top, lo + 2 ** 27 - 1), 0).stats.count
  assert.equal(count, 455_052_511)
})

await test('digests match Node crypto across chunks', () => {
  const data = Buffer.alloc(9 * 1024 * 1024 + 123)
  for (let i = 0; i < data.length; i++) data[i] = (i * 31) ^ (i >> 7)
  for (const [name, node] of [['MD5', 'md5'], ['SHA-1', 'sha1'], ['SHA-256', 'sha256'], ['SHA-512', 'sha512']]) {
    const state = k.hashStart(name)
    k.hashUpdate(state, data.subarray(0, 1000))
    k.hashUpdate(state, data.subarray(1000))
    assert.equal(k.hashFinish(state), createHash(node).update(data).digest('hex'), name)
  }
})

await test('a file task reads every chunk', async () => {
  const bytes = new Uint8Array(5 * 1024 * 1024).fill(7)
  const seen = []
  const digest = await tasks.hash(k, { file: new Blob([bytes]), algorithm: 'SHA-256' }, (done) => seen.push(done))
  assert.equal(digest, createHash('sha256').update(bytes).digest('hex'))
  assert.deepEqual(seen, [4 * 1024 * 1024, 5 * 1024 * 1024])
})

await test('retirement paths match a constant world exactly', () => {
  // 0.5% a month forever: every path ends at the same balance.
  const returns = new Float64Array(240).fill(0.005)
  const plan = { start: 100_000, saving: 500, spending: 1500, stocks: 1, other: 0, yearsSaving: 10, yearsRetired: 20, blockYears: BLOCK_YEARS }
  const paths = 5000
  const { hist, ruined } = k.retire(returns, plan, paths, 3n)
  const out = summarize(hist, ruined, k.retireBinFloors(), paths, 0)
  let balance = 100_000
  for (let m = 0; m < 360; m++) balance = balance * 1.005 + (m < 120 ? 500 : -1500)
  const last = out.bands[29]
  assert.equal(out.success, 1)
  assert.equal(last.length, PERCENTILES.length)
  for (const v of last) assert.ok(Math.abs(v / balance - 1) < 0.025, `${v} vs ${balance}`)
  assert.equal(k.retireSurvivors(returns, plan, paths, 3n), paths)
})

await test('ruin counts and bands agree with a brute-force month-by-month run', () => {
  let x = 7
  const rand = () => (x = (Math.imul(x, 1664525) + 1013904223) | 0) / 2 ** 32
  const returns = Float64Array.from({ length: 600 }, () => rand() * 0.2)
  const plan = { start: 200_000, saving: 0, spending: 1500, stocks: 0.7, other: 0.001, yearsSaving: 0, yearsRetired: 30, blockYears: 5 }
  const paths = 200_000
  const { hist, ruined } = k.retire(returns, plan, paths, 11n)
  const fast = summarize(hist, ruined, k.retireBinFloors(), paths, 0)
  let survive = 0
  for (let p = 0; p < paths; p++) {
    let b = plan.start
    let alive = true
    for (let m = 0; m < 360 && alive; ) {
      const from = Math.floor(((rand() + 0.5) % 1) * returns.length)
      for (let i = 0; i < 60 && m < 360 && alive; i++, m++) {
        b = b * (1 + 0.7 * returns[(from + i) % returns.length] + 0.3 * 0.001) - 1500
        alive = b >= 0
      }
    }
    if (alive) survive++
  }
  assert.ok(Math.abs(fast.success - survive / paths) < 0.01, `${fast.success} vs ${survive / paths}`)
})

await test('the survivor count equals the histogram run with the same seed', () => {
  const returns = Float64Array.from({ length: 300 }, (_, i) => ((i * 7919) % 101) / 1000 - 0.045)
  const plan = { start: 50_000, saving: 100, spending: 900, stocks: 0.6, other: 0.001, yearsSaving: 5, yearsRetired: 25, blockYears: 5 }
  const { ruined } = k.retire(returns, plan, 20_000, 5n)
  assert.equal(k.retireSurvivors(returns, plan, 20_000, 5n), 20_000 - ruined.reduce((a, b) => a + b, 0))
})

console.log(`engine: ${passed} passed`)
