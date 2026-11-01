import { useMemo, useRef, useState } from 'react'
import Decimal from 'decimal.js'
import { Plus, Trash2, Users } from 'lucide-react'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { CopyButton } from '@/components/shared/CopyButton'
import { Formula } from '@/components/shared/Formula'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  PresetRow,
  ScrollTable,
  Segmented,
  StatGrid,
  cents,
  money,
  num,
  summaryLines,
  useCurrency,
} from './common'

interface Person {
  id: string
  name: string
}

interface Item {
  id: string
  name: string
  price: string
  assigned: string[]
}

type TaxMode = 'percent' | 'amount'
type TipBase = 'subtotal' | 'with-tax'

const TIP_PRESETS = [
  { value: 0, label: 'None' },
  { value: 10, label: '10%' },
  { value: 15, label: '15%' },
  { value: 18, label: '18%' },
  { value: 20, label: '20%' },
  { value: 25, label: '25%' },
]

/**
 * Spread exact shares over whole cents so the parts add up to the target
 * exactly (largest-remainder method).
 */
function allocate(exact: Decimal[], target: Decimal): Decimal[] {
  if (exact.length === 0) return []
  const floored = exact.map((e) => e.toDecimalPlaces(2, Decimal.ROUND_DOWN))
  const sum = floored.reduce((a, b) => a.plus(b), D(0))
  let remaining = target.minus(sum).times(100).round().toNumber()
  const order = exact
    .map((e, i) => ({ i, frac: e.minus(floored[i]).toNumber() }))
    .sort((a, b) => b.frac - a.frac)
  const out = floored.slice()
  let k = 0
  while (remaining > 0) {
    const idx = order[k % order.length].i
    out[idx] = out[idx].plus(0.01)
    remaining--
    k++
  }
  while (remaining < 0) {
    const idx = order[order.length - 1 - (k % order.length)].i
    out[idx] = out[idx].minus(0.01)
    remaining++
    k++
  }
  return out
}

export default function BillSplitCalculator() {
  const [currency, setCurrency] = useCurrency()
  const [mode, setMode] = useState('even')

  /* ---- shared charge settings ---- */
  const [taxMode, setTaxMode] = useState<TaxMode>('percent')
  const [taxValue, setTaxValue] = useState('8.25')
  const [tipPct, setTipPct] = useState(18)
  const [tipBase, setTipBase] = useState<TipBase>('subtotal')

  /* ---- even split ---- */
  const [evenSubtotal, setEvenSubtotal] = useState('120.00')
  const [evenPeople, setEvenPeople] = useState('4')

  /* ---- itemised ---- */
  const idRef = useRef(100)
  const nextId = () => `x${idRef.current++}`
  const [people, setPeople] = useState<Person[]>([
    { id: 'p1', name: 'Alex' },
    { id: 'p2', name: 'Bailey' },
    { id: 'p3', name: 'Casey' },
  ])
  const [items, setItems] = useState<Item[]>([
    { id: 'i1', name: 'Margherita pizza', price: '18.00', assigned: ['p1'] },
    { id: 'i2', name: 'Sharing platter', price: '24.50', assigned: ['p1', 'p2', 'p3'] },
    { id: 'i3', name: 'Pasta', price: '16.00', assigned: ['p2'] },
    { id: 'i4', name: 'Two cocktails', price: '21.00', assigned: ['p3'] },
  ])

  const taxRate = taxMode === 'percent' ? Math.max(0, num(taxValue)) : 0

  /* ---------------- even split ---------------- */
  const evenResult = useMemo(() => {
    const subtotal = D(Math.max(0, num(evenSubtotal)))
    const headcount = Math.min(999, Math.max(1, Math.round(num(evenPeople, 1))))
    if (subtotal.lte(0)) return null
    const tax = taxMode === 'percent' ? subtotal.times(taxRate).div(100) : D(Math.max(0, num(taxValue)))
    const base = tipBase === 'with-tax' ? subtotal.plus(tax) : subtotal
    const tip = base.times(tipPct).div(100)
    const total = cents(subtotal.plus(tax).plus(tip))
    const shares = allocate(
      Array.from({ length: headcount }, () => total.div(headcount)),
      total,
    )
    return { subtotal, tax: cents(tax), tip: cents(tip), total, headcount, shares }
  }, [evenPeople, evenSubtotal, taxMode, taxRate, taxValue, tipBase, tipPct])

  /* ---------------- itemised split ---------------- */
  const itemised = useMemo(() => {
    const priced = items.map((it) => ({ ...it, value: D(Math.max(0, num(it.price))) }))
    const subtotal = priced.reduce((a, it) => a.plus(it.value), D(0))
    const unassigned = priced.filter((it) => it.assigned.length === 0 && it.value.gt(0))
    if (subtotal.lte(0) || people.length === 0) return null

    const tax = taxMode === 'percent' ? subtotal.times(taxRate).div(100) : D(Math.max(0, num(taxValue)))
    const base = tipBase === 'with-tax' ? subtotal.plus(tax) : subtotal
    const tip = base.times(tipPct).div(100)
    const grand = subtotal.plus(tax).plus(tip)

    const perPerson = people.map((p) => {
      const own = priced.filter((it) => it.assigned.includes(p.id))
      const personSubtotal = own.reduce(
        (a, it) => a.plus(it.value.div(it.assigned.length)),
        D(0),
      )
      const weight = subtotal.gt(0) ? personSubtotal.div(subtotal) : D(0)
      return {
        person: p,
        items: own.map((it) => ({
          name: it.name.trim() || 'Item',
          share: it.value.div(it.assigned.length),
          split: it.assigned.length,
        })),
        subtotal: personSubtotal,
        tax: tax.times(weight),
        tip: tip.times(weight),
        exact: personSubtotal.plus(tax.times(weight)).plus(tip.times(weight)),
      }
    })

    const totals = allocate(
      perPerson.map((p) => p.exact),
      cents(grand),
    )

    return {
      subtotal,
      tax: cents(tax),
      tip: cents(tip),
      grand: cents(grand),
      unassigned,
      rows: perPerson.map((p, i) => ({ ...p, total: totals[i] })),
    }
  }, [items, people, taxMode, taxRate, taxValue, tipBase, tipPct])

  /* ---------------- actions ---------------- */
  const addPerson = () => {
    const id = nextId()
    setPeople((prev) => [...prev, { id, name: `Person ${prev.length + 1}` }])
  }
  const removePerson = (id: string) => {
    setPeople((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== id)))
    setItems((prev) => prev.map((it) => ({ ...it, assigned: it.assigned.filter((a) => a !== id) })))
  }
  const addItem = () => {
    setItems((prev) => [...prev, { id: nextId(), name: '', price: '', assigned: [] }])
  }
  const updateItem = (id: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }
  const toggleAssign = (itemId: string, personId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              assigned: it.assigned.includes(personId)
                ? it.assigned.filter((a) => a !== personId)
                : [...it.assigned, personId],
            }
          : it,
      ),
    )
  }

  const summary =
    mode === 'even'
      ? evenResult
        ? summaryLines([
            `Subtotal: ${money(evenResult.subtotal, currency)}`,
            `Tax: ${money(evenResult.tax, currency)}`,
            `Tip (${tipPct}%): ${money(evenResult.tip, currency)}`,
            `Total: ${money(evenResult.total, currency)}`,
            `Split ${evenResult.headcount} ways:`,
            ...evenResult.shares.map((s, i) => `  Person ${i + 1}: ${money(s, currency)}`),
          ])
        : ''
      : itemised
        ? summaryLines([
            `Subtotal: ${money(itemised.subtotal, currency)}`,
            `Tax: ${money(itemised.tax, currency)}`,
            `Tip (${tipPct}%): ${money(itemised.tip, currency)}`,
            `Total: ${money(itemised.grand, currency)}`,
            '',
            ...itemised.rows.map(
              (r) => `${r.person.name || 'Person'}: ${money(r.total, currency)}`,
            ),
          ])
        : ''

  const chargeControls = (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">Tax entered as</span>
          <Segmented
            label="Tax entered as"
            value={taxMode}
            onChange={setTaxMode}
            options={[
              { value: 'percent', label: 'A percentage' },
              { value: 'amount', label: 'A fixed amount' },
            ]}
          />
        </div>
        <NumField
          label={taxMode === 'percent' ? 'Sales tax rate' : 'Tax charged'}
          value={taxValue}
          onChange={setTaxValue}
          suffix={taxMode === 'percent' ? '%' : undefined}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-foreground">Tip</span>
          <span className="text-sm font-semibold tabular-nums">{formatNumber(tipPct, 2)}%</span>
        </div>
        <PresetRow label="Tip percentage" options={TIP_PRESETS} active={tipPct} onPick={setTipPct} />
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Custom tip %" value={String(tipPct)} onChange={(v) => setTipPct(num(v))} suffix="%" />
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">Tip calculated on</span>
            <Segmented
              label="Tip calculated on"
              value={tipBase}
              onChange={setTipBase}
              options={[
                { value: 'subtotal', label: 'Pre-tax' },
                { value: 'with-tax', label: 'Post-tax' },
              ]}
            />
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className="space-y-6">
      <Tabs value={mode} onValueChange={setMode} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="even">Split evenly</TabsTrigger>
          <TabsTrigger value="items">Split by item</TabsTrigger>
        </TabsList>

        {/* ------------------------------ EVEN ------------------------------ */}
        <TabsContent value="even" className="mt-6 space-y-6">
          <ToolPanel title="The bill">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumField
                label="Subtotal before tax"
                value={evenSubtotal}
                onChange={setEvenSubtotal}
                placeholder="0.00"
              />
              <NumField label="Number of people" value={evenPeople} onChange={setEvenPeople} />
              <CurrencySelect value={currency} onChange={setCurrency} />
            </div>
            {chargeControls}
          </ToolPanel>

          <ToolPanel
            title="Everyone owes"
            footer={evenResult ? <CopyButton value={summary} label="Copy the split" /> : undefined}
          >
            {evenResult ? (
              <div className="space-y-4">
                <StatGrid>
                  <ResultStat
                    label="Each person pays"
                    value={money(evenResult.shares[0], currency)}
                    hint={`${evenResult.headcount} people sharing ${money(evenResult.total, currency)}`}
                    emphasis
                  />
                  <ResultStat
                    label="Bill total"
                    value={money(evenResult.total, currency)}
                    hint="Subtotal plus tax plus tip"
                  />
                </StatGrid>
                <Breakdown
                  rows={[
                    { label: 'Subtotal', value: money(evenResult.subtotal, currency) },
                    { label: 'Tax', value: money(evenResult.tax, currency) },
                    { label: `Tip (${formatNumber(tipPct, 2)}%)`, value: money(evenResult.tip, currency) },
                    { label: 'Total', value: money(evenResult.total, currency), strong: true },
                  ]}
                />
                <ScrollTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Person</TableHead>
                        <TableHead className="text-right">Pays</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evenResult.shares.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell>Person {i + 1}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(s, currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollTable>
                <Formula caption="An even split still has to land on whole cents. The odd cents go to the first payers.">
                  {[
                    `tax    = ${money(evenResult.subtotal, currency)} × ${taxMode === 'percent' ? `${formatNumber(taxRate, 3)}%` : 'fixed'} = ${money(evenResult.tax, currency)}`,
                    `tip    = ${tipBase === 'with-tax' ? 'subtotal + tax' : 'subtotal'} × ${formatNumber(tipPct, 2)}% = ${money(evenResult.tip, currency)}`,
                    `total  = ${money(evenResult.total, currency)}`,
                    `share  = ${money(evenResult.total, currency)} ÷ ${evenResult.headcount} = ${money(evenResult.shares[0], currency)}`,
                  ].join('\n')}
                </Formula>
              </div>
            ) : (
              <EmptyState message="Enter a subtotal above and the even split appears here." />
            )}
          </ToolPanel>
        </TabsContent>

        {/* ---------------------------- ITEMISED ---------------------------- */}
        <TabsContent value="items" className="mt-6 space-y-6">
          <ToolPanel
            title="Who is at the table?"
            description="Names are only used to label the columns."
            footer={
              <Button type="button" variant="outline" size="sm" onClick={addPerson} className="gap-2">
                <Plus className="size-4" aria-hidden="true" />
                Add person
              </Button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {people.map((p, i) => (
                <div key={p.id} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor={`person-${p.id}`}>Person {i + 1}</Label>
                    <Input
                      id={`person-${p.id}`}
                      value={p.name}
                      autoComplete="off"
                      placeholder={`Person ${i + 1}`}
                      onChange={(e) =>
                        setPeople((prev) =>
                          prev.map((q) => (q.id === p.id ? { ...q, name: e.target.value } : q)),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${p.name || `person ${i + 1}`}`}
                    disabled={people.length <= 1}
                    onClick={() => removePerson(p.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <CurrencySelect value={currency} onChange={setCurrency} className="w-full sm:w-64" />
            </div>
          </ToolPanel>

          <ToolPanel
            title="Items on the check"
            description="Tap the names to say who shared each item. Anything shared is divided equally between the people you tap."
            footer={
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-2">
                <Plus className="size-4" aria-hidden="true" />
                Add item
              </Button>
            }
          >
            {items.length === 0 ? (
              <EmptyState message="No items yet. Add the first line from the check." />
            ) : (
              <ul className="space-y-3">
                {items.map((it, index) => (
                  <li key={it.id} className="rounded-lg bg-muted p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Label htmlFor={`item-name-${it.id}`}>Item {index + 1}</Label>
                        <Input
                          id={`item-name-${it.id}`}
                          value={it.name}
                          autoComplete="off"
                          placeholder="What was it?"
                          onChange={(e) => updateItem(it.id, { name: e.target.value })}
                        />
                      </div>
                      <NumField
                        id={`item-price-${it.id}`}
                        label="Price"
                        value={it.price}
                        onChange={(v) => updateItem(it.id, { price: v })}
                        placeholder="0.00"
                        className="w-full sm:w-32"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove item ${index + 1}`}
                        onClick={() => setItems((prev) => prev.filter((q) => q.id !== it.id))}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Shared by:</span>
                      {people.map((p) => {
                        const on = it.assigned.includes(p.id)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleAssign(it.id, p.id)}
                            className={cn(
                              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                              on
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {p.name || 'Person'}
                          </button>
                        )
                      })}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1.5 px-2 text-xs"
                        onClick={() =>
                          updateItem(it.id, {
                            assigned:
                              it.assigned.length === people.length ? [] : people.map((p) => p.id),
                          })
                        }
                      >
                        <Users className="size-3.5" aria-hidden="true" />
                        {it.assigned.length === people.length ? 'Clear' : 'Everyone'}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ToolPanel>

          <ToolPanel title="Tax and tip">{chargeControls}</ToolPanel>

          <ToolPanel
            title="What each person owes"
            footer={itemised ? <CopyButton value={summary} label="Copy the split" /> : undefined}
          >
            {itemised ? (
              <div className="space-y-4">
                {itemised.unassigned.length > 0 && (
                  <Note tone="warning">
                    {itemised.unassigned.length} item
                    {itemised.unassigned.length === 1 ? ' is' : 's are'} not assigned to anybody, so{' '}
                    {itemised.unassigned.length === 1 ? 'its' : 'their'} cost is still in the bill
                    total but nobody is paying for it. Tap a name on{' '}
                    {itemised.unassigned.map((u) => u.name.trim() || 'the unnamed item').join(', ')}.
                  </Note>
                )}

                <StatGrid>
                  <ResultStat
                    label="Bill total"
                    value={money(itemised.grand, currency)}
                    hint={`${money(itemised.subtotal, currency)} + ${money(itemised.tax, currency)} tax + ${money(itemised.tip, currency)} tip`}
                    emphasis
                  />
                  <ResultStat
                    label="Assigned to people"
                    value={money(
                      itemised.rows.reduce((a, r) => a.plus(r.total), D(0)),
                      currency,
                    )}
                    hint="Sum of every personal total below"
                  />
                </StatGrid>

                <div className="grid gap-3 sm:grid-cols-2">
                  {itemised.rows.map((row) => (
                    <div key={row.person.id} className="rounded-lg bg-card p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="truncate font-semibold text-foreground">
                          {row.person.name || 'Person'}
                        </h3>
                        <span className="text-lg font-bold tabular-nums text-primary">
                          {money(row.total, currency)}
                        </span>
                      </div>
                      {row.items.length === 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">Nothing assigned yet.</p>
                      ) : (
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {row.items.map((it, i) => (
                            <li key={i} className="flex justify-between gap-3">
                              <span className="truncate">
                                {it.name}
                                {it.split > 1 ? ` (÷${it.split})` : ''}
                              </span>
                              <span className="tabular-nums">{money(cents(it.share), currency)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <dl className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Their items</dt>
                          <dd className="tabular-nums">{money(cents(row.subtotal), currency)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Share of tax</dt>
                          <dd className="tabular-nums">{money(cents(row.tax), currency)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Share of tip</dt>
                          <dd className="tabular-nums">{money(cents(row.tip), currency)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>

                <Formula caption="Tax and tip follow the money: each person carries the same fraction of them as they do of the food.">
                  {[
                    `subtotal = ${money(itemised.subtotal, currency)}`,
                    `tax      = ${money(itemised.tax, currency)}`,
                    `tip      = ${money(itemised.tip, currency)}`,
                    `share_i  = items_i + tax × (items_i ÷ subtotal) + tip × (items_i ÷ subtotal)`,
                  ].join('\n')}
                </Formula>
              </div>
            ) : (
              <EmptyState message="Add at least one priced item to see who owes what." />
            )}
          </ToolPanel>
        </TabsContent>
      </Tabs>
    </div>
  )
}
