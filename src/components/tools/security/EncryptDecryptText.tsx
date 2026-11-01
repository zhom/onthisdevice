import { useCallback, useMemo, useState } from 'react'
import { CircleX, Download, Eye, EyeOff, Lock, TriangleAlert, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { PrivacyNotice } from './SecurityUi'
import {
  bytesToHex,
  decryptText,
  encryptText,
  ENVELOPE_HEADER_BYTES,
  IV_BYTES,
  parseEnvelope,
  PBKDF2_ITERATIONS,
  SALT_BYTES,
  wrapBase64,
} from './seclib'
import { analyzePassword } from './strength'
import { downloadBlob, formatBytes, formatNumber, nextFrame } from '@/lib/utils'

type Mode = 'encrypt' | 'decrypt'

const ENVELOPE_LAYOUT = [
  { offset: '0', size: '4 bytes', field: 'Magic', detail: 'The ASCII letters OTD1, so a wrong paste is caught before any key derivation happens.' },
  { offset: '4', size: '4 bytes', field: 'Iterations', detail: 'PBKDF2 iteration count, big-endian. Stored so the count can be raised later without breaking old messages.' },
  { offset: '8', size: `${SALT_BYTES} bytes`, field: 'Salt', detail: 'Random per message. Makes precomputed rainbow tables useless and gives two identical messages different keys.' },
  { offset: String(8 + SALT_BYTES), size: `${IV_BYTES} bytes`, field: 'Nonce (IV)', detail: 'Random per message, 96 bits (the size AES-GCM is specified for). Never reused, because reuse breaks GCM.' },
  { offset: String(ENVELOPE_HEADER_BYTES), size: 'rest', field: 'Ciphertext + tag', detail: 'AES-256-GCM output with its 16-byte authentication tag appended, exactly as WebCrypto returns it.' },
]

function PasswordInput({
  id,
  label,
  value,
  onChange,
  hint,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  autoComplete: string
}) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 font-mono"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          onClick={() => setRevealed((previous) => !previous)}
        >
          {revealed ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>
      {hint ? <p className="text-xs text-pretty text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export default function EncryptDecryptText() {
  const [mode, setMode] = useState<Mode>('encrypt')

  const [plaintext, setPlaintext] = useState('')
  const [encryptPassword, setEncryptPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [envelope, setEnvelope] = useState('')

  const [cipherInput, setCipherInput] = useState('')
  const [decryptPassword, setDecryptPassword] = useState('')
  const [decrypted, setDecrypted] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordStrength = useMemo(
    () => (encryptPassword ? analyzePassword(encryptPassword) : null),
    [encryptPassword],
  )

  const inspected = useMemo(() => {
    const trimmed = cipherInput.trim()
    if (trimmed.length === 0) return null
    try {
      const header = parseEnvelope(trimmed)
      return {
        ok: true as const,
        iterations: header.iterations,
        salt: bytesToHex(header.salt),
        iv: bytesToHex(header.iv),
        ciphertextBytes: header.ciphertext.length,
      }
    } catch (cause) {
      return { ok: false as const, message: cause instanceof Error ? cause.message : String(cause) }
    }
  }, [cipherInput])

  const runEncrypt = useCallback(async () => {
    setError(null)
    setEnvelope('')
    if (plaintext.length === 0) {
      setError('There is nothing to encrypt. Type or paste some text first.')
      return
    }
    if (encryptPassword.length === 0) {
      setError('Choose a password. Without one there is no key, and no encryption.')
      return
    }
    if (encryptPassword !== confirmPassword) {
      setError('The two passwords do not match. Since a mistyped password is unrecoverable, both must agree.')
      return
    }
    setBusy(true)
    // Let the progress panel paint before the ~200 000-iteration derivation starts.
    await nextFrame()
    try {
      const result = await encryptText(plaintext, encryptPassword, PBKDF2_ITERATIONS)
      setEnvelope(wrapBase64(result, 72))
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Encryption failed unexpectedly. Try a shorter message.',
      )
    } finally {
      setBusy(false)
    }
  }, [confirmPassword, encryptPassword, plaintext])

  const runDecrypt = useCallback(async () => {
    setError(null)
    setDecrypted('')
    if (cipherInput.trim().length === 0) {
      setError('Paste the encrypted message first.')
      return
    }
    if (decryptPassword.length === 0) {
      setError('Enter the password the message was encrypted with.')
      return
    }
    setBusy(true)
    await nextFrame()
    try {
      setDecrypted(await decryptText(cipherInput.trim(), decryptPassword))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Decryption failed.')
    } finally {
      setBusy(false)
    }
  }, [cipherInput, decryptPassword])

  return (
    <div className="flex flex-col gap-6">
      <PrivacyNotice>
        The encryption happens in this tab. Your text and password go only to the built-in{' '}
        <code className="font-mono text-[0.85em]">crypto.subtle</code> of your browser. To confirm
        that nothing is sent, watch the network panel while you press Encrypt.
      </PrivacyNotice>

      <div className="flex items-start gap-3 rounded-xl bg-muted px-4 py-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-pretty text-foreground">
          If you lose the password, the text is gone. There is no reset link, no recovery key and
          no back door. Write the password down somewhere safe, or store it in a password manager,
          before you close this page.
        </p>
      </div>

      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
          <TabsTrigger value="encrypt" className="gap-1.5">
            <Lock className="size-4" aria-hidden="true" />
            Encrypt
          </TabsTrigger>
          <TabsTrigger value="decrypt" className="gap-1.5">
            <Unlock className="size-4" aria-hidden="true" />
            Decrypt
          </TabsTrigger>
        </TabsList>

        <TabsContent value="encrypt" className="mt-4 flex flex-col gap-6">
          <ToolPanel
            title="Text to encrypt"
            footer={
              <Button type="button" onClick={() => void runEncrypt()} disabled={busy} className="gap-2">
                <Lock className="size-4" aria-hidden="true" />
                {busy ? 'Encrypting…' : 'Encrypt'}
              </Button>
            }
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plaintext">Message</Label>
              <Textarea
                id="plaintext"
                value={plaintext}
                onChange={(event) => setPlaintext(event.target.value)}
                rows={7}
                placeholder="Anything you do not want to send in the clear: recovery codes, a private note, credentials for a colleague."
                spellCheck={false}
                className="font-mono text-[13px]"
              />
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatNumber(plaintext.length, 0)} characters
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordInput
                id="encrypt-password"
                label="Password"
                value={encryptPassword}
                onChange={setEncryptPassword}
                autoComplete="new-password"
                hint="A passphrase of several random words is stronger than a short mangled word. The key is only as strong as this."
              />
              <PasswordInput
                id="encrypt-password-confirm"
                label="Confirm password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                hint="Typed twice on purpose: a typo here is unrecoverable."
              />
            </div>

            {passwordStrength && (
              <p
                className="text-sm text-muted-foreground"
                aria-live="polite"
              >
                Password strength:{' '}
                <strong className={`font-semibold ${passwordStrength.band.textClass}`}>
                  {passwordStrength.band.label}
                </strong>{' '}
                <span className="tabular-nums">
                  ({formatNumber(passwordStrength.guessBits, 0)} bits)
                </span>
                {passwordStrength.guessBits < 60 &&
                  '. AES-256 cannot protect a password that a cracker can guess.'}
              </p>
            )}
          </ToolPanel>

          {busy && (
            <ProgressPanel
              label="Deriving the key…"
              sublabel={`PBKDF2-HMAC-SHA256 with ${formatNumber(PBKDF2_ITERATIONS, 0)} iterations. The delay is deliberate: it costs an attacker the same time on every single guess.`}
            />
          )}

          {error && mode === 'encrypt' && <ErrorNote message={error} />}

          {envelope && (
            <ToolPanel
              title="Encrypted message"
              description="Self-contained base64: salt, nonce and ciphertext together. Send it any way you like. It is useless without the password."
              footer={
                <>
                  <CopyButton value={envelope} label="Copy encrypted text" variant="default" />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() =>
                      downloadBlob(
                        new Blob([`${envelope}\n`], { type: 'text/plain;charset=utf-8' }),
                        'encrypted.txt',
                      )
                    }
                  >
                    <Download className="size-4" aria-hidden="true" />
                    Download .txt
                  </Button>
                </>
              }
            >
              <Textarea
                readOnly
                value={envelope}
                rows={7}
                aria-label="Encrypted output"
                className="bg-muted font-mono text-[13px]"
              />
              <p className="text-xs text-muted-foreground">
                {formatNumber(envelope.replace(/\n/g, '').length, 0)} base64 characters ·{' '}
                {formatBytes(Math.ceil((envelope.replace(/\n/g, '').length * 3) / 4))} of binary ·
                line breaks are cosmetic and are ignored on decryption.
              </p>
            </ToolPanel>
          )}
        </TabsContent>

        <TabsContent value="decrypt" className="mt-4 flex flex-col gap-6">
          <ToolPanel
            title="Encrypted message"
            footer={
              <Button type="button" onClick={() => void runDecrypt()} disabled={busy} className="gap-2">
                <Unlock className="size-4" aria-hidden="true" />
                {busy ? 'Decrypting…' : 'Decrypt'}
              </Button>
            }
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ciphertext">Base64 envelope</Label>
              <Textarea
                id="ciphertext"
                value={cipherInput}
                onChange={(event) => setCipherInput(event.target.value)}
                rows={7}
                placeholder="Paste the OTD1 envelope here. Whitespace and line breaks are fine."
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="font-mono text-[13px]"
              />
            </div>

            {inspected && (
              <div
                role="status"
                className="rounded-lg bg-muted px-3 py-2.5 text-sm"
              >
                {inspected.ok ? (
                  <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
                    <dt className="text-xs font-medium text-muted-foreground">Header</dt>
                    <dd className="text-foreground">
                      Valid OTD1 envelope · {formatNumber(inspected.iterations, 0)} PBKDF2 iterations
                    </dd>
                    <dt className="text-xs font-medium text-muted-foreground">Salt</dt>
                    <dd className="font-mono text-xs break-all text-foreground">{inspected.salt}</dd>
                    <dt className="text-xs font-medium text-muted-foreground">Nonce</dt>
                    <dd className="font-mono text-xs break-all text-foreground">{inspected.iv}</dd>
                    <dt className="text-xs font-medium text-muted-foreground">Payload</dt>
                    <dd className="text-foreground tabular-nums">
                      {formatNumber(inspected.ciphertextBytes, 0)} bytes, including the 16-byte tag
                    </dd>
                  </dl>
                ) : (
                  <p className="flex items-start gap-2 text-foreground">
                    <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {inspected.message}
                  </p>
                )}
              </div>
            )}

            <PasswordInput
              id="decrypt-password"
              label="Password"
              value={decryptPassword}
              onChange={setDecryptPassword}
              autoComplete="current-password"
              hint="The same password that was used to encrypt. No other password works."
            />
          </ToolPanel>

          {busy && (
            <ProgressPanel
              label="Deriving the key…"
              sublabel="Same PBKDF2 work as encryption. A wrong password takes exactly as long as the right one."
            />
          )}

          {error && mode === 'decrypt' && <ErrorNote message={error} />}

          {decrypted && (
            <ToolPanel
              title="Decrypted message"
              description="The authentication tag verified, so this is byte-for-byte what was encrypted."
              footer={<CopyButton value={decrypted} label="Copy plaintext" variant="default" />}
            >
              <Textarea
                readOnly
                value={decrypted}
                rows={7}
                aria-label="Decrypted output"
                className="bg-muted font-mono text-[13px]"
              />
            </ToolPanel>
          )}
        </TabsContent>
      </Tabs>

      <ToolPanel
        title="What the envelope contains"
        description="Published so the format is verifiable rather than magic. Any AES-GCM implementation can read it once you know the layout."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Offset</TableHead>
                <TableHead className="w-24">Size</TableHead>
                <TableHead className="w-36">Field</TableHead>
                <TableHead className="min-w-[18rem]">Purpose</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ENVELOPE_LAYOUT.map((row) => (
                <TableRow key={row.field}>
                  <TableCell className="font-mono text-sm tabular-nums">{row.offset}</TableCell>
                  <TableCell className="font-mono text-sm whitespace-nowrap">{row.size}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{row.field}</TableCell>
                  <TableCell className="text-sm text-pretty text-muted-foreground">
                    {row.detail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-pretty text-muted-foreground">
          The whole structure is then base64-encoded. Header overhead is{' '}
          {ENVELOPE_HEADER_BYTES} bytes plus the 16-byte tag, so a short note grows by about 90
          base64 characters.
        </p>
      </ToolPanel>
    </div>
  )
}
