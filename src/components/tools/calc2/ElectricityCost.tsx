import { useEffect, useId, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BarList } from '@/components/viz/BarList'
import { formatCurrency } from '@/lib/utils'
import { CalcLayout, NumField, Result, Row, SelectField, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { label } from './_viz/draw'
import { dec, fmt, num, parseNum } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { KH, applianceCost, discRevPerSecond, totalCost } from './electricity'

interface Item {
  id: number
  name: string
  watts: string
  hours: string
  qty: string
}

const CURRENCIES = [
  { value: 'USD', label: 'US dollar' },
  { value: 'EUR', label: 'Euro' },
  { value: 'GBP', label: 'Pound sterling' },
  { value: 'CAD', label: 'Canadian dollar' },
  { value: 'AUD', label: 'Australian dollar' },
  { value: 'INR', label: 'Indian rupee' },
] as const

let nextId = 3

export default function ElectricityCost() {
  const f = useFields({ price: '0.15', days: '30' })
  const [currency, setCurrency] = useState<string>('USD')
  const [rows, setRows] = useState<Item[]>([
    { id: 1, name: 'Space heater', watts: '1500', hours: '3', qty: '1' },
    { id: 2, name: 'LED bulbs', watts: '10', hours: '5', qty: '4' },
  ])
  const edit = (id: number, patch: Partial<Item>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const money = (n: number, dp = 2) => formatCurrency(n, currency, dp)
  const { price, days } = f.num
  const err = {
    price: price === null ? 'Enter your price per kWh.' : price < 0 ? 'The price cannot be below zero.' : null,
    days: days === null ? 'Enter the number of days.' : days <= 0 ? 'Use at least one day.' : null,
  }
  const parsed = rows.map((r) => {
    const watts = parseNum(r.watts)
    const hours = parseNum(r.hours)
    const qty = parseNum(r.qty)
    const e = {
      watts: watts === null ? 'Enter watts.' : watts < 0 ? 'Not below zero.' : null,
      hours: hours === null ? 'Enter hours.' : hours < 0 || hours > 24 ? 'Use 0 to 24.' : null,
      qty: qty === null ? 'Enter a number.' : qty < 0 || !Number.isInteger(qty) ? 'Whole number.' : null,
    }
    return { row: r, ok: !e.watts && !e.hours && !e.qty, e, a: { watts: watts ?? 0, hours: hours ?? 0, quantity: qty ?? 0 } }
  })
  const valid = parsed.filter((p) => p.ok)
  const ok = !err.price && !err.days && valid.length > 0
  const total = ok ? totalCost(valid.map((p) => p.a), days!, price!) : null
  const load = valid.reduce((s, p) => s + p.a.watts * p.a.quantity, 0)

  const working = total
    ? [
        ...valid.map((p) => {
          const c = applianceCost(p.a, days!, price!)
          return `${(p.row.name || 'Appliance').padEnd(14)} ${num(p.a.watts)} W × ${num(p.a.hours)} h × ${num(p.a.quantity)} ÷ 1,000 = ${num(c.kwhDay, 5)} kWh/day`
        }),
        `per day   = ${num(total.kwhDay, 5)} kWh × ${num(price!)} = ${money(total.costDay)}`,
        `${days} days   = ${num(total.kwhDay, 5)} × ${num(days!)} = ${num(total.kwhPeriod, 5)} kWh × ${num(price!)} = ${money(total.costPeriod)}`,
        `per year  = ${num(total.kwhDay, 5)} × 365 × ${num(price!)} = ${money(total.costYear)}`,
      ]
    : []

  const bars = total
    ? valid.map((p, i) => ({ label: `${i + 1}. ${p.row.name || 'Appliance'}`, value: applianceCost(p.a, days!, price!).costPeriod }))
    : []
  const topBar = bars.reduce((m, b) => (b.value > m.value ? b : m), bars[0] ?? { label: '', value: 0 })

  return (
    <CalcLayout
      inputs={
        <>
          <ul className="space-y-5">
            {parsed.map((p, i) => (
              <ApplianceRow
                key={p.row.id}
                index={i}
                row={p.row}
                errors={p.e}
                onChange={(patch) => edit(p.row.id, patch)}
                onRemove={rows.length > 1 ? () => setRows((rs) => rs.filter((r) => r.id !== p.row.id)) : undefined}
              />
            ))}
          </ul>
          <div>
            <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { id: nextId++, name: '', watts: '100', hours: '1', qty: '1' }])}>
              <Plus aria-hidden="true" />
              Add an appliance
            </Button>
          </div>
          <Row>
            <NumField label="Price per kWh" {...f.bind('price')} error={err.price} />
            <NumField label="Days in the period" {...f.bind('days')} unit="days" error={err.days} />
          </Row>
          <SelectField label="Currency" value={currency} onChange={setCurrency} options={CURRENCIES} />
        </>
      }
      result={
        <Result
          label={`Cost for ${days ?? '–'} days`}
          value={total ? total.costPeriod : '–'}
          format={(n) => money(n)}
          sub={total ? `${dec(total.kwhPeriod, 1)} kWh at ${money(price!, 3)} per kWh` : undefined}
          error={valid.length === 0 ? 'Enter at least one appliance with watts, hours and a quantity.' : null}
          copy={total ? `${money(total.costDay)} per day, ${money(total.costPeriod)} for ${days} days, ${money(total.costYear)} per year (${dec(total.kwhDay, 2)} kWh per day)` : undefined}
        >
          {total ? (
            <>
              <Stat label="Per day" value={total.costDay} format={(n) => money(n)} />
              <Stat label="Per year" value={total.costYear} format={(n) => money(n, 0)} />
              <Stat label="Energy per day" value={total.kwhDay} format={(n) => dec(n, 2)} unit="kWh" />
              <Stat label="Energy per year" value={total.kwhDay * 365} format={(n) => fmt(Math.round(n))} unit="kWh" />
              <Stat label="Load, all on at once" value={load} format={(n) => fmt(Math.round(n))} unit="W" />
            </>
          ) : null}
        </Result>
      }
      visual={
        <div className="space-y-8">
          <Meter watts={total ? load : 0} />
          {total && bars.length > 1 ? (
            <div className="rounded-xl bg-card p-4 sm:p-5">
              <BarList
                items={bars.map((b) => ({ ...b, highlight: b === topBar }))}
                formatValue={(v) => money(v)}
                summary={`Cost of each appliance for ${days} days. ${topBar.label.replace(/^\d+\. /, '')} costs the most: ${money(topBar.value)}.`}
                columns={['Appliance', `Cost for ${days} days`]}
                table
              />
            </div>
          ) : null}
        </div>
      }
      working={working.length ? <Working lines={working} caption="kWh = watts × hours × quantity ÷ 1,000. The year is 365 days." /> : null}
    />
  )
}

function ApplianceRow({
  index,
  row,
  errors,
  onChange,
  onRemove,
}: {
  index: number
  row: Item
  errors: { watts: string | null; hours: string | null; qty: string | null }
  onChange: (patch: Partial<Item>) => void
  onRemove?: () => void
}) {
  const id = useId()
  return (
    <li className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor={id}>Appliance {index + 1}</Label>
          <Input id={id} value={row.name} placeholder="Name" onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        {onRemove ? (
          <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove appliance ${index + 1}${row.name ? `, ${row.name}` : ''}`}>
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumField label="Power" value={row.watts} onChange={(v) => onChange({ watts: v })} unit="W" error={errors.watts} />
        <NumField label="Use per day" value={row.hours} onChange={(v) => onChange({ hours: v })} unit="h" error={errors.hours} />
        <NumField label="How many" value={row.qty} onChange={(v) => onChange({ qty: v })} inputMode="numeric" error={errors.qty} />
      </div>
    </li>
  )
}

/* ── the meter disc, turning at the true rate ───────────────────── */

function Meter({ watts }: { watts: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const angle = useRef(0.6)
  const turns = useRef(0)
  const rps = discRevPerSecond(watts)

  const paint = () => {
    const p = prepCanvas(canvas.current)
    if (p) drawMeter(p.ctx, p.w, p.h, ink, angle.current, watts)
    if (clock.current) clock.current.textContent = `${fmt(turns.current)} turn${turns.current === 1 ? '' : 's'}`
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      const before = angle.current
      angle.current += dt * rps * Math.PI * 2
      if (Math.floor(angle.current / (Math.PI * 2)) > Math.floor(before / (Math.PI * 2))) turns.current += 1
      paint()
    },
    playing && watts > 0,
  )
  useEffect(() => {
    paint()
  })

  const period = rps > 0 ? 1 / rps : Infinity
  return (
    <Stage
      summary={
        watts > 0
          ? `An electricity meter with a Kh of ${KH} watt-hours per turn. With all the appliances on (${fmt(Math.round(watts))} W) the disc turns ${dec(rps * 3600, 1)} times an hour, once every ${period < 60 ? `${dec(period, 1)} s` : `${dec(period / 60, 1)} min`}. The drawing turns at that true rate.`
          : 'Enter an appliance to turn the meter.'
      }
      bar={<SimBar playing={playing} onPlaying={setPlaying} scale="Real time" reduced={reduced} clock={clock} />}
    >
      <canvas ref={canvas} className="block aspect-[4/3] w-full sm:aspect-[16/10]" role="img" aria-label={`Meter disc turning once every ${dec(period, 1)} seconds`} />
    </Stage>
  )
}

function drawMeter(ctx: CanvasRenderingContext2D, w: number, h: number, ink: Ink, angle: number, watts: number) {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.42
  const font = ink.font

  // glass cover and face
  ctx.fillStyle = ink.paper
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.strokeStyle = ink.hairline
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, R - 7, 0, Math.PI * 2)
  ctx.stroke()

  // five register dials
  const dr = R * 0.12
  const reading = [0, 4, 2, 7, 5]
  for (let i = 0; i < 5; i++) {
    const x = cx + (i - 2) * dr * 2.5
    const y = cy - R * 0.38
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(x, y, dr, 0, Math.PI * 2)
    ctx.stroke()
    const dir = i % 2 === 0 ? 1 : -1
    const a = -Math.PI / 2 + dir * ((reading[i]! + 0.5) / 10) * Math.PI * 2
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * dr * 0.8, y + Math.sin(a) * dr * 0.8)
    ctx.stroke()
  }
  label(ctx, 'kWh', cx, cy - R * 0.12, { color: ink.grey, halo: ink.paper, font, size: 11, align: 'center' })
  label(ctx, `Kh ${KH}`, cx, cy + R * 0.62, { color: ink.grey, halo: ink.paper, font, size: 11, align: 'center' })

  // the disc, seen edge on through a slot
  const sw = R * 1.3
  const sh = Math.max(14, R * 0.16)
  const sy = cy + R * 0.22
  ctx.fillStyle = ink.fill
  ctx.fillRect(cx - sw / 2, sy - sh / 2, sw, sh)
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 1
  ctx.strokeRect(cx - sw / 2, sy - sh / 2, sw, sh)
  const rx = sw * 0.46
  const edge = Math.max(4, sh * 0.32)
  ctx.fillStyle = ink.grey
  ctx.fillRect(cx - rx, sy - edge / 2, rx * 2, edge)
  // the black mark on the rim: visible on the front half only, foreshortened near the sides
  const s = Math.sin(angle)
  if (s > 0) {
    const x = cx - Math.cos(angle) * rx
    const mw = Math.max(1, 12 * s)
    ctx.fillStyle = ink.ink
    ctx.fillRect(x - mw / 2, sy - edge / 2 - 1, mw, edge + 2)
  }
  label(ctx, watts > 0 ? `${fmt(Math.round(watts))} W` : 'No load', cx, sy + sh / 2 + 18, { color: ink.ink, halo: ink.paper, font, size: 12, weight: 650, align: 'center' })
}
