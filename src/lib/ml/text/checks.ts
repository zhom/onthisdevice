/** Check digits and small validators used by the pattern rules. */

export function digitsOf(s: string): string {
  return s.replace(/\D+/g, '')
}

/** Luhn (mod 10): card numbers, Canadian SIN. */
export function luhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

/** IBAN length per country (ISO 13616 registry). */
const IBAN_LENGTH: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BI: 27, BR: 29, BY: 28,
  CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DJ: 27, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18,
  FK: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22,
  IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20,
  LV: 21, LY: 25, MC: 27, MD: 24, ME: 22, MK: 19, MN: 20, MR: 27, MT: 31, MU: 30, NI: 28, NL: 18,
  NO: 15, OM: 23, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, RU: 33, SA: 24, SC: 31,
  SD: 18, SE: 24, SI: 19, SK: 24, SM: 27, SO: 23, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26, UA: 29,
  VA: 22, VG: 24, XK: 20, YE: 30,
}

export function ibanLength(country: string): number | undefined {
  return IBAN_LENGTH[country]
}

/** ISO 7064 mod 97-10 over an alphanumeric string (letters count as 10..35). */
export function mod97(s: string): number {
  let rem = 0
  for (const ch of s) {
    const code = ch.charCodeAt(0)
    const v = code >= 65 ? code - 55 : code - 48
    rem = v >= 10 ? (rem * 100 + v) % 97 : (rem * 10 + v) % 97
  }
  return rem
}

export function validIban(raw: string): boolean {
  const s = raw.replace(/[\s-]+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false
  const len = IBAN_LENGTH[s.slice(0, 2)]
  if (!len || s.length !== len) return false
  return mod97(s.slice(4) + s.slice(0, 4)) === 1
}

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

/** Verhoeff check digit (Indian Aadhaar). */
export function verhoeff(digits: string): boolean {
  let c = 0
  const rev = digits.split('').reverse()
  for (let i = 0; i < rev.length; i++) c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(rev[i])]]
  return c === 0
}

/** UK NHS number: mod 11 with weights 10..2. */
export function validNhs(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i)
  let check = 11 - (sum % 11)
  if (check === 11) check = 0
  return check !== 10 && check === Number(digits[9])
}

/** Dutch BSN: the "11 test" with a final weight of -1. */
export function validBsn(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 8; i++) sum += Number(digits[i]) * (9 - i)
  sum -= Number(digits[8])
  return sum % 11 === 0 && sum !== 0
}

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'

/** Spanish DNI (8 digits + letter) and NIE (X/Y/Z + 7 digits + letter). */
export function validDni(raw: string): boolean {
  const s = raw.replace(/[\s-]+/g, '').toUpperCase()
  let num: string
  if (/^\d{8}[A-Z]$/.test(s)) num = s.slice(0, 8)
  else if (/^[XYZ]\d{7}[A-Z]$/.test(s)) num = String('XYZ'.indexOf(s[0])) + s.slice(1, 8)
  else return false
  return DNI_LETTERS[Number(num) % 23] === s[8]
}

/** French NIR (social security number) with its 2-digit key. */
export function validNir(raw: string): boolean {
  const s = raw.replace(/\s+/g, '').toUpperCase()
  if (!/^[12]\d{4}(?:\d{2}|2[AB])\d{6}\d{2}$/.test(s)) return false
  const body = s.slice(0, 13).replace('2A', '19').replace('2B', '18')
  const key = Number(s.slice(13))
  return 97 - Number(BigInt(body) % 97n) === key
}

/** German tax ID (Steuer-ID): 11 digits, ISO 7064 mod 11,10 check digit. */
export function validSteuerId(digits: string): boolean {
  if (!/^[1-9]\d{10}$/.test(digits)) return false
  let product = 10
  for (let i = 0; i < 10; i++) {
    let sum = (Number(digits[i]) + product) % 10
    if (sum === 0) sum = 10
    product = (sum * 2) % 11
  }
  let check = 11 - product
  if (check === 10) check = 0
  return check === Number(digits[10])
}

/** Shannon entropy in bits per character. */
export function entropy(s: string): number {
  if (!s) return 0
  const counts = new Map<string, number>()
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  let h = 0
  for (const n of counts.values()) {
    const p = n / s.length
    h -= p * Math.log2(p)
  }
  return h
}

/** Calendar check for a numeric date. Two-digit years are accepted. */
export function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false
  const year = y < 100 ? 2000 + y : y
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return d <= days
}
