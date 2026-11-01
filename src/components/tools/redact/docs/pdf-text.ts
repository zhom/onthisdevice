/**
 * The text layer of a PDF page as one string, with the box of every
 * character range on the page (display points, origin top-left, y down; the
 * page's own rotation applied), so detectors can run on plain text and their
 * results become boxes.
 */

/** A rectangle in displayed page points, origin at the page's top-left. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface PlacedItem {
  /** Range of this item in the page text. */
  start: number
  end: number
  str: string
  /** viewport.transform x item.transform at scale 1. */
  m: number[]
  width: number
  height: number
  fontName: string
  /** CSS font family pdf.js gives for the font, to measure character widths. */
  family: string
}

export interface PageText {
  page: number
  text: string
  items: PlacedItem[]
}

interface RawItem {
  str: string
  transform: number[]
  width: number
  height: number
  fontName: string
  hasEOL: boolean
}

interface PdfPageLike {
  getViewport(o: { scale: number }): { transform: number[] }
  getTextContent(): Promise<{ items: unknown[]; styles: Record<string, { fontFamily?: string }> }>
}

type Measure = { font: string; measureText(s: string): { width: number } }
let measurer: Measure | null | undefined

/** Width of `s` in a font close to the PDF's, or null where no canvas exists. */
function textWidth(s: string, family: string): number | null {
  if (measurer === undefined) {
    measurer = null
    try {
      if (typeof OffscreenCanvas !== 'undefined') measurer = new OffscreenCanvas(1, 1).getContext('2d')
      else if (typeof document !== 'undefined') measurer = document.createElement('canvas').getContext('2d')
    } catch {
      measurer = null
    }
  }
  if (!measurer) return null
  measurer.font = `100px ${family || 'sans-serif'}`
  return measurer.measureText(s).width
}

/** Where character `i` starts, as a share of the item's width. */
function offsetShare(item: PlacedItem, i: number): number {
  if (i <= 0) return 0
  if (i >= item.str.length) return 1
  const whole = textWidth(item.str, item.family)
  const part = textWidth(item.str.slice(0, i), item.family)
  if (whole && part !== null) return part / whole
  return i / item.str.length
}

export function multiply(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

function isTextItem(v: unknown): v is RawItem {
  return typeof v === 'object' && v !== null && 'str' in v && typeof (v as RawItem).str === 'string'
}

/** Box of characters [a, b) of an item, from measured character widths and a margin of safety. */
export function itemRangeRect(item: PlacedItem, a: number, b: number, pad = 1, slackShare = 0.16): Rect {
  const m = item.m
  const adv = Math.hypot(m[0], m[1]) || 1
  const ax = m[0] / adv
  const ay = m[1] / adv
  const upLen = Math.hypot(m[2], m[3]) || item.height || 10
  const ux = m[2] / (Math.hypot(m[2], m[3]) || 1)
  const uy = m[3] / (Math.hypot(m[2], m[3]) || 1)
  // The measured font is close to the PDF's but not the same: widen by a sixth of the font size.
  const slack = upLen * slackShare
  const s = Math.max(0, offsetShare(item, a) * item.width - (a > 0 ? slack : 0))
  const e = Math.min(item.width + slack, offsetShare(item, b) * item.width + (b < item.str.length ? slack : 0))
  // From the baseline: ascent about the font size, descent about a quarter of it.
  const pts: [number, number][] = [
    [m[4] + ax * s - ux * upLen * 0.25, m[5] + ay * s - uy * upLen * 0.25],
    [m[4] + ax * e - ux * upLen * 0.25, m[5] + ay * e - uy * upLen * 0.25],
    [m[4] + ax * s + ux * upLen * 0.95, m[5] + ay * s + uy * upLen * 0.95],
    [m[4] + ax * e + ux * upLen * 0.95, m[5] + ay * e + uy * upLen * 0.95],
  ]
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x = Math.min(...xs) - pad
  const y = Math.min(...ys) - pad
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y }
}

/** Reads a page's text layer. Items on one line are joined with a space when there is a visible gap. */
export async function readPageText(page: PdfPageLike, pageNo: number): Promise<PageText> {
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  const items: PlacedItem[] = []
  let text = ''
  let prev: PlacedItem | null = null
  let prevEol = false
  for (const raw of content.items) {
    if (!isTextItem(raw)) continue
    const m = multiply(viewport.transform, raw.transform)
    const height = Math.hypot(m[2], m[3]) || raw.height
    if (prev && !prevEol && raw.str) {
      // Same line when the baselines are close; a gap wider than a fifth of the font size is a space.
      const prevEnd = prev.m[4] + (prev.m[0] / (Math.hypot(prev.m[0], prev.m[1]) || 1)) * prev.width
      const sameLine = Math.abs(m[5] - prev.m[5]) < height * 0.5
      if (!sameLine) text += '\n'
      else if (m[4] - prevEnd > height * 0.2 && !/\s$/.test(text) && !/^\s/.test(raw.str)) text += ' '
    }
    const family = content.styles[raw.fontName]?.fontFamily ?? 'sans-serif'
    const item: PlacedItem = { start: text.length, end: text.length + raw.str.length, str: raw.str, m, width: raw.width, height, fontName: raw.fontName, family }
    text += raw.str
    if (raw.hasEOL) text += '\n'
    if (raw.str) items.push(item)
    if (raw.str || raw.hasEOL) {
      prev = raw.str ? item : prev
      prevEol = raw.hasEOL
    }
  }
  return { page: pageNo, text, items }
}

/** Boxes covering text range [start, end) of a page: one per item it touches. */
export function rangeRects(pt: PageText, start: number, end: number): Rect[] {
  const out: Rect[] = []
  // Items are in text order, so a binary search finds the first one.
  let lo = 0
  let hi = pt.items.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (pt.items[mid].end <= start) lo = mid + 1
    else hi = mid
  }
  for (let i = lo; i < pt.items.length && pt.items[i].start < end; i++) {
    const it = pt.items[i]
    const a = Math.max(0, start - it.start)
    const b = Math.min(it.str.length, end - it.start)
    if (b > a) out.push(itemRangeRect(it, a, b))
  }
  return out
}

/** All matches of a word or phrase on a page, spaces flexible. */
export function searchPage(pt: PageText, needle: string, caseSensitive: boolean): { start: number; end: number }[] {
  const escaped = needle.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  if (!escaped) return []
  const re = new RegExp(escaped, caseSensitive ? 'g' : 'gi')
  return [...pt.text.matchAll(re)].map((m) => ({ start: m.index, end: m.index + m[0].length }))
}
