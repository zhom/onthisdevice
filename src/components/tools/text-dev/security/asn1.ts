/** Minimal DER (ASN.1) reader and writer, PEM armor and the object identifiers that certificates and keys use. */

export interface Node {
  tag: number
  /** Context-specific tag number for [n] tags, else -1. */
  ctx: number
  constructed: boolean
  /** Offsets in the source buffer. */
  start: number
  header: number
  length: number
  value: Uint8Array
  children: Node[]
}

export function parseDer(bytes: Uint8Array, offset = 0, end = bytes.length): Node[] {
  const out: Node[] = []
  let i = offset
  while (i < end) {
    const start = i
    const tag = bytes[i++]
    if (tag === undefined) break
    if ((tag & 0x1f) === 0x1f) throw new Error('High tag numbers are not supported.')
    let len = bytes[i++]
    if (len === undefined) throw new Error('The data ends inside an ASN.1 header.')
    if (len & 0x80) {
      const n = len & 0x7f
      if (n === 0 || n > 4) throw new Error('Unsupported ASN.1 length.')
      len = 0
      for (let k = 0; k < n; k++) len = len * 256 + bytes[i++]
    }
    if (i + len > end) throw new Error('An ASN.1 value runs past the end of the data. The input is cut off or not DER.')
    const value = bytes.subarray(i, i + len)
    const constructed = (tag & 0x20) !== 0
    const node: Node = { tag, ctx: (tag & 0xc0) === 0x80 ? tag & 0x1f : -1, constructed, start, header: i - start, length: len, value, children: [] }
    if (constructed) node.children = parseDer(bytes, i, i + len)
    out.push(node)
    i += len
  }
  return out
}

export const raw = (bytes: Uint8Array, n: Node) => bytes.subarray(n.start, n.start + n.header + n.length)

export function oid(value: Uint8Array): string {
  const parts: number[] = [Math.floor(value[0] / 40), value[0] % 40]
  let n = 0
  for (let i = 1; i < value.length; i++) {
    n = n * 128 + (value[i] & 0x7f)
    if (!(value[i] & 0x80)) {
      parts.push(n)
      n = 0
    }
  }
  return parts.join('.')
}

export function bigHex(value: Uint8Array): string {
  let i = 0
  while (i < value.length - 1 && value[i] === 0) i++
  return Array.from(value.subarray(i), (b) => b.toString(16).padStart(2, '0')).join(':')
}

export function bitLength(value: Uint8Array): number {
  let i = 0
  while (i < value.length && value[i] === 0) i++
  if (i === value.length) return 0
  return (value.length - i - 1) * 8 + (32 - Math.clz32(value[i]))
}

const td = new TextDecoder()

export function asString(n: Node): string {
  // BMPString is UTF-16BE; everything else is UTF-8 or a subset of it.
  if (n.tag === 0x1e) {
    let s = ''
    for (let i = 0; i + 1 < n.value.length; i += 2) s += String.fromCharCode((n.value[i] << 8) | n.value[i + 1])
    return s
  }
  return td.decode(n.value)
}

export function asTime(n: Node): Date {
  const s = td.decode(n.value)
  const m = n.tag === 0x17 ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/.exec(s) : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/.exec(s)
  if (!m) return new Date(Number.NaN)
  let year = Number(m[1])
  if (n.tag === 0x17) year += year < 50 ? 2000 : 1900
  return new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)))
}

export const OIDS: Record<string, string> = {
  '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.5': 'serialNumber',
  '2.5.4.9': 'street', '2.5.4.17': 'postalCode', '2.5.4.4': 'SN', '2.5.4.42': 'GN', '2.5.4.12': 'title', '2.5.4.97': 'organizationIdentifier',
  '1.2.840.113549.1.9.1': 'emailAddress', '0.9.2342.19200300.100.1.25': 'DC', '1.3.6.1.4.1.311.60.2.1.3': 'jurisdictionC', '2.5.4.15': 'businessCategory',
  '1.2.840.113549.1.1.1': 'RSA', '1.2.840.10045.2.1': 'EC', '1.3.101.112': 'Ed25519', '1.3.101.113': 'Ed448', '1.3.101.110': 'X25519',
  '1.2.840.113549.1.1.5': 'SHA-1 with RSA', '1.2.840.113549.1.1.11': 'SHA-256 with RSA', '1.2.840.113549.1.1.12': 'SHA-384 with RSA',
  '1.2.840.113549.1.1.13': 'SHA-512 with RSA', '1.2.840.113549.1.1.10': 'RSA-PSS', '1.2.840.113549.1.1.4': 'MD5 with RSA',
  '1.2.840.10045.4.3.2': 'ECDSA with SHA-256', '1.2.840.10045.4.3.3': 'ECDSA with SHA-384', '1.2.840.10045.4.3.4': 'ECDSA with SHA-512',
  '1.2.840.10045.3.1.7': 'P-256', '1.3.132.0.34': 'P-384', '1.3.132.0.35': 'P-521', '1.3.132.0.10': 'secp256k1',
  '2.5.29.17': 'Subject Alternative Name', '2.5.29.15': 'Key Usage', '2.5.29.37': 'Extended Key Usage', '2.5.29.19': 'Basic Constraints',
  '2.5.29.14': 'Subject Key Identifier', '2.5.29.35': 'Authority Key Identifier', '2.5.29.31': 'CRL Distribution Points',
  '1.3.6.1.5.5.7.1.1': 'Authority Information Access', '2.5.29.32': 'Certificate Policies', '1.3.6.1.4.1.11129.2.4.2': 'Signed Certificate Timestamps',
  '1.3.6.1.5.5.7.3.1': 'TLS server', '1.3.6.1.5.5.7.3.2': 'TLS client', '1.3.6.1.5.5.7.3.3': 'Code signing', '1.3.6.1.5.5.7.3.4': 'Email protection',
  '1.3.6.1.5.5.7.3.8': 'Time stamping', '1.3.6.1.5.5.7.3.9': 'OCSP signing', '1.3.6.1.5.5.7.48.1': 'OCSP', '1.3.6.1.5.5.7.48.2': 'CA issuers',
  '2.23.140.1.2.1': 'Domain validated', '2.23.140.1.2.2': 'Organization validated', '2.23.140.1.1': 'Extended validation',
  '1.2.840.113549.1.9.14': 'Extension request', '1.2.840.113549.1.9.7': 'Challenge password',
}

export const oidName = (o: string) => OIDS[o] ?? o

/** Distinguished name: SEQUENCE of SET of SEQUENCE { type, value }. */
export function dn(n: Node): string {
  return n.children
    .flatMap((set) => set.children.map((atv) => `${oidName(oid(atv.children[0].value))}=${asString(atv.children[1])}`))
    .join(', ')
}

/* ── PEM ── */

export function pemBlocks(text: string): { label: string; der: Uint8Array }[] {
  const out: { label: string; der: Uint8Array }[] = []
  for (const m of text.matchAll(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g)) {
    const b64 = m[2].replace(/^[\w-]+:.*$/gm, '').replace(/[^A-Za-z0-9+/=]/g, '')
    out.push({ label: m[1], der: fromBase64(b64) })
  }
  if (out.length === 0) {
    const b64 = text.replace(/\s+/g, '')
    if (/^[A-Za-z0-9+/=]{40,}$/.test(b64)) out.push({ label: '', der: fromBase64(b64) })
  }
  return out
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export const toPem = (label: string, der: Uint8Array, width = 64) => `-----BEGIN ${label}-----\n${(toBase64(der).match(new RegExp(`.{1,${width}}`, 'g')) ?? []).join('\n')}\n-----END ${label}-----\n`

/* ── DER writer ── */

function len(n: number): number[] {
  if (n < 128) return [n]
  const bytes: number[] = []
  for (let x = n; x > 0; x = Math.floor(x / 256)) bytes.unshift(x % 256)
  return [0x80 | bytes.length, ...bytes]
}

export const tlv = (tag: number, value: Uint8Array) => new Uint8Array([tag, ...len(value.length), ...value])
export const seq = (...parts: Uint8Array[]) => tlv(0x30, concat(...parts))
export const octets = (value: Uint8Array) => tlv(0x04, value)
export const derNull = () => new Uint8Array([0x05, 0x00])
export const integer = (value: Uint8Array) => tlv(0x02, value[0] & 0x80 ? concat(new Uint8Array([0]), value) : value)

export function encodeOid(o: string): Uint8Array {
  const [a, b, ...rest] = o.split('.').map(Number)
  const out = [a * 40 + b]
  for (const n of rest) {
    const chunk: number[] = []
    let x = n
    do {
      chunk.unshift(x & 0x7f)
      x = Math.floor(x / 128)
    } while (x > 0)
    out.push(...chunk.map((c, i) => (i < chunk.length - 1 ? c | 0x80 : c)))
  }
  return tlv(0x06, new Uint8Array(out))
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
