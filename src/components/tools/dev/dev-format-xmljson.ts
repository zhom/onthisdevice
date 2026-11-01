/**
 * XML ↔ JSON conversion for the `dev-format` batch.
 *
 * There is no single "correct" mapping between XML and JSON — XML has
 * attributes, ordering, namespaces and mixed content that JSON has no slot for.
 * Rather than hide that, every lossy decision is an explicit option, and the
 * defaults match the widely used "badgerfish-lite" convention (`@` for
 * attributes, `#text` for text) so round-tripping is predictable.
 */
import { parseXml, type XmlParseError } from './dev-format-xml'

export interface XmlToJsonOptions {
  /** Prefix given to attribute keys, e.g. "@" → `{"@id": "1"}`. */
  attributePrefix: string
  /** Key holding an element's text when it also has attributes or children. */
  textKey: string
  /** Element names that must always become arrays, even with one occurrence. */
  forceArray: string[]
  /** Turn "42" into 42 and "true" into true. */
  coerceScalars: boolean
  /** Drop namespace prefixes from element and attribute names. */
  stripNamespaces: boolean
  /** Keep XML comments as `#comment` entries. */
  keepComments: boolean
  /** Trim leading/trailing whitespace from text nodes. */
  trimText: boolean
}

export const DEFAULT_XML_TO_JSON: XmlToJsonOptions = {
  attributePrefix: '@',
  textKey: '#text',
  forceArray: [],
  coerceScalars: false,
  stripNamespaces: false,
  keepComments: false,
  trimText: true,
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function coerce(raw: string, enabled: boolean): JsonValue {
  if (!enabled) return raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw === 'null') return null
  if (raw !== '' && /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(raw)) {
    const n = Number(raw)
    if (Number.isSafeInteger(n) || !Number.isInteger(n)) return n
  }
  return raw
}

function localName(name: string, strip: boolean): string {
  if (!strip) return name
  const colon = name.indexOf(':')
  return colon === -1 ? name : name.slice(colon + 1)
}

function addChild(
  target: Record<string, JsonValue>,
  key: string,
  value: JsonValue,
  forceArray: Set<string>,
): void {
  const existing = target[key]
  if (existing === undefined) {
    target[key] = forceArray.has(key) ? [value] : value
    return
  }
  if (Array.isArray(existing)) {
    existing.push(value)
    return
  }
  target[key] = [existing, value]
}

export interface XmlToJsonResult {
  ok: true
  value: JsonValue
  /** Things the mapping could not represent faithfully. */
  notes: string[]
}

export function xmlToJson(text: string, options: XmlToJsonOptions): XmlToJsonResult | XmlParseError {
  const parsed = parseXml(text)
  if (!parsed.ok) return parsed

  const forceArray = new Set(options.forceArray.map((n) => n.trim()).filter(Boolean))
  const notes: string[] = []
  let mixedSeen = false
  let orderSensitive = false

  const convertElement = (element: Element): JsonValue => {
    const out: Record<string, JsonValue> = {}
    let hasStructure = false

    for (const attr of Array.from(element.attributes)) {
      if (options.stripNamespaces && (attr.name === 'xmlns' || attr.name.startsWith('xmlns:'))) {
        continue
      }
      out[`${options.attributePrefix}${localName(attr.name, options.stripNamespaces)}`] = coerce(
        attr.value,
        options.coerceScalars,
      )
      hasStructure = true
    }

    const textParts: string[] = []
    let elementChildren = 0
    const seenNames: string[] = []

    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 3 || child.nodeType === 4) {
        const data = (child as Text | CDATASection).data
        if (data.trim() !== '' || !options.trimText) textParts.push(data)
        continue
      }
      if (child.nodeType === 8) {
        if (options.keepComments) {
          addChild(out, '#comment', (child as Comment).data.trim(), forceArray)
          hasStructure = true
        }
        continue
      }
      if (child.nodeType !== 1) continue
      const childElement = child as Element
      const key = localName(childElement.nodeName, options.stripNamespaces)
      seenNames.push(key)
      addChild(out, key, convertElement(childElement), forceArray)
      elementChildren += 1
      hasStructure = true
    }

    if (elementChildren > 1) {
      const distinct = new Set(seenNames)
      if (distinct.size > 1 && seenNames.some((name, i) => i > 0 && name !== seenNames[i - 1])) {
        orderSensitive = true
      }
    }

    const text = options.trimText ? textParts.join('').trim() : textParts.join('')

    if (!hasStructure) return coerce(text, options.coerceScalars)
    if (text !== '') {
      if (elementChildren > 0) mixedSeen = true
      out[options.textKey] = coerce(text, options.coerceScalars)
    }
    return out
  }

  const root = parsed.doc.documentElement
  const value: JsonValue = {
    [localName(root.nodeName, options.stripNamespaces)]: convertElement(root),
  }

  if (mixedSeen) {
    notes.push(
      `Some elements mix text with child elements. The text is collected into "${options.textKey}", but its original position between the child elements is lost, because JSON has nowhere to record it.`,
    )
  }
  if (orderSensitive) {
    notes.push(
      'Sibling elements with different names appear interleaved. JSON objects group them by name, so the original document order between differently-named siblings is not preserved.',
    )
  }
  if (options.coerceScalars) {
    notes.push(
      'Scalar coercion is on: "007" stays a string but "7" becomes the number 7. Turn it off if any of your values are IDs, phone numbers or version strings.',
    )
  }

  return { ok: true, value, notes }
}

/* ------------------------------------------------------------------ */
/* JSON → XML                                                          */
/* ------------------------------------------------------------------ */

export interface JsonToXmlOptions {
  rootName: string
  attributePrefix: string
  textKey: string
  indent: number
  declaration: boolean
  /** Name given to the elements of a bare array. */
  arrayItemName: string
  selfCloseEmpty: boolean
}

export const DEFAULT_JSON_TO_XML: JsonToXmlOptions = {
  rootName: 'root',
  attributePrefix: '@',
  textKey: '#text',
  indent: 2,
  declaration: true,
  arrayItemName: 'item',
  selfCloseEmpty: true,
}

const NAME_START = /[A-Za-z_:]/
const NAME_CHAR = /[A-Za-z0-9._:-]/

/** Turns an arbitrary JSON key into a legal XML element name. */
export function toXmlName(key: string, fallback: string): string {
  let out = ''
  for (let i = 0; i < key.length; i += 1) {
    const ch = key[i]
    if (i === 0) out += NAME_START.test(ch) ? ch : NAME_CHAR.test(ch) ? `_${ch}` : '_'
    else out += NAME_CHAR.test(ch) ? ch : '_'
  }
  out = out.replace(/^[xX][mM][lL]/, '_xml')
  return out === '' ? fallback : out
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value).replace(/"/g, '&quot;')
}

function scalarToText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export interface JsonToXmlResult {
  xml: string
  renamedKeys: { from: string; to: string }[]
}

export function jsonToXml(value: unknown, options: JsonToXmlOptions): JsonToXmlResult {
  const unit = options.indent === 0 ? '\t' : ' '.repeat(options.indent)
  const lines: string[] = []
  const renamed: { from: string; to: string }[] = []
  const seenRenames = new Set<string>()

  const nameFor = (key: string, fallback: string): string => {
    const xmlName = toXmlName(key, fallback)
    if (xmlName !== key && !seenRenames.has(key)) {
      seenRenames.add(key)
      renamed.push({ from: key, to: xmlName })
    }
    return xmlName
  }

  const emit = (name: string, node: unknown, depth: number): void => {
    const pad = unit.repeat(depth)

    if (Array.isArray(node)) {
      for (const item of node) emit(name, item, depth)
      return
    }

    if (node !== null && typeof node === 'object') {
      const entries = Object.entries(node as Record<string, unknown>)
      const attributes: string[] = []
      const children: [string, unknown][] = []
      let text: string | null = null

      for (const [key, child] of entries) {
        if (options.attributePrefix !== '' && key.startsWith(options.attributePrefix)) {
          const attrName = nameFor(key.slice(options.attributePrefix.length), 'attr')
          attributes.push(`${attrName}="${escapeXmlAttribute(scalarToText(child))}"`)
          continue
        }
        if (key === options.textKey) {
          text = scalarToText(child)
          continue
        }
        children.push([key, child])
      }

      const attrText = attributes.length > 0 ? ' ' + attributes.join(' ') : ''

      if (children.length === 0 && (text === null || text === '')) {
        lines.push(
          options.selfCloseEmpty
            ? `${pad}<${name}${attrText}/>`
            : `${pad}<${name}${attrText}></${name}>`,
        )
        return
      }
      if (children.length === 0 && text !== null) {
        lines.push(`${pad}<${name}${attrText}>${escapeXmlText(text)}</${name}>`)
        return
      }

      lines.push(`${pad}<${name}${attrText}>`)
      if (text !== null && text !== '') lines.push(`${pad}${unit}${escapeXmlText(text)}`)
      for (const [key, child] of children) {
        emit(nameFor(key, options.arrayItemName), child, depth + 1)
      }
      lines.push(`${pad}</${name}>`)
      return
    }

    const scalar = scalarToText(node)
    if (scalar === '' && options.selfCloseEmpty) {
      lines.push(`${pad}<${name}/>`)
      return
    }
    lines.push(`${pad}<${name}>${escapeXmlText(scalar)}</${name}>`)
  }

  const rootName = nameFor(options.rootName || 'root', 'root')

  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 1
  ) {
    // A single-key object is already shaped like an XML document; use its key
    // as the root rather than wrapping it a second time.
    const [onlyKey, onlyValue] = Object.entries(value as Record<string, unknown>)[0]
    if (!onlyKey.startsWith(options.attributePrefix) && onlyKey !== options.textKey) {
      emit(nameFor(onlyKey, 'root'), onlyValue, 0)
      const xml = (options.declaration ? '<?xml version="1.0" encoding="UTF-8"?>\n' : '') + lines.join('\n')
      return { xml, renamedKeys: renamed }
    }
  }

  if (Array.isArray(value)) {
    lines.push(`<${rootName}>`)
    for (const item of value) emit(options.arrayItemName, item, 1)
    lines.push(`</${rootName}>`)
  } else {
    emit(rootName, value, 0)
  }

  const xml = (options.declaration ? '<?xml version="1.0" encoding="UTF-8"?>\n' : '') + lines.join('\n')
  return { xml, renamedKeys: renamed }
}

export const XML_TO_JSON_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<order id="A-10482" placed="2026-08-14T09:12:33Z">
  <customer vip="true">
    <name>Ada Lovelace</name>
    <email>ada@example.com</email>
  </customer>
  <items>
    <item sku="KB-01" qty="1">Mechanical keyboard</item>
    <item sku="MS-14" qty="2">Wireless mouse</item>
  </items>
  <total currency="GBP">138.50</total>
</order>`

export const JSON_TO_XML_SAMPLE = `{
  "order": {
    "@id": "A-10482",
    "customer": {
      "@vip": true,
      "name": "Ada Lovelace",
      "email": "ada@example.com"
    },
    "items": {
      "item": [
        { "@sku": "KB-01", "@qty": 1, "#text": "Mechanical keyboard" },
        { "@sku": "MS-14", "@qty": 2, "#text": "Wireless mouse" }
      ]
    },
    "total": { "@currency": "GBP", "#text": 138.5 }
  }
}`
