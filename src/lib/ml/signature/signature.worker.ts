/// <reference lib="webworker" />
/**
 * Worker that finds signatures (model) and stamps (ink heuristic) on page
 * images. Talk to it through ./client.ts.
 */
import { createSession, loadOrt, sessionRunner } from '../ort'
import type { Detection } from '../vision/geometry'
import { canvasReader } from '../vision/runner'
import type { Runner } from '../vision/runner'
import { SIGNATURE_MODEL } from './model'
import { findSignatures } from './signatures'
import { findStamps } from './stamps'

export type SignatureRequest =
  | { id: number; type: 'load' }
  | { id: number; type: 'detect'; image: ImageBitmap; stamps: boolean }

export interface PageMarks {
  signatures: Detection[]
  stamps: Detection[]
}

export type SignatureResponse =
  | { id: number; type: 'progress'; loaded: number; total: number }
  | { id: number; type: 'step'; done: number; total: number }
  | { id: number; type: 'loaded' }
  | { id: number; type: 'result'; marks: PageMarks }
  | { id: number; type: 'error'; message: string }

const scope = self as unknown as DedicatedWorkerGlobalScope
/** Stamps are looked for at this long side. */
const STAMP_SIDE = 1000

let runner: Promise<Runner> | null = null

function post(msg: SignatureResponse) {
  scope.postMessage(msg)
}

function load(id: number): Promise<Runner> {
  if (runner) return runner
  const job = (async () => {
    const session = await createSession(SIGNATURE_MODEL, { onProgress: (loaded, total) => post({ id, type: 'progress', loaded, total }) })
    return sessionRunner(await loadOrt(), session)
  })()
  runner = job
  job.catch(() => {
    if (runner === job) runner = null
  })
  return job
}

async function detect(id: number, image: ImageBitmap, stamps: boolean): Promise<PageMarks> {
  const run = await load(id)
  const { width, height } = image
  const reader = canvasReader(image, width, height)
  const signatures = await findSignatures(reader, run, { onStep: (done, total) => post({ id, type: 'step', done, total }) })
  let found: Detection[] = []
  if (stamps) {
    const k = Math.min(1, STAMP_SIDE / Math.max(width, height))
    const w = Math.max(1, Math.round(width * k))
    const h = Math.max(1, Math.round(height * k))
    found = findStamps(reader.read(0, 0, width, height, w, h), w, h).map((d) => ({ ...d, x: d.x / k, y: d.y / k, w: d.w / k, h: d.h / k }))
  }
  return { signatures, stamps: found }
}

scope.onmessage = async (event: MessageEvent<SignatureRequest>) => {
  const req = event.data
  try {
    if (req.type === 'load') {
      await load(req.id)
      post({ id: req.id, type: 'loaded' })
      return
    }
    try {
      post({ id: req.id, type: 'result', marks: await detect(req.id, req.image, req.stamps) })
    } finally {
      req.image.close()
    }
  } catch (err) {
    post({ id: req.id, type: 'error', message: err instanceof Error && err.message ? err.message : 'Signature detection failed.' })
  }
}
