/** HTML and SVG markup to JSX: attribute names, inline styles, void elements, comments and braces in text. */

const RENAME: Record<string, string> = {
  class: 'className', for: 'htmlFor', 'accept-charset': 'acceptCharset', 'http-equiv': 'httpEquiv', accesskey: 'accessKey',
  allowfullscreen: 'allowFullScreen', autocomplete: 'autoComplete', autofocus: 'autoFocus', autoplay: 'autoPlay',
  cellpadding: 'cellPadding', cellspacing: 'cellSpacing', charset: 'charSet', colspan: 'colSpan', contenteditable: 'contentEditable',
  crossorigin: 'crossOrigin', datetime: 'dateTime', enctype: 'encType', formaction: 'formAction', frameborder: 'frameBorder',
  inputmode: 'inputMode', maxlength: 'maxLength', minlength: 'minLength', novalidate: 'noValidate', readonly: 'readOnly',
  referrerpolicy: 'referrerPolicy', rowspan: 'rowSpan', spellcheck: 'spellCheck', srcdoc: 'srcDoc', srclang: 'srcLang',
  srcset: 'srcSet', tabindex: 'tabIndex', usemap: 'useMap', playsinline: 'playsInline', enterkeyhint: 'enterKeyHint',
  'xlink:href': 'xlinkHref', 'xml:space': 'xmlSpace', 'xml:lang': 'xmlLang', 'xmlns:xlink': 'xmlnsXlink', itemprop: 'itemProp',
  itemscope: 'itemScope', itemtype: 'itemType', itemid: 'itemID', fetchpriority: 'fetchPriority', popovertarget: 'popoverTarget',
}

const EVENTS = [
  'click', 'dblclick', 'change', 'input', 'submit', 'keydown', 'keyup', 'keypress', 'focus', 'blur', 'load', 'error', 'scroll',
  'mousedown', 'mouseup', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'mousemove', 'contextmenu', 'touchstart',
  'touchend', 'touchmove', 'pointerdown', 'pointerup', 'pointermove', 'wheel', 'drag', 'drop', 'dragover', 'dragstart', 'dragend',
  'reset', 'select', 'copy', 'paste', 'cut', 'play', 'pause', 'ended',
]
const EVENT_NAME = new Map(
  EVENTS.map((e) => [
    `on${e}`,
    `on${e
      .replace(/^(dbl|key|mouse|touch|pointer|drag|context)(.*)$/, (_m, a: string, b: string) => `${a}_${b}`)
      .split('_')
      .map((p) => (p === 'dbl' ? 'Double' : p.charAt(0).toUpperCase() + p.slice(1)))
      .join('')}`,
  ]),
)

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param'])

const camel = (s: string) => s.replace(/[-:]([a-z])/g, (_m, c: string) => c.toUpperCase())

function attrName(name: string): string {
  const lower = name.toLowerCase()
  if (lower.startsWith('data-') || lower.startsWith('aria-')) return lower
  if (RENAME[lower]) return RENAME[lower]
  if (EVENT_NAME.has(lower)) return EVENT_NAME.get(lower) ?? name
  // SVG presentation attributes such as stroke-width; names that are already camelCase (viewBox) stay.
  return name.includes('-') || name.includes(':') ? camel(name) : name
}

function styleObject(css: string): string {
  const parts = css
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(':')
      if (i < 0) return null
      const prop = d.slice(0, i).trim()
      const value = d.slice(i + 1).trim()
      const key = prop.startsWith('--') ? `'${prop}'` : prop.replace(/^-(webkit|moz|ms|o)-/, (_m, v: string) => (v === 'ms' ? 'ms-' : `${v.charAt(0).toUpperCase()}${v.slice(1)}-`)).replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())
      const val = /^-?\d+(\.\d+)?$/.test(value) && prop !== 'z-index' ? value : `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
      return `${key}: ${val}`
    })
    .filter(Boolean)
  return `{{ ${parts.join(', ')} }}`
}

function convertAttrs(raw: string): string {
  const out: string[] = []
  const re = /([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g
  for (const m of raw.matchAll(re)) {
    const name = attrName(m[1])
    let value = m[2]
    if (value === undefined) {
      out.push(name)
      continue
    }
    if (/^['"]/.test(value)) value = value.slice(1, -1)
    if (name === 'style') out.push(`style=${styleObject(value)}`)
    else if (/^on[A-Z]/.test(name)) out.push(`${name}={() => { ${value.trim().replace(/;$/, '')} }}`)
    else out.push(`${name}=${JSON.stringify(value)}`)
  }
  return out.length ? ` ${out.join(' ')}` : ''
}

export interface JsxOptions {
  component: string
  svg: boolean
  dropSize: boolean
}

export function toJsx(markup: string, o: JsxOptions): string {
  let src = markup.trim().replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!doctype[^>]*>/gi, '')
  if (o.svg) src = src.replace(/<!--[\s\S]*?-->/g, '').replace(/<(metadata|title)\b[\s\S]*?<\/\1>/gi, '')
  const re = /<!--([\s\S]*?)-->|<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g
  let out = ''
  let roots = 0
  let depth = 0
  for (const m of src.matchAll(re)) {
    const [, comment, closing, tag, attrs = '', selfClose, text] = m
    if (comment !== undefined) {
      out += `{/*${comment.replace(/\*\//g, '* /')}*/}`
    } else if (text !== undefined) {
      if (depth === 0 && text.trim() === '') continue
      out += text.replace(/[{}]/g, (c) => `{'${c}'}`).replace(/&nbsp;/g, '&#160;')
    } else if (tag) {
      if (closing) {
        depth--
        out += `</${tag}>`
        continue
      }
      let a = convertAttrs(attrs)
      if (o.svg && tag.toLowerCase() === 'svg' && depth === 0) {
        a = a.replace(/ xmlnsXlink="[^"]*"/, '')
        if (o.dropSize) a = a.replace(/ (width|height)="[^"]*"/g, '')
        if (o.component) a += ' {...props}'
      }
      if (depth === 0) roots++
      if (selfClose || VOID.has(tag.toLowerCase())) out += `<${tag}${a} />`
      else {
        out += `<${tag}${a}>`
        depth++
      }
    }
  }
  const body = roots > 1 ? `<>\n${out}\n</>` : out
  if (!o.component) return body
  const name = o.component.replace(/[^A-Za-z0-9_$]/g, '') || 'Component'
  const props = o.svg ? 'props' : ''
  const indented = body
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n')
  return `export default function ${name}(${props}) {\n  return (\n${indented}\n  )\n}\n`
}
