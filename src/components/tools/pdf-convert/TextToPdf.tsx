import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileDown, RotateCcw, Type } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, formatNumber, nextFrame, stripExtension } from '@/lib/utils'
import { PAGE_SIZES, mmToPt, pageSizeById } from './pdf-common'
import type { FontFamily } from './pdf-layout'

const FAMILY_OPTIONS: { value: FontFamily; label: string; note: string }[] = [
  { value: 'helvetica', label: 'Helvetica', note: 'Neutral sans serif, the default for notes and letters.' },
  { value: 'times', label: 'Times', note: 'Serif, denser on the page and traditional for long prose.' },
  { value: 'courier', label: 'Courier', note: 'Monospaced. Keeps columns in logs, tables and code aligned.' },
]

const SAMPLE_PLACEHOLDER = `Paste or type anything here.

Blank lines become paragraph spacing and every hard line break is kept, so notes, logs, poetry and code all hold their shape.`

export default function TextToPdf() {
  const [text, setText] = useState('')
  const [filename, setFilename] = useState('document')
  const [family, setFamily] = useState<FontFamily>('helvetica')
  const [fontSize, setFontSize] = useState(11)
  const [lineHeight, setLineHeight] = useState(1.45)
  const [marginMm, setMarginMm] = useState(20)
  const [sizeId, setSizeId] = useState('a4')
  const [pageNumbers, setPageNumbers] = useState(false)

  const [building, setBuilding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Blob | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [dropped, setDropped] = useState(0)

  // Any typesetting change invalidates the PDF that is already on offer.
  useEffect(() => {
    setResult(null)
  }, [family, fontSize, lineHeight, marginMm, sizeId, pageNumbers])

  const stats = useMemo(() => {
    const words = text.split(/\s+/).filter((w) => w !== '').length
    const lines = text === '' ? 0 : text.split('\n').length
    return { words, lines, chars: text.length }
  }, [text])

  const handleFiles = useCallback(async (files: File[]) => {
    const picked = files[0]
    if (!picked) return
    setError(null)
    try {
      const content = await picked.text()
      setText(content)
      setFilename(stripExtension(picked.name) || 'document')
      setResult(null)
    } catch {
      setError('That file could not be read as text. Plain .txt, .log, .csv and .md files work best.')
    }
  }, [])

  const build = useCallback(async () => {
    if (text.trim() === '') {
      setError('Add some text first. The PDF would otherwise be blank.')
      return
    }
    setBuilding(true)
    setError(null)
    setResult(null)
    setProgress(0)
    try {
      const { PdfWriter, sanitizeForStandardFont, toBlob } = await import('./pdf-layout')
      const size = pageSizeById(sizeId)
      const margin = mmToPt(marginMm)
      const writer = await PdfWriter.create({
        size,
        margins: { top: margin, right: margin, bottom: margin, left: margin },
        lineHeight,
        family,
        pageNumbers,
      })

      const sanitized = sanitizeForStandardFont(text.replace(/\r\n?/g, '\n'))
      const lines = sanitized.text.split('\n')
      const CHUNK = 400
      for (let i = 0; i < lines.length; i += CHUNK) {
        const chunk = lines.slice(i, i + CHUNK).join('\n')
        writer.writeRuns([{ text: chunk, style: 'regular' }], { size: fontSize, lineHeight })
        setProgress(Math.min(100, Math.round(((i + CHUNK) / lines.length) * 100)))
        await nextFrame()
      }

      const bytes = await writer.save({ title: filename })
      setDropped(sanitized.dropped)
      setPageCount(writer.pageCount)
      setResult(toBlob(bytes, 'application/pdf'))
    } catch (err) {
      setError(
        err instanceof Error ? `The PDF could not be produced (${err.message}).` : 'The PDF could not be produced.',
      )
    } finally {
      setBuilding(false)
    }
  }, [family, filename, fontSize, lineHeight, marginMm, pageNumbers, sizeId, text])

  const clear = useCallback(() => {
    setText('')
    setResult(null)
    setError(null)
    setDropped(0)
    setPageCount(0)
  }, [])

  return (
    <div className="space-y-6">
      <ToolPanel
        title="Your text"
        description="Type or paste directly, or drop a plain-text file below."
        footer={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="ttp-filename" className="text-sm font-normal text-muted-foreground">
                File name
              </Label>
              <Input
                id="ttp-filename"
                value={filename}
                onChange={(event) => setFilename(event.target.value)}
                className="w-40"
              />
              <span className="text-sm text-muted-foreground">.pdf</span>
            </div>
            <Button variant="ghost" onClick={clear} disabled={building || text === ''}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Clear
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Label htmlFor="ttp-text" className="sr-only">
            Text to convert
          </Label>
          <Textarea
            id="ttp-text"
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setResult(null)
            }}
            placeholder={SAMPLE_PLACEHOLDER}
            rows={12}
            className="min-h-56 font-mono text-sm"
            spellCheck={false}
          />
          <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {formatNumber(stats.words, 0)} {stats.words === 1 ? 'word' : 'words'} · {formatNumber(stats.lines, 0)}{' '}
            {stats.lines === 1 ? 'line' : 'lines'} · {formatNumber(stats.chars, 0)} {stats.chars === 1 ? 'character' : 'characters'}
          </p>
          <FileDropzone
            accept=".txt,.log,.csv,.md,.markdown,text/plain"
            onFiles={handleFiles}
            maxSizeMb={50}
            title="Or drop a .txt file"
            hint="its contents replace the editor above"
          />
        </div>
      </ToolPanel>

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      <ToolPanel
        title="Typesetting"
        description="These settings are applied when the PDF is generated."
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={build} disabled={building || text.trim() === ''}>
              <FileDown className="size-4" aria-hidden="true" />
              {building ? 'Typesetting…' : result ? 'Rebuild PDF' : 'Create PDF'}
            </Button>
            {result && (
              <DownloadButton blob={result} filename={`${filename || 'document'}.pdf`} label="Download PDF" />
            )}
          </div>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ttp-font">Font</Label>
            <Select value={family} onValueChange={(value) => setFamily(value as FontFamily)} disabled={building}>
              <SelectTrigger id="ttp-font" className="w-full">
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
              {FAMILY_OPTIONS.find((o) => o.value === family)?.note}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ttp-size">Page size</Label>
            <Select value={sizeId} onValueChange={setSizeId} disabled={building}>
              <SelectTrigger id="ttp-size" className="w-full">
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
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="ttp-fontsize">Font size</Label>
              <span className="text-sm tabular-nums text-muted-foreground">{fontSize} pt</span>
            </div>
            <Slider
              id="ttp-fontsize"
              min={7}
              max={18}
              step={0.5}
              value={[fontSize]}
              onValueChange={(v) => setFontSize(v[0] ?? 11)}
              disabled={building}
              aria-label="Font size in points"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="ttp-lineheight">Line height</Label>
              <span className="text-sm tabular-nums text-muted-foreground">{lineHeight.toFixed(2)}×</span>
            </div>
            <Slider
              id="ttp-lineheight"
              min={1}
              max={2.2}
              step={0.05}
              value={[lineHeight]}
              onValueChange={(v) => setLineHeight(v[0] ?? 1.45)}
              disabled={building}
              aria-label="Line height multiplier"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="ttp-margin">Margin</Label>
              <span className="text-sm tabular-nums text-muted-foreground">{marginMm} mm</span>
            </div>
            <Slider
              id="ttp-margin"
              min={5}
              max={45}
              step={1}
              value={[marginMm]}
              onValueChange={(v) => setMarginMm(v[0] ?? 20)}
              disabled={building}
              aria-label="Page margin in millimetres"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ttp-pagenumbers">Page numbers</Label>
            <div className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5">
              <Switch
                id="ttp-pagenumbers"
                checked={pageNumbers}
                onCheckedChange={setPageNumbers}
                disabled={building}
              />
              <span className="text-sm text-muted-foreground">
                {pageNumbers ? 'Centred in the bottom margin as “3 / 12”' : 'No page numbers'}
              </span>
            </div>
          </div>
        </div>
      </ToolPanel>

      {building && <ProgressPanel label="Wrapping and paginating text…" value={progress} />}

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
                . The standard PDF fonts cover Western European alphabets only, so Cyrillic, Greek, CJK and emoji
                cannot be drawn without embedding a font file.
              </>
            ) : (
              <>
                Every character was representable. Adjust the settings above and press Rebuild PDF to try a different
                layout. Your text stays in the editor.
              </>
            )}
          </p>
        </ToolPanel>
      )}

      {text === '' && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Type className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Nothing you type here is transmitted. The PDF is assembled by pdf-lib in this tab, which is why the tool
            keeps working offline.
          </span>
        </p>
      )}
    </div>
  )
}
