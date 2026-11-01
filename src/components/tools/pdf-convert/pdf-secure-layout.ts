/**
 * Layout inference over a pdf.js text layer, private to the `pdf-secure` batch.
 *
 * A PDF has no paragraphs, no headings and no tables — only glyphs at
 * coordinates. Everything below reconstructs structure from geometry: line
 * grouping by baseline, word gaps from advance widths, headings from the font
 * size distribution, and columns from a histogram of fragment start positions.
 */

export interface TextPiece {
  text: string
  x: number
  y: number
  width: number
  size: number
  bold: boolean
  italic: boolean
  mono: boolean
}

export interface Line {
  y: number
  x0: number
  x1: number
  size: number
  bold: boolean
  mono: boolean
  text: string
  /** Fragments split at visually significant gaps — the raw material for tables. */
  cells: { x: number; text: string }[]
}

export interface PageLayout {
  index: number
  width: number
  height: number
  lines: Line[]
}

interface FontFacts {
  bold: boolean
  italic: boolean
  mono: boolean
}

interface RawItem {
  str: string
  transform: number[]
  width: number
  height: number
  fontName: string
  hasEOL: boolean
}

function isRawItem(value: unknown): value is RawItem {
  return typeof value === 'object' && value !== null && 'transform' in value && 'str' in value
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Guess bold/italic/monospace from whatever pdf.js can tell us about a font. */
function factsFor(name: string, family: string): FontFacts {
  const n = `${name} ${family}`.toLowerCase()
  return {
    bold: /bold|black|heavy|semibold|demibold|[-_,]bd\b/.test(n),
    italic: /italic|oblique|[-_,]it\b/.test(n),
    mono: /mono|courier|consol|menlo/.test(n),
  }
}

export interface ExtractOptions {
  /** Resolve real font names so bold and italic survive. Costs an operator list per page. */
  detectFonts?: boolean
  onProgress?: (page: number, total: number) => void | Promise<void>
}

interface PdfJsLikePage {
  getViewport(params: { scale: number }): { width: number; height: number }
  getTextContent(): Promise<{ items: unknown[]; styles: Record<string, { fontFamily?: string }> }>
  getOperatorList(): Promise<unknown>
  commonObjs: { has(id: string): boolean; get(id: string): unknown }
  cleanup(): void
}

interface PdfJsLikeDocument {
  numPages: number
  getPage(n: number): Promise<PdfJsLikePage>
}

/** Build a geometric line model for every page of an open pdf.js document. */
export async function extractLayout(
  doc: PdfJsLikeDocument,
  options: ExtractOptions = {},
): Promise<PageLayout[]> {
  const pages: PageLayout[] = []
  const total = doc.numPages

  for (let n = 1; n <= total; n++) {
    const page = await doc.getPage(n)
    const viewport = page.getViewport({ scale: 1 })

    const fontFacts = new Map<string, FontFacts>()
    if (options.detectFonts) {
      try {
        await page.getOperatorList()
      } catch {
        /* Font names are a nicety; carry on without them. */
      }
    }

    const content = await page.getTextContent()
    const styles = content.styles ?? {}

    const pieces: TextPiece[] = []
    for (const raw of content.items) {
      if (!isRawItem(raw)) continue
      if (!raw.str || raw.str.trim() === '') continue
      const t = raw.transform
      const size = Math.abs(raw.height) || Math.hypot(t[1], t[3]) || 10

      let facts = fontFacts.get(raw.fontName)
      if (!facts) {
        let realName = ''
        if (options.detectFonts && page.commonObjs.has(raw.fontName)) {
          try {
            const font = page.commonObjs.get(raw.fontName) as
              | { name?: string; bold?: boolean; italic?: boolean }
              | undefined
            if (font) {
              realName = typeof font.name === 'string' ? font.name : ''
              const family = styles[raw.fontName]?.fontFamily ?? ''
              const derived = factsFor(realName, family)
              facts = {
                bold: font.bold === true || derived.bold,
                italic: font.italic === true || derived.italic,
                mono: derived.mono,
              }
            }
          } catch {
            /* ignore */
          }
        }
        if (!facts) facts = factsFor(realName, styles[raw.fontName]?.fontFamily ?? '')
        fontFacts.set(raw.fontName, facts)
      }

      pieces.push({
        text: raw.str,
        x: t[4],
        y: t[5],
        width: raw.width,
        size,
        bold: facts.bold,
        italic: facts.italic,
        mono: facts.mono,
      })
    }

    pages.push({
      index: n,
      width: viewport.width,
      height: viewport.height,
      lines: groupLines(pieces),
    })

    page.cleanup()
    if (options.onProgress) await options.onProgress(n, total)
  }

  return pages
}

/** Cluster pieces into baselines, then into words and gap-separated cells. */
export function groupLines(pieces: TextPiece[]): Line[] {
  if (pieces.length === 0) return []
  const typical = median(pieces.map((p) => p.size)) || 10
  const tolerance = Math.max(1.2, typical * 0.4)

  const sorted = [...pieces].sort((a, b) => (b.y === a.y ? a.x - b.x : b.y - a.y))
  const buckets: TextPiece[][] = []
  let current: TextPiece[] = []
  let currentY = Number.NaN

  for (const piece of sorted) {
    if (current.length === 0 || Math.abs(piece.y - currentY) <= tolerance) {
      if (current.length === 0) currentY = piece.y
      current.push(piece)
    } else {
      buckets.push(current)
      current = [piece]
      currentY = piece.y
    }
  }
  if (current.length > 0) buckets.push(current)

  return buckets.map((bucket) => {
    const ordered = [...bucket].sort((a, b) => a.x - b.x)
    const size = median(ordered.map((p) => p.size)) || typical
    const spaceWidth = size * 0.28

    let text = ''
    const cells: { x: number; text: string }[] = []
    let cellText = ''
    let cellX = ordered[0].x
    let cursor = Number.NaN

    for (const piece of ordered) {
      const gap = Number.isNaN(cursor) ? 0 : piece.x - cursor
      if (!Number.isNaN(cursor)) {
        if (gap > spaceWidth * 4) {
          if (cellText.trim()) cells.push({ x: cellX, text: cellText.trim() })
          cellText = ''
          cellX = piece.x
          text += '  '
        } else if (gap > spaceWidth && !/\s$/.test(text) && !/^\s/.test(piece.text)) {
          text += ' '
          cellText += ' '
        }
      }
      text += piece.text
      cellText += piece.text
      cursor = piece.x + piece.width
    }
    if (cellText.trim()) cells.push({ x: cellX, text: cellText.trim() })

    const boldChars = ordered.filter((p) => p.bold).reduce((sum, p) => sum + p.text.length, 0)
    const monoChars = ordered.filter((p) => p.mono).reduce((sum, p) => sum + p.text.length, 0)
    const allChars = ordered.reduce((sum, p) => sum + p.text.length, 0) || 1

    return {
      y: ordered[0].y,
      x0: ordered[0].x,
      x1: cursor,
      size,
      bold: boldChars / allChars > 0.7,
      mono: monoChars / allChars > 0.7,
      text: text.replace(/\s+/g, ' ').trim(),
      cells,
    }
  })
}

/* ------------------------------------------------------------------ *
 * Markdown
 * ------------------------------------------------------------------ */

export interface MarkdownOptions {
  /** Insert a horizontal rule and a page comment between pages. */
  pageBreaks: boolean
  /** Try to emit GFM tables for runs of column-aligned lines. */
  detectTables: boolean
  /** Drop repeated running heads and page numbers. */
  stripHeadersFooters: boolean
}

const BULLET = /^[•‣▪●◦⁃∙*\-·■–]\s+/
const ORDERED = /^\(?(\d{1,3}|[a-z]|[ivxlc]{1,6})[.)]\s+/i

function bodySize(pages: PageLayout[]): number {
  const weights = new Map<number, number>()
  for (const page of pages) {
    for (const line of page.lines) {
      const key = Math.round(line.size * 2) / 2
      weights.set(key, (weights.get(key) ?? 0) + line.text.length)
    }
  }
  let best = 10
  let bestWeight = -1
  for (const [size, weight] of weights) {
    if (weight > bestWeight) {
      bestWeight = weight
      best = size
    }
  }
  return best
}

/** Running heads repeat verbatim near the top or bottom of most pages. */
function repeatedEdgeLines(pages: PageLayout[]): Set<string> {
  if (pages.length < 3) return new Set()
  const counts = new Map<string, number>()
  for (const page of pages) {
    const sorted = [...page.lines].sort((a, b) => b.y - a.y)
    const edges = [...sorted.slice(0, 2), ...sorted.slice(-2)]
    for (const line of edges) {
      const normalised = line.text.replace(/\d+/g, '#').trim()
      if (normalised.length < 2 || normalised.length > 120) continue
      counts.set(normalised, (counts.get(normalised) ?? 0) + 1)
    }
  }
  const threshold = Math.max(3, Math.floor(pages.length * 0.6))
  const out = new Set<string>()
  for (const [text, count] of counts) if (count >= threshold) out.add(text)
  return out
}

function headingLevels(pages: PageLayout[], body: number): Map<number, number> {
  const sizes = new Set<number>()
  for (const page of pages) {
    for (const line of page.lines) {
      const key = Math.round(line.size * 2) / 2
      if (key > body * 1.12 && line.text.length > 0) sizes.add(key)
    }
  }
  const ordered = [...sizes].sort((a, b) => b - a).slice(0, 4)
  const map = new Map<number, number>()
  ordered.forEach((size, i) => map.set(size, i + 1))
  return map
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|')
}

/** A run of lines that all split into the same number of aligned columns. */
function tableRuns(lines: Line[]): { start: number; end: number; columns: number }[] {
  const runs: { start: number; end: number; columns: number }[] = []
  let start = -1
  let columns = 0
  for (let i = 0; i <= lines.length; i++) {
    const count = i < lines.length ? lines[i].cells.length : 0
    if (count >= 2 && (start === -1 || count === columns)) {
      if (start === -1) {
        start = i
        columns = count
      }
      continue
    }
    if (start !== -1 && i - start >= 3) runs.push({ start, end: i - 1, columns })
    start = count >= 2 ? i : -1
    columns = count >= 2 ? count : 0
  }
  return runs
}

export function toMarkdown(pages: PageLayout[], options: MarkdownOptions): string {
  const body = bodySize(pages)
  const levels = headingLevels(pages, body)
  const repeated = options.stripHeadersFooters ? repeatedEdgeLines(pages) : new Set<string>()
  const out: string[] = []

  pages.forEach((page, pageIndex) => {
    if (options.pageBreaks && pageIndex > 0) out.push('\n---\n')

    const lines = page.lines.filter(
      (line) => line.text.length > 0 && !repeated.has(line.text.replace(/\d+/g, '#').trim()),
    )
    const runs = options.detectTables ? tableRuns(lines) : []
    const inTable = new Set<number>()
    for (const run of runs) {
      for (let i = run.start; i <= run.end; i++) inTable.add(i)
    }

    // Markdown lists, tables and fenced code must be emitted as contiguous
    // lines, so they are buffered and flushed as a single block.
    let paragraph: string[] = []
    let list: string[] = []
    let code: string[] = []

    const flushParagraph = () => {
      if (paragraph.length > 0) {
        out.push(paragraph.join(' ').replace(/\s+/g, ' ').trim())
        paragraph = []
      }
    }
    const flushList = () => {
      if (list.length > 0) {
        out.push(list.join('\n'))
        list = []
      }
    }
    const flushCode = () => {
      if (code.length > 0) {
        out.push(['```', ...code, '```'].join('\n'))
        code = []
      }
    }
    const flushAll = () => {
      flushParagraph()
      flushList()
      flushCode()
    }

    for (let i = 0; i < lines.length; i++) {
      if (inTable.has(i)) {
        const run = runs.find((r) => r.start === i)
        if (!run) continue
        flushAll()
        const rows = lines.slice(run.start, run.end + 1)
        const header = rows[0].cells.map((cell) => escapeCell(cell.text))
        const table = [
          `| ${header.join(' | ')} |`,
          `| ${header.map(() => '---').join(' | ')} |`,
          ...rows
            .slice(1)
            .map((row) => `| ${row.cells.map((cell) => escapeCell(cell.text)).join(' | ')} |`),
        ]
        out.push(table.join('\n'))
        i = run.end
        continue
      }

      const line = lines[i]
      const key = Math.round(line.size * 2) / 2
      const level = levels.get(key)
      const previous = lines[i - 1]
      const gap = previous ? previous.y - line.y : 0
      const bigGap = gap > line.size * 1.75

      if (level && line.text.length < 200) {
        flushAll()
        out.push(`${'#'.repeat(Math.min(6, level))} ${line.text}`)
        continue
      }

      if (BULLET.test(line.text)) {
        flushParagraph()
        flushCode()
        list.push(`- ${line.text.replace(BULLET, '')}`)
        continue
      }

      if (ORDERED.test(line.text)) {
        flushParagraph()
        flushCode()
        list.push(line.text.replace(ORDERED, (m) => `${m.trim()} `))
        continue
      }

      if (line.mono) {
        flushParagraph()
        flushList()
        code.push(line.text)
        continue
      }

      flushList()
      flushCode()
      if (bigGap) flushParagraph()

      const text = line.bold && line.text.length < 120 ? `**${line.text}**` : line.text
      if (paragraph.length > 0) {
        const last = paragraph[paragraph.length - 1]
        if (last.endsWith('-')) {
          paragraph[paragraph.length - 1] = last.slice(0, -1) + text
          continue
        }
      }
      paragraph.push(text)
    }
    flushAll()
  })

  return out
    .filter((block) => block.trim().length > 0)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/* ------------------------------------------------------------------ *
 * Tables → a rectangular grid
 * ------------------------------------------------------------------ */

/**
 * Turn a page's lines into a rectangular grid by clustering the x positions of
 * every gap-separated fragment. Works on digitally generated documents where
 * columns really are aligned; a scan with no text layer yields nothing.
 */
export function pageToGrid(page: PageLayout, tolerancePt = 6): string[][] {
  const rows = page.lines.filter((line) => line.cells.length > 0)
  if (rows.length === 0) return []

  const starts: number[] = []
  for (const row of rows) for (const cell of row.cells) starts.push(cell.x)
  starts.sort((a, b) => a - b)

  const columns: number[] = []
  let clusterStart = starts[0]
  let clusterSum = starts[0]
  let clusterCount = 1
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] - clusterStart <= tolerancePt) {
      clusterSum += starts[i]
      clusterCount += 1
    } else {
      columns.push(clusterSum / clusterCount)
      clusterStart = starts[i]
      clusterSum = starts[i]
      clusterCount = 1
    }
  }
  columns.push(clusterSum / clusterCount)

  return rows.map((row) => {
    const cells: string[] = new Array<string>(columns.length).fill('')
    for (const cell of row.cells) {
      let index = 0
      let bestDistance = Infinity
      for (let c = 0; c < columns.length; c++) {
        const distance = Math.abs(columns[c] - cell.x)
        if (distance < bestDistance) {
          bestDistance = distance
          index = c
        }
      }
      cells[index] = cells[index] ? `${cells[index]} ${cell.text}` : cell.text
    }
    return cells
  })
}

/** Drop columns that are empty in every row — a common artefact of clustering. */
export function trimGrid(grid: string[][]): string[][] {
  if (grid.length === 0) return grid
  const width = Math.max(...grid.map((row) => row.length))
  const keep: number[] = []
  for (let c = 0; c < width; c++) {
    if (grid.some((row) => (row[c] ?? '').trim() !== '')) keep.push(c)
  }
  return grid.map((row) => keep.map((c) => row[c] ?? ''))
}
