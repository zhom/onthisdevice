/**
 * Finds what a "redacted" PDF still holds:
 *  - text under filled shapes: text boxes compared with the filled paths and
 *    images of the operator list, confirmed by pixels of the rendered page
 *    (no visible glyphs inside the word's box)
 *  - text that renders invisibly (white on white, hidden layers) or tiny text
 *  - redaction annotations that were marked but never applied
 *  - earlier revisions kept by incremental saves, with the text they had
 *  - document properties, XMP, annotations and comments, form values,
 *    attachments, bookmarks and scripts
 */
import { copyBytes, get2dContext, loadPdfJs } from '@/components/tools/pdf/pdf-edit-core'
import { itemRangeRect, multiply, readPageText } from './pdf-text'
import type { PageText, Rect } from './pdf-text'

export type FindingKind =
  | 'under-dark'
  | 'under-light'
  | 'under-image'
  | 'invisible'
  | 'tiny'
  | 'off-page'
  | 'redact-annot'
  | 'annotation'
  | 'form'
  | 'revision'

export interface Finding {
  kind: FindingKind
  /** 1-based page, or 0 for the whole document. */
  page: number
  /** The text that can be read out of the file. */
  text: string
  detail?: string
}

export interface DocInfo {
  label: string
  value: string
}

export interface CheckReport {
  pages: number
  findings: Finding[]
  properties: DocInfo[]
  xmp: DocInfo[]
  attachments: { name: string; size: number; preview: string }[]
  bookmarks: string[]
  scripts: number
  revisions: number
  hiddenLayers: string[]
}

export const KIND_TEXT: Record<FindingKind, string> = {
  'under-dark': 'Text under a dark box',
  'under-light': 'Text under a white or light box',
  'under-image': 'Text under an image',
  invisible: 'Text that does not show (white text or a hidden layer)',
  tiny: 'Text too small to see',
  'off-page': 'Text outside the visible page',
  'redact-annot': 'Redaction marked but not applied',
  annotation: 'Comment or annotation',
  form: 'Form field value',
  revision: 'Text in an earlier version of the file',
}

type PdfjsModule = Awaited<ReturnType<typeof loadPdfJs>>
type PdfDoc = Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>
type PdfPage = Awaited<ReturnType<PdfDoc['getPage']>>

interface Shape {
  rect: Rect
  kind: 'dark' | 'light' | 'image' | 'mid'
}

function luma(hex: string): number | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex)
  if (!m) return null
  return (0.2126 * parseInt(m[1], 16) + 0.7152 * parseInt(m[2], 16) + 0.0722 * parseInt(m[3], 16)) / 255
}

function apply(m: number[], x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

function boxOf(m: number[], x0: number, y0: number, x1: number, y1: number): Rect {
  const pts = [apply(m, x0, y0), apply(m, x1, y0), apply(m, x0, y1), apply(m, x1, y1)]
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

function overlapShare(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (w <= 0 || h <= 0) return 0
  return (w * h) / Math.max(1e-6, a.w * a.h)
}

/** Filled paths and images, in display coordinates, from the operator list. */
async function filledShapes(pdfjs: PdfjsModule, page: PdfPage): Promise<Shape[]> {
  const OPS = pdfjs.OPS
  const view = page.getViewport({ scale: 1 }).transform as number[]
  const list = await page.getOperatorList()
  const fills = new Set<number>([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke])
  const shapes: Shape[] = []
  let ctm = [1, 0, 0, 1, 0, 0]
  let fill = '#000000'
  const stack: { ctm: number[]; fill: string }[] = []
  for (let i = 0; i < list.fnArray.length; i++) {
    const fn = list.fnArray[i]
    const args = list.argsArray[i] as unknown[] | null
    switch (fn) {
      case OPS.save:
        stack.push({ ctm, fill })
        break
      case OPS.restore: {
        const s = stack.pop()
        if (s) ({ ctm, fill } = s)
        break
      }
      case OPS.transform:
        ctm = multiply(ctm, args as number[])
        break
      case OPS.paintFormXObjectBegin: {
        stack.push({ ctm, fill })
        const matrix = args?.[0] as number[] | null
        if (Array.isArray(matrix) && matrix.length === 6) ctm = multiply(ctm, matrix)
        break
      }
      case OPS.paintFormXObjectEnd: {
        const s = stack.pop()
        if (s) ({ ctm, fill } = s)
        break
      }
      case OPS.setFillRGBColor:
        if (typeof args?.[0] === 'string') fill = args[0]
        break
      case OPS.setFillGray:
      case OPS.setFillCMYKColor:
        if (typeof args?.[0] === 'string') fill = args[0]
        break
      case OPS.constructPath: {
        const op = args?.[0] as number
        const minMax = args?.[2] as ArrayLike<number> | null
        if (!fills.has(op) || !minMax || minMax.length < 4 || !Number.isFinite(minMax[0])) break
        const rect = boxOf(multiply(view, ctm), minMax[0], minMax[1], minMax[2], minMax[3])
        const l = luma(fill)
        shapes.push({ rect, kind: l === null ? 'mid' : l < 0.3 ? 'dark' : l > 0.85 ? 'light' : 'mid' })
        break
      }
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject:
        shapes.push({ rect: boxOf(multiply(view, ctm), 0, 0, 1, 1), kind: 'image' })
        break
    }
  }
  return shapes
}

/** True when the box shows no glyph: almost all pixels within a small range of one value. */
function blank(data: Uint8ClampedArray, width: number, height: number, r: Rect, scale: number): { blank: boolean; dark: boolean } {
  // Shrink by a fifth of the height so neighbours and box edges do not count.
  const inset = r.h * 0.2
  const x0 = Math.max(0, Math.floor((r.x + inset * 0.5) * scale))
  const y0 = Math.max(0, Math.floor((r.y + inset) * scale))
  const x1 = Math.min(width, Math.ceil((r.x + r.w - inset * 0.5) * scale))
  const y1 = Math.min(height, Math.ceil((r.y + r.h - inset) * scale))
  if (x1 - x0 < 2 || y1 - y0 < 2) return { blank: false, dark: false }
  const hist = new Uint32Array(64)
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4
      const l = (data[i] * 54 + data[i + 1] * 183 + data[i + 2] * 19) >> 8
      hist[l >> 2]++
      n++
    }
  }
  let peak = 0
  for (let k = 1; k < 64; k++) if (hist[k] > hist[peak]) peak = k
  let near = 0
  for (let k = Math.max(0, peak - 3); k <= Math.min(63, peak + 3); k++) near += hist[k]
  return { blank: near / n > 0.985, dark: peak < 20 }
}

interface Word {
  text: string
  rect: Rect
  height: number
  item: number
  start: number
  end: number
}

function wordsOf(pt: PageText): Word[] {
  const out: Word[] = []
  pt.items.forEach((it, item) => {
    // Words without the punctuation around them, so "Carter," under a box that ends before the comma counts.
    for (const m of it.str.matchAll(/[\p{L}\p{N}](?:[\p{L}\p{N}@._'’/:-]*[\p{L}\p{N}])?/gu)) {
      out.push({ text: m[0], rect: itemRangeRect(it, m.index, m.index + m[0].length, 0, 0), height: it.height, item, start: m.index, end: m.index + m[0].length })
    }
  })
  return out
}

/** Joins consecutive flagged words of one kind into phrases, with the punctuation between them. */
function phrases(page: number, pt: PageText, words: Word[], flags: (FindingKind | null)[]): Finding[] {
  const out: Finding[] = []
  let cur: { kind: FindingKind; first: Word; last: Word; parts: string[] } | null = null
  const close = () => {
    if (!cur) return
    const { first, last } = cur
    const text = first.item === last.item ? pt.items[first.item].str.slice(first.start, last.end) : cur.parts.join(' ')
    out.push({ kind: cur.kind, page, text })
    cur = null
  }
  words.forEach((w, i) => {
    const f = flags[i]
    if (f && cur && cur.kind === f) {
      cur.last = w
      cur.parts.push(w.text)
    } else {
      close()
      if (f) cur = { kind: f, first: w, last: w, parts: [w.text] }
    }
  })
  close()
  return out
}

async function checkPage(pdfjs: PdfjsModule, page: PdfPage, n: number): Promise<{ text: PageText; findings: Finding[] }> {
  const text = await readPageText(page, n)
  const findings: Finding[] = []
  const words = wordsOf(text)
  const vp = page.getViewport({ scale: 1 })
  if (words.length > 0) {
    const shapes = await filledShapes(pdfjs, page)
    const scale = Math.min(3, 2400 / Math.max(vp.width, vp.height))
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = get2dContext(canvas)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, viewport }).promise
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    canvas.width = 0
    const flags = words.map((w): FindingKind | null => {
      const r = w.rect
      if (r.x + r.w < 0 || r.y + r.h < 0 || r.x > vp.width || r.y > vp.height) return 'off-page'
      if (w.height < 2) return 'tiny'
      const px = blank(img.data, img.width, img.height, r, scale)
      if (!px.blank) return null
      const cover = shapes.filter((s) => overlapShare(r, s.rect) > 0.6)
      if (cover.some((s) => s.kind === 'image')) return 'under-image'
      if (px.dark || cover.some((s) => s.kind === 'dark')) return cover.length ? 'under-dark' : 'invisible'
      if (cover.some((s) => s.kind === 'light' || s.kind === 'mid')) return 'under-light'
      return 'invisible'
    })
    findings.push(...phrases(n, text, words, flags))
  }

  // Annotations: unapplied redactions with the text under them, comments, form values.
  const annots = (await page.getAnnotations()) as {
    subtype?: string
    rect?: number[]
    contentsObj?: { str?: string }
    titleObj?: { str?: string }
    fieldValue?: unknown
    fieldName?: string
    overlayText?: string
  }[]
  for (const a of annots) {
    const contents = a.contentsObj?.str?.trim() ?? ''
    const author = a.titleObj?.str?.trim() ?? ''
    if (a.subtype === 'Redact') {
      let under = ''
      if (a.rect) {
        const r = boxOf(vp.transform as number[], a.rect[0], a.rect[1], a.rect[2], a.rect[3])
        under = words.filter((w) => overlapShare(w.rect, r) > 0.4).map((w) => w.text).join(' ')
      }
      findings.push({ kind: 'redact-annot', page: n, text: under || '(no text under it)', detail: [contents, author && `by ${author}`].filter(Boolean).join(', ') })
    } else if (a.subtype === 'Widget') {
      const v = a.fieldValue
      const value = Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : ''
      if (value.trim() && value !== 'Off') findings.push({ kind: 'form', page: n, text: value, detail: a.fieldName })
    } else if (a.subtype !== 'Link' && (contents || author)) {
      findings.push({ kind: 'annotation', page: n, text: contents || '(no text)', detail: [a.subtype, author && `by ${author}`].filter(Boolean).join(', ') })
    }
  }
  return { text, findings }
}

/** Byte offsets just after each %%EOF marker: every revision of an incrementally saved file. */
export function revisionEnds(bytes: Uint8Array): number[] {
  const ends: number[] = []
  const marker = [0x25, 0x25, 0x45, 0x4f, 0x46] // %%EOF
  outer: for (let i = 0; i <= bytes.length - 5; i++) {
    for (let k = 0; k < 5; k++) if (bytes[i + k] !== marker[k]) continue outer
    let end = i + 5
    while (end < bytes.length && (bytes[end] === 0x0d || bytes[end] === 0x0a)) end++
    ends.push(end)
  }
  return ends
}

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[\p{L}\p{N}@.'-]{2,}/gu) ?? [])
}

export async function checkPdf(bytes: Uint8Array, onProgress?: (done: number, total: number, label: string) => void): Promise<CheckReport> {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: copyBytes(bytes) }).promise
  const report: CheckReport = { pages: doc.numPages, findings: [], properties: [], xmp: [], attachments: [], bookmarks: [], scripts: 0, revisions: 1, hiddenLayers: [] }
  try {
    const layers = await doc.getOptionalContentConfig().catch(() => null)
    if (layers) {
      for (const [, group] of layers) {
        const g = group as { name?: string | null; visible?: boolean }
        if (g.visible === false) report.hiddenLayers.push(g.name ?? 'Unnamed layer')
      }
    }
    const pageTexts: string[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress?.(n - 1, doc.numPages + 1, `Checking page ${n} of ${doc.numPages}`)
      const page = await doc.getPage(n)
      const r = await checkPage(pdfjs, page, n)
      report.findings.push(...r.findings)
      pageTexts.push(r.text.text)
      page.cleanup()
    }

    onProgress?.(doc.numPages, doc.numPages + 1, 'Checking metadata and earlier versions')
    const meta = await doc.getMetadata().catch(() => null)
    const info = (meta?.info ?? {}) as Record<string, unknown>
    for (const key of ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate']) {
      const v = info[key]
      if (typeof v === 'string' && v.trim()) report.properties.push({ label: key, value: v })
    }
    const custom = info.Custom as Record<string, unknown> | undefined
    if (custom) for (const [k, v] of Object.entries(custom)) report.properties.push({ label: k, value: String(v) })
    // XMP: pdf.js gives an iterable of [name, value] pairs.
    const xmp = meta?.metadata as unknown as Iterable<[string, unknown]> | null | undefined
    if (xmp && typeof (xmp as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function') {
      for (const [k, v] of xmp) {
        const value = Array.isArray(v) ? v.join(', ') : String(v)
        if (value.trim()) report.xmp.push({ label: k, value })
      }
    }
    const att = await doc.getAttachments().catch(() => null)
    if (att) {
      type Att = { filename: string; content?: Uint8Array | null }
      const list: [string, Att][] = att instanceof Map ? [...(att as Map<string, Att>).entries()] : Object.entries(att as Record<string, Att>)
      for (const [id, a] of list) {
        const content = a.content ?? (await doc.getAttachmentContent(id).catch(() => null))
        const preview = content && /\.(?:txt|csv|json|xml|md|html?)$/i.test(a.filename) ? new TextDecoder().decode(content.subarray(0, 200)) : ''
        report.attachments.push({ name: a.filename, size: content?.byteLength ?? 0, preview })
      }
    }
    const outline = await doc.getOutline().catch(() => null)
    const walk = (items: { title: string; items?: unknown[] }[] | null | undefined) => {
      for (const it of items ?? []) {
        report.bookmarks.push(it.title)
        walk(it.items as { title: string; items?: unknown[] }[])
      }
    }
    walk(outline as { title: string; items?: unknown[] }[] | null)
    const js = await doc.getJSActions().catch(() => null)
    report.scripts = js ? js.size : 0

    // Earlier revisions: load the file as it was at each earlier %%EOF and compare its words.
    const ends = revisionEnds(bytes)
    report.revisions = Math.max(1, ends.length)
    const now = words(pageTexts.join('\n'))
    for (let r = 0; r < ends.length - 1; r++) {
      try {
        const old = await pdfjs.getDocument({ data: bytes.slice(0, ends[r]) }).promise
        for (let n = 1; n <= old.numPages; n++) {
          const page = await old.getPage(n)
          const t = await readPageText(page, n)
          const gone = t.text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line && [...words(line)].some((w) => !now.has(w)))
          for (const line of gone) report.findings.push({ kind: 'revision', page: n, text: line, detail: `version ${r + 1} of ${ends.length}` })
        }
        void old.loadingTask.destroy()
      } catch {
        /* a broken earlier revision cannot leak through a reader either */
      }
    }
  } finally {
    void doc.loadingTask.destroy()
  }
  onProgress?.(1, 1, 'Done')
  return report
}

export function problemCount(r: CheckReport): number {
  return r.findings.length + r.properties.filter((p) => !['Producer', 'Creator', 'CreationDate', 'ModDate'].includes(p.label)).length + r.xmp.length + r.attachments.length + r.bookmarks.length + r.scripts
}

/** Plain-text report for download. */
export function reportText(name: string, r: CheckReport): string {
  const lines: string[] = [`PDF redaction check: ${name}`, `Pages: ${r.pages}. Versions in the file: ${r.revisions}.`, '']
  const byPage = new Map<number, Finding[]>()
  for (const f of r.findings) byPage.set(f.page, [...(byPage.get(f.page) ?? []), f])
  if (r.findings.length === 0) lines.push('No hidden or covered text found.')
  for (const [page, list] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`Page ${page}`)
    for (const f of list) lines.push(`  - ${KIND_TEXT[f.kind]}: ${f.text}${f.detail ? ` (${f.detail})` : ''}`)
    lines.push('')
  }
  const section = (title: string, items: string[]) => {
    lines.push(`${title}: ${items.length ? '' : 'none'}`)
    for (const i of items) lines.push(`  - ${i}`)
  }
  section('Document properties', r.properties.map((p) => `${p.label}: ${p.value}`))
  section('XMP metadata', r.xmp.map((p) => `${p.label}: ${p.value}`))
  section('Attachments', r.attachments.map((a) => `${a.name} (${a.size} bytes)${a.preview ? `: ${a.preview}` : ''}`))
  section('Bookmarks', r.bookmarks)
  section('Hidden layers', r.hiddenLayers)
  lines.push(`Scripts: ${r.scripts}`)
  return lines.join('\n')
}
