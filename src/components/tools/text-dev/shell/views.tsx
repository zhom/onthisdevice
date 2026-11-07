import { CircleCheck, CircleX } from 'lucide-react'
import { CopyButton } from '@/components/shared/CopyButton'
import { BarList } from '@/components/viz'
import { StatTile } from '@/components/tools/text/common'
import { formatNumber } from '@/lib/utils'
import type { Bar, DataTable, Row, Stat, Verdict } from './spec'

export function VerdictView({ verdict }: { verdict: Verdict }) {
  const Icon = verdict.ok ? CircleCheck : CircleX
  return (
    <div role="status" className="reveal flex items-start gap-3 rounded-lg bg-background p-4">
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold text-pretty">{verdict.title}</p>
        {verdict.detail ? <p className="mt-0.5 text-sm text-muted-foreground text-pretty break-words">{verdict.detail}</p> : null}
      </div>
    </div>
  )
}

export function StatsView({ stats }: { stats: readonly Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((s, i) => (
        <StatTile
          key={s.label}
          label={s.label}
          value={typeof s.value === 'number' ? formatNumber(s.value, 2) : s.value}
          hint={s.hint}
          accent={i === 0}
        />
      ))}
    </div>
  )
}

export function RowsView({ rows }: { rows: readonly Row[] }) {
  return (
    <dl className="rounded-lg bg-background py-1">
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} className="grid gap-0.5 px-3 py-1.5 sm:grid-cols-[minmax(8rem,12rem)_1fr] sm:gap-3">
          <dt className="text-xs font-medium text-muted-foreground sm:pt-2.5">{r.label}</dt>
          <dd className="flex min-w-0 items-start gap-2">
            <span className="min-w-0 flex-1 pt-2 font-mono text-sm break-all">{r.value === '' ? '–' : r.value}</span>
            {r.value !== '' ? <CopyButton value={r.value} label={`Copy ${r.label}`} size="icon" variant="ghost" /> : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const MAX_TABLE_ROWS = 500

export function TableView({ table }: { table: DataTable }) {
  const shown = table.rows.slice(0, MAX_TABLE_ROWS)
  return (
    <div className="space-y-1">
      <div className="max-h-[32rem] overflow-auto rounded-lg bg-background">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr>
              {table.head.map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={typeof cell === 'number' ? 'num px-3 py-1.5 text-right' : 'px-3 py-1.5 break-words'}>
                    {typeof cell === 'number' ? formatNumber(cell, 2) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.rows.length > MAX_TABLE_ROWS ? (
        <p className="text-xs text-muted-foreground">
          The first {formatNumber(MAX_TABLE_ROWS, 0)} of {formatNumber(table.rows.length, 0)} rows. The download has all of them.
        </p>
      ) : null}
    </div>
  )
}

export function BarsView({ items, summary }: { items: readonly Bar[]; summary: string }) {
  return <BarList items={items.map((b) => ({ label: b.label, value: b.value }))} summary={summary} columns={['Item', 'Count']} table />
}
