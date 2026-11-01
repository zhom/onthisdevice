import { useCallback, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * FLIP for a list whose rows carry `data-flip="<key>"`. Call `snapshot()` just before the state
 * change that reorders the list; after the commit, rows that stayed glide from where they were
 * (their on-screen position, so a move in flight is picked up mid-way) and new rows fade up.
 * Transforms and opacity only. Reduced motion: no movement.
 */
export function useFlip(container: RefObject<HTMLElement | null>, version: unknown) {
  const before = useRef<Map<string, number> | null>(null)
  const first = useRef(true)

  const snapshot = useCallback(() => {
    const root = container.current
    if (!root || prefersReducedMotion()) return
    const map = new Map<string, number>()
    for (const el of root.querySelectorAll<HTMLElement>('[data-flip]')) {
      map.set(el.dataset.flip ?? '', el.getBoundingClientRect().top)
    }
    before.current = map
  }, [container])

  useLayoutEffect(() => {
    const root = container.current
    const old = before.current
    before.current = null
    if (first.current) {
      first.current = false
      return
    }
    if (!root || !old || prefersReducedMotion()) return
    const view = window.innerHeight
    let fresh = 0
    for (const el of root.querySelectorAll<HTMLElement>('[data-flip]')) {
      for (const a of el.getAnimations()) a.cancel()
      const top = el.getBoundingClientRect().top
      const was = old.get(el.dataset.flip ?? '')
      if (top > view + 40) continue
      if (was === undefined) {
        el.animate(
          [
            { opacity: 0, transform: 'translateY(6px)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 220, delay: Math.min(fresh++ * 18, 90), easing: EASE, fill: 'backwards' },
        )
      } else if (Math.abs(was - top) > 0.5) {
        el.animate([{ transform: `translateY(${was - top}px)` }, { transform: 'none' }], {
          duration: 260,
          easing: EASE,
        })
      }
    }
  }, [container, version])

  return snapshot
}
