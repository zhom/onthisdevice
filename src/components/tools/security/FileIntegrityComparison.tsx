import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleCheck, CircleX, Files, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { PrivacyNotice } from './SecurityUi'
import { CancelledError, compareFiles, type FileComparison } from './seclib'
import { formatBytes, formatNumber } from '@/lib/utils'

type Slot = 'a' | 'b'

function FileSlot({
  slot,
  file,
  onFiles,
  onClear,
  disabled,
}: {
  slot: Slot
  file: File | null
  onFiles: (files: File[]) => void
  onClear: () => void
  disabled: boolean
}) {
  const label = slot === 'a' ? 'File A' : 'File B'
  if (!file) {
    return (
      <FileDropzone
        onFiles={onFiles}
        icon={Files}
        disabled={disabled}
        title={`Drop ${label}`}
        hint="any size, any type"
      />
    )
  }
  return (
    <div className="flex items-start gap-3 rounded-xl bg-card px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block font-medium break-all text-foreground">{file.name}</span>
        <span className="block text-sm tabular-nums text-muted-foreground">
          {formatBytes(file.size)} · {formatNumber(file.size, 0)} bytes
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove ${label}`}
        disabled={disabled}
        onClick={onClear}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

export default function FileIntegrityComparison() {
  const [fileA, setFileA] = useState<File | null>(null)
  const [fileB, setFileB] = useState<File | null>(null)
  const [result, setResult] = useState<FileComparison | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const compare = useCallback(async (a: File, b: File) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    setResult(null)
    setProgress({ done: 0, total: a.size + b.size })
    const started = performance.now()

    try {
      const comparison = await compareFiles(
        a,
        b,
        (done, total) => {
          setProgress({ done, total })
          setElapsed(performance.now() - started)
        },
        controller.signal,
      )
      if (controller.signal.aborted) return
      setResult(comparison)
      setElapsed(performance.now() - started)
    } catch (cause) {
      if (cause instanceof CancelledError) return
      setError(
        cause instanceof Error
          ? `Could not read both files: ${cause.message}. If either lives on a network share or removable drive, copy it locally and try again.`
          : 'Could not read both files.',
      )
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setProgress(null)
      }
    }
  }, [])

  // Start automatically once both slots are filled, but only once per pair —
  // otherwise cancelling a run would immediately start it again.
  const attempted = useRef<{ a: File | null; b: File | null }>({ a: null, b: null })
  useEffect(() => {
    if (!fileA || !fileB) return
    if (attempted.current.a === fileA && attempted.current.b === fileB) return
    attempted.current = { a: fileA, b: fileB }
    void compare(fileA, fileB)
  }, [compare, fileA, fileB])

  useEffect(() => () => abortRef.current?.abort(), [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setResult(null)
    setError(null)
    setElapsed(0)
  }, [])

  const busy = progress !== null
  const percent = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0
  const throughput = elapsed > 0 && progress ? progress.done / (elapsed / 1000) : 0

  const sizesDiffer = fileA !== null && fileB !== null && fileA.size !== fileB.size

  return (
    <div className="flex flex-col gap-6">
      <PrivacyNotice>
        Both files stay on your device. They are read side by side in 4 MB slices, hashed with
        SHA-256 and compared byte by byte in this tab, so two multi-gigabyte backups cost only local
        disk reads.
      </PrivacyNotice>

      <div className="grid gap-4 lg:grid-cols-2">
        <FileSlot
          slot="a"
          file={fileA}
          disabled={busy}
          onFiles={(files) => {
            reset()
            setFileA(files[0] ?? null)
          }}
          onClear={() => {
            reset()
            setFileA(null)
          }}
        />
        <FileSlot
          slot="b"
          file={fileB}
          disabled={busy}
          onFiles={(files) => {
            reset()
            setFileB(files[0] ?? null)
          }}
          onClear={() => {
            reset()
            setFileB(null)
          }}
        />
      </div>

      {fileA && fileB && !busy && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={result ? 'outline' : 'default'}
            className="gap-2"
            onClick={() => void compare(fileA, fileB)}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {result ? 'Compare again' : 'Compare files'}
          </Button>
        </div>
      )}

      {busy && progress && (
        <ProgressPanel
          label="Reading and comparing…"
          value={percent}
          sublabel={`${formatBytes(progress.done)} of ${formatBytes(progress.total)} read${
            throughput > 0 ? ` · ${formatBytes(throughput)}/s combined` : ''
          }`}
        />
      )}

      {busy && (
        <Button
          type="button"
          variant="outline"
          className="w-fit gap-2"
          onClick={() => abortRef.current?.abort()}
        >
          <X className="size-4" aria-hidden="true" />
          Cancel
        </Button>
      )}

      {error && (
        <ErrorNote
          message={error}
          onRetry={fileA && fileB ? () => void compare(fileA, fileB) : undefined}
        />
      )}

      {!fileA || !fileB ? (
        <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          Add both files to compare them. A useful pair: the file you just downloaded and the copy
          you already had, or the original and the one that came back off a backup.
        </p>
      ) : null}

      {result && (
        <>
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 rounded-xl bg-muted px-4 py-4"
          >
            {result.identical ? (
              <CircleCheck className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
            ) : (
              <CircleX className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-lg font-semibold text-foreground">
                {result.identical ? 'The files are byte-identical' : 'The files are different'}
              </p>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">
                {result.identical
                  ? 'Same length and the same SHA-256 digest, confirmed by a byte-by-byte pass over both files. Filenames, timestamps and folder locations are ignored. Only the contents were compared.'
                  : sizesDiffer
                    ? `The files differ in length by ${formatBytes(Math.abs(result.sizeA - result.sizeB))}, so they cannot be the same file.`
                    : 'Same length, different contents. Even a single flipped bit produces a completely different SHA-256 digest.'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat
              label="Size difference"
              value={
                result.sizeA === result.sizeB
                  ? 'None'
                  : formatBytes(Math.abs(result.sizeA - result.sizeB))
              }
              hint={
                result.sizeA === result.sizeB
                  ? `both ${formatNumber(result.sizeA, 0)} bytes`
                  : `${formatNumber(result.sizeA, 0)} vs ${formatNumber(result.sizeB, 0)} bytes`
              }
            />
            <ResultStat
              label="First differing byte"
              value={
                result.firstDifference === null
                  ? result.identical
                    ? 'None'
                    : 'Beyond the shorter file'
                  : `#${formatNumber(result.firstDifference, 0)}`
              }
              hint={
                result.firstDifference === null
                  ? result.identical
                    ? 'contents match end to end'
                    : 'one file is a prefix of the other'
                  : `at 0x${result.firstDifference.toString(16).toUpperCase()}`
              }
            />
            <ResultStat
              label="Read in"
              value={`${formatNumber(elapsed / 1000, 2)} s`}
              hint={`${formatBytes(result.sizeA + result.sizeB)} across both files`}
            />
          </div>

          <ToolPanel title="SHA-256 side by side">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">File</TableHead>
                    <TableHead className="min-w-[10rem]">Name</TableHead>
                    <TableHead className="w-28 text-right">Size</TableHead>
                    <TableHead className="min-w-[18rem]">SHA-256</TableHead>
                    <TableHead className="w-20 text-right">
                      <span className="sr-only">Copy</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(
                    [
                      { label: 'A', file: fileA, size: result.sizeA, hash: result.hashA },
                      { label: 'B', file: fileB, size: result.sizeB, hash: result.hashB },
                    ] as const
                  ).map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="align-top font-medium">{row.label}</TableCell>
                      <TableCell className="align-top text-sm break-all">
                        {row.file?.name ?? '–'}
                      </TableCell>
                      <TableCell className="align-top text-right text-sm tabular-nums whitespace-nowrap">
                        {formatBytes(row.size)}
                      </TableCell>
                      <TableCell className="align-top">
                        <code className="font-mono text-[13px] break-all">{row.hash}</code>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <CopyButton value={row.hash} label="Copy" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-pretty text-muted-foreground">
              The verdict above does not rely on the digests alone. The files were also compared
              byte for byte during the same pass. Two files with the same SHA-256 are identical for
              every practical purpose, and the byte comparison shows where they diverge.
            </p>
          </ToolPanel>
        </>
      )}
    </div>
  )
}
