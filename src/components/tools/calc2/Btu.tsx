import { useEffect, useRef, useState } from 'react'
import { CalcLayout, Choice, NumField, Result, Row, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { BTU_PER_W, INSULATION, cooling, heating } from './btu'
import type { Insulation, Sun } from './btu'

type Units = 'ft' | 'm'
const UNITS = [
  { value: 'ft', label: 'Feet, °F' },
  { value: 'm', label: 'Metres, °C' },
] as const
const SUN = [
  { value: 'shaded', label: 'Shaded' },
  { value: 'normal', label: 'Normal' },
  { value: 'sunny', label: 'Sunny' },
] as const
const USE = [
  { value: 'room', label: 'Bedroom or living' },
  { value: 'kitchen', label: 'Kitchen' },
] as const
const INSUL = [
  { value: 'good', label: 'Good' },
  { value: 'average', label: 'Average' },
  { value: 'poor', label: 'Poor' },
] as const
const FT = 0.3048

export default function Btu() {
  const f = useFields({ length: '20', width: '20', height: '8', people: '2', rise: '30' })
  const [units, setUnits] = useState<Units>('ft')
  const [sun, setSun] = useState<Sun>('normal')
  const [use, setUse] = useState<'room' | 'kitchen'>('room')
  const [insulation, setInsulation] = useState<Insulation>('average')

  const switchUnits = (u: Units) => {
    if (u === units) return
    const k = u === 'm' ? FT : 1 / FT
    const conv = (s: string, kk: number, dp: number) => {
      const n = Number(s)
      return Number.isFinite(n) && s.trim() !== '' ? String(Number((n * kk).toFixed(dp))) : s
    }
    f.setMany({ length: conv(f.raw.length, k, 2), width: conv(f.raw.width, k, 2), height: conv(f.raw.height, k, 2), rise: conv(f.raw.rise, u === 'm' ? 1 / 1.8 : 1.8, 1) })
    setUnits(u)
  }

  const { length, width, height, people, rise } = f.num
  const pos = (v: number | null, what: string) => (v === null ? `Enter the ${what}.` : v <= 0 ? `The ${what} must be above zero.` : null)
  const err = {
    length: pos(length, 'length'),
    width: pos(width, 'width'),
    height: pos(height, 'ceiling height'),
    people: people === null ? 'Enter a number.' : people < 0 || !Number.isInteger(people) ? 'Use a whole number.' : null,
    rise: rise === null ? 'Enter a temperature rise.' : rise < 0 ? 'The rise cannot be below zero.' : null,
  }
  const ok = !Object.values(err).some(Boolean)
  const toFt = units === 'm' ? 1 / FT : 1
  const areaFt2 = ok ? length! * width! * toFt * toFt : 0
  const volFt3 = ok ? areaFt2 * height! * toFt : 0
  const riseF = ok ? (units === 'm' ? rise! * 1.8 : rise!) : 0
  const c = ok ? cooling({ areaFt2, sun, people: people!, kitchen: use === 'kitchen' }) : null
  const heat = ok ? heating(volFt3, riseF, insulation) : 0
  const au = units === 'm' ? 'm²' : 'ft²'
  const area = ok ? length! * width! : 0

  const working = c
    ? [
        `area    = ${num(length!)} × ${num(width!)} = ${num(area)} ${au}${units === 'm' ? ` = ${num(areaFt2)} ft²` : ''}`,
        `base    = ${fmt(c.base)} BTU/h (ENERGY STAR row for ${num(areaFt2, 5)} ft²)`,
        `sun     = ${sun === 'normal' ? '0' : `${sun === 'sunny' ? '+' : '−'}10 % × ${fmt(c.base)} = ${sun === 'sunny' ? '+' : '−'}${fmt(Math.abs(c.sunAdj))}`}`,
        `people  = (${people} − 2) × 600 = ${fmt(c.peopleAdj)}${people! < 3 ? ' (none over two)' : ''}`,
        `kitchen = ${use === 'kitchen' ? '+4,000' : '0'}`,
        `cooling = ${fmt(c.base)} ${c.sunAdj < 0 ? '−' : '+'} ${fmt(Math.abs(c.sunAdj))} + ${fmt(c.peopleAdj)} + ${fmt(c.kitchenAdj)} = ${fmt(c.total)} BTU/h`,
        `heating = volume × ΔT × factor = ${num(volFt3)} ft³ × ${num(riseF, 4)} °F × ${INSULATION[insulation]} = ${fmt(Math.round(heat))} BTU/h`,
        `kW      = BTU/h ÷ 3,412.14: cooling ${num(c.total / BTU_PER_W / 1000, 4)} kW, heating ${num(heat / BTU_PER_W / 1000, 4)} kW`,
      ]
    : []

  const tooBig = ok && c === null

  return (
    <CalcLayout
      inputs={
        <>
          <Choice label="Units" value={units} onChange={switchUnits} options={UNITS} />
          <Row>
            <NumField label="Room length" {...f.bind('length')} unit={units} error={err.length} />
            <NumField label="Room width" {...f.bind('width')} unit={units} error={err.width} />
          </Row>
          <Row>
            <NumField label="Ceiling height" {...f.bind('height')} unit={units} error={err.height} />
            <NumField label="People in the room" {...f.bind('people')} inputMode="numeric" error={err.people} />
          </Row>
          <Choice label="Sun" value={sun} onChange={setSun} options={SUN} />
          <Choice label="Room use" value={use} onChange={setUse} options={USE} />
          <NumField
            label="Heating: temperature rise"
            {...f.bind('rise')}
            unit={units === 'm' ? '°C' : '°F'}
            error={err.rise}
            hint="Indoor temperature minus the coldest outdoor temperature"
          />
          <Choice label="Insulation" value={insulation} onChange={setInsulation} options={INSUL} />
        </>
      }
      result={
        <Result
          label="Air conditioner size"
          value={c ? c.total : '–'}
          format={(n) => fmt(Math.round(n))}
          unit={c ? 'BTU/h' : undefined}
          sub={c ? `${dec(c.total / BTU_PER_W / 1000, 2)} kW of cooling for ${dec(area, 1)} ${au}` : undefined}
          error={tooBig ? 'The ENERGY STAR table ends at 2,500 ft² (232 m²). A space this large needs a load calculation (Manual J).' : null}
          copy={c ? `Cooling ${fmt(Math.round(c.total))} BTU/h (${dec(c.total / BTU_PER_W / 1000, 2)} kW); heating about ${fmt(Math.round(heat))} BTU/h (${dec(heat / BTU_PER_W / 1000, 2)} kW)` : undefined}
        >
          {c ? (
            <>
              <Stat label="Table value" value={c.base} format={(n) => fmt(Math.round(n))} unit="BTU/h" />
              <Stat label="Sun" value={c.sunAdj} format={(n) => (n > 0 ? '+' : '') + fmt(Math.round(n))} />
              <Stat label="People over two" value={c.peopleAdj} format={(n) => '+' + fmt(Math.round(n))} />
              <Stat label="Kitchen" value={c.kitchenAdj} format={(n) => '+' + fmt(Math.round(n))} />
              <Stat label="Heating estimate" value={heat} format={(n) => fmt(Math.round(n))} unit="BTU/h" />
              <Stat label="Heating in kW" value={heat / BTU_PER_W / 1000} format={(n) => dec(n, 2)} unit="kW" />
            </>
          ) : null}
        </Result>
      }
      visual={
        <AirFlow
          btu={c?.total ?? 0}
          width={(width ?? 20) * toFt}
          height={(height ?? 8) * toFt}
          people={Math.min(8, people ?? 0)}
          sun={sun}
          kitchen={use === 'kitchen'}
          units={units}
          summary={
            c
              ? `A section through the room, to scale. The unit in the window blows cold air across the ceiling; the air moves faster as the capacity grows, here ${fmt(Math.round(c.total))} BTU/h. ${
                  sun === 'sunny' ? 'Sun falls on the window. ' : sun === 'shaded' ? 'A tree shades the window. ' : ''
                }${people ? `${people} ${people === 1 ? 'person is' : 'people are'} in the room.` : ''}`
              : 'Enter the room size to see the air flow.'
          }
        />
      }
      working={working.length ? <Working lines={working} caption="Cooling from the ENERGY STAR room air conditioner table. The heating factor (BTU/h per ft³ per °F) is a rule of thumb: 0.133 good, 0.2 average, 0.25 poor insulation." /> : null}
    />
  )
}

/* ── room section with circulating air ──────────────────────────── */

function AirFlow(props: { btu: number; width: number; height: number; people: number; sun: Sun; kitchen: boolean; units: Units; summary: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const phase = useRef(0)

  const paint = () => {
    const p = prepCanvas(canvas.current)
    if (p) drawRoom(p.ctx, p.w, p.h, ink, props, phase.current)
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      // laps of the room per second grow with the capacity
      phase.current = (phase.current + dt * 0.06 * (props.btu / 6000)) % 1
      paint()
    },
    playing && props.btu > 0,
  )
  // still frames and input changes repaint at once
  useEffect(() => {
    paint()
  })

  return (
    <Stage summary={props.summary} bar={<SimBar playing={playing} onPlaying={setPlaying} scale="Air speed follows the BTU" reduced={reduced} />}>
      <canvas ref={canvas} className="block aspect-[4/3] w-full sm:aspect-[16/10]" role="img" aria-label="Section through the room with the air flow" />
    </Stage>
  )
}

function drawRoom(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ink: Ink,
  s: { btu: number; width: number; height: number; people: number; sun: Sun; kitchen: boolean; units: Units },
  phase: number,
) {
  const pad = 26
  const k = Math.min((w - pad * 2 - 60) / s.width, (h - pad * 2) / s.height)
  const RW = s.width * k
  const RH = s.height * k
  const x0 = (w - RW) / 2 + 20
  const y0 = (h - RH) / 2
  const floor = y0 + RH

  // walls: thick ink lines, window on the left wall with the AC unit
  ctx.fillStyle = ink.paper
  ctx.fillRect(x0, y0, RW, RH)
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 3
  ctx.strokeRect(x0, y0, RW, RH)
  const winTop = y0 + RH * 0.28
  const winBot = y0 + RH * 0.62
  ctx.fillStyle = ink.fill
  ctx.fillRect(x0 - 3, winTop, 6, winBot - winTop)
  // AC unit sits in the window, part outside
  const acH = Math.max(12, (winBot - winTop) * 0.42)
  const acW = Math.max(18, acH * 1.4)
  ctx.fillStyle = ink.ink
  ctx.fillRect(x0 - acW * 0.45, winTop, acW, acH)
  ctx.fillStyle = ink.paper
  for (let i = 1; i < 4; i++) ctx.fillRect(x0 + acW * 0.55 - 3, winTop + (acH * i) / 4 - 0.75, 2, 1.5)

  // outside: sun or shade
  const font = ink.font
  if (s.sun === 'sunny') {
    const sx = x0 - 46
    const sy = y0 + 4
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(sx, sy, 9, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + phase * 2
      ctx.beginPath()
      ctx.moveTo(sx + Math.cos(a) * 13, sy + Math.sin(a) * 13)
      ctx.lineTo(sx + Math.cos(a) * 17, sy + Math.sin(a) * 17)
      ctx.stroke()
    }
  } else if (s.sun === 'shaded') {
    const tx = x0 - 40
    ctx.fillStyle = ink.grey
    ctx.beginPath()
    ctx.arc(tx, y0 + RH * 0.3, Math.min(22, RH * 0.2), 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(tx - 2, y0 + RH * 0.3, 4, RH * 0.7)
  }

  // kitchen: a stove against the far wall
  if (s.kitchen) {
    const sw = Math.min(30 / 12, s.width * 0.2) * k
    const sh = 3 * k
    ctx.fillStyle = ink.fill
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 1.5
    ctx.fillRect(x0 + RW - sw - 3, floor - sh, sw, sh)
    ctx.strokeRect(x0 + RW - sw - 3, floor - sh, sw, sh)
    label(ctx, 'stove', x0 + RW - sw / 2 - 3, floor - sh - 6, { color: ink.grey, halo: ink.paper, font, size: 10, align: 'center' })
  }

  // people, 5 ft 7 in tall, to scale
  const ph = (67 / 12) * k
  for (let i = 0; i < s.people; i++) {
    const px = x0 + RW * (0.3 + (0.45 * (i + 0.5)) / Math.max(1, s.people))
    const head = ph * 0.08
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(px, floor - ph + head, head, 0, Math.PI * 2)
    ctx.moveTo(px, floor - ph + head * 2)
    ctx.lineTo(px, floor - ph * 0.45)
    ctx.moveTo(px, floor - ph * 0.45)
    ctx.lineTo(px - ph * 0.1, floor)
    ctx.moveTo(px, floor - ph * 0.45)
    ctx.lineTo(px + ph * 0.1, floor)
    ctx.moveTo(px - ph * 0.12, floor - ph * 0.7)
    ctx.lineTo(px + ph * 0.12, floor - ph * 0.7)
    ctx.stroke()
  }

  // the air: streaks around a loop, out of the unit along the ceiling, down, back along the floor
  if (s.btu > 0) {
    const ix = x0 + acW * 0.6
    const iy = y0 + RH * 0.12
    const lx = x0 + RW - RW * 0.08
    const ly = floor - RH * 0.1
    const r = Math.min(RH * 0.25, RW * 0.15)
    const segs = loopPath(ix, iy, lx, ly, r)
    const total = segs.reduce((a, g) => a + g.len, 0)
    const n = 44
    ctx.strokeStyle = ink.ink
    ctx.lineCap = 'round'
    for (let i = 0; i < n; i++) {
      const u = (((i / n + phase) % 1) + 1) % 1
      const [x, y, tx, ty] = at(segs, u * total)
      const len = 5 + 7 * Math.min(1, s.btu / 18000)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x - tx * len, y - ty * len)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  // dimensions
  label(ctx, `${fmt(s.units === 'm' ? s.width * FT : s.width, 4)} ${s.units}`, x0 + RW / 2, floor + 18, { color: ink.grey, halo: ink.fill, font, size: 11, align: 'center' })
  ctx.save()
  ctx.translate(x0 + RW + 14, y0 + RH / 2)
  ctx.rotate(-Math.PI / 2)
  label(ctx, `${fmt(s.units === 'm' ? s.height * FT : s.height, 3)} ${s.units}`, 0, 0, { color: ink.grey, halo: ink.fill, font, size: 11, align: 'center' })
  ctx.restore()
}

interface Seg {
  /** Line from (x, y) by (dx, dy), or an arc around (x, y) of radius r from a0 by da. */
  kind: 'line' | 'arc'
  x: number
  y: number
  dx: number
  dy: number
  r: number
  a0: number
  da: number
  len: number
}

/** A rounded rectangle walked clockwise from its top-left straight edge. */
function loopPath(x1: number, y1: number, x2: number, y2: number, r: number): Seg[] {
  const line = (x: number, y: number, dx: number, dy: number): Seg => ({ kind: 'line', x, y, dx, dy, r: 0, a0: 0, da: 0, len: Math.hypot(dx, dy) })
  const arc = (x: number, y: number, a0: number): Seg => ({ kind: 'arc', x, y, dx: 0, dy: 0, r, a0, da: Math.PI / 2, len: (Math.PI / 2) * r })
  return [
    line(x1 + r, y1, x2 - x1 - 2 * r, 0),
    arc(x2 - r, y1 + r, -Math.PI / 2),
    line(x2, y1 + r, 0, y2 - y1 - 2 * r),
    arc(x2 - r, y2 - r, 0),
    line(x2 - r, y2, -(x2 - x1 - 2 * r), 0),
    arc(x1 + r, y2 - r, Math.PI / 2),
    line(x1, y2 - r, 0, -(y2 - y1 - 2 * r)),
    arc(x1 + r, y1 + r, Math.PI),
  ]
}

/** Point and unit tangent at distance d along the path. */
function at(segs: Seg[], d: number): [number, number, number, number] {
  let rest = d
  for (const g of segs) {
    if (rest <= g.len || g === segs[segs.length - 1]) {
      const f = g.len > 0 ? Math.min(1, rest / g.len) : 0
      if (g.kind === 'line') return [g.x + g.dx * f, g.y + g.dy * f, g.dx / (g.len || 1), g.dy / (g.len || 1)]
      const a = g.a0 + g.da * f
      return [g.x + Math.cos(a) * g.r, g.y + Math.sin(a) * g.r, -Math.sin(a), Math.cos(a)]
    }
    rest -= g.len
  }
  return [0, 0, 1, 0]
}
