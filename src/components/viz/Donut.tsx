import { useId } from 'react'
import type { ReactNode } from 'react'
import { ChartFrame, Legend } from './ChartFrame'
import type { DataTableSpec } from './ChartFrame'
import { PAINT_ORDER, PaintDefs, fillOf } from './paint'
import type { Paint } from './paint'
import { useTweenArray, useWidth } from './tween'

export interface Part {
  label: string
  /** 0 or more. Shares are value / sum. */
  value: number
  /** Default by position: ink, hatch, grey, dots. */
  paint?: Paint
}

interface PartChartProps {
  parts: Part[]
  /** Text summary under the chart. Required. */
  summary: ReactNode
  ariaLabel?: string
  /** Legend and table values. Default 2-decimal number. */
  formatValue?: (v: number) => string
  /** `true` builds the table from the parts. */
  table?: DataTableSpec | boolean
  className?: string
}

function shares(parts: Part[]): { total: number; fr: number[] } {
  const vals = parts.map((p) => (Number.isFinite(p.value) ? Math.max(0, p.value) : 0))
  const total = vals.reduce((a, b) => a + b, 0)
  return { total, fr: vals.map((v) => (total > 0 ? v / total : 0)) }
}

function legendAndTable(parts: Part[], fr: number[], fmt: (v: number) => string, table: DataTableSpec | boolean | undefined) {
  const pct = (f: number) => `${(f * 100).toFixed(f > 0 && f < 0.01 ? 2 : 1)}%`
  const legend = parts.map((p, k) => ({
    label: p.label,
    paint: p.paint ?? PAINT_ORDER[k % PAINT_ORDER.length]!,
    value: `${fmt(p.value)} (${pct(fr[k] ?? 0)})`,
  }))
  const tbl: DataTableSpec | undefined =
    table === true
      ? { columns: ['Part', 'Value', 'Share'], rows: parts.map((p, k) => [p.label, fmt(p.value), pct(fr[k] ?? 0)]) }
      : table || undefined
  return { legend, tbl }
}

function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0
  const p = (r: number, a: number) => `${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`
  return `M${p(r1, a0)}A${r1},${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}Z`
}

export interface DonutProps extends PartChartProps {
  /** HTML in the hole, e.g. the main share. */
  center?: ReactNode
  /** Diameter in px. Default 180. */
  size?: number
}

/** Part of a whole as a ring. Segments tween when the parts change. */
export function Donut({ parts, summary, ariaLabel, formatValue = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 2 }), table, center, size = 180, className }: DonutProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const { total, fr } = shares(parts)
  const shown = useTweenArray(fr, { from: fr.map(() => 0) })
  const { legend, tbl } = legendAndTable(parts, fr, formatValue, table)
  const c = size / 2
  const r1 = c - 1
  const r0 = r1 - Math.max(14, size * 0.17)
  const gap = parts.filter((_, k) => (fr[k] ?? 0) > 0).length > 1 ? 0.035 : 0

  let a = 0
  const arcs = parts.map((p, k) => {
    const f = Math.max(0, shown[k] ?? 0)
    const a0 = a
    a += f * Math.PI * 2
    const span = a - a0
    if (span <= gap + 0.002) return null
    const d = span >= Math.PI * 2 - 1e-6
      ? `${sector(c, c, r0, r1, 0, Math.PI - 1e-4)}${sector(c, c, r0, r1, Math.PI, Math.PI * 2 - 1e-4)}`
      : sector(c, c, r0, r1, a0 + gap / 2, a - gap / 2)
    return <path key={p.label} d={d} style={{ fill: fillOf(p.paint ?? PAINT_ORDER[k % PAINT_ORDER.length]!, uid) }} />
  })

  return (
    <ChartFrame summary={summary} table={tbl} className={className}>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel ?? `Ring chart of ${parts.map((p) => p.label).join(', ')}`} className="block">
            <PaintDefs uid={uid} />
            {total <= 0 ? <circle cx={c} cy={c} r={(r0 + r1) / 2} style={{ fill: 'none', stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '3 4' }} /> : arcs}
          </svg>
          {center ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center tabular-nums">{center}</div>
          ) : null}
        </div>
        <Legend items={legend} className="flex-col flex-nowrap gap-y-2 self-stretch sm:self-center" />
      </div>
    </ChartFrame>
  )
}

export interface SplitProps extends PartChartProps {
  /** Bar height in px. Default 14. */
  height?: number
}

/** Part of a whole as one horizontal bar. Segment widths tween. */
export function Split({ parts, summary, ariaLabel, formatValue = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 2 }), table, height = 14, className }: SplitProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const { fr } = shares(parts)
  const shown = useTweenArray(fr, { from: fr.map(() => 0) })
  const { legend, tbl } = legendAndTable(parts, fr, formatValue, table)
  const [boxRef, W] = useWidth<HTMLDivElement>()
  const gapPx = 2
  let x = 0
  return (
    <ChartFrame summary={summary} table={tbl} className={className}>
      <div ref={boxRef} className="w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel ?? `Bar of ${parts.map((p) => p.label).join(', ')}`}
        className="block overflow-hidden rounded-[4px]"
      >
        <PaintDefs uid={uid} />
        {parts.map((p, k) => {
          const w = Math.round(Math.max(0, shown[k] ?? 0) * W * 100) / 100
          const x0 = x
          x += w
          const vis = Math.max(0, w - (k < parts.length - 1 && w > 0 ? gapPx : 0))
          if (vis <= 0.5) return null
          return <rect key={p.label} x={x0} y={0} width={vis} height={height} style={{ fill: fillOf(p.paint ?? PAINT_ORDER[k % PAINT_ORDER.length]!, uid) }} />
        })}
      </svg>
      </div>
      <Legend items={legend} />
    </ChartFrame>
  )
}
