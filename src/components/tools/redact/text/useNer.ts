import { useCallback, useEffect, useRef, useState } from 'react'
import { nerClient, nerDownloadBytes, nerIsCached } from '@/lib/ml/text/ner-client'
import type { Span } from '@/lib/ml/text/types'

export type NerPhase = 'checking' | 'idle' | 'loading' | 'ready' | 'running' | 'error'

export interface NerState {
  phase: NerPhase
  /** Download or processing progress, 0..100. */
  progress: number
  error: string | null
  /** Spans for `text` exactly; null while the text has not been read yet. */
  spans: Span[] | null
  downloadBytes: number
  start: () => void
}

/**
 * Runs the language model on `text` after it stops changing. The model loads
 * by itself when it is already in the cache; otherwise `start()` downloads it.
 */
export function useNer(text: string, enabled = true, delayMs = 450): NerState {
  const [phase, setPhase] = useState<NerPhase>('checking')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ text: string; spans: Span[] } | null>(null)
  const loading = useRef(false)

  const start = useCallback(() => {
    if (loading.current) return
    loading.current = true
    setPhase('loading')
    setError(null)
    setProgress(0)
    nerClient()
      .load((loaded, total) => setProgress(total > 0 ? Math.round((loaded / total) * 100) : 0))
      .then(() => setPhase('ready'))
      .catch((err: unknown) => {
        loading.current = false
        setPhase('error')
        setError(err instanceof Error ? err.message : 'The language model could not load.')
      })
  }, [])

  useEffect(() => {
    if (!enabled) return
    let live = true
    void nerIsCached().then((cached) => {
      if (!live) return
      if (cached) start()
      else setPhase((p) => (p === 'checking' ? 'idle' : p))
    })
    return () => {
      live = false
    }
  }, [enabled, start])

  const ready = phase === 'ready' || phase === 'running'
  useEffect(() => {
    if (!enabled || !ready) return
    if (!text.trim()) {
      setResult({ text, spans: [] })
      return
    }
    let live = true
    const timer = window.setTimeout(() => {
      setPhase('running')
      setProgress(0)
      nerClient()
        .run(text, (done, total) => live && setProgress(Math.round((done / Math.max(1, total)) * 100)))
        .then((spans) => {
          if (!live) return
          setResult({ text, spans })
          setPhase('ready')
        })
        .catch((err: unknown) => {
          if (!live || (err instanceof DOMException && err.name === 'AbortError')) return
          setPhase('error')
          setError(err instanceof Error ? err.message : 'The language model failed.')
        })
    }, delayMs)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [text, enabled, ready, delayMs])

  return {
    phase,
    progress,
    error,
    spans: result && result.text === text ? result.spans : null,
    downloadBytes: nerDownloadBytes(),
    start,
  }
}
