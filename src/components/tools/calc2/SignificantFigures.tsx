import { useState } from 'react'
import { CalcLayout, Choice, NumField, Result, Stage, Stat, Working, useFields } from './_viz/Calc'
import { sup } from './_viz/format'
import { toPlain, toSciParts } from './scinot'
import type { Dec } from './scinot'
import { countSig, roundToSig, sigArith } from './sigfig'
import type { SigOp } from './sigfig'
import { cn } from '@/lib/utils'

const OPS: { value: SigOp; label: string }[] = [
  { value: '+', label: '+' },
  { value: '−', label: '−' },
  { value: '×', label: '×' },
  { value: '÷', label: '÷' },
]

const sciText = (d: Dec) => {
  const { mant, exp } = toSciParts(d)
  return exp === 0 ? mant : `${mant} × 10${sup(exp)}`
}

export default function SignificantFigures() {
  const f = useFields({ n: '0.004050', round: '2', a: '12.52', b: '3.1' })
  const [op, setOp] = useState<SigOp>('×')
  const c = countSig(f.raw.n)
  const round = f.num.round
  const roundOk = round !== null && Number.isInteger(round) && round >= 1 && round <= 30
  const rounded = c && roundOk ? roundToSig(f.raw.n, round) : null
  const arith = sigArith(f.raw.a, op, f.raw.b)
  const errA = countSig(f.raw.a) ? null : 'Enter a number such as 12.52 or 1.2e3.'
  const errB = countSig(f.raw.b) ? null : op === '÷' && f.raw.b.trim() === '0' ? 'Division by zero.' : 'Enter a number.'

  const sigDigits = c ? c.chars.filter((x) => x.kind === 'sig').map((x) => x.ch) : []
  const reasons = c ? [...new Set(c.chars.filter((x) => x.kind === 'lead' || x.kind === 'trail').map((x) => x.why))] : []
  const summary = c
    ? `${f.raw.n.trim()} has ${c.count} significant figure${c.count === 1 ? '' : 's'}: the digits ${sigDigits.join(', ')} (ink). ${reasons.join(' ')}${c.ambiguous ? ' Write it with a decimal point or in scientific notation to show that trailing zeros were measured.' : ''}`
    : 'Enter a number to count its significant figures.'

  return (
    <CalcLayout
      inputs={
        <>
          <NumField label="Number" {...f.bind('n')} inputMode="text" error={c ? null : 'Enter a number such as 0.00450, 1200 or 6.02e23.'} hint="Type it as written: trailing zeros and the decimal point count." />
          <NumField label="Round to significant figures" {...f.bind('round')} inputMode="numeric" error={roundOk ? null : 'Use a whole number from 1 to 30.'} />
          <p className="pt-2 text-sm font-[600] text-foreground">Calculate with measurements</p>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="First value" {...f.bind('a')} inputMode="text" error={errA} />
            <NumField label="Second value" {...f.bind('b')} inputMode="text" error={errB} />
          </div>
          <Choice label="Operation" value={op} onChange={setOp} options={OPS} />
        </>
      }
      result={
        <Result
          label="Significant figures"
          value={c ? c.count : '–'}
          format={(n) => String(Math.round(n))}
          sub={c?.ambiguous ? 'The trailing zeros may or may not be significant.' : undefined}
          error={c ? null : 'Enter a number to count.'}
          copy={c ? `${f.raw.n.trim()}: ${c.count} significant figures${rounded ? `; to ${round}: ${toPlain(rounded)}` : ''}` : undefined}
        >
          {c ? (
            <>
              <Stat label={roundOk ? `Rounded to ${round}` : 'Rounded'} value={rounded ? toPlain(rounded) : '–'} />
              <Stat label="Scientific notation" value={rounded ? sciText(rounded) : '–'} />
              <Stat label="Exact form typed" value={sciText(c.dec)} />
              <Stat
                label={`${f.raw.a.trim()} ${op} ${f.raw.b.trim()}`}
                value={arith ? toPlain(arith.rounded) : '–'}
              />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage summary={summary}>
          <div className="flex min-h-48 items-center justify-center overflow-x-auto px-4 py-10">
            {c ? (
              <div key={f.raw.n} className="flex items-end gap-1 font-mono text-[1.75rem] leading-none font-[650] sm:text-[2.25rem]" aria-hidden="true">
                {c.chars.map((ch, i) => {
                  const isDigit = ch.kind === 'sig' || ch.kind === 'lead' || ch.kind === 'trail'
                  return (
                    <span
                      key={i}
                      title={ch.why}
                      className={cn(
                        'enter grid place-items-center rounded-md',
                        isDigit ? 'h-14 w-10 sm:h-16 sm:w-12' : 'h-14 px-0.5 sm:h-16',
                        ch.kind === 'sig' && 'bg-foreground text-background',
                        (ch.kind === 'lead' || ch.kind === 'trail') && 'bg-background text-muted-foreground',
                        (ch.kind === 'point' || ch.kind === 'sign') && 'text-foreground',
                        ch.kind === 'exp' && 'pl-2 text-[1rem] text-muted-foreground sm:text-[1.25rem]',
                      )}
                      style={{ ['--i' as string]: i }}
                    >
                      {ch.kind === 'exp' ? ch.ch.replace(/\^(-?\d+)/, (_, e: string) => sup(e)) : ch.ch}
                    </span>
                  )
                })}
              </div>
            ) : null}
          </div>
        </Stage>
      }
      working={
        c ? (
          <Working
            title="Rules and working"
            lines={[
              ...c.chars.filter((x) => x.kind !== 'point').map((x) => `${x.ch.padEnd(3)} ${x.why}`),
              `count = ${c.count}`,
              ...(rounded ? [`to ${round} figures: ${toPlain(rounded)} = ${sciText(rounded)}`] : []),
              ...(arith ? [`${f.raw.a.trim()} ${op} ${f.raw.b.trim()} = ${arith.raw} → ${toPlain(arith.rounded)}`, arith.rule] : []),
            ]}
          />
        ) : null
      }
    />
  )
}
