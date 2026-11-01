import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  CircleCheck,
  ClipboardPaste,
  Columns3,
  Plus,
  RotateCcw,
  Rows3,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { DfCodePane, DfProofPanel, DfSegmented, DfStatChips, DfStatus } from '../dev/dev-format-ui'
import {
  CSV_SAMPLE,
  DEFAULT_TABLE_OPTIONS,
  HTML_TABLE_SAMPLE,
  MARKDOWN_TABLE_SAMPLE,
  emptyGrid,
  normaliseGrid,
  parseAnything,
  parseDelimited,
  parseHtmlTable,
  parseMarkdownTable,
  toCsv,
  toHtmlTable,
  toJsonRecords,
  toMarkdownTable,
  type Align,
  type Grid,
} from './dev-format-table'
import { cn } from '@/lib/utils'

export type TableMode = 'grid' | 'csv-to-md' | 'html-to-md' | 'md-to-csv'
type OutputFormat = 'markdown' | 'csv' | 'html' | 'json'

export interface DevFormatMarkdownTableProps {
  mode?: TableMode
}

const STORAGE_KEY = 'otd:markdown-table:v1'

const COPY: Record<TableMode, { title: string; description: string; inputLabel: string }> = {
  grid: {
    title: 'Markdown table generator',
    description:
      'Fill in the grid, or paste a block from Excel, Google Sheets, a CSV file or an HTML page, and the columns are detected automatically. The Markdown updates as you type.',
    inputLabel: 'Paste a table (CSV, TSV, HTML or Markdown)',
  },
  'csv-to-md': {
    title: 'CSV to Markdown table',
    description:
      'Paste comma, tab, semicolon or pipe separated values and get a properly aligned GFM table. Quoted fields containing commas are handled correctly.',
    inputLabel: 'CSV / TSV input',
  },
  'html-to-md': {
    title: 'HTML table to Markdown',
    description:
      'Paste an HTML <table> copied from a page, an email or a CMS, and get clean Markdown with the align attributes carried over into the separator row.',
    inputLabel: 'HTML input',
  },
  'md-to-csv': {
    title: 'Markdown table to CSV',
    description:
      'Turn a GFM pipe table back into CSV you can open in Excel, Numbers or a spreadsheet, with escaped pipes restored and alignment markers stripped.',
    inputLabel: 'Markdown table input',
  },
}

const OUTPUT_FOR_MODE: Record<TableMode, OutputFormat> = {
  grid: 'markdown',
  'csv-to-md': 'markdown',
  'html-to-md': 'markdown',
  'md-to-csv': 'csv',
}

const SAMPLE_FOR_MODE: Record<TableMode, string> = {
  grid: CSV_SAMPLE,
  'csv-to-md': CSV_SAMPLE,
  'html-to-md': HTML_TABLE_SAMPLE,
  'md-to-csv': MARKDOWN_TABLE_SAMPLE,
}

const ALIGN_ICONS: Record<Align, typeof AlignLeft> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
}

export default function DevFormatMarkdownTable({ mode = 'grid' }: DevFormatMarkdownTableProps) {
  const [grid, setGrid] = useState<Grid>(() => emptyGrid())
  const [pasteText, setPasteText] = useState('')
  const [detected, setDetected] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [output, setOutput] = useState<OutputFormat>(OUTPUT_FOR_MODE[mode])
  const [pad, setPad] = useState(true)
  const [outerPipes, setOuterPipes] = useState(true)
  const [headerRow, setHeaderRow] = useState(true)
  const [csvDelimiter, setCsvDelimiter] = useState(',')
  const [saved, setSaved] = useState(false)

  const copy = COPY[mode]

  /* Restore an in-progress grid only when the visitor opted in previously. */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed: unknown = JSON.parse(stored)
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as Grid).rows) &&
        Array.isArray((parsed as Grid).aligns)
      ) {
        setGrid(normaliseGrid((parsed as Grid).rows, (parsed as Grid).aligns))
        setSaved(true)
      }
    } catch {
      /* corrupt or unavailable storage — start from a blank grid */
    }
  }, [])

  useEffect(() => {
    if (!saved) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(grid))
    } catch {
      /* quota exceeded — the grid still works in memory */
    }
  }, [grid, saved])

  const ingest = useCallback(
    (text: string) => {
      setPasteText(text)
      if (text.trim() === '') {
        setDetected(null)
        setParseError(null)
        return
      }
      const outcome =
        mode === 'csv-to-md'
          ? parseDelimited(text)
          : mode === 'html-to-md'
            ? parseHtmlTable(text)
            : mode === 'md-to-csv'
              ? parseMarkdownTable(text)
              : parseAnything(text)

      if (!outcome) {
        setDetected(null)
        setParseError(
          mode === 'html-to-md'
            ? 'No <table> element found. Paste the table markup itself, including the opening <table> tag. A screenshot or a rendered copy will not work.'
            : mode === 'md-to-csv'
              ? 'That is not a GFM table. A Markdown table needs a header row followed by a separator row of dashes, for example: | A | B | then | --- | --- |.'
              : 'The columns could not be detected. Check that every row uses the same separator.',
        )
        return
      }
      setParseError(null)
      setDetected(outcome.source)
      setGrid(outcome.grid)
    },
    [mode],
  )

  const setCell = useCallback((row: number, column: number, value: string) => {
    setGrid((current) => {
      const rows = current.rows.map((r) => r.slice())
      rows[row][column] = value
      return { ...current, rows }
    })
  }, [])

  const addRow = useCallback(() => {
    setGrid((current) => ({
      ...current,
      rows: [...current.rows, current.aligns.map(() => '')],
    }))
  }, [])

  const addColumn = useCallback(() => {
    setGrid((current) => ({
      rows: current.rows.map((row, i) => [...row, i === 0 ? `Column ${row.length + 1}` : '']),
      aligns: [...current.aligns, 'left'],
    }))
  }, [])

  const removeRow = useCallback((index: number) => {
    setGrid((current) =>
      current.rows.length <= 1
        ? current
        : { ...current, rows: current.rows.filter((_, i) => i !== index) },
    )
  }, [])

  const removeColumn = useCallback((index: number) => {
    setGrid((current) =>
      current.aligns.length <= 1
        ? current
        : {
            rows: current.rows.map((row) => row.filter((_, i) => i !== index)),
            aligns: current.aligns.filter((_, i) => i !== index),
          },
    )
  }, [])

  const cycleAlign = useCallback((index: number) => {
    setGrid((current) => {
      const order: Align[] = ['left', 'center', 'right']
      const next = order[(order.indexOf(current.aligns[index]) + 1) % order.length]
      const aligns = current.aligns.slice()
      aligns[index] = next
      return { ...current, aligns }
    })
  }, [])

  const rendered = useMemo(() => {
    switch (output) {
      case 'markdown':
        return toMarkdownTable(grid, { ...DEFAULT_TABLE_OPTIONS, pad, outerPipes, headerRow })
      case 'csv':
        return toCsv(grid, csvDelimiter === 'tab' ? '\t' : csvDelimiter)
      case 'html':
        return toHtmlTable(grid, headerRow)
      case 'json':
        return toJsonRecords(grid)
      default:
        return ''
    }
  }, [csvDelimiter, grid, headerRow, outerPipes, output, pad])

  const blob = useMemo(() => {
    const types: Record<OutputFormat, string> = {
      markdown: 'text/markdown',
      csv: 'text/csv',
      html: 'text/html',
      json: 'application/json',
    }
    return rendered ? new Blob([rendered], { type: types[output] }) : null
  }, [output, rendered])

  const filenames: Record<OutputFormat, string> = {
    markdown: 'table.md',
    csv: 'table.csv',
    html: 'table.html',
    json: 'table.json',
  }

  return (
    <div className="space-y-6">
      <ToolPanel title={copy.title} description={copy.description}>
        <div className="flex flex-col gap-2">
          <DfCodePane
            label={copy.inputLabel}
            id="table-paste"
            value={pasteText}
            onChange={ingest}
            rows={8}
            wrap={false}
            placeholder={
              mode === 'html-to-md'
                ? '<table><tr><th>A</th><th>B</th></tr>…</table>'
                : mode === 'md-to-csv'
                  ? '| A | B |\n| --- | --- |\n| 1 | 2 |'
                  : 'Region,Revenue\nEMEA,412000'
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => ingest(SAMPLE_FOR_MODE[mode])}
              className="gap-2"
            >
              <ClipboardPaste className="size-4" aria-hidden="true" />
              Load sample
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pasteText === ''}
              onClick={() => ingest('')}
              className="gap-2"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Clear input
            </Button>
            {detected ? (
              <span
                role="status"
                aria-live="polite"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground"
              >
                <CircleCheck className="size-3.5 shrink-0" aria-hidden="true" />
                Detected {detected}: {grid.rows.length} rows × {grid.aligns.length} columns
              </span>
            ) : null}
          </div>
          {parseError ? <DfStatus ok={false}>{parseError}</DfStatus> : null}
        </div>
      </ToolPanel>

      <ToolPanel
        title="Edit the grid"
        description="Every cell is a real input, so this works from the keyboard: Tab moves across, Shift+Tab moves back. Click a column header's alignment button to cycle left, centre and right."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-separate border-spacing-1">
            <caption className="sr-only">Editable table grid</caption>
            <thead>
              <tr>
                <th scope="col" className="w-8">
                  <span className="sr-only">Row actions</span>
                </th>
                {grid.aligns.map((align, column) => {
                  const Glyph = ALIGN_ICONS[align]
                  return (
                    <th key={column} scope="col" className="min-w-[8rem]">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7 shrink-0"
                          aria-label={`Column ${column + 1} alignment: ${align}. Click to change.`}
                          onClick={() => cycleAlign(column)}
                        >
                          <Glyph className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          aria-label={`Delete column ${column + 1}`}
                          onClick={() => removeColumn(column)}
                          disabled={grid.aligns.length <= 1}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <th scope="row" className="align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={
                        rowIndex === 0 ? 'Delete the header row' : `Delete row ${rowIndex}`
                      }
                      onClick={() => removeRow(rowIndex)}
                      disabled={grid.rows.length <= 1}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </th>
                  {row.map((cell, columnIndex) => (
                    <td key={columnIndex}>
                      <Input
                        value={cell}
                        onChange={(event) => setCell(rowIndex, columnIndex, event.target.value)}
                        aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                        className={cn(
                          'h-9',
                          rowIndex === 0 && headerRow && 'font-semibold',
                          grid.aligns[columnIndex] === 'center' && 'text-center',
                          grid.aligns[columnIndex] === 'right' && 'text-right',
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-2">
            <Rows3 className="size-4" aria-hidden="true" />
            <Plus className="size-3" aria-hidden="true" />
            Add row
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addColumn} className="gap-2">
            <Columns3 className="size-4" aria-hidden="true" />
            <Plus className="size-3" aria-hidden="true" />
            Add column
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setGrid(emptyGrid())}
            className="gap-2"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset grid
          </Button>
          <div className="ml-auto flex items-center gap-3">
            <Switch
              id="table-save"
              checked={saved}
              onCheckedChange={(checked) => {
                setSaved(checked)
                if (!checked) {
                  try {
                    localStorage.removeItem(STORAGE_KEY)
                  } catch {
                    /* already gone */
                  }
                }
              }}
            />
            <Label htmlFor="table-save" className="text-sm">
              Keep this table on this device
            </Label>
          </div>
        </div>

        <DfStatChips
          items={[
            { label: 'Rows', value: String(grid.rows.length) },
            { label: 'Columns', value: String(grid.aligns.length) },
            {
              label: 'Cells filled',
              value: String(grid.rows.flat().filter((cell) => cell.trim() !== '').length),
            },
          ]}
        />
      </ToolPanel>

      <ToolPanel title="Output" description="Switch format at any time. The output always follows the grid above.">
        <DfSegmented
          label="Output format"
          value={output}
          onChange={setOutput}
          options={[
            { value: 'markdown', label: 'Markdown' },
            { value: 'csv', label: 'CSV' },
            { value: 'html', label: 'HTML' },
            { value: 'json', label: 'JSON' },
          ]}
        />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <Switch id="table-header" checked={headerRow} onCheckedChange={setHeaderRow} />
            <Label htmlFor="table-header" className="text-sm">
              First row is a header
            </Label>
          </div>
          {output === 'markdown' ? (
            <>
              <div className="flex items-center gap-3">
                <Switch id="table-pad" checked={pad} onCheckedChange={setPad} />
                <Label htmlFor="table-pad" className="text-sm">
                  Pad cells so the pipes line up
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="table-pipes" checked={outerPipes} onCheckedChange={setOuterPipes} />
                <Label htmlFor="table-pipes" className="text-sm">
                  Outer pipes
                </Label>
              </div>
            </>
          ) : null}
          {output === 'csv' ? (
            <div className="flex items-center gap-2">
              <Label htmlFor="table-delim" className="text-sm">
                Delimiter
              </Label>
              <select
                id="table-delim"
                value={csvDelimiter}
                onChange={(event) => setCsvDelimiter(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value=",">Comma</option>
                <option value=";">Semicolon</option>
                <option value="tab">Tab</option>
                <option value="|">Pipe</option>
              </select>
            </div>
          ) : null}
        </div>

        <DfCodePane
          label={
            output === 'markdown'
              ? 'Markdown'
              : output === 'csv'
                ? 'CSV'
                : output === 'html'
                  ? 'HTML'
                  : 'JSON records'
          }
          value={rendered}
          readOnly
          rows={12}
          wrap={false}
        />

        <div className="flex flex-wrap gap-2">
          <CopyButton value={rendered} label="Copy output" />
          <DownloadButton blob={blob} filename={filenames[output]} label="Download" />
        </div>
      </ToolPanel>

      <DfProofPanel subject="table" />
    </div>
  )
}
