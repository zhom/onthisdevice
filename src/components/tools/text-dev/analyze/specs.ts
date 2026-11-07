/** Text analysis tools: frequency, counters, readability, reading time, palindromes. */
import { countWords, formatDuration, splitSentences } from '@/components/tools/text/text-core'
import type { Specs } from '../shell/spec'
import { bool, num, str } from '../shell/spec'
import { splitLines } from '../text/lines'
import { easeBand, isPalindrome, letterFrequency, longestPalindrome, paragraphs, readability, wordFrequency } from './measure'

const PROSE = `Reading is to the mind what exercise is to the body. A short sentence is easy to read. Long sentences that pile clause upon clause, with several ideas joined by commas and conjunctions, ask the reader to hold everything in memory at once.

Plain words help too. Use "use" rather than "utilize". Readers finish documents that respect their time.`

const pct = (n: number) => `${n.toFixed(n < 10 ? 2 : 1)}%`
const round = (n: number, d = 1) => (Number.isFinite(n) ? Number(n.toFixed(d)) : 0)
const csv = (rows: (string | number)[][]) => rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(',')).join('\n')

export const ANALYZE_SPECS: Specs = {
  'word-frequency-counter': {
    input: { label: 'Text', sample: PROSE },
    output: { label: 'Frequency table (CSV)', filename: 'word-frequency.csv' },
    fields: [
      {
        kind: 'choice',
        id: 'phrase',
        label: 'Count',
        default: '1',
        choices: [
          { value: '1', label: 'Words' },
          { value: '2', label: '2-word phrases' },
          { value: '3', label: '3-word phrases' },
        ],
      },
      { kind: 'number', id: 'minLength', label: 'Shortest word to count', default: 1, min: 1, max: 30 },
      { kind: 'toggle', id: 'stopWords', label: 'Include common words (the, and, of)', default: false },
      { kind: 'toggle', id: 'caseSensitive', label: 'Case sensitive', default: false },
    ],
    run: (input, v) => {
      const { items, total } = wordFrequency(input, {
        phrase: Number(str(v, 'phrase')),
        stopWords: bool(v, 'stopWords'),
        minLength: num(v, 'minLength'),
        caseSensitive: bool(v, 'caseSensitive'),
      })
      const rows = items.map((c, i) => [i + 1, c.term, c.count, pct(c.share)])
      return {
        stats: [
          { label: 'Counted', value: total },
          { label: 'Different', value: items.length },
          { label: 'Most frequent', value: items[0]?.term ?? '–' },
        ],
        bars: { items: items.slice(0, 10).map((c) => ({ label: c.term, value: c.count })), summary: items[0] ? `"${items[0].term}" appears ${items[0].count} times.` : 'No words counted.' },
        table: { head: ['Rank', 'Term', 'Count', 'Share'], rows },
        text: csv([['rank', 'term', 'count', 'share'], ...items.map((c, i) => [i + 1, c.term, c.count, round(c.share, 3)])]),
      }
    },
  },
  'character-frequency-counter': {
    input: { label: 'Text', sample: 'Wkh vhfuhw phhwlqj lv dw qrrq lq wkh sdun. Hyhubrqh vkrxog eulqj d pds.' },
    output: { label: 'Frequency table (CSV)', filename: 'character-frequency.csv' },
    fields: [
      { kind: 'toggle', id: 'lettersOnly', label: 'Letters only', default: true },
      { kind: 'toggle', id: 'caseSensitive', label: 'Case sensitive', default: false },
      { kind: 'toggle', id: 'spaces', label: 'Count spaces', default: false },
    ],
    run: (input, v) => {
      const { items, total } = letterFrequency(input, { lettersOnly: bool(v, 'lettersOnly'), caseSensitive: bool(v, 'caseSensitive'), spaces: bool(v, 'spaces') })
      const shown = (c: string) => (c === ' ' ? 'space' : c)
      return {
        stats: [
          { label: 'Characters counted', value: total },
          { label: 'Different', value: items.length },
          { label: 'Most frequent', value: items[0] ? shown(items[0].term) : '–' },
        ],
        bars: { items: items.slice(0, 26).map((c) => ({ label: shown(c.term), value: c.count })), summary: items[0] ? `${shown(items[0].term)} is the most frequent character: ${pct(items[0].share)}.` : 'No characters counted.' },
        table: { head: ['Character', 'Code point', 'Count', 'Share'], rows: items.map((c) => [shown(c.term), `U+${c.term.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`, c.count, pct(c.share)]) },
        text: csv([['character', 'count', 'share'], ...items.map((c) => [c.term, c.count, round(c.share, 3)])]),
      }
    },
  },
  'sentence-counter': {
    input: { label: 'Text', sample: PROSE },
    output: { label: 'Sentences, one per line', filename: 'sentences.txt', mono: false },
    run: (input) => {
      const sentences = splitSentences(input)
      const lengths = sentences.map((s) => countWords(s))
      const total = lengths.reduce((a, b) => a + b, 0)
      return {
        stats: [
          { label: 'Sentences', value: sentences.length },
          { label: 'Words', value: total },
          { label: 'Average words per sentence', value: sentences.length ? round(total / sentences.length) : 0 },
          { label: 'Longest sentence', value: `${Math.max(0, ...lengths)} words` },
        ],
        table: { head: ['#', 'Words', 'Sentence'], rows: sentences.map((s, i) => [i + 1, lengths[i], s.length > 140 ? `${s.slice(0, 140)}…` : s]) },
        text: sentences.join('\n'),
      }
    },
  },
  'line-counter': {
    input: { label: 'Text', sample: 'first line\nsecond line\n\nfourth line after a blank\nsecond line', mono: true },
    output: { label: 'Report', filename: 'line-count.txt' },
    run: (input) => {
      const lines = splitLines(input)
      const nonEmpty = lines.filter((l) => l.trim() !== '')
      const unique = new Set(nonEmpty).size
      const longest = lines.reduce((m, l, i) => ([...l].length > m.len ? { len: [...l].length, at: i + 1 } : m), { len: 0, at: 0 })
      const stats = [
        { label: 'Lines', value: lines.length },
        { label: 'Non-empty lines', value: nonEmpty.length },
        { label: 'Empty lines', value: lines.length - nonEmpty.length },
        { label: 'Duplicate lines', value: nonEmpty.length - unique },
      ]
      return {
        stats,
        rows: [
          { label: 'Longest line', value: `${longest.len} characters (line ${longest.at})` },
          { label: 'Average line length', value: `${round(nonEmpty.reduce((a, l) => a + [...l].length, 0) / Math.max(1, nonEmpty.length))} characters` },
          { label: 'Line endings', value: /\r\n/.test(input) ? 'CRLF (Windows)' : /\r/.test(input) ? 'CR (classic Mac)' : 'LF (Unix)' },
        ],
        text: stats.map((s) => `${s.label}: ${s.value}`).join('\n'),
      }
    },
  },
  'paragraph-counter': {
    input: { label: 'Text', sample: PROSE },
    output: { label: 'Report', filename: 'paragraphs.txt' },
    run: (input) => {
      const paras = paragraphs(input)
      const rows = paras.map((p, i) => [i + 1, splitSentences(p).length, countWords(p), p.length > 100 ? `${p.slice(0, 100)}…` : p] as const)
      const words = rows.reduce((a, r) => a + r[2], 0)
      const stats = [
        { label: 'Paragraphs', value: paras.length },
        { label: 'Words', value: words },
        { label: 'Average words per paragraph', value: paras.length ? round(words / paras.length) : 0 },
        { label: 'Average sentences per paragraph', value: paras.length ? round(rows.reduce((a, r) => a + r[1], 0) / paras.length) : 0 },
      ]
      return {
        stats,
        table: { head: ['#', 'Sentences', 'Words', 'Starts with'], rows: rows.map((r) => [...r]) },
        text: stats.map((s) => `${s.label}: ${s.value}`).join('\n'),
      }
    },
  },
  'readability-checker': {
    input: { label: 'Text to score', sample: PROSE, rows: 10 },
    output: { label: 'Report', filename: 'readability.txt' },
    run: (input) => {
      const r = readability(input)
      if (r.words < 3) throw new Error('Add at least one full sentence to score.')
      const indices: [string, number, string][] = [
        ['Flesch Reading Ease', r.readingEase, easeBand(r.readingEase)],
        ['Flesch-Kincaid Grade Level', r.fkGrade, 'US school grade'],
        ['Gunning Fog Index', r.fog, 'Years of schooling'],
        ['SMOG Index', r.smog, 'Years of schooling'],
        ['Coleman-Liau Index', r.colemanLiau, 'US school grade'],
        ['Automated Readability Index', r.ari, 'US school grade'],
      ]
      const grades = [r.fkGrade, r.fog, r.smog, r.colemanLiau, r.ari]
      const avg = grades.reduce((a, b) => a + b, 0) / grades.length
      return {
        stats: [
          { label: 'Reading ease', value: round(r.readingEase), hint: easeBand(r.readingEase) },
          { label: 'Average grade level', value: round(avg) },
          { label: 'Words per sentence', value: round(r.words / Math.max(1, r.sentences)) },
          { label: 'Syllables per word', value: round(r.syllables / r.words, 2) },
        ],
        table: { head: ['Index', 'Score', 'Meaning'], rows: indices.map(([n, s, m]) => [n, round(s), m]) },
        rows: r.longest.slice(0, 3).map((l, i) => ({ label: `Long sentence ${i + 1} (${l.words} words)`, value: l.sentence })),
        text: [
          ...indices.map(([n, s, m]) => `${n}: ${round(s)} (${m})`),
          `Words: ${r.words}, sentences: ${r.sentences}, syllables: ${r.syllables}, words of 3+ syllables: ${r.complex}`,
        ].join('\n'),
      }
    },
  },
  'reading-time-calculator': {
    input: { label: 'Text', sample: PROSE },
    output: { label: 'Report', filename: 'reading-time.txt' },
    fields: [
      { kind: 'number', id: 'wpm', label: 'Reading speed (words per minute)', default: 238, min: 50, max: 1500 },
      { kind: 'number', id: 'speak', label: 'Speaking speed (words per minute)', default: 140, min: 50, max: 400 },
    ],
    run: (input, v) => {
      const n = countWords(input)
      const wpm = num(v, 'wpm')
      const speak = num(v, 'speak')
      const time = (speed: number) => formatDuration(Math.round((n / speed) * 60))
      const speeds: [string, number][] = [
        ['Skimming', 450],
        ['Fast reader', 350],
        ['Average adult, silent', 238],
        ['Careful reading, technical text', 150],
        ['Reading aloud', 183],
        ['Presentation or voice-over', 140],
      ]
      return {
        stats: [
          { label: 'Reading time', value: time(wpm) },
          { label: 'Speaking time', value: time(speak) },
          { label: 'Words', value: n },
        ],
        table: { head: ['Pace', 'Words per minute', 'Time'], rows: speeds.map(([p, s]) => [p, s, time(s)]) },
        text: `Words: ${n}\nReading time at ${wpm} wpm: ${time(wpm)}\nSpeaking time at ${speak} wpm: ${time(speak)}`,
      }
    },
  },
  'palindrome-checker': {
    input: { label: 'Words or phrases, one per line', sample: 'A man, a plan, a canal: Panama\nracecar\nWas it a car or a cat I saw?\nhello\nÉsope reste ici et se repose' },
    output: { label: 'Results', filename: 'palindromes.txt' },
    fields: [{ kind: 'toggle', id: 'strict', label: 'Exact characters only', default: false, hint: 'Off ignores case, spaces, punctuation and accents, as palindromes usually do.' }],
    run: (input, v) => {
      const strict = bool(v, 'strict')
      const lines = splitLines(input).filter((l) => l.trim() !== '')
      const results = lines.map((l) => ({ line: l, ok: isPalindrome(l, strict) }))
      const yes = results.filter((r) => r.ok).length
      const first = results[0]
      const longest = longestPalindrome(input)
      return {
        verdict:
          results.length === 1
            ? { ok: first.ok, title: first.ok ? 'This is a palindrome.' : 'This is not a palindrome.', detail: first.ok ? 'It reads the same backwards.' : `Backwards it reads: ${[...first.line].reverse().join('')}` }
            : { ok: yes > 0, title: `${yes} of ${results.length} lines are palindromes.` },
        table: results.length > 1 ? { head: ['Line', 'Palindrome'], rows: results.map((r) => [r.line, r.ok ? 'Yes' : 'No']) } : undefined,
        rows: longest.length > 2 ? [{ label: 'Longest palindrome inside', value: longest }] : undefined,
        text: results.map((r) => `${r.ok ? 'yes' : 'no'}\t${r.line}`).join('\n'),
      }
    },
  },
}
