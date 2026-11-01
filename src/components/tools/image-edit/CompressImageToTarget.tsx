import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileArchive, Gauge, RotateCcw, CircleCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileChips } from '@/components/shared/FileChips'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { downloadBlob, formatBytes, nextFrame } from '@/lib/utils'
import {
  PHOTO_ACCEPT,
  bitmapToCanvas,
  canvasData,
  decodePhoto,
  encodePhotoData,
  photoError,
  photoOutputName,
  resizePhotoData,
  safeNumber,
  type PhotoFormat,
} from './photo-image'

type TargetFormat = PhotoFormat | 'auto'

interface Attempt {
  quality: number
  scale: number
  bytes: number
}

interface Result {
  name: string
  blob: Blob
  url: string
  originalBytes: number
  width: number
  height: number
  originalWidth: number
  originalHeight: number
  quality: number
  scale: number
  attempts: Attempt[]
  hitTarget: boolean
  format: PhotoFormat
}

export interface CompressImageToTargetProps {
  /** Preset target in kibibytes (100 = "100 KB"). */
  targetKb?: number
  /** Force the output codec; `auto` keeps JPEG for photos and PNG for PNG input. */
  fixedFormat?: TargetFormat
  /** Copy hint for the dropzone. */
  inputLabel?: string
}

/** Aim a little under the limit: portals compare against a hard byte ceiling. */
const SAFETY = 0.98

export default function CompressImageToTarget({
  targetKb = 100,
  fixedFormat = 'auto',
  inputLabel,
}: CompressImageToTargetProps) {
  const [files, setFiles] = useState<File[]>([])
  const [target, setTarget] = useState(targetKb)
  const [format, setFormat] = useState<TargetFormat>(fixedFormat)
  const [allowResize, setAllowResize] = useState(true)
  const [maxWidth, setMaxWidth] = useState(0)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [zipping, setZipping] = useState(false)

  const resultsRef = useRef<Result[]>([])
  resultsRef.current = results
  useEffect(
    () => () => {
      for (const r of resultsRef.current) URL.revokeObjectURL(r.url)
    },
    [],
  )

  const clearResults = useCallback(() => {
    setResults((prev) => {
      for (const r of prev) URL.revokeObjectURL(r.url)
      return []
    })
  }, [])

  const onFiles = useCallback(
    (incoming: File[]) => {
      setError(null)
      clearResults()
      setFiles((prev) => [...prev, ...incoming])
    },
    [clearResults],
  )

  function removeFile(index: number) {
    clearResults()
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function compressOne(file: File, targetBytes: number, onStep: (text: string) => void): Promise<Result> {
    const decoded = await decodePhoto(file)
    const originalWidth = decoded.width
    const originalHeight = decoded.height
    const base = canvasData(bitmapToCanvas(decoded.bitmap))
    decoded.bitmap.close()

    const chosen: PhotoFormat =
      format === 'auto' ? (file.type === 'image/png' ? 'png' : 'jpeg') : (format as PhotoFormat)
    const lossless = chosen === 'png'
    const attempts: Attempt[] = []

    // Optional hard width cap before anything else.
    let source = base
    if (maxWidth > 0 && base.width > maxWidth) {
      source = await resizePhotoData(base, maxWidth, Math.round((base.height * maxWidth) / base.width))
    }

    const cache = new Map<number, ImageData>()
    const scaled = async (scale: number): Promise<ImageData> => {
      const key = Math.round(scale * 1000)
      const hit = cache.get(key)
      if (hit) return hit
      const data =
        scale >= 0.999
          ? source
          : await resizePhotoData(source, Math.max(16, Math.round(source.width * scale)), Math.max(16, Math.round(source.height * scale)))
      cache.set(key, data)
      return data
    }

    const encodeAt = async (scale: number, quality: number): Promise<{ blob: Blob; data: ImageData }> => {
      const data = await scaled(scale)
      const blob = await encodePhotoData(data, chosen, quality / 100)
      attempts.push({ quality, scale, bytes: blob.size })
      return { blob, data }
    }

    let best: { blob: Blob; data: ImageData; quality: number; scale: number } | null = null

    if (!lossless) {
      // Pass 1 — binary search on quality at full size.
      onStep('Measuring at quality 92…')
      const first = await encodeAt(1, 92)
      if (first.blob.size <= targetBytes) {
        best = { ...first, quality: 92, scale: 1 }
      } else {
        let low = 5
        let high = 92
        for (let i = 0; i < 9 && low <= high; i++) {
          const mid = Math.round((low + high) / 2)
          onStep(`Search step ${i + 1}: trying quality ${mid}…`)
          const trial = await encodeAt(1, mid)
          if (trial.blob.size <= targetBytes) {
            best = { ...trial, quality: mid, scale: 1 }
            low = mid + 1
          } else {
            high = mid - 1
          }
          await nextFrame()
        }
      }
    }

    // Pass 2 — if quality alone cannot get there (or PNG, which has no quality
    // dial), search the scale factor instead.
    if (!best && allowResize) {
      let low = 0.1
      let high = 1
      const quality = lossless ? 100 : 45
      for (let i = 0; i < 8; i++) {
        const mid = (low + high) / 2
        onStep(`Resize step ${i + 1}: trying ${Math.round(mid * 100)}% of the original size…`)
        const trial = await encodeAt(mid, quality)
        if (trial.blob.size <= targetBytes) {
          best = { ...trial, quality, scale: mid }
          low = mid
        } else {
          high = mid
        }
        await nextFrame()
      }
    }

    if (!best) {
      // Nothing fit: hand back the smallest thing we produced so the user still
      // gets a file, and say so plainly.
      const quality = lossless ? 100 : 5
      const fallback = await encodeAt(allowResize ? 0.1 : 1, quality)
      best = { ...fallback, quality, scale: allowResize ? 0.1 : 1 }
    }

    const hitTarget = best.blob.size <= targetBytes
    return {
      name: photoOutputName(file.name, `-${Math.round(targetBytes / 1024)}kb`, chosen),
      blob: best.blob,
      url: URL.createObjectURL(best.blob),
      originalBytes: file.size,
      width: best.data.width,
      height: best.data.height,
      originalWidth,
      originalHeight,
      quality: best.quality,
      scale: best.scale,
      attempts,
      hitTarget,
      format: chosen,
    }
  }

  async function run() {
    if (files.length === 0) return
    const targetBytes = Math.round(target * 1024 * SAFETY)
    if (targetBytes < 1024) {
      setError('Pick a target of at least 1 KB.')
      return
    }
    setBusy(true)
    setError(null)
    clearResults()
    setProgress(0)
    const out: Result[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i] as File
        setProgress(Math.round((i / files.length) * 100))
        const result = await compressOne(file, targetBytes, (text) =>
          setStatus(`${file.name} (${i + 1}/${files.length}): ${text}`),
        )
        // Two inputs can map to one name (photo.png and photo.jpg → photo-100kb.jpg);
        // a ZIP keeps only one of them, so number the repeats.
        let name = result.name
        for (let n = 2; out.some((r) => r.name === name); n++) {
          const dot = result.name.lastIndexOf('.')
          name = dot > 0 ? `${result.name.slice(0, dot)}-${n}${result.name.slice(dot)}` : `${result.name}-${n}`
        }
        out.push({ ...result, name })
        await nextFrame()
      }
      setProgress(100)
      setResults(out)
      const missed = out.filter((r) => !r.hitTarget).length
      setStatus(
        missed === 0
          ? `All ${out.length} ${out.length === 1 ? 'image is' : 'images are'} under ${target} KB.`
          : `${out.length - missed} of ${out.length} hit the target; ${missed} could not get under ${target} KB even at the lowest setting.`,
      )
    } catch (err) {
      for (const r of out) URL.revokeObjectURL(r.url)
      setError(photoError(err, 'Compression failed. Try one image at a time.'))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  async function downloadZip() {
    if (results.length === 0) return
    setZipping(true)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      for (const r of results) zip.file(r.name, r.blob)
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, `compressed-to-${target}kb.zip`)
    } catch (err) {
      setError(photoError(err, 'Could not build the ZIP.'))
    } finally {
      setZipping(false)
    }
  }

  const totalBefore = results.reduce((s, r) => s + r.originalBytes, 0)
  const totalAfter = results.reduce((s, r) => s + r.blob.size, 0)

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={PHOTO_ACCEPT}
        multiple
        onFiles={onFiles}
        maxSizeMb={200}
        title={inputLabel ?? 'Drop the photos you need under the size limit'}
        hint="Add as many as you like. Each encode runs on your own CPU, so the retry loop costs nothing"
      />

      {files.length > 0 && <FileChips files={files} onRemove={removeFile} />}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      <ToolPanel
        title="Target size"
        description="We aim 2% under the limit, because upload forms compare against a hard byte ceiling."
        footer={
          <Button size="lg" className="w-full" onClick={run} disabled={busy || files.length === 0}>
            <Gauge className="size-4" aria-hidden="true" />
            {busy ? 'Searching…' : `Compress ${files.length || ''} ${files.length === 1 ? 'image' : 'images'} to ${target} KB`}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="target-kb">Target size (KB)</Label>
            <Input
              id="target-kb"
              type="number"
              min={1}
              max={51200}
              value={target}
              onChange={(e) => {
                clearResults()
                setTarget(safeNumber(Number(e.target.value), 1, 51200, targetKb))
              }}
            />
            <p className="text-xs text-muted-foreground">
              1 KB = 1024 bytes, the same arithmetic your operating system uses.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-format">Output format</Label>
            <Select
              value={format}
              onValueChange={(v) => {
                clearResults()
                setFormat(v as TargetFormat)
              }}
            >
              <SelectTrigger id="target-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Match the input (JPG in → JPG out)</SelectItem>
                <SelectItem value="jpeg">JPG (best for photos)</SelectItem>
                <SelectItem value="webp">WebP (~30% smaller than JPG)</SelectItem>
                <SelectItem value="png">PNG (lossless, resize-only search)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-maxw">Cap the width (px, 0 = leave alone)</Label>
            <Input
              id="target-maxw"
              type="number"
              min={0}
              max={20000}
              value={maxWidth}
              onChange={(e) => {
                clearResults()
                setMaxWidth(safeNumber(Number(e.target.value), 0, 20000, 0))
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md bg-muted p-3">
            <div>
              <Label htmlFor="target-resize">Shrink if quality is not enough</Label>
              <p className="text-xs text-muted-foreground">
                Only kicks in when quality 5 still overshoots.
              </p>
            </div>
            <Switch
              id="target-resize"
              checked={allowResize}
              onCheckedChange={(v) => {
                clearResults()
                setAllowResize(v)
              }}
            />
          </div>
        </div>
      </ToolPanel>

      {busy && <ProgressPanel label={status || 'Encoding…'} value={progress} sublabel="Each attempt is a full encode. Usually 10 attempts take less than a second." />}

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Before" value={formatBytes(totalBefore)} />
            <ResultStat
              label="After"
              value={formatBytes(totalAfter)}
              hint={`${Math.max(0, Math.round((1 - totalAfter / Math.max(1, totalBefore)) * 100))}% smaller`}
              emphasis
            />
            <ResultStat label="Target" value={`${target} KB per image`} hint="aimed 2% under" />
          </div>

          <p className="text-sm text-muted-foreground">{status}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((r) => (
              <div key={r.name} className="flex flex-col gap-3 rounded-lg bg-card p-3">
                <div className="flex gap-3">
                  <img
                    src={r.url}
                    alt={`Compressed ${r.name}`}
                    className="size-24 shrink-0 rounded border border-border object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="truncate font-medium" title={r.name}>
                      {r.name}
                    </p>
                    <p className="flex items-start gap-1.5 text-foreground">
                      {r.hitTarget ? (
                        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      )}
                      <span>
                        {formatBytes(r.blob.size)}{' '}
                        {r.hitTarget ? `(under ${target} KB)` : `(could not reach ${target} KB)`}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      was {formatBytes(r.originalBytes)} · {r.originalWidth}×{r.originalHeight} px
                    </p>
                    <p className="text-muted-foreground">
                      now {r.width}×{r.height} px
                      {r.format === 'png' ? '' : ` · quality ${r.quality}`}
                      {r.scale < 0.999 ? ` · scaled to ${Math.round(r.scale * 100)}%` : ''}
                    </p>
                  </div>
                </div>

                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">
                    Show the {r.attempts.length}-step search
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[18rem] text-left">
                      <thead>
                        <tr>
                          <th scope="col" className="py-1 pr-2">#</th>
                          <th scope="col" className="py-1 pr-2">Quality</th>
                          <th scope="col" className="py-1 pr-2">Scale</th>
                          <th scope="col" className="py-1">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.attempts.map((a, i) => (
                          <tr key={`${a.quality}-${a.scale}-${i}`} className="border-t border-border">
                            <td className="py-1 pr-2">{i + 1}</td>
                            <td className="py-1 pr-2">{r.format === 'png' ? '–' : a.quality}</td>
                            <td className="py-1 pr-2">{Math.round(a.scale * 100)}%</td>
                            <td className="py-1">
                              {formatBytes(a.bytes)} {a.bytes <= target * 1024 * SAFETY ? '✓ fits' : '✗ too big'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                <Button type="button" size="sm" onClick={() => downloadBlob(r.blob, r.name)}>
                  <Download className="size-4" aria-hidden="true" /> Download
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {results.length > 1 && (
              <Button type="button" variant="outline" onClick={downloadZip} disabled={zipping}>
                <FileArchive className="size-4" aria-hidden="true" />
                {zipping ? 'Zipping…' : `Download all ${results.length} as .zip`}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                clearResults()
                setFiles([])
                setStatus('')
              }}
            >
              <RotateCcw className="size-4" aria-hidden="true" /> Start over
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
