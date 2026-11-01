import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileDown, Info, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { fileExtension, formatBytes, formatNumber, stripExtension } from '@/lib/utils'
import { PAGE_SIZES, mmToPt, pageSizeById } from './pdf-common'
import type { FontFamily } from './pdf-layout'
import type { RichBlock } from './rich-blocks'

const FAMILY_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: 'helvetica', label: 'Helvetica (sans serif)' },
  { value: 'times', label: 'Times (serif)' },
  { value: 'courier', label: 'Courier (monospaced)' },
]

export default function WordToPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [blocks, setBlocks] = useState<RichBlock[]>([])
  const [skippedImages, setSkippedImages] = useState(0)
  const [tableCount, setTableCount] = useState(0)
  const [reading, setReading] = useState(false)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Blob | null>(null)
  const [dropped, setDropped] = useState(0)
  const [pageCount, setPageCount] = useState(0)

  const [sizeId, setSizeId] = useState('a4')
  const [family, setFamily] = useState<FontFamily>('helvetica')
  const [fontSize, setFontSize] = useState(11)
  const [marginMm, setMarginMm] = useState(20)
  const [pageNumbers, setPageNumbers] = useState(true)

  const readDocx = useCallback(async (picked: File) => {
    setError(null)
    setResult(null)
    setBlocks([])
    setFile(picked)
    setReading(true)
    try {
      if (fileExtension(picked.name) === 'doc') {
        throw new Error(
          'This is a legacy .doc file. Open it in Word or LibreOffice and save it as .docx, then convert it here.',
        )
      }
      const [mammothModule, { htmlToBlocks }] = await Promise.all([import('mammoth'), import('./rich-blocks')])
      const mammoth = mammothModule.default
      const arrayBuffer = await picked.arrayBuffer()
      const { value } = await mammoth.convertToHtml({ arrayBuffer })
      const parsed = htmlToBlocks(value)
      if (parsed.blocks.length === 0) {
        throw new Error('The document appears to be empty. No paragraphs, headings or lists were found.')
      }
      setBlocks(parsed.blocks)
      setSkippedImages(parsed.images)
      setTableCount(parsed.tables)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setError(
        /legacy \.doc|empty/.test(message)
          ? message
          : `That .docx could not be read${message ? ` (${message})` : ''}. Make sure it is a real Word document and not renamed from another format.`,
      )
      setFile(null)
    } finally {
      setReading(false)
    }
  }, [])

  const handleFiles = useCallback(
    (files: File[]) => {
      const picked = files[0]
      if (picked) void readDocx(picked)
    },
    [readDocx],
  )

  const reset = useCallback(() => {
    setFile(null)
    setBlocks([])
    setResult(null)
    setError(null)
    setDropped(0)
    setPageCount(0)
    setSkippedImages(0)
    setTableCount(0)
  }, [])

  // Any layout change invalidates the PDF we already produced.
  useEffect(() => {
    setResult(null)
  }, [sizeId, family, fontSize, marginMm, pageNumbers])

  const build = useCallback(async () => {
    if (blocks.length === 0 || !file) return
    setBuilding(true)
    setError(null)
    setResult(null)
    try {
      const [{ PdfWriter, toBlob }, { renderBlocks }] = await Promise.all([
        import('./pdf-layout'),
        import('./rich-blocks'),
      ])
      const size = pageSizeById(sizeId)
      const margin = mmToPt(marginMm)
      const writer = await PdfWriter.create({
        size,
        margins: { top: margin, right: margin, bottom: margin, left: margin },
        lineHeight: 1.42,
        family,
        pageNumbers,
      })
      const { dropped: substituted } = renderBlocks(writer, blocks, fontSize)
      const bytes = await writer.save({ title: stripExtension(file.name) })
      setDropped(substituted)
      setPageCount(writer.pageCount)
      setResult(toBlob(bytes, 'application/pdf'))
    } catch (err) {
      setError(
        err instanceof Error
          ? `The PDF could not be produced (${err.message}).`
          : 'The PDF could not be produced.',
      )
    } finally {
      setBuilding(false)
    }
  }, [blocks, family, file, fontSize, marginMm, pageNumbers, sizeId])

  const counts = useMemo(() => {
    let headings = 0
    let paragraphs = 0
    let listItems = 0
    let words = 0
    for (const block of blocks) {
      if (block.kind === 'heading') headings++
      if (block.kind === 'paragraph') paragraphs++
      if (block.kind === 'list-item') listItems++
      if (block.kind === 'heading' || block.kind === 'paragraph' || block.kind === 'list-item' || block.kind === 'quote') {
        words += block.runs
          .map((run) => run.text)
          .join('')
          .split(/\s+/)
          .filter((w) => w !== '').length
      }
    }
    return { headings, paragraphs, listItems, words }
  }, [blocks])

  return (
    <div className="space-y-6">
      {!file && (
        <FileDropzone
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onFiles={handleFiles}
          maxSizeMb={100}
          title="Drop a .docx file here"
          hint="or click to browse. The document is read on your device."
        />
      )}

      <div className="flex items-start gap-3 rounded-lg bg-muted p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">The text is typeset again, and the original layout is not kept</p>
          <p className="text-muted-foreground">
            Headings, paragraphs, bold, italic, bullet and numbered lists, blockquotes, simple tables and horizontal
            rules are carried over. Images, columns, text boxes, footnotes, headers and footers, colours and your
            document’s own fonts are not. Matching those needs Word’s layout engine, which no browser has.
          </p>
        </div>
      </div>

      {error && <ErrorNote message={error} onRetry={reset} />}

      {reading && <ProgressPanel label="Reading the document…" />}

      {blocks.length > 0 && (
        <ToolPanel
          title="PDF settings"
          description={file ? `${file.name} · ${formatBytes(file.size)}` : undefined}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={build} disabled={building}>
                <FileDown className="size-4" aria-hidden="true" />
                {building ? 'Typesetting…' : result ? 'Rebuild PDF' : 'Create PDF'}
              </Button>
              {result && (
                <DownloadButton
                  blob={result}
                  filename={`${stripExtension(file?.name ?? 'document')}.pdf`}
                  label="Download PDF"
                />
              )}
              <Button variant="ghost" onClick={reset} disabled={building}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Start over
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultStat label="Words" value={formatNumber(counts.words, 0)} emphasis />
            <ResultStat label="Headings" value={formatNumber(counts.headings, 0)} />
            <ResultStat label="Paragraphs" value={formatNumber(counts.paragraphs, 0)} />
            <ResultStat label="List items" value={formatNumber(counts.listItems, 0)} />
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wtp-size">Page size</Label>
              <Select value={sizeId} onValueChange={setSizeId} disabled={building}>
                <SelectTrigger id="wtp-size" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size.id} value={size.id}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wtp-font">Typeface</Label>
              <Select
                value={family}
                onValueChange={(value) => setFamily(value as FontFamily)}
                disabled={building}
              >
                <SelectTrigger id="wtp-font" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAMILY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Standard PDF fonts. They are not embedded, so the file stays small and looks the same everywhere.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="wtp-fontsize">Body text size</Label>
                <span className="text-sm tabular-nums text-muted-foreground">{fontSize} pt</span>
              </div>
              <Slider
                id="wtp-fontsize"
                min={8}
                max={16}
                step={0.5}
                value={[fontSize]}
                onValueChange={(v) => setFontSize(v[0] ?? 11)}
                disabled={building}
                aria-label="Body text size in points"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="wtp-margin">Margin</Label>
                <span className="text-sm tabular-nums text-muted-foreground">{marginMm} mm</span>
              </div>
              <Slider
                id="wtp-margin"
                min={8}
                max={40}
                step={1}
                value={[marginMm]}
                onValueChange={(v) => setMarginMm(v[0] ?? 20)}
                disabled={building}
                aria-label="Page margin in millimetres"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-lg bg-card px-3 py-2.5">
            <Switch
              id="wtp-pagenumbers"
              checked={pageNumbers}
              onCheckedChange={setPageNumbers}
              disabled={building}
            />
            <Label htmlFor="wtp-pagenumbers" className="cursor-pointer text-sm font-normal">
              Stamp page numbers in the bottom margin
            </Label>
          </div>

          {(skippedImages > 0 || tableCount > 0) && (
            <p className="mt-4 text-sm text-muted-foreground" role="status">
              {skippedImages > 0 && (
                <>
                  {formatNumber(skippedImages, 0)} image{skippedImages === 1 ? '' : 's'} in the document{' '}
                  {skippedImages === 1 ? 'was' : 'were'} skipped.{' '}
                </>
              )}
              {tableCount > 0 && (
                <>
                  {formatNumber(tableCount, 0)} table{tableCount === 1 ? '' : 's'} will be redrawn with plain
                  proportional columns.
                </>
              )}
            </p>
          )}
        </ToolPanel>
      )}

      {building && <ProgressPanel label="Laying out pages…" />}

      {result && !building && (
        <ToolPanel
          title="Your PDF is ready"
          description={`${pageCount} page${pageCount === 1 ? '' : 's'} · ${formatBytes(result.size)}`}
          footer={
            <DownloadButton
              blob={result}
              filename={`${stripExtension(file?.name ?? 'document')}.pdf`}
              label="Download PDF"
            />
          }
        >
          {dropped > 0 ? (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              <strong className="font-medium text-foreground">
                {formatNumber(dropped, 0)} character{dropped === 1 ? '' : 's'} could not be represented
              </strong>{' '}
              and {dropped === 1 ? 'was' : 'were'} replaced with “?”. The standard PDF typefaces cover Western European
              alphabets only, so Greek, Cyrillic, Hebrew, Arabic, CJK and emoji cannot be drawn without embedding a
              font file.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Every character in the document was representable in the chosen typeface. Adjust any setting above and
              press Rebuild PDF to try a different layout.
            </p>
          )}
        </ToolPanel>
      )}
    </div>
  )
}
