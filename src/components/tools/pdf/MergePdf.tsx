import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, FileText, GripVertical, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn, formatBytes, formatNumber, nextFrame } from '@/lib/utils'
import {
  allPages,
  humanPdfError,
  loadPdfLib,
  parsePageRanges,
  pdfBlob,
  readFileBytes,
} from './pdf-shared'

interface MergeItem {
  id: string
  file: File
  bytes: Uint8Array
  pageCount: number
  range: string
  loadError: string | null
}

interface MergeResult {
  blob: Blob
  filename: string
  pages: number
  inputBytes: number
}

let idCounter = 0
const nextId = () => `pdf-${++idCounter}`

export default function MergePdf() {
  const [items, setItems] = useState<MergeItem[]>([])
  const [reading, setReading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MergeResult | null>(null)
  const dragIndex = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const addFiles = useCallback(async (files: File[]) => {
    setError(null)
    setResult(null)
    setReading(true)
    try {
      const { PDFDocument } = await loadPdfLib()
      const added: MergeItem[] = []
      for (const file of files) {
        const bytes = await readFileBytes(file)
        let pageCount = 0
        let loadError: string | null = null
        try {
          const doc = await PDFDocument.load(bytes, { updateMetadata: false })
          pageCount = doc.getPageCount()
        } catch (err) {
          loadError = humanPdfError(err, file.name)
        }
        added.push({ id: nextId(), file, bytes, pageCount, range: '', loadError })
        await nextFrame()
      }
      setItems((prev) => [...prev, ...added])
    } catch (err) {
      setError(humanPdfError(err))
    } finally {
      setReading(false)
    }
  }, [])

  const update = (id: string, patch: Partial<MergeItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  const remove = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
    setResult(null)
  }

  const move = (from: number, to: number) => {
    setItems((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setResult(null)
  }

  const resolved = useMemo(
    () =>
      items.map((item) => {
        if (item.loadError) return { pages: [] as number[], error: item.loadError }
        try {
          const pages = item.range.trim()
            ? parsePageRanges(item.range, item.pageCount)
            : allPages(item.pageCount)
          return { pages, error: null as string | null }
        } catch (err) {
          return { pages: [] as number[], error: err instanceof Error ? err.message : String(err) }
        }
      }),
    [items],
  )

  const totalPages = resolved.reduce((sum, r) => sum + r.pages.length, 0)
  const inputBytes = items.reduce((sum, it) => sum + it.file.size, 0)
  const hasProblem = resolved.some((r) => r.error !== null)
  const canMerge = items.length >= 1 && totalPages > 0 && !hasProblem && !busy && !reading

  const merge = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    setProgress(0)
    try {
      const { PDFDocument } = await loadPdfLib()
      const out = await PDFDocument.create()
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const pages = resolved[i].pages
        if (pages.length === 0) continue
        const src = await PDFDocument.load(item.bytes, { updateMetadata: false })
        const copied = await out.copyPages(
          src,
          pages.map((p) => p - 1),
        )
        for (const page of copied) out.addPage(page)
        setProgress(Math.round(((i + 1) / items.length) * 100))
        await nextFrame()
      }
      out.setProducer('onthisdevice.com')
      out.setCreator('onthisdevice.com (Merge PDF)')
      const bytes = await out.save({ useObjectStreams: true })
      setResult({
        blob: pdfBlob(bytes),
        filename: 'merged.pdf',
        pages: out.getPageCount(),
        inputBytes,
      })
    } catch (err) {
      setError(humanPdfError(err))
    } finally {
      setBusy(false)
      setProgress(0)
    }
  }

  const reset = () => {
    setItems([])
    setResult(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept=".pdf,application/pdf"
        multiple
        maxSizeMb={500}
        onFiles={(files) => void addFiles(files)}
        title={items.length ? 'Add more PDFs' : 'Drop your PDF files here'}
        hint="or click to browse"
      />

      {reading && <ProgressPanel label="Reading files…" />}
      {error && <ErrorNote message={error} />}

      {items.length > 0 && (
        <ToolPanel
          title={`${items.length} file${items.length === 1 ? '' : 's'} in order`}
          description="Drag a row by its handle, or use the arrow buttons, to change the order. Leave a page range empty to use the whole file."
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void merge()} disabled={!canMerge}>
                Merge {totalPages > 0 ? `${formatNumber(totalPages, 0)} pages` : 'PDFs'}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={busy}>
                <RotateCcw className="mr-2 size-4" aria-hidden="true" />
                Start over
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setItems((prev) => [...prev].sort((a, b) => a.file.name.localeCompare(b.file.name)))
                  setResult(null)
                }}
                disabled={busy || items.length < 2}
              >
                Sort A→Z
              </Button>
            </div>
          }
        >
          <ul className="space-y-2">
            {items.map((item, i) => {
              const info = resolved[i]
              return (
                <li
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    dragIndex.current = i
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDragOver(i)
                  }}
                  onDragLeave={() => setDragOver((cur) => (cur === i ? null : cur))}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragIndex.current !== null) move(dragIndex.current, i)
                    dragIndex.current = null
                    setDragOver(null)
                  }}
                  onDragEnd={() => {
                    dragIndex.current = null
                    setDragOver(null)
                  }}
                  className={cn(
                    'rounded-lg bg-card p-3 transition-colors',
                    dragOver === i && 'ring-2 ring-primary',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <GripVertical
                      className="mt-1 size-4 shrink-0 cursor-grab text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                          {i + 1}.
                        </span>
                        <span className="truncate text-sm font-medium">{item.file.name}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatBytes(item.file.size)}
                        {item.pageCount > 0 && ` · ${item.pageCount} pages`}
                        {info.error === null &&
                          item.range.trim() !== '' &&
                          ` · taking ${info.pages.length}`}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Label
                          htmlFor={`range-${item.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          Pages
                        </Label>
                        <Input
                          id={`range-${item.id}`}
                          value={item.range}
                          disabled={item.loadError !== null}
                          placeholder={item.pageCount ? `all (1-${item.pageCount})` : 'all'}
                          onChange={(e) => {
                            update(item.id, { range: e.target.value })
                            setResult(null)
                          }}
                          className="h-8 w-40 text-sm"
                          inputMode="text"
                        />
                      </div>
                      {info.error && (
                        <p className="mt-1 text-xs text-destructive" role="alert">
                          {info.error}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${item.file.name} up`}
                        disabled={i === 0}
                        onClick={() => move(i, i - 1)}
                      >
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${item.file.name} down`}
                        disabled={i === items.length - 1}
                        onClick={() => move(i, i + 1)}
                      >
                        <ArrowDown className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${item.file.name}`}
                        onClick={() => remove(item.id)}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </ToolPanel>
      )}

      {busy && <ProgressPanel label="Copying pages into the merged document…" value={progress} />}

      {result && (
        <ToolPanel
          title="Your merged PDF is ready"
          description="The file was assembled on this device and was never uploaded."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Pages" value={formatNumber(result.pages, 0)} emphasis />
            <ResultStat label="Output size" value={formatBytes(result.blob.size)} />
            <ResultStat
              label="Input size"
              value={formatBytes(result.inputBytes)}
              hint={`${items.length} source file${items.length === 1 ? '' : 's'}`}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DownloadButton blob={result.blob} filename={result.filename} label="Download merged PDF" />
          </div>
        </ToolPanel>
      )}

      {items.length === 0 && !reading && (
        <div className="flex items-start gap-3 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          <FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Add two or more PDFs to begin. You can reorder them afterwards and, if you only need
            part of a file, type a page range such as <code className="font-mono">1-3, 8, 12-</code>{' '}
            next to it.
          </p>
        </div>
      )}
    </div>
  )
}
