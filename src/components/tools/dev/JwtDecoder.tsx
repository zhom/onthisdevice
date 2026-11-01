import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CodePane, DataRow, Field, Segmented } from './DevUi'
import { base64ToBytes, bytesToHex, utf8Decode, utf8Encode } from './devlib'

const SAMPLE_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsImFkbWluIjp0cnVlLCJpYXQiOjE3NTUyMDk2MDAsImV4cCI6MTg1NTIwOTYwMCwiaXNzIjoiaHR0cHM6Ly9hdXRoLmV4YW1wbGUuY29tIiwiYXVkIjoiYXBpLmV4YW1wbGUuY29tIn0.OYFhE-3rC1CpUu6JuCzhErmVw6VE0M1TXi7d4WcJx8g'

const CLAIM_NOTES: Record<string, string> = {
  iss: 'Issuer: who created and signed the token',
  sub: 'Subject: the principal the token is about, usually a user id',
  aud: 'Audience: the recipient the token is intended for',
  exp: 'Expiration time: the token must be rejected at or after this moment',
  nbf: 'Not before: the token must be rejected before this moment',
  iat: 'Issued at: when the token was created',
  jti: 'JWT ID: a unique identifier, used to prevent replay',
  azp: 'Authorized party: the client the token was issued to',
  scope: 'OAuth scopes granted to this token',
  scp: 'OAuth scopes granted to this token',
  typ: 'Token type, almost always JWT',
  alg: 'Signing algorithm used to produce the signature',
  kid: 'Key ID: tells the verifier which key to use',
  cty: 'Content type of a nested token',
}

const TIME_CLAIMS = new Set(['exp', 'iat', 'nbf', 'auth_time', 'updated_at'])

const HMAC_HASH: Record<string, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
}

interface DecodedJwt {
  headerJson: string
  payloadJson: string
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: Uint8Array<ArrayBuffer>
  signingInput: string
  rawSignature: string
}

function decodeSegment(segment: string, name: string): { json: string; value: Record<string, unknown> } {
  let text: string
  try {
    text = utf8Decode(base64ToBytes(segment))
  } catch (error) {
    throw new Error(
      `The ${name} is not valid Base64url. ${error instanceof Error ? error.message : ''}`.trim(),
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error(`The ${name} decoded, but it is not JSON. Decoded value: ${text.slice(0, 120)}`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`The ${name} must be a JSON object.`)
  }
  return { json: JSON.stringify(parsed, null, 2), value: parsed as Record<string, unknown> }
}

function decodeJwt(token: string): DecodedJwt {
  const trimmed = token.trim().replace(/^Bearer\s+/i, '')
  if (!trimmed) throw new Error('Paste a token to decode.')
  const parts = trimmed.split('.')
  if (parts.length !== 3) {
    throw new Error(
      `A JWS-format JWT has exactly three dot-separated parts (header.payload.signature); this has ${parts.length}.${
        parts.length === 5 ? ' Five parts means a JWE: an encrypted token, which cannot be read without the decryption key.' : ''
      }`,
    )
  }
  const [rawHeader, rawPayload, rawSignature] = parts
  const header = decodeSegment(rawHeader, 'header')
  const payload = decodeSegment(rawPayload, 'payload')
  return {
    headerJson: header.json,
    payloadJson: payload.json,
    header: header.value,
    payload: payload.value,
    signature: rawSignature ? base64ToBytes(rawSignature) : new Uint8Array(0),
    signingInput: `${rawHeader}.${rawPayload}`,
    rawSignature,
  }
}

function humanTime(seconds: number): { absolute: string; relative: string } {
  const date = new Date(seconds * 1000)
  if (Number.isNaN(date.getTime())) return { absolute: 'Invalid date', relative: '' }
  return {
    absolute: format(date, "d MMM yyyy, HH:mm:ss 'UTC'XXX"),
    relative: formatDistanceToNowStrict(date, { addSuffix: true }),
  }
}

function renderClaimValue(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

type VerifyState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'valid' }
  | { status: 'invalid' }
  | { status: 'error'; message: string }

export default function JwtDecoder() {
  const [token, setToken] = useState('')
  const [secret, setSecret] = useState('')
  const [secretFormat, setSecretFormat] = useState<'utf8' | 'base64'>('utf8')
  const [showSecret, setShowSecret] = useState(false)
  const [verify, setVerify] = useState<VerifyState>({ status: 'idle' })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const decoded = useMemo<{ value: DecodedJwt | null; error: string | null }>(() => {
    if (!token.trim()) return { value: null, error: null }
    try {
      return { value: decodeJwt(token), error: null }
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : String(error) }
    }
  }, [token])

  const jwt = decoded.value
  const alg = typeof jwt?.header.alg === 'string' ? jwt.header.alg : ''
  const hmacHash = HMAC_HASH[alg]

  // Re-verifying is cheap, but reset whenever anything relevant changes.
  useEffect(() => {
    setVerify({ status: 'idle' })
  }, [token, secret, secretFormat])

  const timeStatus = useMemo(() => {
    if (!jwt) return null
    const exp = typeof jwt.payload.exp === 'number' ? jwt.payload.exp : null
    const nbf = typeof jwt.payload.nbf === 'number' ? jwt.payload.nbf : null
    const nowSeconds = now / 1000
    if (exp !== null && nowSeconds >= exp) {
      return { kind: 'expired' as const, label: `Expired ${formatDistanceToNowStrict(new Date(exp * 1000), { addSuffix: true })}` }
    }
    if (nbf !== null && nowSeconds < nbf) {
      return {
        kind: 'early' as const,
        label: `Not valid until ${formatDistanceToNowStrict(new Date(nbf * 1000), { addSuffix: true })}`,
      }
    }
    if (exp !== null) {
      return {
        kind: 'active' as const,
        label: `Expires ${formatDistanceToNowStrict(new Date(exp * 1000), { addSuffix: true })}`,
      }
    }
    return { kind: 'noexp' as const, label: 'No expiry claim: this token never times out' }
  }, [jwt, now])

  const runVerify = useCallback(async () => {
    if (!jwt || !hmacHash) return
    setVerify({ status: 'working' })
    try {
      const keyBytes = secretFormat === 'base64' ? base64ToBytes(secret) : utf8Encode(secret)
      if (keyBytes.length === 0) {
        setVerify({ status: 'error', message: 'Enter the shared secret used to sign the token.' })
        return
      }
      const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: { name: hmacHash } },
        false,
        ['verify'],
      )
      const ok = await crypto.subtle.verify('HMAC', key, jwt.signature, utf8Encode(jwt.signingInput))
      setVerify({ status: ok ? 'valid' : 'invalid' })
    } catch (error) {
      setVerify({
        status: 'error',
        message:
          error instanceof Error
            ? `Verification failed: ${error.message}`
            : 'Verification failed for an unknown reason.',
      })
    }
  }, [jwt, hmacHash, secret, secretFormat])

  const claims = useMemo(() => {
    if (!jwt) return []
    return Object.entries(jwt.payload)
  }, [jwt])

  return (
    <div className="flex flex-col gap-4">
      <Alert role="note">
        <ShieldCheck className="size-4" aria-hidden="true" />
        <AlertTitle>Your token stays in this tab</AlertTitle>
        <AlertDescription>
          This page is static HTML and JavaScript with no network code. Decoding and signature
          verification run in your browser, so a production access token is not sent anywhere.
        </AlertDescription>
      </Alert>

      <ToolPanel title="JSON Web Token" description="Paste the token, with or without a “Bearer ” prefix.">
        <CodePane
          label="Encoded token"
          value={token}
          onChange={setToken}
          rows={6}
          copyable
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.…"
          actions={
            !token ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setToken(SAMPLE_TOKEN)}>
                Load example
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setToken('')}>
                Clear
              </Button>
            )
          }
        />

        {decoded.error ? <ErrorNote title="Cannot decode this token" message={decoded.error} /> : null}

        {jwt ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" role="status" aria-live="polite">
            <span className="font-mono text-muted-foreground">
              alg: {alg || 'unknown'}
            </span>
            {typeof jwt.header.typ === 'string' ? (
              <span className="font-mono text-muted-foreground">
                typ: {jwt.header.typ}
              </span>
            ) : null}
            {typeof jwt.header.kid === 'string' ? (
              <span className="font-mono text-muted-foreground">
                kid: {jwt.header.kid}
              </span>
            ) : null}
            {timeStatus ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                {timeStatus.kind === 'expired' ? (
                  <XCircle className="size-4 shrink-0" aria-hidden="true" />
                ) : timeStatus.kind === 'active' ? (
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
                )}
                {timeStatus.label}
              </span>
            ) : null}
            {alg === 'none' ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
                alg “none”: this token is unsigned
              </span>
            ) : null}
          </div>
        ) : null}
      </ToolPanel>

      {jwt ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ToolPanel title="Header" description="Algorithm and key metadata.">
              <CodePane label="Decoded header JSON" value={jwt.headerJson} readOnly rows={8} />
            </ToolPanel>
            <ToolPanel title="Payload" description="The claims carried by the token.">
              <CodePane label="Decoded payload JSON" value={jwt.payloadJson} readOnly rows={8} />
            </ToolPanel>
          </div>

          <ToolPanel
            title="Claims in plain English"
            description="Registered claims are annotated; NumericDate values are shown as local times."
          >
            <div className="overflow-x-auto">
              <dl className="min-w-0">
                {claims.map(([key, value]) => {
                  const isTime = TIME_CLAIMS.has(key) && typeof value === 'number'
                  const time = isTime ? humanTime(value as number) : null
                  return (
                    <DataRow
                      key={key}
                      label={key}
                      value={
                        <div className="flex flex-col gap-0.5">
                          <span className="break-all">{renderClaimValue(value)}</span>
                          {time ? (
                            <span className="font-sans text-xs text-muted-foreground">
                              {time.absolute} · {time.relative}
                            </span>
                          ) : null}
                          {CLAIM_NOTES[key] ? (
                            <span className="font-sans text-xs text-muted-foreground">
                              {CLAIM_NOTES[key]}
                            </span>
                          ) : null}
                        </div>
                      }
                    />
                  )
                })}
              </dl>
            </div>
          </ToolPanel>

          <ToolPanel
            title="Signature"
            description="The signature proves the token was issued by someone holding the key. Decoding alone proves nothing."
          >
            <dl>
              <DataRow label="Base64url" value={<span className="break-all">{jwt.rawSignature}</span>} />
              <DataRow
                label="Bytes"
                value={`${jwt.signature.length} bytes · ${bytesToHex(jwt.signature).slice(0, 64)}${
                  jwt.signature.length > 32 ? '…' : ''
                }`}
              />
              <DataRow label="Signing input" value={<span className="break-all">{jwt.signingInput}</span>} />
            </dl>

            {hmacHash ? (
              <div className="flex flex-col gap-3 rounded-lg bg-muted p-3">
                <Field
                  label={`Shared secret for ${alg}`}
                  htmlFor="jwt-secret"
                  hint="The secret is used with WebCrypto and is never stored."
                >
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Input
                        id="jwt-secret"
                        type={showSecret ? 'text' : 'password'}
                        value={secret}
                        onChange={(event) => setSecret(event.target.value)}
                        placeholder="your-256-bit-secret"
                        className="pr-10 font-mono"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0"
                        aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                        onClick={() => setShowSecret((v) => !v)}
                      >
                        {showSecret ? (
                          <EyeOff className="size-4" aria-hidden="true" />
                        ) : (
                          <Eye className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                    <Segmented
                      label="Secret format"
                      value={secretFormat}
                      onChange={setSecretFormat}
                      options={[
                        { value: 'utf8', label: 'Text' },
                        { value: 'base64', label: 'Base64' },
                      ]}
                    />
                  </div>
                </Field>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    className="gap-1.5"
                    disabled={verify.status === 'working'}
                    onClick={() => void runVerify()}
                  >
                    <KeyRound className="size-4" aria-hidden="true" />
                    {verify.status === 'working' ? 'Verifying…' : `Verify ${alg} signature`}
                  </Button>

                  <div role="status" aria-live="polite">
                    {verify.status === 'valid' ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                        Signature verified
                      </span>
                    ) : verify.status === 'invalid' ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <XCircle className="size-4 shrink-0" aria-hidden="true" />
                        Signature does not match this secret
                      </span>
                    ) : verify.status === 'error' ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                        <XCircle className="size-4 shrink-0" aria-hidden="true" />
                        {verify.message}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <Alert role="note">
                <ShieldAlert className="size-4" aria-hidden="true" />
                <AlertTitle>
                  {alg ? `${alg} cannot be verified here` : 'No algorithm declared'}
                </AlertTitle>
                <AlertDescription>
                  {alg === 'none'
                    ? 'This token declares no signature at all. Any verifier that accepts alg "none" has a critical vulnerability.'
                    : 'Only the HMAC family (HS256, HS384, HS512) is verifiable with a shared secret. RS, PS and ES algorithms need the issuer public key in JWK or PEM form, which this page deliberately does not fetch.'}
                </AlertDescription>
              </Alert>
            )}
          </ToolPanel>
        </>
      ) : null}
    </div>
  )
}
