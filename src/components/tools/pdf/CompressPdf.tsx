import { useCallback, useRef, useState } from 'react'
import { Shrink, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, formatNumber, nextFrame, stripExtension } from '@/lib/utils'
import {
  copyBytes,
  humanPdfError,
  loadPdfLib,
  outputName,
  pdfBlob,
  percentSaved,
  readFileBytes,
} from './pdf-shared'

type Preset = 'strong' | 'recommended' | 'light' | 'custom'
type Mode = 'raster' | 'lossless'

const PRESETS: Record<Exclude<Preset, 'custom'>, { dpi: number; quality: number; label: string; blurb: string }> = {
  strong: {
    dpi: 72,
    quality: 0.5,
    label: 'Strong: smallest file',
    blurb: 'Screen reading only. Fine print may soften.',
  },
  recommended: {
    dpi: 110,
    quality: 0.62,
    label: 'Recommended: balanced',
    blurb: 'Good for email and web sharing. The usual choice.',
  },
  light: {
    dpi: 150,
    quality: 0.8,
    label: 'Light: best quality',
    blurb: 'Close to print quality, smaller savings.',
  },
}

interface CompressResult {
  blob: Blob
  filename: string
  before: number
  after: number
  pages: number
  mode: Mode
  /** Every attempt came out larger, so this is the untouched original. */
  kept: boolean
}

export default function CompressPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [mode, setMode] = useState<Mode>('raster')
  const [preset, setPreset] = useState<Preset>('recommended')
  const [dpi, setDpi] = useState(110)
  const [quality, setQuality] = useState(62)
  const [grayscale, setGrayscale] = useState(false)
  const [stripMeta, setStripMeta] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('Working…')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CompressResult | null>(null)
  const cancelled = useRef(false)

  const effectiveDpi = preset === 'custom' ? dpi : PRESETS[preset].dpi
  const effectiveQuality = preset === 'custom' ? quality / 100 : PRESETS[preset].quality

  const onFiles = useCallback(async (files: File[]) => {
    const next = files[0]
    if (!next) return
    setError(null)
    setResult(null)
    setFile(next)
    setBytes(null)
    setPageCount(0)
    try {
      const data = await readFileBytes(next)
      const { PDFDocument } = await loadPdfLib()
      const doc = await PDFDocument.load(data, { updateMetadata: false })
      setBytes(data)
      setPageCount(doc.getPageCount())
    } catch (err) {
      setError(humanPdfError(err, next.name))
      setFile(null)
    }
  }, [])

  const compressLossless = async (data: Uint8Array): Promise<Uint8Array> => {
    const { PDFDocument } = await loadPdfLib()
    const src = await PDFDocument.load(data, { updateMetadata: false })
    // Copying into a fresh document drops orphaned objects and unused revisions.
    const out = await PDFDocument.create()
    const indices = src.getPageIndices()
    const copied = await out.copyPages(src, indices)
    for (let i = 0; i < copied.length; i++) {
      out.addPage(copied[i])
      if (i % 25 === 0) {
        setProgress(Math.round((i / copied.length) * 90))
        await nextFrame()
      }
    }
    if (!stripMeta) {
      const title = src.getTitle()
      const author = src.getAuthor()
      const subject = src.getSubject()
      if (title) out.setTitle(title)
      if (author) out.setAuthor(author)
      if (subject) out.setSubject(subject)
    }
    out.setProducer('onthisdevice.com')
    setProgress(95)
    await nextFrame()
    return out.save({ useObjectStreams: true, addDefaultPage: false })
  }

  const compressRaster = async (data: Uint8Array): Promise<Uint8Array> => {
    const { pdfjs } = await import('./pdfjs-worker')
    const { PDFDocument } = await loadPdfLib()
    const doc = await pdfjs.getDocument({ data: copyBytes(data) }).promise
    const out = await PDFDocument.create()
    const scale = effectiveDpi / 72
    const total = doc.numPages

    for (let n = 1; n <= total; n++) {
      if (cancelled.current) break
      setProgressLabel(`Re-encoding page ${n} of ${total}…`)
      const page = await doc.getPage(n)
      const pointViewport = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) throw new Error('This browser would not give us a 2D canvas to draw on.')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, viewport }).promise
      page.cleanup()

      if (grayscale) {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const px = image.data
        for (let i = 0; i < px.length; i += 4) {
          const grey = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0
          px[i] = grey
          px[i + 1] = grey
          px[i + 2] = grey
        }
        ctx.putImageData(image, 0, 0)
      }

      const jpeg = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', effectiveQuality),
      )
      if (!jpeg) throw new Error('The browser could not encode this page as a JPEG.')
      const embedded = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()))
      const newPage = out.addPage([pointViewport.width, pointViewport.height])
      newPage.drawImage(embedded, {
        x: 0,
        y: 0,
        width: pointViewport.width,
        height: pointViewport.height,
      })
      canvas.width = 0
      canvas.height = 0
      setProgress(Math.round((n / total) * 96))
      await nextFrame()
    }

    void doc.loadingTask.destroy()
    if (cancelled.current) throw new Error('cancelled-by-user')
    out.setProducer('onthisdevice.com')
    out.setCreator('onthisdevice.com (Compress PDF)')
    return out.save({ useObjectStreams: true })
  }

  const run = async () => {
    if (!bytes || !file) return
    cancelled.current = false
    setBusy(true)
    setError(null)
    setResult(null)
    setProgress(0)
    setProgressLabel(mode === 'raster' ? 'Rendering pages…' : 'Rebuilding the document…')
    try {
      let saved = mode === 'raster' ? await compressRaster(bytes) : await compressLossless(bytes)
      let usedMode = mode
      if (mode === 'raster' && saved.byteLength >= file.size) {
        // Re-rendering a text PDF often makes it bigger; a clean-up may still help.
        setProgressLabel('Trying a lossless clean-up instead…')
        const lossless = await compressLossless(bytes)
        if (lossless.byteLength < saved.byteLength) {
          saved = lossless
          usedMode = 'lossless'
        }
      }
      // Never hand back a bigger file: keep the original when nothing helped.
      const kept = saved.byteLength >= file.size
      const blob = pdfBlob(kept ? bytes : saved)
      setResult({
        blob,
        filename: kept ? file.name : outputName(file.name, '-compressed'),
        before: file.size,
        after: blob.size,
        pages: pageCount,
        mode: usedMode,
        kept,
      })
      setProgress(100)
    } catch (err) {
      if (err instanceof Error && err.message === 'cancelled-by-user') {
        setError('Compression cancelled. Nothing was changed.')
      } else {
        setError(humanPdfError(err, file.name))
      }
    } finally {
      setBusy(false)
    }
  }

  const saved = result ? percentSaved(result.before, result.after) : 0

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
          title="Compression settings"
          description={`${file.name} · ${formatNumber(pageCount, 0)} pages · ${formatBytes(file.size)}`}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void run()} disabled={busy}>
                <Shrink className="mr-2 size-4" aria-hidden="true" />
                Compress PDF
              </Button>
              {busy && (
                <Button variant="ghost" onClick={() => (cancelled.current = true)}>
                  Cancel
                </Button>
              )}
            </div>
          }
        >
          <RadioGroup
            value={mode}
            onValueChange={(v) => {
              setMode(v as Mode)
              setResult(null)
            }}
            className="gap-3"
          >
            <div className="rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="raster" id="cmp-raster" />
                <Label htmlFor="cmp-raster" className="font-medium">
                  Quality presets: large size reduction
                </Label>
              </div>
              <p className="mt-1 pl-6 text-xs text-muted-foreground">
                Each page is re-rendered as a JPEG at the chosen resolution. Best for scans and
                image-heavy files. Text becomes part of the picture.
              </p>

              {mode === 'raster' && (
                <div className="mt-3 space-y-3 pl-6">
                  <RadioGroup
                    value={preset}
                    onValueChange={(v) => {
                      setPreset(v as Preset)
                      setResult(null)
                    }}
                    className="gap-2"
                  >
                    {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((key) => (
                      <div key={key} className="flex items-start gap-2">
                        <RadioGroupItem value={key} id={`preset-${key}`} className="mt-1" />
                        <Label htmlFor={`preset-${key}`} className="font-normal">
                          <span className="font-medium">{PRESETS[key].label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {PRESETS[key].dpi} DPI · JPEG quality {Math.round(PRESETS[key].quality * 100)} ·{' '}
                            {PRESETS[key].blurb}
                          </span>
                        </Label>
                      </div>
                    ))}
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="custom" id="preset-custom" className="mt-1" />
                      <Label htmlFor="preset-custom" className="font-normal">
                        <span className="font-medium">Custom</span>
                        <span className="block text-xs text-muted-foreground">
                          Choose the resolution and JPEG quality yourself.
                        </span>
                      </Label>
                    </div>
                  </RadioGroup>

                  {preset === 'custom' && (
                    <div className="grid gap-4 rounded-lg bg-muted p-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="dpi-slider">Resolution: {dpi} DPI</Label>
                        <Slider
                          id="dpi-slider"
                          min={36}
                          max={300}
                          step={6}
                          value={[dpi]}
                          onValueChange={([v]) => {
                            setDpi(v)
                            setResult(null)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quality-slider">JPEG quality: {quality}</Label>
                        <Slider
                          id="quality-slider"
                          min={20}
                          max={95}
                          step={1}
                          value={[quality]}
                          onValueChange={([v]) => {
                            setQuality(v)
                            setResult(null)
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="grayscale"
                      checked={grayscale}
                      onCheckedChange={(v) => {
                        setGrayscale(v === true)
                        setResult(null)
                      }}
                    />
                    <Label htmlFor="grayscale" className="font-normal">
                      Convert pages to greyscale (extra saving on colour scans)
                    </Label>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="lossless" id="cmp-lossless" />
                <Label htmlFor="cmp-lossless" className="font-medium">
                  Lossless clean-up: keeps text selectable
                </Label>
              </div>
              <p className="mt-1 pl-6 text-xs text-muted-foreground">
                Rebuilds the file with compressed object streams and drops unreferenced objects.
                Nothing is re-rendered, so quality is identical. Savings are typically 2-20%.
              </p>
              {mode === 'lossless' && (
                <div className="mt-3 flex items-center gap-2 pl-6">
                  <Checkbox
                    id="strip-meta"
                    checked={stripMeta}
                    onCheckedChange={(v) => {
                      setStripMeta(v === true)
                      setResult(null)
                    }}
                  />
                  <Label htmlFor="strip-meta" className="font-normal">
                    Remove title, author and other metadata
                  </Label>
                </div>
              )}
            </div>
          </RadioGroup>
        </ToolPanel>
      )}

      {busy && <ProgressPanel label={progressLabel} value={progress} />}

      {result && !busy && (
        <ToolPanel
          title="Compression finished"
          description={
            result.kept
              ? 'No change: the original is the smallest version.'
              : result.mode === 'raster'
                ? `Pages were re-rendered at ${effectiveDpi} DPI.`
                : 'The document structure was rebuilt without touching page content.'
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Before" value={formatBytes(result.before)} />
            <ResultStat label="After" value={formatBytes(result.after)} emphasis />
            <ResultStat
              label={saved >= 0 ? 'Saved' : 'Increase'}
              value={`${formatNumber(Math.abs(saved), 1)}%`}
              hint={`${formatBytes(Math.abs(result.before - result.after))} ${saved >= 0 ? 'smaller' : 'larger'}`}
            />
          </div>

          {result.kept ? (
            <p role="status" className="flex items-start gap-2 mt-4 rounded-lg bg-muted p-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Already as small as it gets. Compressing made this file larger, so you get the original
                back, unchanged.
              </span>
            </p>
          ) : saved <= 0.5 ? (
            <p role="status" className="flex items-start gap-2 mt-4 rounded-lg bg-muted p-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                This file was already well optimised, so there was little to remove.{' '}
                {result.mode === 'lossless'
                  ? 'Try a quality preset if the document is mostly scanned pages.'
                  : 'Only a lower DPI or greyscale conversion can make it smaller. The original may also be a compressed scan already.'}
              </span>
            </p>
          ) : result.mode !== mode ? (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              Re-rendering made the file larger, so the pages were kept as they are and only the
              structure was cleaned up. Text stays selectable.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DownloadButton
              blob={result.blob}
              filename={result.filename}
              label={result.kept ? 'Download original PDF' : 'Download compressed PDF'}
            />
            <span className="text-xs text-muted-foreground">
              Saved as {stripExtension(result.filename)}.pdf
            </span>
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
