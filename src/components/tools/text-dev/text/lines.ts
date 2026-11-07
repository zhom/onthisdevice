/** Line and list engines. */

export const splitLines = (text: string) => text.split(/\r\n|\r|\n/)

export function addLineNumbers(text: string, opts: { start: number; separator: string; pad: boolean; skipEmpty: boolean }): string {
  const all = splitLines(text)
  const count = opts.skipEmpty ? all.filter((l) => l.trim() !== '').length : all.length
  const width = String(opts.start + Math.max(0, count - 1)).length
  let n = opts.start
  return all
    .map((l) => {
      if (opts.skipEmpty && l.trim() === '') return l
      const label = opts.pad ? String(n).padStart(width, '0') : String(n)
      n++
      return label + opts.separator + l
    })
    .join('\n')
}

export function wrapLines(text: string, opts: { prefix: string; suffix: string; skipEmpty: boolean }): string {
  return splitLines(text)
    .map((l) => (opts.skipEmpty && l.trim() === '' ? l : opts.prefix + l + opts.suffix))
    .join('\n')
}

/** Splits text into pieces by a delimiter, a character count or a word count. */
export function splitText(text: string, by: 'delimiter' | 'characters' | 'words' | 'sentences', size: number, delimiter: string): string[] {
  if (by === 'delimiter') {
    if (delimiter === '') return [text]
    const sep = delimiter.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
    return text.split(sep)
  }
  if (by === 'sentences') {
    return (text.replace(/\s+/g, ' ').match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) ?? []).map((s) => s.trim()).filter(Boolean)
  }
  const n = Math.max(1, Math.floor(size))
  if (by === 'words') {
    const words = text.split(/\s+/).filter(Boolean)
    const out: string[] = []
    for (let i = 0; i < words.length; i += n) out.push(words.slice(i, i + n).join(' '))
    return out
  }
  // Characters: break at the last space inside the limit when there is one, so words stay whole.
  const out: string[] = []
  const flat = text.replace(/\s+/g, ' ').trim()
  let i = 0
  while (i < flat.length) {
    let end = Math.min(flat.length, i + n)
    if (end < flat.length) {
      const space = flat.lastIndexOf(' ', end)
      if (space > i) end = space
    }
    out.push(flat.slice(i, end).trim())
    i = end
    while (flat[i] === ' ') i++
  }
  return out
}

/** Hard-wraps each paragraph at `width` columns. Long words break only when asked. */
export function wrapText(text: string, width: number, breakWords: boolean): string {
  const w = Math.max(1, Math.floor(width))
  return splitLines(text)
    .map((line) => {
      if (line.length <= w) return line
      const indent = /^\s*/.exec(line)?.[0] ?? ''
      const words = line.trim().split(/\s+/)
      const out: string[] = []
      let cur = indent
      const push = () => {
        if (cur.trim() !== '') out.push(cur.trimEnd())
        cur = indent
      }
      for (let word of words) {
        while (breakWords && word.length > w - indent.length) {
          if (cur.trim() !== '') push()
          const room = Math.max(1, w - indent.length)
          out.push(indent + word.slice(0, room))
          word = word.slice(room)
        }
        if (word === '') continue
        const next = cur.trim() === '' ? indent + word : `${cur} ${word}`
        if (next.length > w && cur.trim() !== '') {
          push()
          cur = indent + word
        } else cur = next
      }
      push()
      return out.join('\n')
    })
    .join('\n')
}

export interface ListOptions {
  separator: string
  quote: string
  trim: boolean
  dedupe: boolean
  wrap: string
}

export function listToDelimited(text: string, o: ListOptions): { text: string; count: number } {
  let items = splitLines(text).map((l) => (o.trim ? l.trim() : l))
  items = items.filter((l) => l.trim() !== '')
  if (o.dedupe) items = [...new Set(items)]
  const q = o.quote
  const quoted = items.map((i) => (q ? q + i.split(q).join(q === "'" ? "''" : `\\${q}`) + q : i))
  const body = quoted.join(o.separator)
  const [open, close] = o.wrap === '()' ? ['(', ')'] : o.wrap === '[]' ? ['[', ']'] : ['', '']
  return { text: open + body + close, count: items.length }
}

/** Splits a delimited list into lines. `auto` picks the most common of comma, semicolon, tab and pipe. */
export function delimitedToList(text: string, o: { separator: string; trim: boolean; dedupe: boolean; unquote: boolean }): { text: string; count: number; separator: string } {
  let sep = o.separator
  if (sep === 'auto') {
    const counts = [',', ';', '\t', '|'].map((s) => [s, text.split(s).length - 1] as const)
    const best = counts.sort((a, b) => b[1] - a[1])[0]
    sep = best[1] > 0 ? best[0] : /\n/.test(text) ? '\n' : ' '
  }
  const flat = sep === '\n' ? text : text.replace(/\r?\n/g, sep === ' ' ? ' ' : sep)
  let items = splitRespectingQuotes(flat, sep)
  if (o.trim) items = items.map((i) => i.trim())
  if (o.unquote) items = items.map((i) => (/^(["']).*\1$/s.test(i) ? i.slice(1, -1) : i))
  items = items.filter((i) => i !== '')
  if (o.dedupe) items = [...new Set(items)]
  return { text: items.join('\n'), count: items.length, separator: sep }
}

function splitRespectingQuotes(text: string, sep: string): string[] {
  if (sep === ' ') return text.split(/\s+/)
  const out: string[] = []
  let cur = ''
  let quote = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      cur += c
      if (c === quote) quote = ''
    } else if ((c === '"' || c === "'") && cur.trim() === '') {
      quote = c
      cur += c
    } else if (text.startsWith(sep, i)) {
      out.push(cur)
      cur = ''
      i += sep.length - 1
    } else cur += c
  }
  out.push(cur)
  return out
}
