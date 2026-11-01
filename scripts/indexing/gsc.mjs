#!/usr/bin/env node
/**
 * Google Search Console setup for onthisdevice.com with a service account. Never shipped.
 * Needs GOOGLE_SERVICE_ACCOUNT_JSON (the key file's JSON). The Google Cloud project must have the
 * "Google Search Console API" and the "Google Site Verification API" enabled.
 *
 *   acct google node scripts/indexing/gsc.mjs token            # DNS TXT value to add on the zone
 *   acct google node scripts/indexing/gsc.mjs verify OWNER...  # verify the domain, add OWNER emails as owners
 *   acct google node scripts/indexing/gsc.mjs add              # add sc-domain property, submit the sitemap
 *   acct google node scripts/indexing/gsc.mjs status           # property, sitemap state
 */
import crypto from 'node:crypto'

const DOMAIN = 'onthisdevice.com'
const PROPERTY = `sc-domain:${DOMAIN}`
const SITEMAP = `https://${DOMAIN}/sitemap-index.xml`
const SCOPES = ['https://www.googleapis.com/auth/siteverification', 'https://www.googleapis.com/auth/webmasters']

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
if (!raw) {
  console.error('GOOGLE_SERVICE_ACCOUNT_JSON is not set. Run with: acct google node scripts/indexing/gsc.mjs ...')
  process.exit(2)
}
const sa = JSON.parse(raw)

const b64url = (data) => Buffer.from(data).toString('base64url')

async function accessToken() {
  const now = Math.floor(Date.now() / 1000)
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPES.join(' '), aud: sa.token_uri, iat: now, exp: now + 3600 }),
  )
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${claim}`), sa.private_key).toString('base64url')
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`token: HTTP ${res.status} ${json.error_description ?? json.error ?? ''}`)
  return json.access_token
}

async function call(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(`${method} ${url}: HTTP ${res.status} ${json.error?.message ?? text}`)
  return json
}

const site = { type: 'INET_DOMAIN', identifier: DOMAIN }
const enc = encodeURIComponent

const [cmd, ...rest] = process.argv.slice(2)
const token = await accessToken()

if (cmd === 'token') {
  const res = await call(token, 'POST', 'https://www.googleapis.com/siteVerification/v1/token', {
    site,
    verificationMethod: 'DNS_TXT',
  })
  console.log(res.token)
} else if (cmd === 'verify') {
  const res = await call(
    token,
    'POST',
    'https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=DNS_TXT',
    { site, owners: [sa.client_email, ...rest] },
  )
  console.log(`verified ${res.site.identifier}; owners: ${res.owners.join(', ')}`)
} else if (cmd === 'add') {
  await call(token, 'PUT', `https://www.googleapis.com/webmasters/v3/sites/${enc(PROPERTY)}`)
  await call(token, 'PUT', `https://www.googleapis.com/webmasters/v3/sites/${enc(PROPERTY)}/sitemaps/${enc(SITEMAP)}`)
  console.log(`added ${PROPERTY}; submitted ${SITEMAP}`)
} else if (cmd === 'status') {
  const sites = await call(token, 'GET', 'https://www.googleapis.com/webmasters/v3/sites')
  for (const s of sites.siteEntry ?? []) console.log(`${s.siteUrl}  ${s.permissionLevel}`)
  const maps = await call(token, 'GET', `https://www.googleapis.com/webmasters/v3/sites/${enc(PROPERTY)}/sitemaps`).catch((e) => ({ error: e.message }))
  for (const m of maps.sitemap ?? []) console.log(`${m.path}  submitted ${m.lastSubmitted}  downloaded ${m.lastDownloaded ?? '-'}  errors ${m.errors}  warnings ${m.warnings}`)
  if (maps.error) console.log(maps.error)
} else {
  console.error('usage: gsc.mjs token | verify OWNER... | add | status')
  process.exit(2)
}
