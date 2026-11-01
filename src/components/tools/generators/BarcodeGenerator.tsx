import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { CircleAlert, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { downloadBlob } from '@/lib/utils'
import { ColorField, Field, NumberSlider, SegmentedField } from './GenUi'
import { parseColor, toHex } from './colorlib'
import type { Symbology } from './barcodelib'
import { SYMBOLOGIES, SYMBOLOGY_BY_ID, validateBarcode } from './barcodelib'

type TextPosition = 'bottom' | 'top'
type FontFamily = 'monospace' | 'sans-serif' | 'serif'

const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: 'monospace', label: 'Mono' },
  { value: 'sans-serif', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
]

const POSITION_OPTIONS: { value: TextPosition; label: string }[] = [
  { value: 'bottom', label: 'Below' },
  { value: 'top', label: 'Above' },
]

interface BarcodeOptions {
  format: Symbology
  barWidth: number
  height: number
  displayValue: boolean
  text: string
  fontSize: number
  font: FontFamily
  textMargin: number
  textPosition: TextPosition
  margin: number
  lineColor: string
  background: string
}

/** Paint a barcode into an existing SVG or canvas element. Throws on bad input. */
function render(target: SVGSVGElement | HTMLCanvasElement, value: string, options: BarcodeOptions): void {
  JsBarcode(target, value, {
    format: options.format,
    width: options.barWidth,
    height: options.height,
    displayValue: options.displayValue,
    text: options.text.trim().length > 0 ? options.text : undefined,
    fontSize: options.fontSize,
    font: options.font,
    textMargin: options.textMargin,
    textPosition: options.textPosition,
    margin: options.margin,
    lineColor: options.lineColor,
    background: options.background,
    valid: (ok: boolean) => {
      if (!ok) throw new Error('The encoder rejected this value for the chosen symbology.')
    },
  })
}

export default function BarcodeGenerator() {
  const [format, setFormat] = useState<Symbology>('CODE128')
  const [raw, setRaw] = useState('ONTHISDEVICE-128')
  const [barWidth, setBarWidth] = useState(2)
  const [height, setHeight] = useState(100)
  const [displayValue, setDisplayValue] = useState(true)
  const [text, setText] = useState('')
  const [fontSize, setFontSize] = useState(20)
  const [font, setFont] = useState<FontFamily>('monospace')
  const [textMargin, setTextMargin] = useState(2)
  const [textPosition, setTextPosition] = useState<TextPosition>('bottom')
  const [margin, setMargin] = useState(10)
  const [lineColor, setLineColor] = useState('#000000')
  const [background, setBackground] = useState('#ffffff')
  const [renderError, setRenderError] = useState<string | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)

  const info = SYMBOLOGY_BY_ID[format]
  const validation = useMemo(() => validateBarcode(format, raw), [format, raw])

  const options = useMemo<BarcodeOptions>(
    () => ({
      format,
      barWidth,
      height,
      displayValue,
      text,
      fontSize,
      font,
      textMargin,
      textPosition,
      margin,
      lineColor: toHex(parseColor(lineColor) ?? { r: 0, g: 0, b: 0, a: 1 }),
      background: toHex(parseColor(background) ?? { r: 255, g: 255, b: 255, a: 1 }),
    }),
    [
      format,
      barWidth,
      height,
      displayValue,
      text,
      fontSize,
      font,
      textMargin,
      textPosition,
      margin,
      lineColor,
      background,
    ],
  )

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    if (!validation.ok) {
      // Clear the stale symbol so a broken value never looks like a good one.
      while (svg.firstChild) svg.removeChild(svg.firstChild)
      svg.removeAttribute('width')
      svg.removeAttribute('height')
      setRenderError(null)
      return
    }
    try {
      render(svg, validation.value, options)
      setRenderError(null)
    } catch (error) {
      setRenderError(
        error instanceof Error
          ? error.message
          : 'That value could not be encoded with the selected symbology.',
      )
    }
  }, [validation, options])

  const svgSource = useCallback((): string | null => {
    const svg = svgRef.current
    if (!svg || !validation.ok) return null
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}\n`
  }, [validation.ok])

  const filename = `barcode-${format.toLowerCase()}-${validation.value.replace(/[^a-zA-Z0-9]+/g, '') || 'output'}`

  const downloadSvg = () => {
    const source = svgSource()
    if (!source) return
    downloadBlob(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`)
  }

  const downloadPng = async (scale: number) => {
    if (!validation.ok) return
    const canvas = document.createElement('canvas')
    try {
      render(canvas, validation.value, { ...options, barWidth: barWidth * scale, height: height * scale, fontSize: fontSize * scale, margin: margin * scale, textMargin: textMargin * scale })
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('The browser could not produce a PNG from the barcode.')
      downloadBlob(blob, `${filename}${scale > 1 ? `@${scale}x` : ''}.png`)
    } catch (error) {
      setRenderError(error instanceof Error ? error.message : 'The PNG could not be created.')
    }
  }

  const changeFormat = (next: Symbology) => {
    setFormat(next)
    const sample = SYMBOLOGY_BY_ID[next].sample
    // Only swap in the sample when the current value cannot work at all —
    // switching between the GTIN family should keep the digits you typed.
    if (!validateBarcode(next, raw).ok) setRaw(sample)
  }

  return (
    <div className="flex flex-col gap-6">
      <ToolPanel title="Barcode" description={info.blurb}>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <Field label="Symbology" htmlFor="bc-format">
            <Select value={format} onValueChange={(value) => changeFormat(value as Symbology)}>
              <SelectTrigger id="bc-format" className="w-full">
                <SelectValue placeholder="Choose a symbology" />
              </SelectTrigger>
              <SelectContent>
                {SYMBOLOGIES.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Value to encode"
            htmlFor="bc-value"
            hint={`${info.charset} · ${info.length}`}
          >
            <div className="flex items-center gap-2">
              <Input
                id="bc-value"
                value={raw}
                onChange={(event) => setRaw(event.target.value)}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-invalid={!validation.ok || undefined}
                aria-describedby="bc-validation"
                className="min-w-0 flex-1 font-mono"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setRaw(info.sample)}>
                Sample
              </Button>
            </div>
          </Field>
        </div>

        <div id="bc-validation" role="status" aria-live="polite">
          {!validation.ok ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>This value will not encode</AlertTitle>
              <AlertDescription>{validation.message}</AlertDescription>
            </Alert>
          ) : validation.note ? (
            <Alert role="status">
              <Info aria-hidden="true" />
              <AlertTitle>Adjusted automatically</AlertTitle>
              <AlertDescription>
                {validation.note} The barcode encodes{' '}
                <code className="font-mono">{validation.value}</code>.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </ToolPanel>

      <ToolPanel title="Preview">
        {renderError ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Could not draw the barcode</AlertTitle>
            <AlertDescription>{renderError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-x-auto rounded-lg bg-muted p-4" style={{ backgroundColor: options.background }}>
          <svg ref={svgRef} role="img" aria-label={`${info.label} barcode for ${validation.value}`} className="block h-auto max-w-full" />
        </div>

        {validation.ok ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void downloadPng(1)}>
              Download PNG
            </Button>
            <Button type="button" variant="secondary" onClick={() => void downloadPng(4)}>
              Download PNG @4× (print)
            </Button>
            <Button type="button" variant="outline" onClick={downloadSvg}>
              Download SVG
            </Button>
            <CopyButton value={validation.value} label="Copy encoded value" />
          </div>
        ) : null}
      </ToolPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <ToolPanel title="Bars">
          <NumberSlider
            label="Bar width"
            value={barWidth}
            onChange={setBarWidth}
            min={1}
            max={6}
            step={0.5}
            unit="px"
            hint="The width of the narrowest bar. Retail scanners want at least 0.264 mm, which is about 2 px at 200 dpi, or 1 px at 96 dpi on screen."
          />
          <NumberSlider label="Bar height" value={height} onChange={setHeight} min={20} max={300} step={5} unit="px" />
          <NumberSlider
            label="Quiet zone"
            value={margin}
            onChange={setMargin}
            min={0}
            max={40}
            unit="px"
            hint="Blank space around the symbol. EAN and UPC need at least ten narrow bars’ worth on the left and right or the scan fails."
          />
          <ColorField label="Bar colour" value={lineColor} onChange={setLineColor} />
          <ColorField
            label="Background"
            value={background}
            onChange={setBackground}
            hint="Laser scanners read red light. Red or orange bars on white are invisible to them. Keep the bars dark."
          />
        </ToolPanel>

        <ToolPanel title="Human-readable text">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
            <div className="min-w-0">
              <Label htmlFor="bc-display" className="text-sm">
                Print the value under the bars
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Required for retail EAN and UPC codes so a cashier can key the number by hand.
              </p>
            </div>
            <Switch id="bc-display" checked={displayValue} onCheckedChange={setDisplayValue} />
          </div>

          <Field
            label="Override the text"
            htmlFor="bc-text"
            hint="Leave blank to print the encoded value. Anything you type here is shown but not encoded."
          >
            <Input
              id="bc-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={!displayValue}
              placeholder={validation.value}
            />
          </Field>

          <SegmentedField label="Font" value={font} options={FONT_OPTIONS} onChange={setFont} />

          <SegmentedField
            label="Text position"
            value={textPosition}
            options={POSITION_OPTIONS}
            onChange={setTextPosition}
          />

          <NumberSlider label="Font size" value={fontSize} onChange={setFontSize} min={8} max={48} unit="px" />
          <NumberSlider label="Text margin" value={textMargin} onChange={setTextMargin} min={0} max={30} unit="px" />
        </ToolPanel>
      </div>
    </div>
  )
}
