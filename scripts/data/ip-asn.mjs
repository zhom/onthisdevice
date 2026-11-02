/**
 * IP address to autonomous system (ASN), AS name and country, IPv4 and IPv6 (iptoasn.com,
 * public domain under the PDDL). Tier: monthly.
 *
 *   src/data/ip-asn.json                   meta + first address of each chunk (the page's index)
 *   public/data/ip-asn/<hash>/v4/<n>.txt   IPv4 ranges: "gap,size,asn" per line, base 36
 *   public/data/ip-asn/<hash>/v6/<n>.txt   IPv6 ranges: "start,end,asn", hex with the zero/f tail cut
 *   public/data/ip-asn/<hash>/asn/<k>.json ASN -> [country, name] for asn % 64 = k
 *
 * The page finds the chunk with a binary search over the index, fetches one chunk and one ASN
 * file, and binary-searches the chunk. Unrouted space has no line.
 */
import { check, commit, get, gunzip, meta, readJson, run } from './lib.mjs'

const URL = 'https://iptoasn.com/data/ip2asn-combined.tsv.gz'
const CHUNK = 4096
export const ASN_SHARDS = 64

export function v4ToInt(s) {
  const p = s.split('.')
  if (p.length !== 4) return null
  let n = 0
  for (const x of p) {
    const v = Number(x)
    if (!/^\d{1,3}$/.test(x) || v > 255) return null
    n = n * 256 + v
  }
  return n
}

/** IPv6 text -> 32 hex digits (lower case), or null. */
export function v6ToHex(s) {
  if (!s.includes(':')) return null
  const [head, tail] = s.split('::')
  const a = head ? head.split(':') : []
  const b = tail !== undefined ? (tail ? tail.split(':') : []) : []
  if (tail === undefined && a.length !== 8) return null
  const fill = tail !== undefined ? Array(8 - a.length - b.length).fill('0') : []
  const groups = [...a, ...fill, ...b]
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return null
  return groups.map((g) => g.toLowerCase().padStart(4, '0')).join('')
}

export const trimStart6 = (hex) => hex.replace(/0+$/, '') || '0'
export const trimEnd6 = (hex) => hex.replace(/f+$/, '') || 'f'

/** Parses the iptoasn TSV into sorted v4 and v6 range lists plus an ASN table. */
export function parseIpToAsn(text) {
  const v4 = []
  const v6 = []
  const asns = new Map()
  for (const line of text.split('\n')) {
    if (!line) continue
    const [s, e, asnText, country, ...rest] = line.split('\t')
    const asn = Number(asnText)
    if (!asn) continue
    const name = rest.join('\t').trim()
    if (!asns.has(asn)) asns.set(asn, [country === 'None' ? '' : country, name])
    if (s.includes(':')) {
      const a = v6ToHex(s)
      const b = v6ToHex(e)
      if (a && b) v6.push([a, b, asn])
    } else {
      const a = v4ToInt(s)
      const b = v4ToInt(e)
      if (a !== null && b !== null) v4.push([a, b, asn])
    }
  }
  v4.sort((x, y) => x[0] - y[0])
  v6.sort((x, y) => (x[0] < y[0] ? -1 : 1))
  return { v4, v6, asns }
}

export function encodeV4Chunk(rows) {
  let prevEnd = rows[0][0] - 1
  return rows
    .map(([s, e, asn]) => {
      const line = `${(s - prevEnd - 1).toString(36)},${(e - s).toString(36)},${asn.toString(36)}`
      prevEnd = e
      return line
    })
    .join('\n')
}

export function encodeV6Chunk(rows) {
  return rows.map(([s, e, asn]) => `${trimStart6(s)},${trimEnd6(e)},${asn.toString(36)}`).join('\n')
}

/** Looks up an address in parsed rows (the same search the page runs on one chunk). */
export function findRow(rows, key) {
  let lo = 0
  let hi = rows.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (rows[mid][0] <= key) lo = mid + 1
    else hi = mid - 1
  }
  const r = rows[hi]
  return r && key <= r[1] ? r : null
}

async function main() {
  const text = gunzip(await get(URL, { as: 'buffer', timeoutMs: 180_000 })).toString('utf8')
  const { v4, v6, asns } = parseIpToAsn(text)
  check(v4.length > 300_000 && v4.length < 1_200_000, `ip-asn: ${v4.length} IPv4 ranges`)
  check(v6.length > 50_000 && v6.length < 800_000, `ip-asn: ${v6.length} IPv6 ranges`)
  check(asns.size > 50_000 && asns.size < 300_000, `ip-asn: ${asns.size} ASNs`)
  for (let i = 1; i < v4.length; i++) check(v4[i][0] > v4[i - 1][1], `ip-asn: IPv4 overlap at ${v4[i][0]}`)
  for (let i = 1; i < v6.length; i++) check(v6[i][0] > v6[i - 1][1], `ip-asn: IPv6 overlap at ${v6[i][0]}`)
  const known = [
    ['8.8.8.8', 15169],
    ['1.1.1.1', 13335],
    ['9.9.9.9', 19281],
  ]
  for (const [ip, asn] of known) check(findRow(v4, v4ToInt(ip))?.[2] === asn, `ip-asn: ${ip} is not AS${asn}`)
  check(findRow(v6, v6ToHex('2001:4860:4860::8888'))?.[2] === 15169, 'ip-asn: 2001:4860:4860::8888 is not AS15169')
  const prev = readJson('src/data/ip-asn.json')
  if (prev?.counts) {
    for (const k of ['v4', 'v6', 'asns']) {
      const now = { v4: v4.length, v6: v6.length, asns: asns.size }[k]
      check(Math.abs(now - prev.counts[k]) / prev.counts[k] < 0.25, `ip-asn: ${k} count ${prev.counts[k]} -> ${now}`)
    }
  }

  const lazy = new Map()
  const index4 = []
  for (let i = 0, n = 0; i < v4.length; i += CHUNK, n++) {
    const rows = v4.slice(i, i + CHUNK)
    index4.push(rows[0][0].toString(36))
    lazy.set(`v4/${n}.txt`, encodeV4Chunk(rows))
  }
  const index6 = []
  for (let i = 0, n = 0; i < v6.length; i += CHUNK, n++) {
    const rows = v6.slice(i, i + CHUNK)
    index6.push(trimStart6(rows[0][0]))
    lazy.set(`v6/${n}.txt`, encodeV6Chunk(rows))
  }
  const shards = Array.from({ length: ASN_SHARDS }, () => ({}))
  for (const [asn, info] of [...asns.entries()].sort((a, b) => a[0] - b[0])) shards[asn % ASN_SHARDS][asn] = info
  shards.forEach((s, k) => lazy.set(`asn/${k}.json`, JSON.stringify(s)))

  commit(
    'ip-asn',
    {
      meta: meta({
        source: { name: 'iptoasn.com IP to ASN database', url: 'https://iptoasn.com/' },
        licence: { name: 'PDDL 1.0 (public domain)', url: 'https://opendatacommons.org/licenses/pddl/1-0/' },
        validFor: new Date().toISOString().slice(0, 10),
      }),
      counts: { v4: v4.length, v6: v6.length, asns: asns.size },
      asnShards: ASN_SHARDS,
      v4: index4,
      v6: index6,
    },
    lazy,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('ip-asn', main)
