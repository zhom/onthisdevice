import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Fingerprint, ShieldAlert, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { CopyButton } from '@/components/shared/CopyButton'
import { CodePane, Field } from './DevUi'
import { Md5, bytesToHex, hashesMatch, utf8Encode } from './devlib'
import { formatBytes, formatNumber, nextFrame } from '@/lib/utils'

const ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const
type Algorithm = (typeof ALGORITHMS)[number]

const ALGORITHM_NOTES: Record<Algorithm, string> = {
  MD5: '128-bit · broken for security, still common for download checksums',
  'SHA-1': '160-bit · collisions demonstrated in 2017, legacy use only',
  'SHA-256': '256-bit · the current default for integrity and signatures',
  'SHA-384': '384-bit · SHA-2 family, truncated SHA-512',
  'SHA-512': '512-bit · SHA-2 family, faster than SHA-256 on 64-bit CPUs',
}

const CHUNK_SIZE = 4 * 1024 * 1024

type HashMap = Partial<Record<Algorithm, string>>

async function digestBytes(
  algorithm: Exclude<Algorithm, 'MD5'>,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const buffer = await crypto.subtle.digest(algorithm, bytes)
  return bytesToHex(new Uint8Array(buffer))
}

async function hashText(text: string, algorithms: readonly Algorithm[]): Promise<HashMap> {
  const bytes = utf8Encode(text)
  const out: HashMap = {}
  for (const algorithm of algorithms) {
    out[algorithm] =
      algorithm === 'MD5' ? new Md5().update(bytes).hex() : await digestBytes(algorithm, bytes)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Result table                                                        */
/* ------------------------------------------------------------------ */

function HashTable({
  hashes,
  uppercase,
  expected,
  algorithms,
}: {
  hashes: HashMap
  uppercase: boolean
  expected: string
  algorithms: readonly Algorithm[]
}) {
  return (
    <div className="overflow-x-auto rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Algorithm</TableHead>
            <TableHead className="min-w-[16rem]">Digest (hex)</TableHead>
            <TableHead className="w-24 text-right">
              <span className="sr-only">Copy</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {algorithms.map((algorithm) => {
            const raw = hashes[algorithm]
            const value = raw ? (uppercase ? raw.toUpperCase() : raw) : ''
            const matches = raw && expected.trim() ? hashesMatch(raw, expected) : false
            return (
              <TableRow key={algorithm}>
                <TableCell className="align-top">
                  <div className="font-medium">{algorithm}</div>
                  <div className="text-xs text-muted-foreground">{ALGORITHM_NOTES[algorithm]}</div>
                </TableCell>
                <TableCell className="align-top">
                  {value ? (
                    <div className="flex flex-col gap-1">
                      <code className="break-all font-mono text-[13px]">{value}</code>
                      {matches ? (
                        <span className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-foreground">
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          Matches the expected value
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">–</span>
                  )}
                </TableCell>
                <TableCell className="text-right align-top">
                  {value ? <CopyButton value={value} label="Copy" /> : null}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function HashGenerator() {
  const [uppercase, setUppercase] = useState(false)
  const [expected, setExpected] = useState('')

  /* --- text ------------------------------------------------------- */
  const [text, setText] = useState('')
  const [textHashes, setTextHashes] = useState<HashMap>({})

  useEffect(() => {
    let cancelled = false
    if (!text) {
      setTextHashes({})
      return
    }
    void hashText(text, ALGORITHMS).then((result) => {
      if (!cancelled) setTextHashes(result)
    })
    return () => {
      cancelled = true
    }
  }, [text])

  /* --- file ------------------------------------------------------- */
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<Algorithm[]>(['MD5', 'SHA-1', 'SHA-256'])
  const [fileHashes, setFileHashes] = useState<HashMap>({})
  const [progress, setProgress] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const runId = useRef(0)

  const toggleAlgorithm = useCallback((algorithm: Algorithm, checked: boolean) => {
    setSelected((current) =>
      checked
        ? ALGORITHMS.filter((a) => a === algorithm || current.includes(a))
        : current.filter((a) => a !== algorithm),
    )
  }, [])

  const hashFile = useCallback(
    async (picked: File, algorithms: Algorithm[]) => {
      const id = ++runId.current
      setError(null)
      setFileHashes({})
      setBusy(true)
      setProgress(0)
      setStage(`Reading ${picked.name}…`)

      try {
        const needsBuffer = algorithms.some((a) => a !== 'MD5')
        const buffer = needsBuffer ? new Uint8Array(picked.size) : null
        const md5 = algorithms.includes('MD5') ? new Md5() : null

        let offset = 0
        while (offset < picked.size) {
          if (runId.current !== id) return
          const slice = picked.slice(offset, Math.min(offset + CHUNK_SIZE, picked.size))
          const bytes = new Uint8Array(await slice.arrayBuffer())
          md5?.update(bytes)
          buffer?.set(bytes, offset)
          offset += bytes.length
          setProgress(picked.size > 0 ? (offset / picked.size) * 100 : 100)
          await nextFrame()
        }

        if (runId.current !== id) return
        const result: HashMap = {}
        if (md5) result.MD5 = md5.hex()

        for (const algorithm of algorithms) {
          if (algorithm === 'MD5') continue
          if (runId.current !== id) return
          setStage(`Computing ${algorithm}…`)
          setProgress(null)
          await nextFrame()
          result[algorithm] = await digestBytes(algorithm, buffer ?? new Uint8Array(0))
        }

        if (runId.current !== id) return
        setFileHashes(result)
      } catch (caught) {
        if (runId.current !== id) return
        setError(
          caught instanceof Error
            ? `Could not hash that file: ${caught.message}. Very large files can use up the tab's memory. Try MD5 alone, which streams without buffering.`
            : 'Could not hash that file.',
        )
      } finally {
        if (runId.current === id) {
          setProgress(null)
          setBusy(false)
          setStage('')
        }
      }
    },
    [],
  )

  const onFiles = useCallback(
    (files: File[]) => {
      const picked = files[0]
      if (!picked) return
      setFile(picked)
      void hashFile(picked, selected)
    },
    [hashFile, selected],
  )

  const anyMatch = useMemo(() => {
    if (!expected.trim()) return null
    const pool = { ...textHashes, ...fileHashes }
    const hit = (Object.entries(pool) as [Algorithm, string][]).find(([, value]) =>
      hashesMatch(value, expected),
    )
    return hit ? hit[0] : false
  }, [expected, textHashes, fileHashes])

  const expectedLooksHex = /^[0-9a-fA-F\s]*$/.test(expected)

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="file">File</TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="mt-4 flex flex-col gap-4">
          <ToolPanel
            title="Hash text"
            description="The tool hashes the exact UTF-8 bytes in the box below and adds no newline. All five digests update as you type."
          >
            <CodePane
              label="Text to hash"
              value={text}
              onChange={setText}
              rows={7}
              copyable
              placeholder="The quick brown fox jumps over the lazy dog"
              footer={`${formatNumber(text.length, 0)} characters · ${formatBytes(utf8Encode(text).length)} of UTF-8`}
            />
            <HashTable
              hashes={textHashes}
              uppercase={uppercase}
              expected={expected}
              algorithms={ALGORITHMS}
            />
          </ToolPanel>
        </TabsContent>

        <TabsContent value="file" className="mt-4 flex flex-col gap-4">
          <ToolPanel
            title="Hash a file"
            description="Files are read in 4 MB slices with a progress bar. MD5 is calculated slice by slice. The SHA digests need the whole file in memory. Nothing is uploaded, so you can verify a download without trusting a server."
          >
            {file ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3">
                <span className="max-w-full truncate text-sm font-medium text-foreground">
                  {file.name}
                </span>
                <span className="text-sm text-muted-foreground">{formatBytes(file.size)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove file"
                  className="ml-auto"
                  onClick={() => {
                    runId.current += 1
                    setFile(null)
                    setFileHashes({})
                    setProgress(null)
                    setBusy(false)
                    setError(null)
                  }}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <FileDropzone
                accept="*/*"
                onFiles={onFiles}
                maxSizeMb={4096}
                title="Drop a file to checksum"
                hint="or click to browse"
              />
            )}

            <fieldset className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-muted p-3">
              <legend className="px-1 text-sm font-medium">Algorithms</legend>
              {ALGORITHMS.map((algorithm) => (
                <div key={algorithm} className="flex items-center gap-2">
                  <Checkbox
                    id={`hash-algo-${algorithm}`}
                    checked={selected.includes(algorithm)}
                    onCheckedChange={(checked) => toggleAlgorithm(algorithm, checked === true)}
                  />
                  <Label htmlFor={`hash-algo-${algorithm}`} className="text-sm font-normal">
                    {algorithm}
                  </Label>
                </div>
              ))}
            </fieldset>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!file || selected.length === 0 || busy}
                onClick={() => file && void hashFile(file, selected)}
                className="gap-1.5"
              >
                <Fingerprint className="size-4" aria-hidden="true" />
                {busy ? 'Hashing…' : 'Compute hashes'}
              </Button>
              {busy ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    runId.current += 1
                    setProgress(null)
                    setBusy(false)
                    setStage('')
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>

            {busy ? (
              <ProgressPanel
                label={stage || 'Hashing…'}
                value={progress ?? undefined}
                sublabel={
                  file
                    ? `${formatBytes(file.size)} · large files take a moment because every byte is read.`
                    : undefined
                }
              />
            ) : null}

            {error ? <ErrorNote message={error} /> : null}

            {Object.keys(fileHashes).length > 0 ? (
              <HashTable
                hashes={fileHashes}
                uppercase={uppercase}
                expected={expected}
                algorithms={selected}
              />
            ) : null}
          </ToolPanel>
        </TabsContent>
      </Tabs>

      <ToolPanel
        title="Options and verification"
        description="Paste the checksum a publisher gave you and the matching row is flagged automatically."
      >
        <div className="flex items-center gap-2">
          <Switch id="hash-uppercase" checked={uppercase} onCheckedChange={setUppercase} />
          <Label htmlFor="hash-uppercase" className="text-sm">
            Uppercase hexadecimal
          </Label>
        </div>

        <Field
          label="Expected hash to compare against"
          htmlFor="hash-expected"
          hint="Case and surrounding whitespace are ignored. The comparison runs over the whole string, so it does not leak where a mismatch starts."
        >
          <Input
            id="hash-expected"
            value={expected}
            onChange={(event) => setExpected(event.target.value)}
            placeholder="d41d8cd98f00b204e9800998ecf8427e"
            className="font-mono"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </Field>

        <div role="status" aria-live="polite">
          {expected.trim() ? (
            !expectedLooksHex ? (
              <p className="inline-flex items-center gap-1.5 text-sm text-foreground">
                <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
                That does not look like a hex digest. Checksums contain only 0-9 and a-f.
              </p>
            ) : anyMatch ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                Match: the {anyMatch} digest is identical
              </p>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <XCircle className="size-4 shrink-0" aria-hidden="true" />
                No match against any computed digest
              </p>
            )
          ) : null}
        </div>
      </ToolPanel>
    </div>
  )
}
