/**
 * Euro foreign exchange reference rates (European Central Bank), daily since 4 January 1999.
 * Tier: daily (the ECB publishes around 16:00 CET on TARGET working days).
 *
 *   src/data/fx.json                latest rates (EUR base) + meta
 *   public/data/fx/<hash>/dates.json   publication days as gaps from 1999-01-04
 *   public/data/fx/<hash>/<CUR>.json   that currency's rate per EUR on each day (null = not quoted)
 */
import { check, checkJump, checkRange, chunkedArray, commit, get, meta, readJson, run, unzip } from './lib.mjs'

const URL_HIST = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip'
const START = '1999-01-04'
const DAY = 86_400_000

/** Parses the ECB history CSV: dates ascending, and only currencies quoted on the latest day. */
export function parseEcbCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  const header = lines[0].split(',').map((s) => s.trim())
  const rows = lines
    .slice(1)
    .map((l) => l.split(','))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[0]))
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
  const latest = rows[rows.length - 1]
  const codes = []
  header.forEach((h, i) => {
    if (i > 0 && /^[A-Z]{3}$/.test(h) && Number.isFinite(Number(latest[i]))) codes.push([h, i])
  })
  const dates = rows.map((r) => r[0])
  const series = {}
  for (const [code, i] of codes) {
    series[code] = rows.map((r) => {
      const v = Number(r[i])
      return r[i] && r[i] !== 'N/A' && Number.isFinite(v) && v > 0 ? v : null
    })
  }
  return { dates, series }
}

/** Day gaps from START, one base-36 character per publication day. */
export function encodeDates(dates) {
  let prev = Date.parse(`${START}T00:00:00Z`) - DAY
  let out = ''
  for (const d of dates) {
    const t = Date.parse(`${d}T00:00:00Z`)
    const gap = Math.round((t - prev) / DAY)
    check(gap >= 1 && gap < 36, `fx: date gap ${gap} days before ${d}`)
    out += gap.toString(36)
    prev = t
  }
  return out
}

async function main() {
  const files = unzip(await get(URL_HIST, { as: 'buffer' }))
  const csv = [...files.entries()].find(([n]) => n.endsWith('.csv'))
  check(csv, 'fx: no CSV in the ECB zip')
  const { dates, series } = parseEcbCsv(csv[1].toString('utf8'))
  const codes = Object.keys(series).sort()

  check(dates[0] === START, `fx: history starts ${dates[0]}, expected ${START}`)
  check(dates.length >= 7000 && dates.length < 12_000, `fx: ${dates.length} days`)
  check(codes.length >= 25 && codes.length <= 45, `fx: ${codes.length} currencies quoted today`)
  for (const must of ['USD', 'GBP', 'JPY', 'CHF', 'CNY']) check(codes.includes(must), `fx: ${must} missing`)
  const last = dates[dates.length - 1]
  const ageDays = (Date.now() - Date.parse(`${last}T00:00:00Z`)) / DAY
  check(ageDays < 8, `fx: latest rates are ${ageDays.toFixed(1)} days old (${last})`)

  const rates = {}
  const prev = readJson('src/data/fx.json')
  for (const c of codes) {
    const values = series[c]
    const v = values[values.length - 1]
    checkRange(v, 1e-4, 1e6, `fx ${c}`)
    // One day's move above 20 % is an error in the feed, not a market move, for these currencies.
    const before = values[values.length - 2]
    if (before) checkJump(before, v, 0.2, `fx ${c} day on day`)
    if (prev?.rates?.[c] && prev.date !== last) checkJump(prev.rates[c], v, 0.3, `fx ${c} since last run`)
    rates[c] = v
  }
  checkRange(rates.USD, 0.6, 2.2, 'fx USD per EUR')

  const lazy = new Map()
  lazy.set('dates.json', JSON.stringify({ start: START, gaps: encodeDates(dates) }))
  for (const c of codes) lazy.set(`${c}.json`, chunkedArray(series[c], 128))

  commit(
    'fx',
    {
      meta: meta({
        source: { name: 'European Central Bank, euro foreign exchange reference rates', url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html' },
        licence: { name: 'ECB: free reuse with the source named', url: 'https://www.ecb.europa.eu/services/disclaimer/html/index.en.html' },
        validFor: last,
      }),
      date: last,
      base: 'EUR',
      days: dates.length,
      rates,
    },
    lazy,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('fx', main)
