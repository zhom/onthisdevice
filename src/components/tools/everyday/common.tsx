/**
 * Private helpers shared by the Everyday Calculators islands.
 * Nothing here is exported outside `src/components/tools/everyday`.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import Decimal from 'decimal.js'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/components/tools/finance/format'

/* ------------------------------------------------------------------ *
 * Parsing / maths
 * ------------------------------------------------------------------ */

/** Parse a user-typed number, tolerating thin spaces, commas and a leading currency symbol. */
export function parseNum(value: string): number | null {
  const cleaned = value
    .replace(/[\s  ]/g, '')
    .replace(/[$£€₹¥]/g, '')
    .replace(/,/g, '')
    .trim()
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null
  const n = Number(cleaned)
  // Beyond a quadrillion, sums and products lose cents or overflow; treat as no value.
  return Number.isFinite(n) && Math.abs(n) <= 1e15 ? n : null
}

/** Parse with a fallback — for fields where blank should behave as zero. */
export function num(value: string, fallback = 0): number {
  const parsed = parseNum(value)
  return parsed === null ? fallback : parsed
}

export function D(value: Decimal.Value): Decimal {
  return new Decimal(value)
}

/** Round a Decimal to whole cents, the way a till does. */
export function cents(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

/* ------------------------------------------------------------------ *
 * Cryptographic randomness (unbiased)
 * ------------------------------------------------------------------ */

/** Uniform integer in [0, maxExclusive) using crypto.getRandomValues with rejection sampling. */
export function randomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
    throw new Error('randomInt needs a positive integer range')
  }
  if (maxExclusive === 1) return 0
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % maxExclusive
  }
}

/**
 * `count` uniform integers in [0, maxExclusive). Draws entropy in blocks, which is
 * dramatically faster than one `getRandomValues` call per value for large batches.
 */
export function randomInts(count: number, maxExclusive: number): Uint32Array {
  const out = new Uint32Array(count)
  if (count === 0) return out
  if (maxExclusive === 1) return out
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive
  const block = new Uint32Array(Math.min(Math.max(count, 256), 16384))
  let written = 0
  while (written < count) {
    crypto.getRandomValues(block)
    for (let i = 0; i < block.length && written < count; i++) {
      const v = block[i]
      if (v < limit) out[written++] = v % maxExclusive
    }
  }
  return out
}

/** Fisher–Yates shuffle driven by crypto randomness. Returns a new array. */
export function shuffled<T>(items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Currency
 * ------------------------------------------------------------------ */

export interface CurrencyDef {
  code: string
  symbol: string
  name: string
}

export const CURRENCIES: CurrencyDef[] = [
  { code: 'USD', symbol: '$', name: 'US dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British pound' },
  { code: 'CAD', symbol: '$', name: 'Canadian dollar' },
  { code: 'AUD', symbol: '$', name: 'Australian dollar' },
  { code: 'NZD', symbol: '$', name: 'New Zealand dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss franc' },
  { code: 'ZAR', symbol: 'R', name: 'South African rand' },
]

export function symbolOf(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? '$'
}

/** Currency choice, remembered on this device only. */
export function useCurrency(): [string, (code: string) => void] {
  const [code, setCode] = useState('USD')
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('otd:currency')
      if (saved && CURRENCIES.some((c) => c.code === saved)) setCode(saved)
    } catch {
      /* storage blocked — keep the default */
    }
  }, [])
  const update = useCallback((next: string) => {
    setCode(next)
    try {
      window.localStorage.setItem('otd:currency', next)
    } catch {
      /* ignore */
    }
  }, [])
  return [code, update]
}

export function money(value: Decimal.Value | number, code = 'USD'): string {
  const n = value instanceof Decimal ? value.toNumber() : Number(value)
  return formatCurrency(n, code)
}

export function CurrencySelect({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (code: string) => void
  className?: string
}) {
  const id = useId()
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

/* ------------------------------------------------------------------ *
 * Form primitives
 * ------------------------------------------------------------------ */

export interface NumFieldProps {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  id?: string
  prefix?: string
  suffix?: string
  hint?: ReactNode
  placeholder?: string
  invalid?: boolean
  className?: string
  inputClassName?: string
  ariaLabel?: string
}

/** Labelled numeric text field with optional prefix/suffix adornments. */
export function NumField({
  label,
  value,
  onChange,
  id,
  prefix,
  suffix,
  hint,
  placeholder,
  invalid,
  className,
  inputClassName,
  ariaLabel,
}: NumFieldProps) {
  const auto = useId()
  const inputId = id ?? auto
  const hintId = hint ? `${inputId}-hint` : undefined
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        {prefix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 grid w-9 place-items-center text-sm text-muted-foreground"
          >
            {prefix}
          </span>
        ) : null}
        <Input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.value)}
          className={cn('tabular-nums', prefix && 'pl-9', suffix && 'pr-12', inputClassName)}
        />
        {suffix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 grid w-12 place-items-center text-sm text-muted-foreground"
          >
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-pretty text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export interface TextFieldProps {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  hint?: ReactNode
  className?: string
  srOnlyLabel?: boolean
}

export function TextField({
  label,
  value,
  onChange,
  id,
  placeholder,
  hint,
  className,
  srOnlyLabel,
}: TextFieldProps) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={inputId} className={srOnlyLabel ? 'sr-only' : undefined}>
        {label}
      </Label>
      <Input
        id={inputId}
        type="text"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

/** Accessible radiogroup styled as a segmented control, with roving tab index. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  label: string
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex w-full gap-1 rounded-lg bg-muted p-1',
        className,
      )}
    >
      {options.map((option, i) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault()
                move(i, 1)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                move(i, -1)
              }
            }}
            className={cn(
              'min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              active
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Row of one-tap preset values. */
export function PresetRow({
  label,
  options,
  active,
  onPick,
  className,
}: {
  label: string
  options: { value: number; label: string }[]
  active?: number
  onPick: (value: number) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="group" aria-label={label}>
      {options.map((o) => (
        <Button
          key={o.label}
          type="button"
          size="sm"
          variant={active === o.value ? 'default' : 'outline'}
          aria-pressed={active === o.value}
          onClick={() => onPick(o.value)}
          className="tabular-nums"
        >
          {o.label}
        </Button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Layout & display
 * ------------------------------------------------------------------ */

export function StatGrid({
  children,
  cols = 2,
  className,
}: {
  children: ReactNode
  cols?: 2 | 3
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Note({
  children,
  tone = 'muted',
  className,
}: {
  children: ReactNode
  tone?: 'muted' | 'warning' | 'success'
  className?: string
}) {
  const tones: Record<string, string> = {
    muted: 'text-muted-foreground',
    warning: 'text-foreground',
    success: 'text-foreground',
  }
  const Icon = tone === 'warning' ? TriangleAlert : tone === 'success' ? CircleCheck : null
  return (
    <p
      className={cn(
        'rounded-lg bg-muted px-3 py-2 text-sm leading-6 text-pretty',
        Icon && 'flex items-start gap-2',
        tones[tone],
        className,
      )}
    >
      {Icon ? <Icon className="mt-1 size-4 shrink-0" aria-hidden="true" /> : null}
      {Icon ? <span>{children}</span> : children}
    </p>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-muted px-4 py-10 text-center text-sm text-pretty text-muted-foreground">
      {message}
    </div>
  )
}

/** A simple two-column key/value list used under results. */
export function Breakdown({
  rows,
  className,
}: {
  rows: { label: ReactNode; value: ReactNode; strong?: boolean }[]
  className?: string
}) {
  return (
    <dl className={cn('divide-y divide-border rounded-lg', className)}>
      {rows.map((row, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
          <dt className={cn('text-sm text-muted-foreground', row.strong && 'font-medium text-foreground')}>
            {row.label}
          </dt>
          <dd
            className={cn(
              'text-sm tabular-nums text-foreground',
              row.strong && 'text-base font-semibold',
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Horizontal scroll container for wide tables. */
export function ScrollTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-lg', className)}>
      {children}
    </div>
  )
}

export function pct(value: number, digits = 2): string {
  return `${formatNumber(value, digits)}%`
}

/** Small helper for building copyable text summaries. */
export function summaryLines(lines: (string | null | false | undefined)[]): string {
  return lines.filter((l): l is string => Boolean(l)).join('\n')
}
