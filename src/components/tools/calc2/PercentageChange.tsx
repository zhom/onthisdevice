import { useTweenArray } from '@/components/viz/tween'
import { CalcLayout, NumField, Result, Stage, Stat, Working, useFields } from './_viz/Calc'
import { dec, fmt, num, sub } from './_viz/format'
import { percentChange, percentDifference } from './percent'

const W = 440
const H = 260
const BASE = 210
const TOP = 46

export default function PercentageChange() {
  const f = useFields({ from: '80', to: '100' })
  const { from, to } = f.num
  const err = {
    from: from === null ? 'Enter the old value.' : from === 0 ? 'A change from zero has no percentage. Use the difference instead.' : null,
    to: to === null ? 'Enter the new value.' : null,
  }
  const ok = !err.from && !err.to
  const pc = ok ? percentChange(from!, to!) : 0
  const pd = ok && from! + to! !== 0 ? percentDifference(from!, to!) : NaN

  const max = ok ? Math.max(Math.abs(from!), Math.abs(to!)) || 1 : 1
  const [a = 0, b = 0] = useTweenArray(ok ? [Math.abs(from!) / max, Math.abs(to!) / max] : [0, 0], { from: [0, 0] })
  const hA = Math.max(0, a) * (BASE - TOP)
  const hB = Math.max(0, b) * (BASE - TOP)
  const xA = 90
  const xB = 270
  const bw = 80

  const ax1 = xA + bw + 10
  const ay1 = BASE - hA
  const ax2 = xB - 10
  const ay2 = BASE - hB
  const ang = Math.atan2(ay2 - ay1, ax2 - ax1)
  const head = [
    [ax2, ay2],
    [ax2 - 12 * Math.cos(ang) + 6 * Math.sin(ang), ay2 - 12 * Math.sin(ang) - 6 * Math.cos(ang)],
    [ax2 - 12 * Math.cos(ang) - 6 * Math.sin(ang), ay2 - 12 * Math.sin(ang) + 6 * Math.cos(ang)],
  ]
    .map((q) => q.map((v) => v!.toFixed(1)).join(','))
    .join(' ')

  const word = pc > 0 ? 'increase' : pc < 0 ? 'decrease' : 'no change'
  const summary = ok
    ? `From ${fmt(from!)} to ${fmt(to!)} is a ${dec(Math.abs(pc), 3)}% ${word}. The bars are drawn to the same scale; the new value is ${fmt(to! / from!, 5)} times the old one.`
    : 'Enter an old value and a new value.'

  return (
    <CalcLayout
      inputs={
        <>
          <NumField label="Old value (from)" {...f.bind('from')} error={err.from} />
          <NumField label="New value (to)" {...f.bind('to')} error={err.to} />
        </>
      }
      result={
        <Result
          label={`Percentage ${pc < 0 ? 'decrease' : 'increase'}`}
          value={ok ? Math.abs(pc) : '–'}
          format={(n) => dec(n, 4)}
          unit="%"
          sub={ok ? `${pc > 0 ? '+' : pc < 0 ? '−' : ''}${dec(Math.abs(pc), 4)}% change` : undefined}
          error={ok ? null : (err.from ?? err.to)}
          copy={ok ? `Change from ${fmt(from!)} to ${fmt(to!)}: ${dec(pc, 4)}%` : undefined}
        >
          {ok ? (
            <>
              <Stat label="Difference" value={`${to! - from! > 0 ? '+' : ''}${fmt(to! - from!)}`} />
              <Stat label="Multiplier" value={`× ${fmt(to! / from!, 6)}`} />
              <Stat label="Percentage difference" value={Number.isFinite(pd) ? `${dec(pd, 4)}%` : 'undefined'} />
              <Stat label="Change back to the old value" value={to! === 0 ? 'undefined' : `${dec(percentChange(to!, from!), 4)}%`} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary}>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Old and new values as bars">
            <line x1={30} x2={W - 30} y1={BASE} y2={BASE} className="stroke-muted-foreground" />
            <rect x={xA} y={BASE - hA} width={bw} height={hA} className="fill-muted-foreground" />
            <rect x={xB} y={BASE - hB} width={bw} height={hB} className="fill-foreground" />
            <text x={xA + bw / 2} y={BASE + 22} textAnchor="middle" className="fill-muted-foreground text-[13px] font-[600]">
              old {ok ? fmt(from!, 6) : ''}
            </text>
            <text x={xB + bw / 2} y={BASE + 22} textAnchor="middle" className="fill-foreground text-[13px] font-[650]">
              new {ok ? fmt(to!, 6) : ''}
            </text>
            {ok ? (
              <g>
                <line x1={ax1} y1={ay1} x2={ax2 - Math.cos(ang) * 10} y2={ay2 - Math.sin(ang) * 10} className="stroke-foreground" strokeWidth={2} />
                <polygon points={head} className="fill-foreground" />
                <text x={(xA + bw + xB) / 2} y={Math.min(BASE - hA, BASE - hB) - 16} textAnchor="middle" className="fill-foreground text-[15px] font-[700]">
                  {pc > 0 ? '+' : pc < 0 ? '−' : ''}
                  {dec(Math.abs(pc), 2)}%
                </text>
              </g>
            ) : null}
          </svg>
        </Stage>
      }
      working={
        ok ? (
          <Working
            lines={[
              `change = (new − old) ÷ |old| × 100`,
              `       = (${num(to!)} − ${sub(from!)}) ÷ ${num(Math.abs(from!))} × 100 = ${num(pc)}%`,
              ...(Number.isFinite(pd)
                ? [`difference = |a − b| ÷ ((a + b) ÷ 2) × 100 = ${num(Math.abs(to! - from!))} ÷ ${num((from! + to!) / 2)} × 100 = ${num(pd)}%`]
                : []),
            ]}
          />
        ) : null
      }
    />
  )
}
