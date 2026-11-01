#!/usr/bin/env node
/**
 * Local stand-in for the production host: serves dist/ the way Cloudflare
 * Workers static assets will (html_handling "drop-trailing-slash",
 * not_found_handling "404-page", dist/_headers applied to every response,
 * simple dist/_redirects rules).
 *
 *   node scripts/serve.mjs [--port 46210] [--dir dist]
 *
 * Used by the smoke harness and for screenshots; never shipped.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const PORT = Number(flag('port', process.env.PORT ?? 46210))
const ROOT = path.resolve(flag('dir', 'dist'))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.gz': 'application/gzip',
  '.br': 'application/octet-stream',
  '.bin': 'application/octet-stream',
}

/* ── _headers ─────────────────────────────────────────────────────────── */
function parseHeaders(file) {
  if (!fs.existsSync(file)) return []
  const rules = []
  let current = null
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue
    if (!/^\s/.test(raw)) {
      current = { pattern: raw.trim(), set: [], detach: [] }
      rules.push(current)
      continue
    }
    if (!current) continue
    const line = raw.trim()
    if (line.startsWith('!')) current.detach.push(line.slice(1).trim().toLowerCase())
    else {
      const i = line.indexOf(':')
      current.set.push([line.slice(0, i).trim(), line.slice(i + 1).trim()])
    }
  }
  return rules.map((r) => ({
    ...r,
    re: new RegExp(`^${r.pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/:[a-z]+/g, '[^/]+')}$`),
  }))
}

/* ── _redirects (path rules only; host rules are the edge's job) ──────── */
function parseRedirects(file) {
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.startsWith('/'))
    .map((l) => {
      const [from, to, status = '302'] = l.split(/\s+/)
      const re = new RegExp(`^${from.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '(.*)')}$`)
      return { re, to, status: Number(status.replace('!', '')) }
    })
}

const HEADERS = parseHeaders(path.join(ROOT, '_headers'))
const REDIRECTS = parseRedirects(path.join(ROOT, '_redirects'))

function headersFor(urlPath) {
  const out = new Map()
  for (const rule of HEADERS) {
    if (!rule.re.test(urlPath)) continue
    for (const name of rule.detach) out.delete(name)
    for (const [k, v] of rule.set) {
      const key = k.toLowerCase()
      out.set(key, out.has(key) ? `${out.get(key)}, ${v}` : v)
    }
  }
  return out
}

function fileFor(urlPath) {
  const safe = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '')
  const abs = path.join(ROOT, safe)
  if (!abs.startsWith(ROOT)) return null
  return abs
}

function exists(p) {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function send(res, status, file, urlPath) {
  const headers = headersFor(urlPath)
  const type = TYPES[path.extname(file)] ?? 'application/octet-stream'
  res.statusCode = status
  res.setHeader('content-type', type)
  for (const [k, v] of headers) res.setHeader(k, v)
  fs.createReadStream(file).pipe(res)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  let p = url.pathname

  for (const r of REDIRECTS) {
    const m = p.match(r.re)
    if (m && r.status >= 300 && r.status < 400) {
      res.statusCode = r.status
      res.setHeader('location', r.to.replace(':splat', m[1] ?? ''))
      return res.end()
    }
  }

  // drop-trailing-slash: /foo/ -> /foo when /foo/index.html exists.
  if (p.length > 1 && p.endsWith('/')) {
    const f = fileFor(path.join(p, 'index.html'))
    if (f && exists(f)) {
      res.statusCode = 307
      res.setHeader('location', p.slice(0, -1) + url.search)
      return res.end()
    }
  }

  const direct = fileFor(p)
  if (direct && exists(direct)) {
    if (direct.endsWith('/index.html') || path.basename(direct) === 'index.html') {
      // /foo/index.html is served at /foo
      const clean = p.replace(/\/index\.html$/, '') || '/'
      if (clean !== p) {
        res.statusCode = 307
        res.setHeader('location', clean)
        return res.end()
      }
    }
    return send(res, 200, direct, p)
  }
  for (const candidate of [path.join(p, 'index.html'), `${p}.html`]) {
    const f = fileFor(candidate)
    if (f && exists(f)) return send(res, 200, f, p)
  }
  const notFound = path.join(ROOT, '404.html')
  if (exists(notFound)) return send(res, 404, notFound, p)
  res.statusCode = 404
  res.end('Not found')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serving ${path.relative(process.cwd(), ROOT) || '.'} at http://127.0.0.1:${PORT}`)
})
