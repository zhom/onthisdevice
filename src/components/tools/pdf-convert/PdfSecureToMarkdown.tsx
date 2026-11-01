import { useCallback, useRef, useState } from 'react'
import { Bot, FileCode2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber, nextFrame } from '@/lib/utils'
import {
  copyBytes,
  humanPdfError,
  outputName,
  readFileBytes,
} from '@/components/tools/pdf/pdf-secure-shared'

interface Result {
  markdown: string
  pages: number
  emptyPages: number
  words: number
  characters: number
  filename: string
}

export default function PdfSecureToMarkdown() {
  const [file, setFile] = useState<File | null>(null)
  const [pageBreaks, setPageBreaks] = useState(true)
  const [detectTables, setDetectTables] = useState(true)
  const [stripRunning, setStripRunning] = useState(true)
  const [detectFonts, setDetectFonts] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('Working…')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const cancelled = useRef(false)

  const convert = useCallback(
    async (source: File) => {
      cancelled.current = false
      setBusy(true)
      setError(null)
      setResult(null)
      setProgress(0)
      setStage('Opening the document…')
      try {
        const bytes = await readFileBytes(source)
        const { pdfjs } = await import('@/components/tools/pdf/pdf-secure-pdfjs')
        const layout = await import('./pdf-secure-layout')
        const doc = await pdfjs.getDocument({
          data: copyBytes(bytes),
        }).promise

        const pages = await layout.extractLayout(doc, {
          detectFonts: detectFonts && doc.numPages <= 60,
          onProgress: async (page, total) => {
            if (cancelled.current) throw new Error('cancelled-by-user')
            setStage(`Reading the text layer: page ${page} of ${total}…`)
            setProgress(Math.round((page / total) * 88))
            await nextFrame()
          },
        })
        void doc.loadingTask.destroy()

        setStage('Inferring headings, lists and tables…')
        setProgress(92)
        await nextFrame()

        const markdown = layout.toMarkdown(pages, {
          pageBreaks,
          detectTables,
          stripHeadersFooters: stripRunning,
        })

        const emptyPages = pages.filter((page) => page.lines.length === 0).length
        if (markdown.trim().length === 0) {
          setError(
            'This PDF has no text layer. Every page is an image, which almost always means it is a scan or a photo. This tool has no OCR, so it cannot extract the words. Try the original digital file if you have it.',
          )
          setBusy(false)
          return
        }

        setResult({
          markdown,
          pages: pages.length,
          emptyPages,
          words: markdown.split(/\s+/).filter(Boolean).length,
          characters: markdown.length,
          filename: outputName(source.name, '', 'md'),
        })
        setProgress(100)
      } catch (err) {
        if (err instanceof Error && err.message === 'cancelled-by-user') {
          setError('Cancelled. Nothing was converted.')
        } else {
          setError(humanPdfError(err, source.name))
        }
      } finally {
        setBusy(false)
      }
    },
    [detectFonts, detectTables, pageBreaks, stripRunning],
  )

  const markdownBlob = result ? new Blob([result.markdown], { type: 'text/markdown' }) : null

  return (
    <div className="space-y-6">
      <FileDropzone
        accept=".pdf,application/pdf"
        maxSizeMb={500}
        onFiles={(files) => {
          const next = files[0]
          if (!next) return
          setFile(next)
          void convert(next)
        }}
        title={file ? 'Choose a different PDF' : 'Drop a PDF here'}
        hint="or click to browse"
        icon={FileCode2}
      />

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      <ToolPanel
        title="Conversion options"
        description="Change an option and re-run to see the effect."
        footer={
          file ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={busy} onClick={() => void convert(file)}>
                Re-convert with these options
              </Button>
              {busy && (
                <Button variant="ghost" onClick={() => (cancelled.current = true)}>
                  Cancel
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Checkbox
              id="md-tables"
              checked={detectTables}
              onCheckedChange={(checked) => setDetectTables(checked === true)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="md-tables" className="font-normal">
                Detect tables
              </Label>
              <p className="text-xs text-muted-foreground text-pretty">
                Runs of three or more column-aligned lines become GFM tables.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="md-running"
              checked={stripRunning}
              onCheckedChange={(checked) => setStripRunning(checked === true)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="md-running" className="font-normal">
                Strip running heads
              </Label>
              <p className="text-xs text-muted-foreground text-pretty">
                Removes the header, footer and page number that repeat on most pages.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="md-breaks"
              checked={pageBreaks}
              onCheckedChange={(checked) => setPageBreaks(checked === true)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="md-breaks" className="font-normal">
                Keep page breaks
              </Label>
              <p className="text-xs text-muted-foreground text-pretty">
                Writes a horizontal rule between pages.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="md-fonts"
              checked={detectFonts}
              onCheckedChange={(checked) => setDetectFonts(checked === true)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="md-fonts" className="font-normal">
                Read font names for bold
              </Label>
              <p className="text-xs text-muted-foreground text-pretty">
                A little slower; needed to turn bold runs into <code>**bold**</code>. Skipped
                automatically past 60 pages.
              </p>
            </div>
          </div>
        </div>
      </ToolPanel>

      {busy && (
        <ProgressPanel label={stage} value={progress} sublabel="Parsing the text layer." />
      )}

      {result && (
        <ToolPanel
          title="Markdown"
          description={result.filename}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton value={result.markdown} label="Copy Markdown" variant="default" size="default" />
              <CopyButton
                value={`Here is a document converted to Markdown. Please read it and then wait for my question.\n\n${result.markdown}`}
                label="Copy for ChatGPT / Claude"
              />
              <DownloadButton blob={markdownBlob} filename={result.filename} label="Download .md" variant="outline" />
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Pages" value={formatNumber(result.pages, 0)} />
            <ResultStat label="Words" value={formatNumber(result.words, 0)} />
            <ResultStat
              label="Characters"
              value={formatNumber(result.characters, 0)}
              hint={`≈ ${formatNumber(Math.round(result.characters / 4), 0)} tokens`}
            />
          </div>

          {result.emptyPages > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-pretty">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {result.emptyPages} page{result.emptyPages === 1 ? ' has' : 's have'} no text layer.
                Those are scans or images, and nothing could be extracted from them. The rest
                converted normally.
              </span>
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="md-output">Output</Label>
            <Textarea
              id="md-output"
              readOnly
              value={result.markdown}
              rows={18}
              spellCheck={false}
              className="font-mono text-[13px]"
            />
          </div>

          <p className="flex items-start gap-2 text-sm text-muted-foreground text-pretty">
            <Bot className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Pasting a document into a chatbot sends it to that company&rsquo;s servers. This
              conversion step sends nothing, but the paste afterwards does. Check that the document is
              one you are allowed to share before you use the second button.
            </span>
          </p>
        </ToolPanel>
      )}
    </div>
  )
}
