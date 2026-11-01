import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileImage, FileUp, Image as ImageIcon, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { CopyButton } from '@/components/shared/CopyButton'
import { formatBytes, formatNumber, nextFrame, stripExtension } from '@/lib/utils'
import { EncodeField, EncodePane, ProofPanel, StatChips } from './dev-encode-ui'
import { base64ToBytes } from './dev-encode-core'

export type FileBase64Mode = 'image' | 'svg' | 'file' | 'decode-image' | 'decode-file'

interface Props {
  mode?: FileBase64Mode
}

interface Encoded {
  name: string
  size: number
  mime: string
  base64: string
  dataUri: string
  isImage: boolean
  isSvg: boolean
  svgText: string | null
}

/* ------------------------------------------------------------------ */
/* Encoding                                                            */
/* ------------------------------------------------------------------ */

/** Chunk size must be a multiple of 3 so per-chunk Base64 concatenates cleanly. */
const ENCODE_CHUNK = 3 * 1024 * 1024

async function encodeFile(file: File, onProgress: (fraction: number) => void): Promise<string> {
  let out = ''
  let offset = 0
  while (offset < file.size) {
    const end = Math.min(offset + ENCODE_CHUNK, file.size)
    const buffer = await file.slice(offset, end).arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const STEP = 0x8000
    for (let i = 0; i < bytes.length; i += STEP) {
      binary += String.fromCharCode(...bytes.subarray(i, i + STEP))
    }
    out += btoa(binary)
    offset = end
    onProgress(file.size === 0 ? 1 : offset / file.size)
    await nextFrame()
  }
  return out
}

const MIME_BY_EXTENSION: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  json: 'application/json',
  txt: 'text/plain',
  csv: 'text/csv',
  pdf: 'application/pdf',
  woff2: 'font/woff2',
}

function guessMime(file: File): string {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream'
}

/* ------------------------------------------------------------------ */
/* Decoding                                                            */
/* ------------------------------------------------------------------ */

interface Sniffed {
  mime: string
  extension: string
}

interface DecodedFile {
  bytes: Uint8Array
  mime: string
  extension: string
  blob: Blob
  recognised: boolean
}

type DecodeResult =
  | { kind: 'empty' }
  | { kind: 'ok'; value: DecodedFile }
  | { kind: 'error'; message: string }

function sniff(bytes: Uint8Array): Sniffed | null {
  const starts = (...sig: number[]) => sig.every((byte, i) => bytes[i] === byte)
  if (starts(0x89, 0x50, 0x4e, 0x47)) return { mime: 'image/png', extension: 'png' }
  if (starts(0xff, 0xd8, 0xff)) return { mime: 'image/jpeg', extension: 'jpg' }
  if (starts(0x47, 0x49, 0x46, 0x38)) return { mime: 'image/gif', extension: 'gif' }
  if (starts(0x42, 0x4d)) return { mime: 'image/bmp', extension: 'bmp' }
  if (starts(0x00, 0x00, 0x01, 0x00)) return { mime: 'image/x-icon', extension: 'ico' }
  if (starts(0x25, 0x50, 0x44, 0x46)) return { mime: 'application/pdf', extension: 'pdf' }
  if (starts(0x50, 0x4b, 0x03, 0x04)) return { mime: 'application/zip', extension: 'zip' }
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45) {
    return { mime: 'image/webp', extension: 'webp' }
  }
  if (
    bytes.length > 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
    if (brand.startsWith('avif')) return { mime: 'image/avif', extension: 'avif' }
    return { mime: 'video/mp4', extension: 'mp4' }
  }
  const head = new TextDecoder().decode(bytes.subarray(0, 300)).trimStart().toLowerCase()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return { mime: 'image/svg+xml', extension: 'svg' }
  }
  return null
}

const MODE_COPY: Record<
  FileBase64Mode,
  { tab: 'encode' | 'decode'; accept: string; dropTitle: string; dropHint: string }
> = {
  image: {
    tab: 'encode',
    accept: 'image/*,.png,.jpg,.jpeg,.gif,.webp,.svg,.avif,.bmp,.ico',
    dropTitle: 'Drop an image here',
    dropHint: 'PNG, JPG, GIF, WebP, AVIF, SVG or ICO',
  },
  svg: {
    tab: 'encode',
    accept: '.svg,image/svg+xml',
    dropTitle: 'Drop an SVG file here',
    dropHint: 'or click to browse',
  },
  file: {
    tab: 'encode',
    accept: '',
    dropTitle: 'Drop any file here',
    dropHint: 'PDF, ZIP, font, audio, certificate or any other file',
  },
  'decode-image': {
    tab: 'decode',
    accept: 'image/*',
    dropTitle: 'Drop an image here',
    dropHint: 'or use the decode panel below',
  },
  'decode-file': {
    tab: 'decode',
    accept: '',
    dropTitle: 'Drop any file here',
    dropHint: 'or use the decode panel below',
  },
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function DevEncodeFileBase64({ mode = 'image' }: Props) {
  const copy = MODE_COPY[mode]
  const [tab, setTab] = useState<'encode' | 'decode'>(copy.tab)

  /* Encode side */
  const [encoded, setEncoded] = useState<Encoded | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [encodeError, setEncodeError] = useState<string | null>(null)
  const [cssUrlEncoded, setCssUrlEncoded] = useState(true)

  /* Decode side */
  const [pasted, setPasted] = useState('')
  const [decodeName, setDecodeName] = useState('decoded')

  const handleFiles = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setEncodeError(null)
    setEncoded(null)
    setProgress(0)
    try {
      const base64 = await encodeFile(file, setProgress)
      const mime = guessMime(file)
      const isSvg = mime === 'image/svg+xml'
      setEncoded({
        name: file.name,
        size: file.size,
        mime,
        base64,
        dataUri: `data:${mime};base64,${base64}`,
        isImage: mime.startsWith('image/'),
        isSvg,
        svgText: isSvg ? await file.text() : null,
      })
    } catch (error) {
      setEncodeError(
        error instanceof Error
          ? `Could not read that file: ${error.message}`
          : 'Could not read that file.',
      )
    } finally {
      setProgress(null)
    }
  }, [])

  const decodeResult = useMemo((): DecodeResult => {
    const input = pasted.trim()
    if (!input) return { kind: 'empty' }
    try {
      const dataUriMatch = /^data:([^;,]*)(;[^,]*)?,/i.exec(input)
      let payload = input
      let declaredMime = ''
      let percentEncoded = false
      if (dataUriMatch) {
        declaredMime = dataUriMatch[1] || ''
        payload = input.slice(dataUriMatch[0].length)
        percentEncoded = !/;base64/i.test(dataUriMatch[2] ?? '')
      }
      const bytes = percentEncoded
        ? new TextEncoder().encode(decodeURIComponent(payload))
        : base64ToBytes(payload)
      if (bytes.length === 0) return { kind: 'empty' }
      const sniffed = sniff(bytes)
      const mime = sniffed?.mime ?? (declaredMime || 'application/octet-stream')
      const extension = sniffed?.extension ?? (declaredMime.split('/')[1] || 'bin')
      return {
        kind: 'ok',
        value: {
          bytes,
          mime,
          extension,
          blob: new Blob([bytes.slice().buffer], { type: mime }),
          recognised: sniffed !== null,
        },
      }
    } catch (error) {
      return {
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not decode that value.',
      }
    }
  }, [pasted])

  const decoded = decodeResult.kind === 'ok' ? decodeResult.value : null
  const decodeError = decodeResult.kind === 'error' ? decodeResult.message : null

  const [decodedPreview, setDecodedPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!decoded || !decoded.mime.startsWith('image/')) {
      setDecodedPreview(null)
      return
    }
    const url = URL.createObjectURL(decoded.blob)
    setDecodedPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [decoded])

  const snippets = useMemo(() => {
    if (!encoded) return []
    const list: { label: string; value: string; hint?: string }[] = [
      { label: 'Raw Base64', value: encoded.base64, hint: 'No prefix, for APIs and JSON fields' },
      {
        label: 'Data URI',
        value: encoded.dataUri,
        hint: 'Paste anywhere a URL is accepted',
      },
    ]
    if (encoded.isImage) {
      const alt = stripExtension(encoded.name).replace(/["\\]/g, '')
      list.push({
        label: 'HTML <img>',
        value: `<img src="${encoded.dataUri}" alt="${alt}">`,
      })
      if (encoded.isSvg && encoded.svgText && cssUrlEncoded) {
        const inlined = encodeURIComponent(encoded.svgText.replace(/\s+/g, ' ').trim())
          .replace(/%20/g, ' ')
          .replace(/'/g, '%27')
          .replace(/"/g, "'")
        list.push({
          label: 'CSS background (URL-encoded)',
          value: `background-image: url("data:image/svg+xml,${inlined}");`,
          hint: 'Smaller than Base64 for SVG, and still gzip-friendly',
        })
      } else {
        list.push({
          label: 'CSS background',
          value: `background-image: url("${encoded.dataUri}");`,
        })
      }
      list.push({
        label: 'Markdown',
        value: `![${stripExtension(encoded.name)}](${encoded.dataUri})`,
      })
    } else {
      list.push({
        label: 'HTML download link',
        value: `<a href="${encoded.dataUri}" download="${encoded.name}">${encoded.name}</a>`,
      })
    }
    return list
  }, [encoded, cssUrlEncoded])

  const overhead = encoded ? encoded.base64.length / Math.max(1, encoded.size) : 0

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={(value) => setTab(value as 'encode' | 'decode')}>
        <TabsList className="w-full">
          <TabsTrigger value="encode" className="flex-1">
            <FileUp className="mr-1.5 size-4" aria-hidden="true" />
            File → Base64
          </TabsTrigger>
          <TabsTrigger value="decode" className="flex-1">
            <FileImage className="mr-1.5 size-4" aria-hidden="true" />
            Base64 → File
          </TabsTrigger>
        </TabsList>

        {/* ----------------------------------------------------- encode */}
        <TabsContent value="encode" className="mt-4 space-y-4">
          <FileDropzone
            accept={copy.accept || undefined}
            onFiles={handleFiles}
            title={copy.dropTitle}
            hint={copy.dropHint}
            icon={ImageIcon}
          />

          {progress !== null ? (
            <ProgressPanel
              label="Encoding…"
              value={Math.round(progress * 100)}
              sublabel="Reading in 3 MB slices so the tab stays responsive"
            />
          ) : null}

          {encodeError ? <ErrorNote message={encodeError} /> : null}

          {encoded ? (
            <ToolPanel
              title={encoded.name}
              description={`${encoded.mime} · ${formatBytes(encoded.size)} in, ${formatNumber(encoded.base64.length, 0)} Base64 characters out`}
            >
              <StatChips
                items={[
                  { label: 'Original', value: formatBytes(encoded.size) },
                  { label: 'Base64', value: formatBytes(encoded.base64.length) },
                  { label: 'Overhead', value: `+${Math.round((overhead - 1) * 100)}%` },
                  { label: 'MIME', value: encoded.mime },
                ]}
              />

              {encoded.isImage ? (
                <div className="flex items-center justify-center rounded-lg bg-muted p-4">
                  <img
                    src={encoded.dataUri}
                    alt={`Preview of ${encoded.name}`}
                    className="max-h-56 max-w-full object-contain"
                  />
                </div>
              ) : null}

              {encoded.isSvg ? (
                <div className="flex items-center gap-3">
                  <Switch
                    id="svg-url-encoded"
                    checked={cssUrlEncoded}
                    onCheckedChange={setCssUrlEncoded}
                  />
                  <label htmlFor="svg-url-encoded" className="text-sm text-foreground">
                    Use URL-encoded CSS (smaller than Base64 for SVG)
                  </label>
                </div>
              ) : null}

              <div className="space-y-4">
                {snippets.map((snippet) => (
                  <EncodePane
                    key={snippet.label}
                    label={snippet.label}
                    value={snippet.value}
                    readOnly
                    rows={snippet.label === 'Raw Base64' || snippet.label === 'Data URI' ? 5 : 3}
                    footer={snippet.hint}
                  />
                ))}
              </div>

              {encoded.base64.length > 40000 ? (
                <Alert role="note" variant="warning">
                  <AlertTitle>That is a large inline payload</AlertTitle>
                  <AlertDescription>
                    {formatBytes(encoded.base64.length)} of Base64 inside a stylesheet or HTML file
                    cannot be cached separately and blocks the document it lives in. Below roughly
                    2 KB inlining wins; above it, link to the file instead.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <CopyButton value={encoded.base64} label="Copy raw Base64" />
                <CopyButton value={encoded.dataUri} label="Copy data URI" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEncoded(null)}
                  className="text-muted-foreground"
                >
                  <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
                  Clear
                </Button>
              </div>
            </ToolPanel>
          ) : null}
        </TabsContent>

        {/* ----------------------------------------------------- decode */}
        <TabsContent value="decode" className="mt-4 space-y-4">
          <ToolPanel
            title="Paste Base64 or a data URI"
            description="Whitespace, line breaks and the URL-safe alphabet are all accepted. The file type is detected from the bytes themselves, not from what the string claims."
          >
            <EncodePane
              label="Base64 input"
              value={pasted}
              onChange={setPasted}
              rows={7}
              placeholder="iVBORw0KGgoAAAANSUhEUg…  or  data:image/png;base64,iVBORw0…"
            />

            {decodeError ? <ErrorNote message={decodeError} /> : null}

            {decoded ? (
              <div className="space-y-4">
                <StatChips
                  items={[
                    { label: 'Decoded size', value: formatBytes(decoded.bytes.length) },
                    { label: 'Detected type', value: decoded.mime },
                    {
                      label: 'Detection',
                      value: decoded.recognised ? 'from file signature' : 'from the data URI header',
                    },
                  ]}
                />

                {decodedPreview ? (
                  <div className="flex items-center justify-center rounded-lg bg-muted p-4">
                    <img
                      src={decodedPreview}
                      alt="Decoded image preview"
                      className="max-h-72 max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <Alert role="status">
                    <AlertTitle>Not an image</AlertTitle>
                    <AlertDescription>
                      The bytes decode to {decoded.mime}, so there is nothing to preview. Download
                      it and open it with the right application.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <EncodeField
                    label="File name"
                    htmlFor="decoded-filename"
                    hint={`Saved as .${decoded.extension}`}
                  >
                    <Input
                      id="decoded-filename"
                      value={decodeName}
                      onChange={(event) => setDecodeName(event.target.value)}
                    />
                  </EncodeField>
                  <DownloadButton
                    blob={decoded.blob}
                    filename={`${decodeName || 'decoded'}.${decoded.extension}`}
                    label="Download file"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing decoded yet. Paste a value above and the preview, detected type and download
                appear here.
              </p>
            )}
          </ToolPanel>
        </TabsContent>
      </Tabs>

      <ProofPanel subject="Your file" />
    </div>
  )
}
