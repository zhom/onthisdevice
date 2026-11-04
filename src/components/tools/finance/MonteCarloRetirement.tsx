import { useEffect, useMemo, useRef, useState } from 'react'
import { compact, linear, niceTicksIn, useTweenRows, useWidth } from '@/components/viz'
import stockData from '@/data/stock-returns.json'
import { BLOCK_YEARS, EXAMPLE, PERCENTILES, monthlyRate, simulateInStages, successGrid } from '@/lib/engine/retire'
import type { RetirePlan, RetireResult } from '@/lib/engine/retire'
import { cn } from '@/lib/utils'
import { CalcLayout, NumField, Result, Stage, Stat, useFields } from '../calc2/_viz/Calc'
import { Loading, useLoaded } from '../reference/controls'
import { loadJson } from '../reference/data'
import { realReturns } from '../reference/stock'
import type { Monthly } from '../reference/stock'

const GRID_PATHS = 20_000
const AGE_STEPS = [-8, -6, -4, -2, 0, 2, 4, 6, 8]
const SPEND_STEPS = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4]
/** Above this a grid cell reads as safe. */
const SAFE = 0.95
const MARGINAL = 0.8

const MEDIAN = PERCENTILES.indexOf(0.5)
const money = (v: number) => Math.round(v).toLocaleString('en-US')

interface Inputs {
  age: number
  retire: number
  end: number
}

function planFor({ age, retire, end }: Inputs, start: number, saving: number, spending: number, stocks: number, other: number): RetirePlan {
  return { start, saving, spending, stocks, other, yearsSaving: retire - age, yearsRetired: end - retire, blockYears: BLOCK_YEARS }
}

export default function MonteCarloRetirement() {
  const f = useFields({
    age: String(EXAMPLE.age),
    retire: String(EXAMPLE.retire),
    end: String(EXAMPLE.end),
    savings: money(EXAMPLE.savings),
    saving: money(EXAMPLE.saving),
    spending: money(EXAMPLE.spending),
    stocks: String(EXAMPLE.stocks),
    rest: String(EXAMPLE.rest),
  })
  const { age, retire, end, savings, saving, spending, stocks, rest } = f.num
  const data = useLoaded('stock', () => loadJson<Monthly>(`${stockData.files}/monthly.json`).then(realReturns))
  const returns = data.state === 'ready' ? data.data : null

  const error = useMemo(() => {
    if ([age, retire, end, savings, saving, spending, stocks, rest].includes(null)) return 'Fill in every field.'
    if (age! < 18 || age! > 100 || !Number.isInteger(age)) return 'Use a whole age from 18 to 100.'
    if (!Number.isInteger(retire) || retire! < age!) return 'Use a whole retirement age, at or above your age.'
    if (!Number.isInteger(end) || end! <= retire!) return 'Plan to an age after retirement.'
    if (end! - age! > 80) return 'Plan for at most 80 years.'
    if (savings! < 0 || saving! < 0 || spending! < 0) return 'Use amounts of 0 or more.'
    if (stocks! < 0 || stocks! > 100) return 'Use a stock share from 0 to 100%.'
    if (rest! < -10 || rest! > 20) return 'Use a return from −10% to 20%.'
    return null
  }, [age, retire, end, savings, saving, spending, stocks, rest])

  const shape = useMemo(() => {
    if (error) return null
    const inputs = { age: age!, retire: retire!, end: end! }
    const other = monthlyRate(rest!)
    const make = (r: number, s: number) => planFor({ ...inputs, retire: r }, savings!, saving!, s, stocks! / 100, other)
    const ages = AGE_STEPS.map((d) => retire! + d).filter((r) => r >= age! && r < end!)
    const spends = SPEND_STEPS.map((m) => Math.round((spending! * m) / 10) * 10)
    return { inputs, plan: make(retire!, spending!), ages, spends, cells: ages.flatMap((r) => spends.map((s) => make(r, s))) }
  }, [error, age, retire, end, savings, saving, spending, stocks, rest])

  const [result, setResult] = useState<RetireResult | null>(null)
  const [grid, setGrid] = useState<number[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const generation = useRef(0)

  useEffect(() => {
    if (!returns || !shape) return
    const token = ++generation.current
    const stale = () => token !== generation.current
    const go = async () => {
      const cells = successGrid(returns, shape.cells, GRID_PATHS, stale).then((found) => found && setGrid(found))
      await simulateInStages(returns, shape.plan, stale, setResult)
      await cells
    }
    go().catch((cause: unknown) => {
      if (!stale()) setFailure(cause instanceof Error ? cause.message : 'The simulation could not finish.')
    })
    return () => {
      generation.current++
    }
  }, [returns, shape])

  const current = !error && result?.bands.length === shape?.plan.yearsSaving! + shape?.plan.yearsRetired! ? result : null
  const atRetire = shape && shape.plan.yearsSaving > 0 ? current?.bands[shape.plan.yearsSaving - 1]?.[MEDIAN] : null
  const last = current?.bands[current.bands.length - 1]
  const firstOut = current?.solvent.findIndex((s) => s < 0.9) ?? -1

  return (
    <CalcLayout
      layout="stack"
      inputs={
        <>
          <div className="grid grid-cols-3 gap-3">
            <NumField label="Age now" {...f.bind('age')} inputMode="numeric" />
            <NumField label="Retire at" {...f.bind('retire')} inputMode="numeric" />
            <NumField label="Plan to age" {...f.bind('end')} inputMode="numeric" />
          </div>
          <NumField label="Savings now" {...f.bind('savings')} />
          <NumField label="Saved each month until retirement" {...f.bind('saving')} slider={{ min: 0, max: 10000, step: 50 }} />
          <NumField label="Spent each month in retirement" {...f.bind('spending')} slider={{ min: 0, max: 20000, step: 50 }} hint="In today's money, like every amount here." />
          <NumField label="Share in stocks" {...f.bind('stocks')} unit="%" slider={{ min: 0, max: 100, step: 5 }} />
          <NumField label="Return on the rest, after inflation" {...f.bind('rest')} unit="% a year" />
        </>
      }
      result={
        <Result
          label={`Chance the money lasts to age ${end ?? '–'}`}
          value={current ? current.success * 100 : '–'}
          format={(v) => `${v.toFixed(1)}%`}
          sub={current ? `${current.paths.toLocaleString('en-US')} simulated retirements in ${(current.milliseconds / 1000).toFixed(2)} s on this device.` : undefined}
          error={error ?? failure ?? (data.state === 'error' ? data.message : null)}
        >
          {current && last ? (
            <>
              {atRetire != null ? <Stat label={`Median at ${retire}`} value={money(atRetire)} /> : null}
              <Stat label={`Median at ${end}`} value={money(last[MEDIAN]!)} />
              <Stat label={`Worst 10% at ${end}`} value={money(last[0]!)} />
              <Stat label="1 in 10 paths runs out by" value={firstOut < 0 ? 'Never' : `Age ${age! + firstOut + 1}`} />
            </>
          ) : !error && !failure ? (
            <Loading label="Starting the simulation…" />
          ) : null}
        </Result>
      }
      visual={
        current && shape ? (
          <Stage summary={`Savings by age, in today's money. The line is the median path. The dark band holds the middle half of the paths, the light band holds 8 in 10. Returns come from US stocks, ${stockData.start.slice(0, 4)} to ${stockData.end.slice(0, 4)}, in random ${BLOCK_YEARS}-year runs.`}>
            <Fan bands={current.bands} first={shape.inputs.age + 1} retire={shape.inputs.retire} />
          </Stage>
        ) : null
      }
    >
      {grid && shape && grid.length === shape.cells.length ? (
        <SuccessGrid
          ages={shape.ages}
          spends={shape.spends}
          cells={grid}
          retire={shape.inputs.retire}
          spending={spending!}
          onPick={(r, s) => f.setMany({ retire: String(r), spending: String(s) })}
        />
      ) : null}
    </CalcLayout>
  )
}

function SuccessGrid({ ages, spends, cells, retire, spending, onPick }: { ages: number[]; spends: number[]; cells: number[]; retire: number; spending: number; onPick: (retire: number, spending: number) => void }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[1.0625rem] font-[650] text-foreground">Chance of success by retirement age and monthly spending</h2>
      <p className="max-w-2xl text-[0.875rem] text-pretty text-muted-foreground">
        Each cell is its own simulation of {GRID_PATHS.toLocaleString('en-US')} retirements. Pick a cell to make it your plan.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[38rem] table-fixed border-separate border-spacing-1 text-[0.875rem] tabular-nums">
          <thead>
            <tr>
              <th scope="col" className="w-20 px-2 py-1 text-left font-[600] text-muted-foreground">
                Retire at
              </th>
              {spends.map((s) => (
                <th key={s} scope="col" className="px-1 py-1 text-right font-[600] text-muted-foreground">
                  {money(s)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ages.map((a, row) => (
              <tr key={a}>
                <th scope="row" className="px-2 py-1 text-left font-[600] text-foreground">
                  {a}
                </th>
                {spends.map((s, col) => {
                  const chance = cells[row * spends.length + col]!
                  const mine = a === retire && Math.abs(s - spending) < 10
                  return (
                    <td key={s} className="p-0">
                      <button
                        type="button"
                        onClick={() => onPick(a, s)}
                        aria-label={`Retire at ${a}, spend ${money(s)} a month: ${(chance * 100).toFixed(0)}% chance`}
                        aria-pressed={mine}
                        className={cn(
                          'block h-9 w-full rounded-md px-1 text-right font-[600] transition-transform duration-150 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95',
                          chance >= SAFE ? 'bg-foreground text-background' : chance >= MARGINAL ? 'bg-muted text-foreground' : 'text-muted-foreground',
                          mine && 'outline-2 outline-offset-1 outline-foreground',
                        )}
                      >
                        {(chance * 100).toFixed(0)}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const H = 320
const PAD = { top: 12, right: 8, bottom: 28, left: 46 }

function Fan({ bands, first, retire }: { bands: number[][]; first: number; retire: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  // One row per percentile, so the shape tweens between results.
  const rows = useTweenRows(
    useMemo(() => PERCENTILES.map((_, p) => bands.map((year) => year[p]!)), [bands]),
    { duration: 220 },
  )
  const [p10, p25, p50, p75, p90] = rows as [number[], number[], number[], number[], number[]]
  const top = Math.max(1, ...p90)
  const lastAge = first + p50.length - 1
  const x = linear(first, lastAge, PAD.left, width - PAD.right)
  const y = linear(0, top, H - PAD.bottom, PAD.top)
  const line = (r: number[]) => r.map((v, i) => `${x(first + i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = (lo: number[], hi: number[]) => `M${line(hi)} L${line(lo).split(' ').reverse().join(' ')} Z`
  const ageTicks = niceTicksIn(first, lastAge, Math.max(3, Math.round(width / 90)), 1)
  const moneyTicks = niceTicksIn(0, top, 5)

  return (
    <div ref={ref} className="px-2 pt-2">
      <svg width={width} height={H} role="img" aria-label={`Median savings of ${money(p50[p50.length - 1]!)} at age ${lastAge}.`} className="block max-w-full">
        {moneyTicks.map((t) => (
          <text key={t} x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[0.75rem] tabular-nums">
            {compact(t)}
          </text>
        ))}
        {ageTicks.map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[0.75rem] tabular-nums">
            {t}
          </text>
        ))}
        <path d={area(p10, p90)} fill="var(--chart-5)" />
        <path d={area(p25, p75)} fill="var(--chart-4)" />
        <polyline points={line(p50)} fill="none" stroke="var(--foreground)" strokeWidth={2} strokeLinejoin="round" />
        {retire > first && retire <= lastAge ? (
          <g>
            <line x1={x(retire)} x2={x(retire)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--foreground)" strokeDasharray="2 4" />
            <text x={x(retire) + 6} y={PAD.top + 12} className="fill-foreground text-[0.75rem] font-[600]">
              Retire
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  )
}
