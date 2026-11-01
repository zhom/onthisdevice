import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, Binary, FileDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { CopyButton } from '@/components/shared/CopyButton'
import { CodePane, Field, Segmented, StatChips } from './DevUi'
import { base64ToBytes, bytesToBase64, utf8Decode, utf8Encode } from './devlib'
import { formatBytes, formatNumber, nextFrame, stripExtension } from '@/lib/utils'

type Direction = 'encode' | 'decode'

/* ------------------------------------------------------------------ */
/* File type sniffing, so a decoded blob gets a sensible name           */
/* ------------------------------------------------------------------ */

interface Signature {
  mime: string
  ext: string
  match: (b: Uint8Array) => boolean
}

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0): boolean =>
  sig.every((byte, i) => bytes[offset + i] === byte)

const SIGNATURES: Signature[] = [
  { mime: 'image/png', ext: 'png', match: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]) },
  { mime: 'image/jpeg', ext: 'jpg', match: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { mime: 'image/gif', ext: 'gif', match: (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]) },
  {
    mime: 'image/webp',
    ext: 'webp',
    match: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
  },
  { mime: 'application/pdf', ext: 'pdf', match: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]) },
  { mime: 'application/zip', ext: 'zip', match: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  { mime: 'application/gzip', ext: 'gz', match: (b) => startsWith(b, [0x1f, 0x8b]) },
  { mime: 'audio/mpeg', ext: 'mp3', match: (b) => startsWith(b, [0x49, 0x44, 0x33]) },
  { mime: 'audio/wav', ext: 'wav', match: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) },
  { mime: 'video/mp4', ext: 'mp4', match: (b) => startsWith(b, [0x66, 0x74, 0x79, 0x70], 4) },
  { mime: 'font/woff2', ext: 'woff2', match: (b) => startsWith(b, [0x77, 0x4f, 0x46, 0x32]) },
]

function sniff(bytes: Uint8Array): { mime: string; ext: string } {
  for (const sig of SIGNATURES) {
    if (bytes.length >= 12 && sig.match(bytes)) return { mime: sig.mime, ext: sig.ext }
  }
  // Fall back to "is this printable UTF-8?"
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, 4096))
    return { mime: 'text/plain', ext: 'txt' }
  } catch {
    return { mime: 'application/octet-stream', ext: 'bin' }
  }
}

/* ------------------------------------------------------------------ */
/* Chunked encoding so multi-megabyte files keep the UI responsive      */
/* ------------------------------------------------------------------ */

async function encodeChunked(
  bytes: Uint8Array,
  onProgress: (pct: number) => void,
): Promise<string> {
  const CHUNK = 1_572_864 // 1.5 MB, a multiple of 3 so no interior padding
  if (bytes.length <= CHUNK) return bytesToBase64(bytes)
  const parts: string[] = []
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    parts.push(bytesToBase64(bytes.subarray(offset, Math.min(offset + CHUNK, bytes.length))))
    onProgress(Math.min(100, ((offset + CHUNK) / bytes.length) * 100))
    await nextFrame()
  }
  return parts.join('')
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Base64EncoderDecoder() {
  const [tab, setTab] = useState('text')

  /* --- text mode ------------------------------------------------- */
  const [direction, setDirection] = useState<Direction>('encode')
  const [text, setText] = useState('')
  const [urlSafe, setUrlSafe] = useState(false)
  const [padding, setPadding] = useState(true)
  const [wrapLines, setWrapLines] = useState(false)

  const textResult = useMemo<{ output: string; error: string | null }>(() => {
    if (!text) return { output: '', error: null }
    try {
      if (direction === 'encode') {
        return {
          output: bytesToBase64(utf8Encode(text), {
            urlSafe,
            padding,
            wrap: wrapLines ? 76 : 0,
          }),
          error: null,
        }
      }
      return { output: utf8Decode(base64ToBytes(text)), error: null }
    } catch (error) {
      return { output: '', error: error instanceof Error ? error.message : String(error) }
    }
  }, [text, direction, urlSafe, padding, wrapLines])

  const swap = useCallback(() => {
    setText(textResult.output || text)
    setDirection((d) => (d === 'encode' ? 'decode' : 'encode'))
  }, [text, textResult.output])

  /* --- file → base64 --------------------------------------------- */
  const [file, setFile] = useState<File | null>(null)
  const [fileOutput, setFileOutput] = useState('')
  const [asDataUri, setAsDataUri] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const runId = useRef(0)

  const runFileEncode = useCallback(
    async (picked: File, dataUri: boolean) => {
      const id = ++runId.current
      setFileError(null)
      setFileOutput('')
      setProgress(0)
      try {
        const buffer = await picked.arrayBuffer()
        if (runId.current !== id) return
        const bytes = new Uint8Array(buffer)
        const base64 = await encodeChunked(bytes, (pct) => {
          if (runId.current === id) setProgress(pct)
        })
        if (runId.current !== id) return
        const mime = picked.type || sniff(bytes).mime
        setFileOutput(dataUri ? `data:${mime};base64,${base64}` : base64)
      } catch (error) {
        if (runId.current === id) {
          setFileError(
            error instanceof Error
              ? `Could not read that file: ${error.message}`
              : 'Could not read that file.',
          )
        }
      } finally {
        if (runId.current === id) setProgress(null)
      }
    },
    [],
  )

  const onFiles = useCallback(
    (files: File[]) => {
      const picked = files[0]
      if (!picked) return
      setFile(picked)
      void runFileEncode(picked, asDataUri)
    },
    [asDataUri, runFileEncode],
  )

  const toggleDataUri = useCallback(
    (checked: boolean) => {
      setAsDataUri(checked)
      if (file) void runFileEncode(file, checked)
    },
    [file, runFileEncode],
  )

  const fileOutputBlob = useMemo(
    () => (fileOutput ? new Blob([fileOutput], { type: 'text/plain;charset=utf-8' }) : null),
    [fileOutput],
  )

  /* --- base64 → file --------------------------------------------- */
  const [decodeInput, setDecodeInput] = useState('')
  const [decodeName, setDecodeName] = useState('')

  const decoded = useMemo<{
    blob: Blob | null
    filename: string
    bytes: number
    mime: string
    error: string | null
  }>(() => {
    const raw = decodeInput.trim()
    if (!raw) return { blob: null, filename: '', bytes: 0, mime: '', error: null }
    try {
      const dataUri = /^data:([^;,]*)(;[^,]*)?,/.exec(raw)
      let payload = raw
      let declaredMime = ''
      if (dataUri) {
        declaredMime = dataUri[1] || ''
        payload = raw.slice(dataUri[0].length)
        if (!/;base64/i.test(dataUri[2] ?? '')) {
          return {
            blob: null,
            filename: '',
            bytes: 0,
            mime: '',
            error:
              'This data URI is percent-encoded rather than Base64. Use the URL decoder for that variant.',
          }
        }
      }
      const bytes = base64ToBytes(payload)
      const sniffed = sniff(bytes)
      const mime = declaredMime || sniffed.mime
      const filename = decodeName.trim() || `decoded.${sniffed.ext}`
      return {
        blob: new Blob([bytes], { type: mime }),
        filename,
        bytes: bytes.length,
        mime,
        error: null,
      }
    } catch (error) {
      return {
        blob: null,
        filename: '',
        bytes: 0,
        mime: '',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }, [decodeInput, decodeName])

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="grid w-full grid-cols-1 gap-1 sm:grid-cols-3">
        <TabsTrigger value="text">Text</TabsTrigger>
        <TabsTrigger value="to-base64">File → Base64</TabsTrigger>
        <TabsTrigger value="to-file">Base64 → File</TabsTrigger>
      </TabsList>

      {/* ---------------------------------------------------------- */}
      <TabsContent value="text" className="mt-4 flex flex-col gap-4">
        <ToolPanel
          title="Text ⇄ Base64"
          description="Text is converted to UTF-8 bytes before encoding, so accents, CJK and emoji survive the round trip."
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Segmented
              label="Direction"
              value={direction}
              onChange={setDirection}
              options={[
                { value: 'encode', label: 'Encode' },
                { value: 'decode', label: 'Decode' },
              ]}
            />
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={swap}>
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              Swap input and output
            </Button>
          </div>

          {direction === 'encode' ? (
            <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                <Switch id="b64-urlsafe" checked={urlSafe} onCheckedChange={setUrlSafe} />
                <Label htmlFor="b64-urlsafe" className="text-sm">
                  URL-safe alphabet (<code className="font-mono text-xs">-_</code>)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="b64-padding" checked={padding} onCheckedChange={setPadding} />
                <Label htmlFor="b64-padding" className="text-sm">
                  Keep <code className="font-mono text-xs">=</code> padding
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="b64-wrap" checked={wrapLines} onCheckedChange={setWrapLines} />
                <Label htmlFor="b64-wrap" className="text-sm">
                  Wrap at 76 characters (MIME)
                </Label>
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Decoding accepts both alphabets, with or without padding, and ignores line breaks, so you can paste
              anything.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <CodePane
              label={direction === 'encode' ? 'Plain text' : 'Base64'}
              value={text}
              onChange={setText}
              rows={10}
              copyable
              placeholder={direction === 'encode' ? 'Hello, 世界 👋' : 'SGVsbG8sIHdvcmxkIQ=='}
              footer={`${formatNumber(text.length, 0)} characters`}
            />
            <CodePane
              label={direction === 'encode' ? 'Base64' : 'Plain text'}
              value={textResult.output}
              readOnly
              rows={10}
              footer={
                textResult.output
                  ? `${formatNumber(textResult.output.length, 0)} characters${
                      direction === 'encode'
                        ? ` · ${formatBytes(utf8Encode(text).length)} in, ${formatBytes(textResult.output.length)} out`
                        : ''
                    }`
                  : undefined
              }
            />
          </div>

          {textResult.error ? (
            <ErrorNote title="That is not valid Base64" message={textResult.error} />
          ) : null}
        </ToolPanel>
      </TabsContent>

      {/* ---------------------------------------------------------- */}
      <TabsContent value="to-base64" className="mt-4 flex flex-col gap-4">
        <ToolPanel
          title="Encode a file"
          description="Turn any file into Base64 text or a ready-to-paste data URI. The file is read by your browser and never uploaded."
        >
          {file ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3">
              <span className="max-w-full truncate text-sm font-medium text-foreground">
                {file.name}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatBytes(file.size)}
                {file.type ? ` · ${file.type}` : ''}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove file"
                className="ml-auto"
                onClick={() => {
                  runId.current += 1
                  setFile(null)
                  setFileOutput('')
                  setFileError(null)
                  setProgress(null)
                }}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <FileDropzone
              accept="*/*"
              onFiles={onFiles}
              maxSizeMb={200}
              title="Drop a file here"
              hint="or click to browse"
            />
          )}

          <div className="flex items-center gap-2">
            <Switch id="b64-datauri" checked={asDataUri} onCheckedChange={toggleDataUri} />
            <Label htmlFor="b64-datauri" className="text-sm">
              Output as a data URI (<code className="font-mono text-xs">data:…;base64,…</code>)
            </Label>
          </div>

          {progress !== null ? (
            <ProgressPanel label="Encoding to Base64…" value={progress} />
          ) : null}
          {fileError ? <ErrorNote message={fileError} /> : null}

          {fileOutput ? (
            <>
              <StatChips
                items={[
                  { label: 'Input', value: formatBytes(file?.size ?? 0) },
                  { label: 'Base64', value: formatBytes(fileOutput.length) },
                  {
                    label: 'Overhead',
                    value: file?.size
                      ? `+${Math.round((fileOutput.length / file.size - 1) * 100)}%`
                      : '–',
                  },
                ]}
              />
              <CodePane
                label={asDataUri ? 'Data URI' : 'Base64'}
                value={
                  fileOutput.length > 200_000
                    ? `${fileOutput.slice(0, 200_000)}\n\n… ${formatNumber(fileOutput.length - 200_000, 0)} more characters. Use Copy or Download for the full value.`
                    : fileOutput
                }
                readOnly
                rows={10}
                copyable={false}
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton value={fileOutput} label="Copy full output" variant="default" />
                <DownloadButton
                  blob={fileOutputBlob}
                  filename={`${stripExtension(file?.name ?? 'encoded')}.base64.txt`}
                  label="Download as .txt"
                  variant="outline"
                />
              </div>
            </>
          ) : null}
        </ToolPanel>
      </TabsContent>

      {/* ---------------------------------------------------------- */}
      <TabsContent value="to-file" className="mt-4 flex flex-col gap-4">
        <ToolPanel
          title="Decode Base64 to a file"
          description="Paste raw Base64 or a full data URI. The file type is detected from the data URI header or the file signature."
        >
          <CodePane
            label="Base64 or data URI"
            value={decodeInput}
            onChange={setDecodeInput}
            rows={10}
            copyable
            placeholder="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg…"
          />

          <Field
            label="File name"
            htmlFor="b64-filename"
            hint="Leave blank to use the detected extension."
          >
            <Input
              id="b64-filename"
              value={decodeName}
              onChange={(event) => setDecodeName(event.target.value)}
              placeholder={decoded.filename || 'decoded.bin'}
              className="font-mono"
            />
          </Field>

          {decoded.error ? <ErrorNote title="Cannot decode" message={decoded.error} /> : null}

          {decoded.blob ? (
            <div className="flex flex-col gap-3">
              <StatChips
                items={[
                  { label: 'Bytes', value: formatBytes(decoded.bytes) },
                  { label: 'Detected type', value: decoded.mime },
                  { label: 'File name', value: decoded.filename },
                ]}
              />
              <div className="flex flex-wrap gap-2">
                <DownloadButton
                  blob={decoded.blob}
                  filename={decoded.filename}
                  label="Download file"
                />
                {decoded.mime.startsWith('text/') ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      setDirection('decode')
                      setText(decodeInput)
                      setTab('text')
                    }}
                  >
                    <FileDown className="size-4" aria-hidden="true" />
                    Show as text instead
                  </Button>
                ) : null}
              </div>
            </div>
          ) : !decoded.error ? (
            <p className="flex items-center gap-2 rounded-lg bg-muted p-6 text-sm text-muted-foreground">
              <Binary className="size-4 shrink-0" aria-hidden="true" />
              Paste Base64 above and a download button will appear here.
            </p>
          ) : null}
        </ToolPanel>
      </TabsContent>
    </Tabs>
  )
}
