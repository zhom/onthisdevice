import { useCallback, useMemo, useRef, useState } from 'react'
import { AlertTriangle, FileDown, RotateCcw, ScanText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber, nextFrame, stripExtension } from '@/lib/utils'
import {
  describePdfError,
  extractPageText,
  looksLikeScan,
  openPdf,
  type PageText,
} from './pdf-utils'

export default function PdfToText() {
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<PageText[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pageMarkers, setPageMarkers] = useState(true)
  const cancelled = useRef(false)

  const run = useCallback(async (picked: File) => {
    cancelled.current = false
    setFile(picked)
    setPages([])
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
        if (n % 4 === 0 || n === total) {
          setPages([...collected])
          await nextFrame()
        }
      }
      setPages(collected)
      await doc.loadingTask.destroy()
    } catch (err) {
      setError(describePdfError(err, 'The text layer could not be read.'))
      setPages([])
    } finally {
      setBusy(false)
    }
  }, [])

  const handleFiles = useCallback(
    (files: File[]) => {
      const picked = files[0]
      if (picked) void run(picked)
    },
    [run],
  )

  const reset = useCallback(() => {
    cancelled.current = true
    setFile(null)
    setPages([])
    setError(null)
    setBusy(false)
  }, [])

  const combined = useMemo(() => {
    if (pages.length === 0) return ''
    return pages
      .map((page) => {
        const body = page.text.trim() === '' ? '[no text on this page]' : page.text
        return pageMarkers ? `--- Page ${page.pageNumber} ---\n\n${body}` : body
      })
      .join('\n\n')
      .trim()
  }, [pageMarkers, pages])

  const stats = useMemo(() => {
    const chars = pages.reduce((sum, page) => sum + page.chars, 0)
    const words = pages.reduce(
      (sum, page) => sum + page.text.split(/\s+/).filter((w) => w !== '').length,
      0,
    )
    const emptyPages = pages.filter((page) => page.chars === 0).length
    return { chars, words, emptyPages }
  }, [pages])

  const scanned = pages.length > 0 && looksLikeScan(pages)
  const textBlob = useMemo(
    () => (combined === '' ? null : new Blob([combined], { type: 'text/plain;charset=utf-8' })),
    [combined],
  )

  return (
    <div className="space-y-6">
      {!file && (
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={handleFiles}
          maxSizeMb={500}
          title="Drop a PDF here"
          hint="or click to browse"
        />
      )}

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
            <p className="font-medium text-foreground">This PDF has no usable text layer</p>
            <p className="text-muted-foreground">
              Every page appears to be an image: a scan, a photo, or an export that flattened its text into pixels.
              There are no characters to extract, so any output here would be empty. Reading it requires OCR (optical
              character recognition), which this tool does not perform. If you have the original document, export a
              fresh PDF from it instead.
            </p>
          </div>
        </div>
      )}

      {pages.length > 0 && !busy && (
        <>
          <ToolPanel
            title="Extracted text"
            description={file ? file.name : undefined}
            footer={
              <div className="flex flex-wrap items-center gap-2">
                {textBlob && (
                  <DownloadButton
                    blob={textBlob}
                    filename={`${stripExtension(file?.name ?? 'document')}.txt`}
                    label="Download .txt"
                  />
                )}
                <CopyButton value={combined} label="Copy all text" />
                <Button variant="ghost" onClick={reset}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Start over
                </Button>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ResultStat label="Pages" value={formatNumber(pages.length, 0)} />
              <ResultStat label="Words" value={formatNumber(stats.words, 0)} emphasis />
              <ResultStat label="Characters" value={formatNumber(stats.chars, 0)} />
              <ResultStat
                label="Pages without text"
                value={formatNumber(stats.emptyPages, 0)}
                hint={stats.emptyPages > 0 ? 'likely scanned or image-only' : 'all pages had text'}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg bg-card px-3 py-2.5">
              <Switch id="page-markers" checked={pageMarkers} onCheckedChange={setPageMarkers} />
              <Label htmlFor="page-markers" className="cursor-pointer text-sm font-normal">
                Insert a <code className="rounded bg-muted px-1 py-0.5 text-xs">--- Page n ---</code> separator between
                pages
              </Label>
            </div>
          </ToolPanel>

          <ToolPanel title="Page by page" description="Copy just the section you need.">
            <ol className="space-y-3">
              {pages.map((page) => (
                <li key={page.pageNumber} className="rounded-lg bg-card">
                  <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                    <h3 className="text-sm font-medium text-foreground">
                      Page {page.pageNumber}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {page.chars === 0 ? 'no text layer' : `${formatNumber(page.chars, 0)} characters`}
                      </span>
                    </h3>
                    {page.chars > 0 && <CopyButton value={page.text} label="Copy" />}
                  </div>
                  <div className="max-h-72 overflow-auto p-3">
                    {page.chars === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nothing selectable on this page. It is an image.
                      </p>
                    ) : (
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
                        {page.text}
                      </pre>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </ToolPanel>
        </>
      )}

      {!file && !error && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ScanText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Text is read from the PDF’s own text layer, so it comes out exactly as the document stores it. There is no OCR,
            and nothing is sent to a server.
          </span>
        </p>
      )}

      {pages.length > 0 && !busy && !scanned && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <FileDown className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Need an editable document rather than plain text? The{' '}
            <a className="underline underline-offset-2 hover:text-foreground" href="/pdf-to-word">
              PDF to Word converter
            </a>{' '}
            wraps the same extraction in a real .docx file.
          </span>
        </p>
      )}
    </div>
  )
}
