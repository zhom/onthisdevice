/** Classical ciphers and word games. These hide nothing from an attacker; they are puzzles and teaching tools. */

const A = 65
const a = 97

/** Shifts each Latin letter by `shift` places and keeps case; other characters pass through. */
export function caesar(text: string, shift: number): string {
  const s = ((Math.round(shift) % 26) + 26) % 26
  return text.replace(/[A-Za-z]/g, (c) => {
    const base = c <= 'Z' ? A : a
    return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base)
  })
}

export const rot13 = (text: string) => caesar(text, 13)

/** ROT47 rotates the 94 printable ASCII characters from ! to ~. */
export function rot47(text: string): string {
  return text.replace(/[!-~]/g, (c) => String.fromCharCode(33 + ((c.charCodeAt(0) - 33 + 47) % 94)))
}

/** English letter frequencies (percent), used to score a candidate decryption. */
const ENGLISH = [8.2, 1.5, 2.8, 4.3, 12.7, 2.2, 2.0, 6.1, 7.0, 0.15, 0.77, 4.0, 2.4, 6.7, 7.5, 1.9, 0.095, 6.0, 6.3, 9.1, 2.8, 0.98, 2.4, 0.15, 2.0, 0.074]

/** Chi-squared distance between the letter counts of `text` and English. Lower is more English. */
export function chiSquared(text: string): number {
  const counts = new Array<number>(26).fill(0)
  let n = 0
  for (const c of text.toLowerCase()) {
    const i = c.charCodeAt(0) - a
    if (i >= 0 && i < 26) {
      counts[i]++
      n++
    }
  }
  if (n === 0) return Infinity
  return counts.reduce((sum, count, i) => {
    const expected = (ENGLISH[i] / 100) * n
    return sum + (count - expected) ** 2 / expected
  }, 0)
}

/** Tries all 26 shifts; returns them ordered from most to least English-like. */
export function crackCaesar(cipher: string): { shift: number; text: string; score: number }[] {
  return Array.from({ length: 26 }, (_, shift) => {
    const text = caesar(cipher, -shift)
    return { shift, text, score: chiSquared(text) }
  }).sort((x, y) => x.score - y.score)
}

export function vigenere(text: string, key: string, decrypt: boolean): string {
  const shifts = key
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .split('')
    .map((c) => c.charCodeAt(0) - a)
  if (shifts.length === 0) throw new Error('The key needs at least one letter from A to Z.')
  let k = 0
  return text.replace(/[A-Za-z]/g, (c) => {
    const base = c <= 'Z' ? A : a
    const s = shifts[k++ % shifts.length] * (decrypt ? -1 : 1)
    return String.fromCharCode(((((c.charCodeAt(0) - base + s) % 26) + 26) % 26) + base)
  })
}

export function atbash(text: string): string {
  return text.replace(/[A-Za-z]/g, (c) => {
    const base = c <= 'Z' ? A : a
    return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base))
  })
}

/** A1Z26: A=1 ... Z=26. Letters of a word are joined with `joiner`, words with " / ". */
export function lettersToNumbers(text: string, joiner: string): string {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(/\s+/)
        .filter(Boolean)
        .map((word) =>
          [...word]
            .map((c) => {
              const i = c.toLowerCase().charCodeAt(0) - a
              return i >= 0 && i < 26 ? String(i + 1) : c
            })
            .join(joiner),
        )
        .join(' / '),
    )
    .join('\n')
}

export function numbersToLetters(text: string, upper: boolean): string {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(/\s*\/\s*|\s{2,}/)
        .map((word) =>
          (word.match(/\d+|[^\d\s,.-]/g) ?? [])
            .map((t) => {
              if (!/^\d+$/.test(t)) return t
              const n = Number(t)
              if (n < 1 || n > 26) throw new Error(`${t} is not a letter number. Use 1 to 26.`)
              const c = String.fromCharCode(a + n - 1)
              return upper ? c.toUpperCase() : c
            })
            .join(''),
        )
        .join(' '),
    )
    .join('\n')
}

/** Rail fence: the text is written in a zigzag over `rails` rows and read row by row. */
function railPattern(length: number, rails: number): number[] {
  const rows: number[] = []
  let row = 0
  let dir = 1
  for (let i = 0; i < length; i++) {
    rows.push(row)
    if (rails === 1) continue
    if (row === 0) dir = 1
    else if (row === rails - 1) dir = -1
    row += dir
  }
  return rows
}

export function railFence(text: string, rails: number, decrypt: boolean): string {
  const r = Math.max(2, Math.floor(rails))
  const chars = [...text]
  const pattern = railPattern(chars.length, r)
  const order = chars.map((_, i) => i).sort((x, y) => pattern[x] - pattern[y] || x - y)
  if (!decrypt) return order.map((i) => chars[i]).join('')
  const out = new Array<string>(chars.length)
  order.forEach((pos, k) => {
    out[pos] = chars[k]
  })
  return out.join('')
}

/** Baconian cipher. The 26-letter version gives every letter its own code; the classic one merges I/J and U/V. */
function baconTable(distinct: boolean): string[] {
  const letters = distinct ? 'abcdefghijklmnopqrstuvwxyz' : 'abcdefghiklmnopqrstuwxyz'
  return [...letters].map((_, i) => i.toString(2).padStart(5, '0').replace(/0/g, 'A').replace(/1/g, 'B'))
}

export function baconEncode(text: string, distinct: boolean): string {
  const table = baconTable(distinct)
  const letters = distinct ? 'abcdefghijklmnopqrstuvwxyz' : 'abcdefghiklmnopqrstuwxyz'
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      [...word]
        .map((c) => {
          const ch = distinct ? c : c === 'j' ? 'i' : c === 'v' ? 'u' : c
          const i = letters.indexOf(ch)
          return i >= 0 ? table[i] : ''
        })
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean)
    .join(' / ')
}

export function baconDecode(text: string, distinct: boolean): string {
  const letters = distinct ? 'abcdefghijklmnopqrstuvwxyz' : 'abcdefghiklmnopqrstuwxyz'
  const table = baconTable(distinct)
  return text
    .split('/')
    .map((word) => {
      const ab = word.toUpperCase().replace(/[^AB]/g, '')
      if (ab.length % 5 !== 0) throw new Error('Each letter is a group of 5 A and B characters. One group is incomplete.')
      let out = ''
      for (let i = 0; i < ab.length; i += 5) {
        const k = table.indexOf(ab.slice(i, i + 5))
        if (k < 0) throw new Error(`${ab.slice(i, i + 5)} is not a code in this alphabet.`)
        out += letters[k]
      }
      return out
    })
    .join(' ')
}

const VOWELS = /[aeiou]/i

/** Pig Latin: move the first consonant cluster to the end and add "ay"; vowel words get the chosen ending. */
export function pigLatin(text: string, vowelEnding: string): string {
  return text.replace(/[A-Za-z]+(?:['’][A-Za-z]+)?/g, (word) => {
    const lower = word.toLowerCase()
    let out: string
    if (VOWELS.test(lower[0])) out = lower + vowelEnding
    else {
      const m = /^(qu|[^aeiouy]*qu|[^aeiouy]+|y[^aeiouy]*)(.*)$/.exec(lower)
      const [head, rest] = m && m[2] ? [m[1], m[2]] : ['', lower]
      out = rest + head + 'ay'
    }
    if (word === word.toUpperCase() && word.length > 1) return out.toUpperCase()
    if (word[0] === word[0].toUpperCase()) return out[0].toUpperCase() + out.slice(1)
    return out
  })
}

const LEET_BASIC: Record<string, string> = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', b: '8', g: '9' }
const LEET_FULL: Record<string, string> = {
  ...LEET_BASIC,
  a: '/-\\', c: '(', d: '|)', h: '|-|', k: '|<', l: '|_', m: '|\\/|', n: '|\\|', u: '|_|', v: '\\/', w: '\\/\\/', x: '><', y: '`/',
}

export function toLeet(text: string, full: boolean): string {
  const table = full ? LEET_FULL : LEET_BASIC
  return [...text].map((c) => table[c.toLowerCase()] ?? c).join('')
}

/** Reverses the basic substitutions inside words that contain a letter, so plain numbers stay numbers. */
export function fromLeet(text: string): string {
  const reverse: Record<string, string> = { '4': 'a', '3': 'e', '1': 'i', '0': 'o', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', $: 's', '+': 't' }
  return text.replace(/\S+/g, (token) => {
    if (!/[A-Za-z]/.test(token)) return token
    return token.replace(/[0134-9@$+]|!(?=[\w@$])/g, (c) => (c === '!' ? 'i' : (reverse[c] ?? c)))
  })
}
