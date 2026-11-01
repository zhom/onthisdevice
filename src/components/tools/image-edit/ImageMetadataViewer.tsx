import { useCallback, useEffect, useRef, useState } from 'react'
import { FileJson, Info, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, nextFrame, stripExtension } from '@/lib/utils'
import { decodeImage, errorMessage, IMAGE_ACCEPT } from './image-utils'
import { metadataToJson, readMetadata, readThumbnailUrl, toDms, type MetaReport } from './exif-utils'

interface Analysis {
  file: File
  report: MetaReport
  width: number
  height: number
  previewUrl: string
  thumbnailUrl: string | null
}

function megapixels(w: number, h: number): string {
  const mp = (w * h) / 1_000_000
  return mp >= 1 ? `${mp.toFixed(1)} MP` : `${Math.round(w * h / 1000)} KP`
}

export default function ImageMetadataViewer() {
  const [items, setItems] = useState<Analysis[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const itemsRef = useRef<Analysis[]>([])
  itemsRef.current = items
  useEffect(
    () => () => {
      for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl)
    },
    [],
  )

  const onFiles = useCallback(async (incoming: File[]) => {
    if (incoming.length === 0) return
    setError(null)
    setLoading(true)
    try {
      const added: Analysis[] = []
      for (const file of incoming) {
        const report = await readMetadata(file)
        let width = 0
        let height = 0
        try {
          const decoded = await decodeImage(file)
          width = decoded.width
          height = decoded.height
          decoded.bitmap.close()
        } catch {
          // Metadata can still be shown even when the browser can't render the file.
        }
        added.push({
          file,
          report,
          width,
          height,
          previewUrl: URL.createObjectURL(file),
          thumbnailUrl: await readThumbnailUrl(file),
        })
        await nextFrame()
      }
      setItems((prev) => [...prev, ...added])
    } catch (err) {
      setError(errorMessage(err, 'That file could not be inspected.'))
    } finally {
      setLoading(false)
    }
  }, [])

  function clearAll() {
    for (const item of items) URL.revokeObjectURL(item.previewUrl)
    setItems([])
    setActive(0)
  }

  const current = items[active]
  const json = current ? metadataToJson(current.report.raw) : ''
  const jsonBlob = current ? new Blob([json], { type: 'application/json' }) : null

  return (
    <div className="space-y-6">
      {items.length === 0 && (
        <FileDropzone
          accept={IMAGE_ACCEPT}
          multiple
          onFiles={onFiles}
          maxSizeMb={200}
          title="Drop a photo to read its metadata"
          hint="EXIF, IPTC, XMP and GPS data is read in your browser"
        />
      )}

      {loading && <ProgressPanel label="Reading metadata…" />}
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {items.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Loaded files">
          {items.map((item, i) => (
            <Button
              key={`${item.file.name}-${item.file.lastModified}`}
              aria-pressed={i === active}
              variant={i === active ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActive(i)}
              className="max-w-56 truncate"
            >
              {item.file.name}
            </Button>
          ))}
        </div>
      )}

      {current && (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="space-y-4">
            <ToolPanel title="File">
              <img
                src={current.previewUrl}
                alt={`Preview of ${current.file.name}`}
                className="mb-3 max-h-64 w-full rounded-md border border-border object-contain"
              />
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="min-w-0 truncate text-right font-medium" title={current.file.name}>
                    {current.file.name}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Size</dt>
                  <dd className="font-medium">{formatBytes(current.file.size)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium">{current.file.type || 'unknown'}</dd>
                </div>
                {current.width > 0 && (
                  <>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Dimensions</dt>
                      <dd className="font-medium">
                        {current.width} × {current.height}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Resolution</dt>
                      <dd className="font-medium">{megapixels(current.width, current.height)}</dd>
                    </div>
                  </>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Modified</dt>
                  <dd className="font-medium">
                    {new Date(current.file.lastModified).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </ToolPanel>

            {current.thumbnailUrl && (
              <ToolPanel
                title="Embedded thumbnail"
                description="Cameras store a small JPEG preview inside the file."
              >
                <img
                  src={current.thumbnailUrl}
                  alt="Embedded EXIF thumbnail"
                  className="w-full rounded-md border border-border"
                />
              </ToolPanel>
            )}

            <Button variant="outline" className="w-full" onClick={clearAll}>
              Inspect different files
            </Button>
          </div>

          <div className="space-y-4">
            {current.report.count === 0 && (
              <div className="flex items-start gap-3 rounded-lg bg-card p-4">
                <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">No metadata found in this file.</p>
                  <p className="text-muted-foreground">
                    That is normal for screenshots, images exported from design tools, and anything
                    that has been through Facebook, Instagram, WhatsApp or Twitter. Those services
                    re-encode uploads and drop EXIF along the way.
                  </p>
                </div>
              </div>
            )}

            {current.report.gps && (
              <ToolPanel
                title="Location"
                description="Where the camera was when the shutter fired."
              >
                <div className="flex flex-wrap items-center gap-3">
                  <MapPin className="size-5 text-foreground" aria-hidden="true" />
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-sm">
                      {current.report.gps.lat.toFixed(6)}, {current.report.gps.lon.toFixed(6)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {toDms(current.report.gps.lat, 'lat')} {toDms(current.report.gps.lon, 'lon')}
                      {current.report.gps.altitude !== undefined &&
                        ` · ${current.report.gps.altitude.toFixed(0)} m above sea level`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton
                      value={`${current.report.gps.lat.toFixed(6)}, ${current.report.gps.lon.toFixed(6)}`}
                      label="Copy coordinates"
                    />
                    <CopyButton
                      value={`${toDms(current.report.gps.lat, 'lat')} ${toDms(current.report.gps.lon, 'lon')}`}
                      label="Copy as DMS"
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Paste the decimal pair straight into any maps app. To share this photo without the
                  location, run it through the EXIF remover.
                </p>
              </ToolPanel>
            )}

            {current.report.groups
              .filter((g) => g.id !== 'gps')
              .map((group) => (
                <ToolPanel key={group.id} title={group.title}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">{group.title} metadata</caption>
                      <tbody>
                        {group.fields.map((field) => (
                          <tr key={field.key} className="border-b border-border last:border-0">
                            <th
                              scope="row"
                              className="w-2/5 py-1.5 pr-4 text-left font-normal text-muted-foreground"
                            >
                              {field.label}
                            </th>
                            <td className="py-1.5 font-mono text-xs break-words">{field.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ToolPanel>
              ))}

            {current.report.gps && (
              <ToolPanel title="Raw GPS tags">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {(current.report.groups.find((g) => g.id === 'gps')?.fields ?? []).map((field) => (
                        <tr key={field.key} className="border-b border-border last:border-0">
                          <th
                            scope="row"
                            className="w-2/5 py-1.5 pr-4 text-left font-normal text-muted-foreground"
                          >
                            {field.label}
                          </th>
                          <td className="py-1.5 font-mono text-xs break-words">{field.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ToolPanel>
            )}

            {current.report.count > 0 && jsonBlob && (
              <ToolPanel
                title="Raw JSON"
                description={`${current.report.count} tags, exactly as parsed.`}
                footer={
                  <div className="flex flex-wrap gap-2">
                    <CopyButton value={json} label="Copy JSON" />
                    <DownloadButton
                      blob={jsonBlob}
                      filename={`${stripExtension(current.file.name)}-metadata.json`}
                      label="Download JSON"
                    />
                  </div>
                }
              >
                <div className="max-h-80 overflow-auto rounded-md bg-muted p-3">
                  <pre className="text-xs">
                    <code>{json}</code>
                  </pre>
                </div>
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <FileJson className="size-3.5" aria-hidden="true" />
                  Binary blocks such as the maker note and colour profile are summarised by length.
                </p>
              </ToolPanel>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
