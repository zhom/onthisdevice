import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn, formatBytes, formatNumber } from '@/lib/utils'
import { PageThumb } from './PageThumb'
import { humanPdfError, loadPdfLib, outputName, pdfBlob, readFileBytes } from './pdf-shared'
import { usePdfThumbnails } from './usePdfThumbnails'

interface PageItem {
  key: string
  /** 1-based page number in the source document. */
  source: number
  /** Extra rotation in degrees on top of the page's own. */
  rotation: number
}

let keySeed = 0
const makeKey = (source: number) => `p${source}-${++keySeed}`

export default function OrganizePdf() {
  const [file, setFile] = useState<File | null>(null)
  const [items, setItems] = useState<PageItem[]>([])
  const [removed, setRemoved] = useState<PageItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; filename: string; pages: number } | null>(null)
  const dragFrom = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const thumbs = usePdfThumbnails(file, 150)

  useEffect(() => {
    if (thumbs.pageCount === 0) return
    setItems((prev) =>
      prev.length > 0
        ? prev
        : Array.from({ length: thumbs.pageCount }, (_, i) => ({
            key: makeKey(i + 1),
            source: i + 1,
            rotation: 0,
          })),
    )
  }, [file, thumbs.pageCount])

  const onFiles = useCallback((files: File[]) => {
    const next = files[0]
    if (!next) return
    setFile(next)
    setItems([])
    setRemoved([])
    setResult(null)
    setError(null)
  }, [])

  const mutate = (fn: (prev: PageItem[]) => PageItem[]) => {
    setItems(fn)
    setResult(null)
  }

  const move = (from: number, to: number) =>
    mutate((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })

  const rotate = (index: number, delta: number) =>
    mutate((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, rotation: (((it.rotation + delta) % 360) + 360) % 360 } : it,
      ),
    )

  const duplicate = (index: number) =>
    mutate((prev) => {
      const next = [...prev]
      const original = next[index]
      next.splice(index + 1, 0, { ...original, key: makeKey(original.source) })
      return next
    })

  const remove = (index: number) => {
    const item = items[index]
    if (!item) return
    setRemoved((prev) => [...prev, item])
    mutate((prev) => prev.filter((_, i) => i !== index))
  }

  const restore = (key: string) => {
    const item = removed.find((r) => r.key === key)
    if (!item) return
    setRemoved((prev) => prev.filter((r) => r.key !== key))
    mutate((prev) => {
      const next = [...prev]
      const insertAt = next.findIndex((p) => p.source > item.source)
      if (insertAt === -1) next.push(item)
      else next.splice(insertAt, 0, item)
      return next
    })
  }

  const resetAll = () => {
    setRemoved([])
    mutate(() =>
      Array.from({ length: thumbs.pageCount }, (_, i) => ({
        key: makeKey(i + 1),
        source: i + 1,
        rotation: 0,
      })),
    )
  }

  const exportPdf = async () => {
    if (!file || items.length === 0) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const bytes = await readFileBytes(file)
      const { PDFDocument, degrees } = await loadPdfLib()
      const src = await PDFDocument.load(bytes, { updateMetadata: false })
      const out = await PDFDocument.create()
      const copied = await out.copyPages(
        src,
        items.map((it) => it.source - 1),
      )
      copied.forEach((page, i) => {
        const delta = items[i].rotation
        if (delta !== 0) {
          const current = page.getRotation().angle
          page.setRotation(degrees((((current + delta) % 360) + 360) % 360))
        }
        out.addPage(page)
      })
      out.setProducer('onthisdevice.com')
      out.setCreator('onthisdevice.com (Organize PDF)')
      const saved = await out.save({ useObjectStreams: true })
      setResult({
        blob: pdfBlob(saved),
        filename: outputName(file.name, '-organized'),
        pages: items.length,
      })
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }

  const dirty =
    removed.length > 0 ||
    items.some((it, i) => it.source !== i + 1 || it.rotation !== 0) ||
    items.length !== thumbs.pageCount

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

      {file && items.length > 0 && (
        <ToolPanel
          title={`${items.length} page${items.length === 1 ? '' : 's'} in the new document`}
          description="Drag a page to move it, or use the arrows on each card. Rotate, duplicate and delete act on that page only."
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void exportPdf()} disabled={busy}>
                Export PDF
              </Button>
              <Button variant="ghost" onClick={resetAll} disabled={!dirty}>
                <Undo2 className="mr-2 size-4" aria-hidden="true" />
                Reset
              </Button>
              <Button
                variant="ghost"
                onClick={() => mutate((prev) => [...prev].reverse())}
                disabled={items.length < 2}
              >
                Reverse order
              </Button>
            </div>
          }
        >
          <div
            className="grid justify-items-center gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))' }}
          >
            {items.map((item, index) => (
              <div
                key={item.key}
                draggable
                onDragStart={(e) => {
                  dragFrom.current = index
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOver(index)
                }}
                onDragLeave={() => setDragOver((cur) => (cur === index ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragFrom.current !== null) move(dragFrom.current, index)
                  dragFrom.current = null
                  setDragOver(null)
                }}
                onDragEnd={() => {
                  dragFrom.current = null
                  setDragOver(null)
                }}
                className={cn(
                  'flex cursor-grab flex-col items-center gap-1 rounded-lg border border-transparent p-1 transition-colors',
                  dragOver === index && 'border-primary bg-accent',
                )}
              >
                <PageThumb thumb={thumbs.pages[item.source - 1]} rotation={item.rotation} />
                <div className="flex w-full items-center justify-between px-1">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                    <span className="sr-only"> (source page {item.source})</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">p{item.source}</span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Move page ${index + 1} earlier`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Rotate page ${index + 1} left`}
                    onClick={() => rotate(index, -90)}
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Rotate page ${index + 1} right`}
                    onClick={() => rotate(index, 90)}
                  >
                    <RotateCw className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Move page ${index + 1} later`}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Duplicate page ${index + 1}`}
                    onClick={() => duplicate(index)}
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive"
                    aria-label={`Delete page ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ToolPanel>
      )}

      {removed.length > 0 && (
        <ToolPanel
          title={`${removed.length} page${removed.length === 1 ? '' : 's'} removed`}
          description="They are not in the export. Put any of them back until you leave the page."
        >
          <div className="flex flex-wrap gap-2">
            {removed.map((item) => (
              <Button
                key={item.key}
                variant="outline"
                size="sm"
                onClick={() => restore(item.key)}
                aria-label={`Restore source page ${item.source}`}
              >
                <Undo2 className="mr-2 size-3.5" aria-hidden="true" />
                Page {item.source}
              </Button>
            ))}
          </div>
        </ToolPanel>
      )}

      {busy && <ProgressPanel label="Building the reorganised PDF…" />}

      {result && !busy && (
        <ToolPanel title="Reorganised PDF ready" description="Pages were copied without re-rendering, so quality is unchanged.">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Pages exported" value={formatNumber(result.pages, 0)} emphasis />
            <ResultStat
              label="Pages removed"
              value={formatNumber(removed.length, 0)}
              hint={`from ${thumbs.pageCount} original`}
            />
            <ResultStat label="File size" value={formatBytes(result.blob.size)} />
          </div>
          <div className="mt-4">
            <DownloadButton blob={result.blob} filename={result.filename} label="Download organised PDF" />
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
