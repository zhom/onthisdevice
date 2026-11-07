/** Random and fake data generators. Fake data comes from a seeded generator; random choices use crypto.getRandomValues. */
import type { Faker } from '@faker-js/faker'
import type { Field, Result, Specs, Values } from '../shell/spec'
import { bool, list, num, pick, str } from '../shell/spec'
import { luhnCheckDigit } from '../security/validate'
import { tableToSql } from '../data/convert'
import type { Table } from '../data/convert'
import Papa from 'papaparse'

async function fake(v: Values): Promise<Faker> {
  const { faker } = await import('@faker-js/faker/locale/en')
  const seed = str(v, 'seed').trim()
  // A seed gives the same data every time; without one each run differs.
  faker.seed(seed ? [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) : crypto.getRandomValues(new Uint32Array(1))[0])
  return faker
}

const COUNT: Field = { kind: 'number', id: 'count', label: 'How many', default: 10, min: 1, max: 1000 }
const SEED: Field = { kind: 'text', id: 'seed', label: 'Seed (optional)', default: '', hint: 'The same seed gives the same results, for repeatable tests.' }

const times = <T,>(n: number, f: (i: number) => T): T[] => Array.from({ length: Math.max(1, Math.min(1000, n)) }, (_, i) => f(i))

/** Unbiased random integer in [0, n). */
function randInt(n: number): number {
  const limit = Math.floor(0x100000000 / n) * n
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % n
}

const asTable = (head: string[], rows: string[][]): Result['table'] => ({ head, rows })

/* ── test card numbers ── */

const CARD_PREFIXES: Record<string, { prefixes: string[]; length: number; cvv: number }> = {
  visa: { prefixes: ['4'], length: 16, cvv: 3 },
  mastercard: { prefixes: ['51', '52', '53', '54', '55', '2221', '2720'], length: 16, cvv: 3 },
  amex: { prefixes: ['34', '37'], length: 15, cvv: 4 },
  discover: { prefixes: ['6011', '65'], length: 16, cvv: 3 },
  jcb: { prefixes: ['3528', '3589'], length: 16, cvv: 3 },
}
const NETWORK_NAME: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', jcb: 'JCB' }

export function testCardNumber(network: string): string {
  const spec = CARD_PREFIXES[network] ?? CARD_PREFIXES.visa
  let n = spec.prefixes[randInt(spec.prefixes.length)]
  while (n.length < spec.length - 1) n += String(randInt(10))
  return n + luhnCheckDigit(n)
}

/* ── mock data fields ── */

const FIELDS: Record<string, { label: string; make: (f: Faker, i: number) => string | number | boolean }> = {
  id: { label: 'id', make: (_f, i) => i + 1 },
  uuid: { label: 'uuid', make: (f) => f.string.uuid() },
  firstName: { label: 'first_name', make: (f) => f.person.firstName() },
  lastName: { label: 'last_name', make: (f) => f.person.lastName() },
  fullName: { label: 'name', make: (f) => f.person.fullName() },
  email: { label: 'email', make: (f) => f.internet.email({ provider: 'example.com' }).toLowerCase() },
  username: { label: 'username', make: (f) => f.internet.username().toLowerCase() },
  phone: { label: 'phone', make: (f) => f.phone.number({ style: 'national' }) },
  birthdate: { label: 'birth_date', make: (f) => f.date.birthdate({ mode: 'age', min: 18, max: 80 }).toISOString().slice(0, 10) },
  company: { label: 'company', make: (f) => f.company.name() },
  jobTitle: { label: 'job_title', make: (f) => f.person.jobTitle() },
  street: { label: 'street', make: (f) => f.location.streetAddress() },
  city: { label: 'city', make: (f) => f.location.city() },
  state: { label: 'state', make: (f) => f.location.state({ abbreviated: true }) },
  zip: { label: 'zip', make: (f) => f.location.zipCode() },
  country: { label: 'country', make: (f) => f.location.country() },
  lat: { label: 'latitude', make: (f) => f.location.latitude({ precision: 5 }) },
  lng: { label: 'longitude', make: (f) => f.location.longitude({ precision: 5 }) },
  url: { label: 'website', make: (f) => `https://${f.internet.domainWord()}.example.com` },
  ip: { label: 'ip', make: (f) => f.internet.ipv4() },
  product: { label: 'product', make: (f) => f.commerce.productName() },
  price: { label: 'price', make: (f) => Number(f.commerce.price({ min: 1, max: 500 })) },
  quantity: { label: 'quantity', make: (f) => f.number.int({ min: 1, max: 20 }) },
  createdAt: { label: 'created_at', make: (f) => f.date.recent({ days: 365 }).toISOString() },
  active: { label: 'active', make: (f) => f.datatype.boolean() },
  color: { label: 'color', make: (f) => f.color.rgb() },
  sentence: { label: 'note', make: (f) => f.lorem.sentence() },
}

function mockTable(f: Faker, keys: string[], count: number): Table {
  const fields = keys.filter((k) => FIELDS[k]).map((k) => FIELDS[k])
  if (fields.length === 0) throw new Error('Pick at least one field.')
  return { columns: fields.map((x) => x.label), rows: times(count, (i) => fields.map((x) => x.make(f, i))) }
}

/* ── random IP addresses ── */

function isReservedV4(b: number[]): boolean {
  const [a, c] = b
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && c >= 64 && c <= 127) || (a === 169 && c === 254) || (a === 172 && c >= 16 && c <= 31) || (a === 192 && c === 168) || (a === 192 && c === 0) || (a === 198 && (c === 18 || c === 19)) || (a === 203 && c === 0 && b[2] === 113) || (a === 198 && c === 51 && b[2] === 100)
}

function randomIpv4(kind: string): string {
  if (kind === 'private') {
    const r = randInt(3)
    const b = [0, 0, 0, 0].map(() => randInt(256))
    if (r === 0) return `10.${b[1]}.${b[2]}.${b[3] || 1}`
    if (r === 1) return `172.${16 + randInt(16)}.${b[2]}.${b[3] || 1}`
    return `192.168.${b[2]}.${b[3] || 1}`
  }
  if (kind === 'documentation') {
    const nets = ['192.0.2', '198.51.100', '203.0.113']
    return `${nets[randInt(3)]}.${1 + randInt(254)}`
  }
  for (;;) {
    const b = [0, 0, 0, 0].map(() => randInt(256))
    if (!isReservedV4(b) && b[3] !== 0 && b[3] !== 255) return b.join('.')
  }
}

function randomIpv6(kind: string): string {
  const g = () => randInt(0x10000).toString(16)
  if (kind === 'private') return ['fd' + randInt(256).toString(16).padStart(2, '0'), g(), g(), g(), g(), g(), g(), g()].join(':')
  if (kind === 'documentation') return ['2001', 'db8', g(), g(), g(), g(), g(), g()].join(':')
  return [(0x2000 + randInt(0x2000)).toString(16), g(), g(), g(), g(), g(), g(), g()].join(':')
}

const DATE_FORMATS: Record<string, (d: Date) => string> = {
  iso: (d) => d.toISOString().slice(0, 10),
  datetime: (d) => d.toISOString().replace(/\.\d+Z$/, 'Z'),
  us: (d) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`,
  eu: (d) => `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`,
  long: (d) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }),
  unix: (d) => String(Math.floor(d.getTime() / 1000)),
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'

export const GENERATE_SPECS: Specs = {
  'random-name-generator': {
    output: { label: 'Names', filename: 'names.txt' },
    action: 'Generate',
    fields: [
      COUNT,
      { kind: 'choice', id: 'sex', label: 'Names for', default: 'any', choices: [{ value: 'any', label: 'Anyone' }, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] },
      { kind: 'choice', id: 'part', label: 'Show', default: 'full', choices: [{ value: 'full', label: 'Full name' }, { value: 'first', label: 'First name' }, { value: 'last', label: 'Last name' }] },
      { kind: 'toggle', id: 'middle', label: 'Add a middle name', default: false },
      SEED,
    ],
    run: async (_i, v) => {
      const f = await fake(v)
      const sex = str(v, 'sex') === 'any' ? undefined : pick(v, 'sex', ['female', 'male'] as const)
      const names = times(num(v, 'count'), () => {
        const s = sex ?? f.person.sexType()
        const first = f.person.firstName(s)
        const last = f.person.lastName()
        if (str(v, 'part') === 'first') return first
        if (str(v, 'part') === 'last') return last
        return bool(v, 'middle') ? `${first} ${f.person.middleName(s)} ${last}` : `${first} ${last}`
      })
      return names.join('\n')
    },
  },
  'random-address-generator': {
    output: { label: 'Addresses', filename: 'addresses.csv' },
    action: 'Generate',
    fields: [COUNT, { kind: 'toggle', id: 'secondary', label: 'Add apartment or suite numbers', default: false }, SEED],
    run: async (_i, v) => {
      const f = await fake(v)
      const rows = times(num(v, 'count'), () => [f.location.streetAddress(bool(v, 'secondary')), f.location.city(), f.location.state({ abbreviated: true }), f.location.zipCode('#####'), 'United States'])
      const head = ['street', 'city', 'state', 'zip', 'country']
      return { table: asTable(head, rows), text: Papa.unparse({ fields: head, data: rows }, { newline: '\n' }), note: 'Fictional addresses in the US format. They may match real streets by chance; do not send mail to them.' }
    },
  },
  'random-email-generator': {
    output: { label: 'Email addresses', filename: 'emails.txt' },
    action: 'Generate',
    fields: [
      COUNT,
      { kind: 'text', id: 'domain', label: 'Domain', default: 'example.com', mono: true, hint: 'example.com, example.org and example.net are reserved for tests, so mail to them goes nowhere.' },
      { kind: 'choice', id: 'style', label: 'Style', default: 'name', choices: [{ value: 'name', label: 'first.last' }, { value: 'user', label: 'username' }, { value: 'plus', label: 'name+tag' }] },
      SEED,
    ],
    run: async (_i, v) => {
      const f = await fake(v)
      const domain = str(v, 'domain').trim().replace(/^@/, '') || 'example.com'
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain)) throw new Error('Type a domain such as example.com.')
      const style = str(v, 'style')
      return times(num(v, 'count'), () => {
        const first = f.person.firstName().toLowerCase().replace(/[^a-z]/g, '')
        const last = f.person.lastName().toLowerCase().replace(/[^a-z]/g, '')
        const local = style === 'user' ? f.internet.username().toLowerCase().replace(/[^a-z0-9._-]/g, '') : style === 'plus' ? `${first}+${f.word.noun().toLowerCase()}` : `${first}.${last}`
        return `${local}@${domain}`
      }).join('\n')
    },
  },
  'test-credit-card-generator': {
    output: { label: 'Test card numbers', filename: 'test-cards.csv' },
    action: 'Generate',
    fields: [
      COUNT,
      { kind: 'choice', id: 'network', label: 'Network', default: 'visa', choices: Object.entries(NETWORK_NAME).map(([value, label]) => ({ value, label })) },
      { kind: 'toggle', id: 'spaces', label: 'Group digits with spaces', default: true },
    ],
    run: (_i, v) => {
      const network = pick(v, 'network', ['visa', 'mastercard', 'amex', 'discover', 'jcb'] as const)
      const spec = CARD_PREFIXES[network]
      const now = new Date()
      const rows = times(num(v, 'count'), () => {
        const n = testCardNumber(network)
        const shown = bool(v, 'spaces') ? (network === 'amex' ? n.replace(/^(\d{4})(\d{6})(\d{5})$/, '$1 $2 $3') : n.replace(/(\d{4})(?=\d)/g, '$1 ')) : n
        const exp = `${String(1 + randInt(12)).padStart(2, '0')}/${String((now.getUTCFullYear() + 1 + randInt(5)) % 100).padStart(2, '0')}`
        const cvv = Array.from({ length: spec.cvv }, () => randInt(10)).join('')
        return [shown, exp, cvv]
      })
      return {
        table: asTable(['Number', 'Expiry', 'CVV'], rows),
        text: Papa.unparse({ fields: ['number', 'expiry', 'cvv'], data: rows }, { newline: '\n' }),
        note: 'For testing forms and validation only. The numbers pass the Luhn check but belong to no account and cannot pay for anything.',
      }
    },
  },
  'fake-data-generator': {
    output: { label: 'Data', filename: 'data.json', rows: 14 },
    action: 'Generate',
    fields: [
      { kind: 'checks', id: 'fields', label: 'Fields', default: 'id,fullName,email,phone,city,country,createdAt', choices: Object.entries(FIELDS).map(([value, x]) => ({ value, label: x.label })) },
      { ...COUNT, default: 25 },
      { kind: 'choice', id: 'format', label: 'Format', default: 'json', choices: [{ value: 'json', label: 'JSON' }, { value: 'csv', label: 'CSV' }, { value: 'sql', label: 'SQL' }, { value: 'jsonl', label: 'JSON Lines' }] },
      SEED,
    ],
    run: async (_i, v) => {
      const f = await fake(v)
      const t = mockTable(f, list(v, 'fields'), num(v, 'count'))
      const objects = t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c, r[i]])))
      const format = pick(v, 'format', ['json', 'csv', 'sql', 'jsonl'] as const)
      const text =
        format === 'csv'
          ? Papa.unparse({ fields: t.columns, data: t.rows.map((r) => r.map(String)) }, { newline: '\n' })
          : format === 'sql'
            ? tableToSql(t, { table: 'people', dialect: 'standard', create: true, batch: 100, detect: false })
            : format === 'jsonl'
              ? objects.map((o) => JSON.stringify(o)).join('\n')
              : JSON.stringify(objects, null, 2)
      return { text, table: { head: t.columns, rows: t.rows.slice(0, 50).map((r) => r.map((c) => (typeof c === 'boolean' ? String(c) : c))) }, stats: [{ label: 'Rows', value: t.rows.length }, { label: 'Fields', value: t.columns.length }] }
    },
  },
  'random-phone-number-generator': {
    output: { label: 'Phone numbers', filename: 'phone-numbers.txt' },
    action: 'Generate',
    fields: [
      COUNT,
      { kind: 'choice', id: 'format', label: 'Format', default: 'national', choices: [{ value: 'national', label: '(555) 010-1234' }, { value: 'dashes', label: '555-010-1234' }, { value: 'e164', label: '+15550101234' }] },
      { kind: 'toggle', id: 'fictional', label: 'Fictional 555-01XX numbers only', default: true, hint: 'The North American numbering plan reserves 555-0100 to 555-0199 for fiction, so these never ring anyone.' },
    ],
    run: (_i, v) => {
      const fmt = str(v, 'format')
      return times(num(v, 'count'), () => {
        const area = bool(v, 'fictional') ? String(200 + randInt(800)).replace(/^(\d)(\d)(\d)$/, (m, a: string, b: string, c: string) => (b === c ? `${a}${b}${(Number(c) + 1) % 10}` : m)) : String(200 + randInt(800))
        const [exchange, line] = bool(v, 'fictional') ? ['555', `01${String(randInt(100)).padStart(2, '0')}`] : [String(200 + randInt(800)), String(randInt(10000)).padStart(4, '0')]
        if (fmt === 'e164') return `+1${area}${exchange}${line}`
        if (fmt === 'dashes') return `${area}-${exchange}-${line}`
        return `(${area}) ${exchange}-${line}`
      }).join('\n')
    },
  },
  'username-generator': {
    output: { label: 'Usernames', filename: 'usernames.txt' },
    action: 'Generate',
    fields: [
      COUNT,
      { kind: 'choice', id: 'style', label: 'Style', default: 'words', choices: [{ value: 'words', label: 'AdjectiveNoun' }, { value: 'words_', label: 'adjective_noun' }, { value: 'name', label: 'From a name' }] },
      { kind: 'toggle', id: 'digits', label: 'Add digits', default: true },
      { kind: 'number', id: 'max', label: 'Maximum length', default: 20, min: 4, max: 40 },
      SEED,
    ],
    run: async (_i, v) => {
      const f = await fake(v)
      const style = str(v, 'style')
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
      const out = new Set<string>()
      for (let tries = 0; out.size < num(v, 'count') && tries < num(v, 'count') * 20; tries++) {
        const adj = f.word.adjective({ length: { min: 3, max: 8 } }).replace(/[^a-z]/gi, '')
        const noun = f.word.noun({ length: { min: 3, max: 8 } }).replace(/[^a-z]/gi, '')
        let u = style === 'name' ? `${f.person.firstName().toLowerCase()}${f.person.lastName().charAt(0).toLowerCase()}` : style === 'words_' ? `${adj.toLowerCase()}_${noun.toLowerCase()}` : `${cap(adj)}${cap(noun)}`
        u = u.replace(/[^A-Za-z0-9_]/g, '')
        if (bool(v, 'digits')) u += String(randInt(1000))
        if (u.length <= num(v, 'max')) out.add(u)
      }
      return [...out].join('\n')
    },
  },
  'random-date-generator': {
    output: { label: 'Dates', filename: 'dates.txt' },
    action: 'Generate',
    fields: [
      COUNT,
      { kind: 'text', id: 'from', label: 'From', default: '2000-01-01', mono: true },
      { kind: 'text', id: 'to', label: 'To', default: '2026-12-31', mono: true },
      { kind: 'choice', id: 'format', label: 'Format', default: 'iso', choices: [{ value: 'iso', label: '2026-11-07' }, { value: 'us', label: '11/07/2026' }, { value: 'eu', label: '07.11.2026' }, { value: 'long', label: 'Saturday, November 7, 2026' }, { value: 'datetime', label: 'ISO date and time' }, { value: 'unix', label: 'Unix time' }] },
      { kind: 'toggle', id: 'weekdays', label: 'Weekdays only', default: false },
      { kind: 'toggle', id: 'sort', label: 'Sort oldest first', default: false },
    ],
    run: (_i, v) => {
      const a = Date.parse(str(v, 'from'))
      const b = Date.parse(str(v, 'to'))
      if (Number.isNaN(a) || Number.isNaN(b)) throw new Error('Type dates as YYYY-MM-DD, such as 2026-11-07.')
      if (b < a) throw new Error('The end date is before the start date.')
      const withTime = str(v, 'format') === 'datetime' || str(v, 'format') === 'unix'
      const span = withTime ? b + 86_400_000 - a : Math.floor((b - a) / 86_400_000) + 1
      let dates = times(num(v, 'count'), () => {
        for (let k = 0; k < 50; k++) {
          const d = new Date(withTime ? a + randInt(Math.min(span, 0xffffffff)) * Math.max(1, Math.ceil(span / 0xffffffff)) : a + randInt(span) * 86_400_000)
          if (!bool(v, 'weekdays') || (d.getUTCDay() !== 0 && d.getUTCDay() !== 6)) return d
        }
        return new Date(a)
      })
      if (bool(v, 'sort')) dates = dates.sort((x, y) => x.getTime() - y.getTime())
      const fmt = DATE_FORMATS[str(v, 'format')] ?? DATE_FORMATS.iso
      return dates.map(fmt).join('\n')
    },
  },
  'random-ip-address-generator': {
    output: { label: 'IP addresses', filename: 'ip-addresses.txt' },
    action: 'Generate',
    fields: [
      COUNT,
      { kind: 'choice', id: 'version', label: 'Version', default: '4', choices: [{ value: '4', label: 'IPv4' }, { value: '6', label: 'IPv6' }] },
      { kind: 'choice', id: 'kind', label: 'Range', default: 'public', choices: [{ value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }, { value: 'documentation', label: 'Documentation' }], hint: 'Documentation ranges (192.0.2.0/24, 2001:db8::/32) are reserved for examples and never routed.' },
    ],
    run: (_i, v) => times(num(v, 'count'), () => (str(v, 'version') === '6' ? randomIpv6(str(v, 'kind')) : randomIpv4(str(v, 'kind')))).join('\n'),
  },
  'random-letter-generator': {
    output: { label: 'Letters', filename: 'letters.txt' },
    action: 'Generate',
    fields: [
      { ...COUNT, default: 1, max: 1000 },
      { kind: 'choice', id: 'set', label: 'Letters', default: 'all', choices: [{ value: 'all', label: 'A to Z' }, { value: 'vowels', label: 'Vowels' }, { value: 'consonants', label: 'Consonants' }] },
      { kind: 'choice', id: 'case', label: 'Case', default: 'upper', choices: [{ value: 'upper', label: 'ABC' }, { value: 'lower', label: 'abc' }, { value: 'mixed', label: 'Mixed' }] },
      { kind: 'toggle', id: 'unique', label: 'No repeats', default: false },
      { kind: 'choice', id: 'join', label: 'Separate with', default: '\n', choices: [{ value: '\n', label: 'New lines' }, { value: ' ', label: 'Spaces' }, { value: '', label: 'Nothing' }] },
    ],
    run: (_i, v) => {
      const set = str(v, 'set') === 'vowels' ? 'aeiou' : str(v, 'set') === 'consonants' ? 'bcdfghjklmnpqrstvwxyz' : LETTERS
      const n = num(v, 'count')
      if (bool(v, 'unique') && n > set.length) throw new Error(`Without repeats, at most ${set.length} letters are possible.`)
      const pool = [...set]
      const out = times(n, () => {
        const i = randInt(pool.length)
        const c = pool[i]
        if (bool(v, 'unique')) pool.splice(i, 1)
        const c2 = str(v, 'case') === 'upper' ? c.toUpperCase() : str(v, 'case') === 'mixed' && randInt(2) ? c.toUpperCase() : c
        return c2
      })
      return out.join(str(v, 'join'))
    },
  },
  'random-team-generator': {
    input: { label: 'Names, one per line', sample: 'Ada\nAlan\nGrace\nLinus\nMargaret\nTim\nBarbara\nKen\nDonald\nFrances', rows: 8 },
    output: { label: 'Teams', filename: 'teams.txt', mono: false },
    action: 'Make teams',
    fields: [
      { kind: 'choice', id: 'by', label: 'Split into', default: 'teams', choices: [{ value: 'teams', label: 'A number of teams' }, { value: 'size', label: 'Teams of a size' }] },
      { kind: 'number', id: 'n', label: 'Number', default: 2, min: 1, max: 500 },
    ],
    run: (input, v) => {
      const names = [...new Set(input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))]
      if (names.length < 2) throw new Error('Add at least two names, one per line.')
      // Fisher-Yates with crypto random numbers.
      for (let i = names.length - 1; i > 0; i--) {
        const j = randInt(i + 1)
        ;[names[i], names[j]] = [names[j], names[i]]
      }
      const teams = str(v, 'by') === 'size' ? Math.ceil(names.length / Math.max(1, num(v, 'n'))) : Math.min(names.length, Math.max(1, num(v, 'n')))
      const groups: string[][] = Array.from({ length: teams }, () => [])
      names.forEach((n, i) => groups[i % teams].push(n))
      return {
        text: groups.map((g, i) => `Team ${i + 1}\n${g.join('\n')}`).join('\n\n'),
        table: { head: ['Team', 'Members'], rows: groups.map((g, i) => [`Team ${i + 1}`, g.join(', ')]) },
        stats: [{ label: 'Teams', value: teams }, { label: 'People', value: names.length }],
      }
    },
  },
}
