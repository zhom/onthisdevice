/** Right triangles: a² + b² = c². Pure; the tests import it. */

export type Side = 'a' | 'b' | 'c'

export interface RightTriangle {
  a: number
  b: number
  c: number
  /** Angle opposite a, degrees. */
  A: number
  /** Angle opposite b, degrees. */
  B: number
  area: number
  perimeter: number
  /** Height to the hypotenuse. */
  h: number
}

/**
 * Solve for the missing side. `known` holds the other two. Returns an error
 * message when the legs are not shorter than the hypotenuse.
 */
export function solveRight(find: Side, known: { a?: number; b?: number; c?: number }): RightTriangle | string {
  let { a = 0, b = 0, c = 0 } = known
  if (find === 'c') c = Math.hypot(a, b)
  else {
    const leg = find === 'a' ? b : a
    if (!(c > leg)) return 'The hypotenuse c must be longer than the other side.'
    const x = Math.sqrt(c * c - leg * leg)
    if (find === 'a') a = x
    else b = x
  }
  const A = (Math.atan2(a, b) * 180) / Math.PI
  return { a, b, c, A, B: 90 - A, area: (a * b) / 2, perimeter: a + b + c, h: (a * b) / c }
}

/** True when a, b, c are whole numbers with a² + b² = c². */
export function isTriple(a: number, b: number, c: number): boolean {
  return [a, b, c].every((v) => Number.isInteger(v) && v > 0) && a * a + b * b === c * c
}
