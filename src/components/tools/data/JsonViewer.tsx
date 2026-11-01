import * as React from 'react'
import { ChevronDown, ChevronRight, CircleCheck, Expand, Search, Shrink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CopyButton } from '@/components/shared/CopyButton'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes } from '@/lib/utils'

import { isPlainObject, jsonStats, parseJsonStrict, sortKeysDeep } from './datautil'
import { EditorPane, Field, OutputPane, Pane, StatChips, ToggleRow, useDebounced } from './ui'

const SAMPLE = `{
  "store": {
    "name": "Corner Books",
    "open": true,
    "opened": "1998-04-12",
    "staff": 7,
    "location": { "city": "Lisbon", "country": "PT", "geo": [38.7223, -9.1393] },
    "books": [
      { "title": "The Order of Time", "author": "Carlo Rovelli", "price": 12.99, "tags": ["physics", "essay"], "inStock": true },
      { "title": "Piranesi", "author": "Susanna Clarke", "price": 9.5, "tags": ["fiction"], "inStock": false },
      { "title": "Thinking in Systems", "author": "Donella Meadows", "price": 18, "tags": ["systems", "non-fiction"], "inStock": true }
    ],
    "hours": { "mon-fri": "09:00-19:00", "sat": "10:00-14:00", "sun": null }
  }
}`

const MAX_CHILDREN = 300

type Path = string

function childPath(parent: Path, key: string | number): Path {
  if (typeof key === 'number') return `${parent}[${key}]`
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`
}

function isContainer(value: unknown): value is unknown[] | Record<string, unknown> {
  return Array.isArray(value) || isPlainObject(value)
}

function containerPaths(value: unknown, maxDepth: number): Set<Path> {
  const out = new Set<Path>()
  const walk = (node: unknown, path: Path, depth: number): void => {
    if (!isContainer(node)) return
    if (depth < maxDepth) out.add(path)
    if (depth > 24) return
    if (Array.isArray(node)) {
      node.slice(0, MAX_CHILDREN).forEach((v, i) => walk(v, childPath(path, i), depth + 1))
    } else {
      for (const [k, v] of Object.entries(node).slice(0, MAX_CHILDREN)) walk(v, childPath(path, k), depth + 1)
    }
  }
  walk(value, '$', 0)
  return out
}

function summarise(value: unknown): string {
  if (Array.isArray(value)) return `[] ${value.length} item${value.length === 1 ? '' : 's'}`
  const keys = Object.keys(value as Record<string, unknown>)
  return `{} ${keys.length} key${keys.length === 1 ? '' : 's'}`
}

function ScalarValue({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted-foreground">null</span>
  if (typeof value === 'string') {
    return <span className="text-foreground break-all">"{value}"</span>
  }
  if (typeof value === 'number') return <span className="font-semibold text-foreground tabular-nums">{String(value)}</span>
  if (typeof value === 'boolean') return <span className="font-semibold text-foreground">{String(value)}</span>
  return <span className="text-muted-foreground">{String(value)}</span>
}

interface RowProps {
  label: string | null
  value: unknown
  path: Path
  depth: number
  expanded: Set<Path>
  visible: Set<Path> | null
  selected: Path
  onToggle: (path: Path) => void
  onSelect: (path: Path) => void
}

function TreeRow({ label, value, path, depth, expanded, visible, selected, onToggle, onSelect }: RowProps) {
  if (visible && !visible.has(path)) return null
  const container = isContainer(value)
  const open = container && expanded.has(path)
  const indent = { paddingLeft: `${depth * 0.9 + 0.25}rem` }

  const entries: [string | number, unknown][] = !open
    ? []
    : Array.isArray(value)
      ? value.slice(0, MAX_CHILDREN).map((v, i) => [i, v])
      : Object.entries(value as Record<string, unknown>).slice(0, MAX_CHILDREN)

  const hidden = !open
    ? 0
    : Array.isArray(value)
      ? Math.max(0, value.length - MAX_CHILDREN)
      : Math.max(0, Object.keys(value as Record<string, unknown>).length - MAX_CHILDREN)

  return (
    <>
      <div
        style={indent}
        className={`flex items-start gap-1 rounded py-0.5 pr-2 ${
          selected === path ? 'bg-muted font-semibold text-foreground' : 'hover:bg-muted'
        }`}
      >
        {container ? (
          <button
            type="button"
            onClick={() => onToggle(path)}
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${label ?? 'root'}`}
            className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {open ? (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-3.5" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="mt-0.5 inline-block size-4 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(path)}
          className="min-w-0 flex-1 text-left font-mono text-xs leading-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {label !== null ? <span className="text-foreground">{label}</span> : <span className="text-muted-foreground">root</span>}
          {label !== null ? <span className="text-muted-foreground">: </span> : <span className="text-muted-foreground"> </span>}
          {container ? (
            <span className="text-muted-foreground">{summarise(value)}</span>
          ) : (
            <ScalarValue value={value} />
          )}
        </button>
      </div>
      {open
        ? entries.map(([k, v]) => (
            <TreeRow
              key={String(k)}
              label={typeof k === 'number' ? `${k}` : k}
              value={v}
              path={childPath(path, k)}
              depth={depth + 1}
              expanded={expanded}
              visible={visible}
              selected={selected}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        : null}
      {hidden > 0 ? (
        <p style={{ paddingLeft: `${(depth + 1) * 0.9 + 0.25}rem` }} className="py-0.5 text-xs text-muted-foreground">
          …{hidden.toLocaleString()} more entries not shown
        </p>
      ) : null}
    </>
  )
}

function buildVisible(value: unknown, needle: string): { visible: Set<Path>; matches: number } {
  const visible = new Set<Path>()
  let matches = 0
  const q = needle.toLowerCase()
  let budget = 80_000

  const walk = (node: unknown, path: Path, label: string): boolean => {
    if (budget-- <= 0) return false
    let hit = label.toLowerCase().includes(q)
    if (isContainer(node)) {
      const entries: [string | number, unknown][] = Array.isArray(node)
        ? node.map((v, i) => [i, v])
        : Object.entries(node)
      for (const [k, v] of entries) {
        if (walk(v, childPath(path, k), String(k))) hit = true
      }
    } else if (String(node).toLowerCase().includes(q)) {
      hit = true
    }
    if (hit) {
      visible.add(path)
      matches++
    }
    return hit
  }

  walk(value, '$', 'root')
  visible.add('$')
  return { visible, matches }
}

export default function JsonViewer() {
  const [input, setInput] = React.useState('')
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [readError, setReadError] = React.useState<string | null>(null)

  const [indent, setIndent] = React.useState('2')
  const [minify, setMinify] = React.useState(false)
  const [sortKeys, setSortKeys] = React.useState(false)
  const [defaultDepth, setDefaultDepth] = React.useState('2')
  const [query, setQuery] = React.useState('')
  const [expanded, setExpanded] = React.useState<Set<Path>>(new Set(['$']))
  const [selected, setSelected] = React.useState<Path>('$')

  const debouncedInput = useDebounced(input, 200)
  const debouncedQuery = useDebounced(query, 250)

  const parsed = React.useMemo(() => parseJsonStrict(debouncedInput), [debouncedInput])
  const valid = 'value' in parsed
  const value = React.useMemo(
    () => (valid ? (sortKeys ? sortKeysDeep(parsed.value) : parsed.value) : null),
    [parsed, sortKeys],
  )
  const issue = 'issue' in parsed && debouncedInput.trim() !== '' ? parsed.issue : null

  const toggle = React.useCallback((path: Path) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const filtered = React.useMemo(() => {
    if (debouncedQuery.trim() === '' || !valid) return null
    return buildVisible(value, debouncedQuery.trim())
  }, [debouncedQuery, valid, value])

  // Reset the expansion whenever the document, the depth or the filter changes.
  React.useEffect(() => {
    if (!valid) return
    setExpanded(
      filtered
        ? new Set(filtered.visible)
        : containerPaths(value, defaultDepth === 'all' ? 99 : Number(defaultDepth)),
    )
    setSelected('$')
  }, [valid, value, defaultDepth, filtered])

  const formatted = React.useMemo(() => {
    if (!valid) return ''
    try {
      return minify ? JSON.stringify(value) : JSON.stringify(value, null, Number(indent))
    } catch {
      return ''
    }
  }, [valid, value, minify, indent])

  const stats = React.useMemo(() => {
    if (!valid) return null
    const s = jsonStats(value)
    const pretty = JSON.stringify(value, null, 2) ?? ''
    const min = JSON.stringify(value) ?? ''
    return {
      ...s,
      prettyBytes: new TextEncoder().encode(pretty).length,
      minBytes: new TextEncoder().encode(min).length,
    }
  }, [valid, value])

  const base = fileName ? fileName.replace(/\.[^.]+$/, '') : 'data'

  const rootType = Array.isArray(value)
    ? 'array'
    : isPlainObject(value)
      ? 'object'
      : value === null
        ? 'null'
        : typeof value

  const breadcrumb = React.useMemo(() => {
    const parts = selected.match(/(\$|\.[^.[]+|\[[^\]]+\])/g) ?? ['$']
    return parts
  }, [selected])

  return (
    <div className="space-y-4">
      <ToolPanel
        title="Viewer options"
        description="Validate, beautify, minify and explore JSON in your browser tab."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="jv-indent" label="Indent width">
            <Select value={indent} onValueChange={setIndent} disabled={minify}>
              <SelectTrigger id="jv-indent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 spaces</SelectItem>
                <SelectItem value="4">4 spaces</SelectItem>
                <SelectItem value="8">8 spaces</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="jv-depth" label="Expand tree to">
            <Select value={defaultDepth} onValueChange={setDefaultDepth}>
              <SelectTrigger id="jv-depth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 level</SelectItem>
                <SelectItem value="2">2 levels</SelectItem>
                <SelectItem value="3">3 levels</SelectItem>
                <SelectItem value="5">5 levels</SelectItem>
                <SelectItem value="all">Everything</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="jv-search" label="Find a key or value">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="jv-search"
                value={query}
                className="pl-8"
                placeholder="e.g. price"
                onChange={(e) => setQuery(e.currentTarget.value)}
              />
            </div>
          </Field>
          <div className="grid gap-2">
            <ToggleRow id="jv-min" label="Minify output" checked={minify} onCheckedChange={setMinify} />
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <ToggleRow
            id="jv-sort"
            label="Sort keys alphabetically"
            hint="Applies to the tree and the formatted output."
            checked={sortKeys}
            onCheckedChange={setSortKeys}
          />
        </div>
      </ToolPanel>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <EditorPane
          id="jv-input"
          title="JSON input"
          value={input}
          onChange={(v) => {
            setReadError(null)
            setInput(v)
          }}
          placeholder="Paste JSON here, or drop a .json file…"
          accept=".json,.jsonc,.txt,application/json,text/plain"
          sample={SAMPLE}
          sampleLabel="Sample JSON"
          fileName={fileName}
          onFileName={setFileName}
          issue={readError ? { message: readError } : issue}
          onError={setReadError}
          rows={22}
        />

        <Tabs defaultValue="tree" className="min-w-0">
          <TabsList>
            <TabsTrigger value="tree">Tree</TabsTrigger>
            <TabsTrigger value="formatted">Formatted</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="tree" className="mt-2">
            <Pane
              title="Tree view"
              subtitle={
                filtered
                  ? `${filtered.matches.toLocaleString()} match${filtered.matches === 1 ? '' : 'es'} for “${debouncedQuery.trim()}”`
                  : undefined
              }
              actions={
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!valid}
                    onClick={() => setExpanded(containerPaths(value, 99))}
                  >
                    <Expand className="size-3.5" aria-hidden="true" />
                    Expand all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!valid}
                    onClick={() => setExpanded(new Set(['$']))}
                  >
                    <Shrink className="size-3.5" aria-hidden="true" />
                    Collapse
                  </Button>
                </>
              }
            >
              {valid ? (
                <>
                  <div className="flex min-w-0 items-center gap-1 rounded-lg bg-muted px-2 py-1.5">
                    <nav aria-label="Selected path" className="min-w-0 flex-1 overflow-x-auto">
                      <ol className="flex items-center gap-0.5 font-mono text-xs whitespace-nowrap">
                        {breadcrumb.map((part, i) => (
                          <li key={i} className={i === breadcrumb.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                            {part}
                          </li>
                        ))}
                      </ol>
                    </nav>
                    <CopyButton value={selected} label="Copy path" />
                  </div>
                  <div className="min-h-[18rem] overflow-auto rounded-lg bg-background p-2" style={{ maxHeight: '32rem' }}>
                    <TreeRow
                      label={null}
                      value={value}
                      path="$"
                      depth={0}
                      expanded={expanded}
                      visible={filtered ? filtered.visible : null}
                      selected={selected}
                      onToggle={toggle}
                      onSelect={setSelected}
                    />
                  </div>
                </>
              ) : (
                <p className="grid min-h-[18rem] place-items-center rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
                  {input.trim() === ''
                    ? 'Paste JSON on the left and the collapsible tree appears here.'
                    : 'Fix the error shown under the input to see the tree.'}
                </p>
              )}
            </Pane>
          </TabsContent>

          <TabsContent value="formatted" className="mt-2">
            <OutputPane
              id="jv-output"
              title={minify ? 'Minified JSON' : 'Beautified JSON'}
              value={formatted}
              filename={`${base}${minify ? '.min' : ''}.json`}
              mime="application/json"
              emptyHint="Valid JSON will appear here, formatted."
              rows={22}
              downloadLabel="Download JSON"
              stats={
                stats
                  ? [
                      { label: 'pretty', value: formatBytes(stats.prettyBytes) },
                      { label: 'minified', value: formatBytes(stats.minBytes) },
                      {
                        label: 'saved by minifying',
                        value:
                          stats.prettyBytes > 0
                            ? `${Math.round(((stats.prettyBytes - stats.minBytes) / stats.prettyBytes) * 100)}%`
                            : '0%',
                      },
                    ]
                  : []
              }
            />
          </TabsContent>

          <TabsContent value="stats" className="mt-2">
            <Pane title="Document statistics">
              {stats ? (
                <>
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      { k: 'Root type', v: rootType },
                      { k: 'Total keys', v: stats.keys.toLocaleString() },
                      { k: 'Max depth', v: String(stats.maxDepth) },
                      { k: 'Objects', v: stats.objects.toLocaleString() },
                      { k: 'Arrays', v: stats.arrays.toLocaleString() },
                      { k: 'Strings', v: stats.strings.toLocaleString() },
                      { k: 'Numbers', v: stats.numbers.toLocaleString() },
                      { k: 'Booleans', v: stats.booleans.toLocaleString() },
                      { k: 'Nulls', v: stats.nulls.toLocaleString() },
                    ].map((row) => (
                      <div key={row.k} className="rounded-lg bg-muted p-2.5">
                        <dt className="text-[11px] text-muted-foreground">{row.k}</dt>
                        <dd className="text-sm font-semibold">{row.v}</dd>
                      </div>
                    ))}
                  </dl>
                  <StatChips
                    stats={[
                      { label: 'as typed', value: formatBytes(new TextEncoder().encode(debouncedInput).length) },
                      { label: 'beautified', value: formatBytes(stats.prettyBytes) },
                      { label: 'minified', value: formatBytes(stats.minBytes) },
                    ]}
                  />
                  <p role="status" className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
                    <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
                    Valid JSON. It parsed without errors.
                  </p>
                </>
              ) : (
                <p className="grid min-h-[12rem] place-items-center rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
                  Statistics appear once the JSON parses cleanly.
                </p>
              )}
            </Pane>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
