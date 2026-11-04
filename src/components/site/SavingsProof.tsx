import { useEffect, useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { loadJson } from '@/components/tools/reference/data'
import { realReturns } from '@/components/tools/reference/stock'
import type { Monthly } from '@/components/tools/reference/stock'
import stockData from '@/data/stock-returns.json'
import { BLOCK_YEARS, EXAMPLE, FULL_PATHS, monthlyRate, simulateInStages } from '@/lib/engine/retire'
import type { RetireResult } from '@/lib/engine/retire'

const MIN_SPENDING = 1_000
const MAX_SPENDING = 10_000
const money = (v: number) => v.toLocaleString('en-US')

/**
 * The home page's proof. It runs on the visitor's device, so each number on it is true of that
 * device. Nothing starts until the band is on screen.
 */
export default function SavingsProof() {
  const [spending, setSpending] = useState(EXAMPLE.spending)
  const [returns, setReturns] = useState<Float64Array | null>(null)
  const [result, setResult] = useState<RetireResult | null>(null)
  const [failed, setFailed] = useState(false)
  const generation = useRef(0)

  useEffect(() => {
    loadJson<Monthly>(`${stockData.files}/monthly.json`).then((d) => setReturns(realReturns(d)), () => setFailed(true))
  }, [])

  useEffect(() => {
    if (!returns) return
    const token = ++generation.current
    const plan = {
      start: EXAMPLE.savings,
      saving: EXAMPLE.saving,
      spending,
      stocks: EXAMPLE.stocks / 100,
      other: monthlyRate(EXAMPLE.rest),
      yearsSaving: EXAMPLE.retire - EXAMPLE.age,
      yearsRetired: EXAMPLE.end - EXAMPLE.retire,
      blockYears: BLOCK_YEARS,
    }
    simulateInStages(returns, plan, () => token !== generation.current, setResult).catch(() => setFailed(true))
    return () => {
      generation.current++
    }
  }, [returns, spending])

  return (
    <div className="min-w-0">
      <p className="t-display num text-foreground">{result ? `${(result.success * 100).toFixed(1)}%` : '–'}</p>
      <p className="mt-2 text-[1.0625rem] font-[600] text-foreground">Chance the money lasts to {EXAMPLE.end}</p>
      <div className="mt-8 space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <Label id="proof-spending">Spent each month in retirement</Label>
          <span className="num text-[1.0625rem] font-[650] text-foreground">{money(spending)}</span>
        </div>
        <Slider
          min={MIN_SPENDING}
          max={MAX_SPENDING}
          step={100}
          value={[spending]}
          onValueChange={([v]) => setSpending(v ?? EXAMPLE.spending)}
          aria-labelledby="proof-spending"
        />
      </div>
      <p className="sr-only" role="status">
        {result?.paths === FULL_PATHS ? `${(result.success * 100).toFixed(1)}% chance at ${money(spending)} a month` : ''}
      </p>
      <p className="mt-5 min-h-[1.5em] text-[0.9375rem] text-muted-foreground">
        {failed
          ? 'This browser could not start the simulation.'
          : result
            ? `${money(result.paths)} simulated retirements in ${(result.milliseconds / 1000).toFixed(2)} s on this device.`
            : 'Starting on this device…'}
      </p>
    </div>
  )
}
