import { useCallback, useState } from 'react'
import { FileOutput } from 'lucide-react'
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
import { cn, formatBytes, formatNumber, nextFrame, stripExtension } from '@/lib/utils'
import { PageThumb } from './PageThumb'
import {
  allPages,
  humanPdfError,
  loadPdfLib,
  outputName,
  parsePageRanges,
  pdfBlob,
  readFileBytes,
} from './pdf-shared'
import { usePdfThumbnails } from './usePdfThumbnails'

type OutputMode = 'single' | 'zip'

export default function ExtractPdfPages() {
  const [file, setFile] = useState<File | null>(null)
  const [selection, setSelection] = useState<number[]>([])
  const [range, setRange] = useState('')
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [mode, setMode] = useState<OutputMode>('single')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; filename: string; files: number } | null>(null)

  const thumbs = usePdfThumbnails(file, 150)

  const onFiles = useCallback((files: File[]) => {
    const next = files[0]
    if (!next) return
    setFile(next)
    setSelection([])
    setRange('')
    setRangeError(null)
    setResult(null)
    setError(null)
  }, [])

  const change = (pages: number[]) => {
    setSelection(pages)
    setResult(null)
  }

  const toggle = (page: number) =>
    change(selection.includes(page) ? selection.filter((p) => p !== page) : [...selection, page])

  const applyRange = () => {
    try {
      change(parsePageRanges(range, thumbs.pageCount))
      setRangeError(null)
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : String(err))
    }
  }

  const extract = async () => {
    if (!file || selection.length === 0) return
    setBusy(true)
    setError(null)
    setResult(null)
    setProgress(0)
    try {
      const bytes = await readFileBytes(file)
      const { PDFDocument } = await loadPdfLib()
      const src = await PDFDocument.load(bytes, { updateMetadata: false })
      const stem = stripExtension(file.name)

      if (mode === 'single') {
        const out = await PDFDocument.create()
        const copied = await out.copyPages(
          src,
          selection.map((p) => p - 1),
        )
        for (let i = 0; i < copied.length; i++) {
          out.addPage(copied[i])
          if (i % 20 === 0) {
            setProgress(Math.round((i / copied.length) * 90))
            await nextFrame()
          }
        }
        out.setProducer('onthisdevice.com')
        const saved = await out.save({ useObjectStreams: true })
        setResult({
          blob: pdfBlob(saved),
          filename: outputName(file.name, '-extracted'),
          files: 1,
        })
      } else {
        const JSZip = (await import('jszip')).default
        const archive = new JSZip()
        const pad = String(thumbs.pageCount).length
        for (let i = 0; i < selection.length; i++) {
          const page = selection[i]
          const out = await PDFDocument.create()
          const [copied] = await out.copyPages(src, [page - 1])
          out.addPage(copied)
          out.setProducer('onthisdevice.com')
          const saved = await out.save({ useObjectStreams: true })
          archive.file(`${stem}_page-${String(page).padStart(pad, '0')}.pdf`, saved)
          setProgress(Math.round(((i + 1) / selection.length) * 85))
          await nextFrame()
        }
        const zipBlob = await archive.generateAsync(
          { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } },
          (meta) => setProgress(85 + Math.round(meta.percent * 0.15)),
        )
        setResult({
          blob: zipBlob,
          filename: `${stem}_pages.zip`,
          files: selection.length,
        })
      }
      setProgress(100)
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept=".pdf,application/pdf"
        maxSizeMb={300}
        onFiles={onFiles}
        title={file ? 'Choose a different PDF' : 'Drop a PDF here'}
        hint="or click to browse"
      />

      {error && <ErrorNote message={error} />}
      {thumbs.error && <ErrorNote message={thumbs.error} />}

      {file && thumbs.status === 'loading' && (
        <ProgressPanel
          label={`Rendering page previews… ${thumbs.pages.length}/${thumbs.pageCount || '?'}`}
          value={thumbs.progress}
        />
      )}

      {file && thumbs.pageCount > 0 && (
        <ToolPanel
          title="Pick the pages to keep"
          description="Click pages in the order you want them, or type a range. Everything else is discarded."
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void extract()} disabled={busy || selection.length === 0}>
                <FileOutput className="mr-2 size-4" aria-hidden="true" />
                Extract {selection.length} page{selection.length === 1 ? '' : 's'}
              </Button>
              <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
                Output order: {selection.length ? selection.join(', ') : 'nothing selected yet'}
              </span>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="extract-range" className="text-xs text-muted-foreground">
                  Pages to extract
                </Label>
                <Input
                  id="extract-range"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyRange()
                    }
                  }}
                  placeholder="1-3, 7, 10-"
                  className="w-44 font-mono"
                />
              </div>
              <Button variant="secondary" onClick={applyRange} disabled={!range.trim()}>
                Apply range
              </Button>
              <Button variant="outline" onClick={() => change(allPages(thumbs.pageCount))}>
                Select all
              </Button>
              <Button variant="outline" onClick={() => change([])} disabled={!selection.length}>
                Clear
              </Button>
              <Button
                variant="outline"
                onClick={() => change([...selection].sort((a, b) => a - b))}
                disabled={selection.length < 2}
              >
                Sort ascending
              </Button>
            </div>
            {rangeError && (
              <p className="text-sm text-destructive" role="alert">
                {rangeError}
              </p>
            )}

            <div
              className="grid justify-items-center gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
            >
              {allPages(thumbs.pageCount).map((page) => {
                const order = selection.indexOf(page)
                const picked = order >= 0
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => toggle(page)}
                    aria-pressed={picked}
                    aria-label={`Page ${page}${picked ? `, selected as output page ${order + 1}` : ''}`}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg p-1 ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      picked ? 'bg-muted ring-2 ring-primary' : 'hover:bg-accent',
                    )}
                  >
                    <div className="relative">
                      <PageThumb thumb={thumbs.pages[page - 1]} muted={!picked && selection.length > 0} />
                      {picked && (
                        <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {order + 1}
                        </span>
                      )}
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">{page}</span>
                  </button>
                )
              })}
            </div>

            <RadioGroup
              value={mode}
              onValueChange={(v) => {
                setMode(v as OutputMode)
                setResult(null)
              }}
              className="gap-2 rounded-lg bg-muted p-3"
            >
              <p className="text-sm font-medium">Output</p>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="single" id="out-single" />
                <Label htmlFor="out-single" className="font-normal">
                  One PDF containing the selected pages
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="zip" id="out-zip" />
                <Label htmlFor="out-zip" className="font-normal">
                  A ZIP with one PDF per page
                </Label>
              </div>
            </RadioGroup>
          </div>
        </ToolPanel>
      )}

      {busy && <ProgressPanel label="Extracting pages…" value={progress} />}

      {result && !busy && (
        <ToolPanel title="Extraction complete" description="Pages were copied as they are, so the quality did not change.">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Pages extracted" value={formatNumber(selection.length, 0)} emphasis />
            <ResultStat
              label="Files"
              value={formatNumber(result.files, 0)}
              hint={result.files > 1 ? 'bundled as a ZIP' : 'single PDF'}
            />
            <ResultStat label="Download size" value={formatBytes(result.blob.size)} />
          </div>
          <div className="mt-4">
            <DownloadButton
              blob={result.blob}
              filename={result.filename}
              label={result.files > 1 ? 'Download ZIP' : 'Download PDF'}
            />
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
