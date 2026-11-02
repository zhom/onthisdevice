import { useEffect, useMemo, useRef, useState } from 'react'
import { niceDomain } from '@/components/viz/scale'
import { CalcLayout, NumField, Result, SelectField, SimBar, Stage, Stat, UnitField, Working, useFields } from './_viz/Calc'
import { arrow, dashed, dot, fitEqual, label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { G0, timeScale } from './_viz/sim'
import { LENGTH, SPEED, unitOptions } from './_viz/units'
import { flight, stateAt } from './projectile'
import type { Flight, Launch } from './projectile'

type SpeedU = 'm/s' | 'km/h' | 'mph' | 'ft/s'
type LenU = 'm' | 'ft'
type World = 'earth' | 'moon' | 'mars' | 'jupiter'

const WORLDS: { value: World; label: string; g: number }[] = [
  { value: 'earth', label: 'Earth, 9.807 m/s²', g: G0 },
  { value: 'moon', label: 'Moon, 1.62 m/s²', g: 1.62 },
  { value: 'mars', label: 'Mars, 3.71 m/s²', g: 3.71 },
  { value: 'jupiter', label: 'Jupiter, 24.79 m/s²', g: 24.79 },
]
const SPEEDS = unitOptions(SPEED, ['m/s', 'km/h', 'mph', 'ft/s'])
const LENGTHS = unitOptions(LENGTH, ['m', 'ft'])
const HOLD = 1.2

export default function ProjectileMotion() {
  const f = useFields({ v: '20', angle: '45', h: '0' })
  const [vu, setVu] = useState<SpeedU>('m/s')
  const [lu, setLu] = useState<LenU>('m')
  const [world, setWorld] = useState<World>('earth')
  const g = WORLDS.find((w) => w.value === world)?.g ?? G0

  const { v, angle, h } = f.num
  const err = {
    v: v === null ? 'Enter a speed.' : v <= 0 ? 'The speed must be above zero.' : null,
    angle: angle === null ? 'Enter an angle.' : angle < -90 || angle > 90 ? 'Use an angle from −90° to 90°.' : null,
    h: h === null ? 'Enter a height, or 0.' : h < 0 ? 'The height cannot be below zero.' : null,
  }
  const launch: Launch | null =
    v !== null && angle !== null && h !== null && !err.v && !err.angle && !err.h ? { v0: v * SPEED[vu], angle, h0: h * LENGTH[lu], g } : null
  const noFlight = launch !== null && launch.h0 === 0 && launch.angle <= 0
  const fl = useMemo(() => (launch && !noFlight ? flight(launch) : null), [launch?.v0, launch?.angle, launch?.h0, launch?.g, noFlight])

  const L = (m: number) => m / LENGTH[lu]
  const S = (ms: number) => ms / SPEED[vu]
  const scale = timeScale(fl?.time ?? 1)

  /* simulation */
  const canvas = useRef<HTMLCanvasElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)
  const hold = useRef(0)

  const paint = (time: number) => {
    if (!launch || !fl) return
    const p = prepCanvas(canvas.current)
    if (p) drawScene(p.ctx, p.w, p.h, launch, fl, time, ink, lu)
    if (clock.current) clock.current.textContent = `t = ${dec(Math.min(time, fl.time), 2)} s`
  }

  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      if (!fl) return
      if (t.current >= fl.time) {
        hold.current += dt
        if (hold.current > HOLD) {
          t.current = 0
          hold.current = 0
        }
      } else t.current = Math.min(fl.time, t.current + dt * scale.factor)
      paint(t.current)
    },
    playing && fl !== null,
  )

  useEffect(() => {
    t.current = 0
    hold.current = 0
  }, [fl])

  useEffect(() => {
    if (!fl) return
    if (reduced) t.current = fl.tPeak > 0 ? fl.tPeak : fl.time / 2
    paint(t.current)
  })

  const replay = () => {
    t.current = 0
    hold.current = 0
    paint(0)
  }

  const unitL = lu
  const summary = fl
    ? `Launched at ${fmt(S(launch!.v0), 4)} ${vu} and ${fmt(launch!.angle, 4)}° from ${fmt(L(launch!.h0), 4)} ${unitL}, the body rises to ${dec(L(fl.peak), 2)} ${unitL}, lands ${dec(L(fl.range), 2)} ${unitL} away after ${dec(fl.time, 2)} s and hits the ground at ${dec(S(fl.impactSpeed), 2)} ${vu}. The ink arrow is the velocity; the grey arrows are its horizontal and vertical parts. The path is drawn to scale.`
    : 'Enter a speed, an angle and a height to see the path.'

  const working = fl && launch
    ? [
        ...(vu !== 'm/s' ? [`v  = ${num(v!)} ${vu} = ${num(launch.v0)} m/s`] : []),
        ...(lu !== 'm' && launch.h0 > 0 ? [`h  = ${num(h!)} ft = ${num(launch.h0)} m`] : []),
        `vx = v cos θ = ${num(launch.v0)} × cos ${num(launch.angle)}° = ${num(fl.vx)} m/s`,
        `vy = v sin θ = ${num(launch.v0)} × sin ${num(launch.angle)}° = ${num(fl.vy)} m/s`,
        `t  = (vy + √(vy² + 2gh)) ÷ g`,
        `   = (${num(fl.vy)} + √(${num(fl.vy)}² + 2 × ${num(g)} × ${num(launch.h0)})) ÷ ${num(g)} = ${num(fl.time)} s`,
        `R  = vx × t = ${num(fl.vx)} × ${num(fl.time)} = ${num(fl.range)} m`,
        fl.vy > 0
          ? `H  = h + vy² ÷ 2g = ${num(launch.h0)} + ${num(fl.vy)}² ÷ (2 × ${num(g)}) = ${num(fl.peak)} m`
          : `H  = h = ${num(launch.h0)} m (launched level or downward)`,
        `vimpact = √(vx² + (vy − g t)²) = ${num(fl.impactSpeed)} m/s at ${num(fl.impactAngle, 4)}° below level`,
      ]
    : []

  return (
    <CalcLayout
      inputs={
        <>
          <UnitField label="Launch speed" {...f.bind('v')} unit={vu} units={SPEEDS} onUnit={setVu} error={err.v} />
          <NumField label="Launch angle" {...f.bind('angle')} unit="°" slider={{ min: 0, max: 90, step: 1 }} error={err.angle} hint="Above the horizontal. Negative throws downward." />
          <UnitField label="Launch height" {...f.bind('h')} unit={lu} units={LENGTHS} onUnit={setLu} error={err.h} />
          <SelectField label="Gravity" value={world} onChange={setWorld} options={WORLDS} />
        </>
      }
      result={
        <Result
          label="Horizontal distance (range)"
          value={fl ? L(fl.range) : '–'}
          format={(n) => dec(n, 2)}
          unit={fl ? unitL : undefined}
          sub={fl ? `Lands after ${dec(fl.time, 2)} s` : undefined}
          error={noFlight ? 'With no launch height, the angle must be above 0° for the body to fly.' : undefined}
          copy={fl ? `Range ${dec(L(fl.range), 3)} ${unitL}, time of flight ${dec(fl.time, 3)} s, maximum height ${dec(L(fl.peak), 3)} ${unitL}` : undefined}
        >
          {fl ? (
            <>
              <Stat label="Maximum height" value={L(fl.peak)} format={(n) => dec(n, 2)} unit={unitL} />
              <Stat label="Time to the top" value={fl.tPeak} format={(n) => dec(n, 2)} unit="s" />
              <Stat label="Impact speed" value={S(fl.impactSpeed)} format={(n) => dec(n, 2)} unit={vu} />
              <Stat label="Impact angle" value={fl.impactAngle} format={(n) => dec(n, 1)} unit="°" />
              <Stat label="Horizontal speed" value={S(fl.vx)} format={(n) => dec(n, 2)} unit={vu} />
              <Stat label="Initial vertical speed" value={S(fl.vy)} format={(n) => dec(n, 2)} unit={vu} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage
          summary={summary}
          bar={<SimBar playing={playing} onPlaying={setPlaying} onReplay={replay} scale={scale.label} reduced={reduced} clock={clock} />}
        >
          <canvas
            ref={canvas}
            className="block aspect-[4/3] w-full sm:aspect-[16/10]"
            role="img"
            aria-label={fl ? `Projectile path: range ${dec(L(fl.range), 2)} ${unitL}, peak ${dec(L(fl.peak), 2)} ${unitL}` : 'Projectile path'}
          />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="SI units, no air resistance. θ is the launch angle, h the launch height, g the gravity." /> : null}
    />
  )
}

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, l: Launch, f: Flight, time: number, ink: Ink, lu: LenU) {
  const conv = LENGTH[lu]
  const span = Math.max(f.range, 1e-6)
  const top = Math.max(f.peak, l.h0, span * 0.02)
  const x1 = span * 1.08
  const y1 = top * 1.22
  const fit = fitEqual(0, x1, 0, y1, w, h, [28, 56, 30, 22])
  const gy = fit.y(0)

  // ground and scale ticks
  ctx.fillStyle = ink.fill
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(fit.x(0) - 12, gy)
  ctx.lineTo(fit.x(x1), gy)
  ctx.stroke()
  const ticks = niceDomain(0, x1 / conv, 4).ticks.filter((v) => v * conv <= x1)
  for (const v of ticks) {
    const x = fit.x(v * conv)
    ctx.beginPath()
    ctx.moveTo(x, gy)
    ctx.lineTo(x, gy + 4)
    ctx.stroke()
    label(ctx, `${fmt(v, 4)} ${lu}`, x, gy + 17, { color: ink.grey, halo: ink.fill, font: ink.font, size: 11, align: 'center' })
  }

  // launch platform
  if (l.h0 > 0) {
    ctx.fillStyle = ink.grey
    ctx.fillRect(fit.x(0) - 10, fit.y(l.h0), 10, gy - fit.y(l.h0))
  }

  // the whole path, faint, then the part flown so far
  const N = 96
  ctx.save()
  ctx.setLineDash([3, 5])
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 1.25
  ctx.beginPath()
  for (let i = 0; i <= N; i++) {
    const s = stateAt(l, f, (f.time * i) / N)
    if (i === 0) ctx.moveTo(fit.x(s.x), fit.y(s.y))
    else ctx.lineTo(fit.x(s.x), fit.y(s.y))
  }
  ctx.stroke()
  ctx.restore()

  const now = Math.min(time, f.time)
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 2.25
  ctx.lineJoin = 'round'
  ctx.beginPath()
  const M = Math.max(2, Math.round((N * now) / f.time))
  for (let i = 0; i <= M; i++) {
    const s = stateAt(l, f, (now * i) / M)
    if (i === 0) ctx.moveTo(fit.x(s.x), fit.y(s.y))
    else ctx.lineTo(fit.x(s.x), fit.y(s.y))
  }
  ctx.stroke()

  // peak
  if (f.tPeak > 0) {
    const s = stateAt(l, f, f.tPeak)
    dashed(ctx, fit.x(s.x), fit.y(s.y) + 6, fit.x(s.x), gy, ink.grey, 1, [2, 4])
    label(ctx, `${dec(f.peak / conv, 2)} ${lu}`, fit.x(s.x), fit.y(s.y) - 10, { color: ink.ink, halo: ink.fill, font: ink.font, size: 12, align: 'center' })
  }
  if (time >= f.time) {
    label(ctx, `${dec(f.range / conv, 2)} ${lu}`, fit.x(f.range), gy - 10, { color: ink.ink, halo: ink.fill, font: ink.font, size: 12, align: 'right' })
  }

  // body and velocity vectors
  const s = stateAt(l, f, now)
  const bx = fit.x(s.x)
  const by = fit.y(s.y)
  const kv = 64 / Math.max(l.v0, f.impactSpeed)
  arrow(ctx, bx, by, bx + s.vx * kv, by, ink.grey, 1.75, 6)
  arrow(ctx, bx, by, bx, by - s.vy * kv, ink.grey, 1.75, 6)
  arrow(ctx, bx, by, bx + s.vx * kv, by - s.vy * kv, ink.ink, 2.25, 8)
  dot(ctx, bx, by, 6, ink.ink)
}
