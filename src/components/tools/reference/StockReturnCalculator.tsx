import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import stockData from '@/data/stock-returns.json'
import type { DataMeta } from './data'
import { formatMonth, loadJson } from './data'
import { Loading, useLoaded } from './controls'
import { parseAmount } from './fx'
import { LineChart, numberTicks } from './LineChart'
import { SourceNote } from './SourceNote'
import type { Monthly } from './stock'
import { cagr, growth, monthIndex, realCagr } from './stock'

interface StockManifest {
  meta: DataMeta
  start: string
  end: string
  months: number
  files: string
}
const S = stockData as unknown as StockManifest
const FIRST_YEAR = Number(S.start.slice(0, 4))
const LAST_YEAR = Number(S.end.slice(0, 4))

const usd = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (v: number) => `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(2)}%`
const compactUsd = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })

function YearField({ id, label, value, onChange, min, max }: { id: string; label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  const [text, setText] = useState(String(value))
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setText(String(value))
  }
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value)
          if (Number.isInteger(n) && n >= min && n <= max) onChange(n)
        }}
        className="tabular-nums"
        autoComplete="off"
      />
      <Slider min={min} max={max} step={1} value={[value]} onValueChange={([v]) => onChange(v)} aria-label={`${label} (slider)`} />
    </div>
  )
}

export default function StockReturnCalculator() {
  const [amount, setAmount] = useState('10,000')
  const [monthly, setMonthly] = useState('0')
  const [from, setFrom] = useState(1990)
  const [to, setTo] = useState(LAST_YEAR)
  const [log, setLog] = useState(false)
  const data = useLoaded('stock', () => loadJson<Monthly>(`${S.files}/monthly.json`))

  const start = Math.min(from, to - 1)
  const lump = parseAmount(amount)
  const add = parseAmount(monthly || '0')
  const valid = Number.isFinite(lump) && lump >= 0 && Number.isFinite(add) && add >= 0 && lump + add > 0

  const calc = useMemo(() => {
    if (data.state !== 'ready' || !valid) return null
    const d = data.data
    const i0 = monthIndex(S.start, `${start}-01`)
    const i1 = Math.min(S.months - 1, monthIndex(S.start, `${to}-12`))
    const g = growth(d, i0, i1, lump, add)
    const x = g.total.map((_, k) => start + k / 12)
    const end = g.total[g.total.length - 1]
    const lumpOnly = growth(d, i0, i1, 1)
    return {
      i0,
      i1,
      g,
      x,
      end,
      endReal: g.real[g.real.length - 1],
      endPrice: g.price[g.price.length - 1],
      nominalCagr: cagr(1, lumpOnly.total[lumpOnly.total.length - 1], i1 - i0),
      priceCagr: cagr(1, lumpOnly.price[lumpOnly.price.length - 1], i1 - i0),
      realRate: realCagr(d, i0, i1),
      inflation: cagr(d.cpi[i0], d.cpi[i1], i1 - i0),
      series: [
        { label: 'With dividends', values: g.total },
        { label: 'After inflation', values: g.real, style: 'dashed' as const },
        { label: 'Price only', values: g.price, style: 'grey' as const },
      ],
    }
  }, [data, start, to, lump, add, valid])

  const endLabel = calc ? formatMonth(monthToYm(calc.i1)) : ''

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sr-amount">Amount invested at the start (USD)</Label>
            <Input id="sr-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular-nums" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sr-monthly">Added each month (USD)</Label>
            <Input id="sr-monthly" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} className="tabular-nums" autoComplete="off" />
          </div>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <YearField id="sr-from" label="From January of" value={start} onChange={setFrom} min={FIRST_YEAR} max={LAST_YEAR - 1} />
          <YearField id="sr-to" label="To December of" value={to} onChange={setTo} min={FIRST_YEAR + 1} max={LAST_YEAR} />
        </div>
        {valid ? null : <ErrorNote message="Enter an amount of 0 or more, for example 10,000." />}
      </ToolPanel>

      {data.state === 'error' ? <ErrorNote message={data.message} /> : null}
      {data.state === 'loading' ? <Loading label="Loading monthly market data since 1871" /> : null}

      {calc ? (
        <>
          <ToolPanel title="Result">
            <div role="status" aria-live="polite" className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {usd(calc.g.invested)} invested from {formatMonth(monthToYm(calc.i0))} grew to
              </p>
              <p className="text-[2rem] leading-tight font-[740] tabular-nums sm:text-[2.5rem]">{usd(calc.end)}</p>
              <p className="text-sm text-muted-foreground">
                by {endLabel}, with dividends reinvested, before fees and taxes.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat label="Average return per year" value={pct(calc.nominalCagr)} hint={`${pct(calc.priceCagr)} from price alone`} />
              <ResultStat label="After inflation" value={pct(calc.realRate)} hint={`Inflation was ${pct(calc.inflation)} per year`} />
              <ResultStat label="Without dividends" value={usd(calc.endPrice)} hint="Price change only" />
              <ResultStat label={`In ${formatMonth(monthToYm(calc.i0))} dollars`} value={usd(calc.endReal)} hint="The end value, adjusted for inflation" />
            </div>
            <CopyButton
              value={`${usd(calc.g.invested)} invested in the US stock market (S&P Composite) from ${formatMonth(monthToYm(calc.i0))} to ${endLabel}: ${usd(calc.end)} with dividends reinvested, ${pct(calc.nominalCagr)} per year, ${pct(calc.realRate)} per year after inflation.`}
              label="Copy result"
            />
          </ToolPanel>

          <ToolPanel title="Growth, month by month">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
                {[
                  ['With dividends', undefined, 'var(--foreground)'],
                  ['After inflation', '5 3', 'var(--foreground)'],
                  ['Price only', undefined, 'var(--chart-3)'],
                ].map(([label, dash, color]) => (
                  <li key={label} className="flex items-center gap-1.5">
                    <svg viewBox="0 0 16 4" className="h-1 w-4">
                      <line x1={0} x2={16} y1={2} y2={2} strokeWidth={2} strokeDasharray={dash} stroke={color} />
                    </svg>
                    {label}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2">
                <Switch id="sr-log" checked={log} onCheckedChange={setLog} />
                <Label htmlFor="sr-log" className="text-sm">
                  Log scale
                </Label>
              </div>
            </div>
            <LineChart
              x={calc.x}
              series={calc.series}
              log={log}
              zero={!log}
              formatY={compactUsd}
              formatX={(v) => formatMonth(monthToYm(calc.i0 + Math.round((v - start) * 12)))}
              xTicks={numberTicks}
              ariaLabel={`Growth of ${usd(lump)} from ${start} to ${to}`}
              summary={`With dividends reinvested the investment ended at ${usd(calc.end)}; on price alone it would be ${usd(calc.endPrice)}. In money of ${start} the end value is ${usd(calc.endReal)}.`}
            />
          </ToolPanel>
        </>
      ) : null}

      <SourceNote meta={S.meta}>
        Monthly data from {formatMonth(S.start)} to {formatMonth(S.end)}; prices are monthly averages of daily closes.
      </SourceNote>
    </div>
  )
}

function monthToYm(index: number): string {
  const y = Number(S.start.slice(0, 4)) + Math.floor(index / 12)
  const m = (index % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}`
}
