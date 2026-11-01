import { useCallback, useMemo, useRef, useState } from 'react'
import { Check, Eye, EyeOff, Lock, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, formatNumber, nextFrame } from '@/lib/utils'
import type { PdfPermissions } from './pdf-secure-crypto'
import { bytesToBlob, copyBytes, humanPdfError, outputName, readFileBytes } from './pdf-secure-shared'

interface PermissionRow {
  key: keyof PdfPermissions
  label: string
  hint: string
}

const PERMISSION_ROWS: PermissionRow[] = [
  { key: 'print', label: 'Printing', hint: 'Send the document to a printer or a PDF printer driver.' },
  {
    key: 'highQualityPrint',
    label: 'High-resolution printing',
    hint: 'Without this, readers may only allow a degraded 150 dpi print.',
  },
  { key: 'copy', label: 'Copying text and images', hint: 'Select-and-copy, and text extraction.' },
  { key: 'modify', label: 'Editing the content', hint: 'Changing text, images and page content.' },
  { key: 'annotate', label: 'Comments and annotations', hint: 'Sticky notes, highlights, markup.' },
  { key: 'fillForms', label: 'Filling in form fields', hint: 'Typing into an existing AcroForm.' },
  {
    key: 'assemble',
    label: 'Assembling pages',
    hint: 'Inserting, deleting, rotating pages and adding bookmarks.',
  },
  {
    key: 'accessibility',
    label: 'Screen-reader access',
    hint: 'Leave this on unless you have a specific reason not to.',
  },
]

const ALL_ON: PdfPermissions = {
  print: true,
  highQualityPrint: true,
  modify: true,
  copy: true,
  annotate: true,
  fillForms: true,
  accessibility: true,
  assemble: true,
}

interface EncryptResult {
  blob: Blob
  filename: string
  before: number
  after: number
  pages: number
  verified: boolean
  verifyNote: string
}

function strengthOf(password: string): { score: number; label: string; tone: string } {
  if (!password) return { score: 0, label: 'Empty', tone: 'bg-muted' }
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^\w\s]/.test(password)) score += 1
  const clamped = Math.min(score, 5)
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong']
  const tones = [
    'bg-destructive',
    'bg-destructive',
    'bg-warning',
    'bg-warning',
    'bg-success',
    'bg-success',
  ]
  return { score: clamped, label: labels[clamped], tone: tones[clamped] }
}

export default function PdfSecurePasswordProtect() {
  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [userPassword, setUserPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [useOwnerPassword, setUseOwnerPassword] = useState(false)
  const [ownerPassword, setOwnerPassword] = useState('')
  const [permissions, setPermissions] = useState<PdfPermissions>(ALL_ON)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('Preparing…')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EncryptResult | null>(null)
  const cancelled = useRef(false)

  const strength = useMemo(() => strengthOf(userPassword), [userPassword])
  const mismatch = confirmPassword.length > 0 && confirmPassword !== userPassword
  const restrictedCount = PERMISSION_ROWS.filter((row) => !permissions[row.key]).length

  const onFiles = useCallback(async (files: File[]) => {
    const next = files[0]
    if (!next) return
    setError(null)
    setResult(null)
    setFile(next)
    setBytes(null)
    setPageCount(0)
    try {
      const data = await readFileBytes(next)
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.load(data, { updateMetadata: false })
      setBytes(data)
      setPageCount(doc.getPageCount())
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.toLowerCase().includes('encrypt')) {
        setError(
          'This PDF already has a password on it. Remove the existing one with Unlock PDF first, then protect it again with a new password.',
        )
      } else {
        setError(humanPdfError(err, next.name))
      }
      setFile(null)
    }
  }, [])

  const togglePermission = (key: keyof PdfPermissions) => {
    setPermissions((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      // High-resolution printing is meaningless without printing at all, so
      // keep the pair consistent rather than writing a contradictory /P value.
      if (key === 'print' && !next.print) next.highQualityPrint = false
      if (key === 'highQualityPrint' && next.highQualityPrint) next.print = true
      return next
    })
    setResult(null)
  }

  const run = async () => {
    if (!bytes || !file) return
    if (!userPassword) {
      setError('Type the password people will need in order to open the document.')
      return
    }
    if (mismatch) {
      setError('The two passwords do not match. Check for a stray space or a different keyboard layout.')
      return
    }
    cancelled.current = false
    setBusy(true)
    setError(null)
    setResult(null)
    setProgress(0)
    setStage('Reading the document structure…')

    try {
      const [{ PDFDocument }, doc] = await Promise.all([
        import('pdf-lib'),
        import('./pdf-secure-doc'),
      ])
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false })
      pdf.setProducer('onthisdevice.com')
      await pdf.flush()
      await nextFrame()

      setStage('Deriving the AES-256 key…')
      setProgress(4)
      await nextFrame()

      const lib = await doc.loadPdfLib()
      const report = await doc.encryptContext(lib, pdf.context, {
        userPassword,
        ownerPassword: useOwnerPassword && ownerPassword ? ownerPassword : userPassword,
        permissions,
        onProgress: async (done, total) => {
          if (cancelled.current) throw new Error('cancelled-by-user')
          setStage(`Encrypting object ${formatNumber(done, 0)} of ${formatNumber(total, 0)}…`)
          setProgress(6 + Math.round((done / Math.max(1, total)) * 84))
          await nextFrame()
        },
      })

      setStage('Writing the encrypted file…')
      setProgress(92)
      await nextFrame()
      const saved = await doc.serializeContext(lib, pdf.context)
      const blob = bytesToBlob(saved)

      setStage('Checking the file opens with your password…')
      setProgress(97)
      await nextFrame()

      let verified = false
      let verifyNote = ''
      try {
        const { pdfjs } = await import('./pdf-secure-pdfjs')
        const task = pdfjs.getDocument({
          data: copyBytes(saved),
          password: userPassword,
        })
        const opened = await task.promise
        verified = opened.numPages === pageCount
        verifyNote = verified
          ? `Re-opened with your password and counted ${formatNumber(opened.numPages, 0)} pages.`
          : `Opened, but reported ${formatNumber(opened.numPages, 0)} pages instead of ${formatNumber(pageCount, 0)}.`
        void opened.loadingTask.destroy()
      } catch (verifyErr) {
        verifyNote = `Could not re-open the encrypted file for checking (${
          verifyErr instanceof Error ? verifyErr.message : String(verifyErr)
        }).`
      }

      if (report.opaque > 0) {
        verifyNote += ` ${report.opaque} damaged object${
          report.opaque === 1 ? '' : 's'
        } in the source could not be re-encrypted and were copied through as-is.`
      }

      setResult({
        blob,
        filename: outputName(file.name, '-protected'),
        before: file.size,
        after: blob.size,
        pages: pageCount,
        verified,
        verifyNote,
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
        onFiles={(files) => void onFiles(files)}
        title={file ? 'Choose a different PDF' : 'Drop a PDF here to encrypt it'}
        hint="or click to browse. The file and the password stay on this device."
        icon={Lock}
      />

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {file && pageCount > 0 && (
        <ToolPanel
          title="Set the password"
          description={`${file.name} · ${formatNumber(pageCount, 0)} page${
            pageCount === 1 ? '' : 's'
          } · ${formatBytes(file.size)}`}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void run()} disabled={busy || !userPassword || mismatch}>
                <Lock className="mr-2 size-4" aria-hidden="true" />
                Encrypt with AES-256
              </Button>
              {busy && (
                <Button variant="ghost" onClick={() => (cancelled.current = true)}>
                  Cancel
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-2">
            <Label htmlFor="pp-password">Password to open the document</Label>
            <div className="flex gap-2">
              <Input
                id="pp-password"
                type={showPassword ? 'text' : 'password'}
                value={userPassword}
                autoComplete="new-password"
                spellCheck={false}
                placeholder="e.g. correct-horse-battery-staple"
                onChange={(event) => {
                  setUserPassword(event.target.value)
                  setResult(null)
                }}
                aria-describedby="pp-strength"
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
            <div id="pp-strength" className="flex items-center gap-2">
              <div className="flex h-1.5 flex-1 gap-1" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`h-full flex-1 rounded-full ${
                      i < strength.score ? strength.tone : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">{strength.label}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pp-confirm">Type it again</Label>
            <Input
              id="pp-confirm"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={mismatch || undefined}
              aria-describedby={mismatch ? 'pp-confirm-error' : undefined}
            />
            {mismatch && (
              <p id="pp-confirm-error" role="alert" className="text-sm text-destructive">
                The two passwords do not match.
              </p>
            )}
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm text-foreground">
            <p className="flex items-start gap-2 text-pretty">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>
                There is no recovery. The password is not stored or sent anywhere, so if you lose it,
                you cannot open the document. Save it in a password manager before you
                download.
              </span>
            </p>
          </div>

          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? 'Hide' : 'Show'} permissions and owner password
              {restrictedCount > 0 && !showAdvanced ? ` · ${restrictedCount} restricted` : ''}
            </Button>
          </div>

          {showAdvanced && (
            <div className="space-y-4 rounded-lg bg-muted p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Label htmlFor="pp-owner-toggle" className="text-sm font-medium">
                    Separate owner password
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground text-pretty">
                    A second password that lifts the restrictions below. Leave this off and the
                    open password doubles as the owner password.
                  </p>
                </div>
                <Switch
                  id="pp-owner-toggle"
                  checked={useOwnerPassword}
                  onCheckedChange={(checked) => {
                    setUseOwnerPassword(checked)
                    setResult(null)
                  }}
                />
              </div>

              {useOwnerPassword && (
                <div className="space-y-2">
                  <Label htmlFor="pp-owner">Owner password</Label>
                  <Input
                    id="pp-owner"
                    type={showPassword ? 'text' : 'password'}
                    value={ownerPassword}
                    autoComplete="new-password"
                    spellCheck={false}
                    onChange={(event) => {
                      setOwnerPassword(event.target.value)
                      setResult(null)
                    }}
                  />
                </div>
              )}

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-foreground">
                  What readers may do without the owner password
                </legend>
                {PERMISSION_ROWS.map((row) => (
                  <div key={row.key} className="flex items-start gap-3">
                    <Checkbox
                      id={`pp-perm-${row.key}`}
                      checked={permissions[row.key]}
                      onCheckedChange={() => togglePermission(row.key)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <Label htmlFor={`pp-perm-${row.key}`} className="font-normal">
                        {row.label}
                      </Label>
                      <p className="text-xs text-muted-foreground text-pretty">{row.hint}</p>
                    </div>
                  </div>
                ))}
              </fieldset>

              <p className="text-xs text-muted-foreground text-pretty">
                Permission flags are a request that conforming readers honour. They are written
                into the encrypted, tamper-checked /Perms block, but a determined tool can ignore
                them. Only the open password actually keeps the content unreadable.
              </p>
            </div>
          )}
        </ToolPanel>
      )}

      {busy && <ProgressPanel label={stage} value={progress} sublabel="Encrypting the document." />}

      {result && (
        <ToolPanel
          title="Encrypted"
          description={result.filename}
          footer={
            <DownloadButton
              blob={result.blob}
              filename={result.filename}
              label="Download protected PDF"
            />
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Encryption" value="AES-256" hint="V5 / R6 standard handler" emphasis />
            <ResultStat label="Pages" value={formatNumber(result.pages, 0)} />
            <ResultStat
              label="Size"
              value={formatBytes(result.after)}
              hint={`was ${formatBytes(result.before)}`}
            />
          </div>
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-pretty"
          >
            {result.verified ? (
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            )}
            <span>
              <strong className="font-medium text-foreground">
                {result.verified ? 'Self-check passed.' : 'Self-check inconclusive.'}
              </strong>{' '}
              {result.verifyNote}
            </span>
          </div>
          <p className="flex items-start gap-2 text-sm text-muted-foreground text-pretty">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              The key was generated by your browser&rsquo;s own random number generator and exists
              only in this tab&rsquo;s memory. Close the tab and it is gone.
            </span>
          </p>
        </ToolPanel>
      )}
    </div>
  )
}
