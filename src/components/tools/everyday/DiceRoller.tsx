import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dices, RotateCcw } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/components/tools/finance/format'
import { EmptyState, Note, NumField, StatGrid, num, randomInt, randomInts, summaryLines } from './common'

interface DiceTerm {
  kind: 'dice'
  sign: 1 | -1
  count: number
  sides: number
  keep?: { mode: 'kh' | 'kl'; n: number }
}

interface ConstTerm {
  kind: 'const'
  sign: 1 | -1
  value: number
}

type Term = DiceTerm | ConstTerm

interface ParseOk {
  ok: true
  terms: Term[]
}
interface ParseFail {
  ok: false
  message: string
}
type Parsed = ParseOk | ParseFail

const MAX_DICE = 500
const MAX_SIDES = 1000
const MAX_TERMS = 12

export function parseNotation(input: string): Parsed {
  const text = input.replace(/\s+/g, '').toLowerCase()
  if (text === '') return { ok: false, message: 'Type some dice notation, for example 3d6+2.' }

  const pattern = /([+-])?(?:(\d*)d(\d+)(kh|kl)?(\d+)?|(\d+))/g
  const terms: Term[] = []
  let consumed = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index !== consumed) break
    consumed = pattern.lastIndex
    const sign: 1 | -1 = match[1] === '-' ? -1 : 1

    if (match[6] !== undefined) {
      terms.push({ kind: 'const', sign, value: Number(match[6]) })
      continue
    }

    const count = match[2] === '' || match[2] === undefined ? 1 : Number(match[2])
    const sides = Number(match[3])
    const keepMode = match[4] as 'kh' | 'kl' | undefined
    const keepN = match[5] === undefined ? 1 : Number(match[5])

    if (count < 1) return { ok: false, message: 'You need at least one die in each term.' }
    if (count > MAX_DICE) return { ok: false, message: `${count} dice in one term is too many. The limit is ${MAX_DICE}.` }
    if (sides < 2) return { ok: false, message: 'A die needs at least 2 sides.' }
    if (sides > MAX_SIDES) return { ok: false, message: `A ${sides}-sided die is beyond the ${MAX_SIDES}-side limit.` }
    if (keepMode && (keepN < 1 || keepN > count)) {
      return { ok: false, message: `You cannot keep ${keepN} of ${count} dice. Pick a number between 1 and ${count}.` }
    }

    terms.push({ kind: 'dice', sign, count, sides, keep: keepMode ? { mode: keepMode, n: keepN } : undefined })
  }

  if (consumed !== text.length) {
    return {
      ok: false,
      message: `I could not read “${input.trim()}”. Use the form 3d6+2, or 4d6kh3 to keep the highest three.`,
    }
  }
  if (terms.length === 0) return { ok: false, message: 'Type some dice notation, for example 3d6+2.' }
  if (terms.length > MAX_TERMS) return { ok: false, message: `That is more than ${MAX_TERMS} terms. Simplify the expression.` }
  if (!terms.some((t) => t.kind === 'dice')) return { ok: false, message: 'That expression has no dice in it.' }

  return { ok: true, terms }
}

interface TermRoll {
  term: DiceTerm
  values: number[]
  kept: boolean[]
  subtotal: number
}

interface RollResult {
  id: number
  notation: string
  total: number
  dice: TermRoll[]
  constant: number
}

function rollTerms(terms: Term[], notation: string, id: number): RollResult {
  let total = 0
  let constant = 0
  const dice: TermRoll[] = []

  for (const term of terms) {
    if (term.kind === 'const') {
      constant += term.sign * term.value
      total += term.sign * term.value
      continue
    }
    const raw = randomInts(term.count, term.sides)
    const values = Array.from(raw, (v) => v + 1)
    const kept = values.map(() => true)
    if (term.keep) {
      const order = values
        .map((v, i) => ({ v, i }))
        .sort((a, b) => (term.keep?.mode === 'kh' ? b.v - a.v : a.v - b.v))
      for (let i = term.keep.n; i < order.length; i++) kept[order[i].i] = false
    }
    const subtotal = values.reduce((a, v, i) => (kept[i] ? a + v : a), 0) * term.sign
    total += subtotal
    dice.push({ term, values, kept, subtotal })
  }

  return { id, notation, total, dice, constant }
}

function theoretical(terms: Term[]): { min: number; max: number; mean: number | null } {
  let min = 0
  let max = 0
  let mean: number | null = 0
  for (const term of terms) {
    if (term.kind === 'const') {
      min += term.sign * term.value
      max += term.sign * term.value
      if (mean !== null) mean += term.sign * term.value
      continue
    }
    const kept = term.keep ? term.keep.n : term.count
    const lo = kept * 1
    const hi = kept * term.sides
    min += term.sign === 1 ? lo : -hi
    max += term.sign === 1 ? hi : -lo
    if (term.keep) mean = null
    else if (mean !== null) mean += term.sign * term.count * ((term.sides + 1) / 2)
  }
  return { min, max, mean }
}

const PRESETS = ['1d4', '1d6', '2d6', '3d6', '1d8', '1d10', '1d12', '1d20', '4d6kh3', '2d20kh1', '2d20kl1', '1d100']

const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function DiceRoller() {
  const [notation, setNotation] = useState('3d6+2')
  const [times, setTimes] = useState('1')
  const [current, setCurrent] = useState<RollResult | null>(null)
  const [batch, setBatch] = useState<number[] | null>(null)
  const [history, setHistory] = useState<RollResult[]>([])
  const [rolling, setRolling] = useState(false)
  const [tumble, setTumble] = useState<number[]>([])
  const idRef = useRef(1)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const parsed = useMemo(() => parseNotation(notation), [notation])
  const stats = useMemo(() => (parsed.ok ? theoretical(parsed.terms) : null), [parsed])

  useEffect(() => {
    const list = timers.current
    return () => {
      list.forEach(clearTimeout)
    }
  }, [])

  const roll = useCallback(() => {
    if (!parsed.ok) return
    const repeat = Math.max(1, Math.min(1000, Math.round(num(times, 1))))

    if (repeat > 1) {
      const totals: number[] = []
      for (let i = 0; i < repeat; i++) {
        totals.push(rollTerms(parsed.terms, notation, 0).total)
      }
      setBatch(totals)
      const last = rollTerms(parsed.terms, notation, idRef.current++)
      setCurrent(last)
      setHistory((prev) => [last, ...prev].slice(0, 40))
      return
    }

    setBatch(null)
    const result = rollTerms(parsed.terms, notation, idRef.current++)
    const diceCount = result.dice.reduce((a, d) => a + d.values.length, 0)

    if (prefersReducedMotion() || diceCount > 40) {
      setCurrent(result)
      setHistory((prev) => [result, ...prev].slice(0, 40))
      return
    }

    setRolling(true)
    const sides = result.dice[0]?.term.sides ?? 6
    let frames = 0
    const tick = () => {
      frames++
      setTumble(Array.from({ length: Math.min(diceCount, 12) }, () => randomInt(sides) + 1))
      if (frames < 8) {
        timers.current.push(setTimeout(tick, 55))
      } else {
        setRolling(false)
        setTumble([])
        setCurrent(result)
        setHistory((prev) => [result, ...prev].slice(0, 40))
      }
    }
    tick()
  }, [notation, parsed, times])

  const distribution = useMemo(() => {
    const source = batch ?? history.map((h) => h.total)
    if (source.length < 2) return null
    const counts = new Map<number, number>()
    for (const total of source) counts.set(total, (counts.get(total) ?? 0) + 1)
    const keys = [...counts.keys()].sort((a, b) => a - b)
    const maxCount = Math.max(...counts.values())
    const sum = source.reduce((a, b) => a + b, 0)
    const mean = sum / source.length
    const variance = source.reduce((a, b) => a + (b - mean) ** 2, 0) / source.length
    return {
      rows: keys.map((k) => ({ total: k, count: counts.get(k) ?? 0, share: (counts.get(k) ?? 0) / source.length })),
      maxCount,
      n: source.length,
      mean,
      sd: Math.sqrt(variance),
      min: Math.min(...source),
      max: Math.max(...source),
    }
  }, [batch, history])

  const summary = current
    ? summaryLines([
        `${current.notation} = ${current.total}`,
        ...current.dice.map(
          (d) =>
            `  ${d.term.sign === -1 ? '−' : ''}${d.term.count}d${d.term.sides}${d.term.keep ? `${d.term.keep.mode}${d.term.keep.n}` : ''}: [${d.values
              .map((v, i) => (d.kept[i] ? String(v) : `(${v})`))
              .join(', ')}] = ${d.subtotal}`,
        ),
        current.constant !== 0 ? `  modifier: ${current.constant > 0 ? '+' : ''}${current.constant}` : null,
      ])
    : ''

  return (
    <div className="space-y-6">
      <ToolPanel
        title="Dice notation"
        description="NdX with modifiers: 3d6+2, 1d20-1, or 4d6kh3 to keep the highest three."
        footer={
          <>
            <Button type="button" onClick={roll} disabled={!parsed.ok || rolling} className="gap-2">
              <Dices className="size-4" aria-hidden="true" />
              {rolling ? 'Rolling…' : 'Roll'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="gap-2"
              onClick={() => {
                setHistory([])
                setBatch(null)
                setCurrent(null)
              }}
              disabled={history.length === 0}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Clear history
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div className="space-y-1.5">
            <Label htmlFor="dice-notation">Notation</Label>
            <Input
              id="dice-notation"
              value={notation}
              autoComplete="off"
              spellCheck={false}
              placeholder="3d6+2"
              onChange={(e) => setNotation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  roll()
                }
              }}
              aria-invalid={!parsed.ok || undefined}
              aria-describedby="dice-notation-status"
              className="font-mono text-lg"
            />
          </div>
          <NumField label="Roll it × times" value={times} onChange={setTimes} />
        </div>

        <p id="dice-notation-status" role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {parsed.ok && stats
            ? `Valid. Range ${stats.min} to ${stats.max}${stats.mean !== null ? `, average ${formatNumber(stats.mean, 2)}` : ''}.`
            : !parsed.ok
              ? parsed.message
              : ''}
        </p>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Common dice presets">
          {PRESETS.map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={p === notation ? 'default' : 'outline'}
              className="font-mono"
              onClick={() => setNotation(p)}
            >
              {p}
            </Button>
          ))}
        </div>

        <Note>
          Every die uses <code className="font-mono">crypto.getRandomValues</code> with rejection
          sampling, so all faces are exactly equally likely. There is no modulo bias, and nothing comes from
          the clock.
        </Note>
      </ToolPanel>

      <ToolPanel
        title="Result"
        footer={current && !rolling ? <CopyButton value={summary} label="Copy the roll" /> : undefined}
      >
        {rolling ? (
          <div role="status" aria-live="polite" className="space-y-4">
            <div className="rounded-lg bg-muted p-8 text-center">
              <p className="text-sm text-muted-foreground">Rolling…</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {tumble.map((v, i) => (
                  <span
                    key={i}
                    className="grid size-11 animate-pulse place-items-center rounded-lg bg-background font-mono text-lg font-semibold tabular-nums"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : !current ? (
          <EmptyState message="Press Roll (or Enter in the notation box) to throw the dice." />
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-6 text-center">
              <p className="text-xs font-medium text-muted-foreground">
                {current.notation}
              </p>
              <p className="mt-2 text-5xl font-bold tabular-nums text-primary sm:text-6xl">
                {current.total}
              </p>
            </div>

            {current.dice.map((d, i) => (
              <div key={i} className="rounded-lg bg-muted p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-medium text-foreground">
                    {d.term.sign === -1 ? '−' : ''}
                    {d.term.count}d{d.term.sides}
                    {d.term.keep ? `${d.term.keep.mode}${d.term.keep.n}` : ''}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    subtotal {d.subtotal}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.values.map((v, j) => (
                    <span
                      key={j}
                      title={d.kept[j] ? undefined : 'dropped'}
                      className={cn(
                        'grid min-w-9 place-items-center rounded-md px-2 py-1.5 font-mono text-sm font-semibold tabular-nums',
                        d.kept[j]
                          ? 'bg-background text-foreground'
                          : 'bg-muted text-muted-foreground line-through',
                      )}
                    >
                      {d.term.sides === 6 ? `${DIE_FACES[v - 1]} ${v}` : v}
                    </span>
                  ))}
                </div>
                {d.term.keep && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Keeping the {d.term.keep.mode === 'kh' ? 'highest' : 'lowest'} {d.term.keep.n};
                    struck-through dice are dropped.
                  </p>
                )}
              </div>
            ))}

            {current.constant !== 0 && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                Modifier:{' '}
                <span className="font-mono font-semibold tabular-nums">
                  {current.constant > 0 ? '+' : ''}
                  {current.constant}
                </span>
              </div>
            )}

            {stats && (
              <StatGrid cols={3}>
                <ResultStat label="Lowest possible" value={String(stats.min)} />
                <ResultStat
                  label="Average roll"
                  value={stats.mean === null ? '–' : formatNumber(stats.mean, 2)}
                  hint={stats.mean === null ? 'Keep/drop dice have no simple closed form' : 'Expected value'}
                />
                <ResultStat label="Highest possible" value={String(stats.max)} />
              </StatGrid>
            )}
          </div>
        )}
      </ToolPanel>

      {distribution && (
        <ToolPanel
          title="Outcome distribution"
          description={
            batch
              ? `${distribution.n} rolls in this batch.`
              : `${distribution.n} rolls in this session's history.`
          }
        >
          <StatGrid cols={3}>
            <ResultStat label="Mean" value={formatNumber(distribution.mean, 2)} />
            <ResultStat label="Standard deviation" value={formatNumber(distribution.sd, 2)} />
            <ResultStat label="Range seen" value={`${distribution.min}–${distribution.max}`} />
          </StatGrid>
          <ul className="space-y-1">
            {distribution.rows.map((row) => (
              <li key={row.total} className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {row.total}
                </span>
                <span className="h-4 flex-1 overflow-hidden rounded-sm bg-muted">
                  <span
                    className="block h-full rounded-sm bg-chart-1"
                    style={{ width: `${(row.count / distribution.maxCount) * 100}%` }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {row.count} ({formatNumber(row.share * 100, 1)}%)
                </span>
              </li>
            ))}
          </ul>
        </ToolPanel>
      )}

      {history.length > 0 && (
        <ToolPanel title="Roll history" description="Newest first. The last 40 rolls stay on this page only.">
          <ul className="divide-y divide-border rounded-lg">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="font-mono text-sm text-muted-foreground">{h.notation}</span>
                <span className="font-mono text-sm tabular-nums text-foreground">
                  [
                  {h.dice
                    .flatMap((d) => d.values.filter((_, i) => d.kept[i]))
                    .slice(0, 12)
                    .join(', ')}
                  ]
                </span>
                <span className="text-base font-semibold tabular-nums text-primary">{h.total}</span>
              </li>
            ))}
          </ul>
        </ToolPanel>
      )}
    </div>
  )
}
