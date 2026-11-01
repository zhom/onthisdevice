/**
 * A minimal but genuine OOXML (.docx) writer, private to the `pdf-secure`
 * batch. Word documents are just a zip of XML parts, so we build the parts by
 * hand and pack them with jszip — no converter service, no round trip.
 *
 * Output uses Word's own built-in style ids (Heading1…Heading6, ListParagraph,
 * Quote, HTMLPreformatted, TableGrid) so the result picks up whatever theme the
 * reader's Word is using instead of arriving as hard-coded formatting.
 */

export interface DocxRun {
  text: string
  bold?: boolean
  italic?: boolean
  strike?: boolean
  code?: boolean
  href?: string
  breakBefore?: boolean
}

export type DocxBlock =
  | { kind: 'paragraph'; style?: string; runs: DocxRun[] }
  | { kind: 'heading'; level: number; runs: DocxRun[] }
  | { kind: 'listItem'; ordered: boolean; level: number; runs: DocxRun[] }
  | { kind: 'code'; text: string }
  | { kind: 'quote'; runs: DocxRun[] }
  | { kind: 'rule' }
  | { kind: 'table'; header: DocxRun[][]; rows: DocxRun[][][] }

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Word rejects most C0 control characters outright.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

interface LinkRel {
  id: string
  target: string
}

function runXml(run: DocxRun): string {
  const properties: string[] = []
  if (run.code) properties.push('<w:rStyle w:val="HTMLCode"/>')
  if (run.bold) properties.push('<w:b/>')
  if (run.italic) properties.push('<w:i/>')
  if (run.strike) properties.push('<w:strike/>')
  const rPr = properties.length > 0 ? `<w:rPr>${properties.join('')}</w:rPr>` : ''
  const lead = run.breakBefore ? '<w:br/>' : ''
  const pieces = run.text.split('\n')
  const text = pieces
    .map((piece, index) =>
      index === 0
        ? `<w:t xml:space="preserve">${escapeXml(piece)}</w:t>`
        : `<w:br/><w:t xml:space="preserve">${escapeXml(piece)}</w:t>`,
    )
    .join('')
  return `<w:r>${rPr}${lead}${text}</w:r>`
}

function runsXml(runs: DocxRun[], links: LinkRel[]): string {
  return runs
    .map((run) => {
      if (!run.href) return runXml(run)
      const id = `rIdLink${links.length + 1}`
      links.push({ id, target: run.href })
      const styled: DocxRun = { ...run }
      return `<w:hyperlink r:id="${id}" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/>${
        styled.bold ? '<w:b/>' : ''
      }${styled.italic ? '<w:i/>' : ''}</w:rPr><w:t xml:space="preserve">${escapeXml(
        styled.text,
      )}</w:t></w:r></w:hyperlink>`
    })
    .join('')
}

function paragraphXml(
  runs: DocxRun[],
  links: LinkRel[],
  style?: string,
  numbering?: { ordered: boolean; level: number },
): string {
  const properties: string[] = []
  if (style) properties.push(`<w:pStyle w:val="${style}"/>`)
  if (numbering) {
    properties.push(
      `<w:numPr><w:ilvl w:val="${Math.min(2, numbering.level)}"/><w:numId w:val="${
        numbering.ordered ? 2 : 1
      }"/></w:numPr>`,
    )
  }
  const pPr = properties.length > 0 ? `<w:pPr>${properties.join('')}</w:pPr>` : ''
  return `<w:p>${pPr}${runsXml(runs, links)}</w:p>`
}

function tableXml(
  header: DocxRun[][],
  rows: DocxRun[][][],
  links: LinkRel[],
): string {
  const columnCount = Math.max(header.length, ...rows.map((row) => row.length), 1)
  const gridWidth = Math.floor(9360 / columnCount)
  const grid = Array.from({ length: columnCount }, () => `<w:gridCol w:w="${gridWidth}"/>`).join('')

  const cell = (runs: DocxRun[], bold: boolean) =>
    `<w:tc><w:tcPr><w:tcW w:w="${gridWidth}" w:type="dxa"/></w:tcPr>${paragraphXml(
      bold ? runs.map((run) => ({ ...run, bold: true })) : runs,
      links,
      'TableText',
    )}</w:tc>`

  const rowXml = (cells: DocxRun[][], bold: boolean) => {
    const padded = [...cells]
    while (padded.length < columnCount) padded.push([{ text: '' }])
    return `<w:tr>${bold ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${padded
      .map((runs) => cell(runs, bold))
      .join('')}</w:tr>`
  }

  return (
    '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/>' +
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`)
      .join('') +
    '</w:tblBorders></w:tblPr>' +
    `<w:tblGrid>${grid}</w:tblGrid>` +
    (header.length > 0 ? rowXml(header, true) : '') +
    rows.map((row) => rowXml(row, false)).join('') +
    '</w:tbl>'
  )
}

function blockXml(block: DocxBlock, links: LinkRel[]): string {
  switch (block.kind) {
    case 'heading':
      return paragraphXml(block.runs, links, `Heading${Math.min(6, Math.max(1, block.level))}`)
    case 'listItem':
      return paragraphXml(block.runs, links, 'ListParagraph', {
        ordered: block.ordered,
        level: block.level,
      })
    case 'quote':
      return paragraphXml(block.runs, links, 'Quote')
    case 'code':
      return block.text
        .split('\n')
        .map((line) => paragraphXml([{ text: line || ' ' }], links, 'HTMLPreformatted'))
        .join('')
    case 'rule':
      return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="AAAAAA"/></w:pBdr></w:pPr></w:p>'
    case 'table':
      return `${tableXml(block.header, block.rows, links)}<w:p/>`
    case 'paragraph':
    default:
      return paragraphXml(block.runs, links, block.style)
  }
}

const STYLES_XML = `${XML_HEADER}<w:styles xmlns:w="${W_NS}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:semiHidden/><w:unhideWhenUsed/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="200"/><w:contextualSpacing/></w:pPr><w:rPr><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr></w:style>
${[1, 2, 3, 4, 5, 6]
  .map((level) => {
    const sizes = [32, 26, 24, 22, 22, 22]
    return `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="${
      level === 1 ? 320 : 240
    }" w:after="120"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3864"/><w:sz w:val="${
      sizes[level - 1]
    }"/></w:rPr></w:style>`
  })
  .join('\n')}
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720"/><w:contextualSpacing/><w:spacing w:after="60"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720" w:right="720"/><w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="7F7F7F"/></w:pBdr></w:pPr><w:rPr><w:i/><w:color w:val="404040"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="HTMLPreformatted"><w:name w:val="HTML Preformatted"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="240"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:style>
<w:style w:type="character" w:styleId="HTMLCode"><w:name w:val="HTML Code"/><w:basedOn w:val="DefaultParagraphFont"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/><w:left w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/><w:right w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/></w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`

function levelXml(index: number, ordered: boolean): string {
  const bullets = ['\uF0B7', '\uF06F', '\uF0A7']
  const formats = ordered ? ['decimal', 'lowerLetter', 'lowerRoman'] : ['bullet', 'bullet', 'bullet']
  const texts = ordered ? ['%1.', '%2.', '%3.'] : bullets
  const fonts = ordered
    ? ''
    : '<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>'
  return `<w:lvl w:ilvl="${index}"><w:start w:val="1"/><w:numFmt w:val="${formats[index]}"/><w:lvlText w:val="${texts[index]}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${
    720 + index * 360
  }" w:hanging="360"/></w:pPr>${fonts}</w:lvl>`
}

const NUMBERING_XML = `${XML_HEADER}<w:numbering xmlns:w="${W_NS}">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${[0, 1, 2]
  .map((i) => levelXml(i, false))
  .join('')}</w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${[0, 1, 2]
  .map((i) => levelXml(i, true))
  .join('')}</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`

const CONTENT_TYPES = `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`

const ROOT_RELS = `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`

export interface DocxMeta {
  title?: string
  creator?: string
}

/** Build a .docx from an ordered list of blocks. */
export async function buildDocx(blocks: DocxBlock[], meta: DocxMeta = {}): Promise<Blob> {
  const links: LinkRel[] = []
  const body = blocks.map((block) => blockXml(block, links)).join('\n')

  const documentXml = `${XML_HEADER}<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:body>
${body}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>
</w:body></w:document>`

  const documentRels = `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="${R_NS}/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="${R_NS}/numbering" Target="numbering.xml"/>
${links
  .map(
    (link) =>
      `<Relationship Id="${link.id}" Type="${R_NS}/hyperlink" Target="${escapeXml(
        link.target,
      )}" TargetMode="External"/>`,
  )
  .join('\n')}
</Relationships>`

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const coreXml = `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${escapeXml(meta.title ?? '')}</dc:title>
<dc:creator>${escapeXml(meta.creator ?? 'onthisdevice.com')}</dc:creator>
<cp:lastModifiedBy>${escapeXml(meta.creator ?? 'onthisdevice.com')}</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`

  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.folder('_rels')?.file('.rels', ROOT_RELS)
  const word = zip.folder('word')
  word?.file('document.xml', documentXml)
  word?.file('styles.xml', STYLES_XML)
  word?.file('numbering.xml', NUMBERING_XML)
  word?.folder('_rels')?.file('document.xml.rels', documentRels)
  zip.folder('docProps')?.file('core.xml', coreXml)

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}
