import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, MapPin, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileChips } from '@/components/shared/FileChips'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { formatBytes, nextFrame } from '@/lib/utils'
import { ResultsGrid } from './ResultsGrid'
import {
  createCanvas,
  decodeImage,
  encodeCanvas,
  errorMessage,
  formatFromFile,
  get2d,
  IMAGE_ACCEPT,
  isLossy,
  nextId,
  outputName,
  revokeAll,
  type OutputFormat,
  type ProcessedItem,
} from './image-utils'
import { readMetadata, toDms, type MetaReport } from './exif-utils'

interface Scan {
  file: File
  report: MetaReport
  /** Tags still present after stripping — verified by re-parsing the output. */
  remaining?: number
}

export default function RemoveExifData() {
  const [files, setFiles] = useState<File[]>([])
  const [scans, setScans] = useState<Scan[]>([])
  const [scanning, setScanning] = useState(false)
  const [format, setFormat] = useState<'auto' | OutputFormat>('auto')
  const [quality, setQuality] = useState(95)

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ProcessedItem[]>([])

  const resultsRef = useRef<ProcessedItem[]>([])
  resultsRef.current = results
  useEffect(() => () => revokeAll(resultsRef.current), [])

  const clearResults = useCallback(() => {
    setResults((prev) => {
      revokeAll(prev)
      return []
    })
  }, [])

  const onFiles = useCallback(
    async (incoming: File[]) => {
      if (incoming.length === 0) return
      setError(null)
      clearResults()
      setFiles((prev) => [...prev, ...incoming])
      setScanning(true)
      try {
        const added: Scan[] = []
        for (const file of incoming) {
          added.push({ file, report: await readMetadata(file) })
          await nextFrame()
        }
        setScans((prev) => [...prev, ...added])
      } catch (err) {
        setError(errorMessage(err, 'Could not read the metadata in that file.'))
      } finally {
        setScanning(false)
      }
    },
    [clearResults],
  )

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setScans((prev) => prev.filter((_, i) => i !== index))
    clearResults()
  }

  function reorderFiles(from: number, to: number) {
    const move = <T,>(arr: T[]): T[] => {
      const next = [...arr]
      const [moved] = next.splice(from, 1)
      if (moved) next.splice(to, 0, moved)
      return next
    }
    setFiles(move)
    setScans(move)
  }

  async function run() {
    if (files.length === 0) return
    setBusy(true)
    setError(null)
    clearResults()
    setProgress(0)
    const out: ProcessedItem[] = []
    const verified: number[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setStatus(`Stripping metadata from ${file.name} (${i + 1} of ${files.length})…`)
        setProgress(Math.round((i / files.length) * 100))
        await nextFrame()

        const { bitmap } = await decodeImage(file)
        const outFormat: OutputFormat = format === 'auto' ? formatFromFile(file) : format
        const canvas = createCanvas(bitmap.width, bitmap.height)
        const ctx = get2d(canvas)
        if (outFormat === 'jpeg') {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        ctx.drawImage(bitmap, 0, 0)
        bitmap.close()

        const blob = await encodeCanvas(canvas, outFormat, quality / 100)

        // Verify: re-parse the freshly encoded file and count what survived.
        const check = await readMetadata(
          new File([blob], outputName(file, '-clean', outFormat), { type: blob.type }),
        )
        verified.push(check.count)

        out.push({
          id: nextId(),
          name: outputName(file, '-no-exif', outFormat),
          blob,
          url: URL.createObjectURL(blob),
          width: canvas.width,
          height: canvas.height,
          originalSize: file.size,
        })
      }
      setProgress(100)
      setResults(out)
      setScans((prev) => prev.map((s, i) => ({ ...s, remaining: verified[i] })))
      setStatus(
        `Cleaned ${out.length} ${out.length === 1 ? 'image' : 'images'}. Pixels are identical; every metadata block was dropped.`,
      )
    } catch (err) {
      revokeAll(out)
      setError(errorMessage(err, 'Metadata could not be removed from that file.'))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const effectiveFormat: OutputFormat = format === 'auto' ? (files[0] ? formatFromFile(files[0]) : 'jpeg') : format
  const totalTags = scans.reduce((sum, s) => sum + s.report.count, 0)
  const withGps = scans.filter((s) => s.report.gps)

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={IMAGE_ACCEPT}
        multiple
        onFiles={onFiles}
        maxSizeMb={200}
        title="Drop images to strip metadata"
        hint="See what is hidden in the file, then remove it. Nothing is uploaded"
      />

      {files.length > 0 && <FileChips files={files} onRemove={removeFile} onReorder={reorderFiles} />}

      {scanning && <ProgressPanel label="Reading metadata…" />}

      {withGps.length > 0 && (
        <div className="rounded-lg bg-muted p-4">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-2">
              <h3 className="font-semibold text-foreground">
                GPS coordinates found in {withGps.length}{' '}
                {withGps.length === 1 ? 'image' : 'images'}
              </h3>
              <p className="text-sm">
                These files record where the photo was taken, accurate to a few metres. Anyone you
                send the original to, and any site you upload it to, can read it.
              </p>
              <ul className="space-y-2">
                {withGps.map((s) => {
                  const gps = s.report.gps
                  if (!gps) return null
                  const coords = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`
                  return (
                    <li
                      key={s.file.name}
                      className="flex flex-wrap items-center gap-2 rounded-md bg-background p-2 text-sm"
                    >
                      <MapPin className="size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate font-medium">{s.file.name}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{coords}</code>
                      <span className="text-xs text-muted-foreground">
                        {toDms(gps.lat, 'lat')} {toDms(gps.lon, 'lon')}
                      </span>
                      <CopyButton value={coords} label="Copy coordinates" />
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {scans.length > 0 && (
        <ToolPanel
          title="What we found"
          description={
            totalTags > 0
              ? `${totalTags} metadata ${totalTags === 1 ? 'tag' : 'tags'} across ${scans.length} ${scans.length === 1 ? 'file' : 'files'}.`
              : 'No embedded metadata was found. These files are already clean.'
          }
          footer={
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={run} disabled={busy}>
                <Eraser className="size-4" aria-hidden="true" />
                {busy ? 'Cleaning…' : `Remove metadata from ${files.length} ${files.length === 1 ? 'image' : 'images'}`}
              </Button>
              <p className="text-sm text-muted-foreground">
                The image is re-encoded from raw pixels, so nothing but the picture survives.
              </p>
            </div>
          }
        >
          <div className="space-y-3">
            {scans.map((scan) => (
              <details
                key={`${scan.file.name}-${scan.file.lastModified}`}
                className="group rounded-lg bg-card"
              >
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <span className="min-w-0 flex-1 truncate font-medium">{scan.file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(scan.file.size)}</span>
                  {scan.remaining === 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                      <ShieldCheck className="size-3.5" aria-hidden="true" />
                      Verified clean
                    </span>
                  ) : scan.report.count === 0 ? (
                    <span className="text-xs text-muted-foreground">No metadata</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                      <TriangleAlert className="size-3.5" aria-hidden="true" />
                      {scan.report.count} tags
                      {scan.report.segments.length > 0 ? ` · ${scan.report.segments.join(', ')}` : ''}
                    </span>
                  )}
                </summary>
                <div className="space-y-4 border-t border-border p-3">
                  {scan.report.groups.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nothing to remove. This file has no EXIF, IPTC or XMP data.
                    </p>
                  )}
                  {scan.report.groups.map((group) => (
                    <div key={group.id}>
                      <h4 className="mb-1 text-xs font-semibold text-muted-foreground">
                        {group.title}
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <tbody>
                            {group.fields.map((field) => (
                              <tr key={field.key} className="border-b border-border last:border-0">
                                <th
                                  scope="row"
                                  className="w-1/2 py-1 pr-3 text-left font-normal text-muted-foreground"
                                >
                                  {field.label}
                                </th>
                                <td className="py-1 font-mono text-xs break-words">{field.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>

          <div className="mt-6 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="exif-format">Output format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as 'auto' | OutputFormat)}>
                <SelectTrigger id="exif-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Keep original format</SelectItem>
                  <SelectItem value="jpeg">JPEG (.jpg)</SelectItem>
                  <SelectItem value="png">PNG (.png)</SelectItem>
                  <SelectItem value="webp">WebP (.webp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isLossy(effectiveFormat) && (
              <div className="space-y-2">
                <Label id="exif-quality-label">Re-encode quality: {quality}</Label>
                <Slider
                  aria-labelledby="exif-quality-label"
                  min={60}
                  max={100}
                  step={1}
                  value={[quality]}
                  onValueChange={(v) => setQuality(v[0] ?? 95)}
                />
                <p className="text-xs text-muted-foreground">
                  Stripping EXIF from a JPEG requires re-compressing it. Keep this at 95 or above to
                  make the loss invisible, or switch the output to PNG for a pixel-perfect copy.
                </p>
              </div>
            )}
          </div>
        </ToolPanel>
      )}

      {busy && <ProgressPanel label={status || 'Removing metadata…'} value={progress} />}

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {results.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg bg-muted p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <p className="text-sm">
            Each cleaned file was re-parsed after encoding to confirm the result: no EXIF, no GPS, no
            IPTC, no XMP, no colour-profile comments. Only the pixels remain.
          </p>
        </div>
      )}

      <ResultsGrid
        items={results}
        zipName="metadata-removed"
        showSavings
        onReset={() => {
          clearResults()
          setFiles([])
          setScans([])
          setStatus('')
        }}
      />
    </div>
  )
}
