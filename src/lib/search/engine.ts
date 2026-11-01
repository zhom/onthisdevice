/**
 * Ranked tool search that runs in the browser. Built once from the index (a few ms), then each
 * query costs well under a millisecond for ~450 tools.
 *
 * Matching, per query word: exact word, same stem, synonym, prefix (the word being typed), then
 * edit distance (typos). Each match is weighted by the field it hits (title > slug > keywords >
 * formats > category > description) and by how rare the word is. Format pairs ("heic to jpg") and
 * sizes ("under 100kb") add an intent score on top.
 */
import type { Catalog, CategoryDoc, SearchIndex, ToolDoc } from './data'
import { decodeIndex } from './data'
import { FORMAT_BY_ALIAS, FORMAT_KIND, PHRASES, SYNONYM_GROUPS } from './synonyms'
import { STOPWORDS, editDistance, normalize, stem, wordSpans, words } from './text'
import type { PairIntent, SizeIntent, SizeTool } from './intent'
import { parsePair, parseSize, sizeFit, sizeToolOf, slugPair } from './intent'

export type Range = [start: number, end: number]

export interface ToolHit {
  tool: ToolDoc
  score: number
  /** Matched character ranges in `tool.title`. */
  ranges: Range[]
}

export interface CategoryHit {
  category: CategoryDoc
  ranges: Range[]
}

export interface SearchResult {
  query: string
  tools: ToolHit[]
  categories: CategoryHit[]
  /** A corrected query when a word only matched as a typo. */
  didYouMean?: string
  /** A longer phrase that starts with the query, for inline completion. Lowercase. */
  completion?: string
  /** How many tools matched, before `limit`. */
  total: number
}

export interface SearchOptions {
  /** Max tool hits. Default 8. */
  limit?: number
  /** Extra score per slug, e.g. from the visitor's own history (0 to 3). */
  boost?: ReadonlyMap<string, number>
  /** Compute title highlight ranges. Default true. */
  highlight?: boolean
  /** Drop hits below this share of the best score. Default 0.1; lower keeps weaker matches. */
  floor?: number
}

export interface Searcher extends Catalog {
  search(query: string, options?: SearchOptions): SearchResult
  /** Most used tools first. */
  popular(limit: number): ToolDoc[]
}

type MatchKind = 'exact' | 'stem' | 'syn' | 'prefix' | 'fuzzy'

interface Candidate {
  q: number
  kind: MatchKind
  /** Characters of the term the query word covers (prefix matches). */
  cover: number
}

interface Expansion {
  terms: Map<string, Candidate>
  /** The vocabulary word a typo most likely meant, when only typos matched. */
  correction?: string
}

interface Postings {
  docs: number[]
  weights: number[]
  idf: number
}

const WEIGHT = { title: 10, slug: 8, keyword: 6, accepts: 4, category: 3, extra: 2 } as const

const RELATIVE_FLOOR = 0.1
const CACHE_MAX = 400

export function createSearcher(index: SearchIndex): Searcher {
  const catalog = decodeIndex(index)
  const { tools } = catalog
  const N = tools.length

  /* ── postings: term -> docs, best field weight per doc ── */
  const postings = new Map<string, Postings>()
  const add = (term: string, doc: number, weight: number) => {
    let p = postings.get(term)
    if (!p) {
      p = { docs: [], weights: [], idf: 1 }
      postings.set(term, p)
    }
    const last = p.docs.length - 1
    if (last >= 0 && p.docs[last] === doc) {
      if (weight > p.weights[last]) p.weights[last] = weight
    } else {
      p.docs.push(doc)
      p.weights.push(weight)
    }
  }

  interface DocText {
    title: string
    titleWords: string[]
    slugWords: string[]
    keywords: string[]
    size: SizeTool | null
    pair: [string[], string[]] | null
    accepts: Set<string>
  }
  const text: DocText[] = tools.map((t) => {
    const title = normalize(t.title)
    const titleWords = words(title)
    const slugWords = t.slug.split('-')
    const keywords = t.keywords.map(normalize)
    const fields: [string[], number][] = [
      [titleWords, WEIGHT.title],
      [slugWords, WEIGHT.slug],
      [keywords.flatMap(words), WEIGHT.keyword],
      [t.accepts, WEIGHT.accepts],
      [words(normalize(t.category.title)), WEIGHT.category],
      [words(t.extra), WEIGHT.extra],
    ]
    for (const [list, weight] of fields) for (const w of list) add(w, t.index, weight)
    const pair = slugPair(t.slug)
    return {
      title,
      titleWords,
      slugWords,
      keywords,
      size: sizeToolOf(t.slug),
      pair: pair && [pair[0].map((w) => FORMAT_BY_ALIAS.get(w) ?? w), pair[1].map((w) => FORMAT_BY_ALIAS.get(w) ?? w)],
      accepts: new Set(t.accepts.map((a) => FORMAT_BY_ALIAS.get(a) ?? a)),
    }
  })
  const logN = Math.log(Math.max(N, 2))
  for (const p of postings.values()) p.idf = 0.55 + 0.45 * (Math.log(N / p.docs.length) / logN)

  /* ── vocabulary: doc terms, synonym words, format aliases ── */
  const stems = new Map<string, string[]>()
  for (const term of postings.keys()) {
    const s = stem(term)
    const list = stems.get(s)
    if (list) list.push(term)
    else stems.set(s, [term])
  }
  const synonyms = new Map<string, Set<string>>()
  for (const group of SYNONYM_GROUPS) {
    const list = group.split(' ')
    for (const w of list) {
      let set = synonyms.get(w)
      if (!set) synonyms.set(w, (set = new Set()))
      for (const o of list) if (o !== w) set.add(o)
    }
  }
  const vocab = [...new Set([...postings.keys(), ...synonyms.keys(), ...FORMAT_BY_ALIAS.keys()])].sort()
  const byLength: string[][] = []
  for (const v of vocab) (byLength[v.length] ??= []).push(v)
  const docFreq = (w: string) => postings.get(w)?.docs.length ?? 0

  /** First index in the sorted vocabulary at or after `prefix`. */
  const lowerBound = (prefix: string) => {
    let lo = 0
    let hi = vocab.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (vocab[mid] < prefix) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  /* ── query word -> weighted vocabulary terms ── */
  const cache = new Map<string, Expansion>()

  function expand(token: string, typing: boolean): Expansion {
    const key = `${typing ? 1 : 0}${token}`
    const hit = cache.get(key)
    if (hit) return hit
    const terms = new Map<string, Candidate>()
    const put = (term: string, q: number, kind: MatchKind, cover = term.length) => {
      if (!postings.has(term)) return
      const old = terms.get(term)
      if (!old || old.q < q) terms.set(term, { q, kind, cover })
    }
    const putFamily = (word: string, q: number, kind: MatchKind, cover?: number) => {
      put(word, q, kind, cover)
      for (const t of stems.get(stem(word)) ?? []) put(t, q * 0.97, kind, cover)
    }
    const putSynonyms = (word: string, q: number, kind: MatchKind) => {
      for (const s of synonyms.get(word) ?? []) putFamily(s, q, kind)
    }

    put(token, 1, 'exact')
    for (const t of stems.get(stem(token)) ?? []) put(t, 0.94, 'stem')
    putSynonyms(token, 0.82, 'syn')
    for (const t of stems.get(stem(token)) ?? []) if (t !== token) putSynonyms(t, 0.78, 'syn')

    const minPrefix = typing ? 1 : 3
    if (token.length >= minPrefix && !/^\d+$/.test(token)) {
      let seen = 0
      for (let i = lowerBound(token); i < vocab.length && seen < 600; i++) {
        const v = vocab[i]
        if (!v.startsWith(token)) break
        if (v === token) continue
        seen++
        const q = 0.5 + 0.42 * (token.length / v.length)
        put(v, q, 'prefix', token.length)
        if (token.length >= 2) putSynonyms(v, q * 0.85, 'prefix')
      }
    } else if (/^\d+$/.test(token)) {
      // "100" while typing "100kb"
      for (let i = lowerBound(token); i < vocab.length; i++) {
        const v = vocab[i]
        if (!v.startsWith(token)) break
        if (v !== token) put(v, 0.7, 'prefix', token.length)
      }
    }

    let correction: string | undefined
    if (terms.size === 0 && token.length >= 3 && /[a-z]/.test(token)) {
      const max = token.length >= 6 ? 2 : 1
      let bestD = max + 1
      let bestDf = -1
      for (let len = Math.max(3, token.length - max); len <= token.length + max; len++) {
        for (const v of byLength[len] ?? []) {
          const d = editDistance(token, v, max)
          if (d > max) continue
          const q = d === 1 ? 0.62 : 0.45
          putFamily(v, q, 'fuzzy')
          putSynonyms(v, q * 0.9, 'fuzzy')
          const df = docFreq(v) + (synonyms.has(v) ? 1 : 0)
          if (d < bestD || (d === bestD && df > bestDf)) {
            bestD = d
            bestDf = df
            correction = v
          }
        }
      }
      // A typo in the word still being typed: compare with the start of longer words that
      // share its first letter.
      if (terms.size === 0 && typing && token.length >= 4) {
        for (let i = lowerBound(token[0]); i < vocab.length && vocab[i][0] === token[0]; i++) {
          const v = vocab[i]
          if (v.length <= token.length) continue
          if (editDistance(token, v, 1, token.length) > 1) continue
          put(v, 0.5, 'fuzzy', token.length)
          putSynonyms(v, 0.45, 'fuzzy')
          if (!correction || docFreq(v) > docFreq(correction)) correction = v
        }
      }
    }

    const out: Expansion = { terms, correction }
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value ?? '')
    cache.set(key, out)
    return out
  }

  /* ── scratch buffers, reused by every query ── */
  const total = new Float64Array(N)
  const matched = new Uint8Array(N)
  const best = new Float64Array(N)
  const stamp = new Uint32Array(N)
  let stampNow = 0

  const rankBoost = (t: ToolDoc) => (t.rank > 0 ? 1.5 + 2 * (1 - Math.min(t.rank, 100) / 100) : 0)

  function pairScore(doc: number, pair: PairIntent): number {
    const d = text[doc]
    const strong = pair.pure ? 1 : 0.3
    if (d.pair) {
      const [left, right] = d.pair
      const hasFrom = left.includes(pair.from)
      const hasTo = right.includes(pair.to)
      if (hasFrom && hasTo) return 60 * strong
      // "mp4 to gif" -> video-to-gif: the target matches and the tool takes the source.
      if (hasTo && d.accepts.has(pair.from)) return 42 * strong
      if (hasTo && FORMAT_KIND[pair.from] && left.includes(FORMAT_KIND[pair.from])) return 34 * strong
    }
    const slug = tools[doc].slug
    // A general converter of that kind, if it takes the source format.
    if (slug.endsWith('converter') && FORMAT_KIND[pair.from] && FORMAT_KIND[pair.from] === FORMAT_KIND[pair.to]) {
      if (d.accepts.has(pair.from)) return 22 * strong
    }
    return 0
  }

  function search(rawQuery: string, options: SearchOptions = {}): SearchResult {
    const limit = options.limit ?? 8
    const highlight = options.highlight ?? true
    let q = normalize(rawQuery)
    for (const [re, to] of PHRASES) q = q.replace(re, to)
    const typing = !/\s$/.test(rawQuery)
    q = q.trim().replace(/\s+/g, ' ')
    const result: SearchResult = { query: rawQuery, tools: [], categories: [], total: 0 }
    if (!q) return result

    const all = words(q)
    const pair = parsePair(all)
    const size = parseSize(q, all)
    let tokens = all.filter((w) => !STOPWORDS.has(w))
    if (tokens.length === 0) tokens = all.filter((w) => w.length > 1).slice(-1)
    // Bare numbers ("15% of 80", "12*7") are sums for the answers, not tool names.
    if (!size && tokens.every((t) => /^\d+$/.test(t))) return result
    const lastToken = all[all.length - 1]

    const expansions = tokens.map((t) => expand(t, typing && t === lastToken))
    stampNow++
    total.fill(0)
    matched.fill(0)
    const touched: number[] = []

    for (const exp of expansions) {
      const seen: number[] = []
      for (const [term, c] of exp.terms) {
        const p = postings.get(term)
        if (!p) continue
        const f = c.q * p.idf
        for (let k = 0; k < p.docs.length; k++) {
          const doc = p.docs[k]
          const s = f * p.weights[k]
          if (stamp[doc] !== stampNow) {
            stamp[doc] = stampNow
            best[doc] = 0
            seen.push(doc)
          }
          if (s > best[doc]) best[doc] = s
        }
      }
      for (const doc of seen) {
        if (matched[doc] === 0 && total[doc] === 0) touched.push(doc)
        total[doc] += best[doc]
        matched[doc]++
      }
      stampNow++
    }

    // Intent tools join the pool even when no word matched them.
    const intent = new Map<number, number>()
    if (pair) {
      for (let doc = 0; doc < N; doc++) {
        const s = pairScore(doc, pair)
        if (s > 0) intent.set(doc, s)
      }
    }
    if (size) {
      for (let doc = 0; doc < N; doc++) {
        const st = text[doc].size
        if (!st) continue
        const s = sizeFit(st, size)
        if (s > 0) intent.set(doc, Math.max(intent.get(doc) ?? 0, s))
      }
    }
    for (const doc of intent.keys()) if (matched[doc] === 0 && total[doc] === 0) touched.push(doc)

    const n = tokens.length
    // A title that starts with the query only says something while a word is still partial
    // ("mortg") or the query has several words ("pdf to"); "pdf" alone starts too many titles.
    const partial = n >= 2 || !postings.has(tokens[0])
    const qSlug = q.replace(/ /g, '-')
    const scored: { doc: number; score: number }[] = []
    for (const doc of touched) {
      const coverage = n ? matched[doc] / n : 0
      const intentScore = intent.get(doc) ?? 0
      if (n >= 2 && coverage < 0.5 && intentScore === 0) continue
      const t = tools[doc]
      const d = text[doc]
      let score = total[doc] * (coverage === 1 ? 1 : 0.4 * coverage * coverage)
      if (d.title === q || t.slug === qSlug) score += 40
      else if (partial && d.title.startsWith(q)) score += 18
      for (const k of d.keywords) {
        if (k === q) {
          score += 14
          break
        }
        if (q.length >= 3 && k.startsWith(q)) {
          score += 6
          break
        }
      }
      score += intentScore
      score += rankBoost(t) + (options.boost?.get(t.slug) ?? 0)
      score -= 0.04 * t.title.length
      scored.push({ doc, score })
    }
    if (scored.length === 0) {
      result.didYouMean = correctionOf(all, tokens, expansions)
      return result
    }

    // Rerank the leaders: all words in the title, and words in the query's order.
    scored.sort((a, b) => b.score - a.score)
    const lead = scored.slice(0, 60)
    if (n >= 1) {
      for (const s of lead) {
        const d = text[s.doc]
        let inTitle = 0
        let lastPos = -1
        let ordered = true
        for (const exp of expansions) {
          const pos = d.titleWords.findIndex((w) => {
            const c = exp.terms.get(w)
            return c !== undefined && c.kind !== 'fuzzy'
          })
          if (pos >= 0) {
            inTitle++
            if (pos < lastPos) ordered = false
            lastPos = pos
          } else ordered = false
        }
        if (inTitle === n) s.score += 8 + (n >= 2 && ordered ? 4 : 0)
      }
      lead.sort((a, b) => b.score - a.score || tools[a.doc].title.localeCompare(tools[b.doc].title))
    }
    const ranked = lead.length < scored.length ? [...lead, ...scored.slice(60)] : lead
    const top = ranked[0].score
    const floor = Math.max(1, top * (options.floor ?? RELATIVE_FLOOR))
    for (const s of ranked) {
      if (s.score < floor) break
      result.total++
      if (result.tools.length >= limit) continue
      const tool = tools[s.doc]
      result.tools.push({
        tool,
        score: s.score,
        ranges: highlight ? rangesFor(tool.title, expansions) : [],
      })
    }

    result.categories = categoriesFor(expansions, highlight)
    const fixed = correctionOf(all, tokens, expansions)
    // "mrege pd" -> "merge pdf": finish the corrected words the way the completion would.
    const titled = fixed && typing ? result.tools.slice(0, 3).find((h) => text[h.tool.index].title.startsWith(fixed)) : undefined
    result.didYouMean = titled ? text[titled.tool.index].title : fixed
    result.completion = completionFor(rawQuery, result.tools)
    return result
  }

  function rangesFor(title: string, expansions: Expansion[]): Range[] {
    const ranges: Range[] = []
    for (const span of wordSpans(title)) {
      let cover = 0
      for (const exp of expansions) {
        const c = exp.terms.get(span.word)
        if (!c) continue
        cover = Math.max(cover, c.kind === 'prefix' ? Math.min(c.cover, span.end - span.start) : span.end - span.start)
      }
      if (cover > 0) ranges.push([span.start, span.start + cover])
    }
    return ranges
  }

  function categoriesFor(expansions: Expansion[], highlight: boolean): CategoryHit[] {
    if (expansions.length === 0) return []
    const hits: { category: CategoryDoc; score: number }[] = []
    for (const category of catalog.categories) {
      const ws = new Set([...words(normalize(category.title)), ...category.slug.split('-')])
      let score = 0
      let all = true
      for (const exp of expansions) {
        let bestQ = 0
        for (const w of ws) {
          const c = exp.terms.get(w)
          if (c && c.kind !== 'fuzzy' && c.q > bestQ) bestQ = c.q
        }
        if (bestQ < 0.6) {
          all = false
          break
        }
        score += bestQ
      }
      if (all) hits.push({ category, score })
    }
    hits.sort((a, b) => b.score - a.score || b.category.count - a.category.count)
    return hits.slice(0, 3).map((h) => ({
      category: h.category,
      ranges: highlight ? rangesFor(h.category.title, expansions) : [],
    }))
  }

  function correctionOf(all: string[], tokens: string[], expansions: Expansion[]): string | undefined {
    const fixes = new Map<string, string>()
    tokens.forEach((t, i) => {
      const exp = expansions[i]
      const onlyTypos = [...exp.terms.values()].every((c) => c.kind === 'fuzzy')
      if (exp.correction && onlyTypos && exp.correction !== t) fixes.set(t, exp.correction)
    })
    if (fixes.size === 0) return undefined
    return all.map((w) => fixes.get(w) ?? w).join(' ')
  }

  /** The top hit's title when it starts with the query; else one of its keyword phrases. */
  function completionFor(rawQuery: string, hits: ToolHit[]): string | undefined {
    const typed = rawQuery.replace(/^\s+/, '').toLowerCase()
    const top = hits[0]
    if (typed.length < 2 || !top) return undefined
    const d = text[top.tool.index]
    const phrases = typed.length >= 4 ? [d.title, ...d.keywords] : [d.title]
    return phrases.find((p) => p.length > typed.length && p.startsWith(typed))
  }

  const byRank = tools.filter((t) => t.rank > 0).sort((a, b) => a.rank - b.rank)

  return {
    ...catalog,
    search,
    popular: (limit) => byRank.slice(0, limit),
  }
}

export type { PairIntent, SizeIntent }
