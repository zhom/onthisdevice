import { useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { BarList } from '@/components/viz'
import { Button } from '@/components/ui/button'
import { CalcLayout, NumField, Result, SelectField, Stat, Working } from './_viz/Calc'
import { dec, fixed, fmt, num, parseNum } from './_viz/format'
import { UNITS, compare, perBase } from './unitprice'
import type { Item, Unit } from './unitprice'

interface Row {
  id: number
  price: string
  qty: string
  unit: Unit
  count: string
}
const UNIT_OPTIONS = (Object.keys(UNITS) as Unit[]).map((u) => ({ value: u, label: u === 'item' ? 'items' : u }))
/** How to show a price per base unit: per kg, per L or per item. */
const SHOW = { g: { k: 1000, name: 'kg' }, mL: { k: 1000, name: 'L' }, item: { k: 1, name: 'item' } } as const

export default function UnitPrice() {
  const [rows, setRows] = useState<Row[]>([
    { id: 1, price: '3.99', qty: '500', unit: 'g', count: '1' },
    { id: 2, price: '6.49', qty: '1', unit: 'kg', count: '1' },
    { id: 3, price: '2.50', qty: '12', unit: 'oz', count: '1' },
  ])
  const nextId = useRef(4)
  const edit = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const name = (i: number) => String.fromCharCode(65 + i)

  const parsed = rows.map((r) => {
    const price = parseNum(r.price)
    const qty = parseNum(r.qty)
    const count = parseNum(r.count)
    const error =
      price === null || price < 0 ? 'Enter a price.' : qty === null || qty <= 0 ? 'Enter the amount in the pack.' : count === null || count < 1 || !Number.isInteger(count) ? 'Use a whole number of packs.' : null
    return { r, error, item: error ? null : ({ price: price!, qty: qty!, unit: r.unit, count: count! } satisfies Item) }
  })
  const bases = new Set(rows.map((r) => UNITS[r.unit].base))
  const mixed = bases.size > 1 ? 'Compare packs measured the same way: all by weight, all by volume or all by count.' : null
  const firstError = parsed.find((p) => p.error)?.error ?? mixed
  const ok = !firstError && parsed.length >= 2
  const items = ok ? parsed.map((p) => p.item!) : []
  const cmp = ok ? compare(items) : null
  const base = UNITS[rows[0]!.unit].base
  const show = SHOW[base]
  const per = (i: Item) => perBase(i) * show.k
  const money = (v: number) => (v < 0.1 ? `$${fixed(v, 4)}` : `$${fixed(v, 2)}`)

  return (
    <CalcLayout
      inputs={
        <>
          {rows.map((r, i) => (
            <fieldset key={r.id} className="space-y-2">
              <legend className="mb-2 flex w-full items-center justify-between text-sm font-[600]">
                <span>Pack {name(i)}</span>
                {rows.length > 2 ? (
                  <Button variant="ghost" size="sm" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} aria-label={`Remove pack ${name(i)}`}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : null}
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Price" value={r.price} onChange={(v) => edit(r.id, { price: v })} unit="$" />
                <NumField label="Packs" value={r.count} onChange={(v) => edit(r.id, { count: v })} inputMode="numeric" />
                <NumField label="Amount in a pack" value={r.qty} onChange={(v) => edit(r.id, { qty: v })} />
                <SelectField label="Unit" value={r.unit} onChange={(u) => edit(r.id, { unit: u })} options={UNIT_OPTIONS} />
              </div>
            </fieldset>
          ))}
          {rows.length < 6 ? (
            <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => setRows((rs) => [...rs, { id: nextId.current++, price: '', qty: '', unit: rs[0]!.unit, count: '1' }])}>
              <Plus aria-hidden="true" />
              Add a pack
            </Button>
          ) : null}
        </>
      }
      result={
        <Result
          label="Best value"
          value={cmp ? `Pack ${name(cmp.best)}` : '–'}
          sub={cmp ? `${money(per(items[cmp.best]!))} per ${show.name}` : undefined}
          error={ok ? null : (firstError ?? 'Enter at least two packs.')}
          copy={cmp ? items.map((it, i) => `Pack ${name(i)}: ${money(per(it))} per ${show.name}`).join('; ') : undefined}
        >
          {cmp
            ? items.map((it, i) => (
                <Stat key={i} label={`Pack ${name(i)}`} value={`${money(per(it))} per ${show.name}${i === cmp.best ? '' : `, +${dec(cmp.extra[i]! * 100, 1)}%`}`} />
              ))
            : null}
        </Result>
      }
      visual={
        cmp ? (
          <div className="rounded-xl bg-card p-4 sm:p-5">
            <BarList
              items={items.map((it, i) => ({ label: `Pack ${name(i)}`, note: `${fmt(it.qty * it.count)} ${it.unit} for $${fixed(it.price, 2)}`, value: per(it), highlight: i === cmp.best }))}
              formatValue={money}
              summary={`Price per ${show.name} for each pack. Pack ${name(cmp.best)} is the cheapest; ${items
                .map((_, i) => (i === cmp.best ? null : `${name(i)} costs ${dec(cmp.extra[i]! * 100, 1)}% more`))
                .filter(Boolean)
                .join(', ')} for the same amount.`}
            />
          </div>
        ) : null
      }
      working={
        cmp ? (
          <Working
            lines={[
              ...items.map((it, i) => `${name(i)}: $${fixed(it.price, 2)} ÷ (${num(it.qty)} ${it.unit} × ${it.count}) = ${money(per(it))} per ${show.name}`),
              `cheapest: pack ${name(cmp.best)}`,
            ]}
            caption="Each amount is converted to grams, millilitres or items first; 1 oz = 28.35 g, 1 lb = 453.6 g, 1 fl oz = 29.57 mL."
          />
        ) : null
      }
    />
  )
}
