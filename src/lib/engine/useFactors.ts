import { useCallback, useEffect, useRef, useState } from 'react'
import { factorize } from './factor'
import type { FactorState } from './factor'

export interface FactorRun extends FactorState {
  running: boolean
  error: string | null
  /** Time of the finished run, in milliseconds. */
  elapsed: number | null
  stop: () => void
}

/** Waits for a pause in typing. */
const DEBOUNCE = 200

/** Factors n in the background. Null clears the run. */
export function useFactors(n: bigint | null): FactorRun {
  const [state, setState] = useState<Omit<FactorRun, 'stop'>>({ running: false, primes: [], rest: 1n, digits: 0, error: null, elapsed: null })
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    setState({ running: n !== null, primes: [], rest: n ?? 1n, digits: 0, error: null, elapsed: null })
    if (n === null) return
    let live = true
    const job = new AbortController()
    controller.current = job
    const timer = setTimeout(() => {
      const started = performance.now()
      factorize(n, job.signal, (s) => {
        if (live) setState({ ...s, running: true, error: null, elapsed: null })
      }).then(
        (primes) => {
          if (live) setState({ running: false, primes, rest: 1n, digits: 0, error: null, elapsed: performance.now() - started })
        },
        (cause: unknown) => {
          if (!live) return
          const error = job.signal.aborted ? null : cause instanceof Error ? cause.message : 'The search could not finish.'
          setState((s) => ({ ...s, running: false, error }))
        },
      )
    }, DEBOUNCE)
    return () => {
      live = false
      clearTimeout(timer)
      job.abort()
    }
  }, [n])

  const stop = useCallback(() => controller.current?.abort(), [])
  return { ...state, stop }
}
