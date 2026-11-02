import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { RefObject } from 'react'
import { useReducedMotion } from '@/components/viz/tween'

export { useReducedMotion }

/* ── tab visibility ─────────────────────────────────────────────── */

function subscribeTab(cb: () => void): () => void {
  document.addEventListener('visibilitychange', cb)
  return () => document.removeEventListener('visibilitychange', cb)
}

export function useTabVisible(): boolean {
  return useSyncExternalStore(subscribeTab, () => !document.hidden, () => true)
}

/* ── on screen ──────────────────────────────────────────────────── */

export function useOnScreen(target: RefObject<Element | null>, margin = '64px'): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = target.current
    if (!el) return
    const io = new IntersectionObserver((entries) => setOn(entries.some((e) => e.isIntersecting)), { rootMargin: margin })
    io.observe(el)
    return () => io.disconnect()
  }, [target, margin])
  return on
}

/* ── the frame loop ─────────────────────────────────────────────── */

export interface LoopState {
  /** The visitor asks for reduced motion: draw still frames only. */
  reduced: boolean
  /** The loop is running now. */
  live: boolean
}

/**
 * Calls `frame(dt)` once per animation frame while `running` is true, the
 * target is on screen and the tab is visible. `dt` is in seconds and capped
 * at 50 ms, so a resumed loop does not jump. Never runs under reduced motion.
 */
export function useSimLoop(target: RefObject<Element | null>, frame: (dt: number) => void, running = true): LoopState {
  const reduced = useReducedMotion()
  const onScreen = useOnScreen(target)
  const tab = useTabVisible()
  const frameRef = useRef(frame)
  useLayoutEffect(() => {
    frameRef.current = frame
  })
  const live = running && onScreen && tab && !reduced
  useEffect(() => {
    if (!live) return
    let id = 0
    let last = performance.now()
    const tick = (t: number) => {
      const dt = Math.min(0.05, Math.max(0, (t - last) / 1000))
      last = t
      frameRef.current(dt)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [live])
  return { reduced, live }
}

/* ── theme colours for canvas ───────────────────────────────────── */

export interface Ink {
  ink: string
  paper: string
  grey: string
  fill: string
  hairline: string
  font: string
}

const LIGHT: Ink = { ink: '#000000', paper: '#ffffff', grey: '#6b6b6b', fill: '#f3f3f3', hairline: '#949494', font: 'sans-serif' }
let inkCache: Ink | null = null

function readInk(): Ink {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    ink: v('--foreground', LIGHT.ink),
    paper: v('--background', LIGHT.paper),
    grey: v('--muted-foreground', LIGHT.grey),
    fill: v('--card', LIGHT.fill),
    hairline: v('--input', LIGHT.hairline),
    font: getComputedStyle(document.body).fontFamily || LIGHT.font,
  }
}

function subscribeInk(cb: () => void): () => void {
  const mo = new MutationObserver(() => {
    inkCache = readInk()
    cb()
  })
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
  return () => mo.disconnect()
}

/** The theme's ink, paper and grey as CSS colour strings, for canvas drawing. */
export function useInk(): Ink {
  return useSyncExternalStore(
    subscribeInk,
    () => (inkCache ??= readInk()),
    () => LIGHT,
  )
}

/* ── canvas ─────────────────────────────────────────────────────── */

export interface Paint2D {
  ctx: CanvasRenderingContext2D
  /** Size in CSS px. */
  w: number
  h: number
}

/** Match the backing store to the CSS size and device pixels, then clear. */
export function prepCanvas(c: HTMLCanvasElement | null): Paint2D | null {
  if (!c) return null
  const w = c.clientWidth
  const h = c.clientHeight
  if (w === 0 || h === 0) return null
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = Math.round(w * dpr)
  const H = Math.round(h * dpr)
  if (c.width !== W || c.height !== H) {
    c.width = W
    c.height = H
  }
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  return { ctx, w, h }
}

/**
 * Redraw a canvas whenever `deps`, the theme or its size change. For still
 * drawings; a simulation draws from its frame loop instead.
 */
export function useCanvasPaint(
  ref: RefObject<HTMLCanvasElement | null>,
  paint: (p: Paint2D, ink: Ink) => void,
  deps: readonly unknown[],
): void {
  const ink = useInk()
  const paintRef = useRef(paint)
  useLayoutEffect(() => {
    paintRef.current = paint
  })
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const run = () => {
      const p = prepCanvas(c)
      if (p) paintRef.current(p, ink)
    }
    run()
    const ro = new ResizeObserver(run)
    ro.observe(c)
    return () => ro.disconnect()
  }, [ref, ink, ...deps])
}

/** Redraw on resize for a canvas painted from a frame loop that may be paused. */
export function useResizeSignal(ref: RefObject<Element | null>): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setN((v) => v + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return n
}

/* ── today ──────────────────────────────────────────────────────── */

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * A date field's text state that starts at `fallback` (so the server render
 * and hydration agree) and moves to the visitor's local today after mount.
 */
export function useTodayDate(fallback: string): [string, (v: string) => void] {
  const [date, setDate] = useState(fallback)
  useEffect(() => setDate(isoDate(new Date())), [])
  return [date, setDate]
}
