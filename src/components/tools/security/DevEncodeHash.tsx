import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Fingerprint, TriangleAlert, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { CopyButton } from '@/components/shared/CopyButton'
import { formatBytes, formatNumber, nextFrame } from '@/lib/utils'
import { EncodeField, EncodePane, ProofPanel } from '../dev/dev-encode-ui'
import {
  Md5,
  bytesToBase64,
  bytesToHex,
  crc32Hex,
  crc32Update,
  digestHex,
  hmacBytes,
  parseHex,
  utf8Encode,
} from '../dev/dev-encode-core'
import type { SubtleAlgorithm } from '../dev/dev-encode-core'

export type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512' | 'CRC32' | 'HMAC'

interface Props {
  algorithm?: HashAlgorithm
}

const NOTES: Record<HashAlgorithm, string> = {
  MD5: '128-bit · fast, and broken for anything security-related since 2004',
  'SHA-1': '160-bit · practical collisions demonstrated in 2017 (SHAttered)',
  'SHA-256': '256-bit · the current default for signatures and integrity',
  'SHA-384': '384-bit · SHA-2 family, a truncated SHA-512',
  'SHA-512': '512-bit · SHA-2, usually faster than SHA-256 on 64-bit CPUs',
  CRC32: '32-bit checksum · detects accidental corruption, not tampering',
  HMAC: 'Keyed authentication code · proves both integrity and origin',
}

const BROKEN: Partial<Record<HashAlgorithm, string>> = {
  MD5: 'MD5 has been broken since 2004: two different files can be made to share a digest in seconds on a laptop. It is still good for detecting accidental corruption (a truncated download, a bad disk), and that is what most published MD5 checksums are for. Never use it for passwords, signatures or deduplicating files an attacker can influence.',
  'SHA-1':
    'SHA-1 fell in 2017 when Google and CWI produced two PDFs with the same digest, and a chosen-prefix attack followed in 2020. Git and some legacy protocols still use it for non-adversarial identification. Choose SHA-256 for anything new.',
  CRC32:
    'CRC-32 is a checksum, not a hash: it is trivial to craft a different file with the same value. It is the right tool for spotting a corrupted zip entry or a flipped bit on a wire, and the wrong tool for anything an attacker touches.',
}

const OTHER_ALGORITHMS: SubtleAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

/* ------------------------------------------------------------------ */
/* Hashing                                                             */
/* ------------------------------------------------------------------ */

async function hashBytes(algorithm: HashAlgorithm, bytes: Uint8Array): Promise<string> {
  if (algorithm === 'MD5') return new Md5().update(bytes).hex()
  if (algorithm === 'CRC32') return crc32Hex(crc32Update(bytes))
  if (algorithm === 'HMAC') throw new Error('HMAC needs a key.')
  return digestHex(algorithm, bytes)
}

interface FileHashResult {
  name: string
  size: number
  digest: string
}

type KeyFormat = 'text' | 'hex' | 'base64'

function decodeKey(value: string, format: KeyFormat): Uint8Array {
  if (format === 'text') return utf8Encode(value)
  if (format === 'hex') return parseHex(value)
  try {
    return Uint8Array.from(atob(value.replace(/\s+/g, '')), (char) => char.charCodeAt(0))
  } catch {
    throw new Error('The key is not valid Base64. Check for stray characters or a missing pad.')
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function DevEncodeHash({ algorithm = 'SHA-256' }: Props) {
  const isHmac = algorithm === 'HMAC'

  const [tab, setTab] = useState<'text' | 'file'>('text')
  const [text, setText] = useState('')
  const [uppercase, setUppercase] = useState(false)
  const [expected, setExpected] = useState('')
  const [textDigest, setTextDigest] = useState('')
  const [textError, setTextError] = useState<string | null>(null)

  /* HMAC-only state */
  const [hmacKey, setHmacKey] = useState('')
  const [keyFormat, setKeyFormat] = useState<'text' | 'hex' | 'base64'>('text')
  const [hmacHash, setHmacHash] = useState<SubtleAlgorithm>('SHA-256')
  const [hmacOutput, setHmacOutput] = useState<'hex' | 'base64'>('hex')

  /* File state */
  const [progress, setProgress] = useState<number | null>(null)
  const [fileResult, setFileResult] = useState<FileHashResult | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  /* ------------------------------------------------------- text hash */
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (text.length === 0 && !isHmac) {
        setTextDigest('')
        setTextError(null)
        return
      }
      try {
        if (isHmac) {
          if (hmacKey.length === 0) {
            setTextDigest('')
            setTextError(null)
            return
          }
          const key = decodeKey(hmacKey, keyFormat)
          const signature = await hmacBytes(hmacHash, key, utf8Encode(text))
          if (cancelled) return
          setTextDigest(hmacOutput === 'hex' ? bytesToHex(signature) : bytesToBase64(signature))
          setTextError(null)
        } else {
          const digest = await hashBytes(algorithm, utf8Encode(text))
          if (cancelled) return
          setTextDigest(digest)
          setTextError(null)
        }
      } catch (error) {
        if (cancelled) return
        setTextDigest('')
        setTextError(
          error instanceof Error ? error.message : 'That input could not be hashed.',
        )
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [text, algorithm, isHmac, hmacKey, keyFormat, hmacHash, hmacOutput])

  /* ------------------------------------------------------- file hash */
  const handleFiles = useCallback(
    async (files: File[]) => {
      const file = files[0]
      if (!file) return
      setFileError(null)
      setFileResult(null)
      setProgress(0)
      try {
        if (algorithm === 'MD5' || algorithm === 'CRC32') {
          // Both stream, so an 8 GB file costs no more memory than a 4 MB one.
          const md5 = new Md5()
          let crc = 0
          const CHUNK = 4 * 1024 * 1024
          let offset = 0
          while (offset < file.size) {
            const buffer = await file.slice(offset, Math.min(offset + CHUNK, file.size)).arrayBuffer()
            const chunk = new Uint8Array(buffer)
            if (algorithm === 'MD5') md5.update(chunk)
            else crc = crc32Update(chunk, crc)
            offset += CHUNK
            setProgress(Math.min(1, offset / Math.max(1, file.size)))
            await nextFrame()
          }
          setFileResult({
            name: file.name,
            size: file.size,
            digest: algorithm === 'MD5' ? md5.hex() : crc32Hex(crc),
          })
        } else {
          const target = isHmac ? hmacHash : (algorithm as SubtleAlgorithm)
          if (file.size > 1024 * 1024 * 1024) {
            throw new Error(
              `${file.name} is ${formatBytes(file.size)}. The SHA family in WebCrypto has no streaming interface, so the whole file has to sit in memory at once. Beyond about 1 GB the tab runs out of memory. Use the MD5 or CRC-32 page for a file this size; both stream.`,
            )
          }
          const bytes = new Uint8Array(file.size)
          const CHUNK = 8 * 1024 * 1024
          let offset = 0
          while (offset < file.size) {
            const buffer = await file.slice(offset, Math.min(offset + CHUNK, file.size)).arrayBuffer()
            bytes.set(new Uint8Array(buffer), offset)
            offset += CHUNK
            setProgress(Math.min(0.9, offset / Math.max(1, file.size)))
            await nextFrame()
          }
          setProgress(0.95)
          await nextFrame()
          const digest = isHmac
            ? bytesToHex(await hmacBytes(hmacHash, decodeKey(hmacKey, keyFormat), bytes))
            : await digestHex(target, bytes)
          setFileResult({
            name: file.name,
            size: file.size,
            digest,
          })
        }
      } catch (error) {
        setFileError(
          error instanceof Error
            ? error.message
            : 'That file could not be read. Try re-selecting it.',
        )
      } finally {
        setProgress(null)
      }
    },
    [algorithm, isHmac, hmacHash, hmacKey, keyFormat],
  )

  /* --------------------------------------------------------- compare */
  const normalisedExpected = expected.trim().toLowerCase().replace(/[^0-9a-f]/g, '')
  const activeDigest = tab === 'text' ? textDigest : (fileResult?.digest ?? '')
  const comparison =
    normalisedExpected.length > 0 && activeDigest.length > 0
      ? normalisedExpected === activeDigest.toLowerCase()
      : null

  const displayDigest = uppercase ? activeDigest.toUpperCase() : activeDigest

  const crcDecimal = useMemo(() => {
    if (algorithm !== 'CRC32' || !activeDigest) return null
    return Number.parseInt(activeDigest, 16)
  }, [algorithm, activeDigest])

  const heading = isHmac ? `HMAC-${hmacHash.replace('-', '')}` : algorithm

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={(value) => setTab(value as 'text' | 'file')}>
        <TabsList className="w-full">
          <TabsTrigger value="text" className="flex-1">
            Text
          </TabsTrigger>
          <TabsTrigger value="file" className="flex-1">
            File
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------- text */}
        <TabsContent value="text" className="mt-4 space-y-4">
          {isHmac ? (
            <ToolPanel
              title="Key"
              description="The shared secret. Both sides of an HMAC must hold the same key, so nobody without the key can forge the code."
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                <EncodeField label="Secret key" htmlFor="hmac-key">
                  <Input
                    id="hmac-key"
                    value={hmacKey}
                    onChange={(event) => setHmacKey(event.target.value)}
                    placeholder="whsec_…"
                    className="font-mono"
                    autoComplete="off"
                  />
                </EncodeField>
                <EncodeField label="Key format" htmlFor="key-format">
                  <Select
                    value={keyFormat}
                    onValueChange={(value) => setKeyFormat(value as typeof keyFormat)}
                  >
                    <SelectTrigger id="key-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">UTF-8 text</SelectItem>
                      <SelectItem value="hex">Hex</SelectItem>
                      <SelectItem value="base64">Base64</SelectItem>
                    </SelectContent>
                  </Select>
                </EncodeField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <EncodeField label="Hash function" htmlFor="hmac-hash">
                  <Select
                    value={hmacHash}
                    onValueChange={(value) => setHmacHash(value as SubtleAlgorithm)}
                  >
                    <SelectTrigger id="hmac-hash">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OTHER_ALGORITHMS.map((option) => (
                        <SelectItem key={option} value={option}>
                          HMAC-{option.replace('-', '')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </EncodeField>
                <EncodeField label="Output encoding" htmlFor="hmac-output">
                  <Select
                    value={hmacOutput}
                    onValueChange={(value) => setHmacOutput(value as 'hex' | 'base64')}
                  >
                    <SelectTrigger id="hmac-output">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hex">Hex (lowercase)</SelectItem>
                      <SelectItem value="base64">Base64</SelectItem>
                    </SelectContent>
                  </Select>
                </EncodeField>
              </div>
            </ToolPanel>
          ) : null}

          <ToolPanel
            title={isHmac ? 'Message' : 'Input'}
            description={
              isHmac
                ? 'The exact bytes the sender signed. A single trailing newline changes the code completely, which is the usual cause of a webhook signature mismatch.'
                : `Hashed with ${heading} as you type. UTF-8 bytes are used, so “café” hashes as six bytes, not five.`
            }
          >
            <EncodePane
              label={isHmac ? 'Message to authenticate' : 'Text to hash'}
              value={text}
              onChange={setText}
              rows={6}
              placeholder={isHmac ? '{"event":"payment.succeeded"}' : 'Type or paste anything'}
            />
            {textError ? <ErrorNote message={textError} /> : null}
          </ToolPanel>
        </TabsContent>

        {/* ------------------------------------------------------- file */}
        <TabsContent value="file" className="mt-4 space-y-4">
          <ToolPanel
            title="Hash a file"
            description={
              algorithm === 'MD5' || algorithm === 'CRC32'
                ? 'Streamed in 4 MB slices, so the file size is limited only by your disk. Memory use stays low.'
                : 'Read in 8 MB slices with live progress. WebCrypto has no streaming SHA, so the file is held in memory while it is digested.'
            }
          >
            <FileDropzone
              onFiles={handleFiles}
              icon={Fingerprint}
              title="Drop a file to hash"
              hint="Any size, any type. The file stays on your device."
            />

            {progress !== null ? (
              <ProgressPanel
                label={`Hashing with ${heading}…`}
                value={Math.round(progress * 100)}
                sublabel="Reading locally in slices"
              />
            ) : null}

            {fileError ? <ErrorNote message={fileError} /> : null}

            {fileResult ? (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <span className="font-medium text-foreground">{fileResult.name}</span>{' '}
                <span className="text-muted-foreground">({formatBytes(fileResult.size)})</span>
              </div>
            ) : null}
          </ToolPanel>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------ result */}
      <ToolPanel
        title={`${heading} digest`}
        description={NOTES[algorithm]}
        footer={
          activeDigest ? (
            <>
              <CopyButton value={displayDigest} label="Copy digest" />
              {algorithm !== 'CRC32' ? (
                <span className="text-sm text-muted-foreground">{activeDigest.length * 4} bits</span>
              ) : (
                <span className="text-sm text-muted-foreground">32 bits</span>
              )}
            </>
          ) : null
        }
      >
        <div
          className="overflow-x-auto rounded-lg bg-muted p-4"
          role="status"
          aria-live="polite"
        >
          {activeDigest ? (
            <code className="font-mono text-sm break-all text-foreground">{displayDigest}</code>
          ) : (
            <span className="text-sm text-muted-foreground">
              {isHmac
                ? 'Enter a key and a message to see the authentication code.'
                : 'The digest appears here as soon as there is something to hash.'}
            </span>
          )}
        </div>

        {crcDecimal !== null ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Decimal</p>
              <p className="font-mono text-sm text-foreground">{formatNumber(crcDecimal, 0)}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Unsigned 32-bit</p>
              <p className="font-mono text-sm text-foreground">
                {(crcDecimal >>> 0).toString(10)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="hash-uppercase" checked={uppercase} onCheckedChange={setUppercase} />
            <label htmlFor="hash-uppercase" className="text-sm text-foreground">
              Uppercase
            </label>
          </div>
        </div>

        <EncodeField
          label="Compare with an expected value"
          htmlFor="expected-hash"
          hint="Paste the checksum published next to a download. Comparison ignores case and any spaces."
        >
          <Input
            id="expected-hash"
            value={expected}
            onChange={(event) => setExpected(event.target.value)}
            placeholder="e3b0c44298fc1c149afbf4c8996fb924…"
            className="font-mono text-sm"
          />
        </EncodeField>

        {comparison === true ? (
          <Alert role="status" variant="success">
            <CheckCircle2 aria-hidden="true" />
            <AlertTitle>Match</AlertTitle>
            <AlertDescription>
              The computed digest is identical to the value you pasted. The bytes are exactly what
              the publisher hashed.
            </AlertDescription>
          </Alert>
        ) : null}
        {comparison === false ? (
          <Alert variant="destructive">
            <XCircle aria-hidden="true" />
            <AlertTitle>No match</AlertTitle>
            <AlertDescription>
              The values differ. Check that you compared the same algorithm (a SHA-256 digest is 64
              hex characters, MD5 is 32) and that the download completed.
            </AlertDescription>
          </Alert>
        ) : null}
      </ToolPanel>

      {BROKEN[algorithm] ? (
        <Alert role="note" variant="warning">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Where {algorithm} is and is not appropriate</AlertTitle>
          <AlertDescription>{BROKEN[algorithm]}</AlertDescription>
        </Alert>
      ) : null}

      {!isHmac && tab === 'text' && text.length > 0 ? (
        <ToolPanel
          title="The same text in every algorithm"
          description="Use this when a checksum is published without the name of its function. Match on length first."
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Algorithm</TableHead>
                  <TableHead>Digest</TableHead>
                  <TableHead className="w-16 text-right">Hex length</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AllAlgorithmRows text={text} uppercase={uppercase} />
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      ) : null}

      <ProofPanel subject="Your input" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Comparison table                                                    */
/* ------------------------------------------------------------------ */

function AllAlgorithmRows({ text, uppercase }: { text: string; uppercase: boolean }) {
  const [rows, setRows] = useState<{ name: string; digest: string }[]>([])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const bytes = utf8Encode(text)
      const out: { name: string; digest: string }[] = [
        { name: 'CRC-32', digest: crc32Hex(crc32Update(bytes)) },
        { name: 'MD5', digest: new Md5().update(bytes).hex() },
      ]
      for (const name of OTHER_ALGORITHMS) {
        out.push({ name, digest: await digestHex(name, bytes) })
      }
      if (!cancelled) setRows(out)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [text])

  return (
    <>
      {rows.map((row) => (
        <TableRow key={row.name}>
          <TableCell className="font-medium">{row.name}</TableCell>
          <TableCell>
            <div className="flex items-start gap-2">
              <code className="font-mono text-[12px] break-all">
                {uppercase ? row.digest.toUpperCase() : row.digest}
              </code>
              <CopyButton value={row.digest} label="Copy" variant="ghost" />
            </div>
          </TableCell>
          <TableCell className="text-right font-mono text-xs text-muted-foreground">
            {row.digest.length}
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
