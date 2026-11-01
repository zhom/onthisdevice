import { useCallback, useEffect, useRef, useState } from 'react'
import { Contrast, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileChips } from '@/components/shared/FileChips'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { nextFrame } from '@/lib/utils'
import { CHECKER_STYLE, ResultsGrid } from './ResultsGrid'
import {
  applyAdjustments,
  createCanvas,
  decodeImage,
  encodeCanvas,
  errorMessage,
  formatFromFile,
  get2d,
  IMAGE_ACCEPT,
  isLossy,
  isNeutral,
  NEUTRAL_ADJUSTMENTS,
  nextId,
  outputName,
  revokeAll,
  type Adjustments,
  type OutputFormat,
  type ProcessedItem,
} from './image-utils'

const PRESETS: { id: string; label: string; values: Adjustments }[] = [
  { id: 'original', label: 'Original', values: { ...NEUTRAL_ADJUSTMENTS } },
  { id: 'grayscale', label: 'Grayscale', values: { ...NEUTRAL_ADJUSTMENTS, grayscale: 100 } },
  {
    id: 'noir',
    label: 'High-contrast B&W',
    values: { ...NEUTRAL_ADJUSTMENTS, grayscale: 100, contrast: 145, brightness: 96 },
  },
  { id: 'sepia', label: 'Sepia', values: { ...NEUTRAL_ADJUSTMENTS, sepia: 100 } },
  {
    id: 'vintage',
    label: 'Vintage',
    values: { ...NEUTRAL_ADJUSTMENTS, sepia: 55, saturate: 85, contrast: 110, brightness: 104 },
  },
  {
    id: 'faded',
    label: 'Faded',
    values: { ...NEUTRAL_ADJUSTMENTS, saturate: 62, contrast: 88, brightness: 108 },
  },
  { id: 'invert', label: 'Invert (negative)', values: { ...NEUTRAL_ADJUSTMENTS, invert: 100 } },
  {
    id: 'punch',
    label: 'Punchy colour',
    values: { ...NEUTRAL_ADJUSTMENTS, saturate: 135, contrast: 115 },
  },
]

const SLIDERS: { key: keyof Adjustments; label: string; min: number; max: number; suffix: string }[] = [
  { key: 'grayscale', label: 'Grayscale', min: 0, max: 100, suffix: '%' },
  { key: 'sepia', label: 'Sepia', min: 0, max: 100, suffix: '%' },
  { key: 'invert', label: 'Invert', min: 0, max: 100, suffix: '%' },
  { key: 'brightness', label: 'Brightness', min: 0, max: 200, suffix: '%' },
  { key: 'contrast', label: 'Contrast', min: 0, max: 200, suffix: '%' },
  { key: 'saturate', label: 'Saturation', min: 0, max: 200, suffix: '%' },
]

export default function GrayscaleImage() {
  const [files, setFiles] = useState<File[]>([])
  const [adjust, setAdjust] = useState<Adjustments>({ ...NEUTRAL_ADJUSTMENTS, grayscale: 100 })
  const [format, setFormat] = useState<'auto' | OutputFormat>('auto')
  const [quality, setQuality] = useState(92)

  const [previewData, setPreviewData] = useState<ImageData | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)

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
        const scale = Math.min(640 / bitmap.width, 640 / bitmap.height, 1)
        const canvas = createCanvas(bitmap.width * scale, bitmap.height * scale)
        const ctx = get2d(canvas, { willReadFrequently: true })
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        bitmap.close()
        setPreviewData(ctx.getImageData(0, 0, canvas.width, canvas.height))
      } catch (err) {
        setError(errorMessage(err, 'That image could not be read.'))
      }
    },
    [files, clearResults],
  )

  // Re-render the preview on the next frame whenever a slider moves.
  useEffect(() => {
    const canvas = previewCanvasRef.current
    if (!canvas || !previewData) return
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const copy = new ImageData(
        new Uint8ClampedArray(previewData.data),
        previewData.width,
        previewData.height,
      )
      applyAdjustments(copy, adjust)
      canvas.width = copy.width
      canvas.height = copy.height
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.putImageData(copy, 0, 0)
    })
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [previewData, adjust])

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

  function setValue(key: keyof Adjustments, value: number) {
    clearResults()
    setAdjust((a) => ({ ...a, [key]: value }))
  }

  function applyPreset(id: string) {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    clearResults()
    setAdjust({ ...preset.values })
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
        setStatus(`Applying filters to ${file.name} (${i + 1} of ${files.length})…`)
        setProgress(Math.round((i / files.length) * 100))
        await nextFrame()

        const { bitmap } = await decodeImage(file)
        const canvas = createCanvas(bitmap.width, bitmap.height)
        const ctx = get2d(canvas, { willReadFrequently: true })
        ctx.drawImage(bitmap, 0, 0)
        bitmap.close()

        const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
        await nextFrame()
        applyAdjustments(data, adjust)
        ctx.putImageData(data, 0, 0)

        const outFormat: OutputFormat = format === 'auto' ? formatFromFile(file) : format
        let target = canvas
        if (outFormat === 'jpeg') {
          target = createCanvas(canvas.width, canvas.height)
          const tctx = get2d(target)
          tctx.fillStyle = '#ffffff'
          tctx.fillRect(0, 0, target.width, target.height)
          tctx.drawImage(canvas, 0, 0)
        }

        const blob = await encodeCanvas(target, outFormat, quality / 100)
        out.push({
          id: nextId(),
          name: outputName(file, adjust.grayscale === 100 ? '-grayscale' : '-filtered', outFormat),
          blob,
          url: URL.createObjectURL(blob),
          width: canvas.width,
          height: canvas.height,
          originalSize: file.size,
        })
      }
      setProgress(100)
      setResults(out)
      setStatus(`Processed ${out.length} ${out.length === 1 ? 'image' : 'images'}.`)
    } catch (err) {
      revokeAll(out)
      setError(errorMessage(err, 'The filter could not be applied. Try a different image.'))
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
        title="Drop images here"
        hint="Grayscale, sepia, invert and tone adjustments"
      />

      {files.length > 0 && <FileChips files={files} onRemove={removeFile} onReorder={reorderFiles} />}

      {files.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <ToolPanel title="Preview" description="Live preview of the first image at reduced size.">
            <div
              className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-muted p-3"
              style={CHECKER_STYLE}
            >
              <canvas
                ref={previewCanvasRef}
                className="max-h-[55dvh] max-w-full"
                aria-label="Filtered preview"
              />
            </div>
          </ToolPanel>

          <ToolPanel
            title="Adjustments"
            footer={
              <Button size="lg" onClick={run} disabled={busy} className="w-full">
                <Contrast className="size-4" aria-hidden="true" />
                {busy ? 'Applying…' : `Apply to ${files.length} ${files.length === 1 ? 'image' : 'images'}`}
              </Button>
            }
          >
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="filter-preset">Preset</Label>
                <Select onValueChange={applyPreset}>
                  <SelectTrigger id="filter-preset">
                    <SelectValue placeholder="Choose a preset…" />
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

              <div className="space-y-4">
                {SLIDERS.map((s) => (
                  <div key={s.key} className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <Label id={`filter-${s.key}-label`}>{s.label}</Label>
                      <span className="font-mono text-xs text-muted-foreground">
                        {adjust[s.key]}
                        {s.suffix}
                      </span>
                    </div>
                    <Slider
                      aria-labelledby={`filter-${s.key}-label`}
                      min={s.min}
                      max={s.max}
                      step={1}
                      value={[adjust[s.key]]}
                      onValueChange={(v) => setValue(s.key, v[0] ?? 0)}
                    />
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isNeutral(adjust)}
                onClick={() => {
                  clearResults()
                  setAdjust({ ...NEUTRAL_ADJUSTMENTS })
                }}
              >
                <Undo2 className="size-4" aria-hidden="true" />
                Reset all sliders
              </Button>

              <div className="space-y-2 border-t border-border pt-4">
                <Label htmlFor="filter-format">Output format</Label>
                <Select
                  value={format}
                  onValueChange={(v) => {
                    clearResults()
                    setFormat(v as 'auto' | OutputFormat)
                  }}
                >
                  <SelectTrigger id="filter-format">
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
                  <Label id="filter-quality-label">Quality: {quality}</Label>
                  <Slider
                    aria-labelledby="filter-quality-label"
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

      {busy && <ProgressPanel label={status || 'Applying filters…'} value={progress} />}

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      <ResultsGrid
        items={results}
        zipName="filtered-images"
        transparent={effectiveFormat !== 'jpeg'}
        onReset={() => {
          clearResults()
          setFiles([])
          setPreviewData(null)
          setStatus('')
        }}
      />
    </div>
  )
}
