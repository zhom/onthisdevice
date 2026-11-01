import { useMemo, useState } from 'react'
import { ArrowLeftRight, GitCompare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { CodePane, Field, Segmented, StatChips } from './DevUi'
import type { NormaliseOptions, SplitRow, UnifiedLine } from './difflib'
import {
  diffLines,
  normaliseLine,
  statsOf,
  toHunks,
  toSplitRows,
  toUnifiedPatch,
} from './difflib'
import { formatNumber } from '@/lib/utils'

type View = 'unified' | 'split'

const MAX_LINES = 12000

const SAMPLE_A = `function greet(name) {
  if (!name) {
    return "Hello, world!";
  }
  return "Hello, " + name + "!";
}

export default greet;`

const SAMPLE_B = `function greet(name, punctuation = "!") {
  if (!name) {
    return \`Hello, world\${punctuation}\`;
  }
  return \`Hello, \${name}\${punctuation}\`;
}

export { greet };
export default greet;`

function LineRow({ line }: { line: UnifiedLine }) {
  const marker = line.type === 'insert' ? '+' : line.type === 'delete' ? '-' : ' '
  const tone = line.type === 'insert' || line.type === 'delete' ? 'bg-background' : ''
  return (
    <div className={`flex items-start ${tone}`}>
      <span className="w-12 shrink-0 select-none border-r border-border px-2 text-right text-xs tabular-nums text-muted-foreground">
        {line.aNumber ?? ''}
      </span>
      <span className="w-12 shrink-0 select-none border-r border-border px-2 text-right text-xs tabular-nums text-muted-foreground">
        {line.bNumber ?? ''}
      </span>
      <span
        className={`w-5 shrink-0 select-none text-center font-mono text-xs ${
          line.type === 'insert' || line.type === 'delete'
            ? 'font-semibold text-foreground'
            : 'text-muted-foreground'
        }`}
        aria-hidden="true"
      >
        {marker}
      </span>
      <span
        className={`min-w-0 flex-1 whitespace-pre px-2 font-mono text-[13px] leading-6 ${
          line.type === 'delete' ? 'text-muted-foreground line-through' : ''
        }`}
      >
        {line.text === '' ? ' ' : line.text}
      </span>
    </div>
  )
}

function SplitRowView({ row }: { row: SplitRow }) {
  const leftChanged = Boolean(row.left) && row.type !== 'equal'
  const rightChanged = Boolean(row.right) && row.type !== 'equal'
  const leftTone = leftChanged ? 'bg-background' : ''
  const rightTone = rightChanged ? 'bg-background' : ''
  return (
    <div className="grid grid-cols-2 divide-x divide-border">
      <div className={`flex items-start ${leftTone}`}>
        <span className="w-12 shrink-0 select-none border-r border-border px-2 text-right text-xs tabular-nums text-muted-foreground">
          {row.left?.number ?? ''}
        </span>
        <span className="w-5 shrink-0 select-none text-center font-mono text-xs font-semibold text-foreground" aria-hidden="true">
          {leftChanged ? '-' : ''}
        </span>
        <span
          className={`min-w-0 flex-1 whitespace-pre px-2 font-mono text-[13px] leading-6 ${
            leftChanged ? 'text-muted-foreground line-through' : ''
          }`}
        >
          {row.left ? (row.left.text === '' ? ' ' : row.left.text) : ' '}
        </span>
      </div>
      <div className={`flex items-start ${rightTone}`}>
        <span className="w-12 shrink-0 select-none border-r border-border px-2 text-right text-xs tabular-nums text-muted-foreground">
          {row.right?.number ?? ''}
        </span>
        <span className="w-5 shrink-0 select-none text-center font-mono text-xs font-semibold text-foreground" aria-hidden="true">
          {rightChanged ? '+' : ''}
        </span>
        <span className="min-w-0 flex-1 whitespace-pre px-2 font-mono text-[13px] leading-6">
          {row.right ? (row.right.text === '' ? ' ' : row.right.text) : ' '}
        </span>
      </div>
    </div>
  )
}

export default function DiffCheckerCode() {
  const [original, setOriginal] = useState(SAMPLE_A)
  const [modified, setModified] = useState(SAMPLE_B)
  const [oldName, setOldName] = useState('greet.js')
  const [newName, setNewName] = useState('greet.js')
  const [view, setView] = useState<View>('unified')
  const [context, setContext] = useState('3')

  const [ignoreLeading, setIgnoreLeading] = useState(false)
  const [ignoreTrailing, setIgnoreTrailing] = useState(true)
  const [collapseWhitespace, setCollapseWhitespace] = useState(false)
  const [ignoreCase, setIgnoreCase] = useState(false)

  const options = useMemo<NormaliseOptions>(
    () => ({
      ignoreLeadingWhitespace: ignoreLeading,
      ignoreTrailingWhitespace: ignoreTrailing,
      collapseWhitespace,
      ignoreCase,
    }),
    [ignoreLeading, ignoreTrailing, collapseWhitespace, ignoreCase],
  )

  const aLines = useMemo(() => original.split('\n'), [original])
  const bLines = useMemo(() => modified.split('\n'), [modified])
  const tooLarge = aLines.length > MAX_LINES || bLines.length > MAX_LINES

  const ops = useMemo(() => {
    if (tooLarge) return []
    const aKeys = aLines.map((line) => normaliseLine(line, options))
    const bKeys = bLines.map((line) => normaliseLine(line, options))
    return diffLines(aKeys, bKeys)
  }, [aLines, bLines, options, tooLarge])

  const stats = useMemo(() => statsOf(ops), [ops])

  const contextLines = context === 'all' ? Number.MAX_SAFE_INTEGER : Number(context)
  const hunks = useMemo(() => toHunks(ops, aLines, bLines, contextLines), [ops, aLines, bLines, contextLines])
  const splitRows = useMemo(() => toSplitRows(ops, aLines, bLines), [ops, aLines, bLines])
  const patch = useMemo(
    () => toUnifiedPatch(hunks, oldName || 'original', newName || 'modified'),
    [hunks, oldName, newName],
  )
  const patchBlob = useMemo(
    () => (patch ? new Blob([patch], { type: 'text/x-patch;charset=utf-8' }) : null),
    [patch],
  )

  const identical = stats.additions === 0 && stats.deletions === 0

  return (
    <div className="flex flex-col gap-4">
      <ToolPanel
        title="Paste the two versions"
        description="Both sides stay in your browser, so unreleased or proprietary source is safe to compare here."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Field label="Original file name" htmlFor="diff-old-name">
              <Input
                id="diff-old-name"
                value={oldName}
                onChange={(event) => setOldName(event.target.value)}
                className="font-mono text-[13px]"
                spellCheck={false}
              />
            </Field>
            <CodePane
              label="Original"
              value={original}
              onChange={setOriginal}
              rows={14}
              wrap={false}
              copyable
              placeholder="Paste the original code…"
              footer={`${formatNumber(aLines.length, 0)} lines`}
            />
          </div>
          <div className="flex flex-col gap-3">
            <Field label="Modified file name" htmlFor="diff-new-name">
              <Input
                id="diff-new-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="font-mono text-[13px]"
                spellCheck={false}
              />
            </Field>
            <CodePane
              label="Modified"
              value={modified}
              onChange={setModified}
              rows={14}
              wrap={false}
              copyable
              placeholder="Paste the changed code…"
              footer={`${formatNumber(bLines.length, 0)} lines`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setOriginal(modified)
              setModified(original)
              setOldName(newName)
              setNewName(oldName)
            }}
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            Swap sides
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setOriginal('')
              setModified('')
            }}
          >
            Clear both
          </Button>
        </div>

        <fieldset className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-muted p-3">
          <legend className="px-1 text-sm font-medium">Ignore</legend>
          {(
            [
              ['diff-ignore-leading', 'Leading whitespace', ignoreLeading, setIgnoreLeading],
              ['diff-ignore-trailing', 'Trailing whitespace', ignoreTrailing, setIgnoreTrailing],
              ['diff-collapse', 'Repeated spaces and tabs', collapseWhitespace, setCollapseWhitespace],
              ['diff-ignore-case', 'Letter case', ignoreCase, setIgnoreCase],
            ] as [string, string, boolean, (v: boolean) => void][]
          ).map(([id, label, value, setter]) => (
            <div key={id} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={value}
                onCheckedChange={(checked) => setter(checked === true)}
              />
              <Label htmlFor={id} className="text-sm font-normal">
                {label}
              </Label>
            </div>
          ))}
        </fieldset>
      </ToolPanel>

      {tooLarge ? (
        <ErrorNote
          title="That is a lot of code"
          message={`Each side is capped at ${formatNumber(MAX_LINES, 0)} lines so the diff stays fast. Compare a smaller region, or split the files first.`}
        />
      ) : (
        <ToolPanel
          title="Differences"
          description="Line numbers are shown for both sides. Additions and deletions are marked with + and − as well as colour."
          footer={
            patch ? (
              <>
                <CopyButton value={patch} label="Copy unified patch" variant="default" />
                <DownloadButton blob={patchBlob} filename={`${oldName || 'changes'}.patch`} label="Download .patch" variant="outline" />
              </>
            ) : null
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'unified', label: 'Unified' },
                { value: 'split', label: 'Side by side' },
              ]}
            />
            {view === 'unified' ? (
              <Field label="Context lines" htmlFor="diff-context" className="sm:w-44">
                <Select value={context} onValueChange={setContext}>
                  <SelectTrigger id="diff-context">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 (changes only)</SelectItem>
                    <SelectItem value="1">1 line</SelectItem>
                    <SelectItem value="3">3 lines (git default)</SelectItem>
                    <SelectItem value="5">5 lines</SelectItem>
                    <SelectItem value="10">10 lines</SelectItem>
                    <SelectItem value="all">Whole file</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
            {identical ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <GitCompare className="size-4 shrink-0" aria-hidden="true" />
                The two versions are identical under the current options
              </p>
            ) : (
              <StatChips
                items={[
                  { label: 'Added', value: `+${formatNumber(stats.additions, 0)}` },
                  { label: 'Removed', value: `−${formatNumber(stats.deletions, 0)}` },
                  { label: 'Unchanged', value: formatNumber(stats.unchanged, 0) },
                  { label: 'Similarity', value: `${stats.similarity.toFixed(1)}%` },
                  { label: 'Hunks', value: formatNumber(hunks.length, 0) },
                ]}
              />
            )}
          </div>

          {identical ? null : view === 'unified' ? (
            <div className="overflow-x-auto rounded-lg">
              <div className="min-w-max">
                {hunks.map((hunk, index) => (
                  <div key={index}>
                    <div className="bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                      @@ -{hunk.aStart},{hunk.aCount} +{hunk.bStart},{hunk.bCount} @@
                    </div>
                    {hunk.lines.map((line, i) => (
                      <LineRow key={i} line={line} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg">
              <div className="min-w-max">
                <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-muted text-xs font-medium">
                  <div className="px-2 py-1 font-mono">{oldName || 'original'}</div>
                  <div className="px-2 py-1 font-mono">{newName || 'modified'}</div>
                </div>
                {splitRows.map((row, index) => (
                  <SplitRowView key={index} row={row} />
                ))}
              </div>
            </div>
          )}
        </ToolPanel>
      )}
    </div>
  )
}
