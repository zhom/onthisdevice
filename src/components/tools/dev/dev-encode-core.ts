/**
 * Shared primitives for the `dev-encode` round-2 batch.
 *
 * Deliberately self-contained: no round-1 internals are imported, so this batch
 * can be built, reviewed and reasoned about on its own. Everything here is pure
 * and synchronous unless noted, which keeps the islands easy to test by eye.
 */

/* ------------------------------------------------------------------ */
/* Bytes and text                                                      */
/* ------------------------------------------------------------------ */

const encoder = new TextEncoder()

export function utf8Encode(text: string): Uint8Array {
  return encoder.encode(text)
}

export function utf8Decode(bytes: Uint8Array, fatal = false): string {
  return new TextDecoder('utf-8', { fatal }).decode(bytes)
}

const HEX_DIGITS = '0123456789abcdef'

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    out += HEX_DIGITS[bytes[i] >> 4] + HEX_DIGITS[bytes[i] & 15]
  }
  return out
}

/** Copies into a fresh, definitely-ArrayBuffer-backed buffer for WebCrypto. */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy.buffer
}

/**
 * Parses loose hex: whitespace, commas, colons, `0x` prefixes and `\x` escapes
 * are all ignored. Throws with a human message on anything else.
 */
export function parseHex(input: string): Uint8Array {
  const cleaned = input
    .replace(/0x/gi, ' ')
    .replace(/\\x/gi, ' ')
    .replace(/[\s,;:_|-]+/g, '')
  if (cleaned.length === 0) return new Uint8Array(0)
  const bad = cleaned.match(/[^0-9a-fA-F]/)
  if (bad) {
    throw new Error(
      `“${bad[0]}” is not a hex digit. Hex only uses 0-9 and A-F. Separators such as spaces, commas or colons are fine.`,
    )
  }
  if (cleaned.length % 2 !== 0) {
    throw new Error(
      `Hex needs an even number of digits (two per byte). This input has ${cleaned.length}. Check for a missing leading zero.`,
    )
  }
  const out = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Base32 — RFC 4648, standard and extended-hex alphabets              */
/* ------------------------------------------------------------------ */

export const BASE32_ALPHABETS = {
  rfc4648: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  base32hex: '0123456789ABCDEFGHIJKLMNOPQRSTUV',
} as const

export type Base32Variant = keyof typeof BASE32_ALPHABETS

export function base32Encode(
  bytes: Uint8Array,
  variant: Base32Variant = 'rfc4648',
  pad = true,
): string {
  const alphabet = BASE32_ALPHABETS[variant]
  let bits = 0
  let value = 0
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    value = (value << 8) | bytes[i]
    bits += 8
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31]
  if (pad) while (out.length % 8 !== 0) out += '='
  return out
}

export function base32Decode(input: string, variant: Base32Variant = 'rfc4648'): Uint8Array {
  const alphabet = BASE32_ALPHABETS[variant]
  const cleaned = input.replace(/[\s-]+/g, '').replace(/=+$/, '').toUpperCase()
  const out: number[] = []
  let bits = 0
  let value = 0
  for (const char of cleaned) {
    const index = alphabet.indexOf(char)
    if (index === -1) {
      throw new Error(
        `“${char}” is not a Base32 character. The RFC 4648 alphabet is A-Z and 2-7, with no 0, 1 or 8.`,
      )
    }
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

/* ------------------------------------------------------------------ */
/* MD5 — WebCrypto has no MD5, so this is the one hash we implement     */
/* ------------------------------------------------------------------ */

const MD5_SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const MD5_K = (() => {
  const table = new Uint32Array(64)
  for (let i = 0; i < 64; i += 1) {
    table[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)
  }
  return table
})()

function rotl32(x: number, c: number): number {
  return ((x << c) | (x >>> (32 - c))) >>> 0
}

/** Streaming MD5. Feed it chunks with `update`, then read `hex()`. */
export class Md5 {
  private h0 = 0x67452301
  private h1 = 0xefcdab89
  private h2 = 0x98badcfe
  private h3 = 0x10325476
  private readonly block = new Uint8Array(64)
  private readonly view = new DataView(this.block.buffer)
  private blockLength = 0
  private totalLength = 0
  private finished = false

  update(chunk: Uint8Array): this {
    if (this.finished) throw new Error('This MD5 context has already been finalised.')
    this.totalLength += chunk.length
    let offset = 0
    if (this.blockLength > 0) {
      const need = Math.min(64 - this.blockLength, chunk.length)
      this.block.set(chunk.subarray(0, need), this.blockLength)
      this.blockLength += need
      offset = need
      if (this.blockLength === 64) {
        this.compress(this.view, 0)
        this.blockLength = 0
      }
    }
    if (offset < chunk.length) {
      // Align a DataView over the caller's bytes for the full blocks.
      const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength)
      while (offset + 64 <= chunk.length) {
        this.compress(view, offset)
        offset += 64
      }
      if (offset < chunk.length) {
        this.block.set(chunk.subarray(offset), 0)
        this.blockLength = chunk.length - offset
      }
    }
    return this
  }

  digest(): Uint8Array {
    if (!this.finished) {
      const bitLength = this.totalLength * 8
      const tail = new Uint8Array(this.blockLength < 56 ? 64 : 128)
      tail.set(this.block.subarray(0, this.blockLength))
      tail[this.blockLength] = 0x80
      const tailView = new DataView(tail.buffer)
      tailView.setUint32(tail.length - 8, bitLength >>> 0, true)
      tailView.setUint32(tail.length - 4, Math.floor(bitLength / 4294967296) >>> 0, true)
      for (let offset = 0; offset < tail.length; offset += 64) this.compress(tailView, offset)
      this.finished = true
    }
    const out = new Uint8Array(16)
    const view = new DataView(out.buffer)
    view.setUint32(0, this.h0, true)
    view.setUint32(4, this.h1, true)
    view.setUint32(8, this.h2, true)
    view.setUint32(12, this.h3, true)
    return out
  }

  hex(): string {
    return bytesToHex(this.digest())
  }

  private compress(view: DataView, offset: number): void {
    const m = new Uint32Array(16)
    for (let i = 0; i < 16; i += 1) m[i] = view.getUint32(offset + i * 4, true)

    let a = this.h0
    let b = this.h1
    let c = this.h2
    let d = this.h3

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
      const sum = (f + a + MD5_K[i] + m[g]) >>> 0
      a = d
      d = c
      c = b
      b = (b + rotl32(sum, MD5_SHIFTS[i])) >>> 0
    }

    this.h0 = (this.h0 + a) >>> 0
    this.h1 = (this.h1 + b) >>> 0
    this.h2 = (this.h2 + c) >>> 0
    this.h3 = (this.h3 + d) >>> 0
  }
}

export function md5Hex(bytes: Uint8Array): string {
  return new Md5().update(bytes).hex()
}

/* ------------------------------------------------------------------ */
/* CRC-32 (IEEE 802.3, the zip/png polynomial)                          */
/* ------------------------------------------------------------------ */

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

/** Streaming CRC-32. `crc` is the running value; start at 0. */
export function crc32Update(bytes: Uint8Array, crc = 0): number {
  let c = (crc ^ 0xffffffff) >>> 0
  for (let i = 0; i < bytes.length; i += 1) {
    c = (CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)) >>> 0
  }
  return (c ^ 0xffffffff) >>> 0
}

export function crc32Hex(value: number): string {
  return value.toString(16).padStart(8, '0')
}

/* ------------------------------------------------------------------ */
/* WebCrypto wrappers                                                   */
/* ------------------------------------------------------------------ */

export type SubtleAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

export async function digestHex(algorithm: SubtleAlgorithm, bytes: Uint8Array): Promise<string> {
  const buffer = await crypto.subtle.digest(algorithm, toArrayBuffer(bytes))
  return bytesToHex(new Uint8Array(buffer))
}

export async function hmacBytes(
  algorithm: SubtleAlgorithm,
  key: Uint8Array,
  message: Uint8Array,
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(key),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, toArrayBuffer(message))
  return new Uint8Array(signature)
}

/* ------------------------------------------------------------------ */
/* Base64 helpers that survive Unicode and large inputs                */
/* ------------------------------------------------------------------ */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

export function base64ToBytes(input: string): Uint8Array {
  const cleaned = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4)
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    throw new Error(
      'That is not valid Base64. Check for stray characters. A copied data URI must include everything after the comma, and nothing before it.',
    )
  }
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/** Reads a File in 4 MB slices, reporting 0..1 progress. Keeps the tab alive. */
export async function readFileChunks(
  file: File,
  onChunk: (chunk: Uint8Array) => void,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const CHUNK = 4 * 1024 * 1024
  let offset = 0
  while (offset < file.size) {
    const slice = file.slice(offset, Math.min(offset + CHUNK, file.size))
    const buffer = await slice.arrayBuffer()
    onChunk(new Uint8Array(buffer))
    offset += CHUNK
    onProgress?.(Math.min(1, offset / file.size))
  }
  if (file.size === 0) onProgress?.(1)
}
