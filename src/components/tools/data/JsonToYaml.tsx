import * as React from 'react'

import { ToolPanel } from '@/components/shared/ToolPanel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatBytes } from '@/lib/utils'

import { countLines, parseJsonStrict, sortKeysDeep } from './datautil'
import { Field, TextConverter, ToggleRow, type ConversionResult } from './ui'
import { stringifyYaml } from './yaml'

const SAMPLE = `{
  "name": "onthisdevice",
  "version": "1.4.0",
  "private": true,
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build"
  },
  "keywords": ["pdf", "images", "csv", "yaml"],
  "deploy": {
    "targets": [
      { "name": "production", "branch": "main", "regions": ["iad", "fra"] },
      { "name": "preview", "branch": "*", "regions": ["iad"] }
    ]
  },
  "notice": "Line one\\nLine two\\nLine three"
}`

export default function JsonToYaml() {
  const [indent, setIndent] = React.useState('2')
  const [sortKeys, setSortKeys] = React.useState(false)
  const [quoteStrings, setQuoteStrings] = React.useState(false)
  const [blockLiterals, setBlockLiterals] = React.useState(true)
  const [documentStart, setDocumentStart] = React.useState(false)

  const convert = React.useCallback(
    (input: string): ConversionResult => {
      const parsed = parseJsonStrict(input)
      if ('issue' in parsed) return { output: '', issue: parsed.issue }

      const value = sortKeys ? sortKeysDeep(parsed.value) : parsed.value
      let output: string
      try {
        output = stringifyYaml(value, {
          indent: Number(indent),
          sortKeys: false,
          quoteStrings,
          blockLiterals,
          documentStart,
        })
      } catch (error) {
        return {
          output: '',
          issue: { message: error instanceof Error ? error.message : 'This value cannot be written as YAML.' },
        }
      }

      const jsonBytes = new TextEncoder().encode(input.trim()).length
      const yamlBytes = new TextEncoder().encode(output).length
      const delta = jsonBytes > 0 ? Math.round(((jsonBytes - yamlBytes) / jsonBytes) * 100) : 0

      return {
        output,
        stats: [
          { label: 'lines', value: countLines(output).toLocaleString() },
          { label: 'YAML', value: formatBytes(yamlBytes) },
          { label: delta >= 0 ? 'smaller than the JSON' : 'larger than the JSON', value: `${Math.abs(delta)}%` },
        ],
      }
    },
    [indent, sortKeys, quoteStrings, blockLiterals, documentStart],
  )

  return (
    <TextConverter
      idPrefix="json2yaml"
      inputTitle="JSON input"
      outputTitle="YAML output"
      placeholder="Paste JSON here, or drop a .json file…"
      accept=".json,.txt,application/json,text/plain"
      sample={SAMPLE}
      sampleLabel="Sample JSON"
      outputMime="text/yaml"
      convert={convert}
      downloadName={(base) => `${base}.yaml`}
      emptyHint="Your YAML will appear here."
      options={
        <ToolPanel title="YAML output style" description="The serialiser runs in your browser.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="j2y-indent" label="Indent width" hint="Sequences always use a two-space “- ” marker.">
              <Select value={indent} onValueChange={setIndent}>
                <SelectTrigger id="j2y-indent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 spaces</SelectItem>
                  <SelectItem value="4">4 spaces</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-2">
              <ToggleRow
                id="j2y-sort"
                label="Sort keys alphabetically"
                checked={sortKeys}
                onCheckedChange={setSortKeys}
              />
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <ToggleRow
              id="j2y-block"
              label="Block literals for multi-line text"
              hint="Uses | instead of escaping \\n inside quotes."
              checked={blockLiterals}
              onCheckedChange={setBlockLiterals}
            />
            <ToggleRow
              id="j2y-quote"
              label="Quote every string"
              hint="Safest for values that could be read as numbers or booleans."
              checked={quoteStrings}
              onCheckedChange={setQuoteStrings}
            />
            <ToggleRow
              id="j2y-doc"
              label="Start with ---"
              hint="Adds the document marker some tools expect."
              checked={documentStart}
              onCheckedChange={setDocumentStart}
            />
          </div>
        </ToolPanel>
      }
    />
  )
}
