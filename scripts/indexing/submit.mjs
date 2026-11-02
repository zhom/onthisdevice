#!/usr/bin/env node
/**
 * Asks Google and Brave to crawl every page in the live sitemap (Rapid Indexer).
 * Never shipped. Needs RAPID_INDEXER_API_KEY:
 *
 *   acct rapid-indexer node scripts/indexing/submit.mjs [--dry-run] [--limit N] [--only FILE]
 *   acct rapid-indexer node scripts/indexing/submit.mjs --status
 *
 * --only FILE sends just the sitemap URLs whose path is listed in FILE (one path or slug per line).
 * Only pages that answer 200 without noindex are sent. Each URL gets up to 5
 * Brave keywords from its <h1> and <title>. Cost: 1 credit per URL (Brave is
 * free with Google). Task ids go to scripts/.tmp/indexing-log.jsonl.
 */
import fs from 'node:fs'
import path from 'node:path'

const SITE = 'https://onthisdevice.com'
const API = 'https://rapid-indexer.com/api/v1/index.php'
const UA = 'onthisdevice-indexing/1 (+https://onthisdevice.com)'
const BATCH = 250
const LOG = path.resolve('scripts/.tmp/indexing-log.jsonl')

const args = process.argv.slice(2)
const has = (f) => args.includes(`--${f}`)
const val = (f) => {
  const i = args.indexOf(`--${f}`)
  return i >= 0 ? args[i + 1] : undefined
}

const key = process.env.RAPID_INDEXER_API_KEY
if (!key && !has('dry-run')) {
  console.error('RAPID_INDEXER_API_KEY is not set. Run with: acct rapid-indexer node scripts/indexing/submit.mjs')
  process.exit(2)
}

async function api(action, { query = '', body } = {}) {
  const res = await fetch(`${API}?action=${action}${query}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-API-Key': key, 'User-Agent': UA, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) throw new Error(`${action}: HTTP ${res.status} ${json.error ?? json.message ?? ''}`)
  return json
}

async function text(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'manual' })
  return { status: res.status, body: res.status === 200 ? await res.text() : '' }
}

const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1])
const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

async function sitemapUrls() {
  const index = await text(`${SITE}/sitemap-index.xml`)
  if (index.status !== 200) throw new Error(`sitemap-index.xml: HTTP ${index.status}`)
  const urls = []
  for (const child of locs(index.body)) {
    const map = await text(child)
    if (map.status !== 200) throw new Error(`${child}: HTTP ${map.status}`)
    urls.push(...locs(map.body))
  }
  return [...new Set(urls)]
}

/** Fetches each page; keeps indexable 200s and derives Brave keywords. */
async function inspect(urls) {
  const out = []
  const skipped = []
  let next = 0
  async function worker() {
    while (next < urls.length) {
      const url = urls[next++]
      const page = await text(url).catch(() => ({ status: 0, body: '' }))
      if (page.status !== 200) {
        skipped.push(`${page.status} ${url}`)
        continue
      }
      if (/<meta[^>]+name="robots"[^>]+noindex/i.test(page.body)) {
        skipped.push(`noindex ${url}`)
        continue
      }
      const h1 = decode(page.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
      const title = decode(page.body.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').split(/\s[|:]\s|:\s/)[0]
      const keywords = [...new Set([h1, title].map((k) => k.toLowerCase().replace(/[.!?]$/, '')).filter((k) => k && k.length <= 80))].slice(0, 5)
      out.push(keywords.length ? { url, keywords } : { url })
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return { pages: out.sort((a, b) => a.url.localeCompare(b.url)), skipped }
}

async function status() {
  const { tasks } = await api('list_tasks', { query: '&page=1&per_page=20&type=indexer' })
  const ours = tasks.filter((t) => String(t.title ?? '').startsWith('onthisdevice'))
  for (const t of ours) {
    const l = t.links ?? {}
    console.log(`${t.id}  ${t.status.padEnd(10)} ${t.title}  total ${l.total ?? '?'}  crawled ${l.crawled ?? l.indexed ?? 0}  pending ${l.pending ?? 0}  error ${l.error ?? 0}`)
  }
  if (!ours.length) console.log('No onthisdevice tasks in the last 20.')
}

async function submit() {
  let all = await sitemapUrls()
  const onlyFile = val('only')
  if (onlyFile) {
    const wanted = new Set(
      fs
        .readFileSync(onlyFile, 'utf8')
        .split('\n')
        .map((l) => l.trim().replace(/^\/?/, '/'))
        .filter((l) => l !== '/'),
    )
    all = all.filter((u) => wanted.has(new URL(u).pathname))
  }
  const limit = Number(val('limit') ?? all.length)
  const { pages, skipped } = await inspect(all.slice(0, limit))
  console.log(`sitemap ${all.length} URLs, sending ${pages.length}, skipped ${skipped.length}`)
  for (const s of skipped.slice(0, 20)) console.log(`  skipped ${s}`)
  if (!pages.length) return
  if (has('dry-run')) {
    console.log(`dry run: would create ${Math.ceil(pages.length / BATCH)} task(s), about ${pages.length} credits`)
    console.log(JSON.stringify(pages.slice(0, 3), null, 2))
    return
  }
  const { user } = await api('me')
  if (user.credits_balance < pages.length) throw new Error(`Not enough credits: ${user.credits_balance} for ${pages.length} URLs`)
  const date = new Date().toISOString().slice(0, 10)
  const batches = Math.ceil(pages.length / BATCH)
  fs.mkdirSync(path.dirname(LOG), { recursive: true })
  for (let b = 0; b < batches; b++) {
    const slice = pages.slice(b * BATCH, (b + 1) * BATCH)
    const title = `onthisdevice ${date} (${b + 1}/${batches})`
    const res = await api('create_task', {
      body: { urls: slice, type: 'indexer', title, enable_google_indexing: true, enable_brave_indexing: true },
    })
    console.log(`task ${res.task_id}: ${slice.length} URLs, targets ${JSON.stringify(res.targets ?? {})}`)
    fs.appendFileSync(LOG, JSON.stringify({ date, task: res.task_id, urls: slice.length, title }) + '\n')
  }
  const after = await api('me')
  console.log(`credits left: ${after.user.credits_balance}`)
}

await (has('status') ? status() : submit()).catch((err) => {
  console.error(err.message)
  process.exit(1)
})
