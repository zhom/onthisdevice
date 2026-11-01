import { useCallback, useMemo, useRef, useState } from 'react'
import { AlignLeft, Braces, CheckCircle2, FileUp, Quote, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { CodePane, Segmented, StatChips } from './DevUi'
import { errorExcerpt, positionOf } from './devlib'
import { formatBytes, formatNumber } from '@/lib/utils'

type IndentKey = '2' | '4' | 'tab'
type Mode = 'pretty' | 'minify' | 'ts'

const SAMPLE = `{
  "id": 42,
  "name": "Ada Lovelace",
  "active": true,
  "roles": ["admin", "engineer"],
  "profile": { "city": "London", "since": 1843, "score": 9.75 },
  "manager": null
}`

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

interface ParseFailure {
  ok: false
  message: string
  index: number | null
}
interface ParseSuccess {
  ok: true
  value: unknown
}

function parseJson(text: string): ParseSuccess | ParseFailure {
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    const match = /position (\d+)/.exec(raw)
    const index = match ? Number(match[1]) : null
    return { ok: false, message: raw.replace(/^JSON\.parse: /, ''), index }
  }
}

/** Extra hints for the mistakes that cause the overwhelming majority of failures. */
function diagnose(text: string, index: number | null): string | null {
  if (index === null) return null
  const before = text.slice(0, index)
  const trimmedBefore = before.replace(/\s+$/, '')
  const ch = text[index]
  if (trimmedBefore.endsWith(',') && (ch === '}' || ch === ']')) {
    return 'There is a trailing comma before this closing bracket. JSON does not allow one.'
  }
  if (ch === "'") {
    return 'JSON strings must use double quotes. Replace the single quotes with double quotes.'
  }
  if (ch === '/' && (text[index + 1] === '/' || text[index + 1] === '*')) {
    return 'Comments are not part of JSON. Strip the // or /* */ block before parsing.'
  }
  if (/[A-Za-z_$]/.test(ch ?? '') && /[{,]\s*$/.test(trimmedBefore)) {
    return 'Object keys must be wrapped in double quotes, even when they look like identifiers.'
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Transforms                                                          */
/* ------------------------------------------------------------------ */

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort((a, b) => a.localeCompare(b))) {
      out[key] = sortDeep(source[key])
    }
    return out
  }
  return value
}

interface Stats {
  nodes: number
  depth: number
  objects: number
  arrays: number
  strings: number
  numbers: number
  booleans: number
  nulls: number
  keys: number
}

function collectStats(value: unknown): Stats {
  const stats: Stats = {
    nodes: 0,
    depth: 0,
    objects: 0,
    arrays: 0,
    strings: 0,
    numbers: 0,
    booleans: 0,
    nulls: 0,
    keys: 0,
  }
  const walk = (node: unknown, depth: number): void => {
    stats.nodes += 1
    if (depth > stats.depth) stats.depth = depth
    if (Array.isArray(node)) {
      stats.arrays += 1
      for (const item of node) walk(item, depth + 1)
    } else if (node !== null && typeof node === 'object') {
      stats.objects += 1
      const entries = Object.entries(node as Record<string, unknown>)
      stats.keys += entries.length
      for (const [, v] of entries) walk(v, depth + 1)
    } else if (typeof node === 'string') stats.strings += 1
    else if (typeof node === 'number') stats.numbers += 1
    else if (typeof node === 'boolean') stats.booleans += 1
    else stats.nulls += 1
  }
  walk(value, 1)
  return stats
}

/* ------------------------------------------------------------------ */
/* JSON → TypeScript                                                   */
/* ------------------------------------------------------------------ */

interface TsContext {
  interfaces: Map<string, string>
  used: Set<string>
}

function pascalCase(input: string): string {
  const parts = input.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const joined = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')
  if (!joined) return 'Item'
  return /^[0-9]/.test(joined) ? `N${joined}` : joined
}

function singular(name: string): string {
  if (/ies$/i.test(name) && name.length > 4) return `${name.slice(0, -3)}y`
  if (/(ses|xes|zes|ches|shes)$/i.test(name)) return name.slice(0, -2)
  if (/[^s]s$/i.test(name)) return name.slice(0, -1)
  return name
}

function reserveName(base: string, ctx: TsContext): string {
  let name = pascalCase(base)
  if (!ctx.used.has(name)) {
    ctx.used.add(name)
    return name
  }
  let n = 2
  while (ctx.used.has(`${name}${n}`)) n += 1
  const final = `${name}${n}`
  ctx.used.add(final)
  return final
}

function safeKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
}

function unionOf(values: unknown[], nameHint: string, ctx: TsContext): string {
  if (values.length === 0) return 'unknown'
  const objects = values.filter(
    (v): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v),
  )
  const arrays = values.filter((v): v is unknown[] => Array.isArray(v))
  const primitives = new Set<string>()
  for (const v of values) {
    if (v === null) primitives.add('null')
    else if (typeof v === 'string') primitives.add('string')
    else if (typeof v === 'number') primitives.add('number')
    else if (typeof v === 'boolean') primitives.add('boolean')
  }

  const parts: string[] = []
  if (objects.length > 0) parts.push(objectInterface(objects, nameHint, ctx))
  if (arrays.length > 0) {
    const items = arrays.flat()
    const inner = unionOf(items, singular(nameHint), ctx)
    parts.push(inner.includes(' | ') ? `(${inner})[]` : `${inner}[]`)
  }
  for (const p of primitives) parts.push(p)
  return parts.length > 0 ? parts.join(' | ') : 'unknown'
}

function objectInterface(objects: Record<string, unknown>[], nameHint: string, ctx: TsContext): string {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const obj of objects) {
    for (const key of Object.keys(obj)) {
      if (!seen.has(key)) {
        seen.add(key)
        keys.push(key)
      }
    }
  }
  if (keys.length === 0) return 'Record<string, never>'

  const name = reserveName(singular(nameHint), ctx)
  ctx.interfaces.set(name, '')

  const lines = keys.map((key) => {
    const present = objects.filter((o) => Object.prototype.hasOwnProperty.call(o, key))
    const optional = present.length !== objects.length
    const type = unionOf(
      present.map((o) => o[key]),
      key,
      ctx,
    )
    return `  ${safeKey(key)}${optional ? '?' : ''}: ${type}`
  })

  ctx.interfaces.set(name, `export interface ${name} {\n${lines.join('\n')}\n}`)
  return name
}

function jsonToTypeScript(value: unknown, rootName = 'Root'): string {
  const ctx: TsContext = { interfaces: new Map(), used: new Set() }
  const rootIsObject = value !== null && typeof value === 'object' && !Array.isArray(value)
  // When the root is not a plain object it becomes a type alias, so the alias
  // name must be reserved before any generated interface can claim it.
  if (!rootIsObject) ctx.used.add(pascalCase(rootName))
  const rootType = unionOf([value], rootIsObject ? rootName : `${rootName} item`, ctx)
  const blocks = [...ctx.interfaces.values()].filter(Boolean)
  const isNamedInterface = ctx.interfaces.has(rootType)
  const header = isNamedInterface ? '' : `export type ${pascalCase(rootName)} = ${rootType}\n`
  if (blocks.length === 0) return header || `export type ${pascalCase(rootName)} = ${rootType}\n`
  return `${header ? `${header}\n` : ''}${blocks.join('\n\n')}\n`
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function JsonFormatter() {
  const [input, setInput] = useState(SAMPLE)
  const [mode, setMode] = useState<Mode>('pretty')
  const [indent, setIndent] = useState<IndentKey>('2')
  const [sortKeys, setSortKeys] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const parsed = useMemo(() => (input.trim() ? parseJson(input) : null), [input])

  const indentValue = indent === 'tab' ? '\t' : Number(indent)

  const output = useMemo(() => {
    if (!parsed || !parsed.ok) return ''
    const value = sortKeys ? sortDeep(parsed.value) : parsed.value
    if (mode === 'minify') return JSON.stringify(value)
    if (mode === 'ts') return jsonToTypeScript(value)
    return JSON.stringify(value, null, indentValue)
  }, [parsed, sortKeys, mode, indentValue])

  const stats = useMemo(() => (parsed && parsed.ok ? collectStats(parsed.value) : null), [parsed])

  const errorPosition = useMemo(() => {
    if (!parsed || parsed.ok || parsed.index === null) return null
    return positionOf(input, parsed.index)
  }, [parsed, input])

  // Reading a large file off disk is the only genuinely slow step here.
  const onPickFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      setInput(await file.text())
    } finally {
      setBusy(false)
    }
  }, [])

  const escapeString = useCallback(() => {
    setInput((current) => JSON.stringify(current))
    setMode('minify')
  }, [])

  const unescapeString = useCallback(() => {
    setInput((current) => {
      const trimmed = current.trim()
      try {
        const parsedValue: unknown = JSON.parse(
          trimmed.startsWith('"') ? trimmed : JSON.stringify(trimmed),
        )
        return typeof parsedValue === 'string' ? parsedValue : current
      } catch {
        return current
      }
    })
    setMode('pretty')
  }, [])

  const outputBlob = useMemo(
    () =>
      output
        ? new Blob([output], {
            type: mode === 'ts' ? 'text/plain;charset=utf-8' : 'application/json;charset=utf-8',
          })
        : null,
    [output, mode],
  )

  const byteSize = useMemo(() => new Blob([input]).size, [input])
  const outputSize = useMemo(() => (output ? new Blob([output]).size : 0), [output])

  return (
    <div className="flex flex-col gap-4">
      <ToolPanel
        title="JSON input"
        description="Paste JSON, or load a .json file. Your browser parses it, and nothing is uploaded."
      >
        <CodePane
          label="JSON"
          value={input}
          onChange={setInput}
          rows={14}
          wrap={false}
          copyable
          placeholder='{ "hello": "world" }'
          footer={`${formatNumber(input.length, 0)} characters · ${formatBytes(byteSize)}`}
          actions={
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.txt,application/json,text/plain"
                className="sr-only"
                // Only the "Load file" button next to it is meant to be
                // reachable; `sr-only` still leaves the input in the tab order
                // and in the a11y tree, where it has no name at all.
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                  void onPickFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileRef.current?.click()}
              >
                <FileUp className="size-4" aria-hidden="true" />
                Load file
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setInput('')}
                disabled={input.length === 0}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Clear
              </Button>
            </>
          }
        />

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Segmented
            label="Output mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'pretty', label: 'Beautify' },
              { value: 'minify', label: 'Minify' },
              { value: 'ts', label: 'TypeScript' },
            ]}
          />

          {mode === 'pretty' && (
            <Segmented
              label="Indentation"
              value={indent}
              onChange={setIndent}
              options={[
                { value: '2', label: '2 spaces' },
                { value: '4', label: '4 spaces' },
                { value: 'tab', label: 'Tab' },
              ]}
            />
          )}

          <div className="flex items-center gap-2">
            <Switch id="json-sort-keys" checked={sortKeys} onCheckedChange={setSortKeys} />
            <Label htmlFor="json-sort-keys" className="text-sm">
              Sort keys A→Z
            </Label>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:ml-auto">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={escapeString}>
              <Quote className="size-4" aria-hidden="true" />
              Escape
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={unescapeString}
            >
              <AlignLeft className="size-4" aria-hidden="true" />
              Unescape
            </Button>
          </div>
        </div>
      </ToolPanel>

      <div role="status" aria-live="polite" className="flex flex-col gap-4">
        {parsed && !parsed.ok ? (
          <ErrorNote
            title={
              errorPosition
                ? `Invalid JSON at line ${errorPosition.line}, column ${errorPosition.column}`
                : 'Invalid JSON'
            }
            message={
              <span className="block space-y-2">
                <span className="block">{parsed.message}</span>
                {diagnose(input, parsed.index) ? (
                  <span className="block font-medium">{diagnose(input, parsed.index)}</span>
                ) : null}
                {parsed.index !== null ? (
                  <span className="block overflow-x-auto rounded bg-background p-2 font-mono text-xs whitespace-pre">
                    {errorExcerpt(input, parsed.index)}
                  </span>
                ) : null}
              </span>
            }
          />
        ) : null}

        {parsed && parsed.ok ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Valid JSON
            </span>
            {stats ? (
              <StatChips
                items={[
                  { label: 'Nodes', value: formatNumber(stats.nodes, 0) },
                  { label: 'Depth', value: formatNumber(stats.depth, 0) },
                  { label: 'Keys', value: formatNumber(stats.keys, 0) },
                  { label: 'Objects', value: formatNumber(stats.objects, 0) },
                  { label: 'Arrays', value: formatNumber(stats.arrays, 0) },
                  { label: 'Strings', value: formatNumber(stats.strings, 0) },
                  { label: 'Numbers', value: formatNumber(stats.numbers, 0) },
                  { label: 'Size', value: formatBytes(byteSize) },
                ]}
              />
            ) : null}
            {busy ? <span className="text-xs text-muted-foreground">Reading file…</span> : null}
          </div>
        ) : null}
      </div>

      <ToolPanel
        title={
          mode === 'ts' ? 'Generated TypeScript' : mode === 'minify' ? 'Minified JSON' : 'Formatted JSON'
        }
        description={
          mode === 'ts'
            ? 'One interface per nested object. Fields missing from some array elements are marked optional.'
            : mode === 'minify'
              ? `Whitespace removed${output ? `: ${formatBytes(outputSize)}, ${byteSize > 0 ? Math.max(0, Math.round((1 - outputSize / byteSize) * 100)) : 0}% smaller` : ''}.`
              : 'Re-indented with your chosen indentation. Object key order is preserved unless sorting is on.'
        }
        footer={
          output ? (
            <>
              <CopyButton value={output} label="Copy output" variant="default" />
              <DownloadButton
                blob={outputBlob}
                filename={mode === 'ts' ? 'types.ts' : mode === 'minify' ? 'data.min.json' : 'data.json'}
                label="Download"
                variant="outline"
              />
              <a
                href="/json-viewer"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Open in the JSON tree viewer →
              </a>
            </>
          ) : null
        }
      >
        {output ? (
          <CodePane label="Output" value={output} readOnly rows={16} wrap={false} copyable={false} />
        ) : (
          <p className="flex items-center gap-2 rounded-lg bg-muted p-6 text-sm text-muted-foreground">
            <Braces className="size-4 shrink-0" aria-hidden="true" />
            {input.trim()
              ? 'Fix the error above and the formatted output will appear here.'
              : 'Paste JSON above to beautify, minify, validate or convert it.'}
          </p>
        )}
      </ToolPanel>

      <p className="text-xs text-muted-foreground">
        Tip: press{' '}
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
          Tab
        </kbd>{' '}
        to move between the panes.{' '}
        {mode === 'minify' && output
          ? `Minifying saved ${formatBytes(Math.max(0, byteSize - outputSize))}.`
          : null}
      </p>
    </div>
  )
}
