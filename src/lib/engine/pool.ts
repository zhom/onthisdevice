/**
 * A pool of workers, each with its own copy of the engine. Parallel work is a queue of
 * short tasks, so a fast core takes more of them than a slow one, and progress and
 * cancellation need no help from the kernels.
 */
import type { TaskArgs, TaskName, TaskResult } from './tasks'
import type { WorkerReply, WorkerRequest } from './engine.worker'

export class EngineError extends Error {}

interface RunOptions {
  signal?: AbortSignal
  onProgress?: (done: number) => void
}

interface Job {
  name: TaskName
  args: TaskArgs<TaskName>
  options: RunOptions
  resolve: (value: never) => void
  reject: (reason: unknown) => void
}

interface Slot {
  worker: Worker
  job: Job | null
  id: number
}

/** Leaves one core for the page, so scrolling and typing stay smooth at full load. */
export const POOL_SIZE = Math.min(16, Math.max(1, (globalThis.navigator?.hardwareConcurrency ?? 2) - 1))

let module: Promise<WebAssembly.Module> | null = null
const slots: Slot[] = []
const queue: Job[] = []

function engine(): Promise<WebAssembly.Module> {
  module ??= WebAssembly.compileStreaming(fetch(new URL('./engine.wasm', import.meta.url))).catch((cause: unknown) => {
    module = null
    throw new EngineError(`The calculation engine could not start: ${cause instanceof Error ? cause.message : String(cause)}`)
  })
  return module
}

function send(worker: Worker, request: WorkerRequest): void {
  worker.postMessage(request)
}

function spawn(compiled: WebAssembly.Module): Slot {
  const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module', name: 'engine' })
  const slot: Slot = { worker, job: null, id: 0 }
  send(worker, { module: compiled })
  worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
    const job = slot.job
    if (!job || data.id !== slot.id) return
    if ('done' in data) {
      job.options.onProgress?.(data.done)
      return
    }
    slot.job = null
    if ('error' in data) job.reject(new EngineError(data.error))
    else job.resolve(data.value as never)
    void pump()
  }
  worker.onerror = (event) => {
    event.preventDefault()
    slots.splice(slots.indexOf(slot), 1)
    slot.job?.reject(new EngineError(`The calculation engine stopped: ${event.message}`))
    void pump()
  }
  return slot
}

function start(slot: Slot, job: Job): void {
  slot.job = job
  slot.id += 1
  send(slot.worker, { id: slot.id, name: job.name, args: job.args })
}

async function pump(): Promise<void> {
  if (queue.length === 0) return
  const compiled = await engine()
  while (queue.length > 0) {
    let slot = slots.find((s) => s.job === null)
    if (!slot && slots.length < POOL_SIZE) {
      slot = spawn(compiled)
      slots.push(slot)
    }
    if (!slot) return
    start(slot, queue.shift()!)
  }
}

/** A running task cannot be interrupted, so its worker is replaced. */
function abandon(job: Job, reason: unknown): void {
  job.reject(reason)
  const queued = queue.indexOf(job)
  if (queued >= 0) {
    queue.splice(queued, 1)
    return
  }
  const at = slots.findIndex((s) => s.job === job)
  if (at >= 0) {
    slots[at]!.worker.terminate()
    slots.splice(at, 1)
    void pump()
  }
}

export function run<N extends TaskName>(name: N, args: TaskArgs<N>, options: RunOptions = {}): Promise<TaskResult<N>> {
  return new Promise<TaskResult<N>>((resolve, reject) => {
    const { signal } = options
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const job: Job = { name, args, options, resolve: resolve as (value: never) => void, reject }
    signal?.addEventListener('abort', () => abandon(job, signal.reason), { once: true })
    queue.push(job)
    pump().catch((cause: unknown) => abandon(job, cause))
  })
}

/**
 * Runs tasks from `next` on all workers until it returns null. `next` is called in order,
 * so tasks start in order; they may end in any order.
 */
export async function fanOut(next: () => Promise<unknown> | null): Promise<void> {
  const lane = async () => {
    for (let task = next(); task; task = next()) await task
  }
  await Promise.all(Array.from({ length: POOL_SIZE }, lane))
}
