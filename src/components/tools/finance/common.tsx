import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula as FormulaBlock } from '@/components/shared/Formula'
import { cn, downloadBlob } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/components/tools/finance/format'

import { CURRENCIES, currencyDecimals, currencySymbol, toCsv, toNum } from './money'

/* ───────────────────────────── currency ───────────────────────────── */

export function CurrencySelect({
  value,
  onChange,
  id = 'currency',
  className,
}: {
  value: string
  onChange: (v: string) => void
  id?: string
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>Currency</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Currency" />
        </SelectTrigger>
        <SelectContent>
          {CURRENCIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.code} ({c.name})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Formatter bound to the selected currency, memo-friendly. */
export function useMoney(currency: string) {
  return useMemo(() => {
    const dp = currencyDecimals(currency)
    return {
      symbol: currencySymbol(currency),
      /** Full precision, e.g. "$1,432.19". */
      exact: (n: number) => formatCurrency(n, currency, dp),
      /** Whole units, e.g. "$1,432" — for big headline totals and axes. */
      round: (n: number) => formatCurrency(Math.round(n), currency, 0),
    }
  }, [currency])
}

/* ───────────────────────────── inputs ───────────────────────────── */

export interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  prefix?: string
  suffix?: string
  hint?: ReactNode
  placeholder?: string
  slider?: { min: number; max: number; step: number }
  disabled?: boolean
  invalid?: string
  autoFocus?: boolean
}

/**
 * A numeric money/rate field. The value is held as a raw string so half-typed
 * input ("1,2" or "3.") never snaps back, and parsing happens at calculation
 * time via `toNum`.
 */
export function Field({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  placeholder,
  slider,
  disabled,
  invalid,
  autoFocus,
}: FieldProps) {
  const padLeft = prefix ? (prefix.length > 2 ? 'pl-12' : prefix.length > 1 ? 'pl-10' : 'pl-7') : ''
  const padRight = suffix ? (suffix.length > 3 ? 'pr-16' : suffix.length > 1 ? 'pr-12' : 'pr-7') : ''
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="relative">
        {prefix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          >
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn('tabular-nums', padLeft, padRight)}
        />
        {suffix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          >
            {suffix}
          </span>
        ) : null}
      </div>
      {slider ? (
        // The text input above is the labelled control; the slider is a
        // convenience duplicate. Radix names its thumb from the thumb's own
        // props, which shadcn does not expose, so the group label is what a
        // screen reader announces when focus lands on the handle.
        <div role="group" aria-label={`${label} slider`}>
          <Slider
            value={[Math.min(slider.max, Math.max(slider.min, toNum(value)))]}
            min={slider.min}
            max={slider.max}
            step={slider.step}
            disabled={disabled}
            onValueChange={(v) => onChange(String(v[0] ?? slider.min))}
            className="pt-1"
          />
        </div>
      ) : null}
      {invalid ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {invalid}
        </p>
      ) : null}
    </div>
  )
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  hint?: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** A titled group of inputs inside a tool panel. */
export function FieldGroup({
  title,
  children,
  columns = 2,
}: {
  title?: string
  children: ReactNode
  columns?: 1 | 2 | 3
}) {
  return (
    <section className="space-y-3">
      {title ? (
        <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      ) : null}
      <div
        className={cn(
          'grid gap-4',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-1 sm:grid-cols-2',
          columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {children}
      </div>
    </section>
  )
}

/** A compact two-or-three way toggle, e.g. amount vs percentage. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-lg bg-muted p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-[7px] px-2.5 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ───────────────────────────── formula block ───────────────────────────── */

export interface FormulaItem {
  /** What this line computes, e.g. "Monthly principal & interest". */
  label: string
  /** The symbolic form, e.g. "M = P · i / (1 − (1 + i)^−n)". */
  general?: string
  /** The same expression with the user's numbers substituted. */
  steps?: string[]
  /** The computed answer. */
  result: string
}

/**
 * The worked calculation. Every calculator shows one of these so the number is
 * auditable rather than magic.
 */
export function Formula({
  items,
  title = 'Formula and working',
  note,
}: {
  items: FormulaItem[]
  title?: string
  note?: ReactNode
}) {
  const plain = items
    .map((it) =>
      [it.label, it.general, ...(it.steps ?? []), `= ${it.result}`].filter(Boolean).join('\n  '),
    )
    .join('\n\n')

  return (
    <section className="rounded-xl bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <CopyButton value={plain} label="Copy working" />
      </header>
      <div className="space-y-4 px-4 py-4">
        {items.map((it) => (
          <div key={it.label} className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {it.label}
            </p>
            <FormulaBlock>
              {[...(it.general ? [it.general] : []), ...(it.steps ?? []), `= ${it.result}`].join('\n')}
            </FormulaBlock>
          </div>
        ))}
      </div>
      {note ? (
        <p className="px-4 pb-3 text-xs text-muted-foreground">{note}</p>
      ) : null}
    </section>
  )
}

/* ───────────────────────────── breakdown bar ───────────────────────────── */

export interface BreakdownItem {
  label: string
  value: number
  /** chart-1 … chart-5 */
  token: string
  hint?: string
}

/**
 * A stacked share bar plus a legend that repeats every value in text, so the
 * information is never carried by colour alone.
 */
export function Breakdown({
  items,
  currency,
  caption,
}: {
  items: BreakdownItem[]
  currency: string
  caption?: string
}) {
  const money = useMoney(currency)
  const shown = items.filter((i) => Number.isFinite(i.value) && i.value > 0)
  const total = shown.reduce((sum, i) => sum + i.value, 0)

  if (total <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Enter an amount above to see the breakdown.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={shown
          .map((i) => `${i.label}: ${money.exact(i.value)} (${((i.value / total) * 100).toFixed(1)}%)`)
          .join('; ')}
      >
        {shown.map((i) => (
          <div
            key={i.label}
            style={{ width: `${(i.value / total) * 100}%`, backgroundColor: `var(--${i.token})` }}
          />
        ))}
      </div>
      <ul className="space-y-1.5">
        {shown.map((i) => (
          <li key={i.label} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: `var(--${i.token})` }}
            />
            <span className="min-w-0 flex-1 truncate">
              {i.label}
              {i.hint ? <span className="text-muted-foreground"> · {i.hint}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {((i.value / total) * 100).toFixed(1)}%
            </span>
            <span className="w-24 shrink-0 text-right font-medium tabular-nums sm:w-28">
              {money.exact(i.value)}
            </span>
          </li>
        ))}
      </ul>
      {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  )
}

/* ───────────────────────────── tables ───────────────────────────── */

export interface Column<R> {
  key: string
  header: string
  align?: 'left' | 'right'
  render: (row: R, index: number) => ReactNode
  /** Hide on very narrow screens. */
  hideOnMobile?: boolean
}

export function DataTable<R>({
  columns,
  rows,
  pageSize = 12,
  ariaLabel,
  emptyMessage = 'Nothing to show yet.',
  rowClassName,
}: {
  columns: Column<R>[]
  rows: R[]
  pageSize?: number
  ariaLabel: string
  emptyMessage?: string
  rowClassName?: (row: R, index: number) => string | undefined
}) {
  const [page, setPage] = useState(0)
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1

  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1))
  }, [pageCount])

  const slice = pageSize > 0 ? rows.slice(page * pageSize, page * pageSize + pageSize) : rows
  const offset = pageSize > 0 ? page * pageSize : 0

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl bg-background">
        <table className="w-full min-w-[560px] border-collapse text-sm" aria-label={ariaLabel}>
          <thead>
            <tr className="border-b border-border bg-muted">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-3 py-2 font-medium text-muted-foreground',
                    c.align === 'right' ? 'text-right' : 'text-left',
                    c.hideOnMobile && 'hidden sm:table-cell',
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr
                key={offset + i}
                className={cn(
                  'border-b border-border last:border-0 even:bg-muted',
                  rowClassName?.(row, offset + i),
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'whitespace-nowrap px-3 py-1.5 tabular-nums',
                      c.align === 'right' ? 'text-right' : 'text-left',
                      c.hideOnMobile && 'hidden sm:table-cell',
                    )}
                  >
                    {c.render(row, offset + i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            Showing {offset + 1}–{offset + slice.length} of {formatNumber(rows.length, 0)} rows
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only sm:ml-1">Prev</span>
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              Page {page + 1} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              aria-label="Next page"
            >
              <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function CsvButton({
  headers,
  rows,
  filename,
  label = 'Download CSV',
  disabled,
}: {
  headers: string[]
  rows: (string | number)[][]
  filename: string
  label?: string
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || rows.length === 0}
      onClick={() => {
        const csv = toCsv(headers, rows)
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename)
      }}
    >
      <Download className="mr-1.5 size-4" aria-hidden="true" />
      {label}
    </Button>
  )
}

/* ───────────────────────────── misc ───────────────────────────── */

export function Assumptions({ items, title = 'Assumptions' }: { items: ReactNode[]; title?: string }) {
  return (
    <section className="rounded-xl bg-muted px-4 py-3">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** A compact label/value row for secondary numbers under the hero stats. */
export function MiniStat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'positive' | 'negative'
}) {
  return (
    <div className="rounded-lg bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-base font-semibold tabular-nums break-words',
          tone === 'positive' && 'text-success',
          tone === 'negative' && 'text-destructive',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
