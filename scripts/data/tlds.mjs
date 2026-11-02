/**
 * Top-level domains (IANA root zone) and the Public Suffix List. Tier: monthly.
 *
 *   src/data/tlds.json                 meta + counts
 *   public/data/tlds/<hash>/tlds.json  [[ascii, unicode, type, manager], ...] for each delegated TLD
 *   public/data/tlds/<hash>/psl.json   { icann: [rules], private: [rules] }, rules in ASCII (punycode)
 */
import { domainToASCII } from 'node:url'
import { check, commit, get, meta, readJson, run } from './lib.mjs'

const URL_LIST = 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt'
const URL_DB = 'https://www.iana.org/domains/root/db'
const URL_PSL = 'https://publicsuffix.org/list/public_suffix_list.dat'

const decodeEntities = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))

/** Root zone database HTML -> Map(ascii tld -> { unicode, type, manager }) */
export function parseRootDb(html) {
  const out = new Map()
  for (const m of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => decodeEntities(c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()))
    const href = /href="\/domains\/root\/db\/([^"]+)"/.exec(m[1])
    if (!href || cells.length < 4) continue
    const ascii = href[1].replace(/\.html$/, '').toLowerCase()
    const hasStatus = cells.length >= 5
    out.set(ascii, {
      unicode: cells[0].split(' ')[0].replace(/^\./, ''),
      type: hasStatus ? cells[2] : cells[1],
      manager: hasStatus ? cells[3] : cells[2],
    })
  }
  return out
}

/** PSL text -> { icann, private } rule lists in ASCII. */
export function parsePsl(text) {
  const out = { icann: [], private: [] }
  let section = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.includes('===BEGIN ICANN DOMAINS===')) section = 'icann'
    else if (line.includes('===BEGIN PRIVATE DOMAINS===')) section = 'private'
    else if (line.includes('===END')) section = null
    if (!section || !line || line.startsWith('//')) continue
    const rule = line.split(/\s/)[0]
    const bang = rule.startsWith('!') ? '!' : ''
    const body = rule.slice(bang.length)
    const ascii = body
      .split('.')
      .map((label) => (label === '*' ? '*' : domainToASCII(label) || label))
      .join('.')
    out[section].push(bang + ascii.toLowerCase())
  }
  return out
}

async function main() {
  const listText = await get(URL_LIST)
  const delegated = listText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.trim().toLowerCase())
  check(delegated.length > 1000 && delegated.length < 3000, `tlds: ${delegated.length} delegated TLDs`)
  for (const t of ['com', 'org', 'uk', 'de', 'xn--p1ai', 'arpa']) check(delegated.includes(t), `tlds: ${t} missing`)
  const db = parseRootDb(await get(URL_DB, { timeoutMs: 180_000 }))
  check(db.size > 1200, `tlds: root zone database has ${db.size} rows`)
  check(db.get('com')?.type === 'generic' || /generic/i.test(db.get('com')?.type ?? ''), `tlds: .com type is ${db.get('com')?.type}`)
  const rows = delegated.map((t) => {
    const d = db.get(t)
    return [t, d?.unicode ?? t, d?.type ?? '', d?.manager ?? '']
  })
  const missingInfo = rows.filter((r) => !r[2]).length
  check(missingInfo < 20, `tlds: ${missingInfo} TLDs without a type`)

  const psl = parsePsl(await get(URL_PSL))
  check(psl.icann.length > 5000 && psl.private.length > 2000, `tlds: PSL has ${psl.icann.length} ICANN and ${psl.private.length} private rules`)
  check(psl.icann.includes('co.uk') && psl.icann.includes('*.ck') && psl.icann.includes('!www.ck'), 'tlds: PSL is missing known rules')
  const prev = readJson('src/data/tlds.json')
  if (prev?.counts) check(Math.abs(delegated.length - prev.counts.tlds) < 60, `tlds: ${prev.counts.tlds} -> ${delegated.length}`)

  const lazy = new Map([
    ['tlds.json', `[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]`],
    ['psl.json', `{"icann":${JSON.stringify(psl.icann)},\n"private":${JSON.stringify(psl.private)}}`],
  ])
  commit(
    'tlds',
    {
      meta: meta({
        source: { name: 'IANA Root Zone Database and the Public Suffix List', url: 'https://www.iana.org/domains/root/db' },
        sources: [
          { name: 'IANA Root Zone Database', url: URL_DB },
          { name: 'Public Suffix List', url: 'https://publicsuffix.org/' },
        ],
        licence: { name: 'IANA root zone data (public); Public Suffix List under MPL 2.0', url: 'https://mozilla.org/MPL/2.0/' },
        validFor: new Date().toISOString().slice(0, 10),
      }),
      counts: { tlds: delegated.length, icann: psl.icann.length, private: psl.private.length },
      version: (/^# Version (\d+)/m.exec(listText) ?? [])[1] ?? '',
    },
    lazy,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('tlds', main)
