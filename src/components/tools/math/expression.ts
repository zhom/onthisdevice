/**
 * A small, hand-written tokeniser + recursive-descent parser for the
 * scientific calculator. Deliberately no `eval` and no `Function` — the whole
 * grammar is implemented here so errors can point at the character that broke.
 */

export type AngleMode = 'deg' | 'rad'

export interface EvalContext {
  angleMode: AngleMode
  memory: number
  ans: number
}

export class ExpressionError extends Error {
  readonly position: number
  constructor(message: string, position: number) {
    super(message)
    this.name = 'ExpressionError'
    this.position = position
  }
}

type TokenType = 'number' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma' | 'bang' | 'percent'

interface Token {
  type: TokenType
  value: string
  pos: number
}

const NORMALISE: Record<string, string> = {
  '×': '*', '·': '*', '⋅': '*', '÷': '/', '−': '-', '–': '-', '—': '-',
  '²': '^2', '³': '^3', '√': 'sqrt', 'π': 'pi', 'τ': 'tau', '’': "'", '，': ',',
  '{': '(', '}': ')', '[': '(', ']': ')',
}

export function normaliseInput(raw: string): string {
  let out = ''
  // `**` is a common way to type a power; fold it to `^` before anything else.
  for (const ch of raw.replace(/\*\*/g, '^')) out += NORMALISE[ch] ?? ch
  return out
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i++
      continue
    }
    if (ch >= '0' && ch <= '9') {
      const start = i
      while (i < source.length && source[i] >= '0' && source[i] <= '9') i++
      if (source[i] === '.') {
        i++
        while (i < source.length && source[i] >= '0' && source[i] <= '9') i++
      }
      if (source[i] === 'e' || source[i] === 'E') {
        const save = i
        let j = i + 1
        if (source[j] === '+' || source[j] === '-') j++
        if (source[j] >= '0' && source[j] <= '9') {
          j++
          while (j < source.length && source[j] >= '0' && source[j] <= '9') j++
          i = j
        } else {
          i = save
        }
      }
      tokens.push({ type: 'number', value: source.slice(start, i), pos: start })
      continue
    }
    if (ch === '.') {
      const start = i
      i++
      while (i < source.length && source[i] >= '0' && source[i] <= '9') i++
      if (i === start + 1) throw new ExpressionError('A lone "." is not a number.', start)
      tokens.push({ type: 'number', value: source.slice(start, i), pos: start })
      continue
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i
      while (i < source.length && /[a-zA-Z_0-9]/.test(source[i])) i++
      tokens.push({ type: 'ident', value: source.slice(start, i).toLowerCase(), pos: start })
      continue
    }
    if ('+-*/^%'.includes(ch)) {
      tokens.push({ type: ch === '%' ? 'percent' : 'op', value: ch, pos: i })
      i++
      continue
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch, pos: i })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch, pos: i })
      i++
      continue
    }
    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'comma', value: ',', pos: i })
      i++
      continue
    }
    if (ch === '!') {
      tokens.push({ type: 'bang', value: ch, pos: i })
      i++
      continue
    }
    throw new ExpressionError(`"${ch}" is not something this calculator understands.`, i)
  }
  return tokens
}

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  tau: Math.PI * 2,
  e: Math.E,
  phi: (1 + Math.sqrt(5)) / 2,
  inf: Infinity,
}

function factorial(n: number, pos: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new ExpressionError('Factorial only works on whole numbers of zero or more.', pos)
  }
  if (n > 170) throw new ExpressionError('That factorial is larger than a double can hold (the limit is 170!).', pos)
  let out = 1
  for (let k = 2; k <= n; k++) out *= k
  return out
}

interface FnSpec {
  arity: number | [number, number]
  fn: (args: number[], ctx: EvalContext, pos: number) => number
}

function degToRad(d: number): number {
  return (d * Math.PI) / 180
}

function radToDeg(r: number): number {
  return (r * 180) / Math.PI
}

function snap(value: number): number {
  return Math.abs(value) < 1e-14 ? 0 : value
}

const FUNCTIONS: Record<string, FnSpec> = {
  sin: {
    arity: 1,
    fn: ([x], ctx) => snap(Math.sin(ctx.angleMode === 'deg' ? degToRad(x) : x)),
  },
  cos: {
    arity: 1,
    fn: ([x], ctx) => snap(Math.cos(ctx.angleMode === 'deg' ? degToRad(x) : x)),
  },
  tan: {
    arity: 1,
    fn: ([x], ctx, pos) => {
      if (ctx.angleMode === 'deg') {
        const m = ((x - 90) % 180 + 180) % 180
        if (Math.abs(m) < 1e-9) throw new ExpressionError(`tan(${x}°) is undefined: the tangent has an asymptote there.`, pos)
        return snap(Math.tan(degToRad(x)))
      }
      return snap(Math.tan(x))
    },
  },
  asin: {
    arity: 1,
    fn: ([x], ctx, pos) => {
      if (x < -1 || x > 1) throw new ExpressionError('asin only accepts values between −1 and 1.', pos)
      const r = Math.asin(x)
      return ctx.angleMode === 'deg' ? radToDeg(r) : r
    },
  },
  acos: {
    arity: 1,
    fn: ([x], ctx, pos) => {
      if (x < -1 || x > 1) throw new ExpressionError('acos only accepts values between −1 and 1.', pos)
      const r = Math.acos(x)
      return ctx.angleMode === 'deg' ? radToDeg(r) : r
    },
  },
  atan: { arity: 1, fn: ([x], ctx) => (ctx.angleMode === 'deg' ? radToDeg(Math.atan(x)) : Math.atan(x)) },
  atan2: {
    arity: 2,
    fn: ([y, x], ctx) => (ctx.angleMode === 'deg' ? radToDeg(Math.atan2(y, x)) : Math.atan2(y, x)),
  },
  sinh: { arity: 1, fn: ([x]) => Math.sinh(x) },
  cosh: { arity: 1, fn: ([x]) => Math.cosh(x) },
  tanh: { arity: 1, fn: ([x]) => Math.tanh(x) },
  asinh: { arity: 1, fn: ([x]) => Math.asinh(x) },
  acosh: {
    arity: 1,
    fn: ([x], _ctx, pos) => {
      if (x < 1) throw new ExpressionError('acosh is only defined for values of 1 or more.', pos)
      return Math.acosh(x)
    },
  },
  atanh: {
    arity: 1,
    fn: ([x], _ctx, pos) => {
      if (x <= -1 || x >= 1) throw new ExpressionError('atanh is only defined strictly between −1 and 1.', pos)
      return Math.atanh(x)
    },
  },
  ln: {
    arity: 1,
    fn: ([x], _ctx, pos) => {
      if (x <= 0) throw new ExpressionError('The natural log is only defined for positive numbers.', pos)
      return Math.log(x)
    },
  },
  log: {
    arity: [1, 2],
    fn: (args, _ctx, pos) => {
      if (args.length === 1) {
        if (args[0] <= 0) throw new ExpressionError('log is only defined for positive numbers.', pos)
        return Math.log10(args[0])
      }
      const [base, x] = args
      if (base <= 0 || base === 1) throw new ExpressionError('A logarithm base must be positive and not equal to 1.', pos)
      if (x <= 0) throw new ExpressionError('log is only defined for positive numbers.', pos)
      return Math.log(x) / Math.log(base)
    },
  },
  log2: {
    arity: 1,
    fn: ([x], _ctx, pos) => {
      if (x <= 0) throw new ExpressionError('log2 is only defined for positive numbers.', pos)
      return Math.log2(x)
    },
  },
  log10: {
    arity: 1,
    fn: ([x], _ctx, pos) => {
      if (x <= 0) throw new ExpressionError('log10 is only defined for positive numbers.', pos)
      return Math.log10(x)
    },
  },
  exp: { arity: 1, fn: ([x]) => Math.exp(x) },
  sqrt: {
    arity: 1,
    fn: ([x], _ctx, pos) => {
      if (x < 0) throw new ExpressionError('The square root of a negative number is not a real number.', pos)
      return Math.sqrt(x)
    },
  },
  cbrt: { arity: 1, fn: ([x]) => Math.cbrt(x) },
  root: {
    arity: 2,
    fn: ([n, x], _ctx, pos) => {
      if (n === 0) throw new ExpressionError('A 0th root is undefined.', pos)
      if (x < 0 && Number.isInteger(n) && n % 2 === 0) {
        throw new ExpressionError('An even root of a negative number is not a real number.', pos)
      }
      return x < 0 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n)
    },
  },
  abs: { arity: 1, fn: ([x]) => Math.abs(x) },
  sign: { arity: 1, fn: ([x]) => Math.sign(x) },
  round: { arity: [1, 2], fn: (a) => (a.length === 1 ? Math.round(a[0]) : Number(a[0].toFixed(Math.max(0, Math.min(15, Math.trunc(a[1])))))) },
  floor: { arity: 1, fn: ([x]) => Math.floor(x) },
  ceil: { arity: 1, fn: ([x]) => Math.ceil(x) },
  trunc: { arity: 1, fn: ([x]) => Math.trunc(x) },
  mod: {
    arity: 2,
    fn: ([a, b], _ctx, pos) => {
      if (b === 0) throw new ExpressionError('mod by zero is undefined.', pos)
      return a % b
    },
  },
  min: { arity: [1, 16], fn: (a) => Math.min(...a) },
  max: { arity: [1, 16], fn: (a) => Math.max(...a) },
  fact: { arity: 1, fn: ([x], _ctx, pos) => factorial(x, pos) },
  hypot: { arity: [2, 16], fn: (a) => Math.hypot(...a) },
}

export const FUNCTION_NAMES = Object.keys(FUNCTIONS).sort()
export const CONSTANT_NAMES = Object.keys(CONSTANTS).sort()

class Parser {
  private readonly tokens: Token[]
  private index = 0

  constructor(
    tokens: Token[],
    private readonly ctx: EvalContext,
    private readonly length: number,
  ) {
    this.tokens = tokens
  }

  private peek(): Token | undefined {
    return this.tokens[this.index]
  }

  private next(): Token | undefined {
    return this.tokens[this.index++]
  }

  private endPos(): number {
    return this.length
  }

  parse(): number {
    const value = this.parseAddSub()
    const rest = this.peek()
    if (rest) {
      if (rest.type === 'rparen') throw new ExpressionError('There is a closing bracket with no matching opening bracket.', rest.pos)
      throw new ExpressionError(`Unexpected "${rest.value}". Check the expression around here.`, rest.pos)
    }
    return value
  }

  private parseAddSub(): number {
    let left = this.parseMulDiv()
    for (;;) {
      const t = this.peek()
      if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        this.next()
        const right = this.parseMulDiv()
        left = t.value === '+' ? left + right : left - right
      } else {
        return left
      }
    }
  }

  private startsPrimary(t: Token | undefined): boolean {
    if (!t) return false
    return t.type === 'number' || t.type === 'ident' || t.type === 'lparen'
  }

  private parseMulDiv(): number {
    let left = this.parseUnary()
    for (;;) {
      const t = this.peek()
      if (t && t.type === 'op' && (t.value === '*' || t.value === '/')) {
        this.next()
        const right = this.parseUnary()
        if (t.value === '/') {
          if (right === 0) throw new ExpressionError('Division by zero.', t.pos)
          left = left / right
        } else {
          left = left * right
        }
        continue
      }
      // Implicit multiplication: 2(3+4), 3pi, 2sin(1)
      if (this.startsPrimary(t)) {
        const right = this.parseUnary()
        left = left * right
        continue
      }
      return left
    }
  }

  private parseUnary(): number {
    const t = this.peek()
    if (t && t.type === 'op' && (t.value === '-' || t.value === '+')) {
      this.next()
      const value = this.parseUnary()
      return t.value === '-' ? -value : value
    }
    return this.parsePower()
  }

  private parsePower(): number {
    const base = this.parsePostfix()
    const t = this.peek()
    if (t && t.type === 'op' && t.value === '^') {
      this.next()
      const exponent = this.parseUnary() // right-associative, binds tighter than unary minus on the left
      const result = Math.pow(base, exponent)
      if (Number.isNaN(result) && !Number.isNaN(base) && !Number.isNaN(exponent)) {
        throw new ExpressionError('That power is not a real number (a negative base with a fractional exponent).', t.pos)
      }
      return result
    }
    return base
  }

  private parsePostfix(): number {
    let value = this.parsePrimary()
    for (;;) {
      const t = this.peek()
      if (t && t.type === 'bang') {
        this.next()
        value = factorial(value, t.pos)
        continue
      }
      if (t && t.type === 'percent') {
        this.next()
        value = value / 100
        continue
      }
      return value
    }
  }

  private parseArgs(fnName: string, spec: FnSpec, openPos: number): number[] {
    const args: number[] = []
    const open = this.next()
    if (!open || open.type !== 'lparen') {
      throw new ExpressionError(`"${fnName}" needs brackets around its input, like ${fnName}(2).`, openPos)
    }
    if (this.peek()?.type === 'rparen') {
      this.next()
    } else {
      for (;;) {
        args.push(this.parseAddSub())
        const t = this.peek()
        if (t && t.type === 'comma') {
          this.next()
          continue
        }
        if (t && t.type === 'rparen') {
          this.next()
          break
        }
        throw new ExpressionError(`"${fnName}" is missing its closing bracket.`, t ? t.pos : this.endPos())
      }
    }
    const [minA, maxA] = Array.isArray(spec.arity) ? spec.arity : [spec.arity, spec.arity]
    if (args.length < minA || args.length > maxA) {
      const want = minA === maxA ? `${minA}` : `${minA} to ${maxA}`
      throw new ExpressionError(`"${fnName}" takes ${want} value${maxA === 1 ? '' : 's'}, but got ${args.length}.`, openPos)
    }
    return args
  }

  private parsePrimary(): number {
    const t = this.next()
    if (!t) throw new ExpressionError('The expression ends too early. Something is missing at the end.', this.endPos())

    if (t.type === 'number') {
      const value = Number(t.value)
      if (!Number.isFinite(value)) throw new ExpressionError(`"${t.value}" is not a valid number.`, t.pos)
      return value
    }

    if (t.type === 'lparen') {
      const value = this.parseAddSub()
      const close = this.next()
      if (!close || close.type !== 'rparen') {
        throw new ExpressionError('A bracket was opened but never closed.', t.pos)
      }
      return value
    }

    if (t.type === 'ident') {
      const name = t.value
      if (name === 'ans') return this.ctx.ans
      if (name === 'mem' || name === 'm') return this.ctx.memory
      const fn = FUNCTIONS[name]
      if (fn) {
        const args = this.parseArgs(name, fn, t.pos)
        return fn.fn(args, this.ctx, t.pos)
      }
      if (name in CONSTANTS) return CONSTANTS[name]
      throw new ExpressionError(`"${t.value}" is not a function or constant this calculator knows.`, t.pos)
    }

    if (t.type === 'op') {
      throw new ExpressionError(`The operator "${t.value}" has nothing to work on here.`, t.pos)
    }
    if (t.type === 'rparen') {
      throw new ExpressionError('There is a closing bracket with no matching opening bracket.', t.pos)
    }
    if (t.type === 'comma') {
      throw new ExpressionError('A comma can only separate the inputs of a function.', t.pos)
    }
    throw new ExpressionError(`Unexpected "${t.value}".`, t.pos)
  }
}

/** Evaluate an expression string. Throws ExpressionError with a position. */
export function evaluateExpression(raw: string, ctx: EvalContext): number {
  const source = normaliseInput(raw)
  if (!source.trim()) throw new ExpressionError('Nothing to calculate yet.', 0)
  const tokens = tokenize(source)
  const parser = new Parser(tokens, ctx, source.length)
  const value = parser.parse()
  if (Number.isNaN(value)) throw new ExpressionError('The result is not a number. Check the inputs to the functions used.', 0)
  return value
}

/** Display formatting: 12 significant digits, no floating-point dust. */
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '−∞'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e12 || abs < 1e-9) {
    return value.toExponential(9).replace(/\.?0+e/, 'e').replace(/-/g, '−')
  }
  const rounded = Number(value.toPrecision(12))
  return String(rounded).replace(/-/g, '−')
}
