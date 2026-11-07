/**
 * Downloads files of Hugging Face datasets for the word tools. Run a script that uses it with
 * the token in its environment: `acct huggingface node scripts/data/hf-<name>.mjs`.
 * Downloads are cached in scripts/.tmp/hf-cache/ so that a second run reads from disk.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT, get } from './lib.mjs'

const CACHE = path.join(ROOT, 'scripts/.tmp/hf-cache')

/** Returns the file as a Buffer. `revision` pins the dataset commit. */
export async function hfFile(repo, file, { revision = 'main' } = {}) {
  const cached = path.join(CACHE, repo, revision, file)
  if (existsSync(cached)) return readFileSync(cached)
  const token = process.env.HF_TOKEN
  const headers = token ? { authorization: `Bearer ${token}` } : {}
  const url = `https://huggingface.co/datasets/${repo}/resolve/${revision}/${file}`
  const buf = await get(url, { as: 'buffer', headers, timeoutMs: 600_000 })
  mkdirSync(path.dirname(cached), { recursive: true })
  writeFileSync(cached, buf)
  return buf
}

/** The current commit of a dataset, so that a script can record the exact version it used. */
export async function hfRevision(repo) {
  const token = process.env.HF_TOKEN
  const headers = token ? { authorization: `Bearer ${token}` } : {}
  const info = await get(`https://huggingface.co/api/datasets/${repo}`, { as: 'json', headers })
  return info.sha
}
