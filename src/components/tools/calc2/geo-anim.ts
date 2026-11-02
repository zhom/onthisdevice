import { useEffect, useRef, useState } from 'react'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink, Paint2D } from './_viz/hooks'

/** Ease-out cubic. */
export const easeOut = (t: number): number => 1 - (1 - t) ** 3
/** Ease-in-out cubic. */
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
/** Progress of a phase that starts at `start` and lasts `dur` seconds, eased. */
export const phase = (t: number, start: number, dur: number, ease: (x: number) => number = easeOut): number =>
  ease(clamp01((t - start) / dur))

/**
 * A canvas animation driven by a clock in seconds. The clock restarts when
 * `key` changes. With `end`, it stops there (a one-shot build); with `loop`,
 * it wraps. Pauses offscreen and in hidden tabs; under reduced motion it
 * paints one frame at `still`.
 */
export function useTimeline(
  paint: (p: Paint2D, ink: Ink, t: number) => void,
  opts: { key: string; still: number; end?: number; loop?: number },
) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const t = useRef(0)
  const [playing, setPlaying] = useState(true)
  const [done, setDone] = useState(false)
  const { end, loop, still, key } = opts

  const draw = () => {
    const p = prepCanvas(canvas.current)
    if (p) paint(p, ink, t.current)
  }

  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      t.current += dt
      if (loop !== undefined && t.current > loop) t.current %= loop
      if (end !== undefined && t.current >= end) {
        t.current = end
        setDone(true)
      }
      draw()
    },
    playing && !done,
  )

  useEffect(() => {
    t.current = 0
    setDone(false)
  }, [key])

  useEffect(() => {
    if (reduced) t.current = still
    draw()
  })

  const replay = () => {
    t.current = 0
    setDone(false)
    setPlaying(true)
  }
  return { canvas, reduced, playing: playing && !done, setPlaying: (p: boolean) => (p && done ? replay() : setPlaying(p)), replay }
}
