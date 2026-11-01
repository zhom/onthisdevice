/**
 * A compact, dependency-free YAML engine used by the Documents & Data tools.
 *
 * Scope (deliberately chosen to cover the YAML people actually paste into a
 * converter):
 *   - block mappings and block sequences, arbitrarily nested
 *   - flow collections `[a, b]` / `{a: 1}`, including multi-line flow
 *   - single-quoted, double-quoted (with escapes) and plain scalars
 *   - block scalars `|`, `>` with `+`/`-` chomping and explicit indentation
 *   - multi-line folded plain scalars
 *   - comments, document separators (`---`, `...`), multiple documents
 *   - core tag resolution: null, bool, int (dec/hex/octal), float, .inf, .nan
 *
 * Not supported (reported as a clear error rather than silently mis-parsed):
 *   - anchors, aliases and merge keys (`&a`, `*a`, `<<:`)
 *   - explicit `? key` mapping keys
 *   - custom tags
 */

export class YamlParseError extends Error {
  readonly line: number
  readonly column: number
  readonly snippet: string

  constructor(message: string, line: number, column: number, snippet = '') {
    super(message)
    this.name = 'YamlParseError'
    this.line = line
    this.column = column
    this.snippet = snippet
  }
}

export interface YamlParseOptions {
  /** Treat `yes`/`no`/`on`/`off` as booleans (YAML 1.1 behaviour). Default `false`. */
  legacyBooleans?: boolean
}

type Opts = Required<YamlParseOptions>

const DEFAULT_OPTS: Opts = { legacyBooleans: false }

interface Src {
  /** Working text of the line (may be rewritten while parsing `- key: value`). */
  text: string
  /** 1-based line number in the original document. */
  n: number
}

interface Ctx {
  lines: Src[]
  i: number
  opts: Opts
}

/* ────────────────────────────── lexical helpers ───────────────────────────── */

/** Remove a trailing `# comment`, respecting quoted regions. */
function stripComment(text: string): string {
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (inDouble) {
      if (c === '\\') {
        i++
        continue
      }
      if (c === '"') inDouble = false
      continue
    }
    if (inSingle) {
      if (c === "'") {
        if (text[i + 1] === "'") {
          i++
          continue
        }
        inSingle = false
      }
      continue
    }
    if (c === '"') {
      inDouble = true
      continue
    }
    if (c === "'") {
      inSingle = true
      continue
    }
    if (c === '#' && (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\t')) {
      return text.slice(0, i)
    }
  }
  return text
}

function indentOf(line: Src): number {
  let i = 0
  while (i < line.text.length) {
    const c = line.text[i]
    if (c === ' ') i++
    else if (c === '\t') {
      throw new YamlParseError(
        'Tabs cannot be used for indentation in YAML. Replace the tab with spaces.',
        line.n,
        i + 1,
        line.text,
      )
    } else break
  }
  return i
}

function isBlankOrComment(text: string): boolean {
  const t = text.trim()
  return t === '' || t.startsWith('#')
}

/**
 * Index of the `:` that separates a mapping key from its value, or -1 when the
 * line is not a mapping entry. Quotes and flow collections are skipped.
 */
function findKeyColon(text: string): number {
  if (text.startsWith('[') || text.startsWith('{')) return -1
  let depth = 0
  let i = 0
  while (i < text.length) {
    const c = text[i]!
    if (c === '"' || c === "'") {
      const end = skipQuoted(text, i)
      if (end < 0) return -1
      i = end
      continue
    }
    if (c === '[' || c === '{') {
      depth++
      i++
      continue
    }
    if (c === ']' || c === '}') {
      depth--
      i++
      continue
    }
    if (c === '#' && i > 0 && (text[i - 1] === ' ' || text[i - 1] === '\t')) return -1
    if (c === ':' && depth === 0) {
      const next = text[i + 1]
      if (next === undefined || next === ' ' || next === '\t') return i
    }
    i++
  }
  return -1
}

/** Index just past a quoted run starting at `start`, or -1 when unterminated. */
function skipQuoted(text: string, start: number): number {
  const q = text[start]
  let i = start + 1
  while (i < text.length) {
    const c = text[i]!
    if (q === '"') {
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === '"') return i + 1
    } else {
      if (c === "'") {
        if (text[i + 1] === "'") {
          i += 2
          continue
        }
        return i + 1
      }
    }
    i++
  }
  return -1
}

/** Net bracket depth of a flow fragment, quote-aware. */
function flowDepth(text: string): number {
  let depth = 0
  let i = 0
  while (i < text.length) {
    const c = text[i]!
    if (c === '"' || c === "'") {
      const end = skipQuoted(text, i)
      if (end < 0) return depth
      i = end
      continue
    }
    if (c === '[' || c === '{') depth++
    else if (c === ']' || c === '}') depth--
    i++
  }
  return depth
}

/* ─────────────────────────────── scalar values ────────────────────────────── */

const NULL_RE = /^(null|Null|NULL|~)$/
const TRUE_RE = /^(true|True|TRUE)$/
const FALSE_RE = /^(false|False|FALSE)$/
const YES_RE = /^(yes|Yes|YES|on|On|ON|y|Y)$/
const NO_RE = /^(no|No|NO|off|Off|OFF|n|N)$/
const INT_RE = /^[+-]?\d[\d_]*$/
const HEX_RE = /^([+-]?)0x([0-9a-fA-F_]+)$/
const OCT_RE = /^([+-]?)0o([0-7_]+)$/
const BIN_RE = /^([+-]?)0b([01_]+)$/
const FLOAT_RE = /^[+-]?(\d[\d_]*)?\.\d*([eE][+-]?\d+)?$|^[+-]?\.\d+([eE][+-]?\d+)?$|^[+-]?\d[\d_]*[eE][+-]?\d+$/
const INF_RE = /^([+-]?)\.(inf|Inf|INF)$/
const NAN_RE = /^\.(nan|NaN|NAN)$/

function resolvePlain(text: string, opts: Opts): unknown {
  const t = text
  if (t === '') return null
  if (NULL_RE.test(t)) return null
  if (TRUE_RE.test(t)) return true
  if (FALSE_RE.test(t)) return false
  if (opts.legacyBooleans && YES_RE.test(t)) return true
  if (opts.legacyBooleans && NO_RE.test(t)) return false

  const hex = HEX_RE.exec(t)
  if (hex) return (hex[1] === '-' ? -1 : 1) * parseInt(hex[2]!.replace(/_/g, ''), 16)
  const oct = OCT_RE.exec(t)
  if (oct) return (oct[1] === '-' ? -1 : 1) * parseInt(oct[2]!.replace(/_/g, ''), 8)
  const bin = BIN_RE.exec(t)
  if (bin) return (bin[1] === '-' ? -1 : 1) * parseInt(bin[2]!.replace(/_/g, ''), 2)

  const inf = INF_RE.exec(t)
  if (inf) return inf[1] === '-' ? -Infinity : Infinity
  if (NAN_RE.test(t)) return NaN

  if (INT_RE.test(t)) {
    const n = Number(t.replace(/_/g, ''))
    if (Number.isFinite(n)) return n
  }
  if (FLOAT_RE.test(t)) {
    const n = Number(t.replace(/_/g, ''))
    if (Number.isFinite(n)) return n
  }
  return t
}

const DQ_ESCAPES: Record<string, string> = {
  '0': '\0',
  a: '\x07',
  b: '\b',
  t: '\t',
  '\t': '\t',
  n: '\n',
  v: '\v',
  f: '\f',
  r: '\r',
  e: '\x1b',
  ' ': ' ',
  '"': '"',
  '/': '/',
  '\\': '\\',
  N: '\x85',
  _: '\xa0',
  L: ' ',
  P: ' ',
}

function decodeDoubleQuoted(raw: string, line: number, column: number): string {
  // `raw` includes the surrounding quotes.
  let out = ''
  let i = 1
  for (; i < raw.length; i++) {
    const c = raw[i]!
    if (c === '"') break
    if (c === '\\') {
      const e = raw[i + 1]
      if (e === undefined) {
        throw new YamlParseError('String ends with a dangling backslash.', line, column + i, raw)
      }
      if (e === 'x' || e === 'u' || e === 'U') {
        const len = e === 'x' ? 2 : e === 'u' ? 4 : 8
        const hex = raw.slice(i + 2, i + 2 + len)
        if (hex.length !== len || !/^[0-9a-fA-F]+$/.test(hex)) {
          throw new YamlParseError(
            `Invalid \\${e} escape: expected ${len} hexadecimal digits.`,
            line,
            column + i,
            raw,
          )
        }
        out += String.fromCodePoint(parseInt(hex, 16))
        i += 1 + len
        continue
      }
      const mapped = DQ_ESCAPES[e]
      if (mapped === undefined) {
        throw new YamlParseError(`Unknown escape sequence "\\${e}".`, line, column + i, raw)
      }
      out += mapped
      i++
      continue
    }
    out += c
  }
  if (raw[i] !== '"') {
    throw new YamlParseError('Unterminated double-quoted string: the closing " is missing.', line, column, raw)
  }
  const tail = raw.slice(i + 1).trim()
  if (tail !== '') {
    throw new YamlParseError(
      `Unexpected text after the closing quote: ${tail.slice(0, 24)}`,
      line,
      column + i + 1,
      raw,
    )
  }
  return out
}

function decodeSingleQuoted(raw: string, line: number, column: number): string {
  let out = ''
  let i = 1
  for (; i < raw.length; i++) {
    const c = raw[i]!
    if (c === "'") {
      if (raw[i + 1] === "'") {
        out += "'"
        i++
        continue
      }
      break
    }
    out += c
  }
  if (raw[i] !== "'") {
    throw new YamlParseError("Unterminated single-quoted string: the closing ' is missing.", line, column, raw)
  }
  const tail = raw.slice(i + 1).trim()
  if (tail !== '') {
    throw new YamlParseError(
      `Unexpected text after the closing quote: ${tail.slice(0, 24)}`,
      line,
      column + i + 1,
      raw,
    )
  }
  return out
}

function parseScalarText(text: string, line: number, column: number, opts: Opts): unknown {
  const t = text.trim()
  if (t === '') return null
  if (t.startsWith('"')) return decodeDoubleQuoted(t, line, column)
  if (t.startsWith("'")) return decodeSingleQuoted(t, line, column)
  if (t.startsWith('&') || t.startsWith('*')) {
    throw new YamlParseError(
      'Anchors and aliases (& and *) are not supported by this converter. Expand them and try again.',
      line,
      column,
      text,
    )
  }
  if (t.startsWith('!')) {
    const sp = t.indexOf(' ')
    if (sp < 0) return null
    return parseScalarText(t.slice(sp + 1), line, column + sp + 1, opts)
  }
  return resolvePlain(t, opts)
}

/* ─────────────────────────────── flow parsing ─────────────────────────────── */

class FlowReader {
  private readonly s: string
  private p = 0
  private readonly line: number
  private readonly col: number
  private readonly opts: Opts

  constructor(s: string, line: number, col: number, opts: Opts) {
    this.s = s
    this.line = line
    this.col = col
    this.opts = opts
  }

  private fail(message: string): never {
    throw new YamlParseError(message, this.line, this.col + this.p, this.s)
  }

  private ws(): void {
    while (this.p < this.s.length && /\s/.test(this.s[this.p]!)) this.p++
  }

  parse(): unknown {
    const v = this.value()
    this.ws()
    if (this.p < this.s.length) this.fail(`Unexpected "${this.s[this.p]}" after the flow collection.`)
    return v
  }

  private value(): unknown {
    this.ws()
    const c = this.s[this.p]
    if (c === undefined) return null
    if (c === '[') return this.seq()
    if (c === '{') return this.map()
    if (c === '"' || c === "'") {
      const end = skipQuoted(this.s, this.p)
      if (end < 0) this.fail('Unterminated quoted string inside a flow collection.')
      const raw = this.s.slice(this.p, end)
      const at = this.col + this.p
      this.p = end
      return c === '"' ? decodeDoubleQuoted(raw, this.line, at) : decodeSingleQuoted(raw, this.line, at)
    }
    const start = this.p
    while (this.p < this.s.length && !',[]{}'.includes(this.s[this.p]!)) {
      if (this.s[this.p] === ':' && (this.s[this.p + 1] === ' ' || this.s[this.p + 1] === undefined)) break
      this.p++
    }
    const raw = this.s.slice(start, this.p).trim()
    return parseScalarText(raw, this.line, this.col + start, this.opts)
  }

  private seq(): unknown[] {
    this.p++ // [
    const out: unknown[] = []
    this.ws()
    if (this.s[this.p] === ']') {
      this.p++
      return out
    }
    for (;;) {
      out.push(this.value())
      this.ws()
      const c = this.s[this.p]
      if (c === ',') {
        this.p++
        this.ws()
        if (this.s[this.p] === ']') {
          this.p++
          return out
        }
        continue
      }
      if (c === ']') {
        this.p++
        return out
      }
      this.fail('Expected "," or "]" in a flow sequence.')
    }
  }

  private map(): Record<string, unknown> {
    this.p++ // {
    const out: Record<string, unknown> = {}
    this.ws()
    if (this.s[this.p] === '}') {
      this.p++
      return out
    }
    for (;;) {
      this.ws()
      const key = this.value()
      this.ws()
      let val: unknown = null
      if (this.s[this.p] === ':') {
        this.p++
        val = this.value()
      }
      out[stringifyKey(key)] = val
      this.ws()
      const c = this.s[this.p]
      if (c === ',') {
        this.p++
        this.ws()
        if (this.s[this.p] === '}') {
          this.p++
          return out
        }
        continue
      }
      if (c === '}') {
        this.p++
        return out
      }
      this.fail('Expected "," or "}" in a flow mapping.')
    }
  }
}

function stringifyKey(key: unknown): string {
  if (typeof key === 'string') return key
  if (key === null || key === undefined) return 'null'
  return String(key)
}

/* ──────────────────────────────── block parsing ───────────────────────────── */

function skipBlank(ctx: Ctx): void {
  while (ctx.i < ctx.lines.length && isBlankOrComment(ctx.lines[ctx.i]!.text)) ctx.i++
}

function nextContentIndex(ctx: Ctx): number {
  let j = ctx.i
  while (j < ctx.lines.length && isBlankOrComment(ctx.lines[j]!.text)) j++
  return j < ctx.lines.length ? j : -1
}

function bodyOf(line: Src, indent: number): string {
  return stripComment(line.text).trimEnd().slice(indent)
}

function isSeqItem(body: string): boolean {
  return body === '-' || body.startsWith('- ')
}

function parseNode(ctx: Ctx, indent: number): unknown {
  skipBlank(ctx)
  if (ctx.i >= ctx.lines.length) return null
  const line = ctx.lines[ctx.i]!
  const ind = indentOf(line)
  if (ind < indent) return null
  const body = bodyOf(line, ind)
  if (isSeqItem(body)) return parseSeq(ctx, ind)
  if (findKeyColon(body) >= 0) return parseMap(ctx, ind)

  // A bare scalar node, possibly folded over several more-indented lines.
  ctx.i++
  let acc = body
  if (isPlainStart(body)) acc = foldContinuation(ctx, acc, ind - 1)
  return parseScalarText(acc, line.n, ind + 1, ctx.opts)
}

function isPlainStart(text: string): boolean {
  return !(
    text.startsWith('"') ||
    text.startsWith("'") ||
    text.startsWith('[') ||
    text.startsWith('{') ||
    text.startsWith('|') ||
    text.startsWith('>')
  )
}

/** Absorb following, more-indented, non-structural lines into a plain scalar. */
function foldContinuation(ctx: Ctx, acc: string, ownerIndent: number): string {
  let out = acc
  for (;;) {
    const j = nextContentIndex(ctx)
    if (j < 0) break
    const nl = ctx.lines[j]!
    const nind = indentOf(nl)
    if (nind <= ownerIndent) break
    const nb = stripComment(nl.text).trim()
    if (nb === '' || isSeqItem(nb) || findKeyColon(nb) >= 0 || nb === '---' || nb === '...') break
    out += ' ' + nb
    ctx.i = j + 1
  }
  return out
}

function decodeKey(raw: string, line: number, column: number, opts: Opts): string {
  if (raw.startsWith('?')) {
    throw new YamlParseError(
      'Explicit mapping keys ("? key") are not supported by this converter.',
      line,
      column,
      raw,
    )
  }
  if (raw === '<<') {
    throw new YamlParseError(
      'Merge keys ("<<:") rely on anchors, which this converter does not support.',
      line,
      column,
      raw,
    )
  }
  const value = parseScalarText(raw, line, column, opts)
  return stringifyKey(value)
}

function parseMap(ctx: Ctx, indent: number): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (;;) {
    skipBlank(ctx)
    if (ctx.i >= ctx.lines.length) break
    const line = ctx.lines[ctx.i]!
    const ind = indentOf(line)
    if (ind < indent) break
    if (ind > indent) {
      throw new YamlParseError(
        `Unexpected indentation: this line is indented ${ind} spaces but the mapping around it uses ${indent}.`,
        line.n,
        ind + 1,
        line.text,
      )
    }
    const body = bodyOf(line, indent)
    if (isSeqItem(body)) {
      throw new YamlParseError(
        'A list item ("- ") cannot sit at the same indentation as the mapping keys above it.',
        line.n,
        indent + 1,
        line.text,
      )
    }
    const colon = findKeyColon(body)
    if (colon < 0) {
      throw new YamlParseError(
        'Expected a mapping entry in the form "key: value" here.',
        line.n,
        indent + 1,
        line.text,
      )
    }
    const rawKey = body.slice(0, colon).trim()
    if (rawKey === '') {
      throw new YamlParseError('This mapping entry has an empty key.', line.n, indent + 1, line.text)
    }
    const key = decodeKey(rawKey, line.n, indent + 1, ctx.opts)
    const after = body.slice(colon + 1)
    const lead = after.length - after.trimStart().length
    const valueCol = indent + colon + 1 + lead + 1
    const rest = after.trim()
    ctx.i++
    out[key] = parseValue(ctx, rest, indent, line.n, valueCol)
  }
  return out
}

function parseValue(
  ctx: Ctx,
  rest: string,
  ownerIndent: number,
  lineNo: number,
  column: number,
): unknown {
  if (rest === '') {
    const j = nextContentIndex(ctx)
    if (j < 0) return null
    const nl = ctx.lines[j]!
    const nind = indentOf(nl)
    if (nind > ownerIndent) return parseNode(ctx, nind)
    if (nind === ownerIndent && isSeqItem(bodyOf(nl, nind))) return parseSeq(ctx, nind)
    return null
  }
  if (rest.startsWith('|') || rest.startsWith('>')) {
    return parseBlockScalar(ctx, rest, ownerIndent, lineNo, column)
  }
  if (rest.startsWith('[') || rest.startsWith('{')) {
    const text = collectFlow(ctx, rest, lineNo, column)
    return new FlowReader(text, lineNo, column, ctx.opts).parse()
  }
  const acc = isPlainStart(rest) ? foldContinuation(ctx, rest, ownerIndent) : rest
  return parseScalarText(acc, lineNo, column, ctx.opts)
}

function collectFlow(ctx: Ctx, first: string, lineNo: number, column: number): string {
  let text = first
  while (flowDepth(text) > 0 && ctx.i < ctx.lines.length) {
    const l = ctx.lines[ctx.i]!
    ctx.i++
    text += ' ' + stripComment(l.text).trim()
  }
  if (flowDepth(text) !== 0) {
    throw new YamlParseError(
      'Unterminated flow collection: a "[" or "{" is never closed.',
      lineNo,
      column,
      first,
    )
  }
  return text
}

function parseSeq(ctx: Ctx, indent: number): unknown[] {
  const out: unknown[] = []
  for (;;) {
    skipBlank(ctx)
    if (ctx.i >= ctx.lines.length) break
    const line = ctx.lines[ctx.i]!
    const ind = indentOf(line)
    if (ind < indent) break
    if (ind > indent) {
      throw new YamlParseError(
        `Unexpected indentation: this line is indented ${ind} spaces but the list around it uses ${indent}.`,
        line.n,
        ind + 1,
        line.text,
      )
    }
    const body = bodyOf(line, indent)
    if (!isSeqItem(body)) break

    const after = body.slice(1)
    const lead = after.length - after.trimStart().length
    const contentCol = indent + 1 + lead
    const rest = after.trim()

    if (rest === '') {
      ctx.i++
      const j = nextContentIndex(ctx)
      if (j < 0) {
        out.push(null)
        continue
      }
      const nl = ctx.lines[j]!
      const nind = indentOf(nl)
      out.push(nind > indent ? parseNode(ctx, nind) : null)
      continue
    }
    if (rest.startsWith('|') || rest.startsWith('>')) {
      ctx.i++
      out.push(parseBlockScalar(ctx, rest, indent, line.n, contentCol + 1))
      continue
    }
    if (rest.startsWith('[') || rest.startsWith('{')) {
      ctx.i++
      const text = collectFlow(ctx, rest, line.n, contentCol + 1)
      out.push(new FlowReader(text, line.n, contentCol + 1, ctx.opts).parse())
      continue
    }
    if (isSeqItem(rest)) {
      // Nested sequence that starts on the same line: `- - a`
      ctx.lines[ctx.i] = { text: ' '.repeat(contentCol) + rest, n: line.n }
      out.push(parseSeq(ctx, contentCol))
      continue
    }
    if (findKeyColon(rest) >= 0) {
      // Mapping that starts on the dash line: `- key: value`
      ctx.lines[ctx.i] = { text: ' '.repeat(contentCol) + rest, n: line.n }
      out.push(parseMap(ctx, contentCol))
      continue
    }
    ctx.i++
    const acc = foldContinuation(ctx, rest, indent)
    out.push(parseScalarText(acc, line.n, contentCol + 1, ctx.opts))
  }
  return out
}

function parseBlockScalar(
  ctx: Ctx,
  header: string,
  ownerIndent: number,
  lineNo: number,
  column: number,
): string {
  const m = /^([|>])([0-9+-]*)\s*(.*)$/.exec(header)
  if (!m) throw new YamlParseError('Malformed block scalar header.', lineNo, column, header)
  const style = m[1]!
  const flags = m[2]!
  const trailing = m[3]!.trim()
  if (trailing !== '' && !trailing.startsWith('#')) {
    throw new YamlParseError(
      `A block scalar header ("${style}") must be the last thing on its line.`,
      lineNo,
      column,
      header,
    )
  }
  let chomp: 'clip' | 'strip' | 'keep' = 'clip'
  let explicitIndent = 0
  for (const ch of flags) {
    if (ch === '-') chomp = 'strip'
    else if (ch === '+') chomp = 'keep'
    else if (ch >= '1' && ch <= '9') explicitIndent = Number(ch)
    else {
      throw new YamlParseError(
        `Invalid block scalar indicator "${ch}". Use "|", "|-", "|+", ">" or an indentation digit.`,
        lineNo,
        column,
        header,
      )
    }
  }

  const raw: string[] = []
  while (ctx.i < ctx.lines.length) {
    const l = ctx.lines[ctx.i]!
    if (l.text.trim() === '') {
      raw.push('')
      ctx.i++
      continue
    }
    const ind = indentOf(l)
    if (ind <= ownerIndent) break
    raw.push(l.text)
    ctx.i++
  }

  let base = explicitIndent > 0 ? ownerIndent + explicitIndent : 0
  if (base === 0) {
    for (const l of raw) {
      if (l.trim() !== '') {
        base = l.length - l.trimStart().length
        break
      }
    }
    if (base === 0) base = ownerIndent + 1
  }
  const pad = ' '.repeat(base)
  const content = raw.map((l) => (l.startsWith(pad) ? l.slice(base) : l.trimStart()))

  let end = content.length
  while (end > 0 && content[end - 1] === '') end--
  const trailingBlanks = content.length - end
  const bodyLines = content.slice(0, end)

  let value: string
  if (style === '|') {
    value = bodyLines.join('\n')
  } else {
    value = foldLines(bodyLines)
  }
  if (bodyLines.length > 0) {
    if (chomp === 'clip') value += '\n'
    else if (chomp === 'keep') value += '\n' + '\n'.repeat(trailingBlanks)
  } else if (chomp === 'keep') {
    value = '\n'.repeat(trailingBlanks)
  }
  return value
}

function foldLines(lines: string[]): string {
  let out = ''
  let blanks = 0
  let lastWasMore = false
  let started = false
  for (const l of lines) {
    if (l.trim() === '') {
      blanks++
      continue
    }
    const more = /^[ \t]/.test(l)
    if (started) {
      if (blanks > 0) out += '\n'.repeat(blanks)
      else out += more || lastWasMore ? '\n' : ' '
    }
    out += l
    started = true
    lastWasMore = more
    blanks = 0
  }
  return out
}

/* ────────────────────────────────── public API ────────────────────────────── */

function toLines(text: string): Src[] {
  return text
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((t, idx) => ({ text: t, n: idx + 1 }))
}

/** Parse every document in a YAML stream. Always returns at least one entry. */
export function parseYamlAll(text: string, options: YamlParseOptions = {}): unknown[] {
  const opts: Opts = { ...DEFAULT_OPTS, ...options }
  const all = toLines(text)
  const docs: Src[][] = []
  let current: Src[] = []
  for (const line of all) {
    const t = line.text.trimEnd()
    if (t === '---' || t.startsWith('--- ')) {
      if (current.some((l) => !isBlankOrComment(l.text))) docs.push(current)
      current = []
      const inline = t.slice(3).trim()
      if (inline !== '') current.push({ text: inline, n: line.n })
      continue
    }
    if (t === '...') {
      if (current.some((l) => !isBlankOrComment(l.text))) docs.push(current)
      current = []
      continue
    }
    current.push(line)
  }
  if (current.some((l) => !isBlankOrComment(l.text))) docs.push(current)
  if (docs.length === 0) return [null]

  return docs.map((lines) => {
    const ctx: Ctx = { lines, i: 0, opts }
    const value = parseNode(ctx, 0)
    skipBlank(ctx)
    if (ctx.i < ctx.lines.length) {
      const l = ctx.lines[ctx.i]!
      throw new YamlParseError(
        'Unexpected content after the end of the document.',
        l.n,
        indentOf(l) + 1,
        l.text,
      )
    }
    return value
  })
}

/** Parse a single YAML document (the first one in the stream). */
export function parseYaml(text: string, options: YamlParseOptions = {}): unknown {
  return parseYamlAll(text, options)[0] ?? null
}

/* ─────────────────────────────── serialisation ────────────────────────────── */

export interface YamlStringifyOptions {
  /** Spaces per indentation level for mappings. Default 2. */
  indent?: number
  /** Sort mapping keys alphabetically. Default false. */
  sortKeys?: boolean
  /** Always quote strings instead of using plain scalars. Default false. */
  quoteStrings?: boolean
  /** Use `|` block literals for multi-line strings. Default true. */
  blockLiterals?: boolean
  /** Prefix the output with a `---` document marker. Default false. */
  documentStart?: boolean
}

type StringifyOpts = Required<YamlStringifyOptions>

const DEFAULT_STRINGIFY: StringifyOpts = {
  indent: 2,
  sortKeys: false,
  quoteStrings: false,
  blockLiterals: true,
  documentStart: false,
}

type Rendered =
  | { kind: 'inline'; text: string }
  | { kind: 'block'; lines: string[] }
  | { kind: 'literal'; header: string; lines: string[] }

const RESERVED_WORDS =
  /^(true|false|null|True|False|Null|TRUE|FALSE|NULL|~|y|Y|n|N|yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF)$/
const NUMERIC_LOOKALIKE =
  /^[+-]?(\d[\d_]*(\.\d*)?([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?|0x[0-9a-fA-F_]+|0o[0-7_]+|0b[01_]+|\.(inf|Inf|INF|nan|NaN|NAN))$/
const DATE_LOOKALIKE = /^\d{4}-\d{1,2}-\d{1,2}([T ].*)?$/
const SEXAGESIMAL = /^[+-]?\d+(:\d+)+(\.\d+)?$/
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/

function needsQuoting(s: string): boolean {
  if (s === '') return true
  if (s !== s.trim()) return true
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)) return true
  if (/: /.test(s) || s.endsWith(':')) return true
  if (/ #/.test(s)) return true
  if (/[\n\r\t]/.test(s)) return true
  if (CONTROL_CHARS.test(s)) return true
  if (RESERVED_WORDS.test(s)) return true
  if (NUMERIC_LOOKALIKE.test(s)) return true
  if (DATE_LOOKALIKE.test(s)) return true
  if (SEXAGESIMAL.test(s)) return true
  return false
}

function quoteScalar(s: string): string {
  if (CONTROL_CHARS.test(s) || /[\n\r\t]/.test(s)) {
    let out = '"'
    for (const ch of s) {
      const code = ch.codePointAt(0)!
      if (ch === '"') out += '\\"'
      else if (ch === '\\') out += '\\\\'
      else if (ch === '\n') out += '\\n'
      else if (ch === '\r') out += '\\r'
      else if (ch === '\t') out += '\\t'
      else if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) {
        out += '\\x' + code.toString(16).padStart(2, '0')
      } else out += ch
    }
    return out + '"'
  }
  return "'" + s.replace(/'/g, "''") + "'"
}

function canUseLiteral(s: string): boolean {
  if (!s.includes('\n')) return false
  if (/\r/.test(s) || CONTROL_CHARS.test(s) || s.includes('\t')) return false
  const lines = s.split('\n')
  if (lines[0] === '' || /^[ \t]/.test(lines[0]!)) return false
  for (const l of lines) if (/[ \t]$/.test(l)) return false
  return true
}

function literalRendered(s: string, indent: number): Rendered {
  const pad = ' '.repeat(indent)
  if (s.endsWith('\n\n')) {
    const parts = s.split('\n')
    if (parts[parts.length - 1] === '') parts.pop()
    return { kind: 'literal', header: '|+', lines: parts.map((l) => (l === '' ? '' : pad + l)) }
  }
  let chomp: '' | '-' = '-'
  let body = s
  if (s.endsWith('\n')) {
    chomp = ''
    body = s.slice(0, -1)
  }
  const lines = body.split('\n').map((l) => (l === '' ? '' : pad + l))
  return { kind: 'literal', header: '|' + chomp, lines }
}

function numberToYaml(n: number): string {
  if (Number.isNaN(n)) return '.nan'
  if (n === Infinity) return '.inf'
  if (n === -Infinity) return '-.inf'
  return String(n)
}

function renderNode(
  value: unknown,
  indent: number,
  o: StringifyOpts,
  seen: Set<object>,
): Rendered {
  if (value === null || value === undefined) return { kind: 'inline', text: 'null' }
  const t = typeof value
  if (t === 'boolean') return { kind: 'inline', text: value ? 'true' : 'false' }
  if (t === 'number') return { kind: 'inline', text: numberToYaml(value as number) }
  if (t === 'bigint') return { kind: 'inline', text: String(value) }
  if (t === 'string') {
    const s = value as string
    if (o.blockLiterals && !o.quoteStrings && canUseLiteral(s)) return literalRendered(s, indent)
    if (o.quoteStrings || needsQuoting(s)) return { kind: 'inline', text: quoteScalar(s) }
    return { kind: 'inline', text: s }
  }
  if (value instanceof Date) {
    return { kind: 'inline', text: Number.isNaN(value.getTime()) ? 'null' : value.toISOString() }
  }
  if (t !== 'object') return { kind: 'inline', text: quoteScalar(String(value)) }

  const obj = value as object
  if (seen.has(obj)) {
    throw new Error('This structure contains a circular reference, which cannot be written as YAML.')
  }
  seen.add(obj)
  try {
    if (Array.isArray(value)) {
      if (value.length === 0) return { kind: 'inline', text: '[]' }
      const pad = ' '.repeat(indent)
      const lines: string[] = []
      for (const item of value) {
        const r = renderNode(item, indent + 2, o, seen)
        if (r.kind === 'inline') lines.push(pad + '- ' + r.text)
        else if (r.kind === 'literal') {
          lines.push(pad + '- ' + r.header)
          for (const l of r.lines) lines.push(l)
        } else {
          const first = r.lines[0]!
          lines.push(pad + '- ' + first.slice(indent + 2))
          for (let i = 1; i < r.lines.length; i++) lines.push(r.lines[i]!)
        }
      }
      return { kind: 'block', lines }
    }

    const record = value as Record<string, unknown>
    let keys = Object.keys(record).filter((k) => record[k] !== undefined)
    if (o.sortKeys) keys = keys.slice().sort((a, b) => a.localeCompare(b))
    if (keys.length === 0) return { kind: 'inline', text: '{}' }
    const pad = ' '.repeat(indent)
    const lines: string[] = []
    for (const k of keys) {
      const keyText = needsQuoting(k) || o.quoteStrings ? quoteScalar(k) : k
      const r = renderNode(record[k], indent + o.indent, o, seen)
      if (r.kind === 'inline') lines.push(`${pad}${keyText}: ${r.text}`)
      else if (r.kind === 'literal') {
        lines.push(`${pad}${keyText}: ${r.header}`)
        for (const l of r.lines) lines.push(l)
      } else {
        lines.push(`${pad}${keyText}:`)
        for (const l of r.lines) lines.push(l)
      }
    }
    return { kind: 'block', lines }
  } finally {
    seen.delete(obj)
  }
}

/** Serialise a JSON-compatible value to YAML. */
export function stringifyYaml(value: unknown, options: YamlStringifyOptions = {}): string {
  const o: StringifyOpts = { ...DEFAULT_STRINGIFY, ...options }
  const r = renderNode(value, 0, o, new Set())
  const head = o.documentStart ? '---\n' : ''
  if (r.kind === 'inline') return head + r.text + '\n'
  if (r.kind === 'literal') return head + r.header + '\n' + r.lines.join('\n') + '\n'
  return head + r.lines.join('\n') + '\n'
}
