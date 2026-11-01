/**
 * Main-thread access to the face and plate detectors, which run in one
 * shared Web Worker (./vision.worker.ts).
 *
 *   const vision = visionClient()
 *   await vision.load('face', (loaded, total) => ...)          // download + compile
 *   const boxes = await vision.detect(bitmap, { model: 'face' }, onStep)
 *   // boxes: Detection[] in pixels of `bitmap` ({ x, y, w, h, score })
 *
 * `detect` takes ownership of the bitmap (it is transferred and closed); pass
 * a copy (`await createImageBitmap(bitmap)`) when you still need it, or a
 * downscaled one with `scale` set to map the boxes back. Requests run one at
 * a time in order. `modelDownloadBytes(model)` and `modelIsCached(model)`
 * (./models.ts) give the "Downloads N MB once" note.
 */
import type { Detection } from './geometry'
import type { DetectJob, VisionRequest, VisionResponse } from './vision.worker'
import type { VisionModel } from './models'

export type { Detection } from './geometry'
export type { DetectJob } from './vision.worker'
export type { VisionModel } from './models'
export { modelDownloadBytes, modelIsCached } from './models'

type Pending = {
  resolve: (d: Detection[]) => void
  reject: (e: Error) => void
  onProgress?: (loaded: number, total: number) => void
  onStep?: (done: number, total: number) => void
}

export interface VisionClient {
  load(model: VisionModel, onProgress?: (loaded: number, total: number) => void): Promise<void>
  detect(
    image: ImageBitmap | VideoFrame,
    job: DetectJob & { scale?: number },
    onStep?: (done: number, total: number) => void,
  ): Promise<Detection[]>
  /** Stops the worker. The next call starts a new one. */
  terminate(): void
}

let shared: VisionClient | null = null

export function visionClient(): VisionClient {
  shared ??= createVisionClient()
  return shared
}

function createVisionClient(): VisionClient {
  let worker: Worker | null = null
  let nextId = 1
  const pending = new Map<number, Pending>()

  const failAll = (message: string) => {
    for (const p of pending.values()) p.reject(new Error(message))
    pending.clear()
  }

  const ensure = (): Worker => {
    if (worker) return worker
    const w = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module', name: 'vision' })
    w.onmessage = (event: MessageEvent<VisionResponse>) => {
      const msg = event.data
      const p = pending.get(msg.id)
      if (!p) return
      if (msg.type === 'progress') p.onProgress?.(msg.loaded, msg.total)
      else if (msg.type === 'step') p.onStep?.(msg.done, msg.total)
      else {
        pending.delete(msg.id)
        if (msg.type === 'result') p.resolve(msg.detections)
        else p.reject(new Error(msg.message))
      }
    }
    w.onerror = (event) => {
      event.preventDefault()
      failAll('The detector stopped. Reload the page and try again.')
      w.terminate()
      worker = null
    }
    worker = w
    return w
  }

  const send = (req: VisionRequest, p: Pending, transfer: Transferable[] = []) => {
    pending.set(req.id, p)
    ensure().postMessage(req, transfer)
  }

  return {
    load(model, onProgress) {
      return new Promise<void>((resolve, reject) => {
        send({ id: nextId++, type: 'load', model }, { resolve: () => resolve(), reject, onProgress })
      })
    },
    detect(image, job, onStep) {
      return new Promise<Detection[]>((resolve, reject) => {
        send({ id: nextId++, type: 'detect', image, ...job }, { resolve, reject, onStep }, [image])
      })
    },
    terminate() {
      failAll('Stopped.')
      worker?.terminate()
      worker = null
    },
  }
}
