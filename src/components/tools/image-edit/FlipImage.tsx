import { useCallback, useEffect, useRef, useState } from 'react'
import { FlipHorizontal, FlipVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileChips } from '@/components/shared/FileChips'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { nextFrame } from '@/lib/utils'
import { CHECKER_STYLE, ResultsGrid } from './ResultsGrid'
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
  revokeAll,
  type OutputFormat,
  type ProcessedItem,
} from './image-utils'

function renderFlipped(
  source: CanvasImageSource,
  w: number,
  h: number,
  horizontal: boolean,
  vertical: boolean,
  background: string | null,
): HTMLCanvasElement {
  const canvas = createCanvas(w, h)
  const ctx = get2d(canvas)
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, w, h)
  }
  ctx.translate(horizontal ? w : 0, vertical ? h : 0)
  ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1)
  ctx.drawImage(source, 0, 0, w, h)
  return canvas
}

function downscale(bitmap: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(maxSide / bitmap.width, maxSide / bitmap.height, 1)
  const canvas = createCanvas(bitmap.width * scale, bitmap.height * scale)
  const ctx = get2d(canvas)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

export default function FlipImage() {
  const [files, setFiles] = useState<File[]>([])
  const [horizontal, setHorizontal] = useState(true)
  const [vertical, setVertical] = useState(false)
  const [format, setFormat] = useState<'auto' | OutputFormat>('auto')
  const [quality, setQuality] = useState(92)

  const [preview, setPreview] = useState<HTMLCanvasElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ProcessedItem[]>([])

  const resultsRef = useRef<ProcessedItem[]>([])
  resultsRef.current = results
  useEffect(() => () => revokeAll(resultsRef.current), [])

  const clearResults = useCallback(() => {
    setResults((prev) => {
      revokeAll(prev)
      return []
    })
  }, [])

  const onFiles = useCallback(
    async (incoming: File[]) => {
      if (incoming.length === 0) return
      setError(null)
      clearResults()
      const merged = [...files, ...incoming]
      setFiles(merged)
      try {
        const { bitmap } = await decodeImage(merged[0] as File)
        setPreview(downscale(bitmap, 560))
        bitmap.close()
      } catch (err) {
        setError(errorMessage(err, 'That image could not be read.'))
      }
    },
    [files, clearResults],
  )

  useEffect(() => {
    const target = previewCanvasRef.current
    if (!target || !preview) return
    const flipped = renderFlipped(preview, preview.width, preview.height, horizontal, vertical, null)
    target.width = flipped.width
    target.height = flipped.height
    const ctx = target.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, target.width, target.height)
    ctx.drawImage(flipped, 0, 0)
  }, [preview, horizontal, vertical])

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    clearResults()
  }

  function reorderFiles(from: number, to: number) {
    setFiles((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      if (moved) next.splice(to, 0, moved)
      return next
    })
  }

  async function run() {
    if (files.length === 0) return
    if (!horizontal && !vertical) {
      setError('Choose at least one direction: horizontal, vertical or both.')
      return
    }
    setBusy(true)
    setError(null)
    clearResults()
    setProgress(0)
    const out: ProcessedItem[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i] as File
        setStatus(`Flipping ${file.name} (${i + 1} of ${files.length})…`)
        setProgress(Math.round((i / files.length) * 100))
        await nextFrame()

        const { bitmap } = await decodeImage(file)
        const outFormat: OutputFormat = format === 'auto' ? formatFromFile(file) : format
        const canvas = renderFlipped(
          bitmap,
          bitmap.width,
          bitmap.height,
          horizontal,
          vertical,
          outFormat === 'jpeg' ? '#ffffff' : null,
        )
        bitmap.close()

        const suffix = horizontal && vertical ? '-flipped' : horizontal ? '-flipped-h' : '-flipped-v'
        const blob = await encodeCanvas(canvas, outFormat, quality / 100)
        out.push({
          id: nextId(),
          name: outputName(file, suffix, outFormat),
          blob,
          url: URL.createObjectURL(blob),
          width: canvas.width,
          height: canvas.height,
          originalSize: file.size,
        })
      }
      setProgress(100)
      setResults(out)
      setStatus(`Flipped ${out.length} ${out.length === 1 ? 'image' : 'images'}.`)
    } catch (err) {
      revokeAll(out)
      setError(errorMessage(err, 'Flipping failed. Try a different image.'))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const effectiveFormat: OutputFormat = format === 'auto' ? (files[0] ? formatFromFile(files[0]) : 'png') : format

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={IMAGE_ACCEPT}
        multiple
        onFiles={onFiles}
        maxSizeMb={200}
        title="Drop images here to flip"
        hint="Mirror horizontally, vertically or both"
      />

      {files.length > 0 && <FileChips files={files} onRemove={removeFile} onReorder={reorderFiles} />}

      {files.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ToolPanel title="Preview" description="Live preview of the first image.">
            <div
              className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-muted p-3"
              style={CHECKER_STYLE}
            >
              <canvas
                ref={previewCanvasRef}
                className="max-h-[55dvh] max-w-full"
                aria-label={`Preview flipped ${horizontal && vertical ? 'horizontally and vertically' : horizontal ? 'horizontally' : vertical ? 'vertically' : 'not at all'}`}
              />
            </div>
          </ToolPanel>

          <ToolPanel
            title="Direction"
            footer={
              <Button size="lg" onClick={run} disabled={busy} className="w-full">
                <FlipHorizontal className="size-4" aria-hidden="true" />
                {busy ? 'Flipping…' : `Flip ${files.length} ${files.length === 1 ? 'image' : 'images'}`}
              </Button>
            }
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4 rounded-md bg-muted p-3">
                <div className="flex items-center gap-3">
                  <FlipHorizontal className="size-5 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <Label htmlFor="flip-h">Flip horizontally</Label>
                    <p className="text-xs text-muted-foreground">Mirror left ↔ right</p>
                  </div>
                </div>
                <Switch
                  id="flip-h"
                  checked={horizontal}
                  onCheckedChange={(v) => {
                    clearResults()
                    setHorizontal(v)
                  }}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-md bg-muted p-3">
                <div className="flex items-center gap-3">
                  <FlipVertical className="size-5 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <Label htmlFor="flip-v">Flip vertically</Label>
                    <p className="text-xs text-muted-foreground">Mirror top ↕ bottom</p>
                  </div>
                </div>
                <Switch
                  id="flip-v"
                  checked={vertical}
                  onCheckedChange={(v) => {
                    clearResults()
                    setVertical(v)
                  }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Turning both on is the same as rotating the image 180°.
              </p>

              <div className="space-y-2">
                <Label htmlFor="flip-format">Output format</Label>
                <Select
                  value={format}
                  onValueChange={(v) => {
                    clearResults()
                    setFormat(v as 'auto' | OutputFormat)
                  }}
                >
                  <SelectTrigger id="flip-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Keep original format</SelectItem>
                    <SelectItem value="jpeg">JPEG (.jpg)</SelectItem>
                    <SelectItem value="png">PNG (.png)</SelectItem>
                    <SelectItem value="webp">WebP (.webp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLossy(effectiveFormat) && (
                <div className="space-y-2">
                  <Label id="flip-quality-label">Quality: {quality}</Label>
                  <Slider
                    aria-labelledby="flip-quality-label"
                    min={30}
                    max={100}
                    step={1}
                    value={[quality]}
                    onValueChange={(v) => setQuality(v[0] ?? 92)}
                  />
                </div>
              )}
            </div>
          </ToolPanel>
        </div>
      )}

      {busy && <ProgressPanel label={status || 'Flipping…'} value={progress} />}

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      <ResultsGrid
        items={results}
        zipName="flipped-images"
        transparent={effectiveFormat !== 'jpeg'}
        onReset={() => {
          clearResults()
          setFiles([])
          setPreview(null)
          setStatus('')
        }}
      />
    </div>
  )
}
