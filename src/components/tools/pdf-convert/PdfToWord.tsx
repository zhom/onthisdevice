import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, FileType2, Info, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, formatNumber, nextFrame, stripExtension } from '@/lib/utils'
import { buildDocx, looksLikeHeading, type DocxBlock } from './docx'
import { describePdfError, extractPageText, looksLikeScan, openPdf, type PageText } from './pdf-utils'

export default function PdfToWord() {
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<PageText[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [detectHeadings, setDetectHeadings] = useState(true)
  const [keepPageBreaks, setKeepPageBreaks] = useState(true)
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null)
  const [building, setBuilding] = useState(false)
  const cancelled = useRef(false)

  const extract = useCallback(async (picked: File) => {
    cancelled.current = false
    setFile(picked)
    setPages([])
    setDocxBlob(null)
    setError(null)
    setBusy(true)
    setProgress(0)
    setProgressLabel('Opening the PDF…')
    try {
      const doc = await openPdf(picked)
      const total = doc.numPages
      const collected: PageText[] = []
      for (let n = 1; n <= total; n++) {
        if (cancelled.current) break
        setProgressLabel(`Reading page ${n} of ${total}…`)
        const page = await doc.getPage(n)
        const text = await extractPageText(page)
        page.cleanup()
        collected.push({ pageNumber: n, text, chars: text.trim().length })
        setProgress(Math.round((n / total) * 100))
        if (n % 4 === 0 || n === total) await nextFrame()
      }
      await doc.loadingTask.destroy()
      setPages(collected)
    } catch (err) {
      setError(describePdfError(err, 'The document text could not be read.'))
    } finally {
      setBusy(false)
    }
  }, [])

  const handleFiles = useCallback(
    (files: File[]) => {
      const picked = files[0]
      if (picked) void extract(picked)
    },
    [extract],
  )

  const reset = useCallback(() => {
    cancelled.current = true
    setFile(null)
    setPages([])
    setDocxBlob(null)
    setError(null)
    setBusy(false)
  }, [])

  const blocks = useMemo<DocxBlock[]>(() => {
    const out: DocxBlock[] = []
    pages.forEach((page, pageIndex) => {
      if (pageIndex > 0 && keepPageBreaks) out.push({ type: 'pageBreak' })
      const paragraphs = page.text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p !== '')
      if (paragraphs.length === 0) return
      for (const paragraph of paragraphs) {
        const heading = detectHeadings ? looksLikeHeading(paragraph) : false
        out.push({ type: heading === false ? 'body' : heading, text: paragraph })
      }
    })
    return out
  }, [detectHeadings, keepPageBreaks, pages])

  // A previously built .docx no longer matches the options — force a rebuild.
  useEffect(() => {
    setDocxBlob(null)
  }, [detectHeadings, keepPageBreaks])

  const scanned = pages.length > 0 && looksLikeScan(pages)

  const create = useCallback(async () => {
    if (!file || blocks.length === 0) return
    setBuilding(true)
    setError(null)
    try {
      const blob = await buildDocx(blocks, { title: stripExtension(file.name) })
      setDocxBlob(blob)
    } catch (err) {
      setError(
        err instanceof Error
          ? `The Word file could not be created (${err.message}).`
          : 'The Word file could not be created.',
      )
    } finally {
      setBuilding(false)
    }
  }, [blocks, file])

  const headingCount = blocks.filter((b) => b.type.startsWith('heading')).length
  const paragraphCount = blocks.filter((b) => b.type === 'body').length
  const wordCount = pages.reduce(
    (sum, page) => sum + page.text.split(/\s+/).filter((w) => w !== '').length,
    0,
  )

  return (
    <div className="space-y-6">
      {!file && (
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={handleFiles}
          maxSizeMb={500}
          title="Drop a PDF here"
          hint="or click to browse. Conversion runs in this tab."
        />
      )}

      <div className="flex items-start gap-3 rounded-lg bg-muted p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">What this converter keeps and what it drops</p>
          <p className="text-muted-foreground">
            It rebuilds the <strong className="font-medium text-foreground">text</strong> of a text-based PDF as
            editable Word paragraphs, with detected headings and one page break per PDF page. It does not reconstruct
            page layout, columns, tables, images, headers, footers or fonts, and it cannot read scanned pages. If you
            need a pixel-faithful copy, keep the PDF.
          </p>
        </div>
      </div>

      {error && <ErrorNote message={error} onRetry={reset} />}

      {busy && <ProgressPanel label={progressLabel} value={progress} />}

      {scanned && !busy && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-lg bg-muted p-4"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">This PDF is a scan, so there is nothing to convert</p>
            <p className="text-muted-foreground">
              The pages contain images of text rather than characters. Producing a .docx from them would give you an
              empty document. You need OCR software to recognise the words first. This tool stops here so that you
              do not get a blank file.
            </p>
          </div>
        </div>
      )}

      {pages.length > 0 && !busy && !scanned && (
        <ToolPanel
          title="Convert to Word"
          description={`${file?.name ?? ''} · ${pages.length} page${pages.length === 1 ? '' : 's'}`}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={create} disabled={building}>
                <FileType2 className="size-4" aria-hidden="true" />
                {building ? 'Building .docx…' : docxBlob ? 'Rebuild .docx' : 'Create .docx'}
              </Button>
              {docxBlob && (
                <DownloadButton
                  blob={docxBlob}
                  filename={`${stripExtension(file?.name ?? 'document')}.docx`}
                  label="Download Word file"
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
            <ResultStat label="Pages read" value={formatNumber(pages.length, 0)} />
            <ResultStat label="Words" value={formatNumber(wordCount, 0)} emphasis />
            <ResultStat label="Paragraphs" value={formatNumber(paragraphCount, 0)} />
            <ResultStat
              label="Headings"
              value={formatNumber(headingCount, 0)}
              hint={detectHeadings ? 'detected by line shape' : 'detection off'}
            />
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-start gap-3 rounded-lg bg-card px-3 py-2.5">
              <Switch
                id="detect-headings"
                checked={detectHeadings}
                onCheckedChange={setDetectHeadings}
                disabled={building}
              />
              <div>
                <Label htmlFor="detect-headings" className="cursor-pointer text-sm">
                  Detect headings
                </Label>
                <p className="text-xs text-muted-foreground">
                  Short lines with no closing punctuation, all-caps lines and numbered sections become Word Heading 1
                  or Heading 2 styles, so the navigation pane and table of contents work.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-card px-3 py-2.5">
              <Switch
                id="page-breaks"
                checked={keepPageBreaks}
                onCheckedChange={setKeepPageBreaks}
                disabled={building}
              />
              <div>
                <Label htmlFor="page-breaks" className="cursor-pointer text-sm">
                  Keep one page break per PDF page
                </Label>
                <p className="text-xs text-muted-foreground">
                  Off, the text flows as one continuous document. This is usually better for editing and worse for
                  matching the original pagination.
                </p>
              </div>
            </div>
          </div>

          {docxBlob && (
            <p className="mt-4 text-sm text-muted-foreground" role="status" aria-live="polite">
              Ready: {formatBytes(docxBlob.size)} · a standard OOXML package that opens in Word, LibreOffice, Pages and
              Google Docs.
            </p>
          )}
        </ToolPanel>
      )}

      {pages.length > 0 && !busy && !scanned && (
        <ToolPanel title="Preview" description="The first part of the document as it will appear in Word.">
          <div className="max-h-96 space-y-3 overflow-auto rounded-lg bg-card p-4">
            {blocks.slice(0, 40).map((block, index) => {
              if (block.type === 'pageBreak') {
                return (
                  <hr key={`break-${index}`} className="border-dashed border-border" aria-label="Page break" />
                )
              }
              const className =
                block.type === 'heading1'
                  ? 'text-lg font-semibold text-foreground'
                  : block.type === 'heading2'
                    ? 'text-base font-semibold text-foreground'
                    : block.type === 'heading3'
                      ? 'text-sm font-semibold text-foreground'
                      : 'text-sm leading-relaxed text-muted-foreground'
              return (
                <p key={`block-${index}`} className={className}>
                  {block.text}
                </p>
              )
            })}
            {blocks.length > 40 && (
              <p className="pt-2 text-xs text-muted-foreground">
                … and {formatNumber(blocks.length - 40, 0)} more blocks in the downloaded file.
              </p>
            )}
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
