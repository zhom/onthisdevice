/**
 * Column classification and cell transforms for table anonymization.
 *
 * A column is scored by its header (in several languages) and by a sample of
 * its values (formats with checksums where they exist). The result picks a
 * default action that the user can change.
 */
import { luhn, validIban } from './checks'
import { findPii, validIpv6 } from './pii-rules'
import type { EntityType } from './types'

export type ColumnKind =
  | 'full-name'
  | 'first-name'
  | 'last-name'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'postcode'
  | 'country'
  | 'birth-date'
  | 'date'
  | 'national-id'
  | 'id'
  | 'card'
  | 'iban'
  | 'ip'
  | 'url'
  | 'username'
  | 'company'
  | 'secret'
  | 'free-text'
  | 'number'
  | 'category'
  | 'other'

export type ColumnAction = 'keep' | 'mask' | 'hash' | 'fake' | 'redact' | 'drop'

export const KIND_NAMES: Record<ColumnKind, string> = {
  'full-name': 'Full name',
  'first-name': 'First name',
  'last-name': 'Last name',
  email: 'Email',
  phone: 'Phone number',
  address: 'Street address',
  city: 'City',
  postcode: 'Postcode',
  country: 'Country',
  'birth-date': 'Birth date',
  date: 'Date',
  'national-id': 'National ID',
  id: 'ID or account number',
  card: 'Card number',
  iban: 'IBAN',
  ip: 'IP address',
  url: 'Link',
  username: 'Username',
  company: 'Company',
  secret: 'Password or key',
  'free-text': 'Free text',
  number: 'Number',
  category: 'Category',
  other: 'Other',
}

export const ACTION_NAMES: Record<ColumnAction, string> = {
  keep: 'Keep',
  mask: 'Mask',
  hash: 'Hash',
  fake: 'Fake',
  redact: 'Redact inside',
  drop: 'Drop column',
}

/** Kinds that hold personal data; the rest default to keep. */
export const PERSONAL: ReadonlySet<ColumnKind> = new Set([
  'full-name', 'first-name', 'last-name', 'email', 'phone', 'address', 'postcode', 'birth-date', 'national-id', 'id',
  'card', 'iban', 'ip', 'url', 'username', 'secret', 'free-text',
])

export function defaultAction(kind: ColumnKind): ColumnAction {
  switch (kind) {
    case 'full-name':
    case 'first-name':
    case 'last-name':
    case 'email':
    case 'phone':
    case 'address':
    case 'username':
    case 'birth-date':
      return 'fake'
    case 'id':
      return 'hash'
    case 'national-id':
    case 'card':
    case 'iban':
    case 'ip':
    case 'postcode':
    case 'url':
      return 'mask'
    case 'secret':
      return 'drop'
    case 'free-text':
      return 'redact'
    default:
      return 'keep'
  }
}

/** Header patterns, checked on the lower-cased header with separators as spaces. */
const HEADER: [ColumnKind, RegExp][] = [
  ['email', /\b(?:e ?mail|mail|courriel|correo|posta elettronica)\b/],
  ['first-name', /\b(?:first ?name|given ?name|forename|fname|vorname|pr[ée]nom|nombre de pila|nome proprio|voornaam)\b/],
  ['last-name', /\b(?:last ?name|surname|family ?name|lname|nachname|nom de famille|apellidos?|cognome|achternaam)\b/],
  ['full-name', /^(?:name|full ?name|customer ?name|client ?name|contact ?name|patient ?name|employee ?name|user ?name|display ?name|owner|recipient|sender|nom|nombre|nome|naam|kundenname)$|\b(?:full ?name|contact|customer|patient|employee|person)\b(?!.*\b(?:id|number|no|count|type)\b)/],
  ['phone', /\b(?:phone|tel|telephone|mobile|cell|fax|telefon|t[ée]l[ée]phone|tel[ée]fono|cellulare|handy|whatsapp)\b/],
  ['birth-date', /\b(?:dob|birth|born|geburt|naissance|nacimiento|nascita|geboorte)/],
  ['postcode', /\b(?:zip|postcode|post code|postal|plz|cap|code postal|c[óo]digo postal|postleitzahl)\b/],
  ['address', /\b(?:address|street|addr|adresse|anschrift|stra(?:ss|ß)e|direcci[óo]n|indirizzo|rue|line ?1|line ?2)\b/],
  ['city', /\b(?:city|town|stadt|ort|ville|ciudad|citt[àa]|plaats)\b/],
  ['country', /\b(?:country|land|pays|pa[íi]s|paese|nation)\b/],
  ['national-id', /\b(?:ssn|social security|nino|national ?(?:id|insurance)|tax ?id|tin|steuer|passport|dni|nie|nif|bsn|codice fiscale|aadhaar|pan|sin|licen[cs]e)\b/],
  ['card', /\b(?:card|cc ?num|credit|pan number)\b/],
  ['iban', /\b(?:iban|bank account|account number|bic|swift|kontonummer|rib)\b/],
  ['ip', /\b(?:ip|ip ?address|ipv4|ipv6|remote addr|client ip)\b/],
  ['url', /\b(?:url|link|website|homepage|profile)\b/],
  ['username', /\b(?:username|user ?name|login|handle|nickname|screen ?name)\b/],
  ['secret', /\b(?:password|passwd|pwd|secret|token|api ?key|hash|salt)\b/],
  ['company', /\b(?:company|organi[sz]ation|employer|firma|soci[ée]t[ée]|empresa|azienda|bedrijf)\b/],
  ['free-text', /\b(?:notes?|comments?|description|message|remarks?|feedback|body|text|details|memo|summary|bemerkung|kommentar|nachricht|commentaire|observaciones|mensaje|note)\b/],
  ['id', /(?:^id$|\bid$|_id$|\b(?:account|customer|member|policy|order|invoice|patient|employee|user) ?(?:id|no|number|nr|num)\b|\buuid\b|\bguid\b)/],
]

export function headerKind(header: string): ColumnKind | null {
  const h = header
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .trim()
  // "username" before "name", "email" before "name".
  if (/\b(?:user ?name|login|handle|screen ?name)\b/.test(h)) return 'username'
  for (const [kind, re] of HEADER) if (re.test(h)) return kind
  return null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/
const URL_RE = /^(?:https?:\/\/|www\.)\S+$/i
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
const DATE = /^(?:\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+Z?)?|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})$/
const NUMBER = /^[-+]?(?:\d{1,3}(?:[,. ]\d{3})+|\d+)(?:[.,]\d+)?%?$/
const NAMEISH = /^\p{Lu}[\p{L}'’.-]+(?:\s\p{Lu}[\p{L}'’.-]+){0,3}$/u
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Kind suggested by the values alone, with the share of values that match. */
export function valueKind(values: string[]): { kind: ColumnKind; share: number } {
  const v = values.map((x) => x.trim()).filter(Boolean)
  if (v.length === 0) return { kind: 'other', share: 0 }
  const share = (test: (s: string) => boolean) => v.filter(test).length / v.length
  const checks: [ColumnKind, number][] = [
    ['email', share((s) => EMAIL.test(s))],
    ['card', share((s) => /^[\d -]{13,23}$/.test(s) && luhn(s.replace(/\D/g, '')) && s.replace(/\D/g, '').length >= 13)],
    ['iban', share((s) => validIban(s))],
    ['ip', share((s) => IPV4.test(s) || (s.includes(':') && validIpv6(s)))],
    ['url', share((s) => URL_RE.test(s))],
    ['phone', share((s) => findPii(`tel ${s}`).some((p) => p.type === 'PHONE' && p.end - p.start >= s.length - 1))],
    ['national-id', share((s) => findPii(s).some((p) => p.type === 'ID' && p.score >= 0.85 && p.end - p.start >= s.length - 1))],
    ['date', share((s) => DATE.test(s))],
    ['id', share((s) => UUID.test(s))],
  ]
  checks.sort((a, b) => b[1] - a[1])
  const [best, bestShare] = checks[0]
  if (bestShare >= 0.6) return { kind: best, share: bestShare }
  const sentences = share((s) => s.split(/\s+/).length >= 5)
  if (sentences >= 0.25) return { kind: 'free-text', share: sentences }
  if (share((s) => NUMBER.test(s)) >= 0.9) return { kind: 'number', share: 1 }
  const distinct = new Set(v).size
  if (v.length >= 20 && distinct <= Math.max(3, v.length / 10)) return { kind: 'category', share: 1 }
  const names = share((s) => NAMEISH.test(s))
  if (names >= 0.8 && v.some((s) => /\s/.test(s))) return { kind: 'full-name', share: names }
  return { kind: 'other', share: 0 }
}

/** Header first when it agrees with the values or the values say nothing; values win when they are clear. */
export function classifyColumn(header: string, values: string[]): ColumnKind {
  const byHeader = headerKind(header)
  const byValue = valueKind(values)
  if (byHeader === 'birth-date' && (byValue.kind === 'date' || byValue.kind === 'other')) return 'birth-date'
  if (byHeader === 'secret' && byValue.kind !== 'number') return 'secret'
  if (byValue.share >= 0.8 && ['email', 'card', 'iban', 'ip', 'url', 'phone'].includes(byValue.kind)) return byValue.kind
  if (byHeader) {
    // A "name" header over numbers is not a name.
    if (['full-name', 'first-name', 'last-name', 'city', 'company', 'country'].includes(byHeader) && byValue.kind === 'number') return 'number'
    if (byHeader === 'id' && byValue.kind === 'free-text') return 'free-text'
    return byHeader
  }
  return byValue.kind
}

/** Entity type used for fake values and for masking. */
export const KIND_TYPE: Partial<Record<ColumnKind, EntityType>> = {
  'full-name': 'PERSON',
  'first-name': 'PERSON',
  'last-name': 'PERSON',
  email: 'EMAIL',
  phone: 'PHONE',
  address: 'ADDRESS',
  city: 'LOCATION',
  postcode: 'POSTCODE',
  'birth-date': 'DOB',
  date: 'DATE',
  'national-id': 'ID',
  id: 'ID',
  card: 'CARD',
  iban: 'IBAN',
  ip: 'IP',
  url: 'URL',
  username: 'USERNAME',
  company: 'ORG',
  secret: 'SECRET',
}

/** Format-keeping mask: j***@e***.com, **** **** **** 1111, 1987-**-**, A*** B***. */
export function maskValue(kind: ColumnKind, value: string): string {
  const v = value
  if (!v.trim()) return v
  const stars = (s: string) => s.replace(/[\p{L}\p{N}]/gu, '*')
  switch (kind) {
    case 'email': {
      const at = v.indexOf('@')
      if (at < 1) return stars(v)
      const domain = v.slice(at + 1)
      const dot = domain.lastIndexOf('.')
      return `${v[0]}***@${domain[0] ?? ''}***${dot >= 0 ? domain.slice(dot) : ''}`
    }
    case 'card':
    case 'iban':
    case 'phone':
    case 'national-id':
    case 'id': {
      // Keep the last few characters, as receipts do.
      const keep = kind === 'card' || kind === 'iban' ? 4 : 2
      let seen = 0
      const total = (v.match(/[\p{L}\p{N}]/gu) ?? []).length
      return v.replace(/[\p{L}\p{N}]/gu, (c) => (++seen > total - keep ? c : '*'))
    }
    case 'birth-date':
    case 'date': {
      const year = /\b(?:19|20)\d{2}\b/.exec(v)
      return year ? v.replace(/\d/g, '*').replace(/\*{4}/, year[0]) : stars(v)
    }
    case 'full-name':
    case 'first-name':
    case 'last-name':
    case 'company':
    case 'city':
      return v.replace(/(\p{L})[\p{L}'’-]*/gu, '$1***')
    case 'ip':
      return v.includes('.') ? v.replace(/\.\d+$/, '.0').replace(/^(\d+\.\d+)\.\d+/, '$1.0') : v.replace(/(:[0-9a-f]*){1,4}$/i, '::')
    case 'postcode':
      return v.replace(/(\S{2,3})[\s\S]*$/, (_, a: string) => `${a}${'*'.repeat(Math.max(1, v.length - a.length))}`)
    case 'url':
      return v.replace(/^((?:https?:\/\/)?[^/\s]+).*/i, '$1/***')
    default:
      return stars(v)
  }
}

/** HMAC-SHA-256 of the trimmed value with the page's secret key, first 16 hex characters. */
export async function hmacHex(key: CryptoKey, value: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value.trim()))
  return Array.from(new Uint8Array(sig).subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function importHmacKey(hex: string): Promise<CryptoKey> {
  const bytes = new Uint8Array(hex.match(/[0-9a-f]{2}/gi)?.map((h) => parseInt(h, 16)) ?? [])
  if (bytes.length < 16) throw new Error('The key must be at least 32 hexadecimal characters.')
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

export function randomKeyHex(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')
}
