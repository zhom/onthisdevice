/**
 * Shared helpers for the Documents & Data tools: JSON error location, nested
 * key flattening/expansion, table shaping and HTML sanitisation.
 *
 * Everything here is pure and runs in the browser.
 */

export interface Issue {
  message: string
  line?: number
  column?: number
  snippet?: string
}

/* ───────────────────────────────── JSON errors ────────────────────────────── */

interface Guess {
  index: number
  message: string
}

/**
 * V8 often reports "Unexpected token 'N'" with no position at all. Scanning for
 * the handful of things people actually write instead of JSON gives a far more
 * useful message — and an exact offset.
 */
function scanJsonProblem(text: string): Guess | null {
  let i = 0
  let inString = false
  while (i < text.length) {
    const c = text[i]!
    if (inString) {
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === '"') inString = false
      else if (c === '\n') {
        return { index: i, message: 'A string contains a raw line break. Escape it as \\n.' }
      }
      i++
      continue
    }
    if (c === '"') {
      inString = true
      i++
      continue
    }
    if (c === "'") {
      return { index: i, message: 'JSON strings must use double quotes, not single quotes.' }
    }
    if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      return { index: i, message: 'JSON does not allow comments. Remove this one, or use YAML instead.' }
    }
    if (c === 'N' && text.startsWith('NaN', i)) {
      return { index: i, message: 'NaN is not valid JSON. Use null, or quote it as a string.' }
    }
    if (c === 'I' && text.startsWith('Infinity', i)) {
      return { index: i, message: 'Infinity is not valid JSON. Use null, or quote it as a string.' }
    }
    if (c === 'u' && text.startsWith('undefined', i)) {
      return { index: i, message: 'undefined is not valid JSON. Use null, or leave the key out.' }
    }
    if (c === ',') {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j]!)) j++
      const next = text[j]
      if (next === '}' || next === ']') {
        return { index: i, message: `Trailing comma: JSON does not allow a comma before "${next}".` }
      }
      if (next === ',') {
        return { index: j, message: 'Two commas in a row: a value is missing between them.' }
      }
    }
    i++
  }
  return null
}

function positionToLineColumn(text: string, position: number): { line: number; column: number } {
  const before = text.slice(0, position)
  const nl = before.lastIndexOf('\n')
  return { line: before.split('\n').length, column: position - nl }
}

/** Turn a `JSON.parse` failure into a human message with a line and column. */
export function locateJsonError(error: unknown, text: string): Issue {
  const raw = error instanceof Error ? error.message : String(error)
  let position: number | null = null
  let line: number | undefined
  let column: number | undefined

  const lineCol = /line (\d+) column (\d+)/i.exec(raw)
  if (lineCol) {
    line = Number(lineCol[1])
    column = Number(lineCol[2])
  }
  const pos = /position (\d+)/i.exec(raw)
  if (pos) position = Number(pos[1])

  if (line === undefined && position !== null) {
    const at = positionToLineColumn(text, position)
    line = at.line
    column = at.column
  }

  const guess = scanJsonProblem(text)
  if (guess) {
    const at = positionToLineColumn(text, guess.index)
    // The first structural oddity at or before the reported failure point is
    // almost always the real cause — a trailing comma on line 3 makes V8 report
    // line 4, which sends people looking in the wrong place.
    if (line === undefined || position === null || guess.index <= position) {
      return {
        message: guess.message,
        line: at.line,
        column: at.column,
        snippet: text.split('\n')[at.line - 1] ?? '',
      }
    }
  }

  let message = raw
    .replace(/^JSON\.parse:\s*/, '')
    .replace(/\s*in JSON at position \d+.*$/i, '')
    .replace(/\s*at line \d+ column \d+ of the JSON data$/i, '')
    .replace(/^Unexpected token (.) ,/, 'Unexpected token "$1":')
    .trim()

  if (/unexpected end of (json )?input/i.test(raw)) {
    message = 'The JSON ends too early: a bracket, brace or quote was never closed.'
    if (line === undefined) {
      const lines = text.split('\n')
      line = lines.length
      column = (lines[lines.length - 1] ?? '').length + 1
    }
  } else if (/^Unexpected token/i.test(message)) {
    message = message + '. Check for a stray comma, a missing quote, or a single-quoted string.'
  }
  if (message === '') message = 'This is not valid JSON.'

  const snippet = line !== undefined ? (text.split('\n')[line - 1] ?? '') : undefined
  return { message, line, column, snippet }
}

/** `JSON.parse` with a friendly, located error. */
export function parseJsonStrict(text: string): { value: unknown } | { issue: Issue } {
  const trimmed = text.trim()
  if (trimmed === '') return { issue: { message: 'Paste or drop some JSON to get started.' } }
  try {
    return { value: JSON.parse(trimmed) as unknown }
  } catch (error) {
    return { issue: locateJsonError(error, text) }
  }
}

/* ─────────────────────────────── key flattening ───────────────────────────── */

export type PlainObject = Record<string, unknown>

export function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
}

export interface FlattenOptions {
  /** Separator between path segments. Default `.` */
  delimiter?: string
  /** Flatten arrays into `key.0`, `key.1`; otherwise JSON-encode them. Default true. */
  expandArrays?: boolean
}

/** Flatten a nested value into a single-level record of dotted paths. */
export function flattenValue(value: unknown, options: FlattenOptions = {}): PlainObject {
  const delimiter = options.delimiter ?? '.'
  const expandArrays = options.expandArrays ?? true
  const out: PlainObject = {}

  const walk = (node: unknown, prefix: string): void => {
    if (isPlainObject(node)) {
      const keys = Object.keys(node)
      if (keys.length === 0) {
        if (prefix) out[prefix] = ''
        return
      }
      for (const k of keys) walk(node[k], prefix ? prefix + delimiter + k : k)
      return
    }
    if (Array.isArray(node)) {
      if (!expandArrays) {
        out[prefix] = JSON.stringify(node)
        return
      }
      if (node.length === 0) {
        if (prefix) out[prefix] = ''
        return
      }
      node.forEach((item, i) => walk(item, prefix ? `${prefix}${delimiter}${i}` : String(i)))
      return
    }
    out[prefix] = node
  }

  walk(value, '')
  return out
}

const INDEX_RE = /^\d+$/

/** Rebuild a nested structure from dotted keys (`a.b.0.c`). */
export function expandKeys(row: PlainObject, delimiter = '.'): PlainObject {
  const out: PlainObject = {}
  for (const [path, value] of Object.entries(row)) {
    const parts = path.split(delimiter).filter((p) => p !== '')
    if (parts.length === 0) continue
    let node: PlainObject | unknown[] = out
    for (let i = 0; i < parts.length; i++) {
      const key = parts[i]!
      const last = i === parts.length - 1
      const nextKey = parts[i + 1]
      const wantArray = nextKey !== undefined && INDEX_RE.test(nextKey)

      if (Array.isArray(node)) {
        const idx = Number(key)
        if (last) {
          node[idx] = value
        } else {
          const existing = node[idx]
          if (existing === undefined || (typeof existing !== 'object' && existing !== null)) {
            node[idx] = wantArray ? [] : {}
          }
          node = node[idx] as PlainObject | unknown[]
        }
      } else {
        if (last) {
          node[key] = value
        } else {
          const existing = node[key]
          if (!existing || typeof existing !== 'object') node[key] = wantArray ? [] : {}
          node = node[key] as PlainObject | unknown[]
        }
      }
    }
  }
  return out
}

/** All column names across the rows, in first-seen order. */
export function collectColumns(rows: PlainObject[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        out.push(key)
      }
    }
  }
  return out
}

/** Coerce any JSON value into something a spreadsheet cell can hold. */
export function cellValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  return JSON.stringify(value)
}

/** Deeply sort object keys — used by the JSON viewer and formatter. */
export function sortKeysDeep(value: unknown, direction: 'asc' | 'desc' = 'asc'): unknown {
  if (Array.isArray(value)) return value.map((v) => sortKeysDeep(v, direction))
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort((a, b) =>
      direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a),
    )
    const out: PlainObject = {}
    for (const k of keys) out[k] = sortKeysDeep(value[k], direction)
    return out
  }
  return value
}

export interface JsonStats {
  objects: number
  arrays: number
  strings: number
  numbers: number
  booleans: number
  nulls: number
  keys: number
  maxDepth: number
}

export function jsonStats(value: unknown): JsonStats {
  const s: JsonStats = {
    objects: 0,
    arrays: 0,
    strings: 0,
    numbers: 0,
    booleans: 0,
    nulls: 0,
    keys: 0,
    maxDepth: 0,
  }
  const walk = (node: unknown, depth: number): void => {
    if (depth > s.maxDepth) s.maxDepth = depth
    if (Array.isArray(node)) {
      s.arrays++
      for (const item of node) walk(item, depth + 1)
      return
    }
    if (isPlainObject(node)) {
      s.objects++
      const keys = Object.keys(node)
      s.keys += keys.length
      for (const k of keys) walk(node[k], depth + 1)
      return
    }
    if (node === null) s.nulls++
    else if (typeof node === 'string') s.strings++
    else if (typeof node === 'number') s.numbers++
    else if (typeof node === 'boolean') s.booleans++
  }
  walk(value, 1)
  return s
}

/* ────────────────────────────── delimiter guessing ────────────────────────── */

export const DELIMITERS: { value: string; label: string; char: string }[] = [
  { value: 'auto', label: 'Auto-detect', char: '' },
  { value: 'comma', label: 'Comma  ,', char: ',' },
  { value: 'semicolon', label: 'Semicolon  ;', char: ';' },
  { value: 'tab', label: 'Tab', char: '\t' },
  { value: 'pipe', label: 'Pipe  |', char: '|' },
  { value: 'space', label: 'Space', char: ' ' },
]

export function delimiterChar(value: string): string {
  return DELIMITERS.find((d) => d.value === value)?.char ?? ','
}

export function delimiterLabel(char: string): string {
  if (char === '\t') return 'Tab'
  if (char === ' ') return 'Space'
  const found = DELIMITERS.find((d) => d.char === char)
  return found ? found.label.split('  ')[0]! : `"${char}"`
}

/* ─────────────────────────────── HTML sanitising ──────────────────────────── */

const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'col', 'colgroup',
  'dd', 'del', 'details', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2',
  'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'input', 'ins', 'kbd', 'li', 'mark', 'ol',
  'p', 'pre', 'q', 's', 'samp', 'section', 'small', 'span', 'strong', 'sub', 'summary',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'u', 'ul', 'var',
])

const GLOBAL_ATTRS = new Set(['class', 'id', 'title', 'dir', 'lang'])

const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'name']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading']),
  input: new Set(['type', 'checked', 'disabled']),
  ol: new Set(['start', 'reversed', 'type']),
  td: new Set(['colspan', 'rowspan', 'align', 'valign']),
  th: new Set(['colspan', 'rowspan', 'align', 'valign', 'scope']),
  col: new Set(['span', 'align']),
  colgroup: new Set(['span']),
  time: new Set(['datetime']),
  q: new Set(['cite']),
  blockquote: new Set(['cite']),
  del: new Set(['cite', 'datetime']),
  ins: new Set(['cite', 'datetime']),
}

const SAFE_URL = /^(https?:|mailto:|tel:|ftp:|#|\/|\.{1,2}\/|[^:]*$)/i
const SAFE_IMG_URL = /^(https?:|data:image\/(png|jpeg|gif|webp|svg\+xml|avif);base64,|#|\/|\.{1,2}\/|[^:]*$)/i

export interface SanitizeResult {
  html: string
  removedElements: number
  removedAttributes: number
}

/**
 * Allowlist sanitiser. Drops scripts, styles, iframes, event handlers and any
 * URL scheme that can execute code.
 */
export function sanitizeHtml(html: string): SanitizeResult {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return { html: '', removedElements: 0, removedAttributes: 0 }
  }
  const doc = new DOMParser().parseFromString(`<div id="__root">${html}</div>`, 'text/html')
  const root = doc.getElementById('__root')
  if (!root) return { html: '', removedElements: 0, removedAttributes: 0 }

  let removedElements = 0
  let removedAttributes = 0

  const walk = (node: Element): void => {
    const children = Array.from(node.children)
    for (const child of children) {
      const tag = child.tagName.toLowerCase()
      if (!ALLOWED_TAGS.has(tag)) {
        removedElements++
        child.remove()
        continue
      }
      const allowed = TAG_ATTRS[tag]
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase()
        const ok = GLOBAL_ATTRS.has(name) || (allowed?.has(name) ?? false)
        if (!ok || name.startsWith('on')) {
          child.removeAttribute(attr.name)
          removedAttributes++
          continue
        }
        if (name === 'href' && !SAFE_URL.test(attr.value.trim())) {
          child.removeAttribute(attr.name)
          removedAttributes++
        }
        if (name === 'src' && !SAFE_IMG_URL.test(attr.value.trim())) {
          child.removeAttribute(attr.name)
          removedAttributes++
        }
      }
      if (tag === 'a' && child.getAttribute('target') === '_blank') {
        child.setAttribute('rel', 'noopener noreferrer')
      }
      if (tag === 'input') {
        child.setAttribute('disabled', '')
      }
      walk(child)
    }
  }

  walk(root)
  return { html: root.innerHTML, removedElements, removedAttributes }
}

/** Escape text for safe interpolation into an HTML document. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/* ──────────────────────────────── misc helpers ────────────────────────────── */

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Could not read “${file.name}”.`))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsText(file)
  })
}

export function countLines(text: string): number {
  if (text === '') return 0
  let n = 1
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++
  return n
}

/** A one-line preview of where an error is, with a caret under the column. */
export function caretLine(snippet: string | undefined, column: number | undefined): string | null {
  if (!snippet || !column || column < 1) return null
  const clipped = snippet.replace(/\t/g, ' ')
  return ' '.repeat(Math.min(column - 1, clipped.length)) + '^'
}
