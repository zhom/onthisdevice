/**
 * What a dropped or pasted file is (magic bytes first, then the name), and which tools take it.
 */
import type { Catalog, ToolDoc } from './data'

export type FileFamily = 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'data' | 'text' | 'archive' | 'other'

export interface FileKind {
  /** Lowercase extension the registry uses in `accepts`, e.g. "jpg". Empty when unknown. */
  ext: string
  /** Short display name, e.g. "JPG image". */
  label: string
  family: FileFamily
}

const FAMILY: Record<string, FileFamily> = {}
const NAMES: Record<string, string> = {}
function kinds(family: FileFamily, list: string): void {
  for (const pair of list.split(' ')) {
    const [ext, name] = pair.split(':')
    FAMILY[ext] = family
    NAMES[ext] = name ?? ext.toUpperCase()
  }
}
kinds('image', 'jpg png webp gif avif heic svg bmp ico tiff')
kinds('video', 'mp4 mov webm mkv avi m4v 3gp mpg ogv')
kinds('audio', 'mp3 wav m4a aac flac ogg opus amr aiff wma')
kinds('pdf', 'pdf')
kinds('document', 'docx:Word pptx:PowerPoint key:Keynote pages:Pages html:HTML md:Markdown')
kinds('data', 'csv xlsx:Excel ods json xml yaml tsv sql numbers:Numbers')
kinds('text', 'txt:Text log:Log eml:Email')
kinds('archive', 'zip gz 7z rar')

/** Extensions that name the same thing as a registry `accepts` value. */
const ALIAS: Record<string, string> = {
  jpeg: 'jpg', jpe: 'jpg', jfif: 'jpg', tif: 'tiff', heif: 'heic', yml: 'yaml', markdown: 'md',
  mdown: 'md', htm: 'html', oga: 'ogg', wave: 'wav', aif: 'aiff', qt: 'mov', text: 'txt',
  xls: 'xlsx', xlsm: 'xlsx', mpeg: 'mpg',
}

/** Accept values that mean "this tool takes that file too". */
const ACCEPTED_AS: Record<string, string[]> = {
  jpg: ['jpg', 'jpeg'],
  yaml: ['yaml', 'yml'],
  md: ['md', 'markdown', 'mdown'],
  html: ['html', 'htm'],
  ogg: ['ogg', 'oga'],
  wav: ['wav', 'wave'],
  aiff: ['aiff', 'aif'],
  txt: ['txt', 'text'],
  xlsx: ['xlsx', 'xls', 'xlsm'],
  tiff: ['tiff', 'tif'],
  heic: ['heic', 'heif'],
  mpg: ['mpg', 'mpeg'],
}

export function extensionOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name)
  if (!m) return ''
  const ext = m[1].toLowerCase()
  return ALIAS[ext] ?? ext
}

export function kindOf(ext: string): FileKind {
  const family = FAMILY[ext] ?? 'other'
  const name = NAMES[ext] ?? (ext ? ext.toUpperCase() : 'Unknown')
  const noun = family === 'image' ? ' image' : family === 'video' ? ' video' : family === 'audio' ? ' audio' : ''
  return { ext, label: family === 'pdf' ? 'PDF' : `${name}${noun}`, family }
}

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len))

/** Container formats and signatures, from the first bytes. Returns "" when nothing matches. */
export function sniff(b: Uint8Array): string {
  const s4 = ascii(b, 0, 4)
  if (s4 === '%PDF') return 'pdf'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b[0] === 0x89 && s4.slice(1) === 'PNG') return 'png'
  if (s4 === 'GIF8') return 'gif'
  if (s4 === 'RIFF') {
    const t = ascii(b, 8, 4)
    if (t === 'WEBP') return 'webp'
    if (t === 'WAVE') return 'wav'
    if (t === 'AVI ') return 'avi'
  }
  if (s4 === 'FORM' && ascii(b, 8, 4).startsWith('AIF')) return 'aiff'
  if (ascii(b, 4, 4) === 'ftyp') {
    const brands = ascii(b, 8, Math.min(32, Math.max(0, b.length - 8)))
    if (/avi[fs]/.test(brands)) return 'avif'
    if (/hei[cxms]|hev[cxms]|mif1|msf1/.test(brands)) return 'heic'
    if (brands.startsWith('qt  ')) return 'mov'
    if (brands.startsWith('M4A') || brands.startsWith('M4B')) return 'm4a'
    if (brands.startsWith('3g')) return '3gp'
    return 'mp4'
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    return ascii(b, 0, Math.min(64, b.length)).includes('webm') ? 'webm' : 'mkv'
  }
  if (s4 === 'fLaC') return 'flac'
  if (s4 === 'OggS') return ascii(b, 0, Math.min(64, b.length)).includes('OpusHead') ? 'opus' : 'ogg'
  if (ascii(b, 0, 3) === 'ID3') return 'mp3'
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return 'aac'
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'mp3'
  if (ascii(b, 0, 5) === '#!AMR') return 'amr'
  if (s4 === 'PK\x03\x04') return 'zip'
  if (b[0] === 0x1f && b[1] === 0x8b) return 'gz'
  if (ascii(b, 0, 6) === '7z\xbc\xaf\x27\x1c') return '7z'
  if (ascii(b, 0, 4) === 'Rar!') return 'rar'
  if (ascii(b, 0, 2) === 'BM') return 'bmp'
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'ico'
  if (s4 === 'II*\0' || s4 === 'MM\0*') return 'tiff'
  return ''
}

/** Office and iWork files are zips; the names inside tell them apart. */
function zipKind(tail: string, ext: string): string {
  if (tail.includes('word/')) return 'docx'
  if (tail.includes('xl/')) return 'xlsx'
  if (tail.includes('ppt/')) return 'pptx'
  if (tail.includes('Index/Document.iwa') || tail.includes('Index/')) {
    return ext === 'key' || ext === 'pages' || ext === 'numbers' ? ext : 'zip'
  }
  return ext === 'docx' || ext === 'xlsx' || ext === 'pptx' || ext === 'ods' ? ext : 'zip'
}

/** Text formats by content when the name does not say. */
function textKind(head: string, ext: string): string {
  if (ext && FAMILY[ext] && FAMILY[ext] !== 'other') return ext
  const t = head.trimStart()
  if (/^<svg[\s>]/i.test(t) || (/^<\?xml/i.test(t) && /<svg[\s>]/i.test(head))) return 'svg'
  if (/^<!doctype html|^<html[\s>]/i.test(t)) return 'html'
  if (/^<\?xml|^<[a-z][\w:-]*[\s>]/i.test(t)) return 'xml'
  if (/^[[{]/.test(t)) {
    try {
      JSON.parse(head)
      return 'json'
    } catch {
      if (head.length < 4000) return 'txt'
      return 'json'
    }
  }
  const lines = t.split(/\r?\n/, 6).filter(Boolean)
  if (lines.length >= 2 && lines.every((l) => l.split(',').length === lines[0].split(',').length && l.includes(','))) {
    return 'csv'
  }
  return ext || 'txt'
}

function looksLikeText(b: Uint8Array): boolean {
  if (b.length === 0) return false
  let odd = 0
  for (const c of b) {
    if (c === 0) return false
    if (c < 9 || (c > 13 && c < 32)) odd++
  }
  return odd / b.length < 0.02
}

export async function detectFile(file: File): Promise<FileKind> {
  const ext = extensionOf(file.name)
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer())
  let found = sniff(head)
  if (found === 'zip') {
    const tail = new Uint8Array(await file.slice(Math.max(0, file.size - 65536)).arrayBuffer())
    found = zipKind(new TextDecoder('latin1').decode(tail), ext)
  } else if (found === 'mp4' && (ext === 'm4v' || ext === 'm4a' || ext === 'mov')) {
    found = ext
  } else if (found === 'mp3' && ext && FAMILY[ext] === 'audio') {
    // Frame-sync bytes are a weak signal; trust a known audio extension.
    found = ext
  } else if (!found && looksLikeText(head)) {
    found = textKind(new TextDecoder().decode(head), ext)
  }
  return kindOf(found || ext)
}

/** Categories whose tools are about this family; a small tie-break over, say, encoders. */
const HOME: Partial<Record<FileFamily, readonly string[]>> = {
  image: ['image-convert', 'image-edit'],
  video: ['media'],
  audio: ['media'],
  pdf: ['pdf', 'pdf-convert'],
  document: ['data', 'pdf-convert'],
  data: ['data'],
  text: ['text', 'data'],
}

/** Tools that take several files at once rank higher when several are dropped. */
const MANY = /merge|combine|join|collage|images-to|alternate|side-by-side/

export interface FileMatch {
  tool: ToolDoc
  score: number
}

/**
 * Tools that take this kind of file, best first: tools made for this format, then popular
 * ones, then the visitor's own recent tools.
 */
export function toolsForFile(
  catalog: Catalog,
  kind: FileKind,
  options: { count?: number; boost?: ReadonlyMap<string, number>; limit?: number } = {},
): FileMatch[] {
  if (!kind.ext) return []
  const names = new Set(ACCEPTED_AS[kind.ext] ?? [kind.ext])
  const count = options.count ?? 1
  const out: FileMatch[] = []
  for (const tool of catalog.tools) {
    const takes = tool.accepts.some((a) => names.has(a))
    const any = tool.accepts.includes('any')
    if (!takes && !any) continue
    let score = takes ? 10 : 2
    if (takes) {
      score += 6 / Math.sqrt(tool.accepts.length)
      // A converter from this format ("mov-to-mp4") is the usual need for media files; PDF
      // tools are all PDF-only, so their own popularity decides.
      const [first] = tool.slug.split('-')
      if (kind.family !== 'pdf' && (names.has(first) || tool.slug.startsWith(`${kind.ext}-to-`))) score += 5
    }
    if (HOME[kind.family]?.includes(tool.category.id)) score += 1.5
    if (tool.rank > 0) score += 3 + 3 * (1 - Math.min(tool.rank, 100) / 100)
    score += options.boost?.get(tool.slug) ?? 0
    if (count > 1 && MANY.test(tool.slug)) score += 6
    out.push({ tool, score })
  }
  out.sort((a, b) => b.score - a.score || a.tool.title.localeCompare(b.tool.title))
  return out.slice(0, options.limit ?? 8)
}

/** Does this tool take a file of this kind? */
export function toolTakes(tool: Pick<ToolDoc, 'accepts'>, kind: FileKind): boolean {
  if (tool.accepts.includes('any')) return true
  const names = new Set(ACCEPTED_AS[kind.ext] ?? [kind.ext])
  return tool.accepts.some((a) => names.has(a))
}
