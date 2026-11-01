import { Fragment, useMemo, useState } from 'react'
import { ArrowLeftRight, Check, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn, downloadBlob, formatNumber, nextFrame } from '@/lib/utils'
import { BusyNote, Segmented, StatTile, TextEditor, ToggleRow, useComputed } from './common'
import {
  computeDiff,
  toUnifiedPatch,
  type DiffResult,
  type DiffRow,
  type WordPart,
} from './diff-core'

const SAMPLE_A = `Terms of service
Version 3, effective January 2026.

You may use the service for any lawful purpose.
Accounts are free and require an email address.
We store your files for 30 days.
Support is available on weekdays.`

const SAMPLE_B = `Terms of service
Version 4, effective March 2026.

You may use the service for any lawful purpose.
Accounts are free and require a verified email address.
We never store your files.
Support is available on weekdays.
Disputes are handled under the laws of Ireland.`

const EMPTY_RESULT: DiffResult = {
  rows: [],
  summary: { added: 0, removed: 0, modified: 0, unchanged: 0, similarity: 100, aLines: 0, bLines: 0 },
  identical: true,
}

const MAX_RENDERED_ROWS = 1200
const CONTEXT_LINES = 3

const VIEW_OPTIONS = [
  { value: 'split', label: 'Side by side' },
  { value: 'unified', label: 'Unified' },
] as const

type ViewMode = (typeof VIEW_OPTIONS)[number]['value']

function Parts({ parts, text, tone }: { parts: WordPart[] | null; text: string; tone: 'add' | 'remove' }) {
  if (text === '') return <span className="text-muted-foreground">(empty line)</span>
  if (!parts) return <>{text}</>
  return (
    <>
      {parts.map((part, i) =>
        part.changed ? (
          <mark
            key={i}
            className={cn(
              'rounded-sm bg-transparent px-0.5 font-semibold text-foreground decoration-2',
              tone === 'add' ? 'underline underline-offset-2' : 'line-through',
            )}
          >
            {part.text}
          </mark>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  )
}

type Displayed = { kind: 'row'; row: DiffRow } | { kind: 'gap'; count: number }

function collapseRows(rows: DiffRow[], collapse: boolean): Displayed[] {
  if (!collapse) return rows.map((row) => ({ kind: 'row', row }))
  const out: Displayed[] = []
  let i = 0
  while (i < rows.length) {
    if (rows[i].type !== 'equal') {
      out.push({ kind: 'row', row: rows[i] })
      i++
      continue
    }
    let j = i
    while (j < rows.length && rows[j].type === 'equal') j++
    const run = j - i
    if (run > CONTEXT_LINES * 2 + 2) {
      const head = i === 0 ? 0 : CONTEXT_LINES
      const tail = j === rows.length ? 0 : CONTEXT_LINES
      for (let k = i; k < i + head; k++) out.push({ kind: 'row', row: rows[k] })
      out.push({ kind: 'gap', count: run - head - tail })
      for (let k = j - tail; k < j; k++) out.push({ kind: 'row', row: rows[k] })
    } else {
      for (let k = i; k < j; k++) out.push({ kind: 'row', row: rows[k] })
    }
    i = j
  }
  return out
}

const ROW_TONE: Record<DiffRow['type'], string> = {
  equal: '',
  add: 'bg-muted',
  remove: 'bg-muted',
  modify: 'bg-muted',
}

function LineNumber({ value }: { value: number | null }) {
  return (
    <td className="w-12 select-none border-r border-border bg-muted px-2 py-0.5 text-right align-top font-mono text-[11px] tabular-nums text-muted-foreground">
      {value ?? ''}
    </td>
  )
}

export default function TextDiffChecker() {
  const [original, setOriginal] = useState('')
  const [changed, setChanged] = useState('')
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [collapse, setCollapse] = useState(true)
  const [view, setView] = useState<ViewMode>('split')

  const { value: result, busy, progress } = useComputed<DiffResult>(
    EMPTY_RESULT,
    async (ctx) => {
      if (original === '' && changed === '') return EMPTY_RESULT
      ctx.progress(10)
      await nextFrame()
      if (ctx.cancelled()) return EMPTY_RESULT
      const estimatedLines =
        (original.match(/\n/g)?.length ?? 0) + (changed.match(/\n/g)?.length ?? 0)
      const diff = computeDiff(original, changed, {
        ignoreWhitespace,
        ignoreCase,
        skipWordDiff: estimatedLines > 6000,
      })
      ctx.progress(100)
      return diff
    },
    [original, changed, ignoreWhitespace, ignoreCase],
    200,
  )

  const displayed = useMemo(() => collapseRows(result.rows, collapse), [result.rows, collapse])
  const truncated = displayed.length > MAX_RENDERED_ROWS
  const visible = truncated ? displayed.slice(0, MAX_RENDERED_ROWS) : displayed

  const patch = useMemo(
    () => (result.rows.length === 0 ? '' : toUnifiedPatch(result, 'original.txt', 'changed.txt')),
    [result],
  )

  const hasInput = original !== '' || changed !== ''
  const { summary } = result

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="grid gap-4 lg:grid-cols-2">
          <TextEditor
            label="Original text"
            value={original}
            onChange={setOriginal}
            rows={12}
            mono
            sample={SAMPLE_A}
            placeholder="Paste the first version here…"
          />
          <TextEditor
            label="Changed text"
            value={changed}
            onChange={setChanged}
            rows={12}
            mono
            sample={SAMPLE_B}
            placeholder="Paste the second version here…"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setOriginal(changed)
              setChanged(original)
            }}
            disabled={!hasInput}
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            Swap sides
          </Button>
          <CopyButton value={patch} label="Copy unified diff" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={patch === ''}
            onClick={() =>
              downloadBlob(new Blob([patch], { type: 'text/plain;charset=utf-8' }), 'changes.diff')
            }
          >
            <Download className="size-4" aria-hidden="true" />
            Download .diff
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ToggleRow
            label="Ignore whitespace"
            description="Indentation and repeated spaces are not treated as changes."
            checked={ignoreWhitespace}
            onChange={setIgnoreWhitespace}
          />
          <ToggleRow
            label="Ignore case"
            description="“Total” and “total” count as the same line."
            checked={ignoreCase}
            onChange={setIgnoreCase}
          />
          <ToggleRow
            label="Collapse unchanged"
            description={`Keep ${CONTEXT_LINES} lines of context around each change.`}
            checked={collapse}
            onChange={setCollapse}
          />
          <div className="flex items-center">
            <Segmented label="View" value={view} options={VIEW_OPTIONS} onChange={setView} />
          </div>
        </div>
        <BusyNote busy={busy} progress={progress} label="Comparing…" />
      </ToolPanel>

      {hasInput && (
        <ToolPanel title="Change summary">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatTile label="Added" value={formatNumber(summary.added, 0)} hint="lines only in the new text" />
            <StatTile label="Removed" value={formatNumber(summary.removed, 0)} hint="lines only in the old text" />
            <StatTile label="Modified" value={formatNumber(summary.modified, 0)} hint="lines changed in place" />
            <StatTile label="Unchanged" value={formatNumber(summary.unchanged, 0)} hint="identical lines" />
            <StatTile
              label="Similarity"
              value={`${summary.similarity.toFixed(1)}%`}
              accent
              hint={`${formatNumber(summary.aLines, 0)} → ${formatNumber(summary.bLines, 0)} lines`}
            />
          </div>
          {result.identical && (
            <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-foreground">
              <Check className="size-4" aria-hidden="true" />
              The two texts are identical
              {(ignoreCase || ignoreWhitespace) && ' under the comparison options you selected'}.
            </p>
          )}
        </ToolPanel>
      )}

      {result.rows.length > 0 && (
        <ToolPanel
          title={view === 'split' ? 'Side-by-side comparison' : 'Unified comparison'}
          description="Removed text is marked with a minus, added text with a plus. Inside a changed line, added words are underlined and removed words are struck through."
        >
          <div className="overflow-x-auto rounded-lg bg-background">
            <table className="w-full border-collapse text-left font-mono text-[13px] leading-relaxed">
              <caption className="sr-only">
                Differences between the original and changed text
              </caption>
              {view === 'split' ? (
                <>
                  <thead>
                    <tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                      <th scope="col" className="px-2 py-1.5 font-medium" colSpan={2}>
                        Original
                      </th>
                      <th scope="col" className="px-2 py-1.5 font-medium" colSpan={2}>
                        Changed
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item, index) =>
                      item.kind === 'gap' ? (
                        <tr key={`gap-${index}`} className="border-y border-border bg-muted">
                          <td colSpan={4} className="px-3 py-1 text-center text-xs text-muted-foreground">
                            ⋯ {formatNumber(item.count, 0)} unchanged line
                            {item.count === 1 ? '' : 's'} hidden
                          </td>
                        </tr>
                      ) : (
                        <tr key={`row-${index}`} className="align-top">
                          <LineNumber value={item.row.aNumber} />
                          <td
                            className={cn(
                              'w-1/2 max-w-0 whitespace-pre-wrap break-words px-2 py-0.5',
                              item.row.type === 'remove' || item.row.type === 'modify'
                                ? ROW_TONE.remove
                                : '',
                            )}
                          >
                            {item.row.aNumber !== null && (
                              <>
                                <span aria-hidden="true" className="mr-1 select-none text-muted-foreground">
                                  {item.row.type === 'equal' ? ' ' : '-'}
                                </span>
                                <Parts parts={item.row.aParts} text={item.row.aText} tone="remove" />
                              </>
                            )}
                          </td>
                          <LineNumber value={item.row.bNumber} />
                          <td
                            className={cn(
                              'w-1/2 max-w-0 whitespace-pre-wrap break-words px-2 py-0.5',
                              item.row.type === 'add' || item.row.type === 'modify' ? ROW_TONE.add : '',
                            )}
                          >
                            {item.row.bNumber !== null && (
                              <>
                                <span aria-hidden="true" className="mr-1 select-none text-muted-foreground">
                                  {item.row.type === 'equal' ? ' ' : '+'}
                                </span>
                                <Parts parts={item.row.bParts} text={item.row.bText} tone="add" />
                              </>
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </>
              ) : (
                <tbody>
                  {visible.map((item, index) => {
                    if (item.kind === 'gap') {
                      return (
                        <tr key={`gap-${index}`} className="border-y border-border bg-muted">
                          <td colSpan={3} className="px-3 py-1 text-center text-xs text-muted-foreground">
                            ⋯ {formatNumber(item.count, 0)} unchanged line
                            {item.count === 1 ? '' : 's'} hidden
                          </td>
                        </tr>
                      )
                    }
                    const row = item.row
                    const lines: { sign: string; text: string; parts: WordPart[] | null; tone: 'add' | 'remove'; number: number | null; cls: string }[] = []
                    if (row.type === 'equal') {
                      lines.push({ sign: ' ', text: row.aText, parts: null, tone: 'add', number: row.aNumber, cls: '' })
                    } else {
                      if (row.type === 'remove' || row.type === 'modify') {
                        lines.push({ sign: '-', text: row.aText, parts: row.aParts, tone: 'remove', number: row.aNumber, cls: ROW_TONE.remove })
                      }
                      if (row.type === 'add' || row.type === 'modify') {
                        lines.push({ sign: '+', text: row.bText, parts: row.bParts, tone: 'add', number: row.bNumber, cls: ROW_TONE.add })
                      }
                    }
                    return (
                      <Fragment key={`row-${index}`}>
                        {lines.map((line, k) => (
                          <tr key={k} className="align-top">
                            <LineNumber value={line.number} />
                            <td className={cn('w-6 select-none px-1 py-0.5 text-center text-muted-foreground', line.cls)}>
                              {line.sign}
                            </td>
                            <td className={cn('max-w-0 whitespace-pre-wrap break-words px-2 py-0.5', line.cls)}>
                              <Parts parts={line.parts} text={line.text} tone={line.tone} />
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </tbody>
              )}
            </table>
          </div>
          {truncated && (
            <p className="text-xs text-muted-foreground">
              Showing the first {formatNumber(MAX_RENDERED_ROWS, 0)} rows so the page stays
              responsive. Download the unified diff above to see everything.
            </p>
          )}
        </ToolPanel>
      )}
    </div>
  )
}
