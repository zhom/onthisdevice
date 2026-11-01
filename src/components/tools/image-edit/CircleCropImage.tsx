import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { CircleUser, Move, TriangleAlert } from 'lucide-react'
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
import { clamp, nextFrame } from '@/lib/utils'
import { CHECKER_STYLE, ResultsGrid } from './ResultsGrid'
import {
  createCanvas,
  decodeImage,
  encodeCanvas,
  errorMessage,
  get2d,
  IMAGE_ACCEPT,
  nextId,
  outputName,
  revokeAll,
  type OutputFormat,
  type ProcessedItem,
} from './image-utils'

type Shape = 'circle' | 'rounded' | 'square'

interface AvatarOptions {
  shape: Shape
  cornerRadius: number
  zoom: number
  offsetX: number
  offsetY: number
  border: boolean
  borderWidth: number
  borderColor: string
  background: boolean
  backgroundColor: string
}

const SIZE_PRESETS = [96, 128, 256, 400, 512, 1024]

/** Trace the mask outline; uses arcTo so it works without `roundRect`. */
function tracePath(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  size: number,
  radiusPercent: number,
  inset: number,
): void {
  const x = inset
  const y = inset
  const s = size - inset * 2
  ctx.beginPath()
  if (shape === 'circle') {
    ctx.arc(size / 2, size / 2, s / 2, 0, Math.PI * 2)
    ctx.closePath()
    return
  }
  const r = shape === 'square' ? 0 : Math.min(s / 2, (s * radiusPercent) / 100)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + s, y, x + s, y + s, r)
  ctx.arcTo(x + s, y + s, x, y + s, r)
  ctx.arcTo(x, y + s, x, y, r)
  ctx.arcTo(x, y, x + s, y, r)
  ctx.closePath()
}

function renderAvatar(bitmap: ImageBitmap, size: number, opts: AvatarOptions): HTMLCanvasElement {
  const canvas = createCanvas(size, size)
  const ctx = get2d(canvas)
  const borderPx = opts.border ? (size * opts.borderWidth) / 100 : 0

  ctx.save()
  tracePath(ctx, opts.shape, size, opts.cornerRadius, 0)
  ctx.clip()

  if (opts.background) {
    ctx.fillStyle = opts.backgroundColor
    ctx.fillRect(0, 0, size, size)
  }

  const base = Math.max(size / bitmap.width, size / bitmap.height)
  const scale = base * opts.zoom
  const dw = bitmap.width * scale
  const dh = bitmap.height * scale
  const slackX = Math.max(0, (dw - size) / 2)
  const slackY = Math.max(0, (dh - size) / 2)
  const dx = (size - dw) / 2 + (opts.offsetX / 100) * slackX
  const dy = (size - dh) / 2 + (opts.offsetY / 100) * slackY

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, dx, dy, dw, dh)
  ctx.restore()

  if (borderPx > 0) {
    ctx.save()
    ctx.lineWidth = borderPx
    ctx.strokeStyle = opts.borderColor
    tracePath(ctx, opts.shape, size, opts.cornerRadius, borderPx / 2)
    ctx.stroke()
    ctx.restore()
  }

  return canvas
}

export default function CircleCropImage() {
  const [files, setFiles] = useState<File[]>([])
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [size, setSize] = useState(512)
  const [sizeInput, setSizeInput] = useState('512')
  const [format, setFormat] = useState<OutputFormat>('png')
  const [opts, setOpts] = useState<AvatarOptions>({
    shape: 'circle',
    cornerRadius: 25,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    border: false,
    borderWidth: 4,
    borderColor: '#ffffff',
    background: false,
    backgroundColor: '#ffffff',
  })

  const previewRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

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
    <K extends keyof AvatarOptions>(key: K, value: AvatarOptions[K]) => {
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
        const decoded = await decodeImage(merged[0])
        setBitmap((prev) => {
          prev?.close()
          return decoded.bitmap
        })
      } catch (err) {
        setError(errorMessage(err, 'That image could not be read.'))
      }
    },
    [files, clearResults],
  )

  // Live preview at a fixed 400 px so dragging stays smooth on big photos.
  useEffect(() => {
    const target = previewRef.current
    if (!target || !bitmap) return
    const rendered = renderAvatar(bitmap, 400, opts)
    target.width = rendered.width
    target.height = rendered.height
    const ctx = target.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, target.width, target.height)
    ctx.drawImage(rendered, 0, 0)
  }, [bitmap, opts])

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

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, ox: opts.offsetX, oy: opts.offsetY }
  }
  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    // A full drag across the preview moves the image the whole slack range.
    const dx = ((e.clientX - drag.x) / rect.width) * 200
    const dy = ((e.clientY - drag.y) / rect.height) * 200
    clearResults()
    setOpts((o) => ({
      ...o,
      offsetX: clamp(drag.ox - dx, -100, 100),
      offsetY: clamp(drag.oy - dy, -100, 100),
    }))
  }
  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    dragRef.current = null
  }

  function applySize(value: string) {
    setSizeInput(value)
    const n = Number(value)
    if (Number.isFinite(n) && n >= 16 && n <= 4096) {
      clearResults()
      setSize(Math.round(n))
    }
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
        const file = files[i]
        setStatus(`Cropping ${file.name} (${i + 1} of ${files.length})…`)
        setProgress(Math.round((i / files.length) * 100))
        await nextFrame()

        const decoded = i === 0 && bitmap ? { bitmap } : await decodeImage(file)
        const canvas = renderAvatar(decoded.bitmap, size, opts)
        if (decoded.bitmap !== bitmap) decoded.bitmap.close()

        const blob = await encodeCanvas(canvas, format, 0.95)
        out.push({
          id: nextId(),
          name: outputName(file, `-${opts.shape === 'circle' ? 'circle' : 'crop'}-${size}`, format),
          blob,
          url: URL.createObjectURL(blob),
          width: size,
          height: size,
          originalSize: file.size,
        })
      }
      setProgress(100)
      setResults(out)
      setStatus(`Created ${out.length} ${out.length === 1 ? 'image' : 'images'} at ${size} × ${size} px.`)
    } catch (err) {
      revokeAll(out)
      setError(errorMessage(err, 'The crop could not be rendered.'))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={IMAGE_ACCEPT}
        multiple
        onFiles={onFiles}
        maxSizeMb={200}
        title="Drop a photo to make a round avatar"
        hint="Gives a transparent PNG for profile pictures, team pages and Slack"
      />

      {files.length > 0 && <FileChips files={files} onRemove={removeFile} onReorder={reorderFiles} />}

      {files.length > 0 && bitmap && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <ToolPanel
            title="Preview"
            description={`Output: ${size} × ${size} px · drag the image to reposition it.`}
          >
            <div
              className="flex items-center justify-center rounded-lg bg-muted p-4"
              style={CHECKER_STYLE}
            >
              <canvas
                ref={previewRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="w-full max-w-80 cursor-move touch-none"
                aria-label="Avatar preview, drag to reposition"
              />
            </div>
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Move className="size-3.5" aria-hidden="true" />
              Drag the preview, or use the position sliders below for precise control.
            </p>
          </ToolPanel>

          <ToolPanel
            title="Shape & size"
            footer={
              <Button size="lg" onClick={run} disabled={busy} className="w-full">
                <CircleUser className="size-4" aria-hidden="true" />
                {busy ? 'Rendering…' : `Crop ${files.length} ${files.length === 1 ? 'image' : 'images'}`}
              </Button>
            }
          >
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="cc-shape">Shape</Label>
                <Select value={opts.shape} onValueChange={(v) => set('shape', v as Shape)}>
                  <SelectTrigger id="cc-shape">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="rounded">Rounded square</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {opts.shape === 'rounded' && (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label id="cc-radius-label">Corner radius</Label>
                    <span className="font-mono text-xs text-muted-foreground">{opts.cornerRadius}%</span>
                  </div>
                  <Slider
                    aria-labelledby="cc-radius-label"
                    min={0}
                    max={50}
                    step={1}
                    value={[opts.cornerRadius]}
                    onValueChange={(v) => set('cornerRadius', v[0] ?? 25)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="cc-size">Output size (px)</Label>
                <Input
                  id="cc-size"
                  type="number"
                  min={16}
                  max={4096}
                  inputMode="numeric"
                  value={sizeInput}
                  onChange={(e) => applySize(e.target.value)}
                />
                <div className="flex flex-wrap gap-1.5">
                  {SIZE_PRESETS.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={size === s ? 'default' : 'outline'}
                      onClick={() => applySize(String(s))}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label id="cc-zoom-label">Zoom</Label>
                  <span className="font-mono text-xs text-muted-foreground">
                    {opts.zoom.toFixed(2)}×
                  </span>
                </div>
                <Slider
                  aria-labelledby="cc-zoom-label"
                  min={1}
                  max={4}
                  step={0.01}
                  value={[opts.zoom]}
                  onValueChange={(v) => set('zoom', v[0] ?? 1)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label id="cc-offsetx-label">Horizontal</Label>
                  <Slider
                    aria-labelledby="cc-offsetx-label"
                    min={-100}
                    max={100}
                    step={1}
                    value={[opts.offsetX]}
                    onValueChange={(v) => set('offsetX', v[0] ?? 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label id="cc-offsety-label">Vertical</Label>
                  <Slider
                    aria-labelledby="cc-offsety-label"
                    min={-100}
                    max={100}
                    step={1}
                    value={[opts.offsetY]}
                    onValueChange={(v) => set('offsetY', v[0] ?? 0)}
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="cc-border">Add a border</Label>
                  <Switch
                    id="cc-border"
                    checked={opts.border}
                    onCheckedChange={(v) => set('border', v)}
                  />
                </div>
                {opts.border && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <Label id="cc-borderw-label">Border width</Label>
                        <span className="font-mono text-xs text-muted-foreground">
                          {opts.borderWidth}%
                        </span>
                      </div>
                      <Slider
                        aria-labelledby="cc-borderw-label"
                        min={0.5}
                        max={15}
                        step={0.5}
                        value={[opts.borderWidth]}
                        onValueChange={(v) => set('borderWidth', v[0] ?? 4)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id="cc-border-color"
                        type="color"
                        value={opts.borderColor}
                        onChange={(e) => set('borderColor', e.target.value)}
                        className="h-10 w-14 p-1"
                      />
                      <Label htmlFor="cc-border-color">Border colour</Label>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="cc-bg">Solid background</Label>
                  <Switch
                    id="cc-bg"
                    checked={opts.background}
                    onCheckedChange={(v) => set('background', v)}
                  />
                </div>
                {opts.background && (
                  <div className="flex items-center gap-2">
                    <Input
                      id="cc-bg-color"
                      type="color"
                      value={opts.backgroundColor}
                      onChange={(e) => set('backgroundColor', e.target.value)}
                      className="h-10 w-14 p-1"
                    />
                    <Label htmlFor="cc-bg-color">Background colour</Label>
                  </div>
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <Label htmlFor="cc-format">Output format</Label>
                <Select
                  value={format}
                  onValueChange={(v) => {
                    clearResults()
                    setFormat(v as OutputFormat)
                  }}
                >
                  <SelectTrigger id="cc-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG (transparent corners)</SelectItem>
                    <SelectItem value="webp">WebP (transparent, smaller)</SelectItem>
                    <SelectItem value="jpeg">JPEG (no transparency)</SelectItem>
                  </SelectContent>
                </Select>
                {format === 'jpeg' && !opts.background && (
                  <p className="flex items-start gap-2 rounded-md bg-muted p-2 text-xs">
                    <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      JPEG cannot store transparency, so the area outside the circle will be black.
                      Turn on a solid background, or choose PNG.
                    </span>
                  </p>
                )}
              </div>
            </div>
          </ToolPanel>
        </div>
      )}

      {busy && <ProgressPanel label={status || 'Rendering…'} value={progress} />}

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      <ResultsGrid
        items={results}
        zipName="circle-crops"
        transparent={format !== 'jpeg'}
        onReset={() => {
          clearResults()
          setFiles([])
          setBitmap((prev) => {
            prev?.close()
            return null
          })
          setStatus('')
        }}
      />
    </div>
  )
}
