/**
 * Pattern rules for personal data. They run in a few milliseconds, so the
 * tools show results at once while the language model loads.
 *
 * Each rule is tuned for precision: a checksum where the format has one
 * (cards, IBANs, several national IDs), a context word where the format alone
 * is ambiguous (plain digit runs), and explicit rejections for the usual
 * look-alikes (version numbers, hashes, timestamps, decimals).
 */
import {
  digitsOf,
  ibanLength,
  luhn,
  validBsn,
  validDate,
  validDni,
  validIban,
  validNhs,
  validNir,
  validSteuerId,
  verhoeff,
} from './checks'
import type { EntityType, Span } from './types'

type Push = (start: number, end: number, type: EntityType, rule: string, score: number, label?: string) => void

function collector(out: Span[]): Push {
  return (start, end, type, rule, score, label) => {
    if (end > start) out.push({ start, end, type, source: 'rule', score, rule, label })
  }
}

/** Up to `n` characters before `index`, on the same line. */
function before(text: string, index: number, n = 40): string {
  const from = Math.max(0, index - n)
  const chunk = text.slice(from, index)
  const nl = chunk.lastIndexOf('\n')
  return nl >= 0 ? chunk.slice(nl + 1) : chunk
}

/** Up to `n` characters after `index`, on the same line. */
function after(text: string, index: number, n = 30): string {
  const chunk = text.slice(index, index + n)
  const nl = chunk.indexOf('\n')
  return nl >= 0 ? chunk.slice(0, nl) : chunk
}

const VERSION_CONTEXT = /(?:\bv|\bver(?:sion)?\.?|\brelease|\bbuild|\bpatch|\bnode|\bpython|\bchrome|\bfirefox|\bsafari|\bios|\bandroid|\bmacos|\bwindows|@|=)\s*$/i

/* ------------------------------------------------------------------ */
/* Email, URL, username                                                */
/* ------------------------------------------------------------------ */

const FILE_EXT_TLD = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'ico', 'bmp', 'tif', 'tiff', 'js', 'mjs', 'cjs',
  'ts', 'tsx', 'jsx', 'css', 'scss', 'less', 'json', 'map', 'html', 'htm', 'md', 'txt', 'xml', 'yml',
  'yaml', 'lock', 'vue', 'svelte', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'php', 'sh', 'wasm',
])

const EMAIL = /(?<![\w.+%-])[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,63})@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}(?![\w-]|\.[A-Za-z0-9])/g

function findEmails(text: string, push: Push) {
  if (!text.includes('@')) return
  for (const m of text.matchAll(EMAIL)) {
    const value = m[0]
    const tld = value.slice(value.lastIndexOf('.') + 1).toLowerCase()
    if (FILE_EXT_TLD.has(tld)) continue
    const local = value.slice(0, value.indexOf('@'))
    if (/^\d+x$/i.test(local.split(/[._-]/).pop() ?? '')) continue // icon@2x.png style names
    if (local === 'git' && text[m.index + value.length] === ':') continue // git@host:repo remotes
    push(m.index, m.index + value.length, 'EMAIL', 'email', 0.99)
  }
}

const URL_RE = /\b(?:(?:https?|ftp|wss?):\/\/|www\.)[^\s<>"'`]+/gi

/** Trims trailing punctuation that belongs to the sentence, keeping balanced brackets. */
function trimUrl(url: string): string {
  let u = url
  for (;;) {
    const last = u[u.length - 1]
    if (/[.,;:!?'"*]/.test(last)) {
      u = u.slice(0, -1)
      continue
    }
    if (last === ')' && (u.match(/\(/g)?.length ?? 0) < (u.match(/\)/g)?.length ?? 0)) {
      u = u.slice(0, -1)
      continue
    }
    if (last === ']' && !u.includes('[')) {
      u = u.slice(0, -1)
      continue
    }
    if (last === '}' && !u.includes('{')) {
      u = u.slice(0, -1)
      continue
    }
    if (last === '>' ) {
      u = u.slice(0, -1)
      continue
    }
    break
  }
  return u
}

function findUrls(text: string, push: Push) {
  for (const m of text.matchAll(URL_RE)) {
    const url = trimUrl(m[0])
    if (url.length < 8) continue
    push(m.index, m.index + url.length, 'URL', 'url', 0.95)
  }
}

/** Words after @ that are code or chat syntax, not people. */
const AT_WORDS = new Set([
  'media', 'import', 'keyframes', 'font-face', 'supports', 'layer', 'container', 'tailwind', 'apply',
  'theme', 'utility', 'variant', 'custom-variant', 'source', 'plugin', 'config', 'reference', 'property',
  'param', 'returns', 'return', 'type', 'typedef', 'throws', 'see', 'example', 'deprecated', 'override',
  'author', 'since', 'version', 'link', 'todo', 'internal', 'public', 'private', 'protected', 'readonly',
  'template', 'callback', 'default', 'description', 'module', 'namespace', 'charset', 'page', 'font',
  'mixin', 'include', 'extend', 'if', 'else', 'each', 'for', 'while', 'use', 'forward', 'function',
  'everyone', 'here', 'channel', 'all', 'pytest', 'staticmethod', 'classmethod', 'dataclass', 'property',
  'app', 'router', 'api', 'test', 'before', 'after', 'beforeeach', 'aftereach', 'component', 'injectable',
  'input', 'output', 'ngmodule', 'directive', 'pipe', 'host', 'hostlistener', 'viewchild', 'entity',
  'column', 'id', 'get', 'post', 'put', 'delete', 'patch', 'override', 'suppresswarnings', 'nullable',
  'nonnull', 'autowired', 'bean', 'service', 'controller', 'repository', 'transactional', 'value',
  'latest', 'next', 'beta', 'alpha', 'canary', 'rc', 'types', 'babel', 'vitejs', 'astrojs', 'tailwindcss',
  'ts-ignore', 'ts-expect-error', 'ts-nocheck', 'ts-check', 'jsx', 'jsximportsource', 'vite-ignore',
  'state', 'observable', 'action', 'computed', 'wraps', 'lru_cache', 'cache', 'abstractmethod', 'main',
])

const USERNAME_AT = /(?<![\w.@/\\-])@([A-Za-z0-9_](?:[A-Za-z0-9_.-]{0,38}[A-Za-z0-9_])?)(?![\w@/(-]|\.[A-Za-z0-9])/g
const USERNAME_CTX = /\b(?:user(?:name)?|login|handle|user id|nick(?:name)?|benutzer(?:name)?|utilisateur|usuario)\s*[:=]\s*["']?([A-Za-z0-9_][A-Za-z0-9_.-]{2,39})\b/gi

function findUsernames(text: string, push: Push) {
  if (text.includes('@')) {
    for (const m of text.matchAll(USERNAME_AT)) {
      const name = m[1]
      if (AT_WORDS.has(name.toLowerCase())) continue
      if (/^\d+(?:\.\d+)*$/.test(name)) continue // @2.1.0 versions, @1x scales
      if (/^\d+x$/i.test(name)) continue
      push(m.index, m.index + m[0].length, 'USERNAME', 'handle', 0.85)
    }
  }
  for (const m of text.matchAll(USERNAME_CTX)) {
    const value = m[1]
    if (/^(?:none|null|admin|root|guest|user|test|true|false|string|undefined)$/i.test(value)) continue
    const at = m.index + m[0].lastIndexOf(value)
    push(at, at + value.length, 'USERNAME', 'username-context', 0.8)
  }
}

/* ------------------------------------------------------------------ */
/* Phone numbers                                                       */
/* ------------------------------------------------------------------ */

const PHONE = /(?<![\w+\-./:=#$€£%])(?:\+|00)?\(?\d[\d \t ().\-/]{5,22}\d(?![\w\-/]|\.\d|:\d|,\d)/g
const PHONE_CONTEXT =
  /(?:phone|tel|telephone|mobile|mob|cell|call|fax|whats ?app|sms|text me|ring|contact|reach me|hotline|nummer|telefon|handy|tél|téléphone|portable|teléfono|tlf|móvil|telefono|cellulare|telefoon|mobiel|ph)\b\.?\s*[:#]?[^\n\d]{0,12}$/i

function looksLikeDate(raw: string): boolean {
  return (
    /^\d{4}[-./ ]\d{1,2}[-./ ]\d{1,2}$/.test(raw) ||
    /^\d{1,2}[-./ ]\d{1,2}[-./ ]\d{2,4}$/.test(raw) ||
    /^\d{4}[-./]\d{1,2}[-./]\d{1,2}[ T]\d{1,2}$/.test(raw)
  )
}

function validPhone(raw: string, text: string, index: number): number {
  const digits = digitsOf(raw)
  const n = digits.length
  if (n < 7 || n > 15) return 0
  if (/(\d)\1{6,}/.test(digits)) return 0
  if (looksLikeDate(raw)) return 0
  const intl = raw.startsWith('+') || raw.startsWith('00')
  const groups = raw.split(/[ \t ().\-/]+/).filter(Boolean)
  const seps = raw.replace(/[\d+]/g, '')
  const context = PHONE_CONTEXT.test(before(text, index, 32))
  if (raw.includes('/') && !context) return 0 // fractions, paths, dates
  if (groups.filter((g) => g.length === 1).length > (intl ? 2 : 1)) return 0
  if (VERSION_CONTEXT.test(before(text, index, 12))) return 0
  // NANP: (NXX) NXX-XXXX, NXX-NXX-XXXX, NXX.NXX.XXXX, NXX NXX XXXX
  const nanp = /^(?:\+?1[ .-]?)?\(?([2-9]\d{2})\)?[ .-]?([2-9]\d{2})[ .-](\d{4})$/.exec(raw)
  if (nanp) return 0.9
  const onlyDots = /^[.]+$/.test(seps.replace(/\s/g, '')) && !/\s/.test(seps)
  if (onlyDots) {
    // 06.12.34.56.78 is a French number; 1.2.3.4 and 3.14159 are not phones.
    if (groups.length === 5 && groups.every((g) => g.length === 2) && digits.startsWith('0')) return 0.85
    if (!intl) return 0
  }
  if (intl) {
    if (n < 8) return 0
    return 0.9
  }
  if (groups.length === 1) {
    // A bare run of digits is a phone number only when the text says so.
    return context && n >= 8 && n <= 13 ? 0.75 : 0
  }
  if (/\(\d{2,5}\)/.test(raw)) return 0.85
  if (digits.startsWith('0') && n >= 9 && n <= 12) return 0.8
  if (context) return 0.7
  return 0
}

function findPhones(text: string, push: Push) {
  for (const m of text.matchAll(PHONE)) {
    let raw = m[0]
    let start = m.index
    // A leading "(" without a closing one belongs to the sentence.
    if (raw.startsWith('(') && !raw.includes(')')) {
      raw = raw.slice(1)
      start += 1
    }
    raw = raw.replace(/[ \t (.\-/]+$/, '')
    if (raw.endsWith(')') && !raw.includes('(')) raw = raw.slice(0, -1)
    const score = validPhone(raw, text, start)
    if (score > 0) push(start, start + raw.length, 'PHONE', 'phone', score)
  }
}

/* ------------------------------------------------------------------ */
/* Cards, IBANs                                                        */
/* ------------------------------------------------------------------ */

const CARD = /(?<!\d|\d[.,-])\d(?:[ -]?\d){12,18}(?!\d|[.,-]\d)/g

function cardNetwork(d: string): string | null {
  if (/^4/.test(d) && (d.length === 16 || d.length === 19)) return 'Visa'
  if (/^(?:5[1-5]|2(?:2[2-9]|[3-6]\d|7[01]|720))/.test(d) && d.length === 16) return 'Mastercard'
  if (/^3[47]/.test(d) && d.length === 15) return 'American Express'
  if (/^(?:6011|65|64[4-9]|622)/.test(d) && d.length >= 16) return 'Discover'
  if (/^35(?:2[89]|[3-8]\d)/.test(d) && d.length >= 16) return 'JCB'
  if (/^3(?:0[0-5]|[68])/.test(d) && d.length >= 14) return 'Diners Club'
  if (/^62/.test(d) && d.length >= 16) return 'UnionPay'
  if (/^(?:5018|5020|5038|6304|6759|676[1-3])/.test(d) && d.length >= 12) return 'Maestro'
  return null
}

function findCards(text: string, push: Push) {
  for (const m of text.matchAll(CARD)) {
    const raw = m[0]
    const d = digitsOf(raw)
    if (d.length < 13 || d.length > 19) continue
    if (/^(\d)\1+$/.test(d)) continue
    const network = cardNetwork(d)
    if (!network || !luhn(d)) continue
    const seps = new Set(raw.replace(/\d/g, ''))
    if (seps.size > 1) continue
    if (seps.size === 1) {
      const sizes = raw.split(/[ -]/).map((g) => g.length).join('-')
      if (!/^(?:4-4-4-4(?:-3)?|4-6-5|4-6-4|4-4-4-4-\d|4-4-4-1|4-4-4-2|4-4-4-3|4-4-5)$/.test(sizes)) continue
    }
    push(m.index, m.index + raw.length, 'CARD', 'card', 1, network)
  }
}

const IBAN_CAND = /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){10,32}/g

function findIbans(text: string, push: Push) {
  for (const m of text.matchAll(IBAN_CAND)) {
    const raw = m[0]
    const want = ibanLength(raw.slice(0, 2))
    if (!want) continue
    // Walk to the country's IBAN length; text after it may have been swallowed.
    let count = 0
    let end = -1
    for (let i = 0; i < raw.length; i++) {
      if (/[A-Z0-9]/.test(raw[i])) count++
      if (count === want) {
        end = i + 1
        break
      }
    }
    if (end < 0) continue
    // The IBAN must end at a word edge or at a group separator.
    if (/[A-Za-z0-9]/.test(text[m.index + end] ?? '')) continue
    if (!validIban(raw.slice(0, end))) continue
    push(m.index, m.index + end, 'IBAN', 'iban', 1)
  }
}

/* ------------------------------------------------------------------ */
/* IP and MAC addresses                                                */
/* ------------------------------------------------------------------ */

const IPV4 = /(?<![\w.:-])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\/(?:3[0-2]|[12]?\d))?(?![\w-]|\.\d)/g

function findIpv4(text: string, push: Push) {
  for (const m of text.matchAll(IPV4)) {
    const ip = m[0].split('/')[0]
    if (ip === '0.0.0.0' || ip === '255.255.255.255' || ip.startsWith('127.')) continue
    const ctx = before(text, m.index, 16)
    if (/(?:\bv|ver(?:sion)?|build|release|assembly)[\s:='"]*$/i.test(ctx)) continue
    // Mask-like values 255.255.255.0 are netmasks, not hosts.
    if (/^255\.255\./.test(ip)) continue
    push(m.index, m.index + m[0].length, 'IP', 'ipv4', 0.95)
  }
}

const IPV6_CAND = /(?<![\w:.])(?:[0-9A-Fa-f]{1,4}:|::?)(?:[0-9A-Fa-f]{0,4}:){1,7}(?:[0-9A-Fa-f]{1,4}|(?:\d{1,3}\.){3}\d{1,3})?(?:%[\w.]+)?(?![\w:])/g

export function validIpv6(raw: string): boolean {
  const addr = raw.split('%')[0]
  if (!addr.includes(':') || /:::/.test(addr)) return false
  const parts = addr.split('::')
  if (parts.length > 2) return false
  const groupsOf = (s: string) => (s === '' ? [] : s.split(':'))
  const head = groupsOf(parts[0])
  const tail = parts.length === 2 ? groupsOf(parts[1]) : []
  const all = [...head, ...tail]
  let count = 0
  for (let i = 0; i < all.length; i++) {
    const g = all[i]
    if (i === all.length - 1 && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(g)) {
      count += 2
      continue
    }
    if (!/^[0-9A-Fa-f]{1,4}$/.test(g)) return false
    count += 1
  }
  if (parts.length === 1) return count === 8
  return count < 8
}

function findIpv6(text: string, push: Push) {
  if (!text.includes(':')) return
  for (const m of text.matchAll(IPV6_CAND)) {
    const raw = m[0]
    if (!validIpv6(raw)) continue
    const groups = raw.split('%')[0].split(':').filter(Boolean)
    if (groups.length < 3) continue // ::1, a::b and C++ scopes are not worth a mask
    if (!groups.some((g) => /\d/.test(g))) continue
    if (groups.length === 6 && groups.every((g) => g.length === 2) && !raw.includes('::')) continue // MAC
    if (groups.every((g) => /^\d{1,2}$/.test(g)) && !raw.includes('::')) continue // times
    push(m.index, m.index + raw.length, 'IP', 'ipv6', 0.95)
  }
}

const MAC = /(?<![\w:.-])[0-9A-Fa-f]{2}([:-])(?:[0-9A-Fa-f]{2}\1){4}[0-9A-Fa-f]{2}(?![\w:-])/g
const MAC_DOTS = /(?<![\w.])[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}(?![\w.])/g

function findMacs(text: string, push: Push) {
  for (const re of [MAC, MAC_DOTS]) {
    for (const m of text.matchAll(re)) {
      const hex = m[0].replace(/[^0-9A-Fa-f]/g, '').toLowerCase()
      if (/^(.)\1+$/.test(hex)) continue
      if (re === MAC_DOTS && !/[a-f]/.test(hex)) continue
      push(m.index, m.index + m[0].length, 'MAC', 'mac', 0.95)
    }
  }
}

/* ------------------------------------------------------------------ */
/* Dates and birth dates                                               */
/* ------------------------------------------------------------------ */

const DOB_CONTEXT =
  /(?:\bborn|\bdob|\bd\.o\.b\.?|date of birth|birth ?date|birthday|\bb\.|geb(?:oren|\.)|geburtsdatum|geburtstag|n[ée]e? le|date de naissance|fecha de nacimiento|nacid[oa]|nat[oa] il|data di nascita|geboren|geboortedatum|data de nascimento)\b[^\n\d]{0,16}$/i

const MONTHS =
  'Jan(?:uary|\\.)?|Feb(?:ruary|\\.)?|Mar(?:ch|\\.)?|Apr(?:il|\\.)?|May|June?|July?|Aug(?:ust|\\.)?|Sep(?:t(?:ember)?|\\.)?|Oct(?:ober|\\.)?|Nov(?:ember|\\.)?|Dec(?:ember|\\.)?|' +
  'Januar|Februar|März|Maerz|Mai|Juni|Juli|Oktober|Dezember|' +
  'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|' +
  'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|' +
  'gennaio|febbraio|aprile|maggio|giugno|luglio|settembre|ottobre|dicembre'

const ISO_DATE = /(?<![\w.:/-])(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:[.,]\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?(?![\w-]|\.\d)/g
const NUM_DATE = /(?<![\w/.:-])(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})(?![\w/-]|[.:]\d)/g
const TEXT_DATE_DMY = new RegExp(
  `(?<![\\w])(\\d{1,2})(?:st|nd|rd|th|er)?\\.?\\s+(?:of\\s+|de\\s+)?(${MONTHS})\\.?,?\\s+(?:de\\s+)?(\\d{4})(?![\\w])`,
  'gi',
)
const TEXT_DATE_MDY = new RegExp(`(?<![\\w])(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})(?![\\w])`, 'gi')

function dateType(text: string, index: number): { type: EntityType; rule: string } {
  return DOB_CONTEXT.test(before(text, index, 40)) ? { type: 'DOB', rule: 'dob' } : { type: 'DATE', rule: 'date' }
}

function findDates(text: string, push: Push) {
  for (const m of text.matchAll(ISO_DATE)) {
    const y = Number(m[1])
    if (y < 1900 || y > 2100 || !validDate(y, Number(m[2]), Number(m[3]))) continue
    const t = dateType(text, m.index)
    push(m.index, m.index + m[0].length, t.type, t.rule, 0.95)
  }
  for (const m of text.matchAll(NUM_DATE)) {
    const a = Number(m[1])
    const sep = m[2]
    const b = Number(m[3])
    const yRaw = m[4]
    const y = Number(yRaw)
    if (yRaw.length === 4 && (y < 1900 || y > 2100)) continue
    if (sep !== '/' && yRaw.length === 2 && (m[1].length < 2 || m[3].length < 2)) continue
    if (!validDate(y, b, a) && !validDate(y, a, b)) continue
    if (VERSION_CONTEXT.test(before(text, m.index, 12))) continue
    const t = dateType(text, m.index)
    push(m.index, m.index + m[0].length, t.type, t.rule, 0.9)
  }
  for (const re of [TEXT_DATE_DMY, TEXT_DATE_MDY]) {
    for (const m of text.matchAll(re)) {
      const day = Number(re === TEXT_DATE_DMY ? m[1] : m[2])
      if (day < 1 || day > 31) continue
      const t = dateType(text, m.index)
      push(m.index, m.index + m[0].length, t.type, t.rule, 0.9)
    }
  }
}

/* ------------------------------------------------------------------ */
/* National and other ID numbers                                       */
/* ------------------------------------------------------------------ */

interface IdRule {
  id: string
  label: string
  re: RegExp
  /** Group holding the value; 0 for the whole match. */
  group?: number
  check?: (value: string) => boolean
  /** Needs this context in the 40 characters before the match. */
  context?: RegExp
  score: number
}

const ID_RULES: IdRule[] = [
  {
    id: 'us-ssn',
    label: 'US Social Security number',
    re: /(?<![\d-])(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}(?![\d-])/g,
    score: 0.9,
  },
  {
    id: 'us-ssn-spaced',
    label: 'US Social Security number',
    re: /(?<!\d ?)(?!000|666|9\d\d)\d{3}[ ]?(?!00)\d{2}[ ]?(?!0000)\d{4}(?! ?\d)/g,
    context: /(?:ssn|social security|soc\.? sec\.?|ss#)[^\n\d]{0,16}$/i,
    score: 0.9,
  },
  {
    id: 'uk-nino',
    label: 'UK National Insurance number',
    re: /\b(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z] ?\d{2} ?\d{2} ?\d{2} ?[A-D]\b/g,
    score: 0.9,
  },
  {
    id: 'uk-nhs',
    label: 'NHS number',
    re: /\b\d{3}[ -]?\d{3}[ -]?\d{4}\b/g,
    check: (v) => validNhs(digitsOf(v)),
    context: /\bnhs\b[^\n\d]{0,24}$/i,
    score: 0.95,
  },
  {
    id: 'ca-sin',
    label: 'Canadian Social Insurance number',
    re: /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/g,
    check: (v) => luhn(digitsOf(v)),
    context: /(?:\bsin\b|social insurance|nas\b)[^\n\d]{0,24}$/i,
    score: 0.95,
  },
  {
    id: 'es-dni',
    label: 'Spanish DNI or NIE',
    re: /\b(?:\d{8}|[XYZ]\d{7})[ -]?[A-Z]\b/g,
    check: validDni,
    score: 0.95,
  },
  {
    id: 'it-cf',
    label: 'Italian tax code',
    re: /\b[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]\b/g,
    score: 0.95,
  },
  {
    id: 'fr-nir',
    label: 'French social security number',
    re: /\b[12] ?\d{2} ?(?:0[1-9]|1[0-2]|[2-9]\d) ?(?:\d{2}|2[AB]) ?\d{3} ?\d{3} ?\d{2}\b/g,
    check: validNir,
    score: 1,
  },
  {
    id: 'de-taxid',
    label: 'German tax ID',
    re: /\b\d{2} ?\d{3} ?\d{3} ?\d{3}\b/g,
    check: (v) => validSteuerId(digitsOf(v)),
    context: /(?:steuer|tax ?id|idnr|identifikationsnummer|tin)[^\n\d]{0,24}$/i,
    score: 0.95,
  },
  {
    id: 'nl-bsn',
    label: 'Dutch BSN',
    re: /\b\d{4}\.?\d{2}\.?\d{3}\b|\b\d{9}\b/g,
    check: (v) => validBsn(digitsOf(v)),
    context: /(?:\bbsn|burgerservicenummer|sofi)[^\n\d]{0,24}$/i,
    score: 0.95,
  },
  {
    id: 'in-aadhaar',
    label: 'Aadhaar number',
    re: /\b[2-9]\d{3}[ -]\d{4}[ -]\d{4}\b/g,
    check: (v) => verhoeff(digitsOf(v)),
    score: 0.9,
  },
  {
    id: 'in-pan',
    label: 'Indian PAN',
    re: /\b[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]\b/g,
    score: 0.85,
  },
  {
    id: 'passport',
    label: 'Passport number',
    re: /\b(?:passport|passeport|reisepass|pasaporte|passaporto|paspoort)(?:\s*(?:no\.?|nr\.?|number|num(?:ber|éro)?|#))?\s*[:#]?\s*([A-Z0-9]{6,9})\b/gi,
    group: 1,
    check: (v) => /\d/.test(v) && /^[A-Z0-9]+$/.test(v),
    score: 0.9,
  },
  {
    id: 'uk-sort-code',
    label: 'Sort code',
    re: /\bsort ?code\s*[:#]?\s*(\d{2}-\d{2}-\d{2})\b/gi,
    group: 1,
    score: 0.95,
  },
  {
    id: 'id-context',
    label: 'ID number',
    re: /\b(?:account|acct|a\/c|customer|client|member(?:ship)?|policy|patient|employee|staff|student|case|claim|contract|licen[cs]e|driver'?s? licen[cs]e|tax|vat|national id|id card|identity|personal|social security|insurance|routing|reference|ref|invoice|order|ticket|booking|kunden|konto|versicherten|mitglieds|numéro|compte|cliente|cuenta|tessera)\b(?:\s*(?:no\.?|nr\.?|number|num\.?|#|id|code|nummer|número|numero))?\s*[:#=]?\s*([A-Z0-9][A-Z0-9-/]{3,30}[A-Z0-9])\b/gi,
    group: 1,
    check: (v) => (v.match(/\d/g)?.length ?? 0) >= 4 && !/^\d{4}$/.test(v) && !/^(?:19|20)\d\d-\d\d-\d\d$/.test(v),
    score: 0.75,
  },
  {
    id: 'id-label',
    label: 'ID number',
    re: /\b(?:ID|Id|id)(?:\s*(?:no\.?|nr\.?|number|#))?\s*[:#=]\s*([A-Z0-9][A-Z0-9-]{4,30}[A-Z0-9])\b/g,
    group: 1,
    check: (v) => (v.match(/\d/g)?.length ?? 0) >= 4,
    score: 0.7,
  },
]

function findIds(text: string, push: Push) {
  for (const rule of ID_RULES) {
    for (const m of text.matchAll(rule.re)) {
      const g = rule.group ?? 0
      const value = m[g]
      if (value === undefined) continue
      const start = g === 0 ? m.index : m.index + m[0].lastIndexOf(value)
      if (rule.check && !rule.check(value)) continue
      if (rule.context && !rule.context.test(before(text, start, 40))) continue
      push(start, start + value.length, 'ID', rule.id, rule.score, rule.label)
    }
  }
}

/* ------------------------------------------------------------------ */
/* Addresses and postcodes                                             */
/* ------------------------------------------------------------------ */

const STREET_EN =
  /\b\d{1,5}[A-Za-z]?(?:-\d{1,4})?,?\s+(?:[NSEW]\.?\s+)?(?:[A-Z][A-Za-z'.-]*\s+){0,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Close|Crescent|Cres|Parkway|Pkwy|Highway|Hwy|Square|Sq|Circle|Cir|Trail|Mews|Gardens|Grove|Row|Walk|Hill)\b\.?(?:,?\s*(?:Apt|Apartment|Suite|Ste|Unit|Flat|Fl|Floor|#)\.?\s*[A-Za-z0-9-]+)?/g
const STREET_DE =
  /\b[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ]?[a-zäöüß]+)*(?:straße|strasse|str\.|weg|gasse|platz|allee|ring|damm|ufer|chaussee)\s+\d{1,4}\s?[a-zA-Z]?\b/g
const STREET_DE_WORD = /\b(?:[A-ZÄÖÜ][a-zäöüß]+\s+){1,2}(?:Straße|Strasse|Weg|Gasse|Platz|Allee|Ring|Damm|Ufer)\s+\d{1,4}\s?[a-zA-Z]?\b/g
const STREET_FR =
  /\b\d{1,4}(?:\s?(?:bis|ter))?,?\s+(?:rue|avenue|av\.|boulevard|bd|place|allée|impasse|chemin|quai|route|cours)\s+(?:(?:de|du|des|la|le|l'|d')\s*)*[A-ZÉÈÀ][\w'’-]*(?:\s+(?:de\s+|du\s+|des\s+)?[A-ZÉÈÀ][\w'’-]*){0,3}/g
const STREET_ES_IT =
  /\b(?:Calle|C\/|Avenida|Avda\.|Plaza|Paseo|Carrer|Rua|Via|Viale|Piazza|Corso|Largo)\s+(?:(?:de|del|la|dei|della|delle|di)\s+)*[A-ZÁÉÍÓÚ][\wáéíóúñ'’-]*(?:\s+[A-ZÁÉÍÓÚ][\wáéíóúñ'’-]*){0,3},?\s+(?:n[º°.]?\s*)?\d{1,4}\b/g
const STREET_NL =
  /\b[A-Z][a-z]+(?:straat|laan|weg|plein|gracht|kade|singel|dijk|steeg)\s+\d{1,4}\s?[a-zA-Z]?\b/g

const UK_POSTCODE = /\b(?:[A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]?) ?\d[ABD-HJLNP-UW-Z]{2}\b/g
const CA_POSTCODE = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d\b/g
const US_STATE_ZIP =
  /\b(?:A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY])\.?,?\s+(\d{5}(?:-\d{4})?)\b/g
const ZIP4 = /(?<![\w-])\d{5}-\d{4}(?![\w-])/g
const EU_POSTCODE_CITY = /(?:^|\n|,\s*|\b(?:D|F|A|CH|I|E|B|L|NL)-)\s*(\d{4,5})\s+([A-ZÄÖÜÉÈ][a-zäöüßéèàç]+(?:[ -][A-ZÄÖÜÉÈ]?[a-zäöüßéèàç]+)?)\b/g
const NL_POSTCODE = /\b[1-9]\d{3} ?(?!SA|SD|SS)[A-Z]{2}\s+[A-Z][a-z]+/g

function findAddresses(text: string, push: Push) {
  for (const re of [STREET_EN, STREET_DE, STREET_DE_WORD, STREET_FR, STREET_ES_IT, STREET_NL]) {
    for (const m of text.matchAll(re)) {
      let value = m[0].replace(/[\s,]+$/, '')
      if (re === STREET_EN) {
        // "5 Dr" and "3 St" alone are too thin to be an address.
        if (!/\s[A-Z][A-Za-z'.-]*\s+\S/.test(value)) continue
        if (VERSION_CONTEXT.test(before(text, m.index, 10))) continue
      }
      value = value.trimEnd()
      push(m.index, m.index + value.length, 'ADDRESS', 'street', 0.8)
    }
  }
  for (const m of text.matchAll(UK_POSTCODE)) {
    if (!/\d[A-Z]{2}$/.test(m[0])) continue
    push(m.index, m.index + m[0].length, 'POSTCODE', 'uk-postcode', 0.8)
  }
  for (const m of text.matchAll(CA_POSTCODE)) push(m.index, m.index + m[0].length, 'POSTCODE', 'ca-postcode', 0.8)
  for (const m of text.matchAll(US_STATE_ZIP)) {
    const at = m.index + m[0].lastIndexOf(m[1])
    push(at, at + m[1].length, 'POSTCODE', 'us-zip', 0.85)
  }
  for (const m of text.matchAll(ZIP4)) push(m.index, m.index + m[0].length, 'POSTCODE', 'us-zip4', 0.7)
  for (const m of text.matchAll(EU_POSTCODE_CITY)) {
    const at = m.index + m[0].indexOf(m[1])
    const code = m[1]
    if (/^(?:19|20)\d\d$/.test(code)) continue // a year followed by a word
    push(at, at + code.length, 'POSTCODE', 'eu-postcode', 0.7)
  }
  for (const m of text.matchAll(NL_POSTCODE)) {
    const code = m[0].match(/^[1-9]\d{3} ?[A-Z]{2}/)?.[0]
    if (code && !/^(?:19|20)\d\d/.test(code)) push(m.index, m.index + code.length, 'POSTCODE', 'nl-postcode', 0.75)
  }
}

/* ------------------------------------------------------------------ */
/* Names with a title or a label                                      */
/* ------------------------------------------------------------------ */

const NAME = "[A-ZÀ-ÖØ-Þ][a-zß-öø-ÿ'’-]+"
const TITLED = new RegExp(
  `\\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Sir|Dame|Herr|Frau|Mme|Mlle|Sr|Sra|Srta|Sig|Sig\\.ra|Dott|Dott\\.ssa)\\.?\\s+((?:${NAME}\\s+){0,2}${NAME})`,
  'g',
)
const LABELLED = new RegExp(
  `\\b(?:[Nn]ame|[Ff]ull name|[Cc]ontact|[Pp]atient|[Cc]lient|[Ee]mployee|[Ss]igned|[Aa]ttn|[Aa]ttention|[Pp]repared by|[Aa]pproved by|[Ss]ent by|[Nn]ame des|[Nn]om|[Nn]ombre|[Nn]ome)\\s*:\\s*((?:${NAME}\\s+){1,3}${NAME}|${NAME})(?=\\s*(?:$|[\\n,;(]))`,
  'gm',
)

function findNames(text: string, push: Push) {
  for (const re of [TITLED, LABELLED]) {
    for (const m of text.matchAll(re)) {
      const name = m[1]
      const at = m.index + m[0].lastIndexOf(name)
      push(at, at + name.length, 'PERSON', re === TITLED ? 'titled-name' : 'labelled-name', 0.75)
    }
  }
}

/** All personal data rules. The result is not merged; overlapping spans are expected. */
export function findPii(text: string): Span[] {
  const out: Span[] = []
  const push = collector(out)
  findEmails(text, push)
  findUrls(text, push)
  findUsernames(text, push)
  findCards(text, push)
  findIbans(text, push)
  findIds(text, push)
  findPhones(text, push)
  findIpv4(text, push)
  findIpv6(text, push)
  findMacs(text, push)
  findDates(text, push)
  findAddresses(text, push)
  findNames(text, push)
  return out
}
