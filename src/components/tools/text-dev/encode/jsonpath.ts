/**
 * JSONPath (RFC 9535 subset): $, .name, ['name'], [0], [-1], [start:end:step], [*], .., unions [a,b]
 * and filters such as [?(@.price < 10 && @.tags)] with ==, !=, <, <=, >, >=, =~, !, &&, || and length().
 */

type Json = unknown

type Selector =
  | { kind: 'name'; name: string }
  | { kind: 'wild' }
  | { kind: 'index'; index: number }
  | { kind: 'slice'; start?: number; end?: number; step?: number }
  | { kind: 'filter'; expr: Expr }

interface Segment {
  deep: boolean
  selectors: Selector[]
}

type Expr =
  | { op: 'or' | 'and'; a: Expr; b: Expr }
  | { op: 'not'; a: Expr }
  | { op: 'cmp'; cmp: string; a: Expr; b: Expr }
  | { op: 'path'; root: '@' | '$'; segments: Segment[] }
  | { op: 'lit'; value: Json }
  | { op: 'length'; a: Expr }

export interface Match {
  path: string
  value: Json
}

class Parser {
  i = 0
  constructor(readonly s: string) {}
  get c() {
    return this.s[this.i]
  }
  ws() {
    while (/\s/.test(this.s[this.i] ?? '')) this.i++
  }
  fail(msg: string): never {
    throw new Error(`${msg} at position ${this.i + 1}.`)
  }
  eat(t: string) {
    this.ws()
    if (!this.s.startsWith(t, this.i)) this.fail(`Expected ${t}`)
    this.i += t.length
  }
  string(): string {
    const q = this.c
    let out = ''
    this.i++
    while (this.i < this.s.length && this.c !== q) {
      if (this.c === '\\') {
        this.i++
        out += ({ n: '\n', t: '\t' } as Record<string, string>)[this.c] ?? this.c
      } else out += this.c
      this.i++
    }
    if (this.c !== q) this.fail('Unclosed string')
    this.i++
    return out
  }
  number(): number {
    const m = /^-?\d+(\.\d+)?([eE][-+]?\d+)?/.exec(this.s.slice(this.i))
    if (!m) this.fail('Expected a number')
    this.i += m[0].length
    return Number(m[0])
  }
  name(): string {
    const m = /^[A-Za-z_$\u0080-\uffff][\w$\u0080-\uffff-]*/.exec(this.s.slice(this.i))
    if (!m) this.fail('Expected a name')
    this.i += m[0].length
    return m[0]
  }
  segments(): Segment[] {
    const out: Segment[] = []
    for (;;) {
      this.ws()
      if (this.s.startsWith('..', this.i)) {
        this.i += 2
        if (this.c === '[') out.push({ deep: true, selectors: this.bracket() })
        else if (this.c === '*') {
          this.i++
          out.push({ deep: true, selectors: [{ kind: 'wild' }] })
        } else out.push({ deep: true, selectors: [{ kind: 'name', name: this.name() }] })
      } else if (this.c === '.') {
        this.i++
        if (this.s[this.i] === '*') {
          this.i++
          out.push({ deep: false, selectors: [{ kind: 'wild' }] })
        } else out.push({ deep: false, selectors: [{ kind: 'name', name: this.name() }] })
      } else if (this.c === '[') out.push({ deep: false, selectors: this.bracket() })
      else return out
    }
  }
  bracket(): Selector[] {
    this.eat('[')
    const out: Selector[] = []
    for (;;) {
      this.ws()
      const c = this.c
      if (c === "'" || c === '"') out.push({ kind: 'name', name: this.string() })
      else if (c === '*') {
        this.i++
        out.push({ kind: 'wild' })
      } else if (c === '?') {
        this.i++
        this.ws()
        out.push({ kind: 'filter', expr: this.or() })
      } else {
        const nums: (number | undefined)[] = []
        let colons = 0
        for (;;) {
          this.ws()
          nums[colons] = /[-\d]/.test(this.c ?? '') ? this.number() : undefined
          this.ws()
          if (this.c !== ':') break
          this.i++
          colons++
        }
        if (colons === 0) {
          if (nums[0] === undefined) this.fail('Expected a name, an index or a filter')
          out.push({ kind: 'index', index: nums[0] })
        } else out.push({ kind: 'slice', start: nums[0], end: nums[1], step: nums[2] })
      }
      this.ws()
      if (this.c === ',') {
        this.i++
        continue
      }
      this.eat(']')
      return out
    }
  }
  or(): Expr {
    let a = this.and()
    for (this.ws(); this.s.startsWith('||', this.i); this.ws()) {
      this.i += 2
      a = { op: 'or', a, b: this.and() }
    }
    return a
  }
  and(): Expr {
    let a = this.unary()
    for (this.ws(); this.s.startsWith('&&', this.i); this.ws()) {
      this.i += 2
      a = { op: 'and', a, b: this.unary() }
    }
    return a
  }
  unary(): Expr {
    this.ws()
    if (this.c === '!' && this.s[this.i + 1] !== '=') {
      this.i++
      return { op: 'not', a: this.unary() }
    }
    const a = this.operand()
    this.ws()
    const m = /^(==|!=|<=|>=|=~|<|>)/.exec(this.s.slice(this.i))
    if (!m) return a
    this.i += m[0].length
    return { op: 'cmp', cmp: m[0], a, b: this.operand() }
  }
  operand(): Expr {
    this.ws()
    const c = this.c
    if (c === '(') {
      this.i++
      const e = this.or()
      this.eat(')')
      return e
    }
    if (c === '@' || c === '$') {
      this.i++
      return { op: 'path', root: c, segments: this.segments() }
    }
    if (c === "'" || c === '"') return { op: 'lit', value: this.string() }
    if (c === '/') {
      const end = this.s.indexOf('/', this.i + 1)
      if (end < 0) this.fail('Unclosed regular expression')
      const flags = /^[a-z]*/.exec(this.s.slice(end + 1))?.[0] ?? ''
      const src = this.s.slice(this.i + 1, end)
      this.i = end + 1 + flags.length
      return { op: 'lit', value: new RegExp(src, flags) }
    }
    if (/[-\d]/.test(c ?? '')) return { op: 'lit', value: this.number() }
    for (const [word, value] of [['true', true], ['false', false], ['null', null]] as const) {
      if (this.s.startsWith(word, this.i)) {
        this.i += word.length
        return { op: 'lit', value }
      }
    }
    if (this.s.startsWith('length(', this.i)) {
      this.i += 7
      const a = this.or()
      this.eat(')')
      return { op: 'length', a }
    }
    this.fail('Expected a value, @ or $')
  }
}

const key = (k: string | number) => (typeof k === 'number' ? `[${k}]` : /^[A-Za-z_$][\w$]*$/.test(k) ? `.${k}` : `[${JSON.stringify(k)}]`)

function children(m: Match): Match[] {
  const v = m.value
  if (Array.isArray(v)) return v.map((x, i) => ({ path: m.path + key(i), value: x as Json }))
  if (v !== null && typeof v === 'object') return Object.entries(v).map(([k, x]) => ({ path: m.path + key(k), value: x as Json }))
  return []
}

function descendants(m: Match): Match[] {
  const out = [m]
  for (const c of children(m)) out.push(...descendants(c))
  return out
}

function select(m: Match, s: Selector, root: Json): Match[] {
  const v = m.value
  switch (s.kind) {
    case 'name':
      return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.hasOwn(v, s.name) ? [{ path: m.path + key(s.name), value: (v as Record<string, Json>)[s.name] }] : []
    case 'wild':
      return children(m)
    case 'index': {
      if (!Array.isArray(v)) return []
      const i = s.index < 0 ? v.length + s.index : s.index
      return i >= 0 && i < v.length ? [{ path: m.path + key(i), value: v[i] as Json }] : []
    }
    case 'slice': {
      if (!Array.isArray(v)) return []
      const step = s.step ?? 1
      if (step === 0) return []
      const n = v.length
      const norm = (x: number) => (x < 0 ? Math.max(n + x, step > 0 ? 0 : -1) : Math.min(x, step > 0 ? n : n - 1))
      const start = s.start === undefined ? (step > 0 ? 0 : n - 1) : norm(s.start)
      const end = s.end === undefined ? (step > 0 ? n : -1) : norm(s.end)
      const out: Match[] = []
      for (let i = start; step > 0 ? i < end : i > end; i += step) out.push({ path: m.path + key(i), value: v[i] as Json })
      return out
    }
    case 'filter':
      return children(m).filter((c) => truthy(evaluate(s.expr, c.value, root)))
  }
}

function run(segments: Segment[], start: Match, root: Json): Match[] {
  let nodes = [start]
  for (const seg of segments) {
    const base = seg.deep ? nodes.flatMap(descendants) : nodes
    nodes = base.flatMap((n) => seg.selectors.flatMap((s) => select(n, s, root)))
  }
  return nodes
}

/** Value of an expression: a path gives its list of matches; everything else a single value. */
type Val = { nodes: Match[] } | { value: Json }

function evaluate(e: Expr, current: Json, root: Json): Val {
  switch (e.op) {
    case 'lit':
      return { value: e.value }
    case 'path':
      return { nodes: run(e.segments, { path: e.root, value: e.root === '@' ? current : root }, root) }
    case 'length': {
      const v = single(evaluate(e.a, current, root))
      return { value: typeof v === 'string' ? [...v].length : Array.isArray(v) ? v.length : v !== null && typeof v === 'object' ? Object.keys(v).length : null }
    }
    case 'not':
      return { value: !truthy(evaluate(e.a, current, root)) }
    case 'and':
      return { value: truthy(evaluate(e.a, current, root)) && truthy(evaluate(e.b, current, root)) }
    case 'or':
      return { value: truthy(evaluate(e.a, current, root)) || truthy(evaluate(e.b, current, root)) }
    case 'cmp': {
      const a = single(evaluate(e.a, current, root))
      const b = single(evaluate(e.b, current, root))
      if (e.cmp === '=~') return { value: typeof a === 'string' && b instanceof RegExp && b.test(a) }
      const eq = JSON.stringify(a) === JSON.stringify(b)
      if (e.cmp === '==') return { value: eq }
      if (e.cmp === '!=') return { value: !eq }
      const comparable = (typeof a === 'number' && typeof b === 'number') || (typeof a === 'string' && typeof b === 'string')
      if (!comparable) return { value: false }
      const x = a as number | string
      const y = b as number | string
      return { value: e.cmp === '<' ? x < y : e.cmp === '<=' ? x <= y : e.cmp === '>' ? x > y : x >= y }
    }
  }
}

const single = (v: Val): Json => ('nodes' in v ? (v.nodes.length === 1 ? v.nodes[0].value : undefined) : v.value)
const truthy = (v: Val): boolean => ('nodes' in v ? v.nodes.length > 0 : v.value === true)

export function jsonPath(data: Json, expression: string): Match[] {
  const src = expression.trim()
  if (!src.startsWith('$')) throw new Error('A JSONPath expression starts with $, such as $.store.book[*].title.')
  const p = new Parser(src)
  p.i = 1
  const segments = p.segments()
  p.ws()
  if (p.i < src.length) p.fail('Unexpected character')
  return run(segments, { path: '$', value: data }, data)
}
