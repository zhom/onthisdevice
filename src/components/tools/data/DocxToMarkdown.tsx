import * as React from 'react'
import { FileArchive } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { downloadBlob, formatBytes, nextFrame, stripExtension } from '@/lib/utils'

import { docxToHtml } from './docx'
import { DEFAULT_TURNDOWN, createTurndown, tidyMarkdown, type TurndownSettings } from './markdownize'
import { Field, OutputPane, ToggleRow, WarningList } from './ui'

interface Converted {
  name: string
  html: string
  warnings: string[]
}

export default function DocxToMarkdown() {
  const [files, setFiles] = React.useState<File[]>([])
  const [results, setResults] = React.useState<Converted[]>([])
  const [selected, setSelected] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState<number | null>(null)
  const [zipping, setZipping] = React.useState(false)

  const [embedImages, setEmbedImages] = React.useState(false)
  const [headingStyle, setHeadingStyle] = React.useState<TurndownSettings['headingStyle']>('atx')
  const [bulletListMarker, setBullet] = React.useState<TurndownSettings['bulletListMarker']>('-')
  const [codeBlockStyle, setCodeBlockStyle] = React.useState<TurndownSettings['codeBlockStyle']>('fenced')
  const [emDelimiter, setEm] = React.useState<TurndownSettings['emDelimiter']>('_')
  const [strongDelimiter, setStrong] = React.useState<TurndownSettings['strongDelimiter']>('**')
  const [tables, setTables] = React.useState(true)
  const [strikethrough, setStrikethrough] = React.useState(true)

  // Re-reads every document whenever the image strategy changes, because that
  // decision is made while mammoth walks the .docx.
  React.useEffect(() => {
    if (files.length === 0) {
      setResults([])
      return
    }
    let cancelled = false
    setError(null)
    setProgress(0)
    void (async () => {
      const out: Converted[] = []
      const failures: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!
        await nextFrame()
        if (cancelled) return
        try {
          const { value, warnings } = await docxToHtml(file, { embedImages })
          out.push({ name: file.name, html: value, warnings })
        } catch (err) {
          failures.push(err instanceof Error ? err.message : `Could not read ${file.name}.`)
        }
        if (cancelled) return
        setProgress(Math.round(((i + 1) / files.length) * 100))
      }
      if (cancelled) return
      setResults(out)
      setSelected((s) => (s < out.length ? s : 0))
      setProgress(null)
      if (failures.length > 0) setError(failures.join(' '))
    })()
    return () => {
      cancelled = true
    }
  }, [files, embedImages])

  const settings: TurndownSettings = React.useMemo(
    () => ({
      ...DEFAULT_TURNDOWN,
      headingStyle,
      bulletListMarker,
      codeBlockStyle,
      emDelimiter,
      strongDelimiter,
      tables,
      strikethrough,
      images: embedImages,
    }),
    [headingStyle, bulletListMarker, codeBlockStyle, emDelimiter, strongDelimiter, tables, strikethrough, embedImages],
  )

  const current = results[selected]

  const markdown = React.useMemo(() => {
    if (!current) return ''
    try {
      return tidyMarkdown(createTurndown(settings).turndown(current.html))
    } catch (err) {
      return `> Conversion failed: ${err instanceof Error ? err.message : 'unknown error'}`
    }
  }, [current, settings])

  const downloadAll = React.useCallback(async () => {
    if (results.length === 0) return
    setZipping(true)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      const service = createTurndown(settings)
      for (const r of results) {
        zip.file(`${stripExtension(r.name)}.md`, tidyMarkdown(service.turndown(r.html)))
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      downloadBlob(blob, 'word-documents-as-markdown.zip')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The ZIP could not be created.')
    } finally {
      setZipping(false)
    }
  }, [results, settings])

  const reset = () => {
    setFiles([])
    setResults([])
    setSelected(0)
    setError(null)
  }

  if (results.length === 0) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          onFiles={(picked) => setFiles(picked)}
          maxSizeMb={100}
          title="Drop Word documents here"
          hint="or click to browse. Headings, lists, links, tables and emphasis are kept."
        />
        <ToolPanel title="Before you convert">
          <ToggleRow
            id="d2m-embed-initial"
            label="Embed images as base64 data URIs"
            hint="Off keeps the Markdown small and skips pictures entirely."
            checked={embedImages}
            onCheckedChange={setEmbedImages}
          />
        </ToolPanel>
        {progress !== null ? <ProgressPanel label="Converting documents…" value={progress} /> : null}
        {error ? <ErrorNote message={error} onRetry={reset} /> : null}
      </div>
    )
  }

  const bytes = new TextEncoder().encode(markdown).length
  const warnings = [...(current?.warnings ?? [])]
  if (embedImages && bytes > 1_000_000) {
    warnings.push('Embedded images make this Markdown large. Turn image embedding off for a lighter file.')
  }

  return (
    <div className="space-y-4">
      <ToolPanel
        title="Markdown style"
        description={`${results.length} document${results.length === 1 ? '' : 's'} converted on this device.`}
        footer={
          <div className="flex flex-wrap gap-2">
            {results.length > 1 ? (
              <Button type="button" variant="secondary" disabled={zipping} onClick={() => void downloadAll()}>
                <FileArchive className="size-4" aria-hidden="true" />
                {zipping ? 'Packing ZIP…' : 'Download all as ZIP'}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={reset}>
              Convert other documents
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.length > 1 ? (
            <Field id="d2m-file" label="Document">
              <Select value={String(selected)} onValueChange={(v) => setSelected(Number(v))}>
                <SelectTrigger id="d2m-file">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {results.map((r, i) => (
                    <SelectItem key={r.name + i} value={String(i)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field id="d2m-heading" label="Heading style">
            <Select
              value={headingStyle}
              onValueChange={(v) => setHeadingStyle(v as TurndownSettings['headingStyle'])}
            >
              <SelectTrigger id="d2m-heading">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="atx"># ATX headings</SelectItem>
                <SelectItem value="setext">Setext (underlined) headings</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="d2m-bullet" label="Bullet marker">
            <Select
              value={bulletListMarker}
              onValueChange={(v) => setBullet(v as TurndownSettings['bulletListMarker'])}
            >
              <SelectTrigger id="d2m-bullet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-">Hyphen  -</SelectItem>
                <SelectItem value="*">Asterisk  *</SelectItem>
                <SelectItem value="+">Plus  +</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="d2m-em" label="Italic delimiter">
            <Select value={emDelimiter} onValueChange={(v) => setEm(v as TurndownSettings['emDelimiter'])}>
              <SelectTrigger id="d2m-em">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Underscore  _italic_</SelectItem>
                <SelectItem value="*">Asterisk  *italic*</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="d2m-strong" label="Bold delimiter">
            <Select
              value={strongDelimiter}
              onValueChange={(v) => setStrong(v as TurndownSettings['strongDelimiter'])}
            >
              <SelectTrigger id="d2m-strong">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="**">Asterisks  **bold**</SelectItem>
                <SelectItem value="__">Underscores  __bold__</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="d2m-code" label="Code blocks">
            <Select
              value={codeBlockStyle}
              onValueChange={(v) => setCodeBlockStyle(v as TurndownSettings['codeBlockStyle'])}
            >
              <SelectTrigger id="d2m-code">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fenced">Fenced with ```</SelectItem>
                <SelectItem value="indented">Indented four spaces</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <ToggleRow
            id="d2m-tables"
            label="GitHub-flavoured tables"
            hint="Off leaves Word tables as raw HTML."
            checked={tables}
            onCheckedChange={setTables}
          />
          <ToggleRow
            id="d2m-strike"
            label="Strikethrough as ~~text~~"
            checked={strikethrough}
            onCheckedChange={setStrikethrough}
          />
          <ToggleRow
            id="d2m-images"
            label="Embed images as data URIs"
            hint="Changing this re-reads the documents."
            checked={embedImages}
            onCheckedChange={setEmbedImages}
          />
        </div>
      </ToolPanel>

      {progress !== null ? <ProgressPanel label="Re-reading the documents…" value={progress} /> : null}
      {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}
      {warnings.length > 0 ? <WarningList warnings={warnings} /> : null}

      <Tabs defaultValue="markdown">
        <TabsList>
          <TabsTrigger value="markdown">Markdown</TabsTrigger>
          <TabsTrigger value="html">Intermediate HTML</TabsTrigger>
        </TabsList>
        <TabsContent value="markdown" className="mt-3">
          <OutputPane
            id="d2m-output"
            title="Markdown"
            value={markdown}
            filename={`${stripExtension(current?.name ?? 'document')}.md`}
            mime="text/markdown"
            emptyHint="This document has no readable content."
            rows={24}
            downloadLabel="Download .md"
            stats={[
              { label: 'lines', value: markdown.split('\n').length.toLocaleString() },
              { label: 'characters', value: markdown.length.toLocaleString() },
              { label: 'size', value: formatBytes(bytes) },
            ]}
          />
        </TabsContent>
        <TabsContent value="html" className="mt-3">
          <OutputPane
            id="d2m-html"
            title="HTML produced by mammoth"
            value={current?.html ?? ''}
            filename={`${stripExtension(current?.name ?? 'document')}.html`}
            mime="text/html"
            emptyHint="No HTML was produced."
            rows={24}
            downloadLabel="Download .html"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
