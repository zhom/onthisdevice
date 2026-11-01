/**
 * Pure, dependency-free helpers shared by the Developer Tools islands.
 * Everything here runs in the browser; nothing touches the network.
 */

/* ------------------------------------------------------------------ */
/* Text ⇄ bytes                                                        */
/* ------------------------------------------------------------------ */

const encoder = new TextEncoder()

export function utf8Encode(text: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(text)
}

/** Decode UTF-8 bytes. Throws a human message when the bytes are not valid UTF-8. */
export function utf8Decode(bytes: Uint8Array, fatal = true): string {
  try {
    return new TextDecoder('utf-8', { fatal }).decode(bytes)
  } catch {
    throw new Error(
      'The decoded bytes are not valid UTF-8 text. They may be binary data. Switch to file mode to download them.',
    )
  }
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

/* ------------------------------------------------------------------ */
/* Base64                                                              */
/* ------------------------------------------------------------------ */

const B64_STD = /^[A-Za-z0-9+/]*={0,2}$/
const B64_URL = /^[A-Za-z0-9\-_]*={0,2}$/

export interface Base64Options {
  urlSafe?: boolean
  /** Emit `=` padding. Ignored when decoding. */
  padding?: boolean
  /** Insert a newline every N characters (0 = never). */
  wrap?: number
}

export function bytesToBase64(bytes: Uint8Array, options: Base64Options = {}): string {
  const { urlSafe = false, padding = true, wrap = 0 } = options
  // btoa is the fastest correct path; feed it in chunks so we never blow the
  // argument limit of String.fromCharCode on large files.
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  let out = btoa(binary)
  if (urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_')
  if (!padding) out = out.replace(/=+$/, '')
  if (wrap > 0) out = out.replace(new RegExp(`.{1,${wrap}}`, 'g'), '$&\n').trimEnd()
  return out
}

/** Decode standard or URL-safe Base64. Whitespace is ignored. */
export function base64ToBytes(input: string): Uint8Array<ArrayBuffer> {
  const cleaned = input.replace(/\s+/g, '')
  if (cleaned.length === 0) return new Uint8Array(0)

  const looksUrlSafe = /[-_]/.test(cleaned)
  const alphabet = looksUrlSafe ? B64_URL : B64_STD
  if (!alphabet.test(cleaned)) {
    const valid = looksUrlSafe ? /[A-Za-z0-9\-_=]/ : /[A-Za-z0-9+/=]/
    const idx = [...cleaned].findIndex((ch) => !valid.test(ch))
    const ch = idx >= 0 ? cleaned[idx] : '?'
    throw new Error(
      `“${ch}” at position ${idx + 1} is not a Base64 character. Expected A-Z, a-z, 0-9 and ${
        looksUrlSafe ? '- _' : '+ /'
      }.`,
    )
  }

  let normalised = cleaned.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = normalised.length % 4
  if (remainder === 1) {
    throw new Error(
      'This is not a complete Base64 string: its length leaves one character over. A group is 2, 3 or 4 characters, never 1.',
    )
  }
  if (remainder > 0) normalised += '='.repeat(4 - remainder)

  let binary: string
  try {
    binary = atob(normalised)
  } catch {
    throw new Error('The browser rejected this string as Base64. Check for stray padding or truncated input.')
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/* ------------------------------------------------------------------ */
/* MD5 — incremental, so large files can be streamed in slices          */
/* ------------------------------------------------------------------ */

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const MD5_K = (() => {
  const k = new Uint32Array(64)
  for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)
  return k
})()

/**
 * A correct, incremental MD5 (RFC 1321). Written here rather than pulled from a
 * dependency so nothing extra ships and the implementation can be audited.
 */
export class Md5 {
  private h0 = 0x67452301
  private h1 = 0xefcdab89
  private h2 = 0x98badcfe
  private h3 = 0x10325476
  private readonly block = new Uint8Array(64)
  private readonly words = new Uint32Array(16)
  private blockLen = 0
  private totalLen = 0
  private finished = false

  update(bytes: Uint8Array): this {
    if (this.finished) throw new Error('This MD5 instance has already produced a digest.')
    this.totalLen += bytes.length
    let offset = 0

    if (this.blockLen > 0) {
      const need = 64 - this.blockLen
      const take = Math.min(need, bytes.length)
      this.block.set(bytes.subarray(0, take), this.blockLen)
      this.blockLen += take
      offset = take
      if (this.blockLen === 64) {
        this.compress(this.block, 0)
        this.blockLen = 0
      }
    }

    while (offset + 64 <= bytes.length) {
      this.compress(bytes, offset)
      offset += 64
    }

    if (offset < bytes.length) {
      this.block.set(bytes.subarray(offset), 0)
      this.blockLen = bytes.length - offset
    }
    return this
  }

  digest(): Uint8Array<ArrayBuffer> {
    if (this.finished) throw new Error('This MD5 instance has already produced a digest.')
    const bitLen = BigInt(this.totalLen) * 8n
    const padLen = this.blockLen < 56 ? 56 - this.blockLen : 120 - this.blockLen
    const tail = new Uint8Array(padLen + 8)
    tail[0] = 0x80
    for (let i = 0; i < 8; i++) {
      tail[padLen + i] = Number((bitLen >> BigInt(8 * i)) & 0xffn)
    }
    // Feed the tail without touching totalLen again.
    const saved = this.totalLen
    this.update(tail)
    this.totalLen = saved
    this.finished = true

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

  private compress(input: Uint8Array, offset: number): void {
    const m = this.words
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4
      m[i] = (input[j] | (input[j + 1] << 8) | (input[j + 2] << 16) | (input[j + 3] << 24)) >>> 0
    }

    let a = this.h0
    let b = this.h1
    let c = this.h2
    let d = this.h3

    for (let i = 0; i < 64; i++) {
      let f: number
      let g: number
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) & 15
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) & 15
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) & 15
      }
      const tmp = d
      d = c
      c = b
      const sum = (f + a + MD5_K[i] + m[g]) >>> 0
      const s = MD5_S[i]
      b = (b + (((sum << s) | (sum >>> (32 - s))) >>> 0)) >>> 0
      a = tmp
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
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/** Compare two hex strings without leaking length via early exit. */
export function hashesMatch(a: string, b: string): boolean {
  const x = a.trim().toLowerCase()
  const y = b.trim().toLowerCase()
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i)
  return diff === 0
}

/** Convert a character index into 1-based line / column, for error messages. */
export function positionOf(text: string, index: number): { line: number; column: number } {
  const upTo = text.slice(0, Math.max(0, index))
  const line = (upTo.match(/\n/g)?.length ?? 0) + 1
  const lastNewline = upTo.lastIndexOf('\n')
  const column = index - lastNewline
  return { line, column: Math.max(1, column) }
}

/** A short excerpt of the offending line with a caret under the column. */
export function errorExcerpt(text: string, index: number): string {
  const { line, column } = positionOf(text, index)
  const lines = text.split('\n')
  const src = lines[line - 1] ?? ''
  const start = Math.max(0, column - 40)
  const slice = src.slice(start, start + 80)
  const caretAt = column - 1 - start
  const prefix = `${line} | `
  return `${prefix}${slice}\n${' '.repeat(prefix.length + Math.max(0, caretAt))}^`
}
