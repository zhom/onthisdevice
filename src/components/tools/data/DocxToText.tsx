import * as React from 'react'
import { FileArchive } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { downloadBlob, formatBytes, nextFrame, stripExtension } from '@/lib/utils'

import { docxToRawText } from './docx'
import { Field, OutputPane, ToggleRow, WarningList } from './ui'

interface Converted {
  name: string
  text: string
  warnings: string[]
}

type Spacing = 'blank' | 'single' | 'none'

const SMART = new Map<string, string>([
  ['‘', "'"],
  ['’', "'"],
  ['“', '"'],
  ['”', '"'],
  ['–', '-'],
  ['—', '--'],
  ['…', '...'],
  [' ', ' '],
  ['•', '*'],
])

function postProcess(
  raw: string,
  opts: { spacing: Spacing; trimLines: boolean; plainQuotes: boolean; collapse: boolean },
): string {
  let text = raw.replace(/\r\n?/g, '\n')
  if (opts.plainQuotes) {
    text = text.replace(/[‘’“”–—… •]/g, (c) => SMART.get(c) ?? c)
  }
  let lines = text.split('\n')
  if (opts.trimLines) lines = lines.map((l) => l.replace(/[ \t]+$/, '').replace(/^[ \t]+/, ''))
  if (opts.spacing === 'none') {
    lines = lines.filter((l) => l.trim() !== '')
  } else if (opts.spacing === 'blank') {
    const out: string[] = []
    for (const line of lines) {
      if (line.trim() === '') continue
      out.push(line, '')
    }
    if (out[out.length - 1] === '') out.pop()
    lines = out
  }
  text = lines.join('\n')
  if (opts.collapse) text = text.replace(/\n{3,}/g, '\n\n')
  return text.trimEnd() + (text.trimEnd() === '' ? '' : '\n')
}

function countWords(text: string): number {
  const m = text.match(/[^\s]+/g)
  return m ? m.length : 0
}

export default function DocxToText() {
  const [results, setResults] = React.useState<Converted[]>([])
  const [selected, setSelected] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState<number | null>(null)
  const [zipping, setZipping] = React.useState(false)

  const [spacing, setSpacing] = React.useState<Spacing>('blank')
  const [trimLines, setTrimLines] = React.useState(true)
  const [plainQuotes, setPlainQuotes] = React.useState(false)
  const [collapse, setCollapse] = React.useState(true)

  const handleFiles = React.useCallback(async (files: File[]) => {
    if (files.length === 0) return
    setError(null)
    setResults([])
    setSelected(0)
    setProgress(0)
    const out: Converted[] = []
    const failures: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      await nextFrame()
      try {
        const { value, warnings } = await docxToRawText(file)
        out.push({ name: file.name, text: value, warnings })
      } catch (err) {
        failures.push(err instanceof Error ? err.message : `Could not read ${file.name}.`)
      }
      setProgress(Math.round(((i + 1) / files.length) * 100))
    }
    setResults(out)
    setProgress(null)
    if (failures.length > 0) setError(failures.join(' '))
  }, [])

  const current = results[selected]
  const text = React.useMemo(
    () => (current ? postProcess(current.text, { spacing, trimLines, plainQuotes, collapse }) : ''),
    [current, spacing, trimLines, plainQuotes, collapse],
  )

  const downloadAll = React.useCallback(async () => {
    if (results.length === 0) return
    setZipping(true)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      for (const r of results) {
        zip.file(
          `${stripExtension(r.name)}.txt`,
          postProcess(r.text, { spacing, trimLines, plainQuotes, collapse }),
        )
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      downloadBlob(blob, 'word-documents-as-text.zip')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The ZIP could not be created.')
    } finally {
      setZipping(false)
    }
  }, [results, spacing, trimLines, plainQuotes, collapse])

  const reset = () => {
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
          onFiles={(files) => void handleFiles(files)}
          maxSizeMb={100}
          title="Drop Word documents here"
          hint="or click to browse"
        />
        {progress !== null ? <ProgressPanel label="Extracting text…" value={progress} /> : null}
        {error ? <ErrorNote message={error} onRetry={reset} /> : null}
      </div>
    )
  }

  const words = countWords(text)

  return (
    <div className="space-y-4">
      <ToolPanel
        title="Text layout"
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
        <div className="grid gap-3 sm:grid-cols-2">
          {results.length > 1 ? (
            <Field id="d2t-file" label="Document">
              <Select value={String(selected)} onValueChange={(v) => setSelected(Number(v))}>
                <SelectTrigger id="d2t-file">
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
          <Field id="d2t-spacing" label="Paragraph spacing">
            <Select value={spacing} onValueChange={(v) => setSpacing(v as Spacing)}>
              <SelectTrigger id="d2t-spacing">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">Blank line between paragraphs</SelectItem>
                <SelectItem value="single">Keep the document’s own breaks</SelectItem>
                <SelectItem value="none">One paragraph per line, no blanks</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <ToggleRow
            id="d2t-trim"
            label="Trim indentation and trailing spaces"
            checked={trimLines}
            onCheckedChange={setTrimLines}
          />
          <ToggleRow
            id="d2t-collapse"
            label="Collapse runs of blank lines"
            checked={collapse}
            onCheckedChange={setCollapse}
          />
          <ToggleRow
            id="d2t-quotes"
            label="Straighten smart quotes and dashes"
            hint="Turns “ ” ‘ ’ … into plain ASCII."
            checked={plainQuotes}
            onCheckedChange={setPlainQuotes}
          />
        </div>
      </ToolPanel>

      {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}
      {current && current.warnings.length > 0 ? <WarningList warnings={current.warnings} /> : null}

      <OutputPane
        id="d2t-output"
        title="Plain text"
        value={text}
        filename={`${stripExtension(current?.name ?? 'document')}.txt`}
        mime="text/plain"
        emptyHint="This document has no readable text."
        rows={24}
        downloadLabel="Download .txt"
        stats={[
          { label: 'words', value: words.toLocaleString() },
          { label: 'characters', value: text.length.toLocaleString() },
          { label: 'paragraphs', value: text.split(/\n{2,}/).filter((p) => p.trim() !== '').length.toLocaleString() },
          { label: 'read time', value: `${Math.max(1, Math.round(words / 220))} min` },
          { label: 'size', value: formatBytes(new TextEncoder().encode(text).length) },
        ]}
      />
    </div>
  )
}
