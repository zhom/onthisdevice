import { useCallback, useId, useMemo, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { AlertCircle, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { AnimatedNumber } from '@/components/viz/AnimatedNumber'
import { cn } from '@/lib/utils'
import { parseNum } from './format'

/* ── state ──────────────────────────────────────────────────────── */

/**
 * Text state for a set of number fields. `num[k]` is the parsed value or
 * null; `bind(k)` gives `value` and `onChange` for a field.
 */
export function useFields<K extends string>(init: Record<K, string>) {
  const [raw, setRaw] = useState<Record<K, string>>(init)
  const num = useMemo(() => {
    const out = {} as Record<K, number | null>
    for (const k of Object.keys(raw) as K[]) out[k] = parseNum(raw[k])
    return out
  }, [raw])
  const set = useCallback((k: K, v: string) => setRaw((r) => ({ ...r, [k]: v })), [])
  const bind = (k: K) => ({ value: raw[k], onChange: (v: string) => set(k, v) })
  const setMany = useCallback((patch: Partial<Record<K, string>>) => setRaw((r) => ({ ...r, ...patch })), [])
  return { raw, num, set, bind, setMany }
}

/* ── layout ─────────────────────────────────────────────────────── */

/**
 * The calculator page body. `split` puts the visual beside the inputs from
 * md up; `stack` puts the inputs beside the result and the visual below at
 * full width. On phones everything stacks: inputs, result, visual, working.
 */
export function CalcLayout({
  inputs,
  result,
  visual,
  working,
  children,
  layout = 'split',
}: {
  inputs: ReactNode
  result?: ReactNode
  visual?: ReactNode
  working?: ReactNode
  children?: ReactNode
  layout?: 'split' | 'stack'
}) {
  const panel = (
    <section aria-label="Inputs" className="rounded-xl bg-card p-4 sm:p-5">
      <div className="grid gap-4">{inputs}</div>
    </section>
  )
  return (
    <div className="space-y-10">
      {layout === 'split' ? (
        <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-start">
          <div className="min-w-0 space-y-6">
            {panel}
            {result}
          </div>
          <div className="min-w-0">{visual}</div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 md:items-start">
            <div className="min-w-0">{panel}</div>
            <div className="min-w-0">{result}</div>
          </div>
          {visual}
        </div>
      )}
      {working}
      {children}
    </div>
  )
}

/** Two fields side by side from 360 px up. */
export function Row({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={cn('grid gap-3', cols === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>{children}</div>
}

/* ── fields ─────────────────────────────────────────────────────── */

function FieldNote({ id, hint, error }: { id: string; hint?: ReactNode; error?: string | null }) {
  if (error)
    return (
      <p id={id} className="flex items-start gap-1.5 text-[0.8125rem] font-[560] text-foreground">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {error}
      </p>
    )
  if (hint)
    return (
      <p id={id} className="text-[0.8125rem] text-muted-foreground">
        {hint}
      </p>
    )
  return null
}

export interface NumFieldProps {
  label: ReactNode
  value: string
  onChange: (v: string) => void
  /** Short unit shown inside the field, e.g. "m/s". */
  unit?: ReactNode
  hint?: ReactNode
  /** A message for an invalid value. Shown instead of the hint. */
  error?: string | null
  /** Adds a slider under the field. */
  slider?: { min: number; max: number; step: number }
  inputMode?: 'decimal' | 'numeric' | 'text'
  placeholder?: string
  className?: string
}

export function NumField({ label, value, onChange, unit, hint, error, slider, inputMode = 'decimal', placeholder, className }: NumFieldProps) {
  const id = useId()
  const noteId = `${id}-note`
  const n = parseNum(value)
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          inputMode={inputMode}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? noteId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn('tabular-nums', unit ? 'pr-14' : undefined)}
        />
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{unit}</span>
        ) : null}
      </div>
      {slider ? (
        <Slider
          className="py-2"
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={[Math.min(slider.max, Math.max(slider.min, n ?? slider.min))]}
          onValueChange={(v) => onChange(String(Number((v[0] ?? slider.min).toFixed(6))))}
          aria-label={typeof label === 'string' ? label : undefined}
        />
      ) : null}
      <FieldNote id={noteId} hint={hint} error={error} />
    </div>
  )
}

/** A native date or time field. */
export function DateField({ label, value, onChange, type = 'date', error }: { label: ReactNode; value: string; onChange: (v: string) => void; type?: 'date' | 'time'; error?: string | null }) {
  const id = useId()
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} className="tabular-nums" />
      <FieldNote id={`${id}-note`} error={error} />
    </div>
  )
}

export interface Option<V extends string> {
  value: V
  label: string
}

/** A number with a unit picked from a list. */
export function UnitField<U extends string>({
  label,
  value,
  onChange,
  unit,
  units,
  onUnit,
  hint,
  error,
}: {
  label: ReactNode
  value: string
  onChange: (v: string) => void
  unit: U
  units: readonly Option<U>[]
  onUnit: (u: U) => void
  hint?: ReactNode
  error?: string | null
}) {
  const id = useId()
  const noteId = `${id}-note`
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? noteId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 tabular-nums"
        />
        <Select value={unit} onValueChange={(v) => onUnit(v as U)}>
          <SelectTrigger className="w-auto min-w-[5.5rem] shrink-0" aria-label={`Unit for ${typeof label === 'string' ? label.toLowerCase() : 'this value'}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {units.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <FieldNote id={noteId} hint={hint} error={error} />
    </div>
  )
}

/** A labelled drop-down. */
export function SelectField<V extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: ReactNode
  value: V
  onChange: (v: V) => void
  options: readonly Option<V>[]
  hint?: ReactNode
}) {
  const id = useId()
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as V)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldNote id={`${id}-note`} hint={hint} />
    </div>
  )
}

/** A segmented choice: native radios, so arrow keys and forms work. */
export function Choice<V extends string>({
  label,
  value,
  onChange,
  options,
  hideLabel = false,
}: {
  label: string
  value: V
  onChange: (v: V) => void
  options: readonly Option<V>[]
  hideLabel?: boolean
}) {
  const name = useId()
  return (
    <fieldset className="min-w-0 space-y-1.5">
      <legend className={cn('mb-1.5 text-sm leading-none font-[600] text-foreground', hideLabel && 'sr-only')}>{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg bg-background p-1">
        {options.map((o) => (
          <label key={o.value} className="relative min-w-0 flex-1 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="block rounded-md px-2.5 py-1.5 text-center text-sm font-[600] whitespace-nowrap text-muted-foreground transition-[background-color,color] duration-150 peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:text-foreground peer-checked:hover:text-background">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/* ── results ────────────────────────────────────────────────────── */

/**
 * The answer block: a live region with the main value, an optional line
 * under it, a grid of secondary values and a copy button for all of it.
 */
export function Result({
  label,
  value,
  format,
  unit,
  sub,
  copy,
  children,
  error,
}: {
  label: ReactNode
  /** A number rolls; a string shows as is. */
  value: number | string
  format?: (n: number) => string
  unit?: ReactNode
  sub?: ReactNode
  /** Plain text for the copy button. */
  copy?: string
  children?: ReactNode
  /** Replaces the result with a message when the inputs cannot give one. */
  error?: string | null
}) {
  return (
    <section role="status" aria-live="polite" className="min-w-0 space-y-5 px-1">
      {error ? (
        <p className="flex items-start gap-2 text-[0.9375rem] font-[560] text-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        <>
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[0.875rem] font-[560] text-muted-foreground">{label}</p>
              {copy ? <CopyButton value={copy} label="Copy" size="sm" variant="ghost" className="-mt-1.5 -mr-2" /> : null}
            </div>
            <p className="mt-1 text-[2.25rem] leading-[1.1] font-[740] break-words text-foreground tabular-nums sm:text-[2.5rem]">
              {typeof value === 'number' ? <AnimatedNumber value={value} format={format ?? String} /> : value}
              {unit ? <span className={cn('text-[1.25rem] font-[620] text-muted-foreground', unit !== '°' && unit !== '%' && 'ml-2')}>{unit}</span> : null}
            </p>
            {sub ? <div className="mt-1.5 text-[0.9375rem] text-pretty text-muted-foreground">{sub}</div> : null}
          </div>
          {children ? <dl className="grid grid-cols-2 gap-x-5 gap-y-4">{children}</dl> : null}
        </>
      )}
    </section>
  )
}

/** One secondary value inside <Result>. */
export function Stat({ label, value, format, unit }: { label: ReactNode; value: number | string; format?: (n: number) => string; unit?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.8125rem] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[1.0625rem] font-[650] break-words text-foreground tabular-nums">
        {typeof value === 'number' ? <AnimatedNumber value={value} format={format ?? String} /> : value}
        {unit ? <span className={cn('font-[560] text-muted-foreground', unit !== '°' && unit !== '%' && 'ml-1')}>{unit}</span> : null}
      </dd>
    </div>
  )
}

/** The formula with the visitor's numbers, one step per line. */
export function Working({ lines, caption, title = 'Formula and working' }: { lines: string[]; caption?: ReactNode; title?: string }) {
  const text = lines.join('\n')
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[1.0625rem] font-[650] text-foreground">{title}</h2>
        <CopyButton value={text} label="Copy" size="sm" variant="ghost" />
      </div>
      <Formula caption={caption}>{text}</Formula>
    </section>
  )
}

/* ── visuals ────────────────────────────────────────────────────── */

/**
 * A figure for a diagram or simulation. `summary` is the visible text that
 * says what the picture shows; the picture itself is role="img".
 */
export function Stage({ summary, bar, children, className }: { summary: ReactNode; bar?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <figure className={cn('min-w-0 space-y-3', className)}>
      <div className="relative overflow-hidden rounded-xl bg-card">{children}</div>
      {bar}
      <figcaption className="text-[0.875rem] text-pretty text-muted-foreground">{summary}</figcaption>
    </figure>
  )
}

/** Play, pause and replay for a simulation, plus its time scale or clock. */
export function SimBar({
  playing,
  onPlaying,
  onReplay,
  scale,
  reduced,
  clock,
}: {
  playing: boolean
  onPlaying: (p: boolean) => void
  onReplay?: () => void
  /** "Real time", "Slowed 4×" and so on. */
  scale?: string
  reduced: boolean
  /** A span the simulation writes its clock into. */
  clock?: RefObject<HTMLSpanElement | null>
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {reduced ? null : (
        <>
          <Button variant="ghost" size="sm" onClick={() => onPlaying(!playing)}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {playing ? 'Pause' : 'Play'}
          </Button>
          {onReplay ? (
            <Button variant="ghost" size="sm" onClick={onReplay}>
              <RotateCcw aria-hidden="true" />
              Replay
            </Button>
          ) : null}
        </>
      )}
      <span className="ml-auto flex items-center gap-3 px-1 text-[0.8125rem] font-[560] text-muted-foreground tabular-nums">
        {clock ? <span ref={clock} aria-hidden="true" /> : null}
        <span>{reduced ? 'Still frame' : scale}</span>
      </span>
    </div>
  )
}
