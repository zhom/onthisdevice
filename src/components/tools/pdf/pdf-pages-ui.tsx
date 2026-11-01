/**
 * Small UI parts shared by the round-2 `pdf-pages` batch only.
 * Batch-prefixed so it cannot collide with another agent's files in this folder.
 */
import { useId } from 'react'
import type { ReactNode } from 'react'
import { ShieldCheck, WifiOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { PageScope } from './pdf-pages-core'

export interface PageScopeFieldProps {
  scope: PageScope
  onScopeChange: (scope: PageScope) => void
  custom: string
  onCustomChange: (value: string) => void
  pageCount: number
  label?: string
  disabled?: boolean
  className?: string
}

/** "Apply to: all / odd / even / custom range" with the range box revealed. */
export function PageScopeField({
  scope,
  onScopeChange,
  custom,
  onCustomChange,
  pageCount,
  label = 'Apply to',
  disabled = false,
  className,
}: PageScopeFieldProps) {
  const selectId = useId()
  const rangeId = useId()

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <div className="space-y-2">
        <Label htmlFor={selectId}>{label}</Label>
        <Select
          value={scope}
          onValueChange={(value) => onScopeChange(value as PageScope)}
          disabled={disabled}
        >
          <SelectTrigger id={selectId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {pageCount > 0 ? pageCount : ''} pages</SelectItem>
            <SelectItem value="odd">Odd pages (1, 3, 5…)</SelectItem>
            <SelectItem value="even">Even pages (2, 4, 6…)</SelectItem>
            <SelectItem value="custom">Custom range…</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scope === 'custom' && (
        <div className="space-y-2">
          <Label htmlFor={rangeId}>Pages</Label>
          <Input
            id={rangeId}
            value={custom}
            inputMode="numeric"
            placeholder="1-3, 7, 10-"
            disabled={disabled}
            onChange={(event) => onCustomChange(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Numbers, ranges (<code className="font-mono">4-9</code>) and open ranges (
            <code className="font-mono">10-</code>).
          </p>
        </div>
      )}
    </div>
  )
}

export interface NumberFieldProps {
  label: ReactNode
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  hint?: ReactNode
  disabled?: boolean
  className?: string
}

/** A labelled numeric input that never lets NaN escape into the maths. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  hint,
  disabled = false,
  className,
}: NumberFieldProps) {
  const id = useId()
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => {
            const next = Number.parseFloat(event.target.value)
            if (!Number.isFinite(next)) {
              onChange(typeof min === 'number' ? min : 0)
              return
            }
            let clamped = next
            if (typeof min === 'number' && clamped < min) clamped = min
            if (typeof max === 'number' && clamped > max) clamped = max
            onChange(clamped)
          }}
        />
        {suffix ? (
          <span className="shrink-0 text-sm text-muted-foreground" aria-hidden="true">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground text-pretty">{hint}</p> : null}
    </div>
  )
}

export interface ProofPanelProps {
  /** One sentence naming what specifically stays local on this page. */
  what: string
  className?: string
}

/**
 * The "prove it" disclosure: how to verify for yourself that this page made no
 * network request while it processed your file.
 */
export function ProofPanel({ what, className }: ProofPanelProps) {
  return (
    <details
      className={cn(
        'group rounded-lg bg-muted px-4 py-3 text-sm',
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
        {what} never leaves this tab. Here is how to check
      </summary>
      <div className="mt-3 space-y-2 text-muted-foreground">
        <p className="text-pretty">
          This page has no upload step and no server behind it. Two ways to confirm that yourself,
          neither of which requires trusting us:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li className="text-pretty">
            <WifiOff className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
            Turn off Wi-Fi or put the device in aeroplane mode after this page has loaded, then run
            the tool. It still works.
          </li>
          <li className="text-pretty">
            Open your browser&rsquo;s developer tools, switch to the Network tab, clear it, and
            process a file. No request appears.
          </li>
        </ul>
        <p className="text-pretty">
          In 2025 an upload-based PDF service was found exposing about 3.5 million user-uploaded
          documents, and two online code formatter sites leaked over 80,000 saved snippets with
          live cloud credentials. A file that is never sent cannot be exposed that way.
        </p>
      </div>
    </details>
  )
}
