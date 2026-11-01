import * as React from 'react'
import Papa from 'papaparse'

import { ToolPanel } from '@/components/shared/ToolPanel'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatBytes } from '@/lib/utils'

import {
  cellValue,
  collectColumns,
  delimiterChar,
  flattenValue,
  isPlainObject,
  parseJsonStrict,
  type PlainObject,
} from './datautil'
import { Field, TextConverter, ToggleRow, type ConversionResult } from './ui'

const SAMPLE = `[
  {
    "id": 1,
    "name": "Ada Lovelace",
    "contact": { "email": "ada@example.com", "city": "London" },
    "skills": ["analysis", "mathematics"],
    "active": true
  },
  {
    "id": 2,
    "name": "Grace Hopper",
    "contact": { "email": "grace@example.com", "city": "New York" },
    "skills": ["compilers", "COBOL"],
    "active": true
  },
  {
    "id": 3,
    "name": "Alan Turing",
    "contact": { "email": "alan@example.com", "city": "Wilmslow" },
    "skills": ["cryptanalysis"],
    "active": false
  }
]`

const OUT_DELIMITERS = [
  { value: 'comma', label: 'Comma  ,' },
  { value: 'semicolon', label: 'Semicolon  ;' },
  { value: 'tab', label: 'Tab  (TSV)' },
  { value: 'pipe', label: 'Pipe  |' },
]

interface Shaped {
  rows: PlainObject[]
  note?: string
}

/** Turn any reasonable JSON document into a list of row objects. */
function shapeRows(value: unknown): Shaped | { error: string } {
  if (Array.isArray(value)) {
    if (value.length === 0) return { error: 'The JSON array is empty, so there are no rows to write.' }
    if (value.every((v) => Array.isArray(v))) {
      const rows = (value as unknown[][]).map((r) => {
        const obj: PlainObject = {}
        r.forEach((cell, i) => {
          obj[`column_${i + 1}`] = cell
        })
        return obj
      })
      return { rows, note: 'Array of arrays: columns were named column_1, column_2, …' }
    }
    if (value.every((v) => isPlainObject(v))) return { rows: value as PlainObject[] }
    return {
      rows: value.map((v) => (isPlainObject(v) ? v : { value: v })),
      note: 'Some entries were not objects; they were written to a single "value" column.',
    }
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
    const allArrays = entries.length > 0 && entries.every(([, v]) => Array.isArray(v))
    if (allArrays) {
      const length = Math.max(...entries.map(([, v]) => (v as unknown[]).length))
      const rows: PlainObject[] = []
      for (let i = 0; i < length; i++) {
        const row: PlainObject = {}
        for (const [k, v] of entries) row[k] = (v as unknown[])[i] ?? null
        rows.push(row)
      }
      return { rows, note: 'Column arrays were transposed into rows.' }
    }
    return { rows: [value], note: 'A single object became a single CSV row.' }
  }
  return { error: 'CSV needs an array of objects (or an object of column arrays) at the top level.' }
}

export default function JsonToCsv() {
  const [delimiter, setDelimiter] = React.useState('comma')
  const [flatten, setFlatten] = React.useState(true)
  const [expandArrays, setExpandArrays] = React.useState(false)
  const [includeHeader, setIncludeHeader] = React.useState(true)
  const [quoteAll, setQuoteAll] = React.useState(false)
  const [crlf, setCrlf] = React.useState(false)
  const [bom, setBom] = React.useState(false)
  const [order, setOrder] = React.useState<'source' | 'alpha' | 'custom'>('source')
  const [customOrder, setCustomOrder] = React.useState('')

  const convert = React.useCallback(
    (input: string): ConversionResult => {
      const parsed = parseJsonStrict(input)
      if ('issue' in parsed) return { output: '', issue: parsed.issue }

      const shaped = shapeRows(parsed.value)
      if ('error' in shaped) return { output: '', issue: { message: shaped.error } }

      const warnings: string[] = []
      if (shaped.note) warnings.push(shaped.note)

      const rows = shaped.rows.map((row) =>
        flatten ? flattenValue(row, { delimiter: '.', expandArrays }) : mapShallow(row),
      )

      let columns = collectColumns(rows)
      if (columns.length === 0) {
        return { output: '', issue: { message: 'The rows have no fields, so there are no columns to write.' } }
      }
      if (order === 'alpha') {
        columns = columns.slice().sort((a, b) => a.localeCompare(b))
      } else if (order === 'custom') {
        const wanted = customOrder
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        const known = new Set(columns)
        const picked = wanted.filter((c) => known.has(c))
        const missing = wanted.filter((c) => !known.has(c))
        if (missing.length > 0) warnings.push(`Not in the data, so ignored: ${missing.join(', ')}`)
        const rest = columns.filter((c) => !picked.includes(c))
        columns = picked.length > 0 ? [...picked, ...rest] : columns
      }

      const data = rows.map((row) => columns.map((c) => cellValue(row[c])))

      const csv = Papa.unparse(
        { fields: columns, data },
        {
          delimiter: delimiterChar(delimiter),
          header: includeHeader,
          quotes: quoteAll,
          quoteChar: '"',
          escapeChar: '"',
          newline: crlf ? '\r\n' : '\n',
        },
      )
      const output = (bom ? '﻿' : '') + csv

      return {
        output,
        warnings,
        stats: [
          { label: 'rows', value: rows.length.toLocaleString() },
          { label: 'columns', value: String(columns.length) },
          { label: 'CSV', value: formatBytes(new TextEncoder().encode(output).length) },
        ],
      }
    },
    [delimiter, flatten, expandArrays, includeHeader, quoteAll, crlf, bom, order, customOrder],
  )

  return (
    <TextConverter
      idPrefix="json2csv"
      inputTitle="JSON input"
      outputTitle={delimiter === 'tab' ? 'TSV output' : 'CSV output'}
      placeholder='Paste JSON here, or drop a .json file… e.g. [{"id":1,"name":"Ada"}]'
      accept=".json,.txt,application/json,text/plain"
      sample={SAMPLE}
      sampleLabel="Sample JSON"
      outputMime={delimiter === 'tab' ? 'text/tab-separated-values' : 'text/csv'}
      convert={convert}
      downloadName={(base) => `${base}.${delimiter === 'tab' ? 'tsv' : 'csv'}`}
      emptyHint="Your CSV will appear here."
      options={
        <ToolPanel title="Conversion options" description="Nested objects become dotted column names.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="j2c-delimiter" label="Delimiter">
              <Select value={delimiter} onValueChange={setDelimiter}>
                <SelectTrigger id="j2c-delimiter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUT_DELIMITERS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="j2c-order" label="Column order">
              <Select value={order} onValueChange={(v) => setOrder(v as 'source' | 'alpha' | 'custom')}>
                <SelectTrigger id="j2c-order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="source">As they appear in the JSON</SelectItem>
                  <SelectItem value="alpha">Alphabetical</SelectItem>
                  <SelectItem value="custom">Custom list</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              id="j2c-custom"
              label="Custom column order"
              hint="Comma-separated. Columns you leave out are appended in source order."
            >
              <Input
                id="j2c-custom"
                value={customOrder}
                disabled={order !== 'custom'}
                placeholder="id, name, contact.email"
                onChange={(e) => setCustomOrder(e.currentTarget.value)}
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <ToggleRow
              id="j2c-flatten"
              label="Flatten nested objects"
              hint="contact.email instead of dropping the nesting."
              checked={flatten}
              onCheckedChange={setFlatten}
            />
            <ToggleRow
              id="j2c-arrays"
              label="Split arrays into columns"
              hint="skills.0, skills.1 … instead of one JSON-encoded cell."
              checked={expandArrays}
              onCheckedChange={setExpandArrays}
            />
            <ToggleRow
              id="j2c-header"
              label="Write a header row"
              checked={includeHeader}
              onCheckedChange={setIncludeHeader}
            />
            <ToggleRow
              id="j2c-quotes"
              label="Quote every field"
              hint="Off = quote only when the value contains a delimiter, quote or newline."
              checked={quoteAll}
              onCheckedChange={setQuoteAll}
            />
            <ToggleRow
              id="j2c-crlf"
              label="Windows line endings"
              hint="Use CRLF, which some legacy importers require."
              checked={crlf}
              onCheckedChange={setCrlf}
            />
            <ToggleRow
              id="j2c-bom"
              label="Add UTF-8 BOM"
              hint="Makes Excel open accented characters correctly."
              checked={bom}
              onCheckedChange={setBom}
            />
          </div>
        </ToolPanel>
      }
    />
  )
}

/** Keep the top level but JSON-encode anything non-scalar. */
function mapShallow(row: PlainObject): PlainObject {
  const out: PlainObject = {}
  for (const [k, v] of Object.entries(row)) out[k] = v
  return out
}
