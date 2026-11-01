import { useMemo, useState } from 'react'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { humanPdfError, readPdfBytes } from '@/components/tools/pdf/pdf-edit-core'
import { KIND_TEXT, checkPdf, problemCount, reportText } from './pdf-check'
import type { CheckReport, Finding } from './pdf-check'
import { formatBytes, stripExtension } from '@/lib/utils'

function Section({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="space-y-1">
      <h3 className="flex items-center gap-2 text-sm font-[600] text-foreground">
        {items.length ? <TriangleAlert className="size-4 shrink-0" aria-hidden="true" /> : <CircleCheck className="size-4 shrink-0" aria-hidden="true" />}
        {title}
        <span className="num font-normal text-muted-foreground">{items.length || ''}</span>
      </h3>
      {items.length ? (
        <ul className="space-y-0.5 pl-6 text-sm break-words text-foreground">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="pl-6 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}

export function PdfRedactionChecker() {
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<CheckReport | null>(null)
  const [progress, setProgress] = useState<{ label: string; value: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (f: File) => {
    setFile(f)
    setReport(null)
    setError(null)
    setProgress({ label: 'Opening the file', value: 0 })
    try {
      const bytes = await readPdfBytes(f)
      const r = await checkPdf(bytes, (done, total, label) => setProgress({ label, value: (done / Math.max(1, total)) * 100 }))
      setReport(r)
    } catch (err) {
      setError(humanPdfError(err, f.name))
    } finally {
      setProgress(null)
    }
  }

  const byPage = useMemo(() => {
    const m = new Map<number, Finding[]>()
    for (const f of report?.findings ?? []) m.set(f.page, [...(m.get(f.page) ?? []), f])
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [report])

  const blob = useMemo(() => (report && file ? new Blob([reportText(file.name, report)], { type: 'text/plain;charset=utf-8' }) : null), [report, file])

  if (!file || (!report && !progress)) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={(files) => files[0] && void run(files[0])}
          maxSizeMb={500}
          title="Drop a redacted PDF to check"
          hint="The file is read in this tab and never sent anywhere"
        />
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}
      </div>
    )
  }

  if (!report) return <ProgressPanel label={progress?.label ?? 'Checking'} value={progress?.value} />

  const problems = problemCount(report)
  const leaks = report.findings.length

  return (
    <div className="space-y-4">
      <ToolPanel
        title={file.name}
        description={`${formatBytes(file.size)}, ${report.pages} ${report.pages === 1 ? 'page' : 'pages'}, ${report.revisions} ${report.revisions === 1 ? 'version' : 'versions'} in the file`}
        footer={
          <>
            <DownloadButton blob={blob} filename={`${stripExtension(file.name)}-redaction-check.txt`} label="Download report" />
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setFile(null)
                setReport(null)
              }}
            >
              Check another file
            </Button>
          </>
        }
      >
        <p className="flex items-start gap-2 text-[0.9375rem] font-[600] text-pretty text-foreground" role="status">
          {problems === 0 ? <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> : <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
          {problems === 0
            ? 'No hidden text, earlier versions, metadata or attachments found.'
            : leaks > 0
              ? `${leaks} ${leaks === 1 ? 'piece' : 'pieces'} of text can be read out of this file although ${leaks === 1 ? 'it is' : 'they are'} covered, hidden or removed.`
              : 'No covered text, but the file holds other data. See below.'}
        </p>
      </ToolPanel>

      {byPage.length > 0 ? (
        <ToolPanel title="Text that can be read out" description="Anyone can copy this text or extract it with a PDF tool.">
          <div className="space-y-4">
            {byPage.map(([page, list]) => (
              <section key={page} className="space-y-1.5">
                <h3 className="text-sm font-[600] text-foreground">{page === 0 ? 'Whole document' : `Page ${page}`}</h3>
                <ul className="space-y-1.5">
                  {list.map((f, i) => (
                    <li key={i} className="rounded-lg bg-background px-3 py-2 text-sm">
                      <span className="block text-muted-foreground">
                        {KIND_TEXT[f.kind]}
                        {f.detail ? `, ${f.detail}` : ''}
                      </span>
                      <span className="block font-mono text-[0.8125rem] break-words text-foreground">{f.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </ToolPanel>
      ) : null}

      <ToolPanel title="Data in the file">
        <Section title="Document properties" items={report.properties.map((p) => `${p.label}: ${p.value}`)} empty="None." />
        <Section title="XMP metadata" items={report.xmp.map((p) => `${p.label}: ${p.value}`)} empty="None." />
        <Section title="Attachments" items={report.attachments.map((a) => `${a.name}, ${formatBytes(a.size)}${a.preview ? `: ${a.preview}` : ''}`)} empty="None." />
        <Section title="Bookmarks" items={report.bookmarks} empty="None." />
        <Section title="Hidden layers" items={report.hiddenLayers} empty="None." />
        <Section title="Scripts" items={report.scripts ? [`${report.scripts} script ${report.scripts === 1 ? 'action' : 'actions'}`] : []} empty="None." />
        {problems > 0 ? (
          <p className="text-sm text-pretty text-muted-foreground">
            To fix the file, open the original in <a className="font-[600] text-foreground underline underline-offset-4" href="/redact-pdf">Redact PDF</a>. It burns the boxes in and removes all of the above.
          </p>
        ) : null}
      </ToolPanel>
    </div>
  )
}

export default PdfRedactionChecker
