import { useCallback, useMemo, useRef, useState } from 'react'
import { Sheet, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber, nextFrame } from '@/lib/utils'
import {
  copyBytes,
  humanPdfError,
  outputName,
  readFileBytes,
} from '@/components/tools/pdf/pdf-secure-shared'

export interface PdfSecureToSheetProps {
  format: 'xlsx' | 'csv'
}

interface PageGrid {
  page: number
  rows: string[][]
  columns: number
}

export default function PdfSecureToSheet({ format }: PdfSecureToSheetProps) {
  const [file, setFile] = useState<File | null>(null)
  const [grids, setGrids] = useState<PageGrid[] | null>(null)
  const [selected, setSelected] = useState(0)
  const [tolerance, setTolerance] = useState(6)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('Working…')
  const [error, setError] = useState<string | null>(null)
  const cancelled = useRef(false)

  const extract = useCallback(
    async (source: File, tol: number) => {
      cancelled.current = false
      setBusy(true)
      setError(null)
      setGrids(null)
      setProgress(0)
      setStage('Opening the document…')
      try {
        const bytes = await readFileBytes(source)
        const { pdfjs } = await import('@/components/tools/pdf/pdf-secure-pdfjs')
        const layout = await import('./pdf-secure-layout')
        const doc = await pdfjs.getDocument({
          data: copyBytes(bytes),
        }).promise

        const pages = await layout.extractLayout(doc, {
          onProgress: async (page, total) => {
            if (cancelled.current) throw new Error('cancelled-by-user')
            setStage(`Reading page ${page} of ${total}…`)
            setProgress(Math.round((page / total) * 90))
            await nextFrame()
          },
        })
        void doc.loadingTask.destroy()

        setStage('Clustering columns…')
        setProgress(94)
        await nextFrame()

        const next: PageGrid[] = pages.map((page) => {
          const rows = layout.trimGrid(layout.pageToGrid(page, tol))
          return {
            page: page.index,
            rows,
            columns: rows.reduce((max, row) => Math.max(max, row.length), 0),
          }
        })

        if (next.every((grid) => grid.rows.length === 0)) {
          setError(
            'No text layer was found in this PDF, so there are no table cells to read. The file is a scan, and this tool has no OCR to read its numbers. If the document came from a spreadsheet or a report generator, ask for the original.',
          )
          setBusy(false)
          return
        }

        setGrids(next)
        setSelected(next.findIndex((grid) => grid.rows.length > 0))
        setProgress(100)
      } catch (err) {
        if (err instanceof Error && err.message === 'cancelled-by-user') {
          setError('Cancelled. Nothing was converted.')
        } else {
          setError(humanPdfError(err, source.name))
        }
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const current = grids && grids[selected] ? grids[selected] : null

  const csvText = useMemo(() => {
    if (!grids) return ''
    return grids
      .filter((grid) => grid.rows.length > 0)
      .map((grid) =>
        grid.rows
          .map((row) =>
            row
              .map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
              .join(','),
          )
          .join('\n'),
      )
      .join('\n\n')
  }, [grids])

  const [outputBlob, setOutputBlob] = useState<Blob | null>(null)
  const [outputName_, setOutputName] = useState('')

  const build = async () => {
    if (!grids || !file) return
    setBusy(true)
    setStage(format === 'xlsx' ? 'Writing the workbook…' : 'Writing the CSV…')
    setProgress(50)
    setError(null)
    try {
      if (format === 'xlsx') {
        const XLSX = await import('xlsx')
        const workbook = XLSX.utils.book_new()
        let added = 0
        for (const grid of grids) {
          if (grid.rows.length === 0) continue
          const sheet = XLSX.utils.aoa_to_sheet(grid.rows)
          XLSX.utils.book_append_sheet(workbook, sheet, `Page ${grid.page}`.slice(0, 31))
          added += 1
        }
        if (added === 0) throw new Error('No page produced any rows.')
        const raw = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
        setOutputBlob(
          new Blob([raw], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        )
        setOutputName(outputName(file.name, '', 'xlsx'))
      } else {
        setOutputBlob(new Blob([csvText], { type: 'text/csv;charset=utf-8' }))
        setOutputName(outputName(file.name, '', 'csv'))
      }
      setProgress(100)
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }

  const totalRows = grids?.reduce((sum, grid) => sum + grid.rows.length, 0) ?? 0
  const pagesWithData = grids?.filter((grid) => grid.rows.length > 0).length ?? 0

  return (
    <div className="space-y-6">
      <FileDropzone
        accept=".pdf,application/pdf"
        maxSizeMb={500}
        onFiles={(files) => {
          const next = files[0]
          if (!next) return
          setFile(next)
          setOutputBlob(null)
          void extract(next, tolerance)
        }}
        title={file ? 'Choose a different PDF' : 'Drop a PDF here'}
        hint="or click to browse"
        icon={format === 'xlsx' ? Sheet : Table2}
      />

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {busy && (
        <ProgressPanel label={stage} value={progress} sublabel="Working on your device." />
      )}

      {grids && current && (
        <ToolPanel
          title="Detected tables"
          description={`${formatNumber(pagesWithData, 0)} of ${formatNumber(
            grids.length,
            0,
          )} pages produced rows`}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void build()} disabled={busy}>
                {format === 'xlsx' ? 'Build the .xlsx workbook' : 'Build the .csv file'}
              </Button>
              {outputBlob && (
                <DownloadButton
                  blob={outputBlob}
                  filename={outputName_}
                  label={`Download ${format === 'xlsx' ? '.xlsx' : '.csv'}`}
                  variant="outline"
                />
              )}
              {format === 'csv' && csvText && <CopyButton value={csvText} label="Copy CSV" />}
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Rows found" value={formatNumber(totalRows, 0)} emphasis />
            <ResultStat label="Columns on this page" value={formatNumber(current.columns, 0)} />
            <ResultStat label="Pages with a text layer" value={formatNumber(pagesWithData, 0)} />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[10rem] flex-1 space-y-2">
              <Label htmlFor="sheet-page">Preview page</Label>
              <Select
                value={String(selected)}
                onValueChange={(value) => setSelected(Number(value))}
              >
                <SelectTrigger id="sheet-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {grids.map((grid, index) => (
                    <SelectItem key={grid.page} value={String(index)}>
                      Page {grid.page}: {grid.rows.length} row{grid.rows.length === 1 ? '' : 's'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[12rem] flex-1 space-y-2">
              <Label htmlFor="sheet-tolerance">
                Column snapping: {tolerance} pt
              </Label>
              <Slider
                id="sheet-tolerance"
                aria-label="Column snapping tolerance in points"
                min={2}
                max={20}
                step={1}
                value={[tolerance]}
                onValueChange={(value) => setTolerance(value[0])}
                onValueCommit={(value) => {
                  if (file) void extract(file, value[0])
                }}
              />
              <p className="text-xs text-muted-foreground text-pretty">
                Raise it if one column is being split in two; lower it if two columns are merging.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg bg-muted">
            <table className="w-full min-w-[30rem] text-sm">
              <tbody>
                {current.rows.slice(0, 40).map((row, r) => (
                  <tr key={r} className="border-b border-border last:border-0">
                    {row.map((cell, c) => (
                      <td key={c} className="max-w-[16rem] truncate px-3 py-1.5 align-top" title={cell}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {current.rows.length > 40 && (
            <p className="text-xs text-muted-foreground">
              Showing the first 40 of {formatNumber(current.rows.length, 0)} rows. The export
              contains all of them.
            </p>
          )}

          <p className="text-sm text-muted-foreground text-pretty">
            Columns are inferred from where text fragments start on the page, not from ruling
            lines, so a table with ragged alignment may need the snapping slider nudged. Check the
            preview before you trust the numbers.
          </p>
        </ToolPanel>
      )}
    </div>
  )
}
