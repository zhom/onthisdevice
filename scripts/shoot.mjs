#!/usr/bin/env node
/**
 * Screenshots for review (never shipped).
 *
 *   node scripts/shoot.mjs <url> <out.png> [--w 1440] [--h 900] [--dpr 1] [--dark]
 *        [--reduced] [--nojs] [--full] [--wait 1200] [--clip x,y,w,h] [--sel css]
 *        [--hover css] [--mouse x,y] [--eval "js"]
 *
 * Prints console errors and page errors it saw.
 */
import { chromium } from 'playwright'

const [url, out, ...rest] = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = rest.indexOf(`--${name}`)
  if (i < 0) return fallback
  const v = rest[i + 1]
  return v === undefined || v.startsWith('--') ? true : v
}
const w = Number(flag('w', 1440))
const h = Number(flag('h', 900))
const dpr = Number(flag('dpr', 1))
const dark = Boolean(flag('dark', false))
const reduced = Boolean(flag('reduced', false))
const nojs = Boolean(flag('nojs', false))
const full = Boolean(flag('full', false))
const wait = Number(flag('wait', 1200))
const clip = flag('clip', null)
const sel = flag('sel', null)
const hover = flag('hover', null)
const mouse = flag('mouse', null)
const evalJs = flag('eval', null)

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: dpr,
  colorScheme: dark ? 'dark' : 'light',
  reducedMotion: reduced ? 'reduce' : 'no-preference',
  javaScriptEnabled: !nojs,
})
if (dark) await context.addInitScript(() => localStorage.setItem('theme', 'dark'))
else await context.addInitScript(() => localStorage.setItem('theme', 'light'))
const page = await context.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(url, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts?.ready)
if (hover) await page.hover(hover)
if (mouse) {
  const [mx, my] = String(mouse).split(',').map(Number)
  await page.mouse.move(mx, my)
}
if (evalJs) await page.evaluate(String(evalJs))
await page.waitForTimeout(wait)
const opts = { path: out, fullPage: full }
if (clip) {
  const [x, y, cw, ch] = String(clip).split(',').map(Number)
  opts.clip = { x, y, width: cw, height: ch }
}
if (sel) await page.locator(String(sel)).first().screenshot({ path: out })
else await page.screenshot(opts)
if (errors.length) console.log('errors:', errors.slice(0, 8).join('\n'))
console.log('saved', out)
await browser.close()
