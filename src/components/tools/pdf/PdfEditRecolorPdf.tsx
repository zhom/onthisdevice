import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes } from '@/lib/utils'
import {
  copyBytes,
  geometryFromPdfLib,
  get2dContext,
  humanPdfError,
  loadPdfJs,
  loadPdfLib,
  outputName,
  pdfBlob,
  plural,
  readPdfBytes,
} from './pdf-edit-core'
import type { PageGeometry } from './pdf-edit-core'
import {
  dither,
  grayscaleAverage,
  grayscaleLuma,
  invertColors,
  invertLightness,
  rasterisePdf,
  threshold,
} from './pdf-edit-raster'
import type { PixelTransform } from './pdf-edit-raster'

export type RecolorMode = 'grayscale' | 'invert'

type GrayMethod = 'luma' | 'average' | 'threshold' | 'dither'
type InvertMethod = 'negative' | 'darkmode'

type PdfjsModule = Awaited<ReturnType<typeof loadPdfJs>>
type PdfJsDoc = Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>

const DPI_OPTIONS = [
  { value: '110', label: '110 DPI: smallest file, screen only' },
  { value: '150', label: '150 DPI: screen reading (default)' },
  { value: '200', label: '200 DPI: everyday printing' },
  { value: '300', label: '300 DPI: full print quality' },
]

interface Props {
  mode?: RecolorMode
}

export function PdfEditRecolorPdf({ mode = 'grayscale' }: Props) {
  const ids = useId()
  const isGray = mode === 'grayscale'

  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [geos, setGeos] = useState<PageGeometry[]>([])
  const [pageNo, setPageNo] = useState(1)
  const [grayMethod, setGrayMethod] = useState<GrayMethod>('luma')
  const [invertMethod, setInvertMethod] = useState<InvertMethod>('darkmode')
  const [cut, setCut] = useState(160)
  const [dpi, setDpi] = useState('150')
  const [quality, setQuality] = useState('0.82')
  const [showOriginal, setShowOriginal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Blob | null>(null)
  const [frameW, setFrameW] = useState(560)

  const docRef = useRef<PdfJsDoc | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const renderToken = useRef(0)
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false })

  const geo = geos[pageNo - 1] ?? null
  const scale = geo ? frameW / geo.displayW : 1
  const viewW = geo ? geo.displayW * scale : 0
  const viewH = geo ? geo.displayH * scale : 0

  const oneBit = isGray && (grayMethod === 'threshold' || grayMethod === 'dither')

  const transform: PixelTransform = useMemo(() => {
    if (!isGray) return invertMethod === 'negative' ? invertColors : invertLightness
    if (grayMethod === 'average') return grayscaleAverage
    if (grayMethod === 'threshold') return threshold(cut)
    if (grayMethod === 'dither') return dither(cut)
    return grayscaleLuma
  }, [cut, grayMethod, invertMethod, isGray])

  const onFiles = useCallback(async (files: File[]) => {
    const next = files[0]
    if (!next) return
    docRef.current?.loadingTask.destroy()
    docRef.current = null
    setError(null)
    setResult(null)
    setPageNo(1)
    setLoading(true)
    setFile(next)
    try {
      const raw = await readPdfBytes(next)
      const lib = await loadPdfLib()
      const doc = await lib.PDFDocument.load(raw, { ignoreEncryption: true, updateMetadata: false })
      const geometry = geometryFromPdfLib(doc.getPages())
      if (geometry.length === 0) throw new Error('That PDF has no pages.')
      const pdfjs = await loadPdfJs()
      docRef.current = await pdfjs.getDocument({ data: copyBytes(raw) })
        .promise
      setBytes(raw)
      setGeos(geometry)
    } catch (err) {
      setFile(null)
      setBytes(null)
      setGeos([])
      setError(humanPdfError(err, next.name))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      cancelRef.current.cancelled = true
      docRef.current?.loadingTask.destroy()
      docRef.current = null
    }
  }, [])

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    // `p-2` on the frame: subtract the padding or the page is one scrollbar too wide.
    const measure = () => setFrameW(Math.max(180, Math.floor(el.clientWidth) - 16))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [file])

  // Live preview: the exact same pixel transform that the export will use.
  useEffect(() => {
    const doc = docRef.current
    const canvas = canvasRef.current
    if (!doc || !canvas || !geo || viewW <= 0) return
    const token = ++renderToken.current
    let cancelled = false
    const run = async () => {
      try {
        const page = await doc.getPage(pageNo)
        if (cancelled || token !== renderToken.current) return
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale: scale * dpr })
        canvas.width = Math.max(1, Math.round(viewport.width))
        canvas.height = Math.max(1, Math.round(viewport.height))
        const ctx = get2dContext(canvas)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvas, viewport }).promise
        page.cleanup()
        if (cancelled || token !== renderToken.current) return
        if (!showOriginal) {
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
          transform(image.data, canvas.width, canvas.height)
          ctx.putImageData(image, 0, 0)
        }
      } catch (err) {
        if (!cancelled) setError(humanPdfError(err, file?.name))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [pageNo, scale, viewW, geo, file, transform, showOriginal])

  const run = async () => {
    if (!bytes || !file) return
    setBusy(true)
    setError(null)
    setResult(null)
    cancelRef.current = { cancelled: false }
    setProgress({ value: 1, label: 'Starting' })
    try {
      const out = await rasterisePdf(
        bytes,
        {
          dpi: Number(dpi),
          quality: Number(quality),
          format: oneBit ? 'png' : 'jpeg',
          transform,
          title: '',
        },
        (p) => setProgress({ value: Math.round((p.page / Math.max(1, p.total)) * 96), label: p.label }),
        cancelRef.current,
      )
      setProgress({ value: 100, label: 'Done' })
      setResult(pdfBlob(out.bytes))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Conversion cancelled. Nothing was written.')
      } else {
        setError(humanPdfError(err, file.name))
      }
    } finally {
      setBusy(false)
      window.setTimeout(() => setProgress(null), 600)
    }
  }

  if (!file || !geo) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={(files) => void onFiles(files)}
          maxSizeMb={500}
          title={isGray ? 'Drop a PDF to convert to grayscale' : 'Drop a PDF to invert'}
          hint="or click to browse"
          disabled={loading}
        />
        {loading ? <ProgressPanel label="Opening the document…" /> : null}
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}
        <p className="text-sm text-muted-foreground">
          {isGray
            ? 'Every page is rendered, desaturated and rebuilt, so a printer that charges per colour page uses no colour ink. The black-and-white mode makes scanned documents much smaller.'
            : 'Every page is rendered, inverted and rebuilt, giving you a dark-background copy that is far easier on the eyes at night and uses a fraction of the light on an OLED screen.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ToolPanel
        title={isGray ? 'Choose a grayscale method' : 'Choose an inversion method'}
        description="The preview below is the real pixel pipeline, rendered at screen resolution."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {isGray ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-method`}>Method</Label>
              <Select value={grayMethod} onValueChange={(v) => setGrayMethod(v as GrayMethod)}>
                <SelectTrigger id={`${ids}-method`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="luma">Perceptual grey (Rec. 709 luma)</SelectItem>
                  <SelectItem value="average">Flat average of R, G and B</SelectItem>
                  <SelectItem value="threshold">Pure black and white (1-bit)</SelectItem>
                  <SelectItem value="dither">Dithered black and white</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {grayMethod === 'luma'
                  ? 'Weights green far more heavily than blue, matching how the eye reads brightness. This is what "convert to grayscale" means in Photoshop and in print workflows.'
                  : grayMethod === 'average'
                    ? 'Treats all three channels equally. Reds come out lighter and blues darker than they look, but it preserves more contrast between similarly-bright colours.'
                    : grayMethod === 'threshold'
                      ? 'Every pixel becomes pure black or pure white. Text scans get dramatically smaller and crisper; photographs turn into blobs.'
                      : 'Floyd–Steinberg error diffusion keeps photographs readable in 1-bit by scattering the error into neighbouring pixels. The result looks like a newspaper halftone.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-method`}>Method</Label>
              <Select value={invertMethod} onValueChange={(v) => setInvertMethod(v as InvertMethod)}>
                <SelectTrigger id={`${ids}-method`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="darkmode">Dark mode: flip lightness, keep colours</SelectItem>
                  <SelectItem value="negative">True negative: invert every channel</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {invertMethod === 'darkmode'
                  ? 'White paper becomes black and black text becomes white, but a red stamp stays red and a blue heading stays blue. This is the mode you want for night reading.'
                  : 'A photographic negative: white becomes black and red becomes cyan. Useful for reading a scanned film negative or a chalkboard photograph, jarring for ordinary documents.'}
              </p>
            </div>
          )}

          {oneBit ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-cut`}>Cut-off · {cut} of 255</Label>
              <Slider
                id={`${ids}-cut`}
                min={40}
                max={230}
                step={5}
                value={[cut]}
                onValueChange={(v) => setCut(v[0] ?? 160)}
              />
              <p className="text-xs text-muted-foreground">
                Anything brighter than this becomes white. Raise it if faint pencil or a light scan
                is disappearing; lower it if grey paper is coming out black.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-dpi`}>Output resolution</Label>
            <Select value={dpi} onValueChange={setDpi}>
              <SelectTrigger id={`${ids}-dpi`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DPI_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!oneBit ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-quality`}>Image quality</Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger id={`${ids}-quality`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.7">70% (compact)</SelectItem>
                  <SelectItem value="0.82">82% (balanced, default)</SelectItem>
                  <SelectItem value="0.92">92% (crisp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Output format</span>
              <p className="text-sm text-muted-foreground">
                PNG, because JPEG's blocking artefacts are visible and expensive on pure black and
                white. Flat 1-bit pages compress extremely well.
              </p>
            </div>
          )}
        </div>
      </ToolPanel>

      <ToolPanel title="Preview" description={`Page ${pageNo} of ${geos.length}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Previous page"
              disabled={pageNo <= 1}
              onClick={() => setPageNo((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <span className="px-1 text-sm tabular-nums text-muted-foreground">
              {pageNo} / {geos.length}
            </span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Next page"
              disabled={pageNo >= geos.length}
              onClick={() => setPageNo((p) => Math.min(geos.length, p + 1))}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={showOriginal}
            onClick={() => setShowOriginal((v) => !v)}
          >
            {showOriginal ? 'Showing the original' : 'Compare with the original'}
          </Button>
        </div>
        <div ref={frameRef} className="w-full overflow-auto rounded-lg bg-muted p-2">
          <canvas
            ref={canvasRef}
            className="mx-auto block"
            // The page itself is paper, not chrome, so it stays white in both themes.
            style={{ width: `${viewW}px`, height: `${viewH}px`, backgroundColor: '#ffffff' }}
            aria-label={`Page ${pageNo} preview`}
          />
        </div>
      </ToolPanel>

      <ToolPanel
        title={isGray ? 'Convert the document' : 'Invert the document'}
        description={`${file.name} · ${formatBytes(file.size)} · ${plural(geos.length, 'page')}`}
      >
        <Alert role="note">
          <Info className="size-4" aria-hidden="true" />
          <AlertTitle>Every page becomes an image</AlertTitle>
          <AlertDescription>
            There is no way to recolour a PDF's text and vectors in a browser without redrawing the
            pages, so the output is a picture of each page. Text stops being selectable, searchable
            and screen-reader accessible, links stop working, and the file size is driven by the
            resolution above rather than by the original. Keep the original for anything that has to
            stay searchable.
          </AlertDescription>
        </Alert>

        {progress ? <ProgressPanel label={progress.label} value={progress.value} /> : null}
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void run()} disabled={busy}>
            {busy ? 'Working…' : isGray ? 'Convert to grayscale' : 'Invert colours'}
          </Button>
          {busy ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                cancelRef.current.cancelled = true
              }}
            >
              Cancel
            </Button>
          ) : null}
          <DownloadButton
            blob={result}
            filename={outputName(file.name, isGray ? '-grayscale' : '-inverted')}
            label="Download PDF"
            variant={result ? 'default' : 'outline'}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setFile(null)
              setBytes(null)
              setGeos([])
              setResult(null)
            }}
          >
            Use a different PDF
          </Button>
        </div>

        {result ? (
          <div className="grid gap-3 sm:grid-cols-3" role="status" aria-live="polite">
            <ResultStat label="Original" value={formatBytes(file.size)} />
            <ResultStat label="Output" value={formatBytes(result.size)} emphasis />
            <ResultStat
              label="Change"
              value={`${result.size >= file.size ? '+' : '−'}${Math.abs(
                Math.round(((result.size - file.size) / Math.max(1, file.size)) * 100),
              )}%`}
              hint={
                result.size > file.size
                  ? 'Rendered pages are often larger than compact vector originals'
                  : 'Smaller than the original'
              }
            />
          </div>
        ) : null}
      </ToolPanel>
    </div>
  )
}

export default PdfEditRecolorPdf
