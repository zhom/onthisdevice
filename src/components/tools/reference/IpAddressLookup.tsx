import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import ipData from '@/data/ip-asn.json'
import type { DataMeta } from './data'
import { loadJson, loadText } from './data'
import { Facts } from './controls'
import type { Ip } from './ip'
import { bitsOf, decodeIndex, formatBig, formatIp, lookupRange, mappedV4, parseIp, rangeToCidrs, specialRange, toBig } from './ip'
import { BitGrid, RangeBar } from './BitGrid'
import { SourceNote } from './SourceNote'

interface IpManifest {
  meta: DataMeta
  counts: { v4: number; v6: number; asns: number }
  asnShards: number
  v4: string[]
  v6: string[]
  files: string
}
const D = ipData as unknown as IpManifest
const INDEX = decodeIndex(D.v4, D.v6)
const regions = new Intl.DisplayNames(['en'], { type: 'region' })
const EXAMPLES = ['8.8.8.8', '1.1.1.1', '2a00:1450:4001:80b::200e', '192.168.1.10']

interface Found {
  ip: Ip
  special: string | null
  range: { start: bigint; end: bigint } | null
  asn: number | null
  country: string
  name: string
}

function reverseName(ip: Ip): string {
  if (ip.v === 4) return `${formatIp(ip).split('.').reverse().join('.')}.in-addr.arpa`
  return `${ip.n.toString(16).padStart(32, '0').split('').reverse().join('.')}.ip6.arpa`
}

async function find(ip: Ip): Promise<Found> {
  const special = specialRange(ip)
  // An IPv4-mapped IPv6 address is looked up as IPv4.
  const mapped = ip.v === 6 ? mappedV4(ip.n) : null
  const key: Ip = mapped !== null ? { v: 4, n: mapped } : ip
  const hit = special ? null : await lookupRange(key, INDEX, D.files, (p) => loadText(`${D.files}/${p}`))
  if (!hit) return { ip: key, special, range: null, asn: null, country: '', name: '' }
  const shard = await loadJson<Record<string, [string, string]>>(`${D.files}/asn/${hit.value % D.asnShards}.json`)
  const [country, name] = shard[String(hit.value)] ?? ['', '']
  return { ip: key, special, range: { start: hit.start, end: hit.end }, asn: hit.value, country, name }
}

export default function IpAddressLookup() {
  const [text, setText] = useState('8.8.8.8')
  const [found, setFound] = useState<Found | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ip = useMemo(() => parseIp(text), [text])

  useEffect(() => {
    if (!ip) return
    let live = true
    setBusy(true)
    find(ip).then(
      (f) => {
        if (!live) return
        setFound(f)
        setError(null)
        setBusy(false)
      },
      (e: unknown) => {
        if (!live) return
        setError(e instanceof Error ? e.message : String(e))
        setBusy(false)
      },
    )
    return () => {
      live = false
    }
  }, [ip])

  const width = found?.ip.v === 4 ? 32 : 128
  const cidrs = found?.range ? rangeToCidrs(found.range.start, found.range.end, width as 32 | 128) : []
  const key = found ? toBig(found.ip) : 0n
  const block = cidrs.find((c) => key >= c.base && key < c.base + (1n << BigInt(width - c.bits)))
  const [handle, org] = found?.name.includes(' - ') ? [found.name.split(' - ')[0], found.name.split(' - ').slice(1).join(' - ')] : [found?.name ?? '', '']
  const countryName = found?.country ? `${regions.of(found.country) ?? found.country} (${found.country})` : 'Not given'
  const size = found?.range ? found.range.end - found.range.start + 1n : 0n
  const position = found?.range && size > 1n ? Number(((key - found.range.start) * 10_000n) / (size - 1n)) / 10_000 : 0.5

  const rows: [string, string][] = found
    ? [
        ['Address', formatIp(found.ip)],
        ...(found.asn !== null
          ? ([
              ['Network (ASN)', `AS${found.asn}`],
              ['AS name', handle],
              ...(org ? [['Organisation', org] as [string, string]] : []),
              ['Registered in', countryName],
              ['Routed range', `${formatBig(found.range!.start, found.ip.v)} to ${formatBig(found.range!.end, found.ip.v)}`],
              ['As CIDR', cidrs.map((c) => `${formatBig(c.base, found.ip.v)}/${c.bits}`).slice(0, 6).join(', ') + (cidrs.length > 6 ? ', …' : '')],
              ['Addresses in range', found.ip.v === 4 ? Number(size).toLocaleString('en-US') : `${(size & (size - 1n)) === 0n ? '' : 'about '}2^${size.toString(2).length - 1}`],
            ] as [string, string][])
          : []),
        ['Reverse DNS name', reverseName(found.ip)],
        [found.ip.v === 4 ? 'As a number' : 'As hex', found.ip.v === 4 ? String(found.ip.n) : found.ip.n.toString(16).padStart(32, '0')],
      ]
    : []

  return (
    <div className="space-y-6">
      <ToolPanel>
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault()
          }}
        >
          <Label htmlFor="ip-input">IPv4 or IPv6 address</Label>
          <Input
            id="ip-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="203.0.113.7 or 2001:db8::1"
            className="font-mono text-base"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={text.trim() !== '' && !ip}
          />
        </form>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Examples:</span>
          {EXAMPLES.map((ex) => (
            <Button key={ex} type="button" variant="ghost" size="sm" className="font-mono" onClick={() => setText(ex)}>
              {ex}
            </Button>
          ))}
        </div>
        {text.trim() && !ip ? <ErrorNote message="This is not a valid IPv4 or IPv6 address. IPv4 has four numbers from 0 to 255 (192.0.2.1); IPv6 has up to eight groups of hex digits (2001:db8::1)." /> : null}
        {error ? <ErrorNote message={error} /> : null}
      </ToolPanel>

      {found && ip ? (
        <ToolPanel>
          <div role="status" aria-live="polite" aria-busy={busy} className="space-y-1">
            <p className="text-sm text-muted-foreground">{formatIp(found.ip)} belongs to</p>
            <p key={`${found.asn}-${found.special}`} className="reveal text-[1.75rem] leading-tight font-[740] break-words sm:text-[2.25rem]">
              {found.special ? found.special : found.asn !== null ? (org || handle || `AS${found.asn}`) : 'No network'}
            </p>
            <p className="text-sm text-muted-foreground">
              {found.special
                ? 'A special-purpose address. No network announces it on the internet, so it has no ASN.'
                : found.asn !== null
                  ? `AS${found.asn} · ${countryName}`
                  : 'No network announces a range that contains this address.'}
            </p>
          </div>
          {found.range ? (
            <RangeBar position={position} startLabel={formatBig(found.range.start, found.ip.v)} endLabel={formatBig(found.range.end, found.ip.v)} />
          ) : null}
          <div className="space-y-2">
            <p className="text-sm font-[600]">In binary{block ? `, network part /${block.bits} in black` : ''}</p>
            <BitGrid bits={bitsOf(found.ip)} prefix={block?.bits ?? null} />
          </div>
          <Facts rows={rows} />
          <CopyButton value={rows.map(([k, v]) => `${k}: ${v}`).join('\n')} label="Copy details" />
        </ToolPanel>
      ) : null}

      <SourceNote meta={D.meta}>
        {D.counts.v4.toLocaleString('en-US')} IPv4 and {D.counts.v6.toLocaleString('en-US')} IPv6 ranges from {D.counts.asns.toLocaleString('en-US')} networks. The page loads only the part of the table that covers your address.
      </SourceNote>
    </div>
  )
}
