import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/*
 * Hand-written SVG line chart for the reference tools. Black line, grey area, dashed second
 * series. The SVG is drawn at the container's pixel width so text stays 12 px on a phone.
 * When the data changes, each line moves from where it is to the new shape (a requestAnimationFrame
 * tween of the path, restarted from the current frame if the data changes again). Reduced
 * motion shows the new shape at once.
 */

export interface ChartSeries {
  label: string
  values: ArrayLike<number | null>
  /** solid ink (default), dashed ink, or grey */
  style?: 'solid' | 'dashed' | 'grey'
}

export interface ChartMarker {
  x: number
  y: number
  label: string
}

export interface LineChartProps {
  /** Shared x values (ascending), one per value in each series. */
  x: ArrayLike<number>
  series: ChartSeries[]
  formatY: (v: number) => string
  formatX: (x: number) => string
  /** Tick positions for the x axis, from the visible x range. */
  xTicks: (min: number, max: number, approxCount: number) => { x: number; label: string }[]
  log?: boolean
  /** Fill the area under the first series. */
  area?: boolean
  /** Include zero in the y range. */
  zero?: boolean
  markers?: ChartMarker[]
  ariaLabel: string
  /** Text summary of what the chart shows, read by screen readers and shown below. */
  summary: ReactNode
  height?: number
  className?: string
}

const PAD = { top: 14, right: 12, bottom: 28, left: 8 }
const DURATION = 480

const easeOut = (t: number) => 1 - (1 - t) ** 3

function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count)
  const exp = 10 ** Math.floor(Math.log10(raw))
  const f = raw / exp
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp
}

function linearTicks(min: number, max: number, count: number): number[] {
  if (!(max > min)) return [min]
  const step = niceStep(max - min, count)
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)))
  return out
}

function logTicks(min: number, max: number): number[] {
  const out: number[] = []
  const lo = Math.floor(Math.log10(min))
  const hi = Math.ceil(Math.log10(max))
  const mult = hi - lo > 4 ? [1] : hi - lo > 2 ? [1, 3] : [1, 2, 5]
  for (let e = lo; e <= hi; e++) for (const m of mult) {
    const v = m * 10 ** e
    if (v >= min && v <= max) out.push(v)
  }
  return out
}

/** Years between two day numbers as x ticks (for day-number x values). */
export function yearTicks(min: number, max: number, approx: number): { x: number; label: string }[] {
  const y0 = new Date(min * 86_400_000).getUTCFullYear()
  const y1 = new Date(max * 86_400_000).getUTCFullYear()
  const span = y1 - y0
  if (span < 2) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthCount = (max - min) / 30.4
    const stepM = [1, 2, 3, 6, 12].find((s) => monthCount / s <= approx) ?? 12
    const out: { x: number; label: string }[] = []
    for (let y = y0; y <= y1; y++)
      for (let m = 0; m < 12; m += stepM) {
        const d = Date.UTC(y, m, 1) / 86_400_000
        if (d >= min && d <= max) out.push({ x: d, label: m === 0 ? String(y) : months[m] })
      }
    if (out.length < 2 && max - min < 62) {
      // Under two months: label weeks by day.
      const first = Math.ceil(min / 7) * 7
      for (let d = first; d <= max; d += 7) {
        const date = new Date(d * 86_400_000)
        out.push({ x: d, label: `${months[date.getUTCMonth()]} ${date.getUTCDate()}` })
      }
      return thin(out.filter((t, i, a) => a.findIndex((u) => u.x === t.x) === i).sort((a, b) => a.x - b.x), approx)
    }
    return out
  }
  const step = [1, 2, 5, 10, 20, 25, 50].find((s) => span / s <= approx) ?? 50
  const out: { x: number; label: string }[] = []
  for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
    const d = Date.UTC(y, 0, 1) / 86_400_000
    if (d >= min && d <= max) out.push({ x: d, label: String(y) })
  }
  return out
}

/** Plain numeric ticks (ages, years as numbers). */
export function numberTicks(min: number, max: number, approx: number): { x: number; label: string }[] {
  return linearTicks(min, max, approx).map((v) => ({ x: v, label: String(v) }))
}

function thin<T>(list: T[], max: number): T[] {
  if (list.length <= max) return list
  const step = Math.ceil(list.length / max)
  return list.filter((_, i) => i % step === 0)
}

interface Layout {
  n: number
  xs: number[]
  ys: number[][]
  idx: number[]
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    setWidth(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function LineChart({
  x,
  series,
  formatY,
  formatX,
  xTicks,
  log = false,
  area = false,
  zero = false,
  markers = [],
  ariaLabel,
  summary,
  height: heightProp,
  className,
}: LineChartProps) {
  const uid = useId().replace(/:/g, '')
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const narrow = width > 0 && width < 480
  const height = heightProp ?? (narrow ? 220 : 280)

  // Y range over all series (and markers).
  const domain = useMemo(() => {
    let lo = Infinity
    let hi = -Infinity
    for (const s of series)
      for (let i = 0; i < s.values.length; i++) {
        const v = s.values[i]
        if (v === null || !Number.isFinite(v) || (log && v <= 0)) continue
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    for (const m of markers) {
      lo = Math.min(lo, m.y)
      hi = Math.max(hi, m.y)
    }
    if (!Number.isFinite(lo)) return { lo: 0, hi: 1 }
    if (zero && !log) lo = Math.min(0, lo)
    if (lo === hi) {
      lo = log ? lo / 2 : lo - Math.abs(lo || 1) * 0.1
      hi = log ? hi * 2 : hi + Math.abs(hi || 1) * 0.1
    }
    if (log) return { lo: lo / 1.05, hi: hi * 1.05 }
    const pad = (hi - lo) * 0.06
    return { lo: zero && lo >= 0 ? lo : lo - pad, hi: hi + pad }
  }, [series, markers, log, zero])

  const ticks = useMemo(() => (log ? logTicks(domain.lo, domain.hi) : linearTicks(domain.lo, domain.hi, narrow ? 4 : 5)), [domain, log, narrow])
  const labelWidth = useMemo(() => Math.max(28, ...ticks.map((t) => formatY(t).length * 6.6)) + 8, [ticks, formatY])
  const left = PAD.left + labelWidth
  const plotW = Math.max(10, width - left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const xMin = x.length ? x[0] : 0
  const xMax = x.length ? x[x.length - 1] : 1
  const xSpan = xMax - xMin || 1
  const sx = useCallback((v: number) => left + ((v - xMin) / xSpan) * plotW, [left, xMin, xSpan, plotW])
  const sy = useCallback(
    (v: number) => {
      const t = log ? (Math.log(v) - Math.log(domain.lo)) / (Math.log(domain.hi) - Math.log(domain.lo)) : (v - domain.lo) / (domain.hi - domain.lo)
      return PAD.top + plotH - t * plotH
    },
    [log, domain, plotH],
  )

  // One sample per pixel column (at most), each the last value in its column.
  const layout = useMemo<Layout>(() => {
    const n = Math.max(2, Math.min(x.length, Math.floor(plotW)))
    const xs: number[] = []
    const idx: number[] = []
    for (let k = 0; k < n; k++) {
      const target = xMin + (k / (n - 1)) * xSpan
      // binary search for the last x <= target
      let lo = 0
      let hi = x.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (x[mid] <= target) lo = mid
        else hi = mid - 1
      }
      idx.push(lo)
      xs.push(sx(x[lo]))
    }
    const ys = series.map((s) =>
      idx.map((i) => {
        let j = i
        while (j >= 0 && (s.values[j] === null || !Number.isFinite(s.values[j] as number) || (log && (s.values[j] as number) <= 0))) j--
        return j >= 0 && i - j < 400 ? sy(s.values[j] as number) : Number.NaN
      }),
    )
    return { n, xs, ys, idx }
  }, [x, series, plotW, xMin, xSpan, sx, sy, log])

  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const areaRef = useRef<SVGPathElement | null>(null)
  const drawn = useRef<number[][] | null>(null)
  const raf = useRef(0)

  const toPath = (xs: number[], ys: number[]) => {
    let d = ''
    let pen = false
    for (let k = 0; k < xs.length; k++) {
      const y = ys[k]
      if (!Number.isFinite(y)) {
        pen = false
        continue
      }
      d += `${pen ? 'L' : 'M'}${xs[k].toFixed(1)} ${y.toFixed(1)}`
      pen = true
    }
    return d
  }

  const paint = useCallback(
    (ys: number[][]) => {
      ys.forEach((line, i) => pathRefs.current[i]?.setAttribute('d', toPath(layout.xs, line)))
      if (areaRef.current && ys[0]) {
        const base = PAD.top + plotH
        const first = ys[0].findIndex((v) => Number.isFinite(v))
        let last = -1
        for (let k = ys[0].length - 1; k >= 0; k--) if (Number.isFinite(ys[0][k])) {
          last = k
          break
        }
        const line = toPath(layout.xs, ys[0])
        areaRef.current.setAttribute('d', first < 0 ? '' : `${line}L${layout.xs[last].toFixed(1)} ${base}L${layout.xs[first].toFixed(1)} ${base}Z`)
      }
    },
    [layout.xs, plotH],
  )

  useEffect(() => {
    if (!width) return
    const target = layout.ys
    const from = drawn.current
    cancelAnimationFrame(raf.current)
    const sameShape = from && from.length === target.length && from.every((l, i) => l.length === target[i].length)
    if (!sameShape || reducedMotion()) {
      drawn.current = target.map((l) => l.slice())
      paint(drawn.current)
      return
    }
    const start = performance.now()
    const begin = from.map((l) => l.slice())
    const step = (now: number) => {
      const t = easeOut(Math.min(1, (now - start) / DURATION))
      const cur = target.map((line, i) =>
        line.map((v, k) => {
          const a = begin[i][k]
          if (!Number.isFinite(a) || !Number.isFinite(v)) return v
          return a + (v - a) * t
        }),
      )
      drawn.current = cur
      paint(cur)
      if (t < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [layout, paint, width])

  // Cursor (pointer or keyboard).
  const [cursor, setCursor] = useState<number | null>(null)
  useEffect(() => setCursor(null), [x])
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    const px = e.clientX - rect.left
    const k = Math.round(((px - left) / plotW) * (layout.n - 1))
    setCursor(Math.max(0, Math.min(layout.n - 1, k)))
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const big = Math.max(1, Math.round(layout.n / 20))
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageDown: -big, PageUp: big }
    if (e.key in moves) {
      e.preventDefault()
      setCursor((c) => Math.max(0, Math.min(layout.n - 1, (c ?? layout.n - 1) + moves[e.key])))
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setCursor(e.key === 'Home' ? 0 : layout.n - 1)
    } else if (e.key === 'Escape') setCursor(null)
  }
  const cursorIndex = cursor === null ? null : layout.idx[cursor]
  const cursorText =
    cursorIndex === null
      ? ''
      : `${formatX(x[cursorIndex])}: ${series
          .map((s) => {
            const v = s.values[cursorIndex]
            return `${series.length > 1 ? `${s.label} ` : ''}${v === null || !Number.isFinite(v) ? 'no data' : formatY(v)}`
          })
          .join(', ')}`

  const xt = width ? xTicks(xMin, xMax, Math.max(2, Math.floor(plotW / 80))) : []
  const base = PAD.top + plotH

  return (
    <figure className={cn('space-y-2', className)}>
      <div
        ref={wrapRef}
        className="relative w-full touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ height }}
        tabIndex={0}
        role="group"
        aria-label={`${ariaLabel}. Use the arrow keys to read values.`}
        onKeyDown={onKey}
        onBlur={() => setCursor(null)}
      >
        {width ? (
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block text-muted-foreground" aria-hidden="true">
            <defs>
              <clipPath id={`clip-${uid}`}>
                <rect x={left} y={PAD.top - 2} width={plotW} height={plotH + 4} />
              </clipPath>
            </defs>
            {ticks.map((t) => (
              <g key={`y${t}`} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
                <line x1={left} x2={left + plotW} y1={sy(t)} y2={sy(t)} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="2 5" />
                <text x={left - 8} y={sy(t) + 4} textAnchor="end" fontSize={12} fill="currentColor" className="tabular-nums">
                  {formatY(t)}
                </text>
              </g>
            ))}
            {xt.map((t) => (
              <text key={`x${t.x}`} x={sx(t.x)} y={base + 19} textAnchor="middle" fontSize={12} fill="currentColor" className="tabular-nums motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
                {t.label}
              </text>
            ))}
            <line x1={left} x2={left + plotW} y1={base} y2={base} stroke="currentColor" strokeOpacity={0.6} />
            <g clipPath={`url(#clip-${uid})`}>
              {area ? <path ref={areaRef} fill="var(--chart-5)" /> : null}
              {series.map((s, i) => (
                <path
                  key={s.label}
                  ref={(el) => {
                    pathRefs.current[i] = el
                  }}
                  fill="none"
                  stroke={s.style === 'grey' ? 'var(--chart-3)' : 'var(--foreground)'}
                  strokeWidth={s.style === 'grey' ? 1.5 : 2}
                  strokeDasharray={s.style === 'dashed' ? '6 4' : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
            </g>
            {markers.map((m) => (
              <g key={m.label} className="chart-marker">
                <circle cx={sx(m.x)} cy={sy(m.y)} r={6} fill="var(--background)" stroke="var(--foreground)" strokeWidth={2} />
                <circle cx={sx(m.x)} cy={sy(m.y)} r={2.5} fill="var(--foreground)" />
              </g>
            ))}
            {cursor !== null && cursorIndex !== null ? (
              <g>
                <line x1={layout.xs[cursor]} x2={layout.xs[cursor]} y1={PAD.top} y2={base} stroke="var(--foreground)" strokeOpacity={0.5} />
                {series.map((s, i) => {
                  const y = layout.ys[i][cursor]
                  return Number.isFinite(y) ? <circle key={s.label} cx={layout.xs[cursor]} cy={y} r={4} fill="var(--foreground)" /> : null
                })}
              </g>
            ) : null}
            <rect
              x={left}
              y={PAD.top}
              width={plotW}
              height={plotH}
              fill="transparent"
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={(e) => e.pointerType === 'mouse' && setCursor(null)}
            />
          </svg>
        ) : null}
        {cursor !== null ? (
          <div className="pointer-events-none absolute top-0 right-0 rounded-md bg-background px-2 py-1 text-xs font-[600] tabular-nums text-foreground shadow-pop">
            {cursorText}
          </div>
        ) : null}
      </div>
      <figcaption className="text-[0.8125rem] text-pretty text-muted-foreground">{summary}</figcaption>
      <p className="sr-only" role="status" aria-live="polite">
        {cursorText}
      </p>
    </figure>
  )
}
