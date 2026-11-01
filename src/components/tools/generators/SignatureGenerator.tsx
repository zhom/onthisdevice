import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Eraser, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { clamp, downloadBlob } from '@/lib/utils'
import { CheckerSurface, ColorField, NumberSlider } from './GenUi'
import { parseColor, toHex } from './colorlib'

interface Point {
  x: number
  y: number
  /** Stroke width at this point, already smoothed. */
  w: number
}

type Stroke = Point[]

const CANVAS_HEIGHT = 240
/** Extra pixels rendered per CSS pixel when exporting. */
const EXPORT_SCALE = 3

function midpoint(a: Point, b: Point): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

interface Segment {
  from: { x: number; y: number }
  control: { x: number; y: number }
  to: { x: number; y: number }
  width: number
}

/** Convert a raw point list into quadratic segments through the midpoints. */
function segmentsOf(stroke: Stroke): Segment[] {
  if (stroke.length < 2) return []
  const segments: Segment[] = []
  for (let i = 1; i < stroke.length; i++) {
    const prev = stroke[i - 1]
    const cur = stroke[i]
    const next = stroke[i + 1]
    const from = i === 1 ? { x: prev.x, y: prev.y } : midpoint(prev, cur)
    const to = next ? midpoint(cur, next) : { x: cur.x, y: cur.y }
    segments.push({ from, control: { x: cur.x, y: cur.y }, to, width: (prev.w + cur.w) / 2 })
  }
  return segments
}

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  color: string,
  scale: number,
  offsetX = 0,
  offsetY = 0,
): void {
  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(-offsetX, -offsetY)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const stroke of strokes) {
    if (stroke.length === 1) {
      const point = stroke[0]
      ctx.beginPath()
      ctx.arc(point.x, point.y, point.w / 2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    for (const segment of segmentsOf(stroke)) {
      ctx.beginPath()
      ctx.lineWidth = segment.width
      ctx.moveTo(segment.from.x, segment.from.y)
      ctx.quadraticCurveTo(segment.control.x, segment.control.y, segment.to.x, segment.to.y)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function round(n: number): string {
  return String(Math.round(n * 100) / 100)
}

function strokesToSvg(
  strokes: Stroke[],
  color: string,
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0,
): string {
  const parts: string[] = []
  for (const stroke of strokes) {
    if (stroke.length === 1) {
      const p = stroke[0]
      parts.push(
        `<circle cx="${round(p.x - offsetX)}" cy="${round(p.y - offsetY)}" r="${round(p.w / 2)}" fill="${color}"/>`,
      )
      continue
    }
    for (const segment of segmentsOf(stroke)) {
      parts.push(
        `<path d="M${round(segment.from.x - offsetX)} ${round(segment.from.y - offsetY)}Q${round(
          segment.control.x - offsetX,
        )} ${round(segment.control.y - offsetY)} ${round(segment.to.x - offsetX)} ${round(
          segment.to.y - offsetY,
        )}" fill="none" stroke="${color}" stroke-width="${round(
          segment.width,
        )}" stroke-linecap="round" stroke-linejoin="round"/>`,
      )
    }
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(
      height,
    )}" viewBox="0 0 ${round(width)} ${round(height)}" role="img" aria-label="Handwritten signature">`,
    ...parts,
    '</svg>',
    '',
  ].join('\n')
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function boundsOf(strokes: Stroke[]): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const stroke of strokes) {
    for (const point of stroke) {
      const half = point.w / 2 + 1
      minX = Math.min(minX, point.x - half)
      minY = Math.min(minY, point.y - half)
      maxX = Math.max(maxX, point.x + half)
      maxY = Math.max(maxY, point.y + half)
    }
  }
  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

export default function SignatureGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [penWidth, setPenWidth] = useState(3)
  const [color, setColor] = useState('#111827')
  const [pressureVariation, setPressureVariation] = useState(true)
  const [trim, setTrim] = useState(true)
  const [size, setSize] = useState({ width: 600, height: CANVAS_HEIGHT })

  const activeRef = useRef<Stroke | null>(null)
  const lastRef = useRef<{ x: number; y: number; time: number; w: number } | null>(null)

  const penHex = useMemo(() => toHex(parseColor(color) ?? { r: 17, g: 24, b: 39, a: 1 }), [color])

  /* Keep the backing store in step with the CSS box and the device DPR. */
  const paint = useCallback(
    (list: Stroke[], active: Stroke | null) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const width = size.width
      const height = size.height
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawStrokes(ctx, active ? [...list, active] : list, penHex, dpr)
    },
    [penHex, size],
  )

  useEffect(() => {
    paint(strokes, activeRef.current)
  }, [paint, strokes])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const width = Math.max(200, Math.round(entry.contentRect.width))
      setSize((current) => (current.width === width ? current : { width, height: CANVAS_HEIGHT }))
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  const pointFrom = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const now = performance.now()
    let width = penWidth

    if (pressureVariation) {
      if (event.pressure > 0 && event.pressure !== 0.5 && event.pointerType === 'pen') {
        // A real stylus reports pressure; use it directly.
        width = penWidth * (0.45 + event.pressure * 1.1)
      } else {
        const last = lastRef.current
        if (last) {
          const distance = Math.hypot(x - last.x, y - last.y)
          const elapsed = Math.max(1, now - last.time)
          const speed = distance / elapsed
          // Faster movement means a thinner line, the way ink behaves.
          const target = penWidth * clamp(1.35 - speed * 0.7, 0.4, 1.5)
          width = last.w + (target - last.w) * 0.35
        }
      }
    }

    lastRef.current = { x, y, time: now, w: width }
    return { x, y, w: clamp(width, 0.5, 60) }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    lastRef.current = null
    const point = pointFrom(event)
    activeRef.current = [point]
    paint(strokes, activeRef.current)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!activeRef.current) return
    event.preventDefault()
    const stroke = activeRef.current
    const point = pointFrom(event)
    const previous = stroke[stroke.length - 1]
    if (Math.hypot(point.x - previous.x, point.y - previous.y) < 1) return
    stroke.push(point)
    paint(strokes, stroke)
  }

  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const stroke = activeRef.current
    if (!stroke) return
    activeRef.current = null
    lastRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setStrokes((current) => [...current, stroke])
  }

  const undo = useCallback(() => {
    setStrokes((current) => current.slice(0, -1))
  }, [])

  const clear = useCallback(() => {
    activeRef.current = null
    setStrokes([])
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo])

  const bounds = useMemo(() => boundsOf(strokes), [strokes])
  const hasInk = strokes.length > 0 && bounds !== null

  const exportBox = useMemo(() => {
    if (!trim || !bounds) return { x: 0, y: 0, width: size.width, height: size.height }
    const pad = 6
    return {
      x: Math.max(0, bounds.minX - pad),
      y: Math.max(0, bounds.minY - pad),
      width: Math.min(size.width, bounds.maxX + pad) - Math.max(0, bounds.minX - pad),
      height: Math.min(size.height, bounds.maxY + pad) - Math.max(0, bounds.minY - pad),
    }
  }, [trim, bounds, size])

  const downloadPng = () => {
    if (!hasInk) return
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(exportBox.width * EXPORT_SCALE))
    canvas.height = Math.max(1, Math.round(exportBox.height * EXPORT_SCALE))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawStrokes(ctx, strokes, penHex, EXPORT_SCALE, exportBox.x, exportBox.y)
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, 'signature.png')
    }, 'image/png')
  }

  const svg = useMemo(
    () =>
      strokesToSvg(strokes, penHex, exportBox.width, exportBox.height, exportBox.x, exportBox.y),
    [strokes, penHex, exportBox],
  )

  const downloadSvg = () => {
    if (!hasInk) return
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), 'signature.svg')
  }

  return (
    <div className="flex flex-col gap-6">
      <ToolPanel
        title="Sign here"
        description="Use a finger on a touchscreen, a stylus, or click and drag with a mouse. Nothing is uploaded. The signature exists only in this tab until you save it."
      >
        <div ref={wrapRef} className="w-full">
          <CheckerSurface className="p-2">
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: CANVAS_HEIGHT, touchAction: 'none' }}
              className="block cursor-crosshair rounded-md"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
              onPointerLeave={(event) => {
                if (activeRef.current) finishStroke(event)
              }}
              aria-label="Signature drawing area. Draw with a pointer, stylus or finger"
            />
          </CheckerSurface>
        </div>

        {!hasInk ? (
          <p className="text-center text-sm text-muted-foreground">
            The area above is transparent. The chequerboard is not part of the image.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={undo} disabled={strokes.length === 0}>
            <Undo2 className="size-4" aria-hidden="true" />
            Undo stroke
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={clear} disabled={strokes.length === 0}>
            <Eraser className="size-4" aria-hidden="true" />
            Clear
          </Button>
          <span className="text-xs text-muted-foreground" role="status" aria-live="polite">
            {strokes.length === 0
              ? 'No strokes yet'
              : `${strokes.length} stroke${strokes.length === 1 ? '' : 's'} · Ctrl+Z undoes`}
          </span>
        </div>
      </ToolPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <ToolPanel title="Pen">
          <NumberSlider
            label="Pen width"
            value={penWidth}
            onChange={setPenWidth}
            min={1}
            max={20}
            step={0.5}
            unit="px"
          />
          <ColorField label="Ink colour" value={color} onChange={setColor} />
          <div className="flex flex-wrap gap-1.5">
            {['#111827', '#1d4ed8', '#0f766e', '#7f1d1d', '#000000'].map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={`Use ink colour ${preset}`}
                onClick={() => setColor(preset)}
                className="size-8 rounded-full border border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                style={{ backgroundColor: preset }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
            <div className="min-w-0">
              <Label htmlFor="sig-pressure" className="text-sm">
                Vary the stroke like real ink
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Uses stylus pressure where the device reports it, and drawing speed everywhere else,
                so fast flicks come out thinner than slow curves.
              </p>
            </div>
            <Switch id="sig-pressure" checked={pressureVariation} onCheckedChange={setPressureVariation} />
          </div>
        </ToolPanel>

        <ToolPanel title="Export">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
            <div className="min-w-0">
              <Label htmlFor="sig-trim" className="text-sm">
                Trim to the ink
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Crops the empty space away so the signature drops neatly into a document instead of
                carrying a wide transparent margin.
              </p>
            </div>
            <Switch id="sig-trim" checked={trim} onCheckedChange={setTrim} />
          </div>

          <p className="text-sm text-muted-foreground">
            {hasInk
              ? `Output: ${Math.round(exportBox.width)} × ${Math.round(exportBox.height)} px, PNG rendered at ${EXPORT_SCALE}× for a crisp ${Math.round(
                  exportBox.width * EXPORT_SCALE,
                )} × ${Math.round(exportBox.height * EXPORT_SCALE)} bitmap.`
              : 'Draw something to enable the downloads.'}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={downloadPng} disabled={!hasInk}>
              Download transparent PNG
            </Button>
            <Button type="button" variant="outline" onClick={downloadSvg} disabled={!hasInk}>
              Download SVG
            </Button>
          </div>

          <p className="text-xs text-pretty text-muted-foreground">
            The SVG keeps the signature as vector paths, so it stays sharp at any size and stays a
            few kilobytes. Use the PNG when the destination (a PDF form field, a mail signature, a
            Word document) does not accept SVG.
          </p>
        </ToolPanel>
      </div>
    </div>
  )
}
