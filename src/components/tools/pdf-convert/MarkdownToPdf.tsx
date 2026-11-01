import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileCode2, FileDown, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, formatNumber, stripExtension } from '@/lib/utils'
import { PAGE_SIZES, mmToPt, pageSizeById } from './pdf-common'
import type { FontFamily } from './pdf-layout'
import type { RichBlock } from './rich-blocks'

const STARTER = `# Release notes

A **Markdown to PDF** converter that runs in your browser.

## What is supported

- Headings, paragraphs, **bold**, *italic* and \`inline code\`
- Ordered and unordered lists, including nesting
- Blockquotes, horizontal rules and simple tables

> This line is a blockquote.

\`\`\`bash
# fenced code blocks keep their monospaced shape
npm run build
\`\`\`

| Feature | Supported |
| --- | --- |
| Tables | Yes |
| Images | No |
`

const FAMILY_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: 'helvetica', label: 'Helvetica (sans serif)' },
  { value: 'times', label: 'Times (serif)' },
  { value: 'courier', label: 'Courier (monospaced)' },
]

export default function MarkdownToPdf() {
  const [source, setSource] = useState(STARTER)
  const [filename, setFilename] = useState('document')
  const [blocks, setBlocks] = useState<RichBlock[]>([])
  const [images, setImages] = useState(0)
  const [parsing, setParsing] = useState(false)

  const [sizeId, setSizeId] = useState('a4')
  const [family, setFamily] = useState<FontFamily>('helvetica')
  const [fontSize, setFontSize] = useState(11)
  const [marginMm, setMarginMm] = useState(20)
  const [pageNumbers, setPageNumbers] = useState(true)
  const [showLinkUrls, setShowLinkUrls] = useState(true)

  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Blob | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [dropped, setDropped] = useState(0)
  const parseToken = useRef(0)

  useEffect(() => {
    const token = ++parseToken.current
    if (source.trim() === '') {
      setBlocks([])
      setImages(0)
      return
    }
    setParsing(true)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { markdownToBlocks } = await import('./markdown-blocks')
          const parsed = markdownToBlocks(source, { showLinkUrls })
          if (parseToken.current !== token) return
          setBlocks(parsed.blocks)
          setImages(parsed.images)
          setError(null)
        } catch (err) {
          if (parseToken.current !== token) return
          setError(err instanceof Error ? `The Markdown could not be parsed (${err.message}).` : 'The Markdown could not be parsed.')
        } finally {
          if (parseToken.current === token) setParsing(false)
        }
      })()
    }, 220)
    return () => window.clearTimeout(timer)
  }, [showLinkUrls, source])

  useEffect(() => {
    setResult(null)
  }, [source, sizeId, family, fontSize, marginMm, pageNumbers, showLinkUrls])

  const handleFiles = useCallback(async (files: File[]) => {
    const picked = files[0]
    if (!picked) return
    try {
      setSource(await picked.text())
      setFilename(stripExtension(picked.name) || 'document')
      setError(null)
    } catch {
      setError('That file could not be read as text. Markdown files are plain text with an .md extension.')
    }
  }, [])

  const build = useCallback(async () => {
    if (blocks.length === 0) {
      setError('Write or paste some Markdown first. The PDF would otherwise be blank.')
      return
    }
    setBuilding(true)
    setError(null)
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
      const bytes = await writer.save({ title: filename })
      setDropped(substituted)
      setPageCount(writer.pageCount)
      setResult(toBlob(bytes, 'application/pdf'))
    } catch (err) {
      setError(
        err instanceof Error ? `The PDF could not be produced (${err.message}).` : 'The PDF could not be produced.',
      )
    } finally {
      setBuilding(false)
    }
  }, [blocks, family, filename, fontSize, marginMm, pageNumbers, sizeId])

  const counts = useMemo(() => {
    let headings = 0
    let code = 0
    let tables = 0
    let listItems = 0
    for (const block of blocks) {
      if (block.kind === 'heading') headings++
      if (block.kind === 'code') code++
      if (block.kind === 'table') tables++
      if (block.kind === 'list-item') listItems++
    }
    return { headings, code, tables, listItems }
  }, [blocks])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview ({blocks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="write" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mtp-source">Markdown source</Label>
            <Textarea
              id="mtp-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              rows={18}
              spellCheck={false}
              className="min-h-72 font-mono text-sm"
              placeholder="# Title&#10;&#10;Write Markdown here…"
            />
          </div>
          <FileDropzone
            accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
            onFiles={handleFiles}
            maxSizeMb={20}
            title="Or drop a .md file"
            hint="its contents replace the editor above"
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <div className="max-h-[32rem] overflow-auto rounded-lg bg-card p-4 sm:p-6">
            {blocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
            ) : (
              <div className="space-y-3">
                {blocks.map((block, index) => (
                  <BlockPreview key={index} block={block} />
                ))}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The preview shows the block structure that will be typeset (headings, lists, quotes, code and
            tables). It is not a browser rendering of the HTML.
          </p>
        </TabsContent>
      </Tabs>

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      <ToolPanel
        title="PDF settings"
        description={parsing ? 'Parsing…' : `${blocks.length} block${blocks.length === 1 ? '' : 's'} ready`}
        footer={
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={build} disabled={building || blocks.length === 0}>
              <FileDown className="size-4" aria-hidden="true" />
              {building ? 'Typesetting…' : result ? 'Rebuild PDF' : 'Create PDF'}
            </Button>
            {result && (
              <DownloadButton blob={result} filename={`${filename || 'document'}.pdf`} label="Download PDF" />
            )}
            <div className="flex items-center gap-2">
              <Label htmlFor="mtp-filename" className="text-sm font-normal text-muted-foreground">
                File name
              </Label>
              <Input
                id="mtp-filename"
                value={filename}
                onChange={(event) => setFilename(event.target.value)}
                className="w-36"
              />
              <span className="text-sm text-muted-foreground">.pdf</span>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResultStat label="Headings" value={formatNumber(counts.headings, 0)} />
          <ResultStat label="List items" value={formatNumber(counts.listItems, 0)} />
          <ResultStat label="Code blocks" value={formatNumber(counts.code, 0)} />
          <ResultStat label="Tables" value={formatNumber(counts.tables, 0)} />
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mtp-size">Page size</Label>
            <Select value={sizeId} onValueChange={setSizeId} disabled={building}>
              <SelectTrigger id="mtp-size" className="w-full">
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
            <Label htmlFor="mtp-font">Body typeface</Label>
            <Select value={family} onValueChange={(value) => setFamily(value as FontFamily)} disabled={building}>
              <SelectTrigger id="mtp-font" className="w-full">
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
            <p className="text-xs text-muted-foreground">Code always uses Courier so columns stay aligned.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="mtp-fontsize">Body text size</Label>
              <span className="text-sm tabular-nums text-muted-foreground">{fontSize} pt</span>
            </div>
            <Slider
              id="mtp-fontsize"
              min={8}
              max={16}
              step={0.5}
              value={[fontSize]}
              onValueChange={(v) => setFontSize(v[0] ?? 11)}
              disabled={building}
              aria-label="Body text size in points"
            />
            <p className="text-xs text-muted-foreground">Headings scale from this size, so one slider sets the lot.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="mtp-margin">Margin</Label>
              <span className="text-sm tabular-nums text-muted-foreground">{marginMm} mm</span>
            </div>
            <Slider
              id="mtp-margin"
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5">
            <Switch id="mtp-pagenumbers" checked={pageNumbers} onCheckedChange={setPageNumbers} disabled={building} />
            <Label htmlFor="mtp-pagenumbers" className="cursor-pointer text-sm font-normal">
              Page numbers in the bottom margin
            </Label>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5">
            <Switch id="mtp-links" checked={showLinkUrls} onCheckedChange={setShowLinkUrls} disabled={building} />
            <Label htmlFor="mtp-links" className="cursor-pointer text-sm font-normal">
              Print link targets after the link text
            </Label>
          </div>
        </div>

        {images > 0 && (
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            {formatNumber(images, 0)} image reference{images === 1 ? '' : 's'} will be skipped. The converter has no
            network access, so remote images cannot be fetched into the PDF.
          </p>
        )}
      </ToolPanel>

      {building && <ProgressPanel label="Typesetting the document…" />}

      {result && !building && (
        <ToolPanel
          title="Your PDF is ready"
          description={`${pageCount} page${pageCount === 1 ? '' : 's'} · ${formatBytes(result.size)}`}
          footer={<DownloadButton blob={result} filename={`${filename || 'document'}.pdf`} label="Download PDF" />}
        >
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {dropped > 0 ? (
              <>
                <strong className="font-medium text-foreground">
                  {formatNumber(dropped, 0)} character{dropped === 1 ? '' : 's'} were replaced with “?”
                </strong>
                . The standard PDF typefaces cover Western European alphabets only.
              </>
            ) : (
              <>Every character was representable in the chosen typeface.</>
            )}
          </p>
        </ToolPanel>
      )}

      {blocks.length === 0 && !parsing && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <FileCode2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Paste a README, a changelog, meeting notes or any other Markdown, and export it as a PDF.</span>
        </p>
      )}

      {source !== STARTER && (
        <Button
          variant="ghost"
          onClick={() => {
            setSource(STARTER)
            setFilename('document')
          }}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Restore the example
        </Button>
      )}
    </div>
  )
}

function BlockPreview({ block }: { block: RichBlock }) {
  switch (block.kind) {
    case 'heading': {
      const text = block.runs.map((run) => run.text).join('')
      const size =
        block.level === 1
          ? 'text-xl font-semibold'
          : block.level === 2
            ? 'text-lg font-semibold'
            : 'text-base font-semibold'
      return <p className={`${size} text-foreground`}>{text}</p>
    }
    case 'paragraph':
      return (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {block.runs.map((run, i) => (
            <RunSpan key={i} text={run.text} style={run.style} />
          ))}
        </p>
      )
    case 'list-item':
      return (
        <p
          className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
          style={{ paddingLeft: `${block.depth * 1.25 + 0.5}rem` }}
        >
          <span aria-hidden="true" className="shrink-0 text-foreground">
            {block.marker}
          </span>
          <span>
            {block.runs.map((run, i) => (
              <RunSpan key={i} text={run.text} style={run.style} />
            ))}
          </span>
        </p>
      )
    case 'quote':
      return (
        <blockquote className="border-l-2 border-border pl-3 text-sm text-muted-foreground">
          {block.runs.map((run) => run.text).join('')}
        </blockquote>
      )
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
          {block.text}
        </pre>
      )
    case 'rule':
      return <hr className="border-border" />
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border">
                  {row.cells.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`px-2 py-1.5 align-top ${row.header ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

function RunSpan({ text, style }: { text: string; style: string }) {
  const className =
    style === 'bold' || style === 'monoBold'
      ? 'font-semibold text-foreground'
      : style === 'italic'
        ? 'italic'
        : style === 'boldItalic'
          ? 'font-semibold italic text-foreground'
          : style === 'mono'
            ? 'rounded bg-muted px-1 font-mono text-[0.85em] text-foreground'
            : undefined
  return <span className={className}>{text}</span>
}
