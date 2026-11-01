import { useCallback, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn, formatBytes, formatNumber } from '@/lib/utils'
import { PageSelectionBar } from './PageSelectionBar'
import { PageThumb } from './PageThumb'
import {
  allPages,
  humanPdfError,
  loadPdfLib,
  outputName,
  pagesToRangeString,
  pdfBlob,
  readFileBytes,
} from './pdf-shared'
import { usePdfThumbnails } from './usePdfThumbnails'

export default function DeletePdfPages() {
  const [file, setFile] = useState<File | null>(null)
  const [toDelete, setToDelete] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; filename: string; kept: number } | null>(null)

  const thumbs = usePdfThumbnails(file, 150)

  const onFiles = useCallback((files: File[]) => {
    const next = files[0]
    if (!next) return
    setFile(next)
    setToDelete(new Set())
    setResult(null)
    setError(null)
  }, [])

  const keptPages = allPages(thumbs.pageCount).filter((p) => !toDelete.has(p))

  const toggle = (page: number) => {
    setToDelete((prev) => {
      const next = new Set(prev)
      if (next.has(page)) next.delete(page)
      else next.add(page)
      return next
    })
    setResult(null)
  }

  const save = async () => {
    if (!file || keptPages.length === 0) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const bytes = await readFileBytes(file)
      const { PDFDocument } = await loadPdfLib()
      const src = await PDFDocument.load(bytes, { updateMetadata: false })
      const out = await PDFDocument.create()
      const copied = await out.copyPages(
        src,
        keptPages.map((p) => p - 1),
      )
      for (const page of copied) out.addPage(page)
      out.setProducer('onthisdevice.com')
      const saved = await out.save({ useObjectStreams: true })
      setResult({
        blob: pdfBlob(saved),
        filename: outputName(file.name, '-pages-removed'),
        kept: keptPages.length,
      })
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept=".pdf,application/pdf"
        maxSizeMb={300}
        onFiles={onFiles}
        title={file ? 'Choose a different PDF' : 'Drop a PDF here'}
        hint="or click to browse"
      />

      {error && <ErrorNote message={error} />}
      {thumbs.error && <ErrorNote message={thumbs.error} />}

      {file && thumbs.status === 'loading' && (
        <ProgressPanel
          label={`Rendering page previews… ${thumbs.pages.length}/${thumbs.pageCount || '?'}`}
          value={thumbs.progress}
        />
      )}

      {file && thumbs.pageCount > 0 && (
        <ToolPanel
          title="Choose the pages to delete"
          description="Click a page to mark it for deletion, or type a range. Marked pages are dimmed and struck through."
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => void save()}
                disabled={busy || toDelete.size === 0 || keptPages.length === 0}
                variant="destructive"
              >
                <Trash2 className="mr-2 size-4" aria-hidden="true" />
                Delete {toDelete.size} page{toDelete.size === 1 ? '' : 's'}
              </Button>
              <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {keptPages.length} of {thumbs.pageCount} pages will be kept
              </span>
              {keptPages.length === 0 && thumbs.pageCount > 0 && (
                <span className="text-sm text-destructive" role="alert">
                  A PDF needs at least one page. Keep one.
                </span>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            <PageSelectionBar
              pageCount={thumbs.pageCount}
              selected={toDelete}
              onChange={(next) => {
                setToDelete(next)
                setResult(null)
              }}
              idPrefix="delete"
              rangeLabel="Pages to delete"
            />

            <div
              className="grid justify-items-center gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
            >
              {allPages(thumbs.pageCount).map((page) => {
                const marked = toDelete.has(page)
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => toggle(page)}
                    aria-pressed={marked}
                    aria-label={`Page ${page}${marked ? ', marked for deletion' : ''}`}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg p-1 ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      marked ? 'bg-muted ring-2 ring-destructive' : 'hover:bg-accent',
                    )}
                  >
                    <div className="relative">
                      <PageThumb thumb={thumbs.pages[page - 1]} muted={marked} />
                      {marked && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <Trash2 className="size-7 text-destructive" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        marked ? 'text-destructive line-through' : 'text-muted-foreground',
                      )}
                    >
                      {page}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </ToolPanel>
      )}

      {busy && <ProgressPanel label="Writing the trimmed PDF…" />}

      {result && !busy && (
        <ToolPanel title="Pages removed" description="The remaining pages were copied into a fresh document.">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Pages kept" value={formatNumber(result.kept, 0)} emphasis />
            <ResultStat
              label="Pages deleted"
              value={formatNumber(toDelete.size, 0)}
              hint={pagesToRangeString([...toDelete])}
            />
            <ResultStat
              label="New size"
              value={formatBytes(result.blob.size)}
              hint={`was ${formatBytes(file?.size ?? 0)}`}
            />
          </div>
          <div className="mt-4">
            <DownloadButton blob={result.blob} filename={result.filename} label="Download trimmed PDF" />
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
