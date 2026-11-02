/**
 * Static embeddings, as model2vec computes them: split the text with the model's WordPiece
 * vocabulary (BERT rules: lowercase, no accents, punctuation apart), drop unknown pieces,
 * average the token rows, normalise to unit length. No neural network runs, so a query costs
 * well under a millisecond. Shared by the browser and the build.
 */
import type { Int8Rows, PackedModel } from './format'

const MAX_WORD = 100
const UNK = '[UNK]'

function isPunct(code: number): boolean {
  return (
    (code >= 33 && code <= 47) ||
    (code >= 58 && code <= 64) ||
    (code >= 91 && code <= 96) ||
    (code >= 123 && code <= 126) ||
    /\p{P}/u.test(String.fromCharCode(code))
  )
}

/** BERT basic tokenizer: lowercase, strip accents, split on spaces and punctuation, CJK apart. */
export function basicWords(text: string): string[] {
  const clean = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/([一-鿿㐀-䶿豈-﫿])/g, ' $1 ')
  const out: string[] = []
  for (const chunk of clean.split(/\s+/)) {
    if (!chunk) continue
    let word = ''
    for (const ch of chunk) {
      if (ch.length === 1 && isPunct(ch.charCodeAt(0))) {
        if (word) out.push(word)
        out.push(ch)
        word = ''
      } else word += ch
    }
    if (word) out.push(word)
  }
  return out
}

export interface Embedder {
  dims: number
  /** Unit vector of the text, or null when no known token is in it. */
  embed(text: string): Float32Array | null
  /** Token ids of the text (for tests). */
  ids(text: string): number[]
}

export function createEmbedder(model: PackedModel): Embedder {
  const index = new Map<string, number>()
  model.vocab.forEach((piece, id) => index.set(piece, id))
  const unk = index.get(UNK) ?? -1
  const { dims, rows, scales } = model
  const cache = new Map<string, number[]>()

  function pieces(word: string): number[] {
    const hit = cache.get(word)
    if (hit) return hit
    const out: number[] = []
    if (word.length > MAX_WORD) return out
    let start = 0
    while (start < word.length) {
      let end = word.length
      let found = -1
      while (start < end) {
        const sub = (start > 0 ? '##' : '') + word.slice(start, end)
        const id = index.get(sub)
        if (id !== undefined) {
          found = id
          break
        }
        end--
      }
      // No piece fits: BERT turns the whole word into [UNK], which model2vec drops.
      if (found < 0) return cache.set(word, []).get(word) ?? []
      out.push(found)
      start = end
    }
    if (cache.size > 5000) cache.clear()
    cache.set(word, out)
    return out
  }

  function ids(text: string): number[] {
    return basicWords(text)
      .flatMap(pieces)
      .filter((id) => id !== unk)
  }

  function embed(text: string): Float32Array | null {
    const tokens = ids(text)
    if (tokens.length === 0) return null
    const acc = new Float32Array(dims)
    for (const id of tokens) {
      const s = scales[id]
      const base = id * dims
      for (let j = 0; j < dims; j++) acc[j] += s * rows[base + j]
    }
    return normalize(acc)
  }

  return { dims, embed, ids }
}

export function normalize(v: Float32Array): Float32Array {
  let n = 0
  for (let j = 0; j < v.length; j++) n += v[j] * v[j]
  n = Math.sqrt(n) || 1
  for (let j = 0; j < v.length; j++) v[j] /= n
  return v
}

/** Cosine of a unit query with each stored unit vector (int8 rows times their scale). */
export function similarities(query: Float32Array, vectors: Int8Rows): Float32Array {
  const { count, dims, rows, scales } = vectors
  const out = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    let dot = 0
    const base = i * dims
    for (let j = 0; j < dims; j++) dot += query[j] * rows[base + j]
    out[i] = dot * scales[i]
  }
  return out
}
