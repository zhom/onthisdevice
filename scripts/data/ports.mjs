/**
 * IANA Service Name and Transport Protocol Port Number Registry. Tier: monthly.
 *
 *   src/data/ports.json                    meta + counts
 *   public/data/ports/<hash>/ports.json    [[from, to, name, protocols, description, reference], ...]
 */
import { check, commit, csvObjects, get, meta, readJson, run } from './lib.mjs'

const URL = 'https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.csv'
const PROTO_ORDER = ['tcp', 'udp', 'sctp', 'dccp']

/** Registry CSV rows -> merged entries (one per port range + name + description). */
export function parsePorts(text) {
  const rows = csvObjects(text)
  const merged = new Map()
  for (const r of rows) {
    const port = r['Port Number']
    if (!port) continue
    const m = /^(\d+)(?:-(\d+))?$/.exec(port)
    if (!m) continue
    const from = Number(m[1])
    const to = Number(m[2] ?? m[1])
    if (from > 65535 || to > 65535 || to < from) continue
    const name = r['Service Name']
    const description = r.Description.replace(/\s+/g, ' ').trim()
    const reference = (r.Reference.match(/RFC\s?\d+/) ?? [''])[0].replace(/RFC\s?/, 'RFC ')
    const key = `${from}-${to}\0${name}\0${description}`
    const e = merged.get(key) ?? { from, to, name, protocols: new Set(), description, reference }
    if (r['Transport Protocol']) e.protocols.add(r['Transport Protocol'].toLowerCase())
    if (!e.reference && reference) e.reference = reference
    merged.set(key, e)
  }
  return [...merged.values()]
    .map((e) => [e.from, e.to, e.name, PROTO_ORDER.filter((p) => e.protocols.has(p)).join(' '), e.description, e.reference])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : 1))
}

async function main() {
  const entries = parsePorts(await get(URL))
  check(entries.length > 8000 && entries.length < 30_000, `ports: ${entries.length} entries`)
  const find = (port, name) => entries.some((e) => e[0] <= port && port <= e[1] && e[2] === name)
  for (const [port, name] of [
    [22, 'ssh'],
    [80, 'http'],
    [443, 'https'],
    [53, 'domain'],
    [3389, 'ms-wbt-server'],
  ])
    check(find(port, name), `ports: ${port} is not ${name}`)
  const named = entries.filter((e) => e[2]).length
  const prev = readJson('src/data/ports.json')
  if (prev?.counts) check(Math.abs(named - prev.counts.named) / prev.counts.named < 0.1, `ports: named ${prev.counts.named} -> ${named}`)
  const lazy = new Map([['ports.json', `[\n${entries.map((e) => JSON.stringify(e)).join(',\n')}\n]`]])
  commit(
    'ports',
    {
      meta: meta({
        source: { name: 'IANA Service Name and Transport Protocol Port Number Registry', url: 'https://www.iana.org/assignments/service-names-port-numbers/' },
        licence: { name: 'CC0 1.0 (IANA protocol registries)', url: 'https://www.iana.org/help/licensing-terms' },
        validFor: new Date().toISOString().slice(0, 10),
      }),
      counts: { entries: entries.length, named },
    },
    lazy,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('ports', main)
