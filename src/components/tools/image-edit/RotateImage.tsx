import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCcw, RotateCw, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileChips } from '@/components/shared/FileChips'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { clamp, nextFrame } from '@/lib/utils'
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

type Fill = 'transparent' | 'white' | 'black' | 'custom'

const FILL_COLOR: Record<Exclude<Fill, 'custom'>, string | null> = {
  transparent: null,
  white: '#ffffff',
  black: '#000000',
}

/** Rotate a drawable source into a canvas that grows to fit the rotated bounds. */
function renderRotated(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  angleDeg: number,
  background: string | null,
): HTMLCanvasElement {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const nw = Math.max(1, Math.round(sw * cos + sh * sin))
  const nh = Math.max(1, Math.round(sw * sin + sh * cos))
  const canvas = createCanvas(nw, nh)
  const ctx = get2d(canvas)
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, nw, nh)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(nw / 2, nh / 2)
  ctx.rotate(rad)
  ctx.drawImage(source, -sw / 2, -sh / 2, sw, sh)
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

export default function RotateImage() {
  const [files, setFiles] = useState<File[]>([])
  const [angle, setAngle] = useState(0)
  const [fill, setFill] = useState<Fill>('transparent')
  const [customColor, setCustomColor] = useState('#1f2937')
  const [format, setFormat] = useState<'auto' | OutputFormat>('auto')
  const [quality, setQuality] = useState(92)

  const [preview, setPreview] = useState<HTMLCanvasElement | null>(null)
  const [sourceSize, setSourceSize] = useState<{ w: number; h: number } | null>(null)
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

  const background = fill === 'custom' ? customColor : FILL_COLOR[fill]

  const onFiles = useCallback(
    async (incoming: File[]) => {
      if (incoming.length === 0) return
      setError(null)
      clearResults()
      const merged = [...files, ...incoming]
      setFiles(merged)
      try {
        const { bitmap } = await decodeImage(merged[0] as File)
        setSourceSize({ w: bitmap.width, h: bitmap.height })
        setPreview(downscale(bitmap, 560))
        bitmap.close()
      } catch (err) {
        setError(errorMessage(err, 'That image could not be read.'))
      }
    },
    [files, clearResults],
  )

  // Redraw the live preview whenever the rotation settings change.
  useEffect(() => {
    const target = previewCanvasRef.current
    if (!target || !preview) return
    const rotated = renderRotated(preview, preview.width, preview.height, angle, background)
    target.width = rotated.width
    target.height = rotated.height
    const ctx = target.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, target.width, target.height)
    ctx.drawImage(rotated, 0, 0)
  }, [preview, angle, background])

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

  function step(delta: number) {
    clearResults()
    setAngle((a) => {
      let n = (a + delta) % 360
      if (n > 180) n -= 360
      if (n <= -180) n += 360
      return n
    })
  }

  async function run() {
    if (files.length === 0) return
    setBusy(true)
    setError(null)
    clearResults()
    setProgress(0)
    const out: ProcessedItem[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i] as File
        setStatus(`Rotating ${file.name} (${i + 1} of ${files.length})…`)
        setProgress(Math.round((i / files.length) * 100))
        await nextFrame()

        const { bitmap } = await decodeImage(file)
        const outFormat: OutputFormat = format === 'auto' ? formatFromFile(file) : format
        const bg = outFormat === 'jpeg' && !background ? '#ffffff' : background
        const canvas = renderRotated(bitmap, bitmap.width, bitmap.height, angle, bg)
        bitmap.close()

        const blob = await encodeCanvas(canvas, outFormat, quality / 100)
        out.push({
          id: nextId(),
          name: outputName(file, `-rotated-${Math.round(angle)}deg`, outFormat),
          blob,
          url: URL.createObjectURL(blob),
          width: canvas.width,
          height: canvas.height,
          originalSize: file.size,
        })
      }
      setProgress(100)
      setResults(out)
      setStatus(`Rotated ${out.length} ${out.length === 1 ? 'image' : 'images'} by ${angle}°.`)
    } catch (err) {
      revokeAll(out)
      setError(errorMessage(err, 'Rotation failed. Try a different image.'))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const effectiveFormat: OutputFormat = format === 'auto' ? (files[0] ? formatFromFile(files[0]) : 'png') : format
  const rad = (angle * Math.PI) / 180
  const outSize = sourceSize
    ? {
        w: Math.round(sourceSize.w * Math.abs(Math.cos(rad)) + sourceSize.h * Math.abs(Math.sin(rad))),
        h: Math.round(sourceSize.w * Math.abs(Math.sin(rad)) + sourceSize.h * Math.abs(Math.cos(rad))),
      }
    : null

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={IMAGE_ACCEPT}
        multiple
        onFiles={onFiles}
        maxSizeMb={200}
        title="Drop images here to rotate"
        hint="Straighten a scan or turn a batch of photos"
      />

      {files.length > 0 && <FileChips files={files} onRemove={removeFile} onReorder={reorderFiles} />}

      {files.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ToolPanel
            title="Preview"
            description={
              outSize && sourceSize
                ? `${sourceSize.w} × ${sourceSize.h} px → ${outSize.w} × ${outSize.h} px`
                : 'Live preview of the first image.'
            }
          >
            <div
              className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-muted p-3"
              style={CHECKER_STYLE}
            >
              <canvas
                ref={previewCanvasRef}
                className="max-h-[55dvh] max-w-full"
                aria-label={`Preview rotated by ${angle} degrees`}
              />
            </div>
          </ToolPanel>

          <ToolPanel
            title="Rotation"
            footer={
              <Button size="lg" onClick={run} disabled={busy} className="w-full">
                <RotateCw className="size-4" aria-hidden="true" />
                {busy ? 'Rotating…' : `Rotate ${files.length} ${files.length === 1 ? 'image' : 'images'}`}
              </Button>
            }
          >
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" onClick={() => step(-90)} aria-label="Rotate 90 degrees left">
                  <RotateCcw className="size-4" aria-hidden="true" />
                  90° left
                </Button>
                <Button variant="outline" onClick={() => step(90)} aria-label="Rotate 90 degrees right">
                  <RotateCw className="size-4" aria-hidden="true" />
                  90° right
                </Button>
                <Button variant="outline" onClick={() => step(180)} aria-label="Rotate 180 degrees">
                  180°
                </Button>
              </div>

              <div className="space-y-2">
                <Label id="rotate-angle-label">Angle: {angle}°</Label>
                <Slider
                  aria-labelledby="rotate-angle-label"
                  min={-180}
                  max={180}
                  step={1}
                  value={[angle]}
                  onValueChange={(v) => {
                    clearResults()
                    setAngle(v[0] ?? 0)
                  }}
                />
                <div className="flex items-center gap-2">
                  <Input
                    id="rotate-angle"
                    type="number"
                    min={-180}
                    max={180}
                    step={0.1}
                    inputMode="decimal"
                    aria-label="Rotation angle in degrees"
                    value={angle}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      if (Number.isFinite(n)) {
                        clearResults()
                        setAngle(clamp(n, -180, 180))
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Reset angle to 0 degrees"
                    onClick={() => {
                      clearResults()
                      setAngle(0)
                    }}
                  >
                    <Undo2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rotate-fill">Background behind the corners</Label>
                <Select
                  value={fill}
                  onValueChange={(v) => {
                    clearResults()
                    setFill(v as Fill)
                  }}
                >
                  <SelectTrigger id="rotate-fill">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transparent">Transparent (PNG / WebP only)</SelectItem>
                    <SelectItem value="white">White</SelectItem>
                    <SelectItem value="black">Black</SelectItem>
                    <SelectItem value="custom">Custom colour…</SelectItem>
                  </SelectContent>
                </Select>
                {fill === 'custom' && (
                  <div className="flex items-center gap-2">
                    <Input
                      id="rotate-custom-color"
                      type="color"
                      aria-label="Custom background colour"
                      value={customColor}
                      onChange={(e) => {
                        clearResults()
                        setCustomColor(e.target.value)
                      }}
                      className="h-10 w-16 p-1"
                    />
                    <span className="font-mono text-sm text-muted-foreground">{customColor}</span>
                  </div>
                )}
                {fill === 'transparent' && effectiveFormat === 'jpeg' && (
                  <p className="text-xs text-muted-foreground">
                    JPEG has no transparency, so the corners will be filled white.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rotate-format">Output format</Label>
                <Select
                  value={format}
                  onValueChange={(v) => {
                    clearResults()
                    setFormat(v as 'auto' | OutputFormat)
                  }}
                >
                  <SelectTrigger id="rotate-format">
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
                  <Label id="rotate-quality-label">Quality: {quality}</Label>
                  <Slider
                    aria-labelledby="rotate-quality-label"
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

      {busy && <ProgressPanel label={status || 'Rotating…'} value={progress} />}

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      <ResultsGrid
        items={results}
        zipName="rotated-images"
        transparent={!background}
        onReset={() => {
          clearResults()
          setFiles([])
          setPreview(null)
          setSourceSize(null)
          setAngle(0)
          setStatus('')
        }}
      />
    </div>
  )
}
