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
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { ROOT } from './search-test/loader.mjs'
import { checkEngineCase, checkFileCase } from './search-test/checks.mjs'

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
    const checked = checkEngineCase(c, (q) => searcher.search(q, { limit: 8 }), slugs)
    if (!checked) {
      // A case that names an unregistered tool waits for that tool.
      if (verbose) console.log(`  skip ${JSON.stringify(c.q)}: not registered yet`)
      continue
    }
    if (checked.problems.length) fail(`${JSON.stringify(c.q)}: ${checked.problems.join('; ')}  [${checked.shown}]`)
    else pass(`${JSON.stringify(c.q)} -> ${checked.shown}`)
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
  const files = await import('@/lib/search/files.ts')
  const { TOOLS } = await import('@/lib/tools/index.ts')
  const { CATEGORIES } = await import('@/lib/tools/types.ts')
  const { buildIndex } = await import('@/lib/search/build.ts')
  const { decodeIndex } = await import('@/lib/search/data.ts')
  const lib = { ...files, catalog: decodeIndex(buildIndex(TOOLS, CATEGORIES)) }
  console.log(`files: ${cases.length} cases`)
  for (const c of cases) {
    const { problems, shown } = await checkFileCase(c, lib)
    if (problems.length) fail(`${c.name}: ${problems.join('; ')}`)
    else pass(`${c.name} -> ${shown}`)
  }
}

if (!only || only === 'answers') await runAnswers()
if (!only || only === 'files') await runFiles()
if (!only || only === 'engine') await runEngine()
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
