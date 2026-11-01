import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Crop, Maximize, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { clamp, formatBytes } from '@/lib/utils'
import { CHECKER_STYLE } from './ResultsGrid'
import {
  createCanvas,
  decodeImage,
  encodeCanvas,
  errorMessage,
  formatFromFile,
  get2d,
  IMAGE_ACCEPT,
  isLossy,
  outputName,
  type OutputFormat,
} from './image-utils'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type DragKind = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const RATIOS: { id: string; label: string; value: number | null }[] = [
  { id: 'free', label: 'Free', value: null },
  { id: 'original', label: 'Original', value: 0 },
  { id: '1:1', label: '1:1 square', value: 1 },
  { id: '4:3', label: '4:3 landscape', value: 4 / 3 },
  { id: '3:4', label: '3:4 portrait', value: 3 / 4 },
  { id: '16:9', label: '16:9 widescreen', value: 16 / 9 },
  { id: '9:16', label: '9:16 story', value: 9 / 16 },
  { id: '3:2', label: '3:2 photo', value: 3 / 2 },
  { id: '2:3', label: '2:3 portrait photo', value: 2 / 3 },
]

const MIN_SIZE = 8
const HANDLES: { kind: DragKind; className: string; cursor: string; label: string }[] = [
  { kind: 'nw', className: '-left-1.5 -top-1.5', cursor: 'nwse-resize', label: 'top left' },
  { kind: 'n', className: 'left-1/2 -top-1.5 -translate-x-1/2', cursor: 'ns-resize', label: 'top' },
  { kind: 'ne', className: '-right-1.5 -top-1.5', cursor: 'nesw-resize', label: 'top right' },
  { kind: 'e', className: '-right-1.5 top-1/2 -translate-y-1/2', cursor: 'ew-resize', label: 'right' },
  { kind: 'se', className: '-right-1.5 -bottom-1.5', cursor: 'nwse-resize', label: 'bottom right' },
  { kind: 's', className: 'left-1/2 -bottom-1.5 -translate-x-1/2', cursor: 'ns-resize', label: 'bottom' },
  { kind: 'sw', className: '-left-1.5 -bottom-1.5', cursor: 'nesw-resize', label: 'bottom left' },
  { kind: 'w', className: '-left-1.5 top-1/2 -translate-y-1/2', cursor: 'ew-resize', label: 'left' },
]

export default function CropImage() {
  const [file, setFile] = useState<File | null>(null)
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 })
  const [ratioId, setRatioId] = useState('free')
  const [format, setFormat] = useState<'auto' | OutputFormat>('auto')
  const [quality, setQuality] = useState(92)
  const [display, setDisplay] = useState({ w: 0, h: 0 })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ blob: Blob; name: string; url: string } | null>(null)

  const imgRef = useRef<HTMLImageElement | null>(null)
  const previewRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<{ kind: DragKind; sx: number; sy: number; start: Rect } | null>(null)

  const natural = bitmap ? { w: bitmap.width, h: bitmap.height } : null

  const ratio = useMemo(() => {
    const found = RATIOS.find((r) => r.id === ratioId)
    if (!found || found.value === null) return null
    if (found.value === 0) return natural ? natural.w / natural.h : null
    return found.value
  }, [ratioId, natural])

  /* ── loading ─────────────────────────────────────────────────────── */

  const reset = useCallback(() => {
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }, [])

  const onFiles = useCallback(
    async (files: File[]) => {
      const next = files[0]
      if (!next) return
      setError(null)
      reset()
      try {
        const decoded = await decodeImage(next)
        setBitmap((prev) => {
          prev?.close()
          return decoded.bitmap
        })
        setImgUrl(URL.createObjectURL(next))
        setFile(next)
        setCrop({ x: 0, y: 0, w: decoded.width, h: decoded.height })
        setRatioId('free')
      } catch (err) {
        setError(errorMessage(err, 'That image could not be read.'))
      }
    },
    [reset],
  )

  useEffect(
    () => () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl)
    },
    [imgUrl],
  )

  /* ── displayed size tracking ─────────────────────────────────────── */

  const measure = useCallback(() => {
    const el = imgRef.current
    if (!el) return
    setDisplay({ w: el.clientWidth, h: el.clientHeight })
  }, [])

  useEffect(() => {
    const el = imgRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, imgUrl])

  const scale = natural && display.w > 0 ? display.w / natural.w : 1

  /* ── crop maths ──────────────────────────────────────────────────── */

  const fitRatio = useCallback(
    (r: Rect, ar: number | null, nat: { w: number; h: number }): Rect => {
      if (!ar) return r
      const cx = r.x + r.w / 2
      const cy = r.y + r.h / 2
      let w = r.w
      let h = w / ar
      if (h > nat.h) {
        h = nat.h
        w = h * ar
      }
      if (w > nat.w) {
        w = nat.w
        h = w / ar
      }
      const x = clamp(cx - w / 2, 0, nat.w - w)
      const y = clamp(cy - h / 2, 0, nat.h - h)
      return { x, y, w, h }
    },
    [],
  )

  function changeRatio(id: string) {
    setRatioId(id)
    if (!natural) return
    const found = RATIOS.find((r) => r.id === id)
    const ar = !found || found.value === null ? null : found.value === 0 ? natural.w / natural.h : found.value
    setCrop((c) => fitRatio(c, ar, natural))
    reset()
  }

  function applyDrag(kind: DragKind, dx: number, dy: number, start: Rect): Rect {
    if (!natural) return start
    const W = natural.w
    const H = natural.h

    if (kind === 'move') {
      return {
        ...start,
        x: clamp(start.x + dx, 0, Math.max(0, W - start.w)),
        y: clamp(start.y + dy, 0, Math.max(0, H - start.h)),
      }
    }

    const hasW = kind.includes('w')
    const hasE = kind.includes('e')
    const hasN = kind.includes('n')
    const hasS = kind.includes('s')

    let left = hasW ? start.x + dx : start.x
    let right = hasE ? start.x + start.w + dx : start.x + start.w
    let top = hasN ? start.y + dy : start.y
    let bottom = hasS ? start.y + start.h + dy : start.y + start.h

    if (!ratio) {
      left = clamp(left, 0, W)
      right = clamp(right, 0, W)
      top = clamp(top, 0, H)
      bottom = clamp(bottom, 0, H)
    }

    let w = Math.max(MIN_SIZE, right - left)
    let h = Math.max(MIN_SIZE, bottom - top)

    if (ratio) {
      if (hasN || hasS) {
        if (hasW || hasE) h = w / ratio
        else w = h * ratio
      } else {
        h = w / ratio
      }
      if (w > W) {
        w = W
        h = w / ratio
      }
      if (h > H) {
        h = H
        w = h * ratio
      }
    } else {
      w = Math.min(w, W)
      h = Math.min(h, H)
    }

    const anchorRight = hasW && !hasE
    const anchorBottom = hasN && !hasS
    const centerX = !hasW && !hasE
    const centerY = !hasN && !hasS

    let x = centerX
      ? start.x + start.w / 2 - w / 2
      : anchorRight
        ? start.x + start.w - w
        : start.x
    let y = centerY
      ? start.y + start.h / 2 - h / 2
      : anchorBottom
        ? start.y + start.h - h
        : start.y

    x = clamp(x, 0, Math.max(0, W - w))
    y = clamp(y, 0, Math.max(0, H - h))
    return { x, y, w, h }
  }

  function onPointerDown(kind: DragKind, e: ReactPointerEvent<HTMLElement>) {
    if (!natural) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { kind, sx: e.clientX, sy: e.clientY, start: crop }
    reset()
  }

  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag || scale <= 0) return
    const dx = (e.clientX - drag.sx) / scale
    const dy = (e.clientY - drag.sy) / scale
    setCrop(applyDrag(drag.kind, dx, dy, drag.start))
  }

  function onPointerUp(e: ReactPointerEvent<HTMLElement>) {
    if (dragRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    dragRef.current = null
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!natural) return
    const step = e.shiftKey ? 20 : 1
    const resizing = e.altKey
    let dx = 0
    let dy = 0
    if (e.key === 'ArrowLeft') dx = -step
    else if (e.key === 'ArrowRight') dx = step
    else if (e.key === 'ArrowUp') dy = -step
    else if (e.key === 'ArrowDown') dy = step
    else return
    e.preventDefault()
    reset()
    setCrop((c) => applyDrag(resizing ? 'se' : 'move', dx, dy, c))
  }

  function setField(field: keyof Rect, value: string) {
    if (!natural) return
    const n = Number(value)
    if (!Number.isFinite(n)) return
    reset()
    setCrop((c) => {
      const next = { ...c, [field]: Math.round(n) }
      next.w = clamp(next.w, MIN_SIZE, natural.w)
      next.h = clamp(next.h, MIN_SIZE, natural.h)
      if (ratio && (field === 'w' || field === 'h')) {
        if (field === 'w') next.h = clamp(Math.round(next.w / ratio), MIN_SIZE, natural.h)
        else next.w = clamp(Math.round(next.h * ratio), MIN_SIZE, natural.w)
      }
      next.x = clamp(next.x, 0, natural.w - next.w)
      next.y = clamp(next.y, 0, natural.h - next.h)
      return next
    })
  }

  function selectAll() {
    if (!natural) return
    reset()
    setCrop(fitRatio({ x: 0, y: 0, w: natural.w, h: natural.h }, ratio, natural))
  }

  function centerCrop() {
    if (!natural) return
    reset()
    setCrop((c) => ({
      ...c,
      x: Math.round((natural.w - c.w) / 2),
      y: Math.round((natural.h - c.h) / 2),
    }))
  }

  /* ── live preview ────────────────────────────────────────────────── */

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !bitmap || crop.w < 1 || crop.h < 1) return
    const maxSide = 260
    const s = Math.min(maxSide / crop.w, maxSide / crop.h, 1)
    canvas.width = Math.max(1, Math.round(crop.w * s))
    canvas.height = Math.max(1, Math.round(crop.h * s))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      bitmap,
      Math.round(crop.x),
      Math.round(crop.y),
      Math.round(crop.w),
      Math.round(crop.h),
      0,
      0,
      canvas.width,
      canvas.height,
    )
  }, [bitmap, crop])

  /* ── export ──────────────────────────────────────────────────────── */

  async function exportCrop() {
    if (!bitmap || !file) return
    setBusy(true)
    setError(null)
    try {
      const w = Math.max(1, Math.round(crop.w))
      const h = Math.max(1, Math.round(crop.h))
      const outFormat: OutputFormat = format === 'auto' ? formatFromFile(file) : format
      const canvas = createCanvas(w, h)
      const ctx = get2d(canvas)
      if (outFormat === 'jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
      }
      ctx.drawImage(bitmap, Math.round(crop.x), Math.round(crop.y), w, h, 0, 0, w, h)
      const blob = await encodeCanvas(canvas, outFormat, quality / 100)
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return {
          blob,
          name: outputName(file, `-cropped-${w}x${h}`, outFormat),
          url: URL.createObjectURL(blob),
        }
      })
    } catch (err) {
      setError(errorMessage(err, 'The crop could not be rendered.'))
    } finally {
      setBusy(false)
    }
  }

  const effectiveFormat: OutputFormat = format === 'auto' ? (file ? formatFromFile(file) : 'png') : format

  const box =
    natural && display.w > 0
      ? {
          left: (crop.x / natural.w) * display.w,
          top: (crop.y / natural.h) * display.h,
          width: (crop.w / natural.w) * display.w,
          height: (crop.h / natural.h) * display.h,
        }
      : null

  return (
    <div className="space-y-6">
      {!file && (
        <FileDropzone
          accept={IMAGE_ACCEPT}
          onFiles={onFiles}
          maxSizeMb={200}
          title="Drop an image to crop"
          hint="or click to browse"
        />
      )}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {file && natural && imgUrl && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* ── editor ── */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {natural.w} × {natural.h} px · {formatBytes(file.size)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={selectAll}>
                <Maximize className="size-4" aria-hidden="true" />
                Select all
              </Button>
              <Button variant="outline" size="sm" onClick={centerCrop}>
                <Crop className="size-4" aria-hidden="true" />
                Center
              </Button>
            </div>

            <div
              className="relative flex justify-center overflow-hidden rounded-lg bg-muted p-2"
              style={CHECKER_STYLE}
            >
              <div className="relative touch-none">
                <img
                  ref={imgRef}
                  src={imgUrl}
                  alt="Image being cropped"
                  onLoad={measure}
                  draggable={false}
                  className="block max-h-[60dvh] w-auto max-w-full select-none"
                />
                {box && (
                  <div
                    className="absolute inset-0"
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                  >
                    {/* dimmed area outside the crop */}
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0"
                      style={{ height: box.top, background: 'color-mix(in oklch, var(--background) 68%, transparent)' }}
                    />
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0"
                      style={{
                        top: box.top + box.height,
                        background: 'color-mix(in oklch, var(--background) 68%, transparent)',
                      }}
                    />
                    <div
                      className="pointer-events-none absolute left-0"
                      style={{
                        top: box.top,
                        height: box.height,
                        width: box.left,
                        background: 'color-mix(in oklch, var(--background) 68%, transparent)',
                      }}
                    />
                    <div
                      className="pointer-events-none absolute right-0"
                      style={{
                        top: box.top,
                        height: box.height,
                        left: box.left + box.width,
                        background: 'color-mix(in oklch, var(--background) 68%, transparent)',
                      }}
                    />

                    <div
                      role="group"
                      tabIndex={0}
                      aria-label={`Crop area, ${Math.round(crop.w)} by ${Math.round(crop.h)} pixels at ${Math.round(crop.x)}, ${Math.round(crop.y)}. Arrow keys move, Alt plus arrow keys resize, Shift for larger steps.`}
                      onKeyDown={onKeyDown}
                      onPointerDown={(e) => onPointerDown('move', e)}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      className="absolute cursor-move outline-2 outline-offset-0 outline-primary focus-visible:outline-4 focus-visible:outline-ring"
                      style={{
                        left: box.left,
                        top: box.top,
                        width: box.width,
                        height: box.height,
                        boxShadow: '0 0 0 1px color-mix(in oklch, var(--background) 80%, transparent)',
                      }}
                    >
                      <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-60">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div key={i} className="border border-primary/40" />
                        ))}
                      </div>
                      {HANDLES.map((handle) => (
                        <span
                          key={handle.kind}
                          role="presentation"
                          aria-hidden="true"
                          onPointerDown={(e) => onPointerDown(handle.kind, e)}
                          onPointerMove={onPointerMove}
                          onPointerUp={onPointerUp}
                          className={`absolute size-3 rounded-full border-2 border-primary bg-background ${handle.className}`}
                          style={{ cursor: handle.cursor }}
                          title={`Drag the ${handle.label} handle`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Drag inside the box to move it, drag a handle to resize. With the box focused, arrow
              keys nudge it one pixel, <kbd>Shift</kbd> + arrows move 20 px and <kbd>Alt</kbd> +
              arrows resize.
            </p>
          </div>

          {/* ── controls ── */}
          <div className="space-y-4">
            <ToolPanel title="Crop area" description="Values are in original image pixels.">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="crop-ratio">Aspect ratio</Label>
                  <Select value={ratioId} onValueChange={changeRatio}>
                    <SelectTrigger id="crop-ratio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RATIOS.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="crop-x">X</Label>
                    <Input
                      id="crop-x"
                      type="number"
                      inputMode="numeric"
                      value={Math.round(crop.x)}
                      onChange={(e) => setField('x', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crop-y">Y</Label>
                    <Input
                      id="crop-y"
                      type="number"
                      inputMode="numeric"
                      value={Math.round(crop.y)}
                      onChange={(e) => setField('y', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crop-w">Width</Label>
                    <Input
                      id="crop-w"
                      type="number"
                      inputMode="numeric"
                      value={Math.round(crop.w)}
                      onChange={(e) => setField('w', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crop-h">Height</Label>
                    <Input
                      id="crop-h"
                      type="number"
                      inputMode="numeric"
                      value={Math.round(crop.h)}
                      onChange={(e) => setField('h', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="crop-format">Output format</Label>
                  <Select value={format} onValueChange={(v) => setFormat(v as 'auto' | OutputFormat)}>
                    <SelectTrigger id="crop-format">
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
                    <Label id="crop-quality-label">Quality: {quality}</Label>
                    <Slider
                      aria-labelledby="crop-quality-label"
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

            <ToolPanel title="Preview" description={`${Math.round(crop.w)} × ${Math.round(crop.h)} px`}>
              <div
                className="flex min-h-32 items-center justify-center rounded-md bg-muted p-2"
                style={CHECKER_STYLE}
              >
                <canvas ref={previewRef} className="max-h-64 max-w-full" aria-label="Cropped preview" />
              </div>
              <div className="mt-4 space-y-2">
                <Button className="w-full" onClick={exportCrop} disabled={busy}>
                  <Crop className="size-4" aria-hidden="true" />
                  {busy ? 'Rendering…' : 'Crop image'}
                </Button>
                {result && (
                  <>
                    <DownloadButton blob={result.blob} filename={result.name} label="Download cropped image" />
                    <p role="status" aria-live="polite" className="text-center text-xs text-muted-foreground">
                      Ready: {formatBytes(result.blob.size)}
                    </p>
                  </>
                )}
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    reset()
                    setFile(null)
                    setBitmap((prev) => {
                      prev?.close()
                      return null
                    })
                    setImgUrl(null)
                  }}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Choose another image
                </Button>
              </div>
            </ToolPanel>
          </div>
        </div>
      )}
    </div>
  )
}
