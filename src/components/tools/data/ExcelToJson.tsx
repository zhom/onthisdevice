import * as React from 'react'
import type { WorkBook } from 'xlsx'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, nextFrame, stripExtension } from '@/lib/utils'

import { expandKeys, jsonStats, type PlainObject } from './datautil'
import { Field, OutputPane, ToggleRow } from './ui'
import { loadSheetJs, readWorkbookFile, safeFileStem } from './workbook'

type HeaderMode = 'first-row' | 'letters' | 'arrays'
type DateMode = 'iso' | 'date' | 'text' | 'serial'

const ALL_SHEETS = '__all__'

const DATE_MODES: { value: DateMode; label: string }[] = [
  { value: 'iso', label: 'ISO 8601 (2026-08-16T00:00:00.000Z)' },
  { value: 'date', label: 'Date only (2026-08-16)' },
  { value: 'text', label: 'Exactly as the cell displays it' },
  { value: 'serial', label: 'Excel serial number (46250)' },
]

function uniqueHeaders(row: unknown[]): string[] {
  const used = new Map<string, number>()
  return row.map((cell, i) => {
    let name = String(cell ?? '').trim()
    if (name === '') name = `column_${i + 1}`
    const seen = used.get(name)
    if (seen === undefined) {
      used.set(name, 1)
      return name
    }
    used.set(name, seen + 1)
    return `${name}_${seen + 1}`
  })
}

function columnLetter(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

const EPOCH_1900 = Date.UTC(1899, 11, 30)

function toSerial(date: Date): number {
  return Math.round(((date.getTime() - EPOCH_1900) / 86_400_000) * 100_000) / 100_000
}

export default function ExcelToJson() {
  const [file, setFile] = React.useState<File | null>(null)
  const [book, setBook] = React.useState<WorkBook | null>(null)
  const [sheetName, setSheetName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [reading, setReading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [json, setJson] = React.useState('')
  const [stats, setStats] = React.useState<{ label: string; value: string }[]>([])

  const [headerMode, setHeaderMode] = React.useState<HeaderMode>('first-row')
  const [dateMode, setDateMode] = React.useState<DateMode>('iso')
  const [typedValues, setTypedValues] = React.useState(true)
  const [skipBlankRows, setSkipBlankRows] = React.useState(true)
  const [expandDots, setExpandDots] = React.useState(false)
  const [nullForEmpty, setNullForEmpty] = React.useState(true)
  const [pretty, setPretty] = React.useState(true)

  const openFile = React.useCallback(async (files: File[]) => {
    const next = files[0]
    if (!next) return
    setError(null)
    setReading(true)
    setJson('')
    try {
      await nextFrame()
      const wb = await readWorkbookFile(next)
      setFile(next)
      setBook(wb)
      setSheetName(wb.SheetNames[0] ?? '')
    } catch (err) {
      setBook(null)
      setFile(null)
      setError(err instanceof Error ? err.message : 'That file could not be opened.')
    } finally {
      setReading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!book || !sheetName) {
      setJson('')
      setStats([])
      return
    }
    let cancelled = false
    setBusy(true)
    void (async () => {
      await nextFrame()
      const XLSX = await loadSheetJs()
      if (cancelled) return

      const convertSheet = (name: string): unknown => {
        const sheet = book.Sheets[name]
        if (!sheet) return []
        const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          raw: true,
          defval: null,
          blankrows: !skipBlankRows,
        })
        const text = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          raw: false,
          defval: '',
          blankrows: !skipBlankRows,
        })
        if (raw.length === 0) return []

        const width = raw.reduce((acc, r) => Math.max(acc, r.length), 0)

        const readCell = (r: number, c: number): unknown => {
          const value = raw[r]?.[c] ?? null
          const shown = text[r]?.[c] ?? ''
          if (!typedValues) return shown === '' && nullForEmpty ? null : shown
          if (value instanceof Date) {
            if (dateMode === 'iso') return value.toISOString()
            if (dateMode === 'date') return value.toISOString().slice(0, 10)
            if (dateMode === 'serial') return toSerial(value)
            return shown
          }
          if (value === null || value === undefined || value === '') return nullForEmpty ? null : ''
          return value
        }

        const bodyStart = headerMode === 'first-row' ? 1 : 0
        let headers: string[] = []
        if (headerMode === 'first-row') headers = uniqueHeaders((raw[0] ?? []).slice(0, width))
        else if (headerMode === 'letters') headers = Array.from({ length: width }, (_, i) => columnLetter(i))

        if (headerMode === 'arrays') {
          const out: unknown[][] = []
          for (let r = bodyStart; r < raw.length; r++) {
            out.push(Array.from({ length: width }, (_, c) => readCell(r, c)))
          }
          return out
        }

        if (headers.length < width) {
          headers = [
            ...headers,
            ...Array.from({ length: width - headers.length }, (_, i) => `column_${headers.length + i + 1}`),
          ]
        }

        const out: PlainObject[] = []
        for (let r = bodyStart; r < raw.length; r++) {
          const row: PlainObject = {}
          headers.forEach((h, c) => {
            row[h] = readCell(r, c)
          })
          out.push(expandDots ? expandKeys(row, '.') : row)
        }
        return out
      }

      let value: unknown
      if (sheetName === ALL_SHEETS) {
        const all: PlainObject = {}
        for (const name of book.SheetNames) all[name] = convertSheet(name)
        value = all
      } else {
        value = convertSheet(sheetName)
      }

      if (cancelled) return
      const output = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)
      const s = jsonStats(value)
      setJson(output)
      setStats([
        {
          label: sheetName === ALL_SHEETS ? 'sheets' : 'records',
          value: (sheetName === ALL_SHEETS
            ? book.SheetNames.length
            : Array.isArray(value)
              ? value.length
              : 0
          ).toLocaleString(),
        },
        { label: 'values', value: (s.strings + s.numbers + s.booleans + s.nulls).toLocaleString() },
        { label: 'JSON', value: formatBytes(new TextEncoder().encode(output).length) },
      ])
      setBusy(false)
    })()
    return () => {
      cancelled = true
    }
  }, [
    book,
    sheetName,
    headerMode,
    dateMode,
    typedValues,
    skipBlankRows,
    expandDots,
    nullForEmpty,
    pretty,
  ])

  const reset = () => {
    setFile(null)
    setBook(null)
    setSheetName('')
    setJson('')
    setError(null)
  }

  if (!book) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".xlsx,.xls,.xlsm,.xlsb,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onFiles={(files) => void openFile(files)}
          maxSizeMb={200}
          title="Drop an Excel workbook here"
          hint="or click to browse"
        />
        {reading ? <ProgressPanel label="Reading the workbook…" /> : null}
        {error ? <ErrorNote message={error} onRetry={reset} /> : null}
      </div>
    )
  }

  const stem = file ? stripExtension(file.name) : 'workbook'
  const filename = `${safeFileStem(stem)}${sheetName === ALL_SHEETS ? '' : `-${safeFileStem(sheetName)}`}.json`

  return (
    <div className="space-y-4">
      <ToolPanel
        title="Sheet and JSON options"
        description={
          file
            ? `${file.name} · ${formatBytes(file.size)} · ${book.SheetNames.length} sheet${book.SheetNames.length === 1 ? '' : 's'}`
            : undefined
        }
        footer={
          <Button type="button" variant="ghost" onClick={reset}>
            Choose a different file
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="x2j-sheet" label="Sheet">
            <Select value={sheetName} onValueChange={setSheetName}>
              <SelectTrigger id="x2j-sheet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {book.SheetNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
                <SelectItem value={ALL_SHEETS}>All sheets (keyed object)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="x2j-header" label="Keys come from">
            <Select value={headerMode} onValueChange={(v) => setHeaderMode(v as HeaderMode)}>
              <SelectTrigger id="x2j-header">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first-row">The first row</SelectItem>
                <SelectItem value="letters">Column letters (A, B, C…)</SelectItem>
                <SelectItem value="arrays">No keys (arrays of arrays)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="x2j-dates" label="Date cells">
            <Select value={dateMode} onValueChange={(v) => setDateMode(v as DateMode)} disabled={!typedValues}>
              <SelectTrigger id="x2j-dates">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_MODES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="x2j-format" label="Formatting">
            <Select value={pretty ? 'pretty' : 'min'} onValueChange={(v) => setPretty(v === 'pretty')}>
              <SelectTrigger id="x2j-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pretty">Pretty (2-space indent)</SelectItem>
                <SelectItem value="min">Minified</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ToggleRow
            id="x2j-typed"
            label="Typed values"
            hint="Keep numbers, booleans and dates as JSON types instead of strings."
            checked={typedValues}
            onCheckedChange={setTypedValues}
          />
          <ToggleRow
            id="x2j-blank"
            label="Skip empty rows"
            checked={skipBlankRows}
            onCheckedChange={setSkipBlankRows}
          />
          <ToggleRow
            id="x2j-null"
            label="Empty cells become null"
            hint="Off writes an empty string instead."
            checked={nullForEmpty}
            onCheckedChange={setNullForEmpty}
          />
          <ToggleRow
            id="x2j-expand"
            label="Expand dotted headers"
            hint="A header named address.city becomes a nested object."
            checked={expandDots}
            onCheckedChange={setExpandDots}
          />
        </div>
      </ToolPanel>

      {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}

      <OutputPane
        id="x2j-output"
        title="JSON output"
        value={json}
        filename={filename}
        mime="application/json"
        emptyHint="The converted sheet will appear here."
        busy={busy}
        rows={22}
        stats={stats}
        downloadLabel="Download JSON"
      />
    </div>
  )
}
