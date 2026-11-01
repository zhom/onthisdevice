import * as React from 'react'
import Papa from 'papaparse'

import { ToolPanel } from '@/components/shared/ToolPanel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatBytes } from '@/lib/utils'

import {
  DELIMITERS,
  collectColumns,
  delimiterChar,
  delimiterLabel,
  expandKeys,
  type PlainObject,
} from './datautil'
import { Field, TextConverter, ToggleRow, type ConversionResult } from './ui'

const SAMPLE = `id,name,email,role,active,joined,profile.city,profile.country
1,Ada Lovelace,ada@example.com,engineer,true,1843-01-05,London,UK
2,Grace Hopper,grace@example.com,admiral,true,1906-12-09,New York,USA
3,Alan Turing,alan@example.com,,false,1912-06-23,Wilmslow,UK
4,"Katherine Johnson","katherine@example.com",mathematician,true,1918-08-26,Hampton,USA`

const NUMBER_RE = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/

function inferValue(raw: string, enabled: boolean): unknown {
  if (!enabled) return raw
  const t = raw.trim()
  if (t === '') return null
  if (t === 'true' || t === 'TRUE' || t === 'True') return true
  if (t === 'false' || t === 'FALSE' || t === 'False') return false
  if (t === 'null' || t === 'NULL' || t === 'Null') return null
  // Long digit strings are almost always identifiers, not numbers — keep them
  // as strings so leading zeros and precision survive.
  if (NUMBER_RE.test(t) && t.replace(/[^0-9]/g, '').length <= 15 && !/^-?0\d/.test(t)) {
    const n = Number(t)
    if (Number.isFinite(n)) return n
  }
  return raw
}

function uniqueHeaders(row: string[]): string[] {
  const used = new Map<string, number>()
  return row.map((cell, i) => {
    let name = cell.trim()
    if (name === '') name = `column_${i + 1}`
    const seen = used.get(name)
    if (seen === undefined) {
      used.set(name, 1)
      return name
    }
    used.set(name, seen + 1)
    return `${name}_${seen + 1}`
  })
}

type Shape = 'records' | 'columns' | 'arrays'

export default function CsvToJson() {
  const [delimiter, setDelimiter] = React.useState('auto')
  const [hasHeader, setHasHeader] = React.useState(true)
  const [inferTypes, setInferTypes] = React.useState(true)
  const [expandDots, setExpandDots] = React.useState(true)
  const [trimValues, setTrimValues] = React.useState(true)
  const [shape, setShape] = React.useState<Shape>('records')
  const [pretty, setPretty] = React.useState(true)

  const convert = React.useCallback(
    (input: string): ConversionResult => {
      const parsed = Papa.parse<string[]>(input, {
        delimiter: delimiter === 'auto' ? '' : delimiterChar(delimiter),
        skipEmptyLines: 'greedy',
        header: false,
      })

      const fatal = parsed.errors.find((e) => e.code !== 'UndetectableDelimiter')
      if (fatal && parsed.data.length === 0) {
        return {
          output: '',
          issue: {
            message: fatal.message,
            line: typeof fatal.row === 'number' ? fatal.row + 1 : undefined,
            snippet: typeof fatal.row === 'number' ? input.split('\n')[fatal.row] : undefined,
          },
        }
      }

      const rows = parsed.data.filter((r) => Array.isArray(r))
      if (rows.length === 0) {
        return { output: '', issue: { message: 'No rows found. The input looks empty.' } }
      }

      const clean = trimValues ? rows.map((r) => r.map((c) => (typeof c === 'string' ? c.trim() : c))) : rows

      const warnings: string[] = []
      for (const e of parsed.errors) {
        if (e.code === 'TooFewFields' || e.code === 'TooManyFields') {
          warnings.push(`Row ${(e.row ?? 0) + 1}: ${e.message}`)
        }
      }
      if (warnings.length > 4) {
        const extra = warnings.length - 4
        warnings.length = 4
        warnings.push(`…and ${extra} more rows with a different column count.`)
      }

      const headerRow = hasHeader ? uniqueHeaders(clean[0]!.map(String)) : []
      const bodyRows = hasHeader ? clean.slice(1) : clean
      // reduce, not Math.max(...rows) — a spread of 100k+ rows overflows the stack
      const width = clean.reduce((acc, r) => Math.max(acc, r.length), 0)
      const headers =
        hasHeader && headerRow.length >= width
          ? headerRow
          : hasHeader
            ? [...headerRow, ...Array.from({ length: width - headerRow.length }, (_, i) => `column_${headerRow.length + i + 1}`)]
            : Array.from({ length: width }, (_, i) => `column_${i + 1}`)

      let value: unknown
      if (shape === 'arrays') {
        value = bodyRows.map((r) => r.map((c) => inferValue(String(c ?? ''), inferTypes)))
      } else {
        const records: PlainObject[] = bodyRows.map((r) => {
          const obj: PlainObject = {}
          headers.forEach((h, i) => {
            obj[h] = inferValue(String(r[i] ?? ''), inferTypes)
          })
          return expandDots ? expandKeys(obj, '.') : obj
        })
        if (shape === 'records') {
          value = records
        } else {
          const cols = collectColumns(records)
          const out: PlainObject = {}
          for (const c of cols) out[c] = records.map((r) => r[c] ?? null)
          value = out
        }
      }

      const output = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)
      const used = parsed.meta.delimiter || delimiterChar(delimiter)

      return {
        output,
        warnings,
        stats: [
          { label: 'records', value: bodyRows.length.toLocaleString() },
          { label: 'columns', value: String(width) },
          { label: 'delimiter', value: delimiterLabel(used) },
          { label: 'JSON', value: formatBytes(new TextEncoder().encode(output).length) },
        ],
      }
    },
    [delimiter, hasHeader, inferTypes, expandDots, trimValues, shape, pretty],
  )

  return (
    <TextConverter
      idPrefix="csv2json"
      inputTitle="CSV input"
      outputTitle="JSON output"
      placeholder="Paste CSV here, or drop a .csv / .tsv file…"
      accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
      sample={SAMPLE}
      sampleLabel="Sample CSV"
      outputMime="application/json"
      convert={convert}
      downloadName={(base) => `${base}.json`}
      emptyHint="Your JSON will appear here."
      options={
        <ToolPanel
          title="Conversion options"
          description="Everything runs on this device."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="c2j-delimiter" label="Delimiter" hint="Auto-detect inspects the first few rows.">
              <Select value={delimiter} onValueChange={setDelimiter}>
                <SelectTrigger id="c2j-delimiter">
                  <SelectValue placeholder="Auto-detect" />
                </SelectTrigger>
                <SelectContent>
                  {DELIMITERS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="c2j-shape" label="Output shape">
              <Select value={shape} onValueChange={(v) => setShape(v as Shape)}>
                <SelectTrigger id="c2j-shape">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="records">Array of objects</SelectItem>
                  <SelectItem value="columns">Column arrays</SelectItem>
                  <SelectItem value="arrays">Array of arrays</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id="c2j-format" label="Formatting">
              <Select value={pretty ? 'pretty' : 'min'} onValueChange={(v) => setPretty(v === 'pretty')}>
                <SelectTrigger id="c2j-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pretty">Pretty (2-space indent)</SelectItem>
                  <SelectItem value="min">Minified (one line)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ToggleRow
              id="c2j-header"
              label="First row is a header"
              hint="Use row 1 as the JSON keys."
              checked={hasHeader}
              onCheckedChange={setHasHeader}
            />
            <ToggleRow
              id="c2j-types"
              label="Infer value types"
              hint="Turn 42, true and empty cells into numbers, booleans and null."
              checked={inferTypes}
              onCheckedChange={setInferTypes}
            />
            <ToggleRow
              id="c2j-expand"
              label="Expand dotted keys"
              hint="profile.city becomes a nested { profile: { city } } object."
              checked={expandDots}
              onCheckedChange={setExpandDots}
            />
            <ToggleRow
              id="c2j-trim"
              label="Trim whitespace"
              hint="Strip spaces around every value before converting."
              checked={trimValues}
              onCheckedChange={setTrimValues}
            />
          </div>
        </ToolPanel>
      }
    />
  )
}
