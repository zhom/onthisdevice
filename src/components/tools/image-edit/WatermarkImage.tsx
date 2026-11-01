import { useCallback, useEffect, useRef, useState } from 'react'
import { Stamp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileChips } from '@/components/shared/FileChips'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn, nextFrame } from '@/lib/utils'
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

type Kind = 'text' | 'image'
type Position = 'tl' | 'tc' | 'tr' | 'cl' | 'cc' | 'cr' | 'bl' | 'bc' | 'br'

const POSITIONS: { id: Position; label: string }[] = [
  { id: 'tl', label: 'Top left' },
  { id: 'tc', label: 'Top centre' },
  { id: 'tr', label: 'Top right' },
  { id: 'cl', label: 'Middle left' },
  { id: 'cc', label: 'Centre' },
  { id: 'cr', label: 'Middle right' },
  { id: 'bl', label: 'Bottom left' },
  { id: 'bc', label: 'Bottom centre' },
  { id: 'br', label: 'Bottom right' },
]

const FONTS: { id: string; label: string }[] = [
  { id: 'system-ui, sans-serif', label: 'Sans-serif' },
  { id: 'Georgia, "Times New Roman", serif', label: 'Serif' },
  { id: 'ui-monospace, "Courier New", monospace', label: 'Monospace' },
  { id: 'Impact, Haettenschweiler, sans-serif', label: 'Impact' },
  { id: '"Trebuchet MS", sans-serif', label: 'Trebuchet' },
]

interface WatermarkOptions {
  kind: Kind
  text: string
  font: string
  bold: boolean
  outline: boolean
  color: string
  fontScale: number
  imageScale: number
  opacity: number
  rotation: number
  position: Position
  margin: number
  tile: boolean
  tileGap: number
}

/** Build the watermark itself onto its own canvas, sized relative to the target width. */
function buildStamp(
  opts: WatermarkOptions,
  targetWidth: number,
  wm: ImageBitmap | null,
): HTMLCanvasElement | null {
  if (opts.kind === 'image') {
    if (!wm) return null
    const w = Math.max(1, (targetWidth * opts.imageScale) / 100)
    const h = Math.max(1, (w * wm.height) / wm.width)
    const canvas = createCanvas(w, h)
    const ctx = get2d(canvas)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(wm, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  const text = opts.text.trim()
  if (!text) return null
  const fontPx = Math.max(6, (targetWidth * opts.fontScale) / 100)
  const font = `${opts.bold ? 'bold ' : ''}${fontPx}px ${opts.font}`

  const measurer = get2d(createCanvas(8, 8))
  measurer.font = font
  const metrics = measurer.measureText(text)
  const pad = Math.ceil(fontPx * 0.25)
  const w = Math.ceil(metrics.width) + pad * 2
  const h = Math.ceil(fontPx * 1.4) + pad

  const canvas = createCanvas(w, h)
  const ctx = get2d(canvas)
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (opts.outline) {
    ctx.lineWidth = Math.max(1, fontPx * 0.08)
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'
    ctx.lineJoin = 'round'
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2)
  }
  ctx.fillStyle = opts.color
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  return canvas
}

/** Paint the stamp onto the image canvas at the requested position (or tiled). */
function paintWatermark(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  stamp: HTMLCanvasElement,
  opts: WatermarkOptions,
): void {
  const rad = (opts.rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const bw = stamp.width * cos + stamp.height * sin
  const bh = stamp.width * sin + stamp.height * cos
  const margin = (W * opts.margin) / 100

  const draw = (cx: number, cy: number) => {
    ctx.save()
    ctx.globalAlpha = opts.opacity / 100
    ctx.translate(cx, cy)
    ctx.rotate(rad)
    ctx.drawImage(stamp, -stamp.width / 2, -stamp.height / 2)
    ctx.restore()
  }

  if (opts.tile) {
    const gap = Math.max(0, (Math.max(bw, bh) * opts.tileGap) / 100)
    const stepX = bw + gap
    const stepY = bh + gap
    let row = 0
    for (let y = bh / 2 - stepY; y < H + stepY; y += stepY) {
      const offset = row % 2 === 0 ? 0 : stepX / 2
      for (let x = bw / 2 - stepX + offset; x < W + stepX; x += stepX) draw(x, y)
      row += 1
    }
    return
  }

  const h = opts.position[1]
  const v = opts.position[0]
  const cx = h === 'l' ? margin + bw / 2 : h === 'r' ? W - margin - bw / 2 : W / 2
  const cy = v === 't' ? margin + bh / 2 : v === 'b' ? H - margin - bh / 2 : H / 2
  draw(cx, cy)
}

function downscale(bitmap: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(maxSide / bitmap.width, maxSide / bitmap.height, 1)
  const canvas = createCanvas(bitmap.width * scale, bitmap.height * scale)
  const ctx = get2d(canvas)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

export default function WatermarkImage() {
  const [files, setFiles] = useState<File[]>([])
  const [opts, setOpts] = useState<WatermarkOptions>({
    kind: 'text',
    text: '© Your Name',
    font: FONTS[0]!.id,
    bold: true,
    outline: true,
    color: '#ffffff',
    fontScale: 6,
    imageScale: 25,
    opacity: 55,
    rotation: 0,
    position: 'br',
    margin: 3,
    tile: false,
    tileGap: 60,
  })
  const [wmFile, setWmFile] = useState<File | null>(null)
  const [wmBitmap, setWmBitmap] = useState<ImageBitmap | null>(null)
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

  const set = useCallback(
    <K extends keyof WatermarkOptions>(key: K, value: WatermarkOptions[K]) => {
      clearResults()
      setOpts((o) => ({ ...o, [key]: value }))
    },
    [clearResults],
  )

  const onFiles = useCallback(
    async (incoming: File[]) => {
      if (incoming.length === 0) return
      setError(null)
      clearResults()
      const merged = [...files, ...incoming]
      setFiles(merged)
      try {
        const { bitmap } = await decodeImage(merged[0] as File)
        setPreview(downscale(bitmap, 620))
        bitmap.close()
      } catch (err) {
        setError(errorMessage(err, 'That image could not be read.'))
      }
    },
    [files, clearResults],
  )

  const onWatermarkFile = useCallback(
    async (incoming: File[]) => {
      const next = incoming[0]
      if (!next) return
      try {
        const { bitmap } = await decodeImage(next)
        setWmBitmap((prev) => {
          prev?.close()
          return bitmap
        })
        setWmFile(next)
        clearResults()
      } catch (err) {
        setError(errorMessage(err, 'That watermark image could not be read.'))
      }
    },
    [clearResults],
  )

  // Live preview
  useEffect(() => {
    const target = previewCanvasRef.current
    if (!target || !preview) return
    target.width = preview.width
    target.height = preview.height
    const ctx = target.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, target.width, target.height)
    ctx.drawImage(preview, 0, 0)
    const stamp = buildStamp(opts, target.width, wmBitmap)
    if (stamp) paintWatermark(ctx, target.width, target.height, stamp, opts)
  }, [preview, opts, wmBitmap])

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
    if (opts.kind === 'text' && !opts.text.trim()) {
      setError('Type the watermark text first.')
      return
    }
    if (opts.kind === 'image' && !wmBitmap) {
      setError('Choose a watermark image (a transparent PNG works best).')
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
        setStatus(`Watermarking ${file.name} (${i + 1} of ${files.length})…`)
        setProgress(Math.round((i / files.length) * 100))
        await nextFrame()

        const { bitmap } = await decodeImage(file)
        const outFormat: OutputFormat = format === 'auto' ? formatFromFile(file) : format
        const canvas = createCanvas(bitmap.width, bitmap.height)
        const ctx = get2d(canvas)
        if (outFormat === 'jpeg') {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        ctx.drawImage(bitmap, 0, 0)
        bitmap.close()

        const stamp = buildStamp(opts, canvas.width, wmBitmap)
        if (!stamp) throw new Error('The watermark is empty. Add some text or pick an image.')
        paintWatermark(ctx, canvas.width, canvas.height, stamp, opts)

        const blob = await encodeCanvas(canvas, outFormat, quality / 100)
        out.push({
          id: nextId(),
          name: outputName(file, '-watermarked', outFormat),
          blob,
          url: URL.createObjectURL(blob),
          width: canvas.width,
          height: canvas.height,
          originalSize: file.size,
        })
      }
      setProgress(100)
      setResults(out)
      setStatus(`Watermarked ${out.length} ${out.length === 1 ? 'image' : 'images'}.`)
    } catch (err) {
      revokeAll(out)
      setError(errorMessage(err, 'The watermark could not be applied.'))
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
        title="Drop images to watermark"
        hint="Add a copyright line or logo to a whole batch"
      />

      {files.length > 0 && <FileChips files={files} onRemove={removeFile} onReorder={reorderFiles} />}

      {files.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <ToolPanel title="Preview" description="Live preview of the first image.">
            <div
              className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-muted p-3"
              style={CHECKER_STYLE}
            >
              <canvas
                ref={previewCanvasRef}
                className="max-h-[60dvh] max-w-full"
                aria-label="Watermarked preview"
              />
            </div>
          </ToolPanel>

          <ToolPanel
            title="Watermark"
            footer={
              <Button size="lg" onClick={run} disabled={busy} className="w-full">
                <Stamp className="size-4" aria-hidden="true" />
                {busy ? 'Applying…' : `Watermark ${files.length} ${files.length === 1 ? 'image' : 'images'}`}
              </Button>
            }
          >
            <Tabs value={opts.kind} onValueChange={(v) => set('kind', v as Kind)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="image">Image / logo</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="wm-text">Watermark text</Label>
                  <Input
                    id="wm-text"
                    value={opts.text}
                    maxLength={120}
                    onChange={(e) => set('text', e.target.value)}
                    placeholder="© 2026 Studio Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wm-font">Font</Label>
                  <Select value={opts.font} onValueChange={(v) => set('font', v)}>
                    <SelectTrigger id="wm-font">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONTS.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label id="wm-size-label">Text size</Label>
                    <span className="font-mono text-xs text-muted-foreground">
                      {opts.fontScale}% of width
                    </span>
                  </div>
                  <Slider
                    aria-labelledby="wm-size-label"
                    min={1}
                    max={30}
                    step={0.5}
                    value={[opts.fontScale]}
                    onValueChange={(v) => set('fontScale', v[0] ?? 6)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Input
                      id="wm-color"
                      type="color"
                      value={opts.color}
                      onChange={(e) => set('color', e.target.value)}
                      className="h-10 w-14 p-1"
                    />
                    <Label htmlFor="wm-color">Colour</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="wm-bold" checked={opts.bold} onCheckedChange={(v) => set('bold', v)} />
                    <Label htmlFor="wm-bold">Bold</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="wm-outline"
                      checked={opts.outline}
                      onCheckedChange={(v) => set('outline', v)}
                    />
                    <Label htmlFor="wm-outline">Outline</Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="image" className="space-y-4 pt-4">
                {!wmFile ? (
                  <FileDropzone
                    accept={IMAGE_ACCEPT}
                    onFiles={onWatermarkFile}
                    maxSizeMb={50}
                    title="Drop your logo"
                    hint="A transparent PNG gives the cleanest result"
                  />
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-muted p-3">
                    <span className="truncate text-sm">{wmFile.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove watermark image"
                      onClick={() => {
                        setWmBitmap((prev) => {
                          prev?.close()
                          return null
                        })
                        setWmFile(null)
                        clearResults()
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label id="wm-imgscale-label">Logo size</Label>
                    <span className="font-mono text-xs text-muted-foreground">
                      {opts.imageScale}% of width
                    </span>
                  </div>
                  <Slider
                    aria-labelledby="wm-imgscale-label"
                    min={2}
                    max={100}
                    step={1}
                    value={[opts.imageScale]}
                    onValueChange={(v) => set('imageScale', v[0] ?? 25)}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-6 space-y-5 border-t border-border pt-5">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Position</legend>
                <div className="grid w-40 grid-cols-3 gap-1" role="group" aria-label="Watermark position">
                  {POSITIONS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-label={p.label}
                      aria-pressed={opts.position === p.id && !opts.tile}
                      disabled={opts.tile}
                      onClick={() => set('position', p.id)}
                      className={cn(
                        'flex aspect-square items-center justify-center rounded border text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40',
                        opts.position === p.id && !opts.tile
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background hover:bg-muted',
                      )}
                    >
                      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label id="wm-margin-label">Margin</Label>
                  <span className="font-mono text-xs text-muted-foreground">{opts.margin}%</span>
                </div>
                <Slider
                  aria-labelledby="wm-margin-label"
                  min={0}
                  max={20}
                  step={0.5}
                  value={[opts.margin]}
                  onValueChange={(v) => set('margin', v[0] ?? 3)}
                  disabled={opts.tile}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label id="wm-opacity-label">Opacity</Label>
                  <span className="font-mono text-xs text-muted-foreground">{opts.opacity}%</span>
                </div>
                <Slider
                  aria-labelledby="wm-opacity-label"
                  min={5}
                  max={100}
                  step={1}
                  value={[opts.opacity]}
                  onValueChange={(v) => set('opacity', v[0] ?? 55)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label id="wm-rotation-label">Rotation</Label>
                  <span className="font-mono text-xs text-muted-foreground">{opts.rotation}°</span>
                </div>
                <Slider
                  aria-labelledby="wm-rotation-label"
                  min={-90}
                  max={90}
                  step={1}
                  value={[opts.rotation]}
                  onValueChange={(v) => set('rotation', v[0] ?? 0)}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-md bg-muted p-3">
                <div>
                  <Label htmlFor="wm-tile">Tile across the image</Label>
                  <p className="text-xs text-muted-foreground">Repeats the mark edge to edge</p>
                </div>
                <Switch id="wm-tile" checked={opts.tile} onCheckedChange={(v) => set('tile', v)} />
              </div>

              {opts.tile && (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label id="wm-gap-label">Tile spacing</Label>
                    <span className="font-mono text-xs text-muted-foreground">{opts.tileGap}%</span>
                  </div>
                  <Slider
                    aria-labelledby="wm-gap-label"
                    min={0}
                    max={200}
                    step={5}
                    value={[opts.tileGap]}
                    onValueChange={(v) => set('tileGap', v[0] ?? 60)}
                  />
                </div>
              )}

              <div className="space-y-2 border-t border-border pt-4">
                <Label htmlFor="wm-format">Output format</Label>
                <Select
                  value={format}
                  onValueChange={(v) => {
                    clearResults()
                    setFormat(v as 'auto' | OutputFormat)
                  }}
                >
                  <SelectTrigger id="wm-format">
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
                  <Label id="wm-quality-label">Quality: {quality}</Label>
                  <Slider
                    aria-labelledby="wm-quality-label"
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

      {busy && <ProgressPanel label={status || 'Applying watermark…'} value={progress} />}

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      <ResultsGrid
        items={results}
        zipName="watermarked-images"
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
