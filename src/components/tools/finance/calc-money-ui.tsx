/**
 * Round-2 batch `calc-money` — shared UI kit.
 *
 * Every control in here is used by more than one calculator in the batch. It is
 * deliberately local to the batch (see `calc-money-core.ts` for why) and must
 * not be imported by other batches.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula as FormulaBlock } from '@/components/shared/Formula'
import { cn, downloadBlob } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/components/tools/finance/format'

import {
  CM_CURRENCIES,
  csvBlob,
  currencyDecimals,
  currencySymbol,
  tablePdfBlob,
  toCsv,
  toNum,
  xlsxBlob,
} from './calc-money-core'
import type { CmExportSpec, CmTable } from './calc-money-core'

/* ────────────────────────────── hooks ────────────────────────────── */

/**
 * Local-storage backed state that is safe for a statically pre-rendered island:
 * the first paint always uses `initial`, and the stored value arrives on mount.
 * Writes are best-effort — a blocked or full store must never break a
 * calculator.
 */
export function useCmStorage<T>(
  key: string,
  initial: T,
  enabled = true,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [value, setValue] = useState<T>(initial)
  const hydrated = useRef(false)

  useEffect(() => {
    if (!enabled) return
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) setValue(JSON.parse(raw) as T)
    } catch {
      /* corrupt or unreadable entry — keep the default */
    }
    hydrated.current = true
  }, [key, enabled])

  useEffect(() => {
    if (!enabled || !hydrated.current) return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* quota or private mode — the calculator still works */
    }
  }, [key, value, enabled])

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* nothing to do */
    }
  }, [key])

  return [value, setValue, clear]
}

/**
 * "Today", safe for a pre-rendered island: the build-time render uses a fixed
 * reference date so the HTML and the first client render match, then the real
 * date lands on mount.
 */
export function useCmToday(): Date {
  const [today, setToday] = useState<Date>(() => new Date(2026, 0, 1))
  useEffect(() => {
    setToday(new Date())
  }, [])
  return today
}

/** Formatter bound to a currency code. */
export function useMoney(currency: string) {
  return useMemo(() => {
    const dp = currencyDecimals(currency)
    return {
      code: currency,
      symbol: currencySymbol(currency),
      /** Full precision, e.g. "$1,432.19". */
      exact: (n: number) => formatCurrency(n, currency, dp),
      /** Whole units, e.g. "$1,432" — headline totals and chart axes. */
      round: (n: number) => formatCurrency(Math.round(n), currency, 0),
      /** "1.4M" / "820k" for tight axis labels. */
      compact: (n: number) => {
        const abs = Math.abs(n)
        if (abs >= 1_000_000) return `${currencySymbol(currency)}${(n / 1_000_000).toFixed(1)}M`
        if (abs >= 1_000) return `${currencySymbol(currency)}${Math.round(n / 1_000)}k`
        return formatCurrency(n, currency, 0)
      },
    }
  }, [currency])
}

export type Money = ReturnType<typeof useMoney>

/* ────────────────────────────── inputs ────────────────────────────── */

export function CmCurrencySelect({
  value,
  onChange,
  id = 'cm-currency',
  className,
}: {
  value: string
  onChange: (v: string) => void
  id?: string
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-sm">
        Currency
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Currency" />
        </SelectTrigger>
        <SelectContent>
          {CM_CURRENCIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.code} ({c.name})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export interface CmFieldProps {
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
  type?: 'text' | 'date' | 'month' | 'time'
  className?: string
}

/**
 * A numeric field held as a raw string, so half-typed input ("1,2" or "3.")
 * never snaps back. Parsing happens at calculation time.
 */
export function CmField({
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
  type = 'text',
  className,
}: CmFieldProps) {
  const padLeft = prefix ? (prefix.length > 2 ? 'pl-12' : prefix.length > 1 ? 'pl-10' : 'pl-7') : ''
  const padRight = suffix ? (suffix.length > 3 ? 'pr-16' : suffix.length > 1 ? 'pr-12' : 'pr-7') : ''
  const numeric = type === 'text'
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
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
          type={type}
          inputMode={numeric ? 'decimal' : undefined}
          autoComplete="off"
          spellCheck={false}
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
        // The text input is the labelled control; the slider duplicates it for
        // coarse adjustment. Radix names the thumb from the group label.
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

export function CmSelectField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  hint?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
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

export function CmFieldGrid({
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
        <h3 className="text-xs font-semibold text-muted-foreground">
          {title}
        </h3>
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

export function CmSegmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex flex-wrap rounded-lg bg-muted p-0.5', className)}
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

/* ────────────────────────────── output ────────────────────────────── */

export function CmStat({
  label,
  value,
  hint,
  tone = 'default',
  className,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'positive' | 'negative' | 'warning'
  className?: string
}) {
  return (
    <div className={cn('rounded-lg bg-card px-3 py-2.5', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-base font-semibold tabular-nums break-words',
          tone === 'positive' && 'text-success',
          tone === 'negative' && 'text-destructive',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{hint}</p> : null}
    </div>
  )
}

export interface CmWorkingItem {
  /** What this line computes. */
  label: string
  /** The symbolic form, e.g. "M = P · i / (1 − (1 + i)^−n)". */
  general?: string
  /** The same expression with the user's numbers substituted. */
  steps?: string[]
  result: string
}

/** The worked calculation — every calculator in this batch renders one. */
export function CmWorking({
  items,
  title = 'Formula and working',
  note,
}: {
  items: CmWorkingItem[]
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
        <p className="px-4 pb-3 text-xs text-muted-foreground text-pretty">
          {note}
        </p>
      ) : null}
    </section>
  )
}

export function CmAssumptions({
  items,
  title = 'Assumptions',
}: {
  items: ReactNode[]
  title?: string
}) {
  return (
    <section className="rounded-xl bg-muted px-4 py-3">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span className="text-pretty">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export interface CmShare {
  label: string
  value: number
  /** chart-1 … chart-5 */
  token: string
  hint?: string
}

/**
 * A stacked share bar with a legend that repeats every value in text, so no
 * information is carried by colour alone.
 */
export function CmBreakdown({
  items,
  format,
  caption,
  emptyMessage = 'Enter an amount above to see the breakdown.',
}: {
  items: CmShare[]
  format: (n: number) => string
  caption?: string
  emptyMessage?: string
}) {
  const shown = items.filter((i) => Number.isFinite(i.value) && i.value > 0)
  const total = shown.reduce((sum, i) => sum + i.value, 0)

  if (total <= 0) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>

  return (
    <div className="space-y-3">
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={shown
          .map((i) => `${i.label}: ${format(i.value)} (${((i.value / total) * 100).toFixed(1)}%)`)
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
              {format(i.value)}
            </span>
          </li>
        ))}
      </ul>
      {caption ? <p className="text-xs text-muted-foreground text-pretty">{caption}</p> : null}
    </div>
  )
}

/* ────────────────────────────── charts ────────────────────────────── */

export interface CmSeries {
  label: string
  /** chart-1 … chart-5 */
  token: string
  points: { x: number; y: number }[]
  dashed?: boolean
  fill?: boolean
}

/**
 * A small inline SVG line chart. No chart library: this is a few dozen lines of
 * path arithmetic and it keeps the bundle honest.
 */
export function CmLineChart({
  series,
  ariaLabel,
  yFormat,
  xFormat,
  caption,
  height = 220,
}: {
  series: CmSeries[]
  ariaLabel: string
  yFormat: (n: number) => string
  xFormat: (n: number) => string
  caption?: ReactNode
  height?: number
}) {
  const W = 720
  const H = height
  const padL = 62
  const padR = 12
  const padT = 12
  const padB = 28

  const all = series.flatMap((s) => s.points)
  if (all.length < 2) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Not enough data to draw a curve yet.
      </p>
    )
  }
  const xMin = Math.min(...all.map((p) => p.x))
  const xMax = Math.max(...all.map((p) => p.x))
  const yMax = Math.max(...all.map((p) => p.y), 1)
  const spanX = xMax - xMin || 1

  const sx = (x: number) => padL + ((x - xMin) / spanX) * (W - padL - padR)
  const sy = (y: number) => H - padB - (y / yMax) * (H - padT - padB)

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMax * t)
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => xMin + spanX * t)

  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={ariaLabel}
          className="h-auto w-full min-w-[320px]"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={padL}
                x2={W - padR}
                y1={sy(t)}
                y2={sy(t)}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : '2 6'}
              />
              <text
                x={padL - 8}
                y={sy(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--muted-foreground)"
              >
                {yFormat(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text
              key={i}
              x={sx(t)}
              y={H - 8}
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
              fontSize={11}
              fill="var(--muted-foreground)"
            >
              {xFormat(t)}
            </text>
          ))}
          {series.map((s) => {
            const dPath = s.points
              .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`)
              .join(' ')
            const first = s.points[0]!
            const last = s.points[s.points.length - 1]!
            return (
              <g key={s.label}>
                {s.fill ? (
                  <path
                    d={`${dPath} L${sx(last.x).toFixed(2)},${sy(0).toFixed(2)} L${sx(first.x).toFixed(
                      2,
                    )},${sy(0).toFixed(2)} Z`}
                    fill="var(--chart-5)"
                  />
                ) : null}
                <path
                  d={dPath}
                  fill="none"
                  stroke={`var(--${s.token})`}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? '6 4' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )
          })}
        </svg>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <svg aria-hidden="true" viewBox="0 0 16 4" className="h-1 w-4 shrink-0">
              <line x1={0} x2={16} y1={2} y2={2} strokeWidth={2} strokeDasharray={s.dashed ? '4 3' : undefined} stroke={`var(--${s.token})`} />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
      {caption ? (
        <figcaption className="text-xs text-muted-foreground text-pretty">{caption}</figcaption>
      ) : null}
    </figure>
  )
}

/** Horizontal comparison bars — target vs actual, strategy vs strategy. */
export function CmBars({
  rows,
  format,
  ariaLabel,
}: {
  rows: { label: string; value: number; token: string; hint?: string }[]
  format: (n: number) => string
  ariaLabel: string
}) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1)
  return (
    <ul className="space-y-2.5" aria-label={ariaLabel}>
      {rows.map((r) => (
        <li key={r.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {r.label}
              {r.hint ? <span className="text-muted-foreground"> · {r.hint}</span> : null}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{format(r.value)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (Math.abs(r.value) / max) * 100)}%`,
                backgroundColor: `var(--${r.token})`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ────────────────────────────── tables ────────────────────────────── */

export interface CmColumn<R> {
  key: string
  header: string
  align?: 'left' | 'right'
  render: (row: R, index: number) => ReactNode
  /** Hide below the `sm` breakpoint. */
  hideOnMobile?: boolean
}

export function CmDataTable<R>({
  columns,
  rows,
  pageSize = 12,
  ariaLabel,
  emptyMessage = 'Nothing to show yet.',
  rowClassName,
  minWidth = 560,
}: {
  columns: CmColumn<R>[]
  rows: R[]
  pageSize?: number
  ariaLabel: string
  emptyMessage?: string
  rowClassName?: (row: R, index: number) => string | undefined
  minWidth?: number
}) {
  const [page, setPage] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const effective = showAll ? 0 : pageSize
  const pageCount = effective > 0 ? Math.max(1, Math.ceil(rows.length / effective)) : 1

  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1))
  }, [pageCount])

  const slice = effective > 0 ? rows.slice(page * effective, page * effective + effective) : rows
  const offset = effective > 0 ? page * effective : 0

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl bg-background">
        <table
          className="w-full border-collapse text-sm"
          style={{ minWidth: `${minWidth}px` }}
          aria-label={ariaLabel}
        >
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

      {rows.length > pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            Showing {offset + 1}–{offset + slice.length} of {formatNumber(rows.length, 0)} rows
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAll((v) => !v)
                setPage(0)
              }}
            >
              {showAll ? 'Paginate' : 'Show all'}
            </Button>
            {!showAll && (
              <>
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
                  {page + 1} / {pageCount}
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
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ────────────────────────────── export bar ────────────────────────────── */

function plainText(tables: CmTable[]): string {
  return tables
    .map((t) => `${t.name}\n${toCsv(t.headers, t.rows).replace(/\r/g, '')}`)
    .join('\n\n')
}

/**
 * The standard result export bar: copy, CSV, XLSX, PDF and print. The XLSX and
 * PDF writers are dynamically imported so a visitor who never exports never
 * downloads them.
 */
export function CmExportBar({ spec, disabled }: { spec: CmExportSpec; disabled?: boolean }) {
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const empty = disabled || spec.tables.every((t) => t.rows.length === 0)

  const run = async (kind: 'xlsx' | 'pdf') => {
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'xlsx') {
        downloadBlob(await xlsxBlob(spec.tables), `${spec.filename}.xlsx`)
      } else {
        downloadBlob(await tablePdfBlob(spec), `${spec.filename}.pdf`)
      }
    } catch {
      setError(
        kind === 'xlsx'
          ? 'The spreadsheet writer could not start. Try the CSV download instead.'
          : 'The PDF writer could not start. Try the CSV download instead.',
      )
    } finally {
      setBusy(null)
    }
  }

  const first = spec.tables[0]

  return (
    <div className="space-y-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={plainText(spec.tables)} label="Copy table" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={empty || !first}
          onClick={() => {
            if (!first) return
            downloadBlob(csvBlob(first.headers, first.rows), `${spec.filename}.csv`)
          }}
        >
          <Download className="mr-1.5 size-4" aria-hidden="true" />
          CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={empty || busy !== null}
          onClick={() => void run('xlsx')}
        >
          <FileSpreadsheet className="mr-1.5 size-4" aria-hidden="true" />
          {busy === 'xlsx' ? 'Building…' : 'Excel'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={empty || busy !== null}
          onClick={() => void run('pdf')}
        >
          <FileText className="mr-1.5 size-4" aria-hidden="true" />
          {busy === 'pdf' ? 'Building…' : 'PDF'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => window.print()}>
          <Printer className="mr-1.5 size-4" aria-hidden="true" />
          Print
        </Button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {busy ? `Building the ${busy.toUpperCase()} file` : ''}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

/* ────────────────────────── persistence control ────────────────────────── */

/**
 * The opt-in save switch. Finance and payroll pages store nothing by default;
 * turning this on is an explicit act and the delete button is always visible
 * next to it.
 */
export function CmSaveControl({
  enabled,
  onToggle,
  onClear,
  id,
  what,
}: {
  enabled: boolean
  onToggle: (v: boolean) => void
  onClear: () => void
  id: string
  what: string
}) {
  const [cleared, setCleared] = useState(false)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2.5 print:hidden">
      <div className="flex items-center gap-2.5">
        <Switch
          id={id}
          checked={enabled}
          onCheckedChange={(v) => {
            onToggle(v)
            setCleared(false)
          }}
        />
        <Label htmlFor={id} className="text-sm font-normal">
          Save {what} on this device
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {cleared ? 'Deleted' : enabled ? 'Stored in this browser only' : 'Nothing is stored'}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onClear()
            onToggle(false)
            setCleared(true)
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}
