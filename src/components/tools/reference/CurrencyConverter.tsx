import { useMemo, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import fxData from '@/data/fx.json'
import type { DataMeta } from './data'
import { formatDay, loadJson } from './data'
import { Segmented, useLoaded } from './controls'
import { crossRate, decodeDates, formatRate, pairSeries, parseAmount } from './fx'
import { LineChart, yearTicks } from './LineChart'
import { SourceNote } from './SourceNote'

interface FxManifest {
  meta: DataMeta
  date: string
  rates: Record<string, number>
  files: string
}
const FX = fxData as unknown as FxManifest
const CODES = ['EUR', ...Object.keys(FX.rates)].sort()

const names = new Intl.DisplayNames(['en'], { type: 'currency' })
const nameOf = (code: string) => {
  try {
    return names.of(code) ?? code
  } catch {
    return code
  }
}

type Range = '1m' | '1y' | '5y' | '10y' | 'all'
const RANGES: { id: Range; label: string; days: number }[] = [
  { id: '1m', label: '1M', days: 31 },
  { id: '1y', label: '1Y', days: 366 },
  { id: '5y', label: '5Y', days: 1827 },
  { id: '10y', label: '10Y', days: 3653 },
  { id: 'all', label: 'All', days: Infinity },
]

function CurrencyPicker({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CODES.map((c) => (
            <SelectItem key={c} value={c}>
              {c} · {nameOf(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

const money = (v: number, code: string) => {
  if (!Number.isFinite(v)) return '–'
  const abs = Math.abs(v)
  const digits = abs >= 1 ? 2 : Math.min(8, 2 - Math.floor(Math.log10(abs || 1)) + 2)
  return `${v.toLocaleString('en-US', { minimumFractionDigits: abs >= 1 ? 2 : 0, maximumFractionDigits: digits })} ${code}`
}

export default function CurrencyConverter() {
  const [amount, setAmount] = useState('1000')
  const [from, setFrom] = useState('EUR')
  const [to, setTo] = useState('USD')
  const [range, setRange] = useState<Range>('5y')
  const [spin, setSpin] = useState(0)

  const value = parseAmount(amount)
  const rate = crossRate(FX.rates, from, to)
  const result = value * rate

  const history = useLoaded(`${from}-${to}`, async () => {
    const [dates, a, b] = await Promise.all([
      loadJson<{ start: string; gaps: string }>(`${FX.files}/dates.json`),
      from === 'EUR' ? Promise.resolve(null) : loadJson<(number | null)[]>(`${FX.files}/${from}.json`),
      to === 'EUR' ? Promise.resolve(null) : loadJson<(number | null)[]>(`${FX.files}/${to}.json`),
    ])
    const days = decodeDates(dates.start, dates.gaps)
    return { days, pair: pairSeries(a, b, days.length), from, to }
  })

  const view = useMemo(() => {
    if (history.state !== 'ready') return null
    const { days, pair } = history.data
    const span = RANGES.find((r) => r.id === range)?.days ?? Infinity
    const lastDay = days[days.length - 1]
    let i0 = 0
    if (Number.isFinite(span)) while (i0 < days.length - 1 && days[i0] < lastDay - span) i0++
    while (i0 < days.length - 1 && pair[i0] === null) i0++
    const x = days.slice(i0)
    const values = pair.slice(i0)
    let hi = -Infinity
    let lo = Infinity
    let hiDay = 0
    let loDay = 0
    values.forEach((v, k) => {
      if (v === null) return
      if (v > hi) [hi, hiDay] = [v, x[k]]
      if (v < lo) [lo, loDay] = [v, x[k]]
    })
    const first = values.find((v) => v !== null) ?? Number.NaN
    const last = values[values.length - 1] ?? Number.NaN
    return { x, series: [{ label: `${history.data.to} per ${history.data.from}`, values }], hi, lo, hiDay, loDay, first, last, firstDay: x[0] }
  }, [history, range])

  const iso = (d: number) => new Date(d * 86_400_000).toISOString().slice(0, 10)
  const resultText = `${money(value, from)} = ${money(result, to)}`

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="space-y-1.5">
          <Label htmlFor="fx-amount">Amount</Label>
          <Input id="fx-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg tabular-nums" autoComplete="off" />
        </div>
        <div className="flex items-end gap-2">
          <CurrencyPicker id="fx-from" label="From" value={from} onChange={setFrom} />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Swap currencies"
            onClick={() => {
              setFrom(to)
              setTo(from)
              setSpin((s) => s + 1)
            }}
          >
            <ArrowLeftRight className="transition-transform duration-300 ease-[var(--ease-out)]" style={{ transform: `rotate(${spin * 180}deg)` }} />
          </Button>
          <CurrencyPicker id="fx-to" label="To" value={to} onChange={setTo} />
        </div>
        {Number.isFinite(value) ? null : <ErrorNote message="Enter an amount, for example 250 or 1,250.50." />}
        <div role="status" aria-live="polite" className="space-y-1 pt-2">
          <p className="text-sm text-muted-foreground">{money(value, from)} is</p>
          <p key={`${from}${to}`} className="reveal text-[2rem] leading-tight font-[740] tabular-nums break-words sm:text-[2.5rem]">
            {money(result, to)}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            1 {from} = {formatRate(rate)} {to} · 1 {to} = {formatRate(1 / rate)} {from}
          </p>
          <p className="text-sm font-[600]">Rates of {formatDay(FX.date)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={resultText} label="Copy result" />
        </div>
      </ToolPanel>

      <ToolPanel title={`${from} to ${to} since 1999`}>
        <Segmented value={range} onChange={setRange} options={RANGES} label="Time range" />
        {history.state === 'error' ? <ErrorNote message={history.message} /> : null}
        {view ? (
          <LineChart
            x={view.x}
            series={view.series}
            area
            formatY={formatRate}
            formatX={(d) => formatDay(iso(d))}
            xTicks={yearTicks}
            ariaLabel={`${to} per ${from}, ${formatDay(iso(view.firstDay))} to ${formatDay(FX.date)}`}
            summary={
              <>
                From {formatDay(iso(view.firstDay))} to {formatDay(FX.date)}, 1 {from} went from {formatRate(view.first)} to {formatRate(view.last)} {to} (
                {view.last >= view.first ? '+' : ''}
                {(((view.last - view.first) / view.first) * 100).toFixed(1)}%). High {formatRate(view.hi)} on {formatDay(iso(view.hiDay))}, low {formatRate(view.lo)} on{' '}
                {formatDay(iso(view.loDay))}.
              </>
            }
          />
        ) : history.state === 'loading' ? (
          <div className="h-[220px] sm:h-[280px]" role="status" aria-live="polite">
            <span className="sr-only">Loading the rate history</span>
          </div>
        ) : null}
      </ToolPanel>

      <ToolPanel title={`${money(value, from)} in other currencies`}>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {CODES.filter((c) => c !== from).map((c) => (
            <li key={c} className="flex items-baseline justify-between gap-3">
              <button type="button" className="truncate text-left text-muted-foreground hover:text-foreground" onClick={() => setTo(c)}>
                {c} · {nameOf(c)}
              </button>
              <span className="shrink-0 font-[600] tabular-nums">{money(value * crossRate(FX.rates, from, c), c).replace(` ${c}`, '')}</span>
            </li>
          ))}
        </ul>
      </ToolPanel>

      <SourceNote meta={FX.meta}>
        The ECB publishes reference rates once each working day, around 16:00 CET. They are for information; a bank or card rate adds a margin.
      </SourceNote>
    </div>
  )
}
