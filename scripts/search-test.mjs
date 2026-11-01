#!/usr/bin/env node
/**
 * Unit tests for on-device search: the engine (src/lib/search) and the instant answers
 * (src/lib/search/answers). Runs the TypeScript sources directly with Node's type stripping.
 *
 *   node scripts/search-test.mjs            all cases + timing
 *   node scripts/search-test.mjs answers    answer cases only
 *   node scripts/search-test.mjs engine     engine cases only
 *   node scripts/search-test.mjs files      file detection cases only
 *   node scripts/search-test.mjs -v         print every case
 */
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

// Resolve `@/x` to src/x and extensionless relative imports inside src, as Vite does.
registerHooks({
  resolve(spec, ctx, next) {
    let target = null
    if (spec.startsWith('@/')) target = path.join(SRC, spec.slice(2))
    else if (/^\.\.?\//.test(spec) && ctx.parentURL?.startsWith(pathToFileURL(SRC).href)) {
      target = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec)
    }
    if (target) {
      if (/\.(ts|tsx|mjs|js)$/.test(target) && existsSync(target)) {
        return { url: pathToFileURL(target).href, shortCircuit: true }
      }
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        if (existsSync(target + ext)) return { url: pathToFileURL(target + ext).href, shortCircuit: true }
      }
    }
    return next(spec, ctx)
  },
})

const args = process.argv.slice(2)
const verbose = args.includes('-v')
const only = args.find((a) => a === 'answers' || a === 'engine' || a === 'files')

let failed = 0
let passed = 0
const fail = (msg) => {
  failed++
  console.log(`  FAIL ${msg}`)
}
const pass = (msg) => {
  passed++
  if (verbose) console.log(`  ok   ${msg}`)
}

const match = (actual, expected) =>
  expected instanceof RegExp ? expected.test(actual ?? '') : actual === expected

/* ───────────────────────────── answers ───────────────────────────── */

async function runAnswers() {
  const file = path.join(ROOT, 'scripts/search-test/answers.mjs')
  if (!existsSync(file)) return console.log('answers: no cases yet')
  const { cases, NOW } = await import(pathToFileURL(file).href)
  const { getAnswer } = await import('@/lib/search/answers/index.ts')
  console.log(`answers: ${cases.length} cases`)
  for (const c of cases) {
    const got = getAnswer(c.q, NOW)
    const shown = got ? `${got.kind} ${JSON.stringify(got.value)} -> ${got.slug}` : 'null'
    if (c.none) {
      if (got) fail(`${JSON.stringify(c.q)} expected no answer, got ${shown}`)
      else pass(`${JSON.stringify(c.q)} -> null`)
      continue
    }
    if (!got) {
      fail(`${JSON.stringify(c.q)} expected an answer, got null`)
      continue
    }
    const problems = []
    if (c.value !== undefined && !match(got.value, c.value)) problems.push(`value ${JSON.stringify(got.value)} != ${c.value}`)
    if (c.slug !== undefined && got.slug !== c.slug) problems.push(`slug ${got.slug} != ${c.slug}`)
    if (c.kind !== undefined && got.kind !== c.kind) problems.push(`kind ${got.kind} != ${c.kind}`)
    if (problems.length) fail(`${JSON.stringify(c.q)}: ${problems.join('; ')}`)
    else pass(`${JSON.stringify(c.q)} -> ${shown}`)
  }
  // Speed: every prefix of every case, in CPU time.
  const c0 = process.cpuUsage()
  let n = 0
  for (const c of cases) for (let i = 1; i <= c.q.length; i++, n++) getAnswer(c.q.slice(0, i), NOW)
  const c1 = process.cpuUsage(c0)
  const per = (c1.user + c1.system) / 1000 / n
  console.log(`answers: ${n} prefix calls, ${per.toFixed(3)} ms each`)
  if (per > 1) fail(`answers too slow: ${per.toFixed(3)} ms per call`)
}

/* ───────────────────────────── engine ───────────────────────────── */

async function runEngine() {
  const file = path.join(ROOT, 'scripts/search-test/engine.mjs')
  if (!existsSync(file)) return console.log('engine: no cases yet')
  const { cases } = await import(pathToFileURL(file).href)
  const { TOOLS } = await import('@/lib/tools/index.ts')
  const { CATEGORIES } = await import('@/lib/tools/types.ts')
  const { buildIndex } = await import('@/lib/search/build.ts')
  const { createSearcher } = await import('@/lib/search/engine.ts')
  const index = buildIndex(TOOLS, CATEGORIES)
  const json = JSON.stringify(index)
  console.log(`engine: ${TOOLS.length} tools, index ${(json.length / 1024).toFixed(1)} KB raw`)
  const c0 = process.cpuUsage()
  const searcher = createSearcher(JSON.parse(json))
  const c1 = process.cpuUsage(c0)
  console.log(`engine: searcher built in ${((c1.user + c1.system) / 1000).toFixed(1)} ms CPU`)
  const slugs = new Set(TOOLS.map((t) => t.slug))
  console.log(`engine: ${cases.length} cases`)

  for (const c of cases) {
    const skip = [c.top, c.in].flat().filter(Boolean).filter((s) => !slugs.has(s))
    if (skip.length && !c.top?.length) {
      // A case that names an unregistered tool waits for that tool.
      if (verbose) console.log(`  skip ${JSON.stringify(c.q)}: ${skip.join(', ')} not registered`)
      continue
    }
    const r = searcher.search(c.q, { limit: 8 })
    const got = r.tools.map((h) => h.tool.slug)
    const problems = []
    if (c.top) {
      const tops = [c.top].flat().filter((s) => slugs.has(s))
      if (tops.length && !tops.includes(got[0])) problems.push(`top ${got[0]} not in [${tops.join(', ')}]`)
    }
    if (c.in) {
      const within = c.within ?? 5
      for (const s of c.in) if (slugs.has(s) && !got.slice(0, within).includes(s)) problems.push(`${s} not in top ${within}`)
    }
    if (c.notIn) for (const s of c.notIn) if (got.slice(0, 5).includes(s)) problems.push(`${s} in top 5`)
    if (c.empty && got.length) problems.push(`expected no tools, got ${got.length}`)
    if (c.dym !== undefined && r.didYouMean !== c.dym) problems.push(`didYouMean ${JSON.stringify(r.didYouMean)} != ${JSON.stringify(c.dym)}`)
    if (c.complete !== undefined && !match(r.completion, c.complete)) problems.push(`completion ${JSON.stringify(r.completion)} != ${c.complete}`)
    if (c.cat !== undefined && ![c.cat].flat().includes(r.categories[0]?.category.slug)) problems.push(`category ${r.categories[0]?.category.slug} != ${c.cat}`)
    const shown = got.slice(0, 4).join(', ')
    if (problems.length) fail(`${JSON.stringify(c.q)}: ${problems.join('; ')}  [${shown}]`)
    else pass(`${JSON.stringify(c.q)} -> ${shown}`)
  }

  // Speed: every prefix of every query, as if typed one key at a time, on a cold searcher.
  // CPU time, not wall time: other jobs on the machine must not fail the test.
  const cold = createSearcher(JSON.parse(json))
  const queries = cases.map((c) => c.q)
  let n = 0
  const walls = []
  const cpu0 = process.cpuUsage()
  for (const q of queries) {
    for (let i = 1; i <= q.length; i++, n++) {
      const s = performance.now()
      cold.search(q.slice(0, i), { limit: 8 })
      walls.push(performance.now() - s)
    }
  }
  const cpu = process.cpuUsage(cpu0)
  const per = (cpu.user + cpu.system) / 1000 / n
  walls.sort((a, b) => a - b)
  console.log(`engine: ${n} keystrokes, ${per.toFixed(3)} ms CPU mean, ${walls[Math.floor(n * 0.5)].toFixed(3)} ms wall median`)
  if (per > 5) fail(`engine too slow: ${per.toFixed(3)} ms per keystroke`)
}

/* ───────────────────────────── files ───────────────────────────── */

async function runFiles() {
  const { cases } = await import(pathToFileURL(path.join(ROOT, 'scripts/search-test/files.mjs')).href)
  const { detectFile, toolsForFile } = await import('@/lib/search/files.ts')
  const { TOOLS } = await import('@/lib/tools/index.ts')
  const { CATEGORIES } = await import('@/lib/tools/types.ts')
  const { buildIndex } = await import('@/lib/search/build.ts')
  const { decodeIndex } = await import('@/lib/search/data.ts')
  const catalog = decodeIndex(buildIndex(TOOLS, CATEGORIES))
  console.log(`files: ${cases.length} cases`)
  for (const c of cases) {
    const parts = [c.bytes ?? new TextEncoder().encode(c.text)]
    if (c.tail) parts.push(new Uint8Array(200), new TextEncoder().encode(c.tail))
    const kind = await detectFile(new File(parts, c.name))
    const top = toolsForFile(catalog, kind)[0]?.tool.slug
    const problems = []
    if (kind.ext !== c.ext) problems.push(`ext ${kind.ext} != ${c.ext}`)
    if (c.top && ![c.top].flat().includes(top)) problems.push(`top ${top} not in [${[c.top].flat().join(', ')}]`)
    if (problems.length) fail(`${c.name}: ${problems.join('; ')}`)
    else pass(`${c.name} -> ${kind.ext} (${kind.label}) -> ${top ?? 'none'}`)
  }
}

if (!only || only === 'answers') await runAnswers()
if (!only || only === 'files') await runFiles()
if (!only || only === 'engine') await runEngine()
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
