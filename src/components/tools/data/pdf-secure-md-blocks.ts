/**
 * Markdown → Word block model, private to the `pdf-secure` batch.
 * Uses the installed `marked` lexer so we inherit its GFM handling, then maps
 * its token tree onto the OOXML block list our writer understands.
 */
import type { Token, Tokens } from 'marked'
import type { DocxBlock, DocxRun } from './pdf-secure-docx'

type InlineStyle = Pick<DocxRun, 'bold' | 'italic' | 'strike' | 'code' | 'href'>

/** Tag names we recognise as real HTML rather than incidental angle brackets. */
const HTML_TAGS = new Set([
  'a', 'abbr', 'address', 'article', 'aside', 'audio', 'b', 'big', 'blockquote', 'br', 'button',
  'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd',
  'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption', 'figure',
  'font', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html',
  'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'mark',
  'meta', 'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'p', 'param', 'picture', 'pre',
  'progress', 'q', 's', 'samp', 'script', 'section', 'select', 'small', 'source', 'span', 'strike',
  'strong', 'style', 'sub', 'summary', 'sup', 'svg', 'table', 'tbody', 'td', 'template',
  'textarea', 'tfoot', 'th', 'thead', 'time', 'tr', 'tt', 'u', 'ul', 'var', 'video', 'wbr',
])

function isHtmlTag(raw: string): boolean {
  const match = /^<\/?\s*([a-zA-Z][\w:-]*)/.exec(raw.trim())
  return match ? HTML_TAGS.has(match[1].toLowerCase()) : /^<!--/.test(raw.trim())
}

function push(out: DocxRun[], text: string, style: InlineStyle) {
  if (text === '') return
  out.push({ text, ...style })
}

export function inlineRuns(tokens: Token[] | undefined, style: InlineStyle = {}): DocxRun[] {
  const out: DocxRun[] = []
  if (!tokens) return out

  for (const token of tokens) {
    switch (token.type) {
      case 'strong': {
        const t = token as Tokens.Strong
        out.push(...inlineRuns(t.tokens, { ...style, bold: true }))
        break
      }
      case 'em': {
        const t = token as Tokens.Em
        out.push(...inlineRuns(t.tokens, { ...style, italic: true }))
        break
      }
      case 'del': {
        const t = token as Tokens.Del
        out.push(...inlineRuns(t.tokens, { ...style, strike: true }))
        break
      }
      case 'codespan': {
        const t = token as Tokens.Codespan
        push(out, t.text, { ...style, code: true })
        break
      }
      case 'link': {
        const t = token as Tokens.Link
        const nested = inlineRuns(t.tokens, { ...style, href: t.href })
        if (nested.length > 0) out.push(...nested)
        else push(out, t.text, { ...style, href: t.href })
        break
      }
      case 'image': {
        const t = token as Tokens.Image
        push(out, t.text ? `[image: ${t.text}]` : '[image]', { ...style, italic: true })
        break
      }
      case 'br':
        out.push({ text: '', breakBefore: true })
        break
      case 'escape': {
        const t = token as Tokens.Escape
        push(out, t.text, style)
        break
      }
      case 'html': {
        // Markdown treats anything angle-bracketed as inline HTML, which means
        // `List<String>` and `<think>` arrive here alongside genuine `<sup>`
        // markup. Real tags are dropped (their text content arrives as its own
        // token); anything else is kept verbatim so content is never lost.
        const t = token as Tokens.HTML
        if (/^<br\s*\/?>$/i.test(t.text.trim())) {
          out.push({ text: '', breakBefore: true })
        } else if (!isHtmlTag(t.text)) {
          push(out, t.text, style)
        }
        break
      }
      case 'text':
      default: {
        const t = token as { text?: unknown; tokens?: Token[] }
        if (Array.isArray(t.tokens) && t.tokens.length > 0) {
          out.push(...inlineRuns(t.tokens, style))
        } else if (typeof t.text === 'string') {
          push(out, t.text, style)
        }
        break
      }
    }
  }
  return out
}

function listBlocks(list: Tokens.List, level: number, out: DocxBlock[]) {
  for (const item of list.items) {
    const inline: Token[] = []
    const nested: Tokens.List[] = []
    for (const child of item.tokens ?? []) {
      if (child.type === 'list') nested.push(child as Tokens.List)
      else inline.push(child)
    }
    const runs = inlineRuns(inline)
    const prefix: DocxRun[] =
      typeof item.checked === 'boolean'
        ? [{ text: item.checked ? '☑ ' : '☐ ' }]
        : []
    out.push({
      kind: 'listItem',
      ordered: list.ordered === true,
      level,
      runs: [...prefix, ...(runs.length > 0 ? runs : [{ text: '' }])],
    })
    for (const child of nested) listBlocks(child, level + 1, out)
  }
}

export function markdownToBlocks(markdownTokens: Token[]): DocxBlock[] {
  const out: DocxBlock[] = []

  for (const token of markdownTokens) {
    switch (token.type) {
      case 'heading': {
        const t = token as Tokens.Heading
        out.push({ kind: 'heading', level: t.depth, runs: inlineRuns(t.tokens) })
        break
      }
      case 'paragraph': {
        const t = token as Tokens.Paragraph
        out.push({ kind: 'paragraph', runs: inlineRuns(t.tokens) })
        break
      }
      case 'list':
        listBlocks(token as Tokens.List, 0, out)
        break
      case 'code': {
        const t = token as Tokens.Code
        out.push({ kind: 'code', text: t.text })
        break
      }
      case 'blockquote': {
        const t = token as Tokens.Blockquote
        for (const child of t.tokens ?? []) {
          if (child.type === 'paragraph' || child.type === 'text') {
            const inner = child as Tokens.Paragraph
            out.push({ kind: 'quote', runs: inlineRuns(inner.tokens) })
          } else {
            out.push(...markdownToBlocks([child]))
          }
        }
        break
      }
      case 'hr':
        out.push({ kind: 'rule' })
        break
      case 'table': {
        const t = token as Tokens.Table
        out.push({
          kind: 'table',
          header: t.header.map((cell) => inlineRuns(cell.tokens)),
          rows: t.rows.map((row) => row.map((cell) => inlineRuns(cell.tokens))),
        })
        break
      }
      case 'html': {
        const t = token as Tokens.HTML
        const text = t.text.replace(/<[^>]*>/g, '').trim()
        if (text) out.push({ kind: 'paragraph', runs: [{ text }] })
        break
      }
      case 'space':
        break
      default: {
        const t = token as { text?: unknown }
        if (typeof t.text === 'string' && t.text.trim()) {
          out.push({ kind: 'paragraph', runs: [{ text: t.text }] })
        }
        break
      }
    }
  }

  return out
}

/** Plain text → blocks. Blank lines split paragraphs; single newlines can wrap. */
export function plainTextToBlocks(
  text: string,
  options: { softBreaks: boolean; autoHeadings: boolean },
): DocxBlock[] {
  const normalised = text.replace(/\r\n?/g, '\n')
  const chunks = normalised.split(/\n{2,}/)
  const out: DocxBlock[] = []

  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (!trimmed) continue

    // A lone short line in capitals, with no sentence punctuation, is almost
    // always a section heading in a pasted plain-text document.
    if (
      options.autoHeadings &&
      !trimmed.includes('\n') &&
      trimmed.length <= 80 &&
      !/[.:;,!?]$/.test(trimmed) &&
      /[A-Z]/.test(trimmed) &&
      trimmed === trimmed.toUpperCase()
    ) {
      out.push({ kind: 'heading', level: 2, runs: [{ text: trimmed }] })
      continue
    }

    const bullet = /^\s*[-*•]\s+/
    const lines = trimmed.split('\n')
    if (lines.every((line) => bullet.test(line))) {
      for (const line of lines) {
        out.push({
          kind: 'listItem',
          ordered: false,
          level: 0,
          runs: [{ text: line.replace(bullet, '') }],
        })
      }
      continue
    }

    if (options.softBreaks) {
      const runs: DocxRun[] = []
      lines.forEach((line, index) => {
        if (index > 0) runs.push({ text: '', breakBefore: true })
        runs.push({ text: line })
      })
      out.push({ kind: 'paragraph', runs })
    } else {
      out.push({ kind: 'paragraph', runs: [{ text: lines.join(' ') }] })
    }
  }

  return out
}
