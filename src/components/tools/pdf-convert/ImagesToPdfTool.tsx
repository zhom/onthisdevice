import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, FileDown, GripVertical, Plus, RotateCcw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn, formatBytes, nextFrame } from '@/lib/utils'
import { PAGE_SIZES, pageSizeById, toBlob } from './pdf-common'
import {
  embedPrepared,
  mmToPt,
  placeImage,
  prepareImage,
  type FitMode,
  type OrientationMode,
  type PreparedImage,
} from './image-utils'

export type ImagesMode = 'jpg' | 'png' | 'mixed'

interface Props {
  mode: ImagesMode
}

const ACCEPT: Record<ImagesMode, string> = {
  jpg: '.jpg,.jpeg,.jfif,image/jpeg',
  png: '.png,image/png',
  mixed: '.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif',
}

const DROP_TITLE: Record<ImagesMode, string> = {
  jpg: 'Drop JPG photos here',
  png: 'Drop PNG images here',
  mixed: 'Drop JPG, PNG or WebP images here',
}

const FIT_OPTIONS: { value: FitMode; label: string; hint: string }[] = [
  { value: 'contain', label: 'Fit (whole image visible)', hint: 'Scales the image inside the margins; may leave white space.' },
  { value: 'cover', label: 'Fill (cover the page)', hint: 'Scales up until the page is covered; the overflow is cropped.' },
  { value: 'stretch', label: 'Stretch (distort to fill)', hint: 'Forces the image to the page box and changes its aspect ratio.' },
]

export default function ImagesToPdfTool({ mode }: Props) {
  const [images, setImages] = useState<PreparedImage[]>([])
  const [pageSizeId, setPageSizeId] = useState('auto')
  const [orientation, setOrientation] = useState<OrientationMode>('auto')
  const [fit, setFit] = useState<FitMode>('contain')
  const [marginMm, setMarginMm] = useState(0)
  const [reading, setReading] = useState(false)
  const [readProgress, setReadProgress] = useState(0)
  const [building, setBuilding] = useState(false)
  const [buildProgress, setBuildProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Blob | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const imagesRef = useRef<PreparedImage[]>([])
  imagesRef.current = images

  useEffect(
    () => () => {
      for (const image of imagesRef.current) URL.revokeObjectURL(image.previewUrl)
    },
    [],
  )

  // A finished PDF no longer matches the layout controls — require a rebuild.
  useEffect(() => {
    setResult(null)
  }, [pageSizeId, orientation, fit, marginMm])

  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    setError(null)
    setResult(null)
    setReading(true)
    setReadProgress(0)
    const failures: string[] = []
    const added: PreparedImage[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      try {
        added.push(await prepareImage(file))
      } catch (err) {
        failures.push(err instanceof Error ? err.message : `"${file.name}" could not be read.`)
      }
      setReadProgress(Math.round(((i + 1) / files.length) * 100))
      await nextFrame()
    }
    if (added.length > 0) setImages((prev) => [...prev, ...added])
    if (failures.length > 0) setError(failures.join(' '))
    setReading(false)
  }, [])

  const removeAt = useCallback((index: number) => {
    setResult(null)
    const target = imagesRef.current[index]
    if (target) URL.revokeObjectURL(target.previewUrl)
    setImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const move = useCallback((from: number, to: number) => {
    setResult(null)
    setImages((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      if (!item) return prev
      next.splice(to, 0, item)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    for (const image of imagesRef.current) URL.revokeObjectURL(image.previewUrl)
    setImages([])
    setResult(null)
    setError(null)
  }, [])

  const build = useCallback(async () => {
    if (images.length === 0) return
    setBuilding(true)
    setBuildProgress(0)
    setError(null)
    setResult(null)
    try {
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.create()
      const size = pageSizeId === 'auto' ? null : pageSizeById(pageSizeId)
      const margin = mmToPt(marginMm)

      for (let i = 0; i < images.length; i++) {
        const image = images[i]!
        const embedded = await embedPrepared(doc, image)
        const placement = placeImage({
          imageWidth: embedded.width,
          imageHeight: embedded.height,
          page: size ? { width: size.width, height: size.height } : null,
          orientation,
          margin,
          fit,
        })
        const page = doc.addPage([placement.pageWidth, placement.pageHeight])
        page.drawImage(embedded, {
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
        })
        setBuildProgress(Math.round(((i + 1) / images.length) * 100))
        await nextFrame()
      }

      doc.setProducer('onthisdevice.com')
      doc.setCreator('onthisdevice.com')
      doc.setCreationDate(new Date())
      const bytes = await doc.save()
      setResult(toBlob(bytes, 'application/pdf'))
    } catch (err) {
      setError(
        err instanceof Error
          ? `The PDF could not be built (${err.message}).`
          : 'The PDF could not be built. Try removing the most recently added image.',
      )
    } finally {
      setBuilding(false)
    }
  }, [fit, images, marginMm, orientation, pageSizeId])

  const totalBytes = images.reduce((sum, image) => sum + image.size, 0)
  const autoSize = pageSizeId === 'auto'

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={ACCEPT[mode]}
        multiple
        onFiles={addFiles}
        maxSizeMb={200}
        title={images.length === 0 ? DROP_TITLE[mode] : 'Add more images'}
        hint="or click to browse"
      />

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {reading && <ProgressPanel label="Decoding images…" value={readProgress} />}

      {images.length > 0 && (
        <ToolPanel
          title={`${images.length} image${images.length === 1 ? '' : 's'}`}
          description={`${formatBytes(totalBytes)} in total · drag a card, or use its arrow buttons, to change the page order`}
          footer={
            <Button variant="ghost" onClick={reset} disabled={building}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Remove all
            </Button>
          }
        >
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Pages in order">
            {images.map((image, index) => (
              <li
                key={image.id}
                draggable={!building}
                onDragStart={(event) => {
                  setDragIndex(index)
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragIndex !== null) move(dragIndex, index)
                  setDragIndex(null)
                }}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  'flex flex-col overflow-hidden rounded-lg bg-card transition-opacity',
                  dragIndex === index && 'opacity-50',
                )}
              >
                <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted p-2">
                  <img
                    src={image.previewUrl}
                    alt={image.name}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                  <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <GripVertical
                    className="absolute right-1.5 top-1.5 size-4 text-muted-foreground opacity-70"
                    aria-hidden="true"
                  />
                </div>
                <div className="space-y-1.5 border-t border-border px-2.5 py-2">
                  <p className="truncate text-xs font-medium text-foreground" title={image.name}>
                    {image.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {image.width}×{image.height} · {formatBytes(image.size)}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`Move ${image.name} earlier`}
                      disabled={index === 0 || building}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowLeft className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`Move ${image.name} later`}
                      disabled={index === images.length - 1 || building}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="ml-auto size-7 text-destructive"
                      aria-label={`Remove ${image.name}`}
                      disabled={building}
                      onClick={() => removeAt(index)}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </ToolPanel>
      )}

      {images.length > 0 && (
        <ToolPanel
          title="Page layout"
          description="Applies to every page in the document."
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={build} disabled={building || reading}>
                <FileDown className="size-4" aria-hidden="true" />
                {building ? 'Building PDF…' : result ? 'Rebuild PDF' : 'Create PDF'}
              </Button>
              {result && <DownloadButton blob={result} filename={outputName(mode)} label="Download PDF" />}
            </div>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="page-size">Page size</Label>
              <Select value={pageSizeId} onValueChange={setPageSizeId} disabled={building}>
                <SelectTrigger id="page-size" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto: page matches each image</SelectItem>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size.id} value={size.id}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {autoSize
                  ? 'No borders. Each page takes the exact proportions of its image.'
                  : 'Every page gets identical dimensions, which is what you want for printing or filing.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orientation">Orientation</Label>
              <Select
                value={orientation}
                onValueChange={(value) => setOrientation(value as OrientationMode)}
                disabled={building || autoSize}
              >
                <SelectTrigger id="orientation" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto: match each image</SelectItem>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {autoSize
                  ? 'Not used while the page size is Auto.'
                  : 'Auto rotates the page per image so a landscape photo never sits letterboxed on a portrait page.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fit-mode">Image fit</Label>
              <Select value={fit} onValueChange={(value) => setFit(value as FitMode)} disabled={building || autoSize}>
                <SelectTrigger id="fit-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {autoSize ? 'Not used while the page size is Auto.' : FIT_OPTIONS.find((o) => o.value === fit)?.hint}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="margin-slider">Margin</Label>
                <span className="text-sm tabular-nums text-muted-foreground">{marginMm} mm</span>
              </div>
              <Slider
                id="margin-slider"
                min={0}
                max={40}
                step={1}
                value={[marginMm]}
                onValueChange={(v) => setMarginMm(v[0] ?? 0)}
                disabled={building}
                aria-label="Page margin in millimetres"
              />
              <p className="text-xs text-muted-foreground">
                A white border on all four sides. 10–15 mm suits printing; 0 mm is right for screenshots.
              </p>
            </div>
          </div>

          {mode === 'png' && (
            <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">Transparency becomes white.</strong> A PDF page has no
              background layer of its own, so anything transparent in your PNG will show the reader’s page colour,
              which is white in every mainstream viewer and in print.
            </p>
          )}
          {mode === 'mixed' && (
            <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">How formats are handled.</strong> JPG and PNG are
              embedded byte-for-byte with no re-compression. WebP, AVIF, GIF and BMP have no native PDF image type, so
              they are decoded here and stored losslessly as PNG.
            </p>
          )}
        </ToolPanel>
      )}

      {building && <ProgressPanel label="Placing images on pages…" value={buildProgress} />}

      {result && !building && (
        <ToolPanel
          title="Your PDF is ready"
          description={`${images.length} page${images.length === 1 ? '' : 's'} · ${formatBytes(result.size)}`}
          footer={<DownloadButton blob={result} filename={outputName(mode)} label="Download PDF" />}
        >
          <p className="text-sm text-muted-foreground">
            The document was assembled in this browser tab. Change any option above and press Rebuild PDF to
            try a different layout. Your images stay loaded.
          </p>
        </ToolPanel>
      )}

      {images.length === 0 && !reading && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Plus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Add as many images as you like. They become pages in the order shown, and you can reorder or remove any of
            them before exporting.
          </span>
        </p>
      )}
    </div>
  )
}

function outputName(mode: ImagesMode): string {
  if (mode === 'jpg') return 'photos.pdf'
  if (mode === 'png') return 'images.pdf'
  return 'images.pdf'
}
