import { useEffect, useRef, useState } from 'react'
import { CalcLayout, DateField, NumField, Result, Row, SelectField, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { dec } from './_viz/format'
import { useSimLoop, useTodayDate } from './_viz/hooks'
import { CITIES } from './cities'
import { clock, elevation, sunDay, zoneOffset } from './sun'
import type { Event } from './sun'

const CUSTOM = 'custom'
const CITY_OPTIONS = [...CITIES.map((c) => ({ value: c[0], label: c[0] })), { value: CUSTOM, label: 'Other place (latitude and longitude)' }]
const W = 440
const H = 250
const X0 = 30
const X1 = W - 24
const DAY_S = 16

const hm = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`

export default function SunriseSunset() {
  const [city, setCity] = useState('London')
  const [date, setDate] = useTodayDate('2026-11-02')
  const f = useFields({ lat: '51.5072', lon: '-0.1276', utc: '0' })
  const c = CITIES.find((x) => x[0] === city)
  const custom = !c
  const lat = c ? c[1] : f.num.lat
  const lon = c ? c[2] : f.num.lon
  const err = {
    lat: lat === null ? 'Enter a latitude.' : lat < -90 || lat > 90 ? 'Use −90 to 90 (south is negative).' : null,
    lon: lon === null ? 'Enter a longitude.' : lon < -180 || lon > 180 ? 'Use −180 to 180 (west is negative).' : null,
    utc: f.num.utc === null || f.num.utc < -12 || f.num.utc > 14 ? 'Use a UTC offset from −12 to +14 hours.' : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? null : 'Enter a date.',
  }
  const ok = !err.lat && !err.lon && !err.date && (!custom || !err.utc)
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const offset = !ok ? 0 : c ? zoneOffset(c[3], Date.UTC(y, m - 1, d, 12)) : Math.round(f.num.utc! * 60)
  const fmt = (ms: number) => (c ? clock(ms, c[3]) : clock(ms + offset * 60000, 'UTC'))
  const ev = (e: Event, none: string) => (e.kind === 'time' ? fmt(e.ms) : e.kind === 'up' ? 'Sun up all day' : none)
  const day = ok ? sunDay(y, m, d, lat!, lon!, offset) : null
  const next = ok ? sunDay(y, m, d + 1, lat!, lon!, offset) : null
  const delta = day && next ? next.dayLength - day.dayLength : 0
  const zoneName = c ? c[3].replace(/_/g, ' ') : `UTC${offset >= 0 ? '+' : '−'}${dec(Math.abs(offset) / 60, 2)}`

  /* the sun's path through the local day */
  const midnight = Date.UTC(y, m - 1, d) - offset * 60000
  const els = day ? Array.from({ length: 145 }, (_, i) => elevation(midnight + i * 600000, lat!, lon!)) : []
  const top = Math.max(20, ...els) + 8
  const bottom = Math.max(-60, Math.min(-10, ...els)) - 4
  // Rounded so the server render and hydration agree to the digit.
  const X = (min: number) => Math.round((X0 + (min / 1440) * (X1 - X0)) * 10) / 10
  const Y = (el: number) => Math.round((20 + ((top - el) / (top - bottom)) * (H - 50)) * 10) / 10
  const pts = els.map((e, i) => `${X(i * 10).toFixed(1)},${Y(e).toFixed(1)}`)
  const dayPath = els.map((e, i) => `${i ? 'L' : 'M'}${pts[i]}`).join('')
  const localMin = (ms: number) => (ms - midnight) / 60000

  const sun = useRef<SVGCircleElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)
  const place = (min: number) => {
    if (!day) return
    const el = elevation(midnight + min * 60000, lat!, lon!)
    sun.current?.setAttribute('cx', X(min).toFixed(1))
    sun.current?.setAttribute('cy', Y(el).toFixed(1))
    if (clockRef.current) clockRef.current.textContent = `${fmt(midnight + min * 60000)}, ${dec(el, 1)}°`
  }
  const { reduced, live } = useSimLoop(
    sun,
    (dt) => {
      t.current = (t.current + dt / DAY_S) % 1
      place(t.current * 1440)
    },
    playing && day !== null,
  )
  useEffect(() => {
    if (!live && day) place(localMin(day.noon))
  })

  const summary = day
    ? `${c ? c[0] : `${dec(lat!, 3)}°, ${dec(lon!, 3)}°`} on ${date}: sunrise ${ev(day.sunrise, 'none')}, sunset ${ev(day.sunset, 'none')}, ${hm(day.dayLength)} of daylight. At solar noon (${fmt(day.noon)}) the sun is ${dec(day.noonElevation, 1)}° above the horizon. The curve is the sun's height through the day; it is above the line in daylight.`
    : 'Choose a place and a date.'

  return (
    <CalcLayout
      inputs={
        <>
          <SelectField label="Place" value={city} onChange={setCity} options={CITY_OPTIONS} />
          {custom ? (
            <>
              <Row>
                <NumField label="Latitude" {...f.bind('lat')} unit="°" error={err.lat} />
                <NumField label="Longitude" {...f.bind('lon')} unit="°" error={err.lon} />
              </Row>
              <NumField label="UTC offset" {...f.bind('utc')} unit="h" error={err.utc} hint="Hours ahead of UTC, with daylight saving: London in summer is 1, New York in winter is −5." />
            </>
          ) : null}
          <DateField label="Date" value={date} onChange={setDate} error={err.date} />
        </>
      }
      result={
        <Result
          label="Sunrise and sunset"
          value={day ? (day.sunrise.kind === 'time' && day.sunset.kind === 'time' ? `${fmt(day.sunrise.ms)} to ${fmt(day.sunset.ms)}` : day.sunrise.kind === 'up' ? 'Midnight sun' : 'Polar night') : '–'}
          sub={day ? `${hm(day.dayLength)} of daylight, times in ${zoneName}` : undefined}
          error={ok ? null : Object.values(err).find(Boolean)}
          copy={day ? `${date}: sunrise ${ev(day.sunrise, 'none')}, sunset ${ev(day.sunset, 'none')}, day length ${hm(day.dayLength)}` : undefined}
        >
          {day ? (
            <>
              <Stat label="Solar noon" value={fmt(day.noon)} />
              <Stat label="Day length tomorrow" value={`${delta >= 0 ? '+' : '−'}${dec(Math.abs(delta), 1)} min`} />
              <Stat label="Dawn (civil)" value={ev(day.dawn, 'none')} />
              <Stat label="Dusk (civil)" value={ev(day.dusk, 'none')} />
              <Stat label="Sun height at noon" value={dec(day.noonElevation, 1)} unit="°" />
              <Stat label="Sun declination" value={dec(day.decl, 2)} unit="°" />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={day ? <SimBar playing={playing} onPlaying={setPlaying} scale="1 s shows 1.5 hours" reduced={reduced} clock={clockRef} /> : undefined}>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={day ? `Sun path: sunrise ${ev(day.sunrise, 'none')}, sunset ${ev(day.sunset, 'none')}` : 'Sun path'}>
            {day ? (
              <>
                {day.sunrise.kind === 'time' && day.sunset.kind === 'time' ? (
                  <rect x={X(localMin(day.sunrise.ms))} y={20} width={X(localMin(day.sunset.ms)) - X(localMin(day.sunrise.ms))} height={Y(0) - 20} className="fill-background" />
                ) : null}
                <line x1={X0} x2={X1} y1={Y(0)} y2={Y(0)} className="stroke-foreground" strokeWidth={1.5} />
                <path d={dayPath} className="fill-none stroke-foreground" strokeWidth={2.25} strokeLinejoin="round" />
                {[0, 6, 12, 18, 24].map((h) => (
                  <text key={h} x={X(h * 60)} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                    {String(h).padStart(2, '0')}:00
                  </text>
                ))}
                {(['sunrise', 'sunset'] as const).map((k) => {
                  const e = day[k]
                  if (e.kind !== 'time') return null
                  const x = X(localMin(e.ms))
                  return (
                    <g key={k}>
                      <line x1={x} x2={x} y1={Y(0) - 6} y2={Y(0) + 6} className="stroke-foreground" strokeWidth={2} />
                      <text x={x} y={Y(0) + 20} textAnchor="middle" className="fill-foreground text-[12px] font-[650]">
                        {fmt(e.ms)}
                      </text>
                    </g>
                  )
                })}
                <circle ref={sun} r={9} cx={X(localMin(day.noon))} cy={Y(day.noonElevation)} className="fill-foreground stroke-background" strokeWidth={2} />
              </>
            ) : null}
          </svg>
        </Stage>
      }
      working={
        day ? (
          <Working
            lines={[
              `declination δ = ${dec(day.decl, 3)}°   equation of time = ${dec(day.eqTime, 2)} min`,
              `solar noon = 12:00 − 4 min × longitude − equation of time = ${fmt(day.noon)}`,
              `hour angle = arccos(cos 90.833° ÷ (cos φ cos δ) − tan φ tan δ)`,
              `sunrise = noon − 4 min × hour angle = ${ev(day.sunrise, 'none')}`,
              `sunset  = noon + 4 min × hour angle = ${ev(day.sunset, 'none')}`,
              `noon sun height = 90° − |φ − δ| = ${dec(day.noonElevation, 2)}°`,
            ]}
            caption="NOAA solar calculator equations; φ is the latitude. 90.833° allows for refraction and the sun's radius."
          />
        ) : null
      }
    />
  )
}
