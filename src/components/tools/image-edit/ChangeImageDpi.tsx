import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Ruler, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { downloadBlob, formatBytes, nextFrame, stripExtension } from '@/lib/utils'
import {
  PHOTO_ACCEPT,
  bitmapToCanvas,
  canvasData,
  decodePhoto,
  encodePhotoData,
  photoError,
  resizePhotoData,
  safeNumber,
} from './photo-image'
import {
  detectContainer,
  readDensity,
  setJpegDensity,
  setPngDensity,
  type DensityInfo,
} from './photo-dpi'

type Unit = 'in' | 'cm' | 'mm'

const UNIT_PER_INCH: Record<Unit, number> = { in: 1, cm: 2.54, mm: 25.4 }
const DPI_PRESETS = [72, 96, 150, 200, 300, 600, 1200]

function physical(px: number, dpi: number, unit: Unit): number {
  if (dpi <= 0) return 0
  return (px / dpi) * UNIT_PER_INCH[unit]
}

export default function ChangeImageDpi() {
  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [info, setInfo] = useState<DensityInfo | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dpi, setDpi] = useState(300)
  const [unit, setUnit] = useState<Unit>('in')
  const [physWidth, setPhysWidth] = useState(4)
  const [physHeight, setPhysHeight] = useState(6)
  const [lockRatio, setLockRatio] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<{ blob: Blob; name: string; note: string } | null>(null)

  const previewRef = useRef<string | null>(null)
  previewRef.current = previewUrl
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    [],
  )

  const onFiles = useCallback(async (incoming: File[]) => {
    const next = incoming[0]
    if (!next) return
    setError(null)
    setOutput(null)
    try {
      const buffer = new Uint8Array(await next.arrayBuffer())
      const container = detectContainer(buffer)
      const density = readDensity(buffer)
      const decoded = await decodePhoto(next)
      setSize({ w: decoded.width, h: decoded.height })
      decoded.bitmap.close()
      setBytes(buffer)
      setInfo(density)
      setFile(next)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(next)
      })
      if (density.x) setDpi(density.x)
      setStatus(
        container === 'other'
          ? `${next.name} is not a JPEG or PNG. DPI can only be written into those two containers. Convert it first.`
          : density.x
            ? `${next.name} declares ${density.x} DPI (${density.source}).`
            : `${next.name} carries no DPI tag at all, so print software assumes 72 DPI.`,
      )
    } catch (err) {
      setError(photoError(err, 'That image could not be opened.'))
    }
  }, [])

  const ratio = size ? size.w / size.h : 1

  const currentDpi = info?.x ?? 72
  const printNow = size
    ? {
        w: physical(size.w, currentDpi, unit),
        h: physical(size.h, currentDpi, unit),
      }
    : null
  const printNext = size ? { w: physical(size.w, dpi, unit), h: physical(size.h, dpi, unit) } : null

  const resampleTarget = useMemo(() => {
    const w = Math.round((physWidth / UNIT_PER_INCH[unit]) * dpi)
    const h = Math.round((physHeight / UNIT_PER_INCH[unit]) * dpi)
    return { w: Math.max(1, w), h: Math.max(1, h) }
  }, [physWidth, physHeight, unit, dpi])

  function setWidthKeepingRatio(value: number) {
    setPhysWidth(value)
    if (lockRatio) setPhysHeight(Number((value / ratio).toFixed(3)))
  }

  function setHeightKeepingRatio(value: number) {
    setPhysHeight(value)
    if (lockRatio) setPhysWidth(Number((value * ratio).toFixed(3)))
  }

  async function applyMetadataOnly() {
    if (!bytes || !file) return
    setBusy(true)
    setError(null)
    try {
      const container = detectContainer(bytes)
      if (container === 'other') {
        throw new Error(
          'Only JPEG and PNG carry a DPI field. Convert this image to JPG or PNG first, then set the DPI.',
        )
      }
      const patched =
        container === 'jpeg' ? setJpegDensity(bytes, dpi) : setPngDensity(bytes, dpi)
      const blob = new Blob([patched as unknown as BlobPart], {
        type: container === 'jpeg' ? 'image/jpeg' : 'image/png',
      })
      const name = `${stripExtension(file.name)}-${dpi}dpi.${container === 'jpeg' ? 'jpg' : 'png'}`
      setOutput({
        blob,
        name,
        note:
          container === 'jpeg'
            ? 'JFIF density fields rewritten (and the EXIF resolution tags too, when present). Not one pixel was re-encoded.'
            : 'pHYs chunk written with a fresh CRC. The image data is byte-identical to your original.',
      })
      setStatus(`Set to ${dpi} DPI (${formatBytes(blob.size)}). Pixels untouched.`)
      downloadBlob(blob, name)
    } catch (err) {
      setError(photoError(err, 'Could not write the DPI tag.'))
    } finally {
      setBusy(false)
    }
  }

  async function applyResample() {
    if (!file) return
    setBusy(true)
    setError(null)
    setStatus('Resampling with a Lanczos3 filter…')
    try {
      await nextFrame()
      const decoded = await decodePhoto(file)
      const source = canvasData(bitmapToCanvas(decoded.bitmap))
      decoded.bitmap.close()
      const resized = await resizePhotoData(source, resampleTarget.w, resampleTarget.h)
      const isPng = file.type === 'image/png'
      const encoded = await encodePhotoData(resized, isPng ? 'png' : 'jpeg', 0.95)
      const raw = new Uint8Array(await encoded.arrayBuffer())
      const patched = isPng ? setPngDensity(raw, dpi) : setJpegDensity(raw, dpi)
      const blob = new Blob([patched as unknown as BlobPart], {
        type: isPng ? 'image/png' : 'image/jpeg',
      })
      const name = `${stripExtension(file.name)}-${physWidth}x${physHeight}${unit}-${dpi}dpi.${isPng ? 'png' : 'jpg'}`
      setOutput({
        blob,
        name,
        note: `Resampled to ${resized.width} × ${resized.height} px and tagged ${dpi} DPI, which prints at exactly ${physWidth} × ${physHeight} ${unit}.`,
      })
      setStatus(`Resampled to ${resized.width}×${resized.height} px (${formatBytes(blob.size)}).`)
      downloadBlob(blob, name)
    } catch (err) {
      setError(photoError(err, 'Resampling failed.'))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setFile(null)
    setBytes(null)
    setInfo(null)
    setSize(null)
    setOutput(null)
    setStatus('')
    setError(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  return (
    <div className="space-y-6">
      {!file && (
        <FileDropzone
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          onFiles={onFiles}
          maxSizeMb={200}
          title="Drop a JPG or PNG"
          hint="The DPI value is a field in the file header. Your browser changes those bytes"
        />
      )}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {file && size && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="space-y-6">
            <ToolPanel title="This image">
              <div className="flex flex-col gap-4 sm:flex-row">
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt={`Preview of ${file.name}`}
                    className="max-h-40 w-auto rounded-lg border border-border"
                  />
                )}
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <ResultStat label="Pixels" value={`${size.w} × ${size.h}`} hint={`${((size.w * size.h) / 1e6).toFixed(1)} megapixels`} />
                  <ResultStat
                    label="DPI in the file"
                    value={info?.x ? `${info.x}` : 'Not set'}
                    hint={info?.x ? `read from ${info.source}` : 'print software will assume 72'}
                  />
                  <ResultStat
                    label={`Prints today (${unit})`}
                    value={printNow ? `${printNow.w.toFixed(2)} × ${printNow.h.toFixed(2)}` : '–'}
                    hint={`at ${currentDpi} DPI`}
                  />
                  <ResultStat
                    label={`Prints at ${dpi} DPI`}
                    value={printNext ? `${printNext.w.toFixed(2)} × ${printNext.h.toFixed(2)}` : '–'}
                    hint="same pixels, different label"
                    emphasis
                  />
                </div>
              </div>
            </ToolPanel>

            <ToolPanel title="Pixels ↔ physical size at the chosen DPI">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[24rem] text-sm">
                  <caption className="sr-only">
                    How this image's pixel dimensions translate to print size at common resolutions
                  </caption>
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-1.5 pr-3">DPI</th>
                      <th scope="col" className="py-1.5 pr-3">Inches</th>
                      <th scope="col" className="py-1.5 pr-3">Centimetres</th>
                      <th scope="col" className="py-1.5">Typical use</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DPI_PRESETS.map((d) => (
                      <tr key={d} className="border-t border-border">
                        <th scope="row" className="py-1.5 pr-3 text-left font-medium">{d}</th>
                        <td className="py-1.5 pr-3">
                          {physical(size.w, d, 'in').toFixed(2)} × {physical(size.h, d, 'in').toFixed(2)}
                        </td>
                        <td className="py-1.5 pr-3">
                          {physical(size.w, d, 'cm').toFixed(2)} × {physical(size.h, d, 'cm').toFixed(2)}
                        </td>
                        <td className="py-1.5 text-muted-foreground">
                          {d === 72
                            ? 'Legacy screen default'
                            : d === 96
                              ? 'Windows screen default'
                              : d === 150
                                ? 'Draft / newspaper print'
                                : d === 200
                                  ? 'Office laser output'
                                  : d === 300
                                    ? 'Standard print quality'
                                    : d === 600
                                      ? 'Fine art, line art, scans'
                                      : 'Archival scanning'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ToolPanel>
          </div>

          <ToolPanel title="Change the DPI">
            <Tabs defaultValue="tag">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="tag">Set DPI only</TabsTrigger>
                <TabsTrigger value="resample">Resample</TabsTrigger>
              </TabsList>

              <TabsContent value="tag" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="dpi-value">Target DPI</Label>
                  <Input
                    id="dpi-value"
                    type="number"
                    min={1}
                    max={4800}
                    value={dpi}
                    onChange={(e) => setDpi(safeNumber(Number(e.target.value), 1, 4800, 300))}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {DPI_PRESETS.map((d) => (
                      <Button
                        key={d}
                        type="button"
                        size="sm"
                        variant={dpi === d ? 'default' : 'outline'}
                        onClick={() => setDpi(d)}
                      >
                        {d}
                      </Button>
                    ))}
                  </div>
                </div>

                <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  <Ruler className="mr-1 inline size-3.5" aria-hidden="true" />
                  Nothing is re-encoded: we rewrite the density field in the header, so the image
                  quality, the pixel count and even the JPEG coefficients stay byte-for-byte
                  identical.
                </p>

                <Button size="lg" className="w-full" onClick={applyMetadataOnly} disabled={busy}>
                  <Download className="size-4" aria-hidden="true" />
                  {busy ? 'Writing…' : `Set ${dpi} DPI and download`}
                </Button>
              </TabsContent>

              <TabsContent value="resample" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="dpi-unit">Units</Label>
                  <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                    <SelectTrigger id="dpi-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Inches</SelectItem>
                      <SelectItem value="cm">Centimetres</SelectItem>
                      <SelectItem value="mm">Millimetres</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="dpi-pw">Print width ({unit})</Label>
                    <Input
                      id="dpi-pw"
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={physWidth}
                      onChange={(e) => setWidthKeepingRatio(safeNumber(Number(e.target.value), 0.1, 5000, 4))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dpi-ph">Print height ({unit})</Label>
                    <Input
                      id="dpi-ph"
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={physHeight}
                      onChange={(e) => setHeightKeepingRatio(safeNumber(Number(e.target.value), 0.1, 5000, 6))}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={lockRatio}
                    onChange={(e) => setLockRatio(e.target.checked)}
                  />
                  Keep the original aspect ratio
                </label>

                <div className="space-y-2">
                  <Label htmlFor="dpi-value-2">Target DPI</Label>
                  <Input
                    id="dpi-value-2"
                    type="number"
                    min={1}
                    max={4800}
                    value={dpi}
                    onChange={(e) => setDpi(safeNumber(Number(e.target.value), 1, 4800, 300))}
                  />
                </div>

                <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  {physWidth} {unit} × {dpi} DPI = <strong>{resampleTarget.w} px</strong> wide, and{' '}
                  {physHeight} {unit} × {dpi} DPI = <strong>{resampleTarget.h} px</strong> tall.
                  {resampleTarget.w > size.w
                    ? ' That is larger than your original, so pixels will be invented by interpolation, and the print will look softer.'
                    : ' That is a downscale, which is safe and usually looks sharper in print.'}
                </p>

                <Button size="lg" className="w-full" onClick={applyResample} disabled={busy}>
                  <Download className="size-4" aria-hidden="true" />
                  {busy ? 'Resampling…' : 'Resample and download'}
                </Button>
              </TabsContent>
            </Tabs>

            <Button type="button" variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="size-4" aria-hidden="true" /> Use a different image
            </Button>
          </ToolPanel>
        </div>
      )}

      {busy && <ProgressPanel label={status || 'Working…'} />}

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>

      {output && (
        <ToolPanel title="Ready">
          <div className="space-y-2">
            <p className="text-sm font-medium">{output.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatBytes(output.blob.size)}: {output.note}
            </p>
            <Button type="button" onClick={() => downloadBlob(output.blob, output.name)}>
              <Download className="size-4" aria-hidden="true" /> Download again
            </Button>
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
