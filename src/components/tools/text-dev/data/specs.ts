/** Data format conversions: TOML, CSV, TSV, XML, YAML, HTML and Markdown tables, .env, JSON Lines and SQL. */
import { DEFAULT_XML_TO_JSON, xmlToJson } from '@/components/tools/dev/dev-format-xmljson'
import type { DataTable, Field, Result, Specs } from '../shell/spec'
import { bool, num, str } from '../shell/spec'
import { stripHtml } from '../text/cleanup'
import type { Dialect, Table } from './convert'
import { jsonlToArray, parseEnv, parseJson, tableFromCsv, tableFromJson, tableToCsv, tableToHtml, tableToMarkdown, tableToObjects, tableToSql, toEnv, typed } from './convert'
import { htmlTables, tableToXml, xmlToTable } from './xml'

const CSV_SAMPLE = `id,name,email,score,active
1,Ada Lovelace,ada@example.com,98.5,true
2,"Hopper, Grace",grace@example.com,91,true
3,Alan Turing,alan@example.com,,false`

const JSON_ROWS_SAMPLE = `[
  { "id": 1, "name": "Ada Lovelace", "role": { "title": "Analyst", "team": "Engines" }, "active": true },
  { "id": 2, "name": "Grace Hopper", "role": { "title": "Admiral", "team": "Compilers" }, "active": true },
  { "id": 3, "name": "Alan Turing", "role": { "title": "Researcher", "team": "Codes" }, "active": false }
]`

const XML_SAMPLE = `<?xml version="1.0"?>
<catalog>
  <book id="bk101" lang="en">
    <title>XML Developer's Guide</title>
    <author>Gambardella, Matthew</author>
    <price currency="USD">44.95</price>
  </book>
  <book id="bk102" lang="en">
    <title>Midnight Rain</title>
    <author>Ralls, Kim</author>
    <price currency="USD">5.95</price>
  </book>
</catalog>`

const preview = (t: Table): DataTable => ({ head: t.columns, rows: t.rows.map((r) => r.map((c) => (typeof c === 'boolean' ? String(c) : c))) })
const shape = (t: Table) => [
  { label: 'Rows', value: t.rows.length },
  { label: 'Columns', value: t.columns.length },
]

const DETECT: Field = { kind: 'toggle', id: 'detect', label: 'Detect numbers and booleans', default: true, hint: 'Writes 42 and true without quotes. Empty cells become null.' }
const JSON_INDENT: Field = {
  kind: 'choice',
  id: 'indent',
  label: 'Indent',
  default: '2',
  choices: [
    { value: '2', label: '2 spaces' },
    { value: '4', label: '4 spaces' },
    { value: '0', label: 'One line' },
  ],
}
const DELIM: Field = {
  kind: 'choice',
  id: 'delimiter',
  label: 'CSV delimiter',
  default: '',
  choices: [
    { value: '', label: 'Detect' },
    { value: ',', label: 'Comma' },
    { value: ';', label: 'Semicolon' },
    { value: '\t', label: 'Tab' },
    { value: '|', label: 'Pipe' },
  ],
}

const dialect = (s: string): Dialect => (s === 'mysql' || s === 'sqlserver' ? s : 'standard')

const json = (value: unknown, indent: string) => JSON.stringify(value, null, Number(indent) || undefined)

async function yamlOf(value: unknown): Promise<string> {
  const { stringify } = await import('yaml')
  return stringify(value, { lineWidth: 0 })
}

/** Path of the first null in a JSON value, or null when there is none. */
function findNull(value: unknown, path: string): string | null {
  if (value === null) return path
  if (typeof value !== 'object') return null
  for (const [k, v] of Object.entries(value)) {
    const found = findNull(v, Array.isArray(value) ? `${path}[${k}]` : path ? `${path}.${k}` : k)
    if (found !== null) return found
  }
  return null
}

function tableResult(t: Table, text: string): Result {
  return { text, stats: shape(t), table: preview(t) }
}

export const DATA_SPECS: Specs = {
  'toml-to-json': {
    input: { label: 'TOML', mono: true, rows: 12, sample: `title = "Example"\n\n[owner]\nname = "Ada"\ndob = 1815-12-10\n\n[database]\nports = [8000, 8001, 8002]\nenabled = true\n\n[[servers]]\nname = "alpha"\nip = "10.0.0.1"\n\n[[servers]]\nname = "beta"\nip = "10.0.0.2"` },
    output: { label: 'JSON', filename: 'config.json', rows: 14 },
    fields: [JSON_INDENT],
    run: async (input, v) => {
      const { parse } = await import('smol-toml')
      try {
        return json(parse(input), str(v, 'indent'))
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'This is not valid TOML.')
      }
    },
  },
  'json-to-toml': {
    input: { label: 'JSON', mono: true, rows: 12, sample: '{\n  "title": "Example",\n  "owner": { "name": "Ada" },\n  "database": { "ports": [8000, 8001], "enabled": true },\n  "servers": [ { "name": "alpha", "ip": "10.0.0.1" }, { "name": "beta", "ip": "10.0.0.2" } ]\n}' },
    output: { label: 'TOML', filename: 'config.toml', rows: 14 },
    run: async (input) => {
      const value = parseJson(input)
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('TOML needs a JSON object at the top, such as {"key": "value"}.')
      const nullAt = findNull(value, '')
      if (nullAt !== null) throw new Error(`TOML has no null, and ${nullAt || 'a value'} is null. Remove it or give it a value.`)
      const { stringify } = await import('smol-toml')
      try {
        return stringify(value)
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        throw new Error(/null|undefined/i.test(msg) ? 'TOML has no null. Remove null values or replace them with a string.' : msg || 'This JSON cannot be written as TOML.')
      }
    },
  },
  'csv-to-xml': {
    input: { label: 'CSV', mono: true, sample: CSV_SAMPLE },
    output: { label: 'XML', filename: 'data.xml', rows: 14 },
    fields: [
      { kind: 'text', id: 'root', label: 'Root element', default: 'rows', mono: true },
      { kind: 'text', id: 'row', label: 'Row element', default: 'row', mono: true },
      { kind: 'toggle', id: 'attributes', label: 'Columns as attributes', default: false },
      DELIM,
    ],
    run: (input, v) => {
      const t = tableFromCsv(input, str(v, 'delimiter'))
      return tableResult(t, tableToXml(t, { root: str(v, 'root'), row: str(v, 'row'), attributes: bool(v, 'attributes') }))
    },
  },
  'xml-to-csv': {
    input: { label: 'XML', mono: true, sample: XML_SAMPLE, rows: 12 },
    output: { label: 'CSV', filename: 'data.csv' },
    fields: [
      {
        kind: 'choice',
        id: 'delimiter',
        label: 'Delimiter',
        default: ',',
        choices: [
          { value: ',', label: 'Comma' },
          { value: ';', label: 'Semicolon' },
          { value: '\t', label: 'Tab' },
        ],
      },
    ],
    run: (input, v) => {
      const t = xmlToTable(input)
      return tableResult(t, tableToCsv(t, str(v, 'delimiter') || ','))
    },
  },
  'csv-to-yaml': {
    input: { label: 'CSV', mono: true, sample: CSV_SAMPLE },
    output: { label: 'YAML', filename: 'data.yaml', rows: 14 },
    fields: [DETECT, DELIM],
    run: async (input, v) => {
      const t = tableFromCsv(input, str(v, 'delimiter'))
      return { text: await yamlOf(tableToObjects(t, bool(v, 'detect'))), stats: shape(t) }
    },
  },
  'xml-to-yaml': {
    input: { label: 'XML', mono: true, sample: XML_SAMPLE, rows: 12 },
    output: { label: 'YAML', filename: 'data.yaml', rows: 16 },
    run: async (input) => {
      const r = xmlToJson(input, DEFAULT_XML_TO_JSON)
      if (!r.ok) throw new Error(r.message)
      return { text: await yamlOf(r.value), note: r.notes[0] }
    },
  },
  'json-to-html-table': {
    input: { label: 'JSON array', mono: true, sample: JSON_ROWS_SAMPLE, rows: 10 },
    output: { label: 'HTML table', filename: 'table.html', rows: 12 },
    fields: [{ kind: 'toggle', id: 'indent', label: 'Indent the HTML', default: true }],
    run: (input, v) => {
      const t = tableFromJson(parseJson(input))
      return tableResult(t, tableToHtml(t, bool(v, 'indent')))
    },
  },
  'csv-to-html-table': {
    input: { label: 'CSV', mono: true, sample: CSV_SAMPLE },
    output: { label: 'HTML table', filename: 'table.html', rows: 12 },
    fields: [{ kind: 'toggle', id: 'indent', label: 'Indent the HTML', default: true }, DELIM],
    run: (input, v) => {
      const t = tableFromCsv(input, str(v, 'delimiter'))
      return tableResult(t, tableToHtml(t, bool(v, 'indent')))
    },
  },
  'html-table-to-csv': {
    input: {
      label: 'HTML with a table',
      mono: true,
      rows: 10,
      sample: '<table>\n  <tr><th>Country</th><th>Capital</th><th>Population</th></tr>\n  <tr><td>France</td><td>Paris</td><td>68,400,000</td></tr>\n  <tr><td>Japan</td><td>Tokyo</td><td>124,500,000</td></tr>\n  <tr><td colspan="2">Total</td><td>192,900,000</td></tr>\n</table>',
    },
    output: { label: 'CSV', filename: 'table.csv' },
    fields: [{ kind: 'number', id: 'index', label: 'Table number', default: 1, min: 1, max: 500, hint: 'When the page has several tables, pick one.' }],
    run: (input, v) => {
      const tables = htmlTables(input)
      if (tables.length === 0) throw new Error('No <table> element found in this HTML.')
      const n = Math.min(tables.length, num(v, 'index'))
      const t = tables[n - 1]
      return { ...tableResult(t, tableToCsv(t)), note: `Table ${n} of ${tables.length}.` }
    },
  },
  'tsv-to-csv': {
    input: { label: 'TSV (tab-separated)', mono: true, sample: 'name\tcity\tnote\nAda\tLondon\tsays "hi", often\nGrace\tNew York\t' },
    output: { label: 'CSV', filename: 'data.csv' },
    run: (input) => {
      const t = tableFromCsv(input, '\t')
      return tableResult(t, tableToCsv(t, ','))
    },
  },
  'csv-to-tsv': {
    input: { label: 'CSV', mono: true, sample: CSV_SAMPLE },
    output: { label: 'TSV (tab-separated)', filename: 'data.tsv' },
    fields: [DELIM],
    run: (input, v) => {
      const t = tableFromCsv(input, str(v, 'delimiter'))
      // Tabs and line breaks inside a cell would break the TSV, so they become spaces.
      const clean: Table = { columns: t.columns, rows: t.rows.map((r) => r.map((c) => String(c).replace(/[\t\r\n]+/g, ' '))) }
      return tableResult(clean, [clean.columns, ...clean.rows].map((r) => r.join('\t')).join('\n'))
    },
  },
  'json-to-markdown-table': {
    input: { label: 'JSON array', mono: true, sample: JSON_ROWS_SAMPLE, rows: 10 },
    output: { label: 'Markdown table', filename: 'table.md' },
    run: (input) => {
      const t = tableFromJson(parseJson(input))
      return tableResult(t, tableToMarkdown(t))
    },
  },
  'markdown-to-text': {
    input: { label: 'Markdown', mono: true, rows: 10, sample: '# Release notes\n\nVersion **2.1** fixes [three bugs](https://example.com/bugs) and adds `--quiet`.\n\n- Faster start\n- Fewer crashes\n\n> Upgrade soon.\n\n```sh\nnpm install\n```' },
    output: { label: 'Plain text', filename: 'text.txt', mono: false },
    fields: [{ kind: 'toggle', id: 'links', label: 'Keep link addresses', default: false, hint: 'Writes "three bugs (https://example.com/bugs)".' }],
    run: async (input, v) => {
      const { marked } = await import('marked')
      let md = input
      if (bool(v, 'links')) md = md.replace(/(?<!!)\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, '$1 ($2)')
      const html = await marked.parse(md, { gfm: true })
      return stripHtml(html, { breaks: true, entities: true })
    },
  },
  'env-to-json': {
    input: { label: '.env file', mono: true, rows: 10, sample: '# Database\nDB_HOST=localhost\nDB_PORT=5432\nexport DEBUG=true\nGREETING="Hello\\nWorld"\nPRIVATE_KEY="-----BEGIN KEY-----\nabc123\n-----END KEY-----"\nPATH_SUFFIX=/bin # comment' },
    output: { label: 'JSON', filename: 'env.json', rows: 12 },
    fields: [{ ...DETECT, default: false, hint: 'Off keeps every value a string, as the environment does.' }, JSON_INDENT],
    run: (input, v) => {
      const env = parseEnv(input)
      const value = bool(v, 'detect') ? Object.fromEntries(Object.entries(env).map(([k, x]) => [k, typed(x)])) : env
      return { text: json(value, str(v, 'indent')), stats: [{ label: 'Variables', value: Object.keys(env).length }] }
    },
  },
  'json-to-env': {
    input: { label: 'JSON object', mono: true, rows: 10, sample: '{\n  "port": 8080,\n  "database": { "host": "localhost", "user": "app" },\n  "debug": false,\n  "greeting": "Hello world",\n  "hosts": ["a", "b"]\n}' },
    output: { label: '.env', filename: '.env' },
    fields: [
      { kind: 'text', id: 'prefix', label: 'Prefix', default: '', mono: true, placeholder: 'APP_' },
      { kind: 'toggle', id: 'upper', label: 'Uppercase names', default: true },
      { kind: 'toggle', id: 'always', label: 'Quote every value', default: false },
    ],
    run: (input, v) => toEnv(parseJson(input), { prefix: str(v, 'prefix'), upper: bool(v, 'upper'), quote: bool(v, 'always') ? 'always' : 'auto' }),
  },
  'jsonl-to-json': {
    input: { label: 'JSON Lines (one JSON value per line)', mono: true, sample: '{"id": 1, "text": "first"}\n{"id": 2, "text": "second"}\n{"id": 3, "text": "third", "tags": ["x"]}' },
    output: { label: 'JSON array', filename: 'data.json', rows: 12 },
    fields: [JSON_INDENT],
    run: (input, v) => {
      const items = jsonlToArray(input)
      return { text: json(items, str(v, 'indent')), stats: [{ label: 'Records', value: items.length }] }
    },
  },
  'json-to-jsonl': {
    input: { label: 'JSON array', mono: true, sample: JSON_ROWS_SAMPLE, rows: 10 },
    output: { label: 'JSON Lines', filename: 'data.jsonl' },
    run: (input) => {
      const value = parseJson(input)
      const items = Array.isArray(value) ? value : [value]
      return { text: items.map((x) => JSON.stringify(x)).join('\n'), stats: [{ label: 'Records', value: items.length }] }
    },
  },
  'csv-to-sql': {
    input: { label: 'CSV', mono: true, sample: CSV_SAMPLE },
    output: { label: 'SQL', filename: 'data.sql', rows: 14 },
    fields: [
      { kind: 'text', id: 'table', label: 'Table name', default: 'people', mono: true },
      {
        kind: 'choice',
        id: 'dialect',
        label: 'Quote names for',
        default: 'standard',
        choices: [
          { value: 'standard', label: 'Standard SQL' },
          { value: 'mysql', label: 'MySQL' },
          { value: 'sqlserver', label: 'SQL Server' },
        ],
      },
      { kind: 'number', id: 'batch', label: 'Rows per INSERT', default: 100, min: 1, max: 10000 },
      { kind: 'toggle', id: 'create', label: 'Add CREATE TABLE', default: true },
      DETECT,
      DELIM,
    ],
    run: (input, v) => {
      const t = tableFromCsv(input, str(v, 'delimiter'))
      return tableResult(t, tableToSql(t, { table: str(v, 'table'), dialect: dialect(str(v, 'dialect')), create: bool(v, 'create'), batch: num(v, 'batch'), detect: bool(v, 'detect') }))
    },
  },
  'json-to-sql': {
    input: { label: 'JSON array', mono: true, sample: JSON_ROWS_SAMPLE, rows: 10 },
    output: { label: 'SQL', filename: 'data.sql', rows: 14 },
    fields: [
      { kind: 'text', id: 'table', label: 'Table name', default: 'people', mono: true },
      {
        kind: 'choice',
        id: 'dialect',
        label: 'Quote names for',
        default: 'standard',
        choices: [
          { value: 'standard', label: 'Standard SQL' },
          { value: 'mysql', label: 'MySQL' },
          { value: 'sqlserver', label: 'SQL Server' },
        ],
      },
      { kind: 'number', id: 'batch', label: 'Rows per INSERT', default: 100, min: 1, max: 10000 },
      { kind: 'toggle', id: 'create', label: 'Add CREATE TABLE', default: true },
    ],
    run: (input, v) => {
      const t = tableFromJson(parseJson(input))
      return tableResult(t, tableToSql(t, { table: str(v, 'table'), dialect: dialect(str(v, 'dialect')), create: bool(v, 'create'), batch: num(v, 'batch'), detect: false }))
    },
  },
}
