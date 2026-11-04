/** Stock market growth from monthly price, dividend and CPI (pure, unit-tested). */

export interface Monthly {
  price: number[]
  /** Dividend per share, annualised, for each month. */
  dividend: number[]
  cpi: number[]
}

export interface Growth {
  /** Value of the investment at the end of each month, i0..i1, dividends reinvested. */
  total: number[]
  /** The same without dividends (price only). */
  price: number[]
  /** `total` in money of the start month (CPI adjusted). */
  real: number[]
  invested: number
  months: number
}

/**
 * Invests `amount` at month i0 (and `monthly` at the start of each later month) and follows
 * it to month i1. A month's total return is (P[t] + D[t] / 12) / P[t-1].
 */
export function growth(d: Monthly, i0: number, i1: number, amount: number, monthly = 0): Growth {
  const total = [amount]
  const price = [amount]
  let invested = amount
  for (let t = i0 + 1; t <= i1; t++) {
    const tr = (d.price[t] + d.dividend[t] / 12) / d.price[t - 1]
    const pr = d.price[t] / d.price[t - 1]
    total.push(total[total.length - 1] * tr + monthly)
    price.push(price[price.length - 1] * pr + monthly)
    invested += monthly
  }
  const real = total.map((v, k) => (v * d.cpi[i0]) / d.cpi[i0 + k])
  return { total, price, real, invested, months: i1 - i0 }
}

/** Each month's total return after inflation, dividends reinvested. */
export function realReturns(d: Monthly): Float64Array {
  return Float64Array.from({ length: d.price.length - 1 }, (_, i) => {
    const t = i + 1
    return (((d.price[t] + d.dividend[t] / 12) / d.price[t - 1]) * d.cpi[t - 1]) / d.cpi[t] - 1
  })
}

/** Compound annual growth rate of a lump sum, in percent. */
export function cagr(start: number, end: number, months: number): number {
  if (months <= 0 || start <= 0) return 0
  return ((end / start) ** (12 / months) - 1) * 100
}

/** Real (inflation-adjusted) value of a lump sum, start money -> end money of the same purchasing power. */
export function realCagr(d: Monthly, i0: number, i1: number): number {
  const g = growth(d, i0, i1, 1)
  const realEnd = g.total[g.total.length - 1] / (d.cpi[i1] / d.cpi[i0])
  return cagr(1, realEnd, i1 - i0)
}

/** Month index from 'YYYY-MM' relative to the data start. */
export function monthIndex(start: string, ym: string): number {
  const [y0, m0] = start.split('-').map(Number)
  const [y, m] = ym.split('-').map(Number)
  return (y - y0) * 12 + (m - m0)
}
