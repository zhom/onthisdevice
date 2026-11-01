import { useMemo, useState } from 'react'
import { CircleAlert, Dices, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { clamp, downloadBlob, formatNumber } from '@/lib/utils'
import { Field, SegmentedField } from './GenUi'
import { randomBelow, randomInt, randomRange, uniqueInts } from './randomlib'

type Sort = 'none' | 'asc' | 'desc'
type NumberKind = 'integer' | 'decimal'

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: 'none', label: 'Draw order' },
  { value: 'asc', label: 'Low → high' },
  { value: 'desc', label: 'High → low' },
]

const KIND_OPTIONS: { value: NumberKind; label: string }[] = [
  { value: 'integer', label: 'Whole numbers' },
  { value: 'decimal', label: 'Decimals' },
]

const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100]

const MAX_COUNT = 10_000

function stats(values: number[]) {
  if (values.length === 0) return null
  const sum = values.reduce((total, value) => total + value, 0)
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  return {
    sum,
    mean: sum / values.length,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  }
}

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

function NumbersMode() {
  const [min, setMin] = useState(1)
  const [max, setMax] = useState(100)
  const [count, setCount] = useState(5)
  const [kind, setKind] = useState<NumberKind>('integer')
  const [decimals, setDecimals] = useState(2)
  const [unique, setUnique] = useState(false)
  const [sort, setSort] = useState<Sort>('none')
  const [results, setResults] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const span = Math.floor(max) - Math.ceil(min) + 1
  const impossible = kind === 'integer' && unique && count > span && span > 0

  const generate = () => {
    setError(null)
    try {
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new Error('Both the minimum and the maximum need to be numbers.')
      }
      if (max < min) throw new Error('The maximum must be greater than or equal to the minimum.')
      const safeCount = clamp(Math.round(count), 1, MAX_COUNT)

      let values: number[]
      if (kind === 'integer') {
        values = unique
          ? uniqueInts(min, max, safeCount)
          : Array.from({ length: safeCount }, () => randomInt(min, max))
      } else {
        const factor = 10 ** clamp(Math.round(decimals), 0, 10)
        const draw = () => Math.round(randomRange(min, max) * factor) / factor
        if (unique) {
          const seen = new Set<number>()
          const out: number[] = []
          let attempts = 0
          while (out.length < safeCount) {
            if (attempts++ > safeCount * 200) {
              throw new Error(
                'There are not enough distinct values at this precision. Widen the range or allow more decimal places.',
              )
            }
            const value = draw()
            if (seen.has(value)) continue
            seen.add(value)
            out.push(value)
          }
          values = out
        } else {
          values = Array.from({ length: safeCount }, draw)
        }
      }

      if (sort === 'asc') values.sort((a, b) => a - b)
      if (sort === 'desc') values.sort((a, b) => b - a)
      setResults(values)
    } catch (err) {
      setResults([])
      setError(err instanceof Error ? err.message : 'Those numbers could not be generated.')
    }
  }

  const summary = useMemo(() => stats(results), [results])
  const asLines = results.join('\n')
  const asCsv = results.join(', ')

  return (
    <div className="flex flex-col gap-6">
      <ToolPanel
        title="Range"
        footer={
          <>
            <Button type="button" className="gap-2" onClick={generate} disabled={impossible}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Generate
            </Button>
            {results.length > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setResults([])}>
                Clear
              </Button>
            ) : null}
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Minimum" htmlFor="rng-min">
            <Input
              id="rng-min"
              type="number"
              inputMode="decimal"
              value={String(min)}
              onChange={(event) => setMin(Number.parseFloat(event.target.value))}
              className="tabular-nums"
            />
          </Field>
          <Field label="Maximum" htmlFor="rng-max">
            <Input
              id="rng-max"
              type="number"
              inputMode="decimal"
              value={String(max)}
              onChange={(event) => setMax(Number.parseFloat(event.target.value))}
              className="tabular-nums"
            />
          </Field>
          <Field label="How many" htmlFor="rng-count" hint={`Up to ${formatNumber(MAX_COUNT, 0)}.`}>
            <Input
              id="rng-count"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_COUNT}
              value={String(count)}
              onChange={(event) => setCount(Number.parseInt(event.target.value, 10) || 1)}
              className="tabular-nums"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SegmentedField label="Number type" value={kind} options={KIND_OPTIONS} onChange={setKind} />
          {kind === 'decimal' ? (
            <Field label="Decimal places" htmlFor="rng-dec">
              <Input
                id="rng-dec"
                type="number"
                min={0}
                max={10}
                value={String(decimals)}
                onChange={(event) => setDecimals(Number.parseInt(event.target.value, 10) || 0)}
                className="tabular-nums"
              />
            </Field>
          ) : null}
          <SegmentedField label="Order" value={sort} options={SORT_OPTIONS} onChange={setSort} />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
          <div className="min-w-0">
            <Label htmlFor="rng-unique" className="text-sm">
              No repeats
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Draws without replacement, the way a raffle or a lottery does. Leave it off for dice
              rolls and simulations, where every draw must be independent.
            </p>
          </div>
          <Switch id="rng-unique" checked={unique} onCheckedChange={setUnique} />
        </div>

        {impossible ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Not enough numbers to go round</AlertTitle>
            <AlertDescription>
              {min} to {max} holds {span} whole numbers, so you cannot draw {count} different ones.
              Widen the range or ask for fewer.
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Could not generate</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </ToolPanel>

      {results.length > 0 ? (
        <ToolPanel
          title={`${results.length} number${results.length === 1 ? '' : 's'}`}
          footer={
            <>
              <CopyButton value={asLines} label="Copy one per line" />
              <CopyButton value={asCsv} label="Copy comma separated" />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadBlob(new Blob([`${asLines}\n`], { type: 'text/plain;charset=utf-8' }), 'random-numbers.txt')
                }
              >
                Download .txt
              </Button>
            </>
          }
        >
          <div
            role="status"
            aria-live="polite"
            className="max-h-72 overflow-auto rounded-lg bg-muted p-3"
          >
            <div className="flex flex-wrap gap-2">
              {results.map((value, index) => (
                <span
                  key={`${index}-${value}`}
                  className="rounded-md bg-card px-2.5 py-1 font-mono text-sm tabular-nums text-foreground"
                >
                  {value}
                </span>
              ))}
            </div>
          </div>

          {summary ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <ResultStat label="Sum" value={formatNumber(summary.sum, 4)} />
              <ResultStat label="Mean" value={formatNumber(summary.mean, 4)} />
              <ResultStat label="Median" value={formatNumber(summary.median, 4)} />
              <ResultStat label="Lowest" value={formatNumber(summary.min, 4)} />
              <ResultStat label="Highest" value={formatNumber(summary.max, 4)} />
            </div>
          ) : null}
        </ToolPanel>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dice                                                                */
/* ------------------------------------------------------------------ */

interface Roll {
  id: number
  dice: number[]
  sides: number
  modifier: number
  total: number
}

let rollId = 1

function DiceMode() {
  const [sides, setSides] = useState(6)
  const [quantity, setQuantity] = useState(2)
  const [modifier, setModifier] = useState(0)
  const [history, setHistory] = useState<Roll[]>([])

  const roll = () => {
    const n = clamp(Math.round(quantity), 1, 100)
    const dice = Array.from({ length: n }, () => 1 + randomBelow(Math.max(2, Math.round(sides))))
    const total = dice.reduce((sum, value) => sum + value, 0) + modifier
    setHistory((current) => [{ id: rollId++, dice, sides, modifier, total }, ...current].slice(0, 20))
  }

  const latest = history[0]
  const notation = `${clamp(Math.round(quantity), 1, 100)}d${Math.max(2, Math.round(sides))}${
    modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : String(modifier)
  }`

  return (
    <div className="flex flex-col gap-6">
      <ToolPanel
        title="Dice"
        description={`Rolling ${notation}. Every die is an independent draw from the browser's cryptographic generator, so the result is as fair as a physical die, and fairer than a cheap plastic one.`}
        footer={
          <>
            <Button type="button" className="gap-2" onClick={roll}>
              <Dices className="size-4" aria-hidden="true" />
              Roll {notation}
            </Button>
            {history.length > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setHistory([])}>
                Clear history
              </Button>
            ) : null}
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Number of dice" htmlFor="dice-qty">
            <Input
              id="dice-qty"
              type="number"
              min={1}
              max={100}
              value={String(quantity)}
              onChange={(event) => setQuantity(Number.parseInt(event.target.value, 10) || 1)}
              className="tabular-nums"
            />
          </Field>
          <Field label="Sides" htmlFor="dice-sides">
            <Select value={String(sides)} onValueChange={(value) => setSides(Number.parseInt(value, 10))}>
              <SelectTrigger id="dice-sides" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DICE_SIDES.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    d{value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Modifier" htmlFor="dice-mod" hint="Added to the total, as in 2d6+3.">
            <Input
              id="dice-mod"
              type="number"
              value={String(modifier)}
              onChange={(event) => setModifier(Number.parseInt(event.target.value, 10) || 0)}
              className="tabular-nums"
            />
          </Field>
        </div>

        {latest ? (
          <div role="status" aria-live="polite" className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {latest.dice.map((value, index) => (
                <span
                  key={index}
                  className="grid size-12 place-items-center rounded-lg bg-card text-lg font-semibold tabular-nums text-foreground"
                >
                  {value}
                </span>
              ))}
            </div>
            <ResultStat
              label={`Total for ${latest.dice.length}d${latest.sides}${
                latest.modifier ? (latest.modifier > 0 ? `+${latest.modifier}` : latest.modifier) : ''
              }`}
              value={latest.total}
              hint={
                latest.modifier
                  ? `${latest.dice.join(' + ')} = ${latest.total - latest.modifier}, ${
                      latest.modifier > 0 ? 'plus' : 'minus'
                    } ${Math.abs(latest.modifier)}`
                  : latest.dice.join(' + ')
              }
              emphasis
            />
          </div>
        ) : (
          <p className="rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
            No rolls yet.
          </p>
        )}
      </ToolPanel>

      {history.length > 1 ? (
        <ToolPanel title="Recent rolls">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border px-2 py-2 text-left font-semibold">Notation</th>
                  <th className="border-b border-border px-2 py-2 text-left font-semibold">Dice</th>
                  <th className="border-b border-border px-2 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="border-b border-border px-2 py-2 font-mono text-xs">
                      {item.dice.length}d{item.sides}
                      {item.modifier ? (item.modifier > 0 ? `+${item.modifier}` : item.modifier) : ''}
                    </td>
                    <td className="border-b border-border px-2 py-2 font-mono text-xs">{item.dice.join(', ')}</td>
                    <td className="border-b border-border px-2 py-2 text-right tabular-nums">{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ToolPanel>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Coin                                                                */
/* ------------------------------------------------------------------ */

function CoinMode() {
  const [flips, setFlips] = useState(1)
  const [results, setResults] = useState<boolean[]>([])

  const flip = () => {
    const n = clamp(Math.round(flips), 1, 1000)
    setResults(Array.from({ length: n }, () => randomBelow(2) === 0))
  }

  const heads = results.filter(Boolean).length
  const tails = results.length - heads

  const longestStreak = useMemo(() => {
    let best = 0
    let current = 0
    let previous: boolean | null = null
    for (const value of results) {
      current = value === previous ? current + 1 : 1
      previous = value
      if (current > best) best = current
    }
    return best
  }, [results])

  return (
    <div className="flex flex-col gap-6">
      <ToolPanel
        title="Coin flip"
        description="One bit from the cryptographic generator per flip. There is no hidden bias and no seed to guess."
        footer={
          <Button type="button" onClick={flip}>
            Flip {clamp(Math.round(flips), 1, 1000)} {flips === 1 ? 'coin' : 'coins'}
          </Button>
        }
      >
        <Field label="Number of flips" htmlFor="coin-count" hint="Up to 1,000 at a time.">
          <Input
            id="coin-count"
            type="number"
            min={1}
            max={1000}
            value={String(flips)}
            onChange={(event) => setFlips(Number.parseInt(event.target.value, 10) || 1)}
            className="max-w-32 tabular-nums"
          />
        </Field>

        {results.length > 0 ? (
          <div role="status" aria-live="polite" className="flex flex-col gap-4">
            {results.length === 1 ? (
              <ResultStat label="Result" value={results[0] ? 'Heads' : 'Tails'} emphasis />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ResultStat
                    label="Heads"
                    value={heads}
                    hint={`${((heads / results.length) * 100).toFixed(1)}%`}
                  />
                  <ResultStat
                    label="Tails"
                    value={tails}
                    hint={`${((tails / results.length) * 100).toFixed(1)}%`}
                  />
                  <ResultStat label="Longest run" value={longestStreak} hint="Consecutive identical flips" />
                </div>
                <div className="max-h-48 overflow-auto rounded-lg bg-muted p-3">
                  <p className="font-mono text-sm leading-relaxed break-all text-foreground">
                    {results.map((value) => (value ? 'H' : 'T')).join('')}
                  </p>
                </div>
                <CopyButton
                  value={results.map((value) => (value ? 'Heads' : 'Tails')).join('\n')}
                  label="Copy the sequence"
                  className="self-start"
                />
              </>
            )}
          </div>
        ) : (
          <p className="rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
            No flips yet.
          </p>
        )}
      </ToolPanel>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tool                                                                */
/* ------------------------------------------------------------------ */

export default function RandomNumberGenerator() {
  return (
    <Tabs defaultValue="numbers" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="numbers" className="flex-1">
          Numbers
        </TabsTrigger>
        <TabsTrigger value="dice" className="flex-1">
          Dice
        </TabsTrigger>
        <TabsTrigger value="coin" className="flex-1">
          Coin
        </TabsTrigger>
      </TabsList>
      <TabsContent value="numbers" className="mt-6">
        <NumbersMode />
      </TabsContent>
      <TabsContent value="dice" className="mt-6">
        <DiceMode />
      </TabsContent>
      <TabsContent value="coin" className="mt-6">
        <CoinMode />
      </TabsContent>
    </Tabs>
  )
}
