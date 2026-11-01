/// <reference lib="webworker" />
/**
 * Worker that runs the PII language model. Talk to it through ./ner-client.ts.
 *
 * Text is split into paragraphs and each paragraph's result is kept, so an
 * edit re-reads only the paragraphs that changed.
 */
import { loadFile } from '../assets'
import { createSession, loadOrt } from '../ort'
import { NER_FILES, classifyTokens, decode } from './ner-core'
import type { RunModel } from './ner-core'
import { UnigramTokenizer } from './tokenizer'
import type { TokenizerJson } from './tokenizer'
import type { Span } from './types'

export type NerRequest =
  | { id: number; type: 'load' }
  | { id: number; type: 'run'; text: string; minScore?: number }
  | { id: number; type: 'cancel' }

export type NerResponse =
  | { id: number; type: 'progress'; loaded: number; total: number }
  | { id: number; type: 'step'; done: number; total: number }
  | { id: number; type: 'loaded' }
  | { id: number; type: 'result'; spans: Span[] }
  | { id: number; type: 'error'; message: string; cancelled?: boolean }

const scope = self as unknown as DedicatedWorkerGlobalScope
const [TOKENIZER, MODEL] = NER_FILES

let engine: Promise<{ tokenizer: UnigramTokenizer; run: RunModel }> | null = null

function load(id: number) {
  if (engine) return engine
  const job = (async () => {
    const seen = new Map<string, [number, number]>()
    const report = () => {
      let loaded = 0
      let total = 0
      for (const [l, t] of seen.values()) {
        loaded += l
        total += t
      }
      post({ id, type: 'progress', loaded, total })
    }
    const [tokBytes, session] = await Promise.all([
      loadFile(TOKENIZER, (l, t) => {
        seen.set('tok', [l, t])
        report()
      }),
      createSession(MODEL, {
        onProgress: (l, t) => {
          seen.set('model', [l, t])
          report()
        },
      }),
    ])
    const ort = await loadOrt()
    const tokenizer = new UnigramTokenizer(JSON.parse(new TextDecoder().decode(tokBytes)) as TokenizerJson)
    const run: RunModel = async (ids, mask) => {
      const feeds = {
        input_ids: new ort.Tensor('int64', ids, [1, ids.length]),
        attention_mask: new ort.Tensor('int64', mask, [1, mask.length]),
      }
      const out = await session.run(feeds)
      const logits = out.logits.data as Float32Array
      feeds.input_ids.dispose()
      feeds.attention_mask.dispose()
      return logits
    }
    return { tokenizer, run }
  })()
  engine = job
  job.catch(() => {
    if (engine === job) engine = null
  })
  return job
}

/** Paragraph results by text. Capped so a long session does not grow without end. */
const cache = new Map<string, Span[]>()
const CACHE_MAX = 4000

function paragraphs(text: string): { start: number; text: string }[] {
  const out: { start: number; text: string }[] = []
  const re = /\n[ \t]*\n/g
  let at = 0
  for (const m of text.matchAll(re)) {
    if (m.index > at) out.push({ start: at, text: text.slice(at, m.index) })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push({ start: at, text: text.slice(at) })
  return out.filter((p) => /\S/.test(p.text))
}

let latest = 0
let queue: Promise<void> = Promise.resolve()

async function run(id: number, text: string, minScore: number) {
  const { tokenizer, run: runModel } = await load(id)
  const signal = {
    get aborted() {
      return latest !== id
    },
  }
  const parts = paragraphs(text)
  const todo = parts.filter((p) => !cache.has(`${minScore}:${p.text}`))
  const tokenized = todo.map((p) => tokenizer.tokenize(p.text))
  const total = tokenized.reduce((n, t) => n + t.length, 0)
  let done = 0
  post({ id, type: 'step', done: 0, total: Math.max(1, total) })
  for (let i = 0; i < todo.length; i++) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    const tokens = tokenized[i]
    const labels = await classifyTokens(tokens, runModel, { signal })
    const spans = decode(todo[i].text, tokens, labels, minScore)
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
    cache.set(`${minScore}:${todo[i].text}`, spans)
    done += tokens.length
    post({ id, type: 'step', done, total: Math.max(1, total) })
  }
  const spans: Span[] = []
  for (const p of parts) {
    for (const s of cache.get(`${minScore}:${p.text}`) ?? []) spans.push({ ...s, start: s.start + p.start, end: s.end + p.start })
  }
  post({ id, type: 'result', spans })
}

function post(msg: NerResponse) {
  scope.postMessage(msg)
}

function message(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'The language model failed.'
}

scope.onmessage = (event: MessageEvent<NerRequest>) => {
  const msg = event.data
  if (msg.type === 'cancel') {
    if (latest === msg.id) latest = -1
    return
  }
  if (msg.type === 'load') {
    load(msg.id).then(
      () => post({ id: msg.id, type: 'loaded' }),
      (err: unknown) => post({ id: msg.id, type: 'error', message: message(err) }),
    )
    return
  }
  latest = msg.id
  queue = queue.then(() =>
    run(msg.id, msg.text, msg.minScore ?? 0.5).catch((err: unknown) => {
      const cancelled = err instanceof DOMException && err.name === 'AbortError'
      post({ id: msg.id, type: 'error', message: cancelled ? 'Cancelled' : message(err), cancelled })
    }),
  )
}
