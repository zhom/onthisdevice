/**
 * Builds the search index from the registry. Runs at build time only (search-index.json.ts,
 * all-tools.astro) and in the node tests; never imported by client code.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Category, Tool } from '@/lib/tools/types'
import { CATEGORIES, TOOLS } from '@/lib/tools'
import { FEATURED } from '@/lib/featured'
import type { SearchIndex, ToolRow } from './data'
import type { Embedder } from './semantic/embed'
import { createEmbedder } from './semantic/embed'
import { packVectors, parseModel, quantizeRows } from './semantic/format'
import { SEARCH_MODEL } from './semantic/paths'
import { STOPWORDS, normalize, stem, words } from './text'

/** Description words used by more than this share of tools say nothing about one tool. */
const COMMON_SHARE = 0.08
/** Description words kept per tool. */
const EXTRA_WORDS = 8

export function buildIndex(tools: readonly Tool[], categories: readonly Category[]): SearchIndex {
  const catIndex = new Map(categories.map((c, i) => [c.id, i]))
  const toolIndex = new Map(tools.map((t, i) => [t.slug, i]))

  // How many descriptions use each stem, to drop boilerplate ("free", "private", "browser").
  const df = new Map<string, number>()
  const descStems = tools.map((t) => new Set(words(normalize(t.description)).map(stem)))
  for (const set of descStems) for (const s of set) df.set(s, (df.get(s) ?? 0) + 1)
  const common = Math.max(4, Math.floor(tools.length * COMMON_SHARE))

  const featured = new Map(FEATURED.map((slug, i) => [slug, i + 1]))
  let nextRank = FEATURED.length + 1
  const rank = new Map<string, number>()
  for (const t of tools) {
    const f = featured.get(t.slug)
    if (f) rank.set(t.slug, f)
  }
  for (const t of tools) if (t.popular && !rank.has(t.slug)) rank.set(t.slug, nextRank++)

  const rows: ToolRow[] = tools.map((t) => {
    const known = new Set(
      words(normalize([t.title, t.slug.replace(/-/g, ' '), ...t.keywords].join(' '))).map(stem),
    )
    const extra: string[] = []
    for (const w of words(normalize(t.description))) {
      const s = stem(w)
      if (w.length < 3 || STOPWORDS.has(w) || known.has(s) || (df.get(s) ?? 0) > common) continue
      known.add(s)
      extra.push(w)
    }
    // The rarest few words say the most; the rest only make the file bigger.
    extra.sort((a, b) => (df.get(stem(a)) ?? 0) - (df.get(stem(b)) ?? 0))
    const accepts = (t.accepts ?? []).filter((a) => /^[a-z0-9]+$/.test(a))
    const related = (t.related ?? [])
      .map((slug) => toolIndex.get(slug))
      .filter((i): i is number => i !== undefined)
    return [
      t.slug,
      t.title,
      catIndex.get(t.category) ?? 0,
      t.keywords.map((k) => k.trim()).filter(Boolean).join('|'),
      extra.slice(0, EXTRA_WORDS).join(' '),
      accepts.join(' '),
      rank.get(t.slug) ?? 0,
      related,
    ]
  })

  return {
    v: 1,
    c: categories.map((c) => [c.id, c.title, c.slug, c.tagline]),
    t: rows,
  }
}

let site: { json: string; version: string } | null = null

/** The site's index as served at /search-index.json, and a short hash of it. Built once. */
export function siteIndex(): { json: string; version: string } {
  if (!site) {
    const json = JSON.stringify(buildIndex(TOOLS, CATEGORIES))
    site = { json, version: createHash('sha256').update(json).digest('hex').slice(0, 10) }
  }
  return site
}

/** What the model reads for one tool: its names, keywords, description and FAQ questions. */
export function meaningOf(t: Tool): string {
  return [t.title, t.h1 ?? '', t.keywords.join('. '), t.description, (t.faqs ?? []).map((f) => f.q).join(' ')].join('. ')
}

/** One unit vector per tool, in `tools` order, int8, packed for /search-vectors.bin. */
export function buildVectors(tools: readonly Tool[], embedder: Embedder): Uint8Array<ArrayBuffer> {
  const dims = embedder.dims
  const all = new Float32Array(tools.length * dims)
  tools.forEach((t, i) => {
    const v = embedder.embed(meaningOf(t))
    if (v) all.set(v, i * dims)
  })
  return packVectors(quantizeRows(all, tools.length, dims))
}

/** The vendored search model, read from public/ (scripts/vendor-models.mjs puts it there). */
export function loadEmbedder(root = process.cwd()): Embedder {
  const file = path.join(root, 'public', SEARCH_MODEL)
  if (!existsSync(file)) {
    throw new Error(`[search] ${SEARCH_MODEL} is missing. Run: node scripts/vendor-models.mjs`)
  }
  const bytes = readFileSync(file)
  return createEmbedder(parseModel(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)))
}

let vectors: { bytes: Uint8Array<ArrayBuffer>; version: string } | null = null

/** The tool vectors as served at /search-vectors.bin, and a short hash. Built once per build. */
export function siteVectors(): { bytes: Uint8Array<ArrayBuffer>; version: string } {
  if (!vectors) {
    const bytes = buildVectors(TOOLS, loadEmbedder())
    vectors = { bytes, version: createHash('sha256').update(bytes).digest('hex').slice(0, 10) }
  }
  return vectors
}
