/**
 * English number-word engine: digits → words (cardinal, ordinal, currency) and
 * words → digits. Integer work is done on BigInt so very large values stay exact.
 */

export type ScaleSystem = 'short' | 'indian'

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

/** Short-scale group names, three digits each. */
const SHORT_SCALES = [
  '',
  'thousand',
  'million',
  'billion',
  'trillion',
  'quadrillion',
  'quintillion',
  'sextillion',
  'septillion',
  'octillion',
  'nonillion',
  'decillion',
  'undecillion',
  'duodecillion',
]

/** Indian system: a group of three, then groups of two. */
const INDIAN_SCALES = ['', 'thousand', 'lakh', 'crore', 'arab', 'kharab', 'neel', 'padma', 'shankh']

export function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n]
  const tens = TENS[Math.floor(n / 10)]
  const unit = n % 10
  return unit === 0 ? tens : `${tens}-${ONES[unit]}`
}

function threeDigitWords(n: number, useAnd: boolean): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (hundreds > 0) parts.push(`${ONES[hundreds]} hundred`)
  if (rest > 0) {
    if (hundreds > 0 && useAnd) parts.push('and')
    parts.push(twoDigitWords(rest))
  }
  return parts.join(' ')
}

/** Split a digit string into groups from the right. */
function groupDigits(digits: string, sizes: number[]): string[] {
  const out: string[] = []
  let remaining = digits
  let i = 0
  while (remaining.length > 0) {
    const size = sizes[Math.min(i, sizes.length - 1)]
    const start = Math.max(0, remaining.length - size)
    out.push(remaining.slice(start))
    remaining = remaining.slice(0, start)
    i++
  }
  return out // index 0 is the least significant group
}

export interface WordOptions {
  useAnd?: boolean
  system?: ScaleSystem
}

/** Convert a non-negative integer given as a digit string into English words. */
export function integerToWords(digits: string, options: WordOptions = {}): string {
  const { useAnd = false, system = 'short' } = options
  const clean = digits.replace(/^0+(?=\d)/, '')
  if (clean === '' || /^0+$/.test(clean)) return 'zero'

  const sizes = system === 'indian' ? [3, 2] : [3]
  const scales = system === 'indian' ? INDIAN_SCALES : SHORT_SCALES
  const groups = groupDigits(clean, sizes)

  if (groups.length > scales.length) {
    throw new Error(
      `That number is larger than this converter names (up to ${scales.length} groups, i.e. ${scales[scales.length - 1]}).`,
    )
  }

  const chunks: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const value = Number(groups[i])
    if (value === 0) continue
    const words = threeDigitWords(value, useAnd)
    const scale = scales[i]
    chunks.push(scale ? `${words} ${scale}` : words)
  }

  // British "and" before a trailing sub-hundred group: "one thousand and five".
  const lastValue = Number(groups[0])
  if (useAnd && chunks.length > 1 && lastValue > 0 && lastValue < 100) {
    chunks.splice(chunks.length - 1, 0, 'and')
  }

  return chunks.join(' ').replace(/\s+/g, ' ').trim()
}

const ORDINAL_WORDS: Record<string, string> = {
  zero: 'zeroth',
  one: 'first',
  two: 'second',
  three: 'third',
  four: 'fourth',
  five: 'fifth',
  six: 'sixth',
  seven: 'seventh',
  eight: 'eighth',
  nine: 'ninth',
  ten: 'tenth',
  eleven: 'eleventh',
  twelve: 'twelfth',
  hundred: 'hundredth',
  thousand: 'thousandth',
  lakh: 'lakhth',
  crore: 'croreth',
}

function ordinalWord(word: string): string {
  if (ORDINAL_WORDS[word]) return ORDINAL_WORDS[word]
  if (word.endsWith('y')) return `${word.slice(0, -1)}ieth`
  return `${word}th`
}

/** "one thousand two hundred" -> "one thousand two hundredth" */
export function cardinalToOrdinalWords(cardinal: string): string {
  const words = cardinal.split(' ')
  const last = words[words.length - 1]
  if (last.includes('-')) {
    const bits = last.split('-')
    bits[bits.length - 1] = ordinalWord(bits[bits.length - 1])
    words[words.length - 1] = bits.join('-')
  } else {
    words[words.length - 1] = ordinalWord(last)
  }
  return words.join(' ')
}

/** 1 -> "1st", 12 -> "12th", 1203 -> "1,203rd" */
export function numericOrdinal(digits: string): string {
  const lastTwo = Number(digits.slice(-2))
  const last = Number(digits.slice(-1))
  let suffix = 'th'
  if (lastTwo < 11 || lastTwo > 13) {
    if (last === 1) suffix = 'st'
    else if (last === 2) suffix = 'nd'
    else if (last === 3) suffix = 'rd'
  }
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${grouped}${suffix}`
}

export interface CurrencyWordUnit {
  code: string
  major: string
  majorPlural: string
  minor: string
  minorPlural: string
  minorPerMajor: number
}

export const CURRENCY_WORDS: CurrencyWordUnit[] = [
  { code: 'USD', major: 'dollar', majorPlural: 'dollars', minor: 'cent', minorPlural: 'cents', minorPerMajor: 100 },
  { code: 'EUR', major: 'euro', majorPlural: 'euros', minor: 'cent', minorPlural: 'cents', minorPerMajor: 100 },
  { code: 'GBP', major: 'pound', majorPlural: 'pounds', minor: 'penny', minorPlural: 'pence', minorPerMajor: 100 },
  { code: 'CAD', major: 'dollar', majorPlural: 'dollars', minor: 'cent', minorPlural: 'cents', minorPerMajor: 100 },
  { code: 'AUD', major: 'dollar', majorPlural: 'dollars', minor: 'cent', minorPlural: 'cents', minorPerMajor: 100 },
  { code: 'INR', major: 'rupee', majorPlural: 'rupees', minor: 'paisa', minorPlural: 'paise', minorPerMajor: 100 },
  { code: 'ZAR', major: 'rand', majorPlural: 'rand', minor: 'cent', minorPlural: 'cents', minorPerMajor: 100 },
  { code: 'JPY', major: 'yen', majorPlural: 'yen', minor: 'sen', minorPlural: 'sen', minorPerMajor: 100 },
]

export interface ParsedNumber {
  negative: boolean
  integerDigits: string
  fractionDigits: string
}

/** Validate and split a typed number into its parts. Throws with a human message. */
export function splitNumber(raw: string): ParsedNumber {
  const text = raw.trim().replace(/[,\s_]/g, '')
  if (text === '') throw new Error('Enter a number.')
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text)
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) {
    throw new Error('That is not a plain number. Use digits, an optional minus sign and at most one decimal point.')
  }
  return {
    negative: match[1] === '-',
    integerDigits: match[2] === '' ? '0' : match[2],
    fractionDigits: match[3] ?? '',
  }
}

/** Spell out the digits after a decimal point: 0.75 -> "point seven five". */
export function fractionToWords(fraction: string): string {
  if (fraction === '') return ''
  return `point ${fraction
    .split('')
    .map((d) => ONES[Number(d)])
    .join(' ')}`
}

/* ------------------------------------------------------------------ *
 * Words -> number
 * ------------------------------------------------------------------ */

const WORD_VALUES: Record<string, bigint> = {}
ONES.forEach((word, i) => {
  WORD_VALUES[word] = BigInt(i)
})
TENS.forEach((word, i) => {
  if (word) WORD_VALUES[word] = BigInt(i * 10)
})

const MULTIPLIERS: Record<string, bigint> = {
  hundred: 100n,
  thousand: 1000n,
  lakh: 100000n,
  lac: 100000n,
  crore: 10000000n,
  arab: 1000000000n,
}
SHORT_SCALES.forEach((name, i) => {
  if (i >= 2) MULTIPLIERS[name] = 10n ** BigInt(3 * i)
})

const ALIASES: Record<string, string> = {
  naught: 'zero',
  nought: 'zero',
  nil: 'zero',
  oh: 'zero',
  o: 'zero',
}

export interface WordsToNumberResult {
  value: string
  negative: boolean
  fraction: string
}

export function wordsToNumber(input: string): WordsToNumberResult {
  const normalised = input
    .toLowerCase()
    .replace(/[,]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (normalised === '') throw new Error('Type some number words, for example “two thousand and forty-six”.')

  const tokens = normalised.split(' ')
  let negative = false
  let index = 0
  if (tokens[0] === 'minus' || tokens[0] === 'negative') {
    negative = true
    index = 1
  }

  let total = 0n
  let current = 0n
  let sawNumber = false
  let fraction = ''
  let afterPoint = false

  for (; index < tokens.length; index++) {
    const token = ALIASES[tokens[index]] ?? tokens[index]
    if (token === '') continue

    if (afterPoint) {
      if (/^\d+$/.test(token)) {
        fraction += token
        continue
      }
      const digit = WORD_VALUES[token]
      if (digit === undefined || digit > 9n) {
        throw new Error(`After “point” each digit is spelled out on its own. “${token}” is not a single digit.`)
      }
      fraction += digit.toString()
      continue
    }

    if (token === 'point' || token === 'decimal') {
      afterPoint = true
      continue
    }

    if (/^\d+$/.test(token)) {
      current += BigInt(token)
      sawNumber = true
      continue
    }

    const multiplier = MULTIPLIERS[token]
    if (multiplier !== undefined) {
      if (multiplier === 100n) {
        current = (current === 0n ? 1n : current) * 100n
      } else {
        total += (current === 0n ? 1n : current) * multiplier
        current = 0n
      }
      sawNumber = true
      continue
    }

    const value = WORD_VALUES[token]
    if (value !== undefined) {
      current += value
      sawNumber = true
      continue
    }

    throw new Error(`“${tokens[index]}” is not a number word I recognise.`)
  }

  if (!sawNumber && fraction === '') {
    throw new Error('I could not find a number in that text.')
  }

  total += current
  return { value: total.toString(), negative, fraction }
}

/** 1234567 -> "1,234,567" for a digit string of any length. */
export function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
