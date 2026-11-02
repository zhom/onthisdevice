import { useEffect, useRef, useState } from 'react'
import { CalcLayout, DateField, Result, SimBar, Stage, Stat, Working } from './_viz/Calc'
import { useSimLoop, useTodayDate } from './_viz/hooks'
import { MONTHS, WEEKDAYS, dayOfYear, daysIn, doomsday, isLeap, isoWeek, weekday } from './weekday'

const CW = 56
const CH = 38
const TOP = 30
const HOP_S = 0.45
const HOLD_S = 2.2

/** Hops from the month's doomsday to the date: whole weeks first, then days. */
function hops(from: number, to: number): number[] {
  const out = [from]
  let p = from
  while (Math.abs(to - p) >= 7) out.push((p += to > p ? 7 : -7))
  while (p !== to) out.push((p += to > p ? 1 : -1))
  return out
}

export default function DayOfWeek() {
  const [date, setDate] = useTodayDate('2026-11-02')
  const parts = date.match(/^(-?\d{1,6})-(\d{2})-(\d{2})$/)
  const y = parts ? Number(parts[1]) : 0
  const m = parts ? Number(parts[2]) : 0
  const d = parts ? Number(parts[3]) : 0
  const ok = parts !== null && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m)
  const wd = ok ? weekday(y, m, d) : 0
  const dd = ok ? doomsday(y, m, d) : null
  const first = ok ? weekday(y, m, 1) : 0
  const cell = (day: number) => {
    const i = first + day - 1
    return { x: 6 + (i % 7) * CW, y: TOP + Math.floor(i / 7) * CH }
  }
  const path = dd ? hops(dd.ref, d) : []

  /* the marker hops from the doomsday to the date */
  const marker = useRef<SVGGElement>(null)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)
  const total = path.length * HOP_S + HOLD_S
  const put = (day: number) => {
    const c = cell(day)
    if (marker.current) marker.current.style.transform = `translate(${c.x}px,${c.y}px)`
  }
  useEffect(() => {
    t.current = 0
  }, [date])
  const { reduced, live } = useSimLoop(
    marker,
    (dt) => {
      t.current = (t.current + dt) % total
      put(path[Math.min(path.length - 1, Math.floor(t.current / HOP_S))] ?? d)
    },
    playing && ok,
  )
  useEffect(() => {
    if (!live && ok) put(d)
  })

  const rows = ok ? Math.ceil((first + daysIn(y, m)) / 7) : 5
  const longDate = ok ? `${d} ${MONTHS[m - 1]} ${y}` : ''
  const summary = dd
    ? `${longDate} is a ${WEEKDAYS[wd]}. In ${y} every doomsday is a ${WEEKDAYS[dd.doomsday]}; in ${MONTHS[m - 1]} the doomsday date is the ${dd.ref}th. The marker starts there and steps ${Math.abs(dd.offset)} day${Math.abs(dd.offset) === 1 ? '' : 's'} ${dd.offset >= 0 ? 'forward' : 'back'}, a week at a time first.`
    : 'Enter a date.'

  return (
    <CalcLayout
      inputs={<DateField label="Date" value={date} onChange={setDate} error={ok ? null : 'Enter a valid date.'} />}
      result={
        <Result
          label={longDate || 'Day of the week'}
          value={ok ? WEEKDAYS[wd]! : '–'}
          error={ok ? null : 'Enter a valid date.'}
          copy={ok ? `${longDate} is a ${WEEKDAYS[wd]}` : undefined}
        >
          {ok ? (
            <>
              <Stat label="Day of the year" value={`${dayOfYear(y, m, d)} of ${isLeap(y) ? 366 : 365}`} />
              <Stat label="ISO week" value={String(isoWeek(y, m, d))} />
              <Stat label="Leap year" value={isLeap(y) ? 'Yes' : 'No'} />
              <Stat label={`Doomsday of ${y}`} value={WEEKDAYS[dd!.doomsday]!} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary} bar={ok ? <SimBar playing={playing} onPlaying={setPlaying} scale={`${HOP_S} s per step`} reduced={reduced} /> : undefined}>
          <svg viewBox={`0 0 404 ${TOP + rows * CH + 8}`} className="block h-auto w-full" role="img" aria-label={ok ? `Calendar of ${MONTHS[m - 1]} ${y} with ${longDate} marked` : 'Calendar'}>
            {WEEKDAYS.map((w, i) => (
              <text key={w} x={6 + i * CW + CW / 2} y={18} textAnchor="middle" className="fill-muted-foreground text-[12px] font-[600]">
                {w.slice(0, 3)}
              </text>
            ))}
            {ok ? (
              <>
                <g ref={marker} style={{ transform: `translate(${cell(d).x}px,${cell(d).y}px)`, transition: reduced ? undefined : 'transform 260ms var(--ease-out)' }}>
                  <rect width={CW - 4} height={CH - 4} rx={6} className="fill-none stroke-foreground" strokeWidth={3} />
                </g>
                {Array.from({ length: daysIn(y, m) }, (_, k) => {
                  const day = k + 1
                  const c = cell(day)
                  const isRef = day === dd!.ref
                  return (
                    <g key={day}>
                      {isRef ? <rect x={c.x} y={c.y} width={CW - 4} height={CH - 4} rx={6} className="fill-none stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="3 3" /> : null}
                      <text x={c.x + (CW - 4) / 2} y={c.y + CH / 2 + 3} textAnchor="middle" className="fill-foreground text-[14px] font-[600]">
                        {day}
                      </text>
                    </g>
                  )
                })}
              </>
            ) : null}
          </svg>
        </Stage>
      }
      working={
        dd ? (
          <Working
            title="Doomsday rule"
            lines={[
              `century anchor for ${Math.floor(y / 100) * 100}s = ${WEEKDAYS[dd.anchor]}`,
              `y = ${dd.yy}:  a = ⌊${dd.yy} ÷ 12⌋ = ${dd.a},  b = ${dd.yy} mod 12 = ${dd.b},  c = ⌊${dd.b} ÷ 4⌋ = ${dd.c}`,
              `doomsday = (anchor + a + b + c) mod 7 = ${WEEKDAYS[dd.doomsday]}`,
              `${MONTHS[m - 1]} ${dd.ref} is a doomsday; ${d} − ${dd.ref} = ${dd.offset} days`,
              `${WEEKDAYS[dd.doomsday]} ${dd.offset >= 0 ? '+' : '−'} ${Math.abs(dd.offset)} days = ${WEEKDAYS[dd.day]}`,
            ]}
            caption="Doomsday dates: 3 Jan (4 in a leap year), 28 Feb (29), 14 Mar, 4 Apr, 9 May, 6 Jun, 11 Jul, 8 Aug, 5 Sep, 10 Oct, 7 Nov, 12 Dec."
          />
        ) : null
      }
    />
  )
}
