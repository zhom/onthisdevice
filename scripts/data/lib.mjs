/**
 * Shared helpers for the data fetchers in scripts/data/.
 *
 * Each fetcher downloads one public source, validates it, and writes:
 *   src/data/<name>.json            meta + small payload, imported at build time
 *   public/data/<name>/<hash>/...   bigger files the page fetches from its own origin
 * The hash folder makes every lazy file immutable: a page always asks for the files of the
 * version it was built with, so the service worker can never mix two versions.
 *
 * A fetcher writes nothing when a check fails (it throws before `commit`), and writes nothing
 * when the data is the same as on disk (only `fetchedAt` would change).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, inflateRawSync } from 'node:zlib'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Bot UA for sources that ask scripts to identify themselves; browser UA for sources that block bots by name. */
export const UA = {
  bot: 'onthisdevice-data/1.0 (+https://onthisdevice.com)',
  browser:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
}

export class CheckError extends Error {}

/** Throws a CheckError (validation failed) when `cond` is false. */
export function check(cond, message) {
  if (!cond) throw new CheckError(message)
}

export function checkRange(value, min, max, label) {
  check(typeof value === 'number' && Number.isFinite(value), `${label}: not a number (${value})`)
  check(value >= min && value <= max, `${label}: ${value} is outside ${min}..${max}`)
}

/** Fails when `next` moved more than `maxRatio` (0.25 = 25 %) away from `prev`. */
export function checkJump(prev, next, maxRatio, label) {
  if (prev === undefined || prev === null || !Number.isFinite(prev) || prev === 0) return
  const ratio = Math.abs(next - prev) / Math.abs(prev)
  check(ratio <= maxRatio, `${label}: moved ${(ratio * 100).toFixed(1)}% (${prev} -> ${next}), limit ${maxRatio * 100}%`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * GET with retries. `as`: 'text' | 'json' | 'buffer'. `ua`: 'bot' | 'browser'.
 * Returns null for 404 when `allow404` is set.
 */
export async function get(url, { as = 'text', ua = 'bot', retries = 3, timeoutMs = 90_000, headers = {}, allow404 = false } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await sleep(1500 * 2 ** (attempt - 1))
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA[ua], accept: '*/*', 'accept-language': 'en-US,en;q=0.9', ...headers },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      })
      if (res.status === 404 && allow404) return null
      if (!res.ok) {
        lastError = new Error(`${url}: HTTP ${res.status}`)
        if (res.status < 500 && res.status !== 429) break
        continue
      }
      if (as === 'json') return await res.json()
      if (as === 'buffer') return Buffer.from(await res.arrayBuffer())
      return await res.text()
    } catch (e) {
      lastError = e
    }
  }
  throw lastError ?? new Error(`${url}: failed`)
}

export function gunzip(buf) {
  return gunzipSync(buf)
}

/** Minimal zip reader (stored and deflated entries). Returns name -> Buffer. */
export function unzip(buf) {
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  check(eocd >= 0, 'zip: no end of central directory')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const out = new Map()
  for (let n = 0; n < count; n++) {
    check(buf.readUInt32LE(p) === 0x02014b50, 'zip: bad central directory entry')
    const method = buf.readUInt16LE(p + 10)
    const csize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const lNameLen = buf.readUInt16LE(local + 26)
    const lExtraLen = buf.readUInt16LE(local + 28)
    const start = local + 30 + lNameLen + lExtraLen
    const data = buf.subarray(start, start + csize)
    if (!name.endsWith('/')) out.set(name, method === 0 ? Buffer.from(data) : inflateRawSync(data))
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

/** RFC 4180 CSV parser (quoted fields, doubled quotes, CRLF). Returns rows of strings. */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.length > 1 || r[0] !== '')
}

/** CSV rows to objects keyed by the header row. */
export function csvObjects(text) {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ''))
  const keys = header.map((h) => h.trim())
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

export function readJson(rel) {
  const file = path.join(ROOT, rel)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

export function hashOf(strings) {
  const h = createHash('sha256')
  for (const s of strings) h.update(s)
  return h.digest('hex').slice(0, 10)
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Metadata block every data file carries.
 * source/licence: { name, url }. validFor: the date (or period) the data describes.
 */
export function meta({ source, licence, validFor, sources }) {
  return { source, ...(sources ? { sources } : {}), licence, fetchedAt: new Date().toISOString(), validFor }
}

const stripFetched = (s) => s.replace(/"fetchedAt":"[^"]*"/, '"fetchedAt":""')

/**
 * Writes one dataset: the manifest `src/data/<name>.json` and, optionally, lazy files under
 * `public/data/<name>/<hash>/`. The manifest gets `files` (URL of the hash folder) when files
 * are given. Nothing is written when the content is unchanged. Old hash folders are removed.
 *
 * manifest: object with a `meta` field. files: Map(relative path -> string).
 * Returns 'unchanged' | 'written'.
 */
export function commit(name, manifest, files = null, { srcName = name } = {}) {
  const manifestRel = `src/data/${srcName}.json`
  const publicDir = path.join(ROOT, 'public/data', name)
  let body = manifest
  if (files && files.size) {
    const keys = [...files.keys()].sort()
    const hash = hashOf(keys.flatMap((k) => [k, '\0', files.get(k), '\0']))
    body = { ...manifest, files: `/data/${name}/${hash}` }
    const target = path.join(publicDir, hash)
    if (!existsSync(target)) {
      const tmp = path.join(publicDir, `.tmp-${process.pid}`)
      rmSync(tmp, { recursive: true, force: true })
      for (const k of keys) {
        const file = path.join(tmp, k)
        mkdirSync(path.dirname(file), { recursive: true })
        writeFileSync(file, files.get(k))
      }
      renameSync(tmp, target)
    }
    for (const entry of existsSync(publicDir) ? readdirSync(publicDir) : []) {
      if (entry !== hash) rmSync(path.join(publicDir, entry), { recursive: true, force: true })
    }
  }
  const text = `${JSON.stringify(body)}\n`
  const file = path.join(ROOT, manifestRel)
  const prev = existsSync(file) ? readFileSync(file, 'utf8') : null
  if (prev !== null && stripFetched(prev) === stripFetched(text)) {
    console.log(`${name}: unchanged`)
    return 'unchanged'
  }
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, text)
  renameSync(`${file}.tmp`, file)
  const size = Buffer.byteLength(text) + (files ? [...files.values()].reduce((a, s) => a + Buffer.byteLength(s), 0) : 0)
  console.log(`${name}: written (${(size / 1024).toFixed(0)} KB${files ? `, ${files.size} lazy files` : ''})`)
  return 'written'
}

/** Command-line flags: --key value or --flag. */
export function flags() {
  const out = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key] = true
    else {
      out[key] = next
      i++
    }
  }
  return out
}

/** Runs a fetcher's main(); a failed check or download exits 1 with the reason. */
export function run(name, main) {
  main().then(
    () => {},
    (e) => {
      const kind = e instanceof CheckError ? 'check failed' : 'error'
      console.error(`${name}: ${kind}: ${e?.message ?? e}`)
      process.exit(1)
    },
  )
}

/** JSON array with a line break every `per` items, so a git diff touches only the last line. */
export function chunkedArray(values, per = 64) {
  const lines = []
  for (let i = 0; i < values.length; i += per) lines.push(values.slice(i, i + per).map((v) => JSON.stringify(v)).join(','))
  return `[\n${lines.join(',\n')}\n]`
}

/** Rounds to `sig` significant digits (keeps exchange rates and prices compact). */
export function sig(value, digits = 6) {
  if (value === 0 || !Number.isFinite(value)) return value
  return Number(value.toPrecision(digits))
}
