/**
 * A compact, self-contained password strength estimator.
 *
 * The naive `log2(poolSize ^ length)` number that most "password meters" show
 * is wrong for anything a human invented: `P@ssw0rd1` scores 59 bits by that
 * formula and falls in well under a second in practice. So this module does
 * what a real cracker does — look for structure — and prices each piece of
 * structure separately:
 *
 *   1. Find every match: breached-password entries, dictionary words (also
 *      reversed and leetspeak-mangled), keyboard runs, character sequences,
 *      repeats and dates.
 *   2. Price each match in guesses, including the extra work a cracker spends
 *      on capitalisation and leet variants of a base word.
 *   3. Cover the password with the cheapest possible set of matches using
 *      dynamic programming; anything left over is priced as brute force.
 *   4. Add the cost of trying the different ways of splitting the password up.
 *
 * The result is a guess count, not a certainty. It is deliberately optimistic
 * about the attacker (it assumes they own the same dictionaries) so the number
 * errs on the side of telling you a password is weaker than you hoped.
 */

import { bandForBits, type StrengthBand } from './seclib'
import {
  COMMON_PASSWORDS,
  EXTRA_DICTIONARY_WORDS,
  KEYBOARD_ROWS,
  LEET_SUBSTITUTIONS,
  PASSPHRASE_WORDS,
} from './wordlists'

export type MatchKind =
  | 'breached'
  | 'dictionary'
  | 'sequence'
  | 'repeat'
  | 'keyboard'
  | 'date'
  | 'bruteforce'

export interface PatternMatch {
  kind: MatchKind
  /** Inclusive start index into the password. */
  start: number
  /** Exclusive end index. */
  end: number
  token: string
  /** log2 of the guesses an attacker spends to reach this token. */
  bits: number
  label: string
  detail: string
}

export interface CharClasses {
  lowercase: boolean
  uppercase: boolean
  digits: boolean
  symbols: boolean
  space: boolean
  nonAscii: boolean
}

export interface Advice {
  id: string
  tone: 'critical' | 'improve' | 'good'
  text: string
}

export interface PasswordAnalysis {
  length: number
  /** Size of the character pool implied by the classes actually used. */
  poolSize: number
  charClasses: CharClasses
  /** log2(poolSize ^ length) — what a naive meter would report. */
  naiveBits: number
  /** The pattern-aware estimate that drives the score. */
  guessBits: number
  band: StrengthBand
  /** The cheapest segmentation found, left to right. */
  matches: PatternMatch[]
  advice: Advice[]
  /** True when the password appears verbatim in the embedded breach list. */
  breached: boolean
}

/* ------------------------------------------------------------------ */
/* Dictionaries                                                        */
/* ------------------------------------------------------------------ */

const BREACHED_RANK = new Map<string, number>()
COMMON_PASSWORDS.forEach((word, index) => {
  if (!BREACHED_RANK.has(word)) BREACHED_RANK.set(word, index + 1)
})

const ENGLISH_WORDS = new Set<string>([...PASSPHRASE_WORDS, ...EXTRA_DICTIONARY_WORDS])
/** A dictionary hit costs "somewhere in this list", so the list size is the price. */
const ENGLISH_DICT_SIZE = ENGLISH_WORDS.size

/** Exposed so the page can state honestly how big the embedded dictionary is. */
export const DICTIONARY_SIZE = ENGLISH_DICT_SIZE + COMMON_PASSWORDS.length

const MAX_TOKEN = 24

/* ------------------------------------------------------------------ */
/* Character classes                                                   */
/* ------------------------------------------------------------------ */

function classify(password: string): CharClasses {
  return {
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digits: /[0-9]/.test(password),
    // eslint-disable-next-line no-control-regex
    symbols: /[!-/:-@[-`{-~]/.test(password),
    space: /\s/.test(password),
    // eslint-disable-next-line no-control-regex
    nonAscii: /[^\x00-\x7f]/.test(password),
  }
}

/** Pool size implied by the classes present — the same assumption crackers make. */
export function poolSizeFor(classes: CharClasses): number {
  let pool = 0
  if (classes.lowercase) pool += 26
  if (classes.uppercase) pool += 26
  if (classes.digits) pool += 10
  if (classes.symbols) pool += 33
  if (classes.space) pool += 1
  if (classes.nonAscii) pool += 100
  return Math.max(pool, 1)
}

/* ------------------------------------------------------------------ */
/* Variant pricing                                                     */
/* ------------------------------------------------------------------ */

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let result = 1
  const limit = Math.min(k, n - k)
  for (let i = 0; i < limit; i += 1) result = (result * (n - i)) / (i + 1)
  return result
}

/**
 * How many capitalisation variants of a base word a cracker has to try.
 * "word" is free, "Word"/"WORD"/"worD" cost a factor of two, and genuinely
 * scattered capitals cost the number of ways to choose those positions.
 */
function uppercaseVariations(token: string): number {
  if (!/[A-Z]/.test(token)) return 1
  if (/^[A-Z][^A-Z]*$/.test(token)) return 2
  if (/^[^A-Z]*[A-Z]$/.test(token)) return 2
  if (token === token.toUpperCase()) return 2
  const upper = (token.match(/[A-Z]/g) ?? []).length
  const lower = (token.match(/[a-z]/g) ?? []).length
  let variations = 0
  for (let i = 1; i <= Math.min(upper, lower); i += 1) {
    variations += binomial(upper + lower, i)
  }
  return Math.max(variations, 2)
}

const LEET_CHARS = new Set(Object.keys(LEET_SUBSTITUTIONS))

/** Every plausible un-leeted reading of a token (bounded to a handful). */
function deLeetVariants(token: string): string[] {
  const used = new Set<string>()
  for (const char of token) if (LEET_CHARS.has(char)) used.add(char)
  if (used.size === 0) return []

  const base = token.replace(/./g, (char) => LEET_SUBSTITUTIONS[char] ?? char).toLowerCase()
  const variants = new Set<string>([base])
  // '1' and '0' are genuinely ambiguous, so try the other common reading too.
  if (token.includes('1')) {
    variants.add(
      token
        .replace(/1/g, 'i')
        .replace(/./g, (char) => (char === 'i' ? 'i' : (LEET_SUBSTITUTIONS[char] ?? char)))
        .toLowerCase(),
    )
  }
  if (token.includes('0')) {
    variants.add(
      token
        .replace(/0/g, 'o')
        .replace(/./g, (char) => (char === 'o' ? 'o' : (LEET_SUBSTITUTIONS[char] ?? char)))
        .toLowerCase(),
    )
  }
  return [...variants]
}

/** A cracker applying a leet ruleset multiplies its dictionary by roughly this. */
function leetVariations(token: string): number {
  let distinct = 0
  const seen = new Set<string>()
  for (const char of token) {
    if (LEET_CHARS.has(char) && !seen.has(char)) {
      seen.add(char)
      distinct += 1
    }
  }
  return distinct === 0 ? 1 : 2 ** distinct
}

function reverse(text: string): string {
  return [...text].reverse().join('')
}

/* ------------------------------------------------------------------ */
/* Matchers                                                            */
/* ------------------------------------------------------------------ */

function dictionaryMatches(password: string): PatternMatch[] {
  const out: PatternMatch[] = []
  const lower = password.toLowerCase()
  const n = password.length

  for (let start = 0; start < n; start += 1) {
    const maxEnd = Math.min(n, start + MAX_TOKEN)
    for (let end = start + 3; end <= maxEnd; end += 1) {
      const token = password.slice(start, end)
      const plain = lower.slice(start, end)

      const candidates: { word: string; reversed: boolean; leet: boolean }[] = [
        { word: plain, reversed: false, leet: false },
        { word: reverse(plain), reversed: true, leet: false },
      ]
      for (const variant of deLeetVariants(token)) {
        candidates.push({ word: variant, reversed: false, leet: true })
      }

      let best: PatternMatch | null = null

      for (const candidate of candidates) {
        const rank = BREACHED_RANK.get(candidate.word)
        const inEnglish = ENGLISH_WORDS.has(candidate.word)
        if (rank === undefined && !inEnglish) continue

        const baseGuesses = rank !== undefined ? rank : ENGLISH_DICT_SIZE
        const guesses =
          baseGuesses *
          uppercaseVariations(token) *
          (candidate.leet ? leetVariations(token) : 1) *
          (candidate.reversed ? 2 : 1)
        const bits = Math.log2(Math.max(guesses, 2))

        const notes: string[] = []
        if (candidate.reversed) notes.push('written backwards')
        if (candidate.leet) notes.push('with leetspeak substitutions')
        if (uppercaseVariations(token) > 1) notes.push('with capitalisation changes')
        const suffix = notes.length > 0 ? ` (${notes.join(', ')})` : ''

        const match: PatternMatch =
          rank !== undefined
            ? {
                kind: 'breached',
                start,
                end,
                token,
                bits,
                label: 'Breached password',
                detail: `“${candidate.word}” is #${rank} in the embedded list of the most common breached passwords${suffix}.`,
              }
            : {
                kind: 'dictionary',
                start,
                end,
                token,
                bits,
                label: 'Dictionary word',
                detail: `“${candidate.word}” is a common English word${suffix}. Word lists are the very first thing a cracker tries.`,
              }

        if (best === null || match.bits < best.bits) best = match
      }

      if (best) out.push(best)
    }
  }
  return out
}

function sequenceMatches(password: string): PatternMatch[] {
  const out: PatternMatch[] = []
  const n = password.length
  let start = 0

  while (start < n - 2) {
    const delta = password.charCodeAt(start + 1) - password.charCodeAt(start)
    if (delta !== 1 && delta !== -1) {
      start += 1
      continue
    }
    let end = start + 2
    while (end < n && password.charCodeAt(end) - password.charCodeAt(end - 1) === delta) end += 1

    const token = password.slice(start, end)
    if (token.length >= 3 && (/^[0-9]+$/.test(token) || /^[a-zA-Z]+$/.test(token))) {
      const base = /^[0-9]+$/.test(token) ? 10 : 26
      const guesses = base * 2 * token.length
      out.push({
        kind: 'sequence',
        start,
        end,
        token,
        bits: Math.log2(guesses),
        label: delta === 1 ? 'Ascending run' : 'Descending run',
        detail: `“${token}” walks straight through the ${base === 10 ? 'digits' : 'alphabet'}. Sequence rules are built into every cracking tool.`,
      })
    }
    start = end - 1
  }
  return out
}

function repeatMatches(password: string): PatternMatch[] {
  const out: PatternMatch[] = []
  const pattern = /(.+?)\1+/g
  let found: RegExpExecArray | null
  while ((found = pattern.exec(password)) !== null) {
    const whole = found[0]
    const unit = found[1]
    const repeats = whole.length / unit.length
    if (whole.length < 3) continue
    const unitPool = poolSizeFor(classify(unit))
    const guesses = Math.max(unitPool ** unit.length, 2) * repeats
    out.push({
      kind: 'repeat',
      start: found.index,
      end: found.index + whole.length,
      token: whole,
      bits: Math.log2(guesses),
      label: 'Repeated block',
      detail:
        unit.length === 1
          ? `“${unit}” repeated ${repeats} times adds almost nothing. The attacker guesses only one character plus a length.`
          : `“${unit}” repeated ${repeats} times costs barely more than “${unit}” on its own.`,
    })
    // Re-scan from just after the start so overlapping repeats are still seen.
    pattern.lastIndex = found.index + 1
  }
  return out
}

function keyboardMatches(password: string): PatternMatch[] {
  const out: PatternMatch[] = []
  const n = password.length

  for (let start = 0; start < n - 2; start += 1) {
    let bestEnd = start
    for (let end = start + 3; end <= n; end += 1) {
      const token = password.slice(start, end)
      const reversed = reverse(token)
      const onRow = KEYBOARD_ROWS.some((row) => row.includes(token) || row.includes(reversed))
      if (!onRow) break
      bestEnd = end
    }
    if (bestEnd > start) {
      const token = password.slice(start, bestEnd)
      // ~9 rows × 2 directions × where the run starts and how long it is.
      const guesses = KEYBOARD_ROWS.length * 2 * token.length * 10
      out.push({
        kind: 'keyboard',
        start,
        end: bestEnd,
        token,
        bits: Math.log2(guesses),
        label: 'Keyboard run',
        detail: `“${token}” is adjacent keys on the keyboard. Runs like qwerty, asdf and 12345 are in every wordlist.`,
      })
    }
  }
  return out
}

const DATE_PATTERN = /(?:19|20)\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g

function dateMatches(password: string): PatternMatch[] {
  const out: PatternMatch[] = []
  let found: RegExpExecArray | null
  DATE_PATTERN.lastIndex = 0
  while ((found = DATE_PATTERN.exec(password)) !== null) {
    const token = found[0]
    const isYear = /^(?:19|20)\d{2}$/.test(token)
    const guesses = isYear ? 200 : 200 * 12 * 31
    out.push({
      kind: 'date',
      start: found.index,
      end: found.index + token.length,
      token,
      bits: Math.log2(guesses),
      label: isYear ? 'Year' : 'Date',
      detail: isYear
        ? `“${token}” is a plausible year. There are only about 200 of those, and birth years are guessed first.`
        : `“${token}” looks like a date. Full dates are a search space of roughly 75 000, which a cracker tries in no time.`,
    })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Segmentation                                                        */
/* ------------------------------------------------------------------ */

function logFactorial(n: number): number {
  let total = 0
  for (let i = 2; i <= n; i += 1) total += Math.log2(i)
  return total
}

function segment(password: string, matches: PatternMatch[], poolSize: number): PatternMatch[] {
  const n = password.length
  const bruteforceBitsPerChar = Math.log2(poolSize)

  const byEnd: PatternMatch[][] = Array.from({ length: n + 1 }, () => [])
  for (const match of matches) byEnd[match.end].push(match)

  const bestBits = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY)
  const from = new Array<number>(n + 1).fill(-1)
  const via = new Array<PatternMatch | null>(n + 1).fill(null)
  bestBits[0] = 0

  for (let i = 1; i <= n; i += 1) {
    // Brute-force one more character.
    const straight = bestBits[i - 1] + bruteforceBitsPerChar
    if (straight < bestBits[i]) {
      bestBits[i] = straight
      from[i] = i - 1
      via[i] = null
    }
    for (const match of byEnd[i]) {
      const candidate = bestBits[match.start] + match.bits
      if (candidate < bestBits[i]) {
        bestBits[i] = candidate
        from[i] = match.start
        via[i] = match
      }
    }
  }

  // Walk the chain back, merging consecutive brute-forced characters.
  const chain: PatternMatch[] = []
  let cursor = n
  while (cursor > 0) {
    const previous = from[cursor]
    const match = via[cursor]
    if (match) {
      chain.push(match)
    } else {
      const token = password.slice(previous, cursor)
      chain.push({
        kind: 'bruteforce',
        start: previous,
        end: cursor,
        token,
        bits: bruteforceBitsPerChar,
        label: 'Unpredictable',
        detail: `No pattern found. Priced at the full ${Math.round(poolSize)}-character alphabet.`,
      })
    }
    cursor = previous
  }
  chain.reverse()

  const merged: PatternMatch[] = []
  for (const piece of chain) {
    const last = merged[merged.length - 1]
    if (piece.kind === 'bruteforce' && last && last.kind === 'bruteforce' && last.end === piece.start) {
      last.end = piece.end
      last.token += piece.token
      last.bits += piece.bits
    } else {
      merged.push({ ...piece })
    }
  }
  return merged
}

/* ------------------------------------------------------------------ */
/* Advice                                                              */
/* ------------------------------------------------------------------ */

function buildAdvice(
  password: string,
  matches: PatternMatch[],
  classes: CharClasses,
  guessBits: number,
): Advice[] {
  const advice: Advice[] = []
  const kinds = new Set(matches.map((m) => m.kind))
  const unpredictable = matches
    .filter((m) => m.kind === 'bruteforce')
    .reduce((sum, m) => sum + (m.end - m.start), 0)

  if (kinds.has('breached')) {
    advice.push({
      id: 'breached',
      tone: 'critical',
      text: 'Part of this password appears in public breach lists. Attackers start there, so this is effectively a known password. Replace it; do not patch it.',
    })
  }
  if (kinds.has('dictionary')) {
    advice.push({
      id: 'dictionary',
      tone: 'improve',
      text: 'A dictionary word is doing most of the work here. Four or five unrelated random words are far stronger than one word plus decorations.',
    })
  }
  if (matches.some((m) => m.detail.includes('leetspeak'))) {
    advice.push({
      id: 'leet',
      tone: 'improve',
      text: 'Swapping a → @ and o → 0 costs a cracker roughly one extra guess per substitution. It feels clever but adds only a bit or two.',
    })
  }
  if (kinds.has('keyboard')) {
    advice.push({
      id: 'keyboard',
      tone: 'improve',
      text: 'Keyboard runs such as qwerty, asdf or 1qaz2wsx are enumerated by every cracking tool before it tries anything random.',
    })
  }
  if (kinds.has('sequence')) {
    advice.push({
      id: 'sequence',
      tone: 'improve',
      text: 'Straight runs like abc or 4567 are cheap to generate. Replace the run with characters chosen at random.',
    })
  }
  if (kinds.has('repeat')) {
    advice.push({
      id: 'repeat',
      tone: 'improve',
      text: 'Repeating a character or block does not multiply the search space. The attacker guesses the block once, then a length.',
    })
  }
  if (kinds.has('date')) {
    advice.push({
      id: 'date',
      tone: 'improve',
      text: 'Years and dates come from a space of a few hundred to a few tens of thousands, and personal dates are tried first.',
    })
  }
  if (password.length > 0 && password.length < 12) {
    advice.push({
      id: 'length',
      tone: guessBits < 60 ? 'critical' : 'improve',
      text: `At ${password.length} characters this is short. Length is the only lever that keeps scaling: each extra random character multiplies the work by the size of your alphabet.`,
    })
  }
  if (unpredictable < 8 && password.length >= 8) {
    advice.push({
      id: 'unpredictable',
      tone: 'improve',
      text: `Only ${unpredictable} character${unpredictable === 1 ? '' : 's'} of this password could not be explained by a pattern. That unpredictable core is what actually protects you.`,
    })
  }
  if (!classes.uppercase && !classes.digits && !classes.symbols && password.length > 0) {
    advice.push({
      id: 'classes',
      tone: 'improve',
      text: 'This uses lowercase letters only. Mixing in other character classes widens the alphabet, though adding four more characters helps more than adding one symbol.',
    })
  }
  if (guessBits >= 80 && advice.length === 0) {
    advice.push({
      id: 'strong',
      tone: 'good',
      text: 'No patterns found and the search space is far past any realistic brute-force budget. Nothing here needs fixing.',
    })
  }
  if (password.length > 0) {
    advice.push({
      id: 'reuse',
      tone: guessBits >= 80 ? 'good' : 'improve',
      text: 'Strength only matters if the password is unique. A perfect password reused on a site that leaks it is a compromised password everywhere else.',
    })
  }
  return advice
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function analyzePassword(password: string): PasswordAnalysis {
  const classes = classify(password)
  const poolSize = poolSizeFor(classes)
  const naiveBits = password.length === 0 ? 0 : Math.log2(poolSize) * password.length

  if (password.length === 0) {
    return {
      length: 0,
      poolSize,
      charClasses: classes,
      naiveBits: 0,
      guessBits: 0,
      band: bandForBits(0),
      matches: [],
      advice: [],
      breached: false,
    }
  }

  const candidates = [
    ...dictionaryMatches(password),
    ...sequenceMatches(password),
    ...repeatMatches(password),
    ...keyboardMatches(password),
    ...dateMatches(password),
  ]

  const matches = segment(password, candidates, poolSize)
  const structuredSegments = matches.filter((m) => m.kind !== 'bruteforce').length
  const arrangementBits = structuredSegments > 1 ? logFactorial(structuredSegments) : 0

  const rawBits = matches.reduce((sum, m) => sum + m.bits, 0) + arrangementBits
  // A single-guess floor: nothing is worth less than "the attacker tried it".
  const guessBits = Math.min(Math.max(rawBits, Math.log2(2)), naiveBits)

  return {
    length: password.length,
    poolSize,
    charClasses: classes,
    naiveBits,
    guessBits,
    band: bandForBits(guessBits),
    matches,
    advice: buildAdvice(password, matches, classes, guessBits),
    breached: BREACHED_RANK.has(password.toLowerCase()),
  }
}
