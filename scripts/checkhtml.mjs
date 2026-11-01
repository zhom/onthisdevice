#!/usr/bin/env node
/**
 * Checks every built page: exactly one <h1>, a canonical link, an og:image
 * whose file exists in dist/, a title and description, and every internal
 * link pointing at a page or file that exists. Never shipped.
 *   node scripts/checkhtml.mjs [dist]
 */
import fs from 'node:fs'
import path from 'node:path'
const DIST = process.argv[2] ?? 'dist'
const pages = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.html')) pages.push(p)
  }
}
walk(DIST)
const exists = (urlPath) => {
  const clean = decodeURIComponent(urlPath.split('#')[0].split('?')[0])
  if (clean === '' || clean === '/') return true
  const f = path.join(DIST, clean)
  return fs.existsSync(f) && fs.statSync(f).isFile() ? true : fs.existsSync(path.join(f, 'index.html')) || fs.existsSync(`${f}.html`)
}
const problems = []
const titles = new Map()
let links = 0
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8')
  const rel = path.relative(DIST, file)
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length
  if (h1 !== 1) problems.push(`${rel}: ${h1} h1`)
  if (!/<link rel="canonical" href="https:\/\/onthisdevice\.com[^"]*"/.test(html)) problems.push(`${rel}: no canonical`)
  const og = html.match(/<meta property="og:image" content="https:\/\/onthisdevice\.com(\/[^"]+)"/)
  if (!og) problems.push(`${rel}: no og:image`)
  else if (!fs.existsSync(path.join(DIST, og[1]))) problems.push(`${rel}: og image missing ${og[1]}`)
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]
  if (!title) problems.push(`${rel}: no title`)
  else if (!/noindex/.test(html)) titles.set(title, [...(titles.get(title) ?? []), rel])
  if (!/<meta name="description" content="[^"]{50,}"/.test(html)) problems.push(`${rel}: short or no description`)
  for (const m of html.matchAll(/<(?:a|link)\s[^>]*?href="(\/[^"]*)"/g)) {
    links++
    if (!exists(m[1])) problems.push(`${rel}: broken link ${m[1]}`)
  }
}
for (const [t, list] of titles) if (list.length > 1) problems.push(`duplicate title "${t}": ${list.slice(0, 3).join(', ')}`)
console.log(`${pages.length} pages, ${links} internal links checked, ${problems.length} problems`)
for (const p of problems.slice(0, 40)) console.log('  ' + p)
process.exit(problems.length ? 1 : 0)
