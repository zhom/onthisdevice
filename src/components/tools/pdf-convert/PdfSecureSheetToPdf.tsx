import { useCallback, useMemo, useRef, useState } from 'react'
import { FileSpreadsheet, FileType2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, formatNumber, nextFrame } from '@/lib/utils'
import type { Orientation, PageSizeId, SheetInput } from './pdf-secure-table-pdf'
import { humanFileError, outputName } from '@/components/tools/pdf/pdf-secure-shared'

export interface PdfSecureSheetToPdfProps {
  source: 'excel' | 'csv'
}

interface Loaded {
  sheets: SheetInput[]
  totalRows: number
}

interface Output {
  blob: Blob
  filename: string
  pages: number
  rows: number
  replacedCharacters: number
  truncatedCells: number
}

const EXCEL_ACCEPT = '.xlsx,.xls,.xlsm,.ods,.csv'
const CSV_ACCEPT = '.csv,.tsv,.txt,text/csv'

export default function PdfSecureSheetToPdf({ source }: PdfSecureSheetToPdfProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [sheetChoice, setSheetChoice] = useState('all')
  const [pageSize, setPageSize] = useState<PageSizeId>('a4')
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [fontSize, setFontSize] = useState(9)
  const [repeatHeader, setRepeatHeader] = useState(true)
  const [fitToWidth, setFitToWidth] = useState(true)
  const [gridLines, setGridLines] = useState(true)
  const [zebra, setZebra] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('Working…')
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<Output | null>(null)
  const cancelled = useRef(false)

  const read = useCallback(
    async (next: File) => {
      setError(null)
      setOutput(null)
      setLoaded(null)
      setFile(next)
      setBusy(true)
      setStage('Reading the file…')
      setProgress(20)
      try {
        const buffer = new Uint8Array(await next.arrayBuffer())
        const name = next.name.toLowerCase()
        const isCsvLike = /\.(csv|tsv|txt)$/.test(name)

        let sheets: SheetInput[] = []
        if (source === 'csv' || isCsvLike) {
          const text = new TextDecoder('utf-8').decode(buffer)
          const Papa = (await import('papaparse')).default
          const parsed = Papa.parse<string[]>(text, {
            skipEmptyLines: 'greedy',
            delimiter: '',
          })
          if (parsed.errors.length > 0 && parsed.data.length === 0) {
            throw new Error(parsed.errors[0].message)
          }
          sheets = [{ name: next.name, rows: parsed.data.map((row) => row.map((c) => c ?? '')) }]
        } else {
          const XLSX = await import('xlsx')
          const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
          sheets = workbook.SheetNames.map((sheetName) => {
            const sheet = workbook.Sheets[sheetName]
            const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
              header: 1,
              raw: false,
              defval: '',
              blankrows: false,
            })
            return { name: sheetName, rows: rows.map((row) => row.map((c) => String(c ?? ''))) }
          }).filter((sheet) => sheet.rows.length > 0)
        }

        if (sheets.length === 0) throw new Error('No rows were found in this file.')

        setLoaded({
          sheets,
          totalRows: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
        })
        setSheetChoice('all')
        setProgress(100)
      } catch (err) {
        setError(humanFileError(err, next.name))
        setFile(null)
      } finally {
        setBusy(false)
      }
    },
    [source],
  )

  const chosenSheets = useMemo(() => {
    if (!loaded) return []
    if (sheetChoice === 'all') return loaded.sheets
    const index = Number(sheetChoice)
    return loaded.sheets[index] ? [loaded.sheets[index]] : loaded.sheets
  }, [loaded, sheetChoice])

  const build = async () => {
    if (!loaded || !file) return
    cancelled.current = false
    setBusy(true)
    setError(null)
    setOutput(null)
    setProgress(0)
    setStage('Laying out the table…')
    try {
      const lib = await import('pdf-lib')
      const renderer = await import('./pdf-secure-table-pdf')
      const report = await renderer.renderTablesToPdf(lib, chosenSheets, {
        pageSize,
        orientation,
        repeatHeader,
        fitToWidth,
        fontSize,
        gridLines,
        zebra,
        showSheetNames: chosenSheets.length > 1,
        onProgress: async (done, total) => {
          if (cancelled.current) throw new Error('cancelled-by-user')
          setStage(`Drawing row ${formatNumber(done, 0)} of ${formatNumber(total, 0)}…`)
          setProgress(Math.round((done / Math.max(1, total)) * 96))
          await nextFrame()
        },
      })

      const buffer = new ArrayBuffer(report.bytes.byteLength)
      new Uint8Array(buffer).set(report.bytes)
      setOutput({
        blob: new Blob([buffer], { type: 'application/pdf' }),
        filename: outputName(file.name, '', 'pdf'),
        pages: report.pages,
        rows: report.rows,
        replacedCharacters: report.replacedCharacters,
        truncatedCells: report.truncatedCells,
      })
      setProgress(100)
    } catch (err) {
      if (err instanceof Error && err.message === 'cancelled-by-user') {
        setError('Cancelled. Nothing was written.')
      } else {
        setError(humanFileError(err, file.name))
      }
    } finally {
      setBusy(false)
    }
  }

  const previewSheet = chosenSheets[0]

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={source === 'excel' ? EXCEL_ACCEPT : CSV_ACCEPT}
        maxSizeMb={300}
        onFiles={(files) => {
          const next = files[0]
          if (next) void read(next)
        }}
        title={
          file
            ? 'Choose a different file'
            : source === 'excel'
              ? 'Drop a spreadsheet here'
              : 'Drop a CSV here'
        }
        hint="or click to browse"
        icon={source === 'excel' ? FileSpreadsheet : FileType2}
      />

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {loaded && (
        <ToolPanel
          title="Page setup"
          description={`${formatNumber(loaded.sheets.length, 0)} sheet${
            loaded.sheets.length === 1 ? '' : 's'
          } · ${formatNumber(loaded.totalRows, 0)} rows`}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void build()} disabled={busy}>
                Create the PDF
              </Button>
              {output && (
                <DownloadButton
                  blob={output.blob}
                  filename={output.filename}
                  label="Download PDF"
                  variant="outline"
                />
              )}
              {busy && (
                <Button variant="ghost" onClick={() => (cancelled.current = true)}>
                  Cancel
                </Button>
              )}
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {loaded.sheets.length > 1 && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="stp-sheet">Sheets to include</Label>
                <Select value={sheetChoice} onValueChange={setSheetChoice}>
                  <SelectTrigger id="stp-sheet">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sheets</SelectItem>
                    {loaded.sheets.map((sheet, index) => (
                      <SelectItem key={sheet.name} value={String(index)}>
                        {sheet.name} ({sheet.rows.length} rows)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="stp-size">Paper size</Label>
              <Select value={pageSize} onValueChange={(value) => setPageSize(value as PageSizeId)}>
                <SelectTrigger id="stp-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="letter">US Letter</SelectItem>
                  <SelectItem value="legal">US Legal</SelectItem>
                  <SelectItem value="a3">A3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stp-orientation">Orientation</Label>
              <Select
                value={orientation}
                onValueChange={(value) => setOrientation(value as Orientation)}
              >
                <SelectTrigger id="stp-orientation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape (wide tables)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="stp-font">Font size: {fontSize} pt</Label>
              <Slider
                id="stp-font"
                aria-label="Table font size in points"
                min={5}
                max={14}
                step={0.5}
                value={[fontSize]}
                onValueChange={(value) => setFontSize(value[0])}
              />
            </div>
          </div>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Table appearance</legend>
            {[
              {
                id: 'stp-header',
                label: 'Repeat the first row as a header',
                checked: repeatHeader,
                set: setRepeatHeader,
              },
              {
                id: 'stp-fit',
                label: 'Fit all columns to the page width',
                checked: fitToWidth,
                set: setFitToWidth,
              },
              { id: 'stp-grid', label: 'Draw grid lines', checked: gridLines, set: setGridLines },
              { id: 'stp-zebra', label: 'Shade alternate rows', checked: zebra, set: setZebra },
            ].map((row) => (
              <div key={row.id} className="flex items-center gap-3">
                <Checkbox
                  id={row.id}
                  checked={row.checked}
                  onCheckedChange={(checked) => row.set(checked === true)}
                />
                <Label htmlFor={row.id} className="font-normal">
                  {row.label}
                </Label>
              </div>
            ))}
          </fieldset>

          {previewSheet && (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">
                First rows of {previewSheet.name}
              </p>
              <div className="overflow-x-auto rounded-lg bg-muted">
                <table className="w-full min-w-[28rem] text-sm">
                  <tbody>
                    {previewSheet.rows.slice(0, 8).map((row, r) => (
                      <tr key={r} className="border-b border-border last:border-0">
                        {row.slice(0, 12).map((cell, c) => (
                          <td
                            key={c}
                            className="max-w-[12rem] truncate px-3 py-1.5 align-top"
                            title={cell}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ToolPanel>
      )}

      {busy && (
        <ProgressPanel label={stage} value={progress} sublabel="Drawing on this device." />
      )}

      {output && (
        <ToolPanel title="PDF ready" description={output.filename}>
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Pages" value={formatNumber(output.pages, 0)} emphasis />
            <ResultStat label="Rows drawn" value={formatNumber(output.rows, 0)} />
            <ResultStat label="Size" value={formatBytes(output.blob.size)} />
          </div>
          {output.replacedCharacters > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-pretty">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {formatNumber(output.replacedCharacters, 0)} character
                {output.replacedCharacters === 1 ? '' : 's'} were replaced with{' '}
                <code>?</code>. The fonts built into every PDF reader cover Western European
                alphabets only, and we do not embed a font from a remote server. Greek, Cyrillic, CJK
                and Indic text will not survive this conversion.
              </span>
            </p>
          )}
          {output.truncatedCells > 0 && (
            <p className="text-sm text-muted-foreground text-pretty">
              {formatNumber(output.truncatedCells, 0)} long cells were trimmed to four lines. Use
              landscape, a bigger page or a smaller font to fit more.
            </p>
          )}
          <p className="text-sm text-muted-foreground text-pretty">
            Values are taken from the cached results stored in the file, as they were when the
            workbook was last saved. Formulas are not recalculated.
          </p>
        </ToolPanel>
      )}
    </div>
  )
}
