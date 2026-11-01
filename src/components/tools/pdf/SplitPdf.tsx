import { useCallback, useMemo, useState } from 'react'
import { Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { clamp, formatBytes, formatNumber, nextFrame, stripExtension } from '@/lib/utils'
import {
  allPages,
  humanPdfError,
  loadPdfLib,
  pagesToRangeString,
  parsePageRanges,
  pdfBlob,
  readFileBytes,
} from './pdf-shared'

type SplitMode = 'fixed' | 'ranges' | 'each'

interface SplitPart {
  name: string
  pages: number[]
  blob: Blob
}

interface Plan {
  groups: number[][]
  error: string | null
}

export default function SplitPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [mode, setMode] = useState<SplitMode>('ranges')
  const [chunk, setChunk] = useState('1')
  const [ranges, setRanges] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('Splitting…')
  const [error, setError] = useState<string | null>(null)
  const [parts, setParts] = useState<SplitPart[]>([])
  const [zip, setZip] = useState<Blob | null>(null)

  const onFiles = useCallback(async (files: File[]) => {
    const next = files[0]
    if (!next) return
    setError(null)
    setParts([])
    setZip(null)
    setFile(next)
    setBytes(null)
    setPageCount(0)
    try {
      const data = await readFileBytes(next)
      const { PDFDocument } = await loadPdfLib()
      const doc = await PDFDocument.load(data, { updateMetadata: false })
      const count = doc.getPageCount()
      setBytes(data)
      setPageCount(count)
      setRanges((cur) => cur || (count > 1 ? `1, 2-${count}` : '1'))
    } catch (err) {
      setError(humanPdfError(err, next.name))
      setFile(null)
    }
  }, [])

  const plan: Plan = useMemo(() => {
    if (!pageCount) return { groups: [], error: null }
    try {
      if (mode === 'each') return { groups: allPages(pageCount).map((p) => [p]), error: null }
      if (mode === 'fixed') {
        const size = clamp(Math.floor(Number(chunk) || 0), 1, Math.max(1, pageCount))
        const groups: number[][] = []
        for (let start = 1; start <= pageCount; start += size) {
          groups.push(allPages(pageCount).slice(start - 1, start - 1 + size))
        }
        return { groups, error: null }
      }
      const segments = ranges
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (segments.length === 0) {
        return { groups: [], error: 'Enter at least one range, for example 1-3, 7, 10-.' }
      }
      return { groups: segments.map((seg) => parsePageRanges(seg, pageCount)), error: null }
    } catch (err) {
      return { groups: [], error: err instanceof Error ? err.message : String(err) }
    }
  }, [mode, chunk, ranges, pageCount])

  const split = async () => {
    if (!bytes || plan.groups.length === 0) return
    setBusy(true)
    setError(null)
    setParts([])
    setZip(null)
    setProgress(0)
    setProgressLabel('Building the split files…')
    try {
      const { PDFDocument } = await loadPdfLib()
      const source = await PDFDocument.load(bytes, { updateMetadata: false })
      const stem = stripExtension(file?.name ?? 'document')
      const pad = String(plan.groups.length).length
      const built: SplitPart[] = []

      for (let i = 0; i < plan.groups.length; i++) {
        const pages = plan.groups[i]
        const out = await PDFDocument.create()
        const copied = await out.copyPages(
          source,
          pages.map((p) => p - 1),
        )
        for (const page of copied) out.addPage(page)
        out.setProducer('onthisdevice.com')
        const saved = await out.save({ useObjectStreams: true })
        const label = pages.length === 1 ? `p${pages[0]}` : `p${pages[0]}-${pages[pages.length - 1]}`
        built.push({
          name: `${stem}_${String(i + 1).padStart(pad, '0')}_${label}.pdf`,
          pages,
          blob: pdfBlob(saved),
        })
        setProgress(Math.round(((i + 1) / plan.groups.length) * 90))
        await nextFrame()
      }

      setParts(built)

      if (built.length > 1) {
        setProgressLabel('Packing the ZIP…')
        const JSZip = (await import('jszip')).default
        const archive = new JSZip()
        for (const part of built) archive.file(part.name, part.blob)
        const zipBlob = await archive.generateAsync(
          { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } },
          (meta) => setProgress(90 + Math.round(meta.percent / 10)),
        )
        setZip(zipBlob)
      }
      setProgress(100)
    } catch (err) {
      setError(humanPdfError(err, file?.name))
    } finally {
      setBusy(false)
    }
  }

  const totalOut = parts.reduce((sum, p) => sum + p.blob.size, 0)

  return (
    <div className="space-y-6">
      <FileDropzone
        accept=".pdf,application/pdf"
        maxSizeMb={500}
        onFiles={(files) => void onFiles(files)}
        title={file ? 'Choose a different PDF' : 'Drop a PDF here'}
        hint="or click to browse"
      />

      {error && <ErrorNote message={error} />}

      {file && pageCount > 0 && (
        <ToolPanel
          title="How should it be split?"
          description={`${file.name} · ${formatNumber(pageCount, 0)} pages · ${formatBytes(file.size)}`}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void split()} disabled={busy || plan.groups.length === 0}>
                <Scissors className="mr-2 size-4" aria-hidden="true" />
                Split into {plan.groups.length || 0} file{plan.groups.length === 1 ? '' : 's'}
              </Button>
              {plan.error && (
                <span className="text-sm text-destructive" role="alert">
                  {plan.error}
                </span>
              )}
            </div>
          }
        >
          <RadioGroup
            value={mode}
            onValueChange={(v) => {
              setMode(v as SplitMode)
              setParts([])
              setZip(null)
            }}
            className="gap-3"
          >
            <div className="rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ranges" id="mode-ranges" />
                <Label htmlFor="mode-ranges" className="font-medium">
                  Custom ranges: one file per range
                </Label>
              </div>
              {mode === 'ranges' && (
                <div className="mt-3 space-y-2 pl-6">
                  <Label htmlFor="split-ranges" className="text-xs text-muted-foreground">
                    Ranges (comma separated)
                  </Label>
                  <Input
                    id="split-ranges"
                    value={ranges}
                    onChange={(e) => {
                      setRanges(e.target.value)
                      setParts([])
                      setZip(null)
                    }}
                    placeholder="1-3, 7, 10-"
                    className="max-w-xs font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Each comma-separated range becomes its own PDF. Open ranges like{' '}
                    <code className="font-mono">10-</code> run to the last page.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fixed" id="mode-fixed" />
                <Label htmlFor="mode-fixed" className="font-medium">
                  Every N pages
                </Label>
              </div>
              {mode === 'fixed' && (
                <div className="mt-3 space-y-2 pl-6">
                  <Label htmlFor="split-chunk" className="text-xs text-muted-foreground">
                    Pages per file
                  </Label>
                  <Input
                    id="split-chunk"
                    type="number"
                    min={1}
                    max={pageCount}
                    value={chunk}
                    onChange={(e) => {
                      setChunk(e.target.value)
                      setParts([])
                      setZip(null)
                    }}
                    className="max-w-28"
                  />
                </div>
              )}
            </div>

            <div className="rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="each" id="mode-each" />
                <Label htmlFor="mode-each" className="font-medium">
                  Extract every page into its own PDF
                </Label>
              </div>
              {mode === 'each' && (
                <p className="mt-2 pl-6 text-xs text-muted-foreground">
                  Produces {formatNumber(pageCount, 0)} single-page PDFs, delivered as one ZIP.
                </p>
              )}
            </div>
          </RadioGroup>

          {plan.groups.length > 0 && !plan.error && (
            <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">Preview of the {plan.groups.length} output files</p>
              <div className="mt-2 max-h-40 overflow-y-auto">
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {plan.groups.slice(0, 60).map((g, i) => (
                    <li key={i} className="font-mono">
                      {i + 1}. pages {pagesToRangeString(g)}{' '}
                      <span className="not-italic">({g.length})</span>
                    </li>
                  ))}
                  {plan.groups.length > 60 && <li>…and {plan.groups.length - 60} more</li>}
                </ul>
              </div>
            </div>
          )}
        </ToolPanel>
      )}

      {busy && <ProgressPanel label={progressLabel} value={progress} />}

      {parts.length > 0 && !busy && (
        <ToolPanel
          title={`${parts.length} file${parts.length === 1 ? '' : 's'} ready`}
          description="Download them all at once, or grab individual files below."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Files created" value={formatNumber(parts.length, 0)} emphasis />
            <ResultStat
              label="Total output"
              value={formatBytes(totalOut)}
              hint={`from ${formatBytes(file?.size ?? 0)}`}
            />
            <ResultStat
              label="Pages covered"
              value={formatNumber(
                parts.reduce((s, p) => s + p.pages.length, 0),
                0,
              )}
              hint={`of ${pageCount}`}
            />
          </div>

          <div className="mt-4">
            {zip ? (
              <DownloadButton blob={zip} filename={`${stripExtension(file?.name ?? 'split')}_split.zip`} label="Download all as ZIP" />
            ) : (
              parts[0] && (
                <DownloadButton blob={parts[0].blob} filename={parts[0].name} label="Download PDF" />
              )
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    File
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Pages
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Size
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">Download</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part) => (
                  <tr key={part.name} className="border-b border-border">
                    <td className="max-w-[220px] truncate py-2 pr-3 font-mono text-xs">
                      {part.name}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{pagesToRangeString(part.pages)}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatBytes(part.blob.size)}</td>
                    <td className="py-2">
                      <DownloadButton blob={part.blob} filename={part.name} label="Save" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
