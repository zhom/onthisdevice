import { useEffect, useRef, useState } from 'react'
import { CalcLayout, NumField, Result, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { sup } from './_viz/format'
import { useSimLoop } from './_viz/hooks'
import { magnitude, parseDec, roundSig, toEngParts, toPlain, toSciParts } from './scinot'
import { cn } from '@/lib/utils'

const STEP = 0.24
const HOLD_START = 0.9
const HOLD_END = 1.8
const MAX_CELLS = 40

export default function ScientificNotation() {
  const f = useFields({ n: '0.00004056', sig: '' })
  const p = parseDec(f.raw.n)
  const sigEmpty = f.raw.sig.trim() === ''
  const sigN = f.num.sig
  const sigOk = sigEmpty || (sigN !== null && Number.isInteger(sigN) && sigN >= 1 && sigN <= 50)
  const d = p ? (!sigEmpty && sigOk ? roundSig(p.dec, sigN!) : p.dec) : null
  const sci = d ? toSciParts(d) : null
  const eng = d ? toEngParts(d) : null
  const plain = d ? toPlain(d) : ''
  const plainGrouped = d ? toPlain(d, true) : ''
  const eText = sci ? `${sci.mant.replace('−', '-')}E${sci.exp}` : ''
  const sciText = sci ? (sci.exp === 0 ? sci.mant : `${sci.mant} × 10${sup(sci.exp)}`) : ''
  const engText = eng ? (eng.exp === 0 ? eng.mant : `${eng.mant} × 10${sup(eng.exp)}`) : ''

  // The digits of the plain decimal and where its point starts and ends.
  const bare = plain.replace('−', '')
  const dot = bare.indexOf('.')
  const cells = bare.replace('.', '').split('')
  const startPos = dot < 0 ? cells.length : dot
  const firstSig = cells.findIndex((c) => c !== '0')
  const endPos = firstSig < 0 ? startPos : firstSig + 1
  const steps = endPos - startPos
  const drawable = d !== null && cells.length <= MAX_CELLS && d.digits !== '0'

  /* animation: the point hops one place per step */
  const box = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(true)
  const [k, setK] = useState(0)
  const clock = useRef({ t: 0 })
  const total = HOLD_START + Math.abs(steps) * STEP + HOLD_END
  const { reduced } = useSimLoop(
    box,
    (dt) => {
      const c = clock.current
      c.t = (c.t + dt) % total
      const n = Math.max(0, Math.min(Math.abs(steps), Math.floor((c.t - HOLD_START) / STEP) + 1))
      setK((old) => (old === n ? old : n))
    },
    playing && drawable && steps !== 0,
  )
  useEffect(() => {
    clock.current.t = 0
    setK(0)
  }, [plain])
  const shownK = reduced ? Math.abs(steps) : k
  const pos = startPos + Math.sign(steps) * shownK
  const exp = startPos - pos

  const summary = d
    ? `${plainGrouped} is ${sciText} in scientific notation. The decimal point moves ${Math.abs(steps)} place${Math.abs(steps) === 1 ? '' : 's'} to the ${steps > 0 ? 'right' : 'left'}${steps === 0 ? ' (it is already in place)' : ''}, so the power of ten is ${sci!.exp}. Engineering notation uses a power that is a multiple of 3: ${engText}.`
    : 'Enter a number such as 0.00004056, 299792458 or 6.022e23.'

  return (
    <CalcLayout
      inputs={
        <>
          <NumField
            label="Number"
            {...f.bind('n')}
            inputMode="text"
            error={p ? null : 'Enter a number such as 0.00045, 1.2e-7 or 3.0 × 10^8.'}
            hint="Decimal, E notation (6.022e23) or × 10^n."
          />
          <NumField label="Significant figures" {...f.bind('sig')} inputMode="numeric" placeholder="Keep all" error={sigOk ? null : 'Use a whole number from 1 to 50, or leave it empty.'} />
        </>
      }
      result={
        <Result
          label="Scientific notation"
          value={d ? sciText : '–'}
          error={d ? null : 'Enter a number to convert.'}
          copy={d ? sciText : undefined}
        >
          {d ? (
            <>
              <Stat label="E notation" value={eText} />
              <Stat label="Engineering" value={engText} />
              <Stat label="Decimal" value={plainGrouped} />
              <Stat label="Order of magnitude" value={String(magnitude(d))} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage
          summary={summary}
          bar={drawable && steps !== 0 ? <SimBar playing={playing} onPlaying={setPlaying} scale={`${STEP * 1000} ms per place`} reduced={reduced} /> : undefined}
        >
          <div ref={box} className="flex min-h-52 flex-col items-center justify-center gap-5 overflow-x-auto px-4 py-8" aria-hidden="true">
            {drawable ? (
              <>
                <div className="relative flex font-mono text-[1.5rem] leading-none font-[650] sm:text-[2rem]">
                  {d!.neg ? <span className="pr-1">−</span> : null}
                  <span className="relative inline-flex">
                    {cells.map((c, i) => (
                      <span
                        key={i}
                        className={cn(
                          'inline-block w-[1.25ch] text-center',
                          i < firstSig ? 'text-muted-foreground' : 'text-foreground',
                        )}
                      >
                        {c}
                      </span>
                    ))}
                    <span
                      className="absolute top-0 left-0 w-0 text-foreground transition-transform duration-200 ease-(--ease-out)"
                      style={{ transform: `translateX(${pos * 1.25 - 0.5}ch)` }}
                    >
                      .
                    </span>
                  </span>
                </div>
                <p className="font-mono text-[1.25rem] font-[650] text-foreground tabular-nums sm:text-[1.5rem]">
                  × 10{sup(exp)}
                </p>
              </>
            ) : (
              <p className="text-[1.5rem] font-[650]">{sciText}</p>
            )}
          </div>
        </Stage>
      }
      working={
        d && sci ? (
          <Working
            lines={[
              `number          ${plainGrouped}`,
              `move the point  ${Math.abs(steps)} place${Math.abs(steps) === 1 ? '' : 's'} ${steps > 0 ? 'right' : steps < 0 ? 'left' : ''} → ${sci.mant}`,
              ...(steps !== 0 ? [`power of ten    moves to the ${steps > 0 ? 'right give a negative' : 'left give a positive'} power: ${sci.exp}`] : []),
              `scientific      ${sciText}`,
              `E notation      ${eText}`,
              `engineering     ${engText}`,
            ]}
          />
        ) : null
      }
    />
  )
}
