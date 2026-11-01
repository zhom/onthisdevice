import { useCallback, useEffect, useRef, useState } from 'react'
import { Boxes, Download, FileArchive, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { downloadBlob, formatBytes, nextFrame, stripExtension } from '@/lib/utils'
import {
  PHOTO_ACCEPT,
  PHOTO_CHECKER,
  bitmapToCanvas,
  canvasData,
  ctx2d,
  decodePhoto,
  encodePhotoData,
  makeCanvas,
  photoError,
  resizePhotoData,
  hexToRgb,
} from '../image-edit/photo-image'

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256] as const
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

interface IconEntry {
  size: number
  bytes: Uint8Array
}

/**
 * Build a Vista-era .ico: an ICONDIR, one 16-byte ICONDIRENTRY per image, then
 * the PNG payloads. Windows XP and later read PNG-in-ICO natively, which is why
 * every modern favicon generator uses this layout instead of BMP DIBs.
 */
function buildIco(entries: IconEntry[]): Uint8Array {
  const headerSize = 6 + entries.length * 16
  const total = entries.reduce((sum, e) => sum + e.bytes.length, headerSize)
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  view.setUint16(0, 0, true) // reserved
  view.setUint16(2, 1, true) // type: 1 = icon
  view.setUint16(4, entries.length, true)

  let offset = headerSize
  entries.forEach((entry, i) => {
    const e = 6 + i * 16
    out[e] = entry.size >= 256 ? 0 : entry.size // 0 means 256
    out[e + 1] = entry.size >= 256 ? 0 : entry.size
    out[e + 2] = 0 // palette entries
    out[e + 3] = 0 // reserved
    view.setUint16(e + 4, 1, true) // colour planes
    view.setUint16(e + 6, 32, true) // bits per pixel
    view.setUint32(e + 8, entry.bytes.length, true)
    view.setUint32(e + 12, offset, true)
    out.set(entry.bytes, offset)
    offset += entry.bytes.length
  })
  return out
}

interface DecodedIcon {
  width: number
  height: number
  bpp: number
  kind: 'PNG' | 'BMP'
  data: ImageData
}

function isPng(bytes: Uint8Array, offset: number): boolean {
  return PNG_SIGNATURE.every((b, i) => bytes[offset + i] === b)
}

/** Decode a classic BMP-DIB icon entry, including the 1-bit transparency mask. */
function decodeBmpIcon(bytes: Uint8Array, offset: number, length: number): DecodedIcon {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, length)
  const headerSize = view.getUint32(0, true)
  const width = view.getInt32(4, true)
  const doubleHeight = view.getInt32(8, true)
  const height = Math.abs(doubleHeight) / 2
  const bpp = view.getUint16(14, true)
  const paletteCount = view.getUint32(32, true) || (bpp <= 8 ? 1 << bpp : 0)

  if (width <= 0 || height <= 0) throw new Error('This .ico contains an entry with no pixel data.')

  const paletteOffset = headerSize
  const palette: [number, number, number][] = []
  for (let i = 0; i < paletteCount; i++) {
    const p = paletteOffset + i * 4
    palette.push([view.getUint8(p + 2), view.getUint8(p + 1), view.getUint8(p)])
  }

  const xorOffset = paletteOffset + paletteCount * 4
  const rowBytes = Math.ceil((width * bpp) / 32) * 4
  const maskRowBytes = Math.ceil(width / 32) * 4
  const andOffset = xorOffset + rowBytes * height

  const out = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y // DIB rows run bottom-up
    for (let x = 0; x < width; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 255
      const rowStart = xorOffset + srcY * rowBytes
      if (bpp === 32) {
        const p = rowStart + x * 4
        b = view.getUint8(p)
        g = view.getUint8(p + 1)
        r = view.getUint8(p + 2)
        a = view.getUint8(p + 3)
      } else if (bpp === 24) {
        const p = rowStart + x * 3
        b = view.getUint8(p)
        g = view.getUint8(p + 1)
        r = view.getUint8(p + 2)
      } else if (bpp === 8) {
        const index = view.getUint8(rowStart + x)
        const colour = palette[index] ?? [0, 0, 0]
        r = colour[0]
        g = colour[1]
        b = colour[2]
      } else if (bpp === 4) {
        const byte = view.getUint8(rowStart + (x >> 1))
        const index = x % 2 === 0 ? byte >> 4 : byte & 0x0f
        const colour = palette[index] ?? [0, 0, 0]
        r = colour[0]
        g = colour[1]
        b = colour[2]
      } else if (bpp === 1) {
        const byte = view.getUint8(rowStart + (x >> 3))
        const index = (byte >> (7 - (x % 8))) & 1
        const colour = palette[index] ?? [0, 0, 0]
        r = colour[0]
        g = colour[1]
        b = colour[2]
      } else {
        throw new Error(`Unsupported icon depth: ${bpp} bits per pixel.`)
      }

      // 32-bit icons sometimes ship a zeroed alpha channel; fall back to the mask.
      if (bpp !== 32 || a === 0) {
        const maskByteIndex = andOffset + srcY * maskRowBytes + (x >> 3)
        if (maskByteIndex < length) {
          const maskByte = view.getUint8(maskByteIndex)
          const transparent = (maskByte >> (7 - (x % 8))) & 1
          a = transparent ? 0 : 255
        } else {
          a = 255
        }
      }

      const o = (y * width + x) * 4
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
      out[o + 3] = a
    }
  }

  return { width, height, bpp, kind: 'BMP', data: new ImageData(out, width, height) }
}

export interface PngToIcoProps {
  mode?: 'encode' | 'decode'
}

interface Made {
  size: number
  url: string
  bytes: number
}

interface Extracted {
  name: string
  url: string
  blob: Blob
  width: number
  height: number
  kind: string
  bpp: number
}

export default function PngToIco({ mode = 'encode' }: PngToIcoProps) {
  const [file, setFile] = useState<File | null>(null)
  const [sizes, setSizes] = useState<number[]>([16, 32, 48, 256])
  const [square, setSquare] = useState(true)
  const [background, setBackground] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ico, setIco] = useState<{ blob: Blob; name: string } | null>(null)
  const [made, setMade] = useState<Made[]>([])
  const [extracted, setExtracted] = useState<Extracted[]>([])
  const [zipping, setZipping] = useState(false)

  const madeRef = useRef<Made[]>([])
  madeRef.current = made
  const extractedRef = useRef<Extracted[]>([])
  extractedRef.current = extracted
  useEffect(
    () => () => {
      for (const m of madeRef.current) URL.revokeObjectURL(m.url)
      for (const e of extractedRef.current) URL.revokeObjectURL(e.url)
    },
    [],
  )

  const clearOutputs = useCallback(() => {
    setMade((prev) => {
      for (const m of prev) URL.revokeObjectURL(m.url)
      return []
    })
    setExtracted((prev) => {
      for (const e of prev) URL.revokeObjectURL(e.url)
      return []
    })
    setIco(null)
  }, [])

  const onFiles = useCallback(
    (incoming: File[]) => {
      const next = incoming[0]
      if (!next) return
      setError(null)
      clearOutputs()
      setFile(next)
      setStatus(`${next.name} loaded (${formatBytes(next.size)}).`)
    },
    [clearOutputs],
  )

  function toggleSize(size: number, on: boolean) {
    clearOutputs()
    setSizes((prev) => (on ? [...prev, size].sort((a, b) => a - b) : prev.filter((s) => s !== size)))
  }

  async function buildIcon() {
    if (!file) return
    if (sizes.length === 0) {
      setError('Choose at least one icon size.')
      return
    }
    setBusy(true)
    setError(null)
    setStatus('Decoding the source image…')
    try {
      const decoded = await decodePhoto(file)
      let source = canvasData(bitmapToCanvas(decoded.bitmap))
      decoded.bitmap.close()

      // Letterbox to a square so circular logos aren't stretched.
      if (square && source.width !== source.height) {
        const side = Math.max(source.width, source.height)
        const canvas = makeCanvas(side, side)
        const ctx = ctx2d(canvas, { willReadFrequently: true })
        const rgb = hexToRgb(background)
        if (rgb) {
          ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`
          ctx.fillRect(0, 0, side, side)
        }
        const tmp = makeCanvas(source.width, source.height)
        ctx2d(tmp).putImageData(source, 0, 0)
        ctx.drawImage(tmp, (side - source.width) / 2, (side - source.height) / 2)
        source = ctx.getImageData(0, 0, side, side)
      }

      const entries: IconEntry[] = []
      const previews: Made[] = []
      for (const size of sizes) {
        setStatus(`Rendering the ${size} × ${size} layer…`)
        await nextFrame()
        const resized = await resizePhotoData(source, size, size)
        const png = await encodePhotoData(resized, 'png', 1)
        const bytes = new Uint8Array(await png.arrayBuffer())
        entries.push({ size, bytes })
        previews.push({ size, url: URL.createObjectURL(png), bytes: bytes.length })
      }

      const icoBytes = buildIco(entries)
      const blob = new Blob([icoBytes as unknown as BlobPart], { type: 'image/x-icon' })
      const name = `${stripExtension(file.name) || 'favicon'}.ico`
      clearOutputs()
      setMade(previews)
      setIco({ blob, name })
      setStatus(`Built a ${sizes.length}-layer icon (${formatBytes(blob.size)}).`)
      downloadBlob(blob, name)
    } catch (err) {
      setError(photoError(err, 'Could not build the icon.'))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  async function extractIcon() {
    if (!file) return
    setBusy(true)
    setError(null)
    setStatus('Reading the icon directory…')
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      if (bytes.length < 6 || view.getUint16(0, true) !== 0) {
        throw new Error('That does not look like an .ico file. The header is wrong.')
      }
      const type = view.getUint16(2, true)
      if (type !== 1 && type !== 2) {
        throw new Error('Only .ico icon files and .cur cursors use this container.')
      }
      const count = view.getUint16(4, true)
      if (count === 0) throw new Error('This icon file declares zero images.')

      const out: Extracted[] = []
      const base = stripExtension(file.name) || 'icon'
      for (let i = 0; i < count; i++) {
        const e = 6 + i * 16
        const length = view.getUint32(e + 8, true)
        const offset = view.getUint32(e + 12, true)
        if (offset + length > bytes.length) continue
        await nextFrame()

        if (isPng(bytes, offset)) {
          const slice = bytes.slice(offset, offset + length)
          const blob = new Blob([slice as unknown as BlobPart], { type: 'image/png' })
          const decoded = await decodePhoto(blob, `${base}.png`)
          out.push({
            name: `${base}-${decoded.width}x${decoded.height}.png`,
            blob,
            url: URL.createObjectURL(blob),
            width: decoded.width,
            height: decoded.height,
            kind: 'PNG payload (copied out untouched)',
            bpp: 32,
          })
          decoded.bitmap.close()
        } else {
          const icon = decodeBmpIcon(bytes, offset, length)
          const blob = await encodePhotoData(icon.data, 'png', 1)
          out.push({
            name: `${base}-${icon.width}x${icon.height}.png`,
            blob,
            url: URL.createObjectURL(blob),
            width: icon.width,
            height: icon.height,
            kind: 'BMP DIB (re-encoded to PNG)',
            bpp: icon.bpp,
          })
        }
      }

      if (out.length === 0) throw new Error('None of the entries in this file could be decoded.')
      clearOutputs()
      setExtracted(out)
      setStatus(`Extracted ${out.length} ${out.length === 1 ? 'image' : 'images'}.`)
    } catch (err) {
      setError(photoError(err, 'Could not read that .ico file.'))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  async function downloadZip() {
    if (extracted.length === 0) return
    setZipping(true)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      for (const item of extracted) zip.file(item.name, item.blob)
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, `${stripExtension(file?.name ?? 'icon')}-png.zip`)
    } catch (err) {
      setError(photoError(err, 'Could not build the ZIP.'))
    } finally {
      setZipping(false)
    }
  }

  function reset() {
    clearOutputs()
    setFile(null)
    setStatus('')
    setError(null)
  }

  const htmlSnippet = `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">`

  return (
    <div className="space-y-6">
      {!file && (
        <FileDropzone
          accept={mode === 'encode' ? PHOTO_ACCEPT : '.ico,image/x-icon,image/vnd.microsoft.icon'}
          onFiles={onFiles}
          maxSizeMb={50}
          title={mode === 'encode' ? 'Drop a PNG, JPG or WebP logo' : 'Drop an .ico file'}
          hint={
            mode === 'encode'
              ? 'A square image of 256 px or more gives the sharpest result'
              : 'Every image inside the icon is extracted in your browser and offered as a PNG'
          }
        />
      )}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {file && mode === 'encode' && (
        <ToolPanel
          title="Icon sizes"
          description="Windows, browsers and desktop shortcuts each pick a different layer out of the same .ico."
          footer={
            <Button size="lg" className="w-full" onClick={buildIcon} disabled={busy}>
              <Boxes className="size-4" aria-hidden="true" />
              {busy ? 'Building…' : `Build .ico with ${sizes.length} ${sizes.length === 1 ? 'size' : 'sizes'}`}
            </Button>
          }
        >
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Include these sizes</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ICO_SIZES.map((size) => (
                <label
                  key={size}
                  className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm"
                  htmlFor={`ico-size-${size}`}
                >
                  <Checkbox
                    id={`ico-size-${size}`}
                    checked={sizes.includes(size)}
                    onCheckedChange={(v) => toggleSize(size, v === true)}
                  />
                  {size} × {size}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              16 is the browser tab and address bar, 32 the taskbar and high-DPI tab, 48 the
              Windows desktop, 256 the Explorer “extra large icons” view.
            </p>
          </fieldset>

          <div className="flex items-center justify-between gap-3 rounded-md bg-muted p-3">
            <div>
              <Label htmlFor="ico-square">Pad non-square images</Label>
              <p className="text-xs text-muted-foreground">Keeps the logo's proportions instead of stretching it.</p>
            </div>
            <Switch id="ico-square" checked={square} onCheckedChange={setSquare} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ico-bg">Padding colour (blank = transparent)</Label>
            <Input
              id="ico-bg"
              type="text"
              inputMode="text"
              placeholder="#ffffff or leave empty"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
            />
          </div>
        </ToolPanel>
      )}

      {file && mode === 'decode' && (
        <ToolPanel
          title="Extract the images"
          description="An .ico is a container: it can hold a dozen bitmaps at different sizes and colour depths."
          footer={
            <Button size="lg" className="w-full" onClick={extractIcon} disabled={busy}>
              <Download className="size-4" aria-hidden="true" />
              {busy ? 'Reading…' : 'Extract every size as PNG'}
            </Button>
          }
        >
          <p className="text-sm text-muted-foreground">
            {file.name} ({formatBytes(file.size)})
          </p>
        </ToolPanel>
      )}

      {busy && <ProgressPanel label={status || 'Working…'} />}

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>

      {ico && (
        <ToolPanel title="Your favicon">
          <div className="flex flex-wrap items-end gap-4">
            {made.map((m) => (
              <figure key={m.size} className="text-center">
                <div
                  className="flex items-center justify-center rounded border border-border p-2"
                  style={PHOTO_CHECKER}
                >
                  <img
                    src={m.url}
                    alt={`${m.size} by ${m.size} pixel layer`}
                    width={Math.min(m.size, 96)}
                    height={Math.min(m.size, 96)}
                    style={{ imageRendering: m.size <= 48 ? 'pixelated' : 'auto' }}
                  />
                </div>
                <figcaption className="mt-1 text-xs text-muted-foreground">
                  {m.size}px · {formatBytes(m.bytes)}
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => downloadBlob(ico.blob, ico.name)}>
              <Download className="size-4" aria-hidden="true" /> Download {ico.name} ({formatBytes(ico.blob.size)})
            </Button>
            <CopyButton value={htmlSnippet} label="Copy the <link> tags" />
          </div>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
            <code>{htmlSnippet}</code>
          </pre>
        </ToolPanel>
      )}

      {extracted.length > 0 && (
        <ToolPanel
          title={`${extracted.length} ${extracted.length === 1 ? 'image' : 'images'} inside this icon`}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {extracted.map((item) => (
              <div key={item.name} className="space-y-2 rounded-lg bg-muted p-3">
                <div className="flex h-24 items-center justify-center rounded border border-border" style={PHOTO_CHECKER}>
                  <img
                    src={item.url}
                    alt={item.name}
                    className="max-h-20 max-w-full"
                    style={{ imageRendering: item.width <= 48 ? 'pixelated' : 'auto' }}
                  />
                </div>
                <p className="text-sm font-medium">
                  {item.width} × {item.height}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.kind} · {item.bpp}-bit · {formatBytes(item.blob.size)}
                </p>
                <Button
                  type="button"
                  size="sm"
                  aria-label={`Download ${item.width} × ${item.height} PNG`}
                  onClick={() => downloadBlob(item.blob, item.name)}
                >
                  <Download className="size-4" aria-hidden="true" /> Download PNG
                </Button>
              </div>
            ))}
          </div>
          {extracted.length > 1 && (
            <Button type="button" variant="outline" onClick={downloadZip} disabled={zipping}>
              <FileArchive className="size-4" aria-hidden="true" />
              {zipping ? 'Zipping…' : 'Download all as .zip'}
            </Button>
          )}
        </ToolPanel>
      )}

      {file && (
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="size-4" aria-hidden="true" /> Use a different file
        </Button>
      )}
    </div>
  )
}
