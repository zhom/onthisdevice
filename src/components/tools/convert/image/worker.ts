/** Runs image pair jobs off the main thread: wasm decoders and encoders block for seconds. */
import { describeImageError, runImageJob } from './engine'
import type { ImageOptions, ImageResult, ImageSource } from './engine'

export interface ImageRequest {
  id: number
  source: ImageSource
  options: ImageOptions
}

export type ImageResponse = { id: number; ok: true; result: ImageResult } | { id: number; ok: false; error: string }

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<ImageRequest>) => void): void
  postMessage(message: ImageResponse, transfer?: Transferable[]): void
}

const scope = self as unknown as WorkerScope

scope.addEventListener('message', (event) => {
  const { id, source, options } = event.data
  runImageJob(source, options).then(
    (result) => scope.postMessage({ id, ok: true, result }, result.outputs.map((o) => o.bytes)),
    (err: unknown) => scope.postMessage({ id, ok: false, error: describeImageError(err) }),
  )
})
