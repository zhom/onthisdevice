/** Matrix arithmetic with the working written out. Pure; the tests import it. */
import { num } from './_viz/format'

export type Mat = number[][]

const EPS = 1e-12

/** Round values that are zero apart from floating point noise. */
export function clean(v: number): number {
  if (Math.abs(v) < EPS) return 0
  const r = Math.round(v)
  return Math.abs(v - r) < 1e-10 * Math.max(1, Math.abs(v)) ? r : v
}

export const cleanMat = (m: Mat): Mat => m.map((r) => r.map(clean))

export function dims(m: Mat): [number, number] {
  return [m.length, m[0]?.length ?? 0]
}

export function add(a: Mat, b: Mat, sign = 1): Mat {
  return a.map((r, i) => r.map((v, j) => v + sign * (b[i]?.[j] ?? 0)))
}

export function scale(a: Mat, k: number): Mat {
  return a.map((r) => r.map((v) => v * k))
}

export function transpose(a: Mat): Mat {
  const [r, c] = dims(a)
  return Array.from({ length: c }, (_, j) => Array.from({ length: r }, (_, i) => a[i]![j]!))
}

export function multiply(a: Mat, b: Mat): Mat {
  const [n, m] = dims(a)
  const p = dims(b)[1]
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: p }, (_, j) => {
      let s = 0
      for (let k = 0; k < m; k++) s += a[i]![k]! * b[k]![j]!
      return s
    }),
  )
}

/** The products summed for cell (i, j) of A × B, as text. */
export function productCellText(a: Mat, b: Mat, i: number, j: number): string {
  const m = dims(a)[1]
  const terms: string[] = []
  let s = 0
  for (let k = 0; k < m; k++) {
    terms.push(`${sub(a[i]![k]!)}×${sub(b[k]![j]!)}`)
    s += a[i]![k]! * b[k]![j]!
  }
  return `c${i + 1}${j + 1} = ${terms.join(' + ')} = ${num(clean(s))}`
}

function sub(v: number): string {
  const s = num(clean(v))
  return v < 0 ? `(${s})` : s
}

function minor(a: Mat, row: number, col: number): Mat {
  return a.filter((_, i) => i !== row).map((r) => r.filter((_, j) => j !== col))
}

/** Determinant by elimination with partial pivoting. */
export function det(a: Mat): number {
  const n = a.length
  const m = a.map((r) => r.slice())
  let d = 1
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r
    if (Math.abs(m[piv]![c]!) < EPS) return 0
    if (piv !== c) {
      ;[m[piv], m[c]] = [m[c]!, m[piv]!]
      d = -d
    }
    d *= m[c]![c]!
    for (let r = c + 1; r < n; r++) {
      const f = m[r]![c]! / m[c]![c]!
      for (let k = c; k < n; k++) m[r]![k]! -= f * m[c]![k]!
    }
  }
  return clean(d)
}

/** Working for the determinant: ad − bc, cofactors for 3×3, elimination for 4×4. */
export function detSteps(a: Mat): string[] {
  const n = a.length
  if (n === 1) return [`det = ${num(a[0]![0]!)}`]
  if (n === 2) {
    const [[p, q], [r, s]] = a as [[number, number], [number, number]]
    return [`det = ad − bc`, `    = ${sub(p)}×${sub(s)} − ${sub(q)}×${sub(r)}`, `    = ${num(clean(p * s))} − ${sub(clean(q * r))} = ${num(det(a))}`]
  }
  if (n === 3) {
    const terms = a[0]!.map((v, j) => {
      const m = minor(a, 0, j)
      return { v, sign: j % 2 === 0 ? 1 : -1, d: det(m), m }
    })
    return [
      'Expand along the first row: det = a11·M11 − a12·M12 + a13·M13',
      ...terms.map((t, j) => `M1${j + 1} = det[${t.m.map((r) => r.map((x) => num(x)).join(' ')).join('; ')}] = ${num(t.d)}`),
      `det = ${terms.map((t, j) => `${j === 0 ? '' : t.sign > 0 ? ' + ' : ' − '}${sub(t.v)}×${sub(t.d)}`).join('')} = ${num(det(a))}`,
    ]
  }
  // 4×4: elimination to upper triangular form.
  const m = a.map((r) => r.slice())
  const lines: string[] = ['Reduce to upper triangular form; det is the product of the diagonal (a row swap flips the sign).']
  let sign = 1
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r
    if (Math.abs(m[piv]![c]!) < EPS) {
      lines.push(`Column ${c + 1} has no pivot, so det = 0.`)
      return lines
    }
    if (piv !== c) {
      ;[m[piv], m[c]] = [m[c]!, m[piv]!]
      sign = -sign
      lines.push(`R${c + 1} ↔ R${piv + 1}`)
    }
    for (let r = c + 1; r < n; r++) {
      const f = m[r]![c]! / m[c]![c]!
      if (Math.abs(f) < EPS) continue
      for (let k = c; k < n; k++) m[r]![k]! -= f * m[c]![k]!
      lines.push(`R${r + 1} → R${r + 1} − ${sub(clean(f))}·R${c + 1}`)
    }
  }
  const diag = m.map((r, i) => r[i]!)
  lines.push(`det = ${sign < 0 ? '−' : ''}${diag.map((v) => sub(clean(v))).join(' × ')} = ${num(det(a))}`)
  return lines
}

export interface Rref {
  m: Mat
  rank: number
  pivots: number[]
  steps: string[]
  /** The matrix after each step, with the row that changed. */
  snaps: { m: Mat; row: number; op: string }[]
}

/** Reduced row echelon form by Gauss-Jordan elimination, with the row operations. */
export function rref(a: Mat): Rref {
  const m = a.map((r) => r.slice())
  const [rows, cols] = dims(m)
  const steps: string[] = []
  const snaps: Rref['snaps'] = []
  const log = (op: string, row: number) => {
    steps.push(op)
    snaps.push({ m: cleanMat(m), row, op })
  }
  const pivots: number[] = []
  let r = 0
  for (let c = 0; c < cols && r < rows; c++) {
    let piv = r
    for (let i = r + 1; i < rows; i++) if (Math.abs(m[i]![c]!) > Math.abs(m[piv]![c]!)) piv = i
    if (Math.abs(m[piv]![c]!) < 1e-10) continue
    if (piv !== r) {
      ;[m[piv], m[r]] = [m[r]!, m[piv]!]
      log(`R${r + 1} ↔ R${piv + 1}`, r)
    }
    const pv = m[r]![c]!
    if (Math.abs(pv - 1) > EPS) {
      for (let k = 0; k < cols; k++) m[r]![k] = m[r]![k]! / pv
      log(`R${r + 1} → R${r + 1} ÷ ${sub(clean(pv))}`, r)
    }
    for (let i = 0; i < rows; i++) {
      if (i === r) continue
      const f = m[i]![c]!
      if (Math.abs(f) < EPS) continue
      for (let k = 0; k < cols; k++) m[i]![k] = m[i]![k]! - f * m[r]![k]!
      log(`R${i + 1} → R${i + 1} − ${sub(clean(f))}·R${r + 1}`, i)
    }
    pivots.push(c)
    r++
  }
  return { m: cleanMat(m), rank: pivots.length, pivots, steps, snaps }
}

/** Inverse by Gauss-Jordan on [A | I]; null when A is singular. */
export function inverse(a: Mat): { inv: Mat | null; steps: string[] } {
  const n = a.length
  if (n === 2) {
    const d = det(a)
    const [[p, q], [r, s]] = a as [[number, number], [number, number]]
    if (d === 0) return { inv: null, steps: ['det = 0, so the matrix has no inverse.'] }
    return {
      inv: cleanMat([
        [s / d, -q / d],
        [-r / d, p / d],
      ]),
      steps: [`A⁻¹ = (1 ÷ det) × [d −b; −c a]`, `det = ${num(d)}`, `A⁻¹ = (1 ÷ ${sub(d)}) × [${num(s)} ${num(-q)}; ${num(-r)} ${num(p)}]`],
    }
  }
  const aug = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  const red = rref(aug)
  const ok = red.pivots.length === n && red.pivots.every((c, i) => c === i)
  const steps = ['Row reduce [A | I] until the left half is I; the right half is then A⁻¹.', ...red.steps]
  if (!ok) return { inv: null, steps: [...steps, 'The left half does not reduce to I, so the matrix has no inverse (det = 0).'] }
  return { inv: red.m.map((r) => r.slice(n)), steps }
}
