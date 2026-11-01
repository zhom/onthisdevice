/**
 * Standard-security-handler cryptography for the `pdf-secure` batch.
 *
 * Everything here runs against the browser's own WebCrypto where a primitive
 * exists (SHA-2 family, AES-CBC) and is hand-implemented only where WebCrypto
 * has no equivalent (MD5 and RC4, both of which PDF still requires for legacy
 * revisions). No network, no dependency.
 *
 * References: ISO 32000-1 §7.6 (revisions 2-4) and ISO 32000-2 §7.6.4
 * (revisions 5-6, "Algorithm 2.A" and "Algorithm 2.B").
 */

/* ------------------------------------------------------------------ *
 * Small byte helpers
 * ------------------------------------------------------------------ */

/** A byte view guaranteed to sit on a plain ArrayBuffer, so WebCrypto accepts it. */
export type Bytes = Uint8Array<ArrayBuffer>

export function concatBytes(...parts: Uint8Array[]): Bytes {
  let total = 0
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

const HEX = '0123456789ABCDEF'

export function toHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += HEX[bytes[i] >> 4] + HEX[bytes[i] & 15]
  }
  return out
}

/** Random bytes from the platform CSPRNG. */
export function randomBytes(n: number): Bytes {
  const out = new Uint8Array(n)
  const c = globalThis.crypto
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error(
      'This browser does not expose a secure random number generator, so we will not pretend to encrypt anything.',
    )
  }
  c.getRandomValues(out)
  return out
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto
  if (!c || !c.subtle) {
    throw new Error(
      'Encryption needs WebCrypto, which browsers only expose over HTTPS (or on localhost). Open this page over HTTPS and try again.',
    )
  }
  return c.subtle
}

/** A view whose backing buffer is a plain ArrayBuffer — safe as a BufferSource. */
function detach(bytes: Uint8Array): Bytes {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy
}

/* ------------------------------------------------------------------ *
 * MD5 — required by PDF revisions 2-4. WebCrypto deliberately omits it.
 * ------------------------------------------------------------------ */

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const MD5_K = (() => {
  const k = new Int32Array(64)
  for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0
  return k
})()

export function md5(message: Uint8Array): Bytes {
  const len = message.length
  const padded = (((len + 8) >> 6) + 1) << 6
  const buf = new Uint8Array(padded)
  buf.set(message)
  buf[len] = 0x80
  const view = new DataView(buf.buffer)
  view.setUint32(padded - 8, (len << 3) >>> 0, true)
  view.setUint32(padded - 4, Math.floor(len / 536870912) >>> 0, true)

  let a0 = 0x67452301 | 0
  let b0 = 0xefcdab89 | 0
  let c0 = 0x98badcfe | 0
  let d0 = 0x10325476 | 0
  const m = new Int32Array(16)

  for (let off = 0; off < padded; off += 64) {
    for (let i = 0; i < 16; i++) m[i] = view.getUint32(off + i * 4, true) | 0
    let a = a0
    let b = b0
    let c = c0
    let d = d0
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
      const tmp = (f + a + MD5_K[i] + m[g]) | 0
      const shift = MD5_S[i]
      a = d
      d = c
      c = b
      b = (b + ((tmp << shift) | (tmp >>> (32 - shift)))) | 0
    }
    a0 = (a0 + a) | 0
    b0 = (b0 + b) | 0
    c0 = (c0 + c) | 0
    d0 = (d0 + d) | 0
  }

  const out = new Uint8Array(16)
  const ov = new DataView(out.buffer)
  ov.setUint32(0, a0 >>> 0, true)
  ov.setUint32(4, b0 >>> 0, true)
  ov.setUint32(8, c0 >>> 0, true)
  ov.setUint32(12, d0 >>> 0, true)
  return out
}

/* ------------------------------------------------------------------ *
 * RC4 — required by PDF revisions 2-4.
 * ------------------------------------------------------------------ */

export function rc4(key: Uint8Array, data: Uint8Array): Bytes {
  const s = new Uint8Array(256)
  for (let i = 0; i < 256; i++) s[i] = i
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255
    const t = s[i]
    s[i] = s[j]
    s[j] = t
  }
  const out = new Uint8Array(data.length)
  let i = 0
  j = 0
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) & 255
    j = (j + s[i]) & 255
    const t = s[i]
    s[i] = s[j]
    s[j] = t
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255]
  }
  return out
}

/* ------------------------------------------------------------------ *
 * AES via WebCrypto.
 *
 * WebCrypto's AES-CBC always applies PKCS#7 padding and there is no flag to
 * turn it off. PDF needs raw, unpadded CBC in three places, so:
 *   - encrypt: run the padded encrypt and drop the trailing padding block
 *     (CBC is sequential, so earlier blocks are untouched);
 *   - decrypt: append one synthetic ciphertext block whose plaintext is a full
 *     0x10 padding block, which WebCrypto then strips for us.
 * ------------------------------------------------------------------ */

const ZERO_IV = new Uint8Array(16)

/**
 * Importing a CryptoKey costs a structured-clone round trip, and a large PDF
 * runs tens of thousands of block operations under the *same* key, so cache it.
 */
const keyCache = new Map<string, Promise<CryptoKey>>()

async function importAesKey(key: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  const id = `${usage}:${toHex(key)}`
  let pending = keyCache.get(id)
  if (!pending) {
    pending = subtle().importKey('raw', detach(key), { name: 'AES-CBC' }, false, [usage])
    if (keyCache.size > 32) keyCache.clear()
    keyCache.set(id, pending)
  }
  return pending
}

/** One raw AES block encryption (equivalent to a single ECB block). */
async function aesEncryptBlock(key: Uint8Array, block: Uint8Array): Promise<Bytes> {
  const k = await importAesKey(key, 'encrypt')
  const out = new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv: ZERO_IV }, k, detach(block)))
  return out.slice(0, 16)
}

/** AES-CBC with no padding. `data.length` must be a multiple of 16. */
export async function aesCbcNoPadEncrypt(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
): Promise<Bytes> {
  if (data.length === 0) return new Uint8Array(0)
  const k = await importAesKey(key, 'encrypt')
  const out = new Uint8Array(
    await subtle().encrypt({ name: 'AES-CBC', iv: detach(iv) }, k, detach(data)),
  )
  return out.slice(0, data.length)
}

/** AES-CBC decrypt with no padding expectation. */
export async function aesCbcNoPadDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
): Promise<Bytes> {
  if (data.length === 0) return new Uint8Array(0)
  if (data.length % 16 !== 0) {
    throw new Error('An encrypted block in this PDF is not a whole number of AES blocks.')
  }
  const last = data.subarray(data.length - 16)
  const target = new Uint8Array(16)
  for (let i = 0; i < 16; i++) target[i] = last[i] ^ 0x10
  const synthetic = await aesEncryptBlock(key, target)
  const k = await importAesKey(key, 'decrypt')
  const combined = concatBytes(data, synthetic)
  const out = new Uint8Array(
    await subtle().decrypt({ name: 'AES-CBC', iv: detach(iv) }, k, detach(combined)),
  )
  return out.slice(0, data.length)
}

/** PDF stream/string form: a random IV prefix followed by padded ciphertext. */
export async function aesEncryptWithIvPrefix(
  key: Uint8Array,
  data: Uint8Array,
): Promise<Bytes> {
  const iv = randomBytes(16)
  const k = await importAesKey(key, 'encrypt')
  const body = new Uint8Array(
    await subtle().encrypt({ name: 'AES-CBC', iv: detach(iv) }, k, detach(data)),
  )
  return concatBytes(iv, body)
}

export async function aesDecryptWithIvPrefix(
  key: Uint8Array,
  data: Uint8Array,
): Promise<Bytes> {
  if (data.length <= 16) return new Uint8Array(0)
  const iv = data.subarray(0, 16)
  const body = data.subarray(16, data.length - ((data.length - 16) % 16))
  const raw = await aesCbcNoPadDecrypt(key, iv, body)
  if (raw.length === 0) return raw
  const pad = raw[raw.length - 1]
  // Tolerate malformed padding rather than refusing to open the document.
  if (pad >= 1 && pad <= 16 && pad <= raw.length) return raw.slice(0, raw.length - pad)
  return raw
}

async function sha(bits: 256 | 384 | 512, data: Uint8Array): Promise<Bytes> {
  return new Uint8Array(await subtle().digest(`SHA-${bits}`, detach(data)))
}

/* ------------------------------------------------------------------ *
 * Password hashing
 * ------------------------------------------------------------------ */

/**
 * ISO 32000-2 Algorithm 2.B — the iterated hash used by revision 6.
 * Revision 5 (the deprecated Adobe extension) is the single SHA-256.
 */
export async function hash2B(
  revision: number,
  password: Uint8Array,
  salt: Uint8Array,
  userData: Uint8Array,
): Promise<Bytes> {
  let k = await sha(256, concatBytes(password, salt, userData))
  if (revision === 5) return k.slice(0, 32)

  let e: Bytes = new Uint8Array([0])
  let round = 0
  while (round < 64 || e[e.length - 1] > round - 32) {
    const seed = concatBytes(password, k, userData)
    const k1 = new Uint8Array(seed.length * 64)
    for (let i = 0; i < 64; i++) k1.set(seed, i * seed.length)
    e = await aesCbcNoPadEncrypt(k.subarray(0, 16), k.subarray(16, 32), k1)
    // 256 ≡ 1 (mod 3), so the big-endian integer's remainder is the byte sum's.
    let mod = 0
    for (let i = 0; i < 16; i++) mod = (mod + e[i]) % 3
    k = await sha(mod === 0 ? 256 : mod === 1 ? 384 : 512, e)
    round += 1
    if (round > 1000) throw new Error('The password hash did not converge; this file looks corrupt.')
  }
  return k.slice(0, 32)
}

/** The 32-byte padding string from ISO 32000-1 Algorithm 2. */
const PAD = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
])

/** Latin-1/PDFDoc bytes of a legacy (revision ≤ 4) password, padded to 32. */
export function padLegacyPassword(password: string): Bytes {
  const raw: number[] = []
  for (let i = 0; i < password.length && raw.length < 32; i++) {
    raw.push(password.charCodeAt(i) & 0xff)
  }
  const out = new Uint8Array(32)
  out.set(raw.slice(0, 32))
  if (raw.length < 32) out.set(PAD.subarray(0, 32 - raw.length), raw.length)
  return out
}

/** UTF-8 bytes of a revision 5/6 password, truncated to the spec's 127 bytes. */
export function utf8Password(password: string): Bytes {
  const bytes = new TextEncoder().encode(password)
  return bytes.length <= 127 ? bytes : bytes.slice(0, 127)
}

/* ------------------------------------------------------------------ *
 * Permission flags
 * ------------------------------------------------------------------ */

export interface PdfPermissions {
  /** Bit 3 — print the document (low resolution when `highQualityPrint` is off). */
  print: boolean
  /** Bit 12 — print at full resolution. */
  highQualityPrint: boolean
  /** Bit 4 — change the content. */
  modify: boolean
  /** Bit 5 — copy or extract text and graphics. */
  copy: boolean
  /** Bit 6 — add or modify annotations. */
  annotate: boolean
  /** Bit 9 — fill in existing form fields. */
  fillForms: boolean
  /** Bit 10 — extract for accessibility tools. */
  accessibility: boolean
  /** Bit 11 — insert, rotate or delete pages. */
  assemble: boolean
}

export const ALL_PERMISSIONS: PdfPermissions = {
  print: true,
  highQualityPrint: true,
  modify: true,
  copy: true,
  annotate: true,
  fillForms: true,
  accessibility: true,
  assemble: true,
}

/**
 * Build the /P integer. Bits 1-2 are reserved 0, bits 7-8 and 13-32 reserved 1,
 * everything else is a capability we either grant or withhold.
 */
export function permissionsToP(p: PdfPermissions): number {
  let value = -1 // all bits set
  const clear = (bit: number) => {
    value &= ~(1 << (bit - 1))
  }
  const apply = (bit: number, allowed: boolean) => {
    if (!allowed) clear(bit)
  }
  clear(1)
  clear(2)
  apply(3, p.print)
  apply(4, p.modify)
  apply(5, p.copy)
  apply(6, p.annotate)
  apply(9, p.fillForms)
  apply(10, p.accessibility)
  apply(11, p.assemble)
  apply(12, p.highQualityPrint)
  return value | 0
}

export function pToPermissions(p: number): PdfPermissions {
  const on = (bit: number) => (p & (1 << (bit - 1))) !== 0
  return {
    print: on(3),
    modify: on(4),
    copy: on(5),
    annotate: on(6),
    fillForms: on(9),
    accessibility: on(10),
    assemble: on(11),
    highQualityPrint: on(12),
  }
}

/* ------------------------------------------------------------------ *
 * Revision 6 (AES-256) key material
 * ------------------------------------------------------------------ */

export interface R6Material {
  fileKey: Uint8Array
  U: Uint8Array
  UE: Uint8Array
  O: Uint8Array
  OE: Uint8Array
  Perms: Uint8Array
  P: number
}

/**
 * ISO 32000-2 Algorithms 8, 9 and 10: build /U, /UE, /O, /OE and /Perms for a
 * fresh random file encryption key.
 */
export async function buildR6Material(
  userPassword: string,
  ownerPassword: string,
  permissions: PdfPermissions,
  encryptMetadata = true,
): Promise<R6Material> {
  const fileKey = randomBytes(32)
  const P = permissionsToP(permissions)

  const userPw = utf8Password(userPassword)
  const userValidationSalt = randomBytes(8)
  const userKeySalt = randomBytes(8)
  const userHash = await hash2B(6, userPw, userValidationSalt, new Uint8Array(0))
  const U = concatBytes(userHash, userValidationSalt, userKeySalt)
  const userIntermediate = await hash2B(6, userPw, userKeySalt, new Uint8Array(0))
  const UE = await aesCbcNoPadEncrypt(userIntermediate, ZERO_IV, fileKey)

  const ownerPw = utf8Password(ownerPassword)
  const ownerValidationSalt = randomBytes(8)
  const ownerKeySalt = randomBytes(8)
  const ownerHash = await hash2B(6, ownerPw, ownerValidationSalt, U)
  const O = concatBytes(ownerHash, ownerValidationSalt, ownerKeySalt)
  const ownerIntermediate = await hash2B(6, ownerPw, ownerKeySalt, U)
  const OE = await aesCbcNoPadEncrypt(ownerIntermediate, ZERO_IV, fileKey)

  const permsBlock = new Uint8Array(16)
  new DataView(permsBlock.buffer).setInt32(0, P, true)
  permsBlock[4] = 0xff
  permsBlock[5] = 0xff
  permsBlock[6] = 0xff
  permsBlock[7] = 0xff
  permsBlock[8] = encryptMetadata ? 0x54 /* T */ : 0x46 /* F */
  permsBlock[9] = 0x61 // a
  permsBlock[10] = 0x64 // d
  permsBlock[11] = 0x62 // b
  permsBlock.set(randomBytes(4), 12)
  const Perms = await aesEncryptBlock(fileKey, permsBlock)

  return { fileKey, U, UE, O, OE, Perms, P }
}

/* ------------------------------------------------------------------ *
 * Opening an encrypted document
 * ------------------------------------------------------------------ */

export type CipherMethod = 'none' | 'rc4' | 'aesv2' | 'aesv3'

export interface EncryptionInfo {
  revision: number
  version: number
  /** File encryption key length in bytes. */
  keyLength: number
  method: CipherMethod
  O: Uint8Array
  U: Uint8Array
  OE: Uint8Array | null
  UE: Uint8Array | null
  P: number
  encryptMetadata: boolean
  /** First element of the trailer /ID array. */
  idBytes: Uint8Array
}

export type PasswordKind = 'user' | 'owner'

export interface UnlockedKey {
  key: Uint8Array
  matched: PasswordKind
}

/** ISO 32000-1 Algorithm 2 — the revision 2-4 file key. */
async function legacyFileKey(info: EncryptionInfo, password: string): Promise<Bytes> {
  const pBytes = new Uint8Array(4)
  new DataView(pBytes.buffer).setInt32(0, info.P, true)
  const parts: Uint8Array[] = [padLegacyPassword(password), info.O.subarray(0, 32), pBytes, info.idBytes]
  if (info.revision >= 4 && !info.encryptMetadata) {
    parts.push(new Uint8Array([0xff, 0xff, 0xff, 0xff]))
  }
  let key = md5(concatBytes(...parts))
  const n = info.revision === 2 ? 5 : info.keyLength
  if (info.revision >= 3) {
    for (let i = 0; i < 50; i++) key = md5(key.subarray(0, n))
  }
  return key.slice(0, n)
}

/** ISO 32000-1 Algorithm 6 — does this password open the document as the user? */
async function legacyUserMatches(info: EncryptionInfo, key: Uint8Array): Promise<boolean> {
  if (info.revision === 2) {
    const expect = rc4(key, PAD)
    return bytesEqual(expect, info.U.subarray(0, 32))
  }
  let value = md5(concatBytes(PAD, info.idBytes))
  value = rc4(key, value)
  for (let i = 1; i <= 19; i++) {
    const derived = new Uint8Array(key.length)
    for (let j = 0; j < key.length; j++) derived[j] = key[j] ^ i
    value = rc4(derived, value)
  }
  return bytesEqual(value, info.U.subarray(0, 16))
}

/** ISO 32000-1 Algorithm 7 — recover the user password from the owner password. */
function legacyUserPasswordFromOwner(info: EncryptionInfo, ownerPassword: string): Bytes {
  let key = md5(padLegacyPassword(ownerPassword))
  const n = info.revision === 2 ? 5 : info.keyLength
  if (info.revision >= 3) {
    for (let i = 0; i < 50; i++) key = md5(key)
  }
  const rc4Key = key.slice(0, n)
  let value = info.O.slice(0, 32)
  if (info.revision === 2) {
    value = rc4(rc4Key, value)
  } else {
    for (let i = 19; i >= 0; i--) {
      const derived = new Uint8Array(rc4Key.length)
      for (let j = 0; j < rc4Key.length; j++) derived[j] = rc4Key[j] ^ i
      value = rc4(derived, value)
    }
  }
  return value
}

/**
 * Try `password` against the document. Returns the file encryption key, or
 * null when the password is wrong.
 */
export async function unlockKey(
  info: EncryptionInfo,
  password: string,
): Promise<UnlockedKey | null> {
  if (info.revision >= 5) {
    const pw = utf8Password(password)
    const userValidation = info.U.subarray(32, 40)
    const userHash = await hash2B(info.revision, pw, userValidation, new Uint8Array(0))
    if (bytesEqual(userHash, info.U.subarray(0, 32))) {
      const inter = await hash2B(info.revision, pw, info.U.subarray(40, 48), new Uint8Array(0))
      if (!info.UE) throw new Error('This PDF is missing its /UE entry and cannot be decrypted.')
      return { key: await aesCbcNoPadDecrypt(inter, ZERO_IV, info.UE), matched: 'user' }
    }
    const ownerValidation = info.O.subarray(32, 40)
    const ownerHash = await hash2B(info.revision, pw, ownerValidation, info.U.subarray(0, 48))
    if (bytesEqual(ownerHash, info.O.subarray(0, 32))) {
      const inter = await hash2B(info.revision, pw, info.O.subarray(40, 48), info.U.subarray(0, 48))
      if (!info.OE) throw new Error('This PDF is missing its /OE entry and cannot be decrypted.')
      return { key: await aesCbcNoPadDecrypt(inter, ZERO_IV, info.OE), matched: 'owner' }
    }
    return null
  }

  const asUser = await legacyFileKey(info, password)
  if (await legacyUserMatches(info, asUser)) return { key: asUser, matched: 'user' }

  // Owner password: recover the user password it protects, then derive again.
  const recovered = legacyUserPasswordFromOwner(info, password)
  let recoveredText = ''
  for (let i = 0; i < recovered.length; i++) recoveredText += String.fromCharCode(recovered[i])
  const asOwner = await legacyFileKey(info, recoveredText)
  if (await legacyUserMatches(info, asOwner)) return { key: asOwner, matched: 'owner' }

  return null
}

/** Per-object key for revisions ≤ 4 (revision 5/6 uses the file key directly). */
export function objectKey(
  fileKey: Uint8Array,
  objectNumber: number,
  generation: number,
  method: CipherMethod,
): Uint8Array {
  if (method === 'aesv3') return fileKey
  const extra = method === 'aesv2' ? new Uint8Array([0x73, 0x41, 0x6c, 0x54]) : new Uint8Array(0)
  const suffix = new Uint8Array([
    objectNumber & 0xff,
    (objectNumber >> 8) & 0xff,
    (objectNumber >> 16) & 0xff,
    generation & 0xff,
    (generation >> 8) & 0xff,
  ])
  const digest = md5(concatBytes(fileKey, suffix, extra))
  return digest.slice(0, Math.min(fileKey.length + 5, 16))
}

export async function decryptData(
  key: Uint8Array,
  data: Uint8Array,
  method: CipherMethod,
): Promise<Uint8Array> {
  if (method === 'none' || data.length === 0) return data
  if (method === 'rc4') return rc4(key, data)
  return aesDecryptWithIvPrefix(key, data)
}

export async function encryptData(
  key: Uint8Array,
  data: Uint8Array,
  method: CipherMethod,
): Promise<Uint8Array> {
  if (method === 'none' || data.length === 0) return data
  if (method === 'rc4') return rc4(key, data)
  return aesEncryptWithIvPrefix(key, data)
}
