/**
 * IP address parsing and the range-file format shared by the IP to ASN and cloud IP lookups
 * (pure, unit-tested in scripts/data/test.mjs).
 *
 * IPv4 chunk line: "gap,size,value" in base 36; start = previous end + 1 + gap (the first line
 * starts at the chunk's index entry), end = start + size.
 * IPv6 chunk line: "start,end,value"; start is hex with trailing zeros cut, end with trailing
 * f's cut, both padded back to 32 hex digits.
 */

export type Ip = { v: 4; n: number } | { v: 6; n: bigint }

export function parseIPv4(text: string): number | null {
  const parts = text.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const v = Number(p)
    if (v > 255) return null
    n = n * 256 + v
  }
  return n
}

export function parseIPv6(input: string): bigint | null {
  let text = input.trim().replace(/^\[|\]$/g, '').replace(/%.*$/, '')
  if (!text.includes(':')) return null
  // Embedded IPv4 in the last 32 bits (::ffff:1.2.3.4).
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text)
  if (v4) {
    const n = parseIPv4(v4[1])
    if (n === null) return null
    text = `${text.slice(0, -v4[1].length)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`
  }
  const halves = text.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  let n = 0n
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null
    n = (n << 16n) | BigInt(parseInt(g, 16))
  }
  return n
}

export function parseIp(text: string): Ip | null {
  const t = text.trim()
  const v4 = parseIPv4(t)
  if (v4 !== null) return { v: 4, n: v4 }
  const v6 = parseIPv6(t)
  return v6 === null ? null : { v: 6, n: v6 }
}

/** An IPv4-mapped IPv6 address (::ffff:a.b.c.d) as its IPv4 number, else null. */
export function mappedV4(n: bigint): number | null {
  return n >> 32n === 0xffffn ? Number(n & 0xffffffffn) : null
}

export function formatIPv4(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

/** RFC 5952 text form: lower case, longest zero run (2+ groups) as "::". */
export function formatIPv6(n: bigint): string {
  const groups: number[] = []
  for (let i = 7; i >= 0; i--) groups.push(Number((n >> BigInt(i * 16)) & 0xffffn))
  let best = -1
  let bestLen = 1
  for (let i = 0; i < 8; ) {
    if (groups[i] !== 0) {
      i++
      continue
    }
    let j = i
    while (j < 8 && groups[j] === 0) j++
    if (j - i > bestLen) [best, bestLen] = [i, j - i]
    i = j
  }
  const hex = groups.map((g) => g.toString(16))
  if (best < 0) return hex.join(':')
  return `${hex.slice(0, best).join(':')}::${hex.slice(best + bestLen).join(':')}`
}

export function formatIp(ip: Ip): string {
  return ip.v === 4 ? formatIPv4(ip.n) : formatIPv6(ip.n)
}

/** Bits of an address, most significant first. */
export function bitsOf(ip: Ip): number[] {
  const width = ip.v === 4 ? 32 : 128
  const big = ip.v === 4 ? BigInt(ip.n) : ip.n
  const out: number[] = []
  for (let i = width - 1; i >= 0; i--) out.push(Number((big >> BigInt(i)) & 1n))
  return out
}

export interface V4Chunk {
  starts: number[]
  ends: number[]
  values: number[]
}

export function decodeV4Chunk(text: string, chunkStart: number): V4Chunk {
  const starts: number[] = []
  const ends: number[] = []
  const values: number[] = []
  let prevEnd = chunkStart - 1
  for (const line of text.split('\n')) {
    if (!line) continue
    const [gap, size, value] = line.split(',')
    const s = prevEnd + 1 + parseInt(gap, 36)
    const e = s + parseInt(size, 36)
    starts.push(s)
    ends.push(e)
    values.push(parseInt(value, 36))
    prevEnd = e
  }
  return { starts, ends, values }
}

export interface V6Chunk {
  starts: bigint[]
  ends: bigint[]
  values: number[]
}

export const hexStart = (h: string) => BigInt(`0x${h.padEnd(32, '0')}`)
export const hexEnd = (h: string) => BigInt(`0x${h.padEnd(32, 'f')}`)

export function decodeV6Chunk(text: string): V6Chunk {
  const starts: bigint[] = []
  const ends: bigint[] = []
  const values: number[] = []
  for (const line of text.split('\n')) {
    if (!line) continue
    const [s, e, value] = line.split(',')
    starts.push(hexStart(s))
    ends.push(hexEnd(e))
    values.push(parseInt(value, 36))
  }
  return { starts, ends, values }
}

/** Index of the last entry <= key, or -1. Works for numbers and bigints. */
export function lastAtOrBelow<T extends number | bigint>(sorted: T[], key: T): number {
  let lo = 0
  let hi = sorted.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] <= key) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

/** The entry of a decoded chunk that contains `key`, or -1. */
export function findInChunk<T extends number | bigint>(starts: T[], ends: T[], key: T): number {
  const i = lastAtOrBelow(starts, key)
  return i >= 0 && key <= ends[i] ? i : -1
}

/** Smallest list of CIDR blocks that covers start..end exactly. */
export function rangeToCidrs(start: bigint, end: bigint, width: 32 | 128): { base: bigint; bits: number }[] {
  const out: { base: bigint; bits: number }[] = []
  let cur = start
  while (cur <= end) {
    let size = 0
    while (size < width) {
      const block = 1n << BigInt(size + 1)
      if (cur % block !== 0n || cur + block - 1n > end) break
      size++
    }
    out.push({ base: cur, bits: width - size })
    cur += 1n << BigInt(size)
    if (out.length > 64) break
  }
  return out
}

/** "10.0.0.0/8" -> { ip, bits, start, end } or null. */
export function parseCidr(text: string): { ip: Ip; bits: number; start: bigint; end: bigint } | null {
  const [addr, bitsText] = text.trim().split('/')
  const ip = parseIp(addr)
  if (!ip) return null
  const width = ip.v === 4 ? 32 : 128
  const bits = bitsText === undefined ? width : Number(bitsText)
  if (!/^\d+$/.test(bitsText ?? String(width)) || bits > width) return null
  const n = ip.v === 4 ? BigInt(ip.n) : ip.n
  const host = (1n << BigInt(width - bits)) - 1n
  const start = n & ~host & ((1n << BigInt(width)) - 1n)
  return { ip, bits, start, end: start | host }
}

/** Special-purpose ranges (RFC 6890 and friends) that no network announces on the internet. */
const SPECIAL4: [string, string][] = [
  ['0.0.0.0/8', 'This network (unspecified)'],
  ['10.0.0.0/8', 'Private network (RFC 1918)'],
  ['100.64.0.0/10', 'Carrier-grade NAT, shared address space (RFC 6598)'],
  ['127.0.0.0/8', 'Loopback (this device)'],
  ['169.254.0.0/16', 'Link-local (no DHCP server answered)'],
  ['172.16.0.0/12', 'Private network (RFC 1918)'],
  ['192.0.0.0/24', 'IETF protocol assignments'],
  ['192.0.2.0/24', 'Documentation (TEST-NET-1)'],
  ['192.168.0.0/16', 'Private network (RFC 1918)'],
  ['198.18.0.0/15', 'Benchmark testing'],
  ['198.51.100.0/24', 'Documentation (TEST-NET-2)'],
  ['203.0.113.0/24', 'Documentation (TEST-NET-3)'],
  ['224.0.0.0/4', 'Multicast'],
  ['240.0.0.0/4', 'Reserved for future use'],
]
const SPECIAL6: [string, string][] = [
  ['::/128', 'Unspecified address'],
  ['::1/128', 'Loopback (this device)'],
  ['64:ff9b::/96', 'IPv4/IPv6 translation (NAT64)'],
  ['100::/64', 'Discard prefix'],
  ['2001:db8::/32', 'Documentation'],
  ['fc00::/7', 'Unique local address (private network)'],
  ['fe80::/10', 'Link-local'],
  ['ff00::/8', 'Multicast'],
]

export function specialRange(ip: Ip): string | null {
  const key = ip.v === 4 ? BigInt(ip.n) : ip.n
  for (const [cidr, label] of ip.v === 4 ? SPECIAL4 : SPECIAL6) {
    const c = parseCidr(cidr)
    if (c && key >= c.start && key <= c.end) return label
  }
  if (ip.v === 4 && ip.n === 0xffffffff) return 'Limited broadcast'
  return null
}

export const toBig = (ip: Ip): bigint => (ip.v === 4 ? BigInt(ip.n) : ip.n)

export function formatBig(n: bigint, v: 4 | 6): string {
  return v === 4 ? formatIPv4(Number(n)) : formatIPv6(n)
}

/** Decoded chunk index of a range data set (v4 base-36 starts, v6 trimmed hex starts). */
export function decodeIndex(v4: string[], v6: string[]): { v4: number[]; v6: bigint[] } {
  return { v4: v4.map((s) => parseInt(s, 36)), v6: v6.map(hexStart) }
}

const v4Cache = new Map<string, Promise<V4Chunk>>()
const v6Cache = new Map<string, Promise<V6Chunk>>()

/**
 * Finds the value (ASN or label set) of the range that contains `ip`, loading one chunk.
 * `dataset` names the data set for the chunk cache; `load` fetches a chunk's text by relative path.
 */
export async function lookupRange(
  ip: Ip,
  index: { v4: number[]; v6: bigint[] },
  dataset: string,
  load: (path: string) => Promise<string>,
): Promise<{ start: bigint; end: bigint; value: number } | null> {
  if (ip.v === 4) {
    const c = lastAtOrBelow(index.v4, ip.n)
    if (c < 0) return null
    const key = `${dataset}/v4/${c}`
    let p = v4Cache.get(key)
    if (!p) {
      p = load(`v4/${c}.txt`).then((t) => decodeV4Chunk(t, index.v4[c]))
      v4Cache.set(key, p)
    }
    const chunk = await p
    const i = findInChunk(chunk.starts, chunk.ends, ip.n)
    return i < 0 ? null : { start: BigInt(chunk.starts[i]), end: BigInt(chunk.ends[i]), value: chunk.values[i] }
  }
  const c = lastAtOrBelow(index.v6, ip.n)
  if (c < 0) return null
  const key = `${dataset}/v6/${c}`
  let p = v6Cache.get(key)
  if (!p) {
    p = load(`v6/${c}.txt`).then(decodeV6Chunk)
    v6Cache.set(key, p)
  }
  const chunk = await p
  const i = findInChunk(chunk.starts, chunk.ends, ip.n)
  return i < 0 ? null : { start: chunk.starts[i], end: chunk.ends[i], value: chunk.values[i] }
}
