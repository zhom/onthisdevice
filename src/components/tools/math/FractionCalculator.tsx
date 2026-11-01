import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { AnswerBanner, Field, StatGrid, StatTile, StepList, type Step } from './ui'
import {
  fAdd,
  fDiv,
  fMul,
  fSub,
  fToNumber,
  fToString,
  fractionToDecimal,
  frac,
  gcdBig,
  lcmBig,
  longDivisionString,
  mixedToString,
  parseFraction,
  toMixed,
  type Frac,
} from './math-core'

type Op = 'add' | 'sub' | 'mul' | 'div'

const OPS: { id: Op; symbol: string; label: string }[] = [
  { id: 'add', symbol: '+', label: 'Add' },
  { id: 'sub', symbol: '−', label: 'Subtract' },
  { id: 'mul', symbol: '×', label: 'Multiply' },
  { id: 'div', symbol: '÷', label: 'Divide' },
]

interface Solved {
  result: Frac
  steps: Step[]
  a: Frac
  b: Frac
}

function solve(a: Frac, b: Frac, op: Op): Solved {
  const steps: Step[] = []
  const symbol = OPS.find((o) => o.id === op)!.symbol

  steps.push({
    label: 'Write both values as improper fractions.',
    expr: `${fToString(a)}  ${symbol}  ${fToString(b)}`,
    note: 'A mixed number a b/c becomes (a × c + b)/c; a whole number n becomes n/1.',
  })

  let result: Frac
  if (op === 'add' || op === 'sub') {
    const lcd = lcmBig(a.d, b.d)
    const fa = lcd / a.d
    const fb = lcd / b.d
    const na = a.n * fa
    const nb = b.n * fb
    steps.push({
      label: 'Find the least common denominator (LCD) of the two denominators.',
      expr: `LCD(${a.d}, ${b.d}) = ${lcd}`,
      note: `LCD = ${a.d} × ${b.d} ÷ GCD(${a.d}, ${b.d}) = ${a.d * b.d} ÷ ${gcdBig(a.d, b.d)} = ${lcd}`,
    })
    steps.push({
      label: 'Rewrite both fractions over that denominator.',
      expr: `${a.n}/${a.d} = ${na}/${lcd}   and   ${b.n}/${b.d} = ${nb}/${lcd}`,
      note: `Multiply the first by ${fa}/${fa} and the second by ${fb}/${fb}. Both equal 1, so the values do not change.`,
    })
    const rawN = op === 'add' ? na + nb : na - nb
    steps.push({
      label: `${op === 'add' ? 'Add' : 'Subtract'} the numerators and keep the denominator.`,
      expr: `${na}/${lcd} ${symbol} ${nb}/${lcd} = ${rawN}/${lcd}`,
    })
    result = op === 'add' ? fAdd(a, b) : fSub(a, b)
    const g = gcdBig(rawN, lcd)
    steps.push({
      label: g > 1n ? 'Simplify by dividing top and bottom by their greatest common divisor.' : 'Check for common factors. There are none, so this is already in lowest terms.',
      expr: g > 1n ? `GCD(${rawN < 0n ? -rawN : rawN}, ${lcd}) = ${g}  →  ${rawN}/${lcd} = ${fToString(result)}` : `GCD(${rawN < 0n ? -rawN : rawN}, ${lcd}) = 1`,
    })
  } else if (op === 'mul') {
    const rawN = a.n * b.n
    const rawD = a.d * b.d
    steps.push({
      label: 'Multiply the numerators together and the denominators together.',
      expr: `(${a.n} × ${b.n}) / (${a.d} × ${b.d}) = ${rawN}/${rawD}`,
      note: 'No common denominator is needed for multiplication.',
    })
    result = fMul(a, b)
    const g = gcdBig(rawN, rawD)
    steps.push({
      label: g > 1n ? 'Cancel the common factor between top and bottom.' : 'The product is already in lowest terms.',
      expr: g > 1n ? `GCD(${rawN < 0n ? -rawN : rawN}, ${rawD}) = ${g}  →  ${fToString(result)}` : `GCD(${rawN < 0n ? -rawN : rawN}, ${rawD}) = 1`,
    })
  } else {
    if (b.n === 0n) throw new Error('You cannot divide by zero: the second fraction has a numerator of 0.')
    steps.push({
      label: 'Dividing by a fraction is the same as multiplying by its reciprocal.',
      expr: `${fToString(a)} ÷ ${fToString(b)} = ${fToString(a)} × ${fToString(frac(b.d, b.n))}`,
      note: 'Flip the second fraction upside down and change the ÷ to a ×.',
    })
    const flipped = frac(b.d, b.n)
    const rawN = a.n * flipped.n
    const rawD = a.d * flipped.d
    steps.push({
      label: 'Multiply straight across.',
      expr: `(${a.n} × ${flipped.n}) / (${a.d} × ${flipped.d}) = ${rawN}/${rawD}`,
    })
    result = fDiv(a, b)
    const g = gcdBig(rawN, rawD)
    steps.push({
      label: g > 1n ? 'Reduce to lowest terms.' : 'The quotient is already in lowest terms.',
      expr: g > 1n ? `GCD(${rawN < 0n ? -rawN : rawN}, ${rawD < 0n ? -rawD : rawD}) = ${g}  →  ${fToString(result)}` : `GCD = 1`,
    })
  }

  const mixed = toMixed(result)
  if (result.d !== 1n && mixed.whole !== 0n) {
    steps.push({
      label: 'Convert the improper fraction to a mixed number.',
      expr: `${fToString(result)} = ${mixedToString(result)}`,
      note:
        mixed.n === 0n
          ? undefined
          : `Because ${result.n < 0n ? -result.n : result.n} ÷ ${result.d} = ${mixed.whole} remainder ${mixed.n}.`,
    })
  }

  const dec = fractionToDecimal(result)
  steps.push({
    label: 'Divide the numerator by the denominator for the decimal value.',
    expr: `${result.n} ÷ ${result.d} = ${longDivisionString(dec)}`,
    note: dec.repeat ? `The digits in brackets repeat forever. This is a recurring decimal.` : 'This decimal terminates.',
  })

  return { result, steps, a, b }
}

export default function FractionCalculator() {
  const [left, setLeft] = useState('2 3/4')
  const [right, setRight] = useState('5/6')
  const [op, setOp] = useState<Op>('add')

  const outcome = useMemo(() => {
    if (!left.trim() || !right.trim()) return null
    try {
      const a = parseFraction(left)
      const b = parseFraction(right)
      if (!a || !b) return null
      return { ok: true as const, ...solve(a, b, op) }
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : 'That input could not be read.' }
    }
  }, [left, right, op])

  const decimal = outcome?.ok ? fToNumber(outcome.result) : 0
  const expansion = outcome?.ok ? fractionToDecimal(outcome.result) : null

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Fraction calculator"
        description="Type whole numbers, fractions like 7/8, mixed numbers like 2 3/4, or decimals like 1.25."
      >
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <Field label="First value" value={left} onChange={setLeft} inputMode="text" placeholder="2 3/4" />
          <div className="flex items-center justify-center pb-1 text-2xl font-semibold text-muted-foreground sm:pb-2" aria-hidden="true">
            {OPS.find((o) => o.id === op)?.symbol}
          </div>
          <Field label="Second value" value={right} onChange={setRight} inputMode="text" placeholder="5/6" />
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-foreground">Operation</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OPS.map((o) => (
              <Button
                key={o.id}
                type="button"
                variant={op === o.id ? 'default' : 'outline'}
                aria-pressed={op === o.id}
                onClick={() => setOp(o.id)}
              >
                <span aria-hidden="true" className="mr-1.5 font-mono">
                  {o.symbol}
                </span>
                {o.label}
              </Button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setLeft(right); setRight(left) }}>
            Swap values
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setLeft(''); setRight('') }}>
            Clear
          </Button>
        </div>
      </ToolPanel>

      {outcome === null ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
          Enter two values to see the answer with every step of the working.
        </p>
      ) : !outcome.ok ? (
        <ErrorNote message={outcome.message} />
      ) : (
        <div className="space-y-4" role="status" aria-live="polite">
          <AnswerBanner
            label={`${fToString(outcome.a)} ${OPS.find((o) => o.id === op)?.symbol} ${fToString(outcome.b)}`}
            value={fToString(outcome.result)}
            sub={
              outcome.result.d === 1n
                ? 'A whole number: the denominator cancelled completely.'
                : `Mixed number: ${mixedToString(outcome.result)} · Decimal: ${expansion ? longDivisionString(expansion) : ''}`
            }
          />
          <StatGrid>
            <StatTile label="Simplified fraction" value={fToString(outcome.result)} tone="muted" />
            <StatTile label="Mixed number" value={mixedToString(outcome.result)} tone="muted" />
            <StatTile
              label="Decimal"
              value={expansion ? longDivisionString(expansion) : '–'}
              hint={expansion?.repeat ? 'brackets mark the repeating block' : 'exact, terminating'}
              tone="muted"
            />
            <StatTile label="Percentage" value={`${(decimal * 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`} tone="muted" />
            <StatTile label="Numerator" value={String(outcome.result.n)} tone="muted" />
            <StatTile label="Denominator" value={String(outcome.result.d)} tone="muted" />
          </StatGrid>
          <StepList steps={outcome.steps} />
        </div>
      )}
    </div>
  )
}
