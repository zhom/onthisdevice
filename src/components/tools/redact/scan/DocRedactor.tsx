/**
 * Shared workflow of the document tools (signatures, scanned documents):
 * drop PDFs or images, download the finder once, check every page in turn,
 * review each page in the shared editor, export PDF or images.
 *
 * The tool owns the results and the boxes: `finder.find` stores what it
 * found for a page, `boxesOf` gives the boxes to show and export, and
 * `onEdit` gets the boxes after each change in the editor. So a tool can
 * derive boxes from its results (the scanned-document tool switches whole
 * groups of found text on and off).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { humanPdfError } from '@/components/tools/pdf/pdf-edit-core'
import { cn, downloadBlob, formatBytes } from '@/lib/utils'
import { RedactionEditor } from '../shared/RedactionEditor'
import type { BoxKind, EditorBox } from '../shared/boxes'
import { FILL, exportDocs } from './doc-export'
import type { ExportFormat } from './doc-export'
import { closeFiles, dropCanvas, openFiles, renderPage } from './doc-pages'
import type { DocPage } from './doc-pages'

export interface PageFinder {
  /** Bytes a first run downloads, for the "Downloads N MB once" note. */
  downloadBytes: () => number
  isCached: () => Promise<boolean>
  /** Downloads and starts what the finder needs; progress in bytes. */
  load: (onProgress: (loaded: number, total: number) => void) => Promise<void>
  /** Resolution of the page image the finder gets. */
  dpi: number
  maxSide: number
  /** Checks one page and stores the result in the tool. `onStep` takes 0..1. */
  find: (canvas: HTMLCanvasElement, page: DocPage, onStep: (fraction: number) => void) => Promise<void>
  /** Progress text, for example "Finding signatures". */
  verb: string
}

export interface DocRedactorProps {
  finder: PageFinder
  /** Boxes of a page, in fractions of the page. */
  boxesOf: (pageId: string) => EditorBox[]
  onEdit: (pageId: string, boxes: EditorBox[]) => void
  /** All files were closed. */
  onReset: () => void
  names: Partial<Record<BoxKind, string>>
  dropTitle: string
  /** Title of the editor panel for the current page. */
  title: (page: DocPage, boxes: readonly EditorBox[], scanned: boolean) => string
  description: string
  /** Every page of a PDF becomes an image, not only pages with a box. */
  rasterAll: boolean
  defaultFormat?: ExportFormat
  options?: ReactNode
  /** Draws over each page after the boxes, in the preview and the export (a watermark). */
  decorate?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  onPagesChange?: (pages: DocPage[]) => void
}

const ACCEPT = '.pdf,application/pdf,image/*,.jpg,.jpeg,.png,.webp'
const PREVIEW = { dpi: 110, maxSide: 1600 }
const EXPORT_DPI = 200

function mb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1e6))} MB`
}

export function DocRedactor({ finder, boxesOf, onEdit, onReset, names, dropTitle, title, description, rasterAll, defaultFormat = 'pdf', options, decorate, onPagesChange }: DocRedactorProps) {
  const [pages, setPages] = useState<DocPage[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ id: string; canvas: HTMLCanvasElement } | null>(null)
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map())
  const [scanned, setScanned] = useState<Set<string>>(new Set())
  const [cached, setCached] = useState(true)
  const [download, setDownload] = useState<{ loaded: number; total: number } | null>(null)
  const [scan, setScan] = useState<{ index: number; count: number; fraction: number } | null>(null)
  const [opening, setOpening] = useState(false)
  const [format, setFormat] = useState<ExportFormat>(defaultFormat)
  const [exporting, setExporting] = useState<{ done: number; total: number } | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)

  const pagesRef = useRef(pages)
  pagesRef.current = pages
  const queue = useRef<DocPage[]>([])
  const running = useRef(false)
  const generation = useRef(0)

  useEffect(() => {
    void finder.isCached().then(setCached)
  }, [finder])

  useEffect(() => onPagesChange?.(pages), [pages, onPagesChange])

  /* Check each queued page in turn. */
  const pump = useCallback(async () => {
    if (running.current) return
    running.current = true
    const gen = generation.current
    try {
      if (queue.current.length > 0) {
        if (!(await finder.isCached())) setDownload({ loaded: 0, total: finder.downloadBytes() })
        await finder.load((loaded, total) => gen === generation.current && setDownload({ loaded, total }))
        setDownload(null)
        setCached(true)
      }
      while (queue.current.length > 0 && gen === generation.current) {
        const page = queue.current.shift()!
        const all = pagesRef.current
        const index = all.findIndex((p) => p.id === page.id)
        if (index < 0) continue
        setScan({ index, count: all.length, fraction: 0 })
        const canvas = await renderPage(page, { dpi: finder.dpi, maxSide: finder.maxSide })
        try {
          const thumb = document.createElement('canvas')
          const k = 120 / Math.max(canvas.width, canvas.height)
          thumb.width = Math.round(canvas.width * k)
          thumb.height = Math.round(canvas.height * k)
          thumb.getContext('2d')?.drawImage(canvas, 0, 0, thumb.width, thumb.height)
          const url = thumb.toDataURL('image/png')
          setThumbs((prev) => new Map(prev).set(page.id, url))
          await finder.find(canvas, page, (fraction) => gen === generation.current && setScan({ index, count: all.length, fraction }))
          if (gen !== generation.current) return
          setScanned((prev) => new Set(prev).add(page.id))
        } finally {
          dropCanvas(canvas)
        }
      }
    } catch (err) {
      if (gen === generation.current) setError(humanPdfError(err))
    } finally {
      running.current = false
      setScan(null)
      setDownload(null)
    }
  }, [finder])

  const onFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      setError(null)
      setStatus('')
      setOpening(true)
      try {
        const added = await openFiles(files)
        if (added.length === 0) throw new Error('These files have no pages.')
        setPages((prev) => [...prev, ...added])
        setCurrentId((cur) => cur ?? added[0].id)
        queue.current.push(...added)
        void pump()
      } catch (err) {
        setError(humanPdfError(err))
      } finally {
        setOpening(false)
      }
    },
    [pump],
  )

  const current = pages.find((p) => p.id === currentId) ?? pages[0] ?? null

  /* Render the page being edited. */
  useEffect(() => {
    if (!current) return
    let alive = true
    void renderPage(current, PREVIEW)
      .then((canvas) => {
        if (!alive) return dropCanvas(canvas)
        if (decorate) {
          const ctx = canvas.getContext('2d')
          if (ctx) decorate(ctx, canvas.width, canvas.height)
        }
        setPreview((old) => {
          // The editor may draw the old canvas once more before it gets the new one.
          if (old) window.setTimeout(() => dropCanvas(old.canvas), 1000)
          return { id: current.id, canvas }
        })
      })
      .catch((err: unknown) => alive && setError(humanPdfError(err)))
    return () => {
      alive = false
    }
  }, [current, decorate])

  function reset() {
    generation.current++
    queue.current = []
    void closeFiles(pages)
    if (preview) dropCanvas(preview.canvas)
    setPreview(null)
    setPages([])
    setCurrentId(null)
    setThumbs(new Map())
    setScanned(new Set())
    onReset()
    setStatus('')
    setError(null)
  }

  async function save() {
    setError(null)
    setStatus('')
    setExporting({ done: 0, total: pages.length })
    try {
      const res = await exportDocs({
        pages,
        boxesOf: (p) => boxesOf(p.id),
        format,
        dpi: EXPORT_DPI,
        rasterAll,
        decorate,
        onProgress: (done, total) => setExporting({ done, total }),
      })
      downloadBlob(res.blob, res.name)
      const hiddenCount = pages.flatMap((p) => boxesOf(p.id)).filter((b) => !b.keep).length
      setStatus(
        format === 'pdf'
          ? `Saved ${res.name} (${formatBytes(res.blob.size)}). ${hiddenCount} ${hiddenCount === 1 ? 'area is' : 'areas are'} covered; ${res.rastered} of ${pages.length} pages became images.`
          : `Saved ${res.name} (${formatBytes(res.blob.size)}).`,
      )
    } catch (err) {
      setError(humanPdfError(err))
    } finally {
      setExporting(null)
    }
  }

  const currentBoxes = current ? boxesOf(current.id) : []

  return (
    <div className="space-y-6">
      {pages.length === 0 && (
        <div className="space-y-3">
          <FileDropzone accept={ACCEPT} multiple onFiles={(f) => void onFiles(f)} maxSizeMb={300} title={dropTitle} hint="PDF, JPG or PNG. Files stay on your device." disabled={opening} />
          {!cached && finder.downloadBytes() > 0 && (
            <p className="text-sm text-muted-foreground">The first file downloads {mb(finder.downloadBytes())} once. After that it works offline.</p>
          )}
        </div>
      )}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
      {opening && <ProgressPanel label="Opening the files" />}
      {download && (
        <ProgressPanel
          label={`Downloading (once): ${mb(download.loaded)} of ${mb(download.total)}`}
          value={download.total > 0 ? (download.loaded / download.total) * 100 : undefined}
        />
      )}
      {scan && !download && (
        <ProgressPanel
          label={`${finder.verb}: page ${scan.index + 1} of ${scan.count}`}
          value={((scan.index + scan.fraction) / Math.max(1, scan.count)) * 100}
        />
      )}
      {exporting && <ProgressPanel label={`Saving page ${Math.min(exporting.total, exporting.done + 1)} of ${exporting.total}`} value={(exporting.done / Math.max(1, exporting.total)) * 100} />}

      {pages.length > 0 && current && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ToolPanel title={title(current, currentBoxes, scanned.has(current.id))} description={description}>
            {pages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Pages">
                {pages.map((p, i) => {
                  const n = boxesOf(p.id).filter((b) => !b.keep).length
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="listitem"
                      aria-current={p.id === current.id}
                      aria-label={`${p.label}: ${scanned.has(p.id) ? `${n} ${n === 1 ? 'area' : 'areas'} hidden` : 'not checked yet'}`}
                      onClick={() => setCurrentId(p.id)}
                      className={cn(
                        'flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        p.id === current.id && 'ring-2 ring-foreground',
                      )}
                    >
                      {thumbs.get(p.id) ? <img src={thumbs.get(p.id)} alt="" className="max-h-full max-w-full" /> : <span className="num text-xs text-muted-foreground">{i + 1}</span>}
                    </button>
                  )
                })}
              </div>
            )}
            {preview && preview.id === current.id ? (
              <RedactionEditor image={preview.canvas} boxes={currentBoxes} onChange={(next) => onEdit(current.id, next)} look={FILL} names={names} />
            ) : (
              <ProgressPanel label="Drawing the page" />
            )}
          </ToolPanel>

          <ToolPanel
            title="Options"
            footer={
              <div className="flex w-full flex-col gap-2">
                <Button size="lg" className="w-full" onClick={() => void save()} disabled={exporting !== null || scan !== null || download !== null}>
                  <Download aria-hidden="true" /> Download {format === 'pdf' ? 'PDF' : pages.length > 1 ? 'ZIP' : format === 'png' ? 'PNG' : 'JPG'}
                </Button>
              </div>
            }
          >
            {options}
            <div className="space-y-2">
              <Label htmlFor="doc-format">Save as</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                <SelectTrigger id="doc-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="png">PNG images</SelectItem>
                  <SelectItem value="jpeg">JPG images</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <RotateCcw aria-hidden="true" /> Start over
            </Button>
          </ToolPanel>
        </div>
      )}

      {pages.length > 0 && <FileDropzone accept={ACCEPT} multiple onFiles={(f) => void onFiles(f)} maxSizeMb={300} title="Add more files" hint="They stay on your device." disabled={opening} />}

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>
    </div>
  )
}
