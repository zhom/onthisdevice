import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Palette, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { Field } from './DevUi'
import type { Rgba } from './colorlib'
import {
  composite,
  contrastRatio,
  mix,
  parseColor,
  rgbToHsl,
  rgbToOklch,
  hslToRgb,
  toCmykString,
  toHex,
  toHslString,
  toHsvString,
  toOklchString,
  toRgbString,
} from './colorlib'

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 }
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 }
const DEFAULT: Rgba = { r: 59, g: 130, b: 246, a: 1 }

interface ContrastCheck {
  label: string
  threshold: number
  note: string
}

const CHECKS: ContrastCheck[] = [
  { label: 'AA · normal text', threshold: 4.5, note: 'Body copy below 18pt (24px), or below 14pt bold' },
  { label: 'AA · large text', threshold: 3, note: '18pt (24px) and up, or 14pt (18.66px) bold and up' },
  { label: 'AA · UI components', threshold: 3, note: 'Icons, borders and focus rings that convey meaning' },
  { label: 'AAA · normal text', threshold: 7, note: 'The enhanced level for body copy' },
  { label: 'AAA · large text', threshold: 4.5, note: 'The enhanced level for headings' },
]

function FormatRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <TableRow>
      <TableCell className="align-middle whitespace-nowrap font-medium">{label}</TableCell>
      <TableCell className="align-middle">
        <code className="break-all font-mono text-[13px]">{value}</code>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </TableCell>
      <TableCell className="text-right align-middle">
        <CopyButton value={value} label="Copy" />
      </TableCell>
    </TableRow>
  )
}

function Swatch({
  color,
  label,
  onSelect,
}: {
  color: Rgba
  label: string
  onSelect: (hex: string) => void
}) {
  const hex = toHex(color)
  return (
    <button
      type="button"
      onClick={() => onSelect(hex)}
      title={`${label}: ${hex}`}
      className="group flex min-w-0 flex-1 flex-col items-stretch gap-1 focus-visible:outline-none"
    >
      <span
        className="h-10 w-full rounded-md border border-border transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background"
        style={{ backgroundColor: hex }}
        aria-hidden="true"
      />
      <span className="truncate font-mono text-[10px] text-muted-foreground">{hex}</span>
      <span className="sr-only">
        Use {label} {hex}
      </span>
    </button>
  )
}

export default function ColorConverter() {
  const [input, setInput] = useState('#3b82f6')
  const [color, setColor] = useState<Rgba>(DEFAULT)
  const [background, setBackground] = useState('#ffffff')

  const parsed = useMemo(() => parseColor(input), [input])
  useEffect(() => {
    if (parsed) setColor(parsed)
  }, [parsed])

  const bgParsed = useMemo(() => parseColor(background) ?? WHITE, [background])

  const hsl = useMemo(() => rgbToHsl(color), [color])
  const oklch = useMemo(() => rgbToOklch(color), [color])

  const flattened = useMemo(() => composite(color, bgParsed), [color, bgParsed])
  const ratio = useMemo(() => contrastRatio(flattened, bgParsed), [flattened, bgParsed])
  const ratioWhite = useMemo(() => contrastRatio(composite(color, WHITE), WHITE), [color])
  const ratioBlack = useMemo(() => contrastRatio(composite(color, BLACK), BLACK), [color])

  const tints = useMemo(
    () => Array.from({ length: 10 }, (_, i) => mix(color, WHITE, (i + 1) / 11)),
    [color],
  )
  const shades = useMemo(
    () => Array.from({ length: 10 }, (_, i) => mix(color, BLACK, (i + 1) / 11)),
    [color],
  )

  const setChannel = useCallback(
    (key: 'r' | 'g' | 'b', value: number) => {
      setInput(toHex({ ...color, [key]: value }))
    },
    [color],
  )

  const setAlpha = useCallback(
    (value: number) => {
      setInput(toHex({ ...color, a: value }, value < 1))
    },
    [color],
  )

  const setHslPart = useCallback(
    (key: 'h' | 's' | 'l', value: number) => {
      const next = { ...hsl, [key]: value }
      const rgb = hslToRgb(next.h, next.s, next.l)
      setInput(toHex({ ...rgb, a: color.a }, color.a < 1))
    },
    [hsl, color.a],
  )

  const invalid = input.trim().length > 0 && parsed === null

  return (
    <div className="flex flex-col gap-4">
      <ToolPanel
        title="Colour input"
        description="Type or paste any of: #hex, rgb(), rgba(), hsl(), hsv(), oklch(), cmyk(), or a CSS colour name."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Colour value" htmlFor="color-input" className="flex-1">
            <Input
              id="color-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="#3b82f6"
              className="font-mono"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-invalid={invalid}
            />
          </Field>
          <Field label="Pick" htmlFor="color-picker" className="sm:w-28">
            <Input
              id="color-picker"
              type="color"
              value={toHex({ ...color, a: 1 })}
              onChange={(event) => setInput(event.target.value)}
              className="h-9 w-full cursor-pointer p-1"
            />
          </Field>
        </div>

        {invalid ? (
          <ErrorNote
            title="Not a colour I recognise"
            message="Try a form like #1a2b3c, rgb(26 43 60), hsl(210 40% 17%), oklch(30% 0.05 250), cmyk(57%, 28%, 0%, 76%) or a name such as rebeccapurple."
          />
        ) : null}

        <div
          className="flex min-h-24 flex-col items-start justify-end gap-1 rounded-lg border border-border p-4"
          style={{ backgroundColor: toHex(color, color.a < 1) }}
        >
          <span
            className="rounded px-2 py-1 font-mono text-sm"
            style={{
              backgroundColor: toHex(flattened),
              color: ratioWhite >= ratioBlack ? '#ffffff' : '#000000',
            }}
          >
            {toHex(color, color.a < 1)}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-lg bg-muted p-3">
            <span className="text-sm font-medium">RGB channels</span>
            {(['r', 'g', 'b'] as const).map((key) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-6 font-mono text-xs text-muted-foreground">{key}</span>
                <Slider
                  min={0}
                  max={255}
                  step={1}
                  value={[color[key]]}
                  onValueChange={(v) => setChannel(key, v[0])}
                  className="flex-1"
                  aria-label={`${key.toUpperCase()} channel`}
                />
                <span className="w-10 text-right font-mono text-xs tabular-nums">{color[key]}</span>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <span className="w-6 font-mono text-xs text-muted-foreground">α</span>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[color.a]}
                onValueChange={(v) => setAlpha(v[0])}
                className="flex-1"
                aria-label="Alpha channel"
              />
              <span className="w-10 text-right font-mono text-xs tabular-nums">
                {color.a.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg bg-muted p-3">
            <span className="text-sm font-medium">HSL</span>
            <div className="flex items-center gap-3">
              <span className="w-6 font-mono text-xs text-muted-foreground">H</span>
              <Slider
                min={0}
                max={360}
                step={1}
                value={[Math.round(hsl.h)]}
                onValueChange={(v) => setHslPart('h', v[0])}
                className="flex-1"
                aria-label="Hue"
              />
              <span className="w-10 text-right font-mono text-xs tabular-nums">
                {Math.round(hsl.h)}°
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 font-mono text-xs text-muted-foreground">S</span>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[Math.round(hsl.s * 100)]}
                onValueChange={(v) => setHslPart('s', v[0] / 100)}
                className="flex-1"
                aria-label="Saturation"
              />
              <span className="w-10 text-right font-mono text-xs tabular-nums">
                {Math.round(hsl.s * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 font-mono text-xs text-muted-foreground">L</span>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[Math.round(hsl.l * 100)]}
                onValueChange={(v) => setHslPart('l', v[0] / 100)}
                className="flex-1"
                aria-label="Lightness"
              />
              <span className="w-10 text-right font-mono text-xs tabular-nums">
                {Math.round(hsl.l * 100)}%
              </span>
            </div>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel title="Every format" description="Rounded for display; the underlying conversion is done at full precision.">
        <div className="overflow-x-auto rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Format</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-24 text-right">
                  <span className="sr-only">Copy</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <FormatRow label="HEX" value={toHex(color)} />
              <FormatRow label="HEX + alpha" value={toHex(color, true)} hint="8-digit form, #rrggbbaa" />
              <FormatRow label="RGB" value={toRgbString(color)} />
              <FormatRow
                label="RGB (CSS 4)"
                value={`rgb(${color.r} ${color.g} ${color.b}${color.a < 1 ? ` / ${color.a}` : ''})`}
                hint="Space-separated syntax"
              />
              <FormatRow label="HSL" value={toHslString(color)} />
              <FormatRow label="HSV / HSB" value={toHsvString(color)} hint="Used by most colour pickers" />
              <FormatRow
                label="OKLCH"
                value={toOklchString(color)}
                hint="Perceptually uniform: equal steps look equal"
              />
              <FormatRow label="CMYK" value={toCmykString(color)} hint="Naive conversion, no ICC profile" />
              <FormatRow
                label="Oklab L C H"
                value={`L ${(oklch.l * 100).toFixed(2)}% · C ${oklch.c.toFixed(4)} · H ${oklch.h.toFixed(2)}°`}
              />
            </TableBody>
          </Table>
        </div>
      </ToolPanel>

      <ToolPanel
        title="WCAG contrast"
        description="Contrast is measured between the flattened foreground and the background you choose here."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Background colour" htmlFor="contrast-bg" className="flex-1">
            <Input
              id="contrast-bg"
              value={background}
              onChange={(event) => setBackground(event.target.value)}
              className="font-mono"
              spellCheck={false}
            />
          </Field>
          <Field label="Pick" htmlFor="contrast-bg-picker" className="sm:w-28">
            <Input
              id="contrast-bg-picker"
              type="color"
              value={toHex({ ...bgParsed, a: 1 })}
              onChange={(event) => setBackground(event.target.value)}
              className="h-9 w-full cursor-pointer p-1"
            />
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setBackground('#ffffff')}>
              White
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setBackground('#000000')}>
              Black
            </Button>
          </div>
        </div>

        <div
          className="rounded-lg border border-border p-6"
          style={{ backgroundColor: toHex(bgParsed) }}
        >
          <p className="text-2xl font-semibold" style={{ color: toHex(flattened) }}>
            Large heading sample
          </p>
          <p className="text-sm" style={{ color: toHex(flattened) }}>
            Normal body text at 14 pixels, the size most interfaces actually use for paragraphs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3" role="status" aria-live="polite">
          <span className="text-3xl font-semibold tabular-nums">{ratio.toFixed(2)}:1</span>
          <span className="text-sm text-muted-foreground">
            contrast ratio · vs white {ratioWhite.toFixed(2)}:1 · vs black {ratioBlack.toFixed(2)}:1
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CHECKS.map((check) => {
            const pass = ratio >= check.threshold
            return (
              <div
                key={check.label}
                className="flex flex-col gap-1 rounded-lg bg-muted p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{check.label}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
                    {pass ? (
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                    ) : (
                      <XCircle className="size-4" aria-hidden="true" />
                    )}
                    {pass ? 'Pass' : 'Fail'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground text-pretty">
                  Needs {check.threshold}:1. {check.note}
                </span>
              </div>
            )
          })}
        </div>
      </ToolPanel>

      <ToolPanel
        title="Tints and shades"
        description="Ten steps toward white and ten toward black. Click any swatch to make it the current colour."
      >
        <div className="flex flex-col gap-4">
          <div>
            <span className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Palette className="size-4" aria-hidden="true" />
              Tints (mixed with white)
            </span>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {tints.map((tint, i) => (
                <Swatch key={i} color={tint} label={`Tint ${(i + 1) * 9}%`} onSelect={setInput} />
              ))}
            </div>
          </div>
          <div>
            <span className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Palette className="size-4" aria-hidden="true" />
              Shades (mixed with black)
            </span>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {shades.map((shade, i) => (
                <Swatch key={i} color={shade} label={`Shade ${(i + 1) * 9}%`} onSelect={setInput} />
              ))}
            </div>
          </div>
        </div>
      </ToolPanel>
    </div>
  )
}
