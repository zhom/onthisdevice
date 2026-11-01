import type { ReactNode } from 'react'
import { useId, useState } from 'react'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn } from '@/lib/utils'

/**
 * Small shared UI parts for the `dev-encode` batch. Kept local to the batch on
 * purpose — the round-1 developer tools have their own near-identical set and
 * the two must be free to diverge.
 */

/* ------------------------------------------------------------------ */
/* Monospace pane                                                      */
/* ------------------------------------------------------------------ */

export interface EncodePaneProps {
  label: ReactNode
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  rows?: number
  readOnly?: boolean
  actions?: ReactNode
  copyable?: boolean
  footer?: ReactNode
  className?: string
  id?: string
  describedBy?: string
  invalid?: boolean
  wrap?: boolean
}

export function EncodePane({
  label,
  value,
  onChange,
  placeholder,
  rows = 8,
  readOnly = false,
  actions,
  copyable,
  footer,
  className,
  id,
  describedBy,
  invalid = false,
  wrap = true,
}: EncodePaneProps) {
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
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        rows={rows}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className={cn(
          'resize-y font-mono text-[13px] leading-relaxed',
          wrap ? 'break-words whitespace-pre-wrap' : 'overflow-x-auto whitespace-pre',
          readOnly && 'bg-muted',
        )}
      />
      {footer ? <p className="text-xs text-muted-foreground">{footer}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Labelled field                                                      */
/* ------------------------------------------------------------------ */

export interface EncodeFieldProps {
  label: ReactNode
  htmlFor: string
  hint?: ReactNode
  className?: string
  children: ReactNode
}

export function EncodeField({ label, htmlFor, hint, className, children }: EncodeFieldProps) {
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
/* Segmented control (roving tabindex radiogroup)                      */
/* ------------------------------------------------------------------ */

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  title?: string
}

export interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  className?: string
}

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

/* ------------------------------------------------------------------ */
/* Stat chips                                                          */
/* ------------------------------------------------------------------ */

export function StatChips({
  items,
  className,
}: {
  items: { label: string; value: ReactNode }[]
  className?: string
}) {
  return (
    <dl className={cn('flex flex-wrap gap-x-4 gap-y-1', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline gap-1.5"
        >
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="font-mono text-xs font-medium text-foreground tabular-nums">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ------------------------------------------------------------------ */
/* "Prove it" panel                                                    */
/* ------------------------------------------------------------------ */

/**
 * A collapsible panel that lets the visitor verify the no-network claim rather
 * than take it on trust. `subject` names what they pasted or dropped.
 */
export function ProofPanel({ subject = 'this input' }: { subject?: string }) {
  const [open, setOpen] = useState(false)
  const contentId = useId()

  return (
    <div className="rounded-lg bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <ShieldCheck className="size-4 shrink-0 text-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
          {subject} never leaves this tab: how to check
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          id={contentId}
          className="space-y-3 px-4 py-3 text-sm leading-6 text-muted-foreground"
        >
          <p>
            This page makes no network requests while it works. Three ways to check this for
            yourself:
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Open DevTools → Network, clear it, then run the tool. Nothing new appears.
            </li>
            <li>
              Turn off Wi-Fi and reload once the page is cached. Everything still works.
            </li>
            <li>
              Read the response headers: our Content-Security-Policy lists no third-party origin in{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">connect-src</code>,
              so the browser itself would block an upload even if the page tried one.
            </li>
          </ol>
          <p>
            Why it matters: in 2025 an online PDF service left roughly 3.5 million user documents
            publicly reachable, and researchers found two online code formatters exposing more than
            80,000 saved snippets, many with live cloud credentials. In both cases the paste had to
            reach a server for the product to work.
          </p>
        </div>
      ) : null}
    </div>
  )
}
