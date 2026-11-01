import { useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { AnswerBanner, Field, StatGrid, StatTile, StepList, type Step } from './ui'
import {
  decimalToFraction,
  fractionToDecimal,
  frac,
  gcdBig,
  longDivisionString,
  mixedToString,
  parseDecimalInput,
  parseFraction,
  toMixed,
  type Frac,
} from './math-core'

const EXAMPLES = ['0.75', '0.(3)', '1.8(3)', '0.125', '0.(142857)', '2.375', '0.999...']

function unreduced(sign: -1 | 1, intDigits: string, fixedDigits: string, repeatDigits: string): { n: bigint; d: bigint } {
  const nonRepeat = `${intDigits}${fixedDigits}`
  if (!repeatDigits) {
    return { n: BigInt(sign) * BigInt(nonRepeat || '0'), d: 10n ** BigInt(fixedDigits.length) }
  }
  const all = BigInt(`${nonRepeat}${repeatDigits}`)
  const head = BigInt(nonRepeat || '0')
  return {
    n: BigInt(sign) * (all - head),
    d: (10n ** BigInt(repeatDigits.length) - 1n) * 10n ** BigInt(fixedDigits.length),
  }
}

function decimalSteps(input: string): { result: Frac; steps: Step[]; raw: { n: bigint; d: bigint }; repeating: boolean } {
  const parsed = parseDecimalInput(input)
  const { sign, intDigits, fixedDigits, repeatDigits } = parsed
  const steps: Step[] = []
  const signText = sign < 0 ? '−' : ''
  const display = `${signText}${intDigits}${fixedDigits || repeatDigits ? '.' : ''}${fixedDigits}${repeatDigits ? `(${repeatDigits})` : ''}`
  const raw = unreduced(sign, intDigits, fixedDigits, repeatDigits)
  const result = decimalToFraction(parsed)

  if (!repeatDigits) {
    const places = fixedDigits.length
    steps.push({
      label: 'Count the digits after the decimal point.',
      expr: `${display} has ${places} decimal place${places === 1 ? '' : 's'}`,
    })
    steps.push({
      label: 'Write the digits as a whole number over 1 followed by that many zeros.',
      expr: `${display} = ${raw.n}/${raw.d}`,
      note: `10^${places} = ${raw.d}, so multiplying and dividing by ${raw.d} clears the decimal point.`,
    })
  } else {
    const k = repeatDigits.length
    const m = fixedDigits.length
    steps.push({
      label: 'Name the number and identify the repeating block.',
      expr: `x = ${display}   (the block "${repeatDigits}" repeats forever)`,
    })
    if (m > 0) {
      steps.push({
        label: 'Shift the non-repeating digits past the point first.',
        expr: `10^${m} · x = ${10n ** BigInt(m)}x = ${signText}${intDigits}${fixedDigits}.(${repeatDigits})`,
      })
    }
    steps.push({
      label: `Shift by a further ${k} place${k === 1 ? '' : 's'} so the repeating tails line up.`,
      expr: `10^${m + k} · x = ${10n ** BigInt(m + k)}x = ${signText}${intDigits}${fixedDigits}${repeatDigits}.(${repeatDigits})`,
    })
    steps.push({
      label: 'Subtract the smaller shift from the larger. The infinite tails cancel exactly.',
      expr: `(${10n ** BigInt(m + k)} − ${10n ** BigInt(m)})·|x| = ${BigInt(`${intDigits}${fixedDigits}${repeatDigits}`)} − ${BigInt(`${intDigits}${fixedDigits}` || '0')}`,
      note: `That leaves ${raw.d}·|x| = ${raw.n < 0n ? -raw.n : raw.n}, with no repeating part on either side.${sign < 0 ? ' The minus sign is put back at the end.' : ''}`,
    })
    steps.push({
      label: 'Divide to isolate x.',
      expr: `x = ${raw.n}/${raw.d}`,
    })
  }

  const g = gcdBig(raw.n < 0n ? -raw.n : raw.n, raw.d)
  steps.push({
    label: g > 1n ? 'Simplify by the greatest common divisor.' : 'Check for common factors. There are none, so this is already in lowest terms.',
    expr: g > 1n ? `GCD(${raw.n < 0n ? -raw.n : raw.n}, ${raw.d}) = ${g}  →  ${result.n}/${result.d}` : `GCD(${raw.n < 0n ? -raw.n : raw.n}, ${raw.d}) = 1`,
  })

  const m2 = toMixed(result)
  if (result.d !== 1n && m2.whole !== 0n) {
    steps.push({
      label: 'Write it as a mixed number.',
      expr: `${result.n}/${result.d} = ${mixedToString(result)}`,
    })
  }

  return { result, steps, raw, repeating: Boolean(repeatDigits) }
}

export default function DecimalToFractionConverter() {
  const [decimal, setDecimal] = useState('0.(3)')
  const [fraction, setFraction] = useState('5/7')

  const forward = useMemo(() => {
    if (!decimal.trim()) return null
    try {
      return { ok: true as const, ...decimalSteps(decimal) }
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : 'Could not read that decimal.' }
    }
  }, [decimal])

  const backward = useMemo(() => {
    if (!fraction.trim()) return null
    try {
      const f = parseFraction(fraction)
      if (!f) return null
      const expansion = fractionToDecimal(f)
      const steps: Step[] = [
        {
          label: 'Divide the numerator by the denominator using long division.',
          expr: `${f.n} ÷ ${f.d} = ${longDivisionString(expansion)}`,
        },
      ]
      if (expansion.repeat) {
        steps.push({
          label: 'A remainder repeated, so the digits repeat from that point on.',
          expr: `repeating block: (${expansion.repeat}), ${expansion.repeat.length} digit${expansion.repeat.length === 1 ? '' : 's'} long`,
          note: 'The cycle length can never exceed the denominator minus one, because there are only that many possible remainders.',
        })
      } else {
        steps.push({
          label: 'The remainder reached zero, so the decimal terminates.',
          expr: `${longDivisionString(expansion)} is exact`,
          note: 'A fraction terminates exactly when its reduced denominator has no prime factors other than 2 and 5.',
        })
      }
      return { ok: true as const, f, expansion, steps }
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : 'Could not read that fraction.' }
    }
  }, [fraction])

  return (
    <Tabs defaultValue="to-fraction">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1">
        <TabsTrigger value="to-fraction">Decimal → fraction</TabsTrigger>
        <TabsTrigger value="to-decimal">Fraction → decimal</TabsTrigger>
      </TabsList>

      <TabsContent value="to-fraction" className="mt-4 space-y-4">
        <ToolPanel
          title="Decimal to fraction"
          description="Repeating decimals: put the repeating block in brackets, e.g. 0.(3) or 1.8(3). Plain decimals work as-is."
        >
          <Field
            label="Decimal number"
            value={decimal}
            onChange={setDecimal}
            inputMode="text"
            placeholder="0.(3)"
            hint="Also accepts 0.333... and overlined text pasted from a document."
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <Button key={e} type="button" variant="outline" size="sm" className="font-mono" onClick={() => setDecimal(e)}>
                {e}
              </Button>
            ))}
          </div>
        </ToolPanel>

        {forward === null ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
            Enter a decimal to see the exact fraction and the algebra behind it.
          </p>
        ) : !forward.ok ? (
          <ErrorNote message={forward.message} />
        ) : (
          <div className="space-y-4" role="status" aria-live="polite">
            <AnswerBanner
              label="Exact fraction"
              value={forward.result.d === 1n ? String(forward.result.n) : `${forward.result.n}/${forward.result.d}`}
              sub={
                forward.repeating
                  ? 'Exact. A repeating decimal is always a rational number, so nothing is rounded here.'
                  : 'Exact. Nothing is rounded, and the fraction gives back the same decimal.'
              }
            />
            <StatGrid>
              <StatTile label="Simplified" value={`${forward.result.n}/${forward.result.d}`} tone="muted" />
              <StatTile label="Mixed number" value={mixedToString(forward.result)} tone="muted" />
              <StatTile
                label="Before simplifying"
                value={`${forward.raw.n}/${forward.raw.d}`}
                hint={`divided through by ${gcdBig(forward.raw.n < 0n ? -forward.raw.n : forward.raw.n, forward.raw.d)}`}
                tone="muted"
              />
              <StatTile
                label="Check: back to decimal"
                value={longDivisionString(fractionToDecimal(forward.result))}
                tone="muted"
              />
              <StatTile label="Percentage" value={`${longDivisionString(fractionToDecimal(frac(forward.result.n * 100n, forward.result.d)))}%`} tone="muted" />
              <StatTile
                label="Reciprocal"
                value={forward.result.n === 0n ? '1 ÷ 0 is undefined' : `${frac(forward.result.d, forward.result.n).n}/${frac(forward.result.d, forward.result.n).d}`}
                tone="muted"
              />
            </StatGrid>
            <StepList steps={forward.steps} />
          </div>
        )}
      </TabsContent>

      <TabsContent value="to-decimal" className="mt-4 space-y-4">
        <ToolPanel title="Fraction to decimal" description="Exact long division with the repeating cycle detected, not a rounded approximation.">
          <Field
            label="Fraction"
            value={fraction}
            onChange={setFraction}
            inputMode="text"
            placeholder="5/7"
            hint="Accepts 5/7, 2 3/4 and whole numbers."
          />
        </ToolPanel>

        {backward === null ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
            Enter a fraction to see its exact decimal expansion.
          </p>
        ) : !backward.ok ? (
          <ErrorNote message={backward.message} />
        ) : (
          <div className="space-y-4" role="status" aria-live="polite">
            <AnswerBanner
              label={`${backward.f.n}/${backward.f.d} as a decimal`}
              value={longDivisionString(backward.expansion)}
              sub={
                backward.expansion.repeat
                  ? `The digits in brackets repeat forever (cycle length ${backward.expansion.repeat.length}).`
                  : 'This decimal terminates exactly.'
              }
            />
            <StatGrid>
              <StatTile label="Rounded to 6 dp" value={(Number(backward.f.n) / Number(backward.f.d)).toFixed(6)} tone="muted" />
              <StatTile
                label="Cycle length"
                value={backward.expansion.repeat ? String(backward.expansion.repeat.length) : '0 (terminates)'}
                tone="muted"
              />
              <StatTile label="Percentage" value={`${longDivisionString(fractionToDecimal(frac(backward.f.n * 100n, backward.f.d)))}%`} tone="muted" />
            </StatGrid>
            <StepList steps={backward.steps} />
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
