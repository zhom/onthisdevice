/**
 * Shared primitives for the Security & Privacy tools.
 *
 * Everything in this module runs locally in the tab. There is no network code
 * anywhere in here by design: passwords, plaintext and file bytes must never
 * leave the device.
 *
 * Contents:
 *   1. Randomness      — crypto.getRandomValues only, with unbiased integers.
 *   2. Encoding        — hex / base64 / UTF-8 helpers.
 *   3. Presentation    — entropy bands, crack-time and big-number formatting.
 *   4. Hashing         — incremental MD5, SHA-1, SHA-256 and SHA-512 so that
 *                        multi-gigabyte files can be streamed in slices
 *                        (crypto.subtle has no streaming digest API).
 *   5. File helpers    — chunked hashing and byte-exact file comparison.
 */

import { nextFrame } from '@/lib/utils'

/* ================================================================== */
/* 1. Randomness                                                       */
/* ================================================================== */

const MAX_UINT32 = 0xffffffff
/** getRandomValues rejects requests larger than 65 536 bytes. */
const RNG_CHUNK = 65536

/** Cryptographically secure random bytes of any length. */
export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length)
  for (let offset = 0; offset < length; offset += RNG_CHUNK) {
    crypto.getRandomValues(out.subarray(offset, Math.min(offset + RNG_CHUNK, length)))
  }
  return out
}

/**
 * A uniform integer in [0, maxExclusive).
 *
 * `getRandomValues() % n` is biased whenever n does not divide 2^32 evenly, so
 * values in the final partial bucket are rejected and redrawn. That rejection
 * is what makes "pick a random character" genuinely uniform.
 */
export function randomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > MAX_UINT32 + 1) {
    throw new RangeError(`randomInt needs an integer bound in 1..2^32, got ${maxExclusive}`)
  }
  if (maxExclusive === 1) return 0
  const limit = Math.floor((MAX_UINT32 + 1) / maxExclusive) * maxExclusive
  const buffer = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)
  return value % maxExclusive
}

/** A uniformly chosen element. Throws on an empty list rather than returning undefined. */
export function randomItem<T>(items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('randomItem called with an empty list')
  return items[randomInt(items.length)]
}

/** In-place Fisher-Yates shuffle driven by the CSPRNG — every permutation equally likely. */
export function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    const swap = items[i]
    items[i] = items[j]
    items[j] = swap
  }
  return items
}

/* ================================================================== */
/* 2. Encoding                                                         */
/* ================================================================== */

const HEX = '0123456789abcdef'

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    out += HEX[bytes[i] >>> 4] + HEX[bytes[i] & 15]
  }
  return out
}

/** Parses hex, ignoring whitespace and case. Returns null when it isn't hex. */
export function hexToBytes(input: string): Uint8Array | null {
  const clean = input.replace(/[\s:-]/g, '').toLowerCase()
  if (clean.length === 0 || clean.length % 2 !== 0 || /[^0-9a-f]/.test(clean)) return null
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)))
  }
  return btoa(binary)
}

/** Decodes base64 (standard or URL-safe, whitespace tolerated). Throws on invalid input. */
export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = clean.length % 4 === 0 ? clean : clean + '='.repeat(4 - (clean.length % 4))
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

const TEXT_ENCODER = new TextEncoder()

export function utf8Encode(text: string): Uint8Array {
  return TEXT_ENCODER.encode(text)
}

export function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

/** Splits a long base64 string into fixed-width lines so it survives email and chat. */
export function wrapBase64(input: string, width = 72): string {
  if (width <= 0) return input
  const lines: string[] = []
  for (let i = 0; i < input.length; i += width) lines.push(input.slice(i, i + width))
  return lines.join('\n')
}

/** Length-independent equality for digests — habit worth keeping even client side. */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/* ================================================================== */
/* 3. Presentation                                                     */
/* ================================================================== */

export type StrengthScore = 0 | 1 | 2 | 3 | 4

export interface StrengthBand {
  score: StrengthScore
  label: string
  /** Tailwind token for the meter fill. Never the only signal — the label always shows. */
  barClass: string
  textClass: string
  summary: string
}

const BANDS: StrengthBand[] = [
  {
    score: 0,
    label: 'Very weak',
    barClass: 'bg-foreground',
    textClass: 'text-foreground',
    summary: 'Guessable in seconds by anyone with a copy of the password hash.',
  },
  {
    score: 1,
    label: 'Weak',
    barClass: 'bg-foreground',
    textClass: 'text-foreground',
    summary: 'Falls to a normal offline cracking rig in minutes to hours.',
  },
  {
    score: 2,
    label: 'Fair',
    barClass: 'bg-foreground',
    textClass: 'text-foreground',
    summary: 'Fine for low-value accounts, not for email, banking or a password manager.',
  },
  {
    score: 3,
    label: 'Strong',
    barClass: 'bg-foreground',
    textClass: 'text-foreground',
    summary: 'Resists offline cracking with today’s hardware.',
  },
  {
    score: 4,
    label: 'Excellent',
    barClass: 'bg-foreground',
    textClass: 'text-foreground',
    summary: 'Far beyond any realistic brute-force budget.',
  },
]

/** Maps entropy in bits onto a five-step band. Thresholds: 28 / 36 / 60 / 80. */
export function bandForBits(bits: number): StrengthBand {
  if (!Number.isFinite(bits) || bits < 28) return BANDS[0]
  if (bits < 36) return BANDS[1]
  if (bits < 60) return BANDS[2]
  if (bits < 80) return BANDS[3]
  return BANDS[4]
}

/** Entropy of `length` independent picks from a pool of `poolSize` symbols. */
export function entropyBits(poolSize: number, length: number): number {
  if (poolSize <= 1 || length <= 0) return 0
  return Math.log2(poolSize) * length
}

/** "2.4 × 10^38" for numbers past the point where digit groups stop meaning anything. */
export function formatBigCount(value: number): string {
  if (!Number.isFinite(value)) return '∞'
  if (value < 1e15) return Math.round(value).toLocaleString()
  const exponent = Math.floor(Math.log10(value))
  const mantissa = value / 10 ** exponent
  return `${mantissa.toFixed(2)} × 10^${exponent}`
}

/** Same idea, but starting from log2 so it never overflows a double. */
export function formatCountFromBits(bits: number): string {
  if (!Number.isFinite(bits)) return '∞'
  if (bits < 50) return Math.round(2 ** bits).toLocaleString()
  const log10 = bits * Math.log10(2)
  const exponent = Math.floor(log10)
  const mantissa = 10 ** (log10 - exponent)
  return `${mantissa.toFixed(2)} × 10^${exponent}`
}

const MINUTE = 60
const HOUR = 3600
const DAY = 86400
const MONTH = 2629800
const YEAR = 31557600

function plural(value: number, unit: string): string {
  const rounded = Math.round(value)
  return `${rounded.toLocaleString()} ${unit}${rounded === 1 ? '' : 's'}`
}

/** Human crack times, deliberately vague at the extremes rather than falsely precise. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'effectively forever'
  if (seconds < 1e-3) return 'instantly'
  if (seconds < 1) return 'under a second'
  if (seconds < MINUTE) return plural(seconds, 'second')
  if (seconds < HOUR) return plural(seconds / MINUTE, 'minute')
  if (seconds < DAY) return plural(seconds / HOUR, 'hour')
  if (seconds < MONTH) return plural(seconds / DAY, 'day')
  if (seconds < YEAR) return plural(seconds / MONTH, 'month')
  const years = seconds / YEAR
  if (years < 1000) return plural(years, 'year')
  if (years < 1e6) return `${Math.round(years / 1000).toLocaleString()} thousand years`
  if (years < 1e9) return `${Math.round(years / 1e6).toLocaleString()} million years`
  if (years < 1e12) return `${Math.round(years / 1e9).toLocaleString()} billion years`
  if (years < 1e15) return `${Math.round(years / 1e12).toLocaleString()} trillion years`
  return 'longer than the age of the universe'
}

/** Crack time from log2(guesses) so very large search spaces stay representable. */
export function crackTimeFromBits(bits: number, guessesPerSecond: number): string {
  // On average half the space is searched before a hit.
  const logSeconds = bits - 1 - Math.log2(guessesPerSecond)
  if (logSeconds > 400) return 'longer than the age of the universe'
  return formatDuration(2 ** logSeconds)
}

export interface AttackScenario {
  id: string
  name: string
  detail: string
  guessesPerSecond: number
}

/**
 * Attack rates used across the password tools. The offline figures assume the
 * attacker already has the password database — the case that actually matters.
 */
export const ATTACK_SCENARIOS: AttackScenario[] = [
  {
    id: 'online-throttled',
    name: 'Online, rate limited',
    detail: '100 guesses per hour: a login form that locks out after repeated failures',
    guessesPerSecond: 100 / 3600,
  },
  {
    id: 'online-unthrottled',
    name: 'Online, no throttling',
    detail: '1 000 guesses per second: credential stuffing against an unprotected API',
    guessesPerSecond: 1e3,
  },
  {
    id: 'offline-slow',
    name: 'Offline, slow hash',
    detail: '20 000 guesses per second: bcrypt or PBKDF2 on a rented GPU box',
    guessesPerSecond: 2e4,
  },
  {
    id: 'offline-fast',
    name: 'Offline, fast hash',
    detail: '100 billion guesses per second: unsalted SHA-1/MD5 on an eight-GPU rig',
    guessesPerSecond: 1e11,
  },
]

/* ================================================================== */
/* 4. Hashing                                                          */
/* ================================================================== */

/**
 * Round constants for SHA-2 are the fractional parts of the cube roots (K) and
 * square roots (H) of the first primes. Deriving them here with exact BigInt
 * integer roots is both shorter and safer than transcribing 160 hex literals.
 */
const PRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
  101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193,
  197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307,
  311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409,
]

/** floor(value ** (1/degree)) for BigInts, by Newton's method from above. */
function integerRoot(value: bigint, degree: bigint): bigint {
  if (value < 2n) return value
  const bits = value.toString(2).length
  let current = 1n << (BigInt(Math.ceil(bits / Number(degree))) + 1n)
  for (;;) {
    const next = ((degree - 1n) * current + value / current ** (degree - 1n)) / degree
    if (next >= current) return current
    current = next
  }
}

/** The first `fractionBits` bits after the point of prime ** (1/degree). */
function fractionalRoot(prime: number, degree: bigint, fractionBits: bigint): bigint {
  const scaled = BigInt(prime) << (fractionBits * degree)
  return integerRoot(scaled, degree) & ((1n << fractionBits) - 1n)
}

const K256 = new Uint32Array(PRIMES.slice(0, 64).map((p) => Number(fractionalRoot(p, 3n, 32n))))
const H256 = new Uint32Array(PRIMES.slice(0, 8).map((p) => Number(fractionalRoot(p, 2n, 32n))))

const K512_HI = new Uint32Array(80)
const K512_LO = new Uint32Array(80)
const H512_HI = new Uint32Array(8)
const H512_LO = new Uint32Array(8)
{
  const MASK32 = 0xffffffffn
  for (let i = 0; i < 80; i += 1) {
    const k = fractionalRoot(PRIMES[i], 3n, 64n)
    K512_HI[i] = Number(k >> 32n)
    K512_LO[i] = Number(k & MASK32)
  }
  for (let i = 0; i < 8; i += 1) {
    const h = fractionalRoot(PRIMES[i], 2n, 64n)
    H512_HI[i] = Number(h >> 32n)
    H512_LO[i] = Number(h & MASK32)
  }
}

export interface Hasher {
  update(bytes: Uint8Array): void
  digest(): Uint8Array
}

/**
 * Buffers input into fixed-size blocks and applies Merkle-Damgård padding, so
 * each concrete hash only has to implement its compression function.
 */
abstract class BlockHasher implements Hasher {
  private readonly buffer: Uint8Array
  private bufferLength = 0
  private totalBytes = 0
  private finished = false

  protected constructor(
    protected readonly blockSize: number,
    protected readonly lengthFieldSize: number,
  ) {
    this.buffer = new Uint8Array(blockSize)
  }

  protected abstract compress(input: Uint8Array, offset: number): void
  protected abstract finalize(): Uint8Array
  protected abstract writeLength(view: DataView, offset: number, bitLength: number): void

  update(bytes: Uint8Array): void {
    if (this.finished) throw new Error('This hasher has already produced a digest.')
    this.totalBytes += bytes.length
    let offset = 0

    if (this.bufferLength > 0) {
      const take = Math.min(this.blockSize - this.bufferLength, bytes.length)
      this.buffer.set(bytes.subarray(0, take), this.bufferLength)
      this.bufferLength += take
      offset = take
      if (this.bufferLength === this.blockSize) {
        this.compress(this.buffer, 0)
        this.bufferLength = 0
      }
    }

    while (offset + this.blockSize <= bytes.length) {
      this.compress(bytes, offset)
      offset += this.blockSize
    }

    if (offset < bytes.length) {
      this.buffer.set(bytes.subarray(offset), 0)
      this.bufferLength = bytes.length - offset
    }
  }

  digest(): Uint8Array {
    if (this.finished) throw new Error('This hasher has already produced a digest.')
    const needed = this.bufferLength + 1 + this.lengthFieldSize
    const padLength = needed <= this.blockSize ? this.blockSize : this.blockSize * 2
    const padded = new Uint8Array(padLength)
    padded.set(this.buffer.subarray(0, this.bufferLength))
    padded[this.bufferLength] = 0x80
    this.writeLength(
      new DataView(padded.buffer),
      padLength - this.lengthFieldSize,
      this.totalBytes * 8,
    )
    for (let i = 0; i < padLength; i += this.blockSize) this.compress(padded, i)
    this.finished = true
    return this.finalize()
  }
}

/** Splits a bit length that can exceed 2^32 into two 32-bit halves. */
function splitBitLength(bitLength: number): { hi: number; lo: number } {
  return {
    hi: Math.floor(bitLength / 4294967296) >>> 0,
    lo: (bitLength % 4294967296) >>> 0,
  }
}

/* ---------------- MD5 (RFC 1321) ---------------- */

const MD5_SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const MD5_K = new Int32Array(
  Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0),
)

export class Md5 extends BlockHasher {
  private a = 0x67452301
  private b = 0xefcdab89
  private c = 0x98badcfe
  private d = 0x10325476
  private readonly words = new Int32Array(16)

  constructor() {
    super(64, 8)
  }

  protected writeLength(view: DataView, offset: number, bitLength: number): void {
    const { hi, lo } = splitBitLength(bitLength)
    view.setUint32(offset, lo, true)
    view.setUint32(offset + 4, hi, true)
  }

  protected compress(input: Uint8Array, offset: number): void {
    const m = this.words
    for (let i = 0; i < 16; i += 1) {
      const p = offset + i * 4
      m[i] = input[p] | (input[p + 1] << 8) | (input[p + 2] << 16) | (input[p + 3] << 24)
    }

    let a = this.a
    let b = this.b
    let c = this.c
    let d = this.d

    for (let i = 0; i < 64; i += 1) {
      let f: number
      let g: number
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }
      const sum = (a + f + MD5_K[i] + m[g]) | 0
      const s = MD5_SHIFTS[i]
      a = d
      d = c
      c = b
      b = (b + ((sum << s) | (sum >>> (32 - s)))) | 0
    }

    this.a = (this.a + a) | 0
    this.b = (this.b + b) | 0
    this.c = (this.c + c) | 0
    this.d = (this.d + d) | 0
  }

  protected finalize(): Uint8Array {
    const out = new Uint8Array(16)
    const view = new DataView(out.buffer)
    view.setUint32(0, this.a >>> 0, true)
    view.setUint32(4, this.b >>> 0, true)
    view.setUint32(8, this.c >>> 0, true)
    view.setUint32(12, this.d >>> 0, true)
    return out
  }
}

/* ---------------- SHA-1 (FIPS 180-4) ---------------- */

export class Sha1 extends BlockHasher {
  private readonly h = new Int32Array([
    0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476, 0xc3d2e1f0 | 0,
  ])
  private readonly w = new Int32Array(80)

  constructor() {
    super(64, 8)
  }

  protected writeLength(view: DataView, offset: number, bitLength: number): void {
    const { hi, lo } = splitBitLength(bitLength)
    view.setUint32(offset, hi, false)
    view.setUint32(offset + 4, lo, false)
  }

  protected compress(input: Uint8Array, offset: number): void {
    const w = this.w
    for (let i = 0; i < 16; i += 1) {
      const p = offset + i * 4
      w[i] = (input[p] << 24) | (input[p + 1] << 16) | (input[p + 2] << 8) | input[p + 3]
    }
    for (let i = 16; i < 80; i += 1) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]
      w[i] = (x << 1) | (x >>> 31)
    }

    let a = this.h[0]
    let b = this.h[1]
    let c = this.h[2]
    let d = this.h[3]
    let e = this.h[4]

    for (let i = 0; i < 80; i += 1) {
      let f: number
      let k: number
      if (i < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (i < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc | 0
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6 | 0
      }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0
      e = d
      d = c
      c = (b << 30) | (b >>> 2)
      b = a
      a = temp
    }

    this.h[0] = (this.h[0] + a) | 0
    this.h[1] = (this.h[1] + b) | 0
    this.h[2] = (this.h[2] + c) | 0
    this.h[3] = (this.h[3] + d) | 0
    this.h[4] = (this.h[4] + e) | 0
  }

  protected finalize(): Uint8Array {
    const out = new Uint8Array(20)
    const view = new DataView(out.buffer)
    for (let i = 0; i < 5; i += 1) view.setUint32(i * 4, this.h[i] >>> 0, false)
    return out
  }
}

/* ---------------- SHA-256 (FIPS 180-4) ---------------- */

export class Sha256 extends BlockHasher {
  private readonly h = new Uint32Array(H256)
  private readonly w = new Uint32Array(64)

  constructor() {
    super(64, 8)
  }

  protected writeLength(view: DataView, offset: number, bitLength: number): void {
    const { hi, lo } = splitBitLength(bitLength)
    view.setUint32(offset, hi, false)
    view.setUint32(offset + 4, lo, false)
  }

  protected compress(input: Uint8Array, offset: number): void {
    const w = this.w
    for (let i = 0; i < 16; i += 1) {
      const p = offset + i * 4
      w[i] = ((input[p] << 24) | (input[p + 1] << 16) | (input[p + 2] << 8) | input[p + 3]) >>> 0
    }
    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15]
      const y = w[i - 2]
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }

    let a = this.h[0]
    let b = this.h[1]
    let c = this.h[2]
    let d = this.h[3]
    let e = this.h[4]
    let f = this.h[5]
    let g = this.h[6]
    let hh = this.h[7]

    for (let i = 0; i < 64; i += 1) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + s1 + ch + K256[i] + w[i]) >>> 0
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (s0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }

    this.h[0] = (this.h[0] + a) >>> 0
    this.h[1] = (this.h[1] + b) >>> 0
    this.h[2] = (this.h[2] + c) >>> 0
    this.h[3] = (this.h[3] + d) >>> 0
    this.h[4] = (this.h[4] + e) >>> 0
    this.h[5] = (this.h[5] + f) >>> 0
    this.h[6] = (this.h[6] + g) >>> 0
    this.h[7] = (this.h[7] + hh) >>> 0
  }

  protected finalize(): Uint8Array {
    const out = new Uint8Array(32)
    const view = new DataView(out.buffer)
    for (let i = 0; i < 8; i += 1) view.setUint32(i * 4, this.h[i], false)
    return out
  }
}

/* ---------------- SHA-512 (FIPS 180-4) ----------------
 * 64-bit words are held as hi/lo Uint32 pairs. BigInt would be far shorter but
 * roughly two orders of magnitude slower, which matters when the input is a
 * multi-gigabyte disk image.
 */

export class Sha512 extends BlockHasher {
  private readonly hHi = new Uint32Array(H512_HI)
  private readonly hLo = new Uint32Array(H512_LO)
  private readonly wHi = new Uint32Array(80)
  private readonly wLo = new Uint32Array(80)

  constructor() {
    super(128, 16)
  }

  protected writeLength(view: DataView, offset: number, bitLength: number): void {
    const { hi, lo } = splitBitLength(bitLength)
    view.setUint32(offset, 0, false)
    view.setUint32(offset + 4, 0, false)
    view.setUint32(offset + 8, hi, false)
    view.setUint32(offset + 12, lo, false)
  }

  protected compress(input: Uint8Array, offset: number): void {
    const wHi = this.wHi
    const wLo = this.wLo

    for (let i = 0; i < 16; i += 1) {
      const p = offset + i * 8
      wHi[i] = ((input[p] << 24) | (input[p + 1] << 16) | (input[p + 2] << 8) | input[p + 3]) >>> 0
      wLo[i] =
        ((input[p + 4] << 24) | (input[p + 5] << 16) | (input[p + 6] << 8) | input[p + 7]) >>> 0
    }

    for (let i = 16; i < 80; i += 1) {
      const xHi = wHi[i - 15]
      const xLo = wLo[i - 15]
      // sigma0 = ROTR1 ^ ROTR8 ^ SHR7
      const s0Hi = ((xHi >>> 1) | (xLo << 31)) ^ ((xHi >>> 8) | (xLo << 24)) ^ (xHi >>> 7)
      const s0Lo =
        ((xLo >>> 1) | (xHi << 31)) ^ ((xLo >>> 8) | (xHi << 24)) ^ ((xLo >>> 7) | (xHi << 25))

      const yHi = wHi[i - 2]
      const yLo = wLo[i - 2]
      // sigma1 = ROTR19 ^ ROTR61 ^ SHR6
      const s1Hi = ((yHi >>> 19) | (yLo << 13)) ^ ((yLo >>> 29) | (yHi << 3)) ^ (yHi >>> 6)
      const s1Lo =
        ((yLo >>> 19) | (yHi << 13)) ^ ((yHi >>> 29) | (yLo << 3)) ^ ((yLo >>> 6) | (yHi << 26))

      let lo = wLo[i - 16] + (s0Lo >>> 0)
      let hi = (wHi[i - 16] + s0Hi + (lo > MAX_UINT32 ? 1 : 0)) >>> 0
      lo = lo >>> 0
      lo += wLo[i - 7]
      hi = (hi + wHi[i - 7] + (lo > MAX_UINT32 ? 1 : 0)) >>> 0
      lo = lo >>> 0
      lo += s1Lo >>> 0
      hi = (hi + s1Hi + (lo > MAX_UINT32 ? 1 : 0)) >>> 0

      wHi[i] = hi >>> 0
      wLo[i] = lo >>> 0
    }

    let aHi = this.hHi[0]
    let aLo = this.hLo[0]
    let bHi = this.hHi[1]
    let bLo = this.hLo[1]
    let cHi = this.hHi[2]
    let cLo = this.hLo[2]
    let dHi = this.hHi[3]
    let dLo = this.hLo[3]
    let eHi = this.hHi[4]
    let eLo = this.hLo[4]
    let fHi = this.hHi[5]
    let fLo = this.hLo[5]
    let gHi = this.hHi[6]
    let gLo = this.hLo[6]
    let hHi = this.hHi[7]
    let hLo = this.hLo[7]

    for (let i = 0; i < 80; i += 1) {
      // Sigma1(e) = ROTR14 ^ ROTR18 ^ ROTR41
      const s1Hi =
        ((eHi >>> 14) | (eLo << 18)) ^ ((eHi >>> 18) | (eLo << 14)) ^ ((eLo >>> 9) | (eHi << 23))
      const s1Lo =
        ((eLo >>> 14) | (eHi << 18)) ^ ((eLo >>> 18) | (eHi << 14)) ^ ((eHi >>> 9) | (eLo << 23))
      const chHi = (eHi & fHi) ^ (~eHi & gHi)
      const chLo = (eLo & fLo) ^ (~eLo & gLo)

      // Sigma0(a) = ROTR28 ^ ROTR34 ^ ROTR39
      const s0Hi =
        ((aHi >>> 28) | (aLo << 4)) ^ ((aLo >>> 2) | (aHi << 30)) ^ ((aLo >>> 7) | (aHi << 25))
      const s0Lo =
        ((aLo >>> 28) | (aHi << 4)) ^ ((aHi >>> 2) | (aLo << 30)) ^ ((aHi >>> 7) | (aLo << 25))
      const majHi = (aHi & bHi) ^ (aHi & cHi) ^ (bHi & cHi)
      const majLo = (aLo & bLo) ^ (aLo & cLo) ^ (bLo & cLo)

      // T1 = h + Sigma1 + ch + K + W
      let t1Lo = hLo + (s1Lo >>> 0)
      let t1Hi = (hHi + s1Hi + (t1Lo > MAX_UINT32 ? 1 : 0)) >>> 0
      t1Lo = t1Lo >>> 0
      t1Lo += chLo >>> 0
      t1Hi = (t1Hi + chHi + (t1Lo > MAX_UINT32 ? 1 : 0)) >>> 0
      t1Lo = t1Lo >>> 0
      t1Lo += K512_LO[i]
      t1Hi = (t1Hi + K512_HI[i] + (t1Lo > MAX_UINT32 ? 1 : 0)) >>> 0
      t1Lo = t1Lo >>> 0
      t1Lo += wLo[i]
      t1Hi = (t1Hi + wHi[i] + (t1Lo > MAX_UINT32 ? 1 : 0)) >>> 0
      t1Lo = t1Lo >>> 0

      // T2 = Sigma0 + maj
      let t2Lo = (s0Lo >>> 0) + (majLo >>> 0)
      const t2Hi = (s0Hi + majHi + (t2Lo > MAX_UINT32 ? 1 : 0)) >>> 0
      t2Lo = t2Lo >>> 0

      hHi = gHi
      hLo = gLo
      gHi = fHi
      gLo = fLo
      fHi = eHi
      fLo = eLo

      const eSum = dLo + t1Lo
      eHi = (dHi + t1Hi + (eSum > MAX_UINT32 ? 1 : 0)) >>> 0
      eLo = eSum >>> 0

      dHi = cHi
      dLo = cLo
      cHi = bHi
      cLo = bLo
      bHi = aHi
      bLo = aLo

      const aSum = t1Lo + t2Lo
      aHi = (t1Hi + t2Hi + (aSum > MAX_UINT32 ? 1 : 0)) >>> 0
      aLo = aSum >>> 0
    }

    const addInto = (index: number, hi: number, lo: number): void => {
      const sum = this.hLo[index] + lo
      this.hLo[index] = sum >>> 0
      this.hHi[index] = (this.hHi[index] + hi + (sum > MAX_UINT32 ? 1 : 0)) >>> 0
    }
    addInto(0, aHi, aLo)
    addInto(1, bHi, bLo)
    addInto(2, cHi, cLo)
    addInto(3, dHi, dLo)
    addInto(4, eHi, eLo)
    addInto(5, fHi, fLo)
    addInto(6, gHi, gLo)
    addInto(7, hHi, hLo)
  }

  protected finalize(): Uint8Array {
    const out = new Uint8Array(64)
    const view = new DataView(out.buffer)
    for (let i = 0; i < 8; i += 1) {
      view.setUint32(i * 8, this.hHi[i], false)
      view.setUint32(i * 8 + 4, this.hLo[i], false)
    }
    return out
  }
}

/* ---------------- algorithm registry ---------------- */

export const HASH_ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512'] as const
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number]

export interface AlgorithmInfo {
  id: HashAlgorithm
  bits: number
  hexLength: number
  note: string
  secure: boolean
}

export const ALGORITHM_INFO: Record<HashAlgorithm, AlgorithmInfo> = {
  MD5: {
    id: 'MD5',
    bits: 128,
    hexLength: 32,
    note: 'Broken against deliberate collisions. Still fine for spotting a corrupted download.',
    secure: false,
  },
  'SHA-1': {
    id: 'SHA-1',
    bits: 160,
    hexLength: 40,
    note: 'Collisions demonstrated in 2017. Legacy checksums only, never for signatures.',
    secure: false,
  },
  'SHA-256': {
    id: 'SHA-256',
    bits: 256,
    hexLength: 64,
    note: 'The default for release checksums, signatures and integrity checks.',
    secure: true,
  },
  'SHA-512': {
    id: 'SHA-512',
    bits: 512,
    hexLength: 128,
    note: 'SHA-2 with 64-bit words. Often faster than SHA-256 on 64-bit CPUs.',
    secure: true,
  },
}

/** Guesses the algorithm behind a pasted checksum from its length. */
export function algorithmForDigestLength(hexLength: number): HashAlgorithm | null {
  switch (hexLength) {
    case 32:
      return 'MD5'
    case 40:
      return 'SHA-1'
    case 64:
      return 'SHA-256'
    case 128:
      return 'SHA-512'
    default:
      return null
  }
}

function createHasher(algorithm: HashAlgorithm): Hasher {
  switch (algorithm) {
    case 'MD5':
      return new Md5()
    case 'SHA-1':
      return new Sha1()
    case 'SHA-256':
      return new Sha256()
    case 'SHA-512':
      return new Sha512()
  }
}

/** One-shot hash of an in-memory buffer. */
export function hashBytes(algorithm: HashAlgorithm, bytes: Uint8Array): string {
  const hasher = createHasher(algorithm)
  hasher.update(bytes)
  return bytesToHex(hasher.digest())
}

/* ================================================================== */
/* 5. File helpers                                                     */
/* ================================================================== */

/** 4 MB keeps peak memory small while still amortising the per-slice overhead. */
export const HASH_CHUNK_SIZE = 4 * 1024 * 1024
/** Below this, crypto.subtle (native, much faster) is used for the SHA family. */
const SUBTLE_LIMIT = 24 * 1024 * 1024

export interface HashFileOptions {
  algorithms: readonly HashAlgorithm[]
  onProgress?: (processedBytes: number, totalBytes: number) => void
  signal?: AbortSignal
}

export class CancelledError extends Error {
  constructor() {
    super('Cancelled')
    this.name = 'CancelledError'
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CancelledError()
}

const SUBTLE_NAME: Partial<Record<HashAlgorithm, AlgorithmIdentifier>> = {
  'SHA-1': 'SHA-1',
  'SHA-256': 'SHA-256',
  'SHA-512': 'SHA-512',
}

/**
 * Hashes a Blob with any mix of algorithms, reading it in slices so that a file
 * far larger than available RAM still works and the tab keeps repainting.
 */
export async function hashFile(
  file: Blob,
  options: HashFileOptions,
): Promise<Partial<Record<HashAlgorithm, string>>> {
  const { algorithms, onProgress, signal } = options
  const result: Partial<Record<HashAlgorithm, string>> = {}
  if (algorithms.length === 0) return result

  throwIfAborted(signal)
  const total = file.size

  // Small files: one read, native digests where possible.
  if (total <= SUBTLE_LIMIT) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    throwIfAborted(signal)
    for (const algorithm of algorithms) {
      const native = SUBTLE_NAME[algorithm]
      if (native) {
        const buffer = await crypto.subtle.digest(native, asBufferSource(bytes))
        result[algorithm] = bytesToHex(new Uint8Array(buffer))
      } else {
        result[algorithm] = hashBytes(algorithm, bytes)
      }
      throwIfAborted(signal)
      await nextFrame()
    }
    onProgress?.(total, total)
    return result
  }

  const hashers = algorithms.map((algorithm) => ({ algorithm, hasher: createHasher(algorithm) }))
  let processed = 0
  onProgress?.(0, total)

  while (processed < total) {
    throwIfAborted(signal)
    const end = Math.min(processed + HASH_CHUNK_SIZE, total)
    const chunk = new Uint8Array(await file.slice(processed, end).arrayBuffer())
    for (const entry of hashers) entry.hasher.update(chunk)
    processed = end
    onProgress?.(processed, total)
    // Yield so the progress bar actually paints between slices.
    await nextFrame()
  }

  for (const entry of hashers) result[entry.algorithm] = bytesToHex(entry.hasher.digest())
  return result
}

export interface FileComparison {
  identical: boolean
  sizeA: number
  sizeB: number
  hashA: string
  hashB: string
  /** Byte offset of the first difference, or null when one file is a prefix of the other. */
  firstDifference: number | null
}

/**
 * Streams two files side by side: SHA-256 for both, plus the offset of the
 * first differing byte, in a single pass over each file.
 */
export async function compareFiles(
  a: Blob,
  b: Blob,
  onProgress?: (processedBytes: number, totalBytes: number) => void,
  signal?: AbortSignal,
): Promise<FileComparison> {
  const hashA = new Sha256()
  const hashB = new Sha256()
  const shared = Math.min(a.size, b.size)
  const total = a.size + b.size
  let processed = 0
  let firstDifference: number | null = null
  let offset = 0

  onProgress?.(0, total)

  while (offset < shared) {
    throwIfAborted(signal)
    const end = Math.min(offset + HASH_CHUNK_SIZE, shared)
    const [chunkA, chunkB] = await Promise.all([
      a.slice(offset, end).arrayBuffer(),
      b.slice(offset, end).arrayBuffer(),
    ])
    const bytesA = new Uint8Array(chunkA)
    const bytesB = new Uint8Array(chunkB)
    hashA.update(bytesA)
    hashB.update(bytesB)
    if (firstDifference === null) {
      for (let i = 0; i < bytesA.length; i += 1) {
        if (bytesA[i] !== bytesB[i]) {
          firstDifference = offset + i
          break
        }
      }
    }
    processed += bytesA.length + bytesB.length
    offset = end
    onProgress?.(processed, total)
    await nextFrame()
  }

  // Whichever file is longer still needs its tail folded into its own digest.
  const finishTail = async (blob: Blob, hasher: Sha256): Promise<void> => {
    let tail = shared
    while (tail < blob.size) {
      throwIfAborted(signal)
      const end = Math.min(tail + HASH_CHUNK_SIZE, blob.size)
      const bytes = new Uint8Array(await blob.slice(tail, end).arrayBuffer())
      hasher.update(bytes)
      processed += bytes.length
      tail = end
      onProgress?.(processed, total)
      await nextFrame()
    }
  }

  if (a.size > shared) await finishTail(a, hashA)
  if (b.size > shared) await finishTail(b, hashB)

  const digestA = bytesToHex(hashA.digest())
  const digestB = bytesToHex(hashB.digest())

  return {
    identical: a.size === b.size && firstDifference === null,
    sizeA: a.size,
    sizeB: b.size,
    hashA: digestA,
    hashB: digestB,
    firstDifference,
  }
}

/* ================================================================== */
/* 6. AES-GCM envelope                                                 */
/* ================================================================== */

/**
 * Envelope layout (all binary, then base64):
 *
 *   offset  size  field
 *   0       4     magic "OTD1"
 *   4       4     PBKDF2 iteration count, big-endian uint32
 *   8       16    PBKDF2 salt (random)
 *   24      12    AES-GCM nonce / IV (random)
 *   36      ...   AES-GCM ciphertext with the 16-byte tag appended
 */
export const ENVELOPE_MAGIC = new Uint8Array([0x4f, 0x54, 0x44, 0x31]) // "OTD1"
export const PBKDF2_ITERATIONS = 200_000
export const SALT_BYTES = 16
export const IV_BYTES = 12
export const ENVELOPE_HEADER_BYTES = 4 + 4 + SALT_BYTES + IV_BYTES

/**
 * WebCrypto's TypeScript signatures want `BufferSource`, which since TS 5.7 is
 * narrower than the `Uint8Array` (over `ArrayBufferLike`) this module passes
 * around. The views are always plain ArrayBuffer-backed, so this is safe.
 */
function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource
}

async function deriveAesKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    asBufferSource(utf8Encode(password)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asBufferSource(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Encrypts UTF-8 text into the self-contained base64 envelope described above. */
export async function encryptText(
  plaintext: string,
  password: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = await deriveAesKey(password, salt, iterations)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv) },
      key,
      asBufferSource(utf8Encode(plaintext)),
    ),
  )

  const envelope = new Uint8Array(ENVELOPE_HEADER_BYTES + ciphertext.length)
  envelope.set(ENVELOPE_MAGIC, 0)
  new DataView(envelope.buffer).setUint32(4, iterations, false)
  envelope.set(salt, 8)
  envelope.set(iv, 8 + SALT_BYTES)
  envelope.set(ciphertext, ENVELOPE_HEADER_BYTES)
  return bytesToBase64(envelope)
}

export interface EnvelopeHeader {
  iterations: number
  salt: Uint8Array
  iv: Uint8Array
  ciphertext: Uint8Array
}

/** Parses and validates an envelope without attempting to decrypt it. */
export function parseEnvelope(encoded: string): EnvelopeHeader {
  let bytes: Uint8Array
  try {
    bytes = base64ToBytes(encoded)
  } catch {
    throw new Error('That does not look like base64. Check for missing or extra characters.')
  }
  if (bytes.length < ENVELOPE_HEADER_BYTES + 16) {
    throw new Error('The message is too short to be a valid encrypted envelope.')
  }
  for (let i = 0; i < ENVELOPE_MAGIC.length; i += 1) {
    if (bytes[i] !== ENVELOPE_MAGIC[i]) {
      throw new Error(
        'Missing the “OTD1” header. This text was not made by the encrypt mode of this tool.',
      )
    }
  }
  const iterations = new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, false)
  if (iterations < 1000 || iterations > 10_000_000) {
    throw new Error('The envelope declares an implausible iteration count and was likely corrupted.')
  }
  return {
    iterations,
    salt: bytes.slice(8, 8 + SALT_BYTES),
    iv: bytes.slice(8 + SALT_BYTES, ENVELOPE_HEADER_BYTES),
    ciphertext: bytes.slice(ENVELOPE_HEADER_BYTES),
  }
}

/** Decrypts an envelope. A wrong password is indistinguishable from tampering — by design. */
export async function decryptText(encoded: string, password: string): Promise<string> {
  const header = parseEnvelope(encoded)
  const key = await deriveAesKey(password, header.salt, header.iterations)
  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBufferSource(header.iv) },
      key,
      asBufferSource(header.ciphertext),
    )
  } catch {
    throw new Error(
      'Decryption failed. Either the password is wrong or the message was altered. AES-GCM cannot tell you which.',
    )
  }
  return utf8Decode(new Uint8Array(plaintext))
}
