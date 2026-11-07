/** ID formats: ObjectId, Snowflake, ULID, Nano ID and MAC addresses. Random bytes come from crypto.getRandomValues. */

const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n))
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

export const iso = (ms: number) => {
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? 'Out of range' : d.toISOString()
}

/* ── ObjectId: 4-byte seconds, 5 random bytes, 3-byte counter ── */

export interface ObjectIdParts {
  seconds: number
  random: string
  counter: number
}

export function decodeObjectId(id: string): ObjectIdParts {
  const s = id.trim().replace(/^ObjectId\(["']?|["']?\)$/g, '')
  if (!/^[0-9a-f]{24}$/i.test(s)) throw new Error('An ObjectId is 24 hex characters, such as 6560f4b9c3a5e2d1f0a1b2c3.')
  return { seconds: parseInt(s.slice(0, 8), 16), random: s.slice(8, 18).toLowerCase(), counter: parseInt(s.slice(18), 16) }
}

let oidCounter = Math.floor(Math.random() * 0xffffff)

export function newObjectId(atMs = Date.now()): string {
  oidCounter = (oidCounter + 1) % 0x1000000
  return Math.floor(atMs / 1000).toString(16).padStart(8, '0') + hex(rand(5)) + oidCounter.toString(16).padStart(6, '0')
}

/* ── Snowflake: 41-bit ms since an epoch, 10-bit worker, 12-bit sequence ── */

export interface SnowflakeParts {
  ms: number
  worker: number
  datacenter: number
  sequence: number
}

export function decodeSnowflake(id: string, epoch: number): SnowflakeParts {
  const s = id.trim()
  if (!/^\d{1,20}$/.test(s)) throw new Error('A Snowflake ID is a whole number of up to 20 digits.')
  const n = BigInt(s)
  if (n >= 1n << 64n) throw new Error('This number is larger than 64 bits.')
  return {
    ms: Number(n >> 22n) + epoch,
    datacenter: Number((n >> 17n) & 31n),
    worker: Number((n >> 12n) & 31n),
    sequence: Number(n & 4095n),
  }
}

export function encodeSnowflake(ms: number, epoch: number, datacenter = 0, worker = 0, sequence = 0): string {
  const t = BigInt(Math.max(0, ms - epoch))
  return ((t << 22n) | (BigInt(datacenter & 31) << 17n) | (BigInt(worker & 31) << 12n) | BigInt(sequence & 4095)).toString()
}

/* ── ULID: 48-bit ms + 80 random bits in Crockford Base32 ── */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function encodeBase32(n: bigint, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out = CROCKFORD[Number(n & 31n)] + out
    n >>= 5n
  }
  return out
}

let lastUlid = { ms: -1, random: 0n }

/** Monotonic ULIDs: within one millisecond the random part counts up, so the IDs still sort in order. */
export function newUlid(ms = Date.now(), monotonic = true): string {
  let random: bigint
  if (monotonic && ms === lastUlid.ms) random = (lastUlid.random + 1n) & ((1n << 80n) - 1n)
  else random = BigInt(`0x${hex(rand(10))}`)
  lastUlid = { ms, random }
  return encodeBase32(BigInt(ms), 10) + encodeBase32(random, 16)
}

export function decodeUlid(id: string): { ms: number; random: string } {
  const s = id.trim().toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1')
  if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(s)) throw new Error('A ULID is 26 Crockford Base32 characters and starts with 0 to 7.')
  let t = 0n
  for (const c of s.slice(0, 10)) t = t * 32n + BigInt(CROCKFORD.indexOf(c))
  return { ms: Number(t), random: s.slice(10) }
}

/* ── Nano ID ── */

export const NANO_ALPHABETS: Record<string, string> = {
  url: 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict',
  alnum: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  lower: '0123456789abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  nolookalikes: '6789BCDFGHJKLMNPQRTWbcdfghjkmnpqrtwz',
  hex: '0123456789abcdef',
}

/** Unbiased: random bytes are masked to the next power of two and values past the alphabet are skipped. */
export function nanoid(alphabet: string, size: number): string {
  const chars = [...new Set(alphabet)]
  if (chars.length < 2) throw new Error('The alphabet needs at least 2 different characters.')
  if (chars.length > 256) throw new Error('The alphabet can have at most 256 characters.')
  const mask = (2 << Math.floor(Math.log2(chars.length - 1))) - 1
  let id = ''
  while (id.length < size) {
    for (const b of rand(Math.ceil((1.6 * mask * size) / chars.length))) {
      const i = b & mask
      if (i < chars.length) id += chars[i]
      if (id.length === size) break
    }
  }
  return id
}

/** IDs to generate for a 1% chance of at least one collision (birthday bound). */
export function idsForOnePercent(alphabetSize: number, size: number): number {
  const bits = size * Math.log2(alphabetSize)
  return Math.sqrt(2 * 2 ** bits * Math.log(1 / 0.99))
}

/* ── MAC addresses ── */

export function newMac(o: { local: boolean; multicast: boolean; prefix: string; separator: string; upper: boolean }): string {
  const bytes = rand(6)
  const pre = o.prefix.replace(/[^0-9a-f]/gi, '')
  if (pre.length % 2 !== 0 || pre.length > 10) throw new Error('The prefix must be 1 to 5 bytes of hex, such as 00:1A:2B.')
  for (let i = 0; i < pre.length / 2; i++) bytes[i] = parseInt(pre.slice(i * 2, i * 2 + 2), 16)
  if (!pre) {
    // Bit 0 of the first byte: multicast. Bit 1: locally administered.
    bytes[0] = (bytes[0] & 0b11111100) | (o.local ? 2 : 0) | (o.multicast ? 1 : 0)
  }
  const h = hex(bytes)
  const pairs = h.match(/../g) ?? []
  const out = o.separator === '.' ? (h.match(/..../g) ?? []).join('.') : pairs.join(o.separator)
  return o.upper ? out.toUpperCase() : out
}
