#!/usr/bin/env node
/**
 * Report pages whose layout is wider than the viewport, and the elements
 * that stick out (never shipped).
 *   node scripts/overflow.mjs <base> <path,path,...> [--w 320]
 */
import { chromium } from 'playwright'
const [base, list, ...rest] = process.argv.slice(2)
const wi = rest.indexOf('--w')
const w = wi >= 0 ? Number(rest[wi + 1]) : 320
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: w, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const page = await ctx.newPage()
let bad = 0
for (const p of list.split(',')) {
  await page.goto(base + p, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const r = await page.evaluate((vw) => {
    const sw = document.documentElement.scrollWidth
    const out = []
    if (sw > vw + 1) {
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect()
        if (b.right > vw + 1 && b.width > 0) {
          let clipped = false
          for (let a = el.parentElement; a; a = a.parentElement) {
            const cs = getComputedStyle(a)
            if (/(hidden|auto|scroll|clip)/.test(cs.overflowX) && a.getBoundingClientRect().right <= vw + 1) { clipped = true; break }
          }
          if (!clipped) out.push(`${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).slice(0, 60)} right=${Math.round(b.right)}`)
        }
      }
    }
    return { sw, out: out.slice(0, 8) }
  }, w)
  if (r.sw > w + 1) bad++
  console.log(`${r.sw > w + 1 ? 'OVERFLOW' : 'ok      '} ${p} scrollWidth=${r.sw}`)
  for (const o of r.out) console.log('   ', o)
}
await browser.close()
process.exit(bad ? 1 : 0)
