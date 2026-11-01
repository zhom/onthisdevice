/**
 * Shared UI primitives for round-2 batch `dev-format`.
 *
 * Owned by the dev-format batch only. Round-1 modules (`DevUi.tsx`,
 * `devlib.ts`, `ui.tsx`) belong to other agents and are deliberately not
 * imported — the handful of shared patterns are re-implemented here.
 */
import type { ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'
import { ShieldCheck, WifiOff, CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
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
  /** Small caption under the pane. */
  footer?: ReactNode
  className?: string
  textareaClassName?: string
  id?: string
  describedBy?: string
  invalid?: boolean
  wrap?: boolean
}

export function DfCodePane({
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
  invalid = false,
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
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        rows={rows}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className={cn(
          'resize-y font-mono text-[13px] leading-relaxed',
          wrap ? 'break-words whitespace-pre-wrap' : 'overflow-x-auto whitespace-pre',
          readOnly && 'bg-muted',
          textareaClassName,
        )}
      />
      {footer ? <div className="text-xs text-muted-foreground">{footer}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Labelled field wrapper                                              */
/* ------------------------------------------------------------------ */

export interface DfFieldProps {
  label: ReactNode
  htmlFor: string
  hint?: ReactNode
  className?: string
  children: ReactNode
}

export function DfField({ label, htmlFor, hint, className, children }: DfFieldProps) {
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

export interface DfSegmentedOption<T extends string> {
  value: T
  label: string
  title?: string
}

export interface DfSegmentedProps<T extends string> {
  label: string
  value: T
  options: DfSegmentedOption<T>[]
  onChange: (value: T) => void
  className?: string
}

/** A compact radio-style toggle group. Arrow keys move between options. */
export function DfSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: DfSegmentedProps<T>) {
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

export interface DfStatChipsProps {
  items: { label: string; value: ReactNode }[]
  className?: string
}

export function DfStatChips({ items, className }: DfStatChipsProps) {
  return (
    <dl className={cn('flex flex-wrap gap-x-4 gap-y-1', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline gap-1.5"
        >
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="font-mono text-xs font-semibold tabular-nums text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ------------------------------------------------------------------ */
/* Status line                                                         */
/* ------------------------------------------------------------------ */

export function DfStatus({
  ok,
  children,
  className,
}: {
  ok: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground',
        className,
      )}
    >
      {ok ? (
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
      )}
      <span className="min-w-0 text-pretty">{children}</span>
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* "Prove it" network probe panel (round-2 plan §4.4)                  */
/* ------------------------------------------------------------------ */

interface NetProbe {
  count: number
  urls: string[]
  listeners: Set<(count: number) => void>
}

declare global {
  interface Window {
    __otdNetProbe?: NetProbe
  }
}

/**
 * Wraps the four APIs a page could use to talk to a server and counts the
 * calls. Everything is pass-through — nothing is blocked, nothing is logged
 * anywhere but this tab's memory. It exists so the privacy claim on these
 * pages is checkable rather than asserted.
 */
function installProbe(): NetProbe | null {
  if (typeof window === 'undefined') return null
  if (window.__otdNetProbe) return window.__otdNetProbe

  const probe: NetProbe = { count: 0, urls: [], listeners: new Set() }

  const record = (url: string) => {
    probe.count += 1
    if (probe.urls.length < 20) probe.urls.push(url)
    for (const listener of probe.listeners) listener(probe.count)
  }

  const originalFetch = window.fetch?.bind(window)
  if (originalFetch) {
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      record(`fetch ${url}`)
      return originalFetch(input, init)
    }
  }

  const XHR = window.XMLHttpRequest
  if (XHR) {
    const originalOpen = XHR.prototype.open
    XHR.prototype.open = function open(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      record(`xhr ${String(url)}`)
      return (originalOpen as unknown as (...args: unknown[]) => void).apply(this, [
        method,
        url,
        ...rest,
      ])
    } as typeof XHR.prototype.open
  }

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const originalBeacon = navigator.sendBeacon.bind(navigator)
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      record(`beacon ${String(url)}`)
      return originalBeacon(url, data)
    }
  }

  window.__otdNetProbe = probe
  return probe
}

export interface DfProofPanelProps {
  /** What the page handles, e.g. "SQL query" — used in the first line. */
  subject: string
  className?: string
}

/**
 * The standard collapsible "prove it" block carried by every page in this
 * batch. Text is deliberately flat and factual — see PRODUCT.md's voice note.
 */
export function DfProofPanel({ subject, className }: DfProofPanelProps) {
  const [count, setCount] = useState<number | null>(null)
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    const probe = installProbe()
    if (!probe) return
    setCount(probe.count)
    setUrls([...probe.urls])
    const listener = (next: number) => {
      setCount(next)
      setUrls([...probe.urls])
    }
    probe.listeners.add(listener)
    return () => {
      probe.listeners.delete(listener)
    }
  }, [])

  const clean = count === 0

  return (
    <details
      className={cn(
        'group rounded-xl bg-card',
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-pretty">
          Your {subject} never leaves this tab: check it yourself
        </span>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 font-mono text-xs tabular-nums',
            count === null || clean ? 'text-muted-foreground' : 'font-semibold text-foreground',
          )}
        >
          {count !== null && !clean ? <TriangleAlert className="size-3.5" aria-hidden="true" /> : null}
          {count === null ? '–' : `${count} requests`}
        </span>
      </summary>

      <div className="space-y-3 px-4 py-4 text-sm text-muted-foreground">
        <p className="text-pretty" role="status" aria-live="polite">
          {count === null
            ? 'Starting the network probe…'
            : clean
              ? `This page has made ${count} network requests since it loaded. Everything you type is processed by JavaScript running on this device.`
              : `${count} network request(s) observed since this page loaded. That is unexpected on this site. The list is below.`}
        </p>

        {urls.length > 0 ? (
          <ul className="max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-xs">
            {urls.map((url, i) => (
              <li key={`${url}-${i}`} className="break-all">
                {url}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="text-pretty">
          The counter above wraps <code className="font-mono">fetch</code>,{' '}
          <code className="font-mono">XMLHttpRequest</code> and{' '}
          <code className="font-mono">navigator.sendBeacon</code> in this tab and counts every
          call. It does not block anything. It only counts.
        </p>

        <h3 className="text-sm font-semibold text-foreground">Two ways to verify independently</h3>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            <span className="inline-flex items-center gap-1.5">
              <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
              Turn off Wi-Fi
            </span>{' '}
            or enable airplane mode, then use the tool. It keeps working, because the page is
            already loaded.
          </li>
          <li>
            Open your browser devtools, switch to the Network tab, clear it, and run the tool. No
            new row appears.
          </li>
        </ol>

        <h3 className="text-sm font-semibold text-foreground">Why this matters</h3>
        <p className="text-pretty">
          In 2025 researchers found that two popular online formatters had kept tens of thousands of
          user-submitted snippets. Together they exposed roughly 80,000 saved documents, many with
          live cloud credentials, private keys and internal database connection strings, because
          “format this” meant “upload this”. A separate incident exposed roughly 3.5 million user
          PDFs on a document-conversion service. This site is served
          under a Content-Security-Policy whose <code className="font-mono">connect-src</code>{' '}
          contains no third-party origin, so a request off this device cannot be made even by
          accident.
        </p>
      </div>
    </details>
  )
}

/* ------------------------------------------------------------------ */
/* Small helpers used across the batch                                 */
/* ------------------------------------------------------------------ */

/** Reads a text file the user picked, with a hard sanity cap. */
export async function readTextFile(file: File, maxBytes = 32 * 1024 * 1024): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(
      `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. Files over ${Math.round(
        maxBytes / 1024 / 1024,
      )} MB are too large to edit comfortably in a textarea. Split the file first.`,
    )
  }
  return file.text()
}

export function lineColumnOf(text: string, index: number): { line: number; column: number } {
  let line = 1
  let last = -1
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1
      last = i
    }
  }
  return { line, column: index - last }
}

/** A 3-line excerpt around `index` with a caret under the offending column. */
export function excerptAround(text: string, index: number): string {
  const { line, column } = lineColumnOf(text, index)
  const lines = text.split('\n')
  const from = Math.max(0, line - 2)
  const to = Math.min(lines.length, line + 1)
  const width = String(to).length
  const out: string[] = []
  for (let i = from; i < to; i += 1) {
    const n = String(i + 1).padStart(width, ' ')
    out.push(`${n} | ${lines[i]}`)
    if (i === line - 1) {
      out.push(`${' '.repeat(width)} | ${' '.repeat(Math.max(0, column - 1))}^`)
    }
  }
  return out.join('\n')
}
