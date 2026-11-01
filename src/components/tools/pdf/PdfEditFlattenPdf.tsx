import { useCallback, useId, useState } from 'react'
import { CheckCircle2, FileCheck2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes } from '@/lib/utils'
import {
  humanPdfError,
  loadPdfLib,
  outputName,
  pdfBlob,
  plural,
  readPdfBytes,
} from './pdf-edit-core'
import { flattenAnnotations, scanAnnotations } from './pdf-edit-flatten'
import type { AnnotationScan } from './pdf-edit-flatten'

interface Analysis {
  pages: number
  fields: number
  readOnlyFields: number
  annotations: AnnotationScan
  hasXfa: boolean
}

interface Outcome {
  fields: number
  drawn: number
  removed: number
  skipped: number
  size: number
}

export function PdfEditFlattenPdf() {
  const ids = useId()
  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Blob | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const [doFields, setDoFields] = useState(true)
  const [doAnnotations, setDoAnnotations] = useState(true)
  const [keepLinks, setKeepLinks] = useState(true)

  const onFiles = useCallback(async (files: File[]) => {
    const next = files[0]
    if (!next) return
    setError(null)
    setResult(null)
    setOutcome(null)
    setAnalysis(null)
    setLoading(true)
    setFile(next)
    try {
      const raw = await readPdfBytes(next)
      const lib = await loadPdfLib()
      const doc = await lib.PDFDocument.load(raw, { ignoreEncryption: true, updateMetadata: false })
      let fields = 0
      let readOnlyFields = 0
      try {
        for (const field of doc.getForm().getFields()) {
          fields += 1
          if (field.isReadOnly()) readOnlyFields += 1
        }
      } catch {
        fields = 0
      }
      let hasXfa = false
      try {
        const acro = doc.catalog.lookup(lib.PDFName.of('AcroForm'), lib.PDFDict)
        hasXfa = acro.get(lib.PDFName.of('XFA')) !== undefined
      } catch {
        hasXfa = false
      }
      setBytes(raw)
      setAnalysis({
        pages: doc.getPageCount(),
        fields,
        readOnlyFields,
        annotations: scanAnnotations(lib, doc),
        hasXfa,
      })
    } catch (err) {
      setFile(null)
      setBytes(null)
      setError(humanPdfError(err, next.name))
    } finally {
      setLoading(false)
    }
  }, [])

  const run = async () => {
    if (!bytes || !file) return
    setBusy(true)
    setError(null)
    setResult(null)
    setOutcome(null)
    try {
      const lib = await loadPdfLib()
      const doc = await lib.PDFDocument.load(bytes, {
        ignoreEncryption: true,
        updateMetadata: false,
      })

      let flattenedFields = 0
      if (doFields) {
        try {
          const form = doc.getForm()
          flattenedFields = form.getFields().length
          if (flattenedFields > 0) {
            try {
              form.updateFieldAppearances(await doc.embedFont('Helvetica'))
            } catch {
              // Fields whose default appearance names a font we cannot embed
              // keep whatever appearance the producer already wrote.
            }
            form.flatten()
          }
        } catch (err) {
          throw new Error(
            `The form fields could not be flattened. ${
              err instanceof Error ? err.message : String(err)
            } Try turning “Flatten form fields” off and flattening the comments only.`,
          )
        }
      }

      const annotResult = doAnnotations
        ? flattenAnnotations(lib, doc, { keepLinks })
        : { drawn: 0, removed: 0, skipped: 0 }

      const out = await doc.save({ useObjectStreams: false })
      const blob = pdfBlob(out)
      setResult(blob)
      setOutcome({
        fields: flattenedFields,
        drawn: annotResult.drawn,
        removed: annotResult.removed,
        skipped: annotResult.skipped,
        size: blob.size,
      })
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }

  if (!file || !analysis) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={(files) => void onFiles(files)}
          maxSizeMb={800}
          title="Drop the PDF you want to flatten"
          hint="or click to browse"
          disabled={loading}
        />
        {loading ? <ProgressPanel label="Inspecting fields and annotations…" /> : null}
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}
        <p className="text-sm text-muted-foreground">
          Flattening turns everything that sits on top of a page (form answers, highlights,
          stamps, signatures, sticky notes) into part of the page itself, so it prints, emails and
          renders the same everywhere.
        </p>
      </div>
    )
  }

  const subtypes = Object.entries(analysis.annotations.bySubtype).sort((a, b) => b[1] - a[1])
  const nothingToDo = analysis.fields === 0 && analysis.annotations.total === 0

  return (
    <div className="space-y-4">
      <ToolPanel
        title="What is in this file"
        description={`${file.name} · ${formatBytes(file.size)} · ${plural(analysis.pages, 'page')}`}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <ResultStat label="Form fields" value={analysis.fields} hint={
            analysis.readOnlyFields > 0 ? `${analysis.readOnlyFields} already read-only` : 'Editable widgets'
          } />
          <ResultStat
            label="Annotations"
            value={analysis.annotations.total}
            hint={`${analysis.annotations.drawable} with a drawable appearance`}
          />
          <ResultStat
            label="Links"
            value={analysis.annotations.links}
            hint="Clickable areas, optional to keep"
          />
        </div>

        {subtypes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <caption className="pb-2 text-left text-xs text-muted-foreground">
                Annotation types found, by PDF subtype name
              </caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 font-medium">Subtype</th>
                  <th scope="col" className="py-2 text-right font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {subtypes.map(([name, count]) => (
                  <tr key={name} className="border-b border-border last:border-0">
                    <td className="py-1.5">{name}</td>
                    <td className="py-1.5 text-right tabular-nums">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {nothingToDo ? (
          <Alert role="status">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            <AlertTitle>This PDF is already flat</AlertTitle>
            <AlertDescription>
              There are no form fields and no annotations, so every mark on every page is already
              part of the page content. Flattening it again would change nothing.
            </AlertDescription>
          </Alert>
        ) : null}

        {analysis.hasXfa ? (
          <Alert role="note">
            <FileCheck2 className="size-4" aria-hidden="true" />
            <AlertTitle>XFA form detected</AlertTitle>
            <AlertDescription>
              This file carries an Adobe XFA payload. We flatten the AcroForm layer underneath it,
              which is what non-Acrobat readers display, but the XFA layout itself cannot be
              rendered outside Acrobat. Check the result before relying on it.
            </AlertDescription>
          </Alert>
        ) : null}
      </ToolPanel>

      <ToolPanel title="What to flatten" description="Sensible defaults are already set.">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
            <Label htmlFor={`${ids}-fields`} className="font-normal">
              Flatten form fields
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Answers become page content. Nobody can retype them, and readers that ignore field
                appearances stop showing empty boxes.
              </span>
            </Label>
            <Switch id={`${ids}-fields`} checked={doFields} onCheckedChange={setDoFields} />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
            <Label htmlFor={`${ids}-annots`} className="font-normal">
              Flatten comments and markup
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Highlights, ink, stamps, free text and sticky notes are drawn into the page using
                their own appearance streams, then removed as annotations.
              </span>
            </Label>
            <Switch id={`${ids}-annots`} checked={doAnnotations} onCheckedChange={setDoAnnotations} />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
            <Label htmlFor={`${ids}-links`} className="font-normal">
              Keep clickable links
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Link annotations draw nothing, so keeping them costs nothing visually and preserves
                a working table of contents.
              </span>
            </Label>
            <Switch
              id={`${ids}-links`}
              checked={keepLinks}
              disabled={!doAnnotations}
              onCheckedChange={setKeepLinks}
            />
          </div>
        </div>

        {busy ? <ProgressPanel label="Flattening…" /> : null}
        {error ? <ErrorNote message={error} onRetry={() => setError(null)} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => void run()}
            disabled={busy || (!doFields && !doAnnotations)}
          >
            {busy ? 'Flattening…' : 'Flatten PDF'}
          </Button>
          <DownloadButton
            blob={result}
            filename={outputName(file.name, '-flat')}
            label="Download flattened PDF"
            variant={result ? 'default' : 'outline'}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setFile(null)
              setBytes(null)
              setAnalysis(null)
              setResult(null)
              setOutcome(null)
            }}
          >
            Use a different PDF
          </Button>
        </div>

        {outcome ? (
          <div className="space-y-2 rounded-lg bg-muted p-3" role="status" aria-live="polite">
            <p className="text-sm font-medium text-foreground">Flattening finished</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>{plural(outcome.fields, 'form field')} merged into the page content.</li>
              <li>
                {plural(outcome.drawn, 'annotation')} drawn into the page and{' '}
                {plural(outcome.removed, 'annotation object')} removed.
              </li>
              {outcome.skipped > 0 ? (
                <li>
                  {plural(outcome.skipped, 'annotation')} had no stored appearance, so it was left
                  in place. Removing it would have deleted something visible.
                </li>
              ) : null}
              <li>
                Output is {formatBytes(outcome.size)}, from {formatBytes(file.size)}.
              </li>
            </ul>
          </div>
        ) : null}
      </ToolPanel>
    </div>
  )
}

export default PdfEditFlattenPdf
