import { useMemo, useRef, useState } from 'react'
import type Decimal from 'decimal.js'
import { Plus, Trash2 } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
  Segmented,
  StatGrid,
  cents,
  money,
  num,
  parseNum,
  pct,
  summaryLines,
  useCurrency,
} from './common'

type DiscountKind = 'percent' | 'amount'

interface DiscountRow {
  id: string
  kind: DiscountKind
  value: string
}

interface Step {
  label: string
  before: Decimal
  off: Decimal
  after: Decimal
}

const PERCENT_PRESETS = [
  { value: 10, label: '10%' },
  { value: 15, label: '15%' },
  { value: 20, label: '20%' },
  { value: 25, label: '25%' },
  { value: 30, label: '30%' },
  { value: 40, label: '40%' },
  { value: 50, label: '50%' },
  { value: 70, label: '70%' },
]

export default function DiscountCalculator() {
  const [currency, setCurrency] = useCurrency()
  const [tab, setTab] = useState('apply')

  /* apply mode */
  const idRef = useRef(100)
  const [price, setPrice] = useState('89.99')
  const [discounts, setDiscounts] = useState<DiscountRow[]>([
    { id: 'd1', kind: 'percent', value: '30' },
  ])
  const [taxRate, setTaxRate] = useState('0')
  const [taxAfter, setTaxAfter] = useState(true)

  /* reverse: find original */
  const [paid, setPaid] = useState('62.99')
  const [paidDiscount, setPaidDiscount] = useState('30')
  const [paidIncludesTax, setPaidIncludesTax] = useState(false)
  const [paidTaxRate, setPaidTaxRate] = useState('8.25')

  /* find the discount percentage */
  const [wasPrice, setWasPrice] = useState('120')
  const [nowPrice, setNowPrice] = useState('84')

  /* ------------------------- apply ------------------------- */
  const applied = useMemo(() => {
    const original = parseNum(price)
    if (original === null || original < 0) return null
    let running = D(original)
    const steps: Step[] = []
    for (const d of discounts) {
      const v = Math.max(0, num(d.value))
      if (v <= 0) continue
      const off = d.kind === 'percent' ? running.times(v).div(100) : D(Math.min(v, running.toNumber()))
      const after = running.minus(off)
      steps.push({
        label: d.kind === 'percent' ? `${formatNumber(v, 2)}% off` : `${money(v, currency)} off`,
        before: running,
        off,
        after,
      })
      running = after
    }
    const netPrice = running.lt(0) ? D(0) : running
    const rate = Math.max(0, num(taxRate))
    const taxBase = taxAfter ? netPrice : D(original)
    const tax = taxBase.times(rate).div(100)
    const finalPrice = netPrice.plus(tax)
    const saved = D(original).minus(netPrice)
    const effective = original > 0 ? saved.div(original).times(100).toNumber() : 0
    return {
      original: D(original),
      steps,
      netPrice: cents(netPrice),
      tax: cents(tax),
      finalPrice: cents(finalPrice),
      saved: cents(saved),
      effective,
      rate,
    }
  }, [currency, discounts, price, taxAfter, taxRate])

  /* --------------------- find original --------------------- */
  const reverse = useMemo(() => {
    const paidValue = parseNum(paid)
    const discountValue = num(paidDiscount)
    if (paidValue === null || paidValue <= 0) return null
    if (discountValue >= 100) return { error: 'A discount of 100% or more cannot be reversed, because the original price would be undefined.' as const }
    if (discountValue < 0) return { error: 'Enter a discount between 0 and 99.99%.' as const }
    const rate = Math.max(0, num(paidTaxRate))
    const beforeTax = paidIncludesTax ? D(paidValue).div(D(1).plus(D(rate).div(100))) : D(paidValue)
    const original = beforeTax.div(D(1).minus(D(discountValue).div(100)))
    return {
      error: null,
      paidValue: D(paidValue),
      beforeTax: cents(beforeTax),
      taxPart: cents(D(paidValue).minus(beforeTax)),
      original: cents(original),
      saved: cents(original.minus(beforeTax)),
      discountValue,
      rate,
    }
  }, [paid, paidDiscount, paidIncludesTax, paidTaxRate])

  /* ------------------- find discount rate ------------------- */
  const rateFinder = useMemo(() => {
    const was = parseNum(wasPrice)
    const now = parseNum(nowPrice)
    if (was === null || now === null || was <= 0) return null
    const saved = D(was).minus(now)
    const percentOff = saved.div(was).times(100)
    return {
      was: D(was),
      now: D(now),
      saved: cents(saved),
      percentOff: percentOff.toNumber(),
      markUpBack: now > 0 ? saved.div(now).times(100).toNumber() : 0,
    }
  }, [nowPrice, wasPrice])

  const summary =
    tab === 'apply' && applied
      ? summaryLines([
          `Original price: ${money(applied.original, currency)}`,
          ...applied.steps.map(
            (s) => `${s.label}: −${money(cents(s.off), currency)} → ${money(cents(s.after), currency)}`,
          ),
          applied.rate > 0 ? `Sales tax ${formatNumber(applied.rate, 3)}%: ${money(applied.tax, currency)}` : null,
          `You pay: ${money(applied.finalPrice, currency)}`,
          `You save: ${money(applied.saved, currency)} (${formatNumber(applied.effective, 2)}%)`,
        ])
      : tab === 'reverse' && reverse && !reverse.error
        ? summaryLines([
            `Paid: ${money(reverse.paidValue, currency)}`,
            `Discount: ${formatNumber(reverse.discountValue, 2)}%`,
            `Original price: ${money(reverse.original, currency)}`,
            `Saved: ${money(reverse.saved, currency)}`,
          ])
        : tab === 'rate' && rateFinder
          ? summaryLines([
              `Was ${money(rateFinder.was, currency)}, now ${money(rateFinder.now, currency)}`,
              `Discount: ${formatNumber(rateFinder.percentOff, 2)}%`,
              `Saved: ${money(rateFinder.saved, currency)}`,
            ])
          : ''

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="apply">Apply discount</TabsTrigger>
          <TabsTrigger value="reverse">Find original</TabsTrigger>
          <TabsTrigger value="rate">Find % off</TabsTrigger>
        </TabsList>

        {/* --------------------------- APPLY --------------------------- */}
        <TabsContent value="apply" className="mt-6 space-y-6">
          <ToolPanel
            title="Price and discounts"
            description="Add more than one discount to stack them. Each one is taken off what is left after the one above it."
            footer={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() =>
                  setDiscounts((prev) => [
                    ...prev,
                    { id: `d${idRef.current++}`, kind: 'percent', value: '' },
                  ])
                }
              >
                <Plus className="size-4" aria-hidden="true" />
                Stack another discount
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <NumField
                label="Original price"
                value={price}
                onChange={setPrice}
                placeholder="0.00"
                invalid={price.trim() !== '' && parseNum(price) === null}
              />
              <CurrencySelect value={currency} onChange={setCurrency} />
            </div>

            <ul className="space-y-3">
              {discounts.map((d, i) => (
                <li key={d.id} className="rounded-lg bg-muted p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="w-full space-y-2 sm:w-48">
                      <span className="text-sm font-medium text-foreground">
                        Discount {i + 1} type
                      </span>
                      <Segmented
                        label={`Discount ${i + 1} type`}
                        value={d.kind}
                        onChange={(kind) =>
                          setDiscounts((prev) =>
                            prev.map((q) => (q.id === d.id ? { ...q, kind } : q)),
                          )
                        }
                        options={[
                          { value: 'percent', label: '% off' },
                          { value: 'amount', label: 'Amount off' },
                        ]}
                      />
                    </div>
                    <NumField
                      label={d.kind === 'percent' ? 'Percent off' : 'Amount off'}
                      value={d.value}
                      onChange={(v) =>
                        setDiscounts((prev) => prev.map((q) => (q.id === d.id ? { ...q, value: v } : q)))
                      }
                      suffix={d.kind === 'percent' ? '%' : undefined}
                      className="flex-1"
                      placeholder="0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove discount ${i + 1}`}
                      disabled={discounts.length <= 1}
                      onClick={() => setDiscounts((prev) => prev.filter((q) => q.id !== d.id))}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  {d.kind === 'percent' && (
                    <PresetRow
                      className="mt-3"
                      label={`Common percentages for discount ${i + 1}`}
                      options={PERCENT_PRESETS}
                      active={num(d.value, -1)}
                      onPick={(v) =>
                        setDiscounts((prev) =>
                          prev.map((q) => (q.id === d.id ? { ...q, value: String(v) } : q)),
                        )
                      }
                    />
                  )}
                </li>
              ))}
            </ul>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumField
                label="Sales tax rate"
                value={taxRate}
                onChange={setTaxRate}
                suffix="%"
                hint="Leave at 0 if the ticket price already includes tax."
              />
              <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
                <div className="min-w-0">
                  <Label htmlFor="tax-after" className="text-sm font-medium">
                    Tax charged on the discounted price
                  </Label>
                  <p className="mt-1 text-xs text-pretty text-muted-foreground">
                    Normal for the US and most of Europe. Switch off to tax the full ticket price.
                  </p>
                </div>
                <Switch
                  id="tax-after"
                  checked={taxAfter}
                  onCheckedChange={setTaxAfter}
                  aria-label="Tax charged on the discounted price"
                />
              </div>
            </div>
          </ToolPanel>

          <ToolPanel
            title="What you pay"
            footer={applied ? <CopyButton value={summary} label="Copy the result" /> : undefined}
          >
            {applied ? (
              <div className="space-y-4">
                <StatGrid>
                  <ResultStat
                    label="Final price"
                    value={money(applied.finalPrice, currency)}
                    hint={applied.rate > 0 ? `Includes ${money(applied.tax, currency)} tax` : 'No tax added'}
                    emphasis
                  />
                  <ResultStat
                    label="You save"
                    value={money(applied.saved, currency)}
                    hint={`${formatNumber(applied.effective, 2)}% off the original price`}
                  />
                </StatGrid>

                {applied.steps.length > 1 && (
                  <Note>
                    Stacked discounts never add up. {applied.steps.map((s) => s.label).join(' then ')}{' '}
                    is an effective {formatNumber(applied.effective, 2)}% off, not{' '}
                    {formatNumber(
                      discounts
                        .filter((d) => d.kind === 'percent')
                        .reduce((a, d) => a + Math.max(0, num(d.value)), 0),
                      2,
                    )}
                    %, because each one is taken off a smaller number than the last.
                  </Note>
                )}

                {applied.steps.length > 0 && (
                  <ScrollTable>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Step</TableHead>
                          <TableHead className="text-right">Price before</TableHead>
                          <TableHead className="text-right">Taken off</TableHead>
                          <TableHead className="text-right">Price after</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {applied.steps.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{s.label}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {money(cents(s.before), currency)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-destructive">
                              −{money(cents(s.off), currency)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {money(cents(s.after), currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollTable>
                )}

                <Breakdown
                  rows={[
                    { label: 'Original price', value: money(applied.original, currency) },
                    { label: 'Total discount', value: `−${money(applied.saved, currency)}` },
                    { label: 'Discounted price', value: money(applied.netPrice, currency) },
                    ...(applied.rate > 0
                      ? [{ label: `Sales tax (${formatNumber(applied.rate, 3)}%)`, value: money(applied.tax, currency) }]
                      : []),
                    { label: 'You pay', value: money(applied.finalPrice, currency), strong: true },
                  ]}
                />

                <Formula caption="Multiply the surviving fractions, do not add the percentages.">
                  {[
                    `discounted = ${money(applied.original, currency)}${applied.steps
                      .map((s, i) =>
                        discounts[i] && discounts[i].kind === 'percent'
                          ? ` × (1 − ${formatNumber(num(discounts[i].value), 2)}%)`
                          : ` − ${money(cents(s.off), currency)}`,
                      )
                      .join('')} = ${money(applied.netPrice, currency)}`,
                    applied.rate > 0
                      ? `tax        = ${money(applied.netPrice, currency)} × ${formatNumber(applied.rate, 3)}% = ${money(applied.tax, currency)}`
                      : '',
                    `you pay    = ${money(applied.finalPrice, currency)}`,
                  ]
                    .filter(Boolean)
                    .join('\n')}
                </Formula>
              </div>
            ) : (
              <EmptyState message="Enter an original price to see the discounted total." />
            )}
          </ToolPanel>
        </TabsContent>

        {/* -------------------------- REVERSE -------------------------- */}
        <TabsContent value="reverse" className="mt-6 space-y-6">
          <ToolPanel
            title="I paid this much after a discount"
            description="Work backwards from the till receipt to the pre-sale price."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <NumField label="Amount paid" value={paid} onChange={setPaid} placeholder="0.00" />
              <NumField label="Discount taken" value={paidDiscount} onChange={setPaidDiscount} suffix="%" />
              <CurrencySelect value={currency} onChange={setCurrency} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
                <div className="min-w-0">
                  <Label htmlFor="paid-tax" className="text-sm font-medium">
                    The amount I paid included sales tax
                  </Label>
                  <p className="mt-1 text-xs text-pretty text-muted-foreground">
                    Strips the tax out before reversing the discount.
                  </p>
                </div>
                <Switch
                  id="paid-tax"
                  checked={paidIncludesTax}
                  onCheckedChange={setPaidIncludesTax}
                  aria-label="The amount I paid included sales tax"
                />
              </div>
              {paidIncludesTax && (
                <NumField label="Sales tax rate" value={paidTaxRate} onChange={setPaidTaxRate} suffix="%" />
              )}
            </div>
          </ToolPanel>

          <ToolPanel
            title="The original price"
            footer={
              reverse && !reverse.error ? <CopyButton value={summary} label="Copy the result" /> : undefined
            }
          >
            {!reverse ? (
              <EmptyState message="Enter what you actually paid to work back to the list price." />
            ) : reverse.error ? (
              <Note tone="warning">{reverse.error}</Note>
            ) : (
              <div className="space-y-4">
                <StatGrid>
                  <ResultStat
                    label="Original price"
                    value={money(reverse.original, currency)}
                    hint={`Before the ${formatNumber(reverse.discountValue, 2)}% discount`}
                    emphasis
                  />
                  <ResultStat
                    label="You saved"
                    value={money(reverse.saved, currency)}
                    hint="Original price minus the pre-tax amount you paid"
                  />
                </StatGrid>
                <Breakdown
                  rows={[
                    { label: 'You paid', value: money(reverse.paidValue, currency) },
                    ...(paidIncludesTax
                      ? [
                          { label: `Tax inside that (${formatNumber(reverse.rate, 3)}%)`, value: money(reverse.taxPart, currency) },
                          { label: 'Paid before tax', value: money(reverse.beforeTax, currency) },
                        ]
                      : []),
                    { label: 'Original price', value: money(reverse.original, currency), strong: true },
                  ]}
                />
                <Formula caption="Dividing by the surviving fraction is the inverse of taking a percentage off.">
                  {[
                    paidIncludesTax
                      ? `before tax = ${money(reverse.paidValue, currency)} ÷ (1 + ${formatNumber(reverse.rate, 3)}%) = ${money(reverse.beforeTax, currency)}`
                      : '',
                    `original   = ${money(reverse.beforeTax, currency)} ÷ (1 − ${formatNumber(reverse.discountValue, 2)}%) = ${money(reverse.original, currency)}`,
                  ]
                    .filter(Boolean)
                    .join('\n')}
                </Formula>
              </div>
            )}
          </ToolPanel>
        </TabsContent>

        {/* ---------------------------- RATE ---------------------------- */}
        <TabsContent value="rate" className="mt-6 space-y-6">
          <ToolPanel
            title="Was this price, now that price"
            description="Turn two prices into the percentage on the sale sign."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <NumField label="Original price" value={wasPrice} onChange={setWasPrice} />
              <NumField label="Sale price" value={nowPrice} onChange={setNowPrice} />
              <CurrencySelect value={currency} onChange={setCurrency} />
            </div>
          </ToolPanel>

          <ToolPanel
            title="The discount"
            footer={rateFinder ? <CopyButton value={summary} label="Copy the result" /> : undefined}
          >
            {rateFinder ? (
              <div className="space-y-4">
                <StatGrid>
                  <ResultStat
                    label="Discount"
                    value={pct(rateFinder.percentOff)}
                    hint={
                      rateFinder.percentOff < 0
                        ? 'The "sale" price is higher than the original.'
                        : `Off ${money(rateFinder.was, currency)}`
                    }
                    emphasis
                  />
                  <ResultStat
                    label="Amount saved"
                    value={money(rateFinder.saved, currency)}
                    hint={`Sale price is ${formatNumber(100 - rateFinder.percentOff, 2)}% of the original`}
                  />
                </StatGrid>
                <Formula caption="Percentage off is always measured against the original price, never the sale price.">
                  {[
                    `saved     = ${money(rateFinder.was, currency)} − ${money(rateFinder.now, currency)} = ${money(rateFinder.saved, currency)}`,
                    `% off     = ${money(rateFinder.saved, currency)} ÷ ${money(rateFinder.was, currency)} × 100 = ${formatNumber(rateFinder.percentOff, 2)}%`,
                    `mark-up back to the original = ${formatNumber(rateFinder.markUpBack, 2)}%`,
                  ].join('\n')}
                </Formula>
                <Note>
                  Going the other way is not symmetrical: a {formatNumber(rateFinder.percentOff, 2)}%
                  discount needs a {formatNumber(rateFinder.markUpBack, 2)}% increase to get back to{' '}
                  {money(rateFinder.was, currency)}.
                </Note>
              </div>
            ) : (
              <EmptyState message="Enter both prices to see the percentage off." />
            )}
          </ToolPanel>
        </TabsContent>
      </Tabs>
    </div>
  )
}
