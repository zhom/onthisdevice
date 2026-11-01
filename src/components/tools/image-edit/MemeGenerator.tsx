import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Download, Plus, RotateCcw, Trash2, Type } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { downloadBlob, formatBytes } from '@/lib/utils'
import {
  PHOTO_ACCEPT,
  PHOTO_CHECKER,
  decodePhoto,
  encodePhotoCanvas,
  makeCanvas,
  ctx2d,
  nextPhotoId,
  photoError,
  photoOutputName,
  type PhotoFormat,
} from './photo-image'

/* ─────────────────────────── model ─────────────────────────── */

const FONTS = [
  { id: 'impact', label: 'Impact (classic meme)', stack: 'Impact, "Anton", "Haettenschweiler", "Arial Black", sans-serif' },
  { id: 'sans', label: 'Sans-serif (Helvetica/Arial)', stack: 'Helvetica, Arial, sans-serif' },
  { id: 'black', label: 'Heavy sans (Arial Black)', stack: '"Arial Black", "Helvetica Bold", sans-serif' },
  { id: 'serif', label: 'Serif (Georgia/Times)', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Monospace (Courier)', stack: '"Courier New", ui-monospace, monospace' },
  { id: 'comic', label: 'Comic Sans MS', stack: '"Comic Sans MS", "Chalkboard SE", cursive' },
  { id: 'script', label: 'Script (Brush/Segoe)', stack: '"Brush Script MT", "Segoe Script", "Snell Roundhand", cursive' },
] as const

type FontId = (typeof FONTS)[number]['id']

function fontStack(id: FontId): string {
  return FONTS.find((f) => f.id === id)?.stack ?? FONTS[1].stack
}

interface TextBox {
  id: string
  text: string
  /** Horizontal centre, 0–1 of image width. */
  cx: number
  /** Vertical centre, 0–1 of image height. */
  cy: number
  /** Max line width, 0–1 of image width. */
  width: number
  /** Font size as a percentage of image height. */
  size: number
  font: FontId
  color: string
  stroke: string
  /** Outline thickness as a percentage of the font size. */
  strokeWidth: number
  uppercase: boolean
  align: 'left' | 'center' | 'right'
  shadow: boolean
}

function makeBox(partial: Partial<TextBox>): TextBox {
  return {
    id: nextPhotoId(),
    text: '',
    cx: 0.5,
    cy: 0.5,
    width: 0.92,
    size: 10,
    font: 'impact',
    color: '#ffffff',
    stroke: '#000000',
    strokeWidth: 14,
    uppercase: true,
    align: 'center',
    shadow: false,
    ...partial,
  }
}

interface LaidOutBox {
  box: TextBox
  lines: string[]
  fontPx: number
  lineHeight: number
  left: number
  top: number
  boxWidth: number
  boxHeight: number
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const out: string[] = []
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      out.push('')
      continue
    }
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= maxWidth || line === '') {
        line = candidate
      } else {
        out.push(line)
        line = word
      }
    }
    out.push(line)
  }
  return out
}

function layout(
  ctx: CanvasRenderingContext2D,
  box: TextBox,
  w: number,
  h: number,
): LaidOutBox {
  const fontPx = Math.max(6, (box.size / 100) * h)
  ctx.font = `bold ${fontPx}px ${fontStack(box.font)}`
  const maxWidth = Math.max(24, box.width * w)
  const text = box.uppercase ? box.text.toUpperCase() : box.text
  const lines = wrapLines(ctx, text, maxWidth)
  const lineHeight = fontPx * 1.14
  const boxHeight = Math.max(lineHeight, lines.length * lineHeight)
  const widest = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0)
  const boxWidth = Math.max(widest, 24)
  const centreX = box.cx * w
  const left =
    box.align === 'center'
      ? centreX - boxWidth / 2
      : box.align === 'left'
        ? centreX - (box.width * w) / 2
        : centreX + (box.width * w) / 2 - boxWidth
  const top = box.cy * h - boxHeight / 2
  return { box, lines, fontPx, lineHeight, left, top, boxWidth, boxHeight }
}

function drawBox(ctx: CanvasRenderingContext2D, laid: LaidOutBox, w: number) {
  const { box, lines, fontPx, lineHeight } = laid
  ctx.save()
  ctx.font = `bold ${fontPx}px ${fontStack(box.font)}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = box.align === 'center' ? 'center' : box.align === 'left' ? 'left' : 'right'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2

  const centreX = box.cx * w
  const anchorX =
    box.align === 'center'
      ? centreX
      : box.align === 'left'
        ? centreX - (box.width * w) / 2
        : centreX + (box.width * w) / 2

  if (box.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = fontPx * 0.18
    ctx.shadowOffsetY = fontPx * 0.05
  }

  lines.forEach((line, i) => {
    const y = laid.top + i * lineHeight + lineHeight / 2
    if (box.strokeWidth > 0) {
      ctx.lineWidth = (box.strokeWidth / 100) * fontPx
      ctx.strokeStyle = box.stroke
      ctx.strokeText(line, anchorX, y)
    }
    ctx.fillStyle = box.color
    ctx.fillText(line, anchorX, y)
  })
  ctx.restore()
}

function renderMeme(
  bitmap: ImageBitmap,
  boxes: TextBox[],
  padTop: number,
  padBottom: number,
  padColor: string,
  scale: number,
): HTMLCanvasElement {
  const iw = Math.round(bitmap.width * scale)
  const ih = Math.round(bitmap.height * scale)
  const top = Math.round((padTop / 100) * ih)
  const bottom = Math.round((padBottom / 100) * ih)
  const canvas = makeCanvas(iw, ih + top + bottom)
  const ctx = ctx2d(canvas)
  if (top > 0 || bottom > 0) {
    ctx.fillStyle = padColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(bitmap, 0, top, iw, ih)
  for (const box of boxes) {
    if (!box.text.trim()) continue
    drawBox(ctx, layout(ctx, box, canvas.width, canvas.height), canvas.width)
  }
  return canvas
}

/* ─────────────────────────── component ─────────────────────────── */

export interface MemeGeneratorProps {
  /** `meme` = Impact preset with top/bottom captions. `text` = plain caption tool. */
  variant?: 'meme' | 'text'
}

const PREVIEW_MAX = 720

export default function MemeGenerator({ variant = 'meme' }: MemeGeneratorProps) {
  const isMeme = variant === 'meme'

  const [file, setFile] = useState<File | null>(null)
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [boxes, setBoxes] = useState<TextBox[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [padTop, setPadTop] = useState(0)
  const [padBottom, setPadBottom] = useState(0)
  const [padColor, setPadColor] = useState('#ffffff')
  const [format, setFormat] = useState<PhotoFormat>('png')
  const [quality, setQuality] = useState(92)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [output, setOutput] = useState<{ blob: Blob; name: string; url: string } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const outputRef = useRef<typeof output>(null)
  outputRef.current = output

  useEffect(
    () => () => {
      if (outputRef.current) URL.revokeObjectURL(outputRef.current.url)
    },
    [],
  )

  const selected = boxes.find((b) => b.id === selectedId) ?? null

  const clearOutput = useCallback(() => {
    setOutput((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }, [])

  const onFiles = useCallback(
    async (incoming: File[]) => {
      const next = incoming[0]
      if (!next) return
      setError(null)
      clearOutput()
      try {
        const decoded = await decodePhoto(next)
        setBitmap((prev) => {
          prev?.close()
          return decoded.bitmap
        })
        setFile(next)
        const initial = isMeme
          ? [
              makeBox({ text: 'TOP TEXT', cy: 0.09, size: 11 }),
              makeBox({ text: 'BOTTOM TEXT', cy: 0.91, size: 11 }),
            ]
          : [
              makeBox({
                text: 'Your caption here',
                cy: 0.85,
                size: 7,
                font: 'sans',
                uppercase: false,
                strokeWidth: 0,
                shadow: true,
              }),
            ]
        setBoxes(initial)
        setSelectedId(initial[0]?.id ?? null)
        setStatus(`Loaded ${next.name} (${decoded.width}×${decoded.height} px).`)
      } catch (err) {
        setError(photoError(err, 'That image could not be opened.'))
      }
    },
    [clearOutput, isMeme],
  )

  const previewScale = useMemo(() => {
    if (!bitmap) return 1
    return Math.min(PREVIEW_MAX / bitmap.width, 1)
  }, [bitmap])

  /* Redraw the preview whenever anything visual changes. */
  useEffect(() => {
    const target = canvasRef.current
    if (!target || !bitmap) return
    const rendered = renderMeme(bitmap, boxes, padTop, padBottom, padColor, previewScale)
    target.width = rendered.width
    target.height = rendered.height
    const ctx = target.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, target.width, target.height)
    ctx.drawImage(rendered, 0, 0)

    // Selection outline, drawn on the preview only — never exported.
    if (selected && selected.text.trim()) {
      const laid = layout(ctx, selected, target.width, target.height)
      ctx.save()
      // Black dashes on a white line, so the outline shows on any photo.
      ctx.lineWidth = 2
      ctx.strokeStyle = '#ffffff'
      ctx.strokeRect(laid.left - 6, laid.top - 6, laid.boxWidth + 12, laid.boxHeight + 12)
      ctx.strokeStyle = '#000000'
      ctx.setLineDash([6, 4])
      ctx.strokeRect(laid.left - 6, laid.top - 6, laid.boxWidth + 12, laid.boxHeight + 12)
      ctx.restore()
    }
  }, [bitmap, boxes, padTop, padBottom, padColor, previewScale, selected])

  function updateSelected(patch: Partial<TextBox>) {
    if (!selectedId) return
    clearOutput()
    setBoxes((prev) => prev.map((b) => (b.id === selectedId ? { ...b, ...patch } : b)))
  }

  function addBox() {
    clearOutput()
    const created = makeBox({
      text: 'New text',
      cy: 0.5,
      size: isMeme ? 10 : 7,
      font: isMeme ? 'impact' : 'sans',
      uppercase: isMeme,
      strokeWidth: isMeme ? 14 : 0,
      shadow: !isMeme,
    })
    setBoxes((prev) => [...prev, created])
    setSelectedId(created.id)
  }

  function removeBox(id: string) {
    clearOutput()
    setBoxes((prev) => prev.filter((b) => b.id !== id))
    setSelectedId((prev) => (prev === id ? null : prev))
  }

  /* ── pointer dragging on the preview ── */

  function pointToImage(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    }
  }

  function hitTest(nx: number, ny: number): TextBox | null {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return null
    for (let i = boxes.length - 1; i >= 0; i--) {
      const box = boxes[i] as TextBox
      if (!box.text.trim()) continue
      const laid = layout(ctx, box, canvas.width, canvas.height)
      const x = nx * canvas.width
      const y = ny * canvas.height
      if (
        x >= laid.left - 8 &&
        x <= laid.left + laid.boxWidth + 8 &&
        y >= laid.top - 8 &&
        y <= laid.top + laid.boxHeight + 8
      ) {
        return box
      }
    }
    return null
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = pointToImage(event)
    if (!point) return
    const hit = hitTest(point.x, point.y)
    if (!hit) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedId(hit.id)
    dragRef.current = { id: hit.id, dx: point.x - hit.cx, dy: point.y - hit.cy }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag) return
    const point = pointToImage(event)
    if (!point) return
    clearOutput()
    setBoxes((prev) =>
      prev.map((b) =>
        b.id === drag.id
          ? {
              ...b,
              cx: Math.min(1, Math.max(0, point.x - drag.dx)),
              cy: Math.min(1, Math.max(0, point.y - drag.dy)),
            }
          : b,
      ),
    )
  }

  function endDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (dragRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
  }

  function onCanvasKeyDown(event: ReactKeyboardEvent<HTMLCanvasElement>) {
    if (!selected) return
    const step = event.shiftKey ? 0.05 : 0.005
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    updateSelected({
      cx: Math.min(1, Math.max(0, selected.cx + move[0])),
      cy: Math.min(1, Math.max(0, selected.cy + move[1])),
    })
  }

  /* ── export ── */

  async function exportImage() {
    if (!bitmap || !file) return
    setBusy(true)
    setError(null)
    try {
      const canvas = renderMeme(bitmap, boxes, padTop, padBottom, padColor, 1)
      const blob = await encodePhotoCanvas(canvas, format, quality / 100)
      const name = photoOutputName(file.name, isMeme ? '-meme' : '-captioned', format)
      clearOutput()
      const url = URL.createObjectURL(blob)
      setOutput({ blob, name, url })
      setStatus(`Rendered ${canvas.width}×${canvas.height} px · ${formatBytes(blob.size)}.`)
      downloadBlob(blob, name)
    } catch (err) {
      setError(photoError(err, 'Rendering failed. Try a smaller image or a different format.'))
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    clearOutput()
    setBitmap((prev) => {
      prev?.close()
      return null
    })
    setFile(null)
    setBoxes([])
    setSelectedId(null)
    setPadTop(0)
    setPadBottom(0)
    setStatus('')
    setError(null)
  }

  const swatch: CSSProperties = { padding: 0, width: '2.75rem', height: '2.25rem' }

  return (
    <div className="space-y-6">
      {!bitmap && (
        <FileDropzone
          accept={PHOTO_ACCEPT}
          onFiles={onFiles}
          maxSizeMb={100}
          title={isMeme ? 'Drop a meme template or photo' : 'Drop the image you want to caption'}
          hint="JPG, PNG, WebP, AVIF or GIF"
        />
      )}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {bitmap && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <ToolPanel
            title="Canvas"
            description="Drag any caption to move it. Click to select, then use the arrow keys for fine nudges."
          >
            <div
              className="flex items-center justify-center overflow-hidden rounded-lg bg-muted p-2"
              style={PHOTO_CHECKER}
            >
              <canvas
                ref={canvasRef}
                tabIndex={0}
                role="img"
                aria-label="Meme preview. Click a caption to select it, then move it with the arrow keys."
                className="max-h-[60dvh] max-w-full cursor-move touch-none rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onCanvasKeyDown}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addBox}>
                <Plus className="size-4" aria-hidden="true" /> Add text box
              </Button>
              {boxes.map((box, i) => (
                <Button
                  key={box.id}
                  type="button"
                  size="sm"
                  variant={box.id === selectedId ? 'default' : 'outline'}
                  onClick={() => setSelectedId(box.id)}
                >
                  <Type className="size-4" aria-hidden="true" />
                  {box.text.trim() ? box.text.slice(0, 14) : `Text ${i + 1}`}
                </Button>
              ))}
            </div>
          </ToolPanel>

          <div className="space-y-6">
            <ToolPanel
              title={selected ? 'Selected text' : 'Text'}
              description={selected ? undefined : 'Select or add a text box to edit it.'}
              footer={
                <Button size="lg" className="w-full" onClick={exportImage} disabled={busy}>
                  <Download className="size-4" aria-hidden="true" />
                  {busy ? 'Rendering…' : `Download ${format === 'jpeg' ? 'JPG' : format.toUpperCase()}`}
                </Button>
              }
            >
              {selected && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="meme-text">Text</Label>
                    <Textarea
                      id="meme-text"
                      rows={3}
                      value={selected.text}
                      placeholder="Type your caption…"
                      onChange={(e) => updateSelected({ text: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="meme-font">Font</Label>
                    <Select
                      value={selected.font}
                      onValueChange={(v) => updateSelected({ font: v as FontId })}
                    >
                      <SelectTrigger id="meme-font">
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
                    <p className="text-xs text-muted-foreground">
                      The tool uses the fonts installed on your device. If Impact
                      is not installed, a condensed heavy sans is used instead.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label id="meme-size-label">Size: {selected.size.toFixed(1)}% of image height</Label>
                    <Slider
                      aria-labelledby="meme-size-label"
                      min={2}
                      max={30}
                      step={0.5}
                      value={[selected.size]}
                      onValueChange={(v) => updateSelected({ size: v[0] ?? 10 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label id="meme-width-label">
                      Wrap width: {Math.round(selected.width * 100)}% of image
                    </Label>
                    <Slider
                      aria-labelledby="meme-width-label"
                      min={20}
                      max={100}
                      step={1}
                      value={[Math.round(selected.width * 100)]}
                      onValueChange={(v) => updateSelected({ width: (v[0] ?? 92) / 100 })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="meme-color">Fill</Label>
                      <Input
                        id="meme-color"
                        type="color"
                        style={swatch}
                        value={selected.color}
                        onChange={(e) => updateSelected({ color: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="meme-stroke">Outline</Label>
                      <Input
                        id="meme-stroke"
                        type="color"
                        style={swatch}
                        value={selected.stroke}
                        onChange={(e) => updateSelected({ stroke: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label id="meme-stroke-width-label">Outline thickness: {selected.strokeWidth}%</Label>
                    <Slider
                      aria-labelledby="meme-stroke-width-label"
                      min={0}
                      max={30}
                      step={1}
                      value={[selected.strokeWidth]}
                      onValueChange={(v) => updateSelected({ strokeWidth: v[0] ?? 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="meme-align">Alignment</Label>
                    <Select
                      value={selected.align}
                      onValueChange={(v) => updateSelected({ align: v as TextBox['align'] })}
                    >
                      <SelectTrigger id="meme-align">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Centre</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-md bg-muted p-3">
                    <Label htmlFor="meme-caps">Force UPPERCASE</Label>
                    <Switch
                      id="meme-caps"
                      checked={selected.uppercase}
                      onCheckedChange={(v) => updateSelected({ uppercase: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-md bg-muted p-3">
                    <Label htmlFor="meme-shadow">Drop shadow</Label>
                    <Switch
                      id="meme-shadow"
                      checked={selected.shadow}
                      onCheckedChange={(v) => updateSelected({ shadow: v })}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeBox(selected.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" /> Delete this text box
                  </Button>
                </div>
              )}
            </ToolPanel>

            <ToolPanel title="Layout and export">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label id="meme-pad-top-label">White space above: {padTop}%</Label>
                  <Slider
                    aria-labelledby="meme-pad-top-label"
                    min={0}
                    max={40}
                    step={1}
                    value={[padTop]}
                    onValueChange={(v) => {
                      clearOutput()
                      setPadTop(v[0] ?? 0)
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label id="meme-pad-bottom-label">White space below: {padBottom}%</Label>
                  <Slider
                    aria-labelledby="meme-pad-bottom-label"
                    min={0}
                    max={40}
                    step={1}
                    value={[padBottom]}
                    onValueChange={(v) => {
                      clearOutput()
                      setPadBottom(v[0] ?? 0)
                    }}
                  />
                </div>
                {(padTop > 0 || padBottom > 0) && (
                  <div className="space-y-2">
                    <Label htmlFor="meme-pad-color">Bar colour</Label>
                    <Input
                      id="meme-pad-color"
                      type="color"
                      style={swatch}
                      value={padColor}
                      onChange={(e) => {
                        clearOutput()
                        setPadColor(e.target.value)
                      }}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="meme-format">Download as</Label>
                  <Select
                    value={format}
                    onValueChange={(v) => {
                      clearOutput()
                      setFormat(v as PhotoFormat)
                    }}
                  >
                    <SelectTrigger id="meme-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="png">PNG (sharpest text)</SelectItem>
                      <SelectItem value="jpeg">JPG (smallest file)</SelectItem>
                      <SelectItem value="webp">WebP (small and sharp)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {format !== 'png' && (
                  <div className="space-y-2">
                    <Label id="meme-quality-label">Quality: {quality}</Label>
                    <Slider
                      aria-labelledby="meme-quality-label"
                      min={40}
                      max={100}
                      step={1}
                      value={[quality]}
                      onValueChange={(v) => setQuality(v[0] ?? 92)}
                    />
                  </div>
                )}

                <Button type="button" variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="size-4" aria-hidden="true" /> Start over
                </Button>
              </div>
            </ToolPanel>
          </div>
        </div>
      )}

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>

      {output && (
        <ToolPanel title="Your image">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <img
              src={output.url}
              alt="Finished image"
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
