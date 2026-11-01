import * as React from 'react'

import { ToolPanel } from '@/components/shared/ToolPanel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatBytes } from '@/lib/utils'

import { countLines, jsonStats, sortKeysDeep } from './datautil'
import { Field, TextConverter, ToggleRow, type ConversionResult } from './ui'
import { YamlParseError, parseYamlAll } from './yaml'

const SAMPLE = `# Deployment configuration
name: onthisdevice
version: 1.4.0
private: true

engines:
  node: ">=20"

scripts:
  dev: astro dev
  build: astro build

keywords: [pdf, images, csv, yaml]

deploy:
  targets:
    - name: production
      branch: main
      regions: [iad, fra]
      env:
        LOG_LEVEL: info
    - name: preview
      branch: "*"
      regions: [iad]

notice: |
  Line one
  Line two
  Line three
`

export default function YamlToJson() {
  const [pretty, setPretty] = React.useState(true)
  const [indent, setIndent] = React.useState('2')
  const [sortKeys, setSortKeys] = React.useState(false)
  const [legacyBooleans, setLegacyBooleans] = React.useState(false)
  const [multiDoc, setMultiDoc] = React.useState<'first' | 'array'>('array')

  const convert = React.useCallback(
    (input: string): ConversionResult => {
      let docs: unknown[]
      try {
        docs = parseYamlAll(input, { legacyBooleans })
      } catch (error) {
        if (error instanceof YamlParseError) {
          return {
            output: '',
            issue: {
              message: error.message,
              line: error.line,
              column: error.column,
              snippet: error.snippet,
            },
          }
        }
        return {
          output: '',
          issue: { message: error instanceof Error ? error.message : 'This YAML could not be parsed.' },
        }
      }

      const warnings: string[] = []
      let value: unknown
      if (docs.length > 1) {
        if (multiDoc === 'first') {
          value = docs[0]
          warnings.push(
            `This stream has ${docs.length} documents. Only the first was converted. Switch to “JSON array” to keep them all.`,
          )
        } else {
          value = docs
          warnings.push(`This stream has ${docs.length} documents, so the output is a JSON array of ${docs.length} values.`)
        }
      } else {
        value = docs[0] ?? null
      }

      const sorted = sortKeys ? sortKeysDeep(value) : value
      let output: string
      try {
        output = (pretty ? JSON.stringify(sorted, null, Number(indent)) : JSON.stringify(sorted)) ?? 'null'
      } catch {
        return { output: '', issue: { message: 'That structure could not be written as JSON.' } }
      }

      if (/(:\s*(NaN|Infinity|-Infinity))|\.inf|\.nan/.test(input) && /null/.test(output)) {
        warnings.push('JSON has no NaN or Infinity, so those values were written as null.')
      }

      const stats = jsonStats(sorted)
      return {
        output,
        warnings,
        stats: [
          { label: 'keys', value: stats.keys.toLocaleString() },
          { label: 'levels deep', value: String(stats.maxDepth) },
          { label: 'lines', value: countLines(output).toLocaleString() },
          { label: 'JSON', value: formatBytes(new TextEncoder().encode(output).length) },
        ],
      }
    },
    [pretty, indent, sortKeys, legacyBooleans, multiDoc],
  )

  return (
    <TextConverter
      idPrefix="yaml2json"
      inputTitle="YAML input"
      outputTitle="JSON output"
      placeholder="Paste YAML here, or drop a .yaml / .yml file…"
      accept=".yaml,.yml,.txt,text/yaml,application/x-yaml,text/plain"
      sample={SAMPLE}
      sampleLabel="Sample YAML"
      outputMime="application/json"
      convert={convert}
      downloadName={(base) => `${base}.json`}
      emptyHint="Your JSON will appear here."
      options={
        <ToolPanel title="Parsing and output" description="Comments and block scalars are handled; errors show the exact line.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="y2j-format" label="Formatting">
              <Select value={pretty ? 'pretty' : 'min'} onValueChange={(v) => setPretty(v === 'pretty')}>
                <SelectTrigger id="y2j-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pretty">Pretty printed</SelectItem>
                  <SelectItem value="min">Minified</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id="y2j-indent" label="Indent width">
              <Select value={indent} onValueChange={setIndent} disabled={!pretty}>
                <SelectTrigger id="y2j-indent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 spaces</SelectItem>
                  <SelectItem value="4">4 spaces</SelectItem>
                  <SelectItem value="8">8 spaces</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id="y2j-multi" label="Multiple documents" hint="YAML streams separated by ---">
              <Select value={multiDoc} onValueChange={(v) => setMultiDoc(v as 'first' | 'array')}>
                <SelectTrigger id="y2j-multi">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="array">Combine into a JSON array</SelectItem>
                  <SelectItem value="first">Convert the first document only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ToggleRow
              id="y2j-sort"
              label="Sort keys alphabetically"
              checked={sortKeys}
              onCheckedChange={setSortKeys}
            />
            <ToggleRow
              id="y2j-legacy"
              label="Treat yes / no / on / off as booleans"
              hint="YAML 1.1 behaviour. Off means they stay strings, as YAML 1.2 specifies."
              checked={legacyBooleans}
              onCheckedChange={setLegacyBooleans}
            />
          </div>
        </ToolPanel>
      }
    />
  )
}
