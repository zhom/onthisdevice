#!/usr/bin/env node
/**
 * Search by meaning, with the real model (public/models, from scripts/vendor-models.mjs):
 * - top-1 and top-3 accuracy on natural-language queries (scripts/search-test/semantic.mjs),
 *   words only vs words plus meaning;
 * - every engine and file case (scripts/search-test/engine.mjs, files.mjs) must still pass
 *   with meaning on;
 * - speed of a query with meaning, in CPU time.
 *
 *   node scripts/search-semantic-test.mjs        summary
 *   node scripts/search-semantic-test.mjs -v     every query that misses its top 3
 */
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { ROOT } from './search-test/loader.mjs'
import { checkEngineCase, checkFileCase } from './search-test/checks.mjs'

const verbose = process.argv.includes('-v')
const load = (file) => import(pathToFileURL(path.join(ROOT, file)).href)

const { cases: semanticCases } = await load('scripts/search-test/semantic.mjs')
const { cases: engineCases } = await load('scripts/search-test/engine.mjs')
const { cases: fileCases } = await load('scripts/search-test/files.mjs')
const { TOOLS } = await import('@/lib/tools/index.ts')
const { CATEGORIES } = await import('@/lib/tools/types.ts')
const { buildIndex, buildVectors, loadEmbedder } = await import('@/lib/search/build.ts')
const { createSearcher } = await import('@/lib/search/engine.ts')
const { parseVectors } = await import('@/lib/search/semantic/format.ts')
const { similarities } = await import('@/lib/search/semantic/embed.ts')
const files = await import('@/lib/search/files.ts')
const { decodeIndex } = await import('@/lib/search/data.ts')

let failed = 0
const fail = (msg) => {
  failed++
  console.log(`  FAIL ${msg}`)
}

const slugs = new Set(TOOLS.map((t) => t.slug))
const searcher = createSearcher(JSON.parse(JSON.stringify(buildIndex(TOOLS, CATEGORIES))))
const t0 = process.cpuUsage()
const embedder = loadEmbedder(ROOT)
const packed = buildVectors(TOOLS, embedder)
const t1 = process.cpuUsage(t0)
const vectors = parseVectors(packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength))
console.log(
  `model: ${embedder.dims} dims; ${TOOLS.length} tool vectors (${(packed.length / 1024).toFixed(0)} KB) in ${((t1.user + t1.system) / 1000).toFixed(0)} ms CPU`,
)
const similarity = (text) => {
  const v = embedder.embed(text)
  return v ? similarities(v, vectors) : null
}

/* ── accuracy: words only vs words plus meaning ── */
const cases = semanticCases
  .map((c) => ({ ...c, expect: c.expect.filter((s) => slugs.has(s)) }))
  .filter((c) => c.expect.length)
const modes = {
  words: (q) => searcher.search(q, { limit: 10 }),
  hybrid: (q) => searcher.search(q, { limit: 10, similarity }),
}
const scores = {}
for (const [mode, run] of Object.entries(modes)) {
  let top1 = 0
  let top3 = 0
  for (const c of cases) {
    const got = run(c.q).tools.map((h) => h.tool.slug)
    if (c.expect.includes(got[0])) top1++
    if (got.slice(0, 3).some((s) => c.expect.includes(s))) top3++
    else if (verbose && mode === 'hybrid') console.log(`  miss ${JSON.stringify(c.q)} -> ${got.slice(0, 3).join(', ') || 'nothing'}`)
  }
  scores[mode] = { top1: (100 * top1) / cases.length, top3: (100 * top3) / cases.length }
  console.log(`${mode.padEnd(7)} top-1 ${scores[mode].top1.toFixed(1)}%  top-3 ${scores[mode].top3.toFixed(1)}%  (${cases.length} queries)`)
}
if (scores.hybrid.top1 < scores.words.top1 || scores.hybrid.top3 < scores.words.top3) fail('meaning made accuracy worse')
if (scores.hybrid.top3 < 85) fail(`hybrid top-3 ${scores.hybrid.top3.toFixed(1)}% is under 85%`)

/* ── the lexical engine cases, with meaning on ── */
let engineRun = 0
for (const c of engineCases) {
  const checked = checkEngineCase(c, (q) => searcher.search(q, { limit: 8, similarity }), slugs)
  if (!checked) continue
  engineRun++
  if (checked.problems.length) fail(`engine ${JSON.stringify(c.q)}: ${checked.problems.join('; ')}  [${checked.shown}]`)
}
console.log(`engine cases with meaning: ${engineRun} run`)

/* ── the file cases, with meaning of the file names on ── */
const lib = { ...files, catalog: decodeIndex(buildIndex(TOOLS, CATEGORIES)) }
for (const c of fileCases) {
  const { problems, shown } = await checkFileCase(c, lib, similarity)
  if (problems.length) fail(`file ${c.name}: ${problems.join('; ')}  [${shown}]`)
}
console.log(`file cases with meaning: ${fileCases.length} run`)

/* ── speed: every prefix of every query, meaning on ── */
let n = 0
const cpu0 = process.cpuUsage()
for (const c of cases) for (let i = 1; i <= c.q.length; i++, n++) searcher.search(c.q.slice(0, i), { limit: 8, similarity })
const cpu = process.cpuUsage(cpu0)
const per = (cpu.user + cpu.system) / 1000 / n
console.log(`speed: ${n} keystrokes, ${per.toFixed(3)} ms CPU each with meaning`)
if (per > 5) fail(`too slow: ${per.toFixed(3)} ms per keystroke`)

console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
