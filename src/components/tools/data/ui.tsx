import * as React from 'react'
import { Eraser, FileUp, Loader2, Sparkles, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { cn, formatBytes, nextFrame } from '@/lib/utils'

import { caretLine, countLines, readFileAsText, type Issue } from './datautil'

export type { Issue }

/* ─────────────────────────────────── layout ───────────────────────────────── */

export function Pane({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex min-w-0 flex-col overflow-hidden rounded-xl bg-card', className)}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-card-foreground">{title}</h2>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex min-w-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">{children}</div>
    </section>
  )
}

export function Field({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function ToggleRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-muted px-3 py-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.currentTarget.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
      />
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </Label>
        {hint ? <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  )
}

export function StatChips({ stats }: { stats: { label: string; value: string }[] }) {
  if (stats.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      {stats.map((s) => (
        <li key={s.label} className="text-muted-foreground">
          <span className="font-medium text-foreground">{s.value}</span> {s.label}
        </li>
      ))}
    </ul>
  )
}

export function IssueAlert({ issue }: { issue: Issue }) {
  const caret = caretLine(issue.snippet, issue.column)
  const where =
    issue.line !== undefined
      ? `Line ${issue.line}${issue.column !== undefined ? `, column ${issue.column}` : ''}`
      : null
  return (
    <div
      role="alert"
      className="rounded-lg bg-muted p-3 text-sm text-foreground"
    >
      <div className="flex gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-pretty">
            {where ? <span className="font-semibold text-foreground">{where}: </span> : null}
            {issue.message}
          </p>
          {issue.snippet && issue.snippet.trim() !== '' ? (
            <pre className="mt-2 overflow-x-auto rounded-md bg-background p-2 text-xs leading-tight">
              <code>
                {issue.snippet.replace(/\t/g, ' ')}
                {caret ? '\n' + caret : ''}
              </code>
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
    <div role="status" aria-live="polite" className="rounded-lg bg-muted p-3 text-sm">
      <p className="mb-1 flex items-center gap-2 font-medium">
        <TriangleAlert className="size-4 shrink-0 text-foreground" aria-hidden="true" />
        {warnings.length === 1 ? 'One thing to check' : `${warnings.length} things to check`}
      </p>
      <ul className="list-disc space-y-0.5 pl-8 text-muted-foreground">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  )
}

/** Debounce a value so expensive conversions don't run on every keystroke. */
export function useDebounced<T>(value: T, delay = 180): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/* ───────────────────────────────── code areas ─────────────────────────────── */

const CODE_CLASS =
  'block w-full min-w-0 flex-1 resize-y rounded-lg border border-input bg-background p-3 font-mono text-[13px] leading-relaxed ' +
  'text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring'

export function CodeTextarea({
  id,
  value,
  onChange,
  placeholder,
  readOnly,
  ariaLabel,
  rows = 16,
  className,
  onDropText,
}: {
  id: string
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  readOnly?: boolean
  ariaLabel?: string
  rows?: number
  className?: string
  onDropText?: (file: File) => void
}) {
  const [dragging, setDragging] = React.useState(false)
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <textarea
        id={id}
        value={value}
        rows={rows}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={onChange ? (e) => onChange(e.currentTarget.value) : undefined}
        onDragOver={
          onDropText
            ? (e) => {
                e.preventDefault()
                setDragging(true)
              }
            : undefined
        }
        onDragLeave={onDropText ? () => setDragging(false) : undefined}
        onDrop={
          onDropText
            ? (e) => {
                e.preventDefault()
                setDragging(false)
                const file = e.dataTransfer.files[0]
                if (file) onDropText(file)
              }
            : undefined
        }
        className={cn(CODE_CLASS, dragging && 'ring-2 ring-primary', className)}
      />
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-primary text-sm font-medium text-primary-foreground">
          Drop the file to load it
        </div>
      ) : null}
    </div>
  )
}

/* ──────────────────────────────── input pane ──────────────────────────────── */

export interface EditorPaneProps {
  id: string
  title: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  accept: string
  sample?: string
  sampleLabel?: string
  fileName: string | null
  onFileName: (name: string | null) => void
  issue?: Issue | null
  rows?: number
  extraActions?: React.ReactNode
  onError?: (message: string) => void
}

export function EditorPane({
  id,
  title,
  value,
  onChange,
  placeholder,
  accept,
  sample,
  sampleLabel = 'Sample',
  fileName,
  onFileName,
  issue,
  rows = 18,
  extraActions,
  onError,
}: EditorPaneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(
    async (file: File) => {
      try {
        const text = await readFileAsText(file)
        onChange(text)
        onFileName(file.name)
      } catch (error) {
        onError?.(error instanceof Error ? error.message : 'That file could not be read.')
      }
    },
    [onChange, onFileName, onError],
  )

  const bytes = React.useMemo(() => new TextEncoder().encode(value).length, [value])

  return (
    <Pane
      title={title}
      subtitle={fileName ?? undefined}
      actions={
        <>
          {extraActions}
          {sample ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(sample)
                onFileName(null)
              }}
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              {sampleLabel}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <FileUp className="size-3.5" aria-hidden="true" />
            Open file
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={value === ''}
            onClick={() => {
              onChange('')
              onFileName(null)
            }}
          >
            <Eraser className="size-3.5" aria-hidden="true" />
            Clear
          </Button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          if (file) void load(file)
          e.currentTarget.value = ''
        }}
      />
      <Label htmlFor={id} className="sr-only">
        {title}
      </Label>
      <CodeTextarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        onDropText={(file) => void load(file)}
      />
      {value === '' ? null : (
        <StatChips
          stats={[
            { label: 'lines', value: countLines(value).toLocaleString() },
            { label: 'characters', value: value.length.toLocaleString() },
            { label: 'in memory', value: formatBytes(bytes) },
          ]}
        />
      )}
      {issue ? <IssueAlert issue={issue} /> : null}
    </Pane>
  )
}

/* ──────────────────────────────── output pane ─────────────────────────────── */

export interface OutputPaneProps {
  id: string
  title: string
  value: string
  filename: string
  mime: string
  emptyHint: string
  busy?: boolean
  rows?: number
  stats?: { label: string; value: string }[]
  extraActions?: React.ReactNode
  children?: React.ReactNode
  downloadLabel?: string
}

export function OutputPane({
  id,
  title,
  value,
  filename,
  mime,
  emptyHint,
  busy,
  rows = 18,
  stats = [],
  extraActions,
  children,
  downloadLabel = 'Download',
}: OutputPaneProps) {
  const blob = React.useMemo(() => new Blob([value], { type: mime }), [value, mime])
  const has = value !== ''

  return (
    <Pane
      title={title}
      actions={
        <>
          {extraActions}
          {busy ? (
            <span
              role="status"
              aria-live="polite"
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Converting…
            </span>
          ) : null}
          {has ? <CopyButton value={value} label="Copy" /> : null}
          {has ? <DownloadButton blob={blob} filename={filename} label={downloadLabel} /> : null}
        </>
      }
    >
      {children ?? (
        <>
          <Label htmlFor={id} className="sr-only">
            {title}
          </Label>
          <CodeTextarea id={id} value={value} readOnly rows={rows} placeholder={emptyHint} />
        </>
      )}
      <StatChips stats={stats} />
    </Pane>
  )
}

/* ───────────────────────────── two-pane converter ─────────────────────────── */

export interface ConversionResult {
  output: string
  issue?: Issue | null
  stats?: { label: string; value: string }[]
  warnings?: string[]
}

export interface TextConverterProps {
  /** Stable id prefix for the input/output textareas. */
  idPrefix: string
  inputTitle: string
  outputTitle: string
  placeholder: string
  accept: string
  sample: string
  sampleLabel?: string
  outputMime: string
  /** Called with the current input; must be memoised with `useCallback`. */
  convert: (input: string) => ConversionResult
  /** Builds the download filename from the loaded file name (without extension). */
  downloadName: (base: string) => string
  emptyHint: string
  options?: React.ReactNode
  /** Replaces the read-only output textarea. Receives the converted text. */
  renderOutput?: (output: string) => React.ReactNode
  outputActions?: React.ReactNode
  inputActions?: React.ReactNode
  /** Extra content rendered under the two panes. */
  footer?: React.ReactNode
  onResult?: (result: ConversionResult) => void
}

export function TextConverter({
  idPrefix,
  inputTitle,
  outputTitle,
  placeholder,
  accept,
  sample,
  sampleLabel,
  outputMime,
  convert,
  downloadName,
  emptyHint,
  options,
  renderOutput,
  outputActions,
  inputActions,
  footer,
  onResult,
}: TextConverterProps) {
  const [input, setInput] = React.useState('')
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<ConversionResult>({ output: '' })
  const [busy, setBusy] = React.useState(false)
  const [readError, setReadError] = React.useState<string | null>(null)

  const onResultRef = React.useRef(onResult)
  onResultRef.current = onResult

  React.useEffect(() => {
    if (input.trim() === '') {
      setResult({ output: '' })
      setBusy(false)
      return
    }
    let cancelled = false
    setBusy(true)
    const timer = window.setTimeout(() => {
      void (async () => {
        await nextFrame()
        if (cancelled) return
        let next: ConversionResult
        try {
          next = convert(input)
        } catch (error) {
          next = {
            output: '',
            issue: {
              message:
                error instanceof Error ? error.message : 'Something went wrong converting this input.',
            },
          }
        }
        if (cancelled) return
        setResult(next)
        setBusy(false)
        onResultRef.current?.(next)
      })()
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [input, convert])

  const base = fileName ? fileName.replace(/\.[^.]+$/, '') : 'converted'
  const issue = readError ? { message: readError } : result.issue ?? null

  return (
    <div className="space-y-4">
      {options}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <EditorPane
          id={`${idPrefix}-input`}
          title={inputTitle}
          value={input}
          onChange={(v) => {
            setReadError(null)
            setInput(v)
          }}
          placeholder={placeholder}
          accept={accept}
          sample={sample}
          sampleLabel={sampleLabel}
          fileName={fileName}
          onFileName={setFileName}
          issue={issue}
          extraActions={inputActions}
          onError={setReadError}
        />
        <OutputPane
          id={`${idPrefix}-output`}
          title={outputTitle}
          value={result.output}
          filename={downloadName(base)}
          mime={outputMime}
          emptyHint={emptyHint}
          busy={busy}
          stats={result.stats ?? []}
          extraActions={outputActions}
        >
          {renderOutput ? renderOutput(result.output) : undefined}
        </OutputPane>
      </div>
      {result.warnings && result.warnings.length > 0 ? <WarningList warnings={result.warnings} /> : null}
      {footer}
    </div>
  )
}
