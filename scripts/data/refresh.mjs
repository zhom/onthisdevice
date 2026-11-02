#!/usr/bin/env node
/**
 * Runs the data fetchers of one tier.
 *
 *   node scripts/data/refresh.mjs --tier daily|weekly|monthly|yearly [--only name[,name]]
 *   node scripts/data/refresh.mjs --list
 *
 * Each fetcher runs in its own process and writes its dataset only when every check passes,
 * so a failed source leaves its previous files in place. The exit code is 1 when any failed.
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT, flags } from './lib.mjs'

export const TIERS = {
  daily: ['ecb-fx', 'crypto'],
  weekly: ['mortgage-rates', 'cloud-ips', 'browser-versions', 'eol'],
  monthly: ['cpi-us', 'stock-returns', 'ip-asn', 'mac-vendors', 'ports', 'tlds', 'airports', 'unicode'],
  yearly: ['life-table', 'baby-names', 'growth-charts'],
}

const dir = path.dirname(fileURLToPath(import.meta.url))
const opts = flags()
if (opts.list) {
  for (const [tier, names] of Object.entries(TIERS)) console.log(`${tier}: ${names.join(' ')}`)
  process.exit(0)
}
const tier = opts.tier
if (!TIERS[tier]) {
  console.error('usage: refresh.mjs --tier daily|weekly|monthly|yearly [--only name,name]')
  process.exit(2)
}
const only = typeof opts.only === 'string' ? opts.only.split(',') : null
const names = TIERS[tier].filter((n) => !only || only.includes(n))
if (only) for (const n of only) if (!TIERS[tier].includes(n)) console.error(`refresh: ${n} is not in the ${tier} tier`)

const results = []
for (const name of names) {
  const t0 = Date.now()
  console.log(`\n== ${name}`)
  const r = spawnSync(process.execPath, [path.join(dir, `${name}.mjs`)], { stdio: 'inherit', timeout: 20 * 60_000 })
  results.push({ name, ok: r.status === 0, seconds: Math.round((Date.now() - t0) / 1000) })
}

// A fetcher that died while writing can leave a temp file or folder; never let it be committed.
for (const base of ['public/data', 'src/data']) {
  const abs = path.join(ROOT, base)
  if (!existsSync(abs)) continue
  for (const entry of readdirSync(abs, { recursive: true })) {
    if (/(^|\/)\.tmp-\d+$|\.json\.tmp$/.test(String(entry))) rmSync(path.join(abs, String(entry)), { recursive: true, force: true })
  }
}

const failed = results.filter((r) => !r.ok)
const lines = results.map((r) => `- ${r.ok ? 'ok' : 'FAILED'} ${r.name} (${r.seconds} s)`)
console.log(`\n${tier}: ${results.length - failed.length} ok, ${failed.length} failed\n${lines.join('\n')}`)
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Data refresh: ${tier}\n\n${lines.join('\n')}\n`)
}
process.exit(failed.length ? 1 : 0)
