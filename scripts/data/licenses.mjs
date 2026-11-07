/**
 * Open source licence texts for the license generator (SPDX License List data; each text is
 * published by its steward for verbatim copying). Run once; the texts do not change.
 *
 *   src/data/licenses.json                   meta and the list of licences
 *   public/data/licenses/<hash>/<id>.txt     the full text of each licence
 */
import { check, commit, get, meta, run } from './lib.mjs'

const BASE = 'https://raw.githubusercontent.com/spdx/license-list-data/main/text'

export const LICENSES = [
  ['MIT', 'MIT License', 'Permissive'],
  ['Apache-2.0', 'Apache License 2.0', 'Permissive, with a patent grant'],
  ['BSD-3-Clause', 'BSD 3-Clause "New" License', 'Permissive'],
  ['BSD-2-Clause', 'BSD 2-Clause "Simplified" License', 'Permissive'],
  ['ISC', 'ISC License', 'Permissive'],
  ['0BSD', 'BSD Zero Clause License', 'Public domain equivalent'],
  ['Unlicense', 'The Unlicense', 'Public domain dedication'],
  ['CC0-1.0', 'Creative Commons Zero v1.0 Universal', 'Public domain dedication'],
  ['BSL-1.0', 'Boost Software License 1.0', 'Permissive'],
  ['MPL-2.0', 'Mozilla Public License 2.0', 'Weak copyleft, per file'],
  ['LGPL-3.0-only', 'GNU Lesser General Public License v3.0', 'Weak copyleft, for libraries'],
  ['GPL-3.0-only', 'GNU General Public License v3.0', 'Strong copyleft'],
  ['AGPL-3.0-only', 'GNU Affero General Public License v3.0', 'Strong copyleft, network use'],
]

async function main() {
  const files = new Map()
  for (const [id] of LICENSES) {
    const text = (await get(`${BASE}/${id}.txt`)).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim()
    check(text.length > 300, `${id}: text too short (${text.length})`)
    files.set(`${id}.txt`, `${text}\n`)
  }
  const manifest = {
    meta: meta({
      source: { name: 'SPDX License List data', url: 'https://github.com/spdx/license-list-data' },
      licence: { name: 'Licence texts may be copied verbatim; SPDX data under CC-BY-3.0', url: 'https://spdx.org/licenses/' },
      validFor: 'current',
    }),
    licenses: LICENSES.map(([id, name, kind]) => ({ id, name, kind })),
  }
  commit('licenses', manifest, files)
}

run('licenses', main)
