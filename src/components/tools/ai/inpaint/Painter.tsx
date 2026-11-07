/**
 * A photo with a mask that the visitor paints with a round brush. The mask shows as inverted
 * colours over the photo, so it is visible on light and dark parts alike.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export interface PainterHandle {
  /** One byte per photo pixel: 255 where painted. */
  mask(): Uint8Array
  isEmpty(): boolean
  clear(): void
  undo(): void
  /** Marks rectangles in photo pixels (for text that was found). */
  addBoxes(boxes: { x: number; y: number; w: number; h: number }[]): void
}

type Stroke = { kind: 'line'; size: number; points: [number, number][] } | { kind: 'box'; x: number; y: number; w: number; h: number }

export const Painter = forwardRef<PainterHandle, { image: ImageBitmap; brush: number; onChange: (empty: boolean) => void }>(function Painter(
  { image, brush, onChange },
  ref,
) {
  const baseRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const drawing = useRef<Stroke | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number; d: number } | null>(null)

  const redraw = () => {
    const c = maskRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#fff'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of strokes.current) {
      if (s.kind === 'box') {
        ctx.fillRect(s.x, s.y, s.w, s.h)
        continue
      }
      ctx.lineWidth = s.size
      ctx.beginPath()
      const [x0, y0] = s.points[0]
      ctx.moveTo(x0, y0)
      if (s.points.length === 1) ctx.lineTo(x0 + 0.01, y0)
      for (const [x, y] of s.points.slice(1)) ctx.lineTo(x, y)
      ctx.stroke()
    }
    onChange(strokes.current.length === 0)
  }

  useEffect(() => {
    const base = baseRef.current
    const mask = maskRef.current
    if (!base || !mask) return
    base.width = mask.width = image.width
    base.height = mask.height = image.height
    base.getContext('2d')?.drawImage(image, 0, 0)
    redraw()
  }, [image])

  useImperativeHandle(ref, () => ({
    mask() {
      const c = maskRef.current
      const ctx = c?.getContext('2d', { willReadFrequently: true })
      if (!c || !ctx) return new Uint8Array(0)
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      const out = new Uint8Array(c.width * c.height)
      for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] > 0 ? 255 : 0
      return out
    },
    isEmpty: () => strokes.current.length === 0,
    clear() {
      strokes.current = []
      redraw()
    },
    undo() {
      strokes.current.pop()
      redraw()
    },
    addBoxes(boxes) {
      for (const b of boxes) strokes.current.push({ kind: 'box', ...b })
      redraw()
    },
  }))

  /** Photo pixels per screen pixel. */
  const scale = () => {
    const c = maskRef.current
    return c ? c.width / c.getBoundingClientRect().width : 1
  }
  const point = (e: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect()
    const s = scale()
    return [(e.clientX - r.left) * s, (e.clientY - r.top) * s]
  }

  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-lg bg-muted" style={{ aspectRatio: `${image.width} / ${image.height}`, maxWidth: `min(100%, calc(70vh * ${image.width / image.height}))` }}>
      <canvas ref={baseRef} className="absolute inset-0 size-full" aria-label="Photo" role="img" />
      <canvas
        ref={maskRef}
        className="absolute inset-0 size-full cursor-none touch-none opacity-80 mix-blend-difference"
        aria-label="Paint over what to remove"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          const stroke: Stroke = { kind: 'line', size: brush * scale(), points: [point(e)] }
          drawing.current = stroke
          strokes.current.push(stroke)
          redraw()
        }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setCursor({ x: e.clientX - r.left, y: e.clientY - r.top, d: brush })
          const s = drawing.current
          if (s?.kind !== 'line') return
          s.points.push(point(e))
          redraw()
        }}
        onPointerUp={() => {
          drawing.current = null
        }}
        onPointerLeave={() => setCursor(null)}
      />
      {cursor && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 rounded-full shadow-[0_0_0_1px_#000,inset_0_0_0_1px_#fff]"
          style={{ width: cursor.d, height: cursor.d, transform: `translate(${cursor.x - cursor.d / 2}px, ${cursor.y - cursor.d / 2}px)` }}
        />
      )}
    </div>
  )
})
