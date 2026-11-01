import { useCallback, useState } from 'react'
import { CircleAlert, FileDown, Presentation, Sheet, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileChips } from '@/components/shared/FileChips'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, formatNumber, nextFrame } from '@/lib/utils'
import { humanFileError, outputName } from '@/components/tools/pdf/pdf-secure-shared'

export type IWorkKind = 'pages' | 'keynote' | 'numbers'

export interface PdfSecureIWorkToPdfProps {
  kind: IWorkKind
}

const KINDS: Record<
  IWorkKind,
  { extension: string; appName: string; icon: typeof Sparkles; noun: string }
> = {
  pages: { extension: '.pages', appName: 'Pages', icon: Sparkles, noun: 'document' },
  keynote: { extension: '.key', appName: 'Keynote', icon: Presentation, noun: 'presentation' },
  numbers: { extension: '.numbers', appName: 'Numbers', icon: Sheet, noun: 'spreadsheet' },
}

interface Extracted {
  name: string
  blob: Blob
  bytes: number
  pages: number | null
  /** Set when only a preview image was found, so the PDF holds one page. */
  note?: string
}

interface Failure {
  name: string
  reason: string
}

const PREVIEW_PATHS = [
  'quicklook/preview.pdf',
  'preview.pdf',
  'quicklook/preview-web.pdf',
  'data/preview.pdf',
]

/**
 * Files saved since 2013 carry no PDF, only JPEG previews of the first page
 * or slide. Best first.
 */
const IMAGE_PREVIEW_PATHS = [
  'preview.jpg',
  'preview-web.jpg',
  'quicklook/preview.jpg',
  'quicklook/thumbnail.jpg',
  'preview-micro.jpg',
]

function findEntry(paths: string[], candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const hit = paths.find((path) => {
      const lower = path.toLowerCase()
      return lower === candidate || lower.endsWith(`/${candidate}`)
    })
    if (hit) return hit
  }
  return undefined
}

/** One-page PDF around a JPEG; the long side is A4's long side (842 pt). */
async function jpegToPdf(jpeg: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const image = await doc.embedJpg(jpeg)
  const scale = 842 / Math.max(image.width, image.height)
  const width = image.width * scale
  const height = image.height * scale
  const page = doc.addPage([width, height])
  page.drawImage(image, { x: 0, y: 0, width, height })
  doc.setProducer('onthisdevice.com')
  return doc.save()
}

function countPdfPages(bytes: Uint8Array): number | null {
  // Cheap structural count — good enough for a "looks sane" readout without
  // pulling in a parser for a file we are only passing through.
  const text = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 4_000_000)))
  const matches = text.match(/\/Type\s*\/Page[^s]/g)
  if (matches && matches.length > 0) return matches.length
  const count = text.match(/\/Count\s+(\d+)/)
  return count ? Number(count[1]) : null
}

export default function PdfSecureIWorkToPdf({ kind }: PdfSecureIWorkToPdfProps) {
  const meta = KINDS[kind]
  const [files, setFiles] = useState<File[]>([])
  const [results, setResults] = useState<Extracted[]>([])
  const [failures, setFailures] = useState<Failure[]>([])
  const [zipBlob, setZipBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('Working…')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setResults([])
    setFailures([])
    setZipBlob(null)
    setError(null)
  }

  const extract = useCallback(
    async (list: File[]) => {
      setBusy(true)
      reset()
      setProgress(0)
      setStage('Opening the package…')
      const found: Extracted[] = []
      const failed: Failure[] = []

      try {
        const JSZip = (await import('jszip')).default

        for (let i = 0; i < list.length; i++) {
          const file = list[i]
          setStage(`Reading ${file.name} (${i + 1} of ${list.length})…`)
          setProgress(Math.round((i / list.length) * 90))
          await nextFrame()

          try {
            const zip = await JSZip.loadAsync(await file.arrayBuffer())
            const paths: string[] = []
            zip.forEach((path) => {
              paths.push(path)
            })
            const pdfEntry = findEntry(paths, PREVIEW_PATHS)
            const imageEntry = pdfEntry ? undefined : findEntry(paths, IMAGE_PREVIEW_PATHS)

            if (!pdfEntry && !imageEntry) {
              failed.push({
                name: file.name,
                reason: `no preview inside. This ${meta.noun} was saved with previews turned off. Open it in ${meta.appName} and use File → Export To → PDF`,
              })
              continue
            }

            const entry = zip.file((pdfEntry ?? imageEntry) as string)
            if (!entry) {
              failed.push({ name: file.name, reason: 'the preview entry could not be read' })
              continue
            }
            let bytes = await entry.async('uint8array')
            let note: string | undefined
            if (imageEntry) {
              if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
                failed.push({ name: file.name, reason: 'the embedded preview is not a valid JPEG' })
                continue
              }
              bytes = await jpegToPdf(bytes)
              note = `Only the first ${kind === 'keynote' ? 'slide' : 'page'}. Newer ${meta.appName} files store a preview image, not the whole ${meta.noun}. For every ${kind === 'keynote' ? 'slide' : 'page'}, use File → Export To → PDF in ${meta.appName}.`
            } else if (bytes.length < 5 || String.fromCharCode(...bytes.subarray(0, 4)) !== '%PDF') {
              failed.push({ name: file.name, reason: 'the embedded preview is not a valid PDF' })
              continue
            }
            const buffer = new ArrayBuffer(bytes.byteLength)
            new Uint8Array(buffer).set(bytes)
            found.push({
              name: outputName(file.name, '', 'pdf'),
              blob: new Blob([buffer], { type: 'application/pdf' }),
              bytes: bytes.length,
              pages: imageEntry ? 1 : countPdfPages(bytes),
              note,
            })
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            failed.push({
              name: file.name,
              reason: /zip|end of central directory|corrupt/i.test(message)
                ? `this is not a zipped ${meta.extension} package. On a Mac, ${meta.appName} files are folders unless you tick “Copy as single file”. Compress it first, or re-save it`
                : message,
            })
          }
        }

        if (found.length > 1) {
          setStage('Bundling the results…')
          setProgress(95)
          await nextFrame()
          const zip = new JSZip()
          for (const item of found) zip.file(item.name, item.blob)
          setZipBlob(
            await zip.generateAsync({ type: 'blob', compression: 'STORE' }),
          )
        }

        setResults(found)
        setFailures(failed)
        if (found.length === 0 && failed.length === 0) {
          setError('Nothing was extracted.')
        }
        setProgress(100)
      } catch (err) {
        setError(humanFileError(err))
      } finally {
        setBusy(false)
      }
    },
    [kind, meta.appName, meta.extension, meta.noun],
  )

  const Icon = meta.icon
  const totalBytes = results.reduce((sum, item) => sum + item.bytes, 0)

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={`${meta.extension},.zip,application/zip`}
        multiple
        maxSizeMb={500}
        onFiles={(picked) => {
          setFiles(picked)
          void extract(picked)
        }}
        title={`Drop ${meta.extension} files here`}
        hint="or click to browse. The package is unzipped in this tab."
        icon={Icon}
      />

      {files.length > 0 && (
        <FileChips
          files={files}
          onRemove={(index) => {
            const next = files.filter((_, i) => i !== index)
            setFiles(next)
            if (next.length > 0) void extract(next)
            else reset()
          }}
        />
      )}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {busy && (
        <ProgressPanel label={stage} value={progress} sublabel="Reading the package." />
      )}

      {results.length > 0 && (
        <ToolPanel
          title={`${formatNumber(results.length, 0)} PDF${results.length === 1 ? '' : 's'} extracted`}
          description={
            results.some((item) => item.note)
              ? `${formatBytes(totalBytes)} total · built from the preview stored inside the file`
              : `${formatBytes(totalBytes)} total · byte-for-byte the preview stored inside the file`
          }
          footer={
            <div className="flex flex-wrap items-center gap-2">
              {results.length === 1 ? (
                <DownloadButton
                  blob={results[0].blob}
                  filename={results[0].name}
                  label="Download PDF"
                />
              ) : (
                zipBlob && (
                  <DownloadButton
                    blob={zipBlob}
                    filename={`${meta.appName.toLowerCase()}-pdfs.zip`}
                    label="Download all (.zip)"
                  />
                )
              )}
            </div>
          }
        >
          <ul className="divide-y divide-border rounded-lg bg-muted">
            {results.map((item) => (
              <li key={item.name} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <FileDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.name}
                  </span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {formatBytes(item.bytes)}
                    {item.pages
                      ? ` · ${formatNumber(item.pages, 0)} ${item.pages === 1 ? 'page' : 'pages'}`
                      : ''}
                  </span>
                  {item.note ? (
                    <span role="note" className="mt-1 block text-xs text-pretty text-warning">
                      {item.note}
                    </span>
                  ) : null}
                </span>
                <DownloadButton
                  blob={item.blob}
                  filename={item.name}
                  label="Save"
                  variant="outline"
                  size="sm"
                />
              </li>
            ))}
          </ul>
          {results.some((item) => !item.note) ? (
            <p className="text-sm text-muted-foreground text-pretty">
              Nothing was re-rendered. Older {meta.appName} files hold a PDF preview inside the
              package, and you get that file: the same fonts, layout and
              page count as on the Mac it came from.
            </p>
          ) : null}
        </ToolPanel>
      )}

      {failures.length > 0 && (
        <ToolPanel title="Could not extract">
          <ul className="space-y-2" role="alert">
            {failures.map((item) => (
              <li key={item.name} className="flex items-start gap-2 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <span className="text-pretty">
                  <strong className="font-medium text-foreground">{item.name}</strong>: {item.reason}.
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (files.length > 0) void extract(files)
              }}
            >
              Try again
            </Button>
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
