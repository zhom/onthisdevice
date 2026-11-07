/** CSS and HTML minifiers that only make changes that cannot alter how the page renders. */

/** Splits CSS into strings, comments and the rest, so that edits never touch the inside of a string. */
function cssTokens(css: string): { kind: 'str' | 'comment' | 'code'; text: string }[] {
  const out: { kind: 'str' | 'comment' | 'code'; text: string }[] = []
  let i = 0
  let code = ''
  const flush = () => {
    if (code) out.push({ kind: 'code', text: code })
    code = ''
  }
  while (i < css.length) {
    const c = css[i]
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      const stop = end < 0 ? css.length : end + 2
      flush()
      out.push({ kind: 'comment', text: css.slice(i, stop) })
      i = stop
    } else if (c === '"' || c === "'") {
      let j = i + 1
      while (j < css.length && css[j] !== c) {
        if (css[j] === '\\') j++
        if (css[j] === '\n') break
        j++
      }
      flush()
      out.push({ kind: 'str', text: css.slice(i, j + 1) })
      i = j + 1
    } else {
      code += c
      i++
    }
  }
  flush()
  return out
}

export function minifyCss(css: string, o: { keepLicense: boolean; shortenColors: boolean }): string {
  // Strings and kept comments are copied as they are; everything else is code, with comments turned into spaces.
  const chunks: { keep: boolean; text: string }[] = []
  for (const t of cssTokens(css)) {
    const keep = t.kind === 'str' || (t.kind === 'comment' && o.keepLicense && t.text.startsWith('/*!'))
    const text = keep ? t.text : t.kind === 'comment' ? ' ' : t.text
    const prev = chunks.at(-1)
    if (!keep && prev && !prev.keep) prev.text += text
    else chunks.push({ keep, text })
  }
  let depth = 0
  const squeeze = (code: string) => {
    // Spaces around , { } ; are never needed; after : neither. Combinators > ~ + only outside brackets (calc needs its spaces).
    // A space before : is kept in selectors (a :hover) and dropped in declarations, which end at ; or } before any {.
    const s = code
      .replace(/\s+/g, ' ')
      .replace(/\s*([{};,])\s*/g, '$1')
      .replace(/:\s+/g, ':')
      .replace(/ :(?=[^{};]*[;}])/g, ':')
    let out = ''
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]
      if (ch === '(') depth++
      else if (ch === ')') depth = Math.max(0, depth - 1)
      if (depth === 0 && (ch === '>' || ch === '~' || ch === '+') && !/[\d.]/.test(s[i + 1] ?? '')) {
        out = out.replace(/ $/, '') + ch
        while (s[i + 1] === ' ') i++
        continue
      }
      out += ch
    }
    out = out.replace(/;+}/g, '}')
    return o.shortenColors ? out.replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3\b/gi, '#$1$2$3') : out
  }
  return chunks
    .map((c) => (c.keep ? (c.text.startsWith('/*!') ? `${c.text}\n` : c.text) : squeeze(c.text)))
    .join('')
    .trim()
}

const BLOCK = new Set(
  'html head body div p ul ol li dl dt dd table thead tbody tfoot tr td th caption section article aside header footer nav main h1 h2 h3 h4 h5 h6 meta link title script style br hr form fieldset legend select option optgroup figure figcaption blockquote pre address details summary dialog noscript template iframe video audio source track canvas svg picture base'.split(
    ' ',
  ),
)
const RAW = /^<(pre|textarea|script|style)\b/i

function tagName(tag: string): string {
  return (/^<\/?([a-zA-Z][\w:-]*)/.exec(tag)?.[1] ?? '').toLowerCase()
}

/** Collapses the whitespace between attributes of a tag, keeping quoted values as they are. */
function tidyTag(tag: string): string {
  return tag.replace(/("[^"]*"|'[^']*')|\s+/g, (m, quoted: string | undefined) => quoted ?? ' ').replace(/\s*(\/?>)$/, '$1').replace(/\s*=\s*/g, '=')
}

export function minifyHtml(html: string, o: { comments: boolean; css: boolean }): string {
  // Tokens: comments, raw blocks (pre, textarea, script, style), tags and text.
  const re = /<!--[\s\S]*?-->|<(pre|textarea|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<!doctype[^>]*>|<\/?[a-zA-Z][^>]*>/gi
  const tokens: { kind: 'tag' | 'text' | 'raw' | 'comment'; text: string }[] = []
  let last = 0
  for (const m of html.matchAll(re)) {
    if (m.index > last) tokens.push({ kind: 'text', text: html.slice(last, m.index) })
    const t = m[0]
    tokens.push({ kind: t.startsWith('<!--') ? 'comment' : RAW.test(t) ? 'raw' : 'tag', text: t })
    last = m.index + t.length
  }
  if (last < html.length) tokens.push({ kind: 'text', text: html.slice(last) })

  const out: string[] = []
  tokens.forEach((t, i) => {
    if (t.kind === 'comment') {
      if (!o.comments || /^<!--\[if/i.test(t.text)) out.push(t.text)
      return
    }
    if (t.kind === 'raw') {
      const open = /^<[^>]*>/.exec(t.text)?.[0] ?? ''
      const name = tagName(open)
      const close = /<\/[^>]*>$/.exec(t.text)?.[0] ?? ''
      const body = t.text.slice(open.length, t.text.length - close.length)
      out.push(tidyTag(open) + (name === 'style' && o.css ? minifyCss(body, { keepLicense: true, shortenColors: true }) : body) + close)
      return
    }
    if (t.kind === 'tag') {
      out.push(tidyTag(t.text))
      return
    }
    // Text: collapse whitespace; drop it entirely next to block-level tags.
    let s = t.text.replace(/\s+/g, ' ')
    const prev = tokens[i - 1]
    const next = tokens[i + 1]
    const blockBefore = !prev || (prev.kind !== 'text' && BLOCK.has(tagName(prev.text))) || prev.kind === 'comment'
    const blockAfter = !next || (next.kind !== 'text' && BLOCK.has(tagName(next.text))) || next.kind === 'comment'
    if (blockBefore) s = s.trimStart()
    if (blockAfter) s = s.trimEnd()
    if (s) out.push(s)
  })
  return out.join('')
}
