import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/components/tools/finance/format'
import {
  Breakdown,
  CurrencySelect,
  D,
  EmptyState,
  NumField,
  Note,
  ScrollTable,
  Segmented,
  StatGrid,
  cents,
  money,
  num,
  parseNum,
  summaryLines,
  useCurrency,
} from './common'
import { US_STATE_RATES } from './us-sales-tax'

type Direction = 'add' | 'remove'
type RateSource = 'state' | 'custom'

export default function SalesTaxCalculator() {
  const [currency, setCurrency] = useCurrency()
  const [direction, setDirection] = useState<Direction>('add')
  const [rateSource, setRateSource] = useState<RateSource>('state')
  const [amount, setAmount] = useState('149.99')
  const [stateCode, setStateCode] = useState('CA')
  const [useLocal, setUseLocal] = useState(true)
  const [localRate, setLocalRate] = useState('1.6')
  const [customRate, setCustomRate] = useState('8.25')
  const [query, setQuery] = useState('')

  const stateRow = US_STATE_RATES.find((s) => s.code === stateCode) ?? US_STATE_RATES[0]

  const baseRate = rateSource === 'state' ? stateRow.rate : Math.max(0, num(customRate))
  const localPart = rateSource === 'state' && useLocal ? Math.max(0, num(localRate)) : 0
  const combined = baseRate + localPart

  const result = useMemo(() => {
    const value = parseNum(amount)
    if (value === null || value < 0) return null
    const rateD = D(combined).div(100)
    if (direction === 'add') {
      const net = D(value)
      const tax = net.times(rateD)
      return {
        net: cents(net),
        tax: cents(tax),
        gross: cents(net.plus(tax)),
        statePortion: cents(net.times(D(baseRate).div(100))),
        localPortion: cents(net.times(D(localPart).div(100))),
      }
    }
    const gross = D(value)
    const net = gross.div(D(1).plus(rateD))
    const tax = gross.minus(net)
    return {
      net: cents(net),
      tax: cents(tax),
      gross: cents(gross),
      statePortion: cents(net.times(D(baseRate).div(100))),
      localPortion: cents(net.times(D(localPart).div(100))),
    }
  }, [amount, baseRate, combined, direction, localPart])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return US_STATE_RATES
    return US_STATE_RATES.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    )
  }, [query])

  const summary = result
    ? summaryLines([
        direction === 'add' ? 'Adding sales tax' : 'Removing sales tax',
        rateSource === 'state'
          ? `${stateRow.name}: ${formatNumber(stateRow.rate, 3)}% state${localPart > 0 ? ` + ${formatNumber(localPart, 3)}% local` : ''}`
          : `Custom rate: ${formatNumber(combined, 3)}%`,
        `Price before tax: ${money(result.net, currency)}`,
        `Sales tax: ${money(result.tax, currency)}`,
        `Total with tax: ${money(result.gross, currency)}`,
      ])
    : ''

  return (
    <div className="space-y-6">
      <ToolPanel title="Amount and rate">
        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">What do you want to do?</span>
          <Segmented
            label="Direction"
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'add', label: 'Add tax to a price' },
              { value: 'remove', label: 'Remove tax from a total' },
            ]}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumField
            label={direction === 'add' ? 'Price before tax' : 'Total including tax'}
            value={amount}
            onChange={setAmount}
            placeholder="0.00"
            invalid={amount.trim() !== '' && parseNum(amount) === null}
          />
          <CurrencySelect value={currency} onChange={setCurrency} />
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">Tax rate</span>
          <Segmented
            label="Tax rate source"
            value={rateSource}
            onChange={setRateSource}
            options={[
              { value: 'state', label: 'Pick a US state' },
              { value: 'custom', label: 'Enter my own rate' },
            ]}
          />
        </div>

        {rateSource === 'state' ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="state-select">State</Label>
                <Select
                  value={stateCode}
                  onValueChange={(code) => {
                    setStateCode(code)
                    const row = US_STATE_RATES.find((s) => s.code === code)
                    if (row) setLocalRate(String(row.typicalLocal))
                  }}
                >
                  <SelectTrigger id="state-select" className="w-full">
                    <SelectValue placeholder="Choose a state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {US_STATE_RATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name} ({formatNumber(s.rate, 3)}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NumField
                label="Local (city / county) rate"
                value={localRate}
                onChange={setLocalRate}
                suffix="%"
                hint={
                  useLocal
                    ? `Pre-filled with a typical add-on for ${stateRow.name}. Replace it with the rate on your receipt for an exact answer.`
                    : 'Switched off. Only the state base rate is used.'
                }
              />
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
              <div className="min-w-0">
                <Label htmlFor="use-local" className="text-sm font-medium">
                  Include a local rate
                </Label>
                <p className="mt-1 text-xs text-pretty text-muted-foreground">
                  Most states let cities and counties stack their own sales tax on top of the state
                  rate.
                </p>
              </div>
              <Switch
                id="use-local"
                checked={useLocal}
                onCheckedChange={setUseLocal}
                aria-label="Include a local rate"
              />
            </div>

            {stateRow.note && <Note>{stateRow.note}</Note>}
          </div>
        ) : (
          <NumField
            label="Sales tax / VAT rate"
            value={customRate}
            onChange={setCustomRate}
            suffix="%"
            hint="Works for VAT and GST too: enter 20 for UK VAT, 5 for GST, and so on."
          />
        )}

        <Note tone={combined > 0 ? 'muted' : 'warning'}>
          Rate in use: <strong>{formatNumber(combined, 3)}%</strong>
          {rateSource === 'state' && localPart > 0
            ? ` (${formatNumber(baseRate, 3)}% state + ${formatNumber(localPart, 3)}% local)`
            : ''}
          {combined === 0 ? '. Nothing is added or removed at a 0% rate.' : ''}
        </Note>
      </ToolPanel>

      <ToolPanel
        title="Result"
        footer={result ? <CopyButton value={summary} label="Copy the breakdown" /> : undefined}
      >
        {result ? (
          <div className="space-y-4">
            <StatGrid cols={3}>
              <ResultStat
                label={direction === 'add' ? 'Total with tax' : 'Price before tax'}
                value={money(direction === 'add' ? result.gross : result.net, currency)}
                emphasis
              />
              <ResultStat label="Sales tax" value={money(result.tax, currency)} hint={`${formatNumber(combined, 3)}% rate`} />
              <ResultStat
                label={direction === 'add' ? 'Price before tax' : 'Total paid'}
                value={money(direction === 'add' ? result.net : result.gross, currency)}
              />
            </StatGrid>

            <Breakdown
              rows={[
                { label: 'Price before tax', value: money(result.net, currency) },
                ...(rateSource === 'state' && localPart > 0
                  ? [
                      { label: `State tax (${formatNumber(baseRate, 3)}%)`, value: money(result.statePortion, currency) },
                      { label: `Local tax (${formatNumber(localPart, 3)}%)`, value: money(result.localPortion, currency) },
                    ]
                  : [{ label: `Sales tax (${formatNumber(combined, 3)}%)`, value: money(result.tax, currency) }]),
                { label: 'Total with tax', value: money(result.gross, currency), strong: true },
              ]}
            />

            <Formula caption="Removing tax is a division. Subtracting the same percentage gives the wrong answer.">
              {direction === 'add'
                ? [
                    `tax   = ${money(result.net, currency)} × ${formatNumber(combined, 3)}% = ${money(result.tax, currency)}`,
                    `total = ${money(result.net, currency)} + ${money(result.tax, currency)} = ${money(result.gross, currency)}`,
                  ].join('\n')
                : [
                    `net   = ${money(result.gross, currency)} ÷ (1 + ${formatNumber(combined, 3)}%) = ${money(result.net, currency)}`,
                    `tax   = ${money(result.gross, currency)} − ${money(result.net, currency)} = ${money(result.tax, currency)}`,
                  ].join('\n')}
            </Formula>
          </div>
        ) : (
          <EmptyState message="Enter an amount to see the tax split out." />
        )}
      </ToolPanel>

      <ToolPanel
        title="US state sales tax rates"
        description="State base rates only. Tap a row to load it above."
      >
        <div className="space-y-1.5">
          <Label htmlFor="state-search">Find a state</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="state-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Texas, CA, Ohio…"
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState message="No state matches that search." />
        ) : (
          <ScrollTable className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">State rate</TableHead>
                  <TableHead className="text-right">Typical local</TableHead>
                  <TableHead className="text-right">Typical combined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow
                    key={s.code}
                    className={cn(
                      'cursor-pointer',
                      rateSource === 'state' && s.code === stateCode && 'bg-background font-semibold',
                    )}
                    onClick={() => {
                      setRateSource('state')
                      setStateCode(s.code)
                      setLocalRate(String(s.typicalLocal))
                    }}
                  >
                    <TableCell>
                      <button
                        type="button"
                        className="text-left font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRateSource('state')
                          setStateCode(s.code)
                          setLocalRate(String(s.typicalLocal))
                        }}
                      >
                        {s.name}
                      </button>
                      <span className="ml-2 text-xs text-muted-foreground">{s.code}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(s.rate, 3)}%</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatNumber(s.typicalLocal, 2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatNumber(s.rate + s.typicalLocal, 2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollTable>
        )}

        <Note tone="warning">
          These are state-level base rates with a rough average of local add-ons. Actual rates depend
          on the exact delivery address, and some goods (groceries, clothing, prescriptions) are taxed
          differently or not at all. Check your state revenue department before filing anything.
        </Note>
      </ToolPanel>
    </div>
  )
}
