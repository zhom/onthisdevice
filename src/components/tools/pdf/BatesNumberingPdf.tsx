import { useCallback, useMemo, useState } from 'react'
import { Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileChips } from '@/components/shared/FileChips'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, nextFrame, stripExtension } from '@/lib/utils'
import {
  csvBlob,
  displayPointToPdf,
  displaySize,
  findUnsupportedCharacter,
  geomOf,
  hexToRgb01,
  humanPdfError,
  loadPdfLib,
  mmToPt,
  padNumber,
  pdfBlob,
  readFileBytes,
} from './pdf-pages-core'
import { NumberField, ProofPanel } from './pdf-pages-ui'

type Corner =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

const CORNERS: { id: Corner; label: string }[] = [
  { id: 'bottom-right', label: 'Bottom right (legal standard)' },
  { id: 'bottom-center', label: 'Bottom centre' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'top-right', label: 'Top right' },
  { id: 'top-center', label: 'Top centre' },
  { id: 'top-left', label: 'Top left' },
]

const FONTS = [
  { id: 'Helvetica', label: 'Helvetica' },
  { id: 'HelveticaBold', label: 'Helvetica Bold' },
  { id: 'TimesRoman', label: 'Times Roman' },
  { id: 'TimesRomanBold', label: 'Times Roman Bold' },
  { id: 'Courier', label: 'Courier' },
  { id: 'CourierBold', label: 'Courier Bold' },
] as const

type FontId = (typeof FONTS)[number]['id']

interface LogRow {
  file: string
  page: number
  bates: string
}

interface Outcome {
  files: { name: string; blob: Blob; first: string; last: string; pages: number }[]
  zip: Blob | null
  log: LogRow[]
  totalPages: number
}

export default function BatesNumberingPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [prefix, setPrefix] = useState('ABC')
  const [suffix, setSuffix] = useState('')
  const [start, setStart] = useState(1)
  const [digits, setDigits] = useState(6)
  const [step, setStep] = useState(1)
  const [corner, setCorner] = useState<Corner>('bottom-right')
  const [fontId, setFontId] = useState<FontId>('Helvetica')
  const [fontSize, setFontSize] = useState(10)
  const [colour, setColour] = useState('#000000')
  const [marginMm, setMarginMm] = useState(12)
  const [continuous, setContinuous] = useState(true)
  const [whiteBox, setWhiteBox] = useState(true)

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const sample = useMemo(
    () => `${prefix}${padNumber(start, digits)}${suffix}`,
    [digits, prefix, start, suffix],
  )

  const addFiles = useCallback((incoming: File[]) => {
    setFiles((prev) => [...prev, ...incoming])
    setOutcome(null)
    setError(null)
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setOutcome(null)
  }, [])

  const reorder = useCallback((from: number, to: number) => {
    setFiles((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setOutcome(null)
  }, [])

  const run = useCallback(async () => {
    if (files.length === 0) return
    const bad = findUnsupportedCharacter(`${prefix}${suffix}`)
    if (bad) {
      setError(
        `The character “${bad}” cannot be drawn with the fonts built into PDF, which cover Western European alphabets only. Use plain letters, digits, hyphens or underscores in the prefix and suffix.`,
      )
      return
    }

    setBusy(true)
    setError(null)
    setOutcome(null)
    setProgress(0)
    setStatus('Reading documents…')

    try {
      const lib = await loadPdfLib()
      const { r, g, b } = hexToRgb01(colour)
      const margin = mmToPt(marginMm)
      const log: LogRow[] = []
      const results: Outcome['files'] = []
      let counter = start
      let totalPages = 0

      for (let f = 0; f < files.length; f++) {
        const file = files[f]
        setStatus(`Stamping ${file.name} (${f + 1} of ${files.length})…`)
        const bytes = await readFileBytes(file)
        const doc = await lib.PDFDocument.load(bytes, { updateMetadata: false })
        const font = await doc.embedFont(lib.StandardFonts[fontId])
        const pages = doc.getPages()
        if (!continuous) counter = start

        let firstStamp = ''
        let lastStamp = ''

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i]
          const geom = geomOf(page)
          const d = displaySize(geom)
          const text = `${prefix}${padNumber(counter, digits)}${suffix}`
          const textWidth = font.widthOfTextAtSize(text, fontSize)

          const dx =
            corner.endsWith('left')
              ? margin
              : corner.endsWith('center')
                ? (d.w - textWidth) / 2
                : d.w - margin - textWidth
          const baselineFromBottom = corner.startsWith('bottom')
            ? margin
            : d.h - margin - fontSize * 0.8
          const dyFromTop = d.h - baselineFromBottom
          const anchor = displayPointToPdf(geom, dx, dyFromTop)

          if (whiteBox) {
            const pad = fontSize * 0.25
            const boxDx = dx - pad
            const boxDyTop = d.h - (baselineFromBottom - fontSize * 0.28)
            const boxAnchor = displayPointToPdf(geom, boxDx, boxDyTop)
            page.drawRectangle({
              x: boxAnchor.x,
              y: boxAnchor.y,
              width: textWidth + pad * 2,
              height: fontSize * 1.25,
              color: lib.rgb(1, 1, 1),
              rotate: lib.degrees(geom.rotation),
            })
          }

          page.drawText(text, {
            x: anchor.x,
            y: anchor.y,
            size: fontSize,
            font,
            color: lib.rgb(r, g, b),
            rotate: lib.degrees(geom.rotation),
          })

          if (i === 0) firstStamp = text
          lastStamp = text
          log.push({ file: file.name, page: i + 1, bates: text })
          counter += step
          totalPages++

          if (i % 20 === 19) await nextFrame()
        }

        const outBytes = await doc.save({ useObjectStreams: false })
        results.push({
          name: `${stripExtension(file.name)}-bates.pdf`,
          blob: pdfBlob(outBytes),
          first: firstStamp,
          last: lastStamp,
          pages: pages.length,
        })
        setProgress(Math.round(((f + 1) / files.length) * 100))
        await nextFrame()
      }

      let zip: Blob | null = null
      if (results.length > 1) {
        setStatus('Bundling the stamped files…')
        const JSZip = (await import('jszip')).default
        const archive = new JSZip()
        for (const item of results) archive.file(item.name, item.blob)
        archive.file(
          'bates-log.csv',
          csvBlob([['File', 'Page', 'Bates number'], ...log.map((l) => [l.file, l.page, l.bates])]),
        )
        zip = await archive.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      }

      setOutcome({ files: results, zip, log, totalPages })
      setStatus('')
    } catch (err) {
      setError(humanPdfError(err))
    } finally {
      setBusy(false)
    }
  }, [
    colour,
    continuous,
    corner,
    digits,
    files,
    fontId,
    fontSize,
    marginMm,
    prefix,
    start,
    step,
    suffix,
    whiteBox,
  ])

  const logCsv = useMemo(() => {
    if (!outcome) return null
    return csvBlob([
      ['File', 'Page', 'Bates number'],
      ...outcome.log.map((l) => [l.file, l.page, l.bates]),
    ])
  }, [outcome])

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Documents to stamp"
        description="Add every file in the production, in order. Numbering runs continuously across them."
      >
        {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
        <FileDropzone
          accept=".pdf,application/pdf"
          multiple
          onFiles={addFiles}
          title="Drop PDFs here"
          hint="or click to browse"
        />
        <FileChips files={files} onRemove={removeFile} onReorder={reorder} />
      </ToolPanel>

      {files.length > 0 && (
        <>
          <ToolPanel title="Bates number format">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bates-prefix">Prefix</Label>
                <Input
                  id="bates-prefix"
                  value={prefix}
                  disabled={busy}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="ABC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bates-suffix">Suffix</Label>
                <Input
                  id="bates-suffix"
                  value={suffix}
                  disabled={busy}
                  onChange={(e) => setSuffix(e.target.value)}
                  placeholder="(optional)"
                />
              </div>
              <NumberField
                label="Start at"
                min={0}
                max={99999999}
                value={start}
                onChange={setStart}
              />
              <NumberField label="Digits" min={1} max={10} value={digits} onChange={setDigits} />
              <NumberField
                label="Increment by"
                min={1}
                max={100}
                value={step}
                onChange={setStep}
                hint="Leave at 1 unless your protocol numbers every other page."
              />
              <div className="space-y-2">
                <Label id="bates-sample-label">Preview</Label>
                <div
                  className="flex h-9 items-center rounded-md bg-muted px-3 font-mono text-sm text-foreground"
                  aria-labelledby="bates-sample-label"
                >
                  {sample}
                </div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
              <div className="min-w-0">
                <Label htmlFor="bates-continuous" className="cursor-pointer">
                  Continuous numbering across files
                </Label>
                <p className="mt-1 text-xs text-muted-foreground text-pretty">
                  On: file 2 carries on where file 1 stopped, as a production requires. Off: every
                  file restarts at the start number.
                </p>
              </div>
              <Switch
                id="bates-continuous"
                checked={continuous}
                onCheckedChange={setContinuous}
                disabled={busy}
              />
            </div>
          </ToolPanel>

          <ToolPanel title="Placement and appearance">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bates-corner">Position</Label>
                <Select
                  value={corner}
                  onValueChange={(v) => setCorner(v as Corner)}
                  disabled={busy}
                >
                  <SelectTrigger id="bates-corner" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CORNERS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bates-font">Font</Label>
                <Select
                  value={fontId}
                  onValueChange={(v) => setFontId(v as FontId)}
                  disabled={busy}
                >
                  <SelectTrigger id="bates-font" className="w-full">
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

              <NumberField
                label="Font size"
                suffix="pt"
                min={5}
                max={36}
                value={fontSize}
                onChange={setFontSize}
              />
              <NumberField
                label="Margin from the edge"
                suffix="mm"
                min={2}
                max={40}
                value={marginMm}
                onChange={setMarginMm}
              />

              <div className="space-y-2">
                <Label htmlFor="bates-colour">Colour</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="bates-colour"
                    type="color"
                    value={colour}
                    disabled={busy}
                    onChange={(e) => setColour(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                  />
                  <Input
                    value={colour}
                    disabled={busy}
                    onChange={(e) => setColour(e.target.value)}
                    aria-label="Bates number colour as a hex code"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
                <Label htmlFor="bates-whitebox" className="cursor-pointer text-sm">
                  White backing box
                </Label>
                <Switch
                  id="bates-whitebox"
                  checked={whiteBox}
                  onCheckedChange={setWhiteBox}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" className="gap-2" onClick={() => void run()} disabled={busy}>
                <Hash className="size-4" aria-hidden="true" />
                {busy ? 'Stamping…' : `Stamp ${files.length} file${files.length === 1 ? '' : 's'}`}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFiles([])
                  setOutcome(null)
                  setError(null)
                }}
                disabled={busy}
              >
                Clear all
              </Button>
            </div>
          </ToolPanel>
        </>
      )}

      {busy && <ProgressPanel label={status || 'Stamping…'} value={progress} />}

      {outcome && (
        <ToolPanel title="Stamped and logged">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Files" value={outcome.files.length} />
            <ResultStat label="Pages stamped" value={outcome.totalPages} emphasis />
            <ResultStat
              label="Bates range"
              value={`${outcome.log[0]?.bates ?? '–'} to ${outcome.log[outcome.log.length - 1]?.bates ?? '–'}`}
            />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>First</TableHead>
                  <TableHead>Last</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outcome.files.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell className="max-w-40 truncate" title={item.name}>
                      {item.name}
                    </TableCell>
                    <TableCell className="tabular-nums">{item.pages}</TableCell>
                    <TableCell className="font-mono text-xs">{item.first}</TableCell>
                    <TableCell className="font-mono text-xs">{item.last}</TableCell>
                    <TableCell className="text-right">
                      <DownloadButton
                        blob={item.blob}
                        filename={item.name}
                        label="PDF"
                        size="sm"
                        variant="outline"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap gap-2">
            {outcome.zip && (
              <DownloadButton
                blob={outcome.zip}
                filename="bates-stamped.zip"
                label="Download all (.zip)"
              />
            )}
            {logCsv && (
              <DownloadButton
                blob={logCsv}
                filename="bates-log.csv"
                label="Download Bates log (.csv)"
                variant="outline"
              />
            )}
          </div>

          <p className="text-sm text-muted-foreground text-pretty">
            Each stamp is real PDF text, so it is searchable, copyable and sharp at any
            zoom. Total output {formatBytes(outcome.files.reduce((a, f) => a + f.blob.size, 0))}.
          </p>
        </ToolPanel>
      )}

      <ProofPanel what="Your production set" />
    </div>
  )
}
