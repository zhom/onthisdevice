import { Kernels } from './kernels'
import { tasks } from './tasks'
import type { TaskArgs, TaskName } from './tasks'

export type WorkerRequest = { module: WebAssembly.Module } | { id: number; name: TaskName; args: TaskArgs<TaskName> }
export type WorkerReply = { id: number; value: unknown } | { id: number; done: number } | { id: number; error: string }

const post = (reply: WorkerReply) => self.postMessage(reply)
let kernels: Promise<Kernels> | null = null

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  if ('module' in data) {
    kernels = WebAssembly.instantiate(data.module).then((instance) => new Kernels(instance))
    return
  }
  const { id, name, args } = data
  try {
    const run = tasks[name] as (k: Kernels, a: unknown, progress: (done: number) => void) => unknown
    post({ id, value: await run(await kernels!, args, (done) => post({ id, done })) })
  } catch (cause) {
    post({ id, error: cause instanceof Error ? cause.message : String(cause) })
  }
}
