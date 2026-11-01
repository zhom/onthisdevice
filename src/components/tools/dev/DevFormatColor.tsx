import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { DfField, DfProofPanel, DfStatus } from './dev-format-ui'
import {
  COLOR_FORMATS,
  contrastRatio,
  formatColor,
  hexToRgba,
  parseColor,
  rgbaToHex,
  type ColorFormatId,
  type Rgba,
} from './dev-format-color'

export interface DevFormatColorProps {
  from: ColorFormatId
  to: ColorFormatId
}

const PRESETS: { label: string; hex: string }[] = [
  { label: 'Tailwind blue-600', hex: '#2563eb' },
  { label: 'Tailwind slate-900', hex: '#0f172a' },
  { label: 'Bootstrap danger', hex: '#dc3545' },
  { label: 'Material teal', hex: '#009688' },
  { label: 'Rebecca purple', hex: '#663399' },
  { label: 'Warm sand', hex: '#e0c9a6' },
]

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 }
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 }

function ratioLabel(ratio: number): string {
  if (ratio >= 7) return 'AAA for all text'
  if (ratio >= 4.5) return 'AA for body text'
  if (ratio >= 3) return 'AA for large text only'
  return 'Fails WCAG contrast'
}

export default function DevFormatColor({ from, to }: DevFormatColorProps) {
  const fromSpec = COLOR_FORMATS[from]
  const toSpec = COLOR_FORMATS[to]

  const [text, setText] = useState(fromSpec.placeholder)
  const [alpha, setAlpha] = useState(100)
  const [reversed, setReversed] = useState(false)

  const sourceSpec = reversed ? toSpec : fromSpec
  const targetSpec = reversed ? fromSpec : toSpec

  const parsed = useMemo(() => parseColor(text), [text])
  const rgba = useMemo<Rgba | null>(() => {
    if (!parsed.ok) return null
    return { ...parsed.rgba, a: alpha / 100 }
  }, [alpha, parsed])

  /** Keep the alpha slider in step when the user pastes an rgba()/8-digit hex. */
  useEffect(() => {
    if (parsed.ok) setAlpha(Math.round(parsed.rgba.a * 100))
  }, [parsed])

  const strings = useMemo(() => (rgba ? formatColor(rgba) : null), [rgba])

  const swap = useCallback(() => {
    setReversed((current) => !current)
    if (rgba) setText(targetSpec.render(rgba))
  }, [rgba, targetSpec])

  const randomise = useCallback(() => {
    const random: Rgba = {
      r: Math.floor(Math.random() * 256),
      g: Math.floor(Math.random() * 256),
      b: Math.floor(Math.random() * 256),
      a: 1,
    }
    setAlpha(100)
    setText(sourceSpec.render(random))
  }, [sourceSpec])

  const onWhite = rgba ? contrastRatio(rgba, WHITE) : 0
  const onBlack = rgba ? contrastRatio(rgba, BLACK) : 0

  const rows: { label: string; value: string }[] = strings
    ? [
        { label: 'HEX', value: strings.hex },
        { label: 'HEX with alpha', value: strings.hex8 },
        { label: 'RGB', value: strings.rgb },
        { label: 'RGBA', value: strings.rgba },
        { label: 'RGB (space syntax)', value: strings.rgbSpace },
        { label: 'HSL', value: strings.hsl },
        { label: 'HSLA', value: strings.hsla },
        { label: 'HSL (space syntax)', value: strings.hslSpace },
        { label: 'HSV / HSB', value: strings.hsv },
        { label: 'CMYK', value: strings.cmyk },
        { label: 'Android ARGB', value: strings.androidHex },
        { label: 'SwiftUI', value: strings.swiftUI },
      ]
    : []

  return (
    <div className="space-y-6">
      <ToolPanel
        title={`${sourceSpec.label} to ${targetSpec.label}`}
        description="Type in either box and the other updates immediately. Every other notation is listed underneath with its own copy button."
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <DfField label={sourceSpec.label} htmlFor="color-input" hint={sourceSpec.hint}>
            <Input
              id="color-input"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={sourceSpec.placeholder}
              className="font-mono"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-invalid={!parsed.ok || undefined}
            />
          </DfField>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={swap}
            aria-label={`Swap direction: convert ${targetSpec.label} to ${sourceSpec.label}`}
            className="mb-1 hidden sm:inline-flex"
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
          </Button>

          <DfField
            label={targetSpec.label}
            htmlFor="color-output"
            hint={`Converted from ${sourceSpec.label}.`}
          >
            <div className="flex gap-2">
              <Input
                id="color-output"
                value={rgba ? targetSpec.render(rgba) : ''}
                readOnly
                className="bg-muted font-mono"
              />
              <CopyButton value={rgba ? targetSpec.render(rgba) : ''} label="Copy" />
            </div>
          </DfField>
        </div>

        <div className="flex flex-wrap gap-2 sm:hidden">
          <Button type="button" variant="outline" size="sm" onClick={swap} className="gap-2">
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            Swap direction
          </Button>
        </div>

        {!parsed.ok ? <DfStatus ok={false}>{parsed.message}</DfStatus> : null}

        {rgba && strings ? (
          <>
            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <div
                className="h-24 w-full rounded-xl border border-border sm:w-40"
                style={{
                  backgroundColor: strings.hex8,
                  backgroundImage:
                    alpha < 100
                      ? 'repeating-conic-gradient(color-mix(in srgb, currentColor 12%, transparent) 0% 25%, transparent 0% 50%)'
                      : undefined,
                  backgroundSize: '16px 16px',
                }}
                role="img"
                aria-label={`Colour swatch for ${strings.hex}`}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Contrast on white
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                    {onWhite.toFixed(2)}:1
                  </p>
                  <p className="text-sm text-muted-foreground">{ratioLabel(onWhite)}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Contrast on black
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                    {onBlack.toFixed(2)}:1
                  </p>
                  <p className="text-sm text-muted-foreground">{ratioLabel(onBlack)}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div>
                <Label htmlFor="color-alpha" className="text-sm">
                  Alpha: {alpha}%
                </Label>
                <Slider
                  id="color-alpha"
                  className="mt-3"
                  min={0}
                  max={100}
                  step={1}
                  value={[alpha]}
                  onValueChange={(value) => setAlpha(value[0] ?? 100)}
                  aria-label="Alpha percentage"
                />
              </div>
              <DfField label="Pick visually" htmlFor="color-picker">
                <input
                  id="color-picker"
                  type="color"
                  value={rgbaToHex(rgba)}
                  onChange={(event) => {
                    const picked = hexToRgba(event.target.value)
                    setText(sourceSpec.render({ ...picked, a: alpha / 100 }))
                  }}
                  className="h-9 w-20 cursor-pointer rounded-md border border-input bg-background p-1"
                />
              </DfField>
            </div>

            <div className="overflow-x-auto rounded-lg">
              <table className="w-full min-w-[28rem] border-collapse text-sm">
                <caption className="sr-only">
                  Every notation for the colour you entered, each with a copy button
                </caption>
                <thead>
                  <tr className="bg-muted">
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Format
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Value
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      <span className="sr-only">Copy</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="border-t border-border">
                      <th scope="row" className="px-3 py-2 text-left font-normal text-muted-foreground">
                        {row.label}
                      </th>
                      <td className="px-3 py-2 font-mono text-[13px] break-all text-foreground">
                        {row.value}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <CopyButton value={row.value} label="Copy" size="sm" variant="ghost" />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border">
                    <th scope="row" className="px-3 py-2 text-left font-normal text-muted-foreground">
                      Nearest CSS name
                    </th>
                    <td className="px-3 py-2 font-mono text-[13px] text-foreground">
                      {strings.nearestName}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <CopyButton
                        value={strings.nearestName.replace(' (closest match)', '')}
                        label="Copy"
                        size="sm"
                        variant="ghost"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground">
                CSS custom properties
              </p>
              <pre className="mt-2 overflow-x-auto font-mono text-[13px] whitespace-pre text-foreground">
                {strings.cssVariables}
              </pre>
              <div className="mt-2">
                <CopyButton value={strings.cssVariables} label="Copy variables" />
              </div>
            </div>
          </>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Try:</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.hex}
              type="button"
              onClick={() => {
                setAlpha(100)
                setText(sourceSpec.render(hexToRgba(preset.hex)))
              }}
              className="inline-flex items-center gap-2 rounded-md bg-muted px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span
                className="size-3.5 rounded-full border border-border"
                style={{ backgroundColor: preset.hex }}
                aria-hidden="true"
              />
              {preset.label}
            </button>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={randomise} className="gap-2">
            <Shuffle className="size-4" aria-hidden="true" />
            Random
          </Button>
        </div>
      </ToolPanel>

      <DfProofPanel subject="colour values" />
    </div>
  )
}
