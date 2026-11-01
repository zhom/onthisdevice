/**
 * Replacement text for detected spans: [NAME], [NAME 1], a block of squares,
 * or a consistent fake value (the same input always gets the same output
 * within one session).
 */
import type { Faker } from '@faker-js/faker'
import { luhn } from './checks'
import { TYPE_BY_ID } from './types'
import type { EntityType, Span } from './types'

export type MaskMode = 'label' | 'numbered' | 'block' | 'fake'

export const MASK_MODES: { id: MaskMode; name: string; example: string }[] = [
  { id: 'label', name: 'Label', example: '[NAME]' },
  { id: 'numbered', name: 'Numbered label', example: '[NAME 1]' },
  { id: 'block', name: 'Block', example: '■■■■■' },
  { id: 'fake', name: 'Fake values', example: 'Laura Smith' },
]

const BLOCK = '■■■■■'

export function tagOf(span: Span): string {
  if (span.source === 'list') return 'HIDDEN'
  return TYPE_BY_ID[span.type]?.tag ?? span.type
}

/** Loads the English fake data generator (about 300 KB) on first use. */
let fakerPromise: Promise<Faker> | null = null
export function loadFaker(): Promise<Faker> {
  fakerPromise ??= import('@faker-js/faker/locale/en').then((m) => m.faker)
  return fakerPromise
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** A random generator that does not depend on Math.random state elsewhere. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Replaces each digit and letter with a random one of the same kind, keeping separators. */
function sameShape(value: string, rand: () => number): string {
  let out = ''
  for (const ch of value) {
    if (/\d/.test(ch)) out += String(Math.floor(rand() * 10))
    else if (/[A-Z]/.test(ch)) out += String.fromCharCode(65 + Math.floor(rand() * 26))
    else if (/[a-z]/.test(ch)) out += String.fromCharCode(97 + Math.floor(rand() * 26))
    else out += ch
  }
  return out
}

function fakeCard(value: string, rand: () => number): string {
  const digits = value.replace(/\D/g, '')
  // Test card ranges: 4000 00.. is never issued to a real account.
  let body = '400000'
  while (body.length < digits.length - 1) body += String(Math.floor(rand() * 10))
  for (let d = 0; d < 10; d++) {
    if (luhn(body + d)) {
      body += d
      break
    }
  }
  let i = 0
  return value.replace(/\d/g, () => body[i++] ?? '0')
}

/** A random valid date in the same format: separators, order and month names stay. */
function fakeDate(value: string, rand: () => number): string {
  const day = 1 + Math.floor(rand() * 28)
  const month = 1 + Math.floor(rand() * 12)
  const pad = (n: number, w: number) => String(n).padStart(w, '0')
  // ISO: 1987-03-14 (with an optional time, kept as is)
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (iso) {
    const year = Number(iso[1]) + Math.floor(rand() * 21) - 10
    return `${year}-${pad(month, 2)}-${pad(day, 2)}${value.slice(10)}`
  }
  // Numeric with the year last: 14/03/1987, 3.4.87
  const num = /^(\d{1,2})([/.-])(\d{1,2})\2(\d{2}|\d{4})$/.exec(value)
  if (num) {
    const y = num[4]
    const year = y.length === 4 ? Number(y) + Math.floor(rand() * 21) - 10 : (Number(y) + Math.floor(rand() * 21) + 90) % 100
    return `${pad(day, num[1].length)}${num[2]}${pad(month, num[3].length)}${num[2]}${pad(year, y.length)}`
  }
  // Text dates: change the day and the year, keep the month name.
  let first = true
  return value.replace(/\d+/g, (d) => {
    if (d.length === 4) return String(Number(d) + Math.floor(rand() * 21) - 10)
    if (first) {
      first = false
      return pad(day, d.length)
    }
    return d
  })
}

/** Random digits in the same layout; a leading + or 0 and the country code stay. */
function fakePhone(value: string, rand: () => number): string {
  const keep = /^(?:\+\d{1,3}|00\d{1,3}|0)/.exec(value)?.[0] ?? ''
  return keep + sameShape(value.slice(keep.length), rand)
}

const NAME_TITLES = /^(?:mr|mrs|ms|miss|mx|dr|prof|sir|dame|herr|frau|mme|mlle|sr|sra|srta)\.?$/i

/**
 * Consistent replacements for one document or session. Names are replaced
 * part by part, so "Anna Berg", "Anna" and "Ms Berg" become "Laura Smith",
 * "Laura" and "Ms Smith".
 */
export class Replacer {
  private numbers = new Map<string, Map<string, number>>()
  private fakes = new Map<string, string>()
  private firstNames = new Map<string, string>()
  private lastNames = new Map<string, string>()
  private usedFakes = new Set<string>()
  private rand: () => number
  private faker: Faker | null

  constructor(faker: Faker | null = null, seed = Math.floor(Math.random() * 2 ** 31)) {
    this.faker = faker
    this.rand = seeded(seed)
    faker?.seed(seed)
  }

  setFaker(faker: Faker) {
    this.faker = faker
  }

  /** Number for a value of a type, starting at 1, stable for the session. */
  number(tag: string, value: string): number {
    let map = this.numbers.get(tag)
    if (!map) {
      map = new Map()
      this.numbers.set(tag, map)
    }
    const key = normalize(value)
    let n = map.get(key)
    if (n === undefined && tag === 'NAME') {
      // "Smith" after "John Smith" gets John Smith's number.
      const parts = key.split(' ')
      for (const [k, v] of map) {
        const kp = k.split(' ')
        if (parts.length === 1 ? kp.includes(parts[0]) : kp.length === 1 && parts.includes(kp[0])) {
          n = v
          break
        }
      }
    }
    if (n === undefined) n = map.size + 1
    map.set(key, n)
    return n
  }

  private unique(make: () => string): string {
    for (let i = 0; i < 20; i++) {
      const v = make()
      if (!this.usedFakes.has(v)) {
        this.usedFakes.add(v)
        return v
      }
    }
    return make()
  }

  /** A fake person name with the same number of parts as the original. */
  fakeName(original: string): string {
    const f = this.faker
    if (!f) return `[NAME ${this.number('NAME', original)}]`
    const parts = original.trim().split(/\s+/)
    const words = parts.filter((p) => !NAME_TITLES.test(p))
    const out: string[] = []
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (NAME_TITLES.test(p)) {
        out.push(p)
        continue
      }
      const key = normalize(p.replace(/[’']s$/, ''))
      const isLast = words.length > 1 && p === words[words.length - 1]
      const isFirst = p === words[0] && words.length > 1
      const titled = i > 0 && NAME_TITLES.test(parts[i - 1])
      let fake: string
      if (this.lastNames.has(key)) fake = this.lastNames.get(key)!
      else if (this.firstNames.has(key)) fake = this.firstNames.get(key)!
      else if (isLast || titled) {
        fake = this.unique(() => f.person.lastName())
        this.lastNames.set(key, fake)
      } else if (isFirst || words.length === 1) {
        fake = this.unique(() => f.person.firstName())
        this.firstNames.set(key, fake)
      } else {
        fake = this.unique(() => f.person.firstName())
        this.firstNames.set(key, fake)
      }
      if (/[’']s$/.test(p)) fake += p.slice(-2)
      if (p === p.toUpperCase() && p.length > 1) fake = fake.toUpperCase()
      else if (p === p.toLowerCase()) fake = fake.toLowerCase()
      out.push(fake)
    }
    return out.join(' ')
  }

  /** A fake first or last name for a single-name cell, shared with full names that use it. */
  fakePart(original: string, part: 'first' | 'last'): string {
    const f = this.faker
    const key = normalize(original)
    if (!f || !key) return original
    const map = part === 'first' ? this.firstNames : this.lastNames
    let fake = map.get(key)
    if (!fake) {
      fake = this.unique(() => (part === 'first' ? f.person.firstName() : f.person.lastName()))
      map.set(key, fake)
    }
    return original === original.toUpperCase() && original.length > 1 ? fake.toUpperCase() : fake
  }

  /** A fake value of the same type, the same every time for the same input. */
  fake(type: EntityType, original: string): string {
    const key = `${type}:${normalize(original)}`
    const hit = this.fakes.get(key)
    if (hit) return hit
    const f = this.faker
    const r = this.rand
    let v: string
    switch (type) {
      case 'PERSON':
        v = this.fakeName(original)
        break
      case 'EMAIL':
        v = f ? f.internet.email({ provider: 'example.com' }).toLowerCase() : `user${this.number('EMAIL', original)}@example.com`
        break
      case 'USERNAME':
        v = (original.startsWith('@') ? '@' : '') + (f ? f.internet.username().toLowerCase() : `user${this.number('USERNAME', original)}`)
        break
      case 'ORG':
        v = f ? f.company.name() : `Company ${this.number('ORG', original)}`
        break
      case 'LOCATION':
        v = f ? f.location.city() : `City ${this.number('LOCATION', original)}`
        break
      case 'ADDRESS':
        // A piece without a number is the town part of an address.
        if (!/\d/.test(original)) v = f ? f.location.city() : `City ${this.number('LOCATION', original)}`
        else v = f ? f.location.streetAddress() : `${this.number('ADDRESS', original)} Example Street`
        break
      case 'URL':
        v = `https://example.com/${this.number('URL', original)}`
        break
      case 'IP':
        v = original.includes(':') ? `2001:db8::${this.number('IP', original).toString(16)}` : `203.0.113.${this.number('IP', original) % 255}`
        break
      case 'CARD':
        v = fakeCard(original, r)
        break
      case 'DATE':
      case 'DOB':
        v = fakeDate(original, r)
        break
      case 'PHONE':
        v = fakePhone(original, r)
        break
      case 'SECRET':
        v = '[SECRET]'
        break
      case 'PRODUCT':
        v = f ? f.commerce.productName() : `Product ${this.number('PRODUCT', original)}`
        break
      default:
        v = sameShape(original, r)
    }
    this.fakes.set(key, v)
    return v
  }

  /** The replacement for one span. */
  replace(span: Span, original: string, mode: MaskMode): string {
    const tag = tagOf(span)
    switch (mode) {
      case 'label':
        return `[${tag}]`
      case 'numbered':
        return `[${tag} ${this.number(tag, original)}]`
      case 'block':
        return BLOCK
      case 'fake':
        if (span.source === 'list') return `[${tag} ${this.number(tag, original)}]`
        return this.fake(span.type, original)
    }
  }
}

export interface Piece {
  /** Index into the spans array, or -1 for plain text. */
  span: number
  text: string
  original: string
}

/** Splits text into plain and replaced pieces, for display and for the output string. */
export function applySpans(
  text: string,
  spans: Span[],
  replace: (span: Span, original: string) => string,
  kept?: ReadonlySet<number>,
): { output: string; pieces: Piece[] } {
  const pieces: Piece[] = []
  const out: string[] = []
  let at = 0
  spans.forEach((s, i) => {
    if (s.start < at) return
    if (s.start > at) {
      const plain = text.slice(at, s.start)
      pieces.push({ span: -1, text: plain, original: plain })
      out.push(plain)
    }
    const original = text.slice(s.start, s.end)
    const shown = kept?.has(i) ? original : replace(s, original)
    pieces.push({ span: i, text: shown, original })
    out.push(shown)
    at = s.end
  })
  if (at < text.length) {
    const plain = text.slice(at)
    pieces.push({ span: -1, text: plain, original: plain })
    out.push(plain)
  }
  return { output: out.join(''), pieces }
}

/** applySpans with one of the standard replacement styles. */
export function maskSpans(text: string, spans: Span[], mode: MaskMode, replacer: Replacer, kept?: ReadonlySet<number>) {
  return applySpans(text, spans, (s, o) => replacer.replace(s, o, mode), kept)
}
