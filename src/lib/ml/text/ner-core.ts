/**
 * Token classification over long text: windows of 256 tokens with a 32-token
 * overlap, BIO decoding into character spans. Independent of the runtime, so
 * the browser worker and the node tests share it.
 */
import type { Token, UnigramTokenizer } from './tokenizer'
import type { EntityType, Span } from './types'

export const NER_MODEL_DIR = '/models/Mozilla/smart-pii-redactor-v1-onnx/'
export const NER_FILES = [`${NER_MODEL_DIR}tokenizer.json`, `${NER_MODEL_DIR}onnx/model_quantized.onnx`]

/** The model's labels, by class index. */
export const NER_LABELS = [
  'O',
  'B-PERSON', 'I-PERSON',
  'B-STREET_ADDRESS', 'I-STREET_ADDRESS',
  'B-DOB', 'I-DOB',
  'B-ID_IN_CONTEXT', 'I-ID_IN_CONTEXT',
  'B-SECRET_IN_CONTEXT', 'I-SECRET_IN_CONTEXT',
  'B-USERNAME', 'I-USERNAME',
  'B-ORG', 'I-ORG',
  'B-PRODUCT', 'I-PRODUCT',
  'B-LOCATION', 'I-LOCATION',
  'B-DATE', 'I-DATE',
  'B-PUBLIC_NAME', 'I-PUBLIC_NAME',
] as const

const TYPE_OF: Record<string, EntityType> = {
  PERSON: 'PERSON',
  PUBLIC_NAME: 'PERSON',
  STREET_ADDRESS: 'ADDRESS',
  DOB: 'DOB',
  ID_IN_CONTEXT: 'ID',
  SECRET_IN_CONTEXT: 'SECRET',
  USERNAME: 'USERNAME',
  ORG: 'ORG',
  PRODUCT: 'PRODUCT',
  LOCATION: 'LOCATION',
  DATE: 'DATE',
}

const WINDOW = 256
const STRIDE = 32

/** Runs the model on one batch row: ids and mask in, logits [seq * labels] out. */
export type RunModel = (ids: BigInt64Array, mask: BigInt64Array) => Promise<Float32Array>

export interface NerProgress {
  done: number
  total: number
}

export interface NerOptions {
  /** Below this probability a token counts as O. */
  minScore?: number
  onProgress?: (p: NerProgress) => void
  /** Checked between windows. */
  signal?: { aborted: boolean }
}

/** Start offsets (in tokens) of each window. */
export function windows(count: number, size = WINDOW - 2, overlap = STRIDE): number[] {
  if (count <= size) return [0]
  const starts: number[] = []
  const step = size - overlap
  for (let s = 0; ; s += step) {
    if (s + size >= count) {
      starts.push(Math.max(0, count - size))
      break
    }
    starts.push(s)
  }
  return starts
}

function softmaxRow(logits: Float32Array, row: number, n: number): { label: number; p: number } {
  let max = -Infinity
  let arg = 0
  for (let k = 0; k < n; k++) {
    const v = logits[row * n + k]
    if (v > max) {
      max = v
      arg = k
    }
  }
  let sum = 0
  for (let k = 0; k < n; k++) sum += Math.exp(logits[row * n + k] - max)
  return { label: arg, p: 1 / sum }
}

/** Labels each token, using for overlapped tokens the window where it sits farthest from an edge. */
export async function classifyTokens(tokens: Token[], run: RunModel, options: NerOptions = {}): Promise<{ label: number; p: number }[]> {
  const size = WINDOW - 2
  const starts = windows(tokens.length, size)
  const result: { label: number; p: number; margin: number }[] = tokens.map(() => ({ label: 0, p: 1, margin: -1 }))
  const n = NER_LABELS.length
  for (let w = 0; w < starts.length; w++) {
    if (options.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    const s = starts[w]
    const slice = tokens.slice(s, s + size)
    const len = slice.length + 2
    const ids = new BigInt64Array(len)
    const mask = new BigInt64Array(len).fill(1n)
    ids[0] = 0n
    for (let i = 0; i < slice.length; i++) ids[i + 1] = BigInt(slice[i].id)
    ids[len - 1] = 2n
    const logits = await run(ids, mask)
    for (let i = 0; i < slice.length; i++) {
      const margin = Math.min(i, slice.length - 1 - i)
      const t = s + i
      if (margin <= result[t].margin) continue
      const { label, p } = softmaxRow(logits, i + 1, n)
      result[t] = { label, p, margin }
    }
    options.onProgress?.({ done: w + 1, total: starts.length })
  }
  return result
}

/** BIO decoding: consecutive tokens of one type form a span. */
export function decode(text: string, tokens: Token[], labels: { label: number; p: number }[], minScore = 0.5): Span[] {
  const spans: Span[] = []
  let cur: { type: string; start: number; end: number; sum: number; count: number } | null = null
  const close = () => {
    if (!cur) return
    const type = TYPE_OF[cur.type]
    if (type) {
      spans.push({ start: cur.start, end: cur.end, type, source: 'model', score: cur.sum / cur.count, rule: cur.type === 'PUBLIC_NAME' ? 'public-name' : undefined })
    }
    cur = null
  }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const { label, p } = labels[i]
    const name = NER_LABELS[label]
    if (name === 'O' || p < minScore) {
      // Subword pieces after an entity's first piece stay in the entity.
      if (cur && !t.wordStart && name === 'O' && /[\p{L}\p{N}]/u.test(text.slice(t.start, t.end))) {
        cur.end = t.end
        continue
      }
      close()
      continue
    }
    const [bio, type] = [name.slice(0, 1), name.slice(2)]
    const gap = cur ? text.slice(cur.end, t.start) : ''
    const continues = cur && cur.type === type && (bio === 'I' || !t.wordStart) && !/\n\s*\n/.test(gap)
    if (continues && cur) {
      cur.end = t.end
      cur.sum += p
      cur.count++
    } else {
      close()
      cur = { type, start: t.start, end: t.end, sum: p, count: 1 }
    }
  }
  close()
  return spans
}

/** Full pipeline: tokenize, classify in windows, decode. */
export async function runNer(text: string, tokenizer: UnigramTokenizer, run: RunModel, options: NerOptions = {}): Promise<Span[]> {
  const tokens = tokenizer.tokenize(text)
  if (tokens.length === 0) return []
  const labels = await classifyTokens(tokens, run, options)
  return decode(text, tokens, labels, options.minScore ?? 0.5)
}
