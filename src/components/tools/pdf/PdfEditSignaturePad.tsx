import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Eraser, PenLine, Type as TypeIcon, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { cn } from '@/lib/utils'
import { decodeImageToCanvas, encodeCanvasPng, get2dContext } from './pdf-edit-core'

export interface SignatureResult {
  bytes: Uint8Array
  width: number
  height: number
  label: string
}

interface Props {
  onCreate: (signature: SignatureResult) => void
  /** Wording differs between a signature, initials and a general stamp. */
  noun?: string
}

const INK_COLORS = [
  { value: '#111827', label: 'Black' },
  { value: '#1d4ed8', label: 'Blue' },
  { value: '#b91c1c', label: 'Red' },
]

const SCRIPT_FONTS = [
  { label: 'Flowing script', css: '"Segoe Script", "Bradley Hand", "Snell Roundhand", cursive' },
  { label: 'Brush', css: '"Brush Script MT", "Segoe Script", cursive' },
  { label: 'Handwritten serif', css: '"Apple Chancery", "URW Chancery L", "Palatino Linotype", cursive' },
  { label: 'Plain italic', css: 'Georgia, "Times New Roman", serif' },
]

/** Crop a transparent canvas down to the ink, with a little breathing room. */
function trimCanvas(canvas: HTMLCanvasElement, pad = 6): HTMLCanvasElement {
  const ctx = get2dContext(canvas)
  const { width, height } = canvas
  if (width === 0 || height === 0) return canvas
  const { data } = ctx.getImageData(0, 0, width, height)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return canvas
  const x0 = Math.max(0, minX - pad)
  const y0 = Math.max(0, minY - pad)
  const w = Math.min(width, maxX + pad) - x0 + 1
  const h = Math.min(height, maxY + pad) - y0 + 1
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  get2dContext(out).drawImage(canvas, x0, y0, w, h, 0, 0, w, h)
  return out
}

/** Fade a photographed signature's paper away so only the ink is left. */
function dropLightBackground(canvas: HTMLCanvasElement): void {
  const ctx = get2dContext(canvas)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    const alpha = lum >= 240 ? 0 : lum <= 180 ? 255 : Math.round(((240 - lum) / 60) * 255)
    data[i + 3] = Math.min(data[i + 3], alpha)
  }
  ctx.putImageData(image, 0, 0)
}

export function PdfEditSignaturePad({ onCreate, noun = 'signature' }: Props) {
  const drawRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<{ x: number; y: number }[][]>([])
  const activeRef = useRef<{ x: number; y: number }[] | null>(null)
  const [hasInk, setHasInk] = useState(false)
  const [color, setColor] = useState(INK_COLORS[0].value)
  const [thickness, setThickness] = useState(3)
  const [typed, setTyped] = useState('')
  const [fontIndex, setFontIndex] = useState(0)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [dropBackground, setDropBackground] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ids = useId()

  const repaint = useCallback(() => {
    const canvas = drawRef.current
    if (!canvas) return
    const ctx = get2dContext(canvas)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    const dpr = canvas.width / canvas.clientWidth || 1
    ctx.lineWidth = thickness * dpr
    for (const stroke of strokesRef.current) {
      if (stroke.length === 1) {
        ctx.beginPath()
        ctx.arc(stroke[0].x, stroke[0].y, ctx.lineWidth / 2, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        continue
      }
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y)
      ctx.stroke()
    }
  }, [color, thickness])

  // Size the drawing surface to its box, at device resolution.
  useEffect(() => {
    const canvas = drawRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        repaint()
      }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [repaint])

  useEffect(() => {
    repaint()
  }, [repaint])

  const pointOf = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY }
  }

  const onDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const stroke = [pointOf(event)]
    activeRef.current = stroke
    strokesRef.current = [...strokesRef.current, stroke]
    setHasInk(true)
    repaint()
  }

  const onMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const stroke = activeRef.current
    if (!stroke) return
    stroke.push(pointOf(event))
    repaint()
  }

  const onUp = () => {
    activeRef.current = null
  }

  const clear = () => {
    strokesRef.current = []
    activeRef.current = null
    setHasInk(false)
    repaint()
  }

  const undoStroke = () => {
    strokesRef.current = strokesRef.current.slice(0, -1)
    setHasInk(strokesRef.current.length > 0)
    repaint()
  }

  const emit = async (canvas: HTMLCanvasElement, label: string) => {
    const trimmed = trimCanvas(canvas)
    const bytes = await encodeCanvasPng(trimmed)
    onCreate({ bytes, width: trimmed.width, height: trimmed.height, label })
  }

  const useDrawn = async () => {
    setError(null)
    const canvas = drawRef.current
    if (!canvas || !hasInk) {
      setError(`Draw your ${noun} in the box first.`)
      return
    }
    try {
      await emit(canvas, `Drawn ${noun}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const useTyped = async () => {
    setError(null)
    const text = typed.trim()
    if (!text) {
      setError(`Type the name you want to use as your ${noun}.`)
      return
    }
    try {
      const font = SCRIPT_FONTS[fontIndex]
      const size = 160
      const measure = document.createElement('canvas')
      const mctx = get2dContext(measure)
      mctx.font = `italic ${size}px ${font.css}`
      const metrics = mctx.measureText(text)
      const width = Math.ceil(metrics.width + size * 0.4)
      const height = Math.ceil(size * 1.6)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = get2dContext(canvas)
      ctx.font = `italic ${size}px ${font.css}`
      ctx.fillStyle = color
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(text, size * 0.2, size * 1.15)
      await emit(canvas, `Typed ${noun}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const useUploaded = async () => {
    setError(null)
    if (!uploadFile) {
      setError('Choose a photo or scan of your signature first.')
      return
    }
    try {
      const canvas = await decodeImageToCanvas(uploadFile)
      if (dropBackground) dropLightBackground(canvas)
      await emit(canvas, 'Uploaded signature')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="draw">
        <TabsList className="w-full">
          <TabsTrigger value="draw" className="gap-1.5">
            <PenLine className="size-4" aria-hidden="true" />
            Draw
          </TabsTrigger>
          <TabsTrigger value="type" className="gap-1.5">
            <TypeIcon className="size-4" aria-hidden="true" />
            Type
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5">
            <Upload className="size-4" aria-hidden="true" />
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="space-y-3 pt-4">
          <canvas
            ref={drawRef}
            className="h-40 w-full touch-none rounded-lg border border-input sm:h-48"
            // Paper, not chrome: the signature lands on a white page, so the pad is white in both themes.
            style={{ backgroundColor: '#ffffff' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            aria-label={`Draw your ${noun} with a mouse, trackpad, stylus or finger`}
          />
          <p className="text-xs text-muted-foreground">
            Sign with a finger or stylus on a touchscreen. It is much steadier than a mouse. The
            drawing becomes a transparent PNG in this tab.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={undoStroke} disabled={!hasInk}>
              Undo stroke
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={clear}
              disabled={!hasInk}
            >
              <Eraser className="size-4" aria-hidden="true" />
              Clear
            </Button>
            <Button type="button" size="sm" className="ml-auto" onClick={() => void useDrawn()}>
              Use this {noun}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="type" className="space-y-3 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-typed`}>Name to render</Label>
            <Input
              id={`${ids}-typed`}
              value={typed}
              placeholder="Alex Moreau"
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Style</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SCRIPT_FONTS.map((font, index) => (
                <button
                  key={font.label}
                  type="button"
                  onClick={() => setFontIndex(index)}
                  aria-pressed={fontIndex === index}
                  className={cn(
                    'flex min-h-16 items-center justify-center rounded-lg border px-3 py-2 text-2xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    fontIndex === index
                      ? 'border-primary bg-background text-foreground'
                      : 'border-input bg-background text-muted-foreground hover:text-foreground',
                  )}
                  style={{ fontFamily: font.css, fontStyle: 'italic' }}
                >
                  <span className="truncate">{typed.trim() || font.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              These are the handwriting fonts already installed on your system. No font is
              downloaded, so the exact shapes depend on your operating system. The rendered result is
              embedded as an image, so it looks identical everywhere once exported.
            </p>
          </fieldset>
          <Button type="button" size="sm" onClick={() => void useTyped()}>
            Use this {noun}
          </Button>
        </TabsContent>

        <TabsContent value="upload" className="space-y-3 pt-4">
          <FileDropzone
            accept=".png,.jpg,.jpeg,.gif,.webp,image/*"
            onFiles={(files) => setUploadFile(files[0] ?? null)}
            maxSizeMb={40}
            title="Drop a photo or scan of your signature"
            hint="PNG, JPG, WebP or GIF"
          />
          {uploadFile ? (
            <p className="text-sm text-muted-foreground">Selected: {uploadFile.name}</p>
          ) : null}
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
            <Label htmlFor={`${ids}-drop-bg`} className="text-sm font-normal">
              Make the paper transparent
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Fades near-white pixels so the ink sits on the PDF instead of a white card.
              </span>
            </Label>
            <Switch id={`${ids}-drop-bg`} checked={dropBackground} onCheckedChange={setDropBackground} />
          </div>
          <Button type="button" size="sm" onClick={() => void useUploaded()} disabled={!uploadFile}>
            Use this {noun}
          </Button>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center gap-4">
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Ink colour</legend>
          {INK_COLORS.map((ink) => (
            <button
              key={ink.value}
              type="button"
              onClick={() => setColor(ink.value)}
              aria-pressed={color === ink.value}
              aria-label={`${ink.label} ink`}
              className={cn(
                'size-7 rounded-full border-2 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                color === ink.value ? 'border-primary scale-110' : 'border-border',
              )}
              style={{ backgroundColor: ink.value }}
            />
          ))}
          <span className="text-xs text-muted-foreground">
            {INK_COLORS.find((i) => i.value === color)?.label}
          </span>
        </fieldset>
        <div className="min-w-40 flex-1">
          <Label htmlFor={`${ids}-thickness`} className="text-xs">
            Pen thickness · {thickness} px
          </Label>
          <Slider
            id={`${ids}-thickness`}
            className="mt-2"
            min={1}
            max={10}
            step={1}
            value={[thickness]}
            onValueChange={(v) => setThickness(v[0] ?? 3)}
          />
        </div>
      </div>

      {error ? <ErrorNote message={error} /> : null}
    </div>
  )
}

export default PdfEditSignaturePad
