/**
 * CDC growth charts (2000), LMS parameters by sex and age: weight, length and head
 * circumference for 0 to 36 months; weight, stature and BMI for 2 to 20 years.
 * Public domain (US government work). Tier: yearly (the reference itself does not change;
 * the yearly run notices a moved or changed file).
 *
 *   src/data/growth-cdc.json                    meta + chart list
 *   public/data/growth-cdc/<hash>/growth.json   { <chart>: { male: [[agemos, L, M, S]], female: [...] } }
 */
import { check, checkRange, commit, csvObjects, get, meta, run } from './lib.mjs'

const BASE = 'https://www.cdc.gov/growthcharts/data/zscore'
export const CHARTS = [
  ['wtageinf', 'Weight for age, birth to 36 months', 'kg', 0, 36],
  ['lenageinf', 'Length for age, birth to 36 months', 'cm', 0, 36],
  ['hcageinf', 'Head circumference for age, birth to 36 months', 'cm', 0, 36],
  ['wtage', 'Weight for age, 2 to 20 years', 'kg', 24, 240],
  ['statage', 'Stature for age, 2 to 20 years', 'cm', 24, 240],
  ['bmiagerev', 'BMI for age, 2 to 20 years', 'kg/m²', 24, 240],
]

/** CDC LMS CSV -> { male, female } rows [agemos, L, M, S] ascending. */
export function parseLms(text) {
  const out = { male: [], female: [] }
  for (const r of csvObjects(text)) {
    const sex = r.Sex === '1' ? 'male' : r.Sex === '2' ? 'female' : null
    const age = Number(r.Agemos)
    if (!sex || !Number.isFinite(age)) continue
    out[sex].push([age, Number(r.L), Number(r.M), Number(r.S)].map((v) => Number(v.toPrecision(8))))
  }
  for (const s of ['male', 'female']) out[s].sort((a, b) => a[0] - b[0])
  return out
}

async function main() {
  const charts = {}
  for (const [id, , , from, to] of CHARTS) {
    const t = parseLms(await get(`${BASE}/${id}.csv`))
    for (const s of ['male', 'female']) {
      const rows = t[s]
      check(rows.length > 30, `growth: ${id} ${s} has ${rows.length} rows`)
      check(rows[0][0] <= from + 0.5 && rows[rows.length - 1][0] >= to - 0.5, `growth: ${id} ${s} covers ${rows[0][0]}..${rows[rows.length - 1][0]} months`)
      for (const [age, L, M, S] of rows) {
        checkRange(L, -5, 5, `growth ${id} L at ${age}`)
        checkRange(M, 0.5, 200, `growth ${id} M at ${age}`)
        checkRange(S, 0.01, 0.5, `growth ${id} S at ${age}`)
      }
      for (let i = 1; i < rows.length; i++) check(rows[i][0] > rows[i - 1][0], `growth: ${id} ${s} age order`)
    }
    charts[id] = t
  }
  // Spot checks against the published medians.
  checkRange(charts.wtageinf.male[0][2], 3.4, 3.7, 'growth: boys weight at birth median')
  checkRange(charts.statage.female.find((r) => r[0] >= 120)[2], 135, 142, 'growth: girls stature at 10 y median')
  const lazy = new Map([['growth.json', JSON.stringify(charts)]])
  commit(
    'growth-cdc',
    {
      meta: meta({
        source: { name: 'US Centers for Disease Control and Prevention, 2000 CDC growth charts (LMS data files)', url: 'https://www.cdc.gov/growthcharts/cdc-data-files.htm' },
        licence: { name: 'Public domain (US government work)', url: 'https://www.cdc.gov/other/agencymaterials.html' },
        validFor: '2000',
      }),
      charts: CHARTS.map(([id, title, unit, from, to]) => ({ id, title, unit, from, to })),
    },
    lazy,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('growth-charts', main)
