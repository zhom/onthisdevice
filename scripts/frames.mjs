#!/usr/bin/env node
/**
 * Contact sheet of a figure in motion: screenshots of one element at fixed
 * times after load (never shipped).
 *   node scripts/frames.mjs <url> <out-prefix> [--sel .fig] [--times 1,2,3] [--w 960] [--dpr 1] [--dark]
 */
import { chromium } from 'playwright'
const [url, prefix, ...rest] = process.argv.slice(2)
const flag = (n, f) => {
  const i = rest.indexOf(`--${n}`)
  return i < 0 ? f : rest[i + 1] ?? true
}
const times = String(flag('times', '1,2,3,4,5,6')).split(',').map(Number)
const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: Number(flag('w', 960)), height: Number(flag('h', 700)) },
  deviceScaleFactor: Number(flag('dpr', 1)),
  colorScheme: flag('dark', false) ? 'dark' : 'light',
})
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(url, { waitUntil: 'networkidle' })
const t0 = Date.now()
for (const t of times) {
  const wait = t * 1000 - (Date.now() - t0)
  if (wait > 0) await page.waitForTimeout(wait)
  await page.locator(String(flag('sel', '.fig'))).first().screenshot({ path: `${prefix}-${String(t).replace('.', '_')}.png` })
}
if (errors.length) console.log('errors:', errors.join('\n'))
console.log('frames', times.join(' '))
await browser.close()
