/** Data format engines: tables from JSON and CSV, .env files, JSON Lines, SQL inserts, HTML and Markdown tables. */
import Papa from 'papaparse'
import { cellValue, collectColumns, escapeHtml, flattenValue, isPlainObject, parseJsonStrict } from '@/components/tools/data/datautil'
import type { PlainObject } from '@/components/tools/data/datautil'

export function parseJson(text: string): unknown {
  const r = parseJsonStrict(text)
  if ('issue' in r) {
    const at = r.issue.line ? ` (line ${r.issue.line}${r.issue.column ? `, column ${r.issue.column}` : ''})` : ''
    throw new Error(`${r.issue.message}${at}`)
  }
  return r.value
}

export interface Table {
  columns: string[]
  rows: (string | number | boolean)[][]
}

/** Rows from JSON: an array of objects, an object holding one such array, or a single object. Nested values are flattened. */
export function tableFromJson(value: unknown): Table {
  let list: unknown[]
  if (Array.isArray(value)) list = value
  else if (isPlainObject(value)) {
    const arrays = Object.values(value).filter(Array.isArray)
    list = arrays.length === 1 ? arrays[0] : [value]
  } else throw new Error('Expected an array of objects, such as [{"name": "Ada"}].')
  const objects: PlainObject[] = list.map((item) => (isPlainObject(item) ? flattenValue(item) : { value: item }))
  const columns = collectColumns(objects)
  return { columns, rows: objects.map((o) => columns.map((c) => cellValue(o[c]))) }
}

export function tableFromCsv(text: string, delimiter = ''): Table {
  const parsed = Papa.parse<string[]>(text.trim(), { delimiter, skipEmptyLines: true })
  const err = parsed.errors.find((e) => e.type !== 'Delimiter')
  if (err) throw new Error(`Row ${(err.row ?? 0) + 1}: ${err.message}`)
  const [head = [], ...rows] = parsed.data
  if (head.length === 0) throw new Error('The CSV has no header row.')
  const columns = head.map((h, i) => h.trim() || `column_${i + 1}`)
  return { columns, rows: rows.map((r) => columns.map((_, i) => r[i] ?? '')) }
}

/** "42" to 42 and "true" to true, for formats that have numbers and booleans. */
export function typed(value: string | number | boolean): string | number | boolean | null {
  if (typeof value !== 'string') return value
  const t = value.trim()
  if (t === '') return null
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?$/.test(t) && Math.abs(Number(t)) < Number.MAX_SAFE_INTEGER) return Number(t)
  if (t === 'true' || t === 'false') return t === 'true'
  return value
}

export function tableToObjects(t: Table, detect: boolean): Record<string, unknown>[] {
  return t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c, detect ? typed(r[i]) : r[i]])))
}

export function tableToCsv(t: Table, delimiter = ','): string {
  return Papa.unparse({ fields: t.columns, data: t.rows.map((r) => r.map(String)) }, { delimiter, newline: '\n' })
}

export function tableToHtml(t: Table, indent: boolean): string {
  const nl = indent ? '\n' : ''
  const i1 = indent ? '  ' : ''
  const i2 = indent ? '    ' : ''
  const i3 = indent ? '      ' : ''
  const head = `${i1}<thead>${nl}${i2}<tr>${t.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr>${nl}${i1}</thead>`
  const body = t.rows.map((r) => `${i2}<tr>${nl}${r.map((c) => `${i3}<td>${escapeHtml(String(c))}</td>`).join(nl)}${nl}${i2}</tr>`).join(nl)
  return `<table>${nl}${head}${nl}${i1}<tbody>${nl}${body}${nl}${i1}</tbody>${nl}</table>`
}

export function tableToMarkdown(t: Table): string {
  const cell = (v: unknown) => String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
  const widths = t.columns.map((c, i) => Math.max(3, cell(c).length, ...t.rows.map((r) => cell(r[i]).length)))
  const line = (cells: string[]) => `| ${cells.map((c, i) => c.padEnd(widths[i])).join(' | ')} |`
  return [line(t.columns.map(cell)), `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`, ...t.rows.map((r) => line(r.map(cell)))].join('\n')
}

/* ── .env ── */

export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/.exec(line)
    if (!m) throw new Error(`Line ${i + 1} is not KEY=value: ${line.slice(0, 60)}`)
    const [, key, rest] = m
    let value = rest
    const q = rest[0]
    if (q === '"' || q === "'" || q === '`') {
      // A quoted value may continue over several lines until the closing quote.
      let body = rest.slice(1)
      let end = findClose(body, q)
      while (end < 0 && i + 1 < lines.length) {
        body += `\n${lines[++i]}`
        end = findClose(body, q)
      }
      if (end < 0) throw new Error(`The value of ${key} has no closing ${q}.`)
      value = body.slice(0, end)
      if (q === '"') value = value.replace(/\\(n|r|t|"|\\)/g, (_m, c: string) => ({ n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' })[c] ?? c)
    } else {
      value = rest.replace(/\s+#.*$/, '').trim()
    }
    out[key] = value
  }
  return out
}

function findClose(body: string, q: string): number {
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '\\' && q === '"') i++
    else if (body[i] === q) return i
  }
  return -1
}

export function toEnv(value: unknown, o: { prefix: string; upper: boolean; quote: 'auto' | 'always' }): string {
  if (!isPlainObject(value)) throw new Error('Expected a JSON object, such as {"port": 8080}.')
  const flat = flattenValue(value, { delimiter: '_', expandArrays: false })
  return Object.entries(flat)
    .map(([k, v]) => {
      let key = (o.prefix + k).replace(/[^A-Za-z0-9_]/g, '_')
      if (o.upper) key = key.toUpperCase()
      if (/^\d/.test(key)) key = `_${key}`
      const s = v === null || v === undefined ? '' : typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v)
      const needs = o.quote === 'always' || /[\s#"'`$\\=]/.test(s) || s === ''
      return `${key}=${needs ? `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"` : s}`
    })
    .join('\n')
}

/* ── JSON Lines ── */

export function jsonlToArray(text: string): unknown[] {
  return text
    .split(/\r?\n/)
    .map((line, i) => ({ line: line.trim(), i }))
    .filter((l) => l.line !== '')
    .map(({ line, i }) => {
      try {
        return JSON.parse(line) as unknown
      } catch (e) {
        throw new Error(`Line ${i + 1} is not valid JSON: ${e instanceof Error ? e.message : ''}`)
      }
    })
}

/* ── SQL ── */

export type Dialect = 'standard' | 'mysql' | 'sqlserver'

const quoteIdent = (name: string, d: Dialect) =>
  d === 'mysql' ? `\`${name.replace(/`/g, '``')}\`` : d === 'sqlserver' ? `[${name.replace(/]/g, ']]')}]` : `"${name.replace(/"/g, '""')}"`

function sqlType(values: (string | number | boolean | null)[]): string {
  const present = values.filter((v) => v !== null)
  if (present.length === 0) return 'TEXT'
  if (present.every((v) => typeof v === 'boolean')) return 'BOOLEAN'
  if (present.every((v) => typeof v === 'number' && Number.isInteger(v))) return 'INTEGER'
  if (present.every((v) => typeof v === 'number')) return 'REAL'
  return 'TEXT'
}

const sqlValue = (v: string | number | boolean | null) =>
  v === null ? 'NULL' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : `'${v.replace(/'/g, "''")}'`

export function tableToSql(t: Table, o: { table: string; dialect: Dialect; create: boolean; batch: number; detect: boolean }): string {
  const values = t.rows.map((r) => r.map((c) => (o.detect ? typed(c) : c === '' ? null : c)))
  const name = quoteIdent(o.table || 'data', o.dialect)
  const cols = t.columns.map((c) => quoteIdent(c, o.dialect)).join(', ')
  const out: string[] = []
  if (o.create) {
    const defs = t.columns.map((c, i) => `  ${quoteIdent(c, o.dialect)} ${sqlType(values.map((r) => r[i]))}`)
    out.push(`CREATE TABLE ${name} (\n${defs.join(',\n')}\n);`)
  }
  const size = Math.max(1, o.batch)
  for (let i = 0; i < values.length; i += size) {
    const rows = values.slice(i, i + size).map((r) => `(${r.map(sqlValue).join(', ')})`)
    out.push(`INSERT INTO ${name} (${cols}) VALUES\n${rows.join(',\n')};`)
  }
  return out.join('\n\n')
}
