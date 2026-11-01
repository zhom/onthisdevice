/**
 * Hand-rolled JSON scanner + recursive-descent parser for the `dev-format`
 * batch.
 *
 * `JSON.parse` is the final authority on validity, but its error messages
 * differ between engines and are frequently useless ("Unexpected token < in
 * JSON at position 0"). This parser exists purely to produce a *precise*,
 * engine-independent diagnostic: what was expected, what was found, and the
 * exact line/column — plus a repair pass for the six mistakes that account for
 * almost every real-world failure.
 */

export interface JsonPosition {
  index: number
  line: number
  column: number
}

export interface JsonDiagnostic extends JsonPosition {
  /** "Expected ',' or '}'" */
  expected: string
  /** "found ']'" */
  found: string
  message: string
  /** Plain-language explanation when the pattern is recognised. */
  hint?: string
}

export interface JsonValidationOk {
  ok: true
  value: unknown
  /** Non-fatal observations (duplicate keys, huge numbers, …). */
  warnings: string[]
  stats: JsonStats
}

export interface JsonValidationError {
  ok: false
  error: JsonDiagnostic
  /** Repairable problems found by the linter, even before the parse failed. */
  repairs: JsonRepair[]
}

export type JsonValidation = JsonValidationOk | JsonValidationError

export interface JsonStats {
  bytes: number
  lines: number
  depth: number
  objects: number
  arrays: number
  strings: number
  numbers: number
  booleans: number
  nulls: number
  keys: number
}

export interface JsonRepair {
  id: string
  label: string
  count: number
}

/* ------------------------------------------------------------------ */
/* Position helpers                                                    */
/* ------------------------------------------------------------------ */

function positionAt(text: string, index: number): JsonPosition {
  let line = 1
  let lineStart = 0
  const stop = Math.min(index, text.length)
  for (let i = 0; i < stop; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1
      lineStart = i + 1
    }
  }
  return { index, line, column: index - lineStart + 1 }
}

/** The offending line with a caret under the column. */
export function jsonExcerpt(text: string, at: JsonPosition, context = 1): string {
  const lines = text.split('\n')
  const from = Math.max(0, at.line - 1 - context)
  const to = Math.min(lines.length, at.line + context)
  const gutter = String(to).length
  const out: string[] = []
  for (let i = from; i < to; i += 1) {
    const raw = lines[i].replace(/\t/g, '    ')
    out.push(`${String(i + 1).padStart(gutter, ' ')} │ ${raw}`)
    if (i === at.line - 1) {
      const before = lines[i].slice(0, at.column - 1).replace(/\t/g, '    ')
      out.push(`${' '.repeat(gutter)} │ ${' '.repeat(before.length)}^`)
    }
  }
  return out.join('\n')
}

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

const WHITESPACE = new Set([' ', '\t', '\n', '\r'])

class JsonParseError extends Error {
  constructor(readonly diagnostic: JsonDiagnostic) {
    super(diagnostic.message)
    this.name = 'JsonParseError'
  }
}

class Scanner {
  index = 0
  readonly warnings: string[] = []
  readonly stats: JsonStats

  constructor(readonly text: string) {
    this.stats = {
      bytes: new TextEncoder().encode(text).length,
      lines: text === '' ? 0 : text.split('\n').length,
      depth: 0,
      objects: 0,
      arrays: 0,
      strings: 0,
      numbers: 0,
      booleans: 0,
      nulls: 0,
      keys: 0,
    }
  }

  private describe(ch: string | undefined): string {
    if (ch === undefined) return 'the end of the input'
    if (ch === '\n') return 'a line break'
    if (ch === '\t') return 'a tab'
    return `'${ch}'`
  }

  fail(expected: string, at = this.index, hint?: string): never {
    const pos = positionAt(this.text, Math.min(at, this.text.length))
    const found = this.describe(this.text[at])
    throw new JsonParseError({
      ...pos,
      expected,
      found,
      hint: hint ?? this.guessHint(at),
      message: `Expected ${expected} at line ${pos.line}, column ${pos.column}, but found ${found}.`,
    })
  }

  /** Recognises the handful of near-miss dialects people actually paste. */
  private guessHint(at: number): string | undefined {
    const ch = this.text[at]
    const before = this.text.slice(0, at).replace(/\s+$/, '')
    if (ch === undefined) return 'The document ends before every bracket is closed.'
    if ((before.endsWith(',') && (ch === '}' || ch === ']')) || ch === ',') {
      return 'This looks like a trailing comma. JSON does not allow a comma before a closing bracket.'
    }
    if (ch === "'") return 'JSON strings must use double quotes ("), not single quotes.'
    if (ch === '“' || ch === '”' || ch === '‘' || ch === '’') {
      return 'These are typographic “smart quotes”, usually pasted from a word processor or a chat app. JSON needs straight ASCII quotes.'
    }
    if (ch === '/' && (this.text[at + 1] === '/' || this.text[at + 1] === '*')) {
      return 'JSON has no comments. Strip the // or /* … */ block.'
    }
    if (ch === '#') return 'JSON has no comments. That # line is not valid JSON.'
    if (/^NaN|^Infinity|^-Infinity|^undefined/.test(this.text.slice(at))) {
      return 'NaN, Infinity and undefined are JavaScript values, not JSON values. Use null or a string.'
    }
    if (/[A-Za-z_$]/.test(ch ?? '') && /[{,]$/.test(before)) {
      return 'Object keys must be wrapped in double quotes, even when they look like plain identifiers.'
    }
    if (ch === '<') {
      return 'The input starts with markup. This is usually an HTML error page returned instead of JSON.'
    }
    if (before.endsWith('}') || before.endsWith(']')) {
      return 'There is more content after the end of the document. JSON allows exactly one top-level value; for newline-delimited JSON, validate one line at a time.'
    }
    return undefined
  }

  skipWhitespace(): void {
    while (this.index < this.text.length && WHITESPACE.has(this.text[this.index])) this.index += 1
  }

  parseValue(depth: number): unknown {
    if (depth > this.stats.depth) this.stats.depth = depth
    if (depth > 512) this.fail('a shallower structure', this.index, 'Nesting deeper than 512 levels.')
    this.skipWhitespace()
    const ch = this.text[this.index]
    switch (ch) {
      case '{':
        return this.parseObject(depth)
      case '[':
        return this.parseArray(depth)
      case '"':
        this.stats.strings += 1
        return this.parseString()
      case 't':
        return this.parseLiteral('true', true)
      case 'f':
        return this.parseLiteral('false', false)
      case 'n':
        return this.parseLiteral('null', null)
      default:
        if (ch === '-' || (ch !== undefined && ch >= '0' && ch <= '9')) return this.parseNumber()
        return this.fail('a value (object, array, string, number, true, false or null)')
    }
  }

  private parseLiteral<T>(word: string, value: T): T {
    if (this.text.startsWith(word, this.index)) {
      this.index += word.length
      if (value === null) this.stats.nulls += 1
      else this.stats.booleans += 1
      return value
    }
    return this.fail(`'${word}'`)
  }

  private parseObject(depth: number): Record<string, unknown> {
    this.stats.objects += 1
    this.index += 1 // {
    const out: Record<string, unknown> = {}
    const seen = new Set<string>()
    this.skipWhitespace()
    if (this.text[this.index] === '}') {
      this.index += 1
      return out
    }
    for (;;) {
      this.skipWhitespace()
      if (this.text[this.index] !== '"') this.fail('a double-quoted key')
      const keyStart = this.index
      const key = this.parseString()
      this.stats.keys += 1
      if (seen.has(key)) {
        const pos = positionAt(this.text, keyStart)
        this.warnings.push(
          `Duplicate key "${key}" at line ${pos.line}. JSON parsers keep the last one and silently discard the earlier value.`,
        )
      }
      seen.add(key)
      this.skipWhitespace()
      if (this.text[this.index] !== ':') this.fail("':'")
      this.index += 1
      out[key] = this.parseValue(depth + 1)
      this.skipWhitespace()
      const ch = this.text[this.index]
      if (ch === ',') {
        this.index += 1
        this.skipWhitespace()
        if (this.text[this.index] === '}') {
          this.fail(
            'a key',
            this.index,
            'This is a trailing comma before "}". JSON does not allow one. Delete it.',
          )
        }
        continue
      }
      if (ch === '}') {
        this.index += 1
        return out
      }
      this.fail("',' or '}'")
    }
  }

  private parseArray(depth: number): unknown[] {
    this.stats.arrays += 1
    this.index += 1 // [
    const out: unknown[] = []
    this.skipWhitespace()
    if (this.text[this.index] === ']') {
      this.index += 1
      return out
    }
    for (;;) {
      out.push(this.parseValue(depth + 1))
      this.skipWhitespace()
      const ch = this.text[this.index]
      if (ch === ',') {
        this.index += 1
        this.skipWhitespace()
        if (this.text[this.index] === ']') {
          this.fail(
            'a value',
            this.index,
            'This is a trailing comma before "]". JSON does not allow one. Delete it.',
          )
        }
        continue
      }
      if (ch === ']') {
        this.index += 1
        return out
      }
      this.fail("',' or ']'")
    }
  }

  private parseString(): string {
    this.index += 1 // opening quote
    let out = ''
    for (;;) {
      const ch = this.text[this.index]
      if (ch === undefined) this.fail('a closing double quote', this.index)
      if (ch === '"') {
        this.index += 1
        return out
      }
      if (ch === '\\') {
        const esc = this.text[this.index + 1]
        this.index += 2
        switch (esc) {
          case '"':
            out += '"'
            break
          case '\\':
            out += '\\'
            break
          case '/':
            out += '/'
            break
          case 'b':
            out += '\b'
            break
          case 'f':
            out += '\f'
            break
          case 'n':
            out += '\n'
            break
          case 'r':
            out += '\r'
            break
          case 't':
            out += '\t'
            break
          case 'u': {
            const hex = this.text.slice(this.index, this.index + 4)
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
              this.fail(
                'four hexadecimal digits after \\u',
                this.index,
                'A \\u escape must be followed by exactly four hex digits, e.g. \\u00e9.',
              )
            }
            out += String.fromCharCode(parseInt(hex, 16))
            this.index += 4
            break
          }
          default:
            this.fail(
              'a valid escape (\\" \\\\ \\/ \\b \\f \\n \\r \\t \\uXXXX)',
              this.index - 2,
              `\\${esc ?? ''} is not a JSON escape sequence. A literal backslash must be written as \\\\.`,
            )
        }
        continue
      }
      const code = ch.charCodeAt(0)
      if (code < 0x20) {
        this.fail(
          'an escaped control character',
          this.index,
          code === 10
            ? 'A raw line break inside a string is not allowed. Use \\n.'
            : code === 9
              ? 'A raw tab inside a string is not allowed. Use \\t.'
              : `Control character U+${code.toString(16).padStart(4, '0').toUpperCase()} must be escaped as \\u${code.toString(16).padStart(4, '0')}.`,
        )
      }
      out += ch
      this.index += 1
    }
  }

  private parseNumber(): number {
    const start = this.index
    if (this.text[this.index] === '-') this.index += 1
    if (this.text[this.index] === '0') {
      this.index += 1
      if (/[0-9]/.test(this.text[this.index] ?? '')) {
        this.fail(
          'a fraction, exponent or delimiter',
          this.index,
          'JSON numbers may not have a leading zero. Write 7, not 07.',
        )
      }
    } else if (/[1-9]/.test(this.text[this.index] ?? '')) {
      while (/[0-9]/.test(this.text[this.index] ?? '')) this.index += 1
    } else {
      this.fail('a digit')
    }
    if (this.text[this.index] === '.') {
      this.index += 1
      if (!/[0-9]/.test(this.text[this.index] ?? '')) {
        this.fail('a digit after the decimal point', this.index, 'Write 1.0, not 1.')
      }
      while (/[0-9]/.test(this.text[this.index] ?? '')) this.index += 1
    }
    if (this.text[this.index] === 'e' || this.text[this.index] === 'E') {
      this.index += 1
      if (this.text[this.index] === '+' || this.text[this.index] === '-') this.index += 1
      if (!/[0-9]/.test(this.text[this.index] ?? '')) this.fail('a digit in the exponent')
      while (/[0-9]/.test(this.text[this.index] ?? '')) this.index += 1
    }
    const raw = this.text.slice(start, this.index)
    const value = Number(raw)
    this.stats.numbers += 1
    if (/^-?\d{16,}$/.test(raw) && !Number.isSafeInteger(value)) {
      this.warnings.push(
        `The integer ${raw} is larger than JavaScript can represent exactly; it will round to ${value}. Send large IDs as strings.`,
      )
    }
    return value
  }
}

export function validateJson(text: string): JsonValidation {
  if (text.trim() === '') {
    return {
      ok: false,
      error: {
        index: 0,
        line: 1,
        column: 1,
        expected: 'a JSON value',
        found: 'an empty document',
        message: 'Nothing to validate. Paste some JSON first.',
      },
      repairs: [],
    }
  }

  const scanner = new Scanner(text)
  try {
    const value = scanner.parseValue(1)
    scanner.skipWhitespace()
    if (scanner.index < text.length) {
      scanner.fail('the end of the document', scanner.index)
    }
    return { ok: true, value, warnings: scanner.warnings, stats: scanner.stats }
  } catch (error) {
    if (error instanceof JsonParseError) {
      return { ok: false, error: error.diagnostic, repairs: detectRepairs(text) }
    }
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      error: {
        index: 0,
        line: 1,
        column: 1,
        expected: 'valid JSON',
        found: 'an unreadable document',
        message,
      },
      repairs: detectRepairs(text),
    }
  }
}

/* ------------------------------------------------------------------ */
/* Repair pass                                                         */
/* ------------------------------------------------------------------ */

interface RepairOutcome {
  text: string
  repairs: JsonRepair[]
}

/**
 * A single left-to-right rewrite that is string- and escape-aware. Repairs are
 * conservative: anything inside a string literal is never touched.
 */
export function repairJson(input: string): RepairOutcome {
  const counts: Record<string, number> = {}
  const bump = (id: string) => {
    counts[id] = (counts[id] ?? 0) + 1
  }

  let text = input

  // BOM and smart quotes have to go before the scanner runs, because they
  // change what a string delimiter looks like.
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
    bump('bom')
  }

  const out: string[] = []
  let i = 0
  const n = text.length

  const lastMeaningful = (): string => {
    for (let k = out.length - 1; k >= 0; k -= 1) {
      const piece = out[k]
      const trimmed = piece.replace(/\s+$/, '')
      if (trimmed !== '') return trimmed[trimmed.length - 1]
    }
    return ''
  }

  while (i < n) {
    const ch = text[i]

    // double-quoted string: copy verbatim
    if (ch === '"') {
      let j = i + 1
      while (j < n) {
        if (text[j] === '\\') {
          j += 2
          continue
        }
        if (text[j] === '"') {
          j += 1
          break
        }
        j += 1
      }
      out.push(text.slice(i, j))
      i = j
      continue
    }

    // single-quoted string -> double-quoted
    if (ch === "'") {
      let j = i + 1
      let body = ''
      while (j < n) {
        if (text[j] === '\\') {
          body += text[j] + (text[j + 1] ?? '')
          j += 2
          continue
        }
        if (text[j] === "'") {
          j += 1
          break
        }
        body += text[j]
        j += 1
      }
      out.push(`"${body.replace(/"/g, '\\"')}"`)
      i = j
      bump('single-quotes')
      continue
    }

    // smart quotes used as delimiters
    if (ch === '“' || ch === '”') {
      let j = i + 1
      let body = ''
      while (j < n && text[j] !== '”' && text[j] !== '“') {
        body += text[j]
        j += 1
      }
      out.push(`"${body.replace(/"/g, '\\"')}"`)
      i = j + 1
      bump('smart-quotes')
      continue
    }

    // comments
    if (ch === '/' && text[i + 1] === '/') {
      let j = i
      while (j < n && text[j] !== '\n') j += 1
      i = j
      bump('comments')
      continue
    }
    if (ch === '#' && /^\s*#/.test(text.slice(text.lastIndexOf('\n', i) + 1, i + 1))) {
      let j = i
      while (j < n && text[j] !== '\n') j += 1
      i = j
      bump('comments')
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? n : end + 2
      bump('comments')
      continue
    }

    // trailing comma
    if (ch === ',') {
      let j = i + 1
      while (j < n && WHITESPACE.has(text[j])) j += 1
      if (text[j] === '}' || text[j] === ']') {
        i += 1
        bump('trailing-commas')
        continue
      }
      out.push(',')
      i += 1
      continue
    }

    // JavaScript-only literals
    const rest = text.slice(i)
    const literal = /^(NaN|Infinity|-Infinity|undefined)\b/.exec(rest)
    if (literal && !/[A-Za-z0-9_$]/.test(text[i - 1] ?? '')) {
      out.push('null')
      i += literal[0].length
      bump('js-literals')
      continue
    }

    // unquoted key
    if (/[A-Za-z_$]/.test(ch)) {
      const word = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(rest)
      if (word && !['true', 'false', 'null'].includes(word[0])) {
        let j = i + word[0].length
        while (j < n && WHITESPACE.has(text[j])) j += 1
        const previous = lastMeaningful()
        if (text[j] === ':' && (previous === '{' || previous === ',')) {
          out.push(`"${word[0]}"`)
          i += word[0].length
          bump('unquoted-keys')
          continue
        }
      }
    }

    out.push(ch)
    i += 1
  }

  const LABELS: Record<string, string> = {
    bom: 'Removed a byte-order mark before the first character',
    'single-quotes': 'Replaced single-quoted strings with double quotes',
    'smart-quotes': 'Replaced typographic “smart quotes” with straight quotes',
    comments: 'Stripped // , # and /* … */ comments',
    'trailing-commas': 'Removed trailing commas before } or ]',
    'js-literals': 'Replaced NaN / Infinity / undefined with null',
    'unquoted-keys': 'Added double quotes around bare object keys',
  }

  const repairs: JsonRepair[] = Object.entries(counts).map(([id, count]) => ({
    id,
    count,
    label: LABELS[id] ?? id,
  }))

  return { text: out.join(''), repairs }
}

/** Which repairs *would* apply, without committing to them. */
export function detectRepairs(text: string): JsonRepair[] {
  return repairJson(text).repairs
}

/* ------------------------------------------------------------------ */
/* Emitters                                                            */
/* ------------------------------------------------------------------ */

export type IndentChoice = '2' | '3' | '4' | 'tab'

export function indentString(choice: IndentChoice): string | number {
  if (choice === 'tab') return '\t'
  return Number(choice)
}

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort((a, b) => a.localeCompare(b))) {
      out[key] = sortKeysDeep(source[key])
    }
    return out
  }
  return value
}

/** Minified but readable: one line, a space after every `:` and `,`. */
export function toOneLine(value: unknown, spaced: boolean): string {
  const compact = JSON.stringify(value)
  if (!spaced) return compact
  // Re-emit with separators; JSON.stringify has no separator option, so walk it.
  const walk = (node: unknown): string => {
    if (Array.isArray(node)) return `[${node.map(walk).join(', ')}]`
    if (node !== null && typeof node === 'object') {
      const entries = Object.entries(node as Record<string, unknown>)
      return `{${entries.map(([k, v]) => `${JSON.stringify(k)}: ${walk(v)}`).join(', ')}}`
    }
    return JSON.stringify(node) ?? 'null'
  }
  return walk(value)
}

/** Wraps the whole document as one JSON string literal. */
export function escapeAsJsonString(text: string): string {
  return JSON.stringify(text)
}

/** Reverses `escapeAsJsonString`, tolerating an unquoted body. */
export function unescapeJsonString(text: string): { ok: true; value: string } | { ok: false; message: string } {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: false, message: 'Nothing to unescape. Paste an escaped string first.' }
  const candidate = trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed : `"${trimmed}"`
  try {
    const parsed: unknown = JSON.parse(candidate)
    if (typeof parsed !== 'string') {
      return { ok: false, message: 'That parsed to a JSON value, not a JSON string. Use the validator instead.' }
    }
    return { ok: true, value: parsed }
  } catch {
    return {
      ok: false,
      message:
        'This is not a valid escaped JSON string. Check for a stray backslash, or a quote that was never closed.',
    }
  }
}

export const JSON_SAMPLE = `{
  "order_id": "A-10482",
  "customer": {
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "vip": true
  },
  "items": [
    { "sku": "KB-01", "qty": 1, "unit_price": 89.5 },
    { "sku": "MS-14", "qty": 2, "unit_price": 24 }
  ],
  "discount": null,
  "placed_at": "2026-08-14T09:12:33Z"
}`

export const JSON_BROKEN_SAMPLE = `{
  // pasted straight out of a JS console
  order_id: 'A-10482',
  "total": NaN,
  "items": [
    { "sku": "KB-01", "qty": 1 },
    { "sku": "MS-14", "qty": 2 },
  ],
}`
