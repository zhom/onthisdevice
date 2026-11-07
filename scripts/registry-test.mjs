#!/usr/bin/env node
/**
 * Checks the tool registry (src/lib/tools): unique slugs, a page for every tool (a file in
 * src/pages, or the [slug].astro route for the round-3 modules), real lucide icons, related
 * slugs that exist, descriptions of 110 to 160 characters and 3 to 6 questions.
 *
 *   node scripts/registry-test.mjs [-v]
 */
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './search-test/loader.mjs'

const verbose = process.argv.includes('-v')
const { TOOLS, CATEGORY_BY_ID } = await import('../src/lib/tools/index.ts')
const Lucide = await import('lucide-react')

// Keep in step with OWNERS in src/components/site/pages.ts.
const ROUTED_MODULES = ['ai', 'convert', 'calculators', 'text-dev']
const routedSlugs = new Set()
for (const m of ROUTED_MODULES) {
  const { tools } = await import(`../src/lib/tools/${m}.ts`)
  for (const t of tools) routedSlugs.add(t.slug)
}
const files = new Set(
  fs
    .readdirSync(path.join(ROOT, 'src/pages'))
    .filter((f) => f.endsWith('.astro') && !f.startsWith('['))
    .map((f) => f.slice(0, -'.astro'.length)),
)

const problems = []
const fail = (slug, msg) => problems.push(`${slug}: ${msg}`)

const seen = new Map()
for (const t of TOOLS) seen.set(t.slug, (seen.get(t.slug) ?? 0) + 1)
for (const [slug, n] of seen) if (n > 1) fail(slug, `registered ${n} times`)

const slugs = new Set(TOOLS.map((t) => t.slug))
const titles = new Map()
for (const t of TOOLS) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.slug)) fail(t.slug, 'slug is not kebab-case')
  if (!files.has(t.slug) && !routedSlugs.has(t.slug)) fail(t.slug, 'no page: no file in src/pages and not in a routed module')
  if (!CATEGORY_BY_ID[t.category]) fail(t.slug, `unknown category ${t.category}`)
  if (typeof Lucide[t.icon] !== 'object' && typeof Lucide[t.icon] !== 'function') fail(t.slug, `icon ${t.icon} is not a lucide-react export`)
  const d = t.description?.length ?? 0
  if (d < 100 || d > 165) fail(t.slug, `description has ${d} characters (100 to 165)`)
  const q = t.faqs?.length ?? 0
  if (q < 2 || q > 8) fail(t.slug, `${q} questions (2 to 8)`)
  for (const r of t.related ?? []) if (!slugs.has(r)) fail(t.slug, `related slug ${r} does not exist`)
  const key = t.title.toLowerCase()
  if (titles.has(key)) fail(t.slug, `same title as ${titles.get(key)}: "${t.title}"`)
  titles.set(key, t.slug)
}

if (verbose || problems.length) for (const p of problems) console.log(`  FAIL ${p}`)
console.log(`registry: ${TOOLS.length} tools, ${routedSlugs.size} routed, ${problems.length} problems`)
process.exit(problems.length ? 1 : 0)
