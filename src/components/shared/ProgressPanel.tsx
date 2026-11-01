import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { clamp, cn } from '@/lib/utils'

export interface ProgressPanelProps {
  label?: ReactNode
  /** 0-100. Omit for work whose length is unknown. */
  value?: number
  sublabel?: ReactNode
  className?: string
}

/** One pixel and its gap, in CSS pixels (see .px-row in motion.css). */
const PITCH = 11

/**
 * Live progress for in-browser work: a row of square pixels that fills to the
 * true percentage, one whole pixel at a time. When the length of the job is
 * unknown a short scan passes along the row instead of a made-up number.
 * Screen readers hear the label when it changes, not every percent.
 */
export function ProgressPanel({ label, value, sublabel, className }: ProgressPanelProps) {
  const determinate = typeof value === 'number' && Number.isFinite(value)
  const pct = determinate ? clamp(value, 0, 100) : 0
  const hostRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(40)

  useEffect(() => {
    const el = hostRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      setCols(Math.max(8, Math.floor((entry.contentRect.width + 3) / PITCH)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const lit = Math.round((pct / 100) * cols)
  const text = label ?? 'Working…'
  return (
    <div className={cn('w-full rounded-xl bg-muted px-4 py-4 sm:px-5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.9375rem] font-[600] text-foreground" role="status" aria-live="polite">
          {text}
        </span>
        {determinate && (
          <span className="num text-[0.875rem] font-[600] text-foreground" aria-hidden="true">
            {Math.round(pct)}%
          </span>
        )}
      </div>
      <div
        ref={hostRef}
        className="mt-3"
        role="progressbar"
        aria-label={typeof text === 'string' ? text : 'Progress'}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? 100 : undefined}
        aria-valuenow={determinate ? Math.round(pct) : undefined}
        aria-busy="true"
      >
        <div className="px-row" style={{ width: cols * PITCH, '--steps': cols + 6 } as CSSProperties}>
          {determinate ? (
            <div className="px-fill" style={{ transform: `scaleX(${lit / cols})` }} />
          ) : (
            <div className="px-scan" />
          )}
        </div>
      </div>
      {sublabel ? <p className="mt-2 text-[0.8125rem] text-pretty text-muted-foreground">{sublabel}</p> : null}
    </div>
  )
}
