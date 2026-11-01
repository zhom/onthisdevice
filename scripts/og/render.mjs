/**
 * Share cards (1200×630 PNG) for every built page, rendered from dist/ after
 * `astro build`. Black card, white ink: the category glyph, the page title,
 * one plain line and the domain. Layout by satori, rasterised by resvg.
 * Results are cached by content hash in node_modules/.cache/otd-og.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { glyphSvg } from '../../src/lib/glyphs.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const CACHE = path.join(ROOT, 'node_modules/.cache/otd-og')
// Any change to this file or to the glyphs makes new cards.
const VERSION = crypto
  .createHash('sha1')
  .update(fs.readFileSync(fileURLToPath(import.meta.url)))
  .update(fs.readFileSync(path.join(ROOT, 'src/lib/glyphs.ts')))
  .digest('hex')

const PAPER = '#000000'
const INK = '#ffffff'
const GREY = '#a3a3a3'

const FONT_FILES = { 400: 'archivo-regular.ttf', 700: 'archivo-bold.ttf' }
const FONTS = Object.entries(FONT_FILES).map(([weight, file]) => ({
  name: 'Archivo',
  weight: Number(weight),
  style: 'normal',
  data: fs.readFileSync(path.join(HERE, 'fonts', file)),
}))

const svgUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

/** The site mark (frame and core), for pages without a category. */
const MARK = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><rect x="2.25" y="2.25" width="19.5" height="19.5" rx="5" fill="none" stroke="${INK}" stroke-width="2.5"/><rect x="9" y="9" width="6" height="6" rx="1" fill="${INK}"/></svg>`

const h = (type, style, children) => ({ type, props: { style, children } })

function titleSize(title) {
  const n = title.length
  return n <= 14 ? 112 : n <= 22 ? 96 : n <= 32 ? 82 : n <= 46 ? 68 : 58
}

/**
 * @param {{ title: string, line: string, url: string, glyph?: string }} card
 */
export async function renderCard(card) {
  const key = crypto.createHash('sha1').update(VERSION + JSON.stringify(card)).digest('hex')
  const cached = path.join(CACHE, `${key}.png`)
  if (fs.existsSync(cached)) return fs.readFileSync(cached)

  // The glyph's output frame (phase 2): the result of the category's work.
  const mark = card.glyph ? glyphSvg(card.glyph, { fill: INK, size: 132, phase: 2 }) : MARK(132)
  const tree = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      width: 1200,
      height: 630,
      padding: '68px 76px 64px',
      boxSizing: 'border-box',
      backgroundColor: PAPER,
      color: INK,
      fontFamily: 'Archivo',
    },
    [
      h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }, [
        { type: 'img', props: { src: svgUri(mark), width: 132, height: 132 } },
        h('div', { display: 'flex', fontSize: 28, fontWeight: 400, color: GREY }, card.url),
      ]),
      h('div', { display: 'flex', flexDirection: 'column', gap: 22 }, [
        h(
          'div',
          { display: 'block', fontSize: titleSize(card.title), fontWeight: 700, lineHeight: 1.04, maxWidth: 1040, lineClamp: 3, textWrap: 'balance' },
          card.title,
        ),
        h('div', { display: 'flex', fontSize: 32, fontWeight: 400, lineHeight: 1.3, color: GREY }, card.line),
      ]),
    ],
  )
  const svg = await satori(tree, { width: 1200, height: 630, fonts: FONTS })
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      loadSystemFonts: false,
      fontFiles: Object.values(FONT_FILES).map((f) => path.join(HERE, 'fonts', f)),
      defaultFontFamily: 'Archivo',
    },
  })
    .render()
    .asPng()
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(cached, png)
  return png
}

/* ── pages → cards ────────────────────────────────────────────────────── */
const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

export function collectPages(dist) {
  const pages = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (['_astro', 'og', 'ffmpeg', 'fonts', 'icons', 'licenses', 'models', 'ort'].includes(e.name)) continue
        walk(p)
      } else if (e.name.endsWith('.html')) pages.push(p)
    }
  }
  walk(dist)
  return pages
}

const DEFAULT_LINE = 'Runs in your browser. Nothing is uploaded.'

export function cardFor(file, html) {
  const og = html.match(/<meta property="og:image" content="https:\/\/[^/]+(\/og\/[^"]+\.png)"/)
  if (!og) return null
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  const line = html.match(/data-og-line="([^"]*)"/)
  const canon = html.match(/<link rel="canonical" href="https:\/\/([^"]+)"/)
  const cat = html.match(/<html[^>]*data-cat="([^"]+)"/)
  return {
    out: og[1],
    card: {
      title: decode(h1?.[1] ?? 'onthisdevice'),
      line: decode(line?.[1] ?? DEFAULT_LINE),
      url: (canon?.[1] ?? 'onthisdevice.com').split('/')[0],
      glyph: cat?.[1],
    },
  }
}
