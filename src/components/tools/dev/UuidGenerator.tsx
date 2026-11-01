import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle2, Dices, RefreshCw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { CodePane, DataRow, Field, Segmented, StatChips } from './DevUi'
import { clamp, formatNumber } from '@/lib/utils'

type Version = 'v4' | 'v7'
type Separator = 'lines' | 'comma' | 'json'

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

function formatUuid(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < 16; i++) hex += bytes[i].toString(16).padStart(2, '0')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function uuidV4(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return formatUuid(bytes)
}

/**
 * UUID v7 (RFC 9562): 48-bit Unix millisecond timestamp, then a 12-bit
 * monotonic counter so that identifiers minted inside the same millisecond
 * still sort in creation order, then 62 random bits.
 */
function makeV7Generator(): () => string {
  let lastMs = -1
  let counter = 0
  return () => {
    const ms = Date.now()
    if (ms === lastMs) {
      counter = (counter + 1) & 0x0fff
    } else {
      lastMs = ms
      const seed = new Uint16Array(1)
      crypto.getRandomValues(seed)
      counter = seed[0] & 0x0fff
    }

    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    const time = BigInt(ms)
    for (let i = 0; i < 6; i++) {
      bytes[i] = Number((time >> BigInt(8 * (5 - i))) & 0xffn)
    }
    bytes[6] = 0x70 | ((counter >> 8) & 0x0f)
    bytes[7] = counter & 0xff
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return formatUuid(bytes)
  }
}

function generate(version: Version, count: number): string[] {
  const out: string[] = new Array<string>(count)
  if (version === 'v4') {
    for (let i = 0; i < count; i++) out[i] = uuidV4()
    return out
  }
  const next = makeV7Generator()
  for (let i = 0; i < count; i++) out[i] = next()
  return out
}

interface FormatOptions {
  uppercase: boolean
  hyphens: boolean
  braces: boolean
}

function applyFormat(uuid: string, options: FormatOptions): string {
  let value = options.hyphens ? uuid : uuid.replace(/-/g, '')
  if (options.uppercase) value = value.toUpperCase()
  if (options.braces) value = `{${value}}`
  return value
}

function join(values: string[], separator: Separator): string {
  if (separator === 'comma') return values.join(', ')
  if (separator === 'json') return `[\n${values.map((v) => `  ${JSON.stringify(v)}`).join(',\n')}\n]`
  return values.join('\n')
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const UUID_RE = /^\{?([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})\}?$/i

const GREGORIAN_OFFSET_MS = 12219292800000 // 1582-10-15 → 1970-01-01

interface Inspection {
  valid: boolean
  message: string
  canonical?: string
  version?: number
  versionName?: string
  variant?: string
  timestamp?: string
  special?: string
}

function inspect(input: string): Inspection | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const match = UUID_RE.exec(trimmed)
  if (!match) {
    const hexOnly = trimmed.replace(/[{}-]/g, '')
    if (!/^[0-9a-f]*$/i.test(hexOnly)) {
      const bad = [...hexOnly].find((c) => !/[0-9a-f]/i.test(c))
      return {
        valid: false,
        message: `“${bad}” is not a hexadecimal digit. A UUID contains only 0-9 and a-f, plus hyphens.`,
      }
    }
    return {
      valid: false,
      message: `A UUID has 32 hexadecimal digits in an 8-4-4-4-12 layout; this has ${hexOnly.length}.`,
    }
  }

  const hex = match.slice(1).join('').toLowerCase()
  const canonical = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`

  if (/^0+$/.test(hex)) {
    return { valid: true, message: 'Valid nil UUID.', canonical, special: 'Nil UUID: all 128 bits zero, used as a “no value” placeholder.' }
  }
  if (/^f+$/i.test(hex)) {
    return { valid: true, message: 'Valid max UUID.', canonical, special: 'Max UUID: all 128 bits set, the sort-order counterpart of the nil UUID.' }
  }

  const version = Number.parseInt(hex[12], 16)
  const variantNibble = Number.parseInt(hex[16], 16)
  const variant =
    variantNibble < 8
      ? 'Reserved (NCS backwards compatibility)'
      : variantNibble < 0xc
        ? 'RFC 4122 / RFC 9562 (the standard variant)'
        : variantNibble < 0xe
          ? 'Reserved (Microsoft GUID)'
          : 'Reserved for future definition'

  const versionNames: Record<number, string> = {
    1: 'v1: time based (100-ns Gregorian timestamp + MAC address)',
    2: 'v2: DCE security, rarely seen in the wild',
    3: 'v3: name based, MD5 hash of a namespace and name',
    4: 'v4: random',
    5: 'v5: name based, SHA-1 hash of a namespace and name',
    6: 'v6: reordered time based, sortable variant of v1',
    7: 'v7: Unix millisecond timestamp plus randomness, sortable',
    8: 'v8: custom / vendor defined',
  }

  let timestamp: string | undefined
  try {
    if (version === 1) {
      const timeLow = BigInt(`0x${hex.slice(0, 8)}`)
      const timeMid = BigInt(`0x${hex.slice(8, 12)}`)
      const timeHigh = BigInt(`0x${hex.slice(13, 16)}`)
      const ticks = (timeHigh << 48n) | (timeMid << 32n) | timeLow
      const ms = Number(ticks / 10000n) - GREGORIAN_OFFSET_MS
      timestamp = format(new Date(ms), "d MMM yyyy, HH:mm:ss.SSS 'UTC'XXX")
    } else if (version === 6) {
      const high = BigInt(`0x${hex.slice(0, 12)}`)
      const low = BigInt(`0x${hex.slice(13, 16)}`)
      const ticks = (high << 12n) | low
      const ms = Number(ticks / 10000n) - GREGORIAN_OFFSET_MS
      timestamp = format(new Date(ms), "d MMM yyyy, HH:mm:ss.SSS 'UTC'XXX")
    } else if (version === 7) {
      const ms = Number(BigInt(`0x${hex.slice(0, 12)}`))
      timestamp = format(new Date(ms), "d MMM yyyy, HH:mm:ss.SSS 'UTC'XXX")
    }
  } catch {
    timestamp = 'Embedded timestamp is out of range'
  }

  return {
    valid: true,
    message: 'Valid UUID.',
    canonical,
    version,
    versionName: versionNames[version] ?? `v${version}: unrecognised version nibble`,
    variant,
    timestamp,
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function UuidGenerator() {
  const [version, setVersion] = useState<Version>('v4')
  const [count, setCount] = useState(5)
  const [uppercase, setUppercase] = useState(false)
  const [hyphens, setHyphens] = useState(true)
  const [braces, setBraces] = useState(false)
  const [separator, setSeparator] = useState<Separator>('lines')
  const [uuids, setUuids] = useState<string[]>([])
  const [check, setCheck] = useState('')

  const regenerate = useCallback(() => {
    setUuids(generate(version, clamp(Math.round(count) || 1, 1, 1000)))
  }, [version, count])

  // Generated after mount so the server-rendered HTML and the hydrated markup agree.
  useEffect(() => {
    setUuids(generate('v4', 5))
  }, [])

  const formatted = useMemo(
    () => join(uuids.map((u) => applyFormat(u, { uppercase, hyphens, braces })), separator),
    [uuids, uppercase, hyphens, braces, separator],
  )

  const blob = useMemo(
    () => (formatted ? new Blob([formatted], { type: 'text/plain;charset=utf-8' }) : null),
    [formatted],
  )

  const inspection = useMemo(() => inspect(check), [check])

  return (
    <Tabs defaultValue="generate" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="generate">Generate</TabsTrigger>
        <TabsTrigger value="inspect">Validate / inspect</TabsTrigger>
      </TabsList>

      <TabsContent value="generate" className="mt-4 flex flex-col gap-4">
        <ToolPanel
          title="Generate UUIDs"
          description="Randomness comes from crypto.getRandomValues, your browser's cryptographically secure generator."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Version</span>
              <Segmented
                label="UUID version"
                value={version}
                onChange={setVersion}
                options={[
                  { value: 'v4', label: 'v4 · random' },
                  { value: 'v7', label: 'v7 · time-ordered' },
                ]}
              />
              <p className="text-xs text-muted-foreground text-pretty">
                {version === 'v4'
                  ? '122 random bits. Unpredictable, but scatters across a database index.'
                  : '48-bit millisecond timestamp first, then a monotonic counter and randomness. Consecutive values sort in creation order.'}
              </p>
            </div>

            <Field
              label="How many"
              htmlFor="uuid-count"
              hint="Between 1 and 1000 at a time."
            >
              <Input
                id="uuid-count"
                type="number"
                min={1}
                max={1000}
                value={count}
                onChange={(event) => setCount(clamp(Number(event.target.value) || 1, 1, 1000))}
                className="font-mono"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-lg bg-muted p-3">
            <div className="flex items-center gap-2">
              <Switch id="uuid-hyphens" checked={hyphens} onCheckedChange={setHyphens} />
              <Label htmlFor="uuid-hyphens" className="text-sm">
                Hyphens
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="uuid-uppercase" checked={uppercase} onCheckedChange={setUppercase} />
              <Label htmlFor="uuid-uppercase" className="text-sm">
                Uppercase
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="uuid-braces" checked={braces} onCheckedChange={setBraces} />
              <Label htmlFor="uuid-braces" className="text-sm">
                Wrap in braces
              </Label>
            </div>
            <Segmented
              label="Output layout"
              value={separator}
              onChange={setSeparator}
              options={[
                { value: 'lines', label: 'One per line' },
                { value: 'comma', label: 'Comma separated' },
                { value: 'json', label: 'JSON array' },
              ]}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="gap-1.5" onClick={regenerate}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Generate {formatNumber(clamp(Math.round(count) || 1, 1, 1000), 0)}
            </Button>
            <CopyButton value={formatted} label="Copy all" variant="outline" size="default" />
            <DownloadButton blob={blob} filename={`uuids-${version}.txt`} label="Download .txt" variant="outline" />
          </div>

          <StatChips
            items={[
              { label: 'Generated', value: formatNumber(uuids.length, 0) },
              { label: 'Version', value: version },
              { label: 'Characters each', value: formatNumber(applyFormat(uuids[0] ?? '', { uppercase, hyphens, braces }).length, 0) },
            ]}
          />

          <CodePane
            label="Generated UUIDs"
            value={formatted}
            readOnly
            rows={Math.min(16, Math.max(4, uuids.length + 1))}
            copyable={false}
          />
        </ToolPanel>
      </TabsContent>

      <TabsContent value="inspect" className="mt-4 flex flex-col gap-4">
        <ToolPanel
          title="Validate a UUID"
          description="Paste any UUID, with or without hyphens or braces, to check it and read its version, variant and embedded timestamp."
        >
          <Field label="UUID to inspect" htmlFor="uuid-check">
            <Input
              id="uuid-check"
              value={check}
              onChange={(event) => setCheck(event.target.value)}
              placeholder="0195c1f4-1b2c-7a3d-9e4f-5a6b7c8d9e0f"
              className="font-mono"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </Field>

          <div role="status" aria-live="polite" className="flex flex-col gap-3">
            {inspection ? (
              inspection.valid ? (
                <>
                  <p className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-foreground">
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                    {inspection.message}
                  </p>
                  <dl>
                    <DataRow label="Canonical" value={inspection.canonical} />
                    {inspection.special ? (
                      <DataRow label="Note" value={inspection.special} mono={false} />
                    ) : null}
                    {inspection.versionName ? (
                      <DataRow label="Version" value={inspection.versionName} mono={false} />
                    ) : null}
                    {inspection.variant ? (
                      <DataRow label="Variant" value={inspection.variant} mono={false} />
                    ) : null}
                    {inspection.timestamp ? (
                      <DataRow label="Embedded time" value={inspection.timestamp} mono={false} />
                    ) : null}
                  </dl>
                </>
              ) : (
                <p className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-foreground">
                  <XCircle className="size-4 shrink-0" aria-hidden="true" />
                  {inspection.message}
                </p>
              )
            ) : (
              <p className="flex items-center gap-2 rounded-lg bg-muted p-6 text-sm text-muted-foreground">
                <Dices className="size-4 shrink-0" aria-hidden="true" />
                Paste a UUID above to check it.
              </p>
            )}
          </div>
        </ToolPanel>
      </TabsContent>
    </Tabs>
  )
}
