/**
 * Shared UI + state plumbing for the Text Tools category.
 *
 * Every text tool follows the same shape: a big editor, a live derived result,
 * copy/download/clear actions and a file drop target. These pieces keep that
 * consistent without adding anything to `src/components/shared/`.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import { Eraser, FileUp, Loader2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn, downloadBlob, formatNumber } from '@/lib/utils'
import { Cancelled } from './text-core'

/* ─────────────────────────── async computation ─────────────────────────── */

export interface ComputeCtx {
  progress: (pct: number) => void
  cancelled: () => boolean
}

export interface ComputedState<T> {
  value: T
  busy: boolean
  progress: number
  error: string | null
}

/**
 * Debounced, cancellable derived state.
 *
 * The compute function receives a context it should poll: long loops call
 * `ctx.cancelled()` and bail (the chunked helpers in `text-core` do this for
 * you by throwing `Cancelled`), so a fast typist never queues up work.
 */
export function useComputed<T>(
  initial: T,
  compute: (ctx: ComputeCtx) => Promise<T>,
  deps: unknown[],
  delayMs = 120,
): ComputedState<T> {
  const [state, setState] = useState<ComputedState<T>>({
    value: initial,
    busy: false,
    progress: 0,
    error: null,
  })
  const computeRef = useRef(compute)
  computeRef.current = compute

  useEffect(() => {
    let stale = false
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, busy: true, progress: 0, error: null }))
      void (async () => {
        try {
          const value = await computeRef.current({
            progress: (pct) => {
              if (!stale) setState((s) => (s.busy ? { ...s, progress: pct } : s))
            },
            cancelled: () => stale,
          })
          if (!stale) setState({ value, busy: false, progress: 100, error: null })
        } catch (error) {
          if (stale || error instanceof Cancelled) return
          setState((s) => ({
            ...s,
            busy: false,
            error: error instanceof Error ? error.message : 'Something went wrong.',
          }))
        }
      })()
    }, delayMs)

    return () => {
      stale = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

/* ───────────────────────────── file loading ────────────────────────────── */

export const TEXT_ACCEPT =
  '.txt,.md,.markdown,.csv,.tsv,.log,.json,.xml,.yml,.yaml,.html,.css,.js,.ts,.srt,.vtt,text/plain'

const MAX_TEXT_MB = 25

/** Reads a dropped/picked file as UTF-8 text, with a human error on failure. */
export async function readTextFile(file: File): Promise<string> {
  if (file.size > MAX_TEXT_MB * 1024 * 1024) {
    throw new Error(
      `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. Files up to ${MAX_TEXT_MB} MB work well in the browser. Split the file first.`,
    )
  }
  try {
    const text = await file.text()
    if (text.indexOf('\u0000') !== -1) {
      throw new Error(`${file.name} looks like a binary file, not text.`)
    }
    return text
  } catch (error) {
    if (error instanceof Error && error.message.includes('binary')) throw error
    throw new Error(`${file.name} could not be read as text.`)
  }
}

/* ──────────────────────────────── editor ───────────────────────────────── */

export interface TextEditorProps {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  mono?: boolean
  /** Text inserted by the "Try an example" button. */
  sample?: string
  /** Extra buttons rendered in the toolbar, right-aligned. */
  actions?: ReactNode
  hint?: ReactNode
  className?: string
  spellCheck?: boolean
  id?: string
  readOnly?: boolean
}

export function TextEditor({
  label,
  value,
  onChange,
  placeholder = 'Type or paste your text here…',
  rows = 12,
  mono = false,
  sample,
  actions,
  hint,
  className,
  spellCheck = false,
  id,
  readOnly = false,
}: TextEditorProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const loadFiles = useCallback(
    async (files: FileList | File[] | null) => {
      const list = Array.from(files ?? [])
      if (list.length === 0) return
      try {
        const texts = await Promise.all(list.map(readTextFile))
        setFileError(null)
        onChange(texts.join('\n'))
      } catch (error) {
        setFileError(error instanceof Error ? error.message : 'That file could not be read.')
      }
    },
    [onChange],
  )

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    void loadFiles(event.dataTransfer?.files ?? null)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={fieldId} className="text-sm font-medium">
          {label}
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          {sample !== undefined && value.trim() === '' && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(sample)}>
              Try an example
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => inputRef.current?.click()}
          >
            <FileUp className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Open file</span>
            <span className="sm:hidden">File</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2"
            disabled={value === ''}
            onClick={() => {
              onChange('')
              setFileError(null)
            }}
          >
            <Eraser className="size-4" aria-hidden="true" />
            Clear
          </Button>
          {actions}
        </div>
      </div>

      <div
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'relative rounded-md transition-colors',
          dragging && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        )}
      >
        <Textarea
          id={fieldId}
          value={value}
          rows={rows}
          readOnly={readOnly}
          spellCheck={spellCheck}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn(
            'field-sizing-fixed resize-y leading-relaxed',
            mono && 'font-mono text-[13px]',
          )}
          style={{ minHeight: `${rows * 1.6}rem` }}
        />
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground">
            Drop a text file to load it
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={TEXT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void loadFiles(event.target.files)
          event.target.value = ''
        }}
      />

      {fileError ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {fileError}
        </p>
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground text-pretty">{hint}</p> : null}
    </div>
  )
}

/* ──────────────────────────────── output ───────────────────────────────── */

export interface OutputBoxProps {
  label: ReactNode
  value: string
  filename: string
  rows?: number
  mono?: boolean
  empty?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  id?: string
}

/** Read-only result area with copy + download, plus a designed empty state. */
export function OutputBox({
  label,
  value,
  filename,
  rows = 12,
  mono = true,
  empty = 'The result will appear here.',
  children,
  actions,
  id,
}: OutputBoxProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const isEmpty = value === ''
  const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '.txt'
  const mime =
    extension === '.csv'
      ? 'text/csv;charset=utf-8'
      : extension === '.html'
        ? 'text/html;charset=utf-8'
        : 'text/plain;charset=utf-8'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {isEmpty ? (
          <span className="text-sm font-medium text-foreground">{label}</span>
        ) : (
          <Label htmlFor={fieldId} className="text-sm font-medium">
            {label}
          </Label>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isEmpty}
            onClick={() => downloadBlob(new Blob([value], { type: mime }), filename)}
          >
            Download {extension}
          </Button>
          <CopyButton value={value} label="Copy result" />
        </div>
      </div>

      {isEmpty ? (
        <div className="flex min-h-32 items-center justify-center rounded-md bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <Textarea
          id={fieldId}
          readOnly
          value={value}
          rows={rows}
          spellCheck={false}
          className={cn('field-sizing-fixed resize-y leading-relaxed', mono && 'font-mono text-[13px]')}
          style={{ minHeight: `${rows * 1.6}rem` }}
        />
      )}
      {children}
    </div>
  )
}

/* ──────────────────────────────── options ──────────────────────────────── */

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-card px-3 py-2.5">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{description}</p>
        ) : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  hint?: string
}

/** Accessible button group — a radio group without the radio chrome. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={option.hint}
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ───────────────────────────────── stats ───────────────────────────────── */

export function StatTile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg p-3',
        accent ? 'bg-muted' : 'bg-card',
      )}
    >
      <div className="text-[11px] font-medium text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'mt-0.5 font-semibold tabular-nums break-words',
          accent ? 'text-2xl text-foreground' : 'text-xl text-foreground',
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

/** Compact inline counters shown under an editor. */
export function CountBar({ items }: { items: { label: string; value: number | string }[] }) {
  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1">
          <dt>{item.label}</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {typeof item.value === 'number' ? formatNumber(item.value, 0) : item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Small inline "working" badge for chunked recomputation. */
export function BusyNote({ busy, progress, label = 'Processing…' }: { busy: boolean; progress: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
      {busy ? (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {label}
          {progress > 0 && progress < 100 ? ` ${Math.round(progress)}%` : ''}
        </span>
      ) : null}
    </div>
  )
}
