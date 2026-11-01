import { useCallback, useEffect, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { clamp, formatBytes, nextFrame } from '@/lib/utils'
import {
  columnInkProfile,
  copyBytes,
  displayRectToPageBox,
  displaySize,
  drawEmbeddedRotated,
  embeddedDisplaySize,
  findGutter,
  geomOf,
  humanPdfError,
  loadPdfjs,
  loadPdfLib,
  mmToPt,
  outputName,
  pdfBlob,
  readFileBytes,
  renderPageToCanvas,
  resolveScope,
} from './pdf-pages-core'
import type { PageBox, PageScope } from './pdf-pages-core'
import { NumberField, PageScopeField, ProofPanel } from './pdf-pages-ui'

type Axis = 'vertical' | 'horizontal'
type Order = 'natural' | 'reversed'

interface PreviewState {
  url: string
  page: number
  ratio: number
}

interface Outcome {
  blob: Blob
  name: string
  inputPages: number
  outputPages: number
  splitPages: number
}

export default function SplitPdfPagesInHalf() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pageNo, setPageNo] = useState(1)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const [axis, setAxis] = useState<Axis>('vertical')
  const [position, setPosition] = useState(50)
  const [gutterMm, setGutterMm] = useState(0)
  const [order, setOrder] = useState<Order>('natural')
  const [onlyWide, setOnlyWide] = useState(true)
  const [scope, setScope] = useState<PageScope>('all')
  const [custom, setCustom] = useState('1-')

  const [detecting, setDetecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const onFiles = useCallback((files: File[]) => {
    const next = files[0]
    if (!next) return
    setFile(next)
    setPageNo(1)
    setPageCount(0)
    setPreview(null)
    setOutcome(null)
    setError(null)
  }, [])

  useEffect(() => {
    if (!file) return
    let cancelled = false
    let created: string | null = null

    const run = async () => {
      setLoadingPreview(true)
      try {
        const bytes = await readFileBytes(file)
        const pdfjs = await loadPdfjs()
        const doc = await pdfjs.getDocument({ data: copyBytes(bytes) })
          .promise
        if (cancelled) {
          void doc.loadingTask.destroy()
          return
        }
        const total = doc.numPages
        const wanted = clamp(pageNo, 1, total)
        const page = await doc.getPage(wanted)
        const { canvas, widthPt, heightPt } = await renderPageToCanvas(page, 640, 2)
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.85),
        )
        void doc.loadingTask.destroy()
        if (cancelled) return
        const url = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/jpeg', 0.85)
        if (blob) created = url
        setPageCount(total)
        setPreview({ url, page: wanted, ratio: widthPt / heightPt })
        setError(null)
      } catch (err) {
        if (!cancelled) setError(humanPdfError(err, file.name))
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    }

    void run()
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [file, pageNo])

  const detectSpine = useCallback(async () => {
    if (!file) return
    setDetecting(true)
    setError(null)
    try {
      const bytes = await readFileBytes(file)
      const pdfjs = await loadPdfjs()
      const doc = await pdfjs.getDocument({ data: copyBytes(bytes) }).promise
      const page = await doc.getPage(clamp(pageNo, 1, doc.numPages))
      const { canvas } = await renderPageToCanvas(page, 600, 1)
      let profile: number[]
      if (axis === 'vertical') {
        profile = columnInkProfile(canvas)
      } else {
        // Rotate the sampling by reading rows instead of columns.
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        const { width, height } = canvas
        const data = ctx ? ctx.getImageData(0, 0, width, height).data : new Uint8ClampedArray(0)
        profile = new Array<number>(height).fill(0)
        for (let y = 0; y < height; y++) {
          const row = y * width * 4
          for (let x = 0; x < width; x++) {
            const i = row + x * 4
            const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
            if (luma < 200) profile[y] += 1
          }
        }
      }
      void doc.loadingTask.destroy()
      const gutter = findGutter(profile)
      if (gutter === null) {
        setError(
          'No clear gutter was found on this page: the content runs through the middle. Set the split position by hand, or preview a page that shows the spine.',
        )
        return
      }
      setPosition(Number((gutter * 100).toFixed(1)))
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setDetecting(false)
    }
  }, [axis, file, pageNo])

  const run = useCallback(async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setOutcome(null)
    setProgress(0)
    setStatus('Reading the document…')

    try {
      const bytes = await readFileBytes(file)
      const lib = await loadPdfLib()
      const src = await lib.PDFDocument.load(bytes, { updateMetadata: false })
      const srcPages = src.getPages()
      const total = srcPages.length
      setPageCount(total)
      const selected = resolveScope(scope, custom, total)

      const out = await lib.PDFDocument.create()
      const title = src.getTitle()
      if (title) out.setTitle(title)

      /* Decide, page by page, whether it gets split. */
      const plan: { index: number; split: boolean }[] = []
      for (let i = 0; i < total; i++) {
        const g = geomOf(srcPages[i])
        const d = displaySize(g)
        const eligible =
          selected.has(i + 1) &&
          (!onlyWide || (axis === 'vertical' ? d.w > d.h : d.h > d.w))
        plan.push({ index: i, split: eligible })
      }
      const splitCount = plan.filter((p) => p.split).length
      if (splitCount === 0) {
        throw new Error(
          onlyWide
            ? 'No page in that selection is wider than it is tall, so nothing was split. Turn off “only split wide pages” to split every page anyway.'
            : 'That page selection is empty, so nothing would be split.',
        )
      }

      setStatus('Preparing halves…')
      const gutterPt = mmToPt(gutterMm)
      const fraction = clamp(position / 100, 0.05, 0.95)

      const embedTargets: { page: (typeof srcPages)[number]; box: PageBox }[] = []
      const halfIndex: number[][] = []

      for (const item of plan) {
        if (!item.split) {
          halfIndex.push([])
          continue
        }
        const page = srcPages[item.index]
        const g = geomOf(page)
        const d = displaySize(g)
        let boxA: PageBox
        let boxB: PageBox
        if (axis === 'vertical') {
          const cut = d.w * fraction
          boxA = displayRectToPageBox(g, 0, 0, Math.max(1, cut - gutterPt / 2), d.h)
          boxB = displayRectToPageBox(g, Math.min(d.w - 1, cut + gutterPt / 2), 0, d.w, d.h)
        } else {
          const cut = d.h * fraction
          boxA = displayRectToPageBox(g, 0, 0, d.w, Math.max(1, cut - gutterPt / 2))
          boxB = displayRectToPageBox(g, 0, Math.min(d.h - 1, cut + gutterPt / 2), d.w, d.h)
        }
        const base = embedTargets.length
        embedTargets.push({ page, box: boxA }, { page, box: boxB })
        halfIndex.push([base, base + 1])
      }

      const embedded = await out.embedPages(
        embedTargets.map((t) => t.page),
        embedTargets.map((t) => t.box),
      )

      setStatus(`Building ${splitCount * 2} new pages…`)
      const copies = await out.copyPages(
        src,
        plan.filter((p) => !p.split).map((p) => p.index),
      )
      let copyCursor = 0

      for (let i = 0; i < plan.length; i++) {
        const item = plan[i]
        if (!item.split) {
          out.addPage(copies[copyCursor++])
        } else {
          const g = geomOf(srcPages[item.index])
          const [a, b] = halfIndex[i]
          const pairs = order === 'reversed' ? [embedded[b], embedded[a]] : [embedded[a], embedded[b]]
          for (const emb of pairs) {
            const size = embeddedDisplaySize(emb, g.rotation)
            const page = out.addPage([size.w, size.h])
            drawEmbeddedRotated(lib, page, emb, g.rotation, 0, 0, 1)
          }
        }
        if (i % 10 === 9) {
          setProgress(Math.round(((i + 1) / plan.length) * 100))
          await nextFrame()
        }
      }

      setStatus('Writing the PDF…')
      const outBytes = await out.save({ useObjectStreams: false })
      setProgress(100)
      setOutcome({
        blob: pdfBlob(outBytes),
        name: outputName(file.name, '-split-pages'),
        inputPages: total,
        outputPages: out.getPageCount(),
        splitPages: splitCount,
      })
      setStatus('')
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }, [axis, custom, file, gutterMm, onlyWide, order, position, scope])

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={onFiles}
          title="Drop a scanned book or two-up PDF"
          hint="or click to browse"
        />
        <ProofPanel what="Your scan" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Where to cut"
        description="The blue line is the cut. Slide it onto the spine, or let the tool find the gutter for you."
      >
        {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-3">
            <div className="relative mx-auto w-full max-w-lg">
              {preview ? (
                <div className="relative">
                  <img
                    src={preview.url}
                    alt={`Page ${preview.page} of ${file.name}`}
                    className="block h-auto w-full rounded-md bg-card"
                    draggable={false}
                  />
                  {axis === 'vertical' ? (
                    <div
                      className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary"
                      style={{ left: `${position}%` }}
                      aria-hidden="true"
                    />
                  ) : (
                    <div
                      className="pointer-events-none absolute inset-x-0 h-0.5 -translate-y-1/2 bg-primary"
                      style={{ top: `${position}%` }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              ) : (
                <div
                  className="grid aspect-[1.414/1] w-full place-items-center rounded-md bg-muted text-sm text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  {loadingPreview ? 'Rendering page…' : 'Preview unavailable'}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Previous page"
                disabled={pageNo <= 1 || loadingPreview}
                onClick={() => setPageNo((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <span className="min-w-28 text-center text-sm tabular-nums text-muted-foreground">
                Page {preview?.page ?? pageNo}
                {pageCount ? ` of ${pageCount}` : ''}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Next page"
                disabled={pageCount === 0 || pageNo >= pageCount || loadingPreview}
                onClick={() => setPageNo((p) => Math.min(pageCount || p, p + 1))}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Cut direction</legend>
              <RadioGroup
                value={axis}
                onValueChange={(v) => setAxis(v as Axis)}
                className="gap-2"
                disabled={busy}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="vertical" id="axis-vertical" />
                  <Label htmlFor="axis-vertical" className="cursor-pointer font-normal">
                    Vertical: two side-by-side pages
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="horizontal" id="axis-horizontal" />
                  <Label htmlFor="axis-horizontal" className="cursor-pointer font-normal">
                    Horizontal: two stacked pages
                  </Label>
                </div>
              </RadioGroup>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="split-position">
                Split position ·{' '}
                <span className="tabular-nums text-muted-foreground">{position.toFixed(1)}%</span>
              </Label>
              <Slider
                id="split-position"
                min={5}
                max={95}
                step={0.5}
                value={[position]}
                onValueChange={([v]) => setPosition(v)}
                disabled={busy}
                aria-label="Split position as a percentage of page width"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => void detectSpine()}
                disabled={detecting || busy || loadingPreview}
              >
                <Wand2 className="size-4" aria-hidden="true" />
                {detecting ? 'Scanning…' : 'Find the spine'}
              </Button>
            </div>

            <NumberField
              label="Trim at the cut"
              suffix="mm"
              min={0}
              max={40}
              step={0.5}
              value={gutterMm}
              onChange={setGutterMm}
              hint="Removes this much from the inner edge of both halves. Use it for the dark curve of a book spine."
            />

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Reading order</legend>
              <RadioGroup
                value={order}
                onValueChange={(v) => setOrder(v as Order)}
                className="gap-2"
                disabled={busy}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="natural" id="order-natural" />
                  <Label htmlFor="order-natural" className="cursor-pointer font-normal">
                    {axis === 'vertical' ? 'Left half first' : 'Top half first'}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="reversed" id="order-reversed" />
                  <Label htmlFor="order-reversed" className="cursor-pointer font-normal">
                    {axis === 'vertical'
                      ? 'Right half first (Arabic, Hebrew, manga)'
                      : 'Bottom half first'}
                  </Label>
                </div>
              </RadioGroup>
            </fieldset>

            <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
              <div className="min-w-0">
                <Label htmlFor="only-wide" className="cursor-pointer">
                  Only split {axis === 'vertical' ? 'wide' : 'tall'} pages
                </Label>
                <p className="mt-1 text-xs text-muted-foreground text-pretty">
                  Leaves the cover and any single-page scans alone.
                </p>
              </div>
              <Switch
                id="only-wide"
                checked={onlyWide}
                onCheckedChange={setOnlyWide}
                disabled={busy}
              />
            </div>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel title="Which pages">
        <PageScopeField
          scope={scope}
          onScopeChange={setScope}
          custom={custom}
          onCustomChange={setCustom}
          pageCount={pageCount}
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" className="gap-2" onClick={() => void run()} disabled={busy}>
            <BookOpen className="size-4" aria-hidden="true" />
            {busy ? 'Splitting…' : 'Split pages in half'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFile(null)
              setOutcome(null)
              setError(null)
            }}
            disabled={busy}
          >
            Use a different file
          </Button>
        </div>
      </ToolPanel>

      {busy && <ProgressPanel label={status || 'Splitting…'} value={progress} />}

      {outcome && (
        <ToolPanel title="Split complete">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Pages in" value={outcome.inputPages} />
            <ResultStat label="Pages out" value={outcome.outputPages} emphasis />
            <ResultStat label="Output size" value={formatBytes(outcome.blob.size)} />
          </div>
          <p className="text-sm text-muted-foreground text-pretty">
            {outcome.splitPages} page{outcome.splitPages === 1 ? ' was' : 's were'} cut in two; the
            rest were copied through unchanged. Halves are clipped, not re-rendered, so a 600 DPI
            scan stays a 600 DPI scan.
          </p>
          <DownloadButton blob={outcome.blob} filename={outcome.name} label="Download split PDF" />
        </ToolPanel>
      )}

      <ProofPanel what="Your scan" />
    </div>
  )
}
