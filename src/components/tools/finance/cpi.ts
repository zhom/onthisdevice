/**
 * Annual average CPI-U (Consumer Price Index for All Urban Consumers,
 * U.S. city average, all items), index base 1982-84 = 100.
 *
 * Source: U.S. Bureau of Labor Statistics, series CUUR0000SA0, refreshed each
 * month by scripts/data (src/data/cpi-us.json). The table holds full calendar
 * years only; the year after the last one is not yet final.
 */
import cpiData from '@/data/cpi-us.json'

export const CPI_U: Record<number, number> = cpiData.annual

/** Annual averages from this year onward are provisional and subject to revision. */
export const CPI_PROVISIONAL_FROM = Math.max(...Object.keys(CPI_U).map(Number)) + 1

export const CPI_YEARS: number[] = Object.keys(CPI_U)
  .map(Number)
  .sort((a, b) => a - b)

export const CPI_MIN_YEAR = CPI_YEARS[0] ?? 1913
export const CPI_MAX_YEAR = CPI_YEARS[CPI_YEARS.length - 1] ?? 2025

export function cpiFor(year: number): number | undefined {
  return CPI_U[year]
}

/** Year-over-year inflation rate in percent, or undefined at the series start. */
export function cpiYoY(year: number): number | undefined {
  const now = CPI_U[year]
  const prev = CPI_U[year - 1]
  if (now === undefined || prev === undefined) return undefined
  return ((now - prev) / prev) * 100
}

/** Decades with their average annual inflation, for the reference table. */
export function decadeAverages(): { label: string; from: number; to: number; annualPct: number }[] {
  const out: { label: string; from: number; to: number; annualPct: number }[] = []
  for (let start = 1920; start <= 2020; start += 10) {
    const from = start
    const to = Math.min(start + 10, CPI_MAX_YEAR)
    const a = CPI_U[from]
    const b = CPI_U[to]
    if (a === undefined || b === undefined || to <= from) continue
    const annual = (Math.pow(b / a, 1 / (to - from)) - 1) * 100
    out.push({ label: `${from}s`, from, to, annualPct: annual })
  }
  return out
}
