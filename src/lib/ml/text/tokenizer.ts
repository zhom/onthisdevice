/**
 * Unigram (SentencePiece) tokenizer for the PII model, with character offsets.
 *
 * The model's tokenizer.json splits on whitespace, prefixes each word with
 * "▁" and segments it with the Unigram vocabulary. This file does the same
 * and keeps, for every token, the range of the original text it covers, which
 * the generic tokenizers do not return. The normalizer is NFKC, which matches
 * the model's precompiled character map for Latin-script text.
 */

export interface TokenizerJson {
  added_tokens: { id: number; content: string }[]
  model: { type: string; unk_id: number; vocab: [string, number][] }
}

export interface Token {
  id: number
  /** Range in the original text. */
  start: number
  end: number
  /** First token of a whitespace-separated word. */
  wordStart: boolean
}

const SPACE = '▁'

export class UnigramTokenizer {
  readonly bosId: number
  readonly eosId: number
  readonly padId: number
  private readonly unkId: number
  private readonly pieces = new Map<string, number>()
  private readonly scores: Float32Array
  private readonly maxLen: number
  private readonly unkScore: number

  constructor(json: TokenizerJson) {
    if (json.model.type !== 'Unigram') throw new Error(`Unsupported tokenizer type ${json.model.type}`)
    const vocab = json.model.vocab
    this.scores = new Float32Array(vocab.length)
    let maxLen = 1
    let minScore = 0
    const special = new Set(json.added_tokens.map((t) => t.id))
    for (let i = 0; i < vocab.length; i++) {
      const [piece, score] = vocab[i]
      this.scores[i] = score
      // Special tokens never match text.
      if (!special.has(i)) this.pieces.set(piece, i)
      maxLen = Math.max(maxLen, piece.length)
      if (score < minScore) minScore = score
    }
    this.maxLen = maxLen
    this.unkScore = minScore - 10
    this.unkId = json.model.unk_id
    const idOf = (s: string, fallback: number) => json.added_tokens.find((t) => t.content === s)?.id ?? fallback
    this.bosId = idOf('<s>', 0)
    this.padId = idOf('<pad>', 1)
    this.eosId = idOf('</s>', 2)
  }

  /** Best segmentation of one "▁word" string; returns [pieceStart, pieceEnd, id] in that string. */
  private segment(s: string): [number, number, number][] {
    const n = s.length
    const best = new Float64Array(n + 1).fill(-Infinity)
    const from = new Int32Array(n + 1).fill(-1)
    const ids = new Int32Array(n + 1).fill(-1)
    best[0] = 0
    for (let i = 0; i < n; i++) {
      if (best[i] === -Infinity) continue
      let matched = false
      const limit = Math.min(n, i + this.maxLen)
      for (let j = i + 1; j <= limit; j++) {
        const id = this.pieces.get(s.slice(i, j))
        if (id === undefined) continue
        const score = best[i] + this.scores[id]
        if (score > best[j]) {
          best[j] = score
          from[j] = i
          ids[j] = id
        }
        if (j === i + 1 || (j === i + 2 && isSurrogatePair(s, i))) matched = true
      }
      if (!matched) {
        // One unknown character (a whole surrogate pair counts as one).
        const j = isSurrogatePair(s, i) ? i + 2 : i + 1
        const score = best[i] + this.unkScore
        if (score > best[j]) {
          best[j] = score
          from[j] = i
          ids[j] = this.unkId
        }
      }
    }
    const out: [number, number, number][] = []
    let j = n
    while (j > 0) {
      const i = from[j]
      if (i < 0) break
      out.push([i, j, ids[j]])
      j = i
    }
    out.reverse()
    // Consecutive unknown pieces fuse into one, as the reference tokenizer does.
    const fused: [number, number, number][] = []
    for (const p of out) {
      const last = fused[fused.length - 1]
      if (last && last[2] === this.unkId && p[2] === this.unkId) last[1] = p[1]
      else fused.push(p)
    }
    return fused
  }

  /** Tokens of the whole text, without the start and end markers. */
  tokenize(text: string): Token[] {
    const tokens: Token[] = []
    for (const m of text.matchAll(/\S+/g)) {
      const word = m[0]
      const ws = m.index
      const norm = word.normalize('NFKC')
      const s = SPACE + norm
      const pieces = this.segment(s)
      const sameLength = norm.length === word.length
      let first = true
      for (const [a, b, id] of pieces) {
        // Positions in s are shifted by the "▁" prefix.
        const pa = Math.max(0, a - 1)
        const pb = Math.max(0, b - 1)
        let start: number
        let end: number
        if (sameLength) {
          start = ws + pa
          end = ws + pb
        } else {
          start = ws + Math.round((pa / norm.length) * word.length)
          end = ws + Math.round((pb / norm.length) * word.length)
        }
        if (end <= start) {
          // The lone "▁" piece: give it the first character of the word.
          end = Math.min(ws + word.length, start + 1)
        }
        tokens.push({ id, start, end, wordStart: first })
        first = false
      }
    }
    return tokens
  }
}

function isSurrogatePair(s: string, i: number): boolean {
  const c = s.charCodeAt(i)
  return c >= 0xd800 && c <= 0xdbff && i + 1 < s.length
}
