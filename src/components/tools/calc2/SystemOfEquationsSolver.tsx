import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { niceStep } from '@/components/viz/scale'
import { useTweenArray } from '@/components/viz/tween'
import { cn } from '@/lib/utils'
import { CalcLayout, Choice, Result, Stage, Stat, Working } from './_viz/Calc'
import { dot, label } from './_viz/draw'
import { fmt, num, parseNum } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { solveSystem } from './linsys'
import type { SystemSolution } from './linsys'
import { det } from './matrix'
import type { Mat } from './matrix'

const VARS = ['x', 'y', 'z']
const START: Record<'2' | '3', string[][]> = {
  '2': [
    ['2', '3', '8'],
    ['1', '-1', '-1'],
  ],
  '3': [
    ['2', '1', '-1', '8'],
    ['-3', '-1', '2', '-11'],
    ['-2', '1', '2', '-3'],
  ],
}

export default function SystemOfEquationsSolver() {
  const [size, setSize] = useState<'2' | '3'>('2')
  const [cells, setCells] = useState(START)
  const g = cells[size]
  const n = Number(size)
  const aug: Mat | null = g.every((r) => r.every((v) => parseNum(v) !== null)) ? g.map((r) => r.map((v) => parseNum(v)!)) : null
  const sol = aug ? solveSystem(aug) : null
  const set = (r: number, c: number, v: string) =>
    setCells((all) => ({ ...all, [size]: all[size].map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) }))

  const coef = aug?.map((r) => r.slice(0, n)) ?? null
  const D = coef ? det(coef) : 0
  const answer = sol?.kind === 'unique' && sol.x ? sol.x.map((v, i) => `${VARS[i]} = ${fmt(v, 10)}`).join(', ') : ''

  const working =
    aug && sol
      ? [
          ...writeSystem(aug),
          '',
          `Row reduce the augmented matrix [A | b] = ${augText(aug)}`,
          ...sol.snaps.map((s) => `${s.op.padEnd(18)} ${augText(s.m)}`),
          '',
          ...conclusion(sol, n),
        ]
      : []

  return (
    <CalcLayout
      inputs={
        <>
          <Choice
            label="Unknowns"
            value={size}
            onChange={setSize}
            options={[
              { value: '2', label: '2: x and y' },
              { value: '3', label: '3: x, y and z' },
            ]}
          />
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-[600] text-foreground">Equations</legend>
            {g.map((row, r) => (
              <div key={r} className="flex flex-wrap items-center gap-1.5">
                {row.map((v, c) => (
                  <span key={c} className="flex items-center gap-1.5">
                    {c === n ? <span className="text-muted-foreground">=</span> : null}
                    <Input
                      value={v}
                      onChange={(e) => set(r, c, e.target.value)}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={c === n ? `Equation ${r + 1}, right side` : `Equation ${r + 1}, coefficient of ${VARS[c]}`}
                      aria-invalid={parseNum(v) === null ? true : undefined}
                      className="w-14 px-1.5 text-center tabular-nums"
                    />
                    {c < n ? <span className="font-[600] text-foreground">{VARS[c]}</span> : null}
                    {c < n - 1 ? <span className="text-muted-foreground">+</span> : null}
                  </span>
                ))}
              </div>
            ))}
            <p className="text-[0.8125rem] text-muted-foreground">Use a minus sign for subtraction: x − y is 1 and −1.</p>
          </fieldset>
        </>
      }
      result={
        <Result
          label={sol?.kind === 'unique' ? 'Solution' : 'Result'}
          value={sol?.kind === 'unique' ? answer : sol?.kind === 'none' ? 'No solution' : sol ? 'Infinitely many solutions' : '–'}
          error={aug ? null : 'Fill every box with a number.'}
          sub={
            sol?.kind === 'none'
              ? 'The equations contradict each other.'
              : sol?.kind === 'infinite'
                ? 'At least one equation repeats what the others say.'
                : undefined
          }
          copy={answer || undefined}
        >
          {sol ? (
            <>
              <Stat label="Determinant of A" value={fmt(D, 8)} />
              <Stat label="Rank of A and [A | b]" value={`${sol.rank} and ${sol.rankAug}`} />
            </>
          ) : null}
        </Result>
      }
      visual={
        aug && sol ? (
          n === 2 ? (
            <Stage summary={lineSummary(aug, sol)}>
              <Lines aug={aug} sol={sol} />
            </Stage>
          ) : (
            <Stage summary="The augmented matrix after each row operation; the row that changed is marked. The last frame is the reduced form, where the right column holds the answer.">
              <RowOps sol={sol} start={aug} />
            </Stage>
          )
        ) : null
      }
      working={working.length ? <Working lines={working} caption="Gauss-Jordan elimination. Values are rounded to 6 significant figures in the working." /> : null}
    />
  )
}

function augText(m: Mat): string {
  const n = m.length
  return `[${m.map((r) => `${r.slice(0, n).map((v) => num(v, 6)).join(' ')} | ${num(r[n]!, 6)}`).join(' ; ')}]`
}

function writeSystem(aug: Mat): string[] {
  const n = aug.length
  return aug.map((r) => {
    const terms = r.slice(0, n).flatMap((v, i) => (v === 0 ? [] : [{ v, i }]))
    const left = terms.length
      ? terms
          .map(({ v, i }, k) => `${k === 0 ? (v < 0 ? '−' : '') : v < 0 ? ' − ' : ' + '}${Math.abs(v) === 1 ? '' : num(Math.abs(v))}${VARS[i]}`)
          .join('')
      : '0'
    return `${left} = ${num(r[n]!)}`
  })
}

function conclusion(sol: SystemSolution, n: number): string[] {
  if (sol.kind === 'none') return [`rank A = ${sol.rank} < rank [A | b] = ${sol.rankAug}: a row reads 0 = a number that is not 0, so there is no solution.`]
  if (sol.kind === 'infinite') return [`rank A = rank [A | b] = ${sol.rank} < ${n} unknowns: ${n - sol.rank} free variable${n - sol.rank === 1 ? '' : 's'}, so there are infinitely many solutions.`]
  return sol.x!.map((v, i) => `${VARS[i]} = ${num(v, 10)}`)
}

function lineSummary(aug: Mat, sol: SystemSolution): string {
  const eq = writeSystem(aug)
  if (sol.kind === 'unique') return `The line ${eq[0]} (solid) and the line ${eq[1]} (dashed) cross at (${fmt(sol.x![0]!, 6)}, ${fmt(sol.x![1]!, 6)}), the solution.`
  if (sol.kind === 'none') return `The lines ${eq[0]} and ${eq[1]} are parallel and never meet, so there is no solution.`
  return `The equations ${eq[0]} and ${eq[1]} describe the same line, so every point on it is a solution.`
}

/* ── two lines on the plane ──────────────────────────────────────── */

function Lines({ aug, sol }: { aug: Mat; sol: SystemSolution }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const [cx, cy] = sol.kind === 'unique' ? [sol.x![0]!, sol.x![1]!] : [0, 0]
  const span = Math.max(10, 2.6 * Math.max(Math.abs(cx), Math.abs(cy)))
  const target = [...aug[0]!, ...aug[1]!, cx, cy, span].map((v) => (Number.isFinite(v) ? v : 0))
  const t = useTweenArray(target, { duration: 420 })
  useEffect(() => {
    const p = prepCanvas(canvas.current)
    if (p) drawLines(p.ctx, p.w, p.h, t, ink)
  })
  return <canvas ref={canvas} className="block aspect-square w-full sm:aspect-[4/3]" role="img" aria-label="The two equations drawn as lines" />
}

function drawLines(ctx: CanvasRenderingContext2D, w: number, h: number, t: number[], ink: Ink) {
  const [a1, b1, c1, a2, b2, c2, cx, cy, span] = t as [number, number, number, number, number, number, number, number, number]
  const ppu = w / span
  const left = cx - w / 2 / ppu
  const top = cy + h / 2 / ppu
  const X = (x: number) => (x - left) * ppu
  const Y = (y: number) => (top - y) * ppu
  const step = niceStep(span, 8)
  ctx.strokeStyle = ink.paper
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = Math.ceil(left / step) * step; x <= left + span; x += step) {
    ctx.moveTo(Math.round(X(x)) + 0.5, 0)
    ctx.lineTo(Math.round(X(x)) + 0.5, h)
  }
  for (let y = Math.floor(top / step) * step; y >= top - h / ppu; y -= step) {
    ctx.moveTo(0, Math.round(Y(y)) + 0.5)
    ctx.lineTo(w, Math.round(Y(y)) + 0.5)
  }
  ctx.stroke()
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.moveTo(0, Math.round(Y(0)) + 0.5)
  ctx.lineTo(w, Math.round(Y(0)) + 0.5)
  ctx.moveTo(Math.round(X(0)) + 0.5, 0)
  ctx.lineTo(Math.round(X(0)) + 0.5, h)
  ctx.stroke()
  const opts = { color: ink.grey, halo: ink.fill, font: ink.font, size: 11 }
  for (let x = Math.ceil(left / step) * step; x <= left + span; x += step) {
    if (Math.abs(x) < step / 2 || X(x) < 12 || X(x) > w - 12) continue
    label(ctx, fmt(Number(x.toPrecision(10)), 5), X(x), Math.min(h - 6, Math.max(12, Y(0) + 14)), { ...opts, align: 'center' })
  }
  const line = (a: number, b: number, c: number, dash: number[]) => {
    ctx.save()
    ctx.setLineDash(dash)
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 2.25
    ctx.beginPath()
    if (Math.abs(b) > 1e-9) {
      const xa = left - 1
      const xb = left + span + 1
      ctx.moveTo(X(xa), Y((c - a * xa) / b))
      ctx.lineTo(X(xb), Y((c - a * xb) / b))
    } else if (Math.abs(a) > 1e-9) {
      ctx.moveTo(X(c / a), 0)
      ctx.lineTo(X(c / a), h)
    }
    ctx.stroke()
    ctx.restore()
  }
  line(a1, b1, c1, [])
  line(a2, b2, c2, [9, 6])
  const d = a1 * b2 - a2 * b1
  if (Math.abs(d) > 1e-9) {
    const x = (c1 * b2 - c2 * b1) / d
    const y = (a1 * c2 - a2 * c1) / d
    dot(ctx, X(x), Y(y), 6.5, ink.ink)
    dot(ctx, X(x), Y(y), 3, ink.fill)
    label(ctx, `(${fmt(x, 4)}, ${fmt(y, 4)})`, X(x) + 10, Y(y) - 10, { color: ink.ink, halo: ink.fill, font: ink.font, size: 12, weight: 650 })
  }
}

/* ── three unknowns: the row operations played in order ──────────── */

function RowOps({ sol, start }: { sol: SystemSolution; start: Mat }) {
  const box = useRef<HTMLDivElement>(null)
  const frames = [{ m: start, row: -1, op: 'Start: [A | b]' }, ...sol.snaps]
  const [i, setI] = useState(0)
  const acc = useRef(0)
  const key = JSON.stringify(start)
  useEffect(() => {
    setI(0)
    acc.current = 0
  }, [key])
  const { reduced } = useSimLoop(box, (dt) => {
    acc.current += dt
    if (acc.current > (i === frames.length - 1 ? 2.6 : 1.1)) {
      acc.current = 0
      setI((v) => (v + 1) % frames.length)
    }
  })
  const f = reduced ? frames[frames.length - 1]! : (frames[i] ?? frames[0]!)
  const n = start.length
  return (
    <div ref={box} className="space-y-3 p-4 sm:p-5">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-x-1 border-spacing-y-1 text-[0.9375rem] tabular-nums">
          <tbody>
            {f.m.map((row, r) => (
              <tr key={r} className="relative">
                {row.map((v, c) => (
                  <td key={c} className={cn('relative min-w-12 rounded-md px-2 py-1.5 text-right', c === n && 'pl-4')}>
                    <span
                      aria-hidden="true"
                      className={cn('absolute inset-0 rounded-md bg-foreground transition-opacity duration-300', r === f.row ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className={cn('relative', r === f.row ? 'text-background' : 'text-foreground')}>{fmt(v, 5)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[0.8125rem] text-muted-foreground" aria-hidden="true">
        {reduced ? 'Reduced form' : `${i === 0 ? '' : `Step ${i} of ${frames.length - 1}: `}${f.op}`}
      </p>
    </div>
  )
}
