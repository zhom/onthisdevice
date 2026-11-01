/**
 * Main-thread access to the signature and stamp finder, which runs in one
 * shared Web Worker (./signature.worker.ts).
 *
 *   const sig = signatureClient()
 *   await sig.load((loaded, total) => ...)                       // download + compile, once
 *   const { signatures, stamps } = await sig.detect(bitmap, { stamps: true }, onStep)
 *
 * Boxes are in pixels of `bitmap`. `detect` takes ownership of the bitmap
 * (it is transferred and closed). Requests run one at a time in order.
 * `signatureDownloadBytes()` and `signatureIsCached()` in ./model.ts give the
 * "Downloads N MB once" note.
 */
import type { PageMarks, SignatureRequest, SignatureResponse } from './signature.worker'

export type { PageMarks } from './signature.worker'

interface Pending {
  resolve: (marks: PageMarks | null) => void
  reject: (e: Error) => void
  onProgress?: (loaded: number, total: number) => void
}

export interface SignatureClient {
  load(onProgress?: (loaded: number, total: number) => void): Promise<void>
  detect(image: ImageBitmap, options: { stamps: boolean }, onStep?: (done: number, total: number) => void): Promise<PageMarks>
  terminate(): void
}

let shared: SignatureClient | null = null

export function signatureClient(): SignatureClient {
  shared ??= createClient()
  return shared
}

function createClient(): SignatureClient {
  let worker: Worker | null = null
  let nextId = 1
  const pending = new Map<number, Pending>()

  const ensure = (): Worker => {
    if (worker) return worker
    const w = new Worker(new URL('./signature.worker.ts', import.meta.url), { type: 'module', name: 'signature' })
    w.onmessage = (event: MessageEvent<SignatureResponse>) => {
      const msg = event.data
      const p = pending.get(msg.id)
      if (!p) return
      if (msg.type === 'progress' || msg.type === 'step') {
        p.onProgress?.(msg.type === 'progress' ? msg.loaded : msg.done, msg.total)
        return
      }
      pending.delete(msg.id)
      if (msg.type === 'loaded') p.resolve(null)
      else if (msg.type === 'result') p.resolve(msg.marks)
      else p.reject(new Error(msg.message))
    }
    w.onerror = (event) => {
      event.preventDefault()
      for (const p of pending.values()) p.reject(new Error('The signature finder stopped. Reload the page and try again.'))
      pending.clear()
      w.terminate()
      worker = null
    }
    worker = w
    return w
  }

  const send = (req: SignatureRequest, p: Pending, transfer: Transferable[] = []) => {
    pending.set(req.id, p)
    ensure().postMessage(req, transfer)
  }

  return {
    load(onProgress) {
      return new Promise<void>((resolve, reject) => send({ id: nextId++, type: 'load' }, { resolve: () => resolve(), reject, onProgress }))
    },
    detect(image, options, onStep) {
      return new Promise<PageMarks>((resolve, reject) =>
        send(
          { id: nextId++, type: 'detect', image, stamps: options.stamps },
          { resolve: (m) => resolve(m ?? { signatures: [], stamps: [] }), reject, onProgress: onStep },
          [image],
        ),
      )
    },
    terminate() {
      worker?.terminate()
      worker = null
      for (const p of pending.values()) p.reject(new DOMException('Cancelled', 'AbortError'))
      pending.clear()
    },
  }
}
