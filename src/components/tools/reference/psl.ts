/** Public Suffix List matching and punycode decoding (pure, unit-tested in scripts/data/test.mjs). */

export interface SuffixRules {
  icann: Set<string>
  private: Set<string>
}

export function buildRules(list: { icann: string[]; private: string[] }): SuffixRules {
  return { icann: new Set(list.icann), private: new Set(list.private) }
}

export interface SuffixMatch {
  /** The public suffix, e.g. "co.uk". */
  suffix: string
  /** The registrable domain (suffix plus one label), or null when the host is itself a suffix. */
  domain: string | null
  /** Labels left of the registrable domain. */
  subdomain: string
  /** Which part of the list the rule came from; 'default' when no rule matched (the TLD itself). */
  section: 'icann' | 'private' | 'default'
  rule: string
}

/** The PSL algorithm: exceptions win, then the rule with the most labels, else "*". */
export function matchSuffix(host: string, rules: SuffixRules, includePrivate = true): SuffixMatch {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.')
  let best: { length: number; rule: string; section: 'icann' | 'private' } | null = null
  let exception: { length: number; rule: string; section: 'icann' | 'private' } | null = null
  const sections: ('icann' | 'private')[] = includePrivate ? ['icann', 'private'] : ['icann']
  for (let i = 0; i < labels.length; i++) {
    const name = labels.slice(i).join('.')
    const wild = i + 1 < labels.length + 1 ? ['*', ...labels.slice(i + 1)].join('.') : ''
    for (const section of sections) {
      const set = rules[section]
      if (set.has(`!${name}`) && (!exception || labels.length - i > exception.length)) exception = { length: labels.length - i, rule: `!${name}`, section }
      for (const candidate of [name, wild]) {
        if (candidate && set.has(candidate) && (!best || labels.length - i > best.length)) best = { length: labels.length - i, rule: candidate, section }
      }
    }
  }
  let length: number
  let rule: string
  let section: SuffixMatch['section']
  if (exception) {
    length = exception.length - 1
    rule = exception.rule
    section = exception.section
  } else if (best) {
    length = best.length
    rule = best.rule
    section = best.section
  } else {
    length = 1
    rule = '*'
    section = 'default'
  }
  const suffix = labels.slice(labels.length - length).join('.')
  const domain = labels.length > length ? labels.slice(labels.length - length - 1).join('.') : null
  const subdomain = labels.length > length + 1 ? labels.slice(0, labels.length - length - 1).join('.') : ''
  return { suffix, domain, subdomain, section, rule }
}

/** Hostname from what a person types: a URL, an email address or a bare host. ASCII (punycode) or null. */
export function hostFrom(input: string, toAscii: (host: string) => string | null): string | null {
  let t = input.trim()
  if (!t) return null
  t = t.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/)[0]
  t = t.slice(t.lastIndexOf('@') + 1).replace(/:\d+$/, '')
  t = t.replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!t || t.length > 253) return null
  const ascii = toAscii(t)
  if (!ascii) return null
  const labels = ascii.split('.')
  if (labels.some((l) => !l || l.length > 63 || !/^[a-z0-9_-]+$/i.test(l))) return null
  return ascii.toLowerCase()
}

/* RFC 3492 punycode decoding, for showing internationalised labels. */
const BASE = 36
const T_MIN = 1
const T_MAX = 26
const SKEW = 38
const DAMP = 700

function adapt(delta: number, numPoints: number, first: boolean): number {
  let d = first ? Math.floor(delta / DAMP) : delta >> 1
  d += Math.floor(d / numPoints)
  let k = 0
  while (d > ((BASE - T_MIN) * T_MAX) >> 1) {
    d = Math.floor(d / (BASE - T_MIN))
    k += BASE
  }
  return k + Math.floor(((BASE - T_MIN + 1) * d) / (d + SKEW))
}

function digit(c: number): number {
  if (c >= 48 && c <= 57) return c - 22
  if (c >= 65 && c <= 90) return c - 65
  if (c >= 97 && c <= 122) return c - 97
  return BASE
}

export function decodePunycode(input: string): string | null {
  const out: number[] = []
  const last = input.lastIndexOf('-')
  for (let j = 0; j < Math.max(0, last); j++) out.push(input.charCodeAt(j))
  let n = 128
  let bias = 72
  let i = 0
  for (let idx = last > 0 ? last + 1 : 0; idx < input.length; ) {
    const oldi = i
    let w = 1
    for (let k = BASE; ; k += BASE) {
      if (idx >= input.length) return null
      const d = digit(input.charCodeAt(idx++))
      if (d >= BASE) return null
      i += d * w
      const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias
      if (d < t) break
      w *= BASE - t
    }
    bias = adapt(i - oldi, out.length + 1, oldi === 0)
    n += Math.floor(i / (out.length + 1))
    i %= out.length + 1
    out.splice(i++, 0, n)
  }
  return String.fromCodePoint(...out)
}

/** "xn--bcher-kva.example" -> "bücher.example" (labels that fail to decode stay as they are). */
export function toUnicode(host: string): string {
  return host
    .split('.')
    .map((l) => (l.startsWith('xn--') ? (decodePunycode(l.slice(4)) ?? l) : l))
    .join('.')
}
