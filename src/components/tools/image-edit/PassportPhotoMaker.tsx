import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Download, Move, Printer, RotateCcw, SprayCan, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { downloadBlob, formatBytes, nextFrame } from '@/lib/utils'
import {
  PHOTO_ACCEPT,
  ctx2d,
  decodePhoto,
  encodePhotoCanvas,
  makeCanvas,
  photoError,
  safeNumber,
} from './photo-image'
import { mmToPx, setBlobDensity } from './photo-dpi'

interface Preset {
  id: string
  label: string
  /** Finished photo size in millimetres. */
  w: number
  h: number
  /** Head height (crown to chin) in millimetres, as required by the authority. */
  headMin: number
  headMax: number
  /** Distance from the bottom of the photo to eye level, in mm (0 = not specified). */
  eyeFromBottomMin?: number
  eyeFromBottomMax?: number
  note: string
}

const PRESETS: Preset[] = [
  {
    id: 'us',
    label: 'United States: 2 × 2 in (51 × 51 mm)',
    w: 50.8,
    h: 50.8,
    headMin: 25.4,
    headMax: 34.9,
    eyeFromBottomMin: 28.6,
    eyeFromBottomMax: 35,
    note: 'US passport, visa, green card and most US ID photos. Head 1–1⅜ in, eyes 1⅛–1⅜ in from the bottom.',
  },
  {
    id: 'uk',
    label: 'United Kingdom: 35 × 45 mm',
    w: 35,
    h: 45,
    headMin: 29,
    headMax: 34,
    note: 'UK passport and driving licence. Crown-to-chin must be 29–34 mm with a plain light-grey or cream background.',
  },
  {
    id: 'schengen',
    label: 'Schengen / EU visa: 35 × 45 mm',
    w: 35,
    h: 45,
    headMin: 32,
    headMax: 36,
    note: 'Schengen visa and most EU national ID photos: the face fills 70–80% of the frame.',
  },
  {
    id: 'in',
    label: 'India: 51 × 51 mm (2 × 2 in)',
    w: 51,
    h: 51,
    headMin: 25,
    headMax: 35,
    note: 'Indian passport (2 × 2 in) with a plain white background. Some state portals ask for 35 × 45 mm instead. Check before printing.',
  },
  {
    id: 'cn',
    label: 'China: 33 × 48 mm',
    w: 33,
    h: 48,
    headMin: 28,
    headMax: 33,
    note: 'Chinese passport and visa. The digital file often also has a pixel requirement (354 × 472 px at 300 DPI).',
  },
  {
    id: 'ca',
    label: 'Canada: 50 × 70 mm',
    w: 50,
    h: 70,
    headMin: 31,
    headMax: 36,
    note: 'Canadian passport photos are taller than most: 50 × 70 mm with a 31–36 mm face.',
  },
  {
    id: 'au',
    label: 'Australia / New Zealand: 35 × 45 mm',
    w: 35,
    h: 45,
    headMin: 32,
    headMax: 36,
    note: 'Australian and New Zealand passports use the 35 × 45 mm ICAO layout.',
  },
  {
    id: 'jp',
    label: 'Japan: 35 × 45 mm',
    w: 35,
    h: 45,
    headMin: 32,
    headMax: 36,
    note: 'Japanese passport photos: 35 × 45 mm, head 32–36 mm, taken within the last six months.',
  },
  {
    id: 'custom',
    label: 'Custom size',
    w: 35,
    h: 45,
    headMin: 30,
    headMax: 36,
    note: 'Enter the exact millimetre size your form asks for.',
  },
]

const FRAME_W = 420 // preview frame width in CSS pixels

interface Transform {
  zoom: number
  /** Pan, in fractions of the frame. */
  ox: number
  oy: number
}

function drawPhoto(
  bitmap: ImageBitmap,
  outW: number,
  outH: number,
  t: Transform,
  background: string,
): HTMLCanvasElement {
  const canvas = makeCanvas(outW, outH)
  const ctx = ctx2d(canvas)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, outW, outH)
  const cover = Math.max(outW / bitmap.width, outH / bitmap.height)
  const scale = cover * t.zoom
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  const x = (outW - w) / 2 + t.ox * outW
  const y = (outH - h) / 2 + t.oy * outH
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, x, y, w, h)
  return canvas
}

/**
 * Flood-fill the background to pure white, starting from the border pixels.
 *
 * This is a deliberately simple, explainable operation — not AI segmentation.
 * It works when the wall behind you is already fairly plain and evenly lit,
 * which is exactly the situation the guidance asks you to create.
 */
function whitenBackground(data: ImageData, tolerance: number): ImageData {
  const { width, height } = data
  const px = data.data
  const out = new Uint8ClampedArray(px)
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0

  // Seed colour: the average of the four corners plus the edge midpoints.
  const seeds = [
    0,
    width - 1,
    (height - 1) * width,
    height * width - 1,
    Math.floor(width / 2),
    (height - 1) * width + Math.floor(width / 2),
  ]
  let sr = 0
  let sg = 0
  let sb = 0
  for (const s of seeds) {
    sr += px[s * 4] as number
    sg += px[s * 4 + 1] as number
    sb += px[s * 4 + 2] as number
  }
  sr /= seeds.length
  sg /= seeds.length
  sb /= seeds.length

  const limit = (tolerance / 100) * 441.67 // max possible RGB distance
  const push = (index: number) => {
    if (visited[index]) return
    const r = px[index * 4] as number
    const g = px[index * 4 + 1] as number
    const b = px[index * 4 + 2] as number
    const dist = Math.sqrt((r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2)
    if (dist > limit) return
    visited[index] = 1
    queue[tail++] = index
  }

  for (let x = 0; x < width; x++) {
    push(x)
    push((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    push(y * width)
    push(y * width + width - 1)
  }

  while (head < tail) {
    const index = queue[head++] as number
    out[index * 4] = 255
    out[index * 4 + 1] = 255
    out[index * 4 + 2] = 255
    out[index * 4 + 3] = 255
    const x = index % width
    const y = (index / width) | 0
    if (x > 0) push(index - 1)
    if (x < width - 1) push(index + 1)
    if (y > 0) push(index - width)
    if (y < height - 1) push(index + width)
  }

  return new ImageData(out, width, height)
}

export default function PassportPhotoMaker() {
  const [presetId, setPresetId] = useState('us')
  const [customW, setCustomW] = useState(35)
  const [customH, setCustomH] = useState(45)
  const [dpi, setDpi] = useState(300)
  const [transform, setTransform] = useState<Transform>({ zoom: 1, ox: 0, oy: 0 })
  const [headTop, setHeadTop] = useState(8) // % of frame height
  const [headBottom, setHeadBottom] = useState(78) // % of frame height (chin)
  const [whiten, setWhiten] = useState(false)
  const [tolerance, setTolerance] = useState(22)
  const [showGuides, setShowGuides] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [single, setSingle] = useState<{ blob: Blob; name: string; url: string } | null>(null)
  const [sheet, setSheet] = useState<{ blob: Blob; name: string; url: string } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const outputsRef = useRef<{ single: typeof single; sheet: typeof sheet }>({ single: null, sheet: null })
  outputsRef.current = { single, sheet }

  useEffect(
    () => () => {
      if (outputsRef.current.single) URL.revokeObjectURL(outputsRef.current.single.url)
      if (outputsRef.current.sheet) URL.revokeObjectURL(outputsRef.current.sheet.url)
    },
    [],
  )

  const preset = PRESETS.find((p) => p.id === presetId) ?? (PRESETS[0] as Preset)
  const sizeMm = presetId === 'custom' ? { w: customW, h: customH } : { w: preset.w, h: preset.h }
  const outPx = { w: mmToPx(sizeMm.w, dpi), h: mmToPx(sizeMm.h, dpi) }
  const frameH = Math.round((FRAME_W * sizeMm.h) / sizeMm.w)

  const headMmNow = ((headBottom - headTop) / 100) * sizeMm.h
  const headOk = headMmNow >= preset.headMin - 0.5 && headMmNow <= preset.headMax + 0.5

  const clearOutputs = useCallback(() => {
    setSingle((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
    setSheet((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }, [])

  const onFiles = useCallback(
    async (incoming: File[]) => {
      const next = incoming[0]
      if (!next) return
      setError(null)
      clearOutputs()
      try {
        const decoded = await decodePhoto(next)
        setBitmap((prev) => {
          prev?.close()
          return decoded.bitmap
        })
        setFile(next)
        setTransform({ zoom: 1, ox: 0, oy: 0 })
        setStatus(`Loaded ${next.name} (${decoded.width}×${decoded.height} px).`)
      } catch (err) {
        setError(photoError(err, 'That photo could not be opened.'))
      }
    },
    [clearOutputs],
  )

  /* Preview repaint. */
  useEffect(() => {
    const target = canvasRef.current
    if (!target || !bitmap) return
    target.width = FRAME_W
    target.height = frameH
    const rendered = drawPhoto(bitmap, FRAME_W, frameH, transform, '#ffffff')
    const ctx = target.getContext('2d')
    if (!ctx) return
    ctx.drawImage(rendered, 0, 0)

    if (!showGuides) return
    ctx.save()
    // Guides are black dashes on a white line, so they show on any photo.
    const topY = (headTop / 100) * frameH
    const bottomY = (headBottom / 100) * frameH
    const guides = new Path2D()
    guides.moveTo(0, topY)
    guides.lineTo(FRAME_W, topY)
    guides.moveTo(0, bottomY)
    guides.lineTo(FRAME_W, bottomY)
    const centre = new Path2D()
    centre.moveTo(FRAME_W / 2, 0)
    centre.lineTo(FRAME_W / 2, frameH)
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#ffffff'
    ctx.stroke(guides)
    ctx.strokeStyle = '#000000'
    ctx.setLineDash([6, 4])
    ctx.stroke(guides)
    ctx.lineWidth = 1
    ctx.setLineDash([])
    ctx.strokeStyle = '#ffffff'
    ctx.stroke(centre)
    ctx.strokeStyle = '#000000'
    ctx.setLineDash([2, 4])
    ctx.stroke(centre)
    ctx.setLineDash([])
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#ffffff'
    ctx.fillStyle = '#000000'
    for (const [label, y] of [
      ['crown', Math.max(12, topY - 5)],
      ['chin', Math.min(frameH - 4, bottomY + 14)],
    ] as const) {
      ctx.strokeText(label, 6, y)
      ctx.fillText(label, 6, y)
    }
    ctx.restore()
  }, [bitmap, transform, frameH, headTop, headBottom, showGuides])

  /* Dragging pans the photo behind the fixed crop frame. */
  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: transform.ox,
      oy: transform.oy,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    const canvas = canvasRef.current
    if (!drag || !canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0) return
    clearOutputs()
    setTransform((prev) => ({
      ...prev,
      ox: drag.ox + (event.clientX - drag.x) / rect.width,
      oy: drag.oy + (event.clientY - drag.y) / rect.height,
    }))
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
  }

  async function renderFinal(): Promise<HTMLCanvasElement> {
    if (!bitmap) throw new Error('Add a photo first.')
    const canvas = drawPhoto(bitmap, outPx.w, outPx.h, transform, '#ffffff')
    if (whiten) {
      const ctx = ctx2d(canvas, { willReadFrequently: true })
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
      ctx.putImageData(whitenBackground(data, tolerance), 0, 0)
    }
    return canvas
  }

  async function exportSingle() {
    if (!bitmap || !file) return
    setBusy(true)
    setError(null)
    setStatus('Rendering at print resolution…')
    try {
      await nextFrame()
      const canvas = await renderFinal()
      const raw = await encodePhotoCanvas(canvas, 'jpeg', 0.95)
      const blob = await setBlobDensity(raw, dpi)
      const name = `passport-photo-${Math.round(sizeMm.w)}x${Math.round(sizeMm.h)}mm-${dpi}dpi.jpg`
      setSingle((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return { blob, name, url: URL.createObjectURL(blob) }
      })
      setStatus(`Photo ready: ${canvas.width}×${canvas.height} px at ${dpi} DPI, ${formatBytes(blob.size)}.`)
      downloadBlob(blob, name)
    } catch (err) {
      setError(photoError(err, 'Could not render the photo.'))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  async function exportSheet() {
    if (!bitmap || !file) return
    setBusy(true)
    setError(null)
    setStatus('Laying out the 6 × 4 inch print sheet…')
    try {
      await nextFrame()
      const photo = await renderFinal()
      const sheetW = mmToPx(152.4, dpi) // 6 in
      const sheetH = mmToPx(101.6, dpi) // 4 in
      const margin = mmToPx(4, dpi)
      const gap = mmToPx(3, dpi)
      const canvas = makeCanvas(sheetW, sheetH)
      const ctx = ctx2d(canvas)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, sheetW, sheetH)
      const cols = Math.max(1, Math.floor((sheetW - 2 * margin + gap) / (photo.width + gap)))
      const rows = Math.max(1, Math.floor((sheetH - 2 * margin + gap) / (photo.height + gap)))
      const totalW = cols * photo.width + (cols - 1) * gap
      const totalH = rows * photo.height + (rows - 1) * gap
      const startX = (sheetW - totalW) / 2
      const startY = (sheetH - totalH) / 2
      ctx.strokeStyle = '#c8c8c8'
      ctx.lineWidth = Math.max(1, Math.round(dpi / 300))
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = startX + c * (photo.width + gap)
          const y = startY + r * (photo.height + gap)
          ctx.drawImage(photo, x, y)
          ctx.strokeRect(x + 0.5, y + 0.5, photo.width - 1, photo.height - 1)
        }
      }
      const raw = await encodePhotoCanvas(canvas, 'jpeg', 0.95)
      const blob = await setBlobDensity(raw, dpi)
      const name = `passport-photo-sheet-6x4in-${cols * rows}up.jpg`
      setSheet((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return { blob, name, url: URL.createObjectURL(blob) }
      })
      setStatus(
        `Sheet ready: ${cols * rows} copies on 6 × 4 in at ${dpi} DPI (${formatBytes(blob.size)}). Print at 100%, no “fit to page”.`,
      )
      downloadBlob(blob, name)
    } catch (err) {
      setError(photoError(err, 'Could not build the print sheet.'))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    clearOutputs()
    setBitmap((prev) => {
      prev?.close()
      return null
    })
    setFile(null)
    setTransform({ zoom: 1, ox: 0, oy: 0 })
    setStatus('')
    setError(null)
  }

  const megapixelWarning = useMemo(() => {
    if (!bitmap) return null
    const needed = Math.max(outPx.w, outPx.h)
    const have = Math.min(bitmap.width, bitmap.height)
    if (have < needed) {
      return `Your photo is ${bitmap.width}×${bitmap.height} px. A ${sizeMm.w} × ${sizeMm.h} mm print at ${dpi} DPI needs at least ${outPx.w}×${outPx.h} px, so the output will be upscaled and may look soft. Use a larger original if you can.`
    }
    return null
  }, [bitmap, outPx.w, outPx.h, sizeMm.w, sizeMm.h, dpi])

  return (
    <div className="space-y-6">
      {!bitmap && (
        <FileDropzone
          accept={PHOTO_ACCEPT}
          onFiles={onFiles}
          maxSizeMb={100}
          title="Drop a head-and-shoulders photo"
          hint="Face the camera, with a plain wall behind you and no shadows. The photo is cropped on your device"
        />
      )}

      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}

      {bitmap && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <ToolPanel
            title="Position the face"
            description="Drag the photo to move it, and use the zoom slider to size the head. Line the crown and chin up with the two dashed guides."
          >
            <div className="flex justify-center overflow-hidden rounded-lg bg-muted p-4">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label="Passport photo crop preview with crown and chin guides"
                className="max-w-full cursor-move touch-none rounded border border-border"
                style={{ width: FRAME_W, maxWidth: '100%', aspectRatio: `${sizeMm.w} / ${sizeMm.h}` }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            </div>

            <div className="space-y-2">
              <Label id="pp-zoom-label" className="flex items-center gap-2">
                <Move className="size-4" aria-hidden="true" /> Zoom: {transform.zoom.toFixed(2)}×
              </Label>
              <Slider
                aria-labelledby="pp-zoom-label"
                min={0.5}
                max={4}
                step={0.01}
                value={[transform.zoom]}
                onValueChange={(v) => {
                  clearOutputs()
                  setTransform((prev) => ({ ...prev, zoom: v[0] ?? 1 }))
                }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label id="pp-crown-label">Crown guide: {headTop}% from top</Label>
                <Slider
                  aria-labelledby="pp-crown-label"
                  min={0}
                  max={40}
                  step={0.5}
                  value={[headTop]}
                  onValueChange={(v) => setHeadTop(Math.min(v[0] ?? 8, headBottom - 5))}
                />
              </div>
              <div className="space-y-2">
                <Label id="pp-chin-label">Chin guide: {headBottom}% from top</Label>
                <Slider
                  aria-labelledby="pp-chin-label"
                  min={40}
                  max={100}
                  step={0.5}
                  value={[headBottom]}
                  onValueChange={(v) => setHeadBottom(Math.max(v[0] ?? 78, headTop + 5))}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ResultStat
                label="Head height in the crop"
                value={`${headMmNow.toFixed(1)} mm`}
                hint={`Required: ${preset.headMin}–${preset.headMax} mm`}
                emphasis
              />
              <ResultStat
                label="Requirement check"
                value={headOk ? 'Within range' : 'Out of range'}
                hint={
                  headOk
                    ? 'The crown and chin guides sit inside the official band.'
                    : 'Move the guides or zoom until the head height falls inside the band.'
                }
              />
              <ResultStat
                label="Output"
                value={`${outPx.w} × ${outPx.h} px`}
                hint={`${sizeMm.w} × ${sizeMm.h} mm at ${dpi} DPI`}
              />
            </div>

            {!headOk && (
              <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-foreground">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  The head currently measures {headMmNow.toFixed(1)} mm, outside the{' '}
                  {preset.headMin}–{preset.headMax} mm range for this document. Zoom in or out until the
                  dashed guides sit on the crown of the head and the bottom of the chin, then re-check.
                </span>
              </p>
            )}

            {megapixelWarning && (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                {megapixelWarning}
              </p>
            )}
          </ToolPanel>

          <ToolPanel
            title="Document"
            footer={
              <div className="flex w-full flex-col gap-2">
                <Button size="lg" className="w-full" onClick={exportSingle} disabled={busy}>
                  <Download className="size-4" aria-hidden="true" />
                  {busy ? 'Working…' : 'Download single photo'}
                </Button>
                <Button size="lg" variant="outline" className="w-full" onClick={exportSheet} disabled={busy}>
                  <Printer className="size-4" aria-hidden="true" /> Download 6 × 4 in print sheet
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pp-preset">Country / document</Label>
                <Select
                  value={presetId}
                  onValueChange={(v) => {
                    clearOutputs()
                    setPresetId(v)
                  }}
                >
                  <SelectTrigger id="pp-preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{preset.note}</p>
              </div>

              {presetId === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="pp-w">Width (mm)</Label>
                    <Input
                      id="pp-w"
                      type="number"
                      min={10}
                      max={200}
                      value={customW}
                      onChange={(e) => {
                        clearOutputs()
                        setCustomW(safeNumber(Number(e.target.value), 10, 200, 35))
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pp-h">Height (mm)</Label>
                    <Input
                      id="pp-h"
                      type="number"
                      min={10}
                      max={200}
                      value={customH}
                      onChange={(e) => {
                        clearOutputs()
                        setCustomH(safeNumber(Number(e.target.value), 10, 200, 45))
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="pp-dpi">Print resolution</Label>
                <Select
                  value={String(dpi)}
                  onValueChange={(v) => {
                    clearOutputs()
                    setDpi(Number(v))
                  }}
                >
                  <SelectTrigger id="pp-dpi">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="300">300 DPI (standard for passport photos)</SelectItem>
                    <SelectItem value="600">600 DPI (extra sharp, larger file)</SelectItem>
                    <SelectItem value="200">200 DPI (only if a portal caps the file size)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md bg-muted p-3">
                <div>
                  <Label htmlFor="pp-guides">Show crop guides</Label>
                  <p className="text-xs text-muted-foreground">Guides are never exported.</p>
                </div>
                <Switch id="pp-guides" checked={showGuides} onCheckedChange={setShowGuides} />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md bg-muted p-3">
                <div>
                  <Label htmlFor="pp-whiten" className="flex items-center gap-2">
                    <SprayCan className="size-4" aria-hidden="true" /> Whiten the background
                  </Label>
                  <p className="text-xs text-muted-foreground">Uses an edge flood fill. There is no AI cut-out.</p>
                </div>
                <Switch
                  id="pp-whiten"
                  checked={whiten}
                  onCheckedChange={(v) => {
                    clearOutputs()
                    setWhiten(v)
                  }}
                />
              </div>

              {whiten && (
                <div className="space-y-2">
                  <Label id="pp-tol-label">Colour tolerance: {tolerance}%</Label>
                  <Slider
                    aria-labelledby="pp-tol-label"
                    min={2}
                    max={60}
                    step={1}
                    value={[tolerance]}
                    onValueChange={(v) => {
                      clearOutputs()
                      setTolerance(v[0] ?? 22)
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Raise it until the wall turns white; lower it the moment hair or shoulders start
                    disappearing. The fill only spreads inwards from the edges, so it cannot eat an
                    enclosed area of your face.
                  </p>
                </div>
              )}

              <Button type="button" variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="size-4" aria-hidden="true" /> Use a different photo
              </Button>
            </div>
          </ToolPanel>
        </div>
      )}

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>

      {(single || sheet) && (
        <ToolPanel title="Ready to print or upload">
          <div className="grid gap-4 sm:grid-cols-2">
            {single && (
              <div className="space-y-2 rounded-lg bg-muted p-3">
                <img src={single.url} alt="Single passport photo" className="max-h-48 w-auto rounded border border-border" />
                <p className="text-sm font-medium">{single.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(single.blob.size)}</p>
                <Button type="button" size="sm" onClick={() => downloadBlob(single.blob, single.name)}>
                  <Download className="size-4" aria-hidden="true" /> Download again
                </Button>
              </div>
            )}
            {sheet && (
              <div className="space-y-2 rounded-lg bg-muted p-3">
                <img src={sheet.url} alt="6 by 4 inch sheet of passport photos" className="max-h-48 w-auto rounded border border-border" />
                <p className="text-sm font-medium">{sheet.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(sheet.blob.size)}</p>
                <Button type="button" size="sm" onClick={() => downloadBlob(sheet.blob, sheet.name)}>
                  <Download className="size-4" aria-hidden="true" /> Download again
                </Button>
              </div>
            )}
          </div>
        </ToolPanel>
      )}
    </div>
  )
}
