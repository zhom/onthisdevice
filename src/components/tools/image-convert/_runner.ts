/**
 * Thin client around `_worker.ts`.
 *
 * Prefers a dedicated worker so wasm encoding never freezes the page, and falls
 * back to running the same engine on the main thread when a worker cannot be
 * created or dies (hardened CSPs, very old browsers, file:// pages).
 *
 * Buffers are copied rather than transferred: the memcpy is trivial next to the
 * decode/encode cost, and keeping the caller's copy intact is what makes the
 * inline retry below possible.
 */
import { describeError, runJob } from './_engine'
import type { JobOutput, JobSource, EncodeSettings, WorkerRequest, WorkerResponse } from './_engine'

export interface JobRunner {
  run(source: JobSource, settings: EncodeSettings): Promise<JobOutput>
  dispose(): void
}

interface Pending {
  resolve: (value: JobOutput) => void
  reject: (reason: Error) => void
  source: JobSource
  settings: EncodeSettings
}

export function createJobRunner(): JobRunner {
  let worker: Worker | null = null
  let workerUnavailable = false
  let disposed = false
  let seq = 0
  const pending = new Map<number, Pending>()

  const inline = (source: JobSource, settings: EncodeSettings): Promise<JobOutput> =>
    runJob(source, settings).catch((err: unknown) => {
      throw new Error(describeError(err))
    })

  const ensureWorker = (): Worker | null => {
    if (disposed || workerUnavailable) return null
    if (worker) return worker
    if (typeof Worker === 'undefined') {
      workerUnavailable = true
      return null
    }

    try {
      const created = new Worker(new URL('./_worker.ts', import.meta.url), {
        type: 'module',
        name: 'image-convert',
      })

      created.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
        const message = event.data
        const entry = pending.get(message.id)
        if (!entry) return
        pending.delete(message.id)
        if (message.ok) {
          entry.resolve({
            bytes: message.bytes,
            mime: message.mime,
            width: message.width,
            height: message.height,
          })
        } else {
          entry.reject(new Error(message.error))
        }
      })

      created.addEventListener('error', (event: Event) => {
        // The worker could not start, or crashed. Stop using it and finish every
        // job that was in flight on the main thread instead.
        event.preventDefault()
        workerUnavailable = true
        const inFlight = [...pending.values()]
        pending.clear()
        created.terminate()
        if (worker === created) worker = null
        if (disposed) return
        for (const entry of inFlight) {
          void inline(entry.source, entry.settings).then(entry.resolve, entry.reject)
        }
      })

      worker = created
      return created
    } catch {
      workerUnavailable = true
      worker = null
      return null
    }
  }

  return {
    run(source, settings) {
      const active = ensureWorker()
      if (!active) return inline(source, settings)

      const id = ++seq
      return new Promise<JobOutput>((resolve, reject) => {
        pending.set(id, { resolve, reject, source, settings })
        const request: WorkerRequest = { id, source, settings }
        try {
          active.postMessage(request)
        } catch {
          // Structured clone refused the payload — do it here instead.
          pending.delete(id)
          void inline(source, settings).then(resolve, reject)
        }
      })
    },
    dispose() {
      disposed = true
      for (const entry of pending.values()) entry.reject(new Error('Conversion cancelled.'))
      pending.clear()
      worker?.terminate()
      worker = null
    },
  }
}
