/**
 * US period life table (Social Security Administration, Office of the Chief Actuary), by sex,
 * ages 0 to 119. Tier: yearly (a new table comes with each Trustees Report, usually in spring).
 *
 *   src/data/life-table-us.json   { year, male: { q, l, e }, female: { q, l, e } }
 *     q: probability of dying within one year, l: survivors of 100,000 born, e: life expectancy
 */
import { check, checkRange, commit, get, meta, readJson, run } from './lib.mjs'

const URL = 'https://www.ssa.gov/oact/STATS/table4c6.html'

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

/** SSA table4c6 HTML -> { year, male, female } */
export function parseLifeTable(html) {
  const year = Number((/Here we present the (\d{4}) period life table/.exec(html.replace(/\s+/g, ' ')) ?? [])[1])
  const male = { q: [], l: [], e: [] }
  const female = { q: [], l: [], e: [] }
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1]))
    if (cells.length !== 7 || !/^\d+$/.test(cells[0])) continue
    const n = cells.map((c) => Number(c.replace(/,/g, '')))
    if (n[0] !== male.q.length) continue
    male.q.push(n[1])
    male.l.push(n[2])
    male.e.push(n[3])
    female.q.push(n[4])
    female.l.push(n[5])
    female.e.push(n[6])
  }
  return { year, male, female }
}

async function main() {
  const t = parseLifeTable(await get(URL, { ua: 'browser' }))
  checkRange(t.year, 2015, 2100, 'life-table year')
  for (const [sex, s] of Object.entries({ male: t.male, female: t.female })) {
    check(s.q.length === 120, `life-table: ${sex} has ${s.q.length} ages`)
    check(s.l[0] === 100_000, `life-table: ${sex} radix ${s.l[0]}`)
    checkRange(s.e[0], 60, 95, `life-table ${sex} e0`)
    for (let a = 1; a < 120; a++) {
      check(s.l[a] <= s.l[a - 1], `life-table: ${sex} survivors rise at age ${a}`)
      checkRange(s.q[a], 0, 1, `life-table ${sex} q${a}`)
    }
  }
  check(t.female.e[0] > t.male.e[0], 'life-table: female e0 not above male')
  const prev = readJson('src/data/life-table-us.json')
  if (prev?.year) check(t.year >= prev.year, `life-table: year went back ${prev.year} -> ${t.year}`)
  if (prev?.male?.e) check(Math.abs(prev.male.e[0] - t.male.e[0]) < 3, `life-table: male e0 ${prev.male.e[0]} -> ${t.male.e[0]}`)
  commit(
    'life-table',
    {
      meta: meta({
        source: { name: `US Social Security Administration, Office of the Chief Actuary, period life table ${t.year}`, url: URL },
        licence: { name: 'Public domain (US government work)', url: 'https://www.ssa.gov/agency/disclaimer.html' },
        validFor: String(t.year),
      }),
      year: t.year,
      male: t.male,
      female: t.female,
    },
    null,
    { srcName: 'life-table-us' },
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('life-table', main)
