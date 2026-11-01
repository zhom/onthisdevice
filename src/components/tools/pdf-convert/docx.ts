/**
 * A minimal but genuinely valid WordprocessingML (.docx) writer.
 *
 * A .docx is a ZIP holding an OPC package. Word (and Google Docs, Pages,
 * LibreOffice) will open a document that contains exactly these parts:
 *
 *   [Content_Types].xml          declares the MIME type of every part
 *   _rels/.rels                  points at the main document + doc properties
 *   word/document.xml            the body
 *   word/styles.xml              paragraph/character styles referenced below
 *   word/_rels/document.xml.rels the document's own relationships
 *   docProps/core.xml            title, creator, dates
 *   docProps/app.xml             producing application
 *
 * We build all seven by hand and zip them with jszip, which keeps the whole
 * conversion inside the browser.
 */
import JSZip from 'jszip'

export type DocxBlockType = 'heading1' | 'heading2' | 'heading3' | 'body' | 'pageBreak'

export interface DocxBlock {
  type: DocxBlockType
  text?: string
}

export interface DocxMeta {
  title: string
  creator?: string
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'

export function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * XML 1.0 forbids most control characters outright — a stray 0x0C from a PDF
 * text layer makes Word refuse to open the file, so strip them here.
 */
export function stripInvalidXmlChars(input: string): string {
  let out = ''
  for (const ch of input) {
    const c = ch.codePointAt(0) ?? 0
    if (c === 0x9 || c === 0xa || c === 0xd) {
      out += ch
    } else if (c >= 0x20 && c <= 0xd7ff) {
      out += ch
    } else if (c >= 0xe000 && c <= 0xfffd) {
      out += ch
    } else if (c >= 0x10000 && c <= 0x10ffff) {
      out += ch
    }
  }
  return out
}

const STYLE_FOR: Record<Exclude<DocxBlockType, 'pageBreak'>, string> = {
  heading1: 'Heading1',
  heading2: 'Heading2',
  heading3: 'Heading3',
  body: 'BodyText',
}

function paragraphXml(block: DocxBlock): string {
  if (block.type === 'pageBreak') {
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
  }
  const styleId = STYLE_FOR[block.type]
  const text = stripInvalidXmlChars(block.text ?? '')
  if (text.trim() === '') {
    return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/></w:pPr></w:p>`
  }
  // Split on line breaks so soft breaks survive as <w:br/> inside one paragraph.
  const runs = text
    .split('\n')
    .map((segment, index) => {
      const br = index === 0 ? '' : '<w:br/>'
      return `<w:r>${br}<w:t xml:space="preserve">${escapeXml(segment)}</w:t></w:r>`
    })
    .join('')
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>${runs}</w:p>`
}

function documentXml(blocks: DocxBlock[]): string {
  const body = blocks.map(paragraphXml).join('')
  return (
    XML_DECL +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<w:body>${body}` +
    '<w:sectPr>' +
    '<w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>' +
    '</w:sectPr>' +
    '</w:body></w:document>'
  )
}

function stylesXml(): string {
  const heading = (id: string, name: string, size: number, outline: number) =>
    `<w:style w:type="paragraph" w:styleId="${id}">` +
    `<w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:qFormat/>` +
    `<w:pPr><w:keepNext/><w:outlineLvl w:val="${outline}"/><w:spacing w:before="240" w:after="120"/></w:pPr>` +
    `<w:rPr><w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`

  return (
    XML_DECL +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr>' +
    '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>' +
    '<w:sz w:val="22"/><w:szCs w:val="22"/>' +
    '</w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
    '</w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="BodyText"><w:name w:val="Body Text"/><w:basedOn w:val="Normal"/>' +
    '<w:pPr><w:spacing w:after="160"/></w:pPr></w:style>' +
    heading('Heading1', 'heading 1', 36, 0) +
    heading('Heading2', 'heading 2', 30, 1) +
    heading('Heading3', 'heading 3', 26, 2) +
    '</w:styles>'
  )
}

function contentTypesXml(): string {
  return (
    XML_DECL +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>'
  )
}

function rootRelsXml(): string {
  const ns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  return (
    XML_DECL +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${ns}/officeDocument" Target="word/document.xml"/>` +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    `<Relationship Id="rId3" Type="${ns}/extended-properties" Target="docProps/app.xml"/>` +
    '</Relationships>'
  )
}

function documentRelsXml(): string {
  const ns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  return (
    XML_DECL +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${ns}/styles" Target="styles.xml"/>` +
    '</Relationships>'
  )
}

function corePropsXml(meta: DocxMeta, now: string): string {
  return (
    XML_DECL +
    '<cp:coreProperties ' +
    'xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
    'xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:dcmitype="http://purl.org/dc/dcmitype/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${escapeXml(stripInvalidXmlChars(meta.title))}</dc:title>` +
    `<dc:creator>${escapeXml(meta.creator ?? 'onthisdevice.com')}</dc:creator>` +
    `<cp:lastModifiedBy>${escapeXml(meta.creator ?? 'onthisdevice.com')}</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    '</cp:coreProperties>'
  )
}

function appPropsXml(): string {
  return (
    XML_DECL +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>onthisdevice.com</Application>' +
    '<Company></Company>' +
    '</Properties>'
  )
}

/** Build a complete .docx from a flat list of paragraph blocks. */
export async function buildDocx(blocks: DocxBlock[], meta: DocxMeta): Promise<Blob> {
  const zip = new JSZip()
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

  zip.file('[Content_Types].xml', contentTypesXml())
  zip.folder('_rels')?.file('.rels', rootRelsXml())
  zip.folder('docProps')?.file('core.xml', corePropsXml(meta, now))
  zip.folder('docProps')?.file('app.xml', appPropsXml())
  const word = zip.folder('word')
  word?.file('document.xml', documentXml(blocks))
  word?.file('styles.xml', stylesXml())
  word?.folder('_rels')?.file('document.xml.rels', documentRelsXml())

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

/**
 * Heuristic: decide whether an extracted paragraph reads like a heading.
 * PDFs carry no structure, so we look at the shape of the line — short, no
 * terminal punctuation, title-case or all-caps, or a numbered section prefix.
 */
export function looksLikeHeading(paragraph: string): false | 'heading1' | 'heading2' {
  const text = paragraph.trim()
  if (text === '' || text.length > 90 || text.includes('\n')) return false
  if (/[.,;:]$/.test(text)) return false
  const words = text.split(/\s+/)
  if (words.length > 12) return false

  if (/^\d+(\.\d+)*[.)]?\s+\S/.test(text)) {
    return /^\d+\.\d/.test(text) ? 'heading2' : 'heading1'
  }
  const letters = text.replace(/[^A-Za-z]/g, '')
  if (letters.length >= 3 && letters === letters.toUpperCase()) return 'heading1'
  if (/^(chapter|section|appendix|part)\b/i.test(text)) return 'heading1'
  return false
}
