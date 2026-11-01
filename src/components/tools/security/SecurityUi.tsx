import type { ReactNode } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Check, Copy, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ATTACK_SCENARIOS, crackTimeFromBits, type StrengthBand } from './seclib'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Privacy banner                                                      */
/* ------------------------------------------------------------------ */

export interface PrivacyNoticeProps {
  children: ReactNode
  className?: string
}

/**
 * The reason anyone should trust an online generator: state plainly, above the
 * tool, that the value is produced here and never sent anywhere.
 */
export function PrivacyNotice({ children, className }: PrivacyNoticeProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl bg-muted px-4 py-3',
        className,
      )}
    >
      <span
        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-foreground"
        aria-hidden="true"
      >
        <ShieldCheck className="size-4" />
      </span>
      <p className="text-sm leading-relaxed text-pretty text-foreground">{children}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Labelled field                                                      */
/* ------------------------------------------------------------------ */

export interface FieldProps {
  label: ReactNode
  /**
   * Id of the labelled control. Omit for controls that are not labelable
   * elements — a Radix slider or a custom radiogroup — which carry their own
   * `aria-label` instead; the caption then renders as plain text rather than a
   * `<label>` pointing at nothing.
   */
  htmlFor?: string
  hint?: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
}

export function Field({ label, htmlFor, hint, action, className, children }: FieldProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-sm">
            {label}
          </Label>
        ) : (
          <span className="text-sm leading-none font-medium text-foreground">{label}</span>
        )}
        {action}
      </div>
      {children}
      {hint ? <p className="text-xs text-pretty text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Switch row                                                         */
/* ------------------------------------------------------------------ */

export interface ToggleRowProps {
  label: ReactNode
  description?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: ToggleRowProps) {
  const id = useId()
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-lg bg-card px-3 py-2.5',
        disabled && 'opacity-60',
        className,
      )}
    >
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
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
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  className?: string
}

/** A compact radio group. Arrow keys move between options, as a radiogroup should. */
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
        'inline-flex w-full flex-wrap gap-1 rounded-lg bg-muted p-1',
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
              'flex-auto cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
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
/* Secret-safe copy button                                             */
/* ------------------------------------------------------------------ */

const CLIPBOARD_CLEAR_SECONDS = 45

function writeClipboard(value: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(value)
      .then(() => true)
      .catch(() => false)
  }
  // Fallback for non-secure contexts: an off-screen textarea plus execCommand.
  try {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    textarea.remove()
    return Promise.resolve(ok)
  } catch {
    return Promise.resolve(false)
  }
}

export interface SecretCopyButtonProps {
  value: string
  label?: string
  /** Overwrite the clipboard after 45 s so a secret does not linger there. */
  autoClear?: boolean
  variant?: 'default' | 'secondary' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  disabled?: boolean
}

/**
 * Copies a secret without ever putting it into the URL, history or storage, and
 * optionally wipes the clipboard again a short while later.
 */
export function SecretCopyButton({
  value,
  label = 'Copy',
  autoClear = true,
  variant = 'outline',
  size = 'sm',
  className,
  disabled = false,
}: SecretCopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimers = useCallback(() => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    if (tickTimer.current) clearInterval(tickTimer.current)
    flashTimer.current = null
    tickTimer.current = null
  }, [])

  useEffect(() => stopTimers, [stopTimers])

  const copy = useCallback(async () => {
    const ok = await writeClipboard(value)
    if (!ok) return
    setCopied(true)
    stopTimers()
    flashTimer.current = setTimeout(() => setCopied(false), 2200)

    if (!autoClear) return
    setRemaining(CLIPBOARD_CLEAR_SECONDS)
    tickTimer.current = setInterval(() => {
      setRemaining((previous) => {
        if (previous <= 1) {
          if (tickTimer.current) clearInterval(tickTimer.current)
          tickTimer.current = null
          // Overwriting is the only "clear" the clipboard API offers.
          void writeClipboard(' ')
          return 0
        }
        return previous - 1
      })
    }, 1000)
  }, [autoClear, stopTimers, value])

  const iconOnly = size === 'icon'

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || value.length === 0}
      className={cn('gap-2', className)}
      aria-label={iconOnly ? label : undefined}
      onClick={() => {
        void copy()
      }}
    >
      {copied ? (
        <Check className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <Copy className="size-4 shrink-0" aria-hidden="true" />
      )}
      {!iconOnly && (
        <span className="tabular-nums">
          {copied ? (remaining > 0 ? `Copied · clears in ${remaining}s` : 'Copied') : label}
        </span>
      )}
    </Button>
  )
}

/* ------------------------------------------------------------------ */
/* Secret display                                                      */
/* ------------------------------------------------------------------ */

export interface SecretOutputProps {
  value: string
  /** Renders as dots until the reveal button is pressed. */
  maskable?: boolean
  ariaLabel: string
  className?: string
  /** Buttons rendered under the value. */
  actions?: ReactNode
}

export function SecretOutput({
  value,
  maskable = false,
  ariaLabel,
  className,
  actions,
}: SecretOutputProps) {
  const [revealed, setRevealed] = useState(!maskable)
  const shown = revealed || !maskable ? value : '•'.repeat(Math.min(value.length, 64))

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-stretch gap-2">
        <output
          aria-label={ariaLabel}
          className="min-w-0 flex-1 rounded-lg bg-muted px-3 py-3 font-mono text-base leading-relaxed break-all text-foreground sm:text-lg"
        >
          {value.length > 0 ? shown : <span className="text-muted-foreground">–</span>}
        </output>
        {maskable && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-auto self-stretch"
            aria-label={revealed ? 'Hide value' : 'Reveal value'}
            aria-pressed={revealed}
            onClick={() => setRevealed((previous) => !previous)}
          >
            {revealed ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </Button>
        )}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Strength meter                                                      */
/* ------------------------------------------------------------------ */

export interface StrengthMeterProps {
  bits: number
  band: StrengthBand
  /** Bits at which the meter reads 100 %. */
  max?: number
  className?: string
}

export function StrengthMeter({ bits, band, max = 128, className }: StrengthMeterProps) {
  const percent = Math.max(0, Math.min(100, (bits / max) * 100))
  return (
    <div className={cn('w-full', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className={cn('text-sm font-semibold', band.textClass)}>{band.label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {bits.toFixed(1)} bits of entropy
        </span>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-input"
        role="meter"
        aria-valuenow={Math.round(bits)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={`${band.label}, ${bits.toFixed(0)} bits`}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', band.barClass)}
          style={{ width: `${Math.max(percent, bits > 0 ? 3 : 0)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-pretty text-muted-foreground">{band.summary}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Crack-time table                                                    */
/* ------------------------------------------------------------------ */

export function CrackTimeTable({ bits, className }: { bits: number; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[10rem]">Attack</TableHead>
            <TableHead className="min-w-[14rem]">Assumed rate</TableHead>
            <TableHead className="min-w-[9rem] text-right">Average time to crack</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ATTACK_SCENARIOS.map((scenario) => (
            <TableRow key={scenario.id}>
              <TableCell className="font-medium whitespace-nowrap">{scenario.name}</TableCell>
              <TableCell className="text-xs text-pretty text-muted-foreground">
                {scenario.detail}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums whitespace-nowrap">
                {crackTimeFromBits(bits, scenario.guessesPerSecond)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Generated-value list                                                */
/* ------------------------------------------------------------------ */

export interface ValueListProps {
  values: string[]
  ariaLabel: string
  className?: string
}

/** A scrollable list of generated secrets, each individually copyable. */
export function ValueList({ values, ariaLabel, className }: ValueListProps) {
  if (values.length === 0) return null
  return (
    <ol
      aria-label={ariaLabel}
      className={cn(
        'max-h-96 divide-y divide-border overflow-y-auto rounded-lg bg-card',
        className,
      )}
    >
      {values.map((value, index) => (
        <li
          key={`${index}-${value}`}
          className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted"
        >
          <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
            {index + 1}
          </span>
          <code className="min-w-0 flex-1 font-mono text-sm break-all text-foreground">{value}</code>
          <SecretCopyButton value={value} size="icon" label={`Copy value ${index + 1}`} />
        </li>
      ))}
    </ol>
  )
}
