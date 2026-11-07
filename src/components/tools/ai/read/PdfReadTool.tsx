/**
 * OCR for scanned PDFs: reads every page that has no text of its own, on this device. Gives a
 * searchable PDF (the same pages with an invisible text layer) and the text as TXT.
 */
import { useRef, useState } from 'react'
import { RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { describePdfError } from '@/components/tools/pdf-convert/pdf-utils'
import { readDownloadBytes } from '@/lib/ml/read/read'
import { isAbort } from '@/lib/ml/runtime/rpc'
import { stripExtension } from '@/lib/utils'
import { textBlob } from '../common/files'
import { DownloadNote } from '../common/model'
import { LanguagePick } from './LanguagePick'
import { ocrPdf } from './pdf'
import type { PdfProgress, PdfResult } from './pdf'

export type PdfReadSlug = 'ocr-pdf' | 'extract-text-from-scanned-pdf'

export default function PdfReadTool({ slug }: { slug: PdfReadSlug }) {
  const searchable = slug === 'ocr-pdf'
  const [langs, setLangs] = useState<string[]>(['eng'])
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<PdfProgress | null>(null)
  const [result, setResult] = useState<PdfResult | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function run(f: File, languages: string[]) {
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort
    setFile(f)
    setResult(null)
    setError(null)
    setProgress({ page: 1, pages: 1, part: 0 })
    try {
      const out = await ocrPdf(f, languages, searchable, setProgress, abort.signal)
      setResult(out)
      setText(out.text)
    } catch (err) {
      if (!isAbort(err)) setError(describePdfError(err, 'This PDF could not be read.'))
    } finally {
      if (abortRef.current === abort) setProgress(null)
    }
  }

  const base = file ? stripExtension(file.name) : 'document'
  const done = result !== null
  return (
    <div className="space-y-6">
      <ToolPanel>
        <LanguagePick id={slug} langs={langs} onChange={setLangs} latinOnly={searchable} />
        {searchable && <p className="text-[0.8125rem] text-muted-foreground">The searchable PDF takes languages in the Latin alphabet. For other scripts, use extract text from scanned PDF.</p>}
        {!file && <FileDropzone accept=".pdf,application/pdf" onFiles={(f) => f[0] && void run(f[0], langs)} maxSizeMb={300} title="Drop a scanned PDF" hint="Pages that already have text are kept as they are." />}
        {!file && <DownloadNote bytes={readDownloadBytes(langs)} cached={null} what="the text reader" />}
        {progress && (
          <>
            <ProgressPanel label={`Reading page ${progress.page} of ${progress.pages}`} value={((progress.page - 1 + progress.part) / progress.pages) * 100} />
            <Button variant="secondary" onClick={() => abortRef.current?.abort()}>
              <Square aria-hidden="true" /> Stop
            </Button>
          </>
        )}
      </ToolPanel>

      {done && file && (
        <ToolPanel
          title={file.name}
          description={`${result.pages} ${result.pages === 1 ? 'page' : 'pages'}${result.kept ? `, ${result.kept} already had text and ${result.kept === 1 ? 'was' : 'were'} kept` : ''}.`}
          footer={
            <>
              {result.searchable && <DownloadButton blob={result.searchable} filename={`${base}-searchable.pdf`} label="Download searchable PDF" />}
              <DownloadButton blob={textBlob(text)} filename={`${base}.txt`} label="Download TXT" variant={result.searchable ? 'secondary' : 'default'} />
              <CopyButton value={text} label="Copy text" />
              <Button variant="ghost" onClick={() => setFile(null)}>
                <RotateCcw aria-hidden="true" /> Other PDF
              </Button>
            </>
          }
        >
          <Label htmlFor={`${slug}-text`}>Text of the PDF</Label>
          <Textarea id={`${slug}-text`} value={text} onChange={(e) => setText(e.target.value)} rows={16} className="font-mono text-sm" />
        </ToolPanel>
      )}
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
    </div>
  )
}
