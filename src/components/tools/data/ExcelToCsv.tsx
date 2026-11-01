import * as React from 'react'
import { FileArchive, FileSpreadsheet } from 'lucide-react'
import type { WorkBook } from 'xlsx'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { downloadBlob, formatBytes, nextFrame, stripExtension } from '@/lib/utils'

import { delimiterChar } from './datautil'
import { Field, OutputPane, ToggleRow } from './ui'
import { loadSheetJs, readWorkbookFile, safeFileStem } from './workbook'

const OUT_DELIMITERS = [
  { value: 'comma', label: 'Comma  ,' },
  { value: 'semicolon', label: 'Semicolon  ;' },
  { value: 'tab', label: 'Tab  (TSV)' },
  { value: 'pipe', label: 'Pipe  |' },
]

const DATE_FORMATS = [
  { value: 'display', label: 'Keep the cell’s own format' },
  { value: 'yyyy-mm-dd', label: 'ISO date (2026-08-16)' },
  { value: 'yyyy-mm-dd hh:mm:ss', label: 'ISO date and time' },
  { value: 'dd/mm/yyyy', label: 'Day/month/year' },
  { value: 'mm/dd/yyyy', label: 'Month/day/year' },
]

export default function ExcelToCsv() {
  const [file, setFile] = React.useState<File | null>(null)
  const [book, setBook] = React.useState<WorkBook | null>(null)
  const [sheetName, setSheetName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [reading, setReading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [csv, setCsv] = React.useState('')
  const [preview, setPreview] = React.useState<string[][]>([])
  const [zipProgress, setZipProgress] = React.useState<number | null>(null)

  const [delimiter, setDelimiter] = React.useState('comma')
  const [dateFormat, setDateFormat] = React.useState('display')
  const [skipBlankRows, setSkipBlankRows] = React.useState(true)
  const [rawNumbers, setRawNumbers] = React.useState(true)
  const [bom, setBom] = React.useState(false)
  const [crlf, setCrlf] = React.useState(false)

  const openFile = React.useCallback(async (files: File[]) => {
    const next = files[0]
    if (!next) return
    setError(null)
    setReading(true)
    setCsv('')
    setPreview([])
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

  // Regenerate the CSV whenever the sheet or an option changes.
  React.useEffect(() => {
    if (!book || !sheetName) {
      setCsv('')
      setPreview([])
      return
    }
    let cancelled = false
    setBusy(true)
    void (async () => {
      await nextFrame()
      const XLSX = await loadSheetJs()
      if (cancelled) return
      const sheet = book.Sheets[sheetName]
      if (!sheet) {
        setCsv('')
        setPreview([])
        setBusy(false)
        return
      }
      const text = XLSX.utils.sheet_to_csv(sheet, {
        FS: delimiterChar(delimiter),
        RS: crlf ? '\r\n' : '\n',
        blankrows: !skipBlankRows,
        rawNumbers,
        ...(dateFormat === 'display' ? {} : { dateNF: dateFormat }),
      })
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        raw: false,
        defval: '',
        blankrows: !skipBlankRows,
      })
      if (cancelled) return
      setCsv((bom ? '﻿' : '') + text)
      setPreview(rows.slice(0, 12).map((r) => r.slice(0, 12).map((c) => String(c ?? ''))))
      setBusy(false)
    })()
    return () => {
      cancelled = true
    }
  }, [book, sheetName, delimiter, dateFormat, skipBlankRows, rawNumbers, bom, crlf])

  const extension = delimiter === 'tab' ? 'tsv' : 'csv'
  const stem = file ? stripExtension(file.name) : 'workbook'
  const downloadName = `${safeFileStem(stem)}-${safeFileStem(sheetName || 'sheet')}.${extension}`

  const downloadAll = React.useCallback(async () => {
    if (!book) return
    setZipProgress(0)
    try {
      const XLSX = await loadSheetJs()
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      const names = book.SheetNames
      for (let i = 0; i < names.length; i++) {
        const name = names[i]!
        const sheet = book.Sheets[name]
        if (!sheet) continue
        const text = XLSX.utils.sheet_to_csv(sheet, {
          FS: delimiterChar(delimiter),
          RS: crlf ? '\r\n' : '\n',
          blankrows: !skipBlankRows,
          rawNumbers,
          ...(dateFormat === 'display' ? {} : { dateNF: dateFormat }),
        })
        zip.file(`${String(i + 1).padStart(2, '0')}-${safeFileStem(name)}.${extension}`, (bom ? '﻿' : '') + text)
        setZipProgress(Math.round(((i + 1) / names.length) * 60))
        await nextFrame()
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, (meta) => {
        setZipProgress(60 + Math.round(meta.percent * 0.4))
      })
      downloadBlob(blob, `${safeFileStem(stem)}-sheets.zip`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The ZIP could not be created.')
    } finally {
      setZipProgress(null)
    }
  }, [book, delimiter, crlf, skipBlankRows, rawNumbers, dateFormat, bom, extension, stem])

  const reset = () => {
    setFile(null)
    setBook(null)
    setSheetName('')
    setCsv('')
    setPreview([])
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
          hint="or click to browse: .xlsx, .xls, .xlsm, .xlsb or .ods"
        />
        {reading ? <ProgressPanel label="Reading the workbook…" /> : null}
        {error ? <ErrorNote message={error} onRetry={reset} /> : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ToolPanel
        title="Sheet and CSV options"
        description={
          file ? `${file.name} · ${formatBytes(file.size)} · ${book.SheetNames.length} sheet${book.SheetNames.length === 1 ? '' : 's'}` : undefined
        }
        footer={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void downloadAll()} disabled={zipProgress !== null}>
              <FileArchive className="size-4" aria-hidden="true" />
              Download every sheet as a ZIP
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Choose a different file
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="x2c-sheet" label="Sheet">
            <Select value={sheetName} onValueChange={setSheetName}>
              <SelectTrigger id="x2c-sheet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {book.SheetNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="x2c-delimiter" label="Delimiter">
            <Select value={delimiter} onValueChange={setDelimiter}>
              <SelectTrigger id="x2c-delimiter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUT_DELIMITERS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="x2c-dates" label="Date cells">
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger id="x2c-dates">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ToggleRow
            id="x2c-blank"
            label="Skip empty rows"
            checked={skipBlankRows}
            onCheckedChange={setSkipBlankRows}
          />
          <ToggleRow
            id="x2c-raw"
            label="Use underlying numbers"
            hint="Off writes what the cell displays, currency symbols and all."
            checked={rawNumbers}
            onCheckedChange={setRawNumbers}
          />
          <ToggleRow
            id="x2c-bom"
            label="Add UTF-8 BOM"
            hint="Helps Excel open accents correctly."
            checked={bom}
            onCheckedChange={setBom}
          />
          <ToggleRow id="x2c-crlf" label="Windows line endings" checked={crlf} onCheckedChange={setCrlf} />
        </div>
      </ToolPanel>

      {zipProgress !== null ? <ProgressPanel label="Packing every sheet into a ZIP…" value={zipProgress} /> : null}
      {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-card">
          <header className="flex items-center gap-2 px-3 py-2">
            <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <h2 className="truncate text-sm font-semibold">Sheet preview</h2>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">first 12 rows</span>
          </header>
          <div className="min-w-0 overflow-x-auto p-3">
            {preview.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">This sheet is empty.</p>
            ) : (
              <table className="w-full min-w-max border-collapse bg-background text-left text-xs">
                <caption className="sr-only">First rows of the selected worksheet</caption>
                <tbody>
                  {preview.map((row, r) => (
                    <tr key={r} className={r === 0 ? 'bg-muted font-medium' : undefined}>
                      {row.map((cell, c) => (
                        <td key={c} className="max-w-[16rem] truncate border px-2 py-1 align-top">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <OutputPane
          id="x2c-output"
          title={`${extension.toUpperCase()} output`}
          value={csv}
          filename={downloadName}
          mime={extension === 'tsv' ? 'text/tab-separated-values' : 'text/csv'}
          emptyHint="The converted sheet will appear here."
          busy={busy}
          downloadLabel={`Download ${extension.toUpperCase()}`}
          stats={
            csv === ''
              ? []
              : [
                  { label: 'rows', value: (csv.split('\n').length - (csv.endsWith('\n') ? 1 : 0)).toLocaleString() },
                  { label: 'size', value: formatBytes(new TextEncoder().encode(csv).length) },
                ]
          }
        />
      </div>
    </div>
  )
}
