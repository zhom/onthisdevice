import { useId, useMemo, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChartFrame } from './ChartFrame'
import type { DataTableSpec } from './ChartFrame'
import { PAINT_ORDER, PaintDefs, STROKE_ORDER, Swatch, fillOf, strokeOf } from './paint'
import type { Paint, Stroke } from './paint'
import { compact, linear, niceDomain, niceTicksIn } from './scale'
import { useTweenRows, useWidth } from './tween'

export interface LineSeries {
  id: string
  label: string
  /** One value per x. */
  values: number[]
  /** Line style. Default by position: solid, dash, grey, dot. */
  stroke?: Stroke
  /** Area fill (area charts). Default by position: ink, hatch, grey, dots. */
  paint?: Paint
}

export interface ChartMarker {
  x: number
  label: string
}

export interface ChartGuide {
  y: number
  label: string
  /** Label side. Default right. */
  align?: 'left' | 'right'
}

export interface LineChartProps {
  /** The x values, shared by every series (years, months, ages). */
  x: number[]
  series: LineSeries[]
  /** Text summary under the chart. Required: it is the chart for screen readers. */
  summary: ReactNode
  /** Accessible name of the drawing. Defaults to the series labels. */
  ariaLabel?: string
  /** Plot height in px. Default 220. */
  height?: number
  /** Fill under each line. */
  area?: boolean
  /** Stack the series (each line is the running total). */
  stacked?: boolean
  /** Readout and table label for x, e.g. "Year". */
  xLabel?: string
  formatX?: (x: number) => string
  /** x in the readout and the table. Default formatX. */
  readoutX?: (x: number) => string
  /** Axis labels. Default compact (1.2k, 3.4M). */
  formatY?: (y: number) => string
  /** Readout and table values. Default formatY. */
  formatValue?: (y: number) => string
  /** Vertical marker lines with a label, e.g. a payoff year. */
  markers?: ChartMarker[]
  /** Horizontal reference lines with a label, e.g. a legal limit or a goal. */
  guides?: ChartGuide[]
  /** `true` builds the table from the series. */
  table?: DataTableSpec | boolean
  /** Readout index when the pointer is not on the chart. Default the last point. */
  defaultIndex?: number
  /** Keep 0 inside the y range. Default true. */
  zero?: boolean
  className?: string
}

const M = { top: 10, right: 10, bottom: 24 }

function pathOf(row: readonly number[]): string {
  let d = ''
  for (let i = 0; i + 1 < row.length; i += 2) {
    d += `${i === 0 ? 'M' : 'L'}${row[i]!.toFixed(1)},${row[i + 1]!.toFixed(1)}`
  }
  return d
}

function areaOf(top: readonly number[], bottom: readonly number[] | number): string {
  if (top.length < 4) return ''
  let d = pathOf(top)
  if (typeof bottom === 'number') {
    d += `L${top[top.length - 2]!.toFixed(1)},${bottom.toFixed(1)}L${top[0]!.toFixed(1)},${bottom.toFixed(1)}Z`
  } else {
    for (let i = bottom.length - 2; i >= 0; i -= 2) d += `L${bottom[i]!.toFixed(1)},${bottom[i + 1]!.toFixed(1)}`
    d += 'Z'
  }
  return d
}

export function LineChart({
  x,
  series,
  summary,
  ariaLabel,
  height = 220,
  area = false,
  stacked = false,
  xLabel,
  formatX = (v) => String(v),
  readoutX,
  formatY = (v) => compact(v),
  formatValue,
  markers = [],
  guides = [],
  table,
  defaultIndex,
  zero = true,
  className,
}: LineChartProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [boxRef, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const [kbd, setKbd] = useState(false)
  const fmtValue = formatValue ?? formatY
  const fmtXr = readoutX ?? formatX
  const n = x.length

  const geo = useMemo(() => {
    // Running totals when stacked.
    const tops: number[][] = []
    series.forEach((s, k) => {
      const prev = tops[k - 1]
      tops.push(x.map((_, i) => (s.values[i] ?? 0) + (stacked && prev ? prev[i]! : 0)))
    })
    let lo = Infinity
    let hi = -Infinity
    for (const row of tops) for (const v of row) if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v) }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1 }
    for (const g of guides) if (Number.isFinite(g.y)) { lo = Math.min(lo, g.y); hi = Math.max(hi, g.y) }
    if (zero || area || stacked) { lo = Math.min(lo, 0); hi = Math.max(hi, 0) }
    const ticksWanted = height < 180 ? 3 : 4
    const dom = niceDomain(lo, hi, ticksWanted)
    const labelW = Math.max(...dom.ticks.map((t) => formatY(t).length)) * 6.6 + 10
    const left = Math.ceil(labelW)
    const x0 = x[0] ?? 0
    const x1 = x[n - 1] ?? 1
    const sx = linear(x0, x1 === x0 ? x0 + 1 : x1, left, W - M.right)
    const sy = linear(dom.min, dom.max, height - M.bottom, M.top)
    const base = sy(Math.max(dom.min, Math.min(0, dom.max)))
    const rows = tops.map((row) => row.flatMap((v, i) => [sx(x[i]!), sy(Number.isFinite(v) ? v : 0)]))
    return { tops, dom, left, x0, x1, sx, sy, base, rows }
  }, [x, series, stacked, zero, area, height, W, formatY, n, guides])

  // One extra row carries the axes: [base, yMin, yMax, xMin, xMax, left].
  const axisRow = [geo.base, geo.dom.min, geo.dom.max, geo.x0, geo.x1, geo.left]
  const target = [...geo.rows, axisRow]
  const from = [...geo.rows.map((r) => r.map((v, i) => (i % 2 ? geo.base : v))), axisRow]
  const shown = useTweenRows(target, { stride: 2, from })
  const ax = shown[shown.length - 1] ?? axisRow
  const [base, yMin, yMax, xMin, xMax, left] = ax as [number, number, number, number, number, number]
  const sxShown = linear(xMin, xMax === xMin ? xMin + 1 : xMax, left, W - M.right)
  const syShown = linear(yMin, yMax, height - M.bottom, M.top)

  const idx = hover ?? Math.min(n - 1, Math.max(0, defaultIndex ?? n - 1))
  const strokes = series.map((s, k) => s.stroke ?? STROKE_ORDER[k % STROKE_ORDER.length]!)
  const paints = series.map((s, k) => s.paint ?? PAINT_ORDER[k % PAINT_ORDER.length]!)

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect()
    const px = ((clientX - r.left) / Math.max(1, r.width)) * W
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < n; i++) {
      const d = Math.abs(geo.sx(x[i]!) - px)
      if (d < bestD) { bestD = d; best = i }
    }
    setHover(best)
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => { setKbd(false); pick(e.clientX, e.currentTarget) }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const cur = hover ?? idx
    let next = cur
    if (e.key === 'ArrowLeft') next = Math.max(0, cur - 1)
    else if (e.key === 'ArrowRight') next = Math.min(n - 1, cur + 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else return
    e.preventDefault()
    setKbd(true)
    setHover(next)
  }

  let minDx = Infinity
  for (let k = 1; k < n; k++) minDx = Math.min(minDx, Math.abs(x[k]! - x[k - 1]!))
  const xTicks = niceTicksIn(geo.x0, geo.x1, Math.max(2, Math.floor((W - geo.left) / 70)), Number.isFinite(minDx) && minDx >= 1 ? 1 : 0)
  const tbl: DataTableSpec | undefined =
    table === true
      ? {
          columns: [xLabel ?? 'x', ...series.map((s) => s.label)],
          rows: x.map((xv, i) => [fmtXr(xv), ...series.map((s) => fmtValue(s.values[i] ?? 0))]),
        }
      : table || undefined

  const readout = (
    <div
      className="flex min-h-[1.25rem] flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] tabular-nums"
      aria-live={kbd ? 'polite' : 'off'}
    >
      {n > 0 ? (
        <span className="font-[650]">
          {xLabel ? `${xLabel} ` : ''}
          {fmtXr(x[idx]!)}
        </span>
      ) : null}
      {series.map((s, k) => (
        <span key={s.id} className="flex min-w-0 items-center gap-1.5">
          {area ? <Swatch paint={paints[k]} /> : <Swatch stroke={strokes[k]} />}
          <span className="text-muted-foreground">{s.label}</span>
          <span className="font-[620]">{n > 0 ? fmtValue(s.values[idx] ?? 0) : ''}</span>
        </span>
      ))}
    </div>
  )

  const hx = shown[0] ? shown[0][idx * 2] : undefined

  return (
    <ChartFrame readout={readout} summary={summary} table={tbl} className={className}>
      <div ref={boxRef} className="w-full">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${W} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={ariaLabel ?? `Chart of ${series.map((s) => s.label).join(', ')}`}
          tabIndex={0}
          className={cn('block touch-pan-y select-none overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md')}
          style={{ fontVariantNumeric: 'tabular-nums' }}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => { setKbd(false); setHover(null) }}
        >
          <PaintDefs uid={uid} />
          {/* grid: paper lines, visible on the card fill */}
          {geo.dom.ticks.map((t) => {
            const y = syShown(t)
            if (y < M.top - 1 || y > height - M.bottom + 1) return null
            return (
              <g key={`y${t}`}>
                <line x1={left} x2={W - M.right} y1={y} y2={y} style={{ stroke: 'var(--background)', strokeWidth: 1 }} />
                <text x={left - 8} y={y} dy="0.32em" textAnchor="end" style={{ fill: 'var(--muted-foreground)', fontSize: 11 }}>
                  {formatY(t)}
                </text>
              </g>
            )
          })}
          {/* areas */}
          {area
            ? shown.slice(0, series.length).map((row, k) => (
                <path
                  key={`a${series[k]!.id}`}
                  d={areaOf(row, stacked && k > 0 ? shown[k - 1]! : base)}
                  style={{ fill: fillOf(paints[k]!, uid) }}
                />
              ))
            : null}
          {/* lines */}
          {shown.slice(0, series.length).map((row, k) => (
            <path
              key={`l${series[k]!.id}`}
              d={pathOf(row)}
              style={{ ...strokeOf(area ? 'solid' : strokes[k]!), fill: 'none', strokeLinejoin: 'round' }}
              strokeWidth={area ? 1.5 : undefined}
            />
          ))}
          {/* baseline */}
          <line x1={left} x2={W - M.right} y1={base} y2={base} style={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }} />
          {/* guides */}
          {guides.map((g) => {
            const gy = syShown(g.y)
            if (gy < M.top - 1 || gy > height - M.bottom + 1) return null
            return (
              <g key={`g${g.label}${g.y}`}>
                <line x1={left} x2={W - M.right} y1={gy} y2={gy} style={{ stroke: 'var(--foreground)', strokeWidth: 1, strokeDasharray: '2 3' }} />
                <text x={g.align === 'left' ? left + 4 : W - M.right} y={gy - 4} textAnchor={g.align === 'left' ? 'start' : 'end'} style={{ fill: 'var(--foreground)', fontSize: 11, fontWeight: 600, paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 3 }}>
                  {g.label}
                </text>
              </g>
            )
          })}
          {/* markers */}
          {(() => {
            // Labels that would overlap the one before move down one row.
            const placed: { x0: number; x1: number; row: number }[] = []
            return [...markers]
              .sort((a, b) => a.x - b.x)
              .map((m) => {
                const mx = sxShown(m.x)
                if (mx < left - 1 || mx > W - M.right + 1) return null
                const anchor = mx > W * 0.7 ? 'end' : 'start'
                const w = m.label.length * 6.3 + 4
                const x0 = anchor === 'start' ? mx : mx - w
                const x1 = anchor === 'start' ? mx + w : mx
                let row = 0
                while (placed.some((p) => p.row === row && x0 < p.x1 && x1 > p.x0)) row++
                placed.push({ x0, x1, row })
                return (
                  <g key={`m${m.label}${m.x}`}>
                    <line x1={mx} x2={mx} y1={M.top} y2={height - M.bottom} style={{ stroke: 'var(--foreground)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <text x={mx + (anchor === 'start' ? 4 : -4)} y={M.top + 2 + row * 14} dy="0.7em" textAnchor={anchor} style={{ fill: 'var(--foreground)', fontSize: 11, fontWeight: 600, paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 3 }}>
                      {m.label}
                    </text>
                  </g>
                )
              })
          })()}
          {/* x labels */}
          {xTicks.map((xv) => {
            const px = sxShown(xv)
            const label = formatX(xv)
            const half = label.length * 3.2
            const anchor = px - half < left - 4 ? 'start' : px + half > W ? 'end' : 'middle'
            return (
              <text key={`x${xv}`} x={px} y={height - 6} textAnchor={anchor} style={{ fill: 'var(--muted-foreground)', fontSize: 11 }}>
                {label}
              </text>
            )
          })}
          {/* scrubber */}
          {hover !== null && hx !== undefined ? (
            <g>
              <line x1={hx} x2={hx} y1={M.top} y2={height - M.bottom} style={{ stroke: 'var(--foreground)', strokeWidth: 1 }} />
              {shown.slice(0, series.length).map((row, k) => (
                <circle
                  key={`d${series[k]!.id}`}
                  cx={row[idx * 2]}
                  cy={row[idx * 2 + 1]}
                  r={3.5}
                  style={{ fill: 'var(--background)', stroke: 'var(--foreground)', strokeWidth: 2 }}
                />
              ))}
            </g>
          ) : null}
        </svg>
      </div>
    </ChartFrame>
  )
}

/** A LineChart with filled areas. Stacked by default. */
export function AreaChart(props: LineChartProps) {
  return <LineChart {...props} area stacked={props.stacked ?? true} />
}
