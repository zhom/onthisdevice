import { useCallback, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { Button } from '@/components/ui/button'
import { cn, nextFrame } from '@/lib/utils'
import { formatNumber } from '@/components/tools/finance/format'
import { EmptyState, Note, NumField, ScrollTable, StatGrid, num, randomInts, summaryLines } from './common'

const MAX_BATCH = 10000
const MAX_STORED = 100000
const CHUNK = 2000

const FLIP_CSS = `
@keyframes otd-coin-flip {
  0%   { transform: rotateX(0deg) translateY(0); }
  50%  { transform: rotateX(900deg) translateY(-28px); }
  100% { transform: rotateX(1800deg) translateY(0); }
}
.otd-coin-flipping { animation: otd-coin-flip 0.75s cubic-bezier(0.3, 0.8, 0.4, 1); }
@media (prefers-reduced-motion: reduce) {
  .otd-coin-flipping { animation: none; }
}
`

interface Series {
  points: string
  last: number
}

/** Cumulative heads-proportion polyline, sampled down to a drawable number of points. */
function buildSeries(flips: Uint8Array, length: number, width: number, height: number): Series | null {
  if (length < 2) return null
  const samples = Math.min(240, length)
  const coords: string[] = []
  let heads = 0
  let cursor = 0
  let last = 0
  for (let s = 1; s <= samples; s++) {
    const upto = Math.round((s / samples) * length)
    for (; cursor < upto; cursor++) heads += flips[cursor]
    const ratio = heads / upto
    last = ratio
    const x = ((s - 1) / (samples - 1)) * width
    const y = height - ratio * height
    coords.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return { points: coords.join(' '), last }
}

export default function CoinFlip() {
  const flipsRef = useRef(new Uint8Array(MAX_STORED))
  const lengthRef = useRef(0)
  const [count, setCount] = useState(0)
  const [heads, setHeads] = useState(0)
  const [recent, setRecent] = useState<number[]>([])
  const [face, setFace] = useState<'heads' | 'tails' | null>(null)
  const [animating, setAnimating] = useState(false)
  const [batchSize, setBatchSize] = useState('1000')
  const [progress, setProgress] = useState<number | null>(null)
  const [longest, setLongest] = useState({ side: 'heads' as 'heads' | 'tails', run: 0 })
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const record = useCallback((values: ArrayLike<number>, n: number) => {
    const store = flipsRef.current
    let index = lengthRef.current
    let added = 0
    for (let i = 0; i < n && index < MAX_STORED; i++, index++) {
      store[index] = values[i]
      added += values[i]
    }
    lengthRef.current = index
    setCount(index)
    setHeads((prev) => prev + added)
  }, [])

  const recomputeStreak = useCallback(() => {
    const store = flipsRef.current
    const total = lengthRef.current
    let bestRun = 0
    let bestSide: 'heads' | 'tails' = 'heads'
    let run = 0
    let side = -1
    for (let i = 0; i < total; i++) {
      if (store[i] === side) {
        run++
      } else {
        side = store[i]
        run = 1
      }
      if (run > bestRun) {
        bestRun = run
        bestSide = side === 1 ? 'heads' : 'tails'
      }
    }
    setLongest({ side: bestSide, run: bestRun })
  }, [])

  const flipOnce = useCallback(() => {
    const values = randomInts(1, 2)
    const isHeads = values[0] === 1
    setFace(isHeads ? 'heads' : 'tails')
    setAnimating(true)
    if (animTimer.current) clearTimeout(animTimer.current)
    animTimer.current = setTimeout(() => setAnimating(false), 760)
    record(values, 1)
    setRecent((prev) => [values[0], ...prev].slice(0, 60))
    recomputeStreak()
  }, [record, recomputeStreak])

  const flipBatch = useCallback(async () => {
    const requested = Math.max(1, Math.min(MAX_BATCH, Math.round(num(batchSize, 1))))
    setProgress(0)
    let done = 0
    let lastValue = 0
    const collected: number[] = []
    while (done < requested) {
      const size = Math.min(CHUNK, requested - done)
      const values = randomInts(size, 2)
      record(values, size)
      for (let i = 0; i < size && collected.length < 60; i++) collected.push(values[i])
      lastValue = values[size - 1]
      done += size
      setProgress((done / requested) * 100)
      await nextFrame()
    }
    setRecent(collected.slice(0, 60).reverse())
    setFace(lastValue === 1 ? 'heads' : 'tails')
    setProgress(null)
    recomputeStreak()
  }, [batchSize, record, recomputeStreak])

  const reset = useCallback(() => {
    flipsRef.current = new Uint8Array(MAX_STORED)
    lengthRef.current = 0
    setCount(0)
    setHeads(0)
    setRecent([])
    setFace(null)
    setLongest({ side: 'heads', run: 0 })
  }, [])

  const tails = count - heads
  const headsPct = count > 0 ? (heads / count) * 100 : 0
  const series = useMemo(
    () => buildSeries(flipsRef.current, Math.min(count, MAX_STORED), 600, 160),
    [count],
  )
  const deviation = count > 0 ? Math.abs(heads - count / 2) : 0

  const summary =
    count > 0
      ? summaryLines([
          `Flips: ${formatNumber(count, 0)}`,
          `Heads: ${formatNumber(heads, 0)} (${formatNumber(headsPct, 3)}%)`,
          `Tails: ${formatNumber(tails, 0)} (${formatNumber(100 - headsPct, 3)}%)`,
          `Longest run: ${longest.run} ${longest.side}`,
        ])
      : ''

  return (
    <div className="space-y-6">
      <ToolPanel
        title="Flip a coin"
        description="One flip, or up to 10,000 at once. Every flip comes from the browser's cryptographic random number generator."
        footer={
          <>
            <Button type="button" onClick={flipOnce} disabled={progress !== null} className="gap-2">
              Flip once
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void flipBatch()
              }}
              disabled={progress !== null}
            >
              Flip {formatNumber(Math.max(1, Math.min(MAX_BATCH, Math.round(num(batchSize, 1)))), 0)} times
            </Button>
            <Button type="button" variant="ghost" className="gap-2" onClick={reset} disabled={count === 0}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset
            </Button>
          </>
        }
      >
        <style>{FLIP_CSS}</style>

        <div className="flex flex-col items-center gap-4 py-2">
          <div
            className={cn(
              'grid size-28 place-items-center rounded-full border-4 text-center sm:size-32',
              face === 'heads'
                ? 'border-primary bg-primary text-primary-foreground'
                : face === 'tails'
                  ? 'border-foreground bg-background text-foreground'
                  : 'border-transparent bg-background text-muted-foreground',
              animating && 'otd-coin-flipping',
            )}
            aria-hidden="true"
          >
            <span className="text-xl font-bold">
              {face === 'heads' ? 'HEADS' : face === 'tails' ? 'TAILS' : '–'}
            </span>
          </div>
          <p role="status" aria-live="polite" className="text-sm font-medium text-foreground">
            {face === null
              ? 'No flips yet.'
              : `Latest flip: ${face}. ${formatNumber(count, 0)} flip${count === 1 ? '' : 's'} so far.`}
          </p>
        </div>

        <NumField
          label="Batch size"
          value={batchSize}
          onChange={setBatchSize}
          hint={`Between 1 and ${formatNumber(MAX_BATCH, 0)} flips per batch.`}
        />

        {progress !== null && (
          <ProgressPanel label="Flipping…" value={progress} sublabel="Chunked so the page stays responsive." />
        )}
      </ToolPanel>

      <ToolPanel
        title="Tally"
        footer={count > 0 ? <CopyButton value={summary} label="Copy the results" /> : undefined}
      >
        {count === 0 ? (
          <EmptyState message="Flip the coin to start counting." />
        ) : (
          <div className="space-y-4">
            <StatGrid cols={3}>
              <ResultStat
                label="Heads"
                value={formatNumber(heads, 0)}
                hint={`${formatNumber(headsPct, 2)}% of ${formatNumber(count, 0)} flips`}
                emphasis
              />
              <ResultStat
                label="Tails"
                value={formatNumber(tails, 0)}
                hint={`${formatNumber(100 - headsPct, 2)}%`}
              />
              <ResultStat
                label="Longest run"
                value={`${longest.run} ${longest.side}`}
                hint="Consecutive identical flips"
              />
            </StatGrid>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>Heads {formatNumber(headsPct, 1)}%</span>
                <span>Tails {formatNumber(100 - headsPct, 1)}%</span>
              </div>
              <div className="flex h-4 overflow-hidden rounded-full">
                <div className="bg-primary" style={{ width: `${headsPct}%` }} aria-hidden="true" />
                <div className="flex-1 bg-chart-3" aria-hidden="true" />
              </div>
            </div>

            <Note>
              Heads is {formatNumber(deviation, 0)} flip{deviation === 1 ? '' : 's'} away from an exact
              half. For a fair coin the typical gap grows like the square root of the number of flips
              (about {formatNumber(Math.sqrt(count) / 2, 1)} at {formatNumber(count, 0)} flips), so a
              gap of a few dozen in ten thousand throws is normal.
            </Note>

            {recent.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Most recent flips</h3>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((v, i) => (
                    <span
                      key={i}
                      className={cn(
                        'grid size-7 place-items-center rounded-md text-xs font-bold',
                        v === 1
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-foreground',
                      )}
                    >
                      {v === 1 ? 'H' : 'T'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ToolPanel>

      {series && (
        <ToolPanel
          title="Fairness chart"
          description="The running share of heads. A fair coin wanders early, then converges on the 50% line."
        >
          <ScrollTable>
            <svg
              viewBox="0 0 600 160"
              width="100%"
              height="180"
              role="img"
              aria-label={`Running proportion of heads across ${count} flips, currently ${formatNumber(headsPct, 2)} percent`}
              className="min-w-[320px]"
            >
              <line x1="0" y1="80" x2="560" y2="80" className="stroke-muted-foreground" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="40" x2="560" y2="40" className="stroke-muted-foreground" strokeWidth="0.5" />
              <line x1="0" y1="120" x2="560" y2="120" className="stroke-muted-foreground" strokeWidth="0.5" />
              <text x="566" y="44" className="fill-muted-foreground" fontSize="11">75%</text>
              <text x="566" y="84" className="fill-muted-foreground" fontSize="11">50%</text>
              <text x="566" y="124" className="fill-muted-foreground" fontSize="11">25%</text>
              <polyline
                points={series.points}
                fill="none"
                className="stroke-chart-1"
                strokeWidth="2"
                transform="scale(0.9333 1)"
              />
            </svg>
          </ScrollTable>
          <p className="text-xs text-muted-foreground">
            Dashed line = a perfectly fair 50%. The trace is the running share of heads from the first
            flip to the most recent.
          </p>
          <StatGrid cols={3}>
            <ResultStat label="Current share of heads" value={`${formatNumber(headsPct, 3)}%`} />
            <ResultStat label="Gap from 50%" value={`${formatNumber(Math.abs(headsPct - 50), 3)} pts`} />
            <ResultStat label="Flips recorded" value={formatNumber(count, 0)} />
          </StatGrid>
        </ToolPanel>
      )}
    </div>
  )
}
