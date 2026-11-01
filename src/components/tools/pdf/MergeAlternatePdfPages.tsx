import { useCallback, useMemo, useState } from 'react'
import { Combine, FileText, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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
  pdfBlob,
  readFileBytes,
} from './pdf-pages-core'
import { ProofPanel } from './pdf-pages-ui'

type Leftovers = 'append' | 'drop'

interface Slot {
  file: File
  pageCount: number
}

interface Outcome {
  blob: Blob
  name: string
  pages: number
  fromA: number
  fromB: number
}

export default function MergeAlternatePdfPages() {
  const [a, setA] = useState<Slot | null>(null)
  const [b, setB] = useState<Slot | null>(null)
  const [reverseB, setReverseB] = useState(true)
  const [startWith, setStartWith] = useState<'a' | 'b'>('a')
  const [leftovers, setLeftovers] = useState<Leftovers>('append')

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const accept = useCallback(
    (which: 'a' | 'b') => async (files: File[]) => {
      const file = files[0]
      if (!file) return
      setError(null)
      setOutcome(null)
      try {
        const bytes = await readFileBytes(file)
        const lib = await loadPdfLib()
        const doc = await lib.PDFDocument.load(bytes, { updateMetadata: false })
        const slot: Slot = { file, pageCount: doc.getPageCount() }
        if (which === 'a') setA(slot)
        else setB(slot)
      } catch (err) {
        setError(humanPdfError(err, file.name))
      }
    },
    [],
  )

  /** The interleaved order, as (source, page number) pairs. */
  const plan = useMemo(() => {
    if (!a || !b) return []

    const orderA = Array.from({ length: a.pageCount }, (_, i) => i + 1)
    const orderB = Array.from({ length: b.pageCount }, (_, i) => i + 1)
    if (reverseB) orderB.reverse()

    const firstLabel = startWith === 'a' ? 'A' : 'B'
    const secondLabel = startWith === 'a' ? 'B' : 'A'
    const firstOrder = startWith === 'a' ? orderA : orderB
    const secondOrder = startWith === 'a' ? orderB : orderA

    const rows: { source: string; page: number }[] = []
    const n =
      leftovers === 'drop'
        ? Math.min(firstOrder.length, secondOrder.length)
        : Math.max(firstOrder.length, secondOrder.length)

    for (let i = 0; i < n; i++) {
      if (i < firstOrder.length) rows.push({ source: firstLabel, page: firstOrder[i] })
      if (i < secondOrder.length) rows.push({ source: secondLabel, page: secondOrder[i] })
    }
    return rows
  }, [a, b, leftovers, reverseB, startWith])

  const run = useCallback(async () => {
    if (!a || !b) return
    setBusy(true)
    setError(null)
    setOutcome(null)
    setProgress(0)
    setStatus('Reading both documents…')

    try {
      const lib = await loadPdfLib()
      const [bytesA, bytesB] = await Promise.all([readFileBytes(a.file), readFileBytes(b.file)])
      const docA = await lib.PDFDocument.load(bytesA, { updateMetadata: false })
      const docB = await lib.PDFDocument.load(bytesB, { updateMetadata: false })

      setStatus('Interleaving pages…')
      const out = await lib.PDFDocument.create()
      const title = docA.getTitle()
      if (title) out.setTitle(title)

      const copiedA = await out.copyPages(docA, docA.getPageIndices())
      await nextFrame()
      const copiedB = await out.copyPages(docB, docB.getPageIndices())
      await nextFrame()

      let fromA = 0
      let fromB = 0
      for (let i = 0; i < plan.length; i++) {
        const row = plan[i]
        const page = row.source === 'A' ? copiedA[row.page - 1] : copiedB[row.page - 1]
        if (!page) continue
        out.addPage(page)
        if (row.source === 'A') fromA++
        else fromB++
        if (i % 30 === 29) {
          setProgress(Math.round(((i + 1) / plan.length) * 100))
          await nextFrame()
        }
      }

      setStatus('Writing the PDF…')
      const outBytes = await out.save({ useObjectStreams: false })
      setProgress(100)
      setOutcome({
        blob: pdfBlob(outBytes),
        name: outputName(a.file.name, '-collated'),
        pages: out.getPageCount(),
        fromA,
        fromB,
      })
      setStatus('')
    } catch (err) {
      setError(humanPdfError(err))
    } finally {
      setBusy(false)
    }
  }, [a, b, plan])

  const mismatch = a && b && a.pageCount !== b.pageCount

  return (
    <div className="space-y-5">
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      <div className="grid gap-4 md:grid-cols-2">
        <ToolPanel title="File A: the odd pages" description="Fronts: pages 1, 3, 5, 7…">
          {a ? (
            <div className="flex items-center gap-3 rounded-lg bg-card p-3">
              <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={a.file.name}>
                  {a.file.name}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {a.pageCount} page{a.pageCount === 1 ? '' : 's'} · {formatBytes(a.file.size)}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setA(null)}>
                Replace
              </Button>
            </div>
          ) : (
            <FileDropzone
              accept=".pdf,application/pdf"
              onFiles={(files) => void accept('a')(files)}
              title="Drop the odd-page scan"
              hint="the first pass through the feeder"
            />
          )}
        </ToolPanel>

        <ToolPanel title="File B: the even pages" description="Backs: pages 2, 4, 6, 8…">
          {b ? (
            <div className="flex items-center gap-3 rounded-lg bg-card p-3">
              <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={b.file.name}>
                  {b.file.name}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {b.pageCount} page{b.pageCount === 1 ? '' : 's'} · {formatBytes(b.file.size)}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setB(null)}>
                Replace
              </Button>
            </div>
          ) : (
            <FileDropzone
              accept=".pdf,application/pdf"
              onFiles={(files) => void accept('b')(files)}
              title="Drop the even-page scan"
              hint="the second pass, usually in reverse"
            />
          )}
        </ToolPanel>
      </div>

      {a && b && (
        <ToolPanel title="How to interleave">
          <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
            <div className="min-w-0">
              <Label htmlFor="reverse-b" className="cursor-pointer">
                Reverse file B (the even pages)
              </Label>
              <p className="mt-1 text-xs text-muted-foreground text-pretty">
                Turn this on when you flipped the whole stack over and fed it again. The backs come
                out last-page-first. This is the usual case, so it is on by default.
              </p>
            </div>
            <Switch
              id="reverse-b"
              checked={reverseB}
              onCheckedChange={setReverseB}
              disabled={busy}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-with">Start with</Label>
              <Select
                value={startWith}
                onValueChange={(v) => setStartWith(v as 'a' | 'b')}
                disabled={busy}
              >
                <SelectTrigger id="start-with" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a">File A (odd pages)</SelectItem>
                  <SelectItem value="b">File B (even pages)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leftovers">If one file is longer</Label>
              <Select
                value={leftovers}
                onValueChange={(v) => setLeftovers(v as Leftovers)}
                disabled={busy}
              >
                <SelectTrigger id="leftovers" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="append">Keep the extra pages at the end</SelectItem>
                  <SelectItem value="drop">Stop when the shorter file runs out</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mismatch && (
            <p
              className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-foreground text-pretty"
              role="status"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                The two files have different page counts ({a.pageCount} and {b.pageCount}). That is
                normal when the last sheet is single-sided. Check the order preview below before you
                download.
              </span>
            </p>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              Resulting order ({plan.length} pages)
            </p>
            <div className="overflow-x-auto">
              <ol className="flex w-max min-w-full gap-1.5">
                {plan.slice(0, 24).map((row, i) => (
                  <li
                    key={`${row.source}-${row.page}-${i}`}
                    className="flex w-14 shrink-0 flex-col items-center rounded-md bg-background px-1 py-1.5 text-center"
                  >
                    <span className="text-[11px] font-semibold tabular-nums text-foreground">
                      {i + 1}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {row.source} p{row.page}
                    </span>
                  </li>
                ))}
                {plan.length > 24 && (
                  <li className="flex w-14 shrink-0 items-center justify-center text-xs text-muted-foreground">
                    +{plan.length - 24}
                  </li>
                )}
              </ol>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" className="gap-2" onClick={() => void run()} disabled={busy}>
              <Combine className="size-4" aria-hidden="true" />
              {busy ? 'Merging…' : 'Merge alternate pages'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setA(null)
                setB(null)
                setOutcome(null)
              }}
              disabled={busy}
            >
              Start over
            </Button>
          </div>
        </ToolPanel>
      )}

      {busy && <ProgressPanel label={status || 'Merging…'} value={progress} />}

      {outcome && (
        <ToolPanel title="Collated PDF ready">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Pages" value={outcome.pages} emphasis />
            <ResultStat label="From file A" value={outcome.fromA} />
            <ResultStat label="From file B" value={outcome.fromB} />
          </div>
          <p className="text-sm text-muted-foreground text-pretty">
            Pages are copied object for object, so the scan quality, text layer and page size of both
            originals are preserved exactly.
          </p>
          <DownloadButton
            blob={outcome.blob}
            filename={outcome.name}
            label="Download collated PDF"
          />
        </ToolPanel>
      )}

      <ProofPanel what="Both scans" />
    </div>
  )
}
