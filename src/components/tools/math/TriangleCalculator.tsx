import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { AnswerBanner, Field, StatGrid, StatTile, StepList, type Step } from './ui'
import { fmtNum, parseNum, toDegrees, toRadians } from './math-core'

interface Triangle {
  a: number
  b: number
  c: number
  A: number
  B: number
  C: number
}

interface Solved {
  triangle: Triangle
  area: number
  perimeter: number
  heights: [number, number, number]
  inradius: number
  circumradius: number
  medians: [number, number, number]
  bySides: string
  byAngles: string
}

const SIDE_LABELS = ['a', 'b', 'c'] as const
const ANGLE_LABELS = ['A', 'B', 'C'] as const

function classify(t: Triangle): { bySides: string; byAngles: string } {
  const sides = [t.a, t.b, t.c]
  const eps = 1e-7
  const equal = (x: number, y: number) => Math.abs(x - y) < eps * Math.max(1, Math.abs(x))
  const bySides = equal(sides[0], sides[1]) && equal(sides[1], sides[2])
    ? 'Equilateral'
    : equal(sides[0], sides[1]) || equal(sides[1], sides[2]) || equal(sides[0], sides[2])
      ? 'Isosceles'
      : 'Scalene'
  const maxAngle = Math.max(t.A, t.B, t.C)
  const byAngles = Math.abs(maxAngle - 90) < 1e-6 ? 'Right-angled' : maxAngle > 90 ? 'Obtuse' : 'Acute'
  return { bySides, byAngles }
}

function finish(t: Triangle): Solved {
  const s = (t.a + t.b + t.c) / 2
  const area = Math.sqrt(Math.max(0, s * (s - t.a) * (s - t.b) * (s - t.c)))
  const heights: [number, number, number] = [(2 * area) / t.a, (2 * area) / t.b, (2 * area) / t.c]
  const inradius = area / s
  const circumradius = (t.a * t.b * t.c) / (4 * area)
  const medians: [number, number, number] = [
    0.5 * Math.sqrt(2 * t.b ** 2 + 2 * t.c ** 2 - t.a ** 2),
    0.5 * Math.sqrt(2 * t.a ** 2 + 2 * t.c ** 2 - t.b ** 2),
    0.5 * Math.sqrt(2 * t.a ** 2 + 2 * t.b ** 2 - t.c ** 2),
  ]
  const { bySides, byAngles } = classify(t)
  return { triangle: t, area, perimeter: t.a + t.b + t.c, heights, inradius, circumradius, medians, bySides, byAngles }
}

interface SolveResult {
  method: string
  solutions: Solved[]
  steps: Step[]
  ambiguous: boolean
}

function solveTriangle(sides: (number | null)[], angles: (number | null)[]): SolveResult {
  const knownSides = sides.map((s, i) => (s !== null ? i : -1)).filter((i) => i >= 0)
  const knownAngles = angles.map((a, i) => (a !== null ? i : -1)).filter((i) => i >= 0)

  for (const i of knownSides) if (sides[i]! <= 0) throw new Error(`Side ${SIDE_LABELS[i]} must be greater than zero.`)
  for (const i of knownAngles) {
    const v = angles[i]!
    if (v <= 0 || v >= 180) throw new Error(`Angle ${ANGLE_LABELS[i]} must be between 0° and 180°.`)
  }

  const total = knownSides.length + knownAngles.length
  if (total < 3) throw new Error('Enter any three values: three sides, two sides and an angle, or two angles and a side.')
  if (total > 3) throw new Error('Enter exactly three values and leave the rest empty; the other three are calculated for you.')
  if (knownSides.length === 0) throw new Error('Three angles fix the shape but not the size. Add at least one side length.')

  const steps: Step[] = []

  /* ── SSS ─────────────────────────────────────────────────────────────── */
  if (knownSides.length === 3) {
    const [a, b, c] = sides as number[]
    if (a + b <= c || a + c <= b || b + c <= a) {
      throw new Error(`Those side lengths cannot form a triangle: the two shorter sides must add up to more than the longest one (${fmtNum(Math.min(a + b, a + c, b + c))} is not greater than ${fmtNum(Math.max(a, b, c))}).`)
    }
    const A = toDegrees(Math.acos((b * b + c * c - a * a) / (2 * b * c)))
    const B = toDegrees(Math.acos((a * a + c * c - b * b) / (2 * a * c)))
    const C = 180 - A - B
    steps.push({
      label: 'Three sides given (SSS). Check the triangle inequality first.',
      expr: `${fmtNum(a)} + ${fmtNum(b)} > ${fmtNum(c)},  ${fmtNum(a)} + ${fmtNum(c)} > ${fmtNum(b)},  ${fmtNum(b)} + ${fmtNum(c)} > ${fmtNum(a)} ✓`,
    })
    steps.push({
      label: 'Use the law of cosines rearranged for the angle opposite side a.',
      expr: `cos A = (b² + c² − a²) / 2bc = (${fmtNum(b * b, 4)} + ${fmtNum(c * c, 4)} − ${fmtNum(a * a, 4)}) / ${fmtNum(2 * b * c, 4)} = ${fmtNum(Math.cos(toRadians(A)), 8)}\nA = ${fmtNum(A, 6)}°`,
    })
    steps.push({
      label: 'Repeat for angle B.',
      expr: `cos B = (a² + c² − b²) / 2ac = ${fmtNum(Math.cos(toRadians(B)), 8)}\nB = ${fmtNum(B, 6)}°`,
    })
    steps.push({
      label: 'The angles of a triangle always add to 180°, which gives the last one.',
      expr: `C = 180° − ${fmtNum(A, 6)}° − ${fmtNum(B, 6)}° = ${fmtNum(C, 6)}°`,
    })
    return { method: 'SSS (three sides known)', solutions: [finish({ a, b, c, A, B, C })], steps, ambiguous: false }
  }

  /* ── two angles + one side (ASA / AAS) ───────────────────────────────── */
  if (knownAngles.length === 2) {
    const missingAngle = [0, 1, 2].find((i) => angles[i] === null)!
    const sum = knownAngles.reduce((acc, i) => acc + angles[i]!, 0)
    if (sum >= 180) throw new Error(`Those two angles already add up to ${fmtNum(sum)}°, so there is no room for a third.`)
    const full = [...angles] as (number | null)[]
    full[missingAngle] = 180 - sum
    const A = full[0] as number
    const B = full[1] as number
    const C = full[2] as number
    const known = knownSides[0]
    const knownAngleForSide = [A, B, C][known]
    const k = sides[known]! / Math.sin(toRadians(knownAngleForSide))
    const a = k * Math.sin(toRadians(A))
    const b = k * Math.sin(toRadians(B))
    const c = k * Math.sin(toRadians(C))
    const included = knownAngles.every((i) => i !== known)
    steps.push({
      label: `Two angles and a side given (${included ? 'ASA' : 'AAS'}).`,
      expr: `${ANGLE_LABELS[knownAngles[0]]} = ${fmtNum(angles[knownAngles[0]]!)}°, ${ANGLE_LABELS[knownAngles[1]]} = ${fmtNum(angles[knownAngles[1]]!)}°, ${SIDE_LABELS[known]} = ${fmtNum(sides[known]!)}`,
    })
    steps.push({
      label: 'Find the third angle from the 180° sum.',
      expr: `${ANGLE_LABELS[missingAngle]} = 180° − ${fmtNum(angles[knownAngles[0]]!)}° − ${fmtNum(angles[knownAngles[1]]!)}° = ${fmtNum(180 - sum, 6)}°`,
    })
    steps.push({
      label: 'The law of sines gives a single ratio shared by all three side/angle pairs.',
      expr: `k = ${SIDE_LABELS[known]} / sin(${ANGLE_LABELS[known]}) = ${fmtNum(sides[known]!)} / sin(${fmtNum(knownAngleForSide, 6)}°) = ${fmtNum(k, 8)}`,
    })
    steps.push({
      label: 'Multiply that ratio by the sine of each angle to get the sides.',
      expr: `a = k·sin A = ${fmtNum(a, 6)}\nb = k·sin B = ${fmtNum(b, 6)}\nc = k·sin C = ${fmtNum(c, 6)}`,
    })
    return { method: `${included ? 'ASA' : 'AAS'} (two angles and a side)`, solutions: [finish({ a, b, c, A, B, C })], steps, ambiguous: false }
  }

  /* ── two sides + one angle (SAS or SSA) ──────────────────────────────── */
  const angleIndex = knownAngles[0]
  const [s1, s2] = knownSides
  const included = angleIndex !== s1 && angleIndex !== s2

  if (included) {
    // SAS: the known angle sits between the two known sides.
    const known = [s1, s2]
    const angleValue = angles[angleIndex]!
    const p = sides[known[0]]!
    const q = sides[known[1]]!
    const opposite = Math.sqrt(p * p + q * q - 2 * p * q * Math.cos(toRadians(angleValue)))
    const outSides: number[] = []
    outSides[known[0]] = p
    outSides[known[1]] = q
    outSides[angleIndex] = opposite
    const [a, b, c] = outSides as [number, number, number]
    const A = toDegrees(Math.acos((b * b + c * c - a * a) / (2 * b * c)))
    const B = toDegrees(Math.acos((a * a + c * c - b * b) / (2 * a * c)))
    const C = 180 - A - B
    steps.push({
      label: 'Two sides with the angle between them (SAS).',
      expr: `${SIDE_LABELS[known[0]]} = ${fmtNum(p)}, ${SIDE_LABELS[known[1]]} = ${fmtNum(q)}, included angle ${ANGLE_LABELS[angleIndex]} = ${fmtNum(angleValue)}°`,
    })
    steps.push({
      label: 'The law of cosines gives the third side directly.',
      expr: `${SIDE_LABELS[angleIndex]}² = ${fmtNum(p)}² + ${fmtNum(q)}² − 2·${fmtNum(p)}·${fmtNum(q)}·cos(${fmtNum(angleValue)}°) = ${fmtNum(opposite * opposite, 6)}\n${SIDE_LABELS[angleIndex]} = ${fmtNum(opposite, 8)}`,
    })
    steps.push({
      label: 'With all three sides known, the law of cosines gives the remaining angles.',
      expr: `A = ${fmtNum(A, 6)}°,  B = ${fmtNum(B, 6)}°,  C = ${fmtNum(C, 6)}°`,
      note: 'Using cosines rather than sines here avoids the ambiguity that arcsine introduces for obtuse angles.',
    })
    return { method: 'SAS (two sides and the included angle)', solutions: [finish({ a, b, c, A, B, C })], steps, ambiguous: false }
  }

  // SSA: the known angle is opposite one of the known sides — the ambiguous case.
  const oppositeIndex = angleIndex
  const otherIndex = [s1, s2].find((i) => i !== oppositeIndex)!
  const known = sides[oppositeIndex]!
  const other = sides[otherIndex]!
  const alpha = angles[angleIndex]!
  const ratio = (other * Math.sin(toRadians(alpha))) / known

  steps.push({
    label: 'Two sides with an angle that is not between them (SSA): the ambiguous case.',
    expr: `${SIDE_LABELS[oppositeIndex]} = ${fmtNum(known)} (opposite ${ANGLE_LABELS[angleIndex]} = ${fmtNum(alpha)}°), ${SIDE_LABELS[otherIndex]} = ${fmtNum(other)}`,
  })
  steps.push({
    label: 'Apply the law of sines to the second known side.',
    expr: `sin(${ANGLE_LABELS[otherIndex]}) = ${SIDE_LABELS[otherIndex]}·sin(${ANGLE_LABELS[angleIndex]}) / ${SIDE_LABELS[oppositeIndex]} = ${fmtNum(other)} × sin(${fmtNum(alpha)}°) / ${fmtNum(known)} = ${fmtNum(ratio, 8)}`,
  })

  if (ratio > 1 + 1e-12) {
    throw new Error(
      `No triangle fits those values: side ${SIDE_LABELS[oppositeIndex]} (${fmtNum(known)}) is too short to reach. It would need to be at least ${fmtNum(other * Math.sin(toRadians(alpha)), 6)}.`,
    )
  }

  const beta1 = toDegrees(Math.asin(Math.min(1, ratio)))
  const candidates: number[] = [beta1]
  const beta2 = 180 - beta1
  if (Math.abs(beta1 - 90) > 1e-9 && alpha + beta2 < 180 && known < other) candidates.push(beta2)

  const solutions: Solved[] = []
  for (const beta of candidates) {
    const gamma = 180 - alpha - beta
    if (gamma <= 0) continue
    const outAngles: number[] = []
    outAngles[oppositeIndex] = alpha
    outAngles[otherIndex] = beta
    const thirdIndex = [0, 1, 2].find((i) => i !== oppositeIndex && i !== otherIndex)!
    outAngles[thirdIndex] = gamma
    const k = known / Math.sin(toRadians(alpha))
    const outSides: number[] = [0, 1, 2].map((i) => k * Math.sin(toRadians(outAngles[i])))
    const [A, B, C] = outAngles as [number, number, number]
    const [a, b, c] = outSides as [number, number, number]
    solutions.push(finish({ a, b, c, A, B, C }))
  }

  if (!solutions.length) throw new Error('Those values do not describe a triangle: the angles would not add up to 180°.')

  steps.push({
    label:
      solutions.length === 2
        ? 'Arcsine has two solutions in 0°–180°, and both give a valid triangle here.'
        : Math.abs(beta1 - 90) < 1e-9
          ? 'The sine is exactly 1, so the angle is 90° and there is only one triangle.'
          : 'The obtuse alternative would make the angles exceed 180°, so only one triangle is possible.',
    expr:
      solutions.length === 2
        ? `${ANGLE_LABELS[otherIndex]} = ${fmtNum(beta1, 6)}°  or  ${ANGLE_LABELS[otherIndex]} = ${fmtNum(beta2, 6)}°`
        : `${ANGLE_LABELS[otherIndex]} = ${fmtNum(beta1, 6)}°`,
  })
  steps.push({
    label: 'Finish each solution with the 180° sum and the law of sines.',
    expr: solutions
      .map((s, i) => `Solution ${i + 1}: a = ${fmtNum(s.triangle.a, 6)}, b = ${fmtNum(s.triangle.b, 6)}, c = ${fmtNum(s.triangle.c, 6)}`)
      .join('\n'),
  })

  return { method: 'SSA (two sides and a non-included angle)', solutions, steps, ambiguous: solutions.length === 2 }
}

/* ────────────────────────────── diagram ───────────────────────────────── */

function TriangleDiagram({ t }: { t: Triangle }) {
  const W = 520
  const H = 340
  const PAD = 52
  // Vertex B at origin, C along the x-axis at distance a, A found from angle B.
  const B = { x: 0, y: 0 }
  const C = { x: t.a, y: 0 }
  const A = { x: t.c * Math.cos(toRadians(t.B)), y: t.c * Math.sin(toRadians(t.B)) }

  const xs = [A.x, B.x, C.x]
  const ys = [A.y, B.y, C.y]
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const scale = Math.min((W - PAD * 2) / Math.max(maxX - minX, 1e-9), (H - PAD * 2) / Math.max(maxY - minY, 1e-9))
  const offX = (W - (maxX - minX) * scale) / 2 - minX * scale
  const offY = (H - (maxY - minY) * scale) / 2 - minY * scale
  const P = (p: { x: number; y: number }) => ({ x: p.x * scale + offX, y: H - (p.y * scale + offY) })
  const pa = P(A)
  const pb = P(B)
  const pc = P(C)
  const centroid = { x: (pa.x + pb.x + pc.x) / 3, y: (pa.y + pb.y + pc.y) / 3 }
  const outward = (p: { x: number; y: number }, by = 18) => {
    const dx = p.x - centroid.x
    const dy = p.y - centroid.y
    const len = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / len) * by, y: p.y + (dy / len) * by }
  }
  const mid = (p: { x: number; y: number }, q: { x: number; y: number }) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })
  const la = outward(mid(pb, pc), 16)
  const lb = outward(mid(pa, pc), 16)
  const lc = outward(mid(pa, pb), 16)
  const va = outward(pa, 16)
  const vb = outward(pb, 16)
  const vc = outward(pc, 16)

  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto rounded-lg bg-card p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[18rem]"
          role="img"
          aria-label={`Scale drawing of a triangle with sides ${fmtNum(t.a, 4)}, ${fmtNum(t.b, 4)} and ${fmtNum(t.c, 4)} and angles ${fmtNum(t.A, 2)}, ${fmtNum(t.B, 2)} and ${fmtNum(t.C, 2)} degrees`}
        >
          <polygon
            points={`${pa.x},${pa.y} ${pb.x},${pb.y} ${pc.x},${pc.y}`}
            className="fill-muted stroke-foreground"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {[pa, pb, pc].map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4} className="fill-foreground" />
          ))}
          <text x={va.x} y={va.y} textAnchor="middle" className="fill-foreground text-[13px] font-semibold">
            A {fmtNum(t.A, 2)}°
          </text>
          <text x={vb.x} y={vb.y} textAnchor="middle" className="fill-foreground text-[13px] font-semibold">
            B {fmtNum(t.B, 2)}°
          </text>
          <text x={vc.x} y={vc.y} textAnchor="middle" className="fill-foreground text-[13px] font-semibold">
            C {fmtNum(t.C, 2)}°
          </text>
          <text x={la.x} y={la.y} textAnchor="middle" className="fill-muted-foreground text-[12px]">
            a = {fmtNum(t.a, 3)}
          </text>
          <text x={lb.x} y={lb.y} textAnchor="middle" className="fill-muted-foreground text-[12px]">
            b = {fmtNum(t.b, 3)}
          </text>
          <text x={lc.x} y={lc.y} textAnchor="middle" className="fill-muted-foreground text-[12px]">
            c = {fmtNum(t.c, 3)}
          </text>
        </svg>
      </div>
      <figcaption className="text-xs text-muted-foreground">
        Drawn to scale. Side a is opposite angle A, side b is opposite angle B and side c is opposite angle C.
      </figcaption>
    </figure>
  )
}

/* ──────────────────────────── main island ─────────────────────────────── */

const PRESETS: { label: string; values: [string, string, string, string, string, string] }[] = [
  { label: 'SSS 3-4-5', values: ['3', '4', '5', '', '', ''] },
  { label: 'SAS 7, 9, 60°', values: ['7', '9', '', '', '', '60'] },
  { label: 'ASA 40°, 60°, c=8', values: ['', '', '8', '40', '60', ''] },
  { label: 'SSA 7, 10, A=30°', values: ['7', '10', '', '30', '', ''] },
]

export default function TriangleCalculator() {
  const [values, setValues] = useState<[string, string, string, string, string, string]>(['3', '4', '5', '', '', ''])

  const set = (index: number, v: string) =>
    setValues((prev) => {
      const next = [...prev] as typeof prev
      next[index] = v
      return next
    })

  const outcome = useMemo(() => {
    const sides = [parseNum(values[0]), parseNum(values[1]), parseNum(values[2])]
    const angles = [parseNum(values[3]), parseNum(values[4]), parseNum(values[5])]
    const filled = [...sides, ...angles].filter((v) => v !== null).length
    if (filled === 0) return null
    try {
      return { ok: true as const, ...solveTriangle(sides, angles) }
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : 'That triangle could not be solved.' }
    }
  }, [values])

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Enter any three values"
        description="Side a is opposite angle A, side b opposite B and side c opposite C. Angles are in degrees. Leave the rest empty."
        footer={
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.label} type="button" variant="outline" size="sm" onClick={() => setValues(p.values)}>
                {p.label}
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setValues(['', '', '', '', '', ''])}>
              Clear
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Side a" value={values[0]} onChange={(v) => set(0, v)} placeholder="3" />
          <Field label="Side b" value={values[1]} onChange={(v) => set(1, v)} placeholder="4" />
          <Field label="Side c" value={values[2]} onChange={(v) => set(2, v)} placeholder="5" />
          <Field label="Angle A" value={values[3]} onChange={(v) => set(3, v)} placeholder="" suffix="°" />
          <Field label="Angle B" value={values[4]} onChange={(v) => set(4, v)} placeholder="" suffix="°" />
          <Field label="Angle C" value={values[5]} onChange={(v) => set(5, v)} placeholder="" suffix="°" />
        </div>
      </ToolPanel>

      {outcome === null ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
          Fill in three of the six boxes (SSS, SAS, ASA, AAS or SSA) and the calculator solves the rest.
        </p>
      ) : !outcome.ok ? (
        <ErrorNote message={outcome.message} />
      ) : (
        <div className="space-y-5" role="status" aria-live="polite">
          <p className="text-sm text-muted-foreground">
            Solved as <span className="font-medium text-foreground">{outcome.method}</span>
            {outcome.ambiguous ? '. Two different triangles fit these values, and both are shown below.' : ''}
          </p>
          {outcome.solutions.map((s, i) => (
            <SolutionCard key={i} solved={s} index={outcome.solutions.length > 1 ? i + 1 : null} />
          ))}
          <StepList steps={outcome.steps} />
        </div>
      )}
    </div>
  )
}

function SolutionCard({ solved, index }: { solved: Solved; index: number | null }) {
  const t = solved.triangle
  return (
    <section className="space-y-4">
      {index !== null && <h3 className="text-sm font-semibold text-foreground">Solution {index}</h3>}
      <AnswerBanner
        label="Sides and angles"
        value={`a=${fmtNum(t.a, 5)}  b=${fmtNum(t.b, 5)}  c=${fmtNum(t.c, 5)}`}
        sub={`A = ${fmtNum(t.A, 4)}°, B = ${fmtNum(t.B, 4)}°, C = ${fmtNum(t.C, 4)}° · ${solved.bySides.toLowerCase()}, ${solved.byAngles.toLowerCase()}`}
      />
      <TriangleDiagram t={t} />
      <StatGrid cols={4}>
        <StatTile label="Area" value={fmtNum(solved.area, 6)} hint="Heron's formula" tone="muted" />
        <StatTile label="Perimeter" value={fmtNum(solved.perimeter, 6)} tone="muted" />
        <StatTile label="Type" value={`${solved.bySides} · ${solved.byAngles}`} tone="muted" />
        <StatTile label="Semi-perimeter (s)" value={fmtNum(solved.perimeter / 2, 6)} tone="muted" />
        <StatTile label="Height to a" value={fmtNum(solved.heights[0], 6)} hint="2 × area ÷ a" tone="muted" />
        <StatTile label="Height to b" value={fmtNum(solved.heights[1], 6)} tone="muted" />
        <StatTile label="Height to c" value={fmtNum(solved.heights[2], 6)} tone="muted" />
        <StatTile label="Inradius" value={fmtNum(solved.inradius, 6)} hint="area ÷ s" tone="muted" />
        <StatTile label="Circumradius" value={fmtNum(solved.circumradius, 6)} hint="abc ÷ 4·area" tone="muted" />
        <StatTile label="Median from A" value={fmtNum(solved.medians[0], 6)} tone="muted" />
        <StatTile label="Median from B" value={fmtNum(solved.medians[1], 6)} tone="muted" />
        <StatTile label="Median from C" value={fmtNum(solved.medians[2], 6)} tone="muted" />
      </StatGrid>
      <p className="text-xs text-muted-foreground">
        Cross-check: ½·a·b·sin C = {fmtNum(0.5 * t.a * t.b * Math.sin(toRadians(t.C)), 6)}, which matches Heron&rsquo;s area of{' '}
        {fmtNum(solved.area, 6)}.
      </p>
    </section>
  )
}
