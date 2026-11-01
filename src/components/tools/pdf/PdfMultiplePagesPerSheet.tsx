import { useCallback, useMemo, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { Formula } from '@/components/shared/Formula'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn, formatBytes, nextFrame } from '@/lib/utils'
import {
  PAPER_SIZES,
  describePageSize,
  displaySize,
  drawEmbeddedRotated,
  embeddedDisplaySize,
  geomOf,
  humanPdfError,
  loadPdfLib,
  mmToPt,
  outputName,
  paperById,
  pdfBlob,
  ptToMm,
  readFileBytes,
  resolveScope,
} from './pdf-pages-core'
import type { PageScope } from './pdf-pages-core'
import { NumberField, PageScopeField, ProofPanel } from './pdf-pages-ui'

type Orientation = 'auto' | 'portrait' | 'landscape'
type Order = 'across' | 'down'

const N_OPTIONS = [2, 4, 6, 9, 16] as const
type NUp = (typeof N_OPTIONS)[number]

/** Column × row grid for N pages on a sheet of the given orientation. */
function gridFor(n: NUp, landscape: boolean): { cols: number; rows: number } {
  switch (n) {
    case 2:
      return landscape ? { cols: 2, rows: 1 } : { cols: 1, rows: 2 }
    case 4:
      return { cols: 2, rows: 2 }
    case 6:
      return landscape ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 }
    case 9:
      return { cols: 3, rows: 3 }
    case 16:
    default:
      return { cols: 4, rows: 4 }
  }
}

interface Outcome {
  blob: Blob
  name: string
  sourcePages: number
  sheets: number
  sheetLabel: string
  scalePercent: number
  cellMm: string
  cols: number
  rows: number
  marginMm: number
  gutterMm: number
}

export default function PdfMultiplePagesPerSheet() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)

  const [perSheet, setPerSheet] = useState<NUp>(2)
  const [sizeId, setSizeId] = useState('a4')
  const [orientation, setOrientation] = useState<Orientation>('auto')
  const [order, setOrder] = useState<Order>('across')
  const [marginMm, setMarginMm] = useState(10)
  const [gutterMm, setGutterMm] = useState(5)
  const [border, setBorder] = useState(false)

  const [scope, setScope] = useState<PageScope>('all')
  const [custom, setCustom] = useState('1-')

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const gridPreview = useMemo(() => {
    const landscape =
      orientation === 'landscape' || (orientation === 'auto' && perSheet !== 4 && perSheet !== 9 && perSheet !== 16)
    return gridFor(perSheet, landscape)
  }, [orientation, perSheet])

  const onFiles = useCallback((files: File[]) => {
    const next = files[0]
    if (!next) return
    setFile(next)
    setOutcome(null)
    setError(null)
    setPageCount(0)
  }, [])

  const run = useCallback(async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setOutcome(null)
    setProgress(0)
    setStatus('Reading the document…')

    try {
      const bytes = await readFileBytes(file)
      const lib = await loadPdfLib()
      const src = await lib.PDFDocument.load(bytes, { updateMetadata: false })
      const srcPages = src.getPages()
      const total = srcPages.length
      setPageCount(total)

      const selectedSet = resolveScope(scope, custom, total)
      const indices = Array.from({ length: total }, (_, i) => i).filter((i) =>
        selectedSet.has(i + 1),
      )
      if (indices.length === 0) throw new Error('That page selection is empty.')

      setStatus('Preparing pages…')
      const out = await lib.PDFDocument.create()
      const title = src.getTitle()
      if (title) out.setTitle(title)

      const chosen = indices.map((i) => srcPages[i])
      const boxes = chosen.map((page) => {
        const g = geomOf(page)
        return { left: g.x, bottom: g.y, right: g.x + g.w, top: g.y + g.h }
      })
      const embedded = await out.embedPages(chosen, boxes)
      const rotations = chosen.map((page) => geomOf(page).rotation)

      /* Sheet size, before orientation. */
      const firstDisplay = displaySize(geomOf(chosen[0]))
      const usingSource = sizeId === 'source'
      const basePortrait = usingSource
        ? {
            w: Math.min(firstDisplay.w, firstDisplay.h),
            h: Math.max(firstDisplay.w, firstDisplay.h),
          }
        : { w: paperById(sizeId).w, h: paperById(sizeId).h }

      const margin = mmToPt(marginMm)
      const gutter = mmToPt(gutterMm)

      /** Best-fit scale for a candidate orientation, used by "auto". */
      const evaluate = (landscape: boolean) => {
        const sheetW = landscape ? basePortrait.h : basePortrait.w
        const sheetH = landscape ? basePortrait.w : basePortrait.h
        const { cols, rows } = gridFor(perSheet, landscape)
        const cellW = (sheetW - 2 * margin - (cols - 1) * gutter) / cols
        const cellH = (sheetH - 2 * margin - (rows - 1) * gutter) / rows
        if (cellW <= 4 || cellH <= 4) return null
        let worst = Number.POSITIVE_INFINITY
        for (let k = 0; k < embedded.length; k++) {
          const c = embeddedDisplaySize(embedded[k], rotations[k])
          worst = Math.min(worst, Math.min(cellW / c.w, cellH / c.h))
        }
        return { sheetW, sheetH, cols, rows, cellW, cellH, scale: worst }
      }

      let layout =
        orientation === 'auto'
          ? (() => {
              const p = evaluate(false)
              const l = evaluate(true)
              if (!p) return l
              if (!l) return p
              return l.scale > p.scale ? l : p
            })()
          : evaluate(orientation === 'landscape')

      if (!layout) {
        throw new Error(
          'The margin and gutter leave no room for the pages. Reduce them, or choose a larger sheet.',
        )
      }
      const { sheetW, sheetH, cols, rows, cellW, cellH } = layout

      setStatus('Composing sheets…')
      const perPage = cols * rows
      const sheets = Math.ceil(embedded.length / perPage)

      for (let s = 0; s < sheets; s++) {
        const page = out.addPage([sheetW, sheetH])
        for (let k = 0; k < perPage; k++) {
          const idx = s * perPage + k
          if (idx >= embedded.length) break
          const col = order === 'across' ? k % cols : Math.floor(k / rows)
          const row = order === 'across' ? Math.floor(k / cols) : k % rows
          const x0 = margin + col * (cellW + gutter)
          const y0 = sheetH - margin - (row + 1) * cellH - row * gutter

          const emb = embedded[idx]
          const rot = rotations[idx]
          const c = embeddedDisplaySize(emb, rot)
          const scale = Math.min(cellW / c.w, cellH / c.h)
          const x = x0 + (cellW - c.w * scale) / 2
          const y = y0 + (cellH - c.h * scale) / 2
          drawEmbeddedRotated(lib, page, emb, rot, x, y, scale)

          if (border) {
            page.drawRectangle({
              x: x0,
              y: y0,
              width: cellW,
              height: cellH,
              borderWidth: 0.5,
              borderColor: lib.rgb(0.65, 0.65, 0.65),
            })
          }
        }
        if (s % 5 === 4) {
          setProgress(Math.round(((s + 1) / sheets) * 100))
          await nextFrame()
        }
      }

      setStatus('Writing the PDF…')
      const outBytes = await out.save({ useObjectStreams: false })
      setProgress(100)
      setOutcome({
        blob: pdfBlob(outBytes),
        name: outputName(file.name, `-${perSheet}-up`),
        sourcePages: embedded.length,
        sheets,
        sheetLabel: describePageSize(sheetW, sheetH),
        scalePercent: layout.scale * 100,
        cellMm: `${ptToMm(cellW).toFixed(0)} × ${ptToMm(cellH).toFixed(0)} mm`,
        cols,
        rows,
        marginMm,
        gutterMm,
      })
      setStatus('')
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }, [border, custom, file, gutterMm, marginMm, order, orientation, perSheet, scope, sizeId])

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={onFiles}
          title="Drop a PDF to print several pages per sheet"
          hint="or click to browse"
        />
        <ProofPanel what="Your PDF" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Layout"
        description="Pages are placed as vector graphics, so text stays sharp and selectable at any zoom."
      >
        {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

        <p className="truncate text-sm text-muted-foreground" title={file.name}>
          {file.name} · {formatBytes(file.size)}
        </p>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nup-count">Pages per sheet</Label>
              <Select
                value={String(perSheet)}
                onValueChange={(v) => setPerSheet(Number(v) as NUp)}
                disabled={busy}
              >
                <SelectTrigger id="nup-count" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {N_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} pages per sheet
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nup-sheet">Sheet size</Label>
              <Select value={sizeId} onValueChange={setSizeId} disabled={busy}>
                <SelectTrigger id="nup-sheet" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="source">Same as the source pages</SelectItem>
                  {PAPER_SIZES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nup-orientation">Sheet orientation</Label>
              <Select
                value={orientation}
                onValueChange={(v) => setOrientation(v as Orientation)}
                disabled={busy}
              >
                <SelectTrigger id="nup-orientation" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (whichever fits biggest)</SelectItem>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nup-order">Placement order</Label>
              <Select value={order} onValueChange={(v) => setOrder(v as Order)} disabled={busy}>
                <SelectTrigger id="nup-order" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="across">Across, then down</SelectItem>
                  <SelectItem value="down">Down, then across</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <NumberField
              label="Outer margin"
              suffix="mm"
              min={0}
              max={40}
              value={marginMm}
              onChange={setMarginMm}
            />
            <NumberField
              label="Gap between pages"
              suffix="mm"
              min={0}
              max={40}
              value={gutterMm}
              onChange={setGutterMm}
            />
          </div>

          {/* Live grid diagram */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Preview</p>
            <div
              className={cn(
                'mx-auto grid gap-1 rounded-md bg-muted p-2',
                gridPreview.cols === 1 && 'w-24',
                gridPreview.cols === 2 && 'w-32',
                gridPreview.cols === 3 && 'w-40',
                gridPreview.cols === 4 && 'w-44',
              )}
              style={{ gridTemplateColumns: `repeat(${gridPreview.cols}, minmax(0, 1fr))` }}
              aria-hidden="true"
            >
              {Array.from({ length: gridPreview.cols * gridPreview.rows }, (_, i) => (
                <div
                  key={i}
                  className="grid aspect-[1/1.414] place-items-center rounded-sm bg-background text-[10px] tabular-nums text-muted-foreground"
                >
                  {order === 'across'
                    ? i + 1
                    : (i % gridPreview.cols) * gridPreview.rows +
                      Math.floor(i / gridPreview.cols) +
                      1}
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {gridPreview.cols} × {gridPreview.rows} grid
            </p>

            <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
              <Label htmlFor="nup-border" className="cursor-pointer text-sm">
                Draw a thin border
              </Label>
              <Switch
                id="nup-border"
                checked={border}
                onCheckedChange={setBorder}
                disabled={busy}
              />
            </div>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel title="Which pages">
        <PageScopeField
          scope={scope}
          onScopeChange={setScope}
          custom={custom}
          onCustomChange={setCustom}
          pageCount={pageCount}
          label="Include"
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" className="gap-2" onClick={() => void run()} disabled={busy}>
            <LayoutGrid className="size-4" aria-hidden="true" />
            {busy ? 'Composing…' : `Make ${perSheet}-up PDF`}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFile(null)
              setOutcome(null)
              setError(null)
            }}
            disabled={busy}
          >
            Use a different file
          </Button>
        </div>
      </ToolPanel>

      {busy && <ProgressPanel label={status || 'Composing…'} value={progress} />}

      {outcome && (
        <ToolPanel title="Sheets ready">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Source pages" value={outcome.sourcePages} />
            <ResultStat label="Sheets to print" value={outcome.sheets} emphasis />
            <ResultStat label="Output size" value={formatBytes(outcome.blob.size)} />
          </div>

          <Formula caption="How the cell size, and so the shrink factor, was worked out.">
            {`sheet          = ${outcome.sheetLabel}
grid           = ${outcome.cols} across × ${outcome.rows} down
cell           = (sheet − 2 × ${outcome.marginMm} mm margin − gaps of ${outcome.gutterMm} mm) ÷ grid
               = ${outcome.cellMm}
content scale  = ${outcome.scalePercent.toFixed(1)}% of original size
paper saved    = ${outcome.sourcePages} pages → ${outcome.sheets} sheets (${(
              100 -
              (outcome.sheets / outcome.sourcePages) * 100
            ).toFixed(0)}% fewer)`}
          </Formula>

          <p className="text-sm text-muted-foreground text-pretty">
            Print this at 100% (&ldquo;actual size&rdquo;). If the printer scales it again, the
            text shrinks a second time.
          </p>

          <DownloadButton blob={outcome.blob} filename={outcome.name} label="Download N-up PDF" />
        </ToolPanel>
      )}

      <ProofPanel what="Your PDF" />
    </div>
  )
}
