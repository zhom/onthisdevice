#!/usr/bin/env node
/**
 * Reference tests for the math, science, home and everyday calculators
 * (src/components/tools/calc2) and checks on their registry entries.
 *
 *   node scripts/calc-test-math-science-home.mjs [--verbose] [filter]
 *
 * Each module in scripts/calc-test-math-science-home/ exports
 * `default (t) => void | Promise<void>` and tests one group of formulas
 * against textbook or published values. Node runs the TypeScript sources
 * directly (type stripping); a resolve hook maps extensionless imports.
 */
import { registerHooks } from 'node:module'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = new URL('../src/', import.meta.url)
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
      for (const ext of ['.ts', '.tsx', '']) {
        const url = new URL(specifier.slice(2) + ext, SRC)
        if (existsSync(fileURLToPath(url)) && !specifier.endsWith('/')) return next(url.href, context)
      }
    }
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]sx?$|\.json$/.test(specifier) && context.parentURL) {
      const url = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(fileURLToPath(url))) return next(url.href, context)
    }
    return next(specifier, context)
  },
})

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const filter = args.find((a) => !a.startsWith('--'))

let passed = 0
let failed = 0
let group = ''
const fail = (msg) => {
  failed++
  console.log(`  FAIL [${group}] ${msg}`)
}
const pass = (msg) => {
  passed++
  if (verbose) console.log(`  ok   [${group}] ${msg}`)
}

/** The helpers every case module gets. */
const t = {
  /** |got - want| <= tol (absolute), or <= rel * |want| when rel is given. */
  near(name, got, want, tol = 1e-9, rel = false) {
    const lim = rel ? Math.abs(want) * tol : tol
    if (typeof got !== 'number' || Number.isNaN(got) || Math.abs(got - want) > lim) fail(`${name}: got ${got}, want ${want} ± ${rel ? `${tol * 100}%` : tol}`)
    else pass(`${name}: ${got}`)
  },
  eq(name, got, want) {
    const a = JSON.stringify(got)
    const b = JSON.stringify(want)
    if (a !== b) fail(`${name}: got ${a}, want ${b}`)
    else pass(`${name}: ${a}`)
  },
  ok(name, cond, detail = '') {
    if (!cond) fail(`${name}${detail ? `: ${detail}` : ''}`)
    else pass(name)
  },
}

/* ── formula modules ────────────────────────────────────────────── */

const dir = path.join(ROOT, 'scripts/calc-test-math-science-home')
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort() : []
for (const f of files) {
  group = f.replace(/\.mjs$/, '')
  if (filter && !group.includes(filter)) continue
  const before = failed
  const mod = await import(pathToFileURL(path.join(dir, f)).href)
  try {
    await mod.default(t)
  } catch (e) {
    fail(`threw: ${e?.stack ?? e}`)
  }
  console.log(`${group}: ${failed === before ? 'ok' : `${failed - before} failed`}`)
}

/* ── registry and pages ─────────────────────────────────────────── */

if (!filter || 'registry'.includes(filter)) {
  group = 'registry'
  const before = failed
  const { tools } = await import('@/lib/tools/calc-math-science-home.ts')
  const { TOOLS } = await import('@/lib/tools/index.ts')
  const Lucide = await import('lucide-react')
  const all = new Set(TOOLS.map((x) => x.slug))
  const descs = new Map(TOOLS.map((x) => [x.description, x.slug]))
  const seen = new Set()
  for (const tool of tools) {
    const s = tool.slug
    t.ok(`${s}: unique slug`, !seen.has(s))
    seen.add(s)
    const n = tool.description.length
    t.ok(`${s}: description 110-155 chars`, n >= 110 && n <= 155, `${n}`)
    t.ok(`${s}: description unique`, descs.get(tool.description) === s)
    const words = tool.title.toLowerCase().replace(/ calculator| converter| solver/, '').split(/\s+/)[0]
    t.ok(`${s}: description has the search phrase`, tool.description.toLowerCase().includes(words), words)
    t.ok(`${s}: 3-5 FAQs`, (tool.faqs?.length ?? 0) >= 3 && (tool.faqs?.length ?? 0) <= 5, `${tool.faqs?.length}`)
    t.ok(`${s}: icon ${tool.icon} exists`, typeof Lucide[tool.icon] === 'object' || typeof Lucide[tool.icon] === 'function')
    for (const r of tool.related ?? []) t.ok(`${s}: related ${r} exists`, all.has(r))
    t.ok(`${s}: updated`, tool.updated === '2026-11-02')
    const page = path.join(ROOT, 'src/pages', `${s}.astro`)
    t.ok(`${s}: page exists`, existsSync(page))
    const text = [tool.title, tool.h1 ?? '', tool.description, ...(tool.faqs ?? []).flatMap((f) => [f.q, f.a])].join('\n')
    const pageText = existsSync(page) ? readFileSync(page, 'utf8') : ''
    t.ok(`${s}: no em dash`, !/—/.test(text + pageText))
    t.ok(`${s}: page has an explainer`, pageText.includes('slot="explainer"'))
  }
  const islands = path.join(ROOT, 'src/components/tools/calc2')
  for (const f of readdirSync(islands, { recursive: true })) {
    if (!/\.(tsx?|astro)$/.test(String(f))) continue
    t.ok(`${f}: no em dash`, !readFileSync(path.join(islands, String(f)), 'utf8').includes('—'))
  }
  console.log(`registry: ${tools.length} tools, ${failed === before ? 'ok' : `${failed - before} failed`}`)
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
