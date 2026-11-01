/**
 * Photo redaction tool: one or more photos, automatic face or plate
 * detection in a worker, the shared editor, and export without metadata.
 * Used by blur-face-in-photo, blur-license-plate, pixelate-image and
 * censor-image (through image-edit/BlurFaceInPhoto.tsx).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileArchive, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn, downloadBlob, formatBytes } from '@/lib/utils'
import { modelDownloadBytes, modelIsCached, visionClient } from '@/lib/ml/vision/client'
import type { VisionModel } from '@/lib/ml/vision/client'
import {
  PHOTO_ACCEPT,
  decodePhoto,
  photoError,
  photoFormatOf,
  photoOutputName,
} from '@/components/tools/image-edit/photo-image'
import type { PhotoFormat } from '@/components/tools/image-edit/photo-image'
import { RedactionEditor } from '../shared/RedactionEditor'
import { LookControls } from '../shared/LookControls'
import { WHOLE_IMAGE, boxesFromDetections, encodeRedacted, renderRedacted } from '../shared/boxes'
import type { EditorBox } from '../shared/boxes'
import type { RedactLook } from '../shared/paint'

export interface PhotoRedactorProps {
  /** Automatic detection, or null for drawn boxes only. */
  detector: VisionModel | null
  defaultLook: RedactLook
  dropTitle: string
  /** Offer "Apply to the whole image". */
  allowWholeImage?: boolean
}

interface Item {
  id: string
  file: File
  preview: ImageBitmap | null
  width: number
  height: number
  boxes: EditorBox[]
  /** Detection ran for this photo. */
  scanned: boolean
  error: string | null
}

const PREVIEW_SIDE = 2048
const DETECT_SIDE = 4096
const NOUN: Record<VisionModel, { one: string; many: string; title: string }> = {
  face: { one: 'face', many: 'faces', title: 'Face' },
  plate: { one: 'plate', many: 'plates', title: 'Plate' },
}

let itemCounter = 0

async function scaledBitmap(source: ImageBitmap, maxSide: number): Promise<{ bitmap: ImageBitmap; scale: number }> {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height))
  const bitmap = await createImageBitmap(source, {
    resizeWidth: Math.max(1, Math.round(source.width * scale)),
    resizeHeight: Math.max(1, Math.round(source.height * scale)),
    resizeQuality: 'high',
  })
  return { bitmap, scale }
}

function mb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1e6))} MB`
}

export default function PhotoRedactor({ detector, defaultLook, dropTitle, allowWholeImage = false }: PhotoRedactorProps) {
  const [items, setItems] = useState<Item[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [look, setLook] = useState<RedactLook>(defaultLook)
  const [auto, setAuto] = useState(detector !== null)
  const [wholeImage, setWholeImage] = useState(false)
  const [format, setFormat] = useState<PhotoFormat>('jpeg')
  const [quality, setQuality] = useState(90)
  const [cached, setCached] = useState(true)
  const [download, setDownload] = useState<{ loaded: number; total: number } | null>(null)
  const [scan, setScan] = useState<{ index: number; count: number; done: number; total: number } | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)

  const itemsRef = useRef(items)
  itemsRef.current = items
  const queue = useRef<string[]>([])
  const running = useRef(false)
  const autoRef = useRef(auto)
  autoRef.current = auto

  const noun = detector ? NOUN[detector] : null

  useEffect(() => {
    if (detector) void modelIsCached(detector).then(setCached)
  }, [detector])

  useEffect(
    () => () => {
      for (const it of itemsRef.current) it.preview?.close()
    },
    [],
  )

  const patch = useCallback((id: string, p: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)))
  }, [])

  /* Decode and detect, one photo at a time. */
  const pump = useCallback(async () => {
    if (running.current) return
    running.current = true
    try {
      while (queue.current.length > 0) {
        const id = queue.current.shift()!
        const item = itemsRef.current.find((it) => it.id === id)
        if (!item) continue
        const count = itemsRef.current.length
        const index = itemsRef.current.findIndex((it) => it.id === id)
        let full: ImageBitmap | null = null
        try {
          if (!item.preview) {
            const decoded = await decodePhoto(item.file)
            full = decoded.bitmap
            const { bitmap } = await scaledBitmap(full, PREVIEW_SIDE)
            patch(id, { preview: bitmap, width: decoded.width, height: decoded.height })
          }
          if (!detector || !autoRef.current || item.scanned) continue
          if (!full) full = (await decodePhoto(item.file)).bitmap
          const vision = visionClient()
          if (!(await modelIsCached(detector))) {
            setDownload({ loaded: 0, total: modelDownloadBytes(detector) })
          }
          await vision.load(detector, (loaded, total) => setDownload({ loaded, total }))
          setDownload(null)
          setCached(true)
          setScan({ index, count, done: 0, total: 1 })
          const { bitmap, scale } = await scaledBitmap(full, DETECT_SIDE)
          const dets = await vision.detect(bitmap, { model: detector, scale: 1 / scale }, (done, total) =>
            setScan({ index, count, done, total }),
          )
          const found = boxesFromDetections(dets, full.width, full.height, detector)
          setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, scanned: true, boxes: [...found, ...it.boxes.filter((b) => b.kind === 'manual')] } : it)),
          )
        } catch (err) {
          setDownload(null)
          patch(id, { error: photoError(err, 'This photo could not be processed.') })
        } finally {
          full?.close()
          setScan(null)
        }
      }
    } finally {
      running.current = false
    }
  }, [detector, patch])

  const onFiles = useCallback(
    (files: File[]) => {
      setError(null)
      setStatus('')
      const added: Item[] = files.map((file) => ({
        id: `photo-${++itemCounter}`,
        file,
        preview: null,
        width: 0,
        height: 0,
        boxes: [],
        scanned: false,
        error: null,
      }))
      if (added.length === 0) return
      if (itemsRef.current.length === 0) setFormat(photoFormatOf(added[0]!.file))
      // The queue reads the ref before React renders the new list.
      itemsRef.current = [...itemsRef.current, ...added]
      setItems((prev) => [...prev, ...added])
      setCurrentId((cur) => cur ?? added[0]!.id)
      queue.current.push(...added.map((a) => a.id))
      void pump()
    },
    [pump],
  )

  function setAutoDetect(on: boolean) {
    setAuto(on)
    autoRef.current = on
    if (on) {
      queue.current.push(...itemsRef.current.filter((it) => !it.scanned).map((it) => it.id))
      void pump()
    }
  }

  const current = items.find((it) => it.id === currentId) ?? items[0] ?? null

  async function exportItem(it: Item): Promise<{ blob: Blob; name: string }> {
    const decoded = await decodePhoto(it.file)
    try {
      const canvas = renderRedacted(decoded.bitmap, decoded.width, decoded.height, wholeImage ? [WHOLE_IMAGE] : it.boxes, look)
      const blob = await encodeRedacted(canvas, format, quality / 100)
      return { blob, name: photoOutputName(it.file.name, '-redacted', format) }
    } finally {
      decoded.bitmap.close()
    }
  }

  async function saveCurrent() {
    if (!current) return
    setExporting('Saving the photo at full size')
    setError(null)
    try {
      const { blob, name } = await exportItem(current)
      downloadBlob(blob, name)
      setStatus(`Saved ${name} (${formatBytes(blob.size)}). Metadata such as GPS and camera details is removed.`)
    } catch (err) {
      setError(photoError(err, 'The photo could not be saved. Try a smaller photo.'))
    } finally {
      setExporting(null)
    }
  }

  async function saveAll() {
    setError(null)
    try {
      const { zipSync } = await import('fflate')
      const files: Record<string, Uint8Array> = {}
      const ready = items.filter((it) => it.preview && !it.error)
      for (const [i, it] of ready.entries()) {
        setExporting(`Saving photo ${i + 1} of ${ready.length}`)
        const { blob, name } = await exportItem(it)
        let unique = name
        for (let n = 2; files[unique]; n++) unique = name.replace(/(\.[a-z]+)$/, `-${n}$1`)
        files[unique] = new Uint8Array(await blob.arrayBuffer())
      }
      const zip = zipSync(files, { level: 0 })
      const blob = new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' })
      downloadBlob(blob, 'redacted-photos.zip')
      setStatus(`Saved ${ready.length} photos in redacted-photos.zip (${formatBytes(blob.size)}). Metadata is removed.`)
    } catch (err) {
      setError(photoError(err, 'The photos could not be saved.'))
    } finally {
      setExporting(null)
    }
  }

  function removeCurrent() {
    if (!current) return
    current.preview?.close()
    const rest = items.filter((it) => it.id !== current.id)
    setItems(rest)
    setCurrentId(rest[0]?.id ?? null)
  }

  function reset() {
    for (const it of items) it.preview?.close()
    queue.current = []
    setItems([])
    setCurrentId(null)
    setStatus('')
    setError(null)
    setWholeImage(false)
  }

  const found = current ? current.boxes.filter((b) => b.kind !== 'manual').length : 0
  const scanningCurrent = scan !== null && current !== null && items[scan.index]?.id === current.id

  return (
    <div className="space-y-6">
      {items.length === 0 && (
        <div className="space-y-3">
          <FileDropzone
            accept={PHOTO_ACCEPT}
            multiple
            onFiles={onFiles}
            maxSizeMb={150}
            title={dropTitle}
            hint="One or more photos. They stay on your device."
          />
          {detector && !cached && (
            <p className="text-sm text-muted-foreground">
              The first photo downloads the {detector} detection model ({mb(modelDownloadBytes(detector))}) once. After that it works offline.
            </p>
          )}
        </div>
      )}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {download && (
        <ProgressPanel
          label={`Downloading the ${detector} model (once): ${mb(download.loaded)} of ${mb(download.total)}`}
          value={download.total > 0 ? (download.loaded / download.total) * 100 : undefined}
        />
      )}
      {scan && !download && noun && (
        <ProgressPanel
          label={scan.count > 1 ? `Finding ${noun.many} in photo ${scan.index + 1} of ${scan.count}` : `Finding ${noun.many}`}
          value={(scan.done / Math.max(1, scan.total)) * 100}
        />
      )}
      {exporting && <ProgressPanel label={exporting} />}

      {items.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ToolPanel
            title={
              noun && current?.scanned
                ? found === 0
                  ? `No ${noun.many} found`
                  : `Found ${found} ${found === 1 ? noun.one : noun.many}`
                : 'Mark the areas to hide'
            }
            description={
              noun
                ? `Click a box to keep that ${noun.one} visible. Drag on the photo to add a box.`
                : 'Drag on the photo to add a box. Click a box to keep that area visible.'
            }
          >
            {items.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Photos">
                {items.map((it, i) => (
                  <button
                    key={it.id}
                    type="button"
                    role="listitem"
                    aria-current={it.id === current?.id}
                    aria-label={`Photo ${i + 1}: ${it.file.name}`}
                    onClick={() => setCurrentId(it.id)}
                    className={cn(
                      'size-16 shrink-0 overflow-hidden rounded-md bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      it.id === current?.id && 'ring-2 ring-foreground',
                    )}
                  >
                    {it.preview ? <PhotoThumb bitmap={it.preview} /> : <span className="text-xs text-muted-foreground">…</span>}
                  </button>
                ))}
              </div>
            )}

            {current?.error && <ErrorNote message={current.error} title="This photo could not be opened" />}
            {current?.preview && (
              <RedactionEditor
                image={current.preview}
                boxes={current.boxes}
                onChange={(boxes) => patch(current.id, { boxes })}
                look={look}
                names={noun ? { [detector!]: noun.title } : undefined}
                wholeImage={wholeImage}
              />
            )}
            {current && !current.preview && !current.error && !scanningCurrent && <ProgressPanel label="Opening the photo" />}
          </ToolPanel>

          <ToolPanel
            title="Options"
            footer={
              <div className="flex w-full flex-col gap-2">
                <Button size="lg" className="w-full" onClick={saveCurrent} disabled={!current?.preview || exporting !== null}>
                  <Download aria-hidden="true" /> Download photo
                </Button>
                {items.length > 1 && (
                  <Button size="lg" variant="secondary" className="w-full" onClick={saveAll} disabled={exporting !== null}>
                    <FileArchive aria-hidden="true" /> Download all as ZIP
                  </Button>
                )}
              </div>
            }
          >
            {detector && noun && (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="redact-auto">Find {noun.many} automatically</Label>
                <Switch id="redact-auto" checked={auto} onCheckedChange={setAutoDetect} />
              </div>
            )}
            <LookControls look={look} onChange={setLook} idPrefix="photo" />
            {allowWholeImage && (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="redact-whole">Apply to the whole image</Label>
                <Switch id="redact-whole" checked={wholeImage} onCheckedChange={setWholeImage} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="redact-format">Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as PhotoFormat)}>
                <SelectTrigger id="redact-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jpeg">JPG</SelectItem>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="webp">WebP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {format !== 'png' && (
              <div className="space-y-2">
                <Label id="redact-quality">Quality: {quality}</Label>
                <Slider aria-labelledby="redact-quality" min={50} max={100} step={1} value={[quality]} onValueChange={(v) => setQuality(v[0] ?? 90)} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={removeCurrent} disabled={!current}>
                <Trash2 aria-hidden="true" /> Remove photo
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Start over
              </Button>
            </div>
          </ToolPanel>
        </div>
      )}

      {items.length > 0 && (
        <FileDropzone accept={PHOTO_ACCEPT} multiple onFiles={onFiles} maxSizeMb={150} title="Add more photos" hint="They stay on your device." />
      )}

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>
    </div>
  )
}

function PhotoThumb({ bitmap }: { bitmap: ImageBitmap }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = 128
    canvas.height = 128
    const side = Math.min(bitmap.width, bitmap.height)
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 128, 128)
  }, [bitmap])
  return <canvas ref={ref} aria-hidden="true" className="size-full" />
}
