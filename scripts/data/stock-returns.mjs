/**
 * Long-run US stock market data, monthly since January 1871: S&P Composite price, dividends and
 * CPI as compiled by Robert Shiller, published as a Frictionless Data package under the PDDL.
 * Tier: monthly.
 *
 * Only months with price, dividend and CPI are kept, so total return (dividends reinvested)
 * and inflation adjustment are exact for every month offered.
 *
 *   src/data/stock-returns.json                     meta + first and last month
 *   public/data/stock-returns/<hash>/monthly.json   { price: [...], dividend: [...], cpi: [...] } from start
 */
import { check, checkRange, chunkedArray, commit, csvObjects, get, meta, readJson, run } from './lib.mjs'

const URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500/main/data/data.csv'

/** CSV -> complete monthly rows [{ month: 'YYYY-MM', price, dividend, cpi }] from 1871-01, no gaps. */
export function parseShiller(text) {
  const rows = csvObjects(text)
    .map((r) => ({ month: r.Date.slice(0, 7), price: Number(r.SP500), dividend: Number(r.Dividend), cpi: Number(r['Consumer Price Index']) }))
    .filter((r) => /^\d{4}-\d{2}$/.test(r.month))
    .sort((a, b) => (a.month < b.month ? -1 : 1))
  const out = []
  for (const r of rows) {
    if (!(r.price > 0 && r.dividend > 0 && r.cpi > 0)) break
    out.push(r)
  }
  return out
}

async function main() {
  const rows = parseShiller(await get(URL))
  check(rows.length > 1800, `stock-returns: only ${rows.length} complete months`)
  check(rows[0].month === '1871-01', `stock-returns: starts ${rows[0].month}`)
  for (let i = 1; i < rows.length; i++) {
    const [y, m] = rows[i - 1].month.split('-').map(Number)
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    check(rows[i].month === next, `stock-returns: gap after ${rows[i - 1].month}`)
    const move = rows[i].price / rows[i - 1].price
    check(move > 0.6 && move < 1.6, `stock-returns: ${rows[i].month} price moved ${((move - 1) * 100).toFixed(0)}%`)
  }
  const last = rows[rows.length - 1]
  checkRange(last.price, 1000, 100_000, 'stock-returns last price')
  checkRange(last.dividend / last.price, 0.003, 0.08, 'stock-returns dividend yield')
  const prev = readJson('src/data/stock-returns.json')
  if (prev?.end) check(last.month >= prev.end, `stock-returns: last month went back from ${prev.end} to ${last.month}`)

  const round = (v, d) => Number(v.toFixed(d))
  const lazy = new Map([
    [
      'monthly.json',
      `{"price":${chunkedArray(rows.map((r) => round(r.price, 2)), 120)},\n"dividend":${chunkedArray(rows.map((r) => round(r.dividend, 3)), 120)},\n"cpi":${chunkedArray(rows.map((r) => round(r.cpi, 3)), 120)}}`,
    ],
  ])
  commit(
    'stock-returns',
    {
      meta: meta({
        source: { name: 'Robert J. Shiller, U.S. stock market data (S&P Composite), via the Frictionless Data package', url: 'https://github.com/datasets/s-and-p-500' },
        licence: { name: 'ODC-PDDL 1.0 (public domain)', url: 'https://opendatacommons.org/licenses/pddl/1-0/' },
        validFor: last.month,
      }),
      start: rows[0].month,
      end: last.month,
      months: rows.length,
    },
    lazy,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('stock-returns', main)
