import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { RefObject } from 'react'

/** Ease-out close to the site's cubic-bezier(0.22, 1, 0.36, 1). */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

export const TWEEN_MS = 320

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/* ── reduced motion ─────────────────────────────────────────────── */

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribeMotion(cb: () => void): () => void {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/** True when the visitor asks for reduced motion. False on the server. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}

/* ── resampling ─────────────────────────────────────────────────── */

/**
 * Resample a row to `len` items by position along the row. `stride` 2 treats
 * the row as interleaved x,y pairs and resamples points.
 */
export function resample(row: readonly number[], len: number, stride: 1 | 2 = 1): number[] {
  const n = Math.floor(row.length / stride)
  const m = Math.floor(len / stride)
  if (n === m) return row.slice(0, len)
  const out = new Array<number>(len).fill(0)
  if (n === 0) return out
  for (let k = 0; k < m; k++) {
    const f = m === 1 ? 0 : (k / (m - 1)) * (n - 1)
    const i = Math.floor(f)
    const j = Math.min(n - 1, i + 1)
    const t = f - i
    for (let s = 0; s < stride; s++) {
      const a = row[i * stride + s] ?? 0
      const b = row[j * stride + s] ?? 0
      out[k * stride + s] = a + (b - a) * t
    }
  }
  return out
}

function sameRows(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): boolean {
  if (a.length !== b.length) return false
  for (let r = 0; r < a.length; r++) {
    const x = a[r]!
    const y = b[r]!
    if (x.length !== y.length) return false
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false
  }
  return true
}

/* ── the tween core ─────────────────────────────────────────────── */

export interface TweenOptions {
  /** Duration in ms. Default 320. */
  duration?: number
  /** Start value on first mount. Omit to start at the target (no entry tween). */
  from?: number[][]
  /** 2 for rows of interleaved x,y points (resampled as points). Default 1. */
  stride?: 1 | 2
}

/**
 * Tween a matrix of numbers toward `target`. Interruptible: a new target starts
 * from the value on screen. Rows that change length are resampled first, so a
 * 30-year curve can morph into a 15-year curve. Reduced motion: no tween.
 */
export function useTweenRows(target: number[][], opts: TweenOptions = {}): number[][] {
  const { duration = TWEEN_MS, stride = 1 } = opts
  const reduced = useReducedMotion()
  const [shown, setShown] = useState<number[][]>(() => opts.from ?? target)
  const shownRef = useRef(shown)
  const targetRef = useRef<number[][]>(opts.from ?? target)
  const raf = useRef(0)
  const running = useRef(false)

  useIsoLayoutEffect(() => {
    const same = sameRows(targetRef.current, target)
    if (same && !(reduced && running.current)) return
    targetRef.current = target
    cancelAnimationFrame(raf.current)
    running.current = false
    if (reduced || duration <= 0) {
      shownRef.current = target
      setShown(target)
      return
    }
    const start = target.map((row, r) => {
      const prev = shownRef.current[r] ?? shownRef.current[shownRef.current.length - 1] ?? []
      return prev.length === row.length ? prev.slice() : resample(prev.length ? prev : row.map(() => 0), row.length, stride)
    })
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / duration))
      const e = easeOut(t)
      const next = target.map((row, r) => {
        const a = start[r]!
        return row.map((v, i) => {
          const s = a[i] ?? v
          return s + (v - s) * e
        })
      })
      shownRef.current = next
      setShown(next)
      if (t < 1) raf.current = requestAnimationFrame(step)
      else running.current = false
    }
    running.current = true
    raf.current = requestAnimationFrame(step)
  })

  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  return shown
}

/** Tween one number. */
export function useTween(target: number, opts: { duration?: number; from?: number } = {}): number {
  const rows = useTweenRows([[Number.isFinite(target) ? target : 0]], {
    duration: opts.duration,
    from: opts.from === undefined ? undefined : [[opts.from]],
  })
  return rows[0]?.[0] ?? target
}

/** Tween an array of numbers (resampled by index when its length changes). */
export function useTweenArray(target: number[], opts: { duration?: number; from?: number[] } = {}): number[] {
  const rows = useTweenRows([target.map((v) => (Number.isFinite(v) ? v : 0))], {
    duration: opts.duration,
    from: opts.from === undefined ? undefined : [opts.from],
  })
  return rows[0] ?? target
}

/* ── size ───────────────────────────────────────────────────────── */

/** Width of an element in CSS px, kept current with a ResizeObserver. */
export function useWidth<T extends HTMLElement>(fallback = 640): [RefObject<T | null>, number, boolean] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(fallback)
  const [measured, setMeasured] = useState(false)
  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) {
        setWidth(w)
        setMeasured(true)
      }
    }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width, measured]
}
