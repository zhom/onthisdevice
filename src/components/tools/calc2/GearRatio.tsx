import { useEffect, useRef, useState } from 'react'
import { CalcLayout, Choice, NumField, Result, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { meshPhase, ratioText, train } from './gears'

type Idler = 'none' | 'idler'
const IDLER_TEETH = 14
const SLOW = [1, 2, 4, 5, 10, 20, 50, 100, 200, 500, 1000]

interface Gear {
  z: number
  x: number
  /** Angle at t = 0 and turns per input turn (signed). */
  phase: number
  k: number
  rpm: number
  name: string
  paint: 'ink' | 'grey' | 'paper'
}

export default function GearRatio() {
  const f = useFields({ driver: '20', driven: '60', rpm: '30', torque: '10' })
  const [idler, setIdler] = useState<Idler>('none')
  const { driver, driven, rpm, torque } = f.num
  const teeth = (v: number | null) => (v === null || !Number.isInteger(v) || v < 6 || v > 200 ? 'Use a whole number of teeth from 6 to 200.' : null)
  const err = {
    driver: teeth(driver),
    driven: teeth(driven),
    rpm: rpm === null ? 'Enter the input speed.' : rpm < 0 || rpm > 100000 ? 'Use 0 to 100,000 rpm.' : null,
    torque: torque === null ? 'Enter the input torque, or 0.' : torque < 0 ? 'Use a torque of 0 or more.' : null,
  }
  const ok = !Object.values(err).some(Boolean)
  const t = ok ? train(driver!, driven!, rpm!, torque!, idler === 'idler') : null

  // gears in a row, pitch radius proportional to the teeth
  const gears: Gear[] = []
  if (ok) {
    const zA = driver!
    const zD = driven!
    gears.push({ z: zA, x: 0, phase: 0, k: 1, rpm: rpm!, name: 'Driver', paint: 'ink' })
    if (idler === 'idler') {
      const zI = IDLER_TEETH
      const xI = (zA + zI) / 2
      const pI = meshPhase(zA, 0, zI)
      gears.push({ z: zI, x: xI, phase: pI, k: -zA / zI, rpm: (rpm! * zA) / zI, name: 'Idler', paint: 'paper' })
      gears.push({ z: zD, x: xI + (zI + zD) / 2, phase: meshPhase(zI, pI, zD), k: zA / zD, rpm: t!.outRpm, name: 'Driven', paint: 'grey' })
    } else {
      gears.push({ z: zD, x: (zA + zD) / 2, phase: meshPhase(zA, 0, zD), k: -zA / zD, rpm: t!.outRpm, name: 'Driven', paint: 'grey' })
    }
  }
  const fastest = Math.max(0, ...gears.map((g) => g.rpm)) / 60
  const slow = SLOW.find((s) => fastest / s <= 0.6) ?? 1000
  const scale = slow === 1 ? 'Real time' : `Slowed ${slow}×`

  /* simulation */
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const angle = useRef(0)
  const paint = () => {
    const p = prepCanvas(canvas.current)
    if (p && gears.length) drawGears(p.ctx, p.w, p.h, gears, angle.current, ink)
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      angle.current += (dt * 2 * Math.PI * (rpm ?? 0)) / 60 / slow
      paint()
    },
    playing && ok && (rpm ?? 0) > 0,
  )
  useEffect(() => paint())

  const summary = t
    ? `The ${driver} tooth driver turns at ${fmt(rpm!)} rpm and drives the ${driven} tooth gear${idler === 'idler' ? ` through a ${IDLER_TEETH} tooth idler` : ''}. The output turns at ${fmt(t.outRpm, 5)} rpm, ${t.sameDirection ? 'the same way as' : 'the opposite way to'} the input, with ${fmt(t.outTorque, 5)} N·m of torque. Each gear has a mark so you can count its turns.`
    : 'Enter the teeth and the input speed to see the gears.'

  return (
    <CalcLayout
      inputs={
        <>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Driver teeth" {...f.bind('driver')} inputMode="numeric" error={err.driver} />
            <NumField label="Driven teeth" {...f.bind('driven')} inputMode="numeric" error={err.driven} />
          </div>
          <NumField label="Input speed" {...f.bind('rpm')} unit="rpm" error={err.rpm} />
          <NumField label="Input torque" {...f.bind('torque')} unit="N·m" error={err.torque} />
          <Choice label="Between them" value={idler} onChange={setIdler} options={[{ value: 'none', label: 'Direct mesh' }, { value: 'idler', label: 'An idler gear' }]} />
        </>
      }
      result={
        <Result
          label="Gear ratio"
          value={t ? ratioText(driver!, driven!) : '–'}
          sub={t ? (t.ratio > 1 ? `Reduction: ${dec(t.ratio, 4)} times slower, ${dec(t.ratio, 4)} times the torque` : t.ratio < 1 ? `Overdrive: ${dec(1 / t.ratio, 4)} times faster` : 'Same speed and torque') : undefined}
          error={ok ? null : Object.values(err).find(Boolean)}
          copy={t ? `Ratio ${ratioText(driver!, driven!)}, output ${fmt(t.outRpm, 6)} rpm, ${fmt(t.outTorque, 6)} N·m` : undefined}
        >
          {t ? (
            <>
              <Stat label="Output speed" value={t.outRpm} format={(n) => fmt(n, 5)} unit="rpm" />
              <Stat label="Output torque" value={t.outTorque} format={(n) => fmt(n, 5)} unit="N·m" />
              <Stat label="Output direction" value={t.sameDirection ? 'Same as input' : 'Reversed'} />
              <Stat label="Power" value={fmt((torque! * rpm! * 2 * Math.PI) / 60, 5)} unit="W" />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={t ? <SimBar playing={playing} onPlaying={setPlaying} scale={scale} reduced={reduced} /> : undefined}>
          <canvas ref={canvas} className="block aspect-[4/3] w-full sm:aspect-[16/10]" role="img" aria-label={t ? `Gears ${driver} and ${driven} teeth, ratio ${ratioText(driver!, driven!)}` : 'Gears'} />
        </Stage>
      }
      working={
        t ? (
          <Working
            lines={[
              `ratio  = driven teeth ÷ driver teeth = ${driven} ÷ ${driver} = ${num(t.ratio)}`,
              `output speed  = input speed ÷ ratio = ${num(rpm!)} ÷ ${num(t.ratio)} = ${num(t.outRpm)} rpm`,
              `output torque = input torque × ratio = ${num(torque!)} × ${num(t.ratio)} = ${num(t.outTorque)} N·m`,
              ...(idler === 'idler' ? [`the idler (${IDLER_TEETH} teeth) reverses the direction and does not change the ratio`] : []),
            ]}
            caption="No friction losses. Power in equals power out: speed falls as torque rises."
          />
        ) : null
      }
    />
  )
}

function gearPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, z: number, m: number, a0: number) {
  const r = (m * z) / 2
  const ra = r + m
  const rf = r - 1.25 * m
  const p = (2 * Math.PI) / z
  ctx.beginPath()
  for (let i = 0; i < z; i++) {
    const c = a0 + i * p
    const pts: [number, number][] = [
      [rf, c - p * 0.5],
      [rf, c - p * 0.3],
      [ra, c - p * 0.16],
      [ra, c + p * 0.16],
      [rf, c + p * 0.3],
    ]
    for (const [rad, a] of pts) {
      const x = cx + rad * Math.cos(a)
      const y = cy + rad * Math.sin(a)
      if (i === 0 && a === c - p * 0.5) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
  }
  ctx.closePath()
}

function drawGears(ctx: CanvasRenderingContext2D, w: number, h: number, gears: Gear[], theta: number, ink: Ink) {
  const first = gears[0]!
  const last = gears[gears.length - 1]!
  const left = first.x - first.z / 2 - 1
  const right = last.x + last.z / 2 + 1
  const tall = Math.max(...gears.map((g) => g.z)) + 2
  const m = Math.min((w - 24) / (right - left), (h - 56) / tall)
  const ox = (w - (right - left) * m) / 2 - left * m
  const cy = (h - 22) / 2
  for (const g of gears) {
    const cx = ox + g.x * m
    const a = g.phase + g.k * theta
    gearPath(ctx, cx, cy, g.z, m, -a)
    ctx.fillStyle = g.paint === 'ink' ? ink.ink : g.paint === 'grey' ? ink.grey : ink.paper
    ctx.fill()
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 1.5
    ctx.stroke()
    // hub and a mark to count turns
    const hub = Math.max(4, g.z * m * 0.08)
    ctx.fillStyle = ink.fill
    ctx.beginPath()
    ctx.arc(cx, cy, hub, 0, Math.PI * 2)
    ctx.fill()
    const mr = (g.z * m) / 2 - 2.6 * m
    ctx.beginPath()
    ctx.arc(cx + mr * Math.cos(-a), cy + mr * Math.sin(-a), Math.max(3, m * 0.8), 0, Math.PI * 2)
    ctx.fillStyle = g.paint === 'paper' ? ink.ink : ink.paper
    ctx.fill()
    label(ctx, `${g.z} teeth, ${fmt(g.rpm, 4)} rpm`, cx, cy + (tall * m) / 2 + 18, { color: ink.ink, halo: ink.fill, font: ink.font, size: 12, align: 'center' })
  }
}
