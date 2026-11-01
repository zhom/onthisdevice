import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn } from '@/lib/utils'
import { ExpressionError, evaluateExpression, formatResult, type AngleMode } from './expression'

interface HistoryEntry {
  id: number
  expr: string
  result: string
  mode: AngleMode
}

interface KeyDef {
  /** Text on the key. */
  label: string
  /** Screen-reader label when the visible one is a symbol. */
  aria?: string
  /** Text inserted into the expression. */
  insert?: string
  /** Caret offset from the end of the inserted text (negative moves back). */
  caret?: number
  action?: 'equals' | 'clear' | 'back' | 'second' | 'angle' | 'ans'
  tone?: 'fn' | 'num' | 'op' | 'accent'
  wide?: boolean
}

export default function ScientificCalculator() {
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState<string>('0')
  const [error, setError] = useState<{ message: string; position: number } | null>(null)
  const [angleMode, setAngleMode] = useState<AngleMode>('deg')
  const [second, setSecond] = useState(false)
  const [memory, setMemory] = useState(0)
  const [ans, setAns] = useState(0)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(1)

  const ctx = useMemo(() => ({ angleMode, memory, ans }), [angleMode, memory, ans])

  /** Live preview: evaluated on every keystroke, but errors stay quiet. */
  const preview = useMemo(() => {
    if (!expr.trim()) return null
    try {
      return formatResult(evaluateExpression(expr, ctx))
    } catch {
      return null
    }
  }, [expr, ctx])

  const focusInput = useCallback((caret?: number) => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    if (caret !== undefined) el.setSelectionRange(caret, caret)
  }, [])

  const insert = useCallback(
    (text: string, caretShift = 0) => {
      const el = inputRef.current
      const start = el?.selectionStart ?? expr.length
      const end = el?.selectionEnd ?? expr.length
      const nextExpr = expr.slice(0, start) + text + expr.slice(end)
      setExpr(nextExpr)
      setError(null)
      requestAnimationFrame(() => focusInput(start + text.length + caretShift))
    },
    [expr, focusInput],
  )

  const backspace = useCallback(() => {
    const el = inputRef.current
    const start = el?.selectionStart ?? expr.length
    const end = el?.selectionEnd ?? expr.length
    if (start === end) {
      if (start === 0) return
      const nextExpr = expr.slice(0, start - 1) + expr.slice(end)
      setExpr(nextExpr)
      requestAnimationFrame(() => focusInput(start - 1))
    } else {
      setExpr(expr.slice(0, start) + expr.slice(end))
      requestAnimationFrame(() => focusInput(start))
    }
    setError(null)
  }, [expr, focusInput])

  const clearAll = useCallback(() => {
    setExpr('')
    setError(null)
    setResult('0')
    focusInput(0)
  }, [focusInput])

  const evaluate = useCallback(() => {
    if (!expr.trim()) return
    try {
      const value = evaluateExpression(expr, ctx)
      const formatted = formatResult(value)
      setResult(formatted)
      setAns(value)
      setError(null)
      setHistory((h) => [{ id: nextId.current++, expr, result: formatted, mode: angleMode }, ...h].slice(0, 50))
    } catch (err) {
      if (err instanceof ExpressionError) setError({ message: err.message, position: err.position })
      else setError({ message: err instanceof Error ? err.message : 'That expression could not be evaluated.', position: 0 })
    }
  }, [expr, ctx, angleMode])

  /* Typing anywhere on the page goes into the expression box. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.length === 1 && /[0-9+\-*/^().!%a-zA-Z]/.test(e.key)) {
        e.preventDefault()
        focusInput()
        insert(e.key)
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault()
        evaluate()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusInput, insert, evaluate])

  const memoryKeys: { label: string; aria: string; onClick: () => void }[] = [
    { label: 'MC', aria: 'Memory clear', onClick: () => setMemory(0) },
    { label: 'MR', aria: 'Memory recall', onClick: () => insert('mem') },
    { label: 'M+', aria: 'Add result to memory', onClick: () => setMemory((m) => m + ans) },
    { label: 'M−', aria: 'Subtract result from memory', onClick: () => setMemory((m) => m - ans) },
    { label: 'MS', aria: 'Store result in memory', onClick: () => setMemory(ans) },
  ]

  const sciKeys: KeyDef[] = [
    { label: second ? '2nd ✓' : '2nd', aria: 'Toggle second functions', action: 'second', tone: 'accent' },
    { label: angleMode === 'deg' ? 'DEG' : 'RAD', aria: `Angle mode, currently ${angleMode === 'deg' ? 'degrees' : 'radians'}`, action: 'angle', tone: 'accent' },
    { label: '(', insert: '(', tone: 'fn' },
    { label: ')', insert: ')', tone: 'fn' },
    second
      ? { label: 'sin⁻¹', aria: 'inverse sine', insert: 'asin(', caret: 0, tone: 'fn' }
      : { label: 'sin', insert: 'sin(', tone: 'fn' },
    second
      ? { label: 'cos⁻¹', aria: 'inverse cosine', insert: 'acos(', tone: 'fn' }
      : { label: 'cos', insert: 'cos(', tone: 'fn' },
    second
      ? { label: 'tan⁻¹', aria: 'inverse tangent', insert: 'atan(', tone: 'fn' }
      : { label: 'tan', insert: 'tan(', tone: 'fn' },
    { label: 'xʸ', aria: 'x to the power of y', insert: '^', tone: 'fn' },
    second ? { label: 'eˣ', aria: 'e to the x', insert: 'exp(', tone: 'fn' } : { label: 'ln', insert: 'ln(', tone: 'fn' },
    second ? { label: '10ˣ', aria: '10 to the x', insert: '10^(', tone: 'fn' } : { label: 'log', aria: 'log base 10', insert: 'log(', tone: 'fn' },
    second ? { label: '∛', aria: 'cube root', insert: 'cbrt(', tone: 'fn' } : { label: '√', aria: 'square root', insert: 'sqrt(', tone: 'fn' },
    { label: 'n!', aria: 'factorial', insert: '!', tone: 'fn' },
    { label: 'π', aria: 'pi', insert: 'pi', tone: 'fn' },
    { label: 'e', aria: "Euler's number", insert: 'e', tone: 'fn' },
    second ? { label: '|x|', aria: 'absolute value', insert: 'abs(', tone: 'fn' } : { label: '1/x', aria: 'reciprocal', insert: '1/(', tone: 'fn' },
    second ? { label: 'x³', aria: 'x cubed', insert: '^3', tone: 'fn' } : { label: 'x²', aria: 'x squared', insert: '^2', tone: 'fn' },
  ]

  const padKeys: KeyDef[] = [
    { label: 'AC', aria: 'Clear everything', action: 'clear', tone: 'accent' },
    { label: '⌫', aria: 'Backspace', action: 'back', tone: 'accent' },
    { label: '%', aria: 'percent', insert: '%', tone: 'op' },
    { label: '÷', aria: 'divide', insert: '/', tone: 'op' },
    { label: '7', insert: '7', tone: 'num' },
    { label: '8', insert: '8', tone: 'num' },
    { label: '9', insert: '9', tone: 'num' },
    { label: '×', aria: 'multiply', insert: '*', tone: 'op' },
    { label: '4', insert: '4', tone: 'num' },
    { label: '5', insert: '5', tone: 'num' },
    { label: '6', insert: '6', tone: 'num' },
    { label: '−', aria: 'minus', insert: '-', tone: 'op' },
    { label: '1', insert: '1', tone: 'num' },
    { label: '2', insert: '2', tone: 'num' },
    { label: '3', insert: '3', tone: 'num' },
    { label: '+', aria: 'plus', insert: '+', tone: 'op' },
    { label: '0', insert: '0', tone: 'num' },
    { label: '.', aria: 'decimal point', insert: '.', tone: 'num' },
    { label: 'ANS', aria: 'Previous answer', action: 'ans', tone: 'num' },
    { label: '=', aria: 'Equals', action: 'equals', tone: 'accent' },
  ]

  const runKey = (k: KeyDef) => {
    switch (k.action) {
      case 'equals':
        evaluate()
        return
      case 'clear':
        clearAll()
        return
      case 'back':
        backspace()
        return
      case 'second':
        setSecond((s) => !s)
        return
      case 'angle':
        setAngleMode((m) => (m === 'deg' ? 'rad' : 'deg'))
        return
      case 'ans':
        insert('ans')
        return
      default:
        if (k.insert) insert(k.insert, k.caret ?? 0)
    }
  }

  const keyClass = (tone: KeyDef['tone']) =>
    cn(
      'h-11 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
      tone === 'num' && 'bg-background text-foreground',
      tone === 'op' && 'bg-muted text-foreground hover:bg-background',
      tone === 'fn' && 'bg-muted text-foreground hover:bg-background',
      tone === 'accent' && 'bg-primary text-primary-foreground',
    )

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Scientific calculator"
        description="Type an expression or use the keypad. Functions like sin, ln, sqrt and log(base, x) all work by name."
      >
        <div className="space-y-1.5">
          <Label htmlFor="calc-expression">Expression</Label>
          <input
            id="calc-expression"
            ref={inputRef}
            value={expr}
            onChange={(e) => {
              setExpr(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                evaluate()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                clearAll()
              }
            }}
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. 2*sin(45) + log(2, 1024)"
            aria-describedby="calc-preview"
            aria-invalid={error ? true : undefined}
            className="w-full rounded-lg border border-input bg-background px-3 py-3 font-mono text-lg text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="mt-3 rounded-lg bg-muted p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Result</span>
            <span className="text-xs text-muted-foreground">
              {angleMode === 'deg' ? 'Degrees' : 'Radians'} · memory {formatResult(memory)}
            </span>
          </div>
          <output id="calc-preview" className="mt-1 block break-words font-mono text-3xl font-semibold text-foreground" aria-live="polite">
            {result}
          </output>
          {preview !== null && preview !== result && (
            <p className="mt-1 font-mono text-sm text-muted-foreground">Live preview: {preview}</p>
          )}
          {error && (
            <p className="mt-2 flex items-start gap-2 text-sm text-foreground" role="alert">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {error.message}
                {error.position > 0 ? ` (at character ${error.position + 1})` : ''}
              </span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton value={result.replace(/−/g, '-')} label="Copy result" />
            <Button type="button" size="sm" variant="outline" onClick={evaluate}>
              Calculate
            </Button>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel title="Keypad" description="Every key also has a keyboard equivalent: type into the box above.">
        <div className="mb-3 grid grid-cols-5 gap-1.5" role="group" aria-label="Memory keys">
          {memoryKeys.map((k) => (
            <button key={k.label} type="button" aria-label={k.aria} onClick={k.onClick} className={keyClass('fn')}>
              {k.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Scientific functions">
            {sciKeys.map((k, i) => (
              <button
                key={`${k.label}-${i}`}
                type="button"
                aria-label={k.aria ?? k.label}
                aria-pressed={k.action === 'second' ? second : undefined}
                onClick={() => runKey(k)}
                className={keyClass(k.tone)}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Number and operator keys">
            {padKeys.map((k, i) => (
              <button
                key={`${k.label}-${i}`}
                type="button"
                aria-label={k.aria ?? k.label}
                onClick={() => runKey(k)}
                className={keyClass(k.tone)}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Angle mode applies to sin, cos, tan and their inverses. <code className="font-mono">ans</code> is the previous result and{' '}
          <code className="font-mono">mem</code> is the stored memory value; both can be typed directly. A trailing{' '}
          <code className="font-mono">%</code> divides by 100, so <code className="font-mono">50%</code> is 0.5.
        </p>
      </ToolPanel>

      <ToolPanel
        title="History tape"
        description="The last 50 calculations from this session. Nothing is saved once you close the tab."
        footer={
          history.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <CopyButton value={history.map((h) => `${h.expr} = ${h.result}  [${h.mode}]`).join('\n')} label="Copy tape" />
              <Button type="button" variant="ghost" size="sm" onClick={() => setHistory([])}>
                Clear history
              </Button>
            </div>
          ) : undefined
        }
      >
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing calculated yet. Your results are listed here.</p>
        ) : (
          <ol className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-baseline justify-between gap-2 rounded px-1 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    setExpr(h.expr)
                    setError(null)
                    focusInput(h.expr.length)
                  }}
                >
                  <span className="min-w-0 break-all font-mono text-sm text-muted-foreground">{h.expr}</span>
                  <span className="font-mono text-sm font-semibold text-foreground">
                    = {h.result}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{h.mode}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </ToolPanel>
    </div>
  )
}
