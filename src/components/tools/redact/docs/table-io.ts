/** Reading and writing CSV, TSV, XLSX and JSON tables as rows of strings. */

export type TableFormat = 'csv' | 'tsv' | 'xlsx' | 'json'

export interface Table {
  format: TableFormat
  name: string
  header: string[]
  rows: string[][]
  /** CSV delimiter as found in the file. */
  delimiter: string
  /** JSON: the original objects, so kept values keep their types. */
  objects?: Record<string, unknown>[]
  /** XLSX: every sheet name, and the one shown. */
  sheets?: string[]
  sheet?: string
}

export function formatOf(name: string): TableFormat | null {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'csv' || ext === 'txt') return 'csv'
  if (ext === 'tsv' || ext === 'tab') return 'tsv'
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm' || ext === 'ods') return 'xlsx'
  if (ext === 'json') return 'json'
  return null
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export async function readTable(file: File, sheet?: string): Promise<Table> {
  const format = formatOf(file.name)
  if (!format) throw new Error(`${file.name} is not a CSV, TSV, XLSX or JSON file.`)
  if (format === 'xlsx') {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
    const name = sheet && wb.SheetNames.includes(sheet) ? sheet : wb.SheetNames[0]
    if (!name) throw new Error('This workbook has no sheets.')
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, defval: '' })
    const [head = [], ...rows] = aoa
    const width = Math.max(head.length, ...rows.map((r) => r.length))
    const header = Array.from({ length: width }, (_, i) => cell(head[i]) || `Column ${i + 1}`)
    return { format, name: file.name, header, rows: rows.map((r) => header.map((_, i) => cell(r[i]))), delimiter: ',', sheets: wb.SheetNames, sheet: name }
  }
  const text = (await file.text()).replace(/^﻿/, '')
  if (format === 'json') {
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`${file.name} is not valid JSON.`)
    }
    const list = Array.isArray(data) ? data : Object.values(data as object).find(Array.isArray)
    if (!Array.isArray(list) || !list.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
      throw new Error('The JSON must be an array of objects, one object per row.')
    }
    const objects = list as Record<string, unknown>[]
    const header: string[] = []
    const seen = new Set<string>()
    for (const o of objects) {
      for (const k of Object.keys(o)) {
        if (seen.has(k)) continue
        seen.add(k)
        header.push(k)
      }
    }
    return { format, name: file.name, header, rows: objects.map((o) => header.map((k) => cell(o[k]))), delimiter: ',', objects }
  }
  const Papa = (await import('papaparse')).default
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy', delimiter: format === 'tsv' ? '\t' : '' })
  if (parsed.data.length === 0) throw new Error(`${file.name} is empty.`)
  const [head, ...rows] = parsed.data
  const width = Math.max(head.length, ...rows.map((r) => r.length))
  const header = Array.from({ length: width }, (_, i) => head[i] || `Column ${i + 1}`)
  return { format, name: file.name, header, rows: rows.map((r) => header.map((_, i) => r[i] ?? '')), delimiter: parsed.meta.delimiter || ',' }
}

export interface OutColumn {
  /** Index in the source table. */
  source: number
  header: string
  /** False when the value was changed, so JSON writes the new string. */
  kept: boolean
}

/** Writes the table in its own format. */
export async function writeTable(table: Table, columns: OutColumn[], rows: string[][]): Promise<Blob> {
  const header = columns.map((c) => c.header)
  if (table.format === 'xlsx') {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), (table.sheet ?? 'Sheet1').slice(0, 31))
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }
  if (table.format === 'json') {
    const objs = rows.map((r, i) => {
      const o: Record<string, unknown> = {}
      columns.forEach((c, j) => {
        o[c.header] = c.kept && table.objects ? table.objects[i]?.[c.header] : r[j]
      })
      return o
    })
    return new Blob([JSON.stringify(objs, null, 2)], { type: 'application/json' })
  }
  const Papa = (await import('papaparse')).default
  const text = Papa.unparse({ fields: header, data: rows }, { delimiter: table.format === 'tsv' ? '\t' : table.delimiter, newline: '\n' })
  return new Blob([text], { type: table.format === 'tsv' ? 'text/tab-separated-values' : 'text/csv' })
}
