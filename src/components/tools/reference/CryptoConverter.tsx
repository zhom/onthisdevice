import { useMemo, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CopyButton } from '@/components/shared/CopyButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ToolPanel } from '@/components/shared/ToolPanel'
import cryptoData from '@/data/crypto.json'
import fxData from '@/data/fx.json'
import type { DataMeta } from './data'
import { dayNumber, formatDay, isoOfDay, loadJson } from './data'
import { Segmented, useLoaded } from './controls'
import { crossRate, formatRate, parseAmount } from './fx'
import { LineChart, yearTicks } from './LineChart'
import { SourceNote } from './SourceNote'

interface CryptoManifest {
  meta: DataMeta
  date: string
  start: string
  coins: { symbol: string; name: string; usd: number }[]
  files: string
}
interface FxManifest {
  meta: DataMeta
  date: string
  rates: Record<string, number>
}
const CRYPTO = cryptoData as unknown as CryptoManifest
const FX = fxData as unknown as FxManifest
const FIATS = ['EUR', ...Object.keys(FX.rates)].sort()
const COIN_BY = new Map(CRYPTO.coins.map((c) => [c.symbol, c]))
const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' })
const nameOf = (code: string) => COIN_BY.get(code)?.name ?? currencyNames.of(code) ?? code

/** US dollars for one unit of a coin or a currency. */
function usdPer(code: string): number {
  const coin = COIN_BY.get(code)
  if (coin) return coin.usd
  return 1 / crossRate(FX.rates, 'USD', code)
}

type Range = '1m' | '3m' | '1y' | 'all'
const RANGES: { id: Range; label: string; days: number }[] = [
  { id: '1m', label: '1M', days: 31 },
  { id: '3m', label: '3M', days: 92 },
  { id: '1y', label: '1Y', days: 366 },
  { id: 'all', label: 'All', days: Infinity },
]

function UnitPicker({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Cryptocurrencies</SelectLabel>
            {CRYPTO.coins.map((c) => (
              <SelectItem key={c.symbol} value={c.symbol}>
                {c.symbol} · {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Currencies</SelectLabel>
            {FIATS.map((c) => (
              <SelectItem key={c} value={c}>
                {c} · {nameOf(c)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

const usd = (v: number) =>
  v >= 1
    ? v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
    : `$${formatRate(v)}`

export default function CryptoConverter() {
  const [amount, setAmount] = useState('1')
  const [from, setFrom] = useState('BTC')
  const [to, setTo] = useState('USD')
  const [range, setRange] = useState<Range>('1y')
  const [spin, setSpin] = useState(0)

  const value = parseAmount(amount)
  const rate = usdPer(from) / usdPer(to)
  const result = value * rate
  // The chart follows the coin side of the pair (the first coin when both are coins).
  const chartCoin = COIN_BY.has(from) ? from : COIN_BY.has(to) ? to : null

  const history = useLoaded(chartCoin, async () => {
    const values = await loadJson<(number | null)[]>(`${CRYPTO.files}/${chartCoin}.json`)
    const start = dayNumber(CRYPTO.start)
    return { coin: chartCoin as string, x: values.map((_, i) => start + i), values }
  })

  const view = useMemo(() => {
    if (history.state !== 'ready') return null
    const { x, values, coin } = history.data
    const span = RANGES.find((r) => r.id === range)?.days ?? Infinity
    const last = x[x.length - 1]
    let i0 = Number.isFinite(span) ? Math.max(0, x.findIndex((d) => d >= last - span)) : 0
    while (i0 < values.length - 1 && values[i0] === null) i0++
    const xs = x.slice(i0)
    const vs = values.slice(i0)
    const first = vs.find((v) => v !== null) ?? Number.NaN
    const end = [...vs].reverse().find((v) => v !== null) ?? Number.NaN
    let hi = -Infinity
    let lo = Infinity
    for (const v of vs) if (v !== null) [hi, lo] = [Math.max(hi, v), Math.min(lo, v)]
    return { coin, x: xs, series: [{ label: `${coin} in USD`, values: vs }], first, end, hi, lo }
  }, [history, range])

  const fmt = (v: number, code: string) => {
    if (!Number.isFinite(v)) return `– ${code}`
    const coin = COIN_BY.has(code)
    const text = Math.abs(v) >= 1 ? v.toLocaleString('en-US', { minimumFractionDigits: coin ? 0 : 2, maximumFractionDigits: coin ? 8 : 2 }) : formatRate(v)
    return `${text} ${code}`
  }

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="space-y-1.5">
          <Label htmlFor="cc-amount">Amount</Label>
          <Input id="cc-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg tabular-nums" autoComplete="off" />
        </div>
        <div className="flex items-end gap-2">
          <UnitPicker id="cc-from" label="From" value={from} onChange={setFrom} />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Swap"
            onClick={() => {
              setFrom(to)
              setTo(from)
              setSpin((s) => s + 1)
            }}
          >
            <ArrowLeftRight className="transition-transform duration-300 ease-[var(--ease-out)]" style={{ transform: `rotate(${spin * 180}deg)` }} />
          </Button>
          <UnitPicker id="cc-to" label="To" value={to} onChange={setTo} />
        </div>
        {Number.isFinite(value) ? null : <ErrorNote message="Enter an amount, for example 0.5 or 1,200." />}
        <div role="status" aria-live="polite" className="space-y-1 pt-2">
          <p className="text-sm text-muted-foreground">{fmt(value, from)} is</p>
          <p key={`${from}${to}`} className="reveal text-[2rem] leading-tight font-[740] tabular-nums break-words sm:text-[2.5rem]">
            {fmt(result, to)}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            1 {from} = {formatRate(rate)} {to} · 1 {to} = {formatRate(1 / rate)} {from}
          </p>
          <p className="text-sm font-[600]">Prices of {formatDay(CRYPTO.date)}</p>
        </div>
        <CopyButton value={`${fmt(value, from)} = ${fmt(result, to)} (${formatDay(CRYPTO.date)})`} label="Copy result" />
      </ToolPanel>

      {chartCoin ? (
        <ToolPanel title={`${nameOf(chartCoin)} price in US dollars`}>
          <Segmented value={range} onChange={setRange} options={RANGES} label="Time range" />
          {history.state === 'error' ? <ErrorNote message={history.message} /> : null}
          {view ? (
            <LineChart
              x={view.x}
              series={view.series}
              area
              formatY={(v) => (v >= 1000 ? `$${Math.round(v).toLocaleString('en-US')}` : usd(v))}
              formatX={(d) => formatDay(isoOfDay(d))}
              xTicks={yearTicks}
              ariaLabel={`${view.coin} price in US dollars`}
              summary={
                <>
                  From {formatDay(isoOfDay(view.x[0]))} to {formatDay(CRYPTO.date)}, {view.coin} went from {usd(view.first)} to {usd(view.end)} (
                  {view.end >= view.first ? '+' : ''}
                  {(((view.end - view.first) / view.first) * 100).toFixed(1)}%). High {usd(view.hi)}, low {usd(view.lo)}.
                </>
              }
            />
          ) : (
            <div className="h-[220px] sm:h-[280px]" />
          )}
        </ToolPanel>
      ) : null}

      <ToolPanel title={`Prices in ${COIN_BY.has(to) ? 'USD' : to}`}>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {CRYPTO.coins.map((c) => {
            const unit = COIN_BY.has(to) ? 'USD' : to
            return (
              <li key={c.symbol} className="flex items-baseline justify-between gap-3">
                <button type="button" className="truncate text-left text-muted-foreground hover:text-foreground" onClick={() => setFrom(c.symbol)}>
                  {c.symbol} · {c.name}
                </button>
                <span className="shrink-0 font-[600] tabular-nums">{fmt(c.usd / usdPer(unit), unit).replace(` ${unit}`, '')}</span>
              </li>
            )
          })}
        </ul>
      </ToolPanel>

      <SourceNote meta={CRYPTO.meta}>One daily price per coin, in US dollars; other currencies use the ECB reference rate of {formatDay(FX.date)}.</SourceNote>
    </div>
  )
}
