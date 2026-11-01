import type { ReactNode } from 'react'
import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Monospace editor pane                                               */
/* ------------------------------------------------------------------ */

export interface CodePaneProps {
  label: ReactNode
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  rows?: number
  readOnly?: boolean
  /** Extra controls rendered on the right of the label row. */
  actions?: ReactNode
  /** Show a copy button (defaults to true for read-only panes). */
  copyable?: boolean
  /** Small caption under the pane, e.g. character counts. */
  footer?: ReactNode
  className?: string
  textareaClassName?: string
  id?: string
  describedBy?: string
  spellCheck?: boolean
  wrap?: boolean
}

/**
 * The standard input/output pane used across the developer tools: a labelled
 * monospace textarea with a copy button and an optional caption.
 */
export function CodePane({
  label,
  value,
  onChange,
  placeholder,
  rows = 12,
  readOnly = false,
  actions,
  copyable,
  footer,
  className,
  textareaClassName,
  id,
  describedBy,
  spellCheck = false,
  wrap = true,
}: CodePaneProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const showCopy = copyable ?? readOnly

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={fieldId} className="text-sm font-medium">
          {label}
        </Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {actions}
          {showCopy && value.length > 0 ? <CopyButton value={value} label="Copy" /> : null}
        </div>
      </div>
      <Textarea
        id={fieldId}
        value={value}
        readOnly={readOnly}
        aria-describedby={describedBy}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        rows={rows}
        spellCheck={spellCheck}
        autoCapitalize="off"
        autoCorrect="off"
        className={cn(
          'resize-y font-mono text-[13px] leading-relaxed tabular-nums',
          wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto',
          readOnly && 'bg-muted',
          textareaClassName,
        )}
      />
      {footer ? <p className="text-xs text-muted-foreground">{footer}</p> : null}
    </div>
  )
}

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
      {hint ? <p className="text-xs text-muted-foreground text-pretty">{hint}</p> : null}
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
        'inline-flex w-full flex-wrap gap-1 rounded-md bg-muted p-1 sm:w-auto',
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
              'flex-auto cursor-pointer rounded px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
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

/* ------------------------------------------------------------------ */
/* Small stat chips                                                    */
/* ------------------------------------------------------------------ */

export interface StatChipsProps {
  items: { label: string; value: ReactNode }[]
  className?: string
}

export function StatChips({ items, className }: StatChipsProps) {
  return (
    <dl className={cn('flex flex-wrap gap-x-4 gap-y-1', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline gap-1.5"
        >
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="font-mono text-xs font-medium tabular-nums text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ------------------------------------------------------------------ */
/* Key/value read-out row                                              */
/* ------------------------------------------------------------------ */

export function DataRow({
  label,
  value,
  mono = true,
}: {
  label: ReactNode
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-border py-2 last:border-b-0 sm:grid-cols-[minmax(9rem,auto)_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 break-words text-sm text-foreground', mono && 'font-mono')}>
        {value}
      </dd>
    </div>
  )
}
