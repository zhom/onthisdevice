import { useCallback, useMemo, useState } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, nextFrame } from '@/lib/utils'
import {
  humanPdfError,
  loadPdfLib,
  outputName,
  parsePageRanges,
  pdfBlob,
  readFileBytes,
} from './pdf-pages-core'
import { ProofPanel } from './pdf-pages-ui'

type Mode = 'all' | 'range' | 'pairs'

interface Outcome {
  blob: Blob
  name: string
  pages: number
}

/** Build the output order (1-based page numbers) for the chosen mode. */
function buildOrder(mode: Mode, pageCount: number, rangeSpec: string): number[] {
  const base = Array.from({ length: pageCount }, (_, i) => i + 1)

  if (mode === 'all') return base.slice().reverse()

  if (mode === 'pairs') {
    // Reverse sheet order but keep front/back together: 1,2,3,4,5,6 -> 5,6,3,4,1,2
    const out: number[] = []
    for (let i = Math.floor((pageCount - 1) / 2) * 2; i >= 0; i -= 2) {
      out.push(base[i])
      if (i + 1 < pageCount) out.push(base[i + 1])
    }
    return out
  }

  const selected = parsePageRanges(rangeSpec, pageCount)
  const sorted = [...selected].sort((x, y) => x - y)
  const reversed = sorted.slice().reverse()
  const map = new Map<number, number>()
  sorted.forEach((page, i) => map.set(page, reversed[i]))
  return base.map((page) => map.get(page) ?? page)
}

export default function ReversePdfPageOrder() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [mode, setMode] = useState<Mode>('all')
  const [rangeSpec, setRangeSpec] = useState('1-')

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const onFiles = useCallback(async (files: File[]) => {
    const next = files[0]
    if (!next) return
    setError(null)
    setOutcome(null)
    try {
      const bytes = await readFileBytes(next)
      const lib = await loadPdfLib()
      const doc = await lib.PDFDocument.load(bytes, { updateMetadata: false })
      setFile(next)
      setPageCount(doc.getPageCount())
    } catch (err) {
      setError(humanPdfError(err, next.name))
    }
  }, [])

  const previewOrder = useMemo(() => {
    if (pageCount === 0) return { order: [] as number[], error: null as string | null }
    try {
      return { order: buildOrder(mode, pageCount, rangeSpec), error: null }
    } catch (err) {
      return { order: [], error: err instanceof Error ? err.message : String(err) }
    }
  }, [mode, pageCount, rangeSpec])

  const run = useCallback(async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setOutcome(null)
    setProgress(0)

    try {
      const bytes = await readFileBytes(file)
      const lib = await loadPdfLib()
      const src = await lib.PDFDocument.load(bytes, { updateMetadata: false })
      const total = src.getPageCount()
      const order = buildOrder(mode, total, rangeSpec)

      const out = await lib.PDFDocument.create()
      const title = src.getTitle()
      const author = src.getAuthor()
      if (title) out.setTitle(title)
      if (author) out.setAuthor(author)

      const copied = await out.copyPages(
        src,
        order.map((p) => p - 1),
      )
      for (let i = 0; i < copied.length; i++) {
        out.addPage(copied[i])
        if (i % 50 === 49) {
          setProgress(Math.round(((i + 1) / copied.length) * 100))
          await nextFrame()
        }
      }

      const outBytes = await out.save({ useObjectStreams: false })
      setProgress(100)
      setOutcome({
        blob: pdfBlob(outBytes),
        name: outputName(file.name, '-reversed'),
        pages: out.getPageCount(),
      })
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }, [file, mode, rangeSpec])

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={(files) => void onFiles(files)}
          title="Drop a PDF to flip its page order"
          hint="or click to browse"
        />
        <ProofPanel what="Your PDF" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Reverse order"
        description="Pages are copied whole, in the new order. Nothing is re-rendered, so quality and text stay exactly as they were."
      >
        {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

        <p className="truncate text-sm text-muted-foreground" title={file.name}>
          {file.name} · {pageCount} page{pageCount === 1 ? '' : 's'} · {formatBytes(file.size)}
        </p>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">What to reverse</legend>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as Mode)}
            className="gap-2"
            disabled={busy}
          >
            <div className="flex items-start gap-2">
              <RadioGroupItem value="all" id="rev-all" className="mt-1" />
              <Label htmlFor="rev-all" className="cursor-pointer font-normal">
                Every page (last becomes first)
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="pairs" id="rev-pairs" className="mt-1" />
              <Label htmlFor="rev-pairs" className="cursor-pointer font-normal">
                Sheets, keeping front and back together (1,2,3,4 → 3,4,1,2)
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="range" id="rev-range" className="mt-1" />
              <Label htmlFor="rev-range" className="cursor-pointer font-normal">
                Only a page range (the other pages stay in place)
              </Label>
            </div>
          </RadioGroup>
        </fieldset>

        {mode === 'range' && (
          <div className="max-w-xs space-y-2">
            <Label htmlFor="rev-range-input">Pages to reverse</Label>
            <Input
              id="rev-range-input"
              value={rangeSpec}
              placeholder="3-12"
              disabled={busy}
              onChange={(event) => setRangeSpec(event.target.value)}
            />
          </div>
        )}

        {previewOrder.error ? (
          <p className="text-sm text-destructive" role="alert">
            {previewOrder.error}
          </p>
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">New page order</p>
            <div className="overflow-x-auto">
              <ol className="flex w-max min-w-full gap-1.5">
                {previewOrder.order.slice(0, 30).map((page, i) => (
                  <li
                    key={`${page}-${i}`}
                    className="flex w-12 shrink-0 flex-col items-center rounded-md bg-background px-1 py-1.5 text-center"
                  >
                    <span className="text-[11px] font-semibold tabular-nums text-foreground">
                      {i + 1}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      was {page}
                    </span>
                  </li>
                ))}
                {previewOrder.order.length > 30 && (
                  <li className="flex w-12 shrink-0 items-center justify-center text-xs text-muted-foreground">
                    +{previewOrder.order.length - 30}
                  </li>
                )}
              </ol>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="gap-2"
            onClick={() => void run()}
            disabled={busy || previewOrder.error !== null}
          >
            <ArrowDownUp className="size-4" aria-hidden="true" />
            {busy ? 'Reversing…' : 'Reverse page order'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFile(null)
              setOutcome(null)
              setError(null)
            }}
            disabled={busy}
          >
            Use a different file
          </Button>
        </div>
      </ToolPanel>

      {busy && <ProgressPanel label="Reversing page order…" value={progress} />}

      {outcome && (
        <ToolPanel title="Reversed PDF ready">
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultStat label="Pages" value={outcome.pages} emphasis />
            <ResultStat label="Output size" value={formatBytes(outcome.blob.size)} />
          </div>
          <DownloadButton blob={outcome.blob} filename={outcome.name} label="Download PDF" />
        </ToolPanel>
      )}

      <ProofPanel what="Your PDF" />
    </div>
  )
}
