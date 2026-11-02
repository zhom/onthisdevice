/**
 * US weekly average mortgage rates: Freddie Mac Primary Mortgage Market Survey (PMMS),
 * 30-year fixed since April 1971 and 15-year fixed since August 1991. Tier: weekly
 * (published Thursdays at noon US Eastern time).
 *
 *   src/data/mortgage-rates.json                   latest week (the mortgage calculator can import it)
 *   public/data/mortgage-rates/<hash>/history.json every week
 */
import { check, checkRange, chunkedArray, commit, get, meta, run } from './lib.mjs'

const URL = 'https://www.freddiemac.com/pmms/docs/PMMS_history.csv'

/** "4/2/1971" -> "1971-04-02" */
export function usDate(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim())
  if (!m) return null
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

/** PMMS history CSV -> [{ date, r30, r15 }] ascending. Empty cells become null. */
export function parsePmms(text) {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/)
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const i30 = header.indexOf('pmms30')
  const i15 = header.indexOf('pmms15')
  check(i30 > 0 && i15 > 0, `mortgage: unexpected header ${lines[0]}`)
  const num = (s) => {
    const v = Number(String(s ?? '').trim())
    return String(s ?? '').trim() === '' || !Number.isFinite(v) ? null : v
  }
  return lines
    .slice(1)
    .map((l) => l.split(','))
    .map((c) => ({ date: usDate(c[0] ?? ''), r30: num(c[i30]), r15: num(c[i15]) }))
    .filter((r) => r.date && r.r30 !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

async function main() {
  const rows = parsePmms(await get(URL, { ua: 'browser' }))
  check(rows.length >= 2800 && rows.length < 4000, `mortgage: ${rows.length} weeks`)
  check(rows[0].date === '1971-04-02', `mortgage: starts ${rows[0].date}`)
  const last = rows[rows.length - 1]
  const prev = rows[rows.length - 2]
  const ageDays = (Date.now() - Date.parse(`${last.date}T00:00:00Z`)) / 86_400_000
  check(ageDays < 15, `mortgage: latest week ${last.date} is ${ageDays.toFixed(0)} days old`)
  for (const r of rows) {
    checkRange(r.r30, 1, 20, `mortgage 30y ${r.date}`)
    if (r.r15 !== null) checkRange(r.r15, 1, 20, `mortgage 15y ${r.date}`)
  }
  check(last.r15 !== null, 'mortgage: no 15-year rate this week')
  check(Math.abs(last.r30 - prev.r30) <= 1, `mortgage: 30y moved ${prev.r30} -> ${last.r30} in a week`)
  check(Math.abs(last.r15 - prev.r15) <= 1, `mortgage: 15y moved ${prev.r15} -> ${last.r15} in a week`)
  for (let i = 1; i < rows.length; i++) check(rows[i].date > rows[i - 1].date, `mortgage: duplicate week ${rows[i].date}`)

  const yearAgo = rows.findLast((r) => r.date <= `${Number(last.date.slice(0, 4)) - 1}${last.date.slice(4)}`)
  const lazy = new Map([
    [
      'history.json',
      `{"dates":${chunkedArray(rows.map((r) => r.date), 52)},\n"r30":${chunkedArray(rows.map((r) => r.r30), 52)},\n"r15":${chunkedArray(rows.map((r) => r.r15), 52)}}`,
    ],
  ])
  commit(
    'mortgage-rates',
    {
      meta: meta({
        source: { name: 'Freddie Mac, Primary Mortgage Market Survey (PMMS)', url: 'https://www.freddiemac.com/pmms' },
        licence: { name: 'Freddie Mac: may be used with attribution, unaltered', url: 'https://www.freddiemac.com/pmms/pmms_archives' },
        validFor: last.date,
      }),
      date: last.date,
      fixed30: last.r30,
      fixed15: last.r15,
      previous: { date: prev.date, fixed30: prev.r30, fixed15: prev.r15 },
      yearAgo: yearAgo ? { date: yearAgo.date, fixed30: yearAgo.r30, fixed15: yearAgo.r15 } : null,
      weeks: rows.length,
    },
    lazy,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('mortgage-rates', main)
