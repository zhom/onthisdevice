import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import mortgageData from '@/data/mortgage-rates.json'
import type { DataMeta } from './data'
import { dayNumber, formatDay, isoOfDay, loadJson } from './data'
import { Segmented, useLoaded } from './controls'
import { parseAmount } from './fx'
import { LineChart, yearTicks } from './LineChart'
import { SourceNote } from './SourceNote'

interface Week {
  date: string
  fixed30: number
  fixed15: number
}
interface MortgageManifest extends Week {
  meta: DataMeta
  previous: Week
  yearAgo: Week | null
  weeks: number
  files: string
}
const M = mortgageData as unknown as MortgageManifest

type Range = '1y' | '5y' | '10y' | 'all'
const RANGES: { id: Range; label: string; days: number }[] = [
  { id: '1y', label: '1Y', days: 366 },
  { id: '5y', label: '5Y', days: 1827 },
  { id: '10y', label: '10Y', days: 3653 },
  { id: 'all', label: 'Since 1971', days: Infinity },
]

/** Monthly principal and interest of a fixed-rate loan. */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12
  const n = years * 12
  return r === 0 ? principal / n : (principal * r) / (1 - (1 + r) ** -n)
}

function Change({ now, before }: { now: number; before: number }) {
  const d = Math.round((now - before) * 100) / 100
  const Icon = d > 0 ? ArrowUp : d < 0 ? ArrowDown : Minus
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5" aria-hidden="true" />
      {d === 0 ? 'unchanged' : `${d > 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(2)} points`} from last week
    </span>
  )
}

const usd = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export default function MortgageRates() {
  const [range, setRange] = useState<Range>('10y')
  const [loan, setLoan] = useState('400,000')
  const history = useLoaded('pmms', () => loadJson<{ dates: string[]; r30: number[]; r15: (number | null)[] }>(`${M.files}/history.json`))

  const view = useMemo(() => {
    if (history.state !== 'ready') return null
    const { dates, r30, r15 } = history.data
    const days = dates.map(dayNumber)
    const span = RANGES.find((r) => r.id === range)?.days ?? Infinity
    const last = days[days.length - 1]
    const i0 = Number.isFinite(span) ? Math.max(0, days.findIndex((d) => d >= last - span)) : 0
    const v30 = r30.slice(i0)
    let hi = 0
    let lo = Infinity
    let hiAt = 0
    let loAt = 0
    v30.forEach((v, k) => {
      if (v > hi) [hi, hiAt] = [v, k + i0]
      if (v < lo) [lo, loAt] = [v, k + i0]
    })
    return {
      x: days.slice(i0),
      series: [
        { label: '30-year', values: v30 },
        { label: '15-year', values: r15.slice(i0), style: 'dashed' as const },
      ],
      hi: { v: hi, date: dates[hiAt] },
      lo: { v: lo, date: dates[loAt] },
      first: { v: r30[i0], date: dates[i0] },
      recent: dates.slice(-8).map((d, k) => ({ date: d, r30: r30[r30.length - 8 + k], r15: r15[r15.length - 8 + k] })).reverse(),
    }
  }, [history, range])

  const principal = parseAmount(loan)

  return (
    <div className="space-y-6">
      <ToolPanel title={`Week of ${formatDay(M.date)}`}>
        <div className="grid gap-3 sm:grid-cols-2" role="status" aria-live="polite">
          <ResultStat label="30-year fixed" value={`${M.fixed30.toFixed(2)}%`} hint={<Change now={M.fixed30} before={M.previous.fixed30} />} emphasis />
          <ResultStat label="15-year fixed" value={`${M.fixed15.toFixed(2)}%`} hint={<Change now={M.fixed15} before={M.previous.fixed15} />} emphasis />
        </div>
        {M.yearAgo ? (
          <p className="text-sm text-muted-foreground">
            A year ago ({formatDay(M.yearAgo.date)}): {M.yearAgo.fixed30.toFixed(2)}% for 30 years, {M.yearAgo.fixed15.toFixed(2)}% for 15 years.
          </p>
        ) : null}
      </ToolPanel>

      <ToolPanel title="Weekly average rates">
        <Segmented value={range} onChange={setRange} options={RANGES} label="Time range" />
        {history.state === 'error' ? <ErrorNote message={history.message} /> : null}
        {view ? (
          <>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
              <li className="flex items-center gap-1.5">
                <svg viewBox="0 0 16 4" className="h-1 w-4">
                  <line x1={0} x2={16} y1={2} y2={2} strokeWidth={2} stroke="var(--foreground)" />
                </svg>
                30-year fixed
              </li>
              <li className="flex items-center gap-1.5">
                <svg viewBox="0 0 16 4" className="h-1 w-4">
                  <line x1={0} x2={16} y1={2} y2={2} strokeWidth={2} strokeDasharray="5 3" stroke="var(--foreground)" />
                </svg>
                15-year fixed
              </li>
            </ul>
            <LineChart
              x={view.x}
              series={view.series}
              formatY={(v) => `${v.toFixed(v < 10 ? 1 : 0)}%`}
              formatX={(d) => `Week of ${formatDay(isoOfDay(d))}`}
              xTicks={yearTicks}
              ariaLabel="Weekly average 30-year and 15-year fixed mortgage rates"
              summary={
                <>
                  Since {formatDay(view.first.date)} the 30-year rate went from {view.first.v.toFixed(2)}% to {M.fixed30.toFixed(2)}%. In this period it was highest at{' '}
                  {view.hi.v.toFixed(2)}% ({formatDay(view.hi.date)}) and lowest at {view.lo.v.toFixed(2)}% ({formatDay(view.lo.date)}).
                </>
              }
            />
          </>
        ) : (
          <div className="h-[240px] sm:h-[300px]" />
        )}
      </ToolPanel>

      <ToolPanel title="What the rate means for a payment" description="Principal and interest only, before tax, insurance and PMI.">
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="mr-loan">Loan amount (USD)</Label>
          <Input id="mr-loan" inputMode="decimal" value={loan} onChange={(e) => setLoan(e.target.value)} className="tabular-nums" autoComplete="off" />
        </div>
        {Number.isFinite(principal) && principal > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultStat
              label={`30 years at ${M.fixed30.toFixed(2)}%`}
              value={`${usd(monthlyPayment(principal, M.fixed30, 30))}/mo`}
              hint={`${usd(monthlyPayment(principal, M.fixed30, 30) * 360 - principal)} interest in total`}
            />
            <ResultStat
              label={`15 years at ${M.fixed15.toFixed(2)}%`}
              value={`${usd(monthlyPayment(principal, M.fixed15, 15))}/mo`}
              hint={`${usd(monthlyPayment(principal, M.fixed15, 15) * 180 - principal)} interest in total`}
            />
          </div>
        ) : (
          <ErrorNote message="Enter a loan amount, for example 350,000." />
        )}
        <p className="text-sm">
          <a href="/mortgage-calculator" className="font-[600] underline underline-offset-2">
            Mortgage calculator
          </a>{' '}
          <span className="text-muted-foreground">adds tax, insurance, PMI and a full schedule.</span>
        </p>
      </ToolPanel>

      {view ? (
        <ToolPanel title="Last 8 weeks">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-sm tabular-nums">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-4 font-[560]">Week of</th>
                  <th className="py-1 pr-4 text-right font-[560]">30-year</th>
                  <th className="py-1 text-right font-[560]">15-year</th>
                </tr>
              </thead>
              <tbody>
                {view.recent.map((w) => (
                  <tr key={w.date}>
                    <td className="py-1 pr-4">{formatDay(w.date)}</td>
                    <td className="py-1 pr-4 text-right font-[600]">{w.r30.toFixed(2)}%</td>
                    <td className="py-1 text-right font-[600]">{w.r15 === null ? '–' : `${w.r15.toFixed(2)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ToolPanel>
      ) : null}

      <SourceNote meta={M.meta}>Published each Thursday. Rates are national averages for borrowers with 20% down and excellent credit.</SourceNote>
    </div>
  )
}
