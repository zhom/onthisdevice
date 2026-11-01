import { useCallback, useEffect, useMemo, useState } from 'react'
import { ImagePlus, Trash2, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ColorField, Field, NumberSlider, SegmentedField } from './GenUi'
import { QrOutput } from './QrOutput'
import { contrastRatio, parseColor, relativeLuminance, toHex, WHITE } from './colorlib'
import type { EccLevel, LoadedImage } from './qrlib'
import { ECC_MAX_LOGO, loadImage } from './qrlib'

const ECC_OPTIONS: { value: EccLevel; label: string; title: string }[] = [
  { value: 'L', label: 'L', title: 'Low: about 7% of the symbol can be damaged' },
  { value: 'M', label: 'M', title: 'Medium: about 15% recoverable (the usual default)' },
  { value: 'Q', label: 'Q', title: 'Quartile: about 25% recoverable' },
  { value: 'H', label: 'H', title: 'High: about 30% recoverable, needed for a centre logo' },
]

const EXAMPLES: { label: string; value: string }[] = [
  { label: 'Website', value: 'https://onthisdevice.com' },
  { label: 'Phone', value: 'tel:+15551234567' },
  { label: 'Email', value: 'mailto:hello@example.com?subject=Hello' },
  { label: 'SMS', value: 'SMSTO:+15551234567:Hi there' },
  { label: 'Geo', value: 'geo:48.858370,2.294481' },
]

export default function QrCodeGenerator() {
  const [text, setText] = useState('https://onthisdevice.com')
  const [ecc, setEcc] = useState<EccLevel>('M')
  const [size, setSize] = useState(512)
  const [margin, setMargin] = useState(4)
  const [dark, setDark] = useState('#000000')
  const [light, setLight] = useState('#ffffff')
  const [transparent, setTransparent] = useState(false)
  const [logo, setLogo] = useState<LoadedImage | null>(null)
  const [logoName, setLogoName] = useState<string | null>(null)
  const [logoScale, setLogoScale] = useState(0.2)
  const [logoPadded, setLogoPadded] = useState(true)
  const [logoError, setLogoError] = useState<string | null>(null)

  const darkRgb = useMemo(() => parseColor(dark) ?? { r: 0, g: 0, b: 0, a: 1 }, [dark])
  const lightRgb = useMemo(() => parseColor(light) ?? { r: 255, g: 255, b: 255, a: 1 }, [light])
  const effectiveLight = transparent ? WHITE : lightRgb
  const ratio = useMemo(() => contrastRatio(darkRgb, effectiveLight), [darkRgb, effectiveLight])
  const inverted = relativeLuminance(darkRgb) > relativeLuminance(effectiveLight)

  const maxLogo = ECC_MAX_LOGO[ecc]
  const logoTooBig = logo !== null && logoScale > maxLogo

  const onLogoFiles = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setLogoError(null)
    try {
      const loaded = await loadImage(file)
      setLogo(loaded)
      setLogoName(file.name)
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'That image could not be read.')
    }
  }, [])

  // Raising the logo size past what the correction level tolerates is the
  // single most common reason a "designed" QR code stops scanning.
  useEffect(() => {
    if (logo && logoScale > ECC_MAX_LOGO[ecc] && ecc !== 'H') setEcc('H')
  }, [logo, logoScale, ecc])

  return (
    <div className="flex flex-col gap-6">
      <ToolPanel
        title="What should the code contain?"
        description="Any text works. A URL is the most common use, but phone numbers, email drafts and coordinates all have their own schemes."
      >
        <Field label="Text or URL" htmlFor="qr-text">
          <Textarea
            id="qr-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="https://example.com"
            className="font-mono text-sm"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Try:</span>
          {EXAMPLES.map((example) => (
            <Button
              key={example.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setText(example.value)}
            >
              {example.label}
            </Button>
          ))}
        </div>
      </ToolPanel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <ToolPanel title="Appearance">
            <NumberSlider
              label="Image size"
              value={size}
              onChange={setSize}
              min={128}
              max={2048}
              step={32}
              unit="px"
              hint="The exported PNG is exactly this wide. The SVG is resolution-independent whatever you choose."
            />

            <NumberSlider
              label="Quiet zone"
              value={margin}
              onChange={setMargin}
              min={0}
              max={10}
              unit="modules"
              hint="The blank border around the symbol. The QR specification requires 4 modules; below that, scanners start to struggle."
            />

            <ColorField label="Foreground (dark modules)" value={dark} onChange={setDark} />

            <ColorField
              label="Background (light modules)"
              value={light}
              onChange={setLight}
              hint={transparent ? 'Disabled while the background is transparent.' : undefined}
            />

            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
              <div className="min-w-0">
                <Label htmlFor="qr-transparent" className="text-sm">
                  Transparent background
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Leaves the light modules unpainted. Only safe over a plain, light surface.
                </p>
              </div>
              <Switch id="qr-transparent" checked={transparent} onCheckedChange={setTransparent} />
            </div>

            <SegmentedField
              label="Error correction"
              value={ecc}
              options={ECC_OPTIONS}
              onChange={setEcc}
              hint="Higher levels survive more damage and dirt but pack fewer characters into the same symbol size."
            />

            {ratio < 4 || inverted ? (
              <Alert role="status" variant="warning">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>
                  {inverted ? 'The colours are inverted' : 'Not enough contrast to scan reliably'}
                </AlertTitle>
                <AlertDescription>
                  {inverted
                    ? 'The dark modules are lighter than the background. Most scanners assume dark-on-light and will refuse to read this. Swap the two colours.'
                    : `The two colours have a contrast ratio of ${ratio.toFixed(2)}:1. Aim for 4:1 or better. Cheap phone cameras and printed codes need the margin.`}
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-xs text-muted-foreground">
                Contrast ratio {ratio.toFixed(2)}:1, enough to scan.{' '}
                <span className="font-mono">{toHex(darkRgb)}</span> on{' '}
                <span className="font-mono">{transparent ? 'transparent' : toHex(lightRgb)}</span>.
              </p>
            )}
          </ToolPanel>

          <ToolPanel
            title="Centre logo (optional)"
            description="A logo covers part of the symbol. Error correction is what makes that survivable, so raise the level when the logo grows."
          >
            {logo ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-lg bg-card p-3">
                  <img
                    src={logo.dataUri}
                    alt=""
                    className="size-10 shrink-0 rounded object-contain"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {logoName ?? 'Logo'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove the logo"
                    onClick={() => {
                      setLogo(null)
                      setLogoName(null)
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>

                <NumberSlider
                  label="Logo size"
                  value={Math.round(logoScale * 100)}
                  onChange={(value) => setLogoScale(value / 100)}
                  min={5}
                  max={35}
                  unit="%"
                  hint={`At level ${ecc} you can safely cover about ${Math.round(maxLogo * 100)}% of the symbol width.`}
                />

                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
                  <div className="min-w-0">
                    <Label htmlFor="qr-logo-pad" className="text-sm">
                      Clear a plate behind the logo
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Draws the background colour under the logo so it does not sit on top of modules.
                    </p>
                  </div>
                  <Switch id="qr-logo-pad" checked={logoPadded} onCheckedChange={setLogoPadded} />
                </div>

                {logoTooBig ? (
                  <Alert role="status" variant="warning">
                    <TriangleAlert aria-hidden="true" />
                    <AlertTitle>This logo is likely too large</AlertTitle>
                    <AlertDescription>
                      Covering {Math.round(logoScale * 100)}% of the width exceeds what level {ecc} can
                      reconstruct. Shrink the logo or switch to level H, then test the code with a real
                      phone before printing it.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : (
              <FileDropzone
                accept="image/png,image/jpeg,image/svg+xml,image/webp,.png,.jpg,.jpeg,.svg,.webp"
                onFiles={(files) => void onLogoFiles(files)}
                maxSizeMb={10}
                icon={ImagePlus}
                title="Drop a logo image"
                hint="PNG with transparency works best"
              />
            )}

            {logoError ? <p className="text-sm text-destructive">{logoError}</p> : null}
          </ToolPanel>
        </div>

        <ToolPanel title="Your QR code" className="lg:sticky lg:top-6 lg:self-start">
          <QrOutput
            payload={text}
            ecc={ecc}
            size={size}
            margin={margin}
            dark={toHex(darkRgb)}
            light={transparent ? null : toHex(lightRgb)}
            logo={logo}
            logoScale={logoScale}
            logoPadded={logoPadded}
            filename="qr-code"
            emptyHint="Type a URL or any text above and the QR code appears here."
          />
        </ToolPanel>
      </div>
    </div>
  )
}
