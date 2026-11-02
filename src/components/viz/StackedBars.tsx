import { useId, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { ChartFrame } from './ChartFrame'
import type { DataTableSpec } from './ChartFrame'
import { PAINT_ORDER, PaintDefs, Swatch, fillOf } from './paint'
import type { Paint } from './paint'
import { barLabelIndexes, compact, linear, niceDomain } from './scale'
import { useTweenRows, useWidth } from './tween'

export interface BarSeries {
  id: string
  label: string
  /** One value per category, 0 or more. */
  values: number[]
  /** Default by position: ink, hatch, grey, dots. */
  paint?: Paint
}

export interface StackedBarsProps {
  /** One bar per category (years, weeks, splits). */
  categories: (string | number)[]
  series: BarSeries[]
  /** Text summary under the chart. Required. */
  summary: ReactNode
  ariaLabel?: string
  /** Plot height in px. Default 220. */
  height?: number
  /** Readout and table label for the category, e.g. "Year". */
  categoryLabel?: string
  formatCategory?: (c: string | number) => string
  /** Axis labels. Default compact. */
  formatY?: (y: number) => string
  /** Readout and table values. Default formatY. */
  formatValue?: (y: number) => string
  /** Add a total to the readout and the table. */
  showTotal?: boolean
  /** `true` builds the table from the series. */
  table?: DataTableSpec | boolean
  /** Readout index when the pointer is not on the chart. Default 0. */
  defaultIndex?: number
  className?: string
}

const M = { top: 10, right: 6, bottom: 24 }

export function StackedBars({
  categories,
  series,
  summary,
  ariaLabel,
  height = 220,
  categoryLabel,
  formatCategory = (c) => String(c),
  formatY = (v) => compact(v),
  formatValue,
  showTotal = false,
  table,
  defaultIndex = 0,
  className,
}: StackedBarsProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [boxRef, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const [kbd, setKbd] = useState(false)
  const fmtValue = formatValue ?? formatY
  const n = categories.length
  const paints = series.map((s, k) => s.paint ?? PAINT_ORDER[k % PAINT_ORDER.length]!)

  const rows = series.map((s) => categories.map((_, i) => Math.max(0, s.values[i] ?? 0)))
  const totals = categories.map((_, i) => rows.reduce((a, r) => a + r[i]!, 0))
  const dom = niceDomain(0, Math.max(0, ...totals), height < 180 ? 3 : 4)
  const left = Math.ceil(Math.max(...dom.ticks.map((t) => formatY(t).length)) * 6.6 + 10)

  const shown = useTweenRows([...rows, [dom.max]], { from: [...rows.map((r) => r.map(() => 0)), [dom.max]] })
  const yMax = shown[shown.length - 1]?.[0] ?? dom.max
  const sy = linear(0, yMax || 1, height - M.bottom, M.top)
  const plotW = Math.max(1, W - left - M.right)
  const band = plotW / Math.max(1, n)
  const gap = band >= 10 ? band * 0.28 : band >= 4 ? 1 : 0
  const barW = Math.max(1, band - gap)
  const bx = (i: number) => left + i * band + gap / 2

  const idx = hover ?? Math.min(n - 1, Math.max(0, defaultIndex))

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect()
    const px = ((clientX - r.left) / Math.max(1, r.width)) * W
    setHover(Math.min(n - 1, Math.max(0, Math.floor((px - left) / band))))
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

  const xIdx = barLabelIndexes(n, Math.max(2, Math.floor(plotW / 44)))
  const tbl: DataTableSpec | undefined =
    table === true
      ? {
          columns: [categoryLabel ?? 'Item', ...series.map((s) => s.label), ...(showTotal ? ['Total'] : [])],
          rows: categories.map((c, i) => [
            formatCategory(c),
            ...series.map((s) => fmtValue(s.values[i] ?? 0)),
            ...(showTotal ? [fmtValue(totals[i]!)] : []),
          ]),
        }
      : table || undefined

  const readout = (
    <div className="flex min-h-[1.25rem] flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] tabular-nums" aria-live={kbd ? 'polite' : 'off'}>
      {n > 0 ? (
        <span className="font-[650]">
          {categoryLabel ? `${categoryLabel} ` : ''}
          {formatCategory(categories[idx]!)}
        </span>
      ) : null}
      {series.map((s, k) => (
        <span key={s.id} className="flex min-w-0 items-center gap-1.5">
          <Swatch paint={paints[k]} />
          <span className="text-muted-foreground">{s.label}</span>
          <span className="font-[620]">{n > 0 ? fmtValue(s.values[idx] ?? 0) : ''}</span>
        </span>
      ))}
      {showTotal && n > 0 ? (
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Total</span>
          <span className="font-[620]">{fmtValue(totals[idx]!)}</span>
        </span>
      ) : null}
    </div>
  )

  return (
    <ChartFrame readout={readout} summary={summary} table={tbl} className={className}>
      <div ref={boxRef} className="w-full">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${W} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={ariaLabel ?? `Bar chart of ${series.map((s) => s.label).join(', ')}`}
          tabIndex={0}
          className="block touch-pan-y select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ fontVariantNumeric: 'tabular-nums' }}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => { setKbd(false); setHover(null) }}
        >
          <PaintDefs uid={uid} />
          {dom.ticks.map((t) => {
            const y = sy(t)
            if (y < M.top - 1) return null
            return (
              <g key={`y${t}`}>
                <line x1={left} x2={W - M.right} y1={y} y2={y} style={{ stroke: 'var(--background)', strokeWidth: 1 }} />
                <text x={left - 8} y={y} dy="0.32em" textAnchor="end" style={{ fill: 'var(--muted-foreground)', fontSize: 11 }}>
                  {formatY(t)}
                </text>
              </g>
            )
          })}
          {categories.map((c, i) => {
            let acc = 0
            return (
              <g key={`b${i}`}>
                {series.map((s, k) => {
                  const v = Math.max(0, shown[k]?.[i] ?? 0)
                  const y0 = sy(acc)
                  acc += v
                  const y1 = sy(acc)
                  const h = y0 - y1
                  if (h <= 0.05) return null
                  return (
                    <rect
                      key={s.id}
                      x={bx(i)}
                      y={y1}
                      width={barW}
                      height={h}
                      style={{ fill: fillOf(paints[k]!, uid) }}
                    />
                  )
                })}
                {hover === i ? (
                  <rect x={bx(i)} y={height - M.bottom + 2} width={barW} height={3} style={{ fill: 'var(--foreground)' }} />
                ) : null}
              </g>
            )
          })}
          <line x1={left} x2={W - M.right} y1={sy(0)} y2={sy(0)} style={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }} />
          {xIdx.map((i) => {
            const cx = bx(i) + barW / 2
            const half = formatCategory(categories[i]!).length * 3.2
            const anchor = cx - half < left - 4 ? 'start' : cx + half > W ? 'end' : 'middle'
            const tx = anchor === 'start' ? bx(i) : anchor === 'end' ? bx(i) + barW : cx
            return (
              <text key={`x${i}`} x={tx} y={height - 6} textAnchor={anchor} style={{ fill: 'var(--muted-foreground)', fontSize: 11 }}>
                {formatCategory(categories[i]!)}
              </text>
            )
          })}
        </svg>
      </div>
    </ChartFrame>
  )
}
