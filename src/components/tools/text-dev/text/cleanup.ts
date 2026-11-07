/** Text clean-up engines. Pure functions of the text and their options. */

const lines = (text: string) => text.split(/\r\n|\r|\n/)

export function removeExtraSpaces(text: string, opts: { trim: boolean; tabs: boolean }): string {
  const run = opts.tabs ? /[ \t\u00a0\u2000-\u200a\u202f\u205f\u3000]{2,}|[\t\u00a0\u2000-\u200a\u202f\u205f\u3000]/g : / {2,}/g
  return lines(text)
    .map((l) => {
      const collapsed = l.replace(run, ' ')
      return opts.trim ? collapsed.trim() : collapsed
    })
    .join('\n')
}

export function removeEmptyLines(text: string, opts: { keepParagraphs: boolean }): string {
  const out: string[] = []
  let blank = false
  for (const l of lines(text)) {
    if (l.trim() === '') {
      blank = true
      continue
    }
    if (blank && opts.keepParagraphs && out.length > 0) out.push('')
    blank = false
    out.push(l)
  }
  return out.join('\n')
}

export function removePunctuation(text: string, opts: { apostrophes: boolean; hyphens: boolean; symbols: boolean }): string {
  let out = text
  // Keep apostrophes and hyphens between letters (don't, well-known) when asked.
  if (opts.apostrophes) out = out.replace(/(\p{L})['’](\p{L})/gu, '$1\u0001$2')
  if (opts.hyphens) out = out.replace(/(\p{L})-(?=\p{L})/gu, '$1\u0002')
  out = out.replace(opts.symbols ? /[\p{P}\p{S}]/gu : /\p{P}/gu, '')
  return out.replace(/\u0001/g, "'").replace(/\u0002/g, '-')
}

export function removeNumbers(text: string, opts: { whole: boolean; tidy: boolean }): string {
  const re = opts.whole ? /[-+]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?%?/gi : /\p{Nd}/gu
  const out = text.replace(re, '')
  return opts.tidy ? lines(out).map((l) => l.replace(/ {2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').trim()).join('\n') : out
}

const SPECIAL_LETTERS: Record<string, string> = {
  ß: 'ss', ẞ: 'SS', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE', ø: 'o', Ø: 'O', đ: 'd', Đ: 'D', ð: 'd', Ð: 'D',
  þ: 'th', Þ: 'Th', ł: 'l', Ł: 'L', ı: 'i', ŋ: 'n', Ŋ: 'N', ħ: 'h', Ħ: 'H', ŧ: 't', Ŧ: 'T', ĸ: 'k',
}

/** Removes diacritics: é to e, ñ to n, plus letters that have no combining mark (ø, ß, ł). */
export function removeAccents(text: string, opts: { letters: boolean }): string {
  const stripped = text.normalize('NFD').replace(/\p{Mn}/gu, '').normalize('NFC')
  return opts.letters ? stripped.replace(/[ßẞæÆœŒøØđĐðÐþÞłŁıŋŊħĦŧŦĸ]/g, (c) => SPECIAL_LETTERS[c] ?? c) : stripped
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', hellip: '…',
  mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·', euro: '€',
  pound: '£', yen: '¥', cent: '¢', sect: '§', deg: '°', times: '×', divide: '÷', laquo: '«', raquo: '»',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === '#') {
      const cp = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m
    }
    return ENTITIES[body.toLowerCase()] ?? m
  })
}

const BLOCK = /<\/?(?:p|div|br|li|ul|ol|tr|table|h[1-6]|section|article|header|footer|blockquote|pre|hr|dd|dt|dl)\b[^>]*>/gi

export function stripHtml(html: string, opts: { breaks: boolean; entities: boolean }): string {
  let out = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1\s*>/gi, '')
  if (opts.breaks) {
    out = out.replace(/<li\b[^>]*>/gi, '\n- ').replace(BLOCK, '\n').replace(/<\/t[dh]>/gi, '\t')
  }
  out = out.replace(/<[^>]*>/g, opts.breaks ? '' : ' ')
  if (opts.entities) out = decodeEntities(out)
  const tidy = lines(out).map((l) => l.replace(/[ \t]+/g, ' ').trim())
  return removeEmptyLines(tidy.join('\n'), { keepParagraphs: false })
}

export function removeSpecial(text: string, opts: { punctuation: boolean; accents: boolean }): string {
  const keep = opts.punctuation ? /[^\p{L}\p{N}\s.,;:!?'"()\-]/gu : /[^\p{L}\p{N}\s]/gu
  const base = opts.accents ? text : removeAccents(text, { letters: true })
  return base.replace(keep, '')
}

/** Emoji: pictographs with their modifiers, joiners, variation selectors, keycaps and flags. */
const EMOJI =
  /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]\ufe0f?\u20e3)(?:[\u{1F3FB}-\u{1F3FF}\ufe0f\u20e3]|\u200d(?:\p{Extended_Pictographic}|\p{Emoji_Component}))*|[\u{1F3FB}-\u{1F3FF}]|\ufe0f|[\u{E0020}-\u{E007F}]/gu

/** Characters that match EMOJI on their own but are normal text: digits, # and *, (c), (r), TM. */
const TEXT_SYMBOL = /^[#*0-9\u00a9\u00ae\u2122\u203c\u2049]$/

export function removeEmoji(text: string, opts: { tidy: boolean }): string {
  const out = text.replace(EMOJI, (m) => (TEXT_SYMBOL.test(m) ? m : ''))
  return opts.tidy ? lines(out).map((l) => l.replace(/ {2,}/g, ' ').trimEnd()).join('\n') : out
}

export function countEmoji(text: string): number {
  return (text.match(EMOJI) ?? []).filter((m) => !TEXT_SYMBOL.test(m)).length
}

export function removeNonAscii(text: string, opts: { transliterate: boolean; keepLines: boolean }): string {
  const base = opts.transliterate ? smartToStraight(removeAccents(text, { letters: true }), { dashes: true }) : text
  return base.replace(opts.keepLines ? /[^\x20-\x7e\t\n]/g : /[^\x20-\x7e]/g, '')
}

export function smartToStraight(text: string, opts: { dashes: boolean }): string {
  let out = text
    .replace(/[“”„‟″〝〞＂]/g, '"')
    .replace(/[‘’‚‛′＇]/g, "'")
    .replace(/[«»]/g, '"')
    .replace(/[‹›]/g, "'")
  if (opts.dashes) {
    out = out.replace(/[\u2013\u2014\u2015\u2012\u2212]/g, '-').replace(/\u2026/g, '...').replace(/[\u00a0\u202f\u2009]/g, ' ')
  }
  return out
}

/** Straight quotes to typographic quotes: an opening quote follows a space, bracket or line start. */
export function straightToSmart(text: string): string {
  return text
    .replace(/(^|[\s([{<—–-])"/gm, '$1“')
    .replace(/"/g, '”')
    .replace(/(\p{L})'(\p{L})/gu, '$1’$2')
    .replace(/(^|[\s([{<—–-])'/gm, '$1‘')
    .replace(/'/g, '’')
}

export function tabsToSpaces(text: string, width: number): string {
  return lines(text)
    .map((l) => {
      let out = ''
      for (const ch of l) {
        if (ch === '\t') out += ' '.repeat(width - (out.length % width))
        else out += ch
      }
      return out
    })
    .join('\n')
}

export function spacesToTabs(text: string, width: number, leadingOnly: boolean): string {
  return lines(text)
    .map((l) => {
      if (leadingOnly) {
        const lead = /^ */.exec(l)?.[0].length ?? 0
        return '\t'.repeat(Math.floor(lead / width)) + ' '.repeat(lead % width) + l.slice(lead)
      }
      const re = new RegExp(` {${width}}`, 'g')
      return l.replace(re, '\t')
    })
    .join('\n')
}

export function removeDuplicateWords(text: string, opts: { everywhere: boolean; caseSensitive: boolean }): { text: string; removed: number } {
  let removed = 0
  const key = (w: string) => (opts.caseSensitive ? w : w.toLowerCase())
  if (!opts.everywhere) {
    const out = text.replace(/\b(\p{L}[\p{L}'’]*)(?:\s+\1\b)+/giu, (m, w: string) => {
      const parts = m.split(/\s+/)
      const same = parts.filter((p) => key(p) === key(w)).length
      if (same !== parts.length) return m
      removed += parts.length - 1
      return w
    })
    return { text: out, removed }
  }
  const seen = new Set<string>()
  const out = lines(text)
    .map((l) =>
      l
        .replace(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu, (w) => {
          const k = key(w)
          if (seen.has(k)) {
            removed++
            return ''
          }
          seen.add(k)
          return w
        })
        .replace(/ {2,}/g, ' ')
        .replace(/ +([,.;:!?])/g, '$1')
        .trim(),
    )
    .join('\n')
  return { text: out, removed }
}
