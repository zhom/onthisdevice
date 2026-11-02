/**
 * Merges the lexical ranking with similarity by meaning. Lexical scores are scaled by the best
 * one (at least `lexFloor`, so a weak lexical match stays weak); similarity is scaled from
 * `simBase` up to the best similarity and weighted by how sure the model is (its best
 * similarity between `sureLow` and `sureHigh`). A query with a format pair or a size keeps most
 * of its lexical order. Tools that only the model found join when they are close to its best.
 * Tuned on scripts/search-test/semantic.mjs without losing a case of scripts/search-test/engine.mjs.
 */

export interface Scored {
  doc: number
  score: number
}

export interface FusionParams {
  lexFloor: number
  weight: number
  simBase: number
  sureLow: number
  sureHigh: number
  /** Least similarity for a tool that no word matched. */
  minOnly: number
  /** ...and at most this far below the best similarity. */
  band: number
  /** At most this many such tools. */
  maxOnly: number
  /** Weight factor when the query names a format pair or a size. */
  intent: number
  /** A lexical top score below this (no title or phrase match) is weak... */
  strong: number
  /** ...and then, for a query of `long` words or more, meaning weighs this many times more. */
  weak: number
  long: number
  /** Least share of the query's words a lexical match needs to stay in the pool. */
  cover: number
}

export const FUSION: FusionParams = {
  lexFloor: 20,
  weight: 0.3,
  simBase: 0.1,
  sureLow: 0.3,
  sureHigh: 0.6,
  minOnly: 0.42,
  band: 0.15,
  maxOnly: 20,
  intent: 0.3,
  strong: 30,
  weak: 2,
  long: 3,
  cover: 0.5,
}

/** The fused ranking, best first, or null when the model has nothing to add. */
export function fuse(
  lexical: readonly Scored[],
  sims: Float32Array,
  query: { intent: boolean; words: number },
  p: FusionParams = FUSION,
): Scored[] | null {
  let simTop = 0
  for (const s of sims) if (s > simTop) simTop = s
  const sure = Math.min(1, Math.max(0, (simTop - p.sureLow) / (p.sureHigh - p.sureLow)))
  if (sure === 0) return null
  const best = lexical[0]?.score ?? 0
  const weak = best < p.strong && query.words >= p.long
  const weight = p.weight * sure * (query.intent ? p.intent : 1) * (weak ? p.weak : 1)
  const lexTop = Math.max(p.lexFloor, best)
  const span = Math.max(1e-6, simTop - p.simBase)
  const meaning = (doc: number) => (weight * Math.max(0, sims[doc] - p.simBase)) / span

  const out: Scored[] = []
  const seen = new Set<number>()
  for (const { doc, score } of lexical) {
    seen.add(doc)
    out.push({ doc, score: score / lexTop + meaning(doc) })
  }
  const cut = Math.max(p.minOnly, simTop - p.band)
  const only: number[] = []
  sims.forEach((s, doc) => {
    if (s >= cut && !seen.has(doc)) only.push(doc)
  })
  only.sort((a, b) => sims[b] - sims[a])
  for (const doc of only.slice(0, p.maxOnly)) out.push({ doc, score: meaning(doc) })
  out.sort((a, b) => b.score - a.score)
  return out
}
