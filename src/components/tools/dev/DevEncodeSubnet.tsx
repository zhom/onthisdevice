import { useMemo, useState } from 'react'
import { Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { Formula } from '@/components/shared/Formula'
import { CopyButton } from '@/components/shared/CopyButton'
import { formatNumber } from '@/lib/utils'
import { EncodeField } from './dev-encode-ui'

export type SubnetMode = 'subnet' | 'cidr-range' | 'range-cidr' | 'binary'

interface Props {
  mode?: SubnetMode
}

/* ------------------------------------------------------------------ */
/* IPv4                                                                */
/* ------------------------------------------------------------------ */

function parseIpv4(text: string): number {
  const parts = text.trim().split('.')
  if (parts.length !== 4) {
    throw new Error(
      `“${text.trim()}” is not an IPv4 address. It needs exactly four octets separated by dots, like 192.168.1.10.`,
    )
  }
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      throw new Error(`“${part}” is not a number between 0 and 255.`)
    }
    const octet = Number(part)
    if (octet > 255) {
      throw new Error(`Octet ${octet} is out of range. Each octet is one byte, so 0 to 255.`)
    }
    value = value * 256 + octet
  }
  return value >>> 0
}

function formatIpv4(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.')
}

function ipv4Octets(value: number): number[] {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255)
}

function maskFromPrefix(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
}

function prefixFromMask(mask: number): number | null {
  const inverted = ~mask >>> 0
  if (((inverted + 1) & inverted) !== 0) return null
  let count = 0
  for (let i = 31; i >= 0; i -= 1) {
    if ((mask >>> i) & 1) count += 1
    else break
  }
  return count
}

function binaryIpv4(value: number, separator = '.'): string {
  return ipv4Octets(value)
    .map((octet) => octet.toString(2).padStart(8, '0'))
    .join(separator)
}

interface Ipv4Info {
  address: number
  prefix: number
  mask: number
  wildcard: number
  network: number
  broadcast: number
  first: number | null
  last: number | null
  total: number
  usable: number
  klass: string
  scope: string
}

const SCOPES: { test: (value: number) => boolean; label: string }[] = [
  { test: (v) => v >>> 24 === 10, label: 'Private (RFC 1918, 10.0.0.0/8)' },
  { test: (v) => v >>> 20 === 0xac1, label: 'Private (RFC 1918, 172.16.0.0/12)' },
  { test: (v) => v >>> 16 === 0xc0a8, label: 'Private (RFC 1918, 192.168.0.0/16)' },
  { test: (v) => v >>> 24 === 127, label: 'Loopback (127.0.0.0/8)' },
  { test: (v) => v >>> 16 === 0xa9fe, label: 'Link-local / APIPA (169.254.0.0/16)' },
  { test: (v) => v >>> 22 === 0x1901, label: 'Carrier-grade NAT (100.64.0.0/10)' },
  { test: (v) => v >>> 28 === 0xe, label: 'Multicast (224.0.0.0/4)' },
  { test: (v) => v >>> 28 === 0xf, label: 'Reserved (240.0.0.0/4)' },
]

function describeIpv4(address: number, prefix: number): Ipv4Info {
  const mask = maskFromPrefix(prefix)
  const wildcard = ~mask >>> 0
  const network = (address & mask) >>> 0
  const broadcast = (network | wildcard) >>> 0
  const total = 2 ** (32 - prefix)
  let first: number | null = null
  let last: number | null = null
  let usable = 0
  if (prefix <= 30) {
    first = (network + 1) >>> 0
    last = (broadcast - 1) >>> 0
    usable = total - 2
  } else if (prefix === 31) {
    first = network
    last = broadcast
    usable = 2
  } else {
    first = network
    last = network
    usable = 1
  }
  const firstOctet = address >>> 24
  const klass =
    firstOctet < 128
      ? 'A'
      : firstOctet < 192
        ? 'B'
        : firstOctet < 224
          ? 'C'
          : firstOctet < 240
            ? 'D (multicast)'
            : 'E (reserved)'
  const scope = SCOPES.find((entry) => entry.test(address))?.label ?? 'Public / globally routable'
  return {
    address,
    prefix,
    mask,
    wildcard,
    network,
    broadcast,
    first,
    last,
    total,
    usable,
    klass,
    scope,
  }
}

function parseCidr(input: string): { address: number; prefix: number } {
  const [ipPart, prefixPart] = input.trim().split('/')
  const address = parseIpv4(ipPart)
  if (prefixPart === undefined) return { address, prefix: 32 }
  if (prefixPart.includes('.')) {
    const mask = parseIpv4(prefixPart)
    const prefix = prefixFromMask(mask)
    if (prefix === null) {
      throw new Error(
        `${prefixPart} is not a contiguous subnet mask. A mask has to be all ones followed by all zeros: 255.255.255.0 is valid, 255.0.255.0 is not.`,
      )
    }
    return { address, prefix }
  }
  if (!/^\d{1,2}$/.test(prefixPart)) {
    throw new Error(`“/${prefixPart}” is not a prefix length. Use a number from 0 to 32.`)
  }
  const prefix = Number(prefixPart)
  if (prefix > 32) throw new Error(`/${prefix} is impossible. An IPv4 address is only 32 bits.`)
  return { address, prefix }
}

/** Minimal set of CIDR blocks covering an inclusive address range. */
function rangeToCidrs(start: number, end: number): { cidr: string; count: number }[] {
  const out: { cidr: string; count: number }[] = []
  let cursor = start
  while (cursor <= end) {
    // Grow the block while it stays aligned to its own size and still fits.
    let prefix = 32
    while (prefix > 0) {
      const candidate = prefix - 1
      const mask = maskFromPrefix(candidate)
      if (((cursor & mask) >>> 0) !== cursor) break
      if (cursor + 2 ** (32 - candidate) - 1 > end) break
      prefix = candidate
    }
    const size = 2 ** (32 - prefix)
    out.push({ cidr: `${formatIpv4(cursor)}/${prefix}`, count: size })
    cursor += size
    if (out.length >= 512) break
  }
  return out
}

/* ------------------------------------------------------------------ */
/* IPv6                                                                */
/* ------------------------------------------------------------------ */

function parseIpv6(text: string): bigint {
  const raw = text.trim()
  if (raw.length === 0) throw new Error('Enter an IPv6 address.')
  const [head, tail] = raw.split('::')
  const expand = (segment: string): string[] =>
    segment.length === 0 ? [] : segment.split(':').filter((part) => part.length > 0)
  let groups: string[]
  if (tail === undefined) {
    groups = expand(head)
    if (groups.length !== 8) {
      throw new Error(
        `“${raw}” has ${groups.length} groups. A full IPv6 address has eight. Use :: to stand in for a run of zero groups.`,
      )
    }
  } else {
    if (raw.split('::').length > 2) {
      throw new Error('An IPv6 address may contain :: only once. Otherwise it is ambiguous.')
    }
    const left = expand(head)
    const right = expand(tail)
    const fill = 8 - left.length - right.length
    if (fill < 0) throw new Error(`“${raw}” has more than eight groups.`)
    groups = [...left, ...Array<string>(fill).fill('0'), ...right]
  }
  let value = 0n
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
      throw new Error(`“${group}” is not a valid IPv6 group. A group is one to four hex digits.`)
    }
    value = (value << 16n) | BigInt(Number.parseInt(group, 16))
  }
  return value
}

function formatIpv6(value: bigint, compress = true): string {
  const groups: string[] = []
  for (let i = 7; i >= 0; i -= 1) {
    groups.push(((value >> BigInt(i * 16)) & 0xffffn).toString(16))
  }
  if (!compress) return groups.map((group) => group.padStart(4, '0')).join(':')
  let bestStart = -1
  let bestLength = 0
  let runStart = -1
  let runLength = 0
  groups.forEach((group, index) => {
    if (group === '0') {
      if (runStart === -1) runStart = index
      runLength += 1
      if (runLength > bestLength) {
        bestLength = runLength
        bestStart = runStart
      }
    } else {
      runStart = -1
      runLength = 0
    }
  })
  if (bestLength < 2) return groups.join(':')
  const head = groups.slice(0, bestStart).join(':')
  const tail = groups.slice(bestStart + bestLength).join(':')
  return `${head}::${tail}`
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <TableRow>
      <TableCell className="w-48 text-muted-foreground">{label}</TableCell>
      <TableCell className={mono ? 'font-mono break-all' : 'break-words'}>{value}</TableCell>
      <TableCell className="w-16 text-right">
        <CopyButton value={value} label="Copy" variant="ghost" />
      </TableCell>
    </TableRow>
  )
}

export default function DevEncodeSubnet({ mode = 'subnet' }: Props) {
  const [cidr, setCidr] = useState(mode === 'binary' ? '192.168.1.10' : '192.168.1.0/24')
  const [rangeStart, setRangeStart] = useState('10.0.0.5')
  const [rangeEnd, setRangeEnd] = useState('10.0.1.250')
  const [splitPrefix, setSplitPrefix] = useState('26')
  const [cloudReserved, setCloudReserved] = useState(false)
  const [v6, setV6] = useState('2001:db8:85a3::8a2e:370:7334/64')

  const parsed = useMemo(() => {
    try {
      const { address, prefix } = parseCidr(cidr)
      return { info: describeIpv4(address, prefix), error: null as string | null }
    } catch (error) {
      return {
        info: null,
        error: error instanceof Error ? error.message : 'That address could not be parsed.',
      }
    }
  }, [cidr])

  const rangeResult = useMemo(() => {
    try {
      const start = parseIpv4(rangeStart)
      const end = parseIpv4(rangeEnd)
      if (end < start) {
        throw new Error(
          'The end address is lower than the start address. Swap them, or check for a typo in an octet.',
        )
      }
      return { blocks: rangeToCidrs(start, end), total: end - start + 1, error: null as string | null }
    } catch (error) {
      return {
        blocks: [],
        total: 0,
        error: error instanceof Error ? error.message : 'That range could not be parsed.',
      }
    }
  }, [rangeStart, rangeEnd])

  const splits = useMemo(() => {
    const info = parsed.info
    const target = Number(splitPrefix)
    if (!info || !Number.isFinite(target) || target <= info.prefix || target > 32) return null
    const count = 2 ** (target - info.prefix)
    const size = 2 ** (32 - target)
    const rows: { network: string; first: string; last: string; broadcast: string }[] = []
    for (let i = 0; i < Math.min(count, 128); i += 1) {
      const network = (info.network + i * size) >>> 0
      const broadcast = (network + size - 1) >>> 0
      rows.push({
        network: `${formatIpv4(network)}/${target}`,
        first: formatIpv4(target <= 30 ? network + 1 : network),
        last: formatIpv4(target <= 30 ? broadcast - 1 : broadcast),
        broadcast: formatIpv4(broadcast),
      })
    }
    return { count, size, rows, truncated: count > 128 }
  }, [parsed.info, splitPrefix])

  const v6Result = useMemo(() => {
    if (mode !== 'subnet') return null
    try {
      const [addressPart, prefixPart] = v6.trim().split('/')
      const address = parseIpv6(addressPart)
      const prefix = prefixPart === undefined ? 128 : Number(prefixPart)
      if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) {
        throw new Error(`“/${prefixPart}” is not a valid IPv6 prefix length. Use 0 to 128.`)
      }
      const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix)
      const network = address & mask
      const last = network | ((1n << BigInt(128 - prefix)) - 1n)
      return {
        error: null as string | null,
        compressed: formatIpv6(address),
        expanded: formatIpv6(address, false),
        network: `${formatIpv6(network)}/${prefix}`,
        first: formatIpv6(network),
        last: formatIpv6(last),
        count: 1n << BigInt(128 - prefix),
        prefix,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'That IPv6 address could not be parsed.',
        compressed: '',
        expanded: '',
        network: '',
        first: '',
        last: '',
        count: 0n,
        prefix: 0,
      }
    }
  }, [mode, v6])

  const info = parsed.info

  /* --------------------------------------------- range → CIDR page */
  if (mode === 'range-cidr') {
    return (
      <div className="space-y-5">
        <ToolPanel
          title="Address range"
          description="Give the first and last address you want covered, and this finds the smallest set of CIDR blocks that covers exactly that range."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <EncodeField label="Start address" htmlFor="range-start">
              <Input
                id="range-start"
                value={rangeStart}
                onChange={(event) => setRangeStart(event.target.value)}
                className="font-mono"
                inputMode="decimal"
              />
            </EncodeField>
            <EncodeField label="End address (inclusive)" htmlFor="range-end">
              <Input
                id="range-end"
                value={rangeEnd}
                onChange={(event) => setRangeEnd(event.target.value)}
                className="font-mono"
                inputMode="decimal"
              />
            </EncodeField>
          </div>
          {rangeResult.error ? <ErrorNote message={rangeResult.error} /> : null}
        </ToolPanel>

        {!rangeResult.error && rangeResult.blocks.length > 0 ? (
          <ToolPanel
            title={`${rangeResult.blocks.length} block${rangeResult.blocks.length === 1 ? '' : 's'}`}
            description={`Covering ${formatNumber(rangeResult.total, 0)} addresses.`}
            footer={
              <CopyButton
                value={rangeResult.blocks.map((block) => block.cidr).join('\n')}
                label="Copy all blocks"
              />
            }
          >
            <div className="overflow-x-auto rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CIDR block</TableHead>
                    <TableHead className="text-right">Addresses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rangeResult.blocks.map((block) => (
                    <TableRow key={block.cidr}>
                      <TableCell className="font-mono">{block.cidr}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatNumber(block.count, 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Formula caption="Each block starts on an address that is already aligned to its own size, which is why an arbitrary range usually needs several of them.">
              {`${rangeStart} – ${rangeEnd}\n= ${formatNumber(rangeResult.total, 0)} addresses\n= ${rangeResult.blocks.map((b) => b.cidr).join(' + ')}`}
            </Formula>
          </ToolPanel>
        ) : null}
      </div>
    )
  }

  /* ------------------------------------------------- binary page */
  if (mode === 'binary') {
    return (
      <div className="space-y-5">
        <ToolPanel
          title="IPv4 address"
          description="Every representation of the same 32 bits, side by side."
        >
          <EncodeField
            label="Address"
            htmlFor="binary-ip"
            hint="A plain address, or one with a /prefix if you want the mask broken down too."
          >
            <Input
              id="binary-ip"
              value={cidr}
              onChange={(event) => setCidr(event.target.value)}
              className="font-mono"
              inputMode="decimal"
              aria-invalid={parsed.error ? true : undefined}
            />
          </EncodeField>
          {parsed.error ? <ErrorNote message={parsed.error} /> : null}
        </ToolPanel>

        {info ? (
          <>
            <ToolPanel title="Octet by octet">
              <div className="overflow-x-auto rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Octet</TableHead>
                      <TableHead>Decimal</TableHead>
                      <TableHead>Binary</TableHead>
                      <TableHead>Hex</TableHead>
                      <TableHead>Octal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ipv4Octets(info.address).map((octet, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-muted-foreground">#{index + 1}</TableCell>
                        <TableCell className="font-mono">{octet}</TableCell>
                        <TableCell className="font-mono">
                          {octet.toString(2).padStart(8, '0')}
                        </TableCell>
                        <TableCell className="font-mono">
                          0x{octet.toString(16).toUpperCase().padStart(2, '0')}
                        </TableCell>
                        <TableCell className="font-mono">{octet.toString(8)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ToolPanel>

            <ToolPanel title="The whole address">
              <div className="overflow-x-auto rounded-lg">
                <Table>
                  <TableBody>
                    <Row label="Dotted decimal" value={formatIpv4(info.address)} />
                    <Row label="Dotted binary" value={binaryIpv4(info.address)} />
                    <Row label="Flat binary" value={binaryIpv4(info.address, '')} />
                    <Row
                      label="32-bit integer"
                      value={String(info.address >>> 0)}
                    />
                    <Row
                      label="Hexadecimal"
                      value={`0x${(info.address >>> 0).toString(16).toUpperCase().padStart(8, '0')}`}
                    />
                    <Row label="Class" value={info.klass} mono={false} />
                    <Row label="Scope" value={info.scope} mono={false} />
                  </TableBody>
                </Table>
              </div>
              <Formula caption="Positional notation: each octet is one byte, so the leftmost is worth 2²⁴.">
                {`${ipv4Octets(info.address).join(' . ')}\n= ${ipv4Octets(info.address)
                  .map((octet, index) => `${octet}×256^${3 - index}`)
                  .join(' + ')}\n= ${ipv4Octets(info.address)
                  .map((octet, index) => octet * 256 ** (3 - index))
                  .join(' + ')}\n= ${info.address >>> 0}`}
              </Formula>
            </ToolPanel>
          </>
        ) : null}
      </div>
    )
  }

  /* ------------------------------- subnet + cidr-to-range pages */
  const usable = info
    ? cloudReserved && info.prefix <= 28
      ? Math.max(0, info.total - 5)
      : info.usable
    : 0

  return (
    <div className="space-y-5">
      <ToolPanel
        title={mode === 'cidr-range' ? 'CIDR block' : 'Network'}
        description={
          mode === 'cidr-range'
            ? 'Enter a block in CIDR notation to see exactly which addresses it contains.'
            : 'Enter an address with a prefix (192.168.1.0/24) or a dotted mask (192.168.1.0/255.255.255.0).'
        }
      >
        <EncodeField label="Address / CIDR" htmlFor="cidr-input">
          <Input
            id="cidr-input"
            value={cidr}
            onChange={(event) => setCidr(event.target.value)}
            className="font-mono"
            placeholder="192.168.1.0/24"
            aria-invalid={parsed.error ? true : undefined}
          />
        </EncodeField>
        {parsed.error ? <ErrorNote message={parsed.error} /> : null}
      </ToolPanel>

      {info ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ResultStat
              label="Usable hosts"
              value={formatNumber(usable, 0)}
              hint={
                cloudReserved
                  ? 'AWS, Azure and GCP each reserve five addresses per subnet'
                  : info.prefix === 31
                    ? 'RFC 3021 point-to-point link'
                    : 'Network and broadcast excluded'
              }
              emphasis
            />
            <ResultStat
              label="Network"
              value={<span className="font-mono text-base">{formatIpv4(info.network)}</span>}
              hint={`/${info.prefix}`}
            />
            <ResultStat
              label="Broadcast"
              value={<span className="font-mono text-base">{formatIpv4(info.broadcast)}</span>}
              hint={info.prefix >= 31 ? 'Not applicable at this size' : 'All host bits set'}
            />
            <ResultStat
              label="Total addresses"
              value={formatNumber(info.total, 0)}
              hint={`2^${32 - info.prefix}`}
            />
          </div>

          <ToolPanel
            title="Full breakdown"
            footer={
              <div className="flex items-center gap-2">
                <Switch
                  id="cloud-reserved"
                  checked={cloudReserved}
                  onCheckedChange={setCloudReserved}
                />
                <label htmlFor="cloud-reserved" className="text-sm text-foreground">
                  Cloud mode: AWS, Azure and GCP reserve 5 addresses
                </label>
              </div>
            }
          >
            <div className="overflow-x-auto rounded-lg">
              <Table>
                <TableBody>
                  <Row label="CIDR notation" value={`${formatIpv4(info.network)}/${info.prefix}`} />
                  <Row label="Subnet mask" value={formatIpv4(info.mask)} />
                  <Row label="Wildcard mask" value={formatIpv4(info.wildcard)} />
                  <Row
                    label="Host range"
                    value={
                      info.first !== null && info.last !== null
                        ? `${formatIpv4(info.first)} – ${formatIpv4(info.last)}`
                        : 'none'
                    }
                  />
                  <Row label="Mask in binary" value={binaryIpv4(info.mask)} />
                  <Row label="Network in binary" value={binaryIpv4(info.network)} />
                  <Row label="Class" value={info.klass} mono={false} />
                  <Row label="Scope" value={info.scope} mono={false} />
                  <Row
                    label="Integer range"
                    value={`${info.network >>> 0} – ${info.broadcast >>> 0}`}
                  />
                </TableBody>
              </Table>
            </div>

            <Formula caption="The mask picks out the network bits with a bitwise AND; the wildcard is its complement.">
              {`prefix /${info.prefix}\nmask      = ${binaryIpv4(info.mask)}  (${formatIpv4(info.mask)})\naddress   = ${binaryIpv4(info.address)}  (${formatIpv4(info.address)})\nAND       = ${binaryIpv4(info.network)}  (${formatIpv4(info.network)})\n\nhosts = 2^(32 − ${info.prefix}) ${info.prefix <= 30 ? '− 2' : ''} = ${formatNumber(info.prefix <= 30 ? info.total - 2 : info.usable, 0)}`}
            </Formula>

            {cloudReserved ? (
              <Alert role="note">
                <AlertTitle>What the cloud providers take</AlertTitle>
                <AlertDescription>
                  In an AWS VPC subnet the network address, the VPC router (.1), the DNS resolver
                  (.2), a reserved future address (.3) and the broadcast address are all unavailable:
                  five per subnet instead of two. Azure and GCP reserve the same count. A /24
                  therefore gives you 251 usable addresses, not 254.
                </AlertDescription>
              </Alert>
            ) : null}
          </ToolPanel>

          {mode === 'subnet' ? (
            <ToolPanel
              title="Split this block"
              description="Divide the network into equal smaller subnets, the first step of a VLSM plan."
            >
              <EncodeField
                label="New prefix length"
                htmlFor="split-prefix"
                hint={`Must be longer than /${info.prefix}.`}
                className="max-w-48"
              >
                <Select value={splitPrefix} onValueChange={setSplitPrefix}>
                  <SelectTrigger id="split-prefix">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 32 - info.prefix }, (_, index) => info.prefix + index + 1)
                      .filter((value) => value <= 32)
                      .map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          /{value}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </EncodeField>

              {splits ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(splits.count, 0)} subnets of {formatNumber(splits.size, 0)}{' '}
                    addresses each.
                    {splits.truncated ? ' First 128 shown.' : ''}
                  </p>
                  <div className="max-h-96 overflow-auto rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subnet</TableHead>
                          <TableHead>First host</TableHead>
                          <TableHead>Last host</TableHead>
                          <TableHead>Broadcast</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {splits.rows.map((row) => (
                          <TableRow key={row.network}>
                            <TableCell className="font-mono">{row.network}</TableCell>
                            <TableCell className="font-mono">{row.first}</TableCell>
                            <TableCell className="font-mono">{row.last}</TableCell>
                            <TableCell className="font-mono">{row.broadcast}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <CopyButton
                    value={splits.rows.map((row) => row.network).join('\n')}
                    label="Copy subnet list"
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Choose a longer prefix to see the split.
                </p>
              )}
            </ToolPanel>
          ) : null}
        </>
      ) : null}

      {mode === 'subnet' ? (
            <ToolPanel
              title={
                <span className="flex items-center gap-2">
                  <Network className="size-4" aria-hidden="true" />
                  IPv6 prefix
                </span>
              }
              description="128-bit arithmetic done with BigInt, so a /48 reports its 1,208,925,819,614,629,174,706,176 addresses exactly rather than in floating point."
            >
              <EncodeField label="IPv6 address / prefix" htmlFor="v6-input">
                <Input
                  id="v6-input"
                  value={v6}
                  onChange={(event) => setV6(event.target.value)}
                  className="font-mono"
                  placeholder="2001:db8::/32"
                  aria-invalid={v6Result?.error ? true : undefined}
                />
              </EncodeField>
              {v6Result?.error ? <ErrorNote message={v6Result.error} /> : null}
              {v6Result && !v6Result.error ? (
                <div className="overflow-x-auto rounded-lg">
                  <Table>
                    <TableBody>
                      <Row label="Compressed" value={v6Result.compressed} />
                      <Row label="Expanded" value={v6Result.expanded} />
                      <Row label="Network" value={v6Result.network} />
                      <Row label="First address" value={v6Result.first} />
                      <Row label="Last address" value={v6Result.last} />
                      <Row
                        label="Addresses in prefix"
                        value={v6Result.count.toLocaleString('en-US')}
                      />
                      <Row
                        label="/64 subnets available"
                        value={
                          v6Result.prefix <= 64
                            ? (1n << BigInt(64 - v6Result.prefix)).toLocaleString('en-US')
                            : 'none (this prefix is longer than /64)'
                        }
                        mono={false}
                      />
                    </TableBody>
                  </Table>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {['2001:db8::/32', 'fe80::/10', 'fd00::/8', '::1/128'].map((example) => (
                  <Button
                    key={example}
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs"
                    onClick={() => setV6(example)}
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </ToolPanel>
      ) : null}
    </div>
  )
}
