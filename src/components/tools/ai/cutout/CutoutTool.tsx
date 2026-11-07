/**
 * Background tools: finds the subject of each photo with a model on this device, then builds
 * the result (transparent, colour, blur or picture background; frame; outline; shadow) in the
 * page, so a change of option shows at once without running the model again.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { IMAGE_ACCEPT, decodeImage } from '@/components/tools/image-edit/image-utils'
import { cutout } from '@/lib/ml/cutout/client'
import { CUTOUT_MODEL, cutoutDownloadBytes } from '@/lib/ml/cutout/models'
import { detectHardware } from '@/lib/ml/runtime/backend'
import { runtimeFiles } from '@/lib/ml/runtime/runtime'
import { isAbort } from '@/lib/ml/runtime/rpc'
import { downloadBlob, stripExtension } from '@/lib/utils'
import { Compare } from '../common/compare'
import { Choice, ColorPick, Range } from '../common/controls'
import { DownloadNote, DownloadProgress, hardwareNote, useCached, useHardware } from '../common/model'
import type { Download } from '../common/model'
import { canvasBlob, zipBlobs } from '../common/files'
import { compose, coverage, maskToAlpha, subjectBox } from './compose'
import type { Background, Box } from './compose'
import { PRESETS, SWATCHES } from './presets'
import type { BackgroundKind, CutoutSlug, Format, Settings } from './presets'

interface Item {
  file: File
  photo: ImageBitmap
  original: Blob
  alpha?: HTMLCanvasElement
  box?: Box | null
  empty?: boolean
  error?: string
}

const BACKGROUNDS: { value: BackgroundKind; label: string }[] = [
  { value: 'transparent', label: 'None' },
  { value: 'color', label: 'Colour' },
  { value: 'blur', label: 'Blur' },
  { value: 'image', label: 'Picture' },
]
const FRAMES: { value: Settings['frame']; label: string }[] = [
  { value: 'original', label: 'Photo' },
  { value: 'subject', label: 'Subject' },
  { value: 'square', label: 'Square' },
  { value: 'circle', label: 'Circle' },
]
const FORMATS: { value: Format; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
]
const EXT: Record<Format, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' }

export default function CutoutTool({ slug }: { slug: CutoutSlug }) {
  const preset = PRESETS[slug]
  const hw = useHardware()
  const modelFiles = useMemo(() => (hw ? [...runtimeFiles(hw.backend), CUTOUT_MODEL.path] : null), [hw])
  const [cached, markCached] = useCached(modelFiles)
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState(0)
  const [settings, setSettings] = useState<Settings>(preset.settings)
  const [bgImage, setBgImage] = useState<ImageBitmap | null>(null)
  const [download, setDownload] = useState<Download | null>(null)
  const [working, setWorking] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; width: number; height: number } | null>(null)
  const [zipping, setZipping] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bgInput = useRef<HTMLInputElement>(null)

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }))
  const current = items[selected]

  async function onFiles(files: File[]) {
    setError(null)
    const decoded: Item[] = []
    for (const file of files) {
      try {
        const { bitmap } = await decodeImage(file)
        decoded.push({ file, photo: bitmap, original: file })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'This image could not be read.')
      }
    }
    if (!decoded.length) return
    setItems((prev) => [...prev, ...decoded])
    setSelected(items.length)
    void run([...items, ...decoded])
  }

  async function run(list: Item[]) {
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort
    try {
      const hw = await detectHardware()
      if (!cached) setDownload({ loaded: 0, total: cutoutDownloadBytes(hw) })
      await cutout.call('load', { hw }, { signal: abort.signal, onProgress: (loaded, total) => setDownload({ loaded, total }) })
      setDownload(null)
      markCached()
      const todo = list.flatMap((it, i) => (it.alpha || it.error ? [] : [i]))
      for (const [n, i] of todo.entries()) {
        setWorking({ done: n, total: todo.length })
        const image = await createImageBitmap(list[i].photo)
        try {
          const { mask, size } = await cutout.call('mask', { hw, image }, { signal: abort.signal, transfer: [image] })
          const { width: w, height: h } = list[i].photo
          const patch: Partial<Item> = { alpha: maskToAlpha(mask, size, w, h), box: subjectBox(mask, size, w, h), empty: coverage(mask) < 0.002 }
          list[i] = { ...list[i], ...patch }
        } catch (err) {
          if (isAbort(err)) throw err
          list[i] = { ...list[i], error: err instanceof Error ? err.message : 'The model stopped.' }
        }
        setItems([...list])
      }
    } catch (err) {
      if (!isAbort(err)) setError(err instanceof Error ? err.message : 'The model could not start.')
    } finally {
      if (abortRef.current === abort) {
        setDownload(null)
        setWorking(null)
      }
    }
  }

  function stop() {
    abortRef.current?.abort()
    cutout.terminate()
    setDownload(null)
    setWorking(null)
  }

  function reset() {
    stop()
    for (const it of items) it.photo.close()
    setItems([])
    setSelected(0)
    setResult(null)
    setError(null)
  }

  const background = (s: Settings): Background => {
    if (s.background === 'color') return { kind: 'color', color: s.color }
    if (s.background === 'blur') return { kind: 'blur', strength: s.blur }
    if (s.background === 'image' && bgImage) return { kind: 'image', image: bgImage }
    return { kind: 'transparent' }
  }

  async function render(item: Item, s: Settings): Promise<{ blob: Blob; width: number; height: number } | null> {
    if (!item.alpha) return null
    const canvas = compose(item.photo, item.alpha, item.box ?? null, { ...s, background: background(s) })
    return { blob: await canvasBlob(canvas, s.format), width: canvas.width, height: canvas.height }
  }

  // The preview follows the options.
  useEffect(() => {
    let live = true
    setResult(null)
    if (!current?.alpha) return
    const t = window.setTimeout(() => {
      void render(current, settings)
        .then((b) => live && setResult(b))
        .catch((err: unknown) => live && setError(err instanceof Error ? err.message : 'The result could not be drawn.'))
    }, 60)
    return () => {
      live = false
      window.clearTimeout(t)
    }
    // render reads bgImage through background().
  }, [current, settings, bgImage])

  async function downloadAll() {
    setZipping(true)
    try {
      const files: { name: string; blob: Blob }[] = []
      for (const it of items) {
        const out = await render(it, settings)
        if (out) files.push({ name: `${stripExtension(it.file.name)}${preset.suffix}.${EXT[settings.format]}`, blob: out.blob })
      }
      downloadBlob(await zipBlobs(files), 'images.zip')
    } finally {
      setZipping(false)
    }
  }

  async function onBgFile(file: File | undefined) {
    if (!file) return
    try {
      const { bitmap } = await decodeImage(file)
      setBgImage(bitmap)
      set('background', 'image')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This picture could not be read.')
    }
  }

  const show = (c: (typeof preset.controls)[number]) => (preset.controls as readonly string[]).includes(c)
  const transparentOut = settings.background === 'transparent' || (settings.background === 'image' && !bgImage) || settings.frame === 'circle'
  const doneCount = items.filter((i) => i.alpha).length

  if (!items.length) {
    return (
      <div className="space-y-3">
        <FileDropzone accept={IMAGE_ACCEPT} multiple onFiles={(f) => void onFiles(f)} maxSizeMb={60} title="Drop photos here" hint="JPG, PNG, WebP or AVIF. Several at once is fine." />
        <DownloadNote bytes={hw ? cutoutDownloadBytes(hw) : 0} cached={cached} />
        {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ToolPanel
          title={current ? current.file.name : 'Result'}
          description={current ? `${current.photo.width} x ${current.photo.height} px. ${hardwareNote(hw)}` : undefined}
        >
          {download && <DownloadProgress download={download} />}
          {working && !download && (
            <ProgressPanel
              label={working.total > 1 ? `Finding the subject: photo ${working.done + 1} of ${working.total}` : 'Finding the subject'}
              value={working.total > 1 ? (working.done / working.total) * 100 : undefined}
            />
          )}
          {(download || working) && (
            <Button variant="secondary" onClick={stop}>
              <Square aria-hidden="true" /> Stop
            </Button>
          )}
          {current?.error && <ErrorNote message={current.error} />}
          {current?.empty && <p className="text-sm">No clear subject was found in this photo. Try a photo where one person or object stands out.</p>}
          {current && (settings.frame === 'original' || !result) && (
            <Compare before={current.original} after={result?.blob ?? null} width={current.photo.width} height={current.photo.height} checker={transparentOut} />
          )}
          {current && settings.frame !== 'original' && result && (
            <Compare before={null} after={result.blob} width={result.width} height={result.height} checker={transparentOut} />
          )}
          {items.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Photos">
              {items.map((it, i) => (
                <button
                  key={`${it.file.name}-${i}`}
                  type="button"
                  role="listitem"
                  aria-label={`Show ${it.file.name}`}
                  aria-current={i === selected}
                  onClick={() => setSelected(i)}
                  className={`relative size-16 shrink-0 overflow-hidden rounded-md bg-background ${i === selected ? 'ring-2 ring-ring' : ''}`}
                >
                  <Thumb blob={it.original} />
                  {!it.alpha && !it.error && <span className="absolute inset-0 bg-background/60" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </ToolPanel>

        <ToolPanel
          title="Options"
          footer={
            <div className="flex w-full flex-col gap-2">
              <DownloadButton
                blob={result?.blob ?? null}
                filename={current ? `${stripExtension(current.file.name)}${preset.suffix}.${EXT[settings.format]}` : 'image.png'}
                label={`Download ${FORMATS.find((f) => f.value === settings.format)?.label}`}
                size="lg"
                className="w-full"
              />
              {items.length > 1 && (
                <Button variant="secondary" size="lg" className="w-full" disabled={zipping || doneCount < items.length} onClick={() => void downloadAll()}>
                  {zipping ? 'Making ZIP' : `Download all ${items.length} (ZIP)`}
                </Button>
              )}
              <label className="w-full">
                <span className="sr-only">Add photos</span>
                <Button variant="ghost" className="w-full" asChild>
                  <span>
                    <ImagePlus aria-hidden="true" /> Add photos
                    <input type="file" accept={IMAGE_ACCEPT} multiple className="sr-only" onChange={(e) => void onFiles([...(e.target.files ?? [])])} />
                  </span>
                </Button>
              </label>
              <Button variant="ghost" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Start over
              </Button>
            </div>
          }
        >
          {show('background') && <Choice label="Background" value={settings.background} options={BACKGROUNDS} onChange={(v) => (v === 'image' && !bgImage ? bgInput.current?.click() : set('background', v))} />}
          {show('background') && settings.background === 'color' && <ColorPick label="Background colour" value={settings.color} swatches={SWATCHES} onChange={(v) => set('color', v)} />}
          {settings.background === 'blur' && (
            <Range label="Blur" value={Math.round(settings.blur * 1000)} min={4} max={60} step={1} onChange={(v) => set('blur', v / 1000)} format={(v) => `${v}`} />
          )}
          {show('background') && settings.background === 'image' && (
            <Button variant="secondary" size="sm" onClick={() => bgInput.current?.click()}>
              Choose another picture
            </Button>
          )}
          <input ref={bgInput} type="file" accept={IMAGE_ACCEPT} className="sr-only" tabIndex={-1} aria-label="Background picture" onChange={(e) => void onBgFile(e.target.files?.[0])} />
          {show('frame') && <Choice label="Frame" value={settings.frame} options={FRAMES} onChange={(v) => set('frame', v)} />}
          {settings.frame !== 'original' && (
            <Range label="Space around" value={Math.round(settings.margin * 100)} min={0} max={40} step={1} onChange={(v) => set('margin', v / 100)} format={(v) => `${v}%`} />
          )}
          {show('outline') && (
            <>
              <Range label="Outline" value={Math.round(settings.outline * 1000)} min={0} max={80} step={2} onChange={(v) => set('outline', v / 1000)} format={(v) => (v ? `${v / 10}%` : 'none')} />
              {settings.outline > 0 && <ColorPick label="Outline colour" value={settings.outlineColor} swatches={SWATCHES} onChange={(v) => set('outlineColor', v)} />}
            </>
          )}
          {show('shadow') && (
            <div className="flex items-center gap-2.5">
              <Checkbox id={`${slug}-shadow`} checked={settings.shadow} onCheckedChange={(v) => set('shadow', v === true)} />
              <Label htmlFor={`${slug}-shadow`} className="font-normal">
                Soft shadow under the subject
              </Label>
            </div>
          )}
          {show('size') && (
            <Choice
              label="Size"
              value={String(settings.maxSide)}
              options={[
                { value: '512', label: '512' },
                { value: '1024', label: '1024' },
                { value: '2000', label: '2000' },
                { value: '0', label: 'Full' },
              ]}
              onChange={(v) => set('maxSide', Number(v))}
            />
          )}
          <Choice label="Format" value={settings.format} options={FORMATS} onChange={(v) => set('format', v)} />
          {settings.format === 'jpeg' && transparentOut && <p className="text-[0.8125rem] text-muted-foreground">JPG has no transparency, so the empty parts become white.</p>}
        </ToolPanel>
      </div>
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
    </div>
  )
}

function Thumb({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url ? <img src={url} alt="" className="size-full object-cover" /> : null
}
