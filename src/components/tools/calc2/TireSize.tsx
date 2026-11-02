import { useEffect, useRef, useState } from 'react'
import { CalcLayout, Choice, NumField, Result, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { parseTire, tireSize, trueSpeed } from './tire'
import type { Tire, TireSize as Size } from './tire'

type SpeedU = 'mph' | 'km/h'
const SLOW = 25

export default function TireSize() {
  const f = useFields({ a: '225/45R17', b: '245/40R18', speed: '60' })
  const [su, setSu] = useState<SpeedU>('mph')
  const ta = parseTire(f.raw.a)
  const tb = parseTire(f.raw.b)
  const speed = f.num.speed
  const err = {
    a: ta ? null : 'Enter a size such as 225/45R17.',
    b: tb ? null : 'Enter a size such as 245/40R18.',
    speed: speed === null || speed <= 0 || speed > 400 ? 'Use a speed from 1 to 400.' : null,
  }
  const ok = !err.a && !err.b && !err.speed
  const A = ta ? tireSize(ta) : null
  const B = tb ? tireSize(tb) : null
  const diff = A && B ? (B.diameter / A.diameter - 1) * 100 : 0
  const shownTrue = A && B && speed ? trueSpeed(speed, A.diameter, B.diameter) : 0

  /* both wheels roll at the same road speed; the smaller one turns faster */
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const dist = useRef(0)
  const vMs = (speed ?? 0) * (su === 'mph' ? 0.44704 : 1 / 3.6)
  const paint = () => {
    const p = prepCanvas(canvas.current)
    if (p && ok) drawWheels(p.ctx, p.w, p.h, [ta!, tb!], [A!, B!], dist.current, ink, [f.raw.a.trim(), f.raw.b.trim()])
  }
  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      dist.current += (vMs * dt) / SLOW
      paint()
    },
    playing && ok,
  )
  useEffect(() => paint())

  const inch = (mm: number) => `${dec(mm / 25.4, 2)} in`
  const summary = ok
    ? `${f.raw.a.trim()} is ${inch(A!.diameter)} (${dec(A!.diameter, 1)} mm) tall and ${f.raw.b.trim()} is ${inch(B!.diameter)} (${dec(B!.diameter, 1)} mm), ${dec(Math.abs(diff), 2)}% ${diff >= 0 ? 'larger' : 'smaller'}. Drawn to scale, both roll at ${fmt(speed!)} ${su}; the smaller tire turns faster. With the new tires, a speedometer that shows ${fmt(speed!)} means ${dec(shownTrue, 1)} ${su}.`
    : 'Enter two tire sizes.'

  const row = (name: string, a: number, b: number, unit: string, dp = 1) => (
    <tr key={name}>
      <td className="py-1.5 pr-3 text-muted-foreground">{name}</td>
      <td className="py-1.5 pr-3 text-right">{dec(a, dp)}</td>
      <td className="py-1.5 pr-3 text-right">{dec(b, dp)}</td>
      <td className="py-1.5 text-right">
        {b - a >= 0 ? '+' : '−'}
        {dec(Math.abs(b - a), dp)} {unit}
      </td>
    </tr>
  )

  return (
    <CalcLayout
      inputs={
        <>
          <NumField label="Current tire" {...f.bind('a')} inputMode="text" error={err.a} hint="From the sidewall: width / aspect ratio R rim." />
          <NumField label="New tire" {...f.bind('b')} inputMode="text" error={err.b} />
          <NumField label="Speedometer reading" {...f.bind('speed')} unit={su} error={err.speed} />
          <Choice label="Speed unit" value={su} onChange={setSu} options={[{ value: 'mph', label: 'mph' }, { value: 'km/h', label: 'km/h' }]} />
        </>
      }
      result={
        <Result
          label="Diameter difference"
          value={ok ? `${diff >= 0 ? '+' : '−'}${dec(Math.abs(diff), 2)}%` : '–'}
          sub={ok ? `At ${fmt(speed!)} ${su} shown you drive ${dec(shownTrue, 1)} ${su}` : undefined}
          error={ok ? null : Object.values(err).find(Boolean)}
          copy={ok ? `${f.raw.a.trim()} ${inch(A!.diameter)} vs ${f.raw.b.trim()} ${inch(B!.diameter)}: ${dec(diff, 2)}%` : undefined}
        >
          {ok ? (
            <>
              <Stat label="Current diameter" value={inch(A!.diameter)} />
              <Stat label="New diameter" value={inch(B!.diameter)} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <div className="space-y-6">
          <Stage summary={summary} bar={ok ? <SimBar playing={playing} onPlaying={setPlaying} scale={`Rolling at ${fmt(speed!)} ${su}, slowed ${SLOW}×`} reduced={reduced} /> : undefined}>
            <canvas ref={canvas} className="block aspect-[16/10] w-full" role="img" aria-label="The two tires side by side, to scale" />
          </Stage>
          {ok ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] text-[0.875rem] tabular-nums">
                <caption className="sr-only">Tire sizes compared</caption>
                <thead>
                  <tr className="text-left">
                    <th className="pb-2 font-[600]" />
                    <th className="pb-2 pr-3 text-right font-[600]">Current</th>
                    <th className="pb-2 pr-3 text-right font-[600]">New</th>
                    <th className="pb-2 text-right font-[600]">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {row('Width, mm', ta!.width, tb!.width, 'mm', 0)}
                  {row('Sidewall, mm', A!.sidewall, B!.sidewall, 'mm')}
                  {row('Diameter, mm', A!.diameter, B!.diameter, 'mm')}
                  {row('Diameter, in', A!.diameter / 25.4, B!.diameter / 25.4, 'in', 2)}
                  {row('Circumference, mm', A!.circumference, B!.circumference, 'mm', 0)}
                  {row('Turns per mile', A!.revsPerMile, B!.revsPerMile, '', 1)}
                  {row('Turns per km', A!.revsPerKm, B!.revsPerKm, '', 1)}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      }
      working={
        ok ? (
          <Working
            lines={[
              `sidewall  = width × aspect ÷ 100 = ${ta!.width} × ${ta!.aspect} ÷ 100 = ${num(A!.sidewall)} mm`,
              `diameter  = rim × 25.4 + 2 × sidewall = ${ta!.rim} × 25.4 + 2 × ${num(A!.sidewall)} = ${num(A!.diameter)} mm`,
              `new       = ${tb!.rim} × 25.4 + 2 × ${num(B!.sidewall)} = ${num(B!.diameter)} mm`,
              `difference = ${num(B!.diameter)} ÷ ${num(A!.diameter)} − 1 = ${num(diff / 100)}`,
              `true speed = shown × new ÷ current = ${num(speed!)} × ${num(B!.diameter)} ÷ ${num(A!.diameter)} = ${num(shownTrue)} ${su}`,
            ]}
            caption="Sizes are the nominal figures on the sidewall; a real tire varies by a few millimetres with brand, wear and pressure."
          />
        ) : null
      }
    />
  )
}

function drawWheels(ctx: CanvasRenderingContext2D, w: number, h: number, tires: Tire[], sizes: Size[], dist: number, ink: Ink, names: string[]) {
  const D = sizes.map((s) => s.diameter)
  const gap = 40
  const k = Math.min((w - 40 - gap) / (D[0]! + D[1]!), (h - 64) / Math.max(D[0]!, D[1]!))
  const ground = h - 40
  let x = (w - (D[0]! + D[1]!) * k - gap) / 2
  // road marks move with the road speed
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(8, ground)
  ctx.lineTo(w - 8, ground)
  ctx.stroke()
  const dash = 60
  const off = ((dist * 1000 * k) % dash) - dash
  ctx.fillStyle = ink.grey
  for (let px = off; px < w; px += dash) ctx.fillRect(w - px - 24, ground + 6, 24, 3)
  tires.forEach((t, i) => {
    const R = (D[i]! / 2) * k
    const rimR = ((t.rim * 25.4) / 2) * k
    const cx = x + R
    const cy = ground - R
    const turn = (dist * 1000) / (D[i]! / 2)
    ctx.fillStyle = ink.ink
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fill()
    // tread notches show the rotation
    ctx.strokeStyle = ink.fill
    ctx.lineWidth = 2
    for (let n = 0; n < 24; n++) {
      const a = turn + (n * Math.PI) / 12
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * R * 0.93, cy + Math.sin(a) * R * 0.93)
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
      ctx.stroke()
    }
    ctx.fillStyle = ink.paper
    ctx.beginPath()
    ctx.arc(cx, cy, rimR, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = Math.max(2, rimR * 0.08)
    for (let n = 0; n < 5; n++) {
      const a = turn + (n * 2 * Math.PI) / 5
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * rimR * 0.18, cy + Math.sin(a) * rimR * 0.18)
      ctx.lineTo(cx + Math.cos(a) * rimR * 0.9, cy + Math.sin(a) * rimR * 0.9)
      ctx.stroke()
    }
    label(ctx, `${names[i]}  ${dec(D[i]! / 25.4, 2)} in`, cx, h - 12, { color: ink.ink, halo: ink.fill, font: ink.font, size: 12, weight: 620, align: 'center' })
    x += 2 * R + gap
  })
}
