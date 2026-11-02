import { useRef, useState } from 'react'
import { CalcLayout, Choice, NumField, Result, SelectField, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { minus } from './_viz/format'
import { useSimLoop } from './_viz/hooks'
import { parseDec, roundPlaces, roundSig } from './rounding'
import type { RoundMode, Rounded } from './rounding'

type By = 'places' | 'sig'
const MODES: { value: RoundMode; label: string; rule: string }[] = [
  { value: 'half-up', label: 'Half up (away from zero)', rule: 'A 5 rounds away from zero.' },
  { value: 'half-even', label: 'Half to even (banker’s)', rule: 'A 5 rounds to the even neighbour.' },
  { value: 'ceil', label: 'Up (ceiling)', rule: 'Always to the higher neighbour.' },
  { value: 'floor', label: 'Down (floor)', rule: 'Always to the lower neighbour.' },
  { value: 'trunc', label: 'Toward zero (truncate)', rule: 'Drop the extra digits.' },
]

const W = 440
const Y = 120
const XL = 60
const XR = W - 60
const CYCLE = 3.6

function placeName(p: number): string {
  if (p === 0) return 'the nearest whole number'
  if (p > 0) return `${p} decimal place${p === 1 ? '' : 's'}`
  return `the nearest ${(10 ** -p).toLocaleString('en-US')}`
}

export default function Rounding() {
  const f = useFields({ n: '1.005', places: '2', sig: '3' })
  const [by, setBy] = useState<By>('places')
  const [mode, setMode] = useState<RoundMode>('half-up')
  const d = parseDec(f.raw.n)
  const places = f.num.places
  const sig = f.num.sig
  const err = {
    n: d ? null : 'Enter a number such as 2.675 or −1,234.5.',
    places: places === null || !Number.isInteger(places) || places < -15 || places > 30 ? 'Use a whole number from −15 to 30.' : null,
    sig: sig === null || !Number.isInteger(sig) || sig < 1 || sig > 30 ? 'Use a whole number from 1 to 30.' : null,
  }
  const ok = d !== null && (by === 'places' ? !err.places : !err.sig)
  const r: Rounded | null = ok ? (by === 'places' ? roundPlaces(d!, places!, mode) : roundSig(d!, sig!, mode)) : null
  const typed = f.raw.n.trim()
  const rule = MODES.find((m) => m.value === mode)!.rule

  // number line between the two neighbours
  const lo = r ? Number(r.lower) : 0
  const hi = r ? Number(r.upper) : 1
  const v = d ? Number(`${d.n}e${d.exp}`) : 0
  const frac = r && hi !== lo ? Math.min(1, Math.max(0, (v - lo) / (hi - lo))) : 0
  const X = (t: number) => XL + t * (XR - XL)
  const target = r && !r.exact ? (r.wentUp ? 1 : 0) : frac

  const marker = useRef<SVGGElement>(null)
  const [playing, setPlaying] = useState(true)
  const t = useRef(0)
  const place = (k: number) => {
    const e = k * k * (3 - 2 * k)
    marker.current?.setAttribute('transform', `translate(${X(frac + (target - frac) * e)},0)`)
  }
  const { reduced } = useSimLoop(
    marker,
    (dt) => {
      t.current = (t.current + dt) % CYCLE
      const k = Math.min(1, Math.max(0, (t.current - 1.1) / 0.7))
      place(k)
    },
    playing && r !== null && !r.exact,
  )

  const summary = r
    ? r.exact
      ? `${typed} has no digits past ${placeName(r.places)}, so it does not change.`
      : `${typed} lies between ${minus(r.lower)} and ${minus(r.upper)}, ${frac < 0.5 ? 'below' : frac > 0.5 ? 'above' : 'exactly at'} the halfway point. ${rule} It rounds to ${minus(r.text)}.`
    : 'Enter a number to round.'

  const working = r
    ? [
        `number     ${typed}`,
        `precision  ${by === 'places' ? placeName(r.places) : `${sig} significant figures (${placeName(r.places)})`}`,
        `neighbours ${minus(r.lower)} and ${minus(r.upper)}`,
        `rule       ${rule}`,
        `result     ${minus(r.text)}`,
      ]
    : []

  return (
    <CalcLayout
      inputs={
        <>
          <NumField label="Number" {...f.bind('n')} inputMode="text" error={err.n} />
          <Choice label="Round to" value={by} onChange={setBy} options={[{ value: 'places', label: 'Decimal places' }, { value: 'sig', label: 'Significant figures' }]} />
          {by === 'places' ? (
            <NumField label="Decimal places" {...f.bind('places')} inputMode="numeric" error={err.places} hint="0 for a whole number; −1, −2, −3 for the nearest 10, 100, 1,000." />
          ) : (
            <NumField label="Significant figures" {...f.bind('sig')} inputMode="numeric" error={err.sig} />
          )}
          <SelectField label="Rule" value={mode} onChange={setMode} options={MODES} />
        </>
      }
      result={
        <Result
          label="Rounded"
          value={r ? minus(r.text) : '–'}
          sub={r ? (r.exact ? 'Already exact at this precision' : `Rounded ${r.wentUp ? 'up' : 'down'} from ${typed}`) : undefined}
          error={ok ? null : (err.n ?? (by === 'places' ? err.places : err.sig))}
          copy={r ? r.text : undefined}
        >
          {r ? (
            <>
              <Stat label="Lower neighbour" value={minus(r.lower)} />
              <Stat label="Upper neighbour" value={minus(r.upper)} />
              <Stat label="Change" value={minus(String(Number((Number(r.text) - v).toPrecision(12))))} />
              <Stat label="Precision" value={placeName(r.places)} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage
          summary={summary}
          bar={r && !r.exact ? <SimBar playing={playing} onPlaying={setPlaying} scale="Repeats every 3.6 s" reduced={reduced} /> : undefined}
        >
          <svg viewBox={`0 0 ${W} 200`} className="block h-auto w-full" role="img" aria-label={r ? `${typed} rounds to ${r.text}` : 'Number line'}>
            {r ? (
              <>
                <line x1={XL - 30} x2={XR + 30} y1={Y} y2={Y} className="stroke-muted-foreground" />
                {[0, 1].map((k) => (
                  <g key={k}>
                    <line x1={X(k)} x2={X(k)} y1={Y - 14} y2={Y + 14} className="stroke-foreground" strokeWidth={2} />
                    <text x={X(k)} y={Y + 36} textAnchor="middle" className="fill-foreground text-[14px] font-[650]">
                      {minus(k ? r.upper : r.lower)}
                    </text>
                  </g>
                ))}
                <line x1={X(0.5)} x2={X(0.5)} y1={Y - 8} y2={Y + 8} className="stroke-muted-foreground" strokeWidth={1.5} />
                <text x={X(0.5)} y={Y + 36} textAnchor="middle" className="fill-muted-foreground text-[12px]">
                  halfway
                </text>
                <line x1={X(frac)} x2={X(frac)} y1={Y - 40} y2={Y} className="stroke-muted-foreground" strokeDasharray="2 3" />
                <text x={Math.min(XR, Math.max(XL, X(frac)))} y={Y - 48} textAnchor="middle" className="fill-muted-foreground text-[13px] font-[600]">
                  {minus(typed)}
                </text>
                <g ref={marker} transform={`translate(${X(target)},0)`}>
                  <circle cx={0} cy={Y} r={9} className="fill-foreground" />
                </g>
              </>
            ) : null}
          </svg>
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="The digits are rounded as typed, so 1.005 to two places gives 1.01." /> : null}
    />
  )
}
