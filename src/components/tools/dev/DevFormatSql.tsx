import { useCallback, useMemo, useRef, useState } from 'react'
import { AlignLeft, FileUp, Minimize2, RotateCcw, TriangleAlert, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { CopyButton } from '@/components/shared/CopyButton'
import {
  DfCodePane,
  DfField,
  DfProofPanel,
  DfSegmented,
  DfStatChips,
  readTextFile,
} from './dev-format-ui'
import {
  DEFAULT_SQL_OPTIONS,
  SQL_DIALECTS,
  SQL_SAMPLE,
  formatSql,
  minifySql,
  type KeywordCase,
  type SqlDialect,
} from './dev-format-sql'
import { formatBytes } from '@/lib/utils'

export interface DevFormatSqlProps {
  /** `minify` presets the tool for the sql-minify page. */
  mode?: 'format' | 'minify'
}

type IndentKey = '2' | '4' | 'tab'

const INDENTS: { value: IndentKey; label: string }[] = [
  { value: '2', label: '2 spaces' },
  { value: '4', label: '4 spaces' },
  { value: 'tab', label: 'Tab' },
]

const CASES: { value: KeywordCase; label: string }[] = [
  { value: 'upper', label: 'UPPER' },
  { value: 'lower', label: 'lower' },
  { value: 'preserve', label: 'As typed' },
]

export default function DevFormatSql({ mode = 'format' }: DevFormatSqlProps) {
  const [input, setInput] = useState('')
  const [dialect, setDialect] = useState<SqlDialect>('postgresql')
  const [keywordCase, setKeywordCase] = useState<KeywordCase>(mode === 'minify' ? 'preserve' : 'upper')
  const [indent, setIndent] = useState<IndentKey>('2')
  const [expandColumns, setExpandColumns] = useState(true)
  const [blankLines, setBlankLines] = useState(true)
  const [stripComments, setStripComments] = useState(true)
  const [action, setAction] = useState<'format' | 'minify'>(mode)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const result = useMemo(() => {
    if (input.trim() === '') return null
    try {
      if (action === 'minify') {
        const minified = minifySql(input, { dialect, stripComments, keywordCase })
        return {
          text: minified.sql,
          notes: [] as string[],
          chips: [
            { label: 'Before', value: formatBytes(minified.before) },
            { label: 'After', value: formatBytes(minified.after) },
            {
              label: 'Saved',
              value:
                minified.before > 0
                  ? `${Math.round((1 - minified.after / minified.before) * 100)}%`
                  : '0%',
            },
            { label: 'Comments removed', value: String(minified.removedComments) },
          ],
        }
      }
      const formatted = formatSql(input, {
        ...DEFAULT_SQL_OPTIONS,
        dialect,
        keywordCase,
        indent: indent === 'tab' ? 0 : Number(indent),
        expandColumns,
        blankLineBetweenStatements: blankLines,
      })
      return {
        text: formatted.sql,
        notes: formatted.notes,
        chips: [
          { label: 'Statements', value: String(formatted.statements) },
          { label: 'Tokens', value: String(formatted.tokens) },
          { label: 'Lines', value: String(formatted.sql.split('\n').length) },
          { label: 'Size', value: formatBytes(formatted.sql.length) },
        ],
      }
    } catch (caught) {
      return {
        text: '',
        notes: [
          `This query could not be laid out: ${
            caught instanceof Error ? caught.message : String(caught)
          }. Your input is unchanged. Copy it back out of the left pane.`,
        ],
        chips: [] as { label: string; value: string }[],
      }
    }
  }, [action, blankLines, dialect, expandColumns, indent, input, keywordCase, stripComments])

  const output = result?.text ?? ''

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      setInput(await readTextFile(file, 8 * 1024 * 1024))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That file could not be read as text.')
    }
  }, [])

  const blob = useMemo(
    () => (output ? new Blob([output], { type: 'application/sql' }) : null),
    [output],
  )

  const dialectInfo = SQL_DIALECTS.find((d) => d.id === dialect)

  return (
    <div className="space-y-6">
      <ToolPanel
        title={action === 'minify' ? 'Minify SQL' : 'Format SQL'}
        description={
          action === 'minify'
            ? 'Collapse a query onto one line for a config file, an environment variable or a log entry. Only whitespace is removed. No token is changed.'
            : 'Paste a query and it reformats as you type. Nothing is sent anywhere, so it is safe to paste production SQL with real table and column names.'
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <DfSegmented
            label="Output mode"
            value={action}
            onChange={setAction}
            options={[
              { value: 'format', label: 'Beautify' },
              { value: 'minify', label: 'Minify' },
            ]}
            className="sm:w-auto"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp className="size-4" aria-hidden="true" />
              Load .sql file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".sql,.txt,text/plain"
              className="sr-only"
              aria-label="Load a SQL file"
              onChange={(event) => {
                void onFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setInput(SQL_SAMPLE)}>
              <Wand2 className="size-4" aria-hidden="true" />
              Load sample
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setInput('')
                setError(null)
              }}
              disabled={input === ''}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Clear
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DfField label="SQL dialect" htmlFor="sql-dialect" hint={dialectInfo?.note}>
            <Select value={dialect} onValueChange={(value) => setDialect(value as SqlDialect)}>
              <SelectTrigger id="sql-dialect" className="w-full">
                <SelectValue placeholder="Choose a dialect" />
              </SelectTrigger>
              <SelectContent>
                {SQL_DIALECTS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DfField>

          <DfField label="Keyword case" htmlFor="sql-case">
            <Select
              value={keywordCase}
              onValueChange={(value) => setKeywordCase(value as KeywordCase)}
            >
              <SelectTrigger id="sql-case" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CASES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DfField>

          {action === 'format' ? (
            <DfField label="Indent" htmlFor="sql-indent">
              <Select value={indent} onValueChange={(value) => setIndent(value as IndentKey)}>
                <SelectTrigger id="sql-indent" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDENTS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DfField>
          ) : (
            <div className="flex items-center gap-3 self-end pb-1">
              <Switch
                id="sql-strip-comments"
                checked={stripComments}
                onCheckedChange={setStripComments}
              />
              <Label htmlFor="sql-strip-comments" className="text-sm">
                Remove comments
              </Label>
            </div>
          )}

          {action === 'format' ? (
            <div className="flex flex-col gap-3 self-end pb-1">
              <div className="flex items-center gap-3">
                <Switch
                  id="sql-expand"
                  checked={expandColumns}
                  onCheckedChange={setExpandColumns}
                />
                <Label htmlFor="sql-expand" className="text-sm">
                  One column per line
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="sql-blank" checked={blankLines} onCheckedChange={setBlankLines} />
                <Label htmlFor="sql-blank" className="text-sm">
                  Blank line between statements
                </Label>
              </div>
            </div>
          ) : null}
        </div>

        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <DfCodePane
            label="Your SQL"
            value={input}
            onChange={setInput}
            rows={16}
            wrap={false}
            placeholder="SELECT id, email FROM users WHERE created_at > now() - interval '7 days';"
          />
          <DfCodePane
            label={action === 'minify' ? 'Minified' : 'Formatted'}
            value={output}
            readOnly
            rows={16}
            wrap={action === 'minify'}
            actions={
              output ? (
                <DownloadButton
                  blob={blob}
                  filename={action === 'minify' ? 'query.min.sql' : 'query.sql'}
                  label="Download"
                  variant="outline"
                  size="sm"
                />
              ) : null
            }
            placeholder="The formatted query appears here."
          />
        </div>

        {result ? <DfStatChips items={result.chips} /> : null}

        {result?.notes.length ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
          >
            {result.notes.map((note) => (
              <p key={note} className="flex items-start gap-2 text-pretty">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">{note}</span>
              </p>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <CopyButton value={output} label="Copy result" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={output === ''}
            onClick={() => setInput(output)}
            className="gap-2"
          >
            {action === 'minify' ? (
              <Minimize2 className="size-4" aria-hidden="true" />
            ) : (
              <AlignLeft className="size-4" aria-hidden="true" />
            )}
            Replace input with result
          </Button>
        </div>
      </ToolPanel>

      <DfProofPanel subject="SQL" />
    </div>
  )
}
