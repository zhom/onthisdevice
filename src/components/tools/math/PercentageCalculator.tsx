import { useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { AnswerBanner, Field, StatGrid, StatTile, StepList, type Step } from './ui'
import { fmtGrouped, fmtNum, parseNum } from './math-core'

type Mode = 'of' | 'is-what' | 'change' | 'adjust'
type Direction = 'plus' | 'minus'

interface Outcome {
  answer: string
  sub?: string
  steps: Step[]
  tiles: { label: string; value: string; hint?: string }[]
}

function bothNumbers(a: string, b: string): [number, number] | null {
  const x = parseNum(a)
  const y = parseNum(b)
  return x === null || y === null ? null : [x, y]
}

export default function PercentageCalculator() {
  const [mode, setMode] = useState<Mode>('of')

  const [ofPercent, setOfPercent] = useState('15')
  const [ofValue, setOfValue] = useState('240')

  const [partValue, setPartValue] = useState('36')
  const [wholeValue, setWholeValue] = useState('240')

  const [fromValue, setFromValue] = useState('80')
  const [toValue, setToValue] = useState('100')

  const [baseValue, setBaseValue] = useState('250')
  const [adjustPercent, setAdjustPercent] = useState('20')
  const [direction, setDirection] = useState<Direction>('plus')

  const ofResult = useMemo<Outcome | { error: string } | null>(() => {
    const pair = bothNumbers(ofPercent, ofValue)
    if (!pair) return null
    const [p, v] = pair
    const result = (p / 100) * v
    return {
      answer: fmtGrouped(result, 10),
      sub: `${fmtNum(p)}% of ${fmtNum(v)}`,
      steps: [
        {
          label: 'Write the percentage as a decimal by dividing by 100.',
          expr: `${fmtNum(p)}% = ${fmtNum(p)} ÷ 100 = ${fmtNum(p / 100, 12)}`,
        },
        {
          label: 'Multiply that decimal by the number.',
          expr: `${fmtNum(p / 100, 12)} × ${fmtNum(v)} = ${fmtNum(result, 10)}`,
        },
        {
          label: 'Answer.',
          expr: `${fmtNum(p)}% of ${fmtNum(v)} = ${fmtNum(result, 10)}`,
          note: 'The same answer comes from (percent × number) ÷ 100. The order of the two operations does not matter.',
        },
      ],
      tiles: [
        { label: 'As a fraction of the whole', value: `${fmtNum(p / 100, 8)}`, hint: 'decimal multiplier' },
        { label: 'Remaining after taking it out', value: fmtNum(v - result, 10), hint: `${fmtNum(100 - p)}% of ${fmtNum(v)}` },
        { label: 'Number plus this percent', value: fmtNum(v + result, 10), hint: `${fmtNum(v)} × ${fmtNum(1 + p / 100, 8)}` },
      ],
    }
  }, [ofPercent, ofValue])

  const isWhatResult = useMemo<Outcome | { error: string } | null>(() => {
    const pair = bothNumbers(partValue, wholeValue)
    if (!pair) return null
    const [part, whole] = pair
    if (whole === 0) return { error: 'The second number is 0, so there is nothing to compare against. A percentage of zero is undefined.' }
    const pct = (part / whole) * 100
    return {
      answer: `${fmtGrouped(pct, 8)}%`,
      sub: `${fmtNum(part)} out of ${fmtNum(whole)}`,
      steps: [
        {
          label: 'Divide the part by the whole to get the fraction.',
          expr: `${fmtNum(part)} ÷ ${fmtNum(whole)} = ${fmtNum(part / whole, 12)}`,
        },
        {
          label: 'Multiply by 100 to turn the fraction into a percentage.',
          expr: `${fmtNum(part / whole, 12)} × 100 = ${fmtNum(pct, 10)}%`,
        },
        {
          label: 'Answer.',
          expr: `${fmtNum(part)} is ${fmtNum(pct, 8)}% of ${fmtNum(whole)}`,
        },
      ],
      tiles: [
        { label: 'As a decimal', value: fmtNum(part / whole, 10) },
        { label: 'Missing share', value: `${fmtNum(100 - pct, 8)}%`, hint: `${fmtNum(whole - part)} of ${fmtNum(whole)}` },
        { label: 'Per 1,000', value: fmtNum((part / whole) * 1000, 6), hint: 'permille (‰)' },
      ],
    }
  }, [partValue, wholeValue])

  const changeResult = useMemo<Outcome | { error: string } | null>(() => {
    const pair = bothNumbers(fromValue, toValue)
    if (!pair) return null
    const [from, to] = pair
    if (from === 0) return { error: 'Percentage change from 0 is undefined: there is no starting amount to compare with.' }
    const diff = to - from
    const pct = (diff / Math.abs(from)) * 100
    const rising = diff > 0
    const label = diff === 0 ? 'No change' : rising ? 'Increase' : 'Decrease'
    const avg = (Math.abs(from) + Math.abs(to)) / 2
    const pctDifference = avg === 0 ? NaN : (Math.abs(diff) / avg) * 100
    return {
      answer: `${diff === 0 ? '' : rising ? '+' : '−'}${fmtGrouped(Math.abs(pct), 8)}%`,
      sub: `${label} from ${fmtNum(from)} to ${fmtNum(to)}`,
      steps: [
        {
          label: 'Find the absolute change: new value minus old value.',
          expr: `${fmtNum(to)} − ${fmtNum(from)} = ${fmtNum(diff, 10)}`,
        },
        {
          label: 'Divide the change by the original value.',
          expr: `${fmtNum(diff, 10)} ÷ ${fmtNum(Math.abs(from))} = ${fmtNum(diff / Math.abs(from), 12)}`,
          note: from < 0 ? 'The starting value is negative, so its magnitude is used as the base, as is usual.' : undefined,
        },
        {
          label: 'Multiply by 100 to express it as a percentage.',
          expr: `${fmtNum(diff / Math.abs(from), 12)} × 100 = ${fmtNum(pct, 10)}%`,
        },
        {
          label: `Answer: a ${label.toLowerCase()}.`,
          expr: `${fmtNum(from)} → ${fmtNum(to)} is a ${fmtNum(Math.abs(pct), 8)}% ${rising ? 'increase' : diff === 0 ? 'change' : 'decrease'}`,
        },
      ],
      tiles: [
        { label: 'Absolute change', value: fmtNum(diff, 10) },
        { label: 'Multiplier', value: `× ${fmtNum(to / from, 8)}`, hint: 'new ÷ old' },
        {
          label: 'Percentage difference',
          value: Number.isFinite(pctDifference) ? `${fmtNum(pctDifference, 6)}%` : '–',
          hint: 'change ÷ average of both values',
        },
      ],
    }
  }, [fromValue, toValue])

  const adjustResult = useMemo<Outcome | { error: string } | null>(() => {
    const pair = bothNumbers(baseValue, adjustPercent)
    if (!pair) return null
    const [base, pct] = pair
    const signed = direction === 'plus' ? pct : -pct
    const delta = (signed / 100) * base
    const result = base + delta
    const verb = direction === 'plus' ? 'plus' : 'minus'
    return {
      answer: fmtGrouped(result, 10),
      sub: `${fmtNum(base)} ${verb} ${fmtNum(pct)}%`,
      steps: [
        {
          label: `Work out ${fmtNum(pct)}% of the starting number.`,
          expr: `${fmtNum(pct)} ÷ 100 × ${fmtNum(base)} = ${fmtNum(Math.abs(delta), 10)}`,
        },
        {
          label: direction === 'plus' ? 'Add it to the starting number.' : 'Subtract it from the starting number.',
          expr: `${fmtNum(base)} ${direction === 'plus' ? '+' : '−'} ${fmtNum(Math.abs(delta), 10)} = ${fmtNum(result, 10)}`,
        },
        {
          label: 'Shortcut: multiply once by the combined factor.',
          expr: `${fmtNum(base)} × ${fmtNum(1 + signed / 100, 8)} = ${fmtNum(result, 10)}`,
          note: 'Chaining several percentage changes multiplies these factors together, which is why they never simply add up.',
        },
      ],
      tiles: [
        { label: 'Change applied', value: `${signed >= 0 ? '+' : '−'}${fmtNum(Math.abs(delta), 10)}` },
        { label: 'Combined factor', value: `× ${fmtNum(1 + signed / 100, 8)}` },
        {
          label: 'Reverse it',
          value: 1 + signed / 100 === 0 ? '–' : fmtNum(result / (1 + signed / 100), 10),
          hint: 'divide back by the factor to recover the original',
        },
      ],
    }
  }, [baseValue, adjustPercent, direction])

  const reset = () => {
    setOfPercent('')
    setOfValue('')
    setPartValue('')
    setWholeValue('')
    setFromValue('')
    setToValue('')
    setBaseValue('')
    setAdjustPercent('')
  }

  return (
    <div className="space-y-5">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:grid-cols-4">
          <TabsTrigger value="of" className="text-xs sm:text-sm">
            X% of Y
          </TabsTrigger>
          <TabsTrigger value="is-what" className="text-xs sm:text-sm">
            X is what % of Y
          </TabsTrigger>
          <TabsTrigger value="change" className="text-xs sm:text-sm">
            % increase / decrease
          </TabsTrigger>
          <TabsTrigger value="adjust" className="text-xs sm:text-sm">
            X plus / minus Y%
          </TabsTrigger>
        </TabsList>

        <TabsContent value="of" className="mt-4">
          <ToolPanel title="What is X% of Y?" description="The everyday case: a tip, a tax line, a share of a total.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Percentage (X)" value={ofPercent} onChange={setOfPercent} placeholder="15" suffix="%" />
              <Field label="Of this number (Y)" value={ofValue} onChange={setOfValue} placeholder="240" />
            </div>
          </ToolPanel>
          <Result outcome={ofResult} formula="result = (X ÷ 100) × Y" />
        </TabsContent>

        <TabsContent value="is-what" className="mt-4">
          <ToolPanel title="X is what percent of Y?" description="Turn a part and a whole into a percentage: scores, shares, conversion rates.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Part (X)" value={partValue} onChange={setPartValue} placeholder="36" />
              <Field label="Whole (Y)" value={wholeValue} onChange={setWholeValue} placeholder="240" />
            </div>
          </ToolPanel>
          <Result outcome={isWhatResult} formula="percent = (X ÷ Y) × 100" />
        </TabsContent>

        <TabsContent value="change" className="mt-4">
          <ToolPanel title="Percentage increase or decrease" description="Compare a new value against the value it started from.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Original value (from)" value={fromValue} onChange={setFromValue} placeholder="80" />
              <Field label="New value (to)" value={toValue} onChange={setToValue} placeholder="100" />
            </div>
          </ToolPanel>
          <Result outcome={changeResult} formula="change % = (new − old) ÷ |old| × 100" />
        </TabsContent>

        <TabsContent value="adjust" className="mt-4">
          <ToolPanel title="Add or subtract a percentage" description="Mark a price up, take a discount off, add sales tax.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starting number (X)" value={baseValue} onChange={setBaseValue} placeholder="250" />
              <Field label="Percentage (Y)" value={adjustPercent} onChange={setAdjustPercent} placeholder="20" suffix="%" />
            </div>
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-medium text-foreground">Direction</legend>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={direction === 'plus' ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={direction === 'plus'}
                  onClick={() => setDirection('plus')}
                >
                  Add the percentage
                </Button>
                <Button
                  type="button"
                  variant={direction === 'minus' ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={direction === 'minus'}
                  onClick={() => setDirection('minus')}
                >
                  Subtract the percentage
                </Button>
              </div>
            </fieldset>
          </ToolPanel>
          <Result outcome={adjustResult} formula="result = X × (1 ± Y ÷ 100)" />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          Clear all fields
        </Button>
      </div>
    </div>
  )
}

function Result({ outcome, formula }: { outcome: Outcome | { error: string } | null; formula: string }) {
  if (!outcome) {
    return (
      <p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
        Fill in both boxes to see the answer and the working. Formula: <code className="font-mono">{formula}</code>
      </p>
    )
  }
  if ('error' in outcome) {
    return (
      <div className="mt-4">
        <ErrorNote message={outcome.error} />
      </div>
    )
  }
  return (
    <div className="mt-4 space-y-4" role="status" aria-live="polite">
      <AnswerBanner label="Answer" value={outcome.answer} sub={outcome.sub} />
      <StatGrid>
        {outcome.tiles.map((t) => (
          <StatTile key={t.label} label={t.label} value={t.value} hint={t.hint} tone="muted" />
        ))}
      </StatGrid>
      <StepList steps={outcome.steps} />
      <p className="text-xs text-muted-foreground">
        Formula used: <code className="font-mono text-foreground">{formula}</code>
      </p>
    </div>
  )
}
