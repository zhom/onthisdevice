import { useTweenArray } from '@/components/viz/tween'
import { CalcLayout, NumField, Result, Stage, Stat, Working, useFields } from './_viz/Calc'
import { dec, fmt, num, sub } from './_viz/format'
import { percentError } from './percent'

const W = 440
const Y = 104

export default function PercentError() {
  const f = useFields({ measured: '9.6', actual: '9.81' })
  const { measured, actual } = f.num
  const err = {
    measured: measured === null ? 'Enter the measured value.' : null,
    actual: actual === null ? 'Enter the true value.' : actual === 0 ? 'Percent error is undefined when the true value is zero.' : null,
  }
  const ok = !err.measured && !err.actual
  const r = ok ? percentError(measured!, actual!) : null

  const half = r ? Math.max(Math.abs(r.diff) * 1.7, Math.abs(actual!) * 0.02, 1e-9) : 1
  const lo = (actual ?? 0) - half
  const X = (v: number) => 40 + ((v - lo) / (2 * half)) * (W - 80)
  const [m = 0, a = 0] = useTweenArray(r ? [measured!, actual!] : [0, 0], { from: r ? [actual!, actual!] : [0, 0] })

  const summary = r
    ? `The measured value ${fmt(measured!)} is ${fmt(Math.abs(r.diff))} ${r.diff >= 0 ? 'above' : 'below'} the true value ${fmt(actual!)}. That gap is ${dec(r.abs, 3)}% of the true value.`
    : 'Enter a measured value and the true value.'

  return (
    <CalcLayout
      inputs={
        <>
          <NumField label="Measured (experimental) value" {...f.bind('measured')} error={err.measured} />
          <NumField label="True (accepted) value" {...f.bind('actual')} error={err.actual} />
        </>
      }
      result={
        <Result
          label="Percent error"
          value={r ? r.abs : '–'}
          format={(n) => dec(n, 4)}
          unit="%"
          sub={r ? `The measurement is ${r.diff >= 0 ? 'high' : 'low'} by ${dec(Math.abs(r.signed), 4)}%` : undefined}
          error={ok ? null : (err.actual ?? err.measured)}
          copy={r ? `Percent error ${dec(r.abs, 4)}% (signed ${dec(r.signed, 4)}%, difference ${fmt(r.diff)})` : undefined}
        >
          {r ? (
            <>
              <Stat label="Signed error" value={`${r.signed > 0 ? '+' : ''}${dec(r.signed, 4)}%`} />
              <Stat label="Difference" value={fmt(r.diff)} />
              <Stat label="Relative error" value={fmt(r.abs / 100, 5)} />
              <Stat label="Accuracy" value={`${dec(100 - r.abs, 4)}%`} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary}>
          <svg viewBox={`0 0 ${W} 170`} className="block h-auto w-full" role="img" aria-label="Measured and true values on a number line">
            <line x1={20} x2={W - 20} y1={Y} y2={Y} className="stroke-muted-foreground" />
            {r ? (
              <>
                <rect x={Math.min(X(m), X(a))} y={Y - 5} width={Math.abs(X(m) - X(a))} height={10} className="fill-muted-foreground" />
                <line x1={X(a)} x2={X(a)} y1={Y - 30} y2={Y + 30} className="stroke-foreground" strokeWidth={2.5} />
                <text x={X(a)} y={Y + 50} textAnchor="middle" className="fill-foreground text-[13px] font-[650]">
                  true {fmt(actual!, 6)}
                </text>
                <circle cx={X(m)} cy={Y} r={8} className="fill-foreground" />
                <text x={X(m)} y={Y - 22} textAnchor="middle" className="fill-foreground text-[13px] font-[650]">
                  measured {fmt(measured!, 6)}
                </text>
                <text x={(X(m) + X(a)) / 2} y={Y + 26} textAnchor="middle" className="fill-muted-foreground text-[12px] font-[600]">
                  {r.signed > 0 ? '+' : ''}
                  {dec(r.signed, 2)}%
                </text>
              </>
            ) : null}
          </svg>
        </Stage>
      }
      working={
        r ? (
          <Working
            lines={[
              `difference = measured − true = ${num(measured!)} − ${sub(actual!)} = ${num(r.diff)}`,
              `percent error = |difference| ÷ |true| × 100`,
              `              = ${num(Math.abs(r.diff))} ÷ ${num(Math.abs(actual!))} × 100 = ${num(r.abs)}%`,
              `signed error = difference ÷ |true| × 100 = ${num(r.signed)}%`,
            ]}
          />
        ) : null
      }
    />
  )
}
