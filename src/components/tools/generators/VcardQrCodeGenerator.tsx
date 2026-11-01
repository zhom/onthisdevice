import { useMemo, useState } from 'react'
import { Download, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { downloadBlob } from '@/lib/utils'
import { ColorField, Field, NumberSlider, SegmentedField } from './GenUi'
import { QrOutput } from './QrOutput'
import { parseColor, toHex } from './colorlib'
import type { EccLevel } from './qrlib'

const ECC_OPTIONS: { value: EccLevel; label: string }[] = [
  { value: 'L', label: 'L' },
  { value: 'M', label: 'M' },
  { value: 'Q', label: 'Q' },
  { value: 'H', label: 'H' },
]

export interface VcardFields {
  first: string
  last: string
  org: string
  title: string
  mobile: string
  workPhone: string
  email: string
  url: string
  street: string
  city: string
  region: string
  postcode: string
  country: string
  note: string
}

const EMPTY: VcardFields = {
  first: '',
  last: '',
  org: '',
  title: '',
  mobile: '',
  workPhone: '',
  email: '',
  url: '',
  street: '',
  city: '',
  region: '',
  postcode: '',
  country: '',
  note: '',
}

/** vCard text values escape backslash, semicolon, comma and newlines. */
export function escapeVcard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** Build a vCard 3.0 document. Empty properties are omitted entirely. */
export function buildVcard(fields: VcardFields): string {
  const first = fields.first.trim()
  const last = fields.last.trim()
  const fullName = [first, last].filter(Boolean).join(' ')
  if (fullName.length === 0 && fields.org.trim().length === 0) return ''

  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0']

  lines.push(`N:${escapeVcard(last)};${escapeVcard(first)};;;`)
  lines.push(`FN:${escapeVcard(fullName || fields.org.trim())}`)

  if (fields.org.trim()) lines.push(`ORG:${escapeVcard(fields.org.trim())}`)
  if (fields.title.trim()) lines.push(`TITLE:${escapeVcard(fields.title.trim())}`)
  if (fields.mobile.trim()) lines.push(`TEL;TYPE=CELL,VOICE:${escapeVcard(fields.mobile.trim())}`)
  if (fields.workPhone.trim()) lines.push(`TEL;TYPE=WORK,VOICE:${escapeVcard(fields.workPhone.trim())}`)
  if (fields.email.trim()) lines.push(`EMAIL;TYPE=INTERNET,PREF:${escapeVcard(fields.email.trim())}`)
  if (fields.url.trim()) lines.push(`URL:${escapeVcard(normaliseUrl(fields.url.trim()))}`)

  const adr = [fields.street, fields.city, fields.region, fields.postcode, fields.country]
  if (adr.some((part) => part.trim().length > 0)) {
    lines.push(
      `ADR;TYPE=WORK:;;${escapeVcard(fields.street.trim())};${escapeVcard(
        fields.city.trim(),
      )};${escapeVcard(fields.region.trim())};${escapeVcard(fields.postcode.trim())};${escapeVcard(
        fields.country.trim(),
      )}`,
    )
  }

  if (fields.note.trim()) lines.push(`NOTE:${escapeVcard(fields.note.trim())}`)

  lines.push('END:VCARD')
  return lines.join('\r\n')
}

function normaliseUrl(value: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value
  return `https://${value}`
}

export default function VcardQrCodeGenerator() {
  const [fields, setFields] = useState<VcardFields>(EMPTY)
  const [ecc, setEcc] = useState<EccLevel>('M')
  const [size, setSize] = useState(512)
  const [margin, setMargin] = useState(4)
  const [dark, setDark] = useState('#000000')
  const [light, setLight] = useState('#ffffff')

  const set = <K extends keyof VcardFields>(key: K) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }))

  const vcard = useMemo(() => buildVcard(fields), [fields])
  const darkRgb = useMemo(() => parseColor(dark) ?? { r: 0, g: 0, b: 0, a: 1 }, [dark])
  const lightRgb = useMemo(() => parseColor(light) ?? { r: 255, g: 255, b: 255, a: 1 }, [light])

  const filename =
    [fields.first.trim(), fields.last.trim()].filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9-]+/g, '') ||
    'contact'

  const byteLength = new TextEncoder().encode(vcard).length
  const dense = byteLength > 400

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <ToolPanel
            title="Contact details"
            description="Blank fields are left out of the card. Each extra field makes the QR code denser and harder to scan."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="vc-first">
                <Input
                  id="vc-first"
                  value={fields.first}
                  onChange={(e) => set('first')(e.target.value)}
                  autoComplete="given-name"
                  placeholder="Ada"
                />
              </Field>
              <Field label="Last name" htmlFor="vc-last">
                <Input
                  id="vc-last"
                  value={fields.last}
                  onChange={(e) => set('last')(e.target.value)}
                  autoComplete="family-name"
                  placeholder="Lovelace"
                />
              </Field>
              <Field label="Organisation" htmlFor="vc-org">
                <Input
                  id="vc-org"
                  value={fields.org}
                  onChange={(e) => set('org')(e.target.value)}
                  autoComplete="organization"
                  placeholder="Analytical Engines Ltd"
                />
              </Field>
              <Field label="Job title" htmlFor="vc-title">
                <Input
                  id="vc-title"
                  value={fields.title}
                  onChange={(e) => set('title')(e.target.value)}
                  autoComplete="organization-title"
                  placeholder="Head of Computation"
                />
              </Field>
              <Field label="Mobile phone" htmlFor="vc-mobile" hint="Use the +country format so it dials from anywhere.">
                <Input
                  id="vc-mobile"
                  type="tel"
                  inputMode="tel"
                  value={fields.mobile}
                  onChange={(e) => set('mobile')(e.target.value)}
                  autoComplete="tel"
                  placeholder="+44 20 7946 0958"
                />
              </Field>
              <Field label="Work phone" htmlFor="vc-work">
                <Input
                  id="vc-work"
                  type="tel"
                  inputMode="tel"
                  value={fields.workPhone}
                  onChange={(e) => set('workPhone')(e.target.value)}
                  placeholder="+44 20 7946 0000"
                />
              </Field>
              <Field label="Email" htmlFor="vc-email">
                <Input
                  id="vc-email"
                  type="email"
                  inputMode="email"
                  value={fields.email}
                  onChange={(e) => set('email')(e.target.value)}
                  autoComplete="email"
                  spellCheck={false}
                  placeholder="ada@example.com"
                />
              </Field>
              <Field label="Website" htmlFor="vc-url">
                <Input
                  id="vc-url"
                  type="url"
                  inputMode="url"
                  value={fields.url}
                  onChange={(e) => set('url')(e.target.value)}
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="example.com"
                />
              </Field>
            </div>
          </ToolPanel>

          <ToolPanel title="Address (optional)">
            <Field label="Street" htmlFor="vc-street">
              <Input
                id="vc-street"
                value={fields.street}
                onChange={(e) => set('street')(e.target.value)}
                autoComplete="street-address"
                placeholder="12 Marylebone Road"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" htmlFor="vc-city">
                <Input
                  id="vc-city"
                  value={fields.city}
                  onChange={(e) => set('city')(e.target.value)}
                  autoComplete="address-level2"
                  placeholder="London"
                />
              </Field>
              <Field label="State / region" htmlFor="vc-region">
                <Input
                  id="vc-region"
                  value={fields.region}
                  onChange={(e) => set('region')(e.target.value)}
                  autoComplete="address-level1"
                  placeholder="Greater London"
                />
              </Field>
              <Field label="Postal code" htmlFor="vc-postcode">
                <Input
                  id="vc-postcode"
                  value={fields.postcode}
                  onChange={(e) => set('postcode')(e.target.value)}
                  autoComplete="postal-code"
                  placeholder="NW1 5LS"
                />
              </Field>
              <Field label="Country" htmlFor="vc-country">
                <Input
                  id="vc-country"
                  value={fields.country}
                  onChange={(e) => set('country')(e.target.value)}
                  autoComplete="country-name"
                  placeholder="United Kingdom"
                />
              </Field>
            </div>
            <Field label="Note" htmlFor="vc-note" hint="A short line that shows up under the contact once saved.">
              <Textarea
                id="vc-note"
                rows={2}
                value={fields.note}
                onChange={(e) => set('note')(e.target.value)}
                placeholder="Met at the 2026 conference"
              />
            </Field>
          </ToolPanel>

          <ToolPanel title="Appearance">
            <NumberSlider label="Image size" value={size} onChange={setSize} min={128} max={2048} step={32} unit="px" />
            <NumberSlider label="Quiet zone" value={margin} onChange={setMargin} min={0} max={10} unit="modules" />
            <ColorField label="Foreground" value={dark} onChange={setDark} />
            <ColorField label="Background" value={light} onChange={setLight} />
            <SegmentedField
              label="Error correction"
              value={ecc}
              options={ECC_OPTIONS}
              onChange={setEcc}
              hint="A vCard is a lot of data. Level L keeps the symbol smaller and easier to scan; only raise it if the code will be printed small or on a rough surface."
            />
          </ToolPanel>
        </div>

        <ToolPanel title="Your contact QR code" className="lg:sticky lg:top-6 lg:self-start">
          <QrOutput
            payload={vcard}
            ecc={ecc}
            size={size}
            margin={margin}
            dark={toHex(darkRgb)}
            light={toHex(lightRgb)}
            filename={`${filename}-vcard`}
            payloadLabel="vCard 3.0 source"
            emptyHint="Enter at least a name or an organisation and the contact QR code appears here."
          />

          {vcard.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() =>
                  downloadBlob(
                    new Blob([vcard], { type: 'text/vcard;charset=utf-8' }),
                    `${filename}.vcf`,
                  )
                }
              >
                <Download className="size-4" aria-hidden="true" />
                Download .vcf file
              </Button>
              {dense ? (
                <p className="flex items-start gap-1.5 text-xs text-pretty text-foreground">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    This card is {byteLength} bytes, which makes a dense symbol. Print it at 3 cm or
                    larger, or remove a field or two. The address and note are usually the first to go.
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {byteLength} bytes encoded. Anything under about 300 bytes scans comfortably from a
                  business card.
                </p>
              )}
            </div>
          ) : null}
        </ToolPanel>
      </div>
    </div>
  )
}
