/**
 * IP ranges that cloud and CDN providers publish for firewall rules, with service and region.
 * Tier: weekly.
 *
 * The ranges overlap (a provider-wide block contains service blocks), so they are flattened
 * into disjoint segments, each pointing to the set of labels that cover it. The page then runs
 * the same binary search as the IP to ASN lookup.
 *
 *   src/data/cloud-ips.json                   meta, providers, chunk index
 *   public/data/cloud-ips/<hash>/v4/<n>.txt   "gap,size,set" per line, base 36
 *   public/data/cloud-ips/<hash>/v6/<n>.txt   "start,end,set" (hex, zero/f tail cut)
 *   public/data/cloud-ips/<hash>/sets.json    { labels: [[provider, service, region]], sets: [[label...]] }
 */
import { check, commit, csvObjects, get, meta, readJson, run } from './lib.mjs'
import { trimEnd6, trimStart6, v4ToInt, v6ToHex } from './ip-asn.mjs'

const CHUNK = 2048
const MAX6 = (1n << 128n) - 1n

/** "10.0.0.0/8" or "2001:db8::/32" -> { v6, start: bigint, end: bigint } or null. */
export function parseCidr(text) {
  const [addr, bitsText] = text.trim().split('/')
  const v6 = addr.includes(':')
  const width = v6 ? 128 : 32
  const bits = bitsText === undefined ? width : Number(bitsText)
  if (!Number.isInteger(bits) || bits < 0 || bits > width) return null
  let n
  if (v6) {
    const hex = v6ToHex(addr)
    if (!hex) return null
    n = BigInt(`0x${hex}`)
  } else {
    const v = v4ToInt(addr)
    if (v === null) return null
    n = BigInt(v)
  }
  const host = (1n << BigInt(width - bits)) - 1n
  const start = n & ~host & (v6 ? MAX6 : 0xffffffffn)
  return { v6, start, end: start | host }
}

const AWS_SERVICE = {
  AMAZON: 'Amazon (all services)',
  EC2: 'EC2',
  S3: 'S3',
  CLOUDFRONT: 'CloudFront',
  CLOUDFRONT_ORIGIN_FACING: 'CloudFront (origin facing)',
  ROUTE53: 'Route 53',
  ROUTE53_HEALTHCHECKS: 'Route 53 health checks',
  ROUTE53_HEALTHCHECKS_PUBLISHING: 'Route 53 health checks',
  ROUTE53_RESOLVER: 'Route 53 Resolver',
  GLOBALACCELERATOR: 'Global Accelerator',
  API_GATEWAY: 'API Gateway',
  DYNAMODB: 'DynamoDB',
  EC2_INSTANCE_CONNECT: 'EC2 Instance Connect',
  WORKSPACES_GATEWAYS: 'WorkSpaces gateways',
  CODEBUILD: 'CodeBuild',
  AMAZON_CONNECT: 'Amazon Connect',
  CHIME_VOICECONNECTOR: 'Chime Voice Connector',
  CHIME_MEETINGS: 'Chime meetings',
  KINESIS_VIDEO_STREAMS: 'Kinesis Video Streams',
  IVS_REALTIME: 'IVS real-time',
  IVS_LOW_LATENCY: 'IVS low latency',
  EBS: 'EBS',
  EFS: 'EFS',
  CLOUD9: 'Cloud9',
  AMAZON_APPFLOW: 'AppFlow',
  AURORA_DSQL: 'Aurora DSQL',
  MEDIA_PACKAGE_V2: 'MediaPackage',
}
const titleCase = (s) =>
  s
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

const AZURE_SERVICES = new Set([
  'Storage',
  'Sql',
  'AppService',
  'AzureCosmosDB',
  'AzureContainerRegistry',
  'AzureFrontDoor.Frontend',
  'AzureFrontDoor.Backend',
  'ServiceBus',
  'EventHub',
  'AzureKeyVault',
  'ApiManagement',
  'AzureDevOps',
  'AzureActiveDirectory',
  'PowerBI',
  'AzureMonitor',
])

const geo = (row) => [row.city, row.country].filter(Boolean).join(', ')
function geofeed(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split(','))
    .map(([cidr, country, , city]) => ({ cidr: cidr.trim(), country: (country ?? '').trim(), city: (city ?? '').trim() }))
}

/** Each provider: fetch -> [{ cidr, service, region }]. min: expected minimum number of ranges. */
export const PROVIDERS = [
  {
    name: 'Amazon Web Services',
    url: 'https://ip-ranges.amazonaws.com/ip-ranges.json',
    min: 5000,
    async load() {
      const j = await get(this.url, { as: 'json' })
      return [
        ...j.prefixes.map((p) => ({ cidr: p.ip_prefix, service: AWS_SERVICE[p.service] ?? titleCase(p.service), region: p.region })),
        ...j.ipv6_prefixes.map((p) => ({ cidr: p.ipv6_prefix, service: AWS_SERVICE[p.service] ?? titleCase(p.service), region: p.region })),
      ]
    },
  },
  {
    name: 'Google Cloud',
    url: 'https://www.gstatic.com/ipranges/cloud.json',
    min: 500,
    async load() {
      const j = await get(this.url, { as: 'json' })
      return j.prefixes.map((p) => ({ cidr: p.ipv4Prefix ?? p.ipv6Prefix, service: p.service ?? 'Google Cloud', region: p.scope ?? '' }))
    },
  },
  {
    name: 'Google',
    url: 'https://www.gstatic.com/ipranges/goog.json',
    min: 50,
    async load() {
      const j = await get(this.url, { as: 'json' })
      return j.prefixes.map((p) => ({ cidr: p.ipv4Prefix ?? p.ipv6Prefix, service: 'Google services', region: '' }))
    },
  },
  {
    name: 'Microsoft Azure',
    url: 'https://www.microsoft.com/en-us/download/details.aspx?id=56519',
    min: 10_000,
    async load() {
      const page = await get(this.url, { ua: 'browser' })
      const link = /https:\/\/download\.microsoft\.com\/download\/[^"']+ServiceTags_Public_\d+\.json/.exec(page)?.[0]
      check(link, 'cloud-ips: no Azure service tags link on the download page')
      const j = await get(link, { as: 'json', ua: 'browser' })
      const out = []
      for (const v of j.values) {
        const p = v.properties
        if (v.name.startsWith('AzureCloud.')) {
          for (const cidr of p.addressPrefixes) out.push({ cidr, service: 'Azure', region: p.region || v.name.slice(11) })
        } else if (AZURE_SERVICES.has(v.name)) {
          for (const cidr of p.addressPrefixes) out.push({ cidr, service: v.name.replace('.', ' '), region: '' })
        }
      }
      return out
    },
  },
  {
    name: 'Oracle Cloud',
    url: 'https://docs.oracle.com/en-us/iaas/tools/public_ip_ranges.json',
    min: 500,
    async load() {
      const j = await get(this.url, { as: 'json' })
      return j.regions.flatMap((r) =>
        r.cidrs.map((c) => ({ cidr: c.cidr, service: c.tags.includes('OBJECT_STORAGE') ? 'Object Storage' : c.tags.includes('OSN') ? 'Oracle Services Network' : 'OCI', region: r.region })),
      )
    },
  },
  {
    name: 'Cloudflare',
    url: 'https://www.cloudflare.com/ips-v4',
    min: 10,
    async load() {
      const [v4, v6] = await Promise.all([get('https://www.cloudflare.com/ips-v4'), get('https://www.cloudflare.com/ips-v6')])
      return `${v4}\n${v6}`
        .split(/\s+/)
        .filter(Boolean)
        .map((cidr) => ({ cidr, service: 'CDN and proxy', region: '' }))
    },
  },
  {
    name: 'Fastly',
    url: 'https://api.fastly.com/public-ip-list',
    min: 10,
    async load() {
      const j = await get(this.url, { as: 'json' })
      return [...j.addresses, ...j.ipv6_addresses].map((cidr) => ({ cidr, service: 'CDN', region: '' }))
    },
  },
  {
    name: 'DigitalOcean',
    url: 'https://digitalocean.com/geo/google.csv',
    min: 300,
    async load() {
      return geofeed(await get(this.url)).map((r) => ({ cidr: r.cidr, service: 'Cloud', region: geo(r) }))
    },
  },
  {
    name: 'Akamai Cloud (Linode)',
    url: 'https://geoip.linode.com/',
    min: 300,
    async load() {
      return geofeed(await get(this.url)).map((r) => ({ cidr: r.cidr, service: 'Cloud', region: geo(r) }))
    },
  },
  {
    name: 'Vultr',
    url: 'https://geofeed.constant.com/',
    min: 100,
    async load() {
      return geofeed(await get(this.url)).map((r) => ({ cidr: r.cidr, service: 'Cloud', region: geo(r) }))
    },
  },
]

/**
 * Flattens overlapping ranges into disjoint segments.
 * entries: [{ start: bigint, end: bigint, label: number }] -> [{ start, end, labels: number[] }]
 */
export function flatten(entries) {
  const events = []
  for (const e of entries) {
    events.push([e.start, 1, e.label])
    events.push([e.end + 1n, -1, e.label])
  }
  events.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  const active = new Map()
  const out = []
  for (let i = 0; i < events.length; ) {
    const at = events[i][0]
    while (i < events.length && events[i][0] === at) {
      const [, d, label] = events[i]
      const n = (active.get(label) ?? 0) + d
      if (n) active.set(label, n)
      else active.delete(label)
      i++
    }
    if (i >= events.length || !active.size) continue
    const labels = [...active.keys()].sort((a, b) => a - b)
    const end = events[i][0] - 1n
    const last = out[out.length - 1]
    if (last && last.end + 1n === at && last.labels.join() === labels.join()) last.end = end
    else out.push({ start: at, end, labels })
  }
  return out
}

/** In each covering set, a provider-wide label ("Amazon (all services)") gives way to a specific one. */
function pruneSet(labelIds, labels) {
  const specific = labelIds.filter((id) => !/\(all services\)$/.test(labels[id][1]))
  const byProvider = new Set(specific.map((id) => labels[id][0]))
  return labelIds.filter((id) => specific.includes(id) || !byProvider.has(labels[id][0]))
}

async function main() {
  const prev = readJson('src/data/cloud-ips.json')
  const labels = []
  const labelIndex = new Map()
  const entries = { v4: [], v6: [] }
  const providers = []
  for (const [pi, p] of PROVIDERS.entries()) {
    const rows = await p.load()
    let n = 0
    for (const r of rows) {
      const c = r.cidr ? parseCidr(r.cidr) : null
      if (!c) continue
      const key = `${pi}\0${r.service}\0${r.region}`
      let id = labelIndex.get(key)
      if (id === undefined) {
        id = labels.length
        labels.push([pi, r.service, r.region])
        labelIndex.set(key, id)
      }
      entries[c.v6 ? 'v6' : 'v4'].push({ start: c.start, end: c.end, label: id })
      n++
    }
    check(n >= p.min, `cloud-ips: ${p.name} has ${n} ranges, expected ${p.min}+`)
    const before = prev?.providers?.find((x) => x.name === p.name)?.ranges
    if (before) check(Math.abs(n - before) / before < 0.4, `cloud-ips: ${p.name} ranges ${before} -> ${n}`)
    providers.push({ name: p.name, url: p.url, ranges: n })
    console.log(`cloud-ips: ${p.name} ${n}`)
  }

  const sets = []
  const setIndex = new Map()
  const lazy = new Map()
  const index = {}
  for (const fam of ['v4', 'v6']) {
    const segs = flatten(entries[fam])
    const rows = segs.map((s) => {
      const ids = pruneSet(s.labels, labels)
      const key = ids.join(',')
      let id = setIndex.get(key)
      if (id === undefined) {
        id = sets.length
        sets.push(ids)
        setIndex.set(key, id)
      }
      return [s.start, s.end, id]
    })
    index[fam] = []
    for (let i = 0, n = 0; i < rows.length; i += CHUNK, n++) {
      const part = rows.slice(i, i + CHUNK)
      if (fam === 'v4') {
        index.v4.push(Number(part[0][0]).toString(36))
        let prevEnd = part[0][0] - 1n
        lazy.set(
          `v4/${n}.txt`,
          part
            .map(([s, e, id]) => {
              const line = `${Number(s - prevEnd - 1n).toString(36)},${Number(e - s).toString(36)},${id.toString(36)}`
              prevEnd = e
              return line
            })
            .join('\n'),
        )
      } else {
        const hex = (b) => b.toString(16).padStart(32, '0')
        index.v6.push(trimStart6(hex(part[0][0])))
        lazy.set(`v6/${n}.txt`, part.map(([s, e, id]) => `${trimStart6(hex(s))},${trimEnd6(hex(e))},${id.toString(36)}`).join('\n'))
      }
    }
    console.log(`cloud-ips: ${fam} ${rows.length} segments`)
  }
  check(sets.length > 50, `cloud-ips: ${sets.length} label sets`)
  lazy.set('sets.json', JSON.stringify({ labels, sets }))

  commit(
    'cloud-ips',
    {
      meta: meta({
        source: { name: 'the IP range files each provider publishes', url: '' },
        licence: { name: 'Published by each provider for public use in firewall rules (factual data)', url: '' },
        validFor: new Date().toISOString().slice(0, 10),
      }),
      providers,
      v4: index.v4,
      v6: index.v6,
    },
    lazy,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('cloud-ips', main)
