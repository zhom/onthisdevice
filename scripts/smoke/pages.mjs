#!/usr/bin/env node
/**
 * Opens every page of the built site (dist/sitemap-0.xml) in Chromium and fails on a page
 * error, a console error (hydration and CSP errors included), a failed request to this site
 * or a response of 400 or more. It presses nothing and needs no fixtures or models, so CI
 * runs it on each push; scripts/smoke/run.mjs is the deep check that uses every tool.
 *
 *   npm run build && node scripts/smoke/pages.mjs [--concurrency 8] [--only /a,/b]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const CONCURRENCY = Number(flag('concurrency', 8))
const PORT = Number(flag('port', 46290))
const BASE = `http://127.0.0.1:${PORT}`
const ONLY = flag('only', '').split(',').filter(Boolean)

const sitemap = fs.readFileSync(path.join(ROOT, 'dist/sitemap-0.xml'), 'utf8')
let pages = [...sitemap.matchAll(/<loc>https?:\/\/[^/<]+(\/[^<]*)<\/loc>/g)].map((m) => m[1] || '/')
if (ONLY.length) pages = ONLY

const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore' })
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${BASE}/robots.txt`)).ok) break
  } catch {}
  if (i > 100) throw new Error('scripts/serve.mjs did not start')
  await new Promise((r) => setTimeout(r, 100))
}

const browser = await chromium.launch()
const failures = []
let done = 0
const started = Date.now()

async function check(context, pathname) {
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`page error: ${e.message.split('\n')[0]}`))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text().split('\n')[0].slice(0, 200)}`)
  })
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText ?? ''
    // A request that the page itself cancels (navigation, media range) is not a failure.
    if (r.url().startsWith(BASE) && !why.includes('ERR_ABORTED')) problems.push(`request failed: ${new URL(r.url()).pathname} ${why}`)
  })
  page.on('response', (r) => {
    if (r.url().startsWith(BASE) && r.status() >= 400 && new URL(r.url()).pathname !== pathname) {
      problems.push(`HTTP ${r.status()}: ${new URL(r.url()).pathname}`)
    }
  })
  try {
    const res = await page.goto(BASE + pathname, { waitUntil: 'load', timeout: 30_000 })
    if (!res || res.status() >= 400) problems.push(`HTTP ${res?.status()} for the page`)
    // Islands hydrate after load; give them a moment to throw.
    await page.waitForTimeout(700)
  } catch (e) {
    problems.push(`load: ${e.message.split('\n')[0]}`)
  }
  await page.close()
  done++
  if (problems.length) failures.push({ pathname, problems })
  if (done % 100 === 0) console.log(`${done}/${pages.length}`)
}

const queue = [...pages]
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    const context = await browser.newContext({ serviceWorkers: 'block' })
    while (queue.length) await check(context, queue.shift())
    await context.close()
  }),
)
await browser.close()
server.kill()

for (const f of failures) console.log(`FAIL ${f.pathname}\n  ${[...new Set(f.problems)].slice(0, 5).join('\n  ')}`)
console.log(`pages: ${pages.length} opened in ${((Date.now() - started) / 1000).toFixed(0)} s, ${failures.length} failed`)
process.exit(failures.length ? 1 : 0)
