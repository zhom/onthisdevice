/// <reference lib="webworker" />
/**
 * Worker for blur-faces-in-video: scans the video for faces and tracks them,
 * then re-encodes it with the hidden tracks redacted. One job at a time;
 * `cancel` stops the running job. Track boxes are fractions (0..1) of the
 * frame, so the scan size and the export size can differ.
 */
import { createSession, loadOrt, sessionRunner } from '@/lib/ml/ort'
import { findFaces } from '@/lib/ml/vision/faces'
import type { FaceOptions } from '@/lib/ml/vision/faces'
import { MODEL_PATH } from '@/lib/ml/vision/models'
import { canvasReader } from '@/lib/ml/vision/runner'
import { Tracker, boxesAt } from '@/lib/ml/vision/tracker'
import type { Track, TrackKey } from '@/lib/ml/vision/tracker'
import { renderVideo, scanVideo } from '@/lib/ml/video/pipeline'
import type { RenderProgress, RenderResult, VideoInfo } from '@/lib/ml/video/pipeline'
import { padded } from '../shared/pad'
import { paintRedactions } from '../shared/paint'
import type { RedactLook } from '../shared/paint'

/** normal: frames at 1280 px, passes at 640 and 1280. high: 1920 px, passes at 960 and 1920 (small faces, about 3x slower). */
export type ScanDetail = 'normal' | 'high'

export type FaceVideoRequest =
  | { type: 'scan'; file: File; fps: number; detail: ScanDetail }
  | { type: 'render'; file: File; tracks: Track[]; look: RedactLook; hold: number }
  | { type: 'cancel' }

export type FaceVideoResponse =
  | { type: 'download'; loaded: number; total: number }
  | { type: 'scan-progress'; index: number; total: number; secondsLeft: number | null }
  | { type: 'scanned'; info: VideoInfo; tracks: Track[]; thumbs: { id: number; bitmap: ImageBitmap }[] }
  | { type: 'render-progress'; progress: RenderProgress }
  | { type: 'rendered'; result: RenderResult }
  | { type: 'error'; message: string; canceled: boolean }

const SCAN: Record<ScanDetail, { side: number; faces: FaceOptions }> = {
  normal: { side: 1280, faces: { minScore: 0.5, sizes: [640, 1280], tiles: false } },
  high: { side: 1920, faces: { minScore: 0.5, sizes: [960, 1920], tiles: false } },
}
const THUMB = 96

const scope = self as unknown as DedicatedWorkerGlobalScope
let job: AbortController | null = null

function post(msg: FaceVideoResponse, transfer: Transferable[] = []) {
  scope.postMessage(msg, transfer)
}

function toFraction(k: TrackKey, w: number, h: number): TrackKey {
  return { ...k, x: k.x / w, y: k.y / h, w: k.w / w, h: k.h / h }
}

async function scan(file: File, fps: number, detail: ScanDetail, signal: AbortSignal) {
  const settings = SCAN[detail]
  const session = await createSession(MODEL_PATH.face, {
    onProgress: (loaded, total) => post({ type: 'download', loaded, total }),
  })
  const run = sessionRunner(await loadOrt(), session)
  const tracker = new Tracker()
  const thumbs = new Map<number, ImageBitmap>()
  let size = { w: 1, h: 1 }
  const began = performance.now()

  const info = await scanVideo(file, {
    fps,
    maxSide: settings.side,
    signal,
    onFrame: async (canvas, t, index, total) => {
      size = { w: canvas.width, h: canvas.height }
      const faces = await findFaces(canvasReader(canvas, canvas.width, canvas.height), run, settings.faces)
      for (const tr of tracker.update(t, faces)) {
        if (tr.best.t !== t) continue
        const b = padded(tr.best, 'face', { width: canvas.width, height: canvas.height })
        const side = Math.max(b.w, b.h)
        const bitmap = await createImageBitmap(canvas, b.x + b.w / 2 - side / 2, b.y + b.h / 2 - side / 2, side, side, {
          resizeWidth: THUMB,
          resizeHeight: THUMB,
          resizeQuality: 'medium',
        })
        thumbs.get(tr.id)?.close()
        thumbs.set(tr.id, bitmap)
      }
      const done = index + 1
      const spent = (performance.now() - began) / 1000
      post({ type: 'scan-progress', index: done, total, secondsLeft: done >= 5 ? (spent / done) * (total - done) : null })
    },
  })

  const tracks = tracker.finish().map((tr) => ({
    ...tr,
    keys: tr.keys.map((k) => toFraction(k, size.w, size.h)),
    best: toFraction(tr.best, size.w, size.h),
  }))
  const kept = new Set(tracks.map((t) => t.id))
  const out: { id: number; bitmap: ImageBitmap }[] = []
  for (const [id, bitmap] of thumbs) {
    if (kept.has(id)) out.push({ id, bitmap })
    else bitmap.close()
  }
  post({ type: 'scanned', info, tracks, thumbs: out }, out.map((o) => o.bitmap))
}

async function render(file: File, tracks: Track[], look: RedactLook, hold: number, signal: AbortSignal) {
  const result = await renderVideo(file, {
    signal,
    onProgress: (progress) => post({ type: 'render-progress', progress }),
    paint: (ctx, t, width, height) => {
      const boxes = boxesAt(tracks, t, hold).map((b) =>
        padded({ x: b.x * width, y: b.y * height, w: b.w * width, h: b.h * height }, 'face', { width, height }),
      )
      if (boxes.length > 0) paintRedactions(ctx, boxes, look)
    },
  })
  post({ type: 'rendered', result })
}

scope.onmessage = async (event: MessageEvent<FaceVideoRequest>) => {
  const req = event.data
  if (req.type === 'cancel') {
    job?.abort()
    return
  }
  job?.abort()
  const controller = new AbortController()
  job = controller
  try {
    if (req.type === 'scan') await scan(req.file, req.fps, req.detail, controller.signal)
    else await render(req.file, req.tracks, req.look, req.hold, controller.signal)
  } catch (err) {
    const canceled = controller.signal.aborted
    const message = canceled ? 'Canceled.' : err instanceof Error && err.message ? err.message : 'The video could not be processed.'
    post({ type: 'error', message, canceled })
  } finally {
    if (job === controller) job = null
  }
}
