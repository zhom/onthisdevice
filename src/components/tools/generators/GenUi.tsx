import type { ReactNode } from 'react'
import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { parseColor, toHex } from './colorlib'

/* ------------------------------------------------------------------ */
/* Labelled field wrapper                                              */
/* ------------------------------------------------------------------ */

export interface FieldProps {
  label: ReactNode
  htmlFor: string
  hint?: ReactNode
  className?: string
  children: ReactNode
}

export function Field({ label, htmlFor, hint, className, children }: FieldProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-sm">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-pretty text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  title?: string
}

export interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  className?: string
}

/** A compact radio-style toggle group. Arrow keys move between options. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex w-full flex-wrap gap-1 rounded-md bg-muted p-1',
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                onChange(options[(index + 1) % options.length].value)
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                onChange(options[(index - 1 + options.length) % options.length].value)
              }
            }}
            onClick={() => onChange(option.value)}
            className={cn(
              // `flex-auto`, not `min-w-0 flex-1`: with a zero flex-basis every
              // option shrank to ~41 px on a phone, so the nowrap labels spilled
              // out of their own buttons and the row never wrapped. Sizing from
              // the label keeps the text inside and lets the group wrap onto a
              // second line instead of widening the page.
              'flex-auto cursor-pointer rounded px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:outline-none',
              selected
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

/**
 * A {@link Segmented} with a visible caption. A radiogroup is not a labelable
 * element, so the caption is a plain span rather than a `<label for>`; the
 * group itself carries the accessible name via `aria-label`.
 */
export function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  className,
}: SegmentedProps<T> & { hint?: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-sm leading-none font-medium text-foreground">{label}</span>
      <Segmented label={label} value={value} options={options} onChange={onChange} />
      {hint ? <p className="text-xs text-pretty text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Colour picker + hex text input                                      */
/* ------------------------------------------------------------------ */

export interface ColorFieldProps {
  label: ReactNode
  value: string
  onChange: (hex: string) => void
  hint?: ReactNode
  className?: string
  /** Extra control rendered to the right of the text input. */
  trailing?: ReactNode
}

/**
 * A native colour swatch bound to a free-text field, so a value can be typed
 * (`#0af`, `rgb(0 128 255)`) or picked. The swatch always shows the resolved
 * 6-digit hex; the text field keeps whatever the user typed until it parses.
 */
export function ColorField({ label, value, onChange, hint, className, trailing }: ColorFieldProps) {
  const textId = useId()
  const swatchId = useId()
  const parsed = parseColor(value)
  const hex = parsed ? toHex(parsed) : '#000000'
  const invalid = value.trim().length > 0 && parsed === null

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={textId} className="text-sm">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          id={swatchId}
          type="color"
          value={hex}
          aria-label={`${typeof label === 'string' ? label : 'Colour'} picker`}
          onChange={(event) => onChange(event.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        <Input
          id={textId}
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 font-mono text-sm"
        />
        {trailing}
      </div>
      {invalid ? (
        <p className="text-xs text-destructive">
          Not a colour this tool understands. Try a hex value such as <code>#2563eb</code>.
        </p>
      ) : hint ? (
        <p className="text-xs text-pretty text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Slider bound to a number box                                        */
/* ------------------------------------------------------------------ */

export interface NumberSliderProps {
  label: ReactNode
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  hint?: ReactNode
  className?: string
}

export function NumberSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint,
  className,
}: NumberSliderProps) {
  const id = useId()
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <div className="flex items-center gap-1">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={String(value)}
            min={min}
            max={max}
            step={step}
            onChange={(event) => {
              const next = Number.parseFloat(event.target.value)
              if (Number.isFinite(next)) onChange(next)
            }}
            className="h-8 w-20 px-2 text-right text-sm tabular-nums"
          />
          {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
        </div>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        aria-label={typeof label === 'string' ? label : undefined}
        onValueChange={(next) => {
          if (next.length > 0) onChange(next[0])
        }}
      />
      {hint ? <p className="text-xs text-pretty text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Checkerboard preview surface                                        */
/* ------------------------------------------------------------------ */

const CHECKER_CSS = `
.otd-checker {
  background-image:
    linear-gradient(45deg, color-mix(in oklch, var(--foreground) 9%, transparent) 25%, transparent 25%),
    linear-gradient(-45deg, color-mix(in oklch, var(--foreground) 9%, transparent) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, color-mix(in oklch, var(--foreground) 9%, transparent) 75%),
    linear-gradient(-45deg, transparent 75%, color-mix(in oklch, var(--foreground) 9%, transparent) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
`

/** Transparency checkerboard, so alpha in a preview is unambiguous. */
export function CheckerSurface({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'otd-checker flex items-center justify-center rounded-lg p-4',
        className,
      )}
    >
      <style>{CHECKER_CSS}</style>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Read-only code block with a copy affordance in the parent           */
/* ------------------------------------------------------------------ */

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    // `min-w-0` is what actually makes the scrollbar work. A grid or flex item
    // defaults to `min-width: auto`, i.e. its max-content width, so without it
    // the block grows to fit the longest line — a Tailwind arbitrary-value
    // shadow is ~580 px — and widens the whole page instead of scrolling.
    <div className={cn('min-w-0 overflow-x-auto rounded-lg bg-muted', className)}>
      <pre className="w-max min-w-full p-3 font-mono text-[12.5px] leading-relaxed whitespace-pre text-foreground">
        {code}
      </pre>
    </div>
  )
}
