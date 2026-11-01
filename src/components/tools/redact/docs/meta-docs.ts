/**
 * Metadata in PDF and Office files: what is there, and a copy without it.
 * PDF content stays as it is; the file is rewritten, which also drops earlier
 * revisions kept by incremental saves. Office files keep their content; the
 * properties and the names on comments and tracked changes are cleared.
 */
import { loadPdfLib } from '@/components/tools/pdf/pdf-edit-core'

export interface Field {
  label: string
  value: string
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

const INFO_KEYS = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate', 'Trapped']

export async function readPdfMeta(bytes: Uint8Array): Promise<Field[]> {
  const { PDFDocument, PDFName, PDFDict, PDFString, PDFHexString } = await loadPdfLib()
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
  const out: Field[] = []
  const infoRef = doc.context.trailerInfo.Info
  const info = infoRef ? doc.context.lookupMaybe(infoRef, PDFDict) : undefined
  for (const [k, v] of info?.entries() ?? []) {
    const key = k.asString().replace(/^\//, '')
    const value = v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : v.toString()
    if (value.trim()) out.push({ label: INFO_KEYS.includes(key) ? key : `Custom: ${key}`, value })
  }
  if (doc.catalog.get(PDFName.of('Metadata'))) out.push({ label: 'XMP metadata', value: 'present' })
  let streams = 0
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFDict ? obj : 'dict' in obj && obj.dict instanceof PDFDict ? obj.dict : null
    if (dict && dict !== doc.catalog && (dict.get(PDFName.of('Metadata')) || dict.get(PDFName.of('PieceInfo')))) streams++
  }
  if (streams) out.push({ label: 'Metadata on pages or images', value: `${streams}` })
  if (doc.isEncrypted) out.push({ label: 'Encryption', value: 'The file is encrypted' })
  return out
}

export async function stripPdf(bytes: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFDict } = await loadPdfLib()
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
  if (doc.isEncrypted) throw new Error('This PDF is encrypted. Remove the password first, then remove the metadata.')
  const infoRef = doc.context.trailerInfo.Info
  const info = infoRef ? doc.context.lookupMaybe(infoRef, PDFDict) : undefined
  for (const k of info?.keys() ?? []) info?.delete(k)
  doc.catalog.delete(PDFName.of('Metadata'))
  doc.catalog.delete(PDFName.of('PieceInfo'))
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFDict ? obj : 'dict' in obj && obj.dict instanceof PDFDict ? obj.dict : null
    if (!dict) continue
    dict.delete(PDFName.of('Metadata'))
    dict.delete(PDFName.of('PieceInfo'))
  }
  return doc.save({ useObjectStreams: true, updateFieldAppearances: false })
}

/* ------------------------------------------------------------------ */
/* Word, Excel, PowerPoint                                             */
/* ------------------------------------------------------------------ */

const td = new TextDecoder()
const te = new TextEncoder()

function tagValues(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, 'g')
  return [...xml.matchAll(re)].map((m) => m[1].trim()).filter(Boolean)
}

function attrValues(xml: string, attr: string): string[] {
  const re = new RegExp(`\\s${attr}="([^"]*)"`, 'g')
  return [...xml.matchAll(re)].map((m) => m[1].trim()).filter(Boolean)
}

const CORE_TAGS: [string, string][] = [
  ['dc:creator', 'Author'],
  ['cp:lastModifiedBy', 'Last saved by'],
  ['cp:revision', 'Revision'],
  ['cp:lastPrinted', 'Last printed'],
  ['dc:title', 'Title'],
  ['dc:subject', 'Subject'],
  ['cp:keywords', 'Keywords'],
  ['dc:description', 'Comments'],
  ['cp:category', 'Category'],
  ['dcterms:created', 'Created'],
  ['dcterms:modified', 'Modified'],
]
const APP_TAGS: [string, string][] = [
  ['Company', 'Company'],
  ['Manager', 'Manager'],
  ['TotalTime', 'Editing time (minutes)'],
  ['Template', 'Template'],
  ['HyperlinkBase', 'Hyperlink base'],
  ['Application', 'Application'],
]

const unxml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

export async function readOfficeMeta(bytes: Uint8Array): Promise<Field[]> {
  const { unzipSync } = await import('fflate')
  const files = unzipSync(bytes)
  const out: Field[] = []
  const core = files['docProps/core.xml'] ? td.decode(files['docProps/core.xml']) : ''
  for (const [tag, label] of CORE_TAGS) for (const v of tagValues(core, tag)) out.push({ label, value: unxml(v) })
  const app = files['docProps/app.xml'] ? td.decode(files['docProps/app.xml']) : ''
  for (const [tag, label] of APP_TAGS) for (const v of tagValues(app, tag)) if (!(tag === 'TotalTime' && v === '0')) out.push({ label, value: unxml(v) })
  const custom = files['docProps/custom.xml'] ? td.decode(files['docProps/custom.xml']) : ''
  for (const m of custom.matchAll(/<property[^>]*name="([^"]*)"[^>]*>\s*<vt:\w+>([^<]*)</g)) out.push({ label: `Custom: ${unxml(m[1])}`, value: unxml(m[2]) })
  const people = new Set<string>()
  for (const [name, data] of Object.entries(files)) {
    if (!/\.xml$/.test(name) || name.startsWith('docProps/')) continue
    const xml = td.decode(data)
    for (const a of attrValues(xml, 'w:author')) people.add(unxml(a))
    if (/comments\d*\.xml$/.test(name) && name.startsWith('xl/')) for (const a of tagValues(xml, 'author')) people.add(unxml(a))
    if (/persons?\/person\.xml$|commentAuthors\.xml$|authors\.xml$/.test(name)) for (const a of [...attrValues(xml, 'displayName'), ...attrValues(xml, 'name')]) people.add(unxml(a))
    if (/people\.xml$/.test(name)) for (const a of attrValues(xml, 'w15:author')) people.add(unxml(a))
  }
  people.delete('Author')
  if (people.size) out.push({ label: 'Names on comments and tracked changes', value: [...people].join(', ') })
  return out
}

function clearTags(xml: string, tags: string[]): string {
  let x = xml
  for (const t of tags) x = x.replace(new RegExp(`<${t}(\\s[^>]*)?>[^<]*</${t}>`, 'g'), '').replace(new RegExp(`<${t}(\\s[^>]*)?/>`, 'g'), '')
  return x
}

export async function stripOffice(bytes: Uint8Array): Promise<Uint8Array> {
  const { unzipSync, zipSync } = await import('fflate')
  const files = unzipSync(bytes)
  const out: Record<string, Uint8Array> = {}
  for (const [name, data] of Object.entries(files)) {
    if (name === 'docProps/custom.xml') continue
    if (!/\.(?:xml|rels)$/.test(name)) {
      out[name] = data
      continue
    }
    let xml = td.decode(data)
    if (name === 'docProps/core.xml') {
      xml = clearTags(xml, ['dc:creator', 'cp:lastModifiedBy', 'cp:lastPrinted', 'dc:description', 'cp:keywords', 'cp:category', 'cp:contentStatus', 'dc:subject'])
      xml = xml.replace(/<cp:revision>[^<]*<\/cp:revision>/, '<cp:revision>1</cp:revision>')
    } else if (name === 'docProps/app.xml') {
      xml = clearTags(xml, ['Company', 'Manager', 'HyperlinkBase'])
      xml = xml.replace(/<TotalTime>[^<]*<\/TotalTime>/, '<TotalTime>0</TotalTime>')
    } else if (name === '_rels/.rels') {
      xml = xml.replace(/<Relationship[^>]*Target="\/?docProps\/custom\.xml"[^>]*\/>/g, '')
    } else if (name === '[Content_Types].xml') {
      xml = xml.replace(/<Override[^>]*PartName="\/docProps\/custom\.xml"[^>]*\/>/g, '')
    } else {
      // Names on comments, tracked changes and their people lists.
      xml = xml
        .replace(/(\sw:author=")[^"]*"/g, '$1Author"')
        .replace(/(\sw:initials=")[^"]*"/g, '$1A"')
        .replace(/(\sw15:author=")[^"]*"/g, '$1Author"')
        .replace(/(\s(?:w15:)?userId=")[^"]*"/g, '$1"')
        .replace(/(\s(?:w15:)?providerId=")[^"]*"/g, '$1"')
      if (/^xl\/comments\d*\.xml$/.test(name)) xml = xml.replace(/<author>[^<]*<\/author>/g, '<author>Author</author>')
      if (/persons?\/person\.xml$|commentAuthors\.xml$|authors\.xml$/.test(name)) {
        xml = xml.replace(/(\sdisplayName=")[^"]*"/g, '$1Author"').replace(/(\sname=")[^"]*"/g, '$1Author"').replace(/(\sinitials=")[^"]*"/g, '$1A"')
      }
    }
    out[name] = te.encode(xml)
  }
  return zipSync(out, { level: 6 })
}
