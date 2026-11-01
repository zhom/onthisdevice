/**
 * Finds what to hide in a screenshot: text read with OCR and checked by the
 * pattern rules and the language model, faces, round profile pictures, and
 * for chats the header name and the sender names.
 */
import { visionClient } from '@/lib/ml/vision/client'
import { findAvatars } from '@/lib/ml/ocr/avatars'
import { groupLines, lineRangeBoxes, readImage } from '@/lib/ml/ocr/ocr'
import type { OcrLine, OcrWord } from '@/lib/ml/ocr/ocr'
import { filterTypes, findListed, mergeSpans } from '@/lib/ml/text/merge'
import { nerClient } from '@/lib/ml/text/ner-client'
import { findPii } from '@/lib/ml/text/pii-rules'
import { findSecrets } from '@/lib/ml/text/secret-rules'
import { TYPE_BY_ID } from '@/lib/ml/text/types'
import type { EntityType, Span } from '@/lib/ml/text/types'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type FindingKind = 'text' | 'face' | 'avatar'

export interface ScreenFinding {
  /** Stable for the same image: kind, value and position. */
  id: string
  kind: FindingKind
  /** Boxes in image pixels; a text item that wraps has one per line part. */
  rects: Rect[]
  label: string
  value?: string
  type?: EntityType
  /** Chat sender or header name: these can get a drawn fake name. */
  name?: boolean
  /** Height of the text, for drawing a replacement in a matching size. */
  textHeight?: number
  /** The text's own boxes, without the safety margin, for drawing a replacement. */
  ink?: Rect[]
}

const STATUS = /^(?:online|offline|typing|last seen|active|seen|delivered|read|today|yesterday|now|\d{1,2}[:.]\d{2}\s*(?:am|pm)?)\b/i
const NAMEISH = /^(?:[\p{Lu}][\p{L}'’.-]+)(?:\s[\p{Lu}][\p{L}'’.-]+){0,3}$/u

function median(v: number[]): number {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

const keyOf = (kind: string, value: string, r: Rect) => `${kind}:${value}:${Math.round(r.x)},${Math.round(r.y)}`

export interface ScreenText {
  words: OcrWord[]
  lines: OcrLine[]
  /** All lines joined with line breaks, and where each line starts. */
  text: string
  starts: number[]
  textHeight: number
}

/** OCR of the screenshot: run once per image. */
export async function readScreen(bitmap: ImageBitmap, onProgress?: (p: number) => void): Promise<ScreenText> {
  const words = await readImage(bitmap, onProgress)
  const lines = groupLines(words)
  const starts: number[] = []
  let text = ''
  // A blank line between OCR lines keeps the model from joining words of different lines.
  for (const l of lines) {
    if (text) text += '\n\n'
    starts.push(text.length)
    text += l.text
  }
  return { words, lines, text, starts, textHeight: median(words.map((w) => w.h)) || 14 }
}

/** Chat layout: the tall line at the top is the chat title; a short name-like line above a message is a sender. */
function chatNames(lines: OcrLine[], height: number): { line: number; header: boolean }[] {
  const out: { line: number; header: boolean }[] = []
  const top = lines.filter((l) => l.y < height * 0.14 && /\p{L}{2,}/u.test(l.text) && !STATUS.test(l.text))
  if (top.length) {
    const title = top.reduce((a, b) => (b.h > a.h ? b : a))
    out.push({ line: lines.indexOf(title), header: true })
  }
  lines.forEach((l, i) => {
    if (out.some((o) => o.line === i)) return
    const words = l.text.split(' ')
    const name = (NAMEISH.test(l.text) && words.length <= 4) || /^~?\s?\+?[\d ()-]{8,}$/.test(l.text)
    if (!name) return
    const next = lines[i + 1]
    if (!next) return
    const below = next.y - (l.y + l.h)
    if (below >= -l.h * 0.2 && below < l.h * 1.2 && Math.abs(next.x - l.x) < l.h * 1.5) out.push({ line: i, header: false })
  })
  return out
}

export interface TextOptions {
  types: ReadonlySet<EntityType>
  hide: string[]
  model: Span[]
  chat: boolean
  height: number
}

/** Text items to hide: rules, model, always-hide list and, for chats, the names from the layout. */
export function findTextItems(st: ScreenText, opts: TextOptions): ScreenFinding[] {
  const { lines, text, starts } = st
  const findings: ScreenFinding[] = []
  const lineOf = (offset: number) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return lo
  }
  const taken: [number, number][] = []
  const push = (start: number, end: number, label: string, type: EntityType | undefined, name: boolean) => {
    // Text that is already covered by an earlier item stays with that item.
    if (taken.some(([a, b]) => a < end && start < b)) return
    const rects: Rect[] = []
    const ink: Rect[] = []
    let h = 0
    for (let li = lineOf(start); li < lines.length && starts[li] < end; li++) {
      const l = lines[li]
      const a = Math.max(0, start - starts[li])
      const b = Math.min(l.text.length, end - starts[li])
      if (b <= a) continue
      const lh = median(l.words.map((w) => w.h))
      // OCR boxes hug the ink; grow them so no edge of a letter stays visible.
      for (const r of lineRangeBoxes(l, a, b)) {
        ink.push(r)
        rects.push({ x: r.x - lh * 0.3, y: r.y - lh * 0.22, w: r.w + lh * 0.6, h: r.h + lh * 0.44 })
      }
      h = Math.max(h, lh)
    }
    if (!rects.length) return
    taken.push([start, end])
    const value = text.slice(start, end)
    findings.push({ id: keyOf('t', value, rects[0]), kind: 'text', rects, label, value, type, name, textHeight: h, ink })
  }
  if (opts.chat) {
    const senders = new Set<string>()
    for (const c of chatNames(lines, opts.height)) {
      const at = starts[c.line]
      push(at, at + lines[c.line].text.length, c.header ? 'Chat name' : 'Sender', 'PERSON', true)
      if (!c.header) senders.add(lines[c.line].text)
    }
    // Senders mentioned elsewhere: full names first, then first and last names alone.
    const terms = new Set<string>()
    for (const n of senders) {
      if (!/\p{L}/u.test(n)) continue
      terms.add(n)
      for (const part of n.split(' ')) if (part.length >= 3 && /^\p{Lu}/u.test(part)) terms.add(part)
    }
    for (const term of [...terms].sort((a, b) => b.length - a.length)) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}_@.])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'gu')
      for (const m of text.matchAll(re)) push(m.index, m.index + m[0].length, 'Name', 'PERSON', true)
    }
  }
  const spans = filterTypes(mergeSpans(text, [...findPii(text), ...findSecrets(text), ...opts.model, ...findListed(text, opts.hide)]), opts.types)
  for (const s of spans) {
    const label = s.source === 'list' ? 'Always hide' : (s.label ?? TYPE_BY_ID[s.type].one.replace(/^./, (c) => c.toUpperCase()))
    push(s.start, s.end, label, s.type, s.type === 'PERSON')
  }
  return findings
}

/** Faces and round profile pictures. A face inside a round picture becomes one picture. */
export async function findPictures(bitmap: ImageBitmap, st: ScreenText, onProgress?: (label: string) => void): Promise<ScreenFinding[]> {
  const out: ScreenFinding[] = []
  const faces: Rect[] = []
  onProgress?.('Looking for faces')
  try {
    const vision = visionClient()
    await vision.load('face')
    for (const d of await vision.detect(await createImageBitmap(bitmap), { model: 'face' })) faces.push({ x: d.x, y: d.y, w: d.w, h: d.h })
  } catch {
    /* the face model is optional; text results still stand */
  }
  onProgress?.('Looking for profile pictures')
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  let circles: ReturnType<typeof findAvatars> = []
  if (ctx) {
    ctx.drawImage(bitmap, 0, 0)
    circles = findAvatars(ctx.getImageData(0, 0, canvas.width, canvas.height), st.textHeight, st.words)
  }
  canvas.width = 0
  const used = new Set<number>()
  for (const c of circles) {
    const r = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 }
    // Text right before a circle on the same line means the circle is part of the text.
    const afterText = st.words.some((w) => {
      const cy = w.y + w.h / 2
      return cy > r.y && cy < r.y + r.h && w.x + w.w > r.x - st.textHeight * 1.2 && w.x < c.x
    })
    if (afterText) continue
    faces.forEach((f, i) => {
      const cx = f.x + f.w / 2
      const cy = f.y + f.h / 2
      if (cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h) used.add(i)
    })
    out.push({ id: keyOf('a', '', r), kind: 'avatar', rects: [r], label: 'Profile picture' })
  }
  faces.forEach((f, i) => {
    if (!used.has(i)) out.push({ id: keyOf('f', '', f), kind: 'face', rects: [f], label: 'Face' })
  })
  return out
}

/** The language model's spans for the screen text, when the model is loaded. */
export function modelSpans(st: ScreenText): Promise<Span[]> {
  return st.text.trim() ? nerClient().run(st.text).catch(() => []) : Promise.resolve([])
}

/** Background and text colors around a box, for drawing a replacement name. */
export function sampleColors(ctx: CanvasRenderingContext2D, r: Rect): { bg: string; fg: string } {
  const x = Math.max(0, Math.floor(r.x - 2))
  const y = Math.max(0, Math.floor(r.y - 2))
  const w = Math.max(1, Math.min(ctx.canvas.width - x, Math.ceil(r.w + 4)))
  const h = Math.max(1, Math.min(ctx.canvas.height - y, Math.ceil(r.h + 4)))
  const d = ctx.getImageData(x, y, w, h).data
  // The most common color is the background; the one farthest from it is the text.
  const counts = new Map<number, number>()
  for (let i = 0; i < d.length; i += 4) {
    const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let bgKey = 0
  let best = -1
  for (const [k, n] of counts) {
    if (n > best) {
      best = n
      bgKey = k
    }
  }
  const bg = [(bgKey >> 10) << 3, ((bgKey >> 5) & 31) << 3, (bgKey & 31) << 3]
  let fg = bg
  let far = -1
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2])
    if (dist > far) {
      far = dist
      fg = [d[i], d[i + 1], d[i + 2]]
    }
  }
  const hex = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`
  return { bg: hex(bg), fg: hex(fg) }
}
