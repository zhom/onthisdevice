/** XML and HTML tables to rows and back. Parsing uses the browser's DOMParser. */
import { toXmlName } from '@/components/tools/dev/dev-format-xmljson'
import type { Table } from './convert'

function parse(text: string, type: DOMParserSupportedType): Document {
  const doc = new DOMParser().parseFromString(text, type)
  const error = doc.querySelector('parsererror')
  if (error) throw new Error(`This is not well-formed XML: ${(error.textContent ?? '').split('\n')[0].slice(0, 160)}`)
  return doc
}

const elements = (el: Element) => Array.from(el.children)

/** The records of an XML document: the most repeated child element name under any one parent. */
function records(root: Element): Element[] {
  let best: Element[] = [root]
  const visit = (el: Element) => {
    const groups = new Map<string, Element[]>()
    for (const c of elements(el)) {
      const list = groups.get(c.tagName) ?? []
      list.push(c)
      groups.set(c.tagName, list)
    }
    for (const list of groups.values()) if (list.length > best.length) best = list
    for (const c of elements(el)) visit(c)
  }
  visit(root)
  return best
}

function flattenElement(el: Element, prefix: string, out: Record<string, string>) {
  for (const a of Array.from(el.attributes)) out[`${prefix}@${a.name}`] = a.value
  const kids = elements(el)
  if (kids.length === 0) {
    const text = (el.textContent ?? '').trim()
    if (text !== '' || el.attributes.length === 0) out[prefix.replace(/\.$/, '') || el.tagName] = text
    return
  }
  const counts = new Map<string, number>()
  for (const k of kids) {
    const n = (counts.get(k.tagName) ?? 0) + 1
    counts.set(k.tagName, n)
    const name = n > 1 ? `${k.tagName}.${n}` : k.tagName
    flattenElement(k, `${prefix}${name}.`, out)
  }
}

export function xmlToTable(text: string): Table {
  const doc = parse(text, 'application/xml')
  const recs = records(doc.documentElement)
  const objects = recs.map((r) => {
    const out: Record<string, string> = {}
    flattenElement(r, '', out)
    return out
  })
  const columns: string[] = []
  for (const o of objects) for (const k of Object.keys(o)) if (!columns.includes(k)) columns.push(k)
  return { columns, rows: objects.map((o) => columns.map((c) => o[c] ?? '')) }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;')

export function tableToXml(t: Table, o: { root: string; row: string; attributes: boolean }): string {
  const root = toXmlName(o.root, 'rows')
  const row = toXmlName(o.row, 'row')
  const names = t.columns.map((c) => toXmlName(c, 'field'))
  const body = t.rows.map((r) =>
    o.attributes
      ? `  <${row}${names.map((n, i) => ` ${n}="${escAttr(String(r[i]))}"`).join('')}/>`
      : `  <${row}>\n${names.map((n, i) => `    <${n}>${esc(String(r[i]))}</${n}>`).join('\n')}\n  </${row}>`,
  )
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${root}>\n${body.join('\n')}\n</${root}>`
}

/** All tables of an HTML document. Cells spanning several columns are repeated so that columns stay aligned. */
export function htmlTables(html: string): Table[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.querySelectorAll('table')).map((table) => {
    const grid: string[][] = []
    Array.from(table.rows).forEach((tr, y) => {
      grid[y] ??= []
      let x = 0
      for (const cell of Array.from(tr.cells)) {
        while (grid[y][x] !== undefined) x++
        const text = (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
        for (let dy = 0; dy < Math.max(1, cell.rowSpan); dy++) {
          grid[y + dy] ??= []
          for (let dx = 0; dx < Math.max(1, cell.colSpan); dx++) grid[y + dy][x + dx] = text
        }
        x += Math.max(1, cell.colSpan)
      }
    })
    const width = Math.max(0, ...grid.map((r) => r.length))
    const filled = grid.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
    const hasHead = table.tHead !== null || (table.rows[0]?.querySelector('th') ?? null) !== null
    const [head, ...rest] = hasHead ? filled : [filled[0]?.map((_, i) => `Column ${i + 1}`) ?? [], ...filled]
    return { columns: head ?? [], rows: rest }
  })
}
