/**
 * Sends image jobs to worker.ts, one worker per page. Falls back to the main thread when a
 * worker cannot start. Source bytes are copied, so a failed worker job can run again inline.
 */
import { describeImageError, runImageJob } from './engine'
import type { ImageOptions, ImageResult, ImageSource } from './engine'
import type { ImageRequest, ImageResponse } from './worker'

export interface ImageClient {
  run(source: ImageSource, options: ImageOptions): Promise<ImageResult>
  dispose(): void
}

export function createImageClient(): ImageClient {
  let worker: Worker | null = null
  let broken = false
  let seq = 0
  const pending = new Map<number, { resolve: (r: ImageResult) => void; reject: (e: Error) => void; source: ImageSource; options: ImageOptions }>()

  const inline = (source: ImageSource, options: ImageOptions) =>
    runImageJob(source, options).catch((err: unknown) => {
      throw new Error(describeImageError(err))
    })

  const ensure = (): Worker | null => {
    if (broken || typeof Worker === 'undefined') return null
    if (worker) return worker
    try {
      const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'image-pair' })
      w.addEventListener('message', (event: MessageEvent<ImageResponse>) => {
        const m = event.data
        const entry = pending.get(m.id)
        if (!entry) return
        pending.delete(m.id)
        if (m.ok) entry.resolve(m.result)
        else entry.reject(new Error(m.error))
      })
      w.addEventListener('error', (event) => {
        event.preventDefault()
        broken = true
        w.terminate()
        worker = null
        const inFlight = [...pending.values()]
        pending.clear()
        for (const e of inFlight) inline(e.source, e.options).then(e.resolve, e.reject)
      })
      worker = w
      return w
    } catch {
      broken = true
      return null
    }
  }

  return {
    run(source, options) {
      const w = ensure()
      if (!w) return inline(source, options)
      const id = ++seq
      return new Promise<ImageResult>((resolve, reject) => {
        pending.set(id, { resolve, reject, source, options })
        const copy: ImageSource = source.kind === 'bytes' ? { ...source, bytes: source.bytes.slice(0) } : { ...source, data: source.data.slice() }
        const request: ImageRequest = { id, source: copy, options }
        w.postMessage(request, copy.kind === 'bytes' ? [copy.bytes] : [copy.data.buffer])
      })
    },
    dispose() {
      for (const e of pending.values()) e.reject(new Error('Cancelled.'))
      pending.clear()
      worker?.terminate()
      worker = null
    },
  }
}
