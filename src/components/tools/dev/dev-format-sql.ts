/**
 * SQL tokenizer + whitespace-only formatter for the `dev-format` batch.
 *
 * Design rule that matters more than anything else here: **the formatter never
 * reorders, rewrites, adds or removes a token.** It only decides where the
 * newlines and spaces go. Comments and string literals are carried through
 * byte-for-byte. If the tokenizer cannot make sense of the input it returns the
 * input unchanged rather than emitting mangled SQL.
 */

export type SqlDialect =
  | 'standard'
  | 'postgresql'
  | 'mysql'
  | 'tsql'
  | 'oracle'
  | 'sqlite'
  | 'snowflake'
  | 'bigquery'

export interface SqlDialectInfo {
  id: SqlDialect
  label: string
  /** Quote characters that delimit an identifier in this dialect. */
  note: string
}

export const SQL_DIALECTS: SqlDialectInfo[] = [
  { id: 'standard', label: 'Standard SQL', note: 'ANSI keywords, double-quoted identifiers.' },
  {
    id: 'postgresql',
    label: 'PostgreSQL',
    note: 'Adds ILIKE, RETURNING, ON CONFLICT, dollar-quoted bodies and :: casts.',
  },
  {
    id: 'mysql',
    label: 'MySQL / MariaDB',
    note: 'Adds backtick identifiers, # comments, LIMIT … OFFSET and ON DUPLICATE KEY UPDATE.',
  },
  {
    id: 'tsql',
    label: 'SQL Server (T-SQL)',
    note: 'Adds [bracket] identifiers, TOP, MERGE, OUTPUT and @variables.',
  },
  { id: 'oracle', label: 'Oracle', note: 'Adds CONNECT BY, MINUS, and the DUAL table.' },
  { id: 'sqlite', label: 'SQLite', note: 'Adds AUTOINCREMENT, PRAGMA and UPSERT syntax.' },
  {
    id: 'snowflake',
    label: 'Snowflake',
    note: 'Adds QUALIFY, LATERAL FLATTEN, COPY INTO and $1 positional columns.',
  },
  {
    id: 'bigquery',
    label: 'BigQuery',
    note: 'Adds QUALIFY, UNNEST, EXCEPT (…) and backtick project.dataset.table names.',
  },
]

/* ------------------------------------------------------------------ */
/* Keyword sets                                                        */
/* ------------------------------------------------------------------ */

/** Clauses that start a new line at the current indent level. */
const TOP_LEVEL = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'HAVING',
  'ORDER BY',
  'LIMIT',
  'OFFSET',
  'FETCH',
  'WINDOW',
  'UNION',
  'UNION ALL',
  'INTERSECT',
  'EXCEPT',
  'MINUS',
  'INSERT INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE FROM',
  'RETURNING',
  'WITH',
  'QUALIFY',
  'CONNECT BY',
  'START WITH',
  'ON CONFLICT',
  'ON DUPLICATE KEY UPDATE',
  'MERGE INTO',
  'OUTPUT',
  'PARTITION BY',
])

/** Joins get their own line too, but read better kept together. */
const JOIN_STARTERS = new Set([
  'JOIN',
  'INNER JOIN',
  'LEFT JOIN',
  'LEFT OUTER JOIN',
  'RIGHT JOIN',
  'RIGHT OUTER JOIN',
  'FULL JOIN',
  'FULL OUTER JOIN',
  'CROSS JOIN',
  'NATURAL JOIN',
  'LATERAL JOIN',
  'STRAIGHT_JOIN',
])

/** Boolean operators that begin a continuation line, indented one step. */
const NEWLINE_BOOLEANS = new Set(['AND', 'OR'])

/** Multi-word keywords, longest first so greedy matching works. */
const COMPOUND: string[][] = [
  ['ON', 'DUPLICATE', 'KEY', 'UPDATE'],
  ['LEFT', 'OUTER', 'JOIN'],
  ['RIGHT', 'OUTER', 'JOIN'],
  ['FULL', 'OUTER', 'JOIN'],
  ['INSERT', 'INTO'],
  ['DELETE', 'FROM'],
  ['MERGE', 'INTO'],
  ['GROUP', 'BY'],
  ['ORDER', 'BY'],
  ['PARTITION', 'BY'],
  ['UNION', 'ALL'],
  ['INNER', 'JOIN'],
  ['LEFT', 'JOIN'],
  ['RIGHT', 'JOIN'],
  ['FULL', 'JOIN'],
  ['CROSS', 'JOIN'],
  ['NATURAL', 'JOIN'],
  ['LATERAL', 'JOIN'],
  ['CONNECT', 'BY'],
  ['START', 'WITH'],
  ['ON', 'CONFLICT'],
  ['IS', 'NOT'],
  ['NOT', 'IN'],
  ['NOT', 'LIKE'],
  ['NOT', 'EXISTS'],
  ['IS', 'DISTINCT', 'FROM'],
  ['CREATE', 'TABLE'],
  ['CREATE', 'OR', 'REPLACE'],
  ['ALTER', 'TABLE'],
  ['DROP', 'TABLE'],
  ['PRIMARY', 'KEY'],
  ['FOREIGN', 'KEY'],
  ['DEFAULT', 'VALUES'],
]

const BASE_KEYWORDS = new Set(
  (
    'ADD ALL ALTER AND ANY AS ASC BEGIN BETWEEN BY CASE CAST CHECK COLLATE COLUMN COMMIT ' +
    'CONSTRAINT CREATE CROSS CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP CURSOR DECLARE DEFAULT ' +
    'DELETE DESC DISTINCT DO DROP ELSE END ESCAPE EXCEPT EXISTS FALSE FETCH FILTER FIRST FOR ' +
    'FOREIGN FROM FULL FUNCTION GRANT GROUP HAVING IF IN INDEX INNER INSERT INTERSECT INTERVAL ' +
    'INTO IS JOIN KEY LAST LATERAL LEFT LIKE LIMIT MERGE NATURAL NEXT NO NOT NULL NULLS OFFSET ' +
    'ON ONLY OR ORDER OUTER OVER PARTITION PRIMARY PROCEDURE RANGE REFERENCES RENAME REPLACE ' +
    'RETURNING RIGHT ROLLBACK ROW ROWS SELECT SET SOME TABLE THEN TO TRUE TRUNCATE UNION UNIQUE ' +
    'UNKNOWN UPDATE USING VALUES VIEW WHEN WHERE WINDOW WITH WITHIN'
  ).split(' '),
)

const DIALECT_KEYWORDS: Record<SqlDialect, string[]> = {
  standard: [],
  postgresql: ['ILIKE', 'RETURNING', 'CONFLICT', 'MATERIALIZED', 'UNNEST', 'LATERAL', 'TABLESAMPLE'],
  mysql: ['AUTO_INCREMENT', 'DUPLICATE', 'ENGINE', 'STRAIGHT_JOIN', 'UNSIGNED', 'ZEROFILL'],
  tsql: ['TOP', 'OUTPUT', 'NOLOCK', 'IDENTITY', 'PIVOT', 'UNPIVOT', 'GO', 'APPLY'],
  oracle: ['CONNECT', 'MINUS', 'DUAL', 'SYSDATE', 'NOCYCLE', 'PRIOR', 'PIVOT'],
  sqlite: ['AUTOINCREMENT', 'PRAGMA', 'VACUUM', 'GLOB', 'UPSERT'],
  snowflake: ['QUALIFY', 'FLATTEN', 'CLONE', 'COPY', 'STAGE', 'WAREHOUSE', 'LATERAL'],
  bigquery: ['QUALIFY', 'UNNEST', 'STRUCT', 'ARRAY', 'ASSERT', 'EXPORT'],
}

function keywordSet(dialect: SqlDialect): Set<string> {
  const set = new Set(BASE_KEYWORDS)
  for (const word of DIALECT_KEYWORDS[dialect]) set.add(word)
  return set
}

/* ------------------------------------------------------------------ */
/* Tokenizer                                                           */
/* ------------------------------------------------------------------ */

export type SqlTokenType =
  | 'whitespace'
  | 'line-comment'
  | 'block-comment'
  | 'string'
  | 'identifier'
  | 'word'
  | 'number'
  | 'operator'
  | 'punctuation'
  | 'param'

export interface SqlToken {
  type: SqlTokenType
  value: string
  /** Uppercased `value` for word tokens, used for keyword matching. */
  upper: string
}

const OPERATORS = [
  '<=>',
  '||/',
  '!~*',
  '::',
  '||',
  '->>',
  '#>>',
  '->',
  '#>',
  '<=',
  '>=',
  '<>',
  '!=',
  '!<',
  '!>',
  ':=',
  '=',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '^',
  '~',
  '&',
  '|',
]

export function tokenizeSql(input: string, dialect: SqlDialect): SqlToken[] {
  const tokens: SqlToken[] = []
  const n = input.length
  let i = 0

  const push = (type: SqlTokenType, value: string) => {
    tokens.push({ type, value, upper: value.toUpperCase() })
  }

  while (i < n) {
    const ch = input[i]

    // whitespace
    if (/\s/.test(ch)) {
      let j = i
      while (j < n && /\s/.test(input[j])) j += 1
      push('whitespace', input.slice(i, j))
      i = j
      continue
    }

    // line comments: -- anywhere, # in MySQL
    if (
      (ch === '-' && input[i + 1] === '-') ||
      (ch === '#' && (dialect === 'mysql' || dialect === 'sqlite'))
    ) {
      let j = i
      while (j < n && input[j] !== '\n') j += 1
      push('line-comment', input.slice(i, j))
      i = j
      continue
    }

    // block comment
    if (ch === '/' && input[i + 1] === '*') {
      const end = input.indexOf('*/', i + 2)
      const j = end === -1 ? n : end + 2
      push('block-comment', input.slice(i, j))
      i = j
      continue
    }

    // dollar-quoted string (Postgres)
    if (ch === '$' && dialect === 'postgresql') {
      const tag = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(input.slice(i))
      if (tag) {
        const marker = tag[0]
        const end = input.indexOf(marker, i + marker.length)
        const j = end === -1 ? n : end + marker.length
        push('string', input.slice(i, j))
        i = j
        continue
      }
    }

    // parameters: $1, :name, @var, ?
    if (
      (ch === '$' && /[0-9]/.test(input[i + 1] ?? '')) ||
      (ch === '@' && /[A-Za-z_]/.test(input[i + 1] ?? '')) ||
      (ch === ':' && /[A-Za-z_]/.test(input[i + 1] ?? '') && input[i - 1] !== ':')
    ) {
      let j = i + 1
      while (j < n && /[A-Za-z0-9_]/.test(input[j])) j += 1
      push('param', input.slice(i, j))
      i = j
      continue
    }
    if (ch === '?') {
      push('param', '?')
      i += 1
      continue
    }

    // single-quoted string, with '' and backslash escapes
    if (ch === "'") {
      let j = i + 1
      while (j < n) {
        if (input[j] === '\\' && dialect === 'mysql') {
          j += 2
          continue
        }
        if (input[j] === "'") {
          if (input[j + 1] === "'") {
            j += 2
            continue
          }
          j += 1
          break
        }
        j += 1
      }
      push('string', input.slice(i, j))
      i = j
      continue
    }

    // quoted identifiers
    const quoteEnd: Record<string, string> = { '"': '"', '`': '`', '[': ']' }
    if (
      ch === '"' ||
      (ch === '`' && (dialect === 'mysql' || dialect === 'bigquery' || dialect === 'sqlite')) ||
      (ch === '[' && dialect === 'tsql')
    ) {
      const close = quoteEnd[ch]
      let j = i + 1
      while (j < n) {
        if (input[j] === close) {
          if (close !== ']' && input[j + 1] === close) {
            j += 2
            continue
          }
          j += 1
          break
        }
        j += 1
      }
      push('identifier', input.slice(i, j))
      i = j
      continue
    }

    // numbers
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(input[i + 1] ?? ''))) {
      let j = i
      while (j < n && /[0-9._]/.test(input[j])) j += 1
      if (input[j] === 'e' || input[j] === 'E') {
        let k = j + 1
        if (input[k] === '+' || input[k] === '-') k += 1
        if (/[0-9]/.test(input[k] ?? '')) {
          j = k
          while (j < n && /[0-9]/.test(input[j])) j += 1
        }
      }
      push('number', input.slice(i, j))
      i = j
      continue
    }

    // words
    if (/[A-Za-z_-￿]/.test(ch)) {
      let j = i
      while (j < n && /[A-Za-z0-9_$-￿]/.test(input[j])) j += 1
      push('word', input.slice(i, j))
      i = j
      continue
    }

    // punctuation
    if (ch === '(' || ch === ')' || ch === ',' || ch === ';' || ch === '.') {
      push('punctuation', ch)
      i += 1
      continue
    }

    // operators, longest match first
    const rest = input.slice(i, i + 3)
    const op = OPERATORS.find((candidate) => rest.startsWith(candidate))
    if (op) {
      push('operator', op)
      i += op.length
      continue
    }

    push('operator', ch)
    i += 1
  }

  return tokens
}

/* ------------------------------------------------------------------ */
/* Formatter                                                           */
/* ------------------------------------------------------------------ */

export type KeywordCase = 'upper' | 'lower' | 'preserve'

export interface SqlFormatOptions {
  dialect: SqlDialect
  keywordCase: KeywordCase
  /** Number of spaces per indent level, or 0 to use a tab. */
  indent: number
  /** One column per line inside a SELECT list. */
  expandColumns: boolean
  /** Put a blank line between statements. */
  blankLineBetweenStatements: boolean
  /** Uppercase/lowercase applies to built-in function names too. */
  functionCase: KeywordCase
}

export const DEFAULT_SQL_OPTIONS: SqlFormatOptions = {
  dialect: 'postgresql',
  keywordCase: 'upper',
  indent: 2,
  expandColumns: true,
  blankLineBetweenStatements: true,
  functionCase: 'preserve',
}

interface Meaningful {
  token: SqlToken
  /** Compound keyword this token starts, e.g. "GROUP BY". */
  compound?: string
  /** How many tokens the compound consumed. */
  span: number
}

function applyCase(value: string, mode: KeywordCase): string {
  if (mode === 'upper') return value.toUpperCase()
  if (mode === 'lower') return value.toLowerCase()
  return value
}

/** Collapses whitespace runs and resolves multi-word keywords. */
function meaningful(tokens: SqlToken[], keywords: Set<string>): Meaningful[] {
  const words = tokens.filter((t) => t.type !== 'whitespace')
  const out: Meaningful[] = []
  for (let i = 0; i < words.length; i += 1) {
    const token = words[i]
    if (token.type === 'word' && keywords.has(token.upper)) {
      let matched: string[] | null = null
      for (const candidate of COMPOUND) {
        if (candidate[0] !== token.upper) continue
        let ok = true
        for (let k = 1; k < candidate.length; k += 1) {
          const next = words[i + k]
          if (!next || next.type !== 'word' || next.upper !== candidate[k]) {
            ok = false
            break
          }
        }
        if (ok && (!matched || candidate.length > matched.length)) matched = candidate
      }
      if (matched) {
        out.push({ token, compound: matched.join(' '), span: matched.length })
        i += matched.length - 1
        continue
      }
    }
    out.push({ token, span: 1 })
  }
  return out
}

export interface SqlFormatResult {
  sql: string
  statements: number
  tokens: number
  /** Non-fatal notes shown under the output. */
  notes: string[]
}

export function formatSql(input: string, options: SqlFormatOptions): SqlFormatResult {
  const source = input.trim()
  if (source === '') return { sql: '', statements: 0, tokens: 0, notes: [] }

  const keywords = keywordSet(options.dialect)
  const raw = tokenizeSql(source, options.dialect)
  const items = meaningful(raw, keywords)
  const unit = options.indent === 0 ? '\t' : ' '.repeat(options.indent)
  const pad = (level: number) => unit.repeat(Math.max(0, level))

  const notes: string[] = []
  let balance = 0
  for (const item of items) {
    if (item.token.value === '(') balance += 1
    if (item.token.value === ')') balance -= 1
  }
  if (balance !== 0) {
    notes.push(
      balance > 0
        ? `${balance} unclosed “(” in this input. The layout below is a best effort. Check your parentheses.`
        : `${-balance} unmatched “)” in this input. The layout below is a best effort. Check your parentheses.`,
    )
  }

  /**
   * One frame per *subquery* (a parenthesis that opens SELECT/WITH/VALUES).
   * Plain function-call parens only bump `funcDepth` inside the current frame,
   * so `count(a, b)` never breaks but `WHERE x IN (SELECT …)` does.
   */
  interface Frame {
    /** Indent level of this frame's clause keywords. */
    base: number
    /** Indent level for the closing ")" of this frame. */
    closeIndent: number
    inSelectList: boolean
    funcDepth: number
  }

  const frames: Frame[] = [{ base: 0, closeIndent: 0, inSelectList: false, funcDepth: 0 }]
  const caseIndents: number[] = []
  const out: string[] = []

  let line = ''
  let lineIndent = 0
  let statements = 0
  let selectItemStart = false
  let previous: SqlToken | undefined
  let previousIsKeyword = false

  const frame = () => frames[frames.length - 1]

  const flush = () => {
    if (line.trim() !== '') out.push(line.replace(/[ \t]+$/, ''))
    line = ''
  }
  const newline = (level: number) => {
    flush()
    lineIndent = Math.max(0, level)
    line = pad(lineIndent)
  }

  /** Decides whether a space belongs between the current line tail and `text`. */
  const spaceBefore = (text: string): boolean => {
    if (line.trim() === '') return false
    const last = line[line.length - 1]
    if (last === undefined || /\s/.test(last)) return false
    if (text === ',' || text === ';' || text === ')' || text === '.') return false
    if (last === '(' || last === '.') return false
    if (text === '(') {
      // `count(` / `t(` hug; `IN (`, `VALUES (`, `= (` do not.
      if (previous === undefined) return false
      if (previous.type === 'word' && !previousIsKeyword) return false
      if (previous.type === 'param') return false
      if (previous.type === 'identifier') return true
      if (previous.value === ')') return false
      return true
    }
    if (text === '::') return false
    if (last === ':' && line.endsWith('::')) return false
    return true
  }

  const append = (text: string) => {
    line += (spaceBefore(text) ? ' ' : '') + text
  }

  for (let i = 0; i < items.length; i += 1) {
    const { token, compound } = items[i]
    const next = items[i + 1]?.token
    const current = frame()

    /* ---- comments keep their own line ---- */
    if (token.type === 'line-comment') {
      if (selectItemStart) {
        selectItemStart = false
        newline(current.base + 1)
      }
      if (line.trim() === '') {
        out.push(pad(lineIndent) + token.value)
      } else {
        line += `  ${token.value}`
        flush()
      }
      line = pad(lineIndent)
      continue
    }
    if (token.type === 'block-comment') {
      if (selectItemStart) {
        selectItemStart = false
        newline(current.base + 1)
      }
      flush()
      const body = token.value.split('\n')
      out.push(pad(lineIndent) + body[0].trimEnd())
      for (let k = 1; k < body.length; k += 1) out.push(pad(lineIndent) + ' ' + body[k].trim())
      line = pad(lineIndent)
      continue
    }

    const isKeyword = token.type === 'word' && keywords.has(token.upper)
    const label = compound ?? token.value
    const upperLabel = compound ?? token.upper

    /* ---- top-level clauses ---- */
    const valuesAsFunction =
      upperLabel === 'VALUES' && (previous?.type === 'operator' || next?.value === '(') &&
      previous?.type === 'operator'

    if (isKeyword && TOP_LEVEL.has(upperLabel) && !valuesAsFunction) {
      if (upperLabel !== 'SELECT') current.inSelectList = false
      current.funcDepth = 0
      newline(current.base)
      append(applyCase(label, options.keywordCase))
      previous = token
      previousIsKeyword = true
      if (upperLabel === 'SELECT') {
        if (next && next.type === 'word' && (next.upper === 'DISTINCT' || next.upper === 'ALL')) {
          append(applyCase(next.value, options.keywordCase))
          previous = next
          previousIsKeyword = true
          i += 1
        }
        const after = items[i + 1]?.token
        if (after && after.type === 'word' && after.upper === 'TOP') {
          append(applyCase(after.value, options.keywordCase))
          previous = after
          previousIsKeyword = true
          i += 1
          const amount = items[i + 1]?.token
          if (amount && (amount.type === 'number' || amount.type === 'param')) {
            append(amount.value)
            previous = amount
            previousIsKeyword = false
            i += 1
            const percent = items[i + 1]?.token
            if (percent && percent.type === 'word' && percent.upper === 'PERCENT') {
              append(applyCase(percent.value, options.keywordCase))
              previous = percent
              i += 1
            }
          }
        }
        current.inSelectList = true
        selectItemStart = options.expandColumns
      }
      continue
    }

    /* ---- joins ---- */
    if (isKeyword && JOIN_STARTERS.has(upperLabel)) {
      current.inSelectList = false
      current.funcDepth = 0
      newline(current.base)
      append(applyCase(label, options.keywordCase))
      previous = token
      previousIsKeyword = true
      continue
    }

    /* ---- AND / OR continuation lines ---- */
    if (isKeyword && NEWLINE_BOOLEANS.has(upperLabel) && current.funcDepth === 0) {
      newline(current.base + 1)
      append(applyCase(label, options.keywordCase))
      previous = token
      previousIsKeyword = true
      continue
    }

    /* ---- CASE / WHEN / THEN / ELSE / END ---- */
    if (isKeyword && upperLabel === 'CASE') {
      if (selectItemStart) {
        selectItemStart = false
        newline(current.base + 1)
      }
      append(applyCase(label, options.keywordCase))
      caseIndents.push(lineIndent)
      previous = token
      previousIsKeyword = true
      continue
    }
    if (isKeyword && (upperLabel === 'WHEN' || upperLabel === 'ELSE') && caseIndents.length > 0) {
      newline(caseIndents[caseIndents.length - 1] + 1)
      append(applyCase(label, options.keywordCase))
      previous = token
      previousIsKeyword = true
      continue
    }
    if (isKeyword && upperLabel === 'END' && caseIndents.length > 0) {
      newline(caseIndents.pop() ?? current.base)
      append(applyCase(label, options.keywordCase))
      previous = token
      previousIsKeyword = true
      continue
    }

    /* ---- parentheses ---- */
    if (token.value === '(') {
      const subquery =
        next !== undefined &&
        next.type === 'word' &&
        (next.upper === 'SELECT' || next.upper === 'WITH')
      if (selectItemStart) {
        selectItemStart = false
        newline(current.base + 1)
      }
      append('(')
      previous = token
      previousIsKeyword = false
      if (subquery) {
        const closeIndent = lineIndent
        frames.push({
          base: closeIndent + 1,
          closeIndent,
          inSelectList: false,
          funcDepth: 0,
        })
        newline(closeIndent + 1)
      } else {
        current.funcDepth += 1
      }
      continue
    }
    if (token.value === ')') {
      if (current.funcDepth > 0) {
        current.funcDepth -= 1
        append(')')
      } else if (frames.length > 1) {
        const closed = frames.pop()
        newline(closed ? closed.closeIndent : 0)
        append(')')
      } else {
        append(')')
      }
      previous = token
      previousIsKeyword = false
      continue
    }

    /* ---- commas ---- */
    if (token.value === ',') {
      append(',')
      previous = token
      previousIsKeyword = false
      if (current.inSelectList && options.expandColumns && current.funcDepth === 0) {
        newline(current.base + 1)
      } else if (current.funcDepth === 0 && line.length > 96) {
        newline(current.base + 1)
      }
      continue
    }

    /* ---- statement separator ---- */
    if (token.value === ';') {
      append(';')
      flush()
      statements += 1
      frames.length = 1
      frames[0] = { base: 0, closeIndent: 0, inSelectList: false, funcDepth: 0 }
      caseIndents.length = 0
      lineIndent = 0
      previous = undefined
      previousIsKeyword = false
      if (options.blankLineBetweenStatements && i < items.length - 1) out.push('')
      continue
    }

    /* ---- everything else ---- */
    if (selectItemStart) {
      selectItemStart = false
      newline(current.base + 1)
    }
    append(renderToken(label, token, isKeyword, keywords, options, next))
    previous = token
    previousIsKeyword = isKeyword
  }

  flush()
  if (statements === 0) statements = 1

  const sql = out
    .join('\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\(\s*\n\s*\)/g, '()')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { sql, statements, tokens: raw.filter((t) => t.type !== 'whitespace').length, notes }
}

function renderToken(
  label: string,
  token: SqlToken,
  isKeyword: boolean,
  keywords: Set<string>,
  options: SqlFormatOptions,
  next: SqlToken | undefined,
): string {
  if (isKeyword) return applyCase(label, options.keywordCase)
  if (token.type === 'word' && next?.value === '(' && !keywords.has(token.upper)) {
    return applyCase(token.value, options.functionCase)
  }
  return token.value
}

/* ------------------------------------------------------------------ */
/* Minifier                                                           */
/* ------------------------------------------------------------------ */

export interface SqlMinifyOptions {
  dialect: SqlDialect
  /** Remove line and block comments. */
  stripComments: boolean
  keywordCase: KeywordCase
}

export interface SqlMinifyResult {
  sql: string
  before: number
  after: number
  removedComments: number
}

/** Collapses whitespace without touching a single token's text. */
export function minifySql(input: string, options: SqlMinifyOptions): SqlMinifyResult {
  const before = input.length
  if (input.trim() === '') return { sql: '', before, after: 0, removedComments: 0 }

  const keywords = keywordSet(options.dialect)
  const tokens = tokenizeSql(input, options.dialect)
  let removedComments = 0
  let previousWasKeyword = false
  const parts: string[] = []

  const needsSpace = (left: string, right: string): boolean => {
    if (left === '' || right === '') return false
    const lc = left[left.length - 1]
    const rc = right[0]
    if (/[\w$)\]"'`]/.test(lc) && /[\w$(["'`]/.test(rc)) {
      // `count(` and `t.col(` must stay hugged; everything else gets a space.
      if (rc === '(' && !/[)\]"'`]/.test(lc)) return false
      return true
    }
    return false
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token.type === 'whitespace') continue
    if (token.type === 'line-comment' || token.type === 'block-comment') {
      if (options.stripComments) {
        removedComments += 1
        continue
      }
      // A retained line comment must keep a newline after it or it swallows the
      // rest of the statement.
      const text = token.type === 'line-comment' ? `${token.value}\n` : token.value
      const prior = parts.length > 0 ? parts[parts.length - 1] : ''
      if (prior !== '' && !prior.endsWith('\n') && !prior.endsWith(' ')) parts.push(' ')
      parts.push(text)
      previousWasKeyword = false
      continue
    }

    let text = token.value
    const isKeywordToken = token.type === 'word' && keywords.has(token.upper)
    if (isKeywordToken) text = applyCase(text, options.keywordCase)

    const previous = parts.length > 0 ? parts[parts.length - 1] : ''
    if (previous.endsWith('\n') || previous === '') {
      parts.push(text)
      previousWasKeyword = isKeywordToken
      continue
    }
    if (needsSpace(previous, text) || (text === '(' && previousWasKeyword)) parts.push(' ')
    parts.push(text)
    previousWasKeyword = isKeywordToken
  }

  const sql = parts.join('').replace(/\s*;\s*/g, ';').replace(/;$/, ';').trim()
  return { sql, before, after: sql.length, removedComments }
}

export const SQL_SAMPLE = `-- Quarterly revenue by account manager
with recent as (
select o.id, o.account_id, o.total_cents, o.created_at from orders o
where o.created_at >= date_trunc('quarter', current_date) and o.status <> 'cancelled')
select u.full_name as account_manager, count(distinct r.account_id) as accounts,
sum(r.total_cents)/100.0 as revenue, case when sum(r.total_cents) > 5000000 then 'tier-1' else 'tier-2' end as tier
from recent r inner join accounts a on a.id = r.account_id
left join users u on u.id = a.owner_id
where a.region in ('emea','apac') and coalesce(a.is_test, false) = false
group by u.full_name having sum(r.total_cents) > 0 order by revenue desc limit 50;`
