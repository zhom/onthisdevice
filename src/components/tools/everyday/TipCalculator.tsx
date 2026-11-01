import { useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { Minus, Plus } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { Formula } from '@/components/shared/Formula'
import { CopyButton } from '@/components/shared/CopyButton'
import { Button } from '@/components/ui/button'
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
  Segmented,
  StatGrid,
  cents,
  money,
  num,
  parseNum,
  summaryLines,
  useCurrency,
} from './common'

type Rounding = 'none' | 'tip-up' | 'total-1' | 'total-5' | 'person-1'

const ROUNDING_LABEL: Record<Rounding, string> = {
  none: 'No rounding (exact cents)',
  'tip-up': 'Round the tip up to a whole unit',
  'total-1': 'Round the total up to the next whole unit',
  'total-5': 'Round the total up to the next multiple of 5',
  'person-1': 'Round each share up to a whole unit',
}

const TIP_PRESETS = [
  { value: 10, label: '10%' },
  { value: 15, label: '15%' },
  { value: 18, label: '18%' },
  { value: 20, label: '20%' },
  { value: 22, label: '22%' },
  { value: 25, label: '25%' },
]

export default function TipCalculator() {
  const [currency, setCurrency] = useCurrency()
  const [bill, setBill] = useState('68.40')
  const [tipPct, setTipPct] = useState(18)
  const [peopleRaw, setPeopleRaw] = useState('2')
  const [tipOnPreTax, setTipOnPreTax] = useState(false)
  const [taxRate, setTaxRate] = useState('8.25')
  const [rounding, setRounding] = useState<Rounding>('none')

  const billValue = parseNum(bill)
  const people = Math.min(999, Math.max(1, Math.round(num(peopleRaw, 1))))

  const result = useMemo(() => {
    if (billValue === null || billValue <= 0) return null

    const billD = D(billValue)
    const rate = Math.max(0, num(taxRate))
    const usePreTax = tipOnPreTax && rate > 0
    const tipBase = usePreTax ? billD.div(D(1).plus(D(rate).div(100))) : billD
    const taxPart = usePreTax ? billD.minus(tipBase) : D(0)

    let tip = tipBase.times(tipPct).div(100)
    let total = billD.plus(tip)

    if (rounding === 'tip-up') {
      tip = tip.ceil()
      total = billD.plus(tip)
    } else if (rounding === 'total-1') {
      total = total.ceil()
      tip = total.minus(billD)
    } else if (rounding === 'total-5') {
      total = total.div(5).ceil().times(5)
      tip = total.minus(billD)
    } else if (rounding === 'person-1') {
      total = total.div(people).ceil().times(people)
      tip = total.minus(billD)
    }

    const perPerson = total.div(people)
    const tipPerPerson = tip.div(people)
    const effective = billD.gt(0) ? tip.div(billD).times(100) : D(0)

    return {
      billD,
      tipBase,
      taxPart,
      usePreTax,
      tip: cents(tip),
      total: cents(total),
      perPerson: cents(perPerson),
      tipPerPerson: cents(tipPerPerson),
      effective: effective.toNumber(),
      exactPerPerson: perPerson,
    }
  }, [billValue, people, rounding, taxRate, tipOnPreTax, tipPct])

  const shares = useMemo(() => {
    if (!result || people < 2) return null
    // Distribute to whole cents without losing or inventing money.
    const base = result.exactPerPerson.toDecimalPlaces(2, Decimal.ROUND_DOWN)
    const list = Array.from({ length: people }, () => base)
    const residualCents = result.total.minus(base.times(people)).times(100).round().toNumber()
    return list.map((v, i) => (i < residualCents ? v.plus(0.01) : v))
  }, [people, result])

  const summary = result
    ? summaryLines([
        `Bill: ${money(result.billD, currency)}`,
        result.usePreTax
          ? `Pre-tax subtotal: ${money(result.tipBase, currency)} (tax ${money(result.taxPart, currency)})`
          : null,
        `Tip (${formatNumber(tipPct, 2)}%): ${money(result.tip, currency)}`,
        `Total: ${money(result.total, currency)}`,
        people > 1 ? `People: ${people}` : null,
        people > 1 ? `Each pays: ${money(result.perPerson, currency)}` : null,
        rounding === 'none' ? null : `Rounding: ${ROUNDING_LABEL[rounding]}`,
      ])
    : ''

  return (
    <div className="space-y-6">
      <ToolPanel title="The bill" description="Everything recalculates as you type.">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField
            label="Bill amount"
            value={bill}
            onChange={setBill}
            prefix={currency === 'USD' ? '$' : undefined}
            placeholder="0.00"
            invalid={bill.trim() !== '' && billValue === null}
            hint={
              bill.trim() !== '' && billValue === null ? 'That is not a number I can read.' : undefined
            }
          />
          <CurrencySelect value={currency} onChange={setCurrency} />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Label htmlFor="tip-slider">Tip percentage</Label>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatNumber(tipPct, 2)}%
            </span>
          </div>
          <PresetRow
            label="Common tip percentages"
            options={TIP_PRESETS}
            active={tipPct}
            onPick={setTipPct}
          />
          <Slider
            id="tip-slider"
            aria-label="Tip percentage"
            value={[tipPct]}
            min={0}
            max={40}
            step={0.5}
            onValueChange={(v) => setTipPct(clamp(v[0], 0, 40))}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>20%</span>
            <span>40%</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tip-people">Number of people</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="One fewer person"
              onClick={() => setPeopleRaw(String(Math.max(1, people - 1)))}
              disabled={people <= 1}
            >
              <Minus className="size-4" aria-hidden="true" />
            </Button>
            <NumField
              id="tip-people"
              label="Number of people"
              value={peopleRaw}
              onChange={setPeopleRaw}
              className="flex-1 [&>label]:sr-only"
              inputClassName="text-center"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="One more person"
              onClick={() => setPeopleRaw(String(Math.min(999, people + 1)))}
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel
        title="Tax handling and rounding"
        description="Optional. By default the tip is on the amount printed on the check."
      >
        <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
          <div className="min-w-0">
            <Label htmlFor="tip-pretax" className="text-sm font-medium">
              Tip on the pre-tax subtotal
            </Label>
            <p className="mt-1 text-xs text-pretty text-muted-foreground">
              Backs the sales tax out of the bill first, then tips on what is left.
            </p>
          </div>
          <Switch
            id="tip-pretax"
            checked={tipOnPreTax}
            onCheckedChange={setTipOnPreTax}
            aria-label="Tip on the pre-tax subtotal"
          />
        </div>

        {tipOnPreTax && (
          <NumField
            label="Sales tax already included in the bill"
            value={taxRate}
            onChange={setTaxRate}
            suffix="%"
            hint="Use the combined state plus local rate that appears on your receipt."
          />
        )}

        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">Rounding</span>
          <Segmented
            label="Rounding"
            value={rounding}
            onChange={setRounding}
            options={[
              { value: 'none', label: 'Exact' },
              { value: 'tip-up', label: 'Tip up' },
              { value: 'total-1', label: 'Total up' },
              { value: 'total-5', label: 'To 5' },
              { value: 'person-1', label: 'Share up' },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            {ROUNDING_LABEL[rounding]}
          </p>
        </div>
      </ToolPanel>

      <ToolPanel
        title="Result"
        footer={result ? <CopyButton value={summary} label="Copy the summary" /> : undefined}
      >
        {result ? (
          <div className="space-y-4">
            <StatGrid>
              <ResultStat
                label={people > 1 ? 'Each person pays' : 'Total to pay'}
                value={money(people > 1 ? result.perPerson : result.total, currency)}
                hint={
                  people > 1
                    ? `${people} people × ${money(result.perPerson, currency)}`
                    : 'Bill plus tip'
                }
                emphasis
              />
              <ResultStat
                label="Tip amount"
                value={money(result.tip, currency)}
                hint={`${formatNumber(result.effective, 2)}% of the bill as printed`}
              />
            </StatGrid>

            <Breakdown
              rows={[
                { label: 'Bill as printed', value: money(result.billD, currency) },
                ...(result.usePreTax
                  ? [
                      { label: 'Pre-tax subtotal (tip base)', value: money(result.tipBase, currency) },
                      { label: 'Sales tax inside the bill', value: money(result.taxPart, currency) },
                    ]
                  : []),
                { label: `Tip at ${formatNumber(tipPct, 2)}%`, value: money(result.tip, currency) },
                { label: 'Total', value: money(result.total, currency), strong: true },
                ...(people > 1
                  ? [
                      { label: 'Tip per person', value: money(result.tipPerPerson, currency) },
                      { label: 'Total per person', value: money(result.perPerson, currency), strong: true },
                    ]
                  : []),
              ]}
            />

            <Formula caption="The exact arithmetic behind the numbers above.">
              {[
                `tip base  = ${result.usePreTax ? `${money(result.billD, currency)} ÷ (1 + ${formatNumber(num(taxRate), 3)}%)` : 'bill'} = ${money(result.tipBase, currency)}`,
                `tip       = ${money(result.tipBase, currency)} × ${formatNumber(tipPct, 2)}% = ${money(result.tip, currency)}`,
                `total     = ${money(result.billD, currency)} + ${money(result.tip, currency)} = ${money(result.total, currency)}`,
                people > 1
                  ? `per head  = ${money(result.total, currency)} ÷ ${people} = ${money(result.perPerson, currency)}`
                  : '',
              ]
                .filter(Boolean)
                .join('\n')}
            </Formula>

            {shares && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Cent-exact split across {people} people
                </h3>
                <ScrollTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Person</TableHead>
                        <TableHead className="text-right">Pays</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shares.map((share, i) => (
                        <TableRow key={i}>
                          <TableCell>Person {i + 1}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money(share, currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollTable>
                <p className="text-xs text-muted-foreground">
                  A share that will not divide evenly leaves a remainder of a cent or two. Those odd
                  cents are handed to the first people in the list so the shares add up to exactly{' '}
                  {money(result.total, currency)}.
                </p>
              </div>
            )}

            {rounding !== 'none' && (
              <Note tone="success">
                Rounding changed the tip to {money(result.tip, currency)}, an effective{' '}
                {formatNumber(result.effective, 2)}% of the printed bill.
              </Note>
            )}
          </div>
        ) : (
          <EmptyState message="Enter a bill amount to see the tip, the total and what each person owes." />
        )}
      </ToolPanel>

      <ToolPanel title="Tip at a glance" description="Your bill at the most common percentages.">
        {billValue !== null && billValue > 0 ? (
          <ScrollTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tip</TableHead>
                  <TableHead className="text-right">Tip amount</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Per person</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[10, 12, 15, 18, 20, 22, 25, 30].map((p) => {
                  const base = result ? result.tipBase : D(billValue)
                  const t = cents(base.times(p).div(100))
                  const tot = cents(D(billValue).plus(t))
                  return (
                    <TableRow key={p} className={p === tipPct ? 'bg-background font-semibold' : undefined}>
                      <TableCell className="font-medium">{p}%</TableCell>
                      <TableCell className="text-right tabular-nums">{money(t, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(tot, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(cents(tot.div(people)), currency)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollTable>
        ) : (
          <EmptyState message="The comparison table fills in once there is a bill amount." />
        )}
      </ToolPanel>
    </div>
  )
}
