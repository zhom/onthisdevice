/**
 * Machine-readable zone (ICAO Doc 9303): format detection, field parsing and
 * check digits, with repair of common OCR confusions.
 *
 *   parseMrz(lines) -> Mrz | null
 *     lines: OCR lines of the zone, top to bottom (other lines are ignored)
 *     TD3 (passports, 2 x 44), TD2 (2 x 36), TD1 (ID cards, 3 x 30),
 *     MRV-A / MRV-B visas (2 x 44 / 2 x 36, first letter V)
 *   checkDigit(s)  7-3-1 weights; digits as is, A-Z = 10..35, < = 0
 *
 * A field whose check digit fails is retried with letters read as digits
 * (O->0, I->1, ...) in numeric places, and with one letter/digit swap in the
 * document number. `valid` is true only when every check digit of the format
 * passes, the composite included. A swap can still turn a misread number into
 * another one that passes by chance (about 1 in 100), and L and 1 weigh the
 * same in the check (20 apart), so the value is a hint for finding the field
 * on the card, not proof.
 */

export type MrzFormat = 'TD1' | 'TD2' | 'TD3' | 'MRVA' | 'MRVB'

export interface MrzField<T = string> {
  value: T
  /** Check digit passed (or the field has none). */
  ok: boolean
}

export interface Mrz {
  format: MrzFormat
  /** The zone as read, after repairs: one string per line. */
  lines: string[]
  documentCode: string
  issuer: string
  surname: string
  givenNames: string
  documentNumber: MrzField
  nationality: string
  /** YYMMDD */
  birthDate: MrzField
  sex: string
  /** YYMMDD */
  expiryDate: MrzField
  /** Personal number (TD3) or optional data (TD1, TD2), without fillers. */
  optional: MrzField
  /** Composite check digit (not on visas). */
  composite: boolean
  valid: boolean
}

function value(c: string): number {
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55
  return 0
}

export function checkDigit(s: string): number {
  const w = [7, 3, 1]
  let sum = 0
  for (let i = 0; i < s.length; i++) sum += value(s[i]) * w[i % 3]
  return sum % 10
}

const TO_DIGIT: Record<string, string> = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', T: '1', Z: '2', B: '8', S: '5', G: '6', A: '4', E: '8' }
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '6': 'G', '8': 'B', '4': 'A' }

function digits(s: string): string {
  return [...s].map((c) => TO_DIGIT[c] ?? c).join('')
}

function letters(s: string): string {
  return [...s].map((c) => TO_LETTER[c] ?? c).join('')
}

/** Only the classic OCR confusions: a wider set makes a wrong number pass by chance. */
const SWAP: Record<string, string[]> = {
  O: ['0'],
  '0': ['O', 'D'],
  D: ['0'],
  I: ['1'],
  '1': ['I', 'L'],
  L: ['1'],
  S: ['5'],
  '5': ['S'],
  B: ['8'],
  '8': ['B'],
  Z: ['2'],
  '2': ['Z'],
}

const ok = (field: string, digit: string) => /^\d$/.test(digit) && checkDigit(field) === Number(digit)

/**
 * A field with its check digit. The digit is always numeric; the field is
 * tried as read, then with the numeric-looking repair when `numeric`.
 * Document numbers mix letters and digits, so only single swaps are tried.
 */
function checked(field: string, digit: string, numeric: boolean): MrzField {
  const d = digits(digit)
  if (ok(field, d)) return { value: field, ok: true }
  if (numeric) {
    const f = digits(field)
    return { value: f, ok: ok(f, d) }
  }
  for (let i = 0; i < field.length; i++) {
    const c = field[i]
    for (const alt of SWAP[c] ?? []) {
      if (!alt) continue
      const f = field.slice(0, i) + alt + field.slice(i + 1)
      if (ok(f, d)) return { value: f, ok: true }
    }
  }
  return { value: field, ok: false }
}

function clean(line: string): string {
  return line
    .toUpperCase()
    .replace(/[«‹(\[{]/g, '<')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9<]/g, '')
}

const names = (s: string) => {
  const [sur, ...rest] = letters(s).split('<<')
  const tidy = (x: string) => x.replace(/<+/g, ' ').trim()
  return { surname: tidy(sur ?? ''), givenNames: tidy(rest.join(' ')) }
}

const strip = (s: string) => s.replace(/<+$/g, '').replace(/</g, ' ').trim()

/** Fits OCR text to the expected length: pads with fillers or drops the extra end. */
function fit(line: string, len: number): string {
  return line.length >= len ? line.slice(0, len) : line + '<'.repeat(len - line.length)
}

function guessFormat(lines: string[]): { format: MrzFormat; lines: string[] } | null {
  // OCR often drops fillers at the end of a line, so a line may be short; the dense lines
  // (TD1 lines 1-2, TD2/TD3 line 2) decide the format.
  const cand = lines.map(clean).filter((l) => l.length >= 18 && /</.test(l))
  const near = (l: string, n: number, d: number) => Math.abs(l.length - n) <= d
  for (let i = 0; i + 2 < cand.length; i++) {
    const [a, b, c] = cand.slice(i, i + 3)
    if (near(a, 30, 3) && near(b, 30, 3) && c.length <= 33 && /^[AIC]/.test(a)) return { format: 'TD1', lines: [a, b, c].map((l) => fit(l, 30)) }
  }
  for (let i = 0; i + 1 < cand.length; i++) {
    const [a, b] = cand.slice(i, i + 2)
    const len = near(b, 44, 3) && a.length <= 47 ? 44 : near(b, 36, 3) && a.length <= 39 ? 36 : 0
    if (!len || !/^[A-Z]/.test(a)) continue
    const visa = a[0] === 'V'
    const format: MrzFormat = len === 44 ? (visa ? 'MRVA' : 'TD3') : visa ? 'MRVB' : 'TD2'
    return { format, lines: [fit(a, len), fit(b, len)] }
  }
  return null
}

/** Check digits that pass, for choosing between repairs. */
function score(m: Mrz): number {
  return [m.documentNumber.ok, m.birthDate.ok, m.expiryDate.ok, m.optional.ok, m.composite].filter(Boolean).length
}

const EXPECTED: Record<number, number> = { 30: 30, 36: 36, 44: 44 }

/**
 * Parses the zone. When a check fails and a line came out one or two
 * characters too long (OCR read a stray mark or doubled a letter), each way
 * of dropping them is tried and the reading with the most passing check
 * digits wins. Fillers read as K or L at the end of a line become fillers.
 */
export function parseMrz(rawLines: string[]): Mrz | null {
  const cleaned = rawLines.map(clean).map((l) => l.replace(/[<KL]{4,}$/, (m) => '<'.repeat(m.length)))
  const first = parseFitted(cleaned)
  if (!first || first.valid) return first
  let best = first
  cleaned.forEach((line, li) => {
    const target = [44, 36, 30].find((n) => line.length > n && line.length <= n + 2 && EXPECTED[n])
    if (!target || !line.includes('<')) return
    const extra = line.length - target
    const variants: string[] = []
    for (let a = 0; a < line.length; a++) {
      const one = line.slice(0, a) + line.slice(a + 1)
      if (extra === 1) variants.push(one)
      else for (let b = a; b < one.length; b++) variants.push(one.slice(0, b) + one.slice(b + 1))
    }
    for (const v of variants) {
      const m = parseFitted(cleaned.map((l, i) => (i === li ? v : l)))
      if (m && score(m) > score(best)) best = m
      if (best.valid) return
    }
  })
  return best
}

function parseFitted(rawLines: string[]): Mrz | null {
  const found = guessFormat(rawLines)
  if (!found) return null
  const { format, lines } = found
  if (format === 'TD1') {
    const [l1, l2, l3] = lines
    const documentNumber = checked(l1.slice(5, 14), l1[14], false)
    const birthDate = checked(l2.slice(0, 6), l2[6], true)
    const expiryDate = checked(l2.slice(8, 14), l2[14], true)
    const opt = l1.slice(15, 30) + l2.slice(18, 29)
    const composite = ok(
      documentNumber.value + digits(l1[14]) + l1.slice(15, 30) + birthDate.value + digits(l2[6]) + expiryDate.value + digits(l2[14]) + l2.slice(18, 29),
      digits(l2[29]),
    )
    const n = names(l3)
    return {
      format,
      lines: [l1, l2, l3],
      documentCode: strip(l1.slice(0, 2)),
      issuer: letters(l1.slice(2, 5)).replace(/</g, ''),
      ...n,
      documentNumber,
      nationality: letters(l2.slice(15, 18)).replace(/</g, ''),
      birthDate,
      sex: l2[7].replace('<', ''),
      expiryDate,
      optional: { value: strip(opt), ok: true },
      composite,
      valid: documentNumber.ok && birthDate.ok && expiryDate.ok && composite,
    }
  }
  const [l1, l2] = lines
  const long = format === 'TD3' || format === 'MRVA'
  const n = names(l1.slice(5))
  const documentNumber = checked(l2.slice(0, 9), l2[9], false)
  const birthDate = checked(l2.slice(13, 19), l2[19], true)
  const expiryDate = checked(l2.slice(21, 27), l2[27], true)
  const visa = format === 'MRVA' || format === 'MRVB'
  let optional: MrzField
  let composite = true
  // The composite covers the repaired fields with their check digits.
  const head = documentNumber.value + digits(l2[9]) + birthDate.value + digits(l2[19]) + expiryDate.value + digits(l2[27])
  if (format === 'TD3') {
    optional = checked(l2.slice(28, 42), l2[42], false)
    if (/^<+$/.test(l2.slice(28, 42)) && (l2[42] === '<' || l2[42] === '0')) optional = { value: l2.slice(28, 42), ok: true }
    composite = ok(head + optional.value + digits(l2[42]), digits(l2[43]))
  } else if (format === 'TD2') {
    optional = { value: l2.slice(28, 35), ok: true }
    composite = ok(head + l2.slice(28, 35), digits(l2[35]))
  } else {
    optional = { value: l2.slice(28, long ? 44 : 36), ok: true }
  }
  return {
    format,
    lines: [l1, l2],
    documentCode: strip(l1.slice(0, 2)),
    issuer: letters(l1.slice(2, 5)).replace(/</g, ''),
    ...n,
    documentNumber: { ...documentNumber, value: documentNumber.value.replace(/<+$/, '') },
    nationality: letters(l2.slice(10, 13)).replace(/</g, ''),
    birthDate,
    sex: l2[20].replace('<', ''),
    expiryDate,
    optional: { ...optional, value: strip(optional.value) },
    composite: visa ? true : composite,
    valid: documentNumber.ok && birthDate.ok && expiryDate.ok && optional.ok && (visa || composite),
  }
}

/** YYMMDD to a full year: birth dates are in the past, expiry dates up to 30 years ahead. */
export function mrzDate(yymmdd: string, kind: 'birth' | 'expiry', today = new Date()): { year: number; month: number; day: number } | null {
  if (!/^\d{6}$/.test(yymmdd)) return null
  const yy = Number(yymmdd.slice(0, 2))
  const month = Number(yymmdd.slice(2, 4))
  const day = Number(yymmdd.slice(4, 6))
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const now = today.getFullYear() % 100
  const century = Math.floor(today.getFullYear() / 100) * 100
  const year = kind === 'birth' ? (yy > now ? century - 100 + yy : century + yy) : yy > now + 30 ? century - 100 + yy : century + yy
  return { year, month, day }
}
