/** Hashes, password hashing, keys, certificates and check-digit validators. */
import { bytesToHex, utf8Encode } from '@/components/tools/dev/devlib'
import type { Field, Result, Spec, Specs, Values } from '../shell/spec'
import { bool, num, pick, str } from '../shell/spec'
import { pemBlocks, toBase64 } from './asn1'
import type { JwtAlg, SshType } from './keys'
import { generateRsaPem, generateSsh, jwkThumbprint, jwkToPem, parseSshPublic, pemToJwk, signJwt, sshFingerprint, sshMd5 } from './keys'
import { SAMPLE_CERT, SAMPLE_CSR, SAMPLE_SSH_PUBLIC } from './samples'
import { checkIban, formatIban, ibanCheckDigits, identifyHash, luhnCheckDigit, luhnValid, validateCard } from './validate'
import { fingerprint, parseCertificate, parseCsr, verifyCsr } from './x509'

const hashWasm = () => import('hash-wasm')

const FORMAT: Field = {
  kind: 'choice',
  id: 'format',
  label: 'Output',
  default: 'hex',
  choices: [
    { value: 'hex', label: 'Hex' },
    { value: 'HEX', label: 'HEX' },
    { value: 'base64', label: 'Base64' },
  ],
}

function formatDigest(hex: string, v: Values): string {
  const f = str(v, 'format')
  if (f === 'HEX') return hex.toUpperCase()
  if (f === 'base64') return toBase64(new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16))))
  return hex
}

function hashSpec(label: string, digest: (data: Uint8Array, v: Values) => Promise<string>, fields: Field[] = []): Spec {
  return {
    input: { label: 'Text to hash', sample: 'The quick brown fox jumps over the lazy dog', hint: 'The text is hashed as UTF-8 bytes, exactly as typed, including spaces and line breaks.' },
    output: { label, filename: 'hash.txt', rows: 3 },
    fields: [...fields, FORMAT],
    run: async (input, v) => {
      const bytes = utf8Encode(input)
      const hex = await digest(bytes, v)
      return { text: formatDigest(hex, v), stats: [{ label: 'Input bytes', value: bytes.length }, { label: 'Digest bits', value: hex.length * 4 }] }
    },
  }
}

const bits = (id: string, label: string, options: number[], def: number): Field => ({
  kind: 'choice',
  id,
  label,
  default: String(def),
  choices: options.map((b) => ({ value: String(b), label: `${b} bits` })),
})

const salt = (n = 16) => crypto.getRandomValues(new Uint8Array(n))

const PASSWORD = { label: 'Password', sample: 'correct horse battery staple', rows: 2, hint: 'Hashing runs on this device. The password is not stored or sent.' }

async function timed<T>(f: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t = performance.now()
  const value = await f()
  return { value, ms: Math.round(performance.now() - t) }
}

const KEY_HINT = 'Keys are made with the WebCrypto API of your browser from its secure random source. They exist only in this tab until you copy or download them.'

function certRows(c: ReturnType<typeof parseCertificate>, sha1: string, sha256: string) {
  const days = Math.floor((c.notAfter.getTime() - Date.now()) / 86_400_000)
  return [
    { label: 'Subject', value: c.subject },
    { label: 'Issuer', value: c.issuer },
    { label: 'Valid from', value: c.notBefore.toISOString() },
    { label: 'Valid until', value: `${c.notAfter.toISOString()} (${days >= 0 ? `${days} days left` : `expired ${-days} days ago`})` },
    { label: 'Public key', value: `${c.key.algorithm}, ${c.key.size}` },
    { label: 'Signature algorithm', value: c.signature },
    { label: 'Serial number', value: c.serial },
    { label: 'Version', value: `v${c.version}` },
    ...c.extensions.map((e) => ({ label: `${e.name}${e.critical ? ' (critical)' : ''}`, value: e.value })),
    { label: 'SHA-256 fingerprint', value: sha256 },
    { label: 'SHA-1 fingerprint', value: sha1 },
  ]
}

export const SECURITY_SPECS: Specs = {
  /* ── message digests ── */
  'sha224-hash-generator': hashSpec('SHA-224 hash', async (d) => (await hashWasm()).sha224(d)),
  'sha384-hash-generator': hashSpec('SHA-384 hash', async (d) => (await hashWasm()).sha384(d)),
  'sha3-hash-generator': hashSpec('SHA-3 hash', async (d, v) => (await hashWasm()).sha3(d, Number(pick(v, 'bits', ['256', '224', '384', '512'] as const)) as 224 | 256 | 384 | 512), [bits('bits', 'Variant', [224, 256, 384, 512], 256)]),
  'keccak-256-hash-generator': hashSpec('Keccak hash', async (d, v) => (await hashWasm()).keccak(d, Number(pick(v, 'bits', ['256', '224', '384', '512'] as const)) as 224 | 256 | 384 | 512), [bits('bits', 'Variant', [224, 256, 384, 512], 256)]),
  'blake2-hash-generator': hashSpec(
    'BLAKE2 hash',
    async (d, v) => {
      const h = await hashWasm()
      const key = str(v, 'key') ? utf8Encode(str(v, 'key')) : undefined
      if (key && key.length > 64) throw new Error('The key can be at most 64 bytes.')
      const b = Number(str(v, 'bits'))
      return str(v, 'variant') === 's' ? h.blake2s(d, Math.min(256, b), key) : h.blake2b(d, b, key)
    },
    [
      {
        kind: 'choice',
        id: 'variant',
        label: 'Variant',
        default: 'b',
        choices: [
          { value: 'b', label: 'BLAKE2b' },
          { value: 's', label: 'BLAKE2s' },
        ],
      },
      bits('bits', 'Digest size', [128, 160, 256, 384, 512], 512),
      { kind: 'text', id: 'key', label: 'Key for keyed hashing (optional)', default: '', mono: true },
    ],
  ),
  'blake3-hash-generator': hashSpec('BLAKE3 hash', async (d, v) => (await hashWasm()).blake3(d, Number(str(v, 'bits'))), [bits('bits', 'Digest size', [128, 256, 512], 256)]),
  'ripemd160-hash-generator': hashSpec('RIPEMD-160 hash', async (d) => (await hashWasm()).ripemd160(d)),
  'xxhash-generator': hashSpec(
    'xxHash',
    async (d, v) => {
      const h = await hashWasm()
      const seed = num(v, 'seed') >>> 0
      const a = str(v, 'algo')
      return a === '32' ? h.xxhash32(d, seed) : a === '3' ? h.xxhash3(d, seed, 0) : a === '128' ? h.xxhash128(d, seed, 0) : h.xxhash64(d, seed, 0)
    },
    [
      {
        kind: 'choice',
        id: 'algo',
        label: 'Algorithm',
        default: '64',
        choices: [
          { value: '32', label: 'XXH32' },
          { value: '64', label: 'XXH64' },
          { value: '3', label: 'XXH3 64' },
          { value: '128', label: 'XXH3 128' },
        ],
      },
      { kind: 'number', id: 'seed', label: 'Seed', default: 0, min: 0, max: 4294967295 },
    ],
  ),
  'whirlpool-hash-generator': hashSpec('Whirlpool hash', async (d) => (await hashWasm()).whirlpool(d)),
  'ntlm-hash-generator': hashSpec('NTLM hash', async (d) => {
    // NTLM is MD4 of the password in UTF-16LE.
    const text = new TextDecoder().decode(d)
    const le = new Uint8Array(text.length * 2)
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      le[i * 2] = c & 255
      le[i * 2 + 1] = c >> 8
    }
    return (await hashWasm()).md4(le)
  }),

  /* ── password hashing ── */
  'bcrypt-generator': {
    input: PASSWORD,
    output: { label: 'Result', filename: 'bcrypt.txt', rows: 3 },
    action: 'Hash',
    fields: [
      { kind: 'number', id: 'cost', label: 'Cost (rounds = 2^cost)', default: 12, min: 4, max: 16, modes: ['hash'], hint: '10 to 12 is common. Each step doubles the time.' },
      { kind: 'text', id: 'hash', label: 'bcrypt hash to check', default: '', mono: true, modes: ['verify'], placeholder: '$2b$12$...' },
    ],
    modes: [
      {
        id: 'hash',
        label: 'Hash',
        outputLabel: 'bcrypt hash',
        run: async (input, v) => {
          const { bcrypt } = await hashWasm()
          if (utf8Encode(input).length > 72) throw new Error('bcrypt uses only the first 72 bytes of a password. Use a shorter password or Argon2.')
          const r = await timed(() => bcrypt({ password: input, salt: salt(), costFactor: num(v, 'cost'), outputType: 'encoded' }))
          return { text: r.value, stats: [{ label: 'Cost', value: num(v, 'cost') }, { label: 'Time on this device', value: `${r.ms} ms` }] }
        },
      },
      {
        id: 'verify',
        label: 'Check',
        action: 'Check',
        outputLabel: 'Result',
        run: async (input, v) => {
          const hash = str(v, 'hash').trim()
          if (!/^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) throw new Error('Paste a bcrypt hash such as $2b$12$ followed by 53 characters.')
          const { bcryptVerify } = await hashWasm()
          const ok = await bcryptVerify({ password: input, hash: hash.replace(/^\$2[xy]\$/, '$2b$') })
          return { verdict: { ok, title: ok ? 'The password matches the hash.' : 'The password does not match the hash.' }, text: ok ? 'match' : 'no match' }
        },
      },
    ],
  },
  'argon2-hash-generator': {
    input: PASSWORD,
    output: { label: 'Result', filename: 'argon2.txt', rows: 3 },
    action: 'Hash',
    fields: [
      {
        kind: 'choice',
        id: 'type',
        label: 'Type',
        default: 'id',
        modes: ['hash'],
        choices: [
          { value: 'id', label: 'Argon2id' },
          { value: 'i', label: 'Argon2i' },
          { value: 'd', label: 'Argon2d' },
        ],
      },
      { kind: 'number', id: 'memory', label: 'Memory (MiB)', default: 19, min: 1, max: 1024, modes: ['hash'] },
      { kind: 'number', id: 'iterations', label: 'Iterations', default: 2, min: 1, max: 50, modes: ['hash'] },
      { kind: 'number', id: 'parallelism', label: 'Parallelism', default: 1, min: 1, max: 16, modes: ['hash'] },
      { kind: 'number', id: 'length', label: 'Hash length (bytes)', default: 32, min: 4, max: 128, modes: ['hash'] },
      { kind: 'text', id: 'hash', label: 'Argon2 hash to check', default: '', mono: true, modes: ['verify'], placeholder: '$argon2id$v=19$m=19456,t=2,p=1$...' },
    ],
    modes: [
      {
        id: 'hash',
        label: 'Hash',
        outputLabel: 'Argon2 hash (PHC string)',
        run: async (input, v) => {
          const h = await hashWasm()
          const fn = { id: h.argon2id, i: h.argon2i, d: h.argon2d }[pick(v, 'type', ['id', 'i', 'd'] as const)]
          const r = await timed(() => fn({ password: input, salt: salt(), memorySize: num(v, 'memory') * 1024, iterations: num(v, 'iterations'), parallelism: num(v, 'parallelism'), hashLength: num(v, 'length'), outputType: 'encoded' }))
          return { text: r.value, stats: [{ label: 'Memory', value: `${num(v, 'memory')} MiB` }, { label: 'Time on this device', value: `${r.ms} ms` }] }
        },
      },
      {
        id: 'verify',
        label: 'Check',
        action: 'Check',
        outputLabel: 'Result',
        run: async (input, v) => {
          const hash = str(v, 'hash').trim()
          if (!/^\$argon2(id|i|d)\$/.test(hash)) throw new Error('Paste an Argon2 hash that starts with $argon2id$, $argon2i$ or $argon2d$.')
          const ok = await (await hashWasm()).argon2Verify({ password: input, hash })
          return { verdict: { ok, title: ok ? 'The password matches the hash.' : 'The password does not match the hash.' }, text: ok ? 'match' : 'no match' }
        },
      },
    ],
  },
  'scrypt-hash-generator': {
    input: PASSWORD,
    output: { label: 'scrypt key (hex)', filename: 'scrypt.txt', rows: 3 },
    action: 'Derive',
    fields: [
      { kind: 'number', id: 'n', label: 'Cost N (power of 2)', default: 16384, min: 2, max: 1048576 },
      { kind: 'number', id: 'r', label: 'Block size r', default: 8, min: 1, max: 64 },
      { kind: 'number', id: 'p', label: 'Parallelism p', default: 1, min: 1, max: 16 },
      { kind: 'number', id: 'length', label: 'Key length (bytes)', default: 32, min: 1, max: 128 },
      { kind: 'text', id: 'salt', label: 'Salt (hex, empty for random)', default: '', mono: true },
    ],
    run: async (input, v) => {
      const n = num(v, 'n')
      if ((n & (n - 1)) !== 0) throw new Error('N must be a power of 2, such as 16384.')
      const s = str(v, 'salt').trim() ? new Uint8Array((str(v, 'salt').replace(/\s/g, '').match(/../g) ?? []).map((h) => parseInt(h, 16))) : salt()
      const { scrypt } = await hashWasm()
      const r = await timed(() => scrypt({ password: input, salt: s, costFactor: n, blockSize: num(v, 'r'), parallelism: num(v, 'p'), hashLength: num(v, 'length'), outputType: 'hex' }))
      return { text: r.value, rows: [{ label: 'Salt (hex)', value: bytesToHex(s) }], stats: [{ label: 'Memory', value: `${Math.round((128 * n * num(v, 'r')) / 1048576)} MiB` }, { label: 'Time on this device', value: `${r.ms} ms` }] }
    },
  },
  'pbkdf2-generator': {
    input: PASSWORD,
    output: { label: 'Derived key (hex)', filename: 'pbkdf2.txt', rows: 3 },
    action: 'Derive',
    fields: [
      {
        kind: 'choice',
        id: 'hash',
        label: 'Hash',
        default: 'SHA-256',
        choices: [
          { value: 'SHA-1', label: 'SHA-1' },
          { value: 'SHA-256', label: 'SHA-256' },
          { value: 'SHA-384', label: 'SHA-384' },
          { value: 'SHA-512', label: 'SHA-512' },
        ],
      },
      { kind: 'number', id: 'iterations', label: 'Iterations', default: 600000, min: 1, max: 10000000 },
      { kind: 'number', id: 'length', label: 'Key length (bytes)', default: 32, min: 1, max: 256 },
      { kind: 'text', id: 'salt', label: 'Salt (text, empty for random)', default: '', mono: true },
    ],
    run: async (input, v) => {
      const hash = pick(v, 'hash', ['SHA-256', 'SHA-1', 'SHA-384', 'SHA-512'] as const)
      const s = str(v, 'salt') ? utf8Encode(str(v, 'salt')) : salt()
      const key = await crypto.subtle.importKey('raw', utf8Encode(input), 'PBKDF2', false, ['deriveBits'])
      const r = await timed(async () => new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash, salt: s, iterations: num(v, 'iterations') }, key, num(v, 'length') * 8)))
      return {
        text: bytesToHex(r.value),
        rows: [{ label: 'Base64', value: toBase64(r.value) }, { label: 'Salt (hex)', value: bytesToHex(s) }],
        stats: [{ label: 'Iterations', value: num(v, 'iterations') }, { label: 'Time on this device', value: `${r.ms} ms` }],
      }
    },
  },
  'htpasswd-generator': {
    output: { label: '.htpasswd line', filename: '.htpasswd', rows: 3 },
    action: 'Generate',
    fields: [
      { kind: 'text', id: 'user', label: 'User name', default: 'admin' },
      { kind: 'text', id: 'password', label: 'Password', default: '', placeholder: 'Type a password' },
      {
        kind: 'choice',
        id: 'algo',
        label: 'Hash',
        default: 'bcrypt',
        choices: [
          { value: 'bcrypt', label: 'bcrypt' },
          { value: 'sha', label: 'SHA-1 (old)' },
        ],
      },
    ],
    run: async (_i, v) => {
      const user = str(v, 'user').trim()
      const password = str(v, 'password')
      if (!user || user.includes(':')) throw new Error('Type a user name without a colon.')
      if (!password) return { note: 'Type a password, then press Generate.' }
      if (str(v, 'algo') === 'sha') {
        const d = new Uint8Array(await crypto.subtle.digest('SHA-1', utf8Encode(password)))
        return { text: `${user}:{SHA}${toBase64(d)}`, note: 'SHA-1 has no salt and is fast to crack. Use bcrypt unless an old server needs this.' }
      }
      const { bcrypt } = await hashWasm()
      const hash = await bcrypt({ password, salt: salt(), costFactor: 10, outputType: 'encoded' })
      return { text: `${user}:${hash.replace(/^\$2[ab]\$/, '$2y$')}` }
    },
  },
  'hash-identifier': {
    input: { label: 'Hash', sample: '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW\n5d41402abc4b2a76b9719d911017c592', mono: true, rows: 3, hint: 'One hash per line. Only the format is read; nothing is cracked.' },
    output: { label: 'Report', filename: 'hash-types.txt' },
    run: (input) => {
      const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      const all = lines.map((l) => ({ hash: l, types: identifyHash(l) }))
      return {
        table: { head: ['Hash', 'Possible type', 'Note'], rows: all.flatMap((a) => (a.types.length ? a.types.map((t, i) => [i === 0 ? (a.hash.length > 24 ? `${a.hash.slice(0, 22)}…` : a.hash) : '', t.name, t.note]) : [[a.hash.slice(0, 22), 'Unknown', `${a.hash.length} characters`]])) },
        text: all.map((a) => `${a.hash}\t${a.types.map((t) => t.name).join(' or ') || 'unknown'}`).join('\n'),
      }
    },
  },

  /* ── keys and certificates ── */
  'ssh-key-generator': {
    output: { label: 'Public key', filename: 'id_key.pub', rows: 3 },
    action: 'Generate',
    fields: [
      {
        kind: 'choice',
        id: 'type',
        label: 'Key type',
        default: 'ed25519',
        choices: [
          { value: 'ed25519', label: 'Ed25519' },
          { value: 'ecdsa', label: 'ECDSA P-256' },
          { value: 'rsa', label: 'RSA' },
        ],
      },
      { kind: 'choice', id: 'bits', label: 'RSA size', default: '3072', choices: ['2048', '3072', '4096'].map((b) => ({ value: b, label: `${b} bits` })) },
      { kind: 'text', id: 'comment', label: 'Comment', default: 'me@laptop', hint: 'Usually user@host. It is stored in the key files.' },
    ],
    run: async (_i, v) => {
      const type = pick<SshType>(v, 'type', ['ed25519', 'ecdsa', 'rsa'])
      const k = await generateSsh(type, Number(str(v, 'bits')), str(v, 'comment').trim())
      const base = type === 'rsa' ? 'id_rsa' : type === 'ecdsa' ? 'id_ecdsa' : 'id_ed25519'
      return {
        text: k.publicLine,
        rows: [{ label: 'Fingerprint', value: k.fingerprint }],
        blocks: [{ label: `Private key (${base}, unencrypted)`, text: k.privatePem, filename: base }],
        note: `${KEY_HINT} Save the private key with permissions 600, and add a passphrase with ssh-keygen -p -f ${base}.`,
      }
    },
  },
  'rsa-key-generator': {
    output: { label: 'Public key (PEM)', filename: 'public.pem', rows: 8 },
    action: 'Generate',
    fields: [
      { kind: 'choice', id: 'bits', label: 'Key size', default: '2048', choices: ['2048', '3072', '4096'].map((b) => ({ value: b, label: `${b} bits` })) },
      {
        kind: 'choice',
        id: 'format',
        label: 'Format',
        default: 'pkcs8',
        choices: [
          { value: 'pkcs8', label: 'PKCS #8 / SPKI' },
          { value: 'pkcs1', label: 'PKCS #1 (RSA ...)' },
        ],
      },
    ],
    run: async (_i, v) => {
      const r = await timed(() => generateRsaPem(Number(str(v, 'bits')), pick(v, 'format', ['pkcs8', 'pkcs1'] as const)))
      return {
        text: r.value.publicPem,
        blocks: [
          { label: 'Private key (PEM)', text: r.value.privatePem, filename: 'private.pem' },
          { label: 'Public key (JWK)', text: JSON.stringify(r.value.jwk, null, 2), filename: 'public.jwk.json' },
        ],
        stats: [{ label: 'Key size', value: `${str(v, 'bits')} bits` }, { label: 'Time on this device', value: `${r.ms} ms` }],
        note: KEY_HINT,
      }
    },
  },
  'ssh-key-fingerprint': {
    input: { label: 'SSH public keys, one per line', sample: SAMPLE_SSH_PUBLIC, mono: true, rows: 4, hint: 'Paste lines from a .pub file or authorized_keys. Never paste a private key.' },
    output: { label: 'Fingerprints', filename: 'fingerprints.txt' },
    run: async (input) => {
      if (/PRIVATE KEY/.test(input)) throw new Error('This is a private key. Paste only the public key, the line that starts with ssh-.')
      const lines = input.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
      const keys = await Promise.all(lines.map(async (l) => ({ ...parseSshPublic(l), sha: await sshFingerprint(parseSshPublic(l).blob) })))
      const k = keys[0]
      return {
        rows: k ? [{ label: 'SHA-256', value: k.sha }, { label: 'MD5 (legacy)', value: sshMd5(k.blob) }, { label: 'Type', value: k.type }, { label: 'Size', value: k.bits }, { label: 'Comment', value: k.comment }] : [],
        table: keys.length > 1 ? { head: ['Type', 'Fingerprint', 'Comment'], rows: keys.map((x) => [x.type, x.sha, x.comment]) } : undefined,
        text: keys.map((x) => `${x.sha} ${x.comment} (${x.type})`).join('\n'),
      }
    },
  },
  'x509-certificate-decoder': {
    input: { label: 'Certificate (PEM)', sample: SAMPLE_CERT, mono: true, rows: 10, hint: 'Paste one certificate or a whole chain. Base64 DER without the BEGIN line also works.' },
    output: { label: 'Decoded certificate', filename: 'certificate.txt' },
    run: async (input) => {
      const blocks = pemBlocks(input).filter((b) => b.label === 'CERTIFICATE' || b.label === 'TRUSTED CERTIFICATE' || b.label === '')
      if (blocks.length === 0) throw new Error('No certificate found. A PEM certificate starts with -----BEGIN CERTIFICATE-----.')
      const certs = blocks.map((b) => parseCertificate(b.der))
      const c = certs[0]
      const [sha1, sha256] = await Promise.all([fingerprint(c.der, 'SHA-1'), fingerprint(c.der, 'SHA-256')])
      const rows = certRows(c, sha1, sha256)
      const expired = c.notAfter.getTime() < Date.now()
      return {
        verdict: { ok: !expired && c.notBefore.getTime() <= Date.now(), title: expired ? 'This certificate has expired.' : c.notBefore.getTime() > Date.now() ? 'This certificate is not valid yet.' : 'This certificate is within its validity period.', detail: 'Dates only. Trust also depends on the chain and on revocation, which need a network check.' },
        rows,
        table: certs.length > 1 ? { head: ['#', 'Subject', 'Issuer', 'Expires'], rows: certs.map((x, i) => [i + 1, x.subject, x.issuer, x.notAfter.toISOString().slice(0, 10)]) } : undefined,
        text: rows.map((r) => `${r.label}: ${r.value}`).join('\n'),
      }
    },
  },
  'csr-decoder': {
    input: { label: 'Certificate signing request (PEM)', sample: SAMPLE_CSR, mono: true, rows: 10 },
    output: { label: 'Decoded request', filename: 'csr.txt' },
    run: async (input) => {
      const block = pemBlocks(input).find((b) => /REQUEST/.test(b.label) || b.label === '')
      if (!block) throw new Error('No CSR found. A CSR starts with -----BEGIN CERTIFICATE REQUEST-----.')
      const c = parseCsr(block.der)
      const ok = await verifyCsr(c)
      const rows = [
        { label: 'Subject', value: c.subject },
        { label: 'Public key', value: `${c.key.algorithm}, ${c.key.size}` },
        { label: 'Signature algorithm', value: c.signature },
        ...c.extensions.map((e) => ({ label: `${e.name}${e.critical ? ' (critical)' : ''}`, value: e.value })),
        ...c.attributes.map((a) => ({ label: 'Attribute', value: a })),
      ]
      return {
        verdict: ok === null ? { ok: true, title: 'Decoded. The signature algorithm cannot be checked in this browser.' } : { ok, title: ok ? 'The signature is valid: the request was made with this key.' : 'The signature does not match. The request was changed or is damaged.' },
        rows,
        text: rows.map((r) => `${r.label}: ${r.value}`).join('\n'),
      }
    },
  },
  'jwt-encoder': {
    input: { label: 'Payload (JSON)', sample: '{\n  "sub": "1234567890",\n  "name": "Ada Lovelace",\n  "admin": true,\n  "iat": 1762473600,\n  "exp": 1762477200\n}', mono: true, rows: 8 },
    output: { label: 'Signed JWT', filename: 'token.jwt', rows: 4 },
    action: 'Sign',
    fields: [
      {
        kind: 'choice',
        id: 'alg',
        label: 'Algorithm',
        default: 'HS256',
        choices: ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'PS256', 'ES256', 'ES384', 'EdDSA'].map((a) => ({ value: a, label: a })),
      },
      { kind: 'area', id: 'secret', label: 'Secret (HS) or private key in PEM (RS, PS, ES, EdDSA)', default: 'your-256-bit-secret', mono: true, rows: 3 },
      { kind: 'text', id: 'kid', label: 'Key ID (kid, optional)', default: '', mono: true },
    ],
    run: async (input, v) => {
      let payload: unknown
      try {
        payload = JSON.parse(input)
      } catch {
        throw new Error('The payload must be valid JSON, such as {"sub": "123"}.')
      }
      const alg = pick<JwtAlg>(v, 'alg', ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'PS256', 'ES256', 'ES384', 'EdDSA'])
      const kid = str(v, 'kid').trim()
      const { token, header } = await signJwt(payload, alg, str(v, 'secret'), kid ? { kid } : {})
      const [h, p, s] = token.split('.')
      const exp = typeof payload === 'object' && payload !== null && 'exp' in payload ? Number((payload as { exp: unknown }).exp) : NaN
      return {
        text: token,
        rows: [
          { label: 'Header', value: JSON.stringify(header) },
          { label: 'Header (Base64url)', value: h },
          { label: 'Payload (Base64url)', value: p },
          { label: 'Signature (Base64url)', value: s },
          ...(Number.isFinite(exp) ? [{ label: 'Expires (exp)', value: new Date(exp * 1000).toISOString() }] : []),
        ],
        note: alg.startsWith('HS') && utf8Encode(str(v, 'secret')).length < 32 ? `${alg} needs a secret of at least ${Number(alg.slice(2)) / 8} bytes to be safe.` : undefined,
      }
    },
  },
  'jwk-to-pem': {
    input: { label: 'Key', sample: '{\n  "kty": "EC",\n  "crv": "P-256",\n  "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",\n  "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"\n}', mono: true, rows: 8 },
    output: { label: 'Result', filename: 'key.txt', rows: 8 },
    swap: true,
    modes: [
      {
        id: 'topem',
        label: 'JWK to PEM',
        outputLabel: 'PEM',
        filename: 'key.pem',
        run: async (input) => {
          const r = await jwkToPem(input)
          return { text: r.pem, rows: [{ label: 'Key', value: r.kind }] }
        },
      },
      {
        id: 'tojwk',
        label: 'PEM to JWK',
        outputLabel: 'JWK',
        filename: 'key.jwk.json',
        sample: '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEf83OJ3D2xF1Bg8vub9tLe1gHMzV7\n6e8Tus9uPHvRVEXH8UTNG72bfocs3+257rn0s2ldbqkLJK2KRiMohYjlrQ==\n-----END PUBLIC KEY-----',
        run: async (input) => {
          const r = await pemToJwk(input)
          return { text: JSON.stringify(r.jwk, null, 2), rows: [{ label: 'Key', value: r.kind }, { label: 'Thumbprint (RFC 7638)', value: await jwkThumbprint(r.jwk) }] }
        },
      },
    ],
  },

  /* ── check digits ── */
  'luhn-checker': {
    input: { label: 'Numbers, one per line', sample: '79927398713\n4539 1488 0343 6467\n7992739871', mono: true, rows: 4 },
    output: { label: 'Results', filename: 'luhn.txt' },
    run: (input) => {
      const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      const rows = lines.map((l) => {
        const d = l.replace(/[\s-]/g, '')
        if (!/^\d+$/.test(d)) return [l, 'Not a number', '']
        return [l, luhnValid(d) ? 'Valid' : 'Invalid', String(luhnCheckDigit(d))]
      })
      const first = lines[0]?.replace(/[\s-]/g, '') ?? ''
      const valid = /^\d+$/.test(first) && luhnValid(first)
      return {
        verdict: lines.length === 1 ? { ok: valid, title: valid ? 'Passes the Luhn check.' : 'Fails the Luhn check.', detail: `To make ${first} valid as the start of a number, append ${luhnCheckDigit(first)}.` } : undefined,
        table: { head: ['Number', 'Luhn', 'Check digit to append'], rows },
        text: rows.map((r) => r.join('\t')).join('\n'),
      }
    },
  },
  'credit-card-validator': {
    input: { label: 'Card numbers, one per line', sample: '4111 1111 1111 1111\n5555 5555 5555 4444\n3782 822463 10005\n4111 1111 1111 1112', mono: true, rows: 4, hint: 'Checked on this device and never sent. Use test numbers when you can.' },
    output: { label: 'Results', filename: 'cards.txt' },
    run: (input) => {
      const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      const results = lines.map(validateCard)
      const r = results[0]
      return {
        verdict: results.length === 1 ? { ok: r.valid, title: r.valid ? `Valid ${r.network} number.` : 'Not a valid card number.', detail: r.problems.join(' ') || 'The format and check digit are correct. Only the issuer can say whether the card exists.' } : undefined,
        table: { head: ['Number', 'Network', 'Length', 'Luhn', 'Result'], rows: results.map((x) => [x.masked, x.network, x.length, x.luhn ? 'Pass' : 'Fail', x.valid ? 'Valid' : 'Invalid']) },
        text: results.map((x) => `${x.masked}\t${x.network}\t${x.valid ? 'valid' : 'invalid'}`).join('\n'),
      }
    },
  },
  'iban-validator': {
    input: { label: 'IBANs, one per line', sample: 'GB82 WEST 1234 5698 7654 32\nDE89370400440532013000\nFR14 2004 1010 0505 0001 3M02 606', mono: true, rows: 4 },
    output: { label: 'Results', filename: 'ibans.txt' },
    run: (input) => {
      const results = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map(checkIban)
      const r = results[0]
      const rows: Result['rows'] = r
        ? [
            { label: 'IBAN', value: formatIban(r.iban) },
            { label: 'Country', value: r.country },
            { label: 'Check digits', value: r.valid ? r.checkDigits : `${r.checkDigits} (expected ${ibanCheckDigits(r.iban)})` },
            { label: 'Bank and account part (BBAN)', value: r.bban },
          ]
        : []
      return {
        verdict: results.length === 1 ? { ok: r.valid, title: r.valid ? 'Valid IBAN.' : 'Not a valid IBAN.', detail: r.problems.join(' ') || 'The length and check digits are correct. Only the bank can say whether the account exists.' } : undefined,
        rows: results.length === 1 ? rows : undefined,
        table: results.length > 1 ? { head: ['IBAN', 'Country', 'Result'], rows: results.map((x) => [formatIban(x.iban), x.country, x.valid ? 'Valid' : x.problems[0] ?? 'Invalid']) } : undefined,
        text: results.map((x) => `${formatIban(x.iban)}\t${x.valid ? 'valid' : 'invalid'}`).join('\n'),
      }
    },
  },
}

