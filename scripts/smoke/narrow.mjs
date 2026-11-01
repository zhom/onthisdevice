/**
 * Narrow-screen check (never shipped): opens every built page at one width and
 * reports pages wider than the viewport (DOC) and elements whose own content
 * spills out of them (a label wider than its button, tabs wider than the bar).
 * Content inside a horizontal scroller is fine and is not reported.
 *   node scripts/smoke/narrow.mjs <base> [width=320] [path,path,...]
 * Known, intended spills: the all-tools chip scroller bleeds to the screen
 * edges; slider thumbs overhang their track; math steps scroll sideways.
 */
import { chromium } from 'playwright'
import { readdirSync, statSync } from 'node:fs'
const base = process.argv[2], W = Number(process.argv[3] || 320)
const only = process.argv[4] ? process.argv[4].split(',') : null
const pages = only || ['/', ...readdirSync('dist').filter((d) => statSync(`dist/${d}`).isDirectory() && !d.startsWith('_') && !['og','icons','fonts','ffmpeg','licenses','lab','category'].includes(d)).map((d) => `/${d}`), ...readdirSync('dist/category').map((d) => `/category/${d}`)]
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: W, height: 900 } })
let i = 0, bad = 0
async function worker() {
  const p = await ctx.newPage()
  while (i < pages.length) {
    const path = pages[i++]
    try {
      await p.goto(base + path, { waitUntil: 'load' }); await p.waitForTimeout(500)
      if (process.env.CSS) await p.addStyleTag({ content: process.env.CSS })
      await p.waitForTimeout(60)
      const r = await p.evaluate((vw) => {
        const out = []
        const all = [...document.body.querySelectorAll('*')].filter((el) => !el.closest('svg') && !el.closest('[aria-hidden="true"]'))
        for (const el of all) {
          const cs = getComputedStyle(el)
          if (cs.overflowX !== 'visible' || cs.display === 'contents' || cs.display === 'inline' || cs.visibility === 'hidden') continue
          if (el.clientWidth === 0 || el.scrollWidth <= el.clientWidth + 2) continue
          const kids = [...el.children].some((k) => { const c = getComputedStyle(k); return c.position !== 'absolute' && c.overflowX === 'visible' && k.scrollWidth > k.clientWidth + 2 && k.clientWidth > 0 })
          if (kids) continue
          const rc = el.getBoundingClientRect()
          if (rc.bottom < 0) continue
          out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 5).join('.')} ${el.clientWidth}<${el.scrollWidth} "${(el.textContent || '').trim().slice(0, 40)}"`)
        }
        return [document.documentElement.scrollWidth > vw + 1 ? document.documentElement.scrollWidth : 0, out.slice(0, 4)]
      }, W)
      if (r[0] || r[1].length) { bad++; console.log(path, r[0] ? `DOC ${r[0]}` : ''); for (const l of r[1]) console.log('   ', l) }
    } catch (e) { console.log(path, 'ERR', String(e.message).slice(0, 80)) }
  }
  await p.close()
}
await Promise.all([worker(), worker(), worker(), worker()])
console.log(`squeeze ${W}: ${pages.length} pages, ${bad} with problems`)
await b.close()
