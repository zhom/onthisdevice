import type { ReactNode } from 'react'

/* Hand-written SVG charts — no charting library is installed, and none is needed.
   Every chart is drawn in a fixed 720×300 user-space box and scaled with the
   viewBox; on narrow screens the wrapper scrolls horizontally so axis text never
   shrinks below a readable size. Colours come from the theme tokens so light and
   dark mode both work. */

const W = 720
const H = 300
const PAD = { top: 16, right: 18, bottom: 36, left: 70 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

const AXIS_STYLE = { stroke: 'var(--muted-foreground)' } as const
const GRID_STYLE = { stroke: 'var(--muted-foreground)' } as const

const TOO_LARGE = 'These numbers are too large to chart.'

function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const exp = Math.floor(Math.log10(value))
  const base = 10 ** exp
  const scaled = value / base
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10
  return step * base
}

function yTicks(max: number, count = 5): number[] {
  const out: number[] = []
  for (let i = 0; i <= count; i++) out.push((max / count) * i)
  return out
}

/** Compact axis money, e.g. "$1.2M". Falls back to plain numbers if unsupported. */
export function compactMoney(value: number, currency: string): string {
  try {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    })
  } catch {
    return String(Math.round(value))
  }
}

export function compactNumber(value: number): string {
  try {
    return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })
  } catch {
    return String(Math.round(value))
  }
}

function ChartFrame({
  ariaLabel,
  children,
  legend,
  caption,
}: {
  ariaLabel: string
  children: ReactNode
  legend?: LegendEntry[]
  caption?: ReactNode
}) {
  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[560px] text-muted-foreground"
          role="img"
          aria-label={ariaLabel}
          preserveAspectRatio="xMidYMid meet"
        >
          {children}
        </svg>
      </div>
      {legend && legend.length > 0 ? <Legend entries={legend} /> : null}
      {caption ? (
        <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  )
}

export interface LegendEntry {
  label: string
  token: string
  value?: string
  dashed?: boolean
}

export function Legend({ entries }: { entries: LegendEntry[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {entries.map((e) => (
        <li key={e.label} className="flex items-center gap-1.5">
          {e.dashed ? (
            <svg aria-hidden="true" viewBox="0 0 16 4" className="h-1 w-4">
              <line x1={0} x2={16} y1={2} y2={2} strokeWidth={2} strokeDasharray="4 3" style={{ stroke: `var(--${e.token})` }} />
            </svg>
          ) : (
            <span
              aria-hidden="true"
              className="inline-block size-2.5 rounded-[2px]"
              style={{ backgroundColor: `var(--${e.token})` }}
            />
          )}
          <span className="text-muted-foreground">{e.label}</span>
          {e.value ? <span className="font-medium tabular-nums text-foreground">{e.value}</span> : null}
        </li>
      ))}
    </ul>
  )
}

function Grid({
  max,
  format,
  xLabels,
}: {
  max: number
  format: (v: number) => string
  xLabels: { x: number; label: string }[]
}) {
  return (
    <g>
      {yTicks(max).map((t) => {
        const y = PAD.top + PLOT_H - (t / max) * PLOT_H
        return (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={PAD.left + PLOT_W}
              y1={y}
              y2={y}
              style={GRID_STYLE}
              strokeWidth={1}
              strokeDasharray={t === 0 ? undefined : '2 6'}
            />
            <text
              x={PAD.left - 8}
              y={y + 4}
              textAnchor="end"
              fontSize={13}
              fill="currentColor"
            >
              {format(t)}
            </text>
          </g>
        )
      })}
      <line
        x1={PAD.left}
        x2={PAD.left}
        y1={PAD.top}
        y2={PAD.top + PLOT_H}
        style={AXIS_STYLE}
        strokeWidth={1}
      />
      {xLabels.map((l) => (
        <text
          key={`${l.x}-${l.label}`}
          x={l.x}
          y={PAD.top + PLOT_H + 22}
          textAnchor="middle"
          fontSize={13}
          fill="currentColor"
        >
          {l.label}
        </text>
      ))}
    </g>
  )
}

/* ─────────────────────── stacked area (growth) ─────────────────────── */

export interface GrowthPoint {
  /** Year index, 0 = today. */
  x: number
  principal: number
  contributions: number
  interest: number
}

/**
 * Three stacked bands — starting balance, deposits and compound interest —
 * summing to the projected balance.
 */
export function StackedGrowthChart({
  points,
  currency,
  legend,
  caption,
  ariaLabel,
}: {
  points: GrowthPoint[]
  currency: string
  legend?: LegendEntry[]
  caption?: ReactNode
  ariaLabel: string
}) {
  if (points.length < 2) {
    return <ChartPlaceholder message="Enter a term of at least one year to see the growth chart." />
  }
  const maxTotal = points.reduce((m, p) => Math.max(m, p.principal + p.contributions + p.interest), 0)
  if (!Number.isFinite(maxTotal) || maxTotal > 1e100) return <ChartPlaceholder message={TOO_LARGE} />
  const max = niceMax(maxTotal || 1)
  const minX = points[0]!.x
  const maxX = points[points.length - 1]!.x
  const sx = (x: number) => PAD.left + ((x - minX) / Math.max(1, maxX - minX)) * PLOT_W
  const sy = (v: number) => PAD.top + PLOT_H - (v / max) * PLOT_H

  const band = (lower: (p: GrowthPoint) => number, upper: (p: GrowthPoint) => number) => {
    const top = points.map((p) => `${sx(p.x).toFixed(2)},${sy(upper(p)).toFixed(2)}`)
    const bottom = [...points].reverse().map((p) => `${sx(p.x).toFixed(2)},${sy(lower(p)).toFixed(2)}`)
    return [...top, ...bottom].join(' ')
  }

  const step = Math.max(1, Math.ceil((maxX - minX) / 8))
  const xLabels: { x: number; label: string }[] = []
  for (let x = minX; x <= maxX; x += step) xLabels.push({ x: sx(x), label: `${x}y` })
  if (xLabels[xLabels.length - 1]?.label !== `${maxX}y`) {
    xLabels.push({ x: sx(maxX), label: `${maxX}y` })
  }

  return (
    <ChartFrame ariaLabel={ariaLabel} legend={legend} caption={caption}>
      <Grid max={max} format={(v) => compactMoney(v, currency)} xLabels={xLabels} />
      <polygon
        points={band(() => 0, (p) => p.principal)}
        style={{ fill: 'var(--chart-3)', stroke: 'var(--background)' }}
        strokeWidth={1.5}
      />
      <polygon
        points={band((p) => p.principal, (p) => p.principal + p.contributions)}
        style={{ fill: 'var(--chart-1)', stroke: 'var(--background)' }}
        strokeWidth={1.5}
      />
      <polygon
        points={band(
          (p) => p.principal + p.contributions,
          (p) => p.principal + p.contributions + p.interest,
        )}
        style={{ fill: 'var(--chart-5)', stroke: 'var(--background)' }}
        strokeWidth={1.5}
      />
      <polyline
        points={points
          .map((p) => `${sx(p.x).toFixed(2)},${sy(p.principal + p.contributions + p.interest).toFixed(2)}`)
          .join(' ')}
        fill="none"
        style={{ stroke: 'var(--foreground)' }}
        strokeWidth={1.5}
      />
    </ChartFrame>
  )
}

/* ─────────────────────── multi-line chart ─────────────────────── */

export interface LineSeries {
  label: string
  token: string
  points: { x: number; y: number }[]
  dashed?: boolean
  /** Shade the area under the line. */
  fill?: boolean
}

export interface ChartMarker {
  x: number
  y: number
  label: string
}

export function LineChart({
  series,
  xLabel,
  yFormat,
  ariaLabel,
  legend,
  caption,
  markers = [],
  xTickCount = 6,
}: {
  series: LineSeries[]
  /** Formats a domain x value into an axis tick label. */
  xLabel: (x: number) => string
  yFormat: (v: number) => string
  ariaLabel: string
  legend?: LegendEntry[]
  caption?: ReactNode
  markers?: ChartMarker[]
  xTickCount?: number
}) {
  const all = series.flatMap((s) => s.points)
  if (all.length < 2) {
    return <ChartPlaceholder message="Not enough data to draw a chart yet." />
  }
  const rawMaxY = Math.max(...all.map((p) => p.y), ...markers.map((m) => m.y), 1)
  if (!Number.isFinite(rawMaxY) || rawMaxY > 1e100 || !all.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
    return <ChartPlaceholder message={TOO_LARGE} />
  }
  const minX = Math.min(...all.map((p) => p.x))
  const maxX = Math.max(...all.map((p) => p.x))
  const maxY = niceMax(rawMaxY)
  const spanX = Math.max(1e-9, maxX - minX)

  const sx = (x: number) => PAD.left + ((x - minX) / spanX) * PLOT_W
  const sy = (y: number) => PAD.top + PLOT_H - (y / maxY) * PLOT_H

  const xLabels: { x: number; label: string }[] = []
  for (let i = 0; i <= xTickCount; i++) {
    const value = minX + (spanX / xTickCount) * i
    xLabels.push({ x: sx(value), label: xLabel(value) })
  }

  return (
    <ChartFrame ariaLabel={ariaLabel} legend={legend} caption={caption}>
      <Grid max={maxY} format={yFormat} xLabels={xLabels} />
      {series.map((s) => {
        const pts = s.points.map((p) => `${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ')
        return (
          <g key={s.label}>
            {s.fill ? (
              <polygon
                points={`${sx(s.points[0]!.x).toFixed(2)},${(PAD.top + PLOT_H).toFixed(2)} ${pts} ${sx(
                  s.points[s.points.length - 1]!.x,
                ).toFixed(2)},${(PAD.top + PLOT_H).toFixed(2)}`}
                style={{ fill: 'var(--chart-5)' }}
              />
            ) : null}
            <polyline
              points={pts}
              fill="none"
              style={{ stroke: `var(--${s.token})` }}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? '6 5' : undefined}
            />
          </g>
        )
      })}
      {markers.map((m) => (
        <g key={m.label}>
          <line
            x1={sx(m.x)}
            x2={sx(m.x)}
            y1={PAD.top}
            y2={PAD.top + PLOT_H}
            style={{ stroke: 'var(--muted-foreground)' }}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <circle
            cx={sx(m.x)}
            cy={sy(m.y)}
            r={5}
            style={{ fill: 'var(--background)', stroke: 'var(--foreground)' }}
            strokeWidth={2}
          />
          <text
            x={Math.min(sx(m.x) + 9, PAD.left + PLOT_W - 4)}
            y={Math.max(sy(m.y) - 10, PAD.top + 12)}
            textAnchor={sx(m.x) > PAD.left + PLOT_W * 0.7 ? 'end' : 'start'}
            fontSize={13}
            fontWeight={600}
            fill="currentColor"
            className="text-foreground"
          >
            {m.label}
          </text>
        </g>
      ))}
    </ChartFrame>
  )
}

/* ─────────────────────── donut ─────────────────────── */

export interface DonutSlice {
  label: string
  value: number
  token: string
}

export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  ariaLabel,
}: {
  slices: DonutSlice[]
  centerLabel: string
  centerValue: string
  ariaLabel: string
}) {
  const shown = slices.filter((s) => s.value > 0)
  const total = shown.reduce((sum, s) => sum + s.value, 0)
  if (!Number.isFinite(total)) return <ChartPlaceholder message={TOO_LARGE} />
  const size = 220
  const cx = size / 2
  const cy = size / 2
  const r = 84
  const stroke = 30
  const circumference = 2 * Math.PI * r

  // A small gap between slices, so neighbouring greys never touch.
  const gap = shown.length > 1 ? 3 : 0
  let offset = 0
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-44 shrink-0 sm:size-52"
        role="img"
        aria-label={ariaLabel}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          style={{ stroke: 'var(--muted)' }}
          strokeWidth={stroke}
        />
        {total > 0
          ? shown.map((s) => {
              const fraction = s.value / total
              const dash = fraction * circumference
              const el = (
                <circle
                  key={s.label}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  style={{ stroke: `var(--${s.token})` }}
                  strokeWidth={stroke}
                  strokeDasharray={`${Math.max(0, dash - gap)} ${circumference - dash + gap}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              )
              offset += dash
              return el
            })
          : null}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontSize={13}
          fill="currentColor"
          className="text-muted-foreground"
        >
          {centerLabel}
        </text>
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          fontSize={20}
          fontWeight={700}
          fill="currentColor"
          className="text-foreground"
        >
          {centerValue}
        </text>
      </svg>
      <div className="min-w-0 flex-1">
        <ul className="space-y-1.5 text-sm">
          {shown.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: `var(--${s.token})` }}
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
              <span className="shrink-0 tabular-nums">
                {total > 0 ? `${((s.value / total) * 100).toFixed(1)}%` : '–'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function ChartPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl bg-muted px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
