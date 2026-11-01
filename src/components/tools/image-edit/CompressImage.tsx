import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Shrink, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileChips } from '@/components/shared/FileChips'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { clamp, formatBytes, nextFrame } from '@/lib/utils'
import { ResultsGrid } from './ResultsGrid'
import {
  createCanvas,
  decodeImage,
  encodeCanvas,
  errorMessage,
  formatFromFile,
  get2d,
  IMAGE_ACCEPT,
  isLossy,
  nextId,
  outputName,
  resizeCanvas,
  revokeAll,
  savingsPercent,
  type OutputFormat,
  type ProcessedItem,
} from './image-utils'

type Mode = 'quality' | 'size'

interface Original {
  name: string
  size: number
  url: string
}

interface EncodeOutcome {
  blob: Blob
  canvasWidth: number
  canvasHeight: number
  quality: number
  hitTarget: boolean
}

/** Binary-search the quality parameter (or, for PNG, the scale) to land under `targetBytes`. */
async function encodeToTarget(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  targetBytes: number,
  onStep: (attempt: number) => void,
): Promise<EncodeOutcome> {
  if (isLossy(format)) {
    let lo = 0.04
    let hi = 1
    let best: Blob | null = null
    let bestQ = lo

    const top = await encodeCanvas(canvas, format, hi)
    onStep(1)
    if (top.size <= targetBytes) {
      return { blob: top, canvasWidth: canvas.width, canvasHeight: canvas.height, quality: 1, hitTarget: true }
    }
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2
      const blob = await encodeCanvas(canvas, format, mid)
      onStep(i + 2)
      await nextFrame()
      if (blob.size <= targetBytes) {
        best = blob
        bestQ = mid
        lo = mid
      } else {
        hi = mid
      }
    }
    if (!best) {
      best = await encodeCanvas(canvas, format, 0.04)
      bestQ = 0.04
    }
    return {
      blob: best,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      quality: bestQ,
      hitTarget: best.size <= targetBytes,
    }
  }

  // PNG is lossless: the only lever is pixel count, so search the scale factor.
  const full = await encodeCanvas(canvas, 'png', 1)
  onStep(1)
  if (full.size <= targetBytes) {
    return { blob: full, canvasWidth: canvas.width, canvasHeight: canvas.height, quality: 1, hitTarget: true }
  }
  let lo = 0.05
  let hi = 1
  let best: EncodeOutcome | null = null
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2
    const scaled = await resizeCanvas(canvas, Math.max(1, canvas.width * mid), Math.max(1, canvas.height * mid))
    const blob = await encodeCanvas(scaled, 'png', 1)
    onStep(i + 2)
    await nextFrame()
    if (blob.size <= targetBytes) {
      best = { blob, canvasWidth: scaled.width, canvasHeight: scaled.height, quality: mid, hitTarget: true }
      lo = mid
    } else {
      hi = mid
    }
  }
  if (best) return best
  const smallest = await resizeCanvas(canvas, Math.max(1, canvas.width * 0.05), Math.max(1, canvas.height * 0.05))
  const blob = await encodeCanvas(smallest, 'png', 1)
  return {
    blob,
    canvasWidth: smallest.width,
    canvasHeight: smallest.height,
    quality: 0.05,
    hitTarget: blob.size <= targetBytes,
  }
}

/* ────────────────────── split comparison slider ────────────────────── */

function SplitCompare({
  before,
  after,
  beforeSize,
  afterSize,
}: {
  before: string
  after: string
  beforeSize: number
  afterSize: number
}) {
  const [pos, setPos] = useState(50)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)

  const setFromClientX = useCallback((clientX: number) => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) return
    setPos(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100))
  }, [])

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    setFromClientX(e.clientX)
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    setFromClientX(e.clientX)
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }
  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 2
    if (e.key === 'ArrowLeft') setPos((p) => clamp(p - step, 0, 100))
    else if (e.key === 'ArrowRight') setPos((p) => clamp(p + step, 0, 100))
    else if (e.key === 'Home') setPos(0)
    else if (e.key === 'End') setPos(100)
    else return
    e.preventDefault()
  }

  return (
    <div className="space-y-2">
      <div
        ref={wrapRef}
        className="relative select-none overflow-hidden rounded-lg bg-muted"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'none', cursor: 'ew-resize' }}
      >
        <img src={before} alt="Original" className="block h-auto w-full" draggable={false} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <img
            src={after}
            alt="Compressed"
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
        </div>

        <span className="pointer-events-none absolute left-2 top-2 rounded bg-background/85 px-2 py-1 text-xs font-medium">
          Compressed · {formatBytes(afterSize)}
        </span>
        <span className="pointer-events-none absolute right-2 top-2 rounded bg-background/85 px-2 py-1 text-xs font-medium">
          Original · {formatBytes(beforeSize)}
        </span>

        <div
          role="slider"
          tabIndex={0}
          aria-label="Comparison position: left shows the compressed image, right shows the original"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={`${Math.round(pos)}% compressed`}
          onKeyDown={onKeyDown}
          className="absolute inset-y-0 w-1 -translate-x-1/2 bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          style={{ left: `${pos}%` }}
        >
          <span className="absolute left-1/2 top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-primary bg-background text-xs font-bold text-primary">
            ⇔
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag the divider (or focus it and use the arrow keys) to compare. Left of the line is the
        compressed result.
      </p>
    </div>
  )
}

/* ────────────────────────────── tool ────────────────────────────── */

export default function CompressImage() {
  const [files, setFiles] = useState<File[]>([])
  const [originals, setOriginals] = useState<Original[]>([])
  const [mode, setMode] = useState<Mode>('quality')
  const [quality, setQuality] = useState(75)
  const [targetKb, setTargetKb] = useState('200')
  const [format, setFormat] = useState<'auto' | OutputFormat>('auto')
  const [limitWidth, setLimitWidth] = useState(false)
  const [maxWidth, setMaxWidth] = useState('1920')

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ProcessedItem[]>([])
  const [missed, setMissed] = useState<string[]>([])
  const [compareIndex, setCompareIndex] = useState(0)

  const resultsRef = useRef<ProcessedItem[]>([])
  resultsRef.current = results
  const originalsRef = useRef<Original[]>([])
  originalsRef.current = originals

  useEffect(
    () => () => {
      revokeAll(resultsRef.current)
      for (const o of originalsRef.current) URL.revokeObjectURL(o.url)
    },
    [],
  )

  const clearResults = useCallback(() => {
    setResults((prev) => {
      revokeAll(prev)
      return []
    })
    setMissed([])
  }, [])

  const onFiles = useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return
      setError(null)
      clearResults()
      setFiles((prev) => [...prev, ...incoming])
      setOriginals((prev) => [
        ...prev,
        ...incoming.map((f) => ({ name: f.name, size: f.size, url: URL.createObjectURL(f) })),
      ])
    },
    [clearResults],
  )

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setOriginals((prev) => {
      const gone = prev[index]
      if (gone) URL.revokeObjectURL(gone.url)
      return prev.filter((_, i) => i !== index)
    })
    clearResults()
    setCompareIndex(0)
  }

  function reorderFiles(from: number, to: number) {
    const move = <T,>(arr: T[]): T[] => {
      const next = [...arr]
      const [moved] = next.splice(from, 1)
      if (moved) next.splice(to, 0, moved)
      return next
    }
    setFiles(move)
    setOriginals(move)
  }

  async function run() {
    if (files.length === 0) return
    const target = Math.round(Number(targetKb) * 1024)
    if (mode === 'size' && (!Number.isFinite(target) || target < 1024)) {
      setError('Enter a target size of at least 1 KB.')
      return
    }

    setBusy(true)
    setError(null)
    clearResults()
    setProgress(0)
    const out: ProcessedItem[] = []
    const failedTarget: string[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i] as File
        const base = (i / files.length) * 100
        const span = 100 / files.length
        setStatus(`Compressing ${file.name} (${i + 1} of ${files.length})…`)
        setProgress(Math.round(base))
        await nextFrame()

        const { bitmap } = await decodeImage(file)
        const outFormat: OutputFormat = format === 'auto' ? formatFromFile(file) : format

        let canvas = createCanvas(bitmap.width, bitmap.height)
        const ctx = get2d(canvas)
        if (outFormat === 'jpeg') {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        ctx.drawImage(bitmap, 0, 0)
        bitmap.close()

        const capWidth = Number(maxWidth)
        if (limitWidth && Number.isFinite(capWidth) && capWidth > 0 && canvas.width > capWidth) {
          canvas = await resizeCanvas(canvas, capWidth, (canvas.height * capWidth) / canvas.width)
        }

        let blob: Blob
        let width = canvas.width
        let height = canvas.height
        if (mode === 'quality') {
          blob = await encodeCanvas(canvas, outFormat, quality / 100)
          setProgress(Math.round(base + span))
        } else {
          const outcome = await encodeToTarget(canvas, outFormat, target, (attempt) => {
            setProgress(Math.round(base + span * Math.min(1, attempt / 10)))
          })
          blob = outcome.blob
          width = outcome.canvasWidth
          height = outcome.canvasHeight
          if (!outcome.hitTarget) failedTarget.push(file.name)
        }

        out.push({
          id: nextId(),
          name: outputName(file, '-compressed', outFormat),
          blob,
          url: URL.createObjectURL(blob),
          width,
          height,
          originalSize: file.size,
        })
      }
      setProgress(100)
      setResults(out)
      setMissed(failedTarget)
      setCompareIndex(0)
      const totalIn = out.reduce((s, r) => s + r.originalSize, 0)
      const totalOut = out.reduce((s, r) => s + r.blob.size, 0)
      setStatus(
        `Compressed ${out.length} ${out.length === 1 ? 'image' : 'images'}, ${savingsPercent(totalIn, totalOut)}% smaller in total.`,
      )
    } catch (err) {
      revokeAll(out)
      setError(errorMessage(err, 'Compression failed. Try a different image.'))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const effectiveFormat: OutputFormat = format === 'auto' ? (files[0] ? formatFromFile(files[0]) : 'jpeg') : format
  const compareOriginal = originals[compareIndex]
  const compareResult = results[compareIndex]

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={IMAGE_ACCEPT}
        multiple
        onFiles={onFiles}
        maxSizeMb={200}
        title="Drop images here to compress"
        hint="JPG, PNG, WebP or AVIF"
      />

      {files.length > 0 && <FileChips files={files} onRemove={removeFile} onReorder={reorderFiles} />}

      {files.length > 0 && (
        <ToolPanel
          title="Compression settings"
          description="Pick a quality level, or name the file size you need and let the tool find the quality that fits."
          footer={
            <Button size="lg" onClick={run} disabled={busy}>
              <Shrink className="size-4" aria-hidden="true" />
              {busy ? 'Compressing…' : `Compress ${files.length} ${files.length === 1 ? 'image' : 'images'}`}
            </Button>
          }
        >
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="quality">By quality</TabsTrigger>
              <TabsTrigger value="size">By target file size</TabsTrigger>
            </TabsList>

            <TabsContent value="quality" className="space-y-3 pt-4">
              <Label id="compress-quality-label">Quality: {quality}</Label>
              <Slider
                aria-labelledby="compress-quality-label"
                min={5}
                max={100}
                step={1}
                value={[quality]}
                onValueChange={(v) => setQuality(v[0] ?? 75)}
              />
              <p className="text-xs text-muted-foreground">
                75–85 is the sweet spot for photographs. Below 50 you will start to see blocking
                around edges and in flat gradients.
              </p>
              {!isLossy(effectiveFormat) && (
                <p className="flex items-start gap-2 rounded-md bg-muted p-2 text-xs">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    PNG is lossless, so the quality slider has no effect. Switch the output format to
                    JPEG or WebP below for real savings, or use the target-size mode which shrinks the
                    pixel dimensions instead.
                  </span>
                </p>
              )}
            </TabsContent>

            <TabsContent value="size" className="space-y-3 pt-4">
              <div className="space-y-2">
                <Label htmlFor="compress-target">Target file size (KB)</Label>
                <Input
                  id="compress-target"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={targetKb}
                  onChange={(e) => setTargetKb(e.target.value)}
                  className="max-w-40"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[50, 100, 200, 500, 1024].map((kb) => (
                  <Button
                    key={kb}
                    type="button"
                    size="sm"
                    variant={Number(targetKb) === kb ? 'default' : 'outline'}
                    onClick={() => setTargetKb(String(kb))}
                  >
                    {kb >= 1024 ? '1 MB' : `${kb} KB`}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Each image is encoded up to ten times, halving the search range each round, until the
                highest quality that still fits under your limit is found.
              </p>
            </TabsContent>
          </Tabs>

          <div className="mt-6 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="compress-format">Output format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as 'auto' | OutputFormat)}>
                <SelectTrigger id="compress-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Keep original format</SelectItem>
                  <SelectItem value="jpeg">JPEG (smallest for photos)</SelectItem>
                  <SelectItem value="webp">WebP (~30% smaller than JPEG)</SelectItem>
                  <SelectItem value="png">PNG (lossless)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="compress-limit-width"
                  checked={limitWidth}
                  onCheckedChange={(v) => setLimitWidth(v === true)}
                />
                <Label htmlFor="compress-limit-width" className="font-normal">
                  Also limit the width
                </Label>
              </div>
              <Input
                id="compress-max-width"
                type="number"
                min={16}
                inputMode="numeric"
                aria-label="Maximum width in pixels"
                value={maxWidth}
                disabled={!limitWidth}
                onChange={(e) => setMaxWidth(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Downscaling is usually the biggest single saving for photos headed to the web.
              </p>
            </div>
          </div>
        </ToolPanel>
      )}

      {busy && <ProgressPanel label={status || 'Compressing…'} value={progress} />}

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {missed.length > 0 && (
        <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Could not reach the target size for {missed.join(', ')} even at the lowest quality. Try a
            larger target, WebP output, or limiting the width.
          </span>
        </p>
      )}

      {compareOriginal && compareResult && (
        <ToolPanel
          title="Before and after"
          description="The two images are rendered at the same size so you can judge the loss honestly."
        >
          {results.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {results.map((r, i) => (
                <Button
                  key={r.id}
                  size="sm"
                  variant={i === compareIndex ? 'default' : 'outline'}
                  onClick={() => setCompareIndex(i)}
                >
                  {i + 1}
                </Button>
              ))}
            </div>
          )}
          <SplitCompare
            before={compareOriginal.url}
            after={compareResult.url}
            beforeSize={compareOriginal.size}
            afterSize={compareResult.blob.size}
          />
        </ToolPanel>
      )}

      <ResultsGrid
        items={results}
        zipName="compressed-images"
        showSavings
        onReset={() => {
          clearResults()
          setOriginals((prev) => {
            for (const o of prev) URL.revokeObjectURL(o.url)
            return []
          })
          setFiles([])
          setStatus('')
        }}
      />
    </div>
  )
}
