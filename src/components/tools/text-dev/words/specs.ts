/** Word tools over the word data: dictionary, thesaurus, rhymes, syllables and word game solvers. */
import type { Result, Specs } from '../shell/spec'
import { bool, num, str } from '../shell/spec'
import {
  cmu,
  estimateSyllables,
  fits,
  letterCounts,
  lookup,
  parseYellows,
  patternRegex,
  quotes,
  ranks,
  rhymePart,
  scrabbleScore,
  syllablesOf,
  wordleMatch,
  words,
} from './lexicon'

const word1 = (input: string) => {
  const w = input.trim().split(/\r?\n/)[0].trim().toLowerCase()
  if (!w) throw new Error('Type a word.')
  return w
}

const letters = (input: string) => {
  const s = input.toLowerCase().replace(/[^a-z?*]/g, '')
  if (s.replace(/[?*]/g, '').length < 2) throw new Error('Type at least 2 letters.')
  if (s.length > 20) throw new Error('Type at most 20 letters.')
  return { have: letterCounts(s), blanks: (s.match(/[?*]/g) ?? []).length, length: s.length }
}

const MAX = 500

/** Groups words by length, longest first, for the table and the text. */
function byLength(found: string[], extra?: (w: string) => string | number): Result {
  const groups = new Map<number, string[]>()
  for (const w of found) groups.set(w.length, [...(groups.get(w.length) ?? []), w])
  const lengths = [...groups.keys()].sort((a, b) => b - a)
  return {
    stats: [{ label: 'Words found', value: found.length }, { label: 'Longest', value: lengths[0] ? `${lengths[0]} letters` : '–' }],
    table: { head: extra ? ['Word', 'Letters', 'Score'] : ['Letters', 'Words'], rows: extra ? found.slice(0, MAX).map((w) => [w, w.length, extra(w)]) : lengths.map((n) => [n, (groups.get(n) ?? []).slice(0, 60).join(', ')]) },
    text: lengths.map((n) => `${n} letters: ${(groups.get(n) ?? []).join(', ')}`).join('\n'),
    note: found.length === 0 ? 'No words found. Check the letters or add a blank with ?.' : undefined,
  }
}

export const WORD_SPECS: Specs = {
  dictionary: {
    input: { label: 'Word', sample: 'serendipity', rows: 1, placeholder: 'Type an English word' },
    output: { label: 'Definitions', filename: 'definitions.txt', mono: false },
    run: async (input) => {
      const w = word1(input)
      const hit = await lookup(w)
      if (!hit) return { verdict: { ok: false, title: `No entry for "${w}".`, detail: 'Check the spelling, or try the base form of the word: run instead of running.' } }
      const pron = (await cmu()).get(hit.lemma.replace(/ /g, ''))?.[0]
      return {
        rows: [
          ...(hit.lemma !== w ? [{ label: 'Base form', value: hit.lemma }] : []),
          ...(pron ? [{ label: 'Pronunciation (ARPAbet)', value: pron }, { label: 'Syllables', value: String(syllablesOf(pron)) }] : []),
        ],
        table: { head: ['#', 'Part of speech', 'Meaning', 'Example'], rows: hit.entry.s.map((s, i) => [i + 1, s[0], s[1], s[2][0] ?? '']) },
        text: `${hit.lemma}\n\n${hit.entry.s.map((s, i) => `${i + 1}. (${s[0]}) ${s[1]}${s[2][0] ? `\n   "${s[2][0]}"` : ''}${s[3].length ? `\n   Synonyms: ${s[3].join(', ')}` : ''}`).join('\n')}`,
      }
    },
  },
  thesaurus: {
    input: { label: 'Word', sample: 'happy', rows: 1 },
    output: { label: 'Synonyms and antonyms', filename: 'thesaurus.txt', mono: false },
    run: async (input) => {
      const w = word1(input)
      const hit = await lookup(w)
      if (!hit) return { verdict: { ok: false, title: `No entry for "${w}".`, detail: 'Check the spelling, or try the base form of the word.' } }
      const senses = hit.entry.s.filter((s) => s[3].length > 0)
      const all = [...new Set(senses.flatMap((s) => s[3]))]
      const ants = hit.entry.a ?? []
      return {
        stats: [{ label: 'Synonyms', value: all.length }, { label: 'Antonyms', value: ants.length }, { label: 'Meanings', value: hit.entry.s.length }],
        rows: ants.length ? [{ label: 'Antonyms (opposites)', value: ants.join(', ') }] : undefined,
        table: { head: ['Meaning', 'Synonyms'], rows: senses.map((s) => [`(${s[0]}) ${s[1]}`, s[3].join(', ')]) },
        text: `Synonyms of ${hit.lemma}: ${all.join(', ') || 'none'}\nAntonyms: ${ants.join(', ') || 'none'}`,
        note: senses.length === 0 ? 'WordNet lists no synonyms for this word; its meanings are shown in the dictionary.' : undefined,
      }
    },
  },
  'antonym-finder': {
    input: { label: 'Word', sample: 'brave', rows: 1 },
    output: { label: 'Antonyms', filename: 'antonyms.txt' },
    run: async (input) => {
      const w = word1(input)
      const hit = await lookup(w)
      const ants = hit?.entry.a ?? []
      if (ants.length === 0) return { verdict: { ok: false, title: `No antonyms found for "${w}".`, detail: 'Antonyms are recorded mainly for adjectives. Try the thesaurus for related words.' } }
      return { stats: [{ label: 'Antonyms', value: ants.length }], text: ants.join('\n'), note: 'The first ones are direct opposites; later ones are opposites of words with a similar meaning.' }
    },
  },
  'rhyme-finder': {
    input: { label: 'Word', sample: 'light', rows: 1 },
    output: { label: 'Rhymes', filename: 'rhymes.txt' },
    fields: [{ kind: 'toggle', id: 'common', label: 'Common words only', default: true, hint: 'Hides rare words and names.' }],
    run: async (input, v) => {
      const w = word1(input)
      const dict = await cmu()
      const prons = dict.get(w)
      if (!prons) throw new Error(`"${w}" is not in the pronouncing dictionary. Try another spelling.`)
      const targets = new Set(prons.map(rhymePart))
      const rank = await ranks()
      const limit = bool(v, 'common') ? 60_000 : Infinity
      const found = new Map<string, number>()
      for (const [x, ps] of dict) {
        if (x === w || x.includes("'") || x.includes('.')) continue
        if ((rank.get(x) ?? Infinity) > limit) continue
        const p = ps.find((q) => targets.has(rhymePart(q)))
        if (p) found.set(x, syllablesOf(p))
      }
      const bySyl = new Map<number, string[]>()
      for (const [x, n] of [...found].sort((a, b) => (rank.get(a[0]) ?? 1e9) - (rank.get(b[0]) ?? 1e9))) bySyl.set(n, [...(bySyl.get(n) ?? []), x])
      const keys = [...bySyl.keys()].sort((a, b) => a - b)
      return {
        stats: [{ label: 'Rhymes', value: found.size }, { label: 'Rhyme sound', value: [...targets].join(' / ') }],
        table: { head: ['Syllables', 'Words'], rows: keys.map((k) => [k, (bySyl.get(k) ?? []).slice(0, 80).join(', ')]) },
        text: keys.map((k) => `${k} syllable${k === 1 ? '' : 's'}: ${(bySyl.get(k) ?? []).join(', ')}`).join('\n'),
        note: found.size === 0 ? `Nothing rhymes perfectly with "${w}" in the dictionary. Turn off Common words only to see rare words.` : undefined,
      }
    },
  },
  'syllable-counter': {
    input: { label: 'Words or text', sample: 'An old silent pond\nA frog jumps into the pond\nSplash! Silence again.', rows: 5 },
    output: { label: 'Words with syllables', filename: 'syllables.txt' },
    run: async (input) => {
      const dict = await cmu()
      const lines = input.split(/\r?\n/).filter((l) => l.trim())
      let total = 0
      let guessed = 0
      const rows: (string | number)[][] = []
      const lineCounts: string[] = []
      for (const line of lines) {
        let n = 0
        for (const raw of line.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []) {
          const w = raw.toLowerCase().replace(/’/g, "'")
          const p = dict.get(w)?.[0]
          const s = p ? syllablesOf(p) : w.split('-').reduce((a, part) => a + estimateSyllables(part), 0)
          if (!p) guessed++
          n += s
          if (rows.length < MAX) rows.push([raw, s, p ? p.replace(/\d/g, '') : 'estimated'])
        }
        total += n
        lineCounts.push(`${n}\t${line}`)
      }
      if (rows.length === 0) throw new Error('Type at least one word.')
      return {
        stats: [{ label: 'Syllables', value: total }, { label: 'Words', value: rows.length }, { label: 'Lines', value: lines.length }, { label: 'Estimated words', value: guessed }],
        table: { head: ['Word', 'Syllables', 'Sounds'], rows },
        text: lineCounts.join('\n'),
      }
    },
  },
  'word-unscrambler': {
    input: { label: 'Letters', sample: 'tpslea', rows: 1, hint: 'Use ? for a blank tile that can be any letter.' },
    output: { label: 'Words', filename: 'words.txt' },
    fields: [{ kind: 'number', id: 'min', label: 'Shortest word', default: 3, min: 2, max: 15 }, { kind: 'toggle', id: 'common', label: 'Common words only', default: true }],
    run: async (input, v) => {
      const { have, blanks } = letters(input)
      const list = await words()
      const limit = bool(v, 'common') ? 40_000 : list.length
      const found = list.slice(0, limit).filter((w) => w.length >= num(v, 'min') && fits(w, have, blanks))
      return byLength(found)
    },
  },
  'anagram-solver': {
    input: { label: 'Word or letters', sample: 'listen', rows: 1 },
    output: { label: 'Anagrams', filename: 'anagrams.txt' },
    run: async (input) => {
      const { have, blanks, length } = letters(input)
      const self = input.trim().toLowerCase()
      const found = (await words()).filter((w) => w.length === length && w !== self && fits(w, have, blanks))
      return {
        stats: [{ label: 'Anagrams', value: found.length }],
        text: found.join('\n'),
        note: found.length === 0 ? 'No single-word anagram uses exactly these letters. The word unscrambler finds shorter words too.' : undefined,
      }
    },
  },
  'scrabble-word-finder': {
    input: { label: 'Your tiles', sample: 'qiztera', rows: 1, hint: 'Up to 7 tiles; ? for a blank.' },
    output: { label: 'Words by score', filename: 'scrabble-words.txt' },
    fields: [
      { kind: 'text', id: 'contains', label: 'Must contain (letters on the board)', default: '', mono: true },
      { kind: 'number', id: 'min', label: 'Shortest word', default: 2, min: 2, max: 15 },
    ],
    run: async (input, v) => {
      const extra = str(v, 'contains').toLowerCase().replace(/[^a-z]/g, '')
      const { have, blanks } = letters(input + extra)
      const list = await words()
      const found = list
        .slice(0, 80_000)
        .filter((w) => w.length >= num(v, 'min') && (!extra || w.includes(extra)) && fits(w, have, blanks))
        .map((w) => ({ w, s: scrabbleScore(w, have) + (w.length - extra.length >= 7 ? 50 : 0) }))
        .sort((a, b) => b.s - a.s || a.w.localeCompare(b.w))
      return {
        stats: [{ label: 'Words', value: found.length }, { label: 'Best', value: found[0] ? `${found[0].w} (${found[0].s})` : '–' }],
        table: { head: ['Word', 'Letters', 'Points'], rows: found.slice(0, MAX).map((x) => [x.w, x.w.length, x.s]) },
        text: found.map((x) => `${x.w}\t${x.s}`).join('\n'),
        note: 'Points are tile values without board bonuses; using all 7 tiles adds 50. The list is a general English word list, so check a disputed word in an official word list.',
      }
    },
  },
  'wordle-solver': {
    input: { label: 'Known letters in place (green)', sample: 'cr___', rows: 1, hint: 'Five characters: a letter where you know it, _ where you do not.' },
    output: { label: 'Possible words', filename: 'wordle-words.txt' },
    fields: [
      { kind: 'text', id: 'yellow', label: 'Letters in the word, wrong place (yellow)', default: 'a4', mono: true, hint: 'Add the positions where they were yellow: a4 e2 means a is not 4th, e is not 2nd.' },
      { kind: 'text', id: 'gray', label: 'Letters not in the word (gray)', default: 'nets', mono: true },
    ],
    run: async (input, v) => {
      const g = input.trim().toLowerCase().replace(/\s+/g, '')
      if (g.length !== 5 || !/^[a-z_.?*]{5}$/.test(g)) throw new Error('The green pattern needs exactly 5 characters: letters and _ for unknown squares.')
      const clues = { greens: [...g].map((c) => (/[a-z]/.test(c) ? c : null)), yellows: parseYellows(str(v, 'yellow')), grays: new Set(str(v, 'gray').toLowerCase().replace(/[^a-z]/g, '')) }
      const found = (await words()).slice(0, 60_000).filter((w) => wordleMatch(w, clues))
      // Best next guess: the candidate whose letters cover the most other candidates.
      const freq = new Map<string, number>()
      for (const w of found) for (const c of new Set(w)) freq.set(c, (freq.get(c) ?? 0) + 1)
      const scored = found.map((w) => ({ w, s: [...new Set(w)].reduce((a, c) => a + (freq.get(c) ?? 0), 0) }))
      const best = [...scored].sort((a, b) => b.s - a.s)[0]
      return {
        stats: [{ label: 'Possible words', value: found.length }, { label: 'Suggested guess', value: best?.w ?? '–' }],
        table: { head: ['Word', 'Letter coverage'], rows: scored.slice(0, MAX).map((x) => [x.w, x.s]) },
        text: found.join('\n'),
        note: found.length === 0 ? 'No word fits all the clues. Check that a letter is not both gray and green.' : 'Words are listed from most to least common. The answer is usually a common word.',
      }
    },
  },
  'crossword-solver': {
    input: { label: 'Pattern', sample: 'c?o?s?o?d', rows: 1, hint: 'Letters you know, and ? for each empty square.' },
    output: { label: 'Matching words', filename: 'crossword.txt' },
    fields: [{ kind: 'text', id: 'clue', label: 'Clue words (optional)', default: '', hint: 'Words from the clue raise matches whose dictionary meaning uses them.' }],
    run: async (input, v) => {
      const re = patternRegex(input.trim())
      const found = (await words()).filter((w) => re.test(w)).slice(0, 2000)
      const clue = str(v, 'clue').toLowerCase().match(/[a-z]{3,}/g) ?? []
      let ranked = found
      if (clue.length && found.length <= 400) {
        const scores = new Map<string, number>()
        await Promise.all(
          found.slice(0, 400).map(async (w) => {
            const hit = await lookup(w)
            const text = hit ? hit.entry.s.map((s) => `${s[1]} ${s[3].join(' ')}`).join(' ').toLowerCase() : ''
            scores.set(w, clue.filter((c) => text.includes(c)).length)
          }),
        )
        ranked = [...found].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0))
      }
      return {
        stats: [{ label: 'Matches', value: found.length }, { label: 'Length', value: `${input.trim().length} letters` }],
        text: ranked.join('\n'),
        note: found.length === 0 ? 'No word fits this pattern. Check the number of squares.' : 'Common words come first.',
      }
    },
  },
  'random-word-generator': {
    output: { label: 'Words', filename: 'random-words.txt' },
    action: 'Generate',
    fields: [
      { kind: 'number', id: 'count', label: 'How many', default: 10, min: 1, max: 500 },
      { kind: 'number', id: 'min', label: 'Shortest', default: 3, min: 2, max: 15 },
      { kind: 'number', id: 'max', label: 'Longest', default: 9, min: 2, max: 15 },
      {
        kind: 'choice',
        id: 'pool',
        label: 'Words',
        default: '5000',
        choices: [
          { value: '5000', label: 'Common' },
          { value: '30000', label: 'Wider' },
          { value: 'all', label: 'All' },
        ],
      },
    ],
    run: async (_i, v) => {
      const lo = Math.min(num(v, 'min'), num(v, 'max'))
      const hi = Math.max(num(v, 'min'), num(v, 'max'))
      const list = await words()
      const pool = (str(v, 'pool') === 'all' ? list : list.slice(0, Number(str(v, 'pool')))).filter((w) => w.length >= lo && w.length <= hi)
      if (pool.length === 0) throw new Error('No words have that length.')
      const buf = new Uint32Array(num(v, 'count'))
      crypto.getRandomValues(buf)
      return Array.from(buf, (x) => pool[x % pool.length]).join('\n')
    },
  },
  'quote-finder': {
    input: { label: 'Word, phrase or author', sample: 'courage', rows: 1 },
    output: { label: 'Quotes', filename: 'quotes.txt', mono: false },
    fields: [
      {
        kind: 'choice',
        id: 'in',
        label: 'Search in',
        default: 'all',
        choices: [
          { value: 'all', label: 'Everything' },
          { value: 'text', label: 'Quote text' },
          { value: 'author', label: 'Author' },
          { value: 'tag', label: 'Topic' },
        ],
      },
    ],
    run: async (input, v) => {
      const q = input.trim().toLowerCase()
      if (q.length < 2) throw new Error('Type at least 2 letters.')
      const where = str(v, 'in')
      const all = await quotes()
      const hits = all.filter(([t, a, tags]) => (where !== 'author' && where !== 'tag' && t.toLowerCase().includes(q)) || (where !== 'text' && where !== 'tag' && a.toLowerCase().includes(q)) || (where !== 'text' && where !== 'author' && tags.includes(q)))
      return {
        stats: [{ label: 'Quotes found', value: hits.length }, { label: 'Authors', value: new Set(hits.map((h) => h[1])).size }],
        table: { head: ['Quote', 'Author'], rows: hits.slice(0, 200).map(([t, a]) => [t, a]) },
        text: hits.map(([t, a]) => `"${t}"\n- ${a}`).join('\n\n'),
        note: hits.length === 0 ? 'No quotes found. Try a shorter word or another spelling.' : 'Attributions come from the source collections and are not checked; famous quotes are often misattributed.',
      }
    },
  },
}
