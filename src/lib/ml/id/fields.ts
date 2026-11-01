/**
 * Finds the fields of an identity document in OCR lines of its visual zone.
 * Pure functions; the OCR, the machine-readable zone (./mrz.ts) and the
 * face and signature detectors run elsewhere.
 *
 *   findFields(lines, mrz) -> FoundField[]   boxes in image pixels
 *
 * With a valid zone, its values are looked up on the card: the document and
 * personal numbers (also when the card prints them with spaces), the birth
 * and expiry dates in any common print format, and the name. Without one,
 * labels are used ("Passport No.", "Date of birth", the numbered fields of
 * EU driving licences) and then the shapes of dates and ID numbers.
 */
import type { Mrz } from './mrz'
import { mrzDate } from './mrz'

export type FieldId = 'mrz' | 'documentNumber' | 'personalNumber' | 'birthDate' | 'expiryDate' | 'issueDate' | 'name' | 'address' | 'signature' | 'portrait'

export const FIELDS: readonly { id: FieldId; name: string; defaultOn: boolean }[] = [
  { id: 'mrz', name: 'Machine-readable zone', defaultOn: true },
  { id: 'documentNumber', name: 'Document number', defaultOn: true },
  { id: 'personalNumber', name: 'Personal number', defaultOn: true },
  { id: 'birthDate', name: 'Date of birth', defaultOn: true },
  { id: 'signature', name: 'Signature', defaultOn: true },
  { id: 'address', name: 'Address', defaultOn: true },
  { id: 'expiryDate', name: 'Expiry date', defaultOn: false },
  { id: 'issueDate', name: 'Issue date', defaultOn: false },
  { id: 'name', name: 'Name', defaultOn: false },
  { id: 'portrait', name: 'Photo', defaultOn: false },
]

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** The OCR line shape this module needs (src/lib/ml/ocr groupLines output). */
export interface Line {
  text: string
  /** Offset of each word in `text`. */
  starts: number[]
  words: Rect[]
}

export interface FoundField {
  field: FieldId
  rects: Rect[]
  value: string
}

const MONTHS: Record<string, number> = {}
;[
  ['JAN', 'JANV', 'ENE', 'GEN', 'JÄN'],
  ['FEB', 'FEV', 'FÉV', 'FEBR'],
  ['MAR', 'MARS', 'MÄR', 'MRZ'],
  ['APR', 'AVR', 'ABR', 'APRIL'],
  ['MAY', 'MAI', 'MAG', 'MEI', 'MAIO'],
  ['JUN', 'JUIN', 'GIU', 'JUNI'],
  ['JUL', 'JUIL', 'LUG', 'JULI'],
  ['AUG', 'AOUT', 'AOÛT', 'AGO', 'AGOSTO'],
  ['SEP', 'SEPT', 'SET'],
  ['OCT', 'OKT', 'OTT', 'OUT'],
  ['NOV'],
  ['DEC', 'DEZ', 'DIC', 'DIS', 'DÉC'],
].forEach((names, i) => names.forEach((n) => (MONTHS[n] = i + 1)))

const MONTH = `(${Object.keys(MONTHS).join('|')})`
const SEP = '[ .\\-/]{1,3}'
const DATE_RES = [
  // 12 AUG/AOUT 74, 12 AUG 1974
  new RegExp(`\\b(\\d{1,2})${SEP}${MONTH}(?:\\s*/\\s*${MONTH})?\\.?${SEP}(\\d{2}|\\d{4})\\b`, 'giu'),
  // 12.08.1974, 12/08/74, 12 08 1974
  /\b(\d{1,2})[ .\-/](\d{1,2})[ .\-/](\d{4}|\d{2})\b/g,
  // 1974-08-12
  /\b(\d{4})-(\d{2})-(\d{2})\b/g,
]

interface DateHit {
  start: number
  end: number
  yymmdd: string
}

function yy(year: string): string {
  return year.slice(-2).padStart(2, '0')
}

function datesIn(text: string): DateHit[] {
  const out: DateHit[] = []
  const add = (start: number, end: number, y: string, m: number, d: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return
    if (out.some((h) => h.start < end && start < h.end)) return
    out.push({ start, end, yymmdd: `${yy(y)}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}` })
  }
  for (const m of text.matchAll(DATE_RES[0])) add(m.index, m.index + m[0].length, m[4], MONTHS[m[2].toUpperCase()], Number(m[1]))
  for (const m of text.matchAll(DATE_RES[2])) add(m.index, m.index + m[0].length, m[1], Number(m[2]), Number(m[3]))
  for (const m of text.matchAll(DATE_RES[1])) add(m.index, m.index + m[0].length, m[3], Number(m[2]), Number(m[1]))
  return out
}

/** Boxes of the words of `line` touched by [start, end). */
function rangeRects(line: Line, start: number, end: number): Rect[] {
  const out: Rect[] = []
  line.words.forEach((w, i) => {
    const a = line.starts[i]
    const b = i + 1 < line.starts.length ? line.starts[i + 1] - 1 : line.text.length
    if (b > start && a < end) out.push(w)
  })
  if (out.length < 2) return out
  const x = Math.min(...out.map((r) => r.x))
  const y = Math.min(...out.map((r) => r.y))
  return [{ x, y, w: Math.max(...out.map((r) => r.x + r.w)) - x, h: Math.max(...out.map((r) => r.y + r.h)) - y }]
}

const compact = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Differences between two strings of equal length, or Infinity. */
function mismatches(a: string, b: string): number {
  if (a.length !== b.length) return Infinity
  let n = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++
  return n
}

/** Runs of 1 to 4 neighbouring words whose letters and digits equal `target` (one OCR slip allowed for long values). */
function findValue(lines: readonly Line[], target: string): { line: Line; start: number; end: number } | null {
  const want = compact(target)
  if (want.length < 4) return null
  const slack = want.length >= 8 ? 1 : 0
  for (const line of lines) {
    for (let i = 0; i < line.words.length; i++) {
      let joined = ''
      for (let j = i; j < Math.min(line.words.length, i + 4); j++) {
        const end = j + 1 < line.starts.length ? line.starts[j + 1] - 1 : line.text.length
        joined = compact(line.text.slice(line.starts[i], end))
        if (mismatches(joined, want) <= slack) return { line, start: line.starts[i], end }
        if (joined.length > want.length) break
      }
    }
  }
  return null
}

const LABELS: { field: FieldId; re: RegExp }[] = [
  { field: 'birthDate', re: /\b(birth|naissance|geburt|nacimiento|nascita|geboorte|DOB)\b/i },
  { field: 'expiryDate', re: /\b(expiry|expiration|expires|valid until|gültig bis|vencimiento|scadenza|vervaldatum)\b/i },
  { field: 'issueDate', re: /\b(issue|délivrance|ausstellung|expedición|rilascio|afgifte)\b/i },
  { field: 'documentNumber', re: /\b(passport|document|card|licen[cs]e|permit|pass)\s*(no|nr|number|n°|num)\b|\bdoc(ument)?\.?\s*no\b/i },
  { field: 'personalNumber', re: /\b(personal|national|identity|social)\s*(no|nr|number|n°|code)\b|\bNIN\b|\bPIN\b/i },
  { field: 'address', re: /\b(address|adresse|anschrift|domicilio|indirizzo|adres)\b/i },
]

/** EU driving licence numbering: 3 birth, 4a issue, 4b expiry, 5 number, 8 address. */
const EU_DL: Record<string, FieldId> = { '3': 'birthDate', '4a': 'issueDate', '4b': 'expiryDate', '5': 'documentNumber', '8': 'address' }

/** Values sit right of a label (after its punctuation) or on the nearest line below that starts under it. */
function valueNear(lines: readonly Line[], li: number, labelEnd: number, needDigit: boolean): { line: Line; start: number; end: number } | null {
  const line = lines[li]
  const rest = line.text.slice(labelEnd)
  const value = rest.replace(/^[\s:./]+(?:[\p{L}.° ]{0,24}?[:])?\s*/u, '')
  if (value && (needDigit ? /\d/.test(value) : /\p{L}{3,}/u.test(value)) && !/^[\p{Ll}]/u.test(value)) {
    return { line, start: line.text.length - value.length, end: line.text.length }
  }
  const label = line.words[0]
  if (!label) return null
  const lx = Math.min(...line.words.map((w) => w.x))
  const below = lines
    .filter((l) => l !== line && l.words[0] && l.words[0].y > label.y + label.h * 0.5 && l.words[0].y - (label.y + label.h) < label.h * 2.5)
    .filter((l) => Math.abs(Math.min(...l.words.map((w) => w.x)) - lx) < label.h * 2)
    .sort((a, b) => a.words[0].y - b.words[0].y)[0]
  if (!below) return null
  return { line: below, start: 0, end: below.text.length }
}

export function findFields(lines: readonly Line[], mrz: Mrz | null): FoundField[] {
  const out: FoundField[] = []
  const add = (field: FieldId, hit: { line: Line; start: number; end: number } | null) => {
    if (!hit) return
    const rects = rangeRects(hit.line, hit.start, hit.end)
    const value = hit.line.text.slice(hit.start, hit.end)
    if (rects.length && !out.some((f) => f.field === field && f.value === value)) out.push({ field, rects, value })
  }

  if (mrz) {
    add('documentNumber', findValue(lines, mrz.documentNumber.value))
    if (mrz.optional.value.replace(/\s/g, '').length >= 4) add('personalNumber', findValue(lines, mrz.optional.value))
    for (const name of [...mrz.surname.split(' '), ...mrz.givenNames.split(' ')]) add('name', findValue(lines, name))
  }

  // Dates: by the zone's values, then by labels, then the earliest year is the birth date.
  const birth = mrz ? mrz.birthDate.value : ''
  const expiry = mrz ? mrz.expiryDate.value : ''
  const loose: { line: Line; hit: DateHit; label: FieldId | null }[] = []
  lines.forEach((line, li) => {
    const prev = lines[li - 1]
    const own = LABELS.find((l) => l.re.test(line.text) && l.field.endsWith('Date'))?.field ?? null
    const above = prev ? (LABELS.find((l) => l.re.test(prev.text) && l.field.endsWith('Date'))?.field ?? null) : null
    const dl = /^\s*(\d[a-d]?)\.\s/.exec(line.text)
    for (const hit of datesIn(line.text)) {
      const field: FieldId | null = hit.yymmdd === birth ? 'birthDate' : hit.yymmdd === expiry ? 'expiryDate' : (dl && EU_DL[dl[1]]) || own || above
      if (field) add(field, { line, start: hit.start, end: hit.end })
      else loose.push({ line, hit, label: null })
    }
  })
  if (loose.length) {
    const has = (f: FieldId) => out.some((o) => o.field === f)
    const byYear = [...loose].sort((a, b) => fullYear(a.hit.yymmdd) - fullYear(b.hit.yymmdd))
    for (const [i, d] of byYear.entries()) {
      const field: FieldId = i === 0 && !has('birthDate') ? 'birthDate' : i === byYear.length - 1 && !has('expiryDate') ? 'expiryDate' : 'issueDate'
      add(field, { line: d.line, start: d.hit.start, end: d.hit.end })
    }
  }

  // Labelled values without a zone (and the EU licence numbers).
  lines.forEach((line, li) => {
    const dl = /^\s*(\d[a-d]?)\.\s*/.exec(line.text)
    const dlField = dl ? EU_DL[dl[1]] : undefined
    if (dlField === 'documentNumber' || dlField === 'address') add(dlField, { line, start: dl![0].length, end: line.text.length })
    for (const l of LABELS) {
      if (l.field.endsWith('Date') || out.some((o) => o.field === l.field)) continue
      const m = l.re.exec(line.text)
      if (!m) continue
      const v = valueNear(lines, li, m.index + m[0].length, l.field !== 'address')
      if (!v) continue
      if (l.field !== 'address' && !/\d/.test(v.line.text.slice(v.start, v.end))) continue
      if (l.field === 'address') {
        add('address', v)
        const next = lines[lines.indexOf(v.line) + 1]
        if (next && /\d/.test(next.text) && !LABELS.some((x) => x.re.test(next.text))) add('address', { line: next, start: 0, end: next.text.length })
      } else add(l.field, v)
    }
  })
  return out
}

function fullYear(yymmdd: string): number {
  return mrzDate(yymmdd, 'birth')?.year ?? 0
}
