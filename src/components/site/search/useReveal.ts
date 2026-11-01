import { useCallback, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { prefersReducedMotion } from './useFlip'

export interface Point {
  x: number
  y: number
}

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)'

/**
 * A full-screen layer that grows as a circle from a point and closes back into one. Interruptible:
 * asking for the other direction mid-way reverses the running animation from where it is.
 * Reduced motion: a plain fade.
 */
export function useReveal(ref: RefObject<HTMLElement | null>, onHidden: () => void) {
  const motion = useRef<{ anim: Animation; dir: 'in' | 'out' } | null>(null)
  const wanted = useRef<'in' | 'out'>('in')
  const hidden = useRef(onHidden)
  hidden.current = onHidden

  const play = useCallback(
    (dir: 'in' | 'out', at: Point) => {
      wanted.current = dir
      const el = ref.current
      if (!el) {
        if (dir === 'out') hidden.current()
        return
      }
      const running = motion.current
      if (running && running.anim.playState === 'running') {
        if (running.dir !== dir) {
          running.anim.reverse()
          running.dir = dir
        }
        return
      }
      const reduced = prefersReducedMotion()
      const r = Math.hypot(Math.max(at.x, window.innerWidth - at.x), Math.max(at.y, window.innerHeight - at.y)) + 2
      const frames: Keyframe[] = reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ clipPath: `circle(0px at ${at.x}px ${at.y}px)` }, { clipPath: `circle(${r}px at ${at.x}px ${at.y}px)` }]
      const anim = el.animate(dir === 'in' ? frames : frames.slice().reverse(), {
        duration: dir === 'in' ? (reduced ? 160 : 340) : reduced ? 120 : 200,
        easing: dir === 'in' ? EASE_OUT : EASE_IN_OUT,
        fill: 'both',
      })
      motion.current = { anim, dir }
      anim.onfinish = () => {
        motion.current = null
        if (wanted.current === 'out') hidden.current()
        else anim.cancel()
      }
    },
    [ref],
  )

  const reset = useCallback(() => {
    motion.current?.anim.cancel()
    motion.current = null
  }, [])

  return useMemo(() => ({ play, reset, isRunning: () => motion.current !== null }), [play, reset])
}
