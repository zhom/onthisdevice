import { useCallback, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, formatNumber, nextFrame, slugify } from '@/lib/utils'
import type { DocxBlock } from './pdf-secure-docx'

export interface PdfSecureMarkdownToWordProps {
  source: 'markdown' | 'html' | 'text'
}

const COPY = {
  markdown: {
    accept: '.md,.markdown,.mdown,.txt,text/markdown',
    dropTitle: 'Drop a .md file here',
    label: 'Paste your Markdown',
    placeholder: '# Quarterly report\n\nThe **headline** number is up 12%.\n\n- First point\n- Second point\n\n| Region | Revenue |\n| --- | --- |\n| EMEA | 1.2M |',
  },
  html: {
    accept: '.html,.htm,text/html',
    dropTitle: 'Drop an .html file here',
    label: 'Paste your HTML',
    placeholder: '<h1>Quarterly report</h1>\n<p>The <strong>headline</strong> number is up 12%.</p>\n<ul><li>First point</li></ul>',
  },
  text: {
    accept: '.txt,.text,text/plain',
    dropTitle: 'Drop a .txt file here',
    label: 'Paste your text',
    placeholder: 'INTRODUCTION\n\nParagraphs are separated by a blank line.\n\n- bullets work too\n- like this',
  },
} as const

interface Summary {
  blob: Blob
  filename: string
  headings: number
  paragraphs: number
  listItems: number
  tables: number
  codeBlocks: number
}

export default function PdfSecureMarkdownToWord({ source }: PdfSecureMarkdownToWordProps) {
  const copy = COPY[source]
  const [text, setText] = useState('')
  const [documentTitle, setDocumentTitle] = useState('')
  const [softBreaks, setSoftBreaks] = useState(false)
  const [autoHeadings, setAutoHeadings] = useState(true)
  const [titleFromFirstHeading, setTitleFromFirstHeading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)

  const characters = text.length
  const words = useMemo(() => text.split(/\s+/).filter(Boolean).length, [text])

  const readFile = useCallback(async (file: File) => {
    setError(null)
    setSummary(null)
    try {
      const content = await file.text()
      setText(content)
      if (!documentTitle) setDocumentTitle(file.name.replace(/\.[^.]+$/, ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [documentTitle])

  const convert = async () => {
    if (!text.trim()) {
      setError('Paste something first, or drop a file onto the box above.')
      return
    }
    setBusy(true)
    setError(null)
    setSummary(null)
    await nextFrame()
    try {
      const { buildDocx } = await import('./pdf-secure-docx')
      const blocksModule = await import('./pdf-secure-md-blocks')

      let blocks: DocxBlock[]
      if (source === 'text') {
        blocks = blocksModule.plainTextToBlocks(text, { softBreaks, autoHeadings })
      } else {
        let markdown = text
        if (source === 'html') {
          const TurndownService = (await import('turndown')).default
          const turndown = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
            bulletListMarker: '-',
          })
          // Tables are not in turndown's core rule set; keep them as pipe rows.
          turndown.addRule('tables', {
            filter: ['table'],
            replacement: (_content, node) => {
              const table = node as HTMLTableElement
              const rows = Array.from(table.rows).map((row) =>
                Array.from(row.cells).map((cell) =>
                  (cell.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|'),
                ),
              )
              if (rows.length === 0) return ''
              const width = Math.max(...rows.map((row) => row.length))
              const pad = (row: string[]) => {
                const copyRow = [...row]
                while (copyRow.length < width) copyRow.push('')
                return `| ${copyRow.join(' | ')} |`
              }
              const head = pad(rows[0])
              const divider = `| ${Array.from({ length: width }, () => '---').join(' | ')} |`
              const body = rows.slice(1).map(pad)
              return `\n\n${[head, divider, ...body].join('\n')}\n\n`
            },
          })
          markdown = turndown.turndown(text)
        }
        const { marked } = await import('marked')
        blocks = blocksModule.markdownToBlocks(marked.lexer(markdown))
      }

      if (blocks.length === 0) {
        setError('Nothing convertible was found in that input.')
        setBusy(false)
        return
      }

      const firstHeading = blocks.find((block) => block.kind === 'heading')
      const derivedTitle =
        titleFromFirstHeading && firstHeading && firstHeading.kind === 'heading'
          ? firstHeading.runs.map((run) => run.text).join('')
          : documentTitle

      const blob = await buildDocx(blocks, { title: derivedTitle || documentTitle })
      const base = slugify(derivedTitle || documentTitle || 'document') || 'document'

      setSummary({
        blob,
        filename: `${base}.docx`,
        headings: blocks.filter((b) => b.kind === 'heading').length,
        paragraphs: blocks.filter((b) => b.kind === 'paragraph' || b.kind === 'quote').length,
        listItems: blocks.filter((b) => b.kind === 'listItem').length,
        tables: blocks.filter((b) => b.kind === 'table').length,
        codeBlocks: blocks.filter((b) => b.kind === 'code').length,
      })
    } catch (err) {
      setError(
        `The document could not be built. ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={copy.accept}
        maxSizeMb={25}
        onFiles={(files) => {
          const next = files[0]
          if (next) void readFile(next)
        }}
        title={copy.dropTitle}
        hint="or paste into the box below"
        icon={FileText}
      />

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      <ToolPanel
        title={copy.label}
        description={`${formatNumber(words, 0)} words · ${formatNumber(characters, 0)} characters`}
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void convert()} disabled={busy || text.trim().length === 0}>
              Create .docx
            </Button>
            {summary && (
              <DownloadButton
                blob={summary.blob}
                filename={summary.filename}
                label="Download Word file"
                variant="outline"
              />
            )}
            {text && (
              <Button
                variant="ghost"
                onClick={() => {
                  setText('')
                  setSummary(null)
                }}
              >
                Clear
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="mtw-input" className="sr-only">
            {copy.label}
          </Label>
          <Textarea
            id="mtw-input"
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setSummary(null)
            }}
            placeholder={copy.placeholder}
            rows={14}
            spellCheck={false}
            className="font-mono text-[13px]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mtw-title">Document title</Label>
            <Input
              id="mtw-title"
              value={documentTitle}
              placeholder="Used for the file name and Word's title property"
              onChange={(event) => setDocumentTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-col justify-end gap-3">
            {source !== 'text' && (
              <div className="flex items-center gap-3">
                <Checkbox
                  id="mtw-derive"
                  checked={titleFromFirstHeading}
                  onCheckedChange={(checked) => setTitleFromFirstHeading(checked === true)}
                />
                <Label htmlFor="mtw-derive" className="font-normal">
                  Take the title from the first heading
                </Label>
              </div>
            )}
            {source === 'text' && (
              <>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="mtw-soft"
                    checked={softBreaks}
                    onCheckedChange={(checked) => setSoftBreaks(checked === true)}
                  />
                  <Label htmlFor="mtw-soft" className="font-normal">
                    Keep every line break
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="mtw-heads"
                    checked={autoHeadings}
                    onCheckedChange={(checked) => setAutoHeadings(checked === true)}
                  />
                  <Label htmlFor="mtw-heads" className="font-normal">
                    Treat ALL-CAPS lines as headings
                  </Label>
                </div>
              </>
            )}
          </div>
        </div>
      </ToolPanel>

      {busy && <ProgressPanel label="Building the Word document…" />}

      {summary && (
        <ToolPanel title="Word document ready" description={summary.filename}>
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Headings" value={formatNumber(summary.headings, 0)} emphasis />
            <ResultStat label="Paragraphs" value={formatNumber(summary.paragraphs, 0)} />
            <ResultStat label="List items" value={formatNumber(summary.listItems, 0)} />
            <ResultStat label="Tables" value={formatNumber(summary.tables, 0)} />
            <ResultStat label="Code blocks" value={formatNumber(summary.codeBlocks, 0)} />
            <ResultStat label="File size" value={formatBytes(summary.blob.size)} />
          </div>
          <p className="text-sm text-muted-foreground text-pretty">
            Headings use Word&rsquo;s built-in <code>Heading 1</code>–<code>Heading 6</code> styles,
            so the navigation pane, the table of contents and your own theme all work. Change the
            theme in Word and the whole document restyles.
          </p>
        </ToolPanel>
      )}
    </div>
  )
}
