/**
 * Main-thread access to the PII language model, which runs in one shared
 * Web Worker (./ner.worker.ts).
 *
 *   const ner = nerClient()
 *   await ner.load((loaded, total) => ...)       // download + compile, once
 *   const spans = await ner.run(text, (done, total) => ...)
 *
 * A new `run` cancels the one before it; the cancelled promise rejects with
 * an AbortError. `nerDownloadBytes()` and `nerIsCached()` give the
 * "Downloads N MB once" note.
 */
import { isCached, wireBytes } from '../assets'
import { ORT_FILES } from '../ort'
import { NER_FILES } from './ner-core'
import type { NerRequest, NerResponse } from './ner.worker'
import type { Span } from './types'

type Pending = {
  resolve: (value: Span[] | null) => void
  reject: (e: Error) => void
  onProgress?: (loaded: number, total: number) => void
}

export interface NerClient {
  load(onProgress?: (loaded: number, total: number) => void): Promise<void>
  run(text: string, onStep?: (done: number, total: number) => void, minScore?: number): Promise<Span[]>
  terminate(): void
}

const ALL_FILES = [...ORT_FILES, ...NER_FILES]

export function nerDownloadBytes(): number {
  return wireBytes(ALL_FILES)
}

export function nerIsCached(): Promise<boolean> {
  return isCached(ALL_FILES).catch(() => false)
}

let shared: NerClient | null = null

export function nerClient(): NerClient {
  shared ??= createClient()
  return shared
}

function createClient(): NerClient {
  let worker: Worker | null = null
  let nextId = 1
  let current = 0
  const pending = new Map<number, Pending>()

  const ensure = (): Worker => {
    if (worker) return worker
    const w = new Worker(new URL('./ner.worker.ts', import.meta.url), { type: 'module', name: 'ner' })
    w.onmessage = (event: MessageEvent<NerResponse>) => {
      const msg = event.data
      const p = pending.get(msg.id)
      if (!p) return
      if (msg.type === 'progress' || msg.type === 'step') {
        p.onProgress?.(msg.type === 'progress' ? msg.loaded : msg.done, msg.total)
        return
      }
      pending.delete(msg.id)
      if (msg.type === 'loaded') p.resolve(null)
      else if (msg.type === 'result') p.resolve(msg.spans)
      else p.reject(msg.cancelled ? new DOMException('Cancelled', 'AbortError') : new Error(msg.message))
    }
    w.onerror = (event) => {
      event.preventDefault()
      for (const p of pending.values()) p.reject(new Error('The language model stopped. Reload the page and try again.'))
      pending.clear()
      w.terminate()
      worker = null
    }
    worker = w
    return w
  }

  const send = (req: NerRequest, p?: Pending) => {
    if (p) pending.set(req.id, p)
    ensure().postMessage(req)
  }

  return {
    load(onProgress) {
      return new Promise<void>((resolve, reject) => {
        send({ id: nextId++, type: 'load' }, { resolve: () => resolve(), reject, onProgress })
      })
    },
    run(text, onStep, minScore) {
      if (current) send({ id: current, type: 'cancel' })
      const id = nextId++
      current = id
      return new Promise<Span[]>((resolve, reject) => {
        send({ id, type: 'run', text, minScore }, { resolve: (v) => resolve(v ?? []), reject, onProgress: onStep })
      })
    },
    terminate() {
      worker?.terminate()
      worker = null
      for (const p of pending.values()) p.reject(new DOMException('Cancelled', 'AbortError'))
      pending.clear()
    },
  }
}

/**
 * Model spans for many short texts (table cells) in one run: the distinct
 * texts are joined with blank lines, which the worker treats as paragraphs.
 */
export async function nerOnTexts(texts: string[], onStep?: (done: number, total: number) => void): Promise<Span[][]> {
  const distinct = [...new Set(texts.filter((t) => /\S/.test(t)))]
  const starts = new Map<string, number>()
  let joined = ''
  for (const t of distinct) {
    if (joined) joined += '\n\n'
    starts.set(t, joined.length)
    // Line breaks inside a cell would split it; spaces keep every offset.
    joined += t.replace(/\r?\n/g, (m) => ' '.repeat(m.length))
  }
  const spans = joined ? await nerClient().run(joined, onStep) : []
  const byText = new Map<string, Span[]>()
  const order = distinct.map((t) => [t, starts.get(t) ?? 0] as const)
  for (const s of spans) {
    // Binary search for the text that holds this span.
    let lo = 0
    let hi = order.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (order[mid][1] <= s.start) lo = mid
      else hi = mid - 1
    }
    const [t, at] = order[lo]
    if (s.end - at > t.length) continue
    const list = byText.get(t) ?? []
    list.push({ ...s, start: s.start - at, end: s.end - at })
    byText.set(t, list)
  }
  return texts.map((t) => byText.get(t) ?? [])
}
