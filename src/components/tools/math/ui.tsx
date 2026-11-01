import type { ReactNode } from 'react'
import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn } from '@/lib/utils'

/* ───────────────────────────── worked steps ───────────────────────────── */

export interface Step {
  /** What this step does, in words. */
  label: string
  /** The maths for this step, shown in a monospace row. */
  expr?: string
  /** Optional aside under the expression. */
  note?: string
}

/**
 * The numbered "show your working" block that every calculator on this site
 * renders under its result. Copyable so it can be pasted into homework.
 */
export function StepList({
  steps,
  title = 'Step-by-step working',
  copyText,
}: {
  steps: Step[]
  title?: string
  copyText?: string
}) {
  if (!steps.length) return null
  const plain =
    copyText ??
    steps
      .map((s, i) => `${i + 1}. ${s.label}${s.expr ? `\n   ${s.expr}` : ''}${s.note ? `\n   ${s.note}` : ''}`)
      .join('\n')

  return (
    <section className="rounded-xl bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <CopyButton value={plain} label="Copy steps" />
      </div>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={`${i}-${step.label}`} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-6 shrink-0 items-center justify-center text-xs font-semibold tabular-nums text-muted-foreground"
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{step.label}</p>
              {step.expr ? (
                <div className="mt-1 overflow-x-auto">
                  <code className="block whitespace-pre font-mono text-sm text-primary">{step.expr}</code>
                </div>
              ) : null}
              {step.note ? <p className="mt-1 text-xs text-muted-foreground">{step.note}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ───────────────────────────── form fields ────────────────────────────── */

export function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  inputMode = 'decimal',
  invalid,
  suffix,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
  invalid?: boolean
  suffix?: ReactNode
  autoFocus?: boolean
}) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={value}
          inputMode={inputMode}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
        />
        {suffix ? <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/* ─────────────────────────────── results ──────────────────────────────── */

/** A big, unmissable primary answer line. */
export function AnswerBanner({
  label,
  value,
  sub,
  copy = true,
}: {
  label: string
  value: string
  sub?: ReactNode
  copy?: boolean
}) {
  return (
    <div className="rounded-xl bg-muted p-4 sm:p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
        <output className="block break-words font-mono text-2xl font-semibold text-foreground sm:text-3xl">
          {value}
        </output>
        {copy ? <CopyButton value={value} label="Copy" /> : null}
      </div>
      {sub ? <div className="mt-2 text-sm text-muted-foreground">{sub}</div> : null}
    </div>
  )
}

/** Small labelled key/value tiles for secondary results. */
export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'muted'
}) {
  return (
    <div
      className={cn(
        'rounded-lg p-3',
        tone === 'muted' ? 'bg-muted' : 'bg-card',
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words font-mono text-base font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function StatGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        'grid gap-3',
        cols === 2 && 'grid-cols-1 sm:grid-cols-2',
        cols === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        cols === 4 && 'grid-cols-2 lg:grid-cols-4',
      )}
    >
      {children}
    </div>
  )
}

/** Horizontally scrollable table shell — required at 360 px. */
export function ScrollTable({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  )
}

export const thClass =
  'border-b border-border bg-muted px-3 py-2 text-left text-xs font-semibold text-muted-foreground'
export const tdClass = 'border-b border-border px-3 py-2 font-mono text-sm text-foreground'
