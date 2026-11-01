import { useMemo, useState } from 'react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { clamp } from '@/lib/utils'
import { formatNumber } from '@/components/tools/finance/format'
import {
  Breakdown,
  CurrencySelect,
  D,
  EmptyState,
  NumField,
  Note,
  PresetRow,
  ScrollTable,
  StatGrid,
  cents,
  money,
  num,
  parseNum,
  summaryLines,
  useCurrency,
} from './common'

const COMMON_PERCENTS = [5, 10, 15, 20, 25, 30, 33.33, 40, 50, 60, 70, 75, 80, 90]
const PRESET_PERCENTS = [
  { value: 10, label: '10%' },
  { value: 15, label: '15%' },
  { value: 20, label: '20%' },
  { value: 25, label: '25%' },
  { value: 30, label: '30%' },
  { value: 40, label: '40%' },
  { value: 50, label: '50%' },
  { value: 75, label: '75%' },
]
const COMMON_PRICES = [10, 20, 25, 50, 75, 100, 150, 200, 250, 500, 1000]

export default function PercentageOffCalculator() {
  const [currency, setCurrency] = useCurrency()
  const [percent, setPercent] = useState('25')
  const [price, setPrice] = useState('80')
  const [withTax, setWithTax] = useState(false)
  const [taxRate, setTaxRate] = useState('8.25')

  const percentValue = parseNum(percent)
  const priceValue = parseNum(price)

  const result = useMemo(() => {
    if (percentValue === null || priceValue === null) return null
    const p = D(priceValue)
    const saved = p.times(percentValue).div(100)
    const net = p.minus(saved)
    const rate = withTax ? Math.max(0, num(taxRate)) : 0
    const tax = net.times(rate).div(100)
    return {
      original: p,
      saved: cents(saved),
      net: cents(net),
      tax: cents(tax),
      final: cents(net.plus(tax)),
      remaining: 100 - percentValue,
      rate,
    }
  }, [percentValue, priceValue, taxRate, withTax])

  const sliderValue = clamp(percentValue ?? 0, 0, 100)

  const summary = result
    ? summaryLines([
        `${formatNumber(percentValue ?? 0, 2)}% off ${money(result.original, currency)}`,
        `You save: ${money(result.saved, currency)}`,
        `You pay: ${money(result.net, currency)}`,
        result.rate > 0 ? `With ${formatNumber(result.rate, 3)}% tax: ${money(result.final, currency)}` : null,
      ])
    : ''

  return (
    <div className="space-y-6">
      <ToolPanel title="What is X% off Y?">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField
            label="Percent off"
            value={percent}
            onChange={setPercent}
            suffix="%"
            placeholder="25"
            invalid={percent.trim() !== '' && percentValue === null}
          />
          <NumField
            label="Original price"
            value={price}
            onChange={setPrice}
            placeholder="80.00"
            invalid={price.trim() !== '' && priceValue === null}
          />
          <CurrencySelect value={currency} onChange={setCurrency} />
        </div>

        <PresetRow
          label="Common discount percentages"
          options={PRESET_PERCENTS}
          active={percentValue ?? undefined}
          onPick={(v) => setPercent(String(v))}
        />

        <div className="space-y-2">
          <Label htmlFor="percent-slider">Drag to change the discount</Label>
          <Slider
            id="percent-slider"
            aria-label="Percent off"
            value={[sliderValue]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => setPercent(String(v[0]))}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
            <div className="min-w-0">
              <Label htmlFor="pct-tax" className="text-sm font-medium">
                Add sales tax to the sale price
              </Label>
              <p className="mt-1 text-xs text-pretty text-muted-foreground">
                Tax is charged on the discounted price in almost every jurisdiction.
              </p>
            </div>
            <Switch
              id="pct-tax"
              checked={withTax}
              onCheckedChange={setWithTax}
              aria-label="Add sales tax to the sale price"
            />
          </div>
          {withTax && <NumField label="Tax rate" value={taxRate} onChange={setTaxRate} suffix="%" />}
        </div>
      </ToolPanel>

      <ToolPanel
        title="The answer"
        footer={result ? <CopyButton value={summary} label="Copy the answer" /> : undefined}
      >
        {result ? (
          <div className="space-y-4">
            <p className="text-lg leading-relaxed text-pretty text-foreground">
              <strong>{formatNumber(percentValue ?? 0, 2)}% off {money(result.original, currency)}</strong>{' '}
              is <strong className="text-primary">{money(result.net, currency)}</strong>. You save{' '}
              <strong>{money(result.saved, currency)}</strong>.
            </p>

            <StatGrid cols={withTax ? 3 : 2}>
              <ResultStat
                label="You pay"
                value={money(withTax ? result.final : result.net, currency)}
                hint={withTax ? `Includes ${money(result.tax, currency)} tax` : `${formatNumber(result.remaining, 2)}% of the original`}
                emphasis
              />
              <ResultStat
                label="You save"
                value={money(result.saved, currency)}
                hint={`${formatNumber(percentValue ?? 0, 2)}% of ${money(result.original, currency)}`}
              />
              {withTax && (
                <ResultStat label="Sale price before tax" value={money(result.net, currency)} />
              )}
            </StatGrid>

            <Breakdown
              rows={[
                { label: 'Original price', value: money(result.original, currency) },
                { label: `Discount (${formatNumber(percentValue ?? 0, 2)}%)`, value: `−${money(result.saved, currency)}` },
                { label: 'Sale price', value: money(result.net, currency), strong: !withTax },
                ...(withTax
                  ? [
                      { label: `Sales tax (${formatNumber(result.rate, 3)}%)`, value: money(result.tax, currency) },
                      { label: 'Total at the till', value: money(result.final, currency), strong: true },
                    ]
                  : []),
              ]}
            />

            <Formula caption="Two equivalent routes to the same number.">
              {[
                `saving   = ${money(result.original, currency)} × ${formatNumber(percentValue ?? 0, 2)} ÷ 100 = ${money(result.saved, currency)}`,
                `sale     = ${money(result.original, currency)} − ${money(result.saved, currency)} = ${money(result.net, currency)}`,
                `shortcut = ${money(result.original, currency)} × ${formatNumber(result.remaining / 100, 4)} = ${money(result.net, currency)}`,
              ].join('\n')}
            </Formula>

            {percentValue !== null && percentValue > 100 && (
              <Note tone="warning">
                A discount over 100% would mean the shop pays you. Check the percentage.
              </Note>
            )}
          </div>
        ) : (
          <EmptyState message="Enter a percentage and a price to see the answer." />
        )}
      </ToolPanel>

      <ToolPanel
        title={`Every common discount off ${priceValue !== null ? money(D(priceValue), currency) : 'your price'}`}
        description="The same price at each of the percentages shops actually use."
      >
        {priceValue !== null ? (
          <ScrollTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Discount</TableHead>
                  <TableHead className="text-right">You save</TableHead>
                  <TableHead className="text-right">You pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMMON_PERCENTS.map((p) => {
                  const saved = cents(D(priceValue).times(p).div(100))
                  const pay = cents(D(priceValue).minus(saved))
                  return (
                    <TableRow
                      key={p}
                      className={percentValue !== null && Math.abs(percentValue - p) < 0.005 ? 'bg-background font-semibold' : undefined}
                    >
                      <TableCell className="font-medium">{formatNumber(p, 2)}% off</TableCell>
                      <TableCell className="text-right tabular-nums">{money(saved, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(pay, currency)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollTable>
        ) : (
          <EmptyState message="Enter a price to build the table." />
        )}
      </ToolPanel>

      <ToolPanel
        title={`${formatNumber(percentValue ?? 0, 2)}% off common price points`}
        description="Handy when you are scanning a rail of tickets rather than one item."
      >
        {percentValue !== null ? (
          <ScrollTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Original</TableHead>
                  <TableHead className="text-right">You save</TableHead>
                  <TableHead className="text-right">You pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMMON_PRICES.map((base) => {
                  const saved = cents(D(base).times(percentValue).div(100))
                  const pay = cents(D(base).minus(saved))
                  return (
                    <TableRow key={base}>
                      <TableCell className="font-medium">{money(base, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(saved, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(pay, currency)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollTable>
        ) : (
          <EmptyState message="Enter a percentage to build the table." />
        )}
      </ToolPanel>
    </div>
  )
}
