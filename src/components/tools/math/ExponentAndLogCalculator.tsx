import { useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { AnswerBanner, Field, StatGrid, StatTile, StepList, type Step } from './ui'
import { fmtGrouped, fmtNum, parseNum, superscript } from './math-core'

type Outcome =
  | { ok: true; answer: string; sub?: string; tiles: { label: string; value: string; hint?: string }[]; steps: Step[] }
  | { ok: false; message: string }
  | null

function Panel({ outcome, empty }: { outcome: Outcome; empty: string }) {
  if (outcome === null) {
    return (
      <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
        {empty}
      </p>
    )
  }
  if (!outcome.ok) return <ErrorNote message={outcome.message} />
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <AnswerBanner label="Answer" value={outcome.answer} sub={outcome.sub} />
      {outcome.tiles.length > 0 && (
        <StatGrid>
          {outcome.tiles.map((t) => (
            <StatTile key={t.label} label={t.label} value={t.value} hint={t.hint} tone="muted" />
          ))}
        </StatGrid>
      )}
      <StepList steps={outcome.steps} />
    </div>
  )
}

/* ─────────────────────────────── powers ───────────────────────────────── */

function PowerTab() {
  const [base, setBase] = useState('2')
  const [exponent, setExponent] = useState('10')

  const outcome = useMemo<Outcome>(() => {
    const b = parseNum(base)
    const n = parseNum(exponent)
    if (b === null || n === null) return null
    if (b === 0 && n < 0) return { ok: false, message: 'Zero to a negative power means dividing by zero, which is undefined.' }
    if (b < 0 && !Number.isInteger(n)) {
      return { ok: false, message: 'A negative base with a fractional exponent has no real value: it would be an even root of a negative number.' }
    }
    const value = Math.pow(b, n)
    if (!Number.isFinite(value)) return { ok: false, message: 'That power overflows what a double-precision number can hold (about 1.8 × 10³⁰⁸).' }

    const steps: Step[] = []
    if (Number.isInteger(n) && n >= 0 && n <= 12) {
      steps.push({
        label: 'A positive whole exponent means repeated multiplication.',
        expr: n === 0 ? `${fmtNum(b)}⁰ = 1 (anything except 0 to the power 0 is 1)` : `${fmtNum(b)}${superscript(String(n))} = ${Array.from({ length: n }, () => fmtNum(b)).join(' × ')} = ${fmtNum(value, 10)}`,
      })
    } else if (n < 0) {
      steps.push({
        label: 'A negative exponent means the reciprocal of the positive power.',
        expr: `${fmtNum(b)}${superscript(String(n))} = 1 / ${fmtNum(b)}${superscript(String(-n))} = 1 / ${fmtNum(Math.pow(b, -n), 10)} = ${fmtNum(value, 12)}`,
      })
    } else if (!Number.isInteger(n)) {
      steps.push({
        label: 'A fractional exponent is a root combined with a power.',
        expr: `${fmtNum(b)}${superscript(fmtNum(n))} = exp(${fmtNum(n)} × ln ${fmtNum(b)}) = exp(${fmtNum(n * Math.log(b), 8)}) = ${fmtNum(value, 10)}`,
        note: 'For example x^0.5 is √x and x^(2/3) is the cube root of x squared.',
      })
    } else {
      steps.push({
        label: 'Evaluate the power.',
        expr: `${fmtNum(b)}${superscript(String(n))} = ${fmtNum(value, 10)}`,
      })
    }
    steps.push({
      label: 'Check with logarithms.',
      expr: b > 0 ? `log₁₀(result) = ${fmtNum(n)} × log₁₀(${fmtNum(b)}) = ${fmtNum(n * Math.log10(b), 8)}` : 'Logarithm check needs a positive base.',
      note: 'The exponent rule log(bⁿ) = n·log(b) turns a big multiplication into an easy addition.',
    })

    return {
      ok: true,
      answer: fmtGrouped(value, 10),
      sub: `${fmtNum(b)} raised to the power ${fmtNum(n)}`,
      tiles: [
        { label: 'Scientific notation', value: value === 0 ? '0' : value.toExponential(6).replace('e', ' × 10^').replace('^+', '^') },
        { label: 'Reciprocal (bⁿ)⁻¹', value: value === 0 ? '1 ÷ 0 is undefined' : fmtNum(1 / value, 12) },
        { label: 'Square of the result', value: Number.isFinite(value * value) ? fmtNum(value * value, 8) : 'overflow' },
      ],
      steps,
    }
  }, [base, exponent])

  return (
    <div className="space-y-4">
      <ToolPanel title="Power: bⁿ" description="Raise any base to any exponent, including negative and fractional exponents.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Base (b)" value={base} onChange={setBase} placeholder="2" />
          <Field label="Exponent (n)" value={exponent} onChange={setExponent} placeholder="10" />
        </div>
      </ToolPanel>
      <Panel outcome={outcome} empty="Enter a base and an exponent." />
    </div>
  )
}

/* ──────────────────────────────── roots ───────────────────────────────── */

function RootTab() {
  const [degree, setDegree] = useState('3')
  const [value, setValue] = useState('27')

  const outcome = useMemo<Outcome>(() => {
    const n = parseNum(degree)
    const x = parseNum(value)
    if (n === null || x === null) return null
    if (n === 0) return { ok: false, message: 'A 0th root is undefined. Any number raised to the power 0 gives 1.' }
    if (x < 0 && Number.isInteger(n) && n % 2 === 0) {
      return { ok: false, message: `The ${fmtNum(n)}th root of a negative number is not a real number, because an even power is never negative.` }
    }
    if (x < 0 && !Number.isInteger(n)) {
      return { ok: false, message: 'A fractional root of a negative number has no real value.' }
    }
    const result = x < 0 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n)
    if (!Number.isFinite(result)) return { ok: false, message: 'That root could not be computed as a real number.' }

    const steps: Step[] = [
      {
        label: 'A root is a fractional exponent.',
        expr: `${n === 2 ? '√' : `${superscript(fmtNum(n))}√`}${fmtNum(x)} = ${fmtNum(x)}^(1/${fmtNum(n)})`,
      },
      {
        label: 'Evaluate using logarithms.',
        expr: `exp( ln(${fmtNum(Math.abs(x))}) / ${fmtNum(n)} ) = exp( ${fmtNum(Math.log(Math.abs(x)), 8)} / ${fmtNum(n)} ) = ${fmtNum(Math.abs(result), 10)}`,
        note: x < 0 ? 'The base is negative and the root is odd, so the sign carries through to the answer.' : undefined,
      },
      {
        label: 'Check by raising the answer back to the power.',
        expr: `${fmtNum(result, 8)}${superscript(fmtNum(n))} = ${fmtNum(Math.pow(result, n), 8)}`,
      },
    ]

    return {
      ok: true,
      answer: fmtGrouped(result, 10),
      sub: `The ${fmtNum(n)}${n === 2 ? 'nd (square)' : n === 3 ? 'rd (cube)' : 'th'} root of ${fmtNum(x)}`,
      tiles: [
        { label: 'Square root', value: x < 0 ? 'not real' : fmtNum(Math.sqrt(x), 10) },
        { label: 'Cube root', value: fmtNum(Math.cbrt(x), 10) },
        { label: 'Exact?', value: Number.isInteger(result) ? 'Yes, a whole number' : 'No, irrational or non-terminating' },
      ],
      steps,
    }
  }, [degree, value])

  return (
    <div className="space-y-4">
      <ToolPanel title="nth root" description="Square roots, cube roots and any other root. Odd roots of negative numbers are supported.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Root degree (n)" value={degree} onChange={setDegree} placeholder="3" />
          <Field label="Number (x)" value={value} onChange={setValue} placeholder="27" />
        </div>
      </ToolPanel>
      <Panel outcome={outcome} empty="Enter a root degree and a number." />
    </div>
  )
}

/* ────────────────────────────── logarithms ────────────────────────────── */

function LogTab() {
  const [base, setBase] = useState('2')
  const [value, setValue] = useState('1024')

  const outcome = useMemo<Outcome>(() => {
    const b = parseNum(base)
    const x = parseNum(value)
    if (b === null || x === null) return null
    if (x <= 0) return { ok: false, message: 'Logarithms are only defined for positive numbers. No power of a positive base is zero or negative.' }
    if (b <= 0 || b === 1) return { ok: false, message: 'The base must be positive and not equal to 1. Base 1 fails because 1 to any power is still 1.' }
    const result = Math.log(x) / Math.log(b)
    const steps: Step[] = [
      {
        label: 'A logarithm asks: what power turns the base into this number?',
        expr: `log base ${fmtNum(b)} of ${fmtNum(x)}  ⇔  ${fmtNum(b)}^? = ${fmtNum(x)}`,
      },
      {
        label: 'Use the change-of-base rule so it can be computed with natural logs.',
        expr: `log_${fmtNum(b)}(${fmtNum(x)}) = ln(${fmtNum(x)}) / ln(${fmtNum(b)})`,
      },
      {
        label: 'Evaluate both natural logs and divide.',
        expr: `${fmtNum(Math.log(x), 10)} ÷ ${fmtNum(Math.log(b), 10)} = ${fmtNum(result, 10)}`,
      },
      {
        label: 'Check by raising the base to that power.',
        expr: `${fmtNum(b)}^${fmtNum(result, 8)} = ${fmtNum(Math.pow(b, result), 8)}`,
      },
    ]
    return {
      ok: true,
      answer: fmtGrouped(result, 10),
      sub: `${fmtNum(b)} raised to ${fmtNum(result, 8)} gives ${fmtNum(x)}`,
      tiles: [
        { label: 'Natural log (ln x)', value: fmtNum(Math.log(x), 10) },
        { label: 'Common log (log₁₀ x)', value: fmtNum(Math.log10(x), 10) },
        { label: 'Binary log (log₂ x)', value: fmtNum(Math.log2(x), 10) },
        { label: 'Antilog of the answer', value: fmtNum(Math.pow(b, result), 8), hint: 'should return x' },
        { label: 'Digits in x (base 10)', value: String(Math.floor(Math.log10(x)) + 1) },
        { label: 'Bits needed for x', value: String(Math.max(1, Math.ceil(Math.log2(x + 1)))) },
      ],
      steps,
    }
  }, [base, value])

  return (
    <div className="space-y-4">
      <ToolPanel title="Logarithm in any base" description="Set the base to 10 for the common log, or to e (2.718281828) for the natural log.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Base (b)" value={base} onChange={setBase} placeholder="2" hint="Try 10, 2 or 2.718281828." />
          <Field label="Number (x)" value={value} onChange={setValue} placeholder="1024" />
        </div>
      </ToolPanel>
      <Panel outcome={outcome} empty="Enter a base and a number." />
    </div>
  )
}

/* ────────────────────── scientific notation ───────────────────────────── */

function significantDigits(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '')
  const stripped = cleaned.replace('.', '').replace(/^0+/, '')
  const trimmed = cleaned.includes('.') ? stripped : stripped.replace(/0+$/, '')
  return Math.max(1, trimmed.length)
}

function SciNotationTab() {
  const [plain, setPlain] = useState('149600000')
  const [mantissa, setMantissa] = useState('6.022')
  const [power, setPower] = useState('23')

  const forward = useMemo<Outcome>(() => {
    const n = parseNum(plain)
    if (n === null) return null
    if (n === 0) {
      return {
        ok: true,
        answer: '0 × 10⁰',
        sub: 'Zero has no meaningful exponent in scientific notation.',
        tiles: [],
        steps: [{ label: 'Zero is written as 0 in every notation.', expr: '0 = 0 × 10⁰' }],
      }
    }
    const exp = Math.floor(Math.log10(Math.abs(n)))
    const mant = n / 10 ** exp
    const engExp = Math.floor(exp / 3) * 3
    const engMant = n / 10 ** engExp
    return {
      ok: true,
      answer: `${fmtNum(mant, 10)} × 10${superscript(String(exp))}`,
      sub: `Standard form of ${fmtGrouped(n, 8)}`,
      tiles: [
        { label: 'Mantissa (coefficient)', value: fmtNum(mant, 10), hint: 'always between 1 and 10' },
        { label: 'Exponent', value: String(exp), hint: 'places the point moves' },
        { label: 'Engineering notation', value: `${fmtNum(engMant, 8)} × 10${superscript(String(engExp))}`, hint: 'exponent is a multiple of 3' },
        { label: 'Significant figures', value: String(significantDigits(plain)) },
        { label: 'E notation', value: `${fmtNum(mant, 10)}e${exp}` },
        { label: 'Order of magnitude', value: `10${superscript(String(exp))}` },
      ],
      steps: [
        {
          label: 'Move the decimal point until exactly one non-zero digit sits in front of it.',
          expr: `${fmtGrouped(n, 8)} → ${fmtNum(mant, 10)}`,
          note: `The point moved ${Math.abs(exp)} place${Math.abs(exp) === 1 ? '' : 's'} ${exp > 0 ? 'left' : 'right'}.`,
        },
        {
          label: 'The number of places becomes the exponent: left is positive, right is negative.',
          expr: `${fmtGrouped(n, 8)} = ${fmtNum(mant, 10)} × 10${superscript(String(exp))}`,
        },
      ],
    }
  }, [plain])

  const backward = useMemo<Outcome>(() => {
    const m = parseNum(mantissa)
    const p = parseNum(power)
    if (m === null || p === null) return null
    if (!Number.isInteger(p)) return { ok: false, message: 'The exponent in scientific notation has to be a whole number.' }
    const value = m * 10 ** p
    if (!Number.isFinite(value)) return { ok: false, message: 'That value is larger than a double-precision number can represent.' }
    return {
      ok: true,
      answer: Math.abs(value) >= 1e21 || (Math.abs(value) < 1e-6 && value !== 0) ? value.toExponential(10) : fmtGrouped(value, 10),
      sub: `${fmtNum(m)} × 10${superscript(String(p))} written out in full`,
      tiles: [
        { label: 'Decimal value', value: value.toLocaleString('en-US', { maximumFractionDigits: 12 }) },
        { label: 'Exponent sign', value: p >= 0 ? 'Positive (a large number)' : 'Negative (a small number)' },
        { label: 'Places the point moves', value: `${Math.abs(p)} to the ${p >= 0 ? 'right' : 'left'}` },
      ],
      steps: [
        {
          label: 'Multiplying by 10 to a power just shifts the decimal point.',
          expr: `${fmtNum(m)} × 10${superscript(String(p))}: move the point ${Math.abs(p)} place${Math.abs(p) === 1 ? '' : 's'} to the ${p >= 0 ? 'right' : 'left'}`,
        },
        {
          label: 'Fill the gap with zeros.',
          expr: `= ${Math.abs(value) >= 1e21 ? value.toExponential(10) : value.toLocaleString('en-US', { maximumFractionDigits: 12, useGrouping: false })}`,
        },
      ],
    }
  }, [mantissa, power])

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <ToolPanel title="Plain number → scientific notation" description="Turn a long number into standard form.">
          <Field label="Number" value={plain} onChange={setPlain} placeholder="149600000" />
        </ToolPanel>
        <Panel outcome={forward} empty="Enter a number to convert." />
      </div>
      <div className="space-y-4">
        <ToolPanel title="Scientific notation → plain number" description="Expand a × 10ⁿ back into an ordinary number.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mantissa (a)" value={mantissa} onChange={setMantissa} placeholder="6.022" />
            <Field label="Exponent (n)" value={power} onChange={setPower} placeholder="23" />
          </div>
        </ToolPanel>
        <Panel outcome={backward} empty="Enter a mantissa and an exponent." />
      </div>
    </div>
  )
}

export default function ExponentAndLogCalculator() {
  return (
    <Tabs defaultValue="power">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:grid-cols-4">
        <TabsTrigger value="power" className="text-xs sm:text-sm">Powers</TabsTrigger>
        <TabsTrigger value="root" className="text-xs sm:text-sm">Roots</TabsTrigger>
        <TabsTrigger value="log" className="text-xs sm:text-sm">Logarithms</TabsTrigger>
        <TabsTrigger value="sci" className="text-xs sm:text-sm">Scientific notation</TabsTrigger>
      </TabsList>
      <TabsContent value="power" className="mt-4">
        <PowerTab />
      </TabsContent>
      <TabsContent value="root" className="mt-4">
        <RootTab />
      </TabsContent>
      <TabsContent value="log" className="mt-4">
        <LogTab />
      </TabsContent>
      <TabsContent value="sci" className="mt-4">
        <SciNotationTab />
      </TabsContent>
    </Tabs>
  )
}
