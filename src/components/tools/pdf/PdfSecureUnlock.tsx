import { useCallback, useRef, useState } from 'react'
import { Check, Eye, EyeOff, LockOpen, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, formatNumber, nextFrame } from '@/lib/utils'
import type { PdfPermissions } from './pdf-secure-crypto'
import type { ParsedEncryption } from './pdf-secure-doc'
import { bytesToBlob, copyBytes, humanPdfError, outputName, readFileBytes } from './pdf-secure-shared'

type Path = 'lossless' | 'raster'

interface Probe {
  encrypted: boolean
  scheme: string
  revision: number
  permissions: PdfPermissions | null
  needsOpenPassword: boolean
}

interface UnlockResult {
  blob: Blob
  filename: string
  before: number
  after: number
  pages: number
  path: Path
  matched: 'user' | 'owner'
  note: string
}

const PERMISSION_LABELS: { key: keyof PdfPermissions; label: string }[] = [
  { key: 'print', label: 'Printing' },
  { key: 'highQualityPrint', label: 'High-resolution printing' },
  { key: 'copy', label: 'Copying text' },
  { key: 'modify', label: 'Editing' },
  { key: 'annotate', label: 'Annotating' },
  { key: 'fillForms', label: 'Filling forms' },
  { key: 'assemble', label: 'Reordering pages' },
  { key: 'accessibility', label: 'Screen readers' },
]

function schemeName(info: ParsedEncryption): string {
  if (info.revision >= 6) return 'AES-256 (revision 6)'
  if (info.revision === 5) return 'AES-256 (revision 5, Adobe extension)'
  if (info.streamMethod === 'aesv2') return 'AES-128 (revision 4)'
  if (info.revision === 4) return `RC4 ${info.keyLength * 8}-bit (revision 4)`
  if (info.revision === 3) return `RC4 ${info.keyLength * 8}-bit (revision 3)`
  return 'RC4 40-bit (revision 2)'
}

export default function PdfSecureUnlock() {
  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [probe, setProbe] = useState<Probe | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('Working…')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UnlockResult | null>(null)
  const cancelled = useRef(false)

  const inspect = useCallback(async (next: File) => {
    setError(null)
    setResult(null)
    setProbe(null)
    setPassword('')
    setFile(next)
    setBytes(null)
    try {
      const data = await readFileBytes(next)
      setBytes(data)
      const doc = await import('./pdf-secure-doc')
      const crypto = await import('./pdf-secure-crypto')
      const lib = await doc.loadPdfLib()
      const context = await lib.PDFParser.forBytesWithOptions(
        copyBytes(data),
        200,
        false,
        false,
      ).parseDocument()
      const info = doc.readEncryption(lib, context)
      if (!info) {
        setProbe({
          encrypted: false,
          scheme: 'None',
          revision: 0,
          permissions: null,
          needsOpenPassword: false,
        })
        return
      }
      const empty = await crypto.unlockKey(info, '')
      setProbe({
        encrypted: true,
        scheme: schemeName(info),
        revision: info.revision,
        permissions: crypto.pToPermissions(info.P),
        needsOpenPassword: empty === null,
      })
    } catch (err) {
      setError(humanPdfError(err, next.name))
      setFile(null)
    }
  }, [])

  const rasterRebuild = async (data: Uint8Array, pwd: string): Promise<{ out: Uint8Array; pages: number }> => {
    const { pdfjs } = await import('./pdf-secure-pdfjs')
    const { PDFDocument } = await import('pdf-lib')
    const src = await pdfjs.getDocument({
      data: copyBytes(data),
      password: pwd,
    }).promise
    const out = await PDFDocument.create()
    const total = src.numPages
    for (let n = 1; n <= total; n++) {
      if (cancelled.current) throw new Error('cancelled-by-user')
      setStage(`Rebuilding page ${n} of ${total} as an image…`)
      setProgress(20 + Math.round((n / total) * 70))
      const page = await src.getPage(n)
      const points = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: 150 / 72 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) throw new Error('This browser would not give us a 2D canvas to draw on.')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, viewport }).promise
      page.cleanup()
      const jpeg = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.86),
      )
      if (!jpeg) throw new Error('The browser could not encode this page as a JPEG.')
      const embedded = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()))
      const newPage = out.addPage([points.width, points.height])
      newPage.drawImage(embedded, { x: 0, y: 0, width: points.width, height: points.height })
      canvas.width = 0
      canvas.height = 0
      await nextFrame()
    }
    void src.loadingTask.destroy()
    out.setProducer('onthisdevice.com')
    return { out: await out.save({ useObjectStreams: true }), pages: total }
  }

  const run = async () => {
    if (!bytes || !file || !probe) return
    cancelled.current = false
    setBusy(true)
    setError(null)
    setResult(null)
    setProgress(0)
    setStage('Checking the password…')

    try {
      const doc = await import('./pdf-secure-doc')
      const crypto = await import('./pdf-secure-crypto')
      const lib = await doc.loadPdfLib()

      const context = await lib.PDFParser.forBytesWithOptions(
        copyBytes(bytes),
        200,
        false,
        false,
      ).parseDocument()
      const info = doc.readEncryption(lib, context)
      if (!info) throw new Error('This PDF is not encrypted, so there is nothing to remove.')

      const unlocked = await crypto.unlockKey(info, password)
      if (!unlocked) {
        setError(
          probe.needsOpenPassword
            ? 'That password did not open the document. Passwords are case-sensitive; check for a trailing space or a different keyboard layout. This tool cannot find an unknown password.'
            : 'The password you supplied did not match. Leave the field empty if the file opens without one.',
        )
        setBusy(false)
        return
      }

      setStage('Decrypting objects…')
      setProgress(8)
      await nextFrame()

      let losslessBytes: Uint8Array | null = null
      let note = ''
      let pages = 0

      try {
        const report = await doc.decryptContext(
          lib,
          context,
          info,
          unlocked.key,
          async (done, total) => {
            if (cancelled.current) throw new Error('cancelled-by-user')
            setStage(`Decrypting object ${formatNumber(done, 0)} of ${formatNumber(total, 0)}…`)
            setProgress(8 + Math.round((done / Math.max(1, total)) * 74))
            await nextFrame()
          },
        )
        setStage('Writing the unlocked file…')
        setProgress(86)
        await nextFrame()
        const candidate = await doc.serializeContext(lib, context)

        setStage('Verifying the result opens without a password…')
        setProgress(92)
        await nextFrame()
        const { pdfjs } = await import('./pdf-secure-pdfjs')
        const check = await pdfjs.getDocument({
          data: copyBytes(candidate),
        }).promise
        pages = check.numPages
        // Touching the first page forces the content stream to actually parse.
        const first = await check.getPage(1)
        await first.getTextContent()
        first.cleanup()
        void check.loadingTask.destroy()
        if (pages > 0) {
          losslessBytes = candidate
          note = `Text, links and bookmarks are intact: ${formatNumber(
            report.streams,
            0,
          )} streams decrypted in place${
            report.recoveredObjectStreams > 0
              ? `, including ${formatNumber(report.recoveredObjectStreams, 0)} compressed object streams`
              : ''
          }.`
        }
      } catch {
        losslessBytes = null
      }

      if (cancelled.current) throw new Error('cancelled-by-user')

      let outBytes: Uint8Array
      let path: Path
      if (losslessBytes) {
        outBytes = losslessBytes
        path = 'lossless'
      } else {
        setStage('Falling back to a page-by-page rebuild…')
        setProgress(18)
        await nextFrame()
        const rebuilt = await rasterRebuild(bytes, password)
        outBytes = rebuilt.out
        pages = rebuilt.pages
        path = 'raster'
        note =
          'This document resisted a structural rewrite, so each page was re-rendered as an image. The result opens anywhere, but the text is no longer selectable or searchable.'
      }

      const blob = bytesToBlob(outBytes)
      setResult({
        blob,
        filename: outputName(file.name, '-unlocked'),
        before: file.size,
        after: blob.size,
        pages,
        path,
        matched: unlocked.matched,
        note,
      })
      setProgress(100)
    } catch (err) {
      if (err instanceof Error && err.message === 'cancelled-by-user') {
        setError('Cancelled. Your original file is untouched.')
      } else {
        setError(humanPdfError(err, file.name))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept=".pdf,application/pdf"
        maxSizeMb={800}
        onFiles={(files) => {
          const next = files[0]
          if (next) void inspect(next)
        }}
        title={file ? 'Choose a different PDF' : 'Drop a locked PDF here'}
        hint="or click to browse. The password you type stays in this tab."
        icon={LockOpen}
      />

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {file && probe && !probe.encrypted && (
        <ToolPanel title="No password on this file" description={file.name}>
          <p className="text-sm text-muted-foreground text-pretty">
            This PDF has no /Encrypt dictionary, so there is nothing to remove. It already
            opens, prints and copies in any reader. If a reader is still refusing to let you edit it, the
            restriction comes from that application. The file has none.
          </p>
        </ToolPanel>
      )}

      {file && probe?.encrypted && (
        <ToolPanel
          title="Encryption found"
          description={`${file.name} · ${formatBytes(file.size)}`}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void run()} disabled={busy}>
                <LockOpen className="mr-2 size-4" aria-hidden="true" />
                Remove protection
              </Button>
              {busy && (
                <Button variant="ghost" onClick={() => (cancelled.current = true)}>
                  Cancel
                </Button>
              )}
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultStat label="Scheme" value={probe.scheme} />
            <ResultStat
              label="Opens without a password?"
              value={probe.needsOpenPassword ? 'No' : 'Yes'}
              hint={
                probe.needsOpenPassword
                  ? 'A user password is required to read it.'
                  : 'Only permission restrictions are set.'
              }
            />
          </div>

          {probe.permissions && (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Current restrictions</p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {PERMISSION_LABELS.map((row) => {
                  const allowed = probe.permissions?.[row.key] ?? true
                  return (
                    <li key={row.key} className="flex items-center gap-2 text-sm">
                      {allowed ? (
                        <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                      ) : (
                        <X className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                      )}
                      <span className={allowed ? 'text-muted-foreground' : 'text-foreground'}>
                        {row.label}
                        <span className="sr-only">{allowed ? ' allowed' : ' blocked'}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ul-password">
              {probe.needsOpenPassword ? 'Password to open the document' : 'Password (optional)'}
            </Label>
            <div className="flex gap-2">
              <Input
                id="ul-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                autoComplete="off"
                spellCheck={false}
                placeholder={probe.needsOpenPassword ? 'Required' : 'Not needed for this file'}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setResult(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !busy) void run()
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={showPassword ? 'Hide the password' : 'Show the password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground text-pretty">
              {probe.needsOpenPassword
                ? 'You need the password. This tool decrypts the file with a password you know. It has no brute-force mode.'
                : 'This file only carries permission flags, so no password is needed. An owner password will also be accepted if you have it.'}
            </p>
          </div>
        </ToolPanel>
      )}

      {busy && <ProgressPanel label={stage} value={progress} sublabel="Decrypting on your device." />}

      {result && (
        <ToolPanel
          title="Protection removed"
          description={result.filename}
          footer={
            <DownloadButton
              blob={result.blob}
              filename={result.filename}
              label="Download unlocked PDF"
            />
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat
              label="Method"
              value={result.path === 'lossless' ? 'Lossless' : 'Rebuilt as images'}
              emphasis
            />
            <ResultStat label="Pages" value={formatNumber(result.pages, 0)} />
            <ResultStat
              label="Size"
              value={formatBytes(result.after)}
              hint={`was ${formatBytes(result.before)}`}
            />
          </div>
          <p className="text-sm text-muted-foreground text-pretty">{result.note}</p>
          <p className="flex items-start gap-2 text-sm text-muted-foreground text-pretty">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Matched the <strong className="text-foreground">{result.matched}</strong> password.
              Removing a password you were given is your decision. This tool assumes you own
              the document or have permission to open it.
            </span>
          </p>
        </ToolPanel>
      )}
    </div>
  )
}
