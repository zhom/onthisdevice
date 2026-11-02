/**
 * MAC address vendors from the IEEE Registration Authority public listings: MA-L (OUI, 24-bit),
 * MA-M (28-bit), MA-S (36-bit) and the older IAB (36-bit). Tier: monthly.
 *
 *   src/data/mac-vendors.json                   meta + counts
 *   public/data/mac-vendors/<hash>/<xx>.json    { prefix: [organisation, country] } for MACs starting with byte xx
 */
import { check, commit, csvObjects, get, meta, readJson, run } from './lib.mjs'

const LISTS = [
  ['MA-L', 'https://standards-oui.ieee.org/oui/oui.csv'],
  ['MA-M', 'https://standards-oui.ieee.org/oui28/mam.csv'],
  ['MA-S', 'https://standards-oui.ieee.org/oui36/oui36.csv'],
  ['IAB', 'https://standards-oui.ieee.org/iab/iab.csv'],
]

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

/** Country code from an IEEE address line ("... Bloomington MN US 55438" -> "US"). */
export function countryOf(address) {
  const tokens = address.trim().split(/\s+/)
  for (let i = tokens.length - 1; i >= Math.max(0, tokens.length - 4); i--) {
    const t = tokens[i]
    if (/^[A-Z]{2}$/.test(t)) {
      try {
        if (regionNames.of(t) !== t) return t
      } catch {
        // not a region code
      }
    }
  }
  return ''
}

/** CSV text of one list -> [[prefix hex (6, 7 or 9 digits), organisation, country]] */
export function parseRegistry(text) {
  return csvObjects(text)
    .map((r) => [r.Assignment.toUpperCase(), r['Organization Name'].replace(/\s+/g, ' ').trim(), countryOf(r['Organization Address'] ?? '')])
    .filter(([p, name]) => /^[0-9A-F]{6,9}$/.test(p) && name)
}

async function main() {
  const all = []
  const counts = {}
  for (const [registry, url] of LISTS) {
    const rows = parseRegistry(await get(url, { timeoutMs: 240_000 }))
    counts[registry] = rows.length
    all.push(...rows)
  }
  check(counts['MA-L'] > 30_000 && counts['MA-L'] < 80_000, `mac: MA-L has ${counts['MA-L']}`)
  check(counts['MA-M'] > 4000, `mac: MA-M has ${counts['MA-M']}`)
  check(counts['MA-S'] > 4000, `mac: MA-S has ${counts['MA-S']}`)
  check(counts.IAB > 3000, `mac: IAB has ${counts.IAB}`)
  const byPrefix = new Map(all.map(([p, name, cc]) => [p, [name, cc]]))
  check(/apple/i.test(byPrefix.get('F0D1A9')?.[0] ?? ''), 'mac: F0:D1:A9 is not Apple')
  check(/intel/i.test(byPrefix.get('00AA00')?.[0] ?? ''), 'mac: 00:AA:00 is not Intel')
  const prev = readJson('src/data/mac-vendors.json')
  if (prev?.counts) {
    for (const k of Object.keys(counts)) check(counts[k] >= prev.counts[k] * 0.95, `mac: ${k} ${prev.counts[k]} -> ${counts[k]}`)
  }
  const shards = new Map()
  for (const [p, info] of [...byPrefix.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const k = p.slice(0, 2)
    if (!shards.has(k)) shards.set(k, {})
    shards.get(k)[p] = info
  }
  const lazy = new Map([...shards.entries()].map(([k, v]) => [`${k}.json`, JSON.stringify(v)]))
  commit(
    'mac-vendors',
    {
      meta: meta({
        source: { name: 'IEEE Registration Authority public listings (MA-L, MA-M, MA-S, IAB)', url: 'https://standards.ieee.org/products-programs/regauth/' },
        licence: { name: 'IEEE asserts no copyright in the public listing and does not restrict its distribution', url: 'https://standards.ieee.org/faqs/regauth/' },
        validFor: new Date().toISOString().slice(0, 10),
      }),
      counts,
    },
    lazy,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('mac-vendors', main)
