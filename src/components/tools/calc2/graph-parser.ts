/**
 * A safe expression parser for y = f(x). It compiles text to a closure: no
 * eval, no Function. Pure; the tests import it.
 *
 * Grammar (lowest to highest precedence):
 *   sum     = product (('+' | '-') product)*
 *   product = unary (('*' | '/' | implicit) unary)*
 *   unary   = ('-' | '+') unary | power
 *   power   = primary ('^' unary)?          right associative, so -2^2 = -4
 *   primary = number | x | constant | function arg | '(' sum ')' | '|' sum '|'
 * A function without brackets takes the implicit product that follows it:
 * sin 2x = sin(2x), sin x cos x = sin(x) × cos(x).
 */

export type Fn = (x: number) => number

export class ParseError extends Error {
  readonly pos: number
  constructor(message: string, pos: number) {
    super(message)
    this.name = 'ParseError'
    this.pos = pos
  }
}

const FUNCS: Record<string, (a: number, b?: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  sec: (a) => 1 / Math.cos(a),
  csc: (a) => 1 / Math.sin(a),
  cot: (a) => 1 / Math.tan(a),
}
const BINARY: Record<string, (a: number, b: number) => number> = { min: Math.min, max: Math.max }
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 }

/** Every name the parser knows, longest first, for splitting runs like "xsinx". */
const NAMES = [...Object.keys(FUNCS), ...Object.keys(BINARY), ...Object.keys(CONSTS), 'x'].sort((a, b) => b.length - a.length)

export const FUNCTION_LIST = [...Object.keys(FUNCS).filter((n) => !n.startsWith('arc') && n !== 'log10'), 'min', 'max']

type Tok =
  | { t: 'num'; v: number; pos: number }
  | { t: 'id'; v: string; pos: number }
  | { t: 'op'; v: string; pos: number }
  | { t: 'end'; pos: number }

const NORMAL: Record<string, string> = {
  '×': '*', '·': '*', '⋅': '*', '÷': '/', '−': '-', '–': '-', '²': '^2', '³': '^3', '√': 'sqrt', 'π': 'pi', 'τ': 'tau', '[': '(', ']': ')', '{': '(', '}': ')',
}

/** Replace typographic symbols; the result has the same length per source char except ² ³ √ π τ. */
export function normalise(src: string): string {
  let out = ''
  for (const ch of src.replace(/\*\*/g, '^')) out += NORMAL[ch] ?? ch
  return out
}

/** Strip a leading "y =" or "f(x) =". */
export function stripLhs(src: string): string {
  return src.replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=/i, '')
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (c === ' ' || c === '\t') {
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      const start = i
      while (i < src.length && /[0-9]/.test(src[i]!)) i++
      if (src[i] === '.') {
        i++
        while (i < src.length && /[0-9]/.test(src[i]!)) i++
      }
      if (i === start + 1 && c === '.') throw new ParseError('A lone "." is not a number.', start)
      if ((src[i] === 'e' || src[i] === 'E') && /[0-9]/.test(src[i + 1] === '+' || src[i + 1] === '-' ? (src[i + 2] ?? '') : (src[i + 1] ?? ''))) {
        i += src[i + 1] === '+' || src[i + 1] === '-' ? 2 : 1
        while (i < src.length && /[0-9]/.test(src[i]!)) i++
      }
      toks.push({ t: 'num', v: Number(src.slice(start, i)), pos: start })
      continue
    }
    if (/[a-zA-Z]/.test(c)) {
      const start = i
      while (i < src.length && /[a-zA-Z0-9]/.test(src[i]!)) i++
      const run = src.slice(start, i).toLowerCase()
      // Split a run like "xsinx" or "2pix" into known names.
      let j = 0
      while (j < run.length) {
        const name = NAMES.find((n) => run.startsWith(n, j))
        if (name) {
          toks.push({ t: 'id', v: name, pos: start + j })
          j += name.length
          continue
        }
        if (/[0-9]/.test(run[j]!)) {
          let k = j
          while (k < run.length && /[0-9]/.test(run[k]!)) k++
          toks.push({ t: 'num', v: Number(run.slice(j, k)), pos: start + j })
          j = k
          continue
        }
        const word = run.slice(j).match(/^[a-z]+/)?.[0] ?? run[j]
        throw new ParseError(`Unknown name "${word}". Use x for the variable.`, start + j)
      }
      continue
    }
    if ('+-*/^(),|'.includes(c)) {
      toks.push({ t: 'op', v: c, pos: i })
      i++
      continue
    }
    if (c === '=') throw new ParseError('Write only the right side, for example x^2 + 1.', i)
    throw new ParseError(`"${c}" is not allowed here.`, i)
  }
  toks.push({ t: 'end', pos: src.length })
  return toks
}

/** Compile an expression in x. Throws ParseError with the character position. */
export function compile(raw: string): Fn {
  const src = normalise(stripLhs(raw))
  if (!src.trim()) throw new ParseError('Enter an expression.', 0)
  const toks = tokenize(src)
  let p = 0
  let absDepth = 0
  const peek = () => toks[p]!
  const next = () => toks[p++]!
  const isOp = (tk: Tok, v: string): boolean => tk.t === 'op' && tk.v === v

  const startsPrimary = (tk: Tok): boolean =>
    tk.t === 'num' || tk.t === 'id' || isOp(tk, '(') || (isOp(tk, '|') && absDepth === 0)

  function sum(): Fn {
    let left = product()
    for (;;) {
      const tk = peek()
      if (isOp(tk, '+')) {
        next()
        const a = left
        const b = product()
        left = (x) => a(x) + b(x)
      } else if (isOp(tk, '-')) {
        next()
        const a = left
        const b = product()
        left = (x) => a(x) - b(x)
      } else return left
    }
  }

  function product(): Fn {
    let left = unary()
    for (;;) {
      const tk = peek()
      if (isOp(tk, '*') || isOp(tk, '/')) {
        next()
        const a = left
        const b = unary()
        left = isOp(tk, '*') ? (x) => a(x) * b(x) : (x) => a(x) / b(x)
      } else if (startsPrimary(tk)) {
        const a = left
        const b = power()
        left = (x) => a(x) * b(x)
      } else return left
    }
  }

  function unary(): Fn {
    const tk = peek()
    if (isOp(tk, '-')) {
      next()
      const a = unary()
      return (x) => -a(x)
    }
    if (isOp(tk, '+')) {
      next()
      return unary()
    }
    return power()
  }

  function power(): Fn {
    const base = primary()
    if (isOp(peek(), '^')) {
      next()
      const ex = unary()
      return (x) => Math.pow(base(x), ex(x))
    }
    return base
  }

  /** The argument of a function written without brackets: an implicit product. */
  function bareArg(): Fn {
    let left = power()
    for (;;) {
      const tk = peek()
      const more = tk.t === 'num' || (tk.t === 'id' && (tk.v === 'x' || tk.v in CONSTS)) || isOp(tk, '(')
      if (!more) return left
      const a = left
      const b = power()
      left = (x) => a(x) * b(x)
    }
  }

  function primary(): Fn {
    const tk = next()
    if (tk.t === 'num') {
      const v = tk.v
      return () => v
    }
    if (tk.t === 'id') {
      if (tk.v === 'x') return (x) => x
      if (tk.v in CONSTS) {
        const v = CONSTS[tk.v]!
        return () => v
      }
      const bin = BINARY[tk.v]
      if (bin) {
        if (!isOp(peek(), '(')) throw new ParseError(`${tk.v} needs two values in brackets, like ${tk.v}(x, 2).`, tk.pos)
        next()
        const a = sum()
        if (!isOp(peek(), ',')) throw new ParseError(`${tk.v} needs two values separated by a comma.`, peek().pos)
        next()
        const b = sum()
        expect(')')
        return (x) => bin(a(x), b(x))
      }
      const fn = FUNCS[tk.v]!
      if (isOp(peek(), '(')) {
        next()
        const a = sum()
        expect(')')
        // sin(x)^2 means (sin x)^2: power() above handles the ^.
        return (x) => fn(a(x))
      }
      if (peek().t === 'end' || (peek().t === 'op' && !isOp(peek(), '-') && !isOp(peek(), '|'))) {
        throw new ParseError(`${tk.v} needs a value, like ${tk.v}(x).`, peek().pos)
      }
      const a = isOp(peek(), '-') ? unary() : bareArg()
      return (x) => fn(a(x))
    }
    if (isOp(tk, '(')) {
      const a = sum()
      expect(')')
      return a
    }
    if (isOp(tk, '|')) {
      absDepth++
      const a = sum()
      absDepth--
      expect('|')
      return (x) => Math.abs(a(x))
    }
    if (tk.t === 'end') throw new ParseError('The expression ends too early.', tk.pos)
    throw new ParseError(`"${tk.v}" is not expected here.`, tk.pos)
  }

  function expect(v: string) {
    const tk = peek()
    if (!isOp(tk, v)) {
      throw new ParseError(v === ')' ? 'A closing bracket is missing.' : `"${v}" is missing.`, tk.pos)
    }
    next()
  }

  const f = sum()
  const tail = peek()
  if (tail.t !== 'end') {
    throw new ParseError(isOp(tail, ')') ? 'There is a closing bracket with no opening one.' : `"${'v' in tail ? tail.v : ''}" is not expected here.`, tail.pos)
  }
  return f
}

export type Compiled = { ok: true; f: Fn } | { ok: false; error: string; pos: number }

export function tryCompile(raw: string): Compiled {
  try {
    return { ok: true, f: compile(raw) }
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message, pos: e.pos }
    throw e
  }
}

/**
 * Real roots of f in [a, b]: sign changes on a grid, refined by bisection.
 * A sign change across a jump (tan x at π/2) is not a root and is skipped.
 */
export function roots(f: Fn, a: number, b: number, n = 600): number[] {
  const out: number[] = []
  const h = (b - a) / n
  let x0 = a
  let y0 = f(x0)
  for (let i = 1; i <= n; i++) {
    const x1 = a + h * i
    const y1 = f(x1)
    if (Number.isFinite(y0) && Number.isFinite(y1)) {
      if (y0 === 0) {
        if (!out.length || Math.abs(out[out.length - 1]! - x0) > h / 2) out.push(x0)
      } else if (y0 * y1 < 0) {
        let lo = x0
        let hi = x1
        let flo = y0
        for (let k = 0; k < 80; k++) {
          const mid = (lo + hi) / 2
          const fm = f(mid)
          if (!Number.isFinite(fm)) break
          if (fm === 0) {
            lo = hi = mid
            break
          }
          if (flo * fm < 0) hi = mid
          else {
            lo = mid
            flo = fm
          }
        }
        const r = (lo + hi) / 2
        const fr = Math.abs(f(r))
        const scale = Math.max(1e-9, Math.abs(y0), Math.abs(y1))
        if (fr <= scale * 1e-6 + 1e-12) out.push(Math.abs(r) < 1e-12 ? 0 : r)
      }
    }
    x0 = x1
    y0 = y1
  }
  if (Number.isFinite(y0) && y0 === 0 && (!out.length || Math.abs(out[out.length - 1]! - x0) > h / 2)) out.push(x0)
  return out
}
