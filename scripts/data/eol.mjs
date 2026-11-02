/**
 * Support and end-of-life dates of common software, from endoflife.date (MIT). Tier: weekly.
 *
 *   src/data/eol.json                   meta + product list (id, label, category)
 *   public/data/eol/<hash>/eol.json     { <id>: { label, category, labels, link, cycles: [[...]] } }
 *
 * A cycle is [name, label, released, activeSupportUntil, securitySupportUntil, latest, latestDate, lts].
 * The two "until" fields are an ISO date, true (ended, date unknown), false (no end set) or null (not tracked).
 */
import { check, commit, get, meta, readJson, run } from './lib.mjs'

const URL = 'https://endoflife.date/api/v1/products/full'
const MAX_CYCLES = 30

export const PRODUCTS = [
  // languages and runtimes
  'python', 'nodejs', 'php', 'ruby', 'go', 'rust', 'dotnet', 'dotnetfx', 'eclipse-temurin', 'oracle-jdk', 'kotlin', 'scala', 'perl', 'elixir', 'erlang', 'deno', 'bun', 'julia', 'powershell',
  // frameworks and libraries
  'django', 'rails', 'laravel', 'symfony', 'spring-boot', 'spring-framework', 'angular', 'angularjs', 'react', 'vue', 'nextjs', 'nuxt', 'svelte', 'express', 'nestjs', 'electron', 'jquery', 'bootstrap', 'tailwind-css', 'react-native', 'numpy',
  // databases
  'postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'valkey', 'sqlite', 'elasticsearch', 'opensearch', 'mssqlserver', 'oracle-database', 'apache-cassandra', 'clickhouse', 'neo4j', 'influxdb', 'couchbase-server',
  // operating systems
  'windows', 'windows-server', 'macos', 'ios', 'ipados', 'android', 'watchos', 'ubuntu', 'debian', 'rhel', 'centos', 'centos-stream', 'rocky-linux', 'almalinux', 'fedora', 'alpine-linux', 'amazon-linux', 'sles', 'opensuse', 'linuxmint', 'freebsd', 'openbsd', 'linux',
  // servers and infrastructure
  'nginx', 'apache-http-server', 'tomcat', 'haproxy', 'traefik', 'caddy', 'openssl', 'kubernetes', 'docker-engine', 'containerd', 'terraform', 'ansible-core', 'jenkins', 'gitlab', 'git', 'grafana', 'prometheus', 'apache-kafka', 'rabbitmq', 'hashicorp-vault', 'consul', 'proxmox-ve', 'esxi', 'vcenter', 'samba', 'postfix', 'squid',
  // applications and content systems
  'wordpress', 'drupal', 'joomla', 'magento', 'nextcloud', 'mediawiki', 'moodle', 'chrome', 'firefox', 'office', 'libreoffice', 'visual-studio', 'internet-explorer', 'blender', 'unity', 'godot', 'ffmpeg', 'iphone', 'pixel', 'samsung-mobile', 'tls',
]

const until = (isFlag, from) => (from ? from : isFlag === true ? true : isFlag === false ? false : null)

/** One endoflife.date v1 product -> compact record. */
export function compactProduct(p) {
  const cycles = (p.releases ?? []).slice(0, MAX_CYCLES).map((r) => [
    r.name,
    r.label && r.label !== r.name ? r.label : '',
    r.releaseDate ?? '',
    until(r.isEoas, r.eoasFrom),
    until(r.isEol, r.eolFrom),
    r.latest?.name ?? '',
    r.latest?.date ?? '',
    r.isLts ? 1 : 0,
  ])
  return {
    label: p.label,
    category: p.category,
    labels: { active: p.labels?.eoas ?? 'Active support', security: p.labels?.eol ?? 'Security support' },
    link: `https://endoflife.date/${p.name}`,
    cycles,
  }
}

async function main() {
  const j = await get(URL, { as: 'json', timeoutMs: 180_000 })
  check(Array.isArray(j.result) && j.result.length > 300, `eol: ${j.result?.length} products in the feed`)
  const byName = new Map(j.result.map((p) => [p.name, p]))
  const out = {}
  const missing = []
  for (const id of PRODUCTS) {
    const p = byName.get(id)
    if (!p || !p.releases?.length) {
      missing.push(id)
      continue
    }
    out[id] = compactProduct(p)
  }
  check(missing.length <= 5, `eol: missing products ${missing.join(', ')}`)
  const cycles = Object.values(out).reduce((a, p) => a + p.cycles.length, 0)
  check(cycles > 800, `eol: only ${cycles} release cycles`)
  for (const c of out.python.cycles) check(!c[2] || /^\d{4}-\d{2}-\d{2}$/.test(c[2]), `eol: bad python date ${c[2]}`)
  check(out.ubuntu.cycles.some((c) => c[7] === 1), 'eol: Ubuntu has no LTS cycle')
  const prev = readJson('src/data/eol.json')
  if (prev?.products) check(Object.keys(out).length >= prev.products.length - 3, `eol: ${prev.products.length} -> ${Object.keys(out).length} products`)
  if (missing.length) console.log(`eol: not in the feed: ${missing.join(', ')}`)

  const lazy = new Map([['eol.json', `{\n${Object.entries(out).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(',\n')}\n}`]])
  commit(
    'eol',
    {
      meta: meta({
        source: { name: 'endoflife.date', url: 'https://endoflife.date/' },
        licence: { name: 'MIT', url: 'https://github.com/endoflife-date/endoflife.date/blob/master/LICENSE' },
        validFor: (j.generated_at ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      }),
      products: Object.entries(out).map(([id, p]) => [id, p.label, p.category]),
    },
    lazy,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('eol', main)
