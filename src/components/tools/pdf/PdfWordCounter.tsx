import { useCallback, useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { Formula } from '@/components/shared/Formula'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatNumber, nextFrame } from '@/lib/utils'
import {
  copyBytes,
  csvBlob,
  humanPdfError,
  loadPdfjs,
  outputName,
  readFileBytes,
} from './pdf-pages-core'
import { NumberField, ProofPanel } from './pdf-pages-ui'

interface TextLike {
  str: string
  transform: number[]
  width: number
  height: number
  hasEOL: boolean
}

function isTextLike(item: unknown): item is TextLike {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    'transform' in item &&
    Array.isArray((item as { transform: unknown }).transform)
  )
}

/* Kana, CJK ideographs, compatibility ideographs, half-width kana and Hangul. */
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]/g

/** Whitespace-separated words, with CJK characters counted individually. */
export function countWords(text: string): number {
  const cjk = text.match(CJK)?.length ?? 0
  const rest = text.replace(CJK, ' ').trim()
  const latin = rest ? rest.split(/\s+/).filter(Boolean).length : 0
  return cjk + latin
}

interface PageStat {
  page: number
  words: number
  chars: number
  charsNoSpaces: number
}

interface Report {
  pages: PageStat[]
  text: string
  words: number
  chars: number
  charsNoSpaces: number
  emptyPages: number
}

export default function PdfWordCounter() {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)

  const [wpm, setWpm] = useState(238)
  const [ratePerWord, setRatePerWord] = useState(0.12)

  const analyse = useCallback(async (next: File) => {
    setBusy(true)
    setError(null)
    setReport(null)
    setProgress(0)

    try {
      const bytes = await readFileBytes(next)
      const pdfjs = await loadPdfjs()
      const doc = await pdfjs.getDocument({ data: copyBytes(bytes) }).promise
      const total = doc.numPages
      const pages: PageStat[] = []
      const parts: string[] = []

      for (let n = 1; n <= total; n++) {
        const page = await doc.getPage(n)
        const content = await page.getTextContent()

        let text = ''
        let prev: TextLike | null = null
        for (const raw of content.items) {
          if (!isTextLike(raw)) continue
          if (raw.str === '') {
            if (raw.hasEOL) text += '\n'
            continue
          }
          if (prev) {
            const lineHeight = prev.height || 10
            const dy = Math.abs((raw.transform[5] ?? 0) - (prev.transform[5] ?? 0))
            if (prev.hasEOL || dy > lineHeight * 0.5) {
              text += '\n'
            } else {
              const gap = (raw.transform[4] ?? 0) - ((prev.transform[4] ?? 0) + prev.width)
              if (gap > lineHeight * 0.16) text += ' '
            }
          }
          text += raw.str
          prev = raw
        }
        page.cleanup()

        const trimmed = text.replace(/[ \t]+\n/g, '\n').trim()
        parts.push(trimmed)
        pages.push({
          page: n,
          words: countWords(trimmed),
          chars: trimmed.length,
          charsNoSpaces: trimmed.replace(/\s/g, '').length,
        })

        if (n % 5 === 0 || n === total) {
          setProgress(Math.round((n / total) * 100))
          await nextFrame()
        }
      }

      void doc.loadingTask.destroy()

      const joined = parts.join('\n\n')
      setReport({
        pages,
        text: joined,
        words: pages.reduce((a, p) => a + p.words, 0),
        chars: pages.reduce((a, p) => a + p.chars, 0),
        charsNoSpaces: pages.reduce((a, p) => a + p.charsNoSpaces, 0),
        emptyPages: pages.filter((p) => p.words === 0).length,
      })
    } catch (err) {
      setError(humanPdfError(err, next.name))
    } finally {
      setBusy(false)
    }
  }, [])

  const onFiles = useCallback(
    (files: File[]) => {
      const next = files[0]
      if (!next) return
      setFile(next)
      void analyse(next)
    },
    [analyse],
  )

  const csv = useMemo(() => {
    if (!report) return null
    return csvBlob([
      ['Page', 'Words', 'Characters', 'Characters (no spaces)'],
      ...report.pages.map((p) => [p.page, p.words, p.chars, p.charsNoSpaces]),
      ['Total', report.words, report.chars, report.charsNoSpaces],
    ])
  }, [report])

  const textBlob = useMemo(
    () => (report ? new Blob([report.text], { type: 'text/plain;charset=utf-8' }) : null),
    [report],
  )

  const readingMinutes = report && wpm > 0 ? report.words / wpm : 0
  const speakingMinutes = report ? report.words / 130 : 0
  const fee = report ? report.words * ratePerWord : 0

  const scanned =
    report !== null && report.pages.length > 0 && report.words < report.pages.length * 3

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={onFiles}
          title="Drop a PDF to count its words"
          hint="or click to browse"
        />
        <ProofPanel what="Your manuscript" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
      {busy && <ProgressPanel label="Reading the text layer…" value={progress} />}

      {report && (
        <>
          <ToolPanel title={file.name}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultStat label="Words" value={formatNumber(report.words, 0)} emphasis />
              <ResultStat label="Characters" value={formatNumber(report.chars, 0)} />
              <ResultStat
                label="Characters, no spaces"
                value={formatNumber(report.charsNoSpaces, 0)}
              />
              <ResultStat label="Pages" value={report.pages.length} />
            </div>

            {scanned && (
              <p
                className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-foreground text-pretty"
                role="status"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Almost no text was found. This PDF is very likely a scan: a picture of a document
                  with no text layer. Counting the words in it would need OCR, which this tool does not
                  have. Open it in a reader and try to select a word: if the
                  cursor will not highlight anything, there is nothing here to count.
                </span>
              </p>
            )}

            {!scanned && report.emptyPages > 0 && (
              <p className="text-sm text-muted-foreground text-pretty">
                {report.emptyPages} page{report.emptyPages === 1 ? '' : 's'} contained no selectable
                text. These are usually full-page images, plates or separators.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {csv && (
                <DownloadButton
                  blob={csv}
                  filename={outputName(file.name, '-word-count', 'csv')}
                  label="Download per-page CSV"
                  variant="outline"
                />
              )}
              {textBlob && (
                <DownloadButton
                  blob={textBlob}
                  filename={outputName(file.name, '-text', 'txt')}
                  label="Download extracted text"
                  variant="outline"
                />
              )}
              <CopyButton value={report.text} label="Copy all text" />
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFile(null)
                  setReport(null)
                }}
              >
                Use a different file
              </Button>
            </div>
          </ToolPanel>

          <Tabs defaultValue="time">
            <TabsList>
              <TabsTrigger value="time">Reading time</TabsTrigger>
              <TabsTrigger value="fee">Rate estimate</TabsTrigger>
              <TabsTrigger value="pages">Per page</TabsTrigger>
            </TabsList>

            <TabsContent value="time" className="mt-4">
              <ToolPanel title="How long it takes to read or say">
                <NumberField
                  label="Reading speed"
                  suffix="words / min"
                  min={50}
                  max={1200}
                  step={10}
                  value={wpm}
                  onChange={setWpm}
                  hint="238 wpm is the mean for silent reading of English non-fiction; use 150 for dense technical text."
                  className="max-w-xs"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <ResultStat
                    label="Silent reading"
                    value={formatDuration(readingMinutes)}
                    emphasis
                  />
                  <ResultStat
                    label="Read aloud (130 wpm)"
                    value={formatDuration(speakingMinutes)}
                    hint="A typical presentation pace"
                  />
                </div>
                <Formula caption="Your numbers, substituted.">
                  {`reading time = words ÷ reading speed
             = ${formatNumber(report.words, 0)} ÷ ${wpm}
             = ${readingMinutes.toFixed(1)} minutes  (${formatDuration(readingMinutes)})`}
                </Formula>
              </ToolPanel>
            </TabsContent>

            <TabsContent value="fee" className="mt-4">
              <ToolPanel
                title="What this document is worth at your rate"
                description="For translators, copy-editors and writers who quote per word."
              >
                <NumberField
                  label="Your rate"
                  suffix="per word"
                  min={0}
                  max={100}
                  step={0.01}
                  value={ratePerWord}
                  onChange={setRatePerWord}
                  className="max-w-xs"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <ResultStat
                    label="Estimated fee"
                    value={formatNumber(fee, 2)}
                    emphasis
                    hint="In the currency of your rate. No exchange rate is applied."
                  />
                  <ResultStat
                    label="Average words per page"
                    value={formatNumber(report.words / Math.max(1, report.pages.length), 0)}
                  />
                </div>
                <Formula caption="Standard-page pricing uses 250 words (English) or 1,800 characters (German, Polish) per page.">
                  {`fee            = words × rate
               = ${formatNumber(report.words, 0)} × ${ratePerWord}
               = ${formatNumber(fee, 2)}

standard pages = words ÷ 250          = ${(report.words / 250).toFixed(2)}
               = characters ÷ 1800    = ${(report.chars / 1800).toFixed(2)}`}
                </Formula>
              </ToolPanel>
            </TabsContent>

            <TabsContent value="pages" className="mt-4">
              <ToolPanel title="Words on every page">
                <div className="max-h-[28rem] overflow-auto rounded-lg bg-muted">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Page</TableHead>
                        <TableHead className="text-right">Words</TableHead>
                        <TableHead className="text-right">Characters</TableHead>
                        <TableHead className="text-right">No spaces</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.pages.map((p) => (
                        <TableRow key={p.page}>
                          <TableCell className="tabular-nums">{p.page}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(p.words, 0)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(p.chars, 0)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(p.charsNoSpaces, 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ToolPanel>
            </TabsContent>
          </Tabs>
        </>
      )}

      <ProofPanel what="Your manuscript" />
    </div>
  )
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min'
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} sec`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours === 0) return `${Math.round(minutes)} min`
  return `${hours} h ${mins} min`
}
