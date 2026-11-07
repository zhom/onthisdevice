/** URLs, query strings and IP address notations. */

export function parseUrl(input: string): URL {
  const s = input.trim()
  try {
    return new URL(s)
  } catch {
    try {
      // "example.com/path" without a scheme: assume https.
      if (/^[\w-]+(\.[\w-]+)+([/:?#]|$)/.test(s)) return new URL(`https://${s}`)
    } catch {
      /* fall through */
    }
    throw new Error('This is not a valid URL. A URL looks like https://example.com/path?query=1.')
  }
}

const DEFAULT_PORTS: Record<string, string> = { 'http:': '80', 'https:': '443', 'ftp:': '21', 'ws:': '80', 'wss:': '443' }
export const defaultPort = (u: URL) => u.port || DEFAULT_PORTS[u.protocol] || ''

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

/** "a[b][]" to ["a", "b", ""]. Keys without brackets stay whole. */
function keyPath(key: string): string[] {
  const m = /^([^[\]]+)((?:\[[^\]]*\])+)$/.exec(key)
  return m ? [m[1], ...[...m[2].matchAll(/\[([^\]]*)\]/g)].map((x) => x[1])] : [key]
}

const isObject = (v: Json | undefined): v is { [k: string]: Json } => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Query string to an object. Repeated keys become arrays; a[b]=1 and a[]=1 nest when asked. */
export function queryToObject(input: string, nested: boolean): Record<string, Json> {
  let q = input.trim()
  const qi = q.indexOf('?')
  if (qi >= 0) q = q.slice(qi + 1)
  else if (/^[a-z][\w+.-]*:\/\//i.test(q)) q = ''
  q = q.replace(/#.*$/, '')
  const out: Record<string, Json> = {}
  const put = (node: Record<string, Json>, k: string, v: string, list: boolean) => {
    const prev = node[k]
    node[k] = prev === undefined ? (list ? [v] : v) : Array.isArray(prev) ? [...prev, v] : [prev, v]
  }
  for (const [key, value] of new URLSearchParams(q)) {
    const path = nested ? keyPath(key) : [key]
    const list = path.length > 1 && path[path.length - 1] === ''
    const names = list ? path.slice(0, -1) : path
    let node = out
    for (const k of names.slice(0, -1)) {
      const child = node[k]
      if (!isObject(child)) node[k] = {}
      node = node[k] as Record<string, Json>
    }
    put(node, names[names.length - 1], value, list)
  }
  return out
}

export function objectToQuery(value: unknown, o: { arrays: 'repeat' | 'brackets' | 'index' | 'comma'; plus: boolean }): string {
  const parts: [string, string][] = []
  const add = (key: string, v: unknown) => {
    if (v === undefined) return
    if (Array.isArray(v)) {
      if (o.arrays === 'comma') parts.push([key, v.map((x) => (typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x))).join(',')])
      else v.forEach((x, i) => add(o.arrays === 'repeat' ? key : o.arrays === 'brackets' ? `${key}[]` : `${key}[${i}]`, x))
    } else if (v !== null && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) add(`${key}[${k}]`, x)
    } else parts.push([key, v === null ? '' : String(v)])
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object, such as {"q": "search", "page": 2}.')
  for (const [k, v] of Object.entries(value)) add(k, v)
  const enc = (s: string) => encodeURIComponent(s).replace(/%5B/g, '[').replace(/%5D/g, ']').replace(/%20/g, o.plus ? '+' : '%20')
  return parts.map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&')
}

/* ── IPv6 ── */

export function expandIpv6(input: string): string[] {
  let s = input.trim().replace(/^\[|\]$/g, '').replace(/%.*$/, '').replace(/\/\d+$/, '')
  // An embedded IPv4 tail (::ffff:192.0.2.1) becomes two hex groups.
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s)
  if (v4) {
    const b = v4.slice(1).map(Number)
    if (b.some((x) => x > 255)) throw new Error('The IPv4 part of the address is out of range.')
    s = s.slice(0, v4.index) + `${((b[0] << 8) | b[1]).toString(16)}:${((b[2] << 8) | b[3]).toString(16)}`
  }
  if (!/^[0-9a-f:]+$/i.test(s) || (s.match(/::/g) ?? []).length > 1) throw new Error('This is not a valid IPv6 address.')
  const [head, tail] = s.includes('::') ? s.split('::') : [s, undefined]
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const missing = 8 - h.length - t.length
  if ((tail === undefined && h.length !== 8) || (tail !== undefined && missing < 1)) throw new Error('An IPv6 address has 8 groups of hex digits, or fewer with ::.')
  const groups = [...h, ...new Array<string>(tail === undefined ? 0 : missing).fill('0'), ...t]
  if (groups.some((g) => g.length === 0 || g.length > 4)) throw new Error('Each IPv6 group has 1 to 4 hex digits.')
  return groups.map((g) => g.toLowerCase().padStart(4, '0'))
}

/** RFC 5952: no leading zeros, the longest run of two or more zero groups becomes ::, lowercase. */
export function compressIpv6(groups: string[]): string {
  const short = groups.map((g) => g.replace(/^0+(?=.)/, ''))
  let best = { start: -1, len: 0 }
  for (let i = 0; i < 8; ) {
    if (short[i] !== '0') {
      i++
      continue
    }
    let j = i
    while (j < 8 && short[j] === '0') j++
    if (j - i > best.len) best = { start: i, len: j - i }
    i = j
  }
  if (best.len < 2) return short.join(':')
  return `${short.slice(0, best.start).join(':')}::${short.slice(best.start + best.len).join(':')}`
}

export function ipv6Kind(groups: string[]): string {
  const g0 = parseInt(groups[0], 16)
  const all = groups.join('')
  if (/^0{31}1$/.test(all)) return 'Loopback (::1)'
  if (/^0{32}$/.test(all)) return 'Unspecified (::)'
  if (all.startsWith('00000000000000000000ffff')) return 'IPv4-mapped'
  if ((g0 & 0xffc0) === 0xfe80) return 'Link-local (fe80::/10)'
  if ((g0 & 0xfe00) === 0xfc00) return 'Unique local (fc00::/7)'
  if ((g0 & 0xff00) === 0xff00) return 'Multicast (ff00::/8)'
  if (groups[0] === '2001' && groups[1] === '0db8') return 'Documentation (2001:db8::/32)'
  if ((g0 & 0xe000) === 0x2000) return 'Global unicast (2000::/3)'
  return 'Reserved'
}

export const ipv6Arpa = (groups: string[]) => `${[...groups.join('')].reverse().join('.')}.ip6.arpa`

/* ── IPv4 ── */

export function ipv4ToNumber(ip: string): number {
  const parts = ip.trim().split('.')
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)) throw new Error(`${ip.trim()} is not an IPv4 address such as 192.168.1.1.`)
  return parts.reduce((n, p) => n * 256 + Number(p), 0)
}

export function numberToIpv4(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error('An IPv4 number is a whole number from 0 to 4294967295.')
  return [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join('.')
}
