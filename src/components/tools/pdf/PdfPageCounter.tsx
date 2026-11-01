import { useCallback, useState } from 'react'
import { FileSearch, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, formatNumber, nextFrame } from '@/lib/utils'
import {
  copyBytes,
  humanPdfError,
  loadPdfLib,
  matchPaperSize,
  orientationOf,
  ptToIn,
  ptToMm,
  readFileBytes,
} from './pdf-shared'

interface PdfInfo {
  Title?: string
  Author?: string
  Subject?: string
  Keywords?: string
  Creator?: string
  Producer?: string
  CreationDate?: string
  ModDate?: string
  PDFFormatVersion?: string
  IsLinearized?: boolean
  IsAcroFormPresent?: boolean
  IsXFAPresent?: boolean
}

interface SizeGroup {
  key: string
  widthPt: number
  heightPt: number
  count: number
  pages: number[]
}

interface FileReport {
  id: string
  name: string
  bytes: number
  pageCount: number
  version: string
  encrypted: boolean
  info: PdfInfo
  groups: SizeGroup[]
  weights: number[] | null
  measuring: boolean
  error: string | null
}

let reportId = 0

/** "D:20240115103000+01'00'" -> "15 Jan 2024, 10:30" */
function parsePdfDate(raw?: string): string {
  if (!raw) return '–'
  const digits = raw.trim().replace(/^D:/, '')
  if (!/^\d{4}/.test(digits)) return raw
  const part = (from: number, to: number, fallback: number): number => {
    const slice = digits.slice(from, to)
    const value = Number(slice)
    return slice.length === to - from && Number.isFinite(value) ? value : fallback
  }
  const year = part(0, 4, 1970)
  const month = part(4, 6, 1)
  const day = part(6, 8, 1)
  const hour = part(8, 10, -1)
  const minute = part(10, 12, 0)
  const date = new Date(year, month - 1, day, Math.max(hour, 0), minute)
  if (Number.isNaN(date.getTime())) return raw
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
  if (hour >= 0) {
    options.hour = '2-digit'
    options.minute = '2-digit'
  }
  return date.toLocaleDateString(undefined, options)
}

function dimensionLabel(widthPt: number, heightPt: number): string {
  const paper = matchPaperSize(widthPt, heightPt)
  const orientation = orientationOf(widthPt, heightPt)
  return paper ? `${paper} ${orientation.toLowerCase()}` : `${orientation} (custom)`
}

export default function PdfPageCounter() {
  const [reports, setReports] = useState<FileReport[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('Reading…')
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<Map<string, File>>(new Map())

  const analyse = useCallback(async (incoming: File[]) => {
    setBusy(true)
    setError(null)
    setProgress(0)
    const { pdfjs } = await import('./pdfjs-worker')
    const { PDFDocument } = await loadPdfLib()
    const built: FileReport[] = []
    const fileMap = new Map<string, File>()

    try {
      for (let f = 0; f < incoming.length; f++) {
        const file = incoming[f]
        const id = `report-${++reportId}`
        fileMap.set(id, file)
        setProgressLabel(`Inspecting ${file.name}…`)
        try {
          const bytes = await readFileBytes(file)
          const doc = await pdfjs.getDocument({ data: copyBytes(bytes) })
            .promise
          const meta = await doc.getMetadata()
          const info = meta.info as unknown as PdfInfo

          let encrypted = false
          try {
            await PDFDocument.load(bytes, { updateMetadata: false })
          } catch (err) {
            encrypted = err instanceof Error && /encrypt/i.test(err.message)
          }

          const groups = new Map<string, SizeGroup>()
          for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n)
            const vp = page.getViewport({ scale: 1 })
            const w = Math.round(vp.width * 10) / 10
            const h = Math.round(vp.height * 10) / 10
            const key = `${w}x${h}`
            const existing = groups.get(key)
            if (existing) {
              existing.count += 1
              if (existing.pages.length < 200) existing.pages.push(n)
            } else {
              groups.set(key, { key, widthPt: w, heightPt: h, count: 1, pages: [n] })
            }
            page.cleanup()
            if (n % 25 === 0) {
              setProgress(Math.round(((f + n / doc.numPages) / incoming.length) * 100))
              await nextFrame()
            }
          }

          built.push({
            id,
            name: file.name,
            bytes: file.size,
            pageCount: doc.numPages,
            version: info.PDFFormatVersion ?? 'unknown',
            encrypted,
            info,
            groups: [...groups.values()].sort((a, b) => b.count - a.count),
            weights: null,
            measuring: false,
            error: null,
          })
          void doc.loadingTask.destroy()
        } catch (err) {
          built.push({
            id,
            name: file.name,
            bytes: file.size,
            pageCount: 0,
            version: 'unknown',
            encrypted: false,
            info: {},
            groups: [],
            weights: null,
            measuring: false,
            error: humanPdfError(err, file.name),
          })
        }
        setProgress(Math.round(((f + 1) / incoming.length) * 100))
        await nextFrame()
      }

      setFiles((prev) => new Map([...prev, ...fileMap]))
      setReports((prev) => [...prev, ...built])
    } catch (err) {
      setError(humanPdfError(err))
    } finally {
      setBusy(false)
    }
  }, [])

  const measureWeights = async (report: FileReport) => {
    const file = files.get(report.id)
    if (!file) return
    setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, measuring: true } : r)))
    try {
      const bytes = await readFileBytes(file)
      const { PDFDocument } = await loadPdfLib()
      const src = await PDFDocument.load(bytes, { updateMetadata: false })
      const weights: number[] = []
      for (let i = 0; i < src.getPageCount(); i++) {
        const out = await PDFDocument.create()
        const [copied] = await out.copyPages(src, [i])
        out.addPage(copied)
        const saved = await out.save({ useObjectStreams: true })
        weights.push(saved.length)
        if (i % 5 === 0) await nextFrame()
      }
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, weights, measuring: false } : r)),
      )
    } catch (err) {
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? { ...r, measuring: false, error: humanPdfError(err, report.name) }
            : r,
        ),
      )
    }
  }

  const totalPages = reports.reduce((sum, r) => sum + r.pageCount, 0)
  const totalBytes = reports.reduce((sum, r) => sum + r.bytes, 0)

  const summaryText = reports
    .map(
      (r) =>
        `${r.name}: ${r.pageCount} pages, ${formatBytes(r.bytes)}, PDF ${r.version}${
          r.encrypted ? ', encrypted' : ''
        }`,
    )
    .join('\n')
    .concat(reports.length > 1 ? `\nTotal: ${totalPages} pages across ${reports.length} files` : '')

  const csv = [
    'File,Pages,Size (bytes),PDF version,Encrypted,Title,Author,Creator,Producer,Created,Modified',
    ...reports.map((r) =>
      [
        r.name,
        r.pageCount,
        r.bytes,
        r.version,
        r.encrypted ? 'yes' : 'no',
        r.info.Title ?? '',
        r.info.Author ?? '',
        r.info.Creator ?? '',
        r.info.Producer ?? '',
        parsePdfDate(r.info.CreationDate),
        parsePdfDate(r.info.ModDate),
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    ),
  ].join('\n')

  return (
    <div className="space-y-6">
      <FileDropzone
        accept=".pdf,application/pdf"
        multiple
        maxSizeMb={500}
        onFiles={(incoming) => void analyse(incoming)}
        title={reports.length ? 'Add more PDFs' : 'Drop one or many PDFs here'}
        hint="or click to browse"
      />

      {error && <ErrorNote message={error} />}
      {busy && <ProgressPanel label={progressLabel} value={progress} />}

      {reports.length > 0 && (
        <ToolPanel
          title="Summary"
          description={`${reports.length} file${reports.length === 1 ? '' : 's'} inspected`}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton value={summaryText} label="Copy summary" />
              <DownloadButton
                blob={new Blob([csv], { type: 'text/csv;charset=utf-8' })}
                filename="pdf-page-counts.csv"
                label="Download CSV"
              />
              <Button
                variant="ghost"
                onClick={() => {
                  setReports([])
                  setFiles(new Map())
                }}
              >
                Clear list
              </Button>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Total pages" value={formatNumber(totalPages, 0)} emphasis />
            <ResultStat label="Files" value={formatNumber(reports.length, 0)} />
            <ResultStat label="Combined size" value={formatBytes(totalBytes)} />
          </div>
        </ToolPanel>
      )}

      {reports.map((report) => {
        const maxWeight = report.weights ? Math.max(...report.weights, 1) : 1
        return (
          <ToolPanel
            key={report.id}
            title={report.name}
            description={`${formatNumber(report.pageCount, 0)} pages · ${formatBytes(report.bytes)} · PDF ${report.version}`}
          >
            {report.error ? (
              <ErrorNote message={report.error} />
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <ResultStat label="Pages" value={formatNumber(report.pageCount, 0)} emphasis />
                  <ResultStat
                    label="Average page weight"
                    value={formatBytes(report.bytes / Math.max(report.pageCount, 1))}
                    hint="file size ÷ pages"
                  />
                  <ResultStat
                    label="Encrypted"
                    value={report.encrypted ? 'Yes' : 'No'}
                    hint={report.encrypted ? 'content may be restricted' : 'no password set'}
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <caption className="sr-only">Document metadata</caption>
                    <tbody>
                      {(
                        [
                          ['Title', report.info.Title],
                          ['Author', report.info.Author],
                          ['Subject', report.info.Subject],
                          ['Keywords', report.info.Keywords],
                          ['Creator', report.info.Creator],
                          ['Producer', report.info.Producer],
                          ['Created', parsePdfDate(report.info.CreationDate)],
                          ['Modified', parsePdfDate(report.info.ModDate)],
                          ['PDF version', report.version],
                          ['Linearized', report.info.IsLinearized ? 'Yes' : 'No'],
                          ['Contains a form', report.info.IsAcroFormPresent ? 'Yes' : 'No'],
                        ] as [string, string | undefined][]
                      ).map(([label, value]) => (
                        <tr key={label} className="border-b border-border">
                          <th scope="row" className="w-40 py-2 pr-3 font-medium text-muted-foreground">
                            {label}
                          </th>
                          <td className="break-words py-2">{value || '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium">Page sizes</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th scope="col" className="py-2 pr-3 font-medium">
                            Size
                          </th>
                          <th scope="col" className="py-2 pr-3 font-medium">
                            Points
                          </th>
                          <th scope="col" className="py-2 pr-3 font-medium">
                            Millimetres
                          </th>
                          <th scope="col" className="py-2 pr-3 font-medium">
                            Inches
                          </th>
                          <th scope="col" className="py-2 font-medium">
                            Pages
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.groups.map((group) => (
                          <tr key={group.key} className="border-b border-border">
                            <td className="py-2 pr-3">
                              {dimensionLabel(group.widthPt, group.heightPt)}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">
                              {formatNumber(group.widthPt, 1)} × {formatNumber(group.heightPt, 1)}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">
                              {formatNumber(ptToMm(group.widthPt), 1)} ×{' '}
                              {formatNumber(ptToMm(group.heightPt), 1)}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">
                              {formatNumber(ptToIn(group.widthPt), 2)} ×{' '}
                              {formatNumber(ptToIn(group.heightPt), 2)}
                            </td>
                            <td className="py-2 tabular-nums">{group.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <h3 className="text-sm font-medium">Per-page weight</h3>
                    {!report.weights && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={report.measuring || report.encrypted}
                        onClick={() => void measureWeights(report)}
                      >
                        <Scale className="mr-2 size-4" aria-hidden="true" />
                        {report.measuring ? 'Measuring…' : 'Measure page weights'}
                      </Button>
                    )}
                    {report.encrypted && (
                      <span className="text-xs text-muted-foreground">
                        Not available for encrypted files.
                      </span>
                    )}
                  </div>
                  {report.measuring && <ProgressPanel label="Re-saving each page to measure it…" />}
                  {report.weights && (
                    <div className="max-h-72 overflow-y-auto rounded-lg bg-muted p-3">
                      <ul className="space-y-1">
                        {report.weights.map((weight, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs">
                            <span className="w-10 shrink-0 tabular-nums text-muted-foreground">
                              p{i + 1}
                            </span>
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <span
                                className="block h-full rounded-full bg-chart-4"
                                style={{ width: `${Math.max(2, (weight / maxWeight) * 100)}%` }}
                              />
                            </span>
                            <span className="w-20 shrink-0 text-right tabular-nums">
                              {formatBytes(weight)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </ToolPanel>
        )
      })}

      {reports.length === 0 && !busy && (
        <div className="flex items-start gap-3 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          <FileSearch className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Drop one PDF for a full inspection, or a whole batch to get a page count per file and a
            grand total you can copy or export as CSV.
          </p>
        </div>
      )}
    </div>
  )
}
