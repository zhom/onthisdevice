import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, KeyRound, Minus, Plus, RefreshCw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { EncodeField, ProofPanel } from '../dev/dev-encode-ui'
import { base32Decode, base32Encode, base64ToBytes, hmacBytes } from '../dev/dev-encode-core'
import type { SubtleAlgorithm } from '../dev/dev-encode-core'

type Mode = 'totp' | 'hotp'

interface Props {
  mode?: Mode
}

type OtpAlgorithm = Extract<SubtleAlgorithm, 'SHA-1' | 'SHA-256' | 'SHA-512'>

const ALGORITHM_LABEL: Record<OtpAlgorithm, string> = {
  'SHA-1': 'SHA1 (the universal default)',
  'SHA-256': 'SHA256',
  'SHA-512': 'SHA512',
}

/* ------------------------------------------------------------------ */
/* RFC 4226 / RFC 6238                                                 */
/* ------------------------------------------------------------------ */

async function hotp(
  key: Uint8Array,
  counter: bigint,
  digits: number,
  algorithm: OtpAlgorithm,
): Promise<string> {
  const message = new Uint8Array(8)
  const view = new DataView(message.buffer)
  view.setBigUint64(0, counter, false)
  const mac = await hmacBytes(algorithm, key, message)
  const offset = mac[mac.length - 1] & 0x0f
  const binary =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff)
  return (binary % 10 ** digits).toString().padStart(digits, '0')
}

function randomSecret(bytes: number): string {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return base32Encode(buffer, 'rfc4648', false)
}

function buildUri(config: {
  mode: Mode
  issuer: string
  account: string
  secret: string
  algorithm: OtpAlgorithm
  digits: number
  period: number
  counter: string
}): string {
  const label = config.issuer
    ? `${encodeURIComponent(config.issuer)}:${encodeURIComponent(config.account || 'user')}`
    : encodeURIComponent(config.account || 'user')
  const params = new URLSearchParams()
  params.set('secret', config.secret.replace(/\s+/g, '').toUpperCase())
  if (config.issuer) params.set('issuer', config.issuer)
  params.set('algorithm', config.algorithm.replace('-', ''))
  params.set('digits', String(config.digits))
  if (config.mode === 'totp') params.set('period', String(config.period))
  else params.set('counter', config.counter || '0')
  return `otpauth://${config.mode}/${label}?${params.toString()}`
}

interface ParsedUri {
  secret: string
  issuer: string
  account: string
  algorithm: OtpAlgorithm
  digits: number
  period: number
  counter: string
}

function parseUri(input: string): ParsedUri | null {
  if (!/^otpauth:\/\//i.test(input.trim())) return null
  try {
    const url = new URL(input.trim())
    const path = decodeURIComponent(url.pathname.replace(/^\//, ''))
    const [maybeIssuer, maybeAccount] = path.includes(':') ? path.split(':') : ['', path]
    const params = url.searchParams
    const algorithmParam = (params.get('algorithm') ?? 'SHA1').toUpperCase()
    const algorithm: OtpAlgorithm =
      algorithmParam === 'SHA256' ? 'SHA-256' : algorithmParam === 'SHA512' ? 'SHA-512' : 'SHA-1'
    return {
      secret: params.get('secret') ?? '',
      issuer: params.get('issuer') ?? maybeIssuer,
      account: maybeAccount,
      algorithm,
      digits: Number(params.get('digits') ?? 6),
      period: Number(params.get('period') ?? 30),
      counter: params.get('counter') ?? '0',
    }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function DevEncodeTotp({ mode = 'totp' }: Props) {
  // The secret is random, so it is created after hydration: a value drawn
  // during the server render would never match the one drawn in the browser.
  const [secret, setSecret] = useState('')
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    setSecret((current) => current || randomSecret(20))
    setSeeded(true)
  }, [])
  const [issuer, setIssuer] = useState('onthisdevice')
  const [account, setAccount] = useState('demo@example.com')
  const [algorithm, setAlgorithm] = useState<OtpAlgorithm>('SHA-1')
  const [digits, setDigits] = useState(6)
  const [period, setPeriod] = useState(30)
  const [counter, setCounter] = useState('0')

  const [code, setCode] = useState('')
  const [previousCode, setPreviousCode] = useState('')
  const [nextCode, setNextCode] = useState('')
  const [remaining, setRemaining] = useState(period)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [qrBlob, setQrBlob] = useState<Blob | null>(null)

  const [candidate, setCandidate] = useState('')
  const [verdict, setVerdict] = useState<{ ok: boolean; detail: string } | null>(null)

  const tickRef = useRef<number | null>(null)

  const keyBytes = useMemo(() => {
    try {
      const bytes = base32Decode(secret)
      if (bytes.length === 0) return { bytes: null, error: 'Enter a Base32 secret.' }
      return { bytes, error: null as string | null }
    } catch (caught) {
      return {
        bytes: null,
        error:
          caught instanceof Error
            ? caught.message
            : 'That secret is not valid Base32.',
      }
    }
  }, [secret])

  const uri = useMemo(
    () =>
      buildUri({
        mode,
        issuer,
        account,
        secret,
        algorithm,
        digits,
        period,
        counter,
      }),
    [mode, issuer, account, secret, algorithm, digits, period, counter],
  )

  /* ------------------------------------------------------- live code */
  const compute = useCallback(async () => {
    if (!keyBytes.bytes) {
      setCode('')
      return
    }
    try {
      if (mode === 'hotp') {
        const value = BigInt(counter.trim() === '' ? '0' : counter.trim())
        setCode(await hotp(keyBytes.bytes, value, digits, algorithm))
        setPreviousCode(
          value > 0n ? await hotp(keyBytes.bytes, value - 1n, digits, algorithm) : '',
        )
        setNextCode(await hotp(keyBytes.bytes, value + 1n, digits, algorithm))
        setError(null)
        return
      }
      const now = Math.floor(Date.now() / 1000)
      const step = BigInt(Math.floor(now / period))
      setCode(await hotp(keyBytes.bytes, step, digits, algorithm))
      setPreviousCode(await hotp(keyBytes.bytes, step - 1n, digits, algorithm))
      setNextCode(await hotp(keyBytes.bytes, step + 1n, digits, algorithm))
      setRemaining(period - (now % period))
      setError(null)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The code could not be generated.',
      )
    }
  }, [keyBytes.bytes, mode, counter, digits, algorithm, period])

  useEffect(() => {
    void compute()
    if (mode !== 'totp') return
    const tick = () => {
      const now = Date.now() / 1000
      const left = period - (Math.floor(now) % period)
      setRemaining(left)
      if (left === period) void compute()
    }
    tickRef.current = window.setInterval(tick, 500)
    return () => {
      if (tickRef.current !== null) window.clearInterval(tickRef.current)
    }
  }, [compute, mode, period])

  /* -------------------------------------------------------------- QR */
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!keyBytes.bytes) {
        setQr(null)
        setQrBlob(null)
        return
      }
      const { toDataURL } = await import('qrcode')
      const dataUrl = await toDataURL(uri, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: { dark: '#000000', light: '#ffffff' },
      })
      if (cancelled) return
      setQr(dataUrl)
      // Decode the data URI by hand: a fetch() — even to data: — is exactly the
      // kind of request this site promises never to make.
      const payload = dataUrl.slice(dataUrl.indexOf(',') + 1)
      const bytes = base64ToBytes(payload)
      setQrBlob(new Blob([bytes.slice().buffer], { type: 'image/png' }))
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [uri, keyBytes.bytes])

  /* ---------------------------------------------------------- verify */
  const verify = useCallback(async () => {
    if (!keyBytes.bytes) return
    const submitted = candidate.replace(/\s+/g, '')
    if (submitted.length === 0) {
      setVerdict(null)
      return
    }
    if (mode === 'hotp') {
      const base = BigInt(counter.trim() === '' ? '0' : counter.trim())
      for (let look = 0; look <= 10; look += 1) {
        const value = await hotp(keyBytes.bytes, base + BigInt(look), digits, algorithm)
        if (value === submitted) {
          setVerdict({
            ok: true,
            detail:
              look === 0
                ? `Matches counter ${base}.`
                : `Matches counter ${base + BigInt(look)}, ${look} step${look === 1 ? '' : 's'} ahead, inside the usual look-ahead window. Resynchronise the server counter to ${base + BigInt(look) + 1n}.`,
          })
          return
        }
      }
      setVerdict({
        ok: false,
        detail: `No match for counters ${base} to ${base + 10n}. Either the secret differs or the token has drifted further than a ten-step window.`,
      })
      return
    }
    const now = Math.floor(Date.now() / 1000)
    const step = BigInt(Math.floor(now / period))
    for (const offset of [0n, -1n, 1n]) {
      const value = await hotp(keyBytes.bytes, step + offset, digits, algorithm)
      if (value === submitted) {
        setVerdict({
          ok: true,
          detail:
            offset === 0n
              ? 'Matches the current time step.'
              : `Matches the ${offset === -1n ? 'previous' : 'next'} time step. Servers normally accept ±1 step to allow for clock skew.`,
        })
        return
      }
    }
    setVerdict({
      ok: false,
      detail:
        'No match in the current step or the one either side. Check the secret, the digit count, the algorithm and your device clock.',
    })
  }, [keyBytes.bytes, candidate, mode, counter, digits, algorithm, period])

  const percent = mode === 'totp' ? (remaining / period) * 100 : 100

  return (
    <div className="space-y-5">
      <ToolPanel
        title={mode === 'totp' ? 'Live code' : 'Code for this counter'}
        description={
          mode === 'totp'
            ? 'Calculated again each time step from your device clock. Nothing is stored or sent. Reload the page and it is gone.'
            : 'HOTP codes advance on an event, not a clock. The counter is yours to move.'
        }
      >
        {seeded && keyBytes.error ? <ErrorNote title="Secret problem" message={keyBytes.error} /> : null}
        {error ? <ErrorNote message={error} /> : null}

        <div className="flex flex-col items-center gap-3 rounded-lg bg-muted p-6">
          <output
            className="font-mono text-4xl font-bold tracking-[0.2em] text-foreground tabular-nums sm:text-5xl"
            aria-live="polite"
            aria-label="Current one-time code"
          >
            {code ? code.replace(/(.{3})(?=.)/g, '$1 ') : '–'}
          </output>
          {mode === 'totp' ? (
            <div className="w-full max-w-xs space-y-1.5">
              <Progress value={percent} aria-label="Time remaining in this step" />
              <p className="text-center text-sm text-muted-foreground" role="status">
                Valid for {Math.ceil(remaining)} more second{Math.ceil(remaining) === 1 ? '' : 's'}
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2">
            <CopyButton value={code} label="Copy code" />
            {previousCode ? <span className="self-center text-sm tabular-nums text-muted-foreground">previous {previousCode}</span> : null}
            {nextCode ? <span className="self-center text-sm tabular-nums text-muted-foreground">next {nextCode}</span> : null}
          </div>
        </div>

        {mode === 'hotp' ? (
          <div className="flex flex-wrap items-end gap-3">
            <EncodeField
              label="Counter"
              htmlFor="hotp-counter"
              hint="An unsigned 64-bit integer. Both sides must agree on it."
              className="max-w-40"
            >
              <Input
                id="hotp-counter"
                value={counter}
                inputMode="numeric"
                onChange={(event) => setCounter(event.target.value.replace(/[^\d]/g, ''))}
                className="font-mono"
              />
            </EncodeField>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Decrease counter"
                onClick={() =>
                  setCounter((value) => String(Math.max(0, Number(value || '0') - 1)))
                }
              >
                <Minus className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Increase counter"
                onClick={() => setCounter((value) => String(Number(value || '0') + 1))}
              >
                <Plus className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
      </ToolPanel>

      <ToolPanel
        title="Secret and parameters"
        description="Paste an existing secret or an otpauth:// URI, or generate a fresh one. Everything below is derived locally."
      >
        <EncodeField
          label="Base32 secret"
          htmlFor="otp-secret"
          hint="What an authenticator app stores. 160 bits (32 characters) is the RFC 4226 recommendation."
        >
          <div className="flex flex-wrap gap-2">
            <Input
              id="otp-secret"
              value={secret}
              onChange={(event) => {
                const value = event.target.value
                const parsed = parseUri(value)
                if (parsed) {
                  setSecret(parsed.secret)
                  setIssuer(parsed.issuer)
                  setAccount(parsed.account)
                  setAlgorithm(parsed.algorithm)
                  setDigits(parsed.digits)
                  setPeriod(parsed.period)
                  setCounter(parsed.counter)
                } else {
                  setSecret(value.toUpperCase())
                }
              }}
              className="min-w-0 flex-1 font-mono"
              autoComplete="off"
              spellCheck={false}
              placeholder="JBSWY3DPEHPK3PXP or otpauth://…"
            />
            <Button variant="outline" onClick={() => setSecret(randomSecret(20))}>
              <RefreshCw className="mr-1.5 size-4" aria-hidden="true" />
              New secret
            </Button>
          </div>
        </EncodeField>

        <div className="flex flex-wrap gap-2">
          {[10, 20, 32].map((size) => (
            <Button
              key={size}
              variant="ghost"
              size="sm"
              onClick={() => setSecret(randomSecret(size))}
            >
              {size * 8}-bit secret
            </Button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <EncodeField label="Issuer" htmlFor="otp-issuer" hint="Shown as the account provider.">
            <Input
              id="otp-issuer"
              value={issuer}
              onChange={(event) => setIssuer(event.target.value)}
            />
          </EncodeField>
          <EncodeField label="Account" htmlFor="otp-account" hint="Usually an email or username.">
            <Input
              id="otp-account"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
            />
          </EncodeField>
          <EncodeField
            label="Algorithm"
            htmlFor="otp-algorithm"
            hint="Google Authenticator and most hardware tokens only implement SHA1."
          >
            <Select
              value={algorithm}
              onValueChange={(value) => setAlgorithm(value as OtpAlgorithm)}
            >
              <SelectTrigger id="otp-algorithm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ALGORITHM_LABEL) as OtpAlgorithm[]).map((option) => (
                  <SelectItem key={option} value={option}>
                    {ALGORITHM_LABEL[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EncodeField>
          <EncodeField label="Digits" htmlFor="otp-digits" hint="Six is near-universal.">
            <Select value={String(digits)} onValueChange={(value) => setDigits(Number(value))}>
              <SelectTrigger id="otp-digits">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 digits</SelectItem>
                <SelectItem value="7">7 digits</SelectItem>
                <SelectItem value="8">8 digits</SelectItem>
              </SelectContent>
            </Select>
          </EncodeField>
          {mode === 'totp' ? (
            <EncodeField
              label="Time step"
              htmlFor="otp-period"
              hint="RFC 6238 recommends 30 seconds; some banks use 60."
            >
              <Select value={String(period)} onValueChange={(value) => setPeriod(Number(value))}>
                <SelectTrigger id="otp-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                </SelectContent>
              </Select>
            </EncodeField>
          ) : null}
        </div>
      </ToolPanel>

      <ToolPanel
        title="Enrollment"
        description="Scan this with any authenticator app, or copy the URI into your provisioning system."
      >
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="rounded-lg bg-card p-3">
            {qr ? (
              <img src={qr} alt={`QR code for the ${mode.toUpperCase()} secret`} width={200} height={200} />
            ) : (
              <div className="grid size-[200px] place-items-center text-sm text-muted-foreground">
                No valid secret
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="overflow-x-auto rounded-lg bg-muted p-3">
              <code className="font-mono text-xs break-all text-foreground">{uri}</code>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={uri} label="Copy otpauth URI" />
              <CopyButton value={secret} label="Copy secret" />
              <DownloadButton
                blob={qrBlob}
                filename={`${mode}-${(account || 'secret').replace(/[^\w.-]+/g, '-')}.png`}
                label="Download QR"
                variant="outline"
                size="sm"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              The QR image is drawn on this page from the URI above. This string is the entire
              second factor, so do not share a screenshot of it.
            </p>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel
        title="Verify a code"
        description={
          mode === 'totp'
            ? 'Check a code from a phone against this secret, with the ±1 step tolerance a real server allows.'
            : 'Check a token code against a ten-step look-ahead window, the way a server resynchronises a drifted HOTP token.'
        }
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <EncodeField label="Code to check" htmlFor="otp-candidate">
            <Input
              id="otp-candidate"
              value={candidate}
              inputMode="numeric"
              autoComplete="one-time-code"
              onChange={(event) => {
                setCandidate(event.target.value)
                setVerdict(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void verify()
              }}
              placeholder="123456"
              className="font-mono tracking-widest"
            />
          </EncodeField>
          <Button onClick={() => void verify()} disabled={!keyBytes.bytes}>
            <KeyRound className="mr-1.5 size-4" aria-hidden="true" />
            Verify
          </Button>
        </div>

        {verdict ? (
          <Alert variant={verdict.ok ? 'success' : 'destructive'} role={verdict.ok ? 'status' : 'alert'}>
            {verdict.ok ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <XCircle aria-hidden="true" />
            )}
            <AlertTitle>{verdict.ok ? 'Valid code' : 'Not valid'}</AlertTitle>
            <AlertDescription>{verdict.detail}</AlertDescription>
          </Alert>
        ) : null}
      </ToolPanel>

      <ProofPanel subject="Your 2FA secret" />
    </div>
  )
}
