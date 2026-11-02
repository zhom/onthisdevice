/**
 * US Consumer Price Index for All Urban Consumers (CPI-U), US city average, all items,
 * not seasonally adjusted, 1982-84 = 100 (BLS series CUUR0000SA0). Monthly since 1913.
 * Tier: monthly (BLS publishes mid-month for the month before).
 *
 *   src/data/cpi-us.json   monthly values + annual averages, imported by the inflation calculator
 */
import { check, checkRange, commit, get, meta, readJson, run } from './lib.mjs'

const URL = 'https://download.bls.gov/pub/time.series/cu/cu.data.1.AllItems'
const SERIES = 'CUUR0000SA0'

/** BLS time-series flat file -> { monthly: Map('YYYY-MM' -> value), annual: Map(year -> value) } */
export function parseBlsSeries(text, series) {
  const monthly = new Map()
  const annual = new Map()
  for (const line of text.split(/\r?\n/)) {
    const cols = line.split('\t').map((c) => c.trim())
    if (cols[0] !== series) continue
    const year = Number(cols[1])
    const period = cols[2]
    const value = Number(cols[3])
    if (!Number.isFinite(year) || !Number.isFinite(value)) continue
    if (period === 'M13') annual.set(year, value)
    else if (/^M(0[1-9]|1[0-2])$/.test(period)) monthly.set(`${year}-${period.slice(1)}`, value)
  }
  return { monthly, annual }
}

async function main() {
  const { monthly, annual } = parseBlsSeries(await get(URL, { ua: 'bot' }), SERIES)
  const months = [...monthly.keys()].sort()
  check(months[0] === '1913-01', `cpi: starts ${months[0]}`)
  check(months.length >= 1350 && months.length < 1800, `cpi: ${months.length} months`)
  // BLS may skip a month it could not collect; allow single missing months, at most two.
  let gaps = 0
  for (let i = 1; i < months.length; i++) {
    const [y, m] = months[i - 1].split('-').map(Number)
    const step = (Number(months[i].slice(0, 4)) - y) * 12 + Number(months[i].slice(5)) - m
    check(step === 1 || step === 2, `cpi: ${step - 1} months missing after ${months[i - 1]}`)
    if (step === 2) gaps++
  }
  check(gaps <= 2, `cpi: ${gaps} missing months`)
  const values = months.map((k) => monthly.get(k))
  for (let i = 1; i < values.length; i++) {
    const ratio = values[i] / values[i - 1]
    check(ratio > 0.95 && ratio < 1.06, `cpi: ${months[i]} moved ${((ratio - 1) * 100).toFixed(1)}% in a month`)
  }
  const latest = months[months.length - 1]
  checkRange(values[values.length - 1], 250, 700, `cpi ${latest}`)
  const ageDays = (Date.now() - Date.parse(`${latest}-01T00:00:00Z`)) / 86_400_000
  check(ageDays < 110, `cpi: latest month ${latest} is ${ageDays.toFixed(0)} days old`)
  const years = [...annual.keys()].sort((a, b) => a - b)
  check(years[0] === 1913 && years.length === years[years.length - 1] - 1912, 'cpi: annual averages have gaps')
  const prev = readJson('src/data/cpi-us.json')
  if (prev?.annual) {
    for (const [y, v] of Object.entries(prev.annual)) {
      const now = annual.get(Number(y))
      check(now !== undefined, `cpi: annual ${y} disappeared`)
      check(Math.abs(now - v) / v < 0.01, `cpi: annual ${y} revised ${v} -> ${now}`)
    }
  }

  // Monthly values in one array from 1913-01; null for a month BLS never published.
  const start = months[0]
  const list = []
  for (let y = 1913, m = 1; `${y}-${String(m).padStart(2, '0')}` <= latest; m === 12 ? (y++, (m = 1)) : m++) {
    list.push(monthly.get(`${y}-${String(m).padStart(2, '0')}`) ?? null)
  }
  commit('cpi-us', {
    meta: meta({
      source: { name: 'US Bureau of Labor Statistics, CPI-U, US city average, all items (CUUR0000SA0)', url: 'https://www.bls.gov/cpi/' },
      licence: { name: 'Public domain (US government work)', url: 'https://www.bls.gov/opub/copyright-information.htm' },
      validFor: latest,
    }),
    series: SERIES,
    indexBase: '1982-84=100',
    latestMonth: latest,
    monthlyStart: start,
    monthly: list,
    annual: Object.fromEntries(years.map((y) => [String(y), annual.get(y)])),
  })
}

if (import.meta.url === `file://${process.argv[1]}`) run('cpi-us', main)
