/**
 * A paginated table renderer built on pdf-lib's standard fonts. Private to the
 * `pdf-secure` batch; used by Excel to PDF and CSV to PDF.
 *
 * pdf-lib's built-in fonts are WinAnsi-encoded, which covers Western European
 * alphabets and nothing else, so text is sanitised (and the losses counted and
 * reported) rather than throwing halfway through a 500-row export.
 */
import type * as PdfLib from 'pdf-lib'

export interface SheetInput {
  name: string
  rows: string[][]
}

export type PageSizeId = 'a4' | 'letter' | 'legal' | 'a3'
export type Orientation = 'portrait' | 'landscape'

export interface TableRenderOptions {
  pageSize: PageSizeId
  orientation: Orientation
  /** Repeat the first row of each sheet at the top of every page. */
  repeatHeader: boolean
  /** Shrink columns proportionally so the widest table still fits the page. */
  fitToWidth: boolean
  fontSize: number
  gridLines: boolean
  zebra: boolean
  /** Print the sheet name above each table. */
  showSheetNames: boolean
  onProgress?: (done: number, total: number) => void | Promise<void>
}

export interface TableRenderReport {
  bytes: Uint8Array
  pages: number
  rows: number
  /** Characters replaced because the standard fonts cannot draw them. */
  replacedCharacters: number
  truncatedCells: number
}

const PAGE_SIZES: Record<PageSizeId, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
  a3: [841.89, 1190.55],
}

/** Codepoints above U+00FF that WinAnsi (cp1252) can still represent. */
const CP1252_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
])

export function sanitizeForStandardFont(input: string): { text: string; replaced: number } {
  let replaced = 0
  let out = ''
  for (const char of input) {
    const code = char.codePointAt(0) ?? 0
    if (code === 9) {
      out += '    '
      continue
    }
    if (code === 10 || code === 13) {
      out += ' '
      continue
    }
    if (code < 32) {
      replaced += 1
      continue
    }
    if (code <= 0xff || CP1252_EXTRA.has(code)) {
      out += char
      continue
    }
    replaced += 1
    out += '?'
  }
  return { text: out, replaced }
}

interface Measurer {
  width(text: string, size: number): number
}

function wrapCell(text: string, maxWidth: number, size: number, font: Measurer, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return { lines: [''], truncated: false }
  const lines: string[] = []
  let line = ''
  let truncated = false

  const pushLine = () => {
    if (line) lines.push(line)
    line = ''
  }

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.width(candidate, size) <= maxWidth) {
      line = candidate
      continue
    }
    if (line) pushLine()
    // A single word wider than the column: break it by characters.
    let chunk = ''
    for (const char of word) {
      if (font.width(chunk + char, size) > maxWidth && chunk) {
        lines.push(chunk)
        chunk = char
      } else {
        chunk += char
      }
    }
    line = chunk
    if (lines.length >= maxLines) break
  }
  pushLine()

  if (lines.length > maxLines) {
    truncated = true
    lines.length = maxLines
    const last = lines[maxLines - 1]
    lines[maxLines - 1] = `${last.slice(0, Math.max(0, last.length - 1))}…`
  }
  return { lines: lines.length > 0 ? lines : [''], truncated }
}

export async function renderTablesToPdf(
  lib: typeof PdfLib,
  sheets: SheetInput[],
  options: TableRenderOptions,
): Promise<TableRenderReport> {
  const { PDFDocument, StandardFonts, rgb } = lib
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const measureRegular: Measurer = { width: (t, s) => regular.widthOfTextAtSize(t, s) }
  const measureBold: Measurer = { width: (t, s) => bold.widthOfTextAtSize(t, s) }

  const base = PAGE_SIZES[options.pageSize]
  const [pageWidth, pageHeight] =
    options.orientation === 'landscape' ? [base[1], base[0]] : [base[0], base[1]]

  const margin = 36
  const usableWidth = pageWidth - margin * 2
  const size = options.fontSize
  const lineHeight = size * 1.25
  const cellPadX = 4
  const cellPadY = 3
  const maxLines = 4

  const ink = rgb(0.08, 0.09, 0.11)
  const rule = rgb(0.78, 0.79, 0.82)
  const zebraFill = rgb(0.955, 0.96, 0.97)
  const headerFill = rgb(0.9, 0.91, 0.93)

  let replacedCharacters = 0
  let truncatedCells = 0
  let totalRows = 0

  const totalUnits = sheets.reduce((sum, sheet) => sum + Math.max(1, sheet.rows.length), 0)
  let done = 0

  for (const sheet of sheets) {
    const cleanRows = sheet.rows.map((row) =>
      row.map((cell) => {
        const { text, replaced } = sanitizeForStandardFont(String(cell ?? ''))
        replacedCharacters += replaced
        return text
      }),
    )
    if (cleanRows.length === 0) continue
    totalRows += cleanRows.length

    const columnCount = cleanRows.reduce((max, row) => Math.max(max, row.length), 0)
    if (columnCount === 0) continue

    // Natural width = the widest cell, capped so one runaway column cannot
    // squeeze every other one into nothing.
    const natural: number[] = new Array<number>(columnCount).fill(0)
    const sampleLimit = Math.min(cleanRows.length, 400)
    for (let r = 0; r < sampleLimit; r++) {
      const row = cleanRows[r]
      for (let c = 0; c < columnCount; c++) {
        const text = row[c] ?? ''
        const measurer = r === 0 && options.repeatHeader ? measureBold : measureRegular
        natural[c] = Math.max(natural[c], measurer.width(text, size) + cellPadX * 2)
      }
    }
    const cap = usableWidth * 0.45
    for (let c = 0; c < columnCount; c++) natural[c] = Math.min(Math.max(natural[c], 24), cap)

    let widths = natural
    const naturalTotal = natural.reduce((a, b) => a + b, 0)
    if (options.fitToWidth || naturalTotal > usableWidth) {
      const factor = usableWidth / naturalTotal
      widths = natural.map((w) => w * factor)
    }

    let page = doc.addPage([pageWidth, pageHeight])
    let cursorY = pageHeight - margin

    const drawSheetTitle = () => {
      if (!options.showSheetNames) return
      const { text } = sanitizeForStandardFont(sheet.name)
      page.drawText(text, { x: margin, y: cursorY - size, size: size + 2, font: bold, color: ink })
      cursorY -= size + 10
    }

    const drawRow = (row: string[], isHeader: boolean, index: number, isRepeat = false) => {
      const font = isHeader ? bold : regular
      const measurer = isHeader ? measureBold : measureRegular
      const wrapped = widths.map((width, column) => {
        const cell = wrapCell(row[column] ?? '', width - cellPadX * 2, size, measurer, maxLines)
        if (cell.truncated) truncatedCells += 1
        return cell.lines
      })
      const lines = wrapped.reduce((max, cell) => Math.max(max, cell.length), 1)
      const rowHeight = lines * lineHeight + cellPadY * 2

      if (cursorY - rowHeight < margin && !isRepeat) {
        page = doc.addPage([pageWidth, pageHeight])
        cursorY = pageHeight - margin
        if (options.repeatHeader && !isHeader && cleanRows.length > 0) {
          drawRow(cleanRows[0], true, -1, true)
        }
      }

      const top = cursorY
      const bottom = cursorY - rowHeight

      if (isHeader) {
        page.drawRectangle({
          x: margin,
          y: bottom,
          width: usableWidth,
          height: rowHeight,
          color: headerFill,
        })
      } else if (options.zebra && index % 2 === 1) {
        page.drawRectangle({
          x: margin,
          y: bottom,
          width: usableWidth,
          height: rowHeight,
          color: zebraFill,
        })
      }

      let x = margin
      for (let c = 0; c < widths.length; c++) {
        const cellLines = wrapped[c]
        for (let l = 0; l < cellLines.length; l++) {
          page.drawText(cellLines[l], {
            x: x + cellPadX,
            y: top - cellPadY - lineHeight * (l + 1) + lineHeight * 0.28,
            size,
            font,
            color: ink,
          })
        }
        if (options.gridLines && c > 0) {
          page.drawLine({
            start: { x, y: top },
            end: { x, y: bottom },
            thickness: 0.4,
            color: rule,
          })
        }
        x += widths[c]
      }

      if (options.gridLines) {
        page.drawLine({
          start: { x: margin, y: bottom },
          end: { x: margin + usableWidth, y: bottom },
          thickness: 0.4,
          color: rule,
        })
      }

      cursorY = bottom
    }

    drawSheetTitle()
    for (let r = 0; r < cleanRows.length; r++) {
      const isHeader = options.repeatHeader && r === 0
      drawRow(cleanRows[r], isHeader, r)
      done += 1
      if (options.onProgress && (r % 40 === 0 || r === cleanRows.length - 1)) {
        await options.onProgress(done, totalUnits)
      }
    }
  }

  if (doc.getPageCount() === 0) doc.addPage([pageWidth, pageHeight])
  doc.setProducer('onthisdevice.com')

  return {
    bytes: await doc.save({ useObjectStreams: true }),
    pages: doc.getPageCount(),
    rows: totalRows,
    replacedCharacters,
    truncatedCells,
  }
}
