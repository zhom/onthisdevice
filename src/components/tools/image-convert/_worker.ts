/**
 * Dedicated worker for image conversion.
 *
 * WebAssembly encoders block the thread they run on for as long as they work —
 * AVIF in particular can take seconds per image — so all decoding and encoding
 * happens here, leaving the UI free to paint progress and stay interactive.
 */
import { describeError, runJob } from './_engine'
import type { WorkerRequest, WorkerResponse } from './_engine'

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void): void
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void
}

const scope = self as unknown as WorkerScope

scope.addEventListener('message', (event) => {
  const { id, source, settings } = event.data
  void runJob(source, settings).then(
    (output) => {
      scope.postMessage(
        { id, ok: true, bytes: output.bytes, mime: output.mime, width: output.width, height: output.height },
        [output.bytes],
      )
    },
    (err: unknown) => {
      scope.postMessage({ id, ok: false, error: describeError(err) })
    },
  )
})
