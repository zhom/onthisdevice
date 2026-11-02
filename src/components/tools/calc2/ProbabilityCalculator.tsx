import { useEffect, useId, useRef, useState } from 'react'
import { useTweenArray } from '@/components/viz/tween'
import { CalcLayout, Choice, NumField, Result, Stage, Stat, Working } from './_viz/Calc'
import { dec, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import { atLeastOnce, twoEvents } from './prob'

type Mode = 'pct' | 'dec'

export default function ProbabilityCalculator() {
  const [mode, setMode] = useState<Mode>('pct')
  const [pa, setPa] = useState('50')
  const [pb, setPb] = useState('40')
  const [trials, setTrials] = useState('4')
  const scale = mode === 'pct' ? 100 : 1
  const read = (s: string) => {
    const v = Number(s.replace(/[−–]/g, '-').replace(/[,\s%]/g, ''))
    return s.trim() === '' || !Number.isFinite(v) ? null : v / scale
  }
  const a = read(pa)
  const b = read(pb)
  const nRaw = Number(trials)
  const n = Number.isInteger(nRaw) && nRaw >= 1 && nRaw <= 10000 ? nRaw : null
  const errP = (v: number | null) => (v === null ? 'Enter a probability.' : v < 0 || v > 1 ? (mode === 'pct' ? 'Use 0 to 100.' : 'Use 0 to 1.') : null)
  const ok = errP(a) === null && errP(b) === null
  const e = ok ? twoEvents(a!, b!) : null
  const once = ok && n ? atLeastOnce(a!, n) : null
  const P = (v: number) => (mode === 'pct' ? `${dec(v * 100, 4)}%` : dec(v, 6))

  const switchMode = (m: Mode) => {
    if (m === mode) return
    const conv = (s: string) => {
      const v = read(s)
      return v === null ? s : m === 'pct' ? String(Number((v * 100).toPrecision(10))) : String(Number(v.toPrecision(10)))
    }
    setPa(conv(pa))
    setPb(conv(pb))
    setMode(m)
  }

  const working = e
    ? [
        `P(A) = ${num(a!)}   P(B) = ${num(b!)}   (independent)`,
        `P(A and B)   = P(A) × P(B) = ${num(a!)} × ${num(b!)} = ${num(e.and)}`,
        `P(A or B)    = P(A) + P(B) − P(A and B) = ${num(a!)} + ${num(b!)} − ${num(e.and)} = ${num(e.or)}`,
        `P(not A)     = 1 − P(A) = 1 − ${num(a!)} = ${num(e.notA)}`,
        `P(not B)     = 1 − P(B) = 1 − ${num(b!)} = ${num(e.notB)}`,
        `P(exactly 1) = P(A) + P(B) − 2 P(A and B) = ${num(e.exactlyOne)}`,
        `P(neither)   = (1 − P(A)) × (1 − P(B)) = ${num(e.notA)} × ${num(e.notB)} = ${num(e.neither)}`,
        ...(once !== null ? [`P(A at least once in ${n} trials) = 1 − (1 − P(A))^n = 1 − ${num(e.notA)}^${n} = ${num(once)}`] : []),
      ]
    : []

  return (
    <CalcLayout
      inputs={
        <>
          <Choice
            label="Enter probabilities as"
            value={mode}
            onChange={switchMode}
            options={[
              { value: 'pct', label: 'Percent' },
              { value: 'dec', label: 'Decimal' },
            ]}
          />
          <NumField label="P(A)" value={pa} onChange={setPa} unit={mode === 'pct' ? '%' : undefined} slider={{ min: 0, max: scale, step: scale / 100 }} error={errP(a)} />
          <NumField label="P(B)" value={pb} onChange={setPb} unit={mode === 'pct' ? '%' : undefined} slider={{ min: 0, max: scale, step: scale / 100 }} error={errP(b)} />
          <NumField
            label="Trials for A"
            value={trials}
            onChange={setTrials}
            inputMode="numeric"
            hint="For the chance that A happens at least once."
            error={n === null ? 'Use a whole number from 1 to 10,000.' : null}
          />
        </>
      }
      result={
        <Result
          label="P(A and B), both happen"
          value={e ? P(e.and) : '–'}
          error={ok ? null : 'Enter both probabilities.'}
          copy={e ? `P(A and B) ${P(e.and)}; P(A or B) ${P(e.or)}; P(neither) ${P(e.neither)}` : undefined}
        >
          {e ? (
            <>
              <Stat label="P(A or B)" value={P(e.or)} />
              <Stat label="P(exactly one)" value={P(e.exactlyOne)} />
              <Stat label="P(neither)" value={P(e.neither)} />
              <Stat label="P(not A)" value={P(e.notA)} />
              <Stat label="P(not B)" value={P(e.notB)} />
              {once !== null ? <Stat label={`P(A at least once in ${n})`} value={P(once)} /> : null}
            </>
          ) : null}
        </Result>
      }
      visual={
        e ? (
          <Stage
            summary={`The square has area 1. A takes the left ${P(a!)}, B the top ${P(b!)}. Solid ink: both (${P(e.and)}). Hatched: A only (${P(e.aNotB)}). Dotted: B only (${P(e.bNotA)}). Plain: neither (${P(e.neither)}).${once !== null ? ` Below, runs of ${n} trials repeat; a run counts when A happens at least once, which the formula puts at ${P(once)}.` : ''}`}
          >
            <AreaSquare a={a!} b={b!} P={P} />
            {n !== null ? <TrialRuns p={a!} n={n} expected={once!} P={P} /> : null}
          </Stage>
        ) : null
      }
      working={working.length ? <Working lines={working} caption="A and B are independent: one does not change the chance of the other." /> : null}
    />
  )
}

function AreaSquare({ a, b, P }: { a: number; b: number; P: (v: number) => string }) {
  const uid = useId().replace(/:/g, '')
  const [ta, tb] = useTweenArray([a, b], { duration: 380 }) as [number, number]
  const S = 300
  const x = ta * S
  const y = tb * S
  const lab = (v: number, cx: number, cy: number, w: number, h: number, invert = false) =>
    w > 44 && h > 22 ? (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        paintOrder="stroke"
        strokeWidth={invert ? 0 : 5}
        strokeLinejoin="round"
        className={invert ? 'fill-background text-[13px] font-[650]' : 'fill-foreground stroke-background text-[13px] font-[650]'}
      >
        {P(v)}
      </text>
    ) : null
  return (
    <svg viewBox={`-28 -26 ${S + 44} ${S + 40}`} className="mx-auto block w-full max-w-[26rem] p-3" role="img" aria-label="Area model of A and B">
      <defs>
        <pattern id={`${uid}-h`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="1.6" height="6" style={{ fill: 'var(--foreground)' }} />
        </pattern>
        <pattern id={`${uid}-d`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.2" style={{ fill: 'var(--foreground)' }} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={S} height={S} className="fill-background" />
      <rect x={0} y={0} width={x} height={y} className="fill-foreground" />
      <rect x={0} y={y} width={x} height={S - y} style={{ fill: `url(#${uid}-h)` }} />
      <rect x={x} y={0} width={S - x} height={y} style={{ fill: `url(#${uid}-d)` }} />
      {lab(ta * tb, x / 2, y / 2, x, y, true)}
      {lab(ta * (1 - tb), x / 2, y + (S - y) / 2, x, S - y)}
      {lab((1 - ta) * tb, x + (S - x) / 2, y / 2, S - x, y)}
      {lab((1 - ta) * (1 - tb), x + (S - x) / 2, y + (S - y) / 2, S - x, S - y)}
      <text x={x / 2} y={-10} textAnchor="middle" className="fill-muted-foreground text-[12px] font-[600]">
        A
      </text>
      <text x={x + (S - x) / 2} y={-10} textAnchor="middle" className="fill-muted-foreground text-[12px] font-[600]">
        not A
      </text>
      <text x={-10} y={y / 2} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[12px] font-[600]">
        B
      </text>
    </svg>
  )
}

/** Repeated runs of n trials of A; counts the runs where A happens at least once. */
function TrialRuns({ p, n, expected, P }: { p: number; n: number; expected: number; P: (v: number) => string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const out = useRef<HTMLParagraphElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const shown = Math.min(n, 120)
  const run = useRef<boolean[]>([])
  const prog = useRef(0)
  const stats = useRef({ runs: 0, hits: 0 })
  const fresh = () => {
    const r: boolean[] = []
    for (let i = 0; i < n; i++) r.push(Math.random() < p)
    return r
  }
  useEffect(() => {
    run.current = fresh()
    prog.current = 0
    stats.current = { runs: 0, hits: 0 }
  }, [p, n])
  const paint = () => {
    const c = prepCanvas(canvas.current)
    if (!c) return
    const { ctx, w, h } = c
    const cols = Math.min(shown, Math.max(10, Math.floor(w / 20)))
    const size = Math.min(16, (w - 32) / cols - 4)
    const rows = Math.ceil(shown / cols)
    const gx = (w - cols * (size + 4)) / 2
    const gy = (h - rows * (size + 4)) / 2
    const revealed = Math.floor(prog.current * shown)
    for (let i = 0; i < shown; i++) {
      const x = gx + (i % cols) * (size + 4)
      const y = gy + Math.floor(i / cols) * (size + 4)
      ctx.fillStyle = i < revealed && run.current[i] ? ink.ink : ink.paper
      ctx.fillRect(x, y, size, size)
    }
    if (out.current) {
      const s = stats.current
      out.current.textContent = `Runs with A at least once: ${s.hits} of ${s.runs}${s.runs ? ` (${P(s.hits / s.runs)})` : ''}. Expected ${P(expected)}.${n > shown ? ` First ${shown} of ${n} trials shown.` : ''}`
    }
  }
  const { reduced } = useSimLoop(canvas, (dt) => {
    prog.current += dt / 1.1
    if (prog.current >= 1.35) {
      stats.current.runs++
      if (run.current.some(Boolean)) stats.current.hits++
      run.current = fresh()
      prog.current = 0
    }
    paint()
  })
  useEffect(() => {
    if (reduced) prog.current = 1
    paint()
  })
  if (reduced) return null
  return (
    <div className="px-4 pb-4 sm:px-5">
      <canvas
        ref={canvas}
        className="block w-full"
        style={{ height: `${Math.ceil(shown / 14) * 20 + 12}px` }}
        role="img"
        aria-label={`Simulated runs of ${n} trials`}
      />
      <p ref={out} className="mt-1 text-[0.8125rem] text-muted-foreground tabular-nums" aria-hidden="true" />
    </div>
  )
}
