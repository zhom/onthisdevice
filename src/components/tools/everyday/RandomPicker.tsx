import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, Shuffle, Sparkles } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/components/tools/finance/format'
import {
  EmptyState,
  Note,
  NumField,
  ScrollTable,
  Segmented,
  StatGrid,
  num,
  randomInt,
  shuffled,
  summaryLines,
} from './common'

interface Entry {
  label: string
  weight: number
}

const SAMPLE = `Ada Lovelace
Grace Hopper
Katherine Johnson
Alan Turing
Barbara Liskov
Donald Knuth
Radia Perlman
Tim Berners-Lee`

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Uniform float in [0, 1) from crypto entropy. */
function randomFloat(): number {
  const buf = new Uint32Array(2)
  crypto.getRandomValues(buf)
  return (buf[0] * 2 ** 21 + (buf[1] >>> 11)) / 2 ** 53
}

/** Sample `count` distinct entries with probability proportional to weight. */
function weightedSample(entries: Entry[], count: number): Entry[] {
  const pool = entries.slice()
  const picked: Entry[] = []
  let total = pool.reduce((a, e) => a + e.weight, 0)
  while (picked.length < count && pool.length > 0 && total > 0) {
    let target = randomFloat() * total
    let index = pool.length - 1
    for (let i = 0; i < pool.length; i++) {
      target -= pool[i].weight
      if (target <= 0) {
        index = i
        break
      }
    }
    const [chosen] = pool.splice(index, 1)
    total -= chosen.weight
    picked.push(chosen)
  }
  // If every remaining weight is zero, fall back to uniform picks.
  while (picked.length < count && pool.length > 0) {
    const [chosen] = pool.splice(randomInt(pool.length), 1)
    picked.push(chosen)
  }
  return picked
}

export default function RandomPicker() {
  const [text, setText] = useState(SAMPLE)
  const [mode, setMode] = useState<'pick' | 'shuffle'>('pick')
  const [howMany, setHowMany] = useState('1')
  const [useWeights, setUseWeights] = useState(false)
  const [dedupe, setDedupe] = useState(true)
  const [winners, setWinners] = useState<Entry[] | null>(null)
  const [order, setOrder] = useState<Entry[] | null>(null)
  const [revealed, setRevealed] = useState(0)
  const [spin, setSpin] = useState('')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const list = timers.current
    return () => list.forEach(clearTimeout)
  }, [])

  const entries = useMemo<Entry[]>(() => {
    const seen = new Set<string>()
    const out: Entry[] = []
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (line === '') continue
      let label = line
      let weight = 1
      if (useWeights) {
        const parts = line.split('|')
        if (parts.length > 1) {
          const parsedWeight = Number(parts[parts.length - 1].trim())
          if (Number.isFinite(parsedWeight) && parsedWeight >= 0) {
            weight = parsedWeight
            label = parts.slice(0, -1).join('|').trim()
          }
        }
      }
      if (label === '') continue
      const key = label.toLowerCase()
      if (dedupe && seen.has(key)) continue
      seen.add(key)
      out.push({ label, weight })
    }
    return out
  }, [dedupe, text, useWeights])

  const totalWeight = entries.reduce((a, e) => a + e.weight, 0)
  const requested = Math.max(1, Math.round(num(howMany, 1)))
  const pickCount = Math.min(requested, entries.length)

  const startReveal = useCallback((list: Entry[], pool: Entry[]) => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (prefersReducedMotion() || list.length > 12) {
      setRevealed(list.length)
      setSpin('')
      return
    }
    setRevealed(0)
    setSpin('')
    let step = 0
    const advance = () => {
      let ticks = 0
      const cycle = () => {
        ticks++
        setSpin(pool.length > 0 ? pool[randomInt(pool.length)].label : '')
        if (ticks < 6) {
          timers.current.push(setTimeout(cycle, 60))
        } else {
          step++
          setSpin('')
          setRevealed(step)
          if (step < list.length) timers.current.push(setTimeout(advance, 220))
        }
      }
      cycle()
    }
    advance()
  }, [])

  const pick = useCallback(() => {
    if (entries.length === 0) return
    const chosen = useWeights ? weightedSample(entries, pickCount) : shuffled(entries).slice(0, pickCount)
    setOrder(null)
    setWinners(chosen)
    startReveal(chosen, entries)
  }, [entries, pickCount, startReveal, useWeights])

  const shuffle = useCallback(() => {
    if (entries.length === 0) return
    setWinners(null)
    setOrder(shuffled(entries))
    setRevealed(entries.length)
  }, [entries])

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setWinners(null)
    setOrder(null)
    setRevealed(0)
    setSpin('')
  }, [])

  const summary = winners
    ? summaryLines([
        `Picked ${winners.length} of ${entries.length}`,
        ...winners.map((w, i) => `${i + 1}. ${w.label}`),
      ])
    : order
      ? summaryLines(['Shuffled order:', ...order.map((o, i) => `${i + 1}. ${o.label}`)])
      : ''

  return (
    <div className="space-y-6">
      <ToolPanel
        title="Your list"
        description="One entry per line. Paste from a spreadsheet, a chat thread or a sign-up sheet."
        footer={
          <>
            <Button
              type="button"
              onClick={mode === 'pick' ? pick : shuffle}
              disabled={entries.length === 0}
              className="gap-2"
            >
              {mode === 'pick' ? (
                <>
                  <Sparkles className="size-4" aria-hidden="true" />
                  Pick {pickCount === 1 ? 'a winner' : `${pickCount} winners`}
                </>
              ) : (
                <>
                  <Shuffle className="size-4" aria-hidden="true" />
                  Shuffle the list
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="gap-2"
              onClick={reset}
              disabled={!winners && !order}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Clear result
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="picker-list">Entries</Label>
          <Textarea
            id="picker-list"
            value={text}
            rows={8}
            spellCheck={false}
            placeholder={'Alice\nBob\nCharlie'}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            {entries.length === 0
              ? 'No usable entries yet.'
              : `${formatNumber(entries.length, 0)} entr${entries.length === 1 ? 'y' : 'ies'} ready${useWeights ? `, total weight ${formatNumber(totalWeight, 2)}` : ''}.`}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">What do you want to do?</span>
            <Segmented
              label="Mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'pick', label: 'Pick winners' },
                { value: 'shuffle', label: 'Shuffle' },
              ]}
            />
          </div>
          {mode === 'pick' && (
            <NumField
              label="How many winners"
              value={howMany}
              onChange={setHowMany}
              hint={
                requested > entries.length && entries.length > 0
                  ? `Only ${entries.length} entries available, so ${entries.length} will be drawn.`
                  : 'Winners are always distinct. Nobody is drawn twice.'
              }
            />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
            <div className="min-w-0">
              <Label htmlFor="picker-dedupe" className="text-sm font-medium">
                Ignore duplicate lines
              </Label>
              <p className="mt-1 text-xs text-pretty text-muted-foreground">
                Case-insensitive. Turn it off to let repeat entries improve someone's odds.
              </p>
            </div>
            <Switch
              id="picker-dedupe"
              checked={dedupe}
              onCheckedChange={setDedupe}
              aria-label="Ignore duplicate lines"
            />
          </div>
          <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
            <div className="min-w-0">
              <Label htmlFor="picker-weights" className="text-sm font-medium">
                Use weights
              </Label>
              <p className="mt-1 text-xs text-pretty text-muted-foreground">
                Write <code className="font-mono">Name | 3</code> to give that line three times the
                chance.
              </p>
            </div>
            <Switch
              id="picker-weights"
              checked={useWeights}
              onCheckedChange={setUseWeights}
              aria-label="Use weights"
            />
          </div>
        </div>

        <Note>
          Draws use <code className="font-mono">crypto.getRandomValues</code>, the browser's
          cryptographic random source, with a Fisher–Yates shuffle. It uses no seed and no clock. The list stays on your device, so
          only you can see the entrants.
        </Note>
      </ToolPanel>

      <ToolPanel
        title={mode === 'pick' ? 'Winners' : 'Shuffled order'}
        footer={summary ? <CopyButton value={summary} label="Copy the result" /> : undefined}
      >
        {winners ? (
          <div className="space-y-3">
            <ul className="space-y-2">
              {winners.map((w, i) => {
                const shown = i < revealed
                return (
                  <li
                    key={`${w.label}-${i}`}
                    className={cn(
                      'flex items-center gap-3 rounded-lg p-4 transition-colors',
                      shown ? 'bg-background' : 'bg-muted',
                    )}
                  >
                    <span className="grid size-8 shrink-0 place-items-center text-sm font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-lg font-semibold',
                        shown ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {shown ? w.label : i === revealed ? spin || '…' : '…'}
                    </span>
                    {useWeights && shown && (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        weight {formatNumber(w.weight, 2)}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {revealed >= winners.length
                ? `Drawn ${winners.length} winner${winners.length === 1 ? '' : 's'} from ${entries.length} entries.`
                : 'Drawing…'}
            </p>
            <StatGrid cols={3}>
              <ResultStat label="Entries" value={formatNumber(entries.length, 0)} />
              <ResultStat label="Winners drawn" value={formatNumber(winners.length, 0)} />
              <ResultStat
                label="Chance per entry"
                value={
                  useWeights
                    ? 'Varies by weight'
                    : `${formatNumber((winners.length / entries.length) * 100, 2)}%`
                }
              />
            </StatGrid>
          </div>
        ) : order ? (
          <ScrollTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Entry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.map((o, i) => (
                  <TableRow key={`${o.label}-${i}`}>
                    <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{o.label}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollTable>
        ) : (
          <EmptyState
            message={
              mode === 'pick'
                ? 'Paste your list above, then press Pick to draw the winners.'
                : 'Paste your list above, then press Shuffle to randomise the order.'
            }
          />
        )}
      </ToolPanel>

      {useWeights && entries.length > 0 && (
        <ToolPanel title="Odds by entry" description="Chance of being drawn first, given the weights you set.">
          <ScrollTable className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Chance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e, i) => (
                  <TableRow key={`${e.label}-${i}`}>
                    <TableCell className="font-medium">{e.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(e.weight, 2)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {totalWeight > 0 ? `${formatNumber((e.weight / totalWeight) * 100, 2)}%` : '–'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollTable>
        </ToolPanel>
      )}
    </div>
  )
}
