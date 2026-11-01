import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleCheck, CircleX, FileCheck2, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { PrivacyNotice } from './SecurityUi'
import {
  algorithmForDigestLength,
  ALGORITHM_INFO,
  CancelledError,
  constantTimeEquals,
  hashFile,
  HASH_ALGORITHMS,
  type HashAlgorithm,
} from './seclib'
import { formatBytes, formatNumber } from '@/lib/utils'

type Digests = Partial<Record<HashAlgorithm, string>>

/**
 * Pulls the digest out of whatever the user pasted: a bare hex string, a line
 * of `sha256sum` output ("<hex>  filename"), BSD style ("SHA256 (f) = <hex>"),
 * or a colon-separated fingerprint.
 */
function extractDigest(input: string): string | null {
  const cleaned = input.replace(/[\s:]/g, '')
  const matches = cleaned.match(/[0-9a-fA-F]{32,128}/g)
  if (!matches) return null
  for (const candidate of matches) {
    if (algorithmForDigestLength(candidate.length)) return candidate.toLowerCase()
  }
  return null
}

export default function FileHashChecker() {
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<HashAlgorithm[]>(['SHA-256'])
  const [digests, setDigests] = useState<Digests>({})
  const [expected, setExpected] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const expectedDigest = useMemo(() => extractDigest(expected), [expected])
  const expectedAlgorithm = expectedDigest ? algorithmForDigestLength(expectedDigest.length) : null

  // Pasting a checksum tells us which algorithm the publisher used, so switch to it.
  useEffect(() => {
    if (!expectedAlgorithm) return
    setSelected((previous) =>
      previous.includes(expectedAlgorithm) ? previous : [...previous, expectedAlgorithm],
    )
  }, [expectedAlgorithm])

  const missing = useMemo(
    () => selected.filter((algorithm) => digests[algorithm] === undefined),
    [digests, selected],
  )

  const run = useCallback(
    async (target: File, algorithms: HashAlgorithm[]) => {
      if (algorithms.length === 0) return
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setError(null)
      setProgress({ done: 0, total: target.size })
      const started = performance.now()

      try {
        const result = await hashFile(target, {
          algorithms,
          signal: controller.signal,
          onProgress: (done, total) => {
            setProgress({ done, total })
            setElapsed(performance.now() - started)
          },
        })
        if (controller.signal.aborted) return
        setDigests((previous) => ({ ...previous, ...result }))
        setElapsed(performance.now() - started)
      } catch (cause) {
        if (cause instanceof CancelledError) return
        setError(
          cause instanceof Error
            ? `Could not read the file: ${cause.message}. If it is on a network drive or an unplugged device, copy it locally first.`
            : 'Could not read the file.',
        )
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
          setProgress(null)
        }
      }
    },
    [],
  )

  useEffect(() => {
    if (!file || missing.length === 0) return
    void run(file, missing)
  }, [file, missing, run])

  useEffect(() => () => abortRef.current?.abort(), [])

  const onFiles = useCallback((files: File[]) => {
    const next = files[0]
    if (!next) return
    abortRef.current?.abort()
    setDigests({})
    setError(null)
    setElapsed(0)
    setFile(next)
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setFile(null)
    setDigests({})
    setProgress(null)
    setError(null)
    setElapsed(0)
  }, [])

  const toggleAlgorithm = useCallback((algorithm: HashAlgorithm, checked: boolean) => {
    setSelected((previous) => {
      if (checked) return previous.includes(algorithm) ? previous : [...previous, algorithm]
      const next = previous.filter((entry) => entry !== algorithm)
      return next.length === 0 ? previous : next
    })
  }, [])

  const busy = progress !== null
  const percent = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0
  const throughput = elapsed > 0 && progress ? progress.done / (elapsed / 1000) : 0

  const verdict = useMemo(() => {
    if (!expectedDigest) return null
    const matched = HASH_ALGORITHMS.find((algorithm) => {
      const value = digests[algorithm]
      return value !== undefined && constantTimeEquals(value, expectedDigest)
    })
    if (matched) return { ok: true as const, algorithm: matched }
    if (expectedAlgorithm && digests[expectedAlgorithm] !== undefined) {
      return { ok: false as const, algorithm: expectedAlgorithm }
    }
    return null
  }, [digests, expectedAlgorithm, expectedDigest])

  return (
    <div className="flex flex-col gap-6">
      <PrivacyNotice>
        The file stays on your device. It is read from your disk in 4 MB slices and hashed in this
        tab, so a 40 GB disk image works the same as a 40 KB text file. An upload-based checker
        would have to receive the file whose integrity you want to prove.
      </PrivacyNotice>

      {!file ? (
        <FileDropzone
          onFiles={onFiles}
          icon={FileCheck2}
          title="Drop a file to hash"
          hint="or click to browse. Any size, any type."
        />
      ) : (
        <ToolPanel
          title="File"
          footer={
            <>
              {busy ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => abortRef.current?.abort()}
                >
                  <X className="size-4" aria-hidden="true" />
                  Cancel
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setDigests({})
                  }}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Recompute
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={reset}>
                Choose another file
              </Button>
            </>
          }
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="min-w-0 font-medium break-all text-foreground">{file.name}</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {formatBytes(file.size)}
            </span>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">Algorithms</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {HASH_ALGORITHMS.map((algorithm) => {
                const info = ALGORITHM_INFO[algorithm]
                const checked = selected.includes(algorithm)
                const id = `hash-algorithm-${algorithm}`
                return (
                  <div
                    key={algorithm}
                    className="flex items-start gap-3 rounded-lg bg-muted px-3 py-2.5"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(value) => toggleAlgorithm(algorithm, value === true)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <Label htmlFor={id} className="cursor-pointer flex-wrap gap-2">
                        <span className="text-sm font-medium text-foreground">{algorithm}</span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {info.secure ? 'Secure' : 'Legacy'}
                        </span>
                      </Label>
                      <p className="mt-1 text-xs text-pretty text-muted-foreground">{info.note}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </fieldset>
        </ToolPanel>
      )}

      {busy && progress && (
        <ProgressPanel
          label={`Hashing ${file?.name ?? 'file'}…`}
          value={percent}
          sublabel={`${formatBytes(progress.done)} of ${formatBytes(progress.total)}${
            throughput > 0 ? ` · ${formatBytes(throughput)}/s` : ''
          }`}
        />
      )}

      {error && <ErrorNote message={error} onRetry={file ? () => void run(file, selected) : undefined} />}

      {file && (
        <ToolPanel
          title="Compare with a published checksum"
          description="Paste the value from the download page. A whole sha256sum line, a BSD-style line or a bare hex string all work. The algorithm is detected from the length."
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expected-checksum">Expected checksum</Label>
            <Input
              id="expected-checksum"
              value={expected}
              onChange={(event) => setExpected(event.target.value)}
              placeholder="e.g. 9fdc…  ubuntu-24.04.iso"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="font-mono text-[13px]"
            />
            {expected.trim().length > 0 && !expectedDigest && (
              <p className="text-sm text-foreground">
                No 32, 40, 64 or 128-character hex value found in that text. Those are the lengths of
                an MD5, SHA-1, SHA-256 and SHA-512 digest respectively.
              </p>
            )}
            {expectedDigest && expectedAlgorithm && (
              <p className="text-xs text-muted-foreground">
                Recognised as a {expectedAlgorithm} digest ({expectedDigest.length} hex characters).
              </p>
            )}
          </div>

          {verdict && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 rounded-lg bg-muted px-4 py-3"
            >
              {verdict.ok ? (
                <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              ) : (
                <CircleX className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  {verdict.ok
                    ? `Checksums match (${verdict.algorithm})`
                    : `Checksums do not match (${verdict.algorithm})`}
                </p>
                <p className="mt-0.5 text-sm text-pretty text-muted-foreground">
                  {verdict.ok
                    ? 'The file on your disk is byte-for-byte the file the publisher hashed. It is not truncated, not corrupted and not swapped.'
                    : 'Not one byte of this file can be trusted. Either the download was corrupted or interrupted, or the file is not the one the checksum describes. Download it again from the original source before opening it.'}
                </p>
              </div>
            </div>
          )}
        </ToolPanel>
      )}

      {Object.keys(digests).length > 0 && (
        <ToolPanel
          title="Digests"
          description={
            elapsed > 0 && file
              ? `Computed in ${formatNumber(elapsed / 1000, 2)} s.`
              : undefined
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Algorithm</TableHead>
                  <TableHead className="min-w-[18rem]">Digest (hex, lowercase)</TableHead>
                  <TableHead className="w-24 text-right">
                    <span className="sr-only">Copy</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {HASH_ALGORITHMS.filter((algorithm) => digests[algorithm] !== undefined).map(
                  (algorithm) => {
                    const value = digests[algorithm] as string
                    const matches =
                      expectedDigest !== null && constantTimeEquals(value, expectedDigest)
                    return (
                      <TableRow key={algorithm}>
                        <TableCell className="align-top">
                          <div className="font-medium">{algorithm}</div>
                          <div className="text-xs text-muted-foreground">
                            {ALGORITHM_INFO[algorithm].bits}-bit
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <code className="font-mono text-[13px] break-all">{value}</code>
                          {matches && (
                            <span className="mt-1.5 flex w-fit items-center gap-1 text-xs font-medium text-foreground">
                              <CircleCheck className="size-3" aria-hidden="true" />
                              Matches the expected value
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <CopyButton value={value} label="Copy" />
                        </TableCell>
                      </TableRow>
                    )
                  },
                )}
              </TableBody>
            </Table>
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
