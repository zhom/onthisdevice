/** Key pairs with WebCrypto, OpenSSH key formats, PEM and JWK conversion, and JWT signing. */
import { md5Hex } from '@/components/tools/dev/devlib'
import { concat, derNull, encodeOid, fromBase64, integer, octets, oid, parseDer, pemBlocks, seq, toBase64, toPem } from './asn1'

const enc = new TextEncoder()

export const b64url = (bytes: Uint8Array) => toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const fromB64url = (s: string) => fromBase64(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='))

/* ── SSH wire format ── */

const u32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])
const sshString = (b: Uint8Array | string) => {
  const bytes = typeof b === 'string' ? enc.encode(b) : b
  return concat(u32(bytes.length), bytes)
}
const mpint = (b: Uint8Array) => {
  let v = b
  while (v.length > 1 && v[0] === 0 && !(v[1] & 0x80)) v = v.subarray(1)
  return sshString(v[0] & 0x80 ? concat(new Uint8Array([0]), v) : v)
}

export type SshType = 'ed25519' | 'rsa' | 'ecdsa'

export interface SshKeyPair {
  publicLine: string
  privatePem: string
  fingerprint: string
  type: string
}

function opensshPrivate(keyType: string, pubBlob: Uint8Array, privFields: Uint8Array, comment: string): string {
  const check = crypto.getRandomValues(new Uint8Array(4))
  let body = concat(check, check, sshString(keyType), privFields, sshString(comment))
  const pad: number[] = []
  for (let i = 1; (body.length + pad.length) % 8 !== 0; i++) pad.push(i)
  body = concat(body, new Uint8Array(pad))
  const blob = concat(enc.encode('openssh-key-v1\0'), sshString('none'), sshString('none'), sshString(''), u32(1), sshString(pubBlob), sshString(body))
  return toPem('OPENSSH PRIVATE KEY', blob, 70)
}

export async function sshFingerprint(blob: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(blob)))
  return `SHA256:${toBase64(d).replace(/=+$/, '')}`
}

export function sshMd5(blob: Uint8Array): string {
  return `MD5:${(md5Hex(blob).match(/../g) ?? []).join(':')}`
}

export async function generateSsh(type: SshType, bits: number, comment: string): Promise<SshKeyPair> {
  if (type === 'ed25519') {
    let pair: CryptoKeyPair
    try {
      pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair
    } catch {
      throw new Error('This browser cannot make Ed25519 keys. Update it, or choose RSA or ECDSA.')
    }
    const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
    const seed = pkcs8.subarray(pkcs8.length - 32)
    const blob = concat(sshString('ssh-ed25519'), sshString(pub))
    const priv = concat(sshString(pub), sshString(concat(seed, pub)))
    return { type: 'ssh-ed25519', publicLine: `ssh-ed25519 ${toBase64(blob)}${comment ? ` ${comment}` : ''}`, privatePem: opensshPrivate('ssh-ed25519', blob, priv, comment), fingerprint: await sshFingerprint(blob) }
  }
  if (type === 'ecdsa') {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    const q = concat(new Uint8Array([4]), fromB64url(jwk.x ?? ''), fromB64url(jwk.y ?? ''))
    const kt = 'ecdsa-sha2-nistp256'
    const blob = concat(sshString(kt), sshString('nistp256'), sshString(q))
    const priv = concat(sshString('nistp256'), sshString(q), mpint(fromB64url(jwk.d ?? '')))
    return { type: kt, publicLine: `${kt} ${toBase64(blob)}${comment ? ` ${comment}` : ''}`, privatePem: opensshPrivate(kt, blob, priv, comment), fingerprint: await sshFingerprint(blob) }
  }
  const pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const j = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const [n, e, d, p, qq, qi] = [j.n, j.e, j.d, j.p, j.q, j.qi].map((x) => fromB64url(x ?? ''))
  const blob = concat(sshString('ssh-rsa'), mpint(e), mpint(n))
  const priv = concat(mpint(n), mpint(e), mpint(d), mpint(qi), mpint(p), mpint(qq))
  return { type: 'ssh-rsa', publicLine: `ssh-rsa ${toBase64(blob)}${comment ? ` ${comment}` : ''}`, privatePem: opensshPrivate('ssh-rsa', blob, priv, comment), fingerprint: await sshFingerprint(blob) }
}

/** Reads "type base64 comment" public key lines (authorized_keys and .pub files). */
export function parseSshPublic(line: string): { type: string; blob: Uint8Array; comment: string; bits: string } {
  const m = /^(?:\S+\s+)?((?:ssh|ecdsa|sk)-[\w@.-]+)\s+([A-Za-z0-9+/=]+)\s*(.*)$/.exec(line.trim())
  if (!m) throw new Error('This is not an SSH public key line. It looks like: ssh-ed25519 AAAA... comment')
  const blob = fromBase64(m[2])
  // The blob repeats the key type first; read it to check the line is not cut.
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  const read = (o: number) => {
    const n = view.getUint32(o)
    return { bytes: blob.subarray(o + 4, o + 4 + n), next: o + 4 + n }
  }
  const t = read(0)
  const inner = new TextDecoder().decode(t.bytes)
  if (inner !== m[1]) throw new Error(`The key data says ${inner}, but the line says ${m[1]}.`)
  let bits = ''
  if (inner === 'ssh-rsa') {
    const e = read(t.next)
    const n = read(e.next)
    let k = 0
    while (n.bytes[k] === 0) k++
    bits = `${(n.bytes.length - k - 1) * 8 + (32 - Math.clz32(n.bytes[k]))} bits`
  } else if (inner === 'ssh-ed25519') bits = '256 bits'
  else if (inner.startsWith('ecdsa-sha2-')) bits = inner.slice(11)
  return { type: m[1], blob, comment: m[3], bits }
}

/* ── RSA and EC key pairs as PEM ── */

export async function generateRsaPem(bits: number, format: 'pkcs8' | 'pkcs1'): Promise<{ privatePem: string; publicPem: string; jwk: JsonWebKey }> {
  const pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey))
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  if (format === 'pkcs1') {
    // PKCS#8 wraps the PKCS#1 RSAPrivateKey in an OCTET STRING; SPKI wraps RSAPublicKey in a BIT STRING.
    const inner = parseDer(pkcs8)[0].children[2].value
    const pub = parseDer(spki)[0].children[1].value.subarray(1)
    return { privatePem: toPem('RSA PRIVATE KEY', inner), publicPem: toPem('RSA PUBLIC KEY', pub), jwk }
  }
  return { privatePem: toPem('PRIVATE KEY', pkcs8), publicPem: toPem('PUBLIC KEY', spki), jwk }
}

/* ── JWK and PEM ── */

type KeyAlg = RsaHashedImportParams | EcKeyImportParams | { name: 'Ed25519' }

function algFromJwk(j: JsonWebKey): KeyAlg {
  if (j.kty === 'RSA') return { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
  if (j.kty === 'EC') {
    if (!j.crv || !/^P-(256|384|521)$/.test(j.crv)) throw new Error(`Curve ${j.crv ?? '(none)'} is not supported. Use P-256, P-384 or P-521.`)
    return { name: 'ECDSA', namedCurve: j.crv }
  }
  if (j.kty === 'OKP' && j.crv === 'Ed25519') return { name: 'Ed25519' }
  throw new Error(`Key type ${j.kty ?? '(none)'} is not supported. Use RSA, EC or OKP with Ed25519.`)
}

export async function jwkToPem(text: string): Promise<{ pem: string; kind: string }> {
  let j: JsonWebKey & { keys?: JsonWebKey[] }
  try {
    j = JSON.parse(text) as JsonWebKey & { keys?: JsonWebKey[] }
  } catch {
    throw new Error('The JWK must be JSON, such as {"kty": "RSA", "n": "...", "e": "AQAB"}.')
  }
  if (j.keys?.length) j = j.keys[0]
  const alg = algFromJwk(j)
  const priv = j.d !== undefined
  const usage: KeyUsage[] = priv ? ['sign'] : ['verify']
  const clean: JsonWebKey = { ...j, key_ops: undefined, alg: undefined, use: undefined, ext: true }
  const key = await crypto.subtle.importKey('jwk', clean, alg, true, usage)
  const der = new Uint8Array(await crypto.subtle.exportKey(priv ? 'pkcs8' : 'spki', key))
  return { pem: toPem(priv ? 'PRIVATE KEY' : 'PUBLIC KEY', der), kind: `${j.kty}${j.crv ? ` ${j.crv}` : ''} ${priv ? 'private' : 'public'} key` }
}

const RSA_OID = '1.2.840.113549.1.1.1'
const CURVES: Record<string, string> = { '1.2.840.10045.3.1.7': 'P-256', '1.3.132.0.34': 'P-384', '1.3.132.0.35': 'P-521' }

/** Algorithm of a PKCS#8 or SPKI key, from the AlgorithmIdentifier inside it. */
function algFromDer(der: Uint8Array, privateKey: boolean): KeyAlg {
  const top = parseDer(der)[0]
  const ai = privateKey ? top.children[1] : top.children[0]
  const o = oid(ai.children[0].value)
  if (o === RSA_OID) return { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
  if (o === '1.2.840.10045.2.1') {
    const curve = CURVES[oid(ai.children[1].value)]
    if (!curve) throw new Error('Only P-256, P-384 and P-521 curves are supported.')
    return { name: 'ECDSA', namedCurve: curve }
  }
  if (o === '1.3.101.112') return { name: 'Ed25519' }
  throw new Error(`Key algorithm ${o} is not supported.`)
}

/** PKCS#1 RSAPrivateKey wrapped as PKCS#8, and RSAPublicKey wrapped as SPKI. */
const wrapPkcs1Private = (der: Uint8Array) => seq(integer(new Uint8Array([0])), seq(encodeOid(RSA_OID), derNull()), octets(der))
const wrapPkcs1Public = (der: Uint8Array) => seq(seq(encodeOid(RSA_OID), derNull()), new Uint8Array([0x03, ...derLen(der.length + 1), 0, ...der]))
function derLen(n: number): number[] {
  if (n < 128) return [n]
  const b: number[] = []
  for (let x = n; x > 0; x = Math.floor(x / 256)) b.unshift(x % 256)
  return [0x80 | b.length, ...b]
}

export async function pemToJwk(text: string): Promise<{ jwk: JsonWebKey; kind: string }> {
  const block = pemBlocks(text)[0]
  if (!block) throw new Error('No PEM block found. A PEM key starts with -----BEGIN PUBLIC KEY----- or -----BEGIN PRIVATE KEY-----.')
  let der = block.der
  let priv = /PRIVATE/.test(block.label)
  if (block.label === 'RSA PRIVATE KEY') der = wrapPkcs1Private(der)
  else if (block.label === 'RSA PUBLIC KEY') der = wrapPkcs1Public(der)
  else if (block.label === 'EC PRIVATE KEY') throw new Error('SEC1 "EC PRIVATE KEY" files are not supported. Convert it to PKCS #8 first.')
  else if (block.label === 'ENCRYPTED PRIVATE KEY') throw new Error('This private key is encrypted with a password. Decrypt it first.')
  else if (block.label === 'CERTIFICATE') {
    // Use the public key of a certificate: tbsCertificate.subjectPublicKeyInfo.
    const tbs = parseDer(der)[0].children[0]
    const i = tbs.children[0].ctx === 0 ? 6 : 5
    const spki = tbs.children[i]
    der = der.subarray(spki.start, spki.start + spki.header + spki.length)
    priv = false
  }
  const alg = algFromDer(der, priv)
  const key = await crypto.subtle.importKey(priv ? 'pkcs8' : 'spki', new Uint8Array(der), alg, true, priv ? ['sign'] : ['verify'])
  const jwk = await crypto.subtle.exportKey('jwk', key)
  delete jwk.key_ops
  delete jwk.ext
  delete jwk.alg
  return { jwk, kind: `${alg.name === 'Ed25519' ? 'Ed25519' : 'namedCurve' in alg ? `EC ${alg.namedCurve}` : 'RSA'} ${priv ? 'private' : 'public'} key` }
}

/** RFC 7638 thumbprint: SHA-256 of the required members in lexical order. */
export async function jwkThumbprint(j: JsonWebKey): Promise<string> {
  const req = j.kty === 'RSA' ? { e: j.e, kty: j.kty, n: j.n } : j.kty === 'EC' ? { crv: j.crv, kty: j.kty, x: j.x, y: j.y } : { crv: j.crv, kty: j.kty, x: j.x }
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify(req)))))
}

/* ── JWT ── */

export type JwtAlg = 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512' | 'PS256' | 'ES256' | 'ES384' | 'EdDSA'

export async function signJwt(payload: unknown, alg: JwtAlg, secret: string, extraHeader: Record<string, unknown>): Promise<{ token: string; header: Record<string, unknown> }> {
  const header = { alg, typ: 'JWT', ...extraHeader }
  const signing = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(payload)))}`
  const data = enc.encode(signing)
  const hash = `SHA-${alg.slice(2) === 'DSA' ? '512' : alg.slice(2)}`
  let sig: ArrayBuffer
  if (alg.startsWith('HS')) {
    if (!secret) throw new Error('Type a secret to sign with.')
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash }, false, ['sign'])
    sig = await crypto.subtle.sign('HMAC', key, data)
  } else {
    const block = pemBlocks(secret)[0]
    if (!block || !/PRIVATE KEY/.test(block.label)) throw new Error(`${alg} needs a private key in PEM format (-----BEGIN PRIVATE KEY-----).`)
    const der = block.label === 'RSA PRIVATE KEY' ? wrapPkcs1Private(block.der) : block.der
    if (alg.startsWith('RS') || alg.startsWith('PS')) {
      const name = alg.startsWith('RS') ? 'RSASSA-PKCS1-v1_5' : 'RSA-PSS'
      const key = await crypto.subtle.importKey('pkcs8', new Uint8Array(der), { name, hash }, false, ['sign'])
      sig = await crypto.subtle.sign(name === 'RSA-PSS' ? { name, saltLength: 32 } : name, key, data)
    } else if (alg.startsWith('ES')) {
      const key = await crypto.subtle.importKey('pkcs8', new Uint8Array(der), { name: 'ECDSA', namedCurve: alg === 'ES256' ? 'P-256' : 'P-384' }, false, ['sign'])
      sig = await crypto.subtle.sign({ name: 'ECDSA', hash }, key, data)
    } else {
      const key = await crypto.subtle.importKey('pkcs8', new Uint8Array(der), { name: 'Ed25519' }, false, ['sign'])
      sig = await crypto.subtle.sign('Ed25519', key, data)
    }
  }
  return { token: `${signing}.${b64url(new Uint8Array(sig))}`, header }
}
