/**
 * Typed calls from the page to a model worker.
 *
 * In the worker:
 *   const handlers = { async load(args: A, ctx: Ctx) {...}, async run(args: B, ctx: Ctx<Event>) {...} }
 *   export type Api = typeof handlers
 *   serve(handlers)
 *
 * In the page:
 *   const client = workerClient<Api>(() => new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' }))
 *   const out = await client.call('run', args, { onProgress, onEvent, signal, transfer })
 *
 * `ctx.progress` reports bytes or steps, `ctx.emit` sends partial results, `ctx.transfer`
 * lists buffers to move with the result. An aborted signal rejects the call at once with an
 * AbortError and tells the worker, which stops at its next `ctx.check()`.
 */

export interface Ctx<E = never> {
  progress(done: number, total: number): void
  emit(event: E, transfer?: Transferable[]): void
  /** Throws an AbortError when the page cancelled this call. */
  check(): void
  /** Buffers to transfer with the result. */
  transfer: Transferable[]
}

// `never` arguments accept every handler: a parameter type is checked the other way round.
type Handler = (args: never, ctx: Ctx<never>) => Promise<unknown>
export type Handlers = Record<string, Handler>

type ArgsOf<F> = F extends (args: infer A, ctx: never) => unknown ? A : never
type EventOf<F> = F extends (args: never, ctx: Ctx<infer E>) => unknown ? E : never
type ResultOf<F> = F extends (...args: never[]) => Promise<infer R> ? R : never

type Request = { id: number; method: string; args: unknown } | { id: number; method: '$cancel' }
type Reply =
  | { id: number; kind: 'progress'; done: number; total: number }
  | { id: number; kind: 'event'; event: unknown }
  | { id: number; kind: 'done'; result: unknown }
  | { id: number; kind: 'error'; message: string; cancelled: boolean }

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function abortError(): DOMException {
  return new DOMException('Cancelled', 'AbortError')
}

/** Plain words for the errors a model run can end with. */
export function errorMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  if (/memory|allocation|OOM|bad_alloc|RangeError: Array buffer/i.test(text))
    return 'This device ran out of memory. Close other tabs, or try a smaller file.'
  if (/Could not load|HTTP \d|Failed to fetch|NetworkError/i.test(text)) return 'A model file did not download. Check your connection and try again.'
  return text.slice(0, 240) || 'The model stopped.'
}

export function serve(handlers: Handlers): void {
  const scope = self as unknown as DedicatedWorkerGlobalScope
  const cancelled = new Set<number>()
  const post = (msg: Reply, transfer: Transferable[] = []) => scope.postMessage(msg, transfer)

  scope.onmessage = async (event: MessageEvent<Request>) => {
    const req = event.data
    if (req.method === '$cancel') {
      cancelled.add(req.id)
      return
    }
    const handler = handlers[req.method]
    const ctx: Ctx<unknown> = {
      progress: (done, total) => post({ id: req.id, kind: 'progress', done, total }),
      emit: (ev, transfer) => post({ id: req.id, kind: 'event', event: ev }, transfer),
      check: () => {
        if (cancelled.has(req.id)) throw abortError()
      },
      transfer: [],
    }
    try {
      if (!handler) throw new Error(`Unknown call ${req.method}`)
      const result = await (handler as (args: unknown, ctx: Ctx<unknown>) => Promise<unknown>)('args' in req ? req.args : undefined, ctx)
      post({ id: req.id, kind: 'done', result }, ctx.transfer)
    } catch (err) {
      post({ id: req.id, kind: 'error', message: isAbort(err) ? 'Cancelled' : errorMessage(err), cancelled: isAbort(err) })
    } finally {
      cancelled.delete(req.id)
    }
  }
}

export interface CallOptions<E> {
  onProgress?: (done: number, total: number) => void
  onEvent?: (event: E) => void
  signal?: AbortSignal
  transfer?: Transferable[]
}

export interface WorkerClient<H extends Handlers> {
  call<K extends keyof H & string>(method: K, args: ArgsOf<H[K]>, opts?: CallOptions<EventOf<H[K]>>): Promise<ResultOf<H[K]>>
  /** Stops the worker at once; the next call starts a new one (models load again from the cache). */
  terminate(): void
}

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: unknown) => void
  onProgress?: (done: number, total: number) => void
  onEvent?: (event: unknown) => void
}

export function workerClient<H extends Handlers>(make: () => Worker): WorkerClient<H> {
  let worker: Worker | null = null
  let nextId = 1
  const pending = new Map<number, Pending>()

  const failAll = (err: unknown) => {
    for (const p of pending.values()) p.reject(err)
    pending.clear()
  }

  const ensure = (): Worker => {
    if (worker) return worker
    const w = make()
    w.onmessage = (event: MessageEvent<Reply>) => {
      const msg = event.data
      const p = pending.get(msg.id)
      if (!p) return
      if (msg.kind === 'progress') p.onProgress?.(msg.done, msg.total)
      else if (msg.kind === 'event') p.onEvent?.(msg.event)
      else {
        pending.delete(msg.id)
        if (msg.kind === 'done') p.resolve(msg.result)
        else p.reject(msg.cancelled ? abortError() : new Error(msg.message))
      }
    }
    w.onerror = (event) => {
      event.preventDefault()
      failAll(new Error('The model stopped. This device may be short of memory. Reload the page and try again.'))
      w.terminate()
      if (worker === w) worker = null
    }
    worker = w
    return w
  }

  return {
    call(method, args, opts = {}) {
      return new Promise((resolve, reject) => {
        if (opts.signal?.aborted) return reject(abortError())
        const id = nextId++
        pending.set(id, {
          resolve: resolve as (v: unknown) => void,
          reject,
          onProgress: opts.onProgress,
          onEvent: opts.onEvent as ((event: unknown) => void) | undefined,
        })
        const w = ensure()
        opts.signal?.addEventListener(
          'abort',
          () => {
            if (!pending.delete(id)) return
            w.postMessage({ id, method: '$cancel' } satisfies Request)
            reject(abortError())
          },
          { once: true },
        )
        w.postMessage({ id, method, args } satisfies Request, opts.transfer ?? [])
      })
    },
    terminate() {
      worker?.terminate()
      worker = null
      failAll(abortError())
    },
  }
}
