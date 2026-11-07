/**
 * Super resolution: enlarges a photo or drawing 2 or 4 times (or cleans it at the same size)
 * with a Real-ESRGAN model on this device, tile by tile.
 */
import { useMemo, useRef, useState } from 'react'
import { RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { IMAGE_ACCEPT, decodeImage } from '@/components/tools/image-edit/image-utils'
import { detectHardware } from '@/lib/ml/runtime/backend'
import { runtimeFiles } from '@/lib/ml/runtime/runtime'
import { isAbort } from '@/lib/ml/runtime/rpc'
import { upscaler } from '@/lib/ml/upscale/client'
import { MAX_OUTPUT_PIXELS, NATIVE_SCALE, UPSCALE_MODELS, cpuSeconds, upscaleDownloadBytes } from '@/lib/ml/upscale/models'
import type { UpscaleModel } from '@/lib/ml/upscale/models'
import { stripExtension } from '@/lib/utils'
import { Compare } from '../common/compare'
import { Choice } from '../common/controls'
import { canvasBlob } from '../common/files'
import type { ImageFormat } from '../common/files'
import { DownloadNote, DownloadProgress, hardwareNote, useCached, useHardware } from '../common/model'
import type { Download } from '../common/model'
import { PRESETS } from './presets'
import type { Scale, UpscaleSlug } from './presets'

const FORMATS: { value: ImageFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
]
const EXT: Record<ImageFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' }
const MODELS: { value: UpscaleModel; label: string }[] = [
  { value: 'photo', label: 'Photo' },
  { value: 'drawing', label: 'Drawing or anime' },
]

interface Source {
  file: File
  bitmap: ImageBitmap
}

interface Result {
  blob: Blob
  width: number
  height: number
}

function duration(s: number): string {
  if (s < 60) return `${Math.max(1, Math.round(s))} s`
  return `${Math.round(s / 60)} min`
}

export default function UpscaleTool({ slug }: { slug: UpscaleSlug }) {
  const preset = PRESETS[slug]
  const hw = useHardware()
  const [model, setModel] = useState<UpscaleModel>(preset.model)
  const [scale, setScale] = useState<Scale>(preset.scale)
  const [format, setFormat] = useState<ImageFormat>('png')
  const files = useMemo(() => (hw ? [...runtimeFiles(hw.backend), UPSCALE_MODELS[model].path] : null), [hw, model])
  const [cached, markCached] = useCached(files)
  const [source, setSource] = useState<Source | null>(null)
  const [download, setDownload] = useState<Download | null>(null)
  const [tiles, setTiles] = useState<{ done: number; total: number; started: number } | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function onFiles(list: File[]) {
    const file = list[0]
    if (!file) return
    setError(null)
    setResult(null)
    try {
      const { bitmap } = await decodeImage(file)
      source?.bitmap.close()
      setSource({ file, bitmap })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This image could not be read.')
    }
  }

  // The model always works at 4x; smaller sizes are made from that, so they allow 4 times more.
  const limit = scale === NATIVE_SCALE ? MAX_OUTPUT_PIXELS / 16 : MAX_OUTPUT_PIXELS / 4
  const tooBig = source ? source.bitmap.width * source.bitmap.height > limit : false
  const estimate = source && hw?.backend === 'wasm' ? cpuSeconds(model, source.bitmap.width * source.bitmap.height) : 0

  async function run() {
    if (!source) return
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort
    setError(null)
    setResult(null)
    try {
      const hw = await detectHardware()
      if (!cached) setDownload({ loaded: 0, total: upscaleDownloadBytes(hw, model) })
      await upscaler.call('load', { hw, model }, { signal: abort.signal, onProgress: (loaded, total) => setDownload({ loaded, total }) })
      setDownload(null)
      markCached()
      const started = performance.now()
      setTiles({ done: 0, total: 1, started })
      const image = await createImageBitmap(source.bitmap)
      const out = await upscaler.call(
        'upscale',
        { hw, model, image, scale },
        { signal: abort.signal, transfer: [image], onProgress: (done, total) => setTiles({ done, total, started }) },
      )
      const canvas = document.createElement('canvas')
      canvas.width = out.width
      canvas.height = out.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Your browser blocked canvas drawing, so the image cannot be saved.')
      ctx.putImageData(new ImageData(out.pixels as Uint8ClampedArray<ArrayBuffer>, out.width, out.height), 0, 0)
      setResult({ blob: await canvasBlob(canvas, format), width: out.width, height: out.height })
    } catch (err) {
      if (!isAbort(err)) setError(err instanceof Error ? err.message : 'The model stopped.')
    } finally {
      if (abortRef.current === abort) {
        setDownload(null)
        setTiles(null)
      }
    }
  }

  function stop() {
    abortRef.current?.abort()
    upscaler.terminate()
  }

  function reset() {
    stop()
    source?.bitmap.close()
    setSource(null)
    setResult(null)
    setError(null)
  }

  const busy = download !== null || tiles !== null
  const left =
    tiles && tiles.done > 0 ? ((performance.now() - tiles.started) / tiles.done) * (tiles.total - tiles.done) / 1000 : estimate

  if (!source) {
    return (
      <div className="space-y-3">
        <FileDropzone accept={IMAGE_ACCEPT} onFiles={(f) => void onFiles(f)} maxSizeMb={60} title="Drop an image here" hint="JPG, PNG, WebP or AVIF. Small images gain the most." />
        <DownloadNote bytes={hw ? upscaleDownloadBytes(hw, model) : 0} cached={cached} />
        {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
      </div>
    )
  }

  const { width: w, height: h } = source.bitmap
  const label = scale === 1 ? 'Enhance' : `Upscale ${scale}x`
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ToolPanel
          title={source.file.name}
          description={
            result
              ? `${w} x ${h} px to ${result.width} x ${result.height} px. ${hardwareNote(hw)}`
              : `${w} x ${h} px. The result is ${w * scale} x ${h * scale} px. ${hardwareNote(hw)}`
          }
        >
          {download && <DownloadProgress download={download} />}
          {tiles && !download && (
            <ProgressPanel
              label={`${scale === 1 ? 'Enhancing' : 'Upscaling'}: part ${Math.min(tiles.total, tiles.done + 1)} of ${tiles.total}`}
              value={(tiles.done / Math.max(1, tiles.total)) * 100}
              sublabel={left > 5 ? `About ${duration(left)} left.` : undefined}
            />
          )}
          {busy && (
            <Button variant="secondary" onClick={stop}>
              <Square aria-hidden="true" /> Stop
            </Button>
          )}
          <Compare before={source.file} after={result?.blob ?? null} width={w} height={h} />
        </ToolPanel>

        <ToolPanel
          title="Options"
          footer={
            <div className="flex w-full flex-col gap-2">
              {result ? (
                <DownloadButton blob={result.blob} filename={`${stripExtension(source.file.name)}${preset.suffix}.${EXT[format]}`} label={`Download ${format === 'jpeg' ? 'JPG' : format.toUpperCase()}`} size="lg" className="w-full" />
              ) : (
                <Button size="lg" className="w-full" disabled={busy || tooBig} onClick={() => void run()}>
                  {label}
                </Button>
              )}
              {result && (
                <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void run()}>
                  Run again with these options
                </Button>
              )}
              <Button variant="ghost" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Other image
              </Button>
            </div>
          }
        >
          <Choice
            label="Size"
            value={String(scale)}
            options={preset.scales.map((s) => ({ value: String(s), label: s === 1 ? 'Same' : `${s}x` }))}
            onChange={(v) => setScale(Number(v) as Scale)}
          />
          <Choice label="Image type" value={model} options={MODELS} onChange={setModel} />
          <Choice label="Format" value={format} options={FORMATS} onChange={setFormat} />
          {tooBig && (
            <p className="text-sm">
              This image is too large for this size: the result would be over {scale === NATIVE_SCALE ? '16' : '64'} megapixels, more than a browser can draw.{' '}
              {scale === NATIVE_SCALE ? 'Choose 2x, or a smaller image.' : 'Make the image smaller first.'}
            </p>
          )}
          {!result && estimate > 20 && !busy && <p className="text-sm text-muted-foreground">On this device it takes about {duration(estimate)}.</p>}
          {!result && <DownloadNote bytes={hw ? upscaleDownloadBytes(hw, model) : 0} cached={cached} />}
        </ToolPanel>
      </div>
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
    </div>
  )
}
