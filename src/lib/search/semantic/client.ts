/**
 * Search by meaning in the page: the static model (about 7.5 MB, kept in Cache Storage after
 * the first download, so it works offline) and the tool vectors from the build.
 */
import { loadFile } from '@/lib/ml/assets'
import { createEmbedder, similarities } from './embed'
import { parseModel, parseVectors } from './format'
import { SEARCH_MODEL } from './paths'

export type Similarity = (text: string) => Float32Array | null

export async function openMeaning(tools: number, vectorsUrl: string): Promise<Similarity> {
  const [model, vectorBytes] = await Promise.all([
    loadFile(SEARCH_MODEL),
    fetch(vectorsUrl).then((res) => {
      if (!res.ok) throw new Error(`search vectors: HTTP ${res.status}`)
      return res.arrayBuffer()
    }),
  ])
  const vectors = parseVectors(vectorBytes)
  const embedder = createEmbedder(parseModel(model))
  if (vectors.count !== tools || vectors.dims !== embedder.dims) throw new Error('search vectors do not match the index')
  const cache = new Map<string, Float32Array | null>()
  return (text) => {
    const hit = cache.get(text)
    if (hit !== undefined) return hit
    const v = embedder.embed(text)
    const sims = v ? similarities(v, vectors) : null
    if (cache.size > 200) cache.clear()
    cache.set(text, sims)
    return sims
  }
}
