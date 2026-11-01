import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Crop, RotateCcw, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { clamp, cn, formatBytes, nextFrame } from '@/lib/utils'
import {
  copyBytes,
  describePageSize,
  displayRectToPageBox,
  displaySize,
  geomOf,
  humanPdfError,
  inkBounds,
  loadPdfjs,
  loadPdfLib,
  outputName,
  pdfBlob,
  ptToMm,
  readFileBytes,
  renderPageToCanvas,
  resolveScope,
} from './pdf-pages-core'
import type { PageScope } from './pdf-pages-core'
import { NumberField, PageScopeField, ProofPanel } from './pdf-pages-ui'

interface CropRect {
  /** Edge positions as fractions 0..1 of the displayed page. */
  l: number
  t: number
  r: number
  b: number
}

const FULL: CropRect = { l: 0, t: 0, r: 1, b: 1 }

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move' | 'new'

interface PreviewState {
  url: string
  widthPt: number
  heightPt: number
  page: number
}

const MIN_SPAN = 0.02

function clampRect(rect: CropRect): CropRect {
  const l = clamp(rect.l, 0, 1 - MIN_SPAN)
  const t = clamp(rect.t, 0, 1 - MIN_SPAN)
  const r = clamp(rect.r, l + MIN_SPAN, 1)
  const b = clamp(rect.b, t + MIN_SPAN, 1)
  return { l, t, r, b }
}

export default function CropPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pageNo, setPageNo] = useState(1)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const [rect, setRect] = useState<CropRect>(FULL)
  const [scope, setScope] = useState<PageScope>('all')
  const [custom, setCustom] = useState('1-')
  const [shrinkMediaBox, setShrinkMediaBox] = useState(true)

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [result, setResult] = useState<{ blob: Blob; name: string; pages: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const surfaceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ handle: Handle; start: CropRect; px: number; py: number } | null>(null)

  const reset = useCallback(() => {
    setFile(null)
    setPageCount(0)
    setPageNo(1)
    setPreview(null)
    setRect(FULL)
    setResult(null)
    setError(null)
    setProgress(0)
    setStatus('')
  }, [])

  const onFiles = useCallback((files: File[]) => {
    const next = files[0]
    if (!next) return
    setFile(next)
    setPageCount(0)
    setPageNo(1)
    setPreview(null)
    setRect(FULL)
    setResult(null)
    setError(null)
  }, [])

  /* Render the previewed page. */
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
        const { canvas, widthPt, heightPt } = await renderPageToCanvas(page, 700, 3)
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.88),
        )
        void doc.loadingTask.destroy()
        if (cancelled) return
        const url = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/jpeg', 0.88)
        if (blob) created = url
        setPageCount(total)
        setPreview({ url, widthPt, heightPt, page: wanted })
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

  /* Pointer dragging on the crop rectangle. */
  const beginDrag = (handle: Handle) => (event: ReactPointerEvent<HTMLElement>) => {
    const surface = surfaceRef.current
    if (!surface) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = surface.getBoundingClientRect()
    dragRef.current = {
      handle,
      start: rect,
      px: (event.clientX - bounds.left) / bounds.width,
      py: (event.clientY - bounds.top) / bounds.height,
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  }

  const onSurfacePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Dragging on the dimmed area draws a brand-new rectangle.
    const surface = surfaceRef.current
    if (!surface || dragRef.current) return
    const bounds = surface.getBoundingClientRect()
    const px = (event.clientX - bounds.left) / bounds.width
    const py = (event.clientY - bounds.top) / bounds.height
    setRect(clampRect({ l: px, t: py, r: px + MIN_SPAN, b: py + MIN_SPAN }))
    dragRef.current = {
      handle: 'new',
      start: { l: px, t: py, r: px, b: py },
      px,
      py,
    }
    surface.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    const surface = surfaceRef.current
    if (!drag || !surface) return
    const bounds = surface.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width
    const y = (event.clientY - bounds.top) / bounds.height
    const dx = x - drag.px
    const dy = y - drag.py
    const s = drag.start
    let next: CropRect

    if (drag.handle === 'new') {
      // Dragging on the dimmed area draws a fresh rectangle in any direction.
      next = clampRect({
        l: Math.min(drag.px, x),
        t: Math.min(drag.py, y),
        r: Math.max(drag.px, x),
        b: Math.max(drag.py, y),
      })
    } else if (drag.handle === 'move') {
      const w = s.r - s.l
      const h = s.b - s.t
      const l = clamp(s.l + dx, 0, 1 - w)
      const t = clamp(s.t + dy, 0, 1 - h)
      next = { l, t, r: l + w, b: t + h }
    } else {
      next = { ...s }
      if (drag.handle.includes('w')) next.l = Math.min(x, s.r - MIN_SPAN)
      if (drag.handle.includes('e')) next.r = Math.max(x, s.l + MIN_SPAN)
      if (drag.handle.includes('n')) next.t = Math.min(y, s.b - MIN_SPAN)
      if (drag.handle.includes('s')) next.b = Math.max(y, s.t + MIN_SPAN)
      next = clampRect(next)
    }
    setRect(next)
  }

  const endDrag = () => {
    dragRef.current = null
  }

  /* Displayed page size in points, used for the millimetre readouts. */
  const display = useMemo(() => {
    if (!preview) return null
    return { w: preview.widthPt, h: preview.heightPt }
  }, [preview])

  const mm = useMemo(() => {
    if (!display) return null
    return {
      left: ptToMm(rect.l * display.w),
      top: ptToMm(rect.t * display.h),
      right: ptToMm((1 - rect.r) * display.w),
      bottom: ptToMm((1 - rect.b) * display.h),
      width: ptToMm((rect.r - rect.l) * display.w),
      height: ptToMm((rect.b - rect.t) * display.h),
    }
  }, [display, rect])

  const setMargin = (side: 'left' | 'top' | 'right' | 'bottom', valueMm: number) => {
    if (!display) return
    const fx = (valueMm / ptToMm(display.w))
    const fy = (valueMm / ptToMm(display.h))
    setRect((prev) => {
      const next = { ...prev }
      if (side === 'left') next.l = fx
      if (side === 'right') next.r = 1 - fx
      if (side === 'top') next.t = fy
      if (side === 'bottom') next.b = 1 - fy
      return clampRect(next)
    })
  }

  /* Auto-detect margins on the previewed page. */
  const autoDetect = useCallback(async () => {
    if (!file) return
    setDetecting(true)
    setError(null)
    try {
      const bytes = await readFileBytes(file)
      const pdfjs = await loadPdfjs()
      const doc = await pdfjs.getDocument({ data: copyBytes(bytes) }).promise
      const page = await doc.getPage(clamp(pageNo, 1, doc.numPages))
      const { canvas } = await renderPageToCanvas(page, 420, 1)
      const bounds = inkBounds(canvas)
      void doc.loadingTask.destroy()
      if (!bounds) {
        setError(
          'No content was found on this page, so there is nothing to crop to. It may be a blank page. Try previewing a different one.',
        )
        return
      }
      // 2 mm of breathing room so descenders and rules are not clipped.
      const padX = 2 / ptToMm(preview?.widthPt ?? 595)
      const padY = 2 / ptToMm(preview?.heightPt ?? 842)
      setRect(
        clampRect({
          l: bounds.left - padX,
          t: bounds.top - padY,
          r: bounds.right + padX,
          b: bounds.bottom + padY,
        }),
      )
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setDetecting(false)
    }
  }, [file, pageNo, preview])

  const apply = useCallback(async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setResult(null)
    setProgress(0)
    setStatus('Reading the document…')

    try {
      const bytes = await readFileBytes(file)
      const lib = await loadPdfLib()
      const doc = await lib.PDFDocument.load(bytes, { updateMetadata: false })
      const pages = doc.getPages()
      const total = pages.length
      const selected = resolveScope(scope, custom, total)

      if (selected.size === 0) {
        throw new Error('That page selection is empty, so nothing would be cropped.')
      }

      setStatus(`Cropping ${selected.size} of ${total} pages…`)
      let done = 0
      for (let i = 0; i < total; i++) {
        const page = pages[i]
        if (selected.has(i + 1)) {
          const g = geomOf(page)
          const d = displaySize(g)
          const box = displayRectToPageBox(
            g,
            rect.l * d.w,
            rect.t * d.h,
            rect.r * d.w,
            rect.b * d.h,
          )
          const w = box.right - box.left
          const h = box.top - box.bottom
          if (w > 1 && h > 1) {
            page.setCropBox(box.left, box.bottom, w, h)
            if (shrinkMediaBox) page.setMediaBox(box.left, box.bottom, w, h)
          }
          done++
        }
        if (i % 25 === 24) {
          setProgress(Math.round(((i + 1) / total) * 100))
          await nextFrame()
        }
      }

      setProgress(100)
      setStatus('Writing the PDF…')
      const out = await doc.save({ useObjectStreams: false })
      setResult({
        blob: pdfBlob(out),
        name: outputName(file.name, '-cropped'),
        pages: done,
      })
      setStatus('')
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }, [custom, file, rect, scope, shrinkMediaBox])

  const cropped = rect.l > 0.001 || rect.t > 0.001 || rect.r < 0.999 || rect.b < 0.999

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={onFiles}
          title="Drop a PDF here to crop it"
          hint="or click to browse"
        />
        <ProofPanel what="Your PDF" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Crop area"
        description="Drag the handles, or type exact trim margins. The same crop is applied proportionally to every page you select."
      >
        {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          {/* Preview + overlay */}
          <div className="space-y-3">
            <div className="relative mx-auto w-full max-w-md select-none">
              {preview ? (
                <div
                  ref={surfaceRef}
                  className="relative touch-none"
                  onPointerDown={onSurfacePointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <img
                    src={preview.url}
                    alt={`Page ${preview.page} of ${file.name}`}
                    className="block h-auto w-full rounded-md bg-card"
                    draggable={false}
                  />

                  {/*
                    Dimmed area outside the crop. The page render underneath is
                    always white paper, so the scrim has to be dark in both
                    themes — hence the explicit dark: override.
                  */}
                  <div
                    className="pointer-events-none absolute inset-0 bg-foreground/45 dark:bg-background/70"
                    style={{
                      clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${rect.l * 100}% ${rect.t * 100}%, ${rect.l * 100}% ${rect.b * 100}%, ${rect.r * 100}% ${rect.b * 100}%, ${rect.r * 100}% ${rect.t * 100}%, ${rect.l * 100}% ${rect.t * 100}%)`,
                    }}
                    aria-hidden="true"
                  />

                  {/* The crop rectangle */}
                  <div
                    role="group"
                    aria-label="Crop rectangle"
                    className="absolute border-2 border-primary"
                    style={{
                      left: `${rect.l * 100}%`,
                      top: `${rect.t * 100}%`,
                      width: `${(rect.r - rect.l) * 100}%`,
                      height: `${(rect.b - rect.t) * 100}%`,
                      cursor: 'move',
                    }}
                    onPointerDown={beginDrag('move')}
                  >
                    {/*
                      Pointer capture retargets move/up events to the handle,
                      but they still bubble to the surface, whose single
                      handler drives every drag.
                    */}
                    {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((h) => (
                      <span
                        key={h}
                        onPointerDown={beginDrag(h)}
                        className={cn(
                          'absolute size-4 rounded-full border-2 border-background bg-primary',
                          h === 'nw' && '-left-2 -top-2 cursor-nwse-resize',
                          h === 'n' && 'left-1/2 -top-2 -ml-2 cursor-ns-resize',
                          h === 'ne' && '-right-2 -top-2 cursor-nesw-resize',
                          h === 'e' && '-right-2 top-1/2 -mt-2 cursor-ew-resize',
                          h === 'se' && '-right-2 -bottom-2 cursor-nwse-resize',
                          h === 's' && 'left-1/2 -bottom-2 -ml-2 cursor-ns-resize',
                          h === 'sw' && '-left-2 -bottom-2 cursor-nesw-resize',
                          h === 'w' && '-left-2 top-1/2 -mt-2 cursor-ew-resize',
                        )}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className="grid aspect-[1/1.414] w-full place-items-center rounded-md bg-muted text-sm text-muted-foreground"
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

          {/* Numeric controls — the keyboard route to the same result */}
          <div className="space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Trim from each edge</legend>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Left"
                  suffix="mm"
                  step={0.5}
                  min={0}
                  value={Number((mm?.left ?? 0).toFixed(1))}
                  onChange={(v) => setMargin('left', v)}
                />
                <NumberField
                  label="Right"
                  suffix="mm"
                  step={0.5}
                  min={0}
                  value={Number((mm?.right ?? 0).toFixed(1))}
                  onChange={(v) => setMargin('right', v)}
                />
                <NumberField
                  label="Top"
                  suffix="mm"
                  step={0.5}
                  min={0}
                  value={Number((mm?.top ?? 0).toFixed(1))}
                  onChange={(v) => setMargin('top', v)}
                />
                <NumberField
                  label="Bottom"
                  suffix="mm"
                  step={0.5}
                  min={0}
                  value={Number((mm?.bottom ?? 0).toFixed(1))}
                  onChange={(v) => setMargin('bottom', v)}
                />
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => void autoDetect()}
                disabled={detecting || loadingPreview}
              >
                <Wand2 className="size-4" aria-hidden="true" />
                {detecting ? 'Measuring…' : 'Auto-detect margins'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => setRect(FULL)}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset
              </Button>
            </div>

            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium text-foreground">Result page size</p>
              <p className="mt-1 tabular-nums text-muted-foreground">
                {mm ? `${mm.width.toFixed(1)} × ${mm.height.toFixed(1)} mm` : '–'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Was {preview ? describePageSize(preview.widthPt, preview.heightPt) : '–'}
              </p>
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

        <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
          <div className="min-w-0">
            <Label htmlFor="crop-mediabox" className="cursor-pointer">
              Shrink the MediaBox too
            </Label>
            <p className="mt-1 text-xs text-muted-foreground text-pretty">
              On by default, so printers and previewers that ignore the CropBox still show the
              cropped page. Turn it off to keep the original sheet size recorded in the file.
            </p>
          </div>
          <Switch
            id="crop-mediabox"
            checked={shrinkMediaBox}
            onCheckedChange={setShrinkMediaBox}
            disabled={busy}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="gap-2"
            onClick={() => void apply()}
            disabled={busy || !cropped}
          >
            <Crop className="size-4" aria-hidden="true" />
            {busy ? 'Cropping…' : 'Crop PDF'}
          </Button>
          <Button type="button" variant="ghost" onClick={reset} disabled={busy}>
            Use a different file
          </Button>
          {!cropped && (
            <span className="text-sm text-muted-foreground">
              Drag the rectangle or set a trim margin first.
            </span>
          )}
        </div>
      </ToolPanel>

      {busy && <ProgressPanel label={status || 'Cropping…'} value={progress} />}

      {result && (
        <ToolPanel title="Cropped PDF ready">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Pages cropped" value={result.pages} />
            <ResultStat label="Output size" value={formatBytes(result.blob.size)} />
            <ResultStat
              label="New page size"
              value={mm ? `${mm.width.toFixed(0)} × ${mm.height.toFixed(0)} mm` : '–'}
            />
          </div>
          <p className="text-sm text-muted-foreground text-pretty">
            Only the visible page box changed. Text, vectors and fonts are untouched, so the file
            stays selectable and searchable.
          </p>
          <DownloadButton blob={result.blob} filename={result.name} label="Download cropped PDF" />
        </ToolPanel>
      )}

      <ProofPanel what="Your PDF" />
    </div>
  )
}
