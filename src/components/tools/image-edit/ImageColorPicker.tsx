import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Palette, Pipette, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import {
  PHOTO_ACCEPT,
  PHOTO_CHECKER,
  bitmapToCanvas,
  canvasData,
  ctx2d,
  decodePhoto,
  makeCanvas,
  photoError,
  rgbToHex,
  rgbToHsl,
} from './photo-image'

interface Pick {
  hex: string
  r: number
  g: number
  b: number
  a: number
  x: number
  y: number
}

const LOUPE_PX = 132
const LOUPE_CELLS = 11

function readPixel(data: ImageData, x: number, y: number): { r: number; g: number; b: number; a: number } {
  const cx = Math.min(data.width - 1, Math.max(0, Math.round(x)))
  const cy = Math.min(data.height - 1, Math.max(0, Math.round(y)))
  const i = (cy * data.width + cx) * 4
  return {
    r: data.data[i] as number,
    g: data.data[i + 1] as number,
    b: data.data[i + 2] as number,
    a: data.data[i + 3] as number,
  }
}

/** Median-cut quantisation — the classic GIF palette algorithm, ~40 lines. */
function medianCut(data: ImageData, count: number): { hex: string; share: number }[] {
  const pixels: [number, number, number][] = []
  const total = data.width * data.height
  const step = Math.max(1, Math.floor(total / 24000))
  for (let i = 0; i < total; i += step) {
    const o = i * 4
    if ((data.data[o + 3] as number) < 24) continue
    pixels.push([data.data[o] as number, data.data[o + 1] as number, data.data[o + 2] as number])
  }
  if (pixels.length === 0) return []

  let boxes: [number, number, number][][] = [pixels]
  while (boxes.length < count) {
    let widest = -1
    let widestSpread = -1
    let channel: 0 | 1 | 2 = 0
    boxes.forEach((box, index) => {
      if (box.length < 2) return
      for (const c of [0, 1, 2] as const) {
        let min = 255
        let max = 0
        for (const p of box) {
          const v = p[c]
          if (v < min) min = v
          if (v > max) max = v
        }
        const spread = max - min
        if (spread > widestSpread) {
          widestSpread = spread
          widest = index
          channel = c
        }
      }
    })
    if (widest < 0 || widestSpread <= 0) break
    const box = boxes[widest] as [number, number, number][]
    box.sort((a, b) => a[channel] - b[channel])
    const mid = Math.floor(box.length / 2)
    boxes = [...boxes.slice(0, widest), box.slice(0, mid), box.slice(mid), ...boxes.slice(widest + 1)]
  }

  return boxes
    .filter((box) => box.length > 0)
    .map((box) => {
      let r = 0
      let g = 0
      let b = 0
      for (const p of box) {
        r += p[0]
        g += p[1]
        b += p[2]
      }
      return {
        hex: rgbToHex(r / box.length, g / box.length, b / box.length),
        share: box.length / pixels.length,
      }
    })
    .sort((a, b) => b.share - a.share)
}

export default function ImageColorPicker() {
  const [bitmapSize, setBitmapSize] = useState<{ w: number; h: number } | null>(null)
  const [pick, setPick] = useState<Pick | null>(null)
  const [history, setHistory] = useState<Pick[]>([])
  const [palette, setPalette] = useState<{ hex: string; share: number }[]>([])
  const [paletteSize, setPaletteSize] = useState(8)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const dataRef = useRef<ImageData | null>(null)
  const displayRef = useRef<HTMLCanvasElement | null>(null)
  const loupeRef = useRef<HTMLCanvasElement | null>(null)

  const onFiles = useCallback(async (incoming: File[]) => {
    const file = incoming[0]
    if (!file) return
    setError(null)
    try {
      const decoded = await decodePhoto(file)
      const full = bitmapToCanvas(decoded.bitmap)
      decoded.bitmap.close()
      const data = canvasData(full)
      dataRef.current = data
      setBitmapSize({ w: data.width, h: data.height })

      const target = displayRef.current
      if (target) {
        const scale = Math.min(900 / data.width, 1)
        target.width = Math.round(data.width * scale)
        target.height = Math.round(data.height * scale)
        const ctx = target.getContext('2d')
        if (ctx) {
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(full, 0, 0, target.width, target.height)
        }
      }

      setPalette(medianCut(data, paletteSize))
      setPick(null)
      setHistory([])
      setCursor({ x: Math.floor(data.width / 2), y: Math.floor(data.height / 2) })
      setStatus(`Loaded ${file.name} (${data.width}×${data.height} px). Hover or use the arrow keys to sample.`)
    } catch (err) {
      setError(photoError(err, 'That image could not be opened.'))
    }
  }, [paletteSize])

  /* Recompute the palette when the swatch count changes. */
  useEffect(() => {
    const data = dataRef.current
    if (!data) return
    setPalette(medianCut(data, paletteSize))
  }, [paletteSize])

  /* Paint the loupe. */
  useEffect(() => {
    const canvas = loupeRef.current
    const data = dataRef.current
    if (!canvas || !data || !cursor) return
    canvas.width = LOUPE_PX
    canvas.height = LOUPE_PX
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cell = LOUPE_PX / LOUPE_CELLS
    const half = Math.floor(LOUPE_CELLS / 2)
    ctx.clearRect(0, 0, LOUPE_PX, LOUPE_PX)
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const p = readPixel(data, cursor.x + dx, cursor.y + dy)
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${(p.a / 255).toFixed(3)})`
        ctx.fillRect((dx + half) * cell, (dy + half) * cell, Math.ceil(cell), Math.ceil(cell))
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 1
    ctx.strokeRect(half * cell + 0.5, half * cell + 0.5, cell - 1, cell - 1)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.strokeRect(half * cell - 0.5, half * cell - 0.5, cell + 1, cell + 1)
  }, [cursor])

  function toImagePoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = displayRef.current
    const data = dataRef.current
    if (!canvas || !data) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    return {
      x: Math.floor(((event.clientX - rect.left) / rect.width) * data.width),
      y: Math.floor(((event.clientY - rect.top) / rect.height) * data.height),
    }
  }

  function sampleAt(x: number, y: number, commit: boolean) {
    const data = dataRef.current
    if (!data) return
    const p = readPixel(data, x, y)
    const next: Pick = { ...p, hex: rgbToHex(p.r, p.g, p.b), x: Math.round(x), y: Math.round(y) }
    setPick(next)
    if (commit) {
      setHistory((prev) => [next, ...prev.filter((h) => h.hex !== next.hex)].slice(0, 24))
      setStatus(`Picked ${next.hex} at ${next.x}, ${next.y}.`)
    }
  }

  function onMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = toImagePoint(event)
    if (!point) return
    setCursor(point)
    sampleAt(point.x, point.y, false)
  }

  function onClick(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = toImagePoint(event)
    if (!point) return
    setCursor(point)
    sampleAt(point.x, point.y, true)
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLCanvasElement>) {
    const data = dataRef.current
    if (!data || !cursor) return
    const step = event.shiftKey ? 10 : 1
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      sampleAt(cursor.x, cursor.y, true)
      return
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const next = {
      x: Math.min(data.width - 1, Math.max(0, cursor.x + move[0])),
      y: Math.min(data.height - 1, Math.max(0, cursor.y + move[1])),
    }
    setCursor(next)
    sampleAt(next.x, next.y, false)
  }

  const hsl = pick ? rgbToHsl(pick.r, pick.g, pick.b) : null
  const alpha = pick ? Number((pick.a / 255).toFixed(3)) : 1

  const strings = useMemo(() => {
    if (!pick || !hsl) return []
    return [
      { label: 'HEX', value: pick.hex },
      { label: 'RGB', value: `rgb(${pick.r}, ${pick.g}, ${pick.b})` },
      { label: 'RGBA', value: `rgba(${pick.r}, ${pick.g}, ${pick.b}, ${alpha})` },
      { label: 'HSL', value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
      { label: 'CSS var', value: `--picked: ${pick.hex};` },
      { label: 'Swift / iOS', value: `UIColor(red: ${(pick.r / 255).toFixed(3)}, green: ${(pick.g / 255).toFixed(3)}, blue: ${(pick.b / 255).toFixed(3)}, alpha: ${alpha})` },
    ]
  }, [pick, hsl, alpha])

  const paletteCss = palette.map((p, i) => `--swatch-${i + 1}: ${p.hex};`).join('\n')

  function reset() {
    dataRef.current = null
    setBitmapSize(null)
    setPick(null)
    setHistory([])
    setPalette([])
    setCursor(null)
    setStatus('')
    const target = displayRef.current
    if (target) {
      const blank = makeCanvas(1, 1)
      target.width = blank.width
      target.height = blank.height
      ctx2d(target).clearRect(0, 0, 1, 1)
    }
  }

  return (
    <div className="space-y-6">
      {!bitmapSize && (
        <FileDropzone
          accept={PHOTO_ACCEPT}
          onFiles={onFiles}
          maxSizeMb={100}
          title="Drop an image to pick colours from"
          hint="Screenshots, photos or logos. The pixels are read with getImageData in your browser"
        />
      )}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      <div className={bitmapSize ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]' : 'hidden'}>
        <ToolPanel
          title="Image"
          description="Move the pointer to preview a colour, click to keep it. The canvas is focusable: use the arrow keys for pixel-perfect sampling and Enter to pick."
        >
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-lg bg-muted p-2"
            style={PHOTO_CHECKER}
          >
            <canvas
              ref={displayRef}
              tabIndex={0}
              role="img"
              aria-label="Image to sample colours from. Use the arrow keys to move the sample point and Enter to pick."
              className="max-h-[60dvh] max-w-full cursor-crosshair touch-none rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onPointerMove={onMove}
              onPointerDown={onClick}
              onKeyDown={onKeyDown}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <canvas
                ref={loupeRef}
                aria-hidden="true"
                className="rounded-lg border border-border"
                style={{ width: LOUPE_PX, height: LOUPE_PX, imageRendering: 'pixelated' }}
              />
              <div className="text-sm">
                <p className="font-medium">Magnifier</p>
                <p className="text-muted-foreground">
                  {cursor ? `x ${cursor.x}, y ${cursor.y}` : 'Move over the image'}
                </p>
                {bitmapSize && (
                  <p className="text-xs text-muted-foreground">
                    Image is {bitmapSize.w} × {bitmapSize.h} px
                  </p>
                )}
              </div>
            </div>
          </div>
        </ToolPanel>

        <div className="space-y-6">
          <ToolPanel title="Picked colour">
            {pick ? (
              <div className="space-y-3">
                <div
                  className="flex h-20 items-end justify-end rounded-lg bg-muted p-2"
                  style={{ backgroundColor: `rgba(${pick.r},${pick.g},${pick.b},${alpha})` }}
                >
                  <span className="rounded bg-background/85 px-2 py-0.5 font-mono text-xs text-foreground">
                    {pick.hex}
                  </span>
                </div>
                <dl className="space-y-2">
                  {strings.map((s) => (
                    <div key={s.label} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{s.label}</dt>
                        <dd className="truncate font-mono text-sm" title={s.value}>
                          {s.value}
                        </dd>
                      </div>
                      <CopyButton value={s.value} size="icon" label={`Copy ${s.label} value`} />
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                <Pipette className="mr-1 inline size-4" aria-hidden="true" />
                Hover the image, then click to lock a colour in.
              </p>
            )}
          </ToolPanel>

          <ToolPanel
            title={
              <span className="flex items-center gap-2">
                <Palette className="size-4" aria-hidden="true" /> Dominant palette
              </span>
            }
          >
            <div className="space-y-3">
              <div className="space-y-2">
                <Label id="palette-size-label">Swatches: {paletteSize}</Label>
                <Slider
                  aria-labelledby="palette-size-label"
                  min={2}
                  max={16}
                  step={1}
                  value={[paletteSize]}
                  onValueChange={(v) => setPaletteSize(v[0] ?? 8)}
                />
              </div>
              <ul className="space-y-1.5">
                {palette.map((swatch) => (
                  <li key={swatch.hex} className="flex items-center gap-2">
                    <span
                      className="size-6 shrink-0 rounded border border-border"
                      style={{ backgroundColor: swatch.hex }}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-sm">{swatch.hex}</span>
                    <span className="text-xs text-muted-foreground">
                      {(swatch.share * 100).toFixed(1)}%
                    </span>
                    <CopyButton value={swatch.hex} size="icon" label={`Copy ${swatch.hex}`} className="ml-auto" />
                  </li>
                ))}
              </ul>
              {palette.length > 0 && <CopyButton value={paletteCss} label="Copy palette as CSS variables" />}
            </div>
          </ToolPanel>

          {history.length > 0 && (
            <ToolPanel title="Eyedropper history">
              <ul className="space-y-1.5">
                {history.map((h) => (
                  <li key={`${h.hex}-${h.x}-${h.y}`} className="flex items-center gap-2">
                    <span
                      className="size-6 shrink-0 rounded border border-border"
                      style={{ backgroundColor: h.hex }}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-sm">{h.hex}</span>
                    <span className="text-xs text-muted-foreground">
                      {h.x}, {h.y}
                    </span>
                    <CopyButton value={h.hex} size="icon" label={`Copy ${h.hex}`} className="ml-auto" />
                  </li>
                ))}
              </ul>
              <Button type="button" variant="ghost" size="sm" onClick={() => setHistory([])}>
                <Trash2 className="size-4" aria-hidden="true" /> Clear history
              </Button>
            </ToolPanel>
          )}

          <Button type="button" variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="size-4" aria-hidden="true" /> Use a different image
          </Button>
        </div>
      </div>

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>
    </div>
  )
}
