import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChartFrame } from './ChartFrame'
import { useTween, useTweenArray, useWidth } from './tween'

export interface GaugeBand {
  /** Upper edge of the band. The first band starts at `min`. */
  to: number
  label: string
}

export interface GaugeProps {
  value: number
  /** Left end of the scale. */
  min: number
  /** Right end of the scale. */
  max: number
  /** Ascending bands. The last `to` should be `max`. */
  bands: GaugeBand[]
  /** Text summary under the gauge. Required. */
  summary: ReactNode
  ariaLabel?: string
  /** Boundary labels. Default up to 1 decimal. */
  formatValue?: (v: number) => string
  /** HTML under the needle hub (arc) or above the scale (bar), e.g. the value and band. */
  center?: ReactNode
  /** `arc`: half dial with a needle. `bar`: straight scale with a sliding marker. */
  variant?: 'arc' | 'bar'
  className?: string
}

function bandIndex(bands: GaugeBand[], v: number): number {
  const i = bands.findIndex((b) => v < b.to)
  return i < 0 ? bands.length - 1 : i
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => `${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`
  return `M${p(a0)}A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`
}

function BandNames({ bands, active }: { bands: GaugeBand[]; active: number }) {
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[0.8125rem]">
      {bands.map((b, i) => (
        <li key={b.label} className={cn('flex items-center gap-1.5', i === active ? 'font-[650] text-foreground' : 'text-muted-foreground')}>
          <span aria-hidden="true" className={cn('inline-block h-1 w-3 rounded-full', i === active ? 'h-1.5 bg-foreground' : 'bg-muted-foreground')} />
          {b.label}
          {i === active ? <span className="sr-only"> (your result)</span> : null}
        </li>
      ))}
    </ul>
  )
}

/** A scale with labelled bands and an animated needle or marker. */
export function Gauge({
  value,
  min,
  max,
  bands,
  summary,
  ariaLabel,
  formatValue = (v) => String(Math.round(v * 10) / 10),
  center,
  variant = 'arc',
  className,
}: GaugeProps) {
  const [boxRef, W] = useWidth<HTMLDivElement>()
  const safe = Number.isFinite(value) ? value : min
  const clamped = Math.min(max, Math.max(min, safe))
  const v = useTween(clamped, { from: min, duration: 420 })
  const active = bandIndex(bands, safe)
  const weights = useTweenArray(bands.map((_, i) => (i === active ? 1 : 0)))
  const span = max - min || 1
  const edges = bands.slice(0, -1).map((b) => b.to)
  const label = ariaLabel ?? `Scale from ${formatValue(min)} to ${formatValue(max)}. Value ${formatValue(safe)}, ${bands[active]?.label ?? ''}.`

  if (variant === 'bar') {
    const H = 58
    const padX = 14
    const sx = (x: number) => Math.round((padX + ((x - min) / span) * (W - padX * 2)) * 100) / 100
    const trackY = 26
    const gap = 3
    let from = min
    return (
      <ChartFrame summary={summary} className={className}>
        {center ? <div className="text-center tabular-nums">{center}</div> : null}
        <div ref={boxRef} className="w-full">
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label} className="block overflow-visible" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {bands.map((b, i) => {
              const x0 = sx(Math.max(min, from)) + (i > 0 ? gap / 2 : 0)
              const x1 = sx(Math.min(max, b.to)) - (i < bands.length - 1 ? gap / 2 : 0)
              from = b.to
              const w = weights[i] ?? 0
              const h = 4 + 8 * w
              if (x1 <= x0) return null
              return <rect key={b.label} x={x0} y={trackY - h / 2} width={x1 - x0} height={h} rx={Math.min(h / 2, 3)} style={{ fill: w > 0.5 ? 'var(--foreground)' : 'var(--muted-foreground)' }} />
            })}
            <g transform={`translate(${sx(v).toFixed(2)} 0)`}>
              <path d="M-6,4 L6,4 L0,13 Z" style={{ fill: 'var(--foreground)' }} />
            </g>
            {edges.map((e) => (
              <text key={e} x={sx(e)} y={H - 4} textAnchor="middle" style={{ fill: 'var(--muted-foreground)', fontSize: 11 }}>
                {formatValue(e)}
              </text>
            ))}
          </svg>
        </div>
        <BandNames bands={bands} active={active} />
      </ChartFrame>
    )
  }

  const size = Math.min(W, 380)
  const cx = W / 2
  const R = size / 2 - 26
  const cy = R + 26
  const H = cy + 10
  const ang = (x: number) => -Math.PI / 2 + ((Math.min(max, Math.max(min, x)) - min) / span) * Math.PI
  const gapA = 0.025
  let from = min
  const needle = ang(v)
  const deg = (needle * 180) / Math.PI

  return (
    <ChartFrame summary={summary} className={className}>
      <div ref={boxRef} className="w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label} className="block overflow-visible" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {bands.map((b, i) => {
            const a0 = ang(Math.max(min, from)) + (i > 0 ? gapA / 2 : 0)
            const a1 = ang(Math.min(max, b.to)) - (i < bands.length - 1 ? gapA / 2 : 0)
            from = b.to
            if (a1 <= a0) return null
            const w = weights[i] ?? 0
            return (
              <path
                key={b.label}
                d={arcPath(cx, cy, R, a0, a1)}
                style={{ fill: 'none', stroke: w > 0.5 ? 'var(--foreground)' : 'var(--muted-foreground)', strokeWidth: 5 + 9 * w }}
              />
            )
          })}
          {edges.map((e) => {
            const a = ang(e)
            const r = R + 16
            // Rounded: Math.sin/cos may differ in the last digits between the server and the browser.
            const tx = Math.round((cx + r * Math.sin(a)) * 100) / 100
            const ty = Math.round((cy - r * Math.cos(a)) * 100) / 100
            return (
              <text key={e} x={tx} y={ty} dy="0.35em" textAnchor={Math.abs(a) < 0.3 ? 'middle' : a < 0 ? 'end' : 'start'} style={{ fill: 'var(--muted-foreground)', fontSize: 11 }}>
                {formatValue(e)}
              </text>
            )
          })}
          <g transform={`rotate(${deg.toFixed(2)} ${cx} ${cy})`}>
            <line x1={cx} y1={cy} x2={cx} y2={cy - R + 16} style={{ stroke: 'var(--foreground)', strokeWidth: 2.5, strokeLinecap: 'round' }} />
          </g>
          <circle cx={cx} cy={cy} r={6} style={{ fill: 'var(--foreground)' }} />
        </svg>
      </div>
      {center ? <div className="-mt-1 text-center tabular-nums">{center}</div> : null}
      <BandNames bands={bands} active={active} />
    </ChartFrame>
  )
}
