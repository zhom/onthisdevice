/**
 * Image redaction editor: the image with its boxes, live preview of the
 * redaction, and a list of the boxes. Controlled: the parent owns `boxes`.
 *
 *   <RedactionEditor
 *     image={previewBitmap}            // any size; draw the export from the full file
 *     boxes={boxes} onChange={setBoxes}
 *     look={look}                      // see ./paint.ts
 *     names={{ face: 'Face' }}         // list labels per kind (optional)
 *     wholeImage={false}               // redact everything, boxes hidden
 *   />
 *
 * Pointer: drag on the image to add a box; click or tap a box to switch it
 * between hidden and visible; pinch or the zoom buttons to zoom, two fingers
 * to pan. Keyboard: Tab to a box, Enter toggles, arrows move (Shift: faster),
 * + and - resize, Delete removes. Below the image each box is a tile with
 * a thumbnail (press to hide or show it) and a remove button.
 * Export with renderRedacted() and encodeRedacted() from ./boxes.ts.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Minus, Plus, SquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { WHOLE_IMAGE, boxId, paintBoxes } from './boxes'
import type { BoxKind, EditorBox } from './boxes'
import type { RedactLook } from './paint'

type Source = ImageBitmap | HTMLCanvasElement

export interface RedactionEditorProps {
  image: Source
  boxes: EditorBox[]
  onChange: (boxes: EditorBox[]) => void
  look: RedactLook
  names?: Partial<Record<BoxKind, string>>
  wholeImage?: boolean
  className?: string
}

const NAMES: Record<BoxKind, string> = { face: 'Face', plate: 'Plate', text: 'Text', manual: 'Box' }
const MIN_ZOOM = 1
const MAX_ZOOM = 8
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function boxLabels(boxes: readonly EditorBox[], names: Partial<Record<BoxKind, string>> = {}): Map<string, string> {
  const count = new Map<string, number>()
  const out = new Map<string, string>()
  for (const b of boxes) {
    const name = b.label ?? names[b.kind] ?? NAMES[b.kind]
    const n = (count.get(name) ?? 0) + 1
    count.set(name, n)
    out.set(b.id, `${name} ${n}`)
  }
  return out
}

export function RedactionEditor({ image, boxes, onChange, look, names, wholeImage = false, className }: RedactionEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fit, setFit] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const boxesRef = useRef(boxes)
  boxesRef.current = boxes
  const labels = boxLabels(boxes, names)

  /* Fit the image into the stage width and 65% of the viewport height. */
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const measure = () => {
      const availW = stage.clientWidth
      const availH = Math.max(220, window.innerHeight * 0.65)
      const k = Math.min(availW / image.width, availH / image.height)
      setFit({ w: Math.floor(image.width * k), h: Math.floor(image.height * k) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [image])

  /* Live preview: the image with every hidden box painted, at preview size. */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const frame = requestAnimationFrame(() => {
      canvas.width = image.width
      canvas.height = image.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(image, 0, 0)
      paintBoxes(ctx, wholeImage ? [WHOLE_IMAGE] : boxes, look, image.width, image.height)
    })
    return () => cancelAnimationFrame(frame)
  }, [image, boxes, look, wholeImage])

  const update = useCallback((id: string, patch: Partial<EditorBox> | null) => {
    const next = patch === null ? boxesRef.current.filter((b) => b.id !== id) : boxesRef.current.map((b) => (b.id === id ? { ...b, ...patch } : b))
    onChange(next)
  }, [onChange])

  /* ── pointer: draw, tap, pinch ── */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<
    | { kind: 'draw'; x: number; y: number; cx: number; cy: number; moved: boolean }
    | { kind: 'pinch'; dist: number; zoom: number; midX: number; midY: number; sl: number; st: number }
    | null
  >(null)
  const swallowClick = useRef(false)

  const toFraction = (clientX: number, clientY: number) => {
    const r = surfaceRef.current?.getBoundingClientRect()
    if (!r || r.width === 0) return { x: 0, y: 0 }
    return { x: clamp01((clientX - r.left) / r.width), y: clamp01((clientY - r.top) / r.height) }
  }

  const pinchState = () => {
    const [a, b] = [...pointers.current.values()]
    if (!a || !b) return null
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (wholeImage) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // A new primary pointer starts a new gesture; drop pointers whose up event was lost.
    if (e.isPrimary) pointers.current.clear()
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    swallowClick.current = false
    if (pointers.current.size === 2) {
      const p = pinchState()
      const stage = stageRef.current
      if (!p || !stage) return
      setDraft(null)
      swallowClick.current = true
      gesture.current = { kind: 'pinch', dist: p.dist, zoom, midX: p.midX, midY: p.midY, sl: stage.scrollLeft, st: stage.scrollTop }
      return
    }
    if (pointers.current.size === 1) {
      const f = toFraction(e.clientX, e.clientY)
      gesture.current = { kind: 'draw', x: f.x, y: f.y, cx: e.clientX, cy: e.clientY, moved: false }
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch') {
      const p = pinchState()
      const stage = stageRef.current
      if (!p || !stage || g.dist === 0) return
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (g.zoom * p.dist) / g.dist))
      const rect = stage.getBoundingClientRect()
      const k = next / g.zoom
      setZoom(next)
      requestAnimationFrame(() => {
        stage.scrollLeft = (g.sl + g.midX - rect.left) * k - (p.midX - rect.left)
        stage.scrollTop = (g.st + g.midY - rect.top) * k - (p.midY - rect.top)
      })
      return
    }
    if (!g.moved && Math.hypot(e.clientX - g.cx, e.clientY - g.cy) < 6) return
    if (!g.moved) {
      g.moved = true
      swallowClick.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    const f = toFraction(e.clientX, e.clientY)
    setDraft({ x0: g.x, y0: g.y, x1: f.x, y1: f.y })
  }

  function onPointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    // A drag or pinch must not also count as a click; a later keyboard click must.
    if (pointers.current.size === 0) window.setTimeout(() => (swallowClick.current = false), 0)
    if (g?.kind === 'pinch') {
      if (pointers.current.size === 0) gesture.current = null
      return
    }
    gesture.current = null
    setDraft(null)
    if (!g || !g.moved || e.type === 'pointercancel') return
    const f = toFraction(e.clientX, e.clientY)
    const x = Math.min(g.x, f.x)
    const y = Math.min(g.y, f.y)
    const w = Math.abs(f.x - g.x)
    const h = Math.abs(f.y - g.y)
    if (w * fit.w * zoom < 8 || h * fit.h * zoom < 8) return
    onChange([...boxesRef.current, { id: boxId(), x, y, w, h, kind: 'manual', keep: false }])
  }

  function onBoxClick(id: string) {
    if (swallowClick.current) {
      swallowClick.current = false
      return
    }
    const b = boxesRef.current.find((v) => v.id === id)
    if (b) update(id, { keep: !b.keep })
  }

  function onBoxKey(e: ReactKeyboardEvent<HTMLButtonElement>, b: EditorBox) {
    const step = e.shiftKey ? 0.05 : 0.01
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const delta = move[e.key]
    if (delta) {
      e.preventDefault()
      update(b.id, { x: clamp01(Math.min(1 - b.w, b.x + delta[0])), y: clamp01(Math.min(1 - b.h, b.y + delta[1])) })
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      e.preventDefault()
      const k = e.key === '-' ? 0.9 : 1.1
      const w = Math.min(1, b.w * k)
      const h = Math.min(1, b.h * k)
      update(b.id, { w, h, x: clamp01(Math.min(1 - w, b.x - (w - b.w) / 2)), y: clamp01(Math.min(1 - h, b.y - (h - b.h) / 2)) })
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      update(b.id, null)
    }
  }

  function zoomBy(factor: number) {
    const stage = stageRef.current
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor))
    if (!stage) return setZoom(next)
    const cx = stage.scrollLeft + stage.clientWidth / 2
    const cy = stage.scrollTop + stage.clientHeight / 2
    const k = next / zoom
    setZoom(next)
    requestAnimationFrame(() => {
      stage.scrollLeft = cx * k - stage.clientWidth / 2
      stage.scrollTop = cy * k - stage.clientHeight / 2
    })
  }

  function addBox() {
    const box: EditorBox = { id: boxId(), x: 0.35, y: 0.35, w: 0.3, h: 0.3, kind: 'manual', keep: false }
    onChange([...boxesRef.current, box])
    requestAnimationFrame(() => surfaceRef.current?.querySelector<HTMLButtonElement>(`[data-box="${box.id}"]`)?.focus())
  }

  const w = fit.w * zoom
  const h = fit.h * zoom
  const hidden = boxes.filter((b) => !b.keep).length

  return (
    <div className={cn('space-y-3', className)}>
      <div
        ref={stageRef}
        className="relative w-full overflow-auto overscroll-contain rounded-lg bg-muted"
        style={{ maxHeight: 'max(220px, 65dvh)' }}
      >
        <div
          ref={surfaceRef}
          className={cn('relative mx-auto touch-none select-none', !wholeImage && 'cursor-crosshair')}
          style={{ width: w || '100%', height: h || 'auto' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={wholeImage ? 'Preview: the whole image is redacted' : `Preview: ${hidden} of ${boxes.length} areas hidden`}
            className="block h-full w-full"
          />
          {!wholeImage &&
            boxes.map((b) => {
              const label = labels.get(b.id) ?? 'Box'
              return (
                <button
                  key={b.id}
                  type="button"
                  data-box={b.id}
                  aria-pressed={!b.keep}
                  aria-label={`${label}: ${b.keep ? 'visible' : 'hidden'}. Press to ${b.keep ? 'hide' : 'keep visible'}.`}
                  title={`${label}: ${b.keep ? 'visible, click to hide' : 'hidden, click to keep visible'}`}
                  onClick={() => onBoxClick(b.id)}
                  onKeyDown={(e) => onBoxKey(e, b)}
                  className={cn(
                    'absolute rounded-[2px] outline-none',
                    'shadow-[0_0_0_1px_var(--color-background),0_0_0_3px_var(--color-foreground)]',
                    'focus-visible:shadow-[0_0_0_2px_var(--color-background),0_0_0_5px_var(--color-foreground)]',
                    b.keep && 'border-2 border-dashed border-background shadow-[0_0_0_1px_var(--color-foreground)]',
                    look.shape === 'oval' && 'rounded-[50%]',
                  )}
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
                />
              )
            })}
          {draft && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute border-2 border-dashed border-background shadow-[0_0_0_1px_var(--color-foreground)]"
              style={{
                left: `${Math.min(draft.x0, draft.x1) * 100}%`,
                top: `${Math.min(draft.y0, draft.y1) * 100}%`,
                width: `${Math.abs(draft.x1 - draft.x0) * 100}%`,
                height: `${Math.abs(draft.y1 - draft.y0) * 100}%`,
              }}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={addBox} disabled={wholeImage}>
          <SquarePlus aria-hidden="true" /> Add box
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.5)} disabled={zoom <= MIN_ZOOM}>
            <Minus aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="num min-w-14" aria-label="Fit to screen" onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Zoom in" onClick={() => zoomBy(1.5)} disabled={zoom >= MAX_ZOOM}>
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </div>

      {!wholeImage && boxes.length > 0 && (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Areas">
          {boxes.map((b) => {
            const label = labels.get(b.id) ?? 'Box'
            return (
              <li key={b.id} className="relative">
                <button
                  type="button"
                  aria-pressed={!b.keep}
                  aria-label={`${label}: ${b.keep ? 'visible' : 'hidden'}`}
                  onClick={() => update(b.id, { keep: !b.keep })}
                  className="flex w-full flex-col items-center gap-1 rounded-lg bg-background p-1.5 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Thumb image={image} box={b} />
                  <span className="max-w-full truncate text-xs font-[600]">{label}</span>
                  <span className={cn('text-xs', b.keep ? 'font-[600] text-foreground' : 'text-muted-foreground')}>{b.keep ? 'Visible' : 'Hidden'}</span>
                </button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label={`Remove ${label}`}
                  onClick={() => update(b.id, null)}
                  className="absolute top-0.5 right-0.5 size-8 rounded-full"
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const THUMB = 96

/** The area of a box from the unredacted image, square, so you can tell who it is. */
const Thumb = memo(function Thumb({ image, box }: { image: Source; box: EditorBox }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = THUMB * dpr
    canvas.height = THUMB * dpr
    const bw = box.w * image.width
    const bh = box.h * image.height
    const side = Math.max(bw, bh) * 1.1
    const sx = box.x * image.width + bw / 2 - side / 2
    const sy = box.y * image.height + bh / 2 - side / 2
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, sx, sy, side, side, 0, 0, canvas.width, canvas.height)
  }, [image, box.x, box.y, box.w, box.h])
  return <canvas ref={ref} aria-hidden="true" className="aspect-square w-full rounded-md bg-muted" />
})
