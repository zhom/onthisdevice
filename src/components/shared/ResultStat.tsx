import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface ResultStatProps {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  /** Renders the hero number: larger and heavier. */
  emphasis?: boolean
  className?: string
}

/** A single labelled result figure. Values render with tabular numerals. */
export function ResultStat({ label, value, hint, emphasis = false, className }: ResultStatProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-card p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300',
        className,
      )}
    >
      <div className="text-[0.875rem] font-[560] text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-1 tabular-nums break-words text-foreground',
          emphasis ? 'text-[2rem] leading-tight font-[740] sm:text-[2.5rem]' : 'text-[1.375rem] leading-snug font-[680] sm:text-[1.5rem]',
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-[0.875rem] text-pretty text-muted-foreground">{hint}</div> : null}
    </div>
  )
}
