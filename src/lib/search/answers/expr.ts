/**
 * Arithmetic expressions: tokenizer and recursive-descent evaluator.
 *
 *   add     := mul (('+' | '-') mul)*        a + b% = a * (1 + b/100)
 *   mul     := unary (('*' | '/' | mod | of) unary)*
 *   unary   := ('-' | '+') unary | pow
 *   pow     := postfix (('^' | '**') unary)?
 *   postfix := primary ('!' | '%' | '°')*
 *   primary := number | constant | '(' add ')' | function primary-or-unary
 */

type Fn = (x: number) => number
type Tok = { k: 'num'; v: number } | { k: 'op'; v: string } | { k: 'fn'; v: Fn }
interface Val {
  v: number
  /** A bare percent literal ("15%"), which + and - read as a share of the left side. */
  p: boolean
}

const snap = (x: number) => (Math.abs(x) < 1e-15 ? 0 : x)

const FNS = new Map<string, Fn>([
  ['sqrt', Math.sqrt], ['cbrt', Math.cbrt], ['abs', Math.abs], ['round', Math.round], ['floor', Math.floor],
  ['ceil', Math.ceil], ['asin', Math.asin], ['acos', Math.acos], ['atan', Math.atan], ['log', Math.log10],
  ['ln', Math.log], ['exp', Math.exp], ['sin', (x) => snap(Math.sin(x))], ['cos', (x) => snap(Math.cos(x))],
  ['tan', (x) => snap(Math.tan(x))],
])

const CONSTS = new Map([['pi', Math.PI], ['π', Math.PI], ['e', Math.E]])

/** Words and symbols read as operators. "squared" and "cubed" expand to "^ 2" and "^ 3". */
const OPS = new Map([
  ['x', '*'], ['times', '*'], ['×', '*'], ['·', '*'], ['plus', '+'], ['minus', '-'], ['−', '-'], ['–', '-'],
  ['÷', '/'], ['**', '^'], ['mod', 'mod'], ['of', 'of'], ['percent', '%'], ['deg', '°'], ['degrees', '°'],
])
const POWERS = new Map([['²', 2], ['³', 3], ['squared', 2], ['cubed', 3]])

const TOKEN =
  /\s*(?:(\d{1,3}(?:,\d{3})+(?![\d,])(?:\.\d+)?|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)|(\*\*|[-+*/^%!()×÷−–·√²³°])|([a-zπ]+))/y

function tokenize(src: string): Tok[] | null {
  const s = src
    .replace(/\bdivided by\b/g, '/')
    .replace(/\bmultiplied by\b/g, '*')
    .replace(/\bsquare root(?: of)?\b/g, 'sqrt')
    .replace(/\bcube root(?: of)?\b/g, 'cbrt')
  const out: Tok[] = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < s.length) {
    const at = TOKEN.lastIndex
    const m = TOKEN.exec(s)
    if (!m) return /^\s*$/.test(s.slice(at)) ? out : null
    const [, num, sym, word] = m
    if (num !== undefined) {
      out.push({ k: 'num', v: Number(num.replace(/,/g, '')) })
      continue
    }
    const w = sym ?? word ?? ''
    const fn = w === '√' ? Math.sqrt : FNS.get(w)
    const c = CONSTS.get(w)
    const power = POWERS.get(w)
    if (fn) out.push({ k: 'fn', v: fn })
    else if (c !== undefined) out.push({ k: 'num', v: c })
    else if (power !== undefined) out.push({ k: 'op', v: '^' }, { k: 'num', v: power })
    else if (sym !== undefined) out.push({ k: 'op', v: OPS.get(sym) ?? sym })
    else if (OPS.has(w)) out.push({ k: 'op', v: OPS.get(w) ?? w })
    else return null
  }
  return out
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) return NaN
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

const FAIL = new Error('parse')

export interface ExprResult {
  value: number
  /** True when the expression uses a percent sign. */
  percent: boolean
}

/**
 * Evaluates an arithmetic expression. Returns null on a syntax error, a non-finite
 * result, or when there is no operator or function (a lone number is not a calculation).
 */
export function evaluate(src: string): ExprResult | null {
  const toks = tokenize(src) ?? []
  if (!toks.length) return null
  let i = 0
  let ops = 0
  let percent = false

  const eat = (...vs: string[]): string | null => {
    const t = toks[i]
    if (t && t.k === 'op' && vs.includes(t.v)) {
      i++
      return t.v
    }
    return null
  }

  function add(): Val {
    let l = mul()
    for (let op = eat('+', '-'); op; op = eat('+', '-')) {
      const r = mul()
      ops++
      const sign = op === '+' ? 1 : -1
      l = { v: r.p ? l.v * (1 + sign * r.v) : l.v + sign * r.v, p: false }
    }
    return l
  }

  function mul(): Val {
    let l = unary()
    for (let op = eat('*', '/', 'mod', 'of'); op; op = eat('*', '/', 'mod', 'of')) {
      const r = unary().v
      ops++
      const v = op === '/' ? l.v / r : op === 'mod' ? ((l.v % r) + r) % r : l.v * r
      l = { v, p: false }
    }
    return l
  }

  function unary(): Val {
    const op = eat('-', '+')
    if (!op) return pow()
    const x = unary()
    return op === '-' ? { v: -x.v, p: x.p } : x
  }

  function pow(): Val {
    const b = postfix()
    if (!eat('^')) return b
    ops++
    return { v: Math.pow(b.v, unary().v), p: false }
  }

  function postfix(): Val {
    let x = primary()
    for (let op = eat('!', '%', '°'); op; op = eat('!', '%', '°')) {
      if (op === '!') {
        ops++
        x = { v: factorial(x.v), p: false }
      } else if (op === '%') {
        percent = true
        x = { v: x.v / 100, p: true }
      } else x = { v: (x.v * Math.PI) / 180, p: false }
    }
    return x
  }

  function primary(): Val {
    const t = toks[i++]
    if (!t) throw FAIL
    if (t.k === 'num') return { v: t.v, p: false }
    if (t.k === 'fn') {
      ops++
      const next = toks[i]
      const arg = next && next.k === 'op' && next.v === '(' ? primary() : unary()
      return { v: t.v(arg.v), p: false }
    }
    if (t.v !== '(') throw FAIL
    const inner = add()
    if (!eat(')')) throw FAIL
    return inner
  }

  try {
    const r = add()
    if (i !== toks.length || !ops || !Number.isFinite(r.v)) return null
    return { value: r.v, percent }
  } catch {
    return null
  }
}
