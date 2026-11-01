/// <reference lib="webworker" />
/**
 * Worker that runs the face and plate detectors. Talk to it through
 * ./client.ts, which owns the message protocol below.
 */
import { createSession, loadOrt, sessionRunner } from '../ort'
import { findFaces } from './faces'
import type { FaceOptions } from './faces'
import { findPlates } from './plates'
import type { PlateOptions } from './plates'
import { canvasReader } from './runner'
import type { Runner } from './runner'
import { MODEL_PATH } from './models'
import type { VisionModel } from './models'
import type { Detection } from './geometry'

/** Which detector to run, with its own options. */
export type DetectJob = { model: 'face'; options?: FaceOptions } | { model: 'plate'; options?: PlateOptions }

export type VisionRequest =
  | { id: number; type: 'load'; model: VisionModel }
  | ({
      id: number
      type: 'detect'
      image: ImageBitmap | VideoFrame
      /** Multiply the boxes by this factor (the image was sent downscaled). */
      scale?: number
    } & DetectJob)

export type VisionResponse =
  | { id: number; type: 'progress'; loaded: number; total: number }
  | { id: number; type: 'step'; done: number; total: number }
  | { id: number; type: 'result'; detections: Detection[] }
  | { id: number; type: 'error'; message: string }

const scope = self as unknown as DedicatedWorkerGlobalScope
const runners = new Map<VisionModel, Promise<Runner>>()

function runnerFor(model: VisionModel, id: number): Promise<Runner> {
  let job = runners.get(model)
  if (!job) {
    job = (async () => {
      const session = await createSession(MODEL_PATH[model], {
        onProgress: (loaded, total) => post({ id, type: 'progress', loaded, total }),
      })
      return sessionRunner(await loadOrt(), session)
    })()
    runners.set(model, job)
    job.catch(() => runners.delete(model))
  }
  return job
}

function post(msg: VisionResponse) {
  scope.postMessage(msg)
}

function message(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'Detection failed.'
}

scope.onmessage = async (event: MessageEvent<VisionRequest>) => {
  const req = event.data
  try {
    const run = await runnerFor(req.model, req.id)
    if (req.type === 'load') {
      post({ id: req.id, type: 'result', detections: [] })
      return
    }
    const { image } = req
    const width = 'displayWidth' in image ? image.displayWidth : image.width
    const height = 'displayHeight' in image ? image.displayHeight : image.height
    const reader = canvasReader(image, width, height)
    const onStep = (done: number, total: number) => post({ id: req.id, type: 'step', done, total })
    let found: Detection[]
    try {
      found =
        req.model === 'face'
          ? await findFaces(reader, run, req.options, onStep)
          : await findPlates(reader, run, req.options, onStep)
    } finally {
      image.close()
    }
    const k = req.scale ?? 1
    const detections = found.map((d) => ({ x: d.x * k, y: d.y * k, w: d.w * k, h: d.h * k, score: d.score }))
    post({ id: req.id, type: 'result', detections })
  } catch (err) {
    post({ id: req.id, type: 'error', message: message(err) })
  }
}
