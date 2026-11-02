import { useEffect, useRef, useState } from 'react'
import { CalcLayout, Choice, NumField, Result, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { dot, label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { dayShare, solar } from './solar'
import type { SolarOut } from './solar'

type Per = 'day' | 'month'
/** The daylight part of the cycle lasts this long; 12 h of sun in 8 s. */
const DAY_S = 8
const NIGHT_S = 1.2
const FILL_S = 1.6
const M2_FT2 = 10.7639

export default function SolarPanels() {
  const [per, setPer] = useState<Per>('month')
  const f = useFields({ use: '900', sun: '5', derate: '80', panel: '400', area: '1.95' })
  const { use, sun, derate, panel, area } = f.num
  const pos = (v: number | null, what: string) => (v === null ? `Enter the ${what}.` : v <= 0 ? `The ${what} must be above zero.` : null)
  const err = {
    use: pos(use, 'electricity use'),
    sun: sun === null ? 'Enter the peak sun hours.' : sun <= 0 || sun > 12 ? 'Use 0.5 to 12 hours.' : null,
    derate: derate === null ? 'Enter the system efficiency.' : derate <= 0 || derate > 100 ? 'Use 1 to 100%.' : null,
    panel: pos(panel, 'panel rating'),
    area: pos(area, 'panel area'),
  }
  const ok = !Object.values(err).some(Boolean)
  const daily = ok ? (per === 'day' ? use! : (use! * 12) / 365) : 0
  const r: SolarOut | null = ok ? solar({ dailyKwh: daily, sunHours: sun!, derate: derate! / 100, panelW: panel!, panelArea: area! }) : null
  const tooMany = r !== null && r.panels > 400

  /* a day of sun over the roof */
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)
  useEffect(() => {
    t.current = 0
  }, [r?.panels])
  const paint = (reduced: boolean) => {
    const p = prepCanvas(canvas.current)
    if (!p || !r || tooMany) return
    drawDay(p.ctx, p.w, p.h, r, reduced ? FILL_S + DAY_S * 0.5 : t.current, ink)
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      t.current += dt
      if (t.current > FILL_S + DAY_S + NIGHT_S) t.current = FILL_S
      paint(false)
    },
    playing && r !== null && !tooMany,
  )
  useEffect(() => paint(reduced))

  const summary = r
    ? `${fmt(daily, 4)} kWh a day at ${fmt(sun!)} peak sun hours and ${fmt(derate!)}% efficiency needs ${dec(r.kw, 2)} kW of panels: ${r.panels} panels of ${fmt(panel!)} W, about ${fmt(r.area, 4)} m² of roof. The sun crosses the sky once per cycle and the counter adds up the day's output, ${fmt(r.dailyOut, 4)} kWh.`
    : 'Enter your electricity use and the sun hours.'

  return (
    <CalcLayout
      inputs={
        <>
          <Choice label="Electricity use per" value={per} onChange={setPer} options={[{ value: 'month', label: 'Month' }, { value: 'day', label: 'Day' }]} />
          <NumField label="Electricity use" {...f.bind('use')} unit="kWh" error={err.use} hint="From your bill. A US home uses about 900 kWh a month." />
          <NumField label="Peak sun hours" {...f.bind('sun')} unit="h" error={err.sun} slider={{ min: 2, max: 7, step: 0.1 }} />
          <NumField label="System efficiency (derate)" {...f.bind('derate')} unit="%" error={err.derate} />
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Panel rating" {...f.bind('panel')} unit="W" error={err.panel} />
            <NumField label="Panel area" {...f.bind('area')} unit="m²" error={err.area} />
          </div>
        </>
      }
      result={
        <Result
          label="Panels needed"
          value={r ? r.panels : '–'}
          format={(n) => String(Math.round(n))}
          unit={r ? `× ${fmt(panel!)} W` : undefined}
          sub={r ? `${dec(r.installedKw, 2)} kW system` : undefined}
          error={ok ? (tooMany ? 'That is more than 400 panels; check the electricity use.' : null) : Object.values(err).find(Boolean)}
          copy={r ? `${r.panels} panels of ${fmt(panel!)} W (${dec(r.installedKw, 2)} kW), ${fmt(r.area, 4)} m²` : undefined}
        >
          {r ? (
            <>
              <Stat label="System size needed" value={dec(r.kw, 2)} unit="kW" />
              <Stat label="Roof area" value={`${fmt(r.area, 4)} m², ${fmt(r.area * M2_FT2, 4)} ft²`} />
              <Stat label="Output per day" value={fmt(r.dailyOut, 4)} unit="kWh" />
              <Stat label="Output per year" value={Math.round(r.yearlyOut).toLocaleString('en-US')} unit="kWh" />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={r && !tooMany ? <SimBar playing={playing} onPlaying={setPlaying} scale="1 s shows 1.5 hours of daylight" reduced={reduced} /> : undefined}>
          <canvas ref={canvas} className="block aspect-[4/3] w-full sm:aspect-[16/10]" role="img" aria-label={r ? `${r.panels} solar panels on a roof under the sun` : 'Solar panels'} />
        </Stage>
      }
      working={
        r ? (
          <Working
            lines={[
              ...(per === 'month' ? [`daily use = ${num(use!)} kWh × 12 ÷ 365 = ${num(daily)} kWh`] : []),
              `system size = daily use ÷ (sun hours × derate) = ${num(daily)} ÷ (${num(sun!)} × ${num(derate! / 100)}) = ${num(r.kw)} kW`,
              `panels = ⌈${num(r.kw * 1000)} W ÷ ${num(panel!)} W⌉ = ${r.panels}`,
              `roof area = ${r.panels} × ${num(area!)} m² = ${num(r.area)} m²`,
              `yearly output = ${num(r.installedKw)} kW × ${num(sun!)} h × ${num(derate! / 100)} × 365 = ${num(r.yearlyOut)} kWh`,
            ]}
            caption="Peak sun hours are kWh of sunlight per m² per day. The derate covers heat, dust, wiring and inverter losses."
          />
        ) : null
      }
    />
  )
}

function drawDay(ctx: CanvasRenderingContext2D, w: number, h: number, r: SolarOut, t: number, ink: Ink) {
  const ground = h - 30
  // the house from the front: wall, roof plane, panels in a grid on the roof
  const rw = Math.min(w * 0.6, 380)
  const rx = (w - rw) / 2
  const eave = ground - Math.min(h * 0.2, 64)
  const ridge = eave - Math.min(h * 0.3, rw * 0.42)
  ctx.lineWidth = 2
  ctx.strokeStyle = ink.ink
  ctx.fillStyle = ink.paper
  ctx.fillRect(rx, eave, rw, ground - eave)
  ctx.strokeRect(rx, eave, rw, ground - eave)
  ctx.beginPath()
  ctx.moveTo(rx - 12, eave)
  ctx.lineTo(rx + rw * 0.16, ridge)
  ctx.lineTo(rx + rw * 0.84, ridge)
  ctx.lineTo(rx + rw + 12, eave)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(8, ground)
  ctx.lineTo(w - 8, ground)
  ctx.stroke()
  const ix = rx + rw * 0.2
  const iw = rw * 0.6
  const iy = ridge + 6
  const ih = eave - ridge - 12
  const cols = Math.max(1, Math.ceil(Math.sqrt((r.panels * iw) / ih)))
  const rows = Math.ceil(r.panels / cols)
  const cw = iw / cols
  const ch = ih / rows
  const shown = Math.min(r.panels, Math.floor((t / FILL_S) * r.panels + 1e-9))
  ctx.fillStyle = ink.ink
  for (let i = 0; i < shown; i++) {
    const c = i % cols
    const rr = rows - 1 - Math.floor(i / cols)
    ctx.fillRect(ix + c * cw + 1, iy + rr * ch + 1, Math.max(1, cw - 2), Math.max(1, ch - 2))
  }

  // the sun on its arc and the day's energy so far
  const day = Math.max(0, t - FILL_S)
  const f = Math.min(1, day / DAY_S)
  const up = day <= DAY_S
  const cx = w / 2
  const R = Math.min(w * 0.46, ground - 20)
  if (up) {
    const a = Math.PI * (1 - f)
    dot(ctx, cx + R * Math.cos(a), ground - R * Math.sin(a) * 0.82, 11, ink.ink)
  }
  const kwh = r.dailyOut * dayShare(f)
  const hour = 6 + 12 * f
  label(ctx, up ? `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}  ${dec(kwh, 1)} kWh` : `Night  ${dec(r.dailyOut, 1)} kWh today`, w / 2, h - 9, {
    color: ink.ink,
    halo: ink.fill,
    font: ink.font,
    size: 13,
    weight: 650,
    align: 'center',
  })
}
