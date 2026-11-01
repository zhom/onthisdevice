import { useCallback, useEffect, useState } from 'react'
import { RotateCcw, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn, downloadBlob, formatBytes, formatNumber } from '@/lib/utils'
import { PageSelectionBar } from './PageSelectionBar'
import { PageThumb } from './PageThumb'
import {
  humanPdfError,
  loadPdfLib,
  outputName,
  pagesToRangeString,
  pdfBlob,
  readFileBytes,
} from './pdf-shared'
import { usePdfThumbnails } from './usePdfThumbnails'

export default function RotatePdf() {
  const [file, setFile] = useState<File | null>(null)
  const [rotations, setRotations] = useState<number[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null)

  const thumbs = usePdfThumbnails(file, 150)

  useEffect(() => {
    if (thumbs.pageCount > 0) {
      setRotations((prev) =>
        prev.length === thumbs.pageCount ? prev : new Array<number>(thumbs.pageCount).fill(0),
      )
    }
  }, [file, thumbs.pageCount])

  const onFiles = useCallback((files: File[]) => {
    const next = files[0]
    if (!next) return
    setFile(next)
    setRotations([])
    setSelected(new Set())
    setResult(null)
    setError(null)
  }, [])

  const targets = () =>
    selected.size > 0
      ? [...selected]
      : Array.from({ length: thumbs.pageCount }, (_, i) => i + 1)

  const rotateBy = (delta: number) => {
    const pages = new Set(targets())
    setRotations((prev) =>
      prev.map((r, i) => (pages.has(i + 1) ? (((r + delta) % 360) + 360) % 360 : r)),
    )
    setResult(null)
  }

  const rotateOne = (page: number, delta: number) => {
    setRotations((prev) =>
      prev.map((r, i) => (i + 1 === page ? (((r + delta) % 360) + 360) % 360 : r)),
    )
    setResult(null)
  }

  const changedPages = rotations
    .map((r, i) => (r !== 0 ? i + 1 : 0))
    .filter((p): p is number => p > 0)

  const save = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const bytes = await readFileBytes(file)
      const { PDFDocument, degrees } = await loadPdfLib()
      const doc = await PDFDocument.load(bytes, { updateMetadata: false })
      const pages = doc.getPages()
      pages.forEach((page, i) => {
        const delta = rotations[i] ?? 0
        if (delta === 0) return
        const current = page.getRotation().angle
        page.setRotation(degrees((((current + delta) % 360) + 360) % 360))
      })
      doc.setProducer('onthisdevice.com')
      const saved = await doc.save({ useObjectStreams: true })
      const next = { blob: pdfBlob(saved), filename: outputName(file.name, '-rotated') }
      setResult(next)
      // The button says "Apply and download", so the file is saved right away;
      // the download button below stays for a second copy.
      downloadBlob(next.blob, next.filename)
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
          title="Rotate pages"
          description="With nothing selected the buttons rotate every page. Select pages first to rotate only those."
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void save()} disabled={busy || changedPages.length === 0}>
                Apply and download
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRotations(new Array<number>(thumbs.pageCount).fill(0))
                  setResult(null)
                }}
                disabled={changedPages.length === 0}
              >
                Reset rotations
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Rotate {selected.size > 0 ? `${selected.size} selected` : 'all pages'}
              </span>
              <Button variant="outline" size="sm" onClick={() => rotateBy(-90)}>
                <RotateCcw className="mr-2 size-4" aria-hidden="true" />
                90° left
              </Button>
              <Button variant="outline" size="sm" onClick={() => rotateBy(90)}>
                <RotateCw className="mr-2 size-4" aria-hidden="true" />
                90° right
              </Button>
              <Button variant="outline" size="sm" onClick={() => rotateBy(180)}>
                180°
              </Button>
            </div>

            <PageSelectionBar
              pageCount={thumbs.pageCount}
              selected={selected}
              onChange={(next) => setSelected(next)}
              idPrefix="rotate"
              rangeLabel="Select by range"
            />

            <div
              className="grid justify-items-center gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
            >
              {Array.from({ length: thumbs.pageCount }, (_, i) => i + 1).map((page) => {
                const thumb = thumbs.pages[page - 1]
                const isSelected = selected.has(page)
                const rotation = rotations[page - 1] ?? 0
                return (
                  <div key={page} className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (next.has(page)) next.delete(page)
                          else next.add(page)
                          return next
                        })
                      }
                      aria-pressed={isSelected}
                      aria-label={`Page ${page}${isSelected ? ', selected' : ''}${
                        rotation ? `, rotated ${rotation} degrees` : ''
                      }`}
                      className={cn(
                        'rounded-lg p-1 ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        isSelected ? 'bg-muted ring-2 ring-primary' : 'hover:bg-accent',
                      )}
                    >
                      <PageThumb thumb={thumb} rotation={rotation} />
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-xs tabular-nums text-muted-foreground">{page}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Rotate page ${page} left`}
                        onClick={() => rotateOne(page, -90)}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Rotate page ${page} right`}
                        onClick={() => rotateOne(page, 90)}
                      >
                        <RotateCw className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </ToolPanel>
      )}

      {busy && <ProgressPanel label="Writing the rotated PDF…" />}

      {result && !busy && (
        <ToolPanel title="Rotated PDF ready" description="Rotation is stored in the page itself, so every reader honours it.">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat
              label="Pages rotated"
              value={formatNumber(changedPages.length, 0)}
              hint={pagesToRangeString(changedPages)}
              emphasis
            />
            <ResultStat label="Total pages" value={formatNumber(thumbs.pageCount, 0)} />
            <ResultStat label="File size" value={formatBytes(result.blob.size)} />
          </div>
          <div className="mt-4">
            <DownloadButton blob={result.blob} filename={result.filename} label="Download rotated PDF" />
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
