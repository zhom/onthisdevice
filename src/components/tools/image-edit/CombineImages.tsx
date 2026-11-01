import { useCallback, useEffect, useRef, useState } from 'react'
import { Columns2, Download, Grid2x2, RotateCcw, Rows3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileChips } from '@/components/shared/FileChips'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { downloadBlob, formatBytes, nextFrame } from '@/lib/utils'
import {
  PHOTO_ACCEPT,
  PHOTO_CHECKER,
  ctx2d,
  decodePhoto,
  encodePhotoCanvas,
  makeCanvas,
  photoError,
  safeNumber,
  type PhotoFormat,
} from './photo-image'

export type CombineLayout = 'horizontal' | 'vertical' | 'grid'
type Sizing = 'original' | 'smallest' | 'largest'
type Align = 'start' | 'center' | 'end'

interface Loaded {
  name: string
  bitmap: ImageBitmap
}

interface Options {
  layout: CombineLayout
  sizing: Sizing
  align: Align
  gap: number
  columns: number
  background: string
  transparent: boolean
  radius: number
}

interface Placement {
  bitmap: ImageBitmap
  x: number
  y: number
  w: number
  h: number
}

/** Work out where every image lands. Pure geometry — reused by preview and export. */
function planLayout(items: Loaded[], o: Options): { width: number; height: number; boxes: Placement[] } {
  const gap = Math.max(0, o.gap)
  if (items.length === 0) return { width: 1, height: 1, boxes: [] }

  if (o.layout === 'grid') {
    const cols = Math.max(1, Math.min(o.columns, items.length))
    const rows = Math.ceil(items.length / cols)
    const cellW = Math.max(...items.map((i) => i.bitmap.width))
    const cellH = Math.max(...items.map((i) => i.bitmap.height))
    const width = cols * cellW + (cols - 1) * gap
    const height = rows * cellH + (rows - 1) * gap
    const boxes = items.map((item, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      const scale = Math.min(cellW / item.bitmap.width, cellH / item.bitmap.height)
      const w = item.bitmap.width * scale
      const h = item.bitmap.height * scale
      const cellX = col * (cellW + gap)
      const cellY = row * (cellH + gap)
      const offX = o.align === 'start' ? 0 : o.align === 'end' ? cellW - w : (cellW - w) / 2
      const offY = o.align === 'start' ? 0 : o.align === 'end' ? cellH - h : (cellH - h) / 2
      return { bitmap: item.bitmap, x: cellX + offX, y: cellY + offY, w, h }
    })
    return { width, height, boxes }
  }

  const horizontal = o.layout === 'horizontal'
  const sides = items.map((i) => (horizontal ? i.bitmap.height : i.bitmap.width))
  const target =
    o.sizing === 'smallest' ? Math.min(...sides) : o.sizing === 'largest' ? Math.max(...sides) : 0

  const scaled = items.map((item) => {
    const side = horizontal ? item.bitmap.height : item.bitmap.width
    const scale = target > 0 ? target / side : 1
    return {
      bitmap: item.bitmap,
      w: item.bitmap.width * scale,
      h: item.bitmap.height * scale,
    }
  })

  const cross = Math.max(...scaled.map((s) => (horizontal ? s.h : s.w)))
  const main = scaled.reduce((sum, s) => sum + (horizontal ? s.w : s.h), 0) + gap * (items.length - 1)
  const width = horizontal ? main : cross
  const height = horizontal ? cross : main

  let cursor = 0
  const boxes = scaled.map((s) => {
    const secondary = horizontal ? s.h : s.w
    const free = cross - secondary
    const off = o.align === 'start' ? 0 : o.align === 'end' ? free : free / 2
    const box: Placement = horizontal
      ? { bitmap: s.bitmap, x: cursor, y: off, w: s.w, h: s.h }
      : { bitmap: s.bitmap, x: off, y: cursor, w: s.w, h: s.h }
    cursor += (horizontal ? s.w : s.h) + gap
    return box
  })

  return { width, height, boxes }
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function compose(items: Loaded[], o: Options, scale: number): HTMLCanvasElement {
  const plan = planLayout(items, o)
  const canvas = makeCanvas(Math.max(1, plan.width * scale), Math.max(1, plan.height * scale))
  const ctx = ctx2d(canvas)
  if (!o.transparent) {
    ctx.fillStyle = o.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.imageSmoothingQuality = 'high'
  for (const box of plan.boxes) {
    const x = box.x * scale
    const y = box.y * scale
    const w = box.w * scale
    const h = box.h * scale
    if (o.radius > 0) {
      ctx.save()
      roundedPath(ctx, x, y, w, h, o.radius * scale)
      ctx.clip()
      ctx.drawImage(box.bitmap, x, y, w, h)
      ctx.restore()
    } else {
      ctx.drawImage(box.bitmap, x, y, w, h)
    }
  }
  return canvas
}

export interface CombineImagesProps {
  defaultLayout?: CombineLayout
  /** Collage preset opens on a 2-column grid with a gap and rounded corners. */
  collage?: boolean
}

const PREVIEW_MAX = 1000

export default function CombineImages({ defaultLayout = 'horizontal', collage = false }: CombineImagesProps) {
  const [files, setFiles] = useState<File[]>([])
  const [items, setItems] = useState<Loaded[]>([])
  const [options, setOptions] = useState<Options>({
    layout: defaultLayout,
    sizing: defaultLayout === 'vertical' ? 'largest' : 'smallest',
    align: 'center',
    gap: collage ? 16 : 0,
    columns: 2,
    background: '#ffffff',
    transparent: false,
    radius: collage ? 12 : 0,
  })
  const [format, setFormat] = useState<PhotoFormat>('png')
  const [quality, setQuality] = useState(92)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<{ blob: Blob; name: string; url: string } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const itemsRef = useRef<Loaded[]>([])
  itemsRef.current = items
  const outputRef = useRef<typeof output>(null)
  outputRef.current = output

  useEffect(
    () => () => {
      for (const item of itemsRef.current) item.bitmap.close()
      if (outputRef.current) URL.revokeObjectURL(outputRef.current.url)
    },
    [],
  )

  const clearOutput = useCallback(() => {
    setOutput((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }, [])

  function patch(next: Partial<Options>) {
    clearOutput()
    setOptions((prev) => ({ ...prev, ...next }))
  }

  const onFiles = useCallback(
    async (incoming: File[]) => {
      if (incoming.length === 0) return
      setError(null)
      clearOutput()
      setBusy(true)
      setStatus(`Decoding ${incoming.length} ${incoming.length === 1 ? 'image' : 'images'}…`)
      const loaded: Loaded[] = []
      try {
        for (const file of incoming) {
          const decoded = await decodePhoto(file)
          loaded.push({ name: file.name, bitmap: decoded.bitmap })
          await nextFrame()
        }
        setFiles((prev) => [...prev, ...incoming])
        setItems((prev) => [...prev, ...loaded])
        setStatus(`${loaded.length} added.`)
      } catch (err) {
        for (const item of loaded) item.bitmap.close()
        setError(photoError(err, 'One of those images could not be opened.'))
        setStatus('')
      } finally {
        setBusy(false)
      }
    },
    [clearOutput],
  )

  const plan = planLayout(items, options)

  useEffect(() => {
    const target = canvasRef.current
    if (!target || items.length === 0) return
    const scale = Math.min(PREVIEW_MAX / Math.max(plan.width, plan.height), 1)
    const rendered = compose(items, options, scale)
    target.width = rendered.width
    target.height = rendered.height
    const ctx = target.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, target.width, target.height)
    ctx.drawImage(rendered, 0, 0)
  }, [items, options, plan.width, plan.height])

  function removeFile(index: number) {
    clearOutput()
    items[index]?.bitmap.close()
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function reorder(from: number, to: number) {
    clearOutput()
    const move = <T,>(list: T[]): T[] => {
      const next = [...list]
      const [moved] = next.splice(from, 1)
      if (moved !== undefined) next.splice(to, 0, moved)
      return next
    }
    setFiles(move)
    setItems(move)
  }

  async function exportImage() {
    if (items.length === 0) return
    setBusy(true)
    setError(null)
    setStatus('Compositing at full resolution…')
    try {
      await nextFrame()
      const canvas = compose(items, options, 1)
      const blob = await encodePhotoCanvas(canvas, format, quality / 100)
      const name = `combined-${items.length}-images.${format === 'jpeg' ? 'jpg' : format}`
      clearOutput()
      setOutput({ blob, name, url: URL.createObjectURL(blob) })
      setStatus(`Done: ${canvas.width}×${canvas.height} px, ${formatBytes(blob.size)}.`)
      downloadBlob(blob, name)
    } catch (err) {
      setError(photoError(err, 'Compositing failed. Try fewer or smaller images.'))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    clearOutput()
    for (const item of items) item.bitmap.close()
    setItems([])
    setFiles([])
    setStatus('')
    setError(null)
  }

  const megapixels = (plan.width * plan.height) / 1_000_000

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={PHOTO_ACCEPT}
        multiple
        onFiles={onFiles}
        maxSizeMb={150}
        title={collage ? 'Drop the photos for your collage' : 'Drop two or more images'}
        hint="Add as many as you like"
      />

      {files.length > 0 && <FileChips files={files} onRemove={removeFile} onReorder={reorder} />}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {items.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ToolPanel
            title="Preview"
            description={`Output canvas: ${Math.round(plan.width)} × ${Math.round(plan.height)} px (${megapixels.toFixed(1)} MP)`}
          >
            <div
              className="flex min-h-56 items-center justify-center overflow-hidden rounded-lg bg-muted p-2"
              style={PHOTO_CHECKER}
            >
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Preview of ${items.length} images combined ${options.layout === 'grid' ? 'in a grid' : options.layout === 'horizontal' ? 'side by side' : 'stacked vertically'}`}
                className="max-h-[60dvh] max-w-full rounded"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Drag the file chips above to change the order.
            </p>
          </ToolPanel>

          <ToolPanel
            title="Layout"
            footer={
              <Button size="lg" className="w-full" onClick={exportImage} disabled={busy}>
                <Download className="size-4" aria-hidden="true" />
                {busy ? 'Working…' : 'Combine and download'}
              </Button>
            }
          >
            <div className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Direction</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'horizontal', label: 'Side by side', Icon: Columns2 },
                      { id: 'vertical', label: 'Stacked', Icon: Rows3 },
                      { id: 'grid', label: 'Grid', Icon: Grid2x2 },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <Button
                      key={id}
                      type="button"
                      variant={options.layout === id ? 'default' : 'outline'}
                      className="h-auto flex-col gap-1 py-3"
                      aria-pressed={options.layout === id}
                      onClick={() => patch({ layout: id })}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      <span className="text-xs">{label}</span>
                    </Button>
                  ))}
                </div>
              </fieldset>

              {options.layout === 'grid' && (
                <div className="space-y-2">
                  <Label htmlFor="combine-cols">Columns</Label>
                  <Input
                    id="combine-cols"
                    type="number"
                    min={1}
                    max={10}
                    value={options.columns}
                    onChange={(e) => patch({ columns: safeNumber(Number(e.target.value), 1, 10, 2) })}
                  />
                </div>
              )}

              {options.layout !== 'grid' && (
                <div className="space-y-2">
                  <Label htmlFor="combine-sizing">
                    {options.layout === 'horizontal' ? 'Height matching' : 'Width matching'}
                  </Label>
                  <Select value={options.sizing} onValueChange={(v) => patch({ sizing: v as Sizing })}>
                    <SelectTrigger id="combine-sizing">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="original">Keep every image at its own size</SelectItem>
                      <SelectItem value="smallest">
                        Scale all to the smallest ({options.layout === 'horizontal' ? 'no upscaling' : 'no upscaling'})
                      </SelectItem>
                      <SelectItem value="largest">Scale all to the largest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="combine-align">Alignment</Label>
                <Select value={options.align} onValueChange={(v) => patch({ align: v as Align })}>
                  <SelectTrigger id="combine-align">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start">{options.layout === 'vertical' ? 'Left' : 'Top'}</SelectItem>
                    <SelectItem value="center">Centre</SelectItem>
                    <SelectItem value="end">{options.layout === 'vertical' ? 'Right' : 'Bottom'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label id="combine-gap-label">Gap: {options.gap} px</Label>
                <Slider
                  aria-labelledby="combine-gap-label"
                  min={0}
                  max={200}
                  step={2}
                  value={[options.gap]}
                  onValueChange={(v) => patch({ gap: v[0] ?? 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label id="combine-radius-label">Corner rounding: {options.radius} px</Label>
                <Slider
                  aria-labelledby="combine-radius-label"
                  min={0}
                  max={120}
                  step={2}
                  value={[options.radius]}
                  onValueChange={(v) => patch({ radius: v[0] ?? 0 })}
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md bg-muted p-3">
                <div>
                  <Label htmlFor="combine-transparent">Transparent background</Label>
                  <p className="text-xs text-muted-foreground">PNG or WebP output only.</p>
                </div>
                <Switch
                  id="combine-transparent"
                  checked={options.transparent}
                  onCheckedChange={(v) => patch({ transparent: v })}
                />
              </div>

              {!options.transparent && (
                <div className="space-y-2">
                  <Label htmlFor="combine-bg">Background colour</Label>
                  <Input
                    id="combine-bg"
                    type="color"
                    style={{ padding: 0, width: '2.75rem', height: '2.25rem' }}
                    value={options.background}
                    onChange={(e) => patch({ background: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="combine-format">Output format</Label>
                <Select
                  value={format}
                  onValueChange={(v) => {
                    clearOutput()
                    setFormat(v as PhotoFormat)
                  }}
                >
                  <SelectTrigger id="combine-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG (lossless)</SelectItem>
                    <SelectItem value="jpeg">JPG (smallest)</SelectItem>
                    <SelectItem value="webp">WebP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {format !== 'png' && (
                <div className="space-y-2">
                  <Label id="combine-quality-label">Quality: {quality}</Label>
                  <Slider
                    aria-labelledby="combine-quality-label"
                    min={40}
                    max={100}
                    step={1}
                    value={[quality]}
                    onValueChange={(v) => setQuality(v[0] ?? 92)}
                  />
                </div>
              )}

              <Button type="button" variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="size-4" aria-hidden="true" /> Clear all
              </Button>
            </div>
          </ToolPanel>
        </div>
      )}

      {busy && <ProgressPanel label={status || 'Working…'} />}

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>

      {output && (
        <ToolPanel title="Combined image">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <img
              src={output.url}
              alt="Combined result"
              className="max-h-40 w-auto rounded-lg border border-border"
            />
            <div className="space-y-2">
              <p className="text-sm font-medium">{output.name}</p>
              <p className="text-sm text-muted-foreground">{formatBytes(output.blob.size)}</p>
              <Button type="button" onClick={() => downloadBlob(output.blob, output.name)}>
                <Download className="size-4" aria-hidden="true" /> Download again
              </Button>
            </div>
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
