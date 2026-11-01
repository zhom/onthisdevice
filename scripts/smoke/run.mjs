#!/usr/bin/env node
/**
 * Smoke harness: opens every tool page in Chromium against a built dist/
 * served by scripts/serve.mjs, and fails a tool on any console error, page
 * error, CSP violation, failed same-origin request or hydration error. File
 * tools get a fixture from scripts/smoke/fixtures/ (matched to the input's
 * accept list), the primary action is pressed, and the first download is
 * captured and checked (size and magic bytes).
 *
 *   npm run build
 *   node scripts/serve.mjs --port 46210 &    # or: npx astro dev --port 46220
 *   node scripts/smoke/fixtures.mjs          # once
 *   node scripts/smoke/run.mjs [--base URL] [--only a,b] [--category "PDF Tools"] [--concurrency 6] [--mobile]
 *
 * --mobile runs at 390×844 with touch (drags are real touch events) and also
 * fails inputs whose font is under 16 px (iOS zooms into those).
 *
 * Tools that need a choice before they produce output (select a page, type a
 * password, draw a box) get a short scripted step from SCENARIOS below.
 *
 * Writes scripts/smoke/report.json and prints a one-line tally. Exit code 1
 * when anything fails.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const FIX = path.join(HERE, 'fixtures')

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const BASE = flag('base', 'http://127.0.0.1:46210')
const ONLY = flag('only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const CATEGORY = flag('category', '')
const CONCURRENCY = Number(flag('concurrency', 6))
const TIMEOUT = Number(flag('timeout', 45_000))
const MEDIA_TIMEOUT = Number(flag('media-timeout', 150_000))
const MOBILE = args.includes('--mobile')
const REPORT = flag('report', path.join(HERE, MOBILE ? 'report-mobile.json' : 'report.json'))

const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/search-index.json'), 'utf8'))
// search-index.json: { v, c: [id, title, slug, tagline][], t: [slug, title, categoryIndex, ...][] }
let tools = index.t.map((row) => ({ slug: row[0], title: row[1], category: index.c[row[2]][1] }))
if (ONLY.length) tools = tools.filter((t) => ONLY.includes(t.slug))
if (CATEGORY) tools = tools.filter((t) => t.category === CATEGORY)

/* ── fixtures ─────────────────────────────────────────────────────────── */
const FIXTURES = fs.existsSync(FIX) ? fs.readdirSync(FIX) : []
const byExt = new Map()
for (const f of FIXTURES) {
  const ext = f.split('.').pop().toLowerCase()
  if (!byExt.has(ext) || f.startsWith('sample.')) byExt.set(ext, f)
}
const ALIASES = { jpeg: 'jpg', jpe: 'jpg', yml: 'yaml', tif: 'tiff', markdown: 'md', mdown: 'md', text: 'txt', htm: 'html', aif: 'aiff', oga: 'ogg', wave: 'wav', qt: 'mov', mpeg: 'mpg', divx: 'avi' }
const MIME = {
  'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'image/avif': 'avif', 'image/svg+xml': 'svg', 'image/bmp': 'bmp', 'image/x-icon': 'ico', 'image/tiff': 'tiff',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-matroska': 'mkv', 'video/x-msvideo': 'avi',
  'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'weba', 'audio/flac': 'flac',
  'audio/mp4': 'm4a', 'audio/aac': 'aac', 'text/csv': 'csv', 'application/json': 'json', 'text/plain': 'txt',
  'text/markdown': 'md', 'application/xml': 'xml', 'text/xml': 'xml', 'text/html': 'html', 'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
}
/** What a wildcard is fed (first two), and what it accepts (all). */
const WILDCARD = {
  'image/*': ['png', 'jpg', 'webp', 'gif', 'avif', 'bmp', 'svg', 'ico', 'tiff'],
  'video/*': ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'mpg', '3gp'],
  'audio/*': ['wav', 'mp3', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'weba', 'aiff', 'wma'],
  'text/*': ['txt', 'csv', 'md', 'html', 'xml', 'tsv', 'log', 'srt', 'vtt', 'sql'],
}
/** Generic files that fit many accept lists but rarely what a tool is for. */
const LAST = ['txt', 'zip']
const TEXTISH = new Set(['Text Tools', 'Developer Tools', 'Security & Privacy', 'Documents & Data'])

/** Extensions an accept attribute takes, in the order it lists them. */
function acceptedExts(accept) {
  const tokens = (accept || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
  const exts = []
  for (const t of tokens) {
    if (t.startsWith('.')) exts.push(ALIASES[t.slice(1)] ?? t.slice(1))
    else if (WILDCARD[t]) exts.push(...WILDCARD[t].slice(0, 2))
    else if (MIME[t]) exts.push(MIME[t])
    else if (!t.includes('/')) exts.push(ALIASES[t] ?? t)
  }
  return [...new Set(exts)]
}

function accepts(accept, file) {
  const tokens = (accept || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
  if (tokens.length === 0) return true
  const ext = file.split('.').pop().toLowerCase()
  return tokens.some((t) => {
    if (t === '*' || t === '*/*') return true
    if (t.startsWith('.')) return (ALIASES[t.slice(1)] ?? t.slice(1)) === ext
    if (WILDCARD[t]) return WILDCARD[t].includes(ext)
    return MIME[t] === ext
  })
}

/** Per-slug inputs where the generic pick is the wrong file for the tool. */
const OVERRIDES = {
  'fill-pdf-form': ['form.pdf'],
  'flatten-pdf': ['form.pdf'],
  'split-pdf-pages-in-half': ['wide.pdf'],
  'unlock-pdf': ['encrypted.pdf'],
  'remove-pdf-password': ['encrypted.pdf'],
  'extract-images-from-pdf': ['images.pdf'],
  'remove-exif-data': ['exif.jpg'],
  'image-metadata-viewer': ['exif.jpg'],
  'exif-viewer': ['exif.jpg'],
  'hex-to-text': ['hex.txt'],
  'hex-to-ascii': ['hex.txt'],
  'binary-to-text': ['binary.txt'],
  'octal-to-text': ['octal.txt'],
  'decimal-to-text': ['decimal.txt'],
  'json-unescape': ['escaped.txt'],
}
const OVERRIDE_RULES = [
  [/^xml-(?!unescape)/, 'sample.xml'],
  [/^yaml-/, 'sample.yaml'],
  [/^markdown-(to|table-to)-/, 'sample.md'],
  [/^html-to-/, 'sample.html'],
  [/^json-to-/, 'sample.json'],
  [/^csv-to-/, 'sample.csv'],
  [/^docx?-to-/, 'sample.docx'],
]

function overrideFor(slug) {
  if (OVERRIDES[slug]) return OVERRIDES[slug]
  for (const [re, file] of OVERRIDE_RULES) if (re.test(slug)) return [file]
  return null
}

function fixturesFor(tool, accept, multiple, inputIndex) {
  const forced = inputIndex === 0 ? overrideFor(tool.slug) : null
  if (forced && forced.every((f) => FIXTURES.includes(f) && accepts(accept, f))) return forced.map((f) => path.join(FIX, f))
  let exts = acceptedExts(accept)
  if (exts.length === 0) exts = TEXTISH.has(tool.category) ? ['txt'] : ['pdf']
  // Keep the accept order (the first listed type is the one the tool is for),
  // but push catch-all formats to the back.
  const ordered = [...exts.filter((e) => !LAST.includes(e)), ...exts.filter((e) => LAST.includes(e))]
  const usable = ordered.filter((e) => byExt.has(e))
  if (usable.length === 0) return []
  const first = path.join(FIX, byExt.get(usable[0]))
  if (!multiple) return [first]
  const twin = `sample-2.${usable[0]}`
  if (FIXTURES.includes(twin)) return [first, path.join(FIX, twin)]
  const other = usable.slice(1).find((e) => !LAST.includes(e))
  return other ? [first, path.join(FIX, byExt.get(other))] : [first]
}

/* ── output checks ────────────────────────────────────────────────────── */
const MAGIC = {
  pdf: (b) => b.subarray(0, 4).toString() === '%PDF',
  png: (b) => b[0] === 0x89 && b.subarray(1, 4).toString() === 'PNG',
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8,
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8,
  webp: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  gif: (b) => b.subarray(0, 4).toString() === 'GIF8',
  bmp: (b) => b.subarray(0, 2).toString() === 'BM',
  ico: (b) => b[0] === 0 && b[1] === 0 && b[2] === 1,
  avif: (b) => b.subarray(4, 8).toString() === 'ftyp',
  zip: (b) => b.subarray(0, 2).toString() === 'PK',
  docx: (b) => b.subarray(0, 2).toString() === 'PK',
  xlsx: (b) => b.subarray(0, 2).toString() === 'PK',
  epub: (b) => b.subarray(0, 2).toString() === 'PK',
  mp4: (b) => b.subarray(4, 8).toString() === 'ftyp',
  m4a: (b) => b.subarray(4, 8).toString() === 'ftyp',
  mov: (b) => ['ftyp', 'moov', 'wide', 'mdat'].includes(b.subarray(4, 8).toString()),
  webm: (b) => b.readUInt32BE(0) === 0x1a45dfa3,
  mkv: (b) => b.readUInt32BE(0) === 0x1a45dfa3,
  wav: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WAVE',
  ogg: (b) => b.subarray(0, 4).toString() === 'OggS',
  opus: (b) => b.subarray(0, 4).toString() === 'OggS',
  flac: (b) => b.subarray(0, 4).toString() === 'fLaC',
  mp3: (b) => b.subarray(0, 3).toString() === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  svg: (b) => /<svg|<\?xml/.test(b.subarray(0, 300).toString()),
  json: (b) => {
    try {
      JSON.parse(b.toString())
      return true
    } catch {
      return false
    }
  },
}

const EXCLUDE = /^(download|save|copy|clear|reset|cancel|choose|browse|add more|start over|undo|redo|delete all|close|try|load sample|sample|example|show|hide|swap|paste|select all|deselect|more options|advanced|use example|use a different|new|zoom|fit|light|dark|theme|search|menu|toggle|previous|next|back|share|open file|move .* (up|down))/i
/** "Remove sample.png", "Remove area 1": per-item controls, not actions. */
const REMOVE_ITEM = /^remove\b.*(\.\w{1,8}|\d+)$|^remove (all|file|files|item|row|area|box|page)\b/i
const PRIMARY = /(convert|merge|compress|split|extract|create|generate|make|build|apply|process|start|run|rotate|resize|crop|trim|cut|join|combine|encode|decode|sign|protect|unlock|encrypt|decrypt|flatten|repair|organize|reorder|export|render|add|remove|stamp|watermark|number|redact|edit|fill|count|analy[sz]e|check|compare|calculate|format|optimi[sz]e|reduce|shrink|mute|reverse|loop|speed|boost|normali[sz]e|record|transcribe|scan|verify|read|parse|preview|strip|clean|fix|flip|mirror|blur|pixelate|censor|invert|sharpen|grayscale|greyscale|upscale|round|pad|frame|border|collage|stitch|delete \d|recolou?r|beautify|minify|validate|hash)/i
/** Widgets that are buttons in the DOM but choose a setting rather than act. */
const NOT_ACTION = '[role="combobox"],[role="switch"],[role="tab"],[role="checkbox"],[role="radio"],[role="menuitem"],[aria-haspopup],[aria-pressed],[aria-expanded]'
const BENIGN = [/Download the React DevTools/i, /favicon/i, /ERR_ABORTED/i, /\[vite\]/i]
const ERR = /error|fail|went wrong|could ?n.t|cannot|can.t|invalid|not a valid|unsupported|not supported|corrupt|unable|too large|wrong password|incorrect|refused|ran out|check the input|not recogni[sz]ed|no .{1,40} found|skipped/i

function isMediaTool(t) {
  return t.category === 'Video & Audio' || /(video|audio|mp3|mp4|gif)/.test(t.slug)
}

async function settleHydration(page) {
  await page
    .waitForFunction(() => document.querySelectorAll('astro-island[ssr]').length === 0, null, { timeout: 20_000 })
    .catch(() => {})
}

async function labelOf(el) {
  return ((await el.innerText({ timeout: 1000 }).catch(() => '')) || (await el.getAttribute('aria-label', { timeout: 1000 }).catch(() => '')) || '')
    .trim()
    .replace(/\s+/g, ' ')
}

async function primaryButton(page, tried) {
  const buttons = page.locator(`main button:visible:not(${NOT_ACTION})`)
  const n = await buttons.count()
  const scored = []
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i)
    const text = await labelOf(b)
    if (!text || tried.has(text) || EXCLUDE.test(text) || REMOVE_ITEM.test(text)) continue
    if (await b.isDisabled().catch(() => true)) continue
    let score = PRIMARY.test(text) ? 2 : 0
    const cls = (await b.getAttribute('class').catch(() => '')) ?? ''
    if (/(^|\s)bg-(primary|destructive)(\s|$)/.test(cls)) score += 1
    if ((await b.getAttribute('type').catch(() => '')) === 'submit') score += 1
    if (score > 0) scored.push({ b, text, score, i })
  }
  scored.sort((a, b) => b.score - a.score || a.i - b.i)
  return scored[0] ?? null
}

/** A control that should save a file: "Download …", a[download], or a "Save …" button. */
async function findDownload(page, tried) {
  const candidates = page.locator(`main button:visible:not(${NOT_ACTION}), main a[download]:visible`)
  const n = await candidates.count()
  let save = null
  for (let i = 0; i < n; i++) {
    const c = candidates.nth(i)
    const text = await labelOf(c)
    if (tried.has(text)) continue
    const isAnchor = (await c.evaluate((el) => el.tagName).catch(() => '')) === 'A'
    const isDownload = isAnchor || /download/i.test(text)
    if (!isDownload && !/^save\b/i.test(text)) continue
    if (await c.isDisabled().catch(() => true)) continue
    if (isDownload) return { c, text, strong: true }
    save ??= { c, text, strong: false }
  }
  return save
}

async function visibleError(page) {
  return page
    .evaluate((source) => {
      const ERR = new RegExp(source, 'i')
      const texts = [
        ...document.querySelectorAll('main [role="alert"], main .text-destructive, [data-sonner-toast][data-type="error"]'),
      ]
        .filter((e) => e.getClientRects().length > 0)
        .map((e) => (e.textContent || '').trim().replace(/\s+/g, ' '))
      return texts.find((t) => t.length > 3 && ERR.test(t)) ?? null
    }, ERR.source)
    .catch(() => null)
}

async function copyOutput(page) {
  return page
    .evaluate(() => {
      const copy = [...document.querySelectorAll('main button')].find(
        (b) => {
          const label = b.textContent || b.getAttribute('aria-label') || ''
          return /copy/i.test(label) && !/link|url|coordinates/i.test(label) && !b.disabled
        },
      )
      return Boolean(copy)
    })
    .catch(() => false)
}

/* ── scenarios: the one choice a tool needs before it can produce output ── */
/** Buttons a scenario pressed; the main loop will not pick them as the action. */
const scenarioClicks = new WeakMap()
const click = async (page, name, opts = {}) => {
  const button = page.getByRole('button', { name, exact: true, ...opts }).first()
  const label = await labelOf(button)
  if (!scenarioClicks.has(page)) scenarioClicks.set(page, new Set())
  scenarioClicks.get(page).add(label)
  // Thumbnails animate in; a forced click is fine once the button is there.
  await button.click({ timeout: 5000 }).catch(() => button.click({ timeout: 5000, force: true }))
}
/** Waits until an enabled button matching `name` exists. */
async function expectButton(page, name, timeout = 8000) {
  await page.getByRole('button', { name }).first().waitFor({ timeout })
  const deadline = Date.now() + timeout
  while (await page.getByRole('button', { name }).first().isDisabled()) {
    if (Date.now() > deadline) throw new Error(`button ${name} stayed disabled`)
    await page.waitForTimeout(200)
  }
}
/** Selects one page thumbnail once all of them have rendered. */
async function pickPage(page, n, next) {
  await page.getByRole('button', { name: 'Page 3', exact: true }).waitFor({ timeout: 20_000 })
  await page.waitForTimeout(600)
  for (let i = 0; i < 3; i++) {
    await click(page, `Page ${n}`)
    if (await expectButton(page, next, 3000).then(() => true, () => false)) return
  }
  throw new Error(`selecting page ${n} did not enable ${next}`)
}
const has = async (page, name) => (await page.getByRole('button', { name, exact: true }).count()) > 0

/** A drag: real touch events in --mobile (tests touch-action), mouse otherwise. */
async function drag(page, x1, y1, x2, y2) {
  if (!MOBILE) {
    await page.mouse.move(x1, y1)
    await page.mouse.down()
    await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 6 })
    await page.mouse.move(x2, y2, { steps: 6 })
    await page.mouse.up()
    return
  }
  const cdp = await page.context().newCDPSession(page)
  const touch = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  await touch('touchStart', x1, y1)
  for (let i = 1; i <= 10; i++) {
    await touch('touchMove', x1 + ((x2 - x1) * i) / 10, y1 + ((y2 - y1) * i) / 10)
    await page.waitForTimeout(16)
  }
  await touch('touchEnd')
  await cdp.detach()
}

const tapAt = (page, x, y) => (MOBILE ? page.touchscreen.tap(x, y) : page.mouse.click(x, y))

/** Draws one mark on the first rendered PDF page of the overlay editor. */
async function placeMark(page, { image = false } = {}) {
  const canvas = page.locator('main canvas[aria-label^="Page "]').first()
  await canvas.waitFor({ timeout: 20_000 })
  await page.waitForTimeout(400)
  if (image) {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 10_000 }), click(page, 'Image')])
    await chooser.setFiles(path.join(FIX, 'sample.png'))
    await page.waitForTimeout(600)
    return
  }
  let tool = null
  for (const name of ['Highlight', 'White-out', 'Draw']) {
    if (await has(page, name)) {
      tool = name
      break
    }
  }
  // Pick the tool first: the toolbar sits above the page, so clicking it can
  // scroll the canvas away. Measure the canvas only after that.
  await click(page, tool ?? 'Text')
  await canvas.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  const box = await canvas.boundingBox()
  const x = box.x + box.width * 0.25
  const y = box.y + Math.min(box.height * 0.3, 300)
  if (tool) {
    await drag(page, x, y, x + Math.min(200, box.width * 0.5), y + 60)
    return
  }
  await tapAt(page, x, y)
  await page.waitForTimeout(200)
  await page.keyboard.type('Smoke test')
}

/** Drags across the middle of an element; returns false if it is not there. */
async function dragAcross(page, selector) {
  const target = page.locator(selector).first()
  if ((await target.count()) === 0) return false
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  if (!box) return false
  const y0 = box.y + Math.min(box.height * 0.3, 200)
  await drag(page, box.x + box.width * 0.3, y0, box.x + box.width * 0.65, y0 + Math.min(box.height * 0.3, 150))
  return true
}

/** Draw a box by dragging on the canvas (touch in --mobile); fall back to the button. */
async function boxOnImage(page) {
  await dragAcross(page, 'main canvas.touch-none')
  await page.waitForTimeout(300)
  if (await page.getByRole('button', { name: /^Remove area 1$/ }).count()) return
  if (MOBILE) throw new Error('a touch drag on the canvas drew no box')
  await click(page, 'Add box in the centre')
}
const centreBox = boxOnImage

const SCENARIOS = {
  'rotate-pdf': (page) => click(page, 'Rotate page 1 left'),
  'delete-pages-from-pdf': (page) => pickPage(page, 2, /^Delete 1 page/),
  'extract-pdf-pages': (page) => pickPage(page, 1, /^Extract 1 page/),
  'crop-pdf': (page) => page.getByLabel('Left', { exact: true }).fill('20'),
  'password-protect-pdf': async (page) => {
    await page.fill('#pp-password', 'hunter22')
    await page.fill('#pp-confirm', 'hunter22')
  },
  'unlock-pdf': (page) => page.fill('#ul-password', 'secret'),
  'remove-pdf-password': (page) => page.fill('#ul-password', 'secret'),
  'pdf-metadata-editor': async (page) => {
    await page.fill('#md-title', 'Smoke title')
    await click(page, 'Save metadata')
  },
  'redact-pdf': async (page) => {
    if (MOBILE) {
      await page.locator('main canvas').first().waitFor({ timeout: 20_000 })
      await dragAcross(page, 'main div.touch-none')
      await page.waitForTimeout(300)
      if (await page.getByRole('button', { name: /^Redact 1 area/ }).count()) return
      throw new Error('a touch drag on the page drew no redaction box')
    }
    await page.getByLabel('Text to find').fill('invoice')
    await click(page, 'Add boxes')
  },
  'blur-face-in-photo': centreBox,
  'blur-license-plate': centreBox,
  'censor-image': centreBox,
  'pixelate-image': centreBox,
  'sign-pdf': (page) => placeMark(page),
  'add-text-to-pdf': (page) => placeMark(page),
  'whiteout-pdf': (page) => placeMark(page),
  'highlight-pdf': (page) => placeMark(page),
  'annotate-pdf': (page) => placeMark(page),
  'edit-pdf': (page) => placeMark(page),
  'add-image-to-pdf': (page) => placeMark(page, { image: true }),
}

/** Pages without a file input: a quick check that they compute something. */
const INTERACTIVE = {
  'base64-encoder-decoder': async (page) => {
    await page.locator('main textarea').first().fill('hello world')
    await page.waitForTimeout(600)
    const out = (await page.locator('main textarea').nth(1).inputValue()).trim()
    if (out !== 'aGVsbG8gd29ybGQ=') throw new Error(`"hello world" encoded as "${out.slice(0, 40)}"`)
  },
  'password-generator': async (page) => {
    if (!/bits of entropy/.test(await page.locator('main').innerText())) throw new Error('no password shown')
  },
}

/** Tools whose result is a view on the page, not a file or text to copy. */
const VIEW_OUTPUT = {
  'xml-viewer': /well-formed/i,
}

/** Horizontal overflow and (in --mobile) inputs that make iOS zoom. */
async function layoutProblems(page) {
  return page
    .evaluate((mobile) => {
      const found = []
      const vw = window.innerWidth
      const sw = document.documentElement.scrollWidth
      if (sw > vw + 1) {
        // Name the innermost elements that stick out, so the fix is findable.
        const culprits = [...document.querySelectorAll('main *')]
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && r.right > vw + 1 && ![...el.children].some((c) => c.getBoundingClientRect().right > vw + 1)
          })
          .slice(0, 3)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/).slice(0, 4).join('.')}`.slice(0, 90))
        found.push(`overflow: page is ${sw}px wide at ${vw}px (${culprits.join(' | ') || 'outside main'})`)
      }
      if (mobile) {
        const small = [...document.querySelectorAll('main input, main textarea, main select')]
          .filter((el) => !['file', 'checkbox', 'radio', 'range', 'color', 'hidden'].includes(el.type))
          .filter((el) => el.getClientRects().length > 0 && !el.closest('[aria-hidden="true"]'))
          .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 15.5)
        if (small.length)
          found.push(
            `small input font: ${small.length} field(s) under 16px (${small
              .slice(0, 3)
              .map((el) => el.id || el.getAttribute('aria-label') || el.tagName.toLowerCase())
              .join(', ')})`,
          )
      }
      return found
    }, MOBILE)
    .catch(() => [])
}

async function saveDownload(download, tool, problems) {
  const file = path.join(os.tmpdir(), `otd-smoke-${tool.slug}-${Date.now()}`)
  await download.saveAs(file)
  const buf = fs.readFileSync(file)
  const name = download.suggestedFilename()
  const ext = name.split('.').pop().toLowerCase()
  const check = MAGIC[ext]
  fs.rmSync(file, { force: true })
  if (buf.length === 0) problems.push(`empty download ${name}`)
  else if (check && !check(buf)) problems.push(`download ${name} has wrong signature`)
  return { name, bytes: buf.length }
}

async function testTool(context, tool) {
  const page = await context.newPage()
  const problems = []
  const notes = []
  let firstDownload = null
  page.on('download', (d) => {
    firstDownload ??= d
  })
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (BENIGN.some((re) => re.test(text))) return
    problems.push(`console: ${text.slice(0, 300)}`)
  })
  page.on('pageerror', (err) => problems.push(`pageerror: ${String(err.message || err).slice(0, 300)}`))
  page.on('requestfailed', (req) => {
    const u = req.url()
    if (u.startsWith(BASE) && !/ERR_ABORTED/.test(req.failure()?.errorText ?? '')) problems.push(`requestfailed: ${u} ${req.failure()?.errorText}`)
  })
  page.on('response', (res) => {
    const u = res.url()
    if (u.startsWith(BASE) && res.status() >= 400) problems.push(`http ${res.status()}: ${u}`)
  })
  const started = Date.now()
  let status = 'pass'
  let kind = 'page'
  let output = null
  let inBytes = 0
  try {
    await page.goto(`${BASE}/${tool.slug}`, { waitUntil: 'load', timeout: 60_000 })
    await settleHydration(page)
    await page.waitForTimeout(400)
    const initial = await page.locator('input[type="file"]').count()
    if (initial > 0) {
      kind = 'file'
      // Inputs are queried again after every feed: a dropzone often re-renders
      // (or disappears) once it has a file, which shifts the indexes.
      for (let round = 0; round < Math.min(initial, 2); round++) {
        const input = await page.$('input[type="file"]:not([data-smoke-fed])')
        if (!input) break
        await input.evaluate((el) => el.setAttribute('data-smoke-fed', ''))
        const accept = (await input.getAttribute('accept')) ?? ''
        const multiple = (await input.getAttribute('multiple')) !== null
        const files = fixturesFor(tool, accept, multiple, round)
        if (files.length === 0) {
          notes.push(`no fixture for accept="${accept}"`)
          continue
        }
        await input.setInputFiles(files, { timeout: 10_000 })
        notes.push(`fed ${files.map((f) => path.basename(f)).join('+')}`)
        inBytes += files.reduce((sum, f) => sum + fs.statSync(f).size, 0)
        await page.waitForTimeout(800)
      }
      const scenario = SCENARIOS[tool.slug]
      if (scenario) {
        await page.waitForTimeout(800)
        await scenario(page)
          .then(() => notes.push('scenario'))
          .catch((err) => {
            const msg = `scenario failed: ${String(err.message || err).split('\n')[0].slice(0, 160)}`
            if (MOBILE && /touch drag/.test(msg)) problems.push(msg)
            else notes.push(msg)
          })
        await page.waitForTimeout(500)
      }
      const limit = isMediaTool(tool) ? MEDIA_TIMEOUT : TIMEOUT
      const deadline = Date.now() + limit
      const tried = new Set(scenarioClicks.get(page) ?? [])
      let clickedAt = 0
      while (Date.now() < deadline) {
        if (firstDownload) {
          output = await saveDownload(firstDownload, tool, problems)
          break
        }
        const err = await visibleError(page)
        if (err) {
          problems.push(`ui error: ${err.slice(0, 240)}`)
          break
        }
        const dl = await findDownload(page, tried)
        if (dl) {
          const wait = dl.strong ? 20_000 : 5_000
          await dl.c.click({ timeout: 5000 }).catch(() => {})
          const t0 = Date.now()
          while (!firstDownload && Date.now() - t0 < wait) await page.waitForTimeout(250)
          if (firstDownload) continue
          tried.add(dl.text)
          if (dl.strong) {
            notes.push(`"${dl.text}" gave no download`)
            output = { name: null, note: 'download button without download' }
            status = 'no-output'
            break
          }
          notes.push(`clicked "${dl.text.slice(0, 40)}"`)
          continue
        }
        if (!clickedAt) {
          const btn = await primaryButton(page, tried)
          if (btn) {
            notes.push(`clicked "${btn.text.slice(0, 40)}"`)
            tried.add(btn.text)
            await btn.b.click({ timeout: 5000 }).catch(() => {})
            clickedAt = Date.now()
            await page.waitForTimeout(500)
            continue
          }
        }
        if ((await copyOutput(page)) && Date.now() - (clickedAt || started) > 4000) {
          output = { name: null, note: 'text output (copy)' }
          break
        }
        await page.waitForTimeout(500)
      }
      if (!output && !problems.length && status === 'pass') {
        const view = VIEW_OUTPUT[tool.slug]
        if (await copyOutput(page)) output = { name: null, note: 'text output (copy)' }
        else if (view && view.test(await page.locator('main').innerText().catch(() => ''))) output = { name: null, note: 'view' }
        else status = 'no-output'
      }
      if (output && inBytes) output.inBytes = inBytes
      await page.waitForTimeout(300)
      problems.push(...(await layoutProblems(page)))
    } else {
      kind = 'interactive'
      await page.waitForTimeout(800)
      const check = INTERACTIVE[tool.slug]
      if (check)
        await check(page)
          .then(() => notes.push('checked'))
          .catch((err) => problems.push(`check: ${String(err.message || err).split('\n')[0].slice(0, 200)}`))
      problems.push(...(await layoutProblems(page)))
    }
  } catch (err) {
    problems.push(`harness: ${String(err.message || err).slice(0, 300)}`)
  }
  if (problems.length) status = 'fail'
  await page.close().catch(() => {})
  return { slug: tool.slug, category: tool.category, kind, status, ms: Date.now() - started, output, notes, problems }
}

const browser = await chromium.launch()
const context = await browser.newContext(
  MOBILE
    ? { acceptDownloads: true, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }
    : { acceptDownloads: true, viewport: { width: 1280, height: 900 } },
)
const queue = [...tools]
const results = []
let done = 0
async function worker() {
  while (queue.length) {
    const tool = queue.shift()
    let r = await testTool(context, tool)
    // The dev server answers 504 while it re-bundles a newly seen dependency.
    if (r.problems.some((p) => /http 504|Outdated Optimize Dep|Failed to fetch dynamically imported module/i.test(p)))
      r = await testTool(context, tool)
    results.push(r)
    done++
    const mark = r.status === 'pass' ? 'ok ' : r.status === 'fail' ? 'ERR' : '?? '
    console.log(`${String(done).padStart(3)}/${tools.length} ${mark} ${r.slug} (${r.kind}, ${(r.ms / 1000).toFixed(1)}s)${r.problems.length ? ' — ' + r.problems[0] : r.status !== 'pass' ? ' — ' + r.notes.join('; ') : ''}`)
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tools.length) }, worker))
await browser.close()

results.sort((a, b) => a.slug.localeCompare(b.slug))
fs.writeFileSync(REPORT, JSON.stringify(results, null, 2))
const count = (st) => results.filter((r) => r.status === st).length
console.log(
  `\ntally: ${count('pass')} pass, ${count('fail')} fail, ${count('no-output')} no-output of ${results.length} — report ${path.relative(ROOT, REPORT)}`,
)
process.exit(results.some((r) => r.status === 'fail') ? 1 : 0)
