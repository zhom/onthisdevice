import { useEffect, useMemo, useRef, useState } from 'react'
import { niceStep } from '@/components/viz/scale'
import { CalcLayout, Choice, NumField, Result, SelectField, SimBar, Stage, Stat, UnitField, Working, useFields } from './_viz/Calc'
import { dot, label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { timeScale } from './_viz/sim'
import { LENGTH, unitOptions } from './_viz/units'
import { fallen, fromHeight, fromTime } from './freefall'
import type { Fall } from './freefall'
import { WORLDS, gravityOf } from './gravity'
import type { World } from './gravity'

type Mode = 'height' | 'time'
type LenU = 'm' | 'ft'
const LENGTHS = unitOptions(LENGTH, ['m', 'ft'])
const HOLD = 1.2

export default function FreeFall() {
  const [mode, setMode] = useState<Mode>('height')
  const f = useFields({ h: '20', t: '2' })
  const [lu, setLu] = useState<LenU>('m')
  const [world, setWorld] = useState<World>('earth')
  const g = gravityOf(world)

  const err = {
    h: f.num.h === null ? 'Enter a height.' : f.num.h <= 0 ? 'The height must be above zero.' : null,
    t: f.num.t === null ? 'Enter a time.' : f.num.t <= 0 ? 'The time must be above zero.' : null,
  }
  const fall: Fall | null = useMemo(() => {
    if (mode === 'height') return err.h ? null : fromHeight(f.num.h! * LENGTH[lu], g)
    return err.t ? null : fromTime(f.num.t!, g)
  }, [mode, f.num.h, f.num.t, lu, g, err.h, err.t])
  const L = (m: number) => m / LENGTH[lu]
  const scale = timeScale(fall?.t ?? 1, 0.6, 8)
  const step = fall ? niceStep(fall.t, 8) : 1

  /* simulation */
  const canvas = useRef<HTMLCanvasElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)
  const hold = useRef(0)
  useEffect(() => {
    t.current = 0
    hold.current = 0
  }, [fall])

  const paint = () => {
    if (!fall) return
    const p = prepCanvas(canvas.current)
    if (p) drawFall(p.ctx, p.w, p.h, fall, g, t.current, hold.current, step, ink, lu)
    if (clock.current) clock.current.textContent = `t = ${dec(t.current, 2)} s · v = ${dec(g * t.current, 1)} m/s`
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      if (!fall) return
      if (t.current >= fall.t) {
        hold.current += dt
        if (hold.current > HOLD) {
          t.current = 0
          hold.current = 0
        }
      } else t.current = Math.min(fall.t, t.current + dt * scale.factor)
      paint()
    },
    playing && fall !== null,
  )
  useEffect(() => {
    if (reduced && fall) {
      t.current = fall.t
      hold.current = HOLD
    }
    paint()
  })

  const summary = fall
    ? `Dropped from rest, the body falls ${dec(L(fall.h), 2)} ${lu} in ${dec(fall.t, 3)} s and hits the ground at ${dec(fall.v, 2)} m/s (${dec(fall.v * 3.6, 1)} km/h). The grey dots mark where it was every ${fmt(step, 3)} s: the gaps grow because it keeps speeding up. Drawn to scale against the height.`
    : 'Enter a height or a time to see the fall.'

  const working = fall
    ? mode === 'height'
      ? [
          ...(lu !== 'm' ? [`h = ${num(f.num.h!)} ft = ${num(fall.h)} m`] : []),
          `t = √(2h ÷ g) = √(2 × ${num(fall.h)} ÷ ${num(g)}) = ${num(fall.t)} s`,
          `v = g × t = ${num(g)} × ${num(fall.t)} = ${num(fall.v)} m/s`,
          `v = √(2gh) = √(2 × ${num(g)} × ${num(fall.h)}) = ${num(fall.v)} m/s`,
        ]
      : [
          `h = ½ g t² = 0.5 × ${num(g)} × ${num(fall.t)}² = ${num(fall.h)} m`,
          `v = g × t = ${num(g)} × ${num(fall.t)} = ${num(fall.v)} m/s`,
        ]
    : []

  return (
    <CalcLayout
      inputs={
        <>
          <Choice
            label="Start from"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'height', label: 'Height' },
              { value: 'time', label: 'Time' },
            ]}
          />
          {mode === 'height' ? (
            <UnitField label="Drop height" {...f.bind('h')} unit={lu} units={LENGTHS} onUnit={setLu} error={err.h} />
          ) : (
            <NumField label="Fall time" {...f.bind('t')} unit="s" error={err.t} />
          )}
          <SelectField label="Gravity" value={world} onChange={setWorld} options={WORLDS} />
        </>
      }
      result={
        <Result
          label={mode === 'height' ? 'Fall time' : 'Distance fallen'}
          value={fall ? (mode === 'height' ? fall.t : L(fall.h)) : '–'}
          format={(n) => dec(n, 3)}
          unit={mode === 'height' ? 's' : lu}
          sub={fall ? `Impact speed ${dec(fall.v, 2)} m/s` : undefined}
          copy={fall ? `Fall time ${dec(fall.t, 3)} s, height ${dec(L(fall.h), 3)} ${lu}, impact speed ${dec(fall.v, 3)} m/s` : undefined}
        >
          {fall ? (
            <>
              <Stat label="Impact speed" value={fall.v * 3.6} format={(n) => dec(n, 1)} unit="km/h" />
              <Stat label="Impact speed" value={fall.v / 0.44704} format={(n) => dec(n, 1)} unit="mph" />
              <Stat label="Average speed" value={fall.avg} format={(n) => dec(n, 2)} unit="m/s" />
              {mode === 'height' ? (
                <Stat label="Fallen in the first second" value={L(fallen(g, Math.min(1, fall.t)))} format={(n) => dec(n, 2)} unit={lu} />
              ) : (
                <Stat label="Height" value={L(fall.h)} format={(n) => dec(n, 2)} unit={lu} />
              )}
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={<SimBar playing={playing} onPlaying={setPlaying} onReplay={() => { t.current = 0; hold.current = 0; paint() }} scale={scale.label} reduced={reduced} clock={clock} />}>
          <canvas ref={canvas} className="block aspect-[4/5] w-full sm:aspect-[5/4]" role="img" aria-label={fall ? `Body falling ${dec(L(fall.h), 2)} ${lu} in ${dec(fall.t, 2)} s` : 'Free fall'} />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="From rest, no air resistance. g is the gravity in m/s²." /> : null}
    />
  )
}

function drawFall(ctx: CanvasRenderingContext2D, w: number, h: number, fall: Fall, g: number, time: number, hold: number, step: number, ink: Ink, lu: LenU) {
  const top = 22
  const bottom = h - 30
  const span = bottom - top
  const k = span / fall.h
  const x = Math.min(w * 0.42, 180)
  const y = (d: number) => top + d * k
  const lab = { color: ink.grey, halo: ink.fill, font: ink.font, size: 11 }

  // height scale on the left
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(26, top)
  ctx.lineTo(26, bottom)
  ctx.stroke()
  const conv = LENGTH[lu]
  const hs = niceStep(fall.h / conv, 4)
  for (let v = 0; v <= fall.h / conv + 1e-9; v += hs) {
    const yy = bottom - v * conv * k
    ctx.beginPath()
    ctx.moveTo(22, yy)
    ctx.lineTo(30, yy)
    ctx.stroke()
    label(ctx, `${fmt(v, 4)}`, 34, yy + 4, lab)
  }
  label(ctx, lu, 34, top - 8, lab)

  // ground
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(16, bottom + 8)
  ctx.lineTo(w - 16, bottom + 8)
  ctx.stroke()

  // ghosts at equal time steps, shown once passed
  const now = Math.min(time, fall.t)
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y(0), 9, 0, Math.PI * 2)
  ctx.stroke()
  for (let s = step; s < fall.t - step * 0.35; s += step) {
    if (s > now) break
    const d = 0.5 * g * s * s
    dot(ctx, x, y(d), 6, ink.grey)
    label(ctx, `${fmt(s, 3)} s`, x + 16, y(d) + 4, lab)
  }

  // the body
  const d = 0.5 * g * now * now
  dot(ctx, x, Math.min(y(d), bottom + 8 - 9), 9, ink.ink)

  // impact ring
  if (time >= fall.t && hold > 0) {
    const r = 10 + Math.min(1, hold / 0.5) * 26
    ctx.strokeStyle = ink.ink
    ctx.globalAlpha = Math.max(0, 1 - hold / 0.6)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(x, bottom + 8, r, r * 0.3, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    label(ctx, `${dec(fall.t, 2)} s, ${dec(fall.v, 1)} m/s`, x + 16, bottom - 6, { ...lab, color: ink.ink, size: 12, weight: 650 })
  }
}
