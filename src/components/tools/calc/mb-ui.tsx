/**
 * Layout pieces shared by the money and body calculators in this folder.
 * Inputs reuse the finance and health field components; charts come from
 * @/components/viz.
 */
import type { ReactNode } from 'react'
import { Info, TriangleAlert } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { AnimatedNumber } from '@/components/viz'
import { CurrencySelect, useMoney } from '@/components/tools/finance/common'
import { useLocalStorage } from '@/components/tools/finance/hooks'
import { LOCALE } from '@/components/tools/finance/format'
import { cn } from '@/lib/utils'

export { Field, SelectField, FieldGroup, Formula, Assumptions } from '@/components/tools/finance/common'
export type { FormulaItem } from '@/components/tools/finance/common'
export { toNum, toPositive } from '@/components/tools/finance/money'

/* ── numbers ───────────────────────────────────────────────────── */

/** Fixed-locale number with exactly `dp` decimals (en-US, so server and client agree). */
export function num(n: number, dp = 0): string {
  if (!Number.isFinite(n)) return '–'
  return n.toLocaleString(LOCALE, { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

/** Number with up to `dp` decimals. */
export function numUpTo(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return '–'
  return n.toLocaleString(LOCALE, { maximumFractionDigits: dp })
}

export function pct(n: number, dp = 2): string {
  return Number.isFinite(n) ? `${num(n, dp)}%` : '–'
}

/** Currency state shared by every finance calculator, with its formatters. */
export function useCurrency() {
  const [currency, setCurrency] = useLocalStorage('otd:finance:currency', 'USD')
  const money = useMoney(currency)
  const select = (id: string) => <CurrencySelect value={currency} onChange={setCurrency} id={id} />
  return { currency, money, select }
}

/** "4 years 3 months" from a month count. */
export function yearsMonths(months: number): string {
  if (!Number.isFinite(months)) return '–'
  const m = Math.max(0, Math.round(months))
  const y = Math.floor(m / 12)
  const r = m % 12
  const parts: string[] = []
  if (y) parts.push(`${y} ${y === 1 ? 'year' : 'years'}`)
  if (r || !y) parts.push(`${r} ${r === 1 ? 'month' : 'months'}`)
  return parts.join(' ')
}

/** h:mm:ss or m:ss from seconds. */
export function clock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '–'
  const s = Math.round(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const two = (v: number) => String(v).padStart(2, '0')
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`
}

/* ── layout ────────────────────────────────────────────────────── */

/**
 * Inputs on the left (a panel), results on the right; stacked on phones.
 * `below` holds the working, tables and limits.
 */
export function CalcGrid({
  inputs,
  results,
  below,
  inputsTitle = 'Your numbers',
}: {
  inputs: ReactNode
  results: ReactNode
  below?: ReactNode
  inputsTitle?: string
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <ToolPanel title={inputsTitle}>
          <div className="space-y-4">{inputs}</div>
        </ToolPanel>
        <div className="min-w-0 space-y-6" data-calc="results">{results}</div>
      </div>
      <div data-calc="below">{below}</div>
    </div>
  )
}

/** The main result: a label, rolling digits and one line of context. A live region. */
export function Headline({
  label,
  value,
  format,
  hint,
  className,
}: {
  label: ReactNode
  value: number
  format: (n: number) => string
  hint?: ReactNode
  className?: string
}) {
  return (
    <section role="status" aria-live="polite" aria-atomic="true" className={cn('space-y-1.5', className)}>
      <p className="text-sm font-[560] text-muted-foreground">{label}</p>
      <p className="text-[2.25rem] font-[740] leading-none sm:text-[2.75rem]">
        <AnimatedNumber value={value} format={format} />
      </p>
      {hint ? <p className="text-sm text-pretty text-muted-foreground">{hint}</p> : null}
    </section>
  )
}

export interface StatItem {
  label: string
  value: ReactNode
  hint?: ReactNode
}

/** Secondary results as a label/value grid. */
export function Stats({ items, cols = 3 }: { items: StatItem[]; cols?: 2 | 3 }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-3', cols === 3 && 'sm:grid-cols-3')}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[0.8125rem] text-muted-foreground">{it.label}</dt>
          <dd className="mt-0.5 text-[1.0625rem] font-[650] break-words tabular-nums">{it.value}</dd>
          {it.hint ? <dd className="text-xs text-muted-foreground">{it.hint}</dd> : null}
        </div>
      ))}
    </dl>
  )
}

/** The result panel: headline, stats and the visual, on the card fill. */
export function ResultPanel({ title = 'Result', children }: { title?: string; children: ReactNode }) {
  return (
    <ToolPanel title={title}>
      <div className="space-y-6">{children}</div>
    </ToolPanel>
  )
}

/** A short note with an icon. `warn` for safety notes. */
export function Note({ children, warn = false, className }: { children: ReactNode; warn?: boolean; className?: string }) {
  const Icon = warn ? TriangleAlert : Info
  return (
    <p role="note" className={cn('flex items-start gap-2 text-[0.8125rem] leading-relaxed text-pretty', warn ? 'text-foreground' : 'text-muted-foreground', className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** Two to four option buttons in a row (aria-pressed). */
export function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
  id,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  id?: string
}) {
  return (
    <div className="space-y-1.5">
      <span id={id ? `${id}-label` : undefined} className="text-sm font-medium leading-none">
        {label}
      </span>
      <div role="group" aria-label={label} className="flex w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'flex-1 rounded-md px-2.5 py-1.5 text-center text-sm font-medium whitespace-nowrap transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
