import { useCallback, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { cn, clamp, formatBytes, formatNumber, nextFrame } from '@/lib/utils'
import {
  allPages,
  displaySize,
  findUnsupportedCharacter,
  hexToRgb01,
  humanPdfError,
  loadPdfLib,
  mapDisplayToPage,
  outputName,
  parsePageRanges,
  pdfBlob,
  readFileBytes,
} from './pdf-shared'
import { useSinglePagePreview } from './useSinglePagePreview'

type Corner =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

type FormatId = 'plain' | 'slash' | 'page-of' | 'custom'

const CORNERS: { id: Corner; label: string }[] = [
  { id: 'top-left', label: 'Top left' },
  { id: 'top-center', label: 'Top centre' },
  { id: 'top-right', label: 'Top right' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'bottom-center', label: 'Bottom centre' },
  { id: 'bottom-right', label: 'Bottom right' },
]

const FONTS = [
  { id: 'Helvetica', label: 'Helvetica (sans-serif)', css: 'Helvetica, Arial, sans-serif' },
  { id: 'Times', label: 'Times (serif)', css: '"Times New Roman", Times, serif' },
  { id: 'Courier', label: 'Courier (monospace)', css: '"Courier New", Courier, monospace' },
] as const

type FontId = (typeof FONTS)[number]['id']

export default function AddPageNumbers() {
  const [file, setFile] = useState<File | null>(null)
  const [corner, setCorner] = useState<Corner>('bottom-center')
  const [startNumber, setStartNumber] = useState('1')
  const [rangeSpec, setRangeSpec] = useState('')
  const [fontSize, setFontSize] = useState('11')
  const [margin, setMargin] = useState('28')
  const [format, setFormat] = useState<FormatId>('plain')
  const [pattern, setPattern] = useState('Page {n} of {total}')
  const [color, setColor] = useState('#333333')
  const [fontId, setFontId] = useState<FontId>('Helvetica')
  const [bold, setBold] = useState(false)
  const [previewPage, setPreviewPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; filename: string; stamped: number } | null>(
    null,
  )

  const { preview, pageCount, loading, error: previewError } = useSinglePagePreview(
    file,
    previewPage,
    340,
  )

  const onFiles = useCallback((files: File[]) => {
    const next = files[0]
    if (!next) return
    setFile(next)
    setResult(null)
    setError(null)
    setPreviewPage(1)
  }, [])

  const targetPages = useMemo(() => {
    if (!pageCount) return { pages: [] as number[], error: null as string | null }
    if (!rangeSpec.trim()) return { pages: allPages(pageCount), error: null }
    try {
      return { pages: parsePageRanges(rangeSpec, pageCount).sort((a, b) => a - b), error: null }
    } catch (err) {
      return { pages: [] as number[], error: err instanceof Error ? err.message : String(err) }
    }
  }, [rangeSpec, pageCount])

  const start = Math.round(Number(startNumber) || 1)
  const size = clamp(Number(fontSize) || 11, 4, 96)
  const marginPt = clamp(Number(margin) || 0, 0, 200)
  const total = start + Math.max(targetPages.pages.length, 1) - 1

  const labelFor = (n: number, physical: number): string => {
    switch (format) {
      case 'slash':
        return `${n}/${total}`
      case 'page-of':
        return `Page ${n} of ${total}`
      case 'custom':
        return pattern
          .replaceAll('{n}', String(n))
          .replaceAll('{total}', String(total))
          .replaceAll('{p}', String(physical))
      default:
        return String(n)
    }
  }

  const previewIndexInRange = targetPages.pages.indexOf(preview?.page ?? previewPage)
  const previewLabel =
    previewIndexInRange >= 0
      ? labelFor(start + previewIndexInRange, preview?.page ?? previewPage)
      : null

  const stamp = async () => {
    if (!file || targetPages.pages.length === 0) return
    const bad = findUnsupportedCharacter(labelFor(start, 1))
    if (bad) {
      setError(
        `The character “${bad}” cannot be drawn with the built-in PDF fonts. Stick to Latin characters and common punctuation.`,
      )
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    setProgress(0)
    try {
      const bytes = await readFileBytes(file)
      const { PDFDocument, StandardFonts, degrees, rgb } = await loadPdfLib()
      const doc = await PDFDocument.load(bytes, { updateMetadata: false })
      const fontName =
        fontId === 'Times'
          ? bold
            ? StandardFonts.TimesRomanBold
            : StandardFonts.TimesRoman
          : fontId === 'Courier'
            ? bold
              ? StandardFonts.CourierBold
              : StandardFonts.Courier
            : bold
              ? StandardFonts.HelveticaBold
              : StandardFonts.Helvetica
      const font = await doc.embedFont(fontName)
      const { r, g, b } = hexToRgb01(color)
      const pages = doc.getPages()

      for (let i = 0; i < targetPages.pages.length; i++) {
        const physical = targetPages.pages[i]
        const page = pages[physical - 1]
        if (!page) continue
        const text = labelFor(start + i, physical)
        const { width: W, height: H } = page.getSize()
        const rotation = page.getRotation().angle
        const disp = displaySize(W, H, rotation)
        const textWidth = font.widthOfTextAtSize(text, size)

        const dx = corner.endsWith('left')
          ? marginPt
          : corner.endsWith('right')
            ? disp.w - marginPt - textWidth
            : (disp.w - textWidth) / 2
        const dy = corner.startsWith('bottom') ? marginPt : disp.h - marginPt - size

        const { x, y } = mapDisplayToPage(dx, dy, W, H, rotation)
        page.drawText(text, {
          x,
          y,
          size,
          font,
          color: rgb(r, g, b),
          rotate: degrees(rotation),
        })

        if (i % 25 === 0) {
          setProgress(Math.round((i / targetPages.pages.length) * 90))
          await nextFrame()
        }
      }

      doc.setProducer('onthisdevice.com')
      const saved = await doc.save({ useObjectStreams: true })
      setResult({
        blob: pdfBlob(saved),
        filename: outputName(file.name, '-numbered'),
        stamped: targetPages.pages.length,
      })
      setProgress(100)
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }

  const activeFont = FONTS.find((f) => f.id === fontId) ?? FONTS[0]
  const previewScale = preview ? preview.w / preview.widthPt : 1

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
      {previewError && <ErrorNote message={previewError} />}

      {file && (loading || pageCount > 0) && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <ToolPanel
            title="Numbering options"
            description={`${file.name}${pageCount ? ` · ${formatNumber(pageCount, 0)} pages` : ''}`}
            footer={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => void stamp()}
                  disabled={busy || targetPages.pages.length === 0}
                >
                  <ListOrdered className="mr-2 size-4" aria-hidden="true" />
                  Add numbers to {targetPages.pages.length} page
                  {targetPages.pages.length === 1 ? '' : 's'}
                </Button>
                {targetPages.error && (
                  <span className="text-sm text-destructive" role="alert">
                    {targetPages.error}
                  </span>
                )}
              </div>
            }
          >
            <div className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Position</legend>
                <div className="grid max-w-sm grid-cols-3 gap-2">
                  {CORNERS.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant={corner === c.id ? 'default' : 'outline'}
                      size="sm"
                      aria-pressed={corner === c.id}
                      onClick={() => {
                        setCorner(c.id)
                        setResult(null)
                      }}
                    >
                      {c.label}
                    </Button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pn-format">Number format</Label>
                  <Select
                    value={format}
                    onValueChange={(v) => {
                      setFormat(v as FormatId)
                      setResult(null)
                    }}
                  >
                    <SelectTrigger id="pn-format">
                      <SelectValue placeholder="Choose a format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plain">1</SelectItem>
                      <SelectItem value="slash">1/{total}</SelectItem>
                      <SelectItem value="page-of">Page 1 of {total}</SelectItem>
                      <SelectItem value="custom">Custom pattern…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {format === 'custom' && (
                  <div className="space-y-2">
                    <Label htmlFor="pn-pattern">Pattern</Label>
                    <Input
                      id="pn-pattern"
                      value={pattern}
                      onChange={(e) => {
                        setPattern(e.target.value)
                        setResult(null)
                      }}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      {'{n}'} = printed number, {'{total}'} = last number, {'{p}'} = physical page.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="pn-start">First number</Label>
                  <Input
                    id="pn-start"
                    type="number"
                    value={startNumber}
                    onChange={(e) => {
                      setStartNumber(e.target.value)
                      setResult(null)
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pn-range">Pages to number</Label>
                  <Input
                    id="pn-range"
                    value={rangeSpec}
                    placeholder={pageCount ? `all (1-${pageCount})` : 'all'}
                    onChange={(e) => {
                      setRangeSpec(e.target.value)
                      setResult(null)
                    }}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pn-size">Font size (pt)</Label>
                  <Input
                    id="pn-size"
                    type="number"
                    min={4}
                    max={96}
                    value={fontSize}
                    onChange={(e) => {
                      setFontSize(e.target.value)
                      setResult(null)
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pn-margin">Margin from edge (pt)</Label>
                  <Input
                    id="pn-margin"
                    type="number"
                    min={0}
                    max={200}
                    value={margin}
                    onChange={(e) => {
                      setMargin(e.target.value)
                      setResult(null)
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pn-font">Font</Label>
                  <Select
                    value={fontId}
                    onValueChange={(v) => {
                      setFontId(v as FontId)
                      setResult(null)
                    }}
                  >
                    <SelectTrigger id="pn-font">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONTS.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pn-color">Colour</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="pn-color"
                      type="color"
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value)
                        setResult(null)
                      }}
                      className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                    />
                    <Input
                      aria-label="Colour hex value"
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value)
                        setResult(null)
                      }}
                      className="w-28 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    id="pn-bold"
                    checked={bold}
                    onCheckedChange={(v) => {
                      setBold(v)
                      setResult(null)
                    }}
                  />
                  <Label htmlFor="pn-bold">Bold</Label>
                </div>
              </div>
            </div>
          </ToolPanel>

          <ToolPanel title="Live preview" description="Exactly where the number will sit on the page.">
            <div className="flex flex-col items-center gap-3">
              <div
                className="relative overflow-hidden rounded-md border border-border"
                style={{ width: preview?.w ?? 340, height: preview?.h ?? 440 }}
              >
                {preview ? (
                  <>
                    <img
                      src={preview.url}
                      alt={`Page ${preview.page} preview`}
                      width={preview.w}
                      height={preview.h}
                      className="block"
                    />
                    {previewLabel !== null && (
                      <span
                        className="pointer-events-none absolute whitespace-pre"
                        style={{
                          color,
                          fontFamily: activeFont.css,
                          fontWeight: bold ? 700 : 400,
                          fontSize: size * previewScale,
                          lineHeight: 1,
                          ...(corner.startsWith('bottom')
                            ? { bottom: marginPt * previewScale }
                            : { top: marginPt * previewScale }),
                          ...(corner.endsWith('left')
                            ? { left: marginPt * previewScale }
                            : corner.endsWith('right')
                              ? { right: marginPt * previewScale }
                              : { left: '50%', transform: 'translateX(-50%)' }),
                        }}
                      >
                        {previewLabel}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="h-full w-full animate-pulse bg-muted" aria-hidden="true" />
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Preview previous page"
                  disabled={previewPage <= 1}
                  onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <span className="text-sm tabular-nums text-muted-foreground">
                  Page {preview?.page ?? previewPage} of {pageCount || '…'}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Preview next page"
                  disabled={previewPage >= pageCount}
                  onClick={() => setPreviewPage((p) => Math.min(pageCount, p + 1))}
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <p className={cn('text-xs text-muted-foreground', previewLabel === null && 'text-warning')}>
                {previewLabel === null
                  ? 'This page is outside the selected range, so it will not be numbered.'
                  : `This page will read “${previewLabel}”.`}
              </p>
            </div>
          </ToolPanel>
        </div>
      )}

      {busy && <ProgressPanel label="Stamping page numbers…" value={progress} />}

      {result && !busy && (
        <ToolPanel title="Numbered PDF ready" description="The numbers are drawn into the page content, ready to print.">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Pages numbered" value={formatNumber(result.stamped, 0)} emphasis />
            <ResultStat label="First number" value={formatNumber(start, 0)} hint={`last: ${total}`} />
            <ResultStat label="File size" value={formatBytes(result.blob.size)} />
          </div>
          <div className="mt-4">
            <DownloadButton blob={result.blob} filename={result.filename} label="Download numbered PDF" />
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
