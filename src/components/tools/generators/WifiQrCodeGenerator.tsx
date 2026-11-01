import { useMemo, useState } from 'react'
import { Eye, EyeOff, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ColorField, Field, NumberSlider, SegmentedField } from './GenUi'
import { QrOutput } from './QrOutput'
import { contrastRatio, parseColor, toHex } from './colorlib'
import type { EccLevel } from './qrlib'

type Encryption = 'WPA' | 'SAE' | 'WEP' | 'nopass'

const ENCRYPTION_OPTIONS: { value: Encryption; label: string; title: string }[] = [
  { value: 'WPA', label: 'WPA/WPA2', title: 'The setting almost every home router uses' },
  { value: 'SAE', label: 'WPA3', title: 'WPA3-Personal (SAE): newer routers and phones' },
  { value: 'WEP', label: 'WEP', title: 'Obsolete and insecure; only for very old hardware' },
  { value: 'nopass', label: 'Open', title: 'No password at all' },
]

const ECC_OPTIONS: { value: EccLevel; label: string }[] = [
  { value: 'L', label: 'L' },
  { value: 'M', label: 'M' },
  { value: 'Q', label: 'Q' },
  { value: 'H', label: 'H' },
]

/**
 * Escape a field for the WIFI: URI scheme. Backslash, semicolon, comma, colon
 * and double quote are all reserved and must be prefixed with a backslash.
 */
export function escapeWifiField(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1')
}

/** A value made only of hex digits has to be quoted, or it is read as raw hex. */
function encodeWifiValue(value: string): string {
  const escaped = escapeWifiField(value)
  if (value.length > 0 && /^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
    return `"${escaped}"`
  }
  return escaped
}

export function buildWifiPayload(options: {
  ssid: string
  password: string
  encryption: Encryption
  hidden: boolean
}): string {
  const { ssid, password, encryption, hidden } = options
  if (ssid.trim().length === 0) return ''

  const parts = [`T:${encryption}`, `S:${encodeWifiValue(ssid)}`]
  if (encryption !== 'nopass' && password.length > 0) {
    parts.push(`P:${encodeWifiValue(password)}`)
  }
  if (hidden) parts.push('H:true')
  return `WIFI:${parts.join(';')};;`
}

export default function WifiQrCodeGenerator() {
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [encryption, setEncryption] = useState<Encryption>('WPA')
  const [hidden, setHidden] = useState(false)
  const [reveal, setReveal] = useState(false)

  const [ecc, setEcc] = useState<EccLevel>('M')
  const [size, setSize] = useState(512)
  const [margin, setMargin] = useState(4)
  const [dark, setDark] = useState('#000000')
  const [light, setLight] = useState('#ffffff')

  const payload = useMemo(
    () => buildWifiPayload({ ssid, password, encryption, hidden }),
    [ssid, password, encryption, hidden],
  )

  const darkRgb = useMemo(() => parseColor(dark) ?? { r: 0, g: 0, b: 0, a: 1 }, [dark])
  const lightRgb = useMemo(() => parseColor(light) ?? { r: 255, g: 255, b: 255, a: 1 }, [light])
  const ratio = contrastRatio(darkRgb, lightRgb)

  const needsPassword = encryption !== 'nopass'
  const weakPassword = needsPassword && password.length > 0 && password.length < 8
  const missingPassword = needsPassword && password.length === 0 && ssid.trim().length > 0

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <ToolPanel
            title="Network details"
            description="Exactly what you would type when joining the network by hand. The credentials never leave this tab."
          >
            <Field
              label="Network name (SSID)"
              htmlFor="wifi-ssid"
              hint="Case sensitive, and it must match the router exactly, including any trailing space."
            >
              <Input
                id="wifi-ssid"
                value={ssid}
                onChange={(event) => setSsid(event.target.value)}
                placeholder="MyHomeWiFi"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
              />
            </Field>

            <SegmentedField
              label="Security"
              value={encryption}
              options={ENCRYPTION_OPTIONS}
              onChange={setEncryption}
            />

            {needsPassword ? (
              <Field label="Password" htmlFor="wifi-password">
                <div className="flex items-center gap-2">
                  <Input
                    id="wifi-password"
                    type={reveal ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Network password"
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    autoComplete="off"
                    className="min-w-0 flex-1 font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={reveal ? 'Hide the password' : 'Show the password'}
                    aria-pressed={reveal}
                    onClick={() => setReveal((value) => !value)}
                  >
                    {reveal ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </Field>
            ) : null}

            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
              <div className="min-w-0">
                <Label htmlFor="wifi-hidden" className="text-sm">
                  Hidden network
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Turn this on only if the router does not broadcast its SSID. Getting it wrong stops
                  the code working on some Android builds.
                </p>
              </div>
              <Switch id="wifi-hidden" checked={hidden} onCheckedChange={setHidden} />
            </div>

            {missingPassword ? (
              <Alert role="status" variant="warning">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>No password entered</AlertTitle>
                <AlertDescription>
                  You picked an encrypted security type but left the password blank, so the code will
                  prompt for one instead of joining automatically. Choose “Open” if the network really
                  has no password.
                </AlertDescription>
              </Alert>
            ) : null}

            {weakPassword ? (
              <Alert role="status" variant="warning">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>That password looks too short</AlertTitle>
                <AlertDescription>
                  WPA and WPA2 passphrases must be at least 8 characters. A shorter one cannot be a
                  valid key, so the join will fail.
                </AlertDescription>
              </Alert>
            ) : null}
          </ToolPanel>

          <ToolPanel title="Appearance">
            <NumberSlider
              label="Image size"
              value={size}
              onChange={setSize}
              min={128}
              max={2048}
              step={32}
              unit="px"
            />
            <NumberSlider
              label="Quiet zone"
              value={margin}
              onChange={setMargin}
              min={0}
              max={10}
              unit="modules"
              hint="Four modules of blank border is the specification minimum. Keep it if the code is going on a printed card."
            />
            <ColorField label="Foreground" value={dark} onChange={setDark} />
            <ColorField label="Background" value={light} onChange={setLight} />
            <SegmentedField
              label="Error correction"
              value={ecc}
              options={ECC_OPTIONS}
              onChange={setEcc}
              hint="Level M is right for a card on a fridge. Raise it to Q or H if the code will be laminated, curved or printed small."
            />
            {ratio < 4 ? (
              <p className="flex items-start gap-1.5 text-xs text-foreground">
                <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Contrast is only {ratio.toFixed(2)}:1. Darken the foreground or lighten the
                  background before printing.
                </span>
              </p>
            ) : null}
          </ToolPanel>
        </div>

        <ToolPanel title="Your Wi-Fi QR code" className="lg:sticky lg:top-6 lg:self-start">
          <QrOutput
            payload={payload}
            ecc={ecc}
            size={size}
            margin={margin}
            dark={toHex(darkRgb)}
            light={toHex(lightRgb)}
            filename={ssid.trim().length > 0 ? `wifi-${ssid.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : 'wifi-qr-code'}
            payloadLabel="Wi-Fi payload"
            emptyHint="Enter the network name and the QR code appears here."
          />
          {payload.length > 0 ? (
            <p className="mt-4 text-xs text-pretty text-muted-foreground">
              Anyone who can see this image can join the network. Treat a printed copy the same way
              you would treat the password written on a sticky note.
            </p>
          ) : null}
        </ToolPanel>
      </div>
    </div>
  )
}
