/** Finds emails, URLs, numbers, phone numbers, hashtags and IP addresses in text. */

export interface Found {
  items: string[]
  /** Matches before duplicates were removed. */
  total: number
}

function finish(matches: string[], unique: boolean, sort: boolean): Found {
  let items = matches
  if (unique) items = [...new Set(items)]
  if (sort) items = [...items].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  return { items, total: matches.length }
}

export function extractEmails(text: string, o: { unique: boolean; sort: boolean; lower: boolean }): Found {
  const re = /[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}/g
  const found = (text.match(re) ?? []).map((e) => (o.lower ? e.toLowerCase() : e))
  return finish(found, o.unique, o.sort)
}

/** Trailing punctuation is part of the sentence, not the URL; a closing bracket stays when the URL opened one. */
function trimUrl(url: string): string {
  let u = url.replace(/[.,;:!?'"*]+$/, '')
  while (/[)\]]$/.test(u)) {
    const close = u.at(-1) === ')' ? ')' : ']'
    const open = close === ')' ? '(' : '['
    if (u.split(open).length >= u.split(close).length) break
    u = u.slice(0, -1).replace(/[.,;:!?'"*]+$/, '')
  }
  return u
}

export function extractUrls(text: string, o: { unique: boolean; sort: boolean; www: boolean }): Found {
  const re = o.www ? /\b(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"'`]+/gi : /\b(?:https?|ftp):\/\/[^\s<>"'`]+/gi
  const found = (text.match(re) ?? []).map(trimUrl).filter((u) => u.length > 4)
  return finish(found, o.unique, o.sort)
}

/** Parses "1,234.5", "-3", "2.5e3" and "1 000" style numbers. `decimal` is "." or ",". */
export function extractNumbers(text: string, o: { decimal: '.' | ','; unique: boolean; sort: boolean }): { found: Found; values: number[] } {
  const re =
    o.decimal === '.'
      ? /(?<![\p{L}\d.])[-+−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:[eE][-+]?\d+)?|(?<![\p{L}\d])[-+−]?\.\d+/gu
      : /(?<![\p{L}\d,])[-+−]?(?:\d{1,3}(?:[. ]\d{3})+|\d+)(?:,\d+)?(?:[eE][-+]?\d+)?/gu
  const raw = text.match(re) ?? []
  const toNumber = (s: string) =>
    Number((o.decimal === '.' ? s.replace(/,/g, '') : s.replace(/[. ]/g, '').replace(',', '.')).replace('−', '-'))
  const pairs = raw.map((s) => [s, toNumber(s)] as const).filter(([, n]) => Number.isFinite(n))
  let items = pairs.map(([s]) => s)
  let values = pairs.map(([, n]) => n)
  if (o.unique) {
    const seen = new Set<number>()
    const kept = pairs.filter(([, n]) => (seen.has(n) ? false : (seen.add(n), true)))
    items = kept.map(([s]) => s)
    values = kept.map(([, n]) => n)
  }
  if (o.sort) {
    const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
    items = order.map(([, i]) => items[i])
    values = order.map(([v]) => v)
  }
  return { found: { items, total: raw.length }, values }
}

/**
 * Phone numbers: an optional +country code, then 7 to 15 digits in groups split by spaces, dots,
 * dashes or brackets. Dates (2024-01-02) and plain long numbers without a separator are skipped.
 */
export function extractPhones(text: string, o: { unique: boolean; normalize: boolean }): Found {
  const re = /(?<![\w+])(?:\+|00)?\(?\d{1,4}\)?(?:[\s.-]?\(?\d{1,5}\)?){1,6}(?![\w])/g
  const found: string[] = []
  for (const m of text.matchAll(re)) {
    const s = m[0].trim()
    const digits = s.replace(/\D/g, '')
    if (digits.length < 7 || digits.length > 15) continue
    if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(s) || /^\d{1,2}[-./]\d{1,2}[-./]\d{2,4}$/.test(s)) continue
    if (!/[\s.()-]/.test(s) && !s.startsWith('+')) continue
    found.push(o.normalize ? (/^(\+|00)/.test(s) ? `+${digits.replace(/^00/, '')}` : digits) : s)
  }
  return finish(found, o.unique, false)
}

export function extractTags(text: string, o: { kind: 'hashtags' | 'mentions'; unique: boolean; sort: boolean; lower: boolean }): Found {
  const re = o.kind === 'hashtags' ? /(?<![\p{L}\p{N}_&/#])#([\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)/gu : /(?<![\p{L}\p{N}_.@/])@([A-Za-z0-9_](?:[A-Za-z0-9_.]*[A-Za-z0-9_])?)/gu
  const sign = o.kind === 'hashtags' ? '#' : '@'
  const found = [...text.matchAll(re)].map((m) => sign + (o.lower ? m[1].toLowerCase() : m[1]))
  return finish(found, o.unique, o.sort)
}

const IPV4 = /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\/(?:3[0-2]|[12]?\d))?(?![\d.]\d)/g
const IPV6 = /(?<![\w:])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?:%\w+)?(?:\/\d{1,3})?(?![\w:])/gi

export function isIpv6(s: string): boolean {
  const addr = s.replace(/%\w+$/, '').replace(/\/\d+$/, '')
  if (!/^[0-9a-f:]+$/i.test(addr) || !addr.includes(':')) return false
  const doubles = addr.split('::').length - 1
  if (doubles > 1) return false
  const groups = addr.split(':').filter((g, i, all) => !(g === '' && (i === 0 || i === all.length - 1 || doubles)))
  if (groups.some((g) => g.length > 4 || g === '')) return false
  return doubles ? groups.length < 8 : groups.length === 8
}

export function extractIps(text: string, o: { v6: boolean; unique: boolean; sort: boolean }): Found {
  const found = [...(text.match(IPV4) ?? [])]
  if (o.v6) for (const m of text.match(IPV6) ?? []) if (isIpv6(m)) found.push(m)
  return finish(found, o.unique, o.sort)
}
