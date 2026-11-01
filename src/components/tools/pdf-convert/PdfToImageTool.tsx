import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileImage, Images, RotateCcw, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { downloadBlob, formatBytes, stripExtension } from '@/lib/utils'
import { nextFrame } from '@/lib/utils'
import { describePdfError, openPdf, padPageNumber, renderPage, type RenderedPage } from './pdf-utils'

type Format = 'jpg' | 'png'

interface Props {
  format: Format
}

interface PageResult extends RenderedPage {
  pageNumber: number
  filename: string
}

const DPI_OPTIONS = [
  { value: '72', label: '72 DPI (screen)', hint: 'smallest files' },
  { value: '150', label: '150 DPI (sharing)', hint: 'recommended' },
  { value: '300', label: '300 DPI (print)', hint: 'largest files' },
]

export default function PdfToImageTool({ format }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [dpi, setDpi] = useState('150')
  const [quality, setQuality] = useState(88)
  const [transparent, setTransparent] = useState(false)
  const [results, setResults] = useState<PageResult[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [zipping, setZipping] = useState(false)
  const cancelled = useRef(false)

  useEffect(() => () => {
    cancelled.current = true
  }, [])

  const isJpg = format === 'jpg'
  const extension = isJpg ? 'jpg' : 'png'
  const mime: 'image/jpeg' | 'image/png' = isJpg ? 'image/jpeg' : 'image/png'

  const reset = useCallback(() => {
    cancelled.current = true
    setFile(null)
    setPageCount(0)
    setResults([])
    setError(null)
    setBusy(false)
    setProgress(0)
  }, [])

  const handleFiles = useCallback(async (files: File[]) => {
    const picked = files[0]
    if (!picked) return
    cancelled.current = true
    setError(null)
    setResults([])
    setFile(picked)
    setPageCount(0)
    try {
      const doc = await openPdf(picked)
      setPageCount(doc.numPages)
      await doc.loadingTask.destroy()
    } catch (err) {
      setError(describePdfError(err))
      setFile(null)
    }
  }, [])

  const convert = useCallback(async () => {
    if (!file) return
    cancelled.current = false
    setBusy(true)
    setError(null)
    setResults([])
    setProgress(0)
    setProgressLabel('Opening the PDF…')

    const base = stripExtension(file.name)
    try {
      const doc = await openPdf(file)
      const total = doc.numPages
      setPageCount(total)
      const collected: PageResult[] = []

      for (let n = 1; n <= total; n++) {
        if (cancelled.current) break
        setProgressLabel(`Rendering page ${n} of ${total}…`)
        const page = await doc.getPage(n)
        const rendered = await renderPage(page, {
          dpi: Number(dpi),
          mime,
          quality: quality / 100,
          background: !isJpg && transparent ? null : '#ffffff',
        })
        page.cleanup()
        collected.push({
          ...rendered,
          pageNumber: n,
          filename: `${base}-page-${padPageNumber(n, total)}.${extension}`,
        })
        setResults([...collected])
        setProgress(Math.round((n / total) * 100))
        await nextFrame()
      }

      await doc.loadingTask.destroy()
      if (!cancelled.current) setProgressLabel('Done')
    } catch (err) {
      setError(describePdfError(err, 'The pages could not be rendered.'))
    } finally {
      setBusy(false)
    }
  }, [dpi, extension, file, isJpg, mime, quality, transparent])

  const downloadZip = useCallback(async () => {
    if (results.length === 0 || !file) return
    setZipping(true)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      for (const result of results) {
        zip.file(result.filename, result.blob)
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
      downloadBlob(blob, `${stripExtension(file.name)}-${extension}.zip`)
    } catch (err) {
      setError(err instanceof Error ? `The ZIP could not be created (${err.message}).` : 'The ZIP could not be created.')
    } finally {
      setZipping(false)
    }
  }, [extension, file, results])

  const totalBytes = results.reduce((sum, r) => sum + r.blob.size, 0)
  const Icon = isJpg ? FileImage : Images

  return (
    <div className="space-y-6">
      {!file && (
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={handleFiles}
          maxSizeMb={500}
          title="Drop a PDF here"
          hint="or click to browse"
        />
      )}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {file && (
        <ToolPanel
          title="Conversion settings"
          description={
            pageCount > 0
              ? `${file.name} · ${pageCount} page${pageCount === 1 ? '' : 's'} · ${formatBytes(file.size)}`
              : file.name
          }
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={convert} disabled={busy || pageCount === 0}>
                <Icon className="size-4" aria-hidden="true" />
                {results.length > 0 ? 'Convert again' : `Convert to ${extension.toUpperCase()}`}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={busy}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Start over
              </Button>
            </div>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dpi-select">Resolution</Label>
              <Select value={dpi} onValueChange={setDpi} disabled={busy}>
                <SelectTrigger id="dpi-select" className="w-full">
                  <SelectValue placeholder="Choose a resolution" />
                </SelectTrigger>
                <SelectContent>
                  {DPI_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {DPI_OPTIONS.find((o) => o.value === dpi)?.hint} · an A4 page becomes about{' '}
                {estimatePixels(Number(dpi))}.
              </p>
            </div>

            {isJpg ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="quality-slider">JPG quality</Label>
                  <span className="text-sm tabular-nums text-muted-foreground">{quality}</span>
                </div>
                <Slider
                  id="quality-slider"
                  min={40}
                  max={100}
                  step={1}
                  value={[quality]}
                  onValueChange={(v) => setQuality(v[0] ?? 88)}
                  disabled={busy}
                  aria-label="JPG quality"
                />
                <p className="text-xs text-muted-foreground">
                  85–92 is visually lossless for page renders. Below 70 you will see ringing around text.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="transparent-switch">Transparent background</Label>
                <div className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5">
                  <Switch
                    id="transparent-switch"
                    checked={transparent}
                    onCheckedChange={setTransparent}
                    disabled={busy}
                  />
                  <span className="text-sm text-muted-foreground">
                    {transparent ? 'No white fill behind the page' : 'White page background (default)'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Only helps on vector PDFs. A scanned page is itself a white image, so it stays opaque.
                </p>
              </div>
            )}
          </div>
        </ToolPanel>
      )}

      {busy && <ProgressPanel label={progressLabel} value={progress} />}

      {results.length > 0 && (
        <ToolPanel
          title={`${results.length} image${results.length === 1 ? '' : 's'}`}
          description={`${extension.toUpperCase()} · ${dpi} DPI · ${formatBytes(totalBytes)} total`}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={downloadZip} disabled={zipping}>
                <Download className="size-4" aria-hidden="true" />
                {zipping ? 'Building ZIP…' : `Download all as ZIP (${results.length})`}
              </Button>
              {results.length === 1 && results[0] && (
                <DownloadButton
                  blob={results[0].blob}
                  filename={results[0].filename}
                  label={`Download ${extension.toUpperCase()}`}
                />
              )}
            </div>
          }
        >
          <ul
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            aria-label="Converted pages"
          >
            {results.map((result) => (
              <li
                key={result.pageNumber}
                className="group flex flex-col overflow-hidden rounded-lg bg-card"
              >
                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden bg-muted p-2">
                  <img
                    src={result.thumbnail}
                    alt={`Preview of page ${result.pageNumber}`}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">Page {result.pageNumber}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {Math.round(result.width)}×{Math.round(result.height)} · {formatBytes(result.blob.size)}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Download page ${result.pageNumber} as ${extension.toUpperCase()}`}
                    onClick={() => downloadBlob(result.blob, result.filename)}
                  >
                    <Download className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </ToolPanel>
      )}

      {!file && !error && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Every page is rendered by pdf.js on this device. Nothing is uploaded, so the tool keeps working with
            your network switched off.
          </span>
        </p>
      )}
    </div>
  )
}

/** Rough pixel dimensions of an A4 page at a given DPI, for the hint line. */
function estimatePixels(dpi: number): string {
  const w = Math.round((595.28 / 72) * dpi)
  const h = Math.round((841.89 / 72) * dpi)
  return `${w} × ${h} px`
}
