import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PDFImage } from 'pdf-lib'
import { ChevronLeft, ChevronRight, Droplets, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { clamp, formatBytes, formatNumber, nextFrame } from '@/lib/utils'
import {
  allPages,
  displaySize,
  findUnsupportedCharacter,
  hexToRgb01,
  humanPdfError,
  loadPdfLib,
  mapDisplayToPage,
  outputName,
  parsePageRanges,
  pdfBlob,
  readFileBytes,
} from './pdf-shared'
import { useSinglePagePreview } from './useSinglePagePreview'
import {
  originFromCenter,
  watermarkPlacements,
  type WatermarkPosition,
} from './watermark-layout'

type Mode = 'text' | 'image'
type Layer = 'over' | 'behind'

const POSITIONS: { id: WatermarkPosition; label: string }[] = [
  { id: 'top-left', label: 'Top left' },
  { id: 'top-center', label: 'Top centre' },
  { id: 'top-right', label: 'Top right' },
  { id: 'middle-left', label: 'Middle left' },
  { id: 'middle-center', label: 'Centre' },
  { id: 'middle-right', label: 'Middle right' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'bottom-center', label: 'Bottom centre' },
  { id: 'bottom-right', label: 'Bottom right' },
]

const FONTS = [
  { id: 'Helvetica', label: 'Helvetica', css: 'Helvetica, Arial, sans-serif' },
  { id: 'Times', label: 'Times', css: '"Times New Roman", Times, serif' },
  { id: 'Courier', label: 'Courier', css: '"Courier New", Courier, monospace' },
] as const

type FontId = (typeof FONTS)[number]['id']

interface ImageAsset {
  file: File
  url: string
  width: number
  height: number
  type: 'png' | 'jpg'
}

/** Rough cap-height of a standard PDF font, good enough for centring. */
const CAP_RATIO = 0.72

export default function WatermarkPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState('CONFIDENTIAL')
  const [fontId, setFontId] = useState<FontId>('Helvetica')
  const [bold, setBold] = useState(true)
  const [size, setSize] = useState(56)
  const [color, setColor] = useState('#ef4444')
  const [opacity, setOpacity] = useState(22)
  const [angle, setAngle] = useState(45)
  const [position, setPosition] = useState<WatermarkPosition>('middle-center')
  const [margin, setMargin] = useState(36)
  const [tile, setTile] = useState(false)
  const [gap, setGap] = useState(48)
  const [layer, setLayer] = useState<Layer>('over')
  const [rangeSpec, setRangeSpec] = useState('')
  const [image, setImage] = useState<ImageAsset | null>(null)
  const [imageScale, setImageScale] = useState(40)
  const [previewPage, setPreviewPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; filename: string; pages: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const { preview, pageCount, error: previewError } = useSinglePagePreview(file, previewPage, 340)

  const onFiles = useCallback((files: File[]) => {
    const next = files[0]
    if (!next) return
    setFile(next)
    setResult(null)
    setError(null)
    setPreviewPage(1)
  }, [])

  const onImageFiles = useCallback((files: File[]) => {
    const next = files[0]
    if (!next) return
    const lower = next.name.toLowerCase()
    const isPng = next.type === 'image/png' || lower.endsWith('.png')
    const isJpg =
      next.type === 'image/jpeg' || lower.endsWith('.jpg') || lower.endsWith('.jpeg')
    if (!isPng && !isJpg) {
      setError('The watermark image has to be a PNG or a JPEG. PDF can embed these formats directly.')
      return
    }
    const url = URL.createObjectURL(next)
    const img = new Image()
    img.onload = () => {
      setImage({
        file: next,
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
        type: isPng ? 'png' : 'jpg',
      })
      setError(null)
      setResult(null)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setError('That image could not be read. Try re-saving it as a PNG or JPEG.')
    }
    img.src = url
  }, [])

  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.url)
    }
    // Only revoke when the asset itself is replaced.
  }, [image])

  const targetPages = useMemo(() => {
    if (!pageCount) return { pages: [] as number[], error: null as string | null }
    if (!rangeSpec.trim()) return { pages: allPages(pageCount), error: null }
    try {
      return { pages: parsePageRanges(rangeSpec, pageCount).sort((a, b) => a - b), error: null }
    } catch (err) {
      return { pages: [] as number[], error: err instanceof Error ? err.message : String(err) }
    }
  }, [rangeSpec, pageCount])

  /** Watermark box size in PDF points for the current settings. */
  const itemSize = useMemo(() => {
    if (mode === 'image') {
      if (!image) return { w: 0, h: 0 }
      const basePt = image.width * 0.75
      const w = (basePt * imageScale) / 100
      return { w, h: (w * image.height) / image.width }
    }
    // Rough width estimate for the preview; the export uses real font metrics.
    const perChar = fontId === 'Courier' ? 0.6 : bold ? 0.58 : 0.52
    return { w: Math.max(1, text.length * size * perChar), h: size * CAP_RATIO }
  }, [mode, image, imageScale, text, size, fontId, bold])

  // ---- live preview ------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !preview) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false
    const pageImg = new Image()
    pageImg.onload = () => {
      if (cancelled) return
      canvas.width = preview.w
      canvas.height = preview.h
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(pageImg, 0, 0, canvas.width, canvas.height)

      const inRange = targetPages.pages.includes(preview.page)
      if (!inRange) return

      const scale = preview.w / preview.widthPt
      const placements = watermarkPlacements({
        pageW: preview.widthPt,
        pageH: preview.heightPt,
        itemW: itemSize.w,
        itemH: itemSize.h,
        angleDeg: angle,
        position,
        margin,
        tile,
        gap,
      })

      const drawOne = (cx: number, cy: number, drawer: () => void) => {
        ctx.save()
        ctx.globalAlpha = clamp(opacity / 100, 0, 1)
        ctx.translate(cx * scale, canvas.height - cy * scale)
        ctx.rotate((-angle * Math.PI) / 180)
        drawer()
        ctx.restore()
      }

      if (layer === 'behind') ctx.globalCompositeOperation = 'destination-over'

      if (mode === 'text' && text) {
        const css = FONTS.find((f) => f.id === fontId)?.css ?? FONTS[0].css
        ctx.fillStyle = color
        ctx.font = `${bold ? 'bold ' : ''}${size * scale}px ${css}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        for (const p of placements) drawOne(p.cx, p.cy, () => ctx.fillText(text, 0, 0))
      } else if (mode === 'image' && image) {
        const wm = new Image()
        wm.onload = () => {
          if (cancelled) return
          for (const p of placements) {
            drawOne(p.cx, p.cy, () =>
              ctx.drawImage(
                wm,
                (-itemSize.w * scale) / 2,
                (-itemSize.h * scale) / 2,
                itemSize.w * scale,
                itemSize.h * scale,
              ),
            )
          }
          ctx.globalCompositeOperation = 'source-over'
        }
        wm.src = image.url
        return
      }

      ctx.globalCompositeOperation = 'source-over'
    }
    pageImg.src = preview.url

    return () => {
      cancelled = true
    }
  }, [
    preview,
    targetPages,
    mode,
    text,
    fontId,
    bold,
    size,
    color,
    opacity,
    angle,
    position,
    margin,
    tile,
    gap,
    layer,
    image,
    itemSize,
  ])

  // ---- export ------------------------------------------------------------
  const apply = async () => {
    if (!file || targetPages.pages.length === 0) return
    if (mode === 'text') {
      if (!text.trim()) {
        setError('Type the watermark text first.')
        return
      }
      const bad = findUnsupportedCharacter(text)
      if (bad) {
        setError(
          `The character “${bad}” is outside the WinAnsi range the built-in PDF fonts support. Remove it or use an image watermark instead.`,
        )
        return
      }
    }
    if (mode === 'image' && !image) {
      setError('Choose a PNG or JPEG to use as the watermark.')
      return
    }

    setBusy(true)
    setError(null)
    setResult(null)
    setProgress(0)

    try {
      const bytes = await readFileBytes(file)
      const { PDFDocument, StandardFonts, degrees, rgb } = await loadPdfLib()
      const src = await PDFDocument.load(bytes, { updateMetadata: false })
      const srcPages = src.getPages()
      const behind = layer === 'behind'
      const target = behind ? await PDFDocument.create() : src

      const fontName =
        fontId === 'Times'
          ? bold
            ? StandardFonts.TimesRomanBold
            : StandardFonts.TimesRoman
          : fontId === 'Courier'
            ? bold
              ? StandardFonts.CourierBold
              : StandardFonts.Courier
            : bold
              ? StandardFonts.HelveticaBold
              : StandardFonts.Helvetica

      const font = mode === 'text' ? await target.embedFont(fontName) : null
      let embeddedImage: PDFImage | null = null
      if (mode === 'image' && image) {
        const imgBytes = await readFileBytes(image.file)
        embeddedImage =
          image.type === 'png' ? await target.embedPng(imgBytes) : await target.embedJpg(imgBytes)
      }

      const embeddedPages = behind ? await target.embedPages(srcPages) : []
      const { r, g, b } = hexToRgb01(color)
      const wanted = new Set(targetPages.pages)

      for (let i = 0; i < srcPages.length; i++) {
        const sourcePage = srcPages[i]
        const { width: W, height: H } = sourcePage.getSize()
        const rotation = sourcePage.getRotation().angle
        const page = behind ? target.addPage([W, H]) : sourcePage
        if (behind) page.setRotation(sourcePage.getRotation())

        if (wanted.has(i + 1)) {
          const disp = displaySize(W, H, rotation)
          const itemW =
            mode === 'text' && font ? font.widthOfTextAtSize(text, size) : itemSize.w
          const itemH = mode === 'text' ? size * CAP_RATIO : itemSize.h

          const placements = watermarkPlacements({
            pageW: disp.w,
            pageH: disp.h,
            itemW,
            itemH,
            angleDeg: angle,
            position,
            margin,
            tile,
            gap,
          })

          for (const placement of placements) {
            const origin = originFromCenter(placement.cx, placement.cy, itemW, itemH, angle)
            const { x, y } = mapDisplayToPage(origin.x, origin.y, W, H, rotation)
            const rotate = degrees(rotation + angle)
            if (mode === 'text' && font) {
              page.drawText(text, {
                x,
                y,
                size,
                font,
                color: rgb(r, g, b),
                opacity: clamp(opacity / 100, 0, 1),
                rotate,
              })
            } else if (embeddedImage) {
              page.drawImage(embeddedImage, {
                x,
                y,
                width: itemW,
                height: itemH,
                opacity: clamp(opacity / 100, 0, 1),
                rotate,
              })
            }
          }
        }

        if (behind) {
          const embedded = embeddedPages[i]
          if (embedded) page.drawPage(embedded, { x: 0, y: 0, width: W, height: H })
        }

        if (i % 10 === 0) {
          setProgress(Math.round((i / srcPages.length) * 90))
          await nextFrame()
        }
      }

      target.setProducer('onthisdevice.com')
      const saved = await target.save({ useObjectStreams: true })
      setResult({
        blob: pdfBlob(saved),
        filename: outputName(file.name, '-watermarked'),
        pages: targetPages.pages.length,
      })
      setProgress(100)
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept=".pdf,application/pdf"
        maxSizeMb={300}
        onFiles={onFiles}
        title={file ? 'Choose a different PDF' : 'Drop a PDF here'}
        hint="or click to browse"
      />

      {error && <ErrorNote message={error} />}
      {previewError && <ErrorNote message={previewError} />}

      {file && pageCount > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <ToolPanel
            title="Watermark"
            description={`${file.name} · ${formatNumber(pageCount, 0)} pages`}
            footer={
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void apply()} disabled={busy || targetPages.pages.length === 0}>
                  <Droplets className="mr-2 size-4" aria-hidden="true" />
                  Apply to {targetPages.pages.length} page
                  {targetPages.pages.length === 1 ? '' : 's'}
                </Button>
                {targetPages.error && (
                  <span className="text-sm text-destructive" role="alert">
                    {targetPages.error}
                  </span>
                )}
              </div>
            }
          >
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="mb-4">
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="image">Image</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wm-text">Watermark text</Label>
                  <Input
                    id="wm-text"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value)
                      setResult(null)
                    }}
                    placeholder="CONFIDENTIAL"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wm-font">Font</Label>
                    <Select value={fontId} onValueChange={(v) => setFontId(v as FontId)}>
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
                    <Label htmlFor="wm-color">Colour</Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="wm-color"
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                      />
                      <Input
                        aria-label="Watermark colour hex value"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-28 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wm-size">Font size: {size} pt</Label>
                    <Slider
                      id="wm-size"
                      min={8}
                      max={200}
                      step={1}
                      value={[size]}
                      onValueChange={([v]) => setSize(v)}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-6">
                    <Switch id="wm-bold" checked={bold} onCheckedChange={setBold} />
                    <Label htmlFor="wm-bold">Bold</Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="image" className="space-y-4">
                {image ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3">
                    <img
                      src={image.url}
                      alt="Watermark preview"
                      className="h-14 w-14 rounded border border-border object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{image.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {image.width} × {image.height} px · {image.type.toUpperCase()} ·{' '}
                        {formatBytes(image.file.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove watermark image"
                      onClick={() => setImage(null)}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <FileDropzone
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    maxSizeMb={20}
                    onFiles={onImageFiles}
                    title="Drop a PNG or JPEG logo"
                    hint="transparency in a PNG is preserved"
                  />
                )}

                <div className="space-y-2">
                  <Label htmlFor="wm-scale">Image size: {imageScale}% of natural width</Label>
                  <Slider
                    id="wm-scale"
                    min={5}
                    max={200}
                    step={1}
                    value={[imageScale]}
                    onValueChange={([v]) => setImageScale(v)}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-6 space-y-5 border-t border-border pt-5">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Position</legend>
                <div className="grid max-w-sm grid-cols-3 gap-2">
                  {POSITIONS.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant={position === p.id ? 'default' : 'outline'}
                      size="sm"
                      aria-pressed={position === p.id}
                      disabled={tile}
                      onClick={() => setPosition(p.id)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                {tile && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Position is ignored while tiling covers the whole page.
                  </p>
                )}
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wm-opacity">Opacity: {opacity}%</Label>
                  <Slider
                    id="wm-opacity"
                    min={2}
                    max={100}
                    step={1}
                    value={[opacity]}
                    onValueChange={([v]) => setOpacity(v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wm-angle">Rotation: {angle}°</Label>
                  <Slider
                    id="wm-angle"
                    min={-90}
                    max={90}
                    step={1}
                    value={[angle]}
                    onValueChange={([v]) => setAngle(v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wm-margin">Margin: {margin} pt</Label>
                  <Slider
                    id="wm-margin"
                    min={0}
                    max={120}
                    step={2}
                    value={[margin]}
                    onValueChange={([v]) => setMargin(v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wm-range">Pages</Label>
                  <Input
                    id="wm-range"
                    value={rangeSpec}
                    placeholder={`all (1-${pageCount})`}
                    onChange={(e) => setRangeSpec(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <Switch id="wm-tile" checked={tile} onCheckedChange={setTile} />
                  <Label htmlFor="wm-tile">Tile across the page</Label>
                </div>
                {tile && (
                  <div className="w-48 space-y-2">
                    <Label htmlFor="wm-gap">Tile spacing: {gap} pt</Label>
                    <Slider
                      id="wm-gap"
                      min={0}
                      max={200}
                      step={2}
                      value={[gap]}
                      onValueChange={([v]) => setGap(v)}
                    />
                  </div>
                )}
              </div>

              <RadioGroup
                value={layer}
                onValueChange={(v) => setLayer(v as Layer)}
                className="gap-2 rounded-lg bg-muted p-3"
              >
                <p className="text-sm font-medium">Layer</p>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="over" id="layer-over" />
                  <Label htmlFor="layer-over" className="font-normal">
                    Over the content (always visible)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="behind" id="layer-behind" />
                  <Label htmlFor="layer-behind" className="font-normal">
                    Behind the content (keeps text crisp; rebuilds the file, so links and form
                    fields are flattened)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </ToolPanel>

          <ToolPanel title="Live preview" description="Page rendered with the watermark exactly as it will be written.">
            <div className="flex flex-col items-center gap-3">
              <canvas
                ref={canvasRef}
                width={preview?.w ?? 340}
                height={preview?.h ?? 440}
                className="max-w-full rounded-md border border-border"
                role="img"
                aria-label={`Watermark preview of page ${preview?.page ?? previewPage}`}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Preview previous page"
                  disabled={previewPage <= 1}
                  onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <span className="text-sm tabular-nums text-muted-foreground">
                  Page {preview?.page ?? previewPage} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Preview next page"
                  disabled={previewPage >= pageCount}
                  onClick={() => setPreviewPage((p) => Math.min(pageCount, p + 1))}
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Text width in the preview uses a system font, so the export can be a few points
                wider or narrower.
              </p>
            </div>
          </ToolPanel>
        </div>
      )}

      {busy && <ProgressPanel label="Stamping the watermark…" value={progress} />}

      {result && !busy && (
        <ToolPanel title="Watermarked PDF ready" description="The watermark is part of the page content now.">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Pages watermarked" value={formatNumber(result.pages, 0)} emphasis />
            <ResultStat
              label="Mode"
              value={mode === 'text' ? 'Text' : 'Image'}
              hint={`${layer === 'over' ? 'over' : 'behind'} the content${tile ? ', tiled' : ''}`}
            />
            <ResultStat label="File size" value={formatBytes(result.blob.size)} />
          </div>
          <div className="mt-4">
            <DownloadButton blob={result.blob} filename={result.filename} label="Download watermarked PDF" />
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
