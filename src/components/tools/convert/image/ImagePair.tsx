/**
 * Island for every image pair page (heic-to-jpg, tiff-to-pdf, png-to-svg …). Drop files,
 * they convert at once with the settings shown; change a setting and convert again.
 * Several outputs download one by one or as a ZIP.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { FileImage, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ImagePreview } from '@/components/shared/ImagePreview'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, nextFrame, stripExtension } from '@/lib/utils'
import type { InFormat, OutFormat } from '@/lib/convert/image/formats'
import { rasteriseSvg } from '@/components/tools/image-convert/_svg'
import { createImageClient, type ImageClient } from './client'
import type { ImageOptions, ImageSource } from './engine'

export interface ImagePairProps {
  from: InFormat
  to: OutFormat
  fromLabel: string
  toLabel: string
  accept: string
}

interface Done {
  id: string
  input: string
  inputSize: number
  name: string
  blob: Blob
  width: number
  height: number
  note?: string
}

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const PREVIEWABLE = new Set<OutFormat>(['jpg', 'png', 'webp', 'avif', 'gif', 'bmp', 'ico', 'svg'])

function defaults(from: InFormat, to: OutFormat): ImageOptions {
  return {
    target: to,
    quality: to === 'jpg' ? 85 : to === 'webp' ? 80 : to === 'avif' ? 60 : 85,
    lossless: false,
    background: to === 'jpg' ? '#ffffff' : null,
    gifColors: 256,
    icoSizes: [16, 32, 48, 64, 128, 256],
    traceColors: from === 'jpg' ? 8 : 16,
    traceDetail: 'medium',
    keepAnimation: true,
    passThroughJpeg: from === 'jfif',
    pdfPage: 'image',
  }
}

function uniqueName(stem: string, ext: string, used: Set<string>): string {
  let name = `${stem || 'image'}.${ext}`
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${stem}-${n}.${ext}`
  used.add(name.toLowerCase())
  return name
}

export default function ImagePair({ from, to, fromLabel, toLabel, accept }: ImagePairProps) {
  const uid = useId()
  const [opts, setOpts] = useState<ImageOptions>(() => defaults(from, to))
  const [svgWidth, setSvgWidth] = useState(to === 'ico' ? '256' : '1024')
  const [files, setFiles] = useState<File[]>([])
  const [done, setDone] = useState<Done[]>([])
  const [failed, setFailed] = useState<{ input: string; error: string }[]>([])
  const [progress, setProgress] = useState<{ index: number; total: number; name: string } | null>(null)
  const [usedKey, setUsedKey] = useState('')
  const [zip, setZip] = useState<Blob | null>(null)
  const clientRef = useRef<ImageClient | null>(null)
  const runRef = useRef(0)

  useEffect(() => () => clientRef.current?.dispose(), [])

  const set = <K extends keyof ImageOptions>(key: K, value: ImageOptions[K]) => setOpts((o) => ({ ...o, [key]: value }))
  const settingsKey = JSON.stringify([opts, svgWidth])

  const convert = useCallback(
    async (list: File[]) => {
      if (!list.length) return
      const run = ++runRef.current
      clientRef.current ??= createImageClient()
      const client = clientRef.current
      setDone([])
      setFailed([])
      setZip(null)
      setUsedKey(settingsKey)
      const used = new Set<string>()
      const results: Done[] = []
      for (let i = 0; i < list.length; i++) {
        const file = list[i]
        if (!file) continue
        if (run !== runRef.current) return
        setProgress({ index: i, total: list.length, name: file.name })
        await nextFrame()
        try {
          let source: ImageSource
          if (from === 'svg' || /\.svg$/i.test(file.name) || file.type === 'image/svg+xml') {
            const w = Math.max(1, Math.min(8192, Number(svgWidth) || 1024))
            const r = await rasteriseSvg(await file.text(), { mode: 'width', width: w, height: w, scale: 1 })
            source = { kind: 'pixels', data: r.pixels.data, width: r.width, height: r.height }
          } else {
            source = { kind: 'bytes', bytes: await file.arrayBuffer(), mime: file.type }
          }
          const result = await client.run(source, opts)
          for (const o of result.outputs) {
            const stem = stripExtension(file.name) + (o.part ? `-${o.part}` : '')
            const blob = new Blob([o.bytes], { type: o.mime })
            const item: Done = {
              id: `${i}-${o.part ?? 0}`,
              input: file.name,
              inputSize: file.size,
              name: uniqueName(stem, o.ext, used),
              blob,
              width: o.width,
              height: o.height,
              note: result.note,
            }
            results.push(item)
            if (run === runRef.current) setDone([...results])
          }
        } catch (err) {
          if (run !== runRef.current) return
          setFailed((f) => [...f, { input: file.name, error: err instanceof Error ? err.message : String(err) }])
        }
      }
      if (run !== runRef.current) return
      if (to === 'pdf' && results.length > 1) {
        // One document: the pages of every file, in the order the files were added.
        setProgress({ index: list.length, total: list.length, name: 'Joining the pages' })
        const { PDFDocument } = await import('pdf-lib')
        const merged = await PDFDocument.create()
        for (const r of results) {
          const doc = await PDFDocument.load(await r.blob.arrayBuffer())
          for (const page of await merged.copyPages(doc, doc.getPageIndices())) merged.addPage(page)
        }
        const bytes = await merged.save()
        const one: Done = {
          id: 'merged',
          input: `${list.length} files`,
          inputSize: list.reduce((n, f) => n + f.size, 0),
          name: `${stripExtension(list[0]?.name ?? 'images')}-and-${list.length - 1}-more.pdf`,
          blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
          width: 0,
          height: 0,
          note: `${merged.getPageCount()} pages`,
        }
        results.splice(0, results.length, one)
        setDone([one])
      }
      setProgress(null)
      if (results.length > 1) {
        const { zipSync } = await import('fflate')
        const entries: Record<string, Uint8Array> = {}
        for (const r of results) entries[r.name] = new Uint8Array(await r.blob.arrayBuffer())
        setZip(new Blob([zipSync(entries, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }))
      }
    },
    [from, to, opts, settingsKey, svgWidth],
  )

  const onFiles = (list: File[]) => {
    setFiles(list)
    void convert(list)
  }

  const reset = () => {
    runRef.current++
    setFiles([])
    setDone([])
    setFailed([])
    setZip(null)
    setProgress(null)
  }

  const stale = files.length > 0 && !progress && usedKey !== settingsKey
  const totalIn = useMemo(() => files.reduce((n, f) => n + f.size, 0), [files])
  const totalOut = useMemo(() => done.reduce((n, d) => n + d.blob.size, 0), [done])
  const lossy = to === 'jpg' || to === 'webp' || to === 'avif' || to === 'pdf'

  return (
    <div className="space-y-6">
      <ToolPanel title="Settings" description={`Files convert as soon as you add them. ${fromLabel} files are decoded and ${toLabel} files are written on this device.`}>
        <div className="grid gap-5 sm:grid-cols-2">
          {lossy && !(to === 'webp' && opts.lossless) ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor={`${uid}-q`}>Quality</Label>
                <span className="num text-sm text-muted-foreground">{opts.quality}</span>
              </div>
              <Slider id={`${uid}-q`} min={10} max={100} step={1} value={[opts.quality]} onValueChange={(v) => set('quality', v[0] ?? 85)} aria-label="Quality" />
              <p className="text-sm text-muted-foreground">75 to 90 looks the same as the original for most photos.</p>
            </div>
          ) : null}
          {to === 'webp' ? (
            <div className="flex items-center gap-2 self-start pt-6">
              <Switch id={`${uid}-ll`} checked={opts.lossless} onCheckedChange={(v) => set('lossless', v)} />
              <Label htmlFor={`${uid}-ll`}>Lossless</Label>
            </div>
          ) : null}
          {to === 'jpg' || to === 'pdf' ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-bg`}>Background for transparent areas</Label>
              <div className="flex items-center gap-2">
                <input
                  id={`${uid}-bg`}
                  type="color"
                  className="h-10 w-14 cursor-pointer rounded-md bg-background"
                  value={opts.background ?? '#ffffff'}
                  onChange={(e) => set('background', e.target.value)}
                />
                <span className="num text-sm text-muted-foreground">{opts.background ?? '#ffffff'}</span>
              </div>
            </div>
          ) : ['png', 'webp', 'gif', 'bmp', 'tiff', 'ico', 'svg'].includes(to) ? (
            <div className="flex items-center gap-2 self-start pt-6">
              <Switch id={`${uid}-fill`} checked={opts.background !== null} onCheckedChange={(v) => set('background', v ? '#ffffff' : null)} />
              <Label htmlFor={`${uid}-fill`}>Fill transparent areas with white</Label>
            </div>
          ) : null}
          {to === 'gif' ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor={`${uid}-gc`}>Colours</Label>
                <span className="num text-sm text-muted-foreground">{opts.gifColors}</span>
              </div>
              <Slider id={`${uid}-gc`} min={2} max={256} step={1} value={[opts.gifColors]} onValueChange={(v) => set('gifColors', v[0] ?? 256)} aria-label="Colours" />
              <p className="text-sm text-muted-foreground">GIF holds at most 256 colours. Fewer colours give a smaller file.</p>
            </div>
          ) : null}
          {(to === 'gif' || to === 'webp') && (from === 'gif' || from === 'webp') ? (
            <div className="flex items-center gap-2 self-start pt-6">
              <Switch id={`${uid}-anim`} checked={opts.keepAnimation} onCheckedChange={(v) => set('keepAnimation', v)} />
              <Label htmlFor={`${uid}-anim`}>Keep the animation</Label>
            </div>
          ) : null}
          {to === 'svg' ? (
            <>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor={`${uid}-tc`}>Colours in the drawing</Label>
                  <span className="num text-sm text-muted-foreground">{opts.traceColors}</span>
                </div>
                <Slider id={`${uid}-tc`} min={2} max={64} step={1} value={[opts.traceColors]} onValueChange={(v) => set('traceColors', v[0] ?? 16)} aria-label="Colours in the drawing" />
                <p className="text-sm text-muted-foreground">2 for a black and white logo, 8 to 16 for flat art.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-td`}>Detail</Label>
                <Select value={opts.traceDetail} onValueChange={(v) => set('traceDetail', v as ImageOptions['traceDetail'])}>
                  <SelectTrigger id={`${uid}-td`} className="w-full sm:w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low: smooth shapes, small file</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High: more points, larger file</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
          {to === 'pdf' ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-[560]">Page size</legend>
              <RadioGroup value={opts.pdfPage} onValueChange={(v) => set('pdfPage', v as ImageOptions['pdfPage'])} className="flex flex-wrap gap-x-5 gap-y-2">
                {(
                  [
                    ['image', 'Same as the image'],
                    ['a4', 'A4'],
                    ['letter', 'US Letter'],
                  ] as const
                ).map(([value, label]) => (
                  <div key={value} className="flex items-center gap-2">
                    <RadioGroupItem id={`${uid}-pg-${value}`} value={value} />
                    <Label htmlFor={`${uid}-pg-${value}`}>{label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>
          ) : null}
          {from === 'svg' ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-sw`}>Width in pixels</Label>
              <Input id={`${uid}-sw`} inputMode="numeric" className="num w-[160px]" value={svgWidth} onChange={(e) => setSvgWidth(e.target.value.replace(/\D/g, ''))} />
            </div>
          ) : null}
          {from === 'jfif' && to === 'jpg' ? (
            <div className="flex items-center gap-2 self-start">
              <Switch id={`${uid}-pt`} checked={!opts.passThroughJpeg} onCheckedChange={(v) => set('passThroughJpeg', !v)} />
              <Label htmlFor={`${uid}-pt`}>Re-encode (off: rename only, no quality loss)</Label>
            </div>
          ) : null}
        </div>
        {to === 'ico' ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-[560]">Icon sizes</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {ICO_SIZES.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <Checkbox
                    id={`${uid}-ico-${s}`}
                    checked={opts.icoSizes.includes(s)}
                    onCheckedChange={(v) => set('icoSizes', v === true ? [...opts.icoSizes, s].sort((a, b) => a - b) : opts.icoSizes.filter((x) => x !== s))}
                  />
                  <Label htmlFor={`${uid}-ico-${s}`} className="num">
                    {s} × {s}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
        ) : null}
      </ToolPanel>

      {files.length === 0 ? (
        <FileDropzone accept={accept} multiple onFiles={onFiles} maxSizeMb={300} title={`Drop ${fromLabel} files here`} hint="or click to browse. You can add several at once." />
      ) : null}

      {to === 'ico' && opts.icoSizes.length === 0 ? <ErrorNote title="No sizes" message="Pick at least one icon size." /> : null}

      <div role="status" aria-live="polite" className="space-y-4">
        {progress ? (
          <ProgressPanel
            label={`Converting ${progress.index + 1} of ${progress.total}`}
            sublabel={progress.name}
            value={(progress.index / progress.total) * 100}
          />
        ) : null}

        {failed.map((f) => (
          <ErrorNote key={f.input} title={`${f.input} was not converted`} message={f.error} />
        ))}

        {done.length > 0 ? (
          <ToolPanel
            title={done.length === 1 ? 'Your file' : `${done.length} files`}
            description={
              totalIn > 0 && !progress
                ? `${formatBytes(totalIn)} in, ${formatBytes(totalOut)} out${done[0]?.note ? `. ${done[0].note}` : '.'}`
                : undefined
            }
            footer={
              <>
                {zip ? <DownloadButton blob={zip} filename={`${to}-files.zip`} label="Download all (ZIP)" /> : null}
                {stale ? (
                  <Button type="button" onClick={() => void convert(files)}>
                    Convert again with these settings
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" onClick={reset}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Convert other files
                </Button>
              </>
            }
          >
            <ul className="space-y-3">
              {done.map((d) => (
                <li key={d.id} className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-lg bg-background p-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto]">
                  <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                    {PREVIEWABLE.has(to) ? (
                      <ImagePreview file={d.blob} alt={`Preview of ${d.name}`} className="max-h-16 rounded-none bg-transparent" />
                    ) : (
                      <FileImage className="size-6 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-[600]">{d.name}</p>
                    <p className="num text-sm text-muted-foreground">
                      {formatBytes(d.inputSize)} → {formatBytes(d.blob.size)}
                      {d.width > 0 ? ` · ${d.width} × ${d.height}` : ''}
                    </p>
                  </div>
                  <DownloadButton
                    blob={d.blob}
                    filename={d.name}
                    label="Download"
                    variant={done.length > 1 ? 'secondary' : 'default'}
                    className="col-span-2 sm:col-span-1"
                  />
                </li>
              ))}
            </ul>
          </ToolPanel>
        ) : null}
      </div>
    </div>
  )
}
