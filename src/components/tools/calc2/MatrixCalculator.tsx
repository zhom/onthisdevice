import { useEffect, useMemo, useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import { CalcLayout, NumField, Result, SelectField, Stage, Working } from './_viz/Calc'
import type { Option } from './_viz/Calc'
import { arrow, label } from './_viz/draw'
import { fmt, num, parseNum } from './_viz/format'
import { prepCanvas, useInk, useResizeSignal, useSimLoop } from './_viz/hooks'
import type { Ink } from './_viz/hooks'
import { MatrixInput, MatrixSweep } from './_matrix-ui'
import type { SweepStep } from './_matrix-ui'
import { add, clean, cleanMat, det, detSteps, inverse, multiply, productCellText, rref, scale, transpose } from './matrix'
import type { Mat } from './matrix'

type Op = 'det' | 'inv' | 'mul' | 'add' | 'sub' | 'scale' | 'tr' | 'rank'
const OPS: Option<Op>[] = [
  { value: 'det', label: 'Determinant of A' },
  { value: 'inv', label: 'Inverse of A' },
  { value: 'mul', label: 'A × B' },
  { value: 'add', label: 'A + B' },
  { value: 'sub', label: 'A − B' },
  { value: 'scale', label: 'k × A' },
  { value: 'tr', label: 'Transpose of A' },
  { value: 'rank', label: 'Rank of A' },
]
const SIZES: Option<'1' | '2' | '3' | '4'>[] = ['1', '2', '3', '4'].map((v) => ({ value: v as '1' | '2' | '3' | '4', label: v }))
const usesB = (op: Op) => op === 'mul' || op === 'add' || op === 'sub'

function grid(rows: string[][]): string[][] {
  return Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => rows[r]?.[c] ?? '0'))
}
const show = (m: Mat) => `[${m.map((r) => r.map((v) => num(clean(v), 6)).join('  ')).join(' ; ')}]`

export default function MatrixCalculator() {
  const [op, setOp] = useState<Op>('det')
  const [ar, setAr] = useState(2)
  const [ac, setAc] = useState(2)
  const [br, setBr] = useState(2)
  const [bc, setBc] = useState(2)
  const [A, setA] = useState(() => grid([['3', '1'], ['1', '2']]))
  const [B, setB] = useState(() => grid([['1', '2'], ['0', '1']]))
  const [k, setK] = useState('2')

  const read = (g: string[][], r: number, c: number): Mat | null => {
    const m: Mat = []
    for (let i = 0; i < r; i++) {
      const row: number[] = []
      for (let j = 0; j < c; j++) {
        const v = parseNum(g[i]![j]!)
        if (v === null) return null
        row.push(v)
      }
      m.push(row)
    }
    return m
  }
  const a = read(A, ar, ac)
  const b = read(B, br, bc)
  const kv = parseNum(k)

  const out = useMemo(() => compute(op, a, b, kv), [op, JSON.stringify(a), JSON.stringify(b), kv])

  const set = (which: 'A' | 'B') => (r: number, c: number, v: string) =>
    (which === 'A' ? setA : setB)((g) => g.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)))

  const sizeRow = (label: string, r: number, c: number, setR: (n: number) => void, setC: (n: number) => void) => (
    <div className="grid grid-cols-2 gap-3">
      <SelectField label={`${label} rows`} value={String(r) as '1'} onChange={(v) => setR(Number(v))} options={SIZES} />
      <SelectField label={`${label} columns`} value={String(c) as '1'} onChange={(v) => setC(Number(v))} options={SIZES} />
    </div>
  )

  const square2 = a && ar === 2 && ac === 2 && (op === 'det' || op === 'inv' || op === 'tr' || op === 'rank')

  return (
    <CalcLayout
      inputs={
        <>
          <SelectField label="Operation" value={op} onChange={setOp} options={OPS} />
          {sizeRow('A', ar, ac, setAr, setAc)}
          <div className="space-y-1.5">
            <Label asChild>
              <p>Matrix A</p>
            </Label>
            <MatrixInput name="A" rows={ar} cols={ac} values={A} onChange={set('A')} />
          </div>
          {op === 'scale' ? <NumField label="Scalar k" value={k} onChange={setK} error={kv === null ? 'Enter a number.' : null} /> : null}
          {usesB(op) ? (
            <>
              {sizeRow('B', br, bc, setBr, setBc)}
              <div className="space-y-1.5">
                <Label asChild>
                  <p>Matrix B</p>
                </Label>
                <MatrixInput name="B" rows={br} cols={bc} values={B} onChange={set('B')} />
              </div>
            </>
          ) : null}
        </>
      }
      result={
        <Result
          label={out.label}
          value={out.scalar !== null ? fmt(out.scalar, 10) : out.matrix ? `${out.matrix.length} × ${out.matrix[0]?.length ?? 0}` : '–'}
          unit={out.matrix ? 'matrix' : undefined}
          error={out.error}
          copy={out.matrix ? out.matrix.map((r) => r.map((v) => num(v, 10)).join('\t')).join('\n') : out.scalar !== null ? num(out.scalar, 12) : undefined}
          sub={out.matrix ? <MatrixView m={out.matrix} /> : out.sub}
        />
      }
      visual={
        out.error ? null : (
          <Stage summary={square2 ? planeSummary(a!) : out.summary}>
            {square2 ? <TransformPlane m={a!} /> : <MatrixSweep panes={out.panes} steps={out.steps} ops={out.ops} />}
          </Stage>
        )
      }
      working={out.working.length ? <Working lines={out.working} caption="Values are rounded to 6 significant figures in the working; the result uses full precision." /> : null}
    />
  )
}

function MatrixView({ m }: { m: Mat }) {
  return (
    <div className="overflow-x-auto pt-1">
      <table className="border-separate border-spacing-x-3 border-spacing-y-1 text-[1.125rem] font-[650] text-foreground tabular-nums">
        <tbody>
          {m.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j} className="text-right">
                  {fmt(v, 6)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface Out {
  label: string
  scalar: number | null
  matrix: Mat | null
  sub?: string
  error: string | null
  working: string[]
  summary: string
  panes: { label: string; m: Mat }[]
  ops: string[]
  steps: SweepStep[]
}

function compute(op: Op, a: Mat | null, b: Mat | null, k: number | null): Out {
  const base: Out = { label: '', scalar: null, matrix: null, error: null, working: [], summary: '', panes: [], ops: [], steps: [] }
  if (!a) return { ...base, label: 'Result', error: 'Fill every cell of A with a number.' }
  const [n, m] = [a.length, a[0]!.length]
  const sq = n === m
  const cellsFill = (res: Mat, mark: (r: number, c: number) => SweepStep['mark'], note: (r: number, c: number) => string): SweepStep[] => {
    const steps: SweepStep[] = []
    res.forEach((row, r) => row.forEach((_, c) => steps.push({ mark: mark(r, c), shown: r * row.length + c + 1, note: note(r, c) })))
    return steps
  }
  switch (op) {
    case 'det': {
      if (!sq) return { ...base, label: 'Determinant', error: 'The determinant needs a square matrix: set A to as many rows as columns.' }
      const d = det(a)
      const tri = triangular(a)
      return {
        ...base,
        label: 'Determinant of A',
        scalar: d,
        sub: d === 0 ? 'det A = 0: A has no inverse and squashes space flat.' : `|det A| = ${fmt(Math.abs(d), 8)} is the factor by which A scales areas${n === 3 ? ' (volumes in 3D)' : ''}.`,
        working: detSteps(a),
        summary:
          n === 2
            ? ''
            : `After elimination the matrix is upper triangular; its diagonal ${tri.map((r, i) => fmt(r[i]!, 4)).join(', ')} multiplies to det A = ${fmt(d, 6)}.`,
        panes: [{ label: 'Upper triangular form', m: tri }],
        steps: tri.map((_, i) => ({
          mark: [{ pane: 0, r: i, c: i }],
          shown: Infinity,
          note: `product so far = ${num(clean(tri.slice(0, i + 1).reduce((p, r, j) => p * r[j]!, 1)) * signOf(a), 6)}`,
        })),
      }
    }
    case 'inv': {
      if (!sq) return { ...base, label: 'Inverse', error: 'Only a square matrix can have an inverse.' }
      const { inv, steps } = inverse(a)
      if (!inv) return { ...base, label: 'Inverse of A', error: 'det A = 0, so A has no inverse.', working: [...detSteps(a)] }
      const check = cleanMat(multiply(a, inv))
      return {
        ...base,
        label: 'Inverse of A',
        matrix: inv,
        working: [...steps, `A⁻¹ = ${show(inv)}`, `Check: A × A⁻¹ = ${show(check)}`],
        summary: `A⁻¹ has ${n * n} cells. Each one appears in turn; A × A⁻¹ gives the identity matrix.`,
        panes: [{ label: 'A', m: a }, { label: 'A⁻¹', m: inv }],
        ops: ['→'],
        steps: cellsFill(inv, () => [], (r, c) => `A⁻¹ row ${r + 1}, column ${c + 1} = ${num(inv[r]![c]!, 6)}`),
      }
    }
    case 'tr': {
      const t = transpose(a)
      return {
        ...base,
        label: 'Transpose of A',
        matrix: t,
        working: [`Row i of A becomes column i of Aᵀ.`, `A  = ${show(a)}`, `Aᵀ = ${show(t)}`],
        summary: `Each cell of A at row i, column j moves to row j, column i of Aᵀ, which is ${m} by ${n}.`,
        panes: [{ label: 'A', m: a }, { label: 'Aᵀ', m: t }],
        ops: ['→'],
        steps: cellsFill(t, (r, c) => [{ pane: 0, r: c, c: r }, { pane: 1, r, c }], (r, c) => `Aᵀ(${r + 1},${c + 1}) = A(${c + 1},${r + 1}) = ${num(t[r]![c]!)}`),
      }
    }
    case 'rank': {
      const red = rref(a)
      return {
        ...base,
        label: 'Rank of A',
        scalar: red.rank,
        sub: red.rank === Math.min(n, m) ? 'Full rank.' : `Rank is below ${Math.min(n, m)}: some rows depend on others.`,
        working: ['Row reduce A to reduced row echelon form and count the pivots.', ...red.steps, `RREF = ${show(red.m)}`, `rank = number of pivots = ${red.rank}`],
        summary: `The reduced row echelon form has ${red.rank} pivot${red.rank === 1 ? '' : 's'}, marked in turn.`,
        panes: [{ label: 'Reduced row echelon form', m: red.m }],
        steps: red.pivots.length
          ? red.pivots.map((c, i) => ({ mark: [{ pane: 0, r: i, c }], shown: Infinity, note: `pivot ${i + 1} in column ${c + 1}` }))
          : [{ mark: [], shown: Infinity, note: 'no pivots: A is all zeros' }],
      }
    }
    case 'scale': {
      if (k === null) return { ...base, label: 'k × A', error: 'Enter the scalar k.' }
      const res = scale(a, k)
      return {
        ...base,
        label: `${num(k)} × A`,
        matrix: cleanMat(res),
        working: [`Multiply every cell by k = ${num(k)}.`, ...res.flatMap((row, r) => row.map((v, c) => `c${r + 1}${c + 1} = ${num(k)} × ${num(a[r]![c]!)} = ${num(clean(v))}`))],
        summary: `Every cell of A is multiplied by ${num(k)}.`,
        panes: [{ label: 'A', m: a }, { label: 'kA', m: cleanMat(res) }],
        ops: [`× ${num(k)} →`],
        steps: cellsFill(res, (r, c) => [{ pane: 0, r, c }, { pane: 1, r, c }], (r, c) => `c${r + 1}${c + 1} = ${num(k)} × ${num(a[r]![c]!)} = ${num(clean(res[r]![c]!))}`),
      }
    }
    default: {
      if (!b) return { ...base, label: 'Result', error: 'Fill every cell of B with a number.' }
      const [p, q] = [b.length, b[0]!.length]
      if (op === 'mul') {
        if (m !== p) return { ...base, label: 'A × B', error: `A × B needs as many columns in A as rows in B. A has ${m} columns and B has ${p} rows.` }
        const res = cleanMat(multiply(a, b))
        return {
          ...base,
          label: 'A × B',
          matrix: res,
          working: ['Each cell is row i of A times column j of B, summed.', ...res.flatMap((row, r) => row.map((_, c) => productCellText(a, b, r, c)))],
          summary: `A (${n}×${m}) times B (${p}×${q}) gives a ${n}×${q} matrix. Each result cell is the row of A times the column of B, marked in turn.`,
          panes: [{ label: 'A', m: a }, { label: 'B', m: b }, { label: 'A × B', m: res }],
          ops: ['×', '='],
          steps: cellsFill(
            res,
            (r, c) => [...a[r]!.map((_, j) => ({ pane: 0, r, c: j })), ...b.map((_, i) => ({ pane: 1, r: i, c })), { pane: 2, r, c }],
            (r, c) => productCellText(a, b, r, c),
          ),
        }
      }
      if (n !== p || m !== q) return { ...base, label: op === 'add' ? 'A + B' : 'A − B', error: `A and B must be the same size. A is ${n}×${m} and B is ${p}×${q}.` }
      const sign = op === 'add' ? 1 : -1
      const res = cleanMat(add(a, b, sign))
      const s = op === 'add' ? '+' : '−'
      const cellText = (r: number, c: number) => `c${r + 1}${c + 1} = ${num(a[r]![c]!)} ${s} ${num(b[r]![c]!)} = ${num(res[r]![c]!)}`
      return {
        ...base,
        label: `A ${s} B`,
        matrix: res,
        working: [`${op === 'add' ? 'Add' : 'Subtract'} the cells in the same place.`, ...res.flatMap((row, r) => row.map((_, c) => cellText(r, c)))],
        summary: `Each cell of A ${s} B uses the cells in the same place in A and B, marked in turn.`,
        panes: [{ label: 'A', m: a }, { label: 'B', m: b }, { label: `A ${s} B`, m: res }],
        ops: [s, '='],
        steps: cellsFill(res, (r, c) => [{ pane: 0, r, c }, { pane: 1, r, c }, { pane: 2, r, c }], cellText),
      }
    }
  }
}

/** Upper triangular form by elimination with partial pivoting (for the det picture). */
function triangular(a: Mat): Mat {
  const m = a.map((r) => r.slice())
  const n = m.length
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r
    if (Math.abs(m[piv]![c]!) < 1e-12) continue
    if (piv !== c) [m[piv], m[c]] = [m[c]!, m[piv]!]
    for (let r = c + 1; r < n; r++) {
      const f = m[r]![c]! / m[c]![c]!
      for (let k = c; k < n; k++) m[r]![k]! -= f * m[c]![k]!
    }
  }
  return cleanMat(m)
}

/** +1 or −1: the sign that row swaps in triangular() give the diagonal product. */
function signOf(a: Mat): number {
  const t = triangular(a)
  const p = t.reduce((s, r, i) => s * r[i]!, 1)
  const d = det(a)
  return p === 0 || d === 0 ? 1 : Math.sign(d) * Math.sign(p)
}

/* ── 2×2: the plane under the transformation ─────────────────────── */

const PHASE = { go: 1.6, hold: 1.4 }

function TransformPlane({ m }: { m: Mat }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useInk()
  useResizeSignal(canvas)
  const clock = useRef(0)
  const key = JSON.stringify(m)
  useEffect(() => {
    clock.current = 0
  }, [key])
  const cycle = 2 * (PHASE.go + PHASE.hold)
  const amount = (t: number) => {
    const u = t % cycle
    const e = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    if (u < PHASE.hold * 0.5) return 0
    if (u < PHASE.hold * 0.5 + PHASE.go) return e((u - PHASE.hold * 0.5) / PHASE.go)
    if (u < PHASE.hold * 1.5 + PHASE.go) return 1
    if (u < PHASE.hold * 1.5 + 2 * PHASE.go) return 1 - e((u - PHASE.hold * 1.5 - PHASE.go) / PHASE.go)
    return 0
  }
  const paint = (s: number) => {
    const p = prepCanvas(canvas.current)
    if (p) drawPlane(p.ctx, p.w, p.h, m, s, ink)
  }
  const { reduced } = useSimLoop(canvas, (dt) => {
    clock.current += dt
    paint(amount(clock.current))
  })
  useEffect(() => {
    if (reduced) paint(1)
    else paint(amount(clock.current))
  })
  const d = det(m)
  return (
    <canvas
      ref={canvas}
      className="block aspect-square w-full sm:aspect-[4/3]"
      role="img"
      aria-label={`The unit square and grid under A; area scales by ${fmt(Math.abs(d), 6)}`}
    />
  )
}

function planeSummary(m: Mat): string {
  const d = det(m)
  return `The grid and the unit square move to where A sends them, then back. Ink arrow: A sends (1, 0) to (${fmt(m[0]![0]!, 4)}, ${fmt(m[1]![0]!, 4)}). Grey arrow: (0, 1) to (${fmt(m[0]![1]!, 4)}, ${fmt(m[1]![1]!, 4)}). The hatched area is |det A| = ${fmt(Math.abs(d), 6)}${d < 0 ? '; det A is negative, so the square is flipped' : d === 0 ? '; det A is 0, so the square is squashed flat' : ''}.`
}

function drawPlane(ctx: CanvasRenderingContext2D, w: number, h: number, m: Mat, s: number, ink: Ink) {
  const a = 1 + (m[0]![0]! - 1) * s
  const b = m[0]![1]! * s
  const c = m[1]![0]! * s
  const d = 1 + (m[1]![1]! - 1) * s
  const corners = [
    [0, 0],
    [m[0]![0]!, m[1]![0]!],
    [m[0]![1]!, m[1]![1]!],
    [m[0]![0]! + m[0]![1]!, m[1]![0]! + m[1]![1]!],
  ]
  const ext = Math.max(1.5, ...corners.flat().map((v) => Math.abs(v))) * 1.12
  const k = Math.min(w, h) / 2 / ext
  const ox = w / 2
  const oy = h / 2
  const P = (x: number, y: number): [number, number] => [ox + (a * x + b * y) * k, oy - (c * x + d * y) * k]

  // transformed grid
  const N = Math.ceil(ext * 3)
  ctx.lineWidth = 1
  ctx.strokeStyle = ink.paper
  ctx.beginPath()
  for (let i = -N; i <= N; i++) {
    const [x1, y1] = P(i, -N)
    const [x2, y2] = P(i, N)
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    const [x3, y3] = P(-N, i)
    const [x4, y4] = P(N, i)
    ctx.moveTo(x3, y3)
    ctx.lineTo(x4, y4)
  }
  ctx.stroke()
  // fixed axes for reference
  ctx.strokeStyle = ink.hairline
  ctx.beginPath()
  ctx.moveTo(0, oy)
  ctx.lineTo(w, oy)
  ctx.moveTo(ox, 0)
  ctx.lineTo(ox, h)
  ctx.stroke()

  // the unit square, hatched
  const q = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)]
  ctx.save()
  ctx.beginPath()
  q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.clip()
  ctx.strokeStyle = ink.grey
  ctx.lineWidth = 1.25
  ctx.beginPath()
  for (let t = -w - h; t < w + h; t += 7) {
    ctx.moveTo(t, 0)
    ctx.lineTo(t + h, h)
  }
  ctx.stroke()
  ctx.restore()
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 1.5
  ctx.beginPath()
  q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.stroke()

  const [ix, iy] = P(1, 0)
  const [jx, jy] = P(0, 1)
  arrow(ctx, ox, oy, jx, jy, ink.grey, 2.5, 9)
  arrow(ctx, ox, oy, ix, iy, ink.ink, 2.5, 9)
  const area = Math.abs(a * d - b * c)
  const [cx, cy] = P(0.5, 0.5)
  label(ctx, `area ${fmt(area, 3)}`, cx, cy + 4, { color: ink.ink, halo: ink.fill, font: ink.font, size: 12, align: 'center', weight: 650 })
}
