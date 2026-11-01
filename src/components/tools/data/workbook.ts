import type { WorkBook, WorkSheet } from 'xlsx'

export type SheetJs = typeof import('xlsx')

let cached: SheetJs | null = null

/** Lazy-load SheetJS so it stays out of the initial island bundle. */
export async function loadSheetJs(): Promise<SheetJs> {
  if (!cached) cached = await import('xlsx')
  return cached
}

function friendlyReadError(error: unknown, fileName: string): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/password|encrypt/i.test(message)) {
    return `“${fileName}” is password-protected. Remove the password in Excel, then try again.`
  }
  if (/unsupported file|corrupt|zip|end of central directory/i.test(message)) {
    return `“${fileName}” doesn’t look like a spreadsheet this tool can read. Save it as .xlsx or .csv and retry.`
  }
  return `Could not read “${fileName}”: ${message}`
}

export async function readWorkbookFile(file: File): Promise<WorkBook> {
  const XLSX = await loadSheetJs()
  const buffer = await file.arrayBuffer()
  try {
    const book = XLSX.read(buffer, { type: 'array', cellDates: true, cellText: false })
    if (!book.SheetNames || book.SheetNames.length === 0) {
      throw new Error('the workbook contains no sheets')
    }
    return book
  } catch (error) {
    throw new Error(friendlyReadError(error, file.name))
  }
}

export interface SheetSize {
  rows: number
  columns: number
  cells: number
}

export async function sheetSize(sheet: WorkSheet): Promise<SheetSize> {
  const XLSX = await loadSheetJs()
  const ref = sheet['!ref']
  if (!ref) return { rows: 0, columns: 0, cells: 0 }
  const range = XLSX.utils.decode_range(ref)
  const rows = range.e.r - range.s.r + 1
  const columns = range.e.c - range.s.c + 1
  return { rows, columns, cells: rows * columns }
}

/** Column widths sized to the longest value, clamped to something readable. */
export function autoColumnWidths(rows: (string | number | boolean | null)[][], max = 60): { wch: number }[] {
  const widths: number[] = []
  for (const row of rows) {
    row.forEach((cell, i) => {
      const text = cell === null || cell === undefined ? '' : String(cell)
      const longest = text.split('\n').reduce((acc, line) => Math.max(acc, line.length), 0)
      widths[i] = Math.max(widths[i] ?? 8, Math.min(longest + 2, max))
    })
  }
  return widths.map((w) => ({ wch: w }))
}

/** Excel forbids : \ / ? * [ ] in sheet names and caps them at 31 characters. */
export function safeSheetName(name: string, fallback = 'Sheet1'): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31)
  return cleaned === '' ? fallback : cleaned
}

/** A safe file-name stem for downloads. */
export function safeFileStem(name: string, fallback = 'sheet'): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
  return cleaned === '' ? fallback : cleaned
}
