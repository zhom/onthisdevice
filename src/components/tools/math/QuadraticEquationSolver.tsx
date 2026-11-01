import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { AnswerBanner, Field, StatGrid, StatTile, StepList, type Step } from './ui'
import { fmtGrouped, fmtNum, parseNum } from './math-core'

interface Solution {
  a: number
  b: number
  c: number
  discriminant: number
  kind: 'two-real' | 'one-real' | 'complex'
  roots: string[]
  realRoots: number[]
  vertex: { h: number; k: number }
  factored: string
  steps: Step[]
}

function term(coef: number, variable: string): string {
  if (coef === 0) return ''
  const sign = coef > 0 ? '+ ' : '− '
  const mag = Math.abs(coef)
  const shown = variable && mag === 1 ? '' : fmtNum(mag, 8)
  return `${sign}${shown}${variable} `
}

function equationText(a: number, b: number, c: number): string {
  const first = `${a === 1 ? '' : a === -1 ? '−' : fmtNum(a, 8)}x²`
  return `${first} ${term(b, 'x')}${term(c, '')}= 0`.replace(/\s+/g, ' ')
}

function solveQuadratic(a: number, b: number, c: number): Solution {
  const discriminant = b * b - 4 * a * c
  const h = -b / (2 * a)
  const k = a * h * h + b * h + c
  const steps: Step[] = []

  steps.push({
    label: 'Identify the coefficients.',
    expr: `a = ${fmtNum(a, 8)},  b = ${fmtNum(b, 8)},  c = ${fmtNum(c, 8)}`,
    note: `Equation: ${equationText(a, b, c)}`,
  })
  steps.push({
    label: 'Compute the discriminant, which decides what kind of roots exist.',
    expr: `Δ = b² − 4ac = (${fmtNum(b, 8)})² − 4(${fmtNum(a, 8)})(${fmtNum(c, 8)}) = ${fmtNum(discriminant, 8)}`,
    note:
      discriminant > 0
        ? 'Δ > 0 → two distinct real roots, so the parabola crosses the x-axis twice.'
        : discriminant === 0
          ? 'Δ = 0 → one repeated real root, so the parabola just touches the x-axis.'
          : 'Δ < 0 → no real roots; the two solutions are complex conjugates.',
  })

  let kind: Solution['kind']
  let roots: string[]
  let realRoots: number[] = []

  if (discriminant > 0) {
    kind = 'two-real'
    const sq = Math.sqrt(discriminant)
    const r1 = (-b + sq) / (2 * a)
    const r2 = (-b - sq) / (2 * a)
    realRoots = [r1, r2].sort((x, y) => x - y)
    roots = realRoots.map((r) => fmtNum(r, 10))
    steps.push({
      label: 'Put the numbers into the quadratic formula.',
      expr: `x = (−b ± √Δ) / 2a = (${fmtNum(-b, 8)} ± √${fmtNum(discriminant, 8)}) / ${fmtNum(2 * a, 8)}`,
    })
    steps.push({
      label: 'Take the square root of the discriminant.',
      expr: `√${fmtNum(discriminant, 8)} = ${fmtNum(sq, 10)}`,
    })
    steps.push({
      label: 'Evaluate the plus branch and the minus branch.',
      expr: `x₁ = (${fmtNum(-b, 8)} + ${fmtNum(sq, 8)}) / ${fmtNum(2 * a, 8)} = ${fmtNum(r1, 10)}\nx₂ = (${fmtNum(-b, 8)} − ${fmtNum(sq, 8)}) / ${fmtNum(2 * a, 8)} = ${fmtNum(r2, 10)}`,
    })
  } else if (discriminant === 0) {
    kind = 'one-real'
    const r = -b / (2 * a)
    realRoots = [r]
    roots = [fmtNum(r, 10)]
    steps.push({
      label: 'The discriminant is zero, so the ± term vanishes and both roots coincide.',
      expr: `x = −b / 2a = ${fmtNum(-b, 8)} / ${fmtNum(2 * a, 8)} = ${fmtNum(r, 10)}`,
      note: 'This is a double root: the factor (x − r) appears twice.',
    })
  } else {
    kind = 'complex'
    const sq = Math.sqrt(-discriminant)
    const re = -b / (2 * a)
    const im = sq / (2 * Math.abs(a))
    roots = [`${fmtNum(re, 8)} + ${fmtNum(im, 8)}i`, `${fmtNum(re, 8)} − ${fmtNum(im, 8)}i`]
    steps.push({
      label: 'The discriminant is negative, so factor out i = √(−1).',
      expr: `√${fmtNum(discriminant, 8)} = √(−1) × √${fmtNum(-discriminant, 8)} = ${fmtNum(sq, 8)}i`,
    })
    steps.push({
      label: 'Split the formula into a real part and an imaginary part.',
      expr: `x = ${fmtNum(-b, 8)}/${fmtNum(2 * a, 8)} ± (${fmtNum(sq, 8)}/${fmtNum(2 * Math.abs(a), 8)})i = ${fmtNum(re, 8)} ± ${fmtNum(im, 8)}i`,
      note: 'The two roots are complex conjugates: same real part, opposite imaginary parts.',
    })
  }

  steps.push({
    label: 'Complete the square to reach vertex form.',
    expr: `${fmtNum(a, 6)}(x ${h >= 0 ? '−' : '+'} ${fmtNum(Math.abs(h), 8)})² ${k >= 0 ? '+' : '−'} ${fmtNum(Math.abs(k), 8)}`,
    note: `Factor a out of the first two terms, halve the resulting x-coefficient (b/2a = ${fmtNum(h * -1, 8)}) and square it; h = −b/2a = ${fmtNum(h, 8)} and k = f(h) = ${fmtNum(k, 8)}.`,
  })
  steps.push({
    label: 'Read the vertex and the axis of symmetry off the vertex form.',
    expr: `vertex = (${fmtNum(h, 8)}, ${fmtNum(k, 8)})   axis of symmetry: x = ${fmtNum(h, 8)}`,
    note: a > 0 ? 'a > 0, so the parabola opens upward and the vertex is the minimum.' : 'a < 0, so the parabola opens downward and the vertex is the maximum.',
  })

  const factored =
    kind === 'complex'
      ? 'Not factorable over the real numbers'
      : kind === 'one-real'
        ? `${a === 1 ? '' : `${fmtNum(a, 6)}`}(x ${realRoots[0] >= 0 ? '−' : '+'} ${fmtNum(Math.abs(realRoots[0]), 8)})²`
        : `${a === 1 ? '' : `${fmtNum(a, 6)}`}(x ${realRoots[0] >= 0 ? '−' : '+'} ${fmtNum(Math.abs(realRoots[0]), 8)})(x ${realRoots[1] >= 0 ? '−' : '+'} ${fmtNum(Math.abs(realRoots[1]), 8)})`

  steps.push({
    label: kind === 'complex' ? 'Over the reals there is no factorisation.' : 'Write the factored form from the roots.',
    expr: kind === 'complex' ? `${equationText(a, b, c)} has no real linear factors (Δ < 0).` : `${equationText(a, b, c).replace(' = 0', '')} = ${factored}`,
  })

  return { a, b, c, discriminant, kind, roots, realRoots, vertex: { h, k }, factored, steps }
}

/* ─────────────────────────── parabola plot ────────────────────────────── */

function Parabola({ a, b, c, vertex, realRoots }: { a: number; b: number; c: number; vertex: { h: number; k: number }; realRoots: number[] }) {
  const W = 720
  const H = 380
  const PAD = 40

  const spread = realRoots.length === 2 ? Math.abs(realRoots[1] - realRoots[0]) : 0
  const halfSpan = Math.max(spread * 1.1, Math.abs(vertex.h) * 0.35, 3)
  const xMin = vertex.h - halfSpan
  const xMax = vertex.h + halfSpan

  const samples: { x: number; y: number }[] = []
  const N = 200
  for (let i = 0; i <= N; i++) {
    const x = xMin + ((xMax - xMin) * i) / N
    samples.push({ x, y: a * x * x + b * x + c })
  }
  let yMin = Math.min(0, vertex.k)
  let yMax = Math.max(0, vertex.k)
  for (const s of samples) {
    if (s.y < yMin) yMin = s.y
    if (s.y > yMax) yMax = s.y
  }
  const yPad = (yMax - yMin) * 0.12 || 1
  yMin -= yPad
  yMax += yPad

  const X = (x: number) => PAD + ((x - xMin) / (xMax - xMin)) * (W - PAD * 2)
  const Y = (y: number) => H - PAD - ((y - yMin) / (yMax - yMin)) * (H - PAD * 2)

  const path = samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${X(s.x).toFixed(2)},${Y(s.y).toFixed(2)}`).join(' ')
  const zeroY = yMin <= 0 && yMax >= 0 ? Y(0) : null
  const zeroX = xMin <= 0 && xMax >= 0 ? X(0) : null

  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto rounded-lg bg-card p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[20rem]"
          role="img"
          aria-label={`Graph of the parabola with vertex at ${fmtNum(vertex.h, 4)}, ${fmtNum(vertex.k, 4)}${realRoots.length ? ` and x-intercepts at ${realRoots.map((r) => fmtNum(r, 4)).join(' and ')}` : ' with no real x-intercepts'}`}
        >
          <rect x={0} y={0} width={W} height={H} className="fill-card" />
          {zeroY !== null && <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} className="stroke-muted-foreground" strokeWidth={1.5} />}
          {zeroX !== null && <line x1={zeroX} y1={PAD} x2={zeroX} y2={H - PAD} className="stroke-muted-foreground" strokeWidth={1.5} />}
          <line x1={X(vertex.h)} y1={PAD} x2={X(vertex.h)} y2={H - PAD} className="stroke-chart-3" strokeWidth={1.5} strokeDasharray="6 5" />
          <path d={path} className="fill-none stroke-chart-1" strokeWidth={2.5} strokeLinejoin="round" />
          {realRoots.map((r) => (
            <g key={r}>
              <circle cx={X(r)} cy={Y(0)} r={5} strokeWidth={2} className="fill-background stroke-foreground" />
              <text x={X(r)} y={Y(0) + 20} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {fmtNum(r, 4)}
              </text>
            </g>
          ))}
          <circle cx={X(vertex.h)} cy={Y(vertex.k)} r={5} className="fill-primary" />
          <text
            x={X(vertex.h)}
            y={Y(vertex.k) + (a > 0 ? 20 : -10)}
            textAnchor="middle"
            className="fill-primary text-[11px] font-semibold"
          >
            ({fmtNum(vertex.h, 3)}, {fmtNum(vertex.k, 3)})
          </text>
          <text x={PAD} y={H - PAD + 24} textAnchor="start" className="fill-muted-foreground text-[11px]">
            x = {fmtNum(xMin, 3)}
          </text>
          <text x={W - PAD} y={H - PAD + 24} textAnchor="end" className="fill-muted-foreground text-[11px]">
            x = {fmtNum(xMax, 3)}
          </text>
        </svg>
      </div>
      <figcaption className="text-xs text-muted-foreground">
        The curve y = ax² + bx + c. The dashed line is the axis of symmetry, the filled dot is the vertex, and any points on the
        x-axis are the real roots.
      </figcaption>
    </figure>
  )
}

/* ──────────────────────────── main island ─────────────────────────────── */

export default function QuadraticEquationSolver() {
  const [aRaw, setARaw] = useState('1')
  const [bRaw, setBRaw] = useState('-3')
  const [cRaw, setCRaw] = useState('-10')

  const outcome = useMemo(() => {
    const a = parseNum(aRaw)
    const b = parseNum(bRaw)
    const c = parseNum(cRaw)
    if (a === null || b === null || c === null) return null
    if (Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) > 1e150) {
      return { ok: false as const, message: 'Use coefficients below 10¹⁵⁰. Larger ones overflow when squared.' }
    }
    if (a === 0) {
      if (b === 0) {
        return {
          ok: false as const,
          message:
            c === 0
              ? 'With a, b and c all zero, the equation 0 = 0 is true for every x. There is nothing to solve.'
              : 'With a and b both zero the equation says a non-zero constant equals zero, which has no solution.',
        }
      }
      const x = -c / b
      return {
        ok: 'linear' as const,
        x,
        steps: [
          {
            label: 'a is zero, so the x² term disappears and this is a linear equation, not a quadratic.',
            expr: `${fmtNum(b, 8)}x ${c >= 0 ? '+' : '−'} ${fmtNum(Math.abs(c), 8)} = 0`,
          },
          { label: 'Move the constant across.', expr: `${fmtNum(b, 8)}x = ${fmtNum(-c, 8)}` },
          { label: 'Divide by the coefficient of x.', expr: `x = ${fmtNum(-c, 8)} ÷ ${fmtNum(b, 8)} = ${fmtNum(x, 10)}` },
        ] as Step[],
      }
    }
    const solution = solveQuadratic(a, b, c)
    if (![solution.discriminant, solution.vertex.h, solution.vertex.k, ...solution.realRoots].every(Number.isFinite)) {
      return { ok: false as const, message: 'These coefficients are too far apart in size to solve in double precision. Scale the equation.' }
    }
    return { ok: true as const, solution }
  }, [aRaw, bRaw, cRaw])

  const presets: { label: string; a: string; b: string; c: string }[] = [
    { label: 'x² − 3x − 10', a: '1', b: '-3', c: '-10' },
    { label: 'x² + 4x + 4', a: '1', b: '4', c: '4' },
    { label: 'x² + x + 1', a: '1', b: '1', c: '1' },
    { label: '2x² − 4x − 6', a: '2', b: '-4', c: '-6' },
  ]

  return (
    <div className="space-y-5">
      <ToolPanel title="ax² + bx + c = 0" description="Enter the three coefficients. Negative values and decimals are fine.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="a (coefficient of x²)" value={aRaw} onChange={setARaw} placeholder="1" />
          <Field label="b (coefficient of x)" value={bRaw} onChange={setBRaw} placeholder="-3" />
          <Field label="c (constant)" value={cRaw} onChange={setCRaw} placeholder="-10" />
        </div>
        <p className="mt-3 font-mono text-sm text-muted-foreground" aria-live="polite">
          {aRaw || 'a'}x² {bRaw.trim().startsWith('-') ? '−' : '+'} {bRaw.replace(/^-/, '') || 'b'}x{' '}
          {cRaw.trim().startsWith('-') ? '−' : '+'} {cRaw.replace(/^-/, '') || 'c'} = 0
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <Button
              key={p.label}
              type="button"
              variant="outline"
              size="sm"
              className="font-mono"
              onClick={() => {
                setARaw(p.a)
                setBRaw(p.b)
                setCRaw(p.c)
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </ToolPanel>

      {outcome === null ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
          Fill in a, b and c to solve the equation.
        </p>
      ) : outcome.ok === false ? (
        <ErrorNote message={outcome.message} />
      ) : outcome.ok === 'linear' ? (
        <div className="space-y-4" role="status" aria-live="polite">
          <AnswerBanner label="Linear equation: one solution" value={`x = ${fmtGrouped(outcome.x, 10)}`} sub="a = 0, so the quadratic formula does not apply here." />
          <StepList steps={outcome.steps} />
        </div>
      ) : (
        <QuadraticResult solution={outcome.solution} />
      )}
    </div>
  )
}

function QuadraticResult({ solution }: { solution: Solution }) {
  const { a, b, c, discriminant, kind, roots, realRoots, vertex, factored, steps } = solution
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <AnswerBanner
        label={kind === 'two-real' ? 'Two real roots' : kind === 'one-real' ? 'One repeated real root' : 'Two complex roots'}
        value={roots.map((r) => `x = ${r}`).join('   ')}
        sub={`Discriminant Δ = ${fmtNum(discriminant, 8)} · ${kind === 'complex' ? 'the parabola never meets the x-axis' : 'these are the x-intercepts of the parabola'}`}
      />

      <StatGrid cols={4}>
        <StatTile label="Discriminant (b² − 4ac)" value={fmtGrouped(discriminant, 8)} tone="muted" />
        <StatTile label="Vertex" value={`(${fmtNum(vertex.h, 6)}, ${fmtNum(vertex.k, 6)})`} hint={a > 0 ? 'minimum point' : 'maximum point'} tone="muted" />
        <StatTile label="Axis of symmetry" value={`x = ${fmtNum(vertex.h, 8)}`} tone="muted" />
        <StatTile label="y-intercept" value={`(0, ${fmtNum(c, 8)})`} tone="muted" />
        <StatTile label="Factored form" value={factored} tone="muted" />
        <StatTile label="Vertex form" value={`${fmtNum(a, 4)}(x ${vertex.h >= 0 ? '−' : '+'} ${fmtNum(Math.abs(vertex.h), 4)})² ${vertex.k >= 0 ? '+' : '−'} ${fmtNum(Math.abs(vertex.k), 4)}`} tone="muted" />
        <StatTile label="Sum of roots (−b/a)" value={fmtNum(-b / a, 8)} tone="muted" />
        <StatTile label="Product of roots (c/a)" value={fmtNum(c / a, 8)} tone="muted" />
      </StatGrid>

      <Parabola a={a} b={b} c={c} vertex={vertex} realRoots={realRoots} />

      <StepList steps={steps} />
    </div>
  )
}
