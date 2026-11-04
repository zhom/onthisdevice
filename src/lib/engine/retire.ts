/** Retirement simulations on all cores, and what their histograms say. */
import { fanOut, run } from './pool'
import type { RetirePlan } from './kernels'

export type { RetirePlan }

/** Years a path stays in one stretch of history, so bad years still cluster. */
export const BLOCK_YEARS = 5
const PATHS_PER_TASK = 50_000
/** A fast first answer, then the sharp one. */
const PREVIEW_PATHS = 100_000
export const FULL_PATHS = 1_000_000
export const PERCENTILES = [0.1, 0.25, 0.5, 0.75, 0.9] as const

/** The starting numbers of the calculator and of the home page. */
export const EXAMPLE = { age: 35, retire: 65, end: 95, savings: 100_000, saving: 1_000, spending: 4_000, stocks: 80, rest: 1.5 }

/** A yearly return in percent, as a monthly rate. */
export function monthlyRate(percent: number): number {
  return (1 + percent / 100) ** (1 / 12) - 1
}

export interface RetireResult {
  paths: number
  /** Share of paths that never ran out. */
  success: number
  /** For each year end: the balance at each of PERCENTILES. A path that ran out is 0. */
  bands: number[][]
  /** For each year end: the share of paths still solvent. */
  solvent: number[]
  milliseconds: number
}

let floors: Promise<Float64Array> | null = null

/** The balance at each percentile of one year, from its histogram. Interpolates within a bin. */
export function yearBands(hist: Uint32Array, offset: number, bins: number, edges: Float64Array, broke: number, paths: number): number[] {
  const bands: number[] = []
  let below = broke
  let bin = 0
  for (const p of PERCENTILES) {
    const target = p * paths
    while (bin < bins && below + hist[offset + bin]! < target) below += hist[offset + bin++]!
    if (target <= broke) bands.push(0)
    else if (bin === bins) bands.push(edges[bins]!)
    else bands.push(edges[bin]! + ((edges[bin + 1]! - edges[bin]!) * (target - below)) / Math.max(1, hist[offset + bin]!))
  }
  return bands
}

export function summarize(hist: Uint32Array, ruined: Uint32Array, edges: Float64Array, paths: number, milliseconds: number): RetireResult {
  const years = ruined.length
  const bins = hist.length / years
  const bands: number[][] = []
  const solvent: number[] = []
  let broke = 0
  for (let y = 0; y < years; y++) {
    broke += ruined[y]!
    bands.push(yearBands(hist, y * bins, bins, edges, broke, paths))
    solvent.push(1 - broke / paths)
  }
  return { paths, success: 1 - broke / paths, bands, solvent, milliseconds }
}

/** Runs `paths` paths. Stops early and returns null when `stale` turns true. */
export async function simulate(returns: Float64Array, plan: RetirePlan, paths: number, stale: () => boolean): Promise<RetireResult | null> {
  const started = performance.now()
  floors ??= run('retireBinFloors', undefined)
  const edges = await floors
  const years = plan.yearsSaving + plan.yearsRetired
  const tasks = Math.ceil(paths / PATHS_PER_TASK)
  const ruined = new Uint32Array(years)
  const hist = new Uint32Array(years * (edges.length - 1))
  let i = 0
  await fanOut(() => {
    if (i === tasks || stale()) return null
    const seed = BigInt(++i)
    return run('retire', { returns, plan, paths: PATHS_PER_TASK, seed }).then((part) => {
      for (let c = 0; c < hist.length; c++) hist[c]! += part.hist[c]!
      for (let y = 0; y < years; y++) ruined[y]! += part.ruined[y]!
    })
  })
  if (stale()) return null
  return summarize(hist, ruined, edges, tasks * PATHS_PER_TASK, performance.now() - started)
}

/** Reports a preview, then the full run. Stops when `stale` turns true. */
export async function simulateInStages(returns: Float64Array, plan: RetirePlan, stale: () => boolean, onResult: (result: RetireResult) => void): Promise<void> {
  for (const paths of [PREVIEW_PATHS, FULL_PATHS]) {
    const result = await simulate(returns, plan, paths, stale)
    if (result) onResult(result)
  }
}

/**
 * Success rate for each plan. Every plan uses the same random draws, so neighbours differ
 * because the plans differ. Stops early and returns null when `stale` turns true.
 */
export async function successGrid(returns: Float64Array, plans: RetirePlan[], paths: number, stale: () => boolean): Promise<number[] | null> {
  const out = new Array<number>(plans.length).fill(0)
  let i = 0
  await fanOut(() => {
    if (i === plans.length || stale()) return null
    const cell = i++
    return run('retireSurvivors', { returns, plan: plans[cell]!, paths, seed: 1n }).then((survivors) => {
      out[cell] = survivors / paths
    })
  })
  return stale() ? null : out
}
