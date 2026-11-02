/**
 * US baby names (Social Security Administration, national data from Social Security card
 * applications, every name given to at least 5 babies of one sex in a year), 1880 to the latest
 * year. Tier: yearly (SSA adds a year each May).
 *
 * Names that reached the top 1,000 for their sex in any year are kept.
 *   src/data/baby-names.json                 meta, years, births per year, latest top 10
 *   public/data/baby-names/<hash>/<a>.json   { Name: { F: [start, counts, ranks], M: [...] } } by first letter
 */
import { check, checkRange, commit, get, meta, readJson, run, unzip } from './lib.mjs'

const URL = 'https://www.ssa.gov/oact/babynames/names.zip'

/** names.zip entries -> { years, perYear: Map(year -> { F: [[name, count]], M: [...] }) } with ranks implied by order */
export function parseYear(text) {
  const out = { F: [], M: [] }
  for (const line of text.split(/\r?\n/)) {
    const [name, sex, count] = line.split(',')
    if (!name || (sex !== 'F' && sex !== 'M')) continue
    out[sex].push([name, Number(count)])
  }
  // SSA orders by count, then name; rank ties share the order SSA gives.
  for (const s of ['F', 'M']) out[s].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  return out
}

async function main() {
  const files = unzip(await get(URL, { as: 'buffer', ua: 'browser', timeoutMs: 240_000 }))
  const perYear = new Map()
  for (const [name, buf] of files) {
    const m = /^yob(\d{4})\.txt$/.exec(name)
    if (m) perYear.set(Number(m[1]), parseYear(buf.toString('utf8')))
  }
  const years = [...perYear.keys()].sort((a, b) => a - b)
  check(years[0] === 1880, `baby-names: starts ${years[0]}`)
  const last = years[years.length - 1]
  check(years.length === last - 1879, 'baby-names: missing years')
  checkRange(last, 2023, 2100, 'baby-names last year')
  const prev = readJson('src/data/baby-names.json')
  if (prev?.last) check(last >= prev.last, `baby-names: last year went back ${prev.last} -> ${last}`)

  const keep = { F: new Set(), M: new Set() }
  for (const y of years) for (const s of ['F', 'M']) perYear.get(y)[s].slice(0, 1000).forEach(([n]) => keep[s].add(n))
  check(keep.F.size > 4000 && keep.M.size > 3000, `baby-names: kept ${keep.F.size} F, ${keep.M.size} M`)

  const series = new Map()
  const births = { F: [], M: [] }
  for (const y of years) {
    const d = perYear.get(y)
    for (const s of ['F', 'M']) {
      births[s].push(d[s].reduce((a, [, c]) => a + c, 0))
      d[s].forEach(([n, c], i) => {
        if (!keep[s].has(n)) return
        const key = `${n}\0${s}`
        if (!series.has(key)) series.set(key, { start: y, counts: [], ranks: [] })
        const e = series.get(key)
        while (e.start + e.counts.length < y) {
          e.counts.push(0)
          e.ranks.push(0)
        }
        e.counts.push(c)
        e.ranks.push(i + 1)
      })
    }
  }
  for (const e of series.values()) {
    while (e.start + e.counts.length <= last) {
      e.counts.push(0)
      e.ranks.push(0)
    }
  }
  const latest = perYear.get(last)
  check(latest.F.length > 10_000 && latest.M.length > 8000, 'baby-names: latest year is short')
  checkRange(births.F[births.F.length - 1], 1_000_000, 3_000_000, 'baby-names births F')
  const lazy = new Map()
  const byLetter = new Map()
  for (const [key, e] of [...series.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const [n, s] = key.split('\0')
    const letter = n[0].toLowerCase()
    if (!byLetter.has(letter)) byLetter.set(letter, {})
    const shard = byLetter.get(letter)
    shard[n] ??= {}
    shard[n][s] = [e.start, e.counts, e.ranks]
  }
  for (const [letter, shard] of byLetter) lazy.set(`${letter}.json`, `{\n${Object.entries(shard).map(([n, v]) => `${JSON.stringify(n)}:${JSON.stringify(v)}`).join(',\n')}\n}`)
  commit(
    'baby-names',
    {
      meta: meta({
        source: { name: 'US Social Security Administration, baby names from Social Security card applications (national data)', url: 'https://www.ssa.gov/oact/babynames/limits.html' },
        licence: { name: 'Public domain (US government work)', url: 'https://www.ssa.gov/agency/disclaimer.html' },
        validFor: String(last),
      }),
      first: years[0],
      last,
      births,
      top: { F: latest.F.slice(0, 10).map(([n]) => n), M: latest.M.slice(0, 10).map(([n]) => n) },
      kept: { F: keep.F.size, M: keep.M.size },
    },
    lazy,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('baby-names', main)
