import { useEffect, useRef, useState } from 'react'
import { CalcLayout, DateField, Result, SimBar, Stage, Stat, Working } from './_viz/Calc'
import { dec } from './_viz/format'
import { useSimLoop, useTodayDate } from './_viz/hooks'
import { PHASE_NAMES, SYNODIC, litFraction, moonAt, phaseTime } from './moon'

const DAY = 86400000
const MONTH_S = 9
const R = 92

/** SVG path of the lit part of a disc of radius r, centred on 0,0. */
function litPath(lit: number, waxing: boolean, r = R): string {
  const k = Math.min(1, Math.max(0, lit))
  const rx = Math.abs(1 - 2 * k) * r
  const sweep = k < 0.5 ? 0 : 1
  const side = waxing ? 1 : 0
  // Waxing: lit on the right (as seen from the northern hemisphere).
  return waxing
    ? `M0,${-r}A${r},${r} 0 0 ${side} 0,${r}A${rx},${r} 0 0 ${sweep} 0,${-r}Z`
    : `M0,${-r}A${r},${r} 0 0 ${side} 0,${r}A${rx},${r} 0 0 ${1 - sweep} 0,${-r}Z`
}

const fmtWhen = (ms: number) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms))
const fmtDay = (ms: number) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(ms))

export default function MoonPhase() {
  const [date, setDate] = useTodayDate('2026-11-02')
  const [time, setTime] = useState('21:00')
  const ms = new Date(`${date}T${time || '12:00'}`).getTime()
  const ok = Number.isFinite(ms)
  const m = ok ? moonAt(ms) : null

  /* month scrub: the big moon runs through the lunation that holds the date */
  const disc = useRef<SVGPathElement>(null)
  const marker = useRef<SVGGElement>(null)
  const when = useRef<HTMLSpanElement>(null)
  const [playing, setPlaying] = useState(true)
  const s = useRef(0)
  const start = m?.lastNew ?? 0
  const kNew = Math.round((start - phaseTime(0)) / DAY / SYNODIC)
  const len = m ? phaseTime(kNew + 1) - start : SYNODIC * DAY
  const full = m ? phaseTime(kNew + 0.5) : 0
  const show = (t: number) => {
    const f = litFraction(t)
    const waxing = t < full
    disc.current?.setAttribute('d', litPath(f, waxing))
    marker.current?.setAttribute('transform', `translate(${20 + ((t - start) / len) * 400},0)`)
    if (when.current) when.current.textContent = `${fmtDay(t)}, ${dec(f * 100, 0)}% lit`
  }
  const { reduced, live } = useSimLoop(
    disc,
    (dt) => {
      s.current = (s.current + dt / MONTH_S) % 1
      show(start + s.current * len)
    },
    playing && m !== null,
  )
  useEffect(() => {
    if (!live && m) show(ms)
  })

  const pct = m ? m.lit * 100 : 0
  const summary = m
    ? `${m.name}: ${dec(pct, 1)}% of the disc is lit and the moon is ${dec(m.age, 1)} days old, ${m.waxing ? 'waxing (growing)' : 'waning (shrinking)'}. ${reduced || !playing ? 'The disc shows the chosen date.' : 'The disc runs through this lunar month, new moon to new moon, in 9 seconds; pause to see the chosen date.'} Seen from the northern hemisphere; south of the equator the lit side is reversed.`
    : 'Enter a date.'

  const strip = m
    ? Array.from({ length: 15 }, (_, i) => {
        const t = start + (i / 14) * len
        return { x: 20 + (i / 14) * 400, lit: litFraction(t), waxing: t < full }
      })
    : []

  return (
    <CalcLayout
      inputs={
        <>
          <DateField label="Date" value={date} onChange={setDate} error={ok ? null : 'Enter a date.'} />
          <DateField label="Time (your time zone)" type="time" value={time} onChange={setTime} />
        </>
      }
      result={
        <Result
          label="Moon phase"
          value={m ? m.name : '–'}
          sub={m ? `${dec(pct, 1)}% lit, ${m.waxing ? 'waxing' : 'waning'}` : undefined}
          error={ok ? null : 'Enter a valid date.'}
          copy={m ? `${date} ${time}: ${m.name}, ${dec(pct, 1)}% lit, ${dec(m.age, 1)} days old` : undefined}
        >
          {m ? (
            <>
              <Stat label="Lit" value={pct} format={(n) => dec(n, 1)} unit="%" />
              <Stat label="Moon age" value={m.age} format={(n) => dec(n, 1)} unit="days" />
              {m.next.map((n) => (
                <Stat key={n.phase} label={`Next ${PHASE_NAMES[n.phase].toLowerCase()}`} value={fmtWhen(n.ms)} />
              ))}
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={m ? <SimBar playing={playing} onPlaying={setPlaying} scale="1 s shows 3.3 days" reduced={reduced} clock={when} /> : undefined}>
          <svg viewBox="0 0 440 320" className="block h-auto w-full" role="img" aria-label={m ? `The moon ${dec(pct, 0)}% lit, ${m.waxing ? 'waxing' : 'waning'}` : 'The moon'}>
            <g transform="translate(220,124)">
              <circle r={R} className="fill-background stroke-muted-foreground" strokeWidth={1} />
              <path ref={disc} d={m ? litPath(m.lit, m.waxing) : ''} className="fill-foreground" />
            </g>
            {strip.map((p, i) => (
              <g key={i} transform={`translate(${p.x},270)`}>
                <circle r={11} className="fill-background stroke-muted-foreground" strokeWidth={0.75} />
                <path d={litPath(p.lit, p.waxing, 11)} className="fill-foreground" />
              </g>
            ))}
            {m ? (
              <>
                <line x1={20 + ((ms - start) / len) * 400} x2={20 + ((ms - start) / len) * 400} y1={252} y2={288} className="stroke-foreground" strokeWidth={2} />
                <g ref={marker} transform={`translate(${20 + ((ms - start) / len) * 400},0)`}>
                  <polygon points="0,248 -6,240 6,240" className="fill-foreground" />
                </g>
                <text x={20} y={308} className="fill-muted-foreground text-[11px]">
                  new moon {fmtDay(start)}
                </text>
                <text x={420} y={308} textAnchor="end" className="fill-muted-foreground text-[11px]">
                  new moon {fmtDay(start + len)}
                </text>
              </>
            ) : null}
          </svg>
        </Stage>
      }
      working={
        m ? (
          <Working
            lines={[
              `last new moon     ${fmtWhen(m.lastNew)}`,
              `age               (date − new moon) = ${dec(m.age, 3)} days of ${SYNODIC} (mean synodic month)`,
              `phase angle i     180° − D − 6.289° sin M′ + 2.100° sin M − … (Meeus 48.4)`,
              `lit fraction      (1 + cos i) ÷ 2 = ${dec(m.lit, 4)}`,
            ]}
            caption="Phase times by Meeus, Astronomical Algorithms, chapter 49, with ΔT. Times are in your time zone."
          />
        ) : null
      }
    />
  )
}
