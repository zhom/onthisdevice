/**
 * The shared working surface behind every page in the Image Converters
 * category. Each tool page renders a thin wrapper that fixes the source and
 * target formats; everything below is common behaviour: batch input, per-file
 * before/after sizes, quality controls, ZIP download and error reporting.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  Download,
  FileDown,
  ImageOff,
  Package,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileChips } from '@/components/shared/FileChips'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'

import { cn, downloadBlob, formatBytes, formatNumber, nextFrame, stripExtension } from '@/lib/utils'
import { ALL_TARGETS, FORMATS, describeError, sniffBytes } from './_engine'
import type { EncodeSettings, JobSource, RasterFormat } from './_engine'
import { createJobRunner } from './_runner'
import { DEFAULT_SVG_SIZING, rasteriseSvg } from './_svg'
import type { SvgSizeMode, SvgSizing } from './_svg'

export interface ImageConverterProps {
  /** `accept` string handed to the dropzone, e.g. `.png,image/png`. */
  accept: string
  /** Fixed output format for a single-purpose page. Omit for the universal tool. */
  fixedTarget?: RasterFormat
  /** Output formats offered in the select when `fixedTarget` is omitted. */
  targetChoices?: RasterFormat[]
  dropTitle: string
  dropHint?: string
  /** Starting quality for lossy targets. */
  defaultQuality?: number
  /** Show the AVIF effort control even before AVIF is selected. */
  avifControls?: boolean
  /** Always show the SVG raster-size panel (the SVG → PNG page). */
  svgControls?: boolean
  /** Default filename stem for the ZIP of all outputs. */
  zipName?: string
  maxSizeMb?: number
}

interface ResultItem {
  id: string
  inputName: string
  inputSize: number
  outputName: string
  outputSize: number
  width: number
  height: number
  format: RasterFormat
  blob: Blob
  url: string
}

interface FailedItem {
  id: string
  inputName: string
  error: string
}

const QUALITY_DEFAULTS: Record<RasterFormat, number> = {
  jpeg: 82,
  png: 100,
  webp: 80,
  avif: 55,
}

const TARGET_BLURB: Record<RasterFormat, string> = {
  jpeg: 'smallest for photos, no transparency',
  png: 'lossless, keeps transparency',
  webp: 'smaller than JPG, keeps transparency',
  avif: 'smallest of all, slowest to encode',
}

const QUALITY_HINT: Record<RasterFormat, string> = {
  jpeg: '75–85 is the usual sweet spot for photos',
  png: 'PNG ignores quality: it is always lossless',
  webp: '75–85 matches JPEG quality at roughly 30% fewer bytes',
  avif: '50–65 already looks like a high-quality JPEG',
}

function uniqueName(base: string, ext: string, used: Set<string>): string {
  const stem = base.trim() === '' ? 'image' : base
  let candidate = `${stem}.${ext}`
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${stem}-${n}.${ext}`
    n += 1
  }
  used.add(candidate.toLowerCase())
  return candidate
}

function deltaLabel(before: number, after: number): { text: string; tone: 'good' | 'bad' | 'flat' } {
  if (before <= 0) return { text: '–', tone: 'flat' }
  const pct = ((after - before) / before) * 100
  if (Math.abs(pct) < 0.5) return { text: 'same size', tone: 'flat' }
  if (pct < 0) return { text: `${formatNumber(Math.abs(pct), 0)}% smaller`, tone: 'good' }
  return { text: `${formatNumber(pct, 0)}% larger`, tone: 'bad' }
}

export default function ImageConverter({
  accept,
  fixedTarget,
  targetChoices = ALL_TARGETS,
  dropTitle,
  dropHint = 'or click to browse',
  defaultQuality,
  avifControls = false,
  svgControls = false,
  zipName = 'converted-images',
  maxSizeMb = 250,
}: ImageConverterProps) {
  const [files, setFiles] = useState<File[]>([])
  const [selectedTarget, setSelectedTarget] = useState<RasterFormat>(
    fixedTarget ?? targetChoices[0] ?? 'webp',
  )
  const target = fixedTarget ?? selectedTarget
  const targetMeta = FORMATS[target]

  const [quality, setQuality] = useState(defaultQuality ?? QUALITY_DEFAULTS[fixedTarget ?? 'webp'])
  const [lossless, setLossless] = useState(false)
  const [effort, setEffort] = useState(6)
  const [flatten, setFlatten] = useState(false)
  const [background, setBackground] = useState('#ffffff')
  const [sizing, setSizing] = useState<SvgSizing>(DEFAULT_SVG_SIZING)

  const [results, setResults] = useState<ResultItem[]>([])
  const [failures, setFailures] = useState<FailedItem[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [currentName, setCurrentName] = useState('')
  const [fatal, setFatal] = useState<string | null>(null)
  const [zipping, setZipping] = useState(false)
  const [brokenThumbs, setBrokenThumbs] = useState<string[]>([])
  const [lastSignature, setLastSignature] = useState<string | null>(null)

  const runnerRef = useRef<ReturnType<typeof createJobRunner> | null>(null)
  const urlsRef = useRef<string[]>([])
  const runTokenRef = useRef(0)

  const hasSvg = useMemo(
    () => files.some((f) => f.type === 'image/svg+xml' || f.name.toLowerCase().endsWith('.svg')),
    [files],
  )
  const showSizing = svgControls || hasSvg
  const backgroundActive = targetMeta.alpha ? flatten : true
  const effectiveBackground = backgroundActive ? background : null

  const settings: EncodeSettings = useMemo(
    () => ({
      format: target,
      quality,
      lossless: targetMeta.lossy ? lossless : false,
      speed: 10 - effort,
      background: effectiveBackground,
    }),
    [target, quality, lossless, effort, effectiveBackground, targetMeta.lossy],
  )

  const signatureFor = useCallback(
    (list: File[]) =>
      JSON.stringify({
        settings,
        sizing,
        names: list.map((f) => `${f.name}:${f.size}:${f.lastModified}`),
      }),
    [settings, sizing],
  )

  const signature = useMemo(() => signatureFor(files), [signatureFor, files])

  const stale = results.length + failures.length > 0 && lastSignature !== null && lastSignature !== signature

  const releaseUrls = useCallback(() => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url)
    urlsRef.current = []
  }, [])

  useEffect(
    () => () => {
      releaseUrls()
      runnerRef.current?.dispose()
      runnerRef.current = null
    },
    [releaseUrls],
  )

  const buildSource = useCallback(
    async (file: File): Promise<JobSource> => {
      const bytes = await file.arrayBuffer()
      if (sniffBytes(bytes) === 'svg') {
        const text = new TextDecoder().decode(bytes)
        const raster = await rasteriseSvg(text, sizing)
        return {
          kind: 'pixels',
          data: raster.pixels.data,
          width: raster.pixels.width,
          height: raster.pixels.height,
        }
      }
      return { kind: 'bytes', bytes, mime: file.type }
    },
    [sizing],
  )

  const convert = useCallback(
    async (list: File[]) => {
      if (list.length === 0) return
      const token = ++runTokenRef.current

      releaseUrls()
      setResults([])
      setFailures([])
      setBrokenThumbs([])
      setFatal(null)
      setDone(0)
      setBusy(true)

      if (!runnerRef.current) runnerRef.current = createJobRunner()
      const runner = runnerRef.current

      const used = new Set<string>()
      const ok: ResultItem[] = []
      const bad: FailedItem[] = []

      for (let i = 0; i < list.length; i++) {
        if (runTokenRef.current !== token) return
        const file = list[i]
        setCurrentName(file.name)
        const id = `${file.name}-${file.size}-${i}`

        try {
          const source = await buildSource(file)
          const output = await runner.run(source, settings)
          if (runTokenRef.current !== token) return

          const blob = new Blob([output.bytes], { type: output.mime })
          const url = URL.createObjectURL(blob)
          urlsRef.current.push(url)
          ok.push({
            id,
            inputName: file.name,
            inputSize: file.size,
            outputName: uniqueName(stripExtension(file.name), FORMATS[settings.format].ext, used),
            outputSize: blob.size,
            width: output.width,
            height: output.height,
            format: settings.format,
            blob,
            url,
          })
        } catch (err) {
          if (runTokenRef.current !== token) return
          bad.push({ id, inputName: file.name, error: describeError(err) })
        }

        setDone(i + 1)
        setResults([...ok])
        setFailures([...bad])
        await nextFrame()
      }

      if (runTokenRef.current !== token) return
      setCurrentName('')
      setBusy(false)
      setLastSignature(signatureFor(list))
    },
    [buildSource, releaseUrls, settings, signatureFor],
  )

  const handleFiles = useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return
      const merged = [...files, ...incoming]
      setFiles(merged)
      void convert(merged)
    },
    [convert, files],
  )

  const handleRemove = useCallback(
    (index: number) => {
      const next = files.filter((_, i) => i !== index)
      setFiles(next)
      runTokenRef.current += 1
      setBusy(false)
      if (next.length === 0) {
        releaseUrls()
        setResults([])
        setFailures([])
        setLastSignature(null)
      } else {
        void convert(next)
      }
    },
    [convert, files, releaseUrls],
  )

  const reset = useCallback(() => {
    runTokenRef.current += 1
    releaseUrls()
    setFiles([])
    setResults([])
    setFailures([])
    setBrokenThumbs([])
    setFatal(null)
    setBusy(false)
    setDone(0)
    setLastSignature(null)
  }, [releaseUrls])

  const downloadZip = useCallback(async () => {
    if (results.length === 0) return
    setZipping(true)
    setFatal(null)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      for (const item of results) zip.file(item.outputName, item.blob)
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
      downloadBlob(blob, `${zipName}.zip`)
    } catch (err) {
      setFatal(describeError(err))
    } finally {
      setZipping(false)
    }
  }, [results, zipName])

  const totals = useMemo(() => {
    const before = results.reduce((sum, r) => sum + r.inputSize, 0)
    const after = results.reduce((sum, r) => sum + r.outputSize, 0)
    return { before, after, ...deltaLabel(before, after) }
  }, [results])

  const progress = files.length > 0 ? Math.round((done / files.length) * 100) : 0
  const showQuality = targetMeta.lossy && !lossless
  const showLossless = target === 'webp' || target === 'avif'
  const showEffort = target === 'avif' || avifControls

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept={accept}
        multiple
        maxSizeMb={maxSizeMb}
        onFiles={handleFiles}
        title={dropTitle}
        hint={dropHint}
      />

      {files.length > 0 && (
        <div className="flex flex-col gap-3">
          <FileChips files={files} onRemove={handleRemove} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw aria-hidden="true" />
              Clear all
            </Button>
            <span className="text-xs text-muted-foreground">
              {files.length} file{files.length === 1 ? '' : 's'} selected ·{' '}
              {formatBytes(files.reduce((sum, f) => sum + f.size, 0))} total
            </span>
          </div>
        </div>
      )}

      <ToolPanel
        title="Output settings"
        description={
          targetMeta.lossy
            ? `Everything is encoded to ${targetMeta.label} on this device. Lower quality means a smaller file.`
            : `Everything is encoded to ${targetMeta.label} on this device. PNG is lossless, so there is no quality trade-off.`
        }
      >
        <div className="grid grid-cols-1 gap-6">
          {!fixedTarget && (
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="target-format">Convert to</Label>
              <Select
                value={target}
                onValueChange={(value) => {
                  const next = value as RasterFormat
                  setSelectedTarget(next)
                  setQuality(QUALITY_DEFAULTS[next])
                  setLossless(false)
                }}
              >
                <SelectTrigger id="target-format" className="w-full sm:w-64">
                  <SelectValue placeholder="Choose a format" />
                </SelectTrigger>
                <SelectContent>
                  {targetChoices.map((format) => (
                    <SelectItem key={format} value={format}>
                      {FORMATS[format].label}: {TARGET_BLURB[format]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The source format is detected from each file's contents, not its extension.
              </p>
            </div>
          )}

          {showLossless && (
            <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
              <div className="grid gap-1">
                <Label htmlFor="lossless-toggle">Lossless {targetMeta.label}</Label>
                <p className="text-xs text-muted-foreground">
                  Every pixel is kept exactly. Expect files several times larger than the quality slider produces.
                </p>
              </div>
              <Switch id="lossless-toggle" checked={lossless} onCheckedChange={setLossless} />
            </div>
          )}

          {showQuality && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="quality-slider">Quality</Label>
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                  {quality}
                </span>
              </div>
              <Slider
                id="quality-slider"
                aria-label={`${targetMeta.label} quality, 1 to 100`}
                min={1}
                max={100}
                step={1}
                value={[quality]}
                onValueChange={(value) => setQuality(value[0] ?? quality)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Smallest file</span>
                <span className="hidden text-center sm:block">{QUALITY_HINT[target]}</span>
                <span>Best looking</span>
              </div>
            </div>
          )}

          {showEffort && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="effort-slider">AVIF effort</Label>
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                  {effort} / 10
                </span>
              </div>
              <Slider
                id="effort-slider"
                aria-label="AVIF encoder effort, 0 fastest to 10 smallest"
                min={0}
                max={10}
                step={1}
                value={[effort]}
                onValueChange={(value) => setEffort(value[0] ?? effort)}
              />
              <p className="text-xs text-muted-foreground">
                Higher effort spends more CPU searching for a smaller file at the same quality. Above 7 the
                extra saving is usually under 3% but encoding takes several times longer.
              </p>
            </div>
          )}

          <div className="grid gap-3 rounded-lg bg-muted p-3">
            {targetMeta.alpha ? (
              <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1">
                  <Label htmlFor="flatten-toggle">Flatten transparency onto a colour</Label>
                  <p className="text-xs text-muted-foreground">
                    Off keeps the alpha channel. Turn it on to paint a solid background behind transparent
                    pixels.
                  </p>
                </div>
                <Switch id="flatten-toggle" checked={flatten} onCheckedChange={setFlatten} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {targetMeta.label} has no alpha channel, so transparent pixels are painted with the colour
                below.
              </p>
            )}

            {backgroundActive && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="background-color">Background colour</Label>
                  <input
                    id="background-color"
                    type="color"
                    value={background}
                    onChange={(event) => setBackground(event.target.value)}
                    className="h-9 w-16 cursor-pointer rounded-md border border-input bg-background p-1"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="background-hex">Hex value</Label>
                  <Input
                    id="background-hex"
                    value={background}
                    spellCheck={false}
                    onChange={(event) => {
                      const value = event.target.value
                      setBackground(value.startsWith('#') ? value : `#${value}`)
                    }}
                    className="w-32 font-mono"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['#ffffff', '#000000', '#f5f5f5', '#1e293b'].map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      aria-label={`Use background ${swatch}`}
                      onClick={() => setBackground(swatch)}
                      style={{ backgroundColor: swatch }}
                      className={cn(
                        'size-7 rounded-md border border-border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                        background.toLowerCase() === swatch && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {showSizing && (
            <div className="grid gap-3 rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                <Settings2 className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium">Raster size for vector (SVG) input</span>
              </div>
              <RadioGroup
                value={sizing.mode}
                onValueChange={(value) => setSizing((s) => ({ ...s, mode: value as SvgSizeMode }))}
                className="grid gap-2 sm:grid-cols-3"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="scale" id="size-scale" />
                  <Label htmlFor="size-scale" className="font-normal">
                    Scale factor
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="width" id="size-width" />
                  <Label htmlFor="size-width" className="font-normal">
                    Fixed width
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="height" id="size-height" />
                  <Label htmlFor="size-height" className="font-normal">
                    Fixed height
                  </Label>
                </div>
              </RadioGroup>

              <div className="flex flex-wrap items-end gap-3">
                {sizing.mode === 'scale' && (
                  <div className="grid gap-2">
                    <Label htmlFor="svg-scale">Multiply the SVG's own size by</Label>
                    <Input
                      id="svg-scale"
                      type="number"
                      min={0.1}
                      max={64}
                      step={0.5}
                      value={sizing.scale}
                      onChange={(event) =>
                        setSizing((s) => ({ ...s, scale: Number(event.target.value) || 1 }))
                      }
                      className="w-32"
                    />
                  </div>
                )}
                {sizing.mode === 'width' && (
                  <div className="grid gap-2">
                    <Label htmlFor="svg-width">Output width (px)</Label>
                    <Input
                      id="svg-width"
                      type="number"
                      min={1}
                      max={16384}
                      step={1}
                      value={sizing.width}
                      onChange={(event) =>
                        setSizing((s) => ({ ...s, width: Number(event.target.value) || 1 }))
                      }
                      className="w-32"
                    />
                  </div>
                )}
                {sizing.mode === 'height' && (
                  <div className="grid gap-2">
                    <Label htmlFor="svg-height">Output height (px)</Label>
                    <Input
                      id="svg-height"
                      type="number"
                      min={1}
                      max={16384}
                      step={1}
                      value={sizing.height}
                      onChange={(event) =>
                        setSizing((s) => ({ ...s, height: Number(event.target.value) || 1 }))
                      }
                      className="w-32"
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 4].map((factor) => (
                    <Button
                      key={factor}
                      type="button"
                      variant={sizing.mode === 'scale' && sizing.scale === factor ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setSizing((s) => ({ ...s, mode: 'scale', scale: factor }))}
                    >
                      {factor}×
                    </Button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Aspect ratio is always preserved. SVGs with no width/height attributes are measured from their
                viewBox.
              </p>
            </div>
          )}
        </div>
      </ToolPanel>

      {busy && (
        <ProgressPanel
          label={
            currentName
              ? `Converting ${currentName} to ${targetMeta.label} (${done} of ${files.length} done)`
              : `Converting to ${targetMeta.label}…`
          }
          value={progress}
        />
      )}

      {stale && !busy && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-muted-foreground">
            The settings changed since these results were produced.
          </p>
          <Button size="sm" onClick={() => void convert(files)}>
            <ArrowLeftRight aria-hidden="true" />
            Convert again
          </Button>
        </div>
      )}

      {fatal && <ErrorNote message={fatal} onRetry={() => void convert(files)} />}

      {failures.length > 0 && (
        <div className="rounded-lg bg-muted p-4">
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ImageOff className="size-4" aria-hidden="true" />
            {failures.length} file{failures.length === 1 ? '' : 's'} could not be converted
          </h3>
          <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
            {failures.map((failure) => (
              <li key={failure.id}>
                <span className="font-medium text-foreground">{failure.inputName}</span>: {failure.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {results.length > 0 && (
        <ToolPanel
          title={`${results.length} ${targetMeta.label} file${results.length === 1 ? '' : 's'} ready`}
          description="Your own CPU made each file below."
          footer={
            results.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void downloadZip()} disabled={zipping}>
                  <Package aria-hidden="true" />
                  {zipping ? 'Building ZIP…' : `Download all ${results.length} as ZIP`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    for (const item of results) downloadBlob(item.blob, item.outputName)
                  }}
                >
                  <FileDown aria-hidden="true" />
                  Save each file
                </Button>
              </div>
            ) : (
              <DownloadButton
                blob={results[0].blob}
                filename={results[0].outputName}
                label={`Download ${targetMeta.label}`}
              />
            )
          }
        >
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <ResultStat label="Before" value={formatBytes(totals.before)} hint="total input size" />
              <ResultStat label="After" value={formatBytes(totals.after)} hint={`total ${targetMeta.label} size`} emphasis />
              <ResultStat
                label="Difference"
                value={totals.text}
                hint={
                  totals.tone === 'good'
                    ? `${formatBytes(Math.max(0, totals.before - totals.after))} saved`
                    : totals.tone === 'bad'
                      ? `${formatBytes(Math.max(0, totals.after - totals.before))} added`
                      : 'no meaningful change'
                }
              />
            </div>

            <ul className="grid gap-2">
              {results.map((item) => {
                const delta = deltaLabel(item.inputSize, item.outputSize)
                const broken = brokenThumbs.includes(item.id)
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg bg-card p-3"
                  >
                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {broken ? (
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {FORMATS[item.format].label}
                        </span>
                      ) : (
                        <img
                          src={item.url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="size-full object-contain"
                          onError={() => setBrokenThumbs((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={item.outputName}>
                        {item.outputName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.width} × {item.height} px · {formatBytes(item.inputSize)} →{' '}
                        {formatBytes(item.outputSize)}{' '}
                        <span
                          className={cn(
                            'font-medium',
                            delta.tone === 'good' && 'text-success',
                            delta.tone === 'bad' && 'text-warning',
                          )}
                        >
                          ({delta.text})
                        </span>
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadBlob(item.blob, item.outputName)}
                      aria-label={`Download ${item.outputName}`}
                    >
                      <Download aria-hidden="true" />
                      Save
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        </ToolPanel>
      )}

      <div className="grid gap-3 rounded-lg bg-muted p-4 text-sm text-muted-foreground sm:grid-cols-2">
        <p className="flex gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">Metadata is stripped.</span> Re-encoding rebuilds the
            file from raw pixels, so EXIF (GPS coordinates, camera model, serial number, capture time) and
            any XMP or IPTC block are dropped. Pixels are written in sRGB.
          </span>
        </p>
        <p className="flex gap-2">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">Nothing leaves this tab.</span> The encoders are
            WebAssembly builds of libjpeg-turbo (MozJPEG), libpng/oxipng, libwebp and libavif running inside a
            worker on your machine.
          </span>
        </p>
      </div>
    </div>
  )
}
