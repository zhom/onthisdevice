/**
 * File detection cases for scripts/search-test.mjs: bytes (or text) plus a name, the expected
 * extension, and optionally the tool that must be first in the suggestions.
 */
const b = (...xs) => new Uint8Array(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])))
const box = (brand) => b(0, 0, 0, 24, 'ftyp', brand, 0, 0, 0, 0, 'isom')

export const cases = [
  { name: 'a.pdf', bytes: b('%PDF-1.7\n'), ext: 'pdf', top: 'merge-pdf' },
  { name: 'photo', bytes: b(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 'JFIF'), ext: 'jpg' },
  { name: 'x.png', bytes: b(0x89, 'PNG', 13, 10, 26, 10), ext: 'png' },
  { name: 'x.webp', bytes: b('RIFF', 0, 0, 0, 0, 'WEBPVP8 '), ext: 'webp' },
  { name: 'x.wav', bytes: b('RIFF', 0, 0, 0, 0, 'WAVEfmt '), ext: 'wav', top: 'wav-to-mp3' },
  { name: 'x.gif', bytes: b('GIF89a'), ext: 'gif' },
  { name: 'IMG_0001.HEIC', bytes: box('heic'), ext: 'heic' },
  { name: 'x.avif', bytes: box('avif'), ext: 'avif', top: ['avif-to-jpg', 'avif-to-png'] },
  { name: 'clip.mov', bytes: box('qt  '), ext: 'mov', top: 'mov-to-mp4' },
  { name: 'clip.mp4', bytes: box('isom'), ext: 'mp4' },
  { name: 'song.m4a', bytes: box('M4A '), ext: 'm4a', top: 'm4a-to-mp3' },
  { name: 'v.webm', bytes: b(0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 1, 'B', 0xf7, 0x81, 1, 'B', 0x82, 0x84, 'webm'), ext: 'webm' },
  { name: 'v.mkv', bytes: b(0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x88, 'matroska'), ext: 'mkv', top: ['mkv-to-mp4', 'mkv-to-mp3'] },
  { name: 'a.mp3', bytes: b('ID3', 4, 0, 0), ext: 'mp3' },
  { name: 'a.flac', bytes: b('fLaC'), ext: 'flac', top: 'flac-to-mp3' },
  { name: 'a.ogg', bytes: b('OggS', 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'OpusHead'), ext: 'opus' },
  { name: 'z.zip', bytes: b('PK', 3, 4, 20, 0), tail: 'mimetype', ext: 'zip' },
  { name: 'report.docx', bytes: b('PK', 3, 4, 20, 0), tail: '[Content_Types].xml word/document.xml', ext: 'docx', top: ['word-to-pdf', 'docx-to-text', 'docx-to-markdown', 'remove-metadata'] },
  { name: 'book.xlsx', bytes: b('PK', 3, 4, 20, 0), tail: 'xl/workbook.xml', ext: 'xlsx' },
  { name: 'deck.pptx', bytes: b('PK', 3, 4, 20, 0), tail: 'ppt/presentation.xml', ext: 'pptx' },
  { name: 'noname', bytes: b('PK', 3, 4, 20, 0), tail: 'word/document.xml', ext: 'docx' },
  { name: 'icon.svg', text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>', ext: 'svg', top: 'svg-to-png' },
  { name: 'data', text: '{"a": 1, "b": [1, 2]}', ext: 'json' },
  { name: 'rows', text: 'name,age\nann,3\nbob,4\n', ext: 'csv' },
  { name: 'notes.txt', text: 'hello world', ext: 'txt' },
  { name: 'README.md', text: '# Title\n\ntext', ext: 'md' },
  { name: 'page.html', text: '<!doctype html><html></html>', ext: 'html' },
  { name: 'cfg.yml', text: 'a: 1\n', ext: 'yaml', top: 'yaml-to-json' },
  { name: 'pic.bmp', bytes: b('BM', 0, 0), ext: 'bmp' },
  { name: 'fav.ico', bytes: b(0, 0, 1, 0, 1, 0), ext: 'ico', top: 'ico-to-png' },
  { name: 'scan.tif', bytes: b('II*', 0), ext: 'tiff' },
  { name: 'voice.amr', bytes: b('#!AMR\n'), ext: 'amr', top: 'amr-to-mp3' },
  { name: 'mystery.bin', bytes: b(0, 1, 2, 3, 0, 255), ext: 'bin' },
]
