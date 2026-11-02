/**
 * Unicode character names and emoji (Unicode Character Database, emoji-test.txt and CLDR
 * English annotations; Unicode License v3). Tier: monthly (a new Unicode version ships once a year).
 *
 *   src/data/unicode.json                        meta, version, blocks, algorithmic name ranges
 *   public/data/unicode/<hash>/names/<n>.json    { hex code point: [name, general category] } for code points n*4096..
 *   public/data/unicode/<hash>/emoji.json        [[emoji, name, group, subgroup, keywords, version], ...]
 */
import { check, commit, get, meta, readJson, run } from './lib.mjs'

const UCD = 'https://www.unicode.org/Public/UCD/latest/ucd'
const URL_EMOJI = 'https://www.unicode.org/Public/emoji/latest/emoji-test.txt'
const URL_CLDR = 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-annotations-full/annotations/en/annotations.json'
export const SHIFT = 12

/** UnicodeData.txt -> { names: Map(cp -> [name, gc]), ranges: [[first, last, label, gc]] } */
export function parseUnicodeData(text) {
  const names = new Map()
  const ranges = []
  let open = null
  for (const line of text.split('\n')) {
    if (!line) continue
    const f = line.split(';')
    const cp = parseInt(f[0], 16)
    let name = f[1]
    const gc = f[2]
    if (name.endsWith(', First>')) {
      open = { cp, label: name.slice(1, -8) }
      continue
    }
    if (name.endsWith(', Last>') && open) {
      ranges.push([open.cp, cp, open.label, gc])
      open = null
      continue
    }
    // Controls have "<control>" as name; field 10 holds the old ISO 6429 name.
    if (name === '<control>') name = f[10] ? `${f[10]} (control)` : 'control'
    names.set(cp, [name, gc])
  }
  return { names, ranges }
}

/** Blocks.txt -> [[first, last, name]] */
export function parseBlocks(text) {
  return text
    .split('\n')
    .map((l) => /^([0-9A-F]+)\.\.([0-9A-F]+);\s*(.+)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [parseInt(m[1], 16), parseInt(m[2], 16), m[3].trim()])
}

/** emoji-test.txt -> fully-qualified emoji without skin-tone or hair variants. */
export function parseEmojiTest(text) {
  const out = []
  let group = ''
  let subgroup = ''
  for (const line of text.split('\n')) {
    let m
    if ((m = /^# group: (.+)$/.exec(line))) group = m[1].trim()
    else if ((m = /^# subgroup: (.+)$/.exec(line))) subgroup = m[1].trim()
    else if ((m = /^([0-9A-F ]+?)\s*;\s*fully-qualified\s*#\s*(\S+)\s+E(\d+\.\d+)\s+(.+)$/.exec(line))) {
      const cps = m[1].trim().split(/\s+/).map((h) => parseInt(h, 16))
      if (cps.some((c) => c >= 0x1f3fb && c <= 0x1f3ff)) continue
      out.push({ emoji: String.fromCodePoint(...cps), name: m[4].trim(), group, subgroup, version: m[3] })
    }
  }
  return out
}

async function main() {
  const [dataText, blocksText, readme, emojiText] = await Promise.all([
    get(`${UCD}/UnicodeData.txt`, { timeoutMs: 240_000 }),
    get(`${UCD}/Blocks.txt`),
    get(`${UCD}/ReadMe.txt`),
    get(URL_EMOJI),
  ])
  const cldr = await get(URL_CLDR, { as: 'json', timeoutMs: 240_000 })
  const version = (/version (\d+\.\d+\.\d+)/i.exec(readme) ?? [])[1]
  check(version, 'unicode: no version in ReadMe.txt')
  const { names, ranges } = parseUnicodeData(dataText)
  const blocks = parseBlocks(blocksText)
  check(names.size > 30_000 && names.size < 120_000, `unicode: ${names.size} named code points`)
  check(names.get(0x41)?.[0] === 'LATIN CAPITAL LETTER A', 'unicode: U+0041 name')
  check(names.get(0x20ac)?.[0] === 'EURO SIGN', 'unicode: U+20AC name')
  check(ranges.some((r) => r[2].startsWith('CJK Ideograph')), 'unicode: no CJK range')
  check(blocks.length > 300, `unicode: ${blocks.length} blocks`)

  const annotations = cldr?.annotations?.annotations ?? {}
  const emoji = parseEmojiTest(emojiText)
  check(emoji.length > 1500 && emoji.length < 5000, `unicode: ${emoji.length} emoji`)
  check(emoji.some((e) => e.emoji === '😀' && e.name === 'grinning face'), 'unicode: grinning face missing')
  const rows = emoji.map((e) => {
    const a = annotations[e.emoji] ?? annotations[e.emoji.replace(/\uFE0F/g, '')]
    const keywords = (a?.default ?? []).filter((k) => k !== e.name)
    return [e.emoji, e.name, e.group, e.subgroup, keywords.join('|'), e.version]
  })
  const withKeywords = rows.filter((r) => r[4]).length
  check(withKeywords > rows.length * 0.6, `unicode: only ${withKeywords} emoji have keywords`)
  const prev = readJson('src/data/unicode.json')
  if (prev?.counts) check(names.size >= prev.counts.names * 0.98, `unicode: names ${prev.counts.names} -> ${names.size}`)

  const shards = new Map()
  for (const [cp, v] of [...names.entries()].sort((a, b) => a[0] - b[0])) {
    const k = cp >> SHIFT
    if (!shards.has(k)) shards.set(k, {})
    shards.get(k)[cp.toString(16).toUpperCase()] = v
  }
  const lazy = new Map([...shards.entries()].map(([k, v]) => [`names/${k}.json`, JSON.stringify(v)]))
  lazy.set('emoji.json', `[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]`)

  commit(
    'unicode',
    {
      meta: meta({
        source: { name: 'Unicode Character Database, Unicode emoji data and CLDR annotations', url: 'https://www.unicode.org/ucd/' },
        licence: { name: 'Unicode License v3', url: 'https://www.unicode.org/license.txt' },
        validFor: version,
      }),
      version,
      counts: { names: names.size, emoji: rows.length },
      shift: SHIFT,
      shards: [...shards.keys()],
      ranges,
      blocks,
    },
    lazy,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) run('unicode', main)
