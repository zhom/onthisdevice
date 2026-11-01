import { useEffect, useMemo, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { clamp, downloadBlob, formatBytes } from '@/lib/utils'
import { ColorField, Field, NumberSlider, SegmentedField } from './GenUi'
import { contrastRatio, parseColor, readableTextOn, toHex } from './colorlib'

type Format = 'png' | 'svg' | 'webp'

const FORMAT_OPTIONS: { value: Format; label: string; title: string }[] = [
  { value: 'png', label: 'PNG', title: 'Lossless raster: works everywhere' },
  { value: 'svg', label: 'SVG', title: 'Vector: a few hundred bytes at any size' },
  { value: 'webp', label: 'WebP', title: 'Smaller raster, supported by every current browser' },
]

interface Preset {
  label: string
  width: number
  height: number
  note: string
}

const PRESETS: Preset[] = [
  { label: 'Open Graph', width: 1200, height: 630, note: 'Facebook, LinkedIn, Slack link previews' },
  { label: 'Twitter card', width: 1200, height: 675, note: 'summary_large_image' },
  { label: 'Square', width: 1080, height: 1080, note: 'Instagram feed, product tile' },
  { label: 'Hero', width: 1920, height: 1080, note: 'Full-width banner, 16:9' },
  { label: 'Thumbnail', width: 400, height: 300, note: 'Card image, 4:3' },
  { label: 'Avatar', width: 256, height: 256, note: 'Profile picture' },
  { label: 'Leaderboard', width: 728, height: 90, note: 'IAB display ad' },
  { label: 'MPU', width: 300, height: 250, note: 'IAB medium rectangle' },
]

const MAX_EDGE = 4000

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function gridStep(width: number, height: number): number {
  const min = Math.min(width, height)
  if (min >= 1200) return 100
  if (min >= 600) return 50
  if (min >= 240) return 25
  return 10
}

interface DrawOptions {
  width: number
  height: number
  background: string
  foreground: string
  text: string
  grid: boolean
  fontSize: number
}

function draw(canvas: HTMLCanvasElement, options: DrawOptions): void {
  const { width, height, background, foreground, text, grid, fontSize } = options
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser would not provide the 2D canvas the generator needs.')

  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  if (grid) {
    const step = gridStep(width, height)
    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.strokeStyle = foreground
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = step; x < width; x += step) {
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, height)
    }
    for (let y = step; y < height; y += step) {
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(width, y + 0.5)
    }
    ctx.stroke()
    ctx.globalAlpha = 0.32
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(width, height)
    ctx.moveTo(width, 0)
    ctx.lineTo(0, height)
    ctx.stroke()
    ctx.restore()
  }

  if (text.trim().length > 0) {
    ctx.fillStyle = foreground
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = text.split('\n')
    ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
    const lineHeight = fontSize * 1.25
    const start = height / 2 - ((lines.length - 1) * lineHeight) / 2
    lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, start + index * lineHeight)
    })
  }
}

function buildSvg(options: DrawOptions): string {
  const { width, height, background, foreground, text, grid, fontSize } = options
  const parts: string[] = []
  parts.push(`<rect width="${width}" height="${height}" fill="${background}"/>`)

  if (grid) {
    const step = gridStep(width, height)
    const lines: string[] = []
    for (let x = step; x < width; x += step) lines.push(`M${x} 0V${height}`)
    for (let y = step; y < height; y += step) lines.push(`M0 ${y}H${width}`)
    parts.push(
      `<path d="${lines.join('')}" stroke="${foreground}" stroke-opacity="0.18" stroke-width="1" fill="none"/>`,
    )
    parts.push(
      `<path d="M0 0L${width} ${height}M${width} 0L0 ${height}" stroke="${foreground}" stroke-opacity="0.32" stroke-width="1" fill="none"/>`,
    )
  }

  if (text.trim().length > 0) {
    const lines = text.split('\n')
    const lineHeight = fontSize * 1.25
    const start = height / 2 - ((lines.length - 1) * lineHeight) / 2
    const tspans = lines
      .map((line, index) => `<tspan x="${width / 2}" y="${start + index * lineHeight}">${escapeXml(line)}</tspan>`)
      .join('')
    parts.push(
      `<text font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="${fontSize}" font-weight="600" fill="${foreground}" text-anchor="middle" dominant-baseline="middle">${tspans}</text>`,
    )
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(
    text || `${width} by ${height} placeholder`,
  )}">${parts.join('')}</svg>`
}

export default function PlaceholderImageGenerator() {
  const [width, setWidth] = useState(1200)
  const [height, setHeight] = useState(630)
  const [background, setBackground] = useState('#e2e8f0')
  const [foreground, setForeground] = useState('#334155')
  const [customText, setCustomText] = useState('')
  const [autoText, setAutoText] = useState(true)
  const [grid, setGrid] = useState(true)
  const [format, setFormat] = useState<Format>('png')
  const [fontScale, setFontScale] = useState(100)
  const [dataUri, setDataUri] = useState('')
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const safeWidth = clamp(Math.round(width) || 1, 1, MAX_EDGE)
  const safeHeight = clamp(Math.round(height) || 1, 1, MAX_EDGE)

  const bgHex = useMemo(
    () => toHex(parseColor(background) ?? { r: 226, g: 232, b: 240, a: 1 }),
    [background],
  )
  const fgHex = useMemo(
    () => toHex(parseColor(foreground) ?? { r: 51, g: 65, b: 85, a: 1 }),
    [foreground],
  )

  const text = autoText ? `${safeWidth} × ${safeHeight}` : customText
  const baseFont = Math.max(10, Math.round(Math.min(safeWidth, safeHeight) * 0.14))
  const fontSize = Math.max(8, Math.round((baseFont * fontScale) / 100))

  const options = useMemo<DrawOptions>(
    () => ({
      width: safeWidth,
      height: safeHeight,
      background: bgHex,
      foreground: fgHex,
      text,
      grid,
      fontSize,
    }),
    [safeWidth, safeHeight, bgHex, fgHex, text, grid, fontSize],
  )

  const svg = useMemo(() => buildSvg(options), [options])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      draw(canvas, options)
      setError(null)
      if (format === 'svg') {
        setDataUri(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
      } else {
        setDataUri(canvas.toDataURL(format === 'webp' ? 'image/webp' : 'image/png'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The placeholder could not be drawn.')
    }
  }, [options, format, svg])

  const ratio = contrastRatio(
    parseColor(fgHex) ?? { r: 0, g: 0, b: 0, a: 1 },
    parseColor(bgHex) ?? { r: 255, g: 255, b: 255, a: 1 },
  )

  const download = () => {
    const filename = `placeholder-${safeWidth}x${safeHeight}`
    if (format === 'svg') {
      downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(
      (blob) => {
        if (blob) downloadBlob(blob, `${filename}.${format}`)
        else setError('The browser could not encode this image. Try the PNG format instead.')
      },
      format === 'webp' ? 'image/webp' : 'image/png',
    )
  }

  const uriBytes = new Blob([dataUri]).size
  const htmlSnippet = `<img src="${dataUri}" width="${safeWidth}" height="${safeHeight}" alt="">`

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <ToolPanel title="Size">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Width" htmlFor="ph-width">
                <Input
                  id="ph-width"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_EDGE}
                  value={String(width)}
                  onChange={(event) => setWidth(Number.parseInt(event.target.value, 10) || 0)}
                  className="tabular-nums"
                />
              </Field>
              <Field label="Height" htmlFor="ph-height">
                <Input
                  id="ph-height"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_EDGE}
                  value={String(height)}
                  onChange={(event) => setHeight(Number.parseInt(event.target.value, 10) || 0)}
                  className="tabular-nums"
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant={safeWidth === preset.width && safeHeight === preset.height ? 'secondary' : 'outline'}
                  size="sm"
                  title={`${preset.width} × ${preset.height}: ${preset.note}`}
                  onClick={() => {
                    setWidth(preset.width)
                    setHeight(preset.height)
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Aspect ratio {(safeWidth / safeHeight).toFixed(3)}:1. Maximum edge is {MAX_EDGE} px, which
              keeps the data URI usable.
            </p>
          </ToolPanel>

          <ToolPanel title="Style">
            <ColorField label="Background" value={background} onChange={setBackground} />
            <ColorField
              label="Text and grid"
              value={foreground}
              onChange={setForeground}
              trailing={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForeground(readableTextOn(parseColor(bgHex) ?? { r: 255, g: 255, b: 255, a: 1 }))}
                >
                  Auto
                </Button>
              }
              hint={
                ratio < 3
                  ? `Contrast is only ${ratio.toFixed(2)}:1. The label will be hard to read.`
                  : `Contrast ${ratio.toFixed(2)}:1.`
              }
            />

            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
              <div className="min-w-0">
                <Label htmlFor="ph-grid" className="text-sm">
                  Grid and cross
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Makes it obvious at a glance that the image is a stand-in, and shows the layout
                  box it occupies.
                </p>
              </div>
              <Switch id="ph-grid" checked={grid} onCheckedChange={setGrid} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
              <div className="min-w-0">
                <Label htmlFor="ph-auto" className="text-sm">
                  Label with the dimensions
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Prints “{safeWidth} × {safeHeight}” and keeps it in step with the size fields.
                </p>
              </div>
              <Switch id="ph-auto" checked={autoText} onCheckedChange={setAutoText} />
            </div>

            {!autoText ? (
              <Field label="Custom text" htmlFor="ph-text" hint="Press Enter for a second line.">
                <Textarea
                  id="ph-text"
                  rows={2}
                  value={customText}
                  onChange={(event) => setCustomText(event.target.value)}
                  placeholder="Hero image"
                />
              </Field>
            ) : null}

            <NumberSlider
              label="Text size"
              value={fontScale}
              onChange={setFontScale}
              min={20}
              max={250}
              unit="%"
              hint={`Rendered at ${fontSize} px.`}
            />
          </ToolPanel>

          <ToolPanel title="Format">
            <SegmentedField label="Output format" value={format} options={FORMAT_OPTIONS} onChange={setFormat} />
            <p className="text-xs text-pretty text-muted-foreground">
              {format === 'svg'
                ? 'SVG stays sharp at any zoom and is usually under a kilobyte, which makes it the best choice for an inline data URI.'
                : format === 'webp'
                  ? 'WebP is typically 25–35% smaller than the same PNG. Every browser released since 2020 reads it.'
                  : 'PNG is lossless and universally supported, including in email clients and older tooling.'}
            </p>
          </ToolPanel>
        </div>

        <div className="flex flex-col gap-6">
          <ToolPanel title="Preview" description={`${safeWidth} × ${safeHeight} px, shown scaled to fit.`}>
            {error ? <ErrorNote message={error} /> : null}
            <div className="overflow-hidden rounded-lg bg-muted p-3">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Placeholder image, ${safeWidth} by ${safeHeight} pixels`}
                className="mx-auto block h-auto max-h-[420px] w-auto max-w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={download}>
                Download {format.toUpperCase()}
              </Button>
              <CopyButton value={dataUri} label="Copy data URI" />
              <CopyButton value={htmlSnippet} label="Copy <img> tag" />
              {format === 'svg' ? <CopyButton value={svg} label="Copy SVG source" /> : null}
            </div>
          </ToolPanel>

          <ToolPanel
            title="Data URI"
            description={`${formatBytes(uriBytes)}. A data URI is about a third larger than the file it carries, because Base64 spends four characters on every three bytes.`}
          >
            <div className="max-h-40 overflow-auto rounded-lg bg-muted p-3">
              <code className="font-mono text-[11.5px] leading-relaxed break-all text-muted-foreground">
                {dataUri.slice(0, 4000)}
                {dataUri.length > 4000 ? '…' : ''}
              </code>
            </div>
            {uriBytes > 30_000 ? (
              <p className="flex items-start gap-1.5 text-xs text-pretty text-foreground">
                <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  This data URI is large. Inlining more than about 30 KB usually costs more than it
                  saves. Link the file instead, or switch to the SVG format.
                </span>
              </p>
            ) : null}
          </ToolPanel>
        </div>
      </div>
    </div>
  )
}
