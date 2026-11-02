/** Mean, median, mode and range of a list. Pure; the tests import it. */

export interface Central {
  values: number[]
  sorted: number[]
  count: number
  sum: number
  mean: number
  median: number
  /** Every value that occurs most often; empty when every value occurs once. */
  modes: number[]
  /** How many times each mode occurs. */
  modeCount: number
  min: number
  max: number
  range: number
}

/** Numbers separated by commas, spaces, semicolons or new lines. */
export function parseList(raw: string): { values: number[]; bad: string[] } {
  const values: number[] = []
  const bad: string[] = []
  for (const tok of raw.split(/[\s,;]+/)) {
    if (!tok) continue
    const s = tok.replace(/[−–]/g, '-')
    const n = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s) ? Number(s) : Number.NaN
    if (Number.isFinite(n)) values.push(n)
    else bad.push(tok)
  }
  return { values, bad }
}

/** Decimal places of a value (up to 9), or −1 when it has more. */
function places(v: number): number {
  for (let k = 0; k <= 9; k++) {
    const x = v * 10 ** k
    if (Math.abs(Math.round(x) - x) < 1e-7 * Math.max(1, Math.abs(x))) return k
  }
  return -1
}

export function central(values: number[]): Central | null {
  const count = values.length
  if (count === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  // Values with few decimals are summed as whole numbers, so 0.1 + 0.2 gives 0.3.
  const k = sorted.reduce((acc, v) => (acc < 0 ? acc : Math.min(9, places(v) < 0 ? -1 : Math.max(acc, places(v)))), 0)
  const scale = 10 ** k
  const ints = k >= 0 ? sorted.map((v) => Math.round(v * scale)) : []
  const exact = k >= 0 && ints.every(Number.isSafeInteger) && Number.isSafeInteger(ints.reduce((a, b) => a + Math.abs(b), 0))
  const total = exact ? ints.reduce((a, b) => a + b, 0) : 0
  const sum = exact ? total / scale : sorted.reduce((a, b) => a + b, 0)
  const mid = Math.floor(count / 2)
  const median = count % 2 ? sorted[mid]! : exact ? (ints[mid - 1]! + ints[mid]!) / (2 * scale) : (sorted[mid - 1]! + sorted[mid]!) / 2
  const freq = new Map<number, number>()
  for (const v of sorted) freq.set(v, (freq.get(v) ?? 0) + 1)
  let modeCount = 0
  for (const c of freq.values()) modeCount = Math.max(modeCount, c)
  const modes = modeCount > 1 ? [...freq].filter(([, c]) => c === modeCount).map(([v]) => v) : []
  const min = sorted[0]!
  const max = sorted[count - 1]!
  return { values, sorted, count, sum, mean: exact ? total / (count * scale) : sum / count, median, modes, modeCount, min, max, range: max - min }
}
