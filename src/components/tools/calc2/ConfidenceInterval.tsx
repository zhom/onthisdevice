import { useEffect, useRef, useState } from 'react'
import { useTweenArray } from '@/components/viz/tween'
import { CalcLayout, Choice, NumField, Result, SelectField, SimBar, Stage, Stat, Working, useFields } from './_viz/Calc'
import { dashed, label } from './_viz/draw'
import { dec, fmt, num } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { meanInterval, waldInterval, wilsonInterval } from './ci'
import type { Interval } from './ci'

type Kind = 'mean' | 'prop'
type Sd = 'sample' | 'known'
type Method = 'wilson' | 'wald'
type Level = '0.8' | '0.9' | '0.95' | '0.98' | '0.99' | '0.999'
const LEVELS: { value: Level; label: string }[] = [
  { value: '0.8', label: '80%' },
  { value: '0.9', label: '90%' },
  { value: '0.95', label: '95%' },
  { value: '0.98', label: '98%' },
  { value: '0.99', label: '99%' },
  { value: '0.999', label: '99.9%' },
]

function gauss(): number {
  let u = 0
  while (u === 0) u = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random())
}

interface Spec {
  kind: Kind
  truth: number
  sd: number
  n: number
  level: number
  known: boolean
  method: Method
}

/** One simulated sample from the population the inputs describe, and its interval. */
function simulate(s: Spec): Interval {
  if (s.kind === 'mean') {
    let m: number
    let sd = s.sd
    if (s.n <= 400) {
      let sum = 0
      let sq = 0
      for (let i = 0; i < s.n; i++) {
        const v = s.truth + s.sd * gauss()
        sum += v
        sq += v * v
      }
      m = sum / s.n
      if (!s.known) sd = Math.sqrt(Math.max(0, (sq - s.n * m * m) / (s.n - 1)))
    } else {
      m = s.truth + (s.sd / Math.sqrt(s.n)) * gauss()
      if (!s.known) sd = s.sd * (1 + gauss() / Math.sqrt(2 * (s.n - 1)))
    }
    return meanInterval(m, sd, s.n, s.level, s.known)
  }
  let x: number
  if (s.n <= 400) {
    x = 0
    for (let i = 0; i < s.n; i++) if (Math.random() < s.truth) x++
  } else x = Math.round(Math.min(s.n, Math.max(0, s.n * s.truth + Math.sqrt(s.n * s.truth * (1 - s.truth)) * gauss())))
  return s.method === 'wilson' ? wilsonInterval(x, s.n, s.level) : waldInterval(x, s.n, s.level)
}

const ROWS = 16
const ROW = 10

export default function ConfidenceInterval() {
  const [kind, setKind] = useState<Kind>('mean')
  const [sdKind, setSdKind] = useState<Sd>('sample')
  const [method, setMethod] = useState<Method>('wilson')
  const [levelS, setLevelS] = useState<Level>('0.95')
  const f = useFields({ mean: '50', sd: '8', n: '36', x: '420', np: '1000' })
  const level = Number(levelS)
  const { mean, sd, n, x, np } = f.num
  const isInt = (v: number | null) => v !== null && Number.isInteger(v)

  const err =
    kind === 'mean'
      ? {
          mean: mean === null ? 'Enter the sample mean.' : null,
          sd: sd === null ? 'Enter the standard deviation.' : sd <= 0 ? 'Use a value above zero.' : null,
          n: !isInt(n) || n! < 2 ? 'Use a whole number of 2 or more.' : null,
        }
      : {
          x: !isInt(x) || x! < 0 ? 'Use a whole number of 0 or more.' : np !== null && x! > np ? 'Successes cannot exceed the sample size.' : null,
          np: !isInt(np) || np! < 1 ? 'Use a whole number of 1 or more.' : null,
        }
  const ok = !Object.values(err).some(Boolean)
  const known = sdKind === 'known'
  const iv: Interval | null = !ok
    ? null
    : kind === 'mean'
      ? meanInterval(mean!, sd!, n!, level, known)
      : method === 'wilson'
        ? wilsonInterval(x!, np!, level)
        : waldInterval(x!, np!, level)
  const centre = kind === 'mean' ? (mean ?? 0) : ok ? x! / np! : 0
  const spec: Spec | null = ok
    ? { kind, truth: centre, sd: kind === 'mean' ? sd! : 0, n: kind === 'mean' ? n! : np!, level, known, method }
    : null

  const pct = `${dec(level * 100, 1)}%`
  const V = (v: number) => (kind === 'mean' ? fmt(v, 6) : `${dec(v * 100, 2)}%`)
  const critName = kind === 'mean' && !known ? `t(${n! - 1})` : 'z'

  /* simulation */
  const canvas = useRef<HTMLCanvasElement>(null)
  const tally = useRef<HTMLSpanElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [playing, setPlaying] = useState(true)
  const sim = useRef({ list: [] as Interval[], timer: 0, slide: 1, runs: 0, hits: 0 })
  const shownIv = useTweenArray(iv ? [iv.lo, iv.hi] : [centre, centre])

  const restart = () => {
    const s = sim.current
    s.list = []
    s.timer = 0
    s.slide = 1
    s.runs = 0
    s.hits = 0
  }
  useEffect(restart, [kind, sdKind, method, levelS, mean, sd, n, x, np])

  const paint = () => {
    if (!spec || !iv) return
    const p = prepCanvas(canvas.current)
    if (p) drawIntervals(p.ctx, p.w, p.h, spec, iv, shownIv, sim.current, ink, V)
    const s = sim.current
    if (tally.current) tally.current.textContent = s.runs ? `${s.hits} of ${s.runs} contain it (${dec((s.hits / s.runs) * 100, 1)}%)` : ''
  }

  const add = () => {
    if (!spec) return
    const s = sim.current
    const one = simulate(spec)
    s.list.unshift(one)
    if (s.list.length > ROWS + 1) s.list.pop()
    s.runs++
    if (one.lo <= spec.truth && spec.truth <= one.hi) s.hits++
    s.slide = 0
  }

  const { reduced } = useSimLoop(
    canvas,
    (dt) => {
      const s = sim.current
      s.timer += dt
      s.slide = Math.min(1, s.slide + dt / 0.22)
      if (s.timer > 0.35) {
        s.timer = 0
        add()
      }
      paint()
    },
    playing && ok,
  )

  useEffect(() => {
    if (reduced && spec && sim.current.list.length < ROWS) {
      for (let i = 0; i < ROWS; i++) add()
      sim.current.slide = 1
    }
    paint()
  })

  const summary = iv
    ? `The ${pct} interval runs from ${V(iv.lo)} to ${V(iv.hi)}. The rows below it are intervals from new random samples of the same size, drawn from a population whose true ${kind === 'mean' ? 'mean' : 'proportion'} is ${V(centre)} (the dashed line). About ${pct} of them contain it; the ones that miss are drawn in ink with a mark at the end.`
    : 'Enter the sample figures to see the interval.'

  const working =
    iv && ok
      ? kind === 'mean'
        ? [
            `SE = s ÷ √n = ${num(sd!)} ÷ √${n} = ${num(iv.se)}`,
            `${critName} for ${pct} = ${num(iv.crit)}`,
            `margin = ${critName} × SE = ${num(iv.crit)} × ${num(iv.se)} = ${num(iv.margin)}`,
            `interval = x̄ ± margin = ${num(mean!)} ± ${num(iv.margin)} = ${num(iv.lo)} to ${num(iv.hi)}`,
          ]
        : method === 'wald'
          ? [
              `p̂ = x ÷ n = ${x} ÷ ${np} = ${num(centre)}`,
              `SE = √(p̂(1 − p̂) ÷ n) = √(${num(centre)} × ${num(1 - centre)} ÷ ${np}) = ${num(iv.se)}`,
              `margin = z × SE = ${num(iv.crit)} × ${num(iv.se)} = ${num(iv.margin)}`,
              `interval = p̂ ± margin = ${num(iv.lo)} to ${num(iv.hi)}`,
            ]
          : [
              `p̂ = x ÷ n = ${x} ÷ ${np} = ${num(centre)},  z = ${num(iv.crit)}`,
              `centre = (p̂ + z² ÷ 2n) ÷ (1 + z² ÷ n) = ${num((iv.lo + iv.hi) / 2)}`,
              `margin = z √(p̂(1 − p̂) ÷ n + z² ÷ 4n²) ÷ (1 + z² ÷ n) = ${num(iv.margin)}`,
              `interval = centre ± margin = ${num(iv.lo)} to ${num(iv.hi)}`,
            ]
      : []

  return (
    <CalcLayout
      inputs={
        <>
          <Choice label="Interval for" value={kind} onChange={setKind} options={[{ value: 'mean', label: 'A mean' }, { value: 'prop', label: 'A proportion' }]} />
          {kind === 'mean' ? (
            <>
              <NumField label="Sample mean (x̄)" {...f.bind('mean')} error={err.mean} />
              <NumField label="Standard deviation" {...f.bind('sd')} error={err.sd} />
              <NumField label="Sample size (n)" {...f.bind('n')} inputMode="numeric" error={err.n} />
              <Choice
                label="The standard deviation is"
                value={sdKind}
                onChange={setSdKind}
                options={[{ value: 'sample', label: 'From the sample (t)' }, { value: 'known', label: 'Known σ (z)' }]}
              />
            </>
          ) : (
            <>
              <NumField label="Successes (x)" {...f.bind('x')} inputMode="numeric" error={err.x} />
              <NumField label="Sample size (n)" {...f.bind('np')} inputMode="numeric" error={err.np} />
              <Choice label="Method" value={method} onChange={setMethod} options={[{ value: 'wilson', label: 'Wilson' }, { value: 'wald', label: 'Wald' }]} />
            </>
          )}
          <SelectField label="Confidence level" value={levelS} onChange={setLevelS} options={LEVELS} />
        </>
      }
      result={
        <Result
          label={`${pct} confidence interval`}
          value={iv ? `${V(iv.lo)} to ${V(iv.hi)}` : '–'}
          sub={iv ? `${kind === 'mean' ? fmt(mean!, 6) : V(centre)} ± ${kind === 'mean' ? fmt(iv.margin, 5) : `${dec(iv.margin * 100, 2)} points`}` : undefined}
          error={ok ? null : Object.values(err).find(Boolean)}
          copy={iv ? `${pct} confidence interval: ${V(iv.lo)} to ${V(iv.hi)} (margin of error ${kind === 'mean' ? fmt(iv.margin, 5) : V(iv.margin)})` : undefined}
        >
          {iv ? (
            <>
              <Stat label="Margin of error" value={kind === 'mean' ? fmt(iv.margin, 5) : `${dec(iv.margin * 100, 3)}%`} />
              <Stat label={`Critical value ${critName}`} value={dec(iv.crit, 4)} />
              <Stat label="Standard error" value={kind === 'mean' ? fmt(iv.se, 5) : dec(iv.se, 5)} />
              <Stat label="Width" value={kind === 'mean' ? fmt(iv.hi - iv.lo, 5) : `${dec((iv.hi - iv.lo) * 100, 3)}%`} />
            </>
          ) : null}
        </Result>
      }
      visual={
        <Stage
          summary={summary}
          bar={<SimBar playing={playing} onPlaying={setPlaying} onReplay={restart} scale="A new sample every 0.35 s" reduced={reduced} clock={tally} />}
        >
          <canvas
            ref={canvas}
            className="block w-full"
            style={{ height: `${64 + ROWS * ROW + 28}px` }}
            role="img"
            aria-label={iv ? `Confidence interval from ${V(iv.lo)} to ${V(iv.hi)} and repeated sample intervals` : 'Confidence interval'}
          />
        </Stage>
      }
      working={working.length ? <Working lines={working} caption="SE is the standard error. The critical value leaves (1 − level) ÷ 2 in each tail." /> : null}
    />
  )
}

function drawIntervals(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: Spec,
  iv: Interval,
  shown: number[],
  sim: { list: Interval[]; slide: number },
  ink: Ink,
  V: (v: number) => string,
) {
  const half = Math.max(iv.margin * 2.2, 1e-9)
  const lo = s.truth - half
  const hi = s.truth + half
  const X = (v: number) => 16 + ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (w - 32)
  const cx = X(s.truth)
  dashed(ctx, cx, 14, cx, h - 22, ink.grey, 1, [3, 4])
  label(ctx, V(s.truth), cx, h - 6, { color: ink.grey, halo: ink.fill, font: ink.font, size: 11, align: 'center' })

  // the visitor's interval
  const [a = s.truth, b = s.truth] = shown
  ctx.fillStyle = ink.ink
  ctx.fillRect(X(a), 34, Math.max(2, X(b) - X(a)), 8)
  label(ctx, V(iv.lo), X(a), 26, { color: ink.ink, halo: ink.fill, font: ink.font, size: 11, align: 'left' })
  label(ctx, V(iv.hi), X(b), 26, { color: ink.ink, halo: ink.fill, font: ink.font, size: 11, align: 'right' })

  // repeated samples, newest on top, sliding down
  const ease = 1 - Math.pow(1 - sim.slide, 3)
  sim.list.forEach((one, i) => {
    const y = 64 + (i - 1 + ease) * ROW
    if (y < 56 || y > 64 + ROWS * ROW) return
    const miss = one.hi < s.truth || one.lo > s.truth
    ctx.fillStyle = miss ? ink.ink : ink.grey
    const th = miss ? 4 : 2
    ctx.fillRect(X(one.lo), y - th / 2, Math.max(1, X(one.hi) - X(one.lo)), th)
    if (miss) {
      const ex = one.hi < s.truth ? X(one.hi) : X(one.lo)
      ctx.fillRect(ex - 1.5, y - 5, 3, 10)
    }
  })
}
