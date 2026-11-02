import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChartFrame } from './ChartFrame'
import type { DataTableSpec } from './ChartFrame'
import { paintBackground } from './paint'
import type { Paint } from './paint'
import { useTweenArray } from './tween'

export interface BarItem {
  label: string
  value: number
  /** Grey text after the label. */
  note?: string
  /** Draw this row in ink and bold; the rest in grey. */
  highlight?: boolean
  /** Overrides the highlight paint. */
  paint?: Paint
}

export interface BarListProps {
  items: BarItem[]
  /** Text summary. Required. */
  summary: ReactNode
  formatValue?: (v: number) => string
  /** Scale end. Default the largest value. */
  max?: number
  /** `true` builds the table from the items. */
  table?: DataTableSpec | boolean
  /** Column names for the built table. */
  columns?: [string, string]
  className?: string
}

/** Labelled horizontal bars, for comparing a handful of results. Widths tween. */
export function BarList({
  items,
  summary,
  formatValue = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 2 }),
  max,
  table,
  columns = ['Item', 'Value'],
  className,
}: BarListProps) {
  const top = max ?? Math.max(0, ...items.map((i) => (Number.isFinite(i.value) ? i.value : 0)))
  const fr = items.map((i) => (top > 0 && Number.isFinite(i.value) ? Math.max(0, Math.min(1, i.value / top)) : 0))
  const shown = useTweenArray(fr, { from: fr.map(() => 0) })
  const anyHighlight = items.some((i) => i.highlight)
  const tbl: DataTableSpec | undefined =
    table === true ? { columns: [...columns], rows: items.map((i) => [i.label, formatValue(i.value)]) } : table || undefined

  return (
    <ChartFrame summary={summary} table={tbl} className={className}>
      <ul className="space-y-2.5">
        {items.map((it, k) => {
          const strong = it.highlight || !anyHighlight
          const paint: Paint = it.paint ?? (strong ? 'ink' : 'grey')
          return (
            <li key={it.label} className="space-y-1">
              <div className={cn('flex items-baseline justify-between gap-3 text-[0.8125rem]', strong ? 'text-foreground' : 'text-muted-foreground')}>
                <span className={cn('min-w-0', it.highlight && 'font-[650]')}>
                  {it.label}
                  {it.note ? <span className="font-normal text-muted-foreground"> {it.note}</span> : null}
                </span>
                <span className={cn('shrink-0 tabular-nums', it.highlight ? 'font-[650]' : 'font-[560]')}>{formatValue(it.value)}</span>
              </div>
              <div aria-hidden="true" className="h-2 w-full">
                <div
                  className="h-full rounded-[3px]"
                  style={{ width: `${Math.max(0, (shown[k] ?? 0) * 100).toFixed(2)}%`, ...paintBackground(paint) }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </ChartFrame>
  )
}
