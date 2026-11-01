import { useCallback, useEffect, useRef, useState } from 'react'
import { Link2, Link2Off, Scaling } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileChips } from '@/components/shared/FileChips'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { clamp, nextFrame } from '@/lib/utils'
import { ResultsGrid } from './ResultsGrid'
import {
  createCanvas,
  decodeImage,
  encodeCanvas,
  errorMessage,
  fallsBackToPng,
  formatFromFile,
  get2d,
  IMAGE_ACCEPT,
  isLossy,
  nextId,
  outputName,
  resizeImageData,
  revokeAll,
  type OutputFormat,
  type ProcessedItem,
} from './image-utils'

type Mode = 'pixels' | 'percent' | 'preset'

interface Preset {
  id: string
  label: string
  w: number
  h: number
}

const PRESETS: Preset[] = [
  { id: 'hd720', label: 'HD 720p (1280 × 720)', w: 1280, h: 720 },
  { id: 'fhd1080', label: 'Full HD 1080p (1920 × 1080)', w: 1920, h: 1080 },
  { id: 'qhd1440', label: 'QHD 1440p (2560 × 1440)', w: 2560, h: 1440 },
  { id: 'uhd4k', label: '4K UHD (3840 × 2160)', w: 3840, h: 2160 },
  { id: 'ig-square', label: 'Instagram square (1080 × 1080)', w: 1080, h: 1080 },
  { id: 'ig-portrait', label: 'Instagram portrait (1080 × 1350)', w: 1080, h: 1350 },
  { id: 'ig-story', label: 'Instagram story / Reel (1080 × 1920)', w: 1080, h: 1920 },
  { id: 'fb-cover', label: 'Facebook cover (820 × 312)', w: 820, h: 312 },
  { id: 'x-header', label: 'X (Twitter) header: 1500 × 500', w: 1500, h: 500 },
  { id: 'yt-thumb', label: 'YouTube thumbnail (1280 × 720)', w: 1280, h: 720 },
  { id: 'li-banner', label: 'LinkedIn banner (1584 × 396)', w: 1584, h: 396 },
  { id: 'pin', label: 'Pinterest pin (1000 × 1500)', w: 1000, h: 1500 },
  { id: 'avatar512', label: 'Avatar (512 × 512)', w: 512, h: 512 },
  { id: 'avatar256', label: 'Avatar small (256 × 256)', w: 256, h: 256 },
  { id: 'email-hero', label: 'Email hero (600 × 300)', w: 600, h: 300 },
]

const PERCENT_STEPS = [10, 25, 50, 75, 150, 200]

export default function ResizeImage() {
  const [files, setFiles] = useState<File[]>([])
  const [source, setSource] = useState<{ w: number; h: number } | null>(null)
  const [mode, setMode] = useState<Mode>('pixels')

  const [width, setWidth] = useState('1920')
  const [height, setHeight] = useState('1080')
  const [lockAspect, setLockAspect] = useState(true)
  const [driver, setDriver] = useState<'w' | 'h'>('w')

  const [percent, setPercent] = useState(50)
  const [presetId, setPresetId] = useState('fhd1080')
  const [presetFit, setPresetFit] = useState<'contain' | 'exact'>('contain')
  const [noEnlarge, setNoEnlarge] = useState(true)

  const [format, setFormat] = useState<'auto' | OutputFormat>('auto')
  const [quality, setQuality] = useState(90)

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
        setSource({ w: bitmap.width, h: bitmap.height })
        setWidth(String(bitmap.width))
        setHeight(String(bitmap.height))
        bitmap.close()
      } catch (err) {
        setError(errorMessage(err, 'That image could not be read.'))
      }
    },
    [files, clearResults],
  )

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

  const aspect = source ? source.w / source.h : 1

  function onWidthChange(value: string) {
    setWidth(value)
    setDriver('w')
    const n = Number(value)
    if (lockAspect && source && Number.isFinite(n) && n > 0) {
      setHeight(String(Math.max(1, Math.round(n / aspect))))
    }
  }

  function onHeightChange(value: string) {
    setHeight(value)
    setDriver('h')
    const n = Number(value)
    if (lockAspect && source && Number.isFinite(n) && n > 0) {
      setWidth(String(Math.max(1, Math.round(n * aspect))))
    }
  }

  /** Target dimensions for one source image under the current settings. */
  function targetFor(sw: number, sh: number): { w: number; h: number } {
    let tw = sw
    let th = sh
    if (mode === 'percent') {
      const p = clamp(percent, 1, 1000) / 100
      tw = sw * p
      th = sh * p
    } else if (mode === 'pixels') {
      const w = Number(width)
      const h = Number(height)
      const validW = Number.isFinite(w) && w > 0
      const validH = Number.isFinite(h) && h > 0
      if (lockAspect) {
        if (driver === 'w' && validW) {
          tw = w
          th = (w * sh) / sw
        } else if (validH) {
          th = h
          tw = (h * sw) / sh
        } else if (validW) {
          tw = w
          th = (w * sh) / sw
        }
      } else if (validW && validH) {
        tw = w
        th = h
      } else if (validW) {
        tw = w
        th = (w * sh) / sw
      } else if (validH) {
        th = h
        tw = (h * sw) / sh
      }
    } else {
      const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[1]!
      if (presetFit === 'exact') {
        tw = preset.w
        th = preset.h
      } else {
        const scale = Math.min(preset.w / sw, preset.h / sh)
        tw = sw * scale
        th = sh * scale
      }
    }
    if (noEnlarge && (tw > sw || th > sh)) {
      const scale = Math.min(sw / tw, sh / th)
      tw *= scale
      th *= scale
    }
    return { w: Math.max(1, Math.round(tw)), h: Math.max(1, Math.round(th)) }
  }

  const previewTarget = source ? targetFor(source.w, source.h) : null

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
        setStatus(`Resizing ${file.name} (${i + 1} of ${files.length})…`)
        setProgress(Math.round((i / files.length) * 100))
        await nextFrame()

        const { bitmap } = await decodeImage(file)
        const target = targetFor(bitmap.width, bitmap.height)

        const srcCanvas = createCanvas(bitmap.width, bitmap.height)
        get2d(srcCanvas).drawImage(bitmap, 0, 0)
        bitmap.close()

        const srcData = get2d(srcCanvas, { willReadFrequently: true }).getImageData(
          0,
          0,
          srcCanvas.width,
          srcCanvas.height,
        )
        await nextFrame()
        const resized = await resizeImageData(srcData, target.w, target.h)

        const outFormat: OutputFormat = format === 'auto' ? formatFromFile(file) : format
        const outCanvas = createCanvas(resized.width, resized.height)
        const octx = get2d(outCanvas)
        if (outFormat === 'jpeg') {
          // JPEG has no alpha: flatten onto white before drawing.
          const tmp = createCanvas(resized.width, resized.height)
          get2d(tmp).putImageData(resized, 0, 0)
          octx.fillStyle = '#ffffff'
          octx.fillRect(0, 0, outCanvas.width, outCanvas.height)
          octx.drawImage(tmp, 0, 0)
        } else {
          octx.putImageData(resized, 0, 0)
        }

        const blob = await encodeCanvas(outCanvas, outFormat, quality / 100)
        out.push({
          id: nextId(),
          name: outputName(file, `-${resized.width}x${resized.height}`, outFormat),
          blob,
          url: URL.createObjectURL(blob),
          width: resized.width,
          height: resized.height,
          originalSize: file.size,
        })
      }
      setProgress(100)
      setResults(out)
      setStatus(`Resized ${out.length} ${out.length === 1 ? 'image' : 'images'}.`)
    } catch (err) {
      revokeAll(out)
      setError(errorMessage(err, 'Something went wrong while resizing. Try a different file.'))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const effectiveFormat: OutputFormat =
    format === 'auto' ? (files[0] ? formatFromFile(files[0]) : 'png') : format
  const pngFallbackNote =
    format === 'auto' && files.some((f) => fallsBackToPng(f))
      ? 'AVIF, GIF, BMP and SVG inputs are saved as PNG, because the browser cannot re-encode them to their original format.'
      : null

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={IMAGE_ACCEPT}
        multiple
        onFiles={onFiles}
        maxSizeMb={200}
        title="Drop images here to resize"
        hint="JPG, PNG, WebP, AVIF, GIF or BMP"
      />

      {files.length > 0 && (
        <FileChips files={files} onRemove={removeFile} onReorder={reorderFiles} />
      )}

      {files.length > 0 && (
        <ToolPanel
          title="Resize settings"
          description={
            source
              ? `First image is ${source.w} × ${source.h} px.`
              : 'Choose how the new dimensions are calculated.'
          }
          footer={
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={run} disabled={busy} size="lg">
                <Scaling className="size-4" aria-hidden="true" />
                {busy ? 'Resizing…' : `Resize ${files.length} ${files.length === 1 ? 'image' : 'images'}`}
              </Button>
              {previewTarget && (
                <p className="text-sm text-muted-foreground">
                  First image becomes{' '}
                  <strong className="text-foreground">
                    {previewTarget.w} × {previewTarget.h} px
                  </strong>
                </p>
              )}
            </div>
          }
        >
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pixels">By pixels</TabsTrigger>
              <TabsTrigger value="percent">By percentage</TabsTrigger>
              <TabsTrigger value="preset">Presets</TabsTrigger>
            </TabsList>

            <TabsContent value="pixels" className="pt-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="resize-width">Width (px)</Label>
                  <Input
                    id="resize-width"
                    type="number"
                    min={1}
                    max={20000}
                    inputMode="numeric"
                    value={width}
                    onChange={(e) => onWidthChange(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant={lockAspect ? 'default' : 'outline'}
                  size="icon"
                  aria-pressed={lockAspect}
                  aria-label={lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                  onClick={() => setLockAspect((v) => !v)}
                  className="self-center sm:mb-1 sm:self-auto"
                >
                  {lockAspect ? (
                    <Link2 className="size-4" aria-hidden="true" />
                  ) : (
                    <Link2Off className="size-4" aria-hidden="true" />
                  )}
                </Button>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="resize-height">Height (px)</Label>
                  <Input
                    id="resize-height"
                    type="number"
                    min={1}
                    max={20000}
                    inputMode="numeric"
                    value={height}
                    onChange={(e) => onHeightChange(e.target.value)}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {lockAspect
                  ? 'Aspect ratio locked. Each image keeps its own proportions and is scaled to match the side you edited.'
                  : 'Aspect ratio unlocked. Images are stretched to exactly these dimensions.'}
              </p>
            </TabsContent>

            <TabsContent value="percent" className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label id="resize-percent-label">Scale: {percent}%</Label>
                <Slider
                  aria-labelledby="resize-percent-label"
                  min={1}
                  max={400}
                  step={1}
                  value={[percent]}
                  onValueChange={(v) => setPercent(v[0] ?? 100)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {PERCENT_STEPS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={percent === p ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPercent(p)}
                  >
                    {p}%
                  </Button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="preset" className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resize-preset">Preset size</Label>
                <Select value={presetId} onValueChange={setPresetId}>
                  <SelectTrigger id="resize-preset">
                    <SelectValue placeholder="Choose a preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resize-preset-fit">How to fit the preset</Label>
                <Select
                  value={presetFit}
                  onValueChange={(v) => setPresetFit(v as 'contain' | 'exact')}
                >
                  <SelectTrigger id="resize-preset-fit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contain">Fit inside (keep proportions)</SelectItem>
                    <SelectItem value="exact">Exact size (stretch to fit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 space-y-4 border-t border-border pt-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="resize-no-enlarge"
                checked={noEnlarge}
                onCheckedChange={(v) => setNoEnlarge(v === true)}
              />
              <Label htmlFor="resize-no-enlarge" className="font-normal leading-snug">
                Don’t enlarge images that are already smaller than the target
              </Label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="resize-format">Output format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as 'auto' | OutputFormat)}>
                  <SelectTrigger id="resize-format">
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
                  <Label id="resize-quality-label">Quality: {quality}</Label>
                  <Slider
                    aria-labelledby="resize-quality-label"
                    min={30}
                    max={100}
                    step={1}
                    value={[quality]}
                    onValueChange={(v) => setQuality(v[0] ?? 90)}
                  />
                </div>
              )}
            </div>

            {pngFallbackNote && (
              <p className="text-xs text-muted-foreground">{pngFallbackNote}</p>
            )}
          </div>
        </ToolPanel>
      )}

      {busy && <ProgressPanel label={status || 'Resizing…'} value={progress} />}

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      <ResultsGrid
        items={results}
        zipName="resized-images"
        showSavings
        transparent={effectiveFormat === 'png' || effectiveFormat === 'webp'}
        onReset={() => {
          clearResults()
          setFiles([])
          setSource(null)
          setStatus('')
        }}
      />
    </div>
  )
}
