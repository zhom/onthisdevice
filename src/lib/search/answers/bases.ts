import type { Answer } from './types'
import { group } from './format'

const BASE_WORDS: Record<string, number> = {
  hex: 16, hexadecimal: 16, binary: 2, bin: 2, octal: 8, oct: 8, decimal: 10, dec: 10,
}
const BASE_NAMES: Record<number, string> = { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hex' }
const PREFIXES: Record<string, number> = { '0x': 16, '0b': 2, '0o': 8 }

// [source word] [-]digits [source word] [to target]. Source words before the number exclude
// "dec" and "oct" so that dates like "dec 25" stay dates.
const PATTERN =
  /^(?:(hex|hexadecimal|binary|octal|decimal) )?(-)?(0x[0-9a-f]+|0b[01]+|0o[0-7]+|[0-9a-z]+)(?: (hex|hexadecimal|binary|bin|octal|decimal))?(?: (?:to|in|into|as) (hex|hexadecimal|binary|bin|octal|oct|decimal|dec|base ?\d{1,2}))?$/

const baseName = (b: number) => BASE_NAMES[b] ?? `base ${b}`
const title = (b: number) => baseName(b)[0].toUpperCase() + baseName(b).slice(1)

function parseBig(digits: string, base: number): bigint | null {
  let n = 0n
  const b = BigInt(base)
  for (const ch of digits) {
    const d = parseInt(ch, 36)
    if (!(d < base)) return null
    n = n * b + BigInt(d)
  }
  return n
}

/** "0xff", "255 to binary", "255 in hex", "ff to decimal", "hex ff", "binary 1010", "1010 binary to decimal". */
export function baseAnswer(s: string): Answer | null {
  const m = PATTERN.exec(s)
  if (!m || s.length > 80) return null
  const [, before, minus, raw, after, to] = m
  const prefix = /^0[xbo]./.test(raw) ? PREFIXES[raw.slice(0, 2)] : 0
  const digits = prefix ? raw.slice(2) : raw
  const named = before || after ? BASE_WORDS[before || after] : 0
  if (prefix && named && prefix !== named) return null
  const target = to ? (BASE_WORDS[to] ?? Number(to.replace(/\D/g, ''))) : 0
  if (!prefix && !named && !target) return null
  // A bare word of hex letters ("add", "cafe") is a number only when asked for in decimal.
  if (!prefix && !named && /^[a-f]+$/.test(digits) && target !== 10) return null

  const from = prefix || named || (/[a-f]/.test(digits) ? 16 : target === 10 && /^[01]+$/.test(digits) ? 2 : 10)
  const into = target || (from === 10 ? 16 : 10)
  if (into < 2 || into > 36 || from === into || digits.length > 64) return null
  const n = parseBig(digits, from)
  if (n === null) return null

  const sign = minus ? '-' : ''
  const out = (b: number) => sign + n.toString(b)
  const value = out(into)
  return {
    kind: 'base',
    value: into === 10 ? group(value) : value,
    label: `${title(from)} ${sign}${digits} in ${baseName(into)}`,
    copy: value,
    slug: from === 2 && into === 10 ? 'binary-to-decimal' : from === 10 && into === 2 ? 'decimal-to-binary' : 'number-base-converter',
    more: [10, 16, 2, 8].filter((b) => b !== into).slice(0, 3).map((b) => `${title(b)} ${b === 10 ? group(out(b)) : out(b)}`),
  }
}
