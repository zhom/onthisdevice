/** Check digits: Luhn (card numbers, IMEI), card networks by number range, IBAN (ISO 13616) and hash formats. */

export function luhnValid(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = digits.charCodeAt(digits.length - 1 - i) - 48
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return digits.length > 0 && sum % 10 === 0
}

/** The digit to append so that the whole number passes the Luhn check. */
export function luhnCheckDigit(digits: string): number {
  for (let c = 0; c < 10; c++) if (luhnValid(digits + c)) return c
  return 0
}

export interface Network {
  name: string
  lengths: number[]
  /** Prefix ranges [from, to] compared on the same number of leading digits. */
  ranges: [string, string][]
}

export const NETWORKS: Network[] = [
  { name: 'Visa', lengths: [13, 16, 19], ranges: [['4', '4']] },
  { name: 'Mastercard', lengths: [16], ranges: [['51', '55'], ['2221', '2720']] },
  { name: 'American Express', lengths: [15], ranges: [['34', '34'], ['37', '37']] },
  { name: 'Discover', lengths: [16, 17, 18, 19], ranges: [['6011', '6011'], ['644', '649'], ['65', '65'], ['622126', '622925']] },
  { name: 'Diners Club', lengths: [14, 15, 16, 17, 18, 19], ranges: [['300', '305'], ['36', '36'], ['38', '39']] },
  { name: 'JCB', lengths: [16, 17, 18, 19], ranges: [['3528', '3589']] },
  { name: 'UnionPay', lengths: [16, 17, 18, 19], ranges: [['62', '62'], ['81', '81']] },
  { name: 'Maestro', lengths: [12, 13, 14, 15, 16, 17, 18, 19], ranges: [['5018', '5018'], ['5020', '5020'], ['5038', '5038'], ['5893', '5893'], ['6304', '6304'], ['6759', '6759'], ['6761', '6763']] },
  { name: 'Mir', lengths: [16, 17, 18, 19], ranges: [['2200', '2204']] },
  { name: 'RuPay', lengths: [16], ranges: [['60', '60'], ['65', '65'], ['81', '82'], ['508', '508']] },
  { name: 'Verve', lengths: [16, 18, 19], ranges: [['506099', '506198'], ['650002', '650027']] },
]

export function networkOf(digits: string): Network | null {
  let best: { n: Network; len: number } | null = null
  for (const n of NETWORKS) {
    for (const [from, to] of n.ranges) {
      const p = digits.slice(0, from.length)
      if (p.length === from.length && p >= from && p <= to && (!best || from.length > best.len)) best = { n, len: from.length }
    }
  }
  return best?.n ?? null
}

/* ── IBAN ── */

export const IBAN_LENGTHS: Record<string, [number, string]> = {
  AD: [24, 'Andorra'], AE: [23, 'United Arab Emirates'], AL: [28, 'Albania'], AT: [20, 'Austria'], AZ: [28, 'Azerbaijan'], BA: [20, 'Bosnia and Herzegovina'],
  BE: [16, 'Belgium'], BG: [22, 'Bulgaria'], BH: [22, 'Bahrain'], BI: [27, 'Burundi'], BR: [29, 'Brazil'], BY: [28, 'Belarus'], CH: [21, 'Switzerland'],
  CR: [22, 'Costa Rica'], CY: [28, 'Cyprus'], CZ: [24, 'Czechia'], DE: [22, 'Germany'], DJ: [27, 'Djibouti'], DK: [18, 'Denmark'], DO: [28, 'Dominican Republic'],
  EE: [20, 'Estonia'], EG: [29, 'Egypt'], ES: [24, 'Spain'], FI: [18, 'Finland'], FK: [18, 'Falkland Islands'], FO: [18, 'Faroe Islands'], FR: [27, 'France'],
  GB: [22, 'United Kingdom'], GE: [22, 'Georgia'], GI: [23, 'Gibraltar'], GL: [18, 'Greenland'], GR: [27, 'Greece'], GT: [28, 'Guatemala'], HN: [28, 'Honduras'],
  HR: [21, 'Croatia'], HU: [28, 'Hungary'], IE: [22, 'Ireland'], IL: [23, 'Israel'], IQ: [23, 'Iraq'], IS: [26, 'Iceland'], IT: [27, 'Italy'], JO: [30, 'Jordan'],
  KW: [30, 'Kuwait'], KZ: [20, 'Kazakhstan'], LB: [28, 'Lebanon'], LC: [32, 'Saint Lucia'], LI: [21, 'Liechtenstein'], LT: [20, 'Lithuania'], LU: [20, 'Luxembourg'],
  LV: [21, 'Latvia'], LY: [25, 'Libya'], MC: [27, 'Monaco'], MD: [24, 'Moldova'], ME: [22, 'Montenegro'], MK: [19, 'North Macedonia'], MN: [20, 'Mongolia'],
  MR: [27, 'Mauritania'], MT: [31, 'Malta'], MU: [30, 'Mauritius'], NI: [28, 'Nicaragua'], NL: [18, 'Netherlands'], NO: [15, 'Norway'], OM: [23, 'Oman'],
  PK: [24, 'Pakistan'], PL: [28, 'Poland'], PS: [29, 'Palestine'], PT: [25, 'Portugal'], QA: [29, 'Qatar'], RO: [24, 'Romania'], RS: [22, 'Serbia'],
  RU: [33, 'Russia'], SA: [24, 'Saudi Arabia'], SC: [31, 'Seychelles'], SD: [18, 'Sudan'], SE: [24, 'Sweden'], SI: [19, 'Slovenia'], SK: [24, 'Slovakia'],
  SM: [27, 'San Marino'], SO: [23, 'Somalia'], ST: [25, 'Sao Tome and Principe'], SV: [28, 'El Salvador'], TL: [23, 'Timor-Leste'], TN: [24, 'Tunisia'],
  TR: [26, 'Turkey'], UA: [29, 'Ukraine'], VA: [22, 'Vatican City'], VG: [24, 'British Virgin Islands'], XK: [20, 'Kosovo'], YE: [30, 'Yemen'],
}

/** ISO 7064 MOD 97-10 on the rearranged IBAN: letters become 10 to 35. */
export function ibanMod97(iban: string): number {
  const moved = iban.slice(4) + iban.slice(0, 4)
  let r = 0
  for (const c of moved) {
    const v = c >= 'A' ? String(c.charCodeAt(0) - 55) : c
    for (const d of v) r = (r * 10 + Number(d)) % 97
  }
  return r
}

export interface IbanCheck {
  iban: string
  country: string
  valid: boolean
  problems: string[]
  checkDigits: string
  bban: string
}

export function checkIban(input: string): IbanCheck {
  const iban = input.replace(/^IBAN\s*/i, '').replace(/[\s-]/g, '').toUpperCase()
  const problems: string[] = []
  const cc = iban.slice(0, 2)
  const spec = IBAN_LENGTHS[cc]
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) problems.push('An IBAN starts with two letters and two digits, followed by letters and digits.')
  if (!spec) problems.push(`${cc} is not a country that uses IBANs.`)
  else if (iban.length !== spec[0]) problems.push(`${spec[1]} IBANs have ${spec[0]} characters; this one has ${iban.length}.`)
  if (problems.length === 0 && ibanMod97(iban) !== 1) problems.push('The check digits do not match. A character is wrong or two are swapped.')
  return { iban, country: spec?.[1] ?? cc, valid: problems.length === 0, problems, checkDigits: iban.slice(2, 4), bban: iban.slice(4) }
}

/** The correct check digits for an IBAN with any digits in places 3 and 4. */
export function ibanCheckDigits(iban: string): string {
  const r = ibanMod97(`${iban.slice(0, 2)}00${iban.slice(4)}`)
  return String(98 - r).padStart(2, '0')
}

export const formatIban = (iban: string) => iban.replace(/(.{4})(?=.)/g, '$1 ')

/* ── hash identification ── */

export function identifyHash(input: string): { name: string; note: string }[] {
  const h = input.trim()
  const out: { name: string; note: string }[] = []
  const add = (name: string, note: string) => out.push({ name, note })
  if (/^\$2[abxy]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(h)) add('bcrypt', `Cost ${h.slice(4, 6)}: 2^${Number(h.slice(4, 6))} rounds.`)
  else if (/^\$argon2(id|i|d)\$/.test(h)) add(`Argon2${h.split('$')[1].slice(6)}`, (/m=\d+,t=\d+,p=\d+/.exec(h) ?? [''])[0].replace(/,/g, ', '))
  else if (/^\$scrypt\$|^\$7\$/.test(h)) add('scrypt', 'Modular crypt format.')
  else if (/^\$6\$/.test(h)) add('SHA-512 crypt', 'Linux /etc/shadow default on many systems.')
  else if (/^\$5\$/.test(h)) add('SHA-256 crypt', 'Unix crypt with SHA-256.')
  else if (/^\$y\$/.test(h)) add('yescrypt', 'Default in some recent Linux distributions.')
  else if (/^\$1\$/.test(h)) add('MD5 crypt', 'Old Unix crypt. Weak.')
  else if (/^\$apr1\$/.test(h)) add('APR1 MD5', 'htpasswd MD5 format. Weak.')
  else if (/^\$pbkdf2-sha(1|256|512)\$/.test(h)) add(`PBKDF2-SHA${h.split('$')[1].slice(11)}`, 'Modular crypt format.')
  else if (/^pbkdf2_sha256\$\d+\$/.test(h)) add('PBKDF2-SHA256', 'Web framework format: iterations, salt, hash.')
  else if (/^\{SHA\}[A-Za-z0-9+/]{27}=$/.test(h)) add('SHA-1 (Base64)', 'htpasswd {SHA} format. Unsalted.')
  else if (/^\{SSHA\}/.test(h)) add('Salted SHA-1', 'LDAP {SSHA} format.')
  else if (/^eyJ[\w-]*\.eyJ[\w-]*\.[\w-]*$/.test(h)) add('JSON Web Token', 'Not a hash. Decode it with the JWT decoder.')
  else if (/^[a-f0-9]+$/i.test(h)) {
    const byLength: Record<number, [string, string][]> = {
      8: [['CRC-32', 'Checksum, not a security hash'], ['Adler-32', 'Checksum'], ['xxHash32', 'Fast non-cryptographic hash']],
      16: [['xxHash64 or xxHash3', 'Fast non-cryptographic hash'], ['CRC-64', 'Checksum'], ['Old 16-digit database password hash', 'Obsolete']],
      32: [['MD5', 'Most likely. Broken for security'], ['NTLM', 'Windows password hash (MD4 of UTF-16LE)'], ['MD4', 'Broken'], ['xxHash128', 'Fast non-cryptographic hash']],
      40: [['SHA-1', 'Most likely. Broken for signatures'], ['RIPEMD-160', 'Used in some address formats'], ['Double SHA-1', 'Some databases store passwords this way, with a leading *']],
      56: [['SHA-224', 'SHA-2 family'], ['SHA3-224', 'SHA-3 family']],
      64: [['SHA-256', 'Most likely'], ['SHA3-256', 'SHA-3 family'], ['Keccak-256', 'Used by some blockchains'], ['BLAKE2s-256 or BLAKE3', 'Fast modern hashes'], ['SM3', 'Chinese national standard']],
      96: [['SHA-384', 'SHA-2 family'], ['SHA3-384', 'SHA-3 family']],
      128: [['SHA-512', 'Most likely'], ['SHA3-512', 'SHA-3 family'], ['BLAKE2b-512', 'Fast modern hash'], ['Whirlpool', '512-bit hash']],
    }
    for (const [n, note] of byLength[h.length] ?? []) add(n, note)
  } else if (/^\*[A-F0-9]{40}$/i.test(h)) add('Double SHA-1 database password', 'SHA-1 of SHA-1, unsalted, with a leading *.')
  else if (/^[A-Za-z0-9+/]+=*$/.test(h)) {
    const bytes = Math.floor((h.replace(/=+$/, '').length * 3) / 4)
    const names: Record<number, string> = { 16: 'MD5', 20: 'SHA-1', 28: 'SHA-224', 32: 'SHA-256', 48: 'SHA-384', 64: 'SHA-512' }
    if (names[bytes]) add(`${names[bytes]} (Base64)`, `${bytes} bytes encoded as Base64.`)
  }
  return out
}

export interface CardCheck {
  masked: string
  network: string
  length: number
  luhn: boolean
  valid: boolean
  problems: string[]
}

/** Network by number range, length for that network, and the Luhn check digit. */
export function validateCard(input: string): CardCheck {
  const digits = input.replace(/[\s-]/g, '')
  const problems: string[] = []
  if (!/^\d+$/.test(digits)) problems.push('A card number has only digits, spaces and dashes.')
  const net = networkOf(digits)
  const luhn = /^\d+$/.test(digits) && luhnValid(digits)
  if (!net) problems.push('The first digits do not belong to a known card network.')
  else if (!net.lengths.includes(digits.length)) problems.push(`${net.name} numbers have ${net.lengths.join(', ')} digits; this one has ${digits.length}.`)
  if (/^\d+$/.test(digits) && !luhn) problems.push('The check digit is wrong (Luhn check fails). A digit is mistyped.')
  const masked = digits.length > 10 ? `${digits.slice(0, 6)}${'•'.repeat(digits.length - 10)}${digits.slice(-4)}` : digits
  return { masked: masked.replace(/(.{4})(?=.)/g, '$1 '), network: net?.name ?? 'Unknown', length: digits.length, luhn, valid: problems.length === 0, problems }
}
