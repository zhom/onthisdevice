/**
 * Main-thread access to the speech model, which runs in one shared Web Worker
 * (./speech.worker.ts).
 *
 *   const speech = speechClient()
 *   await speech.load((loaded, total) => ...)                  // download + compile, once
 *   const words = await speech.transcribe(audio16k, 'en', (words, done, total) => ...)
 *
 * `audio16k` is mono at 16 kHz; it is transferred to the worker. A new
 * `transcribe` cancels the one before it (that promise rejects with an
 * AbortError). `speechDownloadBytes()` and `speechIsCached()` in ./model.ts
 * give the "Downloads N MB once" note.
 */
import type { SpeechRequest, SpeechResponse } from './speech.worker'
import type { Word } from './types'

type OnWords = (words: Word[], done: number, total: number) => void

interface Pending {
  resolve: () => void
  reject: (e: Error) => void
  onProgress?: (loaded: number, total: number) => void
  onWords?: OnWords
}

export interface SpeechClient {
  load(onProgress?: (loaded: number, total: number) => void): Promise<void>
  /** Resolves with every word; `onWords` gets them piece by piece while it runs. */
  transcribe(audio: Float32Array, language: string, onWords?: OnWords): Promise<Word[]>
  cancel(): void
  terminate(): void
}

let shared: SpeechClient | null = null

export function speechClient(): SpeechClient {
  shared ??= createClient()
  return shared
}

function createClient(): SpeechClient {
  let worker: Worker | null = null
  let nextId = 1
  let current = 0
  const pending = new Map<number, Pending>()

  const failAll = (err: Error) => {
    for (const p of pending.values()) p.reject(err)
    pending.clear()
  }

  const ensure = (): Worker => {
    if (worker) return worker
    const w = new Worker(new URL('./speech.worker.ts', import.meta.url), { type: 'module', name: 'speech' })
    w.onmessage = (event: MessageEvent<SpeechResponse>) => {
      const msg = event.data
      const p = pending.get(msg.id)
      if (!p) return
      switch (msg.type) {
        case 'progress':
          p.onProgress?.(msg.loaded, msg.total)
          return
        case 'words':
          p.onWords?.(msg.words, msg.done, msg.total)
          return
        case 'error':
          pending.delete(msg.id)
          p.reject(msg.cancelled ? new DOMException('Cancelled', 'AbortError') : new Error(msg.message))
          return
        default:
          pending.delete(msg.id)
          p.resolve()
      }
    }
    w.onerror = (event) => {
      event.preventDefault()
      failAll(new Error('The speech model stopped. Reload the page and try again.'))
      w.terminate()
      worker = null
    }
    worker = w
    return w
  }

  const send = (req: SpeechRequest, p?: Pending, transfer: Transferable[] = []) => {
    if (p) pending.set(req.id, p)
    ensure().postMessage(req, transfer)
  }

  const cancel = () => {
    if (current) send({ id: current, type: 'cancel' })
    current = 0
  }

  return {
    load(onProgress) {
      return new Promise<void>((resolve, reject) => {
        send({ id: nextId++, type: 'load' }, { resolve, reject, onProgress })
      })
    },
    transcribe(audio, language, onWords) {
      cancel()
      const id = nextId++
      current = id
      const all: Word[] = []
      return new Promise<Word[]>((resolve, reject) => {
        send(
          { id, type: 'transcribe', audio, language },
          {
            resolve: () => resolve(all),
            reject,
            onWords: (words, done, total) => {
              all.push(...words)
              onWords?.(words, done, total)
            },
          },
          [audio.buffer],
        )
      })
    },
    cancel,
    terminate() {
      worker?.terminate()
      worker = null
      failAll(new DOMException('Cancelled', 'AbortError'))
    },
  }
}
