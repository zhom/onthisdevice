/**
 * Object removal: the visitor paints over things in a photo (or the text finder marks text),
 * and MI-GAN fills the marked area from its surroundings on this device. Each removal can be
 * undone, and several can be done one after the other.
 */
import { useEffect, useRef, useState } from 'react'
import { Eraser, RotateCcw, ScanText, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { IMAGE_ACCEPT, decodeImage } from '@/components/tools/image-edit/image-utils'
import { inpainter } from '@/lib/ml/inpaint/client'
import { INPAINT_MODEL, inpaintDownloadBytes } from '@/lib/ml/inpaint/model'
import { loadOcr, ocrDownloadBytes, readImage } from '@/lib/ml/ocr/ocr'
import { runtimeFiles } from '@/lib/ml/runtime/runtime'
import { isAbort } from '@/lib/ml/runtime/rpc'
import { stripExtension } from '@/lib/utils'
import { Choice, Range } from '../common/controls'
import { canvasBlob } from '../common/files'
import type { ImageFormat } from '../common/files'
import { DownloadNote, DownloadProgress, useCached } from '../common/model'
import type { Download } from '../common/model'
import { Painter } from './Painter'
import type { PainterHandle } from './Painter'
import { PRESETS } from './presets'
import type { InpaintSlug } from './presets'

const FILES = [...runtimeFiles('wasm'), INPAINT_MODEL]
const FORMATS: { value: ImageFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
]
const EXT: Record<ImageFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' }

function toCanvas(image: ImageBitmap): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = image.width
  c.height = image.height
  c.getContext('2d')?.drawImage(image, 0, 0)
  return c
}

export default function InpaintTool({ slug }: { slug: InpaintSlug }) {
  const preset = PRESETS[slug]
  const [cached, markCached] = useCached(FILES)
  const [file, setFile] = useState<File | null>(null)
  const [image, setImage] = useState<ImageBitmap | null>(null)
  const [history, setHistory] = useState<ImageBitmap[]>([])
  const [brush, setBrush] = useState(36)
  const [empty, setEmpty] = useState(true)
  const [format, setFormat] = useState<ImageFormat>('png')
  const [download, setDownload] = useState<Download | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const painter = useRef<PainterHandle>(null)

  async function onFiles(list: File[]) {
    const f = list[0]
    if (!f) return
    setError(null)
    try {
      const { bitmap } = await decodeImage(f)
      setFile(f)
      setImage(bitmap)
      setHistory([])
      setNote('')
      if (preset.findText) void findText(bitmap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This image could not be read.')
    }
  }

  async function findText(source: ImageBitmap) {
    setBusy('Finding text')
    try {
      await loadOcr((loaded, total) => setDownload({ loaded, total }))
      setDownload(null)
      setBusy('Finding text')
      // Single marks such as dots and bullets read as letters; keep real words only.
      const words = (await readImage(toCanvas(source), undefined, 60)).filter((w) => /[\p{L}\p{N}]{2,}/u.test(w.text) || w.confidence >= 90)
      const boxes = words.map((w) => {
        const pad = Math.max(3, w.h * 0.3)
        return { x: w.x - pad, y: w.y - pad, w: w.w + 2 * pad, h: w.h + 2 * pad }
      })
      painter.current?.addBoxes(boxes)
      setNote(boxes.length ? `${boxes.length} ${boxes.length === 1 ? 'word was' : 'words were'} found and marked.` : 'No text was found. Paint over the text by hand.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The text finder could not start.')
    } finally {
      setDownload(null)
      setBusy(null)
    }
  }

  async function remove() {
    if (!image || !painter.current || painter.current.isEmpty()) return
    setError(null)
    try {
      if (!cached) setDownload({ loaded: 0, total: inpaintDownloadBytes() })
      await inpainter.call('load', {}, { onProgress: (loaded, total) => setDownload({ loaded, total }) })
      setDownload(null)
      markCached()
      setBusy('Filling the area')
      const mask = painter.current.mask()
      const copy = await createImageBitmap(image)
      const out = await inpainter.call('fill', { image: copy, mask }, { transfer: [copy, mask.buffer] })
      const next = await createImageBitmap(new ImageData(out.pixels as Uint8ClampedArray<ArrayBuffer>, out.width, out.height))
      setHistory((h) => [...h, image])
      setImage(next)
      painter.current.clear()
      setNote('Done. Paint again to remove more, or download the photo.')
    } catch (err) {
      if (!isAbort(err)) setError(err instanceof Error ? err.message : 'The model stopped.')
    } finally {
      setDownload(null)
      setBusy(null)
    }
  }

  function undo() {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    setImage(prev)
  }

  function reset() {
    setFile(null)
    setImage(null)
    setHistory([])
    setBlob(null)
    setError(null)
    setNote('')
  }

  // The download is the current photo once something was removed.
  useEffect(() => {
    let live = true
    setBlob(null)
    if (!image || history.length === 0) return
    void canvasBlob(toCanvas(image), format).then((b) => live && setBlob(b))
    return () => {
      live = false
    }
  }, [image, history.length, format])

  if (!file || !image) {
    return (
      <div className="space-y-3">
        <FileDropzone accept={IMAGE_ACCEPT} onFiles={(f) => void onFiles(f)} maxSizeMb={60} title="Drop a photo here" hint="JPG, PNG, WebP or AVIF." />
        <DownloadNote bytes={inpaintDownloadBytes() + (preset.findText ? ocrDownloadBytes() : 0)} cached={cached} />
        {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ToolPanel title={file.name} description={preset.hint}>
          <Painter ref={painter} image={image} brush={brush} onChange={setEmpty} />
          {download && <DownloadProgress download={download} what={busy === 'Finding text' ? 'the text finder' : 'the model'} />}
          {busy && !download && <ProgressPanel label={busy} />}
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {note}
          </p>
        </ToolPanel>
        <ToolPanel
          title="Options"
          footer={
            <div className="flex w-full flex-col gap-2">
              <Button size="lg" className="w-full" disabled={empty || busy !== null} onClick={() => void remove()}>
                <Eraser aria-hidden="true" /> Remove
              </Button>
              <DownloadButton blob={blob} filename={`${stripExtension(file.name)}${preset.suffix}.${EXT[format]}`} label="Download" size="lg" variant="secondary" className="w-full" />
              <Button variant="ghost" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Other photo
              </Button>
            </div>
          }
        >
          <Range label="Brush size" value={brush} min={8} max={120} step={2} onChange={setBrush} format={(v) => `${v} px`} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={empty} onClick={() => painter.current?.undo()}>
              <Undo2 aria-hidden="true" /> Undo stroke
            </Button>
            <Button variant="secondary" size="sm" disabled={empty} onClick={() => painter.current?.clear()}>
              Clear marks
            </Button>
            <Button variant="secondary" size="sm" disabled={history.length === 0 || busy !== null} onClick={undo}>
              <Undo2 aria-hidden="true" /> Undo removal
            </Button>
            <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void findText(image)}>
              <ScanText aria-hidden="true" /> Find text
            </Button>
          </div>
          <Choice label="Format" value={format} options={FORMATS} onChange={setFormat} />
        </ToolPanel>
      </div>
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
    </div>
  )
}
