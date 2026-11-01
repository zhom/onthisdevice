/**
 * A small, honest text-layout engine on top of pdf-lib.
 *
 * pdf-lib draws strings at coordinates; it has no concept of a paragraph, a
 * line break or a page overflow. Everything below adds exactly that: word
 * wrapping with real font metrics, inline bold/italic runs, headings, bullet
 * and numbered lists, code blocks, blockquotes, rules and automatic pagination.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'

export type { PageSize } from './pdf-common'
export { PAGE_SIZES, pageSizeById, MM_PER_PT, mmToPt, toBlob, sanitizeForStandardFont } from './pdf-common'
export type { SanitizeResult } from './pdf-common'
import type { PageSize } from './pdf-common'

/* ----------------------------------------------------------------- fonts */

export type FontStyle = 'regular' | 'bold' | 'italic' | 'boldItalic' | 'mono' | 'monoBold'

export type FontFamily = 'helvetica' | 'times' | 'courier'

export interface FontSet {
  regular: PDFFont
  bold: PDFFont
  italic: PDFFont
  boldItalic: PDFFont
  mono: PDFFont
  monoBold: PDFFont
}

const FAMILY_FONTS: Record<FontFamily, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
  helvetica: [
    StandardFonts.Helvetica,
    StandardFonts.HelveticaBold,
    StandardFonts.HelveticaOblique,
    StandardFonts.HelveticaBoldOblique,
  ],
  times: [
    StandardFonts.TimesRoman,
    StandardFonts.TimesRomanBold,
    StandardFonts.TimesRomanItalic,
    StandardFonts.TimesRomanBoldItalic,
  ],
  courier: [
    StandardFonts.Courier,
    StandardFonts.CourierBold,
    StandardFonts.CourierOblique,
    StandardFonts.CourierBoldOblique,
  ],
}

export async function embedFonts(doc: PDFDocument, family: FontFamily = 'helvetica'): Promise<FontSet> {
  const [reg, bold, italic, boldItalic] = FAMILY_FONTS[family]
  const [regular, boldFont, italicFont, boldItalicFont, mono, monoBold] = await Promise.all([
    doc.embedFont(reg),
    doc.embedFont(bold),
    doc.embedFont(italic),
    doc.embedFont(boldItalic),
    doc.embedFont(StandardFonts.Courier),
    doc.embedFont(StandardFonts.CourierBold),
  ])
  return { regular, bold: boldFont, italic: italicFont, boldItalic: boldItalicFont, mono, monoBold }
}

export function fontFor(fonts: FontSet, style: FontStyle): PDFFont {
  return fonts[style]
}

/* ------------------------------------------------------------- wrapping */

export interface Run {
  text: string
  style: FontStyle
}

interface Word {
  text: string
  style: FontStyle
  width: number
}

export type Line = Word[]

function measure(font: PDFFont, text: string, size: number): number {
  if (text === '') return 0
  try {
    return font.widthOfTextAtSize(text, size)
  } catch {
    return text.length * size * 0.5
  }
}

/** Break a single over-long token (a URL, a hash) so it can never overflow. */
function breakLongWord(word: Word, size: number, fonts: FontSet, maxWidth: number): Word[] {
  const font = fontFor(fonts, word.style)
  const pieces: Word[] = []
  let buffer = ''
  for (const ch of word.text) {
    const candidate = buffer + ch
    if (buffer !== '' && measure(font, candidate, size) > maxWidth) {
      pieces.push({ text: buffer, style: word.style, width: measure(font, buffer, size) })
      buffer = ch
    } else {
      buffer = candidate
    }
  }
  if (buffer !== '') pieces.push({ text: buffer, style: word.style, width: measure(font, buffer, size) })
  return pieces
}

/**
 * Greedy word wrap over styled runs. Newlines inside a run are honoured as
 * hard breaks, so preformatted text keeps its shape.
 */
export function wrapRuns(runs: Run[], fonts: FontSet, size: number, maxWidth: number): Line[] {
  const lines: Line[] = []
  let line: Line = []
  let width = 0

  const pushLine = () => {
    lines.push(line)
    line = []
    width = 0
  }

  for (const run of runs) {
    const segments = run.text.split('\n')
    for (let s = 0; s < segments.length; s++) {
      if (s > 0) pushLine()
      const segment = segments[s] ?? ''
      const tokens = segment.split(/(\s+)/).filter((t) => t !== '')
      for (const token of tokens) {
        if (/^\s+$/.test(token)) {
          if (line.length > 0) {
            const spaceWidth = measure(fontFor(fonts, run.style), ' ', size)
            line.push({ text: ' ', style: run.style, width: spaceWidth })
            width += spaceWidth
          }
          continue
        }
        const font = fontFor(fonts, run.style)
        let word: Word = { text: token, style: run.style, width: measure(font, token, size) }
        if (word.width > maxWidth) {
          const pieces = breakLongWord(word, size, fonts, maxWidth)
          for (const piece of pieces) {
            if (width + piece.width > maxWidth && line.length > 0) pushLine()
            line.push(piece)
            width += piece.width
          }
          continue
        }
        if (width + word.width > maxWidth && line.length > 0) {
          // Drop a trailing space before wrapping.
          while (line.length > 0 && line[line.length - 1]!.text === ' ') line.pop()
          pushLine()
          word = { ...word }
        }
        line.push(word)
        width += word.width
      }
    }
  }
  pushLine()

  return lines.map((l) => {
    const copy = [...l]
    while (copy.length > 0 && copy[copy.length - 1]!.text === ' ') copy.pop()
    return copy
  })
}

export function wrapPlainText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = []
  for (const rawLine of text.split('\n')) {
    if (rawLine.trim() === '') {
      out.push('')
      continue
    }
    const words = rawLine.split(/\s+/).filter((w) => w !== '')
    let current = ''
    for (const wordRaw of words) {
      let word = wordRaw
      while (measure(font, word, size) > maxWidth) {
        // Hard-break a token wider than the whole column.
        let cut = 1
        while (cut < word.length && measure(font, word.slice(0, cut + 1), size) <= maxWidth) cut++
        if (current !== '') {
          out.push(current)
          current = ''
        }
        out.push(word.slice(0, cut))
        word = word.slice(cut)
      }
      const candidate = current === '' ? word : `${current} ${word}`
      if (measure(font, candidate, size) > maxWidth && current !== '') {
        out.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    out.push(current)
  }
  return out
}

/* ------------------------------------------------------------ the writer */

export interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface WriterOptions {
  size: PageSize
  margins: Margins
  /** Multiplier applied to the font size to get the baseline-to-baseline step. */
  lineHeight: number
  fonts: FontSet
  pageNumbers?: boolean
  pageNumberLabel?: (page: number, total: number) => string
}

const INK = rgb(0.09, 0.1, 0.13)
const MUTED = rgb(0.42, 0.45, 0.5)
const RULE = rgb(0.82, 0.84, 0.87)
const CODE_BG = rgb(0.96, 0.965, 0.975)
const QUOTE_BAR = rgb(0.65, 0.68, 0.73)

/**
 * Sequential PDF writer: you push blocks, it paginates. Coordinates are
 * PDF-native (origin bottom-left) but the cursor counts down from the top,
 * which is far easier to reason about.
 */
export class PdfWriter {
  readonly doc: PDFDocument
  readonly fonts: FontSet
  private readonly opts: WriterOptions
  private pages: PDFPage[] = []
  private page: PDFPage
  private cursor: number

  constructor(doc: PDFDocument, opts: WriterOptions) {
    this.doc = doc
    this.opts = opts
    this.fonts = opts.fonts
    this.page = this.addPage()
    this.cursor = this.top
  }

  static async create(opts: Omit<WriterOptions, 'fonts'> & { family?: FontFamily }): Promise<PdfWriter> {
    const doc = await PDFDocument.create()
    const fonts = await embedFonts(doc, opts.family ?? 'helvetica')
    return new PdfWriter(doc, { ...opts, fonts })
  }

  get contentWidth(): number {
    return this.opts.size.width - this.opts.margins.left - this.opts.margins.right
  }

  get top(): number {
    return this.opts.size.height - this.opts.margins.top
  }

  get bottom(): number {
    return this.opts.margins.bottom
  }

  get pageCount(): number {
    return this.pages.length
  }

  /** Vertical space still available on the current page. */
  get remaining(): number {
    return this.cursor - this.bottom
  }

  private addPage(): PDFPage {
    const page = this.doc.addPage([this.opts.size.width, this.opts.size.height])
    this.pages.push(page)
    return page
  }

  newPage(): void {
    this.page = this.addPage()
    this.cursor = this.top
  }

  /** Start a new page unless the current one is still empty. */
  pageBreak(): void {
    if (this.cursor < this.top) this.newPage()
  }

  ensure(height: number): void {
    if (this.cursor - height < this.bottom) this.newPage()
  }

  space(height: number): void {
    if (this.cursor - height < this.bottom) {
      this.newPage()
    } else {
      this.cursor -= height
    }
  }

  /** Draw wrapped, styled lines. Returns the height consumed. */
  writeLines(
    lines: Line[],
    opts: {
      size: number
      lineHeight?: number
      indent?: number
      color?: RGB
      firstLinePrefix?: { text: string; style?: FontStyle; color?: RGB }
      keepWithNext?: boolean
    },
  ): void {
    const step = opts.size * (opts.lineHeight ?? this.opts.lineHeight)
    const indent = opts.indent ?? 0
    const color = opts.color ?? INK
    const x0 = this.opts.margins.left + indent

    if (opts.keepWithNext) this.ensure(step * Math.min(lines.length, 2))

    lines.forEach((line, index) => {
      this.ensure(step)
      const baseline = this.cursor - opts.size
      let x = x0

      if (index === 0 && opts.firstLinePrefix) {
        const prefixFont = fontFor(this.fonts, opts.firstLinePrefix.style ?? 'regular')
        this.page.drawText(opts.firstLinePrefix.text, {
          x: x - measure(prefixFont, opts.firstLinePrefix.text, opts.size) - opts.size * 0.35,
          y: baseline,
          size: opts.size,
          font: prefixFont,
          color: opts.firstLinePrefix.color ?? color,
        })
      }

      for (const word of line) {
        if (word.text !== ' ') {
          this.page.drawText(word.text, {
            x,
            y: baseline,
            size: opts.size,
            font: fontFor(this.fonts, word.style),
            color,
          })
        }
        x += word.width
      }
      this.cursor -= step
    })
  }

  /** Convenience: wrap a set of runs to the column width, then draw them. */
  writeRuns(
    runs: Run[],
    opts: {
      size: number
      lineHeight?: number
      indent?: number
      color?: RGB
      firstLinePrefix?: { text: string; style?: FontStyle; color?: RGB }
      keepWithNext?: boolean
    },
  ): void {
    const indent = opts.indent ?? 0
    const lines = wrapRuns(runs, this.fonts, opts.size, this.contentWidth - indent)
    this.writeLines(lines, opts)
  }

  writeParagraph(text: string, size: number, style: FontStyle = 'regular'): void {
    this.writeRuns([{ text, style }], { size })
  }

  /** A monospaced block on a tinted panel, wrapped to the column. */
  writeCodeBlock(code: string, size: number): void {
    const padding = size * 0.7
    const step = size * 1.35
    const lines = wrapPlainText(code.replace(/\n+$/, ''), this.fonts.mono, size, this.contentWidth - padding * 2)

    let index = 0
    while (index < lines.length) {
      this.ensure(step * 2 + padding * 2)
      const available = Math.max(1, Math.floor((this.remaining - padding * 2) / step))
      const chunk = lines.slice(index, index + available)
      const blockHeight = chunk.length * step + padding * 2

      this.page.drawRectangle({
        x: this.opts.margins.left,
        y: this.cursor - blockHeight,
        width: this.contentWidth,
        height: blockHeight,
        color: CODE_BG,
        borderColor: RULE,
        borderWidth: 0.5,
      })

      let y = this.cursor - padding - size
      for (const line of chunk) {
        if (line !== '') {
          this.page.drawText(line, {
            x: this.opts.margins.left + padding,
            y,
            size,
            font: this.fonts.mono,
            color: INK,
          })
        }
        y -= step
      }
      this.cursor -= blockHeight
      index += chunk.length
      if (index < lines.length) this.newPage()
    }
  }

  writeBlockquote(runs: Run[], size: number): void {
    const indent = size * 1.6
    const startCursor = this.cursor
    const startPage = this.page
    this.writeRuns(runs, { size, indent, color: MUTED })
    if (this.page === startPage) {
      startPage.drawRectangle({
        x: this.opts.margins.left,
        y: this.cursor,
        width: 2.5,
        height: startCursor - this.cursor,
        color: QUOTE_BAR,
      })
    }
  }

  writeRule(): void {
    this.ensure(14)
    this.cursor -= 7
    this.page.drawLine({
      start: { x: this.opts.margins.left, y: this.cursor },
      end: { x: this.opts.size.width - this.opts.margins.right, y: this.cursor },
      thickness: 0.75,
      color: RULE,
    })
    this.cursor -= 7
  }

  /**
   * A deliberately simple table: proportional column widths derived from the
   * content length, wrapped cells, a bold header row and hairline rules. Rows
   * are atomic — a row that will not fit starts the next page.
   */
  writeTable(rows: { cells: string[]; header?: boolean }[], size: number): void {
    const validRows = rows.filter((row) => row.cells.length > 0)
    if (validRows.length === 0) return

    const columns = Math.max(...validRows.map((row) => row.cells.length))
    const weights = new Array<number>(columns).fill(4)
    for (const row of validRows) {
      row.cells.forEach((cell, i) => {
        weights[i] = Math.max(weights[i] ?? 4, Math.min(cell.length, 48))
      })
    }
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    const widths = weights.map((w) => (w / totalWeight) * this.contentWidth)
    const padding = size * 0.45
    const step = size * 1.35

    for (const row of validRows) {
      const style: FontStyle = row.header ? 'bold' : 'regular'
      const font = fontFor(this.fonts, style)
      const cellLines = Array.from({ length: columns }, (_, i) =>
        wrapPlainText(row.cells[i] ?? '', font, size, Math.max(10, (widths[i] ?? 0) - padding * 2)),
      )
      const lineCount = Math.max(1, ...cellLines.map((lines) => lines.length))
      const rowHeight = lineCount * step + padding * 2
      this.ensure(rowHeight)

      const topY = this.cursor
      let x = this.opts.margins.left
      cellLines.forEach((lines, i) => {
        let y = topY - padding - size
        for (const line of lines) {
          if (line !== '') {
            this.page.drawText(line, { x: x + padding, y, size, font, color: INK })
          }
          y -= step
        }
        x += widths[i] ?? 0
      })

      this.cursor -= rowHeight
      this.page.drawLine({
        start: { x: this.opts.margins.left, y: this.cursor },
        end: { x: this.opts.size.width - this.opts.margins.right, y: this.cursor },
        thickness: row.header ? 0.9 : 0.4,
        color: RULE,
      })
    }
    this.cursor -= size * 0.6
  }

  private stampPageNumbers(): void {
    if (!this.opts.pageNumbers) return
    const total = this.pages.length
    const label = this.opts.pageNumberLabel ?? ((n: number, t: number) => `${n} / ${t}`)
    this.pages.forEach((page, i) => {
      const text = label(i + 1, total)
      const width = measure(this.fonts.regular, text, 9)
      page.drawText(text, {
        x: (this.opts.size.width - width) / 2,
        y: Math.max(12, this.opts.margins.bottom / 2 - 4),
        size: 9,
        font: this.fonts.regular,
        color: MUTED,
      })
    })
  }

  async save(meta?: { title?: string; author?: string }): Promise<Uint8Array> {
    this.stampPageNumbers()
    if (meta?.title) this.doc.setTitle(meta.title)
    if (meta?.author) this.doc.setAuthor(meta.author)
    this.doc.setProducer('onthisdevice.com')
    this.doc.setCreator('onthisdevice.com')
    this.doc.setCreationDate(new Date())
    return this.doc.save()
  }
}

export const COLORS = { INK, MUTED, RULE }
