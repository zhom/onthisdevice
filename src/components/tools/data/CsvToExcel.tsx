import * as React from 'react'
import Papa from 'papaparse'
import { FileSpreadsheet, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { downloadBlob, formatBytes, nextFrame } from '@/lib/utils'

import { DELIMITERS, delimiterChar, delimiterLabel } from './datautil'
import { EditorPane, Field, IssueAlert, Pane, StatChips, ToggleRow, type Issue } from './ui'
import { autoColumnWidths, loadSheetJs, safeFileStem, safeSheetName } from './workbook'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const SAMPLE = `Product,SKU,Units sold,Unit price,Restock date,In stock
Mechanical keyboard,KB-1001,412,89.99,2026-09-01,true
27" monitor,MN-2210,138,249.00,2026-08-24,true
USB-C dock,DK-3050,0,129.50,2026-10-12,false
Desk mat,DM-0440,1290,24.95,2026-08-19,true`

const NUMBER_RE = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/

type Cell = string | number | boolean | null

function coerce(raw: string, inferTypes: boolean): Cell {
  if (!inferTypes) return raw
  const t = raw.trim()
  if (t === '') return ''
  if (t === 'true' || t === 'TRUE' || t === 'True') return true
  if (t === 'false' || t === 'FALSE' || t === 'False') return false
  if (NUMBER_RE.test(t) && t.replace(/[^0-9]/g, '').length <= 15 && !/^-?0\d/.test(t)) {
    const n = Number(t)
    if (Number.isFinite(n)) return n
  }
  return raw
}

export default function CsvToExcel() {
  const [input, setInput] = React.useState('')
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [readError, setReadError] = React.useState<string | null>(null)
  const [building, setBuilding] = React.useState(false)
  const [buildError, setBuildError] = React.useState<string | null>(null)

  const [delimiter, setDelimiter] = React.useState('auto')
  const [hasHeader, setHasHeader] = React.useState(true)
  const [inferTypes, setInferTypes] = React.useState(true)
  const [trimValues, setTrimValues] = React.useState(true)
  const [autoWidth, setAutoWidth] = React.useState(true)
  const [autoFilter, setAutoFilter] = React.useState(true)
  const [sheetName, setSheetName] = React.useState('Sheet1')

  const parsed = React.useMemo(() => {
    if (input.trim() === '') return { rows: [] as Cell[][], issue: null as Issue | null, detected: ',' }
    const result = Papa.parse<string[]>(input, {
      delimiter: delimiter === 'auto' ? '' : delimiterChar(delimiter),
      skipEmptyLines: 'greedy',
      header: false,
    })
    const fatal = result.errors.find((e) => e.code !== 'UndetectableDelimiter')
    if (fatal && result.data.length === 0) {
      return {
        rows: [] as Cell[][],
        issue: {
          message: fatal.message,
          line: typeof fatal.row === 'number' ? fatal.row + 1 : undefined,
          snippet: typeof fatal.row === 'number' ? input.split('\n')[fatal.row] : undefined,
        } as Issue,
        detected: result.meta.delimiter || ',',
      }
    }
    const rows = result.data
      .filter((r) => Array.isArray(r))
      .map((r) => r.map((c) => coerce(trimValues ? String(c ?? '').trim() : String(c ?? ''), inferTypes)))
    return { rows, issue: null as Issue | null, detected: result.meta.delimiter || ',' }
  }, [input, delimiter, inferTypes, trimValues])

  const build = React.useCallback(async () => {
    if (parsed.rows.length === 0) return
    setBuilding(true)
    setBuildError(null)
    try {
      await nextFrame()
      const XLSX = await loadSheetJs()
      const sheet = XLSX.utils.aoa_to_sheet(parsed.rows)
      if (autoWidth) sheet['!cols'] = autoColumnWidths(parsed.rows)
      const width = parsed.rows.reduce((acc, r) => Math.max(acc, r.length), 0)
      if (hasHeader && autoFilter && width > 0) {
        sheet['!autofilter'] = {
          ref: XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: Math.max(parsed.rows.length - 1, 0), c: Math.max(width - 1, 0) },
          }),
        }
      }
      const book = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(book, sheet, safeSheetName(sheetName))
      const data = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
      const blob = new Blob([data], { type: XLSX_MIME })
      const stem = fileName ? fileName.replace(/\.[^.]+$/, '') : 'spreadsheet'
      downloadBlob(blob, `${safeFileStem(stem)}.xlsx`)
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : 'The workbook could not be created.')
    } finally {
      setBuilding(false)
    }
  }, [parsed.rows, autoWidth, autoFilter, hasHeader, sheetName, fileName])

  const preview = parsed.rows.slice(0, 12).map((r) => r.slice(0, 12))
  const columns = parsed.rows.reduce((acc, r) => Math.max(acc, r.length), 0)
  const dataRows = hasHeader ? Math.max(parsed.rows.length - 1, 0) : parsed.rows.length

  return (
    <div className="space-y-4">
      <ToolPanel
        title="Workbook options"
        description="Your browser generates the .xlsx file. The data stays on this device."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="c2x-delimiter" label="Input delimiter">
            <Select value={delimiter} onValueChange={setDelimiter}>
              <SelectTrigger id="c2x-delimiter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIMITERS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="c2x-sheetname" label="Sheet name" hint="Up to 31 characters; : \ / ? * [ ] are replaced.">
            <Input
              id="c2x-sheetname"
              value={sheetName}
              maxLength={31}
              onChange={(e) => setSheetName(e.currentTarget.value)}
              placeholder="Sheet1"
            />
          </Field>
          <div className="flex items-end">
            <Button
              type="button"
              className="w-full"
              disabled={parsed.rows.length === 0 || building}
              onClick={() => void build()}
            >
              {building ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileSpreadsheet className="size-4" aria-hidden="true" />
              )}
              {building ? 'Building workbook…' : 'Download .xlsx'}
            </Button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <ToggleRow
            id="c2x-header"
            label="First row is a header"
            hint="Enables the autofilter and frozen top row."
            checked={hasHeader}
            onCheckedChange={setHasHeader}
          />
          <ToggleRow
            id="c2x-types"
            label="Convert numbers and booleans"
            hint="Off keeps every cell as text, preserving leading zeros."
            checked={inferTypes}
            onCheckedChange={setInferTypes}
          />
          <ToggleRow
            id="c2x-trim"
            label="Trim whitespace"
            checked={trimValues}
            onCheckedChange={setTrimValues}
          />
          <ToggleRow
            id="c2x-width"
            label="Auto-fit column widths"
            checked={autoWidth}
            onCheckedChange={setAutoWidth}
          />
          <ToggleRow
            id="c2x-filter"
            label="Add an autofilter"
            hint="Adds the sort and filter arrows to the header row."
            checked={autoFilter}
            onCheckedChange={setAutoFilter}
          />
        </div>
      </ToolPanel>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <EditorPane
          id="c2x-input"
          title="CSV input"
          value={input}
          onChange={(v) => {
            setReadError(null)
            setInput(v)
          }}
          placeholder="Paste CSV here, or drop a .csv / .tsv file…"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          sample={SAMPLE}
          sampleLabel="Sample CSV"
          fileName={fileName}
          onFileName={setFileName}
          issue={readError ? { message: readError } : parsed.issue}
          onError={setReadError}
        />

        <Pane
          title="Workbook preview"
          subtitle={parsed.rows.length > 0 ? `first ${Math.min(12, parsed.rows.length)} rows` : undefined}
          actions={
            <Button
              type="button"
              size="sm"
              disabled={parsed.rows.length === 0 || building}
              onClick={() => void build()}
            >
              {building ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <FileSpreadsheet className="size-3.5" aria-hidden="true" />
              )}
              Download .xlsx
            </Button>
          }
        >
          {parsed.rows.length === 0 ? (
            <p className="grid min-h-[16rem] place-items-center rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
              Paste or drop a CSV and the sheet preview appears here.
            </p>
          ) : (
            <div className="min-w-0 overflow-x-auto rounded-lg bg-background">
              <table className="w-full min-w-max border-collapse text-left text-xs">
                <caption className="sr-only">Preview of the worksheet that will be written</caption>
                {hasHeader && preview[0] ? (
                  <thead>
                    <tr className="bg-muted font-medium">
                      <th scope="col" className="border px-2 py-1 text-right font-mono text-[10px] text-muted-foreground">
                        1
                      </th>
                      {preview[0].map((cell, c) => (
                        <th key={c} scope="col" className="max-w-[14rem] truncate border px-2 py-1 align-top">
                          {cell === null ? '' : String(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {(hasHeader ? preview.slice(1) : preview).map((row, r) => (
                    <tr key={r}>
                      <td className="border px-2 py-1 text-right font-mono text-[10px] text-muted-foreground">
                        {r + 1 + (hasHeader ? 1 : 0)}
                      </td>
                      {row.map((cell, c) => (
                        <td
                          key={c}
                          className={`max-w-[14rem] truncate border px-2 py-1 align-top ${
                            typeof cell === 'number' ? 'text-right tabular-nums' : ''
                          }`}
                        >
                          {cell === null ? '' : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {parsed.rows.length > 0 ? (
            <StatChips
              stats={[
                { label: 'data rows', value: dataRows.toLocaleString() },
                { label: 'columns', value: String(columns) },
                { label: 'delimiter', value: delimiterLabel(parsed.detected) },
                { label: 'input', value: formatBytes(new TextEncoder().encode(input).length) },
              ]}
            />
          ) : null}
          {buildError ? <IssueAlert issue={{ message: buildError }} /> : null}
        </Pane>
      </div>
    </div>
  )
}
