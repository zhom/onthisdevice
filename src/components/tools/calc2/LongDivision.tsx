import { useEffect, useRef, useState } from 'react'
import { CalcLayout, NumField, Result, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { useSimLoop } from './_viz/hooks'
import { decimalText, longDivide } from './longdiv'
import type { LongDivision as LD } from './longdiv'

const STEP_S = 1.1
const HOLD_S = 2.6
const MAX_DIGITS = 30

const readInt = (s: string): bigint | null => {
  const t = s.trim().replace(/[,_\s]/g, '')
  return /^\d+$/.test(t) ? BigInt(t) : null
}

interface Layout {
  /** Quotient characters: column and the step that writes them. */
  q: { pos: number; ch: string; step: number }[]
  /** Lines under the quotient, with the step at which each appears. A rule is a line `len` columns long from `start`. */
  lines: { text: string; step: number; rule?: { start: number; len: number } }[]
  width: number
}

/** The written layout in monospace columns. */
function layout(d: LD, decimals: number): Layout {
  const dv = d.divisor.toString()
  const intDigits = d.dividend.toString()
  const P = dv.length + 1
  const lastCol = intDigits.length - 1 + decimals
  const at = (col: number) => P + col + (decimals > 0 && col >= intDigits.length ? 1 : 0)
  const width = at(lastCol) + 1
  const put = (line: string[], endCol: number, s: string) => {
    const end = at(endCol)
    for (let k = 0; k < s.length; k++) line[end - s.length + 1 + k] = s[k]!
  }
  const blank = () => Array.from({ length: width + 1 }, () => ' ')
  const out: Layout['lines'] = []
  const q: Layout['q'] = []
  d.steps.forEach((s, i) => {
    if (decimals > 0 && s.col === intDigits.length) q.push({ pos: at(s.col) - 1, ch: '.', step: i + 1 })
    q.push({ pos: at(s.col), ch: String(s.q), step: i + 1 })
  })
  out.push({ text: '', step: 0, rule: { start: P, len: width - P } })
  out.push({ text: `${dv})${intDigits}${decimals > 0 ? `.${'0'.repeat(decimals)}` : ''}`, step: 0 })
  d.steps.forEach((s, i) => {
    if (i > 0) {
      const l = blank()
      put(l, s.col, s.partial.toString())
      out.push({ text: l.join(''), step: i + 1 })
    }
    const prod = s.product.toString()
    const l = blank()
    put(l, s.col, prod)
    l[at(s.col) - prod.length] = '−'
    out.push({ text: l.join(''), step: i + 1 })
    const len = Math.max(prod.length + 1, s.partial.toString().length)
    out.push({ text: '', step: i + 1, rule: { start: at(s.col) - len + 1, len } })
  })
  const last = d.steps[d.steps.length - 1]
  if (last) {
    const l = blank()
    put(l, last.col, last.rem.toString())
    out.push({ text: l.join(''), step: d.steps.length + 1 })
  }
  return { q, lines: out, width: width + 1 }
}

export default function LongDivision() {
  const f = useFields({ a: '1234', b: '7', dp: '0' })
  const a = readInt(f.raw.a)
  const b = readInt(f.raw.b)
  const dp = f.num.dp
  const err = {
    a: a === null ? 'Enter a whole number of 0 or more.' : f.raw.a.replace(/\D/g, '').length > MAX_DIGITS ? `Use at most ${MAX_DIGITS} digits.` : null,
    b: b === null ? 'Enter a whole number.' : b === 0n ? 'You cannot divide by zero.' : b > 10n ** 12n ? 'Use a divisor below one trillion.' : null,
    dp: dp === null || !Number.isInteger(dp) || dp < 0 || dp > 10 ? 'Use 0 to 10.' : null,
  }
  const ok = !err.a && !err.b && !err.dp
  const d = ok ? longDivide(a!, b!, dp!) : null
  const decimals = d ? d.steps.filter((s) => s.col >= a!.toString().length).length : 0
  const lay = d ? layout(d, decimals) : null
  const total = d ? d.steps.length + 1 : 0

  /* reveal the steps one by one */
  const box = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(true)
  const [shown, setShown] = useState(total)
  const clock = useRef(0)
  const key = d ? `${a}/${b}/${dp}` : ''
  useEffect(() => {
    clock.current = 0
    setShown(0)
  }, [key])
  const { reduced } = useSimLoop(
    box,
    (dt) => {
      clock.current = (clock.current + dt) % (total * STEP_S + HOLD_S)
      const s = Math.min(total, Math.floor(clock.current / STEP_S))
      setShown((old) => (old === s ? old : s))
    },
    playing && d !== null,
  )
  const step = reduced ? total : shown
  const qLine = lay ? Array.from({ length: lay.width }, () => ' ') : []
  if (lay) for (const c of lay.q) if (c.step <= step) qLine[c.pos] = c.ch

  const qText = d ? d.quotient.toString() : ''
  const dec = d ? decimalText(d) : ''
  const summary = d
    ? `${a} ÷ ${b} = ${qText} remainder ${d.remainder}${dec !== qText ? `, or ${dec} as a decimal${d.repeat ? ' (the digits in brackets repeat)' : ''}` : ''}. The steps appear one at a time: divide, multiply, subtract, bring down the next digit.`
    : 'Enter a dividend and a divisor.'

  const working = d
    ? [
        ...d.steps.map(
          (s) =>
            `${s.partial} ÷ ${b} = ${s.q}   ${s.q} × ${b} = ${s.product}   ${s.partial} − ${s.product} = ${s.rem}`,
        ),
        `check: ${b} × ${qText} + ${d.remainder} = ${b! * d.quotient + d.remainder}`,
      ]
    : []

  return (
    <CalcLayout
      inputs={
        <>
          <NumField label="Dividend (number to divide)" {...f.bind('a')} inputMode="numeric" error={err.a} />
          <NumField label="Divisor" {...f.bind('b')} inputMode="numeric" error={err.b} />
          <NumField label="Decimal places to work out" {...f.bind('dp')} inputMode="numeric" error={err.dp} hint="0 stops at the remainder." />
        </>
      }
      result={
        <Result
          label="Quotient and remainder"
          value={d ? `${qText} R ${d.remainder}` : '–'}
          sub={d && dec !== qText ? `= ${dec}` : undefined}
          error={ok ? null : (err.b ?? err.a ?? err.dp)}
          copy={d ? `${a} ÷ ${b} = ${qText} R ${d.remainder} = ${dec}` : undefined}
        >
          {d ? (
            <>
              <Stat label="Quotient" value={qText} />
              <Stat label="Remainder" value={d.remainder.toString()} />
              <Stat label="Decimal" value={dec} />
              <Stat label="As a mixed number" value={d.remainder === 0n ? qText : `${qText} ${d.remainder}/${b}`} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage
          summary={summary}
          bar={d ? <SimBar playing={playing} onPlaying={setPlaying} scale={`One step every ${STEP_S} s`} reduced={reduced} /> : undefined}
        >
          <div ref={box} className="overflow-x-auto px-5 py-6" aria-hidden="true">
            <pre className="mx-auto w-max font-mono text-[1.0625rem] leading-[1.55] text-foreground sm:text-[1.25rem]">
              <div>{qLine.join('')}</div>
              {(lay?.lines ?? []).map((l, i) => (
                <div key={`${key}-${i}`} className={l.step <= step ? 'enter' : 'opacity-0'}>
                  {l.rule ? (
                    <div className="my-[0.3em] h-0 border-t-2 border-foreground" style={{ marginLeft: `${l.rule.start}ch`, width: `${l.rule.len}ch` }} />
                  ) : (
                    l.text
                  )}
                </div>
              ))}
            </pre>
          </div>
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="Each row: divide, multiply, subtract, then bring down the next digit." /> : null}
    />
  )
}
