/**
 * XML formatting, validation, minification and escaping for the `dev-format`
 * batch.
 *
 * Parsing uses the browser's own `DOMParser` — the same XML parser the browser
 * ships for XHR and XSLT — so validity here means validity in a real consumer,
 * and no third-party parser is bundled. Every entry point guards on `DOMParser`
 * being present so the module is safe to import during Astro's SSR pass.
 */

export interface XmlParseError {
  ok: false
  message: string
  line: number | null
  column: number | null
  /** Raw text of the browser's <parsererror> node, for the "details" disclosure. */
  raw: string
}

export interface XmlParseOk {
  ok: true
  doc: XMLDocument
}

export type XmlParseResult = XmlParseOk | XmlParseError

const PARSER_UNAVAILABLE: XmlParseError = {
  ok: false,
  message: 'XML parsing needs a browser. Reload the page and try again.',
  line: null,
  column: null,
  raw: '',
}

/**
 * Browsers report XML errors as a `<parsererror>` element rather than throwing,
 * and each engine words it differently. These patterns cover Chromium, Firefox
 * and WebKit.
 */
function extractPosition(raw: string): { line: number | null; column: number | null } {
  const both = /line[: ]+(\d+)[^0-9]+column[: ]+(\d+)/i.exec(raw)
  if (both) return { line: Number(both[1]), column: Number(both[2]) }
  const lineOnly = /line[: ]+(\d+)/i.exec(raw)
  if (lineOnly) return { line: Number(lineOnly[1]), column: null }
  return { line: null, column: null }
}

/** Turns engine-specific wording into one sentence a human can act on. */
function humaniseXmlError(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim()
  const table: [RegExp, string][] = [
    [
      /mismatched tag|tag mismatch|Opening and ending tag mismatch/i,
      'A closing tag does not match the tag that was opened. XML is case-sensitive: <Item> must close with </Item>, not </item>.',
    ],
    [
      /unclosed token|Premature end of data|no element found|Extra content at the end/i,
      'The document ends before every element is closed. Check for a missing closing tag near the end of the file.',
    ],
    [
      /Entity ['"]?(\w+)['"]? not defined|undefined entity/i,
      'An HTML entity was used that XML does not define. XML only predefines &amp; &lt; &gt; &quot; and &apos;. Write &#160; instead of &nbsp;.',
    ],
    [
      /not well-formed|Invalid character|invalid token/i,
      'There is a character here that cannot appear in XML at this position. A bare & must be written &amp;, and a bare < must be written &lt;.',
    ],
    [
      /junk after document element|Extra content at the end of the document/i,
      'There is content after the root element closes. An XML document may have exactly one root element.',
    ],
    [
      /xml declaration|XML declaration allowed only/i,
      'The <?xml …?> declaration must be the first thing in the file, with no blank line, BOM or comment before it.',
    ],
    [
      /attribute .* redefined|Attribute .* is duplicated|duplicate attribute/i,
      'The same attribute is set twice on one element. Remove the duplicate.',
    ],
    [
      /prefix .* not bound|Namespace prefix .* is not defined|unbound prefix/i,
      'A namespace prefix is used without being declared. Add the matching xmlns:prefix="…" declaration.',
    ],
    [
      /AttValue|expected .?>|Specification mandate value for attribute/i,
      'An attribute is missing its quoted value. XML requires every attribute to be written name="value", even boolean-looking ones.',
    ],
  ]
  for (const [pattern, explanation] of table) {
    if (pattern.test(text)) return explanation
  }
  return text || 'The document is not well-formed XML.'
}

export function parseXml(text: string): XmlParseResult {
  if (typeof DOMParser === 'undefined') return PARSER_UNAVAILABLE
  if (text.trim() === '') {
    return {
      ok: false,
      message: 'Nothing to parse. Paste some XML first.',
      line: null,
      column: null,
      raw: '',
    }
  }
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const failure = doc.getElementsByTagName('parsererror')[0]
  if (failure) {
    const raw = failure.textContent ?? 'Unknown XML parse error.'
    return { ok: false, message: humaniseXmlError(raw), ...extractPosition(raw), raw }
  }
  if (!doc.documentElement) {
    return {
      ok: false,
      message: 'The document has no root element.',
      line: null,
      column: null,
      raw: '',
    }
  }
  return { ok: true, doc }
}

/* ------------------------------------------------------------------ */
/* Pretty printer                                                      */
/* ------------------------------------------------------------------ */

export interface XmlFormatOptions {
  /** Spaces per level, or 0 for a tab. */
  indent: number
  /** Wrap attributes one-per-line once an element exceeds this many columns. */
  wrapAttributesAt: number
  /** Keep <?xml …?> / <!DOCTYPE …> lines. */
  keepDeclaration: boolean
  /** Preserve comments. */
  keepComments: boolean
  /** Collapse <a></a> to <a/>. */
  selfClose: boolean
}

export const DEFAULT_XML_FORMAT: XmlFormatOptions = {
  indent: 2,
  wrapAttributesAt: 100,
  keepDeclaration: true,
  keepComments: true,
  selfClose: true,
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isWhitespaceOnly(node: Text): boolean {
  return node.data.trim() === ''
}

/** True when an element mixes text and child elements — its inner whitespace is significant. */
function hasMixedContent(element: Element): boolean {
  let hasElement = false
  let hasText = false
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 1) hasElement = true
    else if (child.nodeType === 3 && !isWhitespaceOnly(child as Text)) hasText = true
  }
  return hasElement && hasText
}

function serializeInline(node: Node): string {
  switch (node.nodeType) {
    case 1: {
      const element = node as Element
      const attributes = Array.from(element.attributes)
        .map((a) => ` ${a.name}="${escapeAttribute(a.value)}"`)
        .join('')
      const inner = Array.from(element.childNodes).map(serializeInline).join('')
      if (inner === '') return `<${element.nodeName}${attributes}/>`
      return `<${element.nodeName}${attributes}>${inner}</${element.nodeName}>`
    }
    case 3:
      return escapeText((node as Text).data)
    case 4:
      return `<![CDATA[${(node as CDATASection).data}]]>`
    case 7: {
      const pi = node as ProcessingInstruction
      return `<?${pi.target} ${pi.data}?>`
    }
    case 8:
      return `<!--${(node as Comment).data}-->`
    default:
      return ''
  }
}

export interface XmlFormatResult {
  xml: string
  elements: number
  attributes: number
  maxDepth: number
  notes: string[]
}

export function formatXml(text: string, options: XmlFormatOptions): XmlFormatResult | XmlParseError {
  const parsed = parseXml(text)
  if (!parsed.ok) return parsed

  const unit = options.indent === 0 ? '\t' : ' '.repeat(options.indent)
  const lines: string[] = []
  const notes: string[] = []
  let elements = 0
  let attributes = 0
  let maxDepth = 0
  let mixedContentSeen = false

  if (options.keepDeclaration) {
    const declaration = /^\s*(<\?xml[^?]*\?>)/.exec(text)
    if (declaration) lines.push(declaration[1])
    const doctype = /(<!DOCTYPE[^>[]*(\[[\s\S]*?\])?[^>]*>)/i.exec(text)
    if (doctype) lines.push(doctype[1])
  }

  const emitElement = (element: Element, depth: number): void => {
    elements += 1
    attributes += element.attributes.length
    if (depth > maxDepth) maxDepth = depth
    const pad = unit.repeat(depth)
    const attrs = Array.from(element.attributes)
    const attrText = attrs.map((a) => `${a.name}="${escapeAttribute(a.value)}"`)
    const oneLineOpen = `${pad}<${element.nodeName}${attrText.length ? ' ' + attrText.join(' ') : ''}`

    const children = Array.from(element.childNodes).filter((child) => {
      if (child.nodeType === 3) return !isWhitespaceOnly(child as Text)
      if (child.nodeType === 8) return options.keepComments
      return child.nodeType === 1 || child.nodeType === 4 || child.nodeType === 7
    })

    const wrapAttrs = attrs.length > 1 && oneLineOpen.length > options.wrapAttributesAt

    const pushOpen = (close: string) => {
      if (!wrapAttrs) {
        lines.push(`${oneLineOpen}${close}`)
        return
      }
      lines.push(`${pad}<${element.nodeName}`)
      for (const attr of attrText) lines.push(`${pad}${unit}${attr}`)
      lines.push(`${pad}${close.startsWith('/') ? '/>' : '>'}`)
    }

    if (children.length === 0) {
      if (options.selfClose) pushOpen('/>')
      else {
        pushOpen('>')
        lines[lines.length - 1] += `</${element.nodeName}>`
      }
      return
    }

    if (hasMixedContent(element)) {
      mixedContentSeen = true
      const inner = Array.from(element.childNodes).map(serializeInline).join('')
      if (!wrapAttrs) {
        lines.push(`${oneLineOpen}>${inner}</${element.nodeName}>`)
      } else {
        pushOpen('>')
        lines.push(`${pad}${unit}${inner}`)
        lines.push(`${pad}</${element.nodeName}>`)
      }
      return
    }

    // single short text child stays on one line
    if (children.length === 1 && children[0].nodeType === 3) {
      const value = escapeText((children[0] as Text).data.trim())
      const single = `${oneLineOpen}>${value}</${element.nodeName}>`
      if (!wrapAttrs && single.length <= Math.max(options.wrapAttributesAt, 120)) {
        lines.push(single)
        return
      }
      pushOpen('>')
      lines.push(`${pad}${unit}${value}`)
      lines.push(`${pad}</${element.nodeName}>`)
      return
    }

    pushOpen('>')
    for (const child of children) {
      switch (child.nodeType) {
        case 1:
          emitElement(child as Element, depth + 1)
          break
        case 3:
          lines.push(`${pad}${unit}${escapeText((child as Text).data.trim())}`)
          break
        case 4:
          lines.push(`${pad}${unit}<![CDATA[${(child as CDATASection).data}]]>`)
          break
        case 7: {
          const pi = child as ProcessingInstruction
          lines.push(`${pad}${unit}<?${pi.target} ${pi.data}?>`)
          break
        }
        case 8:
          lines.push(`${pad}${unit}<!--${(child as Comment).data}-->`)
          break
        default:
          break
      }
    }
    lines.push(`${pad}</${element.nodeName}>`)
  }

  for (const node of Array.from(parsed.doc.childNodes)) {
    if (node.nodeType === 1) emitElement(node as Element, 0)
    else if (node.nodeType === 8 && options.keepComments) {
      lines.push(`<!--${(node as Comment).data}-->`)
    } else if (node.nodeType === 7) {
      const pi = node as ProcessingInstruction
      lines.push(`<?${pi.target} ${pi.data}?>`)
    }
  }

  if (mixedContentSeen) {
    notes.push(
      'Some elements contain text and child elements together (mixed content). Their inner whitespace is significant, so those lines are left exactly as written rather than re-indented.',
    )
  }

  return { xml: lines.join('\n'), elements, attributes, maxDepth, notes }
}

/* ------------------------------------------------------------------ */
/* Minifier                                                            */
/* ------------------------------------------------------------------ */

export interface XmlMinifyOptions {
  stripComments: boolean
  /** Collapse runs of whitespace inside text nodes to a single space. */
  collapseText: boolean
  keepDeclaration: boolean
  selfClose: boolean
}

export interface XmlMinifyResult {
  xml: string
  before: number
  after: number
}

export function minifyXml(
  text: string,
  options: XmlMinifyOptions,
): XmlMinifyResult | XmlParseError {
  const parsed = parseXml(text)
  if (!parsed.ok) return parsed

  const emit = (node: Node): string => {
    switch (node.nodeType) {
      case 1: {
        const element = node as Element
        const attrs = Array.from(element.attributes)
          .map((a) => ` ${a.name}="${escapeAttribute(a.value)}"`)
          .join('')
        const inner = Array.from(element.childNodes).map(emit).join('')
        if (inner === '' && options.selfClose) return `<${element.nodeName}${attrs}/>`
        return `<${element.nodeName}${attrs}>${inner}</${element.nodeName}>`
      }
      case 3: {
        const data = (node as Text).data
        if (data.trim() === '') return ''
        return escapeText(options.collapseText ? data.replace(/\s+/g, ' ').trim() : data)
      }
      case 4:
        return `<![CDATA[${(node as CDATASection).data}]]>`
      case 7: {
        const pi = node as ProcessingInstruction
        return `<?${pi.target} ${pi.data}?>`
      }
      case 8:
        return options.stripComments ? '' : `<!--${(node as Comment).data}-->`
      default:
        return ''
    }
  }

  let xml = Array.from(parsed.doc.childNodes).map(emit).join('')
  if (options.keepDeclaration) {
    const declaration = /^\s*(<\?xml[^?]*\?>)/.exec(text)
    if (declaration) xml = declaration[1] + xml
  }
  return { xml, before: text.length, after: xml.length }
}

/* ------------------------------------------------------------------ */
/* Tree view model                                                     */
/* ------------------------------------------------------------------ */

export interface XmlTreeNode {
  id: string
  name: string
  attributes: { name: string; value: string }[]
  /** Text content when the element has a single text child. */
  text?: string
  kind: 'element' | 'comment' | 'cdata' | 'pi'
  children: XmlTreeNode[]
}

export function buildXmlTree(doc: XMLDocument): XmlTreeNode[] {
  let counter = 0
  const convert = (node: Node): XmlTreeNode | null => {
    counter += 1
    const id = `n${counter}`
    if (node.nodeType === 1) {
      const element = node as Element
      const childNodes = Array.from(element.childNodes)
      const elementChildren = childNodes.filter(
        (c) => c.nodeType === 1 || c.nodeType === 4 || c.nodeType === 8 || c.nodeType === 7,
      )
      const textChildren = childNodes.filter(
        (c) => c.nodeType === 3 && !isWhitespaceOnly(c as Text),
      )
      return {
        id,
        kind: 'element',
        name: element.nodeName,
        attributes: Array.from(element.attributes).map((a) => ({ name: a.name, value: a.value })),
        text:
          textChildren.length > 0
            ? textChildren.map((t) => (t as Text).data.trim()).join(' ')
            : undefined,
        children: elementChildren
          .map(convert)
          .filter((child): child is XmlTreeNode => child !== null),
      }
    }
    if (node.nodeType === 8) {
      return {
        id,
        kind: 'comment',
        name: '#comment',
        attributes: [],
        text: (node as Comment).data.trim(),
        children: [],
      }
    }
    if (node.nodeType === 4) {
      return {
        id,
        kind: 'cdata',
        name: '#cdata',
        attributes: [],
        text: (node as CDATASection).data,
        children: [],
      }
    }
    if (node.nodeType === 7) {
      const pi = node as ProcessingInstruction
      return { id, kind: 'pi', name: `?${pi.target}`, attributes: [], text: pi.data, children: [] }
    }
    return null
  }

  return Array.from(doc.childNodes)
    .map(convert)
    .filter((node): node is XmlTreeNode => node !== null)
}

/* ------------------------------------------------------------------ */
/* Escaping                                                            */
/* ------------------------------------------------------------------ */

const XML_ESCAPES: [RegExp, string][] = [
  [/&/g, '&amp;'],
  [/</g, '&lt;'],
  [/>/g, '&gt;'],
  [/"/g, '&quot;'],
  [/'/g, '&apos;'],
]

export function escapeXml(text: string, includeQuotes: boolean): string {
  let out = text
  const rules = includeQuotes ? XML_ESCAPES : XML_ESCAPES.slice(0, 3)
  for (const [pattern, replacement] of rules) out = out.replace(pattern, replacement)
  return out
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  euro: '€',
  pound: '£',
  deg: '°',
  middot: '·',
  laquo: '«',
  raquo: '»',
}

export function unescapeXml(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = parseInt(body.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    if (body.startsWith('#')) {
      const code = parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    const named = NAMED_ENTITIES[body]
    return named ?? whole
  })
}

export const XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns:dc="http://purl.org/dc/elements/1.1/" updated="2026-08-14"><!-- staging export -->
<book id="bk101" lang="en"><dc:title>XML Developer's Guide</dc:title><author>Gambardella, Matthew</author><genre>Computer</genre><price currency="USD">44.95</price><description>An in-depth look at creating applications with <emphasis>XML</emphasis>, including namespaces and schemas.</description></book>
<book id="bk102" lang="en"><dc:title>Midnight Rain</dc:title><author>Ralls, Kim</author><genre>Fantasy</genre><price currency="USD">5.95</price><description><![CDATA[A former architect battles corporate zombies & an evil sorceress.]]></description></book>
</catalog>`

export const SOAP_SAMPLE = `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:m="http://example.org/stock"><soap:Header><m:Trans soap:mustUnderstand="1">234</m:Trans></soap:Header><soap:Body><m:GetStockPrice><m:StockName>ACME</m:StockName></m:GetStockPrice></soap:Body></soap:Envelope>`
