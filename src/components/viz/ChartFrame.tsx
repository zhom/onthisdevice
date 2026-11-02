import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Swatch } from './paint'
import type { Paint, Stroke } from './paint'

export interface LegendItem {
  label: string
  paint?: Paint
  stroke?: Stroke
  /** Optional value printed after the label. */
  value?: string
}

export interface DataTableSpec {
  columns: string[]
  rows: (string | number)[][]
  /** Accessible name of the table. */
  caption?: string
}

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  if (items.length === 0) return null
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem]', className)}>
      {items.map((it) => (
        <li key={it.label} className="flex min-w-0 items-center gap-1.5">
          <Swatch paint={it.paint} stroke={it.stroke} />
          <span className="text-muted-foreground">{it.label}</span>
          {it.value ? <span className="font-[620] tabular-nums">{it.value}</span> : null}
        </li>
      ))}
    </ul>
  )
}

/** The data behind a chart, as a plain table, behind a disclosure. */
export function ChartTable({ table, label = 'Show the data table' }: { table: DataTableSpec; label?: string }) {
  return (
    <details className="group text-sm">
      <summary className="cursor-pointer select-none text-[0.8125rem] font-[560] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        {label}
      </summary>
      <div className="mt-2 max-h-80 overflow-auto rounded-lg bg-background">
        <table className="w-full border-collapse text-[0.8125rem] tabular-nums">
          {table.caption ? <caption className="sr-only">{table.caption}</caption> : null}
          <thead className="sticky top-0 bg-background">
            <tr>
              {table.columns.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={cn('whitespace-nowrap px-3 py-1.5 font-[560] text-muted-foreground', i === 0 ? 'text-left' : 'text-right')}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j} className={cn('whitespace-nowrap px-3 py-1', j === 0 ? 'text-left' : 'text-right')}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/**
 * Wraps every chart: legend, optional readout, the drawing, a text summary
 * (figcaption) and an optional data table.
 */
export function ChartFrame({
  legend,
  readout,
  summary,
  table,
  className,
  children,
}: {
  legend?: LegendItem[]
  readout?: ReactNode
  summary: ReactNode
  table?: DataTableSpec
  className?: string
  children: ReactNode
}) {
  return (
    <figure className={cn('w-full min-w-0 space-y-3', className)}>
      {legend && legend.length > 0 ? <Legend items={legend} /> : null}
      {readout}
      {children}
      <figcaption className="text-[0.8125rem] leading-relaxed text-pretty text-muted-foreground">{summary}</figcaption>
      {table ? <ChartTable table={table} /> : null}
    </figure>
  )
}
