import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { AlertCircle, Maximize, Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { niceStep } from '@/components/viz/scale'
import { NumField, Stage, Working } from './_viz/Calc'
import { label as text } from './_viz/draw'
import { fmt, num, parseNum } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { roots, tryCompile } from './graph-parser'
import type { Fn } from './graph-parser'

const MAX = 5
const MORPH = 0.32
const SUBS = ['₁', '₂', '₃', '₄', '₅']
/** Line styles that tell the curves apart without colour. */
const STYLES: { name: string; grey: boolean; dash: number[]; width: number }[] = [
  { name: 'solid ink line', grey: false, dash: [], width: 2.25 },
  { name: 'dashed ink line', grey: false, dash: [9, 6], width: 2.25 },
  { name: 'solid grey line', grey: true, dash: [], width: 2.25 },
  { name: 'dotted ink line', grey: false, dash: [1, 5], width: 2.75 },
  { name: 'dash-dot grey line', grey: true, dash: [10, 4, 2, 4], width: 2 },
]

interface View {
  cx: number
  cy: number
  /** x units across the canvas width. */
  span: number
}
const HOME: View = { cx: 0, cy: 0, span: 12 }

interface Curve {
  id: number
  src: string
}

/** One curve's morph: from the old function to the new one over MORPH seconds. */
interface Morph {
  from: Fn | null
  to: Fn | null
  t: number
}

let nextId = 3

function Swatch({ i }: { i: number }) {
  const s = STYLES[i]!
  return (
    <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true" className="shrink-0">
      <line
        x1="1"
        y1="5"
        x2="27"
        y2="5"
        strokeWidth={s.width}
        strokeDasharray={s.dash.join(' ') || undefined}
        strokeLinecap={s.dash.length === 2 && s.dash[0]! < 2 ? 'round' : 'butt'}
        className={s.grey ? 'stroke-muted-foreground' : 'stroke-foreground'}
      />
    </svg>
  )
}

export default function GraphingCalculator() {
  const [curves, setCurves] = useState<Curve[]>([
    { id: 1, src: 'x^2 - 2' },
    { id: 2, src: '2 sin x' },
  ])
  const [evalAt, setEvalAt] = useState('1.5')
  const compiled = useMemo(() => curves.map((c) => (c.src.trim() ? tryCompile(c.src) : null)), [curves])
  const fns = compiled.map((c) => (c && c.ok ? c.f : null))

  /* view and drawing */
  const canvas = useRef<HTMLCanvasElement>(null)
  const rangeText = useRef<HTMLSpanElement>(null)
  const view = useRef<View>({ ...HOME })
  const ink = useInk()
  useResizeSignal(canvas)
  const [settled, setSettled] = useState(0)
  const morphs = useRef<Map<number, Morph>>(new Map())
  const shown = useRef<Map<number, Fn | null>>(new Map())
  const [morphing, setMorphing] = useState(false)

  // Start a morph for every curve whose function changed.
  useEffect(() => {
    let any = false
    curves.forEach((c, i) => {
      const f = fns[i] ?? null
      const before = shown.current.get(c.id)
      if (before === undefined) {
        shown.current.set(c.id, f)
        morphs.current.set(c.id, { from: null, to: f, t: 0 })
        any = true
      } else if (before !== f && f) {
        morphs.current.set(c.id, { from: before, to: f, t: 0 })
        shown.current.set(c.id, f)
        any = true
      } else if (!c.src.trim()) {
        shown.current.set(c.id, null)
        morphs.current.delete(c.id)
      }
    })
    for (const id of [...shown.current.keys()]) if (!curves.some((c) => c.id === id)) shown.current.delete(id)
    if (any) setMorphing(true)
  }, [compiled])

  const paint = () => {
    const p = prepCanvas(canvas.current)
    if (!p) return
    const list = curves.map((c, i) => ({ i, id: c.id, f: shown.current.get(c.id) ?? null, m: morphs.current.get(c.id) }))
    draw(p.ctx, p.w, p.h, view.current, list, ink)
    if (rangeText.current) {
      const ppu = p.w / view.current.span
      const v = view.current
      rangeText.current.textContent = `x ${fmt(v.cx - p.w / 2 / ppu, 3)} to ${fmt(v.cx + p.w / 2 / ppu, 3)}, y ${fmt(v.cy - p.h / 2 / ppu, 3)} to ${fmt(v.cy + p.h / 2 / ppu, 3)}`
    }
  }

  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      let open = false
      for (const m of morphs.current.values()) {
        if (m.t < 1) {
          m.t = Math.min(1, m.t + dt / MORPH)
          if (m.t < 1) open = true
        }
      }
      paint()
      if (!open) setMorphing(false)
    },
    morphing,
  )

  // Finish morphs at once when the loop cannot run (reduced motion, off screen).
  useEffect(() => {
    if (reduced) for (const m of morphs.current.values()) m.t = 1
    paint()
  })

  /* gestures */
  const settle = useRef(0)
  const redraw = () => {
    paint()
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => setSettled((n) => n + 1), 160)
  }
  const zoomAt = (factor: number, px?: number, py?: number) => {
    const c = canvas.current
    if (!c) return
    const w = c.clientWidth
    const h = c.clientHeight
    const v = view.current
    const ppu = w / v.span
    const x = px ?? w / 2
    const y = py ?? h / 2
    const wx = v.cx + (x - w / 2) / ppu
    const wy = v.cy - (y - h / 2) / ppu
    const span = Math.min(1e6, Math.max(1e-4, v.span * factor))
    const k = w / span
    view.current = { span, cx: wx - (x - w / 2) / k, cy: wy + (y - h / 2) / k }
    redraw()
  }
  const pan = (dx: number, dy: number) => {
    const c = canvas.current
    if (!c) return
    const ppu = c.clientWidth / view.current.span
    view.current = { ...view.current, cx: view.current.cx - dx / ppu, cy: view.current.cy + dy / ppu }
    redraw()
  }

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const pts = new Map<number, { x: number; y: number }>()
    let pinch = 0
    const local = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId)
      pts.set(e.pointerId, local(e))
      if (pts.size === 2) {
        const [a, b] = [...pts.values()] as [{ x: number; y: number }, { x: number; y: number }]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId)
      if (!prev) return
      const now = local(e)
      if (pts.size === 1) {
        pts.set(e.pointerId, now)
        pan(now.x - prev.x, now.y - prev.y)
      } else if (pts.size === 2) {
        pts.set(e.pointerId, now)
        const [a, b] = [...pts.values()] as [{ x: number; y: number }, { x: number; y: number }]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch > 0 && d > 0) zoomAt(pinch / d, (a.x + b.x) / 2, (a.y + b.y) / 2)
        pinch = d
      }
    }
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      pinch = 0
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = c.getBoundingClientRect()
      zoomAt(Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * 0.0015))), e.clientX - r.left, e.clientY - r.top)
    }
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    c.addEventListener('pointerup', up)
    c.addEventListener('pointercancel', up)
    c.addEventListener('wheel', wheel, { passive: false })
    return () => {
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', up)
      c.removeEventListener('pointercancel', up)
      c.removeEventListener('wheel', wheel)
    }
  })

  const onKey = (e: KeyboardEvent) => {
    const step = 40
    const keys: Record<string, () => void> = {
      ArrowLeft: () => pan(step, 0),
      ArrowRight: () => pan(-step, 0),
      ArrowUp: () => pan(0, step),
      ArrowDown: () => pan(0, -step),
      '+': () => zoomAt(0.8),
      '=': () => zoomAt(0.8),
      '-': () => zoomAt(1.25),
      '0': () => reset(),
    }
    const k = keys[e.key]
    if (k) {
      e.preventDefault()
      k()
    }
  }
  const reset = () => {
    view.current = { ...HOME }
    redraw()
  }

  /* roots and intercepts in view, recomputed when the view settles */
  const facts = useMemo(() => {
    const v = view.current
    const half = v.span / 2
    const a = v.cx - half
    const b = v.cx + half
    return curves.map((cv, i) => {
      const f = fns[i]
      if (!f) return null
      const y0 = f(0)
      const rs = roots(f, a, b, 800)
      return { y0: Number.isFinite(y0) && a <= 0 && b >= 0 ? y0 : null, roots: rs, a, b }
    })
  }, [compiled, settled])

  const summary = curves
    .map((c, i) => {
      const f = facts[i]
      const name = `f${SUBS[i]}(x) = ${c.src.trim() || 'empty'}`
      if (!c.src.trim()) return null
      if (!f) return `${name} cannot be drawn: ${compiled[i] && !compiled[i]!.ok ? compiled[i]!.error : 'enter an expression'}`
      const rs = f.roots.length === 0 ? 'no roots in view' : f.roots.length > 8 ? `${f.roots.length} roots in view` : `roots at ${f.roots.map((r) => fmt(r, 4)).join(', ')}`
      const yi = f.y0 === null ? 'no y-intercept in view' : `crosses the y-axis at ${fmt(f.y0, 4)}`
      return `${name}, ${STYLES[i]!.name}: ${yi}; ${rs}.`
    })
    .filter(Boolean)

  /* worked evaluation at one x */
  const xv = parseNum(evalAt)
  const working: string[] = []
  if (xv !== null) {
    curves.forEach((c, i) => {
      const f = fns[i]
      if (!f) return
      const y = f(xv)
      const shown = c.src.trim().replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=/i, '').trim()
      const subst = shown.replace(/(?<![a-zA-Z])x(?![a-zA-Z])/g, `(${num(xv)})`)
      working.push(`f${SUBS[i]}(x) = ${shown}`)
      working.push(`f${SUBS[i]}(${num(xv)}) = ${subst} = ${Number.isFinite(y) ? num(y, 8) : 'undefined'}`)
    })
  }

  const setSrc = (id: number, src: string) => setCurves((cs) => cs.map((c) => (c.id === id ? { ...c, src } : c)))
  const remove = (id: number) => setCurves((cs) => cs.filter((c) => c.id !== id))
  const add = () => setCurves((cs) => (cs.length >= MAX ? cs : [...cs, { id: nextId++, src: '' }]))

  return (
    <div className="space-y-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section aria-label="Functions" className="space-y-4 rounded-xl bg-card p-4 sm:p-5">
            {curves.map((c, i) => (
              <FnRow
                key={c.id}
                index={i}
                value={c.src}
                onChange={(v) => setSrc(c.id, v)}
                onRemove={curves.length > 1 ? () => remove(c.id) : undefined}
                error={compiled[i] && !compiled[i]!.ok ? compiled[i]!.error : null}
              />
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={add} disabled={curves.length >= MAX}>
                <Plus aria-hidden="true" />
                Add a function
              </Button>
              <span className="text-[0.8125rem] text-muted-foreground">Up to {MAX}. Use x, ^, sin, sqrt, ln, abs, pi.</span>
            </div>
          </section>
          <section role="status" aria-live="polite" className="space-y-2 px-1">
            <h2 className="text-[0.875rem] font-[560] text-muted-foreground">What the graph shows</h2>
            <ul className="space-y-2 text-[0.9375rem] text-foreground">
              {summary.map((s) => (
                <li key={s} className="text-pretty break-words">
                  {s}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <Stage
          summary="Drag to move the graph, pinch or scroll to zoom. With the graph focused, the arrow keys move it, + and − zoom and 0 resets the view." 
          bar={
            <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
              <Button variant="ghost" size="sm" onClick={() => zoomAt(0.8)}>
                <Plus aria-hidden="true" />
                Zoom in
              </Button>
              <Button variant="ghost" size="sm" onClick={() => zoomAt(1.25)}>
                <Minus aria-hidden="true" />
                Zoom out
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                <Maximize aria-hidden="true" />
                Reset view
              </Button>
              <span ref={rangeText} className="ml-auto px-1 text-[0.8125rem] font-[560] text-muted-foreground tabular-nums" />
            </div>
          }
        >
          <canvas
            ref={canvas}
            tabIndex={0}
            onKeyDown={onKey}
            className="block aspect-square w-full cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing sm:aspect-[4/3]"
            role="img"
            aria-label={`Graph of ${curves.map((c) => c.src).filter(Boolean).join(', ')}`}
          />
        </Stage>
      </div>
      <div className="max-w-xs">
        <NumField label="Evaluate at x =" value={evalAt} onChange={setEvalAt} error={evalAt.trim() && xv === null ? 'Enter a number.' : null} />
      </div>
      {working.length ? <Working lines={working} title="Values at one point" caption="Each function with your x put in. Angles are in radians." /> : null}
    </div>
  )
}

function FnRow({
  index,
  value,
  onChange,
  onRemove,
  error,
}: {
  index: number
  value: string
  onChange: (v: string) => void
  onRemove?: () => void
  error: string | null
}) {
  const id = useId()
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center gap-2">
        <Swatch i={index} />
        <Label htmlFor={id} className="font-mono">
          f{SUBS[index]}(x) =
        </Label>
      </div>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className="min-w-0 flex-1 font-mono"
          placeholder="x^2"
        />
        {onRemove ? (
          <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove f${SUBS[index]}`}>
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-err`} className="flex items-start gap-1.5 text-[0.8125rem] font-[560] text-foreground">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  v: View,
  list: { i: number; id: number; f: Fn | null; m: Morph | undefined }[],
  ink: Ink,
) {
  const ppu = w / v.span
  const left = v.cx - w / 2 / ppu
  const right = v.cx + w / 2 / ppu
  const bottom = v.cy - h / 2 / ppu
  const top = v.cy + h / 2 / ppu
  const X = (x: number) => (x - left) * ppu
  const Y = (y: number) => (top - y) * ppu

  // grid
  const step = niceStep(right - left, Math.max(6, Math.round(w / 70)))
  ctx.lineWidth = 1
  ctx.strokeStyle = ink.paper
  ctx.beginPath()
  for (let x = Math.ceil(left / step) * step; x <= right; x += step) {
    const px = Math.round(X(x)) + 0.5
    ctx.moveTo(px, 0)
    ctx.lineTo(px, h)
  }
  for (let y = Math.ceil(bottom / step) * step; y <= top; y += step) {
    const py = Math.round(Y(y)) + 0.5
    ctx.moveTo(0, py)
    ctx.lineTo(w, py)
  }
  ctx.stroke()

  // axes
  const ax = Math.min(h - 1, Math.max(0, Y(0)))
  const ay = Math.min(w - 1, Math.max(0, X(0)))
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 1.25
  ctx.beginPath()
  if (bottom <= 0 && top >= 0) {
    ctx.moveTo(0, Math.round(Y(0)) + 0.5)
    ctx.lineTo(w, Math.round(Y(0)) + 0.5)
  }
  if (left <= 0 && right >= 0) {
    ctx.moveTo(Math.round(X(0)) + 0.5, 0)
    ctx.lineTo(Math.round(X(0)) + 0.5, h)
  }
  ctx.stroke()

  // tick labels along the axes (kept inside the canvas)
  const opts = { color: ink.grey, halo: ink.fill, font: ink.font, size: 11 }
  for (let x = Math.ceil(left / step) * step; x <= right; x += step) {
    if (Math.abs(x) < step / 2) continue
    const px = X(x)
    if (px < 14 || px > w - 14) continue
    const ly = ax > h - 18 ? ax - 6 : ax + 14
    text(ctx, fmt(Number(x.toPrecision(12)), 6), px, ly, { ...opts, align: 'center' })
  }
  for (let y = Math.ceil(bottom / step) * step; y <= top; y += step) {
    if (Math.abs(y) < step / 2) continue
    const py = Y(y)
    if (py < 10 || py > h - 10) continue
    const onRight = ay < 40
    text(ctx, fmt(Number(y.toPrecision(12)), 6), onRight ? ay + 6 : ay - 6, py + 4, { ...opts, align: onRight ? 'left' : 'right' })
  }

  // curves
  const n = Math.ceil(w) + 1
  for (const c of list) {
    const m = c.m && c.m.t < 1 ? c.m : undefined
    const to = c.f
    if (!to) continue
    const t = m ? easeOut(m.t) : 1
    const from = m?.from ?? null
    const drawIn = m !== undefined && from === null
    const style = STYLES[c.i]!
    ctx.save()
    ctx.strokeStyle = style.grey ? ink.grey : ink.ink
    ctx.lineWidth = style.width
    ctx.lineJoin = 'round'
    ctx.lineCap = style.dash.length === 2 && style.dash[0]! < 2 ? 'round' : 'butt'
    ctx.setLineDash(style.dash)
    // A new curve draws in from the left; a changed one morphs from the old.
    const last = drawIn ? Math.max(2, Math.round(n * t)) : n
    ctx.beginPath()
    let pen = false
    let prevY = 0
    for (let k = 0; k < last; k++) {
      const x = left + k / ppu
      let y = to(x)
      if (from && t < 1) {
        const y0 = from(x)
        if (Number.isFinite(y0) && Number.isFinite(y)) y = y0 + (y - y0) * t
      }
      if (!Number.isFinite(y)) {
        pen = false
        continue
      }
      const py = Math.max(-10 * h, Math.min(11 * h, Y(y)))
      const jump = pen && ((prevY < -h && py > 2 * h) || (prevY > 2 * h && py < -h) || Math.abs(py - prevY) > 4 * h)
      if (!pen || jump) ctx.moveTo(k, py)
      else ctx.lineTo(k, py)
      pen = true
      prevY = py
    }
    ctx.stroke()
    ctx.restore()
  }
}
