/** Byte and text encodings: Base58, Ascii85, quoted-printable, Punycode, Unicode escapes and string literals. */
import { bytesToHex, utf8Decode, utf8Encode } from '@/components/tools/dev/devlib'

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '').replace(/[\s:,-]/g, '')
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) throw new Error('Hex input needs an even number of the characters 0 to 9 and a to f.')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

export const toBytes = (text: string, as: string) => (as === 'hex' ? hexToBytes(text) : utf8Encode(text))
export const fromBytes = (bytes: Uint8Array, as: string) => (as === 'hex' ? bytesToHex(bytes) : utf8Decode(bytes, false))

/* ── Base58 ── */

export const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++
  let n = 0n
  for (const b of bytes) n = n * 256n + BigInt(b)
  let out = ''
  while (n > 0n) {
    out = BASE58[Number(n % 58n)] + out
    n /= 58n
  }
  return '1'.repeat(zeros) + out
}

export function base58Decode(text: string): Uint8Array {
  const s = text.trim()
  let zeros = 0
  while (zeros < s.length && s[zeros] === '1') zeros++
  let n = 0n
  for (const c of s) {
    const i = BASE58.indexOf(c)
    if (i < 0) throw new Error(`"${c}" is not a Base58 character. Base58 has no 0, O, I or l.`)
    n = n * 58n + BigInt(i)
  }
  const body: number[] = []
  while (n > 0n) {
    body.unshift(Number(n % 256n))
    n /= 256n
  }
  return new Uint8Array([...new Array<number>(zeros).fill(0), ...body])
}

async function sha256d(bytes: Uint8Array): Promise<Uint8Array> {
  const once = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return new Uint8Array(await crypto.subtle.digest('SHA-256', once))
}

/** Base58Check: payload plus the first 4 bytes of a double SHA-256 as checksum. */
export async function base58CheckEncode(bytes: Uint8Array): Promise<string> {
  const sum = (await sha256d(bytes)).slice(0, 4)
  return base58Encode(new Uint8Array([...bytes, ...sum]))
}

export async function base58CheckDecode(text: string): Promise<Uint8Array> {
  const all = base58Decode(text)
  if (all.length < 4) throw new Error('Too short for Base58Check: it needs a 4-byte checksum.')
  const payload = all.slice(0, -4)
  const sum = (await sha256d(payload)).slice(0, 4)
  if (sum.some((b, i) => b !== all[all.length - 4 + i])) throw new Error('The Base58Check checksum does not match. A character is wrong or missing.')
  return payload
}

/* ── Ascii85 ── */

export function ascii85Encode(bytes: Uint8Array, delimiters: boolean): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.slice(i, i + 4)
    const pad = 4 - chunk.length
    const full = new Uint8Array(4)
    full.set(chunk)
    let n = ((full[0] << 24) | (full[1] << 16) | (full[2] << 8) | full[3]) >>> 0
    if (n === 0 && pad === 0) {
      out += 'z'
      continue
    }
    const group: string[] = []
    for (let k = 0; k < 5; k++) {
      group.unshift(String.fromCharCode(33 + (n % 85)))
      n = Math.floor(n / 85)
    }
    out += group.slice(0, 5 - pad).join('')
  }
  return delimiters ? `<~${out}~>` : out
}

export function ascii85Decode(text: string): Uint8Array {
  let s = text.trim()
  if (s.startsWith('<~')) s = s.slice(2)
  if (s.endsWith('~>')) s = s.slice(0, -2)
  s = s.replace(/\s+/g, '')
  const out: number[] = []
  let group: number[] = []
  const flush = (count: number) => {
    while (group.length < 5) group.push(84)
    let n = 0
    for (const g of group) n = n * 85 + g
    if (n > 0xffffffff) throw new Error('An Ascii85 group is out of range.')
    const bytes = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
    out.push(...bytes.slice(0, count))
    group = []
  }
  for (const c of s) {
    if (c === 'z') {
      if (group.length) throw new Error('"z" can only appear between groups.')
      out.push(0, 0, 0, 0)
      continue
    }
    const v = c.charCodeAt(0) - 33
    if (v < 0 || v > 84) throw new Error(`"${c}" is not an Ascii85 character.`)
    group.push(v)
    if (group.length === 5) flush(4)
  }
  if (group.length === 1) throw new Error('The last Ascii85 group has only one character.')
  if (group.length) flush(group.length - 1)
  return new Uint8Array(out)
}

/* ── quoted-printable (RFC 2045) ── */

export function qpEncode(text: string): string {
  const lines = text.split(/\r?\n/)
  return lines
    .map((line) => {
      let enc = ''
      for (const b of utf8Encode(line)) {
        enc += (b >= 33 && b <= 126 && b !== 61) || b === 32 || b === 9 ? String.fromCharCode(b) : `=${b.toString(16).toUpperCase().padStart(2, '0')}`
      }
      // A space or tab at the end of a line would be lost in transport, so it is encoded.
      enc = enc.replace(/[ \t]$/, (c) => (c === ' ' ? '=20' : '=09'))
      // Soft line breaks keep each line at 76 characters or fewer, never splitting an =XX sequence.
      const parts: string[] = []
      while (enc.length > 76) {
        let cut = 75
        const eq = enc.lastIndexOf('=', cut)
        if (eq > cut - 3) cut = eq
        parts.push(`${enc.slice(0, cut)}=`)
        enc = enc.slice(cut)
      }
      parts.push(enc)
      return parts.join('\n')
    })
    .join('\n')
}

export function qpDecode(text: string): string {
  const joined = text.replace(/=\r?\n/g, '')
  const bytes: number[] = []
  for (let i = 0; i < joined.length; i++) {
    const c = joined[i]
    if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16))
      i += 2
    } else for (const b of utf8Encode(c)) bytes.push(b)
  }
  return utf8Decode(new Uint8Array(bytes), false)
}

/* ── Punycode (RFC 3492) ── */

const BASE = 36
const TMIN = 1
const TMAX = 26
const SKEW = 38
const DAMP = 700

function adapt(delta: number, points: number, first: boolean): number {
  let d = first ? Math.floor(delta / DAMP) : delta >> 1
  d += Math.floor(d / points)
  let k = 0
  while (d > ((BASE - TMIN) * TMAX) >> 1) {
    d = Math.floor(d / (BASE - TMIN))
    k += BASE
  }
  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW))
}

const digit = (d: number) => String.fromCharCode(d + 22 + 75 * (d < 26 ? 1 : 0))

export function punyEncode(label: string): string {
  const cps = [...label].map((c) => c.codePointAt(0) ?? 0)
  let out = cps.filter((c) => c < 128).map((c) => String.fromCharCode(c)).join('')
  const basic = out.length
  let h = basic
  if (basic > 0) out += '-'
  let n = 128
  let delta = 0
  let bias = 72
  while (h < cps.length) {
    const m = Math.min(...cps.filter((c) => c >= n))
    delta += (m - n) * (h + 1)
    n = m
    for (const c of cps) {
      if (c < n) delta++
      if (c === n) {
        let q = delta
        for (let k = BASE; ; k += BASE) {
          const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias
          if (q < t) break
          out += digit(t + ((q - t) % (BASE - t)))
          q = Math.floor((q - t) / (BASE - t))
        }
        out += digit(q)
        bias = adapt(delta, h + 1, h === basic)
        delta = 0
        h++
      }
    }
    delta++
    n++
  }
  return out
}

export function punyDecode(input: string): string {
  const cps: number[] = []
  const last = input.lastIndexOf('-')
  for (let j = 0; j < Math.max(0, last); j++) cps.push(input.charCodeAt(j))
  let n = 128
  let i = 0
  let bias = 72
  for (let p = last > 0 ? last + 1 : 0; p < input.length; ) {
    const oldi = i
    let w = 1
    for (let k = BASE; ; k += BASE) {
      if (p >= input.length) throw new Error(`"${input}" is not valid Punycode.`)
      const c = input.charCodeAt(p++)
      const d = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : BASE
      if (d >= BASE) throw new Error(`"${input}" is not valid Punycode.`)
      i += d * w
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias
      if (d < t) break
      w *= BASE - t
    }
    bias = adapt(i - oldi, cps.length + 1, oldi === 0)
    n += Math.floor(i / (cps.length + 1))
    i %= cps.length + 1
    cps.splice(i++, 0, n)
  }
  return String.fromCodePoint(...cps)
}

/** Unicode domain to ASCII (xn--) form, label by label. Email addresses keep their local part. */
export function domainToAscii(domain: string): string {
  const at = domain.lastIndexOf('@')
  const [local, host] = at >= 0 ? [domain.slice(0, at + 1), domain.slice(at + 1)] : ['', domain]
  const labels = host.normalize('NFC').toLowerCase().split(/[.。．｡]/)
  return local + labels.map((l) => (/^[\x00-\x7f]*$/.test(l) ? l : `xn--${punyEncode(l)}`)).join('.')
}

export function domainToUnicode(domain: string): string {
  const at = domain.lastIndexOf('@')
  const [local, host] = at >= 0 ? [domain.slice(0, at + 1), domain.slice(at + 1)] : ['', domain]
  return local + host.split('.').map((l) => (/^xn--/i.test(l) ? punyDecode(l.slice(4).toLowerCase()) : l)).join('.')
}

/* ── Unicode escapes ── */

export type EscapeStyle = 'js' | 'es6' | 'python' | 'css' | 'html' | 'uplus'

export function unicodeEscape(text: string, style: EscapeStyle, all: boolean): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    if (!all && cp >= 32 && cp < 127) {
      out += ch
      continue
    }
    const hex = (n: number, w: number) => n.toString(16).toUpperCase().padStart(w, '0')
    if (style === 'es6') out += `\\u{${hex(cp, 1)}}`
    else if (style === 'python') out += cp > 0xffff ? `\\U${hex(cp, 8)}` : `\\u${hex(cp, 4)}`
    else if (style === 'css') out += `\\${hex(cp, 1)} `
    else if (style === 'html') out += `&#x${hex(cp, 1)};`
    else if (style === 'uplus') out += `U+${hex(cp, 4)} `
    else out += cp > 0xffff ? [ch.charCodeAt(0), ch.charCodeAt(1)].map((u) => `\\u${hex(u, 4)}`).join('') : `\\u${hex(cp, 4)}`
  }
  return style === 'uplus' || style === 'css' ? out.replace(/ $/, '') : out
}

export function unicodeUnescape(text: string): string {
  return text
    .replace(/\\u\{([0-9a-f]{1,6})\}|\\U([0-9a-f]{8})|&#x([0-9a-f]{1,6});|&#(\d{1,7});|U\+([0-9a-f]{4,6}) ?/gi, (m, a: string, b: string, c: string, d: string, e: string) => {
      const cp = parseInt(a ?? b ?? c ?? e ?? '', 16) || Number(d)
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m
    })
    .replace(/(?:\\u[0-9a-f]{4})+/gi, (m) => String.fromCharCode(...(m.match(/[0-9a-f]{4}/gi) ?? []).map((h) => parseInt(h, 16))))
    .replace(/\\([0-9a-f]{1,6}) ?/gi, (m, h: string) => {
      const cp = parseInt(h, 16)
      return cp <= 0x10ffff ? String.fromCodePoint(cp) : m
    })
}

/* ── string literals ── */

export type Lang = 'js' | 'java' | 'c'

const SIMPLE: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f', '\v': '\\v', '\0': '\\0', '\\': '\\\\' }

export function escapeString(text: string, lang: Lang, o: { quote: '"' | "'" | '`'; ascii: boolean }): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    if (ch === o.quote || (ch === '"' && lang !== 'js')) out += `\\${ch}`
    else if (ch === '$' && o.quote === '`') out += '\\$'
    else if (SIMPLE[ch] !== undefined && !(lang === 'java' && (ch === '\v' || ch === '\0'))) out += SIMPLE[ch]
    else if (cp < 32 || cp === 127) out += lang === 'c' ? `\\x${cp.toString(16).padStart(2, '0')}` : `\\u${cp.toString(16).padStart(4, '0')}`
    else if (o.ascii && cp > 126) {
      if (lang === 'c') for (const b of utf8Encode(ch)) out += `\\x${b.toString(16).padStart(2, '0')}`
      else if (lang === 'js' && cp > 0xffff) out += `\\u{${cp.toString(16)}}`
      else for (let i = 0; i < ch.length; i++) out += `\\u${ch.charCodeAt(i).toString(16).padStart(4, '0')}`
    } else out += ch
  }
  return out
}

export function unescapeString(text: string, lang: Lang): string {
  const bytes: number[] = []
  let out = ''
  const flushBytes = () => {
    if (bytes.length) out += utf8Decode(new Uint8Array(bytes), false)
    bytes.length = 0
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c !== '\\' || i === text.length - 1) {
      flushBytes()
      out += c
      continue
    }
    const n = text[++i]
    const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0', '\\': '\\', '"': '"', "'": "'", '`': '`', $: '$', '?': '?', a: '\x07', e: '\x1b' }
    if (n === 'x') {
      const m = /^[0-9a-fA-F]{1,2}/.exec(text.slice(i + 1))
      if (!m) throw new Error(`Bad \\x escape at position ${i}.`)
      i += m[0].length
      // In C, \x gives a byte; in JavaScript a code point below 256.
      if (lang === 'c') bytes.push(parseInt(m[0], 16))
      else {
        flushBytes()
        out += String.fromCharCode(parseInt(m[0], 16))
      }
    } else if (n === 'u' && text[i + 1] === '{') {
      const end = text.indexOf('}', i)
      flushBytes()
      out += String.fromCodePoint(parseInt(text.slice(i + 2, end), 16))
      i = end
    } else if (n === 'u' || n === 'U') {
      const len = n === 'U' ? 8 : 4
      const h = text.slice(i + 1, i + 1 + len)
      if (!new RegExp(`^[0-9a-fA-F]{${len}}$`).test(h)) throw new Error(`Bad \\${n} escape at position ${i}.`)
      flushBytes()
      out += n === 'U' ? String.fromCodePoint(parseInt(h, 16)) : String.fromCharCode(parseInt(h, 16))
      i += len
    } else if (/[0-7]/.test(n) && (lang !== 'js' || /[0-7]/.test(text[i + 1] ?? ''))) {
      const m = /^[0-7]{1,3}/.exec(text.slice(i)) ?? ['0']
      i += m[0].length - 1
      if (lang === 'c') bytes.push(parseInt(m[0], 8) & 255)
      else {
        flushBytes()
        out += String.fromCharCode(parseInt(m[0], 8))
      }
    } else if (n === '\n') {
      flushBytes()
    } else {
      flushBytes()
      out += map[n] ?? n
    }
  }
  flushBytes()
  return out
}
