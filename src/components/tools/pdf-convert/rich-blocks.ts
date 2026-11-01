/**
 * A tiny document model that sits between an input format (HTML from Mammoth,
 * tokens from marked) and the PDF writer, so both converters share one
 * typesetting implementation.
 */
import { sanitizeForStandardFont } from './pdf-common'
import type { FontStyle, PdfWriter, Run } from './pdf-layout'

export type RichBlock =
  | { kind: 'heading'; level: number; runs: Run[] }
  | { kind: 'paragraph'; runs: Run[] }
  | { kind: 'list-item'; marker: string; depth: number; runs: Run[] }
  | { kind: 'quote'; runs: Run[] }
  | { kind: 'code'; text: string }
  | { kind: 'rule' }
  | { kind: 'table'; rows: { cells: string[]; header?: boolean }[] }

interface InlineState {
  bold: boolean
  italic: boolean
  mono: boolean
}

export function styleFor(state: InlineState): FontStyle {
  if (state.mono) return state.bold ? 'monoBold' : 'mono'
  if (state.bold && state.italic) return 'boldItalic'
  if (state.bold) return 'bold'
  if (state.italic) return 'italic'
  return 'regular'
}

/** Collapse runs that share a style so the wrapper has less to do. */
export function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = []
  for (const run of runs) {
    if (run.text === '') continue
    const last = out[out.length - 1]
    if (last && last.style === run.style) {
      last.text += run.text
    } else {
      out.push({ ...run })
    }
  }
  return out
}

export function runsText(runs: Run[]): string {
  return runs.map((run) => run.text).join('')
}

/* ------------------------------------------------------------------ HTML */

const BOLD_TAGS = new Set(['STRONG', 'B'])
const ITALIC_TAGS = new Set(['EM', 'I'])
const MONO_TAGS = new Set(['CODE', 'KBD', 'SAMP', 'TT'])

function collectInline(node: Node, state: InlineState, out: Run[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ')
    if (text !== '') out.push({ text, style: styleFor(state) })
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as Element
  const tag = el.tagName.toUpperCase()

  if (tag === 'BR') {
    out.push({ text: '\n', style: styleFor(state) })
    return
  }
  if (tag === 'IMG') return

  const next: InlineState = {
    bold: state.bold || BOLD_TAGS.has(tag),
    italic: state.italic || ITALIC_TAGS.has(tag),
    mono: state.mono || MONO_TAGS.has(tag),
  }
  el.childNodes.forEach((child) => collectInline(child, next, out))
}

function inlineRuns(el: Element): Run[] {
  const out: Run[] = []
  el.childNodes.forEach((child) => collectInline(child, { bold: false, italic: false, mono: false }, out))
  return mergeRuns(out)
}

const LIST_MARKERS = ['•', '–', '·']

function walkList(list: Element, ordered: boolean, depth: number, blocks: RichBlock[]): void {
  let index = Number(list.getAttribute('start') ?? '1')
  if (!Number.isFinite(index) || index < 1) index = 1

  for (const child of Array.from(list.children)) {
    if (child.tagName.toUpperCase() !== 'LI') continue
    const nested: Element[] = []
    const holder = child.ownerDocument.createElement('div')
    for (const node of Array.from(child.childNodes)) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        ['UL', 'OL'].includes((node as Element).tagName.toUpperCase())
      ) {
        nested.push(node as Element)
      } else {
        holder.appendChild(node.cloneNode(true))
      }
    }
    const runs = inlineRuns(holder)
    const marker = ordered ? `${index}.` : (LIST_MARKERS[depth % LIST_MARKERS.length] ?? '•')
    if (runs.length > 0) blocks.push({ kind: 'list-item', marker, depth, runs })
    index += 1
    for (const sub of nested) {
      walkList(sub, sub.tagName.toUpperCase() === 'OL', depth + 1, blocks)
    }
  }
}

function walkElement(el: Element, blocks: RichBlock[]): void {
  const tag = el.tagName.toUpperCase()

  switch (tag) {
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6': {
      const runs = inlineRuns(el)
      if (runs.length > 0) blocks.push({ kind: 'heading', level: Number(tag[1]), runs })
      return
    }
    case 'P': {
      const runs = inlineRuns(el)
      if (runsText(runs).trim() !== '') blocks.push({ kind: 'paragraph', runs })
      return
    }
    case 'UL':
      walkList(el, false, 0, blocks)
      return
    case 'OL':
      walkList(el, true, 0, blocks)
      return
    case 'BLOCKQUOTE': {
      const runs = inlineRuns(el)
      if (runsText(runs).trim() !== '') blocks.push({ kind: 'quote', runs })
      return
    }
    case 'PRE': {
      const text = el.textContent ?? ''
      if (text.trim() !== '') blocks.push({ kind: 'code', text })
      return
    }
    case 'HR':
      blocks.push({ kind: 'rule' })
      return
    case 'TABLE': {
      const rows: { cells: string[]; header?: boolean }[] = []
      for (const tr of Array.from(el.querySelectorAll('tr'))) {
        const cells = Array.from(tr.children).map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())
        if (cells.length === 0) continue
        const header = Array.from(tr.children).some((cell) => cell.tagName.toUpperCase() === 'TH')
        rows.push({ cells, header })
      }
      if (rows.length > 0) blocks.push({ kind: 'table', rows })
      return
    }
    case 'IMG':
    case 'SCRIPT':
    case 'STYLE':
      return
    default: {
      const hasBlockChildren = Array.from(el.children).some((child) =>
        ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'TABLE', 'PRE', 'BLOCKQUOTE', 'HR', 'DIV'].includes(
          child.tagName.toUpperCase(),
        ),
      )
      if (hasBlockChildren) {
        for (const child of Array.from(el.children)) walkElement(child, blocks)
      } else {
        const runs = inlineRuns(el)
        if (runsText(runs).trim() !== '') blocks.push({ kind: 'paragraph', runs })
      }
    }
  }
}

export interface HtmlParseResult {
  blocks: RichBlock[]
  /** Number of <img> elements we had to skip. */
  images: number
  tables: number
}

export function htmlToBlocks(html: string): HtmlParseResult {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const blocks: RichBlock[] = []
  for (const child of Array.from(doc.body.children)) walkElement(child, blocks)
  return {
    blocks,
    images: doc.body.querySelectorAll('img').length,
    tables: doc.body.querySelectorAll('table').length,
  }
}

/* --------------------------------------------------------------- render */

const HEADING_SCALE = [1.95, 1.55, 1.3, 1.15, 1.05, 1.0]

export interface RenderResult {
  /** Characters replaced because the standard PDF fonts cannot encode them. */
  dropped: number
}

/** Typeset a block list into a PdfWriter. */
export function renderBlocks(writer: PdfWriter, blocks: RichBlock[], baseSize: number): RenderResult {
  let dropped = 0

  const clean = (runs: Run[]): Run[] =>
    mergeRuns(
      runs.map((run) => {
        const result = sanitizeForStandardFont(run.text)
        dropped += result.dropped
        return { text: result.text, style: run.style }
      }),
    )

  const cleanText = (text: string): string => {
    const result = sanitizeForStandardFont(text)
    dropped += result.dropped
    return result.text
  }

  blocks.forEach((block, index) => {
    const previous = blocks[index - 1]
    switch (block.kind) {
      case 'heading': {
        const scale = HEADING_SCALE[Math.min(block.level, 6) - 1] ?? 1
        const size = baseSize * scale
        if (previous) writer.space(size * 0.55)
        writer.writeRuns(
          clean(block.runs).map((run) => ({ ...run, style: run.style === 'regular' ? 'bold' : run.style })),
          { size, lineHeight: 1.22, keepWithNext: true },
        )
        writer.space(size * 0.22)
        return
      }
      case 'paragraph': {
        writer.writeRuns(clean(block.runs), { size: baseSize })
        writer.space(baseSize * 0.5)
        return
      }
      case 'list-item': {
        writer.writeRuns(clean(block.runs), {
          size: baseSize,
          indent: baseSize * 1.4 + block.depth * baseSize * 1.3,
          firstLinePrefix: { text: cleanText(block.marker), style: 'regular' },
        })
        writer.space(baseSize * 0.22)
        return
      }
      case 'quote': {
        writer.space(baseSize * 0.25)
        writer.writeBlockquote(clean(block.runs), baseSize)
        writer.space(baseSize * 0.5)
        return
      }
      case 'code': {
        writer.space(baseSize * 0.25)
        writer.writeCodeBlock(cleanText(block.text), baseSize * 0.85)
        writer.space(baseSize * 0.6)
        return
      }
      case 'rule': {
        writer.space(baseSize * 0.35)
        writer.writeRule()
        writer.space(baseSize * 0.35)
        return
      }
      case 'table': {
        writer.space(baseSize * 0.3)
        writer.writeTable(
          block.rows.map((row) => ({ cells: row.cells.map(cleanText), header: row.header })),
          baseSize * 0.9,
        )
        writer.space(baseSize * 0.4)
      }
    }
  })

  return { dropped }
}
