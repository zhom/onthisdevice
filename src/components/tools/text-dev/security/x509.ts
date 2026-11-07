/** X.509 certificates and PKCS#10 certificate signing requests: fields, extensions and fingerprints. */
import type { Node } from './asn1'
import { asString, asTime, bigHex, bitLength, dn, oid, oidName, parseDer, raw } from './asn1'

export interface KeyInfo {
  algorithm: string
  size: string
}

export function keyInfo(spki: Node): KeyInfo {
  const algo = spki.children[0]
  const alg = oid(algo.children[0].value)
  const name = oidName(alg)
  if (name === 'RSA') {
    // subjectPublicKey BIT STRING (skip the unused-bits byte) holds RSAPublicKey { modulus, exponent }.
    const rsa = parseDer(spki.children[1].value.subarray(1))[0]
    const bits = bitLength(rsa.children[0].value)
    return { algorithm: 'RSA', size: `${bits} bits, exponent ${parseInt(bigHex(rsa.children[1].value).replace(/:/g, ''), 16)}` }
  }
  if (name === 'EC') {
    const curve = algo.children[1] ? oidName(oid(algo.children[1].value)) : 'unknown curve'
    return { algorithm: 'Elliptic curve (ECDSA)', size: curve }
  }
  return { algorithm: name, size: name === 'Ed25519' ? '256 bits' : '' }
}

const KEY_USAGE = ['Digital signature', 'Non-repudiation', 'Key encipherment', 'Data encipherment', 'Key agreement', 'Certificate signing', 'CRL signing', 'Encipher only', 'Decipher only']

function generalNames(seqNode: Node): string[] {
  return seqNode.children.map((g) => {
    const v = g.value
    switch (g.ctx) {
      case 1:
        return `email:${asString(g)}`
      case 2:
        return `DNS:${asString(g)}`
      case 6:
        return `URI:${asString(g)}`
      case 7:
        return v.length === 4 ? `IP:${Array.from(v).join('.')}` : `IP:${Array.from({ length: v.length / 2 }, (_, i) => ((v[i * 2] << 8) | v[i * 2 + 1]).toString(16)).join(':')}`
      case 4:
        return `DirName:${dn(g.children[0])}`
      default:
        return `[${g.ctx}]`
    }
  })
}

export interface Extension {
  name: string
  critical: boolean
  value: string
}

export function extensions(list: Node[]): Extension[] {
  return list.map((ext) => {
    const id = oid(ext.children[0].value)
    const critical = ext.children.length === 3 && ext.children[1].tag === 0x01 && ext.children[1].value[0] !== 0
    const inner = parseDer(ext.children[ext.children.length - 1].value)[0]
    let value = ''
    try {
      switch (id) {
        case '2.5.29.17':
          value = generalNames(inner).join(', ')
          break
        case '2.5.29.15': {
          const bits = inner.value.subarray(1)
          value = KEY_USAGE.filter((_, i) => (bits[i >> 3] ?? 0) & (0x80 >> (i & 7))).join(', ')
          break
        }
        case '2.5.29.37':
          value = inner.children.map((c) => oidName(oid(c.value))).join(', ')
          break
        case '2.5.29.19': {
          const ca = inner.children.find((c) => c.tag === 0x01)
          const path = inner.children.find((c) => c.tag === 0x02)
          value = `CA: ${ca && ca.value[0] ? 'yes' : 'no'}${path ? `, path length ${path.value[0]}` : ''}`
          break
        }
        case '2.5.29.14':
          value = bigHex(inner.value)
          break
        case '2.5.29.35':
          value = bigHex(inner.children.find((c) => c.ctx === 0)?.value ?? new Uint8Array())
          break
        case '2.5.29.31':
          value = inner.children.flatMap((dp) => dp.children.flatMap((c) => c.children.flatMap((n) => generalNames(n)))).join(', ')
          break
        case '1.3.6.1.5.5.7.1.1':
          value = inner.children.map((ad) => `${oidName(oid(ad.children[0].value))}: ${generalNames({ ...ad, children: [ad.children[1]] }).join('')}`).join(', ')
          break
        case '2.5.29.32':
          value = inner.children.map((p) => oidName(oid(p.children[0].value))).join(', ')
          break
        default:
          value = `${inner.length} bytes`
      }
    } catch {
      value = 'Could not be decoded'
    }
    return { name: oidName(id), critical, value }
  })
}

export interface Certificate {
  version: number
  serial: string
  signature: string
  issuer: string
  subject: string
  notBefore: Date
  notAfter: Date
  key: KeyInfo
  extensions: Extension[]
  der: Uint8Array
}

export function parseCertificate(der: Uint8Array): Certificate {
  const cert = parseDer(der)[0]
  if (!cert || cert.tag !== 0x30 || cert.children.length < 3) throw new Error('This is not an X.509 certificate.')
  const tbs = cert.children[0].children
  let i = 0
  const version = tbs[0].ctx === 0 ? parseDer(tbs[0].value)[0].value[0] + 1 : 1
  if (tbs[0].ctx === 0) i++
  const serial = bigHex(tbs[i].value)
  const sigAlg = oidName(oid(tbs[i + 1].children[0].value))
  const issuer = dn(tbs[i + 2])
  const validity = tbs[i + 3].children
  const subject = dn(tbs[i + 4])
  const key = keyInfo(tbs[i + 5])
  const extNode = tbs.slice(i + 6).find((n) => n.ctx === 3)
  return {
    version,
    serial,
    signature: sigAlg,
    issuer,
    subject,
    notBefore: asTime(validity[0]),
    notAfter: asTime(validity[1]),
    key,
    extensions: extNode ? extensions(parseDer(extNode.value)[0].children) : [],
    der: raw(der, cert),
  }
}

export interface Csr {
  subject: string
  key: KeyInfo
  signature: string
  extensions: Extension[]
  attributes: string[]
  /** The signed part, the public key and the signature, to verify the request. */
  info: Uint8Array
  spki: Uint8Array
  sig: Uint8Array
  sigOid: string
  curve: string
}

export function parseCsr(der: Uint8Array): Csr {
  const req = parseDer(der)[0]
  if (!req || req.children.length !== 3) throw new Error('This is not a certificate signing request (PKCS #10).')
  const info = req.children[0]
  const [, subject, spki, attrs] = info.children
  const exts: Extension[] = []
  const attributes: string[] = []
  for (const a of attrs?.children ?? []) {
    const id = oid(a.children[0].value)
    if (id === '1.2.840.113549.1.9.14') exts.push(...extensions(a.children[1].children[0].children))
    else attributes.push(`${oidName(id)}: ${a.children[1].children.map(asString).join(', ')}`)
  }
  const sigOid = oid(req.children[1].children[0].value)
  const curveNode = spki.children[0].children[1]
  return {
    subject: dn(subject),
    key: keyInfo(spki),
    signature: oidName(sigOid),
    extensions: exts,
    attributes,
    info: raw(der, info),
    spki: raw(der, spki),
    sig: req.children[2].value.subarray(1),
    sigOid,
    curve: curveNode?.tag === 0x06 ? oidName(oid(curveNode.value)) : '',
  }
}

/** ECDSA signatures in DER are SEQUENCE { r, s }; WebCrypto wants r and s as fixed-size halves. */
function ecdsaRaw(sig: Uint8Array, size: number): Uint8Array {
  const [r, s] = parseDer(sig)[0].children.map((n) => {
    let v = n.value
    while (v.length > size && v[0] === 0) v = v.subarray(1)
    const out = new Uint8Array(size)
    out.set(v, size - v.length)
    return out
  })
  const out = new Uint8Array(size * 2)
  out.set(r)
  out.set(s, size)
  return out
}

/** Checks the CSR signature with its own public key. null when the algorithm is not supported here. */
export async function verifyCsr(c: Csr): Promise<boolean | null> {
  const hashOf: Record<string, string> = {
    '1.2.840.113549.1.1.11': 'SHA-256', '1.2.840.113549.1.1.12': 'SHA-384', '1.2.840.113549.1.1.13': 'SHA-512', '1.2.840.113549.1.1.5': 'SHA-1',
    '1.2.840.10045.4.3.2': 'SHA-256', '1.2.840.10045.4.3.3': 'SHA-384', '1.2.840.10045.4.3.4': 'SHA-512',
  }
  const spki = new Uint8Array(c.spki)
  const data = new Uint8Array(c.info)
  try {
    if (c.key.algorithm === 'RSA' && hashOf[c.sigOid]) {
      const key = await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: hashOf[c.sigOid] }, false, ['verify'])
      return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, new Uint8Array(c.sig), data)
    }
    if (c.key.algorithm.startsWith('Elliptic') && hashOf[c.sigOid] && /^P-(256|384|521)$/.test(c.curve)) {
      const size = c.curve === 'P-256' ? 32 : c.curve === 'P-384' ? 48 : 66
      const key = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: c.curve }, false, ['verify'])
      return await crypto.subtle.verify({ name: 'ECDSA', hash: hashOf[c.sigOid] }, key, new Uint8Array(ecdsaRaw(c.sig, size)), data)
    }
    if (c.key.algorithm === 'Ed25519') {
      const key = await crypto.subtle.importKey('spki', spki, { name: 'Ed25519' }, false, ['verify'])
      return await crypto.subtle.verify('Ed25519', key, new Uint8Array(c.sig), data)
    }
  } catch {
    return false
  }
  return null
}

export async function fingerprint(der: Uint8Array, algo: 'SHA-1' | 'SHA-256'): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest(algo, new Uint8Array(der)))
  return Array.from(d, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':')
}
