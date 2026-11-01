import { useCallback, useState } from 'react'
import { Eraser, FileCog, Save, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes } from '@/lib/utils'
import { humanPdfError, loadPdfLib, outputName, pdfBlob, readFileBytes } from './pdf-pages-core'
import { ProofPanel } from './pdf-pages-ui'

interface Fields {
  title: string
  author: string
  subject: string
  keywords: string
  creator: string
  producer: string
  created: string
  modified: string
}

const EMPTY: Fields = {
  title: '',
  author: '',
  subject: '',
  keywords: '',
  creator: '',
  producer: '',
  created: '',
  modified: '',
}

interface DocInfo {
  pages: number
  version: string
  encrypted: boolean
  hasXmp: boolean
  size: number
}

/** Date -> value for <input type="datetime-local"> in the viewer's own zone. */
function toLocalInput(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export default function PdfMetadataEditor() {
  const [file, setFile] = useState<File | null>(null)
  const [original, setOriginal] = useState<Fields>(EMPTY)
  const [fields, setFields] = useState<Fields>(EMPTY)
  const [info, setInfo] = useState<DocInfo | null>(null)
  const [stripXmp, setStripXmp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }))
    setResult(null)
  }

  const onFiles = useCallback(async (files: File[]) => {
    const next = files[0]
    if (!next) return
    setError(null)
    setResult(null)
    try {
      const bytes = await readFileBytes(next)
      const lib = await loadPdfLib()
      const doc = await lib.PDFDocument.load(bytes, {
        ignoreEncryption: true,
        updateMetadata: false,
      })

      const read: Fields = {
        title: doc.getTitle() ?? '',
        author: doc.getAuthor() ?? '',
        subject: doc.getSubject() ?? '',
        keywords: doc.getKeywords() ?? '',
        creator: doc.getCreator() ?? '',
        producer: doc.getProducer() ?? '',
        created: toLocalInput(doc.getCreationDate()),
        modified: toLocalInput(doc.getModificationDate()),
      }

      const header = new TextDecoder().decode(bytes.subarray(0, 16))
      const version = /%PDF-(\d\.\d)/.exec(header)?.[1] ?? 'unknown'

      setFile(next)
      setOriginal(read)
      setFields(read)
      setStripXmp(false)
      setInfo({
        pages: doc.getPageCount(),
        version,
        encrypted: doc.isEncrypted,
        hasXmp: doc.catalog.has(lib.PDFName.of('Metadata')),
        size: next.size,
      })
    } catch (err) {
      setError(humanPdfError(err, next.name))
    }
  }, [])

  const stripAll = useCallback(() => {
    setFields({ ...EMPTY })
    setStripXmp(true)
    setResult(null)
  }, [])

  const save = useCallback(async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const bytes = await readFileBytes(file)
      const lib = await loadPdfLib()
      const doc = await lib.PDFDocument.load(bytes, { updateMetadata: false })

      doc.setTitle(fields.title)
      doc.setAuthor(fields.author)
      doc.setSubject(fields.subject)
      doc.setCreator(fields.creator)
      doc.setProducer(fields.producer)
      doc.setKeywords(
        fields.keywords
          .split(/[,\n]/)
          .map((k) => k.trim())
          .filter(Boolean),
      )

      const created = fromLocalInput(fields.created)
      const modified = fromLocalInput(fields.modified)
      if (created) doc.setCreationDate(created)
      if (modified) doc.setModificationDate(modified)

      /*
       * pdf-lib only ever writes entries, so a field the user cleared has to be
       * deleted from the information dictionary by hand — otherwise the old
       * author name would silently survive in the saved file.
       */
      const info = doc.context.lookupMaybe(doc.context.trailerInfo.Info, lib.PDFDict)
      if (info) {
        const drop = (key: string, value: string) => {
          if (!value.trim()) info.delete(lib.PDFName.of(key))
        }
        drop('Title', fields.title)
        drop('Author', fields.author)
        drop('Subject', fields.subject)
        drop('Keywords', fields.keywords)
        drop('Creator', fields.creator)
        drop('Producer', fields.producer)
        if (!created) info.delete(lib.PDFName.of('CreationDate'))
        if (!modified) info.delete(lib.PDFName.of('ModDate'))
      }

      if (stripXmp) doc.catalog.delete(lib.PDFName.of('Metadata'))

      const out = await doc.save({ useObjectStreams: false })
      setResult({ blob: pdfBlob(out), name: outputName(file.name, '-metadata') })
    } catch (err) {
      setError(humanPdfError(err, file.name))
    } finally {
      setBusy(false)
    }
  }, [fields, file, stripXmp])

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".pdf,application/pdf"
          onFiles={(files) => void onFiles(files)}
          title="Drop a PDF to read and edit its metadata"
          hint="or click to browse"
        />
        <ProofPanel what="Your document and its hidden properties" />
      </div>
    )
  }

  const changed = (key: keyof Fields) => original[key] !== fields[key]

  return (
    <div className="space-y-5">
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {info && (
        <ToolPanel title="Document" description="Read-only facts about the file you opened.">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>PDF version</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>XMP block</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="max-w-48 truncate" title={file.name}>
                    {file.name}
                  </TableCell>
                  <TableCell className="tabular-nums">{info.pages}</TableCell>
                  <TableCell className="tabular-nums">{info.version}</TableCell>
                  <TableCell className="tabular-nums">{formatBytes(info.size)}</TableCell>
                  <TableCell>
                    {info.hasXmp ? 'Present' : <span className="text-muted-foreground">None</span>}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {info.encrypted && (
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-foreground text-pretty">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                This PDF carries encryption or permission flags. The metadata was read anyway, but the
                saved copy will not keep the original protection.
              </span>
            </p>
          )}
        </ToolPanel>
      )}

      <ToolPanel
        title="Document properties"
        description="These are the fields a reader shows under File → Properties, and the ones search indexes and DLP scanners pick up."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="md-title">
              Title {changed('title') && <span className="text-primary">·  edited</span>}
            </Label>
            <Input
              id="md-title"
              value={fields.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="(empty)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="md-author">
              Author {changed('author') && <span className="text-primary">· edited</span>}
            </Label>
            <Input
              id="md-author"
              value={fields.author}
              onChange={(e) => set('author', e.target.value)}
              placeholder="(empty)"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="md-subject">Subject</Label>
            <Input
              id="md-subject"
              value={fields.subject}
              onChange={(e) => set('subject', e.target.value)}
              placeholder="(empty)"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="md-keywords">Keywords</Label>
            <Textarea
              id="md-keywords"
              value={fields.keywords}
              rows={2}
              onChange={(e) => set('keywords', e.target.value)}
              placeholder="comma, separated, keywords"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="md-creator">Creator (the authoring app)</Label>
            <Input
              id="md-creator"
              value={fields.creator}
              onChange={(e) => set('creator', e.target.value)}
              placeholder="(empty)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="md-producer">Producer (the PDF writer)</Label>
            <Input
              id="md-producer"
              value={fields.producer}
              onChange={(e) => set('producer', e.target.value)}
              placeholder="(empty)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="md-created">Created</Label>
            <Input
              id="md-created"
              type="datetime-local"
              value={fields.created}
              onChange={(e) => set('created', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="md-modified">Modified</Label>
            <Input
              id="md-modified"
              type="datetime-local"
              value={fields.modified}
              onChange={(e) => set('modified', e.target.value)}
            />
          </div>
        </div>

        {stripXmp && (
          <p className="rounded-lg bg-muted p-3 text-sm text-foreground text-pretty">
            Strip mode is on: every field above will be written empty, both dates will be zeroed,
            and the XMP packet will be removed from the document catalogue.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" className="gap-2" onClick={() => void save()} disabled={busy}>
            <Save className="size-4" aria-hidden="true" />
            {busy ? 'Saving…' : 'Save metadata'}
          </Button>
          <Button type="button" variant="secondary" className="gap-2" onClick={stripAll}>
            <Eraser className="size-4" aria-hidden="true" />
            Strip everything
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFields(original)
              setStripXmp(false)
              setResult(null)
            }}
          >
            Revert
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFile(null)
              setResult(null)
              setInfo(null)
            }}
          >
            Use a different file
          </Button>
        </div>
      </ToolPanel>

      {result && (
        <ToolPanel title="Saved">
          <p className="text-sm text-muted-foreground text-pretty">
            Pages, fonts and images are untouched. Only the information dictionary
            {stripXmp ? ' and the XMP packet were' : ' was'} rewritten.
          </p>
          <div className="flex items-center gap-2">
            <FileCog className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm tabular-nums text-muted-foreground">
              {formatBytes(result.blob.size)}
            </span>
          </div>
          <DownloadButton blob={result.blob} filename={result.name} label="Download PDF" />
        </ToolPanel>
      )}

      <ProofPanel what="Your document and its hidden properties" />
    </div>
  )
}
