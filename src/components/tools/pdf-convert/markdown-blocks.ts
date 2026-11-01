/**
 * Markdown → RichBlock. We use marked purely as a lexer: its HTML renderer is
 * irrelevant here because the output is a PDF, so we walk the token tree and
 * emit typesetting instructions directly.
 */
import { marked, type Token, type Tokens } from 'marked'

import { mergeRuns, runsText, type RichBlock } from './rich-blocks'
import type { Run } from './pdf-layout'

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  copy: '©',
  reg: '®',
  trade: '™',
}

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match
    }
    return ENTITIES[body.toLowerCase()] ?? match
  })
}

function stripHtml(input: string): string {
  return decodeEntities(input.replace(/<[^>]*>/g, '')).trim()
}

interface InlineState {
  bold: boolean
  italic: boolean
  mono: boolean
}

function style(state: InlineState): Run['style'] {
  if (state.mono) return state.bold ? 'monoBold' : 'mono'
  if (state.bold && state.italic) return 'boldItalic'
  if (state.bold) return 'bold'
  if (state.italic) return 'italic'
  return 'regular'
}

export interface InlineOptions {
  /** Append the target of a link in parentheses — useful once it is on paper. */
  showLinkUrls: boolean
}

function walkInline(tokens: Token[], state: InlineState, out: Run[], options: InlineOptions, stats: Stats): void {
  for (const token of tokens) {
    switch (token.type) {
      case 'text': {
        const text = token as Tokens.Text
        if (text.tokens && text.tokens.length > 0) {
          walkInline(text.tokens, state, out, options, stats)
        } else {
          out.push({ text: decodeEntities(text.text), style: style(state) })
        }
        break
      }
      case 'escape':
        out.push({ text: (token as Tokens.Escape).text, style: style(state) })
        break
      case 'strong':
        walkInline((token as Tokens.Strong).tokens, { ...state, bold: true }, out, options, stats)
        break
      case 'em':
        walkInline((token as Tokens.Em).tokens, { ...state, italic: true }, out, options, stats)
        break
      case 'del':
        walkInline((token as Tokens.Del).tokens, state, out, options, stats)
        break
      case 'codespan':
        out.push({ text: decodeEntities((token as Tokens.Codespan).text), style: style({ ...state, mono: true }) })
        break
      case 'br':
        out.push({ text: '\n', style: style(state) })
        break
      case 'link': {
        const link = token as Tokens.Link
        walkInline(link.tokens, state, out, options, stats)
        const label = link.tokens.map((t) => ('text' in t ? String(t.text) : '')).join('')
        if (options.showLinkUrls && link.href && link.href !== label && !link.href.startsWith('#')) {
          out.push({ text: ` (${link.href})`, style: style({ ...state, mono: true }) })
        }
        break
      }
      case 'image':
        stats.images += 1
        break
      case 'html':
        out.push({ text: stripHtml((token as Tokens.HTML).text), style: style(state) })
        break
      default: {
        const generic = token as Tokens.Generic
        if (Array.isArray(generic.tokens)) {
          walkInline(generic.tokens, state, out, options, stats)
        } else if (typeof generic.text === 'string') {
          out.push({ text: decodeEntities(generic.text), style: style(state) })
        }
      }
    }
  }
}

function inlineRuns(tokens: Token[], options: InlineOptions, stats: Stats): Run[] {
  const out: Run[] = []
  walkInline(tokens, { bold: false, italic: false, mono: false }, out, options, stats)
  return mergeRuns(out)
}

interface Stats {
  images: number
  codeBlocks: number
  tables: number
}

const BULLETS = ['•', '–', '·']

function walkList(list: Tokens.List, depth: number, blocks: RichBlock[], options: InlineOptions, stats: Stats): void {
  const start = typeof list.start === 'number' && list.start > 0 ? list.start : 1
  list.items.forEach((item, index) => {
    const inline: Token[] = []
    const nested: Tokens.List[] = []
    for (const token of item.tokens) {
      if (token.type === 'list') {
        nested.push(token as Tokens.List)
      } else if (token.type === 'space') {
        continue
      } else {
        inline.push(token)
      }
    }

    const runs = inlineRuns(inline, options, stats)
    const marker = list.ordered ? `${start + index}.` : (BULLETS[depth % BULLETS.length] ?? '•')
    const prefix = item.task ? (item.checked ? '[x] ' : '[ ] ') : ''
    if (prefix !== '') runs.unshift({ text: prefix, style: 'mono' })
    if (runsText(runs).trim() !== '') {
      blocks.push({ kind: 'list-item', marker, depth, runs: mergeRuns(runs) })
    }
    for (const sub of nested) walkList(sub, depth + 1, blocks, options, stats)
  })
}

export interface MarkdownParseResult {
  blocks: RichBlock[]
  images: number
  codeBlocks: number
  tables: number
}

export function markdownToBlocks(source: string, options: InlineOptions): MarkdownParseResult {
  const stats: Stats = { images: 0, codeBlocks: 0, tables: 0 }
  const tokens = marked.lexer(source, { gfm: true, breaks: false })
  const blocks: RichBlock[] = []

  const walk = (list: Token[]): void => {
    for (const token of list) {
      switch (token.type) {
        case 'heading': {
          const heading = token as Tokens.Heading
          const runs = inlineRuns(heading.tokens, options, stats)
          if (runsText(runs).trim() !== '') blocks.push({ kind: 'heading', level: heading.depth, runs })
          break
        }
        case 'paragraph': {
          const paragraph = token as Tokens.Paragraph
          const runs = inlineRuns(paragraph.tokens, options, stats)
          if (runsText(runs).trim() !== '') blocks.push({ kind: 'paragraph', runs })
          break
        }
        case 'list':
          walkList(token as Tokens.List, 0, blocks, options, stats)
          break
        case 'code': {
          const code = token as Tokens.Code
          stats.codeBlocks += 1
          blocks.push({ kind: 'code', text: code.text })
          break
        }
        case 'blockquote': {
          const quote = token as Tokens.Blockquote
          const runs = inlineRuns(quote.tokens, options, stats)
          if (runsText(runs).trim() !== '') blocks.push({ kind: 'quote', runs })
          break
        }
        case 'hr':
          blocks.push({ kind: 'rule' })
          break
        case 'table': {
          const table = token as Tokens.Table
          stats.tables += 1
          const rows: { cells: string[]; header?: boolean }[] = []
          rows.push({ cells: table.header.map((cell) => runsText(inlineRuns(cell.tokens, options, stats))), header: true })
          for (const row of table.rows) {
            rows.push({ cells: row.map((cell) => runsText(inlineRuns(cell.tokens, options, stats))) })
          }
          blocks.push({ kind: 'table', rows })
          break
        }
        case 'html': {
          const text = stripHtml((token as Tokens.HTML).text)
          if (text !== '') blocks.push({ kind: 'paragraph', runs: [{ text, style: 'regular' }] })
          break
        }
        case 'space':
          break
        default: {
          const generic = token as Tokens.Generic
          if (Array.isArray(generic.tokens)) {
            const runs = inlineRuns(generic.tokens, options, stats)
            if (runsText(runs).trim() !== '') blocks.push({ kind: 'paragraph', runs })
          } else if (typeof generic.text === 'string' && generic.text.trim() !== '') {
            blocks.push({ kind: 'paragraph', runs: [{ text: decodeEntities(generic.text), style: 'regular' }] })
          }
        }
      }
    }
  }

  walk(tokens)
  return { blocks, images: stats.images, codeBlocks: stats.codeBlocks, tables: stats.tables }
}
