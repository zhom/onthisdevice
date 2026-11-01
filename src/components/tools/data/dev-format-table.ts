/**
 * Table parsing and emitting for the `dev-format` batch's Markdown table pages.
 *
 * One grid model (`string[][]` plus a per-column alignment) is shared by every
 * direction, so CSV in / Markdown out, Excel paste in / HTML out and Markdown
 * in / CSV out are all the same two steps.
 */
import Papa from 'papaparse'

export type Align = 'left' | 'center' | 'right'

export interface Grid {
  /** Row 0 is the header row. */
  rows: string[][]
  aligns: Align[]
}

export function emptyGrid(columns = 3, bodyRows = 3): Grid {
  const header = Array.from({ length: columns }, (_, i) => `Column ${String.fromCharCode(65 + i)}`)
  const rows = [header]
  for (let r = 0; r < bodyRows; r += 1) rows.push(Array.from({ length: columns }, () => ''))
  return { rows, aligns: Array.from({ length: columns }, () => 'left') }
}

/** Pads every row to the widest row so the grid is rectangular. */
export function normaliseGrid(rows: string[][], aligns?: Align[]): Grid {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const padded = rows.map((row) => {
    const copy = row.slice(0, width).map((cell) => cell ?? '')
    while (copy.length < width) copy.push('')
    return copy
  })
  const finalAligns: Align[] = Array.from({ length: width }, (_, i) => aligns?.[i] ?? 'left')
  return { rows: padded.length > 0 ? padded : [['']], aligns: finalAligns }
}

/* ------------------------------------------------------------------ */
/* Parsers                                                             */
/* ------------------------------------------------------------------ */

export interface ParseOutcome {
  grid: Grid
  /** How the input was recognised, shown to the user. */
  source: string
}

/** CSV / TSV / semicolon / pipe — Papa sniffs the delimiter. */
export function parseDelimited(text: string, delimiter?: string): ParseOutcome {
  const result = Papa.parse<string[]>(text.trim(), {
    delimiter: delimiter ?? '',
    skipEmptyLines: 'greedy',
  })
  const rows = (result.data as string[][]).map((row) => row.map((cell) => String(cell ?? '').trim()))
  const used = result.meta.delimiter
  const name =
    used === '\t' ? 'tab-separated' : used === ';' ? 'semicolon-separated' : used === '|' ? 'pipe-separated' : 'comma-separated'
  return { grid: normaliseGrid(rows), source: `${name} values` }
}

/** First <table> found in a chunk of HTML. */
export function parseHtmlTable(html: string): ParseOutcome | null {
  if (typeof DOMParser === 'undefined') return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return null

  const rows: string[][] = []
  const aligns: Align[] = []
  for (const tr of Array.from(table.querySelectorAll('tr'))) {
    const cells = Array.from(tr.querySelectorAll('th, td'))
    if (cells.length === 0) continue
    rows.push(
      cells.map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()),
    )
    if (rows.length === 1) {
      for (const cell of cells) {
        const align = (cell.getAttribute('align') ?? '').toLowerCase()
        aligns.push(align === 'center' || align === 'right' ? (align as Align) : 'left')
      }
    }
  }
  if (rows.length === 0) return null
  return { grid: normaliseGrid(rows, aligns), source: 'HTML table' }
}

const ALIGN_CELL = /^:?-{1,}:?$/

/** A GFM pipe table, with or without leading and trailing pipes. */
export function parseMarkdownTable(text: string): ParseOutcome | null {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  if (lines.length < 2) return null

  const splitRow = (line: string): string[] => {
    let body = line
    if (body.startsWith('|')) body = body.slice(1)
    if (body.endsWith('|') && !body.endsWith('\\|')) body = body.slice(0, -1)
    const cells: string[] = []
    let current = ''
    for (let i = 0; i < body.length; i += 1) {
      if (body[i] === '\\' && body[i + 1] === '|') {
        current += '|'
        i += 1
        continue
      }
      if (body[i] === '|') {
        cells.push(current.trim())
        current = ''
        continue
      }
      current += body[i]
    }
    cells.push(current.trim())
    return cells
  }

  const header = splitRow(lines[0])
  const separator = splitRow(lines[1])
  if (separator.length !== header.length || !separator.every((cell) => ALIGN_CELL.test(cell))) {
    return null
  }

  const aligns: Align[] = separator.map((cell) => {
    const left = cell.startsWith(':')
    const right = cell.endsWith(':')
    if (left && right) return 'center'
    if (right) return 'right'
    return 'left'
  })

  const rows = [header, ...lines.slice(2).map(splitRow)]
  return { grid: normaliseGrid(rows, aligns), source: 'Markdown table' }
}

/** Tries every parser in the order that gives the fewest false positives. */
export function parseAnything(text: string): ParseOutcome | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  if (/<\s*table[\s>]/i.test(trimmed)) {
    const html = parseHtmlTable(trimmed)
    if (html) return html
  }
  const markdown = parseMarkdownTable(trimmed)
  if (markdown) return markdown
  return parseDelimited(trimmed)
}

/* ------------------------------------------------------------------ */
/* Emitters                                                            */
/* ------------------------------------------------------------------ */

export interface MarkdownTableOptions {
  /** Pad cells so the pipes line up in the source. */
  pad: boolean
  /** Emit the outer leading and trailing pipes. */
  outerPipes: boolean
  /** Treat row 0 as a header row. */
  headerRow: boolean
}

export const DEFAULT_TABLE_OPTIONS: MarkdownTableOptions = {
  pad: true,
  outerPipes: true,
  headerRow: true,
}

const escapeCell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n+/g, '<br>')

/** Display width, counting a wide CJK character as two columns. */
function cellWidth(value: string): number {
  let width = 0
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    width += code >= 0x1100 && (code <= 0x115f || (code >= 0x2e80 && code <= 0xa4cf) || (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xf900 && code <= 0xfaff) || (code >= 0xfe30 && code <= 0xfe6f) || (code >= 0xff00 && code <= 0xff60) || (code >= 0xffe0 && code <= 0xffe6)) ? 2 : 1
  }
  return width
}

function padCell(value: string, width: number, align: Align): string {
  const slack = Math.max(0, width - cellWidth(value))
  if (align === 'right') return ' '.repeat(slack) + value
  if (align === 'center') {
    const left = Math.floor(slack / 2)
    return ' '.repeat(left) + value + ' '.repeat(slack - left)
  }
  return value + ' '.repeat(slack)
}

export function toMarkdownTable(grid: Grid, options: MarkdownTableOptions): string {
  const rows = grid.rows.map((row) => row.map(escapeCell))
  if (rows.length === 0) return ''

  const header = options.headerRow ? rows[0] : grid.aligns.map((_, i) => `Column ${i + 1}`)
  const body = options.headerRow ? rows.slice(1) : rows

  const widths = grid.aligns.map((_, column) => {
    const cells = [header[column] ?? '', ...body.map((row) => row[column] ?? '')]
    return Math.max(3, ...cells.map(cellWidth))
  })

  const line = (cells: string[]): string => {
    const rendered = cells.map((cell, i) =>
      options.pad ? padCell(cell, widths[i], grid.aligns[i]) : cell,
    )
    const joined = rendered.join(' | ')
    return options.outerPipes ? `| ${joined} |` : joined
  }

  const separator = grid.aligns.map((align, i) => {
    const width = options.pad ? widths[i] : 3
    if (align === 'center') return `:${'-'.repeat(Math.max(1, width - 2))}:`
    if (align === 'right') return `${'-'.repeat(Math.max(2, width - 1))}:`
    return '-'.repeat(Math.max(3, width))
  })

  const separatorLine = options.outerPipes
    ? `| ${separator.join(' | ')} |`
    : separator.join(' | ')

  return [line(header), separatorLine, ...body.map(line)].join('\n')
}

export function toHtmlTable(grid: Grid, headerRow: boolean): string {
  const cell = (value: string, tag: 'th' | 'td', align: Align): string => {
    const attr = align === 'left' ? '' : ` align="${align}"`
    const text = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `      <${tag}${attr}>${text}</${tag}>`
  }
  const lines: string[] = ['<table>']
  const rows = grid.rows
  if (headerRow && rows.length > 0) {
    lines.push('  <thead>', '    <tr>')
    rows[0].forEach((value, i) => lines.push(cell(value, 'th', grid.aligns[i])))
    lines.push('    </tr>', '  </thead>')
  }
  const body = headerRow ? rows.slice(1) : rows
  if (body.length > 0) {
    lines.push('  <tbody>')
    for (const row of body) {
      lines.push('    <tr>')
      row.forEach((value, i) => lines.push(cell(value, 'td', grid.aligns[i])))
      lines.push('    </tr>')
    }
    lines.push('  </tbody>')
  }
  lines.push('</table>')
  return lines.join('\n')
}

export function toCsv(grid: Grid, delimiter = ','): string {
  return Papa.unparse(grid.rows, { delimiter, newline: '\n' })
}

export function toJsonRecords(grid: Grid): string {
  if (grid.rows.length < 2) return '[]'
  const [header, ...body] = grid.rows
  const records = body.map((row) => {
    const record: Record<string, string> = {}
    header.forEach((key, i) => {
      record[key || `column_${i + 1}`] = row[i] ?? ''
    })
    return record
  })
  return JSON.stringify(records, null, 2)
}

export const CSV_SAMPLE = `Region,Q3 revenue,Q4 revenue,Change
EMEA,412000,486500,+18.1%
APAC,238400,301200,+26.3%
North America,905300,882100,-2.6%
LATAM,77800,94500,+21.5%`

export const HTML_TABLE_SAMPLE = `<table>
  <thead>
    <tr><th>Setting</th><th align="right">Old default</th><th align="right">New default</th></tr>
  </thead>
  <tbody>
    <tr><td>batch_size</td><td align="right">100</td><td align="right">500</td></tr>
    <tr><td>timeout_ms</td><td align="right">5000</td><td align="right">15000</td></tr>
    <tr><td>retries</td><td align="right">3</td><td align="right">5</td></tr>
  </tbody>
</table>`

export const MARKDOWN_TABLE_SAMPLE = `| Endpoint | Method | Auth | p95 latency |
| --- | :---: | :---: | ---: |
| /v1/orders | GET | Bearer | 84 ms |
| /v1/orders | POST | Bearer | 210 ms |
| /v1/health | GET | none | 3 ms |`
