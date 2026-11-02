/** Linear systems by Gauss-Jordan elimination. Pure; the tests import it. */
import { rref } from './matrix'
import type { Mat } from './matrix'

export type SystemKind = 'unique' | 'none' | 'infinite'

export interface SystemSolution {
  kind: SystemKind
  /** The unique solution, when there is one. */
  x: number[] | null
  /** Rank of the coefficients and of the augmented matrix. */
  rank: number
  rankAug: number
  /** Row operations, then the reduced matrix. */
  steps: string[]
  reduced: Mat
  snaps: { m: Mat; row: number; op: string }[]
}

/** Solve A x = b, where `aug` is [A | b] with n rows and n + 1 columns. */
export function solveSystem(aug: Mat): SystemSolution {
  const n = aug.length
  const coef = aug.map((r) => r.slice(0, n))
  const rc = rref(coef).rank
  const red = rref(aug)
  const rankAug = red.rank
  let kind: SystemKind = 'unique'
  if (rankAug > rc) kind = 'none'
  else if (rc < n) kind = 'infinite'
  const x = kind === 'unique' ? red.m.map((r) => r[n]!) : null
  return { kind, x, rank: rc, rankAug, steps: red.steps, reduced: red.m, snaps: red.snaps }
}
