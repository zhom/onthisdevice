import { useId, useMemo, useState } from 'react'
import { CircleCheck, FileWarning } from 'lucide-react'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatBytes, stripExtension } from '@/lib/utils'
import { readMeta, sniff, stripMeta } from './meta-read'
import type { Field, MetaKind } from './meta-read'

const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.pdf,.docx,.xlsx,.pptx,.docm,.xlsm,.pptm,.mp4,.mov,.m4v,.m4a,.3gp'

const KIND_NAMES: Record<MetaKind, string> = {
  jpeg: 'JPEG photo',
  png: 'PNG image',
  webp: 'WebP image',
  heif: 'HEIC photo',
  video: 'Video',
  pdf: 'PDF',
  office: 'Office document',
}

const MIME: Record<MetaKind, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heif: 'image/heic',
  video: 'video/mp4',
  pdf: 'application/pdf',
  office: 'application/octet-stream',
}

interface Item {
  file: File
  kind: MetaKind | null
  before: Field[]
  after: Field[] | null
  out: Blob | null
  error: string | null
}

function outName(name: string): string {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
  return `${stripExtension(name)}-clean${ext}`
}

function Fields({ fields, empty }: { fields: Field[]; empty: string }) {
  if (fields.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm">
      {fields.slice(0, 14).map((f, i) => (
        <div key={i} className="contents">
          <dt className="text-muted-foreground">{f.label}</dt>
          <dd className="truncate text-foreground" title={f.value}>
            {f.value}
          </dd>
        </div>
      ))}
      {fields.length > 14 ? <dd className="col-span-2 text-muted-foreground">and {fields.length - 14} more</dd> : null}
    </dl>
  )
}

export function RemoveMetadata() {
  const id = useId()
  const [items, setItems] = useState<Item[]>([])
  const [keepIcc, setKeepIcc] = useState(true)
  const [keepOrientation, setKeepOrientation] = useState(true)
  const [progress, setProgress] = useState<{ label: string; value: number } | null>(null)
  const [zip, setZip] = useState<Blob | null>(null)

  const run = async (files: File[]) => {
    setZip(null)
    const next: Item[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress({ label: `Cleaning ${file.name} (${i + 1} of ${files.length})`, value: (i / files.length) * 100 })
      const item: Item = { file, kind: null, before: [], after: null, out: null, error: null }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const kind = sniff(bytes, file.name)
        item.kind = kind
        if (!kind) throw new Error('This file type is not supported. Use JPEG, PNG, WebP, HEIC, PDF, Word, Excel, PowerPoint, MP4 or MOV.')
        item.before = await readMeta(bytes, kind)
        const clean = await stripMeta(bytes, kind, { keepIcc, keepOrientation })
        item.after = await readMeta(clean, kind)
        item.out = new Blob([clean.slice().buffer as ArrayBuffer], { type: file.type || MIME[kind] })
      } catch (err) {
        item.error = err instanceof Error ? err.message : 'This file could not be cleaned.'
      }
      next.push(item)
      setItems([...next])
    }
    const done = next.filter((x) => x.out)
    if (done.length > 1) {
      setProgress({ label: 'Making the ZIP file', value: 99 })
      const { zipSync } = await import('fflate')
      const entries: Record<string, Uint8Array> = {}
      for (const x of done) entries[outName(x.file.name)] = new Uint8Array(await x.out!.arrayBuffer())
      setZip(new Blob([zipSync(entries, { level: 0 }).slice().buffer as ArrayBuffer], { type: 'application/zip' }))
    }
    setProgress(null)
  }

  const totals = useMemo(() => {
    const before = items.reduce((n, x) => n + x.before.length, 0)
    const after = items.reduce((n, x) => n + (x.after?.length ?? 0), 0)
    return { before, after }
  }, [items])

  return (
    <div className="space-y-4">
      <FileDropzone
        accept={ACCEPT}
        multiple
        onFiles={(files) => void run(files)}
        maxSizeMb={4000}
        title="Drop photos, PDFs, Office files or videos"
        hint="Several at once is fine. Files stay on your device."
        disabled={Boolean(progress)}
      />

      <ToolPanel title="Options">
        <div className="flex items-center gap-2">
          <Switch id={`${id}-icc`} checked={keepIcc} onCheckedChange={setKeepIcc} />
          <Label htmlFor={`${id}-icc`} className="text-sm font-normal">
            Keep the color profile of photos, so colors stay the same
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id={`${id}-rot`} checked={keepOrientation} onCheckedChange={setKeepOrientation} />
          <Label htmlFor={`${id}-rot`} className="text-sm font-normal">
            Keep the rotation of photos, so they stay upright
          </Label>
        </div>
        {items.length > 0 ? (
          <p className="text-xs text-muted-foreground">Changed options apply to the next files you drop.</p>
        ) : null}
      </ToolPanel>

      {progress ? <ProgressPanel label={progress.label} value={progress.value} /> : null}

      {items.length > 0 ? (
        <ToolPanel
          title="Result"
          description={`${items.length} ${items.length === 1 ? 'file' : 'files'}. ${totals.before} metadata ${totals.before === 1 ? 'field' : 'fields'} found, ${totals.after} left.`}
          footer={
            <>
              {zip ? <DownloadButton blob={zip} filename="clean-files.zip" label="Download all (.zip)" /> : null}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setItems([])
                  setZip(null)
                }}
              >
                Clear
              </Button>
            </>
          }
        >
          <ul className="space-y-3">
            {items.map((x, i) => (
              <li key={`${x.file.name}-${i}`} className="space-y-3 rounded-lg bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-[600] text-foreground" title={x.file.name}>
                      {x.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {x.kind ? KIND_NAMES[x.kind] : 'Unknown type'}, {formatBytes(x.file.size)}
                      {x.out ? ` to ${formatBytes(x.out.size)}` : ''}
                    </p>
                  </div>
                  {x.out ? <DownloadButton blob={x.out} filename={outName(x.file.name)} label="Download" size="sm" variant="secondary" /> : null}
                </div>
                {x.error ? (
                  <ErrorNote title="Not cleaned" message={x.error} />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <h3 className="flex items-center gap-1.5 text-sm font-[600] text-foreground">
                        <FileWarning className="size-4" aria-hidden="true" />
                        Before
                      </h3>
                      <Fields fields={x.before} empty="No metadata found." />
                    </div>
                    <div className="space-y-1">
                      <h3 className="flex items-center gap-1.5 text-sm font-[600] text-foreground">
                        <CircleCheck className="size-4" aria-hidden="true" />
                        After
                      </h3>
                      <Fields fields={x.after ?? []} empty="No metadata left." />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </ToolPanel>
      ) : null}
    </div>
  )
}

export default RemoveMetadata
