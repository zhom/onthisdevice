/**
 * English text to the phonemes the Kokoro voice model reads (the symbols of the misaki
 * lexicons): numbers and symbols become words, each word is looked up in the US or UK lexicon
 * (with -s, -ed, -ing, -ly and compounds built from known words), and an unknown word is
 * spelled by sound with simple letter rules. Pure functions, shared by the worker and tests.
 */

export type Lexicon = Map<string, string>

export function parseLexicon(tsv: string): Lexicon {
  const map: Lexicon = new Map()
  for (const line of tsv.split('\n')) {
    const tab = line.indexOf('\t')
    if (tab > 0) map.set(line.slice(0, tab), line.slice(tab + 1))
  }
  return map
}

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SCALES: [number, string][] = [
  [1e12, 'trillion'],
  [1e9, 'billion'],
  [1e6, 'million'],
  [1e3, 'thousand'],
]

function under1000(n: number): string {
  const parts: string[] = []
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`)
    n %= 100
    if (n) parts.push('and')
  }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''))
  else if (n > 0 || parts.length === 0) parts.push(ONES[n])
  return parts.join(' ')
}

/** 1234 -> "one thousand two hundred and thirty-four". Whole numbers below 10^15. */
export function numberWords(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (n < 0) return `minus ${numberWords(-n)}`
  n = Math.floor(n)
  if (n < 1000) return under1000(n)
  const parts: string[] = []
  for (const [size, name] of SCALES) {
    if (n >= size) {
      parts.push(`${under1000(Math.floor(n / size))} ${name}`)
      n %= size
    }
  }
  if (n) parts.push(n < 100 ? `and ${under1000(n)}` : under1000(n))
  return parts.join(' ')
}

/** 1990 -> "nineteen ninety", 2005 -> "two thousand and five", 2024 -> "twenty twenty-four". */
export function yearWords(y: number): string {
  if (y >= 2000 && y < 2010) return numberWords(y)
  const hi = Math.floor(y / 100)
  const lo = y % 100
  if (lo === 0) return `${under1000(hi)} hundred`
  return `${under1000(hi)} ${lo < 10 ? `oh ${ONES[lo]}` : under1000(lo)}`
}

const ORDINAL: Record<string, string> = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' }

export function ordinalWords(n: number): string {
  const words = numberWords(n)
  const m = /(\w+)$/.exec(words)
  if (!m) return words
  const last = m[1]
  const ord = ORDINAL[last] ?? (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`)
  return words.slice(0, -last.length) + ord
}

function digits(s: string): string {
  return [...s].map((d) => ONES[Number(d)]).join(' ')
}

const CURRENCY: Record<string, [string, string]> = { $: ['dollar', 'cent'], '£': ['pound', 'penny'], '€': ['euro', 'cent'] }

/** Words for numbers, money, percentages, times and common symbols and abbreviations. */
export function normalize(text: string): string {
  return (
    text
      .replace(/[‘’]/g, "'")
      .replace(/\b(Mr|Mrs|Ms|Dr|St|Prof|Jr|Sr|vs|etc|e\.g|i\.e)\./g, (_, a: string) =>
        ({ Mr: 'mister', Mrs: 'missus', Ms: 'miz', Dr: 'doctor', St: 'saint', Prof: 'professor', Jr: 'junior', Sr: 'senior', vs: 'versus', etc: 'et cetera', 'e.g': 'for example', 'i.e': 'that is' })[a] ?? a,
      )
      .replace(/([$£€])\s?(\d[\d,]*)(?:\.(\d{1,2}))?\b/g, (_, sym: string, whole: string, cents: string | undefined) => {
        const [unit, sub] = CURRENCY[sym]
        const n = Number(whole.replace(/,/g, ''))
        const c = cents ? Number(cents.padEnd(2, '0')) : 0
        let out = `${numberWords(n)} ${unit}${n === 1 ? '' : 's'}`
        if (c) out += ` and ${numberWords(c)} ${sub === 'penny' ? (c === 1 ? 'penny' : 'pence') : `${sub}${c === 1 ? '' : 's'}`}`
        return out
      })
      .replace(/\b(\d{1,2}):(\d{2})\s?([ap])\.?m\.?\b/gi, (_, h: string, m: string, ap: string) => `${numberWords(Number(h))} ${m === '00' ? '' : Number(m) < 10 ? `oh ${ONES[Number(m)]} ` : `${numberWords(Number(m))} `}${ap.toLowerCase() === 'a' ? 'A M' : 'P M'}`)
      .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h: string, m: string) => `${numberWords(Number(h))} ${m === '00' ? "o'clock" : Number(m) < 10 ? `oh ${ONES[Number(m)]}` : numberWords(Number(m))}`)
      .replace(/(\d+(?:\.\d+)?)\s?%/g, (_, n: string) => `${n} percent`)
      .replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, n: string) => ordinalWords(Number(n)))
      .replace(/\b(1[1-9]\d\d|20\d\d)s\b/g, (_, y: string) => `${yearWords(Number(y))}s`.replace(/ys$/, 'ies'))
      .replace(/\b(in|since|of|by|from|until|year|circa)\s(1[1-9]\d\d|20\d\d)\b/gi, (_, w: string, y: string) => `${w} ${yearWords(Number(y))}`)
      .replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+\.\d+\b|\b\d+\b/g, (m) => {
        const [whole, frac] = m.replace(/,/g, '').split('.')
        const w = whole.length > 15 ? digits(whole) : numberWords(Number(whole))
        return frac ? `${w} point ${digits(frac)}` : w
      })
      .replace(/&/g, ' and ')
      .replace(/\+/g, ' plus ')
      .replace(/=/g, ' equals ')
      .replace(/@/g, ' at ')
      .replace(/#(\w)/g, 'hashtag $1')
      .replace(/https?:\/\/\S+/g, 'a link')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/* ------------------------------------------------------------------ */
/* Words to phonemes                                                   */
/* ------------------------------------------------------------------ */

const LETTERS: Record<string, string> = {
  a: 'ˈA', b: 'bˈi', c: 'sˈi', d: 'dˈi', e: 'ˈi', f: 'ˈɛf', g: 'ʤˈi', h: 'ˈAʧ', i: 'ˈI', j: 'ʤˈA', k: 'kˈA', l: 'ˈɛl', m: 'ˈɛm',
  n: 'ˈɛn', o: 'ˈO', p: 'pˈi', q: 'kjˈu', r: 'ˈɑɹ', s: 'ˈɛs', t: 'tˈi', u: 'jˈu', v: 'vˈi', w: 'dˈʌbəlju', x: 'ˈɛks', y: 'wˈI', z: 'zˈi',
}

/** Grapheme rules, longest first: [letters, phonemes]. Plain American values. */
const RULES: [string, string][] = [
  ['tion', 'ʃən'], ['sion', 'ʒən'], ['ture', 'ʧəɹ'], ['ough', 'O'], ['augh', 'ɔ'], ['eigh', 'A'], ['igh', 'I'], ['tch', 'ʧ'], ['dge', 'ʤ'],
  ['sch', 'sk'], ['ck', 'k'], ['ch', 'ʧ'], ['sh', 'ʃ'], ['th', 'θ'], ['ph', 'f'], ['wh', 'w'], ['ng', 'ŋ'], ['qu', 'kw'], ['kn', 'n'], ['wr', 'ɹ'],
  ['gh', 'ɡ'], ['ee', 'i'], ['ea', 'i'], ['oo', 'u'], ['ou', 'W'], ['ow', 'O'], ['oa', 'O'], ['ai', 'A'], ['ay', 'A'], ['ey', 'A'], ['ei', 'A'],
  ['oi', 'Y'], ['oy', 'Y'], ['au', 'ɔ'], ['aw', 'ɔ'], ['ew', 'ju'], ['ie', 'i'], ['ue', 'u'], ['ar', 'ɑɹ'], ['er', 'əɹ'], ['ir', 'ɜɹ'], ['ur', 'ɜɹ'],
  ['or', 'ɔɹ'], ['ll', 'l'], ['ss', 's'], ['tt', 't'], ['pp', 'p'], ['nn', 'n'], ['mm', 'm'], ['ff', 'f'], ['rr', 'ɹ'], ['dd', 'd'], ['bb', 'b'], ['zz', 'z'],
  ['a', 'æ'], ['e', 'ɛ'], ['i', 'ɪ'], ['o', 'ɑ'], ['u', 'ʌ'], ['b', 'b'], ['d', 'd'], ['f', 'f'], ['h', 'h'], ['j', 'ʤ'], ['k', 'k'], ['l', 'l'],
  ['m', 'm'], ['n', 'n'], ['p', 'p'], ['r', 'ɹ'], ['s', 's'], ['t', 't'], ['v', 'v'], ['w', 'w'], ['x', 'ks'], ['z', 'z'],
]
const VOWEL_SOUND = /[æɛɪɑʌiuəɜɔAIOWYQ]/

/** Sounds a word out letter by letter, with the stress on the first vowel. */
export function spellBySound(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  let out = ''
  let i = 0
  while (i < w.length) {
    const ch = w[i]
    const next = w[i + 1] ?? ''
    if (ch === 'c') {
      out += 'eiy'.includes(next) ? 's' : 'k'
      i++
      continue
    }
    if (ch === 'g') {
      out += 'eiy'.includes(next) && i > 0 ? 'ʤ' : 'ɡ'
      i++
      continue
    }
    if (ch === 'y') {
      out += i === 0 ? 'j' : i === w.length - 1 ? 'i' : 'ɪ'
      i++
      continue
    }
    // A final silent e after a consonant.
    if (ch === 'e' && i === w.length - 1 && i > 1) {
      i++
      continue
    }
    const rule = RULES.find(([g]) => w.startsWith(g, i))
    if (rule) {
      out += rule[1]
      i += rule[0].length
    } else i++
  }
  const v = out.search(VOWEL_SOUND)
  return v >= 0 ? `${out.slice(0, v)}ˈ${out.slice(v)}` : out
}

function lookupExact(lex: Lexicon, w: string): string | undefined {
  return lex.get(w) ?? lex.get(w.toLowerCase()) ?? lex.get(w[0].toUpperCase() + w.slice(1).toLowerCase())
}

/** -s, -es, -'s, -ed, -ing, -ly, -er and -est of a known word. */
function withSuffix(lex: Lexicon, w: string): string | undefined {
  const lower = w.toLowerCase()
  const voiceless = /[ptkfθ]$/
  const sibilant = /[szʃʒʧʤ]$/
  const tries: [RegExp, (base: string) => string][] = [
    [/'s$/, (p) => p + (sibilant.test(p) ? 'ᵻz' : voiceless.test(p) ? 's' : 'z')],
    [/(?<=[sxz]|[cs]h)es$/, (p) => `${p}ᵻz`],
    [/s$/, (p) => p + (sibilant.test(p) ? 'ᵻz' : voiceless.test(p) ? 's' : 'z')],
    [/ed$/, (p) => p + (/[td]$/.test(p) ? 'ᵻd' : voiceless.test(p) || /[sʃʧ]$/.test(p) ? 't' : 'd')],
    [/d$/, (p) => p + (voiceless.test(p) ? 't' : 'd')],
    [/ing$/, (p) => `${p}ɪŋ`],
    [/ly$/, (p) => `${p}li`],
    [/er$/, (p) => `${p}əɹ`],
    [/est$/, (p) => `${p}ᵻst`],
  ]
  for (const [re, add] of tries) {
    if (!re.test(lower)) continue
    const stem = lower.replace(re, '')
    for (const base of [stem, `${stem}e`, stem.replace(/(.)\1$/, '$1'), stem.replace(/i$/, 'y')]) {
      const p = base.length > 1 ? lookupExact(lex, base) : undefined
      if (p) return add(p)
    }
  }
  return undefined
}

/** A compound of two known words, such as "keyboard" or "smartwatch". */
function compound(lex: Lexicon, w: string): string | undefined {
  const lower = w.toLowerCase()
  for (let i = lower.length - 3; i >= 3; i--) {
    const a = lex.get(lower.slice(0, i))
    const b = lex.get(lower.slice(i))
    if (a && b) return a + b.replace(/ˈ/g, 'ˌ')
  }
  return undefined
}

export function wordPhonemes(lex: Lexicon, word: string): string {
  const hit = lookupExact(lex, word) ?? withSuffix(lex, word)
  if (hit) return hit
  // Short words in capitals are read as letters: "NASA" is in the lexicon, "XYZ" is not.
  if (/^[A-Z]{2,5}$/.test(word)) return [...word.toLowerCase()].map((c) => LETTERS[c]).join('')
  if (word.includes('-')) return word.split('-').filter(Boolean).map((p) => wordPhonemes(lex, p)).join(' ')
  return compound(lex, word) ?? spellBySound(word)
}

const PUNCT = /^[;:,.!?—…"()“”]+$/

/** Text to one phoneme string, with the punctuation the model reads as pauses. */
export function phonemize(lex: Lexicon, text: string): string {
  const tokens = normalize(text).match(/[A-Za-zÀ-ÿ]+(?:['’-][A-Za-zÀ-ÿ]+)*|[;:,.!?—…"()“”]|-{2,}/g) ?? []
  let out = ''
  for (const t of tokens) {
    if (/^-{2,}$/.test(t)) {
      out += ' —'
      continue
    }
    if (PUNCT.test(t)) {
      out += t
      continue
    }
    out += (out && !/[("“]$/.test(out) ? ' ' : '') + wordPhonemes(lex, t)
  }
  return out.trim()
}

/** Sentences of `text`, grouped into chunks of at most `max` characters for the model. */
export function chunkText(text: string, max = 300): string[] {
  const sentences = text
    .replace(/\r/g, '')
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const chunks: string[] = []
  for (const s of sentences) {
    // A very long sentence is cut at commas, then at spaces.
    const parts = s.length <= max ? [s] : s.split(/(?<=[,;:])\s+/).flatMap((p) => (p.length <= max ? [p] : p.match(new RegExp(`.{1,${max}}(\\s|$)`, 'g')) ?? [p]))
    for (const p of parts) {
      const last = chunks[chunks.length - 1]
      if (last && last.length + p.length + 1 <= max) chunks[chunks.length - 1] = `${last} ${p}`
      else chunks.push(p.trim())
    }
  }
  return chunks
}
