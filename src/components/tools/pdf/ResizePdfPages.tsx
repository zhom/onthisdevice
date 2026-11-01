import { useCallback, useMemo, useState } from 'react'
import { Frame, RectangleVertical, Scaling } from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, nextFrame } from '@/lib/utils'
import {
  PAPER_SIZES,
  describePageSize,
  displayRectToPageBox,
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
  readFileBytes,
  resolveScope,
} from './pdf-pages-core'
import type { PageScope } from './pdf-pages-core'
import { NumberField, PageScopeField, ProofPanel } from './pdf-pages-ui'

export type ResizeMode = 'resize' | 'margins' | 'a4'

type Orientation = 'auto' | 'portrait' | 'landscape'
type Fit = 'fit' | 'original'

interface RowSummary {
  page: number
  from: string
  to: string
  scale: string
}

interface Outcome {
  blob: Blob
  name: string
  pages: number
  rows: RowSummary[]
  lossless: boolean
}

const MODE_COPY: Record<
  ResizeMode,
  { action: string; busy: string; dropTitle: string; suffix: string }
> = {
  resize: {
    action: 'Resize pages',
    busy: 'Resizing…',
    dropTitle: 'Drop a PDF to resize its pages',
    suffix: '-resized',
  },
  margins: {
    action: 'Add margins',
    busy: 'Adding margins…',
    dropTitle: 'Drop a PDF to add margins',
    suffix: '-margins',
  },
  a4: {
    action: 'Convert to A4',
    busy: 'Converting to A4…',
    dropTitle: 'Drop a PDF to convert it to A4',
    suffix: '-a4',
  },
}

export default function ResizePdfPages({ mode = 'resize' }: { mode?: ResizeMode }) {
  const copy = MODE_COPY[mode]

  const [file, setFile] = useState<File | null>(null)
  const [sizeId, setSizeId] = useState('a4')
  const [orientation, setOrientation] = useState<Orientation>('auto')
  const [fit, setFit] = useState<Fit>('fit')

  const [uniform, setUniform] = useState(true)
  const [marginAll, setMarginAll] = useState(mode === 'margins' ? 20 : 0)
  const [marginTop, setMarginTop] = useState(20)
  const [marginRight, setMarginRight] = useState(20)
  const [marginBottom, setMarginBottom] = useState(20)
  const [marginLeft, setMarginLeft] = useState(25)
  const [mirror, setMirror] = useState(false)
  const [growSheet, setGrowSheet] = useState(true)

  const [scope, setScope] = useState<PageScope>('all')
  const [custom, setCustom] = useState('1-')

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const margins = useMemo(() => {
    if (mode !== 'margins') return { top: 0, right: 0, bottom: 0, left: 0 }
    if (uniform) return { top: marginAll, right: marginAll, bottom: marginAll, left: marginAll }
    return { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }
  }, [marginAll, marginBottom, marginLeft, marginRight, marginTop, mode, uniform])

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
      const selected = resolveScope(scope, custom, total)
      if (selected.size === 0) throw new Error('That page selection is empty.')

      const rows: RowSummary[] = []
      const lossless = mode === 'margins' && growSheet

      /* ---- Lossless path: grow the page boxes, touch nothing else ---- */
      if (lossless) {
        setStatus('Expanding page boxes…')
        for (let i = 0; i < total; i++) {
          const page = srcPages[i]
          if (selected.has(i + 1)) {
            const g = geomOf(page)
            const d = displaySize(g)
            const odd = (i + 1) % 2 === 1
            const ml = mirror && !odd ? margins.right : margins.left
            const mr = mirror && !odd ? margins.left : margins.right
            const box = displayRectToPageBox(
              g,
              -mmToPt(ml),
              -mmToPt(margins.top),
              d.w + mmToPt(mr),
              d.h + mmToPt(margins.bottom),
            )
            const w = box.right - box.left
            const h = box.top - box.bottom
            page.setMediaBox(box.left, box.bottom, w, h)
            page.setCropBox(box.left, box.bottom, w, h)
            if (rows.length < 8) {
              const nd = displaySize({ ...g, x: box.left, y: box.bottom, w, h })
              rows.push({
                page: i + 1,
                from: describePageSize(d.w, d.h),
                to: describePageSize(nd.w, nd.h),
                scale: '100% (content untouched)',
              })
            }
          }
          if (i % 25 === 24) {
            setProgress(Math.round(((i + 1) / total) * 100))
            await nextFrame()
          }
        }
        setStatus('Writing the PDF…')
        const outBytes = await src.save({ useObjectStreams: false })
        setOutcome({
          blob: pdfBlob(outBytes),
          name: outputName(file.name, copy.suffix),
          pages: selected.size,
          rows,
          lossless: true,
        })
        setProgress(100)
        setStatus('')
        return
      }

      /* ---- Rebuild path: re-lay each page onto a new sheet ---- */
      setStatus('Preparing pages…')
      const out = await lib.PDFDocument.create()
      const title = src.getTitle()
      const author = src.getAuthor()
      const subject = src.getSubject()
      if (title) out.setTitle(title)
      if (author) out.setAuthor(author)
      if (subject) out.setSubject(subject)

      const boxes = srcPages.map((page) => {
        const g = geomOf(page)
        return { left: g.x, bottom: g.y, right: g.x + g.w, top: g.y + g.h }
      })
      const embedded = await out.embedPages(srcPages, boxes)

      setStatus(`Laying out ${total} pages…`)
      for (let i = 0; i < total; i++) {
        const g = geomOf(srcPages[i])
        const emb = embedded[i]
        const content = embeddedDisplaySize(emb, g.rotation)

        if (!selected.has(i + 1)) {
          // Untouched pages keep their exact original geometry.
          const page = out.addPage([content.w, content.h])
          drawEmbeddedRotated(lib, page, emb, g.rotation, 0, 0, 1)
          continue
        }

        const odd = (i + 1) % 2 === 1
        const ml = mmToPt(mirror && !odd ? margins.right : margins.left)
        const mr = mmToPt(mirror && !odd ? margins.left : margins.right)
        const mt = mmToPt(margins.top)
        const mb = mmToPt(margins.bottom)

        let sheetW: number
        let sheetH: number

        if (mode === 'margins') {
          sheetW = content.w
          sheetH = content.h
        } else {
          const paper = paperById(mode === 'a4' ? 'a4' : sizeId)
          const wantLandscape =
            orientation === 'landscape' ||
            (orientation === 'auto' && content.w > content.h)
          sheetW = wantLandscape ? paper.h : paper.w
          sheetH = wantLandscape ? paper.w : paper.h
        }

        const availW = Math.max(1, sheetW - ml - mr)
        const availH = Math.max(1, sheetH - mt - mb)
        const scale =
          fit === 'original' ? 1 : Math.min(availW / content.w, availH / content.h)

        const page = out.addPage([sheetW, sheetH])
        const x = ml + (availW - content.w * scale) / 2
        const y = mb + (availH - content.h * scale) / 2
        drawEmbeddedRotated(lib, page, emb, g.rotation, x, y, scale)

        if (rows.length < 8) {
          rows.push({
            page: i + 1,
            from: describePageSize(content.w, content.h),
            to: describePageSize(sheetW, sheetH),
            scale: `${(scale * 100).toFixed(1)}%`,
          })
        }

        if (i % 10 === 9) {
          setProgress(Math.round(((i + 1) / total) * 100))
          await nextFrame()
        }
      }

      setStatus('Writing the PDF…')
      const outBytes = await out.save({ useObjectStreams: false })
      setOutcome({
        blob: pdfBlob(outBytes),
        name: outputName(file.name, copy.suffix),
        pages: selected.size,
        rows,
        lossless: false,
      })
      setProgress(100)
      setStatus('')
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }, [copy.suffix, custom, file, fit, growSheet, margins, mirror, mode, orientation, scope, sizeId])

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={onFiles}
          title={copy.dropTitle}
          hint="or click to browse"
        />
        <ProofPanel what="Your PDF" />
      </div>
    )
  }

  const Glyph = mode === 'margins' ? Frame : mode === 'a4' ? RectangleVertical : Scaling

  return (
    <div className="space-y-5">
      <ToolPanel
        title={mode === 'margins' ? 'Margins' : 'Target page size'}
        description={
          mode === 'margins'
            ? 'Extra white space added around the existing page content, in millimetres.'
            : mode === 'a4'
              ? 'Every selected page is placed on an A4 sheet, scaled to fit without distortion.'
              : 'Every selected page is re-laid onto the sheet you pick, scaled to fit without distortion.'
        }
      >
        {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

        <p className="truncate text-sm text-muted-foreground" title={file.name}>
          {file.name} · {formatBytes(file.size)}
        </p>

        {mode === 'margins' ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
              <div className="min-w-0">
                <Label htmlFor="margin-uniform" className="cursor-pointer">
                  Same margin on all four sides
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Turn off for a wider binding edge or an annotation strip.
                </p>
              </div>
              <Switch
                id="margin-uniform"
                checked={uniform}
                onCheckedChange={setUniform}
                disabled={busy}
              />
            </div>

            {uniform ? (
              <NumberField
                label="Margin"
                suffix="mm"
                min={0}
                max={150}
                step={1}
                value={marginAll}
                onChange={setMarginAll}
                hint="20 mm is a typical printable margin; 25 mm suits a three-hole punch."
                className="max-w-xs"
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumberField
                  label="Top"
                  suffix="mm"
                  min={0}
                  max={150}
                  value={marginTop}
                  onChange={setMarginTop}
                />
                <NumberField
                  label="Right"
                  suffix="mm"
                  min={0}
                  max={150}
                  value={marginRight}
                  onChange={setMarginRight}
                />
                <NumberField
                  label="Bottom"
                  suffix="mm"
                  min={0}
                  max={150}
                  value={marginBottom}
                  onChange={setMarginBottom}
                />
                <NumberField
                  label="Left"
                  suffix="mm"
                  min={0}
                  max={150}
                  value={marginLeft}
                  onChange={setMarginLeft}
                />
              </div>
            )}

            {!uniform && (
              <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
                <div className="min-w-0">
                  <Label htmlFor="margin-mirror" className="cursor-pointer">
                    Mirror margins for double-sided printing
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Swaps left and right on even pages so the binding margin always falls on the
                    inside edge.
                  </p>
                </div>
                <Switch
                  id="margin-mirror"
                  checked={mirror}
                  onCheckedChange={setMirror}
                  disabled={busy}
                />
              </div>
            )}

            <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
              <div className="min-w-0">
                <Label htmlFor="margin-grow" className="cursor-pointer">
                  Grow the sheet (lossless)
                </Label>
                <p className="mt-1 text-xs text-muted-foreground text-pretty">
                  On: the paper gets bigger and nothing inside the page moves, so links, bookmarks and
                  form fields are kept. Off: the paper stays the same size and the content is
                  shrunk to make room, which rebuilds each page.
                </p>
              </div>
              <Switch
                id="margin-grow"
                checked={growSheet}
                onCheckedChange={setGrowSheet}
                disabled={busy}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === 'resize' && (
              <div className="space-y-2">
                <Label htmlFor="paper-size">Sheet size</Label>
                <Select value={sizeId} onValueChange={setSizeId} disabled={busy}>
                  <SelectTrigger id="paper-size" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPER_SIZES.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="paper-orientation">Orientation</Label>
              <Select
                value={orientation}
                onValueChange={(v) => setOrientation(v as Orientation)}
                disabled={busy}
              >
                <SelectTrigger id="paper-orientation" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Match each page (recommended)</SelectItem>
                  <SelectItem value="portrait">Always portrait</SelectItem>
                  <SelectItem value="landscape">Always landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paper-fit">Content scaling</Label>
              <Select value={fit} onValueChange={(v) => setFit(v as Fit)} disabled={busy}>
                <SelectTrigger id="paper-fit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fit">Scale to fit the sheet</SelectItem>
                  <SelectItem value="original">Keep original size and centre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </ToolPanel>

      <ToolPanel title="Which pages">
        <PageScopeField
          scope={scope}
          onScopeChange={setScope}
          custom={custom}
          onCustomChange={setCustom}
          pageCount={pageCount}
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" className="gap-2" onClick={() => void run()} disabled={busy}>
            <Glyph className="size-4" aria-hidden="true" />
            {busy ? copy.busy : copy.action}
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

      {busy && <ProgressPanel label={status || copy.busy} value={progress} />}

      {outcome && (
        <ToolPanel title="Done">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Pages changed" value={outcome.pages} />
            <ResultStat label="Output size" value={formatBytes(outcome.blob.size)} />
            <ResultStat
              label="Method"
              value={outcome.lossless ? 'Lossless' : 'Re-laid out'}
              hint={
                outcome.lossless
                  ? 'Only the page boxes changed'
                  : 'Pages redrawn onto new sheets'
              }
            />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Was</TableHead>
                  <TableHead>Now</TableHead>
                  <TableHead>Content scale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outcome.rows.map((row) => (
                  <TableRow key={row.page}>
                    <TableCell className="tabular-nums">{row.page}</TableCell>
                    <TableCell>{row.from}</TableCell>
                    <TableCell>{row.to}</TableCell>
                    <TableCell className="tabular-nums">{row.scale}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {outcome.pages > outcome.rows.length && (
            <p className="text-xs text-muted-foreground">
              Showing the first {outcome.rows.length} changed pages; the rest used the same rule.
            </p>
          )}

          {!outcome.lossless && (
            <p className="text-sm text-muted-foreground text-pretty">
              Text and vectors stay vector (nothing was rasterised), but because each page is drawn
              onto a fresh sheet, link annotations, bookmarks and form fields are not carried over.
            </p>
          )}

          <DownloadButton blob={outcome.blob} filename={outcome.name} label="Download PDF" />
        </ToolPanel>
      )}

      <ProofPanel what="Your PDF" />
    </div>
  )
}
