import { useCallback, useMemo, useRef, useState } from 'react'
import { Gauge, Shrink, TriangleAlert, CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Formula } from '@/components/shared/Formula'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { clamp, formatBytes, formatNumber, nextFrame } from '@/lib/utils'
import { bytesToBlob, copyBytes, humanPdfError, outputName, readFileBytes } from './pdf-secure-shared'

export interface PdfSecureCompressToSizeProps {
  /** Fixed target for the preset pages. Omit for the free-form page. */
  targetBytes?: number
}

type Unit = 'kb' | 'mb'

interface Attempt {
  page: number
  quality: number
  scale: number
  bytes: number
}

interface CompressResult {
  blob: Blob
  filename: string
  before: number
  after: number
  target: number
  pages: number
  dpi: number
  averageQuality: number
  downscaledPages: number
  hitTarget: boolean
  overheadEstimate: number
  attempts: Attempt[]
  /** The original came back untouched: it was already small enough, or smallest. */
  kept: boolean
}

const DPI_OPTIONS = [
  { value: 'auto', label: 'Automatic', hint: 'Picks a resolution from the page count' },
  { value: '200', label: '200 DPI: near print', hint: '' },
  { value: '150', label: '150 DPI: sharp on screen', hint: '' },
  { value: '110', label: '110 DPI: balanced', hint: '' },
  { value: '72', label: '72 DPI: smallest', hint: '' },
]

function autoDpi(pageCount: number, targetBytes: number): number {
  const perPage = targetBytes / Math.max(1, pageCount)
  if (perPage > 220_000) return 200
  if (perPage > 90_000) return 150
  if (perPage > 35_000) return 120
  if (perPage > 14_000) return 96
  return 72
}

async function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  if (!blob) throw new Error('The browser could not encode this page as a JPEG.')
  return new Uint8Array(await blob.arrayBuffer())
}

function downscale(source: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const next = document.createElement('canvas')
  next.width = Math.max(1, Math.round(source.width * factor))
  next.height = Math.max(1, Math.round(source.height * factor))
  const ctx = next.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('This browser would not give us a 2D canvas to draw on.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, next.width, next.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, next.width, next.height)
  return next
}

export default function PdfSecureCompressToSize({ targetBytes }: PdfSecureCompressToSizeProps) {
  const fixedTarget = typeof targetBytes === 'number' ? targetBytes : null
  const initialUnit: Unit = fixedTarget && fixedTarget >= 1024 * 1024 ? 'mb' : 'kb'
  const initialAmount = fixedTarget
    ? String(initialUnit === 'mb' ? fixedTarget / (1024 * 1024) : Math.round(fixedTarget / 1024))
    : '500'

  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [amount, setAmount] = useState(initialAmount)
  const [unit, setUnit] = useState<Unit>(initialUnit)
  const [dpiChoice, setDpiChoice] = useState('auto')
  const [grayscale, setGrayscale] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('Working…')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CompressResult | null>(null)
  const cancelled = useRef(false)

  const target = useMemo(() => {
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return 0
    return Math.round(n * (unit === 'mb' ? 1024 * 1024 : 1024))
  }, [amount, unit])

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
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.load(data, { updateMetadata: false })
      setBytes(data)
      setPageCount(doc.getPageCount())
    } catch (err) {
      setError(humanPdfError(err, next.name))
      setFile(null)
    }
  }, [])

  const run = async () => {
    if (!bytes || !file) return
    if (target <= 0) {
      setError('Enter a target size bigger than zero.')
      return
    }
    const original = (attempts: Attempt[] = [], dpi = 0): CompressResult => ({
      blob: bytesToBlob(bytes),
      filename: file.name,
      before: file.size,
      after: file.size,
      target,
      pages: pageCount,
      dpi,
      averageQuality: 1,
      downscaledPages: 0,
      hitTarget: file.size <= target,
      overheadEstimate: 0,
      attempts,
      kept: true,
    })
    setError(null)
    if (file.size <= target) {
      // Re-encoding a file that already fits only costs quality and bytes.
      setResult(original())
      return
    }
    cancelled.current = false
    setBusy(true)
    setResult(null)
    setProgress(0)
    setStage('Opening the document…')

    try {
      const { pdfjs } = await import('./pdf-secure-pdfjs')
      const { PDFDocument } = await import('pdf-lib')

      const src = await pdfjs.getDocument({ data: copyBytes(bytes) }).promise
      const total = src.numPages
      const dpi = dpiChoice === 'auto' ? autoDpi(total, target) : Number(dpiChoice)

      // Rough allowance for the PDF container: catalog, page tree, xref, plus
      // ~260 bytes of object overhead per page.
      const overhead = Math.round(1200 + 260 * total)
      let remaining = Math.max(2048, target - overhead)

      const out = await PDFDocument.create()
      const attempts: Attempt[] = []
      let qualitySum = 0
      let downscaledPages = 0

      for (let n = 1; n <= total; n++) {
        if (cancelled.current) throw new Error('cancelled-by-user')
        setStage(`Page ${n} of ${total}: searching for the highest quality that fits…`)
        setProgress(Math.round(((n - 1) / total) * 94))

        const page = await src.getPage(n)
        const points = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: dpi / 72 })
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

        // Unused budget from simple pages rolls forward to complex ones.
        const share = Math.max(1500, Math.floor(remaining / (total - n + 1)))

        let working = canvas
        let scale = 1
        let best: { bytes: Uint8Array; quality: number } | null = null

        for (let attempt = 0; attempt < 4; attempt++) {
          let low = 0.05
          let high = 0.94
          let found: { bytes: Uint8Array; quality: number } | null = null
          const cheapest = await encodeCanvas(working, low)
          if (cheapest.length <= share) {
            found = { bytes: cheapest, quality: low }
            for (let i = 0; i < 8; i++) {
              const mid = (low + high) / 2
              const encoded = await encodeCanvas(working, mid)
              if (encoded.length <= share) {
                found = { bytes: encoded, quality: mid }
                low = mid
              } else {
                high = mid
              }
            }
          }
          if (found) {
            best = found
            break
          }
          // Even the floor quality is too big: drop the resolution and retry.
          scale *= 0.7
          working = downscale(canvas, scale)
          downscaledPages = attempt === 0 ? downscaledPages + 1 : downscaledPages
          if (attempt === 3) best = { bytes: await encodeCanvas(working, 0.05), quality: 0.05 }
          await nextFrame()
        }

        if (!best) best = { bytes: await encodeCanvas(working, 0.05), quality: 0.05 }

        const embedded = await out.embedJpg(best.bytes)
        const newPage = out.addPage([points.width, points.height])
        newPage.drawImage(embedded, { x: 0, y: 0, width: points.width, height: points.height })

        attempts.push({ page: n, quality: best.quality, scale, bytes: best.bytes.length })
        qualitySum += best.quality
        remaining = Math.max(1500, remaining - best.bytes.length)

        canvas.width = 0
        canvas.height = 0
        if (working !== canvas) {
          working.width = 0
          working.height = 0
        }
        await nextFrame()
      }

      void src.loadingTask.destroy()
      setStage('Assembling the compressed PDF…')
      setProgress(96)
      await nextFrame()

      out.setProducer('onthisdevice.com')
      const saved = await out.save({ useObjectStreams: true })
      if (saved.length >= file.size) {
        // Never hand back a bigger file.
        setResult(original(attempts, dpi))
        setProgress(100)
        return
      }
      const blob = bytesToBlob(saved)

      setResult({
        blob,
        filename: outputName(file.name, '-compressed'),
        before: file.size,
        after: blob.size,
        target,
        pages: total,
        dpi,
        averageQuality: qualitySum / Math.max(1, total),
        downscaledPages,
        hitTarget: blob.size <= target,
        overheadEstimate: overhead,
        attempts,
        kept: false,
      })
      setProgress(100)
    } catch (err) {
      if (err instanceof Error && err.message === 'cancelled-by-user') {
        setError('Cancelled. Your original file is untouched.')
      } else {
        setError(humanPdfError(err, file.name))
      }
    } finally {
      setBusy(false)
    }
  }

  const alreadySmall = file !== null && target > 0 && file.size <= target

  return (
    <div className="space-y-6">
      <FileDropzone
        accept=".pdf,application/pdf"
        maxSizeMb={800}
        onFiles={(files) => void onFiles(files)}
        title={file ? 'Choose a different PDF' : 'Drop a PDF here'}
        hint="or click to browse"
        icon={Shrink}
      />

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {file && pageCount > 0 && (
        <ToolPanel
          title="Target size"
          description={`${file.name} · ${formatNumber(pageCount, 0)} page${
            pageCount === 1 ? '' : 's'
          } · ${formatBytes(file.size)}`}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void run()} disabled={busy || target <= 0}>
                <Gauge className="mr-2 size-4" aria-hidden="true" />
                Compress to {target > 0 ? formatBytes(target) : 'target'}
              </Button>
              {busy && (
                <Button variant="ghost" onClick={() => (cancelled.current = true)}>
                  Cancel
                </Button>
              )}
            </div>
          }
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[8rem] flex-1 space-y-2">
              <Label htmlFor="cts-amount">Maximum file size</Label>
              <Input
                id="cts-amount"
                type="number"
                min="1"
                step="1"
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value)
                  setResult(null)
                }}
              />
            </div>
            <div className="w-28 space-y-2">
              <Label htmlFor="cts-unit">Unit</Label>
              <Select
                value={unit}
                onValueChange={(value) => {
                  setUnit(value as Unit)
                  setResult(null)
                }}
              >
                <SelectTrigger id="cts-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kb">KB</SelectItem>
                  <SelectItem value="mb">MB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {alreadySmall && (
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-pretty">
              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                This file is already {formatBytes(file.size)}, which is under your{' '}
                {formatBytes(target)} target. Compressing it further only lowers the quality.
                Upload it as it is.
              </span>
            </p>
          )}

          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? 'Hide' : 'Show'} resolution and colour options
            </Button>
          </div>

          {showAdvanced && (
            <div className="space-y-4 rounded-lg bg-muted p-4">
              <div className="space-y-2">
                <Label htmlFor="cts-dpi">Rendering resolution</Label>
                <Select
                  value={dpiChoice}
                  onValueChange={(value) => {
                    setDpiChoice(value)
                    setResult(null)
                  }}
                >
                  <SelectTrigger id="cts-dpi">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DPI_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground text-pretty">
                  Higher resolution keeps small print legible but forces the quality search lower.
                  Automatic picks from your target divided by the page count.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="cts-gray"
                  checked={grayscale}
                  onCheckedChange={(checked) => {
                    setGrayscale(checked === true)
                    setResult(null)
                  }}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="cts-gray" className="font-normal">
                    Convert to grayscale
                  </Label>
                  <p className="text-xs text-muted-foreground text-pretty">
                    Typically buys another 10–25% at the same quality on colour scans.
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground text-pretty">
            Every page is rendered once, then re-encoded up to nine times at different JPEG
            qualities until it fits its share of the budget. The loop runs on your
            device, so the extra attempts cost nothing.
          </p>
        </ToolPanel>
      )}

      {busy && (
        <ProgressPanel
          label={stage}
          value={progress}
          sublabel="Binary-searching the JPEG quality."
        />
      )}

      {result && (
        <ToolPanel
          title={
            result.kept
              ? result.hitTarget
                ? 'Already under the target'
                : 'Original kept'
              : result.hitTarget
                ? 'Target met'
                : 'Smallest we could get'
          }
          description={result.filename}
          footer={
            <DownloadButton
              blob={result.blob}
              filename={result.filename}
              label={result.kept ? 'Download original PDF' : 'Download compressed PDF'}
            />
          }
        >
          {result.kept ? (
            <p role="status" className="text-sm text-pretty">
              {result.hitTarget
                ? `This file is ${formatBytes(result.before)}, already under ${formatBytes(result.target)}. You get the original back, unchanged.`
                : `Compressing made this file larger, so you get the original back, unchanged. It is ${formatBytes(result.before)}; split it or lower the resolution under the options above.`}
            </p>
          ) : (
            <>
            <div className="grid gap-3 sm:grid-cols-3">
              <ResultStat
                label="Final size"
                value={formatBytes(result.after)}
                hint={`target ${formatBytes(result.target)}`}
                emphasis
              />
              <ResultStat
                label="Reduction"
                value={`${clamp(
                  Math.round(((result.before - result.after) / Math.max(1, result.before)) * 100),
                  0,
                  99,
                )}%`}
                hint={`from ${formatBytes(result.before)}`}
              />
              <ResultStat
                label="Average JPEG quality"
                value={`${Math.round(result.averageQuality * 100)}`}
                hint={`at ${result.dpi} DPI`}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="font-medium text-foreground">Against the target</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatBytes(result.after)} / {formatBytes(result.target)}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={result.hitTarget ? 'h-full bg-success' : 'h-full bg-warning'}
                  style={{
                    width: `${clamp(Math.round((result.after / Math.max(1, result.target)) * 100), 2, 100)}%`,
                  }}
                />
              </div>
            </div>

            <Formula caption="The budget the search aimed at, with your numbers substituted. Unused allowance from simple pages rolls forward to the dense ones, so individual pages may exceed the per-page figure.">
              {[
                `image budget = target − container overhead`,
                `             = ${formatNumber(result.target, 0)} B − ${formatNumber(result.overheadEstimate, 0)} B`,
                `             = ${formatNumber(Math.max(0, result.target - result.overheadEstimate), 0)} B`,
                ``,
                `per page     = ${formatNumber(Math.max(0, result.target - result.overheadEstimate), 0)} B ÷ ${result.pages} page${result.pages === 1 ? '' : 's'}`,
                `             ≈ ${formatNumber(
                  Math.round(Math.max(0, result.target - result.overheadEstimate) / result.pages),
                  0,
                )} B`,
                ``,
                `achieved     = ${formatNumber(result.after, 0)} B  (${formatBytes(result.after)}, ${
                  result.hitTarget ? 'under' : 'over'
                } the ${formatBytes(result.target)} target)`,
              ].join('\n')}
            </Formula>

            {result.downscaledPages > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-pretty">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {result.downscaledPages} page{result.downscaledPages === 1 ? '' : 's'} had to be
                  reduced in resolution as well as quality to fit. Check the small print before you
                  submit this anywhere official.
                </span>
              </p>
            )}
            {!result.hitTarget && (
              <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-pretty">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Even at the lowest setting this document came out at {formatBytes(result.after)}.
                  With {formatNumber(result.pages, 0)} pages there is a floor of a few hundred bytes per
                  page just for the file structure. Split the document, or drop the resolution manually
                  under the options above.
                </span>
              </p>
            )}

            <details className="rounded-lg bg-muted">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
                Per-page search result
              </summary>
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full min-w-[26rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th scope="col" className="px-4 py-2 font-medium">Page</th>
                      <th scope="col" className="px-4 py-2 font-medium">JPEG quality</th>
                      <th scope="col" className="px-4 py-2 font-medium">Scale</th>
                      <th scope="col" className="px-4 py-2 font-medium">Bytes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.attempts.map((attempt) => (
                      <tr key={attempt.page} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 tabular-nums">{attempt.page}</td>
                        <td className="px-4 py-2 tabular-nums">
                          {Math.round(attempt.quality * 100)}
                        </td>
                        <td className="px-4 py-2 tabular-nums">
                          {attempt.scale === 1 ? '100%' : `${Math.round(attempt.scale * 100)}%`}
                        </td>
                        <td className="px-4 py-2 tabular-nums">{formatNumber(attempt.bytes, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <p className="text-sm text-muted-foreground text-pretty">
              Pages are now images, so text in the output is no longer selectable or searchable. That
              is unavoidable when the target is this small. If you need the text layer, use a
              lossless clean-up instead.
            </p>
            </>
          )}
        </ToolPanel>
      )}
    </div>
  )
}
