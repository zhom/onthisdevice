/** Percent error, percentage change and percentage difference. Pure; the tests import it. */

/** |measured − true| ÷ |true| × 100, and the signed value. */
export function percentError(measured: number, actual: number): { abs: number; signed: number; diff: number } {
  const diff = measured - actual
  return { abs: (Math.abs(diff) / Math.abs(actual)) * 100, signed: (diff / Math.abs(actual)) * 100, diff }
}

/** (new − old) ÷ |old| × 100. */
export function percentChange(from: number, to: number): number {
  return ((to - from) / Math.abs(from)) * 100
}

/** |a − b| ÷ ((a + b) ÷ 2) × 100. */
export function percentDifference(a: number, b: number): number {
  return (Math.abs(a - b) / ((a + b) / 2)) * 100
}
