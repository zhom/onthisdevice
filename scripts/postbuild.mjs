#!/usr/bin/env node
/**
 * Runs after `astro build`:
 *  1. renders a 1200×630 share card for every page into dist/og/;
 *  2. checks dist/ against the host's static asset limits (25 MiB per file,
 *     20,000 files) so a deploy can never fail half way.
 */
import fs from 'node:fs'
import path from 'node:path'
import { cardFor, collectPages, renderCard } from './og/render.mjs'

const DIST = 'dist'
/* share cards */
{
  const started = Date.now()
  fs.mkdirSync(path.join(DIST, 'og'), { recursive: true })
  let made = 0
  for (const file of collectPages(DIST)) {
    const job = cardFor(file, fs.readFileSync(file, 'utf8'))
    if (!job) continue
    fs.writeFileSync(path.join(DIST, job.out), await renderCard(job.card))
    made++
  }
  console.log(`postbuild: ${made} share cards in ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

const LIMIT = 25 * 1024 * 1024
let files = 0
const big = []
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else {
      files++
      const size = fs.statSync(p).size
      if (size > LIMIT) big.push(`${p} (${(size / 1048576).toFixed(1)} MiB)`)
    }
  }
}
walk(DIST)
console.log(`postbuild: ${files} files in dist, none over 25 MiB`)
if (big.length || files > 20000) {
  for (const b of big) console.error(`  over 25 MiB: ${b}`)
  if (files > 20000) console.error(`  too many files: ${files} > 20000`)
  process.exit(1)
}
