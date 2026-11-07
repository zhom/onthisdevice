/**
 * Word data for the word tools, built once from Hugging Face datasets:
 *   acct huggingface node scripts/data/hf-words.mjs
 *
 *   src/data/words.json                          meta, sources, counts
 *   public/data/words/<hash>/words.txt           English words, most frequent first (Maximax67/English-Valid-Words, Unlicense)
 *   public/data/words/<hash>/cmudict.txt         word and ARPAbet pronunciation (acojaco/cmudict-espeak-ipa, BSD-2-Clause)
 *   public/data/words/<hash>/wordnet/<x>.json    senses, synonyms and antonyms by first letter
 *                                                (jon-tow/open-english-wordnet-synset-2023, CC-BY-4.0;
 *                                                 antonyms: Lots-of-LoRAs/task1508_wordnet_antonyms, Apache-2.0)
 *   public/data/words/<hash>/quotes.json         [quote, author, tags] (m-ric/english_historical_quotes, MIT;
 *                                                 Abirate/english_quotes, CC-BY-4.0)
 */
import { check, commit, get, meta, run } from './lib.mjs'
import { hfFile, hfRevision } from './hf-lib.mjs'

const SOURCES = {
  words: { repo: 'Maximax67/English-Valid-Words', file: 'valid_words_sorted_by_frequency.csv', licence: 'Unlicense' },
  cmudict: { repo: 'acojaco/cmudict-espeak-ipa', file: 'raw/cmudict_espeak_ipa.tsv', licence: 'BSD-2-Clause' },
  wordnet: { repo: 'jon-tow/open-english-wordnet-synset-2023', file: 'open_english_wordnet_2023.jsonl', licence: 'CC-BY-4.0' },
  antonyms: { repo: 'Lots-of-LoRAs/task1508_wordnet_antonyms', licence: 'Apache-2.0' },
  quotesA: { repo: 'm-ric/english_historical_quotes', file: 'english_historical_quotes.json', licence: 'MIT' },
  quotesB: { repo: 'Abirate/english_quotes', file: 'quotes.jsonl', licence: 'CC-BY-4.0' },
}

async function wordList() {
  const text = (await hfFile(SOURCES.words.repo, SOURCES.words.file)).toString('utf8')
  const out = []
  const seen = new Set()
  for (const line of text.split('\n').slice(1)) {
    const w = line.split(',')[1]?.trim().toLowerCase()
    if (!w || !/^[a-z]{2,15}$/.test(w) || seen.has(w)) continue
    seen.add(w)
    out.push(w)
  }
  check(out.length > 100_000, `words: only ${out.length}`)
  return out
}

async function cmudict() {
  const text = (await hfFile(SOURCES.cmudict.repo, SOURCES.cmudict.file)).toString('utf8')
  const rows = []
  const seen = new Set()
  for (const line of text.split('\n').slice(1)) {
    const f = line.split('\t')
    const word = f[0]?.toLowerCase()
    const phones = f[4]?.trim()
    if (!word || !phones || !/^[a-z][a-z'.-]*$/.test(word)) continue
    const key = `${word} ${phones}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(key)
  }
  check(rows.length > 100_000, `cmudict: only ${rows.length}`)
  return rows
}

/** Antonym pairs from the WordNet antonym task (rows API of the dataset viewer). */
async function antonymPairs() {
  const pairs = []
  const token = process.env.HF_TOKEN
  const headers = token ? { authorization: `Bearer ${token}` } : {}
  for (const split of ['train', 'valid', 'test']) {
    for (let offset = 0; ; offset += 100) {
      const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(SOURCES.antonyms.repo)}&config=default&split=${split}&offset=${offset}&length=100`
      const page = await get(url, { as: 'json', headers })
      for (const { row } of page.rows) {
        const m = /Now complete the following example -\s*Input:\s*(.+?)\s*Output:/s.exec(row.input)
        const out = Array.isArray(row.output) ? row.output[0] : row.output
        if (m && out) pairs.push([m[1].trim().toLowerCase(), String(out).trim().toLowerCase()])
      }
      if (page.rows.length < 100) break
    }
  }
  check(pairs.length > 2000, `antonyms: only ${pairs.length}`)
  return pairs
}

const lemmaOf = (member) =>
  member
    .replace(/^oewn-/, '')
    .replace(/-[nvars]$/, '')
    .replace(/-ap-/g, "'")
    .replace(/-sl-/g, '/')
    .replace(/-pl-/g, '+')
    .replace(/_/g, ' ')

const POS = { n: 'noun', v: 'verb', a: 'adjective', s: 'adjective', r: 'adverb' }
const arr = (x) => (x === undefined ? [] : Array.isArray(x) ? x : [x])

async function wordnet() {
  const text = (await hfFile(SOURCES.wordnet.repo, SOURCES.wordnet.file)).toString('utf8')
  const synsets = new Map()
  for (const line of text.split('\n')) {
    if (!line) continue
    const o = JSON.parse(line)
    synsets.set(o['@id'], {
      pos: POS[o['@partOfSpeech']] ?? o['@partOfSpeech'],
      def: arr(o.Definition).join('; '),
      ex: arr(o.Example).slice(0, 2),
      lemmas: o['@members'].split(' ').map(lemmaOf),
      similar: arr(o.SynsetRelation)
        .filter((r) => r['@relType'] === 'similar')
        .map((r) => r['@target']),
    })
  }
  // Direct antonyms, then indirect ones: an adjective similar to a head word takes the head word's antonyms.
  const direct = new Map()
  const addAnt = (a, b) => {
    if (a === b) return
    direct.set(a, new Set([...(direct.get(a) ?? []), b]))
  }
  for (const [a, b] of await antonymPairs()) {
    addAnt(a, b)
    addAnt(b, a)
  }
  const byLemma = new Map()
  for (const s of synsets.values()) {
    for (const lemma of s.lemmas) {
      const key = lemma.toLowerCase()
      const list = byLemma.get(key) ?? []
      list.push(s)
      byLemma.set(key, list)
    }
  }
  const indirect = (s) => {
    const out = new Set()
    for (const t of s.similar) for (const l of synsets.get(t)?.lemmas ?? []) for (const a of direct.get(l.toLowerCase()) ?? []) out.add(a)
    return out
  }
  const shards = new Map()
  for (const [key, senses] of byLemma) {
    const first = /^[a-z]/.test(key) ? key[0] : '0'
    const entry = {
      s: senses.slice(0, 24).map((s) => {
        const syn = [...new Set(s.lemmas.filter((l) => l.toLowerCase() !== key))]
        return [s.pos, s.def, s.ex, syn]
      }),
    }
    const ants = new Set([...(direct.get(key) ?? []), ...senses.flatMap((s) => [...indirect(s)])])
    if (ants.size) entry.a = [...ants].slice(0, 30)
    const shard = shards.get(first) ?? {}
    shard[key] = entry
    shards.set(first, shard)
  }
  check(byLemma.size > 100_000, `wordnet: only ${byLemma.size} lemmas`)
  return { shards, lemmas: byLemma.size, antonyms: direct.size }
}

async function quotes() {
  const a = JSON.parse((await hfFile(SOURCES.quotesA.repo, SOURCES.quotesA.file)).toString('utf8'))
  const b = (await hfFile(SOURCES.quotesB.repo, SOURCES.quotesB.file))
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
  const out = []
  const seen = new Set()
  const add = (quote, author, tags) => {
    const q = String(quote ?? '')
      .replace(/^[“"]|[”"]$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    const who = String(author ?? '').replace(/,$/, '').trim()
    const key = q.toLowerCase().replace(/[^a-z]/g, '').slice(0, 80)
    if (q.length < 8 || q.length > 600 || !who || seen.has(key)) return
    seen.add(key)
    out.push([q, who, tags.filter((t) => /^[a-z-]{2,24}$/.test(t)).slice(0, 6)])
  }
  for (const r of a) add(r.quote, r.author, String(r.category ?? '').match(/[a-z-]+/g) ?? [])
  for (const r of b) add(r.quote, r.author, (r.tags ?? []).map((t) => String(t).toLowerCase()))
  check(out.length > 5000, `quotes: only ${out.length}`)
  return out
}

async function main() {
  const [words, cmu, wn, qs] = [await wordList(), await cmudict(), await wordnet(), await quotes()]
  const files = new Map()
  files.set('words.txt', `${words.join('\n')}\n`)
  files.set('cmudict.txt', `${cmu.join('\n')}\n`)
  for (const [k, shard] of wn.shards) files.set(`wordnet/${k}.json`, JSON.stringify(shard))
  files.set('quotes.json', `[\n${qs.map((q) => JSON.stringify(q)).join(',\n')}\n]\n`)
  for (const [k, v] of files) check(Buffer.byteLength(v) < 24 * 1024 * 1024, `${k} is over 24 MiB`)
  const revisions = {}
  for (const [name, s] of Object.entries(SOURCES)) revisions[name] = await hfRevision(s.repo)
  const manifest = {
    meta: meta({
      source: { name: 'Hugging Face datasets (see sources)', url: 'https://huggingface.co/datasets' },
      sources: Object.values(SOURCES).map((s) => ({ name: `${s.repo} (${s.licence})`, url: `https://huggingface.co/datasets/${s.repo}` })),
      licence: { name: 'Unlicense, BSD-2-Clause, CC-BY-4.0, Apache-2.0 and MIT (per source)', url: '/licenses/data.txt' },
      validFor: 'static',
    }),
    revisions,
    counts: { words: words.length, pronunciations: cmu.length, lemmas: wn.lemmas, antonymWords: wn.antonyms, quotes: qs.length },
    shards: [...wn.shards.keys()].sort(),
  }
  commit('words', manifest, files)
}

run('hf-words', main)
