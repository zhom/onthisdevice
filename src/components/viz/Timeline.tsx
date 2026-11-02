import { useId } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChartFrame } from './ChartFrame'
import { PaintDefs, fillOf } from './paint'
import type { Paint } from './paint'
import { useTween, useWidth } from './tween'

type At = number | Date

export interface TimelineSpan {
  from: At
  to: At
  label: string
  /** Default by position: grey, hatch, dots. */
  paint?: Paint
}

export interface TimelineEvent {
  at: At
  label: string
  detail?: string
}

export interface TimelineProps {
  /** Left end. Numbers (weeks, years) or dates. */
  start: At
  end: At
  spans?: TimelineSpan[]
  events: TimelineEvent[]
  /** The current point; the track fills up to it. */
  now?: At
  /** Label over the now marker, e.g. "Week 23". */
  nowLabel?: string
  /** Date or number label for the event list. */
  formatAt?: (v: number) => string
  /** Text summary. Required. */
  summary: ReactNode
  ariaLabel?: string
  /** Show the numbered event list under the track. Default true. */
  list?: boolean
  className?: string
}

const SPAN_PAINTS: Paint[] = ['grey', 'hatch', 'dots']
const num = (a: At) => (a instanceof Date ? a.getTime() : a)

/** A time track with spans, numbered events and an animated "now" marker. */
export function Timeline({
  start,
  end,
  spans = [],
  events,
  now,
  nowLabel,
  formatAt = (v) => String(v),
  summary,
  ariaLabel,
  list = true,
  className,
}: TimelineProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [boxRef, W] = useWidth<HTMLDivElement>()
  const s = num(start)
  const e = num(end)
  const span = e - s || 1
  const padX = 8
  const sx = (v: number) => Math.round((padX + ((Math.min(e, Math.max(s, v)) - s) / span) * (W - padX * 2)) * 100) / 100
  const nowN = now === undefined ? undefined : num(now)
  const nowShown = useTween(nowN ?? s, { from: s, duration: 420 })
  const sorted = events.map((ev, i) => ({ ...ev, n: num(ev.at), i })).sort((a, b) => a.n - b.n)
  const nextIdx = nowN === undefined ? -1 : sorted.findIndex((ev) => ev.n > nowN)

  const H = 74
  const trackY = 34
  const trackH = 10
  const nx = sx(nowShown)
  const labelAnchor = nx < 50 ? 'start' : nx > W - 50 ? 'end' : 'middle'
  let lastTickX = -Infinity

  return (
    <ChartFrame
      summary={summary}
      legend={spans.map((sp, k) => ({ label: sp.label, paint: sp.paint ?? SPAN_PAINTS[k % SPAN_PAINTS.length]! }))}
      className={className}
    >
      <div ref={boxRef} className="w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel ?? `Timeline with ${events.length} events`} className="block overflow-visible" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <PaintDefs uid={uid} />
          {spans.length === 0 ? (
            <rect x={padX} y={trackY} width={W - padX * 2} height={trackH} rx={2} style={{ fill: 'var(--muted-foreground)' }} />
          ) : (
            spans.map((sp, k) => {
              const x0 = sx(num(sp.from)) + (k > 0 ? 1 : 0)
              const x1 = sx(num(sp.to)) - (k < spans.length - 1 ? 1 : 0)
              if (x1 <= x0) return null
              return <rect key={sp.label} x={x0} y={trackY} width={x1 - x0} height={trackH} style={{ fill: fillOf(sp.paint ?? SPAN_PAINTS[k % SPAN_PAINTS.length]!, uid) }} />
            })
          )}
          {nowN !== undefined ? (
            <>
              <rect x={padX} y={trackY + trackH + 3} width={Math.max(0, nx - padX)} height={4} rx={1} style={{ fill: 'var(--foreground)' }} />
              <g transform={`translate(${nx.toFixed(2)} 0)`}>
                <path d={`M-6,${trackY - 11} L6,${trackY - 11} L0,${trackY - 3} Z`} style={{ fill: 'var(--foreground)' }} />
                {nowLabel ? (
                  <text x={0} y={trackY - 16} textAnchor={labelAnchor} style={{ fill: 'var(--foreground)', fontSize: 12, fontWeight: 650 }}>
                    {nowLabel}
                  </text>
                ) : null}
              </g>
            </>
          ) : null}
          {sorted.map((ev, j) => {
            const x = sx(ev.n)
            const showNum = x - lastTickX >= 14
            if (showNum) lastTickX = x
            return (
              <g key={`${ev.label}${ev.n}`}>
                <line x1={x} x2={x} y1={trackY + trackH + 9} y2={trackY + trackH + 15} style={{ stroke: 'var(--foreground)', strokeWidth: 1.5 }} />
                {showNum && list ? (
                  <text x={x} y={H - 2} textAnchor="middle" style={{ fill: 'var(--muted-foreground)', fontSize: 10 }}>
                    {j + 1}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
      {list && sorted.length > 0 ? (
        <ol className="grid gap-x-6 gap-y-1.5 text-[0.8125rem] sm:grid-cols-2">
          {sorted.map((ev, j) => {
            const past = nowN !== undefined && ev.n <= nowN
            return (
              <li key={`${ev.label}${ev.n}`} className={cn('flex gap-2', past ? 'text-muted-foreground' : 'text-foreground', j === nextIdx && 'font-[650]')}>
                <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">{j + 1}</span>
                <span className="min-w-0">
                  <span className="tabular-nums">{formatAt(ev.n)}</span> {ev.label}
                  {ev.detail ? <span className="block font-normal text-muted-foreground">{ev.detail}</span> : null}
                  {j === nextIdx ? <span className="sr-only"> (next)</span> : null}
                </span>
              </li>
            )
          })}
        </ol>
      ) : null}
    </ChartFrame>
  )
}
